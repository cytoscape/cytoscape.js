# Cytoscape.js v4 — executive summary

The v4 rewrite: a columnar model and a WebGPU renderer, per
[#3486](https://github.com/cytoscape/cytoscape.js/issues/3486).

- **Status**: not released. `cytoscape@3` remains the shipping library.
- **Scope of this record**: the v4 prototype, from **2026-07-22**.
- **Last updated**: 2026-09-02, after the performance review: the full
  benchmark suite re-measured against the 13 Aug baseline, the one pair
  at parity fixed, and the instrument repaired where it had let an hour
  of measurement compare two Node versions.

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
| Automated tests | 2,362 unit · 588 module · 24 soak · 444 browser (some skip for want of a WebGPU adapter) · a cross-runtime smoke (138 assertions per runtime) |
| Documented API | 326 members over 46 sections, gated at 100% — round 90's review removed or demoted the rest of the parity pass's accidental surface |
| Visual regression | 49 goldens compared **exactly** — zero differing pixels · 48 live v3-vs-v4 pixel-parity scenes, 9 of them close-ups at zoom 3–4 · 12 numeric routing-parity scenes · 20 CPU-vs-GPU algorithm-parity scenes |
| Benchmarks | 25 suites, 4 published profiles · **all 373 v3-comparative pairs read v4-faster** as of 2 Sep — 269 core/collection pairs at geometric mean 10.7×, minimum 1.02×, plus 104 renderer pairs at 31× · GPU algorithm executors 7.7× geo-mean over their CPU reference across the whole 57-pair sweep (small sizes included) |
| Style parity | v4 accepts 161 of v3's 291 style property names (round 85.4 restored the per-side padding quartet); the rest dropped by decision |
| Bundle | 691 KiB minified / 185 KiB gzipped — ~1.5× v3 (410 / 126 KiB); the WGSL shaders, which v3 has no equivalent of, are minified at build time |
| Runtimes | Node ≥ 24, Bun ≥ 1.4 and Deno ≥ 2.9 run the built bundles headless — gated by an import-cleanliness clause, a value-asserting smoke over ESM/ESM-min/CJS, and CI |
| CI | Green as of 2026-08-06; `npm test` passes from a clean checkout; since 28 Aug the bundles are smoked under Bun and Deno per push, at latest stable plus a pinned floor |

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
- **26 Aug** — the renderer leaves the main thread (round 86)
  - Measure-first gate (86.1): the worst-case per-frame copy — the whole
    position column crossing the thread boundary — is **0.035 ms** at
    harness scale, so the copy design was committed and the
    SharedArrayBuffer tier declined with the measurement recorded.
  - The seam (86.2): the renderer takes everything through one
    `RenderHost` (`src/render/host.mts`) and speaks slots and pick ids
    only; behaviour-neutral, all 45 goldens exact-zero.  The same seam is
    what a WebGL fallback (round 73) or a headless-Node renderer mounts
    through.
  - The worker host (86.3): `renderer: { worker: true }` runs the same
    engine in a worker over a transferred OffscreenCanvas, fed by
    transferable span batches; the canonical store, sync picks, the
    canvas element and the animation clock stay main-side.  Worker-vs-main
    exports diff exact-zero on the pinned adapter.  Pass-1 deferrals
    recorded: worker background images, GPU tweens/force across the
    boundary, page @font-face labels.
  - Measured (86.4): under a saturated main loop the worker host painted
    **236 of 240 frames against same-thread's 120** at equal main-thread
    busyness; costs are ~0.7 ms/frame of batch traffic and +0.6 ms pick
    round trip.  On this real-GPU box the renderer's own main-thread cost
    was already ~0.2 ms/frame, so the win is cadence isolation, not
    occupancy — the recommendation stays opt-in and post-4.0.
- **26 Aug** — the record says which rounds landed (round 111)
  - Thirty-three rounds that had shipped sat in files still named `plan`,
    because the filename convention arrived at round 108.7 and the rounds
    before it had their plan amended in place — round 10's own file opens
    `**Round complete (2026-07-27)**`.  Read through the index, the planned
    queue looked three times its real size.
  - Renamed on the evidence in each file; five pre-108.2 rounds merged into
    the one-file-per-round shape; three planning sweeps re-kinded from
    `landed` to `note` — filed as landed, they had marked seventeen unbuilt
    rounds as shipped.
  - Buys a generated "Which rounds landed" table in `plan/INDEX.md` and two
    gates that keep it honest: a `plan` file may not record its own landing,
    and no round may be filed as both a plan and a landed record.
- **26 Aug** — the record answers for itself: a spec that diagnoses, a ledger swept
  - Round 109 was planned as a hunt for a harness sensitivity and measurement
    falsified its premise: the invocation it blamed cannot run at all (no spec
    imports the test shim, so the unpreloaded form dies at `describe is not
    defined`).  What is real is an intermittent full-tier failure of one force
    layout spec, at a value identified as **exactly** the non-spectral seed's
    result — which rules out the whole family of explanations two earlier
    rounds had reached for, since nothing in that code path reads global state
    or the clock.  It is instrumentation-shy (0 failures in 20 probed runs),
    so the round left the diagnosis in the spec: on failure it re-measures the
    other path in the same process and names which failure happened.
  - The open-calls ledger was swept for the first time in sixteen days and
    fourteen rounds.  One decided-but-undone action was finally done (a
    comment the maintainer ruled on 2026-08-06); one item's "first
    measurement" was taken rather than described; two calls that lived only
    inside round records joined the ledger.
  - Buys a failure that reports instead of puzzling — three rounds had read
    the same bare assertion and each guessed a different mechanism — and a
    ledger that is again what it claims to be: the one place a question
    waiting on the maintainer can be found.

- **27 Aug** — what you see is what you pick
  - Round 97: a click on an edge crossing a compound parent's body selected the
    *parent*.  The renderer draws every parent in one stream **under** the edges,
    so picking was answering with the thing drawn underneath — the one place it
    contradicted its own "what you see is what you pick" contract.  Picking now
    resolves **leaf, then edge, then parent**, the reverse of the draw order, and
    `cy.pick()` states that order as contract where nothing had written it down.
  - Both of the round's open questions went to the maintainer with the two
    libraries' draw orders measured first, which was the point: the plan's
    premise about the nested case was backwards.  v4 has no "edge layer" that
    parent bodies sit above, and v3's interleave-by-depth follows from
    `z-index` / `z-compound-depth` — dropped from v4 on 1 Aug.  So there was no
    v3 tie-break left to match, and the flat rule (depth changes nothing) is the
    only one consistent with what v4 draws.
  - The plan's other claim — that both gesture seats route through the same pick
    — was false for the press seat, and the spec caught it: `cy.pick` said
    "edge" while the click still selected the parent.  A parent grab is now
    *provisional* (it starts instantly, so dragging a cluster keeps its feel,
    and is dropped if an edge outranks it), and a release that has not moved
    waits for that answer before it taps.
  - Buys the reported defect fixed at the seat where it was felt, an ordering
    users can rely on rather than infer, and one recorded deviation: an app that
    relied on a deeply nested v3 parent out-ranking a shallower edge now gets
    the edge.
  - Round 89: the canvas now says what a gesture will do.  Neither library set
    a CSS cursor anywhere, so a graph canvas showed the browser default through
    panning, dragging and box selection alike.  It carries the standard pair
    now — `grab` over a draggable node, `grabbing` while it or the background
    moves — plus `pointer` over anything else clickable and `crosshair` while
    boxing, and it keeps the affordance during a drag that leaves the canvas.
  - The compatibility decision is what shapes it: v3 apps set cursors
    themselves, from `mouseover`/`mouseout` on the container, and v4's canvas
    fills that container — so **idle over background writes nothing at all**,
    leaving the app's own cursor in force wherever v4 has nothing to say.
    `pointerCursors: false` turns the writer off outright, and an object
    overrides individual states.  A touch pointer never gets a cursor.
  - The plan said to hook seven specific gesture transitions; the code derives
    the cursor after *every* pointer event instead, because the press state is
    cleared in six places and three of them are touch paths no enumeration had
    listed — each a sticky "grabbing" waiting to happen on a hybrid device.
  - Buys the affordance every other graph canvas has, without taking the one
    a ported v3 app already sets.

- **28 Aug** — a round that shipped nothing is still closed (round 111.1)
  - Round 111 taught the record to say which rounds landed, and missed the one
    that ended by deciding to build nothing.  Round 40's design sitting closed
    the error-policy question on 9 Aug — no `cytoscape.warnings()`, no
    `errorPolicy`, no re-tiering, with the 198-site taxonomy left as the
    recorded rationale for the fail-loudly contract standing whole — and every
    form the gate knew looks for evidence that something *shipped*.
  - So the generated table read `planned 40` for nineteen days while another
    section of the same record already read "~~Round 40~~ closed with no new
    surface", and this summary had never listed it as pending.  The derived
    view is trusted because it cannot go stale, which makes an incomplete
    input the most confidently wrong thing in the repo.
  - Buys `landed 7–48` running unbroken, and a third clause in the gate — a
    `plan` file may not record its own *close* either — matched against the
    file's own round number, so round 79's item-level "ships nothing" does not
    close round 79.

- **28 Aug** — the v3-default `eh`, restored by bypasses (round 96)
  - The maintainer's screen-pass report that `eh` "seems not quite right" on
    `?network=v3-default`, closed with the renderer exonerated: given v3's
    exact parameters, v4 routes the curve identically to the last float.  The
    sheet was the defect — the list-valued curve props take constants only, so
    the port had collapsed v3's four per-edge arrays to one per family and
    `eh` drew a different curve entirely.
  - A round-63 bypass entry is a per-element constant, which is exactly what a
    per-edge array is — for the list props the bypass is the *only* per-edge
    spelling, and the sheet now carries v3's four arrays that way, pinned by a
    spec whose `ed`/`eh` numbers are v3's own (probe-verified, exact).  Half
    the recorded deviation turned out never visible: the family constants
    *were* `ab`'s and `bc`'s arrays.
  - The routing-parity suite gains its first segment-family scene — v3's
    arrays verbatim plus mixed-sign and extrapolated-weight cases, the v4 side
    parameterised through bypasses — measured clean at 50 fields, max delta
    2.55e-6 model px.  The edge-types demo's two unbundled-bezier rows draw
    different curves again by the same mechanism, and `MIGRATING.md` names
    bypasses as the porting path for per-edge list-prop arrays.

- **28 Aug** — the compound fit, from conservative to exact (round 92)
  - The maintainer's screen-pass report that the compound fixture "does not
    fit to screen properly", closed at its cause: the fit scan's conservative
    compound-loop bound over-framed the fixture 1.23×, and because its slack
    grew up-left only, `fit` — which centers the box it is given — sat every
    compound graph visibly down-right.  An over-frame reads as "zoomed out a
    bit"; an off-center over-frame reads as "fit is broken", which is what
    was reported.
  - The fix extends the tier round 54 had already built for taxi: every
    box-bounded curve kind (compound loops, taxi, extrapolated weights) now
    reads the exact memoized curve box in both CPU fit-scan sites, so the
    conservative terms — and both defects — are deleted rather than tuned.
    The fixture fits at the exact box's own zoom (0.874 → 1.077), centered
    to the pixel, with a centering assertion standing where none had been.
  - Freshness is structural, not margin-based: every input the geometry
    reads writes through the same epoch that invalidates the memo, checked
    setter by setter.  The warm scan got 4× faster in the bargain (a fresh
    memo now answers without evaluating the curve); a straight-edge graph's
    scan is untouched, and the one cost — a cold scan's first pass over the
    affected kinds — was measured and recorded, not assumed away.
  - Buys compound graphs that fill the screen a fit was asked for, on real
    data and the fixtures alike.

- **28 Aug** — the outline goes under the ink (round 95)
  - The maintainer's screen-pass report that label outlines cut white notches
    into the previous letters of a word, closed at its mechanism: glyph quads
    overlap by construction, and the one-pass label draw composited each
    glyph's opaque outline ring over the previous letter's already-blended
    fill.  v3 strokes the whole line and fills over it; v4 now draws every
    label stream's outline coverage first and every fill over it — two
    specializations of the one label shader, same instances, no new buffers.
  - Priced before landing, on the renderer bench's new outlined twin of the
    wrapped-label scene: outline-free rendering is unchanged against the
    published baseline to the microsecond (streams without an outlined glyph
    skip the extra pass before any GPU work), and outlines cost +0.087 ms
    (+1.5%) of device time at the zoomed-in label view.
  - Two measurements the coverage keeps: the notches are a zoom-1-scale
    artifact of the outline cap's anti-aliasing fringe (the pre-fix close-up
    at zoom 4 differs by only 15 px, so the zoom-1 golden carries the
    discrimination), and the v3 parity ratio is blind to outline defects
    outright — outline presence is asserted by an inked-pixel floor instead,
    which separates the two decisively where the ratio measures nothing.
  - One recorded deviation: the split is global across labels where v3's is
    per line, so where two distinct labels overlap, v3 strokes the later
    label over the earlier one's ink and v4 does not — both being unreadable
    there, per-run parity was declined rather than deferred.
  - Buys legible outlined labels — every word on the classic demo's edges,
    and any app styling text with `text-outline-width` — at every zoom.

