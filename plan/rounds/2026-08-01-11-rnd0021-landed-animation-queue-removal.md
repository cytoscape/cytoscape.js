## Animation queue removal

**Signed-off design calls:**

- **No queue, concurrency by channel.**  The manager keeps a set of
  *concurrently running* animations per element (and for the
  viewport) instead of a queue: starting an animation whose channels
  are **disjoint** from every running one's runs it immediately
  alongside them (position tween + opacity fade compose); starting
  one that **overlaps** a running animation's channels stops that
  older animation in place (its promise resolves, values freeze
  where they are, any GPU lease settles) and the new one captures
  from the frozen state — whole-animation eviction, never a
  half-stopped animation.  Sequencing is the caller's job via
  `await a.promise()`.
- `delay` stays (it is part of one animation's timeline, not
  queueing).  `play`/`stop`/`promise`/`playing`/`animated` keep
  their shapes; `stop()` stops every running animation on the
  collection.
- Recorded: this is a deliberate v4 divergence from v3's
  queue-by-default (user-approved 2026-08-01); v3's `queue: false`
  option spelling is rejected (unknown-keys-throw — there is no
  queue to opt out of).

**Pass split** (tests-first; docs in-commit):

- [x] **21.1** (2026-08-01) — the manager rework landed: the
  per-element queues became per-element *running sets*
  (`start()` replaces `enqueue()`), eviction compares
  `touchedColumns()` (position → node.position; style channels →
  their columns; a delay() no-op touches nothing and composes with
  everything) across shared refs and stops the older animation in
  place via the existing GPU-settling stopOne; the viewport
  composes pan and zoom as separate channels; `tick` advances
  every running animation (dedup across refs) and `stop()` stops
  them all — its `clearQueue` argument is gone from
  `eles.stop`/`cy.stop` (no queue to clear).

  `queue`/`step`
  option spellings throw with pointers at promises/onRender.
  settle/demote/onCompacted iterate the running sets, so the GPU
  lease, compaction-demotion and ref-repair paths carry over —
  pinned by the untouched compaction + tween suites.  Tests-first:
  the old runs-in-sequence spec replaced by 6 concurrency specs
  (red then green — in-place eviction with frozen values + resolved
  promise, disjoint-channel composition on one element, stop()
  stopping all, delay() never evicting, viewport pan/zoom
  composition with pan-evicts-pan, the queue/step throws).
  2195 Node tests, 82/82 webgpu Playwright specs, typecheck +
  lint clean.  **Round 21 is complete.**
