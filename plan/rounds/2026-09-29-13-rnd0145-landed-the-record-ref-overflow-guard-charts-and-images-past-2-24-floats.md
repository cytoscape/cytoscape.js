## The record ref overflow guard: charts and images past 2^24 floats

A correctness fix, taken as a round.  There was no plan file: the spec
is the latent defect item 73's capacity measurement recorded
(`2026-09-29-12-rnd0000-note-items-72-and-73-prepared-the-head-gallery-and-the-chart-capacity-measurement.md`,
"A latent defect the measurement found").  `node.chartRef` and
`node.imageRef` pack `offset | count << 24`, and nothing checked the
24-bit offset: a pool past 2^24 floats ORed the offset's high bits into
the count, so the record read back and drawn was the wrong length, from
the wrong place.  The note put the charted-node ceilings at ~305k at 16
values, 84k at 64 and 21.7k at 255.

**Scope.** The guard, for both refs, **without changing the packing** —
the packing (P1 with a guard, or P2's `offset + 1` with n from the
header) is item 73's sitting call and stays open.  Behaviour follows
round 138's contract.

### The round, as carried out (2026-09-29)

Measured on the i9-9900K (Fedora 43, Linux 7.1), Node 24.18, the RX 580
through Chromium's Vulkan WebGPU (`npm run gpu`: HARDWARE); the
Playwright `renderer` project also under CI's SwiftShader (`CI=1`).

| # | Commit | What landed |
| --- | --- | --- |
| 145.1 | `131113d7` | the guard: the store saturates, readback reads the pool's table, the mirror declines, charts/images degrade; the specs; the README section |
| 145.2 | this commit | the close |

**The call: degrade, not refuse.**  Round 138's rule for the model-side
pre-flight is that it holds "only the columns a group cannot draw
without"; charts and images are the degradation order's second step.
A `cy.add()` that refused a graph because its pies no longer fit would
be exactly the throw-over-a-feature round 138 declined for the gradient
columns.  So an unaddressable pool is treated as a declined allocation
of that feature: a placeholder buffer, the pass skipped for the
renderer's life, one `gpuerror` (`kind: 'unfit'`, the blob's label,
`degraded: 'charts'` / `'images'`).

**What landed.**

- `REF_OFFSET_FLOATS` (2^24) and `REF_OFFSET_MASK` in `src/contract.mts`.
- **The store never corrupts a ref** (`packRecordRef` in
  `src/store/graph-store/images.mts`).  An offset past the reach
  saturates at `0xffffff`; the count stays exact.  That matters beyond
  the draw: a compaction's relocation reads the count back out of the
  ref, so before the fix a corrupted count survived the record moving
  back under the boundary — the spec's compaction case read 255 where
  254 was written.  No chart or image record can sit at the saturated
  offset legitimately (every record is longer than one float).
- **Readback reads the pool's own offset table** (`chartAt`,
  `nodeImagesAt`), so `style('chart-values')`,
  `style('background-image')` and their peers are exact on both sides
  of the boundary, headless included.  `decodeNodeImages` takes the
  offset as an optional argument; the worker host's mirror, which has no
  offset table, still decodes from the field.
- **The renderer degrades** (`src/render/column-mirror.mts`,
  `pastRefReach`): once the chart or image pool's used length passes
  2^24 floats — checked at every resize and span — the mirror stands the
  four-byte placeholder in and reports `{ label, bytes, floats }`;
  `onMirrorUnfit` degrades with a message naming the 24-bit reach.
  Conservative by at most one record (the one straddling the boundary is
  still addressable).
- **The worker host** runs the same `Renderer` and mirror, so the rule
  holds there unchanged; `gpuerror` crosses as round 138 wired it.  One
  worker-specific change: `promoteVectors` (the vector-image demand
  meter) returns while images are degraded, since the worker's pool
  mirror would decode a saturated ref.
