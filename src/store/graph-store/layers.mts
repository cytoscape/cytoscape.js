// GraphStore's overlay, underlay, casing, mid-arrow, border-geometry,
// gradient, colour and ghost writers (round 130 split).

import {
  COL,
  columnSpec,
  SHAPE_MASK,
  SHAPE_POLYGON_CUSTOM,
  SHAPE_SHIFT,
  BORDER_STYLE_SHIFT,
  OUTLINE_STYLE_SHIFT,
} from '../../contract.mjs';
import type { ColumnId } from '../../contract.mjs';
import type { GraphStore } from '../graph-store.mjs';
import { updateArrowBits } from './channels.mjs';

/**
 * Write a node's overlay or underlay record (the StyleEngine's write
 * path): [rgba (opacity folded), padding×256, shape, radius×256 |
 * 0xffffffff = auto].  Padding is geometry (it grows the bb scans),
 * so writes bump the geometry epoch.
 */
export function setNodeLayer(
  gs: GraphStore,
  id: typeof COL.NODE_OVERLAY | typeof COL.NODE_UNDERLAY,
  slot: number,
  rgba: number,
  padding: number,
  shape: number,
  radius: number,
): void {
  const arr = gs.nodes.column(id) as Uint32Array;
  const at = slot * 4;
  const pad = Math.max(0, Math.round(padding * 256));
  const rad = radius < 0 ? 0xffffffff : Math.max(0, Math.round(radius * 256));

  if (
    arr[at] === rgba &&
    arr[at + 1] === pad &&
    arr[at + 2] === shape &&
    arr[at + 3] === rad
  ) {
    return;
  }

  const wasOn = arr[at] >>> 24 !== 0;
  const isOn = rgba >>> 24 !== 0;

  if (wasOn !== isOn) {
    const d = isOn ? 1 : -1;

    if (id === COL.NODE_OVERLAY) {
      gs.overlays += d;
    } else {
      gs.underlays += d;
    }
  }

  arr[at] = rgba;
  arr[at + 1] = pad;
  arr[at + 2] = shape;
  arr[at + 3] = rad;
  gs.geoEpoch++;
  gs.dirty.mark(id, slot);
}

/**
 * Write an edge's overlay or underlay record (round 13 A2):
 * [rgba (opacity folded), strokeWidth×256] — the stroke width is the
 * edge width + 2 × padding, derived at style-write time.
 */
export function setEdgeLayer(
  gs: GraphStore,
  id:
    | typeof COL.EDGE_OVERLAY
    | typeof COL.EDGE_UNDERLAY
    | typeof COL.EDGE_CASING,
  slot: number,
  rgba: number,
  strokeWidth: number,
): void {
  const arr = gs.edges.column(id) as Uint32Array;
  const at = slot * 2;
  const sw = Math.max(0, Math.round(strokeWidth * 256));

  if (arr[at] === rgba && arr[at + 1] === sw) {
    return;
  }

  const wasOn = arr[at] >>> 24 !== 0;
  const isOn = rgba >>> 24 !== 0;

  if (wasOn !== isOn) {
    const d = isOn ? 1 : -1;

    if (id === COL.EDGE_OVERLAY) {
      gs.edgeOverlays += d;
    } else if (id === COL.EDGE_UNDERLAY) {
      gs.edgeUnderlays += d;
    } else {
      gs.casings += d;
    }
  }

  arr[at] = rgba;
  arr[at + 1] = sw;
  gs.dirty.mark(id, slot);
}

/** setColor wrapper for the mid-arrow columns that keeps the count. */
export function setMidArrow(
  gs: GraphStore,
  id: typeof COL.EDGE_MID_SOURCE_ARROW | typeof COL.EDGE_MID_TARGET_ARROW,
  slot: number,
  r: number,
  g: number,
  b: number,
  a: number,
  otherId: typeof COL.EDGE_MID_SOURCE_ARROW | typeof COL.EDGE_MID_TARGET_ARROW,
): void {
  const arr = gs.edges.column(id) as Uint8Array;
  const other = gs.edges.column(otherId) as Uint8Array;
  const wasOn = arr[slot * 4 + 3] > 0 || other[slot * 4 + 3] > 0;

  gs.setColor(id, slot, r, g, b, a);

  const isOn = a > 0 || other[slot * 4 + 3] > 0;

  if (wasOn !== isOn) {
    gs.midArrows += isOn ? 1 : -1;
  }
}

