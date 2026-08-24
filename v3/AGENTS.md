# v3/ — Cytoscape.js v3, frozen

**Do not change anything here unless the task says v3.**

This directory is Cytoscape.js v3, kept whole and self-contained after
round 42 split the repo in two.  It is not legacy code awaiting cleanup
and it is not the project you are working on: it exists so that v4 can
be *measured against it* — the comparison benchmarks import `v3/src/`,
and the Playwright `visual` project renders both libraries in one page
to diff them pixel for pixel.  A change here silently moves the
baseline every parity claim in the repo rests on.

The project you are working on is **v4, at the repo root** (`src/`,
`test/`, `benchmark/`, `debug/`, `playwright-tests/`, `scripts/`).  See
the root `AGENTS.md`.

## What this means in practice

- **Editing:** only when the task is explicitly about v3 — a parity
  fixture, a comparison baseline, a v3 bug the maintainer asked for.
  Never to "fix" something that looks wrong beside v4's version of it;
  v4 deviates from v3 deliberately in many places, and the deviations
  are recorded in `src/README.md`, not here.
- **Reading:** encouraged, and the reason the code is here.  For a
  parity question — *what did v3 do?* — read `v3/src/`; for the v3 API
  in structured form, `v3/documentation/docmaker.json`; for its prose,
  `v3/documentation/md/**/*.md`.  All of it describes **v3**.
- **Searching:** the repo root carries an `.ignore` file that keeps
  `v3/` out of `rg`/`fd` results by default, because it is ~57% of
  every repo-wide hit.  To search it deliberately:
  `rg --no-ignore -g 'v3/**' <pattern>`.
- **Building and testing:** this is its own project with its own
  `package.json` and lockfile.

  ```
  cd v3 && npm install
  npm run build        # or: npm run build:umd, which the parity diffs need
  npm test
  ```

  Its Playwright project serves port **3334**, deliberately not v4's
  3333, so a stray server cannot feed v4's specs v3's pages.
- **v3's documentation site stays v3's.**  Do not add v4 pages to
  `v3/documentation/`, and do not hand-edit its generated HTML.
