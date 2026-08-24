## Round 71 plan — cyext: the extension toolchain (raised by the maintainer 2026-08-14)

v4's extension story is round 17's contract — `cy.layout({ impl })`,
no registry, no `cytoscape.use()` — and it is complete as an API but
naked as a workflow: v3's documentation sent extension authors to
`rollup-starter-lib`, and nothing scaffolding-shaped exists anywhere
in this repo.  The ask is a create-react-app for Cytoscape.js
extensions: an npm package **`cyext`** (verified unclaimed on the
registry 2026-08-14 — `npm view cyext` answers E404), living in this
repo and published on its own, whose consumer's package.json is
nothing but `"build": "cyext build"`, `"test": "cyext test"`, and so
on.  The toolchain — rolldown, rolldown-plugin-dts, oxlint, oxfmt,
tsx + node:test, the same tools this repo builds itself with — is a
*dependency of cyext*, exact-pinned, so upgrading an extension's
whole toolchain is bumping one devDep, first-party extensions
included.  Scope, decided by the maintainer at the round's raising:
the full command set **including release**; `cyext init` scaffolding;
and a real example extension in-repo built entirely by cyext, which
becomes round 51's "external layout through the round-17 contract"
smoke vehicle.

### Design calls

- **A nested package at `cyext/`, on the v3 precedent — not npm
  workspaces.**  Workspaces would put a `workspaces` field in the
  root manifest, hoist cyext's dependencies into the root
  `node_modules`, and change what a root `npm ci` means for every
  existing job.  Three invariants forbid that: v3's independent
  install must not break; **ci-node stays v3-free and now
  cyext-free** (the Node tier runs against a root-only install,
  restored deliberately 2026-08-06); and cyext's *reason to exist* is
  that its dependency tree is its own, resolved from its own tracked
  lockfile, identical in-repo and in a consumer's app — hoisting is
  precisely the mechanism that would make in-repo cyext resolve
  different tool versions than published cyext.  Driven from root via
  `npm --prefix cyext`, like v3.
- **cyext's own source is plain `.mjs` — no build step, no
  TypeScript.**  The `.mts`-through-`.mjs`-specifiers convention is a
  `src/` convention for the *bundled library*; the repo's own tooling
  under `scripts/` is already plain `.mjs`, and cyext is a Node CLI
  in that family.  A toolchain package that needs its own toolchain
  to build is circular, and shipping source means `npm publish` ships
  exactly what the tree tests.  Internal shape follows
  `scripts/build-dts.mjs`: pure exported functions plus a
  `pathToFileURL( process.argv[1] )` main guard, so every command's
  logic is spec-able without spawning.  Rejected: authoring in `.mts`
  — types at the cost of a bootstrap build and a dist tree.
- **The tools are `dependencies` of cyext, exact-pinned — not
  carets.**  A cyext version *is* a toolchain version, and a caret
  lets a patch release skew two extensions built "with the same
  cyext".  Upgrades happen by releasing cyext.  A root spec
  (toolchain-skew, below) asserts every cyext pin satisfies the
  root's devDep range for the same tool, so the main lib and its
  extensions cannot silently diverge.  `chai` stays out of cyext's
  dependencies and in the *template's* devDeps — a test library the
  consumer's specs import should be a dependency the consumer
  declares.
- **Library API where one exists, resolved spawn where not.**
  `build`/`watch`/`build:types` use rolldown's JS API with the config
  built in memory by `lib/rolldown-config.mjs` (pure) — no temp
  config file is ever written into the consumer's project, and the
  root config's env plumbing (`FILE`/`VERSION`/`NODE_ENV`) becomes
  plain function parameters, so `cross-env` is not needed at all.
  `oxlint`, `oxfmt` and `tsc` are spawned:
  `createRequire( import.meta.url ).resolve( '<tool>/package.json' )`
  resolves each tool from **cyext's own tree** wherever cyext is
  installed, reads its `bin` field, and runs
  `process.execPath <binpath> <args...>` via array-argument
  `execFileSync`.  Rejected: shelling `npx <tool>` — it resolves from
  the consumer's tree first (defeating the pinning) and hits the
  network on a miss.  `cyext test` spawns
  `node --import <abs tsx entry> --import <abs shim> --test
  "test/*.mjs"` with both `--import` targets resolved to absolute
  paths from cyext's tree, because a bare `--import tsx` resolves
  from the consumer's CWD and only works when npm happens to hoist
  it.
