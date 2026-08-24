## Round 64 — the collection guard and the query aliases (ninth sitting; planned and landed 2026-08-10)

Three maintainer calls taken in one sitting and landed the same day —
small, decided, and all on the query/building surface:

- [x] **64.1 `cy.collection()` throws on any argument** (closing
  ledger item 28).  Both boundaries — the core's accumulator and the
  collection delegate that shared the silent-ignore shape — guard on
  `arguments.length`, with a message naming the replacements (build
  with `union()`, query with `cy.$( query )` / `cy.filter( query )`),
  and the guard spec executes the advice it gives (the 31.1 rule: an
  error's recommendation must actually run).  The zero-arg accumulator
  is unchanged.
- [x] **64.2 `cy.$` returns as a plain alias of `filter()`** — over
  the v4 query API, in line with `cy.$id()`: `cy.$( { selected:
  true } )`, `cy.$( ele => … )`.  A selector string still throws,
  through filter's own rejection, and the decided-drops pin flipped
  from absence to alias-plus-strings-throw.  **`cy.byId`** lands
  beside `$id` as the brevity id lookup.  Both ride the standard
  declare + wiring + alias-table row mechanics (85 → 87 rows, the
  table's cross-checks passing in both directions).
- [x] **64.3 Verification + sweep** (2026-08-10).  Three controls,
  each failing exactly its pin: the guards neutered fail the guard
  spec; `$` wired to `elements` instead of `filter` fails the alias
  table and the decided-drops identity; `byId` unwired fails the
  table's two directions.  `MIGRATING.md` carries the porting rows
  (`cy.$` works over the new forms; `collection( eles )` is not
  ported and now throws), `CHANGELOG.md` the entries,
  `src/README.md`'s selector-removal design bullet the amendment, and
  `dist/cytoscape.d.ts` regenerated.  Full tier: typecheck, test:js,
  test:modules, soak, the throw gate (the two new guards pinned),
  lint, format.

Note what the round deliberately does **not** reopen: the selector
*language*.  `cy.$` accepts exactly what `filter()` accepts — the
alias restores a spelling, not a dialect.
