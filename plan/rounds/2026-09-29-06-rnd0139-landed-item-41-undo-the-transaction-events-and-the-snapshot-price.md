## Ledger item 41, the alpha part: the transaction events and the snapshot price

Ledger item 41 (undo, on the columnar store), its alpha part taken as a
round.  There was no plan file: the spec is the item's text in
`PLAN.md`, its line in the eleventh sitting's note
(`2026-09-28-01-rnd0000-note-the-eleventh-design-sitting-the-open-calls-one-by-one.md`),
and the gate line in `docs/feature-direction.md` — "whether undo
requires transaction hooks in the core before those boundaries
solidify".

The item (raised 2026-08-19): every editor app builds an undo stack
over this library; `cy.batch()` exists but no history does.  The
columnar store makes a snapshot a set of typed-array copies, so the
design fork is **snapshots** (simple, memory-priced) against an
**inverse-operation log** (cheap per op, but every mutating API must
emit its inverse — a completeness obligation the audits would have to
learn).  Batch boundaries are the natural transaction marks.
**First measurement**: snapshot cost — bytes and milliseconds — at 100k
elements, and restore cost; that number decides the fork before any API
is designed.

**Call taken (2026-09-28, the eleventh sitting): batch/transaction
events exposed for alpha, and the snapshot cost measured for alpha**;
whether core ships an undo stack is decided on that number.  This round
is those two things.  It builds no undo stack: that is the
maintainer's call, put to him as **item 84**.

### The round, as carried out (2026-09-29)

| # | Commit | What landed |
| --- | --- | --- |
| 139.1 | `3765e961` | `batchstart` / `batchend`, the ordering contract, its specs and controls |
| 139.2 | `7f9ef56b` | `benchmark/undo-cost.mjs` and the measurement in `src/README.md` |
| 139.3 | this commit | the close: this record, item 41's status, item 84, the summary |

#### 1. The events, designed against what exists

What there was to design against: `cy.batch( fn )` over a nesting
`startBatch()` / `endBatch()` pair that defers style work to the
outermost close; round 107's `cy.patch()`, which runs its mutations in
one batch, fires the element events once each inside it and one
summary `patch` event (with `event.diff`) after it; round 103's
`cy.load()`, whose `loadstart` … `loadstop` span macrotasks; round
133's sheet change, which accumulates across a batch and applies once,
as a diff, at the flush.

The calls, each recorded in `src/README.md` ("Transaction events") and
pinned in `test/batch.mjs`:

- **Names: `batchstart` and `batchend`**, the `startBatch` / `endBatch`
  spellings in v4's `…start` / `…end` event family (`boxstart` /
  `boxend`, `tapstart` / `tapend`).
- **Nesting: the outermost pair only.**  Only the outermost close
  flushes, so only it is an observable boundary — an inner pair is part
  of the enclosing transaction exactly as it is part of the enclosing
  flush.  The alternative, an event per level carrying a depth, hands
  every recorder the job of ignoring the inner ones, and no consumer
  was found that wants them.
- **`batchstart` fires after the depth is taken, before any
  mutation.**  `batching()` is true and nothing of the batch has
  landed, so a listener reads the state the transaction starts from —
  the snapshot point — and anything it mutates belongs to the
  transaction rather than opening a second one.
