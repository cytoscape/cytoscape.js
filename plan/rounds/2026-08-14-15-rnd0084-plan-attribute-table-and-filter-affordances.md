## Attribute-table and filter affordances

**Depends on:** 2026-08-14-02

**12 October scoped pass:** benchmark visible rectangular reads, scrolling,
distant jumps, dirty updates, snapshot construction and allocations against
benchmark-only column prototypes, with whole-table sort/filter/facet context.
Use 10k, 100k and 1m rows, mixed/sparse data and sparse/bulk updates. Deliver
measurements and a recommendation without new public API or a new performance
pass/fail budget. Internal filtering changes are separate from this pass.
The [interview](2026-10-12-01-rnd0000-note-bun-documentation-and-table-benchmark-interview.md) scopes this work; API decisions and round closure remain follow-up.

Later specification decisions are recorded in the
[alpha contract interview](2026-10-06-01-rnd0000-note-alpha-contract-interview.md)
and supersede conflicting alternatives below. Remaining questions and review
requirements are consolidated in the
[11 October register](2026-10-11-01-rnd0000-note-alpha-interview-open-questions.md).
These pointers do not change this round's implementation status.

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

### 12 October scoped pass: rectangular reads and dirty refresh

**The scoped benchmark pass is complete; round 84 remains planned.** This
measurement adds visible-window scrolling and jumps, dirty updates, snapshot
construction/refresh and allocation evidence at 10k, 100k and 1m rows. It
does not implement a column API or internal filtering changes, and it sets no
performance pass/fail threshold.

#### Method and controls

Each fixture has N nodes and N edges. The seven data fields are the same as
the earlier run: unique `label`, numeric `score` and `rank`, 20-value `group`,
5-value `region`, mixed boolean `active`, and `note` present on every tenth
row. The visible rectangle is 60 rows × 8 columns, including `id`. Each
scrolling pattern has 32 viewports: sequential starts advance one row at a
time; seeded jumps are at least one viewport apart. The final row stays out
of those traces so the separate epoch-invalidation fixture can use it.

The public paths are `data( k )` reads per cell and `data()` once per row.
The benchmark-only prototypes read the private store columns and compare a
cached whole-table snapshot, a 60-row snapshot that copies the full string
dictionaries, and a 60-row snapshot that constructs local dictionaries from
only the window's strings. The cached snapshot is measured separately from
building it. Dirty-update paths write the same unique `score` rows in a
batch, collect the same `data` events, return row/value arrays to a consumer,
and compare public `data( score )` reads against refreshing only those rows
in the prototype snapshot.

Controls run outside the timed operations. Every snapshot variant is checked
cell by cell against public `data( k )` on all 64 scroll viewports; an altered
string dictionary must fail that check. A sparse-column probe keeps a missing
value as `undefined` and distinguishes it from `NaN` in a mixed column.
Every sort compares all sorted values, allowing only tie identity to differ.
Filter spellings compare their exact ordered row identities. Dirty updates
check before and after values, event counts, returned rows and values, and
whether the whole-table snapshot epoch is stale or refreshed. All nine
reportable processes passed these controls.

The commands were `mise exec -- npm run -s build` (Rolldown 1.1.5), then
three independent serial Node processes at each size, for example:

```sh
mise exec -- node --expose-gc benchmark/table-view.mjs \
  --nodes 10000 --repeat 5 \
  --json benchmark/published/table-view/round84-10k-run1.json
```

The same command was run with `--nodes 100000` and `--nodes 1000000`, and
with `run1`, `run2`, and `run3` output paths for each size. Each operation has
one warm-up and five measured samples; the tables below report the median of
the five samples in each process, then the median and range across the three
independent process medians. A trace records its total and each viewport
separately. Per-window p50, p95 and range pool 480 viewports (32 × 5 × 3).
Each JSON retains every raw timing sample and all 160 window samples per
trace per process.

Machine: Intel Core i9-9900K @ 3.60 GHz, 16 logical CPUs, Linux x64
(`7.1.10-100.fc43.x86_64`), 63 GiB RAM, Node v24.18.0 (V8
13.6.233.17-node.50). The benchmark used the built headless bundle. All runs
used the same harness, source and bundle fingerprints; the fingerprints and
exact process command are in each raw JSON. Node could not spawn `git` in
this sandbox, so `gitHead: null` is preserved as captured. After the serial
run set, the shell verified head
`736b99302ca45822746dfb278dc6a8fe4b9258fa`; `externallyVerifiedGitHead` and
its provenance record that root confirmed no commits during the timing
window. The harness remained uncommitted, and its SHA-256 plus source/bundle
hashes identify the measured instrument and subject.

