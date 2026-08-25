## Selector removal and stylesheet reshape

Decided in design discussion (2026-07-24) and implemented in one pass;
`src/README.md` ("Design decisions") is the maintained record.  The
decisions, explicitly:

- **v4 has no classes.**  The class system (`addClass`/class selectors)
  is not coming to v4; user-defined state lives in the columnar `data()`
  sidecar, with mappers and predicates supplying the styling/filtering
  behaviour classes provided in v3.
- **v4 has no selector strings at all.**  Rather than porting a dialect
  of the v3 selector language, the language is gone: `selector.mts` was
  deleted and replaced by `matcher.mts` — a **matcher IR** of structured
  queries (`{ group, selected }` today) compiled to the round-3 columnar
  flag scans.  Query objects answer whole-graph queries
  (`cy.nodes({ selected: true })`, throwing on unknown keys), predicate
  functions cover everything richer (lodash-style), including event
  delegation (`cy.on('tap', ele => ele.isNode(), cb)`, identity-compared
  in `off()`), and ids go through `$id`/`getElementById`.  `cy.$()` and
  string arguments to set ops/`edgesWith`/`components`/`remove`/`fit`
  were removed.

  Future richer matching (data predicates, structural
  terms) extends the IR; any frontend (chained builder, serialized
  query) compiles to it.
- **Style is `{ nodes, edges }`** (keys renamed from `{ node, edge }`
  2026-07-24 to match the group names) — each key a props object
  (constants, camelCase or kebab-case, and mapper objects).  Selector
  blocks and `#id` blocks are gone; **state is a `case` condition**
  (round 57.1: `{ when: { selected: true } }` and the rest of v3's state
  selectors), and v3's own `:selected` / `:parent:selected` / `:active`
  blocks are entries in v4's default stylesheet that a user block
  replaces.  The `(ele) => props` **function form was
  removed in round 8** (below): all per-element styling is declarative
  (`case` conditionals, `data(key)` scales), so every value is
  analyzable, serializable, and GPU-evaluable.  Refresh: a data write
  re-derives the affected mapped channels, key-gated.
- ~~**Mapper DSL direction**~~ — landed in round 7 (below), as a plain
  object spec rather than strings/builder; round 8 added conditionals
  and removed the fn form.

Verification: typecheck, lint, `test:js` (1221 passing, incl. the new
`test/query.mjs` matcher suite and rewritten style/events/flag-scan
suites), and all 17 Playwright renderer specs on a real adapter.
Benchmarks compare idiomatic forms per side now (`cmp(name, v3Op,
gpuOp)` where they differ); `pointer.mts` tap-clear uses
`elements({ selected: true })`.
