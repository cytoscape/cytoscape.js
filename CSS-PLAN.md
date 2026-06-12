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