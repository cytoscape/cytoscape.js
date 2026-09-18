## Cancellation: `.cancel()` on the async algorithm runs, `layout.cancel()` beside `stop()`, and destroy as the last cancel

Raised by the maintainer on 2026-09-18, while sequencing rounds 72, 74
and 110: the execution model those rounds settle (CPU, GPU and worker
executors; async completion; the error contract) has no cancellation
contract at all.  Nothing in the record defines what a caller does with
a whole-graph algorithm it no longer wants, what a layout leaves behind
when it is abandoned rather than stopped, or what `cy.destroy()` does to
work still in flight.  The maintainer's design call, taken before
planning: **a `.cancel()` handle, not an `AbortSignal` option** — the
algorithm promise carries `cancel()`, and layouts gain `cancel()` as an
alternative to `stop()`.  What the code does today, verified:

1. **The async algorithm tier returns a bare `Promise<T>`** —
   `runAlgo` (`executor.mts`) is an `async` function whose `'cpu'` lane
   calls the synchronous reference inside the call itself, so by the
   time the caller holds the promise a CPU run has already finished.
   The GPU lane is one batched submit per run for every family but two
   (`grep -c await` over `algo-gpu-*.mts`: one `await` — the readback
   — in twelve of sixteen kernels; `cluster` has five, `brandes` and
   `fw` two), so the device work cannot be interrupted once submitted;
   what a cancel *can* do is stop waiting, discard the readback and
   release the buffers.  Round 74's workers lane is the one executor
   where cancellation reclaims real work: `acquireAlgoWorkers`
   (`algo-workers.mts`) serializes runs over the pool behind a promise
   queue, posts one range job per worker at a time from a fixed
   `rangeCount(n)` partition and keys pending replies per worker — so
   a cancel can stop posting the ranges not yet sent, drop the
   pending-reply entries of those in flight (their partials arrive and
   are discarded), and let the queue advance to the next run; the
   pool itself is untouched (no `terminate()`, which would make the
   next caller pay the 74.1 cold-spawn price).
2. **Layouts have `stop()` and it means "end here, keep what stands"**
   — `CustomLayout.stop()` (`layout/contract.mts`) calls the impl's
   optional `stop()`; the force impl latches `stopped` and its loop
   exits at the next iteration (`force.mts:1526/1556/1602`), the
   settle lands where the sim is, `layoutstop` fires and `promise()`
   resolves.  Discrete layouts position synchronously inside `run()`,
   so a `stop()` reaches only their `animate: true` tween, which
   `layoutPositions` (`collection.mts`) drives through the animation
   manager and resolves at `Promise.all(anis)`.  No layout restores
   the positions it started from; no layout distinguishes "abandoned"
   from "finished early".
3. **`cy.destroy()` ignores everything in flight** — `core.mts:3103`
   destroys the pointer and the renderer and sets `_destroyed`; a
   running layout's next iteration writes into a destroyed core (the
   force sim's per-iteration `setPositions`), a GPU algorithm's
   readback resolves against a device the renderer released, and the
   caller's `await` never learns that the instance went away.
4. **The error contract has no cancellation class** — round 30's
   contract and round 40's policy classify throws and warnings;
   `GpuUnfitError` is the one typed error on the algorithm path.  A
   cancelled run needs a name a caller can test with `instanceof`, or
   every `.catch` treats it as a defect.

### Design calls (recommended; each stated in the record if taken)

- **The handle**: `type AlgoRun<T> = Promise<T> & { cancel(): boolean }`.
  `cancel()` returns `true` when the run was still pending and is now
  rejected, `false` when it had already settled.  The rejection is a
  `CancelledError` (`error.name === 'CancelledError'`, exported from the
  package so `instanceof` works).  The promise is the same object the
  tier returns today, so a caller who never cancels sees no change.
