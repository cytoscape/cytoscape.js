## The WebGL2 fallback, scoped

**Sequencing note (maintainer, 2026-08-19):** the *implementation*
round — if this scoping record says go — starts late: after most or
all other rounds, or at minimum once the rendering design decisions
are locked down (the render-affecting rounds 86, 88 and the 91–95
screen pass), because a fallback written against a moving render
contract re-pays its port on every contract change.  This scoping
round itself can run any time.

Ledger 18b, run as the tenth sitting's sequencing decision 1 wrote it:
the fallback's pre/post-4.0.0 positioning is decided *after* this
round, on data, and **this round produces a written feasibility
record, not code**.  The direction entered the record beside item 18
(the sixth sitting, 2026-08-06): a possible WebGL fallback renderer
for platforms that cannot support WebGPU — logged, never scoped.
Planning read the renderer rather than the sentence, and the shape of
the question changed twice: two subsystems assumed to need porting
already have complete CPU fallbacks sitting in the architecture
(tweens, force), and one assumed-hard piece (SDF labels) is the most
portable thing in the renderer.  What the code does today, verified:

1. **The contract is storage-buffer-shaped.**  `src/contract.mts` is
   the co-signed column layout; `column-mirror.mts:13-14` uploads
   dirty spans as byte-for-byte copies into storage buffers.  Several
   columns exist *only* to fit WebGPU's base 8-storage-buffer-per-
   stage budget — `node.outerHalf` (contract.mts:498-507),
   `node.outerGeom` (round 58), the `edge.width` mirror lane — and
   the curved-edge VS binds 6 columns + the curve blob + the visible
   list, exactly 8 (`curved-edge-pipeline.mts:11-19`).  WebGL2 has
   **no storage buffers in any stage**; the substitute is vertex
   pulling via `texelFetch` from data textures (≥ 16 vertex texture
   units guaranteed; RGBA32F/R32UI textures, slot → texel
   addressing), since UBOs bottom out at 16 KiB.  The budget that
   shaped the column layout dissolves and is replaced by a
   texture-encoding layer where `ColumnMirror` stands today.
2. **Culling and indirect draws have no WebGL2 form.**
   `cull.mts:6-28`: a three-dispatch order-preserving compute
   compaction into visible lists + `drawIndexedIndirect` args per
   group, reused by the pick pass for cursor-region culling.  WebGL2
   has neither compute nor indirect draw.  Two substitutes exist:
   CPU compaction per dirty frame (writing a visible-index texture;
   the store's columns are CPU-canonical, so the predicates can run
   where `cpu-pick.mts` already runs), or draw-every-slot with a
   vertex-stage collapse of invisible instances.  Cost unknown —
   this is 73.2 (b).
3. **Picking is three stages today** — pick-cull compute, a 64×64
   r32uint cursor-tile draw, a 3-buffer readback ring doubling as a
   pick cache (`picking.mts:4-34`) — and **nodes never touch it**:
   the sync CPU pick (`renderer.mts:580-615`, `cpu-pick.mts:36-49`)
   reads the CPU-canonical columns and carries over *unchanged*.
   The WebGL2 substitute for the edge tile: R32UI is
   color-renderable in core WebGL2, and `readPixels` into a
   PIXEL_PACK_BUFFER polled through `fenceSync` gives a
   non-blocking readback of the same tile; region culling comes
   from the CPU cull or a scissor.  Latency delta unmeasured —
   73.2 (c).
4. **SDF labels are portable.**  `glyph-atlas.mts:1-10`: canvas-2D
   raster + Felzenszwalb–Huttenlocher EDT into one r8unorm atlas;
   the FS smooths at 0.5 with `fwidth`.  Derivatives are core ESSL
   3.00, R8 is core, `writeTexture` maps to `texSubImage2D`, and
   the LOD inputs (`labelFadePx`, `minZoomedFontSize`) are uniform
   math.  Glyph instancing rides the same vertex-pulling answer as
   every pipeline.  Low risk; not spiked.
5. **The adaptive scale controller already runs blind.**  It is pure
   and clock-injected (`scale-controller.mts:20`), and its
   stall-ratio fallback (`scale-controller.mts:8-9, 32-35`) exists
   for exactly the case WebGL2 makes common:
   `EXT_disjoint_timer_query_webgl2` is widely disabled
   (to-verify per browser at 73.3), so `gpu-timer.mts` mostly has
   no substitute and `stats().gpuFrameMs` reports 0, which
   `public-types.mts:571` already documents.  The Catmull-Rom
   upscaler is a straight GLSL port.
6. **The tween fallback already exists, structurally.**  The GPU
   tween is a pure executor; the CPU is the reference and re-derives
   on settle with no readback (`gpu-tween.mts:10-35`), geometry
   channels are CPU-side even today, and the AnimationManager routes
   to the GPU only `if (this.sink != null && ani.gpuEligible)`
   (`animation.mts:2175`) — with no sink it runs wholly on the CPU.
   The fallback's cost is per-frame column writes + span uploads,
   which is precisely the cost rounds 24/25 built the offload to
   avoid; the record quotes those benchmarks rather than
   remeasuring.
