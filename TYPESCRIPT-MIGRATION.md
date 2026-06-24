# TypeScript migration — status

The `src/` tree has been converted from JavaScript (`.mjs`) to TypeScript
(`.mts`), and the package's type definitions are now **generated from the
source** instead of being hand-maintained in `index.d.ts`.

## What changed

- All ~290 source files are now `.mts` (only `src/test.mjs` and
  `src/cjs.mjs`, which are not part of the typed library graph, remain
  `.mjs`).
- Types live with the code. `tsc --noEmit` (`npm run typecheck`) and
  `eslint` are clean repo-wide.
- The bundler (rolldown) transpiles the `.mts` sources natively via oxc.
  **Babel was removed** (`.babelrc`, `@babel/*`, `@rollup/plugin-babel`);
  the oxc transform target is `es2018` (`rolldown.config.mjs`).
- Tests run against the TS source through `tsx` (`.mocharc.cjs`). All
  suites pass: 732 unit + 37 module + 695 built-bundle + 18 Playwright
  canvas-renderer tests (Chromium).

## How the d.ts is generated

```
npm run build:types
```

1. `rolldown -c rolldown.dts.config.mjs` — `rolldown-plugin-dts` emits and
   bundles the declarations from `src/index.mts` into
   `build/dts/index.d.ts` (using `tsconfig.dts.json`, `stripInternal`
   hides `_private`).
2. `node build-dts.mjs` — appends the UMD `export as namespace cytoscape`
   global and writes `dist/cytoscape.d.ts`.

`npm run test:types` builds the types and type-checks
`typescript/tests/api.test-d.ts`, a compile-only consumer that exercises
the public API (factory, core methods, events, traversal, data,
algorithms, layouts, `cytoscape.use`) against the generated `.d.ts` — the
proof that the generated definitions are consumable.

`package.json` `types`/`exports` now point at `dist/cytoscape.d.ts`.

## Architecture of the source types

The runtime keeps its prototype-mixin structure; the types mirror it:

- `src/collection/eles-types.mts` assembles the `Collection` interface from
  16 per-mixin contribution interfaces (`CollectionData`,
  `CollectionTraversing`, `CollectionAlgorithms`, …). `Element extends
  Collection`.
- `src/core/core-types.mts` assembles `Core` from 11 mixin interfaces plus
  `CoreBaseFns`.
- Each mixin file exports its impl object **and** its contribution
  interface; methods are typed with `this: Collection` / `this: Core`.
- `Collection`/`Element`/`Core` and the built-in layouts/renderers stay
  constructor functions (the shared prototype is reassigned and the
  extension registry `.call()`/`.apply()`s them — ES classes can't do
  that). Only state that needed it became a class (`Emitter`, `Animation`,
  `Event`, `Selector`).
- The internal renderer (~15k lines, never in the public d.ts) is typed
  via a shared permissive `Renderer` interface; params/locals/data are
  typed honestly.

## Parity with the old hand-written `index.d.ts`

The generated d.ts covers the **full method surface** of `Core`,
`Collection`, and `Element` — more method coverage than the hand-written
file, since every mixin method is typed. The public entry point also
re-exports the old broad node/edge alias family (`Singular`,
`NodeSingular`, `EdgeSingular`, `NodeCollection`, `EdgeCollection`), and the
documented search/traversal helpers return those aliases where appropriate.
The old `index.d.ts` (6,644 lines) is kept in the repo as a reference. A
docmaker-based audit (`npm run test:types:docs`) checks that the generated
`build/dts` surface matches every documented member namespace — `cy.*`,
`eles.*` / `ele.*` / `node.*` / `nodes.*` / `edge.*` / `edges.*`, `ani.*`
(the `Animation` class) and `layout.*` (`LayoutInstance`) — **including
documented aliases** (e.g. `layout.bind`/`ani.run`), with **no allowlisted
exceptions**.

All three areas that previously diverged from the hand-written file are now
reproduced from source:

**`Css.*` style-property types — done.** `src/style/css-types.mts` is now
generated from the runtime style inventory (`src/style/properties.mts`) by
`scripts/gen-css-types.mjs` (`npm run gen:css-types`); every property — node,
edge, common, core, plus the generated `pie-N`/`stripe-N`/arrow families and
property aliases — is typed with value families (`NodeShape`, `ArrowShape`,
easing, …) emitted directly from the runtime `types` enums. Parity is enforced
by `npm run test:types:css` (`test/types-css-surface.mjs`), which cross-checks
the generated `Css.*` surface against the live runtime inventory. See
`CSS-PLAN.md` for details.

**`EventObject` hierarchy — done.** `src/event-types.mts` defines the public
`AbstractEventObject` → `InputEventObject`/`LayoutEventObject` → `EventObject`
hierarchy plus the narrowed `EventObjectNode`/`EventObjectEdge`/`EventObjectCore`
variants and the public `EventHandler` type, all exported from the entry point.
The event-binding signatures (`on`/`one`/`bind`/`off`/`pon`/… in
`src/collection/events.mts` and `src/core/events.mts`) and the `.data(handler)`
overload now hand callbacks an `EventObject` instead of the internal `Event`
class, and `pon`/`promiseOn` resolve to `Promise<EventObject>`. `target` is
typed `any` on the base so the narrowed variants stay usable as handler
parameters (function-parameter contravariance), matching the old declarations.
`typescript/tests/api.test-d.ts` exercises all three target kinds.

