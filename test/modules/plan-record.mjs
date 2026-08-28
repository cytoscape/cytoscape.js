/*
Round 108.2: the development record is a directory now, and this is what
keeps it honest.

`PLAN.md` was 1.5 MB — ~381k tokens over 146 sections — so no agent could
read the document written for it, and every round-closing edit was a blind
append at the tail.  The sections moved under `plan/rounds/`, and the split
was verified the only way a restructure can be: the head plus every section
file, in order, reproduced the pre-split file **byte for byte**
(1,524,666 bytes, 146 files).

The names then became `YYYY-MM-DD-NN-rndRRRR-kind-description.md` (rounds
108.7 and 108.9), so everything a reader knows about a section before opening
it — round, date, kind — is in the name, and the `##` heading is free to be a
title.  That moved the failure mode: nothing parses prose any more, so what
has to be asserted is that the name is well formed and that the heading has
stopped repeating it.

That control ran once, at the split.  What has to keep running is everything
that can drift afterwards: an index nobody regenerated, a file named outside
the convention, a section with no heading, two files claiming one position.
Each of those fails quietly — a stale index still renders, and a heading-less
file still concatenates — which is exactly why they are asserted here.
*/
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { expect } from 'chai';

import {
  readSections,
  renderIndex,
  assemble,
  roundKey,
  roundLabel,
  parseName,
  landingEvidence,
  baseRounds,
  roundStates,
  formatRuns,
  FILE_PATTERN,
  ROUNDS_DIR,
  INDEX_FILE,
} from '../../scripts/plan-record.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const dir = join(ROOT, ROUNDS_DIR);
const sections = readSections(ROOT);

