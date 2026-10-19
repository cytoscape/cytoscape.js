#!/usr/bin/env node
/*
Round 108.2: regenerate `plan/INDEX.md` from the section files — and, since
the dependency lines, `debug/network-plan.json`, the record's dependency
graph the harness draws as its `plan-deps` scene.

  npm run plan:index            write both
  npm run plan:index -- --check exit nonzero if either is out of date

`test/modules/plan-record.test.mjs` runs the same comparison, so an index or a
graph that drifts from the files fails the build rather than misleading a
reader.
*/
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  readSections,
  renderIndex,
  planGraph,
  renderGraph,
  INDEX_FILE,
  GRAPH_FILE,
} from './plan-record.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

const sections = readSections(ROOT);
const outputs = [
  [INDEX_FILE, renderIndex(sections)],
  [GRAPH_FILE, renderGraph(planGraph(ROOT))],
];
let stale = false;

for (const [file, wanted] of outputs) {
  const path = join(ROOT, file);
  const current = existsSync(path) ? readFileSync(path, 'utf8') : null;

  if (current === wanted) {
    if (!check) {
      console.log(`${file} is up to date (${sections.length} sections)`);
    }
  } else if (check) {
    console.error(
      `${file} is out of date — run \`npm run plan:index\`` +
        ` (${sections.length} sections on disk)`,
    );
    stale = true;
  } else {
    writeFileSync(path, wanted);
    console.log(`${file} written (${sections.length} sections)`);
  }
}

process.exit(stale ? 1 : 0);
