// Round 46.5: promote a local benchmark run into the tracked archive.
//
// `benchmark/results/` is gitignored and machine-local, which is right — a run
// is an artifact of the box that produced it.  But the status site is built by
// Cloudflare from a git checkout, where no benchmark can run: no GPU, and the
// quick profile alone is seven minutes.  So publishing is an explicit act by
// the maintainer, and `benchmark/published/` is tracked.
//
// The archive keeps a history rather than a single latest, so the site can show
// a trend.  The retention rule is `--prune <n>` (newest n per machine and
// profile) rather than an automatic cap, because silently dropping a run is
// exactly the kind of invisible truncation this repo's benchmark notes warn
// about.
//
//   node scripts/benchmark-publish.mjs [<results.json>] [options]
//
//     --note <text>     a sentence on what this run is for
//     --prune <n>       after publishing, keep only the newest n runs per
//                       (machine, profile); prints every file it removes
//     --allow-dirty     publish a run measured on a dirty tree
//     --allow-concurrent  publish a run measured with --jobs N (round 68;
//                       every row of it will read as a harness break)
//     --dry-run         print what would happen, write nothing
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
  copyFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, join, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { machineLine } from './machine-info.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, '..');
const RESULTS_DIR = join(ROOT, 'benchmark', 'results');

export const PUBLISHED_DIR = join(ROOT, 'benchmark', 'published');
export const INDEX_FILE = 'index.json';

/** The newest `results-*.json` a local run left behind, or null. */
export function newestResults(dir = RESULTS_DIR) {
  if (!existsSync(dir)) {
    return null;
  }

  const files = readdirSync(dir)
    .filter((f) => f.startsWith('results') && f.endsWith('.json'))
    .map((f) => ({ f, mtime: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  return files.length > 0 ? join(dir, files[0].f) : null;
}

/** The archive index, or an empty one. */
export function readIndex(dir = PUBLISHED_DIR) {
  const path = join(dir, INDEX_FILE);

  if (!existsSync(path)) {
    return { runs: [] };
  }

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));

    return { runs: Array.isArray(parsed.runs) ? parsed.runs : [] };
  } catch {
    return { runs: [] };
  }
}

/**
 * The index entry for a results file — everything the site needs to list and
 * group a run without opening the results JSON itself.
 */
export function summarize(results, { file, note = null }) {
  const meta = results.meta ?? {};

  return {
    file,
    date: meta.date ?? null,
    commit: meta.commit ?? null,
    commitSubject: meta.commitSubject ?? null,
    branch: meta.branch ?? null,
    profile: meta.profile ?? null,
    suiteFilter: meta.suiteFilter ?? null,
    dirty: meta.dirty ?? null,
    // round 68: a concurrent run reaches the archive only past an explicit
    // --allow-concurrent, and when one does, the index says so rather than
    // leaving the reader to open the results file
    concurrency: meta.concurrency ?? null,
    totalMs: meta.totalMs ?? null,
    // round 113.1: the engine the run measured under.  The fingerprint
    // ignores it by design, so the index carries it where a reader can see
    // a trend's step coincide with a Node upgrade
    node: meta.nodeVersion ?? null,
    // the grouping key for a trend: runs from different boxes are not
    // comparable, and a chart that mixes them is worse than no chart
    fingerprint: meta.machine?.fingerprint ?? null,
    machine: machineLine(meta.machine ?? null) || null,
    adapter:
      meta.adapter != null
        ? [
            meta.adapter.vendor,
            meta.adapter.architecture || meta.adapter.description,
          ]
            .filter((v) => v != null && v !== '')
            .join(' ') || null
        : null,
    jobs: (results.jobs ?? []).length,
    note,
  };
}

/**
 * Newest-first, and the archive's canonical order.  Runs with no date sort
 * last rather than being dropped.
 */
export function sortRuns(runs) {
  return [...runs].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

/**
 * Keep the newest `n` runs per (fingerprint, profile).
 *
 * @returns `{ keep, drop }` — the caller does the deleting and prints it, so a
 *   `--dry-run` and a real run share this function exactly.
 */
export function pruneRuns(runs, n) {
  const seen = new Map();
  const keep = [];
  const drop = [];

  for (const run of sortRuns(runs)) {
    const key = `${run.fingerprint ?? '?'}|${run.profile ?? '?'}`;
    const count = seen.get(key) ?? 0;

    if (count < n) {
      seen.set(key, count + 1);
      keep.push(run);
    } else {
      drop.push(run);
    }
  }

  return { keep, drop };
}

/** Load the archive with each run's results, for the status site. */
export function loadPublished(dir = PUBLISHED_DIR) {
  const { runs } = readIndex(dir);

  return sortRuns(runs)
    .map((run) => {
      // one catch covers all three ways an entry can be unusable — the file is
      // gone, it is unreadable, it is corrupt — and the archive is
      // hand-editable and lives in git, so all three are reachable.  An
      // `existsSync` guard above this was redundant with it, which is what the
      // control for the spec below demonstrated.
      try {
        return {
          ...run,
          results: JSON.parse(readFileSync(join(dir, run.file), 'utf8')),
        };
      } catch {
        return null;
      }
    })
    .filter((r) => r != null);
}

// -- CLI --

/** Value-taking flags, so a scan knows which arg is a value and which is free. */
const VALUE_FLAGS = new Set(['--note', '--prune']);

/**
 * A single left-to-right scan, so a positional argument that happens to repeat
 * a flag's value is still read as positional.
 */
export function parseArgs(argv) {
  const flags = {};
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (VALUE_FLAGS.has(arg)) {
      flags[arg] = argv[++i] ?? null;
    } else if (arg.startsWith('--')) {
      flags[arg] = true;
    } else {
      positional.push(arg);
    }
  }

  return { flags, positional };
}

