## The re-pack takes a grouping and an order, and the larger components turn

Raised by the maintainer on 2026-09-09, from the round-120 follow-up
list: the page's EM combo should be the library's — one force call,
not harness code — with the mixed component's placement settled; the
components of five nodes and up should take a canonical orientation
as the small ones take shapes; the singleton row wanted one look with
labels on; the round-119 batch ramp wanted pricing before doubling;
and EnrichmentMap also sorts the components by score, which the
packing should allow.

### What the EM preset does with score, measured

em-web's singleton rows by position: the positives read 2.47, 1.92,
1.91, 1.87 … 1.38 left to right and top to bottom; the negatives -1.30,
-1.31 … -1.71 on the first row and -1.71 … -2.42 on the second.  So
within a size the row is NES descending — the strongest positive
first, the weakest negative first — on each side.  The pairs and
triples rows are not score-sorted in the preset; the singletons are.

### 121.1 — `componentGroup`, `componentOrder`, `groupSpacing`

The settle's re-pack (`packComponentBodies`, `layout/pack.mts`) takes
a grouping and an order: `groupOf` per component, each group
shelf-packed on its own and the group boxes standing in a row left to
right by index, top-aligned, `groupSpacing` apart; `compare` over
component ids ahead of the area order, whose ties the area order
breaks, so a comparator that says nothing is the default.  `shelfPack`
gained the comparator; `componentBoxes` is the per-component body box
made shared.  Force describes each component once at the settle — its
nodes as a collection (`ctx.nodes._spawnUnique` over the sim refs),
its node count, and its body box's width and height as the re-pack
will see it — and hands the descriptions to `componentGroup` (a key
per component: numbers ascending, then strings, then the unkeyed
last) and `componentOrder` (a comparator).  Both must be functions;
anything else throws at start.  Skipped exactly when the re-pack is
(a locked node in scope, or constraints) — the group function is
never called then, and the spec says so.  The EM shape is
`componentGroup: (c) => Math.sign(mean NES)` and `componentOrder: (a,
b) => b.size - a.size || mean(b) - mean(a)`.

### 121.2 — the larger components turn

`orientComponents` (`layout/pack.mts`), after the shapes and before the
separation pass: a component of five nodes and up rotates about its
centroid — with a principal axis (its position covariance's
eigenvalues 1.15 apart) it lies flat, the axis horizontal, by the
smaller of the two turns that get it there, the wide box the shelf
rows want; an isotropic one (a ring, a star) turns its farthest member
to the top, as the small shapes do with a point or a hub.  A pinned
node holds its component.  A turn re-overlaps axis-aligned boxes, so
it runs only where the settle pass follows: an `avoidOverlap: 'sim'`
run, whose sweeps are all it has, keeps the sim's angles (the 114.5
`'sim'` spec caught the first version returning 27 overlapping pairs).
Under `tidyComponents`, so one option turns the whole thing off.

### 121.3 — the mixed component sits between the sides

The page's group function returns -1, 0 or 1: a component whose
minority sign holds a quarter or more of its signed members is mixed
and packs between the negatives and the positives, where its red and
blue clusters read as what they are.  em-web's 187-node component (59
positive, 128 negative) sits there; the preset itself puts it
top-left with the negatives, which the majority rule would reproduce
and the doc records.  A component with no signed member is unkeyed
and packs last; a network with no signed field is one group, a plain
run.

### 121.4 — the singleton row with labels on

