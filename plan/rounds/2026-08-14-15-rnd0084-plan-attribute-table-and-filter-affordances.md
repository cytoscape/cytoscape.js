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

**Decided at the eleventh design sitting (2026-09-28):** **measure
first.**  The column view is a performance and change-tracking surface
over what `ele.data()` loops already give, so before any API: price a
100k-row grid pull, a sort and a distinct-values read through `data()`
loops against a column read, and build only if the gap matters.  84.2's
query additions (compiled conditions; `degree`/`adjacentTo` terms) are
decided alongside that measurement.  The naming, event-payload, counter
and `adjacentTo` questions wait on it.

### The measurement, as carried out (2026-09-29)

The sitting's "measure first", done; nothing public was built, and the
build call is **PLAN.md item 91**.  One commit, `f6be7a5f`:
`benchmark/table-view.mjs`, which prices a 100k-row attribute table
through today's public `ele.data()` loops against a prototype of 84.1's
column snapshots and 84.2's compiled column filters.  The prototype
lives only in the bench and reads the store's private columns
(`cy._store.data`, `dataStore.column()`, `store.adj`).

**Fixture.**  100k nodes (the rows) and 100k edges with a skewed degree
distribution; per node seven data keys, one of each column kind a grid
meets — `label` (unique strings), `score` (floats), `rank` (ints),
`group` (20 strings), `region` (5 strings), `active` (booleans, a mixed
column), `note` (a string on 10% of rows) — under a sheet that maps
`score` and `label`, so a write pays its mapped refresh.

**What the rows assert.**  Every snapshot column carries values and
equals `data( k )` row by row; the three sort spellings agree on the
sorted values; facet counts agree; every filter spelling returns the
same count with 0 < count < N; the epoch moves on a write; the coverage
scan reads the sparse column as 10%.  The cold-pull rows write one value
between passes, so the round-62.4 memo cannot turn the naive side into a
cache hit — the control is the warm row beside it (57–62 ms cold against
4–6 ms warm).

**Machine.**  i9-9900K, 63 GiB, Node 24.18, the built headless bundle
(`build/cytoscape-headless.esm.mjs`); `node --expose-gc
benchmark/table-view.mjs`, median of 5 per row, three runs — the ranges
are across the runs.

#### The numbers

| 1. Grid pull, every row × 8 columns | ms | retained |
| --- | ---: | ---: |
| `data()` objects, cold (any write since the last pull) | 56.6–61.5 | 13.2 MB |
| `data()` objects, warm (the 62.4 memo) | 4.0–5.8 | |
| `data( k )` per cell into 8 arrays | 28.2–37.7 | 7.6 MB |
| … plus key discovery (an `Object.keys` union) | +7.6–8.4 | |
| prototype: 8 column snapshots, ids synthesized | 5.5 | 5.35 MB |
| prototype: the 7 data columns, no ids | 4.0–4.4 | |
| prototype: one number column | 1.4–1.5 | (0.8 MB typed) |
| prototype: keys + kinds | 0.0012 | |

| 2. The visible window, 60 rows × 8 columns | µs |
| --- | ---: |
| `data( k )` per visible cell | 39–42 |
| `data()` per visible row, cold | 28–30 |

| 3. Sort, a row permutation | `eles.sort( cmp )` | extract + index sort | snapshot + index sort |
| --- | ---: | ---: | ---: |
| `score` (floats) | 169–176 ms | 37.7–38.6 ms | 27.8–28.3 ms |
| `label` (100k unique strings) | 258–283 ms | 106–111 ms | 119–128 ms |
| `group` (20 strings) | 69–75 ms | 33–35 ms | 17.9–18.4 ms |

| 4. Distinct values → counts | `data( k )` into a Map | dict-index histogram |
| --- | ---: | ---: |
| `group` (20 values) | 5.6–5.8 ms | 0.52–0.56 ms |
| `label` (100k values) | 22.6–25.1 ms | 14.8–15.2 ms |

