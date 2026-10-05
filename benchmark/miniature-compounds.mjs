// Round 148's miniature measurement: what rescaling descendants costs while
// the original graph stays live.  The expanded rows use the same definitions
// and element counts, so a fast collapse cannot be credited to dropped
// topology.  The follow rows price the whole source-to-clone patch after the
// same position work on an expanded parent and on a miniature parent.
//
//   npm run build
//   node --expose-gc --import tsx benchmark/miniature-compounds.mjs
//   node --import tsx benchmark/miniature-compounds.mjs --animation-large
//   BENCH_N=20000 node --expose-gc --import tsx benchmark/miniature-compounds.mjs --repeat 7
//   node --import tsx benchmark/miniature-compounds.mjs --src  # source-path control
//
// The animation rows use 44 deterministic manual ticks at 60 Hz.  The
// default measures 2k descendants with full and minimal sheets;
// --animation-large adds 10k descendants in both style conditions.
// Each timed row changes state on every sample and checks the affected leaf
// count outside the timed region.  `collapse + expand` is a real round trip;
// no sample measures an already-collapsed no-op.  Memory is retained
// heapUsed + arrayBuffers for an expanded and a collapsed instance of the
// same graph.  It needs --expose-gc and is skipped otherwise.

import { existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { finishManualRun } from './bench-run.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, '..');
const args = process.argv.slice(2);
const value = (name, fallback) => {
  const i = args.indexOf(name);

  return i < 0 ? fallback : args[i + 1];
};
const N = Math.max(1, Number(process.env.BENCH_N) || 2000);
const REPEAT = Math.max(3, Number(value('--repeat', 15)) || 15);
const DEPTH = Math.max(4, Math.min(64, Math.floor(Math.sqrt(N))));
const WARMUP = 3;
const ANIMATION_TICKS = 44;
const ANIMATION_FRAME_MS = 1000 / 60;
const ANIMATION_DURATION_MS = (ANIMATION_TICKS - 1) * ANIMATION_FRAME_MS;
const ANIMATION_LARGE = args.includes('--animation-large');
const FROM_SRC = args.includes('--src');
const bundle = resolve(ROOT, 'build/cytoscape-headless.esm.mjs');

if (!FROM_SRC && !existsSync(bundle)) {
  console.error('no build/cytoscape-headless.esm.mjs — run `npm run build`');
  process.exit(1);
}

const cytoscape = FROM_SRC
  ? (await import('../src/headless.mjs')).default
  : (await import(pathToFileURL(bundle).href)).default;

if (!FROM_SRC) {
  const bundleTime = statSync(bundle).mtimeMs;
  const sourceFiles = [
    'src/collection.mts',
    'src/collection/hierarchy.mts',
    'src/core/clone.mts',
  ];

  if (
    sourceFiles.some(
      (file) => statSync(resolve(ROOT, file)).mtimeMs > bundleTime,
    )
  ) {
    console.warn('warning: source is newer than the headless bundle');
  }
}

const SCALE = 0.25;
const BASE_WIDTH = 40;
const STYLE = {
  nodes: {
    width: BASE_WIDTH,
    height: 30,
    label: 'data(id)',
    'font-size': 12,
  },
  parents: { padding: 4, 'collapse-scale': SCALE },
  edges: {
    width: 4,
    label: 'data(id)',
    'font-size': 8,
    'source-arrow-shape': 'triangle',
    'target-arrow-shape': 'triangle',
  },
};
const ANIMATION_STYLES = [
  {
    name: 'full labels and arrows',
    description: 'node/edge labels and triangular source/target arrows',
    style: STYLE,
  },
  {
    name: 'minimal collapse-scale sheet',
    description: 'parent collapse-scale only; default node and edge geometry',
    style: { parents: { 'collapse-scale': SCALE } },
  },
];

const now = () => performance.now();
const median = (samples) => {
  const sorted = [...samples].sort((a, b) => a - b);

  return sorted[Math.floor(sorted.length / 2)];
};
const percentile = (samples, quantile) => {
  const sorted = [...samples].sort((a, b) => a - b);

  return sorted[Math.ceil(quantile * sorted.length) - 1];
};
const timingRows = (name, samples) => [
  { name: `${name} p50`, ms: median(samples) },
  { name: `${name} p95`, ms: percentile(samples, 0.95) },
];
const timingSummary = (samples) => ({
  p50Ms: median(samples),
  p95Ms: percentile(samples, 0.95),
});
const near = (a, b) => Math.abs(a - b) <= 1e-4;
const samePoint = (a, b) => near(a.x, b.x) && near(a.y, b.y);
const sameAnimationPoint = (a, b) =>
  Math.abs(a.x - b.x) <= 0.01 && Math.abs(a.y - b.y) <= 0.01;

function buildFixture(depth, n = N) {
  const parents = Array.from({ length: depth }, (_, d) => ({
    data: d === 0 ? { id: 'p0' } : { id: `p${d}`, parent: `p${d - 1}` },
  }));
  const columns = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / columns);
  const leaves = [];
  const outside = [];
  const outsideIds = [];
  const edges = [];

  for (let i = 0; i < n; i++) {
    const x = (i % columns) * 12 - columns * 6 + 0.37;
    const y = Math.floor(i / columns) * 14 - rows * 7 + 0.61;

    leaves.push({
      data: { id: `n${i}`, parent: `p${depth - 1}` },
      position: { x, y },
    });
    outside.push({
      data: { id: `o${i}` },
      position: { x: 10000 + i * 2, y: 10000 + i },
    });
    outsideIds.push(`o${i}`);
    edges.push(
      {
        data: {
          id: `inside${i}`,
          source: `n${i}`,
          target: `n${(i + 1) % n}`,
        },
      },
      {
        data: { id: `boundary${i}`, source: `n${i}`, target: `o${i}` },
      },
    );
  }

  return {
    elements: [...parents, ...leaves, ...outside, ...edges],
    depth,
    leafIds: leaves.map((leaf) => leaf.data.id),
    outsideIds,
    leafCount: n,
    descendantCount: n + depth - 1,
    nodeCount: 2 * n + depth,
    edgeCount: 2 * n,
    elementCount: 4 * n + depth,
  };
}

