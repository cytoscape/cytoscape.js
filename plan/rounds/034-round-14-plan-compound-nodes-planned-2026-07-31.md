## Round 14 plan — compound nodes (planned 2026-07-31)

The head of the design queue: parent/child hierarchy, auto-sized
parent nodes, compound draw order, ancestor-gated visibility/opacity,
event bubbling, compound loop edges, and the compound
style/query/API surface.  Design discussed and signed off in one
sitting (2026-07-31); this section records the calls and the pass
split so the round can run under the round-10 process rules
(isolated commits, docs in-commit, full verify per item, escalation
on any new API-semantics question).

Two process amendments,
user-set for this round: **docs land first** (this plan section and
the README pointer are their own commit before any implementation),
and each item is **tests-first** — its specs are written and seen
red before the implementation brings them green, landing together as
the item's isolated commit so every commit on `v4` stays green.

**Signed-off design calls:**

1. **Parent styling takes both decided forms.**  (a) The sheet gains
   a **`parents` group** overlaying the nodes group for parent slots
   — constants or mappers, defaults = v3's `:parent` block
   (`shape: rectangle`, `padding: 10`, `background-color: #eee`,
   `border-width: 1`, `border-color: #ccc`).  (b) The `case`
   mapper's `when` gains **structural boolean conditions**
   (`{ parent: true }`, `{ child: true }`).  Query objects gain the
   matching `parent`/`child` boolean keys.  The v3 `:parent:selected`
   tint is dropped — v4 never restyles on selection (the shader
   accent ring is the selection affordance); recorded deviation.
2. **Event bubbling is ported** (reversing v4's flat-emit rule for
   compounds only): element events bubble child → ancestors → core
   with v3 semantics — `event.target` stays the originator,
   `stopPropagation()`/return-`false` halts the walk.  The flat
   no-compounds path stays byte-identical (zero cost).
3. **Pass-1 scope**: hierarchy + traversal API + `move({ parent })`
   + remove-cascade + auto-bounds with padding + parents-under-
   descendants draw order + parent drag moves subtree + parent
   labels, **plus** ancestor-gated visibility, rendered
   effectiveOpacity (ancestor product), compound loop edges, and
   `min-width`/`min-height` as a **simplified centered clamp** —
   the four bias props (`min-width-bias-left/right`,
   `min-height-bias-top/bottom`) are dropped by decided design
   (their px-reinterpreted-as-percent rule and ratio normalization
   don't earn their surface; the centered clamp is exactly v3's
   default-bias behavior).

     **Future-round note (user-set): revisit
   asymmetric parent spacing with a cleaner mechanism — e.g. four
   per-side padding props — rather than resurrecting the biases.**
4. **Dropped/recorded**: `z-compound-depth`/`z-index-compare` (the
   z-index round); `compound-sizing-wrt-labels: 'include'` throws
   (labels are excluded from bb in v4 — the prop parses,
   `'exclude'` is the only accepted value); the bias props and
   `:parent:selected` (above).

**Global decisions:**

