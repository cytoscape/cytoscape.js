## Item 56: the sim half of `avoidOverlap` becomes opt-in

Raised by the maintainer on 2026-09-04, the morning after round 116
closed with item 56 open: "let's consider the followups", and then "go
ahead with all of what you proposed".  What was proposed, in order: take
the first measurement item 56 named before making its call; change the
convergence test only if the measurement said the field was done early;
make the sim half opt-in only if the field was still moving late;
re-run the render bench's `--layout` rows on the fixed readback and mark
the nine-iteration figures in the record; and drive the debug page by
hand, which round 116 had not done.

### The measurement item 56 asked for

The item's question: at what iteration does a boxed run's *field* stop
changing (every position within 1 px of its final one), against the
iteration the run stops at?  If the field were done by alpha ≈ 0.05, an
alpha floor there would cost nothing visible and recover over half the
price.  Measured on the CPU sim directly (`ForceSim`, the defaults,
padded boxes as the layout hands them), snapshotting every iteration:

| fixture | stop | alpha at stop | field within 1 px from | alpha there |
| --- | ---: | ---: | ---: | ---: |
| 12-clique, 40 px boxes | 350 | 0.005 | 337 | 0.006 |
| 30-clique, 40 px boxes | 409 | 0.002 | 395 | 0.003 |
| 200-clique, 40 px boxes | 458 | 0.001 | 450 | 0.001 |
| nesting fixture (2 × 4-clique + cross), 30 px | 149 | 0.105 | 137 | 0.126 |
| 12-ring, 30 px boxes | 248 | 0.024 | 234 | 0.029 |
| 2k × 4k uniform, 12 px boxes | 458 | 0.001 | 457 | 0.001 |
| 25k × 50k uniform, 12 px boxes | 458 | 0.001 | 455 | 0.001 |
| *point sim, same fixtures* | 78–458 | — | 12 before the stop | — |

The field is never done early: on every fixture it is still moving
until about a dozen iterations before the stop, boxed or not.  The
reason is in the per-tick maximum displacement along the way — with
boxes it sits at the **step cap** (`cutoff · 0.15` = 12.7 px) until
alpha ≈ 0.005 on every pile and on both random graphs, where the point
sim's is under 2 px by alpha 0.05.  The contact term at the 1 px gap
clamp is `repulsion · cutoff² / d`, and `alpha · f'(g*) < 2` fails
until alpha is under about 0.007 for a pair squeezed to the clamp, so
the pairs bounce; a raised floor freezes the bounce rather than skipping
a finished tail.  What a floor leaves behind, before the settle:

| fixture | floor | iterations | overlapping pairs | deepest | distance from the annealed state (max / mean) |
| --- | ---: | ---: | ---: | ---: | ---: |
| 30-clique | 0.001 (now) | 409 | 0 | — | — |
| 30-clique | 0.02 | 259 | 0 | — | 21.6 / 9.6 px |
| 30-clique | 0.01 | 305 | 3 | 5.0 px | 14.0 / 8.1 px |
| 200-clique | 0.001 (now) | 458 | 0 | — | — |
| 200-clique | 0.05 | 199 | 109 | 10.7 px | 51.3 / 12.3 px |
| 200-clique | 0.02 | 259 | 78 | 10.0 px | 63.7 / 11.2 px |
| 200-clique | 0.005 | 351 | 16 | 5.1 px | 30.4 / 9.0 px |
| 2k × 4k, 12 px | **0.001 (now)** | 458 | **395** | **14.6 px** | — |
| 2k × 4k, 12 px | 0.02 | 259 | 1,693 | 18.2 px | 120.6 / 23.1 px |
| 25k × 50k, 12 px | **0.001 (now)** | 458 | **36,042** | **21.9 px** | — |
| 25k × 50k, 12 px | 0.02 | 259 | 37,923 | 21.8 px | 406.1 / 69.0 px |

Two rows the round was not looking for are in bold.  **The boxed sim is
not overlap-free on a dense graph at all**, however long it anneals:
the random graphs the render bench is made of end with 395 and 36,042
overlapping pairs, some at the full box depth.  Round 116 measured the
term on cliques, where the spring pull on an interior node is balanced
and the contact wins; on a mean-degree-4 random graph at the default
ideal length the spring pressure on a node exceeds the contact's
bounded push (the `max(1, d − s)` clamp bounds it, and the clamp is
what keeps the singularity from throwing nodes a box width per tick),
so the pairs sit in equilibrium overlapped, and the settle's exact
separation (115) clears them exactly as it clears the point sim's.  The
diagnosis is the pairs themselves: ordinary degree-3-to-8 nodes 17–25
px apart in 22 px boxes, in every part of the drawing, not the isolated
nodes and not a coincident pile.

So the three ways out item 56 named resolve as: **a changed convergence
test recovers half the price and pays for it in frozen bounces** (78
overlaps of up to 10 px on the 200-clique at alpha 0.02, which the
settle then opens, and a drawing 20–60 px away from the one the run was
heading for); **keeping the term on** pays 1.7–3× the iterations on
every graph for a sim-level guarantee that holds only where the spring
pressure is low; and **opt-in** keeps the guarantee for the graphs it
holds on — a small or clique-heavy graph whose `animateLive` run would
otherwise show piles until the settle — at no cost to everyone else.
The third is what landed.

