import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

describe('gpu/collection: building and filtering', function () {
  var cy;

  var ids = (eles) => eles.map((ele) => ele.id());

  beforeEach(function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' }, selected: true },
        { data: { id: 'ab', source: 'a', target: 'b' } },
        { data: { id: 'bc', source: 'b', target: 'c' } },
      ],
    });
  });

  // round 64 (ledger item 28): the accumulator takes no arguments.
  // v3's collection( eles, opts ) also built from a string, an array or
  // a collection, so the v3-shaped call silently returned the empty
  // collection — a round-60.2 benchmark band selected nothing in 53 ns
  // because of it.  Now it throws, naming the replacements.
  it('cy.collection() with any argument throws; the zero-arg accumulator stands', function () {
    expect(cy.collection().length).to.equal(0);

    expect(() => cy.collection([cy.$id('a')])).to.throw(/union|filter/);
    expect(() => cy.collection('node')).to.throw(/takes no arguments/);
    expect(() => cy.$id('a').collection('x')).to.throw(/takes no arguments/);

    // and the advice the message gives actually works
    var built = cy.collection().union(cy.$id('a')).union(cy.$id('b'));

    expect(built.length).to.equal(2);
  });

  it('unions collections', function () {
    var eles = cy.$id('a').union(cy.$id('b'));

    expect(ids(eles)).to.deep.equal(['a', 'b']);
    expect(ids(cy.$id('a').or(cy.$id('b')))).to.deep.equal(['a', 'b']);
    expect(ids(cy.$id('a').u(cy.$id('b')))).to.deep.equal(['a', 'b']);
    expect(ids(cy.$id('a').add(cy.$id('b')))).to.deep.equal(['a', 'b']);
  });

  it('takes differences', function () {
    expect(ids(cy.nodes().difference(cy.$id('b')))).to.deep.equal(['a', 'c']);
    expect(ids(cy.nodes().not(cy.$id('b')))).to.deep.equal(['a', 'c']);
    expect(
      ids(cy.nodes().subtract(cy.$id('a').union(cy.$id('c')))),
    ).to.deep.equal(['b']);
  });

  it('takes intersections', function () {
    expect(
      ids(cy.nodes().intersection(cy.filter({ selected: true }))),
    ).to.deep.equal(['c']);
    expect(ids(cy.elements().intersect(cy.edges()))).to.deep.equal([
      'ab',
      'bc',
    ]);
    expect(ids(cy.nodes().and(cy.$id('a').union(cy.$id('b'))))).to.deep.equal([
      'a',
      'b',
    ]);
  });

  it('intersecting with an empty collection is empty', function () {
    expect(cy.nodes().intersect(cy.collection()).empty()).to.be.true;
  });

  it('takes symmetric differences', function () {
    var bc = cy.$id('b').union(cy.$id('c'));

    expect(
      ids(cy.$id('a').union(cy.$id('b')).symmetricDifference(bc)),
    ).to.deep.equal(['a', 'c']);
    expect(ids(cy.$id('a').union(cy.$id('b')).xor(bc))).to.deep.equal([
      'a',
      'c',
    ]);
    expect(ids(cy.$id('a').union(cy.$id('b')).symdiff(bc))).to.deep.equal([
      'a',
      'c',
    ]);
  });

  it('filters with a query', function () {
    expect(ids(cy.elements().filter({ group: 'nodes' }))).to.deep.equal([
      'a',
      'b',
      'c',
    ]);
    expect(
      ids(cy.elements().filter({ group: 'nodes', selected: true })),
    ).to.deep.equal(['c']);
  });

  it('filters with a function', function () {
    var eles = cy.nodes().filter(function (ele, i, all) {
      expect(all).to.have.length(3);
      expect(this).to.be.undefined; // plain call without thisArg, like v3

      return i !== 1;
    });

    expect(ids(eles)).to.deep.equal(['a', 'c']);
  });

  it('filters from the core', function () {
    expect(ids(cy.filter({ group: 'edges' }))).to.deep.equal(['ab', 'bc']);
    expect(ids(cy.filter({ selected: true }))).to.deep.equal(['c']);
    expect(ids(cy.filter((ele) => ele.isEdge()))).to.deep.equal(['ab', 'bc']);
  });

  // round 113.2: the core's predicate filter runs over the whole-graph
  // memo (34.2) and the collection's predicate filter hands its own
  // handles to the result — both are speed paths, so pin what they must
  // not change: order, staleness, identity and the handles themselves.
  it('a predicate filter keeps store order, sees structure changes and is its own collection', function () {
    var all = cy.elements();
    var everything = cy.filter(() => true);

    expect(ids(everything)).to.deep.equal(ids(all));
    expect(everything).to.not.equal(all); // never the memo itself
    expect(everything[0]).to.equal(all[0]); // but the same interned handles
    expect(cy.filter(() => false).length).to.equal(0);

    cy.add({ data: { id: 'd' } });
    cy.$id('a').remove();

    expect(ids(cy.filter((ele) => ele.isNode()))).to.deep.equal([
      'b',
      'c',
      'd',
    ]);
    expect(ids(cy.nodes((ele) => ele.id() !== 'c'))).to.deep.equal(['b', 'd']);
    expect(ids(cy.edges((ele) => ele.isEdge()))).to.deep.equal(['bc']);

    // the collection path, with a thisArg and a kept-handle identity check
    var ctx = { keep: 'b' };
    var kept = cy.nodes().filter(function (ele) {
      return ele.id() === this.keep;
    }, ctx);

    expect(ids(kept)).to.deep.equal(['b']);
    expect(kept[0]).to.equal(cy.$id('b'));
    expect(kept.eq(0).same(cy.nodes()[0])).to.equal(true);
  });

  it('narrows with nodes()/edges()', function () {
    expect(ids(cy.elements().nodes())).to.deep.equal(['a', 'b', 'c']);
    expect(ids(cy.elements().edges())).to.deep.equal(['ab', 'bc']);
    expect(ids(cy.elements().nodes({ selected: true }))).to.deep.equal(['c']);
  });

  it('gets by id within a collection', function () {
    expect(cy.nodes().getElementById('b').id()).to.equal('b');
    expect(cy.nodes().getElementById('ab')).to.have.length(0);
  });

  it('selects with core queries', function () {
    expect(ids(cy.filter({ group: 'nodes' }))).to.deep.equal(['a', 'b', 'c']);
    expect(ids(cy.$id('a').union(cy.$id('ab')))).to.deep.equal(['a', 'ab']);
    expect(ids(cy.filter({}))).to.have.length(5);
  });
});