function cloneElements(elements) {
  return elements.map((ele) => ({
    group: ele.group,
    data: { ...ele.data },
    position: ele.position ? { ...ele.position } : undefined,
  }));
}

function makeCy(fixture, style = STYLE) {
  return cytoscape({
    elements: cloneElements(fixture.elements),
    headless: true,
    layout: { name: 'preset' },
    style,
  });
}

function leafPositions(cy, fixture) {
  return new Map(
    fixture.leafIds.map((id) => [id, { ...cy.$id(id).position() }]),
  );
}

function scaledPoints(before, center, ratio) {
  return new Map(
    [...before].map(([id, point]) => [
      id,
      {
        x: center.x + ratio * (point.x - center.x),
        y: center.y + ratio * (point.y - center.y),
      },
    ]),
  );
}

function assertFixture(cy, fixture, where) {
  if (
    cy.nodes().length !== fixture.nodeCount ||
    cy.edges().length !== fixture.edgeCount ||
    cy.elements().length !== fixture.elementCount
  ) {
    throw new Error(`${where}: graph membership changed`);
  }

  const descendants = cy.$id('p0').descendants();

  if (descendants.length !== fixture.descendantCount) {
    throw new Error(
      `${where}: ${descendants.length} descendants, expected ${fixture.descendantCount}`,
    );
  }

  return descendants;
}

function assertTransition(
  cy,
  fixture,
  expected,
  collapsed,
  expectedScale,
  where,
) {
  const descendants = assertFixture(cy, fixture, where);
  const parent = cy.$id('p0');

  if (parent.collapsed() !== collapsed) {
    throw new Error(`${where}: collapsed state did not change`);
  }

  const matchedPositions = fixture.leafIds.reduce((count, id) => {
    return count + (samePoint(expected.get(id), cy.$id(id).position()) ? 1 : 0);
  }, 0);

  if (matchedPositions !== fixture.leafCount) {
    throw new Error(
      `${where}: ${matchedPositions} leaves followed the scale transform, expected ${fixture.leafCount}`,
    );
  }

  const insideCount = descendants.filter((node) =>
    node.insideCollapsed(),
  ).length;
  const expectedInside = collapsed ? fixture.descendantCount : 0;

  if (insideCount !== expectedInside) {
    throw new Error(
      `${where}: ${insideCount} inside-collapsed nodes, expected ${expectedInside}`,
    );
  }

  let sizedLeaves = 0;

  for (const id of fixture.leafIds) {
    if (near(cy.$id(id).width(), BASE_WIDTH * expectedScale)) {
      sizedLeaves++;
    }
  }

  if (sizedLeaves !== fixture.leafCount) {
    throw new Error(
      `${where}: ${sizedLeaves} leaves have the expected effective width, expected ${fixture.leafCount}`,
    );
  }
}