- **What cancel tears down, per executor**: `'cpu'` — nothing, the run
  is already complete (documented, not hidden: `cancel()` answers
  `false`); `'gpu'` — the pending readback is abandoned, the run's
  buffers are destroyed on the device's `onSubmittedWorkDone`, no
  result is decoded; `'workers'` (round 74) — queued ranges are dropped
  and in-flight ranges' partials discarded on arrival, the pool
  survives (no `terminate()`; a terminated worker is a respawn cost
  the next caller pays), and `_algoWorkersStats().jobs` counts only
  the ranges that completed — the spec's evidence that the unsent
  ranges never ran.
- **Layouts**: `cancel()` beside `stop()`.  `stop()` keeps its meaning.
  `cancel()` abandons the run: the impl's loop exits, a running tween
  is stopped where it is and the scope's node positions are restored to
  a snapshot taken at `run()` (a `Float32Array` copy of the scoped
  slots' `COL.NODE_POSITION`, taken once — cheap even at 500k), the
  viewport is left untouched (a fit that already applied stays; a fit
  not yet applied never does), `layoutstop` still fires (the lifecycle
  always closes, so UI that re-enables on `layoutstop` keeps working)
  with `event.cancelled === true`, and `promise()` rejects with
  `CancelledError`.  The internal done-promise is marked handled so a
  caller who never awaits `promise()` sees no unhandled rejection.
- **`destroy()` is the last cancel**: every pending algorithm run and
  every running layout on the instance is cancelled before the renderer
  goes, so an `await` outstanding across a destroy rejects with
  `CancelledError` rather than hanging or writing into a dead core.
  The core keeps a set of in-flight handles; a run removes itself on
  settle.
- **Out of scope, said so**: `cy.pick()` and `cy.png()`/`jpg()` are
  one-shot frame-scale operations with nothing to reclaim; animations
  have `stop()` already; the worker-hosted renderer's batch protocol is
  fire-and-forget.

### The plan

- **128.1 — `CancelledError` and the handle on the algorithm tier.**
  The class in `src/algorithms/executor.mts` (exported from the
  package index); `runAlgo` returns `AlgoRun<T>`; the sixteen async
  entries type their return as `AlgoRun<...>`; the GPU lane's readback
  races the cancel token; a cancel before the first `await` on the
  `'auto'`/`'gpu'` lanes short-circuits before acquisition.  Specs:
  cancel-before-settle rejects with the class and `cancel()` answers
  `true`; cancel-after-settle answers `false` and the result stands;
  `'cpu'` always answers `false`; GPU (Playwright, `algorithms-gpu`
  project) — a cancelled run destroys its buffers (the `_algoGpuStats`
  hook counts live buffers) and a second run on the same device
  succeeds; a control that skips the token and shows the spec red.
- **128.2 — the workers lane** (only if round 74 landed its pool):
  cancel drains the queue and discards late partials; the pool's
  worker count is unchanged after a cancel (soak spec); a cancelled
  run followed by a fresh one on the same pool answers the reference
  bits.
- **128.3 — `layout.cancel()`.**  `LayoutImpl` gains optional
  `cancel?()` (the force impl implements it by latching `stopped` and
  skipping the settle/re-pack/fit/tween); `CustomLayout` and every
  built-in wrapper gain `cancel()`; the position snapshot lives in
  `LayoutContext` (taken at construction); `layoutPositions` learns to
  drop its tweens without jumping to the end; the `layoutstop` event
  gains `cancelled`.  Specs per built-in on the headless tier
  (positions restored bit-exact, `promise()` rejects, `layoutstop`
  fired once with `cancelled: true`, `stop()` unchanged), the force
  layout under both executors (Playwright for the GPU: cancel mid-sim
  leaves the mirror's position column equal to the snapshot after the
  next frame), and a custom impl with and without `cancel()`.
- **128.4 — destroy cancels.**  The in-flight registry on `Core`;
  `destroy()` cancels every entry first; specs: an awaited algorithm
  across `destroy()` rejects with `CancelledError`; a force layout
  running across `destroy()` stops writing (no throw from the sim's
  next tick); soak: the registry holds nothing after settle
  (WeakRef).
- **128.5 — the record.**  JSDoc on every changed member (`@throws`
  names the class), `dist/cytoscape.d.ts`, `src/README.md`'s error
  contract and executor sections, `docs/features.csv`, MIGRATING and
  CHANGELOG rows (a v3 `layout.stop()` caller is unchanged; the new
  members are additive), the throw-coverage entries, and the
  executive summary.

### Risks named at planning

- A rejected promise nobody awaits is an unhandled rejection: the
  layout's done-promise must be marked handled at creation, and the
  algorithm handle must not (a caller who holds the promise is the one
  who cancelled it).  Spec both.
- Restoring positions under a GPU force run races the mirror: the
  restore writes the CPU column and marks the span dirty *after* the
  sim's lease is released (`readPositions()` resolved or skipped), or
  the next frame re-publishes the sim's last positions over the
  restore.  The 128.3 Playwright spec exists for this race.
- `layoutstop` gaining a field is an event-vocabulary change (round
  17): additive, but the event spec that enumerates fields must be
  extended, not bypassed.

## Landed

Executed 2026-09-18 on the benchmark machine (the RX 580; `npm run
gpu` reads HARDWARE, so the GPU halves ran on a real adapter), in the
plan's order.  Every design call above was taken as recommended
except where the code proved one wrong; each such deviation is stated
with its sub-round.

### 128.1 — `CancelledError` and the handle on the algorithm tier

`src/algorithms/cancel.mts` holds the class (`error.name ===
'CancelledError'`), the `AlgoRun<T>` type (`Promise<T> & { cancel():
boolean }`), the token the lanes poll, and `withCancel`, which races
the routed promise against the flag and attaches the handle.  `runAlgo`
became a synchronous wrapper around the async `route`: the token is
polled after each await — the GPU or pool acquisition, a
`GpuUnfitError` fallback, the CPU fallthrough — so a cancel that lands
during acquisition starts no lane (the spy GPU lane in the spec is
never called).  `cancel()` answers `true` once for a pending run and
`false` after settle; the router sets `token.done` the moment a lane's
value is in hand, so a cancel that lands between the value and the
promise's resolution still answers `false`.

Two facts the code corrected on the plan:

- **The `'cpu'` lane had stopped being synchronous.**  Round 74's
  `await tryWorkers()` ran unconditionally, so even a run that ended on
  the CPU yielded once before the reference ran — the plan's "a CPU run
  has already completed inside the call" was true before round 74 and
  false after it.  The router now consults the workers lane only when
  it applies, which restores the property; the `'cpu'` spec and its
  control (drop `token.done`: a completed run answered `true`) pin it.
- **No per-kernel token.**  The plan's "buffers destroyed on
  `onSubmittedWorkDone`, no result decoded" would have threaded a
  token through sixteen kernels to save a decode measured in
  microseconds: every kernel already destroys its buffers in its own
  epilogue after the readback, and submitted device work cannot be
  recalled.  Declined; the router discards the value after the
  readback instead (the "never decoded into a result object" half
  holds — `throwIfCancelled` fires before `settled(value)`).  The
  Playwright spec pins what matters: a cancelled `floydWarshall` on
  the GPU rejects with the class, and a fresh `'gpu'` run on the same
  device answers the CPU reference within 1e-4.

`CancelledError` ships as a factory static (`cytoscape.CancelledError`)
because the UMD global has no named exports to carry a value and a
`.catch` that wants `instanceof` needs one; `AlgoRun` is a named type
export.  The docs generator learned to publish a static no PUBLIC_API
member produced — resolved through the entry point's own import of
the name, so the statics list stays derived (the reason
`factoryStatics()` reads `index.mts` in the first place).  Every async
entry's `@returns` names the handle; the twenty `Collection` entries
type their return as `AlgoRun<…>`, and the type test holds a
`cancel()` result and the static.

The unhandled-rejection contract, both ways: the core's registry
observes a handle through the handle's own settle promise (a hidden
symbol on the object), never through `run.then` — a `.then` there is
the one thing that would mark a caller's rejection handled — so a
cancelled run nobody catches stays theirs to see; and the router's own
late rejection (the routed promise throwing at its next await point
after the handle already rejected) is swallowed by the handle's
existing handler.  node:test fails a spec on any unhandled rejection,
which is why the first property is pinned at its cause (a spy on
`run.then` under `_trackRun`) rather than by provoking one.

