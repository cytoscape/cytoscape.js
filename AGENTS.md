# Cytoscape.js AGENTS.md

Guidelines for agents contributing to the Cytoscape.js graph theory and visualisation library. 

**Progressive Disclosure Routing:**
Do not read the entire `src/` directory. Route tasks to the following files to conserve context:
- Core math & logic: `/src/core/AGENTS.md`
- Layouts: `/src/extensions/layout/AGENTS.md`
- Renderer & UI: `/src/extensions/renderer/AGENTS.md`
- Testing: `/test/AGENTS.md`

## Environment & tooling
- Use Node via `.nvmrc` when possible: `nvm use` or `mise en`.
- Use `npm`; the repo is configured around `package-lock.json` and the existing npm scripts.
- Library source of truth is in `src/`. Documentation source lives in `documentation/md/`, `documentation/demos/`, and `documentation/docmaker.json`. 
- Built artifacts in `build/`, `dist/`, and generated files under `documentation/` should only be updated via the project scripts.
- Bundles are produced with Rollup from `src/index.mjs` into UMD, minified UMD, CJS, ESM, and minified ESM outputs.
- The repo uses ESM source files (`.mjs`), ESLint, Mocha, and Playwright.
- Before starting significant work, read `documentation/md/architecture.md`.
- To read the documentation, grep `documentation/docmaker.json` (e.g., search for "cy.on"). You can also grep `documentation/md/**/*.md` generally for doc searches.

## Code standards & Contribution
1. Preserve the existing style: two-space indentation, single quotes, ESM imports/exports, and concise readable functions.
2. Keep module boundaries aligned with the existing architecture. New source files should live near the corresponding subsystem in `src/`.
3. Avoid introducing new build tools, frameworks, or repo-wide conventions.
4. Keep changes narrowly scoped. Cytoscape.js has a large public API and small internal regressions can surface broadly.
5. If a change affects public API semantics, selectors, style behaviour, layouts, rendering, or documentation structure, call that out explicitly in your summary to the user.