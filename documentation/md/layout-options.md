# Layout options

This reference describes the ten built-in v4 layouts and their current
options. The type surface is in
[src/public-types.mts](../../src/public-types.mts); defaults and behavior are
checked against each implementation under
[src/layout/](../../src/layout/), including
[force-run.mts](../../src/layout/force-run.mts),
[flow.mts](../../src/layout/flow.mts),
[layout-mapping.mts](../../src/layout/layout-mapping.mts), and
[per-component.mts](../../src/layout/per-component.mts).

For lifecycle, scopes, extensions and the overview of each family, see
[Layouts](layouts.md). Layouts compute model-space node positions. Creating a
layout does not run it:

~~~js
const layout = cy.layout({
  name: 'flow',
  direction: 'rightward',
  nodeSep: 48,
  rankSep: 72,
});

layout.run();
await layout.promise();
~~~

## Shared options

All built-ins accept the common layout options below. Some fast paths apply
them through the shared finisher only when needed; each implementation's
option table calls out special cases. A collection call, eles.layout(options),
sets the scope to that collection. Otherwise, the scope is the whole graph.

| Option | Default | Contract |
| --- | --- | --- |
| eles | whole graph | Element collection to lay out; set automatically by eles.layout(). |
| fit | true | Fit the viewport after placement. |
| padding | 30 | Rendered-space/CSS-pixel margin around the fitted graph. It is passed to cy.fit(); it is not model-space layout spacing. |
| boundingBox | omitted | Explicit model-space bounds for layouts that use a box; accepts x1/y1 plus x2/y2 or w/h. Viewport-sized built-ins derive an omitted box from viewport dimensions. Force uses an explicit box only for its final scale-down; flow and pack also use this option only when supplied. |
| nodeDimensionsIncludeLabels | false | Include node label bounds in spacing/overlap boxes. Headless label bounds are estimates until a renderer reports measured dimensions. |
| spacingFactor | omitted | Dimensionless multiplier for overall spacing when the layout/finisher uses it; omitted leaves the layout's natural spacing. |
| transform | omitted | Function of (node, computedPosition) returning the final position; typically used to flip/rotate the result. |
| animate | false | Tween nodes from their old positions to computed positions. |
| animationDuration | 500 ms | Duration of a position tween when animation is enabled. |
| animationEasing | omitted | Easing name passed to the animation system. |
| animateFilter | omitted | Function of (node, index); true nodes animate and the rest jump. Omitted means all nodes animate. |
| ready | omitted | Callback after the layout-ready stage. |
| stop | omitted | Callback after layout-stop. |
| zoom | omitted | Set zoom when fit is false. |
| pan | omitted | Set pan when fit is false. |

Layouts generally place unlocked leaves; compound parents derive from their
children. Locked nodes hold their positions. Force treats locked nodes as
pinned participants; discrete layouts leave them out of placement slots.
There are layout-specific exceptions for a collapsed parent that has no
descendants in scope, which can move as one unit.

## Mappings for layout options

Two mapping forms accept serializable objects alongside functions. They resolve
once when the layout starts; changing data during a run does not refresh the
already computed scores or ordering.

### Score mapping

force.edgeLength, concentric.concentric, flow.minLength, and flow.edgeWeight
accept a numeric constant, a function, or an object of this form:

~~~js
{
  data: 'score',
  scale: 'log',
  range: [40, 200],
  invert: true,
  default: 60
}
~~~

The column must exist and be numeric. Without range, { data } passes each
numeric value through as the score. With range, the observed extent maps to
[range[0], range[1]] using linear, log, or sqrt; invert reverses the result.
scale or invert without range throws. Missing values use default, then the
option's own fallback. Invalid values under log, such as non-positive values,
also use that fallback. A constant-valued column maps to the range midpoint.
Mapping errors name the option and key.

force.edgeLength defaults to 60. A mapped force edge length resolves once for
all graph edges; edges outside the run's simulation scope do not contribute
forces.

### Sort mapping

grid.sort, circle.sort, and breadthfirst.depthSort accept either a comparator
function or a serializable { data, order? } object:

~~~js
{ data: 'rank', order: 'descending' }
~~~

The node data column must exist and be numeric or string, not mixed. order is
ascending by default or descending when requested. Missing values sort last in
either direction; ties break by ascending node id.

## Component packing options

Grid, circle, concentric, breadthfirst, and radial accept packComponents,
componentSpacing, componentGroup, componentOrder, and groupSpacing.
packComponents defaults to false: each layout arranges one drawing over its
whole scope. When true, each disconnected component is laid out separately,
then the boxes are shelf-packed largest first. The component gap defaults to
40 model pixels. Locked nodes remain fixed and packed content is shifted away
from their boxes where needed.

| Option | Default | Contract |
| --- | --- | --- |
| packComponents | false | Split geometric placement into one layout per disconnected component, then pack the results. |
| componentSpacing | 40 | Gap between packed component boxes, in model-space pixels. |
| componentGroup | omitted | Function of { nodes, size, width, height } returning a string/number key or nullish. Keyed groups are placed by key: numbers ascending, then strings lexically, then unkeyed. |
| componentOrder | omitted | Comparator over two component descriptions. Orders within a group before the largest-first tie-break. |
| groupSpacing | 3 × componentSpacing | Gap between grouped boxes, in model-space pixels. |

componentGroup and componentOrder must be functions when supplied; otherwise
the layout throws at start. Force uses componentSpacing, componentGroup,
componentOrder, and groupSpacing for its settle re-pack, but it has no
packComponents option. The pack layout always packs current component
positions.

## Grid

Grid places movable leaf nodes in rows and columns sized to the viewport or an
explicit boundingBox. Defaults are fit true, padding 30, avoidOverlap true,
avoidOverlapPadding 10, condense false, and packComponents false. Rows and
columns are inferred unless fixed.

| Option | Default | Contract |
| --- | --- | --- |
| rows, cols | omitted | Requested grid row/column counts. |
| avoidOverlap | true | Keep node boxes apart; may overflow an undersized boundingBox. |
| avoidOverlapPadding | 10 | Extra model-space pixel gap around nodes when avoiding overlap. |
| condense | false | false uses the available box; true uses a compact grid. |
| position | omitted | Function of a node returning zero-based { row?, col? }; takes precedence for that node's cell. |
| sort | omitted | Comparator or sort mapping; controls cell order. |
| packComponents | false | When true, lay out and pack each component independently. |

The bare full-graph call can use the bulk slot path. Callback options, sorting,
component packing, scoped runs, or finisher options use the handle path.

## Preset

Preset writes supplied node positions. Defaults are fit true and padding 30;
positions, zoom, and pan are omitted.

| Option | Default | Contract |
| --- | --- | --- |
| positions | omitted | Map from node id to { x, y }, or function of a node returning a position or nullish. Missing nodes keep their current positions. |
| zoom, pan | omitted | Applied when fit is false. |

Each provided x and y must be finite or the run throws. Unknown ids, edge ids,
and null positions in a map are ignored. Locked nodes hold their positions.

## Circle

Circle places nodes evenly on one ring. Defaults are fit true, padding 30,
avoidOverlap true, avoidOverlapPadding 10, condense false, startAngle 3π/2,
clockwise true, and packComponents false.

| Option | Default | Contract |
| --- | --- | --- |
| radius | omitted | Explicit model-space ring radius; otherwise computed from the box and node dimensions. Overlap avoidance may grow it. |
| startAngle | 3π/2 | Starting angle in radians. |
| sweep | omitted | Angular distance from first to last node; omitted means a full circle. |
| clockwise, counterclockwise | clockwise true | Boolean direction flags. If counterclockwise is supplied, it determines the direction. |
| sort | omitted | Comparator or node data sort mapping for ring order. |
| avoidOverlap | true | Grow the ring to keep node boxes from overlapping. |
| avoidOverlapPadding | 10 | Extra model-space pixel gap between boxes. |
| condense | false | Size the ring from nodes and required gaps rather than filling the box. An explicit radius still sets the starting radius. |
| packComponents | false | Draw one ring per component and pack the rings. |

