## Round 42 plan — the great restructure (planned 2026-08-04)

The packaging decision, executed: **v4 becomes the package**.

- **`v3/` is created as a self-contained subproject**: v3's `src/`,
  its tests, `documentation/`, the top-level v3 benchmark suites, the
  v3 debug pages, the v3 rolldown/dts configs, and the stale
  hand-written root `index.d.ts` — everything v3-specific — with its
  own scripts so it builds and tests like a separate project.  The
  parity harness (`playwright-page/parity.html`) and comparison
  benchmarks build v3's UMD bundle from `v3/`; nothing v3-specific
  remains outside the directory.
- **`src/gpu/*` promotes to `src/`** (the `.mjs`-specifier convention
  keeps import edits mechanical); `test/gpu-*`, `test/modules/*`,
  `benchmark/gpu/`, `playwright-*`, `scripts/gpu-*`, `debug/webgpu/`,
  the rolldown/tsconfig/audit configs all re-point.  Whether the
  `gpu-` file-name prefixes stay (history) or drop (tidiness) is a
  docs-first call — the audits' file lists change either way.
- **Root `package.json` becomes `cytoscape@4.0.0-unstable`** (round
  49 settles the prerelease spelling): v4 is `main`/`module`/`types`
  and `exports["."]`; the `./gpu` subpath stays as a deprecated alias
  through the prerelease line and is removed at 4.0 (confirm at
  docs-first).  CI workflows re-point.
- **Behaviour-neutral by assertion**: the full verification gate runs
  green before and after — Node, module, all browser projects with
  **goldens byte-stable**, types, the five audits, a benchmark smoke —
  because a restructure that changes pixels or numbers has done
  something else.

**Landed 2026-08-04.**  The plan held; the three calls it left open were
taken with the maintainer at the round's docs-first stage, and one of them
was not on the plan's list at all.

- [x] **42.1 The three calls.**
  - **The `gpu-`/`webgpu-` prefixes drop.**  `test/gpu-*.mjs` → `test/*.mjs`,
    `test/modules/gpu-*` → `test/modules/*`, `benchmark/gpu/` → `benchmark/`,
    `scripts/gpu-*` → `scripts/*`, `debug/webgpu/` → `debug/`,
    `playwright-tests/webgpu.spec.js` → `renderer.spec.js`,
    `webgpu-visual.spec.js` → `visual.spec.js`, and the Playwright projects
    with them (`renderer`, `renderer-webkit`, `visual`).  *Inside* `src/` the
    `gpu-` names stay — `gpu-context`, `gpu-types`, `render/gpu-force`,
    `render/gpu-tween`, `render/gpu-timer` — because there the prefix names
    the **device** half against a CPU counterpart (`layout/force-sim.mts` is
    the contrast), which is a live distinction rather than a v3-era label.

    *(42.6 found one of those five wrong: `gpu-types.mts` holds the public
    option surface and is not a device module at all — it is `public-types.mts`
    now.  See 42.6 below.)*
  - **The five shared utility modules duplicate rather than stay shared** —
    the call 41.3's allowlist was logged waiting for.  v4 owns lean copies,
    v3 keeps its originals, and **nothing under `src/` imports outside it**.
    `src/math.mts` carries the seven functions v4 actually calls, copied
    verbatim, rather than v3's 1500-line file: not tidiness but scope, since
    the audits walk everything in `src/` and the wholesale copy would have
    added a thousand undocumented lines to the internal tier.
    `util/colors.mts` needed one edit — `is.array` → `Array.isArray` — which
    is what let its v3 `is.mjs` → `window.mjs`/`event.mjs` tail be dropped.
  - **The v4 identity rename**, which the plan did not anticipate and which
    follows from `exports["."]`: bundles are `build/cytoscape.*`, the
    declaration is `dist/cytoscape.d.ts`, the UMD global is `cytoscape`, and
    the default export is `cytoscape( options )`.  The two runtime error
    messages and the JSDoc that named `cytoscapeGpu` were rewritten with it,
    on round 31's rule that a message advising a form that no longer exists
    is a defect a consumer sees.  The `Gpu*` **type** names were left for
    a separate call, being exported surface — logged as open call 13, taken
    the same day, and executed as 42.6 below.
