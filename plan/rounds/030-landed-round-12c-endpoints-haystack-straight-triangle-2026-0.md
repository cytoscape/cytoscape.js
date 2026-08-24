## Landed (round 12c — endpoints + haystack + straight-triangle, 2026-07-30/31)

Pass 12c of the round-12 plan above, under the round-10 process rules.
Items landed CPU-first; each entry below was written in the commit that
landed it.  **Round 12c is complete**: props, derivation, accessors,
exact bb, render, cull, pick, arrows, labels, box selection, goldens,
live v3 parity and benchmarks all landed — the round-12 curved-edges
plan (12a/12b/12c) is done.

- [x] **Contract + CPU geometry: endpoint blocks, haystack, triangle**
  (2026-07-30).

  Three additions to the curve contract:
  `CURVE_HAYSTACK` and `CURVE_TRIANGLE` are *straight-stream* kinds
  (FLAG_CURVED stays clear — haystack rides the straight pipeline and
  its far-zoom decimation, resolving 12a's "curved stream is never
  decimated" revisit by construction), and `CURVE_HAS_ENDPT` flags a
  blob-backed kind (MULTI/SEGMENTS/TAXI) whose record is prefixed by a
  fixed 10-float **endpoint block** —
  [mode, a, b, pctBits, dist] × 2 — resolving `source/target-endpoint`
  and `source/target-distance-from-node`.  Modes are v3's edgeEndpoint
  forms (outside-to-node default, inside-to-node, outside-to-line,
  point with per-component %/px units, angle with the 12-o'clock start
  folded in at parse time); distances shorten via v3's
  `shortenIntersection` clamp rule.  Structural calls, recorded in the
  geometry module doc: a *straight* edge with manual endpoints derives
  as `CURVE_MULTI n = 0` (the route degenerates to the chord between
  the resolved endpoints — `routeVertex`/`routeMidpoint` already
  handle it), and a *bundled bezier* with manual endpoints promotes to
  `CURVE_MULTI n = 1` (its control formula is identical — pinned by a
  spec against the 12a analytic path).  `edge-distances: 'endpoints'`
  re-bases the frame on the raw manual anchors with v3's
  recalcVectorNormInverse normal.  Haystack endpoints are
  `center + (cos/sin(angle) · outerHalf · radius)` with **hash-stable
  angles from the edge's id hash** (deterministic across sessions and
  machines — v3 uses Math.random(), so haystack scenes are only
  statistically v3-comparable; v4 also scales by outer halves where v3
  uses inner size — identical at border 0, recorded).  17 Node specs
  (`test/curve-endpoints.mjs`) pin the block resolution, the
  n = 0 chord, the bezier-promotion equivalence, the endpoints-frame
  rebase, taxi distances, and the haystack point/angle math.
