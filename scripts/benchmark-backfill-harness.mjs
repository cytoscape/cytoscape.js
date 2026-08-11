// Round 65.12: stamp the harness fingerprint onto runs published before it existed.
//
//   node scripts/benchmark-backfill-harness.mjs [--dry-run]
//
// A run records its commit, and the harness that produced it is that commit's
// `benchmark/` tree — so the hash is recoverable from git rather than lost.
// Doing it matters more than it sounds: an un-backfilled run has a null hash,
// `sameEpoch` treats null as "not equivalent to anything" (deliberately —
// unknown is not the same as unchanged), and every comparison against it would
// render as one long harness break.  Backfilling turns that into the truth,
// which is that there is exactly one real break in the archive so far: round
// 62.5c's inline-cache pre-warm.
//
// The script is idempotent and refuses to guess: a job whose suite maps to no
// file, or whose commit is not in the checkout, keeps its null and is reported.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { harnessHash, suiteFileOf } from '../benchmark/harness-id.mjs';
import { readIndex, PUBLISHED_DIR } from './benchmark-publish.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * A reader that resolves repo-relative paths at one commit.
 *
 * @param commit — a sha or ref
 * @returns `(path) => string | null`, memoised per path
 */
export function gitReaderAt(commit) {
  const cache = new Map();

  return (path) => {
    if (cache.has(path)) {
      return cache.get(path);
    }

    const r = spawnSync('git', ['show', `${commit}:${path}`], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    const text = r.status === 0 ? r.stdout : null;

    cache.set(path, text);

    return text;
  };
}

/**
 * Stamp `job.harness` on every job of one results object.
 *
 * @param results — a parsed results file
 * @param read — a reader for the run's commit
 * @returns `{ stamped, unresolved }` — counts, and the suites that stayed null
 */
export function backfillResults(results, read) {
  const hashes = new Map();
  let stamped = 0;
  const unresolved = new Set();

  for (const job of results.jobs ?? []) {
    const file = suiteFileOf(job.suite);

    if (file == null) {
      unresolved.add(job.suite);
      job.harness = job.harness ?? null;
      continue;
    }

    if (!hashes.has(file)) {
      hashes.set(file, harnessHash(file, read));
    }

    const hash = hashes.get(file);

    if (hash == null) {
      unresolved.add(job.suite);
    } else {
      stamped++;
    }

    job.harness = hash;
  }

  return { stamped, unresolved: [...unresolved] };
}

function main(argv) {
  const dryRun = argv.includes('--dry-run');
  const { runs } = readIndex();

  if (runs.length === 0) {
    console.error('no published runs');
    process.exit(1);
  }

  const seen = new Map();

  for (const run of runs) {
    const path = join(PUBLISHED_DIR, run.file);
    let results;

    try {
      results = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      console.error(`  skip ${run.file} (unreadable)`);
      continue;
    }

    const commit = results.meta?.commit ?? run.commit;

    if (commit == null) {
      console.error(`  skip ${run.file} (no commit recorded)`);
      continue;
    }

    const { stamped, unresolved } = backfillResults(
      results,
      gitReaderAt(commit),
    );
    const distinct = new Set(
      (results.jobs ?? []).map((j) => j.harness).filter((h) => h != null),
    );

    for (const h of distinct) {
      seen.set(h, (seen.get(h) ?? 0) + 1);
    }

    console.log(
      `  ${run.file}  ${commit}  ${stamped}/${(results.jobs ?? []).length} jobs stamped` +
        (unresolved.length > 0
          ? `  (unresolved: ${unresolved.join(', ')})`
          : ''),
    );

    if (!dryRun) {
      writeFileSync(path, `${JSON.stringify(results, null, 2)}\n`);
    }
  }

  console.log(
    `\n${seen.size} distinct harness hash(es) across the archive` +
      (dryRun ? ' — --dry-run, nothing written' : ''),
  );
}

if (import.meta.filename === process.argv[1]) {
  main(process.argv.slice(2));
}
