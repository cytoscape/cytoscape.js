import { expect } from 'chai';
import cytoscape from '../src/headless.mjs';
import { GraphStore } from '../src/store/graph-store.mjs';
import { DirtyTracker } from '../src/store/dirty.mjs';
import { COL, COLUMN_SPECS } from '../src/contract.mjs';

/*
Round 106.2: consumer cursors on the dirty stream.

The renderer's frame used to be the only reader of `takeDelta()`, and the
drain is destructive — so a second reader (a following clone's trigger, a
devtools observer) would starve it, or be starved by it.  The first spec
here is the plan's control: two raw `takeDelta()` calls, the second of
which sees nothing.  Everything after it runs the same situations through
`registerConsumer()` and asserts the second reader is whole.

The convergence spec is the round-46.5 columns-equal method applied to
the stream itself: two consumers each keep a byte mirror of every
`COLUMN_SPECS` column and the curve blob, updated *only* from their own
deltas, at different cadences over a seeded mutation mix — and at the end
both mirrors equal the store's columns byte for byte.
*/

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const spanFor = (delta, column) => delta.spans.find((s) => s.column === column);

/** A byte mirror of the store's columns and curve blob, fed only by deltas. */
class Mirror {
  constructor(store) {
    this.store = store;
    this.cols = new Map();
    this.blob = new Float32Array(0);
  }

  bytes(spec) {
    const col = this.store.column(spec.id);

    return new Uint8Array(col.buffer, col.byteOffset, col.byteLength);
  }

  apply(delta) {
    for (const spec of COLUMN_SPECS) {
      const hw =
        spec.group === 'nodes' ? delta.nodeHighWater : delta.edgeHighWater;
      const src = this.bytes(spec);
      const bps = spec.bytesPerSlot;
      let dst = this.cols.get(spec.id) ?? new Uint8Array(0);

      if (dst.length < hw * bps) {
        const grown = new Uint8Array(hw * bps);

        grown.set(dst.subarray(0, Math.min(dst.length, grown.length)));
        dst = grown;
        this.cols.set(spec.id, dst);
      }

      if (delta.resized[spec.group]) {
        dst.set(src.subarray(0, hw * bps));
        continue;
      }

      const span = spanFor(delta, spec.id);

      if (span != null) {
        dst.set(
          src.subarray(span.start * bps, span.end * bps),
          span.start * bps,
        );
      }
    }

    const cb = delta.curveBlob;

    if (cb != null) {
      const src = this.store.curveBlob();

      if (this.blob.length < cb.end) {
        const grown = new Float32Array(cb.end);

        grown.set(this.blob.subarray(0, Math.min(this.blob.length, cb.end)));
        this.blob = grown;
      }

      this.blob.set(src.subarray(cb.start, cb.end), cb.start);
    }
  }

  /** Every column equal to the store over [0, highWater); the blob over its used length. */
  equalsStore() {
    const diffs = [];

    for (const spec of COLUMN_SPECS) {
      const hw = this.store.highWater(spec.group) * spec.bytesPerSlot;
      const src = this.bytes(spec).subarray(0, hw);
      const dst = (this.cols.get(spec.id) ?? new Uint8Array(0)).subarray(0, hw);

      if (dst.length !== src.length || dst.some((b, i) => b !== src[i])) {
        diffs.push(spec.id);
      }
    }

    const used = this.store.curveBlobLength();
    const blob = this.store.curveBlob().subarray(0, used);

    if (
      this.blob.length < used ||
      blob.some((v, i) => !Object.is(v, this.blob[i]))
    ) {
      diffs.push('curveBlob');
    }

    return diffs;
  }
}

