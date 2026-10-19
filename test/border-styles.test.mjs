import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import {
  BORDER_STYLE_SHIFT,
  OUTLINE_STYLE_SHIFT,
  STROKE_STYLE_MASK,
  STROKE_DASHED,
  STROKE_DOTTED,
} from '../src/contract.mjs';

/*
Round 38: `border-style` / `outline-style` and the border dash props —
the last unported v3 style pair, at full-coverage scope (every shape;
the sixth sitting's three sub-calls).

These specs pin the CPU half: parsing, normalization, stored-truth
readback and the borderGeom bit packing.  What the *shader* does with
the bits — the perimeter coordinate per shape tier, v3's dotted [1, 1]
hardcode, the double erase — is pinned by the `visual` project's
goldens and live v3 parity scenes, which is the only place pixels can
be asserted.
*/

const make = (nodeStyle = {}) =>
  cytoscape({
    style: { nodes: { 'border-width': 4, ...nodeStyle } },
    elements: { nodes: [{ data: { id: 'a' } }] },
  });

describe('border-style / outline-style (round 38)', function () {
  it('parses and reads back every stroke style keyword', function () {
    for (const kw of ['solid', 'dashed', 'dotted', 'double']) {
      const cy = make({ 'border-style': kw, 'outline-style': kw });

      expect(cy.$id('a').style('border-style'), kw).to.equal(kw);
      expect(cy.$id('a').style('outline-style'), kw).to.equal(kw);
      cy.destroy();
    }
  });

  it('defaults: solid, pattern [4, 2] (v3), offset 0', function () {
    const cy = make();
    const a = cy.$id('a');

    expect(a.style('border-style')).to.equal('solid');
    expect(a.style('outline-style')).to.equal('solid');
    expect(a.style('border-dash-pattern')).to.equal('4 2');
    expect(a.style('border-dash-offset')).to.equal(0);
    cy.destroy();
  });

  it('normalizes the dash pattern to two on/off pairs like the edge twin', function () {
    const cases = [
      [[8, 4], '8 4'], // one pair: collapses back on readback
      [[5], '5 5'], // odd list doubles (canvas setLineDash rule)
      [[1, 2, 3, 4], '1 2 3 4'],
      [[1, 2, 3, 4, 5, 6], '1 2 3 4'], // longer lists truncate
    ];

    for (const [pattern, expected] of cases) {
      const cy = make({ 'border-dash-pattern': pattern });

      expect(
        cy.$id('a').style('border-dash-pattern'),
        JSON.stringify(pattern),
      ).to.equal(expected);
      cy.destroy();
    }
  });

  it('stores the styles in borderGeom bits 8..11 beside the shape id', function () {
    const cy = make({
      shape: 'round-hexagon',
      'border-style': 'dashed',
      'outline-style': 'dotted',
    });
    const store = cy._store;
    const slot = cy.$id('a')._first().slot;
    const word = store.column('node.borderGeom')[slot * 4 + 1];

    expect((word >>> BORDER_STYLE_SHIFT) & STROKE_STYLE_MASK).to.equal(
      STROKE_DASHED,
    );
    expect((word >>> OUTLINE_STYLE_SHIFT) & STROKE_STYLE_MASK).to.equal(
      STROKE_DOTTED,
    );
    // the shape id is untouched by the new fields
    expect(cy.$id('a').style('shape')).to.equal('round-hexagon');
    // and border-position still reads out of its own bits
    expect(cy.$id('a').style('border-position')).to.equal('center');
    cy.destroy();
  });

  it('carries the pattern and offset in the vertex-only dash columns', function () {
    const cy = make({
      'border-style': 'dashed',
      'border-dash-pattern': [10, 5],
      'border-dash-offset': 3,
    });
    const store = cy._store;
    const slot = cy.$id('a')._first().slot;
    const pat = store.column('node.borderDash');
    const meta = store.column('node.borderDashMeta');

    expect(Array.from(pat.subarray(slot * 4, slot * 4 + 4))).to.deep.equal([
      10, 5, 10, 5,
    ]);
    expect(meta[slot * 2]).to.equal(3);
    cy.destroy();
  });

  it('double is a border style, not an outline erase: outline-style double reads back', function () {
    // v3's drawOutline has no double branch — the keyword is accepted
    // and draws solid, a quirk kept for parity and pinned here so a
    // future round changing it does so on purpose
    const cy = make({ 'outline-style': 'double', 'outline-width': 3 });

    expect(cy.$id('a').style('outline-style')).to.equal('double');
    cy.destroy();
  });

  it('rejects an unknown stroke style, naming the vocabulary', function () {
    expect(() => make({ 'border-style': 'groovy' })).to.throw(
      /The border-style 'groovy' is invalid; use one of: solid, dashed, dotted, double/,
    );
    expect(() => make({ 'outline-style': 'wavy' })).to.throw(
      /The outline-style 'wavy' is invalid/,
    );
  });

  it('rejects negative dash-pattern entries', function () {
    expect(() => make({ 'border-dash-pattern': [4, -2] })).to.throw(
      /dash-pattern entries may not be negative/,
    );
  });

  it('the styles are case-mappable, like border-position', function () {
    const cy = cytoscape({
      style: {
        nodes: {
          'border-width': 2,
          'border-style': {
            case: [{ when: { data: 'kind', eq: 'warn' }, then: 'dashed' }],
            else: 'solid',
          },
        },
      },
      elements: {
        nodes: [
          { data: { id: 'w', kind: 'warn' } },
          { data: { id: 'p', kind: 'plain' } },
        ],
      },
    });

    expect(cy.$id('w').style('border-style')).to.equal('dashed');
    expect(cy.$id('p').style('border-style')).to.equal('solid');
    cy.destroy();
  });
});
