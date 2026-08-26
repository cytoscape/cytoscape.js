## Fixing what the benchmark sweep measured

Round 33 measured the prototype and found five paths slower than v3 or
than v4's own design implies, logging each rather than fixing it because
a measurement round measures.  This round fixes them.  It is the first
round in a while whose commits change `src/`, so the browser suites are
back in the verification gate.

**A correction first, and it changes one of the five.**  Profiling
`StyleEngine.readProp` before touching it showed **23% of its samples in
`__name`** — esbuild's name-preserving wrapper, an
`Object.defineProperty` per closure *creation*, which tsx injects and
which does not exist in the built bundle (`grep -c __name
build/cytoscape.esm.mjs` → 0).  Measured through the bundle instead,
the same getter is **292 ns, not 2.0 µs**, against v3's 50 ns: the real
gap is **5.8×**, not the 13–21× round 33 published.  The finding is real
and worth fixing; its magnitude was inflated by the transpiler, in a
suite that imports `src/` directly.

That is the round-30 lesson ("coverage of transpiled sources needs
source maps, or it lies") in a second guise, and it generalizes: **for
closure-heavy hot paths, benchmarking the tsx sources measures the
transpiler.**  Recorded in `AGENTS.md`, and the other four findings were
re-measured through the bundle before any fix (they hold: they allocate
little and are dominated by real work).

**The five, re-measured through `build/cytoscape.esm.mjs`** — these
are the numbers the round is judged against, at N=2000 nodes / 4000
edges on the i9-9900K:

| path | v4 before | v3 | gap |
|---|---|---|---|
| `ele.style( 'background-color' )` | 292 ns | 50 ns | 5.8× |
| phased emit, no listeners | 530 ns | (flat: 112 ns) | 4.7× |
| layout contract, empty impl | 333 µs | — | O(V+E) per run |
| `cy.mutableElements()` | 121 µs | 18 ns | O(V+E) per call |
| `eles.indexOf( ele )` | 3.63 µs | 45 ns | 81× |

**Design calls (round 34):**

1. **Behaviour is preserved exactly; these are not semantics changes.**
   Every fix keeps the observable contract — element order, event
   ordering and phase semantics, the values getters return.  Where a
   fix could change something visible (the `elements()` memo returns the
   *same object* to two callers where it used to return two), that is
   called out and pinned by a spec.
2. **Each fix is measured before and after, through the bundle**, and
   the round record carries both numbers.  A fix that does not move its
   number is reverted, not shipped with a story.
3. **The order-list scan is the contract for "all elements in order".**
   `nodeSlots()` currently walks handles; the replacement walks the same
   insertion-order list `scanRefsInto` walks, so layouts see identical
   order — which matters, since grid and circle assign positions by
   index.
4. **No public *semantics* change; one public *shape* change.** Making
   `LayoutContext.eles`/`.nodes` lazy turns two readonly fields into
   getters, which is a `.d.ts` shape change (property access is
   unaffected).  `dist/cytoscape.d.ts` is regenerated and
   `test:types:surface` re-run.
   *Wrong, as it turned out (34.6): `LayoutContext` is not in the
   shipped declarations at all — it appears only inside a doc comment —
   so the getters change no public shape.  What did reach the `.d.ts`
   is the store's two new members (`structureEpoch`, `scanSlotsInto`),
   since `cy._store` is typed; 1093 → 1097 doc blocks.*

**Pass split** (tests-first; docs in-commit; each pass its own commit):

- [ ] **34.0 Docs-first** — this plan, the round-33 correction recorded
  in its own record and in the README, and the `AGENTS.md` note about
  benchmarking transpiled sources.
- [x] **34.1 `indexOf` is O(1)** (2026-08-03) — the lazily-built
  packed-key membership `Set` became a `Map` from key to *first index*.
  Set membership only ever asks `.has()`, which a Map answers
  identically, so the ten set-op call sites are untouched; `indexOf`
  now reads the index straight out of the same cache instead of
  re-packing every ref in a linear scan.
  **12.5 µs → 42 ns** at N=2000 (measured through the sources on both
  sides), which is **parity with v3's 42 ns** — the 81× gap is gone
  rather than narrowed, because the cache the set ops already build was
  carrying the answer all along.

  `indexOfId` is deliberately **not** changed: it compares each
  handle's cached `_id`, which still resolves for a *removed* element
  held in a collection, and answering it from the store's id index
  instead would quietly change that.  It was not one of the five.
  Tests-first: two specs in `test/collection-reference.mjs` pinning
  that the two consumers agree whichever builds the cache first (a
  wrong shared cache shows up as one of them answering differently),
  and that every element of a 40-element collection reports its own
  index.  2489 Node tests.
- [x] **34.2 `elements()` memoized against a structure epoch**
  (2026-08-03) — `GraphStore` gained `structureEpoch`, bumped at the
  three places an element enters or leaves the insertion-order list
  (`allocSlot`, `freeSlot`, the bulk id path) and on compaction, and
  the core memoizes the three **unfiltered** collections against it
  (`elements()`, `nodes()`, `edges()` with no query — a query argument
  is never memoized).
  **121 µs → 18 ns** for `mutableElements()` at N=2000, against v3's
  14 ns: parity, from an O(V+E) scan plus a handle intern per element.
  `elements()` is 16 ns and `nodes()` 19 ns on repeat.

  *A deliberate visible consequence*: two calls with no structural
  change between them now return **the same collection object** where
  they returned two equal ones.  Collections are immutable snapshots,
  so nothing can observe this except identity itself — and a spec pins
  it rather than leaving it to be discovered.
  Why a counter and not a count: `add` one, `remove` another between two
  calls leaves the count identical and the *set* different, so a
  count-keyed cache would answer the second call with a dead ref and a
  missing element.

  Six specs in `test/core-api.mjs`, and the two
  controls that matter were run: keying the cache on element count
  instead of the epoch fails the add-one-remove-one spec, and dropping
  the `freeSlot` bump fails the add-and-remove spec.  Style, position
  and data writes deliberately do *not* invalidate — pinned by a spec
  that also reads the new values back through the cached collection,
  since a collection holds refs into the columns rather than a copy of
  them.
- [x] **34.3 The phased emit takes the no-listener fast path**
  (2026-08-03) — landed, **and it corrected the finding on the way in**.

  The gate itself: `_emitOnEle` returns before building the event or
  walking ancestors when nothing listens for the type.  Sound because
  v4's emitter never bubbles to a parent (`bubble` defaults false and
  v4 does not override it), so an emit with no matching listener is
  observably a no-op.  **338 ns → 8 ns** for a node two ancestors deep
  and 159 → 6 ns for an orphan, with a listener present unchanged.
  *Correction to round 33's finding 2, measured*: the row that finding
  used — `child.position()` at 6.4× an orphan's with no listeners —
  **never reached `_emitOnEle` at all**.

  The position writers already
  gate on `hasListeners( 'position' )` (as do `add`, `remove`, `data`
  and `move`), so what that row measured is the **compound auto-bounds
  invalidation**: a child's position write marks its ancestor chain
  geo-stale, which is round 14.3 working as designed, not a defect.

  What *is* true is the narrower claim this pass fixes: `_emitOnEle`
  itself did no listener check, so it cost 338 ns on a compound child
  before discovering nobody cared.
  That still matters, because **the pointer layer's sixteen call sites
  are ungated** — `mouseover`/`mouseout`, `pointerover`/`pointerout`,
  `tap`, `tapselect`/`tapunselect`, the box family — and they fire on
  hover transitions and pointer moves, which is the latency path.
  Four specs in `test/compound-events.mjs` pin the boundary from
  both sides, with two controls run: making the gate unconditional and
  gating it on the wrong type each fail 12 of the file's 13 specs.
