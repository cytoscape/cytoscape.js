// The remaining public surface (round 33.9) — the breadth pass.
//
// Passes 33.1-33.8 price the subsystems with an interesting cost model.
// This one exists so that "everything is benchmarked" is true rather than
// true of the interesting third: one row per public member that no
// dedicated suite covers, at a single scale, comparative where v3 has the
// member and gpu-only where it does not.
//
//   node --import tsx benchmark/surface.mjs           # N=2000
//   BENCH_OP=viewport node --import tsx benchmark/surface.mjs
//
// The rows are deliberately shallow — existence and order of magnitude.
// A member that turns out to matter earns a real suite, which is how
// every one of 33.1-33.8 came to exist.  Cheap accessors are grouped into
// *family* rows that call k members per iteration; those rows say so in
// their name and are a sum, not a per-member cost.
//
// **Every op is smoke-tested once before it is benched.**  A breadth
// suite that quietly skipped a member it could not call would defeat its
// own purpose, so an op that throws is reported by name at startup and
// left out of the run, and the count of skips is printed at the end.

import { bench, group, summary, do_not_optimize } from 'mitata';
import cytoscape from '../src/index.mjs';
import { isColumnarElements, isPackedIds } from '../src/columnar.mjs';
import { isSerializedElements } from '../src/wire.mjs';
import { finishRun } from './bench-run.mjs';
import { buildElements, makeV3, makeGpu, MIDNUM, N } from './graph.mjs';

const OP = process.env.BENCH_OP;
const elements = buildElements();

const v3 = makeV3(elements, { styleEnabled: true, layout: { name: 'preset' } });
const gpu = makeGpu(elements);

// a small compound graph for the hierarchy rows
const compoundEles = [
  { data: { id: 'p' } },
  { data: { id: 'p2' } },
  { data: { id: 'c1', parent: 'p' }, position: { x: 0, y: 0 } },
  { data: { id: 'c2', parent: 'p' }, position: { x: 40, y: 0 } },
  { data: { id: 'ce', source: 'c1', target: 'c2' } },
];
const v3c = makeV3(compoundEles, {
  styleEnabled: true,
  layout: { name: 'preset' },
});
const gpuc = makeGpu(compoundEles);

// curved edges, for the curve accessors
const curveEles = [
  { data: { id: 'a' }, position: { x: 0, y: 0 } },
  { data: { id: 'b' }, position: { x: 100, y: 0 } },
  { data: { id: 'e1', source: 'a', target: 'b' } },
  { data: { id: 'e2', source: 'a', target: 'b' } },
];
const gpuCurve = makeGpu(curveEles);

gpuCurve.style({
  nodes: { width: 20, height: 20 },
  edges: { 'curve-style': 'bezier' },
});

const instances = [v3, gpu, v3c, gpuc, gpuCurve];

// payloads for the format-predicate row
const columnarPayload = cytoscape.toColumnarElements(elements);
const wirePayload = cytoscape.serializeElements(columnarPayload);

// operands, resolved once outside every measured region
const ctx = {
  v3: {
    cy: v3,
    node: v3.getElementById('n' + MIDNUM),
    edge: v3.edges()[0],
    nodes: v3.nodes(),
    eles: v3.elements(),
    band: v3.nodes().slice(0, 100),
    other: v3.nodes().slice(50, 150),
    c: v3c,
    parent: v3c.getElementById('p'),
    child: v3c.getElementById('c1'),
    curveEdge: null,
  },
  gpu: {
    cy: gpu,
    node: gpu.$id('n' + MIDNUM),
    edge: gpu.edges()[0],
    nodes: gpu.nodes(),
    eles: gpu.elements(),
    band: gpu.nodes().slice(0, 100),
    other: gpu.nodes().slice(50, 150),
    c: gpuc,
    parent: gpuc.$id('p'),
    child: gpuc.$id('c1'),
    curveEdge: gpuCurve.$id('e1'),
  },
};

// -- the table ----------------------------------------------------------------
// [ group, label, op ] where op takes the per-side context.  A null v3 op
// means the member is v4-only (or v3-only), and the row is gpu-only.
const ROWS = [];
const cmp = (section, label, op) =>
  ROWS.push({ section, label, v3: op, gpu: op });
const only = (section, label, op) =>
  ROWS.push({ section, label, v3: null, gpu: op });
