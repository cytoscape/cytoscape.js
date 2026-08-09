# Published benchmark runs

This directory is **tracked**, unlike `benchmark/results/`. It holds the runs
the status site publishes.

## Why it exists

The status site (`npm run status`) is built by Cloudflare Pages from a git
checkout. No benchmark can run there — there is no GPU, and the quick profile
alone is about seven minutes. So a run reaches the site only by being promoted
here deliberately, on the machine that measured it:

```
npm run benchmark:report            # or benchmark:all / benchmark:renderer
npm run benchmark:publish -- --note "round 46.5 baseline"
```

Then commit `benchmark/published/`.

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
p50 across runs, the movers beyond ±10% with the frozen-v3 twin's change as a
per-row noise control, and a whole-run drift figure (the geometric mean change
over every shared row). Read the drift before the movers — a row moving near
the drift factor is the box, not the commit — and read a mover's v3 control
the same way: v3 is frozen code, so if it moved too, the machine did.

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
