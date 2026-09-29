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

### The round, as carried out (2026-09-28)

Landed the same day as round 107, on the replan of 2026-08-27 (the
eleventh sitting took no call on this round; the replan's two calls — clone +
reconcile, and a clone owns its state — stand).  Round 107 had built the
reconcile early and handed back the follow layer and the minimap proof,
so all four layers landed here.  Measured on the i9-9900K (16 threads,
63 GiB), Node 24.18.

| # | Commit | What landed |
| --- | --- | --- |
| 106.1 | `55015206` | `benchmark/store.mjs`: the store-level drain at one consumer, before any cursor code |
| 106.2 | `ad19d577` | consumer cursors: `DeltaConsumer` in `src/contract.mts` first, `DirtyCursor` in `src/store/dirty.mts`, `GraphStore.registerConsumer()` in `src/store/graph-store/consumers.mts`, `StoreDelta.dataWritten`, destroy disposes; `test/dirty-consumers.mjs`, the soak isolation specs |
| 106.3 | `09928678` | `cy.clone( options )` with `follow` (`src/core/clone.mts`), the store's `hierarchyEpoch` / `positionEpoch`, the applier's follow flag, `CloneOptions` / `FollowOptions` on every entry; `test/clone.mjs`, the docs |
| 106.4 | `24c576a1` | `benchmark/clone.mjs`: clone, follow burst, memory at three scales and the ndex shape |
| 106.5 | `3bac47fb` | the minimap proof in `debug/`, its module spec and a two-canvas browser spec |
| 106.6 | this commit | the close |

**Layer 1 — consumer cursors, measured before and after.**  The rows
landed first (106.1).  Drain-and-republish: `mark` / `markResized` /
`touch` are byte-identical (one live state); the first consumer to take
drains it and folds it into every other consumer's pending buffer — the
column spans in the tracker, the four blob ranges and the mapper spans in
the store.  With no consumer registered the take is the pre-106 code.
Late registration is full-sync; the microtask bail is per cursor.  Before
→ after (tsx, N = 2,000): `mark` 13.1–13.2 → 13.1–13.2 ns contiguous,
18.1–18.5 → 18.0–18.1 ns scattered; the tracker's take 832–866 → 807–824
ns; the store drain at one consumer, five interleaved before/after
process pairs, 1.42 → 1.48 µs median, pairwise −11% to +4% inside the
row's own 1.25–1.77 µs spread — **zero within noise**, the plan's gate.
A second consumer adds ~0.3–0.4 µs per drain.

**Layer 2 — `cy.clone()`, and the carriage table the plan asked to
measure** (a spec, `test/clone.mjs`): the wire form carries ids, data,
positions, parents, endpoints and `selected` / `selectable`, and **not**
`locked` / `grabbable` / `pannable`; the `json()` element form carries all
of them; bypasses ride neither (they are the sheet's).  A clone is the
wire plus the three flags copied slot for slot, plus the sheet with its
bypasses, graph data, viewport, gating flags and interaction settings.

**Layers 3–4 — follow and the minimap.**  `follow: true | { throttle }`
registers a consumer on the source and syncs by `patch( clone,
source.serialize() )`, the loop 107 specced.  The minimap
(`debug/minimap.js`, `?minimap=true`) is a following clone with its own
sheet, driven on em-web through the hardware adapter: 57 ms to clone, one
sync (`~40`) for 40 moved nodes, the extent rectangle and tap-to-centre
working.

**Measurements** (`benchmark/clone.mjs`, built headless bundle, median of
5, a forced GC before each timed region):

| scale | elements | clone ms | serialize ms | load from wire ms | follow burst ms | restyle syncs | clone memory MB |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1k | 1,000 | 4.6 | 0.4 | 3.7 | 2.3 | 0 | 0.5 |
| 10k | 10,000 | 30.4 | 2.5 | 20.6 | 8.0 | 0 | 4.4 |
| 100k | 100,000 | 248.4 | 25.2 | 184.4 | 50.9 | 0 | 49.8 |
| ndex-x-large shape | 484,600 | 1,089 | 79.3 | 795 | 202.5 | 0 | 113.5 |

The duplicated memory re-stated as measured: **113.5 MB at the
ndex-x-large shape** against the replan's 80–90 MB computed from
`COLUMN_SPECS` (the id index, adjacency, data columns, labels and style
state are not columns); ~0.5 KB per element at 1k–100k with labels.  The
reconcile burst at the three scales: 2.3 / 8.0 / 50.9 ms from the
source's write to the clone's `patch` event (107's two calls alone:
0.55 / 3.9 / 47 ms).  A clone is a serialize plus a load plus ~20 ms of
flag carry at 485k (profiled through `src/`); the clone column runs above
the sum of its halves by an amount that moved with the order the regions
ran in — GC placement, which the forced GCs narrowed and did not remove.

**Calls taken in-round** (none reopens the replan):

- *The follow trigger keys on store epochs, not on the position span.*
  A restyle that resizes a compound's children moves the parent's derived
  position and marks the span a drag marks; the first version synced on a
  restyle, which the state-ownership spec caught.  `hierarchyEpoch` (every
  effective `setParent`) and `positionEpoch` (every explicit position
  write) were added to the store; the trigger is structure, hierarchy,
  position epochs, an endpoints span, a resize, or `dataWritten`.
- *`StoreDelta.dataWritten`*: an unwatched data write marks no column, so
  a mirror would miss it.  `setData` reports it through `markData()`,
  which is a no-op while no consumer is registered and never reaches the
  renderer's cursor.
- *A sync writes positions through the clone's locks* (an internal flag on
  the applier; `cy.patch()` itself still holds locked nodes): the source
  owns positions, and a minimap is `autolock`ed.
