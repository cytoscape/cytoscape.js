## v3 → v4 parity gap analysis

A systematic sweep of the **entire v3 public surface**, diffed against
v4.  Sources: the v3 style registry (`v3/src/style/properties.mts` — 280
registered properties + 11 aliases across 21 groups), the docmaker API
index for core and collection (cross-checked against the prototypes),
the v3 renderer's event/gesture emission (`load-listeners.mts`), the
layout and extension registries, and the documented init options —
diffed against `src/README.md` plus source spot-checks of
`src/`.

Every gap below is classified into one of four tiers:
**at parity**, **dropped by decided design** (recorded, no action),
**gap with direction set** (build when scheduled), and **needs a
call** (API semantics are never improvised autonomously).  A final
tier lists **proposed drops** — v3 features we suggest *not* porting;
none of those is decided until signed off.

### At parity (verified, no action)

Core viewport/events/data/batching, the whole collection
iteration/comparison/building surface (incl. `eq`/`first`/`last`/
`slice`/`toArray`/`anySame`/`symmetricDifference`/
`closedNeighborhood`), traversal, degree, flags/switches
(incl. `active`/`pannable`), the full v3 algorithm surface, layouts
grid/preset/circle/concentric/breadthfirst/random (+ `eles.layout()`
plumbing), `png`/`jpg` export options, `mount`/`unmount`/`destroy`,
`stop(clearQueue, jumpToEnd)` (since round 21 `stop(jumpToEnd)` — no queue)/`delay`/`delayAnimation`, box selection
with `selectionType`, pinch zoom, the cxttap/dbltap/taphold gesture
set, and `data`/`scratch`/`json()` export.

(Where v3 takes a
selector these take collections/queries/predicates — the decided v4
form, not a gap.)

### Dropped by decided design (recorded in src/README.md; ledger only)

Selector strings and `cy.$()`; classes; per-element style
bypass/setters (`style(name, value)`, `removeStyle`, `flashClass`);
style functions; CSS-string stylesheets and the
`cytoscape.stylesheet()` builder (follow from the `{ nodes, edges }`
object-sheet decision — worth recording explicitly);
selection-dependent restyling (`:selected` blocks → shader accent
ring); `restore`/`clone`/`copy` and `cy.json()` import; custom easing
functions and `spring(tension, friction)` (→ `spring(bounce)`); event
namespaces; v3 bubble order *within a phase* (registration order
instead; compound bubbling itself landed round 14.5 with v3's
cross-phase order); per-element `font-family`;
viewport-fixed labels; `renderTo`; `cy.notify`/`notifications`/
`noNotifications` (dirty-driven renderer).

Added by the 2026-07-29
triage (below): the canvas-era perf degradation options
(`hideEdgesOnViewport`, `textureOnViewport` + `outside-texture-bg-*`,
`motionBlur`/`motionBlurOpacity` — obsolete under compute culling +
adaptive render scale); `background-blacken` (subsumed by color
mappers); `bounds-expansion` (bounds are computed correctly instead);
and the legacy aliases (`content`, `padding-{left,right,top,bottom}`,
no-dash shape spellings, redundant `attr`-family duplicates — one name
per concept), **less two recorded exceptions**: `autolockNodes` and
`autoungrabifyNodes` are kept (fifth design sitting, 2026-08-04).

**The legacy-alias line was not true of the code** (found 2026-08-03 by
the round-29 docs check, and left as a call rather than patched):
`cy.autolockNodes()` and `cy.autoungrabifyNodes()` were declared, wired
and working, and round 29.1's alias table *pinned* them; the no-dash
shape spelling `roundrectangle` likewise still compiled, where
`cutrectangle` and `concavehexagon` threw.  So the 2026-07-29 triage
was applied unevenly and three names survived it.

It was one call, not
three — "does the one-name-per-concept rule actually apply to these?" —
and the fifth design sitting **split** it (executed as round 37.2):
`roundrectangle` drops and throws with its siblings, from all three
enums that took it; the two core aliases stay, as exceptions written
into the ledger line above rather than left as drift.  The line the
call had to change was the `roundrectangle` one in
`test/decided-drops.mjs`, which now pins the drop; the alias table
in `test/aliases.mjs` keeps its two rows, with the reason.
`content` and `padding-{left,…}` *do* throw, as does every other prop
in this ledger — pinned since 29.3 by `test/decided-drops.mjs`.

### Gaps with direction already set (build when scheduled)

- **Curved edges** — the single biggest *visual* gap.  **Pass 12a
  (bundled `bezier` + self-loops) landed 2026-07-30**, and **pass 12b
  (`unbundled-bezier`, `segments`, `round-segments`, `taxi`,
  `round-taxi`) landed 2026-07-30/31** — see the round records.
  ~~Still open from v3's `curve-style`: `haystack` and
  `straight-triangle` plus manual endpoints (the 12c pass).~~ —
  **12c landed 2026-07-30/31**, completing the family.

  Brings with it: **self-loops** (`loop-direction`/`loop-sweep` — a
  loop degenerated to a point in v4 when this was written), `control-point-*`,
  `segment-*`, `taxi-*`, `radius-type`, `edge-distances`,
  `source/target-endpoint`, `source/target-distance-from-node`, and
  the accessors `controlPoints`/`segmentPoints`/
  `renderedControlPoints`/`isBundledBezier`.  Design tier decided
  (2026-07-24): dual CPU/WGSL impls, conservative CPU bound for
  cull/fit, exact lazy `.bb()`, membership as a structural index.
  The 2026-07-29 triage added `curve-style: haystack`
  (+ `haystack-radius`) and `straight-triangle` to this surface: kept
  as *real visual styles* (offset-endpoint and triangle-shaped edges),
  not perf modes — v4's culling makes the perf rationale moot but the
  looks stay.
- ~~**Ghost props**~~ — **landed as round 13 A1** (2026-07-31).  Kept in
  the 2026-07-29 triage (SBGN needs them), in a simplified form: a
  ghost duplicates only the basic node body — shape, border,
  background — at the offset, an extra instance draw, never a
  whole-cloth redraw of the full node (labels and other decorations
  excluded).
- ~~**Overlay/underlay theming**~~ — **landed as round 13 A2**
  (2026-07-31), core props included.  The 2026-07-29 triage decided to
  *port the props* (the 10 overlay/underlay element style props plus
  the `active-bg-*` and `selection-box-*` core options) rather than
  keep the affordances baked in; the existing shader hover/active
  brighten, accent ring and DOM selection box become the styled
  defaults.
- ~~**Multiline labels**~~ — **landed as round 16** (2026-08-01),
  along with label bounding boxes.  `text-wrap`/`text-max-width`/
  `text-justification`/`line-height`/`text-overflow-wrap` (+
  `ellipsis`), on the decided tier (shaping memoizes; model-space
  keeps it zoom-invariant).
- ~~**Edge label autorotate** (`text-rotation: autorotate`)~~ —
  **landed 2026-07-29** (see the autorotate entry below); the flip
  rule call was taken as v3's verbatim undirected-slope angle.
  ~~Per-element *numeric* `text-rotation` stays in the label-parity
  batch.~~ — **landed as round 27.7** (2026-08-02), on any label.
- ~~**Force-directed layout**~~ — **landed as round 18**
  (2026-08-01): `cy.layout({ name: 'force' })`, spring–electric with a
  CPU reference executor and an on-device integrator under the
  position lease.  The call this entry left open (port cose vs a
  modern kernel) was taken for the latter.  *(Round 59, 2026-08-09,
  rebuilt the model after the round-18 one was measured unstable past
  node degree ~20 — see the round-59 plan and records.)*
