// GraphStore's image, chart and polygon records and the renderer's
// delta read (round 130 split).

import { COL, CHART_HEADER } from '../../contract.mjs';
import type { StoreDelta } from '../../contract.mjs';
import { IMAGE_KIND_AUTO, IMAGE_KIND_SDF } from '../../image-registry.mjs';
import { IMG_STRIDE } from '../graph-store.mjs';
import type {
  NodeImageSpec,
  NodeImageRecord,
  GraphStore,
} from '../graph-store.mjs';

/**
 * Store a node's background-image records (round 15.2), or null to
 * clear.  Acquires the new urls' registry entries *before* releasing
 * the old ones, so a shared url surviving a restyle never transits
 * refcount 0.  Encoding per image (IMG_STRIDE floats): [entryId,
 * modeFlags (fit | repeat<<2 | clip<<4 | containment<<5 |
 * smoothing<<6 | sdf<<7), opacity, posX, posY, offX, offY, w, h,
 * unitFlags (posXPct | posYPct<<1 | offXPct<<2 | offYPct<<3 |
 * wMode<<4 | hMode<<6), tintRG (r + g×256), tintBA (b + a×256)].
 * Draw-only paint: no geoEpoch bump, no bb/pick involvement.
 *
 * @param slot — the node slot
 * @param specs — the styled images in paint order, or null/empty to
 * clear (clearing an already-imageless node is a no-op fast path)
 */
export function setNodeImages(
  gs: GraphStore,
  slot: number,
  specs: NodeImageSpec[] | null,
): void {
  const refs = gs.nodes.column(COL.NODE_IMAGE_REF) as Uint32Array;
  const oldRef = refs[slot];
  const clearing = specs == null || specs.length === 0;

  if (clearing && oldRef === 0) {
    return;
  } // the imageless fast path

  if (clearing) {
    gs.imagedNodes--;
  } else if (oldRef === 0) {
    gs.imagedNodes++;
  }

  const oldIds: number[] = [];

  if (oldRef !== 0) {
    const pool = gs.imagePool.data();
    const off = oldRef & 0xffffff;
    const count = oldRef >>> 24;

    for (let i = 0; i < count; i++) {
      oldIds.push(pool[off + i * IMG_STRIDE]);
    }
  }

  if (clearing) {
    gs.imagePool.free(slot);
    refs[slot] = 0;
    gs.dirty.mark(COL.NODE_IMAGE_REF, slot);
  } else {
    const values = new Array<number>(specs.length * IMG_STRIDE);

    for (let i = 0; i < specs.length; i++) {
      const s = specs[i];
      const id = gs.images.acquire(
        s.url,
        s.sdf ? IMAGE_KIND_SDF : IMAGE_KIND_AUTO,
        s.crossOrigin,
      );
      const base = i * IMG_STRIDE;

      values[base] = id;
      values[base + 1] =
        s.fit |
        (s.repeat << 2) |
        (s.clip << 4) |
        (s.containment << 5) |
        ((s.smoothing ? 1 : 0) << 6) |
        ((s.sdf ? 1 : 0) << 7);
      values[base + 2] = s.opacity;
      values[base + 3] = s.posX.v;
      values[base + 4] = s.posY.v;
      values[base + 5] = s.offX.v;
      values[base + 6] = s.offY.v;
      values[base + 7] = s.w.v;
      values[base + 8] = s.h.v;
      values[base + 9] =
        (s.posX.pct ? 1 : 0) |
        ((s.posY.pct ? 1 : 0) << 1) |
        ((s.offX.pct ? 1 : 0) << 2) |
        ((s.offY.pct ? 1 : 0) << 3) |
        (s.w.mode << 4) |
        (s.h.mode << 6);
      values[base + 10] = s.tint[0] + s.tint[1] * 256;
      values[base + 11] = s.tint[2] + s.tint[3] * 256;
    }

    const offset = gs.imagePool.write(slot, values);
    const ref = (offset | (specs.length << 24)) >>> 0;

    if (refs[slot] !== ref) {
      refs[slot] = ref;
      gs.dirty.mark(COL.NODE_IMAGE_REF, slot);
    }
  }

  for (const id of oldIds) {
    gs.images.release(id);
  }

  gs.dirty.touch();
}

