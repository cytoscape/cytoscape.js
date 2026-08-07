import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import {
  SHAPE_CIRCLE,
  SHAPE_ELLIPSE,
  SHAPE_RECTANGLE,
  SHAPE_ROUND_RECTANGLE,
} from '../src/contract.mjs';

describe('gpu/style', function () {
  var cy;

  var fillOf = (id) => {
    var ref = cy._store.lookup(id);
    var column = cy._store.column('node.fillColor');

    return Array.from(column.slice(ref.slot * 4, ref.slot * 4 + 4));
  };

  var lineOf = (id) => {
    var ref = cy._store.lookup(id);
    var column = cy._store.column('edge.lineColor');

    return Array.from(column.slice(ref.slot * 4, ref.slot * 4 + 4));
  };

  var shapeOf = (id) => {
    var ref = cy._store.lookup(id);

    return cy._store.column('node.shape')[ref.slot];
  };

  beforeEach(function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
      ],
    });
  });

  describe('defaults', function () {
    it('applies v3-like defaults on add', function () {
      expect(cy.$id('a').width()).to.equal(30);
      expect(cy.$id('a').height()).to.equal(30);
      expect(fillOf('a')).to.deep.equal([153, 153, 153, 255]); // #999
      // v3's default stylesheet's one element rule (round 57.1)
      expect(cy.$id('ab').width()).to.equal(3);
      expect(lineOf('ab')).to.deep.equal([153, 153, 153, 255]);
    });

    it('compiles default equal-sized ellipses to circles', function () {
      expect(shapeOf('a')).to.equal(SHAPE_CIRCLE);
    });
  });

  describe('cy.style()', function () {
    it('applies constant group props', function () {
      cy.style({
        nodes: { 'background-color': 'red', width: 50, height: 40 },
        edges: { 'line-color': '#00f', width: 5 },
      });

      expect(fillOf('a')).to.deep.equal([255, 0, 0, 255]);
      expect(cy.$id('a').width()).to.equal(50);
      expect(cy.$id('a').height()).to.equal(40);
      expect(shapeOf('a')).to.equal(SHAPE_ELLIPSE); // unequal ⇒ true ellipse
      expect(lineOf('ab')).to.deep.equal([0, 0, 255, 255]);
      expect(cy.$id('ab').width()).to.equal(5);
    });

    it('evaluates per-element case mappers', function () {
      cy.style({
        nodes: {
          'background-color': {
            case: [{ when: { data: 'id', eq: 'a' }, then: 'rgb(0, 255, 0)' }],
            else: 'red',
          },
        },
      });

      expect(fillOf('a')).to.deep.equal([0, 255, 0, 255]);
      expect(fillOf('b')).to.deep.equal([255, 0, 0, 255]);
    });

    it('accepts camelCase prop names', function () {
      cy.style({ nodes: { backgroundColor: 'red', borderWidth: 2 } });

      var ref = cy._store.lookup('a');

      expect(fillOf('a')).to.deep.equal([255, 0, 0, 255]);
      expect(cy._store.column('node.borderWidth')[ref.slot]).to.equal(2);
    });

    it('applies to elements added later', function () {
      cy.style({ nodes: { 'background-color': 'black' } });

      cy.add({ data: { id: 'c' } });

      expect(fillOf('c')).to.deep.equal([0, 0, 0, 255]);
    });

    it('supports shapes', function () {
      cy.style({
        nodes: {
          shape: {
            case: [{ when: { data: 'id', eq: 'a' }, then: 'rectangle' }],
            else: 'round-rectangle',
          },
        },
      });

      expect(shapeOf('a')).to.equal(SHAPE_RECTANGLE);
      expect(shapeOf('b')).to.equal(SHAPE_ROUND_RECTANGLE);
    });

    it('supports the polygon shape keywords (round 10) with readback', function () {
      var keywords = [
        'triangle',
        'pentagon',
        'hexagon',
        'heptagon',
        'octagon',
        'diamond',
        'rhomboid',
        'vee',
        'star',
        'tag',
      ];

      for (var keyword of keywords) {
        cy.style({ nodes: { shape: keyword } });

        expect(cy.$id('a').style('shape'), keyword).to.equal(keyword);
      }

      // square is a rectangle alias
      cy.style({ nodes: { shape: 'square' } });
      expect(shapeOf('a')).to.equal(SHAPE_RECTANGLE);
    });

    it('still throws on an unknown shape keyword', function () {
      // 27.5 completed v3's node-shape vocabulary, so this used to name
      // 'barrel' and now has to name something that is not a shape at all
      expect(() => cy.style({ nodes: { shape: 'trapezoid' } })).to.throw(
        /unsupported/,
      );
    });

    it('supports line-style with readback (round 10)', function () {
      var styleIdOf = (id) => {
        var ref = cy._store.lookup(id);

        return cy._store.column('edge.lineStyle')[ref.slot];
      };

      expect(cy.$id('ab').style('line-style')).to.equal('solid'); // default

      cy.style({ edges: { 'line-style': 'dashed' } });
      expect(styleIdOf('ab')).to.equal(1);
      expect(cy.$id('ab').style('line-style')).to.equal('dashed');

      cy.style({
        edges: {
          'line-style': {
            case: [{ when: { data: 'id', eq: 'ab' }, then: 'dotted' }],
            else: 'solid',
          },
        },
      });
      expect(cy.$id('ab').style('line-style')).to.equal('dotted');

      expect(() => cy.style({ edges: { 'line-style': 'double' } })).to.throw(
        /unsupported/,
      );
    });

    it('supports border and opacity channels', function () {
      cy.style({
        nodes: { 'border-width': 3, 'border-color': 'white', opacity: 0.5 },
      });

      var ref = cy._store.lookup('a');

      expect(cy._store.column('node.borderWidth')[ref.slot]).to.equal(3);
      expect(cy._store.column('node.opacity')[ref.slot]).to.equal(0.5);
      expect(cy.$id('a').outerWidth()).to.equal(33);
    });

    it('does not restyle on selection change (accent ring is shader-drawn)', function () {
      // v4 has no selection-dependent styling: selection is drawn by the
      // shader accent ring, so a select never touches the stored channels
      cy.style({ nodes: { 'background-color': 'red' } });

      expect(fillOf('a')).to.deep.equal([255, 0, 0, 255]);

      cy.$id('a').select();

      expect(fillOf('a')).to.deep.equal([255, 0, 0, 255]); // unchanged
    });

    it('emits a style event', function () {
      var emitted = 0;

      cy.on('style', function () {
        emitted++;
      });
      cy.style({});

      expect(emitted).to.equal(1);
    });

    it('returns the current sheet from json()', function () {
      var sheet = { nodes: { width: 10 } };

      cy.style(sheet);

      expect(cy.style().json()).to.deep.equal(sheet);
    });

    it('honours the style init option', function () {
      var styled = cytoscape({
        style: { nodes: { width: 77 } },
        elements: [{ data: { id: 'x' } }],
      });

      expect(styled.$id('x').width()).to.equal(77);
    });

    it('supports the label visual props (round 10)', function () {
      cy.style({
        nodes: {
          label: 'hi',
          'text-outline-width': 2,
          'text-outline-color': 'red',
          'text-outline-opacity': 0.5,
          'text-background-color': 'blue',
          'text-background-opacity': 0.25,
          'text-background-padding': 3,
          'text-margin-x': 5,
          'text-margin-y': 7,
        },
      });

      var entry = cy._store.labelAt(cy._store.lookup('a').slot);

      expect(entry.outlineWidth).to.equal(2);
      expect((entry.outlineColor >>> 24) & 0xff).to.equal(128); // opacity folded
      expect(entry.marginX).to.equal(5);
      expect(entry.marginY).to.equal(7);
      expect(entry.anchorY).to.equal(30 / 2 + 4 + 7); // height/2 + margin const + text-margin-y
      expect(entry.bgPadding).to.equal(3);
      expect((entry.bgColor >>> 24) & 0xff).to.equal(64);

      expect(cy.$id('a').style('text-outline-width')).to.equal(2);
      expect(cy.$id('a').style('text-margin-y')).to.equal(7);
      expect(cy.$id('a').style('text-outline-opacity')).to.be.closeTo(
        0.5,
        0.01,
      );
      expect(cy.$id('a').style('text-background-color')).to.equal(
        'rgba(0,0,255,0.251)',
      );
    });

    it('throws on unsupported properties', function () {
      // background-blacken is dropped by decided design (the 2026-07-29
      // triage); text-wrap — the old example here — landed in round 16.2
      expect(function () {
        cy.style({ nodes: { 'background-blacken': 0.5 } });
      }).to.throw();
    });

    it('throws on mapper-style values', function () {
      expect(function () {
        cy.style({ nodes: { width: 'data(weight)' } });
      }).to.throw();
    });

    it('throws on unknown stylesheet keys', function () {
      expect(function () {
        cy.style({ node: { width: 10 } }); // 'nodes', not 'node'
      }).to.throw(/Unknown stylesheet key/);
    });
  });
});
