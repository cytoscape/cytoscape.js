## Per-element bypasses

The maintainer reopened ledger item 25 — "bypasses are worth a
discussion" — and the sitting took its calls with one requirement set
above the others, verbatim: **the proposed implementation must be
fast/performant**.  This section was written as the docs-first
proposal those calls asked for (the 41.5 precedent), and the
maintainer approved it the same day with **two amendments**, which are
folded in below and marked: the sheet section's key is **`bypasses`**
(not `overrides`), and style property keys accept **both dash-case and
camelCase, in the bypasses and everywhere else in the API**.  With the
approval this section is the round-63 plan; the pass split is at the
end.

### The sitting's calls

1. **The ergonomics return, for apps and extensions; the shape goes
   design-doc-first** (this section, with its measurements, before any
   round is committed).  The residual use case the sitting named: v4
   already answers state styling (conditions), data styling (scales)
   and static per-id rules (`case` on `id`) — what it lacks is
   *imperative, runtime* per-element styling, and the strongest form
   of that is **extensions**, which must style elements without owning
   the app's stylesheet.  The app-side workaround (a data flag plus a
   sheet clause) needs sheet cooperation and leaks the flag into
   `data()`, the wire and every export.
2. **The v3 spellings return**: `ele.style( name, value )`,
   `eles.style( props )` and `removeStyle( name? )` work again, as
   sugar over the bypasses section.  This deliberately reverses
   29.3's decided drop (the throw whose message 31.1 corrected);
   `MIGRATING.md`'s "no per-element bypass" row and
   `test/decided-drops.mjs`'s pin both flip with the round.
3. **Precedence is v3's: a bypass beats everything**, the default
   sheet's selection/active conditionals included (v3 applies "its
   bypass" ahead of every selector — the header comment in
   `v3/src/style/apply.mts`).  Consequence recorded up front: a
   bypassed `background-color` hides selection blue for that
   element, exactly as a v3 bypass does — and 57.11's
   don't-bury-the-affordances rule is about *sheets*, not about a
   per-element instruction the app gave explicitly.
4. **Bypasses export, and sheet swaps replace them.**  `cy.style()` /
   `cy.json()` carry the section — strictly better than v3, whose
   `ele.json()` exports no bypass at all (verified against
   `v3/src/collection/index.mts`: data/position/group/flags/classes
   only), so v3 bypasses are silently lost on export today.  A full
   `cy.style( sheet )` replaces the section like any other; the
   keep-them idiom is spreading the getter.  A recorded deviation from
   v3's element-lifetime bypasses.
5. **Performance is the top requirement** (maintainer, mid-sitting):
   a bypass-free graph pays nothing measurable, and every bypass
   operation costs what it touches.
6. **The two amendments, taken with the approval** (2026-08-10):
   - **The section's key is `bypasses`.**  The prose keeps "bypass" as
     the concept name too — it is v3's word for exactly this surface,
     which is the point of bringing the spelling back.
   - **Style property keys accept dash-case and camelCase everywhere**
     — `foo-bar` and `fooBar` are the same key in the bypasses section,
     the sheet blocks, the getters, `transition-property` lists,
     `animate({ style })` and `removeStyle`.  Measured before planning:
     most of this is already true (sheet blocks normalize through
     `normalizeProp` in `resolveConst`; the getters through the 34.5
     memo; `transition-property` and the animation channels each
     normalize at their parse) — so the round's job is a **sweep spec
     that pins every entry point in both spellings** and a fix for any
     the audit finds bare, not a new convention.

### Why not the logged shape — measured, and rejected

Item 25 as logged would rewrite the user's sheet with id-keyed `case`
clauses.  Measured against the code (2026-08-10, through the built
bundle, N = 2000 nodes / 4000 edges, this machine), that shape hits
three walls:

1. **It cannot compose with scale-mapped channels.**  A clause's
   `then` and the `else` parse through `parseOutput` to scalars
   (`src/style-scales.mts` — the `case` Program's clause values are
   `number | RGBA`), so "wrap the channel's current value in a case"
   is inexpressible when the current value is a scale — and em-web's
   `background-color`, the flagship demo sheet, is exactly that.
   Fixing it means `else` holds a nested Program: a mapper-IR change
   with GPU-pack and readback consequences, at which point the sugar
   is no longer sugar.
2. **One bypass re-opens the round-60.4 select regression for its
   whole group.**  `partitionOf` (`src/style.mts`) deliberately
   returns null on any condition key outside `CONDITION_FLAGS` — `id`
   is not one — and since 57.1d the default sheet state-conditions
   every graph.  Measured: a 256-band select+unselect under a
   state-only sheet runs the round-61 diff path at **53.7 µs**; the
   same sheet with **one** id clause prepended (what the sugar
   produces after a single bypass) reads **392.0 µs** — 7.3×, the
   full per-slot path back for every selection the app ever makes,
   with `applyAll` gone per-element too.
