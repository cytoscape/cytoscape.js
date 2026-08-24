/*
Round 108.2: the development record, as files an agent can actually open.

`PLAN.md` had grown to 1.5 MB — ~381k tokens over 146 `##` sections — which
is past what any coding agent can read, and past what a person reads too.
The record is this repo's most valuable document and it had become its least
reachable one.  So the sections live in `plan/rounds/NNN-slug.md`, one file
each, and `PLAN.md` keeps only the parts it maintains rather than appends to:
the running summary, the process rules, and the open calls for the maintainer.

Two things make the split safe rather than merely tidy:

1. **Nothing was added to the section text.**  A round file is its `##`
   section verbatim — no front matter, no wrapper.  Every piece of metadata
   the index shows (round number, date, kind) is parsed back out of the
   heading, which already carried all three.  That is what let the split be
   verified the only way a restructure can be: `PLAN.md` plus every round
   file, in order, reproduced the pre-split file **byte for byte**
   (1,524,666 bytes, 146 files) — round 42's rule applied to a document.
2. **`assemble()` reconstructs the whole record on demand**, which is how the
   status site still publishes one continuous "Development record" page.

The section index is generated (`scripts/plan-index.mjs` -> `plan/INDEX.md`)
and gated (`test/modules/plan-record.mjs`), so it cannot drift from the files.
*/
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Where the split-out sections live, relative to the repo root. */
export const ROUNDS_DIR = join('plan', 'rounds');

/** The generated index, relative to the repo root. */
export const INDEX_FILE = join('plan', 'INDEX.md');

/**
 * The round number in a section heading, as written — `'12a'`, `'46.5'`,
 * `'102–107'` for a heading that scopes several — or `null` for the
 * sections that are not rounds at all (the parity gap analysis, the design
 * sittings, the directory layout).
 */
export function roundOf(title) {
  const span = /\brounds\s+(\d+(?:\.\d+)*)\s*[–-]\s*(\d+(?:\.\d+)*)/i.exec(
    title,
  );

  if (span) {
    return `${span[1]}–${span[2]}`;
  }

  const one = /\bround\s+(\d+(?:\.\d+)*[a-z]?)\b/i.exec(title);

  return one ? one[1] : null;
}

/** The first ISO date in a heading, or `null`. */
export function dateOf(title) {
  const m = /(\d{4}-\d{2}-\d{2})/.exec(title);

  return m ? m[1] : null;
}

/**
 * What kind of section this is: a `plan` written before the work, a `landed`
 * record written after it, or a `note` (analysis, a design sitting, a
 * standing reference).  Read from the heading's own wording, which has been
 * consistent since round 7.
 */
export function kindOf(title) {
  if (/^landed\b/i.test(title)) {
    return 'landed';
  }

  if (/\bplan\b\s*—/i.test(title) || /\bplan\s*\(/i.test(title)) {
    return 'plan';
  }

  if (/^rounds?\s+[\d.]+/i.test(title)) {
    return 'landed';
  }

  return 'note';
}

/** The `##` heading of a section file, without the marker. */
export function titleOf(text) {
  const first = text.split('\n', 1)[0];

  return first.startsWith('## ') ? first.slice(3).trim() : '';
}

/**
 * Every section file, in record order (the order is the filename's numeric
 * prefix, which is the order they appeared in the original `PLAN.md`).
 *
 * @param root — the repo root.
 * @returns one entry per file: `{ file, seq, title, round, date, kind }`.
 */
export function readSections(root) {
  const dir = join(root, ROUNDS_DIR);

  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((file) => {
      const text = readFileSync(join(dir, file), 'utf8');
      const title = titleOf(text);

      return {
        file,
        seq: Number(file.slice(0, 3)),
        title,
        round: roundOf(title),
        date: dateOf(title),
        kind: kindOf(title),
      };
    });
}

/**
 * The whole development record as one document — `PLAN.md`'s standing
 * sections followed by every round file in order.  The status site renders
 * this, so its "Development record" page is unchanged by the split.
 *
 * @param root — the repo root.
 * @returns the assembled markdown.
 */
export function assemble(root) {
  const head = readFileSync(join(root, 'PLAN.md'), 'utf8');
  const dir = join(root, ROUNDS_DIR);
  const parts = readSections(root).map((s) =>
    readFileSync(join(dir, s.file), 'utf8'),
  );

  return parts.length === 0 ? head : head + parts.join('\n');
}

const escape = (s) => s.replace(/\|/g, '\\|');

/**
 * The generated index: one row per section, newest last, linking the file.
 *
 * @param sections — the result of {@link readSections}.
 * @returns the full text of `plan/INDEX.md`.
 */
export function renderIndex(sections) {
  const rows = sections.map((s) => {
    const link = `[${escape(s.title)}](rounds/${s.file})`;

    return `| ${s.seq} | ${s.round ?? '—'} | ${s.date ?? '—'} | ${s.kind} | ${link} |`;
  });

  return [
    '# The development record — index',
    '',
    '**Generated by `npm run plan:index`.  Do not edit by hand.**',
    '',
    'One row per section of the record, in the order it was written.  The',
    'standing parts — the running summary, the process rules and the open',
    'calls for the maintainer — are in [`../PLAN.md`](../PLAN.md); everything',
    'below is a section file under [`rounds/`](rounds/), which is where a new',
    'round is written.',
    '',
    `${sections.length} sections.`,
    '',
    '| # | Round | Date | Kind | Section |',
    '| --: | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}