/**
 * Write (or clear) a node's chart record (round 23).  The blob layout
 * is CHART_HEADER floats — kind, size, hole, startAngle, direction,
 * n — then n × (value, r+g·256, b+a·256): colors split across two
 * small-integer floats (the image-record trick — packed u32 color
 * bits would risk NaN canonicalization through the f32 pool).
 * Colors arrive alpha-folded (chart-opacity, the B1 pattern).
 */
export function setChart(
  gs: GraphStore,
  slot: number,
  rec: {
    kind: number;
    size: number;
    hole: number;
    startAngle: number;
    direction: number;
    opacity: number;
    values: number[];
    colors: [number, number, number, number][];
  } | null,
): void {
  const refs = gs.nodes.column(COL.NODE_CHART_REF) as Uint32Array;
  const oldRef = refs[slot];
  const clearing = rec == null || rec.values.length === 0;

  if (clearing && oldRef === 0) {
    return;
  } // the chartless fast path

  if (clearing) {
    gs.chartedNodes--;
    gs.chartPool.free(slot);
    refs[slot] = 0;
    gs.dirty.mark(COL.NODE_CHART_REF, slot);
    gs.dirty.touch();

    return;
  }

  if (oldRef === 0) {
    gs.chartedNodes++;
  }

  const { values, colors } = rec;
  const n = values.length;
  const record = new Array<number>(CHART_HEADER + n * 3);

  record[0] = rec.kind;
  record[1] = rec.size;
  record[2] = rec.hole;
  record[3] = rec.startAngle;
  record[4] = rec.direction;
  record[5] = rec.opacity;
  record[6] = n;

  for (let i = 0; i < n; i++) {
    const [r, g, b, a] = colors[i];

    record[CHART_HEADER + i * 3] = values[i];
    record[CHART_HEADER + i * 3 + 1] = r + g * 256;
    record[CHART_HEADER + i * 3 + 2] = b + a * 256;
  }

  const offset = gs.chartPool.write(slot, record);
  const ref = (offset | (n << 24)) >>> 0;

  if (refs[slot] !== ref) {
    refs[slot] = ref;
    gs.dirty.mark(COL.NODE_CHART_REF, slot);
  }

  gs.dirty.touch();
}

/** A node's decoded chart record, or null when chartless (round 23). */
export function chartAt(
  gs: GraphStore,
  slot: number,
): {
  kind: number;
  size: number;
  hole: number;
  startAngle: number;
  direction: number;
  opacity: number;
  values: number[];
  colors: [number, number, number, number][];
} | null {
  const ref = (gs.nodes.column(COL.NODE_CHART_REF) as Uint32Array)[slot];

  if (ref === 0) {
    return null;
  }

  const pool = gs.chartPool.data();
  const off = ref & 0xffffff;
  const n = ref >>> 24;
  const values: number[] = [];
  const colors: [number, number, number, number][] = [];
  // the pool is f32: snap fractions back to a friendly precision
  const snap = (v: number): number => Math.round(v * 1e6) / 1e6;

  for (let i = 0; i < n; i++) {
    const base = off + CHART_HEADER + i * 3;
    const rg = pool[base + 1];
    const ba = pool[base + 2];

    values.push(snap(pool[base]));
    colors.push([
      rg % 256,
      Math.floor(rg / 256),
      ba % 256,
      Math.floor(ba / 256),
    ]);
  }

  return {
    kind: pool[off],
    size: snap(pool[off + 1]),
    hole: snap(pool[off + 2]),
    startAngle: pool[off + 3],
    direction: pool[off + 4],
    opacity: snap(pool[off + 5]),
    values,
    colors,
  };
}

