## Component packing on the discrete layouts, the pack layout, and breadthfirst's trees as blocks

Item 58, the one gap round 122's audit found: the packing machinery
of rounds 120–121 — the shelf pack, the shapes, the orientation, the
grouping and the order — was reachable only through `force`'s settle
and `flow`'s own pass, while `circle`, `concentric`, `grid`,
`breadthfirst` and `radial` drew a disconnected graph as one figure
about one centre, and EnrichmentMap vendored a packer and laid its
singletons out with `grid` for want of it.  The maintainer's brief
(2026-09-09): address the gap; it should be possible to choose, by
option, one ring or one ring per component, and the same for
breadthfirst and the rest; breadthfirst's point is to be simple and
space-efficient, so for it also consider just improving the spacing
and the ordering so separate trees read more easily; plan each layout
first.  The plan was put to the maintainer and four calls came back:
the option is `packComponents`; breadthfirst's blocks are on by
default; concentric bins per component; and locked nodes are left
out of the packing, with the main drawing kept off them.

### 123.1 — the mechanism, and the `pack` layout

`layout/per-component.mts`: force's grouping (`groupingOf`, the keys
sorted into group indices and the comparator wrapped over ids) and
its functions-or-nothing check (`validatePackOptions`) moved out of
`force.mts` and are shared; `splitByComponent` splits the placed
nodes by the scope's components, largest first, keeping the caller's
node order within each so a sorted ring stays sorted; and
`layoutPerComponent` is the mechanism: the layout's own placement
called once per component in a box centred on the origin and sized
to the component's share of the scope's area (side ∝ √(size / n),
never under twice the component's largest node), the body boxes
shelf-packed largest first by `packComponentBodies` under
`componentSpacing` / `componentGroup` / `componentOrder` /
`groupSpacing` — force's spellings, force's `LayoutComponent`
description — the field centred on the viewport, or scaled down and
centred in an explicit `boundingBox` (flow's rule, `fitBodiesToBox`),
and, when a locked node sits under it, moved off the locked nodes'
union box by the smaller of a shift to its right and a shift below
it.  Locked nodes are left out of the placement, as they hold under
every layout since 114.3.  Positions land through `layoutPositions`,
so `animate` tweens and `fit` are unchanged.

**`cy.layout({ name: 'pack' })`** (`layout/pack-layout.mts`) is the
re-pack on its own: the components at their current positions
shelf-packed by their body boxes under the same four options, the
largest component's centre held, an explicit `boundingBox` honoured
after the pack as force honours it.  Translation only — no shapes,
no orientation; those need edge lengths and belong to force.  The
EnrichmentMap "keep my sim, regroup by sign" case is one call.

The option types: `ComponentPackingOptions` (`packComponents` plus
the four) on the five discrete layouts' options,
`LayoutComponentInfo` as what the group and order functions see,
`PackLayoutOptions`; the shipped declaration carries them.

### 123.2 — circle, concentric, radial

Each layout's placement became a method over a node list and a box
(`ring`, `rings`, `tree`), and `packComponents: true` routes it
through the mechanism.  **Circle**: one ring per component — a
singleton a point, a pair two points, a triple a triangle — each at
the smallest radius that separates its members, `sort` ordering each
ring.  **Concentric**: the scores resolved once over the scope (a
`range` mapping normalizes across the graph) and the levels binned
per component, `levelWidth` seeing that component's nodes — the
maintainer's call.  **Radial**: without the switch several components
share one radial as wedges with their roots on the first ring
(85.1's rule, unchanged); with it each component is its own tree,
root at its own centre, the roots split per component.

### 123.3 — grid

One grid per component, a singleton one cell, the grids packed
largest first: on em-web the quads, triples, pairs and singletons
fall into rows — EnrichmentMap's picture through the same option as
everywhere else.  `sort` and `position` apply within each grid.

### 123.4 — breadthfirst: trees as blocks, on by default

With several components in a row drawing, v3 spread every rank
across the box and sorted it by the parents' positions alone: the
trees interleaved, and a root sat at the middle of a row that ran
the whole width.  Now, by default:

- each rank is ordered **component-first** — the largest tree
  leftmost, the parent heuristic (or `depthSort`) within it — so a
  tree's nodes are contiguous in every row;
- each component takes a **column band** as wide as its widest rank
  needs, bodies included, each rank centred in its band, so a root
  stands above the middle of its own subtree;
- the **singletons share one band**, a block of rows as wide as a
  shelf, the cells the first rank's spacing apart;
- the bands **wrap into shelves** up to the box's width (or the one
  band wider than it), each shelf centred and `componentSpacing`
  apart, the next shelf's rows starting under the deepest band of the
  one before, and the rows spread over every shelf's rows.

The depth rows stay shared within a shelf, so levels align across the
trees on it and no height is spent.  One component is v3's picture
exactly (the spec pins the positions); `circle: true` rings are
untouched.  What the page found on the way: the first version put
every band in one row, and em-web's 144 components made it a row
144 bands wide at zoom 0.02 — the singleton block and the shelves are
the answer, and the page reads as the big tree, shelves of the
medium and the small trees, rows of pairs and rows of singletons.

`packComponents: true` goes further: each tree laid out alone and
**compact** — spaced by its overlap need, bodies apart,
`spacingFactor` the air — and the trees shelf-packed under the shared
options.  The placement is one method (`place`) over a node list,
its roots, a box and a sizing rule (`'box'` fills an explicit
`boundingBox`, `'margin'` leaves v3's margin inside the viewport,
`'compact'` is the packed tree's).  The first version of the packed
tree ran `eles.components()` once per component to rank the bands it
would never draw — 144 scans on em-web, 1.44 s — and skips it now:
0.10 s.

### The page

A **Pack components** box, spelled into `packComponents` every run on
grid, circle, concentric, breadthfirst and radial (force, flow, pack,
preset and random never get one), and a **Pack** entry in the
dropdown that re-packs the components where they stand under the
sheet's own edges.  Driven in scripted Chromium on the real adapter
(`npm run -s gpu`: hardware), em-web (569 nodes, 6,899 edges, 144
components), avoid overlap on, in ms:

| layout | one figure | packComponents |
| --- | --: | --: |
| breadthfirst | 142 (the blocks) | 109 |
| circle | 24 | 46 |
| concentric | — | 32 |
| grid | — | 32 |
| radial | — | 54 |

The screenshots: circle's rings by size in rows, largest first;
grid's quads, triples, pairs and singletons in rows; radial's trees
packed; breadthfirst's shelves.

### The gates

`test/layout-pack.mjs` (29 specs): disjoint component boxes under the
switch on every discrete layout, with circle's one-ring and grid's
one-lattice controls; circle's `sort` per ring; concentric's
`levelWidth` seeing each component alone against the nine-node
control; radial's root at its own centre; grid's 2 × 2 path; the
shared grouping and order on all five with what the description
carries; the non-function throw; a locked node held and the field
clear of it; an explicit `boundingBox` holding the field; `animate`
ending where the sync run ends.  Breadthfirst: ranks ordered
tree-first with shared rows, a root over the middle of its children,
bands a `componentSpacing` apart, one component v3's exact picture,
`depthSort` within a tree, the shelves and the singleton block with
nothing overlapping, and the compact packed tree.  The `pack` layout:
translation-only with the largest held, the grouping and the order,
the throw, a locked node, the box, the animated lifecycle, and its
place in the built-in list.  `test/layout-quality.mjs`'s
disconnected-components rows now include every discrete layout under
`packComponents: true`; the harness spec pins the page's box and
entry; force's own grouping specs hold through the refactor.  All
2,650 Node specs green; `npm run build:types`, the `@throws` gate
and the JSDoc coverage audit green.
