// GraphStore's curve geometry reads and the curve-param writers (round
// 130 split), as functions over the store.  See `GraphStore` in
// ../graph-store.mts for the surface.

import type { CurveStyleExtras, EndpointSpec } from '../curve-index.mjs';
import {
  boundaryOffset,
  curveDeviation,
  evalCurve,
  evalRoute,
  haystackPoint,
  shortenToward,
} from '../../curve-geometry.mjs';
import type {
  ArrowTrim,
  CurveEval,
  CurveRoute,
} from '../../curve-geometry.mjs';
import { arrowGap, arrowSpacing } from '../../shape-points.mjs';
import {
  GROUP_EDGES,
  COL,
  CURVE_BEZIER,
  CURVE_CMPD,
  CURVE_HAS_ENDPT,
  CURVE_HAYSTACK,
  CURVE_LOOP,
  CURVE_MULTI,
  CURVE_SEGMENTS,
  CURVE_STRAIGHT,
  CURVE_TAXI,
  CURVE_TRIANGLE,
  ARROW_SHAPE_MASK,
  ARROW_SHIFT_SCALE,
  ARROW_SHIFT_SOURCE,
  ARROW_SHIFT_TARGET,
  FLAG_CURVED,
  FLAG_CURVED_BOX,
} from '../../contract.mjs';
import { shortenScratch, sampleCurveBB } from './curve-sample.mjs';
import type { GraphStore } from '../graph-store.mjs';

/**
 * Store an edge's styled curve record (the StyleEngine's write path);
 * the derived edge.curveParams re-derive lazily via the CurveIndex.
 * `extras` carries the 12b family lists/params (null for
 * straight/bezier styles).
 */
export function setCurveStyle(
  gs: GraphStore,
  slot: number,
  style: number,
  stepSize: number,
  weight: number,
  loopDirection: number,
  loopSweep: number,
  extras: CurveStyleExtras | null = null,
  haystackRadius: number = 0,
  endpoints: EndpointSpec | null = null,
): void {
  gs.curves.setStyle(
    slot,
    style,
    stepSize,
    weight,
    loopDirection,
    loopSweep,
    extras,
    haystackRadius,
    endpoints,
  );
}

/**
 * v3's two per-end shortenings for one edge, resolved from the arrow
 * and width columns (round 56).
 *
 * This is the CPU side of what `edge.width` lane 1 carries to the
 * vertex stages: the same packed word, the same `arrowGap` /
 * `arrowSpacing`, so the drawn line and every accessor agree by
 * construction rather than by two hand-kept copies of v3's table.
 *
 * Haystack is the one exception, and it is v3's: haystack edges draw
 * no heads at all and route through a different path, so they take no
 * shortening.
 *
 * @param slot — the edge slot
 * @returns a shared scratch — consume it before the next call
 */
export function arrowTrimAt(gs: GraphStore, slot: number): ArrowTrim {
  const out = gs.trimScratch;
  const params = gs.edges.column(COL.EDGE_CURVE_PARAMS) as Float32Array;

  if (params[slot * 4 + 3] === CURVE_HAYSTACK) {
    out.srcGap = out.tgtGap = out.srcSpacing = out.tgtSpacing = 0;

    return out;
  }

  const word = (gs.edges.column(COL.EDGE_ARROW_SHAPES) as Uint32Array)[slot];
  const width = (gs.edges.column(COL.EDGE_WIDTH) as Float32Array)[slot * 2];
  const src = (word >>> ARROW_SHIFT_SOURCE) & ARROW_SHAPE_MASK;
  const tgt = (word >>> ARROW_SHIFT_TARGET) & ARROW_SHAPE_MASK;
  const q = word >>> ARROW_SHIFT_SCALE;
  // the *quantized* scale, deliberately: the head is drawn at it, so a
  // gap derived from the unquantized value would not meet the head
  const scale = q === 0 ? 1 : q / 16;

  out.srcGap = arrowGap(src, width, scale);
  out.tgtGap = arrowGap(tgt, width, scale);
  out.srcSpacing = arrowSpacing(src, width, scale);
  out.tgtSpacing = arrowSpacing(tgt, width, scale);

  return out;
}

