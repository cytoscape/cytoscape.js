# Cytoscape.js v4 — executive summary

The v4 rewrite: a columnar model and a WebGPU renderer, per
[#3486](https://github.com/cytoscape/cytoscape.js/issues/3486).

- **Status**: not released. `cytoscape@3` remains the shipping library.
- **Scope of this record**: the v4 prototype, from **2026-07-22**.
- **Last updated**: 2026-08-19, after the mid-August planning wave (last
  landed work: 12 Aug).

## How to maintain this file

- **The development record is the source; this file is derived from it.** That
  record is the round files under `plan/rounds/`, indexed in `plan/INDEX.md`,
  plus [`PLAN.md`](PLAN.md)'s standing sections. Nothing is recorded here that
  is not recorded there first.
- **This is the only cross-round summary of the work, by design** (round
  108.8). `PLAN.md` used to carry a second one and it silently stopped at
  round 64; the duplicate was removed rather than revived, which makes the
  rule below the thing keeping this history current.
- **Rewrite when a round closes** — by re-reading the record and restating it,
  never by appending.
- **Point form only.** Short points, high level, readable in five minutes.
- **Day by day, headline changes only.** Each day is a list of what changed and
  **what it buys** — the benefit, not the implementation. A change earns a line
  only if it changed what the library *is* or what it can do; most do not.
- **No round narrative.** Rounds, file names, sub-round numbering and
  implementation detail belong in the round files. Round numbers appear here
  only where one is the sole handle on an open question.
- **Restate, don't append.** Later work routinely changes what an earlier
  decision meant, so earlier days need correcting too.
- **Facts, not judgement.** The numbers table below stays current; assessments
  of how close a release is, what is "left", or whether the work is on track do
  not belong here — they need information this file does not carry.
- **Quote a number only if it is current.** Test tallies, member counts and
  benchmark figures go stale first; re-run the relevant command (see
  `AGENTS.md`) rather than copying one forward.
- **Keep the decisions table honest**: an item leaves it when the decision is
  made, not when the work is scheduled.
- Update *Last updated* and the round it covers.

---

## Where it stands

| | |
|---|---|
| Automated tests | 2,245 unit · 467 module · 24 soak · 396 browser (some skip for want of a WebGPU adapter) |
| Documented API | 325 members over 46 sections, gated at 100% — round 90's review removed or demoted the rest of the parity pass's accidental surface |
| Visual regression | 46 goldens compared **exactly** — zero differing pixels · 45 live v3-vs-v4 pixel-parity scenes, 7 of them close-ups at zoom 3–4 · 11 numeric routing-parity scenes · 20 CPU-vs-GPU algorithm-parity scenes |
| Benchmarks | 25 suites, 4 published profiles · **all 366 v3-comparative pairs read v4-faster** (geometric mean 13.7×, minimum 1.03×) · GPU algorithm executors 13× geo-mean over their CPU reference |
| Style parity | v4 accepts 157 of v3's 291 style property names; the rest dropped by decision |
| Bundle | 691 KiB minified / 185 KiB gzipped — ~1.5× v3 (410 / 126 KiB); the WGSL shaders, which v3 has no equivalent of, are minified at build time |
| CI | Green as of 2026-08-06; `npm test` passes from a clean checkout |

---

## Day by day

- **22 Jul** — the whole stack, stood up in one day
  - Columnar store, model↔renderer contract, core facade, collections, events,
    viewport, compiled style engine, grid layout, WebGPU pipeline, GPU picking,
    pointer interaction, SDF labels, debug harness.
  - Buys the architecture proved end to end before any of it was polished.
- **23 Jul** — the model earns its shape
  - Packed numeric keys for set operations, columnar flag scans, id-index
    selector resolution, slot-native traversal.
  - Buys v3's own API measuring faster on v4, not just its drawing.
- **24 Jul** — style becomes data
  - Mapper spec compile, scale programs, OKLab colour and named schemes,
    ordinal dictionaries, GPU evaluation of scalar and colour channels.
  - Buys paint that never round-trips through the CPU, and style that can cross
    a wire.
- **27 Jul** — visible-behaviour parity, in one sitting
  - Search, path, structure and centrality algorithms; polygon shapes; line
    styles; label visuals; edge labels; one easing layer; the gesture family
    (cxttap, taphold, dbltap, drag-all-selected); mount/unmount; device-loss
    recovery.
  - Buys an existing app the same picture and the same interactions.
- **28 Jul** — measurement infrastructure
  - A single-page benchmark report, and browser renderer benchmarks putting v3
    canvas against v4 WebGPU.
  - Buys claims that are numbers.
- **29 Jul** — memory comes back
  - String-dictionary and id-blob compaction, CSR adjacency rebuild.
  - Buys a long-running session that does not keep the graph it removed.
- **30 Jul** — curved edges
  - Curve parameters, route pipeline, arrows on end tangents, labels at route
    midpoints, exact accessors, haystack and manual endpoints.
  - Buys v3's whole edge vocabulary.
- **31 Jul** — compound graphs
  - Hierarchy model, lifecycle, auto-bounds, ancestor-gated visibility, event
    bubbling, parent draw/cull/pick, compound layouts and loop edges; end
    labels on v3's 3×3 grid.
  - Buys nested graphs, which most real applications use.
- **1 Aug** — the layout leaves the main thread
  - The force layout on the extension contract with a GPU integrator; touch
    gestures; the display/visibility split; style transitions; slot compaction.
  - Buys layout that does not freeze the page, and a hide that costs only
    paint.
- **2 Aug** — the visual vocabulary completed
  - Every remaining v3 node shape and arrowhead, v3's nonlinear arrow sizing,
    size/width/font/padding tweens, shipped TypeScript declarations.
  - Buys a stylesheet that ports without a lookup table of what is missing.
- **3 Aug** — contracts gated, hot paths fixed
  - Documentation and error contracts gated at zero tolerance; the style read
    path's 150-case switch became a dispatch table; memoized collections;
    O(1) `indexOf`.
  - Buys a build that fails on an undocumented member or an untested guard, and
    a worst-case style read 2.6× faster.
- **4 Aug** — v4 becomes the package
  - The repository split so v4 is the package and v3 lives whole in `v3/`; v4's
    own event emitter; packaging gates; the docs generator; the debug harness
    rebuilt.
  - Buys a v4 that ships alone, and a real v3 to keep measuring against.
- **5 Aug** — robustness and publication
  - The soak tier (leaks, churn, wire fuzzing, multi-instance isolation); the
    status site; machine provenance and a tracked benchmark archive; fixtures
    shipped in v4's binary wire format.
  - Buys a deployable preview of the branch, and a benchmark history that
    survives the machine that produced it.
- **6 Aug** — CI made honest
  - Fresh-checkout failures fixed, bundles built before the suite; v3's arrow
    gap and spacing constants ported; feature pipelines built on first draw.
  - Buys a green run that means something, and a first frame of 2.7 s where it
    had been 4.6.
- **7 Aug** — parity found by measuring, not by looking
  - Numeric routing parity (geometry, not pixels); the arrow gap; element state
    (`:selected`, `:active`, `:grabbed`) as ordinary style condition rather than
    a shader constant; v3's selection colours.
  - Buys differences 400× below the pixel bound being caught, and every
    affordance being restyleable or disableable by an application.
- **8 Aug** — the things you click
  - v3's hit halos, arrowheads as hit targets, `:active` on edge press;
    border-style and outline-style on every shape; minified WGSL; directional
    fit bounds.
  - Buys edges that are clickable again, and smaller shipped shaders.
- **9 Aug** — every benchmark pair reads v4-faster
  - State flips write the diff rather than the element; the force layout made
    stable by construction; cross-commit benchmark comparison pages.
  - Buys performance visible across commits — the pages caught a four-day-old
    regression on first use.
- **10 Aug** — the expensive algorithms go async, onto the GPU
  - Nine whole-graph algorithms return promises and take
    `executor: 'cpu' | 'gpu' | 'auto'`, with WGSL kernels and a performance
    pass; per-element bypasses returned as a stylesheet section;
    `cy.collection()` throws on an argument, `cy.$()` and `cy.byId()` return.
  - Buys Markov clustering at up to **642×** its CPU reference, and v3's bypass
    ergonomics at twice v3's speed.
- **11 Aug** — the load path taken apart
  - Definition-form payloads convert to columns before ingest; mapped style
    costs per distinct value; a run of identically styled edges is written once;
    the benchmark comparison learned harness epochs, repeat medians and
    screened movers.
  - Buys **1.9×** on a 465k-edge load with a byte-identical frame, and a
    comparison page that can tell a change from its own noise.
- **12 Aug** — the instrument
  - The benchmark runner runs jobs concurrently; concurrency is folded into the
    harness fingerprint and the published archive stays serial.
  - Buys a publishing run in **8.4 minutes instead of ~55**, with no way to
    mistake a faster instrument for a faster library.
- **12 Aug** — the matmul-first algorithm families
  - Markov clustering leads the GPU benchmark because its inner loop is a
    dense matrix product; four families were built to that shape: triangle
    counting / clustering coefficients / transitivity (A²∘A), neighborhood
    similarity (A·Aᵀ), Katz centrality, and a GPU path for whole-collection
    closeness centrality that folds each distance row on the device — n floats
    read back instead of the n² matrix.  Whole-collection closeness joined the
    async tier (a public API change); the three other families are v4-only
    surface.  'auto' gates the A²∘A families on *density* — their sparse CPU
    walks own sparse graphs however large — and never routes Katz to the GPU,
    the pageRank verdict for the same iteration shape.
  - Buys three algorithms v3 never had, on kernels the suite already trusts;
    each of the five new parity specs was proven able to fail by degrading its
    kernel; crossover numbers await the benchmark machine.
- **12 Aug** — the propagation tier: network biology's algorithms
  - Five more families, chosen by scientific usefulness: random walk with
    restart (seed propagation — the disease-gene-prioritization primitive —
    plus the all-pairs proximity matrix), heat-kernel diffusion (HotNet-style
    exp(−tL), seed and all-pairs forms), effective resistance / commute time
    (Laplacian pseudo-inverse: f64 elimination on the CPU, Newton–Schulz
    matmuls on the GPU — O(n³) both sides, so the GPU wins at every density),
    SimRank, and the sixteen-class triad census ('030T' is the biology
    literature's feed-forward loop), whose closed forms are pinned by a
    brute-force classify-every-triple spec.  Seed forms are CPU-only by
    design — O(E) walks with nothing for a kernel to win.
  - Buys the network-biology propagation toolbox on the existing kernel
    machinery; five more parity specs, each proven able to fail; measured on
    an M2: RWR proximity 119×, SimRank 45× at n=1024.
- **24 Aug** — verification goes quiet for agents
  - Every verification script gained a `:quiet` twin (`npm run -s
    test:quiet` and friends) that prints only actual failures: a green run
    is zero bytes — measured, a green `test:node` had been ~3,800 lines /
    ~226 KB of pass marks — and a red run prints the failing tests' blocks
    and nothing else.  A failures-only `node:test` reporter, a
    capture-and-replay wrapper for tools with no quiet mode, a Playwright
    twin, and a gate that keeps each quiet script identical to its loud
    original modulo the reporter flag, so the pairs cannot drift.  CI and
    the interactive debug scripts stay loud deliberately.
  - Buys agent context spent on failures instead of on green; the first full
    quiet run proved the point by printing exactly one real failure (a
    planned-paths gate its own new files had tripped) and nothing else.
- **24 Aug** — the parity pass audited: the API sheds what it never meant to ship
  - The early rounds copied v3's surface aggressively, and the bill came due:
    the public tier carried members v3 itself kept internal.  A new
    member-grained `@internal` tag now runs through the coverage scanner, the
    docs generator and the shipped declaration (which oxc already half
    honored, unnoticed); the maintainer ruled on every headline member.
    Removed: `forceRender`, `onRender`/`offRender`, `mutableElements`,
    `batchData`, and the `bind`/`unbind`/`listen`/`unlisten` listener
    aliases — the event surface now follows Node's `EventEmitter` spellings,
    plus `pon`.  Demoted to internal: `renderer()` (with a new public
    `cy.stats()` snapshot in its place), `instanceString`, the silent
    position writes, the style-engine and animation machinery, and the
    whole `Viewport` class.
  - Buys a typed surface that matches intent — 460 → 355 public members, the
    declaration 9,695 → 8,387 lines — with every removal a MIGRATING row and
    every demotion still working at runtime.
- **24 Aug** — the repo itself is made workable by an agent
  - The instructions, the record and the search results were all costing
    more than the work.  `AGENTS.md` — which both Codex and Claude Code load
    verbatim before a session knows what it is for — went from **62,818 to
    10,303 bytes** (~15.7k to ~2.6k tokens), with every hard-won lesson
    moved *verbatim* into five `docs/agents/` notes and a routing table
    keyed by what you are about to do put in their place.  The 1.5 MB
    development record — past what any agent can open — became one file per
    section under `plan/rounds/`, verified byte-identical to the original
    (1,524,666 bytes over 146 files) and still published as one page.  v3,
    which is 821 of 1,290 tracked files and ~57% of every search hit, is
    now declared frozen in its own nested `AGENTS.md` and skipped by
    default in search (`style`: 462 hits to 186).
  - One live defect fell out of the review: a Claude Code worktree left
    behind after an earlier round put **141 of 278 files into `npm pack`**
    and had turned `test:modules` red, because `.npmignore` is a denylist
    with no entry for a directory that did not exist when it was written.
    Fixed, gated, and the closing sweep now checks `git worktree list`.
  - Buys a named inner loop (`npm run -s verify`, 9.6 s against the
    88-second gate) and four new gates that keep all of the above from
    growing back: a byte budget on `AGENTS.md`, its paths and script names
    checked, and the record's index held in step with its files.
- **25 Aug** — the record is made skimmable
  - `PLAN.md` stopped summarising itself (round 108.8): the round-by-round
    prose at its head was a third copy of a history two better-kept
    documents already hold, and the only copy nothing obliged anyone to
    update — it had stopped at round 64 while 44 further rounds landed.
  - Every section heading became a **title** rather than a label (round
    108.9).  109 of 149 opened with `Round N`, 94 carried a parenthetical
    lifecycle date, and all of it was already in the filename; headings
    now average **33.9 characters, down from 72.6**, and the filename took
    a `kind` field (`plan` / `landed` / `note`) so nothing reads metadata
    out of prose any more.
  - Buys an index you can scan for the section you want, and three prose
    regexes deleted in favour of one filename parse.

---

## What changed for users of v3

- *Each removal was a decision with a recorded rationale, not an omission.*
- **Selectors removed** — the largest break for existing apps, and what the
  migration guide leads with.
- **z-index dropped.**
- **Animation queue removed** — concurrency by channel, promises for
  sequencing.
- **display/visibility split** into a structural tier and a paint-only tier.
- **`cy.layout({ impl })` is the whole extension story.**
- **The expensive whole-graph algorithms return promises** and take
  `executor: 'cpu' | 'gpu' | 'auto'` — including, since 12 Aug, the
  whole-collection `closenessCentralityNormalized`; the single-root form
  stays synchronous.
- **Eight algorithm families v3 never had**, on the same executor
  contract: `triangleCount`, `neighborhoodSimilarity`, `katzCentrality`,
  `randomWalkWithRestart` (+ its all-pairs proximity form),
  `heatDiffusion`/`heatKernel`, `effectiveResistance`, `simRank` and
  `motifCensus`.
- **`cy.collection()` throws if passed an argument**; **`cy.$()` and
  `cy.byId()`** restored as aliases.
- **The round-90 API review** (24 Aug): `forceRender`, `batchData`,
  `mutableElements`, `onRender`/`offRender` and the jQuery-era
  `bind`/`unbind`/`listen`/`unlisten` aliases are gone; listener
  spellings follow Node's `EventEmitter`, plus `pon`; `cy.stats()`
  replaces `cy.renderer().stats()`.

## Open decisions

| | |
|---|---|
| `arrow-scale` quantization | Stored at a 1/16 step, so `arrow-scale: 1.4` draws at 1.375. Fixing it spends six spare bits a seventeenth arrowhead shape also wants — one or the other |
| Edge overlay band width | v3 draws the halo `2 × padding` wide (invisible at small paddings), v4 `width + 2 × padding` (always visible). Either resolution changes rendered output |
| Hollow *mid* arrows | Still show the line through them: they sit mid-edge, where a trim cannot reach. May end up unsupported rather than fixed |

## Not yet built

The release path:

| | |
|---|---|
| Documentation site | Prose to be written by hand; the generated API model is ready — including install instructions for npm, pnpm, yarn, bun and Deno |
| Cross-platform validation | macOS/Metal, Windows/D3D12, real-device touch |
| Release engineering | The release workflows are still v3's, and are marked as not yet adapted |
| Release bake | Alpha/beta cycle, external-consumer smoke, then **4.0.0** |

The planned queue — each item has a written plan under `plan/rounds/`,
verified against the source before planning (the mid-August planning wave):

| | |
|---|---|
| Screen-pass fixes | Seven rendering/interaction defects found by driving the debug page, each mechanism pinned before planning: transient resize distortion, the too-conservative compound fit, curve smoothness spent where the bend is, label fidelity under zoom, node outlines drawn over the ink, the classic compound demo's look restored, and pick order (leaf beats edge beats parent) |
| Edge-layer polish | Stroke caps and corners, arrowhead reach, and pointer cursors that say what a gesture will do |
| API review | The v3-parity surface audited member by member, now that the foundation exists to judge it |
| Runtimes beyond Node | Bun and Deno first-class: a gate pinning that the source imports no runtime built-ins (true today, unenforced), a smoke tier running the built bundles on all three runtimes in CI, Deno's native WebGPU driving the GPU algorithm executors, then a scoping pass over other environments (edge workers, React Native, Electron) |
| Extension toolchain | `cyext`: scaffold, build, test and publish an external extension from one tool, with a template and a real example layout package |
| Exports & interop | SVG vector export; headless figure generation in plain Node (the cytosnap replacement); official JSON schemas for the public data formats |
| Visual features | Per-node charts (radial heat and bars); an annotations layer; cluster hulls and collapse/aggregation proxies; GPU edge bundling |
| App affordances | Attribute-table and filter fast paths (the Cytoscape Web case); a DX polish bundle; a small style-wins bundle |
| Layouts | Radial layout, force constraints, edge-length control, per-side padding; packing made reusable and the layout→renderer handoff decoupled from animation |
| Performance follow-ups | The algorithm-tier follow-up list, gathered and re-verified; a worker-pool CPU executor for the per-source-parallel algorithms |
| WebGL2 fallback | Scoped: what a browser without WebGPU gets |
| Ecosystem rounds | Six plans serving the flagship apps, approved in direction and awaiting refinement: transient hover emphasis without per-mousemove restyles, progressive chunked loading (a first frame before the last byte), priority-driven label decluttering, parallel-edge scale plus a real GeneMANIA fixture, multiple views over one store (the minimap seam), and an id-keyed `patch()` reconcile for server-driven data refreshes.  Decided alongside: CX2 conversion stays extension territory, not core |
| Worker-hosted renderer | The renderer moved off the main thread via OffscreenCanvas |

- Logged as directions, unscheduled: splitting the largest implementation
  files, and a fresh idea-ledger sweep of ~20 further candidates awaiting
  scheduling.

## How this project works

1. **A control for every claim** — each test run once with the behaviour it
   checks deliberately broken, to prove it can fail.
2. **Measure, don't remember** — statements about the code are re-verified, not
   inherited.
3. **Decisions are written down when taken**, with their rationale.
4. **Run it where it will actually run** — a fresh checkout, a runner, a real
   browser, a person opening the page.
5. **A change that should be invisible is the best test of the tools that watch
   for changes.**
