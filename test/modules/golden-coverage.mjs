import { expect } from 'chai';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import cytoscape from '../../src/index.mjs';
import {
  ALIASES,
  COVERAGE_DIR,
  DEGRADE_DIR,
  GROUPS,
  INTENDED_DECORATION,
  NO_STATIC_PIXELS,
  UNMOVABLE,
  degradeReport,
  enumerate,
  goldenNames,
  keywordsOf,
  loadCaptures,
  loadDegrades,
  measure,
  pairing,
  pairsOf,
} from '../../scripts/golden-coverage.mjs';
import {
  collectStyleCoverage,
  COMPOUND_PROPS,
  MAX_VALUES,
} from '../../playwright-tests/lib/style-coverage.mjs';

/*
Round 135 (item 30, tier 1): the golden-coverage enumerator, gated.

The count is the one the item asked for — the style properties for which
no visual golden sets a non-default value — read from the per-golden
records the visual project writes and holds to its scenes
(`playwright-tests/golden-coverage/`), against the universe the stylesheet
schema enumerates and each group reads back.  It is pinned exactly, in
both directions, the way `bundle-size.mjs` pins a ratchet: a golden that
adds coverage lowers the pin in the same commit, a scene edit that drops
coverage fails here, and a new style property arrives unexercised and
raises the count until a golden draws it.  The SVG-export (round 77) and
WebGL (round 73) parity work is held to the paintable list this prints.

Measured at landing (2026-09-29, 50 goldens): **137 / 212** properties
exercised, **75 never set** — 56 paintable, 19 that no static golden can
show (pointer behaviour, transition config, press and box-select chrome,
the image fetch mode) — and **67** non-default keywords never shown.  The
schema lists 45 further cross-group names (`line-color` on a node, `shape`
on an edge) that the compiler accepts and nothing reads; they are inert,
reported, and not counted.

Tier 2 — the degrade control, which asks whether an exercised property
moves any pixels — landed in round 143: every golden's exercised pairs
reset to the default on the live scene, the moved pixels recorded in
`playwright-tests/golden-degrade/`, read and pinned below.  At landing:
539 pairs (530 at round 143), 529 moving pixels, 3 decoration by design, 7 that no reset
can move (a value derived from another property); 131 of the 140
exercised group-properties move pixels in some golden.
*/

/** The pinned counts; change them only with the capture that moves them. */
// round 76: mid-*-arrow-width (+2, no-static — mid heads are always
// filled — and +2 inert on nodes) and text-border-style (+2) arrive;
// the label-border-styles golden sets all four, and with them the
// edge label box (text-border-width/-opacity, text-background-shape,
// text-margin-y) and text-background-shape's round-rectangle on edges
// round 143: the degrade control's findings corrected the capture —
// five image properties that read back as the default once per layer
// (`node node node node`) are no longer counted as set, nor are the
// label-box colours a labelled element reads with their opacity folded
// in, nor a parent's auto-sized width and height (+5 unexercised, all
// paintable: background-clip, -image-containment, -image-smoothing,
// -offset-x, -repeat)
// round 105: the bundles-wide golden maps edge width off the stroke's
// 1/256 px grid, which read line-outline-width and the edge overlay/
// underlay paddings back as noise — counted as set until the readers
// subtracted the width on the same grid; with that fixed it adds no
// newly exercised property, and the pins stand
const PINNED = {
  universe: 216,
  unexercised: 76,
  paintable: 57,
  noStatic: 19,
  keywordGaps: 63,
  inert: 47,
};

/** Tier 2's pinned counts (round 143), from the degrade records. */
// round 105: bundles-wide +9 pairs, all nine moving — its line-opacity
// reset moved nothing until an opacity bypass demoted the kernel-owned
// colour it folds into (OPACITY_FOLDS)
const PINNED_DEGRADE = {
  pairs: 539,
  moved: 529,
  decoration: 3,
  unmoved: 7,
  exercised: 140,
  seen: 131,
  unseen: 9,
};

