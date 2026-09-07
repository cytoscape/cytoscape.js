## The force rounds: the settle at scale, the infinite run, and the page

Raised by the maintainer on 2026-09-07, reading round 117's report.
The first question was whether the in-sim overlap term was simply
expensive against the post-sim separation; the answer was that it is
additive (the settle's separation stays on in both bench columns, so
the 22 s and 117 s rows are its pure price), that it does not clear a
dense graph, and that its stiffness forbids an early stop.  The second
was whether there is a clear way to make the in-sim approach faster
than the post-sim one, or whether to cut losses; the answer was to
stop investing in the force-based term, take item 57 first because the
settle's separation is the mechanism every default drawing depends on,
and revisit in-sim overlap only as *projection* — one separation sweep
after each tick, the settle's own primitive, which cannot be
out-pushed by the springs and does not bounce.  The maintainer then
raised the live / infinite force-directed run "lots of people like to
do", observing it is rarely good UX and might be done better by only
running iterations while the network's energy is past a generous
epsilon, and concluded that both post-sim and in-sim overlap
correction are necessary: an infinite run has no end for a settle to
land on.  "OK, let's do all of the force-layout rounds we touched on",
with an addition: widgets on the debug page for the live force mode,
and an option to select the overlap approach, at least for the
non-live mode where either could be valid — and, mid-round, "make sure
to include tests wherever possible to ensure correctness and avoid
regressions".

What the round takes, in order:

- [x] **118.1 — item 57**: the settle's separation at 25k, on the
  per-stage measurement the item asked for.
- [x] **118.2 — in-sim overlap as projection**: the contact force is
  replaced by a separation sweep per tick on both executors, and
  the overlap approach becomes selectable — `avoidOverlap: 'settle' |
  'sim' | 'both'` (true is `'settle'`).
- [x] **118.3 — the infinite run**: `infinite: true` holds the run
  open, ticks only while the field is moving, reheats on a drag and
  on request, and pins the dragged node into the sim on both
  executors.
- [x] **118.4 — the page**: a Live/Infinite control and an overlap
  approach select in the layout section, driven.

### 118.1 — the settle's separation at scale (item 57)

**The measurement.**  The item asked for the overlap count after each
of the pass's three stages on the 25k scene, and the same on 10k and
15k to find where the 5k behaviour stops.  Taken headless on the
render bench's random scene (mulberry32 seed 42, `n × 2n` edges, 12 px
bodies, `iterations: 300`, `avoidOverlap: false` to get the sim's own
field, then the pass on that field with a stage trace — the
`separateBodies` export now takes one).  Counts are of the *padded*
boxes, 22 px, since that is what the pass separates; "nodes" is how
many sit inside some neighbour's box.

| stage, 25k × 50k | pairs | deepest | mean | nodes touching | bounding box |
| --- | ---: | ---: | ---: | ---: | --- |
| in | 79,373 | 15.8 px | 5.82 px | 23,180 (93%) | 6091 × 4989 |
| local sweeps | 75,668 | **21.9** | 6.58 | 21,982 | 6091 × 4989 |
| stress round 1 | 81,873 | 21.9 | 5.48 | 22,330 | 6091 × 4989 |
| stress round 20 | 101,150 | 21.9 | 3.81 | 22,685 | 6091 × 4989 |
| stress round 40 | 100,952 | 21.9 | 3.51 | 22,917 | **6091 × 4989** |
| closing sweeps | 69,127 | 22.0 | 5.68 | 22,879 | 6091 × 4989 |

The same shape at 10k (21,482 in → 18,615 out at 21.7 px deepest) and,
milder, at 5k (7,879 → 5,887).  Three things the numbers say:

1. **The sweeps make the worst pair worse.**  A push along the axis of
   smaller overlap, by the whole amount, lands the pair on the next
   node in a field where nine nodes in ten already touch one — the
   deepest overlap goes from 15.8 px to the full box in one stage.
2. **The stress rounds never move the field.**  The bounding box is
   identical after forty rounds; the pairs go *up*.  A stress round is
   a local Jacobi step — each node moves to the weighted average its
   near pairs ask for — and in a uniformly dense field the asks cancel:
   a node whose every neighbour wants it further away goes nowhere.
   The global mode a crammed field needs converges across a pile's few
   hops (the 60-clique, the 200-clique) and not across a field's
   hundreds.
3. **The closing sweeps deepen it again**, and that is the state the
   item measured coming out.

