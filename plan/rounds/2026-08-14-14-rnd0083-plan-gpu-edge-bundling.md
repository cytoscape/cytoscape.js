## GPU edge bundling

Issue #2332 asked for edge bundling in 2019 and was closed
unfixed; desktop has it; it is the headline large-graph visual the
v4 architecture exists to make cheap (#3486's rendering thesis).
What the code does today, verified:

1. **Curved edges are one instance per edge over a fixed strip**:
   `CURVE_SEGS = 24` quads (`src/curve-geometry.mts:55`), vertex
   shader evaluates the curve from live positions + per-edge
   params (`src/render/curved-edge-pipeline.mts:10-19`), inside
   the 8-storage-buffer budget.
2. **Variable-length curve records live in the CurveBlob**
   (`src/store/curve-blob.mts:3-30`): the f32×4
   `edge.curveParams` column holds `[blobOffset, dev, n, kind]`
   headers into a compacting pool; records are
   **position-independent — offsets/weights in the endpoint
   frame — so drags/layouts follow on-GPU with zero blob traffic**
   (`curve-blob.mts:16-19`).  Segment records cap at
   `MAX_CURVE_PTS = 11` interior points
   (`src/curve-geometry.mts:728`).
3. **The CurveIndex owns styled records and derives params
   lazily** (`src/store/curve-index.mts:29-66`); the 12b families
   never bundle pairs and write per-edge blob records.
4. **Arrows and picking already ride the curved stream**: heads
   point along the curve's end tangent
   (`src/render/curved-arrow-pipeline.mts:10-16`); edges pick on
   the GPU via the same strip in the cursor-tile pass
   (`src/render/renderer.mts:1202, 1339-1363`).
5. **The async algorithm tier has the executor contract this
   operation should reuse** (`src/algorithms/executor.mts:1-25`):
   Promise-returning, `executor: 'cpu' | 'gpu' | 'auto'`, CPU as
   the bit-reproducible spec, `GPU_MIN_N = 256` as the auto
   floor (:44), `runAlgo` routing (:90), kernels on the
   compute-only `acquireAlgoGpu` context — no canvas, headless
   parity suite in the Playwright `algorithms-gpu` project.
6. **LOD interplay exists today**: far-zoom edge decimation draws
   a hash-stable 1-in-N subset (PLAN.md:1679) — bundled edges
   decimate like any others.
7. **Per-element bypasses are id-keyed sheet declarations**
   (`src/README.md:718-731`), constants-only, O(bypassed) apply —
   designed for few elements, relevant below as the rejected
   output form.

**Design calls.**

- **Algorithm: density-based bundling (KDEEB/CUBu family), not
  FDEB.**  FDEB's compatibility measure is pairwise —
  O(E²) pairs times P points per iteration; at 100k edges that is
  5×10⁹ pair terms per iteration before any force is summed, and
  no executor makes that a headline.  The density approach is
  O(E·P) splat + O(cells) blur + O(E·P) gradient advection per
  iteration — linear in edges, GPU-native, and the published CUBu
  line bundles ~10⁶ edges in real time on commodity GPUs.  The
  measured-crossover story is therefore not FDEB-vs-KDEEB (FDEB
  loses asymptotically before any measurement); it is
  **CPU-KDEEB vs GPU-KDEEB**, same algorithm on both executors —
  the round-65 shape, with the crossover constant measured on the
  benchmark machine and machine-stamped.  Rejected: shipping FDEB
  as the CPU path "because it is the classic" — two algorithms
  means the parity suite compares nothing.
- **API: an explicit async operation, not a style value.**
  `cy.bundleEdges( options ) → Promise<BundleResult>`, options
  `{ executor, iterations, cellPx, smoothing, edges? }` (unknown
  keys throw).  A `curve-style: 'bundled'` prop is rejected on the
  style system's own contract: every styled record is re-derivable
  from (style, endpoints) alone and stays fresh automatically
  (`src/README.md:1340-1342`), while a bundled shape depends on
  *every other edge's positions* and is expensive and iterative —
  a style value would either lie about freshness or re-run a
  global operation on every drag.  The algorithm tier's
  explicit-async precedent (finding 5) fits exactly: expensive,
  global, environment-dependent, resolves with stats
  (`{ iterations, edgesBundled, msTotal }` — `edgesBundled` is
  what the bench rows print).
- **Output lives in the curve tier as a new operation-owned record
  kind**, `CURVE_BUNDLED`: per-edge polylines of up to
  `CURVE_SEGS − 1 = 23` interior points, stored in the CurveBlob
  **in the endpoint frame** — so the existing
  position-independence contract holds and a post-bundle drag
  deforms the bundle plausibly on-GPU with zero blob traffic;
  re-run to re-tighten (documented).  The record is flagged
  operation-owned: a style write to that edge's curve family drops
  the override (style wins; recorded), `cy.unbundleEdges()` clears
  all.  `segmentPoints()` answers with the bundled polyline, which
  gives the numeric no-pixels verification tier (the
  routing.spec.js precedent).  Rejected: emitting per-edge
  `segment-distances` bypasses — canonical and serializable, but
  id-keyed O(bundled) sheet entries are the wrong shape at 10⁵
  edges, a bypass beats the sheet forever (muddying app bypasses),
  and segments cap at 11 interior points where the strip affords
  23.  Serialization instead: `BundleResult` carries a columnar
  payload (edge ids + counts + offsets) that
  `cy.bundleEdges({ preset: result })` re-applies — the
  preset-layout precedent, and consistent with "kept definitions
  are the app's job".
- **Kernels are compute-only on the AlgoGpu context**: splat
  polyline segments into a u32 fixed-point density grid with
  atomics (no float-blend feature dependency, no render pass),
  separable box/Gaussian blur, per-point gradient advection with
  endpoint pinning, Laplacian smoothing, resample — all
  `wgsl`-tagged.  Positions upload O(N) per run; no entanglement
  with the frame loop, and headless-with-adapter environments run
  it exactly like the round-65 tier.

### 83.1 — the CPU reference + the operation surface

`src/algorithms/edge-bundling.mts`: the f64 reference KDEEB loop
(grid splat, blur, advect, smooth, resample to ≤ 23 interior
points), `cy.bundleEdges` entry through
`resolveExecutor`/`runAlgo`, result/preset shapes, throws
(unknown option keys, bad iteration/cell values, `edges`
collection from another instance — the round-48.4 guard) each with
specs.  **Verified by** Node specs asserting the property bundling
is named for: on a two-cluster parallel-edge fixture, mean
pairwise midpoint distance among compatible edges *decreases* by a
pinned factor, endpoints stay bit-identical (pinned), and a
control run with advection zeroed fails the convergence assertion.
Files: `src/algorithms/edge-bundling.mts`, `src/core.mts`,
`src/public-types.mts`.

### 83.2 — the curve tier learns `CURVE_BUNDLED`

Store: the record kind in `curve-index.mts`/`curve-blob.mts`
(operation-owned flag, style-write drop rule, compaction
relocation), the bb term in the store scan (conservative polyline
hull — the round-12a pattern), `segmentPoints()`.  Render: the
kind dispatch in `CURVED_EDGE_SHADER` (walk the 23-point
polyline across the 24-quad strip), the arrow end-tangent case,
FLAG_CURVED set so cull/pick/arrows ride the existing curved
stream unchanged.  **Verified by** goldens: a bundled scene
(exact) with the control run unbundled — the diff must jump — and
a **close-up** golden at zoom 3-4 per the round-56 rule (bundle
geometry, not AA, must own the mismatch); a pick spec asserting a
click on the bundled *arc* hits the edge and a click on the old
straight chord misses (run once with bundling disabled to prove it
discriminates); the deformation contract pinned numerically (move
an endpoint, `segmentPoints()` follows in the endpoint frame with
no re-run).  Files: `src/store/curve-index.mts`,
`src/store/curve-blob.mts`, `src/render/shaders.mts`,
`src/render/curved-edge-pipeline.mts`,
`src/render/curved-arrow-pipeline.mts`.

### 83.3 — the GPU kernels + parity

`src/algorithms/algo-gpu-bundling.mts`: the four kernels above,
`GpuUnfitError` on grids/buffers past device limits, accumulation
order pinned where atomics make sums order-free (fixed-point
splat is add-commutative — state it in the kernel doc).
**Verified by** the `algorithms-gpu` Playwright parity spec:
CPU-vs-GPU bundled polylines within a pinned tolerance (f32 vs
f64, the round-65 determinism contract) on the two-cluster fixture
and a multi-component one, plus one control with the blur radius
skewed on the GPU side only — the spec must go red.  **Measure-first
gate:** before tuning `minGpuN` for `'auto'`, measure both
executors at three sizes on real hardware via
`benchmark:algorithms-gpu` (SwiftShader refused, adapter identity
printed); if the CPU owns every bench size, the GPU path serves
explicit `'gpu'` only and the constant stays `Infinity` with the
measured number in the wrapper comment — the `pageRankDense`
precedent, a losing configuration kept measured.

### 83.4 — the price, the crossover, and the close

Bench: rows in `benchmark/algorithms-gpu-bench.mjs` (`cpu` /
`gpu` / `gpu first call` for bundling — **each row prints
`edgesBundled` and refuses to publish a row that bundled zero**,
the round-39.1 rule in this round's shape) and a renderer-profile
scene pricing the bundled curved stream per frame against the
same graph straight (the row prints how many instances took the
`CURVE_BUNDLED` path).  All bench-file edits batched so each
profile's harness fingerprint moves once; publish serial,
`--repeat 3`, per the standing rules.  Interaction cost recorded
honestly: hover over a dense bundle resolves to the topmost slot
(slot order — no z-index, structural, documented).  `debug/`
gains a bundle button on the generated dense scene.  Standing
close: this record, `src/README.md` (the operation-owned record
contract, the style-wins drop rule, the deformation contract),
MIGRATING/CHANGELOG, `EXECUTIVE_SUMMARY.md` rewritten, d.ts
regenerated, JSDoc/throws gates at 100%/zero, oxfmt clean.

### Risks named at planning

- The 23-interior-point cap may read coarse on screen-length
  edges; the close-up golden is the detector.  The escape hatch —
  raising `CURVE_SEGS` — reprices *every* curved edge's VS work,
  so it happens only behind the renderer bench row.
- The blob's operation-owned records join compaction; a
  relocation defect corrupts silently.  The soak tier gets a
  bundle/unbundle churn spec before 83.3 lands.
- u32 fixed-point splat can saturate on dense grids; the kernel
  clamps and the parity fixture includes a worst-case cell.
- The pick spec's chord-miss assertion depends on cursor-tile
  size; verify it discriminates (run with bundling off) before
  trusting green.

**Open:** (1) Progress surface: is a per-iteration event (or an
`animate: true`-style live application, the layout precedent)
wanted in v1, or does the promise-plus-stats shape suffice until
asked?  (2) Should `BundleResult` presets round-trip through the
wire format (a new section, version bump) or stay an app-held
payload?  (3) Arrowheads at bundle ends: endpoints stay pinned so
heads fan at nodes — acceptable, or should v1 offer
`arrow-scale`-style de-emphasis guidance in docs only?  (4) Does
bundling belong partly in cyext (round 71) as the extension
showcase instead of core — and if core, is the operation namespaced
(`cy.bundleEdges`) or grouped under a future `cy.ops` tier?