- [x] **34.4 The layout contract stops materializing the graph**
  (2026-08-03) — two changes, and the second is the one that mattered.
  `eles`/`nodes` became **lazy getters**, so a columnar layout that
  never asks for handles never builds them; and `nodeSlots()`/
  `edgeSlots()` stopped walking those handles at all, reading slots
  from the store's insertion-order list (whole-graph scope) or the
  scope collection's refs (subset scope).  `GraphStore.scanSlotsInto`
  is the slot-only twin of `scanRefsInto` — same walk, same
  `(mask, want)` test, no `Ref` allocated — and the per-element filter
  became one mask: alive, not a parent, not locked.

  **391 µs → 1.72 µs** for an empty impl at 2000 nodes / 2000 edges
  (~230×), and a subset scope's is 875 ns.  A columnar bulk placement
  over the whole graph is 57.6 µs, which is now *the placement*; an
  impl that does ask for `ctx.nodes` still pays 122 µs, unchanged and
  by design — you pay when you ask.
  The risk here was **order**, since grid and circle place by index, so
  a different enumeration order is a different layout.  Five specs in
  `test/layout-contract.mjs` pin `nodeSlots()`/`edgeSlots()` as
  *exactly* `cy.nodes()`/`cy.edges()` order, the locked/parent
  exclusions, subset order, and that `eles`/`nodes` still answer when
  an impl does ask.

  Control: enumerating in reversed slot order
  instead fails 2 of the 43 specs across the contract and layout files.
  Landed with a repeat of this codebase's most familiar bug: inserting
  `scanSlotsInto` above `scanRefsInto` **stranded the latter's doc
  block**, which the round-26 coverage gate caught immediately — the
  ninth instance of the pattern, and the first one a gate found rather
  than a reader.