/**
 * Evaluate one curved edge's geometry from the live columns (null for
 * straight edges).  The returned object is a shared scratch unless
 * `out` is given — consume it before the next call.  This is the CPU
 * twin of the curve vertex shader: same params, same boundary math,
 * same frame (see curve-geometry.mts).
 */
export function curveEvalAt(
  gs: GraphStore,
  slot: number,
  out: CurveEval = gs.curveScratch,
): CurveEval | null {
  gs.flushDerived();

  const params = gs.edges.column(COL.EDGE_CURVE_PARAMS) as Float32Array;
  const at = slot * 4;
  const kind = params[at + 3];

  // blob-backed kinds evaluate as routes (curveRouteAt), not CurveEvals
  if (kind !== CURVE_BEZIER && kind !== CURVE_LOOP && kind !== CURVE_CMPD) {
    return null;
  }

  const endpoints = gs.edges.column(COL.EDGE_ENDPOINTS) as Uint32Array;
  const pos = gs.nodes.column(COL.NODE_POSITION) as Float32Array;
  const outer = gs.nodes.column(COL.NODE_OUTER_HALF) as Float32Array;
  const shape = gs.nodes.column(COL.NODE_SHAPE) as Uint32Array;
  const s = endpoints[at / 2];
  const t = endpoints[at / 2 + 1];

  // the derived outerHalf column (size/2 + border/2) is what the WGSL
  // twin binds, so both sides read the exact same f32 half-extents
  return evalCurve(
    out,
    kind,
    params[at],
    params[at + 1],
    params[at + 2],
    pos[s * 2],
    pos[s * 2 + 1],
    outer[s * 2],
    outer[s * 2 + 1],
    shape[s],
    pos[t * 2],
    pos[t * 2 + 1],
    outer[t * 2],
    outer[t * 2 + 1],
    shape[t],
    gs.arrowTrimAt(slot),
  );
}

/**
 * Evaluate a blob-backed curved edge's route from the live columns
 * (null for straight/bezier/loop edges — those use curveEvalAt).
 * The returned object is a shared scratch unless `out` is given.
 * The CPU twin of the 12b route vertex shader: same blob record,
 * same outerHalf frame, same routing (see curve-geometry.mts).
 */
export function curveRouteAt(
  gs: GraphStore,
  slot: number,
  out: CurveRoute = gs.routeScratch,
): CurveRoute | null {
  gs.flushDerived();

  const params = gs.edges.column(COL.EDGE_CURVE_PARAMS) as Float32Array;
  const at = slot * 4;
  const kind = params[at + 3];
  const base = kind >= CURVE_HAS_ENDPT ? kind - CURVE_HAS_ENDPT : kind; // 12c endpoint blocks

  if (base !== CURVE_MULTI && base !== CURVE_SEGMENTS && base !== CURVE_TAXI) {
    return null;
  }

  const endpoints = gs.edges.column(COL.EDGE_ENDPOINTS) as Uint32Array;
  const pos = gs.nodes.column(COL.NODE_POSITION) as Float32Array;
  const outer = gs.nodes.column(COL.NODE_OUTER_HALF) as Float32Array;
  const shape = gs.nodes.column(COL.NODE_SHAPE) as Uint32Array;
  const s = endpoints[at / 2];
  const t = endpoints[at / 2 + 1];

  return evalRoute(
    out,
    kind,
    gs.blob.data(),
    params[at],
    params[at + 2],
    pos[s * 2],
    pos[s * 2 + 1],
    outer[s * 2],
    outer[s * 2 + 1],
    shape[s],
    pos[t * 2],
    pos[t * 2 + 1],
    outer[t * 2],
    outer[t * 2 + 1],
    shape[t],
    gs.arrowTrimAt(slot),
  );
}

/**
 * The same route evaluation at *hypothetical* endpoint centres —
 * `Collection.boundingBoxAt`'s taxi term (round 54).  Everything but
 * the two positions (blob record, outer halves, shapes, trim) reads
 * the live columns; the caller supplies where the nodes would be.
 *
 * @param slot — the edge slot
 * @param sx — hypothetical source centre x
 * @param sy — hypothetical source centre y
 * @param tx — hypothetical target centre x
 * @param ty — hypothetical target centre y
 * @param out — optional route to fill (the shared scratch otherwise)
 * @returns the route, or null for a non-blob-backed edge
 */
