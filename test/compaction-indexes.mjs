import { expect } from 'chai';
import { GraphStore } from '../src/store/graph-store.mjs';
import { CURVE_STYLE_BEZIER } from '../src/store/curve-index.mjs';

/*
Round 19.2 — the dependent store indexes under slot compaction: the
compound hierarchy, the curve index (+ blobs), the data() sidecar
(in-place — bound mapper evaluators hold the column buffers by
reference), the label sidecar, and the misc slot-keyed maps.  The remap
is monotone, so derived curve params must come through byte-identical
with no re-derivation; everything else must simply answer the same
through the moved slots.
*/

function removeNodeCascade(store, id) {
  const ref = store.lookup(id);

  for (const edgeSlot of store.adj.connectedEdges(ref.slot)) {
    store.removeEdge(edgeSlot);
  }

  store.removeNode(ref.slot);
}

/** `count` filler nodes 'x0'.., removed later to punch low-slot holes. */
function addFiller(store, count) {
  for (let i = 0; i < count; i++) {
    store.addNode(`x${i}`, -1000 - i, 0);
  }
}

function removeFiller(store, count) {
  for (let i = 0; i < count; i++) {
    removeNodeCascade(store, `x${i}`);
  }
}

const label = (text) => ({
  text,
  fontSize: 12,
  color: 0xff000000,
  anchorY: 0,
  marginX: 0,
  marginY: 0,
});