The nine raw artifacts are [10k run 1](../../benchmark/published/table-view/round84-10k-run1.json),
[10k run 2](../../benchmark/published/table-view/round84-10k-run2.json),
[10k run 3](../../benchmark/published/table-view/round84-10k-run3.json),
[100k run 1](../../benchmark/published/table-view/round84-100k-run1.json),
[100k run 2](../../benchmark/published/table-view/round84-100k-run2.json),
[100k run 3](../../benchmark/published/table-view/round84-100k-run3.json),
[1m run 1](../../benchmark/published/table-view/round84-1m-run1.json),
[1m run 2](../../benchmark/published/table-view/round84-1m-run2.json), and
[1m run 3](../../benchmark/published/table-view/round84-1m-run3.json). The
[artifact README](../../benchmark/published/table-view/README.md) explains
their standalone raw-data format. They are not added to the standard
published benchmark index or report schema.

#### Grid and snapshot costs

Times below are in milliseconds except the final viewport column. Each cell
is `median [range]` across the three process medians.

| Rows | Cold full `data()` pull | Warm full `data()` pull | Eight `data( k )` arrays | Eight-column snapshot | Snapshot refresh after epoch change | One 60 × 8 view: per-cell / cold row-object |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10k | 7.06 [7.02–7.12] | 0.289 [0.286–0.292] | 1.98 [1.98–2.15] | 1.49 [1.45–1.50] | 0.584 [0.569–0.595] | 104 / 34.5 µs |
| 100k | 64.8 [63.9–67.2] | 2.93 [2.73–3.16] | 26.3 [25.9–26.6] | 5.72 [5.56–5.88] | 5.43 [5.38–5.45] | 106 / 33.9 µs |
| 1m | 655 [646–665] | 96.1 [91.8–114] | 923 [915–955] | 73.8 [63.8–89.3] | 82.8 [65.5–83.3] | 114 / 33.4 µs |

The full snapshot's retained materialization grows with the table. At 1m it
contains 32,000,000 typed bytes, 2,000,000 JavaScript array slots and
1,000,062 string-dictionary entries; the post-GC retained estimate is about
53.4 MiB. A 60-row full-dictionary snapshot still copies 1,000,062
dictionary entries at 1m and takes 3.21 ms [3.17–3.37] per window, with
about 7.63 MiB retained. The compact 60-row snapshot has 91 local dictionary
entries and 1,920 typed bytes; it takes 43.3 µs [35.8–43.4] and retains
about 0.01 MiB. Retained bytes are post-GC estimates with the result held;
the `heapUsed + arrayBuffers` delta before GC is noisy live-memory growth,
not total allocation. The raw files preserve both estimates and the typed
payload, array-slot and dictionary counts so short-lived allocation is not
mistaken for zero churn.

#### Scrolling and distant jumps

Each table cell shows total time for a 32-viewport trace, the range across
three process medians, then pooled per-viewport p50/p95 and min–max. The
traces read 15,360 cells each. Values are milliseconds for total traces and
microseconds for viewports unless shown otherwise.

| Sequential (+1 row) | 10k | 100k | 1m |
| --- | --- | --- | --- |
| Public `data( k )` per cell | 0.840 [0.839–0.889]; 24.8/37.8; 13.0–53.6 | 0.656 [0.642–0.671]; 19.7/22.2; 14.6–44.5 | 0.671 [0.665–0.676]; 19.9/23.0; 14.7–51.1 |
| Public cached `data()` row objects | 0.319 [0.318–0.330]; 9.4/11.4; 8.7–48.6 | 0.290 [0.290–0.292]; 8.8/9.1; 8.7–19.6 | 0.290 [0.290–0.294]; 8.9/9.4; 8.7–20.3 |
| Cached full-table snapshot | 0.722 [0.722–0.738]; 22.2/25.6; 9.2–99.2 | 0.497 [0.493–0.504]; 14.9/20.7; 14.6–32.2 | 0.486 [0.485–0.487]; 14.8/15.7; 14.5–33.7 |
| Build full-dictionary window, then read | 0.763 [0.743–0.765]; 19.3/45.3; 17.6–369 µs | 9.56 [9.49–9.60]; 294/322; 275 µs–4.03 ms | 104 [104–107]; 2.93/7.41 ms; 2.74–23.3 ms |
| Build compact-dictionary window, then read | 0.725 [0.723–0.730]; 21.8/25.4; 20.9–38.8 | 0.721 [0.718–0.731]; 22.0/23.4; 20.9–73.0 | 0.749 [0.748–0.775]; 22.2/33.2; 20.8–74.4 |

