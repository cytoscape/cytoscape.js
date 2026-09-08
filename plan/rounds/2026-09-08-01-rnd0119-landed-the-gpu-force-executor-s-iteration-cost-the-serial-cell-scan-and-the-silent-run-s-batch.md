## The GPU force executor's iteration cost: the serial cell scan, and the silent run's batch

Raised by the maintainer on 2026-09-08, the first person to sit in
front of round 118's page: the layout quality on force was good with
avoid overlap on and off, the sweep was slow as expected — and force
itself looked slower than it used to be even with avoid overlap off,
"near instant" on the EnrichmentMap network once and about two seconds
now.  The instruction was to bring the docs up to date with what had
actually been done, then find the regression.

### What the maintainer remembered, measured

Scripted Chromium on the real adapter (amd), `debug/index.html?network=em-web`
(569 nodes, 6,899 edges), the page's own Apply with the layout
section's defaults, `layoutstart` → `layoutstop`:

| tree | Animate on (the page default) | Animate off | field |
| --- | ---: | ---: | --- |
| before round 116 (`fdce7463`) | 614–633 ms | **90 ms** | 8,600 × 7,200 px |
| after 116.1 (`3e6c6d10`) | 2,125–2,180 ms | 1,462–1,530 ms | 2,225 × 1,608 |
| round 118's close | 2,006–2,048 ms | 1,466–1,481 ms | 2,225 × 1,607 |

The 90 ms run is the readback defect 116.1 fixed: every GPU run
before it stopped at nine iterations, and its field is four times too
wide — the unconverged nine-iteration output, which the settle's
re-pack then spread.  So the "near instant" the maintainer remembered
was a run that never finished, and the two seconds are the run
finishing: the CPU sim converges on this graph at about 300
iterations (headless, `iterations` capped at 30 / 100 / 200 / 300 /
1,000: 144 / 217 / 334 / 416 / 422 ms, the field settling between
200 and 300), the GPU run advanced three per rendered frame however
it was shown, and 100 frames at vsync is 1.5 s.  The page's Animate
box adds the finisher's tween on top.  Headless CPU, same graph, every
commit from before round 114 to 118's close: 372–436 ms, unchanged.
So nothing in rounds 114–118 slowed the sim; the run was paced.

### Two costs, both found by measuring

**The batch.**  A run nobody watches mid-run — `animate: false`, or
`animate: true`'s tween to the settle — has no reason to be paced by
the live stream's `stepsPerFrame`.  The renderer now asks
`nextBatch` (`render/gpu-force.mts`, pure) each frame: the batch
doubles while the device keeps up, halves the frame after the
renderer skipped a scene pass under its frames-in-flight
backpressure, and stays within `[stepsPerFrame, MAX_BATCH = 64]` (the
alpha window the encode precomputes; the encode also clamps to the
iteration cap now, where three-per-frame overshot it by two).  The
presenting stream (`animateLive`, `infinite`) keeps its watchable
rate.  Two signals were tried and dropped, each on a measurement: the
displacement readback's latency (mapAsync resolves 4–100 ms after a
trivial batch here, erratically, so the batch sat at 3–12 and em-web
ran at half the fixed-batch speed), and the frame interval against
the run's shortest (the renderer's frames are not vsync-spaced — a
scheduled frame can follow another by a millisecond — so every batch
read as behind).  The backpressure the renderer already keeps is the
device's own signal.

But the batch alone bought little — em-web 1,470 → 925–1,044 ms,
and a fixed batch of 64 was no faster (1,015 ms, six frames) than 16
(986 ms) — because the run was **GPU-bound at ~3.2 ms per iteration
on 569 nodes**, and the cost scaled with the grid, not the nodes:

| scene | nodes | grid cells | GPU ms / iteration |
| --- | ---: | ---: | ---: |
| em-web | 569 | 10,246 | 3.2 |
| gen 1k × 2k | 1,000 | 10,434 | 3.3 |
| gen 3k × 6k | 3,000 | 33,495 | 9.7 |
| gen 10k × 20k | 10,000 | 65,536 (the cap) | 19 |