- [x] **42.2 `v3/` as a subproject.**  `v3/src`, `v3/test`, `v3/benchmark`,
  `v3/debug`, `v3/documentation`, `v3/playwright-{tests,page}`,
  `v3/typescript`, `v3/scripts`, `v3/dist`, the stale hand-written
  `v3/index.d.ts`, its rolldown/dts/tsconfig configs and its own
  `package.json`.  `cd v3 && npm run build` works off the root
  `node_modules` (npm puts every ancestor's `.bin` on PATH), and
  `cd v3 && npm test` runs its 698 Node + 37 module + 18 chromium specs.
  **v3's Playwright serves port 3334**, not 3333 — with both on 3333,
  `reuseExistingServer` could silently attach one project's specs to the
  other project's server, which is the stale-bundle footgun in `AGENTS.md`
  wearing a worse hat.
- [x] **42.3 Root `package.json` is v4's alone** — `cytoscape@4.0.0-unstable`,
  v4 as `main`/`module`/`types` and `exports["."]`, `./gpu` retained as a
  deprecated alias resolving to the same files, `unpkg`/`jsdelivr` at the v4
  min bundle, and the v3-only devDependencies (handlebars, marked,
  highlight.js, gh-pages, benchmark, lodash, heap, …) moved to
  `v3/package.json`.  `tests.yml` gains a `ci-v3` job.
- [x] **42.4 The pieces that needed more than a move.**
  - `playwright-page/parity.html` loads both UMD bundles, which now **both**
    export the global `cytoscape`, so v3's is captured under its own name
    before v4's script overwrites it.  It reads v3's bundle from `v3/build/`.
  - **The parity specs fail rather than skip** when that bundle is missing,
    naming `cd v3 && npm run build:umd`.  A golden asks "did this change?"
    and only parity asks "is this right?" (round 27), so a parity suite that
    quietly stops running is worth less than one that is absent.  Controlled:
    with the bundle moved away the spec fails naming the command.
  - `test/modules/import-graph.mjs` is **rewritten, not re-pointed**.  Its
    allowlist is empty and the invariant absolute.  That inverts its own
    control: while outward edges were expected, "none found" was evidence the
    scanner had broken; now it is the passing answer, so the controls count
    *internal* edges (≥ 100) and source files (≥ 80) instead.  A new spec
    pins that nothing reaches into `v3/`.
  - `build-dts.mjs`, `rolldown.config.mjs`, `rolldown.dts.config.mjs`,
    `playwright.config.js` and the tsconfigs each split in two.
  - The **three v3 release workflows are marked unadapted**, not
    half-repointed: they deploy v3's docs site from `documentation/`, and a
    workflow that publishes the v4 package while deploying v3's docs would
    read as adapted while being wrong.  Round 50 owns them.  They also make
    the one unavoidable exception to "nothing v3-specific outside `v3/`" —
    GitHub reads workflows only from the repo root — which is recorded
    rather than papered over.
- [x] **42.6 The `Gpu*` type names** (2026-08-04) — open call 13, raised by
  this round and closed by it once the maintainer took the call.  Every
  exported type drops the prefix: `GpuCore` → `Core`, `GpuCollection` →
  `Collection`, `GpuEvent` → `Event`, `GpuStylesheet` → `Stylesheet`,
  `CytoscapeGpuOptions` → `CytoscapeOptions`, and so on through all 42
  exports.  **No deprecated aliases**, unlike `exports["./gpu"]`: that alias
  exists because *v3's* users already type the name, while nobody has yet
  written `GpuCore` against a published build.
  **Six names keep the prefix** — `GpuContext`, `GpuTimer`,
  `GpuForceRuntime`, `GpuTweenRuntime`, `GpuTweenSink`, `GpuWriteKind` — on
  42.1's rule: each names the *device* half against a CPU counterpart
  (`GpuWriteKind` is literally `Exclude<WriteKind, 'lane' | 'padding' |
  'fontSize'>`, the write kinds the kernels support), and none is exported.
  Three things the rename turned up that a blind sed would have got wrong:
  - **Two collisions with names v4 already had.**  `GpuForceLayoutOptions`
    (the public option shape) and `ForceLayoutOptions` (a module-local
    interface in `layout/force.mts`) would have become the same name; the
    internal one is now `ForceRunOptions`.  `GpuWriteKind` would have
    collided with `animation.mts`'s `WriteKind`, which is what identified it
    as a device-half name rather than a prefixed one — the collision was the
    evidence, not the obstacle.
  - **Two collisions with the DOM.**  `Event` and `EventTarget` are globals.
    Taken anyway, because they are the right names for cytoscape's own event
    object and its `target` type, and v3 spells its own event class `Event`
    too.  It costs nothing inside `src/`: `event.mts` already isolated the
    DOM type behind `type NativeEvent = globalThis.Event`, and the only
    module using the bare DOM `Event` (`interact/pointer.mts`) does not
    import ours.  A consumer who imports `Event` from `cytoscape` shadows
    the global in that file, which is their choice to make.
  - **`gpu-types.mts` was not a device module** and should never have kept
    its prefix in 42.1: it holds the *public* option and type surface, not
    anything about the GPU.  Renamed `public-types.mts`, which is what v3
    calls the same role — and which is available precisely because the
    vendored geometry types took `types.mts`.
  Three internal fields went with them (`_gpuPhaseRef`, `_gpuPhaseEle`,
  `_gpuBarred` → `_phaseRef`, `_phaseEle`, `_barred`), and the rename was
  applied to PLAN.md, `src/README.md` and `AGENTS.md` on 42.5's reasoning: a
  symbol name in a record is a live pointer.

    One historical name is
  deliberately left: `GpuStyleFn`, the style-function type round 8 deleted,
  which never had another name to be renamed to.

- [x] **42.5 Closing docs sweep** — this file, `src/README.md` (which moved
  with the source, from `src/gpu/README.md`) and `AGENTS.md`.  The renames
  were applied **throughout all three**, historical round records included:
  a path in a record is a live pointer, and the round-42 note in the
  directory layout is what explains why the old spelling is gone.  This file
  gains the round-42 paragraph in "Suggested sequencing" (one of the three
  sites the standing rule names), the rewritten directory layout with the
  `v3/` tree, and this record.

  `AGENTS.md`'s "Environment & tooling",
  "Development flow" and "Repository structure" sections were rewritten
  rather than patched — they described a v3 repo with a prototype in a
  subdirectory, which is now exactly backwards — and it gains two new rules
  (below).  The root `README.md` is v4's; v3's moved to `v3/README.md`.
  The full v4 docs README rewrite stays round 44's.

**Verification (2026-08-04)**: typecheck, lint, **1998 Node tests** and 71
module tests at the root, **698 Node + 37 module tests** in `v3/` — 2696 and
108, the same totals round 41 recorded for the then-single suite, now split by
project (108 vs 107 because the import-graph audit gained a spec).  **174
browser specs** (99 `renderer` + 75 `visual`) against a hand-rebuilt bundle,
with **goldens byte-stable** (no diff in `playwright-tests/goldens/`) and
every parity scene at its recorded value — 0.000% across the board, the stripe
pair at 0.005% — which is the strongest single piece of evidence here, since
those scenes render through *both* renderers and would move if either side had
shifted.

v3's 18 chromium specs pass.  Types clean: 42 type exports, 3
statics, 1147 doc blocks — the counts unchanged across 42.6's rename, which
is the point of checking them: 42 exports before and after means the sweep
renamed the surface rather than dropping or duplicating part of it.  The
five audits unmoved —
JSDoc 100%/100%, `@throws` 18/18, `@param` 231/231, `@returns` 278/278,
stranded blocks 1, and the throw gate at **177 run / 10 browser-only / 5
unreachable / 0 Node-reachable dead** over 192 sites.  Benchmark smoke: the
core/collection sweep runs and still measures v3 against v4.

Both WebKit projects (`renderer-webkit` here, `webkit` in `v3/`) fail to
launch on this machine for want of system libraries — `browserType.launch`,
not a spec failure — which is pre-existing and is why round 41's record also
counts 174 rather than 273.  Recorded rather than silent, per the standing
rule.
**Round 42 is complete.**

**How behaviour-neutrality was actually established**, because a green suite
proves the paths resolve and not much else on a change that moves ~1100 files:
every file now under `v3/` was compared byte-for-byte against its pre-move
blob (821 files, **6 differed**, all six intended and named above), and every
file under `src/` against its `src/gpu/` original with the diff filtered to
the only two changes the round was allowed to make — an import-depth fix or
the factory rename.  Anything that filter printed was a bug; it printed
nothing.

That check is now a rule in `AGENTS.md`, together with the second
thing the round learned: **a vendored copy joins the audits.**  The JSDoc gate
failed the moment the five utility modules landed — 19 undocumented exports,
internal tier 96.8% — which is the gate working, since a file in `src/` is
v4's regardless of where it came from.  The fix was to document the copies,
and it is the argument for copying lean.

**Risks tracked**: the round touched every path in the repo, and the parts
with no automated check are the ones to watch — the `debug/` harness and the
`watch` scripts were exercised by hand rather than by a spec, and the three
marked release workflows will fail on their next run *by design*, which is
only correct if round 50 actually adapts them.

`dist/` still holds nothing
but the declaration, so `main`/`module` resolve to files a git install does
not have — pre-existing, unchanged, and round 44's first item.  42.6's
rename is the round's one **breaking** change to a name a consumer could
already have written, and it ships without aliases on the reasoning that the
prerelease line has no published consumers; if that reasoning is wrong the
cost lands on whoever tracked `v4` from git.