- Docs: `src/README.md` "The record ref's reach (round 145)", the
  `GpuErrorInfo.kind` JSDoc, the two ref columns' contract comments,
  and a wrong note in the mirror's header (the poly blob holds one
  record per polygon-shaped node, not per distinct polygon).

### The measurements

**The real boundary, reproduced before the fix** — no seam was needed:
the real 2^24 pool is cheap in Node.

| path | nodes to cross | build | before the fix | after |
| --- | --: | --: | --- | --- |
| store, 254-value charts (769 floats) | 21,818 | ~0.9 s | count 255, values of another record | exact |
| store, 254 images (3,048 floats) | 5,506 | ~0.6 s | 255 images | exact |
| public API, 16-slice pies (55 floats) | 305,042 | 0.75 s | `chart-values` read 17 values, the last 13 colour words | exact |
| public API, four images (48 floats) | 349,527 | 1.26 s | 5 × `a.png`, opacity 39321 | exact |

254, not 255, in the store specs: a count with bit 0 already set hides
the OR (255 | 1 = 255).  The style layer caps charts at 16 slices and
images at 4, which is why the public-API rows need 305k and 350k nodes.
All four rows are specs in `test/record-ref.mjs` (13 specs, ~4 s).

**In the browser** (`limits.spec.js`, "the record ref's reach", both
hosts): 21,816 charted nodes — the last inside the reach — draw two red
pies on screen (> 1,000 red pixels, the spec's own control), two more
records cross it, and the export then has **zero** red pixels, with one
`gpuerror` `['unfit', 'cy-gpu:chart-blob', 'charts']`; 5,506 imaged
nodes give `['unfit', 'cy-gpu:image-blob', 'images']`.  1.2–1.6 s a spec
on the RX 580; the whole `limits.spec.js` (13) green under `CI=1`.

**Controls**, each run once and red as it should be:

- the fix absent (the constant alone, before any `src/` change): 8 of the
  first 11 store specs fail — the count, readback, degrade and
  compaction cases for both refs;
- the saturation removed (`packRecordRef` writes the raw offset): 8 of
  13 fail;
- readback from the ref field instead of the pool's table: 4 of 13 fail;
- the mirror's check off (`REF_KINDS` empty): 2 of 13 Node specs fail,
  and all 4 browser specs (both hosts, charts and images).

### Found, not fixed

- **The custom-polygon pool has the same exposure.**  Its ref in
  `node.borderGeom[0]` packs the same way, per polygon-shaped node:
  measured, the 1,048,577th node with an 8-point `shape-polygon-points`
  reads back 9 points (3.0 s headless).  It is out of this round's scope
  and has no degradation step — a polygon is the node's shape, not a
  feature it can draw without — so its guard is a different call
  (refuse in the pre-flight, draw the bounding shape, or item 73's P2
  packing applied to it).  Logged here and in `src/README.md` as a
  follow-up.

### Deferred

- **The packing itself** (item 73's question 4: P1 with this guard, or
  P2) remains the sitting's call.  With P2 the ref no longer carries a
  count and this guard's reach moves from 2^24 floats to the binding;
  the degrade path stays as it is.

### Verification

`npm run -s verify` green; `npm run -s test:node:quiet` green (zero
output) at the fix, after moving throw-coverage's allowlisted mirror
throw from line 280 to 299 (the mirror's header grew);
`npm run -s test:types:run` and `test:types:surface:run` green (a JSDoc
change on a public type).  Playwright under `CI=1`: `limits.spec.js`
13/13; the `renderer` and `visual` projects 396 passed, 5 failed, 3
flaky, 1 skipped.  Rerun alone, two failures persist — round 75's two
container-resize specs (same-thread and worker) — and round 144's tween
spec is flaky on both hosts; all three do exactly the same on the tree
with this round's `src/` stashed, so they are pre-existing and
unrelated.  The worker create/destroy and worker-fonts failures passed
on the rerun (load from the concurrent run).

**Round 145 is complete.**