- **Compaction** — slot-stable tier (id blob / CSR / dictionary
  reclaim) **landed in round 11** with auto waste thresholds; ~~the
  slot-moving tier still waits on the logged policy calls~~ — the
  slot-moving tier **landed as round 19** (2026-08-01), policy calls
  and all.
- ~~**z-index**~~ — **dropped outright** (decided 2026-08-01, no round
  at all): draw order is structural and stays that way, so `z-index`,
  `z-compound-depth` and `z-index-compare` are not coming to v4 and
  neither is `zDepth`/`sortByZIndex`.  See the decided-design bullet in
  the README.  The mechanism this entry named (more z-ranks or a `u32`
  index-indirection pass) survives only as the logged single-boolean
  elevated tier, if demand ever appears.

### Needs a call (design open — grouped, with the v3 surface at stake)

*(The still-open items here are collected, with their evidence and
what changes when each is decided, in "Open calls for the maintainer"
near the top of this file — read that first; this ledger keeps the
per-item history.)*

1. ~~**Compound nodes**~~ — **landed as round 14** (2026-07-31; the
   plan and per-item records are at the end of this file): hierarchy
   in the columnar store, auto-sized parents materialized into the
   position/size columns, the parents sheet group + structural
   query/case terms, ancestor-gated visibility + rendered
   effectiveOpacity, ported event bubbling, compound loop edges,
   the parent draw stream, and layout/tween/interaction rules.
   The original scoping notes, for the record: the largest single
   absence.  Style: the
   8-prop compound group + `:parent` visuals + `padding`/
   `padding-relative-to` + `z-compound-depth`/`z-index-compare` +
   `compound-sizing-wrt-labels`.

   Collection: `parent`/`ancestors`/
   `children`/`descendants`/`siblings`/`orphans`/`nonorphans`/
   `commonAncestors`/`isParent`/`isChild`/`isChildless`/`isOrphan`,
   `move({ parent })`, `forEachUp/Down`, compound-relative
   `relativePosition`, `effectiveOpacity` semantics, event bubbling
   through parents, cose nesting.  Needs its own design round:
   hierarchy in the columnar store, parent auto-bounds vs cull/bb,
   render order.
2. **Background images** (16 props) — per-node images/icons are
   ubiquitous in real apps (`background-image` + fit/clip/position/
   repeat/opacity/smoothing/crossorigin...).  GPU shape: a texture
   atlas or array keyed per element; interacts with the fixed-atlas
   discipline.  High app value; sizeable renderer feature.  **Landed
   as round 15 (2026-08-01, below): tiered texture arrays + mips,
   SVG zoom-promotion, an SDF icon mode, multi-image parity.**
3. **Pie / stripe backgrounds** (51 + 50 props) — SDF-friendly in
   principle; the call is whether v4 wants them (or a leaner
   generalization) at all.  **Call taken 2026-08-01 (third design
   sitting): yes, as the lean list-valued `chart` family designed
   for future chart kinds — scoped as round 23 (plan at the end of
   this file).**
4. **Node visual parity batch** — gradients
   (`background-fill`/`line-fill` linear/radial + stop props),
   `corner-radius` control, `border-style`/`-cap`/`-join`/
   `-dash-pattern`/`-dash-offset`/`-position`, the node `outline-*`
   group (5), custom
   `polygon` via `shape-polygon-points` (per-element point data),
   and the unported shape keywords (`round-*` family,
   `cut-rectangle`, `barrel`, `concave-hexagon`, `right-rhomboid`,
   `bottom-round-rectangle`).  Each is small-to-medium; needs a
   scope call on which subset earns its shader/channel cost.
   (`background-blacken` and `bounds-expansion` were in this batch
   until the 2026-07-29 triage dropped them.)

   **Landed as round 13
   (2026-07-31, B/C series)**: gradients, corner-radius,
   border-position, dash pattern/offset/cap, the outline group, the
   custom polygon.

   **The shape keywords landed as round 27**
   (2026-08-02): the two plain-polygon ones as point tables,
   `cut-rectangle`/`bottom-round-rectangle`/`barrel` as
   parameterized fields, and the seven `round-*` keywords as
   `sdPolygon( inward-offset ) − r` — the identity that makes
   corner-rounding exact under anisotropic scaling, which is what
   the earlier "no clean closed form" note had missed.  **v3's
   node-shape vocabulary is complete.**  ~~Still open:~~
   `border-style`/`outline-style`, held for exactly the scope call
   this item's own sentence above asks for — see the round-27.8
   entry for the three cost tiers.  (Call taken 2026-08-04: **full
   coverage** — scoped as round 38: scoping
   it turned up three further sub-calls the sitting did not reach,
   logged in open call 1 — all three taken at the sixth sitting,
   2026-08-06, and **round 38 landed 2026-08-08**.)
5. **Arrow parity** — `mid-source`/`mid-target` positions,
   `arrow-fill: hollow`, `arrow-width`, `arrow-scale`, compound
   shapes (`triangle-tee`/`circle-triangle`/`triangle-cross`/
   `triangle-backcurve`).  Mid-arrows are cheap on straight edges
   but really belong with curved-edge midpoint math.  **Landed as
   round 13 (2026-07-31, B7/C1)**: arrow-scale, per-end
   fill/width, mid-arrows on the curve/route midpoint.
   **Closed by round 27** (2026-08-02): the four compound heads
   landed in 27.6 and v3's nonlinear arrow-size formula in 27.3, so
   **v3's arrow vocabulary is complete** and arrow sizes match v3's
   in every width regime — measured, not asserted, with the live
   parity diff moving 4.459% → 0.013%.  Recorded deviation: a
   hollow compound head falls back to filled.
   **Re-opened by round 55** (2026-08-06), and the way it was closed
   is the lesson.  The *vocabulary* is complete and the *sizes* match;
   what round 27 never measured is how the head relates to the **line
   beneath it**, because its parity scene used opaque filled heads
   whose own fill hides the difference, and every later curve scene set
   `arrow-shape: none` on the reasoning that arrows were where the two
   renderers differed.  v4 implemented no arrow `gap` at all: v3
   shortens the drawn line by `arrowShapes[shape].gap(edge)`, v4 ran
   it to the node centre.  Measured against v3 at the time: **3.5%** of
   the frame for the wedge a filled head leaks around its tip, **11.8%**
   for a hollow head showing the line through its interior, **26.7%**
   for a translucent edge compositing line and head separately.
   ***Closed by round 56*** (2026-08-07): v3's `gap` and `spacing` both
   port, the three scenes read 0.000%, 0.442% and **0 differing pixels**,
   and the round found and fixed a second defect nobody had predicted —
   a hollow head's stroke reaches outside its polygon and was being
   clipped at the back corners.
   What is left of arrow parity is three recorded deviations rather than
   unbuilt work, all in `src/README.md`: **mid arrows** are not covered
   by a trim (open call 21, and may end up unsupported), v3's erase
   reaches *under* a head where a trim cannot, and two translucent heads
   that overlap **each other** composite where v3 flattens them.  Plus
   two questions the round raised: the `arrow-scale` quantization (item
   23) and the two stages the trim cannot reach (item 24 — *since
   closed by round 58, 2026-08-09*).
