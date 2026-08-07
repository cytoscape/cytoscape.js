import { expect } from 'chai';

import cytoscape from '../../src/index.mjs';

/*
Round 48.1: does an instance actually go away?

The obvious way to test for a leak is to count bytes, and it is the wrong
one. Measured while writing this file: 1000 create/destroy cycles of a
400-element graph grow `heapUsed` by a steady ~2.2 KB per cycle — linear,
not asymptotic, which reads exactly like a leak. It is not one. Holding a
`WeakRef` to each destroyed core and forcing collection shows every one of
them collected; what grows is V8's own bookkeeping (compiled code, inline
caches, hidden classes for a heavily polymorphic surface), which a byte
bound would encode as a contract.

So the gate is **reachability**, which is the property the contract actually
states, and the byte bound survives only as a backstop wide enough that
V8 noise passes and a real leak cannot.

These run under `--expose-gc` (`npm run test:soak`), which is why they are
here rather than in `test/`: `global.gc` is the only way to distinguish
"collected" from "not collected yet", and a leak spec that cannot force a
collection is a flake generator.
*/

const graph = (n = 100) => {
  const elements = [];

  for (let i = 0; i < n; i++) {
    elements.push({ data: { id: `n${i}`, w: i }, position: { x: i, y: i } });
  }

  for (let i = 1; i < n; i++) {
    elements.push({
      data: { id: `e${i}`, source: `n${i - 1}`, target: `n${i}` },
    });
  }

  return elements;
};

/** Force collection, giving finalizers a turn between passes. */
const collect = async () => {
  for (let i = 0; i < 3; i++) {
    global.gc();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

const aliveOf = (refs) =>
  refs.filter((ref) => ref.deref() !== undefined).length;

describe('soak: instance lifecycle', () => {
  it('has a working reachability probe (the control for everything below)', async () => {
    // If `global.gc` did nothing, or WeakRef never cleared, every spec in
    // this file would pass by doing nothing. So: held instances must stay
    // reachable, and unheld ones must not.
    const held = [];
    const heldRefs = [];
    const droppedRefs = [];

    for (let i = 0; i < 40; i++) {
      const kept = cytoscape({ elements: graph(20) });

      held.push(kept);
      heldRefs.push(new WeakRef(kept));
      droppedRefs.push(new WeakRef(cytoscape({ elements: graph(20) })));
    }

    await collect();

    expect(
      aliveOf(heldRefs),
      'a held instance was collected — the probe is broken',
    ).to.equal(40);
    expect(
      aliveOf(droppedRefs),
      'unheld instances were not collected — gc is not running',
    ).to.be.at.most(1);

    held.forEach((cy) => cy.destroy());
  });

  it('releases a destroyed instance', async () => {
    const refs = [];

    for (let i = 0; i < 60; i++) {
      const cy = cytoscape({ elements: graph() });

      cy.on('tap', () => {});
      cy.nodes().forEach((n) => n.on('position', () => {}));
      cy.layout({ name: 'grid' }).run();
      cy.$id('n1').data('note', `value-${i}`);
      refs.push(new WeakRef(cy));
      cy.destroy();
    }

    await collect();

    // at most the last one, which the loop variable may still pin
    expect(
      aliveOf(refs),
      'destroyed instances are being retained somewhere',
    ).to.be.at.most(1);
  });

  it('holds nothing after destroy even when the app kept a collection', async () => {
    // The realistic shape: an app holds a query result past teardown. The
    // collection keeps the *handles* alive by design, and the question is
    // whether that transitively pins the store and its columns.
    let survivor = null;
    const refs = [];

    for (let i = 0; i < 40; i++) {
      const cy = cytoscape({ elements: graph() });

      if (i === 0) survivor = cy.nodes();

      refs.push(new WeakRef(cy));
      cy.destroy();
    }

    await collect();

    // instance 0 is pinned through the collection the app kept — that is the
    // documented consequence of holding one, not a leak — and the other 39
    // must go.
    expect(
      aliveOf(refs),
      'more than the deliberately-held instance survived',
    ).to.be.at.most(2);
    expect(survivor.length).to.equal(100);
  });

  it('removes every listener on destroy', () => {
    const cy = cytoscape({ elements: graph() });

    cy.on('tap', () => {});
    cy.on('pan zoom', () => {});
    cy.nodes().forEach((n) => n.on('position data', () => {}));

    expect(cy._emitter.listeners.length).to.be.greaterThan(100);

    cy.destroy();

    expect(
      cy._emitter.listeners.length,
      'destroy left listeners behind',
    ).to.equal(0);
  });

  it('returns to zero listeners when handlers are removed one by one', () => {
    // The other direction: an app that adds and removes listeners over a
    // long session must not accumulate them.
    const cy = cytoscape({ elements: graph(20) });
    const before = cy._emitter.listeners.length;
    const handlers = [];

    for (let i = 0; i < 2000; i++) {
      const handler = () => {};

      handlers.push(handler);
      cy.on('tap', handler);
    }

    expect(cy._emitter.listeners.length).to.equal(before + 2000);

    handlers.forEach((handler) => cy.off('tap', handler));

    expect(
      cy._emitter.listeners.length,
      'off() did not remove what on() added',
    ).to.equal(before);

    cy.destroy();
  });

  it('is idempotent, and stays queryable for the reads that survive', () => {
    const cy = cytoscape({ elements: graph(10) });
    const node = cy.$id('n1');

    cy.destroy();
    cy.destroy();
    cy.destroy();

    expect(cy.destroyed()).to.equal(true);
    // the cached identity reads that survive removal survive destruction too
    expect(node.id()).to.equal('n1');
  });

  it('does not grow without bound over a thousand cycles', async () => {
    // The backstop, deliberately loose. See the header: the per-cycle byte
    // growth here is V8's, not the library's, and pinning it tightly would
    // encode the engine's behaviour as a contract. What this catches is the
    // order-of-magnitude case — a retained store or column set per cycle.
    const cycle = (i) => {
      const cy = cytoscape({ elements: graph(200) });

      cy.on('tap', () => {});
      cy.$id('n1').data('note', `value-${i}`);
      cy.layout({ name: 'grid' }).run();
      cy.destroy();
    };

    for (let i = 0; i < 100; i++) cycle(i);

    await collect();

    const before = process.memoryUsage().heapUsed;
    const cycles = 1000;

    for (let i = 0; i < cycles; i++) cycle(i);

    await collect();

    const perCycle = (process.memoryUsage().heapUsed - before) / cycles;

    // a 400-element graph's own columns are tens of KB; retaining one per
    // cycle would land far above this, while the measured V8 drift is ~2 KB
    expect(
      perCycle,
      `heap grew ${perCycle.toFixed(0)} B per create/destroy cycle`,
    ).to.be.below(20000);
  });
});
