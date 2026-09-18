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