/**
 * Write a node's border/corner/outline record (rounds 13 B2/B5):
 * cornerRadius model px (-1 = auto), borderPosition id, the outline
 * rgba (opacity pre-folded), outline width/offset (model px,
 * u16 fixed-point), and — round 38 — the border/outline stroke-style
 * enums, packed into bits 8..11 of the position word (see the
 * contract's stroke style constants).  Corner radius and outline
 * extents are geometry (pick + bb read them), so writes bump the
 * geometry epoch.
 */
export function setBorderGeom(
  gs: GraphStore,
  slot: number,
  cornerRadius: number,
  borderPos: number,
  outlineRgba: number,
  outlineWidth: number,
  outlineOffset: number,
  shapeId: number = 0,
  polyRef: number = 0,
  borderStyle: number = 0,
  outlineStyle: number = 0,
): void {
  const arr = gs.nodes.column(COL.NODE_BORDER_GEOM) as Uint32Array;
  const at = slot * 4;
  // C3: custom polygons carry their point-record ref (from
  // setPolygonPoints) in the radius word — the corner radius is
  // meaningless for polygons
  const rad =
    shapeId === SHAPE_POLYGON_CUSTOM
      ? polyRef >>> 0
      : cornerRadius < 0
        ? 0xffffffff
        : Math.max(0, Math.round(cornerRadius * 256));

  if (shapeId > SHAPE_MASK) {
    throw new Error(
      `Node shape id ${shapeId} does not fit the ${SHAPE_MASK + 1}-shape field; ` +
        'widen SHAPE_SHIFT/SHAPE_MASK in contract.mts rather than truncating',
    );
  }

  // C2: the node FS reads the shape out of gs word (its shapes
  // binding went to the gradient column); 27.1 widened the field from
  // a nibble to a byte.  Round 38 packs the two stroke-style enums
  // into bits 8..11 (see the contract's stroke style constants).
  const posShape =
    (borderPos |
      (borderStyle << BORDER_STYLE_SHIFT) |
      (outlineStyle << OUTLINE_STYLE_SHIFT) |
      (shapeId << SHAPE_SHIFT)) >>>
    0;

  borderPos = posShape;
  const packedWO =
    (Math.min(0xffff, Math.max(0, Math.round(outlineOffset * 256))) << 16) |
    Math.min(0xffff, Math.max(0, Math.round(outlineWidth * 256)));

  if (outlineRgba >>> 24 !== 0) {
    const slack = outlineOffset / 2 + outlineWidth;

    if (slack > gs.outlineSlackMax) {
      gs.outlineSlackMax = slack;
    }
  }

  if (
    arr[at] === rad &&
    arr[at + 1] === borderPos &&
    arr[at + 2] === outlineRgba &&
    arr[at + 3] === packedWO
  ) {
    return;
  }

  arr[at] = rad;
  arr[at + 1] = borderPos;
  arr[at + 2] = outlineRgba;
  arr[at + 3] = packedWO;
  gs.geoEpoch++;
  gs.dirty.mark(COL.NODE_BORDER_GEOM, slot);
}

/**
 * Write a gradient record (round 13 C2): kind 0 clears; stops are
 * [rgba, pos-fraction] pairs, capped at 5 by the style layer.
 */
