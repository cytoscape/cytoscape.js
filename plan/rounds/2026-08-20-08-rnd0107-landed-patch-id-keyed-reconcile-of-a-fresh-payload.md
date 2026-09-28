## Patch: id-keyed reconcile of a fresh payload

Verified premise: `cy.json()` is export-only **by decided
design** — the import form throws
(`src/core.mts:2802-2817`), and the record says restoring from
kept definitions is the app's job.  This round does not reopen
that decision, and the plan says so explicitly: `json( obj )`
restores a *serialized session*; **patch reconciles a data
refresh** — the same logical graph, next query result — into the
live instance.  Compute adds / removes / updates by id, apply as
one batch, and everything attached to surviving elements
survives: selection, positions (unless the payload moves them),
bypasses (id-keyed, so they survive by construction), running
animations, listeners, viewport.  The consumers exist before the
API: GeneMANIA re-query, Cytoscape Web backend sync, and item
46's React wrapper, whose prop-diffing is exactly this and would
otherwise be reimplemented per app, badly.  Round 106's replan
(2026-08-27) added a fourth: a live-following `cy.clone()` syncs by
throttled reconcile, and its minimap proof lands with this round.

Semantics fixed at planning (the maintainer-feedback core):

- **Mode**: default `reconcile` — an id absent from the payload
  is removed; `merge` (absent = kept) available by option.  The
  default matches "this is the new result".
- **Data**: per-element *replace* of the data record, not deep
  merge — deep merge is the API nobody can predict; `merge`
  mode's keep applies per element, not per key.
- **Positions**: present in payload → written; absent → kept.
- **Endpoints**: an edge whose source/target changed identity is
  a remove + add, not an update — rewiring is not a patch.
- **Never touched**: the sheet, the viewport, listeners,
  scratch.  Elements only.
- **Returned**: the diff — `{ added, removed, updated }`
  collections — because every consumer's next line wants it.

Input forms: definitions, columnar, wire buffer — one funnel
with round 66's load path, not a parallel one.  The columnar and
wire paths are the fast tier: ids resolve through the id-map
(string id ⇄ slot, blob-native), and a data column can be
compared column-against-store without materializing objects;
the definition form goes through the same reconcile at
definition speed.

Measure first, because the fork between "sugar over
remove/add" and "store-level columnar reconcile" is a factor
nobody has priced:

1. destroy + recreate (the honest baseline apps use today);
2. app-side diff through the public API (`remove()` + `add()` +
   `batchData`);
3. a store-level columnar patch prototype;
   — each at 100k elements with 90% / 50% / 10% id overlap.
   GeneMANIA-shaped refreshes are high-overlap, so the 90% row
   is the headline; the 10% row guards the degenerate case
   (a patch that is worse than recreate below some overlap must
   say so in its docs, with the number).

Controls: the **identity patch** — payload equal to state — must
produce an empty diff, zero element events, and zero net dirty
spans (spec asserts all three, and its control perturbs one
data value to prove the assertions bite); the event contract —
adds fire `add`, removes fire `remove`, updates fire `data` /
position events, once each, inside one batch — pinned by a
listener-census spec; end-state equivalence — patch(A→B) leaves
columns equal to a fresh load of B modulo the preserved state,
the columns-equal method again.

Named file: `src/store/patch.mts`.