export function curveRouteAtPositions(
  gs: GraphStore,
  slot: number,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  out: CurveRoute = gs.routeScratch,
): CurveRoute | null {
  gs.flushDerived();

  const params = gs.edges.column(COL.EDGE_CURVE_PARAMS) as Float32Array;
  const at = slot * 4;
  const kind = params[at + 3];
  const base = kind >= CURVE_HAS_ENDPT ? kind - CURVE_HAS_ENDPT : kind;

  if (base !== CURVE_MULTI && base !== CURVE_SEGMENTS && base !== CURVE_TAXI) {
    return null;
  }

  const endpoints = gs.edges.column(COL.EDGE_ENDPOINTS) as Uint32Array;
  const outer = gs.nodes.column(COL.NODE_OUTER_HALF) as Float32Array;
  const shape = gs.nodes.column(COL.NODE_SHAPE) as Uint32Array;
  const s = endpoints[at / 2];
  const t = endpoints[at / 2 + 1];

  return evalRoute(
    out,
    kind,
    gs.blob.data(),
    params[at],
    params[at + 2],
    sx,
    sy,
    outer[s * 2],
    outer[s * 2 + 1],
    shape[s],
    tx,
    ty,
    outer[t * 2],
    outer[t * 2 + 1],
    shape[t],
    gs.arrowTrimAt(slot),
  );
}

/**
 * The same curve evaluation as `curveEvalAt`, at *hypothetical*
 * endpoint centres (round 92) — `curveBBAtPositions`' eval-kind half,
 * the CurveEval twin of `curveRouteAtPositions`.  Everything but the
 * two positions (params, outer halves, shapes, trim) reads the live
 * columns; the caller supplies where the nodes would be.
 *
 * @param slot — the edge slot
 * @param sx — hypothetical source centre x
 * @param sy — hypothetical source centre y
 * @param tx — hypothetical target centre x
 * @param ty — hypothetical target centre y
 * @param out — optional eval to fill (the shared scratch otherwise)
 * @returns the eval, or null for a blob-backed or straight edge
 */
export function curveEvalAtPositions(
  gs: GraphStore,
  slot: number,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  out: CurveEval = gs.curveScratch,
): CurveEval | null {
  gs.flushDerived();

  const params = gs.edges.column(COL.EDGE_CURVE_PARAMS) as Float32Array;
  const at = slot * 4;
  const kind = params[at + 3];

  if (kind !== CURVE_BEZIER && kind !== CURVE_LOOP && kind !== CURVE_CMPD) {
    return null;
  }

  const endpoints = gs.edges.column(COL.EDGE_ENDPOINTS) as Uint32Array;
  const outer = gs.nodes.column(COL.NODE_OUTER_HALF) as Float32Array;
  const shape = gs.nodes.column(COL.NODE_SHAPE) as Uint32Array;
  const s = endpoints[at / 2];
  const t = endpoints[at / 2 + 1];

  return evalCurve(
    out,
    kind,
    params[at],
    params[at + 1],
    params[at + 2],
    sx,
    sy,
    outer[s * 2],
    outer[s * 2 + 1],
    shape[s],
    tx,
    ty,
    outer[t * 2],
    outer[t * 2 + 1],
    shape[t],
    gs.arrowTrimAt(slot),
  );
}

/**
 * The haystack endpoint pair of an edge (12c; null unless the edge's
 * derived kind is CURVE_HAYSTACK): the hash-stable offset points
 * inside each node body, computed from the params column + live
 * positions/outer halves — the CPU twin of the straight edge
 * shader's haystack branch.
 */
