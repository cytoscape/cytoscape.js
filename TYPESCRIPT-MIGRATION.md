# TypeScript migration — status

The library source in `src/` has been migrated from JavaScript (`.mjs`) to
TypeScript (`.mts`). Types now live with the implementation, and the package
declaration is generated from `src/index.mts` rather than maintained separately
in the historical hand-written `index.d.ts`.

## Cytoscape.js v4 baseline

This migration is a v4 change and intentionally raises the supported runtime
baseline:

- Rolldown transpiles the `.mts` source with an ES2018 output target.
- Browser support is defined by `.browserslist`: the last two major versions,
  excluding dead browsers.
- Node.js 24 or newer is required by `package.json#engines.node` and the
  Browserslist Node target.
- Applications that require legacy browsers, ES5 output, or older Node.js
  releases should remain on Cytoscape.js v3 or transpile the package for their
  own targets.

Babel and its Rollup integration have been removed. Rolldown and oxc handle the
source transform and produce the existing UMD, CommonJS, and ESM bundles.

## Declaration generation

Run:

```sh
npm run build:types
```

The declaration build has two stages:

1. `rolldown -c rolldown.dts.config.mjs` bundles declarations from
   `src/index.mts` into the ESM-shaped `build/dts/index.d.ts`.
2. `node build-dts.mjs` finalises that output as `dist/cytoscape.d.ts`, with a
   callable `cytoscape` function, a merged `cytoscape` type namespace,
   `export = cytoscape`, and `export as namespace cytoscape`.

The shipped shape supports all three intended TypeScript consumption modes:

- CommonJS `import cytoscape = require('cytoscape')`
- ESM default imports plus named type imports
- script-tag/UMD use through the global `cytoscape` function and namespace

`dist/cytoscape.d.ts` is a committed generated package artifact. The freshness
gate rebuilds it and fails when the committed declaration no longer matches the
source. `package.json` points both `types` and the package export map at this
file.

## Public type architecture

The runtime retains its prototype-mixin design, and the source types mirror it:

- `src/collection/eles-types.mts` assembles the wide internal `Collection` and
  `Element` interfaces from the collection mixins.
- `src/core/core-types.mts` assembles `Core` from its contribution interfaces.
- Constructor functions remain functions where the runtime reassigns
  prototypes or invokes extensions with `call()`/`apply()`.
- Internal renderer structures continue to use a permissive structural
  interface where they are not part of the public declaration.

The internal collection prototype contains both node-only and edge-only
members. Public projections hide the opposite kind:

- `NodeCollection` and `NodeSingular` omit edge-only APIs.
- `EdgeCollection` and `EdgeSingular` omit node-only APIs.
- Singular projections have `length: 1`.
- Indexing, iteration, `first()`/`last()`/`eq()`, slicing, sorting, and min/max
  preserve the element kind.
- Broad compatibility overloads needed by source internals are marked
  `@internal` and stripped from generated declarations.
- Kind-agnostic public inputs use the shared collection boundary, so narrowed
  node and edge values compose with core, viewport, traversal, layout, and
  graph-algorithm APIs.

`src/public-types.mts` supplies the top-level compatibility namespace. The
canonical fixture contains 204 generated exports, including the default
factory; the shipped merged namespace contains the corresponding 203 type
members, with the default represented by the callable export assignment.
`test:types:exports` checks both entry points and maintains a 26-token `any`
ratchet.

The compatibility fixture makes exported-name coverage exhaustive. Cytoscape.js
v4 does not promise that every historical v3 helper alias has byte-for-byte
identical semantics: exact structural compatibility is tested for representative
factory, collection, layout, algorithm, stylesheet, and extension aliases.
The old `index.d.ts` remains only as a historical reference.

## Parity sweep completed

The migration now covers the high-value contracts found during review:

- callable CommonJS, ESM, and global declaration consumption
- complete top-level namespace name coverage
- precise node/edge singular identity and iteration
- `cy()` returning the public `Core`
- definition arrays accepted by `cy.collection()`
- narrowed collections accepted by public element/collection inputs
- receiver-preserving data, scratch, position, style, and CSS setters
- style, numeric-style, rendered-style, and rendered-CSS getter shapes
- required layout options and layout names
- contextually typed Grid, Circle, and CoSE callbacks on core, collection, and
  initialisation layout options
- node/edge callback kinds for graph algorithms and clustering features
- discriminated `png()`/`jpg()`/`jpeg()` output return types
- public `EventObject` ready callbacks and application-defined event parameters
- documented rendered-style and collection set-operation aliases
- stylesheet JSON blocks requiring at least one of `style` or `css`
- committed declaration freshness

The earlier data/position setter gap is resolved: setters retain the precise
receiver (`NodeCollection`, `EdgeCollection`, or singular), so kind-specific and
algorithm chains continue to type-check.

## Validation

The declaration checks are deliberately split by concern:

- `npm run typecheck` validates the TypeScript source graph.
- `npm run test:types` builds the declarations and compiles every
  `typescript/tests/*.test-d.ts` consumer fixture. `parity.test-d.ts` uses
  invariant exact-type assertions plus negative `@ts-expect-error` checks.
- `npm run test:types:docs` checks every documented core, collection, element,
  node, edge, animation, and layout member, including aliases. It also checks
  that each documented member is callable on its narrowed kind.
- `npm run test:types:css` compares generated `Css.*` declarations with the
  runtime style-property inventory.
- `npm run test:types:exports` compares both generated and shipped declaration
  surfaces with `test/legacy-public-types.txt`, verifies the callable/global
  facade, and enforces the `any` ratchet.
- `npm run test:types:compat` compiles CommonJS, ESM, and global consumers
  against `dist/cytoscape.d.ts`, including factory helpers such as `use`,
  `warnings`, `version`, `stylesheet`, and `Stylesheet`.
- `npm run test:types:fresh` regenerates CSS types and package declarations,
  then requires both `src/style/css-types.mts` and `dist/cytoscape.d.ts` to be
  unchanged.
- `npm run test:types:all` builds once and runs all six declaration gates.

Runtime validation remains separate: source and built-bundle Mocha suites,
module tests, lint, builds, docs generation, and Playwright cover executable
behaviour rather than declaration structure.

## Remaining limits

- Exact overloads, generic constraints, and argument/return precision are
  curated by consumer and parity tests; they are not exhaustively compared with
  every signature in the old hand-written declaration.
- The docmaker audit proves documented member presence, absence, aliases, and
  narrowed-kind callability. It does not prove every overload shape.
- The export audit proves the complete public name set. Structural usability is
  representative and v4-oriented, not a promise of unchanged v3 semantics.
- Undocumented internal helper types are checked by the source compiler but are
  not part of the public compatibility contract unless they leak into a public
  declaration.

## Contributor workflow

For declaration-affecting changes:

```sh
npm run typecheck
npm run lint
npm run build:types
npm run test:types:all
```

Add a focused compile-only fixture or parity assertion for public API changes,
regenerate `dist/cytoscape.d.ts`, and commit the generated artifact with its
source change.
