## The benchmark HTML report

`npm run benchmark:report` runs the Mitata suites and renders one
self-contained HTML page (plus a timestamped results JSON) into the
gitignored `benchmark/results/`.

Pieces: `bench-run.mjs` — a shared
`finishRun()` tail that, under `BENCH_JSON`, runs quietly and captures
per-group/per-bench stats (mitata's `run()` returns them; sample arrays
stripped) with terminal behaviour otherwise unchanged; `report.mjs` — the
job-table orchestrator (quick profile at default scales; `--full` adds
the 2k/20k/200k matrix with one process per group at 200k via `BENCH_OP`,
per the suite headers; failures logged and reported, partial reports
still render; `--suite` filter, `--render-only` re-render); and
`report-html.mjs` — a pure results→HTML renderer (Node-tested in
`test/modules/benchmark-report.mjs`): times as dumbbell dots on log₁₀
axes (position, not bar length — length encodes nothing on a log axis),
a ranked speedup overview against a 1× reference line, geo-mean/best-win
stat tiles, per-suite table views, a cross-N scaling table on full runs,
light+dark styling, hover/focus tooltips, no external assets.

Decisions:
quick-by-default (full is opt-in), local gitignored artifact, Mitata
suites only — the browser-side numbers stayed manual at this point
(since superseded: the renderer benchmarks above made them a command,
folded in via `--renderer`).
