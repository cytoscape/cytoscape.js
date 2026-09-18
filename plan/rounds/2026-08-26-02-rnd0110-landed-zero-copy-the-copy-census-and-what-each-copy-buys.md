## Zero-copy: the copy census, and what each copy buys

Raised by the maintainer on 2026-08-26, off the back of round 86's
SharedArrayBuffer head-to-head: performance is a top-priority goal for
v4 — along the lines of SAB, can copying be removed *generally*, not
only at the worker boundary?  This is the feasibility record and the
prospective plan.  Planning read the code rather than the question,
and the finding that organises the round: **v4 is already at or near
the zero-copy floor on most paths, and the floor itself is set by
WebGPU, not by v4** — so the round is a census that prices every
remaining copy, then removes only the ones whose price survives
measurement.  Copies are not free to remove: each one below buys
coherence, growth, isolation or portability, and the analysis says
what, per path.

### The inventory — every copy a byte pays today, verified

1. **Wire decode is already zero-copy.**  `deserializeElements`
   returns typed-array *views over the incoming buffer*: the encoder
   aligns every section to its element width (`alignTo`,
   `wire.mts:236/254`) exactly so the decoder never copies, and the
   one copy in the path fires only for a *misaligned view* handed in
   (`wire.mts:297-303`, base not 8-aligned) — a caller-induced case.
   Nothing to remove here; the design already made this trade in
   round 46.5.
2. **Bulk ingest copies payload columns into store backing.**
   `_addColumnar` writes the payload's per-element columns into the
   store's own arrays (which carry growth slack and live beside ~40
   style-derived columns the payload does not have).  This is the one
   *load-time* copy with removal potential: the store could **adopt**
   a payload column's buffer as its initial backing for the columns
   the wire carries, copy-on-grow afterwards.  What the copy buys
   today: a capacity policy independent of payload size, and a store
   that never aliases caller memory (a caller mutating the buffer it
   handed in cannot corrupt the model).  Whether it is worth buying
   back is a measurement: rounds 66/67 took monolithic init to 622 ms
   headless, and nobody has measured what share of that is the column
   copy against parse, id-map build, adjacency and style apply.
   Expectation to falsify: the copy is single-digit milliseconds of
   the 622 and adoption is declined with the number recorded.
3. **The per-frame CPU→GPU upload is the floor, and it is WebGPU's.**
   `ColumnMirror` uploads one coalesced span per dirty column via
   `queue.writeBuffer` — which the WebGPU spec defines as a copy into
   a driver staging area (Dawn manages the ring).  WebGPU has **no
   persistent host-coherent mapping**; the alternatives
   (`mapAsync` staging rings, `mappedAtCreation` for full uploads)
   re-implement Dawn's own machinery and still copy once.  The dirty
   span discipline already minimizes *bytes*; the per-byte copy
   cannot go to zero on this API.  The census still measures it
   (`stats().uploadedBytes` exists) so the record can say "at the
   floor" with a number rather than a shrug.
4. **The worker boundary** (round 86): 0.086 ms/frame at harness
   scale, 0.747 ms at 500k nodes, versus a flat ~0.02 ms for a SAB
   span-notice design — measured head-to-head, recorded in 86.1's
   landed record.  What the copy buys: transactional coherence (a
   batch is a snapshot; SAB needs double-buffering or epoch fencing),
   no COOP/COEP demand on embedders, trivial capacity growth, and a
   protocol testable headless via `structuredClone`.  The SAB tier is
   a designed-but-deferred pass of this round (110.3), armed by 86's
   own trigger: a real app measuring span traffic above ~1 ms/frame.
5. **Export readback does per-pixel CPU work, not just a copy.**
   `readbackExport` maps the staging buffer, then walks every pixel
   in JS: row-unpad, BGRA swizzle, un-premultiply
   (`renderer.mts`, the `readbackExport` loop) — at a 4K-class
   publication figure that is ~33 MB touched byte-by-byte in JS,
   *then* `cy.png` copies again through canvas2d `putImageData` →
   `toDataURL`.  This is the plainest win on the list: a small
   compute pass can un-premultiply and compact rows on-GPU so the
   mapped buffer is already final pixels, and the result can transfer
   to the caller (the worker host already transfers it).  Rounds
   77/78 (SVG export, headless figure generation) sit next to this.
