// Round 65.12: fold N repeats of one job into the row-wise median.
//
// Pure and separate from `report.mjs` so the merge is testable without running
// a benchmark, which matters more than usual here: this function decides what
// every published number *is*, and its one interesting property is easy to get
// wrong.
//
// That property: a merged row carries **one repeat's whole stats object**, the
// one whose p50 is the median, rather than a per-key median across repeats.
// Mixing p50 from one process with p99 from another produces a stats block no
// process ever measured — a distribution assembled from parts, where p99 can
// land below p50 and the tooltip contradicts the row.  Taking the median
// repeat whole keeps every percentile internally consistent and keeps the
// number attributable: it was measured, in one process, exactly as printed.
//
// Beside it the merge records what the repeats saw — `repeats` and
// `repeatSpread` (max p50 / min p50) — which is the per-row noise measurement
// the comparison screens against.

/**
 * The index of the median element of `values` — the **high** side when the
 * count is even.
 *
 * Which side matters, and it is a judgement rather than a detail: an even
 * split means the repeats disagreed with no majority, and publishing the
 * faster of the two would flatter the library on exactly the runs where the
 * evidence is weakest.  The same reasoning rules best-of out entirely (round
 * 65.11 measured min-of-3 flagging 11% of identical-code comparisons, as bad
 * as no aggregation at all, because it takes the fast mode whenever it
 * appears).  Prefer the slower middle value; an odd count, which is what
 * `--repeat 3` gives, never reaches this.
 */
function medianIndex(values) {
  const order = values
    .map((v, i) => [v, i])
    .sort((a, b) => a[0] - b[0])
    .map(([, i]) => i);

  return order[order.length >> 1];
}

/**
 * Merge repeats of one job's results into a single job.
 *
 * Rows are keyed by (group, bench).  A row missing from some repeats is merged
 * from the repeats that have it, and its `repeats` count says so — a suite
 * whose rows are conditional on the fixture (several are) must not lose them,
 * and must not claim more evidence than it has.
 *
 * @param runs — the per-repeat job objects, in run order; all from one job
 * @returns one job object, or null when `runs` is empty
 */
export function mergeRepeats(runs) {
  const present = runs.filter((r) => r != null);

  if (present.length === 0) {
    return null;
  }
  if (present.length === 1) {
    return present[0];
  }

  // the first repeat sets the shape: group order, bench order, and every
  // non-row field (suite, n, op, context)
  const merged = {
    ...present[0],
    groups: present[0].groups.map((g) => ({ ...g, benches: [] })),
  };

  const statsFor = (groupName, benchName) =>
    present
      .map(
        (r) =>
          r.groups
            ?.find((g) => g.name === groupName)
            ?.benches?.find((b) => b.name === benchName)?.stats,
      )
      .filter((s) => s != null && s.p50 > 0);

  for (const [gi, group] of present[0].groups.entries()) {
    for (const bench of group.benches) {
      const all = statsFor(group.name, bench.name);

      if (all.length === 0) {
        merged.groups[gi].benches.push(bench);
        continue;
      }

      const p50s = all.map((s) => s.p50);
      const chosen = all[medianIndex(p50s)];

      merged.groups[gi].benches.push({
        name: bench.name,
        stats: {
          ...chosen,
          repeats: all.length,
          repeatSpread: Math.max(...p50s) / Math.min(...p50s),
        },
      });
    }
  }

  merged.durationMs = present.reduce((sum, r) => sum + (r.durationMs ?? 0), 0);

  return merged;
}
