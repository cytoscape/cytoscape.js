import { GROUP_NODES } from '../contract.mjs';
import type { Core } from '../core.mjs';
import type { Collection } from '../collection.mjs';

/**
 * What the gesture layer needs from a renderer (round 86.3): the DOM
 * canvas to listen on, the sync node pick that decides pan-vs-grab, and
 * the async pick.  Satisfied by the same-thread {@link Renderer} and by
 * the worker proxy alike.
 */
export interface GestureRenderer {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  pick(
    x: number,
    y: number,
    pads?: { edgePadPx?: number; nodePadPx?: number },
  ): Promise<number | null>;
  pickNodeSync(x: number, y: number, padPx?: number): number | null;
}
import type { Position } from '../public-types.mjs';
import * as pointerHandlersImpl from './pointer-handlers.mjs';
import * as pointerHoverImpl from './pointer-hover.mjs';

/*
Pointer/wheel interaction over the WebGPU canvas:

- wheel: zoom about the cursor (through the core API, so zoom/viewport
  events fire)
- drag on background: pan
- continuous throttled hover picking (latest-wins) drives the HOVERED flag
  plus mouseover/mouseout events
- pointerdown decides pan-vs-grab with a synchronous CPU node pick
  (no staleness); a press that pick misses resolves through the async GPU
  pick (~a frame) — an edge under it activates (v3's `near.activate()` on
  mousedown) and becomes the tap target, a background press shows the
  active-bg circle
- every gesture pick applies v3's hit halos (see MOUSE_PADS/TOUCH_PADS
  below): edges hit within 8 rendered px for a mouse and 24 for touch,
  nodes within 2/8 — cy.pick stays exact, the halo is the gesture's
- node drag writes position through the core API (position events fire,
  dirty spans upload, edges follow on-GPU)
- tap toggles selection (multiple-select key or selectionType 'additive'
  = additive); background tap clears (selectionType 'single' only)
- box selection: with boxSelectionEnabled, a drag while a
  multiple-select key (shift/ctrl/cmd) is held — or while panning is
  disabled — draws a selection box (a DOM overlay above the canvas) and
  on release selects what the band caught under `cy.boxSelectionMode()`
  — wholly-contained elements under 'contain' (the default, v3's),
  anything the band touches under 'overlap' (round 39.1) — with v3's
  event semantics (boxstart/boxend on the core, box/boxselect per
  element); mouse/pen only for now
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

export const HOVER_THROTTLE_MS = 25;
export const WHEEL_RATE = 500; // base zoom rate divisor (higher = slower); scaled by cy.wheelSensitivity()
// v3's two-finger split (round 20.4): pairs closer than 200 css px start
// the cxt gesture; spreading past 1.5x (or 150 px absolute) cancels it
// into a pinch
export const TOUCH_CXT_MAX_DIST = 200;
export const TOUCH_CXT_CANCEL_DIST = 150;
export const TOUCH_CXT_CANCEL_FACTOR = 1.5;
export const WHEEL_SETTLE_MS = 200; // hover picking resumes this long after the last wheel tick

/**
 * v3's hit-test halos (57.9, `findNearestElement`): a press or hover does
 * not have to land on the painted stroke.  v3 computes them as
 * `(isTouch ? 24 : 8) / zoom` for edges and `(isTouch ? 8 : 2) / zoom`
 * for nodes, in model units — i.e. a constant rendered-px halo, which is
 * what these are (CSS px; the renderer scales by dpr).
 */
export const MOUSE_PADS = { edgePadPx: 8, nodePadPx: 2 };
export const TOUCH_PADS = { edgePadPx: 24, nodePadPx: 8 };

/** The halo pair for a pointer event's type (v3's isTouch branch). */
export const padsOf = (e: PointerEvent): typeof MOUSE_PADS =>
  e.pointerType === 'touch' ? TOUCH_PADS : MOUSE_PADS;