// a comparative row whose *spelling* differs per side — the idiomatic form
// on each, per round 33's design call 1 (a v3 selector string against the
// v4 query object that replaced it)
const pair = (section, label, v3op, gpuop) =>
  ROWS.push({ section, label, v3: v3op, gpu: gpuop });

// viewport -------------------------------------------------------------------
cmp('viewport', 'zoom() get', (c) => c.cy.zoom());
cmp('viewport', 'zoom( n ) set', (c) => {
  c.cy.zoom(1 + (c.i & 1) * 0.5);
});
cmp('viewport', 'pan() get', (c) => c.cy.pan());
cmp('viewport', 'pan( p ) set', (c) => {
  c.cy.pan({ x: c.i & 7, y: 0 });
});
cmp('viewport', 'panBy()', (c) => {
  c.cy.panBy({ x: c.i & 1 ? 1 : -1, y: 0 });
});
cmp('viewport', 'extent()', (c) => c.cy.extent());
cmp('viewport', 'renderedExtent()', (c) => c.cy.renderedExtent());
cmp('viewport', 'width() + height() + size() (3 calls)', (c) => {
  return c.cy.width() + c.cy.height() + (c.cy.size().w ?? 0);
});
cmp(
  'viewport',
  'minZoom/maxZoom get (2 calls)',
  (c) => c.cy.minZoom() + c.cy.maxZoom(),
);
cmp('viewport', 'center( eles )', (c) => {
  c.cy.center(c.band);
});
cmp('viewport', 'reset()', (c) => {
  c.cy.reset();
});
cmp('viewport', 'viewport({ zoom, pan })', (c) => {
  c.cy.viewport({ zoom: 1, pan: { x: 0, y: 0 } });
});
only('viewport', 'getCenterPan( eles )', (c) => c.cy.getCenterPan(c.band));

// core introspection + gating -------------------------------------------------
cmp(
  'core',
  'instanceString + headless + styleEnabled (3 calls)',
  (c) => String(c.cy.instanceString()) + c.cy.headless() + c.cy.styleEnabled(),
);
cmp(
  'core',
  'hasElementWithId + hasCompoundNodes (2 calls)',
  (c) => c.cy.hasElementWithId('n1') + c.cy.hasCompoundNodes(),
);
cmp('core', 'options()', (c) => c.cy.options());
// The row here was round 34.2's finding: `mutableElements()` materialized
// the whole graph per call (121 µs → 20 ns once memoized).  Round 90
// removed the member — it was `elements()` by another name — so the row
// that watches for a memo regression now reads through `elements()`,
// which rides the same cache.  v3 keeps its own spelling.
pair(
  'core',
  'elements() memo hit (was mutableElements, round 90)',
  (c) => c.cy.mutableElements(),
  (c) => c.cy.elements(),
);
cmp(
  'core',
  'gating getters (5 calls)',
  (c) =>
    c.cy.panningEnabled() +
    c.cy.userPanningEnabled() +
    c.cy.zoomingEnabled() +
    c.cy.userZoomingEnabled() +
    c.cy.boxSelectionEnabled(),
);
cmp(
  'core',
  'gating setters round-trip (autolock/autoungrabify/autounselectify)',
  (c) => {
    c.cy.autolock(true);
    c.cy.autolock(false);
    c.cy.autoungrabify(true);
    c.cy.autoungrabify(false);
    c.cy.autounselectify(true);
    c.cy.autounselectify(false);
  },
);
only(
  'core',
  'interaction tuning getters (5 calls)',
  (c) =>
    c.cy.wheelSensitivity() +
    c.cy.desktopTapThreshold() +
    c.cy.touchTapThreshold() +
    c.cy.tapholdDuration() +
    c.cy.multiClickDebounceTime(),
);
// These two read as ~8,600x and ~87,000x, and the ratio is not about
// v4: a **styled** v3 runs a whole-graph style update on any core
// `data()` *or* `scratch()` write (1.9 ms here), where the same instance
// unstyled costs 1.1 µs.  The rows are kept because the styled
// configuration is the realistic one and this is a real cost a v3 app
// pays — but they are named for the mechanism, not the multiplier.
cmp('core', 'graph data() set + get (v3 restyles the graph)', (c) => {
  c.cy.data('k', c.i);
  return c.cy.data('k');
});
cmp('core', 'graph scratch() set + get (v3 restyles the graph)', (c) => {
  c.cy.scratch('k', c.i);
  return c.cy.scratch('k');
});
cmp('core', 'batch( fn ) (empty)', (c) => {
  c.cy.batch(() => {});
});
cmp('core', 'startBatch + endBatch + batching', (c) => {
  c.cy.startBatch();
  const b = c.cy.batching();

  c.cy.endBatch();

  return b;
});
cmp('core', 'collection()', (c) => c.cy.collection());
only('core', 'compact() (no dead slots — the early-out)', (c) => {
  c.cy.compact();
});

