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

- Feature scope covered; the work is **hardening, measurement and release
  preparation**.
- CI green as of 2026-08-06, having been red on every push for weeks.
- `npm test` passes from a clean checkout.
- What is left waits on **a decision, another platform, or release
  credentials** — not on unbuilt features.
- An inventory, not a schedule: several rounds v4 needs are not scoped yet.

| | |
|---|---|
| Automated tests | 2,205 unit · 427 module · 24 soak · 376 browser (251 run; 125 skip for want of a WebGPU adapter) |
| Documented API | 363 members over 48 sections, gated at 100% |
| Visual regression | 46 goldens compared **exactly** — zero differing pixels · 45 live v3-vs-v4 pixel-parity scenes, 7 of them close-ups at zoom 3–4 · 11 numeric routing-parity scenes · 10 CPU-vs-GPU algorithm-parity scenes |
| Benchmarks | 25 suites, 4 published profiles · **all 366 v3-comparative pairs read v4-faster** (geometric mean 13.7×, minimum 1.03×) · GPU algorithm executors 13× geo-mean over their CPU reference |
| Style parity | v4 accepts 157 of v3's 291 style property names; the rest dropped by decision |
| Bundle | 691 KiB minified / 185 KiB gzipped — ~1.5× v3 (410 / 126 KiB); the WGSL shaders, which v3 has no equivalent of, are minified at build time |

**Headline case** — a 19,607-node / 464,657-edge network:

- initialises in **~0.95 s against v3's ~19 s**;
- holds **33 ms frames where v3 takes 4,460 ms**;
- lays out live on the GPU force layout in **1.3 s**.

---

## What v4 is

- **A columnar, CPU-canonical model** — typed-array columns, stable slots,
  coalesced dirty spans, a CSR adjacency index.
- Reads stay synchronous, so the public API did not become async.
- **A WebGPU renderer** — SDF node shapes, compute culling, indirect draws, GPU
  picking, GPU text.
- **A co-signed model↔renderer contract** in one file: changing the column and
  flag layout is a deliberate act.
- **Structured queries instead of a selector language** — objects and plain
  functions.
- **A serializable mapper DSL** for style, evaluated on the GPU for paint
  channels.
- Element state (`:selected`, `:active`, `:grabbed`, …) is ordinary style
  condition, not a shader constant — so an application can restyle or disable
  every affordance.

## What changed for users of v3

- *Each removal was a decision with a recorded rationale, not an omission.*
- **Selectors removed** — the largest break for existing apps, and what the
  migration guide leads with.
- **z-index dropped.**
- **Animation queue removed** — concurrency by channel, promises for
  sequencing.
- **display/visibility split** into a structural tier and a paint-only tier.
- **`cy.layout({ impl })` is the whole extension story.**
- **The nine expensive whole-graph algorithms return promises** and take
  `executor: 'cpu' | 'gpu' | 'auto'`; the traversal tier stays synchronous.
- **Per-element bypasses are back** — a first-class `bypasses` stylesheet
  section, id-keyed, surviving re-add, carried by `cy.json()` (v3 loses them),
  twice as fast as v3's.
- **`cy.collection()` throws if passed an argument**; **`cy.$()` and
  `cy.byId()`** restored as aliases.

## Performance

- Every v3-comparative benchmark pair reads v4-faster.
- The published archive and its cross-commit comparison pages keep it that way
  — they caught a four-day-old regression on first use.
- **GPU algorithm executors** on a real adapter: Markov clustering up to 642×
  its CPU reference, k-medoids 146×, Floyd–Warshall 28×, betweenness 18×; only
  PageRank and hierarchical clustering sit in low single digits.
- **The load path**, rebuilt on measurement: **1.9×** on the 465k-edge load,
  rendered frame byte-identical.
- **First frame**: deferring the feature pipelines cut the software-renderer
  first frame from 4.6 s to 2.7 s.
- **The benchmark runner** runs jobs concurrently: an `all`-profile publishing
  run went from ~55 min to **8.4**.
- Concurrency is treated as a change of instrument, not a faster clock: it is
  folded into the harness fingerprint, and **the published archive stays
  serial**.

---

## Timeline

| Week | |
|---|---|
| **1** — 22–24 Jul | Architecture proved end to end. |
| **2** — 27 Jul – 2 Aug | Visible-behaviour parity with v3, and the measurement infrastructure to keep it. |
| **3** — 3–8 Aug | Contracts gated; the repository split so v4 is the package; packaging, migration guide, soak tier, status site; CI made honest. |
| **4** — 9–11 Aug | Both long-standing decisions taken; the force layout rebuilt; the expensive algorithms async onto the GPU; bypasses back; the load path taken apart. |
| **5** — 12 Aug | The benchmark runner stopped using one core of eight. |

---

## Open decisions

| | |
|---|---|
| `arrow-scale` quantization | Stored at a 1/16 step, so `arrow-scale: 1.4` draws at 1.375. Fixing it spends six spare bits a seventeenth arrowhead shape also wants — one or the other |
| Edge overlay band width | v3 draws the halo `2 × padding` wide (invisible at small paddings), v4 `width + 2 × padding` (always visible). Either resolution changes rendered output |
| Hollow *mid* arrows | Still show the line through them: they sit mid-edge, where a trim cannot reach. May end up unsupported rather than fixed |

## What remains before 4.0

| | |
|---|---|
| Documentation site | Prose to be written by hand; the generated API model is ready |
| Cross-platform validation | macOS/Metal, Windows/D3D12, real-device touch |
| Release engineering | The release workflows are still v3's, and are marked as not yet adapted |
| Release bake | Alpha/beta cycle, external-consumer smoke, then **4.0.0** |

- Logged as directions, unscheduled: per-element style-override *ergonomics*
  through the declarative mapper system; splitting the largest implementation
  files.

---

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

---

## Maintaining this file

- **`PLAN.md` is the source; this file is derived from it.**
- **Rewrite when a round closes** — by re-reading the record and restating it,
  never by appending.
- **Point form only**: short points, high level, readable in five minutes.
- **No round narrative.** Rounds, file names and implementation detail belong
  in `PLAN.md`; a round earns a line here only when it changed what the library
  *is*, and most earn none.
- Round numbers appear only where one is the sole handle on an open question.
- **Restate, don't append.** Later rounds routinely change what an earlier
  decision meant, so earlier sections need correcting too.
- **Quote numbers only if they are current.** Test tallies, member counts and
  benchmark figures go stale first; re-run the relevant command (see
  `AGENTS.md`) rather than copying a figure forward.
- **Keep the decisions table honest**: an item leaves it when the decision is
  made, not when the work is scheduled.
- Update *Last updated* and the round it covers.
