## Landed (hardware validation pass — AMD RX 580, 2026-08-01)

The first full benchmark run of the prototype on real hardware:
Radeon RX 580 (RADV, `amd gcn-4`) on an i9-9900K under Linux,
headless Chromium with the repo's platform-gated ANGLE-on-Vulkan
flags.  Corrections first:

- **The 18.5 "software adapter on this box" note was wrong** —
  headless Chromium offers the hardware adapter with the same flags
  `playwright.config.js` uses.  The trap that produced the earlier
  conclusion: `requestAdapter()` returns null on `about:blank`, so a
  bare-page probe reads as "no GPU"; the benchmark's own probe runs
  on its served page and gets the real adapter.
- **The `--layout` mode was intractable as landed** (it had only
  ever been smoke-tested): cose's per-iteration cost is superlinear
  — ~4.5 s/iteration at 25k × 50k, ~52 min for a *single* iteration
  at 100k × 300k — so the `numIter: 300` baseline hung the suite
  for hours.  Fixed in `b7ea7068` with nested test-style timeouts
  (in-page 30 s polite stop reporting a measured floor + 60 s
  runner-side hard bail that force-closes the wedged page and
  reports "> 60 s"; `--layout-uncapped` removes both).

  Two
  starvation findings recorded in that commit: `setTimeout` runs
  minutes late under cose's synchronous iteration blocks, and even
  a rAF watchdog only runs at paint time (first paint 70 s after
  `run()` at 25k with `refresh: 1`), so the hard bail is the only
  reliable bound.

Numbers (dpr 2, 1280×800, adaptive render scale pinned to 1; wall
times are vsync-bound at 60 Hz, so 16.7 ms is the floor):

- **Pan steady state**: v4 holds the vsync floor on every generated
  scene and view — 25k and 100k flat, curved (bezier pairs),
  compound (1k parents), images, labels on and off — while v3
  canvas runs ~230–4200 ms/frame on the same content (25k fit-all
  633 ms → 16.7 ms; 100k fit-all 3693 ms → 16.7 ms).  ndex-x-large
  (465k edges) is the one scene above the floor: 33.4 ms wall
  (2 vsync frames).
- **Device time** (timestamp-query, the unbounded metric): the
  worst generated-scene pass is 19.6 ms (100k zoomed-in, labels);
  ndex fit-all ~37 ms is the only GPU-bound case — with the
  adaptive render scale deliberately pinned off, which production
  defaults would not do.  Labels add +0.2–1 ms per pass; the
  compound scene's parent stream costs ~nothing (2.0 ms fit-all).
- **Init**: v4 246 ms–1.7 s vs v3 2.6–19.2 s per scene (10–20×).
- **Picks under continuous pan**: p50 17–19 ms; 4–5 of 25 requests
  return null.  ~~Flagged for a look~~ — resolved by the pick-ring
  look below: the nulls were **background answers**, not staging-ring
  drops (the scenario holds at most one pick in flight, so the 3-slot
  ring cannot exhaust — the attribution here was wrong), and the
  drop-on-exhaustion policy itself is gone (a full ring now defers
  the request a frame instead).
- **Live layout (`--layout`)**: v4 `force` converges in 697 ms
  (25k), 1472 ms (100k) and 952 ms (ndex) on the GPU executor;
  the compound scene settles in 15.5 s on the CPU executor (the
  14.11 lease rule).  v3 cose reports "> 60 s — bailed" on every
  scene; measured floors from the pre-fix runs: 67 s at 25k,
  3169 s at 100k.
