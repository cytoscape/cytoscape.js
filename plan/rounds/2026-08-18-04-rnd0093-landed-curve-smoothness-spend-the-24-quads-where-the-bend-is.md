## Curve smoothness: spend the 24 quads where the bend is

The maintainer: some curved edges render as visible chord chains
while bundled beziers are smooth.  Reproduced and mechanism pinned:

1. **Every curved edge is one strip of `CURVE_SEGS = 24` quads**
   (`src/curve-geometry.mts:55`; indexCount 6×24 per instance,
   `src/render/cull.mts:803`), evaluated in the vertex shader.
2. **The analytic families spend all 24 on one curve.**  Bezier,
   loop and compound loop sample `curvePoint(g, idx/24)`
   (`src/render/shaders.mts:3130-3160`) — 24 chords per quadratic,
   smooth at any sane zoom.  That is exactly the "bundled beziers
   look smooth" observation.
3. **The route families split the same 24 uniformly across
   pieces.**  `quadPieceW` (`shaders.mts:947-964`) hands each piece
   ⌊24/pieces⌋ or so subdivisions regardless of what the piece is;
   round-segments spends `2n+1` pieces for `n` interior points
   (`routePieceCountW`, :939-943), round-taxi similarly.  A
   radius-50 arc therefore gets 3–8 chords while pixel-straight legs
   — which need exactly 1 — consume the rest.  Measured on the
   parity page: a round-taxi radius-50 corner at zoom 3 renders as
   ~6 visible facets in v4 beside v3's perfect arc.  The unbundled
   bezier (MULTI, C1 spline through inserted midpoints, :967-985)
   has the same shape of problem at 24/n chords per quadratic piece.
4. v3 has no such budget — canvas `arc()`/`quadraticCurveTo()` are
   analytically rasterized — so every chord is a v4-only artifact,
   and the round-56 close-up tier is where it shows (AA does not
   scale with zoom; chords do).

### 93.1 — curvature-weighted subdivision allocation

The recommended fix spends the existing budget instead of raising
it: `quadPieceW` weights pieces by **bend** — an arc piece by its
sweep angle, a multibezier piece by its control's deviation from the
chord, a straight leg exactly 1 quad — normalized to the same 24.
Zero new vertices, a few extra ALU in a shader whose loop already
walks all 24 subdivisions for dash length (:3152-3159).  The
allocation must stay **canonical per vertex index** (both quads
sharing an index compute identical geometry — the watertight rule
the strip already lives by), which it is, being a pure function of
the route params.  Sagitta check at the budget: a 90° arc given 20
of 24 chords has max chord error r(1−cos 2.25°) ≈ 0.0008 r — at
radius 50, zoom 4, dpr 2: 0.3 device px.  Invisible; no budget raise
needed for arcs.  The unbundled spline's worst case (few controls,
deep bend) gets the same treatment and is measured, not assumed.

**Every consumer of the subdivision map moves in the same commit** —
the co-signed rule applied to geometry: the CPU flatten twin
(`curve-geometry.mts:504` — "a CPU flatten at the same K", used by
bounds and picking), the route-family layer VS (`vsCurvedLayer`),
the dash arc-length loops, and the curved-arrow placement
(`curved-arrow-pipeline.mts:259`).  A spec pins CPU-flatten ==
GPU-vertex at every index over a fixture of every family (the
existing twin-parity shape).

### 93.2 — the budget itself, priced

If 93.1 leaves a family visibly faceted (candidates: many-point
round-segments, where 2n+1 pieces at n=11 leaves ~1 chord per arc),
the follow-up is raising `CURVE_SEGS` — priced first: vertex count
is linear in drawn curved edges, so `benchmark:renderer` on the
curve-heavy scenes and `benchmark/curves.mjs` decide 24→32/48, and
the number is chosen by measurement, not taste.  A zoom-adaptive
indexCount (the indirect args are written per frame) is recorded as
the further step and deliberately not taken until a real scene needs
it — it couples the cull pass to zoom in a way nothing else does.