export interface DownState {
  pointerId: number;
  mode: 'pan' | 'grab' | 'box';
  /** the node under the press: the drag subject in 'grab' mode, the tap target otherwise */
  grabbed: Collection | null;
  /** when the grabbed node is selected: every draggable selected node moves together (v3) */
  dragSet: Collection | null;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  shift: boolean;
  /** boxstart has been emitted for this gesture */
  boxStarted?: boolean;
  /**
   * The press landed on a compound *parent*, whose body draws under the
   * edges crossing it (97.1) — so the grab, and the tap target with it,
   * stand only until the edge tier answers through `pending`.
   */
  provisional?: boolean;
  /** the async press target, in flight; resolves with the picked element */
  pending?: Promise<Collection | null>;
}

/** Whether a multiple-select key is held (as in v3). */
export const isMultSelKeyDown = (e: PointerEvent): boolean => {
  return e.shiftKey || e.metaKey || e.ctrlKey;
};

export class PointerHandler {
  /** @internal */
  cy: Core;
  /** @internal */
  renderer: GestureRenderer;
  /** @internal */
  canvas: HTMLCanvasElement;
  /** @internal */
  hovered: Collection | null;
  /** @internal */
  lastPick: Collection | null;
  /** @internal */
  pickInFlight: boolean;
  /** @internal */
  lastHoverAt: number;
  /** @internal */
  down: DownState | null;
  /** @internal */
  boxEl: HTMLDivElement | null;
  /** the active-bg indicator circle (round 13 A2; background grabs) @internal */
  activeEl: HTMLDivElement | null;
  /** the *model* point the active-bg circle is anchored to (round 43) @internal */
  activeModel: Position | null;
  /** @internal */
  touches: Map<number, Position>;
  /** @internal */
  pinch: { dist: number; mid: Position } | null;
  /** the two-finger cxt gesture (round 20.4, v3's touch cxt family) @internal */
  touchCxt: {
    target: Collection | null;
    dragged: boolean;
    baseDist: number;
    startX: number;
    startY: number;
  } | null;
  /** the three-finger box gesture (round 20.5): start + current centroid @internal */
  touchBox: { x1: number; y1: number; x2: number; y2: number } | null;
  /** a gesture that boxed never degrades to a pinch/pan (v3's didSelect latch);
   * cleared when the last finger lifts
   * @internal */
  touchDidSelect: boolean;
  /** @internal */
  deadTouch: number | null;
  /** @internal */
  wheelingUntil: number;
  /** @internal */
  wheelSettleTimer: ReturnType<typeof setTimeout> | null;
  /** @internal */
  cxtDown: {
    pointerId: number;
    target: Collection | null;
    startX: number;
    startY: number;
    moved: boolean;
  } | null;
  /** the node under the cursor during an active press (17.3) @internal */
  dragHover: Collection | null = null;
  /** the cursor keyword last written to the canvas (round 89.1); the
   * writer compares against it so a steady state costs no DOM write
   * @internal */
  cursor = '';
  /** the page's own `documentElement` cursor, saved while a drag mirrors
   * onto it, and put back on every release path (round 89.1, fact 4)
   * @internal */
  docCursor: string | null = null;
  /** the pointer type of the last DOM event, since a cursor is a
   * property of the *device* and touch never gets one
   * @internal */
  pointerType = 'mouse';
  /** @internal */
  lastDragHoverAt = 0;
  /** @internal */
  tapholdTimer: ReturnType<typeof setTimeout> | null;
  /** @internal */
  onetapTimer: ReturnType<typeof setTimeout> | null;
  /** @internal */
  lastTap: { target: Collection | null; at: number } | null;
  private cleanups: (() => void)[];
  /** The DOM event being handled right now, or null between them — the
   * source of `event.originalEvent` on everything this layer emits
   * (round 41.4).
   * @internal */
  domEvent: Event | null = null;

