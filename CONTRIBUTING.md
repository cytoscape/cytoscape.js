# Contributing to Cytoscape.js

Cytoscape.js is an open source project, and we greatly appreciate any and all contributions.

**This branch is v4**, the performance redesign specified in [#3486](https://github.com/cytoscape/cytoscape.js/issues/3486) — a columnar model and a WebGPU renderer.  It is not released yet.  Contributions to the **released** library (cytoscape 3) go to the `unstable` and `master` branches, whose layout and tooling this document does not describe; v3's source is kept whole under `v3/` here for comparison and parity work.

If you'd like to contribute but you're not sure what to work on, take a look at our [current milestones](https://github.com/cytoscape/cytoscape.js/milestones) or anything labelled [`help-wanted`](https://github.com/cytoscape/cytoscape.js/issues?q=is%3Aopen+is%3Aissue+label%3Ahelp-wanted).  Of course, we also welcome your own ideas.  You can discuss new ideas with the community on [GitHub discussions](https://github.com/cytoscape/cytoscape.js/discussions).

Our goal is to make Cytoscape.js easy to use and comprehensive.  Thank you for taking the time and effort to contribute and to help make that happen!  Participation is governed by our [code of conduct](https://github.com/cytoscape/cytoscape.js/blob/v4/CODE_OF_CONDUCT.md).

## Submitting issues

The first step towards providing a code contribution is to write [a short, descriptive issue](https://github.com/cytoscape/cytoscape.js/issues).  If your issue pertains to an extension, you should file the issue on that extension's issue tracker instead.

Describe the bug or feature that you are addressing in your issue.  Then, create your issue's corresponding pull request that contains your code changes.

For a v4 bug, say which of the two halves it is in — the model (anything you can reproduce headlessly) or the renderer — and include the adapter you saw it on.  A headless reproduction is worth more than a screenshot, because it can become a test.

## Making your changes

Fork the repository, branch from `v4`, and open a pull request against `v4`.  If this is your first pull request on GitHub, the [step-by-step blog post](https://blog.js.cytoscape.org/2017/06/13/contributing/) is still a good walkthrough of the mechanics (it predates v4, so read it for the GitHub workflow rather than for this repository's layout).

### Getting set up

```sh
nvm use                 # or mise en — the version is in .nvmrc
npm install
npm run build           # the bundles the harness loads; the test
                        # scripts build for themselves
```

Two extra steps buy you the full test suite:

```sh
npm --prefix v3 install         # the v3-vs-v4 comparison and parity tiers
npx playwright install --with-deps
```

Neither is needed for the Node tier (`npm run test:node`), which runs against a root-only install.

`npm run watch` starts the development harness on <http://localhost:3333/> with a rebuild-on-save loop.  It offers fourteen networks — real exports up to 465k edges and generated scenes — each with a hand-written v4 stylesheet, plus view, layout, selection and event controls.  It is the fastest way to see a rendering or interaction change.

### Where things live

`src/` is v4's source; `src/README.md` is its maintained scope and design-decisions document, and the best thing to read before changing anything there.  [`AGENTS.md`](AGENTS.md) is the working handbook for this repository — the tooling, the invariants, and a long list of mistakes worth not repeating.  The root [README](README.md) has the repository layout.

Source files are TypeScript ESM (`.mts`) and **import each other with `.mjs` specifiers** — `./store/graph-store.mjs` resolves to `store/graph-store.mts`.  That is deliberate; please don't "fix" it in either direction.  Nothing under `src/` imports from outside `src/`, and a spec enforces it.

## Code style

Formatting is [oxfmt](https://oxc.rs)'s, not yours: run `npm run format` (or `npm run format:check`).  Linting is [oxlint](https://oxc.rs): `npm run lint`.  Neither ESLint nor Prettier is used here.

What survives as a rule rather than a setting: two-space indentation, single-quoted strings, ESM imports and exports, and concise readable functions.  Keep new files near the subsystem they belong to.

## Testing

If your change is a bugfix, please add a test that would fail without your fix.  If it is a new feature, please add tests accordingly.

| tier | command | what it covers |
|---|---|---|
| unit | `npm run test:js` | `test/*.mjs` — the public API and the algorithms |
| internal | `npm run test:modules` | `test/modules/*.mjs` — internals and repository tooling |
| robustness | `npm run test:soak` | leaks, churn, wire fuzzing, multi-instance isolation |
| guards | `npm run test:throws` | every `throw` in `src/` is reached by some spec |
| browser | `npm run test:playwright` | the renderer, visual goldens, v3-vs-v4 parity |

`npm run test:node` runs the whole Node side (typecheck, the four tiers above, lint) and `npm test` adds the browser side.  Run the narrowest useful loop while you work, and the relevant tier before you open the pull request; if you are unsure, run `npm test`.

Specs are written with chai's `expect` and a small `describe`/`it` shim over Node's own test runner, which is why they look like Mocha suites — they are not, and there is no Mocha here.

### Check that your test can fail

This is the habit the project cares about most.  A test named for a behaviour has to *assert* that behaviour: run it once with the thing it tests deliberately broken and confirm it goes red.  The repository has shipped specs that passed with the feature removed — a pick test that only asserted a bounding box, a parity scene whose difference was hidden under an opaque arrowhead, a benchmark row that measured an empty collection.  A control takes a minute and is the difference between a test and a decoration.

If a control *doesn't* fail, that is a finding rather than a wasted minute: either the code under it is redundant or the spec is.

### Visual and renderer changes

Browser coverage lives in `playwright-tests/`.  The `visual` project compares exported PNGs against goldens in `playwright-tests/goldens/` **exactly — zero differing pixels** — and also renders the same scene through v3 and v4 in one page and diffs them.  After an intended visual change, regenerate and commit the goldens:

```sh
UPDATE_GOLDENS=1 npx playwright test --project=visual
```

Never edit a golden by hand.  If your change claims v3 parity, prove it with a parity scene rather than a golden: a golden compares v4 against its own previous output, so it answers "did this change?" and not "is this right?".

Rendering changes also deserve a look at `npm run watch` before you open the pull request.  Several defects in this repository's history were invisible to every test and obvious to the first person who opened the page.

## Documentation

v4 documents itself in **JSDoc on the source**: prose about what a member does belongs in a doc comment next to it.  Coverage is enforced — a public member without a comment, or without `@param`/`@returns`/`@throws` where those apply, fails the build.  Use standard tags only.

Keep [`src/README.md`](src/README.md) in step with behaviour changes, and [`MIGRATING.md`](MIGRATING.md) and [`CHANGELOG.md`](CHANGELOG.md) in step with anything a v3 user would notice — both ship in the package.  v3's documentation site under `v3/documentation/` is v3's, and is generated; don't add v4 pages to it or edit its HTML directly.

## Benchmarks

`benchmark/` holds the performance suites, most of them measuring v4 against v3 on the same graph.  You do not need to run them for a routine change.  If your change is *about* performance, say what you measured and how it can be re-run — a number nobody can reproduce is a record, not a measurement.  Published results are grouped by machine and are never compared across machines.
