## Renderer benchmarks

The renderer's recorded numbers (fps tables, pan ms/frame, pick latency,
init/export costs) were manual debug-harness measurements; this makes
them a repeatable command.

`npm run benchmark:renderer` (or
`benchmark:report -- --renderer` to fold into the combined report)
runs `benchmark/render-bench.mjs`: a Playwright-library driver (not a
test project — no assertions, not in CI's sweep) that serves the repo on
an ephemeral port (no stale-:3333 dependence; bundle-vs-src mtimes are
checked and warned), launches Chromium `channel: 'chromium'` with
`--enable-unsafe-webgpu`, **aborts without a real adapter** (software
adapters warn — different machine class), and drives
`render-bench.html`: one instance at a time on a shared stage, seeded
25k×50k / 100k×300k generators + stripped ndex-x-large, v3 canvas vs v4
WebGPU on identical defs and constant styles.

Scenarios: continuous-pan
steady state (fit-all / zoomed-in 20× / far-zoom ÷8, labels off/on) —
programmatic `panBy` per rAF, warm-up then sampling until window + a
minimum frame count; wall ms per *rendered* frame (v4: `stats().frames`
delta, since backpressure skips ticks; v3: the tick delta, since the
canvas draw runs inside it) as the comparison metric, with
`stats().gpuFrameMs` (timestamp-query) as `gpu (device)` rows — the
vsync-unbounded cost; hover-while-panning `pick()` latency percentiles;
one-shot init / columnar init / full-png export (≤2048 px — full-graph
exports would exceed the device texture cap).  dpr 2, 1280×800, render
scale pinned to 1.

Results emit the same mitata-shaped stats
(`render-stats.mjs`, unit-tested) so `report-html.mjs` renders renderer
sections unchanged; jobs carry a `note` (new, rendered once per section)
stating the vsync bound and pinned config.  First full run (M2, Metal,
dpr 2), fit-all pan p50 v3-vs-gpu wall: 336 ms vs 10.6 ms at 25k×50k
(device 7.8 ms; far-zoom device 2.1 ms — decimation), 2.05 s vs 15.2 ms
at 100k×300k, 1.86 s vs 32.8 ms on ndex-x-large (~30 fps native,
matching the round-recorded "25 fps before adaptive scale"); init 7.7 s
vs 457 ms at 100k; ndex pick p50 0.1 ms (the CPU fast path).
