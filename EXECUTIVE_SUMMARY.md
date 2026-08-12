# Cytoscape.js v4 — executive summary

The v4 rewrite: a columnar model and a WebGPU renderer, per
[#3486](https://github.com/cytoscape/cytoscape.js/issues/3486).

- **Status**: not released, and not close. `cytoscape@3` remains the shipping
  library.
- **Scope of this record**: the v4 prototype, from **2026-07-22**.
- **Last updated**: 2026-08-12, as round 68 closed.
- **Derived document.** [`PLAN.md`](PLAN.md) is the development record and the
  source of truth; this is the five-minute version — see *Maintaining this
  file*.

---

## Where it stands

- Feature scope is covered; the work is now **hardening, measurement and
  release preparation**.
- CI is green as of 2026-08-06, having been red on every push for weeks;
  `npm test` passes from a clean checkout.
- What is left waits on **a decision, another platform, or release
  credentials** — not on unbuilt features. It is an inventory, not a schedule:
  several rounds v4 needs are not scoped yet, and four that have shipped were
  inserted after the sequence was planned.

| | |
|---|---|
| Automated tests | 2,205 unit · 427 module · 24 soak · 376 browser (251 run; 125 skip for want of a WebGPU adapter) |
| Documented API | 363 members over 48 sections, gated at 100% |
| Visual regression | 46 goldens compared **exactly** — zero differing pixels · 45 live v3-vs-v4 pixel-parity scenes, 7 of them close-ups at zoom 3–4 · 11 numeric routing-parity scenes · 10 CPU-vs-GPU algorithm-parity scenes |
| Benchmarks | 25 suites, 4 published profiles · **all 366 v3-comparative pairs read v4-faster** (geometric mean 13.7×, minimum 1.03×) · GPU algorithm executors 13× geo-mean over their CPU reference |
| Style parity | v4 accepts 157 of v3's 291 style property names; the rest are dropped by decision |
| Bundle | 691 KiB minified / 185 KiB gzipped — ~1.5× v3 (410 / 126 KiB); the WGSL shaders, which v3 has no equivalent of, are minified at build time |

**Headline case** — a 19,607-node / 464,657-edge network:

- initialises in **~0.95 s against v3's ~19 s**;
- holds **33 ms frames where v3 takes 4,460 ms**;
- lays out live on the GPU force layout in **1.3 s**.

---

## What v4 is

- **A columnar, CPU-canonical model** — typed-array columns, stable slots,
  coalesced dirty spans, a CSR adjacency index. Reads stay synchronous, so the
  public API did not become async.
- **A WebGPU renderer** — SDF node shapes, compute culling, indirect draws, GPU
  picking, GPU text.
- **A co-signed model↔renderer contract** in one file: changing the column and
  flag layout is a deliberate act.
- **Structured queries instead of a selector language** — objects and plain
  functions.
- **A serializable mapper DSL** for style, evaluated on the GPU for paint
  channels. Element state (`:selected`, `:active`, `:grabbed`, …) is expressed
  as ordinary style conditions rather than as shader constants, so an
  application can restyle or disable every affordance.

## What changed for users of v3

Each removal was a decision with a recorded rationale, not an omission.

- **Selectors removed** — the largest break for existing apps, and what the
  migration guide leads with.
- **z-index dropped**; the **animation queue removed** (concurrency by channel,
  promises for sequencing); **display/visibility split** into a structural tier
  and a paint-only tier.
- **`cy.layout({ impl })` is the whole extension story.**
- **The nine expensive whole-graph algorithms return promises** and take
  `executor: 'cpu' | 'gpu' | 'auto'`. v4's own shape change, taken before 4.0
  so it costs a migration-guide row rather than a major version; the traversal
  tier stays synchronous by design.
- **Per-element bypasses are back**, as a first-class `bypasses` stylesheet
  section with v3's method spellings as sugar — id-keyed, surviving re-add,
  carried by `cy.json()` (v3 loses them on export), and twice as fast as v3's.
- **`cy.collection()` throws if passed an argument** (v3 builds a collection
  from one); **`cy.$()` and `cy.byId()`** restored as aliases.

## Performance

- Every v3-comparative benchmark pair reads v4-faster. The published archive
  and its cross-commit comparison pages are what keeps that true — they caught
  a real four-day-old regression (bulk selection, 38× faster than v3 → 3.3×
  slower) on their first use, fixed the same day.
- **GPU algorithm executors** on a real adapter: Markov clustering up to 642×
  its CPU reference, k-medoids 146×, Floyd–Warshall 28×, betweenness 18×; only
  PageRank and hierarchical clustering sit in low single digits.
- **The load path** was rebuilt on measurement: definition payloads convert to
  columns before ingest, mapped style costs per distinct value rather than per
  element, and runs of identically styled edges are written once and filled —
  **1.9×** on the 465k-edge load, with a byte-identical rendered frame.
- **First-frame latency**: pipelines compile on first use, so deferring the
  feature pipelines cut the software-renderer first frame from 4.6 s to 2.7 s.
- The benchmark runner now runs jobs concurrently: a publishing run of the
  `all` profile went from ~55 minutes to **8.4**. Concurrency is treated as a
  change of instrument rather than a faster clock — it is folded into the
  harness fingerprint, and **the published archive stays serial**.

---

## Timeline

| Week | |
|---|---|
| **1** — 22–24 Jul | Architecture proved end to end: the columnar model, the WebGPU renderer, the contract, structured queries, the mapper DSL. |
| **2** — 27 Jul – 2 Aug | v3 visible-behaviour parity — curves, compounds, labels, images, animation — and the measurement infrastructure: goldens *plus* live v3-vs-v4 parity diffs, benchmarks, four design sittings. |
| **3** — 3–8 Aug | The densest week. Error and documentation contracts gated at zero tolerance; the repository split so v4 is the package and v3 lives whole in `v3/`; packaging gates, migration guide, soak tier, status site; a CI reckoning that found no library regressions, only things never run in the configuration that matters. Three rounds began with a maintainer opening a page — numeric routing parity, the arrow gap, the cleanup round. |
| **4** — 9–11 Aug | Two prepared decisions taken, both declining the surface their homework had priced; the arrow trim reached labels, strokes and mid arrows; the force layout rebuilt on published methods (it had been numerically unstable past node degree ~20); performance made visible across commits; every benchmark pair v4-faster; bypasses back; the expensive algorithms async onto the GPU; the load path measured, then taken apart. |
| **5** — 12 Aug | The benchmark runner stopped using one core of eight. |

---

## Open decisions

| | |
|---|---|
| `arrow-scale` quantization | Stored at a 1/16 step, so `arrow-scale: 1.4` draws at 1.375. Fixing it spends six spare bits that a seventeenth arrowhead shape also wants — one or the other |
| Edge overlay band width | v3 draws the halo `2 × padding` wide (invisible at small paddings), v4 `width + 2 × padding` (always visible). Either resolution changes rendered output |
| Hollow *mid* arrows | Still show the line through them: they sit mid-edge, where a trim cannot reach. May end up unsupported rather than fixed |

## What remains before 4.0

| | |
|---|---|
| Documentation site | Prose to be written by hand; the generated API model is ready |
| Cross-platform validation | macOS/Metal, Windows/D3D12, real-device touch |
| Release engineering | The release workflows are still v3's, and are marked as not yet adapted |
| Release bake | Alpha/beta cycle, external-consumer smoke, then **4.0.0** |

Logged as directions, unscheduled: per-element style-override *ergonomics*
through the declarative mapper system, and splitting the largest implementation
files.

---

## How this project works

1. **A control for every claim** — each test is run once with the behaviour it
   checks deliberately broken, to prove it can fail. This has repeatedly caught
   tests that asserted nothing; controls that *failed to fail* have exposed
   dead code.
2. **Measure, don't remember** — statements about the code are re-verified, not
   inherited. Three consecutive rounds were handed a "fact" from the record
   that had quietly stopped being true.
3. **Decisions are written down when taken**, with their rationale — which is
   why the migration guide could be compiled rather than reconstructed.
4. **Run it where it will actually run** — every defect in the CI rounds was in
   something never executed on a fresh checkout, on a runner, or in a browser
   nobody could launch locally. The same idea explains why several rounds began
   with a person opening a page.
5. **A change that should be invisible is the best test of the tools that watch
   for changes** — reformatting every source file could not alter behaviour,
   and exposed four defects in the audits themselves.

---

## Maintaining this file

**`PLAN.md` is the source; this file is derived from it.** Rewrite it when a
round closes — by re-reading the record and restating it, never by appending.

- **Keep it an executive summary**: point form, high level, readable in five
  minutes. Rounds, file names and implementation detail belong in `PLAN.md`; a
  round earns a line here only when it changed what the library *is*, and most
  earn none. Round numbers appear only where one is the sole handle on an open
  question.
- **Restate, don't append.** Later rounds routinely change what an earlier
  decision meant, so earlier sections need correcting too.
- **Quote numbers only if they are current.** Test tallies, member counts and
  benchmark figures go stale first; re-run the relevant command (see
  `AGENTS.md`) rather than copying a figure forward.
- **Keep the decisions table honest**: an item leaves it when the decision is
  made, not when the work is scheduled.
- Update *Last updated* and the round it covers.
