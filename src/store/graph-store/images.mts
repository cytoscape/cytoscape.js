// GraphStore's image, chart and polygon records and the renderer's
// delta read (round 130 split).

import {
  COL,
  CHART_BAR_DOMAIN_MAX_WORD,
  CHART_BAR_DOMAIN_MIN_WORD,
  CHART_COUNT_WORD,
  CHART_HEADER,
  CHART_PIE,
  CHART_REF_MAX_WORDS,
  CHART_STRIPES,
  CHART_VALIDITY_BITS_PER_WORD,
  CHART_VALUE_WORDS,
  REF_OFFSET_FLOATS,
  REF_OFFSET_MASK,
  SHAPE_MASK,
} from '../../contract.mjs';
import type { StoreDelta } from '../../contract.mjs';
import { IMAGE_KIND_AUTO, IMAGE_KIND_SDF } from '../../image-registry.mjs';
import type { ImageRegistry } from '../../image-registry.mjs';
import { IMG_STRIDE } from '../graph-store.mjs';
import { takeBlobs } from './consumers.mjs';
import type {
  NodeImageSpec,
  NodeImageRecord,
  GraphStore,
} from '../graph-store.mjs';

/**
 * Pack an image record ref, `offset | count << 24` (round 145).
 * An offset past the field's reach (`REF_OFFSET_FLOATS`) saturates at
 * `REF_OFFSET_MASK` rather than spilling into the count — before, it
 * ORed its high bits into the count, so readback and the draw read a
 * wrong-length record from the wrong place.  The count stays exact (a
 * compaction's relocation reads it back out of the ref); readback takes
 * the offset from the pool's own table; and the renderer degrades the
 * feature while the pool is past the reach, so a saturated ref is never
 * drawn.  No record can legitimately sit at the saturated offset: every
 * chart and image record is longer than one float.
 *
 * @param offset — the record's offset in its pool, in floats
 * @param count — slices or images, 1..255
 * @returns the ref word
 */
export function packRecordRef(offset: number, count: number): number {
  const field = offset < REF_OFFSET_FLOATS ? offset : REF_OFFSET_MASK;

  return (field | (count << 24)) >>> 0;
}

/** Pack a chart record's word offset as offset + 1 (zero means absent). */
export function packChartRef(offset: number): number {
  return Math.min(offset + 1, CHART_REF_MAX_WORDS) >>> 0;
}

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
    const off = gs.imagePool.offsetOf(slot);
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
    const ref = packRecordRef(offset, specs.length);

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
 * Write (or clear) a node's chart record. The nine-word header and the
 * value/color pairs are defined in contract.mts. Colors and validity
 * bits are written as raw u32 words; the f32 values share the same pool.
 * Pie and stripe values are stored as cumulative stops so the fragment
 * shader can find a region with a binary search.
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
    values: (number | null)[];
    colors: [number, number, number, number][];
    barDomain?: [number, number] | null;
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
  const validityWords = Math.ceil(n / CHART_VALIDITY_BITS_PER_WORD);
  const recordWords = CHART_HEADER + n * CHART_VALUE_WORDS + validityWords;
  const record = new Uint32Array(recordWords);
  const floats = new Float32Array(record.buffer);
  const barDomain = rec.barDomain ?? [NaN, NaN];

  record[0] = rec.kind >>> 0;
  floats[1] = rec.size;
  floats[2] = rec.hole;
  floats[3] = rec.startAngle;
  record[4] = rec.direction >>> 0;
  floats[5] = rec.opacity;
  record[CHART_COUNT_WORD] = n;
  floats[CHART_BAR_DOMAIN_MIN_WORD] = barDomain[0];
  floats[CHART_BAR_DOMAIN_MAX_WORD] = barDomain[1];

  let cumulative = 0;

  for (let i = 0; i < n; i++) {
    const value = values[i];
    const valueWord = CHART_HEADER + i * CHART_VALUE_WORDS;
    const color = colors[i] ?? [0, 0, 0, 0];
    const validityWord =
      CHART_HEADER +
      n * CHART_VALUE_WORDS +
      Math.floor(i / CHART_VALIDITY_BITS_PER_WORD);
    const validityBit = i % CHART_VALIDITY_BITS_PER_WORD;

    if (value != null) {
      record[validityWord] |= 1 << validityBit;
    }

    if (rec.kind === CHART_PIE || rec.kind === CHART_STRIPES) {
      cumulative += value == null ? 0 : value;
      floats[valueWord] = cumulative;
    } else {
      floats[valueWord] = value == null ? NaN : value;
    }

    record[valueWord + 1] =
      (color[0] & 0xff) |
      ((color[1] & 0xff) << 8) |
      ((color[2] & 0xff) << 16) |
      ((color[3] & 0xff) << 24);
  }

  const offset = gs.chartPool.writeWords(slot, record);
  const ref = packChartRef(offset);

  if (refs[slot] !== ref) {
    refs[slot] = ref;
    gs.dirty.mark(COL.NODE_CHART_REF, slot);
  }

  gs.dirty.touch();
}