// collection: identity + iteration --------------------------------------------
cmp(
  'collection',
  'element accessors (id/group/isNode/isEdge, 4 calls)',
  (c) => c.node.id() + c.node.group() + c.node.isNode() + c.node.isEdge(),
);
cmp(
  'collection',
  'length + empty + nonempty (3 calls)',
  (c) => c.nodes.length + c.nodes.empty() + c.nodes.nonempty(),
);
cmp(
  'collection',
  'eq/first/last (3 calls)',
  (c) => c.nodes.eq(5).length + c.nodes.first().length + c.nodes.last().length,
);
cmp('collection', 'slice()', (c) => c.nodes.slice(10, 110));
cmp('collection', 'toArray()', (c) => c.nodes.toArray());
cmp('collection', 'sort( fn )', (c) =>
  c.band.sort((a, b) => (a.id() < b.id() ? -1 : 1)),
);
cmp('collection', 'reduce( fn )', (c) => c.band.reduce((acc) => acc + 1, 0));
cmp(
  'collection',
  'min + max ( fn ) (2 calls)',
  (c) =>
    c.band.min((n) => n.data('foo')).value +
    c.band.max((n) => n.data('foo')).value,
);
cmp(
  'collection',
  'some + every (2 calls)',
  (c) =>
    c.band.some((n) => n.data('foo') > 0) + c.band.every((n) => n.isNode()),
);

// collection: comparison + set building ---------------------------------------
cmp(
  'collection',
  'same + anySame + contains (3 calls)',
  (c) =>
    c.band.same(c.band) + c.band.anySame(c.other) + c.band.contains(c.band),
);
// round 36.3: the two members bench-coverage reported with no
// benchmark at all.  Both short-circuit, so the criteria are chosen to
// make them *walk* — allAre matches every element (so `every` runs to the
// end) and `is` matches none (so `some` does too).  A row where allAre
// fails on the first element, or is matches it, measures one test rather
// than a hundred: 33.5's custom-polygon pick row, in a different costume.
pair(
  'collection',
  'allAre (all match: the full walk)',
  (c) => c.band.allAre('node'),
  (c) => c.band.allAre({ group: 'nodes' }),
);
pair(
  'collection',
  'is (none match: the full walk)',
  (c) => c.band.is(':selected'),
  (c) => c.band.is({ selected: true }),
);
cmp('collection', 'union', (c) => c.band.union(c.other));
cmp('collection', 'intersection', (c) => c.band.intersection(c.other));
cmp('collection', 'difference', (c) => c.band.difference(c.other));
cmp('collection', 'symmetricDifference', (c) =>
  c.band.symmetricDifference(c.other),
);
cmp('collection', 'absoluteComplement', (c) => c.band.absoluteComplement());
cmp('collection', 'byGroup', (c) => c.eles.byGroup());
cmp('collection', 'diff', (c) => c.band.diff(c.other));
// this row was the finding that became round 34.1: v4 scanned linearly
// where v3 indexes (12.5 µs vs 204 ns over 2000).  Now O(1) off the
// packed-key cache the set ops build, at parity with v3.
cmp('collection', 'indexOf', (c) => c.nodes.indexOf(c.node));

// collection: traversal --------------------------------------------------------
cmp(
  'traversal',
  'openNeighborhood + closedNeighborhood (2 calls)',
  (c) => c.node.openNeighborhood().length + c.node.closedNeighborhood().length,
);
cmp('traversal', 'connectedNodes', (c) => c.edge.connectedNodes());
cmp(
  'traversal',
  'sources + targets (2 calls)',
  (c) => c.edge.sources().length + c.edge.targets().length,
);
cmp(
  'traversal',
  'source() + target() (2 calls)',
  (c) => c.edge.source().length + c.edge.target().length,
);
cmp('traversal', 'edgesWith', (c) => c.band.edgesWith(c.other));
cmp('traversal', 'edgesTo', (c) => c.band.edgesTo(c.other));
cmp(
  'traversal',
  'parallelEdges + codirectedEdges (2 calls)',
  (c) => c.edge.parallelEdges().length + c.edge.codirectedEdges().length,
);
cmp(
  'traversal',
  'roots + leaves (2 calls)',
  (c) => c.eles.roots().length + c.eles.leaves().length,
);
cmp('traversal', 'allAreNeighbors', (c) => c.band.allAreNeighbors(c.other));
cmp(
  'traversal',
  'isLoop + isSimple (2 calls)',
  (c) => c.edge.isLoop() + c.edge.isSimple(),
);