6. **Label parity** — placement (`text-valign`/`text-halign` grid
   vs v4's fixed below-node), per-element numeric `text-rotation`,
   **source/target edge labels** (10 props — second/third label
   streams), `text-opacity`, `text-transform`,
   `font-style`/`font-weight`, `text-border-*`,
   `text-background-shape`, and per-element `min-zoomed-font-size`
   vs v4's global `labelFadePx`/`labelMinPx`.  **Landed as round 13
   (2026-07-31, B6/D series)**: the halign/valign grid,
   text-opacity/transform/border/background-shape,
   font-style/-weight, per-element min-zoomed-font-size, and the
   source/target label streams.  **Numeric `text-rotation` landed
   as round 27.7** (2026-08-02), on any label, alongside the
   `autorotate` keyword (edge-only — it resolves from an edge's
   slope).  Also: **labels are
   excluded from `boundingBox()`** in v4 — v3's `includeLabels`
   (and the bb options object generally) affects `fit()` semantics;
   the conservative-label-bound design (already sketched for
   multiline) is the likely answer.  **Landed as round 16
   (2026-08-01, below): the wrap family, and labels join bb/fit by
   default with { includeLabels } opt-out.**
7. **Event vocabulary** — v4 lacks the element state events
   (`grab`/`grabon`/`drag`/`free`/`freeon`/`dragfree`/
   `dragfreeon`), the normalized device events (`tapstart`/
   `tapdrag`/`tapend` + `vmouse*` aliases, raw `mousedown`/
   `mousemove`/`mouseup`/`click`), `tapdragover`/`tapdragout`
   hover-during-drag, `cxtdragover`/`cxtdragout`,
   `tapselect`/`tapunselect`, and the viewport-gesture variants
   (`dragpan`/`scrollzoom`/`pinchzoom`).  Event objects also lack
   `preventDefault`/`stopPropagation` and bubbling semantics.
   Mostly cheap plumbing, but every name is permanent API — one
   deliberate call on the v4 event vocabulary is better than
   accretion.  **Landed as round 17 (2026-08-01, below): the curated
   set plus the official pointer-event family.**
8. **Interaction options + touch parity** — `wheelSensitivity`,
   `touchTapThreshold`/`desktopTapThreshold`, configurable taphold
   duration, `pixelRatio`, per-element `events`/`text-events`
   (pointer-transparency), `box-selection: overlap` mode (v4 is
   'contain' only), two-finger cxttap on touch, and the
   three-finger box gesture (currently listed as not implemented).

   **Scoped as round 20 (2026-08-01, plan at the end of this
   file)**: the option quartet + `events`/`text-events` + both
   touch gestures; `pixelRatio` found already landed; the overlap
   box mode deferred as a demand-gated hook (not v3 surface) — and
   **landed as round 39.1** (2026-08-04) once the fifth sitting took
   the call, as the core option `boxSelectionMode: 'contain' |
   'overlap'`.  Two things that entry did not say: v3 spells the same
   choice as a *per-element style prop* (`box-selection`), and
   `cy.elementsInBox()` deliberately stays pure containment, so the
   mode is read by the gesture alone.
9. **Animation surface** — `step` callback, `queue: false`,
   `renderedPosition` targets, Animation object controls
   (`pause`/`progress`/`reverse`/`apply`/`applying`/`completed` —
   v4's handle has `play`/`stop`/`promise`), and **style
   transitions** (`transition-property`/`-duration`/`-delay`/
   `-timing-function`): call whether transitions return as sugar
   over the animation system or stay out.

   **Partially resolved
   2026-08-01 (third design sitting): v4 animations need not match
   v3 — the queue is dropped outright (round 21) and `step` stays
   out; controls and transitions remain the open follow-up.**
   **Remainder scoped 2026-08-01 (fourth design sitting) as round
   24 (plan at the end of this file): transitions return with a
   v4-specific trigger taxonomy + the domain perf contract, and
   `pause`/`resume`/`reverse` land (`progress` stays a getter,
   `apply`/`applying` stay out).  Round 24 landed in full the same
   day — item closed; the geometry tween (size-channel transitions
   + animation, one benchmarked round) was the successor follow-up,
   built as round 25 (2026-08-02) — also closed.**
10. **Extension system** — `cytoscape.use()` and
    `cytoscape(type, name, registrant)` registration for
    layout/renderer/core/collection extensions.  v4 has none; this
    gates the entire external ecosystem (fcose, dagre, elk, cola,
    edgehandles, ...).  At minimum a v4 **layout extension
    contract** needs designing; core/collection extension points are
    a separate call.  **The layout contract landed as round 17
    (2026-08-01, below): direct objects, no registry;
    core/collection extension points stay deferred (recorded)** —
    and **closed by the fifth sitting** (2026-08-04): they stay out of
    4.0 by decision, demand-gated exactly as logged.

    *One thing the closure did not cover, found by round 45 and fixed
    there*: the layout contract shipped **no types**, so the external
    authors this item exists for typed `run( ctx )` as `any`.
    `LayoutContext`, `LayoutImpl` and `CustomLayout` export now — see
    open call 14.
11. **`display` vs `visibility`** — v3 distinguishes `display: none`
    (no space) from `visibility: hidden` (occupies space) from
    zero opacity; v4 has one `show`/`hide` flag.  Call: is one flag
    enough, and what do `visible()`/`takesUpSpace()` mean exactly.
    **Resolved 2026-08-01 (third design sitting): both tiers exist
    — show/hide stays the display tier (now re-fanning bezier
    bundles, v3's structural semantics), `visibility` lands as a
    mapper-capable style prop keeping space and bundle ranks —
    scoped as round 22 (plan at the end of this file).**
12. **Odds and ends** — trued up 2026-08-03 (round 28.3), because
    three of the six entries had stopped being true:
    - ~~`cy.window()`~~ — **exists** (`core.mts`, with a "v3 parity"
      doc comment).  It was listed as a gap it had already closed.
    - ~~`panBy` animation target~~ — **landed as round 28.2**
      (2026-08-03).
    - ~~layout instances as event emitters~~ — **not a gap but a
      decision**: round 17 settled that lifecycle events fire on the
      core exactly once per run and layout instances stay
      non-emitters (recorded in the README's extension-contract
      section).  It belongs in the decided-design ledger, not here.
    Genuinely open, each needing a call rather than an
    implementation:
    - ~~**`cy.gc()`**~~ — v3's manual garbage-collect hook.  Round 19
      gave v4 `cy.compact()` plus an automatic trigger, so the question
      was whether `gc` survives as anything but an alias.  **Landed as
      round 39.3** (2026-08-04): it survives *as* the alias, the alias
      table's 84th row, kept because an upgrading app already types it
      and v4 has no separate garbage-collection concept for it to name.
    - **`cytoscape.warnings()`** — the global console-warning toggle.
      v4 warns in several places (a deferred `compact()`, a full glyph
      atlas), so there is something to silence; whether a global
      mutable switch is the v4 spelling is the call.
    - ~~**graph-level `data` in the wire format**~~ — narrower than it
      read: `cy.json()` **already exports** it (`core.mts`), and the
      gap was the *binary* format (`serializeElements`), which carried
      elements only.  Since `cy.serialize()` output feeds `cy.add()`,
      including graph data raised whether adding elements should
      overwrite the target's `data()` — a semantics call, not an
      omission to patch.  **Landed as round 39.2** (2026-08-04): format
      version 4, flag `F_GRAPH_DATA`, one JSON string written last so
      v2/v3 buffers keep loading; `options.elements` applies graph data
      and `cy.add( buffer )` ignores it.

### Proposed-drops triage (decided 2026-07-29)

The proposed-drops list was triaged with the user in one sitting;
every entry now has a decision.

- **Dropped** (added to the decided-design ledger above):
  - **Canvas-era performance hacks** — `hideEdgesOnViewport`,
    `textureOnViewport` (+ `outside-texture-bg-*`), `motionBlur`/
    `motionBlurOpacity`.  Obsolete under WebGPU + compute culling +
    adaptive render scale, which solve the same problem without
    degrading interaction.
  - **`background-blacken`** — subsumed by color mappers (compute the
    shade in the mapper range instead).
  - **`bounds-expansion`** — a manual bb-correction escape hatch;
    unnecessary when bounds are computed correctly.
  - **Legacy aliases** — `content`, `autolockNodes`/
    `autoungrabifyNodes`, `padding-{left,right,top,bottom}`, the
    no-dash shape spellings (`roundrectangle` etc.), `attr`-family
    duplicates beyond the ones already kept.  One name per concept.
- **Kept** (moved to "gaps with direction set" above):
  - **`curve-style: haystack` (+ `haystack-radius`) and
    `straight-triangle`** — ported as *real visual styles*, not perf
    modes, alongside the curved-edge work.
  - **Ghost props** (`ghost`/`ghost-offset-*`/`ghost-opacity`) —
    needed for SBGN, kept with simplified scope: the ghost duplicates
    only the basic node body (shape, border, background) at the
    offset — an extra draw, but simple — never a whole-cloth redraw
    of the full node (labels and other decorations excluded).
  - **Overlay/underlay as style props** (10 props + `active-bg-*` +
    `selection-box-*` core props) — port the props; the baked-in
    affordances (shader hover/active brighten, accent ring, DOM
    selection box) become the styled defaults.
- **Deferred into the multiline/label-bb round** (the listed lean,
  now decided): **`text-metrics`**, **`box-select-labels`** — their
  v4 form is designed there; neither ported as-is nor dropped now.

### Suggested sequencing (unchanged by the sweep, now grounded in it)

The sweep confirms the two headline pillars — **curved edges** and
**compounds** — dwarf everything else in app impact, with
**background images** the sleeper third (16 props, near-universal in
production apps).  Of the near-term autonomous work, slot-stable
compaction landed as round 11 and edge-label autorotate landed
2026-07-29 — the autonomous shelf is clear.

The
design queue, in suggested order: curved
edges (12a — bundled bezier + self-loops — landed 2026-07-30 and 12b —
unbundled/segments/taxi — 2026-07-30/31; 12c endpoints +
haystack/straight-triangle remains; since complete) → compounds
(landed as round 14, 2026-07-31) → background images + the
node-visual scope call
(ghost's simplified body-duplicate form slots in here) → the event
vocabulary + extension contract calls (cheap to build once decided,
and they unblock the ecosystem) → force layout.  Overlay/underlay
theming props ride with the interaction/visual batches.

The
proposed-drops list was triaged 2026-07-29 (see the section above):
four entries dropped into the decided-design ledger, three kept with
direction, and `text-metrics`/`box-select-labels` folded into the
label-bb round.

**2026-08-01 design sitting**: with rounds 12–14 landed, the
remainder of the queue was scoped in one sitting (plans at the end
of this file): **z-index dropped outright** (decided design, no
round at all) → background images (round 15) → multiline labels +
label bb (round 16) → event vocabulary + extension contract
(round 17) → GPU force layout (round 18).  **All four rounds landed
in full the same day** — the queue is clear.

**Since then**: round 19 (slot-moving compaction) closed the last
architecture item, round 20 closed gap item 8 (interaction options +
touch parity), and the **third design sitting** (2026-08-01) scoped
and landed rounds 21–23 (animation queue removal, the
display/visibility split, node charts) — see the plans and records
below.

What remains of the needs-a-call list: ~~the animation
controls/transitions follow-up~~ (item 9's open half — **scoped as
round 24 by the fourth design sitting and landed in full the same
day, 2026-08-01**; ~~the geometry-tween round it logged~~ landed as
round 25, 2026-08-02), ~~the small parity remnants noted inline in
items 4–6~~ (**closed by round 27, 2026-08-02** — v3's node-shape and
arrowhead vocabularies are complete and numeric `text-rotation`
landed; the one remainder is `border-style`/`outline-style`, held for
the scope call item 4 itself asks for).

~~Items 8's deferred overlap
box mode, 10's core/collection extension points and 12's odds and
ends~~ — **all closed at the fifth sitting and after**: overlap box mode
landed as 39.1, extension points stay out by decision, and 12 split into
`cy.gc()` (39.3), graph data on the wire (39.2) and `cytoscape.warnings()`,
which is round 40's.  (Dated for clarity: this paragraph is 2026-08-02's
reading, superseded by "As of 2026-08-04, what remains" below.)

**2026-08-02, rounds 26–27**: round 26 built the authoring surface —
JSDoc across the whole prototype (46% → 100%, gated) and the first
shipped TypeScript declarations for `cytoscape` — and round 27
closed the visual-parity tail.  What is left of the whole ledger:
**`border-style`/`outline-style`** (a scope call, 27.8), item 8's
overlap box mode, item 10's core/collection extension points, and
item 12's odds and ends.

**2026-08-03, rounds 28–29.**  Round 28 took the part of that
remainder needing no design call: CPU-pick coverage for round 27's shapes (28.1 — a
verification gap, not an API one), the `panBy` animation target
(28.2), and item 12's own drift (28.3, above).

**What remains of the
ledger is entirely open calls** — decisions, not implementations, and
all of them (plus the contradictions rounds 28–29 found) are collected
in "Open calls for the maintainer" near the top of this file:
`border-style`/`outline-style` (27.8's scope call), the
**legacy-alias policy** (one call over `roundrectangle`,
`autolockNodes` and `autoungrabifyNodes` — all three survived the
2026-07-29 triage that says they were dropped), item 8's overlap box
mode,
item 10's core/collection extension points, and item 12's surviving
three (`cy.gc()`, `cytoscape.warnings()`, graph data in the binary
wire format).  Nothing in the ledger is now blocked on
effort.

**Round 29** then worked a different axis entirely — not the
ledger of what is unbuilt but a survey of what is *unpinned* — and
found the alias surface untested (83 methods whose type declarations
and runtime wiring are separate things), four public methods no spec
mentioned, the decided-design drops enforced only by intention in
three places (a string event qualifier crashed inside the emitter on
the next event; a style *function* group was silently ignored; the
collection methods crashed on `other._refs` or answered false), and
curved edges unpriced on the CPU.  It also closed 27.9 by measuring on
the RX 580: round 27's shader branches cost nothing per frame.  (This
paragraph ended with a sentence calling that measurement "open and
blocked on neither — just unrun" *after* 29.5 had run it — written
during the round and left standing by 29.6's own sweep.  Removed in
30.5, and noted here because it is the third round running that this
summary has been the thing that drifted.)

**2026-08-03, rounds 30–32.**  Continuing round 29's axis onto the part of
the surface v4 states most and tests least — **what it throws**.
Measured with source-mapped coverage: 34 of the 191 throw sites in
`src` had never executed.  30.1 closed every Node-reachable one
(20 specs, one of whose controls came back BAD and forced a sharper
spec), 30.2 pinned the six export guards in the browser project, 30.3
took the untested public surface the survey turned up beside them
(`cy.stop()`, `renderedTargetEndpoint`, two clustering metrics), and
30.4 shipped the measurement as `scripts/throw-coverage.mjs` —
reporting only, since a coverage floor is a call, now logged as open
call 8.

Reading at the close: 176 run, 13 browser-only, 2
unreachable by design, **0 Node-reachable and never run**.
**Round 31** then asked what those throws *say*: it found the
per-element bypass error advising the style function form — removed in
round 8, throwing since 29.3 — fixed the message and its doc comment,
took `@throws` on public throwing members from 7/16 to 16/16 under a
gate, and covered `mouseout`/`pointercancel`, the last two names of
the round-17 event vocabulary no test mentioned.  Its lesson is about
sweeps rather than about errors: the markdown had been right all
along, and the wrong text was in a runtime string and a JSDoc block.

**Round 32** finished the contract sentence's remaining clause —
`@param` on every public member that takes arguments (143 → 221 of
221, gated) — with the boundary drawn by docmaker's own shape:
arguments carry a description the generator emits, returns do not, so
the `@returns` tail (63 of 276) is measured and logged rather than
built.

**2026-08-03, round 33.**  The benchmark sweep, on the user's scope
call: benchmark everything possible, core through renderer.  Fourteen
suites became twenty-two; the surfaces that had *no* measurement at all
— layouts, four algorithms, the style engine's apply and readback paths,
loading and the wire format, picking/box-selection/bounds, the data
sidecar and structured queries, events and the animation lifecycle,
store internals, images and charts — now have one, plus a 117-row
breadth pass over the rest of the public API and a third audit script
reporting which members a benchmark calls.  Open call 7 closed with it.

The round's most useful output is not the wins (they were mostly where
earlier rounds said) but the **five places v4 is slower than v3 or
slower than its own design implies** — the style getters at 13–21×
(*5.8× on re-measurement through the bundle; see round 34.0*), the
compound emit path never taking the no-listener fast path, the layout
contract's per-run whole-graph materialization, `mutableElements()` and
`indexOf()` — each measured, localized and logged rather than fixed,
because a measurement round measures.

Six rows across the round were
**caught measuring nothing** by design call 5 and rewritten, and one of
those (`curves.mjs`'s box-selection premium) had been published in the
README since round 29.4.

**2026-08-04, round 36.**  The completion round: after 35, what remained
in this file was the twelve open calls plus a short tail that needed no
decision at all, and this round is that tail and only that.  `@returns`
went from round 32's measured-and-deferred 63-of-276 to **276/276**,
written but deliberately **not** gated — round 32's boundary (docmaker
emits a description per argument and has no return field) is where the
gate stays.  Writing it turned up that the `@param` gate had never
walked the public tier's *exported functions*, so `wire.mts` and
`columnar.mts` sat outside an audit reporting 221/221; now 229/229.

The
browser-only throw tier, opened by round 30 and half-closed by 30.2's
six export guards, is finished — **four specs and three honest
reclassifications**, since three of the seven are guards no input
reaches (one of them shadowed by a synchronous check twenty-five lines
above it).  Two public collection members no benchmark had ever called
got rows, chosen so they *walk* rather than short-circuit.

And three
measurements this file had promised and never taken were taken:
`--layout` on the RX 580, the wall time of each report profile (quick
7.1 min, `--all` 17.4), and a re-runnable source for rounds 34–35's
bundle figures, which reproduced round 35's numbers and refined one —
the post-table spread is two populations, and the upper one is colour
*formatting* rather than dispatch.
The round's own finding is a **stranded-doc-block check**.

The defect
— a later insertion landing between a doc block and its member — has
happened eleven times here, and the coverage gate catches it only when
the displacement leaves some member bare; when it lands on another
documented member, coverage stays 100% and two members carry each
other's prose.  The check found **six more on its first run**, and one
of them was shipping in `dist/cytoscape.d.ts`.  It reports rather
than gates, because the third shape of the defect — a block displaced
onto a different documented member — is not statically detectable at
all, and because it cannot tell a deliberately free-standing note from
a displaced block.

**2026-08-03, round 35.**  The maintainer read round 34's residual —
"the style getters are still 2.3× and the cause is a 145-case switch" —
and asked the obvious question: why is a 145-case switch there at all,
and why not a direct lookup?  Both halves were right.  The count is not
accidental (one entry per readable property, median two lines each), but
the *shape* cost something real: V8 does not hash a string switch that
large, so a property's read cost depended on its position in the file —
which is also why rounds 33 and 34 understated the getters, having
measured `background-color`, the fourth case.

Round 35 turned the
switch into a `Map` of 111 readers behind a 153-property
characterization spec, flattening the spread from 5.1× to 2.3× and
making a whole-object `style()` 1.27–1.48× faster.  The lesson worth
keeping is not about switches: **the round happened because someone
asked why a number was shaped that way, after the measurement rounds
had accepted it.**

**2026-08-03, round 34.**  The fix round for what 33 measured.  All five
paths are fixed — `indexOf` and `mutableElements()` at parity with v3,
the emit path's new no-listener gate at 8 ns, the layout contract 420×
cheaper per run, the style getters 5.8× → 2.3× — with no behaviour
change and no pixels moved (168/168 browser specs, goldens byte-stable).

Two of the five findings were **corrected while being fixed**: the style
gap was inflated by tsx's `__name` wrapper (the benchmark suites import
`src/`, and for a closure-heavy hot path that measures the transpiler),
and the row round 33 cited for the emit finding never reached the emit
path at all — it was measuring compound auto-bounds invalidation.  The
transferable rule is now in `AGENTS.md`: **check a hot-path finding
against the built bundle before rewriting anything**, since the planned
`readProp` fix turned out to be a no-op in production and the real cost
was `normalizeProp` doing a regex replace per read.

