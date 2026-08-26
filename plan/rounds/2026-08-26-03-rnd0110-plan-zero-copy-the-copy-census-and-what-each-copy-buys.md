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
