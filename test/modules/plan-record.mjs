/*
Round 108.2: the development record is a directory now, and this is what
keeps it honest.

`PLAN.md` was 1.5 MB — ~381k tokens over 146 sections — so no agent could
read the document written for it, and every round-closing edit was a blind
append at the tail.  The sections moved under `plan/rounds/`, and the split
was verified the only way a restructure can be: the head plus every section
file, in order, reproduced the pre-split file **byte for byte**
(1,524,666 bytes, 146 files).

The names then became `YYYY-MM-DD-NN-rndRRRR-description.md`, so the one
thing a reader knows about a section — its round — is the thing the filename
leads with.  That adds a failure mode the bare sequence did not have: a name
that disagrees with the heading it sits above.  Hence the agreement gate.

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
  roundOf,
  roundKey,
  kindOf,
  dateOf,
  parseName,
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

  it('names every section file YYYY-MM-DD-NN-rndRRRR-description.md', () => {
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

  it('agrees with each heading about the round and the date', () => {
    // The name repeats what the heading says, and a repeat that nobody
    // checks is a lie waiting to happen — rename a file to the wrong round
    // and every future reader trusts the name over the text.
    for (const s of sections) {
      const name = parseName(s.file);

      expect(name.roundKey, `${s.file} names the wrong round`).to.equal(
        roundKey(s.round),
      );

      const heading = dateOf(s.title);

      if (heading != null) {
        expect(name.date, `${s.file} names the wrong date`).to.equal(heading);
      }
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

  it('parses the round number and kind out of a heading', () => {
    // These two derive the index's columns from prose, so they are the part
    // most likely to be silently wrong.  Cases taken from real headings.
    expect(
      roundOf('Round 12 plan — curved edges (planned 2026-07-29)'),
    ).to.equal('12');
    expect(
      roundOf('Landed (round 12a — bundled bezier + self-loops)'),
    ).to.equal('12a');
    expect(roundOf('Round 46.5 — the status site')).to.equal('46.5');
    expect(roundOf('Rounds 102–107 — the ecosystem rounds')).to.equal(
      '102–107',
    );
    expect(roundOf('Context')).to.equal(null);

    expect(
      kindOf('Round 12 plan — curved edges (planned 2026-07-29)'),
    ).to.equal('plan');
    expect(kindOf('Landed (round 9 — animation, 2026-07-24)')).to.equal(
      'landed',
    );
    expect(kindOf('v3 → v4 parity gap analysis (2026-07-28)')).to.equal('note');
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
        parseName(`2026-08-20-07-${key}-a-section.md`)?.roundKey,
        `${key} is not parsed back`,
      ).to.equal(key);
    }
  });
});
