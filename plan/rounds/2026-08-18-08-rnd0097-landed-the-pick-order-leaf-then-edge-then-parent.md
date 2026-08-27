## The pick order: leaf, then edge, then parent

The maintainer: on the clustered enrichment-map network, a click on
an edge inside a compound parent selects the parent.  Reproduced
(`cy.pick` at an edge midpoint inside a parent answers the parent)
and pinned:

1. **`renderer.pick()` consults the CPU node pick first and returns
   *any* node hit — parents included — without ever asking the edge
   tile** (`src/render/renderer.mts:552-557`: `cpuPickNode` hit ⇒
   return).  The edge pick (cached tile or GPU pass) runs only when
   no node was hit.
2. **The node scan itself already knows better**: `cpu-pick.mts`
   scans leaves first and lets parents answer only when no leaf hits
   ("a parent can never swallow its children's picks",
   `src/render/cpu-pick.mts:77-79`) — the tiering exists, it just
   is not exposed to the node-vs-edge combine.
3. **The correct order is the draw order**, which v4 itself renders:
   parents under edges under leaves (the structural z-order the
   sheet docs record, `debug/styles.js:16-18`).  What you see is
   what you pick is the pick pass's own stated contract
   (`renderer.mts:2526-2527`).  So: leaf > edge > parent.
4. Both gesture seats route through the same `renderer.pick()`
   (press at `src/interact/pointer.mts:746`, hover at :1579), so one
   fix covers click, tap-select, hover and the cursor work round 89
   builds on hover.

### 97.1 — the three-tier resolve

`cpuPickNode` splits its answer into the tier it already computes
(leaf hit vs parent hit).  `pick()` returns a leaf immediately;
otherwise it consults the edge path (cached tile, then the async
pass) and returns the edge on a hit; otherwise the parent, if one
was under the point.  The parent slot is held across the await — the
CPU scan does not re-run.

**The cost is confined to clicks and hovers inside parent bodies**:
those go from synchronous-parent to awaiting the edge tile once
(the tile is 64×64, cursor-centered, cached across picks at the
same spot, and pick-only frames skip scene work —
`picking.mts:6-11`, `renderer.mts:53`).  Hover is already throttled
(25 ms) and async end to end, so the added latency class already
exists; the press path awaits today for plain-background edge picks,
so no new state machine.  Measure pick latency on em-web-clustered
(the stats overlay prints it) before and after; the parent-miss
fast path (point in no parent, no edge) must not regress at all.

**Verified by** a Playwright spec in the renderer project: an edge
crossing a parent's body, pick/tap at its midpoint → the edge; tap
beside it inside the parent → the parent; tap a child leaf → the
leaf (the tier the fix must not break); the same three through a
press-select gesture, since selection is where the defect was felt.
Control: with the tier split reverted, the first assertion must go
red.  A headless-safe unit for the leaf/parent split lands in
`test/modules/` against `cpu-pick` directly (the module is pure over
the view snapshot — no adapter needed).  And the standing rule:
drive `?network=em-web-clustered` and click edges inside clusters.

### Risks named at planning

- `pads` semantics: the edge halo (`edgePadPx`) and node halo
  (`nodePadPx`) are v3's `findNearestElement` thresholds (57.9) — a
  padded *parent* hit must not beat an exact edge hit; the tier
  order resolves before halos widen anything, and the spec covers a
  padded gesture pick explicitly.
- `text-events`/pointer-transparent nodes already fall through the
  CPU scan (`cpu-pick.mts:99`) — the tier split must preserve that
  fall-through on both tiers.
