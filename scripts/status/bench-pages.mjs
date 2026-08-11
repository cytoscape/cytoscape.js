// Round 46.5: the published benchmark runs, rendered.
//
// Every run in `benchmark/published/` gets its own page, rendered through the
// existing `renderReport()` — the HTML is never stored, only the results JSON,
// so an improvement to the report applies to every past run.
//
// The index carries a trend, and the trend's one rule is the reason the
// machine fingerprint exists: **runs from different boxes are never plotted on
// one line.**  A chart that mixes them looks like a performance history and is
// actually a hardware history, which is worse than no chart.
//
// Each (machine, profile) with two or more runs also gets a **cross-commit
// comparison page** (`benchmark/report-compare.mjs`): per-row p50 across runs,
// the movers beyond ±10% with the frozen v3 twin as a per-row noise control,
// and a whole-run drift figure so a warm box does not read as a regression.
import { renderReport } from '../../benchmark/report-html.mjs';
import {
  buildComparison,
  renderComparison,
  comparePageName,
} from '../../benchmark/report-compare.mjs';
import { sameEpoch } from '../../benchmark/harness-id.mjs';
import { esc, fmtAge } from '../theme.mjs';
import { write } from './plan.mjs';

/** `results-2026-08-05T17-24-45-508Z.json` -> `benchmark/2026-08-05T17-24-45-508Z.html` */
export function pageNameFor(file) {
  return `benchmark/${file.replace(/^results-?/, '').replace(/\.json$/, '') || 'run'}.html`;
}

/** The geometric mean of a run's v3-vs-v4 speedups, or null when it has none. */
export function geoSpeedup(results) {
  const speedups = [];

  for (const job of results.jobs ?? []) {
    for (const group of job.groups ?? []) {
      const v3 = (group.benches ?? []).find((b) => b.name === 'v3');
      const gpu = (group.benches ?? []).find((b) => b.name === 'gpu');

      if (v3 != null && gpu != null && gpu.stats?.p50 > 0) {
        speedups.push(v3.stats.p50 / gpu.stats.p50);
      }
    }
  }

  if (speedups.length === 0) {
    return null;
  }

  return Math.exp(
    speedups.reduce((s, x) => s + Math.log(x), 0) / speedups.length,
  );
}

/**
 * Group runs by machine, newest first within each group.
 *
 * Runs with no fingerprint (published before round 46.5) go in their own
 * "unknown machine" group rather than being merged into a real one — merging
 * them would be a guess presented as a fact.
 */
export function byMachine(runs) {
  const groups = new Map();

  for (const run of runs) {
    const key = run.fingerprint ?? 'unknown';
    const group = groups.get(key) ?? {
      fingerprint: run.fingerprint ?? null,
      machine: run.machine ?? null,
      runs: [],
    };

    group.machine = group.machine ?? run.machine ?? null;
    group.runs.push(run);
    groups.set(key, group);
  }

  return [...groups.values()];
}

/**
 * The cross-commit comparison pages for one machine: one per profile that has
 * at least two runs.  Grouped by *exact* profile, because the profiles measure
 * different suites (`renderer` vs the Node tier) — a page joining them would
 * be mostly gaps presented as history.
 *
 * Unfingerprinted runs (pre-round-46.5) get no comparison at all: nothing can
 * say whether they share hardware, and `buildComparison`'s one rule is that
 * cross-machine numbers never share a line.
 *
 * @returns `[{ profile, page, runCount, op }]`
 */
export function planComparisons(group) {
  if (group.fingerprint == null) {
    return [];
  }

  const byProfile = new Map();

  for (const run of group.runs) {
    const key = run.profile ?? 'unknown';
    const list = byProfile.get(key) ?? [];

    list.push(run);
    byProfile.set(key, list);
  }

  const plans = [];

  for (const [profile, runs] of byProfile) {
    if (runs.length < 2) {
      continue;
    }

    // the archive lists newest first; the comparison reads oldest first
    const ordered = [...runs].reverse();
    const comparison = buildComparison(ordered);
    const page = comparePageName(group.fingerprint, profile);

    plans.push({
      profile,
      page,
      runCount: runs.length,
      op: write(
        page,
        renderComparison(comparison, {
          machine: group.machine,
          fingerprint: group.fingerprint,
        }),
      ),
    });
  }

  return plans;
}

