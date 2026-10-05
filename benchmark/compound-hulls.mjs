// Compound-hull cost sweep (round 82.4).
//
// Prices the three parent-shape controls on the real 41-cluster EnrichmentMap,
// a nested 500-cluster sparse fixture, and a 500-cluster degenerate fixture.
// Each measured drag moves one leaf, then flushes derived geometry, matching
// the synchronous model work a drag frame needs. The idle row is a clean flush.
//
//   node --import tsx benchmark/compound-hulls.mjs
//   BENCH_OP=500-cluster node --import tsx benchmark/compound-hulls.mjs

import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { bench, group, summary } from 'mitata';
import cytoscape from '../src/index.mjs';
import { finishRun } from './bench-run.mjs';

const SHAPES = ['ellipse', 'convex-hull', 'concave-hull'];
const OP = process.env.BENCH_OP;
const graphs = [];

function clusteredEnrichmentMap() {
  const source = JSON.parse(
    readFileSync(
      new URL('../v3/debug/webgl/network-em-web.json', import.meta.url),
    ),
  ).elements;
  const clusterIds = new Set();
  const nodes = source.nodes.map(({ data, position }) => {
    const cluster = data.mcode_cluster_id;
    const parent =
      cluster == null || cluster === 'None' ? null : `cluster:${cluster}`;

    if (parent != null) clusterIds.add(parent);

    return {
      data: {
        id: String(data.id),
        ...(parent == null ? {} : { parent }),
        label: String(data.description?.[0] ?? data.name?.[0] ?? data.id),
      },
      position: { x: position.x, y: position.y },
    };
  });
  const parents = [...clusterIds].map((id) => ({
    data: { id, parent: 'enrichment-map' },
  }));
  parents.unshift({ data: { id: 'enrichment-map' } });
  const edges = source.edges.map(({ data }) => ({
    data: {
      id: String(data.id),
      source: String(data.source),
      target: String(data.target),
    },
  }));

  return {
    name: '41-cluster EM',
    elements: [...parents, ...nodes, ...edges],
    parentIds: ['enrichment-map', ...clusterIds],
    childId: nodes.find((node) => node.data.parent != null).data.id,
  };
}

function syntheticClusters({ count = 500, degenerate = false } = {}) {
  const nodes = [];
  const parents = [{ data: { id: 'root' } }];
  const parentIds = [];
  const positions = degenerate
    ? [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
      ]
    : [
        [0, 0],
        [24, 0],
        [48, 0],
        [0, 24],
        [0, 48],
      ];

  for (let c = 0; c < count; c++) {
    const parent = `cluster-${c}`;
    const x0 = (c % 25) * 180;
    const y0 = Math.floor(c / 25) * 180;

    parentIds.push(parent);
    parents.push({ data: { id: parent, parent: 'root' } });

    for (let i = 0; i < positions.length; i++) {
      const [dx, dy] = positions[i];

      nodes.push({
        data: { id: `leaf-${c}-${i}`, parent, label: `m${i}` },
        position: { x: x0 + dx, y: y0 + dy },
      });
    }
  }

  return {
    name: degenerate ? '500-cluster degenerate' : '500-cluster sparse',
    elements: [...parents, ...nodes],
    parentIds: ['root', ...parentIds],
    childId: 'leaf-0-0',
  };
}

function areaOf(points, width, height) {
  let sum = 0;

  for (let i = 0; i < points.length; i += 2) {
    const j = (i + 2) % points.length;
    sum += points[i] * points[j + 1] - points[j] * points[i + 1];
  }

  return (Math.abs(sum) * width * height) / 8;
}

function parentArea(cy, id, shape) {
  const slot = cy._store.lookup(id).slot;
  const bb = cy.$id(id).boundingBox();
  const polygon = cy._store.polygonPointsAt(slot);

  if (polygon != null) return areaOf(polygon, bb.w, bb.h);

  // The plain-parent control is the package's default ellipse.
  return shape === 'ellipse' ? (Math.PI * bb.w * bb.h) / 4 : bb.w * bb.h;
}

function contourStats(cy, ids) {
  let vertices = 0;

  for (const id of ids) {
    const polygon = cy._store.polygonPointsAt(cy._store.lookup(id).slot);

    if (polygon != null) vertices += polygon.length / 2;
  }

  return { vertices };
}