What is left of the five is a **residual 2.3× on the style getters**,
which is no longer a hot spot with an obvious cause — it is the
145-case switch and the guard lookups that precede it.  Not logged as an
open call: it needs no decision, only appetite.

**2026-08-04, the fifth design sitting — the production-readiness
roadmap.**  With round 36 done, everything left in this file was open
calls, and the sitting took all of them (the per-item records are in
"Open calls for the maintainer" above).

What follows from the answers
is **rounds 37–51**, planned at the end of this file: the governance
close-out (37 — the two new gates, the alias split, the strictness
closures), the full `border-style`/`outline-style` port (38), the
decided feature tail — overlap box mode, wire graph-data, `cy.gc()` —
(39), the error-policy sitting + `cytoscape.warnings()` (40 — the one
question the sitting deliberately left open), the v4 Event + emitter
(41), the **`v3/` restructure** that makes v4 the package's default
export (42), packaging/publish hardening (44), the JSDoc→docmaker
generator (45), the v4 docs site (46), the migration guide + CHANGELOG
(47), robustness/soak (48), cross-platform validation (49), release
engineering + `4.0.0-alpha.1` (50), and the release bake to **4.0.0**
(51).

(The numbers from 44 on are one higher than this sitting wrote
them: round 43 was inserted later for the debug harness.)  This sitting's edit touches PLAN.md only, at the maintainer's
instruction; the README true-up (header, follow-up hooks) lands with
round 37's docs-first commit — noted so the standing docs-travel rule's
exception is on the record rather than silent drift.  "Gaps with
direction already set" was checked by name and needed nothing (its
entries all closed by earlier rounds).

