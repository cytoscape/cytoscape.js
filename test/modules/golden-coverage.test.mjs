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
  KEYWORD_READBACK,
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
import featureScenes from '../../debug/feature-scenes.js';
import {
  resetInPage,
  resetKeywordInPage,
  restoreInPage,
} from '../../playwright-tests/lib/degrade-control.mjs';

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
// round 80: the charts-heat-bars golden sets chart-domain,
// chart-missing-color and chart-scale (+3 properties in the schema universe).
// round 105: the bundles-wide golden maps edge width off the stroke's
// 1/256 px grid, which read line-outline-width and the edge overlay/
// underlay paddings back as noise — counted as set until the readers
// subtracted the width on the same grid; with that fixed it adds no
// newly exercised property, and the pins stand
const PINNED = {
  universe: 220,
  unexercised: 13,
  paintable: 4,
  noStatic: 9,
  keywordGaps: 12,
  inert: 47,
};

/** Tier 2's pinned counts from the degrade records. */
// Round 80 adds 15 pairs; chart-domain and chart-scale are required by
// the bars/heat in its golden, so the stylesheet rejects their removal.
// round 105: bundles-wide +9 pairs, all nine moving — its line-opacity
// reset moved nothing until an opacity bypass demoted the kernel-owned
// colour it folds into (OPACITY_FOLDS)
const PINNED_DEGRADE = {
  pairs: 1701,
  moved: 1600,
  decoration: 46,
  unmoved: 55,
  exercised: 207,
  seen: 199,
  unseen: 8,
  keywordControls: 233,
  keywordFailures: 0,
  keywordExceptions: 11,
  restoreLimitations: 1,
};

