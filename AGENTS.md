# Cytoscape.js AGENTS.md

Guidelines for agents contributing to the Cytoscape.js graph theory and visualisation library.

## Environment & tooling
- Use Node via `.nvmrc` when possible: `nvm use` or `mise en`.
- Use `npm`; the repo is configured around `package-lock.json` and the existing npm scripts.
- Library source of truth is in `src/`. Documentation source lives in `documentation/md/`, `documentation/demos/`, and `documentation/docmaker.json`. Built artifacts in `build/`, `dist/`, and generated files under `documentation/` should only be updated via the project scripts.
- Bundles are produced with Rollup from `src/index.mjs` into UMD, minified UMD, CJS, ESM, and minified ESM outputs.
- The repo uses ESM source files (`.mjs`), ESLint, Mocha, and Playwright.
- Before starting significant work, read any repo docs directly related to the area you are changing. For architecture context, start with `documentation/md/architecture.md`.
- If you want to read the documentation, you can grep `documentation/docmaker.json`, which contains all the documentation data (and API in JSON format).  You can search for things like "cy.on" for the `cy.on()` method.  `docmaker.json` references markdown files in `documentation/md/` for prose that elaborates on particular API methods and also for general prose sections, like the intro or getting started sections.  You can also grep `documentation/md/**/*.md` generally for doc searches.  The paths broadly match the `src/**/*.mjs` paths.

## Development flow
- Make sure dependencies are installed when you first start: `npm install`.
- Install Playwright browsers before running browser coverage or the full test suite on a fresh environment: `npx playwright install --with-deps`.
- Make your changes.
- Lint source files: `npm run lint`.
- Run the narrowest useful test loop while iterating, but run the relevant verification before handing work back:
  - Source or algorithm changes: `npm run test:js` and `npm run test:modules`.
  - Renderer or interaction changes: `npm run test:js`, `npm run test:modules`, and sanity check in `debug/` via `npm run watch`; run Playwright when browser behaviour is affected.
  - Bundle, packaging, or docs pipeline changes: `npm run build`, `npm run docs`, and any targeted release script checks that apply.
  - If the change is broad or you are unsure, run `npm test`.
- Build all bundles but only if you're modifying the build system: `npm run build`.
- Commit your changes in isolated commits.  Use detailed commit messages.

