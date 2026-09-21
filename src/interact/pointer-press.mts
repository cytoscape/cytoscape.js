// The press gesture (round 130 split): drag eligibility, the active
// background, the provisional grab resolved through the async pick, pan
// start, tap and multi-click.

import {
  FLAG_GRABBABLE,
  FLAG_GRABBED,
  FLAG_LOCKED,
  FLAG_PANNABLE,
} from '../contract.mjs';
import type { Collection } from '../collection.mjs';
import type { Position } from '../public-types.mjs';
import { MOUSE_PADS, isMultSelKeyDown } from './pointer.mjs';
import type { DownState, PointerHandler } from './pointer.mjs';
import { setPressed } from './pointer-hover.mjs';

/** Whether a picked node may be dragged: grabbable, unlocked, not globally gated. */
export function canDragImpl(ph: PointerHandler, ele: Collection): boolean {
  if (ph.cy.autolock() === true || ph.cy.autoungrabify() === true) {
    return false;
  }

  const ref = ele._eventRef();

  if (ref == null) {
    return false;
  }

  // grabbing is forbidden while the element animates (the tween holds
  // the position lease; a drag override can't fight it)
  if (ph.cy._animations.isAnimating(ref)) {
    return false;
  }

  const store = ph.cy._store;

  return (
    store.hasFlag(ref.group, ref.slot, FLAG_GRABBABLE) &&
    !store.hasFlag(ref.group, ref.slot, FLAG_LOCKED) &&
    !store.hasFlag(ref.group, ref.slot, FLAG_PANNABLE)
  ); // pannable elements pan, never drag
}

/**
 * Show the active-bg circle (styled from the core sheet) at a rendered point.
 *
 * The press point is remembered in **model** space, which is v3's rule
 * (`r.data.bgActivePosistion` is a projected position, drawn inside the
 * transformed canvas).  It matters: the graph moves under a background pan,
 * so a model-anchored circle stays glued to the point you pressed — which
 * reads as following the cursor — while a screen-anchored one would sit
 * still.  Round 43 fixed exactly that: the circle was positioned once, here,
 * and no path ever moved it again.
 */
export function showActiveBg(ph: PointerHandler, x: number, y: number): void {
  const core = ph.cy._styleEngine.core();

  if (core.activeBgOpacity <= 0 || core.activeBgSize <= 0) {
    return;
  }

  if (ph.activeEl == null) {
    const el = ph.canvas.ownerDocument.createElement('div');
    const st = el.style;

    st.position = 'absolute';
    st.pointerEvents = 'none';
    st.zIndex = '1';
    st.borderRadius = '50%';
    (ph.canvas.parentElement ?? ph.canvas).appendChild(el);
    ph.activeEl = el;
  }

  const el = ph.activeEl;
  const [r, g, b] = core.activeBgColor;
  const size = core.activeBgSize;

  ph.activeModel = ph.cy._viewport.renderedToModel({ x, y });

  el.style.background = `rgba(${r}, ${g}, ${b}, ${core.activeBgOpacity})`;
  el.style.width = `${size * 2}px`;
  el.style.height = `${size * 2}px`;
  el.style.left = `${x - size}px`;
  el.style.top = `${y - size}px`;
  el.style.display = 'block';
}

/**
 * Re-project the circle onto the point it was pressed at.  Called per move
 * while the press is held, so the pan that the same move performs cannot
 * leave the indicator behind.  The radius is a constant screen size and so
 * does not scale — v3 divides by the zoom only because it draws inside the
 * zoomed context.
 */
export function repositionActiveBg(ph: PointerHandler): void {
  const el = ph.activeEl;

  if (el == null || ph.activeModel == null || el.style.display === 'none') {
    return;
  }

  const size = ph.cy._styleEngine.core().activeBgSize;
  const p = ph.cy._viewport.modelToRendered(ph.activeModel);

  el.style.left = `${p.x - size}px`;
  el.style.top = `${p.y - size}px`;
}

/**
 * The press ended: hide the background-grab indicator and drop
 * `FLAG_ACTIVE` from whatever carried it.  Called from every gesture
 * end — pointerup, pointercancel, the touch teardown and destroy — so
 * it is the one place the active state is released.
 */
export function hideActiveBg(ph: PointerHandler): void {
  setPressed(ph, null);

  if (ph.activeEl != null) {
    ph.activeEl.style.display = 'none';
  }

  ph.activeModel = null;
}

/**
 * Decide what a press the synchronous node pick missed actually landed
 * on: an edge, or the background.  Edges hit-test on the GPU, so the
 * answer is asynchronous — ~a frame, or a microtask when the cursor
 * sits in the cached pick tile — where v3 answers at mousedown because
 * its hit test is synchronous.  Both affordances are purely visual, so
 * late is fine; stale is not, hence the guards.
 *
 * An element under the press carries `FLAG_ACTIVE` (v3 calls
 * `near.activate()` on mousedown for whatever is near, edges included
 * — an edge not being draggable does not make it unclickable, and the
 * wash is the signifier of the click in progress) and becomes the tap
 * target the release reads (`lastPick`, which a touch press otherwise
 * never populates).  A background press shows the active-bg circle —
 * which v3 shows only when nothing is near, so it waits for the
 * answer rather than flashing over every edge press.  A press that
 * already panned gets the circle either way: v3 unactivates a
 * pannable element the moment its pan starts (see `panStarted`), and
 * anchors the circle at the *pressed* model point, captured here
 * before any pan can move it.
 */
