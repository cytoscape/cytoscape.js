## Landed (round 12b — unbundled bezier + segments + taxi, 2026-07-30/31)

Pass 12b of the round-12 plan above, under the round-10 process rules.
Items landed CPU-first; each entry below was written in the commit that
landed it.  **Round 12b is complete**: props, blob storage, per-edge
derivation, accessors, exact bb, render, cull, pick, arrows, labels,
box selection, goldens, live v3 parity and benchmarks all landed —
final tallies in the goldens/parity entry at the end.

- [x] **`node.outerHalf` derived column — the 12b binding budget.**
  The curved-edge/curved-arrow/edge-label vertex stages all sat at
  WebGPU's base 8-storage-buffer budget after 12a, leaving no slot for
  the variable-length curve **param blob** 12b needs (segment/control
  lists can't fit the fixed f32×4 params column).  The fix is a derived
  column: `node.outerHalf` = size/2 + borderWidth/2 per axis (v3's
  outerWidth/outerHeight frame), written through by the store on every
  node size/border write, never by the style engine.

  The four
  boundary-consuming shaders (curved edge, straight + curved arrows,
  edge labels) bind it in place of the size + border pair — one binding
  freed in each — and `GraphStore.curveEvalAt` reads the same column,
  so the CPU twin and the WGSL consume identical f32 half-extents by
  construction.

  Two side effects, both improvements: the 12a
  **border-exclusive curved-arrow deviation is gone** (tips sit on the
  border-inclusive outer boundary, like straight arrows — the
  curved-arrows golden uses border 0, so goldens are unchanged), and
  border writes now invalidate the pick-tile cache through the derived
  column's span (`node.borderWidth` itself is pick-neutral, but
  borders move curved pick geometry — a latent 12a gap).  Node specs
  cover the write-through and its dirty span.
- [x] **CPU route geometry** (`curve-geometry.mts`): the CPU half of
  the dual-impl discipline for the three 12b families.  `evalRoute`
  computes the interior route points — unbundled-bezier controls and
  segment points from v3's weighted-frame + perpendicular-offset
  formulas ('intersection' and 'node-position' frames, keeping v3's
  quirk that the normal always comes from the intersection frame), and
  the full verbatim taxi routing (auto/explicit directions, percent/px
  turns incl. negative = from-target, min-distance clamps with the Z-
  and L-shape fallbacks, node-body offsets, the forced-direction
  growth case) — plus boundary endpoints toward the first/last route
  point.

  `computeCorner` is v3's `getRoundCorner` as a pure function
  (spec-pinned *directly against* `v3/src/round.mts` output across
  windings, arc- vs influence-radius, limit clamps and collinear
  corners).

  The drawn strip stays one indirect draw of CURVE_SEGS
  quads for every family: `quadPiece` maps subdivision indices onto
  route pieces (multibezier: one C1 quadratic per control through
  inserted midpoints; polylines: legs, with corner arcs interleaved
  when round) such that **piece boundaries land exactly on subdivision
  indices** — legs stay pixel-straight and corners exact regardless of
  quad distribution.  That requires pieces ≤ CURVE_SEGS, so interior
  counts are capped (`MAX_MULTI_CTRL` = 8 controls, `MAX_CURVE_PTS` =
  11 segment points — a recorded deviation from v3's unbounded lists;
  derivation clamps with a warning).

  `routeMidpoint` ports v3's
  label-anchor/autorotate rules per family (even/odd counts, the round
  arc-apex case with its arc tangent).  Contract: `CURVE_MULTI`/
  `CURVE_SEGMENTS`/`CURVE_TAXI` kinds + `FLAG_CURVED_BOX` (taxi
  routes — and weight-extrapolated routes — are not chord-bounded, so
  kernels without a params binding will cull them against the endpoint
  AABB grown by slack + chord length).  33 Node specs
  (`test/curve-routes.mjs`).