// collection: degree ----------------------------------------------------------
cmp(
  'degree',
  'indegree + outdegree (2 calls)',
  (c) => c.node.indegree() + c.node.outdegree(),
);
cmp(
  'degree',
  'minDegree + maxDegree (2 calls)',
  (c) => c.nodes.minDegree(false) + c.nodes.maxDegree(false),
);
cmp(
  'degree',
  'minIndegree + maxOutdegree (2 calls)',
  (c) => c.nodes.minIndegree(false) + c.nodes.maxOutdegree(false),
);

// collection: position + dimensions -------------------------------------------
cmp('dimensions', 'renderedPosition get', (c) => c.node.renderedPosition());
cmp('dimensions', 'relativePosition get', (c) => c.child.relativePosition());
cmp(
  'dimensions',
  'width + height + outerWidth + outerHeight (4 calls)',
  (c) =>
    c.node.width() +
    c.node.height() +
    c.node.outerWidth() +
    c.node.outerHeight(),
);
cmp(
  'dimensions',
  'rendered dims (4 calls)',
  (c) =>
    c.node.renderedWidth() +
    c.node.renderedHeight() +
    c.node.renderedOuterWidth() +
    c.node.renderedOuterHeight(),
);
cmp('dimensions', 'renderedBoundingBox', (c) => c.node.renderedBoundingBox());
cmp(
  'dimensions',
  'midpoint + renderedMidpoint (2 calls)',
  (c) => c.edge.midpoint().x + c.edge.renderedMidpoint().x,
);
cmp(
  'dimensions',
  'source/targetEndpoint (2 calls)',
  (c) => c.edge.sourceEndpoint().x + c.edge.targetEndpoint().x,
);
cmp(
  'dimensions',
  'rendered source/targetEndpoint (2 calls)',
  (c) => c.edge.renderedSourceEndpoint().x + c.edge.renderedTargetEndpoint().x,
);
cmp('dimensions', 'shift + silentShift (round-trip)', (c) => {
  c.band.shift({ x: 1, y: 0 });
  c.band.silentShift({ x: -1, y: 0 });
});
cmp('dimensions', 'silentPosition', (c) => {
  c.node.silentPosition({ x: c.i & 7, y: 0 });
});
cmp('dimensions', 'positions( fn ) over 100', (c) => {
  c.band.positions((n, k) => ({ x: k, y: 0 }));
});
cmp(
  'dimensions',
  'padding + paddedWidth + paddedHeight (3 calls)',
  (c) => c.parent.padding() + c.parent.paddedWidth() + c.parent.paddedHeight(),
);

// collection: curve accessors (v4-only shapes) --------------------------------
only('curves', 'isBundledBezier', (c) => c.curveEdge.isBundledBezier());
only(
  'curves',
  'controlPoints + renderedControlPoints (2 calls)',
  (c) =>
    (c.curveEdge.controlPoints() ?? []).length +
    (c.curveEdge.renderedControlPoints() ?? []).length,
);
only('curves', 'segmentPoints (undefined for bezier)', (c) =>
  c.curveEdge.segmentPoints(),
);

// collection: compound --------------------------------------------------------
cmp(
  'compound',
  'parent + parents + ancestors (3 calls)',
  (c) =>
    c.child.parent().length +
    c.child.parents().length +
    c.child.ancestors().length,
);
cmp(
  'compound',
  'children + descendants + siblings (3 calls)',
  (c) =>
    c.parent.children().length +
    c.parent.descendants().length +
    c.child.siblings().length,
);
cmp(
  'compound',
  'orphans + nonorphans (2 calls)',
  (c) => c.c.elements().orphans().length + c.c.elements().nonorphans().length,
);
cmp('compound', 'commonAncestors', (c) => c.c.nodes().commonAncestors());
cmp(
  'compound',
  'isParent/isChild/isChildless/isOrphan (4 calls)',
  (c) =>
    c.parent.isParent() +
    c.child.isChild() +
    c.child.isChildless() +
    c.parent.isOrphan(),
);

