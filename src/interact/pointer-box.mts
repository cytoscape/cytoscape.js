// Box selection (round 130 split): the box element, its updates and the
// selection it applies on end.

import type { Collection } from '../collection.mjs';
import type { Position } from '../public-types.mjs';
import { isMultSelKeyDown } from './pointer.mjs';
import type { DownState, PointerHandler } from './pointer.mjs';

/** The box-selection overlay element, created on first use inside the container. */
export function boxElement(ph: PointerHandler): HTMLDivElement {
  if (ph.boxEl == null) {
    const el = ph.canvas.ownerDocument.createElement('div');
    const s = el.style;

    s.position = 'absolute';
    s.display = 'none';
    s.pointerEvents = 'none';
    s.zIndex = '1'; // above the (unpositioned) canvas
    s.boxSizing = 'border-box';

    // the canvas fills the container from (0, 0), so container-absolute
    // coordinates are the same rendered coordinates events use
    (ph.canvas.parentElement ?? ph.canvas).appendChild(el);
    ph.boxEl = el;
  }

  return ph.boxEl;
}

/** Move the box overlay to the rectangle from the press point to the current pointer. */
export function boxUpdate(
  ph: PointerHandler,
  down: DownState,
  pos: Position,
): void {
  const cy = ph.cy;

  if (down.boxStarted !== true) {
    down.boxStarted = true;
    cy.emit({
      type: 'boxstart',
      position: cy._viewport.renderedToModel({
        x: down.startX,
        y: down.startY,
      }),
      originalEvent: ph.domEvent ?? undefined,
    });
  }

  showBoxRect(ph, down.startX, down.startY, pos.x, pos.y);
}

/** Show the DOM selection box over a rendered rect (themed from the
 * core sheet — round 13 A2's selection-box-* props). */
export function showBoxRect(
  ph: PointerHandler,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  const el = boxElement(ph);
  const core = ph.cy._styleEngine.core();
  const [br, bg, bb] = core.selectionBoxColor;
  const [rr, rg, rb] = core.selectionBoxBorderColor;

  el.style.background = `rgba(${br}, ${bg}, ${bb}, ${core.selectionBoxOpacity})`;
  el.style.border = `${core.selectionBoxBorderWidth}px solid rgba(${rr}, ${rg}, ${rb}, 1)`;

  el.style.display = 'block';
  el.style.left = Math.min(x1, x2) + 'px';
  el.style.top = Math.min(y1, y2) + 'px';
  el.style.width = Math.abs(x2 - x1) + 'px';
  el.style.height = Math.abs(y2 - y1) + 'px';
}

/** Apply the released box with v3 semantics (boxend, box, boxselect). */
export function boxEnd(
  ph: PointerHandler,
  down: DownState,
  e: PointerEvent,
): void {
  const cy = ph.cy;

  if (ph.boxEl != null) {
    ph.boxEl.style.display = 'none';
  }

  const p1 = cy._viewport.renderedToModel({ x: down.startX, y: down.startY });
  const p2 = cy._viewport.renderedToModel({ x: down.lastX, y: down.lastY });
  const position = p2;
  // 20.2: events:'no' elements are not box-selectable and get no box
  // events (v3 boxes over its interactive set); the geometric query
  // itself stays unfiltered
  const box = cy
    ._elementsInGestureBox(p1.x, p1.y, p2.x, p2.y)
    .filter((ele: Collection) => ele.interactive());

  cy.emit({
    type: 'boxend',
    position,
    originalEvent: ph.domEvent ?? undefined,
  });

  for (let i = 0; i < box.length; i++) {
    cy._emitOnEle('box', box[i], undefined, {
      position,
      originalEvent: ph.domEvent ?? undefined,
    });
  }

  if (cy.autounselectify() === true) {
    return;
  }

  const additive = isMultSelKeyDown(e) || cy.selectionType() === 'additive';

  if (!additive) {
    cy.elements({ selected: true }).difference(box).unselect();
  }

  const toSelect = box.filter((ele) => ele.selectable() && !ele.selected());

  toSelect.select();

  for (let i = 0; i < toSelect.length; i++) {
    cy._emitOnEle('boxselect', toSelect[i], undefined, {
      position,
      originalEvent: ph.domEvent ?? undefined,
    });
  }
}