Looked at on em-web with `nodeDimensionsIncludeLabels`: under the
library's largest-box-first order a singleton with a wide label packs
among the pairs and a pair with short labels among the singletons —
the boxes are the labels' now, not the shapes'.  The EM entry's
size-first order gives clean rows regardless.  The library default
stays largest-box-first (the tightest packing, and every earlier
measurement's), and `componentOrder: (a, b) => b.size - a.size` is the
one-liner for rows by count; the page shows it.

### 121.5 — the batch is priced before doubling

`nextBatch` (`render/gpu-force.mts`) takes the device's time on the
last completed batch and the iterations it carried, and grows no
further than `BATCH_FRAME_BUDGET_MS` (100) buys at that cost per
iteration; the price only holds the doubling back, and shrinking stays
the backpressure's.  The price is the device's own: the renderer times
each non-presenting frame from the later of its submit and the
previous frame's completion to its `onSubmittedWorkDone` — the queue
runs frames back to back, so that is the frame's GPU time.  The
frame's wall clock cannot see it: a vsync-paced frame submits and
returns while the queue absorbs the work, and the stall lands two
frames later all at once.

Measured on the page, the 25k × 50k silent run: the encoded batch now
rides 3–16 (an iteration prices at 6.5–9 ms there; 100 ms buys 12–15)
and no run frame is over 50 ms; the run is 3.0 s against 119's 3.3 s.
The one long frame in the recording — 280 ms, the sixth after the
click — is the run's synchronous start on the CPU (components, the
spectral seed, the buffers) and is not the batch's.  em-web unchanged:
0.23 s in 16 frames.

### 121.6 — the run's synchronous start, the seed's BFS typed

The one long frame left on the 25k run was the click's synchronous
start, and the maintainer said go ahead.  Timed piece by piece on a
25k × 50k graph headless: components 5 ms, anchors 1, the scatter 5,
the spectral seed **190–204 ms**.  Inside the seed, the BFS from each
of 25 pivots per component walked incidence lists of *edge* ids,
resolved each neighbour's local index through a `Map`, and queued
levels in fresh arrays — 2.5 million map lookups a run.  The
neighbour lists are now a CSR of node ids, the local index a typed
array filled once, the queue one `Int32Array` — bit-identical output
on the 25k reference (50,000 coordinates, zero differ), and the seed
is **70–75 ms**: BFS 30, the embedding 10, the eigenpairs 8, the
pivot scan 7, the CSR 5.  A convergence exit on the power iteration
was tried and reverted: the 25 × 25 matrices do not reach 1e-9 in
fewer than the 300 iterations on em-web, so it bought nothing and
moved the embedding by 1e-4 px; the per-iteration buffer is hoisted,
which is bit-identical.

On the page, the library's `run()` call at 25k × 50k is now 95–120 ms
synchronous (the seed and its prep 60–73 of it, the edge scan 17–20,
the device start 11) and the run's first frame 83–117 ms; em-web's is
19–29 ms.  The 280 ms the earlier recording showed after the click
was that start plus the harness's own edge-style override, which
restyles 50k edges before the run and is the page's, not the layout's.

### The page

The dropdown entry is **Force, grouped by sign and ordered by score
(EM)**: force with `signedPacking(key)` from `layout-config.js` — the
group by `signGroup` (-1, 0, 1 or null), the order by size then
`scoreOf` descending — when the network has a `signKey`, a plain force
run otherwise; the two-run combo driver is gone.  Driven in scripted
Chromium on the real adapter, avoid overlap on: em-web 302 ms (one
run, against 120's two at 397), em-desktop 493 ms (against 668).  The
screenshots: blue left, largest first then rows by size with each row
from the strongest score, the mixed component between, red right.

### The gates

`test/modules/pack-group.mjs`: the component boxes; groups packed on
their own in a row, by index, a groupSpacing apart, top-aligned; a
comparator ahead of the area order and the area order breaking its
ties; the largest component's centre held through a grouped re-pack.
`test/modules/pack-orient.mjs`: a tilted path lies flat about its
centroid with every distance kept, by the smaller turn; an isotropic
ring puts its farthest member on top; the size floor and a pinned
node hold.  `test/force-layout.mjs`: through the layout, the groups in
a row keyed ascending a groupSpacing apart with one description per
component; the order by size then score in each group's reading order;
an unkeyed component last, a non-function throwing at start, and a
locked node never calling the group function; a 7-path lying flat at
the settle with its end-to-end length kept against the tidy-off
control.  `test/modules/gpu-force-batch.mjs`: the price holds the
doubling at what the budget buys, a cheap batch is never held back, a
missing price is the plain doubling, and backpressure still halves.
The seed's specs (`test/modules/force-init.mjs`) hold unchanged, as
the 25k reference says they must.
The harness spec pins the page's group, score and options.  All 2,616
Node specs green; the force browser specs green on the real adapter.