**Verified by** close-up parity scenes (round 56 rules: short edges,
zoom 3–4, and **count the corners** — several bends per edge) for
round-taxi, round-segments and unbundled-bezier, with controls
(allocation reverted to uniform must jump each scene past its
bound); the twin-parity spec above; goldens that touch curved edges
regenerate (exact goldens — read the diffs).  The v3-default and
edge-types harness pages get driven per the standing rule.

### Risks named at planning

- The subdivision map is load-bearing for **dashes** (u runs along
  the polyline) and **mid-arrow placement**; both must be asserted
  in the parity scenes, not assumed unaffected — a dash pattern that
  breathes when allocation changes is the regression to catch.
- Piece boundaries must still land exactly on subdivision indices
  (straight legs stay pixel-straight); the weighted allocator keeps
  the integer-boundary construction, only the shares change.
- WGSL edits follow the house rules (tagged literals, no
  interpolation in comments); the routing numbers must not move at
  all — `routing.spec.js` is the control that costs nothing.

**Open:** the bend metric for multibezier pieces (sweep-angle proxy
vs flattened-length ratio — decide by which keeps the allocator
branchless); whether haystack/straight-triangle need anything (no —
they are straight by construction); whether 93.2 runs at all
(measure after 93.1).

### Landed (2026-08-28)

**93.1 landed as planned; 93.2 was measured, deferred to a hardware
session, and then priced and taken at 32** (below).  The open bend metric resolved to the **sweep-angle
form for both families**, which is what keeps the allocator
branchless: an arc piece weighs its sweep (π minus the interior angle
between its legs — `atan2(|cross|, -dot)`; the radius scales the arc,
never the sweep, so the clamped-`lenOut` case needs no branch), a
multibezier piece the turn between its control legs (`atan2(|cross|,
dot)` — a quadratic's tangent rotates monotonically from `c - a` to
`b - c`), a straight leg zero.  Haystack and straight-triangle
confirmed needing nothing — straight by construction, they never
enter the curved stream.

**93.1, as shipped.**  `allocRouteQuads` / `allocRouteQuadsW` give
every piece one mandatory quad and split the leftover proportionally
to the bend weights by cumulative floor, so the map stays monotone,
every piece keeps ≥ 1 quad, and every piece boundary still lands
exactly on a subdivision index — the integer-boundary construction
the plan required, only the shares changed.  A no-bend route (sharp
polylines) keeps a uniform split.  The map is a pure function of the
evaluated route, so it is canonical per vertex index (watertight);
`routeQuadPiece` / `quadPieceW` read it and `routeVertex` /
`routeVertexW` route through them, which is how every consumer moved
in one commit: the CPU flatten (bounds, box selection, CPU pick), the
strip VS, `vsCurvedLayer`, and the dash arc-length loops — the dash
coordinate is the same polyline's accumulated chord length.  The
curved-arrow and label stages never read the map (end tangents run
from route points; mid anchors through the analytic
`routeMidpointW`), so they skip the alloc — on the GPU the map is
built once per invocation by the two entry points that subdivide, on
the CPU lazily on first read with `evalRoute` invalidating, because
the evaluators share scratch instances.  One surprise worth the
record: the very first symmetric fixture (two equal corners) landed
the split's floor argument exactly on an integer, where f64/f32
rounding noise decides 10-vs-11 — a 1e-4 nudge before the floor keeps
exact ties deterministic across the twins.  Cost, measured: the alloc
is ~95 ns per route eval on the CPU (0.6% of one 25-vertex flatten;
micro-measured through tsx, so a relative figure only), and on the
GPU one `atan2` per bent piece once per invocation plus an integer
scan per `quadPieceW` — in a vertex stage that already walks all 24
subdivisions through per-corner `atan2`/`asin` for dash length.

