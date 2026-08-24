## Round 46.5 — the status site (planned and landed 2026-08-05)

Inserted at the maintainer's request, ahead of round 46 and outside the
release sequence.  The ask: **a deployable preview of the branch's current
state** — the debug page, the benchmark report, the markdown documents —
compiled into a gitignored directory and served from Cloudflare Pages, with
the benchmark report carrying real provenance about the machine that produced
it.

The premise is worth stating because it explains the shape: v4 has been built
over fifty rounds with no way to *look* at it.  Every artifact that says what
v4 is needs a local checkout, a build and often a GPU, and the three documents
that record the design are markdown in a branch nobody has checked out.

### The four calls taken with the maintainer

1. **Cloudflare builds from git** on every push, rather than a local
   `wrangler` upload.  Everything the site needs must therefore be in the repo
   or buildable there — which is what forces item 3.
2. **Contents**: the harness, the benchmarks and the documents, plus the
   golden gallery and an API-reference *preview*.  Audit reports and a test
   summary were offered and declined.
3. **Benchmarks keep a history**, published deliberately into a tracked
   `benchmark/published/`.  Nothing measures on the builder: no GPU, and the
   quick profile alone is seven minutes.
4. **The oversized fixtures load from their existing NDEx/R2 source** rather
   than being carried or dropped — *superseded the same day by 46.5.7 below,
   which encodes every fixture into v4's binary wire format instead and so
   needs no off-site source at all.*

### What the round measured before designing

Cloudflare Pages caps a file at **25 MiB**, and two fixtures are over it.  The
first plan proposed gzipping them.  Measuring first killed that: the v3
fixtures are *pretty-printed*, the page only ever calls `res.json()`, and
re-serializing gives

| fixture | on disk | minified |
|---|---|---|
| `network-ndex-large.json` | 31.6 MiB | **20.5 MiB** |
| `network-em-desktop.json` | 23.4 MiB | 19.3 MiB — it was at **93.6%** of the cap |
| `network-ndex-x-large.json` | 34.1 MiB | 34.1 MiB, already compact |

So minifying alone takes one of the two under the cap and gives `em-desktop`
headroom nobody had noticed it needed.  With call 4 both NDEx fixtures go
remote anyway, but the measurement stayed: it is why the three
EnrichmentMap/white-matter fixtures ship at 27.4 MiB instead of 37.

### Landed

- [x] **46.5.1 The lockfile** — the root `package-lock.json` still described
  the *pre-split v3 package* (`3.35.0-unstable`, with `handlebars`,
  `gh-pages`, `lodash`, `heap`, `gl-matrix`).  Refreshed: 484 deletions, and
  the only two added lines are the corrected version.  `marked` and
  `highlight.js` — installed by accident through that stale lock — are now
  declared at v3's exact specifiers.  **What it exposed**: the root suite
  genuinely needs `cd v3 && npm install`, because
  `test/modules/benchmark-report.mjs` reaches `v3/src/test.mjs` and so `heap`.
  That had been satisfied by root hoisting.  AGENTS.md now says so.
- [x] **46.5.2 `scripts/machine-info.mjs`** (29 specs) — CPU with the
  physical/logical split and both clocks, RAM, OS, and a GPU **inventory**
  with VRAM.  Three things a first attempt gets wrong and this does not:
  physical cores are `cpu cores` × sockets and not the record count (8 vs 16
  here); `gpus` is a *list*, because this box has two and a single-GPU return
  type looks right on every single-GPU machine; and VRAM joins to a card by
  PCI slot, which `lspci` and `PCI_SLOT_NAME` spell differently.  Deliberately
  absent: a `primary` flag — only WebGPU can say which adapter rendered.
