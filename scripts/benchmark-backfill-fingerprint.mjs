// Round 113.1: re-stamp the machine fingerprint on every published run.
//
//   node scripts/benchmark-backfill-fingerprint.mjs [--dry-run]
//
// `fingerprint()` (scripts/machine-info.mjs) changed to round total RAM to
// the GiB, after a kernel upgrade moved `os.totalmem()` by 1.1 MB and split
// the benchmark box's history into two machines.  Every published run keeps
// its full `meta.machine` block, so the new id is recomputed from what was
// measured rather than guessed: this rewrites `meta.machine.fingerprint` in
// each results file and the `fingerprint` field of its index entry, and
// prints every id it changed.  Idempotent; a run with no machine block keeps
// its null and is reported.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { fingerprint } from './machine-info.mjs';
import { readIndex, PUBLISHED_DIR, INDEX_FILE } from './benchmark-publish.mjs';

function main(argv) {
  const dryRun = argv.includes('--dry-run');
  const { runs } = readIndex();
  let changed = 0;

  for (const run of runs) {
    const path = join(PUBLISHED_DIR, run.file);
    const results = JSON.parse(readFileSync(path, 'utf8'));
    const machine = results.meta?.machine ?? null;

    if (machine == null) {
      console.log(`  ${run.file}: no machine block, kept ${run.fingerprint}`);
      continue;
    }

    const id = fingerprint(machine);

    if (id === run.fingerprint && id === machine.fingerprint) {
      continue;
    }

    console.log(`  ${run.file}: ${run.fingerprint} → ${id}`);
    changed++;

    if (!dryRun) {
      machine.fingerprint = id;
      run.fingerprint = id;
      writeFileSync(path, JSON.stringify(results, null, 2) + '\n');
    }
  }

  if (!dryRun && changed > 0) {
    writeFileSync(
      join(PUBLISHED_DIR, INDEX_FILE),
      JSON.stringify({ runs }, null, 2) + '\n',
    );
  }

  console.log(
    `${dryRun ? 'would change' : 'changed'} ${changed} of ${runs.length} runs`,
  );
}

main(process.argv.slice(2));