function polygonPoolStats(cy) {
  const { used, live, waste, capacity } = cy._store.polyPool.stats();
  const bytesPerFloat = Float32Array.BYTES_PER_ELEMENT;

  return {
    usedBytes: used * bytesPerFloat,
    liveBytes: live * bytesPerFloat,
    wasteBytes: waste * bytesPerFloat,
    capacityBytes: capacity * bytesPerFloat,
  };
}

function pendingWork(cy) {
  const pending = cy._store.hierarchy.pending;
  let members = 0;

  for (const slot of pending) {
    members += cy._store.hierarchy.childrenOf(slot).length;
  }

  return { parents: pending.size, members };
}

function createCase(fixture, shape) {
  const cy = cytoscape({
    headless: true,
    elements: fixture.elements,
    style: {
      nodes: {
        width: 14,
        height: 10,
        shape: 'ellipse',
        label: 'data(label)',
        'font-size': 8,
      },
      parents: {
        shape,
        padding: 2,
        'compound-sizing-wrt-labels': 'include',
      },
    },
  });
  const store = cy._store;
  const queued = pendingWork(cy);
  const start = performance.now();

  store.flushDerived();

  const initialFlushMs = performance.now() - start;
  const contours = contourStats(cy, fixture.parentIds);
  const polygonPool = polygonPoolStats(cy);
  const totalArea = fixture.parentIds.reduce(
    (sum, id) => sum + parentArea(cy, id, shape),
    0,
  );
  const child = cy.$id(fixture.childId);
  const origin = child.position();
  let step = 0;

  function dragAndFlush() {
    step++;
    child.position({ x: origin.x + (step % 2 ? 1 : -1), y: origin.y });
    const work = pendingWork(cy);
    store.flushDerived();

    return work;
  }

  if (!process.env.BENCH_JSON) {
    const idleWork = pendingWork(cy);

    if (idleWork.parents !== 0) {
      throw new Error(
        `${fixture.name} ${shape}: expected a clean hierarchy after initial flush`,
      );
    }

    for (let i = 0; i < 8; i++) dragAndFlush();
    const times = [];
    let work = { parents: 0, members: 0 };

    for (let i = 0; i < 40; i++) {
      const t0 = performance.now();
      work = dragAndFlush();
      times.push(performance.now() - t0);
    }

    times.sort((a, b) => a - b);
    const p50 = times[Math.floor(times.length / 2)];
    const p95 = times[Math.floor(times.length * 0.95)];
    const ratios = fixture.parentIds.map((id) => parentArea(cy, id, shape));

    console.log(
      `${fixture.name} / ${shape}: parents=${fixture.parentIds.length}, ` +
        `initial-dirty=${queued.parents}/${queued.members} members, ` +
        `initial-flush=${initialFlushMs.toFixed(2)} ms, ` +
        `rest-recomputes=${idleWork.parents}, drag-dirty=${work.parents}/${work.members} ` +
        `members, drag-p50/p95=${(p50 * 1000).toFixed(1)}/${(p95 * 1000).toFixed(1)} µs, ` +
        `vertices=${contours.vertices}, ` +
        `polygon-pool=${polygonPool.liveBytes}/${polygonPool.capacityBytes} B live/capacity ` +
        `(used=${polygonPool.usedBytes} B, waste=${polygonPool.wasteBytes} B), ` +
        `area=${totalArea.toFixed(0)}`,
    );
  }

  graphs.push(cy);

  return { cy, store, dragAndFlush };
}

for (const fixture of [
  clusteredEnrichmentMap(),
  syntheticClusters(),
  syntheticClusters({ degenerate: true }),
]) {
  for (const shape of SHAPES) {
    const label = `${fixture.name} / ${shape}`;

    if (OP != null && !label.toLowerCase().includes(OP.toLowerCase())) continue;

    const instance = createCase(fixture, shape);

    group(label, () => {
      summary(() => {
        bench('clean derived flush', () => instance.store.flushDerived());
        bench('one child move + hull flush', () => instance.dragAndFlush());
      });
    });
  }
}

await finishRun('compound-hulls');

for (const cy of graphs) cy.destroy();