| Seeded distant jumps | 10k | 100k | 1m |
| --- | --- | --- | --- |
| Public `data( k )` per cell | 0.442 [0.433–0.475]; 13.5/14.6; 13.0–64.6 | 0.491 [0.490–0.512]; 15.1/16.1; 14.7–72.5 | 0.531 [0.517–0.582]; 16.3/26.5; 15.2–52.4 |
| Public cached `data()` row objects | 0.275 [0.273–0.280]; 8.3/11.6; 8.1–17.2 | 0.297 [0.293–0.299]; 8.9/13.1; 8.7–19.1 | 0.313 [0.303–0.318]; 9.6/14.8; 8.8–20.8 |
| Cached full-table snapshot | 0.304 [0.303–0.306]; 9.3/10.6; 9.2–18.8 | 0.305 [0.303–0.308]; 9.4/9.5; 9.2–17.6 | 0.307 [0.298–0.309]; 9.3/10.6; 9.0–18.0 |
| Build full-dictionary window, then read | 0.592 [0.586–0.624]; 18.1/28.3; 16.9–40.0 | 9.59 [9.59–11.5]; 295/368; 278 µs–4.31 ms | 108 [106–108]; 2.97/7.78 ms; 2.75–8.49 ms |
| Build compact-dictionary window, then read | 0.714 [0.712–0.722]; 22.1/26.9; 21.2–430 µs | 0.719 [0.709–0.735]; 22.0/26.3; 21.1–39.0 | 0.747 [0.736–0.758]; 22.5/28.5; 21.0–49.1 |

The full-dictionary window path exposes the dictionary-copy cost: its 32-view
trace rises from 0.76 ms at 10k to 9.6 ms at 100k and 104–108 ms at 1m.
The compact local-dictionary variant removes that O(N) copy and stays near
0.72–0.75 ms per trace, but is slightly slower than public per-cell reads
and slower than warm public row-object reads. A cached full snapshot is
faster than per-cell reads by only about 0.16–0.22 ms per 32-window trace at
100k–1m, after paying a 5.4–82.8 ms refresh on a store write. The complete
pooled ranges, including occasional outlier windows, remain in the raw files.

#### Dirty updates and whole-table context

The dirty workload has the same batch writes, event collection and consumer
result arrays for both paths. Times are `public path / prototype dirty-cell
refresh`, each as median [range] across three processes.

| Changed rows | 10k table | 100k table | 1m table |
| ---: | ---: | ---: | ---: |
| 1 | 128 [127–131] / 83.6 [82.6–98.5] µs | 131 [129–166] / 74.7 [73.9–79.9] µs | 156 [146–205] / 86.3 [84.8–88.4] µs |
| N/1000 | 10: 215 [205–292] / 200 [199–206] µs | 100: 1.50 [1.49–1.72] / 0.836 [0.821–0.901] ms | 1,000: 10.7 [8.30–11.4] / 8.02 [7.91–8.65] ms |
| N/100 | 100: 0.848 [0.826–0.933] / 0.763 [0.751–0.800] ms | 1,000: 6.56 [6.46–6.69] / 3.28 [3.22–3.52] ms | 10,000: 60.7 [60.1–64.4] / 59.3 [59.2–59.7] ms |
| N/10 | 1,000: 6.20 [6.12–6.47] / 3.83 [3.74–4.00] ms | 10,000: 50.4 [49.6–52.2] / 47.1 [44.9–49.8] ms | 100,000: 588 [587–606] / 591 [583–595] ms |

Whole-table operations are context, not an internal-filtering proposal. At
1m, score sorting took 3.51 s through a comparator, 541 ms after extracting
the column, and 353 ms for a one-column snapshot plus index sort. The
high-cardinality label snapshot sort was slower than extracted sorting
(2.07 s vs 1.94 s); a group facet was 136 ms through a `Map` vs 8.64 ms as a
dict-index histogram, while the label facet was 461 ms vs 280 ms. The public
whole-table `group = g3` predicate took 127 ms, compared with 5.89 ms for
prototype row indices and 17.3 ms including the internal collection build.
Numeric range and degree controls are also captured at all three sizes in
the raw files. Filter implementations remain separate future work.

#### Recommendation

**Do not add a public column-view API for the measured scrolling use case.**
The public 60×8 read is about 0.03–0.11 ms for one view, and a 32-view trace
is 0.27–0.84 ms through current APIs across these sizes. A window-local
dictionary avoids copying the full string dictionary but does not beat the
public paths in this fixture. A cached whole-table snapshot buys a small
per-trace improvement over per-cell reads, but every store write forces a
5–83 ms rebuild and its retained footprint reaches about 53 MiB at 1m. A
full-dictionary per-window snapshot is especially unsuitable for scrolling
because each small view copies the table-wide dictionary.

This does not rule out a consumer with a measured, repeated whole-table
workload and a specific memory budget. The sort/facet/filter context shows
that some one-shot operations can be costly at 1m, while high-cardinality
string paths do not uniformly benefit from dictionary operations. Such a
case should be measured end to end before choosing a public snapshot shape or
an internal optimization. This scoped pass leaves the earlier API questions,
round status and separate internal filtering work open.