| 5. Filters | ms |
| --- | ---: |
| **`group = g3`, whole table** (4,987 of 100k) | |
| `eles.filter( n => n.data( k ) === v )` | 5.0–5.6 |
| `cy.nodes( { data: { group: v } } )` (the scan, readers hoisted) | 4.56–4.60 |
| prototype: dict index, u32 compare → row indices | 0.58–0.63 |
| prototype: the same → a collection (internal spawn) | 0.95–1.01 |
| **`group = g3`, a 50k subset** (2,486) | |
| `sub.filter( n => … )` | 3.2–3.6 |
| `sub.filter( { data: { group: v } } )` (`store.data.get` per row) | 2.98–3.10 |
| 84.3's gate: the reader hoisted, string compare → a collection | 0.88–0.91 |
| prototype: dict index → a collection | 0.43–0.45 |
| **`0.2 ≤ score < 0.4`, whole table** (19,892) | |
| `eles.filter( n => … )` | 5.6–6.1 |
| `cy.nodes( { data: { score: { gte } } } ).filter( { … lt } )` | 17.0–18.3 |
| prototype: Float64Array + presence → row indices | 1.41–1.52 |
| **degree ≥ 3, whole table** (30,940) | |
| `eles.filter( n => n.degree() >= k )` | 4.1–5.2 |
| prototype: CSR out + in degree per slot → row indices | 1.69–1.72 |
| row indices → a collection, publicly (a mask read by `filter( ( n, i ) => … )`) | 1.12 |

| 6. Change tracking: a burst of writes to `score` | 1 row | 1,000 rows | 10,000 rows |
| --- | ---: | ---: | ---: |
| the burst, no listener | 85–96 µs | 4.2 ms | 29.5–30.4 ms |
| the burst, a `data` listener collecting the rows | 74–78 µs | 2.8–3.3 ms | 35.7–38.4 ms |
| re-read the dirty rows with `data()` | 1.3 µs | 0.87–1.11 ms | 9.95–10.4 ms |
| a "did anything move?" epoch compare | ~1 ns | ~1 ns | ~1 ns |

Against those, what a coarser signal implies whatever the burst: the
epoch (or a round-106 cursor, whose `dataWritten` is the same one flag)
re-pulls every column, 5.5 ms; a written-keys payload would re-pull the
one column, 1.4–1.5 ms; `batchend` with no tracking re-pulls every row
object cold, 57–62 ms.

