// The touch gestures (round 130 split): the two-finger cxt, pinch, the
// shared touch end and the three-finger box.

import { FLAG_GRABBED } from '../contract.mjs';
import type { Collection } from '../collection.mjs';
import type { Position } from '../public-types.mjs';
import {
  TOUCH_CXT_CANCEL_DIST,
  TOUCH_CXT_CANCEL_FACTOR,
  TOUCH_PADS,
} from './pointer.mjs';
import type { PointerHandler } from './pointer.mjs';
import { hideActiveBg } from './pointer-press.mjs';
import { showBoxRect } from './pointer-box.mjs';
import { dragHoverPick } from './pointer-hover.mjs';

/**
 * A close second finger starts v3's touch cxt gesture: 'cxttapstart'
 * on the node under finger 1 (else finger 2, else the core), any
 * pan/grab in progress cancelled like a pinch's.
 */
export function beginTouchCxt(ph: PointerHandler): void {
  const down = ph.down;

  if (down != null) {
    if (down.grabbed != null) {
      ph.setFlagOn(down.grabbed, FLAG_GRABBED, false);
    }

    ph.down = null;
  }

  ph.clearTaphold();
  hideActiveBg(ph);
  ph.updateHover(null);

  const [a, b] = [...ph.touches.values()];
  const target =
    ph.nodeAt(a.x, a.y, TOUCH_PADS.nodePadPx) ??
    ph.nodeAt(b.x, b.y, TOUCH_PADS.nodePadPx); // v3: nodes only, finger 1 first

  ph.touchCxt = {
    target,
    dragged: false,
    baseDist: Math.hypot(b.x - a.x, b.y - a.y),
    startX: a.x,
    startY: a.y,
  };

  ph.emitGesture('cxttapstart', target, a);
}

/** Track the two-finger cxt gesture: cancel it into a pinch when the fingers spread or move too far. */
export function touchCxtMove(ph: PointerHandler): void {
  const cxt = ph.touchCxt as NonNullable<typeof ph.touchCxt>;
  const [a, b] = [...ph.touches.values()];

  if (b != null) {
    const dist = Math.hypot(b.x - a.x, b.y - a.y);

    // v3's swipe-out rule: the pair spreading past 1.5x (or 150 px)
    // cancels the cxt gesture into a pinch (cxttapend, then the pinch
    // machinery takes over from the current spread — no zoom jump)
    if (
      dist >= TOUCH_CXT_CANCEL_DIST ||
      (cxt.baseDist > 0 && dist >= cxt.baseDist * TOUCH_CXT_CANCEL_FACTOR)
    ) {
      ph.touchCxt = null;
      ph.dragHover = null;
      ph.emitGesture('cxttapend', cxt.target, a);
      ph.pinch = pinchBase(ph);

      return;
    }
  }

  // finger-1 movement past the touch tap threshold drags (v4 rule:
  // the mouse cxt path thresholds too — v3's touch cxt emits cxtdrag
  // on any move event, a recorded deviation)
  if (
    !cxt.dragged &&
    Math.hypot(a.x - cxt.startX, a.y - cxt.startY) <
      (ph.cy.touchTapThreshold() as number)
  ) {
    return;
  }

  cxt.dragged = true;
  ph.emitGesture('cxtdrag', cxt.target, a);
  dragHoverPick(ph, a, 'cxtdrag', TOUCH_PADS.nodePadPx); // cxtdragover/out, as v3
}

/** A second finger turns any pan/grab into a pinch. */
export function beginPinch(ph: PointerHandler): void {
  const down = ph.down;

  if (down != null) {
    if (down.grabbed != null) {
      ph.setFlagOn(down.grabbed, FLAG_GRABBED, false);
    }

    ph.down = null;
  }

  ph.updateHover(null); // a pinch is a viewport-only gesture
  ph.pinch = pinchBase(ph);
}

/** The distance and midpoint of the two current touches — the pinch baseline. */
export function pinchBase(ph: PointerHandler): { dist: number; mid: Position } {
  const [a, b] = [...ph.touches.values()];

  return {
    dist: Math.hypot(b.x - a.x, b.y - a.y),
    mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
  };
}

/** Zoom about the pinch midpoint by the ratio of the current distance to the baseline. */
export function pinchMove(ph: PointerHandler): void {
  const pinch = ph.pinch!;
  const { dist, mid } = pinchBase(ph);

  if (pinch.dist > 0 && dist > 0 && ph.cy.userZoomingEnabled() === true) {
    ph.cy.zoom({
      level: ((ph.cy.zoom() as number) * dist) / pinch.dist,
      renderedPosition: mid,
    });
    ph.cy.emit({
      type: 'pinchzoom',
      position: ph.cy._viewport.renderedToModel(mid),
      originalEvent: ph.domEvent ?? undefined,
    }); // 17.4
  }

  if (ph.cy.userPanningEnabled() === true) {
    ph.cy.panBy({ x: mid.x - pinch.mid.x, y: mid.y - pinch.mid.y });
  }

  ph.pinch = { dist, mid };
}

