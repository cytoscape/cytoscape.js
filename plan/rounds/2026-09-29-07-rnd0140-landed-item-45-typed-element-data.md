## Ledger item 45: typed element data

Ledger item 45 (typed element data), taken as a round.  There was no
plan file: the spec is the item's text in `PLAN.md`, its line in the
eleventh sitting's note
(`2026-09-28-01-rnd0000-note-the-eleventh-design-sitting-the-open-calls-one-by-one.md`),
and the feature-direction gate line — "define application-data typing"
(`docs/feature-direction.md`, under *Public API, types and data
contracts*).

The item (raised 2026-08-19): the shipped `d.ts` typed `data()` as
`unknown`; the ask is generics — `cytoscape<NodeData, EdgeData>( … )` —
flowing through `data()`, the mapper DSL's field references and event
payloads.  Two risks made it measure-first: whether the `build:types`
pipeline (rolldown-plugin-dts) keeps generic parameters end to end, and
whether the sheet's string-keyed field references can be typed without
wrecking inference in the untyped default case, which must degrade to
today's types.  **First measurement**: a two-member prototype through
`npm run build:types` — if generics survive to the shipped declaration
with hover docs intact the round is real; if not, it is first a
build-pipeline round.

**Call taken (2026-09-28, the eleventh sitting): prototype, then build,
before alpha.**  The brief widened the build to the collections and
element handles, the `add`/`patch`/`load`/`clone` payloads, and all three
shipped declarations (round 131's), under a hard rule: with no generic
given, every type degrades to exactly today's, proved by the existing
type tests passing unchanged.

### The round, as carried out (2026-09-29)

| # | Commit | What landed |
| --- | --- | --- |
| 140.0 | `fb39c94b` | the types-surface audit names round 138.3's `GpuErrorInfo`/`GpuMemoryStats` (it was red on a clean tree) |
| 140.1 | `e3243310` | the prototype: the generic factory and `data()`, measured through all three declarations |
| 140.2 | `46203699` | the doc audits read wrapped overloads and nested type parameters |
| 140.3 | `23dac2a7` | the build: data, collections, events, payloads, queries, the sheet; the type tests; the hover gate |
| 140.4 | this commit | the close: this record, item 45's status, the summary |

#### 1. The prototype — the pipeline keeps generics

Two members: the factory, `cytoscape<NodeData, EdgeData>( … )` returning
`Core<NodeData, EdgeData>` (in all three entries), and `Collection.data()`
as documented overloads typed from the collection's shape.  Through
`npm run build:types` (TypeScript 7.0.2, rolldown 1.1.5,
rolldown-plugin-dts 0.27.9):

- all three shipped declarations (`dist/cytoscape.d.ts`,
  `dist/cytoscape-headless.d.ts`, `dist/cytoscape-headless-gpu.d.ts`)
  carry the generic classes, the generic factory and the helper types
  (inlined as local declarations);
- a language-service probe over each: on `cytoscape<N, E>()`,
  `data( 'weight' )` infers `number | undefined`, its hover shows that
  overload's own doc block, and the factory's hover keeps its doc;
  untyped, the read stays `unknown`.

**So the pipeline needed no fix; the round was a build round.**  The
measurement is kept as a gate: `test/types-surface.mjs` section 7 runs the
same probe through the language service against each shipped declaration
(control: a `Collection` flattened in the headless declaration fails it).

Two tools had to learn generic headers on the way: the JSDoc audit read a
wrapped type-parameter list's `NodeData = Untyped,` lines as undocumented
members, and `test/docs-generate.mjs` matched `declare class X {` and
`declare function cytoscape(` literally (140.1); then, once the build's
parameter types grew generic arguments and the formatter wrapped
overloads, the audits' line-at-a-time overload pattern read a wrapped
overload as the implementation signature and **skipped** it, and their
type-parameter pattern refused nesting and defaults (140.2).  `cy.on`
dropped from two documented formats to one before the fix — the standing
lesson that an audit's scope is part of its claim.

#### 2. The build

`src/data-typing.mts` holds the helpers; the classes and option types
take the parameters.  What the shapes reach (the full list is
`src/README.md`, "Typed element data"):

- **`data()`** — whole object, a first-class field (`'id'`, `'source'`,
  `'target'`, `'parent'`, read-only), one key, key + value, patch.  A
  typed read is the field's type *or `undefined`*, since a read can miss,
  as `id()` already says.
- **Collections and handles** — `Collection<NodeData, EdgeData, Data>`
  knows its group from the method that made it; set operations,
  iteration and callbacks keep the shape; mixed results read the union.
  The clustering results are node collections.
- **Core** — the element accessors, `add`, `remove`, `nodeAt`, `ready`,
  `options()`, `clone()`.
- **Events** — `Event<NodeData, EdgeData>` (`target`, `cy`, `diff`),
  handlers, predicates, `promiseOn`.
- **Payloads** — element definitions (shape plus the first-class
  fields, so a misspelt field is an excess-property error), the
  constructor's `elements`, `add`, `patch` and its `PatchDiff`, `load`'s
  chunks, `clone`'s options.
- **Field references** — mapper and `case` condition fields per group
  (`nodes`/`parents` from `NodeData`, `edges` from `EdgeData`) and query
  keys.

`typescript/tests/typed-data.test-d.ts` is new: the untyped rule asserted
as type *equality* (not assignability), typed positives, and 19
`@ts-expect-error` negatives.  `api.test-d.ts` and `headless.test-d.ts`
pass **unchanged**.  Controls, each run against the built declaration:
turning the untyped branch to `any` (2 errors), dropping `NoInfer` (the
untyped half red), keying `DataKey` on `string` (every negative unused) —
all red.

#### 3. The calls taken in-round, by measurement

1. **`NoInfer` on the factory's options.**  Without it, a plain
   `cytoscape({ elements: [{ data: { id: 'a', weight: 1 } }] })` inferred
   its shapes from the first node and stopped being untyped — measured
   by the control above.  So the generics are only ever explicit.
2. **The untyped test reads the instance, not the collection.**  The
   first build tested the collection's own `Data` for `any`
   (`IsUntyped<Data>`), and `const m: Collection<N, E> = cy.nodes()`
   failed.  Bisected on the built declaration: every `data()` overload
   blocked it, even the pure-return whole-object read — a type parameter
   in a conditional type's check position measures invariant, and
   TypeScript decides a class instantiation's assignability by the
   measured variance.  The fix tests `NodeData | EdgeData`, which a
   narrow and a wide collection of one instance share
   (`IfTyped<NodeData, EdgeData, …>`), and uses `Data` only as
   `keyof Data`, `Data[K]` and `Partial<Data>`, which measure covariant.
   Two consequences, both taken: a **mixed collection reads only the
   fields both shapes share** (TypeScript's own union semantics; narrow
   with `nodes()`/`edges()`), and a collection's own subset criteria
   (`filter`, `is`, `allAre`, the traversal criteria) key their queries
   on both shapes, since `Query<Data>` is invariant in `Data` too — the
   core's `nodes( query )`/`edges( query )` stay per group.
3. **`EdgeData` defaults to `Record<string, unknown>` once `NodeData` is
   given** (`DefaultEdgeData<NodeData>`), because with the untyped test on
   both shapes, `cytoscape<MyNode>()` would otherwise be untyped
   throughout.

#### 4. The cost

i9-9900K, TypeScript 7.0.2, non-incremental, three runs each:

| | before | after |
| --- | --: | --: |
| `tsc --noEmit` over `src/` | 0.49 s / ~197 MB | 0.50 s / ~209 MB |
| the type tests | 0.46 s / ~108 MB | 0.48 s / ~119 MB (with the new file) |

The one visible untyped difference is hover text: `cy.nodes()` shows
`Collection<any, any, any>`, the same type as `Collection`.

#### 5. Where it stops, and why

- **The columnar and wire payloads** stay untyped — an `ArrayBuffer`
  carries no type and columnar `data` columns are keyed at run time.
  `toColumnarElements()` takes typed definitions.
- **The `'data(name)'` label string** — a style value is any string, so
  its field cannot be checked; the `{ data }` mapper is the typed form.
- **Condition values** (`eq`, `gt`, `in`) are not correlated with their
  field's type: a distributive union over the shape's keys per
  condition, for little.
- **The algorithms and layouts** — callbacks (`weight`, `attributes`,
  `sort`) and results (`pathTo()`, search results) take and return plain
  collections; typing them threads the generics through some thirty
  option and result types.  **Deferred, not declined.**
- **`json()`/`jsons()`** stay records (an export format), and **`isNode()`
  is not a type guard** (it answers for the first element, so it would
  lie about a mixed collection).

**Also found**: `test/types-surface.mjs` was red on a clean tree — round
138.3 exported two types without listing them — because `test:node`
does not run it (140.0).

**Checks.**  Round 79's `schemas/` gate (`test/modules/schemas.mjs`,
202 tests) green unchanged; `test:types:run`, `test:types:surface:run`,
`test:throws:quiet`, the doc gates (`plan-record`, `agent-docs`,
`feature-inventory`, `status-features`, `migration-guide`) green; `npm run
-s test:node:quiet` green (zero output).
