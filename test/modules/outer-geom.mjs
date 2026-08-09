import { expect } from 'chai';
import { GraphStore } from '../../src/store/graph-store.mjs';
import cytoscape from '../../src/index.mjs';

/*
Round 58 — the derived `node.outerGeom` column: `node.outerHalf` and
`node.shape` fused into one vec4f so the two vertex stages that were at
the 8-storage-buffer budget (the curved layer-stroke VS and the
edge-label VS) can swap two bindings for one and spend the freed slot on
`edge.width`, which carries the arrow-trim word.

Nothing reads this column on the CPU, so nothing else would notice it
going stale — this spec is its only witness, and it pins the lockstep
invariant: after any sequence of writes, lanes 0/1 equal
`node.outerHalf` and lane 2 equals `node.shape`, at every live slot.

Control (run 2026-08-09): with the `node.shape` hook in
`GraphStore.setScalar` deleted, 'follows a shape write' and the
style-driven case fail; with the `updateOuterHalf` lanes-0/1 write
deleted, the size/border cases fail.  Both halves discriminate.
*/

/** assert lockstep at one slot */
function expectFused(store, slot) {
  const outer = store.column('node.outerHalf');
  const shape = store.column('node.shape');
  const geom = store.column('node.outerGeom');

  expect(geom[slot * 4]).to.equal(outer[slot * 2]);
  expect(geom[slot * 4 + 1]).to.equal(outer[slot * 2 + 1]);
  expect(geom[slot * 4 + 2]).to.equal(shape[slot]);
}

describe('gpu/store: the derived node.outerGeom column (round 58)', function () {
  var store;

  beforeEach(function () {
    store = new GraphStore();
  });

  it('follows a size write', function () {
    const slot = store.addNode('a', 0, 0);

    store.setPair('node.size', slot, 40, 24);
    expectFused(store, slot);
    expect(store.column('node.outerGeom')[slot * 4]).to.equal(20);
    expect(store.column('node.outerGeom')[slot * 4 + 1]).to.equal(12);
  });

  it('follows a border write', function () {
    const slot = store.addNode('a', 0, 0);

    store.setPair('node.size', slot, 40, 24);
    store.setScalar('node.borderWidth', slot, 6);
    expectFused(store, slot);
    expect(store.column('node.outerGeom')[slot * 4]).to.equal(23);
  });

  it('follows a shape write', function () {
    const slot = store.addNode('a', 0, 0);

    store.setScalar('node.shape', slot, 9); // diamond
    expectFused(store, slot);
    expect(store.column('node.outerGeom')[slot * 4 + 2]).to.equal(9);
  });

  it('marks the column dirty so the mirror uploads it', function () {
    const slot = store.addNode('a', 0, 0);

    store.takeDelta(); // clear the add's spans

    store.setScalar('node.shape', slot, 4);

    const delta = store.takeDelta();
    const span = delta.spans.find((r) => r.column === 'node.outerGeom');

    expect(span, 'a shape write must dirty node.outerGeom').to.exist;
    expect(span.start).to.be.at.most(slot);
    expect(span.end).to.be.above(slot);
  });

  it('stays in lockstep through a style-driven graph', function () {
    const cy = cytoscape({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
      ],
      style: {
        nodes: {
          width: 30,
          height: 20,
          shape: 'hexagon',
          'border-width': 4,
        },
      },
    });
    const store = cy._store;

    for (let slot = 0; slot < store.count('nodes'); slot++) {
      expectFused(store, slot);
    }

    // a restyle moves both sources; the fused column must follow
    cy.style({
      nodes: { width: 10, height: 10, shape: 'ellipse' },
    });

    for (let slot = 0; slot < store.count('nodes'); slot++) {
      expectFused(store, slot);
    }

    cy.destroy();
  });

  it('survives slot-moving compaction', function () {
    const slots = [];

    for (let i = 0; i < 8; i++) {
      slots.push(store.addNode(`n${i}`, i, i));
      store.setPair('node.size', slots[i], 10 + i, 20 + i);
      store.setScalar('node.shape', slots[i], i % 5);
    }

    // free the low slots so compaction moves the survivors down
    for (let i = 0; i < 5; i++) {
      store.removeNode(slots[i]);
    }

    store.compact();

    for (let slot = 0; slot < store.count('nodes'); slot++) {
      expectFused(store, slot);
    }
  });
});
