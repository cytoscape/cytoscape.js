# Published benchmark runs

This directory is **tracked**, unlike `benchmark/results/`. It holds the runs
the status site publishes.

## Why it exists

The status site (`npm run status`) is built by Cloudflare Pages from a git
checkout. No benchmark can run there — there is no GPU, and the quick profile
alone is about seven minutes. So a run reaches the site only by being promoted
here deliberately, on the machine that measured it:

```
npm run benchmark:report -- --repeat 3     # or benchmark:all / benchmark:renderer
npm run benchmark:publish -- --note "round 46.5 baseline"
```

Then commit `benchmark/published/`.

**Use `--repeat 3`.** Round 65.11 measured this harness's run-to-run spread
and found it larger than the ±10% the comparison page flags at: over eight
identical-code runs of `index.mjs`, 14 of 35 v4 rows moved more than 10% and 8
moved more than 20%. Comparing single runs turns that into a change table
that is 11% noise; comparing medians of three flags **none** of 105
identical-code row pairs. Two repeats does not do it — these rows are
bimodal, so a 2-run aggregate lands between the modes or picks one — and
best-of is worse than median, because it takes the fast mode whenever it
appears. A `--repeat` run also records each row's own band (`repeatSpread`),
which is what the comparison screens a change against.

## What is in here

- `index.json` — one entry per run: date, commit, profile, machine summary,
  the WebGPU adapter where there was one, and the **machine fingerprint**.
- `results-*.json` — the run itself, exactly as `benchmark/results/` produced
  it. The site re-renders these through `benchmark/report-html.mjs` rather
  than storing HTML, so a report improvement applies to every past run.

## Reading a trend

Runs are grouped by `fingerprint` — a hash of CPU model, core counts, RAM,
architecture and the GPU list. **Two runs with different fingerprints are not
comparable**, and the site will not plot them on one line. The fingerprint
deliberately ignores kernel and node version, so an OS upgrade does not split
a machine's history in two.

For every (machine, profile) with at least two runs, the site also renders a
**cross-commit comparison page** (`benchmark/report-compare.mjs`): each row's
p50 across runs, the movers beyond ±10% with the frozen twin's change as a
per-row noise control, and a whole-run drift figure (the geometric mean change
over every shared row). Read the drift before the movers — a row moving near
the drift factor is the box, not the commit — and read a mover's control the
same way: v3 (and, in the executor sweep, the cpu side) is frozen code, so if
it moved too, the machine did.

## The harness fingerprint (round 65.12)

Every job also carries a hash of the **harness** that produced it — the suite
file, the `./`-relative modules it imports, and the shared inputs
(`graph.mjs`, `bench-size.mjs`, `bench-run.mjs`, `render-stats.mjs`).  Not
`src/`: that is the subject of the measurement.

The comparison refuses to show a change across a harness change, for the same
reason it refuses one across machines. Round 65.11 measured the cost of not
doing so: round 62.5c's inline-cache pre-warm moved the v4 side of the core
suites 12–35% with the library untouched, and every page since had rendered
that step as a regression. A cross-epoch cell reads `⋮ harness` instead.

The hash ignores comments and formatting — round 57.2 reformatted every
benchmark file in one commit and moved no number, and a break nobody believes
is worse than no break at all. A change that really is cosmetic but survives
normalisation can be declared in `EQUIVALENT_HARNESSES`
(`benchmark/harness-id.mjs`) with a reason; the list is audited, so an entry
naming a hash the archive no longer carries fails the build.

Runs published before 65.12 were stamped retroactively from git:

```
node scripts/benchmark-backfill-harness.mjs [--dry-run]
```

## Retention

Every run is kept until someone removes it. There is no automatic cap, because
silently dropping a measurement is the kind of invisible truncation this
repo's benchmark rules exist to prevent.

To thin the archive:

```
npm run benchmark:publish -- --prune 5 --dry-run   # see what would go
npm run benchmark:publish -- --prune 5
```

`--prune n` keeps the newest *n* runs per (machine, profile) and prints every
file it removes.

## A run from a dirty tree

`benchmark:publish` refuses one, because its numbers are not attributable to
the commit it names. Re-run on a clean tree, or publish it on purpose with
`--allow-dirty` — the report renders the dirty flag in the failure colour
either way.
