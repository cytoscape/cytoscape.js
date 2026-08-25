## Attribute-table and filter affordances

The consumer case: Cytoscape Web built its TableModel/TableBrowser
(glide-data-grid) and FilterModel *on top of* cytoscape.js by copying
every element's data out into its own store, and desktop treats the
network table and filters as core UI.  v4's sidecar is already the
columnar store a table wants — the round's job is to stop making a
grid copy it.  What the code does today, verified:

1. **The sidecar is columnar and typed already** — per-(group, key)
   columns: numbers as Float64Array + presence bytes, strings
   dictionary-encoded (1-based Uint32Array, 0 = absent) with per-entry
   refcounts and an order-preserving compaction that bumps a
   per-column `epoch`, mixed as a plain-array fallback
   (`data-store.mts:34-55`, compaction 622-661).  `keys()` answers the
   union in first-write order — over the group's *history*, empty
   columns stand (`data-store.mts:197`).  `reader()` hoists column
   resolution out of a scan (`:153`), and `exportColumns` already
   emits index-aligned wire shapes per key (`:207`).  `DataStore.epoch`
   bumps on every value write/clear/ingest and deliberately not on
   dict compaction or slot remap (`:105-109`) — one counter over both
   groups.
2. **Whole-object `data()` is epoch-keyed** (`collection.mts:2253-2262`,
   round 62.4): two reads with no write between return the same
   object.  A naive grid binding `data()` per row therefore pays one
   object per row, re-materialized after every write burst.
3. **The query IR** (`matcher.mts:49-78`): group + state booleans +
   structural terms + per-key data conditions
   (`eq/ne/lt/lte/gt/gte/in`, exactly one op; unknown keys and ops
   throw, `:127-139`, `:187-193`).  Whole-graph scans hoist per-key
   readers (`graph-store.mts:4221-4230`); `Collection.filter` on a
   subset does **not** — it calls `store.data.get` per element per
   condition (`collection.mts:1330`).  Nothing consults the
   dictionary: a string `eq` re-compares strings per slot where one
   dict lookup plus a u32 compare per slot would do.
4. **No topology predicates**: degree is O(1) off the CSR
   (`adjacency.mts:253`, `:264`) but the IR has no degree term;
   "connected to X" is spelled `neighborhood()` + intersection today.
5. **Change signals exist but are fine-grained**: element data writes
   emit `data` per element, listener-gated
   (`collection.mts:2324`, `:2377`), with no changed-keys payload;
   graph-level `cy.data()` also emits `data` (`core.mts:2131-2143`);
   `add`/`remove` fire per element.  The epoch — the natural coarse
   invalidation key — is private.
6. **Collections are eager**: a result is a refs array plus interned
   handles (`collection.mts:319-352`), and every speed mechanism
   around them (the `elements()` memo, `_dataObj`, `_eles`, packed-key
   maps) assumes immutable eager refs.  `scanRefsInto` writes refs in
   insertion order (`graph-store.mts:4198-4205`).

Scope honesty up front: v4 ships columns, keys, coverage and fast
predicates; the grid, its sorting/column UI and the filter-builder UI
stay app-level.

### 84.1 — the column view API

The read surface a data grid renders 100k rows from without
materializing 100k objects:

- `cy.dataKeys( group )` → `[ { key, kind, coverage } ]` — `kind` is
  the column's (`'number' | 'string' | 'mixed'`), `coverage` how many
  live elements carry a value.  Keys are the historical union, stated
  in the JSDoc (a cleared key stays listed at coverage 0 — the
  documented `keys()` semantics, not a defect).
- `cy.dataColumn( group, key )` and `eles.dataColumn( key )` — a
  **snapshot** in exactly the shapes `exportColumns` already emits
  (Float64Array with NaN holes / `{ dict, indices }` / plain array),
  aligned to a stated row order: insertion order for the core form
  (the `scanRefsInto` order, which is also `cy.nodes()` order), the
  collection's own order for the collection form.  Snapshot rather
  than live view, decided: dict compaction remaps indices **in
  place** (`data-store.mts:647-652`), so a live view would silently
  re-key under a consumer's feet.  The snapshot carries the DataStore
  epoch at capture so "still current?" is one int compare.
- **Synthesized columns**: `id` (and edge `source`/`target`, node
  `parent`) are first-class, not sidecar (`collection.mts:2264-2277`)
  — the surface synthesizes them as columns too (ids off the id blob,
  no per-element handles), or a grid has rows it cannot label.