export function haystackPointsAt(
  gs: GraphStore,
  slot: number,
): { sx: number; sy: number; tx: number; ty: number } | null {
  gs.flushDerived();

  const params = gs.edges.column(COL.EDGE_CURVE_PARAMS) as Float32Array;
  const at = slot * 4;

  if (params[at + 3] !== CURVE_HAYSTACK) {
    return null;
  }

  const endpoints = gs.edges.column(COL.EDGE_ENDPOINTS) as Uint32Array;
  const pos = gs.nodes.column(COL.NODE_POSITION) as Float32Array;
  const outer = gs.nodes.column(COL.NODE_OUTER_HALF) as Float32Array;
  const sN = endpoints[slot * 2];
  const tN = endpoints[slot * 2 + 1];
  const radius = params[at + 2];
  const p = { x: 0, y: 0 };

  haystackPoint(
    pos[sN * 2],
    pos[sN * 2 + 1],
    outer[sN * 2],
    outer[sN * 2 + 1],
    params[at],
    radius,
    p,
  );

  const sx = p.x,
    sy = p.y;

  haystackPoint(
    pos[tN * 2],
    pos[tN * 2 + 1],
    outer[tN * 2],
    outer[tN * 2 + 1],
    params[at + 1],
    radius,
    p,
  );

  return { sx, sy, tx: p.x, ty: p.y };
}

/**
 * Where a **straight** edge meets a node's boundary, along the chord
 * between the two node centres (round 55).
 *
 * This is the CPU twin of the straight arrow shader's tip placement
 * (`tip = tipC - dir * boundaryOffset(...)`), so the accessor built on
 * it reports the point the renderer actually draws to.
 *
 * It exists because v4 previously answered the node *centre* here —
 * `Collection._endpointPoint` fell through to the raw positions for
 * every straight edge — which is off by a whole node radius from v3
 * and from what is on screen.
 *
 * @param slot — the edge's slot
 * @param which — 0 for the source end, 1 for the target end
 * @returns the boundary point in model space
 */
export function straightEndpointAt(
  gs: GraphStore,
  slot: number,
  which: 0 | 1,
  arrows: boolean = true,
): { x: number; y: number } {
  gs.flushDerived();

  const endpoints = gs.edges.column(COL.EDGE_ENDPOINTS) as Uint32Array;
  const pos = gs.nodes.column(COL.NODE_POSITION) as Float32Array;
  const outer = gs.nodes.column(COL.NODE_OUTER_HALF) as Float32Array;
  const shape = gs.nodes.column(COL.NODE_SHAPE) as Uint32Array;

  const self = endpoints[slot * 2 + which];
  const other = endpoints[slot * 2 + (which === 0 ? 1 : 0)];
  const cx = pos[self * 2];
  const cy = pos[self * 2 + 1];

  let dx = pos[other * 2] - cx;
  let dy = pos[other * 2 + 1] - cy;
  const l = Math.sqrt(dx * dx + dy * dy);

  // coincident endpoints have no chord direction; `setBoundaryPoint`
  // picks +x in the same situation, so gs matches it
  if (l < 1e-6) {
    dx = 1;
    dy = 0;
  } else {
    dx /= l;
    dy /= l;
  }

  const off = boundaryOffset(
    shape[self],
    outer[self * 2],
    outer[self * 2 + 1],
    dx,
    dy,
  );
  const trim = gs.arrowTrimAt(slot);
  const back = arrows
    ? which === 0
      ? trim.srcSpacing
      : trim.tgtSpacing
    : which === 0
      ? trim.srcGap
      : trim.tgtGap;

  shortenScratch.x = cx + dx * off;
  shortenScratch.y = cy + dy * off;
  // v3's shortenIntersection, toward the far node centre — the clamp
  // matters when a head is larger than the chord it sits on
  shortenToward(
    shortenScratch,
    shortenScratch.x,
    shortenScratch.y,
    pos[other * 2],
    pos[other * 2 + 1],
    back,
  );

  return { x: shortenScratch.x, y: shortenScratch.y };
}

/**
 * The exact bounding box of a curved edge (null for straight ones):
 * the flattened polyline at the drawn subdivision, memoized per slot
 * against the geometry epoch — the "exact lazy CPU eval" tier of the
 * expensive-geometry design (public `.bb()`, and since round 92 the
 * fit scan's box-bounded kinds, read this; the cull kernels keep
 * their conservative bounds).
 */
