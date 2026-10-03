## Miniature compounds: actual positions, reversible size scaling

The alpha interview replaces hidden-child/proxy collapse with miniatures.
Depends on 82's shared compound geometry; chart/label/image geometry must
also honour the factor before this round closes. No aggregates are required.

### Public contract

`parents.collapse()` and `parents.expand()` operate on compound parents;
`node.collapsed()` reads state, and the query/conditional vocabulary gains
`{ collapsed: boolean }`. A separate ancestor test, `insideCollapsed`,
distinguishes descendants from the collapsed parents themselves. It is a
state query, not a visibility flag. Original children and edges remain
ordinary live elements, individually inspectable and pickable when large
enough on screen. Explicit `hide()` state is untouched by collapse/expand.

The parent style property `collapse-scale` defaults to **0.1**, accepting
finite values `0 < s <= 1`. Zero is not invertible; values above 1 do not
belong to this collapse property. Collapsing at 1 activates the state
without shrinking. Support ordinary numeric mappings and bypasses for the
property; use the existing declarative style system, not function styles.

Calling collapse uses the resolved stylesheet value. Changing that value
while collapsed immediately adjusts the applied factor. Calling expand
targets 1, reversing the **applied** factor rather than a stale configured
value. Repeated operations target an absolute per-parent factor, never
multiply the same request again. An identical sheet reapply is a no-op.
Invalid options/style values fail validation before writes. Empty
collections are no-ops; non-parent targets fail validation rather than
silently converting ordinary nodes into compound groups.

### Position and size ownership

For a scale change from a to b, use r = b/a. Snapshot the parent's current
centre c once for that operation/tick and write descendant positions:
`pNext = c + r * (pCurrent - c)`. Use current positions, not an expanded
position snapshot. Finalize compound geometry after the complete batch,
not between individual child writes. No second logical coordinate system.

Use the leaf-position/hierarchy machinery so an ancestor and descendant are
not both moved through overlapping cascades. Distinct requested nested
parents each apply their own factor once, in deterministic ancestor-first
order; the factors compose. Moving the parent retains existing translation
semantics. New/reparented children use supplied **current model** positions;
do not interpret them as expanded coordinates. They inherit the destination
size factor without an automatic position relocation. Reparenting out
likewise preserves current positions and drops the former inherited size
factor. Expansion therefore preserves edits made inside the miniature.

Maintain per-parent applied scale and descendant **effective size factors**,
not authored-style bypass snapshots. Descendant bodies, charts, images,
labels, border/outline geometry and padding scale together. A parent's own
decoration is not scaled by its own collapse, but is scaled by any collapsed
ancestors. Use the same inheritance for nested hull geometry.

An internal edge's widths, arrows and labels use the product of factors on
its endpoints' shared ancestor chain. A boundary-crossing edge keeps its
styled widths/decorations relative to that boundary, but its endpoints and
route follow actual moved nodes. A higher common collapsed ancestor can
still scale that whole connection. Follow endpoint/hierarchy changes in
the same invalidation path; no approximation by one endpoint's factor.

`style('width')`/`numericStyle('width')` and analogous dimension styles
return the resolved **unscaled style**. Geometry getters (`width`, `height`,
outer dimensions, bounds, rendered geometry, picking and layout dimensions)
use the effective size. `position()` returns the actual rescaled coordinates.
Store authored/resolved base geometry separately from effective geometric
columns; every normal style write and animation must update the base once
then apply the inherited factor once. Do not let a later restyle erase the
scale or a getter/setter round trip apply it twice. This distinction is a
public behaviour change, requiring explicit docs and tests.

### Locks: best effort, no exception history

Each operation/tick respects current locks and autolock for position writes,
including existing locked-subtree rules. Locked children still shrink in
size. No operation fails solely because a child is locked; the parent may
remain large or develop overlaps. Do not record skipped transforms or
per-child/per-ancestor lock histories. Expansion may not restore positions
when locks changed or blocked intervening operations. This is the accepted
degenerate case, not a reason to add deferred transformation debt.

Round-trip tests use floating-point tolerances and separate unlocked stable
cases from lock/edit cases. Reject an unrepresentable scale update before
writing non-finite coordinates or an underflowed zero effective factor;
the public positive range does not permit corrupting the store at extreme
nesting. Reuse the established warning/error vocabulary for numerical
limits rather than inventing a silently clamped visual factor.

### Layouts and algorithms

No implicit filtering of miniaturized or hidden descendants. `cy.layout()`
still uses the full graph; `eles.layout()` uses the chosen collection.
Algorithms continue to see the original topology, with no extra edges.

For a scoped layout containing a collapsed parent **and no scoped nodes in
its descendant subtree**, the parent is a movable unit: place the group by
translation, respecting locks. When descendant nodes participate, use the
ordinary compound layout rule instead; never place the parent independently
as well. Apply this classification before existing leaf-only node-slot
filtering, consistently across built-ins and the extension context. Do not
invent an aggregate connection: original edges with endpoints outside the
chosen scope do not connect summary units. Document that limitation of a
parent-only layout so it cannot be mistaken for topology aggregation.

