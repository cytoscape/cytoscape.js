// Round 46.5: the one place a results file's `meta` block is built.
//
// It had been built twice — `report.mjs` and `render-bench.mjs` each carried
// the same twelve-field literal, and `render-bench.mjs` writes its own
// `report.html` from it.  Two copies of a schema is two places to forget, and
// the round that adds machine provenance is exactly the round that would have
// landed it in one of them.
//
// `meta.cpu`, `meta.arch` and `meta.runtime` keep their existing meaning and
// spelling: they are mitata's (or render-bench's) own strings, and
// `test/modules/benchmark-report.mjs` pins them.  `meta.machine` is the
// structured superset beside them, not a replacement — every results file
// written before this round still renders, which matters because the status
// site re-renders every published run it finds.
import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describeMachine } from '../scripts/machine-info.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));

/** git, or `null` for any failure — a benchmark outside a checkout still runs. */
export function git(...args) {
  const r = spawnSync('git', args, { cwd: DIR, encoding: 'utf8' });

  return r.status === 0 ? r.stdout.trim() : null;
}

/**
 * Build a results file's `meta` block.
 *
 * @param startedAt — `Date.now()` at the start of the run
 * @param profile — 'quick' | 'all' | 'full' | 'renderer'
 * @param suiteFilter — the `--suite`/`--scene` filter in force, or null
 * @param failures — the failed-job list, carried into the report
 * @param context — the first job's context (mitata's arch/runtime/cpu strings)
 * @param adapter — the WebGPU adapter actually used, for a browser run
 * @param machine — override the probe (testing); defaults to a real probe
 */
export function buildMeta({
  startedAt,
  profile,
  suiteFilter = null,
  failures = [],
  context = {},
  adapter = null,
  machine = describeMachine(),
}) {
  const dirty = git('status', '--porcelain');

  return {
    date: new Date(startedAt).toISOString(),
    commit: git('rev-parse', '--short', 'HEAD'),
    branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
    nodeVersion: process.version,
    cpu: context.cpu ?? null,
    arch: context.arch ?? null,
    runtime: context.runtime ?? null,
    profile,
    suiteFilter,
    totalMs: Date.now() - startedAt,
    failures,

    // -- round 46.5 --
    commitDate: git('log', '-1', '--format=%aI'),
    commitSubject: git('log', '-1', '--format=%s'),
    // a measurement from a dirty tree is not attributable to its sha, and a
    // report that does not say so invites exactly that attribution
    dirty: dirty == null ? null : dirty !== '',
    machine,
    adapter,
  };
}
