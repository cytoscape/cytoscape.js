## Round 73 plan — the WebGL2 fallback, scoped (planned 2026-08-14)

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