- **The shim and the configs ship as drift-gated copies.**
  `cyext/lib/node-test-setup.mjs` is a byte-for-byte copy of the
  root's 46-line BDD shim, spec-pinned equal; the shipped oxlint
  rules equal root's `.oxlintrc.json` modulo its repo-relative
  `$schema` (which breaks when copied verbatim); oxfmt's two keys are
  copied.  Rejected: importing across the package boundary — cyext
  must be publishable and self-contained.
- **Extensions emit straight to `dist/` — no `build/` +
  `dist:copy`.**  The root's copy list is a hand-maintained coupling
  round 44 exists to police, and an extension has no dev harness
  consuming `build/`, so the two-directory scheme buys nothing and
  adds the exact drift point.  Outputs:
  `dist/<name>.{umd.js,min.js,cjs.js,esm.mjs,esm.min.mjs}` plus
  `dist/<name>.d.ts`.
- **`cytoscape` is external in every format, with
  `output.globals: { cytoscape: 'cytoscape' }` — even though v4
  extensions import only types.**  Under `verbatimModuleSyntax` a
  type-only import is elided, so the external is usually moot — but
  declaring it means an extension that imports a runtime value
  (deliberately or by accident) gets a correct external reference
  instead of a silently inlined copy of cytoscape.  A bundle-level
  spec asserts the non-inlining.
- **Names are derived, not configured.**  Package
  `cytoscape-layout-spiral` → files `dist/cytoscape-layout-spiral.*`,
  UMD global `cytoscapeLayoutSpiral` (scope stripped for `@org/…`,
  then camelCase).  Escape hatch: an optional `"cyext"` field in the
  consumer's package.json — `{ globalName, entry, external: [...] }`,
  all optional.  Rejected: a `cyext.config.mjs` file — a config
  module invites per-project divergence, which is the disease this
  package treats; the manifest field is enough for v1.
- **Templates spell scripts `"build": "cyext build"`, not
  `"npx cyext build"`.**  Inside an npm script `node_modules/.bin` is
  already on PATH; the npx form adds cold-start and a network
  fallback for no gain.  `npx cyext …` still works from a shell, as
  the raising described.  (A deliberate refinement of the raising's
  literal example — flagged, not silent.)
- **Root `.npmignore` gains `cyext` and `extensions`.**  It is a
  denylist, so both new top-level directories would ship in the
  *cytoscape* tarball otherwise — and round 44's tarball spec carries
  an allowlist, so the omission fails `test/modules/packaging.mjs`
  loudly.  That failure is one of the round's controls, run
  deliberately before the `.npmignore` edit lands.
- **CI: a new `ci-cyext` job**, modeled on `ci-v3`
  (`.github/workflows/tests.yml:88`): root `npm ci` + `npm run
  build` + `npm run dist:copy` (the e2e specs and the example resolve
  `cytoscape` to the repo root, whose runtime entries live in
  `dist/`; the committed `dist/cytoscape.d.ts` covers types), then
  `npm --prefix cyext ci && npm --prefix cyext test`, then the
  example extension's install + `cyext check`.  ci-node is untouched.
  Root gains a `test:cyext` convenience script for humans; root
  `npm test` is *not* extended (rejected: folding into `test:node` —
  it needs a second install and root dist artifacts, exactly the
  coupling the round-53 split removed).
- **`cyext release` is deliberately minimal, and round 50 is not
  front-run.**  `release [patch|minor|major|<version>] [--dry-run]
  [--tag <disttag>]`: refuse a dirty git tree → run `cyext check` in
  full → roll the changelog (`## Unreleased`, which must exist and be
  non-empty, becomes `## <version> — <date>` with a fresh Unreleased
  inserted; a pure function in `lib/changelog.mjs`, spec'd on
  strings) → `npm version` (commit + tag) → `npm publish`.  What it
  deliberately does not do: provenance, signing, release-notes
  generation, GitHub releases.  Round 50 owns release engineering for
  the *main* lib; when it settles provenance, retrofitting
  `--provenance` here is a one-flag follow-up — and cyext's own
  publishes go through this same command, so cyext releases itself.

### The command set