- [x] **34.5 `readProp`** (2026-08-03) — landed as **two** fixes,
  because the planned one turned out to be a no-op in production and
  design call 2 says a fix that does not move its number is not shipped
  with a story.
  *(a) The closures, hoisted.*  The five column readers built inside
  `readProp` became module-level helpers taking `(store, slot, id)`.
  Under tsx this is **1848 ns → 255 ns** — because each closure
  creation also paid esbuild's `__name` wrapper — but **in the bundle
  it is 292 → 288 ns, which is noise**: V8 creates closures cheaply
  when nothing is decorating them.  So this half fixes the *harness*
  (every Node test and benchmark runs through tsx) and not the product.

  Kept, and reported as exactly that.
  *(b) `normalizeProp`, memoized* — the fix that moved the production
  number.  Profiling the **bundle** put **36.4% of `readProp` in
  `normalizeProp`** and another 4.5% in its `([A-Z])` regex: every
  style read was doing a regex replace and a lowercase allocation to
  turn `backgroundColor` into `background-color`, before the 145-case
  switch it precedes.  A `Map` cache (bounded at 512 entries, since an
  unknown name is normalized *before* it is rejected) takes
  `ele.style( 'background-color' )` from **292 ns → 122 ns** against
  v3's 52 ns — the gap goes **5.8× → 2.3×**.  `numericStyle` 215 → 84
  ns, `effectiveOpacity` 240 → 92 ns, `style( 'width' )` 227 → 89 ns.

  Three specs in `test/style-getters.mjs`: both spellings answer
  identically, a restyle is visible through both, and an unknown name
  still throws — twice, so a cached normalization cannot turn the
  second call into a silent success.  Control: making the memo return
  the raw name fails 3 of the file's 19 specs.
  Landed with the *tenth* instance of the stranded-doc-block pattern
  (my comment displaced `normalizeProp`'s JSDoc), caught by the gate
  again.
- [x] **34.6 Verification + closing sweep** (2026-08-03).
  **The five, before and after, through `build/cytoscape.esm.mjs`**
  at N=2000 (the `style` row from a dedicated process — a micro-row in
  a shared one varies ±30% run to run, which is itself worth knowing):

  | path | before | after | v3 |
  |---|---|---|---|
  | `ele.style( 'background-color' )` | 292 ns | **122 ns** | 52 ns |
  | `_emitOnEle`, nothing listening | 338 ns | **8 ns** | — |
  | layout contract, empty impl | 333 µs | **795 ns** | — |
  | `cy.mutableElements()` | 121 µs | **20 ns** | 18 ns |
  | `eles.indexOf( ele )` | 3.63 µs | **41 ns** | 41 ns |

  Three of the five are now at parity with v3 or better; the style
  getter is 2.3× (from 5.8×) and the two v4-only paths are 420× and
  42× cheaper than they were.

  **Verification**: typecheck, lint, **2508 Node tests** and 77 module
  tests, JSDoc 100% with `@throws` 16/16 and `@param` 221/221,
  `gpu-throw-coverage` at 0 Node-reachable dead sites, the regenerated
  `dist/cytoscape.d.ts` (1093 → 1097 doc blocks — the store's two
  new members) with `test:types:surface` clean, and — since this round
  changes `src/` — **168/168 browser specs** across `webgpu` and
  `visual` against a hand-rebuilt bundle (an `http-server` *was*
  listening on 3333, which is exactly the standing trap, so
  `test:playwright:build` was run by hand first).

  Goldens are
  byte-stable and the parity scenes read their recorded values
  (`parity-charts-pie` 0.000%, `parity-casing` 0.061%,
  `parity-polygon` 0.005%): **the five fixes change no pixels.**
  Docs swept: the README's Benchmarks section carries the before/after
  for each path and its follow-up hooks strike the five through; the
  three benchmark suites whose comments recorded the findings now
  record the fixes and say they stay as the rows that would notice a
  regression.  The three named drift sites need nothing — round 34
  closes no design calls and opens none.
  **Round 34 is complete.**

**Risks tracked**: the `elements()` memo going stale on a path that
mutates the graph without touching the order list (mitigated by bumping
at the order list itself, which is the one structure every add and
remove passes through); the emit gate skipping an emit that some code
depends on for a side effect other than its listeners (mitigated by the
`bubble: false` argument and by the event-order specs); `nodeSlots()`
changing layout order (mitigated by walking the same order list, and
pinned by the layout suites' exact-position expectations); and
`readProp`'s size making a mechanical edit error-prone (mitigated by
typecheck plus the readback specs, which assert values per prop).