/** A run's harness hash per suite — the unit an epoch is measured in. */
function harnessesOf(run) {
  const map = new Map();

  for (const job of run.results?.jobs ?? []) {
    if (job.harness != null) {
      map.set(job.suite, job.harness);
    }
  }

  return map;
}

/**
 * Which runs were measured by a harness the previous run **of the same
 * profile** did not use?
 *
 * The geo-mean column is computed *within* a run, so it is not itself a
 * cross-run figure — but a reader compares the column down the page, and that
 * comparison is exactly as invalid across a harness change as any other (round
 * 65.12: 62.5c moved the v4 side of the core suites 12-35% with the library
 * untouched, which moves the geo-mean with it).  So the table marks where the
 * instrument changed instead of leaving the reader to infer a trend across it.
 *
 * **Per profile, and that is the whole subtlety.**  The table interleaves
 * profiles, so adjacent rows are usually a renderer run beside an all run —
 * which share no harness hash for the trivial reason that they measure
 * different suites.  Comparing those would mark almost every row and teach the
 * reader to ignore the mark, which is the failure this exists to prevent.
 *
 * @param runs — the machine's runs, newest first
 * @returns a Set of indices whose profile's previous run used a different harness
 */
export function harnessChanges(runs) {
  const marks = new Set();
  const lastOfProfile = new Map();

  // oldest first, so "the previous run of this profile" is the one already seen
  for (let i = runs.length - 1; i >= 0; i--) {
    const profile = runs[i].profile ?? '?';
    const here = harnessesOf(runs[i]);
    const before = lastOfProfile.get(profile);

    // per *suite*, not per run: a quick run measures eight suites, and one of
    // them keeping its hash says nothing about the other seven.  Asking only
    // whether the two runs share any hash at all missed round 62.5c entirely,
    // because `mappers.mjs` had not changed across it.
    const moved =
      before != null &&
      [...here].some(
        ([suite, hash]) =>
          before.has(suite) && !sameEpoch(before.get(suite), hash),
      );

    if (moved) {
      marks.add(i);
    }

    if (here.size > 0) {
      // carry forward per suite, so a --suite-filtered run does not erase the
      // hashes of the suites it skipped
      lastOfProfile.set(profile, new Map([...(before ?? []), ...here]));
    }
  }

  return marks;
}

function trendTable(group, comparisons = []) {
  const compareLinks =
    comparisons.length === 0
      ? ''
      : `<p>Across commits: ${comparisons
          .map(
            (c) =>
              `<a href="/${esc(c.page)}">${esc(c.profile)} (${c.runCount} runs)</a>`,
          )
          .join(' · ')}</p>`;
  const changed = harnessChanges(group.runs);
  const changedAny = changed.size > 0;
  const rows = group.runs
    .map((run, i) => {
      const geo = geoSpeedup(run.results);
      const repeat = run.results?.meta?.repeat ?? 1;

      return `<tr>
      <td>${esc((run.date ?? '').replace('T', ' ').slice(0, 16))}</td>
      <td><a href="/${esc(pageNameFor(run.file))}">${esc(run.profile ?? '?')}</a>${
        changed.has(i)
          ? ' <span class="epoch" title="the benchmark harness changed since this profile&#39;s previous run, so the two are different measurements rather than a before and an after">new harness</span>'
          : ''
      }</td>
      <td><code>${esc(run.commit ?? '?')}</code>${run.dirty === true ? ' <span class="fail">dirty</span>' : ''}</td>
      <td>${geo != null ? `${geo.toFixed(2)}×` : '–'}</td>
      <td>${repeat > 1 ? `median of ${repeat}` : '<span class="muted">1 run</span>'}</td>
      <td>${run.totalMs != null ? `${(run.totalMs / 60000).toFixed(1)} min` : '–'}</td>
      <td class="note-cell muted">${esc(run.note ?? '')}</td>
    </tr>`;
    })
    .join('');

  return `<section class="doc-section">
    <h2>${esc(group.machine ?? 'Machine unknown')}</h2>
    <p class="note">${
      group.fingerprint != null
        ? `Machine id <code>${esc(group.fingerprint)}</code>. Only runs sharing this id are comparable.`
        : 'These runs predate machine fingerprinting, so nothing can be said about whether they share hardware.'
    }</p>
    ${
      changedAny
        ? `<p class="note">A run marked <span class="epoch">new harness</span> was measured by a
          benchmark harness the previous run of its profile did not use, so reading the two as a
          before and an after is reading two different instruments.  The comparison pages show those
          rows as breaks rather than as changes.</p>`
        : ''
    }
    ${compareLinks}
    <div class="table-wrap"><table class="runs">
      <thead><tr><th>run</th><th>profile</th><th>commit</th><th>geo-mean vs v3</th><th>sampling</th><th>duration</th><th class="note-cell">note</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </section>`;
}

