// GraphStore's style channel writers (round 130 split): scalar, pair,
// lane and the arrow bits.

import {
  COL,
  columnSpec,
  ARROW_SHIFT_HOLLOW_SOURCE,
  ARROW_SHIFT_HOLLOW_TARGET,
  ARROW_SHIFT_SRC_SHOWS_LINE,
  ARROW_SHIFT_TGT_SHOWS_LINE,
} from '../../contract.mjs';
import type { ColumnId } from '../../contract.mjs';
import type { GraphStore } from '../graph-store.mjs';
import { reanchorLabel, writeBaseOpacity } from './compound.mjs';

/**
 * Write a single-component numeric column (the StyleEngine's scalar
 * channel).  No-ops when the value is unchanged, so an idempotent
 * restyle costs no upload.  Two columns carry a cascade: `node.opacity`
 * under compounds is a *base* (the column stores the ancestor-folded
 * product, and a parent's write refolds its subtree — round 14.4), and
 * `node.borderWidth` refreshes the derived outerHalf column, feeds the
 * monotone cull slack, and marks the ancestors' auto-bounds stale.
 * Bumps the geometry epoch: scalar channels can move geometry.
 */
export function setScalar(
  gs: GraphStore,
  id: ColumnId,
  slot: number,
  value: number,
): void {
  // round 14.4: under compounds a node opacity write is a *base* —
  // the column stores the ancestor-folded product
  if (id === COL.NODE_OPACITY && gs.hierarchy.hasCompounds()) {
    writeBaseOpacity(gs, slot, value);

    return;
  }

  const spec = columnSpec(id);
  const arr = gs.table(spec.group).column(id) as Float32Array | Uint32Array;
  // a scalar channel on a multi-component column addresses lane 0 and
  // leaves the rest alone: `edge.width` carries the arrow bits in lane 1
  // (round 56), and a scalar write must not clobber them
  const at = slot * spec.components;

  if (id === COL.NODE_BORDER_WIDTH && value > gs.borderMax) {
    gs.borderMax = value;
  }

  if (arr[at] === value) {
    return;
  }

  arr[at] = value;
  gs.geoEpoch++;
  gs.dirty.mark(id, slot);

  // the shape id's lane of the round-58 fused column (outerHalf +
  // shape); the outerHalf lanes follow their own writes above
  if (id === COL.NODE_SHAPE) {
    const geom = gs.nodes.column(COL.NODE_OUTER_GEOM) as Float32Array;

    geom[slot * 4 + 2] = value;
    gs.dirty.mark(COL.NODE_OUTER_GEOM, slot);
  }

  if (id === COL.NODE_BORDER_WIDTH) {
    updateOuterHalf(gs, slot);

    // a border write changes the node's outer extent: stale ancestors
    if (gs.hierarchy.hasCompounds()) {
      gs.hierarchy.markGeo(slot);
    }
  }
}

/**
 * Write a two-component numeric column (sizes, positions-like pairs).
 * No-ops on an unchanged pair.  `node.size` runs the size cascade:
 * the monotone node-half meter, the parent style-size stash (a parent's
 * column is owned by auto-bounds, so the declared size lives in the
 * stash — tracked before the no-op check so it can never go stale),
 * the derived outerHalf write, the label re-anchor (25.1) and the
 * ancestors' auto-bounds staleness.
 */
