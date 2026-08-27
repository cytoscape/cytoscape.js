## N viewers, by cloning

**Replanned 2026-08-27 with the maintainer.**  This round was first
expanded as "N viewers, one store": consumer cursors in the
`DirtyTracker`, a view-state inventory, and a `GraphView` spike —
per-view renderer + viewport over the one shared store.  The
measurement pass for that plan was taken (the inventories below), and
then the maintainer raised the Cytoscape desktop lesson: multiple
views of one core caused an explosion of complexity there, because
every subsystem had to become view-aware.  Three architectures were
evaluated against the measured code, and the round now takes the
third.  Two calls taken (2026-08-27):

1. **Direction: clone + reconcile.**  A second "view" is a full
   independent instance — `cy.clone()` over the existing
   serialize/ingest path — kept current by round 107's id-keyed
   reconcile, driven by a throttled consumer of the master's dirty
   stream.  Every instance keeps v4's one-core / one-viewport /
   one-renderer invariant, and no "whose viewport?" semantics ever
   enter the public API.
2. **A clone owns its state.**  Selection / hover / grab / active are
   not synced; linked brushing is explicit app wiring over the two
   instances' events (an opt-in sync flag can come later if an app
   proves the need).

### The evaluation (what the measurements said)

**What the shared-store route actually costs.**  The single-consumer
inventory found the assumption far wider than `dirty.mts`'s
documented drain: **six** drain-once channels a second reader would
starve — `takeDelta` itself (plus the four blob pools drained inside
it, `graph-store.mts:581-611`), `takeMapperSpans`
(`graph-store.mts:1057`), `takeLabelDirty` (`graph-store.mts:4109`),
and `ImageRegistry.takeReady`/`takeFreed`
(`image-registry.mts:256,269`) — plus **three singleton leases**: the
animation clock (`attachDriver`, one sink, `host.mts:105-114`), the
image decoder (`setDecoder`, last-writer-wins, cleared unconditionally
at renderer destroy), and GPU column ownership
(`setGpuOwned`/`setTweenOwned` — a column authoritative on view A's
device is stale on view B's mirror).  And one genuine model/view
mixing: hover/grab/active are flag bits in the shared store
(`contract.mts:33-37`), so hover in one view styles the element in
every view.  Each item is solvable — a full five-commit design was
drafted (drain-and-republish cursors; label/image/clock leased to the
primary; a `GraphView` reusing `Renderer` wholesale over a per-view
`RenderHost`) — but the list *is* the desktop direction in miniature:
view-awareness seeping into channel after channel.  Kept as the
fallback design if same-frame fidelity is ever proven necessary.

**What a full live replica would cost.**  The worker path's
`RemoteModelView` proves span-level replication works — but it is a
render-only subset by construction (`RenderStoreView`: no id map, no
data store, no adjacency, no hierarchy, no selectors, no style
reads).  Feeding a *full* `GraphStore` by spans needs a structural op
stream — slot allocation, free lists, compaction remaps — that does
not exist.  The most new machinery, plus the 2x memory anyway.
Rejected as the worst of both.

**What the clone route already has.**  `cy.serialize()` (round 46.5)
covers positions, ids, parent links, endpoints, selected/selectable
and `data()`; at ndex-x-large (19.6k nodes / 465k edges) it is 9.2 MB,
~5 ms decode, ~80 ms columnar ingest, then the whole-graph style
apply.  Live sync composes from already-planned work: round 107's
id-keyed reconcile, triggered by a dirty-stream consumer — no new
replication protocol at all.  Per-view style (the minimap's
simplified sheet), per-view selection and per-view hover fall out
free — the first was explicitly out of scope under the shared-store
plan, the others were shared.  The costs, stated honestly: ~2x
memory (columns are ~192 B/node, ~156 B/edge from `COLUMN_SPECS`, so
~80-90 MB duplicated at ndex-x-large; trivial at typical app scale),
duplicated style/label CPU, and per-burst rather than per-frame
fidelity — ~85 ms a burst at 465k edges, sub-ms at small scale, so a
minimap lags during a drag on a huge graph.  Documented and measured
beats silently complex.

### Scope, deliberately layered

1. **Consumer cursors in `DirtyTracker` — unchanged from the first
   plan, because every future needs them**: the reconcile trigger and
   the round-47 devtools observer are both second consumers of the
   dirty stream.  Design: **drain-and-republish** —
   `mark()`/`markResized()`/`touch()` stay byte-identical (the
   mutation hot path), and the first consumer to drain takes the live
   state exactly as today's `take()` does, then folds the result into
   the other consumers' pending buffers, so fan-out costs at frame
   rate, not mutation rate.  `registerConsumer()` returns a
   `DeltaConsumer` (`take`/`hasDirty`/`onInvalidate`/`dispose`);
   the legacy surface delegates to a non-disposable primary cursor so
   no call site changes; a late registrant starts full-sync (resized
   both groups); the microtask bail at `dirty.mts:156` becomes a
   per-consumer wake, so a synchronous drain by A no longer cancels
   B's wake-up.  `GraphStore.registerConsumer()` wraps the blob-pool
   and mapper-span folds.  `src/contract.mts` is the co-signed source
   of truth: its `takeDelta`/consumer docs change first in the diff,
   with the mirror docs at `dirty.mts:93-102` and
   `graph-store.mts:574-579` in the same commit.  The benchmark row
   (mark-only, and mark+take at one consumer) lands *before* the
   change so before/after numbers exist; the gate is zero within
   noise.
2. **`cy.clone( opts )`, one-shot.**  Serialize → new instance
   ingest; the style sheet carried (`opts.style` overrides it — the
   minimap's simplified sheet); viewport carried unless opts set it;
   container per clone.  The losses are documented, not silent:
   scratch, animations, listeners; measure and record exactly which
   element flags and bypasses each source form carries (the wire form
   is the fast path; the `json()` element form carries
   locked/grabbable/pannable and bypasses at definition-ingest
   speed).
3. **Live follow.**  A registered dirty consumer (layer 1) driving a
   throttled round-107 reconcile, master → clone.  **Sequencing: this
   round delivers layers 1-2 plus the measurements; the follow layer
   is round 107's proof case** — building it here would mean building
   107's reconcile early, and 107's own plan already names its
   measurement fork.
4. **Minimap proof in `debug/`.**  A clone with a simplified sheet in
   a second container, following via reconcile — lands with layer 3,
   i.e. with round 107.

### Measurements first

Clone cost (serialize + ingest + style apply) at three scales;
reconcile burst cost at the same three (from 107's harness); the
duplicated-memory figure re-stated as measured rather than computed
from `COLUMN_SPECS`.

### Controls

The cursor control: two raw `takeDelta()` calls on today's code — the
second reader starves; the spec fails without the change.  The
two-consumer different-cadence convergence spec (each consumer's
local copy equals the store's columns byte-for-byte at the end — the
round-46.5 columns-equal method), plus late-register full-sync and
the per-consumer microtask-wake spec.  The one-consumer perf row as a
regression gate.  Clone equivalence: a clone's element `json()`
equals the master's, and model columns equal after ingest.  Dispose
and destroy-order specs (cursor disposed mid-stream leaves peers
unaffected; core destroy with a live extra consumer neither throws
nor fires dangling callbacks) in the soak tier's isolation suite.

### Out of scope, recorded

Shared-store views (the fallback design above); flag-bit syncing (a
clone owns its state — linked brushing is app wiring); worker-host
clones (untested combination; nothing forbids it later).

### Resolved by the replan

The first plan's open forks — view handle versus sibling facades,
viewport event semantics, whether `png()` binds to a view — all
dissolve: each clone is a full core with its own events and its own
`png()`.  The round-47 devtools "read-only observer" question
resolves to a cursor registration: layer 1 *is* the tap.

### Drive-by findings (logged, not fixed here)

- **Viewport animations emit `viewport` twice per tick**:
  `core.mts:1800` passes `['pan','zoom','viewport']` to
  `_emitViewportEvents`, which appends `'viewport'` itself
  (`core.mts:3202`).  Small real bug, independent of this round;
  fix separately with a listener-census spec.
- Premise corrections from the verification pass: the worker path
  needs no cursor change (`remote-view.mts` drains its *own* tracker
  instance); and the three single-callback store slots
  (`onStructureChange`, `images.onChange`, `onDictRemap`) are wired
  only by the core and the store themselves — never hazards.