// collection: flags -----------------------------------------------------------
cmp('flags', 'select + unselect + selected (band)', (c) => {
  c.band.select();
  const s = c.band.selected();
  c.band.unselect();
  return s;
});
cmp('flags', 'selectify + unselectify + selectable', (c) => {
  c.band.unselectify();
  const s = c.band.selectable();
  c.band.selectify();
  return s;
});
cmp('flags', 'lock + unlock + locked', (c) => {
  c.band.lock();
  const s = c.band.locked();
  c.band.unlock();
  return s;
});
cmp('flags', 'grabify + ungrabify + grabbable', (c) => {
  c.band.ungrabify();
  const s = c.band.grabbable();
  c.band.grabify();
  return s;
});
cmp('flags', 'show + hide + visible', (c) => {
  c.band.hide();
  const s = c.band.visible();
  c.band.show();
  return s;
});
cmp('flags', 'active/activate/unactivate (3 calls)', (c) => {
  c.band.activate();
  const s = c.band.active();
  c.band.unactivate();
  return s;
});
cmp('flags', 'panify + unpanify + pannable', (c) => {
  c.band.panify();
  const s = c.band.pannable();
  c.band.unpanify();
  return s;
});
cmp(
  'flags',
  'takesUpSpace + interactive + transparent (3 calls)',
  (c) => c.node.takesUpSpace() + c.node.interactive() + c.node.transparent(),
);
cmp('flags', 'effectiveOpacity', (c) => c.node.effectiveOpacity());

// collection: data / json / scratch -------------------------------------------
cmp('element data', 'scratch get + set', (c) => {
  c.node.scratch('k', c.i);
  return c.node.scratch('k');
});
cmp('element data', 'json() one element', (c) => c.node.json());
cmp('element data', 'jsons() over 100', (c) => c.band.jsons());
only('element data', 'label()', (c) => c.node.label());

// -- gaps the 33.12 audit named --------------------------------------------
// `scripts/bench-coverage.mjs` reports which public members no
// benchmark mentions.  Its first run over this suite named these, and
// they are here because that is the loop the audit exists to drive: it
// took the callable public surface from 72.7% to the number in the
// round record.  Members that are inherently browser-only (`png`/`jpg`,
// `mount`/`unmount`) or asynchronous by contract (`promiseOn`) stay out
// and are named in the record rather than silently missing.
// round 90 removed batchData (v3-legacy twice over); the idiom it named
// is priced here so the replacement stays honest against v3's helper
pair(
  'core',
  'batch + per-id data() (was batchData, round 90)',
  (c) => {
    c.cy.batchData({ n0: { foo: c.i } });
  },
  (c) => {
    c.cy.batch(() => {
      c.cy.$id('n0').data({ foo: c.i });
    });
  },
);
cmp('core', 'animated()', (c) => c.cy.animated());
cmp('core', 'zoomRange get', (c) => c.cy.zoomRange());
cmp('core', 'resize() / invalidateSize()', (c) => {
  c.cy.resize();
});
pair(
  'core',
  "on('render') + off('render') (was onRender/offRender, round 90)",
  (c) => {
    const h = () => {};
    c.cy.onRender(h);
    c.cy.offRender(h);
  },
  (c) => {
    const h = () => {};
    c.cy.on('render', h);
    c.cy.off('render', h);
  },
);
cmp('core', 'removeScratch()', (c) => {
  c.cy.scratch('tmp', 1);
  c.cy.removeScratch('tmp');
});
cmp('core', 'selectionType get', (c) => c.cy.selectionType());
cmp('core', 'isReady()', (c) => c.cy.isReady());
cmp('core', 'window()', (c) => c.cy.window());
cmp('core', 'container()', (c) => c.cy.container());
cmp('core', 'destroyed()', (c) => c.cy.destroyed());
cmp('core', 'removeAllListeners()', (c) => {
  c.cy.removeAllListeners();
});

