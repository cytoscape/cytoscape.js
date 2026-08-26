// Round 86.3: the worker-renderer protocol, exercised headless.
//
// The worker host's correctness rests on one claim: a `RemoteModelView`
// fed by `buildBatch` messages holds byte-identical columns, blobs,
// labels and counts to the canonical store it mirrors.  This file pins
// the claim in Node — batches cross a real structuredClone (the same
// machinery browser postMessage uses) — so a protocol regression fails
// here in the 90-second tier rather than only in a browser run.
//
// Controls: the mismatch assertions below are exercised by a
// deliberately-tampered batch (a dropped span must leave the column
// different), so the equality assertions are proven able to fail.

import './../node-test-setup.mjs';
import { expect } from 'chai';
import cytoscape from '../../src/index.mjs';
import {
  buildBatch,
  collectTransfers,
  LABEL_STREAMS,
  SPEC_BY_ID,
} from '../../src/render/worker-protocol.mjs';
import { RemoteModelView } from '../../src/render/remote-view.mjs';
import { COLUMN_SPECS } from '../../src/contract.mjs';
import { WorkerRenderer } from '../../src/render/worker-renderer.mjs';

const ARROWS = {
  ends: { source: true, target: true },
  mid: { source: false, target: false },
};
const VIEWPORT = { panX: 3, panY: -4, zoom: 1.5 };

const makeCy = () =>
  cytoscape({
    elements: {
      nodes: [
        { data: { id: 'p' } },
        { data: { id: 'a', parent: 'p', label: 'Alpha' } },
        { data: { id: 'b', parent: 'p' } },
        { data: { id: 'c' } },
      ],
      edges: [
        { data: { id: 'ab', source: 'a', target: 'b', label: 'ab' } },
        { data: { id: 'bc', source: 'b', target: 'c' } },
        { data: { id: 'bc2', source: 'b', target: 'c' } }, // bundles ⇒ curves
      ],
    },
    style: {
      nodes: { label: 'data(label)' },
      edges: { label: 'data(label)' },
    },
    layout: { name: 'grid' },
  });

/** every column compared over [0, highWater × components) */
const expectColumnsEqual = (cy, remote) => {
  const store = cy._store;

  for (const spec of COLUMN_SPECS) {
    const high = store.highWater(spec.group);
    const canonical = store.column(spec.id).slice(0, high * spec.components);
    const mirrored = remote.column(spec.id).slice(0, high * spec.components);

    expect([...mirrored], `column ${spec.id}`).to.deep.equal([...canonical]);
  }
};

const drain = (cy, state, full = false) => {
  cy._store.flushDerived();

  // the boundary itself: batches survive structured clone, as they must
  // to cross postMessage
  const batch = buildBatch(cy._store, ARROWS, VIEWPORT, state, full);

  expect(collectTransfers(batch).every((b) => b instanceof ArrayBuffer)).to.be
    .true;

  return structuredClone(batch);
};

