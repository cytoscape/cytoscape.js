import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// round 85.2 (fcose #54/#53 absorbed): constraints on the force
// layout — alignment ({ horizontal, vertical } id arrays) and relative
// placement ([{ left, right, gap? } | { top, bottom, gap? }]), with
// fixed already spelled lock().  Constrained runs take the CPU
// executor (the compound precedent), so a headless animate: false run
// is synchronous and deterministic under a seed — what these specs
// pin.  The projection maths itself is pinned at the sim level in
// test/modules/force-constraints.mjs.

describe('gpu/layout: force constraints (round 85.2)', function () {
  var cy;

  var ring = (n) => {
    var els = [];

    for (var i = 0; i < n; i++) {
      els.push({ data: { id: 'n' + i } });
      els.push({
        data: { id: 'e' + i, source: 'n' + i, target: 'n' + ((i + 1) % n) },
      });
    }

    return els;
  };

  var mk = (elements) =>
    (cy = cytoscape({
      headlessWidth: 400,
      headlessHeight: 400,
      elements,
    }));

  var settle = (options) =>
    cy
      .layout({
        name: 'force',
        seed: 3,
        fit: false,
        iterations: 800,
        ...options,
      })
      .run();

  var coord = (id, axis) => cy.$id(id).position()[axis];

  var spreadOf = (ids, axis) => {
    var values = ids.map((id) => coord(id, axis));

    return Math.max(...values) - Math.min(...values);
  };

  it('horizontal alignment settles the group onto one y', function () {
    mk(ring(10));
    settle({ alignment: { horizontal: [['n0', 'n3', 'n6']] } });

    expect(spreadOf(['n0', 'n3', 'n6'], 'y')).to.be.below(1e-3);

    // the unconstrained twin on the same seeded fixture spreads — the
    // constraint is what the spec measures, not the fixture
    settle({});

    expect(spreadOf(['n0', 'n3', 'n6'], 'y')).to.be.above(10);
  });

  it('vertical alignment settles the group onto one x', function () {
    mk(ring(10));
    settle({ alignment: { vertical: [['n1', 'n5', 'n8']] } });

    expect(spreadOf(['n1', 'n5', 'n8'], 'x')).to.be.below(1e-3);
  });

  it('groups sharing a node merge transitively', function () {
    mk(ring(10));
    settle({
      alignment: {
        horizontal: [
          ['n0', 'n3'],
          ['n3', 'n7'],
        ],
      },
    });

    // one merged group: all three share a y
    expect(spreadOf(['n0', 'n3', 'n7'], 'y')).to.be.below(1e-3);
  });

  it('a locked member pins its group, and never moves', function () {
    mk(ring(10));
    cy.$id('n3').position({ x: 111, y: 222 });
    cy.$id('n3').lock();
    settle({ alignment: { horizontal: [['n0', 'n3', 'n6']] } });

    expect(cy.$id('n3').position()).to.deep.equal({ x: 111, y: 222 });
    expect(coord('n0', 'y')).to.be.closeTo(222, 1e-3);
    expect(coord('n6', 'y')).to.be.closeTo(222, 1e-3);
  });

  it('relative placement holds its gaps at settle', function () {
    mk(ring(10));
    settle({
      relativePlacement: [
        { left: 'n0', right: 'n5', gap: 120 },
        { top: 'n2', bottom: 'n7', gap: 90 },
      ],
    });

    expect(coord('n5', 'x') - coord('n0', 'x')).to.be.at.least(120 - 1e-3);
    expect(coord('n7', 'y') - coord('n2', 'y')).to.be.at.least(90 - 1e-3);
  });

  it('gap defaults to the run mean ideal edge length', function () {
    mk(ring(6));
    settle({
      edgeLength: 80,
      relativePlacement: [{ left: 'n0', right: 'n3' }],
    });

    expect(coord('n3', 'x') - coord('n0', 'x')).to.be.at.least(80 - 1e-3);
  });

  it('alignment and relative placement compose', function () {
    mk(ring(10));
    settle({
      alignment: { horizontal: [['n0', 'n5']] },
      relativePlacement: [{ left: 'n0', right: 'n5', gap: 150 }],
    });

    expect(spreadOf(['n0', 'n5'], 'y')).to.be.below(1e-3);
    expect(coord('n5', 'x') - coord('n0', 'x')).to.be.at.least(150 - 1e-3);
  });

  it('throws on an unknown id, before anything moves', function () {
    mk(ring(4));

    var before = cy.nodes().map((n) => ({ ...n.position() }));

    expect(() =>
      settle({ alignment: { horizontal: [['n0', 'nope']] } }),
    ).to.throw(/names node 'nope', which is not in the layout scope/);
    expect(() =>
      settle({ relativePlacement: [{ left: 'n0', right: 'gone' }] }),
    ).to.throw(/names node 'gone', which is not in the layout scope/);

    cy.nodes().forEach((n, i) => {
      expect(n.position()).to.deep.equal(before[i]);
    });
  });

  it('throws on a placement cycle', function () {
    mk(ring(4));

    expect(() =>
      settle({
        relativePlacement: [
          { left: 'n0', right: 'n1' },
          { left: 'n1', right: 'n2' },
          { left: 'n2', right: 'n0' },
        ],
      }),
    ).to.throw(/left\/right constraints contain a cycle/);

    // cycles are per axis: the same ids across axes are fine
    settle({
      relativePlacement: [
        { left: 'n0', right: 'n1' },
        { top: 'n1', bottom: 'n0' },
      ],
    });
  });

  it('throws on two locked members of one group at different coordinates', function () {
    mk(ring(6));
    cy.$id('n0').position({ x: 0, y: 10 });
    cy.$id('n3').position({ x: 50, y: 90 });
    cy.$id('n0').lock();
    cy.$id('n3').lock();

    expect(() =>
      settle({ alignment: { horizontal: [['n0', 'n3', 'n5']] } }),
    ).to.throw(/two locked members sit at different y coordinates/);
  });

  it('throws on a malformed relativePlacement entry', function () {
    mk(ring(4));

    expect(() => settle({ relativePlacement: [{ left: 'n0' }] })).to.throw(
      /each entry is \{ left, right, gap\? \} or \{ top, bottom, gap\? \}/,
    );
  });
});