export function setGradient(
  gs: GraphStore,
  id: typeof COL.NODE_GRADIENT | typeof COL.EDGE_GRADIENT,
  slot: number,
  kind: number,
  dir: number,
  stops: { rgba: number; pos: number }[],
): void {
  const arr = gs.table(columnSpec(id).group).column(id) as Uint32Array;
  const at = slot * 8;
  const count = Math.min(stops.length, 5);
  const meta = kind === 0 ? 0 : (kind | (dir << 2) | (count << 5)) >>> 0;
  const words = [meta, 0, 0, 0, 0, 0, 0, 0];

  for (let i = 0; i < count; i++) {
    words[1 + i] = stops[i].rgba;
  }

  let pos03 = 0;

  for (let i = 0; i < Math.min(count, 4); i++) {
    pos03 |=
      Math.max(0, Math.min(255, Math.round(stops[i].pos * 255))) << (i * 8);
  }

  words[6] = pos03 >>> 0;
  words[7] =
    count > 4 ? Math.max(0, Math.min(255, Math.round(stops[4].pos * 255))) : 0;

  let changed = false;

  for (let i = 0; i < 8; i++) {
    if (arr[at + i] !== words[i]) {
      changed = true;
      break;
    }
  }

  if (!changed) {
    return;
  }

  const wasOn = arr[at] !== 0;
  const isOn = meta !== 0;

  if (wasOn !== isOn) {
    gs.gradients += isOn ? 1 : -1;
  }

  for (let i = 0; i < 8; i++) {
    arr[at + i] = words[i];
  }

  gs.dirty.mark(id, slot);
}

/** Four-component f32 write (dash patterns etc.). */
export function setVec4(
  gs: GraphStore,
  id: ColumnId,
  slot: number,
  a: number,
  b: number,
  c: number,
  d: number,
): void {
  const arr = gs.table(columnSpec(id).group).column(id) as Float32Array;
  const at = slot * 4;

  if (
    arr[at] === a &&
    arr[at + 1] === b &&
    arr[at + 2] === c &&
    arr[at + 3] === d
  ) {
    return;
  }

  arr[at] = a;
  arr[at + 1] = b;
  arr[at + 2] = c;
  arr[at + 3] = d;
  gs.dirty.mark(id, slot);
}

/** RGBA bytes on [0, 255]. */
export function setColor(
  gs: GraphStore,
  id: ColumnId,
  slot: number,
  r: number,
  g: number,
  b: number,
  a: number,
): void {
  const spec = columnSpec(id);
  const arr = gs.table(spec.group).column(id) as Uint8Array;
  const at = slot * 4;

  if (
    arr[at] === r &&
    arr[at + 1] === g &&
    arr[at + 2] === b &&
    arr[at + 3] === a
  ) {
    return;
  }

  arr[at] = r;
  arr[at + 1] = g;
  arr[at + 2] = b;
  arr[at + 3] = a;
  gs.dirty.mark(id, slot);

  // round 56: an end arrow's alpha decides whether the head hides the
  // line under it, which decides how far the line is shortened
  if (id === COL.EDGE_SOURCE_ARROW || id === COL.EDGE_TARGET_ARROW) {
    updateArrowBits(gs, slot);
  }
}

/**
 * Write a node's ghost record [offsetX, offsetY, ghostOpacity,
 * enabled] (the StyleEngine's write path).  Offsets are geometry —
 * they grow the bb scans — so writes bump the geometry epoch.
 */
export function setGhost(
  gs: GraphStore,
  slot: number,
  offX: number,
  offY: number,
  opacity: number,
  enabled: boolean,
): void {
  const arr = gs.nodes.column(COL.NODE_GHOST) as Float32Array;
  const at = slot * 4;
  const en = enabled ? 1 : 0;

  if (
    arr[at] === offX &&
    arr[at + 1] === offY &&
    arr[at + 2] === opacity &&
    arr[at + 3] === en
  ) {
    return;
  }

  if (en !== arr[at + 3]) {
    gs.ghosts += en === 1 ? 1 : -1;
  }

  arr[at] = offX;
  arr[at + 1] = offY;
  arr[at + 2] = opacity;
  arr[at + 3] = en;
  gs.geoEpoch++;
  gs.dirty.mark(COL.NODE_GHOST, slot);
}
