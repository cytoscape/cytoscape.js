#!/usr/bin/env node
/*
Round 108.2: regenerate `plan/INDEX.md` from the section files.

  npm run plan:index            write the index
  npm run plan:index -- --check exit nonzero if it is out of date

`test/modules/plan-record.mjs` runs the same comparison, so an index that
drifts from the files fails the build rather than misleading a reader.
*/
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readSections, renderIndex, INDEX_FILE } from './plan-record.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

const sections = readSections(ROOT);
const wanted = renderIndex(sections);
const path = join(ROOT, INDEX_FILE);
const current = existsSync(path) ? readFileSync(path, 'utf8') : null;

if (current === wanted) {
  if (!check) {
    console.log(`${INDEX_FILE} is up to date (${sections.length} sections)`);
  }

  process.exit(0);
}

if (check) {
  console.error(
    `${INDEX_FILE} is out of date — run \`npm run plan:index\`` +
      ` (${sections.length} sections on disk)`,
  );
  process.exit(1);
}

writeFileSync(path, wanted);
console.log(`${INDEX_FILE} written (${sections.length} sections)`);