Where the 5k behaviour stops, on the local passes alone (crammed
random fields, the same generator): 500 nodes clear in a sweep and a
few stress rounds; 1k (60% touching) clears in the budget; 2k (72%)
clears with 576 pairs left for the closing sweeps; **3k (80%) leaves
1,347 pairs after the whole budget.**  So the boundary is a component
of a couple of thousand nodes.

**What landed.**  Stage 0, *expansion*: a component of at least
1,000 nodes with at least 60% of its nodes touching a neighbour is
scaled about its centroid by what its **median** overlapping pair asks
for (`separationAlong` along the pair's own direction, plus the half
pixel, over its current distance), capped at 1.25 per round, and again
while it stays crammed, up to twelve rounds.  Then the three local
stages as before.  A pinned node holds its component back from the
scale (a scale moves everything, and the re-pack has the same rule).
The thresholds were measured rather than chosen: the 75th percentile
over-expanded (the survivors of each round are the deeper pairs, so
their percentile drives the whole component), and a size floor rather
than a depth test separates a pile from a field — the median
overlapping pair of the 60-clique of labels asks for under 2× just as
the 25k field's does, but the clique fills 0.45 of its field under the
stress rounds and 0.33 under a scale, which is 114.5's over-separation
back again.

| field (22 px boxes) | expansion rounds | after expansion | after the local passes | bounding box in → out | time |
| --- | ---: | ---: | ---: | --- | ---: |
| 5k × 10k | 2 | 1,641 pairs, 44% touching | **0** | 3484 × 2680 → 4148 × 3739 | 0.6 s |
| 10k × 20k | 2 | 5,402 pairs, 58% | **0** (8 at 0.5 px into the padding) | 4472 × 3564 → 5436 × 5243 | 1.4 s |
| 25k × 50k | 3 | 11,423 pairs, 53% | **0** | 6091 × 4989 → 8735 × 8798 | 3.3 s (7.6 s before) |

And a **best-state guard**: the summed overlap depth over the near
pairs is measured at entry and after every stage (in the grid pass
each stage already makes), the shallowest state is kept, and it is
restored at the end if the closing sweeps left the field deeper.  On
the real 25k field with the expansion withheld (a pinned node) it
fires: the closing sweeps end at 69,357 pairs at 5.66 px mean and the
guard restores the fortieth stress round's 100,417 at 3.52 px — the
shallower field, and the one thing the item said must never happen
again (a deeper field out than in) cannot.  No synthetic field has
been found on which it fires — a jittered lattice and a uniform
scatter both end with the closing sweeps their shallowest — so the
modules spec pins the contract and records the measurement as its
control.

End to end, through the layout (12 px bodies, the sim's 300
iterations, headless CPU):

| scene | before 118.1 | after | settled field |
| --- | --- | --- | --- |
| 5k × 10k | 0 overlapping bodies | 0 | 3546 → 5034 px wide |
| 10k × 20k | 1,015 pairs, 11.7 px deep | **0** | 4541 → 6715 |
| 25k × 50k | 13,498 pairs, 11.8 px deep | **0** | 6198 → 11115 |

The field grows 1.4–1.8× linearly (the re-pack widens it past the
component's own scale, since the small components are packed around a
larger one) — what 25,000 padded 22 px boxes need in a clustered
field, and under the 2× the quality suite's over-separation rule
allows.  The 60-clique of labels, the fan and the labelled fan are
unchanged to the pixel (the expansion never fires under a thousand
nodes).

**The gates.**  `test/modules/force-separation.mjs` runs the pass on
synthetic fields without the sim — a crammed 20k lattice comes out
overlap-free through the expansion stage, grown under 2×, in under 5
s; an 800-node one is a pile and takes the stress rounds with no
expansion; the guard's contract holds through the local passes on a
pinned 6k lattice and an 8k scatter; a clear field runs no stage; a
sparse residue clears in the sweeps alone.  The quality suite gained
the row at scale it never had (every `separates` row was under a
thousand nodes): **force on a crammed 3k random field** is clear to
the padding — the contract is `avoidOverlapPadding`, not mere
non-overlap, since the old pass's 4.3 px residue there still kept the
bodies apart — and grown under 2× against the raw run, with the raw
run as the control.  Both went red with the expansion stubbed
(`CRAMMED_FRACTION = 2`): the row at 7.4 px against the 9.5 it asks,
the 20k lattice at 52,816 pairs.  The row costs 3.9 s (two 3k sims).

### 118.2 — in-sim overlap as projection, and the approach as the option's value