export async function resolvePressTarget(
  ph: PointerHandler,
  down: DownState,
  pos: Position,
  pads: typeof MOUSE_PADS,
): Promise<Collection | null> {
  const model = ph.cy._viewport.renderedToModel(pos);
  let picked: Collection | null = null;

  try {
    picked = ph.cy._decodePick(await ph.renderer.pick(pos.x, pos.y, pads));
  } catch {
    // a device lost mid-pick reads as a background press
  }

  const hit = picked != null && picked.inside() ? picked : null;
  // the press may already have ended — the answer still resolves, because
  // a release that did not move waits for it (97.1); only the *affordance*
  // is dropped, which the release already undid
  const live = ph.down === down;

  if (hit != null) {
    // 97.1: the press landed on a parent body and the edge tier
    // outranked it, so the parent's grab was provisional — hand the
    // gesture to the edge, which is not draggable, so the press means
    // a pan, exactly as a press on a bare edge does.  A press that has
    // already moved owns its drag and keeps it.
    if (live && down.grabbed != null && hit !== down.grabbed && !down.moved) {
      dropProvisionalGrab(ph, down, pos);
    }

    ph.lastPick = hit; // the tap target for the release

    if (live && !down.moved) {
      setPressed(ph, hit);
    }

    return hit;
  }

  if (live) {
    const p = ph.cy._viewport.modelToRendered(model);

    showActiveBg(ph, p.x, p.y);
  }

  return null;
}

/**
 * Undo a grab the async press target overruled (round 97.1).  Only a
 * *parent* grab is ever provisional — a leaf answers the pick outright
 * — and only while the press has not moved, so nothing has been dragged
 * and there is no `dragfree` to emit; the `free`/`freeon` pair still
 * balances the `grab`/`grabon` the press emitted (17.2).
 */
export function dropProvisionalGrab(
  ph: PointerHandler,
  down: DownState,
  pos: Position,
): void {
  if (down.dragSet != null) {
    for (let i = 0; i < down.dragSet.length; i++) {
      ph.setFlagOn(down.dragSet[i], FLAG_GRABBED, false);
    }
  } else if (down.grabbed != null) {
    ph.setFlagOn(down.grabbed, FLAG_GRABBED, false);
  }

  if (down.mode === 'grab' && down.grabbed != null) {
    ph.emitDragState('free', down.grabbed, down.dragSet, pos);
    ph.emitDragState('freeon', down.grabbed, null, pos);
  }

  down.mode = 'pan';
  down.grabbed = null;
  down.dragSet = null;
}

/**
 * The press left the tap threshold in 'pan' mode: v3 unactivates a
 * *pannable* pressed element the moment the pan begins (`down.pannable()
 * && down.active()` in its mousemove) and shows the circle at the press
 * point instead — the press means viewport drag now, not a click in
 * progress.  A non-pannable element keeps the flag, as in v3.
 */
export function panStarted(ph: PointerHandler, down: DownState): void {
  const p = ph.pressed;

  if (p == null) {
    return;
  }

  const ref = p._eventRef();

  if (
    ref == null ||
    !ph.cy._store.hasFlag(ref.group, ref.slot, FLAG_PANNABLE)
  ) {
    return;
  }

  setPressed(ph, null);
  showActiveBg(ph, down.startX, down.startY);
}

/** The tap: select/unselect per the selection type and the modifier keys, then emit `tap` on the target and the core. */
export function tap(
  ph: PointerHandler,
  target: Collection | null,
  e: PointerEvent,
): void {
  const cy = ph.cy;
  const position = cy._viewport.renderedToModel(ph.eventPos(e));

  const selectionEnabled = cy.autounselectify() !== true;
  const additive = isMultSelKeyDown(e) || cy.selectionType() === 'additive';

  if (target == null) {
    // background tap
    cy.emit({
      type: 'tap',
      position,
      originalEvent: ph.domEvent ?? undefined,
    });
  } else {
    cy._emitOnEle('tap', target, undefined, {
      position,
      originalEvent: ph.domEvent ?? undefined,
    });
  }

  multiClick(ph, target, position);

  if (target == null) {
    if (selectionEnabled && !additive) {
      cy.elements({ selected: true }).unselect();
    }

    return;
  }

  if (!selectionEnabled || !target.selectable()) {
    return;
  }

  if (target.selected()) {
    target.unselect(); // toggle off
    cy._emitOnEle('tapunselect', target, undefined, {
      position,
      originalEvent: ph.domEvent ?? undefined,
    }); // 17.3
  } else {
    if (!additive) {
      cy.elements({ selected: true }).difference(target).unselect();
    }

    target.select();
    cy._emitOnEle('tapselect', target, undefined, {
      position,
      originalEvent: ph.domEvent ?? undefined,
    }); // 17.3
  }
}

/**
 * v3's multi-click flow: a second tap on the same target within
 * `cy.multiClickDebounceTime()` fires 'dbltap'; a tap with no follow-up
 * inside the window fires the debounced 'onetap'.  ('tap' itself always
 * fires immediately.)
 */
export function multiClick(
  ph: PointerHandler,
  target: Collection | null,
  position: Position,
): void {
  const now = performance.now();
  const debounce = ph.cy.multiClickDebounceTime() as number;
  const prev = ph.lastTap;

  if (prev != null && now - prev.at <= debounce && prev.target === target) {
    ph.lastTap = null;
    ph.clearOnetap();
    ph.emitModelGesture('dbltap', target, position);

    return;
  }

  ph.lastTap = { target, at: now };
  ph.clearOnetap();
  ph.onetapTimer = setTimeout(() => {
    ph.onetapTimer = null;
    ph.lastTap = null;
    ph.emitModelGesture('onetap', target, position);
  }, debounce);
}
