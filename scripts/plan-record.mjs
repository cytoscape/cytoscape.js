/*
Round 108.2: the development record, as files an agent can actually open.
Round 108.9: the heading says what the section is; the filename says which
round, when, and what kind of section it is.

`PLAN.md` had grown to 1.5 MB — ~381k tokens over 146 `##` sections — which
is past what any coding agent can read, and past what a person reads too.
The record is this repo's most valuable document and it had become its least
reachable one.  So the sections live one file each under `plan/rounds/`, and
`PLAN.md` keeps only the parts it maintains rather than appends to: the
running summary, the process rules, and the open calls for the maintainer.

**The filename is `YYYY-MM-DD-NN-rndRRRR-kind-description.md`** — the date
the section was written, a counter among the sections sharing that date, the
round the section is about, and whether it is a `plan`, a `landed` record or
a `note`.  `rnd0000` marks a section that is not a round at all (the pass-1
notes, the design sittings, the parity gap analysis); a fractional or
lettered round keeps its form after the padding (`rnd0009.4`, `rnd0012a`),
and a section that scopes several rounds joins them with an underscore
(`rnd0091_0097`), since `-` already separates the fields.

**The heading is a title, not a label.**  It was
`## Round 15 plan — background images (planned 2026-08-01)`: four fields of
bookkeeping wrapped around the two words that say what the section is.  Every
one of those fields is in the filename, and repeating them in the prose
bought nothing but a heading nobody could skim.  So the heading is now
`## Background images`, and the index reads the round, the date and the kind
off the name — which is why nothing here parses prose any more.

Two things make the split safe rather than merely tidy:

1. **Nothing was added to the section text.**  A round file is its `##`
   section — no front matter, no wrapper — and only the heading line has
   ever been rewritten.  That is what let the split be verified the only way
   a restructure can be: `PLAN.md` plus every round file, in order,
   reproduced the pre-split file **byte for byte** (1,524,666 bytes, 146
   files) — round 42's rule applied to a document.
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

/** The three kinds of section, as the filename spells them. */
export const KINDS = ['plan', 'landed', 'note'];

/**
 * A round number as the filename's `rnd` field: zero-padded to four digits,
 * any fractional or lettered part kept as written, a span joined with `_`.
 * This is what names a new section file.
 *
 * @param round — the round as a reader says it (`'106'`, `'9.4'`, `'12a'`,
 *   `'102–107'`); `null` for a section that is not about a round.
 * @returns `'rnd0106'`, `'rnd0009.4'`, `'rnd0012a'`, `'rnd0091_0097'`, or
 *   `'rnd0000'` when the section is not about a round.
 */
export function roundKey(round) {
  if (round == null) {
    return 'rnd0000';
  }

  const pad = (v) => {
    const m = /^(\d+)(.*)$/.exec(v);

    return String(m[1]).padStart(4, '0') + m[2];
  };
  const [from, to] = round.split(/[–-]/);

  return to ? `rnd${pad(from)}_${pad(to)}` : `rnd${pad(from)}`;
}

/**
 * The inverse of {@link roundKey}: the round as a reader says it, which is
 * what the index's Round column shows.
 *
 * @param key — the filename's `rnd` field.
 * @returns `'106'`, `'9.4'`, `'12a'`, `'102–107'`, or `null` for `rnd0000`.
 */
export function roundLabel(key) {
  const body = key.replace(/^rnd/, '');
  const strip = (v) => v.replace(/^0+(?=\d)/, '');
  const [from, to] = body.split('_');

  if (from === '0000') {
    return null;
  }

  return to ? `${strip(from)}–${strip(to)}` : strip(from);
}

/**
 * The shape every section filename has.  The round field tracks what
 * {@link roundKey} produces — any depth of sub-round (`108.2.1`), an
 * optional letter (`12a`), and optionally a span of two of those.
 */
const ROUND_FIELD = String.raw`\d{4}(?:\.\d+)*[a-z]?`;
export const FILE_PATTERN = new RegExp(
  String.raw`^(\d{4}-\d{2}-\d{2})-(\d{2})-(rnd${ROUND_FIELD}(?:_${ROUND_FIELD})?)` +
    String.raw`-(plan|landed|note)-([a-z0-9-]+)\.md$`,
);

/**
 * The metadata a section filename carries, or `null` if it is not named to
 * the convention.  This is the only place section metadata comes from: the
 * heading is prose, and prose is what the old parser kept getting wrong.
 *
 * @param file — the basename, e.g.
 *   `2026-08-20-07-rnd0106-plan-n-viewers-one-store.md`.
 * @returns `{ date, index, roundKey, round, kind, slug }`.
 */
export function parseName(file) {
  const m = FILE_PATTERN.exec(file);

  return m
    ? {
        date: m[1],
        index: Number(m[2]),
        roundKey: m[3],
        round: roundLabel(m[3]),
        kind: m[4],
        slug: m[5],
      }
    : null;
}

/** The `##` heading of a section file, without the marker. */
export function titleOf(text) {
  const first = text.split('\n', 1)[0];

  return first.startsWith('## ') ? first.slice(3).trim() : '';
}

/**
 * Every section file, in record order — which is filename order, and so is
 * the date then the within-date counter.
 *
 * `seq` is that position, numbered from one.  It is derived rather than
 * stored: the filename carried a record sequence before round 108.7, and a
 * stored ordinal is the field that goes stale the moment a section is
 * inserted between two others.
 *
 * @param root — the repo root.
 * @returns one entry per file: `{ file, seq, title, round, date, kind }`,
 *   where everything but the title is read off the filename.
 */
export function readSections(root) {
  const dir = join(root, ROUNDS_DIR);

  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((file, i) => {
      const name = parseName(file);

      return {
        file,
        seq: i + 1,
        title: titleOf(readFileSync(join(dir, file), 'utf8')),
        round: name?.round ?? null,
        date: name?.date ?? null,
        kind: name?.kind ?? 'note',
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
