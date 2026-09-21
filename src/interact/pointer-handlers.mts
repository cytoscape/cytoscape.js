// The pointer handler's DOM entry points (round 130 split): wheel, down,
// move, up and cancel, as functions over the handler.  See
// `PointerHandler` in ./pointer.mts for the fields and the listener
// wiring.

import { FLAG_GRABBED } from '../contract.mjs';
import type { Collection } from '../collection.mjs';
import type { Position } from '../public-types.mjs';
import {
  WHEEL_RATE,
  TOUCH_CXT_MAX_DIST,
  WHEEL_SETTLE_MS,
  padsOf,
  isMultSelKeyDown,
} from './pointer.mjs';
import type { PointerHandler } from './pointer.mjs';
import {
  canDragImpl,
  repositionActiveBg,
  hideActiveBg,
  resolvePressTarget,
  panStarted,
  tap,
} from './pointer-press.mjs';
import {
  beginTouchCxt,
  touchCxtMove,
  beginPinch,
  pinchMove,
  endTouch,
  touchBoxMove,
} from './pointer-touch.mjs';
import { boxUpdate, boxEnd } from './pointer-box.mjs';
import { dragHoverPick, hoverPick, setPressed } from './pointer-hover.mjs';

/** The wheel handler: zoom about the cursor (or pan on a trackpad), throttled by the wheel rate, with hover suppressed until the wheel settles. */
export function onWheel(ph: PointerHandler, e: WheelEvent): void {
  e.preventDefault();

  if (ph.cy.userZoomingEnabled() !== true) {
    return;
  }

  const pos = ph.eventPos(e);

  // a wheel zoom is a viewport-only gesture: no mouseover/tap semantics
  // apply mid-gesture, so hover picking pauses (no pick passes at all)
  // until the wheel settles, then re-picks under the cursor once
  ph.wheelingUntil = performance.now() + WHEEL_SETTLE_MS;

  if (ph.wheelSettleTimer != null) {
    clearTimeout(ph.wheelSettleTimer);
  }

  ph.wheelSettleTimer = setTimeout(() => {
    ph.wheelSettleTimer = null;
    ph.wheelingUntil = 0; // reopen hover before the settle re-pick
    hoverPick(ph, pos);
  }, WHEEL_SETTLE_MS);

  const zoom = ph.cy.zoom() as number;
  const dy = e.deltaY * (e.deltaMode === 1 ? 33 : 1); // lines -> px-ish

  // v3's wheelSensitivity is a multiplier on the zoom-per-tick exponent
  // (round 20.1); v4's base rate is the same as before
  const sensitivity = ph.cy.wheelSensitivity() as number;

  ph.cy.zoom({
    level: zoom * Math.pow(10, (-dy / WHEEL_RATE) * sensitivity),
    renderedPosition: pos,
  });

  // the viewport-gesture vocabulary (17.4)
  ph.cy.emit({
    type: 'scrollzoom',
    position: ph.cy._viewport.renderedToModel(pos),
    originalEvent: ph.domEvent ?? undefined,
  });
}