**2026-08-04, round 41 — the v4 Event and emitter.**  Taken out of order
(38 is waiting on the sub-calls above, 40 is a sitting), and worth it: it
is round 42's precondition and it closed the last of the round-26.5
logged items.  v4 now owns its event object and its emitter, `event.target`
is typed, `originalEvent` is populated, and the namespace parsing v4 had
been *inheriting while its design disclaimed it* is gone.
Two of the round's own premises were wrong, both stated as facts about
code nobody had re-measured — see the round record.

The emitter was not
v4's only outward import (five utility modules remain, now audited by a
spec instead of asserted by a sentence), and `preventDefault()`'s gesture
half could not be enumerated "from v3-source reading" because v3 never
reads the flag either.  The DOM half landed; the enumeration is open call
12.  That is three rounds in a row — 37.3, 37.4, 41 — that tripped on a
stale claim in this file, which is now a standing note in `AGENTS.md`.
The emitter swap itself is behaviour-neutral by measurement rather than
by intent: the whole Node suite passed unchanged except the one spec
round 37.4 had written to pin the behaviour this round removes.

**2026-08-04, round 39 — the decided feature tail.**  Three independent
small builds, all decided at the fifth sitting and none needing a new
call: overlap box selection (39.1), graph-level data on the binary wire
(39.2), and `cy.gc()` (39.3).  Round 38 is deliberately **not** what
followed 37: scoping it found three sub-calls the sitting had not
reached (v3's `double` *erases* a stripe rather than drawing a second
band; `dashed` borders need `border-dash-pattern`/`-offset`, which v4
has for edges and not for nodes; `border-cap`/`-join` have no v4
counterpart), which are logged in open-call 1 as that round's
docs-first agenda rather than guessed at inside it.

