## API gaps vs v3

Pass-1 scope held, but a lot of the familiar v3 core/collection surface
was missing.  The **LHF** (buildable on the existing columnar/flag/
adjacency model with no new architecture) and **small-touch** (one
localized store/renderer/pointer change, no new subsystem) tiers are now
**done** — see "Landed" below.  What remains is split into **needs a
call** (a new selector type, storage, lifecycle, or readback path) and
**deferred** (already-declared out-of-scope blocks, for completeness).

### Landed (LHF + small-touch)

Done across 11 isolated commits, each with Node tests (interaction-gated
behaviour also covered by Playwright).

Core:
- Viewport math/setters: `reset`, `viewport({zoom,pan})`, `minZoom(v)`/
  `maxZoom(v)`/`zoomRange` setters, `getFitViewport`/`getCenterPan`
  (compute without committing), `renderedExtent`, `size`, `centre`.
  (`getZoomedViewport` skipped — internal in v3.)
- Introspection/aliases: `instanceString`, `isReady` (via a
  `_readyResolved` flag), `headless`, `styleEnabled`,
  `hasCompoundNodes`, `hasElementWithId`, `$id`, `mutableElements`,
  `window`, `options`.
- Events: `once`, `listen`/`bind`, `unlisten`/`unbind`, `pon`;
  `onRender`/`offRender`.
- `renderer()`, `forceRender()` (renderer got a public `requestRender`),
  `resize()`/`invalidateSize`, `makeLayout`/`createLayout`.
- Graph-level `data`/`removeData`/`scratch`/`removeScratch` (+`attr`/
  `removeAttr`), plain objects on the core.
- Interaction gating: `autolock`/`autoungrabify`/`autounselectify`
  (+`*Nodes` aliases) and `panningEnabled`/`userPanningEnabled`/
  `zoomingEnabled`/`userZoomingEnabled`/`boxSelectionEnabled`; all ctor
  options too.  `pan`/`panBy`/`zoom` gate on the programmatic flags; the
  pointer gates drag-pan/wheel/pinch on the `user*` flags and drag on
  grabbable+unlocked; `autounselectify` suppresses tap selection.

Collection:
- Reference/identity: `cy()` (was absent), `renderer()`, `element()`,
  `collection()`, `instanceString`, `hasElementWithId`, `indexOf`/
  `indexOfId`.
- Traversal (existing CSR adjacency): `roots`, `leaves`, `successors`,
  `predecessors`, `edgesWith`, `edgesTo`, `parallelEdges`,
  `codirectedEdges`, `components`/`component`/`componentsOf`,
  `allAreNeighbors`.
- Set/iter/degree: `byGroup`, `absoluteComplement` (+`complement`/
  `abscomp`), `diff`, `reduce`, `max`/`min` ({value,ele}), `sort`,
  `merge`/`unmerge`/`relativeComplement` aliases, `isLoop`/`isSimple`,
  `equal`/`equals`, `min/maxDegree`/`min/max{In,Out}degree`/
  `totalDegree`.  `degree`/`indegree`/`outdegree` are **singular**
  first-element accessors (undefined when the first element isn't a live
  node), as in v3 — the whole-collection sum is `totalDegree`.
- Dimensions: `renderedBoundingBox`, `renderedWidth`/`renderedHeight`
  (+outer), `renderedPosition` setter, `shift`/`silentShift`,
  `silentPosition(s)`, `midpoint`/`renderedMidpoint`, `source`/
  `targetEndpoint` (+rendered; node-center approx), `relativePosition`,
  `point`/`modelPosition` aliases.
- Data/scratch/json: `removeData` (+`attr`/`removeAttr`), per-element
  `scratch`/`removeScratch` (plain JS on the interned handle),
  `json`/`jsons`; `once`/`pon`/`listen`/`bind`/`unlisten`/`unbind`.