/** The pointer-down handler: resolve the press target through the sync pick, open the down state as a pan, grab or box, arm taphold, and start the touch gestures. */
export function onPointerDown(ph: PointerHandler, e: PointerEvent): void {
  if (e.pointerType === 'touch') {
    ph.touches.set(e.pointerId, ph.eventPos(e));

    if (ph.touches.size === 2 && ph.pinch == null && ph.touchCxt == null) {
      ph.capture(e.pointerId);

      // v3's two-finger split (20.4): close pairs start the cxt
      // gesture, far pairs pinch immediately
      const [a, b] = [...ph.touches.values()];

      if (Math.hypot(b.x - a.x, b.y - a.y) < TOUCH_CXT_MAX_DIST) {
        beginTouchCxt(ph);
      } else {
        beginPinch(ph);
      }

      return;
    }

    // a third finger during an *undragged* cxt gesture converts it to
    // the box gesture (20.5): pointer events land fingers sequentially,
    // so ph is the v4 form of v3's simultaneous three-finger landing
    if (
      ph.touchCxt != null &&
      !ph.touchCxt.dragged &&
      ph.touches.size === 3 &&
      ph.cy.boxSelectionEnabled() === true
    ) {
      const cxt = ph.touchCxt;

      ph.touchCxt = null;
      ph.dragHover = null;
      ph.emitGesture('cxttapend', cxt.target, ph.eventPos(e));

      return;
    }

    // extra fingers mid-gesture just get tracked
    if (
      ph.pinch != null ||
      ph.touchCxt != null ||
      ph.deadTouch != null ||
      ph.touchDidSelect ||
      ph.touches.size >= 3
    ) {
      return;
    }
  }

  // right button: the cxttap family (cxttapstart / cxtdrag / cxttapend / cxttap)
  if (e.button === 2) {
    if (ph.down != null || ph.cxtDown != null) {
      return;
    }

    ph.capture(e.pointerId);

    const pos = ph.eventPos(e);
    const target = ph.nodeAt(pos.x, pos.y, padsOf(e).nodePadPx);

    ph.cxtDown = {
      pointerId: e.pointerId,
      target,
      startX: pos.x,
      startY: pos.y,
      moved: false,
    };
    ph.emitGesture('pointerdown', target, pos); // the official vocabulary (17.1)
    ph.emitGesture('cxttapstart', target, pos);

    return;
  }

  if (e.button !== 0 || ph.down != null) {
    return;
  }

  ph.capture(e.pointerId);

  const pos = ph.eventPos(e);

  // pan-vs-grab from a synchronous CPU node pick — current, with v3's
  // hit halo for ph pointer type (57.9)
  const picked = ph.nodeAt(pos.x, pos.y, padsOf(e).nodePadPx);
  // box selection overrides grabbing (as in v3): a multiple-select-key
  // press boxes even over a node, as does any press when panning is
  // disabled; mouse/pen only for now (v4 has no touch box gesture)
  const boxing =
    e.pointerType !== 'touch' &&
    ph.cy.boxSelectionEnabled() === true &&
    (isMultSelKeyDown(e) ||
      ph.cy.panningEnabled() !== true ||
      ph.cy.userPanningEnabled() !== true);
  // a node under the cursor is only *dragged* when grabbable and unlocked
  // (and not globally auto-locked/ungrabified); otherwise the press pans,
  // but the node is still remembered as the tap target for selection
  const canDrag = !boxing && picked != null && canDragImpl(ph, picked);

  // dragging a selected node drags every draggable selected node (v3)
  let dragSet: Collection | null = null;

  if (canDrag && picked != null && picked.selected()) {
    const draggable = ph.cy
      .nodes({ selected: true })
      .filter((n: Collection) => n === picked || canDragImpl(ph, n));

    if (draggable.length > 1) {
      dragSet = draggable;
    }
  }

  ph.down = {
    pointerId: e.pointerId,
    mode: boxing ? 'box' : canDrag ? 'grab' : 'pan',
    grabbed: picked,
    provisional: picked != null && picked.isParent(),
    dragSet,
    startX: pos.x,
    startY: pos.y,
    lastX: pos.x,
    lastY: pos.y,
    moved: false,
    shift: e.shiftKey,
  };

  // v3's `:active` (round 57.1c): the pressed element carries the flag
  // whether or not the press turns into a drag — v3 calls
  // `near.activate()` on mousedown, before it decides anything else —
  // and the overlay pass draws v3's black-25%-over-10px wash from it.
  setPressed(ph, picked);

  if (canDrag && picked != null) {
    if (dragSet != null) {
      for (let i = 0; i < dragSet.length; i++) {
        ph.setFlagOn(dragSet[i], FLAG_GRABBED, true);
      }
    } else {
      ph.setFlagOn(picked, FLAG_GRABBED, true);
    }

    // the drag-state family (17.2): 'grabon' only on the directly
    // grabbed element; 'grab' on it and every selected companion (v3)
    ph.emitDragState('grabon', picked, null, pos);
    ph.emitDragState('grab', picked, dragSet, pos);
  }

  // the pointer re-emits + the normalized press (round 17.1): the
  // official DOM vocabulary the layer itself consumes, plus v3's
  // device-normalized tapstart — both on the pressed element or core
  ph.emitGesture('pointerdown', picked, pos);
  ph.emitGesture('tapstart', picked, pos);

  // a press the node pick missed may still be on an *edge* — the CPU
  // pick knows nodes only; edges answer through the async GPU pick —
  // so the press affordance (v3's `:active` on the edge, or the
  // active-bg circle on true background) waits for that answer.
  // A press that landed on a compound *parent* waits too (97.1): a
  // parent body draws under the edges crossing it, so the sync scan's
  // answer is provisional until the edge tier has spoken.
  if (
    (ph.down.mode === 'pan' && ph.down.grabbed == null) ||
    ph.down.provisional === true
  ) {
    ph.down.pending = resolvePressTarget(ph, ph.down, pos, padsOf(e));
  }

  // press-and-hold: 'taphold' unless the press moves or ends first
  ph.clearTaphold();
  ph.tapholdTimer = setTimeout(() => {
    ph.tapholdTimer = null;

    const d = ph.down;

    if (d == null || d.pointerId !== e.pointerId || d.moved) {
      return;
    }

    ph.emitGesture(
      'taphold',
      d.grabbed ?? (ph.lastPick?.inside() ? ph.lastPick : null),
      { x: d.startX, y: d.startY },
    );
  }, ph.cy.tapholdDuration() as number);
}

