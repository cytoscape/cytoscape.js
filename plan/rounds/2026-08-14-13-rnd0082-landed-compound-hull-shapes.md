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

### Shared geometry and implementation record

The planned separate per-parent contour/triangulation cache was replaced
with the existing polygon record. During the hierarchy's lazy derived flush,
the parent position and size are materialized in the normal node columns and
the normalized contour is written to `polyPool`. `hierarchy.pending` is the
dirty-parent set; membership, child geometry, label metrics, visibility,
padding and shape changes enqueue the affected ancestry. A clean flush does
no contour work, and an unchanged record is reused across frames and zooms.
There is no separate triangulation cache or duplicated triangle memory.

The shared polygon signed-distance path evaluates the entire simple contour,
including nonconvex contours, for fill and border. This is why round 82 does
not triangulate the hull: the same polygon SDF supports concavities directly,
without a convex fan or a second derived geometry representation. The CPU
record also supports synchronous point-in-polygon picking. Edge endpoints
use the matching polygon boundary intersection against the same pool record;
the parent dimensions provide bounds, fit and layout geometry, while the
normal parent draw and event paths keep selection and dragging ordinary.
`polygonPointsAt()` exposes the CPU contour internally for future exporters,
so the planned SVG consumer can use the same points when round 77 lands; SVG
export itself is still unimplemented.

Non-polygon child bodies are sampled at 48 evenly spaced directions in
model space, with a conservative radial allowance of
`max(halfWidth, halfHeight) × (1 − cos(π/48))` (about 0.214% of the larger
half-axis); custom-polygon children keep their supplied vertices. Zoom never
changes this topology. The contour is capped at 120 vertices. Concave
refinement accepts at most two safe inward dents and
retains the convex seed when a candidate would cross an input outline or
self-intersect. These are internal defaults, not public controls. This is a
design deviation from the proposed dedicated triangulation cache, accepted
because the existing record meets the shared fill, border, pick, endpoint,
bounds/layout and exporter-handoff contract with measured clean reuse and
real pool accounting.

### 82.1 — label-inclusive compound sizing

Implemented 2026-10-05. `include` is accepted in `src/style/sheet.mts`,
stored per parent and read back; `exclude` remains the default. Sizing uses
the estimated or exact node-label box, includes rotation and visible ink
only, and marks only ancestors whose policy includes direct-child labels.
The parent's own label does not mark or size itself. Renderer metric updates
refresh the affected ancestry, independent of zoom fading and decluttering.
The stylesheet schema and the former expected-throw coverage were updated;
public bounding-box label inclusion remains a separate option.

### 82.2 — convex and rounded-convex implementation

Implemented 2026-10-05. `convex-hull` and `round-convex-hull` enclose
conservative samples of direct child body outlines, nested parent contours,
and optional label boxes. They reuse the established per-side padding and
minimum-size policy. Parent sizing, GPU rendering, borders, CPU picking,
edge endpoints, bounds and layout dimensions all read the shared polygon
record. The style/schema and node-shape tables were updated; no separate
hull-label stream or storage writes in the draw shader were added.

### 82.3 — organic/concave implementation and measurement

Implemented 2026-10-05. A deterministic CPU kernel refines the same sampled
child outlines with up to two inward dents. Each candidate is bounded by the
nearest input blocker and rejected if a new segment crosses the current
contour. The 120-vertex ceiling includes room for both dents; a dense input
that cannot fit the ceiling falls back to its containing convex hull. Concave
contours stay simple, connected and containing; this version does not avoid
unrelated nodes and exposes no public tightness setting.

The final benchmark compares ellipse and convex controls on the 41-cluster
EnrichmentMap and two 500-cluster fixtures. On the measured i9-9900K / Node
24.18.0 run, concavity reduces total area by about 2% on the real EnrichmentMap
and 1.9% on the sparse 500-cluster graph. It barely changes area on the
degenerate 500-cluster graph, where overlapping inputs leave little safe
concavity. Exact timings and polygon-pool bytes are recorded in the landing
record. The initial 41-cluster drag profile exposed a ~200 ms hot path; the
bounded search brought it down to 8.5 ms median. The 500-cluster sparse drag
median remains 44.5 ms against 34.6 ms for convex and is recorded as a cost,
not as an unmeasured performance promise.

### 82.4 — acceptance, cost and close

Closed 2026-10-05. Module coverage exercises body outlines, labels, padding,
nesting, visibility, mutation invalidation and the vertex ceiling; replacing
the concave kernel with the convex control makes its discrimination test
fail. Browser coverage opens the clustered debug scene and verifies the notch
fill/border, CPU and GPU picking, edge termination and drag behavior. The
concave indentation is neither pickable as parent fill nor crossed by the
edge endpoint. The existing shared polygon SDF passed the browser control;
no triangulated fill was needed.

Measured cost (median / p95 for one child move and derived flush; polygon
pool live / capacity are actual Float32 pool bytes):

| Fixture, shapes | Initial flush | Drag p50 / p95 | Vertices | Pool live / capacity | Total area |
|---|---:|---:|---:|---:|---:|
| 41-cluster EnrichmentMap, convex | 71.78 ms | 6.967 / 8.278 ms | 710 | 5,680 / 8,192 B | 8,105,657 |
| 41-cluster EnrichmentMap, concave | 64.53 ms | 8.462 / 13.552 ms | 761 | 6,088 / 8,192 B | 7,940,972 |
| 500 sparse, convex | 281.84 ms | 34.558 / 41.449 ms | 16,533 | 132,264 / 262,144 B | 17,194,554 |
| 500 sparse, concave | 339.72 ms | 44.534 / 51.054 ms | 17,533 | 140,264 / 262,144 B | 16,866,922 |
| 500 degenerate, convex | 210.28 ms | 32.088 / 39.221 ms | 16,032 | 128,256 / 131,072 B | 15,219,410 |
| 500 degenerate, concave | 243.11 ms | 43.144 / 62.993 ms | 17,032 | 136,256 / 262,144 B | 15,207,749 |

All fixtures report zero clean-rest parent recomputes. The 41-cluster initial
flush marks 42 parents / 395 members; a drag marks 2 / 93. Each 500-cluster
initial flush marks 501 parents / 3,000 members; a drag marks 2 / 505. The
full closeout records the ellipse controls alongside these two parent-shape
controls. These synthetic timings describe this machine and fixture, not a
universal application cost. SVG remains a future consumer of the existing CPU
point record; no exporter or pixel-parity matrix is claimed as landed.

`npm run -s verify`, `npm run -s test:node:quiet`, type declarations,
throws/schema/module coverage, and Playwright renderer coverage pass. The
feature inventory, maintained scope, plan index and executive summary are
synchronized in the closeout commit.