**Node/edge public projections — done.** `src/collection/eles-types.mts`
keeps a wide internal `Collection`/`Element` (the shared prototype carries
every element method at runtime, and internal code relies on that), and
derives the public types by omitting the other kind's members:
`NodeCollection`/`NodeSingular` drop the edge-only members (`source`,
`target`, endpoints, edge geometry, …) and `EdgeCollection`/`EdgeSingular`
drop the node-only members (compounds, degree, position, grab/lock,
clustering, …). The omitted name lists (`EdgeOnlyKeys`/`NodeOnlyKeys`) are
the documented cross-kind split, and a new kind-agnostic base
`SharedCollection` lets internal helpers accept any collection without
casts. The docmaker audit now resolves the effective member set through the
TypeScript type checker (so it understands the `Omit<>`-based projections)
and passes with no residual allowlist; `typescript/tests/api.test-d.ts`
asserts (via `@ts-expect-error`) that node types reject edge-only methods
and vice versa.

The generated `.d.ts` is now the source-of-truth type surface; the
hand-written `index.d.ts` remains only as a historical reference.

## Current validation coverage and limits

The current automated checks are useful, but they do **not** prove full
parity with the old hand-written `index.d.ts`:

- `npm run typecheck` validates the TypeScript source graph only. It does
  not assert that the emitted public `.d.ts` exactly matches either the
  docs or the old manual definitions.
- `npm run test:types` proves that the generated declarations build and
  are consumable by representative TypeScript clients in
  `typescript/tests/*.test-d.ts`. `api.test-d.ts` checks exported names and
  representative usage; `algorithms`/`layout`/`extension.test-d.ts` cover
  those surfaces; and `parity.test-d.ts` adds **invariant exact-type
  assertions** (an `Expect<Equal<…>>` harness) that pin the precise return
  type / overload shape of high-value entry points — catching *widening* as
  well as narrowing, which plain assignability checks miss. It is a curated
  set (easily broadened) rather than an exhaustive public API parity test.
- `npm run test:types:docs` audits the freshly generated
  `build/dts/index.d.ts` against `documentation/docmaker.json` for every
  documented member namespace — `cy.*`, `eles.*`/`ele.*`/`node.*`/`nodes.*`/
  `edge.*`/`edges.*`, `ani.*` (`Animation`) and `layout.*` (`LayoutInstance`),
  including documented aliases. It resolves effective members through the
  TypeScript type checker (so it understands the `Omit<>`-based node/edge
  projections and class instance types) and runs with **no
  residual allowlist** — it both rejects undocumented members and requires
  documented ones on each kind. It is a doc-surface audit, not a
  symbol-for-symbol comparison against the old `index.d.ts`.
- `npm run test:types:css` audits the generated `Css.*` style surface
  against the live runtime property inventory in `src/style/properties.mts`,
  failing on any documented-but-untyped or typed-but-unknown property. It
  guards property-name coverage. Enum value-family precision (e.g. that
  `shape` rejects non-`NodeShape` literals) is verified by the
  `@ts-expect-error` assertions in `typescript/tests/api.test-d.ts`.
- `npm run test:types:exports` audits the named exports of the generated
  `build/dts/index.d.ts` against a snapshot list in
  `test/types-exports.mjs`. It catches both missing exports (a public type
  was dropped) and unexpected extras (an internal type leaked out).
- `npm run test:types:all` builds the declarations once and runs all four
  checks above.

Known remaining limitations:

- It enforces presence/absence of documented member *names* (including
  aliases) on every audited public surface (`cy.*`, the collection/element and
  node/edge kinds, `ani.*`, and `layout.*`), but it does not validate the exact
  overload shapes, generic constraints, or argument/return precision of every
  documented API entry.
- Top-level named export completeness is enforced by `test:types:exports`;
  structural usability of every exported type is enforced by the tsc
  consumer test (which imports and uses each one).
- It does not validate undocumented helper types unless they leak into the
  audited public interfaces.
- **Known type gap (surfaced by `parity.test-d.ts`):** the `data(field,
  value)` / `position(partial)` *setters* return the kind-agnostic base
  collection (`SharedCollection`), which omits the clustering/algorithm
  methods carried by `Collection`. Common chaining (`.addClass()`,
  `.style()`, traversal) still compiles, but algorithm chaining off a setter
  (e.g. `eles.data('w', 1).kMeans(...)`) — which compiled against the
  hand-written `index.d.ts` — does not. The boundary is locked with a
  `@ts-expect-error` in `parity.test-d.ts` so closing the gap is a
  deliberate, test-updating change.

Practical interpretation for now:

- The generated `.d.ts` is automatically checked, across every documented
  member namespace (core, collection/element, node/edge, animation, layout),
  to expose all documented members (and aliases) and to avoid undocumented
  member leaks.
- The generated `.d.ts` is automatically checked to remain usable by a
  representative external TypeScript consumer.
- Strict node/edge narrowing, `Css.*` surface, and `EventObject*` semantics
  are all enforced by the automated checks above (`test:types:docs`,
  `test:types:css`, and the `@ts-expect-error` assertions in
  `typescript/tests/api.test-d.ts`). The generated `.d.ts` is no longer
  missing automated coverage in those three areas.
