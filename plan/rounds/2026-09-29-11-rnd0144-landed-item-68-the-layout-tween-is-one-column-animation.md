## Ledger item 68: the layout tween is one column animation

Ledger item 68, taken as a round.  There was no plan file: the spec is
the item's text in `PLAN.md` and its line in the eleventh sitting's note
(`2026-09-28-01-rnd0000-note-the-eleventh-design-sitting-the-open-calls-one-by-one.md`).

The item (logged 2026-09-18, from item 51's measurement): a layout with
`animate: true` on ndex-x-large created one position animation per node
(19,607, the finisher's), each registered with the GPU tween sink on the
same-thread host, and the run drew **6 frames in 1.5 s** for grid and 8
for circle — eight `writeBuffer` calls per animation, and the rest of
the second in per-animation JS — while the worker host, whose
animations took the CPU path and posted one position span per frame,
drew 31 and 59.  The fix shape was the finisher's: a layout tween is
*one* animation over a position column (start and end arrays, one
registration, one upload), the shape the GPU force integrator already
has.  First measurement: the grid tween's frame count at 2k / 5k / 10k
/ 20k on both hosts.

**Call taken (2026-09-28, the eleventh sitting): go, before alpha** —
one column animation per layout; per-node observability during the
tween settled with it.

### The round, as carried out (2026-09-29)

Measured on the i9-9900K (Fedora 43, Linux 7.1), Node 24.18, the RX 580
through Chromium's Vulkan WebGPU (`npm run gpu`: HARDWARE); the
Playwright projects on their pinned SwiftShader adapter.

| # | Commit | What landed |
| --- | --- | --- |
| 144.0 | `064e6cd7` | `benchmark/layout-tween.mjs` and the first measurement |
| 144.1 | `7f33eda9` | the column animation, the per-node contract on both executors, `layout.stop()` on the eight built-ins, three lease defects |
| 144.2 | `597623cc` | the device side: a detached entry is a sentinel the kernels skip; the lease is per slot; the ledger pools tween buffers |
| 144.3 | `a10a3dff` | the worker host's remote tween sink: one registration, not a span a frame |
| 144.4 | `47cdf678` | the drag-during-a-tween trace; item 51's tween rows re-asserted |
| 144.5 | this commit | the close |

**The measurement** (`node benchmark/layout-tween.mjs`: a 1000 ms linear
grid tween over a seeded scatter, frames the renderer drew; each row
asserts every node ends on the layout's own positions, `layoutstop`
lands no sooner than the duration, and some node reads between its
ends mid-flight):

| nodes | same-thread before | worker before | same-thread after | worker after |
| --: | --: | --: | --: | --: |
| 2,000 | 29 | 59 | 62 | 59 |
| 5,000 | 2 | 60 | 62 | 59 |
| 10,000 | 2 | 59 | 61 | 59 |
| 20,000 | 2 | 54 | 62 | 60 |

The per-animation cost crossed the per-frame span cost *below* 2k —
the question the item asked had no crossover in the measured range:
from 5k the same-thread host drew two frames in the second.  Every
same-thread row before also warned that no node read mid-flight between
its ends (`position()` read the lease's stale column).  After, at 20k:
126 `writeBuffer` calls and 555 KB for the whole tween on the
same-thread host (the registration, a params write a frame, the
settle), and 547 KB posted on the worker host where it posted 8.75–9.5
MB; circle reads the same.  Item 51's own rows on ndex-x-large
(`benchmark/worker-host-deferrals.mjs --tweens`, 465k edges): the
same-thread grid 6 → 44 frames, circle 8 → 59; the worker host grid 31
→ 32 (its frame there is the draw's), circle 59 → 58, 549 KB posted.
On the debug page (ndex-x-large, the production sheet, Animate on,
driven by script) the pre-round bundle drew **two frames and held the
main thread ~65 s** after `layoutstop` (19,607 per-node settles); the
round's draws 12 frames through the tween — that page is draw-bound at
~40 ms of GPU a frame — and `layoutstop` lands 1.69 s after the click
(0.53 s of it the page's own sheet re-apply, 0.29 s the layout).

**The column animation** (144.1).  The finisher builds
`Animation.column(store, refs, to, opts)`: every animated node's target
in one `Float32Array`, captured into one position write — one capture,
one CPU loop a tick (a tight position loop in `apply`), one GPU
registration.  The manager ticks a `Set` of animations instead of
walking the per-ref map (which allocated a filtered array per ref per
frame), so a tween over the scope costs the manager O(1) a frame.

**The contract, per node, decided and pinned** (`test/layout-tween.mjs`,
on the CPU path and on a mock sink standing in for the lease; the
both-hosts Playwright spec in `worker-renderer.spec.js`; the drag-pan
trace):

- `node.animated()`: true for every tweening node (v3's); false for one
  the `animateFilter` passed over, one locked before the run, and one
  stopped, locked or removed since.
- `node.position()`: the tween's value as of the last frame, on both
  hosts — the lease's CPU column still holds the start, but the getter
  evaluates the tween (v3's answer; it read the start before).  The
  column scans — bounding boxes, box selection, the worker host's sync
  CPU pick — read the start until the settle, as before.
- `node.stop()` / `stop( true )`: that node alone freezes (or lands);
  the rest run on (v3's).  The column animation is `perRef`: stop,
  eviction by a new position animation on the node, `lock()`,
  `cy.autolock( true )`, `remove()` and `cy.patch()` *detach* a node —
  its entry is off for both executors (the CPU `off` mask, the kernel's
  sentinel), the ref leaves the running set.  Stopping every node ends
  the tween.  Other multi-element animations keep round 21's
  whole-animation rule for a stop and an eviction (MIGRATING.md §4 now
  says `eles.animate()` is one animation where v3 made one per element).
- `lock()` mid-tween: the node holds where it got to (v3's step skips a
  locked node); `unlock()` does **not** resume it, where v3's does —
  a deviation, recorded, because resuming means jumping to wherever the
  tween has got to.
- a node mid-tween cannot be grabbed (v4's rule for any animating
  element; v3 let the drag and the tween fight): the press pans, and a
  stopped node drags — now a trace phase.
- `remove()` / `cy.patch()`: the node leaves every animation before the
  store frees its slot (`dropRefs`), so no batch writes a slot the next
  `add()` reuses; the survivors land.
- `layoutready` fires in `run()`, `layoutstop` when the tween ends
  (unchanged, v3's).  `layout.stop()`: the eight discrete built-ins had
  **no** `stop()` (the feature table and MIGRATING said they did); they
  gain one — the tween stops where it stands and `layoutstop` fires on
  the spot, once, uncancelled (v3's) — and a custom layout's `stop()`
  halts a finisher tween once the impl has settled.  `layout.cancel()`
  (round 128) is unchanged, and now releases the device's batch.
- a reparent mid-tween demotes the batch to the CPU and the tween runs
  on to its targets (14.11 settled it where it stood).

**Defects found on the way**, each with its spec: a handle's `stop()`
called the animation directly, so a GPU-driven tween stopped by handle
— `layout.cancel()` mid-tween on the same-thread host — left its batch
registered and `node.position` leased for good; `settleGpuAll` settled
without unregistering (the reparent hook); and every write to a
tween-owned column was skipped by the mirror and never re-uploaded, so a
node outside a subset layout's tween moved mid-flight drew where it had
stood until it moved again.  The lease is per slot now (144.2): the
runtime counts the live entries per slot and the mirror uploads the
runs at zero; a presenting force run still owns its column whole.  A GPU
stop freezes at the last frame's clock, as the CPU path does.

**The worker host** (144.3).  The proxy attaches a `RemoteTweenSink`
with `drives: false` (the manager keeps its rAF clock and the CPU
reference); register, detach and release cross as one message each,
the start on the epoch clock since the threads' `performance.now()`
origins differ, and the worker hands them to the runtime its engine
attaches (a registration arriving before the device waits for it).
The sink is `positionOnly`: paint tweens keep the CPU path on that host
— the item priced the layout tween, not them.  The ledger's tween rows
pool under one label per column (`cy-gpu:tween-slots:node.position`),
so `cy.stats().gpu` shows the one batch while it runs and nothing after
(pinned on both hosts).

**Controls**, each restored: the finisher's per-node animations failed
six Node specs; no `off` skip, four; the pre-144 handle stop, four; no
`dropRefs`, the GPU remove spec; a column read in `position()`, seven;
no mirror masks, the moved-node pixel on both hosts; a no-op runtime
detach, the stopped-node pixel on both hosts; no remote sink, the
worker's ledger poll; `canDrag` ignoring `isAnimating`, the trace's
tweening phase.

**Verified**: `npm run -s test:node:quiet` green (zero output), as are
`test:soak:quiet`, `test:types:run` and `test:types:surface:run`; the `renderer` and `visual` Playwright projects in
full, the gesture traces on every host; the debug page driven by script
on the RX 580 (mid-tween and settled screenshots looked right: the
scatter, then the grid).

**Deferred, recorded**: paint tweens on the worker host stay CPU-side
(the sink could take them; unmeasured, not this item).  No new ledger
item.

**Follow-up (2026-09-29).**  The both-hosts tween spec was flaky under
`CI=1` (6 of 10 failed at `--repeat-each=5`): `makeReadyCy` resolved
at the first frame's submit, the device then compiled for ~4 s on
SwiftShader with no frame drawn, and the 6 s linear tween's wall clock
ran through it — under load the first frame after the stall was past
the end, so the tween registered and settled in one tick and the
ledger poll never saw its row.  The tween's wall-clock semantics are
right; the helper now waits for the device to have run a frame
(round 75's follow-up; `docs/agents/testing.md`), 20/20 under `CI=1`
and on the RX 580.