export function setPair(
  gs: GraphStore,
  id: ColumnId,
  slot: number,
  a: number,
  b: number,
): void {
  const spec = columnSpec(id);
  const arr = gs.table(spec.group).column(id) as Float32Array | Uint32Array;

  if (id === COL.NODE_SIZE) {
    const half = Math.max(a, b) / 2;

    if (half > gs.nodeHalfMax) {
      gs.nodeHalfMax = half;
    }

    // a style size write on a parent updates the stashed fallback
    // (auto-bounds owns the column and re-derives over the clobber);
    // tracked before the no-op check so the stash never goes stale
    if (gs.parentFallback.has(slot)) {
      gs.parentFallback.set(slot, [a, b]);
    }
  }

  if (arr[slot * 2] === a && arr[slot * 2 + 1] === b) {
    return;
  }

  arr[slot * 2] = a;
  arr[slot * 2 + 1] = b;
  gs.geoEpoch++;
  gs.dirty.mark(id, slot);

  if (id === COL.NODE_SIZE) {
    updateOuterHalf(gs, slot);

    // round 25.1: label anchors bake the node extents (the sidecar
    // entry + the glyph run's offsets), so a size write re-anchors —
    // previously only the style engine's same-pass writeLabel covered
    // gs, leaving raw size writes (tween ticks) stale.  Early-outs
    // when unlabelled or the anchor is the center (the default).
    reanchorLabel(gs, slot, a, b);

    // stale ancestors (and the parent's own derived size, if any)
    if (gs.hierarchy.hasCompounds()) {
      gs.hierarchy.markGeo(slot);
    }
  }
}

/**
 * Write one component of a multi-lane column (round 25): the tween
 * executor's entry for lane writes.  `node.size` routes through
 * `setPair`, which runs the size cascade (outerHalf, label re-anchor,
 * compound auto-bounds staleness); other float columns write the lane
 * raw with a dirty mark.
 */
export function setLane(
  gs: GraphStore,
  id: ColumnId,
  slot: number,
  lane: number,
  value: number,
): void {
  if (id === COL.NODE_SIZE) {
    const size = gs.nodes.column(COL.NODE_SIZE) as Float32Array;

    gs.setPair(
      COL.NODE_SIZE,
      slot,
      lane === 0 ? value : size[slot * 2],
      lane === 1 ? value : size[slot * 2 + 1],
    );

    return;
  }

  // the edge layer records store their stroke in lane 1 as ×256
  // fixed-point (see the contract) — encode on the way in
  if (
    id === COL.EDGE_CASING ||
    id === COL.EDGE_OVERLAY ||
    id === COL.EDGE_UNDERLAY
  ) {
    const arr = gs.edges.column(id) as Uint32Array;
    const enc = Math.max(0, Math.round(value * 256));

    if (arr[slot * 2 + 1] === enc) {
      return;
    }

    arr[slot * 2 + 1] = enc;
    gs.dirty.mark(id, slot);

    return;
  }

  const spec = columnSpec(id);
  const arr = gs.table(spec.group).column(id) as Float32Array;
  const i = slot * spec.components + lane;

  if (arr[i] === value) {
    return;
  }

  arr[i] = value;
  gs.dirty.mark(id, slot);
}

/**
 * Write the packed arrow-shapes word, mirroring it bit-for-bit into
 * lane 1 of `edge.width` (round 56).
 *
 * The mirror exists because all four edge vertex stages already bind
 * `edge.width` and none has a spare storage-buffer slot, so this is how
 * the shape word — and with it v3's per-shape `gap` and `spacing` —
 * reaches the vertex stage that has to shorten the line.
 *
 * The copy goes through a `Uint32Array` view of the column's own
 * buffer rather than a bitcast via a JS number: an `arrow-scale` of
 * 7.94 or more sets bits 30..24, and with a mid-target shape ≥ 4
 * setting bit 23 the word *is* an f32 NaN pattern, whose payload a
 * round trip through a JS double would not preserve.
 *
 * @param slot — the edge slot
 * @param word — the packed word (see `edge.arrowShapes` in the contract)
 */
export function setArrowShapes(
  gs: GraphStore,
  slot: number,
  word: number,
): void {
  const shapes = gs.edges.column(COL.EDGE_ARROW_SHAPES) as Uint32Array;

  if (shapes[slot] !== word) {
    shapes[slot] = word;
    // the gap shortens the drawn line, so gs moves geometry
    gs.geoEpoch++;
    gs.dirty.mark(COL.EDGE_ARROW_SHAPES, slot);
  }

  updateArrowBits(gs, slot);
}

