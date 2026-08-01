import { FLAG_GRABBABLE, FLAG_GRABBED, FLAG_HOVERED, FLAG_LOCKED, FLAG_PANNABLE } from '../contract.mjs';
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
- tap toggles selection (multiple-select key or selectionType 'additive'
  = additive); background tap clears (selectionType 'single' only)
- box selection: with boxSelectionEnabled, a drag while a
  multiple-select key (shift/ctrl/cmd) is held — or while panning is
  disabled — draws a selection box (a DOM overlay above the canvas) and
  on release selects the contained elements with v3 semantics
  (boxstart/boxend on the core, box/boxselect per element); mouse/pen
  only for now
- two touch pointers: a close pair (< 200 css px, v3's threshold)
  starts the cxt gesture — cxttapstart on the node under finger 1
  (else finger 2, else the core), cxtdrag (+ cxtdragover/out) as the
  pair moves, cxttapend + cxttap on release, and a spread past 1.5x
  (or 150 px) cancels it into a pinch (round 20.4) — while a far pair
  pinch-zooms about its midpoint immediately (and pans with it).
  Either way the second finger cancels any pan/grab in progress, and
  the finger left over after the gesture stays inert until lifted (no
  pan jump).  Trackpad pinches arrive as ctrl+wheel and take the
  wheel path.
*/

const HOVER_THROTTLE_MS = 25;
const WHEEL_RATE = 500; // base zoom rate divisor (higher = slower); scaled by cy.wheelSensitivity()
// v3's two-finger split (round 20.4): pairs closer than 200 css px start
// the cxt gesture; spreading past 1.5x (or 150 px absolute) cancels it
// into a pinch
const TOUCH_CXT_MAX_DIST = 200;
const TOUCH_CXT_CANCEL_DIST = 150;
const TOUCH_CXT_CANCEL_FACTOR = 1.5;
const WHEEL_SETTLE_MS = 200; // hover picking resumes this long after the last wheel tick

interface DownState {
  pointerId: number;
  mode: 'pan' | 'grab' | 'box';
  /** the node under the press: the drag subject in 'grab' mode, the tap target otherwise */
  grabbed: GpuCollection | null;
  /** when the grabbed node is selected: every draggable selected node moves together (v3) */
  dragSet: GpuCollection | null;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  shift: boolean;
  /** boxstart has been emitted for this gesture */
  boxStarted?: boolean;
}

/** Whether a multiple-select key is held (as in v3). */
const isMultSelKeyDown = ( e: PointerEvent ): boolean => {
  return e.shiftKey || e.metaKey || e.ctrlKey;
};

export class PointerHandler {
  private cy: GpuCore;
  private renderer: Renderer;
  private canvas: HTMLCanvasElement;
  private hovered: GpuCollection | null;
  private lastPick: GpuCollection | null;
  private pickInFlight: boolean;
  private lastHoverAt: number;
  private down: DownState | null;
  private boxEl: HTMLDivElement | null;
  /** the active-bg indicator circle (round 13 A2; background grabs) */
  private activeEl: HTMLDivElement | null;
  private touches: Map<number, Position>;
  private pinch: { dist: number; mid: Position } | null;
  /** the two-finger cxt gesture (round 20.4, v3's touch cxt family) */
  private touchCxt: {
    target: GpuCollection | null; dragged: boolean; baseDist: number;
    startX: number; startY: number;
  } | null;
  /** the three-finger box gesture (round 20.5): start + current centroid */
  private touchBox: { x1: number; y1: number; x2: number; y2: number } | null;
  /** a gesture that boxed never degrades to a pinch/pan (v3's didSelect latch);
   * cleared when the last finger lifts */
  private touchDidSelect: boolean;
  private deadTouch: number | null;
  private wheelingUntil: number;
  private wheelSettleTimer: ReturnType<typeof setTimeout> | null;
  private cxtDown: { pointerId: number; target: GpuCollection | null; startX: number; startY: number; moved: boolean } | null;
  /** the node under the cursor during an active press (17.3) */
  private dragHover: GpuCollection | null = null;
  private lastDragHoverAt = 0;
  private tapholdTimer: ReturnType<typeof setTimeout> | null;
  private onetapTimer: ReturnType<typeof setTimeout> | null;
  private lastTap: { target: GpuCollection | null; at: number } | null;
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
    this.boxEl = null;
    this.activeEl = null;
    this.touches = new Map();
    this.pinch = null;
    this.touchCxt = null;
    this.touchBox = null;
    this.touchDidSelect = false;
    this.deadTouch = null;
    this.wheelingUntil = 0;
    this.wheelSettleTimer = null;
    this.cxtDown = null;
    this.tapholdTimer = null;
    this.onetapTimer = null;
    this.lastTap = null;
    this.cleanups = [];

    this.listen( 'wheel', e => this.onWheel( e as WheelEvent ), { passive: false } );
    this.listen( 'pointerdown', e => this.onPointerDown( e as PointerEvent ) );
    this.listen( 'pointermove', e => this.onPointerMove( e as PointerEvent ) );
    this.listen( 'pointerup', e => this.onPointerUp( e as PointerEvent ) );
    this.listen( 'pointercancel', e => this.onPointerCancel( e as PointerEvent ) );
    this.listen( 'pointerleave', () => this.updateHover( null ) );
    // right-button gestures are ours (cxttap family), not the browser menu's
    this.listen( 'contextmenu', e => e.preventDefault() );
  }

  destroy(): void {
    if( this.wheelSettleTimer != null ){
      clearTimeout( this.wheelSettleTimer );
      this.wheelSettleTimer = null;
    }

    this.clearTaphold();
    this.clearOnetap();

    for( const cleanup of this.cleanups ){ cleanup(); }

    this.cleanups = [];

    if( this.boxEl != null ){
      this.boxEl.remove();
      this.boxEl = null;
    }

    if( this.activeEl != null ){
      this.activeEl.remove();
      this.activeEl = null;
    }
  }

  // -- handlers --

  private onWheel( e: WheelEvent ): void {
    e.preventDefault();

    if( this.cy.userZoomingEnabled() !== true ){ return; }

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

    // v3's wheelSensitivity is a multiplier on the zoom-per-tick exponent
    // (round 20.1); v4's base rate is the same as before
    const sensitivity = this.cy.wheelSensitivity() as number;

    this.cy.zoom( {
      level: zoom * Math.pow( 10, -dy / WHEEL_RATE * sensitivity ),
      renderedPosition: pos
    } );

    // the viewport-gesture vocabulary (17.4)
    this.cy.emit( { type: 'scrollzoom', position: this.cy._viewport.renderedToModel( pos ) } );
  }

  private onPointerDown( e: PointerEvent ): void {
    if( e.pointerType === 'touch' ){
      this.touches.set( e.pointerId, this.eventPos( e ) );

      if( this.touches.size === 2 && this.pinch == null && this.touchCxt == null ){
        this.capture( e.pointerId );

        // v3's two-finger split (20.4): close pairs start the cxt
        // gesture, far pairs pinch immediately
        const [ a, b ] = [ ...this.touches.values() ];

        if( Math.hypot( b.x - a.x, b.y - a.y ) < TOUCH_CXT_MAX_DIST ){
          this.beginTouchCxt();
        } else {
          this.beginPinch();
        }

        return;
      }

      // a third finger during an *undragged* cxt gesture converts it to
      // the box gesture (20.5): pointer events land fingers sequentially,
      // so this is the v4 form of v3's simultaneous three-finger landing
      if( this.touchCxt != null && !this.touchCxt.dragged && this.touches.size === 3
        && this.cy.boxSelectionEnabled() === true ){
        const cxt = this.touchCxt;

        this.touchCxt = null;
        this.dragHover = null;
        this.emitGesture( 'cxttapend', cxt.target, this.eventPos( e ) );

        return;
      }

      // extra fingers mid-gesture just get tracked
      if( this.pinch != null || this.touchCxt != null || this.deadTouch != null
        || this.touchDidSelect || this.touches.size >= 3 ){ return; }
    }

    // right button: the cxttap family (cxttapstart / cxtdrag / cxttapend / cxttap)
    if( e.button === 2 ){
      if( this.down != null || this.cxtDown != null ){ return; }

      this.capture( e.pointerId );

      const pos = this.eventPos( e );
      const target = this.renderer.pickNodeSync( pos.x, pos.y );

      this.cxtDown = { pointerId: e.pointerId, target, startX: pos.x, startY: pos.y, moved: false };
      this.emitGesture( 'pointerdown', target, pos ); // the official vocabulary (17.1)
      this.emitGesture( 'cxttapstart', target, pos );

      return;
    }

    if( e.button !== 0 || this.down != null ){ return; }

    this.capture( e.pointerId );

    const pos = this.eventPos( e );

    // pan-vs-grab from a synchronous CPU node pick: exact and current
    const picked = this.renderer.pickNodeSync( pos.x, pos.y );
    // box selection overrides grabbing (as in v3): a multiple-select-key
    // press boxes even over a node, as does any press when panning is
    // disabled; mouse/pen only for now (v4 has no touch box gesture)
    const boxing = e.pointerType !== 'touch'
      && this.cy.boxSelectionEnabled() === true
      && ( isMultSelKeyDown( e )
        || this.cy.panningEnabled() !== true
        || this.cy.userPanningEnabled() !== true );
    // a node under the cursor is only *dragged* when grabbable and unlocked
    // (and not globally auto-locked/ungrabified); otherwise the press pans,
    // but the node is still remembered as the tap target for selection
    const canDrag = !boxing && picked != null && this.canDrag( picked );

    // dragging a selected node drags every draggable selected node (v3)
    let dragSet: GpuCollection | null = null;

    if( canDrag && picked != null && picked.selected() ){
      const draggable = this.cy.nodes( { selected: true } )
        .filter( ( n: GpuCollection ) => n === picked || this.canDrag( n ) );

      if( draggable.length > 1 ){ dragSet = draggable; }
    }

    this.down = {
      pointerId: e.pointerId,
      mode: boxing ? 'box' : canDrag ? 'grab' : 'pan',
      grabbed: picked,
      dragSet,
      startX: pos.x,
      startY: pos.y,
      lastX: pos.x,
      lastY: pos.y,
      moved: false,
      shift: e.shiftKey
    };

    if( canDrag && picked != null ){
      if( dragSet != null ){
        for( let i = 0; i < dragSet.length; i++ ){ this.setFlagOn( dragSet[ i ], FLAG_GRABBED, true ); }
      } else {
        this.setFlagOn( picked, FLAG_GRABBED, true );
      }

      // the drag-state family (17.2): 'grabon' only on the directly
      // grabbed element; 'grab' on it and every selected companion (v3)
      this.emitDragState( 'grabon', picked, null, pos );
      this.emitDragState( 'grab', picked, dragSet, pos );
    }

    // the pointer re-emits + the normalized press (round 17.1): the
    // official DOM vocabulary the layer itself consumes, plus v3's
    // device-normalized tapstart — both on the pressed element or core
    this.emitGesture( 'pointerdown', picked, pos );
    this.emitGesture( 'tapstart', picked, pos );

    // the background-grab indicator (round 13 A2): v3's active-bg circle
    // at the press point while the background is grabbed
    if( this.down.mode === 'pan' && this.down.grabbed == null ){
      this.showActiveBg( pos.x, pos.y );
    }

    // press-and-hold: 'taphold' unless the press moves or ends first
    this.clearTaphold();
    this.tapholdTimer = setTimeout( () => {
      this.tapholdTimer = null;

      const d = this.down;

      if( d == null || d.pointerId !== e.pointerId || d.moved ){ return; }

      this.emitGesture( 'taphold',
        d.grabbed ?? ( this.lastPick?.inside() ? this.lastPick : null ),
        { x: d.startX, y: d.startY } );
    }, this.cy.tapholdDuration() as number );
  }

  /** Whether a picked node may be dragged: grabbable, unlocked, not globally gated. */
  private canDrag( ele: GpuCollection ): boolean {
    if( this.cy.autolock() === true || this.cy.autoungrabify() === true ){ return false; }

    const ref = ele._eventRef();

    if( ref == null ){ return false; }

    // grabbing is forbidden while the element animates (the tween holds
    // the position lease; a drag override can't fight it)
    if( this.cy._animations.isAnimating( ref ) ){ return false; }

    const store = this.cy._store;

    return store.hasFlag( ref.group, ref.slot, FLAG_GRABBABLE )
      && !store.hasFlag( ref.group, ref.slot, FLAG_LOCKED )
      && !store.hasFlag( ref.group, ref.slot, FLAG_PANNABLE ); // pannable elements pan, never drag
  }

  private onPointerMove( e: PointerEvent ): void {
    const pos = this.eventPos( e );

    // pointermove re-emits on every move (17.1); tapdrag — the
    // normalized drag — only while a press is active
    const pressTarget = this.down?.grabbed ?? this.cxtDown?.target
      ?? ( this.hovered?.inside() ? this.hovered : null );
    const pressed = ( this.down != null && this.down.pointerId === e.pointerId )
      || ( this.cxtDown != null && this.cxtDown.pointerId === e.pointerId );

    this.emitGesture( 'pointermove', pressTarget, pos );

    if( pressed ){
      this.emitGesture( 'tapdrag', pressTarget, pos );

      // hover-during-drag (17.3): a throttled sync node pick drives
      // tapdragover/tapdragout while the press is active (nodes only —
      // the CPU pick; recorded)
      if( this.down != null && this.down.pointerId === e.pointerId ){
        this.dragHoverPick( pos, 'tapdrag' );
      }
    }

    if( e.pointerType === 'touch' && this.touches.has( e.pointerId ) ){
      this.touches.set( e.pointerId, pos );

      if( this.touchCxt != null ){
        this.touchCxtMove();

        return;
      }

      // three fingers box-select (20.5, before pinch — v3's branch order)
      if( this.touches.size >= 3 && this.cy.boxSelectionEnabled() === true ){
        this.touchBoxMove();

        return;
      }

      if( this.touchDidSelect ){ return; } // boxed: leftover fingers stay inert

      if( this.pinch != null ){
        this.pinchMove();

        return;
      }

      if( this.deadTouch === e.pointerId ){ return; }
    }

    const cxt = this.cxtDown;

    if( cxt != null && cxt.pointerId === e.pointerId ){
      if( !cxt.moved && Math.hypot( pos.x - cxt.startX, pos.y - cxt.startY ) >= this.tapThreshold( e ) ){
        cxt.moved = true;
      }

      if( cxt.moved ){
        this.emitGesture( 'cxtdrag', cxt.target, pos );
        this.dragHoverPick( pos, 'cxtdrag' ); // 17.3
      }

      return;
    }

    const down = this.down;

    if( down == null || down.pointerId !== e.pointerId ){
      this.hoverPick( pos );

      return;
    }

    if( !down.moved ){
      const dist = Math.hypot( pos.x - down.startX, pos.y - down.startY );

      if( dist < this.tapThreshold( e ) ){ return; }

      down.moved = true;
      this.clearTaphold();
    }

    const dx = pos.x - down.lastX;
    const dy = pos.y - down.lastY;

    down.lastX = pos.x;
    down.lastY = pos.y;

    if( down.mode === 'pan' ){
      if( this.cy.userPanningEnabled() === true ){
        this.cy.panBy( { x: dx, y: dy } );
        this.cy.emit( { type: 'dragpan', position: this.cy._viewport.renderedToModel( pos ) } ); // 17.4
      }
    } else if( down.mode === 'box' ){
      this.boxUpdate( down, pos );
    } else if( down.grabbed != null && down.grabbed.inside() ){
      const zoom = this.cy.zoom() as number;

      if( down.dragSet != null ){
        down.dragSet.shift( { x: dx / zoom, y: dy / zoom } );
      } else {
        const p = down.grabbed.position() as Position;

        down.grabbed.position( { x: p.x + dx / zoom, y: p.y + dy / zoom } );
      }

      // 'drag' fires per movement on every node the gesture moves (17.2)
      this.emitDragState( 'drag', down.grabbed, down.dragSet, pos );
    }
  }

  /** Show/update the active-bg circle (styled from the core sheet). */
  private showActiveBg( x: number, y: number ): void {
    const core = this.cy._styleEngine.core();

    if( core.activeBgOpacity <= 0 || core.activeBgSize <= 0 ){ return; }

    if( this.activeEl == null ){
      const el = this.canvas.ownerDocument.createElement( 'div' );
      const st = el.style;

      st.position = 'absolute';
      st.pointerEvents = 'none';
      st.zIndex = '1';
      st.borderRadius = '50%';
      ( this.canvas.parentElement ?? this.canvas ).appendChild( el );
      this.activeEl = el;
    }

    const el = this.activeEl;
    const [ r, g, b ] = core.activeBgColor;
    const size = core.activeBgSize;

    el.style.background = `rgba(${r}, ${g}, ${b}, ${core.activeBgOpacity})`;
    el.style.width = `${size * 2}px`;
    el.style.height = `${size * 2}px`;
    el.style.left = `${x - size}px`;
    el.style.top = `${y - size}px`;
    el.style.display = 'block';
  }

  private hideActiveBg(): void {
    if( this.activeEl != null ){ this.activeEl.style.display = 'none'; }
  }

  private onPointerUp( e: PointerEvent ): void {
    this.hideActiveBg();
    if( this.endTouch( e ) ){ return; }

    // the official re-emit + the normalized release (17.1), ahead of
    // the tap/selection flow (v3's ordering: up -> tapend -> tap)
    {
      const pos = this.eventPos( e );
      const hadPress = ( this.down != null && this.down.pointerId === e.pointerId )
        || ( this.cxtDown != null && this.cxtDown.pointerId === e.pointerId );
      const target = this.down?.grabbed ?? this.cxtDown?.target
        ?? ( this.lastPick?.inside() ? this.lastPick : null );

      this.emitGesture( 'pointerup', target, pos );

      if( hadPress ){ this.emitGesture( 'tapend', target, pos ); }
    }

    const cxt = this.cxtDown;

    if( cxt != null && cxt.pointerId === e.pointerId ){
      this.cxtDown = null;
      this.dragHover = null; // 17.3

      const pos = this.eventPos( e );

      this.emitGesture( 'cxttapend', cxt.target, pos );

      if( !cxt.moved ){ this.emitGesture( 'cxttap', cxt.target, pos ); }

      return;
    }

    const down = this.down;

    if( down == null || down.pointerId !== e.pointerId ){ return; }

    this.down = null;
    this.clearTaphold();
    this.dragHover = null; // 17.3: the gesture ended

    if( down.dragSet != null ){
      for( let i = 0; i < down.dragSet.length; i++ ){ this.setFlagOn( down.dragSet[ i ], FLAG_GRABBED, false ); }
    } else if( down.grabbed != null ){
      this.setFlagOn( down.grabbed, FLAG_GRABBED, false );
    }

    // release side of the drag-state family (17.2): 'free' on every
    // grabbed node, 'freeon' on the direct one; the dragfree pair only
    // when the gesture actually moved them
    if( down.mode === 'grab' && down.grabbed != null ){
      const pos = this.eventPos( e );

      this.emitDragState( 'free', down.grabbed, down.dragSet, pos );
      this.emitDragState( 'freeon', down.grabbed, null, pos );

      if( down.moved ){
        this.emitDragState( 'dragfree', down.grabbed, down.dragSet, pos );
        this.emitDragState( 'dragfreeon', down.grabbed, null, pos );
      }
    }

    if( !down.moved ){
      this.tap( down.grabbed ?? ( this.lastPick?.inside() ? this.lastPick : null ), e );
    } else if( down.mode === 'box' ){
      this.boxEnd( down, e );
    }
  }

  private onPointerCancel( e: PointerEvent ): void {
    this.hideActiveBg();
    if( this.endTouch( e, true ) ){ return; }

    this.emitGesture( 'pointercancel', null, this.eventPos( e ) ); // 17.1

    if( this.cxtDown != null && this.cxtDown.pointerId === e.pointerId ){
      this.cxtDown = null;

      return;
    }

    const down = this.down;

    if( down == null || down.pointerId !== e.pointerId ){ return; }

    this.down = null;
    this.clearTaphold();

    if( down.dragSet != null ){
      for( let i = 0; i < down.dragSet.length; i++ ){ this.setFlagOn( down.dragSet[ i ], FLAG_GRABBED, false ); }
    } else if( down.grabbed != null ){
      this.setFlagOn( down.grabbed, FLAG_GRABBED, false );
    }

    // a cancelled gesture still frees (17.2); no dragfree — it aborted
    if( down.mode === 'grab' && down.grabbed != null ){
      const pos = this.eventPos( e );

      this.emitDragState( 'free', down.grabbed, down.dragSet, pos );
      this.emitDragState( 'freeon', down.grabbed, null, pos );
    }

    if( this.boxEl != null ){
      this.boxEl.style.display = 'none';
    }
  }

  // -- the two-finger cxt gesture (round 20.4) --

  /**
   * A close second finger starts v3's touch cxt gesture: 'cxttapstart'
   * on the node under finger 1 (else finger 2, else the core), any
   * pan/grab in progress cancelled like a pinch's.
   */
  private beginTouchCxt(): void {
    const down = this.down;

    if( down != null ){
      if( down.grabbed != null ){ this.setFlagOn( down.grabbed, FLAG_GRABBED, false ); }

      this.down = null;
    }

    this.clearTaphold();
    this.hideActiveBg();
    this.updateHover( null );

    const [ a, b ] = [ ...this.touches.values() ];
    const target = this.renderer.pickNodeSync( a.x, a.y )
      ?? this.renderer.pickNodeSync( b.x, b.y ); // v3: nodes only, finger 1 first

    this.touchCxt = {
      target,
      dragged: false,
      baseDist: Math.hypot( b.x - a.x, b.y - a.y ),
      startX: a.x,
      startY: a.y
    };

    this.emitGesture( 'cxttapstart', target, a );
  }

  private touchCxtMove(): void {
    const cxt = this.touchCxt as NonNullable<typeof this.touchCxt>;
    const [ a, b ] = [ ...this.touches.values() ];

    if( b != null ){
      const dist = Math.hypot( b.x - a.x, b.y - a.y );

      // v3's swipe-out rule: the pair spreading past 1.5x (or 150 px)
      // cancels the cxt gesture into a pinch (cxttapend, then the pinch
      // machinery takes over from the current spread — no zoom jump)
      if( dist >= TOUCH_CXT_CANCEL_DIST
        || ( cxt.baseDist > 0 && dist >= cxt.baseDist * TOUCH_CXT_CANCEL_FACTOR ) ){
        this.touchCxt = null;
        this.dragHover = null;
        this.emitGesture( 'cxttapend', cxt.target, a );
        this.pinch = this.pinchBase();

        return;
      }
    }

    // finger-1 movement past the touch tap threshold drags (v4 rule:
    // the mouse cxt path thresholds too — v3's touch cxt emits cxtdrag
    // on any move event, a recorded deviation)
    if( !cxt.dragged
      && Math.hypot( a.x - cxt.startX, a.y - cxt.startY ) < ( this.cy.touchTapThreshold() as number ) ){
      return;
    }

    cxt.dragged = true;
    this.emitGesture( 'cxtdrag', cxt.target, a );
    this.dragHoverPick( a, 'cxtdrag' ); // cxtdragover/out, as v3
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

    if( pinch.dist > 0 && dist > 0 && this.cy.userZoomingEnabled() === true ){
      this.cy.zoom( {
        level: ( this.cy.zoom() as number ) * dist / pinch.dist,
        renderedPosition: mid
      } );
      this.cy.emit( { type: 'pinchzoom', position: this.cy._viewport.renderedToModel( mid ) } ); // 17.4
    }

    if( this.cy.userPanningEnabled() === true ){
      this.cy.panBy( { x: mid.x - pinch.mid.x, y: mid.y - pinch.mid.y } );
    }

    this.pinch = { dist, mid };
  }

  /** Touch bookkeeping on up/cancel; true when the event is consumed by pinch/cxt state. */
  private endTouch( e: PointerEvent, cancelled: boolean = false ): boolean {
    if( e.pointerType !== 'touch' ){ return false; }

    const wasPinching = this.pinch != null && this.touches.has( e.pointerId );
    const wasCxt = this.touchCxt != null && this.touches.has( e.pointerId );
    const wasBoxing = this.touchBox != null && this.touches.has( e.pointerId );

    this.touches.delete( e.pointerId );

    if( this.deadTouch === e.pointerId ){
      this.deadTouch = null;

      if( this.touches.size === 0 ){ this.touchDidSelect = false; }

      return true;
    }

    // a box finger lifting applies the swept box (20.5); the didSelect
    // latch keeps the leftover fingers inert until every one lifts
    if( wasBoxing ){
      this.applyTouchBox( e, cancelled );

      if( this.touches.size === 0 ){ this.touchDidSelect = false; }

      return true;
    }

    if( this.touchDidSelect ){
      if( this.touches.size === 0 ){ this.touchDidSelect = false; }

      return true;
    }

    // either cxt finger lifting ends the gesture (20.4): cxttapend, and
    // cxttap when it never dragged (never on pointercancel); the
    // leftover finger stays inert until lifted, like a pinch's
    if( wasCxt ){
      const cxt = this.touchCxt as NonNullable<typeof this.touchCxt>;
      const pos = this.eventPos( e );

      this.touchCxt = null;
      this.dragHover = null;
      this.emitGesture( 'cxttapend', cxt.target, pos );

      if( !cxt.dragged && !cancelled ){ this.emitGesture( 'cxttap', cxt.target, pos ); }

      this.deadTouch = this.touches.keys().next().value ?? null;

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

  // -- box selection --

  private boxElement(): HTMLDivElement {
    if( this.boxEl == null ){
      const el = this.canvas.ownerDocument.createElement( 'div' );
      const s = el.style;

      s.position = 'absolute';
      s.display = 'none';
      s.pointerEvents = 'none';
      s.zIndex = '1'; // above the (unpositioned) canvas
      s.boxSizing = 'border-box';

      // the canvas fills the container from (0, 0), so container-absolute
      // coordinates are the same rendered coordinates events use
      ( this.canvas.parentElement ?? this.canvas ).appendChild( el );
      this.boxEl = el;
    }

    return this.boxEl;
  }

  private boxUpdate( down: DownState, pos: Position ): void {
    const cy = this.cy;

    if( down.boxStarted !== true ){
      down.boxStarted = true;
      cy.emit( {
        type: 'boxstart',
        position: cy._viewport.renderedToModel( { x: down.startX, y: down.startY } )
      } );
    }

    this.showBoxRect( down.startX, down.startY, pos.x, pos.y );
  }

  /** Show the DOM selection box over a rendered rect (themed from the
   * core sheet — round 13 A2's selection-box-* props). */
  private showBoxRect( x1: number, y1: number, x2: number, y2: number ): void {
    const el = this.boxElement();
    const core = this.cy._styleEngine.core();
    const [ br, bg, bb ] = core.selectionBoxColor;
    const [ rr, rg, rb ] = core.selectionBoxBorderColor;

    el.style.background = `rgba(${br}, ${bg}, ${bb}, ${core.selectionBoxOpacity})`;
    el.style.border = `${core.selectionBoxBorderWidth}px solid rgba(${rr}, ${rg}, ${rb}, 1)`;

    el.style.display = 'block';
    el.style.left = Math.min( x1, x2 ) + 'px';
    el.style.top = Math.min( y1, y2 ) + 'px';
    el.style.width = Math.abs( x2 - x1 ) + 'px';
    el.style.height = Math.abs( y2 - y1 ) + 'px';
  }

  // -- the three-finger box gesture (round 20.5) --

  /**
   * Three fingers box-select (v3): the box spans the start centroid to
   * the moving centroid, applied when the third finger lifts.  Starting
   * one cancels any cxt/pinch/pan in progress, and the gesture never
   * degrades to a pinch afterwards (the didSelect latch).
   */
  private touchBoxMove(): void {
    const [ a, b, c ] = [ ...this.touches.values() ];
    const cx = ( a.x + b.x + c.x ) / 3;
    const cyPx = ( a.y + b.y + c.y ) / 3;

    if( this.touchBox == null ){
      const down = this.down;

      if( down != null ){
        if( down.grabbed != null ){ this.setFlagOn( down.grabbed, FLAG_GRABBED, false ); }

        this.down = null;
      }

      this.clearTaphold();
      this.hideActiveBg();
      this.updateHover( null );
      this.pinch = null; // the box preempts a pinch in progress (v3's branch order)
      this.touchDidSelect = true;
      this.touchBox = { x1: cx, y1: cyPx, x2: cx + 1, y2: cyPx + 1 }; // v3's +1 seed
      this.cy.emit( {
        type: 'boxstart',
        position: this.cy._viewport.renderedToModel( { x: cx, y: cyPx } )
      } );
    } else {
      this.touchBox.x2 = cx;
      this.touchBox.y2 = cyPx;
    }

    this.showBoxRect( this.touchBox.x1, this.touchBox.y1, this.touchBox.x2, this.touchBox.y2 );
  }

  /** Apply the swept box with v3's touch semantics: additive (no
   * clearing), interactive elements only, boxend/box/boxselect. */
  private applyTouchBox( e: PointerEvent, cancelled: boolean ): void {
    const cy = this.cy;
    const box = this.touchBox as NonNullable<typeof this.touchBox>;

    this.touchBox = null;

    if( this.boxEl != null ){ this.boxEl.style.display = 'none'; }

    if( cancelled ){ return; } // an aborted gesture selects nothing (no boxend)

    const p1 = cy._viewport.renderedToModel( { x: box.x1, y: box.y1 } );
    const p2 = cy._viewport.renderedToModel( { x: box.x2, y: box.y2 } );
    const position = p2;

    cy.emit( { type: 'boxend', position } );

    const eles = cy.elementsInBox( p1.x, p1.y, p2.x, p2.y )
      .filter( ( ele: GpuCollection ) => ele.interactive() ); // the 20.2 rule

    for( let i = 0; i < eles.length; i++ ){
      cy._emitOnEle( 'box', eles[ i ], undefined, { position } );
    }

    if( cy.autounselectify() === true ){ return; }

    const toSelect = eles.filter( ( ele: GpuCollection ) => ele.selectable() && !ele.selected() );

    toSelect.select();

    for( let i = 0; i < toSelect.length; i++ ){
      cy._emitOnEle( 'boxselect', toSelect[ i ], undefined, { position } );
    }
  }

  /** Apply the released box with v3 semantics (boxend, box, boxselect). */
  private boxEnd( down: DownState, e: PointerEvent ): void {
    const cy = this.cy;

    if( this.boxEl != null ){ this.boxEl.style.display = 'none'; }

    const p1 = cy._viewport.renderedToModel( { x: down.startX, y: down.startY } );
    const p2 = cy._viewport.renderedToModel( { x: down.lastX, y: down.lastY } );
    const position = p2;
    // 20.2: events:'no' elements are not box-selectable and get no box
    // events (v3 boxes over its interactive set); the geometric query
    // itself stays unfiltered
    const box = cy.elementsInBox( p1.x, p1.y, p2.x, p2.y )
      .filter( ( ele: GpuCollection ) => ele.interactive() );

    cy.emit( { type: 'boxend', position } );

    for( let i = 0; i < box.length; i++ ){
      cy._emitOnEle( 'box', box[ i ], undefined, { position } );
    }

    if( cy.autounselectify() === true ){ return; }

    const additive = isMultSelKeyDown( e ) || cy.selectionType() === 'additive';

    if( !additive ){
      cy.elements( { selected: true } ).difference( box ).unselect();
    }

    const toSelect = box.filter( ele => ele.selectable() && !ele.selected() );

    toSelect.select();

    for( let i = 0; i < toSelect.length; i++ ){
      cy._emitOnEle( 'boxselect', toSelect[ i ], undefined, { position } );
    }
  }

  // -- helpers --

  private tap( target: GpuCollection | null, e: PointerEvent ): void {
    const cy = this.cy;
    const position = cy._viewport.renderedToModel( this.eventPos( e ) );

    const selectionEnabled = cy.autounselectify() !== true;
    const additive = isMultSelKeyDown( e ) || cy.selectionType() === 'additive';

    if( target == null ){ // background tap
      cy.emit( { type: 'tap', position } );
    } else {
      cy._emitOnEle( 'tap', target, undefined, { position } );
    }

    this.multiClick( target, position );

    if( target == null ){
      if( selectionEnabled && !additive ){
        cy.elements( { selected: true } ).unselect();
      }

      return;
    }

    if( !selectionEnabled || !target.selectable() ){ return; }

    if( target.selected() ){
      target.unselect(); // toggle off
      cy._emitOnEle( 'tapunselect', target, undefined, { position } ); // 17.3
    } else {
      if( !additive ){
        cy.elements( { selected: true } ).difference( target ).unselect();
      }

      target.select();
      cy._emitOnEle( 'tapselect', target, undefined, { position } ); // 17.3
    }
  }

  /**
   * v3's multi-click flow: a second tap on the same target within
   * `cy.multiClickDebounceTime()` fires 'dbltap'; a tap with no follow-up
   * inside the window fires the debounced 'onetap'.  ('tap' itself always
   * fires immediately.)
   */
  private multiClick( target: GpuCollection | null, position: Position ): void {
    const now = performance.now();
    const debounce = this.cy.multiClickDebounceTime() as number;
    const prev = this.lastTap;

    if( prev != null && now - prev.at <= debounce && prev.target === target ){
      this.lastTap = null;
      this.clearOnetap();
      this.emitModelGesture( 'dbltap', target, position );

      return;
    }

    this.lastTap = { target, at: now };
    this.clearOnetap();
    this.onetapTimer = setTimeout( () => {
      this.onetapTimer = null;
      this.lastTap = null;
      this.emitModelGesture( 'onetap', target, position );
    }, debounce );
  }

  /**
   * Hover-during-drag (17.3): while a press is active, a throttled
   * synchronous node pick drives `<prefix>over` / `<prefix>out` as the
   * cursor enters and leaves nodes.  Nodes only — the exact CPU pick;
   * edges would need the async GPU tile (recorded).
   */
  private dragHoverPick( pos: Position, prefix: 'tapdrag' | 'cxtdrag' ): void {
    const now = performance.now();

    if( now - this.lastDragHoverAt < HOVER_THROTTLE_MS ){ return; }

    this.lastDragHoverAt = now;

    const ele = this.renderer.pickNodeSync( pos.x, pos.y );
    const prev = this.dragHover;

    if( prev === ele ){ return; }

    const position = this.cy._viewport.renderedToModel( pos );

    if( prev != null && prev.inside() ){
      this.cy._emitOnEle( prefix + 'out', prev, undefined, { position } );
    }

    this.dragHover = ele;

    if( ele != null && ele.inside() ){
      this.cy._emitOnEle( prefix + 'over', ele, undefined, { position } );
    }
  }

  /**
   * Emit a drag-state event (17.2): on the direct element alone
   * (companions null — the -on variants), or on the direct element and
   * every companion in the drag set.
   */
  private emitDragState(
    type: string, direct: GpuCollection, companions: GpuCollection | null, renderedPos: Position
  ): void {
    const position = this.cy._viewport.renderedToModel( renderedPos );

    if( companions != null ){
      for( let i = 0; i < companions.length; i++ ){
        const ele = companions[ i ];

        if( ele.inside() ){ this.cy._emitOnEle( type, ele, undefined, { position } ); }
      }

      return; // the drag set includes the direct element
    }

    if( direct.inside() ){ this.cy._emitOnEle( type, direct, undefined, { position } ); }
  }

  /** Emit a gesture on the element (or the core) at a rendered position. */
  private emitGesture( type: string, target: GpuCollection | null, renderedPos: Position ): void {
    this.emitModelGesture( type, target, this.cy._viewport.renderedToModel( renderedPos ) );
  }

  private emitModelGesture( type: string, target: GpuCollection | null, position: Position ): void {
    if( target != null && target.inside() ){
      this.cy._emitOnEle( type, target, undefined, { position } );
    } else {
      this.cy.emit( { type, position } );
    }
  }

  /** Css px a press may move before it stops being a tap: per pointer
   * type, live off the core options (round 20.1 — v3's threshold pair). */
  private tapThreshold( e: PointerEvent ): number {
    return e.pointerType === 'touch'
      ? this.cy.touchTapThreshold() as number
      : this.cy.desktopTapThreshold() as number;
  }

  private clearTaphold(): void {
    if( this.tapholdTimer != null ){
      clearTimeout( this.tapholdTimer );
      this.tapholdTimer = null;
    }
  }

  private clearOnetap(): void {
    if( this.onetapTimer != null ){
      clearTimeout( this.onetapTimer );
      this.onetapTimer = null;
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
      this.cy._emitOnEle( 'pointerout', prev, undefined, { position } ); // 17.1
    }

    this.hovered = ele;

    if( ele != null && ele.inside() ){
      this.setFlagOn( ele, FLAG_HOVERED, true );
      this.cy._emitOnEle( 'mouseover', ele, undefined, { position } );
      this.cy._emitOnEle( 'pointerover', ele, undefined, { position } ); // 17.1
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