6. **Small, already-cheap crossings**: label sidecar entries cross
   the worker boundary as structured clones (tens of bytes each,
   label-dirty only); algorithm results and force settle readbacks
   are one-shot per run, not per frame.  The census confirms they
   stay under the line rather than assuming it.

### What "remove the copying" cannot mean here

- **Not the GPU upload** — the API has no zero-copy path (item 3).
- **Not aliasing caller memory silently** — a store that adopts a
  buffer must own it; the wire path can promise that (the payload is
  purpose-built), `options.elements` arrays from an app cannot.
- **Not SAB by default** — cross-origin isolation is an embedder-wide
  demand a library cannot impose (86.1's recorded decline); it can
  only ever be an opt-in tier behind a capability check.

### The plan

- **110.1 — the copy census, measured.**  Instrument bytes-copied and
  ms per pathway — ingest (parse / id blob / column copy / adjacency
  / style apply split), per-frame mirror upload, worker batches,
  export readback — on `ndex-x-large` at load and on an animated
  session, headless and rendered.  Publish the table in the record
  and `src/README.md`.  **The gate for every later pass**: a pathway
  proceeds only if it prices at ≥1 ms/frame sustained or ≥5% of init;
  everything under the line is recorded as *at the floor / declined*
  with its number, the way 86.1 recorded SAB.
- **110.2 — zero-copy bulk ingest (adopt wire columns), if the census
  says so.**  The store adopts aligned payload buffers as initial
  backing for the per-element columns the wire carries; copy-on-grow
  restores the ordinary policy on the first capacity change.
  Constraints named now: adoption applies to the wire/columnar path
  only (ownership is promisable there); it fits the *fresh-instance*
  bulk load, where slots allocate contiguously from 0 so a payload
  column's layout is the store's layout — `edge.endpoints` is the
  exception even then, since ingest remaps payload node *indices* to
  slots (`addEdgesColumnar`), a transform rather than a copy, though
  on a fresh instance the identity mapping makes even that adoptable; the fuzz gates (48.3) must
  run against adopted backing too, and round 103's progressive
  ingest composes — each chunk's columns adopt the same way.  Ties
  to ledger item 43: if the wire format goes public, its alignment
  guarantee becomes contract, and this pass is the reason to write
  it down.
- **110.3 — the SAB tier for the worker host, designed now, built on
  trigger.**  Write the design in full — per-column double-buffered
  epochs (the worker reads buffer `epoch % 2`, main writes the
  other; the batch notice flips), growable SAB with a declared
  ceiling (ties to item 35's scale-ceiling round), a capability
  probe (`crossOriginIsolated`), loud rejection without it, spelled
  `renderer: { worker: true, sharedMemory: true }` — and land the
  spec of the design, not the code, unless 86's ≥1 ms/frame trigger
  has fired by then.  The 86.1 head-to-head (0.02 ms flat vs
  0.086–0.747 ms) is the whole benefit side of that ledger; the
  design doc is what makes the trigger actionable in an afternoon
  instead of a round.
- **110.4 — export post-processing moves to the GPU.**  A compute
  pass un-premultiplies and row-compacts into the staging buffer, so
  the map yields final pixels; `png()`/`jpg()` keep their encoders
  but stop double-copying through an intermediate canvas where a
  direct encoder path exists.  Verified by the existing WYSIWYG
  export specs plus one new golden-sized-export timing row.
  **First measurement before building**: the current JS loop's ms at
  1×, 2× and full-graph export sizes — if even the 4K figure is
  single-digit ms, this pass is declined too.
- **110.5 — the record.**  Whatever the census declines is written
  as a decided-against with its number, in `src/README.md`'s design
  decisions — so the next "can we remove the copying?" starts from a
  table instead of from this question again.

### Sequencing and non-goals

Run 110.1 any time; it is instrumentation plus one sitting of
measurement.  110.2 and 110.4 are independent afterwards; 110.3's
*design* can be written with 110.1, its build waits for the trigger.
Nothing here touches the dirty-span discipline, the wire format's
layout (beyond documenting the alignment promise), or the round-106
multi-consumer question — though 110.3's epoch scheme is deliberately
shaped so a second consumer (106's cursors) could share it.

Non-goal: chasing relative ratios.  The SAB row reads "34× faster" at
500k nodes and is still 0.73 ms of a 16.7 ms budget; every pass above
gates on absolute cost against the frame or init budget, which is the
lesson 86.4 just paid for (the occupancy win that "obviously" existed
measured at ~0.2 ms because the architecture had already removed it).

### Landed (2026-09-18)

Run on the benchmark machine (i9-9900K, AMD RX 580 / gcn-4, Chromium
via Playwright on the hardware adapter, Node 24 through the built
bundles), against ndex-x-large (19,607 nodes, 464,657 edges, a 9.99 MB
wire payload).  Two instruments landed with the numbers so the table
can be re-taken: `benchmark/copy-census-headless.mjs` (the ingest
phases through `build/cytoscape.esm.mjs`, plus a `--profile` /
`--aggregate` pair that splits a CPU profile by the ingest's own
function names) and `benchmark/copy-census.mjs` (Chromium: patches
`GPUQueue.writeBuffer`, `GPUBuffer.mapAsync` and `Worker.postMessage`
in-page before the instance exists, then runs the load, an idle hold,
a viewport spin, the 86.1 writer worst case, whole-sheet restyles and
four exports through both hosts; rows assert what they are named for
and print a warning otherwise).

#### 110.1 — the census, measured

**Ingest (headless, medians of 5 through the ESM bundle).**  Init
from wire views **370 ms**, from the columnar form 335, from
definitions 432 (round 67's 622 has moved on with rounds 67.3–103).
Decode is zero-copy as designed: all six numeric columns of the
payload are views over the wire buffer (`positions`, `sources`,
`targets`, both `selected` columns, `Mechanism_of_Action`; the two
dictionary columns' index arrays too — the spec asserts it and the
bench exits non-zero if a copy creeps in).  What the wire form pays is
5.3 ms of decode (the 19,607-entry name dictionary), against JSON's
440 ms parse + 98 ms convert.

The split, from a CPU profile of three wire-form inits (inclusive ms
per init, `--aggregate`):

| phase of init | ms | share | copy? |
| --- | --: | --: | --- |
| `_applyStyle` (style apply, both groups) | 177 | 48% | no — derivation |
| `registerBulk` → `IdIndex.setBulk` (465k generated edge ids) | 120 | 32% | no — string interning |
| `ingestDataColumns` (per-slot `set` of the numeric column) | 16 | 4% | scatter, not memcpy |
| `addBulk` → `buildCsr` (adjacency) | 7 | 2% | no — derivation |
| endpoint index→slot remap (3.7 MB) | 1.4 | 0.4% | a transform |
| `allocBulk` + `writeBulkFlags` | 2.6 | 0.7% | fill |
| **position column memcpy (157 KB)** | **0.006** | **0.002%** | **the one true copy** |
| `deserializeElements` | 5.6 | 1.5% | dictionary decode |

The load-time column copy the plan asked about is **1.4 ms of 370
(0.4%)**, and 1.38 of that is the endpoint remap, which is a
transform — a payload index becomes a slot — rather than a copy.  The
memcpy proper is six microseconds.  **110.2's gate (≥5% of init) is
missed by an order of magnitude**; see below.  The finding the profile
does surface is elsewhere: **registering 465k generated edge ids costs
120 ms, a third of init** — logged as ledger item 66.

**Rendered (Chromium, hardware adapter, same-thread host).**

| pathway | bytes | ms | per | verdict |
| --- | --: | --: | --- | --- |
| first frame's full-state upload | 95.0 MB in 54 `writeBuffer`s | 62 | one-shot | at the floor: `writeBuffer` 33.6 ms vs `mappedAtCreation` 32.1 vs a JS memcpy 37.5 for the same 95 MB |
| idle hold, 60 frames | 0 | 0 | frame | — |
| viewport spin, 240 frames | 17 KB (the frame uniform) | 1.2 | run | — |
| **writer worst case** (every node moved every frame) | 153 KB per drawn frame — one position column | **0.012** | frame | at the floor; 86.1's 0.086 was the whole round trip |
| whole-sheet `cy.style()` re-apply | 59.6 MB per apply | 22 | apply | the dirty-span floor for a full re-apply (every column re-derives); the apply itself is 198 ms — style path, not copy (item 67) |
| export readback loop, viewport 1× (4.1 MB) | 4.1 MB | **10.3** | export | **110.4** |
| export readback loop, viewport 2× (16.4 MB) | 16.4 MB | **40.9** | export | 110.4 |
| export readback loop, full 4k (32.8 MB) | 32.8 MB | **81** | export | 110.4 — a quarter of the 335 ms export, 14% of `png()`'s 562 |
| export readback loop, full 8k (131 MB) | 131 MB | **332** | export | 110.4 — of a 1,154 ms export |
| `png()`'s canvas hop (`putImageData`) | 4.1 → 131 MB | 0.4 → 11.7 | export | at the floor; the encoder (`toDataURL`) is 24 → 704 ms and is not a copy |

**Worker host** (`renderer: { worker: true }`): the initial full-state
transfer is 88.1 MB in 3 posts, 39 ms; the writer worst case posts
153 KB per batch at **0.018 ms/post** (240 batches, 173 frames drawn
against the same-thread host's 120 — 86.4's cadence-isolation finding
again); the spin posts a 0-byte viewport notice per frame at 0.006 ms.
Nothing on the worker boundary approaches the 1 ms/frame trigger:
86.1's design holds at 1/50th of the line.

**The small crossings (inventory item 6), confirmed under the line by
their byte counts**: label sidecar entries ride the same batch as the
spans above (tens of bytes each, label-dirty only); a force settle
readback is one 157 KB map per run; an algorithm result is one map per
run, whose ~3.5 ms `mapAsync` floor 72.1 already priced — one-shot,
not per frame.

#### 110.2 — zero-copy bulk ingest: declined, with the number

The column copy is 0.4% of init and the memcpy proper 0.002%; the
gate was 5%.  Adopting wire buffers as store backing would buy nothing
measurable and cost the two things the copy buys — a capacity policy
independent of the payload, and a store that never aliases caller
memory.  Declined; the number is in `src/README.md`'s design
decisions so the question starts from the table next time.  The
alignment promise the decoder's zero-copy views rest on is now written
on `serializeElements` as the encoder's contract (item 43 inherits
it).

#### 110.3 — the SharedArrayBuffer tier, designed, not built

The census re-measured 86's trigger and it has not fired (0.018
ms/post against a 1 ms line), so the design lands and the code does
not.  The design, in full, so the build is an afternoon when a real
app measures span traffic above the line:

- **Spelling and gate.**  `renderer: { worker: true, sharedMemory:
  true }`.  Construction probes `globalThis.crossOriginIsolated` and
  `typeof SharedArrayBuffer`; without both it throws — loudly, naming
  the two headers the page needs (`Cross-Origin-Opener-Policy:
  same-origin`, `Cross-Origin-Embedder-Policy: require-corp`) —
  rather than silently taking the copy path, the executor-'gpu'
  precedent.  `sharedMemory` without `worker` throws too.
- **Layout.**  One `SharedArrayBuffer` per column, sized to the table's
  capacity, **double-buffered by epoch**: two regions per column, the
  writer (main) writes region `epoch % 2` while the reader (worker)
  draws from the other.  A batch becomes a *notice* — `{ epoch,
  spans: [{ column, start, end }] }`, no bytes — and the worker copies
  each span from the shared region into its local column at the
  notice (so its cull/draw reads stable arrays, as today), then posts
  an ack.  Main advances the epoch only after the ack, so a region is
  never written while it is being read: transactional coherence without
  fences, at the cost of one extra span copy on the worker side (which
  is the copy `RemoteModelView` already makes today).
- **Growth.**  A table grow allocates a new pair of regions at the new
  capacity, posts a `{ kind: 'regrow', column, buffer }` message
  carrying the new SAB (structured clone shares it — no copy), and
  the worker swaps on receipt; the old pair is released once acked.
  A declared ceiling — `sharedMemory: { maxSlots }`, default the
  table's cap at construction rounded to the ×2 step — refuses growth
  past it with the round-35 scale-ceiling message, so an app that
  opted in knows its budget.
- **Blobs and labels** stay on the message path: the float pools
  (curves, polygons, images, charts) are resized rarely and copied
  whole today, and label entries are tens of bytes.  Only the
  per-element columns move to shared memory, because they are the
  only per-frame traffic the census found.
- **Testing** (when built): the protocol spec runs headless against a
  `worker_threads` pair sharing a real SAB; the tearing control writes
  a column mid-notice and asserts the worker's local copy is the
  epoch's, not the writer's; the ceiling spec grows past `maxSlots`
  and reads the throw; the 86.3 export-parity scene runs a third time
  under `sharedMemory`.
- **Benefit side, already measured**: 0.018 → ~0.006 ms per batch at
  harness scale (the notice is what the spin posts today), 0.681 →
  0.02 at 500k nodes (86.1).  The trigger stands: a real app above
  1 ms/frame of span traffic.

#### 110.4 — export post-processing on the device: landed

`src/render/export-pack.mts`.  The export target gains
`TEXTURE_BINDING` and loses `COPY_SRC`; after the scene pass, one
compute dispatch reads the premultiplied target through `textureLoad`
(the format's own swizzle makes the channel order RGBA under
`bgra8unorm` and `rgba8unorm` alike), un-premultiplies exactly as the
CPU loop did — alpha 0 and 1 pass through, every other alpha divides —
and packs each pixel as one `u32` into a tightly packed storage buffer,
which is copied into the mappable staging buffer.  The readback is a
`slice()` of the mapped range: the one copy WebGPU's mapping model
cannot remove.  The dispatch runs in row bands of a multiple of 64 rows
so every band's byte offset is 256-aligned for any width, because the
storage binding limit (128 MiB by default) is smaller than the largest
export the texture limit allows (an 8192² figure is 256 MiB).  Both
hosts take the pass — the worker engine runs the same renderer.

Measured, same session shape as the census, medians of three:

| export | readback loop before → after | export before → after | `png()` before → after |
| --- | --: | --: | --: |
| viewport 1× (1280×800) | 10.3 → **1.4 ms** | 76 → 67 | 119 → 122 |
| viewport 2× (2560×1600) | 40.9 → **6.3** | 122 → 79 | 223 → 196 |
| full 4k (4096×2004) | 81 → **12.4** | 335 → 257 | 562 → 451 |
| full 8k (8192×4007) | 332 → **51.7** | 1,154 → 878 | 1,756 → 1,461 |

The remainder is the slice memcpy plus the promise hop; the GPU wait
(65 → 803 ms across the sizes, the scene pass over 465k edges plus the
copy) and the PNG encoder are what an export costs now.  The canvas
hop in `png()` (`putImageData`, 2.6 ms at 4k) was priced and left: no
direct RGBA→PNG encoder exists outside a canvas.

**Verified by** the existing export specs (`renderer.spec.js`'s nine
`png()`/`jpg()` specs, the worker host's export-parity scene in
`worker-renderer.spec.js`, the 130-golden visual project — all green,
goldens unchanged) plus one new spec, *png() un-premultiplies on the
device*: a red body at opacity 0.5 over a transparent background must
read (255, 0, 0, 128), not the target's premultiplied (128, 0, 0,
128).  **Control**: the shader's un-premultiply replaced by `un = 1.0`
turns that spec red (red reads ~128) while the older transparent-
background spec stays green — which is why the new one exists.  The
WebKit project skips the export specs here (no adapter for them on this
box's WebKit), as before the round.

#### 110.5 — the record

`src/README.md` gains the census as a design decision, with every
declined pass and its number; the two bench files carry their own
headers; ledger items 66 and 67 log the two findings the census made
that are not copies (edge id registration, whole-sheet re-apply
upload).  Nothing else moved: the dirty-span discipline, the wire
layout and the 106 multi-consumer question are untouched, as the plan's
non-goals said.

**Lessons the round writes down.**  An instrument that reads a
transferred buffer's `byteLength` *after* `postMessage` reads zero —
the call detaches it; count before.  And the un-premultiply's old
transparent-background spec never discriminated the conversion: it
sampled an opaque body and a fully transparent pixel, the two cases the
conversion passes through unchanged.
