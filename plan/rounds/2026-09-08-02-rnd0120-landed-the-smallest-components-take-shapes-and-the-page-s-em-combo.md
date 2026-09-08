## The smallest components take shapes, and the page's EM combo

Raised by the maintainer on 2026-09-08, after round 119: the force
layout's packing can be more orderly.  Components of one to four
nodes should take canonical shapes — a pair as a vertical barbell,
three as a triangle, four as a diamond — which also orders the rows
of small components by size, and helps centre-aligned labels, which
read left to right, stay off each other.  An option on force, with a
widget on the debug page.  And the layout dropdown should gain a combo
entry that uses two or more layout calls for the EnrichmentMap case:
force-directed overall, then packed so the red components sit on one
side and the blue on the other, each side ordered by component size
as the general packing already is.

### What the EM preset does, measured

The em-web fixture's preset positions, by component (144 of them: 99
singletons, 20 pairs, 9 triples, 4 quads, one of 187 nodes holding
59 positive and 128 negative NES):

| row | what sits there | x range, positive NES | x range, negative |
| --- | --- | --- | --- |
| top | the 187-, 78- and 32-node components | — | 0–3,500 |
| second | 15, 14, 14, 11, 10, 8, 7, 6, 5 | 3,500–4,150 | 30–1,700 |
| third | the quads and triples | 3,800–4,000 | 90–2,800 |
| fourth | the pairs | 3,570–4,120 | 30–2,900 |
| bottom | the singletons | 3,530–3,850 | 650–2,660 |

So: shelf rows by size, largest first, and the field split by sign
with the positives to the right — the same packing force already does,
run once per sign.

### 120.1 — canonical shapes for components of two to four nodes

`tidySmallComponents` in `layout/pack.mts`, run at the settle before
the separation pass (so the pass finds the shapes clear) and before
the re-pack (so their boxes are what it packs).  A pair stands as a
vertical barbell, three make an equilateral point-up triangle, four a
diamond (top, right, bottom, left).  The radius is the larger of what
the edges ask — the component's edge length along every side — and
what the bodies need: horizontal neighbours a body width plus the
padding apart, vertical ones a body height plus the padding.  Nodes go
round the perimeter in a depth-first walk, a path from an end and a
star from its hub, so a path's or a cycle's edges run along the sides
and a star's hub takes the top.  The shape is centred where the
component's centroid was.  Left alone: singletons, components of five
or more, a component holding a locked node, and one whose edges ask
for different lengths (a data-driven `edgeLength` is the caller's
point — the per-edge-length spec caught the first version giving a
40/160 path one side).  Constrained and infinite runs skip it with the
re-pack.  The option is `tidyComponents`, default **true**.

Why it orders the rows: the re-pack shelf-packs by box area, largest
first, and every component of a size is now the same box, so the
quads make a row, then the triples, then the pairs, then the
singletons — which is the EM preset's shape.  Before, a pair's box was
its sim angle's, and a flat pair packed among the singletons.

### 120.2 — the page: the tidy box and the sign combo

A **Tidy small components** box (force only, on by default, spelled
into `tidyComponents` every run), and a dropdown entry **Force, then
pack by sign (EM combo: two runs)**.  The combo reads the network's
`signKey` (NES on em-web and em-web-clustered, `EM1_NES_Data_Set_1_`
on em-desktop), splits the components by the sign of their members'
mean value — whole, so the mixed 187-node component goes with its
majority, and a component with no value follows the negative side —
runs force on each side's nodes and edges as its own scoped run (each
side's components packed largest first, as force packs), shifts the
positive side to the right of the negative side's box with three
component spacings between, and fits (animated under Animate).  A
network with no signed field is one plain run.  The pure parts —
`splitBySign`, `isCombo`, the tidy spelling — are in `layout-config.js`
and pinned by the harness spec; the readout says how many force runs
the combo made.

Driven in scripted Chromium on the real adapter, avoid overlap on:
em-web force with tidy 215 ms, the combo 397 ms (two runs), em-desktop
combo 668 ms; the screenshots show the blue components left, largest
first, the red right, and the pairs, triples and quads in rows.

### The gates

`test/modules/pack-tidy.mjs`: a pair stands at the edge length centred
where it was; three make an equilateral point-up triangle and four a
diamond with axis-aligned diagonals; a star's hub takes the top and a
shape grows for wide bodies; singletons, a 5-cycle and a pinned pair
are untouched.  `test/force-layout.mjs`: through the layout, the three
shapes hold beside a 6-ring; `tidyComponents: false` keeps the sim's
angle (the control), and a locked pair holds while the free shapes
still take theirs.  The harness spec pins the page's spellings and the
split.  All 2,612 Node specs green; the force browser specs green.