**Verified by** the three tiers the plan named, every control run and
failed on cue.  The Node allocator suite runs over a fixture of every
family: boundaries on indices, ≥ 1 quad per piece and the budget
spent exactly, straight legs pinned at one quad, a deeper corner
out-weighing a shallower one, scratch invalidation, non-default
subdivisions, and the plan's own sagitta check made an assertion — a
radius-50 round-taxi corner flattens within 0.05 model px of the true
circle (22 chords measure 0.032; the uniform split's 8 measure 0.24,
failing 5×).  The dash risk is pinned in the same file: the arc's
flattened length must sit within 0.05 model px of r·sweep (weighted
0.03 short, uniform 0.12 — 2.4× past the bound).  The control —
allocation reverted to uniform in both twins — fails exactly those
five specs plus the dash spec and nothing else.  In the browser,
`parity-closeup-bends` frames one large-radius corner per family at
zoom 3 (the maintainer's radius-50 round-taxi case among them) and
measures **0.004%** against v3, with the uniform control at
**0.099%** — a 25× jump, failing the 0.03% bound by 3.3×.  Its first
draft is a recorded lesson: following the close-up tier's short-edges
rule literally (whole short edges, radius 10–12) measured 0.006% fix
and 0.005% control — sub-half-pixel facets, a scene that
discriminated nothing; the short-edges rule keeps arrow *ends* in
frame, and what this scene has to keep in frame is the arc.
`routing.spec.js` ran as the free control: 28 green, no routing
number moved.  **One golden moved** — `segments-families`, the one
golden drawing round-segments, by 2 px past threshold (0.002%); the
diff was read before regenerating and is confined to the rounded
routes' arcs.  The harness pages were driven per the standing rule
(`edge-types`, `v3-default`, plus zoomed fits onto the round-taxi and
round-segments corners): clean arcs, no facets, no device errors.

**93.2, priced and taken (2026-08-28).**  The deferred raise ran on
hardware: `benchmark:renderer --scene gen-25k-curved` on this box's
RX 580 — the adapter line reads `adapter: amd gcn-4 · dpr 2 ·
1280×800 · render scale pinned to 1` (RADV, the round-0 validation
box; the earlier "SwiftShader-only" reading came from an ad-hoc
launch flag the harness never passes).  Measured at 24 / 32 / 48
(device = timestamp-query GPU-pass p50 on the 25k × 50k curved
scene; probe = the 5-corner round-segments zigzag above, diffed
against v3 on parity.html with pixelmatch 0.2 — SwiftShader there,
deliberately, it is a pixel probe):

| segs | probe          | device fit-all / far-zoom / zoomed-in | wall p50 | curves.mjs cold read |
| ---- | -------------- | ------------------------------------- | -------- | -------------------- |
| 24   | 0.384% (461px) | 9.64 / 9.64 / 3.83 ms                 | 16.7 ms  | 30.1 ms (1.90×)      |
| 32   | 0.003% (4px)   | 13.19 / 14.14 / 3.78 ms               | 16.7 ms  | 40.1 ms (2.57×)      |
| 48   | 0.000% (0px)   | 25.71 / 26.62 / 4.05 ms               | 33.2 ms  | 44.8 ms (2.75×)      |

**The number is 32**, not the 48 the deferral's arithmetic favoured:
that arithmetic estimated ~1.2 device px of sagitta left at 32, and
the measured probe overrules it — 4 of 120,000 pixels differ, the
chorded crests gone.  48's price is real and superlinear (×2 the
segs costs ×2.7 the device time — the dash arc-length loop is
O(segs²) per edge) and lifts the scene's wall time off the vsync
floor to two frames (33 ms), for no measurable gain over 32.  Init
is flat (156/155/154 ms) and the zoomed-in pass is culling-bound,
not segs-bound; the CPU premium moves with the flatten as expected
(cold first-read 30 → 40 ms, `elementsInBox` 3.60× → 3.81×) and the
warm rows hold.  Landed with the constant: the three specs that
hardcoded 24-derived subdivision indices now derive them from
`allocRouteQuads`/`segEnd` (plus the odd-count Q(0.5) index as
CURVE_SEGS / 2), so the suite holds at any budget — the
uniform-allocation control still fails six specs, the generalized
corner-join among them — and the radius-50 sagitta / dash arc-length
bounds only tightened (0.017 px and 0.009 short at 32, both well
under the 0.05 bounds, with a uniform split still failing both).
Twelve goldens moved, every one a curved-edge scene; each diff was
read before regenerating and is confined to the curved ink
(chord-position and dash-phase shifts along beziers, loops and round
corners).  `parity-closeup-bends` held and `routing.spec.js` ran 28
green — no routing number moved.  The zoom-adaptive indexCount
remains the recorded further step, deliberately not taken.