**Open (maintainer):** the name (`patch` / `reconcile` /
`merge` — `patch` recommended; `merge` is the mode name);
whether a `keepPositions` option class is needed beyond
present-wins (Cytoscape Web may want "never move what the user
moved" — arguably app policy via the returned diff);
whether patch emits one summary event (`patch`, with the diff)
beside the per-element events, for apps that only want the
summary; whether the React wrapper (item 46) should be
sequenced immediately after as its first consumer, which would
validate the API before it hardens.

**Decided at the eleventh design sitting (2026-09-28):** the name is
**`cy.patch()`** (`merge` stays the mode name); patch emits **one
summary `patch` event carrying the diff** beside the per-element events.
No `keepPositions` class — the returned diff is the app's policy hook.
The React wrapper follows after alpha (PLAN.md item 46).

### The round, as carried out (2026-09-28)

Landed the same day as the eleventh sitting, on its calls: the name
`cy.patch()`, `merge` as the mode name, one summary `patch` event with
the diff, no `keepPositions` class, the framework wrappers after alpha.
Measured on the i9-9900K (16 threads, 63 GiB), Node 24.18, through the
built headless bundle.

| # | Commit | What landed |
| --- | --- | --- |
| 107.1 | `049ca937` | `benchmark/patch.mjs`: the two baselines, before any patch code existed |
| 107.2 | `21d28fd4` | `src/store/patch.mts` (the planner), `src/core/patch.mts` (the applier), `Core#patch`, `Event.diff`, `IdMap.codeBytes`/`setBytes`, `_removeClosure`, the types on every entry, `test/patch.mjs`, the docs |
| 107.3 | `6fbddb92` | the patch rows, the crossover sweep and the follow burst |
| 107.4 | this commit | the close |

**Measure first.**  The baselines ran before the implementation (100k
elements — 25k nodes, 75k edges — median of 3; 10% of surviving nodes
change a mapped value, 1% of surviving edges rewire; every row asserts
its end state against B):

| overlap | recreate (defs) | recreate (wire) | app diff (defs) |
|---:|---:|---:|---:|
| 90% | 240.4 | 192.9 | 293.1 |
| 50% | 259.4 | 198.0 | 512.2 |
| 10% | 198.0 | 153.5 | 756.8 |

The app-side diff over the public API (`remove()` + `add()` + `data()`
writes in one `cy.batch()`; `batchData` left in round 90) lost to
recreate at every overlap, the headline row included — so "sugar over
remove/add" was priced out before it was written, and the reconcile was
built store-level: the plan (ids, claims, data compared column against
store) is computed in the store tier without handles or data objects,
and only the mutations go through the existing per-element paths.  The
store-level prototype the plan named became the implementation; the
final sweep (median of 5, ms):

| overlap | recreate (defs) | recreate (wire) | app diff | patch (defs) | patch (columnar) | patch (wire) |
|---:|---:|---:|---:|---:|---:|---:|
| 90% | 209.9 | 167.4 | 265.6 | 124.3 | 86.5 | 96.2 |
| 80% | 299.4 | 236.5 | 314.4 | 173.2 | 139.2 | 145.2 |
| 70% | 206.4 | 161.2 | 369.2 | 222.0 | 194.2 | 197.9 |
| 60% | 313.2 | 258.1 | 433.0 | 283.8 | 252.3 | 259.0 |
| 50% | 206.9 | 168.1 | 498.4 | 335.3 | 308.5 | 310.6 |
| 10% | 301.5 | 230.2 | 777.7 | 564.5 | 535.2 | 522.2 |

The recreate rows are bimodal across runs (~165 or ~240 ms from the
wire at the same overlap — GC placement, not the payload), so read the
crossover against both modes.  **The 90% headline: a patch is 1.7–2.4×
cheaper than destroy + recreate.  The identity patch costs 18–24 ms at
100k.  The crossover is ~70% id overlap; below it recreating wins, 1.8×
at 50% and 2.3× at 10%** — the number the plan required the docs to
carry, now in `Core#patch`'s JSDoc, `src/README.md` "Patch" and
`features.csv`.  Where the low-overlap time goes, profiled at 10%
(wire, ~550 ms): ~200 ms removal (handle interning with its id decode,
per-edge adjacency and curve-index unlinks, `DataStore.clearSlot` per
key, the id blob's compaction), ~115 ms adds into a free list that
scatters slots (the contiguous-run fast paths of a fresh load do not
apply), ~150 ms the first style apply of 90k new elements (which
recreate pays too), ~80 ms the diff's handles, ~45 ms the plan.  Two
cheap levers were tried and measured: a curve-index bulk window around
the adds (no change on this straight-edge fixture; reverted) and
fresh-id repeats checked in a scratch `IdMap` from bytes instead of
decoded strings (kept; ~10 ms off the 10% plan).  A bulk store removal
would move the crossover and is logged in `src/README.md`'s follow-up
hooks, not built — the headline refresh is high-overlap.

**The follow burst** (round 106's live-following clone, priced here as
its plan asked): `follower.patch( master.serialize() )` after 1% of the
master's nodes moved costs serialize 0.29 / 2.12 / 24.4 ms and patch
0.26 / 1.77 / 22.6 ms at 1k / 10k / 100k elements.

**Bundles**: +11.9 KB minified on each build (full 893,447 → 905,382;
headless 525,271 → 537,210; headless-gpu 604,388 → 616,323), +4.0 KB
gzipped; inside the round-131 ratchet.

**Controls.**  The three the plan named, each with its own control in
`test/patch.mjs`: the identity patch from definitions, columnar, wire
and `serialize()` — empty diff, zero element events, `hasDirty()`
false, no delta spans, no mapper spans — against the same payload with
one value perturbed (the diff, the `data` event and the spans all
appear); the listener census — each of remove/add/data/position once,
all inside the batch, the `patch` event once after it with the returned
diff — against a no-op payload; end-state equivalence — patch A→B from
each form leaves every `COLUMN_SPECS` column equal to a fresh load of B,
id by id (endpoints compared as ids, the selected bit masked) — against
a B with one value moved, which the comparison must reject.  Ten
mutations of the implementation were then run against the file; eight
failed specs at once, and **two stayed green**, each a finding: killing
the *source* half of the rewire check passed because the fixture only
rewired targets, and writing a compound parent's payload position
passed because the parent was listed before its children, whose writes
then overwrote the shift.  Each gained a spec (a source-only rewire; the
parent listed after its children) and the mutation now fails.

**Calls taken in-round** (none reopens a sitting decision):

- *Parents are structure, replaced like data*: a member with no parent
  in the payload is an orphan after the patch.  The load path reads the
  payload the same way, and "absent = keep" would make the columnar form
  (whose parent column is all-or-nothing) unable to orphan anything.
- *Positions*: the plan's "present → written"; per node in the
  definition form (a presence mask), all-or-nothing in the columnar
  form.  A locked node and every node under `autolock` hold, as against
  `position()`; a compound parent's position is derived, as at load —
  both keep end-state equivalence with a fresh load.
- *Session state is the survivor's*: `selected` / `selectable` /
  `locked` / `grabbable` / `pannable` are read from the payload only for
  added elements.  This is what the plan's "selection survives" needs,
  and it is round 106's "a clone owns its state" for free.
- *Events after the mutations*: every element event fires once, inside
  the batch, after the last mutation — so `remove()` was split into
  `_removeClosure` (the store half) and its events, and a listener never
  observes a half-applied payload or mutates under the plan.  A
  reparented survivor emits `moveout` + `move`, as `move()` does.
- *Validation before mutation*: every error the payload can cause is
  the planner's, so a rejected patch leaves the graph untouched (the
  refusal specs assert `cy.json()` unchanged).  Unknown option keys
  throw, as elsewhere in v4.
- *An identity patch still emits `patch`*, with an empty diff: the
  summary event means "a patch ran", which a throttled follower wants.
- *A rewired edge is in both `removed` and `added`*, and removed
  handles keep `id()`/`group()` — what a clone sync (round 106) needs to
  mirror the change.
- *Graph-level data in a wire payload is ignored*, as `cy.add()` does:
  the plan's "elements only".

**Deferred, with reasons.**  The live-following clone and its minimap
proof in `debug/`, which the round-106 replan put with this round: they
need `cy.clone()` and the dirty-stream consumer cursors, both round
106's layers 1–2, and 106 runs next; the loop they will drive is
`follower.patch( master.serialize() )`, specced here and priced above.
The React (and other framework) wrappers: after alpha, PLAN.md item 46.
A bulk store removal for the low-overlap case: logged, not built.

`npm run -s test:node:quiet` green at close: 2,899 unit tests (+39: 38
in `test/patch.mjs`, one in `test/id-map.mjs`), 813 module; the type
tests and the declaration surface audit (59 type exports) green.