**The scan.**  `scanCells` — the exclusive scan over the cell counts
that turns the counting sort into `cellStart`, run once per iteration
and once more per separation sweep — was `@workgroup_size(1)`: one
thread walking every cell through a dependent chain of atomic loads,
~0.3 µs a cell, 65,536 cells at the grid's cap.  Round 59.3's
"bounded serial scan" was a budget for the scan's *length*, and the
budget was the executor's whole iteration cost at every size below
the one where the force gather dominates.  It is now one workgroup of
256 threads: each totals a contiguous chunk of at most 256 cells, the
chunk totals are scanned in shared memory (Hillis–Steele, uniform
control flow — the cull pass's own idiom), and each thread writes its
chunk's prefixes and rewinds the counters for scatter.  The dependent
chain is 256 + 8 loads instead of 65,536.  The separation sweep
(118.2) rebuilds the grid through the same kernel, so it takes the
same win.

### What it measures now

The same page, scripted Chromium, amd, `layoutstart` → `layoutstop`,
the default iteration cap; "before" is round 118's close:

| scene, `avoidOverlap` | before | after | frames | worst frame |
| --- | ---: | ---: | ---: | ---: |
| em-web, off, silent | 1,470 ms | **268–296 ms** | 11–12 | 27–39 ms |
| em-web, off, silent, fixed batch 64 | 1,015 | 147 | 6 | — |
| em-web, off, `animate: true` (the page default) | 2,050 | 782 | 43 | — |
| em-web, `'settle'` | — | 331 | 11 | — |
| em-web, `'sim'` | 3,641 | 449 | 18 | 22 |
| em-web, `'both'` | — | 447 | 19 | — |
| em-web, off, `animateLive` (3 per frame, by design) | 1,582 | 1,523 | 91 | — |
| gen 1k × 2k, off | — | 262 | 12 | — |
| gen 3k × 6k, off | — | 336 | 13 | 32 |
| gen 10k × 20k, off | — | 793 | 22 | 85 |
| gen 25k × 50k, off (118.4's row) | 11.8 s | **3.3 s** | 70 | 197 |
| gen 25k × 50k, `'sim'` (118.4's row) | 50.3 s | 17.7 s | 124 | — |

The 25k silent run's worst frame is the batch's ramp overshooting
before the backpressure answers (two frames in flight, so the signal
lags two frames): the batch reaches 24 once, then rides 3–12 for the
run.  Recorded, not fixed — the page ran 35 ms frames throughout that
run before, and a one-off 200 ms stall against a 3.5× shorter run is
the trade this round takes; a growth rule that prices an iteration
before doubling is the follow-up if a person finds the stall.

The tween the page's Animate box adds is now most of what the page
shows on em-web (782 against 296), and that is the finisher's
duration, not the layout's.

### 119.3 — the settle threshold, relative and for the unwatched run

The maintainer, on the numbers above: still too slow, and the layout
the nine-iteration defect had produced "seemed like sufficient
quality" for most networks (the 1.5 s reported turned out to be a
cached page, and the instruction was to keep investigating).  The
observation was right and measurable.  Headless CPU, seven fixtures,
`iterations` capped, three metrics — the edge-length coefficient of
variation, a sampled stress (BFS distance from 40 sources against
geometric distance scaled by the mean edge length) and the count of
40 px bodies overlapping:

| fixture | at 9 iterations | at 100 | at the 0.1 px settle (~300) |
| --- | --- | --- | --- |
| em-web (569 × 6,899) | CV 0.50 · stress 0.193 · 750 | 0.49 · 0.198 · 723 | 0.49 · 0.203 · 709 |
| em-desktop | 0.53 · 0.211 · 3,697 | 0.52 · 0.135 · 2,058 | 0.52 · 0.154 · 1,966 |
| npm-deps | 0.45 · 0.159 · 470 | 0.37 · 0.096 · 301 | 0.37 · 0.096 · 285 |
| reactome | 0.37 · 0.126 · 282 | 0.35 · 0.104 · 120 | 0.35 · 0.106 · 117 |
| gen 1k × 2k | 0.49 · 0.416 · 5,173 | 0.44 · 0.314 · 3,226 | 0.43 · 0.308 · 3,195 |
| tree 500 | 0.42 · 0.238 · 930 | 0.36 · 0.145 · 282 | 0.36 · 0.145 · 242 |
| grid 20 × 20 | 0.14 · 0.043 · 0 | 0.13 · 0.041 · 0 | 0.13 · 0.041 · 0 |

Nine is too few on the sparse graphs (the tree and npm-deps are
still opening), but every fixture has plateaued by 100, and the
anneal's remaining two hundred ticks move nothing any metric sees:
the spectral seed places the graph.  The knob is the settle test —
0.1 px per node per tick is a tenth of a percent of the mean edge
length.  Swept to convergence:

| fixture | 0.1 px (default) | 0.5 px | 1 px | 2 px | 4 px |
| --- | ---: | ---: | ---: | ---: | ---: |
| em-web | 425 ms | 228 | 180 | 117 | 105 |
| em-desktop | 1,033 | 724 | 591 | 434 | 283 |
| npm-deps | 130 | 91 | 72 | 49 | 31 |
| gen 1k × 2k | 472 | 308 | 252 | 175 | 136 |
| tree 500 | 160 | 106 | 80 | 57 | 35 |

At 1 px every metric is within 1–2% of the 0.1 px result on every
fixture; at 2 px the overlap count on the sparse graphs rises 3–10%;
a faster anneal (`decay` 0.03) buys the same time at a small stress
cost on the random graph.  **The default is now 2% of the mean ideal
edge length** — 1.2 px at the default 60 — for a run nobody watches
(`animate` either way).  A presented run (`animateLive`, `infinite`)
keeps 0.1 px: the first version applied the relative default to
every run and the infinite drag spec went red — the ring rested
before its neighbours had visibly followed — because a stream's stop
is motion the eye sees, and a field creeping a pixel a tick is
visible motion.

Two things had to come apart from the threshold.  The **separation
sweep's quiet test**: the 'sim' spec went red with pairs left a
pixel deep, since the sweep pushes a hair past touching and its push
had been read against the settle threshold — it now has its own
`SWEEP_QUIET` (0.1 px) on both executors, a second atomic max in the
GPU's meta buffer.  And the **GPU's settle count**: traced per frame,
the em-web run was going to 460 iterations at the new threshold
where the CPU stops near 150, because the settle counted three
quiet *polls* and each poll's readback lands two to three frames
after its batch — three polls of 64-iteration batches.  A quiet poll
now credits the batch's every iteration (its max is over all of
them), which is the CPU sim's three-consecutive-ticks rule read from
one readback; a three-per-frame stream reads the same as before.

| the page, scripted Chromium, amd | 119.2 | 119.3 | frames |
| --- | ---: | ---: | ---: |
| em-web, off, silent | 268–296 ms | **145–240 ms** | 7–9 |
| em-web, off, `animate: true` | 782 | 745 (216 + the 500 ms tween) | 41 |
| em-web, `'settle'` | 331 | 297 | 9 |
| em-web, `'sim'` | 449 | 451 | 18 |
| em-web, `animateLive` (unchanged by design) | 1,523 | 1,523 | 89 |
| ndex-large (3,238 nodes), off | 585 | 379 | 11 |
| gen 3k × 6k, off | 336 | 279 | 11 |
| gen 25k × 50k, off | 3.3 s | 3.0 s | 67 |
| gen 25k × 50k, `'sim'` | 17.7 s | 16.0 s | 214 |

What is left on em-web is latency, not iterations: a frame to start,
five frames of ramp to a 64-iteration batch, two to three for the
quiet poll to land, one or two for the position readback.  The CPU
executor does the same graph in 180 ms headless — and blocks the
thread for it.  The page's readout now shows the layout and the tween
separately, so what Animate adds reads as what it is.

### The gates

119.3's gates are the ones that went red on the way: `'sim'` ends
clear at the padding (the sweep's own quiet test), the infinite drag
on the GPU pulls both neighbours after the grabbed node (the watched
run's threshold), and the 114.5 stream-versus-settle control now
settles at the stream's threshold explicitly.  `test/modules/gpu-force-batch.mjs` pins the batch rule: it doubles
from `stepsPerFrame` to the cap, halves when behind and never under
the floor, clamps a floor past the window — red with the rule
returning its input.  The browser spec (`renderer.spec.js`, 119) runs
a 60-node graph to a 240-iteration cap with `threshold: 0` silently
and live: the stream takes over 60 frames (three per frame) and the
silent run under 40 — 82 against 82 with the rule stubbed.  The scan's
correctness is gated by what already read the grid: the three
executors' invariants spec, the 30-clique landing clear under `'sim'`
on the GPU, the infinite run's drag, and the seeded-clear ring's
byte-identity — all green on the parallel scan, on the real adapter.

### The docs, brought up to date on the way

The 118 record and the summary said a person had still not sat in
front of the page; the maintainer did on 2026-09-08, and this round
is what they found.  The README's force section had carried "silent
GPU ~346 ms vs the old sync CPU settle ~25.3 s (~73×)" at 25k since
87.2 — a nine-iteration figure, as every browser force number before
116.1 was — and now says so with the converged number beside it.  And
round 112's record was still filed as a `plan` while the README, the
summary and three landed commits described the flow layout as built:
re-filed as landed, with 112.5's levers held as its file already said.
