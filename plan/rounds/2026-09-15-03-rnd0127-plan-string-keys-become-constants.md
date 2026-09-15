## String keys become constants

The maintainer's directive, 2026-09-15: **clean up hard-coded string
use.**  Style property keys and store column keys should be reused
constants instead of hard-coded and repeated strings, and probably the
same for the reserved data keys (`id`, `parent`, `source`, `target`).

### The census, before

Three vocabularies are spelled as string literals at every use site,
and each is typed well enough that a *typo* already fails to compile —
which is why nobody noticed the repetition.  What the literal form
still costs: a rename touches every site, a search for "who reads this
column" has to know the spelling, and the renderer's worker protocol,
the mirror and the tween paths each carry the same string with nothing
tying it to the contract but the union type.

| vocabulary | where it is declared | literal sites | files |
|---|---|--:|--:|
| column ids (`'node.position'`, …, 38 columns) | `ColumnId`, a string-literal union in `src/contract.mts` | ~700 | 25 |
| style property keys (173 names) | nowhere once — the `applyProp` switch, `NODE_READ`/`EDGE_READ`, `MAPPABLE`, the readers, the config sets each spell them again | ~800 in `src/style.mts`, ~15 elsewhere | 6 |
| reserved data keys (`id`, `parent`, `source`, `target`) | nowhere | 44 (about half in comments) | 7 |

Group names (`'nodes'`/`'edges'`, 744 sites) are the same shape and are
**not** in scope: they are a two-member typed discriminant that reads
best as the literal, and the maintainer's examples did not name them.
Logged as a call, not decided here.

### 127.1 — the column ids: `COL`

- `src/contract.mts` declares `COL`, one `as const` object holding
  every column id with the JSDoc that used to sit on the union member,
  and derives `ColumnId` from it — so the union cannot drift from the
  object, and `COLUMN_SPECS` is written against `COL` rather than
  spelling the ids a second time.
- Every `'node.*'` / `'edge.*'` literal under `src/` outside the
  contract becomes `COL.NODE_*` / `COL.EDGE_*`.  Scripted, then the
  diff read; the worker protocol and the mirror keep carrying the
  string *value*, which is the point of a constant.
- Specs under `test/` keep the literals: a test that spells
  `'node.position'` pins that `COL.NODE_POSITION` still resolves to it,
  and the wire format is what the tests are for.

### 127.2 — the reserved data keys: `DATA_*`

- `DATA_ID`, `DATA_PARENT`, `DATA_SOURCE`, `DATA_TARGET` beside
  `GroupName` in `src/contract.mts` (the columnar converter, the store
  and the style engine all already import the contract; `element-defs`
  would be a new edge for the store).  `EndKey` names the source/target
  pair.
- The comparisons in `collection.mts`, `columnar.mts`,
  `graph-store.mts` and `style.mts` read the constants.  Typed property
  access (`data.source`) is not a string and stays.

### 127.3 — the style property keys: `PROP`

- A new `src/style-props.mts` holds `PROP`, one `as const` object of
  every property v4 accepts — node, edge, core, compound and
  transition — with `StyleProp` derived from it.  The list is taken
  from the engine itself (the `applyProp` and `resolveCoreProps`
  switches, the read sets, `MAPPABLE`), so the table's first version
  is a census, not a guess.
- Every property-name literal in `src/style.mts`, `animation.mts`,
  `collection.mts` and `render/mapper-runtime.mts` becomes
  `PROP.<NAME>`: `case PROP.BACKGROUND_COLOR:`, `[PROP.LINE_COLOR]:`
  as an object key, `PROP.OPACITY` in a set.  Multi-word names are
  scripted; the eleven single-word names (`width`, `color`,
  `opacity`, …) collide with channel kinds and layout options and are
  replaced by hand, in the style engine only.
- Property *values* (`'round-rectangle'`, `'match-line'`,
  `'triangle-list'`) are out of scope: the shape and arrow vocabularies
  already map through `SHAPE_NAMES`-style tables to their ids, and the
  WebGPU descriptor strings are the API's.
- Error messages and comments keep the human spelling.

### 127.4 — the gate

- `test/modules/string-keys.mjs` scans `src/` with the comment- and
  string-aware walk `import-graph.mjs` uses and fails on a column-id
  literal outside the contract, a reserved-data-key literal in a
  comparison outside the contract, or a multi-word style property
  literal outside `style-props.mts`.  Each rule runs its control on a
  planted line, per `docs/agents/testing.md`.
- It also pins the tables to the engine: every `COLUMN_SPECS` id is a
  `COL` value and vice versa; `PROP` has no duplicate values; every
  `PROP` value normalises to itself.

### 127.1 — carried out (2026-09-15)

`COL` holds the 38 ids with the union's member docs moved onto the
members; `ColumnId` is `(typeof COL)[keyof typeof COL]`.  A scripted
pass replaced 622 literals in 25 files — the walker is comment-,
string- and regex-aware, and the first version was not regex-aware:
`src/style.mts` came back with zero replacements because a
`/^url\s*\(\s*['"]?…/` on line 1579 read as an unterminated string and
swallowed the remaining 8,300 lines.  The count of files touched is
the control on such a tool: 24 of 25 was the tell.  Thirteen sites
were type positions (`id: 'node.overlay' | 'node.underlay'`) and
became `typeof COL.…`; one `new Set([...])` that had inferred
`Set<string>` now inferred a narrower union and needed `Set<ColumnId>`.
The three tween pseudo-columns became `TWEEN_COL` in `animation.mts`.
`npm run -s verify`: green, 2,719 specs.

### Verification

`npm run -s verify` per commit; `npm run -s test:node:quiet` and
`npm run build` before the round closes.  A style-compile benchmark
row before and after, since `applyProp` gains a property load per
`case` — the sheet compiles once per group, not per element, so the
expectation is noise, and the number is recorded either way.