/**
 * The run table's layout, appended to the page shell's stylesheet by
 * `status-build.mjs` (the `*_CSS` convention the API and goldens pages use).
 *
 * Every column but the note holds a short fixed-shape value — a timestamp, a
 * profile name, an abbreviated sha, a ratio, a duration — and each was wrapping
 * onto a second line because the browser was free to shrink it to make room for
 * the note.  So a run whose note is one line, or absent entirely, still cost a
 * two-line row.  Pinning the short columns to `nowrap` gives them their natural
 * width and leaves the remainder to the note, which is the only cell that
 * legitimately wraps; a row is one line unless its note needs more.
 *
 * The note's `min-width` is what keeps that true on a narrow screen: without
 * it the fixed columns win the layout and the note is squeezed into a ribbon
 * (measured at a 760 px viewport: a 193 px note column, rows five lines tall —
 * worse than before the nowrap).  With it the table exceeds its container and
 * `.table-wrap` scrolls, which is what that wrapper is for.
 */
export const BENCH_CSS = `
.runs th, .runs td { white-space: nowrap; }
.runs th.note-cell, .runs td.note-cell { white-space: normal; width: 100%; min-width: 46ch; }
.runs .epoch { color: var(--warn); font-size: 11.5px; }`;

/**
 * @param runs — from `loadPublished()`, each with its `results` attached
 * @returns `{ ops, html, count }` — one op per run page, plus the index markup
 */
export function planBenchmarks({ runs, now = Date.now() }) {
  if (runs.length === 0) {
    return {
      ops: [],
      count: 0,
      available: false,
      reason:
        'benchmark/published/ is empty — run `npm run benchmark:report` then `npm run benchmark:publish`',
      html: `<h1>Benchmarks</h1>
      <p class="lede">No published runs. Benchmarks are machine-dependent and slow, so they do not run
      on the site's builder; a run reaches this page by being published deliberately:</p>
      <pre><code class="hljs">npm run benchmark:report
npm run benchmark:publish</code></pre>`,
    };
  }

  const ops = runs.map((run) =>
    write(pageNameFor(run.file), renderReport(run.results)),
  );
  const newest = runs[0];
  const age =
    newest.date != null ? fmtAge(now - Date.parse(newest.date)) : null;

  const machines = byMachine(runs).map((g) => {
    const comparisons = planComparisons(g);

    ops.push(...comparisons.map((c) => c.op));

    return trendTable(g, comparisons);
  });

  const html = `<h1>Benchmarks</h1>
  <p class="lede">${runs.length} published run${runs.length === 1 ? '' : 's'}. The newest is
  ${age != null ? `<strong>${esc(age)}</strong>` : 'undated'} — benchmarks do not run on this site's
  builder (no GPU, and the quick profile alone is seven minutes), so these are as fresh as the last
  <code>npm run benchmark:publish</code>.</p>
  ${machines.join('')}`;

  return {
    ops,
    html,
    count: runs.length,
    available: true,
    reason: null,
    newest,
    age,
  };
}
