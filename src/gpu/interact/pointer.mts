import { FLAG_GRABBED, FLAG_HOVERED } from '../contract.mjs';
import type { GpuCore } from '../core.mjs';
import type { GpuCollection } from '../collection.mjs';
import type { Renderer } from '../render/renderer.mjs';
import type { Position } from '../gpu-types.mjs';

/*
Pointer/wheel interaction over the WebGPU canvas:

- wheel: zoom about the cursor (through the core API, so zoom/viewport
  events fire)
- drag on background: pan
- continuous throttled hover picking (latest-wins) drives the HOVERED flag
  plus mouseover/mouseout events
- pointerdown consults the last *resolved* pick for pan-vs-grab — a
  documented ≤2-frame staleness; a cold start (no resolved pick yet)
  defaults to pan
- node drag writes position through the core API (position events fire,
  dirty spans upload, edges follow on-GPU)
- tap toggles selection (shift = additive); background tap clears

Pinch is deferred.
*/

const TAP_THRESHOLD = 4; // css px of movement before a press becomes a drag
const HOVER_THROTTLE_MS = 25;
const WHEEL_SENSITIVITY = 500; // higher = slower zoom

interface DownState {
  pointerId: number;
  mode: 'pan' | 'grab';
  grabbed: GpuCollection | null;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  shift: boolean;
}

export class PointerHandler {
  private cy: GpuCore;
  private renderer: Renderer;
  private canvas: HTMLCanvasElement;
  private hovered: GpuCollection | null;
  private lastPick: GpuCollection | null;
  private pickInFlight: boolean;
  private lastHoverAt: number;
  private down: DownState | null;
  private cleanups: ( () => void )[];

  constructor( cy: GpuCore, renderer: Renderer ){
    this.cy = cy;
    this.renderer = renderer;
    this.canvas = renderer.canvas;
    this.hovered = null;
    this.lastPick = null;
    this.pickInFlight = false;
    this.lastHoverAt = 0;
    this.down = null;
    this.cleanups = [];

    this.listen( 'wheel', e => this.onWheel( e as WheelEvent ), { passive: false } );
    this.listen( 'pointerdown', e => this.onPointerDown( e as PointerEvent ) );
    this.listen( 'pointermove', e => this.onPointerMove( e as PointerEvent ) );
    this.listen( 'pointerup', e => this.onPointerUp( e as PointerEvent ) );
    this.listen( 'pointercancel', e => this.onPointerCancel( e as PointerEvent ) );
    this.listen( 'pointerleave', () => this.updateHover( null ) );
  }

  destroy(): void {
    for( const cleanup of this.cleanups ){ cleanup(); }

    this.cleanups = [];
  }

  // -- handlers --

  private onWheel( e: WheelEvent ): void {
    e.preventDefault();

    const zoom = this.cy.zoom() as number;
    const dy = e.deltaY * ( e.deltaMode === 1 ? 33 : 1 ); // lines -> px-ish

    this.cy.zoom( {
      level: zoom * Math.pow( 10, -dy / WHEEL_SENSITIVITY ),
      renderedPosition: this.eventPos( e )
    } );
  }

  private onPointerDown( e: PointerEvent ): void {
    if( e.button !== 0 || this.down != null ){ return; }

    this.canvas.setPointerCapture( e.pointerId );

    const pos = this.eventPos( e );

    // pan-vs-grab from the last resolved pick (≤2 frames stale; cold start pans)
    const over = this.lastPick != null && this.lastPick.inside() ? this.lastPick : null;
    const grabbed = over != null && over.isNode() ? over : null;

    this.down = {
      pointerId: e.pointerId,
      mode: grabbed != null ? 'grab' : 'pan',
      grabbed,
      startX: pos.x,
      startY: pos.y,
      lastX: pos.x,
      lastY: pos.y,
      moved: false,
      shift: e.shiftKey
    };

    if( grabbed != null ){
      this.setFlagOn( grabbed, FLAG_GRABBED, true );
    }
  }

