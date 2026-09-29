import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { serializeElements } from '../src/wire.mjs';

describe('gpu/collection: iteration', function () {
  var cy;

  beforeEach(function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
      ],
    });
  });

  it('reports size and emptiness', function () {
    expect(cy.elements().size()).to.equal(4);
    expect(cy.elements().empty()).to.be.false;
    expect(cy.elements().nonempty()).to.be.true;
    expect(cy.collection().empty()).to.be.true;
    expect(cy.collection()).to.have.length(0);
  });

  it('supports numeric indexing where eles[0] is a length-1 collection', function () {
    var nodes = cy.nodes();

    expect(nodes[0]).to.have.length(1);
    expect(nodes[0].id()).to.equal('a');
    expect(nodes[0][0]).to.equal(nodes[0]); // element is its own first element
  });

  it('interns element handles (same slot ⇒ same object)', function () {
    expect(cy.$id('a')[0]).to.equal(cy.nodes()[0]);
  });

  it('iterates with forEach in insertion order', function () {
    var ids = [];
    var indexes = [];

    cy.nodes().forEach(function (ele, i, eles) {
      ids.push(ele.id());
      indexes.push(i);
      expect(eles).to.have.length(3);
      expect(this).to.be.undefined; // plain call without thisArg, like v3
    });

    expect(ids).to.deep.equal(['a', 'b', 'c']);
    expect(indexes).to.deep.equal([0, 1, 2]);
  });

  it('exits forEach early on false', function () {
    var count = 0;

    cy.nodes().each(function () {
      count++;
      return false;
    });

    expect(count).to.equal(1);
  });

  it('supports eq/first/last', function () {
    var nodes = cy.nodes();

    expect(nodes.eq(1).id()).to.equal('b');
    expect(nodes.first().id()).to.equal('a');
    expect(nodes.last().id()).to.equal('c');
    expect(nodes.eq(99)).to.have.length(0);
  });

  it('runs forEach bound to an explicit thisArg', function () {
    var ctx = { tag: 'ctx' };
    var seen = [];

    cy.nodes().forEach(function (ele) {
      seen.push(this.tag);
      expect(this).to.equal(ctx);
    }, ctx);

    expect(seen).to.deep.equal(['ctx', 'ctx', 'ctx']);
  });

  it('supports slice', function () {
    var nodes = cy.nodes();

    expect(nodes.slice(1).map((n) => n.id())).to.deep.equal(['b', 'c']);
    expect(nodes.slice(0, 2).map((n) => n.id())).to.deep.equal(['a', 'b']);
    expect(nodes.slice(-1).map((n) => n.id())).to.deep.equal(['c']);
    expect(nodes.slice().map((n) => n.id())).to.deep.equal(['a', 'b', 'c']); // no-arg copies
    expect(nodes.slice(1, -1).map((n) => n.id())).to.deep.equal(['b']); // negative end
  });

  it('supports toArray', function () {
    var array = cy.nodes().toArray();

    expect(array).to.be.an('array');
    expect(array).to.have.length(3);
    expect(array[2].id()).to.equal('c');
  });

  it('supports map/some/every', function () {
    var nodes = cy.nodes();

    expect(nodes.map((n) => n.id())).to.deep.equal(['a', 'b', 'c']);
    expect(nodes.some((n) => n.id() === 'b')).to.be.true;
    expect(nodes.some((n) => n.id() === 'z')).to.be.false;
    expect(nodes.every((n) => n.isNode())).to.be.true;
    expect(cy.elements().every((n) => n.isNode())).to.be.false;
  });

  it('dedupes elements in collections', function () {
    var doubled = cy.$id('a').union(cy.$id('a'));

    expect(doubled).to.have.length(1);
  });
});

// Round 75.3: collections are iterable, and cy.add() takes iterables of
// definitions.  The order assertion is the control's target: an iterator
// yielding the members reversed fails 'iterates in collection order'.
describe('gpu/collection: the iteration protocol (round 75.3)', function () {
  var cy;

  beforeEach(function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
      ],
    });
  });

  it('iterates in collection order with for..of', function () {
    var ids = [];

    for (var ele of cy.elements()) {
      ids.push(ele.id());
    }

    expect(ids).to.deep.equal(['a', 'b', 'c', 'ab']);
  });

  it('yields the interned handles indexing returns', function () {
    var nodes = cy.nodes();
    var spread = [...nodes];

    expect(spread).to.have.length(3);
    expect(spread[0]).to.equal(nodes[0]);
    expect(spread[2]).to.equal(cy.$id('c')[0]);
    expect(Array.from(nodes)[1]).to.equal(nodes[1]);
    // a singleton yields itself
    expect([...cy.$id('b')][0]).to.equal(cy.$id('b'));
  });

  it('iterates an empty collection as nothing', function () {
    expect([...cy.collection()]).to.deep.equal([]);
    expect([...cy.nodes().filter(() => false)]).to.have.length(0);
  });

  it('sees the members the collection was made with, removed ones as stale handles', function () {
    var nodes = cy.nodes();

    cy.$id('b').remove();

    var seen = [...nodes];

    expect(seen.map((n) => n.id())).to.deep.equal(['a', 'b', 'c']);
    expect(seen[1].removed()).to.equal(true);
    // and forEach agrees
    var viaEach = [];

    nodes.forEach((n) => viaEach.push(n));
    expect(viaEach).to.deep.equal(seen);
  });

  it('cy.add() takes a generator of definitions', function () {
    function* defs() {
      yield { data: { id: 'x' } };
      yield { data: { id: 'y' } };
      yield { data: { id: 'xy', source: 'x', target: 'y' } };
    }

    var added = cy.add(defs());

    expect(added.map((e) => e.id())).to.deep.equal(['x', 'y', 'xy']);
    expect(cy.$id('xy').source().id()).to.equal('x');
  });

  it("cy.add() takes a Set and a Map's values()", function () {
    cy.add(new Set([{ data: { id: 's1' } }, { data: { id: 's2' } }]));
    cy.add(new Map([['m', { data: { id: 'm1' } }]]).values());

    expect(cy.$id('s2').length).to.equal(1);
    expect(cy.$id('m1').length).to.equal(1);
  });

  it('cy.add() of a wire buffer as a Uint8Array still decodes, not walked as definitions', function () {
    var buffer = serializeElements([
      { data: { id: 'w1' } },
      { data: { id: 'w2' } },
    ]);
    var added = cy.add(new Uint8Array(buffer));

    expect(added.map((e) => e.id())).to.deep.equal(['w1', 'w2']);
  });

  it('cy.add() of a collection throws, naming the v4 way', function () {
    expect(() => cy.add(cy.nodes())).to.throw(
      /does not take a collection.*jsons\(\)/,
    );
  });
});
