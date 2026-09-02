## Exact overlap separation: the layouts stop over-separating

Raised by the maintainer on 2026-09-02, the day round 114 closed: its
overlap avoidance "seems to avoid overlap, but at the expense of
over-separating the network".  Every layout on the debug page came out
"way too spread out — far more spread out than even v3 with the
option to include labels in the bb", the discrete layouts should be
"comparable to v3, broadly but not necessarily exactly", the force
layout was "also way too spread out", and the round was to bring
better tests *and* a look at the page itself, zoomed in on particular
nodes, since "things are not only good with respect to tests but also
visually".  Two asks followed mid-round: checkboxes on the page for
the overlap behaviour, and overlap avoidance **off by default on the
page** — "perhaps a Chesterton's Fence scenario.  Just the defaults."

### What the measurements said

The browser extension was not connected, so the page was driven in
Playwright's Chromium: each layout on em-web (569 nodes, 6,899 edges),
a fit screenshot, a 1:1 screenshot centred on the highest-degree node,
and one set of numbers per run — the bounding box, the median
nearest-neighbour distance, the median gap between label boxes, and
the overlap counts — beside the same runs on v3's page with
`nodeDimensionsIncludeLabels: true`.

| em-web | v4 at 114 (labels on) | v3, labels on | v4 at 114, force with `avoidOverlap: false` |
| --- | --: | --: | --: |
| circle diameter | 57.6k px | 70.8k px | — |
| concentric diameter | 26.3k | 30.9k | — |
| breadthfirst width | 76.3k | 93.7k | — |
| force field | 11.6k × 12.5k | 3.0k × 3.4k (906 body overlaps) | **2.4k × 1.8k** |

So on that graph v4-with-labels was already tighter than v3-with-labels;
what the maintainer was seeing was the labels-on *default* against v3's
labels-off default, and, on force, a genuine defect: the separation
pass alone grew a 2.4k px field to 11.6k — five times linear,
twenty-five times the area.  The 1:1 screenshot showed 40 px nodes
hundreds of pixels apart.

Two causes, both in 114's rules:

