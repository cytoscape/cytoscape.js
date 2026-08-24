## Round 59 plan — the force layout, made sound and made good (raised by the maintainer 2026-08-09)

The maintainer's ask, verbatim in scope: the round-18 force layout "is a
good start, but it gives bad results for large networks at least" — it
"drifts apart too much on large networks making everything super zoomed
out on fit (invisible basically)" — with direction to research what the
field does (COSE, fCoSE, other force-directed libraries, GPU ones like
AntV G6 in particular), to want good compound support, to verify
visually as the work goes, and to write automated tests.

### What measurement says the defect is (2026-08-09, before any design)

The reported symptom reproduces on the first real fixture tried, and it
is not a tuning problem — **the integrator is unstable and the model
diverges exponentially on any graph with hubs or high mean degree**:

- Driving `debug/?network=em-web&layout=force&seed=1` (569 nodes, 6899
  edges, mean degree 24) with a scripted browser ends at a bounding box
  of **3.0e11 x 3.6e11 px** and a fit zoom of **2.3e-9** — a blank
  canvas with the whole graph in one sub-pixel dot, which is exactly the
  report.  `em-web-clustered` (the compound twin, so the CPU executor)
  is worse: **571 of 610 positions are NaN** at layoutstop.
- The CPU reference sim, traced per iteration on synthetic topologies:
  a 500-leaf star, a 5k scale-free (max degree 1092) and a 20k x 465k
  uniform graph (ndex-x-large's density, mean degree 46) each grow
  their max displacement by **one to two orders of magnitude per
  iteration** from iteration 1, reaching 1e30+ px and then NaN.  Low-
  degree graphs (mean degree 4) survive but land badly: mean edge
  length settles at **3.3–6.6x the ideal** and a curled hairball.
- **NaN reads as convergence.**  `maxDisp` starts at 0 and
  `NaN > maxDisp` is false, so a fully-NaN iteration reports
  displacement 0 and the settle counter runs out — the sim exits
  "converged" with every position destroyed.

The mechanism is textbook explicit-Euler instability: a node of degree
k feels total spring stiffness `k · stiffness`, and `pos += F · alpha`
is stable only while `alpha · stiffness · k < 2` — so with the shipped
`stiffness: 0.1` every node past degree ~20 overshoots its equilibrium
and oscillates with growing amplitude.  The ndex fixtures sit at mean
degree 47.  The sim has neither of the two guards every shipping
force layout carries: v3's own cose caps per-node displacement at an
annealed temperature (`limitForce`, 1000 · 0.99^t), and d3's link force
divides spring strength by `min(degree)` and splits the correction by a
degree bias, precisely so hubs cannot destabilise.

Two structural quality limits sit underneath the instability, both
already recorded in round 18's own notes: the repulsion cutoff at one
mean edge length means **no long-range force exists** (Fruchterman &
Reingold's own grid variant, which this is, kept its layout inside a
bounded frame with wall clamping; round 18 removed the walls and kept
the truncation — Hu 2005 names the consequence: "no force to evenly
distribute far away vertices", no cluster separation, curled chains as
legitimate minima), and gravity is the only thing containing
disconnected components, which every surveyed ecosystem solves with
component packing instead (v3 cose: `separateComponents`, 40 px shelf
rows; cose-bilkent/fcose: tiling + polyomino packing; AntV, which has
none, interleaves its components — the cautionary tale).

### What the research found (2026-08-09; two web sweeps)

Condensed to what this round acts on (primary sources, all verified
against papers or shipping source rather than docs: Jacomy et al.
2014 PLoS ONE + Gephi's `ForceFactory.java` for FA2; the cosmos.gl
repo's `ForceManyBody` shaders for the grid pyramid; Hu 2005 for
sfdp's p = 2 and the grid-variant critique; Fruchterman & Reingold
1991; Balci & Dogrusoz IEEE TVCG 2021 + the cytoscape.js-fcose /
cose-base / layout-base sources for the spectral phase and the
compound recipe; d3-force's `link.js`/`simulation.js` for the spring
rule and alpha schedule; this repo's own
`v3/src/extensions/layout/cose.mts` for `limitForce`, per-graph
gravity and
`separateComponents`; Zheng et al. TVCG 2019 (s_gd2), Zhong et al.
TVCG 2023 (t-FDP), Godiyal et al. GD 2008 and cuGraph FA2 as the
surveyed alternatives not taken):

1. **Stability discipline** — d3-force: per-edge spring strength
   `stiffness / min(deg(s), deg(t))`, applied to each end weighted by
   `bias_i = deg(other) / (deg(i) + deg(other))`, which bounds any
   node's aggregate per-tick spring correction at `stiffness` — a
   contraction for stiffness ≤ 1 regardless of topology.  v3 cose /
   FR: per-node displacement capped at an annealed temperature.  Both
   port directly onto the existing gather/apply split.
2. **Long-range repulsion on GPU without pointer trees** — the shipped
   web answer is cosmos.gl v3's **uniform grid pyramid**: mip-reduce
   the binning grid to per-cell monopoles `(count, sum x, sum y)`, then
   per node gather the exact near field from the finest 3x3 plus, per
   coarser level, the aligned **6x6 block refining the parent's 3x3
   minus this level's own 3x3** — every region counted exactly once,
   fixed traversal order (deterministic), every phase an ordinary
   dispatch.  cosmos moved *off* a texture-baked quadtree onto this.
   Hu/sfdp's `p = 2` repulsion exponent (force ~ 1/d^2) is the default
   chosen to limit peripheral over-spread; Hu also measured full
   long-range repulsion at ~21% over the grid cutoff's cost.
3. **Global untangling comes from the seed, not from more iterations**
   — fCoSE's headline: a spectral draft via landmark MDS (BFS hop
   distances from ≤ 25 farthest-first pivots, squared, double-centred,
   top-2 eigenpairs by power iteration), then the force phase runs as
   an *incremental polish* at reduced initial energy.  "Up to 2x as
   fast as CoSE with similar aesthetics" is their measured claim; the
   quality win on trees/meshes is the part this round wants.