- **Subscription**: the epoch goes public (naming open), and the
  existing `data`/`add`/`remove` events are the triggers — a grid
  listens, marks dirty, and re-pulls invalidated columns at most once
  a frame with the epoch compare deciding whether anything moved.
  Whether the `data` event gains a written-keys payload is an open
  call (additive to the Event shape; without it invalidation is
  per-store, not per-column).

**Verified by** specs asserting each column kind round-trips values
(the round-46.5 lesson: assert every column *carries values*, with the
read-the-dict-as-an-array control failing on every fixture), coverage
against hand-counted fixtures, epoch movement on write and
non-movement on read, and snapshot isolation across a forced dict
compaction.  **Measure-first gate:** coverage — measure an on-demand
presence scan at 200k before adding a maintained per-column counter to
`set`/`clearValue` (the hottest sidecar paths); if the scan is
microseconds, on-demand wins and the write path stays untouched.

### 84.2 — fast filters over columns

- **Column-compiled conditions**: compile each data condition against
  its column's kind once per filter — string `eq` resolves the value
  to a dict index once, then u32 compares per slot; `in` becomes a
  Set of dict indices; numeric ops test the Float64Array + presence
  byte directly; mixed columns keep the generic `testCondition`.  The
  case-mapper absence rule (a missing value fails every op, `ne`
  included) must survive the accelerated path — a spec pins it per
  kind.  One `compileColumnTest` helper serves both `scanRefsInto`
  and `Collection.filter`, and `filter` also gains the reader hoist
  it lacks today (`collection.mts:1330` vs
  `graph-store.mts:4222-4230`).
- **Topology predicates**, per the matcher's own extension note
  (`matcher.mts:23-26`): `degree` / `inDegree` / `outDegree` as
  numeric-bound terms (nodes-only — an edges-restricted query throws,
  the structural-term shape at `matcher.mts:237-241`), answered O(1)
  per slot off the CSR; and `adjacentTo: id | id[]` (nodes matching
  when adjacent to any listed node), built once per filter as a
  slot-membership set from the CSR rows.  Serializable, no functions
  — a FilterModel can persist every query it builds.
- **Lazy collections: declined, recorded.**  Collections are eager by
  architecture and everything fast about them assumes it; the
  non-materializing consumer is the column view (84.1) — a grid never
  asks for a collection at all, and a filter result that will be
  styled or selected wants a real one.  New IR keys join
  `QUERY_KEYS`, so a typo still throws.

### 84.3 — bench rows that discriminate, and the close

All `benchmark/data.mjs` edits land in **one batch** so the
fingerprint moves once (the round-68 rule).  Rows: `dataColumn 200k`
against the naive per-element loop (which must call `data()` per row
— and must write one value between passes, or the 62.4 cache makes
the naive side measure the memo rather than materialization);
`filter string eq (dict)` and `filter numeric range` against the
predicate-fn spelling; `filter degree ≥ k` against the traversal
spelling.  Every row asserts its result count is > 0 and < N (a
filter matching nothing or everything prices a scan, not a filter)
and asserts result-set equality across the compared spellings.
Controls, run once: the dict acceleration disabled (string compares)
must move the eq row; the CSR degree term swapped for per-element
`degree()` must move the degree row.  **Measure-first gate:** before
the dict path lands in the *subset* `filter`, measure the reader
hoist alone at bench N — if hoisting closes most of the gap there,
the dict path lands only in the whole-graph scan and the subset
number is recorded instead.  Standing close: JSDoc with
`@param`/`@throws`/`@returns` at 100%, d.ts regenerated,
`src/README.md` gains the table-affordances section,
MIGRATING/CHANGELOG rows, `test:throws` at zero.

### Risks named at planning

- A chatty writer plus a per-frame column puller is a copy storm
  (800 KB per 100k-row f64 column); the epoch compare and batching
  bound it, but the record must carry the measured re-pull cost, not
  assert it away.
- Two invalidation keys exist — the store epoch (values) and the
  per-column dict epoch (indices; `data-store.mts:27-31`, the GPU
  ordinal LUT precedent).  A snapshot consumer holding raw indices
  must be told about both or it repacks late; the snapshot shape has
  to carry them together.
- Adding a keys payload to the `data` event changes an emitted shape
  consumers already see — keep it additive and spec the no-listener
  fast path stays listener-gated (`collection.mts:2324`).

**Open:** the surface's naming — flat members (`cy.dataKeys`,
`cy.dataColumn`) or one `cy.table( group )` view object; whether the
`data` event gains a written-keys payload now or waits for demand;
whether `adjacentTo` ships nodes-only in v1 (edges' `incidentTo` twin
deferred); whether the epoch is exposed raw or wrapped in a
`changedSince( token )` shape; and coverage counter vs on-demand scan
if the measurement lands near the line.
