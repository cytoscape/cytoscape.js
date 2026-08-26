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

### 86.3 — the worker host

(recorded with the pass)

### 86.4 — the measurement

(recorded with the pass)
