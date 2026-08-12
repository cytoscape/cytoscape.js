// Round 65.12: the harness fingerprint — the machine fingerprint's twin.
//
// `buildComparison` has refused to compare runs from different machines since
// round 46.5, on the grounds that such a line "looks like a performance history
// and is actually a hardware history".  Methodology is the same variable one
// step over, and round 65.11 measured what it costs to ignore it: the round-62.5c
// pre-warm moved v4 rows 12-35% with the library untouched, and every page since
// has rendered that step as a regression.
//
// So a run stamps, per job, a hash of the harness that produced it: the suite
// file plus the shared modules every suite's numbers depend on.  **Not `src/`** —
// that is the subject of the measurement, and a change there is the thing we are
// trying to see.  Nobody has to remember to declare an epoch; editing a bench
// file starts one.
//
// The failure mode this inverts is the one prose cannot fix.  A note saying "the
// harness changed" is written once, by the person who already knows, and read by
// nobody.  A hash mismatch is checked on every render, forever, by code.
//
// The escape hatch is deliberately shaped like `scripts/throw-coverage.mjs`'s
// exemption lists: a cosmetic edit (round 57.2 reformatted the whole tree, which
// would have broken every epoch for no measurement reason) can be declared
// non-substantive in EQUIVALENT_HARNESSES, keyed by the hash pair and carrying a
// reason — and `auditEquivalences` fails the build when an entry no longer names
// a hash in use, so the list cannot rot into a silent blanket permission.

import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, '..');

/**
 * Modules whose contents change what *every* suite measures: the fixture
 * builders (`graph.mjs`), the run size (`bench-size.mjs`), the sampling and
 * JSON tail (`bench-run.mjs`), and the one-shot/array stat shapers
 * (`render-stats.mjs`).  A change to any of them invalidates comparison across
 * it for all suites, which is why they are folded into every hash rather than
 * tracked per suite.
 */
export const SHARED_HARNESS = [
  'benchmark/bench-run.mjs',
  'benchmark/bench-size.mjs',
  'benchmark/graph.mjs',
  'benchmark/render-stats.mjs',
];

/**
 * Extra inputs for suites whose harness is not one file.  The renderer bench
 * drives a page, and that page *is* the measurement — `panScenario` and
 * `pickScenario` live in it.
 */
const EXTRA_INPUTS = {
  'render-bench.mjs': ['benchmark/render-bench.html'],
};

/**
 * Modules a suite imports that render or describe a run rather than measure it.
 * `render-bench.mjs` and `algorithms-gpu-bench.mjs` write their own report and
 * `meta` block, so without this a change to the report's HTML would break every
 * renderer epoch for no measurement reason — a false break is as damaging as a
 * missed one, because it teaches the reader to ignore breaks.
 */
const NOT_INSTRUMENT = new Set([
  'benchmark/report.mjs',
  'benchmark/report-html.mjs',
  'benchmark/report-compare.mjs',
  'benchmark/run-meta.mjs',
  'benchmark/harness-id.mjs',
]);

/**
 * Suite display name -> the benchmark file that produced it.
 *
 * The display name is chosen by each suite's own `finishRun()` call and is not
 * derivable from the file name (`index.mjs` reports as `core+collection`), so
 * this map is scanned from the sources rather than written down twice — see
 * `scanSuiteFiles`.  The two dynamic families are matched by prefix.
 */
const DYNAMIC_SUITES = [
  { prefix: 'render — ', file: 'render-bench.mjs' },
  { prefix: 'algorithms-gpu', file: 'algorithms-gpu-bench.mjs' },
];

/**
 * Read every `finishRun( 'name' )` / `finishManualRun( 'name'` in the benchmark
 * directory and return the name -> file map.
 *
 * Scanned rather than hand-listed for the reason round 57.2 made expensive: a
 * hand-written table of things the sources also say is a table that goes stale
 * silently.  The scan is over a joined signature, so a wrapped call still
 * matches.
 *
 * @param dir — the benchmark directory (testing)
 * @returns `Map<suiteName, file>`
 */
export function scanSuiteFiles(dir = DIR) {
  const map = new Map();
  const files = [
    'index.mjs',
    'core.mjs',
    'collection.mjs',
    'materializers.mjs',
    'mutators.mjs',
    'scenarios.mjs',
    'traversal.mjs',
    'algorithms.mjs',
    'mappers.mjs',
    'layouts.mjs',
    'style.mjs',
    'style-bundle.mjs',
    'load.mjs',
    'spatial.mjs',
    'data.mjs',
    'events.mjs',
    'store.mjs',
    'surface.mjs',
    'compaction.mjs',
    'compound.mjs',
    'curves.mjs',
    'arrows.mjs',
    'labels.mjs',
    'transitions.mjs',
    'geometry-tween.mjs',
  ];

  for (const file of files) {
    const path = join(dir, file);

    if (!existsSync(path)) {
      continue;
    }

    const src = readFileSync(path, 'utf8').replace(/\s+/g, ' ');

    for (const m of src.matchAll(/finish(?:Manual)?Run\(\s*'([^']+)'/g)) {
      map.set(m[1], file);
    }
  }

  return map;
}