### Optional animation and interruption

Immediate is default. `collapse`/`expand` accept duration/easing shorthand;
the existing `animation()`/`animate()` API gains a `collapsed` target. Reuse
AnimationHandle's promise, pause/resume/reverse/progress/stop conventions,
including promise resolution on interruption; no new queue/handle family.
Interpolate the applied factor and synchronize position and size writes in
one operation, avoiding one allocated animation per descendant.

`collapsed()` is true from collapse start until expansion reaches its
endpoint. Stopping midway leaves it true and retains the current factor.
An explicit collapsed-at-1 state remains true. Reversing the animation swaps
its state endpoint as well as its numerical factor so this special case
remains coherent. Repeated targets and an already-expanded expand are
idempotent. An already-collapsed parent can retarget the configured factor.

New position writes, drags, layouts or overlapping collapse operations
interrupt the affected whole collapse animation **in place**, then apply
the new operation. Unrelated subtrees continue. A lock change alone does
not interrupt: positions start obeying it and size scaling continues.
Automatic style-factor changes also retarget through this same path;
the accepted immediate restyle rule wins over an older tween. Topology
changes interrupt affected runs before membership is changed, keeping
positions/factors current rather than retaining obsolete slot lists.

Emit normal position/style notifications through the existing batching
machinery. Add parent-targeted `collapse`/`expand` notifications for committed
state changes, bubbling normally; do not emit one event per original edge.
Collapse state changes at start, expansion at completed restoration, matching
the query rule. Existing animation completion communicates tween completion.
Immediate operations resolve derived geometry before returning and before
observers read the committed snapshot; batchend remains last.

### Persistence, clones and follow

Persist current positions plus each parent's collapsed state and applied
factor in JSON and an experimental wire section. Persist the authored
stylesheet separately through the existing style path; no saved expanded
positions, multiplied-style snapshots or running animations. On load,
reconstruct size factors from stored state **without moving positions again**.
A paused/interrupted intermediate factor must round-trip as it stands;
reapplying an unchanged configured scale must not snap it to a target.

Initial clones copy this state into independent instances. Under `follow`,
positions and collapse state both follow, as the maintainer likened them;
local follower collapse is reconciled at the next sync. Adopt incoming
positions and applied factors atomically, without invoking the public
rescale operation on already-scaled coordinates. The follower keeps its
own sheet and other view state; an incoming applied factor describes the
source geometry even if the follower's configured collapse-scale differs.
Never recursively rescale twice through load, patch or follow.

### Ordered implementation subtasks

1. State, property, queries and CPU position/size seam. Trace
   `src/store/hierarchy.mts`, `src/store/graph-store/positions.mts`,
   `src/collection/position.mts`, style writes/readers and label measurement.
   Define base/effective geometry ownership before changing any shader.
2. Immediate operations and all geometry consumers: ordinary/convex/concave
   parents, all edge routes, images/charts/labels, bounds and picking. Prove
   headless behaviour before renderer optimization. Do not move logical
   position truth exclusively onto a GPU lease.
3. Collection layout-unit classification, original-topology tests, JSON/wire,
   clone/follow integration and committed event order.
4. Batched animation and conflict ownership across descendants, layouts,
   worker hosting and existing geometry tweens. A CPU path is mandatory.
5. Browser walkthrough, measurement, export handoff and documentation.

### Acceptance and controls

Use a nested clustered EM fixture and a small exact-position fixture. Test
ratios, moved centres, repeated calls, scale 1, live restyles, add/remove/
reparent, style changes while shrunk, explicit hidden state, locks/autolock,
and no movement-history restoration. Check every size-dependent channel,
mixed internal/external edges and normal picking on magnified children.

Test stopping/reversing/replacing tweens, drags/layouts during animation,
overlapping and disjoint subtrees, lock changes mid-run and intermediate
snapshot/follow adoption. Compare original graph membership/topology before
and after collapse. Scoped layout never silently drops descendants or
fabricates summary edges. Include headless, page and worker-hosted paths.

Controls: multiply repeated calls again; overwrite base style with scaled
values; restore a stale position snapshot; rescale during load; include
private lock history; apply internal edge scaling to crossing edges; make
LOD-hidden labels change hull geometry. Corresponding tests must fail.

Benchmark large descendant batches, deep nesting, repeated scale updates,
animation frame/interaction latency, follow traffic and memory against the
expanded graph. Assert affected counts. No claim that miniatures reduce
topology work or make many crossing edges cheap. Open the debug page at
overview and child-detail zoom. Run verify, Node, types, throws, soak,
modules/schemas and relevant Playwright gates with controls. SVG 77 and
WebGL2 137 consume the same effective geometry and snapshot semantics.

Automatic zoom-triggered expansion and viewport snapping are out of this
round; viewport snapping to compounds is explicitly a future consideration.
No fallback-shape prop, synthetic edges, aggregate persistence contract or
per-child lock ledger is to be reintroduced as an implementation shortcut.
