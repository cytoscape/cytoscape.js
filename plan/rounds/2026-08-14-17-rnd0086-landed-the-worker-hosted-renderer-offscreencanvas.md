## The worker-hosted renderer (OffscreenCanvas)

The oldest renderer demand on the tracker (#1350, #2799): move
rendering off the main thread entirely.  WebGPU works in workers
(Chrome; other engines to-verify — round 73's reach table carries the
in-worker columns for exactly this).  Planning verified the coupling
before designing, and the finding that organises the round: **the
model↔renderer boundary is already message-shaped, and the one
load-bearing sync API never touches the GPU.**  What the code does
today, verified:

1. The renderer reads the model only through `ModelView`
   (contract.mts:990-1030): typed-array columns, **one coalesced
   dirty span per column** per frame (`store/dirty.mts:47-68`,
   `take()`-and-clear at :103), the four blobs under the same span
   rules (`StoreDelta`, contract.mts:878-896), the label sidecar
   with its own dirty list, `parentOrder()`, and the image
   registry.  `ColumnMirror` consumes it as byte-for-byte span
   copies (column-mirror.mts:13-14).  So the question the plan was
   asked — are the diffs already enumerable? — is answered by
   reading: the delta the renderer drains each frame *is* the
   enumeration, and a `(columnId, start, end, bytes)` message
   carries it verbatim.
2. But the renderer also holds direct core refs beyond ModelView:
   `cy._store` (37 call sites), `cy._styleEngine` (the
   `arrowEnds`/`midArrowEnds` tables, renderer.mts:1839-1869),
   `cy._viewport` (pan/zoom read per frame, renderer.mts:595, 2478),
   `cy._ele` for pick decode (renderer.mts:617-636), and —
   the deepest coupling — `cy._animations`: **the frame loop is the
   animation clock** (`attachDriver` at renderer.mts:1171,
   `cy._animations.tick(t0)` at renderer.mts:1276).  The core's own
   view of the renderer is, by contrast, already narrow and mostly
   async: `RendererLike` (core.mts:82-95) — destroy / pick
   (Promise) / requestRender / resize / stats / forceActive /
   exportImage (Promise) — plus the force layout duck-typing
   `renderer.startForce` (layout/force.mts:426-445).
3. The sync surface: `pickNodeSync` (renderer.mts:580; five pointer
   call sites, the pan-vs-grab decision at pointer.mts:342) resolves
   through `pickNodeAt` over the **CPU-canonical columns**
   (renderer.mts:602, cpu-pick.mts:36-41) — no GPU, no renderer
   state beyond view constants.  With the store staying main-side,
   the sync pick stays main-side and **stays sync**.  `exportImage`
   and `pick` are Promises already; `stats()` is a sync counter
   snapshot.
4. Events: the pointer handler binds to the **renderer's canvas**
   (pointer.mts:1693 — not the container, correcting the planning
   premise) and writes back through the core API.  Under
   `transferControlToOffscreen()` the canvas element stays in the
   DOM and keeps receiving events, so input needs no forwarding at
   all — only what the frame already consumes (viewport state,
   diffs) crosses.
5. The wire format (`wire.mts:17-25`) is the precedent and the seed
   for the **initial full-state transfer**; per-frame traffic is
   spans, not the wire format.

Design, pass 1: **renderer-only in the worker** — store, style,
animation manager, layouts and pointer all stay on main.  A
main-side `RendererProxy` implements `RendererLike`; a worker-side
`RemoteModelView` implements `ModelView` over local typed arrays fed
by span messages; the frame loop, mirror and pipelines run in the
worker unchanged.  The named hard couplings and their resolutions:
the animation manager reclaims its own rAF loop (it already owns one
for the sink-less case, animation.mts:1740-1750) and the tween sink
becomes a register/unregister proxy — the settle contract
("re-derive on CPU, no readback", gpu-tween.mts:16-19) survives
untouched, a designed-for property; pick decode + staleness
revalidation (renderer.mts:617-636) moves main-side over raw ids;
image decodes move to the worker (`createImageBitmap` +
transferables); device loss forwards out and the core's re-mount
recovery (core.mts:2917) tears down and respawns the worker;
`startForce` is deferred or proxied — decided in-round on 86.1's
cadence numbers.

### 86.1 — the coupling audit and the messaging contract, written first

Enumerate every renderer→core touch (the census above is the start)
and classify each: served by RemoteModelView / moved main-side /
forwarded / deferred.  Write the message schema — init transfer
(wire-format-seeded), per-batch delta (spans + blobs + label entries
+ viewport + tween registrations), pick request/reply, export,
resize, devicelost, stats snapshot — as a typed module under the
contract.mts discipline: co-signed, changed first.
**Measure-first gate:** the per-frame copy cost.  A CPU-side
position animation or layout tick dirties a span covering most of
`node.position`; measure copy + transfer at harness scale
(`ndex-x-large`) before committing to the copy design.
SharedArrayBuffer would erase the copy but demands cross-origin
isolation the library cannot impose on embedders, so it can only
ever be an opt-in tier — priced here, decided by the maintainer
(Open).

### 86.2 — extract the seam (behaviour-neutral, lands alone)

The renderer stops reaching into `cy._*`: it takes at construction a
ModelView, a viewport view, the style arrow tables, and a tween-sink
registration surface; pick decode moves core-side.  No worker yet —
the same-thread path remains the default and must stay
byte-identical.  **Verified by** the full existing suite with the
goldens moving zero pixels, plus the round-42 restructure rule: a
green suite proves the paths resolve, so the proof is the call-site
diff audited against the one change the pass is allowed to make.
This pass is independently valuable — it is also the seam a WebGL
fallback renderer or a headless-Node renderer would mount through —
which is why it is separated from 86.3.

### 86.3 — the worker host, behind `renderer: { worker: true }`

Opt-in on `RendererOptions` (public-types.mts:528); the default is
untouched.  The worker bundle question — a rolldown worker entry
versus spawning from the existing UMD — is decided with
`test/modules/packaging.mjs`'s gates in mind, not around them.
Fail-loudly: absent OffscreenCanvas / worker-side
`navigator.gpu`, mount rejects with a clear message on the
`index.mts:60-65` precedent (whether a documented capability probe
should accompany it is an Open call — never a silent same-thread
fallback).  **Verified by**: a worker variant of a golden *subset*
diffed exact-zero against the same scenes' same-thread goldens (same
SwiftShader pin — the strongest available parity statement); the
renderer project's interaction specs run once under the worker
config; and a soak spec asserting the worker is terminated and the
instance collected across create/destroy cycles (the WeakRef
discipline).  The frame-driver note is re-verified deliberately:
worker rAF under CI's SwiftShader has never been measured here, and
the mid-flight specs' polling rule already assumes nothing about
when frames land.