describe('the worker-renderer protocol (round 86.3)', () => {
  it('mirrors the full state through the init batch', () => {
    const cy = makeCy();
    const remote = new RemoteModelView(() => {});
    const state = { parentOrderRef: null };

    remote.applyBatch(drain(cy, state, true));

    expectColumnsEqual(cy, remote);
    expect(remote.count('nodes')).to.equal(cy._store.count('nodes'));
    expect(remote.count('edges')).to.equal(cy._store.count('edges'));
    expect(remote.parentCount()).to.equal(cy._store.parentCount());
    expect(remote.hasCurvedEdges()).to.equal(cy._store.hasCurvedEdges());
    expect(remote.curveSlack()).to.equal(cy._store.curveSlack());
    expect([...remote.parentOrder()]).to.deep.equal([
      ...cy._store.parentOrder(),
    ]);
    expect([
      ...remote.curveBlob().slice(0, remote.curveBlobLength()),
    ]).to.deep.equal([
      ...cy._store.curveBlob().slice(0, cy._store.curveBlobLength()),
    ]);

    // labels crossed on every stream that has any
    const aSlot = cy._store.lookup('a').slot;

    expect(remote.labelAt(aSlot, 'nodes')).to.deep.equal(
      cy._store.labelAt(aSlot, 'nodes'),
    );
    cy.destroy();
  });

  it('mirrors an incremental drain, and its delta re-expresses the change', () => {
    const cy = makeCy();
    const remote = new RemoteModelView(() => {});
    const state = { parentOrderRef: null };

    remote.applyBatch(drain(cy, state, true));
    remote.takeDelta(); // settle to clean, as a frame would

    cy.$id('c').position({ x: 111, y: 222 });
    cy.$id('a').data('label', 'Alpha 2');

    remote.applyBatch(drain(cy, state));
    expectColumnsEqual(cy, remote);

    const aSlot = cy._store.lookup('a').slot;

    expect(remote.labelAt(aSlot, 'nodes').text).to.equal('Alpha 2');

    // the renderer's frame drains an ordinary StoreDelta out of the
    // remote view: the moved position must be inside a span
    const delta = remote.takeDelta();
    const span = delta.spans.find((s) => s.column === 'node.position');
    const cSlot = cy._store.lookup('c').slot;

    expect(span, 'a node.position span').to.not.equal(undefined);
    expect(span.start).to.be.at.most(cSlot);
    expect(span.end).to.be.above(cSlot);
    cy.destroy();
  });

  it('mirrors growth: added elements resize and re-transfer in full', () => {
    const cy = makeCy();
    const remote = new RemoteModelView(() => {});
    const state = { parentOrderRef: null };

    remote.applyBatch(drain(cy, state, true));

    for (let i = 0; i < 200; i++) {
      cy.add({ data: { id: `n${i}` }, position: { x: i, y: -i } });
    }

    remote.applyBatch(drain(cy, state));
    expectColumnsEqual(cy, remote);
    expect(remote.capacity('nodes')).to.equal(cy._store.capacity('nodes'));
    expect(remote.highWater('nodes')).to.equal(cy._store.highWater('nodes'));
    cy.destroy();
  });

  it('control: a tampered batch leaves the mirror wrong, provably', () => {
    const cy = makeCy();
    const remote = new RemoteModelView(() => {});
    const state = { parentOrderRef: null };

    remote.applyBatch(drain(cy, state, true));
    cy.$id('c').position({ x: 999, y: 999 });

    const batch = drain(cy, state);
    const tampered = {
      ...batch,
      spans: batch.spans.filter((s) => s.column !== 'node.position'),
    };

    remote.applyBatch(tampered);

    const spec = SPEC_BY_ID.get('node.position');
    const high = cy._store.highWater('nodes');
    const canonical = cy._store
      .column('node.position')
      .slice(0, high * spec.components);
    const mirrored = remote
      .column('node.position')
      .slice(0, high * spec.components);

    expect([...mirrored]).to.not.deep.equal([...canonical]);
    cy.destroy();
  });

  it('queues measured label dims and posts them once per burst', async () => {
    const posted = [];
    const remote = new RemoteModelView((dims) => posted.push(dims));

    remote.setLabelDims(0, 'nodes', 10, 4);
    remote.setLabelDims(1, 'nodes', 12, 4);
    expect(posted).to.have.length(0); // batched to the microtask

    await Promise.resolve();
    expect(posted).to.have.length(1);
    expect(posted[0]).to.deep.equal([
      ['nodes', 0, 10, 4],
      ['nodes', 1, 12, 4],
    ]);
  });

  it('marks every labelled slot dirty on markAllLabelsDirty', () => {
    const cy = makeCy();
    const remote = new RemoteModelView(() => {});
    const state = { parentOrderRef: null };

    remote.applyBatch(drain(cy, state, true));

    for (const stream of LABEL_STREAMS) {
      remote.takeLabelDirty(stream); // settle
    }

    remote.markAllLabelsDirty();

    const aSlot = cy._store.lookup('a').slot;

    expect(remote.takeLabelDirty('nodes')).to.include(aSlot);
    cy.destroy();
  });

  it('rejects a worker mount loudly where Worker/OffscreenCanvas are missing', () => {
    // Node has neither; the mount must throw its clear message rather
    // than fall back to the main thread silently
    expect(() => new WorkerRenderer({}, {})).to.throw(
      /Worker and OffscreenCanvas/,
    );
  });
});