cmp('collection', 'cy()', (c) => c.node.cy());
cmp('collection', 'indexOfId()', (c) => c.nodes.indexOfId('n' + MIDNUM));
cmp(
  'collection',
  'removed() + inside() (2 calls)',
  (c) => c.node.removed() + c.node.inside(),
);
cmp('collection', 'silentPositions( fn ) over 100', (c) => {
  c.band.silentPositions((n, k) => ({ x: k, y: 1 }));
});
cmp('collection', 'animated()', (c) => c.node.animated());
cmp('collection', 'delayAnimation()', (c) => {
  c.node.delayAnimation(1).stop();
});
cmp('collection', 'removeScratch()', (c) => {
  c.node.scratch('t', 1);
  c.node.removeScratch('t');
});
cmp('collection', 'component()', (c) => c.node.component());
cmp('collection', 'layoutDimensions()', (c) => c.nodes.layoutDimensions({}));
cmp(
  'degree',
  'maxIndegree + minOutdegree (2 calls)',
  (c) => c.nodes.maxIndegree(false) + c.nodes.minOutdegree(false),
);
cmp(
  'flags',
  'grabbed + hidden + inactive (3 calls)',
  (c) => c.node.grabbed() + c.node.hidden() + c.node.inactive(),
);
only('curves', 'renderedSegmentPoints', (c) =>
  c.curveEdge.renderedSegmentPoints(),
);

// the layout contract's columnar reads, through a one-shot impl
only('layout contract', 'edgeSlots + endpoints + degreeOf', (c) => {
  let n = 0;

  c.cy
    .layout({
      impl: class {
        run(ctx) {
          n = ctx.edgeSlots().length + ctx.endpoints().length + ctx.degreeOf(0);
        }
      },
      fit: false,
    })
    .run();

  return n;
});

// the format predicates: what `options.elements` dispatches on
only(
  'formats',
  'isColumnarElements + isSerializedElements + isPackedIds',
  () =>
    isColumnarElements(columnarPayload) +
    isSerializedElements(wirePayload) +
    isPackedIds({}),
);

// -- run ----------------------------------------------------------------------
const sides = [
  ['v3', ctx.v3],
  ['gpu', ctx.gpu],
];
const skipped = [];

// smoke-test every op on every side it claims to support, so a member
// this suite cannot call is reported rather than silently missing
for (const row of ROWS) {
  row.runnable = { v3: row.v3 != null, gpu: true };

  for (const [side, c] of sides) {
    if (row[side] == null) {
      continue;
    }

    c.i = 0;

    try {
      row[side](c);
    } catch (err) {
      row.runnable[side] = false;
      skipped.push(
        `${row.section}: ${row.label} [${side}] — ${err.message.slice(0, 80)}`,
      );
    }
  }
}

console.log(
  `\n== public-surface sweep (N=${N} nodes, ${2 * N} edges; ${ROWS.length} rows) ==`,
);

if (skipped.length > 0) {
  console.log(
    `\n${skipped.length} op(s) could not be called and are excluded:`,
  );

  for (const s of skipped) {
    console.log(`  !! ${s}`);
  }

  console.log('');
}

for (const row of ROWS) {
  if (OP != null && !row.section.includes(OP) && !row.label.includes(OP)) {
    continue;
  }

  const pair = row.v3 != null && row.runnable.v3 && row.runnable.gpu;

  if (!row.runnable.gpu) {
    continue;
  }

  // round 62.5c: with one shared op, the first-sampled side runs against
  // monomorphic inline caches and the second against polymorphic ones —
  // the round-55 measurement-order bias in IC form.  A few alternations
  // take every call site to its steady polymorphic state before either
  // side samples.
  if (pair) {
    for (let w = 0; w < 8; w++) {
      ctx.v3.i++;
      do_not_optimize(row.v3(ctx.v3));
      ctx.gpu.i++;
      do_not_optimize(row.gpu(ctx.gpu));
    }
  }

  group(`${row.section}: ${row.label}`, () => {
    const body = () => {
      if (pair) {
        bench('v3', () => {
          ctx.v3.i++;
          return do_not_optimize(row.v3(ctx.v3));
        });
      }

      bench('gpu', () => {
        ctx.gpu.i++;
        return do_not_optimize(row.gpu(ctx.gpu));
      });
    };

    if (pair) {
      summary(body);
    } else {
      body();
    }
  });
}

await finishRun('surface');

console.log(
  `\nsurface rows: ${ROWS.length}; unrunnable ops: ${skipped.length}`,
);

for (const cy of instances) {
  cy.destroy();
}