let suiteFileCache = null;

/**
 * The benchmark file a job's `suite` name came from, or null when nothing
 * claims it.
 *
 * @param suite — a job's `suite` string
 * @param dir — the benchmark directory (testing)
 * @returns the file name, or null
 */
export function suiteFileOf(suite, dir = DIR) {
  for (const { prefix, file } of DYNAMIC_SUITES) {
    if (String(suite).startsWith(prefix)) {
      return file;
    }
  }

  if (dir === DIR) {
    suiteFileCache = suiteFileCache ?? scanSuiteFiles(dir);

    return suiteFileCache.get(suite) ?? null;
  }

  return scanSuiteFiles(dir).get(suite) ?? null;
}

/**
 * The form a harness input is hashed in: comments stripped, whitespace
 * collapsed.
 *
 * Without this the *first* thing the fingerprint would have flagged is round
 * 57.2 — `oxfmt` reformatted every benchmark file in one commit, which moved no
 * number and would have broken the epoch for every suite in the archive.  A
 * break nobody believes is worse than no break at all, so the hash is over what
 * the file *does*, not how it is laid out.
 *
 * Two known imprecisions, both deliberate and both one-directional (they can
 * miss a change, never invent one): `//` inside a string literal ends the line
 * for the stripper — except after `:`, which spares URLs — and a change made
 * only inside such a tail is invisible.  Hashing is deterministic either way,
 * so the same source always yields the same hash.
 *
 * @param text — a file's contents
 * @returns the normalised form
 */
export function normaliseInput(text) {
  return (
    String(text)
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
      .replace(/\s+/g, ' ')
      // whitespace next to punctuation carries no meaning, and it is most of
      // what a formatter changes: `cmp( name ){` and `cmp(name) {` normalise
      // alike.  Only the space that separates two identifiers survives.
      .replace(/ ?([^\w\s$]) ?/g, '$1')
      .trim()
  );
}

/**
 * Every file a suite's numbers depend on: the suite file, the `./`-relative
 * modules it imports transitively (which is what makes `index.mjs` answer for
 * `core.mjs` and `collection.mjs`, where its benches actually live), the shared
 * inputs, and any extra non-module input the suite drives.
 *
 * `../`-relative imports are deliberately *not* followed: those reach `src/`
 * and the built bundle, which are the subject of the measurement rather than
 * part of the instrument.
 *
 * @param file — a benchmark file name, e.g. `index.mjs`
 * @param read — `(repoRelativePath) => string | null`
 * @returns `[ [ repoRelativePath, contents|null ], ... ]`, sorted by path
 */
