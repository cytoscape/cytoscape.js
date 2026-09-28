## The eleventh design sitting — the open calls, one by one

The maintainer went through every open call in PLAN.md's ledger, then
the logged ideas and the open questions on the planned round files,
one at a time, each put with its background and priced options.  The
frame was the alpha gate in `docs/feature-direction.md`: the two hard
minimums (SVG export, rendering without WebGPU) and the contracts that
must be decided rather than built before the first alpha.  This file
records each answer as given; PLAN.md's items carry a one-line pointer
here.

### The ledger's open calls

- **Item 23 — `arrow-scale` quantized to 1/16: leave it.**  The 1.8%
  stays a recorded deviation and the reserved bits 18..23 stay
  reserved.  The maintainer logged a new question beside it instead:
  an **arrow-shape review** (item 72) — the shape vocabulary may
  consolidate (`triangle-tee` and `triangle-line` as one, for
  example), and `tee` may match the edge width in v4.
- **Item 27 — the edge overlay/underlay band: keep v4's
  `width + 2 × padding`** as a deliberate deviation from v3's
  `2 × padding`, documented in `MIGRATING.md` and `features.csv`.
- **Item 21 — hollow mid arrows: excluded; the mid-arrow width:
  added.**  `mid-*-arrow-fill` is dropped (mid arrows are filled, as
  today; additive later if asked), so SVG export and the WebGL path
  draw them filled too.  `mid-*-arrow-width` has no compositing
  problem and is to be implemented — a task, not a round.
- **Item 18 — warming the tween pipelines: deferred to round 73.**
  The WebGL fallback's capability selection decides whether software
  WebGPU adapters (the population the warm-up was for) are served by
  WebGL2 instead, which has no compute stage to warm.
- **Item 52 — the chain spec's intermittent failure: a task**, not a
  call.  It goes with the layout round (below), beside the other
  logged layout work.
- **Item 53 — the merged branches: kept.**  All eight local branches
  merged into `v4` stay; the item closes.
- **Item 54 — the unscreened benchmark rows: the checklist for the
  next performance review** (repeats for the one-shot row, the `x32`
  amplification, a `--repeat` for the CPU one-shots, a driver line in
  `meta.adapter`, a re-baseline of the `--layout` rows).  It leaves
  the open calls.
- **Item 61 — the layout option surface: the bounding box is a hint
  by default**, with an explicit option for when it binds; one
  spelling for the gap and one meaning for compacting, the names
  decided on the option matrix.  Scheduled into **the layout round**:
  the round-125 page sittings, item 61, item 62 and item 52 together.
- **Item 62 — AVSDF: in the layout round**, measured first (crossings
  under id order, `sort` and AVSDF), added as a `sort` value only if
  it clearly wins.
- **Item 63 — the constants' bundle price: folded into round 126.**
  Inline at build time only if 126 finds a real (non-regex)
  transform; otherwise accept the 2.7 KB gzipped.
- **Item 65 — the Brandes reference's layout: go, a small task.**
  Run the flat body in-thread as the reference, measure the score
  difference, re-pin parity.
- **Item 66 — edge id registration: measure, then the numeric fast
  path.**  Split string cost from interning cost first; lazy ids only
  if the fast path is not enough.
- **Item 67 — the whole-sheet re-apply: a sheet diff, before alpha.**
  The bypass-clearing rule of a sheet replace is kept.
- **Item 68 — animated layouts at scale: one column animation per
  layout, before alpha.**  Per-node observability during a layout
  tween (`animated()`, stopping one node) is settled as part of the
  contract.
- **Item 69 — the offload builders: one-pass builders** in round 74's
  style, with the build share measured at 8k / 32k / 128k first.
- **Item 70 — the k-clusterings' offload lane: build it before
  alpha** — one named-metric kernel shared by the reference and the
  workers, the closure path kept for custom metrics, with its parity
  record.
- **Item 71 — the eleven 1,000–1,600-line files: left as they are.**
  The item closes without a rule.

### The logged ideas (items 30–51)

- **Item 30 — golden coverage: the enumerator before the SVG and
  WebGL parity work** (tier 1, the unexercised-property count, ahead
  of rounds 77 and 73; the degrade control later).
- **Item 31 — gesture traces: the inventory now, the trace tier
  before the WebGL implementation**, so both renderers are held to it.
- **Item 32 — the benchmark coverage audit: steps 1–2 as a small
  task** (the missing algorithm and `reheat` rows, the audited
  exemption table, the discriminating-row rule, then gate at zero);
  **the workloads profile during alpha**.
- **Item 33 — mutation testing: a one-off probe on the style engine**,
  the survivors acted on, standing tooling decided on the result.
- **Item 34 — the renderer soak: built with items 35–36**, on the same
  allocation ledger.
- **Items 35–36 — limits and allocation failure: before alpha, not
  next.**  Growth past the device's limits makes **`cy.add()` throw**
  (the `GpuUnfitError` shape), leaving the store unchanged; the
  adapter's own limits are requested, failures surface as an
  instance event, and the degradation order follows.
- **Item 37 — accessibility: after 4.0.**
- **Item 38 — international labels: CJK designed before alpha (the
  shape of the font setting and its fallback chain) and built during
  alpha; RTL/bidi after 4.0**, its shaping-dependency call taken when
  it is scheduled.
- **Item 39 — lasso and public spatial queries: in scope, after
  alpha** (additive).