/** A node's decoded background-image records, or null when imageless. */
export function nodeImagesAt(
  gs: GraphStore,
  slot: number,
): NodeImageRecord[] | null {
  const ref = (gs.nodes.column(COL.NODE_IMAGE_REF) as Uint32Array)[slot];

  if (ref === 0) {
    return null;
  }

  const pool = gs.imagePool.data();
  const off = ref & 0xffffff;
  const count = ref >>> 24;
  const out: NodeImageRecord[] = [];

  for (let i = 0; i < count; i++) {
    const base = off + i * IMG_STRIDE;
    const entryId = pool[base];
    const flags = pool[base + 1];
    const units = pool[base + 9];
    const rg = pool[base + 10];
    const ba = pool[base + 11];

    out.push({
      entryId,
      url: gs.images.get(entryId)?.url ?? '',
      fit: flags & 3,
      repeat: (flags >> 2) & 3,
      clip: (flags >> 4) & 1,
      containment: (flags >> 5) & 1,
      smoothing: ((flags >> 6) & 1) === 1,
      sdf: ((flags >> 7) & 1) === 1,
      opacity: pool[base + 2],
      posX: { v: pool[base + 3], pct: (units & 1) === 1 },
      posY: { v: pool[base + 4], pct: ((units >> 1) & 1) === 1 },
      offX: { v: pool[base + 5], pct: ((units >> 2) & 1) === 1 },
      offY: { v: pool[base + 6], pct: ((units >> 3) & 1) === 1 },
      w: { mode: (units >> 4) & 3, v: pool[base + 7] },
      h: { mode: (units >> 6) & 3, v: pool[base + 8] },
      tint: [rg % 256, Math.floor(rg / 256), ba % 256, Math.floor(ba / 256)],
    });
  }

  return out;
}

/** A node's custom polygon points (unit pairs), or null. */
export function polygonPointsAt(
  gs: GraphStore,
  slot: number,
): Float64Array | null {
  const geom = gs.nodes.column(COL.NODE_BORDER_GEOM) as Uint32Array;
  const shape = (geom[slot * 4 + 1] >>> 16) & 0xf;

  if (shape !== 14) {
    return null;
  }

  const ref = geom[slot * 4];
  const off = ref & 0xffffff;
  const count = ref >>> 24;
  const pool = gs.polyPool.data();
  const out = new Float64Array(count * 2);

  for (let i = 0; i < count * 2; i++) {
    out[i] = pool[off + i];
  }

  return out;
}

/**
 * Store a node's custom polygon points (round 13 C3): flat unit
 * [x, y, ...] pairs, or null to clear.  Returns the packed record
 * ref (offset | pointCount << 24) for borderGeom[0].
 */
export function setPolygonPoints(
  gs: GraphStore,
  slot: number,
  points: number[] | null,
): number {
  if (points == null || points.length === 0) {
    gs.polyPool.free(slot);

    return 0;
  }

  const offset = gs.polyPool.write(slot, points);

  gs.geoEpoch++;
  gs.dirty.touch();

  return (offset | ((points.length / 2) << 24)) >>> 0;
}

/**
 * Drain the frame's pending writes: flushes the lazy derivations
 * first (so parent auto-bounds and curve params land as ordinary
 * column spans inside this delta), then takes the column spans and
 * each blob pool's dirty range.  Destructive — the trackers are
 * cleared, so exactly one consumer (the renderer) may call it.
 *
 * @returns the delta, with the four blob ranges attached only when
 * that pool actually changed
 */
export function takeDelta(gs: GraphStore): StoreDelta {
  // pending curve derivations land as column writes in gs delta
  gs.flushDerived();

  const delta = gs.dirty.take(gs.nodes.highWater, gs.edges.highWater);
  const blobDirty = gs.blob.takeDirty();

  if (blobDirty != null) {
    delta.curveBlob = blobDirty;
  }

  const polyDirty = gs.polyPool.takeDirty();

  if (polyDirty != null) {
    delta.polyBlob = polyDirty;
  }

  const imageDirty = gs.imagePool.takeDirty();

  if (imageDirty != null) {
    delta.imageBlob = imageDirty;
  }

  const chartDirty = gs.chartPool.takeDirty();

  if (chartDirty != null) {
    delta.chartBlob = chartDirty;
  }

  return delta;
}