describe('the development record', () => {
  it('has section files to index', () => {
    // The control for every assertion below: an empty directory satisfies
    // "every file is well named" and "the index matches" trivially.
    expect(existsSync(dir), `${ROUNDS_DIR} is missing`).to.equal(true);
    expect(sections.length).to.be.greaterThan(100);
  });

  it('names every section file YYYY-MM-DD-NN-rndRRRR-kind-slug.md', () => {
    for (const file of readdirSync(dir)) {
      expect(file, `${file} is not a section file`).to.match(FILE_PATTERN);
    }
  });

  it('counts the sections sharing a date from one, without gaps', () => {
    // The counter is what orders sections written the same day, and 17 were
    // written on 2026-08-14 alone.  A duplicate is the failure mode of adding
    // a round by hand: two files sort adjacently, both render, and one
    // position shows twice.  A gap is the failure mode of deleting one.
    const byDate = new Map();

    for (const s of sections) {
      const { date, index } = parseName(s.file);

      byDate.set(date, [...(byDate.get(date) ?? []), index]);
    }

    for (const [date, indices] of byDate) {
      expect(indices, `${date} is not counted 1..n in order`).to.deep.equal(
        indices.map((_, i) => i + 1),
      );
    }
  });

  it('keeps the bookkeeping out of the headings', () => {
    // The point of round 108.9.  A heading that says
    // `Round 15 plan — background images (planned 2026-08-01)` repeats three
    // fields the filename already carries, and the repeat is what rots: the
    // name is renamed, the prose is not.  So a heading may name another
    // round in passing, but it may not open by labelling itself one.
    for (const s of sections) {
      expect(s.title, `${s.file} still labels itself`).to.not.match(
        /^(landed\b|rounds?\s+\d)/i,
      );
      expect(s.title, `${s.file} still dates itself`).to.not.match(
        /\(\s*(planned|landed|proposed|raised|written|scheduled)\b/i,
      );
    }
  });

  it('starts every section with its `##` heading', () => {
    for (const s of sections) {
      const text = readFileSync(join(dir, s.file), 'utf8');

      expect(
        text.startsWith('## '),
        `${s.file} does not open with a heading`,
      ).to.equal(true);
      expect(s.title, `${s.file} has an empty heading`).to.not.equal('');
    }
  });

  it('keeps plan/INDEX.md in step with the files on disk', () => {
    // The whole point of a generated index: `npm run plan:index` is the fix,
    // and a red build here is the only thing that makes anyone run it.
    const current = readFileSync(join(ROOT, INDEX_FILE), 'utf8');

    expect(current, 'run `npm run plan:index`').to.equal(renderIndex(sections));
  });

  it('links every section from the index exactly once', () => {
    const index = readFileSync(join(ROOT, INDEX_FILE), 'utf8');

    for (const s of sections) {
      const href = `rounds/${s.file}`;
      const hits = index.split(href).length - 1;

      expect(hits, `${s.file} is linked ${hits} times`).to.equal(1);
    }
  });

  it('assembles into the whole record, with PLAN.md first', () => {
    // What the status site publishes.  Asserting the parts are all present
    // is the cheap half; asserting the *order* is the half that matters,
    // since a record whose rounds are shuffled reads as a different history.
    const whole = assemble(ROOT);
    const head = readFileSync(join(ROOT, 'PLAN.md'), 'utf8');

    expect(whole.startsWith(head)).to.equal(true);

    let at = head.length;

    for (const s of sections) {
      const text = readFileSync(join(dir, s.file), 'utf8');
      const found = whole.indexOf(text, at);

      expect(
        found,
        `${s.file} is out of order in the assembled record`,
      ).to.be.greaterThan(-1);
      at = found + text.length;
    }

    expect(whole.length).to.be.greaterThan(1_000_000);
  });

  it('keeps PLAN.md itself readable in one sitting', () => {
    // The reason for the split.  Left ungated, the head grows back — this
    // file is where rounds were appended for a year.  The budget is the
    // standing sections plus room to maintain them, well under what a
    // reader or an agent can hold.
    const bytes = readFileSync(join(ROOT, 'PLAN.md')).length;

    expect(
      bytes,
      'PLAN.md is growing back; new rounds go in plan/rounds/',
    ).to.be.lessThan(200 * 1024);
  });

  it('names a section landed once its own file records the landing', () => {
    // Round 111.  Thirty-three rounds sat in files named `plan` after they
    // shipped, because before 108.2 a round's plan and its landed record
    // were two files and only the second was named for the outcome.  Read
    // through the index, every one of them looked unbuilt — the question
    // "which rounds are done?" had no answer the record could give.
    //
    // So a `plan` file may not record its own landing.  Both forms the
    // record used are caught: the self-declaration, and a checklist with
    // nothing left open.
    //
    // Round 111.1 adds the third: a round whose sitting closed it having
    // decided to build nothing.  Round 40 sat in the planned queue for
    // nineteen days after its own file said `So round 40 ships **nothing**`,
    // because 111's forms all look for a landing and there was none to
    // declare.  A round that shipped nothing is still a round nobody has to
    // do, and the queue is what the kind field is read for.
    for (const s of sections.filter((x) => x.kind === 'plan')) {
      const text = readFileSync(join(dir, s.file), 'utf8');
      const { declares, closes, ticked, open } = landingEvidence(text, s.round);

      expect(declares, `${s.file} declares it landed; rename it`).to.equal(
        false,
      );
      expect(
        closes,
        `${s.file} records the round closed with nothing shipped; rename it`,
      ).to.equal(false);
      expect(
        ticked > 0 && open === 0,
        `${s.file} has all ${ticked} items ticked; rename it`,
      ).to.equal(false);
    }
  });

  it("reads a landing declaration only about the section's own round", () => {
    // The control for the gate above, and the reason it parses the round
    // number rather than the phrase: round 28's plan opens by saying round
    // 27 is complete apart from 27.8.  A regex that ignored whose round it
    // was would have renamed 28 for a sentence about 27.
    const evidence = (text, round) => landingEvidence(text, round);

    expect(evidence('**Round 34 is complete.**', '34').declares).to.equal(true);
    expect(evidence('**Round 27 is complete** apart', '28').declares).to.equal(
      false,
    );
    expect(evidence('**Round complete (2026-07-27)**', '10').declares).to.equal(
      true,
    );
    expect(
      evidence('**Landed 2026-08-04.**  The plan', '42').declares,
    ).to.equal(true);
    expect(evidence('a plan for round 42', '42').declares).to.equal(false);

    // Round 111.1's form, held to the same rule: round 79's plan says an
    // item of its own "ships nothing" (test-only), which must not read as
    // the round closing, and a sitting that closes round 40 must not close
    // round 39.
    expect(evidence('So round 40 ships **nothing**:', '40').closes).to.equal(
      true,
    );
    expect(evidence('So round 40 ships **nothing**:', '39').closes).to.equal(
      false,
    );
    expect(evidence('(test-only; ships nothing).', '79').closes).to.equal(
      false,
    );

    const list = '- [x] **1** done\n- [ ] **2** not\n';

    expect(evidence(list, '1')).to.deep.equal({
      declares: false,
      closes: false,
      ticked: 1,
      open: 1,
    });
  });

  it('keeps a round to one section file per kind pair', () => {
    // Since 108.2 a round is one file, renamed when it lands.  The five
    // pre-108.2 rounds that had a separate plan and landed section (13, 19,
    // 86, 90, 101) were merged into that shape by round 111, so this now
    // holds for the whole record: nothing is both planned and landed, which
    // is what makes the derived state below a single lookup.
    const kinds = new Map();

    for (const s of sections) {
      const key = roundKey(s.round);

      kinds.set(key, [...(kinds.get(key) ?? []), s.kind]);
    }

    for (const [key, list] of kinds) {
      expect(
        list.includes('plan') && list.includes('landed'),
        `${key} is filed as both a plan and a landed record`,
      ).to.equal(false);
    }
  });

  it('derives which rounds landed, and publishes it in the index', () => {
    // What a reader actually wants from the index, and the reason the kinds
    // above have to be true.  A round is landed when a section names it so —
    // its own, or one of its sub-rounds', since round 12 landed as 12a/12b/
    // 12c and round 108 as 108.7/108.8/108.9.
    const states = roundStates(sections);

    expect(baseRounds('rnd0009.4')).to.deep.equal([9]);
    expect(baseRounds('rnd0012a')).to.deep.equal([12]);
    expect(baseRounds('rnd0091_0097')).to.deep.equal([
      91, 92, 93, 94, 95, 96, 97,
    ]);
    expect(baseRounds('rnd0000')).to.deep.equal([]);

    expect(states.get(10), 'round 10 landed as its own file').to.equal(
      'landed',
    );
    expect(states.get(12), 'round 12 landed as 12a/12b/12c').to.equal('landed');
    expect(states.get(86), 'round 86 landed').to.equal('landed');
    expect(
      states.get(40),
      'round 40 closed at its sitting, shipping nothing',
    ).to.equal('landed');
    expect(states.get(93), "the screen pass's curve round landed").to.equal(
      'landed',
    );
    expect(
      states.get(94),
      "the screen pass's label-fidelity round landed",
    ).to.equal('landed');
    expect(
      states.get(104),
      'the label-decluttering round is scoped, not built',
    ).to.equal('planned');
    expect(
      [...states.values()].every((v) => v === 'landed' || v === 'planned'),
    ).to.equal(true);

    // and the index prints both rows, so the answer is published rather
    // than recomputed by whoever asks
    const index = readFileSync(join(ROOT, INDEX_FILE), 'utf8');
    const runs = (state) =>
      formatRuns([...states].filter(([, v]) => v === state).map(([n]) => n));

    expect(index).to.contain(`| landed | ${runs('landed')} |`);
    expect(index).to.contain(`| planned | ${runs('planned')} |`);
    expect(formatRuns([7, 8, 9, 11, 13, 14])).to.equal('7–9, 11, 13–14');
  });

  it('reads the round, the date and the kind off the filename', () => {
    // These are the index's columns, and the name is now their only source.
    const name = parseName(
      '2026-08-20-07-rnd0106-plan-n-viewers-by-cloning.md',
    );

    expect(name).to.deep.equal({
      date: '2026-08-20',
      index: 7,
      roundKey: 'rnd0106',
      round: '106',
      kind: 'plan',
      slug: 'n-viewers-by-cloning',
    });

    expect(parseName('2026-08-20-07-rnd0106-n-viewers-by-cloning.md')).to.equal(
      null,
    );
    expect(parseName('2026-07-22-01-rnd0000-note-context.md').round).to.equal(
      null,
    );
    expect(roundLabel('rnd0009.4')).to.equal('9.4');
    expect(roundLabel('rnd0012a')).to.equal('12a');
    expect(roundLabel('rnd0102_0107')).to.equal('102–107');
  });

  it('renders a round number as the filename field', () => {
    // The other half of the agreement gate above: if this mapping is wrong,
    // every filename is consistently wrong and the gate still passes.
    expect(roundKey('106')).to.equal('rnd0106');
    expect(roundKey('9.4')).to.equal('rnd0009.4');
    expect(roundKey('12a')).to.equal('rnd0012a');
    expect(roundKey('102–107')).to.equal('rnd0102_0107');
    expect(roundKey(null)).to.equal('rnd0000');

    // and each of those is a name the pattern accepts
    for (const key of ['rnd0106', 'rnd0009.4', 'rnd0012a', 'rnd0102_0107']) {
      expect(
        parseName(`2026-08-20-07-${key}-plan-a-section.md`)?.roundKey,
        `${key} is not parsed back`,
      ).to.equal(key);
    }
  });
});