function measureToggleCycles(cy, fixture) {
  const parent = cy.$id('p0');
  const collapseMs = [];
  const expandMs = [];
  const roundTripMs = [];

  for (let i = 0; i < WARMUP + REPEAT; i++) {
    if (parent.collapsed()) {
      throw new Error('toggle fixture did not begin expanded');
    }

    const beforeCollapse = leafPositions(cy, fixture);
    const collapseExpected = scaledPoints(
      beforeCollapse,
      parent.position(),
      SCALE,
    );
    let t0 = now();
    parent.collapse();
    const collapseTime = now() - t0;
    assertTransition(
      cy,
      fixture,
      collapseExpected,
      true,
      SCALE,
      'collapse batch',
    );

    const beforeExpand = leafPositions(cy, fixture);
    const expandExpected = scaledPoints(
      beforeExpand,
      parent.position(),
      1 / SCALE,
    );
    t0 = now();
    parent.expand();
    const expandTime = now() - t0;
    assertTransition(cy, fixture, expandExpected, false, 1, 'expand batch');

    if (i >= WARMUP) {
      collapseMs.push(collapseTime);
      expandMs.push(expandTime);
      roundTripMs.push(collapseTime + expandTime);
    }
  }

  return { collapseMs, expandMs, roundTripMs };
}

function measureExpandedRoundTrips(cy, fixture) {
  const parent = cy.$id('p0');
  const forwardMs = [];
  const backMs = [];
  const roundTripMs = [];

  if (parent.collapsed()) {
    throw new Error('expanded baseline fixture began collapsed');
  }

  for (let i = 0; i < WARMUP + REPEAT; i++) {
    const before = leafPositions(cy, fixture);
    let t0 = now();
    parent.shift({ x: 1, y: -1 });
    parent.boundingBox();
    const forwardTime = now() - t0;

    const moved = fixture.leafIds.reduce((count, id) => {
      return count + (samePoint(before.get(id), cy.$id(id).position()) ? 0 : 1);
    }, 0);

    if (moved !== fixture.leafCount) {
      throw new Error(
        `expanded parent shift moved ${moved} leaves, expected ${fixture.leafCount}`,
      );
    }

    t0 = now();
    parent.shift({ x: -1, y: 1 });
    parent.boundingBox();
    const backTime = now() - t0;

    const restored = fixture.leafIds.reduce((count, id) => {
      return count + (samePoint(before.get(id), cy.$id(id).position()) ? 1 : 0);
    }, 0);

    if (restored !== fixture.leafCount) {
      throw new Error(
        `expanded parent shift restored ${restored} leaves, expected ${fixture.leafCount}`,
      );
    }

    if (i >= WARMUP) {
      forwardMs.push(forwardTime);
      backMs.push(backTime);
      roundTripMs.push(forwardTime + backTime);
    }
  }

  return { forwardMs, backMs, roundTripMs };
}

function measureRetargets(cy, fixture) {
  const parent = cy.$id('p0');
  const scales = [0.5, SCALE];
  const samples = [];

  const beforeWarmup = leafPositions(cy, fixture);
  const warmupExpected = scaledPoints(beforeWarmup, parent.position(), SCALE);
  parent.collapse();
  let currentScale = SCALE;
  assertTransition(cy, fixture, warmupExpected, true, SCALE, 'retarget warmup');

  for (let i = 0; i < REPEAT; i++) {
    const target = scales[i % scales.length];
    const before = leafPositions(cy, fixture);
    const expected = scaledPoints(
      before,
      parent.position(),
      target / currentScale,
    );
    const t0 = now();
    // A scale style write now immediately retargets a collapsed parent.
    // Time that affected write directly; calling collapse() afterwards
    // would only measure a no-op and would apply the expectation twice.
    parent.style('collapse-scale', target);
    const elapsed = now() - t0;

    assertTransition(
      cy,
      fixture,
      expected,
      true,
      target,
      `retarget @ ${target}`,
    );
    samples.push(elapsed);
    currentScale = target;
  }

  parent.expand();

  return samples;
}

function installProfileHooks(cy) {
  let active = null;
  const restore = [];

  const wrap = (owner, method, stage) => {
    const original = owner[method];

    owner[method] = function (...args) {
      const measurement = active;
      const parent = measurement?.stack.at(-1);
      const frame = { childMs: 0 };

      if (measurement != null) {
        measurement.stack.push(frame);
      }

      const t0 = now();
      let result;

      try {
        result = original.apply(this, args);

        return result;
      } finally {
        const elapsed = now() - t0;

        if (measurement != null) {
          measurement.stack.pop();

          if (parent != null) {
            parent.childMs += elapsed;
          }

          const sample = measurement[stage];

          sample.ms += elapsed - frame.childMs;
          sample.calls++;

          if (stage === 'position') {
            sample.movedSlots += result?.length ?? 0;
          } else if (stage === 'restyle') {
            sample.slots += args[1]?.length ?? 0;
          }
        }
      }
    };

    restore.push(() => {
      owner[method] = original;
    });
  };

  wrap(cy._store, 'rescaleDescendants', 'position');
  wrap(cy._styleEngine, 'applyBulk', 'restyle');
  wrap(cy._store, 'flushDerived', 'derived');

  return {
    begin() {
      active = {
        stack: [],
        position: { ms: 0, calls: 0, movedSlots: 0 },
        restyle: { ms: 0, calls: 0, slots: 0 },
        derived: { ms: 0, calls: 0 },
      };

      return active;
    },
    end() {
      active = null;
    },
    restore() {
      active = null;

      for (const undo of restore.reverse()) {
        undo();
      }
    },
  };
}