- [x] **Style props + derivation** (2026-07-30).  `curve-style` gains
  `haystack` | `straight-triangle`; new edge props `haystack-radius`
  (validated [0, 1], v3 default 0), `source/target-endpoint`
  (keyword | 'x y' point with per-component %/px units | angle as
  deg/rad string or plain radians; the `-or-label` keywords throw —
  no label bb in v4), and `source/target-distance-from-node`
  (non-negative).  `edge-distances: 'endpoints'` parses; derivation
  enforces v3's both-ends-manual rule and falls back to intersection
  with v3's warning otherwise.

  Scalars (`haystack-radius`, the two
  distances) are mapper-capable; the endpoint props are
  constants-only (the point form is a list — the 12b scope rule).

  Derivation (CurveIndex): haystack derives per edge into the
  straight-stream params (id-hash angles via the store's blob-native
  id hashes, so two loads of the same graph derive identical
  haystacks); triangle likewise; any edge with a non-default endpoint
  spec derives its blob record with the 10-float block prefix and the
  kind flag — straight → MULTI n = 0, bundled bezier → promoted
  MULTI n = 1 (derivePair consults the spec; the odd-middle/lone
  rules produce endpoint chords), taxi → modes forced default (v3's
  keyword override) with distances kept, dropping the flag when
  nothing remains.

  Cull soundness: px point offsets fold into the
  record's header deviation; pct offsets are measured in node-half
  units — ≤ 1 is covered by the slack's node-half term, > 1 marks the
  edge FLAG_CURVED_BOX and feeds a new monotone `endptPctMax` term in
  `curveSlack()`; `haystackSlack()` (radiusMax × node half) is the
  bound the *straight*-stream cull tests will grow by in the renderer
  item.  Haystack styling also suppresses arrows at the style layer
  (v3 draws none; stored-truth arrow getters read 'none' — recorded),
  and `refsInBox` tests haystack offset points (v3's haystackPts).

  Readback: `curve-style`/`haystack-radius` off the styled record;
  endpoints as canonical strings (keywords, 'x y' with % suffixes,
  `'<rad>rad'` angles); distances as numbers.  21 Node specs
  (`test/curve-12c-derivation.mjs`); two 12b-era specs updated to
  the new surface (haystack/edge-distances no longer throw).  1831
  Node tests, typecheck + lint green.
- [x] **Accessors + exact bb** (2026-07-30).  Haystack edges answer
  `sourceEndpoint()`/`targetEndpoint()` with their offset points
  (v3's haystackPts), `midpoint()` with the offset-point average
  (v3's rs.mid), and `boundingBox()` with the exact offset-point
  span; endpoint-flagged route kinds flow through `curveRouteAt`
  automatically, so manual-endpoint edges answer every accessor —
  resolved endpoints, chord midpoints, the promoted bundled bezier's
  control point, distance shortens on taxi — off the shared route
  evaluator, and the exact lazy bb covers manual endpoints outside
  the chord with the usual epoch-memoized invalidation.

  `controlPoints()` returns undefined for the straight-with-endpoints
  chord (MULTI n = 0 — no controls, matching v3's straight surface).
  11 Node specs (`test/curve-12c-accessors.mjs`); 1842 Node
  tests, typecheck + lint green.
- [x] **Renderer: straight-stream kinds, endpoint WGSL twins, cull
  slack** (2026-07-31).  The straight edge shader restructured: paint
  columns (line color / opacity / line-style) moved to the *fragment*
  stage via flat instance fetch (the curved pipeline's split), freeing
  vertex slots for `edge.curveParams` + `node.outerHalf` +
  `node.shape` — 6 VS storage buffers + the visible list.

  The VS
  branches on the straight-stream kinds: haystack offsets both
  endpoints by (cos/sin(angle) · outerHalf · radius) from live
  positions (drags follow on-GPU), and straight-triangle computes
  boundary endpoints and tapers the half-width to zero at the apex
  (the FS's varying half-width keeps the AA exact; dashes skip
  triangle fills, v3's fill path; the pick FS inherits the taper, so
  picking matches the drawn triangle).

  ROUTE_WGSL gained the
  endpoint-block twins (`rawEndptAnchorW`/`resolveEndptW`, the
  kind-flag strip, the n = 0 chord aims, and the
  `edge-distances: endpoints` frame rebase) — the label VS's route
  branch and the curved pick tile inherit them; route arrows now
  anchor at the route's *resolved* endpoint (q[0]/q[n+1] — for
  default modes exactly the old boundary point, for manual endpoints
  v3's arrowStart/End), aiming along the end tangent (the far
  endpoint for the n = 0 chord).  The edge-label VS anchors haystack
  owners at the offset midpoint with autorotate along the offset
  line.  The Frame uniform grew 48 → 64 bytes with `haystackSlack`
  (radiusMax × node half, monotone): the straight-edge cull and the
  edge-glyph cull grow their corridor/anchor tests by it, so haystack
  never culls wrong while staying decimated like any straight edge.
  4 new `webgpu` Playwright specs (haystack offset line + pick,
  triangle taper + taper-matched picking, manual endpoints off the
  chord + ≤ 64 B drag re-anchor, arrows at a shortened endpoint with
  the gap behind them) — 54/54 `webgpu`, 22/22 `visual`
  (goldens byte-stable through the shader restructure, parity scenes
  0 px), 1842 Node tests, typecheck + lint green.
- [x] **Goldens, live v3 parity and the benchmark check**
  (2026-07-31).  Three new golden scenes — `haystack` (8 edges at
  radius 0.9; the id-hash angles make the scene deterministic across
  machines, which is what lets a haystack golden exist at all),
  `straight-triangle` (three orientations + an arrowed apex) and
  `manual-endpoints` (a px point source end, an angle target end, a
  source distance and an unbundled bezier under
  `edge-distances: endpoints`) — stable across repeat runs.

  Three
  new **live v3-parity scenes**, all measuring **0 differing
  pixels** at 8 px strokes: `parity-endpoints` (the same endpoint
  config across orientations — v3's shorten matches v4's dist rule
  exactly at arrow gap 0), `parity-triangle`, and
  `parity-haystack0` — haystack at radius 0 pins the haystack
  *pipeline* against v3 exactly (both sides collapse to
  center-to-center lines); radius > 0 has no exact v3 parity by
  construction (v3 seeds with Math.random()), which the
  deterministic golden covers instead — the recorded deviation.

  Renderer benchmark re-run (same box, RX 580, dpr 2, scale 1):
  device p50s unchanged from the 12b record — straight gen-25k
  fit-all/zoomed/far 3.34/4.40/1.26 ms (was 3.3/4.4/1.2), curved
  8.61/3.81/6.30 ms (was 8.6/3.8/6.4) — the paint-to-FS restructure
  cost nothing measurable, and far-zoom haystack rides the straight
  stream's decimation by construction (the 12a revisit closed).
  Final tallies: 1842 Node + 60 module tests, 54/54 `webgpu` +
  28/28 `visual` Playwright specs (3 new goldens, 3 new
  parity scenes), typecheck + lint clean.  **Round 12c is complete**
  — and with it the whole round-12 curved-edges plan.