What 39 is worth remembering for is its **verification**, not its code.
Every overlap spec passed on the first run with the exact flattened walk
deliberately removed — the conservative bb reject was answering every
one of them — so three of them were measuring nothing until two
"band inside the bb that the path does not reach" specs were added.  The
benchmark had the same disease one layer along: its curved row used
`curve-style: bezier`, which bundles multi-edges only, so a fixture with
no parallel pairs priced straight edges under a curved label.

Both are
`AGENTS.md`'s standing rule arriving in a round that had already read
it, which is the argument for running the control rather than trusting
the reading.
And the round-37.1 gate fired **twice, correctly**: edits to
`graph-store.mts` and to `wire.mts`'s header comment moved two
`UNREACHABLE` entries out from under their `file:line` keys, and the
build failed naming them.  That is exactly the failure 37.1 was built
for, arriving in the very next round.

**2026-08-04, round 37 — the governance close-out.**  The first of the
sitting's rounds, and deliberately the smallest, because its gates
protect every round after it.  Throw coverage and `@returns` now gate
(37.1), with the classification allowlists checked rather than merely
written — a zero-tolerance gate is only as good as its escape hatch,
and this one is keyed by `file:line`.  The 2026-07-29 alias triage is
finally applied as decided (37.2): `roundrectangle` drops from all
three enums that took it, `autolockNodes`/`autoungrabifyNodes` stay as
recorded exceptions, and both documents' ledger lines say so.

Constructor strictness closed at the type layer (37.3) and event-name
openness documented (37.4).

Two of the five items **corrected this file rather than executing it**,
which is the round's real character.  37.3 set out to write a
compile-only test and found that `src/index.mts` — the package
entry point, listed in `PUBLIC_API` since round 26 — contributed *zero*
members to every audit, because the exported-function pattern did not
spell `export default function`; all three of its tags were missing
behind a green gate.  That is round 32's blind spot and round 36's
widening arriving a **third** time, and it says something about audits
that "an audit's scope is part of its claim" has now had to be learned
once per round that touches one.  37.4 set out to document the event
contract and found the namespace record wrong: v4 was still importing
v3's emitter, so namespaces worked in full v3 semantics — what was true
is only that v4 never emits a *qualified* name.  Both corrections land
in the documents and in round 41's plan, which had described removing
dead machinery — and round 41.2 has since removed the live machinery
it actually was.

**Round 42** (2026-08-04) executed the sitting's packaging decision and
changed no behaviour: v4's source promoted from the old `src/gpu/` to
`src/`, the whole v3 file set moved into a self-contained, still-buildable
`v3/`, and the root `package.json` became `cytoscape@4.0.0-unstable` with
v4 as `exports["."]`.

Both calls the plan left to docs-first were taken —
the `gpu-`/`webgpu-` prefixes drop, and the five shared utility modules
duplicate rather than stay shared, so nothing under `src/` imports outside
it — plus a third the plan did not anticipate: the **v4 identity rename**
(bundles, declaration, UMD global and the default export are all
`cytoscape`), which 42.6 then carried into the exported **type** names, so
the whole public surface is unprefixed.
Behaviour-neutrality was established by comparing blobs rather than by the
suite alone: see the round record.

**Round 43** (2026-08-04) is the odd one out, inserted at the maintainer's
request between the restructure and the release sequence (which renumbered
44–51): the **debug harness**, v4's only manual page and the first thing anyone
sees.  It was broken — four fixtures 404'd after round 42 moved the v3 tree,
silently, because a fetch had no `.catch` and nothing tested `debug/` at all —
and it was flattering nobody: its style sanitizer kept a 14-property whitelist
and dropped every mapper, so v4's whole style surface was being discarded before
it reached the core.

Now hand-authored production sheets per fixture (the real
enrichmentmap.org style among them), two real compound graphs, the v3 page's
control sections, and a module spec that compiles every sheet against its own
fixture.  It also fixed the active-bg indicator, and gave `debug/` its first test.

**And it needed a review pass one day later** (2026-08-05, recorded as
43.10–43.13), which is the round's real lesson rather than a footnote to it:
its own risk note said "the module spec proves the sheets *compile*, not that
they still look right, so a property that changes meaning rather than
disappearing will not be caught by anything but opening the page" — and the
maintainer opening the page found three things, none reachable from any suite.

LiveReload had never connected on either project (it binds `localhost`, which
resolves to `::1`, while `http-server -o` opens 127.0.0.1); the harness's own
event log turned one box selection into 22,406 forced layouts, 5,659 ms inside
a 6,055 ms handler, because it read `scrollHeight` after every appended row;
and the compound fixture was **not** the verbatim port 43.4 claimed — the node
order had been sorted and v3's `cols: 3` dropped, which between them made the
parent boxes overlap.

Chasing the third turned up a **library** defect the
page was merely displaying: the conservative `fit()` scan added a chord term
to compound-loop edges that belongs to weight-extrapolated routes, so a
compound graph fitted at a third of its size.  Three specs and their controls
landed with the fixes — and one of those controls came back BAD first, because
grid takes its column count from the container's aspect ratio and a headless
instance is not the page's shape.

**2026-08-04/05, rounds 44, 45, 47 and 48 — the release sequence's
decision-free part**, taken in that order and skipping 46 (which needed 45
first) and 49–51 (which need hardware, or are a publish).  What they have in
common is worth naming, because it is the same shape four times: **each
round's most useful output was a thing its own plan was wrong about.**
Round 44 was written as three decisions and two of them were never open —
v3's tracked `dist/` already answers what ships at release, and `src/`
already ships as v3's does — so what the round actually delivered was the
missing *check* that the manifest, the build and the tarball agree.

Round
45's plan cited a `test:types:docs` precedent that is **v3's**, and runs the
other way round; building the generator then turned up `event.mts` outside
the audit's public tier (the fourth instance of "an audit's scope is part of
its claim"), optional class members invisible to every audit's member
pattern, and a layout-extension contract that shipped no types at all.
Round 47's property table would have been wrong in at least four entries had
it been written from the ledger instead of measured against both libraries.
And round 48 found four defects, three of them in a format nine rounds had
called finished.

The transferable part is round 33's rule arriving in a fifth costume: **a
plan's statements about the code are claims to re-measure.**  Every one of
these rounds spent its first hour measuring what it had been told, and every
one of them found the telling wrong somewhere.