/**
 * Write-through for `edge.width`'s mirror lane: the shape word plus the
 * two `SHOWS_LINE` flags (round 56).
 *
 * Called from every write to either input — the shape word and the two
 * end-arrow colours — because the flags derive from both.  A head
 * "shows the line" when it is hollow, or when its stored alpha is below
 * opaque: exactly the cases where v3's `destination-out` erase is doing
 * the hiding rather than the head's own fill, and so exactly the cases
 * where v4 has to shorten the line past v3's `gap` to the head's own
 * depth.  An opaque filled head hides the difference either way, and
 * shortening further would cut the slivers v3 leaves where the head is
 * narrower than the line.
 *
 * Known limit, inherited rather than introduced: a paint channel the
 * mapper kernel owns can leave the *stored* arrow bytes stale (see the
 * getters' note in `style.mts`), so a head made translucent purely
 * on-device reads as opaque here.  The CPU column is what every other
 * CPU consumer reads too.
 */
export function updateArrowBits(gs: GraphStore, slot: number): void {
  const width = gs.edges.column(COL.EDGE_WIDTH) as Float32Array;
  const word = (gs.edges.column(COL.EDGE_ARROW_SHAPES) as Uint32Array)[slot];
  const src = gs.edges.column(COL.EDGE_SOURCE_ARROW) as Uint8Array;
  const tgt = gs.edges.column(COL.EDGE_TARGET_ARROW) as Uint8Array;

  if (gs.widthBitsView == null || gs.widthBitsView.buffer !== width.buffer) {
    gs.widthBitsView = new Uint32Array(width.buffer);
  }

  const shows = (alpha: number, hollowShift: number): number =>
    (alpha > 0 && alpha < 255) || ((word >>> hollowShift) & 1) === 1 ? 1 : 0;

  const bits =
    word |
    (shows(src[slot * 4 + 3], ARROW_SHIFT_HOLLOW_SOURCE) <<
      ARROW_SHIFT_SRC_SHOWS_LINE) |
    (shows(tgt[slot * 4 + 3], ARROW_SHIFT_HOLLOW_TARGET) <<
      ARROW_SHIFT_TGT_SHOWS_LINE);

  // the mirror can be stale even when its inputs are not: a growth or a
  // compaction reallocates edge.width
  if (gs.widthBitsView[slot * 2 + 1] === bits) {
    return;
  }

  gs.widthBitsView[slot * 2 + 1] = bits;
  gs.geoEpoch++;
  gs.dirty.mark(COL.EDGE_WIDTH, slot);
}

/**
 * Write-through for the derived node.outerHalf column (size/2 +
 * borderWidth/2 per axis — see the contract): follows every size/border
 * write, so the column is never stale.  The curve shaders and the CPU
 * curve evaluator both read this column, so the two sides agree on the
 * exact f32 half-extents by construction.
 */
export function updateOuterHalf(gs: GraphStore, slot: number): void {
  const size = gs.nodes.column(COL.NODE_SIZE) as Float32Array;
  const border = gs.nodes.column(COL.NODE_BORDER_WIDTH) as Float32Array;
  const outer = gs.nodes.column(COL.NODE_OUTER_HALF) as Float32Array;
  const geom = gs.nodes.column(COL.NODE_OUTER_GEOM) as Float32Array;
  const halfBorder = border[slot] / 2;
  const hx = size[slot * 2] / 2 + halfBorder;
  const hy = size[slot * 2 + 1] / 2 + halfBorder;

  outer[slot * 2] = hx;
  outer[slot * 2 + 1] = hy;
  gs.dirty.mark(COL.NODE_OUTER_HALF, slot);
  // the round-58 fused twin (outerHalf + shape in one column, for the
  // vertex stages at the storage-buffer budget) follows in the same
  // write, so the two can never disagree; lane 2 is the shape write's
  geom[slot * 4] = hx;
  geom[slot * 4 + 1] = hy;
  gs.dirty.mark(COL.NODE_OUTER_GEOM, slot);
}
