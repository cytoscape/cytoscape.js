import { expect } from 'chai';
import cytoscape from '../../src/index.mjs';
import {
  installAdvanceReader,
  measureBlock,
  MEASURE_PX,
} from '../../src/label-measure.mjs';
import { estimateBlock } from '../../src/label-wrap.mjs';

// Round 125.1: label dims are measured, not estimated, wherever
// advances can be read — so a layout that runs before the first frame
// separates the boxes the frame will draw.  Headless Node has no
// canvas, so the specs install a reader: a font whose glyphs are
// wider than the flat 0.54 em estimate, the way real fonts' 'm' and
// 'w' are, which is what put 14 overlapping label pairs on em-web
// after a load-time force run.  The control is the defect's own
// shape: lay out on estimates, then let the "frame" upgrade the dims,
// and the boxes overlap.

/** a reader whose every glyph advances 0.8 em: 48% wider than the estimate */
const WIDE = () => (ch) => (ch === ' ' ? 0.28 : 0.8) * MEASURE_PX;

const OPTS = {
  wrap: 0,
  maxWidth: 0,
  overflowWrap: 0,
  justification: 0,
  lineHeight: 1.1,
};

const overlapPairs = (nodes) => {
  const boxes = nodes.map((n) => n.boundingBox({ includeLabels: true }));
  let k = 0;

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];

      if (a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2) {
        k++;
      }
    }
  }

  return k;
};

describe('label-measure: exact label dims before the first frame (125.1)', function () {
  afterEach(() => installAdvanceReader(null));

  it('returns null with no reader (headless), and the measured block with one', function () {
    installAdvanceReader(() => null);
    expect(
      measureBlock('label', 10, OPTS, {
        family: 'x',
        style: 'normal',
        weight: 'normal',
      }),
    ).to.equal(null);

    installAdvanceReader(WIDE);

    const m = measureBlock('label', 10, OPTS, {
      family: 'x',
      style: 'normal',
      weight: 'normal',
    });
    const est = estimateBlock('label', 10, OPTS);

    expect(m.lines).to.equal(1);
    expect(m.width).to.be.closeTo(5 * 8, 1e-9);
    expect(m.height).to.equal(est.height);
    expect(m.width).to.be.greaterThan(est.width);
  });

  it('wraps at maxWidth in model px, whatever the em', function () {
    installAdvanceReader(WIDE);

    // 'ab cd' at 10 px: 'ab' is 16 px, the space 2.8, 'cd' 16 — 34.8 px
    // on one line; a 20 px maxWidth breaks it
    const one = measureBlock(
      'ab cd',
      10,
      { ...OPTS, wrap: 1, maxWidth: 40 },
      { family: 'x', style: 'normal', weight: 'normal' },
    );
    const two = measureBlock(
      'ab cd',
      10,
      { ...OPTS, wrap: 1, maxWidth: 20 },
      { family: 'x', style: 'normal', weight: 'normal' },
    );

    expect(one.lines).to.equal(1);
    expect(two.lines).to.equal(2);
    expect(two.width).to.be.closeTo(16, 1e-9);
  });

  it('the store marks measured dims exact and the label box reads them', function () {
    const mk = () =>
      cytoscape({
        headless: true,
        elements: [{ data: { id: 'a', label: 'mmmmmmmm' } }],
        style: {
          nodes: {
            width: 10,
            height: 10,
            label: { data: 'label' },
            'font-size': 10,
          },
        },
      });

    const estimated = mk().$id('a').boundingBox({ includeLabels: true }).w;

    installAdvanceReader(WIDE);

    const measured = mk().$id('a').boundingBox({ includeLabels: true }).w;

    expect(estimated).to.be.closeTo(8 * 5.4, 1e-6);
    expect(measured).to.be.closeTo(8 * 8, 1e-6);
  });

  describe('a layout before the first frame', function () {
    // a hub with twelve wide-labelled leaves: the leaves' boxes sit
    // side by side round the hub, and their estimated boxes are 48%
    // narrower than their real ones
    const ELEMENTS = () => {
      const els = [{ data: { id: 'h', label: 'hub' } }];

      for (let i = 0; i < 12; i++) {
        els.push({ data: { id: 'w' + i, label: 'wwwwwwwwwwwwwwwwwwww' } });
        els.push({ data: { id: 'e' + i, source: 'h', target: 'w' + i } });
      }

      return els;
    };
    const STYLE = {
      nodes: {
        width: 20,
        height: 20,
        label: { data: 'label' },
        'font-size': 10,
      },
    };

    it('holds the measured label boxes apart', async function () {
      installAdvanceReader(WIDE);

      const cy = cytoscape({
        headless: true,
        elements: ELEMENTS(),
        style: STYLE,
      });

      await cy
        .layout({
          name: 'force',
          seed: 7,
          fit: false,
          nodeDimensionsIncludeLabels: true,
        })
        .run()
        .promise();

      expect(overlapPairs(cy.nodes())).to.equal(0);
    });

    it('control: laid out on estimates, the boxes the frame then lays overlap', async function () {
      // the defect: no reader at layout time (the estimate), then the
      // dims upgraded to the real ones — what the first frame did
      const cy = cytoscape({
        headless: true,
        elements: ELEMENTS(),
        style: STYLE,
      });

      await cy
        .layout({
          name: 'force',
          seed: 7,
          fit: false,
          nodeDimensionsIncludeLabels: true,
        })
        .run()
        .promise();

      expect(overlapPairs(cy.nodes())).to.equal(0);

      // the frame's own write: the label layer's setLabelDims with the
      // laid block — here the wide font's measure of the same text
      installAdvanceReader(WIDE);
      cy.nodes().forEach((n) => {
        const m = measureBlock(n.data('label'), 10, OPTS, {
          family: cy._store.labelFont,
          style: cy._store.labelFontStyle,
          weight: cy._store.labelFontWeight,
        });

        cy._store.setLabelDims(
          cy._store.lookup(n.id()).slot,
          'nodes',
          m.width,
          m.height,
        );
      });

      expect(overlapPairs(cy.nodes())).to.be.greaterThan(0);
    });
  });
});