- Flags: `selectify`/`unselectify`, `grabbable`/`grabify`/`ungrabify`,
  `locked`/`lock`/`unlock`, `grabbed` getter, `show`/`hide`/`visible`/
  `hidden`.  `FLAG_GRABBABLE`/`FLAG_LOCKED` added; grabbable defaults on;
  def/ctor-level `grabbable`/`locked`.  `show`/`hide` turned out to be
  pure LHF — the cull kernels and CPU pick already mask on
  `SHOWN = ALIVE|VISIBLE`, so toggling `FLAG_VISIBLE` needed no shader
  change.
- `move()` for edges (re-endpoint in place via `store.moveEdge`).

Not yet ported from the small list: ~~`active`/`activate`,
`pannable`/`panify`, `inactive`~~ — landed in round 6 (below).

### Collection/core API performance

Benchmarked against the v3 analogue in `v3/src/` via Mitata
(`npm run benchmark`, `BENCH_N` scales the graph; suites in
`benchmark/`).  The harness rotates over a pool of distinct operands
so V8 can't hoist pure loop-invariant calls out of the measured region —
without that, allocation-free ops (e.g. `same()`) mis-report by 5 orders of
magnitude.  On a 2k-node/4k-edge graph:

- **Where v4 wins big**: `degree`/`totalDegree`/`maxDegree` ~100–230× (O(1)
  off the adjacency index vs v3 rebuilding `connectedEdges`); `add`+`remove`
  ~32×; `components` ~30×; `intersection`/`difference` ~24×; `collection()`
  ~14×; mutations (`data`/`position` set) ~10–12×; `map` ~2.6×; traversal
  1.5–4×.
- **Optimizations applied** (each its own commit, all revealed by the
  benchmark): pure `#id` selectors resolve through the O(1) id index instead
  of materializing + scanning the graph (`$('#id')` went ~420× slower →
  ~3× faster than v3); set membership keys on a packed `{group, slot, gen}`
  integer instead of a `group:slot:gen` string; each collection lazily
  caches its membership `Set` (sound — `_refs` is immutable), so
  `same`/`contains`/set ops are O(other) once a collection is reused
  (`contains` ~13× slower → ~4× faster); subset results
  (`filter`/`nodes`/`edges`/`slice`/`difference`/`intersection`) spawn via a
  dedupe-skipping `_spawnUnique`; `map`/`forEach`/`filter` preallocate and
  hoist the `thisArg` branch; `position()` reads its column once.