For a one-node ring, the node is placed at the center. A singleton component
under packComponents is a point.

## Concentric

Concentric bins nodes into score levels and lays the levels on rings, higher
scores nearer the center. Defaults are fit true, padding 30, startAngle 3π/2,
clockwise true, equidistant false, minNodeSpacing 10, avoidOverlap true,
concentric by degree, levelWidth as maxDegree / 4, and packComponents false.

| Option | Default | Contract |
| --- | --- | --- |
| concentric | degree function | Function of node, or numeric score mapping. Higher score goes closer to the center. |
| levelWidth | maxDegree / 4 | Function of the nodes returning the score span for a ring. |
| startAngle | 3π/2 | First ring angle in radians. |
| sweep | omitted | Angular sweep; omitted means a full circle. |
| clockwise, counterclockwise | clockwise true | Boolean direction flags. If counterclockwise is supplied, it determines the direction. |
| equidistant | false | Use equal radial distance between ring levels. |
| minNodeSpacing | 10 | Minimum model-space gap between node outsides. |
| avoidOverlap | true | Increase ring radii as needed to avoid node-box overlap. |
| width, height | omitted | Explicit layout-area dimensions; otherwise use the bounding box. |
| packComponents | false | Lay out each disconnected component independently and pack the rings. |

Score mappings for concentric resolve over the full scope; with component
packing, level bins are formed inside each component. levelWidth receives that
component's nodes for those per-component runs.

## Breadthfirst

Breadthfirst assigns breadth-first depth levels from roots. Defaults are
directed false, direction downward, circle false, grid false, spacingFactor
1.75, avoidOverlap true, avoidOverlapPadding 0, maximal false, acyclic false,
and packComponents false. Parents derive from placed descendants.

| Option | Default | Contract |
| --- | --- | --- |
| roots | inferred | Collection or array of node ids. Selector strings are not accepted. |
| directed | false | Traverse edge direction when finding depths. |
| direction | downward | downward, upward, rightward, or leftward. |
| circle | false | Place depth levels on rings instead of rows. |
| grid | false | Lay out a DAG on an even grid; applies when circle is false. |
| depthSort | omitted | Comparator or node data sort mapping within a depth. |
| maximal | false | Move nodes down to their maximal depths in a directed graph; a cycle triggers a bail-out. |
| acyclic | false | Assert a directed graph is acyclic. Enables maximal-depth shifting and skips its cycle bail-out; use only when the scope is a DAG. |
| avoidOverlap | true | Separate node extents per rank and axis; false places center points. |
| avoidOverlapPadding | 0 | Extra model-space gap per body; spacingFactor supplies the usual extra air. |
| spacingFactor | 1.75 | Additional spacing factor for the rows/grid. |
| packComponents | false | Lay out each component as its own tree and pack the results. |

When roots are omitted, directed traversal uses graph roots; undirected
traversal chooses maximum-degree nodes in each component. With supplied roots,
breadth-first traversal assigns reached nodes their depths; nodes outside that
traversal are placed together in a new top-level depth.

## Random

Random scatters nodes uniformly within the viewport or boundingBox. Defaults
are fit true, padding 30, and no seed.

| Option | Default | Contract |
| --- | --- | --- |
| seed | omitted | Finite number; its low 32 bits seed the generator. Same seed and graph order produce the same placement. Without it, Math.random is used. |

Random is a useful starting placement for other layouts. A non-finite seed
throws before placement.

## Radial

Radial lays out breadth-first trees in hierarchy-aware angular wedges. Each
subtree occupies a contiguous sector. Defaults are fit true, padding 30,
startAngle 3π/2, sweep 2π, clockwise true, avoidOverlap true,
avoidOverlapPadding 10, condense false, weight leaves, and packComponents
false.