function profileTransitionSamples(fixture) {
  const cy = makeCy(fixture);
  const parent = cy.$id('p0');
  const hooks = installProfileHooks(cy);
  const rows = { collapse: [], expand: [] };

  try {
    // Prime both paths before instrumenting a sample.
    parent.collapse();
    parent.expand();

    for (let i = 0; i < Math.min(REPEAT, 5); i++) {
      const beforeCollapse = leafPositions(cy, fixture);
      const expectedCollapse = scaledPoints(
        beforeCollapse,
        parent.position(),
        SCALE,
      );
      const collapse = hooks.begin();
      const startCollapse = now();
      parent.collapse();
      collapse.totalMs = now() - startCollapse;
      hooks.end();
      collapse.otherMs =
        collapse.totalMs -
        collapse.position.ms -
        collapse.restyle.ms -
        collapse.derived.ms;
      assertTransition(
        cy,
        fixture,
        expectedCollapse,
        true,
        SCALE,
        'profiled collapse',
      );
      rows.collapse.push(collapse);

      const beforeExpand = leafPositions(cy, fixture);
      const expectedExpand = scaledPoints(
        beforeExpand,
        parent.position(),
        1 / SCALE,
      );
      const expand = hooks.begin();
      const startExpand = now();
      parent.expand();
      expand.totalMs = now() - startExpand;
      hooks.end();
      expand.otherMs =
        expand.totalMs -
        expand.position.ms -
        expand.restyle.ms -
        expand.derived.ms;
      assertTransition(
        cy,
        fixture,
        expectedExpand,
        false,
        1,
        'profiled expand',
      );
      rows.expand.push(expand);
    }
  } finally {
    hooks.restore();
    cy.destroy();
  }

  const summarize = (samples) => {
    const first = samples[0];
    const p50 = (field) => median(samples.map((sample) => field(sample)));
    const p95 = (field) => {
      const sorted = samples
        .map((sample) => field(sample))
        .sort((a, b) => a - b);

      return sorted[Math.ceil(0.95 * sorted.length) - 1];
    };

    if (
      first.position.calls !== 1 ||
      first.position.movedSlots !== fixture.leafCount ||
      first.restyle.calls !== 2 ||
      first.restyle.slots !== fixture.descendantCount + fixture.edgeCount ||
      first.derived.calls < 1
    ) {
      throw new Error('profile hooks did not observe the named miniature work');
    }

    return {
      totalP50Ms: p50((sample) => sample.totalMs),
      totalP95Ms: p95((sample) => sample.totalMs),
      positionTraversalAndWritesP50Ms: p50((sample) => sample.position.ms),
      positionTraversalAndWritesP95Ms: p95((sample) => sample.position.ms),
      styleBulkP50Ms: p50((sample) => sample.restyle.ms),
      styleBulkP95Ms: p95((sample) => sample.restyle.ms),
      derivedRefreshP50Ms: p50((sample) => sample.derived.ms),
      derivedRefreshP95Ms: p95((sample) => sample.derived.ms),
      otherP50Ms: p50((sample) => sample.otherMs),
      otherP95Ms: p95((sample) => sample.otherMs),
      calls: {
        rescaleDescendants: first.position.calls,
        styleBulk: first.restyle.calls,
        flushDerived: first.derived.calls,
      },
      movedSlots: first.position.movedSlots,
      restyledSlots: first.restyle.slots,
    };
  };

  return {
    collapse: summarize(rows.collapse),
    expand: summarize(rows.expand),
  };
}

function memoryBytes() {
  const usage = process.memoryUsage();

  return usage.heapUsed + usage.arrayBuffers;
}

const gc = globalThis.gc;
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function collect() {
  for (let i = 0; i < 3; i++) {
    gc();
    await tick();
  }
}

async function retainedStateBytes(fixture) {
  await collect();
  const before = memoryBytes();
  const cy = makeCy(fixture);
  assertFixture(cy, fixture, 'expanded memory');
  await collect();
  const expandedBytes = memoryBytes() - before;
  cy.$id('p0').collapse();
  assertFixture(cy, fixture, 'miniature memory');

  await collect();
  const miniatureBytes = memoryBytes() - before;

  cy.destroy();
  await collect();

  return {
    expandedBytes,
    miniatureBytes,
    deltaBytes: miniatureBytes - expandedBytes,
  };
}