Specs: `test/algorithms-cancel.mjs`, 14.  Controls, each restored:
dropping the `throwIfCancelled` after the GPU acquisition turned the
spy-never-called spec red; dropping `token.done` turned the `'cpu'`
spec and the after-settle spec red; dropping the token from the pool's
drain loop turned the mid-run spec red.

### 128.2 — the workers lane

`AlgoWorkers.run` takes the run's token.  `runOnce` checks it before
sending the snapshot (a run cancelled while queued behind another
sends nothing), the drain loop stops posting ranges once it is set,
the partials still in flight land and are dropped with the rest, and
the run rejects; the pool stands — no `terminate()`, which would make
the next caller pay the 74.1 cold-spawn price (38–48 ms at bench
sizes).  Evidence in the spec is `_algoWorkersStats()`: `runs` and
`jobs` unchanged after a cancel during acquisition, at most one
worker's job after a mid-run cancel on a forced pool of one, `spawns`
unchanged, and the next closeness run on the same pool answering the
CPU reference bit for bit.  The soak runs a dozen alternating cancels
(before the snapshot, mid-run) and shows the pool neither respawning
nor pinning an instance — after the spec itself was corrected: a loop
body's bindings in the test's own frame keep the last iteration's
instance reachable until the frame ends, whatever the library does
(reproduced outside the runner, including with no cancel and with the
`'cpu'` executor), which is why `lifecycle.mjs`'s `runOne` shape is
now the rule for reachability soaks.  The browser half runs the same
cancel through a Blob worker and the served UMD.

