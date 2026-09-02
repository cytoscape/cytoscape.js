## Layout cleanup: overlap, locks, animation and the debug page

Raised by the maintainer on 2026-09-02 as a cleanup round over the
whole layout portfolio (open call 49's "one excellent layout per use
case" needs the ones that exist to be *correct* first).  The ask, in
the maintainer's words: the debug page's Preset should restore each
graph's initial positions; the page needs a force "animate to end vs
live" choice, a layout-appropriate edge-type toggle (taxi for flow,
others for others) and a hover effect that dims or hides everything
outside the hovered neighbourhood, for judging edge quality; fitting is
broken in flow; spiral and radial do not prevent overlap by default;
spiral does not animate; every layout should have an option to avoid
overlaps *including labels*, not just bodies; force's `animate: true`
should work like the discrete layouts' end tween, with a separate
boolean for live updates; every layout should handle locked nodes
sensibly; and a general review with more quality-of-output tests.

### The decisions

Four were put to the maintainer before a line was written:

- **Spiral stays the debug page's extension-contract example**, not a
  built-in.  It is fixed through the contract (new context helpers) and
  its class moves to `debug/spiral-layout.js`, so the module suite can
  run it headless against the real library.
- **Labels join the overlap boxes by default**:
  `nodeDimensionsIncludeLabels` defaults to `true`.  A recorded v4
  deviation from v3 (whose default was `false`), consistent with round
  16.4's decision that `boundingBox()`/`fit()` include labels.
- **Full v3 lock semantics.**  A locked node — or every node under
  `cy.autolock(true)` — holds its position against `position()` writes,
  position tweens and every layout; it still takes part in a layout's
  structure and is an obstacle for overlap avoidance.
- **`animateLive: true`** is force's live-streaming spelling;
  `animate: true` becomes settle-then-tween through the shared finisher.

And one in review of the plan: **no generic overlap remover.**  A
structure-blind push-apart pass would smear the rings, rows and wedges
the discrete layouts just built, iterate where a constructive rule is one
pass, and add a public contract member for what is really force's
post-pass wearing a generic name.  Each layout handles overlap in its own
geometry; the shared pieces are the *dimensions* and body-box component
packing, because every layout needs the same numbers.

### What the survey found

Verified against HEAD `bd92bbda` before planning:

| # | Defect | Where |
| --- | --- | --- |
| 1 | flow + `animate: true` never fits: flow merges its defaults into a local object, but `ctx.layoutPositions(fn)` forwards the raw user options (`fit` undefined), and the finisher tests `if (options.fit)` where every bulk path tests `fit !== false`.  This is the debug page's "flow fit is broken" — its animate box defaults on. | `flow.mts:197-248`, `contract.mts:346`, `collection.mts:5378,5414` |
| 2 | The finisher's `else if (zoom != null && pan != null)` applies neither when only one is given | `collection.mts:5425` |
| 3 | radial: no `avoidOverlap`, never reads node dimensions; `levelSpacing` is purely `min(bb.w, bb.h) / 2 / (maxRing + 1)` | `radial.mts:267-290` |
| 4 | force: no `avoidOverlap`, never reads node dimensions; point-box component packing (packed components can overlap by a node width); `animate: true` is live streaming only; ignores spacingFactor / transform / animateFilter / duration / easing / zoom / pan / nodeDimensionsIncludeLabels | `force.mts:498-665` |
| 5 | flow: body-only extents (labels ignored); `applyBoundingBox` ignores extents so bodies overflow a `boundingBox` | `flow.mts:326-336, 930-975` |
| 6 | `nodeDimensionsIncludeLabels` honoured only by circle / concentric / breadthfirst (via `layoutDimensions`); grid, radial, force and flow ignore it | `collection.mts:5246` |
| 7 | **Locked nodes**: only force and flow respect the lock (through `nodeSlots()`).  grid, circle, concentric, breadthfirst, random, radial and preset all move a locked node, and so does `node.position()` — against the `locked()` JSDoc ("immovable, by layouts and position writes alike").  A headless probe confirmed every one. | `collection.mts:1777`, every discrete layout |
| 8 | spiral: no node dimensions, a hardcoded `cy.fit`, bypasses the finisher so animate does nothing; the page never forwards the animate box for it | `debug/init.js:185-206`, `debug/layout.js:44-46` |
| 9 | The debug page keeps no record of initial positions; Preset is passed `{ name: 'preset' }` alone — a fit-only no-op | `debug/layout.js`, `debug/init.js:212-216` |

### The passes

