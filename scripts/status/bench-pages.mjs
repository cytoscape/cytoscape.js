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
import { renderReport } from '../../benchmark/report-html.mjs';
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

function trendTable(group) {
  const rows = group.runs
    .map((run) => {
      const geo = geoSpeedup(run.results);

      return `<tr>
      <td>${esc((run.date ?? '').replace('T', ' ').slice(0, 16))}</td>
      <td><a href="/${esc(pageNameFor(run.file))}">${esc(run.profile ?? '?')}</a></td>
      <td><code>${esc(run.commit ?? '?')}</code>${run.dirty === true ? ' <span class="fail">dirty</span>' : ''}</td>
      <td>${geo != null ? `${geo.toFixed(2)}×` : '–'}</td>
      <td>${run.totalMs != null ? `${(run.totalMs / 60000).toFixed(1)} min` : '–'}</td>
      <td class="muted">${esc(run.note ?? '')}</td>
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
    <div class="table-wrap"><table>
      <thead><tr><th>run</th><th>profile</th><th>commit</th><th>geo-mean vs v3</th><th>duration</th><th>note</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </section>`;
}

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

  const html = `<h1>Benchmarks</h1>
  <p class="lede">${runs.length} published run${runs.length === 1 ? '' : 's'}. The newest is
  ${age != null ? `<strong>${esc(age)}</strong>` : 'undated'} — benchmarks do not run on this site's
  builder (no GPU, and the quick profile alone is seven minutes), so these are as fresh as the last
  <code>npm run benchmark:publish</code>.</p>
  ${byMachine(runs)
    .map((g) => trendTable(g))
    .join('')}`;

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