### 128.3 — `layout.cancel()`

`LayoutImpl` gained optional `cancel?()`; the force impl implements it
by latching its loop as `stop()` does and landing no settle — the
synchronous CPU path, the live frame and the GPU poll each skip
`settle` when cancelled, and the GPU poll still releases the lease
first so the restore's write uploads through the normal dirty-span
path (the Playwright spec picks node `n5` at its pre-run spot after
the cancel and hits it: the mirror followed the CPU column).  The
flow impl has only `stop()` and is asked that.

**Deviation: the per-run state lives in `src/layout/run-state.mts`,
not in `LayoutContext`.**  The plan put the snapshot on the context;
the eight built-ins never construct one (they position through the
finisher or a bulk write), and the snapshot has to exist before any
position is written.  `LayoutRun` takes the scope's leaf slots
(alive, not a parent; locked nodes included — a layout never moves
them, so restoring them is a no-op write) and one `Float32Array` of
their positions at `run()`, registers itself on `cy._layoutRuns`
(keyed by the layout object, so the finisher can find its run) and on
`cy._inflight`, collects the finisher's tweens, and owns the one
idempotent `close(cancelled)`: drop the tweens (no jump to the end),
restore through `store.setPositions` skipping slots removed
meanwhile, run the caller's `stop` callback, emit `layoutstop` with
`cancelled: true`, and hand the wrapper its `onClose` to resolve or
reject `promise()`.  The finisher (`eles.layoutPositions`) reads the
run: a cancelled run writes nothing and fires nothing, and a tween's
completion after a cancel fires nothing more — the control that
dropped that guard fired a second `layoutstop` in nine specs.

**Deviation: the built-ins had no `stop()` to mirror.**  The plan
said "find how the built-ins expose `stop()` and mirror it"; they
expose only `run()` (`layout.stop()`, `promise()` and `reheat()` are
`CustomLayout`'s — the inventory's "layout handles expose…" rows
described the wrapper).  So the eight gain `cancel()` alone, which for
them can only ever abandon an `animate: true` tween — their bare call
is synchronous and has finished by the time anything can be called —
and `cancel()` before `run()` or after a finished run is a no-op.
Adding `stop()`/`promise()` to the built-ins is a separate question,
not taken here.