const PINNED_KEYWORD_EXCEPTIONS = [
  'feature-arrows-scalars mid-source-arrow-width=match-line',
  'feature-arrows-scalars mid-target-arrow-width=match-line',
  'feature-charts-bars chart=bar',
  'feature-emphasis-declutter-dimOpacity-0 label-declutter=cull',
  'feature-images-layers background-image-crossorigin=null',
  'feature-images-layers background-image-crossorigin=use-credentials',
  'feature-labels-nodes events=yes',
  'feature-labels-nodes events=no',
  'feature-labels-nodes text-events=yes',
  'feature-labels-nodes text-events=no',
  'feature-paint-outlines outline-style=double',
];

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

  it('keeps transient core paint in the visual universe', () => {
    const { space } = measured;

    expect(NO_STATIC_PIXELS).not.to.have.property('active-bg-color');
    expect(NO_STATIC_PIXELS).not.to.have.property('selection-box-color');
    expect(space.groups.core).to.include('active-bg-color');
    expect(space.groups.core).to.include('selection-box-color');
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
    expect(keywordsOf(schema, 'background-fit')).to.deep.equal([
      'none',
      'contain',
      'cover',
    ]);
    expect(keywordsOf(schema, 'background-clip')).to.deep.equal([
      'none',
      'node',
    ]);
    expect(keywordsOf(schema, 'background-image-containment')).to.deep.equal([
      'inside',
      'over',
    ]);
    expect(keywordsOf(schema, 'background-repeat')).to.deep.equal([
      'no-repeat',
      'repeat-x',
      'repeat-y',
      'repeat',
    ]);
    expect(keywordsOf(schema, 'background-image-type')).to.deep.equal([
      'auto',
      'sdf-icon',
    ]);
    expect(keywordsOf(schema, 'background-image-smoothing')).to.deep.equal([
      'yes',
      'no',
    ]);
    expect(keywordsOf(schema, 'background-image-crossorigin')).to.deep.equal([
      'anonymous',
      'use-credentials',
      'null',
    ]);
    expect(keywordsOf(schema, 'events')).to.deep.equal(['yes', 'no']);
    expect(keywordsOf(schema, 'radius-type')).to.deep.equal([
      'arc-radius',
      'influence-radius',
    ]);
    expect(keywordsOf(schema, 'label-declutter')).to.deep.equal([
      'none',
      'cull',
    ]);
    // a colour is not a keyword property
    expect(keywordsOf(schema, 'background-color')).to.equal(null);
  });

  it('counts core keywords through their resolved renderer codes', () => {
    const { schema, space, defaults } = measured;
    const absent = enumerate([], space, schema, defaults);
    const present = enumerate(
      [{ golden: 'core-cull', core: { 'label-declutter': ['1'] } }],
      space,
      schema,
      defaults,
    );

    expect(KEYWORD_READBACK['label-declutter']).to.deep.equal({
      none: 0,
      cull: 1,
    });
    expect(absent.keywordGaps.core['label-declutter']).to.deep.equal(['cull']);
    expect(present.keywordGaps.core).not.to.have.property('label-declutter');
  });

  it('splits list-valued readbacks into their individual enum values', () => {
    const { schema, space, defaults } = measured;
    const result = enumerate(
      [
        {
          golden: 'image-enums',
          nodes: {
            'background-fit': ['cover contain'],
            'background-image-smoothing': ['no yes'],
          },
        },
      ],
      space,
      schema,
      defaults,
    );

    expect(result.keywordGaps.nodes).not.to.have.property('background-fit');
    expect(result.keywordGaps.nodes).not.to.have.property(
      'background-image-smoothing',
    );
  });

  it('requires exact per-keyword degrade records and moved pixels', () => {
    const capture = {
      golden: 'keyword-control',
      featureCoverage: {
        keywords: [
          {
            group: 'nodes',
            property: 'font-style',
            target: 'n',
            value: 'oblique',
            alternate: 'normal',
          },
        ],
        exceptions: [],
      },
      nodes: {},
      parents: {},
      edges: {},
      core: {},
    };
    const target = capture.featureCoverage.keywords[0];
    const record = {
      golden: capture.golden,
      pairs: {},
      keywords: [{ ...target, matched: 1, changed: 1, moved: 0 }],
    };
    const failed = degradeReport([capture], [record]);

    expect(failed.keywordFailures).to.have.length(1);
    expect(failed.staleKeywords).to.be.empty;

    const clean = degradeReport(
      [capture],
      [
        {
          ...record,
          keywords: [{ ...target, matched: 1, changed: 1, moved: 12 }],
        },
      ],
    );

    expect(clean.keywordFailures).to.be.empty;
    expect(clean.staleKeywords).to.be.empty;

    const normalizedCapture = {
      ...capture,
      golden: 'normalized-keyword-control',
      featureCoverage: {
        keywords: [
          {
            group: 'edges',
            property: 'source-arrow-width',
            target: 'e',
            value: 'match-line',
            resolvedValue: 8,
            alternate: 4,
          },
        ],
        exceptions: [],
      },
    };
    const normalized = normalizedCapture.featureCoverage.keywords[0];
    const exactRestore = degradeReport(
      [normalizedCapture],
      [
        {
          golden: normalizedCapture.golden,
          pairs: {},
          keywords: [
            {
              ...normalized,
              matched: 1,
              changed: 1,
              moved: 12,
              matchedBy: 'authored-declaration-and-resolved-getter',
              restoreMoved: 0,
            },
          ],
        },
      ],
    );

    expect(exactRestore.keywordFailures).to.be.empty;

    const impreciseRestore = degradeReport(
      [normalizedCapture],
      [
        {
          golden: normalizedCapture.golden,
          pairs: {},
          keywords: [
            {
              ...normalized,
              matched: 1,
              changed: 1,
              moved: 12,
              matchedBy: 'authored-declaration-and-resolved-getter',
              restoreMoved: 2,
            },
          ],
        },
      ],
    );

    expect(impreciseRestore.keywordFailures).to.have.length(1);
    expect(impreciseRestore.keywordFailures[0]).to.include(
      'expected exact pixel restore, got 2',
    );
  });

  it('records only the scoped font-style restore residue allowance', () => {
    const limitation = {
      group: 'nodes',
      property: 'font-style',
      target: 'label-left',
      value: 'normal',
      alternate: 'italic',
      observedResiduePixels: 178,
      sourceRefs: [
        'debug/fonts/*.woff2 (four pinned Open Sans faces loaded and fonts.ready)',
      ],
      route: '?network=features&scene=labels&view=nodes',
      reason:
        'A controlled font-style reset restored its readback while a small settled pixel residue remained.',
    };
    const capture = {
      golden: 'feature-labels-nodes',
      featureCoverage: {
        keywords: [
          {
            group: 'nodes',
            property: 'font-style',
            target: 'label-left',
            value: 'normal',
            alternate: 'italic',
          },
        ],
        exceptions: [],
        restoreLimitations: [limitation],
      },
      nodes: {},
      parents: {},
      edges: {},
      core: {},
    };
    const target = capture.featureCoverage.keywords[0];
    const record = {
      golden: capture.golden,
      pairs: {},
      keywords: [
        {
          ...target,
          matched: 1,
          changed: 1,
          moved: 17390,
          restoreMoved: 180,
          residue: 180,
        },
      ],
    };
    const accepted = degradeReport([capture], [record]);

    expect(accepted.keywordFailures).to.be.empty;
    expect(accepted.restoreLimitations).to.deep.equal([
      {
        key: 'feature-labels-nodes nodes/font-style=normal',
        pixels: 180,
        maxPixels: 256,
        moved: 17390,
        matched: 1,
        changed: 1,
        route: limitation.route,
        reason: limitation.reason,
      },
    ]);

    const excessive = degradeReport(
      [capture],
      [
        {
          ...record,
          keywords: [
            { ...record.keywords[0], restoreMoved: 257, residue: 257 },
          ],
        },
      ],
    );
    expect(excessive.keywordFailures).to.have.length(1);
    expect(excessive.keywordFailures[0]).to.include(
      'scoped restore residue must be 0–256 px',
    );
    expect(excessive.restoreLimitations).to.be.empty;

    const zeroMovement = degradeReport(
      [capture],
      [
        {
          ...record,
          keywords: [
            {
              ...record.keywords[0],
              moved: 0,
              restoreMoved: 180,
              residue: 180,
            },
          ],
        },
      ],
    );
    expect(zeroMovement.keywordFailures).to.have.length(1);
    expect(zeroMovement.restoreLimitations).to.be.empty;

    const lostTarget = degradeReport(
      [capture],
      [
        {
          ...record,
          keywords: [{ ...record.keywords[0], lost: ['label-left'] }],
        },
      ],
    );
    expect(lostTarget.keywordFailures).to.have.length(1);
    expect(lostTarget.restoreLimitations).to.be.empty;

    const wrongTarget = degradeReport(
      [
        {
          ...capture,
          featureCoverage: {
            ...capture.featureCoverage,
            restoreLimitations: [{ ...limitation, target: 'other-label' }],
          },
        },
      ],
      [record],
    );
    expect(wrongTarget.keywordFailures).to.have.length(1);
    expect(wrongTarget.restoreLimitations).to.be.empty;

    const wrongGolden = degradeReport(
      [{ ...capture, golden: 'another-golden' }],
      [{ ...record, golden: 'another-golden' }],
    );
    expect(wrongGolden.keywordFailures).to.have.length(1);
    expect(wrongGolden.restoreLimitations).to.be.empty;
  });

  it('resets and restores global fonts and core keywords (control)', () => {
    const cy = cytoscape({
      elements: [{ data: { id: 'n' } }],
      style: {
        nodes: { 'font-style': 'oblique' },
        core: { 'label-declutter': 'cull' },
      },
    });

    globalThis.cy = cy;

    try {
      const core = resetKeywordInPage({
        group: 'core',
        property: 'label-declutter',
        target: null,
        value: 'cull',
        alternate: 'none',
      });

      expect(core).to.include({ matched: 1, changed: 1 });
      expect(cy.style().core().labelDeclutter).to.equal(0);
      expect(restoreInPage()).to.deep.equal([]);
      expect(cy.style().core().labelDeclutter).to.equal(1);

      const font = resetKeywordInPage({
        group: 'nodes',
        property: 'font-style',
        target: 'n',
        value: 'oblique',
        alternate: 'normal',
      });

      expect(font).to.include({ matched: 1, changed: 1 });
      expect(cy.$id('n').style('font-style')).to.equal('normal');
      expect(restoreInPage()).to.deep.equal([]);
      expect(cy.$id('n').style('font-style')).to.equal('oblique');
    } finally {
      delete globalThis.cy;
      cy.destroy();
    }
  });

  it('restores opacity-folded colors through their authored stylesheet (control)', () => {
    const elements = [
      { data: { id: 's' } },
      { data: { id: 't' } },
      { data: { id: 'e', source: 's', target: 't' } },
    ];
    const style = {
      nodes: { width: 30, height: 30 },
      edges: {
        opacity: 0.5,
        'line-opacity': 0.65,
        'target-arrow-shape': 'triangle',
        'target-arrow-color': '#263a4d',
      },
    };
    const cy = cytoscape({ elements, style });
    const original = cy.style().json();
    const before = cy.$id('e').style('target-arrow-color');
    globalThis.cy = cy;
    globalThis.cytoscape = cytoscape;
    globalThis.__goldenSourceScene = {
      elements: {
        nodes: elements.slice(0, 2),
        edges: [elements[2]],
      },
      style,
    };

    try {
      expect(before).to.equal('rgba(38,58,77,0.325)');
      const reset = resetInPage({
        group: 'edges',
        prop: 'target-arrow-color',
        alternates: {},
      });

      expect(reset.changed).to.equal(1);
      expect(restoreInPage()).to.deep.equal([]);
      expect(cy.$id('e').style('target-arrow-color')).to.equal(before);
      expect(cy.style().json()).to.deep.equal(original);
    } finally {
      delete globalThis.__goldenSourceScene;
      delete globalThis.cy;
      delete globalThis.cytoscape;
      cy.destroy();
    }
  });

  it('snapshots group read-backs before resetting any target (control)', () => {
    const elements = [
      { data: { id: 's' } },
      { data: { id: 't' } },
      {
        data: {
          id: 'e0',
          source: 's',
          target: 't',
          opacity: 1,
          lineOpacity: 1,
        },
      },
      {
        data: {
          id: 'e1',
          source: 's',
          target: 't',
          opacity: 0.75,
          lineOpacity: 0.8,
        },
      },
      {
        data: {
          id: 'e2',
          source: 's',
          target: 't',
          opacity: 0.5,
          lineOpacity: 0.65,
        },
      },
    ];
    const actual = cytoscape({
      elements,
      style: {
        edges: {
          opacity: { data: 'opacity', fallback: 1 },
          'line-opacity': { data: 'lineOpacity', fallback: 1 },
          'target-arrow-shape': 'triangle',
          'target-arrow-color': '#263a4d',
        },
      },
    });
    const originals = Object.fromEntries(
      ['e0', 'e1', 'e2'].map((id) => [
        id,
        actual.$id(id).style('target-arrow-color'),
      ]),
    );
    const wrappers = ['e0', 'e1', 'e2'].map((id) => ({
      id: () => id,
      isEdge: () => true,
      isParent: () => false,
      style(prop, value) {
        if (arguments.length === 1) return actual.$id(id).style(prop);

        actual.$id(id).style(prop, value);

        // Model a group recomputation after the first bypass.  Untouched
        // elements now report values from this intermediate pass; the reset
        // must still restore the read-backs captured before that mutation.
        if (id === 'e0' && prop === 'target-arrow-color') {
          actual.$id('e1').style(prop, 'rgba(38,58,77,0.41)');
          actual.$id('e2').style(prop, 'rgba(38,58,77,0.23)');
        }

        return this;
      },
      removeStyle(prop) {
        actual.$id(id).removeStyle(prop);

        if (id === 'e1' && prop === 'target-arrow-color') {
          // Model a transient read-back while sibling bypasses are still
          // being removed; removing the final sibling settles the group.
          actual.$id('e1').style(prop, 'rgba(38,58,77,0.19)');
        }

        if (id === 'e2' && prop === 'target-arrow-color') {
          actual.$id('e1').removeStyle(prop);
        }
      },
    }));
    const facade = {
      edges: () => wrappers,
    };
    globalThis.cy = facade;
    globalThis.cytoscape = cytoscape;

    try {
      const reset = resetInPage({
        group: 'edges',
        prop: 'target-arrow-color',
        alternates: {},
      });

      expect(reset).to.include({ changed: 3, via: 'bypass' });
      expect(globalThis.__degrade.saved.map(({ cur }) => cur)).to.deep.equal(
        ['e0', 'e1', 'e2'].map((id) => originals[id]),
      );
      expect(restoreInPage()).to.deep.equal([]);
      expect(
        Object.fromEntries(
          ['e0', 'e1', 'e2'].map((id) => [
            id,
            actual.$id(id).style('target-arrow-color'),
          ]),
        ),
      ).to.deep.equal(originals);
    } finally {
      delete globalThis.__degrade;
      delete globalThis.__goldenSourceScene;
      delete globalThis.cy;
      delete globalThis.cytoscape;
      actual.destroy();
    }
  });

  it('validates normalized and mapped keyword reset evidence separately', () => {
    const cy = cytoscape({
      elements: [
        { data: { id: 's', transform: 'uppercase' } },
        { data: { id: 't' } },
        { data: { id: 'e-group', source: 's', target: 't' } },
        { data: { id: 'e-bypass', source: 's', target: 't' } },
      ],
      style: {
        nodes: {
          'text-transform': { data: 'transform', fallback: 'none' },
        },
        edges: { width: 8, 'source-arrow-width': 'match-line' },
      },
    });
    cy.$id('e-bypass').style('source-arrow-width', 'match-line');

    globalThis.cy = cy;
    globalThis.__goldenSourceScene = {
      style: {
        nodes: {
          'text-transform': { data: 'transform', fallback: 'none' },
        },
        edges: { width: 8, 'source-arrow-width': 'match-line' },
        bypasses: { 'e-bypass': { 'source-arrow-width': 'match-line' } },
      },
      elements: {
        nodes: [
          { data: { id: 's', transform: 'uppercase' } },
          { data: { id: 't' } },
        ],
        edges: [{ data: { id: 'e-group' } }, { data: { id: 'e-bypass' } }],
      },
    };

    try {
      const groupArrow = resetKeywordInPage({
        group: 'edges',
        property: 'source-arrow-width',
        target: 'e-group',
        value: 'match-line',
        resolvedValue: 8,
        alternate: 4,
      });

      expect(groupArrow).to.include({
        matched: 1,
        changed: 1,
        matchedBy: 'authored-declaration-and-resolved-getter',
      });
      expect(cy.$id('e-group').style('source-arrow-width')).to.equal(4);
      expect(restoreInPage()).to.deep.equal([]);
      expect(cy.$id('e-group').style('source-arrow-width')).to.equal(8);
      expect(
        cy.style().json().bypasses?.['e-group']?.['source-arrow-width'],
      ).to.equal(undefined);

      const bypassArrow = resetKeywordInPage({
        group: 'edges',
        property: 'source-arrow-width',
        target: 'e-bypass',
        value: 'match-line',
        resolvedValue: 8,
        alternate: 4,
      });

      expect(bypassArrow).to.include({
        matched: 1,
        changed: 1,
        matchedBy: 'authored-declaration-and-resolved-getter',
      });
      expect(cy.$id('e-bypass').style('source-arrow-width')).to.equal(4);
      expect(restoreInPage()).to.deep.equal([]);
      expect(cy.$id('e-bypass').style('source-arrow-width')).to.equal(8);
      expect(
        cy.style().json().bypasses['e-bypass']['source-arrow-width'],
      ).to.equal('match-line');

      globalThis.__goldenSourceScene.style.bypasses['e-bypass'][
        'source-arrow-width'
      ] = 8;
      cy.$id('e-bypass').style('source-arrow-width', 8);
      const falseArrowAlias = resetKeywordInPage({
        group: 'edges',
        property: 'source-arrow-width',
        target: 'e-bypass',
        value: 'match-line',
        resolvedValue: 8,
        alternate: 4,
      });

      expect(falseArrowAlias.matched).to.equal(0);
      expect(falseArrowAlias.unexpected).to.equal(8);
      expect(restoreInPage()).to.deep.equal([]);
      expect(cy.$id('e-bypass').style('source-arrow-width')).to.equal(8);

      const limitation = {
        property: 'text-transform',
        mappedValue: 'uppercase',
        getterValue: 'none',
        sourceRefs: ['src/style/readers-labels.mts:44,85'],
        reason: 'the mapper reader returns its fallback',
      };
      const mapped = resetKeywordInPage({
        group: 'nodes',
        property: 'text-transform',
        target: 's',
        value: 'uppercase',
        resolvedValue: 'none',
        readbackLimitation: limitation,
        alternate: 'lowercase',
      });

      expect(mapped).to.include({
        matched: 1,
        changed: 1,
        matchedBy: 'authored-mapper-and-documented-getter-fallback',
      });
      expect(cy.style().json().bypasses.s['text-transform']).to.equal(
        'lowercase',
      );
      expect(restoreInPage()).to.deep.equal([]);
      expect(cy.$id('s').style('text-transform')).to.equal('none');
      expect(cy.$id('s').data('transform')).to.equal('uppercase');

      const incorrect = resetKeywordInPage({
        group: 'nodes',
        property: 'text-transform',
        target: 's',
        value: 'lowercase',
        resolvedValue: 'none',
        readbackLimitation: { ...limitation, mappedValue: 'lowercase' },
        alternate: 'uppercase',
      });

      expect(incorrect.matched).to.equal(0);
      expect(incorrect.unexpected).to.include('authored mapper');
      expect(restoreInPage()).to.deep.equal([]);
      expect(cy.$id('s').data('transform')).to.equal('uppercase');
    } finally {
      delete globalThis.__goldenSourceScene;
      delete globalThis.cy;
      cy.destroy();
    }
  });

  it('resets parent-only styles in the parent sheet and falls back when a bypass is rejected (control)', () => {
    const cy = cytoscape({
      elements: [
        { data: { id: 'p' } },
        { data: { id: 'c', parent: 'p' } },
        { data: { id: 'n' } },
      ],
      style: {
        nodes: { 'font-weight': 700, width: 24 },
        parents: { padding: 14, 'background-color': '#ffeecc' },
      },
    });
    const original = cy.style().json();
    globalThis.cy = cy;
    globalThis.cytoscape = cytoscape;

    try {
      const parent = resetInPage({
        group: 'parents',
        prop: 'padding',
        alternates: {},
      });

      expect(parent).to.include({ changed: 1, via: 'sheet' });
      expect(parent.unresettable).to.deep.equal([]);
      expect(cy.$id('p').style('padding')).to.equal(10);
      expect(cy.$id('p').style('background-color')).to.equal(
        'rgb(255,238,204)',
      );
      expect(restoreInPage()).to.deep.equal([]);
      expect(cy.style().json()).to.deep.equal(original);
      expect(cy.$id('p').style('padding')).to.equal(14);

      const rejectedBypass = resetInPage({
        group: 'nodes',
        prop: 'font-weight',
        alternates: {},
      });

      expect(rejectedBypass).to.include({ changed: 3, via: 'sheet' });
      expect(rejectedBypass.unresettable).to.deep.equal([]);
      expect(cy.$id('n').style('font-weight')).to.equal('normal');
      expect(restoreInPage()).to.deep.equal([]);
      expect(cy.style().json()).to.deep.equal(original);
      expect(cy.$id('n').style('font-weight')).to.equal('700');

      const percentSheet = {
        ...original,
        parents: {
          ...original.parents,
          padding: '18%',
          'padding-relative-to': 'width',
        },
      };
      cy.style(percentSheet);
      globalThis.__goldenSourceScene = {
        style: { parents: percentSheet.parents },
        elements: {
          nodes: [
            { data: { id: 'p' } },
            { data: { id: 'c', parent: 'p' } },
            { data: { id: 'n' } },
          ],
          edges: [],
        },
      };
      const percentageOriginal = cy.style().json();
      const referenceControl = resetKeywordInPage({
        group: 'parents',
        property: 'padding-relative-to',
        target: 'p',
        value: 'width',
        alternate: 'height',
      });

      expect(referenceControl).to.include({ matched: 1, changed: 1 });
      expect(cy.$id('p').style('padding-relative-to')).to.equal('height');
      expect(cy.$id('p').style('padding')).to.equal('18%');
      expect(restoreInPage()).to.deep.equal([]);
      expect(cy.style().json()).to.deep.equal(percentageOriginal);
    } finally {
      delete globalThis.__goldenSourceScene;
      delete globalThis.cy;
      delete globalThis.cytoscape;
      cy.destroy();
    }
  });
});

