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

**Open:** whether a *descendant parent* inside another parent picks
above an edge (v3 draw order says any node body above the edge
layer wins — verify v3's actual `findNearestElement` tie-break
in-round and match it); whether `cy.pick`'s JSDoc should state the
tier order as contract (recommended: yes — it ships as hover text,
and this defect is exactly a contract nobody had written down).