- The hover path (round 89's cursor map rides it) starts answering
  "edge" where it answered "parent"; that is the fix working, but
  the hover-driven HOVERED flag styling on parents changes visibly —
  call it out in the round record and CHANGELOG (v3 behaved this
  way, so it is parity restored, not new behaviour).
- A pick awaited mid-destroy must tolerate teardown — the existing
  pick promise path already does; the held parent slot must not
  outlive a compaction (re-validate the slot after the await, the
  epoch is at hand).

### Both opens, decided by the maintainer (2026-08-27)

The two questions this plan left open were put to the maintainer with
the draw orders measured on both sides first, because the answer to
the first turned on a premise the plan had stated backwards.

**The premise, corrected.**  The plan wrote that "v3 draw order says
any node body above the edge layer wins", implying v4 has an *edge
layer* that parents sit above.  It does not, and neither library is
shaped that way:

- **v4 draws every compound parent in one pre-edge stream**, sorted
  (depth asc, slot asc) — `src/render/cull.mts:150` ("compound
  parents draw in their own pre-edge stream", round 14.9) over
  `HierarchyIndex.parentOrder()` (`src/store/hierarchy.mts:55-59`,
  `:214-231`).  So on v4's screen *every* parent is under *every*
  edge, at every nesting depth.  There is no per-depth interleave to
  match.
- **v3 interleaves by compound depth.**  `zIndexSort`
  (`v3/src/collection/zsort.mts:16-56`) orders by `z-compound-depth`
  first and only *within* a depth puts edges under nodes
  (`z-index-compare: auto`); `findNearestElements` then walks that
  list in reverse draw order and takes the first hit
  (`v3/src/extensions/renderer/base/coord-ele-math/coords.mts:328-337`,
  returning `near[0]`).  v3's pick order therefore *is* v3's draw
  order, and a depth-1 parent does beat a depth-0 edge there.

So "match v3" and "match what v4 draws" are different fixes, and the
first would have pick answering a parent the renderer drew *beneath*
the edge — breaking the pick pass's own WYSIWYG contract
(`renderer.mts:2526-2527`), which is the contract this round exists
to restore.

**Call taken: the flat rule — leaf > edge > any parent, at every
depth.**  It is the reverse of v4's actual draw order (parents,
edges, leaves, labels) and therefore consistent with the screen,
which is the UX test the maintainer set.  Nesting depth changes
nothing about the node-vs-edge combine; the deepest-parent-wins
ordering *within* the parent tier stays exactly as `cpu-pick.mts`
already computes it (reverse `parentOrder()`).

v3's per-depth interleave becomes a **recorded deviation**, and it is
a consequence of a decision already taken rather than a new one:
v3's order is driven by `z-index` and `z-compound-depth`, both of
which v4 dropped outright on 2026-08-01 (the third design sitting;
`debug/styles.js:15-18` states the replacement — draw order in v4 is
structural).  A library with no z-index cannot reproduce an order
derived from one.  Also not ported, and recorded with it: v3's
compound-only preference for an edge's *connected nodes* over the
edge itself (`coords.mts:245-249`), which exists to soften the same
interleave.

**Call taken: yes, the tier order is documented.**  `cy.pick`'s JSDoc
states leaf > edge > any parent as contract — it ships as editor
hover text through the shipped declaration and into the generated
docs, and this defect is precisely a contract nobody had written
down.  The CHANGELOG entry carries it too, together with the visible
consequence the risks list names: hover styling on parent bodies
stops firing where an edge lies under the cursor.


### Landed (2026-08-27)

The tier resolves leaf > edge > parent, in both hosts and at both
gesture seats, and the contract is written down.  Four things the plan
did not have right are recorded below, because two of them were the
work.

**97.1 — the three-tier resolve.**  `cpu-pick.mts` gains
`pickNodeTierAt`, which answers `{ slot, isParent }`; `pickNodeAt` is
now one line over it, so its ~30 existing callers (specs, benchmarks,
the two hosts' `pickNodeSync`) are untouched and the parent pass still
runs only when no leaf hits — the tiered form costs exactly what the
plain one did.  `Renderer.pick()` returns a leaf immediately (no GPU
work, as before), holds a *parent* hit while the cached tile and then
the GPU pass answer, and spends it only over background.
`WorkerRenderer.pick()` does the same across the message channel, where
it also has to: the node columns are canonical on the main thread and
the worker only mirrors them, so only an *edge* id from the worker may
outrank the parent held here.

The held slot is guarded by
`compactEpoch` rather than by hope — compaction moves slots (19.4), so
if the epoch changed across the await the scan re-runs against the
current columns, which is cheap next to the roundtrip just paid.

**The plan's premise about nesting was backwards, and the maintainer's
call turned on it.**  The plan said "v3 draw order says any node body
above the edge layer wins".  There is no such layer: v4 draws *every*
parent in one pre-edge stream sorted (depth asc, slot asc)
(`cull.mts:150`, `HierarchyIndex.parentOrder()`), so every parent is
under every edge at every depth, while v3 interleaves by compound depth
(`v3/src/collection/zsort.mts` — `z-compound-depth` first, edges under
nodes only *within* a depth) and picks by walking that same z-sorted
list in reverse (`coords.mts:328-337`).  "Match v3" and "match what v4
draws" were therefore different fixes, and the first would have picked
a parent the renderer drew beneath the edge.  Both opens were put to
the maintainer with that measured (the decisions are recorded in full
above): **the flat rule at every depth**, and **yes, document it**.

**What the plan got wrong about the gesture seats, and what it cost.**
The plan asserted that "both gesture seats route through the same
`renderer.pick()`", so one fix would cover click, tap-select and hover.
The hover seat does.  The press seat does not: `onPointerDown` resolves
pan-vs-grab from the *synchronous, nodes-only* `nodeAt`, and only calls
`resolvePressTarget` when that found nothing (`mode === 'pan' &&
grabbed == null`).  With a parent under the cursor the sync pick
answered the parent, the async pick was never started, and the release
tapped `down.grabbed` — so `cy.pick` said "edge" while the click still
selected the parent.  The Playwright spec caught it in exactly that
shape: the pick assertion went green and the selection assertion stayed
red on `p`.  Selection is where the defect was reported, so this was
in scope, and it took two further changes:

- **A parent grab is provisional** (`DownState.provisional`).  It still
  starts synchronously, so dragging a parent body keeps its
  zero-latency feel, but the press also kicks off `resolvePressTarget`;
  if the edge tier outranks the parent before the press moves, the grab
  is dropped (`dropProvisionalGrab`) with the `free`/`freeon` that
  balances the `grab`/`grabon` already emitted (17.2), and the gesture
  becomes a pan — which is what a press on a bare edge is.  A press
  that has already moved owns its drag and keeps it.
- **A release that did not move waits for that answer** before it taps.
  A click can easily be faster than the tile, and the tap target is
  read synchronously at release, so without this the fix is invisible
  to exactly the gesture that reported it.  The wait is confined to the
  provisional case; every other press taps synchronously as before.
  `tap` reads `this.domEvent` for `originalEvent`, and the listener
  wrapper clears it in a `finally` (41.4), so the DOM event is captured
  and restored around the deferred call.

**Two residuals, deliberate and recorded** (in `src/README.md` beside
the fix): the pan-vs-grab decision and the `taphold` target still read
the nodes-only sync pick, so a press-and-*drag* starting on an edge
inside a parent drags the parent.  The sync seat cannot see edges
without the GPU tile — the same limit `dragHoverPick` already records —
and deferring the grab itself would put a roundtrip in front of every
parent drag, which is the cost this design exists to avoid.

**Verification.**  `test/cpu-pick.mjs` grows five tier specs (leaf tier,
parent band, nested-parent depth, the `events: 'no'` fall-through on
the parent tier, background); `playwright-tests/renderer.spec.js` grows
the pick spec (edge inside the parent → the edge; inside the parent
clear of it → the parent; on a child → the leaf; off-graph → null) and
the press-select spec that drove the seat finding.  **Controls, both
run:** with `pickNodeTierAt`'s parent branch reporting the leaf tier,
two headless specs go red; with `renderer.pick()`'s tier check reverted
to "any node hit wins", both browser specs go red.  Green: `verify`,
the Node tier (`test:node:quiet`), and the full renderer project (144
passed, 1 skipped).

**One repo-hygiene note for the next round:** collapse
`import { x, type T }` rather than adding an `import type` line beside
it.  The second line shifted `src/render/renderer.mts` by one and broke
four `throw-coverage` specs against the `MISATTRIBUTED` allowlist's
`renderer.mts:150` — a line-numbered exemption is a tripwire on any
import edit in an audited file.