/** The pointer-move handler: hover, drag (grab or pan) past the tap threshold, box update, and the touch gesture moves. */
export function onPointerMove(ph: PointerHandler, e: PointerEvent): void {
  const pos = ph.eventPos(e);

  // pointermove re-emits on every move (17.1); tapdrag — the
  // normalized drag — only while a press is active
  const pressTarget =
    ph.down?.grabbed ??
    ph.cxtDown?.target ??
    (ph.hovered?.inside() ? ph.hovered : null);
  const pressed =
    (ph.down != null && ph.down.pointerId === e.pointerId) ||
    (ph.cxtDown != null && ph.cxtDown.pointerId === e.pointerId);

  ph.emitGesture('pointermove', pressTarget, pos);

  if (pressed) {
    ph.emitGesture('tapdrag', pressTarget, pos);

    // hover-during-drag (17.3): a throttled sync node pick drives
    // tapdragover/tapdragout while the press is active (nodes only —
    // the CPU pick; recorded)
    if (ph.down != null && ph.down.pointerId === e.pointerId) {
      dragHoverPick(ph, pos, 'tapdrag', padsOf(e).nodePadPx);
    }
  }

  if (e.pointerType === 'touch' && ph.touches.has(e.pointerId)) {
    ph.touches.set(e.pointerId, pos);

    if (ph.touchCxt != null) {
      touchCxtMove(ph);

      return;
    }

    // three fingers box-select (20.5, before pinch — v3's branch order)
    if (ph.touches.size >= 3 && ph.cy.boxSelectionEnabled() === true) {
      touchBoxMove(ph);

      return;
    }

    if (ph.touchDidSelect) {
      return;
    } // boxed: leftover fingers stay inert

    if (ph.pinch != null) {
      pinchMove(ph);

      return;
    }

    if (ph.deadTouch === e.pointerId) {
      return;
    }
  }

  const cxt = ph.cxtDown;

  if (cxt != null && cxt.pointerId === e.pointerId) {
    if (
      !cxt.moved &&
      Math.hypot(pos.x - cxt.startX, pos.y - cxt.startY) >= ph.tapThreshold(e)
    ) {
      cxt.moved = true;
    }

    if (cxt.moved) {
      ph.emitGesture('cxtdrag', cxt.target, pos);
      dragHoverPick(ph, pos, 'cxtdrag', padsOf(e).nodePadPx); // 17.3
    }

    return;
  }

  const down = ph.down;

  if (down == null || down.pointerId !== e.pointerId) {
    hoverPick(ph, pos, padsOf(e));

    return;
  }

  if (!down.moved) {
    const dist = Math.hypot(pos.x - down.startX, pos.y - down.startY);

    if (dist < ph.tapThreshold(e)) {
      return;
    }

    down.moved = true;
    ph.clearTaphold();

    if (down.mode === 'pan') {
      panStarted(ph, down);
    }
  }

  const dx = pos.x - down.lastX;
  const dy = pos.y - down.lastY;

  down.lastX = pos.x;
  down.lastY = pos.y;

  if (down.mode === 'pan') {
    if (ph.cy.userPanningEnabled() === true) {
      ph.cy.panBy({ x: dx, y: dy });
      ph.cy.emit({
        type: 'dragpan',
        position: ph.cy._viewport.renderedToModel(pos),
        originalEvent: ph.domEvent ?? undefined,
      }); // 17.4
    }

    // round 43: the pan just moved the graph under the anchor, so the
    // indicator has to be re-projected or it is left behind at the press
    // point.  With panning disabled nothing moved and ph is a no-op,
    // which is v3's behaviour too.
    repositionActiveBg(ph);
  } else if (down.mode === 'box') {
    boxUpdate(ph, down, pos);
  } else if (down.grabbed != null && down.grabbed.inside()) {
    const zoom = ph.cy.zoom() as number;

    if (down.dragSet != null) {
      down.dragSet.shift({ x: dx / zoom, y: dy / zoom });
    } else {
      const p = down.grabbed.position() as Position;

      down.grabbed.position({ x: p.x + dx / zoom, y: p.y + dy / zoom });
    }

    // 'drag' fires per movement on every node the gesture moves (17.2)
    ph.emitDragState('drag', down.grabbed, down.dragSet, pos);
  }
}