- **Item 40 — compound drag-and-drop reparenting: the full gesture in
  core, after alpha**, its UX informed by the UTokyo Bubble Clusters
  paper (think EnrichmentMap's bubbles).
- **Item 41 — undo: expose batch/transaction events for alpha, and
  measure snapshot and restore cost for alpha.**  Whether core ships
  an undo stack is decided on that measurement.
- **Item 42 — viewport constraints: after alpha** (an additive
  option).
- **Item 43 — the wire format: public but experimental until 4.x.**
  Its existing header (magic, version 4, presence flags) stays, and
  no cross-version compatibility is promised at 4.0; the rounds that
  want sections (81, 82, 83, 103) add them under that rule.
- **Item 44 — the codemod: declined.**  `MIGRATING.md` is the aid.
- **Item 45 — typed element data: the prototype, then the build,
  before alpha.**
- **Item 46 — framework bindings: after alpha, after round 107's
  `patch()`**, with Vue, Solid, Svelte and other popular libraries
  considered beside React.
- **Item 47 — the devtools panel: during alpha.**
- **Item 48 — PDF: a documented SVG → PDF recipe**, no core PDF; a
  companion package only if asked.
- **Item 50 — the v3 extension ports: all during alpha.**
- **Item 51 — the worker host's images and fonts: both before
  alpha**, images decoded in the worker, fonts from an app-provided
  list registered from bytes, WebKit verified before the option is
  documented as cross-engine.

### The planned rounds' open questions (rounds 71–80)

Each round file carries its answers in a closing "Decided at the
eleventh design sitting" paragraph; in brief:

- **71 (cyext)**: no placeholder publish — the name waits for the
  round; built-in layouts never leave core.
- **73 (WebGL2)**: **full parity at alpha**; the no-code scoping runs
  now, alongside SVG export, so its constraints reach the drawn-feature
  rounds; spikes on the benchmark machine.
- **75 (DX polish)**: `cy.nodeAt` with a `pickNode` alias, computed
  headless; `'modifier-zoom'`; `'scrollpan'`; `viewportCounts()` null
  headless (the maintainer weighed null, zeros and a geometric count);
  the font orphan documented only; both resize declines confirmed.
- **76 (style wins)**: screen-space sizing folds into semantic zoom;
  gradient stops from data TBD (**item 74**); `text-border-style:
  double` matches v3 if degenerate.
- **77 (SVG)**: headless allowed with the estimate documented; images
  embedded by default, `href` by option.
- **78 (headless images)**: a resvg recipe; no headless `png()`; the
  Dawn investigation with this round, before alpha; `advanceOf` built
  regardless.
- **79 (schemas)**: `$id` at round 46; ajv; no runtime `validate()`;
  columnar schema held until 4.x; SchemaStore after 4.0.
- **80 (charts)**: `chart-scale` one object; a default scale for heat
  kinds; overflow warns once and truncates; the cap waits on a design
  sitting on chart kinds and data capacity (**item 73**) — a scatter
  plot may carry far more than 64 points; line and scatter logged,
  not declined.

### The planned rounds' open questions (rounds 81–100)

- **81 (annotations)**: in `fit()`/`boundingBox()` by default, a flag
  to opt out; insertion order; an experimental wire section; editing
  wanted more built in — annotation, node and edge handles, label
  editing — designed before alpha, built after (**item 75**); group
  fidelity TBD; tracking endpoints decided with item 75.
- **82 (hulls and collapse)**: split; **a hull is a compound parent
  with a hull shape style** (the maintainer's proposal, taken over a
  separate data-key overlay) — so tree membership, and overlapping
  membership out of scope for 4.0; collapse persisted; one meta-edge
  per pair; the concave blob a core shape after the convex round.
- **83 (edge bundling)**: promise plus stats; persistence benchmarked
  both ways (preset, wire section); arrowheads TBD; `cy.bundleEdges()`
  considered together with possible style properties.
- **84 (tables and filters)**: measure first — the column view is a
  performance and change-tracking shape over `ele.data()` loops, so
  it is priced at 100k rows before any API; 84.2 decided with it.
- **88 (edge-layer strokes)**: as planned, before the WebGL
  implementation.
- **99 (Bun and Deno)**: every job gates; the Deno GPU subset a manual
  probe; also JSR.
- **100 (runtimes)**: workerd in CI if stable; the matrix in
  `src/README.md` now; no React Native app.

The maintainer then cut the sitting short of the remaining rounds'
detail: questions for rounds that run after alpha are taken when those
rounds open, not here.

### The alpha questions that remained

Resumed on the maintainer's instruction — alpha questions only:

- **102 (transient emphasis)**: core API; store state versus renderer
  overlay decided by the round's measurement.
- **103 (progressive ingest)**: `cy.load(asyncIterable)`; `cy.ready`
  is the first chunk drawn, completion signalled separately.
- **104 (label decluttering)**: off by default; `label-priority`
  drives the fade order too.
- **105 (GeneMANIA)**: two fixtures — the website's default human
  example query, and a human one-gene p53 query.
- **107 (patch)**: `cy.patch()`, with one summary `patch` event.
- **131 (bundles)**: `./gpu` removed before alpha; the composable
  factory not exposed at alpha.
- **Items 72 and 73**: short sittings before rounds 77 and 80, on a
  head gallery and a capacity measurement prepared for them.

That closes every open question the alpha gate depends on; what is
left open (items 74, 81's group fidelity, 83's arrowheads) is additive
or post-alpha.
