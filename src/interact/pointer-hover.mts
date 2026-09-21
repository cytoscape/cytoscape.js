// Hover, press state and the cursor (round 130 split).

import { FLAG_ACTIVE, FLAG_HOVERED } from '../contract.mjs';
import type { Collection } from '../collection.mjs';
import type { CursorMap, CursorState, Position } from '../public-types.mjs';
import { cursorFor } from './cursor.mjs';
import { HOVER_THROTTLE_MS, MOUSE_PADS } from './pointer.mjs';
import type { PointerHandler } from './pointer.mjs';
import { canDragImpl } from './pointer-press.mjs';

/**
 * Hover-during-drag (17.3): while a press is active, a throttled
 * synchronous node pick drives `<prefix>over` / `<prefix>out` as the
 * cursor enters and leaves nodes.  Nodes only — the exact CPU pick;
 * edges would need the async GPU tile (recorded).
 */
export function dragHoverPick(
  ph: PointerHandler,
  pos: Position,
  prefix: 'tapdrag' | 'cxtdrag',
  nodePadPx: number,
): void {
  const now = performance.now();

  if (now - ph.lastDragHoverAt < HOVER_THROTTLE_MS) {
    return;
  }

  ph.lastDragHoverAt = now;

  const ele = ph.nodeAt(pos.x, pos.y, nodePadPx);
  const prev = ph.dragHover;

  if (prev === ele) {
    return;
  }

  const position = ph.cy._viewport.renderedToModel(pos);

  if (prev != null && prev.inside()) {
    ph.cy._emitOnEle(prefix + 'out', prev, undefined, {
      position,
      originalEvent: ph.domEvent ?? undefined,
    });
  }

  ph.dragHover = ele;

  if (ele != null && ele.inside()) {
    ph.cy._emitOnEle(prefix + 'over', ele, undefined, {
      position,
      originalEvent: ph.domEvent ?? undefined,
    });
  }
}

/** Pick under the pointer (throttled, skipped while wheeling) and update the hovered element. */
export function hoverPick(
  ph: PointerHandler,
  pos: Position,
  pads: typeof MOUSE_PADS = MOUSE_PADS,
): void {
  const now = performance.now();

  // no hover during viewport gestures (pan drags never reach here; wheel
  // zooms are suppressed via the settle window)
  if (now < ph.wheelingUntil) {
    return;
  }

  if (ph.pickInFlight || now - ph.lastHoverAt < HOVER_THROTTLE_MS) {
    return;
  }

  ph.lastHoverAt = now;
  ph.pickInFlight = true;

  ph.renderer.pick(pos.x, pos.y, pads).then((id) => {
    const ele = ph.cy._decodePick(id);

    ph.pickInFlight = false;
    ph.lastPick = ele;
    ph.updateHover(ele, pos);
  });
}

/** Set the hovered element: clear the old flag, set the new one, emit `mouseover`/`mouseout` (and the model events) and refresh the cursor. */
export function updateHover(
  ph: PointerHandler,
  ele: Collection | null,
  pos?: Position,
): void {
  const prev = ph.hovered;

  if (prev === ele) {
    return;
  } // interned handles ⇒ identity comparison works

  const position =
    pos != null ? ph.cy._viewport.renderedToModel(pos) : undefined;

  if (prev != null && prev.inside()) {
    ph.setFlagOn(prev, FLAG_HOVERED, false);
    ph.cy._emitOnEle('mouseout', prev, undefined, {
      position,
      originalEvent: ph.domEvent ?? undefined,
    });
    ph.cy._emitOnEle('pointerout', prev, undefined, {
      position,
      originalEvent: ph.domEvent ?? undefined,
    }); // 17.1
  }

  ph.hovered = ele;

  if (ele != null && ele.inside()) {
    ph.setFlagOn(ele, FLAG_HOVERED, true);
    ph.cy._emitOnEle('mouseover', ele, undefined, {
      position,
      originalEvent: ph.domEvent ?? undefined,
    });
    ph.cy._emitOnEle('pointerover', ele, undefined, {
      position,
      originalEvent: ph.domEvent ?? undefined,
    }); // 17.1
  }

  // the hover pick resolves a frame after the move that asked for it,
  // outside the listener wrapper — so ph transition writes its own
  ph.applyCursor();
}

/** Set or clear the active (pressed) element and its flag, emitting the model events. */
export function setPressed(ph: PointerHandler, ele: Collection | null): void {
  if (ph.pressed === ele) {
    return;
  }

  if (ph.pressed != null) {
    ph.setFlagOn(ph.pressed, FLAG_ACTIVE, false);
  }

  ph.pressed = ele;

  if (ele != null) {
    ph.setFlagOn(ele, FLAG_ACTIVE, true);
  }
}

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
export function applyCursor(ph: PointerHandler): void {
  const next = cursorFor(
    cursorState(ph),
    ph.cy.pointerCursors() as boolean | Partial<CursorMap>,
  );

  if (next !== ph.cursor) {
    ph.canvas.style.cursor = next;
    ph.cursor = next;
  }

  const root = ph.canvas.ownerDocument?.documentElement;

  if (root == null) {
    return;
  }

  if (ph.down != null && next !== '') {
    if (ph.docCursor == null) {
      ph.docCursor = root.style.cursor;
    }

    root.style.cursor = next;
  } else if (ph.docCursor != null) {
    root.style.cursor = ph.docCursor;
    ph.docCursor = null;
  }
}

/** What the cursor map is asked about: the press mode (which outranks
 * hover — a drag across another node keeps saying `grabbing`), what
 * the hover pick found, and the device. */
export function cursorState(ph: PointerHandler): CursorState {
  const hovered = ph.hovered;
  let hover: CursorState['hover'] = 'none';

  if (hovered != null && hovered.inside()) {
    hover =
      hovered.isNode() && canDragImpl(ph, hovered)
        ? 'draggable-node'
        : 'element';
  }

  return {
    gesture: ph.down?.mode ?? 'idle',
    hover,
    pointerType: ph.pointerType,
  };
}

/** Hand the canvas and the page their cursors back (destroy). */
export function releaseCursor(ph: PointerHandler): void {
  if (ph.cursor !== '') {
    ph.canvas.style.cursor = '';
    ph.cursor = '';
  }

  const root = ph.canvas.ownerDocument?.documentElement;

  if (root != null && ph.docCursor != null) {
    root.style.cursor = ph.docCursor;
  }

  ph.docCursor = null;
}