**114.1 — shared node dimensions.**  `src/layout/dims.mts`: `nodeDims(store,
slots, { includeLabels, padding })` returns slot-parallel node-local boxes
(`x1/y1/x2/y2`, plus `maxW/maxH`) from the size, border and label-box
columns — the store's own bbox term, with the label box unioned in when
asked (so the box is asymmetric: a label below makes `y2 > -y1`), hidden
nodes sanitised to 1×1, `padding` added as half per side.  Outline,
overlay and ghost are deliberately excluded, as v3's `layoutDimensions`
excluded them.  `LayoutContext.nodeDimensions()` exposes it to
extensions; `Collection#layoutDimensions` is reimplemented over it.

**114.2 — finisher fixes and `ctx.finish`.**  `fit !== false` in the
finisher; zoom-or-pan animates whichever is given;
`ctx.layoutPositions(fn, overrides)` merges an impl's defaults while
re-pinning the wrapper's `stop` (which resolves `promise()`); a new
`ctx.finish(slots, xy, overrides)` picks finisher-vs-bulk with one rule.
Flow's `run()` collapses to it, which closes defect 1.

**114.3 — locked nodes, one rule.**  `_positions` skips locked slots and
returns early under autolock; `locked()` reads autolock too; the finisher
places only unlocked leaves and frames locked ones where they stay; the
animation position channel filters locked refs; grid and circle (which
place by index) exclude locked nodes from their cell count; concentric,
breadthfirst and radial keep them in the structure and let the finisher
hold them; preset's bulk map form skips them.  Drag already refused them.

**114.4 — body-box component packing.**  Flow's private `packBodies`
moves into `pack.mts` as `packComponentBodies` (point boxes when no
dims are given, so `packComponentsExact` becomes a wrapper);
`ctx.packComponents` packs body boxes by default.

**114.5 — force.**  `animate: true` settles silently then tweens through
the finisher (spacingFactor, transform, animateFilter, duration, easing,
zoom and pan now apply); `animateLive: true` streams as before, on both
executors; `avoidOverlap` (default true) with `avoidOverlapPadding`
(default 10) — a private post-settle separation over the body boxes,
pinned nodes as obstacles, run before the body-box repack.  Invisible
under the tween; one end-of-run adjustment under `animateLive`, the same
class as the repack shift round 59 recorded.

**114.6 — flow, radial and the rest.**  Flow's extents take the shared
dims (labels included), it packs body boxes, and `applyBoundingBox`
scales and centres by extents.  Radial gains `avoidOverlap` /
`avoidOverlapPadding`: per-ring radii grown for radial clearance between
rings and tangential clearance between angular neighbours (concentric's
chord rule, applied per pair because wedges are not uniform), wedge
angles untouched.  Grid, circle, concentric and breadthfirst route their
dimensions through the helper.  Preset and random get no `avoidOverlap`
— positions are the user's, and a pushed-apart scatter is neither random
nor uniform.

**114.7 — the debug page.**  Preset restores a snapshot taken
synchronously after construction (the factory runs the load layout
synchronously, flow included); a force-only Live checkbox; a
layout-appropriate edge-type checkbox (default on) that re-applies the
sheet with an edge override on Apply — flow and breadthfirst take
`round-taxi` in their direction, the ring and grid layouts `bezier`,
force `haystack`, preset and random the sheet's own; a hover select
(none / dim / hide) over the closed neighbourhood, timed in the console
so the page doubles as round 102's first measurement; the spiral example
rewritten over the new context helpers.  The pure parts live in
`debug/layout-config.js` and `debug/spiral-layout.js` for the module suite.

**114.8 — the layout quality suite.**  `test/layout-quality.mjs`: every
layout (spiral included, through the contract) over six fixtures — a
balanced tree, a 40-leaf fan, a rank-skipping DAG, three components with
singletons, long labels, a locked node — asserting placement, fit (the
rendered gap equals the padding on the binding axis), `boundingBox`
containment, no body overlap by default and no label overlap with labels
on, locked holds and is not overlapped, animated runs end where the sync
run ends and fit, lifecycle once, components disjoint — each overlap row
paired with the control testing.md requires, asserted red.

**114.9 — docs, types, gates, close.**

### What landed (2026-09-02, passes 114.1–114.9)

Every pass landed as planned, in order, each its own commit; what the
work found on the way is the part worth reading.

- **114.1** `src/layout/dims.mts` and `ctx.nodeDimensions()`;
  `Collection#layoutDimensions` reimplemented over it, its default
  flipped to labels-on.
- **114.2** The finisher tests `fit !== false` and animates a lone
  zoom or pan; `ctx.layoutPositions( fn, overrides )` re-pins the
  wrapper's `stop`; `ctx.finish()`; flow's `run()` collapses to it.
  The debug page's "flow fit is broken" was exactly this.