- [x] **46.5.3 Provenance into the report** — `benchmark/run-meta.mjs`, because
  the `meta` block was being built **twice** and this is exactly the round
  that would have updated one of them.  The merge exposed that
  `render-bench.mjs` **captured the WebGPU adapter and threw it away** at the
  `--json` boundary, so a `--renderer` report could not say which GPU it
  measured.  `meta.dirty` is new and renders in the failure colour: a
  measurement from a dirty tree is not attributable to the sha it prints.
  `machineBlock()` returns `''` when `meta.machine` is absent, pinned by a
  spec, because the site re-renders every published run and half of them
  predate this round.
- [x] **46.5.4 `benchmark/published/`** (20 specs) — the tracked archive and
  `npm run benchmark:publish`.  Runs group by **machine fingerprint** and are
  never plotted across machines; `--prune n` is explicit and prints what it
  removes, because silently capping an archive is the invisible truncation
  this file's benchmark rules exist to prevent.  Publishing **refuses a dirty
  tree** without `--allow-dirty`.
- [~] **46.5.5 The harness's remote fixtures** — **built, then removed the same
  day by 46.5.7 below.**  A network could declare a `remoteUrl` which
  `debug/init.js` preferred under `window.DEBUG_FIXTURE_SOURCE = 'remote'`, so
  the two oversized NDEx fixtures loaded from the bucket they came from.  It
  worked, and the live failure it produced was legible (it names **CORS**,
  which is what a browser reports as an opaque `TypeError`) — but the binary
  encoding put every fixture under the cap, and a remote mechanism nothing uses
  is dead config pointing at a key that does not exist.  Removed with its flag
  and its specs.

  One thing from it is worth keeping in mind if a fixture ever
  does outgrow the cap: the bucket's `network-ndex-x-large.json` is the
  **250 MB original** this fixture was slimmed from — same filename, different
  file — so a naive mirror URL would hand a browser a quarter-gigabyte.
- [x] **46.5.6 The site** (52 specs) — `npm run status`, nine generated pages
  plus the harness mirror.  Two structural decisions carry it: **plan then
  execute**, so the specs check the intended output without copying 30 MiB;
  and the **mirror invariant** — every mirrored asset sits at its repo path
  inside the site, so `../build/cytoscape.umd.js` resolves by construction and
  no source file is edited.  Exactly two edits are made to the copied harness
  page and a diff spec closes that list.

### What building it found

- **marked does not escape a code span's `token.text`.**  Overriding the
  `codespan` renderer takes its escaping with it, and `PLAN.md` contains a code
  span holding `<script>` at line 11222 — so it opened a real script element
  and every page after that point stopped working.  **Found by driving a
  browser**, not by reading; the smoke test written minutes earlier had no `<`
  in a code span and passed.  This is the round's clearest vindication of the
  standing "something has to open the page" rule.
- **`@throws` and `@see` are arrays in the docs model while `@returns` is a
  string.**  The API page failed to generate entirely (`e.replace is not a
  function`).
- **A bare `.gitignore` pattern matches at every depth.**  `status` also
  matched `scripts/status/` — the ten modules that *are* the build — so
  `git add -A` staged none of them.  Caught by reading `git status --short`
  before committing, which is the only reason it did not ship a commit that
  could not run.
- **Two controls failed to fail, and both were findings.**  One showed an
  `existsSync` guard was dead code beneath its own `catch`.  The other showed
  a "nothing exceeds the cap" loop was **not discriminating** — with both
  oversized fixtures remote, nothing planned is near the cap — so a spec that
  *measures* the minified size on disk was written in its place and the loop
  kept as a labelled forward guard.
- **The documented-path audit is now continuous.**  A rooted path in a code
  span is checked against the tree, linked to its blob when it resolves and
  marked when it does not.  Eight hits remain, all legitimate: historical
  references in this file, and spellings AGENTS.md quotes as *examples* of the
  round-42 failure.

### 46.5.7 The fixtures went binary, and the prerequisites went away

The round shipped first with the two oversized NDEx fixtures pointed at an R2
bucket, which left the maintainer two manual steps: enable CORS, and upload a
slim copy under a new key.  The maintainer then asked the obvious question —
*what about v4's own binary wire format?* — and the measurement answered it:

| fixture | on disk | minified | **binary** |
|---|---|---|---|
| em-web | 6.1 | 3.4 | **1.2** |
| em-desktop | 23.4 | 19.3 | **15.3** |
| white-matter | 7.2 | 4.7 | **2.1** |
| ndex-large | 31.6 | 20.5 | **9.4** |
| ndex-x-large | 34.1 | 34.1 | **9.5** |
| total | 102.5 | 82.1 | **37.5** |

Every fixture lands under the 25 MiB cap, so **both prerequisites disappeared**
— no bucket, no CORS rule, no off-site dependency, and all nine networks live
in the deploy.  `remoteUrl` and its `DEBUG_FIXTURE_SOURCE` flag were removed
rather than left as dead config pointing at a key that does not exist.

**The number that would have been guessed wrong.**  Gzipped, binary and
minified JSON are within **1%** of each other (7.6 vs 7.7 MiB), and on
`white-matter` binary is *worse*.  Cloudflare compresses on the wire regardless,
so this is a **file-at-rest** win — which is exactly what the cap measures —
plus a parse win, and *not* a transfer win.  "Binary is smaller" is true of the
metric that governs the cap and false of the one that governs load time.

Three implementation calls, each recorded in `scripts/status/wire-fixtures.mjs`:

- **Encode through the built CJS bundle, not `src/`.**  The page decodes with
  exactly the code that encoded it, the build needs no tsx, and the import
  boundary a spec pins stays intact.
- **Encode the output of `toGpuElements`**, the harness's own converter, loaded
  through `node:vm` the way its spec loads it.  Both page paths then converge on
  one shape, and there is no second copy of that transform to drift.
- **A manifest, not a rewrite.**  the generated `status-config.js` maps network id to
  encoded fixture; `init.js` prefers it and falls back to JSON when absent,
  which is what `npm run watch` sees.  A network that fell back is simply not
  in the manifest.

**What building it found, and it is the round's sharpest lesson.**  The first
`fromColumnar` read a *dictionary* column — `{ dict, indices }`, 1-based, 0
meaning absent — as if it were a plain array, so **every string column in every
fixture came back `undefined`**.  The graph still rendered: correct node count,
correct edges, correct positions, and no labels or categorical colours at all.
Nothing throws on that, and no size or count check would have seen it.  The
fidelity spec now asserts that each column still carries values after the round
trip, and its control — read the dict as an array — fails on all five fixtures.

Verified in a browser against the served site: all five encoded networks load,
with exact counts (em-web 569/6899, white-matter 1499/18288, ndex-large
3238/68641, **ndex-x-large 19607/464657**, em-web-clustered 610/6899 — the
`derive` transform still runs on the binary path), and em-web reports **18,600
glyphs, identical to the JSON run**, which is what proves the dictionary
columns survived.

### What the maintainer still owns

Only one step now: **create the Pages project** — branch `v4`, build command
**`npm run status:all`** (`build` -> `docs:api` -> `status`; plain
`npm run status` assembles against whatever bundle is lying around), output
directory `status`, Node from `.nvmrc`.  The root `npm ci` is all the builder
needs; a spec pins that the status build imports nothing from `v3/` or `src/`.

### Risks tracked

- **The site is only as live as its inputs.**  Documents and the harness are
  live from git; benchmarks are as fresh as the last `benchmark:publish`.  The
  landing page therefore prints the run's *age*, not just its date.
- **The API page treads on round 46.**  It is labelled a preview and lives at
  `status/api.html`, not `documentation/`.  When round 46 ships, this page
  should become a link to it rather than a second renderer to maintain.
- **CI's job timeout was removed, not raised** (maintainer request, same day).
  GitHub has no "no timeout", so both jobs fall back to the 360-minute default
  — a runaway backstop rather than a budget.  A real cap should return once the
  suite's wall-clock on a runner is known.
