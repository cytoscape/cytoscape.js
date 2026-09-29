import { expect } from 'chai';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  END_STATE,
  GESTURES,
  NOT_GESTURES,
  TRACES,
} from '../../playwright-tests/lib/gesture-inventory.mjs';

/*
Round 136 (item 31, the inventory): the gesture table, held to the tree.

The inventory (`playwright-tests/lib/gesture-inventory.mjs`) claims, per
gesture, which specs cover it.  A coverage claim is exactly the kind of
statement that rots silently — a spec renamed, a gesture event added — so
this file makes each claim checkable:

- every cited spec title exists verbatim, as a string literal in a
  `test(` / `it(` call, in the file cited;
- every cited source file exists;
- every public event name `src/interact/` emits appears in some
  gesture's event list (the scan is pinned by size, and has a control);
- every trace a gesture names exists, and every trace is used;
- the coverage tallies are pinned, so moving a gesture between "no
  coverage", "headless only" and "browser" is a conscious edit here.

Measured at landing (2026-09-29): 30 gestures — 26 with browser
coverage, 1 with headless (driven) coverage only, 3 with none; 40 event
names emitted from src/interact/, every one inventoried.
*/

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const INTERACT = join(ROOT, 'src', 'interact');

/** The pinned tallies; move them only with the edit that moves them. */
const PINNED = { gestures: 30, browser: 26, headlessOnly: 1, none: 3 };

