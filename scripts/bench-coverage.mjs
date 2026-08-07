// Which of v4's public surface has a benchmark, and which does not
// (round 33.12).  The third tool in the family:
//
//   node scripts/jsdoc-coverage.mjs   — which members are documented
//   node scripts/throw-coverage.mjs   — which throws the suite runs
//   node scripts/bench-coverage.mjs   — which members a benchmark calls
//
//   node scripts/bench-coverage.mjs [--verbose]
//
// **It reports and never gates.**  It always exits 0: a benchmark floor
// is a policy call, like the throw-coverage floor round 30.4 left open,
// and the measurement here is weaker than either of its siblings.  Read
// the next paragraph before quoting a number from it.
//
// **What this can and cannot tell you.**  It looks for *call-shaped
// mentions* of a member's name in `benchmark/*.mjs`.  That means:
//
//   - It **over-detects**.  A member named `data`, `style`, `map` or
//     `on` matches text that has nothing to do with it, and a mention
//     inside a comment or a v3-side call counts the same as a benched
//     v4 call.  A "covered" member is one *plausibly* exercised, not one
//     proven to be.
//   - It **under-detects**.  A member reached through an alias, through
//     a wrapper, or as a property rather than a call is missed — round
//     31's event survey made exactly this mistake in the other
//     direction, reporting 31 event names as untested because the specs
//     registered them from an array rather than by literal name.
//
// So the honest use is *differential*: a name here with no mention at
// all is worth a look, and the total is a trend line rather than a
// score.  It exists because round 33 claimed to benchmark "everything
// possible", and a claim like that should have something that can
// contradict it later.
//
// The member scan is `auditFile()` from jsdoc-coverage.mjs — the
// same regexes, class-body tracking, comment skipping and overload
// handling the two gated audits use.  Round 32 recorded why that matters:
// three plan figures in a row were wrong because they came from a
// throwaway regex instead of the shipped scanner.

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditFile, PUBLIC_API } from './jsdoc-coverage.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BENCH_DIR = join(ROOT, 'benchmark');

const verbose = process.argv.includes('--verbose');

/** Every benchmark source, concatenated — the corpus a name is looked up in. */
function benchCorpus() {
  const files = readdirSync(BENCH_DIR).filter(
    (f) => f.endsWith('.mjs') || f.endsWith('.html'),
  );
  const parts = [];

  for (const f of files) {
    parts.push(readFileSync(join(BENCH_DIR, f), 'utf8'));
  }

  return { text: parts.join('\n'), files };
}

/** A call-shaped mention: `.name(`, `name(`, or a quoted 'name'. */
export function mentions(corpus, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `(?:\\.\\s*${escaped}\\s*\\(|\\b${escaped}\\s*\\(|['"\`]${escaped}['"\`])`,
  );

  return re.test(corpus);
}

export function audit() {
  const { text, files } = benchCorpus();
  const perFile = [];
  let covered = 0;
  let total = 0;
  let fields = 0;

  for (const rel of PUBLIC_API) {
    const { members } = auditFile(join(ROOT, rel));
    const seen = new Set();
    const uncovered = [];
    let fileCovered = 0;

    for (const m of members) {
      // Fields are out of the denominator: a benchmark calls things.  The
      // first version of this audit counted them and reported
      // animation.mts at 18%, which was mostly `Animation.refs`,
      // `.gpuId`, `.durationMs` and friends — public members of an
      // exported class (so the *documentation* audits are right to gate
      // them) but not something any benchmark could exercise directly.
      if (!m.isMethod) {
        fields++;
        continue;
      }

      // one entry per name per file: overloads and re-declarations are
      // the same member to a benchmark
      if (seen.has(m.name)) {
        continue;
      }

      seen.add(m.name);

      if (mentions(text, m.name)) {
        fileCovered++;
      } else {
        uncovered.push(
          `${m.owner != null ? m.owner + '.' : ''}${m.name} (${rel}:${m.line})`,
        );
      }
    }

    covered += fileCovered;
    total += seen.size;
    perFile.push({
      file: rel,
      covered: fileCovered,
      total: seen.size,
      uncovered,
    });
  }

  return { perFile, covered, total, fields, benchFiles: files.length };
}

const isMain =
  process.argv[1] != null &&
  relative(fileURLToPath(import.meta.url), process.argv[1]) === '';

if (isMain) {
  const { perFile, covered, total, fields, benchFiles } = audit();

  console.log(
    `\nbenchmark coverage of the v4 public surface (${benchFiles} benchmark files)`,
  );
  console.log(
    "  a call-shaped mention, not proof of a measurement — see this file's header\n",
  );

  for (const f of perFile) {
    const pct = f.total === 0 ? 100 : (f.covered / f.total) * 100;

    console.log(
      `  ${f.file.padEnd(32)} ${String(f.covered).padStart(4)}/${String(f.total).padEnd(4)} ${pct.toFixed(1)}%`,
    );

    if (verbose && f.uncovered.length > 0) {
      for (const u of f.uncovered) {
        console.log(`      - ${u}`);
      }
    }
  }

  console.log(
    `\n  total: ${covered}/${total} callable members (${((covered / total) * 100).toFixed(1)}%)`,
  );
  console.log(`  ${fields} fields excluded — a benchmark calls things`);

  if (!verbose) {
    console.log('  --verbose lists the members with no mention');
  }

  console.log('');

  // reports only, never gates (see the header)
  process.exit(0);
}
