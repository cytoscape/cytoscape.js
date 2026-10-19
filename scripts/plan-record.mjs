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
   ever been rewritten.  (2026-10-12: every file has since gained one
   `**Depends on:**` line under the heading — see the dependency graph
   below; the split's byte-for-byte check predates it.)  That is what let the split be verified the only way
   a restructure can be: `PLAN.md` plus every round file, in order,
   reproduced the pre-split file **byte for byte** (1,524,666 bytes, 146
   files) — round 42's rule applied to a document.
2. **`assemble()` reconstructs the whole record on demand**, which is how the
   status site still publishes one continuous "Development record" page.

The section index is generated (`scripts/plan-index.mjs` -> `plan/INDEX.md`)
and gated (`test/modules/plan-record.test.mjs`), so it cannot drift from the files.
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
 *   `2026-08-20-07-rnd0106-plan-n-viewers-by-cloning.md`.
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

  const states = roundStates(sections);
  const of = (state) =>
    formatRuns([...states].filter(([, v]) => v === state).map(([n]) => n));
  const landed = of('landed');
  const planned = of('planned');

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
    '## Which rounds landed',
    '',
    'Derived from the section filenames (round 111), which is why it cannot',
    'go stale: a round is **landed** once a section named `landed` exists for',
    'it or for one of its sub-rounds — round 12 landed as 12a/12b/12c — and',
    'is **planned** while only its plan and the notes around it are on file.',
    'A round can land with an item held open; the round file says which.',
    '',
    '| State | Rounds |',
    '| --- | --- |',
    `| landed | ${landed} |`,
    `| planned | ${planned} |`,
    '',
    '## The sections',
    '',
    `${sections.length} sections.`,
    '',
    '| # | Round | Date | Kind | Section |',
    '| --: | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

/*
Round 111: which rounds landed, read off the names rather than the prose.

The kind field answered that question for the rounds written after 108.2,
when a round's plan and its landed record became one file that is renamed
when the work ships.  It did not answer it for the 33 rounds written before
that, whose plan file was amended in place — round 60's items each say
`— landed:` inside a file still named `plan`, and round 10's opens
`**Round complete (2026-07-27): all 17 items landed**`.  Reading the index
alone, every one of those looked unbuilt.

Two things keep it from drifting back.  {@link landingEvidence} is the
gate: a file named `plan` that records its own landing fails the build.
And {@link roundStates} derives the per-round state the index now prints,
so the answer is generated from the names instead of recalled.
*/

/**
 * What a section's text says about its own outcome — the forms the record
 * actually used before the kind field carried it.
 *
 * A round leaves the planned queue two ways, and both are read here.  It
 * **lands**, in the three spellings round 111 catalogued.  Or its sitting
 * **closes** it having decided to build nothing — round 40, whose file says
 * `So round 40 ships **nothing**` and which the landing forms cannot see,
 * because there was no landing to declare.  Round 111 renamed 33 files on
 * the first kind and missed the second; a round that shipped nothing is
 * still a round nobody has to do.
 *
 * The round number is matched and compared to the file's own in both,
 * because a plan routinely says a *different* round is complete: round 28's
 * plan opens by noting round 27 is complete apart from 27.8.
 *
 * @param text — the section's markdown.
 * @param round — the round the section is about, as {@link roundLabel}
 *   spells it; `null` for a section that is not about a round.
 * @returns `{ declares, closes, ticked, open }` — whether the text declares
 *   this round landed, whether it records the round closed with nothing
 *   shipped, and its checklist tallies.
 */
export function landingEvidence(text, round) {
  const own = (m) => m == null || round == null || m === round;
  const declares =
    /^\*\*Round complete\b/m.test(text) ||
    /^\*\*Landed \d{4}-\d{2}-\d{2}\b/m.test(text) ||
    [...text.matchAll(/\*\*Round ([\d.a-z]+) is complete\b/g)].some((m) =>
      own(m[1]),
    );
  const closes = [
    ...text.matchAll(/\bround ([\d.a-z]+) ships \*\*nothing\*\*/gi),
  ].some((m) => own(m[1]));

  return {
    declares,
    closes,
    ticked: (text.match(/^ *- \[x\] /gm) ?? []).length,
    open: (text.match(/^ *- \[ \] /gm) ?? []).length,
  };
}

/**
 * The base round a section file is about — `9.4`, `12a` and `12` all
 * belong to round 12's sub-rounds or to round 12 itself, and a span
 * (`rnd0091_0097`) belongs to every round it covers.
 *
 * @param key — the filename's `rnd` field.
 * @returns the base round numbers, ascending; empty for `rnd0000`.
 */
export function baseRounds(key) {
  const label = roundLabel(key);

  if (label == null) {
    return [];
  }

  const [from, to] = label.split('–').map((v) => parseInt(v, 10));

  if (to == null) {
    return [from];
  }

  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/**
 * Every round the record covers, and whether it landed.
 *
 * A round is **landed** when a section named `landed` exists for it or for
 * one of its sub-rounds — round 12 landed as 12a/12b/12c, and its own file
 * is the plan those three fulfilled.  Otherwise its plan is on file and the
 * work is not: the state is **planned**.  A `note` never lands a round; the
 * three planning sweeps that scoped rounds 91–107 are notes for exactly
 * that reason.
 *
 * @param sections — the result of {@link readSections}.
 * @returns a Map from base round number to `'landed'` or `'planned'`,
 *   ascending by round.
 */
export function roundStates(sections) {
  const states = new Map();

  for (const s of sections) {
    const key = roundKey(s.round);

    for (const n of baseRounds(key)) {
      if (states.get(n) !== 'landed') {
        states.set(n, s.kind === 'landed' ? 'landed' : 'planned');
      }
    }
  }

  return new Map([...states].sort((a, b) => a[0] - b[0]));
}

/**
 * A sorted list of round numbers as a reader wants to read it: runs of
 * consecutive numbers collapse to `7–11`.
 *
 * @param rounds — ascending round numbers.
 * @returns e.g. `'7–11, 13–37, 39'`.
 */
export function formatRuns(rounds) {
  const runs = [];

  for (const n of rounds) {
    const last = runs.at(-1);

    if (last && n === last[1] + 1) {
      last[1] = n;
    } else {
      runs.push([n, n]);
    }
  }

  return runs.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(', ');
}

/*
The dependency graph: which sections had to happen before which.

Every section file carries one line under its heading,
`**Depends on:** 30, 41, 2026-08-06-02` (or `none`), naming the record
nodes it builds on.  A node is a round, with its sub-rounds and notes
folded in — 12a, 12b and 12c are all round 12 — or, for a section about no
single round (`rnd0000`, or a span such as `rnd0091_0097`), the section
itself, named by its date and counter.  Only earlier nodes may be named,
so the graph is acyclic by construction at the section level.

The graph is generated into `debug/network-plan.json` beside the index
(`npm run plan:index`), and the debug harness draws it as the
`plan-deps` scene.
*/

/** Where the generated dependency graph lives, relative to the repo root. */
export const GRAPH_FILE = join('debug', 'network-plan.json');

/** The dependency line's pattern: the line after the heading's blank line. */
const DEPENDS_PATTERN = /^\*\*Depends on:\*\* (.+)$/;

/**
 * The record node a section belongs to.
 *
 * @param file — the section's basename.
 * @returns the base round (`'12'` for `rnd0012a`), or the section's
 *   `YYYY-MM-DD-NN` when it is about no single round.
 */
export function nodeId(file) {
  const name = parseName(file);
  const rounds = baseRounds(name.roundKey);

  return rounds.length === 1 && !name.roundKey.includes('_')
    ? String(rounds[0])
    : `${name.date}-${String(name.index).padStart(2, '0')}`;
}

/**
 * The nodes a section says it depends on.
 *
 * @param text — the section's markdown.
 * @returns the node ids in the order written (empty for `none`), or `null`
 *   when the section has no dependency line in its place.
 */
export function dependsOn(text) {
  const line = text.split('\n', 3)[2] ?? '';
  const m = DEPENDS_PATTERN.exec(line);

  if (m == null) {
    return null;
  }

  return m[1].trim() === 'none' ? [] : m[1].split(/,\s*/).map((v) => v.trim());
}

/**
 * The dependency graph as elements JSON: one node per record node, one
 * edge per prerequisite -> dependent pair (so the flow runs from the first
 * section down to the latest).
 *
 * A round's label is its number and title; the title is its own file's
 * heading (round 12's plan, not 12a's landed record; round 10's landed
 * record, not its note), falling back to its first sub-round.  A note's label is its date key and heading.  Each edge
 * carries `family`, its dependent's whole prerequisite set — the key
 * `taxi-track: family` bundles on, so one trunk feeds each dependent.
 *
 * @param root — the repo root.
 * @returns `{ elements: { nodes, edges } }`.
 */
export function planGraph(root) {
  const dir = join(root, ROUNDS_DIR);
  const nodes = new Map();
  const deps = new Map();

  for (const s of readSections(root)) {
    const id = nodeId(s.file);
    const name = parseName(s.file);
    // the round's own file (rnd0012, not rnd0012a) names it, its landed
    // record before its plan before its notes
    const own = /^rnd\d{4}$/.test(name.roundKey) || /^\d{4}-/.test(id);
    const rank = own ? 1 + ['note', 'plan', 'landed'].indexOf(s.kind) : 0;
    const node = nodes.get(id);

    if (node == null || rank > node.rank) {
      nodes.set(id, {
        id,
        title: s.title,
        rank,
        seq: node?.seq ?? s.seq,
        kind: node?.kind ?? null,
      });
    }

    const entry = nodes.get(id);

    // a round is landed once any of its sections is; a note stays a note
    entry.kind = /^\d{4}-/.test(id)
      ? 'note'
      : entry.kind === 'landed' || s.kind === 'landed'
        ? 'landed'
        : 'planned';

    const text = readFileSync(join(dir, s.file), 'utf8');

    for (const d of dependsOn(text) ?? []) {
      if (d !== id) {
        deps.set(id, new Set([...(deps.get(id) ?? []), d]));
      }
    }
  }

  const edges = [];

  for (const [target, sources] of deps) {
    const family = [...sources].sort().join(' ');

    for (const source of [...sources].sort()) {
      edges.push({
        data: { id: `${source}->${target}`, source, target, family },
      });
    }
  }

  return {
    elements: {
      nodes: [...nodes.values()].map((n) => ({
        data: {
          id: n.id,
          label: `${n.id} ${n.title}`,
          kind: n.kind,
          seq: n.seq,
        },
      })),
      edges,
    },
  };
}

/**
 * The generated graph file's text: one element per line, so a new round is
 * a small diff.
 *
 * @param graph — the result of {@link planGraph}.
 * @returns the full text of `debug/network-plan.json`.
 */
export function renderGraph(graph) {
  const list = (els) => els.map((e) => '  ' + JSON.stringify(e)).join(',\n');

  return (
    '{"elements":{"nodes":[\n' +
    list(graph.elements.nodes) +
    '\n],"edges":[\n' +
    list(graph.elements.edges) +
    '\n]}}\n'
  );
}
