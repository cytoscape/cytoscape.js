import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// round 13 B3: line-cap + line-dash-pattern/-offset

describe('gpu/dash-props (round 13 B3)', function () {
  var cy;

  var makeCy = (edgeStyle) =>
    cytoscape({
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 100, y: 0 } },
        { data: { id: 'e', source: 'a', target: 'b' } },
      ],
      style: { edges: edgeStyle },
    });

  it('parses and reads back the dash props', function () {
    cy = makeCy({
      'line-style': 'dashed',
      'line-dash-pattern': [10, 4],
      'line-dash-offset': 7,
      'line-cap': 'round',
    });

    var e = cy.$id('e');

    expect(e.style('line-dash-pattern')).to.equal('10 4');
    expect(e.style('line-dash-offset')).to.equal(7);
    expect(e.style('line-cap')).to.equal('round');
  });

  it('defaults match v3 ([6, 3], offset 0, butt)', function () {
    cy = makeCy({});

    expect(cy.$id('e').style('line-dash-pattern')).to.equal('6 3');
    expect(cy.$id('e').style('line-dash-offset')).to.equal(0);
    expect(cy.$id('e').style('line-cap')).to.equal('butt');
  });

  it('normalizes patterns: odd doubles (canvas), four entries stay', function () {
    cy = makeCy({ 'line-dash-pattern': [5] });

    expect(cy.$id('e').style('line-dash-pattern')).to.equal('5 5');

    var cy2 = makeCy({ 'line-dash-pattern': '8 2 3 6' });
    var keep = cy;

    cy = cy2;
    expect(cy2.$id('e').style('line-dash-pattern')).to.equal('8 2 3 6');
    cy = keep;
    cy2.destroy();
  });

  it('stores the pattern and meta columns', function () {
    cy = makeCy({
      'line-dash-pattern': [9, 2],
      'line-dash-offset': 3,
      'line-cap': 'square',
    });

    var slot = cy._store.lookup('e').slot;
    var pat = cy._store.column('edge.dashPattern');
    var meta = cy._store.column('edge.dashMeta');

    expect(Array.from(pat.subarray(slot * 4, slot * 4 + 4))).to.deep.equal([
      9, 2, 9, 2,
    ]);
    expect(meta[slot * 2]).to.equal(3);
    expect(meta[slot * 2 + 1]).to.equal(2);
  });

  it('validates keywords and negative entries', function () {
    expect(() => makeCy({ 'line-cap': 'pointy' })).to.throw(/line-cap/);
    expect(() => makeCy({ 'line-dash-pattern': [-2, 3] })).to.throw(/negative/);
  });

  it('line-cap and line-dash-offset take mappers', function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 100, y: 0 } },
        { data: { id: 'e1', source: 'a', target: 'b', kind: 1 } },
        { data: { id: 'e2', source: 'a', target: 'b', kind: 0 } },
      ],
      style: {
        edges: {
          'line-cap': {
            case: [{ when: { data: 'kind', eq: 1 }, then: 'round' }],
            else: 'butt',
          },
          'line-dash-offset': {
            data: 'kind',
            scale: 'linear',
            domain: [0, 1],
            range: [0, 12],
          },
        },
      },
    });

    expect(cy.$id('e1').style('line-cap')).to.equal('round');
    expect(cy.$id('e2').style('line-cap')).to.equal('butt');
    expect(cy.$id('e1').style('line-dash-offset')).to.equal(12);
  });

  afterEach(function () {
    if (cy != null) {
      cy.destroy();
      cy = null;
    }
  });
});
