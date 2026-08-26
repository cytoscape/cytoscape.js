## The worker-hosted renderer, landed

The round ran in the plan's order: the measure-first gate, then the
seam, then the worker host, then the measurement.  Each pass's record
was written with the pass.

### 86.1 — the copy-cost gate: the copy design is affordable

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
  measurement recorded** (the plan's own alternative resolution).
  SAB would erase a cost that measures at 0.1 ms while demanding
  cross-origin isolation the library cannot impose on embedders.
  Revisit only if a real app measures span traffic above ~1 ms/frame.

### 86.2 — the seam: the renderer takes a host

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

### 86.3 — the worker host, behind `renderer: { worker: true }`

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
SharedArrayBuffer tier (declined on 86.1's numbers).  One incidental
find: `test/force-layout.mjs`'s spectral-seed spec fails when the file
runs *standalone* on this machine while passing in the full tier —
pre-existing at the branch base, unrelated to this round, left for its
owner.

### 86.4 — the measurement: whose thread pays

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

**The recommendation the plan left open is taken by these numbers:
the worker host stays opt-in, and post-4.0.**  It is additive, its
costs are real but small, and its benefit today is smoothness under
main-thread saturation rather than a wholesale occupancy win —
worth having, not worth changing what 4.0 is.
