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

### 127.2 — carried out (2026-09-15)

`DATA_ID`, `DATA_PARENT`, `DATA_SOURCE`, `DATA_TARGET` and the `EndKey`
type sit beside `GroupName` in the contract.  34 comparison sites in
five files read them — the sidecar's reserved-key skips in the
converter and the store, the collection's `data()` getter and setter
guards, the style engine's four `key === 'id'` first-class-id reads,
and the end-label and arrow-fold loops that iterate `[source, target]`.
What stayed literal, on purpose: `prop.startsWith('source')` is a
property-name prefix test, and `TAXI_TRACK_NAMES` holds the values of
`taxi-track`, which happen to share the spelling.

### 127.3 — carried out (2026-09-15)

`src/style-props.mts` holds `PROP`, 173 names generated from the
engine's own tables (the `applyProp` and `resolveCoreProps` switches,
the twelve read/config sets, `MAPPABLE`), alphabetical within family.
The 162 multi-word names went through the scripted walker (802 sites
in four files), which learned one more rule on the way: a literal in
object-key position — followed by `:` and preceded by `{`, `,` or
indentation — becomes a computed key `[PROP.X]:`, while `case 'x':`
keeps the bare member.  The eleven single-word names (`width`,
`opacity`, `color`, …) collide with `ChannelKind`, `WriteKind` and the
layer-field switch, so they were replaced by syntactic rule in the
style engine only — list members, `case` labels, `defineReader`
arrays, `.has()`/`.add()`/`.includes()` calls, the `norm ===` and
`m.prop ===` tests — and by hand in the other three files (69 sites).
What stayed literal, on purpose: the overlay/underlay reader's
`switch (field)` compares a *stripped* suffix, `kind: 'color'` is a
channel kind, and `dep(key, 'label')` is a dependency class.
`npm run -s verify`: green, 2,719 specs.

### 127.4 — carried out (2026-09-15)

`test/modules/string-keys.mjs`: three tree rules (a column id outside
a `COL`/`TWEEN_COL` member line; a reserved data key in an `===`/`!==`
comparison or a `['source', 'target']` pair; a hyphenated property
name outside `style-props.mts`), five table rules (`COL` ≡
`COLUMN_SPECS`; every key spelled from its value; the pseudo-columns
disjoint from the real ones; `PROP` duplicate-free and already in
`normalizeProp`'s spelling), and the scanner's own controls — a
planted literal in code, one in a comment / template / double-quoted
string, one *after* a regex holding a quote (127.1's tool bug, kept as
a spec), a division that must still read as code.  The tree rules'
control was run by hand: one literal planted per rule, three red rows
naming `src/layout/dims.mts:76`, `src/columnar.mts` and
`src/collection.mts`, then restored.

### 127.5 — what the tree's other scanners said (2026-09-15)

`npm run -s test:node` went red in 17 module specs on the first full
run, all from two tools that read `src/` as text and had assumed the
literal form:

- **`scripts/status/feature-inventory.mjs`** derives v4's style surface
  by regex over `NODE_READ`/`EDGE_READ` and the core switch — and
  found nothing once every member read `PROP.X`, so every feature row
  disagreed with an empty surface and the status-site plan failed
  behind it (15 of the 17).  It now resolves `PROP.X` against the
  table's own text, still without importing the library; the literal
  form is still accepted.  171 names, as before (the two
  `-relative-to` names are throw-only and were never in a read set).
- **`scripts/throw-coverage.mjs`** keys its allowlists by `file:line`,
  by design (round 37.1: an insertion above a site re-points the entry,
  and the gate is what notices).  Two entries had moved — the
  `SHAPE_MASK` invariant in `graph-store.mts` by twelve lines, the
  export-scale guard in `renderer.mts` by two — and were re-pointed.

Neither is a defect the round introduced; both are the tools doing
what their headers say they do.  Recorded because the second full run
is the one that counts, and because round 57.2's lesson holds again:
a purely mechanical change to the sources is a free control on every
source-scanning tool, and this one found the inventory reader's
unstated assumption.

### Verification (carried out)

- `npm run -s verify` after each sub-round: green, 2,719 specs; the
  gate adds 16.  `npm run -s test:node`, second run: green — 2,719
  unit, 745 module, 24 soak, the throws gate and lint.
- The style micro-measure the plan asked for (headless, 2,000 nodes /
  1,999 edges, a 22-prop sheet; medians of 7, three runs per tree,
  pre-127.3 in a worktree beside the tree):

  | | sheet compile + apply | `numericStyle()` × 6k | `style()` × 5k |
  |---|--:|--:|--:|
  | before | 6.94 / 7.02 / 6.86 ms | 0.57 / 0.62 / 0.59 ms | 0.60 / 0.61 / 0.61 ms |
  | after | 9.50 / 7.23 / 6.98 ms | 0.94 / 0.61 / 0.58 ms | 0.79 / 0.62 / 0.58 ms |

  The first "after" run is the cold `tsx` import (it was the first
  process to compile the tree); runs two and three sit inside the
  before band.  As expected: the sheet compiles once per group, and
  the read path plans per raw name and never touches the switch.
- **The bundle grew by 1%**, measured against the pre-round commit
  built in a throwaway worktree with the same rolldown config:

  | `build/cytoscape.min.js` | minified | gzipped |
  |---|--:|--:|
  | before (`988cca81`) | 852,759 B | 233,456 B |
  | after | 861,544 B | 236,179 B |
  | delta | +8,785 B (+1.0%) | +2,723 B (+1.2%) |

  The cost is the table itself (173 property strings the sources
  used to carry inline, now carried once *and* referenced) plus
  `COL.X` / `PROP.X` member accesses, which the minifier mangles the
  object name of but not the property name — `PROP.BACKGROUND_COLOR`
  ships longer than `'background-color'`.  Recorded as the round's
  price; whether to spend 2.7 KB gzipped on a spelled-once
  vocabulary is the maintainer's call, and the alternative (a build
  step that inlines `as const` members) is a build-tool change this
  round does not make.  The summary's bundle row had been stale since
  well before this round (it read 691 / 185 KiB); it is re-measured
  now.
- Style parity, re-measured by the inventory reader's own method
  (v4 read registries ∩ v3's declared names): 159 of 291.  The
  summary carried 161 from round 85.4 with no method on the record;
  the reader's number is the one the status site publishes.
- The worktrees were removed (`git worktree list` shows one tree).


`npm run -s verify` per commit; `npm run -s test:node:quiet` and
`npm run build` before the round closes.  A style-compile benchmark
row before and after, since `applyProp` gains a property load per
`case` — the sheet compiles once per group, not per element, so the
expectation is noise, and the number is recorded either way.