| 7. Coverage, on demand (84.1's gate) | µs |
| --- | ---: |
| a 200k number column: sum of presence bytes | 250–265 |
| a 200k string column: nonzero dict indices | 471–513 |
| all 7 columns here, over the 100k live slots | 4,270–4,350 |

#### What the numbers say

- **Displaying a table needs no column view.**  A virtualized grid
  (glide-data-grid, the one Cytoscape Web uses) asks for the cells on
  screen: ~480 of them read through `data( k )` in 40 µs a frame, on the
  live model, with nothing copied.  The 100k-row pull matters only for
  whole-table operations — sort, filter, facets, export.
- **For whole-table reads the column is 5–10× faster, and small in
  absolute terms.**  A full pull is 28–38 ms through `data( k )` against
  5.5 ms; a low-cardinality facet 5.7 ms against 0.5 ms; a filter
  5–6 ms against 0.6–1.5 ms.  Every public spelling of every operation
  measured is ≤ 62 ms at 100k — one user action, not a frame loop —
  except the naive comparator sort (170–280 ms), whose fix is app-side
  and already available (extract the column, sort indices: 38–111 ms).
- **Sorting is the sort, not the read.**  The snapshot saves 10 ms on
  floats and 15 ms on a low-cardinality string, and loses 13–17 ms on
  100k unique strings, where ranking the dictionary is a second sort.
- **Change tracking already exists, and at a finer grain than the
  epoch.**  The per-element `data` event names the rows; collecting them
  is within noise at 1,000 writes and ~0.6 µs a row at 10,000 (a Set add
  and an event object); re-reading a dirty row is ~1 µs.  So for a burst
  of up to ~5% of the rows the listener's re-read beats an
  epoch-triggered re-pull of the columns, and `batchend` (round 139)
  gives the burst its end.  The epoch — like round 106's cursors, which
  are internal and carry the same single `dataWritten` flag — is
  store-grained: any write to any key of either group invalidates every
  column, so a chatty writer against a per-frame column puller is 5.5 ms
  a frame at 100k (the plan's copy-storm risk, measured: a third of the
  frame).  What the events lack is the written keys, and a whole-row
  re-read at 1 µs makes that gap cosmetic.
- **The one memo trap is `data()` objects.**  The 62.4 memo is keyed on
  the one store epoch, so a single write anywhere re-materializes every
  row's object: a grid that re-pulls whole objects after each write pays
  57–62 ms instead of 4–6.  `data( k )` per cell, or re-reading only the
  rows the events named, does not.
- **84.2's gains are internal and need no API.**  The whole-graph query
  scan (`cy.nodes( query )`) is 4.6 ms where the dict compare builds the
  same collection in 1.0 ms (4.6×); the subset `filter( query )` is
  3.0 ms where hoisting the reader alone gives 0.9 ms (3.4×) and the
  dict path 0.44 ms.  **84.3's gate reads: the hoist closes 82% of the
  subset gap**, so by the plan's rule the dict path would land only in
  the whole-graph scan and the subset takes the hoist.
- **The query IR's one-op-per-key rule makes a range slower than a
  predicate.**  `0.2 ≤ score < 0.4` has to chain two queries, 17–18 ms,
  against 5.6–6.1 ms for the predicate function and ~1.5 ms compiled —
  the only IR addition the numbers argue for (both bounds on one key).
  A degree term buys 2.5–3× (4.1–5.2 → 1.7 ms) over `n.degree()`, which
  is already O(1); `adjacentTo` was not priced (its public spelling,
  `neighborhood()` plus an intersection, is a different shape of work
  from a column scan).
- **Coverage, if `dataKeys` ever ships: on demand.**  The scan is
  0.25–0.5 ms per 200k column, well under any per-call budget a keys
  listing has; a counter maintained in `set` / `clearValue` would tax
  the hottest sidecar path for it.

#### Recommendation

**Do not build 84.1's column view now.**  The ratio is real (5–10× on
whole-table reads) but the absolute cost at 100k is one-shot
milliseconds, the per-frame path a grid actually runs is 40 µs through
`data( k )`, and the change-tracking half is served — row-precisely —
by the `data` / `add` / `remove` events with `batchend` bounding the
burst.  A public epoch or `changedSince` would add a coarser signal than
the one apps already have.  Revisit on a consumer's measured need
(Cytoscape Web reporting its copy as the cost, or million-row tables,
where the one-shot figures, linear in the rows, become ~0.3–0.6 s).

**If the maintainer wants it anyway, the minimal shape** is one member,
`eles.dataColumn( key )`: a snapshot in `exportColumns`' shapes,
aligned to the collection's order, ids synthesized for `'id'`, stamped
with the store epoch and (for a string column) the dict epoch together
(the planning risk about two invalidation keys).  No `dataKeys`
counter (coverage on demand), no keys payload on the `data` event, no
public epoch — the prototype's `protoColumn` in the bench is that
member, minus its guards.

**Build 84.2's internal half** — compiled column conditions in the
whole-graph scan (dict indices for string `eq` / `in`, the typed array
for numeric ops, the case-mapper absence rule pinned per kind) and the
reader hoist in `Collection.filter` — as performance work behind the
existing query API: 3.4–4.6× on query filters, no surface change.  The
IR additions (a two-bound condition on one key, `degree` terms,
`adjacentTo`) are public API and part of the maintainer's call; only
the range bound has a number behind it.

The plan's open questions — the surface's naming, the event payload,
the counter, `adjacentTo` nodes-only — wait on item 91; the counter
question is answered (on demand) whichever way it goes.