- [x] **The curve param blob** (`store/curve-blob.mts`).  Blob-backed
  kinds store their variable-length records in one f32 pool the
  renderer mirrors as a storage buffer; the params column holds the
  header `[blobOffset, dev, n, kind]` — no column-layout change, and
  records are position-independent, so drags/layouts/tweens still cost
  zero blob traffic.  Record layouts (multi: mode + d/w pairs;
  segments: mode + round + d/w/r/arc quads; taxi: 8 fixed floats) are
  documented in the module.

  Storage behaviour follows the round-11
  slot-stable policy: append allocation with per-slot ranges,
  same-length rewrites in place, freed ranges metered, and automatic
  compaction past waste > half live (256-float floor) — a compaction
  rewrites records in slot order and reports moves so the store
  rewrites the header offsets as normal column spans (geometry
  unchanged, so the bb memo epoch is untouched).

  `StoreDelta` gains
  an optional `curveBlob` span/resized entry and `ModelView` exposes
  `curveBlob()`/`curveBlobLength()`; `GraphStore.setCurveParamsBlob`
  writes record + header + FLAG_CURVED/FLAG_CURVED_BOX, feeds the
  monotone dev/box maxima behind `curveSlack()`, and fixed-kind writes
  release any blob record the slot held.  10 Node specs
  (`test/curve-blob.mjs`).
- [x] **Style props + per-edge derivation.**  `curve-style` gains the
  five 12b keywords; the full prop surface (`control-point-distances`/
  `-weights`, `segment-distances`/`-weights`/`-radii`, `radius-type`,
  `edge-distances`, `taxi-direction`/`taxi-turn`/
  `taxi-turn-min-distance`/`taxi-radius`) parses with v3 defaults,
  list props accepting arrays or space-separated strings, and
  stored-truth readback (lists as space-separated strings, percent
  turns as percent strings).  Scalars/enums are mapper-capable;
  **list props are constants-only** (recorded scope note).
  `edge-distances: 'endpoints'` throws until 12c.

  The CurveIndex
  derives blob records **per edge** (the 12b families never bundle):
  v3's min(dists, weights) count rule, last-radius/type repetition,
  the weight clamp to [-1, 2] with out-of-[0, 1] weights marking
  FLAG_CURVED_BOX, taxi always box-bounded, and the interior-count
  caps.  Pair interplay pinned: blob-family members never join nor
  get clobbered by bezier bundle re-derivations, and a blob edge
  restyled to straight resets through the per-slot pending path (the
  pair map is bezier-lazy and may not exist).

  Loops: unbundled
  families take `control-point-distances[0]` as the loop distance
  (v3), step-size fallback when unset; segments/taxi loops keep the
  12a all-loops-render-as-loops deviation.  Conservative-bb call
  sites (store scan + `boundingBoxAt`) use the header deviation, with
  box-bounded edges adding the node-half margin (+ chord length for
  extrapolated weights).  26 Node specs
  (`test/curve-derivation.mjs`); one 12a spec updated (the
  keyword-throw now pins `haystack`).