### 86.4 — measure, record, close

A benchmark row whose subject is the point: **main-thread occupancy
per frame** under drag/animation at harness scale, worker versus
same-thread — total frame time would measure nothing, since the work
does not shrink, it moves.  Plus the pick-latency delta (one hop).
New suite ⇒ new fingerprint; publish serial per the standing rules.
Close: src/README.md section, MIGRATING/CHANGELOG rows if any public
surface moved, JSDoc gates, d.ts regenerated, this record.

### The round-73 dependency, flagged

This round's architecture **depends on round 73's outcome**, and
86.2 is where it bites.  If a WebGL fallback is built — pre- or
post-4.0 — the worker split must sit *above* renderer choice: the
message schema and RemoteModelView renderer-agnostic (nothing
WebGPU-typed in the contract), or the matrix becomes two renderers ×
two hosts with private plumbing in each cell.  If 73 recommends
never, the seam may keep WebGPU types and stay simpler.  Also
re-checked after 73: WebGL2-in-worker OffscreenCanvas support is
likely *broader* than WebGPU-in-worker (to-verify — 73.3's reach
table carries both columns), which could invert which renderer the
worker host serves first.  Whichever assumption this round builds
on, the record states it and names what 73's data would have to say
to overturn it.

### Risks named at planning

- The per-frame copy can eat the win on position-heavy frames: GPU
  force and GPU position tweens publish on-device (no spans), but
  CPU layouts and CPU-channel animations produce near-full-column
  spans every tick.  86.1's gate exists because this number decides
  the design, not tunes it.
- Worker rAF throttling differs per engine and changes background-
  tab behaviour; document against today's main-thread throttling
  rather than fixing what is not this round's subject.
- Two host configurations widen the Playwright surface; the worker
  tier runs a golden subset, exact where it runs, rather than
  doubling all 45.
- 86.2 is the stranded-doc-block refactor shape (65.4/65.8, 72.3's
  warning) — the JSDoc gate runs before each commit.
- `stats()` under a worker is a mirrored snapshot; a spec that
  samples it must key off `gpuFrameReadings` transitions, exactly as
  its doc comment already instructs (public-types.mts:573-577).