## Repository structure
- `src/`: Main library source.
  - `src/core/`: Core instance lifecycle, viewport, rendering, style, layout, animation, and notifications.
  - `src/collection/`: Collection APIs, traversals, dimensions, styling, and graph algorithms.
  - `src/style/`: Style parsing, application, bypasses, and stylesheet helpers.
  - `src/selector/`: Selector parsing and matching.
  - `src/extensions/`: Built-in layouts and renderers.
    - `src/extensions/renderer/base/`: Shared renderer state and geometry logic.
    - `src/extensions/renderer/canvas/`: Canvas renderer, drawing pipeline, caches, and WebGL helpers.
    - `src/extensions/layout/`: Built-in layouts like grid, cose, concentric, and breadthfirst.
  - `src/gpu/`: WebGPU v4 prototype (issue #3486) — a separate columnar core + WebGPU renderer with its own entry point (`cytoscape/gpu`); the v3 core/renderers are untouched. `src/gpu/README.md` is the maintained scope and design-decisions doc; `PLAN.md` (repo root) records each development round and the standing process rules (docs travel with every commit; a closing docs sweep ends every round). Manual harness in `debug/webgpu/`, benchmarks in `benchmark/gpu/`, browser specs in the `webgpu` and `webgpu-visual` Playwright projects.
  - `src/util/`: Shared low-level helpers.
- `test/`: Mocha tests. Add regression coverage here for API and logic changes.
- `debug/`: Manual visual and interaction test pages. Use this for renderer, interaction, and gesture changes that are hard to verify in unit tests alone.
- `playwright-tests/` and `playwright.config.js`: Browser-level regression coverage.
- `documentation/`: Generated site plus source markdown, demos, and the doc generator.
  - `documentation/md/`: Documentation source.
  - `documentation/demos/`: Demo apps and assets used by the docs site.
  - `documentation/docmaker.mjs`: Docs build entrypoint.
- `.github/workflows/`: CI and release workflows.
- `benchmark/`: Performance comparisons and targeted benchmark runners.
- `typescript/`: TypeScript-related tests and fixtures.

## Code standards
1. Preserve the existing style: two-space indentation, single quotes, ESM imports/exports, and concise readable functions.
2. Do not hand-edit generated outputs when a source file exists instead. In particular, prefer editing `src/` and `documentation/md/` over generated files in `build/`, `dist/`, and compiled docs assets.
3. Keep module boundaries aligned with the existing architecture. New source files should live near the corresponding subsystem in `src/`.
4. When fixing a bug, add or update a regression test whenever practical. Put public-behaviour tests in `test/`; keep internal-only coverage in `test/modules/` when applicable.
5. For renderer, gesture, or grab-state changes, verify behaviour in `debug/` because visual regressions are not always caught by Mocha alone.  You need to control a browser instance to use this and you need to run `npm run watch` to run a dev server with auto-rebuild.
6. Keep docs in sync with API or behaviour changes. Update `documentation/md/`, demos, and `docmaker.json` inputs rather than patching generated HTML by hand.
7. Avoid introducing new build tools, frameworks, or repo-wide conventions unless the task explicitly requires it.
8. When adding new top-level workflows, major directories, or important source areas not already documented here, update `AGENTS.md`.

## Testing notes
- `npm test` matches CI closely: GitHub Actions installs dependencies, installs Playwright browsers, and runs `npm test`.
- `npm run test:build` exercises the built bundle rather than source files; use it when a bug could be introduced by bundling or build-time transforms.
- Playwright setup depends on a built UMD bundle and a local HTTP server. Use the existing scripts rather than inventing a parallel harness.
- **Rebuild the bundle before trusting a Playwright run.** `playwright.config.js` sets `reuseExistingServer: !CI`, so when an `http-server` is already listening on 3333 (a leftover `npm run watch`, or an earlier run's server), Playwright attaches to it and the `test:playwright:build` half of `test:playwright:setup` never runs. The suite then silently exercises a **stale bundle**, and a green run proves nothing about the source you just changed. Run `npm run test:playwright:build` yourself before `npx playwright test`, or kill the listener on 3333 first. This is invisible when it happens — the only symptom is a pass you did not earn.
- Visual regression coverage for the GPU prototype lives in the `webgpu-visual` Playwright project (`playwright-tests/webgpu-visual.spec.js`): golden-image diffs against PNGs checked into `playwright-tests/goldens/` plus live v3-vs-v4 parity diffs. After an intended visual change, regenerate goldens with `UPDATE_GOLDENS=1 npx playwright test --project=webgpu-visual` and commit the updated PNGs; never edit goldens by hand.
- **If a change claims v3 parity, verify it with a live parity diff, not a golden.** Goldens compare against v4's own previous output at a 0.5% default tolerance, so they answer "did this change?" and not "is this right" — in round 27 the arrow goldens passed both before and after v4's arrow sizing was corrected to v3's formula, because the difference sat under that tolerance. The parity tests render the same scene through both renderers in one run and diff them, which is what actually caught it.
- **Check that a new parity test can fail.** Run it once with the feature deliberately disabled (or the shape swapped for its unstyled counterpart) and confirm the mismatch jumps. Round 27 shipped one test whose first version passed at 0.514% with the feature on and 0.672% with it off — it was measuring nothing. Make the scene dominated by whatever the change affects.
- **The same control applies to plain unit specs, and a spec's name is not evidence that it tests what it says.** Round 27 shipped three specs named `'picks by its slanted outline, not its bounding box'`, `'picks inside the body and outside the cut corners'` and `'picks inside the body ...'` whose only assertions were on `boundingBox()` — which is the node box for *every* shape keyword, so all three passed with the shape under test swapped for `ellipse`. Each comment described the pick it meant to check and then never called a pick path. When a spec is named for behaviour X, assert X, and run the file once with X's implementation swapped out to confirm the failure lands.

- **Do not record a GPU measurement as "blocked, no adapter here" without checking.** That conclusion has been reached and corrected twice (round 18.5 and round 27.9 — see PLAN.md). `requestAdapter()` returns null on `about:blank`, so a bare-page probe reads as "no GPU" on a box that has one; probe from a served page, which is what `benchmark:gpu:renderer` already does. Only the `webgpu-visual` goldens pin SwiftShader, deliberately, and only for the WebGPU adapter — that pin says nothing about what hardware is present.

## Documentation notes
- Documentation HTML is generated. Do not edit generated docs directly when the corresponding markdown or template source (i.e. `docmaker.json` and `template.html`) should be changed instead.
- `documentation/` is v3's, and stays that way until v4 ships — the v3 code and docs are kept intact so they remain available for comparison benchmarks and parity work. Do not add v4 pages to it.
- **v4 documents itself in JSDoc** (round 26). For anything under `src/gpu/`, prose about what a member does belongs in a doc comment next to the member; the release documentation will be generated from those comments. Use standard tags only (`@param name — description`, `@returns`, `@throws`, `@see`); one block per overload signature; state the contract and any deliberate deviation from v3, not the implementation. The `// -- <group> --` banner comments in `core.mts`/`collection.mts` are the section grouping a generator reads, so keep them accurate. Coverage is enforced: `node scripts/gpu-jsdoc-coverage.mjs --verbose` lists any public member of an exported class (or exported function) that lacks a comment, and `test/gpu-jsdoc-coverage.mjs` fails the build if one appears.
- The `cytoscape/gpu` entry ships declarations built by `npm run build:types` (`rolldown.dts.gpu.config.mjs` → `build-dts.mjs` → `dist/cytoscape-gpu.d.ts`), which carry those JSDoc comments to consumers. Regenerate and commit that file when the v4 public surface changes; `npm run test:types:gpu` audits its shape.

## Contribution notes
- Keep changes narrowly scoped. Cytoscape.js has a large public API and small internal regressions can surface broadly.
- Prefer extending existing tests, demos, and docs over adding parallel mechanisms.
- If a change affects public API semantics, selectors, style behaviour, layouts, rendering, or documentation structure, call that out explicitly in your summary to the user.