  private onPointerMove( e: PointerEvent ): void {
    const pos = this.eventPos( e );
    const down = this.down;

    if( down == null || down.pointerId !== e.pointerId ){
      this.hoverPick( pos );

      return;
    }

    if( !down.moved ){
      const dist = Math.hypot( pos.x - down.startX, pos.y - down.startY );

      if( dist < TAP_THRESHOLD ){ return; }

      down.moved = true;
    }

    const dx = pos.x - down.lastX;
    const dy = pos.y - down.lastY;

    down.lastX = pos.x;
    down.lastY = pos.y;

    if( down.mode === 'pan' ){
      this.cy.panBy( { x: dx, y: dy } );
    } else if( down.grabbed != null && down.grabbed.inside() ){
      const zoom = this.cy.zoom() as number;
      const p = down.grabbed.position() as Position;

      down.grabbed.position( { x: p.x + dx / zoom, y: p.y + dy / zoom } );
    }
  }

  private onPointerUp( e: PointerEvent ): void {
    const down = this.down;

    if( down == null || down.pointerId !== e.pointerId ){ return; }

    this.down = null;

    if( down.grabbed != null ){
      this.setFlagOn( down.grabbed, FLAG_GRABBED, false );
    }

    if( !down.moved ){
      this.tap( down.grabbed ?? ( this.lastPick?.inside() ? this.lastPick : null ), e );
    }
  }

  private onPointerCancel( e: PointerEvent ): void {
    const down = this.down;

    if( down == null || down.pointerId !== e.pointerId ){ return; }

    this.down = null;

    if( down.grabbed != null ){
      this.setFlagOn( down.grabbed, FLAG_GRABBED, false );
    }
  }

  // -- helpers --

  private tap( target: GpuCollection | null, e: PointerEvent ): void {
    const cy = this.cy;
    const position = cy._viewport.renderedToModel( this.eventPos( e ) );

    if( target == null ){ // background tap
      cy.emit( { type: 'tap', position } );

      if( !e.shiftKey ){
        cy.$( ':selected' ).unselect();
      }

      return;
    }

    cy._emitOnEle( 'tap', target, undefined, { position } );

    if( !target.selectable() ){ return; }

    if( target.selected() ){
      target.unselect(); // toggle off
    } else {
      if( !e.shiftKey ){
        cy.$( ':selected' ).difference( target ).unselect();
      }

      target.select();
    }
  }

  private hoverPick( pos: Position ): void {
    const now = performance.now();

    if( this.pickInFlight || now - this.lastHoverAt < HOVER_THROTTLE_MS ){ return; }

    this.lastHoverAt = now;
    this.pickInFlight = true;

    this.renderer.pick( pos.x, pos.y ).then( ele => {
      this.pickInFlight = false;
      this.lastPick = ele;
      this.updateHover( ele, pos );
    } );
  }

  private updateHover( ele: GpuCollection | null, pos?: Position ): void {
    const prev = this.hovered;

    if( prev === ele ){ return; } // interned handles ⇒ identity comparison works

    const position = pos != null ? this.cy._viewport.renderedToModel( pos ) : undefined;

    if( prev != null && prev.inside() ){
      this.setFlagOn( prev, FLAG_HOVERED, false );
      this.cy._emitOnEle( 'mouseout', prev, undefined, { position } );
    }

    this.hovered = ele;

    if( ele != null && ele.inside() ){
      this.setFlagOn( ele, FLAG_HOVERED, true );
      this.cy._emitOnEle( 'mouseover', ele, undefined, { position } );
    }
  }

  private setFlagOn( ele: GpuCollection, bit: number, on: boolean ): void {
    const ref = ele._eventRef();

    if( ref != null && ele.inside() ){
      this.cy._store.setFlag( ref.group, ref.slot, bit, on );
    }
  }

  private eventPos( e: MouseEvent ): Position {
    const rect = this.canvas.getBoundingClientRect();

    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private listen( type: string, handler: ( e: Event ) => void, opts?: AddEventListenerOptions ): void {
    this.canvas.addEventListener( type, handler, opts );
    this.cleanups.push( () => this.canvas.removeEventListener( type, handler ) );
  }
}