function serializedBytes(cy) {
  return cy.serialize().byteLength;
}

function waitForPatch(cy) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('miniature follow patch did not arrive')),
      15000,
    );

    cy.one('patch', (event) => {
      clearTimeout(timer);
      resolve(event.diff);
    });
  });
}

function assertFollow(source, follower, fixture, where, collapsed) {
  assertFixture(source, fixture, `${where} source`);
  assertFixture(follower, fixture, `${where} follower`);

  if (source.$id('p0').collapsed() !== collapsed) {
    throw new Error(`${where}: source collapsed state is incorrect`);
  }

  if (follower.$id('p0').collapsed() !== collapsed) {
    throw new Error(`${where}: follower collapsed state is incorrect`);
  }

  for (const node of source.nodes()) {
    const copied = follower.$id(node.id());

    if (!copied.nonempty() || !samePoint(node.position(), copied.position())) {
      throw new Error(`${where}: follower position differs at ${node.id()}`);
    }
  }
}

async function followStep(source, follower, fixture, operation, collapsed) {
  const patch = waitForPatch(follower);
  const t0 = now();
  operation();
  await patch;
  const elapsed = now() - t0;

  assertFollow(source, follower, fixture, 'follow sync', collapsed);

  return elapsed;
}

async function measureFollow(fixture) {
  const source = makeCy(fixture);
  const follower = source.clone({ follow: { throttle: 0 } });
  const parent = source.$id('p0');
  const expandedMs = [];
  const collapseMs = [];
  const expandMs = [];

  try {
    // One warm-up of each transition lets the patch path settle before the
    // samples.  The position control uses the same graph and the same leaves.
    await followStep(
      source,
      follower,
      fixture,
      () => parent.shift({ x: 1, y: -1 }),
      false,
    );
    await followStep(
      source,
      follower,
      fixture,
      () => parent.shift({ x: -1, y: 1 }),
      false,
    );
    await followStep(source, follower, fixture, () => parent.collapse(), true);
    await followStep(source, follower, fixture, () => parent.expand(), false);

    for (let i = 0; i < Math.min(REPEAT, 9); i++) {
      expandedMs.push(
        await followStep(
          source,
          follower,
          fixture,
          () => parent.shift({ x: 1, y: -1 }),
          false,
        ),
      );
      await followStep(
        source,
        follower,
        fixture,
        () => parent.shift({ x: -1, y: 1 }),
        false,
      );
      collapseMs.push(
        await followStep(
          source,
          follower,
          fixture,
          () => parent.collapse(),
          true,
        ),
      );
      expandMs.push(
        await followStep(
          source,
          follower,
          fixture,
          () => parent.expand(),
          false,
        ),
      );
    }
  } finally {
    follower.destroy();
    source.destroy();
  }

  return { expandedMs, collapseMs, expandMs };
}

function assertAnimationTopology(cy, fixture, where) {
  assertFixture(cy, fixture, where);

  for (let i = 0; i < fixture.leafCount; i++) {
    const inside = cy.$id(`inside${i}`);
    const boundary = cy.$id(`boundary${i}`);

    if (
      inside.data('source') !== `n${i}` ||
      inside.data('target') !== `n${(i + 1) % fixture.leafCount}` ||
      boundary.data('source') !== `n${i}` ||
      boundary.data('target') !== `o${i}`
    ) {
      throw new Error(`${where}: edge topology changed at descendant ${i}`);
    }
  }
}

