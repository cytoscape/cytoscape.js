# Cytoscape.js: Global Agent Instructions & Monorepo Architecture

##  Progressive Disclosure & Context Routing Protocol
You are operating within a high-performance graph theory and network visualization monorepo. **Do not ingest the entire `src/` or `test/` directories.** 

Your primary directive is to conserve context tokens. Depending on the user's task, you MUST load only the specific `AGENTS.md` file for that domain before proposing code modifications. Route your context loading using the following directory map:

* **IF modifying graph math, core logic, collections, or headless elements:** Read `/src/core/AGENTS.md`
* **IF modifying layouts (e.g., CoSE, Dagre) or algorithms:** Read `/src/extensions/layout/AGENTS.md` and load core element context.
* **IF modifying canvas rendering, viewport scaling, UI, or gestures:** Read `/src/extensions/renderer/AGENTS.md`
* **IF writing, debugging, or modifying test suites:** Read `/test/AGENTS.md`

## Environment, Tooling & Build Pipeline
- **Node/Package Manager:** Use Node via `.nvmrc` (`nvm use` or `mise en`). Strictly use `npm`. Do not use `yarn`, `pnpm`, or `bun`. The repository relies heavily on `package-lock.json` for deterministic builds.
- **Source of Truth:** All library source code resides exclusively in `src/`. 
- **Generated Files (DO NOT EDIT):** Never hand-edit built artifacts in `build/`, `dist/`, or generated HTML under `documentation/`. These are produced via Rollup from `src/index.mjs` into UMD, minified UMD, CJS, ESM, and minified ESM outputs.
- **Language & Syntax:** The repository uses ESM source files (`.mjs`). Maintain two-space indentation, single quotes, and avoid deep nesting. Run `npm run lint` (ESLint) to verify compliance before finalizing code.

## Documentation Edit Guidelines
- Documentation HTML is dynamically generated from JSON and Markdown sources.
- To update documentation, edit the JSON data model in `documentation/docmaker.json` or the corresponding prose markdown files in `documentation/md/`. 
- To establish context regarding public APIs, grep `documentation/docmaker.json` (e.g., search for "cy.nodes()"). The paths in `documentation/md/**/*.md` mirror the `src/**/*.mjs` directory structure.

## Strict Agent Constraints
1. **Narrow Scope & Blast Radius:** Cytoscape.js has a massive public API. Keep your code changes strictly scoped to the exact problem. Small internal regressions in core math will surface broadly across all renderers and layouts.
2. **Immutability of Public APIs:** Never break, rename, or deprecate existing public APIs unless explicitly instructed. Ensure backward compatibility for all graph instantiation options.
3. **Zero-Dependency Policy:** Do not introduce new build tools, runtime dependencies, testing frameworks, or polyfills. 
4. **Communication:** If a proposed change alters public API semantics, element selector matching, stylesheet application behavior, layout mechanics, or rendering performance, you must explicitly declare these side effects in your final output.