export function curveBBAt(
  gs: GraphStore,
  slot: number,
): { x1: number; y1: number; x2: number; y2: number } | null {
  // flush before anything: derivation writes params, and a parent
  // auto-bounds materialization bumps the epoch gs memo checks
  gs.flushDerived();

  const params = gs.edges.column(COL.EDGE_CURVE_PARAMS) as Float32Array;
  const kind = params[slot * 4 + 3];
  const base = kind >= CURVE_HAS_ENDPT ? kind - CURVE_HAS_ENDPT : kind;

  if (
    kind !== CURVE_BEZIER &&
    kind !== CURVE_LOOP &&
    kind !== CURVE_CMPD &&
    base !== CURVE_MULTI &&
    base !== CURVE_SEGMENTS &&
    base !== CURVE_TAXI
  ) {
    return null;
  }

  if (gs.edgeBBEpoch.length < gs.edges.cap) {
    const epochs = new Uint32Array(gs.edges.cap);
    const boxes = new Float64Array(gs.edges.cap * 4);

    epochs.set(gs.edgeBBEpoch);
    boxes.set(gs.edgeBB);
    gs.edgeBBEpoch = epochs;
    gs.edgeBB = boxes;
  }

  const at = slot * 4;

  // a fresh memo answers without evaluating the curve at all (round
  // 92 — the eval used to run before gs check, which made every
  // warm read pay a full route/curve evaluation it then threw away)
  if (gs.edgeBBEpoch[slot] === gs.geoEpoch) {
    return {
      x1: gs.edgeBB[at],
      y1: gs.edgeBB[at + 1],
      x2: gs.edgeBB[at + 2],
      y2: gs.edgeBB[at + 3],
    };
  }

  const ev = gs.curveEvalAt(slot);
  const route = ev == null ? gs.curveRouteAt(slot) : null;

  if (ev == null && route == null) {
    return null;
  }

  const box = sampleCurveBB(ev, route);

  gs.edgeBBEpoch[slot] = gs.geoEpoch;
  gs.edgeBB[at] = box.x1;
  gs.edgeBB[at + 1] = box.y1;
  gs.edgeBB[at + 2] = box.x2;
  gs.edgeBB[at + 3] = box.y2;

  return box;
}

/**
 * The exact bounding box of a curved edge at *hypothetical* endpoint
 * centres (round 92) — `Collection.boundingBoxAt`'s tier for the
 * box-bounded kinds, twinned with what `curveBBAt` answers at the
 * live centres.  Not memoized: hypothetical positions have no epoch,
 * and the caller (a layout's fit target) evaluates each edge once
 * per call anyway.
 *
 * @param slot — the edge slot
 * @param sx — hypothetical source centre x
 * @param sy — hypothetical source centre y
 * @param tx — hypothetical target centre x
 * @param ty — hypothetical target centre y
 * @returns the box, or null for a straight/haystack edge
 */
export function curveBBAtPositions(
  gs: GraphStore,
  slot: number,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
): { x1: number; y1: number; x2: number; y2: number } | null {
  const ev = gs.curveEvalAtPositions(slot, sx, sy, tx, ty);
  const route =
    ev == null ? gs.curveRouteAtPositions(slot, sx, sy, tx, ty) : null;

  if (ev == null && route == null) {
    return null;
  }

  return sampleCurveBB(ev, route);
}

/**
 * Conservative model-px bound on how far any curved edge strays from
 * the segment between its endpoint node centers — the cull kernels
 * grow their straight-chord tests by this (per-edge params can't bind
 * everywhere within the 8-storage-buffer budgets).  Monotone maxima:
 * never shrinks on removals/restyles, which only costs cull
 * efficiency, never correctness; 0 while nothing is curved.
 */
export function curveSlack(gs: GraphStore): number {
  if (gs.curveDevMax === 0 && !gs.hasBoxCurves) {
    return 0;
  }

  // 12c: pct endpoints stray up to pctMag × node-half from the node
  // center; the base node-half term covers pctMag ≤ 1, the monotone
  // excess covers the rest
  const pctExcess =
    Math.max(0, gs.endptPctMax - 1) * (gs.nodeHalfMax + gs.borderMax / 2);

  return gs.curveDevMax + gs.nodeHalfMax + gs.borderMax / 2 + pctExcess;
}