3. **The chain is O(k·V).**  applyAll with k id clauses on one
   channel reads **10.0 / 10.4 / 10.8 / 16.9 / 61.7 ms** per
   swap-pair at k = 0 / 1 / 10 / 100 / 1000 — the ledger's quadratic
   concern, confirmed.  On top sit the ledger's other two concerns —
   `cy.json()` exporting a sheet the app never wrote, and removal
   needing clause identity — both of which the shape below dissolves
   rather than engineers around.

### The design: a first-class `bypasses` sheet section

```js
cy.style( {
  nodes: { /* ... */ },
  edges: { /* ... */ },
  bypasses: {
    n42: { 'background-color': 'red', width: 40 },
  },
} );
```

- **Declarative and id-keyed.**  Round 8's invariant holds — every
  value analyzable and serializable; the representation is data, not
  a closure and not a forged clause chain.  Values are
  **constants-only**: mappers stay the sheet's job (a recorded
  deviation — v3's bypass technically parses mapper values).
- **The v3 methods are sugar over it.**  `ele.style( name, value )`
  writes one entry; `eles.style( props )` writes one per element;
  `removeStyle()` with no argument clears the element's entries (v3
  semantics), with a name clears one.  The `cy.style()` getter
  returns the live section.
- **Id-keyed means declaration, not element state** — a deliberate
  semantic difference from v3: a bypass survives remove/re-add of
  its element, may name an id not yet present (inert until it is —
  what makes a hand-written section legal in a sheet set before its
  elements), and round-trips through `cy.json()`.  The one
  fail-loudly softening this admits: a typo'd id in a hand-written
  section is silently inert — recorded rather than hidden, and the
  sugar path cannot hit it (the caller holds the element).

### The performance contract (the requirement, made concrete)

1. **Bypass-free graphs pay one load.**  The engine keeps a
   per-group bypass count and slot set; every touched path gates on
   `count === 0`.  The gate is measured, not asserted: the round-62
   published zero-losers run is the baseline, and the round fails if
   any row moves past machine noise.
2. **A bypass set is one narrow write, not a restyle.**  Round 61
   factored eleven per-channel writers out of `writeChannels`
   (`partitionDiffWriters`) at exactly this granularity — one channel
   of one slot, ~50 ns measured — so `ele.style( name, value )` is a
   map update plus one writer call, with geometry channels riding
   their existing write-through cascades (`setLane`,
   `updateOuterHalf`).  The round adds the comparative row v3 makes
   possible for the first time since 29.3: `ele.style( name, value )`
   spelled identically on both sides.
3. **Apply punch-out is O(bypassed).**  The sheet paths
   (`applyBulk`, `applyPartitioned`, `refreshMapped`, `refreshState`)
   re-assert bypasses after the sheet write for bypassed slots
   only — a slot-set test per run when the count is non-zero.  The
   57.1d partition and the round-61 diff path survive untouched;
   bypassed slots fall out of record runs and take per-slot writes.
4. **GPU eval demotes per channel, count-gated, reversibly.**  A
   channel carrying ≥ 1 bypass joins the B1 `paintInputs` exclusion
   while any exists (the kernel evaluates every slot and would
   overwrite the bytes); the last removal restores kernel ownership.
   The recorded bound is round 7's 78.5-vs-15.9 ms whole-channel
   re-derive at 200k — paid only on data writes of a mapped key whose
   channel also carries a bypass — re-measured on a real renderer
   in the round.
5. **What the round must measure before claiming any of this**: the
   count-gate's nullity (the full published suite unchanged), the
   set-path row against v3, punch-out cost at k = 1 / 100 / 10k on
   the apply and select paths, and the demotion cost on an
   em-web-shaped sheet.

### Semantics inventory (the round's checklist)

- **Precedence, per channel**: bypass > user block > default sheet;
  the burying consequences (selection blue; the press wash via an
  `overlay-opacity` bypass) recorded as v3 parity.
- **Readback needs no new path**: stored truth already answers the
  bypassed value through `style()` / `numericStyle()` /
  `renderedStyle()` — v3's semantics for free.
- **Transitions come free**: bypass writes flow through the write
  funnel the 24.1 txn capture wraps, so a configured
  `transition-property` tweens a bypass change; round 21's
  latest-wins eviction against animations is unchanged.
- **Validation**: prop names validate at set — the sugar path against
  the element's group, the sheet path against the union with the
  group checked when the id resolves.  Unknown props throw, as
  everywhere.