  /**
   * Attach the whole gesture stack to the renderer's canvas.  Constructing
   * one registers the DOM listeners immediately, so a handler is live from
   * this point until `destroy()`; the core builds exactly one per mount.
   *
   * @param cy — the core; all state changes go through its public API so
   *   the usual events fire and the usual dirty spans upload
   * @param renderer — supplies the canvas to listen on and the async pick
   */
  constructor(cy: Core, renderer: GestureRenderer) {
    this.cy = cy;
    this.renderer = renderer;
    // both mounts hand the gesture layer a DOM canvas: the same-thread
    // renderer creates one, and the worker proxy keeps the element whose
    // control it transferred (round 86.3)
    this.canvas = renderer.canvas as HTMLCanvasElement;
    this.hovered = null;
    this.lastPick = null;
    this.pickInFlight = false;
    this.lastHoverAt = 0;
    this.down = null;
    this.boxEl = null;
    this.activeEl = null;
    this.activeModel = null;
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

    this.listen(
      'wheel',
      (e) => pointerHandlersImpl.onWheel(this, e as WheelEvent),
      {
        passive: false,
      },
    );
    this.listen('pointerdown', (e) =>
      pointerHandlersImpl.onPointerDown(this, e as PointerEvent),
    );
    this.listen('pointermove', (e) =>
      pointerHandlersImpl.onPointerMove(this, e as PointerEvent),
    );
    this.listen('pointerup', (e) =>
      pointerHandlersImpl.onPointerUp(this, e as PointerEvent),
    );
    this.listen('pointercancel', (e) =>
      pointerHandlersImpl.onPointerCancel(this, e as PointerEvent),
    );
    this.listen('pointerleave', () => this.updateHover(null));
    // right-button gestures are ours (cxttap family), not the browser menu's
    this.listen('contextmenu', (e) => e.preventDefault());
  }

  /**
   * Detach every DOM listener, cancel the pending timers (wheel settle,
   * taphold, onetap), and remove the overlay elements this handler owns
   * (the selection box and the active-background indicator).  Called on
   * unmount and before a re-mount after device loss (round 10); the
   * handler must not be used afterwards.
   */
  destroy(): void {
    if (this.wheelSettleTimer != null) {
      clearTimeout(this.wheelSettleTimer);
      this.wheelSettleTimer = null;
    }

    this.clearTaphold();
    this.clearOnetap();

    for (const cleanup of this.cleanups) {
      cleanup();
    }

    this.cleanups = [];

    if (this.boxEl != null) {
      this.boxEl.remove();
      this.boxEl = null;
    }

    if (this.activeEl != null) {
      this.activeEl.remove();
      this.activeEl = null;
    }

    // destroy also runs on the device-loss re-mount (round 10), so a
    // cursor left behind here would outlive the handler that set it
    pointerHoverImpl.releaseCursor(this);
  }

  // -- handlers --

  // -- the two-finger cxt gesture (round 20.4) --

  // -- pinch --

  // -- box selection --

  // -- the three-finger box gesture (round 20.5) --

  // -- helpers --

  /**
   * Emit a drag-state event (17.2): on the direct element alone
   * (companions null — the -on variants), or on the direct element and
   * every companion in the drag set.
   * @internal
   */
  emitDragState(
    type: string,
    direct: Collection,
    companions: Collection | null,
    renderedPos: Position,
  ): void {
    const position = this.cy._viewport.renderedToModel(renderedPos);

    if (companions != null) {
      for (let i = 0; i < companions.length; i++) {
        const ele = companions[i];

        if (ele.inside()) {
          this.cy._emitOnEle(type, ele, undefined, {
            position,
            originalEvent: this.domEvent ?? undefined,
          });
        }
      }

      return; // the drag set includes the direct element
    }

    if (direct.inside()) {
      this.cy._emitOnEle(type, direct, undefined, {
        position,
        originalEvent: this.domEvent ?? undefined,
      });
    }
  }

  /** Emit a gesture on the element (or the core) at a rendered position. @internal */
  emitGesture(
    type: string,
    target: Collection | null,
    renderedPos: Position,
  ): void {
    this.emitModelGesture(
      type,
      target,
      this.cy._viewport.renderedToModel(renderedPos),
    );
  }

  /** @internal */
  emitModelGesture(
    type: string,
    target: Collection | null,
    position: Position,
  ): void {
    if (target != null && target.inside()) {
      this.cy._emitOnEle(type, target, undefined, {
        position,
        originalEvent: this.domEvent ?? undefined,
      });
    } else {
      this.cy.emit({
        type,
        position,
        originalEvent: this.domEvent ?? undefined,
      });
    }
  }

  /** Css px a press may move before it stops being a tap: per pointer
   * type, live off the core options (round 20.1 — v3's threshold pair).
   * @internal */
  tapThreshold(e: PointerEvent): number {
    return e.pointerType === 'touch'
      ? (this.cy.touchTapThreshold() as number)
      : (this.cy.desktopTapThreshold() as number);
  }