**What changed.**  `avoidOverlap` on force takes the mechanism:
`true` / `'settle'` (the default) is the settle's exact pass, `'sim'`
is a separation sweep after every tick and no settle pass, `'both'`
is both, `false` neither, and any other value throws at start (the
throw gate covers it).  `avoidOverlapInSim` (117) is gone — a boolean
beside a boolean could not spell "the sim alone", which is the one
the page needs for a live run and the one an infinite run needs by
construction — and so is 116.1's contact force, on the measurement
117 took: a force bounded by its gap clamp loses to a dense graph's
spring pressure, and its stiffness anneals every run to the floor.
The bench's `--layout-sim-boxes` now spells `avoidOverlap: 'both'`
and labels its rows so.

**The primitive is shared.**  The settle's near-pair grid and push
moved out of `separateBodies` into `layout/separation.mts` as
`OverlapGrid` (scratch allocated once, the grid rebuilt from the
positions on every pass, hashed by the largest box so any two
overlapping boxes share a 3 × 3 neighbourhood; a non-finite field
builds no grid) and `pushApart` (along the axis of smaller overlap, a
hair past touching, half each or all onto the free node, the lower
index negative on a tie, returning the distance opened).  The settle
runs its sweeps through it unchanged — the 118.1 specs and the
quality suite are the control that nothing moved — and the sim runs
`OverlapGrid.sweep` after each step.  The sim's own repulsion grid is
back at the cutoff (116.1 had grown it to the largest box for the
contact gather); the sweep has its own.

**What the measurement decided, in order.**

1. *The sweep's push counts toward convergence.*  The first version
   kept it out, as the constraint projection is kept out, and the
   30-clique ended with 4 pairs overlapping and the 200-clique with
   155: the run stopped by displacement while the sweep still had
   work.  The constraint precedent does not carry — a constraint
   fighting a force corrects by a constant every tick, while the
   springs' pull into overlap shrinks with alpha, so the sweep's
   corrections do too.
2. *The alpha floor waits for a quiet sweep.*  With the fold, the
   200-clique still ended with 128 pairs at the floor (alpha 0.001,
   iteration 458): the forces are gone there and each tick is one
   sweep, and a pile opens under pairwise pushes only slowly — 92 more
   sweeps cleared it.  So with boxes the floor test also requires the
   largest push under `threshold`, on both executors (the GPU's
   `applySep` folds its pushes into the same atomic max the poll
   reads).
3. *Sweeps per tick.*  Measured on the two cliques of padded 40 px
   boxes (overlapping pairs at ticks 50 … 450 and the iteration the
   run ends at):

   | sweeps / tick | 30-clique: pairs at tick 50 / 200 / 350 | ends | 200-clique: pairs at 50 / 200 / 350 / 450 | ends |
   | ---: | --- | ---: | --- | ---: |
   | 1 | 47 / 31 / 8 | 473 | 859 / 451 / 312 / 146 | 643 |
   | 2 | 46 / 24 / 4 | 458 | 652 / 413 / 204 / 48 | 636 |
   | 3 | 39 / 13 / 1 | 454 | 548 / 360 / 167 / 27 | 599 |
   | 4 | 35 / 8 / 0 | 431 | 484 / 329 / 111 / 24 | 555 |

   Every count ends clear.  What the table says about the transient:
   at alpha 0.47 the step cap lets the springs move a node 28 px —
   more than half a box — into its neighbours every tick, and no
   number of sweeps clears a pile that is refilled that fast; they
   hold it open (45 of the 30-clique's 435 pairs against the whole
   pile without them) until the anneal lets them win, from about tick
   400 of 458.  Two per tick is the balance taken: the second sweep
   takes the residue the first's own pushes made (a pair pushed onto
   a third node) for one more grid pass, and the third and fourth buy
   a shorter tail at a price every tick.  The count is one constant,
   `SWEEPS_PER_TICK`, shared with the GPU encode.
4. *A clear pair is untouched, exactly.*  116.1's ring spec compared
   equilibria from the scatter seed within 5%, and the sweep fails it
   at 74 px against 67: it opens the transient pile, and a ring's
   equilibrium moves with its trajectory.  The property is now stated
   exactly — a ring seeded clear at 100 px spacing runs
   byte-identically with boxes and without — with the scatter-seeded
   ring as the control that the sweep is not silent there.

**On the GPU.**  Two kernels, `separate` and `applySep`, after
`apply`: the grid is rebuilt from the stepped positions (clear, bin,
scan, scatter — the pyramid is not needed), `separate` gathers per
node the pushes of its overlapping neighbours over the 3 × 3
Jacobi-style, clamped to the largest single pair's so a node hemmed
in on every side moves by what one pair asks, and `applySep` moves,
republishes to the render column and folds the push into the
displacement max.  Repeated `SWEEPS_PER_TICK` times per iteration,
each on a fresh grid.  The boxes still ride the CSR tail; `separate`
binds six buffers, `applySep` six (the column and the meta among
them).  The executors agree on the invariants — clear at the end,
the padding kept — and not the trajectory, as everywhere.