/** Touch bookkeeping on up/cancel; true when the event is consumed by pinch/cxt state. */
export function endTouch(
  ph: PointerHandler,
  e: PointerEvent,
  cancelled: boolean = false,
): boolean {
  if (e.pointerType !== 'touch') {
    return false;
  }

  const wasPinching = ph.pinch != null && ph.touches.has(e.pointerId);
  const wasCxt = ph.touchCxt != null && ph.touches.has(e.pointerId);
  const wasBoxing = ph.touchBox != null && ph.touches.has(e.pointerId);

  ph.touches.delete(e.pointerId);

  if (ph.deadTouch === e.pointerId) {
    ph.deadTouch = null;

    if (ph.touches.size === 0) {
      ph.touchDidSelect = false;
    }

    return true;
  }

  // a box finger lifting applies the swept box (20.5); the didSelect
  // latch keeps the leftover fingers inert until every one lifts
  if (wasBoxing) {
    applyTouchBox(ph, e, cancelled);

    if (ph.touches.size === 0) {
      ph.touchDidSelect = false;
    }

    return true;
  }

  if (ph.touchDidSelect) {
    if (ph.touches.size === 0) {
      ph.touchDidSelect = false;
    }

    return true;
  }

  // either cxt finger lifting ends the gesture (20.4): cxttapend, and
  // cxttap when it never dragged (never on pointercancel); the
  // leftover finger stays inert until lifted, like a pinch's
  if (wasCxt) {
    const cxt = ph.touchCxt as NonNullable<typeof ph.touchCxt>;
    const pos = ph.eventPos(e);

    ph.touchCxt = null;
    ph.dragHover = null;
    ph.emitGesture('cxttapend', cxt.target, pos);

    if (!cxt.dragged && !cancelled) {
      ph.emitGesture('cxttap', cxt.target, pos);
    }

    ph.deadTouch = ph.touches.keys().next().value ?? null;

    return true;
  }

  if (!wasPinching) {
    return false;
  }

  if (ph.touches.size >= 2) {
    ph.pinch = pinchBase(ph); // rebase on the remaining pair, no jump
  } else {
    ph.pinch = null;
    // the leftover finger stays inert until lifted (no pan jump)
    ph.deadTouch = ph.touches.keys().next().value ?? null;
  }

  return true;
}

/**
 * Three fingers box-select (v3): the box spans the start centroid to
 * the moving centroid, applied when the third finger lifts.  Starting
 * one cancels any cxt/pinch/pan in progress, and the gesture never
 * degrades to a pinch afterwards (the didSelect latch).
 */
export function touchBoxMove(ph: PointerHandler): void {
  const [a, b, c] = [...ph.touches.values()];
  const cx = (a.x + b.x + c.x) / 3;
  const cyPx = (a.y + b.y + c.y) / 3;

  if (ph.touchBox == null) {
    const down = ph.down;

    if (down != null) {
      if (down.grabbed != null) {
        ph.setFlagOn(down.grabbed, FLAG_GRABBED, false);
      }

      ph.down = null;
    }

    ph.clearTaphold();
    hideActiveBg(ph);
    ph.updateHover(null);
    ph.pinch = null; // the box preempts a pinch in progress (v3's branch order)
    ph.touchDidSelect = true;
    ph.touchBox = { x1: cx, y1: cyPx, x2: cx + 1, y2: cyPx + 1 }; // v3's +1 seed
    ph.cy.emit({
      type: 'boxstart',
      position: ph.cy._viewport.renderedToModel({ x: cx, y: cyPx }),
      originalEvent: ph.domEvent ?? undefined,
    });
  } else {
    ph.touchBox.x2 = cx;
    ph.touchBox.y2 = cyPx;
  }

  showBoxRect(
    ph,
    ph.touchBox.x1,
    ph.touchBox.y1,
    ph.touchBox.x2,
    ph.touchBox.y2,
  );
}

/** Apply the swept box with v3's touch semantics: additive (no
 * clearing), interactive elements only, boxend/box/boxselect. */
export function applyTouchBox(
  ph: PointerHandler,
  e: PointerEvent,
  cancelled: boolean,
): void {
  const cy = ph.cy;
  const box = ph.touchBox as NonNullable<typeof ph.touchBox>;

  ph.touchBox = null;

  if (ph.boxEl != null) {
    ph.boxEl.style.display = 'none';
  }

  if (cancelled) {
    return;
  } // an aborted gesture selects nothing (no boxend)

  const p1 = cy._viewport.renderedToModel({ x: box.x1, y: box.y1 });
  const p2 = cy._viewport.renderedToModel({ x: box.x2, y: box.y2 });
  const position = p2;

  cy.emit({
    type: 'boxend',
    position,
    originalEvent: ph.domEvent ?? undefined,
  });

  const eles = cy
    ._elementsInGestureBox(p1.x, p1.y, p2.x, p2.y)
    .filter((ele: Collection) => ele.interactive()); // the 20.2 rule

  for (let i = 0; i < eles.length; i++) {
    cy._emitOnEle('box', eles[i], undefined, {
      position,
      originalEvent: ph.domEvent ?? undefined,
    });
  }

  if (cy.autounselectify() === true) {
    return;
  }

  const toSelect = eles.filter(
    (ele: Collection) => ele.selectable() && !ele.selected(),
  );

  toSelect.select();

  for (let i = 0; i < toSelect.length; i++) {
    cy._emitOnEle('boxselect', toSelect[i], undefined, {
      position,
      originalEvent: ph.domEvent ?? undefined,
    });
  }
}
