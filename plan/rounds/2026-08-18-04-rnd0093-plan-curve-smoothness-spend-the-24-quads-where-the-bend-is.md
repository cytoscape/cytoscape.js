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