- **114.3** The lock, everywhere: `_positions`, `_shift`, the
  animation position channel, the finisher, grid and circle's index
  placement, preset's bulk form, force's pinned set under autolock,
  `locked()` reading autolock.  `cy.json()` keeps exporting the
  node's own flag — the one existing spec the change turned red.
- **114.4** `packComponentBodies` shared; `ctx.packComponents` packs
  body boxes by default and takes the impl's own array (`positions`),
  which the spiral example needs so nothing lands before a tween.
- **114.5** Force: `animate` tweens, `animateLive` streams,
  `avoidOverlap` separates.  The first separation — Gauss–Seidel
  sweeps alone — cleared sparse fields in a sweep but left a 200-clique
  of wide labels with 164 overlaps after 200 sweeps: a pile expands
  under pairwise pushes only slowly.  The shape that landed is sweeps
  → an exact per-component scale about the centroid for what
  remains (a similarity transform, so the sim's structure is kept;
  pinned components left to the sweeps) → sweeps, up to four rounds.
  Measured: ~100 ms on a 20k-node, 18 s CPU run; 4025 overlaps on a
  2000-node labelled tree cleared for 14 ms; the force spec file green
  ten runs of ten (open call 52's chain spec included).
- **114.6** Radial's rings grow; flow's extents and box; grid,
  circle, concentric and breadthfirst on the shared reading.  Radial's
  first chord rule used a box's longer side and let two 40 px squares
  meet corner-on at 45°; the diagonal is the guarantee.
- **114.7** The page.  Verified in a scripted Chromium (the extension
  was not connected): npm-deps under `?layout=flow&animate=true` fits;
  em-web's force tween and live runs both fit; Preset returns every
  node to its load position exactly; the edge-type box switches
  em-web's haystack to bezier for circle and back; hover dim and hide
  touch 7,465 of 7,468 elements and restore to zero; a locked node in
  a dragged selection stays while the others move.  A follow-up from
  the maintainer's review: the DAG sheets (reactome's pathway names
  run to 91 characters, npm-deps' package paths to 45 with no
  whitespace) drew their labels as one line across the neighbours —
  they now wrap to a column under the node, breaking anywhere, and a
  harness spec requires wrapping of any fetched network whose labels
  are long at the 90th percentile (the `anywhere` rule when most of
  those have no whitespace).
- **114.8** `test/layout-quality.mjs`: 170 specs in under three
  seconds.  The controls found two things the green rows had not:
  concentric let two 30 px squares meet corner-on (v3's chord rule,
  fixed to the diagonal as radial's was), and the labelled *ring*
  never exercised flow's extents — cycle removal makes it a chain with
  one node per rank — so a labelled fan joined the fixtures.  Run once
  each with force's separation stubbed, radial's ring growth off, the
  label term dropped and flow's extents zeroed, the suite goes red
  every time.
- **114.9** Docs, types, the benchmark row, this record.  The row
  (`layout: force settle — avoidOverlap on vs off`, in the seed block
  of `benchmark/layouts.mjs`, `BENCH_OP=overlap`) reads at the table's
  N=2000: 131 ms with the separation against 121 ms without, twenty
  iterations — the post-pass is ~8% of a short run and vanishes into a
  converged one.

### Verification run (2026-09-02)

`npm run -s verify` green (2,558 unit specs); the module tier green
(612); `test:throws:quiet` and `test:node:quiet` green; `build:types`
regenerated and committed; the page driven in Chromium as above.
Deviations from v3 recorded in `MIGRATING.md`: force's `animate`
meaning, `nodeDimensionsIncludeLabels` defaulting to true, and the
lock honoured by writes.

### Known risks, recorded up front

- Default output changes: force, flow and radial (overlap avoidance on),
  and labels-on dimensions for circle, concentric, breadthfirst and grid.
- Force's `animate: true` changes meaning (streaming → tween);
  `animateLive` is the escape hatch, and `MIGRATING.md` says so.
- `fit !== false` in the finisher: an extension relying on "no fit unless
  asked" now fits, which is v3's default.
- The GPU lease order must stay readback → `finishForce` → settle →
  finish, so the finisher's tween takes its own lease on a released one.
- Open call 52 (the chain spec's intermittency): the sim is untouched;
  the settle path is not, so the spec is re-run loud.
- The separation pass at 100k nodes on the GPU path is capped, and a
  benchmark row makes its cost a number.

### Follow-ups logged, not taken

- Size-aware (disc) repulsion inside the sim, CPU and WGSL, so a live
  force run is overlap-free *during* the run rather than at settle — a
  shader change with parity tests.
- Force ignores `boundingBox`; the sim has its own frame.
- A locked child still travels with a dragged compound parent through
  `shiftSubtree`; v3 leaves it behind and re-derives.