describe('gpu/store: dirty-stream consumer cursors (round 106)', function () {
  it('control: a second raw takeDelta() reader starves', function () {
    const store = new GraphStore();

    store.addNode('a', 0, 0);
    store.takeDelta();
    store.setPosition(0, 5, 5);

    const first = store.takeDelta();
    const second = store.takeDelta();

    expect(spanFor(first, COL.NODE_POSITION)).to.exist;
    expect(
      spanFor(second, COL.NODE_POSITION),
      'the second reader saw the write — the drain is no longer destructive',
    ).to.not.exist;
  });

  it('a registered consumer sees what the primary drained, and vice versa', function () {
    const store = new GraphStore();

    store.addNode('a', 0, 0);
    store.addNode('b', 0, 0);
    store.takeDelta();

    const consumer = store.registerConsumer();

    consumer.take(); // the full sync

    store.setPosition(1, 5, 5);
    expect(spanFor(store.takeDelta(), COL.NODE_POSITION)).to.deep.include({
      start: 1,
      end: 2,
    });
    expect(consumer.hasDirty()).to.be.true;
    expect(spanFor(consumer.take(), COL.NODE_POSITION)).to.deep.include({
      start: 1,
      end: 2,
    });

    store.setPosition(0, 7, 7);
    expect(spanFor(consumer.take(), COL.NODE_POSITION)).to.deep.include({
      start: 0,
      end: 1,
    });
    expect(store.hasDirty()).to.be.true;
    expect(spanFor(store.takeDelta(), COL.NODE_POSITION)).to.deep.include({
      start: 0,
      end: 1,
    });

    expect(store.hasDirty()).to.be.false;
    expect(consumer.hasDirty()).to.be.false;
    consumer.dispose();
  });

  it('a late registrant starts with a full sync', function () {
    const store = new GraphStore();

    store.addNode('a', 0, 0);
    store.addNode('b', 0, 0);
    store.addEdge('ab', 'a', 'b');
    store.takeDelta();

    const consumer = store.registerConsumer();

    expect(consumer.hasDirty()).to.be.true;
    expect(store.hasDirty(), 'registering dirtied the primary').to.be.false;

    const delta = consumer.take();

    expect(delta.resized).to.deep.equal({ nodes: true, edges: true });
    expect(delta.nodeHighWater).to.equal(2);
    expect(delta.edgeHighWater).to.equal(1);
    expect(delta.curveBlob?.resized).to.be.true;
    expect(delta.dataWritten).to.be.true;
    expect(consumer.hasDirty()).to.be.false;
    consumer.dispose();
  });

  it('two consumers at different cadences both converge on the columns', function () {
    const cy = cytoscape({
      style: {
        nodes: { width: { data: 'w' }, 'background-color': { data: 'c' } },
        // segments, not bezier: a bundled-bezier fixture never writes the
        // curve blob (its params ride the column), and with bezier here
        // the blob fold could be deleted with this spec still green —
        // the control that found it
        edges: { 'curve-style': 'segments', width: 2 },
      },
    });
    const store = cy._store;
    const primary = new Mirror(store);
    const other = new Mirror(store);
    const consumer = store.registerConsumer();
    let seed = 7;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;

      return seed / 0x7fffffff;
    };
    let next = 0;
    const live = () => cy.nodes().map((n) => n.id());

    primary.apply(store.takeDelta());

    for (let step = 0; step < 400; step++) {
      const r = rand();
      const ids = live();
      const pick = () => ids[Math.floor(rand() * ids.length)];

      if (r < 0.3 || ids.length < 4) {
        const id = 'n' + next++;

        cy.add({
          data: { id, w: 10 + (next % 7), c: next % 2 ? 'red' : 'blue' },
          position: { x: rand() * 500, y: rand() * 500 },
        });

        if (ids.length > 0) {
          const other = pick();

          cy.add({ data: { id: 'e' + next, source: id, target: other } });
          cy.add({ data: { id: 'f' + next, source: id, target: other } });
        }
      } else if (r < 0.55) {
        cy.$id(pick()).position({ x: rand() * 500, y: rand() * 500 });
      } else if (r < 0.7) {
        cy.$id(pick()).data('w', 5 + Math.floor(rand() * 40));
      } else if (r < 0.8) {
        cy.$id(pick()).select();
      } else if (r < 0.9) {
        cy.$id(pick()).remove();
      } else if (r < 0.95) {
        cy.$id(pick()).data('note', step); // unwatched
      } else {
        cy.compact();
      }

      // the renderer drains every step; the other reader every third
      primary.apply(store.takeDelta());

      if (step % 3 === 2) {
        other.apply(consumer.take());
      }
    }

    // one last drain each (the other reader's cadence left it behind)
    primary.apply(store.takeDelta());
    other.apply(consumer.take());

    expect(cy.nodes().length, 'the mix left a graph').to.be.above(10);
    expect(primary.equalsStore(), 'the primary mirror diverged').to.deep.equal(
      [],
    );
    expect(other.equalsStore(), 'the second mirror diverged').to.deep.equal([]);

    consumer.dispose();
    cy.destroy();
  });

  it('the convergence mirror catches a lost span (its own control)', function () {
    const store = new GraphStore();
    const mirror = new Mirror(store);

    store.addNode('a', 0, 0);
    store.addNode('b', 0, 0);
    mirror.apply(store.takeDelta());
    expect(mirror.equalsStore()).to.deep.equal([]);

    store.setPosition(1, 9, 9);
    store.takeDelta(); // drained elsewhere: the mirror never sees it
    expect(mirror.equalsStore()).to.include(COL.NODE_POSITION);
  });

  it('wakes each consumer: a synchronous drain by one does not cancel the other', async function () {
    const store = new GraphStore();

    store.addNode('a', 0, 0);
    store.takeDelta();

    const consumer = store.registerConsumer();

    consumer.take();
    await tick(); // the registration's own wake

    let primaryWakes = 0;
    let consumerWakes = 0;

    store.onInvalidate(() => primaryWakes++);
    consumer.onInvalidate(() => consumerWakes++);

    store.setPosition(0, 1, 1);
    store.takeDelta(); // the primary drains synchronously
    await tick();

    expect(primaryWakes, 'the primary drained, so it is not woken').to.equal(0);
    expect(consumerWakes, 'the drain cancelled the peer').to.equal(1);

    store.setPosition(0, 2, 2);
    consumer.take(); // now the other way round
    await tick();

    expect(primaryWakes).to.equal(1);
    expect(consumerWakes).to.equal(1);
    consumer.dispose();
  });

  it('control: the tracker alone wakes nobody after a synchronous drain', async function () {
    // the pre-106 bail, which the per-consumer wake must keep for the
    // primary: a synchronous take before the microtask skips the wake
    const tracker = new DirtyTracker();
    let wakes = 0;

    tracker.onInvalidate(() => wakes++);
    tracker.mark(COL.NODE_POSITION, 0);
    tracker.take(1, 0);
    await tick();
    expect(wakes).to.equal(0);
  });

  it('reports unwatched data writes to consumers only', async function () {
    const cy = cytoscape({ elements: [{ data: { id: 'a' } }] });
    const store = cy._store;

    store.takeDelta();
    await tick();

    cy.$id('a').data('note', 1);
    expect(store.hasDirty(), 'no consumer: an unwatched write is free').to.be
      .false;

    const consumer = store.registerConsumer();

    consumer.take();
    cy.$id('a').data('note', 2);

    expect(consumer.hasDirty()).to.be.true;
    expect(consumer.take().dataWritten).to.be.true;
    expect(store.hasDirty(), 'the primary saw an unwatched write').to.be.false;
    expect(store.takeDelta().dataWritten).to.be.undefined;

    consumer.dispose();
    cy.destroy();
  });

  it('folds the mapper spans for every consumer', function () {
    const cy = cytoscape({
      elements: [{ data: { id: 'a', w: 1 } }, { data: { id: 'b', w: 2 } }],
      style: { nodes: { width: { data: 'w' } } },
    });
    const store = cy._store;

    store.watchDataKeys('nodes', ['w']);
    store.takeMapperSpans();

    const consumer = store.registerConsumer();
    const full = consumer.takeMapperSpans();

    expect(full).to.deep.equal([
      { group: 'nodes', key: 'w', start: 0, end: 2 },
    ]);

    cy.$id('b').data('w', 9);
    expect(store.takeMapperSpans()).to.deep.equal([
      { group: 'nodes', key: 'w', start: 1, end: 2 },
    ]);
    expect(consumer.takeMapperSpans()).to.deep.equal([
      { group: 'nodes', key: 'w', start: 1, end: 2 },
    ]);
    expect(store.takeMapperSpans()).to.deep.equal([]);

    consumer.dispose();
    cy.destroy();
  });

  it('a disposed consumer takes nothing and stops folding', async function () {
    const store = new GraphStore();

    store.addNode('a', 0, 0);
    store.takeDelta();

    const consumer = store.registerConsumer();
    let wakes = 0;

    consumer.onInvalidate(() => wakes++);
    consumer.dispose();
    consumer.dispose(); // idempotent

    store.setPosition(0, 3, 3);
    await tick();

    expect(wakes).to.equal(0);
    expect(consumer.hasDirty()).to.be.false;
    expect(consumer.take().spans).to.deep.equal([]);
    expect(consumer.takeMapperSpans()).to.deep.equal([]);
    expect(store.consumers).to.have.length(0);
    expect(spanFor(store.takeDelta(), COL.NODE_POSITION)).to.exist;
  });
});