- *A sync's added elements take the source's lock / grab / pan bits* by
  id, as a one-shot clone's do, since the wire lacks them; survivors' flags
  stay the clone's.
- *The throttle waits `max( throttle, lastSyncCost )`* (default 50 ms), so
  following never holds more than half the main thread.
- *One public member* (`cy.clone`) plus two option types; the follow has
  no handle — it ends with either instance.  The consumer API stays
  internal (`GraphStore.registerConsumer`), the devtools panel's tap when
  item 47 is built.
- *Settings are carried through the getters*, so a setter called after
  construction reaches the clone; `options.style` replaces the sheet and
  its bypasses together.

**Controls.**  The plan's cursor control (two raw `takeDelta()` calls —
the second starves) is the first spec; the two-consumer different-cadence
convergence (byte mirrors of every column and the curve blob, equal to
the store after a seeded 400-step mix) carries its own control.  Four
mutations of the cursors each fail a spec — the blob fold **only after**
the mix moved from bezier to segments edges, because a bundled-bezier
fixture never writes the curve blob (a finding, now a comment in the
spec).  Soak isolation: dispose mid-stream leaves the peer whole; destroy
with a live consumer neither throws nor fires (red without the destroy
hook).  Clone equivalence by element `json()` and by every column,
against a source changed after the clone.  Eight mutations of the clone
and follow code each fail at least one spec; the browser spec times out
with the position trigger removed.

**Deferred, with reasons.**  Flag-bit syncing (linked brushing) and
shared-store views stay out of scope, as the replan recorded.  Worker-host
clones are untested: a clone of an instance built with `renderer: {
worker: true }` carries that option, and nothing here exercises it.  The
drive-by finding stays open — viewport animations still emit `viewport`
twice per tick (`_afterAnimationTick` passes `'viewport'` to
`_emitViewportEvents`, which appends it again); the minimap's rectangle
redraws twice per animated tick, harmlessly.  It is PLAN.md item 78 now,
so it is findable.

**Bundles**: +8.6 KB minified on each build (full 905,382 → 914,031;
headless 537,210 → 545,849; headless-gpu 616,323 → 624,962), +2.6 KB
gzipped; inside the round-131 ratchet.

`npm run -s test:node:quiet` green at close: 2,924 unit tests (+25: ten in
`test/dirty-consumers.mjs`, fifteen in `test/clone.mjs`), 816 module (+3,
`test/modules/minimap.mjs`), 38 soak (+2); the type tests and the
declaration surface audit (61 type exports) green.  The renderer
Playwright project is green with the new two-canvas spec (496 browser
tests listed across the projects).