7. **The force integrator has no WebGL2 equivalent** — grid scatter
   by atomics, a monopole pyramid, an 8-storage-binding gather
   (`gpu-force.mts:1-54`); transform feedback has no scatter and no
   atomics.  But the CPU reference simulation (round 18.1,
   `layout/force-sim.mts`) is the documented spec, and the layout
   duck-types `renderer.startForce` (`layout/force.mts:426-445`) —
   absent it, force runs on the CPU.  Fallback = CPU sim; the
   measured CPU-vs-GPU gap is the recorded cost.
8. **The mapper eval pass is the same shape**: a GPU offload of
   paint-channel data mappers (`mapper-runtime.mts:19-24`) over a
   CPU-canonical restyle path that headless instances exercise
   daily.  Fallback = the CPU path, priced by existing rows.
9. **The algo GPU tier needs no port and gets none.**  It is
   compute-only by construction (`algo-gpu.mts:1-22`), and the
   executor contract already covers absence: `'auto'` falls back to
   CPU on acquisition failure only, `'gpu'` rejects loudly
   (`executor.mts` header).  On a WebGL-fallback platform that is
   exactly the behaviour today's contract specifies — unchanged.
   Transform-feedback rewrites of matmul/BFS kernels are declined
   as a research project with no consumer.
10. **Device loss recovery translates.**  The core re-mounts on an
    external loss (`core.mts:2909-2960`); WebGL2's
    `webglcontextlost`/`restored` events drive the same re-mount
    shape.

The cross-cutting fact the decision framework turns on: rounds 12+
built **dual CPU/WGSL implementations that agree by construction**,
and a WebGL renderer makes every drawn thing a *triple*.
`shaders.mts` is 183 KB; that, not any single subsystem, is the
maintenance headline.  Standing item served in passing: ledger 18
(tween warm-up, "revisit with data" — who runs software adapters?) is
answered by the same reach data 73.3 fetches; the record notes it.

### 73.1 — enumerate the contract surface consumed per pipeline

Read-only.  For each pipeline — node, node-layer (overlay/underlay),
ghost, edge, curved-edge, arrow, curved-arrow, chart, image, label
(nodes + edge + the two end streams) — plus the four compute
subsystems (cull, picking, tween, mapper eval, force): the exact
columns/blobs bound per stage (the `VERTEX_COLUMNS`/
`FRAGMENT_COLUMNS` constants each pipeline declares), the WebGPU
features assumed (storage buffers, compute, indirect draw,
`unpack4x8unorm`, r32uint/r8 formats, texture arrays + the mip blit
chain of `image-arrays.mts:1-30` — WebGL2 note: `generateMipmap` is
*native* there, one of the few places the port is simpler), and the
WebGL2 substitute with a cost class: free / texture-pull /
CPU-per-frame / absent-with-CPU-fallback / absent.  **Verified by**
checking every table row against the pipeline source and
contract.mts's own budget notes — a row the source contradicts is
the enumeration failing its control.  Output: the table, in this
round's record.

### 73.2 — spike-measure the three riskiest substitutes

A **disposable spike, marked as such**: branch
`spike/webgl2-fallback`, never merged, deleted once the record
quotes it; a standalone page, deliberately outside `debug/` and
`playwright-page/` (no parallel harness joins the repo).  Three
measurements, chosen because each alone could flip the verdict, and
decided against spiking anything else (labels and tweens: portability
known, fallbacks exist — spiking them would measure the calendar):

(a) **Vertex pulling at scale** — instanced edge quads pulling
positions/endpoints/width from RGBA32F textures via `texelFetch`, at
`ndex-x-large` scale (465k edges), against the WebGPU renderer's
measured frame cost on the same box and scene.
(b) **The cull substitute** — CPU compaction per frame at 100k-800k
elements (predicate walk + visible-index upload, ms measured
separately) versus draw-everything-with-VS-collapse, both against
the compute-cull frame.  This also prices the loss of pick-region
culling.
(c) **Pick readback** — the R32UI tile + PBO + `fenceSync` path's
hover latency versus `Picking.lastLatencyMs` on the same scene.

Rules: a **real adapter** — SwiftShader refused for the perf claims
(the benchmark:algorithms-gpu rule), adapter identity and machine
recorded beside every number; probe from a served page (the
18.5/27.9 rule); nothing enters `benchmark/published/` — the harness
fingerprint discipline exists to keep that archive honest, and a
disposable page has no place in it.  Each spike scene runs once with
its substitute deliberately degraded, so a number that cannot move
is caught before it is believed.

### 73.3 — the record, the sizing, the recommendation

The written feasibility record, assembled from 73.1's table and
73.2's numbers, one section per subsystem: what WebGL2 carries, at
what measured or quoted cost, what is absent, and the user-visible
degradation (no `'gpu'` algo executor, CPU force, CPU tween cost
curve, `gpuFrameMs` 0).  Then:

- **Reach data, fetched not assumed**: WebFetch caniuse (webgpu,
  webgl2, offscreencanvas) + vendor release notes, into a
  per-browser/per-OS table stamped with the fetch date — Firefox
  stable and blocklisted/older GPUs are the population the fallback
  exists for.  Include the *in-worker* availability columns for both
  APIs, so round 86 reads this table instead of refetching.
- **Sizing the real fallback arc**: a rounds-scale estimate — GLSL
  ports of the shader families, the texture-pull data layer standing
  where ColumnMirror stands, CPU cull, the pick port — plus the
  standing tax: triple-implementation upkeep on every future drawn
  feature, and the parity-suite implication (the honest gate is a
  live v4-webgl-vs-v4-webgpu diff project on the v3-parity harness
  shape, plus its own goldens and CI browser cost).
- **The recommendation, framed for the maintainer**: pre-4.0 (reach
  at launch; delays 4.0 by the arc; two renderers forever), post-4.0
  (WebGPU-only launch, fallback as 4.x if the reach table demands
  it), or never (document headless + the reach data).  The call is
  the maintainer's, made on this record — sequencing decision 1.
- **Where the record lives**: appended to PLAN.md as this round's
  record — the repo's design records (sittings, round records) live
  here — with a short entry added to `src/README.md`'s "Design
  decisions" section pointing at it, because a fallback decision
  changes what the package claims to *require* and src/README.md is
  the maintained scope doc.  Closing sweep as standing:
  EXECUTIVE_SUMMARY.md rewritten, the ledger annotated (18b gains
  its data; 18's reach question gains the same).

### Risks named at planning

- A spike measures its own naivety unless it replicates enough of
  the render-on-dirty structure to discriminate — hence the
  degraded-substitute control on each scene, the same rule the
  parity suite lives by.
- No `src/` changes land, so the code gates don't bind this round;
  the docs-sweep and summary-rewrite rules still do.
- Browser-support claims go stale fastest of anything this repo
  records: every reach figure carries its fetch date, and the record
  says explicitly that they are claims to re-verify at decision
  time, not facts to build on.
- The temptation this round must resist is scoping by porting: the
  moment a spike file starts resembling a pipeline, it has exceeded
  its mandate — the branch name and the deletion rule are the
  guard.

**Open:** confirmation of the record's home (PLAN.md record +
src/README.md pointer, as proposed, versus a standalone document);
whether the spike runs on the benchmark machine (the numbers want the
same adapter the published renderer profile uses); whether the record
should also price a **partial** fallback (nodes/edges/labels only —
no charts, images, ghosts at first) as a third positioning option;
and the framework weights — reach versus two-renderer maintenance
versus parity-suite cost — which are the maintainer's to set at the
sitting that consumes this record.

**Carried in (the eleventh design sitting, 2026-09-28):** ledger item
18 — whether to warm the tween compute pipelines at init — is deferred
to this round.  The capability selection 73 designs decides whether a
software WebGPU adapter (the population the warm-up was for) is served
by WebGL2 instead, where there is no compute stage to warm; item 18 is
answered by that choice.  Mid arrows are filled only (item 21), so the
fallback has no hollow mid-arrow case to port.

**Decided at the eleventh design sitting (2026-09-28):** the fallback is
**full parity at alpha** — everything the WebGPU renderer draws, drawn
under WebGL2; the no-code scoping (73.1–73.3) runs **now, alongside SVG
export (round 77)**, so its constraints reach the drawn-feature rounds
(80–83, 88, 102, 104) before they are built, while the implementation
still waits for the render contract to settle; the spikes run on the
benchmark machine; the record lives on this file with a pointer from
`src/README.md`.  The before/after-4.0 question is answered by
`docs/feature-direction.md`: before alpha.

### The round, as carried out (2026-09-29)

| # | Commit | What landed |
| --- | --- | --- |
| 73.1 | this commit | the enumeration, below — read-only |
| 73.2 | `cfbad9f0` (branch `spike/webgl2-fallback`, deleted) | the spike and its results, quoted below |
| 73.3 | this commit | the record, the reach table, the sizing, the call on item 18, and the implementation round's plan (**round 137**) |

No `src/` file changed.  **The machine**: the benchmark box — Intel
Core (CoffeeLake-S, UHD 630) plus an AMD Radeon RX 580, Fedora 43.
`npm run -s gpu` before any number: *HARDWARE — amd · gcn-4*.  WebGL2
in the same Chromium, with the harness's own flags (`PROBE_ARGS`),
reports `ANGLE (AMD, Vulkan 1.4.328 (AMD Radeon RX 580 Series (RADV
POLARIS10)), radv)` and exposes `EXT_disjoint_timer_query_webgl2`, so
every WebGL2 number below is a GPU timer reading, not a wall clock.
Canvas 1280×800 at dpr 2 (a 2560×1600 backing), render-bench's shape.

#### 73.1 — the contract surface, per pipeline

Read from the source at `e1ac7796`.  "DT" is a data texture read with
`texelFetch`; counts are storage bindings per stage as the bind group
layout declares them (a layout entry counts even when the entry point
never reads it — `curved-edge-pipeline.mts:69-71`).