describe('golden coverage: the enumerator (round 135)', function () {
  let measured;

  before(async () => {
    measured = await measure();
  });

  it('has a record for every golden and a golden for every record', () => {
    const captures = loadCaptures();
    const names = goldenNames();

    // the walk's size: a directory that silently lost its files would
    // agree with nothing and pass everything below
    expect(names.length).to.be.at.least(50);
    expect(captures.length).to.equal(names.length);
    expect(pairing(captures, names)).to.deep.equal({
      missing: [],
      orphans: [],
      misnamed: 0,
    });

    const files = readdirSync(COVERAGE_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort();

    expect(files).to.deep.equal(captures.map((c) => `${c.golden}.json`));
  });

  it('pairing catches a golden without a record and a stale record (control)', () => {
    const captures = loadCaptures();
    const names = goldenNames();

    expect(pairing(captures.slice(1), names).missing).to.deep.equal([
      captures[0].golden,
    ]);
    expect(
      pairing([...captures, { golden: 'no-such-golden' }], names).orphans,
    ).to.deep.equal(['no-such-golden']);
  });

  it('records only properties the universe holds', () => {
    expect(measured.result.unknown).to.deep.equal([]);
  });

  it('pins the unexercised count (the tier-1 number)', () => {
    const { counts, paintable } = measured.result;
    const list = GROUPS.map((g) => `${g}: ${paintable[g].join(', ')}`).join(
      '\n',
    );

    expect(
      {
        universe: counts.universe,
        unexercised: counts.unexercised,
        paintable: counts.paintable,
        noStatic: counts.noStatic,
        keywordGaps: counts.keywordGaps,
        inert: counts.inert,
      },
      `the golden-coverage counts moved; the paintable gaps are now\n${list}\n` +
        'Update PINNED in the same commit as the capture that moved them.',
    ).to.deep.equal(PINNED);
  });

  it('counts a property as unexercised once its only golden is gone (control)', () => {
    const captures = loadCaptures();
    const { space, schema, defaults, result } = measured;

    // a property exactly one golden exercises: drop that golden's record
    // and the enumerator must see the gap open
    const [group, prop, golden] = GROUPS.flatMap((g) =>
      Object.entries(result.exercised[g])
        .filter(([, goldens]) => goldens.length === 1)
        .map(([p, goldens]) => [g, p, goldens[0]]),
    )[0];
    const dropped = enumerate(
      captures.filter((c) => c.golden !== golden),
      space,
      schema,
      defaults,
    );

    expect(dropped.unexercised[group]).to.include(prop);
    expect(dropped.counts.unexercised).to.be.greaterThan(
      result.counts.unexercised,
    );
  });

  it('reports a recorded property outside the universe (control)', () => {
    const captures = loadCaptures();
    const { space, schema, defaults } = measured;
    const planted = [
      { golden: 'planted', nodes: { 'line-color': ['rgb(1,2,3)'] } },
      ...captures,
    ];

    expect(enumerate(planted, space, schema, defaults).unknown).to.deep.equal([
      'planted: nodes line-color',
    ]);
  });

  it('builds its universe from the schema, split by what each group reads', () => {
    const { space } = measured;

    expect(space.groups.core).to.have.length(9);
    expect(space.groups.parents).to.deep.equal([...COMPOUND_PROPS].sort());
    // the inert split is the engine's: a node never reads an edge's
    // line, an edge never reads a node's shape
    expect(space.inert.nodes).to.include('line-color');
    expect(space.inert.edges).to.include('shape');
    expect(space.groups.nodes).to.include('background-color');
    expect(space.groups.edges).to.include('line-color');

    for (const group of ['nodes', 'edges']) {
      for (const prop of space.inert[group]) {
        expect(space.groups[group], `${group} ${prop}`).not.to.include(prop);
      }
    }
  });

  it('holds its no-static-pixels table to the universe', () => {
    const all = new Set(GROUPS.flatMap((g) => measured.space.groups[g]));

    for (const [prop, reason] of Object.entries(NO_STATIC_PIXELS)) {
      expect(all.has(prop), `${prop} is not a style property`).to.equal(true);
      expect(reason.length, prop).to.be.greaterThan(20);
    }
  });

  it('holds its keyword aliases to what a sheet reads back', () => {
    const { schema } = measured;

    for (const [prop, table] of Object.entries(ALIASES)) {
      const group = prop.includes('arrow') ? 'edges' : 'nodes';

      for (const [alias, target] of Object.entries(table)) {
        expect(keywordsOf(schema, prop), prop).to.include(alias);

        const cy = cytoscape({
          elements: [
            { data: { id: 'a' } },
            { data: { id: 'b' } },
            { data: { id: 'e', source: 'a', target: 'b' } },
          ],
          style: { [group]: { [prop]: alias } },
        });

        expect(
          cy.$id(group === 'edges' ? 'e' : 'a').style(prop),
          `${prop}: ${alias}`,
        ).to.equal(target);
        cy.destroy();
      }
    }
  });

  it('reads the keyword vocabulary from the schema', () => {
    const { schema } = measured;

    expect(keywordsOf(schema, 'shape')).to.include('concave-hexagon');
    expect(keywordsOf(schema, 'curve-style')).to.include('taxi');
    expect(keywordsOf(schema, 'label-declutter')).to.deep.equal([
      'none',
      'cull',
    ]);
    // a colour is not a keyword property
    expect(keywordsOf(schema, 'background-color')).to.equal(null);
  });
});

describe('golden coverage: the degrade control (round 143)', function () {
  const captures = loadCaptures();
  const degrades = loadDegrades();
  const report = degradeReport(captures, degrades);

  it('has a current degrade record for every golden', () => {
    expect(degrades.length).to.equal(captures.length);
    expect(
      { stale: report.stale, missing: report.missing, stopped: report.stopped },
      'rerun the golden pass with DEGRADE_CONTROL=1 and commit ' +
        'playwright-tests/golden-degrade/',
    ).to.deep.equal({ stale: [], missing: [], stopped: [] });

    const files = readdirSync(DEGRADE_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort();

    expect(files).to.deep.equal(captures.map((c) => `${c.golden}.json`));
  });

  it('pins the counts (the tier-2 numbers)', () => {
    expect(
      report.counts,
      `decoration: ${report.decoration.join(', ')}; unmovable: ` +
        report.unmoved.map((u) => u.key).join(', '),
    ).to.deep.equal(PINNED_DEGRADE);
  });

  it('argues for every pair that moves no pixel', () => {
    // a decoration pair is either fixed in its scene or argued for in
    // INTENDED_DECORATION; an unmovable one names why no reset moves it
    expect(report.decoration.filter((k) => !(k in INTENDED_DECORATION))).to.be
      .empty;
    expect(
      Object.keys(INTENDED_DECORATION).filter(
        (k) => !report.decoration.includes(k),
      ),
      'stale INTENDED_DECORATION entries',
    ).to.be.empty;
    expect(report.unmoved.filter((u) => !(u.prop in UNMOVABLE))).to.be.empty;
    expect(
      Object.keys(UNMOVABLE).filter(
        (p) => !report.unmoved.some((u) => u.prop === p),
      ),
      'stale UNMOVABLE entries',
    ).to.be.empty;
  });

  it('classifies a planted record, and catches a stale one (control)', () => {
    const capture = captures.find((c) => c.golden === 'nodes-edges-arrows');
    const record = degrades.find((d) => d.golden === capture.golden);
    const pair = pairsOf(capture)[0];
    const planted = {
      ...record,
      pairs: { ...record.pairs, [pair]: { moved: 0, elements: 4 } },
    };
    const one = degradeReport([capture], [planted]);

    expect(one.decoration).to.deep.equal([`${capture.golden} ${pair}`]);

    const unmoved = degradeReport(
      [capture],
      [
        {
          ...record,
          pairs: {
            ...record.pairs,
            [pair]: {
              moved: 0,
              elements: 4,
              unresettable: ['a', 'b', 'c', 'd'],
            },
          },
        },
      ],
    );

    expect(unmoved.unmoved.map((u) => u.key)).to.deep.equal([
      `${capture.golden} ${pair}`,
    ]);

    const { [pair]: _dropped, ...fewer } = record.pairs;

    expect(
      degradeReport([capture], [{ ...record, pairs: fewer }]).stale,
    ).to.deep.equal([capture.golden]);
  });
});

describe('golden coverage: the capture (round 135)', function () {
  const run = (options) => {
    const cy = cytoscape(options);

    globalThis.cy = cy;
    globalThis.cytoscape = cytoscape;

    try {
      return collectStyleCoverage({
        compound: COMPOUND_PROPS,
        maxValues: MAX_VALUES,
      });
    } finally {
      delete globalThis.cy;
      delete globalThis.cytoscape;
      cy.destroy();
    }
  };

  const elements = [
    { data: { id: 'p' } },
    { data: { id: 'c', parent: 'p', kind: 'x' } },
    { data: { id: 'n', kind: 'y' } },
    { data: { id: 'e', source: 'c', target: 'n' } },
  ];

  it('records exactly the non-default properties, per group', () => {
    const out = run({
      elements,
      style: {
        nodes: {
          'border-width': 2,
          // resolves to the leaf default for every leaf: nothing moved
          'background-color': {
            case: [{ when: { data: 'kind', eq: 'x' }, then: '#999' }],
            else: '#999',
          },
        },
        // the nodes block reaches the parent too; restoring v3's :parent
        // fill here leaves it at its own default
        parents: { padding: 4, 'background-color': '#eee' },
        edges: { 'line-style': 'dashed' },
        core: { 'dim-opacity': 0.5 },
      },
    });

    expect(out.elements).to.deep.equal({ nodes: 2, parents: 1, edges: 1 });
    // the parent reads border-width 2 as well; its default is 1
    expect(out.nodes).to.deep.equal({ 'border-width': ['2'] });
    expect(out.parents).to.deep.equal({
      padding: ['4'],
      'padding-bottom': ['4'],
      'padding-left': ['4'],
      'padding-right': ['4'],
      'padding-top': ['4'],
    });
    expect(out.edges).to.deep.equal({ 'line-style': ['dashed'] });
    expect(out.core).to.deep.equal({ 'dim-opacity': ['0.5'] });
  });

  it('judges a parent against the parent defaults, not a leaf’s (control)', () => {
    // v3's :parent defaults: a parent is a grey rectangle with a border;
    // judged as a leaf, an untouched parent would read as exercising
    // shape, background-color, border-width and border-color
    const out = run({ elements });

    expect(out).to.deep.equal({
      elements: { nodes: 2, parents: 1, edges: 1 },
      nodes: {},
      parents: {},
      edges: {},
      core: {},
    });
  });

  it('does not count what reads back derived from something else (round 143)', () => {
    // the three over-counts the degrade control exposed: a labelled
    // element's label-box colours (read with their opacity folded in), a
    // parent's auto-sized box, and a per-image list of defaults
    const out = run({
      elements: [
        { data: { id: 'p' } },
        { data: { id: 'c1', parent: 'p' }, position: { x: -80, y: 0 } },
        { data: { id: 'c2', parent: 'p' }, position: { x: 80, y: 60 } },
        { data: { id: 'n' }, position: { x: 300, y: 0 } },
        { data: { id: 'e', source: 'c1', target: 'n' } },
      ],
      style: {
        nodes: {
          label: 'x',
          'background-image': ['a.png', 'b.png', 'c.png'],
        },
        edges: { label: 'y' },
      },
    });

    expect(Object.keys(out.nodes).sort()).to.deep.equal([
      'background-image',
      'label',
    ]);
    expect(Object.keys(out.edges)).to.deep.equal(['label']);

    // and each is still counted when it is set (control)
    const set = run({
      elements: [{ data: { id: 'n' } }],
      style: {
        nodes: {
          label: 'x',
          'text-background-color': '#f00',
          'background-image': ['a.png', 'b.png'],
          'background-clip': ['none', 'node'],
        },
      },
    });

    expect(set.nodes).to.have.property('text-background-color');
    expect(set.nodes).to.have.property('background-clip');
  });

  it('cuts a long value list and counts the rest', () => {
    const many = Array.from({ length: MAX_VALUES + 3 }, (_, i) => ({
      data: { id: `n${i}`, w: 100 + i },
    }));
    const out = run({
      elements: many,
      style: { nodes: { width: { data: 'w' } } },
    });

    expect(out.nodes.width).to.have.length(MAX_VALUES + 1);
    expect(out.nodes.width[MAX_VALUES]).to.equal('…+3');
  });

  it('agrees with the checked-in record format', () => {
    const record = JSON.parse(
      readFileSync(join(COVERAGE_DIR, 'nodes-edges-arrows.json'), 'utf8'),
    );

    expect(Object.keys(record).sort()).to.deep.equal(
      ['golden', 'elements', ...GROUPS].sort(),
    );
    expect(record.nodes.shape).to.deep.equal(['rectangle', 'round-rectangle']);
  });
});
