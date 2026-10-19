import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// data predicates in the matcher IR: cy.nodes({ data: { ... } }) etc.
describe('gpu/query: data predicates', function () {
  var cy;
  var ids = (eles) => eles.map((ele) => ele.id()).sort();

  beforeEach(function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'a', weight: 0.25, kind: 'x' } },
        { data: { id: 'b', weight: 0.75, kind: 'y' } },
        { data: { id: 'c', weight: 1.5, kind: 'y', flag: true } },
        { data: { id: 'd' } }, // no data at all
        { data: { id: 'ab', source: 'a', target: 'b', weight: 5 } },
        { data: { id: 'bc', source: 'b', target: 'c', weight: 10 } },
      ],
    });
  });

  it('bare values mean equality', function () {
    expect(ids(cy.nodes({ data: { kind: 'y' } }))).to.deep.equal(['b', 'c']);
    expect(ids(cy.nodes({ data: { weight: 0.25 } }))).to.deep.equal(['a']);
    expect(ids(cy.nodes({ data: { flag: true } }))).to.deep.equal(['c']);
  });

  it('ordinal comparisons over numbers', function () {
    expect(ids(cy.nodes({ data: { weight: { gt: 0.5 } } }))).to.deep.equal([
      'b',
      'c',
    ]);
    expect(ids(cy.nodes({ data: { weight: { gte: 0.75 } } }))).to.deep.equal([
      'b',
      'c',
    ]);
    expect(ids(cy.nodes({ data: { weight: { lt: 0.5 } } }))).to.deep.equal([
      'a',
    ]);
    expect(ids(cy.nodes({ data: { weight: { lte: 0.75 } } }))).to.deep.equal([
      'a',
      'b',
    ]);
  });

  it('ne and in', function () {
    // case-mapper semantics: a missing value fails every op, ne included
    expect(ids(cy.nodes({ data: { kind: { ne: 'x' } } }))).to.deep.equal([
      'b',
      'c',
    ]);
    expect(ids(cy.nodes({ data: { kind: { in: ['x', 'y'] } } }))).to.deep.equal(
      ['a', 'b', 'c'],
    );
  });

  it('multiple keys AND together', function () {
    expect(
      ids(cy.nodes({ data: { kind: 'y', weight: { gt: 1 } } })),
    ).to.deep.equal(['c']);
  });

  it('composes with group and selected', function () {
    cy.$id('b').select();

    expect(
      ids(
        cy.elements({
          group: 'nodes',
          data: { weight: { gt: 0.5 } },
          selected: true,
        }),
      ),
    ).to.deep.equal(['b']);
    expect(
      ids(cy.elements({ group: 'edges', data: { weight: { gte: 10 } } })),
    ).to.deep.equal(['bc']);
  });

  it('works on edges via cy.edges and filter', function () {
    expect(ids(cy.edges({ data: { weight: { lt: 8 } } }))).to.deep.equal([
      'ab',
    ]);
    expect(ids(cy.filter({ data: { weight: 5 } }))).to.deep.equal(['ab']);
  });

  it('works on collection filter (planMatchesRef path)', function () {
    expect(ids(cy.nodes().filter({ data: { kind: 'y' } }))).to.deep.equal([
      'b',
      'c',
    ]);
  });

  it('reflects data writes immediately', function () {
    cy.$id('d').data('kind', 'y');

    expect(ids(cy.nodes({ data: { kind: 'y' } }))).to.deep.equal([
      'b',
      'c',
      'd',
    ]);

    cy.$id('b').data('kind', 'z');

    expect(ids(cy.nodes({ data: { kind: 'y' } }))).to.deep.equal(['c', 'd']);
  });

  it('unknown keys and malformed conditions throw', function () {
    expect(() => cy.nodes({ bogus: 1 })).to.throw(/Unknown query key/);
    expect(() => cy.nodes({ data: { weight: { gt: 1, lt: 2 } } })).to.throw(
      /exactly one comparison/,
    );
    expect(() => cy.nodes({ data: { weight: { between: 1 } } })).to.throw(
      /Unknown data condition op/,
    );
    expect(() => cy.nodes({ data: { weight: { gt: 'high' } } })).to.throw(
      /numeric value/,
    );
    expect(() => cy.nodes({ data: { kind: { in: [] } } })).to.throw(
      /non-empty array/,
    );
  });

  it('a query over a missing key matches nothing', function () {
    expect(cy.nodes({ data: { nonexistent: { gt: 0 } } }).length).to.equal(0);
    expect(cy.nodes({ data: { nonexistent: 'v' } }).length).to.equal(0);
  });
});