function assertAnimationFrame(
  cy,
  fixture,
  starts,
  outside,
  center,
  baseWidth,
  expectedScale,
  where,
) {
  const descendants = assertFixture(cy, fixture, where);
  const parent = cy.$id('p0');
  const slot = parent._refs[0].slot;

  if (!parent.collapsed()) {
    throw new Error(`${where}: collapse state was not installed`);
  }

  if (!near(cy._store.appliedCollapseScaleOf(slot), expectedScale)) {
    throw new Error(
      `${where}: applied scale ${cy._store.appliedCollapseScaleOf(slot)}, expected ${expectedScale}`,
    );
  }

  let matchedPositions = 0;
  let movedLeaves = 0;
  let expectedMovedLeaves = 0;
  let matchedWidths = 0;
  let firstMismatch = null;

  for (const id of fixture.leafIds) {
    const before = starts.get(id);
    const expected = {
      x: center.x + expectedScale * (before.x - center.x),
      y: center.y + expectedScale * (before.y - center.y),
    };
    const node = cy.$id(id);
    const position = node.position();

    if (sameAnimationPoint(expected, position)) {
      matchedPositions++;
    } else if (firstMismatch == null) {
      firstMismatch = { id, before, expected, position, center, expectedScale };
    }

    if (!sameAnimationPoint(before, position)) {
      movedLeaves++;
    }

    if (!sameAnimationPoint(before, expected)) {
      expectedMovedLeaves++;
    }

    if (near(node.width(), baseWidth * expectedScale)) {
      matchedWidths++;
    }
  }

  if (matchedPositions !== fixture.leafCount) {
    throw new Error(
      `${where}: ${matchedPositions} leaves matched the animated geometry, expected ${fixture.leafCount}; first mismatch ${JSON.stringify(firstMismatch)}`,
    );
  }

  if (movedLeaves !== expectedMovedLeaves) {
    throw new Error(
      `${where}: ${movedLeaves} leaves moved, expected ${expectedMovedLeaves}`,
    );
  }

  if (matchedWidths !== fixture.leafCount) {
    throw new Error(
      `${where}: ${matchedWidths} leaves have the expected effective width, expected ${fixture.leafCount}`,
    );
  }

  const insideCount = descendants.filter((node) =>
    node.insideCollapsed(),
  ).length;

  if (insideCount !== fixture.descendantCount) {
    throw new Error(
      `${where}: ${insideCount} descendants are inside a collapsed parent, expected ${fixture.descendantCount}`,
    );
  }

  for (const id of fixture.outsideIds) {
    if (!samePoint(outside.get(id), cy.$id(id).position())) {
      throw new Error(`${where}: external node ${id} moved`);
    }
  }
}

async function measureAnimationTicks(n, repeat, sheet) {
  const fixture = buildFixture(1, n);
  const cy = makeCy(fixture, sheet.style);
  const parent = cy.$id('p0');
  const baseWidth = cy.$id('n0').width();
  const tickMs = [];
  const runCpuMs = [];
  const interruptionMs = [];
  const warmups = 1;
  const measuredRuns = repeat;

  // This suite advances the shared clock itself.  Disable the manager's
  // timer driver so slow large-graph ticks cannot race the fixed timeline.
  cy._animations.raf = null;

  try {
    assertAnimationTopology(cy, fixture, 'animation fixture');

    const outside = new Map(
      fixture.outsideIds.map((id) => [id, { ...cy.$id(id).position() }]),
    );

    for (let run = 0; run < warmups + measuredRuns; run++) {
      if (parent.collapsed()) {
        throw new Error('animation fixture did not begin expanded');
      }

      const center = parent.position();
      const starts = leafPositions(cy, fixture);
      const handle = parent.animation({
        collapsed: true,
        duration: ANIMATION_DURATION_MS,
        easing: 'linear',
      });
      const done = handle.play();
      const localTicks = [];

      for (let tick = 0; tick < ANIMATION_TICKS; tick++) {
        const t = tick * ANIMATION_FRAME_MS;
        const startedAt = now();

        cy._animations.tick(t);

        const elapsed = now() - startedAt;
        const scale = 1 + (SCALE - 1) * (tick / (ANIMATION_TICKS - 1));

        assertAnimationFrame(
          cy,
          fixture,
          starts,
          outside,
          center,
          baseWidth,
          scale,
          `animation ${n} descendants, tick ${tick + 1}/${ANIMATION_TICKS}`,
        );
        localTicks.push(elapsed);
      }

      await done;

      if (parent.animated() || !parent.collapsed()) {
        throw new Error('completed collapse animation retained active state');
      }

      if (run >= warmups) {
        tickMs.push(...localTicks);
        runCpuMs.push(localTicks.reduce((sum, sample) => sum + sample, 0));
      }

      parent.expand();

      if (parent.collapsed()) {
        throw new Error('animation reset did not expand the parent');
      }

      const interruptStarts = leafPositions(cy, fixture);
      const interruptCenter = parent.position();
      const interrupted = parent.animation({
        collapsed: true,
        duration: ANIMATION_DURATION_MS,
        easing: 'linear',
      });
      const interruptedDone = interrupted.play();
      const midpoint = Math.floor(ANIMATION_TICKS / 2);
      const midpointTime = midpoint * ANIMATION_FRAME_MS;
      const midpointScale =
        1 + (SCALE - 1) * (midpoint / (ANIMATION_TICKS - 1));

      cy._animations.tick(0);
      assertAnimationFrame(
        cy,
        fixture,
        interruptStarts,
        outside,
        interruptCenter,
        baseWidth,
        1,
        `interruption ${n} descendants, tick 1/${ANIMATION_TICKS}`,
      );
      cy._animations.tick(midpointTime);
      assertAnimationFrame(
        cy,
        fixture,
        interruptStarts,
        outside,
        interruptCenter,
        baseWidth,
        midpointScale,
        `interruption ${n} descendants, midpoint`,
      );

      const child = cy.$id(fixture.leafIds[0]);
      const beforePosition = { ...child.position() };
      const target = {
        x: beforePosition.x + 73,
        y: beforePosition.y - 29,
      };
      const beforeWrite = leafPositions(cy, fixture);
      const startedAt = now();

      child.position(target);

      const interruptElapsed = now() - startedAt;

      await interruptedDone;

      if (parent.animated() || !parent.collapsed()) {
        throw new Error(
          'position write did not interrupt the collapse animation',
        );
      }

      if (!samePoint(target, child.position())) {
        throw new Error(
          'interrupted descendant did not take the requested position',
        );
      }

      if (
        !near(
          cy._store.appliedCollapseScaleOf(parent._refs[0].slot),
          midpointScale,
        )
      ) {
        throw new Error(
          'interruption did not freeze the current miniature scale',
        );
      }

      let changedByInteraction = 0;

      for (const id of fixture.leafIds) {
        const actual = cy.$id(id).position();

        if (!samePoint(beforeWrite.get(id), actual)) {
          changedByInteraction++;
        }

        if (
          id !== fixture.leafIds[0] &&
          !samePoint(beforeWrite.get(id), actual)
        ) {
          throw new Error(`interruption changed unrelated descendant ${id}`);
        }
      }

      if (changedByInteraction !== 1) {
        throw new Error(
          `interaction changed ${changedByInteraction} descendant positions, expected 1`,
        );
      }

      assertAnimationTopology(cy, fixture, 'after interaction interruption');

      for (const id of fixture.outsideIds) {
        if (!samePoint(outside.get(id), cy.$id(id).position())) {
          throw new Error(`interaction moved external node ${id}`);
        }
      }

      if (run >= warmups) {
        interruptionMs.push(interruptElapsed);
      }

      parent.expand();
    }
  } finally {
    cy.destroy();
  }

  return {
    style: sheet.name,
    styleDescription: sheet.description,
    descendants: fixture.descendantCount,
    externalNodes: n,
    edges: fixture.edgeCount,
    nodes: fixture.nodeCount,
    elements: fixture.elementCount,
    ticksPerAnimation: ANIMATION_TICKS,
    frameIntervalMs: ANIMATION_FRAME_MS,
    timelineDurationMs: ANIMATION_DURATION_MS,
    warmupRuns: warmups,
    measuredRuns,
    tick: timingSummary(tickMs),
    cumulativeTickCpu: timingSummary(runCpuMs),
    interactionInterruption: timingSummary(interruptionMs),
    samples: {
      tickCalls: tickMs.length,
      fullAnimations: runCpuMs.length,
      interruptions: interruptionMs.length,
    },
    _timings: { tickMs, runCpuMs, interruptionMs },
  };
}