export function harnessInputs(file, read = readRepoFile) {
  const own = read(`benchmark/${file}`);

  if (own == null) {
    return [];
  }

  const seen = new Map([[`benchmark/${file}`, own]]);
  const queue = [file];

  while (queue.length > 0) {
    const cur = queue.shift();
    const text = seen.get(`benchmark/${cur}`);

    if (text == null) {
      continue;
    }

    // a joined view, so a wrapped import still matches — the round-57.2 rule
    // for anything that reads sources as text
    for (const m of text
      .replace(/\s+/g, ' ')
      .matchAll(/from '\.\/([\w.-]+\.mjs)'|import '\.\/([\w.-]+\.mjs)'/g)) {
      const dep = m[1] ?? m[2];
      const key = `benchmark/${dep}`;

      if (NOT_INSTRUMENT.has(key)) {
        continue;
      }

      if (!seen.has(key)) {
        seen.set(key, read(key));
        queue.push(dep);
      }
    }
  }

  for (const path of [...SHARED_HARNESS, ...(EXTRA_INPUTS[file] ?? [])]) {
    if (!seen.has(path)) {
      seen.set(path, read(path));
    }
  }

  return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

/**
 * The harness hash for one benchmark file: 8 hex characters over its whole
 * input closure, each contribution named so a rename is a change.
 *
 * @param file — a benchmark file name, e.g. `collection.mjs`
 * @param read — `(repoRelativePath) => string | null`; the default reads the
 *   working tree, and the archive backfill passes a git-reading one instead
 * @returns the hash, or null when the suite file itself cannot be read
 */
export function harnessHash(file, read = readRepoFile) {
  const inputs = harnessInputs(file, read);

  if (inputs.length === 0) {
    return null;
  }

  const h = createHash('sha256');

  for (const [name, text] of inputs) {
    h.update(name);
    h.update('\0');
    h.update(text == null ? '' : normaliseInput(text));
    h.update('\0');
  }

  return h.digest('hex').slice(0, 8);
}

/**
 * The hash a run made with `--jobs N` stamps: the harness hash, plus how many
 * jobs shared the machine with this one.
 *
 * Round 68 made the runner concurrent, and concurrency is an instrument
 * change the file hashes cannot see — `report.mjs` is in `NOT_INSTRUMENT`, and
 * correctly so, since what it renders is not what it measures.  But *when* a
 * job ran beside five others, it ran at the all-core turbo clock against a
 * sixth of the L3, and its p50 is not the serial archive's p50.  Folding the
 * worker count in makes that a break the comparison refuses on its own, which
 * is the whole argument of this module applied to the one variable it did not
 * yet cover.
 *
 * **A serial run is unchanged**, deliberately: `workers <= 1` returns the hash
 * untouched, so every run in the archive keeps the epoch it was published
 * with, and a `--jobs 1` run today still compares against them.
 *
 * Different worker counts are different epochs.  Four-way and eight-way
 * contention are not the same condition, and nothing here knows which of them
 * a given row is sensitive to.
 *
 * @param hash — the harness hash, or null
 * @param workers — how many jobs ran concurrently
 * @returns the stamped hash, or null when `hash` is null
 */
export function concurrentHash(hash, workers) {
  if (hash == null || !(workers > 1)) {
    return hash;
  }

  return createHash('sha256')
    .update(hash)
    .update(`\0jobs=${workers}`)
    .digest('hex')
    .slice(0, 8);
}

/** Read a repo-relative file from the working tree, or null. */
function readRepoFile(path) {
  const full = join(ROOT, path);

  return existsSync(full) ? readFileSync(full, 'utf8') : null;
}

/**
 * Stamp `job.harness` onto every job a suite produced.
 *
 * @param jobs — job objects with a `suite` field
 * @param file — the benchmark file that produced them; inferred per job when
 *   omitted, which is what a multi-suite bundle (the renderer) needs
 * @param workers — how many jobs ran concurrently (round 68); 1 leaves the
 *   hash exactly as every earlier run stamped it
 */
export function stampHarness(jobs, file = null, { workers = 1 } = {}) {
  const cache = new Map();

  for (const job of jobs) {
    const f = file ?? suiteFileOf(job.suite);

    if (f == null) {
      job.harness = null;
      continue;
    }

    if (!cache.has(f)) {
      cache.set(f, concurrentHash(harnessHash(f), workers));
    }

    job.harness = cache.get(f);
  }

  return jobs;
}

// -- equivalence ---------------------------------------------------------------

/**
 * Harness changes declared non-substantive, newest last.
 *
 * An entry says: a row measured under `from` may be compared against one
 * measured under `to`.  Add one only for a change that cannot move a number —
 * formatting, comments, a rename — and say which change it was, because the
 * next reader's only defence against a wrong entry is the reason written here.
 *
 * Entries are gated: `auditEquivalences` fails when an entry names a hash no
 * published run carries, so a stale pair cannot sit here reading as permission.
 */
export const EQUIVALENT_HARNESSES = [
  // (none yet — round 65.12 starts the ledger empty, deliberately: the first
  // entry should be a real cosmetic change, not a placeholder nobody revisits)
];

/**
 * May a change be shown between two harness hashes?
 *
 * Equal hashes always may.  Unequal ones may only when the equivalence ledger
 * chains one to the other.  A null hash (a run published before this existed,
 * and not backfilled) is *not* equivalent to anything: unknown is not the same
 * as unchanged, and the whole point of this module is to stop the difference
 * being papered over.
 *
 * @param a — the earlier run's hash for this row
 * @param b — the later run's hash
 * @param ledger — the equivalence list (testing)
 * @returns true when a change between the two is meaningful
 */
export function sameEpoch(a, b, ledger = EQUIVALENT_HARNESSES) {
  if (a == null || b == null) {
    return false;
  }
  if (a === b) {
    return true;
  }

  // follow the ledger in both directions; the chain is short and the list is
  // hand-written, so a walk with a seen-set is the whole algorithm
  const adjacency = new Map();

  for (const { from, to } of ledger) {
    adjacency.set(from, [...(adjacency.get(from) ?? []), to]);
    adjacency.set(to, [...(adjacency.get(to) ?? []), from]);
  }

  const seen = new Set([a]);
  const queue = [a];

  while (queue.length > 0) {
    const cur = queue.shift();

    if (cur === b) {
      return true;
    }

    for (const next of adjacency.get(cur) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }

  return false;
}

/**
 * Entries of the equivalence ledger that no longer describe anything.
 *
 * @param hashesInUse — every harness hash the archive carries
 * @param ledger — the equivalence list (testing)
 * @returns the stale entries, with why each is stale
 */
export function auditEquivalences(hashesInUse, ledger = EQUIVALENT_HARNESSES) {
  const inUse = new Set(hashesInUse);
  const stale = [];

  for (const entry of ledger) {
    const missing = ['from', 'to'].filter((k) => !inUse.has(entry[k]));

    if (missing.length > 0) {
      stale.push({
        entry,
        why: `${missing.join(' and ')} names no hash in the archive`,
      });
    } else if (typeof entry.reason !== 'string' || entry.reason.trim() === '') {
      stale.push({ entry, why: 'carries no reason' });
    }
  }

  return stale;
}