describe('gpu/store: compaction of dependent indexes (19.2)', function () {
  it('remaps the compound hierarchy: links, depth, order, styles', function () {
    const store = new GraphStore();

    addFiller(store, 20);

    const p = store.addNode('p', 0, 0);
    const q = store.addNode('q', 0, 0);
    const a = store.addNode('a', 10, 10);
    const b = store.addNode('b', 50, 50);
    const c = store.addNode('c', 30, 40);

    store.setParent(a, p);
    store.setParent(b, p);
    store.setParent(c, q);
    store.setParent(q, p); // nested: p > { a, b, q > c }
    store.setCompoundStyle(p, { padding: 7, paddingUnit: 'px' });
    store.flushDerived();

    const pWBefore = store.column('node.size')[p * 2];

    removeFiller(store, 20);
    store.compact();

    const pRef = store.lookup('p');
    const qRef = store.lookup('q');
    const aRef = store.lookup('a');
    const cRef = store.lookup('c');

    expect(store.parentOf(aRef.slot)).to.equal(pRef.slot);
    expect(store.parentOf(cRef.slot)).to.equal(qRef.slot);
    expect(store.parentOf(qRef.slot)).to.equal(pRef.slot);
    expect(store.depthOf(cRef.slot)).to.equal(2);
    expect(Array.from(store.childrenOf(pRef.slot)).sort()).to.eql(
      [aRef.slot, store.lookup('b').slot, qRef.slot].sort(),
    );
    expect(store.parentCount()).to.equal(2);
    expect(store.paddingOf(pRef.slot)).to.equal(7);

    // derived geometry identical at the new slot
    expect(store.column('node.size')[pRef.slot * 2]).to.equal(pWBefore);

    // the draw permutation regenerates over the new slots, outer first
    const order = Array.from(store.parentOrder());

    expect(order).to.eql([pRef.slot, qRef.slot]);

    // auto-bounds keep flowing: move a child, parent re-derives
    store.setPosition(aRef.slot, 200, 200);
    store.flushDerived();

    expect(store.column('node.size')[pRef.slot * 2]).to.be.greaterThan(
      pWBefore,
    );
  });

  it('keeps derived curve params byte-identical (monotone bundles + loops)', function () {
    const store = new GraphStore();

    addFiller(store, 16);

    store.addNode('a', 0, 0);
    store.addNode('b', 100, 0);

    const e1 = store.addEdge('e1', 'a', 'b');
    const e2 = store.addEdge('e2', 'b', 'a'); // opposite direction: sign matters
    const e3 = store.addEdge('e3', 'a', 'b');
    const loop = store.addEdge('loop', 'a', 'a');

    for (const slot of [e1, e2, e3, loop]) {
      store.setCurveStyle(slot, CURVE_STYLE_BEZIER, 40, 0.5, 0, Math.PI / 2);
    }

    store.flushDerived();

    const before = {};

    for (const id of ['e1', 'e2', 'e3', 'loop']) {
      before[id] = store.curveParamsAt(store.lookup(id).slot);
    }

    removeFiller(store, 16);
    store.compact();
    store.flushDerived();

    for (const id of ['e1', 'e2', 'e3', 'loop']) {
      expect(store.curveParamsAt(store.lookup(id).slot), id).to.eql(before[id]);
      expect(store.curveStyleAt(store.lookup(id).slot).style).to.equal(
        CURVE_STYLE_BEZIER,
      );
    }

    // the rebuilt pair index still re-derives on later membership changes
    const e4 = store.addEdge('e4', 'a', 'b');

    store.setCurveStyle(e4, CURVE_STYLE_BEZIER, 40, 0.5, 0, Math.PI / 2);
    store.flushDerived();

    const grown = store.curveParamsAt(store.lookup('e1').slot);

    expect(grown).to.not.eql(before.e1); // a 4th member restaggers the bundle
  });

  it('moves the data() sidecar in place: numbers, strings, mixed', function () {
    const store = new GraphStore();

    addFiller(store, 12);

    const a = store.addNode('a', 0, 0);
    const b = store.addNode('b', 0, 0);

    store.setData('nodes', a, 'weight', 42);
    store.setData('nodes', a, 'type', 'protein');
    store.setData('nodes', a, 'meta', { deep: true });
    store.setData('nodes', b, 'type', 'gene');

    // the in-place constraint: a reader bound to the column buffers
    // before compaction must see the moved values afterward
    const col = store.data.column('nodes', 'weight');

    removeFiller(store, 12);
    store.compact();

    const aRef = store.lookup('a');
    const bRef = store.lookup('b');

    expect(store.data.get('nodes', aRef.slot, 'weight')).to.equal(42);
    expect(store.data.get('nodes', aRef.slot, 'type')).to.equal('protein');
    expect(store.data.get('nodes', aRef.slot, 'meta')).to.eql({ deep: true });
    expect(store.data.get('nodes', bRef.slot, 'type')).to.equal('gene');

    expect(store.data.column('nodes', 'weight')).to.equal(col); // same object
    expect(col.values[aRef.slot]).to.equal(42);
    expect(col.present[aRef.slot]).to.equal(1);
  });

  it('re-emits whole-column mapper spans for watched keys', function () {
    const store = new GraphStore();

    addFiller(store, 8);

    const a = store.addNode('a', 0, 0);

    store.watchDataKeys('nodes', ['w']);
    store.setData('nodes', a, 'w', 1);
    store.takeMapperSpans(); // drain

    removeFiller(store, 8);
    store.compact();

    const spans = store.takeMapperSpans();
    const wSpan = spans.find((s) => s.group === 'nodes' && s.key === 'w');

    expect(wSpan).to.exist;
    expect(wSpan.start).to.equal(0);
    expect(wSpan.end).to.equal(store.highWater('nodes'));
  });

  it('moves the label sidecar: entries, dims and dirty slots', function () {
    const store = new GraphStore();

    addFiller(store, 10);

    const a = store.addNode('a', 0, 0);

    store.addNode('b', 10, 0);

    const e = store.addEdge('e', 'a', 'b');

    store.setLabel(a, label('node label'));
    store.setLabel(e, label('edge label'), 'edges');
    store.setLabelDims(a, 'nodes', 80, 14);
    store.takeLabelDirty('nodes');
    store.takeLabelDirty('edges');

    removeFiller(store, 10);
    store.compact();

    const aRef = store.lookup('a');
    const eRef = store.lookup('e');

    expect(store.labelAt(aRef.slot).text).to.equal('node label');
    expect(store.labelAt(eRef.slot, 'edges').text).to.equal('edge label');
    expect(store.labelDimsAt(aRef.slot)).to.include({ w: 80, h: 14 });

    // dirty slots re-point at the new slots (the renderer rebuilds runs)
    const dirty = store.takeLabelDirty('nodes');

    expect(dirty).to.contain(aRef.slot);
  });

  it('keeps the effective-opacity fold across a compaction', function () {
    const store = new GraphStore();

    addFiller(store, 6);

    const p = store.addNode('p', 0, 0);
    const a = store.addNode('a', 5, 5);

    store.setParent(a, p);
    store.setScalar('node.opacity', p, 0.5);
    store.setScalar('node.opacity', a, 0.8);

    removeFiller(store, 6);
    store.compact();

    const pRef = store.lookup('p');
    const aRef = store.lookup('a');
    const opacity = store.column('node.opacity');

    expect(store.baseOpacityOf(aRef.slot)).to.be.closeTo(0.8, 1e-6);
    expect(opacity[aRef.slot]).to.be.closeTo(0.4, 1e-6); // 0.8 × 0.5 fold

    // refolds keep working through the moved slots
    store.setScalar('node.opacity', pRef.slot, 1);

    expect(opacity[aRef.slot]).to.be.closeTo(0.8, 1e-6);
  });

  it('keeps blob-backed records: custom polygons and image refs', function () {
    const store = new GraphStore();

    addFiller(store, 9);

    const a = store.addNode('a', 0, 0);

    // as the StyleEngine does: write the point record, then bake its
    // packed ref into borderGeom with the polygon shape id (14)
    const polyRef = store.setPolygonPoints(a, [-1, -1, 1, -1, 0, 1]);

    store.setBorderGeom(a, 0, 0, 0, 0, 0, 14, polyRef);

    const polyBefore = Array.from(store.polygonPointsAt(a));

    expect(polyBefore).to.have.length(6);

    removeFiller(store, 9);
    store.compact();

    const aRef = store.lookup('a');

    expect(Array.from(store.polygonPointsAt(aRef.slot))).to.eql(polyBefore);
  });
});