**Open:** the option shape and the unavailable behaviour (reject
loudly as planned, with or without a public capability probe); the
SharedArrayBuffer opt-in tier — pursue, or decline with the
measurement recorded; whether `stats()` stays a documented
stale-snapshot or goes async (recommendation: sync snapshot plus a
freshness field); the worker option's own pre/post-4.0 positioning —
it is additive and opt-in, so unlike 73's subject it does not change
what 4.0 *is*, and the recommendation is post-4.0 unless 73's
outcome bundles the two splits into one boundary round; whether
`startForce` crosses the boundary in pass 1 or waits; and whether
86.2 should be pulled forward to land beside round 73's decision,
since it is the seam both futures share.

### Landed

The round ran in the plan's order: the measure-first gate, then the
seam, then the worker host, then the measurement.  Each pass's record
was written with the pass.

#### 86.1 — the copy-cost gate: the copy design is affordable

The plan's first question — can a full `node.position` span cross a
thread boundary every frame? — is answered by measurement before any
design was committed.  `benchmark/worker-copy-bench.mjs` prices the
worst case the risks section named: a CPU-side position writer (CPU
layout tick, CPU-channel position tween, whole-graph drag) dirtying a
span covering the whole position column, every frame, sustained with
one message in flight at a time (the renderer's own coalescing
discipline).  Median of 300 frames on this machine (Node
`worker_threads`; browser `postMessage` shares the structured
clone/transfer machinery, and 86.4 confirms in situ):

| graph | span | slice (copy out) | clone round trip | transfer round trip |
| --- | --- | --: | --: | --: |
| ndex-x-large (19,607 nodes) | 153 KiB | 0.055 ms | 0.100 ms | 0.035 ms |
| 100k nodes | 781 KiB | 0.260 ms | 0.237 ms | 0.098 ms |
| 500k nodes | 3.8 MiB | 0.346 ms | 1.514 ms | 0.681 ms |

The control is the byte count itself: doubling n roughly doubles every
row, so the rows measure the copy and not the harness floor.

**The gate passes decisively.**  At harness scale the whole worst-case
round trip is a tenth of a millisecond against a 16.7 ms frame budget;
even at 500k nodes — beyond anything v4 has ever rendered — the
transfer-based trip is 0.7 ms.  Two calls fall out of the numbers:

- **The copy design is committed.**  Per-frame span messages, fresh
  slice per message, buffer transferred (transfer beats clone 2–3×
  and frees the sender's copy).
- **The SharedArrayBuffer opt-in tier is declined, with the
  measurement recorded** (the plan's own alternative resolution) —
  including the head-to-head, run under the same one-in-flight
  protocol.  A SAB design crosses only a `{start, end}` notice, so it
  is flat ~0.02 ms at every size; against the committed transfer
  round trip that saves **0.07 ms/frame at harness scale** (0.086 →
  0.018 ms), 0.14 ms at 100k nodes and 0.73 ms at 500k (0.747 →
  0.022 ms).  The relative win (4–34×) is real; the absolute win is
  noise against a 16.7 ms budget, and it would be bought with the
  cross-origin isolation SAB demands of every embedder plus a
  tearing-safety design (double buffering or epoch fencing) the
  measured row does not yet pay for.  Revisit only if a real app
  measures span traffic above ~1 ms/frame.

#### 86.2 — the seam: the renderer takes a host

The renderer no longer reaches into the core.  `src/render/host.mts`
defines the seam, and its `RenderHost` is the 86.1 coupling audit made
executable — a new renderer read now has to be added to an interface,
visibly, before it can compile:

- **`RenderStoreView`** extends the contract's `ModelView` with
  everything the renderer and label layer actually consume beyond it,
  enumerated: the frame-uniform scalars (`curveSlack`,
  `haystackSlack`, `outlineSlack`, `arrowScaleMax`, `arrowWidthMax`),
  the draw-gating counts (`parentCount` … `hasCurvedEdges`),
  `flushDerived`, `boundingBox` (export views), `compactEpoch`,
  `takeMapperSpans`, `nodeImagesAt`, and the label layer's font
  surface and `setLabelDims` write-back.  `GraphStore` satisfies it
  structurally; the census the plan asked 86.1 to produce is this
  interface plus the host members below.
- **`ViewportView`** (`pan()`/`zoom()`, read per frame),
  **`AnimationClock`** (`tick`/`active`/`attachDriver`/`detachDriver`),
  **`arrowEnds()`/`midArrowEnds()`** (the style engine's two tables,
  now snapshot-shaped accessors), **`onViewportChange`**,
  **`emitRender`/`emitError`**, and two capability seams:
  `gpuMappers` (null ⇒ no `MapperRuntime` is constructed — the
  CPU-applied style columns stay canonical) and
  `createImageDecoder` (null ⇒ the registry gets no rasterizer).
- **Pick decode moved core-side, as planned.**  The renderer speaks
  slots and packed ids only: `pick()` resolves a raw pick id (node
  `slot + 1`; edges carry `EDGE_PICK_BIT`), `pickNodeSync()` answers
  a slot, and `Core._decodePick` does the id decode plus the
  two-frame-staleness revalidation against the live model.  The
  pointer layer wraps sync picks through a `nodeAt` helper.  The
  renderer imports nothing from the core or the collection anymore.

Behaviour-neutrality, verified as the plan required: the full Node
tier green; the `renderer` Playwright project green; **all 45 goldens
exact — zero differing pixels — plus the live v3-parity diffs**, under
the same SwiftShader pin.  One `file:line`-keyed throw-gate exemption
(`MISATTRIBUTED`, the `exportScale` arrow const) was repointed 153→150
because the import block above it shrank — the gate failing on that
move is it working as designed.

#### 86.3 — the worker host, behind `renderer: { worker: true }`

Renderer-only in the worker, exactly the plan's pass-1 shape:

- **The engine is unchanged in kind** — the same `Renderer` class runs
  in the worker, constructed against an `OffscreenMount` (transferred
  canvas + explicit device-px size + the main thread's resolved dpr)
  instead of a container; `setSize` replaces the ResizeObserver, the
  glyph atlas rasterizes on an `OffscreenCanvas` where `document` is
  absent, and export views arrive pre-resolved (`exportFromView`; the
  view maths extracted as the pure `resolveExportView`).
- **The message contract** (`worker-protocol.mts`, written first, under
  the contract.mts discipline): one `StoreBatch` shape serves the init
  transfer and every per-frame drain — wire spans with transferred
  buffers, blob dirt, label sidecar entries, the scalar/count/font
  snapshot, arrow-end tables and viewport.  `buildBatch` +
  `collectTransfers` are pure over the store, so the Node spec
  exercises the very code the proxy runs.
- **`RemoteModelView`** (`remote-view.mts`) implements the whole 86.2
  `RenderStoreView` seam over local mirrors, re-expressing each batch
  through the same `DirtyTracker` class the store uses — the renderer's
  frame drains an ordinary `StoreDelta` and cannot tell the hosts
  apart.  Measured label dims flow back (`labeldims` messages) into the
  canonical store, where label bounds and the text-events pick live.
- **The proxy** (`worker-renderer.mts`) satisfies `RendererLike` and
  the pointer layer's new `GestureRenderer` surface.  Main-side, by
  design: the canonical store, the DOM canvas (events land on it — no
  input forwarding, as planning predicted), the sync CPU node pick
  (`pickNodeAt` over canonical columns; never mirror-stale), the
  animation clock (the manager's own sink-less rAF loop), and export
  view resolution.  Worker-side: frames, culls, uploads, GPU edge
  picks, label rasterization, exports.
- **The spawn** is the packaging answer the plan asked 86.3 to decide:
  the worker loads *the same bundle* from its own URL —
  `importScripts` for the UMD script-tag path, a message-buffering
  dynamic import for native-ESM — and calls
  `cytoscape.__runRenderWorker__` (underscored machinery; excluded
  from the docs generator's statics and, via a cast at the assignment,
  from the shipped declaration).  No second build artifact, so
  `test/modules/packaging.mjs` is untouched.
- **Fail-loudly**: mounting without Worker/OffscreenCanvas throws its
  own clear message (spec'd in Node, where neither exists); a worker
  without WebGPU rejects `ready` through an `initerror` message.  No
  silent same-thread fallback, per the plan.  Device loss forwards
  out; the core's existing unmount/mount recovery respawns a fresh
  worker through the same `_attachFn`.

**Verified**: the plan's own strongest statement — the same scene
exported through both hosts on the pinned SwiftShader adapter diffs
**exact-zero**, twice (static, and again after style + position + zoom
mutations crossed the boundary).  Also spec'd in the browser: label ink
plus the dims write-back (observable as the main-thread bounding box
growing), node/edge/background picks through the proxy, and three
create/destroy cycles leaving a healthy page.  In Node
(`test/modules/worker-renderer.mjs`): full-state and incremental
mirroring across a real `structuredClone`, capacity growth, the
delta re-expression, dims batching — and the control, a
deliberately-tampered batch that leaves the mirror provably wrong.

**Deferred in-round, recorded** (each was the plan's own contingency):
background images (the proxy zeroes the count and emits one loud error
event; `createImageBitmap` decodes are the follow-up), GPU tweens and
`startForce` across the boundary (CPU paths are correct today; the
copy cost of their per-frame spans is exactly what 86.1 priced),
`@font-face` labels in the worker (the worker's FontFaceSet does not
inherit the page's registrations; system faces render), and the
SharedArrayBuffer tier (declined on 86.1's numbers).  The three
worker-host deferrals are also logged as **ledger item 51**, so they
are findable from the open-calls ledger and not only from this record.
One incidental find, since diagnosed to invocation shape and given its
own round (**round 109**): `test/force-layout.mjs`'s spectral-seed
spec fails deterministically when the file runs without the tier's
`--import ./test/node-test-setup.mjs` preload, and passes 13/13 with
it — pre-existing at the branch base, unrelated to this round.

#### 86.4 — the measurement: whose thread pays

`benchmark/worker-occupancy-bench.mjs` measures the subject the plan
named — main-thread cost per frame, worker versus same-thread — under
the 86.1 gate's worst case made real: a main-side rAF loop rewriting
every position of a 20,000-node / 30,000-edge graph each frame (the
shape of an external CPU layout tick or a whole-graph drag), plus a
renderer-dominated control (viewport spin, writer trivial) and the
pick-latency delta.  240 frames per mode, warmed, on this machine's
**real AMD adapter** (the run prints the adapter identity and carries
a `--swiftshader` mode for the software-adapter case):

| mode | writer loop | main busy | renderer cpuFrame | pick rtt | frames drawn |
| --- | --: | --: | --: | --: | --: |
| same-thread | 16.90 ms/frame (59.2 fps) | 52% | 0.20 ms (on main) | 0.4 ms | **120 / 240** |
| worker: true | 17.54 ms/frame (57.0 fps) | 52% | 0.20 ms (in worker) | 1.0 ms | **236 / 240** |
| same-thread, viewport spin | 16.94 ms/frame | 51% | 0.20 ms | — | 238 / 240 |
| worker, viewport spin | 17.60 ms/frame | 51% | 0.20 ms | — | 236 / 240 |

Read honestly, three findings:

- **The costs are as 86.1 predicted and small**: ~0.7 ms/frame of
  batch build + post on the writer loop, and +0.6 ms on the async
  edge-pick round trip (the one hop).
- **The occupancy win is negligible on this hardware — and that is a
  finding about v4, not about the worker.**  The same-thread
  renderer's whole per-frame CPU cost at this scale is **~0.2 ms**:
  the render-on-dirty architecture already keeps the main thread
  nearly idle, so there is little occupancy left to move.  The
  worker's occupancy case rests on configurations where that number
  is large — software adapters, heavier scenes — not on healthy
  desktop GPUs.
- **The visible benefit is cadence isolation.**  With the main loop
  saturated by the writer, the same-thread host painted **half its
  frames (120/240)** — the writer and the renderer's rAF contend for
  the same 16.7 ms — while the worker host painted **236/240**: the
  graph stays visually smooth under exactly the load that degrades
  the same-thread path.  The viewport-spin control shows both hosts
  at full cadence when the main thread is idle, pinning the writer
  contention as the cause.

**The software-adapter case, measured rather than assumed** (the
plan's frame-driver note said worker rAF under SwiftShader had never
been measured here; now it has).  At harness scale SwiftShader is
simply unusable — the same-thread writer loop measured **2,527
ms/frame (0.4 fps)** before the run was cut off — so the datapoint
comes from a 2,000-node / 3,000-edge scene: both hosts are
compositor-bound at 2–3 fps (the rAF cadence waits on software
rasterization regardless of which thread encodes), the worker host
again painted **every frame (60/60 and 59/60) against same-thread's
31/60 and 41/60**, and it added ~30% to the main rAF interval.  The
conclusion transfers: on a software adapter the worker cannot make
SwiftShader fast, it can only keep paint cadence — which it does.

**The recommendation the plan left open is taken by these numbers:
the worker host stays opt-in, and post-4.0.**  It is additive, its
costs are real but small, and its benefit today is smoothness under
main-thread saturation rather than a wholesale occupancy win —
worth having, not worth changing what 4.0 is.
