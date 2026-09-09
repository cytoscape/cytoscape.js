## The layout portfolio audit: the use cases, the flagships and what is missing

Item 49, raised by the maintainer on 2026-08-19: v4 should ship a
*better* set of built-ins than v3 — one really good layout per main
use case — and the audit was to enumerate the use cases, name the
flagship for each, and measure that against what the ecosystem apps
actually ship, since Cytoscape Web carrying three layout engines was
the demand signal.  Round 112 took the layered half (the `flow`
layout, built not ported, measured against dagre and elkjs), round
114 made the portfolio that exists correct (one reading of node
dimensions, overlap avoidance everywhere, locked nodes held, a quality
suite over every layout), and rounds 116–121 took force to where the
EnrichmentMap shape is one call.  The audit itself stayed open.  The
maintainer picked it on 2026-09-09, and this is it: the demand read
from the two flagship apps' repositories on the day, the use-case by
coverage matrix, the flagships named, and the gaps ranked by who is
asking.

### The demand, read from the apps on 2026-09-09

**Cytoscape Web** (`cytoscape/cytoscape-web`, `development` at 3686e3f,
8 Sep 2026).  Three engines, exactly as item 49 said, and
`src/models/LayoutModel/impl/` says which:

- **G6** (`@antv/layout`): `dagre`, `gForce` (`gpuEnabled: true`) and
  `radial`.
- **Cytoscape.js v3** (`cytoscape ^3.34`): `grid`, `circle`, `cose`,
  `concentric`, and `cytoscape-biological-flow` — a third-party
  "hierarchical biological pathway layout: left-to-right signal flow
  with crossing minimization", i.e. a layered layout the built-ins did
  not have.
- **Cosmos** (`@cosmograph/cosmos`): one algorithm, displayed as
  "Cosmos Layout (GPU-based, nondeterministic)" — a GPU force layout
  added for the sizes the others cannot reach.

`layoutSelection.ts` is the routing, and it is the clearest statement
of what the app wanted from a core library: under 1,000 elements the
default is G6's `gForce`, or G6's `dagre` when the network is a
hierarchy (HCX); at 1,000 elements and above the app runs v3's
**`grid`** ("only run grid if the network has more than ELE_THRESHOLD
elements"), and above a maximum it runs no layout at all.  So the app
ships three force layouts, two layered ones and a radial tree because
v3's force layout (cose) could not be its default even at a thousand
elements, and nothing in v3 was layered.

**EnrichmentMap web** (`cytoscape/enrichment-map-webapp`, `main` at
a36c6c2, 2 Jun 2025).  `cytoscape-fcose` with a per-edge
`idealEdgeLength` computed from cluster membership and a raised
`nodeRepulsion`, run over the connected nodes only; then the app's own
`_packComponents` / `_separateComponents` — a vendored copy of
layout-utilities' polyomino packing (a 400 × 300 client box,
`componentSpacing: 40`) — over the result; then the singletons, sorted
by NES descending, laid out by v3's `grid` in a `boundingBox` beneath
the connected part, `cols` derived from its width, `condense: true`,
`nodeDimensionsIncludeLabels: true`.  Four mechanisms, two of them
hand-written, for one picture: force with data-driven edge length,
components packed, singletons in sorted rows.  Round 121 measured the
resulting preset and made it one `force` call (`edgeLength` mapping,
`componentGroup`, `componentOrder`).

The v3 extension list (`v3/documentation/md/extensions.md`) is the
wider signal: nineteen layout extensions, of which **eleven are
force-directed** (cola, cose-bilkent, cosep, d3-force, euler, fcose,
ngraph, spread, springy, the GPU one, cise's inner sim), three layered
(dagre, elk, klay), two circular (avsdf, cise), one tree (tidytree),
one domain layout (polywas) and one utility (layout-utilities: the
component packer).  Eleven force layouts is a community telling the
core that its force layout was not good enough; the two apps above
picked fcose, gForce and Cosmos out of them.

### The matrix

| Use case | v4 flagship | Also in v4 | What the apps ship | Where it is measured |
| --- | --- | --- | --- | --- |
| **Force / organic** — the default picture | `force`: GPU with a CPU reference, spectral seed, `edgeLength` mapping, fcose's constraint surface, exact overlap separation, `boundingBox`, `infinite`, live and tweened animation, component shapes, orientation, grouping and order | — | fcose (EM); gForce, cose and Cosmos (Cytoscape Web) | 121: em-web 302 ms, the 25k × 50k scene 3.0 s on the GPU; the quality suite's force rows; `benchmark/layouts.mjs` force-vs-cose |
| **Layered / DAG** | `flow`: network-simplex ranking, weighted crossing minimisation, Brandes–Köpf, compound-aware, four `direction`s, rank constraints, `minLength` / `edgeWeight` mappings | `breadthfirst` (`directed`): v3's depth rows, kept | dagre (Cytoscape Web's hierarchy default); biological-flow (their left-to-right layered layout — `flow` with `direction: 'rightward'`) | 112.1's harness against dagre and elkjs on six fixtures |
| **Tree** | `radial`: subtree wedges by weight, `roots`, `levelSpacing` | `breadthfirst` for a layered tree; `flow` for a directed one | G6 `radial` (Cytoscape Web); tidytree in the v3 list, shipped by neither app | 85.1; the quality suite |
| **Circular** | `circle` with the `sort` mapping (order by a data column: the attribute-grouped ring); `concentric` with the `concentric` mapping (rings by a data column) and `levelWidth` | — | circle and concentric (Cytoscape Web); avsdf and cise in the v3 list, shipped by neither app | the quality suite |
| **Grid / tabular** | `grid`: `rows`, `cols`, `position`, the `sort` mapping, `condense`, `boundingBox` | — | grid (Cytoscape Web's fallback at ≥ 1,000 elements; EM's singleton rows) | the quality suite; the layouts benchmark |
| **Component packing** | force's settle re-pack (120–121: shapes, orientation, `componentGroup`, `componentOrder`); flow's own; `LayoutContext.packComponents` for an extension layout | — | EM's vendored layout-utilities packer; layout-utilities itself | 120 and 121, on em-web and em-desktop |
| **Positions from data** | `preset` | — | both apps (CX2 carries positions) | the quality suite |
| **Scatter** | `random` | — | — | the quality suite |

