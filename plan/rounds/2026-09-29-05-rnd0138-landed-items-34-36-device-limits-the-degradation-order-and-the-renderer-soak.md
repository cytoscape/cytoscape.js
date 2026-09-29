## Ledger items 34–36: device limits, the degradation order and the renderer soak

Ledger items 34 (a renderer soak tier), 35 (the scale ceiling) and 36
(the VRAM budget, and failing gracefully), built together as one round.
There was no plan file: the spec is the three items' text in `PLAN.md`
— item 35 carrying the 2026-09-18 measurement and its recommendation,
item 36 the byte price and the degradation order — and their lines in
the eleventh sitting's note
(`2026-09-28-01-rnd0000-note-the-eleventh-design-sitting-the-open-calls-one-by-one.md`).

**Calls taken at the sitting (2026-09-28).**  Before alpha.  Growth past
the device's limits makes **`cy.add()` throw** — the `GpuUnfitError`
shape — leaving the store unchanged; the adapter's own limits are
requested at device creation (both render hosts and the algorithm
device); allocation failures surface as an instance event; the
degradation order follows item 36's recommendation (detection, then
labels, then charts and images, then the gradient columns made lazy).
Item 34 is built on the same allocation ledger, and its first spec is
the probe's own control — a deliberately leaked buffer must show.

### The round, as carried out (2026-09-29)

| # | Commit | What landed |
| --- | --- | --- |
| 138.1 | `04f38235` | the label shaping memo bounded (what the soak found) |
| 138.2 | `bf479feb` | the limits requested; the model-side pre-flight; `GpuUnfitError` public |
| 138.3 | `9f279752` | the renderer's fit report, the ledger, `gpuerror`, the degradation order; `limits.spec.js` |
| 138.4 | `858677eb` | the renderer soak tier (`soak.spec.js`, its driver), the README section |
| 138.5 | `bd76349d` | the probe re-run: the ceiling, the price and the 10,000-cycle soak published |
| 138.6 | this commit | the close |

The commits are ordered for review rather than chronology: the memo
was found by the soak, after the renderer work, and fixed first in the
history because it stands alone.

