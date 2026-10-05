// Chart record lifecycle measurements (round 80.3).
//
//   npm run benchmark:charts -- --quick
//   npm run benchmark:charts
//
// This measures actual stylesheet writes and chart-pool storage in the core.
// GPU first-draw and steady-state fragment cost are measured separately by
// chart-capacity.mjs; keeping the paths separate makes CPU extent rebuilds and
// fragment lookup costs independently visible.

import cytoscape from '../src/index.mjs';
import {
  CHART_HEADER,
  CHART_VALUE_WORDS,
  CHART_VALIDITY_BITS_PER_WORD,
  GROUP_NODES,
} from '../src/contract.mjs';

const args = process.argv.slice(2);
const quick = args.includes('--quick');
const nodes = Number(process.env.CHART_BENCH_N) || (quick ? 1000 : 25000);
const counts = quick ? [16, 64] : [16, 64, 255];
const now = () => Number(process.hrtime.bigint()) / 1e6;
const chartBytes = (n) =>
  (CHART_HEADER +
    CHART_VALUE_WORDS * n +
    Math.ceil(n / CHART_VALIDITY_BITS_PER_WORD)) *
  4;
const memory = () => {
  const { heapUsed, arrayBuffers, rss } = process.memoryUsage();
  return { heapUsed, arrayBuffers, rss };
};
const memoryAfterCollection = () => {
  if (globalThis.gc) globalThis.gc();
  return memory();
};
const heapDelta = (before, after) => ({
  heapUsed: after.heapUsed - before.heapUsed,
  arrayBuffers: after.arrayBuffers - before.arrayBuffers,
  rss: after.rss - before.rss,
});

function makeElements(n, values) {
  return Array.from({ length: n }, (_, i) => ({
    data: { id: `n${i}`, values },
    position: { x: i % 200, y: Math.floor(i / 200) },
  }));
}

function style(charts) {
  return {
    nodes: charts
      ? {
          chart: 'heat-strip',
          'chart-values': { data: 'values' },
          'chart-scale': {
            domain: ['auto', 'auto'],
            range: ['#2166ac', '#b2182b'],
          },
        }
      : {},
  };
}

function poolStats(cy) {
  const stats = cy._store.chartPool.stats();
  return {
    usedBytes: stats.used * 4,
    liveBytes: stats.live * 4,
    wasteBytes: stats.waste * 4,
    capacityBytes: stats.capacity * 4,
  };
}

function runZeroChartControl() {
  if (globalThis.gc) globalThis.gc();
  const before = memory();
  const elements = makeElements(nodes, []);
  const start = now();
  const cy = cytoscape({
    elements,
    headless: true,
    layout: { name: 'preset' },
    style: style(false),
  });
  const initMs = now() - start;
  const result = {
    scene: 'zero-chart',
    nodes: cy._store.count(GROUP_NODES),
    chartRecords: cy._store.chartCount(),
    values: 0,
    initMs,
    chartPool: poolStats(cy),
    memoryDelta: heapDelta(before, memoryAfterCollection()),
  };
  cy.destroy();
  return result;
}

function runCharted(nValues) {
  if (globalThis.gc) globalThis.gc();
  const before = memory();
  const values = Array.from({ length: nValues }, (_, i) =>
    nValues === 1 ? 0 : -1 + (2 * i) / (nValues - 1),
  );
  const elements = makeElements(nodes, values);
  const start = now();
  const cy = cytoscape({
    elements,
    headless: true,
    layout: { name: 'preset' },
    style: style(true),
  });
  const initMs = now() - start;
  const poolAfterInit = poolStats(cy);
  const recordsAfterInit = cy._store.chartCount();
  let chartWrites = 0;
  let chartWriteBytes = 0;
  const store = cy._store;
  const setChart = store.setChart.bind(store);
  store.setChart = (slot, rec) => {
    chartWrites++;
    if (rec != null) chartWriteBytes += chartBytes(rec.values.length);
    return setChart(slot, rec);
  };

  const changed = values.slice();
  changed[changed.length - 1] = 1000000;
  const updateStart = now();
  cy.$id('n0').data('values', changed);
  const extremeUpdateMs = now() - updateStart;
  const updatedDomain = cy
    .legend()
    .entries.find((entry) => entry.kind === 'chart')?.chart.colorDomain;
  const extentRecovered = updatedDomain?.at(-1) === 1000000;
  const recordsWrittenForExtreme = chartWrites;
  const bytesWrittenForExtreme = chartWriteBytes;

  const removeCount = Math.floor(recordsAfterInit * 0.4);
  const removeStart = now();
  cy.nodes().slice(0, removeCount).remove();
  const removalMs = now() - removeStart;
  const poolAfterRemoval = poolStats(cy);

  const removalChartWrites = chartWrites - recordsWrittenForExtreme;
  const compactStart = now();
  cy.compact();
  const explicitCompactMs = now() - compactStart;
  const finalPool = poolStats(cy);
  const recordsAfterCompaction = cy._store.chartCount();
  const firstRecordSurvived = cy._store.chartAt(0) != null;

  const result = {
    scene: `${nodes} nodes × ${nValues} values`,
    nodes: recordsAfterInit,
    chartRecords: recordsAfterInit,
    valueSlots: recordsAfterInit * nValues,
    recordBytes: chartBytes(nValues),
    chartRegions: recordsAfterInit * nValues,
    initMs,
    initialChartPool: poolAfterInit,
    extremeUpdateMs,
    extentRecovered,
    extremeUpdateRecordsWritten: recordsWrittenForExtreme,
    extremeUpdateRecordBytesWritten: bytesWrittenForExtreme,
    removal: {
      nodesRemoved: removeCount,
      timeMs: removalMs,
      pool: poolAfterRemoval,
      chartRecordsCleared: removalChartWrites,
      automaticBlobCompactionOccurred:
        poolAfterRemoval.wasteBytes < removeCount * chartBytes(nValues),
      netUsedBytesDropped: poolAfterInit.usedBytes - poolAfterRemoval.usedBytes,
    },
    explicitSlotCompactMs: explicitCompactMs,
    recordsAfterCompaction,
    firstRecordSurvived,
    finalChartPool: finalPool,
    memoryDelta: heapDelta(before, memoryAfterCollection()),
  };
  cy.destroy();
  return result;
}

const results = [runZeroChartControl(), ...counts.map(runCharted)];
console.log(
  JSON.stringify({ date: new Date().toISOString(), nodes, results }, null, 2),
);

if (
  results.some((r) => r.chartRecords !== (r.scene === 'zero-chart' ? 0 : nodes))
) {
  throw new Error('chart-record count did not match the benchmark scene');
}
if (results.some((r) => r.extentRecovered === false)) {
  throw new Error('the shared chart extent failed to include the live extreme');
}
if (results.some((r) => r.firstRecordSurvived === false)) {
  throw new Error('chart records did not survive slot compaction');
}