- **Columnar flag-selector scan (perf round 3)** — closed the residual
  whole-graph losses without copying v3's maintained-set approach.  The
  mini-selector language minus `#id` (which keeps its id-index path) is
  entirely (group, flag-mask) predicates, so `compileFlagPlan` compiles any
  flag-only selector to per-group `(mask, want)` tests and
  `GraphStore.scanRefsInto` answers them with one preallocated pass over
  the flags column — no handles, no per-element term matching; today's
  pseudos always collapse to one test per group (a multi-flag language
  would generalize to a test list).

  `cy.elements/nodes/edges/filter/$`
  route through it (`_select`: id index → flag scan → materialize+match
  fallback for mixed id+flag comma lists), collection `filter(selector)`
  tests refs against the plan directly, the interned-handle pool went
  `Map` → dense slot-indexed array, and scan-built collections skip
  `_eleFromRef` (refs known current).  Callback iteration
  (`forEach`/`map`/`filter(fn)`/`some`/`every`/min/max) now plain-calls
  when no `thisArg` is given, matching v3's semantics (`this` is
  undefined, not the element) — rebinding the receiver per element via
  `fn.call()` cost ~2× at 20k.

  Verified at N = 2k/20k/200k (the focused
  `benchmark/materializers.mjs` sweep runs where the full suite
  can't): `$(':selected')` ~2× slower → 16–59× faster, `$('node')` →
  9–14×, `$('node:selected')` → 46–166×, `nodes(':selected')` → 70–198×,
  `nodes()`/`edges()` → 3–9×, `elements()` ~2.6× slower → ~parity-to-2×
  faster, `filter(fn)` flipped to a win, `forEach` ~3.3× slower → ~1.8×.
- **Columnar bulk writes (perf round 4)** — the write-side counterpart of
  round 3, driven by a new `benchmark/mutators.mjs` sweep (whole-graph
  mutation round-trips vs v3 at 2k/20k/200k; `BENCH_OP` runs one group per
  process at 200k, where eight v3 instances exceed the heap).  The sweep
  exposed `eles.select()` as the one outright loss: per-element
  `_applyStyle` (a defaults-spread + full block match per element) and an
  unconditional per-element emit made 200k-node select+unselect 178 ms —
  behind v3 at 2k and only ~1.4× ahead at 200k.

  Fixes, each revealed by a
  benchmark line: (a) `GraphStore.flagRefs` — one bulk flag pass over a
  collection's refs with the flags/gen columns hoisted out of the loop, a
  `requireBit` filter (selectable-only for selection), changed-index
  collection and one coalesced dirty span per group — now backs
  select/unselect *and* all `_setBit` mutators (`show/hide`, `lock`,
  `grabify`, `selectify`); (b) select/unselect skips restyle outright
  unless some `case` condition reads the state
  (`StyleEngine.dependsOnState`, generalised in round 57.1 from a
  selection-only check to every state), else restyles only the changed
  slots; emits are gated on registered listeners;
  (c) `shift()` and constant/partial `positions()` write the position
  column directly (`GraphStore.shiftPositions`/`setPositionsConst` — no
  per-element handles, callbacks or Position allocations) and the
  `positions(fn)` path reads previous coords off the column instead of
  allocating via `position()`.  At 200k vs v3: select+unselect 178 → 6.2 ms
  (1.4× → 38×), hide+show 2.4 ms (~1400×; v3 pays a style bypass per
  element), lock 96×, positions(obj) 71×, positions(fn) 44×, shift
  18.8 → 2.6 ms (106×), remove+re-add of a 256-node band ~1000×.  The gpu
  side improved 3–54× per op at 2k (select 54×, shift 5×, lock 8×,
  hide 6×); `data set` is dominated by per-(group,key) column resolution
  and stayed ~1× (16–22× over v3; its 200k timing is GC-noisy on both
  sides).
- **Slot-native traversal (round 4b)** — traversal walks built results by
  pushing refs per adjacency hit and re-deduping in `_spawn` (a
  packRef-keyed Set over ref objects), iterated CSR runs through the
  iterator protocol, and `successors/predecessors` spawned a full
  collection per hop — ~10.5 s for one 20k-node closure on the benchmark
  ring (diameter ~N/3; v3 ~40 s).  Now every walk (`connectedEdges`/
  `connectedNodes`, `outgoers`/`incomers`, `neighborhood`,
  `roots`/`leaves`, `sources`/`targets`, `successors`/`predecessors`)
  collects current refs straight off CSR with an int-packed (group, slot)
  seen-set and index loops, and spawns through `_spawnLive` — a trusted
  `{unique, live}` constructor path that skips per-element
  `_eleFromRef` re-validation.  `neighborhood` pre-seeds the seen-set
  with its own elements instead of a `difference()` post-pass, and
  `successors/predecessors` is a raw slot BFS (no per-hop collections at
  all): 2k-node closure 92.7 ms → 352 µs (2.9× → ~725× vs v3).  Verified
  by `benchmark/traversal.mjs` at 2k/20k: the two residual v3 wins
  flipped (100-node-band `connectedEdges` 1.2–1.5× loss → 1.3–1.5× win,
  band `sources` 1.1–1.3× loss → 1.3× win), and the rest widened —
  `neighborhood` 2× → ~4×, `outgoers`/`incomers` ~3.4× → ~4.5×, band
  `neighborhood` 2.5× → ~5.4×, band `roots` ~64× → ~110×.  The ~2–5×
  ceiling on single-hop traversal is structural, not unfinished work: v3
  is already O(degree) there (each element object holds its incident
  edges as a direct array), and a traversal must *return* a v3-shaped
  collection — per output element the gpu side allocates a ref, dedupes
  and interns a handle, a floor comparable to v3 assembling its result
  from already-materialized objects.  Bulk writes have no such floor
  (they touch columns and return nothing), which is why `shift` can be
  ~106× while `outgoers` is ~4.7×; the big traversal multipliers only
  appear where an *algorithmic* layer was removed (the per-hop collection
  machinery in `successors`).
- **Scenario sweep (round 5)** — with the micro surface swept, the open
  question was whether the wins survive *composition* and the
  listener-gated emit paths the micro suites deliberately exclude (their
  emits never fire — no listeners are registered).

  `benchmark/scenarios.mjs` replays five composed traces with core
  listeners attached, at 2k/20k/200k (`BENCH_OP` one-group-per-process at
  200k; v3 instances styleEnabled + preset layout — the realistic app
  config, and required for meaningful v3 bounds headless).  Results (× vs
  v3): explore (2-hop expand + select + fit) 8.4/5.3/34×; select-all +
  whole-graph fit with 2N emits per iter 18/10/12.6×; 100-band drag with
  a position listener (800 emits/iter) 8.5/7.3/10.6×; remove + re-add
  256 + cascade with add/remove listeners 20/162/529×; dashboard refresh
  (bulk data write + mapped labels + filter(fn) + fit, data listener)
  3.8/4.0/4.2× before the fix below, 9.5/6.4× at 20k/200k after.  Emit
  cost itself is ~85 ns/listener call (~17 ms for 200k emits) — no
  batching policy is urgently needed.  Two fixes fell out: (a) `pan()`
  get returned a fresh `{x,y}` per call — now returns the live internal
  object (v3 parity; setters always swap in a new object), ~4× slower →
  ~2.3× faster; (b) the refresh trace exposed the **data-write label
  path**: `_onDataChanged` ran a *full* per-element style apply (defaults
  spread, every block matched, all six node channels + dirty spans
  rewritten) per element per write whenever any label mapped any data
  key — 64 ms of an 85 ms 200k bulk write.

  Now the StyleEngine tracks
  which keys labels map (`labelDependsOn(keys)`, decided once per
  `_setData` call), and `refreshLabels(slots)` recomputes only the label
  sidecar, resolving the stylesheet once per selectedness like
  `applyBulk` (per-element fallback only under `#id` blocks); writes of
  unmapped keys skip the pass outright.  200k bulk write with
  mapper+listener: 85 → 37 ms.
- **Residual v3 wins** (micro-ops at 20k, accepted): `forEach` (~1.8×),
  `getElementById` (~1.4×), `data()`/`position()` get (~1.1×,
  noise-level).

### Landed (round 6 — the needs-a-call tier)

Five isolated commits (2026-07-24), each with Node tests; box selection
also has a Playwright spec (18 renderer specs total, all green on a real
adapter).  `src/README.md` records the policies.

- **`active`/`pannable` states**: `FLAG_ACTIVE`/`FLAG_PANNABLE` bits;
  `activate`/`unactivate`/`active`/`inactive`, `panify`/`unpanify`/
  `pannable` through the bulk flag path.  v3 defaults (edges pannable,
  nodes not; per-def override); pannable overrides `grabbable()` and
  drag eligibility, so dragging a pannable element pans.
- **Batching** (`startBatch`/`endBatch`/`batch`/`batchData`/
  `batching`): v3 semantics — defers style application (first apply of
  added elements, sheet re-application, mapped-label refresh) to one
  bulk flush at the outermost `endBatch`, filtered to live refs; events
  keep firing; a sheet set mid-batch flushes as one `applyAll`.
  Renderer scheduling needed no deferral (the dirty tracker already
  coalesces per microtask), so `notify`/`noNotifications` have no v4
  counterpart.
- **Read-only style getters**: `style`/`css`, `renderedStyle`
  (length props × zoom), `numericStyle`, `effectiveOpacity`/
  `transparent`/`takesUpSpace`/`interactive`.  Values read back from
  the stored channels (columns + label sidecar); label channels of
  unlabelled nodes resolve through the sheet.  Setter forms throw — no
  per-element bypass in v4 (mappers are the per-element mechanism).
- **Core `json()` export**: elements (grouped, or flat via
  `json(true)`), sheet, graph data, viewport, gating flags; element
  json gained `locked`/raw `grabbable`/`pannable` (v3 parity).  The
  import/restore form throws (needs stored defs); exported elements
  round-trip through the definition form.
- **`selectionType` + box selection**: validated
  `'single'`/`'additive'` (ctor option; additive taps toggle without
  clearing, mult-sel keys shift/ctrl/cmd match v3);
  `GraphStore.refsInBox` answers the box query in one columnar scan
  over shown elements (v3 'contain': node bb incl. border fully
  inside, straight edges by both endpoint centers), public as
  `cy.elementsInBox`; the pointer boxes on mult-sel-key drags (or when
  panning is disabled) with a DOM overlay box and the v3 event flow
  (`boxstart`/`boxend`, `box`/`boxselect` per element).  Mouse/pen
  only.

### Needs a call — note only, don't build yet

- **Classes** (`classes`/`addClass`/`removeClass`/`toggleClass`/
  `hasClass`/`flashClass`): new per-element class storage + class
  selectors in the mini-selector + restyle on change.  Couples to the
  constrained (constants-only) style engine.  **Call made: not in v4** —
  see "Selector removal + stylesheet reshape" below.
- ~~**Style getters**~~ — the read-only surface landed in round 6
  (shape call: stored-channel truth, numbers + `rgb()` strings);
  `bypass`/per-element style *setters* remain out by design (the fn
  mapper is the per-element mechanism; `pstyle` stays internal-only in
  v3 and has no v4 counterpart).
- ~~**Batching**~~ — landed in round 6 with the v3 policy (defer style
  apply, keep events); `notify`/`noNotifications` deliberately have no
  v4 counterpart (the renderer is dirty-driven).
- ~~**Core `json()` *import*** and element `clone`/`copy`/`restore`~~ —
  **call made (round 10 planning, 2026-07-27): not in v4.**  Removed
  elements are terminally dead (see the design decision in
  `src/README.md`): their column bytes are tombstoned and the slot
  free-listed, so nothing keeps a removed element readable or
  restorable.  `restore()`/`clone()` and the import form of `cy.json()`
  are permanently closed; re-adding from kept definitions is the app's
  job (exported element json round-trips through `cy.add()`).
- ~~**Image export** (`png`/`jpg`/`jpeg`/`renderTo`)~~ — landed in round
  9.6 (below) as the offscreen render + buffer readback path;
  `renderTo` remains out.
- **`mount`/`unmount`**: the container is fixed at construction today;
  re-mounting means renderer teardown/re-init.
- **Lazy / slot-backed collections**: the only way past traversal's ~2–5×
  handle-materialization floor (see round 4b) is returning collections
  that hold slot lists and intern handles on demand — an API-shape change
  (it moves the cost of `eles[i]`/`forEach` from build time to access
  time, and complicates the "handles are interned singletons" invariant).

  **Call made (round 5): not warranted.**  The scenario sweep measured
  the floor in composed traces: in the worst one (dashboard refresh, the
  narrowest win) the per-element handle reads in `filter(fn)` cost
  5.2 ms of a ~90 ms iteration at 200k (vs 1.9 ms for a direct columnar
  scan) — ~4–6% of the trace — and the traversal-heavy explore trace runs
  a 200k click-interaction in ~45 µs median, 34× v3.  Revisit only if a
  real profile ever disagrees.
- Odds and ends that each need a small feature, not just wiring
  (~~`selectionType` + box selection, `active`/`activate`, `pannable`/
  `panify`~~ — landed in round 6): `multiClickDebounceTime`
  (multi-click), `eles.layout()`/`layoutPositions`/`layoutDimensions`,
  `boundingBoxAt` (bbox at a hypothetical position),
  ~~`sortByZIndex`/`zDepth`~~ (closed 2026-08-01: z-index is dropped
  by decided design — see the design-sitting section below),
  `padding`/`paddedWidth`/`paddedHeight`.