- **The element events fire between the pair, unchanged.**  They
  already fired during a batch (v3's semantics, kept); they are the
  transaction's content.
- **`batchend` is the transaction's last event.**  After the flush and
  the compaction check, so a listener reads fresh style and
  `batching()` false; and after a `patch` summary the batch produced.
  Before this round `patch` fired after `endBatch()` returned; with a
  `batchend` in the same place the two would have raced by listener
  order, and a recorder closing its entry at `batchend` would have seen
  the patch's summary arrive after the entry was closed.  So
  `endBatch` takes an internal summary hook, run after the flush and
  before `batchend` at the outermost close, and at once when nested (as
  the patch's own code did).  A `cy.patch()` is therefore one
  transaction — `batchstart`, its element events, `patch`, `batchend` —
  and inside an app's batch it joins that one, its summary firing
  inside it.  Two edges fell out: a patch its planner refuses opens no
  transaction (the planner throws before `startBatch`), and a patch
  whose element listener throws emits no summary (a completion flag —
  the diff alone is assigned before the events fire).
- **`batchend` carries no diff.**  A diff on the end event would
  oblige every mutating path — data, bypasses, classes, hierarchy
  moves, add, remove — to report into the open batch, which is the
  inverse log's completeness obligation under another name; the
  measurement below is what decides whether to take that on.  `patch`
  keeps its own `event.diff`.
- **No rollback.**  A `batch( fn )` whose `fn` throws still closes (it
  always did) and still fires `batchend`, with whatever landed before
  the throw.  An unbalanced `endBatch()` stays a no-op and fires
  nothing.
- **What is not a transaction.**  A `cy.load()` spans macrotasks and
  already has its lifecycle; layouts, animations and gestures write
  outside any batch unless the app wraps them.  A follower's sync
  (round 106, `cy.batch` in `clone.mts`) is a batch on the follower, so
  a follower sees one transaction per sync.
- **The sheet**: `cy.style( sheet )` inside a batch applies at the
  flush, so before `batchend` — but the wire format carries no style,
  so a snapshot does not hold it; an app undoing sheet changes keeps its
  own sheet history.

Both emissions check `_hasListeners` first, so a batch nobody listens
to costs what it did.

**Controls**, each run against the nine new specs: no `batchstart`
emission (5 fail), no `batchend` emission (5 fail), the summary moved
after `batchend` (the patch-ordering spec fails), `batchstart` at every
depth (2 fail).  The last spec is the recipe the events exist for — a
`cy.serialize()` pushed at `batchstart`, `cy.patch()` back — asserting
the restored ids, endpoints, data and positions, and that the undo is
itself a transaction (it pushes the redo point).

#### 2. The measurement

`benchmark/undo-cost.mjs`, through the built headless bundle; round
107's fixture (25k nodes, 75k edges; label / score / group data under a
sheet with data-mapped width, colour and labels); i9-9900K, Node 24.18,
63 GiB; median of 5, three runs, the range across them.

| | ms | bytes |
|---|---:|---:|
| snapshot: `cy.serialize()` | 26.9–27.4 | 3.07 MB |
| (v3-shaped: `JSON.stringify( eles.jsons() )`) | 107.7–110.3 | 21.2 MB |
| restore `cy.patch( snapshot )`: nothing changed | 19.9–20.3 | |
| … after one data value | 17.9–18.2 | |
| … after 1% of nodes moved | 17.6–19.2 | |
| … after 10% of nodes' data | 23.1–24.2 | |
| … after 1% of nodes removed (cascades re-added) | 27.8–30.9 | |
| restore by recreating the instance | 200.7–208.1 | |
| core floor: every store column + data column, `slice` | 6.2–6.5 | 17.2 MB |
| … written back, `set` | 1.8–2.0 | |
| … the model subset (positions, flags, endpoints, generations, data) | 0.7–1.1 | 2.57 MB |

At 20k elements: `serialize()` 5.7 ms / 0.60 MB, `patch` back 3.3–6.5
ms — linear.

The inverse log, per op over the public API, 2,000 ops in one batch,
each variant on a fresh graph with the order alternated: recording
`data()`'s old value is noise (−0.4 to +0.2 µs on a 4.3–4.7 µs op);
`position()`'s is 0.2 µs on 1.1 µs; a node `remove()`'s — which must
capture the removed closure as definitions, since v4 cannot restore a
removed element — is 14–15 µs on a 16 µs op.

Each restore row first checks that its edit changed the state and then
that the restore reached the snapshot (counts, a data value, a
position, a removed node back, an endpoint), so a restore that did
less cannot read faster; the inverse rows fail if the logged variant
recorded nothing.

**What it implies for a core undo stack:**

1. **The snapshot undo an app can write today works, at ~27 ms per
   transaction and 3 MB per history step at 100k.**  The tax is paid at
   every `batchstart`, one data value included — 1.6 frames at 60 Hz —
   and a 50-step history holds ~150 MB.  Restoring costs 18–31 ms
   whatever the edit, because a patch scans the whole payload (its
   identity cost, round 107).  Good enough for discrete editor actions
   at 100k; not for a transaction per pointer move.
2. **A core snapshot would buy the take, not the undo.**  The model
   columns copy in ~1 ms, ~25× under `serialize()`, but that floor
   leaves out the id map, adjacency, hierarchy, blob pools, label
   sidecars and untyped data, and a restore must rebuild those,
   re-apply style and repair handles — the work a patch already does in
   its 18–31 ms.  Copying every column instead (6 ms, 17 MB a step) is
   mostly style channels a restore would re-derive anyway.
3. **The inverse log is orders of magnitude cheaper per transaction**
   (ten removals ~150 µs, ten data writes unmeasurable, against 27 ms),
   and its price is completeness, not time: every mutator must record
   its inverse, and the element events cannot carry one today — they
   fire after the write, with no old value.  That is what "transaction
   hooks in the core" (the feature-direction gate) would mean if core
   undo is wanted.

So the number does not argue for a core *snapshot* stack: core cannot
restore faster than the public recipe already does, and the take it
could speed up is still O(graph).  It leaves two answers — no core
stack, the events and the documented recipe being v4's undo story; or
a core inverse log, with old values on the mutation path and an audit
that every mutator records one.  Which is the maintainer's; item 84
puts it to him.

**Deferred**: the undo stack itself, by the call.  Not measured: a real
core restore beyond the floor (it would have to be built to be
measured), and the heap retained by a history of `jsons()` closures
(the inverse log's memory side).

**Verification.**  `npm run -s test:node:quiet` green (zero output);
`npm run -s test:types:run` green.