  /** @internal */
  clearTaphold(): void {
    if (this.tapholdTimer != null) {
      clearTimeout(this.tapholdTimer);
      this.tapholdTimer = null;
    }
  }

  /** @internal */
  clearOnetap(): void {
    if (this.onetapTimer != null) {
      clearTimeout(this.onetapTimer);
      this.onetapTimer = null;
    }
  }

  /** @internal */
  updateHover(ele: Collection | null, pos?: Position): void {
    pointerHoverImpl.updateHover(this, ele, pos);
  }

  /**
   * The element carrying `FLAG_ACTIVE` for the current press — v3's
   * `:active`, which round 57.1c draws as an overlay.
   *
   * One element rather than a set: v3 activates the element under the
   * press and the touch gestures re-activate rather than accumulate, so
   * clearing the previous one here is what keeps the store's active
   * count honest without a per-gesture teardown at six call sites.
   * @internal
   */
  pressed: Collection | null = null;

  /**
   * Recompute the cursor from the state this handler already tracks and
   * write it, once, if it changed (round 89.1).
   *
   * Called from the DOM-listener wrapper — so *every* handler ends by
   * restoring the affordance, which is the one thing the plan named as
   * the place a sticky `grabbing` hides — from `updateHover`, which
   * resolves asynchronously outside that wrapper, and from
   * `cy.pointerCursors()` when the setting is flipped at runtime.
   *
   * The document-level mirror is fact 4 of the round: a drag runs under
   * `setPointerCapture`, which routes *events*, not the cursor, so while
   * the pointer is physically outside the canvas the element underneath
   * decides what is shown.  An active press therefore also writes the
   * root element's cursor, saving whatever the page had there and
   * putting it back on release.
   */
  applyCursor(): void {
    pointerHoverImpl.applyCursor(this);
  }

  /** @internal */
  setFlagOn(ele: Collection, bit: number, on: boolean): void {
    const ref = ele._eventRef();

    if (ref != null && ele.inside()) {
      this.cy._store.setFlag(ref.group, ref.slot, bit, on);
    }
  }

  /** @internal */
  capture(pointerId: number): void {
    try {
      this.canvas.setPointerCapture(pointerId);
    } catch {
      // inactive pointers (synthetic events, already-lifted fingers) throw
    }
  }

  /** @internal */
  eventPos(e: MouseEvent): Position {
    const rect = this.canvas.getBoundingClientRect();

    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  /**
   * Synchronous node pick wrapped to an element (round 86.2): the
   * renderer answers slots, and the element handle is made here, where
   * the core is in reach.
   * @internal
   */
  nodeAt(x: number, y: number, padPx: number): Collection | null {
    const slot = this.renderer.pickNodeSync(x, y, padPx);

    return slot == null ? null : this.cy._ele(GROUP_NODES, slot);
  }

  private listen(
    type: string,
    handler: (e: Event) => void,
    opts?: AddEventListenerOptions,
  ): void {
    // round 41.4: every cytoscape event this layer raises while a DOM event
    // is being handled carries that DOM event as `originalEvent`.  Setting
    // it here rather than at ~25 emit sites keeps the two impossible to get
    // out of step; clearing it in `finally` is what keeps the field honest,
    // since an emit from a *timer* (taphold, onetap) has no DOM event behind
    // it and must report none rather than the last one seen.
    const wrapped = (e: Event): void => {
      this.domEvent = e;

      if ('pointerType' in e) {
        this.pointerType = (e as PointerEvent).pointerType;
      }

      try {
        handler(e);
      } finally {
        this.domEvent = null;
        // round 89.1: the cursor is re-derived after *every* DOM handler
        // rather than at the seven transitions that can change it.  The
        // plan enumerated those transitions; this is a superset, and the
        // reason to prefer it is the plan's own risk note — every
        // gesture-end path must restore, and the ones where a sticky
        // `grabbing` hides are the cancel paths nobody enumerates
        // correctly (pinch degradation, the touch cxt split, the
        // three-finger box).  The cost is one string compare per event.
        this.applyCursor();
      }
    };

    this.canvas.addEventListener(type, wrapped, opts);
    this.cleanups.push(() => this.canvas.removeEventListener(type, wrapped));
  }
}