- **The existing carve-outs ride along**: parent `width`/`height`
  stay auto-bounds-owned (the 25.1 filter), `label` stays
  constants-or-passthrough, list props take constants like any sheet
  block.
- **Out of scope**: mapper values, classes, per-element style events,
  and the wire format (the sheet is not in it).

### Controls the round owes

Readback in both directions; precedence against the default sheet
*and* against a user block; removal restores the sheet-resolved
value; a sheet swap replaces the section; a transition on a bypass
tweens; kernel ownership restored on the last removal; and the O(0)
gate as a benchmark row, since a spec cannot see a nanosecond.

### Pass split (tests-first; docs in-commit; each pass its own commit(s))

- [x] **63.0 Docs-first** (2026-08-10) — this section, amended to the
  approved design; ledger item 25 annotated.
- [x] **63.1 The camel/dash sweep** (2026-08-10) — landed as
  `test/style-camel-case.mjs`: a fully camelized copy of the 153-prop
  styled fixtures reads back identical to the dash copy through every
  sheet group, the getters compare outcome-for-outcome across the
  whole surface, and `transition-property` and `animate({ style })`
  take camel entries.  **The audit found every existing entry point
  already normalized** — the spec turns the coincidence into a
  contract.  Control: `normalizeProp` neutered to identity fails 5 of
  7 (the survivors are the meta-check and the animation spec, whose
  parser has its own normalizer — the correct reading).
- [x] **63.2 The model** (2026-08-10) — `Stylesheet.bypasses`;
  id-keyed raw declarations + per-group parsed patches; parsing
  reuses the sheet compiler's own pieces (the per-group guards
  extracted from `resolveConst` into `assertGroupProp`, and
  `applyProp` as validator/parser — a bare scratch object captures
  exactly the `Computed` fields an entry assigns, surviving a value
  equal to the channel default).  Slot resolution is lazy against
  `store.structureEpoch`: O(declared ids) per structural change,
  never O(elements).  Wrong-group props behave exactly as sheet
  blocks treat them — the guarded families throw, the rest are
  accepted-and-inert — one rule for both surfaces.
- [x] **63.3 Apply integration** (2026-08-10) — the `write()` merge
  hook (every full-write path respects bypasses by construction; the
  transition capture wraps it, so bypass changes tween wherever a
  spec configures them), the `refreshStateDef` punch-out (bypassed
  slots take the merged full write; the run optimization untouched),
  `paintInputs` demotion per bypassed prop (count-gated, reversible),
  and the one-load gate (`mergeBypass` is a method so a spec counts
  invocations: zero on a bypass-free instance, pinned).  **Four
  controls, and one strengthened two specs**: the epoch-rebuild
  control caught the re-add and compaction specs passing by accident
  (a recycled slot; permuted-but-unrewritten bytes) — they claim the
  freed slot with a squatter and restyle after compacting now, and
  the control fails all three lifecycle specs.
- [x] **63.4 The sugar** (2026-08-10) — `ele.style( name, value )`,
  the object form and `removeStyle( name? )`/`removeCss` (the 85th
  alias row), validating against the element's own group and
  re-applying through the single-slot funnel — a configured
  transition tweens a sugar bypass in both directions, pinned.  The
  29.3 throw and its pins flipped (`test/decided-drops.mjs`,
  `test/style-getters.mjs`), `style()` grew real overloads with one
  doc block each, and the round-45 gate caught the stale shipped
  declaration by name (regenerated: 45 type exports / 3 statics /
  1330 doc blocks).  23 specs in `test/style-bypass.mjs`.
- [x] **63.5 Benchmarks** (2026-08-10) — four rows in `style.mjs`:
  the set path **3.9× faster than v3 through tsx and 2.0× through
  the built bundles** (3.32 vs 6.59 µs/call — the maintainer's
  fast-requirement met on the headline row), the set+remove
  round-trip 4.4×, the 256-band default-sheet select at 34.5 µs
  with 0 bypassed vs 352 µs with 128 (O(bypassed) at the known
  full-write cost, the k=0 side the standing O(0) gate row), and a
  128-bypass sheet swap at 1.02–1.06× of bypass-free.  The
  count-gate's nullity measured through the bundle: the pre-round
  state-only select read 53.7 µs, the post-round 48.0 —
  no regression.  Both bypassed rows carry startup discrimination
  probes.
- [x] **63.6 Closing sweep** (2026-08-10) — `src/README.md`'s
  style-getters section carries the contract and the two live claims
  trued (the transition taxonomy, ledger idea 25's own sketch —
  which shipped in a different shape than it proposed);
  `MIGRATING.md` flips its bypass rows with the two porting
  differences named (export is better than v3; sheet swaps replace);
  `CHANGELOG.md` gains the feature; the summary rewritten; full
  verification below.