/** The pointer-up handler: end the drag, box or touch gesture, then tap and multi-click. */
export function onPointerUp(ph: PointerHandler, e: PointerEvent): void {
  hideActiveBg(ph);
  if (endTouch(ph, e)) {
    return;
  }

  // the official re-emit + the normalized release (17.1), ahead of
  // the tap/selection flow (v3's ordering: up -> tapend -> tap)
  {
    const pos = ph.eventPos(e);
    const hadPress =
      (ph.down != null && ph.down.pointerId === e.pointerId) ||
      (ph.cxtDown != null && ph.cxtDown.pointerId === e.pointerId);
    const target =
      ph.down?.grabbed ??
      ph.cxtDown?.target ??
      (ph.lastPick?.inside() ? ph.lastPick : null);

    ph.emitGesture('pointerup', target, pos);

    if (hadPress) {
      ph.emitGesture('tapend', target, pos);
    }
  }

  const cxt = ph.cxtDown;

  if (cxt != null && cxt.pointerId === e.pointerId) {
    ph.cxtDown = null;
    ph.dragHover = null; // 17.3

    const pos = ph.eventPos(e);

    ph.emitGesture('cxttapend', cxt.target, pos);

    if (!cxt.moved) {
      ph.emitGesture('cxttap', cxt.target, pos);
    }

    return;
  }

  const down = ph.down;

  if (down == null || down.pointerId !== e.pointerId) {
    return;
  }

  ph.down = null;
  ph.clearTaphold();
  ph.dragHover = null; // 17.3: the gesture ended

  if (down.dragSet != null) {
    for (let i = 0; i < down.dragSet.length; i++) {
      ph.setFlagOn(down.dragSet[i], FLAG_GRABBED, false);
    }
  } else if (down.grabbed != null) {
    ph.setFlagOn(down.grabbed, FLAG_GRABBED, false);
  }

  // release side of the drag-state family (17.2): 'free' on every
  // grabbed node, 'freeon' on the direct one; the dragfree pair only
  // when the gesture actually moved them
  if (down.mode === 'grab' && down.grabbed != null) {
    const pos = ph.eventPos(e);

    ph.emitDragState('free', down.grabbed, down.dragSet, pos);
    ph.emitDragState('freeon', down.grabbed, null, pos);

    if (down.moved) {
      ph.emitDragState('dragfree', down.grabbed, down.dragSet, pos);
      ph.emitDragState('dragfreeon', down.grabbed, null, pos);
    }
  }

  if (!down.moved) {
    const fallback = (): Collection | null =>
      down.grabbed ?? (ph.lastPick?.inside() ? ph.lastPick : null);

    if (down.provisional === true && down.pending != null) {
      // 97.1: the parent under the press only holds the tap while no
      // edge is above it, and that answer is a GPU roundtrip away.  A
      // click faster than the tile would otherwise select the parent
      // the renderer drew *underneath* the edge the user aimed at, so
      // ph one case waits.  The DOM event is restored around the
      // deferred call, since `tap` reads it for `originalEvent` and
      // the listener wrapper has long since cleared it (41.4).
      const dom = ph.domEvent;

      void down.pending.then((resolved) => {
        const prev = ph.domEvent;

        ph.domEvent = dom;

        try {
          tap(ph, resolved ?? fallback(), e);
        } finally {
          ph.domEvent = prev;
        }
      });
    } else {
      tap(ph, fallback(), e);
    }
  } else if (down.mode === 'box') {
    boxEnd(ph, down, e);
  }
}

/** The pointer-cancel handler: drop the press and every gesture without a tap. */
export function onPointerCancel(ph: PointerHandler, e: PointerEvent): void {
  hideActiveBg(ph);
  if (endTouch(ph, e, true)) {
    return;
  }

  ph.emitGesture('pointercancel', null, ph.eventPos(e)); // 17.1

  if (ph.cxtDown != null && ph.cxtDown.pointerId === e.pointerId) {
    ph.cxtDown = null;

    return;
  }

  const down = ph.down;

  if (down == null || down.pointerId !== e.pointerId) {
    return;
  }

  ph.down = null;
  ph.clearTaphold();

  if (down.dragSet != null) {
    for (let i = 0; i < down.dragSet.length; i++) {
      ph.setFlagOn(down.dragSet[i], FLAG_GRABBED, false);
    }
  } else if (down.grabbed != null) {
    ph.setFlagOn(down.grabbed, FLAG_GRABBED, false);
  }

  // a cancelled gesture still frees (17.2); no dragfree — it aborted
  if (down.mode === 'grab' && down.grabbed != null) {
    const pos = ph.eventPos(e);

    ph.emitDragState('free', down.grabbed, down.dragSet, pos);
    ph.emitDragState('freeon', down.grabbed, null, pos);
  }

  if (ph.boxEl != null) {
    ph.boxEl.style.display = 'none';
  }
}
