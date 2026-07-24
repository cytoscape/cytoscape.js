import { FLAG_GRABBABLE, FLAG_GRABBED, FLAG_HOVERED, FLAG_LOCKED } from '../contract.mjs';
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
- pointerdown decides pan-vs-grab with a synchronous, exact CPU node pick
  (no staleness); the last resolved async pick only supplies edge targets
  for taps
- node drag writes position through the core API (position events fire,
  dirty spans upload, edges follow on-GPU)
- tap toggles selection (shift = additive); background tap clears
- two touch pointers pinch-zoom about their midpoint (and pan with it);
  a second finger cancels any pan/grab in progress, and the finger left
  over after a pinch stays inert until lifted (no pan jump).  Trackpad
  pinches arrive as ctrl+wheel and take the wheel path.
*/

const TAP_THRESHOLD = 4; // css px of movement before a press becomes a drag
const HOVER_THROTTLE_MS = 25;
const WHEEL_SENSITIVITY = 500; // higher = slower zoom
const WHEEL_SETTLE_MS = 200; // hover picking resumes this long after the last wheel tick

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
  private touches: Map<number, Position>;
  private pinch: { dist: number; mid: Position } | null;
  private deadTouch: number | null;
  private wheelingUntil: number;
  private wheelSettleTimer: ReturnType<typeof setTimeout> | null;
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
    this.touches = new Map();
    this.pinch = null;
    this.deadTouch = null;
    this.wheelingUntil = 0;
    this.wheelSettleTimer = null;
    this.cleanups = [];

    this.listen( 'wheel', e => this.onWheel( e as WheelEvent ), { passive: false } );
    this.listen( 'pointerdown', e => this.onPointerDown( e as PointerEvent ) );
    this.listen( 'pointermove', e => this.onPointerMove( e as PointerEvent ) );
    this.listen( 'pointerup', e => this.onPointerUp( e as PointerEvent ) );
    this.listen( 'pointercancel', e => this.onPointerCancel( e as PointerEvent ) );
    this.listen( 'pointerleave', () => this.updateHover( null ) );
  }

  destroy(): void {
    if( this.wheelSettleTimer != null ){
      clearTimeout( this.wheelSettleTimer );
      this.wheelSettleTimer = null;
    }

    for( const cleanup of this.cleanups ){ cleanup(); }

    this.cleanups = [];
  }

  // -- handlers --

  private onWheel( e: WheelEvent ): void {
    e.preventDefault();

    const pos = this.eventPos( e );

    // a wheel zoom is a viewport-only gesture: no mouseover/tap semantics
    // apply mid-gesture, so hover picking pauses (no pick passes at all)
    // until the wheel settles, then re-picks under the cursor once
    this.wheelingUntil = performance.now() + WHEEL_SETTLE_MS;

    if( this.wheelSettleTimer != null ){
      clearTimeout( this.wheelSettleTimer );
    }

    this.wheelSettleTimer = setTimeout( () => {
      this.wheelSettleTimer = null;
      this.wheelingUntil = 0; // reopen hover before the settle re-pick
      this.hoverPick( pos );
    }, WHEEL_SETTLE_MS );

    const zoom = this.cy.zoom() as number;
    const dy = e.deltaY * ( e.deltaMode === 1 ? 33 : 1 ); // lines -> px-ish

    this.cy.zoom( {
      level: zoom * Math.pow( 10, -dy / WHEEL_SENSITIVITY ),
      renderedPosition: pos
    } );
  }

  private onPointerDown( e: PointerEvent ): void {
    if( e.pointerType === 'touch' ){
      this.touches.set( e.pointerId, this.eventPos( e ) );

      if( this.touches.size === 2 && this.pinch == null ){
        this.capture( e.pointerId );
        this.beginPinch();

        return;
      }

      // extra fingers mid-pinch (or after one) just get tracked
      if( this.pinch != null || this.deadTouch != null ){ return; }
    }

    if( e.button !== 0 || this.down != null ){ return; }

    this.capture( e.pointerId );

    const pos = this.eventPos( e );

    // pan-vs-grab from a synchronous CPU node pick: exact and current
    const picked = this.renderer.pickNodeSync( pos.x, pos.y );
    // a node under the cursor is only *dragged* when grabbable and unlocked
    // (and not globally auto-locked/ungrabified); otherwise the press pans,
    // but the node is still remembered as the tap target for selection
    const canDrag = picked != null && this.canDrag( picked );

    this.down = {
      pointerId: e.pointerId,
      mode: canDrag ? 'grab' : 'pan',
      grabbed: picked,
      startX: pos.x,
      startY: pos.y,
      lastX: pos.x,
      lastY: pos.y,
      moved: false,
      shift: e.shiftKey
    };

    if( canDrag ){
      this.setFlagOn( picked, FLAG_GRABBED, true );
    }
  }

  /** Whether a picked node may be dragged: grabbable, unlocked, not globally gated. */
  private canDrag( ele: GpuCollection ): boolean {
    if( this.cy.autolock() === true || this.cy.autoungrabify() === true ){ return false; }

    const ref = ele._eventRef();

    if( ref == null ){ return false; }

    const store = this.cy._store;

    return store.hasFlag( ref.group, ref.slot, FLAG_GRABBABLE )
      && !store.hasFlag( ref.group, ref.slot, FLAG_LOCKED );
  }

  private onPointerMove( e: PointerEvent ): void {
    const pos = this.eventPos( e );

    if( e.pointerType === 'touch' && this.touches.has( e.pointerId ) ){
      this.touches.set( e.pointerId, pos );

      if( this.pinch != null ){
        this.pinchMove();

        return;
      }

      if( this.deadTouch === e.pointerId ){ return; }
    }

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
    if( this.endTouch( e ) ){ return; }

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
    if( this.endTouch( e ) ){ return; }

    const down = this.down;

    if( down == null || down.pointerId !== e.pointerId ){ return; }

    this.down = null;

    if( down.grabbed != null ){
      this.setFlagOn( down.grabbed, FLAG_GRABBED, false );
    }
  }

  // -- pinch --

  /** A second finger turns any pan/grab into a pinch. */
  private beginPinch(): void {
    const down = this.down;

    if( down != null ){
      if( down.grabbed != null ){ this.setFlagOn( down.grabbed, FLAG_GRABBED, false ); }

      this.down = null;
    }

    this.updateHover( null ); // a pinch is a viewport-only gesture
    this.pinch = this.pinchBase();
  }

  private pinchBase(): { dist: number; mid: Position } {
    const [ a, b ] = [ ...this.touches.values() ];

    return {
      dist: Math.hypot( b.x - a.x, b.y - a.y ),
      mid: { x: ( a.x + b.x ) / 2, y: ( a.y + b.y ) / 2 }
    };
  }

  private pinchMove(): void {
    const pinch = this.pinch!;
    const { dist, mid } = this.pinchBase();

    if( pinch.dist > 0 && dist > 0 ){
      this.cy.zoom( {
        level: ( this.cy.zoom() as number ) * dist / pinch.dist,
        renderedPosition: mid
      } );
    }

    this.cy.panBy( { x: mid.x - pinch.mid.x, y: mid.y - pinch.mid.y } );
    this.pinch = { dist, mid };
  }

  /** Touch bookkeeping on up/cancel; true when the event is consumed by pinch state. */
  private endTouch( e: PointerEvent ): boolean {
    if( e.pointerType !== 'touch' ){ return false; }

    const wasPinching = this.pinch != null && this.touches.has( e.pointerId );

    this.touches.delete( e.pointerId );

    if( this.deadTouch === e.pointerId ){
      this.deadTouch = null;

      return true;
    }

    if( !wasPinching ){ return false; }

    if( this.touches.size >= 2 ){
      this.pinch = this.pinchBase(); // rebase on the remaining pair, no jump
    } else {
      this.pinch = null;
      // the leftover finger stays inert until lifted (no pan jump)
      this.deadTouch = this.touches.keys().next().value ?? null;
    }

    return true;
  }

  // -- helpers --

  private tap( target: GpuCollection | null, e: PointerEvent ): void {
    const cy = this.cy;
    const position = cy._viewport.renderedToModel( this.eventPos( e ) );

    const selectionEnabled = cy.autounselectify() !== true;

    if( target == null ){ // background tap
      cy.emit( { type: 'tap', position } );

      if( selectionEnabled && !e.shiftKey ){
        cy.$( ':selected' ).unselect();
      }

      return;
    }

    cy._emitOnEle( 'tap', target, undefined, { position } );

    if( !selectionEnabled || !target.selectable() ){ return; }

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

    // no hover during viewport gestures (pan drags never reach here; wheel
    // zooms are suppressed via the settle window)
    if( now < this.wheelingUntil ){ return; }

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

  private capture( pointerId: number ): void {
    try {
      this.canvas.setPointerCapture( pointerId );
    } catch {
      // inactive pointers (synthetic events, already-lifted fingers) throw
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