| Option | Default | Contract |
| --- | --- | --- |
| roots | inferred | Collection or array of node ids; selector strings are rejected. Unset, use nodes with no incoming edge in each component; if a component has none, use its maximum-degree nodes. |
| startAngle | 3π/2 | Where the shared sweep begins, in radians. |
| sweep | 2π | Total angular sweep shared by the trees. |
| clockwise | true | Direction in which wedge allocation proceeds. |
| levelSpacing | derived | Ring gap in model pixels; an explicit value sets the initial spacing. |
| avoidOverlap | true | Grow ring radii to clear boxes without changing wedge angles. |
| avoidOverlapPadding | 10 | Gap between neighboring boxes. |
| condense | false | Size rings from node extents and gaps instead of the box; implies overlap avoidance. |
| weight | leaves | leaves or subtree; controls subtree wedge weight. |
| packComponents | false | Lay each component as an independent radial tree and pack the trees. |

With one root, the root sits at the center. Multiple roots occupy the first
ring. Nodes not reached from the supplied roots seed additional trees in scope
order.

## Pack

Pack is a translation-only component re-pack for a drawing whose internal
layout is already set. Defaults are fit true, padding 30, and componentSpacing
40. The largest component's center stays fixed; other component boxes are
shelf-packed. It does not rotate or reshape components.

| Option | Default | Contract |
| --- | --- | --- |
| componentSpacing | 40 | Gap between packed component boxes. |
| componentGroup | omitted | Group callback over component descriptions. |
| componentOrder | omitted | Comparator for components in each group; otherwise largest first. |
| groupSpacing | 3 × componentSpacing | Gap between groups. |

Locked nodes are left in place, and components with locked members pack using
their free members alone. componentGroup and componentOrder must be functions
or the run throws.

## Force

Force is a spring/electric simulation with degree-normalized edge springs,
inverse-square repulsion and component-aware gravity. Defaults are a 60 model-pixel
ideal edge length, repulsion 1, stiffness 0.6, gravity 1, decay 0.015, 1000
iterations, seed 1, randomize true, spectral initialization, executor auto,
and avoidOverlap settle. Unwatched one-shot runs use a threshold of 2% of mean
ideal edge length; animateLive/infinite runs use 0.1px when threshold is
omitted.

| Option | Default | Contract |
| --- | --- | --- |
| edgeLength | 60 | Number, per-edge function, or numeric score mapping; resolved once at start. |
| repulsion | 1 | Pairwise repulsion strength. |
| stiffness | 0.6 | Degree-normalized spring stiffness. |
| gravity | 1 | Constant-magnitude pull toward each component anchor. |
| decay | 0.015 | Alpha annealing rate per iteration. |
| iterations | 1000 | Hard iteration cap for a finite run; ignored by infinite. |
| threshold | context-dependent | Maximum model-pixel displacement for settling. Omitted finite silent runs use 0.02 × mean ideal edge length; live/infinite runs use 0.1px. |
| seed | 1 | Numeric seed for placement. |
| randomize | true | Start from seeded positions; false relaxes current positions. |
| init | spectral | spectral or scatter. Only matters on a fresh randomized placement. |
| executor | auto | auto, cpu, gpu, or workers. See executor behavior below. |
| animate | false | Tween from the old positions to the settled result; viewport fit can run alongside. |
| animateLive | false | Stream positions during the simulation; takes precedence over animate. |
| infinite | false | Keep running and reheat on interaction/topology changes. stop() lands current positions without settle separation, re-pack, fit, or tween. |
| stepsPerFrame | 3 | Iterations advanced per frame under animateLive or infinite. |
| avoidOverlap | true / settle | false, true or settle for final separation; sim for per-tick sweeps; both for both. Infinite converts any enabled mode to sim. |
| avoidOverlapPadding | 10 | Model-space gap around each node box in overlap handling. |
| nodeDimensionsIncludeLabels | false | Include labels in overlap boxes. |
| componentSpacing | 40 | Model-space gap between component boxes in the final re-pack. Re-pack is skipped when a node is pinned or constraints are set. |
| tidyComponents | true | Give small components canonical shapes at settle; skipped for infinite or constrained runs and components that cannot be translated safely. |
| componentGroup, componentOrder | omitted | Group callback and order comparator for the settle re-pack. |
| groupSpacing | 3 × componentSpacing | Model-space gap between grouped component boxes. |
| boundingBox | omitted | Explicitly fit the settled field down, never up, into this box. Skipped for pinned or constrained runs. |
| nestingFactor | 1.2 | Multiplier per compound-boundary level crossed by an edge's ideal length. |
| gravityCompound | 1.5 | Compound centroid pull as a multiple of gravity. |
| alignment | omitted | Horizontal groups of node ids share y; vertical groups share x. Groups merge when they share a node. A locked node pins its group. |
| relativePlacement | omitted | Entries { left, right, gap? } or { top, bottom, gap? }; keeps the first id at least gap pixels before the second. Default gap is mean ideal edge length. |

