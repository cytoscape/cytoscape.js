## The flow layout: a Sugiyama-class built-in

Raised by the maintainer on 2026-09-01, taking up open call 49's
layered/hierarchical half: v4 gets a built-in layered layout, named
**`flow`**, comparable to dagre, ELK layered and Graphviz dot — and the
call's build-vs-port question is answered **build**.  The literature
survey that opened this round found that the reference JS implementation
embodies exactly the defects a new implementation would exist to avoid:
dagre is unmaintained, predates the Brandes–Köpf erratum
(arXiv:2008.01252, whose second flaw no prior implementation had
solved), normalizes long edges into O(V·E) dummy chains, and gets
cluster rank spans wrong (dagre #117); elkjs is a ~1.5 MB GWT
transpilation; dot's network-simplex x-pass tops out around a thousand
nodes.  Nothing in the JS ecosystem combines a correct BK-with-errata
coordinate pass, Barth–Jünger–Mutzel cross counting, Eiglsperger
segments and compound support — that combination is the round.

### The decisions

- **`cy.layout({ name: 'flow' })`** (maintainer's name), riding the
  extension contract exactly as force does — `new CustomLayout(this,
  { ...options, impl: FlowLayoutImpl })` — so the `Layout` union does
  not change; the dispatch throw message gains `'flow'`.
- **Compounds get both modes, global first.**  The default is one
  global layering with nesting constraints (Sander TR A/03/96 border
  ranks; Forster 2004 constrained crossing reduction for contiguity) —
  the scheme dagre attempts and ELK calls INCLUDE_CHILDREN — because it
  is the only one that keeps cross-boundary edges direction-correct.
  A per-compound recursive escape hatch (`compoundMode: 'separate'`,
  ELK's SEPARATE_CHILDREN) is a later pass of this round.
- **No emitted bend points, ever** (maintainer, in review): where dagre
  and ELK hand back per-edge polylines, flow is designed so that
  *style-driven* edges — taxi above all — route themselves well from
  node positions alone.  Routes derive live in `evalTaxi`
  (`curve-geometry.mts:1389`), so a dragged node keeps a sane edge
  without any layout re-run.  The layout's side of the contract is
  placement: rank rows leave node-free horizontal bands for taxi turns,
  and long edges reserve a vertical corridor that coincides with a taxi
  leg.
- **CPU is the spec** (round 59's rule).  The survey found no credible
  GPU Sugiyama — the phases are sequential and combinatorial — so the
  implementation is typed-array CPU work; worker offload for very large
  graphs is a possible later pass, not v1.

### The algorithm stack

Chosen per phase from the survey, favouring the near-linear modern
choice with a budgeted quality dial:

1. **Cycle removal** — greedy FAS (Eades–Lin–Smyth 1993) with bucket
   lists, O(V+E), model-order tie-breaks for determinism; a DFS variant
   behind an option.
2. **Layering** — network simplex (GKNV TSE 1993: tight tree,
   incremental cut values, balance) with an iteration cap, seeded by
   longest-path; `layering: 'auto'` drops to plain longest-path past
   ~50k nodes.  Optional node-promotion post-pass (Nikolov–Tarassov).
3. **Long edges** — Eiglsperger–Siebenhaller–Kaufmann segments
   (JGAA 2005): a long edge is one object with a p-dummy on its first
   interior rank and a q-dummy on its last, not a per-rank dummy chain.
   Linear dummies; the biggest structural advantage over dagre.  v1
   implements the inter-rank containers as plain arrays (correctness
   first); the O((V+E) log E) container tree is a measured follow-up.
4. **Crossing minimization** — bidirectional layer sweep, barycenter
   with median tie-break, then transpose; best permutation kept by
   exact count, counted with the Barth–Jünger–Mutzel accumulator tree
   (O(E log V), weighted).  `thoroughness` (1–10, ELK-style) scales the
   budgets.  Compound contiguity and user order constraints go through
   Forster's constrained two-level reduction — engaged only when
   present, so the flat path stays lean.
5. **X-coordinates** — Brandes–Köpf **per the 2020 erratum**,
   node-size-aware separation (Rüegg: `halfW(u)+halfW(v)+nodeSep`, plus
   group padding across compound boundaries), inner-segment priority,
   four alignments balanced by aligned median.  Optional Rüegg 2016
   scanline compaction later.
6. **Y-coordinates** — rank rows from cumulative max half-height plus
   `rankSep`; computed canonically downward, transformed to
   `direction` at the end (breadthfirst's vocabulary).

### The taxi contract, concretely

Built against `evalTaxi`'s actual math: (a) span-1 edges with
`taxi-direction: downward` and the default 50% turn put the horizontal
run mid-gap between rank rows — a band the layout guarantees node-free;
`rankSep`'s default 60 clears twice `taxi-turn-min-distance` (10), so
the ideal route always engages.  (b) When BK aligns a chain,
`src.x === tgt.x` and the taxi route degenerates to a straight drop —
straightness comes free of any coupling.  (c) A taxi edge turns exactly
once, so a span ≥ 2 edge's reserved corridor must coincide with a taxi
leg: `alignLongEdges: true` (default) biases x-assignment to place the
corridor at the target endpoint's x, so with the recommended
`taxi-turn: 20` (px) the long vertical leg *is* the corridor.  With the
default 50% turn only span-1 is guaranteed clean — a documented style
contract, the same status dagre-plus-taxi has today, and the docs and
debug harness ship the recommended stylesheet.

### The shape of the implementation

Five files under `src/layout/`, force's multi-file pattern:

- `flow.mts` — `FlowLayoutImpl implements LayoutImpl`; defaults merge,
  loud validation, mappings resolved once; per weak component
  build → FAS → rank → order → position → y → direction; then
  `ctx.packComponents`; bare runs take the columnar
  `ctx.setPositions` path, animate/transform/subset take the
  `ctx.layoutPositions` finisher (grid's hybrid rule).
- `flow-graph.mts` — compact reindex of `nodeSlots()` into a
  typed-array `FlowGraph` (src/tgt/weight/minLen/reversed edge columns,
  CSR both directions, halfW/halfH from the size column, group columns
  from `paddingSumsOf` in global compound mode); parallel edges
  collapse to weights, loops drop; `greedyFAS` + `dfsFAS`.
- `flow-rank.mts` — `rankLongestPath`, `rankNetworkSimplex`,
  `promoteNodes`; global compound mode synthesizes per-group border
  ranks (`bTop`/`bBot` virtual nodes, nesting edges of minLen 1 and
  weight 0) so every compound spans a contiguous rank interval.
- `flow-order.mts` — the segment model, `sweepOrder`,
  `countCrossings`, `orderConstrained` (Forster meta-node merging).
- `flow-position.mts` — `assignX` (BK erratum), `assignY`,
  `applyDirection`.

Placement writes **leaves only** — parents derive through
`HierarchyIndex.flush()`, which is the store's standing rule, so flow's
compound support is spacing-aware placement, not parent writes.

Options v1 (`FlowLayoutOptions` in `public-types.mts`, joining the
`LayoutOptions` union and the types-surface audit): `direction`,
`nodeSep` (50), `rankSep` (60), `layering`
(`'network-simplex' | 'longest-path' | 'auto'`), `thoroughness` (7),
`minLength` and `edgeWeight` (number | score mapping | fn), `acyclic`,
`alignLongEdges` (true), `rankConstraints` (`min`/`max`/`same` id
lists — no selector strings), `orderConstraints` (before/after id
pairs), `compoundMode` (`'global' | 'separate'`), `componentSpacing`
(40).  Every validation failure throws with a message-asserted spec
(the throw-coverage gate).

### The passes

- **112.1 — the quality harness** (the call's required first
  measurement, before any implementation): `benchmark/layout-quality.mjs`
  over real DAG fixtures (dependency graphs, workflow DAGs, a layered
  compound fixture; small → 10k nodes), measuring geometric crossings,
  edge-length mean/variance, bounding area and runtime for
  `@dagrejs/dagre` and `elkjs` as devDependencies (outside `src/`, which
  imports nothing beyond itself).  **Landed 2026-09-01** — the baselines
  are below, and they moved the bar: at 10k neither reference engine is
  usable, so "comparable to dagre" is a bar dagre itself clears only on
  small graphs.
- **112.1's measured baselines** (i9-9900K, Node v22.22.2, dagre 3.1.1,
  elkjs 0.12.0, `--stack-size=8192` — both engines overflow the default
  V8 stack near 10k nodes; per-cell cap 300 s, the maintainer's rule
  that no interactive use waits five minutes for a layout; time is
  median of 3 after a warmup; crossings count the engines' own emitted
  polylines, endpoint-sharing pairs excluded; rerun with
  `npm run benchmark:layout-quality`):

  | fixture (n / m) | engine | crossings | len mean / cv | area Mpx² | time |
  | --- | --- | --: | --: | --: | --: |
  | deps (428 / 510) | dagre | 4,279 | 1,934 / 1.08 | 33.3 | 466 ms |
  | deps | elk | 3,382 | 1,964 / 1.12 | 94.4 | 336 ms |
  | workflow-1k (960 / 1,914) | dagre | 20,570 | 6,224 / 1.35 | 103.4 | 10,793 ms |
  | workflow-1k | elk | 21,825 | 4,945 / 1.55 | 554.9 | 1,674 ms |
  | deep-skips (1,045 / 2,458) | dagre | — | — | — | **crash** |
  | deep-skips | elk | 19,198 | 4,372 / 1.61 | 547.1 | 2,676 ms |
  | compound (846 / 1,742, 34 parents) | dagre | — | — | — | **hang** (killed) |
  | compound | elk | 21,165 | 2,936 / 0.58 | 192.1 | 1,618 ms |
  | workflow-10k (10,363 / 21,621) | dagre | — | — | — | **DNF, 20+ CPU-min** (killed) |
  | workflow-10k | elk | — | — | — | **62 s single run** (over the cap) |

  The failures are the finding: dagre crashes on the long-skip stressor
  (`Error: Not possible to find intersection inside of the rectangle`),
  never returns from the 846-node nested-cluster fixture, and ran a
  single 10k-node layout past 20 CPU-minutes before being killed; elkjs
  survives everything but needs 62 s for one 10k run.  Both reference
  engines also emit routed polylines whose crossings the table counts —
  flow's taxi contract will be measured on the geometry cytoscape
  actually draws.
- **The bar for 112.2, set from the table**: on the fixtures dagre
  completes, flow's crossings and area within ±15% of the better
  engine and runtime strictly under dagre's; on the fixtures dagre
  fails, flow must simply *complete* well inside the 300 s cap — the
  working target is single-digit seconds at 10k, i.e. roughly an order
  under elkjs, which typed-array columns and Eiglsperger segments make
  a plausible ask rather than a hope.
- **112.2 — the core pipeline, flat graphs**: the five modules, options
  and validation, dispatch, types, `test/layout-flow.mjs`, the
  migration-guide built-ins array and MIGRATING.md, `src/README.md`
  section, debug dropdown, CHANGELOG, and a `benchmark/layouts.mjs` row
  (fit:false, shared box, in-row crossings/area assertion outside the
  timed loop).  Gate: suites green and the 112.1 bar met.
- **112.3 — compounds, global mode**: border ranks in layering, Forster
  contiguity in ordering, padding-aware separation in both axes, and an
  explicit design plus spec for edges incident on parent nodes (ranked
  against the border nodes).  Gate: contiguity/containment/padding
  specs green, and the flat path's bench row unmoved when
  `hasCompounds()` is false.
- **112.4 — polish**: long-edge endpoint alignment, node promotion,
  optional compaction, thoroughness tuning against the harness, the
  taxi demo, and the container tree if a benchmark says arrays hurt.
- **112.5 — later**: `compoundMode: 'separate'`; possible worker
  offload past ~100k nodes.

### The specs that discriminate

`test/layout-flow.mjs`, modeled on radial's (headless 400×400, every
property with a documented control): layer validity (shuffled ranks go
red), simplex quality on a fixture where longest-path is suboptimal,
crossing counts against known optima (skipping transpose goes red),
BK straightness (chains share an x; rank-centering goes red), the
long-edge corridor (no node body in the strip; `alignLongEdges: false`
goes red on the crafted fixture), brute-force optimal-x comparison on
≤ 8-node graphs for the erratum port, FAS minimality and termination on
cycles, bit-identical determinism across runs, compound contiguity and
containment (disabled Forster merging and dropped pad separation each
go red), rank constraints, a taxi spec asserting an aligned chain's
`segmentPoints()` are collinear, and the finisher plumbing
(fit/spacingFactor/transform/animate, subset scope, locked nodes).

### What landed (2026-09-01, passes 112.1–112.4)

All four passes shipped the same day; the specs, gates and quality
harness ran green at each commit.  The final four-engine sweep
(i9-9900K, 300 s cap, median of 3; `flow-taxi` scores flow's node
positions under the recommended taxi polyline):

| fixture (n / m) | engine | crossings | len mean / cv | area Mpx² | time |
| --- | --- | --: | --: | --: | --: |
| deps (428 / 510) | dagre | 4,279 | 1,934 / 1.08 | 33.3 | 505 ms |
| | elk | 3,382 | 1,964 / 1.12 | 94.4 | 409 ms |
| | **flow** | 4,407 | 1,251 / 1.35 | **24.2** | **45 ms** |
| | flow-taxi | 5,168 | 1,424 / 1.25 | 24.2 | 45 ms |
| workflow-1k (960 / 1,914) | dagre | 20,570 | 6,224 / 1.35 | 103.4 | 22,208 ms |
| | elk | 21,825 | 4,945 / 1.55 | 554.9 | 1,688 ms |
| | **flow** | **19,482** | **3,256** / 1.14 | **94.3** | **116 ms** |
| | flow-taxi | 26,851 | 3,351 / 1.11 | 94.3 | 117 ms |
| deep-skips (1,045 / 2,458) | dagre | — | — | — | **crash** |
| | elk | 19,198 | 4,372 / 1.61 | 547.1 | 2,778 ms |
| | flow | 23,956 | 3,253 / 1.47 | **393.8** | **173 ms** |
| workflow-10k (10,363 / 21,621) | dagre | — | — | — | **timeout (300 s)** |
| | elk | 913,324 | 61,914 / 1.97 | 85,218 | 53,326 ms |
| | **flow** | **893,089** | 62,379 / 1.50 | **3,917** | **7,104 ms** |
| compound (846 / 1,742, 34 parents) | dagre | — | — | — | **hang** |
| | elk | 21,165 | 2,936 / 0.58 | 192.1 | 1,736 ms |
| | flow | 27,664 | 3,725 / 1.21 | **81.1** | **100 ms** |

**Against the 112.1 bar**: runtime strictly under dagre's everywhere
(45 ms vs 505 ms at the small end; 116 ms vs 22.2 s at 1k), completes
every fixture dagre fails, and 7.1 s at 10k meets "single-digit
seconds" — 7.5× under elkjs with *fewer* crossings and 22× less area.
flow is the best engine outright on workflow-1k.  The one missed
clause: crossings within ±15% of the better engine on deps (+30% vs
elk; +3% vs dagre) and on deep-skips/compound (+25–31% vs elk) — the
recorded residue, with sifting and the segment container as the named
levers.

**Deviations from this plan, recorded when taken:**

- **Dummy chains, not Eiglsperger segments, in v1.**  Correctness
  first; every fixture keeps spans small.  The trigger for segments is
  now *met with a number*: a dense non-layered input (em-web, 569
  nodes / 6,899 edges) explodes to 179k layered items and 4.6 s of
  ordering.  Until segments land, an explosion valve (nTotal >
  8·n + 1000) drops such graphs to a lean sweep budget (4.6 → 1.8 s);
  fixture numbers are untouched by the valve.
- **Block-graph longest-path compaction instead of BK's class/shift
  machinery** — the erratum documents two defects there; a block-DAG
  pass has neither, and the four-way balance recovers the rest.
  Validated by a fuzz spec (separation and order over random DAGs × 4
  alignments).
- **`alignLongEdges` was withheld, not shipped.**  112.4 measured the
  taxi polyline (50% turn) scoring *more* geometric crossings than the
  straight-line drawing on every fixture (deps 5,168 vs 4,407; 1k
  26,851 vs 19,482) — corridor/taxi coincidence needs taxi-aware
  ordering, not a placement flag.  The harness keeps the `flow-taxi`
  adapter so the gap stays measured; the option returns with the
  taxi-aware pass (112.5).
- **`compoundMode` was withheld with it** — global is the only mode
  until `'separate'` exists (112.5); an enum of one is not a surface.
- **Ordering gained what the plan did not name**, each step measured:
  DFS initial order (dot's init_order), transpose equality passes on
  odd sweeps (dot's reverse alternation), and a dual restart
  (barycenter-primary + median-primary, better final order kept) at
  thoroughness ≥ 5.
- **Component packing packs body boxes**, not position boxes — the
  harness's overlap column caught `packComponentsExact` overlapping
  deps' 164 singleton components (130 body overlaps), and flow packs
  its own extents via `shelfPack`.

**112.5 (later): the named levers.**  Taxi-aware ordering (count the
taxi polyline's crossings, not the chain's) and the returned
`alignLongEdges`; the Eiglsperger segment container (trigger met);
sifting as a quality mode for the elk crossing gap; `compoundMode:
'separate'`; a worker offload past ~100k.

### Known risks, recorded up front

The 50%-turn default only guarantees span-1 taxi cleanliness — the px
`taxi-turn` stylesheet is a documented contract, not a silent
assumption.  Parent-incident edges need their own 112.3 design.
Network-simplex worst cases are bounded by the iteration cap and the
longest-path seed; determinism requires strict model-order
tie-breaking.  Compound label space is not reserved (padding only) —
the same stance every other layout takes, recorded as a deviation note.