4. **Containment** — ForceAtlas2's gravity is *constant-magnitude*
   (`kg · mass`, never decaying), so escape is impossible against any
   decaying repulsion; d3's answer for disjoint graphs is forceX/Y
   (weak springs), never forceCenter; and the final drawn size is
   legitimately a *normalization* question (FR rescaled the finished
   layout into its frame) as much as a physics one.
5. **Compounds** — the whole Bilkent line: children-only integration
   with parents as derived boxes (v4's round-14 rule already), gravity
   per compound toward the owner's centre (v3 cose: constant magnitude
   toward the parent's position; layout-base: dead-zone linear), and
   ideal edge length elevated per nesting level an edge spans
   (`nestingFactor`).  AntV's one good idea is the same thing spelled
   as cluster-centroid gravity, recomputed per iteration.
6. **What not to copy** — AntV's GPU layouts themselves (O(n^2)
   texel-per-node WebGL1 GPGPU, no early termination, no packing, the
   WGSL path shipped empty), and FA2's swinging/traction adaptive
   speed *for now*: it is the best integrator surveyed, but its global
   per-iteration reduction breaks the alpha-window batching that lets
   the GPU encode k iterations per submit with no readback — logged as
   a future direction rather than taken.

A design prototype (scratch, outside the tree) validated the
composition before this plan was written: degree-normalised springs +
a displacement cap + component anchors run the star, the scale-free 5k,
the 20k x 465k and the 489-component 25k cases to **zero NaN and
bounded boxes**; the spectral seed improves the tree's mean edge length
where the cutoff model alone cannot; and the one blow-up the prototype
hit was a degenerate spectral eigenvalue on a many-component graph —
which is why the plan below clamps every component's embedding to its
own radius estimate rather than trusting the spectrum.

### Design calls

