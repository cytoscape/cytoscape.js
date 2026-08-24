## Round 44 — packaging + publish hardening (planned 2026-08-04; landed 2026-08-04)

The gaps the 2026-08-04 infrastructure pass found, closed for the v4
entries.

**The round's finding is that its own plan overstated what was open.**
Two of the three bullets below were written as decisions to take, and
neither is: the existing release convention already answers the first,
and round 42.5 had already done half the third.  What was genuinely
missing was the *enforcement* — nothing checked that the manifest, the
build and the tarball agreed — and that is what landed.

- **What `dist/` ships at release was never an open question.**  The
  plan says "decide what is committed at release"; v3 answers it —
  `v3/dist/` tracks all six artifacts (`cytoscape.{umd,min}.js`,
  `cytoscape.{cjs.js,esm.mjs,esm.min.mjs}`, `cytoscape.d.ts`) and
  `dist/` is not in `.gitignore`, so the convention is commit-at-release
  and v4 inherits it unchanged.  v4's `dist/` holds only the declaration
  because round 26.5 added that file and **no release build has ever
  run** — the artifacts appear when one does (`npm run dist`), which is
  round 50's.

  So there was nothing to decide and nothing to fix here;
  what was missing was a check that the chain
  **rolldown outputs → `dist:copy` → the manifest → the tarball** is
  consistent, since every link in it is hand-maintained.
  Measured while checking: `npm pack --dry-run` shipped 104 files /
  2.4 MB — `src/` (100), `package.json`, `README.md`, `LICENSE` and
  `dist/cytoscape.d.ts`.  (**106 / 2.5 MB since round 47** added
  `MIGRATING.md` and `CHANGELOG.md`, which ship deliberately.  Worth
  leaving visible rather than silently restating: this figure was true
  when it was written and false two rounds later, in the same sitting,
  which is the drift the closing sweep exists for.)

  `src/` shipping is deliberate and matches v3
  (source-map resolution), so that half of the plan's "decided
  deliberately" is also already decided.
- [x] **44.1 The pack-contents spec** (2026-08-04) —
  `test/modules/packaging.mjs`, run by `test:modules` and so by
  `npm test`.  It asks npm itself (`npm pack --dry-run --json`) rather
  than re-implementing `.npmignore`, and pins both directions: the entry
  points a consumer resolves are present (and `src/` is, at > 50 files —
  the control for every exclusion, since a pack that shipped *nothing*
  would satisfy all of them), and no development tree, no repo document
  (`PLAN.md`, `AGENTS.md`, `CLAUDE.md`, …) and no `v3/` file ships.

  `.npmignore` is a **denylist**, which is the reason this is worth
  gating: every directory added to the repo ships by default, so the
  failure mode is additive and silent.  That is also why the
  `.npmignore` → `files` migration the plan floated is **declined** and
  recorded rather than done — the migration's whole argument was
  "cleaner to keep honest", and a spec that reads the real tarball keeps
  it honest without a repo-wide convention change (AGENTS.md rule 7).

  The manifest half is the part with teeth: every path
  `main`/`module`/`types`/`unpkg`/`jsdelivr`/`exports` names must be
  produced by a build script — proved statically against `dist:copy`'s
  own argument list and against the **real `rolldown.config.mjs`,
  imported rather than parsed** (this repo has had five plan figures
  come from throwaway scans; importing the config cannot drift from it).
  A sixth spec pins `dist:copy`'s list as *exactly* rolldown's five
  outputs, both directions.
  Deliberately **not** checked: that those files exist right now.

  They
  do not in a clean checkout, and whether a release build ran before a
  publish is release-workflow business (round 50), not a property of the
  source tree.  The header says so.
- [x] **44.2 The exports-map spec** (2026-08-04) — same file.  *A plan
  correction first*: it says "the current `test:types:exports` checks
  only the v3 d.ts", which reads as though the root had one to widen.
  It does not — round 42 moved that script to `v3/` with the rest of v3,
  so the root had **no exports coverage at all** and this is new work.

  Six specs over every subpath: the map is a conditions object keyed by
  relative subpaths pointing at relative targets; **`types` is first
  wherever it appears** (TypeScript takes the first matching condition,
  so a `types` after `import` is silently never used); `import` resolves
  to `.mjs`, `require` to `.js`, `types` to `.d.ts`; the legacy
  `main`/`module`/`types` fields agree with the `.` conditions (when
  they disagree a package behaves differently per bundler, which is the
  worst shape a packaging bug takes); `./gpu` — the deprecated alias
  v3's users will type — resolves to *identical* files, since an alias
  that drifts from its target is worse than no alias; and the CDN fields
  name a bundle the build produces.
- **Already true, verified rather than rebuilt**: the root `README.md`
  is v4's (round 42.5) and states the requirements rule where installers
  read it — headless needs no GPU, a container requires WebGPU, the
  factory throws synchronously without `navigator.gpu` — and `engines`
  is `node: >=24`.  No `browserslist` was added: picking a browser set
  is a support commitment, not a packaging fix, and WebGPU availability
  is not what a browserslist query answers.
- **Controls, all eight run** (the standing rule — a spec is guilty
  until it discriminates): `dist:copy` dropping one bundle fails 2 specs
  (the copy check *and* the manifest check, since `main` names it);
  `.npmignore` no longer excluding `test` fails 1; `.npmignore`
  excluding `dist` fails 1; an `exports` subpath naming an unbuilt
  bundle fails 1; `types` moved after `import` fails 1; `main`
  disagreeing with `exports['.'].require` fails 1; `./gpu` drifting from
  `.` fails 1; and `unpkg` naming a file `dist:copy` does not produce
  fails 2.
- **Left to round 50**, and logged here rather than in a round record so
  it is not lost: the first release build must actually commit the five
  bundles, and `pre_release_test.sh` should run this spec after
  `npm run dist` so the existence half is checked where existence is
  meaningful.
