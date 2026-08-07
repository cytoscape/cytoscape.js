import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import cytoscape from '../../src/index.mjs';

/*
Round 47: the migration guide's property table, checked against the library.

`MIGRATING.md` tells an upgrading reader which v3 style properties v4
rejects and what to write instead. That is the highest-drift documentation
in the repo — it is a claim about runtime behaviour, made in prose, in a
file no test would otherwise open — and this repo has been bitten by exactly
that shape before: round 31.1 found the per-element bypass *error message*
advising a form v4 rejects, while the markdown had been right all along.
Here the risk runs the other way round.

So the table verifies itself. Every property named in its left column must
actually be rejected, and every replacement named in the prose must actually
compile. What is deliberately not checked is the v3 half of the counts: v3
is frozen, loading it costs seconds, and the numbers were measured once
against its real registry. The arithmetic between them is checked instead,
which is what catches a careless edit.
*/

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const GUIDE = readFileSync(join(ROOT, 'MIGRATING.md'), 'utf8');

/** The "Style properties that moved" table, as raw markdown rows. */
function propertyTableRows() {
  const start = GUIDE.indexOf('## Style properties that moved');
  const end = GUIDE.indexOf('\n## ', start + 1);

  expect(
    start,
    'the property-table section is gone from MIGRATING.md',
  ).to.be.greaterThan(-1);

  return GUIDE.slice(start, end)
    .split('\n')
    .filter((line) => line.startsWith('| `'));
}

/** Property names look like `background-blacken`, not `ele.position()`. */
const PROP_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function backticked(cell) {
  return [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
}

/** Whether v4's sheet knows a property name at all, in any group. */
function nameKnown(cy, name) {
  const unknown = /The (core )?style property '[^']*' is unsupported/;

  for (const group of ['nodes', 'edges', 'parents', 'core']) {
    for (const value of [1, 'none', '#ff0000', [1, 2]]) {
      try {
        cy.style({ [group]: { [name]: value } });

        return true;
      } catch (e) {
        // an invalid *value* still proves the name is known
        if (!unknown.test(String(e.message))) return true;
      }
    }
  }

  return false;
}

describe('the migration guide: the property table', () => {
  let cy;
  let rows;

  before(() => {
    cy = cytoscape({ elements: [] });
    rows = propertyTableRows();
  });

  after(() => cy.destroy());

  it('has a table to check', () => {
    // Without this every other spec here passes vacuously — the failure the
    // repo keeps re-learning (round 36.1's fixtures, round 39.1's overlap
    // specs) is a check that runs over nothing.
    expect(rows.length).to.be.greaterThan(15);
  });

  it('names only properties v4 actually rejects', () => {
    for (const row of rows) {
      const [, left] = row.split('|');

      for (const name of backticked(left)) {
        if (!PROP_NAME.test(name)) continue;
        // the numbered families are written with a wildcard in the table
        if (name.includes('*')) continue;

        expect(
          nameKnown(cy, name),
          `MIGRATING.md says v4 dropped '${name}', but the sheet accepts it`,
        ).to.equal(false);
      }
    }
  });

  it('names replacements v4 actually accepts', () => {
    // The right column mixes property names with option and method names, so
    // this is an explicit list of the *style* replacements the table promises.
    const replacements = [
      ['nodes', 'label'],
      ['nodes', 'visibility'],
      ['nodes', 'chart'],
      ['nodes', 'chart-values'],
      ['nodes', 'chart-colors'],
      ['nodes', 'chart-size'],
      ['nodes', 'chart-hole'],
      ['nodes', 'chart-start-angle'],
      ['nodes', 'chart-direction'],
      ['nodes', 'min-width'],
      ['nodes', 'min-height'],
      ['nodes', 'events'],
      ['parents', 'padding'],
      ['edges', 'text-rotation'],
      ['edges', 'control-point-distances'],
      ['edges', 'segment-distances'],
      ['edges', 'segment-weights'],
      ['edges', 'segment-radii'],
    ];

    for (const [, name] of replacements) {
      expect(
        nameKnown(cy, name),
        `MIGRATING.md offers '${name}' as a replacement, but v4 rejects it`,
      ).to.equal(true);
    }
  });

  it('keeps the no-dash shape spellings rejected in all three enums', () => {
    // The guide says so explicitly, and round 37.2 is why: dropping it from
    // `shape` alone would have moved the inconsistency rather than closed it.
    for (const prop of ['shape', 'overlay-shape', 'text-background-shape']) {
      expect(
        () => cy.style({ nodes: { [prop]: 'roundrectangle' } }),
        `${prop} still accepts 'roundrectangle'`,
      ).to.throw();
    }
  });

  it('quotes counts that add up', () => {
    // The v3 side is frozen and measured once; what can rot is the prose
    // around it, so the arithmetic is the check.
    const registered = Number(
      GUIDE.match(/registers \*\*(\d+)\*\* property names/)[1],
    );
    const accepted = Number(
      GUIDE.match(/accepts\s*\n?\*\*(\d+)\*\* of them/)[1],
    );
    const rejected = Number(GUIDE.match(/rejects \*\*(\d+)\*\*/)[1]);
    const numbered = Number(GUIDE.match(/(\d+) are v3's numbered/)[1]);
    const remaining = Number(GUIDE.match(/The remaining (\d+)/)[1]);

    expect(
      accepted + rejected,
      'accepted + rejected must be the registered total',
    ).to.equal(registered);
    expect(
      numbered + remaining,
      'numbered + remaining must be the rejected total',
    ).to.equal(rejected);
    expect(
      rows.length,
      'the table should carry the remaining rejections',
    ).to.be.greaterThan(15);
  });
});

describe('the migration guide: behavioural claims', () => {
  let cy;

  before(() => {
    cy = cytoscape({
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 100, y: 0 } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
      ],
    });
  });

  after(() => cy.destroy());

  it('still has the defaults the guide tells readers to re-check', () => {
    // Each of these is in the "Behaviour to re-check" table as a v3-to-v4
    // *difference*; if a default ever moves back, the guide is wrong in the
    // most confusing possible way — it would be warning about a change that
    // did not happen.
    expect(cy.$id('ab').style('curve-style')).to.equal('straight');
    expect(cy.$id('a').style('text-valign')).to.equal('bottom');
    expect(cy.elements().map((e) => e.id())).to.deep.equal(['a', 'b', 'ab']);
  });

  it('still rejects `cose`, listing the built-ins the guide names', () => {
    expect(() => cy.layout({ name: 'cose' })).to.throw(/grid/);

    for (const name of [
      'grid',
      'preset',
      'circle',
      'concentric',
      'breadthfirst',
      'random',
      'force',
    ]) {
      expect(
        () => cy.layout({ name }),
        `${name} should be built in`,
      ).to.not.throw();
    }
  });

  it('still has no classes and no cy.$', () => {
    expect(cy.$).to.equal(undefined);

    for (const m of [
      'addClass',
      'removeClass',
      'toggleClass',
      'hasClass',
      'flashClass',
    ]) {
      expect(cy.$id('a')[m], m).to.equal(undefined);
    }
  });
});