| Pipeline | VS storage | FS storage | WebGPU features assumed | WebGL2 substitute | Cost class |
| --- | --: | --: | --- | --- | --- |
| node body / prepass | 6 + visible = 7 | **8** | pulling, `unpack4x8unorm`, dynamic loops (gradient, polygon, barrel, Simpson), indirect | 7 VS + 8 FS DTs; hand unpack; `colorMask` prepass | texture-pull |
| ghost | **8** | **8** | as node, depth `less` | as node | texture-pull |
| node layers (overlay/underlay) | 3 + visible | 3 | pulling, indirect | 4 VS + 1 FS DTs | texture-pull |
| straight edge (main, pick, layers, cased) | **8** | 7 | pulling, `bitcast`, u32 hash, r32uint pick target, paired indirect block | 8 VS DTs; `floatBitsToUint`; R32UI FBO; `2n` instances | texture-pull |
| curved edge (main, pick, layers, cased) | **8** (all three layouts) | 6–7 | route/curve evaluators with local struct arrays and `ptr<function>`, 32-segment strip, `frag_depth` | `inout` structs; `gl_FragDepth` (core); 8 VS DTs | texture-pull |
| straight arrows (4 pipelines) | **8** | 2 | `unpack4x8unorm`, polygon SDF switch, r32uint pick | 8 VS DTs | texture-pull |
| curved arrows (4 pipelines) | **8** | 3 | as curved edge | 8 VS DTs | texture-pull |
| chart | 5 (4 read) | 7 | `fwidth` above discards, `atan2` | 5 VS + 7 FS DTs | texture-pull |
| image | 6 | **8** + 4 texture arrays | `texture_2d_array` ×4, `textureSampleGrad`, `dpdx/dpdy`, `copyExternalImageToTexture`, a mip blit chain, `copyTextureToTexture` on tier growth | 8 FS DTs + 4 `sampler2DArray` = 12 units (min 16); `textureGrad`; `texSubImage3D` from an ImageBitmap; **`generateMipmap` native** (whole array — a per-layer blit chain matches today's per-layer cost); `copyTexSubImage3D` | texture-pull |
| node labels | 4 + visible | atlas | r8unorm atlas, `fwidth`, `override LABEL_PHASE` | 5 VS DTs; R8; two programs by `#define` | texture-pull |
| edge labels + both end streams | **8** | atlas | curve/route evaluators, end walkers | 8 VS DTs | texture-pull |
| emphasis veil (round 102) | 0 | 0 | blend constant | `blendColor` + `CONSTANT_COLOR` | free |
| upscaler | 0 | 0 | 9× `textureSampleLevel` | `textureLod` | free |

The compute and readback surface — every `createComputePipeline`,
`mapAsync`, `copyTextureToBuffer`, timestamp and atomic in `src/`:

| Subsystem | GPU resources | CPU path today | WebGL2 substitute | Cost class |
| --- | --- | --- | --- | --- |
| scene cull (`cull.mts`) | 17 compute pipelines; per group count → serial scan → scatter over workgroup atomics; up to 11 groups (33 dispatches), doubled by emphasis; writes the visible lists and 21 `drawIndexedIndirect` args | none | **vertex-stage collapse** over the high-water slot count (73.2 b) | free (GPU), no CPU |
| indirect draws | `drawIndexedIndirect` ×21 call sites; `firstInstance` always 0 | — | `drawElementsInstanced` | free |
| pick (`picking.mts`, `renderer/pick.mts`) | pick cull (edge + curved, 6 dispatches), 64×64 r32uint tile, 3-slot `MAP_READ` ring, pick cache | nodes: sync CPU pick (`cpu-pick.mts:36-52`, `renderer.mts:624-647`) | R32UI FBO → `readPixels` into a PBO ring → `fenceSync` (73.2 c); no region cull | texture-pull |
| `viewportCounts()` (round 75) | readback of the indirect args' instance words | none predicate-exact | the predicates evaluated on the CPU columns when called | CPU-per-call |
| GPU tweens | 3 compute pipelines, created eagerly with the sync call at renderer init (`gpu-tween.mts:390-406`) | `animation/manager.mts:501` — no sink ⇒ CPU tick | no sink | absent-with-CPU-fallback |
| mapper eval | 2 compute pipelines writing the paint columns | `gpuMappers: null` (`renderer/frame.mts:88-107`) | `gpuMappers: null` | absent-with-CPU-fallback |
| GPU force | 10 kernels, atomics, a per-frame 12 B readback | `layout/force-run.mts:646` duck-types `startForce`; worker or in-thread sim | no `startForce` | absent-with-CPU-fallback |
| label declutter (round 104) | none: CPU pass, a per-slot gate uploaded to a storage buffer | it is the CPU path | the gate as an `R32F` DT, read by the collapse predicate | free |
| GPU timer | optional `timestamp-query` | `gpuFrameMs` 0, stall ratio (`scale-controller.mts:7-9, 32-35`) | `EXT_disjoint_timer_query_webgl2` where exposed | free |
| PNG export | own cull set; compute pack of the target into bands; `mapAsync` | the old CPU loop (81 ms at 4k) | FBO, un-premultiply pass, `readPixels` into a PBO, Y flip, tiling past the renderbuffer limit | texture-pull |
| algorithm GPU tier | own device (`algo-gpu.mts`) | `executor.mts:398-430`: `'auto'` → CPU on acquire failure, `'gpu'` rejects | unchanged | absent-with-CPU-fallback |
| worker host (round 86) | WebGPU on an `OffscreenCanvas` in a worker | mappers, tweens already CPU there | `OffscreenCanvas.getContext('webgl2')` | free |
| acquisition and loss | `requireWebGpu()` throws with a container; `initGpuContext` rejects on a null adapter; re-mount once on loss (`core/lifecycle.mts:172-220`) | headless without a container | capability selection here; `webglcontextlost` → the same re-mount | — |

**The only shader construct with no GLSL ES 3.00 core form is
`unpack4x8unorm`** (33 call sites; ES 3.10) — a hand unpack or an
`RGBA8UI` texture.  Nothing drawn uses MSAA, dual-source blending,
`sample_mask`, f16, subgroups or stencil; the frame uniform is 80 B of
std140-compatible floats.  **The budget that shaped the columns
dissolves**: no WebGL2 program needs more than 8 vertex or 12 fragment
texture units, against minimums of 16 each.  The WGSL the port
translates, as expanded at runtime: `NODE_SHADER` 74,125 characters,
`CURVED_EDGE_SHADER` 63,497, `EDGE_SHADER` 31,622, arrows 30.6 KB of
source, labels 17.2 KB, images 10.6 KB, charts 6.8 KB — `src/render/shaders/`
is 208 KB of source in all.

**The control — where the source contradicted the plan**:

- *"`node.outerHalf`, `node.outerGeom` and the `edge.width` mirror lane
  exist only to fit the budget"* — **wrong for `node.outerHalf`**, which
  the CPU reads (`store/graph-store/curves.mts:142-148`,
  `store/hierarchy.mts:365`): it is a v3 outer-frame column that also
  serves the budget.  `node.outerGeom` and the width lane are
  budget-only, as claimed; `contract.mts:498-507` was the wrong citation
  (the `outerHalf` doc is at `:560-569`).
- *"the curved-edge VS binds 6 columns + the curve blob + the visible
  list, exactly 8"* — right for the main layout; the layer and cased
  layouts are also exactly 8, made up differently (4 columns + blob +
  record + `node.outerGeom` + visible).
- Four source comments understate their own stage's bindings and are
  now wrong: `shaders/edge.mts:38-45` ("6 VS storage buffers" — the
  layout gives binding 12 to the vertex stage too, 8 in all),
  `shaders/arrow.mts:27-31` ("6 columns" — 7), `label-pipeline.mts:49-50`
  ("2 storage buffers for node labels" — 4), and `contract.mts:570-585`
  (names two readers of `node.outerGeom`; the round-124.4 cased VS and
  the edge-label pipeline also bind it).  Left for 137.2 — this round
  changes no `src/`.
- Stale citations, now: `picking.mts:4-34` → the stages are at
  `renderer.mts:588-598`; `animation.mts:2175` →
  `animation/manager.mts:501`; `mapper-runtime.mts:19-24` → the CPU
  seam is `renderer/frame.mts:88-107`; `layout/force.mts:426-445` →
  `layout/force-run.mts:615-760`; `core.mts:2909-2960` →
  `core/lifecycle.mts:172-220`; `public-types.mts:571` → `:941-942`.
  Everything else the plan cited stands.
- One seam found in passing: `force-run.mts:643-644` consults the
  headless force host only when no renderer is mounted, so a mounted
  renderer without `startForce` makes an explicit `executor: 'gpu'`
  throw even where WebGPU compute exists.  Under the selection rule
  below WebGL2 is chosen only where WebGPU is absent or a fallback
  adapter, so that throw is the specified behaviour; 137.1 pins it.

#### 73.2 — the spike's three measurements

A disposable page (`spike-webgl2/`, commit `cfbad9f0` on
`spike/webgl2-fallback`, deleted with this commit; the scratch copy is
not in the repo), served on loopback, driven by Playwright with
`PROBE_ARGS`; nothing entered `benchmark/published/`.  The WebGPU side
is the shipped UMD on the same scenes (render-bench's sheet: 12×12
nodes, 1 px `#bbb` edges at 0.6 opacity, render scale pinned to 1), its
cull compute pass read from the gpu-timer's own timestamp pair.  The
scenes are render-bench's: `ndex-x-large` (19,607 × 464,657) and its
generator at 100k–800k elements (n : m = 1 : 3, every other node
hidden).  Medians of 25–121 frames over a 2 s window after 700 ms of
warm-up; interquartile ranges were under 1% throughout except where
given.

**(a) Vertex pulling costs nothing measurable.**  The same instanced
edge quad, pulling endpoints, positions, half-sizes, width and colour
from `RG32F`/`R32F`/`RG32UI` textures by `texelFetch`, against the same
quad fed by instanced attributes the CPU resolved up front:

| ndex-x-large, GPU ms | attributes | pulled | pulled, degraded (+128 fetches a vertex) |
| --- | --: | --: | --: |
| vertex stage alone (`RASTERIZER_DISCARD`) | 1.457 | 1.458 | 11.643 |
| full frame, fit-all | 21.29 | 21.29 | 21.32 |
| full frame, zoomed-in 20× | 76.28 | 76.22 | 76.26 |
| full frame, far-zoom ÷8 | 2.637 | 2.638 | 11.691 |

The control did its job twice.  The first run's degrade (+16 fetches)
moved nothing in any view — every full frame was fill-bound, so no
pulling cost could have shown; the rerun isolated the vertex stage and
raised the degrade until it moved (1.46 → 11.64 ms).  Only then is
"1.457 against 1.458" a measurement of pulling rather than of the
rasterizer.  The full frames are **not** comparable with the WebGPU
renderer's (38.4 / 36.7 / 1.47 ms device on the same scene, today):
the spike has none of the shipped shaders' shape SDFs, prepass, dashes
or edge LOD, and at zoomed-in its 20×-wide edges are pure fill.  What
they do show is that the substitute's frame is set by fill, as the
WebGPU renderer's is.

**(b) The cull substitute: the vertex-stage collapse wins.**  GPU ms of
the frame, and the CPU walk and upload a compaction pays per dirty
frame:

| elements | view | WebGPU device (cull compute) | WebGL2, CPU list: GPU / walk / upload | WebGL2, VS collapse: GPU | collapse off (degraded) |
| --: | --- | --- | --- | --: | --: |
| 100k | fit-all | 1.71 (0.17) | 4.41 / 0.4 / 0.0 | 4.43 | 13.04 |
| 100k | zoomed-in | 2.10 (0.17) | 1.69 / 0.5 / 0.0 | 1.70 | 5.24 |
| 200k | fit-all | 3.06 (0.27) | 7.63 / 0.9 / 0.0 | 7.66 | 23.47 |
| 200k | zoomed-in | 3.58 (0.28) | 2.81 / 1.0 / 0.0 | 2.82 | 8.58 |
| 400k | fit-all | 3.48 (0.49) | 13.34 / 1.8 / 0.0 | 13.37 | 44.08 |
| 400k | zoomed-in | 6.42 (0.51) | 4.96 / 2.1 / 0.0 | 4.99 | 15.07 |
| 400k | far-zoom | 1.16 (0.56) | 1.47 / 1.9 / 0.0 | 1.57 | 4.32 |
| 800k | fit-all | 6.80 (0.93) | 24.05 / 3.7 / 0.1 | 24.38 | 85.20 |
| 800k | zoomed-in | 12.17 (1.02) | 9.04 / 4.5 / 0.0 | 9.36 | 27.76 |
| 800k | far-zoom | 1.93 (0.99) | 2.60 / 3.9 / 0.0 | 2.69 | 8.53 |
| ndex (484k) | fit-all | 38.38 (0.64) | 21.30 / 2.4 / 0.1 | 21.29 | — |
| ndex (484k) | zoomed-in | 36.68 (0.63) | 76.31 / 2.5 / 0.1 | 76.19 | — |

The collapse costs **0.03–0.33 ms of GPU** over a compacted list and
saves a CPU walk of **0.4–4.5 ms a frame**, with no upload and slot
order kept for free; so the cull is a vertex-stage collapse.  Both
controls moved: the collapse switched off draws the hidden half and
triples the frame, and the CPU walk's degraded form — the plain per-edge
AABB walk the spike first wrote — costs 1.9–2× the per-node outcode
walk it was replaced with (8.8 against 2.4 ms on ndex; 7.1 against 3.7
at 800k).  The WebGPU column is context, not a like-for-like price: its
fit-all frames are 3–4× cheaper than the spike's because the shipped
cull decimates sub-pixel hairlines (`edgeLod`), which the spike does
not and the port will — the predicate moves into the collapse whole.
The compute cull's own cost (0.17–1.02 ms) is what the collapse
replaces.  Region culling for the pick pass is priced in (c).

**(c) The pick readback is not slower than WebGPU's.**  Hover while
panning, render-bench's scenario (80 picks, 120 ms apart, five probe
points), latency from request to answer:

| ndex-x-large | p25 | p50 | p75 | p99 | main thread blocked |
| --- | --: | --: | --: | --: | --: |
| WebGPU, fit-all (the ring's cache answers the p50) | 0.2 | 0.3 | 53.9 | 78.0 | — |
| WebGL2, PBO + fence, task poll, fit-all | 64.5 | 70.5 | 75.0 | 102.3 | 0 |
| WebGL2, sync `readPixels` (degraded), fit-all | 57.7 | 57.9 | 58.7 | 62.8 | 57.9 |
| WebGPU, far-zoom | 19.4 | 19.4 | 19.5 | 19.7 | — |
| WebGL2, PBO + fence, task poll, far-zoom | 5.7 | 5.7 | 5.8 | 40.0 | 0 |
| WebGL2, PBO + fence, rAF poll (degraded), far-zoom | 16.6 | 16.7 | 16.8 | 17.0 | 0.1 |
| WebGL2, sync `readPixels` (degraded), far-zoom | 4.2 | 4.3 | 5.8 | 8.1 | 4.3 |

At fit-all both GPUs are saturated (the WebGPU frame is 38 ms of
device time, the spike's 21 ms), and a miss waits out the queue on
either backend — 54 ms at the WebGPU p75, 70 ms at the spike's p50;
the spike has no pick cache, which the port carries over unchanged and
which is where WebGPU's 0.3 ms p50 comes from.  Unsaturated (far-zoom),
the fence answers in 5.7 ms against WebGPU's 19.4 (which encodes the
tile into the next frame).  Both degrades moved: polling once a frame
quantizes to the frame (16.7 ms), and the synchronous read blocks the
main thread for its whole latency.  **Region culling does not pay for
the pick**: the tile drawn over all 464,657 edges is 1.43 ms of GPU,
against 2.3 ms of CPU walk plus 0.64 ms of GPU to draw the 124,974
edges the walk keeps (the tile sits on the hub); and without it the
latency did not move (68.6 against 70.5 ms p50).

#### 73.3 — the record

**What WebGL2 carries, per subsystem, and what the user loses.**

- *Every drawn thing* — nodes, edges, arrows, labels, images, charts,
  layers, ghosts, emphasis, the upscaler — ports as GLSL ES 3.00 over
  data textures at no measured pulling cost.  Nothing drawn is absent.
- *Culling and indirect draws* have no WebGL2 form; the collapse
  replaces both at +0.03–0.33 ms of GPU.  `viewportCounts()` becomes a
  CPU evaluation of the same predicates when called.
- *Picking* ports whole (tile, ring, cache); nodes were never on the
  GPU.  Latency measured no worse.
- *Tweens* run on the CPU: the spawned 200k-slot tween costs 15 ms per
  CPU tick (round 24's measurement, the number the GPU offload deleted).
  Geometry tweens were already CPU-side.
- *Mapper eval* runs on the CPU restyle path: a 200k colour write is
  78.5 ms instead of 15.9 (`src/README.md`'s GPU-evaluation figure).
- *Force* runs the CPU sim, on its worker or in-thread (round 129): on
  25k × 50k the converged GPU run is 3.3 s since round 119; the CPU sim
  on em-web is 0.4 s.  A like-for-like CPU number at 25k is not on file
  and 137.10 records one.
- *The algorithm GPU tier*: unchanged — `'auto'` answers on the CPU,
  `'gpu'` rejects, as the executor contract already says.
- *`gpuFrameMs`* reads 0 wherever the timer query is not exposed —
  Firefox, Safari and Android (below) — as `public-types.mts:941-942`
  already documents; the scale controller runs on its stall ratio.

**Reach, fetched 2026-09-29 — claims to re-verify when 137.1 opens,
not facts to build on.**  Sources: caniuse's feature JSON (data
updated 2026-09-28), the gpuweb wiki's Implementation Status (edited
2026-08-13), MDN browser-compat-data (2026-09-28), Chrome's "New in
WebGPU" posts for 121, 136, 144 and 147–148, Chromium's
`webgpu_blocklist_impl.cc`, `webgpu_decoder_impl.cc`,
`gpu_driver_bug_list.json` (entry 256) and `docs/gpu/swiftshader.md`,
Gecko's `StaticPrefList.yaml`, WebKit's `UnifiedWebPreferences.yaml`,
and the Safari 17 and 26 release notes.

| Browser / OS | WebGPU | WebGPU in a worker | WebGL2 | WebGL2 in a worker (`OffscreenCanvas`) | timer query |
| --- | --- | --- | --- | --- | --- |
| Chrome, Windows | 113 (D3D12 adapters from AMD, Intel, NVIDIA, Microsoft; D3D11-only and older Adreno blocked) | 113 | 56 | 69 | exposed |
| Chrome, Windows ARM64 | flag only | flag only | 56 | 69 | exposed |
| Chrome, macOS | 113 | 113 | 56 | 69 | exposed (Metal backend unverified) |
| Chrome, ChromeOS | 113 | 113 | 56 | 69 | exposed |
| Chrome, Linux | partial: Intel Gen12+ since 144, NVIDIA 535.183+ on Wayland since 147, **AMD and the rest flag only** | as WebGPU | 56 | 69 | exposed |
| Chrome, Android | 121 on Android 12+ with ARM, Qualcomm, Intel; Imagination on 16+; Samsung Xclipse not yet | 121 | 58 | 69 | **not exposed** |
| Edge | 113 (as Chromium) | yes | 79 | 79 | exposed |
| Firefox, Windows | 141 | 141 | 51 | 105 | **not exposed** (privileged pref) |
| Firefox, macOS | Apple Silicon: 145 on macOS 26, 147 on all; Intel Macs Nightly only | as WebGPU | 51 | 105 | not exposed |
| Firefox, Linux | **no** (Nightly; "expected 2026") | no | 51 | 105 | not exposed |
| Firefox, Android | **no** | no | yes | 105 | not exposed |
| Safari, macOS | partial: Safari 26 on macOS 26 only | 26 | 15 | 17 | not exposed by default |
| Safari, iOS / iPadOS | 26 | 26 | 15 | 17 | not exposed by default |
| Samsung Internet | 24 or 25 (sources disagree); Xclipse excluded | yes | 7.2 | 10.1 | not exposed |

Global usage (caniuse): **WebGPU 85.72% full + 3.05% partial; WebGL2
96.44%; OffscreenCanvas 95.99%.**  So 7.7 points of the web (10.7
counting the partial support as none) has WebGL2 and no WebGPU by
caniuse's count, and caniuse overstates WebGPU:
it counts Chrome 144+ as full on every OS and Chrome Android as full,
where Linux and Android depend on the GPU and driver — so the real gap
is wider, and it is concentrated in exactly the population the plan
named: Linux desktops (this benchmark machine's own RX 580 gets WebGPU
only behind a flag), Firefox off Windows and Apple Silicon, Android
devices outside the allow-list, and Safari before 26.  The in-worker
columns are for round 86: WebGL2 in a worker is as broad as WebGL2
itself from Safari 17.

**Item 18 — the tween warm-up: closed, not warmed.**  Chromium does not
hand users a software WebGPU adapter: SwiftShader is "only allowed with
`--enable-unsafe-webgpu`" (`webgpu_decoder_impl.cc`), CPU adapters are
blocklisted, and `isFallbackAdapter` is "at the moment always false on
users' devices" (Chrome 136 post).  The population the warm-up was for
— a user on a software adapter paying up to ~1.8 s on a first
`animate()` — is harnesses and CI.  And the capability selection
designed here sends a fallback adapter to WebGL2 anyway, where there is
no compute stage to warm.  What remains on real hardware is the same
shape an order of magnitude smaller (the item's own measurement), which
is not worth startup.  So: `'auto'` takes WebGPU only on a
non-fallback adapter that yields a device, else WebGL2, else rejects;
an explicit backend never falls back; the goldens pin `'webgpu'` —
round 137's 137.1.

**Sizing the real arc** — round 137's plan, ten sub-rounds: selection
and the context; the texture mirror and the parity project; then one
sub-round per shader family (nodes; straight edges and arrows; curved
edges and arrows; labels; images, icons and charts); interaction and
the frame's other passes; export, the worker host and the limits; the
price and the docs.  The measured risk is retired — pulling is free,
the collapse is free, the readback is no slower — so what is left is
volume: ~208 KB of WGSL source translated by hand into a second
language, which is the renderer's whole draw path re-written once.  By
this record's own history that is several rounds' work, not one.

**The standing tax.**  Every drawn feature after round 137 is written
three times — CPU where it is read, WGSL, GLSL — and every one lands
against a **live v4-webgl-vs-v4-webgpu diff project** on the v3-parity
harness's shape, plus the backend's own goldens and a second browser
project in CI (its cost measured in 137.10).  Round 135's list of 56
paintable properties no golden sets is the list the parity project
cannot see; round 136's inventory is the gesture list both backends
replay.

**The recommendation, framed for the maintainer.**  The sitting has
already taken the positioning — full parity at alpha, before alpha, by
`docs/feature-direction.md` — and nothing measured here argues against
it: no subsystem is absent without a CPU path that already exists, and
none of the three risky substitutes costs more than the WebGPU
mechanism it replaces.  The data does answer the two things the call
still rested on.  The reach gap is real and larger than caniuse's 7.7
points, in the Linux, Firefox and older-Safari populations; and the
price is maintenance, not performance — which the parity project turns
into a gate rather than a hope.  **The partial fallback** (nodes, edges
and labels first) the plan left open is not priced as a separate
option: the sitting took full parity, and round 137's family order
(nodes, edges, labels, then images and charts) already makes a partial
state reachable mid-round if the calendar ever asks for one.

**Constraints on the drawn-feature rounds** (80–83, 76, 105; carried
into each open plan file), so they are built once for both backends:

1. Nothing drawn may depend on a compute pass without a CPU path: what
   the renderer reads is CPU-canonical or CPU-derivable (the mapper and
   tween rule, generalized).
2. A new pipeline's cull predicate must be a pure function of the
   pulled columns and the frame uniform, so it can move into the vertex
   stage; no draw count may exist only on the GPU.
3. No storage writes from a draw, no atomics in the draw path, no
   dual-source blending, subgroups or f16 in a drawn shader.
4. Per-instance records stay within 16 vertex-stage bindings once the
   budget is gone — do not re-spend it as if it were WebGPU's
   `maxStorageBuffersPerShaderStage` (16 on this adapter, 8 by default).
5. A drawn feature lands with a golden that sets its properties (item
   30's rule), or the parity project cannot see it.

**Where the record lives**: here, with a pointer from `src/README.md`'s
"Design decisions", as the sitting decided.  The spike branch is
deleted with this commit; the numbers above are its record.
