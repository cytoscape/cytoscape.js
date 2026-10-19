import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// round 13 A1: ghost props — the node body duplicated at an offset

describe('gpu/ghost: ghost props (round 13 A1)', function () {
  var cy;

  var makeCy = (nodeStyle, elements) =>
    cytoscape({
      elements: elements ?? [{ data: { id: 'n' }, position: { x: 0, y: 0 } }],
      style: nodeStyle == null ? undefined : { nodes: nodeStyle },
    });

  it('parses and reads back the four ghost props', function () {
    cy = makeCy({
      ghost: 'yes',
      'ghost-offset-x': 12,
      'ghost-offset-y': -8,
      'ghost-opacity': 0.4,
    });

    var n = cy.$id('n');

    expect(n.style('ghost')).to.equal('yes');
    expect(n.style('ghost-offset-x')).to.equal(12);
    expect(n.style('ghost-offset-y')).to.equal(-8);
    expect(n.style('ghost-opacity')).to.be.closeTo(0.4, 1e-6);
  });

  it('defaults: no ghost, zero offsets, zero opacity (v3)', function () {
    cy = makeCy(null);

    var n = cy.$id('n');

    expect(n.style('ghost')).to.equal('no');
    expect(n.style('ghost-offset-x')).to.equal(0);
    expect(n.style('ghost-opacity')).to.equal(0);
  });

  it('writes the ghost column and tracks the enabled count', function () {
    cy = makeCy({ ghost: 'yes', 'ghost-opacity': 0.5 });

    expect(cy._store.ghostCount()).to.equal(1);

    cy.style({ nodes: {} }); // defaults: ghost off

    expect(cy._store.ghostCount()).to.equal(0);
  });

  it('throws for ghost props on the edges group', function () {
    expect(() => cytoscape({ style: { edges: { ghost: 'yes' } } })).to.throw(
      /node style property/,
    );
  });

  it('throws on invalid ghost keywords and out-of-range opacity', function () {
    expect(() => makeCy({ ghost: 'maybe' })).to.throw(/yes.*no|not a valid/);
    expect(() => makeCy({ 'ghost-opacity': 1.5 })).to.throw(/within \[0, 1\]/);
  });

  it('an enabled ghost grows the store and collection bounding boxes', function () {
    cy = makeCy(null);

    var before = cy._store.boundingBox();

    // default 30x30 node at origin: bb is ±15
    expect(before.x2).to.be.closeTo(15, 1e-4);

    cy.style({
      nodes: { ghost: 'yes', 'ghost-offset-x': 40, 'ghost-opacity': 0.5 },
    });

    var after = cy._store.boundingBox();

    expect(after.x2).to.be.closeTo(55, 1e-4); // 40 + 15
    expect(after.x1).to.be.closeTo(-15, 1e-4); // unchanged on the left

    var eleBB = cy.$id('n').boundingBox();

    expect(eleBB.x2).to.be.closeTo(55, 1e-4);
  });

  it('a disabled ghost never affects bounds, whatever its offsets', function () {
    cy = makeCy({ 'ghost-offset-x': 100, 'ghost-opacity': 0.5 }); // ghost: no

    expect(cy._store.boundingBox().x2).to.be.closeTo(15, 1e-4);
  });

  it('ghost props take mappers (case on data)', function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'g', haunted: 1 }, position: { x: 0, y: 0 } },
        { data: { id: 'p', haunted: 0 }, position: { x: 100, y: 0 } },
      ],
      style: {
        nodes: {
          ghost: {
            case: [{ when: { data: 'haunted', eq: 1 }, then: 'yes' }],
            else: 'no',
          },
          'ghost-offset-x': 20,
          'ghost-opacity': {
            data: 'haunted',
            scale: 'linear',
            domain: [0, 1],
            range: [0, 0.6],
          },
        },
      },
    });

    expect(cy.$id('g').style('ghost')).to.equal('yes');
    expect(cy.$id('p').style('ghost')).to.equal('no');
    expect(cy._store.ghostCount()).to.equal(1);
    expect(cy.$id('g').style('ghost-opacity')).to.be.closeTo(0.6, 1e-5);
  });

  afterEach(function () {
    if (cy != null) {
      cy.destroy();
      cy = null;
    }
  });
});