### What landed (2026-09-04)

**117.1 — `avoidOverlapInSim`** (`feat(117.1)`).  A new force option,
default false, read only under `avoidOverlap`: true hands the sim the
same padded boxes the settle separates (116.1's contact term, both
executors, unchanged); false is the point sim, and the settle's
separation — on by default as before — does the clearing.  The 116.1
layout spec opts in, and a control beside it pins the default: the
30-clique's tightest pair lands at exactly the padding (the settle's
signature, 115.5) rather than beyond it (the sim's).  The browser spec
opts its live run in and asserts the same on a default run of the
kernel.  Control run: with the boxes forced on regardless, the new spec
fails and the old one passes; with the option gating them, both pass.
The render bench gained `--layout-sim-boxes`, which passes the option
to both force rows and suffixes their labels, so the two never read as
one series.  `test/force-sim.mjs`'s six 116.1 specs are untouched —
they hand extents to the sim directly.

**The bench, re-run on the fixed readback** — the 25k × 50k scene,
`--layout --layout-uncapped`, amd gcn-4:

| 25k × 50k, amd gcn-4, `iterations: 300` | point sim (the default) | `avoidOverlapInSim: true` |
| --- | --- | --- |
| GPU live layout to converge | 15.4 s, 7 fps | 22.2 s, 5 fps |
| GPU silent settle | 14.7 s | 21.5 s |
| sync CPU settle (headless path, compounds, constraints) | 43.8 s | 117 s |
| constrained settle (CPU-demoted) | 33.1 s | 35.9 s |

The point column is round 116's within noise (15.4 / 14.8 / 44 s) and
is what a default run now costs; the boxed column is the bench's
`iterations: 300` cap doing the stopping (the run would anneal to 458),
which is why it reads a little under 116's 25.5 / 21.9 / 130 s.  The
boxed sim's result on this scene holds ~36k overlapping pairs before
the settle either way (the measurement above), so the two columns
produce the same drawing after the settle's separation.

The point rows are the figures for every scene in the record from here
on; the pre-116 `--layout` rows in the round-18, 59, 87 and 113 records
were nine-iteration runs (the readback defect 116.1 found), and the 113
record and item 54 now say so where they cite them.

**The page, by hand** — the Chrome extension this session
could have driven by hand was not connected, so the page was driven
through scripted Chromium on the real adapter (amd gcn-4, the harness
flags) with screenshots read back, which is the fallback `AGENTS.md`
allows and the same thing the Playwright specs do — a person has still
not sat in front of it.  What it showed:

- **The locked child under a compound drag** (116.3), on the v3 compound
  fixture with `n8` locked and `n4` dragged by its padding: `n8` stayed
  at (155, 200), `n9` moved with the pointer, and `n4` read back the
  centre of both — the parent's box grew around the stayer, exactly as
  the spec says.
- **The dense pile** (a 40-node, 780-edge random graph): the default
  live run streams the pile and the settle opens it (0 overlaps, the
  tightest pair at 10.1 px — the padding); with `avoidOverlapInSim` the
  700 ms frame already shows separated bodies and the run lands at 12.6
  px.  1.5 s against 2.1 s.  Both look right.
- **The 25k × 50k scene does not** (the finding below): at zoom 4 the
  default run's field is bodies half-covering each other, and the
  probe counts 13,450 overlapping pairs after the settle — 29,727
  after an `avoidOverlapInSim` run.

### What the page found: the separation gives out at 25k (item 57)

Headless, the same graph, 12 px bodies, `iterations: 300`:

| scene | no separation (`avoidOverlap: false`) | with the settle's separation |
| --- | ---: | ---: |
| 5k × 10k | 159 pairs, 2.3 px deep | 2 pairs, 0.5 px |
| 25k × 50k | 12,352 pairs, 5.6 px deep | **13,406 pairs, 11.8 px** |

At 5k the dense pass does what 115 built it to do.  At 25k it hands
back more overlap, and deeper, than it was given — the forty-round
proximity-stress budget gives out on a field where a third of the
nodes touch a neighbour, and the sweeps that follow push into a pile
that is still closed.  Both executors, since the settle is one code
path.  Every `separates` row in the quality suite is under a thousand
nodes, which is how a result this visible went unmeasured through
114, 115 and 116.  It is logged as item 57 with its first measurement
(the count after each of the three stages, and the scale at which the
5k behaviour stops) rather than fixed here: it is the 115 machinery's
own question, and this round's change does not touch it — the same
field went into the settle before 117.1 as after.


### The record

Item 56 leaves `PLAN.md` — taken, with the measurement recorded on the
round — and item 57 joins it.  The README's force section, `MIGRATING.md`'s cose row, the
changelog and the summary say the term is opt-in and why; the option's
JSDoc carries the short form.