/** A node's decoded chart record, or null when chartless. */
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
  values: (number | null)[];
  colors: [number, number, number, number][];
  barDomain: [number, number] | null;
} | null {
  const ref = (gs.nodes.column(COL.NODE_CHART_REF) as Uint32Array)[slot];

  if (ref === 0) {
    return null;
  }

  const pool = gs.chartPool.data();
  const words = gs.chartPool.wordData();
  // The pool's own offset remains authoritative after compaction.
  const off = gs.chartPool.offsetOf(slot);
  const n = words[off + CHART_COUNT_WORD];
  const values: (number | null)[] = [];
  const colors: [number, number, number, number][] = [];
  const validityStart = off + CHART_HEADER + n * CHART_VALUE_WORDS;
  const snap = (v: number): number => Math.round(v * 1e6) / 1e6;
  let previousStop = 0;

  for (let i = 0; i < n; i++) {
    const valueWord = off + CHART_HEADER + i * CHART_VALUE_WORDS;
    const valid =
      (words[validityStart + Math.floor(i / CHART_VALIDITY_BITS_PER_WORD)] &
        (1 << (i % CHART_VALIDITY_BITS_PER_WORD))) !==
      0;
    let value = pool[valueWord];

    if (words[off] === CHART_PIE || words[off] === CHART_STRIPES) {
      const stop = value;

      value = stop - previousStop;
      previousStop = stop;
    }

    values.push(valid ? (Number.isFinite(value) ? snap(value) : value) : null);

    const rgba = words[valueWord + 1];

    colors.push([
      rgba & 0xff,
      (rgba >>> 8) & 0xff,
      (rgba >>> 16) & 0xff,
      rgba >>> 24,
    ]);
  }

  const min = pool[off + CHART_BAR_DOMAIN_MIN_WORD];
  const max = pool[off + CHART_BAR_DOMAIN_MAX_WORD];
  const barDomain: [number, number] | null =
    Number.isNaN(min) && Number.isNaN(max) ? null : [min, max];

  return {
    kind: words[off],
    size: snap(pool[off + 1]),
    hole: snap(pool[off + 2]),
    startAngle: pool[off + 3],
    direction: words[off + 4],
    opacity: snap(pool[off + 5]),
    values,
    colors,
    barDomain,
  };
}

/** A node's decoded background-image records, or null when imageless. */
export function nodeImagesAt(
  gs: GraphStore,
  slot: number,
): NodeImageRecord[] | null {
  return decodeNodeImages(
    (gs.nodes.column(COL.NODE_IMAGE_REF) as Uint32Array)[slot],
    gs.imagePool.data(),
    gs.images,
    gs.imagePool.offsetOf(slot),
  );
}

/**
 * Decode one node's image records from its `NODE_IMAGE_REF` word and the
 * image pool — shared by the canonical store and the worker host's
 * mirror (round 141), which holds the same two things as copies.
 *
 * @param ref — the node's `NODE_IMAGE_REF` (offset | count << 24), 0 for none
 * @param pool — the image record pool
 * @param registry — resolves entry ids to urls
 * @param offset — the record's offset from the pool's own table, when
 *   the caller has it (the canonical store: exact past the ref's 24-bit
 *   reach, round 145); omitted, the ref's field (the worker's mirror,
 *   whose renderer degrades images before a saturated ref matters)
 * @returns the records in paint order, or null when imageless
 */
export function decodeNodeImages(
  ref: number,
  pool: Float32Array,
  registry: ImageRegistry,
  offset?: number,
): NodeImageRecord[] | null {
  if (ref === 0) {
    return null;
  }

  const off = offset ?? ref & REF_OFFSET_MASK;
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
      url: registry.get(entryId)?.url ?? '',
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
  const shape = (geom[slot * 4 + 1] >>> 16) & SHAPE_MASK;

  if (shape !== 14 && shape < 27) {
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

function setFusedPolyRef(gs: GraphStore, slot: number, ref: number): void {
  const fused = gs.nodes.column(COL.NODE_OUTER_GEOM) as Float32Array;
  const bits = new Uint32Array(fused.buffer, fused.byteOffset);
  const at = slot * 4 + 3;

  if (bits[at] !== ref) {
    bits[at] = ref;
    gs.dirty.mark(COL.NODE_OUTER_GEOM, slot);
  }
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
    setFusedPolyRef(gs, slot, 0);

    return 0;
  }

  const offset = gs.polyPool.write(slot, points);
  const ref = (offset | ((points.length / 2) << 24)) >>> 0;

  setFusedPolyRef(gs, slot, ref);
  gs.geoEpoch++;
  gs.dirty.touch();

  return ref;
}

/**
 * Drain the frame's pending writes: flushes the lazy derivations
 * first (so parent auto-bounds and curve params land as ordinary
 * column spans inside this delta), then takes the column spans and
 * each blob pool's dirty range.  Destructive — the primary consumer's
 * cursor (the renderer); another reader registers its own (round 106).
 *
 * @returns the delta, with the four blob ranges attached only when
 * that pool actually changed
 */
export function takeDelta(gs: GraphStore): StoreDelta {
  // pending curve derivations land as column writes in gs delta
  gs.flushDerived();

  const delta = gs.dirty.take(gs.nodes.highWater, gs.edges.highWater);

  const folded = gs.primaryFold.blobs;

  if (
    gs.consumers.length > 0 ||
    folded[0] != null ||
    folded[1] != null ||
    folded[2] != null ||
    folded[3] != null
  ) {
    // another consumer is (or was) registered: fold (round 106)
    takeBlobs(gs, gs.primaryFold, delta);

    return delta;
  }

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