1. **The model becomes stable by construction, not by tuning.**
   Springs take d3's rule verbatim (strength `stiffness/min(deg)`,
   degree-bias split, `stiffness` re-read as the dimensionless
   fraction-of-residual corrected per tick, default well under 1); the
   apply pass caps per-node displacement at an alpha-annealed multiple
   of the repulsion range (v3's `limitForce` shape); and convergence
   treats a non-finite displacement as *not settled* (the NaN-reads-
   as-converged hole closes even though the cap makes it unreachable).
2. **Repulsion gains a far field from a pyramid over the existing
   grid** (research item 2), with one smooth pairwise law across near
   and far: force `repulsion · (L/d)^2` per pair (sfdp's p = 2 shape;
   `repulsion` re-read as the push in px/tick at exactly one edge
   length), near field exact over the finest 3x3, far field from the
   per-level monopoles under the 6x6-minus-3x3 refinement scheme.  The
   cutoff falloff `(1 - r/cutoff)^2` and its "repulsion vanishes at the
   rest length" rationale are superseded — the balance point now comes
   from the force law itself.  Both executors implement the identical
   pyramid; the GPU folds `cellStart`/`cellItems`/pyramid into one
   grid buffer, which is also what frees the binding the anchors need.
3. **Placement is component-aware from the start.**  Components are
   computed once at build (union-find over the sim edges); their
   anchors are shelf-packed by estimated radius (largest first, v3's
   row shape); each node seeds around its component's anchor; gravity
   becomes **constant-magnitude toward the component anchor** (FA2's
   containment against a decaying repulsion), so disconnected pieces
   neither interleave nor drift; and a final exact re-pack of the real
   component boxes (v3's `separateComponents`, `componentSpacing`
   default 40) lands at settle on both executors.
4. **The seed is spectral where it can be** (research item 3): landmark
   MDS per component of ≥ 4 nodes — BFS hop distances from up to 25
   farthest-first pivots, off the incident lists the sim already
   builds — with every guard measured in the prototype: eigenvalue
   floors, embedding clamped to the component's radius estimate, and a
   deterministic jitter so coincident embeddings (a star's leaves)
   separate.  `randomize: false` keeps meaning "relax the current
   positions"; a new `init: 'spectral' | 'scatter'` option (default
   spectral) governs what a fresh placement is, so specs and controls
   can still pin the scatter path.
5. **Compounds get the Bilkent recipe's cheap two-thirds** on the CPU
   executor (which already owns compound graphs by the 14.11 lease
   rule): per-iteration gravity toward the owner compound's live
   centroid (`gravityCompound`, constant-magnitude beyond a dead zone),
   and ideal edge length elevated once at build for edges spanning
   compound boundaries (`nestingFactor` per spanned level).  Same-owner
   repulsion partitioning (Bilkent's third leg) is deliberately out:
   it exists there because compounds repel as rectangles, which v4
   does not simulate, and owner gravity plus real repulsion already
   keeps siblings coherent — measured on the clustered fixture before
   this call is final.
6. **The GPU executor stays in lockstep, kernel for kernel** — same
   spring rule (degrees are already in the CSR starts), same cap
   (alpha is already in the meta window), same pyramid, same anchors
   (appended to an existing buffer or the freed slot; the force kernel
   stays at exactly 8 storage bindings).  Trajectories stay not
   bit-agreed (the recorded scatter-order caveat); the 18.4 invariant
   suite widens to a hub-heavy graph that the old model detonates on.
7. **Defaults are retuned by measurement, and the acceptance is
   numeric**: zero non-finite positions on every probe topology; mean
   edge length within a small factor of ideal on trees/rings/meshes;
   bounding box within a small factor of the hex-packed ideal radius;
   the em-web fit zoom back in a human range.  The probe suite from
   this scoping (star, scale-free, dense-uniform, tree, multi-
   component) becomes specs.

Public-surface changes, flagged: `init`, `nestingFactor`,
`gravityCompound` and `componentSpacing` are new options;
`repulsion`/`stiffness`/`gravity` keep their names but their units and
defaults change (documented; the prerelease line has no published
consumers).  `edgeLength`, `seed`, `randomize`, `animate`, `fit`,
`padding`, `stepsPerFrame`, `iterations`, `threshold`, `decay` are
unchanged.

### Pass split (tests-first; docs in-commit; each pass its own commit)

- [x] **59.0 Docs-first** (2026-08-09) — this section; the README
  force-layout section gained the in-flight pointer (replaced by the
  rewritten section when the round closed).
- [x] **59.1 Stability** (2026-08-09) — landed as planned, tests-first:
  five specs (star 300, scale-free 1500 with max degree in the
  hundreds, uniform 600 x 12k at mean degree 40, the NaN-never-settles
  pin, and a hub-spring quality bound) written red against the shipped
  sim — all five failed, three by explosion and one by the
  NaN-reads-as-converged hole stopping a poisoned run at iteration 3.
  The CPU sim gains the d3 spring rule (`stiffness / min(deg)` with
  the degree-bias split; `stiffness` re-read as fraction-of-residual,
  provisionally 0.6), the alpha-annealed displacement cap
  (`cutoff · max(alpha, 0.15)`, clamped at the gather output so both
  executors share it verbatim), and the non-finite settle guard.  The
  force kernel takes the identical spring rule reading degrees off the
  CSR starts it already binds — zero new data crossed to the device —
  and the identical cap; the device side needed no non-finite guard,
  and the reason is recorded in the kernel: a NaN displacement
  bitcasts *above* every finite float in the monotonic-bits ordering,
  so a destroyed iteration reads as a huge displacement and never
  settles.  The 18.4 invariant spec's graph gained a degree-60 hub;
  run as its own control against the pre-fix bundle it **fails** (the
  GPU executor detonates on the hub), and passes with the fix — with
  all 20 Node force specs and the three GPU force specs green against
  a fresh build.
- [x] **59.2 Components + gravity** (2026-08-09) — landed as planned.
  `src/layout/force-init.mts` is the new pure module (union-find in
  first-seen order, the disc-radius estimate, shelf packing in v3
  `separateComponents`' row shape for both the up-front anchors and
  the exact settle re-pack, and the anchor-relative scatter), specced
  in `test/modules/force-init.mjs` including the non-overlap
  guarantee, determinism, and that the re-pack is translation-only
  with the packed field centred where the *largest* component sat —
  the dominant structure holds its place and the strays come to it.
  Gravity became the constant-magnitude anchor pull on both executors
  (`gravity` re-read as px/tick, provisionally 1); the anchors reach
  the force kernel through the **csr buffer's tail** (bitcast f32 at
  `params.anchorBase`, the uniform's former pad slot), so the kernel
  stays at exactly its 8 storage bindings and no ninth crosses the
  budget.  `randomize: false` anchors each component at its own
  current centroid — incremental runs relax in place rather than being
  dragged to a fresh field.  Two public specs, the separation one
  written red first (the round-18 model interleaved the two rings):
  disconnected rings settle into disjoint boxes with strays contained,
  and the settle re-pack is **skipped whenever anything is pinned**,
  since a re-pack translates whole components and a locked node must
  never move (recorded scope note, pinned by spec).  28 Node force
  specs + 3 GPU force specs green against a fresh build.
- [x] **59.3 The far field** (2026-08-09) — landed on both executors:
  one inverse-square law across all pairs (`repulsion · (cutoff/d)²`,
  sfdp's p = 2; `repulsion` re-read as the push at one cutoff length,
  provisionally 1), the near field exact over the finest 3×3, and the
  far field from a monopole pyramid over the binning grid — per level,
  the aligned 6×6 block refining the parent's 3×3 minus the level's
  own 3×3, cosmos.gl v3's shipped scheme.  On the GPU, `cellStart`,
  `cellItems` and the pyramid fold into **one grid buffer**, so the
  force kernel lands at 7 storage bindings with the far field in; two
  new kernels (per-cell aggregate — write-only, so no clear pass —
  and a per-level reduce driven by per-level uniforms built once,
  since the frame is fixed per run).  The law choice was swept in a
  scratch prototype first, whose decisive probe is now a spec: **a
  12×12 mesh seeded at its true grid positions keeps its links near
  ideal** — a model that destroys a good layout cannot be saved by
  any seed.
  Three controls, and two of them were findings.  The CPU
  pyramid-vs-exact spec (one pure-repulsion iteration against the
  exact O(n²) sum — median error < 10%) **fails when the level-0 ring
  is skipped**, which is precisely the coverage bug the prototype's
  first draft had.  The 18.4 invariant spec **failed to fail** with
  the WGSL far field neutered — it does not discriminate the far
  field — so a dedicated GPU spec now does (an unconnected pair five
  cutoffs apart, gravity off, moves strictly apart on the GPU
  executor), and *its* first draft measured the wrong thing too: the
  59.2 settle re-pack placed the two singleton components exactly
  `componentSpacing + 1` apart, reading as motion.  A pinned
  out-of-frame node (the re-pack's own skip rule) isolates the
  physics; with the WGSL loop neutered the spec fails, restored it
  passes.  31 Node force specs + 4 GPU force specs green.
- [x] **59.4 The spectral seed** (2026-08-09) — landed:
  `spectralSeed` in `force-init.mts` (landmark MDS per component of
  ≥ 4 nodes — BFS hop distances from up to 25 farthest-first pivots
  at fCoSE's 1.5·L separation, squared, double-centred, top-2
  eigenpairs by hash-seeded power iteration, LMDS out-of-sample
  embedding), wired as the default fresh placement with
  `init: 'spectral' | 'scatter'` selecting it (unknown values throw;
  `randomize: false` ignores it).  The scatter also went uniform-in-
  *area* (`sqrt(u)` radial draw) — the uniform-in-radius draw piled
  density at the centre, and the seed's density is what the anneal
  budget mostly preserves.
  The guards were where the work was: the first implementation threw
  away a **path's** embedding, because a path's metric is legitimately
  rank-1 (λ₂ = 0) and the degenerate-spectrum guard read that as
  failure — a rank-1 spectrum now embeds on the first axis with the
  jitter as the second dimension, a dead λ₁ keeps the scatter, and a
  spectrum blowup rescales to the component's own hop-diameter extent
  (clamping to the *disc estimate* would have destroyed exactly the
  long thin layouts the seed exists to produce).  K-complete graphs
  (every eigenvalue equal) pin the finite-and-bounded case.
  Measured discrimination on the public path: a 40-node chain ends
  **3208 px** end-to-end under the spectral seed against **346 px**
  under `init: 'scatter'`, with the spec's bound at 936 — the seed
  reaches the configuration no amount of local refinement finds,
  which is fCoSE's headline reproduced.  11 module + 11 layout specs
  green.
- [x] **59.5 Compounds** (2026-08-09) — landed, the Bilkent recipe's
  cheap two-thirds on the CPU executor (compound graphs never take
  the GPU path — the 14.11 lease rule): **owner-centroid gravity**
  (each leaf pulls constant-magnitude toward its direct parent's live
  centroid, recomputed per iteration in ascending order —
  `gravityCompound`, a multiple of `gravity`, default 1.5) and
  **`nestingFactor`** (an edge spanning compound boundaries takes
  `length × levels × nestingFactor`, v3 cose's multiplicative rule,
  levels counted below the lowest common ancestor via the parent
  chains; default 1.2).  Same-owner repulsion partitioning — the
  recipe's third leg — stays out as planned: owner gravity plus real
  repulsion coheres siblings without it, and v4 does not simulate
  parents as rectangles.  Direct-parent centroids only; deeply nested
  coherence rides the nesting-elevated edges (recorded limit).
  **The cohesion spec's first bound could not fail**, which is the
  round-27 lesson arriving on schedule: rms-spread < 0.75 × centroid
  separation passed a plain ring with no compound gravity at all.
  Measured both ways — 0.599 without the pull, 0.421 with it — the
  bound is 0.5, and the control (groups disabled) fails it.  The
  nesting spec was red-first (cross-clique edge settles > 1.5× the
  intra mean).  40 Node force specs green.
- [x] **59.6 Retune + acceptance** (2026-08-09) — the provisional
  defaults survived the probe matrix and are final: `repulsion 1`
  (px/tick at one cutoff length), `stiffness 0.6`
  (fraction-of-residual), `gravity 1` (px/tick constant), with
  `decay`/`threshold`/`iterations` unchanged from round 18.  A
  tuning sweep moved quality the wrong way — raising repulsion
  inflates tangled links faster than it opens spacing, and lowering
  gravity buys no measured link quality — so the sweep's output is
  the confirmation, not new constants.
  The acceptance, measured through the public API (seed 1, defaults):
  | probe | nan | bb | bb/ideal | link/L |
  |---|---|---|---|---|
  | gnm 2k×4k | 0 | 2295×1734 | 1.26 | 3.68 |
  | scale-free 5k | 0 | 1848×1816 | 0.64 | 4.74 |
  | tree 4095 | 0 | 3403×3127 | 1.31 | 2.22 |
  | star 500 | 0 | 395×397 | 0.44 | 2.22 |
  | gnm 1k×23k (dense) | 0 | 659×662 | 0.52 | 4.04 |
  Every probe finite and inside ~1.3× the hex-packed ideal radius,
  against the round-18 baseline of 10³⁰-px explosions and NaN on
  three of the five.  The expander link ratios (3.7–4.7×L) are
  topology-intrinsic — no planar embedding of a random graph has
  short edges — and the tree's 2.22 is the number future quality
  work (multilevel, the logged direction) would move.
- [x] **59.7 Verification + benchmarks** (2026-08-09) — the round's
  before/after, measured in the browser on the scenes the report
  named:
  | scene | before (round 18) | after (round 59) |
  |---|---|---|
  | em-web (569n/6.9k e, GPU) | bb 3.0e11×3.6e11, zoom 2.3e-9 | bb 1774×1486, zoom **0.44**, link 2.1×L |
  | em-web-clustered (compound, CPU) | **571/610 NaN**, zoom 1e-50 | bb 1956×1543, zoom **0.40**, 0 NaN |
  | gen 2k×4k (GPU) | zoom 0.36, link 6.5×L | zoom 0.52, link 3.8×L |
  | ndex-x-large (19.6k×465k, GPU) | explodes (mean degree 47) | zoom **0.76**, converges live in **1.3 s** |
  The screenshots show what the numbers cannot: em-web's clusters
  separated with its small components shelf-packed in rows beneath,
  and the clustered fixture's 41 MCODE compounds cohering inside
  their parent boxes.  Full verification: the entire Node tier
  (typecheck, **2104 + 315 + 24** specs, throw gate green at
  184/10/5/0 over 199 sites — the round's own `init` throw specced —
  lint, format), **238 browser specs** across `renderer` + `visual`
  with every golden exact and every parity scene at its recorded
  value, `test:types:all` clean (the declaration regen also picked up
  round 58's `node.outerGeom` doc, which had never been regenerated —
  a pre-existing staleness this round's regen caught).  Benchmarks:
  the `layouts.mjs` force row now measures a complete run at
  115 ms/2k — the one-time spectral seed (~12 ms warm at 2k)
  dominates the 20-iteration row, per-iteration cost is 1–4 ms — and
  `render-bench --layout` on ndex reads 1308 ms to converge against
  the round-36.5 era's 759–952 ms, the far field's pyramid dispatches
  plus a model doing real work instead of detonating into a clamped
  frame (both inside the ±25% read that section carries).
  MIGRATING.md's cose paragraph now names the cose-alike options
  (`gravityCompound`, `nestingFactor`, `componentSpacing`, the
  spectral seed) and CHANGELOG.md's force line describes the round-59
  model; the README's force section is rewritten wholesale.

### Risks tracked

The model changes under specs that pin ranges, not values — the ranges
were chosen for that in round 18, and the determinism specs compare
run-to-run, so they survive; any spec that turns out to pin the old
balance is rewritten with the round that changes it, not loosened.
The GPU force kernel is the one place the 8-storage-buffer budget has
to be re-fitted (the grid fold), which is round 58's freed-binding
lesson applied to compute.  The spectral seed is the largest new
surface and degrades safely by construction (a clamped embedding is
never worse than the scatter it replaces).  The far field raises
per-iteration cost by a measured factor (Hu's figure is ~1.2x; ours is
measured in 59.7 before the round closes).  And `separateComponents`
at settle is a visible jump under `animate: true` — v3 has the same
jump, and the anchors keep it small; recorded rather than hidden.
