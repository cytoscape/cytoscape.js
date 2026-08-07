import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { GraphStore } from '../src/store/graph-store.mjs';
import { Animation, AnimationManager } from '../src/animation.mjs';

/*
Round 19.3 — ref forwarding + lazy repair.  A compaction moves live
elements to new slots with fresh generations; user-held refs must keep
working: a forwarding table maps each moved (slot, gen) to its new
identity, stale refs repair *in place* on first touch (fixing every
holder of that object), interned handles keep their identity (and their
scratch), packed membership caches invalidate by epoch, element-bound
event listeners keep firing and stay removable, and animation slot
lists re-point.  Removed elements stay dead — repair never resurrects.
*/

const FILLER = 24;

function makeCy() {
  const elements = [];

  for (let i = 0; i < FILLER; i++) {
    elements.push({ data: { id: `x${i}` } });
  }

  elements.push(
    { data: { id: 'a' }, position: { x: 10, y: 20 } },
    { data: { id: 'b' }, position: { x: 30, y: 40 } },
    { data: { id: 'c' }, position: { x: 50, y: 60 } },
    { data: { id: 'ab', source: 'a', target: 'b' } },
    { data: { id: 'bc', source: 'b', target: 'c' } },
  );

  return cytoscape({ elements });
}

function removeFiller(cy) {
  for (let i = 0; i < FILLER; i++) {
    cy.getElementById(`x${i}`).remove();
  }
}

describe('gpu: ref forwarding across compaction (19.3)', function () {
  it('repairs held collections: reads and bulk writes keep working', function () {
    const cy = makeCy();
    const held = cy.nodes().filter((ele) => ['a', 'b', 'c'].includes(ele.id()));
    const heldEdges = cy.edges();

    removeFiller(cy);
    cy._compact();

    expect(held.map((ele) => ele.id()).sort()).to.eql(['a', 'b', 'c']);
    expect(held.filter((ele) => ele.id() === 'a').position()).to.eql({
      x: 10,
      y: 20,
    });

    held.select(); // bulk flag path over repaired refs

    expect(cy.nodes({ selected: true }).length).to.equal(3);

    held.shift({ x: 1, y: 0 }); // bulk position path

    expect(cy.getElementById('a').position()).to.eql({ x: 11, y: 20 });
    expect(heldEdges.map((ele) => ele.id()).sort()).to.eql(['ab', 'bc']);
  });

  it('keeps interned handle identity and scratch across a compaction', function () {
    const cy = makeCy();
    const handle = cy.getElementById('b');

    handle.scratch('note', { kept: true });

    removeFiller(cy);
    cy._compact();

    expect(cy.getElementById('b')).to.equal(handle); // same singleton
    expect(handle.id()).to.equal('b');
    expect(handle.position()).to.eql({ x: 30, y: 40 });
    expect(handle.scratch('note')).to.eql({ kept: true });
    expect(
      handle
        .connectedEdges()
        .map((e) => e.id())
        .sort(),
    ).to.eql(['ab', 'bc']);
  });

  it('set operations agree across the compaction epoch', function () {
    const cy = makeCy();

    cy.getElementById('a').select();
    cy.getElementById('c').select();

    const before = cy.nodes({ selected: true }); // built pre-compaction

    removeFiller(cy);
    cy._compact();

    const after = cy.nodes({ selected: true }); // built post-compaction

    expect(before.length).to.equal(2);
    expect(before.same(after)).to.equal(true);
    expect(before.intersection(after).length).to.equal(2);
    expect(before.contains(cy.getElementById('a'))).to.equal(true);
    expect(
      cy
        .nodes()
        .difference(before)
        .map((e) => e.id()),
    ).to.eql(['b']);
  });

  it('never resurrects removed elements', function () {
    const cy = makeCy();
    const doomed = cy.getElementById('x3');
    const alive = cy.getElementById('a');

    removeFiller(cy);
    cy._compact();

    expect(doomed.id()).to.equal('x3'); // cached id stays readable
    expect(doomed.inside()).to.equal(false);
    expect(doomed.removed()).to.equal(true);
    expect(alive.inside()).to.equal(true);
  });

  it('keeps element-bound listeners firing and removable', function () {
    const cy = makeCy();
    const held = cy.getElementById('a');
    let calls = 0;
    const handler = () => {
      calls++;
    };

    held.on('custom', handler);

    removeFiller(cy);
    cy._compact();

    cy.getElementById('a').emit('custom');
    expect(calls).to.equal(1);

    // off() through a *fresh* post-compaction handle must match the
    // listener registered against the pre-compaction identity
    cy.getElementById('a').off('custom', handler);
    cy.getElementById('a').emit('custom');
    expect(calls).to.equal(1);
  });

  it('chains forwarding across consecutive compactions', function () {
    const cy = makeCy();
    const held = cy.getElementById('c');
    const heldRef = held._refs[0];
    const firstSlot = heldRef.slot;

    for (let i = 0; i < 12; i++) {
      cy.getElementById(`x${i}`).remove();
    }

    cy._compact();

    for (let i = 12; i < FILLER; i++) {
      cy.getElementById(`x${i}`).remove();
    }

    cy._compact(); // 'c' moves again

    expect(held.id()).to.equal('c');
    expect(held.position()).to.eql({ x: 50, y: 60 });
    expect(heldRef.slot).to.be.lessThan(firstSlot);
    expect(cy.getElementById('c')).to.equal(held);
  });

  it('repairs a mid-flight animation onto the moved slot', function () {
    const store = new GraphStore();

    for (let i = 0; i < 8; i++) {
      store.addNode(`x${i}`, 0, 0);
    }

    const a = store.addNode('a', 0, 0);
    const ref = store.ref('nodes', a);
    const ani = new Animation(store, null, [ref], false, {
      position: { x: 100, y: 40 },
      duration: 400,
      easing: 'linear',
    });

    ani.tick(1000);
    ani.tick(1200); // halfway: (50, 20)

    for (let i = 0; i < 8; i++) {
      const r = store.lookup(`x${i}`);

      store.removeNode(r.slot);
    }

    store.compact();
    ani.repairRefs(store);

    const slot = store.lookup('a').slot;

    expect(slot).to.equal(0);
    expect(ani.tick(1400)).to.equal(true);

    const pos = store.column('node.position');

    expect(pos[slot * 2]).to.equal(100);
    expect(pos[slot * 2 + 1]).to.equal(40);
  });

  it('re-keys the animation queues through the repair', function () {
    const store = new GraphStore();

    for (let i = 0; i < 6; i++) {
      store.addNode(`x${i}`, 0, 0);
    }

    const a = store.addNode('a', 0, 0);
    const ref = store.ref('nodes', a);
    const mgr = new AnimationManager(() => {});
    const ani = new Animation(store, null, [ref], false, {
      position: { x: 9, y: 9 },
      duration: 100,
      easing: 'linear',
    });

    mgr.start(ani);
    expect(mgr.isAnimating(ref)).to.equal(true);

    for (let i = 0; i < 6; i++) {
      store.removeNode(store.lookup(`x${i}`).slot);
    }

    store.compact();
    mgr.onCompacted(store);

    const newRef = store.lookup('a');

    expect(newRef.slot).to.equal(0);
    expect(mgr.isAnimating(store.ref('nodes', newRef.slot))).to.equal(true);
  });

  it('refuses to compact inside a batch', function () {
    const cy = makeCy();

    cy.startBatch();

    expect(() => cy._compact()).to.throw(/batch/i);

    cy.endBatch();
  });
});