function main(argv) {
  const { flags, positional } = parseArgs(argv);
  const dryRun = flags['--dry-run'] === true;
  const allowDirty = flags['--allow-dirty'] === true;
  const allowConcurrent = flags['--allow-concurrent'] === true;
  const note = typeof flags['--note'] === 'string' ? flags['--note'] : null;
  const pruneTo = flags['--prune'] != null ? Number(flags['--prune']) : null;

  const source =
    positional.length > 0 ? resolve(positional[0]) : newestResults();

  if (source == null || !existsSync(source) || !statSync(source).isFile()) {
    console.error(
      source == null
        ? 'no results file to publish.  Run `npm run benchmark:report` first,'
        : `not a results file: ${source}`,
    );
    console.error(
      'pass a path explicitly: node scripts/benchmark-publish.mjs <results.json>',
    );
    process.exit(1);
  }

  const results = JSON.parse(readFileSync(source, 'utf8'));

  if (results.meta?.dirty === true && !allowDirty) {
    console.error(
      `refusing to publish: ${basename(source)} was measured on a dirty tree,`,
    );
    console.error(
      'so its numbers are not attributable to its commit.  Re-run on a clean',
    );
    console.error('tree, or publish it deliberately with --allow-dirty.');
    process.exit(1);
  }

  // Round 68: `--jobs N` measures every row against N-1 neighbours, and the
  // whole archive is serial.  Its harness hash already stops the comparison
  // drawing a line across the difference — so a published concurrent run does
  // not corrupt anything, it *loses* things: every row of it reads as an epoch
  // break, and the page shows no changes at all.  Hence a guard shaped like
  // the dirty-tree one above rather than a silent accept.
  if (results.meta?.concurrency > 1 && !allowConcurrent) {
    console.error(
      `refusing to publish: ${basename(source)} was measured with` +
        ` --jobs ${results.meta.concurrency},`,
    );
    console.error(
      'so its rows carry a different harness epoch than the serial archive and',
    );
    console.error(
      'every one of them would render as a break.  Re-run without --jobs, or',
    );
    console.error('publish it deliberately with --allow-concurrent.');
    process.exit(1);
  }

  const file = basename(source);
  const entry = summarize(results, { file, note });
  const index = readIndex();
  const previous = sortRuns(index.runs).find(
    (r) =>
      r.file !== file &&
      r.fingerprint === entry.fingerprint &&
      r.profile === entry.profile,
  );

  if (previous?.node != null && previous.node !== entry.node) {
    console.warn(
      `  warning: this run is Node ${entry.node}; the previous ${entry.profile}` +
        ` run on this machine was Node ${previous.node}.  The fingerprint` +
        ' ignores the engine by design, so the comparison page will read any' +
        ' V8 change as a library change — note it in --note.',
    );
  }

  const runs = sortRuns([...index.runs.filter((r) => r.file !== file), entry]);

  const { keep, drop } =
    pruneTo != null && pruneTo > 0
      ? pruneRuns(runs, pruneTo)
      : { keep: runs, drop: [] };

  console.log(`publishing ${file}`);
  console.log(
    `  ${entry.profile} profile · ${entry.jobs} job(s) · ${entry.commit ?? '?'} (${entry.branch ?? '?'})`,
  );
  console.log(`  ${entry.machine ?? 'machine unknown'}`);

  if (entry.adapter != null) {
    console.log(`  adapter ${entry.adapter}`);
  }

  for (const r of drop) {
    console.log(`  prune ${r.file} (${r.profile}, ${r.date})`);
  }

  if (dryRun) {
    console.log(
      `\n--dry-run: nothing written (${keep.length} run(s) would remain)`,
    );

    return;
  }

  mkdirSync(PUBLISHED_DIR, { recursive: true });
  copyFileSync(source, join(PUBLISHED_DIR, file));

  for (const r of drop) {
    rmSync(join(PUBLISHED_DIR, r.file), { force: true });
  }

  writeFileSync(
    join(PUBLISHED_DIR, INDEX_FILE),
    `${JSON.stringify({ runs: keep }, null, 2)}\n`,
  );

  console.log(
    `\n${keep.length} run(s) in benchmark/published/ — commit them to publish.`,
  );
}

if (import.meta.filename === process.argv[1]) {
  main(process.argv.slice(2));
}