describe('golden coverage: the degrade control (round 143)', function () {
  const captures = loadCaptures();
  const degrades = loadDegrades();
  const report = degradeReport(captures, degrades);

  it('has a current degrade record for every golden', () => {
    expect(degrades.length).to.equal(captures.length);
    expect(
      {
        stale: report.stale,
        staleKeywords: report.staleKeywords,
        missing: report.missing,
        stopped: report.stopped,
      },
      'rerun the golden pass with DEGRADE_CONTROL=1 and commit ' +
        'playwright-tests/golden-degrade/',
    ).to.deep.equal({
      stale: [],
      staleKeywords: [],
      missing: [],
      stopped: [],
    });

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

  it('requires every keyword target to change a pixel or name an exception', () => {
    expect(report.keywordFailures).to.be.empty;
    expect(report.keywordExceptions).to.deep.equal(PINNED_KEYWORD_EXCEPTIONS);

    const capturesByName = new Map(
      loadCaptures().map((capture) => [capture.golden, capture]),
    );
    for (const record of degrades) {
      const capture = capturesByName.get(record.golden);
      const authoredRows = [
        ...(capture.featureCoverage?.keywords ?? []),
        ...(capture.featureCoverage?.exceptions ?? []),
      ];

      for (const entry of record.keywords ?? []) {
        if (entry.reason == null && entry.exception == null) continue;

        const authored = authoredRows.find(
          (row) =>
            row.group === entry.group &&
            row.property === entry.property &&
            row.target === entry.target &&
            row.value === entry.value &&
            row.alternate === entry.alternate,
        );

        expect(
          authored?.reason,
          `${record.golden} ${entry.group}/${entry.property}=${entry.value} ` +
            'must keep an exact authored exception with a reason',
        ).to.be.a('string').and.not.empty;
        expect(entry.reason ?? entry.exception).to.equal(authored.reason);
      }
    }
  });

  it('resets chart domains through the authored stylesheet (control)', () => {
    const cy = cytoscape({
      elements: [{ data: { id: 'chart', values: [-4, 0, 2, 5] } }],
      style: {
        nodes: {
          chart: 'bar',
          'chart-values': { data: 'values' },
          'chart-domain': ['auto', 'auto'],
        },
      },
    });
    const original = cy.style().json();

    globalThis.cy = cy;
    globalThis.__goldenSourceScene = {
      style: {
        nodes: {
          chart: 'bar',
          'chart-values': { data: 'values' },
          'chart-domain': ['auto', 'auto'],
        },
      },
      elements: {
        nodes: [{ data: { id: 'chart', values: [-4, 0, 2, 5] } }],
        edges: [],
      },
    };

    try {
      const result = resetKeywordInPage({
        group: 'nodes',
        property: 'chart-domain',
        target: 'chart',
        value: 'auto',
        resolvedValue: 'auto auto',
        controlMode: 'stylesheet',
        alternate: [-5, 6],
      });

      expect(result).to.include({
        matched: 1,
        changed: 1,
        controlMode: 'stylesheet',
        matchedBy: 'authored-declaration-and-stylesheet-readback',
      });
      expect(cy.$id('chart').style('chart-domain')).to.equal('-5 6');
      expect(restoreInPage()).to.deep.equal([]);
      expect(cy.style().json()).to.deep.equal(original);
      expect(cy.$id('chart').style('chart-domain')).to.equal('auto auto');
    } finally {
      delete globalThis.__goldenSourceScene;
      delete globalThis.cy;
      cy.destroy();
    }
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
  const run = (options, prepare) => {
    const cy = cytoscape(options);

    globalThis.cy = cy;
    globalThis.cytoscape = cytoscape;

    try {
      prepare?.(cy);
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

  it('does not count packed hull references as authored node geometry', () => {
    const scene = featureScenes.create('compounds', 'hulls');
    const hullIds = ['hull-convex', 'hull-round', 'hull-concave'];
    const elements = {
      nodes: [
        ...scene.elements.nodes,
        { data: { id: 'custom-polygon' }, position: { x: 520, y: 180 } },
      ],
      edges: scene.elements.edges,
    };
    const style = {
      ...scene.style,
      bypasses: {
        ...scene.style.bypasses,
        'custom-polygon': {
          shape: 'polygon',
          'shape-polygon-points': [0, -1, 1, 1, -1, 1],
        },
      },
    };
    const out = run({ elements, style }, (cy) => {
      // Hull geometry writes its polygon-pool reference into the radius
      // word and polygon-points reader. Resolve it first so the public
      // getters expose the same packed values the browser capture sees.
      for (const id of hullIds) cy.$id(id).boundingBox();
      cy.$id('hull-outside').style('corner-radius', 14);
      cy.$id('custom-polygon').boundingBox();
    });

    expect(out.nodes['corner-radius']).to.deep.equal(['14']);
    expect(out.nodes['shape-polygon-points']).to.deep.equal(['0 -1 1 1 -1 1']);
    expect(out.parents['corner-radius']).to.equal(undefined);
    expect(out.parents['shape-polygon-points']).to.equal(undefined);
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