Executor auto chooses the GPU integrator when available for a flat rendered
graph without force constraints; otherwise it uses a worker when the platform
can construct one, then the in-thread CPU simulation. Compound or constrained
runs use the CPU or worker path. GPU and worker runs are asynchronous. cpu is
the in-thread deterministic reference and synchronous spelling. workers
throws at start if a worker cannot be constructed; gpu throws when the graph,
constraints, build, renderer, or device cannot provide a GPU integrator. GPU
trajectories are not bit-for-bit stable between runs.

Alignment/relative-placement ids must exist. Placement cycles, malformed
entries, and conflicting locked alignment coordinates throw before movement.
Constrained runs use the CPU executor. avoidOverlap accepts only false, true,
settle, sim, or both; other values throw. A sim sweep alone may not open a
field denser than its node boxes allow; both adds the final settle separation.
During a live GPU run, CPU position reads can be stale until readback at
layoutstop/promise().

## Flow

Flow is a layered directed-graph layout. It computes node positions; edges
route from their style. Defaults are direction downward, nodeSep 50, rankSep
60, edgeSep 10, network-simplex layering, thoroughness 7, minLength 1,
edgeWeight 1, acyclic false, greedy cycle removal, componentSpacing 40,
avoidOverlap true, and avoidOverlapPadding 0.

| Option | Default | Contract |
| --- | --- | --- |
| direction | downward | downward, upward, leftward, rightward. |
| nodeSep | 50 | Positive model-space pixel gap between node box sides along a rank; zero or negative values throw. |
| rankSep | 60 | Positive model-space pixel gap between ranks; zero or negative values throw. |
| edgeSep | 10 | Non-negative model-space pixels per overlapping taxi track added to a rank gap; zero leaves rankSep unchanged. Negative values throw. |
| layering | network-simplex | network-simplex, longest-path, or auto. auto uses longest-path beyond about 50k nodes. |
| thoroughness | 7 | Crossing-minimization effort from 1 through 10; outside the range throws. |
| minLength | 1 | Minimum rank span per edge; number, numeric score mapping, or edge function. Resolved spans are at least one rank. |
| edgeWeight | 1 | Straightening weight per edge; number, numeric score mapping, or edge function. |
| acyclic | false | Declare the graph acyclic and skip cycle removal. |
| cycleRemoval | greedy | greedy or dfs; dfs makes input order more influential. |
| rankConstraints | omitted | Id lists min (first rank), max (last rank), and same (shared-rank groups). Unknown ids, selector strings, and contradictions throw. |
| componentSpacing | 40 | Model-space gap between disconnected component boxes. |
| avoidOverlap | true | Separate by node extents; false places points and makes nodeSep/rankSep center-to-center. |
| avoidOverlapPadding | 0 | Extra model-space gap around bodies; nodeSep and rankSep otherwise own the spacing. |

flow rank constraints accept node ids only, never selector strings. Pair flow
with a style route such as curve-style taxi when right-angle edges are wanted;
the layout itself does not route edges.

## Options not carried forward from v3

The list above is the current v4 built-in surface. The v3 null layout and its
layout-handle event-emitter methods are not among these built-ins. The direct
custom-layout implementation contract is described in [Layouts](layouts.md);
this page does not add a registry, import name, or undocumented built-in.
