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

## Parity with the old hand-written `index.d.ts` — remaining gap

The generated d.ts (~2,100 lines) covers the **full method surface** of
`Core`, `Collection`, and `Element` — more method coverage than the
hand-written file, since every mixin method is typed. The public entry
point now also re-exports the old broad node/edge alias family
(`Singular`, `NodeSingular`, `EdgeSingular`, `NodeCollection`,
`EdgeCollection`), and the documented search/traversal helpers return
those aliases where appropriate. The old `index.d.ts` (6,644 lines) is
kept in the repo as a reference and parity target. A docmaker-based audit
(`npm run test:types:docs`) now checks that the generated `build/dts`
surface matches the documented `cy.*` / `eles.*` / `ele.*` API and
guards the remaining known exceptions. Three areas of the
hand-written file are **not yet reproduced** from source and are the
remaining work to reach full parity:

1. **Node/edge public projections** — `NodeCollection` and
  `EdgeCollection` are re-exported again, but they still structurally
  inherit some cross-kind methods from the wide internal `Collection`
  type in the generated declarations. Fully matching the docs requires a
  dedicated public node/edge projection layer that omits edge-only
  methods from node types and node-only methods from edge types.
2. **`Css.*` style-property types** — the per-property value types
   (`background-color`, `width`, mappers, etc.). Derive these from the
   `src/style/properties.mts` property table.
3. **`EventObject` hierarchy** — surface the `EventObject` /
   `EventObjectNode` / `EventObjectEdge` types (the runtime `Event` class
   is already typed) on the public event-binding signatures.

Until then, downstream TypeScript users still see some node/edge
cross-kind methods on the generated `NodeCollection` / `EdgeCollection`
aliases, `Css.*` remains looser (`unknown`-ish), and event handler
signatures do not yet expose the old `EventObject*` hierarchy.
Reverting `package.json` `types` to `./index.d.ts` restores the richer
hand-written types if that trade-off is preferred while the above source
enrichment is completed.