| command | does |
|---|---|
| `cyext init [dir]` | Scaffold a new extension; `--name` for non-interactive; refuses a non-empty dir without `--force`. |
| `cyext build` | Five bundles into `dist/`: entry `./src/index.mjs` (the root's `extensionAlias` trick resolving `.mts`), `transform.target 'es2018'`, replace-plugin for `process.env.VERSION`/`NODE_ENV`, license banner from the consumer's `LICENSE` when present, **no wgsl plugin** (cytoscape-specific), `cytoscape` external + globals. |
| `cyext build:types` | rolldown-plugin-dts against the consumer's tsconfig → `dist/<name>.d.ts`, then a generalized finalize appending `export as namespace <globalName>` — the `build-dts.mjs` pattern with the name parameterized. |
| `cyext test` | node:test + tsx + the shipped shim over `"test/*.mjs"`, extra argv passed through (`--test-name-pattern` etc.). |
| `cyext lint` / `format` / `format --check` | The shipped configs on `src test`; a consumer `.oxlintrc.json`/`.oxfmtrc.json` wins if present. |
| `cyext watch` (alias `dev`) | rolldown watch on the unminified esm + cjs bundles, inline sourcemaps, development.  No dev server — an extension has no page; authors `npm link` into an app or the debug harness. |
| `cyext check` | The CI aggregate, in order: `tsc --noEmit` → lint → format --check → test → build → build:types → **pack agreement** — every `dist/` path named by the consumer's `main`/`module`/`types`/`exports`/`unpkg`/`jsdelivr` was actually produced, and `npm pack --dry-run --json` ships each of them and nothing stray.  Round 44's gate, productized: every extension gets it for free. |
| `cyext release` | The design call above. |

### The package layout

```
cyext/
  package.json         bin { cyext: bin/cyext.mjs }, exact pins,
                       files allowlist, engines >= 24
  package-lock.json    tracked (the v3 lesson of 2026-08-06)
  README.md            the manual — written first, in 71.0
  bin/cyext.mjs        argv parse + dispatch; unknown command exits 1
  lib/                 context.mjs (project discovery),
                       resolve-tools.mjs, run.mjs,
                       rolldown-config.mjs, dts-finalize.mjs,
                       changelog.mjs, node-test-setup.mjs,
                       commands/*.mjs
  configs/             oxlintrc.json (minus $schema), oxfmtrc.json,
                       tsconfig.base.json (nodenext /
                       verbatimModuleSyntax / strict, matching root)
  templates/           the init scaffold
  test/                cyext's own suite, incl. the tmp-dir e2e
extensions/
  cytoscape-layout-spiral/   the example extension
```

### The templates (`cyext init` generates nine files)

`package.json` — name, `0.1.0`, entries naming the five bundles +
d.ts, `files: [ "dist" ]`, scripts all `cyext <cmd>`,
`peerDependencies: { cytoscape: "^4.0.0-0" }`, devDeps cyext +
cytoscape + chai; **no `engines` field** — an extension's `engines`
binds its *app consumers*, whose runtime never touches cyext; the
template's `.nvmrc` (`24`) carries the dev-time floor instead.
`src/index.mts` — a commented `LayoutImpl` class:
`import type { LayoutContext } from 'cytoscape'`, a `run( ctx )`
using `ctx.nodeSlots()` / `ctx.setPositions()`, an options knob read
off `ctx.options`, default-exported — deliberately a **ring** layout,
not the spiral, so the template does not collide with the shipped
example.  `test/layout.mjs` — a headless spec in the repo's Mocha
shape, cribbed from `test/layout-contract.mjs` (which
`src/README.md` already names as the template external authors should
crib): run, `await layout.promise()`, assert positions and the
`layoutstart`/`layoutready`/`layoutstop` triple on the core.
`tsconfig.json` extending cyext's base; `README.md`; `CHANGELOG.md`
with an `## Unreleased` section `release` consumes; `.gitignore`;
`LICENSE` (MIT).  Placeholders (`__EXT_NAME__`, `__EXT_GLOBAL__`,
`__CYEXT_VERSION__`, `__YEAR__`) appear only inside strings, JSON
values and markdown, so every template stays parseable and the
template dir can itself be linted.

### The example extension — `extensions/cytoscape-layout-spiral/`

The dogfood: a real package whose scripts are nothing but
`cyext <cmd>`.  The source is `debug/init.js`'s `SpiralLayout` ported
to `.mts` — the sqrt-spiral over `ctx.nodeSlots()` →
`ctx.setPositions()`, a `spiralStep` option, default export — **minus
its `cy.fit()` call**, which the debug page could only write because
it closed over `cy`; a contract-clean impl talks to `ctx` alone
(whether the contract offers a fit affordance is checked in 71.6, not
assumed).  DevDeps use directory links so the in-repo build needs no
registry: `"cyext": "file:../../cyext"`,
`"cytoscape": "file:../.."` — npm installs directory `file:` deps as
symlinks, and Node resolves cyext's imports from cyext's real
location, so the pinned toolchain is the one that runs.  Lockfile
tracked.  `debug/init.js` keeps its inline copy — the harness must
not depend on an installed extension — with a comment pointing at the
canonical package.  As round 51's smoke vehicle, with the caveat
stated for the record: in-repo this package consumes `file:`-linked
cytoscape and cyext; round 51's bake re-runs the same package against
the *published* pair, which is the half only a real publish can test.

### Controls the round owes (every spec run once deliberately broken)

cyext's own suite: dispatch — remove a table entry; the pure
rolldown-config builder — drop `external`; bundle-level externals on
a fixture with a deliberate *runtime* cytoscape import (esm keeps the
specifier, UMD references the global, never inlines) — comment out
`external` in the builder; shim drift — edit one byte of the copy;
config drift — flip one shipped rule; dts finalize (appended once,
idempotent, throws on a declaration with no default export) — feed it
a bad declaration; changelog roll (refuses an empty Unreleased) —
delete the refusal branch; **the init e2e, the key control** —
scaffold into `mkdtemp`, hand-symlink
`node_modules/{ cyext, cytoscape, chai }` + `.bin/cyext` (no network;
ensure root `dist/` runtime files exist first — the round-53
fresh-checkout lesson), run `cyext check` green end to end, with two
controls: (a) corrupt the template's `setPositions` call — the
*generated* test fails; (b) drop a template file from the scaffolder
— `check` fails; release preflight — neuter the dirty-tree check;
cyext's own pack agreement (round-44 pattern, `npm pack --dry-run
--json` against its `files` allowlist) — drop `templates` from
`files`.

Root-suite additions (`test/modules/`): **toolchain-skew** — each
cyext pin satisfies root's devDep range for the same tool (control:
bump a pin out of range); **example-extension shape** — manifest
scripts all invoke cyext, and its `src/` has no runtime cytoscape
import, types only (control: add one); **the root tarball** —
`packaging.mjs` run once before the `.npmignore` edit, and the
observed failure is the control.

### Pass split (tests-first; docs in-commit; each pass its own commit(s))

- **71.0 Docs-first** — this section; `cyext/README.md` written as
  the manual *before* the code (command table, the `"cyext"` manifest
  field, the pinning philosophy); AGENTS.md gains `cyext/` +
  `extensions/` in the structure section; `src/README.md`'s
  extension-contract prose gains the tooling pointer.
- **71.1 Package skeleton** — `cyext/package.json` (pins, bin,
  files), lockfile, dispatch, `resolve-tools`/`run`, the shim +
  config copies with their drift specs, cyext's own test harness,
  the root `.npmignore` edit (control first), root `test:cyext`, the
  `ci-cyext` job running the cyext suite.
- **71.2 build / build:types / watch** — the pure config builder
  spec'd first, the programmatic build, dts + finalize,
  naming/externals/globals, the bundle-level fixture specs.
- **71.3 test / lint / format** — spawn wiring with absolute
  `--import` paths, config precedence, argv passthrough.
- **71.4 check** — the aggregate + the consumer pack-agreement gate.
- **71.5 init** — templates, the scaffolder, the tmp-dir e2e with
  both controls.
- **71.6 the example extension** — port SpiralLayout, `file:` links,
  extend `ci-cyext`, the root shape/skew specs, the `debug/init.js`
  comment.
- **71.7 release** — preflight, changelog roll, bump, publish
  `--dry-run`; specs.
- **71.8 Closing sweep** — `src/README.md`, MIGRATING.md (an
  "authoring an extension" pointer), CHANGELOG.md, AGENTS.md final
  pass, EXECUTIVE_SUMMARY.md rewritten from this file.

### Risks tracked

1. **npm name squatting** — `cyext` is unclaimed today; every
   unpublished day is exposure.  Recommend a placeholder publish
   right after 71.1 (a maintainer action — listed under Open).
2. **Toolchain skew vs root** — spec-gated; "upgrade the toolchain"
   becomes a two-manifest change CI notices rather than a drift.
3. **Node floor** — cyext carries `engines >= 24` (it runs the same
   tools the repo does); generated extensions deliberately carry
   `.nvmrc`, not `engines` (the reasoning in the templates section).
4. **Windows** — array-argument `execFileSync`, `node:path`
   throughout, `pathToFileURL` for `--import` arguments; no Windows
   CI here — round 49 (reserved) owns that runner and inherits cyext,
   noted so it does.
5. **rolldown JS API stability** — the exact pin makes it a
   deliberate, per-cyext-release exposure; the bundle-level specs are
   the canary.
6. **`file:`-link fidelity** — in-repo the example consumes links,
   not tarballs; the published-pair question is explicitly round 51's
   bake, not silently assumed covered.

**Open:** the placeholder publish of `cyext` (maintainer action,
recommended immediately after 71.1); whether `LayoutContext` offers a
fit affordance the spiral example should expose (checked in 71.6, not
assumed); whether `extensions/` eventually gains the force layout as
a second first-party package (out of scope, noted for round 51's
triage); provenance on `cyext release`, parked for round 50.