1. **Every discrete layout spaced every pair by the single largest
   footprint in scope** — circle and breadthfirst by `max(w, h)` over
   every node (v3's rule), concentric and radial by the longest
   *diagonal* (114.8's corner-on fix, applied globally).  One long
   label therefore set the chord of every pair on a ring and the step
   of every rank, whichever way its neighbours actually lay.
2. **Force's dense-pile phase scaled the whole component by its worst
   pair's factor** (capped at 8).  Two nodes the sim left a pixel
   apart asked for the cap, and the cap was applied to 569 nodes.

### What landed

**115.1 — `src/layout/separation.mts`, exact per pair.**  Two
axis-aligned boxes are clear once separated on *either* axis, so the
distance a pair needs along a direction is the cheaper axis's:
`separationAlong(dims, i, j, ux, uy)`, exact, asymmetric boxes (a label
below the body) honoured.  On top of it, the ring solvers:
`ringTangentialRadius` (the smallest radius at which no two nodes of a
ring overlap, each pair along its own chord, visited in angle order
with the scan past each member stopping once the chord at the running
radius exceeds the diagonals), `ringBandRadius` (the inner radius plus
both rings' radial half extents, each node measured along its own
angle — what keeps a ring a ring), `ringClearanceRadius` (each outer
node's ray intersected with the Minkowski box of every inner node it
can reach; the first radius past the floor inside no interval) and
`ringRadius`, the one call per ring.  Circle, concentric and radial
route their radii through it; breadthfirst's floors became per rank
and per axis (consecutive nodes need their half widths, ranks their
heights, every pair a uniform spacing could bring together checked,
the sideways directions' rotate-and-skew divided out).

A geometric fact worth recording: on a ring of *identical* boxes the
exact rule still returns the diagonal chord, because some pair's
chord runs along the boxes' diagonal — 114.8's corner-on finding was
right.  The gain is on rings of *different* boxes (the widest label
against its actual neighbours rather than every pair) and on the
wide-but-short shape, where the binding chord is the one nearest
`atan(h / w)`, under the diagonal.

**115.2 — force: proximity stress in place of the component scale.**
PRISM's proximity stress (Gansner & Hu 2009): over the pairs sharing
a grid neighbourhood — thinned to each node's nearest six clear
neighbours plus every overlapping pair, the Delaunay neighbourhood
approximately — an overlapping pair's target distance is its current
distance times the factor that separates it along its own direction
(capped at 1.5 per round), a clear pair's is its current distance at
a quarter of the weight, and twenty stress-majorization iterations
per round move every node to the weighted average its neighbours ask
for; up to forty rounds, then the local sweeps for the residue.
Measured on the way: with every clear pair in the 3 × 3 block held at
full weight the pile jammed (a 200-clique of wide labels plateaued at
~270 overlaps — the holds out-voted the pushes); thinning and the
quarter weight made it converge, and the sweep of hold weight × growth
cap picked 0.25 × 1.5 as the densest that clears.  Results, labelled
cliques: 30, 120 and 200 nodes overlap-free at fills of 0.41, 0.40 and
0.46 (fill = box area over field area).  em-web: 11.6k × 12.5k →
**2.8k × 2.4k** with bodies, 3.2k × 2.5k with labels — against the
unseparated 2.4k × 1.8k.

**115.3 — `nodeDimensionsIncludeLabels` defaults to `false` again.**
The fence: v3's default was the labels-off spacing, and a graph of
long labels spaced by them is several times the size of the same graph
spaced by its bodies.  114.1's flip is reverted; every layout reads
`=== true`; `MIGRATING.md`'s row says so.  `avoidOverlap` keeps its
per-layout default (true where v3 had it, and on the three that gained
it in 114).  Circle and breadthfirst gain `avoidOverlapPadding` (10
and 0 — breadthfirst keeps v3's numbers, its `spacingFactor: 1.75`
being the air).

**115.4 — the debug page.**  Two checkboxes in the layout section,
*Avoid overlap* and *… including labels*, both **off by default** as
asked, spelled out on every run of a layout that has the option (never
on preset or random), linkable as `?avoidOverlap=` / `?overlapLabels=`.

**115.5 — tests.**  `test/modules/layout-separation.mjs` (14 specs: the
directional rule exact against a touching probe, the asymmetric case,
the compass-point squares, a crowded ring of 120 × 20 boxes binding at
the 7.5° chord, the two-places-apart wide pair, the centre-node
clearance, the band, the composed call); and a **not-over-separated**
block in the quality suite — a crammed run of grid, circle, concentric
and radial on three fixtures must leave some pair at exactly the
padding (a layout at its minimum spacing has a binding pair),
breadthfirst packs a rank to the padding and spaces rows by heights,
force's separation keeps the boxes over a fifth of the field on the
fan fixtures and a third on a 60-clique of labels, each force row with
its raw-settle control.  Overlap-free was only half the property; the
first version of every 114 rule passed the half it had.

### After, on em-web (overlap on)

| | bodies | labels |
| --- | --: | --: |
| circle diameter | 15.9k (v3's default look: 17k) | 23.2k (was 57.6k) |
| concentric | 11.6k | 16.6k (was 26.3k) |
| radial | 14.2k | 20.5k (was 27.0k) |
| force | 2.8k × 2.4k | 3.2k × 2.5k (was 11.6k × 12.5k) |

Looked at, at 1:1: force's big cluster is a compact packing with
labels adjacent; the rings read like v3's.  The residue the browser
metric still counts on force — four label pairs by ≤ 3.9 px, two body
pairs by ≤ 0.3 px — is em-web's 2 px text outline (excluded from the
layout box, as v3 excluded it) and a Float32 hair.

### Follow-ups logged, not taken

- Size-aware repulsion inside the sim (CPU and WGSL), still the way to
  an overlap-free *live* run; the post-pass now makes the settle cheap
  to look at, which lowers the pressure.
- A ring at its exact minimum still leaves most neighbours with air —
  the binding pair sets the radius.  Non-uniform angular spacing would
  close it and change what a circle layout is; not taken.
- Flow's width on non-DAGs (em-web: 149k px) is dummy nodes on the
  6,899 edges, not spacing; flow's own fixtures are the DAG sheets.