**The limits (item 35's recommendation, taken).**  `src/device-fit.mts`
is the GPU-free module both sides read: `adapterBufferLimits` requests
the adapter's own `maxBufferSize`, `maxStorageBufferBindingSize` and
`maxComputeWorkgroupsPerDimension` — `initGpuContext` (both render
hosts) and `acquireAlgoGpu` (the algorithm device, which the headless
GPU force host borrows).  On the RX 580 the adapter offers 4 GiB − 4 for
both buffer limits and 65,535 workgroups, and the device now has them.

**`cy.add()` throws (the sitting's call).**  The check is model-side, so
it runs before the store changes: `core/gpu-fit.mts` takes the capacity
each group would grow to (`ColumnTable.growthFor`: the free list, then
the ×2 growth `reserve` takes; a `cy.patch()`'s own removals counted as
freed) times the widest column the renderer cannot draw without,
against the bindable size (the smaller buffer limit — every mirror
buffer binds whole), and the high water against one dispatch's reach
(workgroups × 256, the width of the cull, mapper and tween kernels).
Past either, a `GpuUnfitError` names the group, the column, the bytes and
the limit and ends "nothing was added".  `cy.load()` and `cy.patch()`
refuse the same way.  The renderer supplies the numbers
(`RenderHost.reportDeviceFit`; the worker host posts them) once its
mirror exists; a graph built headless and then mounted meets the same
check in the renderer's init, and `cy.ready` rejects with the same
error.  **"The `GpuUnfitError` shape — find the existing precedent"**:
the precedent is the algorithm executors' class in
`algorithms/gpu-registry.mts` (round 65's "does not fit the device"
error, which `'auto'` falls back from); the round reuses the class
rather than a lookalike, gives it a `name` and a public contract, and
hangs it off all three factories as `cytoscape.GpuUnfitError`, as round
128 did `CancelledError`.

**Detection (item 36, step 1).**  `src/gpu/gpu-ledger.mts`: the
renderer wraps its own device's `createBuffer`/`createTexture` (own
properties on that one device object) and each returned object's
`destroy`, counting live bytes, peak, counts and cumulative allocations
by label without holding a reference to anything — a buffer dropped
without `destroy()` stays counted, deliberately.  Every allocation sits
in an `out-of-memory` and a `validation` error scope; an
`uncapturederror` listener takes the rest.  Both reach the core as the
new **`gpuerror`** event (`GpuErrorInfo`: kind, message, label, bytes,
and `degraded` when the renderer stood a feature down); an uncaptured
message fires once however many frames repeat it.  `cy.stats().gpu` is
the ledger's snapshot, carried on the worker host's frame messages.

**The pre-flight and the degradation order (item 36, steps 2–3).**  The
widest column a group cannot draw without is 16 bytes a slot in both
groups, because the round made the 32-byte gradient columns **lazy** —
the order's third step, landed with the rest: a one-record placeholder
of zeros (meta 0 = solid; a storage read past a binding's end returns a
value inside it or zero) until some slot's meta names a gradient.  So a
group can outgrow its gradient column and keep growing, gradients drawn
solid.  Labels degrade first: the glyph streams are capped at the
bindable size over 64 bytes and the cull's reach, the CPU words stop
there too, and a stream past it releases its buffers while every label
pass stands down (the label pass still runs: the laid dimensions the
model reads come from it).  Charts, images and the curve routes: a blob
past the bindable size is a four-byte placeholder, its pass skipped.  A
device-refused allocation of any of these is swapped for a placeholder
when its error scope reports, so every bind group stays valid; a refused
**core column** has nothing to fall back to, so the scene holds its last
frame (`'frames'`), picks and counts answer null and exports reject
until a re-mount.  Every step fires one `gpuerror` with `degraded`.

**The soak (item 34).**  `playwright-tests/lib/renderer-soak.mjs` churns a
fixed-size graph — random node removals (their edges with them),
re-adds to size, a mapped data write and a bypass, a new zoom, a frame —
and samples the ledger per block after draining the queue.  The verdict
is exact equality over the second half of the samples: the figures are
the ledger's, so deterministic, and a pool may settle at a high water
once.  `playwright-tests/soak.spec.js` is the CI size: the control first
(a 4 KiB buffer leaked per cycle must show as exactly 50 × 4,096 bytes
and 50 allocations over the second half), 200 cycles flat, and five
device-loss recoveries each rebuilding exactly the first renderer's
ledger with the lost one closed and no listener gained.
`benchmark/scale-ceiling.mjs --soak` is the hardware run.

### The measurements

All on this machine: i9-9900K, 62 GB, the RX 580 reached through
Chromium's hardware adapter (`npm run gpu`: HARDWARE, amd gcn-4), the
built UMD, `benchmark/scale-ceiling.mjs`, n = m/4, a fresh browser per
scene.  VRAM is the renderer's ledger, which agreed with the probe's own
`createBuffer` instrument to the tenth of a megabyte on every row.

**Item 35's first measurement, re-run** — the bisect at the new limits:

| scene | init | ready | VRAM | JS heap | GPU frame | outcome |
| --- | --: | --: | --: | --: | --: | --- |
| 1,048,576 × 4,194,305 | 4.0 s | 1.02 s | 1,357 MB | 2.47 GB | 23.8 ms | rendered (blank on 2026-09-18) |
| 1.25M × 5M | 5.0 s | 1.18 s | 1,466 MB | 2.90 GB | 29.3 ms | rendered (blank on 2026-09-18) |
| 2M × 8M | 7.9 s | 1.11 s | 1,466 MB | 3.24 GB | 48.4 ms | rendered |
| 2.5M × 10M | 10.5 s | 2.31 s | 2,926 MB | 5.46 GB | 61.4 ms | rendered |
| 4,194,240 × 16,776,960 | 17.9 s | 2.12 s | 2,926 MB | 6.02 GB | 106.2 ms | rendered |
| 4,194,240 × 16,776,961 | 17.9 s | — | — | 6.02 GB | — | `cy.ready` rejects: GpuUnfitError |
| 1M × 3M, labelled | 4.4 s | 0.57 s | 1,306 MB | 1.81 GB | 32.8 ms | rendered (blank on 2026-09-18) |
| 2M × 2M, labelled | 6.3 s | 0.48 s | 1,776 MB | 1.97 GB | 41.8 ms | rendered |
| 2.5M × 2.5M, labelled | 8.3 s | 0.99 s | 1,247 MB | 2.94 GB | 30.2 ms | rendered, labels degraded |

**The ceiling is 16,776,960 elements per group**, bisected to the
element, 4× item 35's 4,194,304.  It is not a buffer any more: it is one
dispatch's reach, 65,535 × 256, which binds before the 4 GiB binding
would (2²⁴ slots × 16 bytes is 256 MiB).  The refusal message at
16,776,961: *"mounting: this graph does not fit the device — its edges
would put 16776961 slots in the edges table — past the 16776960 one
dispatch can cover on this device (65535 workgroups of 256)"*.  With
labels, 16,776,960 glyphs per stream: ~2M labelled nodes at this label
length, 8× item 35's 2,097,152 glyphs — the glyph stream's last growth
stops at the ceiling itself rather than at the power of two below it,
which is what doubled it from the first cut's 8,388,608.  The item's
projection that the renderer's V8 heap would bind next, ~8M edges at
~4 GB, did not hold: 6.02 GB at 21M elements rendered.

**Item 36's first measurement, re-run.**  *What an allocation failure
does now*: the probe's `--inject` shape (the next allocation of a label
made to ask 2^40 bytes, which the device answers as it answers
exhaustion) becomes one `gpuerror` naming the label and bytes, the frames
the refusal landed in are rejected (an error scope resolves
asynchronously — for a glyph stream, 6 uncaptured errors), and then the
errors stop: labels degrade and frames keep drawing, or, for
`node.position`, the scene holds its last frame, a pick answers null and
an export rejects with a message pointing at the event.  Both are
`limits.spec.js` specs.  *Real exhaustion* is still not provokable here
(radv spills to system memory, item 36's 2026-09-18 finding), so the
`GPUOutOfMemoryError` path is detected by construction and exercised
only through the injected refusal — recorded, not measured.  *The byte
price*, re-run with the gradient columns lazy: **node 164 bytes a slot
(from 196), edge 132 (from 164)**, the glyph 68 unchanged; totals 12.6 /
100.8 / 735.4 MB unlabelled (from 14 / 121 / 899) and 21.5 / 172.1 /
1,306.1 MB labelled (from 23 / 193 / 1,470) at 10k × 30k / 100k × 300k /
1M × 3M.

**Item 34's first measurement** — tracked totals over 10k cycles at a
fixed size, flat or not: **flat.**  10,000 cycles at 400 nodes / 800
bezier edges, labelled and mapped, 20 nodes churned a cycle, 16.8 ms a
cycle: the ledger settles by cycle 500 (the glyph streams' one doubling,
+418 KB in 11 allocations) and reads 6,047,797 bytes, 142 allocations,
125 buffers and 5 textures at every sample from 500 to 10,000.  Five
device-loss recoveries rebuild the same bytes in the same number of
allocations each time (3,272,253 in 132 at 200 / 400, on both adapters).

**What the soak found.**  With the GPU ledger perfectly flat, the heap
was not: 27 -> 208 MB over the first 10,000-cycle run, and, collected
before each reading, 12.4 -> 52.2 MB over 3,000 cycles — ~15 KB a
cycle, linear.  An in-page probe read the label shaping memo (round
16.3) growing ~20 entries a cycle: an unbounded `Map` only a font change
cleared.  It is two generations of 4,096 now (`src/render/shape-memo.mts`,
O(1), the working set kept); re-run, the heap holds 13.8–18.2 MB from
cycle 500 to 10,000.  And the 2.5M-labelled scene died inside its first
frame on a 2 GiB `ArrayBuffer` allocation before the glyph cap reached
the streams' CPU words — the frame loop stopped with only a window
error; the cap closed that path.

### Calls taken in-round

- **The throw's class is the precedent's own**, not a new one: a
  "does not fit the device" error already existed and was already what a
  caller of a GPU algorithm catches; one class, public, for both.
- **The pre-flight holds only the columns a group cannot draw without.**
  With the gradient columns lazy the widest essential column is 16
  bytes, so a group that outgrows its gradient column keeps growing and
  its gradients degrade — the order's last step — rather than the add
  throwing over a feature most scenes never use.
- **Degrade to the feature, once, for the renderer's life.**  A degraded
  feature does not come back until a re-mount (device-loss recovery
  included); retrying an allocation that failed is a policy nobody has
  asked for.
- **Labels degrade whole**, all four streams, rather than dropping the
  labels past the cap: which labels would survive a partial cut is
  arbitrary, and the release is what reclaims the memory.
- **The soak pins the render scale** and says why (the scene and depth
  targets follow load, so the ledger would read timing).
- **`preventDefault()` is not called on uncaptured errors**: the
  browser's console line stays, since v4 fails loudly.
- **The unminified headless bundles' gzip ratchet rises** 451,000 ->
  456,000: the pre-flight is model-side by design, so it ships headless
  (+1,939 gzip bytes).

### Deferred

- **A two-dimensional dispatch** over the per-slot kernels (cull,
  mapper, tween — and the glyph cull) would move the ceiling from
  16,776,960 to the card's memory.  Logged; the cheapest next limiter.
- **An exception inside the frame loop** stops it with only a window
  error (seen once, the 2 GiB allocation above).  Nothing reaches it
  now, but the loop has no catch; a `gpuerror`/`error` for it is a small
  follow-up.
- **Real `GPUOutOfMemoryError`s** — D3D12, integrated parts — remain
  unmeasured; the path is detected and exercised by injection only.
- **Hours-long soaks** and real-application traces: the soak is 10,000
  cycles of a synthetic churn, and CI runs 200.

### What round 137 (the WebGL2 renderer) inherits

Recorded in its plan under 137.9: report a `DeviceFit` from the WebGL2
context's limits (whatever its storage emulation binds, in place of the
storage binding), emit `gpuerror` from its own allocation checks
(`gl.getError()` after a large `bufferData` or `texImage` is its error
scope), keep a ledger under the same labels so `soak.spec.js` runs
unchanged against it, and degrade in the same order with the same
`degraded` names.

### Verification

`npm run -s test:node:quiet` green (zero output) at the tree of each
code commit (138.2, 138.3) and at the close, `npm run -s
test:types:run` green at both code commits (138.1 ran `test:js` and
lint: it touches one render module and adds a spec); the
`renderer` Playwright project 218 passed / 1 skipped, the `visual`
project 136 of 136 (goldens exact with the lazy gradient columns);
`limits.spec.js` and `soak.spec.js` green on the RX 580 and under CI's
SwiftShader ICD (`CI=1`).  Controls run: the model pre-flight stubbed
(7 of `test/gpu-fit.mjs`'s 13 fail), the degrade step disabled (3 of
`limits.spec.js`'s 9 fail, after the charts spec was made to assert the
degraded set — it had passed that control), and the soak's own leaked
buffer.

**Round 138 is complete.**