/**
 * The conservative model-px bound on how far a haystack endpoint can
 * sit from its node center (12c): radius × the largest outer half.
 * The *straight*-stream cull/pick-tile tests grow by this (haystack
 * rides the straight pipeline), and it stays 0 until some edge
 * styles haystack.  Monotone, like the curve slack.
 */
export function haystackSlack(gs: GraphStore): number {
  if (gs.haystackRadiusMax === 0) {
    return 0;
  }

  return gs.haystackRadiusMax * (gs.nodeHalfMax + gs.borderMax / 2);
}

/** The CurveIndex's write sink: params column + FLAG_CURVED + dirty.
 * Fixed-kind writes (straight/bezier/loop) release any blob record
 * the slot held from a previous blob-backed style. */
export function setCurveParams(
  gs: GraphStore,
  slot: number,
  p0: number,
  p1: number,
  p2: number,
  kind: number,
): void {
  const arr = gs.edges.column(COL.EDGE_CURVE_PARAMS) as Float32Array;
  const at = slot * 4;

  const dev = curveDeviation(kind, p0, p2);

  if (dev > gs.curveDevMax) {
    gs.curveDevMax = dev;
  }
  if (kind === CURVE_HAYSTACK && p2 > gs.haystackRadiusMax) {
    gs.haystackRadiusMax = p2;
  }

  gs.blob.free(slot);

  if (
    arr[at] === p0 &&
    arr[at + 1] === p1 &&
    arr[at + 2] === p2 &&
    arr[at + 3] === kind
  ) {
    return;
  }

  arr[at] = p0;
  arr[at + 1] = p1;
  arr[at + 2] = p2;
  arr[at + 3] = kind;
  gs.geoEpoch++;

  gs.dirty.mark(COL.EDGE_CURVE_PARAMS, slot);
  // haystack/triangle are straight-stream kinds (12c): they draw in
  // the straight pipeline, so FLAG_CURVED stays clear
  const curvedStream =
    kind !== CURVE_STRAIGHT &&
    kind !== CURVE_HAYSTACK &&
    kind !== CURVE_TRIANGLE;

  if (curvedStream) {
    gs.curvedEver = true;
  } // gates the curved pipelines
  gs.setFlag(GROUP_EDGES, slot, FLAG_CURVED, curvedStream);
  // compound loops (14.10) are box-bounded: their excursion tracks the
  // (live) node sizes, so no frame constant alone can bound the chord
  gs.setFlag(GROUP_EDGES, slot, FLAG_CURVED_BOX, kind === CURVE_CMPD);
}

/**
 * The CurveIndex's write sink for blob-backed kinds (12b): store the
 * record in the blob, the header [offset, dev, n, kind] in the params
 * column, and the curved/box flags.  `dev` is the conservative chord
 * deviation (max|d|); `box` marks kinds no chord bound covers (taxi,
 * extrapolated weights) for the AABB cull branch.
 */
export function setCurveParamsBlob(
  gs: GraphStore,
  slot: number,
  kind: number,
  values: ArrayLike<number>,
  n: number,
  dev: number,
  box: boolean,
  endptPct: number = 0,
): void {
  const arr = gs.edges.column(COL.EDGE_CURVE_PARAMS) as Float32Array;
  const at = slot * 4;
  const offset = gs.blob.write(slot, values);

  if (dev > gs.curveDevMax) {
    gs.curveDevMax = dev;
  }
  if (box) {
    gs.hasBoxCurves = true;
  }
  if (endptPct > gs.endptPctMax) {
    gs.endptPctMax = endptPct;
  }

  arr[at] = offset;
  arr[at + 1] = dev;
  arr[at + 2] = n;
  arr[at + 3] = kind;
  gs.geoEpoch++;

  gs.dirty.mark(COL.EDGE_CURVE_PARAMS, slot);
  gs.curvedEver = true; // every blob-backed kind is curved-stream
  gs.setFlag(GROUP_EDGES, slot, FLAG_CURVED, true);
  gs.setFlag(GROUP_EDGES, slot, FLAG_CURVED_BOX, box);
}