const flat = buildFixture(1);
const deep = buildFixture(DEPTH);
const flatCy = makeCy(flat);
const deepCy = makeCy(deep);
const flatToggle = measureToggleCycles(flatCy, flat);
const deepToggle = measureToggleCycles(deepCy, deep);
const flatRetarget = measureRetargets(flatCy, flat);
const deepRetarget = measureRetargets(deepCy, deep);
const flatExpanded = measureExpandedRoundTrips(flatCy, flat);
const deepExpanded = measureExpandedRoundTrips(deepCy, deep);
const profile = {
  flat: profileTransitionSamples(flat),
  deep: profileTransitionSamples(deep),
};
const flatExpandedWireBytes = serializedBytes(flatCy);

flatCy.$id('p0').collapse();
const flatMiniatureWireBytes = serializedBytes(flatCy);
flatCy.$id('p0').expand();

const follow = await measureFollow(flat);

flatCy.destroy();
deepCy.destroy();

const animationMeasurements = [];
const animationSizes = ANIMATION_LARGE
  ? [
      [2000, 3],
      [10000, 1],
    ]
  : [[2000, 3]];

for (const sheet of ANIMATION_STYLES) {
  for (const [n, repeat] of animationSizes) {
    animationMeasurements.push(await measureAnimationTicks(n, repeat, sheet));
  }
}

const animationSummaries = animationMeasurements.map(
  ({ _timings, ...summary }) => summary,
);
const animationTimingGroups = animationMeasurements.map((measurement) => ({
  name: `animation ticks — ${measurement.style}, ${measurement.descendants} descendants, ${measurement.externalNodes} external nodes, ${measurement.edges} edges, ${measurement.ticksPerAnimation} frames`,
  benches: [
    ...timingRows('animation tick CPU', measurement._timings.tickMs),
    ...timingRows(
      'cumulative animation tick CPU',
      measurement._timings.runCpuMs,
    ),
    ...timingRows(
      'midpoint position-write interruption',
      measurement._timings.interruptionMs,
    ),
  ],
}));