- **Flag bits** (`contract.mts`; 4096+ free): `FLAG_PARENT = 4096`
  (has ≥1 child), `FLAG_CHILD = 8192` (has a parent),
  `FLAG_SELF_HIDDEN = 16384` (own display state).  **`FLAG_VISIBLE`
  is redefined as the *effective* shown bit** (own state AND no
  hidden ancestor) — every consumer (WGSL `SHOWN`, the cull
  predicates, `scanRefsInto`, `boundingBox`, CPU pick, and the edge
  kernels' both-endpoints-SHOWN tests) already reads it, so
  ancestor gating and edge gating land with zero shader or scan
  changes.  Store-managed derived bits follow the `FLAG_CURVED`
  precedent.
- **Parent geometry is materialized into the real
  `node.size`/`node.position` columns** by a lazy pull-based flush
  (the CurveIndex pattern), so bb, cull, pick, `refsInBox`, the
  mirror and all shaders need zero geometry changes.
  `GraphStore.flushDerived()` = `hierarchy.flush()` then
  `curves.flush()`, replacing every `curves.flush()` call site —
  hierarchy first, because curve derivation (loops, compound loops,
  endpoint math) reads the sizes/positions the hierarchy flush
  writes.
- Verified at planning: no `StyleEngine.dependsOnSelection` exists
  at HEAD (it left with the selector removal) — the parent-flip
  restyle hook is built fresh; and v3 edge `effectiveOpacity` is the
  edge's own opacity (edges have no parent), which v4 ports.

**Design (per subsystem):**

- **HierarchyIndex** (`store/hierarchy.mts`, new; modeled on
  `store/curve-index.mts` — host-callback object, pending sets,
  `flush()`).  State: `parent: Int32Array` (−1 = orphan) +
  `parentGen` (recycle safety; mismatch ⇒ orphan + warn-once),
  `children: Map<slot, slot[]>`, `depth: Uint16Array`,
  per-parent CPU style inputs (`padding`, unit, `relativeTo`,
  `minW/H`, fallback size), `baseOpacity` (pre-fold), resolved
  padding cache, `pendingParents`, `parentCount`, `orderDirty`.

  `setParent` cycle-guards by ancestor walk (cycle ⇒ warn + no-op,
  v3), maintains children/depth/flags, marks old+new chains
  pending, invalidates the subtree's incident edges in the
  CurveIndex, and fires the style flip + structural-case refresh
  hooks.

  `flush()` expands pending to ancestors, sorts
  **depth-descending** (children-before-parents replaces
  recursion), computes direct-children bb from raw columns
  (skipping effectively hidden children), applies padding (px or %
  of children-bb w/h/average/min/max), the min-size centered
  clamp, and the degenerate-children fallback (stylesheet size at
  the stored position), then writes through `materializeGeom` —
  raw column writes + dirty marks + `updateOuterHalf` +
  `geoEpoch++` + label re-anchor when size changed + incident-edge
  curve invalidation.  `materializeGeom` **bypasses
  `setPosition`**, so no child shift and no re-marking: flush
  cannot re-enter itself.
- **Parent `setPosition`** (public path): shift all descendants by
  the delta via raw writes (locked children move too — v3), write
  the parent, mark only its *ancestors* pending (uniform subtree
  translation keeps its own derived center exact).  The bulk
  position writers and `shift`/`positions` gain v3's dedupe rule:
  skip elements whose ancestor is also in the written set.
- **Flush triggers**: the four position writers (slots with
  `FLAG_CHILD`), size/border writes (beside the `updateOuterHalf`
  hooks), add/remove/reparent, compound style writes, visibility
  toggles.  Drained from `flushDerived()` at `takeDelta` (before
  mirror sync), `boundingBox`, `refsInBox`, the collection bb
  sites, and the pick entry.
- **GPU tween demotion**: a position animation whose slots include
  any `FLAG_CHILD`/`FLAG_PARENT` node is not GPU-eligible (a GPU
  lease leaves CPU positions stale ⇒ stale auto-bounds; a tweened
  parent must shift children per tick).  Reparenting while a GPU
  position tween is live settles all active GPU position tweens to
  the CPU (rare structural op; recorded).
- **Draw order / cull / pick**: a new `parentNode` cull kind whose
  input iteration is a CPU-maintained permutation (`parentOrder`,
  parents sorted by (depth asc, slot asc), rebuilt on hierarchy
  change — compaction preserves input order, so parents paint
  shallow-under-deep); bindings positions + outerHalf + flags +
  parentOrder (+3 outputs) = 7/8.

  The existing `node` cull
  predicate excludes `FLAG_PARENT` (flags already bound), which
  also removes parents from the **depth prepass** — mandatory,
  since a prepass-written parent interior would early-z-kill the
  edges/children that must draw over it (parents lose the early-z
  benefit; recorded — they are few and flat).  `drawScene` draws
  parent bodies right after the prepass, before edge underlays,
  reusing the main node pipeline.  Parent
  ghost/underlay/overlay/label bands keep their existing post-edge
  positions — recorded z deviations deferred to the z-index round.
  CPU pick becomes two passes mirroring draw order: leaves
  descending (skip `FLAG_PARENT`), then parents in reverse
  `parentOrder`, with a shared order helper so pick and draw can't
  diverge.

  Dragging a parent needs no drag-set union (parent
  `setPosition` shifts the subtree); `FLAG_GRABBED` is not set on
  descendants (minor recorded deviation).
- **Visibility + opacity folds**: `setVisibility` sets/clears
  `FLAG_SELF_HIDDEN` and recomputes effective `FLAG_VISIBLE` over
  affected subtrees (pruned walk), marking parents pending (hidden
  children leave the bb).  `visible()` reads the effective bit;
  the display readback reads `!FLAG_SELF_HIDDEN`.  `node.opacity`
  stores the **effective** value (`base × ∏ ancestor bases` — the
  round-13 B1 fold pattern, with the base tracked CPU-side); a
  parent's opacity write refolds its subtree, gated on
  `parentCount > 0` so the non-compound path is unchanged.
  `style('opacity')` reads the base; `effectiveOpacity()` the fold.
  GPU-mapped node `opacity` (and `width`/`height`) demote to CPU
  while compounds exist (the kernel would overwrite the fold;
  auto-size owns parent sizes).
- **Bubbling**: phase-based fan-out in `core._emitOnEle` — flat
  mode (no compounds, or orphan/edge target) is exactly today's
  single emit; phased mode emits per chain element child →
  ancestors → core, checking `isPropagationStopped()` between
  phases (the shared emitter's existing machinery).  Ref-qualified
  listeners match the phase ref; predicates run against the phase
  element; unqualified listeners match only the core phase (still
  fire exactly once).  `callbackContext` returns the phase element
  (v3's currentTarget); `event.target` stays the originator.
- **Style/query**: `SHEET_KEYS` gains `'parents'`; the block takes
  node props plus `padding`, `padding-relative-to`, `min-width`,
  `min-height`, `compound-sizing-wrt-labels`.  The engine holds a
  second computed-const record (nodes overlaid with the parents
  block); apply picks by `FLAG_PARENT`; parent `width`/`height`
  divert to the fallback size (auto-bounds owns `node.size`).  The
  parent-flip hook re-applies the flipped slot's constants,
  re-bakes its label entry, transfers width/height ownership both
  ways, and refreshes structural case deps (pseudo-keys
  `'::parent'`/`'::child'` in the deps map).

  Matcher: `parent`/
  `child` boolean keys OR-composed into the flag test like
  `selected`; `group: 'edges'` + a structural key throws.  Any
  channel where the parent overlay differs while GPU-mapped
  demotes to CPU.
- **Compound loop edges**: the CurveIndex host gains
  `relation(a, b)` from the hierarchy; ancestor/descendant edges
  (and parent self-loops) derive a `CURVE_MULTI`-family blob
  record with v3's `findCompoundLoopPoints` math verbatim (two
  control points off the min top-left corner, `loopW = 50`,
  per-end stretch `max(0.5, log(w·C))`), box-bounded
  (`FLAG_CURVED_BOX`).  Applies regardless of declared curve style
  (v4 has no `edge:compound` selector — mirrors the forced
  self-loop rule; recorded).  Re-derives on reparent and on
  endpoint resize during hierarchy flush.
- **Model/API/format**: `parent` becomes a reserved first-class
  key — skipped by def/columnar data ingest, immutable via
  `data()` (reparent via `move()`), synthesized on read like edge
  `source`/`target`.  Def ingest resolves `parent` in a second
  pass after the batch's nodes exist (forward refs OK; unknown
  parent ⇒ warn + orphan, v3).  Wire format: version bump +
  optional nodes parent section (u32 index, sentinel);
  `ColumnarNodes.parent?`.

  Collection: the full traversal
  surface (slot-native), `remove()` cascade over descendants,
  identity-preserving `move({ parent })` with `moveout`/`move`,
  compound-relative `relativePosition`, real `padding()`, and
  **parent `width()` readback subtracts 2·padding** (the column
  stores the padded/drawn size; `paddedWidth()` returns the
  column) — v3 parity.  `cy.hasCompoundNodes()` goes live.
  Layouts position non-parents only; `boundingBoxAt`
  force-derives.

**Pass split** (tests-first per item; each lands green as its own
commit(s) with docs in-commit):

- [x] **14.0 Docs-first** — this plan section + the README pointer
  (landed as its own commit before any implementation, per the
  user-set process amendment).
- [x] **14.1 Hierarchy model** — landed 2026-07-31.

  `FLAG_PARENT`/`FLAG_CHILD` (contract bits 4096/8192, node-only,
  store-managed like `FLAG_CURVED`); `store/hierarchy.mts` — the
  `HierarchyIndex` (host-callback object like the CurveIndex):
  `parent: Int32Array` (−1 = orphan) + link-time `parentGen`
  (recycle guard, warn-once), sparse `children` lists, `depth`,
  live-parent count, and the lazily-rebuilt `parentOrder()`
  (depth-asc, slot-asc) draw permutation.  `setParent` cycle-guards
  by ancestor walk (warn + no-op, v3's dropped-ref rule), maintains
  flags/depths (subtree walk on reparent) and no-ops on same-parent
  writes; `removeNode` now throws while children remain (the 14.2
  collection cascade removes them first) and severs the node's own
  link.  Store delegates (`setParent`/`parentOf`/`childrenOf`/
  `depthOf`/`isAncestorOf`/`parentCount`/`hasCompounds`/
  `parentOrder`); `cy.hasCompoundNodes()` is live.  The `parent`
  data key is **reserved first-class**: def ingest skips it (14.2
  resolves it as hierarchy), `data('parent', v)` throws (reparent
  is `move()`), and reads synthesize from the hierarchy like edge
  `source`/`target` (whole-object `data()` includes `parent` only
  when parented).  Tests-first: 12 specs in
  `test/hierarchy.mjs` written red, then green — 1956 Node
  tests, typecheck + lint clean.
- [x] **14.2 Collection API + lifecycle** — landed 2026-07-31.
  Slot-native traversal on the hierarchy: `parent` (always a proper
  collection — v3's raw-ref single-element shortcut and its
  ignored-selector wart are not ported), `parents`/`ancestors`
  (level-by-level, nearest first), `children` (link order),
  `descendants` (pre-order), `siblings` (via
  parent().children() − self; orphans are nobody's siblings),
  `orphans`/`nonorphans` (filters of the calling collection),
  `commonAncestors` (closest first; an edge member empties the
  result, v3), and the `isParent`/`isChildless`/`isChild`/
  `isOrphan` predicates (booleans, first-element semantics).

  Lifecycle: `remove()` cascades over descendants + their incident
  edges (packed-seen closure; nodes removed depth-descending so the
  store's children-first rule always holds); `move({ parent })`
  re-parents in place — identity preserved, `moveout` before /
  `move` after per changed node (listener-gated), unknown parent a
  silent no-op (v3), cyclic assignment warns + drops with no
  events; def ingest resolves `data.parent` in a second pass after
  the batch's nodes exist (forward refs in any order; numeric
  parents coerce to string ids; unknown/non-node parents warn +
  orphan — v3's silent-drop case upgraded to a warning); element
  `json()` carries `parent` via the synthesized data object and
  round-trips through `add()`.

  Tests-first: 17 specs in
  `test/compounds-api.mjs` red then green — 1973 Node tests,
  typecheck + lint clean.
- [x] **14.3 Auto-bounds flush** — landed 2026-07-31.  Parent
  geometry is derived lazily and **materialized into the real
  `node.position`/`node.size` columns**, so bb/cull/pick/mirror
  need zero geometry changes.

  `HierarchyIndex` gained the pending
  set (`markGeo` marks whole ancestor chains with early-exit;
  `markAncestors` for pure translations), per-parent compound
  style (`setCompoundStyle`: padding px/% + relative-to, min-w/h),
  and `flush()`: deepest-first over pending parents, direct
  children's border-inclusive extents off `node.outerHalf`
  (hidden children excluded — v3's display:none bb rule),
  % padding against the pre-clamp children bb (v3), the centered
  min clamp, and the degenerate fallback to the **stashed style
  size** at the stored position.

  The stored size is the
  padded/drawn box: `width()`/`height()` readback subtracts
  2·padding (v3's autoWidth), `paddedWidth`/`paddedHeight` return
  the column, `outerWidth` = padded + border, `padding()` answers
  the resolved pad.  Writes go through `materializeParentGeom` —
  dirty spans, `updateOuterHalf`, the `nodeHalfMax` cull meter,
  `geoEpoch`, and a store-side **label re-anchor** (the sidecar
  entry's halign/valign reconstruct from its block-fraction
  shifts, so no engine round-trip) — and never re-mark: the flush
  can not re-trigger itself (spec-pinned).
  `GraphStore.flushDerived()` = hierarchy then curves, replacing
  every `curves.flush()` site; drains at takeDelta/bb/refsInBox/
  accessors.

  Triggers: the four position writers (a parent
  `setPosition` flushes, then shifts its subtree by the delta —
  v3's beforePositionSet — with locked children moving too; bulk
  writers take per-slot sequential semantics under compounds),
  size/border writes (`markGeo`; a style size write on a parent
  also refreshes the stashed fallback), add/remove/reparent, and
  show/hide (hidden children leave the bb).  Collection:
  `shift()` gains v3's ancestor-in-set dedupe; parent moves emit
  `position` for shifted descendants (listener-gated, v3);
  compound-relative `relativePosition` (get + both setter forms);
  parent-flip restores the stashed style size.

  Tests-first: 14
  specs in `test/compound-bounds.mjs` red then green (two
  real bugs caught red-green: the parent-move delta and the bulk
  shift both read pre-flush positions — both now flush first) —
  1987 Node tests, typecheck + lint clean.
- [x] **14.4 Ancestor visibility + effective opacity** — landed
  2026-07-31.

  `FLAG_SELF_HIDDEN` (16384) records the element's
  own show/hide state; **`FLAG_VISIBLE` is now the effective shown
  bit** (own state AND no hidden ancestor) recomputed by
  `GraphStore.setVisibility` over affected subtrees with pruning
  (an unchanged effective bit means a consistent subtree) — every
  consumer (WGSL SHOWN, cull, scans, bb, CPU pick) reads the one
  bit unchanged, changed nodes mark their chains' auto-bounds
  stale, reparenting re-resolves the moved subtree, and a child's
  own hidden state survives parent toggles (v3).  `refsInBox`
  gained the drawn-edge rule (both endpoints shown — closing a
  pre-existing gap where a hidden endpoint's edges stayed
  box-selectable).  Effective opacity renders: the node opacity
  column stores `base × ∏ ancestor bases` (bases tracked sparsely;
  writes fold at setScalar, a parent's write refolds its subtree,
  reparenting refolds against the new chain, recycled slots
  drop their state), `style('opacity')` reads the base while
  `effectiveOpacity()`/`transparent()` read the fold, edges keep
  their own opacity (v3 — verified against v3 source), and a
  GPU-mapped node `opacity` demotes to CPU while compounds exist
  (`paintInputs` + a store→engine `onCompoundsToggled` paintVersion
  bump on the 0↔>0 transitions).  Tests-first: 11 specs in
  `test/compound-visibility.mjs` red then green — 1998 Node
  tests, typecheck + lint clean.
- [x] **14.5 Event bubbling** — landed 2026-07-31.  Element events
  on parented nodes now run in **phases** — origin → ancestors
  (child→parent) → core — implemented as `_emitOnEle` re-emitting
  **one shared Event** with a moving `_gpuPhaseRef`, so
  `stopPropagation()` (or return-`false`) carries between phases
  and halts the walk (v3).

  Per phase: ref-qualified element
  listeners fire in their own element's phase with the callback
  context set to that element (v3's currentTarget) while
  `event.target` stays the originator; unqualified core listeners
  fire once, in the core phase; predicate listeners keep v3
  delegation semantics — once, against the originator, at the core
  (verified against v3's core-selector delegation, which also
  matches the target once).  Flat emits (no compounds,
  orphan/edge targets) never stamp the phase fields and take
  exactly the old single-emit path — byte-identical behavior and
  zero cost.  Within-phase order stays registration order (the
  recorded deviation narrows to within-phase only).

  Tests-first:
  9 specs in `test/compound-events.mjs` red then green — 2007
  Node tests, typecheck + lint clean.
- [x] **14.6 Parents sheet group + compound props** — landed
  2026-07-31.

  The sheet gains **`parents`**: channel props that
  overlay the nodes group for parent slots with v3's order-based
  precedence — the default `:parent` overlay (rectangle, #eee
  fill, 1px #ccc border) < user nodes block < user parents block
  (v3 applies blocks in order; the 14.9 parity scene caught the
  first cut assuming specificity ordering) — plus the
  compound props (`padding` px or 'N%', `padding-relative-to`,
  `min-width`/`min-height`, `compound-sizing-wrt-labels` where
  `'exclude'` is the only accepted value, `'include'` throws —
  labels are excluded from bb; compound props are constants-only
  and throw outside the parents group).  Padding defaults to v3's
  10.  Engine mechanics: a third GroupDef compiled from the merged
  props (parents-block mappers evaluate for parent slots only);
  `applyBulk`/`refreshMapped` partition node slots by
  `FLAG_PARENT`; mapper escalations re-partition via
  `allSlotsFor`; the readback paths route through `defFor(ref)`;
  `stylesDependOnData` consults the parents deps;
  `store.setCompoundStyle` lands per parent at apply.
  **Flip restyle**: a leaf↔parent flip re-applies the slot against
  the right group via a store `onParentFlip` hook (defaults differ,
  so flips always visibly restyle — v3); parent style width/height
  keep flowing into the stashed fallback (the 14.3 ownership
  rule).  **GPU demotion**: channels the parents overlay resolves
  differently (the default overlay's background/border colors, any
  user parents-block prop) demote a nodes-group GPU mapper to the
  CPU path while compounds exist — the kernel evaluates every
  slot and would repaint parents with the nodes value.  Readback:
  compound props answer from the per-parent record (leaves read
  the zero defaults).  Tests-first: 9 specs in
  `test/parents-style.mjs` red then green; the 14.3 bounds
  suite pins raw math by zeroing the new defaults in its sheet —
  2016 Node tests, typecheck + lint clean.
- [x] **14.7 Structural query + case keys** — landed 2026-07-31.
  Query objects gain **`parent`/`child` booleans** (`parent: false`
  = v3's `:childless`, `child: false` = `:orphan`), OR-composed
  into the one flag test like `selected` — pure columnar scans, no
  `scanRefsInto` changes.  Structural keys are node concepts: an
  explicitly-edges query throws, an unrestricted one just never
  matches edges (v3's pseudo semantics).

  The `case` mapper's
  `when` gains the structural forms `{ parent: bool }` /
  `{ child: bool }` — a structural condition stands alone (AND it
  with data conditions via the `when` array form) and compiles to
  the reserved `'::parent'`/`'::child'` keys the engine's value
  reader answers from the hierarchy flags, so deps registration,
  evaluation and refresh all reuse the data-condition machinery
  verbatim.  A reparent fires a pseudo-key `refreshMapped` on the
  moved node (`store.onReparented`); parent flips already restyle
  fully via 14.6's hook.  Tests-first: 8 specs in
  `test/structural-query.mjs` red then green — 2024 Node
  tests, typecheck + lint clean.
- [x] **14.8 Wire + columnar parent sections** — landed 2026-07-31.

  `ColumnarNodes.parent?: Uint32Array` — payload node indices,
  `NO_PARENT` (0xffffffff) sentinel — with `toColumnarElements`
  lifting def parents into it (unknown in-payload parents warn +
  orphan; the parent key never lands in the data columns), bulk
  store ingest linking after the flags fill (out-of-range indices
  throw the self-contained rule; cycles ride the setParent guard —
  the first payload link holds, the closing link warns + drops),
  and the wire format gaining the node-parent section (flag 512,
  written right after positions).  Wire **version bumps to 3**;
  the reader accepts 2–3 (a v2 buffer can never carry the parent
  flag, so old payloads load unchanged — spec-pinned by
  re-stamping a compound-free v3 buffer as v2).  `cy.serialize()`
  flushes derived geometry and exports the live hierarchy as
  payload indices (second pass — a parent may sit later in slot
  order than its children), round-tripping selection + positions +
  parents.  Tests-first: 7 specs in `test/compound-wire.mjs`
  red then green — 2031 Node + 60 module tests, typecheck + lint
  clean.
- [x] **14.9 Parent draw stream, cull, pick** — landed 2026-07-31.
  Parent bodies draw in their own stream right after the depth
  prepass (under every edge layer — v3's compound order), off a
  new `parentNode` cull kind whose input iteration is the
  CPU-built (depth asc, slot asc) permutation: the compaction
  scaffold's write expression is now parameterizable, and the
  parent kernel writes the *permuted* slot, so its visible list is
  already in paint order (outer parents under inner ones) with
  zero sorting on-GPU.

  Bindings: positions/sizes/flags/
  borderWidths + the parentOrder buffer (uploaded only when the
  hierarchy's order object changes identity) at exactly the
  8-storage budget, with the ghost cull's conservative extent tier
  (full border + the frame outline slack).

  The main `node` cull
  (and with it the depth prepass) excludes `FLAG_PARENT` — flags
  were already bound, zero new bindings — which is also what keeps
  early-z from killing the edges/children that draw over parent
  interiors (parents lose the early-z benefit; recorded — few and
  flat).  CPU pick became two passes mirroring draw order: leaves
  descending, then parents in reverse permutation (deepest wins),
  so a parent can never swallow its children's picks; the pick
  entry and export/serialize paths flush derived geometry first.
  **Two real bugs caught by the new harness**: the renderer's
  init-time mirror full-upload ran before the hierarchy flush
  (the exact 12a init-order lesson re-hit — parents rendered at
  their pre-derive columns; init now calls `flushDerived()`), and
  14.6's specificity assumption was wrong — **v3 precedence is
  order-based**, so a user nodes block overrides the default
  `:parent` overlay (the parity scene showed v3 parents in the
  user node color; the merge order and GPU-demotion set were
  corrected, with the parents-style suite re-pinned).  Verifies:
  3 new compound CPU-pick specs, a `webgpu` behavioral spec
  (child-over-parent pixels, padding band, edge-over-parent, pick
  in band vs child, parent follows child), the `compounds` golden
  (nesting/padding/borders), and the `parity-compounds` live v3
  scene at **2.09%** under a 3% bound — the residual is a
  recorded deviation: v3's node bb includes the border's
  miter-corner overshoot (~(√2−1)·border/2 per side on cornered
  shapes), which compounds inherit as slightly larger parent
  boxes with bordered children; v4's child extents are the plain
  border-inclusive `outerHalf`.  Full suites: 2034 Node tests,
  116/116 Playwright (54+3 `webgpu`... all pre-existing goldens
  byte-stable), typecheck + lint clean.
- [x] **14.10 Compound loop edges** — landed 2026-07-31.

  An edge
  between a node and its own ancestor/descendant (or a self-loop
  on a parent) routes around the outside — v3's
  `findCompoundLoopPoints` verbatim (two controls off the
  endpoints' min top-left corner, `(1 + 50^1.12/100)·dist·(j/3+1)`
  offsets, stretch `max(0.5, ln(outerWidth·0.01))` per end) — as a
  new **`CURVE_CMPD` kind** rendered exactly like a loop (two C1
  quadratics through the control midpoint) with control points
  evaluated from **live** positions/outer halves in both
  implementations, so drags and auto-bounds resizes follow with
  zero re-derivation.  Routing applies whatever the declared curve
  style (v3's `edge:compound` default block makes related edges
  bezier-compound by default, so behavior matches; unbundled
  styles take `control-point-distances[0]` and j = 0 — v3).
  Derivation rides the CurveIndex: a relation is a pair-map build
  trigger (bundle indices), reparenting invalidates the moved
  subtree's incident edges, leaf↔parent flips re-route self-loops,
  and `flush()` loops until settled (a per-edge derivation that
  discovers a relation hands its pair back).  Cull: box-bounded
  (`FLAG_CURVED_BOX`) plus a derivation-time excursion bound in
  `curveSlack` (2× stretch margin — stretch grows only
  logarithmically with node size; parent resizes refresh the
  bound; recorded).  **Two kind-space traps found**: the WGSL
  analytic-vs-route dispatch (`params.w <= 2.0`) sent the new kind
  into the blob-route path — six dispatch sites now special-case
  it (the first golden run caught taxi-like garbage) — and
  `CURVE_HAS_ENDPT = 8` collided with the naïve next kind id, so
  `CURVE_CMPD = 16` sits above the endpoint-flag range with a
  contract note (raw-kind tests only, before any strip).

  Verifies: 9 Node specs (`test/compound-loop-edges.mjs`,
  v3-formula control points, relation lifecycle, slack/flags,
  live resize), the `compound-loops` golden, and
  `parity-compound-loops` live vs v3 at **0.022%** (the
  outside-to-line vs outside-to-node endpoint difference is
  invisible at this scale).  2043 Node tests, 118/118 Playwright,
  typecheck + lint clean.
- [x] **14.11 Interaction + tween demotion + layouts** — landed
  2026-07-31.

  **Layouts position leaves only** (v3):
  `layoutPositions` filters parents (auto-bounds derive them from
  their placed leaves), the grid slot path filters `FLAG_PARENT`
  slots, the grid handle path / circle / concentric / breadthfirst
  filter their node lists, and preset skips parent entries in both
  forms (a preset parent write would shift its whole subtree).
  `boundingBoxAt` skips parent bodies — the leaves' hypothetical
  boxes stand in; the padding margin is not modeled (a recorded
  fit-target approximation).  **GPU tween demotion**: a position
  animation whose node targets carry `FLAG_PARENT|FLAG_CHILD` is
  not GPU-eligible (a lease would leave the CPU columns the
  auto-bounds derivation reads stale, and a tweened parent must
  shift its subtree per tick — CPU-only semantics); unrelated
  leaves in compound graphs stay eligible.  **Reparent settle**:
  `AnimationManager.settleGpuAll()` (factored from detachDriver)
  runs from the store's reparent hook, so live leases settle to
  the CPU before the moved slots fall under CPU-side derivations.
  **Interaction needed no pointer changes**: a parent drag is just
  `position()` (the 14.3 subtree shift), and drag-all-selected
  with a parent + its child rides the collection `shift()` dedupe.
  Tests: 6 Node specs (`test/compound-layouts.mjs`) + a
  Playwright drag spec (parent-band drag moves the subtree by the
  pointer delta; a selected parent+child pair moves exactly once).
  2049 Node tests, 119/119 Playwright, typecheck + lint clean.
- [x] **14.12 Debug scene + benchmarks + true-up** — landed
  2026-07-31.  `debug` gained a `?network=compound`
  generated scene (clustered leaves under ~N/20 parents, every 4th
  parent nested, intra-cluster edges plus a sprinkle of
  child→parent compound loops).

  **`benchmark/compound.mjs`**
  (Mitata, v3 vs v4 at BENCH_N; instances torn down after the run —
  v3 compound instances leave live timers behind): at N = 2k,
  parent drag (subtree shift + bb settle) **263×** v3 (1.14 µs),
  child drag + parent re-derive **59×** (1.50 µs), reparent
  round-trip **142×** (0.64 µs).  **Flush cost at scale** (200k
  leaves under 1 000 parents, 200 children each, 200k edges;
  direct measurement): init 1.81 s, a full re-derive of all 1 000
  parents **2.7 ms**, a parent-drag frame (200-child subtree shift
  + flush + delta) **17.6 µs**, a child-drag frame **11.8 µs** —
  auto-bounds are noise at frame rate.  **Renderer benchmark**
  gained `gen-25k-compound` (25k × 50k under 1k parents, leaves
  clustered per parent — scattered members would make every parent
  span the whole graph, overdraw rather than a representative
  scene): on this box (RX 580, dpr 2, scale 1) the gpu side holds
  **vsync (16.7 ms wall p50) in every scenario** — fit-all,
  zoomed-in, far-zoom, labels on — while v3 canvas runs ~2 s/frame
  fit-all and ~240 ms zoomed-in; init 296 ms vs 5.1 s.  Final docs
  true-up in this commit.  **Round 14 is complete.**

**Risks tracked per item**: flush re-entrancy (raw-column reads
only); parent `width()` readback consistency across style/bb APIs;
recycled parent slots (gen guard); leaf↔parent flips (size
stash/restore, label re-anchor); deep-nesting drag cost
(`markChildGeo` early-exit; the benchmark item guards it);
mid-tween reparent settle; parent decoration bands above edges
(recorded, z-index round); the shared pick/draw order helper; wire
backward compat (optional section).