Every use case the two apps ship has a v4 flagship, and each flagship
is the one layout for its use case — nothing in v4 is a second-best
of another.  `breadthfirst` stays because directed depth rows are a
different picture from `flow`'s, not a worse one, and it is the
cheapest tree layout there is; `circle` and `concentric` are two
spellings of one use case (by order, by level) and both stay.

### What the audit finds missing, ranked by who is asking

1. **Component packing on the discrete layouts, and a standalone
   re-pack.**  Asked for by EnrichmentMap, which vendored a packer and
   runs `grid` for the singletons because fcose left the components
   where they fell.  In v4 the whole packing machinery — shelf pack,
   the small-component shapes, the orientation pass, the grouping and
   the order — is reachable only through `force`'s settle and through
   `flow`, which packs its own; `breadthfirst`, `radial`, `circle`,
   `concentric` and `grid` place a disconnected graph as one body, and
   the quality suite's component rows say so ("the ring and grid
   layouts place by index or by wedge about one centre, so their
   component boxes interleave by design").  Round 87 logged
   `packComponents: true` on the discrete layouts as a small round;
   nothing took it.  The shape: a `packComponents` option on the five
   (run per component, shelf-pack the boxes, group and order as force
   does), and a `pack` layout that regroups existing positions with
   no sim — the EM "keep my sim, regroup" case.  **Logged as item 58;
   the next layout round.**
2. **Scale as a reason to switch engines.**  Cytoscape Web falls back
   to `grid` at 1,000 elements and added Cosmos for the sizes beyond
   that.  Both are v3-cose limitations, not use cases: v4's `force`
   lays out em-web (569 nodes, 6,899 edges — 7.5k elements, seven
   times the threshold that sends Cytoscape Web to `grid`) in 0.3 s
   and the 25k × 50k scene in 3.0 s on the GPU, deterministically from
   a seed (Cosmos is "nondeterministic" by its own label).  Nothing to build; the
   migration guide's layout section now says which built-in answers
   which extension so a port does not carry the threshold over.
3. **A left-to-right layered layout.**  Cytoscape Web wrote one.
   `flow` takes `direction: 'rightward'`; covered since 112.
4. **A tidy tree** (Reingold–Tilford / Buchheim: non-layered, compact,
   the tidytree extension's case).  Shipped by neither app; `radial`,
   `breadthfirst` and `flow` between them draw a tree three ways.
   Declined until an app asks.
5. **A crossing-minimised circle** (AVSDF) and **cluster circles**
   (CiSE).  Shipped by neither app.  The `sort` mapping on `circle`
   is the attribute-grouped ring; a crossing-minimised order is a
   permutation problem the same option would take if a round built
   it.  Declined until an app asks.
6. **A second force layout.**  Eleven in the v3 list, three in
   Cytoscape Web.  Declined by design: the point of item 49 was one
   excellent layout per use case, and `force` absorbed fcose's
   constraints (85.2), its spectral seed (59), cola's `infinite` (118)
   and cose's compound gravity (59.5) rather than shipping beside
   them.

### Decisions

- **The portfolio is complete for the use cases the flagship apps
  ship**, with one gap — component packing on the discrete layouts —
  which is item 58 and the next round.  Item 49 closes here.
- **Flagships, one per use case**: `force`, `flow`, `radial`,
  `circle` / `concentric`, `grid`, `preset`.  A documentation site's
  layout page should lead with those six and list `breadthfirst` and
  `random` after them.
- **No second engine for scale.**  A v3 app's "too big for a layout"
  threshold does not carry to v4; `force` is the default at every size
  the apps have.

### What changed on disk

Documentation only: this record; `src/README.md` carries the matrix
as "The layout portfolio (round 122)" ahead of the per-layout
sections; `MIGRATING.md`'s layouts section gains the extension-to-
built-in table; `PLAN.md` closes item 49 and logs item 58; the summary
and the index.  No source, no spec: the claims above are the record's
own measurements, re-read rather than re-run — the app facts are
dated and pinned to commits so the next audit can diff them.
