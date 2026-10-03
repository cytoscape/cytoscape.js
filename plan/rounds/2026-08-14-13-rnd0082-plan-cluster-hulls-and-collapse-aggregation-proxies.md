## Compound hull shapes: convex first, then concave

Revised by the 3 October alpha interview. Both convex and organic/concave
geometry are in this round, as successive subtasks. Collapse is now the
separate miniature-compound round 148; the old hidden-child/proxy-edge
implementation in this file is superseded. Deferred aggregate decisions
are retained in the 3 October interview note.

### Settled contract

A hull is a **compound parent shape**, with ordinary parent identity,
selection, picking, labels, events, drag behaviour, style and bounds. There
is no `cy.hulls()` overlay or separate membership API. Membership is the
compound tree; overlapping membership remains outside 4.0.

Implement `convex-hull` and `round-convex-hull`, followed by an organic
`concave-hull` shape. Reuse `corner-radius` for rounded corners. No public
concavity/tightness parameter in the first version: automatic geometry
follows member outlines and spacing. A tuning control is **TBD by the
maintainer for a future enhancement**.

Enclose **direct children's actual outer body outlines**, not their
bounding rectangles. Nested parents contribute their resolved outline,
including their padding/border. Resolve deepest parents first. Explicitly
hidden children do not contribute, as in ordinary compound bounds.

Complete the existing `compound-sizing-wrt-labels: include | exclude`
property for **all compound shapes**, default `exclude`. With `include`,
add the direct children's model-space node-label bounds before applying
parent padding. Zoom fading and decluttering do not remove those bounds;
otherwise zooming would change parent geometry. A parent's own label never
sizes itself. Nested parents honour their own setting; labels explicitly
suppressed by style contribute no ink, while temporary LOD suppression
never changes sizing. Boundaries must remain stable across zoom levels.

Concave geometry follows members more tightly but stays a single connected
region containing all contributing outlines. No holes or disconnected
islands in this version. It need not avoid unrelated nodes. Nonmember
obstacle avoidance is a **possible future enhancement, TBD by maintainer**;
no nonmember movement dependency is introduced now.

No `hull-fallback-shape`. With no visible children, use styled dimensions
at the current centre: rectangle for convex, rounded rectangle for rounded
convex/organic. One or two children still use their nonzero outer outlines,
not a degenerate hull of centres. Collapsed miniatures retain real visible
children and therefore retain hull geometry. Apps can conditionally change
`shape` on the collapsed state; that is not a fallback mechanism.

### Architecture common to both geometry subtasks

The CPU owns or can derive the complete contour. A GPU-only SDF blob is
insufficient for shared picking, endpoints, headless bounds and SVG.
Store a lazily rebuilt contour/triangulation cache keyed by parent slot and
its geometry epoch, using the hierarchy's invalidation pattern. Invalidate
on membership, position, effective size, label metrics, visibility and
padding/shape changes. Reuse a clean contour across frames and zooms.

All consumers use the same contour: parent fill/border/outline, sync CPU
picking, edge boundary intersections, public bounds/fit, layout dimensions
and export. Reuse the normal parent draw tier and event targeting; no new
hull-label stream. Rounded contours must continue to contain their
contributing outlines rather than clipping children at corners.

Use adaptive, conservative outer-outline sampling for curved child shapes;
record a model-space approximation tolerance and maximum vertex count from
magnified fixtures. Zoom must not choose a different topology. Preserve
containment when approximating, not merely containment of node centres.
The constant choices below are implementation measurements; no additional
public controls are implied.

### 82.1 — label-inclusive compound sizing

Implement `include` in `src/style/sheet.mts`, compound style state and
`src/store/hierarchy.mts`; replace the hardcoded `exclude` reader. Derive
sizes from the existing CPU label geometry, estimated headless and refreshed
when mounted metrics become exact. Avoid recursive parent-label sizing or
an unbounded render/measure/resize loop. Update the schema and previous
expected-throw tests in the same commit. Keep public bb label inclusion
separate from the parent's own sizing policy.

### 82.2 — convex and rounded-convex implementation

Construct an outer contour over child outlines plus optional label boxes,
apply the established per-side compound padding and minimum-size policy,
and build shared boundary queries. Start with deterministic convex hull
construction and explicit rounded path segments. Use conservative bounds
for broad-phase tests, exact/shared contour tests for the narrow phase.

Adapt the render shape path and triangulated fill/border as needed, with
CPU-known draw counts and no storage writes in draw shaders. Preserve the
16-binding WebGL2 constraint. Endpoint and pick support land with pixels,
not as a later parity repair. Record shape IDs/schema changes once and
expose the path representation to SVG 77 and WebGL2 137.

### 82.3 — organic/concave implementation and measurement

Begin with a CPU prototype over the same conservative child outlines:
refine the convex boundary inward using nearby boundary candidates and
local child scale/spacing. Accept a refinement only if it preserves a
simple connected outer contour and containment of every child outline and
label box. Deterministically order equal candidates; refuse crossings,
holes and cuts through member bodies. Round the resulting boundary with
the shared path machinery. Triangulation must support nonconvex contours;
a convex triangle fan is no longer valid.

The first implementation task measures automatic refinement constants and
sampling against clustered EnrichmentMap, nested irregular children, sparse
bridges and dense/degenerate inputs. Choose and record one internal default
from those results, with no user tuning API. Compare against the convex
control for both containment and visibly tighter area on a discriminating
fixture. A kernel that always returns convex does not complete this task.
If this candidate cannot meet correctness/performance, document the failed
control and price another CPU-derivable kernel within the same public
contract; do not quietly drop concave scope or invent a GPU-only exporter.

### 82.4 — acceptance, cost and close

- Shape containment for ellipse/diamond/custom-polygon children, asymmetric
  padding, nested hulls, labels above/below/rotated, and hidden children.
- Selection/drag/picking and edge termination on concave indentations, not
  merely on the bounding box. Concave fill triangulates correctly and its
  border does not bridge across a dent. Own-label sizing has no feedback.
- Zero/one/two children; equal positions, skinny groups, moving nodes,
  reparenting, add/remove, font changes, compaction and snapshot restoration.
- Exact zoom-stability of model geometry despite label fading/declutter.
  Headless estimates and mounted exact metrics have documented differences.
- Controls: replace outlines with rectangles, drop label inclusion, use a
  triangle fan on a concave fixture, bypass boundary picking, and ignore
  geometry invalidation. Each dedicated check must discriminate.
- Open clustered and nested debug scenes. Measure at rest (zero clean hull
  recomputes), per-drag dirty work, 41-cluster EM and a 500-cluster fixture,
  contour/triangle memory, and concavity cost. Log recomputed hull/member/
  vertex counts and compare plain-parent and convex controls. No invented
  aggregate speedup or unmeasured promise of free concavity.
- Verify, Node, types, throws, schema/module, soak and Playwright gates.
  Document shape names, label-sizing semantics and biological limitations.
  Feed both shapes into the SVG and WebGL parity matrices. Close with the
  feature inventory, maintained scope and executive record synchronized.