let memory = null;

if (gc != null) {
  const samples = [];

  for (let i = 0; i < 3; i++) {
    samples.push(await retainedStateBytes(flat));
  }

  memory = {
    expandedRetainedBytesP50: median(
      samples.map((sample) => sample.expandedBytes),
    ),
    expandedRetainedBytesP95: percentile(
      samples.map((sample) => sample.expandedBytes),
      0.95,
    ),
    miniatureRetainedBytesP50: median(
      samples.map((sample) => sample.miniatureBytes),
    ),
    miniatureRetainedBytesP95: percentile(
      samples.map((sample) => sample.miniatureBytes),
      0.95,
    ),
    deltaBytesP50: median(samples.map((sample) => sample.deltaBytes)),
    deltaBytesP95: percentile(
      samples.map((sample) => sample.deltaBytes),
      0.95,
    ),
  };
}

const timingGroups = [
  {
    name: `descendant batch — flat (${N} leaves; ${flat.elementCount} elements)`,
    benches: [
      ...timingRows('collapse', flatToggle.collapseMs),
      ...timingRows('expand', flatToggle.expandMs),
      ...timingRows('collapse + expand', flatToggle.roundTripMs),
      ...timingRows('collapsed scale retarget', flatRetarget),
      ...timingRows(
        'expanded parent shift + bounds round-trip',
        flatExpanded.roundTripMs,
      ),
    ],
  },
  {
    name: `deep nesting — ${DEPTH} parents, ${N} leaves (${deep.elementCount} elements)`,
    benches: [
      ...timingRows('collapse', deepToggle.collapseMs),
      ...timingRows('expand', deepToggle.expandMs),
      ...timingRows('collapse + expand', deepToggle.roundTripMs),
      ...timingRows('collapsed scale retarget', deepRetarget),
      ...timingRows(
        'expanded parent shift + bounds round-trip',
        deepExpanded.roundTripMs,
      ),
    ],
  },
  {
    name: `follow traffic — flat (${N} descendants, ${flat.elementCount} elements)`,
    benches: [
      ...timingRows('expanded parent shift patch', follow.expandedMs),
      ...timingRows('collapse patch', follow.collapseMs),
      ...timingRows('expand patch', follow.expandMs),
    ],
  },
  ...animationTimingGroups,
];

console.log(
  JSON.stringify(
    {
      suite: 'miniature-compounds',
      node: process.version,
      engine: FROM_SRC ? 'src (tsx)' : 'built headless bundle',
      leavesPerFixture: N,
      deepParentCount: DEPTH,
      warmupCycles: WARMUP,
      samplesPerTimingRow: REPEAT,
      expandedGraph: {
        nodes: flat.nodeCount,
        edges: flat.edgeCount,
        elements: flat.elementCount,
        wireBytes: flatExpandedWireBytes,
      },
      miniatureGraph: {
        nodes: flat.nodeCount,
        edges: flat.edgeCount,
        elements: flat.elementCount,
        wireBytes: flatMiniatureWireBytes,
      },
      memory,
      profile,
      measurements: {
        flat: {
          collapse: timingSummary(flatToggle.collapseMs),
          expand: timingSummary(flatToggle.expandMs),
          collapseExpand: timingSummary(flatToggle.roundTripMs),
          scaleRetarget: timingSummary(flatRetarget),
          expandedShiftRoundTrip: timingSummary(flatExpanded.roundTripMs),
        },
        deep: {
          collapse: timingSummary(deepToggle.collapseMs),
          expand: timingSummary(deepToggle.expandMs),
          collapseExpand: timingSummary(deepToggle.roundTripMs),
          scaleRetarget: timingSummary(deepRetarget),
          expandedShiftRoundTrip: timingSummary(deepExpanded.roundTripMs),
        },
        follow: {
          expandedShift: timingSummary(follow.expandedMs),
          collapse: timingSummary(follow.collapseMs),
          expand: timingSummary(follow.expandMs),
        },
        animation: {
          engine: FROM_SRC ? 'src (tsx)' : 'built headless bundle',
          tickInterval: 'fixed 60 Hz clock; deterministic manual manager ticks',
          timedRegion:
            'wall time inside _animations.tick only; topology and geometry assertions run after each tick',
          limitation:
            'headless CPU path only; excludes renderer work, browser scheduling and presentation',
          results: animationSummaries,
        },
      },
    },
    null,
    2,
  ),
);

if (gc == null) {
  console.log('memory skipped: run with node --expose-gc');
}

await finishManualRun('miniature-compounds', timingGroups);