**The gates.**  `test/modules/layout-separation.mjs`: the grid visits
an overlapping pair once with its overlaps and a clear pair on
request, finds a wide pair across a cell boundary, `pushApart`'s
halves, the pinned rules and the tie, `sweep`'s largest push and its
0 on a clear field, a NaN field.  `test/force-sim.mjs`: the 30-clique
and the 200-clique settle overlap-free at the padding (the control
piles), the seeded-clear ring is byte-identical, the scatter ring is
wider, `extents: null` is byte-identical to before the field existed,
the wide pair is found.  `test/force-layout.mjs`: `'sim'` streams a
held-open pile (under a third of the point sim's overlaps mid-run)
and ends clear with the padding kept and no settle pass; `'both'`
ends at exactly the padding; the default is still the settle alone
(117's control); an unknown value throws.  All of them red with
`SWEEPS_PER_TICK = 0`.  The browser spec (116.1's) now runs the live
GPU run under `avoidOverlap: 'sim'` and asserts it lands clear.

### 118.3 — the infinite run

The maintainer's framing: the live / infinite force-directed layout
"lots of people like to do" is rarely good UX, and might be done
better by only running iterations while the network's energy is past
a generous epsilon.  That is what landed, with the epsilon the sim
already had.

**The shape.**  `infinite: true` on force streams like `animateLive`
and never converges on its own: `converged()` is false on both
executors (the iteration cap is ignored) and a new `idle()` — the
settle test without the cap: alpha at its floor with a quiet sweep,
or the displacement under `threshold` for three ticks — says when
ticking would move nothing.  The CPU loop schedules no frame while
idle; the renderer skips the encode and lets its clock stop (an idle
infinite run no longer drives `schedule()`).  So at rest the run is
the cost of five listeners.

**What wakes it.**  The impl wires the core's `grab`, `free`,
`position`, `add` and `remove` for the run's life:

- `grab` on a scoped node pins it into the sim (`ForceSim.setPinned`;
  on the device `GpuForceRuntime.setPinned` rewrites the one slot word
  whose bit 31 is the pin).
- every `position` event on a scoped node — the pointer's drag writes
  through `node.position()`, and so does a program — copies the
  store's coordinates into the sim (`setPosition`; on the device an
  8-byte `queue.writeBuffer` into `simPos`, ordered before the next
  submit's encode, which the apply kernel then publishes) and reheats:
  alpha rises to 0.3 (`REHEAT_ALPHA`, d3's drag convention), the
  settle counter restarts, and the loop is woken (`renderer.wakeForce`
  on the device).
- `free` releases the pin and reheats, so the field relaxes around
  where the node was left.
- `add` / `remove` under a whole-graph scope ask for a rebuild: the
  current `runOnce` ends (the GPU poll and the CPU loop both watch the
  flag), lands the positions, the context drops its cached scope
  (`LayoutContext.refreshScope` — the scope was materialized once per
  run, and a rebuilt run must see the graph as it now is), and
  `runOnce` goes again with the seed skipped, relaxing every node
  where it stands and the new one where it was added.  A subset scope
  is the caller's collection and stays what it was.

`layout.reheat(alpha?)` is the public handle for a change the run
cannot see — an edge length under a data mapping, a restyle that
resized the boxes — added to the contract (`LayoutImpl.reheat?`,
`CustomLayout.reheat`) as an optional verb, so an impl without one
ignores it.

**The end.**  `stop()` wakes an idle run so the stop lands, and the
landing is the positions as they stand: no separation pass, no
re-pack, no fit and no tween — the person is looking at them.  Hence
`avoidOverlap` under `infinite` is the per-tick sweep (`'settle'` and
`'both'` read as `'sim'`, since there is no settle), which is the
reason 118.2 exists in the order it does.

**The gates.**  `test/force-sim.mjs`: an infinite sim is never
converged after 2,000 steps and is idle; `reheat()` clears idle and
sets alpha 0.3; a node pinned elsewhere reflows the field (the
one-shot sim as the control, converging under its cap).
`test/force-layout.mjs`: at rest the positions stop moving and the
promise stays pending, and `stop()` lands them with the zoom
untouched; a drag holds the grabbed node exactly where it was put
while both ring neighbours are pulled after it, and a release lets
the ring relax to somewhere between (the finished `animateLive` run
as the control: the same gesture moves nothing else); an added node
and edge are absorbed to within 250 px of their neighbour (the
control: a finished run leaves it where it was added); a subset scope
ignores the add; `reheat()` returns the layout; a locked node stays
through a drag of its neighbour; a clique of bodies rests
overlap-free by the sweep.  All red with the `position` wiring and
the never-converged rule stubbed.  The browser spec runs the same on
the GPU: the frame count holds still for a third of a second once the
field rests, a pointer drag of 200 rendered px wakes it with the
grabbed node at the pointer and both neighbours following, and
`stop()` resolves the promise with the zoom untouched.

### 118.4 — the page: the Infinite control and the overlap mechanism select

**What the layout section gained.**  A force-only **Infinite** box
(`infinite: true`; it implies the stream, so it wins over Live and
Animate) with **Stop** and **Reheat** buttons enabled while an
infinite run is under way — Apply ends a run under way before it
starts anything, since two sims over one graph would fight for the
positions — and a **Force overlap by** select spelling
`avoidOverlap: 'settle' | 'sim' | 'both'`, enabled under Avoid
overlap on force and pinned to `sim`, disabled, under Infinite, where
there is no settle.  The spellings are two pure functions in
`debug/layout-config.js` (`forceAnimation` gained the infinite case,
`forceOverlap` is new) and the module suite pins them: Infinite wins,
the select's three values pass through, an unknown value is `settle`,
Infinite forces `sim`, and the other layouts keep their boolean.

**Driven** — scripted Chromium on the real adapter (amd), the
Playwright harness flags, `debug/index.html?network=gen&gen=…`, the
page's own controls clicked and its `layoutstop` awaited.  The
Chrome extension for a hand-driven session was not connected, so a
person has still not sat in front of it.

| `gen=300x600`, 12 px bodies | time | overlapping bodies | tightest gap | field |
| --- | ---: | ---: | ---: | --- |
| Avoid overlap off (the control) | 1.7 s | 0 | 3.8 px | 1238 × 907 |
| settle | 1.7 s | 0 | 10 px | 1256 × 906 |
| sim | 2.6 s | 0 | 10 px | 1207 × 901 |
| both | 2.7 s | 0 | 10 px | 1207 × 901 |

And the infinite run on the same scene: the field rests 3.2 s after
Apply and the frame counter then holds still (0 frames over half a
second — the clock stopped); the drag, aimed by hovering until the
GPU pick reported a node (n143, at the viewport centre), fired `grab`
on that node, ran 111 frames, and left the node under the pointer to
within the press offset (4 px); Reheat ran 18 frames and rested
again; Stop disabled itself and landed the field with no overlapping
bodies and the tightest gap at 9.8 px.  What the first drive taught
about driving: `node.position()` and `renderedPosition()` read the
CPU column, which is stale under the lease, so a pointer aimed by
them pressed the background and panned — the same trap 118.3's
browser spec fell into, solved there by stopping first and here by
hovering.  `docs/agents/rendering.md` says so.

**What the 25k scene found: a sweep does not open a crammed field,
and the floor needs a budget.**  `gen=25000x50000`, the item-57
scene, on the page:

| 25k × 50k, 12 px bodies | time | overlapping bodies | tightest gap | field |
| --- | ---: | ---: | ---: | --- |
| Avoid overlap off | 11.8 s | 21,324 | −6.9 px | 5686 × 4552 |
| settle | 15.1 s | **0** | 7.7 px | 10862 × 8425 |
| sim (before the budget) | 76.2 s | **2,565** | −8.2 px | 5951 × 4845 |
| both | 80.2 s | **0** | 9.5 px | 8418 × 6625 |

The settle row is item 57 fixed where it was found: the field 117
saw as half-covered bodies at zoom 4 is clear.  The `sim` row is the
limit of a per-tick sweep, and the same diagnosis as 118.1's: a sweep
is a local pass, and a field whose density exceeds what its boxes
allow is not its to open — the bounding box is the point sim's, and
the run ran to its iteration cap still pushing.  `both` opens it (the
settle's expansion) and is priced for it.  Worse, the infinite run on
this scene **never rested**: the sweep's largest push never fell under
the threshold, so `idle()` never held, and the page drew frames for
the whole minute the drive waited.  So a boxed run now keeps sweeping
past alpha's floor for at most `FLOOR_SWEEP_BUDGET` = 200 ticks (the
200-clique needed 92 under one sweep per tick), on both executors,
after which the field is as open as a sweep can make it and the run
is idle — `test/force-sim.mjs` pins it on a crammed 3k random field
(idle between 600 and 700 ticks with overlap left; red with the
budget removed), and the JSDoc and README say which graphs want
`'both'`.