**As of 2026-08-05, what remains.**  (Superseded by the 2026-08-06
paragraph below.)  Unbuilt: round 38 (blocked on the
three sub-calls in open call 1), round 40 (a design sitting), round 41.5
(open call 12), **round 46** (the docs site — no longer blocked, since
round 45 built its input), **rounds 49–51** (cross-platform validation,
release engineering, the release bake), and two tails: round 48's
documented limit edges (the 256-layer image cap, a full glyph atlas, the
export texture cap) and round 44's one release-time act — the first
release build must actually commit the five `dist/` bundles, which is
round 50's.

Undecided: the **error policy** (round 40) and the
**preventable-gesture enumeration** (open call 12) — still the only two
genuinely open questions, both of which the ledger holds rather than any
round record.  Rounds 44, 45, 47 and 48 opened no new ones, but **two of
them changed public surface** and both are logged in "Open calls for the
maintainer" as items 14 and 15: 45 exported the layout contract's types,
and 48 made twelve collection methods throw where they had been
answering wrongly across instances.  Neither needed a decision to *make*
— one is a missing export, the other a wrong answer — but both are
visible to a consumer, so neither is left to be discovered in a diff.

**The 2026-08-05 review pass of round 43 adds a third** (item 16): a
no-argument `cy.fit()` frames a compound graph with related edges
tighter, because the conservative scan was adding a chord term that
belongs to a different curve kind.  It also leaves one thing logged and
unbuilt — a **bounds round** for the conservative fit box, which grows a
disc around each endpoint *centre* by a *global* node-half maximum where
several kinds' geometry is directional and per-edge; the compound
fixture still fit at ~1.8× its exact box after 43.13.  *(That round
became round 54 and landed 2026-08-08: fit zoom 0.607 → 0.822.)*

**As of 2026-08-06, what remains** (supersedes the paragraph above,
after rounds 46.6, 52's scoping, 53–53.2 and the sixth design sitting).

Unbuilt: ~~**round 38** (unblocked — its three sub-calls are taken)~~ —
**landed 2026-08-08**, full coverage with five parity scenes and their
controls —
**round 40** (the error-policy sitting, taxonomy-first prep approved),
**41.5** (direction set — explicit toggles first; the enumeration lands
at its docs-first), **round 46** (the docs site), ~~**round 52** (the
WGSL comment-strip — decided to build, and it must land before round 50
cuts the alpha)~~ — **landed 2026-08-08**, 19.0 KiB gzipped off the
download with pixel-identical output — ~~**round 54** (the bounds
round, newly scheduled before round 49)~~ — **landed 2026-08-08**, fit
zoom 0.607 → 0.822 on the compound fixture with the sweep promoted to a
standing gate — **rounds 49–51** (cross-platform,
release engineering, the bake), ~~round 48's documented limit edges~~
(**landed 2026-08-08** as 48.6 — three browser specs, five controls),
and round 44's release-time act.

Undecided: the **error policy** (round 40) and the
**preventDefault enumeration** (item 12) — still the two genuinely open
questions — plus two conditional ledger entries, **miniray** (item 17,
measure-first, expected never taken) and the **tween warm-up** (item
18, revisit with data).  Items 14–16 are ratified and closed; the
`executePlan()` coverage gap and CI's removed job timeout stay recorded
decisions rather than open ones.

**2026-08-07, round 57 — the cleanup round.**  Six items the maintainer
raised, all landed.  Three are the repository looking after itself:
`oxfmt` replaces this repo's own call-spacing (57.2), the two long
documents stop opening with a wall of text and say plainly that v4 is
not close to a release (57.3, 57.4), and the status build's path checker
gets a maintained allowlist so its warnings mean something again (57.6).
Two are for looking at pixels: four networks ported from v3's
documentation demos (57.5), and v3's default *look* — selection on
nodes, edges and arrowheads, and `:active` through the round-13 A2
overlay props (57.1).

What is worth carrying forward is, again, what measurement said rather
than what the round built.

**A formatter is a free control on every tool that reads the sources as
text.**  Reformatting the tree falsified all their layout assumptions at
once and found four defects: five public members whose parameters
wrapped were **skipped** by the `@param` gate (232/232 was reading a
surface of 239, with five untagged behind it), `memberBody` stopped at a
wrapped parameter line and again at a multi-line return type so
`@throws` detection fell silently, an `export const f =` that broke
after the `=` vanished from all four audits, and the **throw gate had a
false pass** — a guard inside a module-level arrow const read as covered
through the misattribution the script documents as its own blind spot,
while no spec had ever fired it.

None of that was caused by the
formatter; all of it was hidden by the previous layout.

**The item that looked like a colour change was a design question.**
"The default stylesheet should look like v3's" measured to almost
nothing on the property surface — `#999` on both sides for nodes and
edges since round 1, and 68 of 72 differing (group, property) pairs are
spelling — because the two things that differed are not properties at
all.

A selected edge in v4 was indistinguishable from an unselected
one, and `FLAG_ACTIVE` had existed since round 6 with nothing reading
the bit.  Building both turned up the divergence the round could most
easily have shipped silently: v3's selection colour lives in the
*default* stylesheet, so any user block naming a colour beats it, while
v4's — as first built — was drawn by the shader and always won.

That divergence turned out to be the question rather than a footnote.
The reasoning for accepting it was "there is no `:selected` to write",
and v4 has no *selectors* but it does have **conditions** — so the rule
went into v4's own default stylesheet as `{ when: { selected: true } }`,
spread before the user's block, which is v3's precedence rather than an
approximation of it.  Round 57.1d has the whole of it, including what
came out of the shaders and why the default sheet costs nothing.

**And a spec written for a new fixture found a defect on its first
run**, which is the argument for writing the property rather than the
smoke test: the debug demos' `arrow-fill` never resolved to `hollow`,
because a clause helper built its keys with `Object.keys` and turned the
boolean `true` into the string `'true'`.  Twelve identical filled heads
would have looked entirely plausible.

**Amended 2026-08-07 (round 56, then closed by round 57).**  Round 57
(cleanup) joined the unbuilt list here and has since **landed in full**
— `oxfmt`, the two documents' readability and their readiness language,
four `debug/` networks from v3's demos, the status build's path
allowlist, and the default look moved onto v3's: state is a `case`
condition, and v3's `:selected`, `:parent:selected` and `:active` blocks
are entries in v4's default stylesheet.  So the unbuilt list above stands
as written.

The same amendment added two questions to
the undecided one: the **`arrow-scale` quantization** (item 23 — closing it
spends the six reserved packing bits, which a 17th arrow shape also
wants) and **where the arrow trim cannot reach** (item 24 — edge labels
and the layer strokes; a binding rather than a decision).

And a caution that applies to this paragraph in particular: it is an
inventory of what has been **written down**, not a claim that finishing
it finishes v4.  The maintainer can name several rounds that are not
logged yet, and rounds 43, 46.5, 55 and 56 were each inserted after the
sequence they interrupt was already planned.  Round 57 item 4 exists
because these summaries had drifted into reading like a complete plan.

**Amended 2026-08-07 (during round 57).**  Two of those unlogged rounds
are now logged, as ledger items **25** (bring the bypass UX back, spelled
as a `case` mapper) and **26** (split the big implementation files, the
way `src/algorithms/` already is).  Neither is scheduled and neither is a
question for the maintainer — they are directions with their
measure-this-first noted, which is the form that makes an idea pickable
up later.  They are also the concrete demonstration of the sentence
above: the list grew by two in the same week it was called incomplete.

**Amended 2026-08-08 — three rounds landed in one pass.**  Everything
in the unbuilt list that was fully specced and runnable on this machine
closed in a day: **round 52** (WGSL minification — 19.0 KiB gzipped off
the download, pixel-identical by the exact goldens), **round 54** (the
bounds round — fit zoom 0.607 → 0.822 on the compound fixture, and its
new randomized sweep caught a pre-existing taxi soundness hole on its
first run), and **round 38** (`border-style`/`outline-style` at full
coverage — the last unported style pair, with the plan's own ellipse
approximation replaced by exact arc length after its deviation scene
failed to discriminate).  Round 40's approved taxonomy-first prep also
ran: 198 throw sites classified, ~11 demotion candidates in two
families, the measured recommendation in the round-40 section.

What the queue now holds: **round 40** (blocked on its design sitting,
prep done), **41.5** (its docs-first proposal was written later the
same day — the section at the end of this file — and awaits the
maintainer's reaction), **round 46** (the docs site — unblocked but large and only
sketch-specced), **rounds 49–51** (other platforms, release
credentials, the bake), ~~round 48's documented limit edges~~ (**landed
later the same day** as 48.6 — the three limit fixtures, each specced at
its exact edge, with five controls), and round
44's release-time act.  Nothing else fully specced remains buildable
without the maintainer or different hardware — and with 48.6 in, round
48 is complete.