- [x] **Route accessors + the exact lazy bb.**
  `GraphStore.curveRouteAt` is the route twin of `curveEvalAt` (which
  now correctly returns null for blob kinds instead of misreading
  their headers as bezier params): blob record + live
  positions/outerHalf/shapes → the evaluated `CurveRoute`.

  On top of
  it: **`segmentPoints()`/`renderedSegmentPoints()`** (v3's
  getSegmentPoints — defined for segments *and* taxi, whose derived
  routing points read back; undefined otherwise), `controlPoints()`
  extended to the unbundled-bezier control list (segments/taxi stay
  undefined, v3's split), `midpoint()` via the per-family
  `routeMidpoint` rules, `source/targetEndpoint()` as the route's
  boundary endpoints, and `curveBBAt` flattening routes at the drawn
  subdivision into the same epoch-memoized exact-bb cache.  12 Node
  specs (`test/curve-route-accessors.mjs`) pin hand-derived
  geometry incl. the taxi bb and memo invalidation on moves.
- [x] **Renderer: the route WGSL twin, blob mirror and box cull.**
  `ROUTE_WGSL` mirrors the CPU route evaluator step for step — the
  frame, the full taxi routing, `computeCornerW` (getRoundCorner), the
  piece allocator and `routeVertexW`/`routeMidpointW` — reading the
  same blob the CPU reads, mirrored by ColumnMirror as one storage
  buffer under the usual span/realloc rules (`delta.curveBlob`; a
  realloc bumps `mirror.version`, so bind groups rebuild).  The curved
  edge VS binds the blob as its 7th vertex buffer (back at exactly the
  8-buffer budget) and branches per kind: bezier/loop keep the 12a
  analytic path byte-for-byte (goldens stable), route kinds evaluate
  `routeVertexW` at their subdivision index with **discrete miter
  normals** from the neighbouring indices — exact miters at sharp
  polyline corners (v3's canvas join, extrusion scaled 1/cos(θ/2),
  clamped at 6), chord-normals elsewhere, canonical per index so the
  strip stays watertight; extruding along the miter keeps the
  perpendicular half-width exact, so the FS's AA is unchanged.  Dashes
  keep the chord-sum arc length over the drawn polyline.  The curved
  cull kernel branches on FLAG_CURVED_BOX to the endpoint-AABB test
  grown by slack + chord length (taxi and extrapolated weights are not
  chord-bounded); the edge-glyph cull grows its anchor test the same
  way for box owners.  The pick tile draws the same strips, so pick
  coverage equals pixels for every family — spec-pinned.  4 new
  `webgpu` Playwright specs: segments polyline + ≤64 B re-route on
  drag, taxi axis-aligned legs + leg-vs-diagonal picking,
  round-segments corner-cutting vs the sharp corner (and the arc-apex
  midpoint), and the unbundled-bezier S through its inserted midpoint
  with a clear mirrored band.  All 66 Playwright specs green; 12a
  goldens byte-stable through the shader restructure.
- [x] **Arrows + edge labels on routes.**  The curved-arrow insight
  generalizes: a route's end tangent runs from the first/last interior
  route point to the boundary endpoint, so the arrow is the straight
  arrow math with that point substituted (taxi arrows ride the final
  axis-aligned leg).  Budget: the curved-arrow vertex stage needed the
  blob, so this end's arrow *colors* moved to the fragment stage — the
  VS no longer collapses no-arrow ends to degenerate quads (they
  rasterize a small fully-transparent quad instead; the frame uniform
  now binds V|F for edgeDim).

  Edge labels of route edges anchor at
  `routeMidpointW` in the VS, and autorotate takes the midpoint
  tangent as its frame (v3's per-family disp rules) — both zero
  rebuild, both spec-pinned: taxi arrows purple on the final leg (and
  no ink on the chord diagonal), segments labels at the route midpoint
  with a ≤64 B re-anchor on drag.  68/68 Playwright specs; the 12a
  curved-arrows golden is byte-stable through the fragment-stage
  color move.
- [x] **Box selection: the curve-endpoint upgrade** (the revisit
  deferred from 12a).  `refsInBox` now tests a curved edge's *curve
  boundary endpoints* — exactly v3's on-boundary 'contain' rule, via
  the full-family CPU evaluator (curveEvalAt / curveRouteAt); straight
  edges keep the endpoint-center approximation (recorded deviation).
  2 new Node specs (segments and taxi containment, incl. the
  cut-the-launch-point miss cases).
- [x] **Goldens, live v3 parity and the benchmark check.**  Three new
  golden scenes — `unbundled-bezier` (S-splines across orientations, a
  dashed run, the unbundled loop), `segments-families` (sharp miter
  vs radius-18 round corners on the same zig-zag lists, a vertical
  round run, dashes riding legs) and `taxi-families` (auto/explicit
  directions, px and percent turns, round-taxi corners, arrows on the
  final legs, the forced-direction growth case) — byte-stable across
  repeat runs.

  One combined **live v3-parity scene** covering all
  five families measured **0 differing pixels** at 8 px strokes (the
  same ink-guarded pixelmatch bound as 12a's parity-curves): the
  route geometry lands identically on both renderers; the known
  miter-vs-round join difference is absorbed by AA classification.
  Renderer benchmark re-run on the same box (RX 580, dpr 2, scale 1):
  the 12a curved scene's device times are unchanged (fit-all pan
  8.61 vs 8.6 ms, zoomed-in 3.81 vs 3.8, far-zoom 6.18 vs 6.4) — the
  route branch and blob binding cost the bezier path nothing
  measurable; wall clock stays vsync-bound at 16.7 ms while v3 canvas
  runs ~670 ms/frame on the same scene.

  Final tallies: 1793 Node +
  60 module tests, 72/72 Playwright specs (6 new `webgpu`, 3 new
  goldens + 1 new parity in `visual`), typecheck + lint clean.
