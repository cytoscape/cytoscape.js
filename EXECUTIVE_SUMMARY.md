# Cytoscape.js v4 — executive summary

The v4 rewrite: a columnar model and a WebGPU renderer, per
[#3486](https://github.com/cytoscape/cytoscape.js/issues/3486).

- **Status**: not released. `cytoscape@3` remains the shipping library.
- **Scope of this record**: the v4 prototype, from **2026-07-22**.
- **Last updated**: 2026-08-12, as round 68 closed.

## How to maintain this file

- **[`PLAN.md`](PLAN.md) is the source; this file is derived from it.** Nothing
  is recorded here that is not recorded there first.
- **Rewrite when a round closes** — by re-reading the record and restating it,
  never by appending.
- **Point form only.** Short points, high level, readable in five minutes.
- **Week by week, and headline changes only.** Each week is a list of what
  changed and **what it buys** — the benefit, not the implementation. A change
  earns a line only if it changed what the library *is* or what it can do; most
  do not.
- **No round narrative.** Rounds, file names, sub-round numbering and
  implementation detail belong in `PLAN.md`. Round numbers appear here only
  where one is the sole handle on an open question.
- **Restate, don't append.** Later rounds routinely change what an earlier
  decision meant, so earlier weeks need correcting too.
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
| Automated tests | 2,205 unit · 427 module · 24 soak · 376 browser (251 run; 125 skip for want of a WebGPU adapter) |
| Documented API | 363 members over 48 sections, gated at 100% |
| Visual regression | 46 goldens compared **exactly** — zero differing pixels · 45 live v3-vs-v4 pixel-parity scenes, 7 of them close-ups at zoom 3–4 · 11 numeric routing-parity scenes · 10 CPU-vs-GPU algorithm-parity scenes |
| Benchmarks | 25 suites, 4 published profiles · **all 366 v3-comparative pairs read v4-faster** (geometric mean 13.7×, minimum 1.03×) · GPU algorithm executors 13× geo-mean over their CPU reference |
| Style parity | v4 accepts 157 of v3's 291 style property names; the rest dropped by decision |
| Bundle | 691 KiB minified / 185 KiB gzipped — ~1.5× v3 (410 / 126 KiB); the WGSL shaders, which v3 has no equivalent of, are minified at build time |
| CI | Green as of 2026-08-06; `npm test` passes from a clean checkout |

---

## Week 1 — 22–24 July

- **A columnar, CPU-canonical model** — typed-array columns, stable slots,
  coalesced dirty spans, a CSR adjacency index. Buys the whole performance
  case: the graph is already in the shape the GPU wants.
- **Reads stay synchronous.** Buys a public API that did not have to become
  async to get the model.
- **A WebGPU renderer** — SDF shapes, compute culling, indirect draws, GPU
  picking, GPU text. Buys interaction on graphs that stall v3: **33 ms frames
  where v3 takes 4,460**.
- **A co-signed model↔renderer contract in one file.** Buys a layout change
  that cannot happen by accident on one side only.
- **Structured queries instead of a selector language.** Buys queries that are
  data — composable, inspectable, no parser.
- **A serializable mapper DSL for style.** Buys paint channels evaluated on the
  GPU, and style that can cross a wire.

## Week 2 — 27 July – 2 August

- **Visible-behaviour parity with v3** — curves, compounds, labels, images,
  animation. Buys an existing app the same picture.
- **Goldens *plus* live v3-vs-v4 parity diffs.** Buys the answer to *is it
  right*, which a golden alone cannot give: goldens compare v4 against its own
  past.
- **Benchmarks with an HTML report.** Buys claims that are numbers.
- **Design sittings, decisions recorded when taken.** Buys a migration guide
  that could later be compiled rather than reconstructed.

## Week 3 — 3–8 August

- **Error and documentation contracts gated at zero tolerance.** Buys a guard
  no test has ever fired failing the build, and a public member without docs
  failing it too.
- **The repository split: v4 is the package, v3 lives whole in `v3/`.** Buys a
  v4 that ships alone, and a real v3 to keep measuring parity against.
- **Packaging gate, migration guide, soak tier, status site.** Buys release
  mechanics that are testable before there is a release.
- **CI made honest.** Buys a green run that means something: every defect found
  was in something never executed on a fresh checkout, on a runner, or in a
  browser nobody could launch locally.

## Week 4 — 9–11 August

- **Both long-standing API decisions taken, each by declining the surface its
  own homework had priced.** Buys a smaller library and a recorded reason.
- **The force layout rebuilt on published methods.** Buys a layout that stays
  numerically stable past node degree ~20, and lays out the 465k-edge network
  live in **1.3 s**.
- **The nine expensive whole-graph algorithms went async with GPU executors.**
  Buys Markov clustering at up to **642×** its CPU reference, k-medoids 146×,
  Floyd–Warshall 28×; the traversal tier stays synchronous.
- **Per-element bypasses returned as a first-class stylesheet section.** Buys
  v3's ergonomics without v3's cost — id-keyed, surviving re-add, carried by
  `cy.json()` (v3 loses them), twice as fast.
- **Cross-commit benchmark comparison pages.** Buys regressions caught by the
  archive rather than by a user: one four-day-old regression on first use.
- **The load path measured, then taken apart.** Buys **1.9×** on the 465k-edge
  load with a byte-identical rendered frame, and initialisation of that network
  in **~0.95 s against v3's ~19 s**.

## Week 5 — 12 August

- **The benchmark runner runs jobs concurrently.** Buys a publishing run of the
  `all` profile in **8.4 minutes instead of ~55**, so re-measuring stops being
  a reason not to measure.
- **Concurrency folded into the harness fingerprint, and the published archive
  kept serial.** Buys the guarantee that a faster *instrument* can never be
  read as a faster *library*.

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
  `executor: 'cpu' | 'gpu' | 'auto'`.
- **`cy.collection()` throws if passed an argument**; **`cy.$()` and
  `cy.byId()`** restored as aliases.
- **Element state** (`:selected`, `:active`, `:grabbed`, …) is ordinary style
  condition rather than a shader constant, so an application can restyle or
  disable every affordance.

## Open decisions

| | |
|---|---|
| `arrow-scale` quantization | Stored at a 1/16 step, so `arrow-scale: 1.4` draws at 1.375. Fixing it spends six spare bits a seventeenth arrowhead shape also wants — one or the other |
| Edge overlay band width | v3 draws the halo `2 × padding` wide (invisible at small paddings), v4 `width + 2 × padding` (always visible). Either resolution changes rendered output |
| Hollow *mid* arrows | Still show the line through them: they sit mid-edge, where a trim cannot reach. May end up unsupported rather than fixed |

## Not yet built

| | |
|---|---|
| Documentation site | Prose to be written by hand; the generated API model is ready |
| Cross-platform validation | macOS/Metal, Windows/D3D12, real-device touch |
| Release engineering | The release workflows are still v3's, and are marked as not yet adapted |
| Release bake | Alpha/beta cycle, external-consumer smoke, then **4.0.0** |

- Logged as directions, unscheduled: per-element style-override *ergonomics*
  through the declarative mapper system; splitting the largest implementation
  files.

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
