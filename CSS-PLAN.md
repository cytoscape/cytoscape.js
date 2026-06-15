## CSS typing parity plan

Goal: restore a public `Css.*` typing surface that tracks the documented Cytoscape.js style API, without reintroducing hand-maintained declaration drift.

### Constraints

- The runtime source of truth for style inventory already exists in `src/style/properties.mts`.
- Public semantics and scope must follow the docs, especially `documentation/md/style.md` and the style-related entries referenced by `documentation/docmaker.json`.
- We should avoid narrowing internal style-engine/runtime code just to shape declarations.

### Phases

1. Reintroduce a public `Css` namespace in source-generated declarations.
   - Export `Css.Node`, `Css.Edge`, `Css.Core` and the old helper aliases like mapper/property value wrappers.
   - Thread those types through the public entry points that currently accept loose `Record<string, unknown>` or `any` style maps.

2. Reconnect the main public style-shaped APIs.
   - `CytoscapeOptions.style`
   - element JSON `style`/`css`
   - stylesheet JSON blocks
   - chained `Stylesheet.css()` / `Stylesheet.style()`

3. Add automated parity checks.
   - Verify the built d.ts still exports `Css` and that the public style entry points reference it.
   - Add a docs-driven audit for documented style property coverage versus the generated declaration surface.

4. Tighten value families iteratively.
   - Start with broad property-map support so the public surface is usable again.
   - Narrow documented literal unions and specialised property value helpers incrementally, ideally reusing runtime property metadata where practical.

### Known limits for the first pass

- The first implementation can restore the public `Css.*` namespace and hook it into the public API without yet proving exact per-property docs parity.
- Exact property-name/value-family auditing will need a follow-up docs-driven test, similar to the existing docmaker surface audit for methods.
- We should prefer source-owned generated declarations over copying the old hand-written file wholesale; the old file is a reference target, not the new source of truth.

### Status (phases 3–4 implemented)

- **`src/style/css-types.mts` is now generated** from the runtime inventory
  (`src/style/properties.mts`) by `scripts/gen-css-types.mjs` (`npm run
  gen:css-types`). Every visual property — including the generated
  `pie-N`/`stripe-N` and `*-arrow-*` families and the property aliases — is
  typed on the interface it applies to (`Css.Node`, `Css.Edge`, common props on
  `CommonElement`, and core props on `Css.Core`). Literal value unions
  (`NodeShape`, `ArrowShape`, easing, …) are emitted directly from the runtime
  `types` enums, so they track the engine rather than being hand-maintained.
- **Parity is enforced by `npm run test:types:css`** (`test/types-css-surface.mjs`),
  the style-property analogue of the method surface audit. It builds the
  declarations, then cross-checks the generated `Css.*` surface against the live
  runtime inventory, failing on any documented-but-untyped or typed-but-unknown
  property and on any new/unmapped property group. Regenerate after changing
  `properties.mts`; the audit catches a forgotten regen.
- **Compile-time entry-point coverage** lives in `typescript/tests/api.test-d.ts`
  (`npm run test:types`), exercising `Css.Node`/`Css.Edge`/`Css.Core` maps,
  per-element mapper inference, enum narrowing, and the public style entry
  points (stylesheet `css()`/`style()`, element JSON `style`, `StyleJsonBlock`).
- `npm run test:types:all` builds the declarations once and runs all three type
  checks (tsc, method surface, css surface). These targets are intentionally
  kept out of `npm test`, since they depend on the generated d.ts build.

### Remaining / iterative

- Element applicability follows the runtime property *groups*. A handful of
  properties whose name is shared across element kinds but that live in a single
  runtime group (e.g. `width`) are typed only on that group's interface; they
  remain usable on other elements via the index signature, just un-narrowed.
  Splitting those is a future tightening step.
- Value families are intentionally broad where the runtime is permissive
  (`number | string` for unit-bearing sizes, `string` for `transition-timing-function`
  function forms). These can be narrowed further as documented, without risking
  drift now that the audit guards property-name coverage.