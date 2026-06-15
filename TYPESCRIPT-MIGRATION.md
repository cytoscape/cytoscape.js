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
guards the remaining known exceptions.

**`Css.*` style-property types — done.** `src/style/css-types.mts` is now
generated from the runtime style inventory (`src/style/properties.mts`) by
`scripts/gen-css-types.mjs` (`npm run gen:css-types`); every property — node,
edge, common, core, plus the generated `pie-N`/`stripe-N`/arrow families and
property aliases — is typed with value families (`NodeShape`, `ArrowShape`,
easing, …) emitted directly from the runtime `types` enums. Parity is enforced
by `npm run test:types:css` (`test/types-css-surface.mjs`), which cross-checks
the generated `Css.*` surface against the live runtime inventory. See
`CSS-PLAN.md` for details.

Two areas of the hand-written file are **not yet reproduced** from source and
are the remaining work to reach full parity:

1. **Node/edge public projections** — `NodeCollection` and
  `EdgeCollection` are re-exported again, but they still structurally
  inherit some cross-kind methods from the wide internal `Collection`
  type in the generated declarations. Fully matching the docs requires a
  dedicated public node/edge projection layer that omits edge-only
  methods from node types and node-only methods from edge types. The exact
  cross-kind method lists currently tolerated live in the
  `allowedResidualExtras` allowlist in `test/types-docmaker-surface.mjs`
  (18 edge-only methods leaking onto `NodeCollection`, 58 node-only onto
  `EdgeCollection`).
2. **`EventObject` hierarchy** — surface the `EventObject` /
   `EventObjectNode` / `EventObjectEdge` types (the runtime `Event` class
   in `src/event.mts` is already typed) on the public event-binding
   signatures. Handlers currently receive the internal `Event` type; the
   public `on`/`one`/`bind`/`pon` signatures in `src/collection/events.mts`
   and `src/core/events.mts` would thread the `EventObject*` variants.

Until then, downstream TypeScript users still see some node/edge
cross-kind methods on the generated `NodeCollection` / `EdgeCollection`
aliases, and event handler signatures do not yet expose the old
`EventObject*` hierarchy.
Reverting `package.json` `types` to `./index.d.ts` restores the richer
hand-written types if that trade-off is preferred while the above source
enrichment is completed.

## Current validation coverage and limits

The current automated checks are useful, but they do **not** prove full
parity with the old hand-written `index.d.ts`:

- `npm run typecheck` validates the TypeScript source graph only. It does
  not assert that the emitted public `.d.ts` exactly matches either the
  docs or the old manual definitions.
- `npm run test:types` proves that the generated declarations build and
  are consumable by a representative TypeScript client in
  `typescript/tests/api.test-d.ts`. It checks important exported names
  and representative usage, but it is not an exhaustive public API
  parity test.
- `npm run test:types:docs` audits the freshly generated
  `build/dts/index.d.ts` against `documentation/docmaker.json`, but only
  for the broad documented surfaces represented as `cy.*`, `eles.*`, and
  `ele.*` plus the narrowed `NodeCollection` / `EdgeCollection` aliases.
  It is a doc-surface audit, not a symbol-for-symbol comparison against
  the old `index.d.ts`.
- `npm run test:types:css` audits the generated `Css.*` style surface
  against the live runtime property inventory in `src/style/properties.mts`,
  failing on any documented-but-untyped or typed-but-unknown property. It
  guards property-name coverage, not exact value-family precision.
- `npm run test:types:all` builds the declarations once and runs the tsc
  consumer test plus both surface audits.

Known limitations of the current docmaker audit:

- It currently passes with an explicit allowlist of known residual
  exceptions for `NodeCollection` and `EdgeCollection` in
  `test/types-docmaker-surface.mjs`. Those exceptions are the remaining
  cross-kind methods inherited from the wide internal `Collection` type.
- It enforces that undocumented `cy.*`, `eles.*`, and `ele.*` methods are
  not exposed on the generated declarations, but it does **not** yet give
  that same unconditional guarantee for narrowed node/edge projections.
- It does not validate the exact overload shapes, generic constraints,
  or argument/return precision of every documented API entry; it checks
  presence/absence of the documented member names on the audited public
  interfaces.
- It does not assert full top-level export parity with the old manual
  declarations beyond the names used in the representative consumer test
  (e.g. broad alias-family presence like `NodeSingular` / `EdgeSingular`
  is exercised indirectly, not exhaustively diffed).
- It does not validate undocumented helper types unless they leak into the
  audited public interfaces.

Practical interpretation for now:

- The generated `.d.ts` is automatically checked to avoid undocumented
  `cy.*`, `eles.*`, and `ele.*` member leaks.
- The generated `.d.ts` is automatically checked to remain usable by a
  representative external TypeScript consumer.
- The generated `.d.ts` is **not yet** automatically checked for complete
  parity with the old hand-written `index.d.ts`, especially for strict
  node/edge narrowing, `Css.*`, and `EventObject*` semantics.