**Amended 2026-08-09 — the seventh sitting cleared the maintainer's
half of the queue by declining it.**  ~~Round 40~~ closed with **no new
surface** (errors and warnings stay as built; no `cytoscape.warnings()`
— the decision record is in the round-40 section), and ~~round 41.5~~
**does not run** (toggles are the whole gesture-control story;
`preventDefault()` is browser-level only — the record is in the 41.5
section).  Neither produces a Landed section, because neither lands
code; each section carries its decision record instead.  The same
sitting scheduled **ledger item 24 as round 58** — the arrow trim
reaching edge labels and the layer strokes, decision-free renderer
work with negligible measured risk — and ~~round 58~~ **landed the
same day** (0.000% on both new close-up scenes, controls failing at
7.7x and 27.9x their bounds; the record is beside the plan).  Its
scene drafts added **ledger item 27** (v4's edge underlay/overlay band
is `width + 2 × padding` wide where v3's is `2 × padding` — logged,
not patched).  What the queue holds: **round 46** (the docs site —
unblocked, large, sketch-specced), **rounds 49–51** (other platforms,
release credentials, the bake), and round 44's release-time act.  The
genuinely open ledger questions: item 23 (the `arrow-scale` reserve,
deferred by the maintainer), item 18 (the tween warm-up, revisit with
data), and now item 27 (the layer band width).

**Amended later on 2026-08-09: round 59 (the force layout rebuild,
raised by the maintainer) landed the same day** — the summary
paragraph above and the round-59 plan and records at the end of this
file carry it.  The queue and the open questions are otherwise as the
previous paragraph left them.

**Amended again on 2026-08-09: round 60 (the performance record, kept
honest — raised by the maintainer) landed the same day.**  The status
site gains **cross-commit benchmark comparison pages** — per-row p50
across the published runs of one (machine, profile), movers beyond
±10% with the frozen-v3 twin as a per-row noise control, and a
whole-run drift figure (verified against the archive's own two
renderer runs: drift ×1.014 where round 52.2 independently measured
1.018) — plus benchmark rows for the unpriced recent rounds (the
57.1d state-condition partition and what a select now restyles, the
round-59 spectral-vs-scatter seed split, the 57.9 hit halo) and the
tests the tooling was owed (`executePlan()`, the 53.2-recorded gap,
and the benchmark index's judgements).  It adds **ledger item 28**
(`cy.collection( anything )` silently ignores its argument where v3
builds from it — found by one of the round's own benchmark controls)
to the open questions; the queue is otherwise unchanged.  **60.4 then
ran both profiles fresh and the comparison found a real regression on
its first use**: under the default stylesheet — which conditions on
`selected` since 57.1d — every select/unselect restyles, so bulk
select went 47.9 µs → 6.3 ms at 2k with the v3 control flat: v4
flipped from 38× faster than v3 to 3.3× slower on that row.  The
measured headroom is logged in the 60.4 record (route a state flip
through the 57.1d partition records instead of `refreshMapped`); the
renderer tier read clean at −0.7% drift over 290 shared rows.

**Amended once more on 2026-08-09: round 61 closed that regression the
same day** — the state flip routes through the partition-record diff
(541.9 → 63.5 µs on the bundle-measured 256-band select; the mutators
row back to ~8.5× faster than v3), with geometry/label/transition
cases falling back to the full write.  The queue and the open ledger
questions (18, 23, 27, 28) are unchanged by it.

**Amended 2026-08-14: round 71 (cyext, the extension toolchain —
raised by the maintainer) joins the queue** with a full plan at the
end of this file.  It is independent of the reserved rounds — it
touches none of 46/49/50's subjects, and it deliberately stays out of
round 50's release-engineering territory (its `release` command is
minimal, provenance parked for 50) — and it *feeds* round 51: the
example extension it ships is the "external layout through the
round-17 contract" consumer that round 51's bake re-runs against the
published tarballs.  The queue is otherwise as the previous
paragraphs left it.

**Amended later on 2026-08-14: the tenth sitting swept the idea
backlog into a fifteen-item shortlist** (the sitting's record is at
the end of this file) and scheduled two things from it: **round 72**
(the algorithm perf follow-ups logged by 65.8/69.6/70.4, gathered
into one round — full plan at the end of this file), and a **scoping
round for the WebGL fallback renderer** (ledger item 18b) to run
before the fallback's pre/post-4.0.0 positioning is decided — the
maintainer explicitly declined to make that call without data on
what WebGL2 can carry of the v4 contract.  The reserved rounds
46/49/50/51 and the open ledger questions (18, 23, 27) are
unchanged.

**Amended the same day, again: every shortlisted item now carries a
full plan — rounds 72 through 86, all at the end of this file.**
72 the algorithm perf follow-ups; 73 the WebGL2 fallback scoping
round (the feasibility record, not code); 74 the worker-pool CPU
executor (ledger 29); 75 the DX polish bundle; 76 the small style
wins bundle; 77 SVG vector export; 78 headless Node image
generation; 79 official JSON schemas; 80 node charts (heat, bars,
the slice ceiling); 81 the annotations layer; 82 cluster hulls +
collapse/aggregation proxies; 83 GPU edge bundling; 84
attribute-table and filter affordances; 85 the layouts round; 86
the worker-hosted renderer.  The numbers are identifiers, not an
execution order: 72 runs first (decided at the sitting), 73 early
because its record gates the release-shape decision, 86 explicitly
depends on 73's outcome, and the rest interleave small bundles
between the large arcs at the maintainer's discretion.  Planning
verified every plan's premises against the source, and two
shortlist items dissolved on contact: **gradients are already
landed** (round 13 C2 shipped the whole surface, golden and v3
parity scene included — round 76 closes the demand log honestly
instead of building), and **container auto-resize mostly exists**
(an unrecorded ResizeObserver since round 42 — round 75 records,
routes and tests it rather than building it).  Three plans
recommend splitting at a named seam before execution (76's
screen-space sizing, 82's hulls/collapse halves, 85's force
constraints); each split is the round's first Open item.  Every
plan ends with an **Open:** paragraph of maintainer decisions to
take at that round's own sitting — none are decided by the plans
themselves.