**Found by the specs**: a custom layout whose impl had already
settled before `cancel()` — only its finisher's tween still running —
had nothing left to close it (the wrapper's `.then` had run and the
tween's completion defers to it), so `cancel()` closes at once when
`run.implSettled` is set; and `pack` moves nothing on one component,
so its spec gets two chains.  The `layoutstop` event gained
`cancelled` on `EventProps` and `Event`; the round-17 vocabulary is
unchanged (no new event name), so its spec needed no extension — the
new field is pinned by the layout specs and absent on a normal stop.

Specs: `test/layout-cancel.mjs`, 26 — every built-in mid-tween
(positions bit-exact to the snapshot, one `layoutstop:cancelled`, the
`stop` callback once, nothing after the dropped tween's completion,
both registries empty), the viewport left where the cancel found it,
a subset scope, the no-ops, custom impls with `cancel()` (asked once;
a second `cancel()` asks nothing), with only `stop()`, with neither
(the wrapper closes after the impl's fifty steps), a synchronous one
(the microtask close restores the write), a finisher-driven one, a
node removed mid-run, the force layout — `stop()` unchanged and
pinned, cancel on a live CPU run, mid-tween, and on an infinite run.
Controls, each restored: skipping the restore in `LayoutRun.close`
turned twenty of twenty-six red; dropping the `cancelled` guard in the
tween completion turned nine red; dropping the `!this.cancelled`
around the force settle turned the live-run spec red.

### 128.4 — destroy cancels

`Core._inflight` holds every pending algorithm handle (joined in
`_trackRun`, left on settle) and every open `LayoutRun`; `destroy()`
cancels each entry before `emit('destroy')`, the listener purge and
the renderer's teardown — so a `layoutstop` with `cancelled: true`
still reaches a listener (the spec's log reads `layoutstart`,
`layoutready`, `layoutstop:cancelled`, `destroy`), a custom impl is
asked to cancel, a custom layout's `promise()` rejects instead of
hanging, and a live force run stops writing.  The GPU poll's readback
gained a rejection branch: a destroy mid-sim takes the device away
under `readPositions()`, and the run resolves rather than leaving the
wrapper's `.then` unreached.  Specs: three destroy specs in
`test/layout-cancel.mjs`, one in `test/algorithms-cancel.mjs`, and
`test/soak/cancel.mjs` (a control, then finished/stopped/cancelled
runs of both kinds leaving both registries empty with the layout
objects collecting under forced GC, then a destroy emptying a
registry with two runs open).

### 128.5 — the record

JSDoc on every changed member (100% on both tiers; `@throws` on the
tier's entries names the class in `@returns`, since the rejection is
the handle's, not a throw), `dist/cytoscape.d.ts` regenerated (the
type surface reads 55 type exports and 4 statics), `src/README.md`'s
executor paragraph, design decisions, error contract, infinite-run
note and a new Cancellation section, MIGRATING and CHANGELOG rows,
`docs/features.csv` (`layout.cancel`, `event.cancelled`,
`cytoscape.CancelledError`, `layout.promise` restated, the ten
"layout handles expose" rows), and the executive summary.  Gates at
close: `test:node:quiet` green (2,792 unit, 767 module, 33 soak, the
throw gate at zero), the type test and the type surface, and the
renderer project over the three touched spec files on the RX 580.

### What the round did not do

- No `AbortSignal` option — the maintainer's call, and the design
  decision in `src/README.md` says why the handle was preferred.
- No cancellation for `cy.pick()`, `cy.png()`/`jpg()` or the worker
  host's batch protocol (out of scope, as planned).
- No `stop()`/`promise()` on the built-in layouts (see 128.3).
- A custom impl with neither `cancel()` nor `stop()` cannot be
  interrupted; the run closes as cancelled when it ends, and the
  contract says so.