/** Is `title` a string literal passed to test( or it( in `text`? */
const citesTitle = (text, title) => {
  const forms = [
    `'${title.replace(/'/g, "\\'")}'`,
    `"${title.replace(/"/g, '\\"')}"`,
    `\`${title}\``,
  ];

  return forms.some((lit) =>
    new RegExp(
      `\\b(?:test|it)(?:\\.only|\\.skip)?\\(\\s*${lit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
    ).test(text),
  );
};

/**
 * The event names a source emits, by the call shapes src/interact uses:
 * `emitGesture` / `emitModelGesture` / `emitDragState` / `_emitOnEle`
 * with a literal first argument, `emit({ type: '…' })`, and the
 * drag-hover composition `prefix + 'over'` over the `prefix` union.
 */
export const scanEvents = (text) => {
  const names = new Set();
  const flat = text.replace(/\s+/g, ' ');

  for (const m of flat.matchAll(
    /\b(?:emitGesture|emitModelGesture|emitDragState|_emitOnEle)\( ?'([a-z]+)'/g,
  )) {
    names.add(m[1]);
  }

  for (const m of flat.matchAll(/\bemit\(\{ ?type: ?'([a-z]+)'/g)) {
    names.add(m[1]);
  }

  const prefixes = /\bprefix: ((?:'[a-z]+'(?: ?\| ?)?)+)/.exec(flat);

  if (prefixes != null) {
    const heads = [...prefixes[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);

    for (const m of flat.matchAll(/_emitOnEle\( ?prefix \+ '([a-z]+)'/g)) {
      for (const head of heads) {
        names.add(head + m[1]);
      }
    }
  }

  return names;
};

const interactEvents = () => {
  const names = new Set();

  for (const f of readdirSync(INTERACT).filter((f) => f.endsWith('.mts'))) {
    for (const n of scanEvents(readFileSync(join(INTERACT, f), 'utf8'))) {
      names.add(n);
    }
  }

  return names;
};

describe('gesture inventory (round 136)', function () {
  const files = new Map();
  const read = (file) => {
    if (!files.has(file)) {
      files.set(file, readFileSync(join(ROOT, file), 'utf8'));
    }

    return files.get(file);
  };

  it('cites only spec titles that exist in the files it names', () => {
    const missing = [];
    let cited = 0;

    for (const g of GESTURES) {
      for (const [tier, kinds] of [
        ['browser', ['real', 'synthetic']],
        ['headless', ['driven', 'api']],
      ]) {
        for (const [file, title, kind] of g[tier]) {
          cited++;
          expect(kinds, `${g.id}: ${tier} kind`).to.include(kind);
          expect(existsSync(join(ROOT, file)), `${g.id}: ${file}`).to.equal(
            true,
          );

          if (!citesTitle(read(file), title)) {
            missing.push(`${g.id}: ${file} — ${title}`);
          }
        }
      }
    }

    expect(missing).to.deep.equal([]);
    expect(cited).to.be.greaterThan(60);
  });

  it('title matching finds a real title and refuses a planted one (control)', () => {
    const text = read('playwright-tests/renderer.spec.js');

    expect(citesTitle(text, 'tap selects and background tap clears')).to.equal(
      true,
    );
    // a title with a quote in it, written in double quotes in the spec
    expect(
      citesTitle(
        text,
        "a pressed node draws v3's :active overlay (round 57.1c)",
      ),
    ).to.equal(true);
    expect(citesTitle(text, 'tap selects and background tap clear')).to.equal(
      false,
    );
    // a comment or a plain string is not a test title
    expect(
      citesTitle("// 'x marks it'\nconst y = 'x marks it';", 'x marks it'),
    ).to.equal(false);
  });

  it('cites only source files that exist', () => {
    for (const g of GESTURES) {
      for (const f of g.src) {
        expect(existsSync(join(ROOT, f)), `${g.id}: ${f}`).to.equal(true);
      }
    }
  });

  it('names every event src/interact emits', () => {
    const emitted = interactEvents();
    const text = GESTURES.map((g) => g.events.join(' ')).join(' ');
    const words = new Set(text.match(/[a-z]+/g));
    const unnamed = [...emitted].filter((n) => !words.has(n)).sort();

    // the scan's size: a scanner that stopped matching would find nothing
    // to miss and pass
    expect(emitted.size).to.equal(40);
    expect(unnamed).to.deep.equal([]);
  });

  it('scans every call shape src/interact uses (control)', () => {
    const planted = [
      "ph.emitGesture(\n  'plantedone',\n  target,\n);",
      "cy._emitOnEle('plantedtwo', ele, undefined, {});",
      "ph.cy.emit({\n  type: 'plantedthree',\n});",
      "prefix: 'lefta' | 'leftb',\nph.cy._emitOnEle(prefix + 'over', prev);",
      "const notAnEvent = 'plantedfour';",
    ].join('\n');

    expect([...scanEvents(planted)].sort()).to.deep.equal([
      'leftaover',
      'leftbover',
      'plantedone',
      'plantedthree',
      'plantedtwo',
    ]);
  });

  it('names a trace for every gesture that has one, and uses every trace', () => {
    const used = new Set();

    for (const g of GESTURES) {
      if (g.trace == null) {
        expect(g.noTrace, `${g.id}: a gesture with no trace says why`).to.be.a(
          'string',
        );
      } else {
        expect(TRACES, g.id).to.have.property(g.trace);
        used.add(g.trace);
      }
    }

    for (const [name, trace] of Object.entries(TRACES)) {
      // grab-and-throw is used by its absence: NOT_GESTURES says why
      expect(used.has(name) || name in NOT_GESTURES, name).to.equal(true);
      expect(['real', 'synthetic'], name).to.include(trace.input);

      for (const field of trace.endState) {
        expect(END_STATE, name).to.include(field);
      }
    }
  });

  it('has unique ids', () => {
    const ids = GESTURES.map((g) => g.id);

    expect(new Set(ids).size).to.equal(ids.length);
  });

  it('pins the coverage tallies', () => {
    const browser = GESTURES.filter((g) => g.browser.length > 0);
    const headlessOnly = GESTURES.filter(
      (g) => g.browser.length === 0 && g.headless.length > 0,
    );
    const none = GESTURES.filter(
      (g) => g.browser.length === 0 && g.headless.length === 0,
    );

    expect(
      {
        gestures: GESTURES.length,
        browser: browser.length,
        headlessOnly: headlessOnly.length,
        none: none.length,
      },
      `none: ${none.map((g) => g.id).join(', ')}; headless only: ` +
        headlessOnly.map((g) => g.id).join(', '),
    ).to.deep.equal(PINNED);
  });
});