- **28 Aug** — resize without distortion (round 91)
  - The maintainer's screen-pass report that the network view stretches and
    squishes while the window is dragged, closed at its mechanism: the steady
    state was already right, but a `100%`-CSS canvas let the compositor scale
    stale content to the new layout for at least one frame — ResizeObserver
    callbacks run after this update's rAF, and the redraw was scheduled to
    the next one, so a continuous drag was a continuous rubber-band.
  - `resize()` now draws its frame synchronously — the observer runs before
    paint, so the frame that composites the new layout composites new
    content and the stretched frame never exists — and the canvas CSS box is
    written in fixed px (v3's shape), so any frame that is still late — the
    no-observer path, the worker mount — letterboxes instead of stretching.
    Measured on the debug harness: one frame per drag step, ~0.5 ms each.
  - The same round un-froze the device-pixel ratio: `'auto'` is now live —
    re-read per measure and watched by a resolution media query — so browser
    zoom or a monitor move re-rasterizes (and emits `resize` on the core,
    v3's semantics) instead of blurring at the construction-time ratio; an
    explicit `pixelRatio` number stays pinned, both directions spec-pinned.
  - Buys a window drag that reads as a window drag — coverage catching up,
    never the graph deforming — and crisp rendering across monitor and
    browser-zoom changes.

- **28 Aug** — Bun and Deno run the package (round 98)
  - The library was runtime-clean by fact — no `node:*` import, no
    dependency, the headless path speaking only web-platform API — but not
    by gate: the import audit deliberately skipped bare specifiers, and no
    artifact of the repo had ever been *loaded* by Bun or Deno.  Both
    halves are now pinned: the audit asserts the set of non-relative
    specifiers under `src/` is empty (comments stripped first, so a
    doc-comment example cannot trip it), and one framework-free smoke file
    runs the built ESM, minified-ESM and CJS bundles under Node, Bun and
    Deno — headless init, the wire round-trip with every dictionary column
    checked value-for-value, style mappers and bypasses read back as
    values, layouts, sync and async algorithms on the CPU executor,
    events and the json() export.  Deno's require-compat held when
    measured, so the CJS bundle is contract on all three.
  - The smoke found zero defects on its first run, and every assertion is
    on values and ordering rather than "it didn't throw", because a compat
    layer can pass a completion check while handing back a subtly wrong
    decoder — the degraded-reader control produces exactly the
    plausible-looking graph with no labels, and fails loudly on all three
    runtimes.
  - Buys a support claim that is a gate rather than a hope: `ci-bun` and
    `ci-deno` smoke every push at latest stable plus a pinned floor
    (Bun 1.4.0, Deno 2.9.6), and a `node:fs` import added tomorrow is a
    red build today.

- **28 Aug** — curves spend their quads where the bend is (round 93)
  - The maintainer's screen-pass report that some curved edges render as
    visible chord chains while bundled beziers stay smooth, closed at its
    mechanism: every curved edge is one 24-quad strip, and the route
    families (unbundled bezier, round-segments, round-taxi) split it
    *uniformly* across their pieces — so pixel-straight legs, which need
    exactly one quad, consumed the subdivisions their arcs needed, and a
    radius-50 corner drew as ~6 facets.  The bundled bezier spends all 24
    on one curve, which is why it never showed the defect.
  - The allocator now weights each piece by its tangent turn — an arc by
    its sweep, a bezier piece by the turn between its control legs, a
    straight leg zero — with one mandatory quad per piece and piece
    boundaries still landing exactly on subdivision indices, so legs stay
    pixel-straight and nothing new is drawn: the same budget, spent where
    the bend is.  Both twins (the CPU flatten that bounds/picking read,
    and the vertex shader) moved together, and dashes follow by
    construction because their coordinate is the same polyline's length.
  - Verified at three tiers with controls: the radius-50 corner now
    flattens 22 chords (max error 0.24 → 0.03 model px, asserted); a new
    close-up parity scene framing one large-radius corner per family
    reads 0.004% against v3 where the uniform allocation reads 0.099%;
    the numeric routing suite confirmed no routing number moved.  One
    golden moved by 2 px — the round-segments scene, its arcs smoother.
  - The budget itself was then priced on hardware (93.2, this box's
    RX 580) and raised 24 → 32: the 5-corner probe's 0.384% collapses
    to 0.003% while the 25k-curved scene's device time stays under the
    frame budget (9.6 → 13.2 ms, wall on the vsync floor).  48 — the
    number the deferral's arithmetic favoured — measured 25.7 ms device
    and 33 ms wall (two vsync frames) for no measurable gain over 32,
    and was declined: the dash arc-length loop prices the budget
    superlinearly.  Twelve curved-scene goldens regenerated, each diff
    read first; no routing number moved.
  - Buys magnified round corners drawn as arcs — the reported defect
    class fixed with zero new vertices, and the residual case measured,
    named, and then closed by the hardware-priced raise.

- **28 Aug** — zoomed-in labels stop going soft (round 94)
  - The maintainer's screen-pass report that labels "break down in
    quality when zoomed in a fair bit", closed at its mechanism: the
    glyph atlas's edge AA is scale-free but its *letterform* is not —
    raster + EDT quantization error is baked in at the fixed 32 px per
    glyph and magnifies linearly with displayed size, rounding corners
    and deforming descenders by ~2 px at zoom 4.
  - The atlas is now zoom-tiered: a settle-debounced meter (the svg
    image promotion's twin, sharing its timer) watches the largest
    label's displayed pixels and, past 40, re-rasters every glyph in
    use at 64 px — one-way, covering graphs built already zoomed and
    image exports at the export scale, with the swap sequenced so no
    frame ever mixes old and new raster.  Costs nothing until someone
    zooms; then one ~39 ms re-raster and 3 MiB of texture, once.
  - Verified by the close-up tier's first label scenes: a
    letterform-dominated live parity diff reads 0.112% against v3
    where the pre-round render reads 1.202% against a 0.4% bound, and
    zoomed goldens export only after the public stats counter reports
    the promoted tier, so the sharpen cannot race the diff.  Raising
    the base raster for everyone (4× first-paint cost, 4 MiB
    everywhere) and raster-derived MSDF were both measured or assessed
    and declined, with the reasons recorded.
  - Buys crisp labels at the zooms people actually inspect graphs at —
    and closes the screen pass: all seven defects the maintainer found
    in one sitting are landed.

- **31 Aug** — layouts: the mechanics, then the breadth
  - The layout→renderer handoff decoupled from animation: a flat rendered
    graph hands force integration to the GPU for **both** animate values —
    `animate` is presentation only — with a silent run publishing off-mirror
    so the screen holds its frame until the one settle write.  Measured at
    25k×50k: **0.35 s** silent-GPU settle against **25.3 s** of synchronous
    main-thread CPU (the old `animate: false` behaviour) — the one named
    semantics change: that spelling is now async, settled at `layoutstop` /
    `promise()`.
  - Component packing extracted from the force layout into a shared module,
    and the extension contract gained `ctx.packComponents()` — v3's
    `separateComponents`, the bolt-on both flagship apps ship, in one call.
  - grid and preset stopped lying about animate: their doc comments claimed
    tween support the code ignored (and both skipped the `ready`/`stop`
    callbacks outright); any animate/transform/callback option now routes
    through the shared finisher while the bare calls keep their benchmarked
    bulk paths.  The debug harness forwards the animate toggle to every
    layout and its timing chain stops throwing on every non-force Apply.
  - A new built-in: the **radial tree layout** (#2493) — hierarchy-aware
    angular wedges, each subtree a contiguous sector sized by its weight,
    so tree edges never cross the circle; multi-root sweep partitioning and
    disconnected components each getting a wedge.  Priced against v4's own
    breadthfirst-circle: ~3× *faster* at N=2000.
  - Data-driven layout mappings (#1514): the census found the whole
    fn-taking layout surface is five params in two shapes, so both got a
    serializable spelling — `edgeLength`/`concentric` take
    `{ data, scale?, range?, invert?, default? }` (the "log mapping, large
    scores → short edges" recipe as one literal) and the three sorts take
    `{ data, order? }` with deterministic ties; fn forms stay as escape
    hatches.  A typo'd key or wrong-kind column throws instead of
    defaulting into a plausibly wrong layout.
  - Force constraints (fcose's main draw absorbed): `alignment`
    id-array groups (a locked node pins its group) and `relativePlacement`
    left/right/top/bottom pairs, projected after each integration step;
    validation throws at start on unknown ids, placement cycles and
    contradictory locked members.  The measure-first gate ran: constrained
    runs take the CPU executor (~26 s vs 0.4 s at 25k, but seconds at the
    fcose-sized graphs constraints serve; the projection itself costs ~4%),
    with the on-device kernel design recorded, not built.
  - Per-side compound padding — `padding-left/right/top/bottom`, px or
    `'N%'` like `padding` — closing the hook logged when the round-14
    centered clamp dropped v3's four min-size bias props: the clamp stays
    centered and each side grows the box about it.
  - Buys layout breadth an app can feel: a new layout, fcose's constraint
    surface without leaving core, per-edge lengths from data without
    functions, an asymmetrically padded compound, and a silent force settle
    ~73× off the main thread.
- **1 Sep** — the flow layout: layered/hierarchical, built not ported
  - The known portfolio hole (nothing Sugiyama-class) closed with a
    built-in: `flow` — greedy-FAS cycle removal, network-simplex
    layering, weighted crossing minimization, Brandes–Köpf coordinates
    built against the 2020 erratum dagre still predates, compound
    support as one global layering (contiguity, side-consistent
    sibling boxes, border walls carrying the padding), and no emitted
    edge geometry by design — style-driven (taxi) edges stay correct
    when nodes drag.
  - "Comparable to dagre" was made a measured bar first: a quality
    harness (crossings / edge length / area / validity / runtime) over
    real DAG fixtures found dagre crashing on long skip edges, hanging
    on nested clusters, and never finishing 10k nodes; elkjs completes
    but needs 53 s there.
  - Where flow landed against that bar: best engine outright on the 1k
    workflow (fewer crossings than both, smallest area, 116 ms vs
    dagre's 22 s); 10k nodes in 7.1 s with fewer crossings than elkjs
    and 22× less area; within 3% of dagre's crossings on the real
    dependency graph at 10× its speed.  The residue is recorded, not
    hidden: elkjs still leads crossings by ~25–30% on three fixtures,
    and the taxi-geometry pairing measures worse than straight lines —
    both carried as named follow-up levers with their numbers.
  - Buys the dagre use case in core: v3 apps that shipped a layout
    extension for DAGs get a faster, maintained, compound-correct
    built-in that one option object away replaces it.
  - Real data joined the same day: the debug page gained the repo's own
    npm dependency DAG (scopes as compound parents) and Reactome's
    human Immune System pathway hierarchy (CC0), both also quality
    fixtures — and the bio hierarchy inverted the taxi finding: 3
    crossings under taxi routing against dagre's 73 and elk's 54, so
    the taxi contract loses on dense meshes and wins on real
    tree-like hierarchies, both halves measured.  The first
    positionless compound fixtures also flushed two round-trip bugs:
    `toColumnarElements` fabricated a positions column (a positionless
    graph came back from the wire positioned), and the debug page's
    wire decode dropped compound parents.
- **1–2 Sep** — the performance review: the whole suite against 13 Aug
  - Every profile re-measured (core sweep at medians of three, renderer
    scenes and the GPU executor sweep on the RX 580) and read the
    archive's way: screened against each row's own band with frozen v3
    as the control.  Across the 43 commits since the last published
    run the library did not regress: zero screened regressions, drift
    within 1.5%, and the one pair reading v4-slower had been at parity
    for a year.
  - That pair — the whole-graph predicate filter — was rebuilt on the
    existing memo and handle paths: `cy.filter( fn )` 4× faster,
    `nodes().filter( fn )` 1.2×, nothing observable changed.  The
    "every comparative pair v4-faster" property, found to have lapsed
    unmeasured since round 65 (two pairs at parity in the 13 Aug
    baseline itself), holds again at 373 pairs.
  - The first hour measured the wrong thing: a shell without mise ran
    Node 22 against a Node 24 archive and every frozen control moved.
    The instrument now refuses that (the runner checks `.nvmrc`; the
    archive records the engine), the machine fingerprint no longer
    splits a box's history when a kernel changes its reported RAM (the
    21-run archive re-stamped to one id), and a layout benchmark row
    that had never passed at its published size was made to measure
    what it is named for.
  - Buys a benchmark history that is comparable again — the page had
    been refusing to draw a line to any new run — and a standing
    performance claim that is measured rather than remembered.  Four
    movers no run could screen (one-shot rows, rows narrower than their
    noise) are logged with the measurement each needs.

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
- **Overlapping elements pick in a stated order** (27 Aug): leaf node, then
  edge, then compound parent — the reverse of v4's structural draw order.  v3
  ordered the same three by `z-index` / `z-compound-depth`, which v4 does not
  have, so a deeply nested v3 parent that used to out-rank a shallower edge now
  loses to it.  Hover styling on a parent body likewise stops firing where an
  edge lies under the cursor, which is v3's behaviour restored.
- **`force` with `animate: false` on a rendered flat graph is async**
  (31 Aug): executor choice is availability-driven and `animate` is
  presentation only — read positions at `layoutstop` / `promise()`.
  Headless runs stay synchronous.
- **A `radial` built-in layout, force constraints, data-driven layout
  mappings and per-side compound padding** (31 Aug) — fcose's alignment /
  relative-placement surface and per-edge length control without leaving
  core; the fn forms stay, the object spellings are canonical.
- **A `flow` built-in layout** (1 Sep) — the dagre/elk use case in
  core: Sugiyama-class layered placement with compound support, rank
  constraints and data-driven `minLength`/`edgeWeight`; node positions
  only, designed to pair with `curve-style: taxi` so edges keep
  routing themselves when nodes drag.
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
verified against the source before planning (the mid-August planning wave).
`plan/INDEX.md` derives the same split from the section filenames, round by
round, and is regenerated rather than maintained:

| | |
|---|---|
| Edge-layer polish | Stroke caps and corners, and arrowhead reach.  The third item of the group, pointer cursors, landed 27 Aug |
| API review | The v3-parity surface audited member by member, now that the foundation exists to judge it |
| Runtimes beyond Node | The contract landed 28 Aug: the no-runtime-built-ins gate, the cross-runtime smoke tier and `ci-bun`/`ci-deno`.  Still planned: the native Bun/Deno test runners measured, Deno's native WebGPU driving the GPU algorithm executors and the install/publish story, then a scoping pass over other environments (edge workers, React Native, Electron) |
| Extension toolchain | `cyext`: scaffold, build, test and publish an external extension from one tool, with a template and a real example layout package |
| Exports & interop | SVG vector export; headless figure generation in plain Node (the cytosnap replacement); official JSON schemas for the public data formats |
| Visual features | Per-node charts (radial heat and bars); an annotations layer; cluster hulls and collapse/aggregation proxies; GPU edge bundling |
| App affordances | Attribute-table and filter fast paths (the Cytoscape Web case); a DX polish bundle; a small style-wins bundle |
| Performance follow-ups | The algorithm-tier follow-up list, gathered and re-verified; a worker-pool CPU executor for the per-source-parallel algorithms |
| WebGL2 fallback | Scoped: what a browser without WebGPU gets |
| Zero-copy census | Every remaining copy priced (round 110): ingest column adoption, the designed-but-deferred SAB tier for the worker host, GPU-side export post-processing — each pass gated on absolute cost, with the declines recorded |
| Ecosystem rounds | Six plans serving the flagship apps, approved in direction and awaiting refinement: transient hover emphasis without per-mousemove restyles, progressive chunked loading (a first frame before the last byte), priority-driven label decluttering, parallel-edge scale plus a real GeneMANIA fixture, multiple views over one store (the minimap seam), and an id-keyed `patch()` reconcile for server-driven data refreshes.  Decided alongside: CX2 conversion stays extension territory, not core |

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
