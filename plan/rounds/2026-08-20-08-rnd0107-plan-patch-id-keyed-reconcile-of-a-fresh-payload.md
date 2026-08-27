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

