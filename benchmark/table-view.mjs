// Round 84's measurement (the eleventh design sitting's "measure first"):
// what an attribute table — a data grid plus a filter panel over the node
// table — costs at 100k rows through today's public `ele.data()` loops,
// against a prototype of the plan's column view (84.1) and compiled
// column filters (84.2).  The prototype lives in this file and reads the
// store's private columns (`cy._store.data`); nothing here is public API.
//
//   npm run build
//   node --expose-gc benchmark/table-view.mjs --nodes 10000 --repeat 5
//   node --expose-gc benchmark/table-view.mjs --nodes 100000 --repeat 5
//   node --expose-gc benchmark/table-view.mjs --nodes 1000000 --repeat 5
//
// This pass extends the original 100k measurement to visible rectangles,
// scrolling/jumps, and dirty refresh at 10k/100k/1m rows.  It deliberately
// uses the built headless bundle: tsx's closure wrapper distorts hot paths.
// See the round-84 record for the machine, commands, samples and findings.
//
// The fixture: N nodes (the grid's rows) and N edges.  Each node carries
// seven data keys, one per column kind a grid meets — `label` (unique
// strings), `score` (floats), `rank` (integers), `group` (20 strings),
// `region` (5 strings), `active` (booleans: a mixed column) and `note`
// (a string on 10% of rows: a sparse column) — under a sheet that maps
// `score` and `label`, so a write pays the mapped-style refresh a real one
// does.
//
// Sections, each priced the app way (public API) and the prototype way:
//
//   1. **grid pull** — every row × every column.  `data()` objects cold
//      (a value was written since the last read, so the round-62.4 memo is
//      invalid — one write anywhere invalidates every row's object) and
//      warm, per-key `data( k )` loops into arrays, and the prototype's
//      column snapshots (the `exportColumns` shapes, ids synthesized).
//   2. **the visible window** — the ~60 rows × 8 columns a virtualized grid
//      renders per frame, read cell by cell with `data( k )`.
//   3. **sort** — a row permutation by one column, three ways.
//   4. **distinct values** — a facet's value → count table.
//   5. **filters** — string eq, numeric range, degree, over the whole
//      node table and over a half-size subset, every spelling asserted to
//      the same result and to 0 < count < N; plus the 84.3 gate (the
//      subset filter with the reader hoisted, before any dict path).
//   6. **change tracking** — a write burst (1 row, 1%, 10% of rows, one
//      key) with and without a `data` listener, and what each consumer
//      then re-reads: the listener's dirty rows, the epoch's whole store,
//      or (a keys payload, hypothetical) one column.
//   7. **the coverage gate** (84.1) — an on-demand presence scan at 200k.
//
// Through the built headless bundle by default (the tsx `__name` wrapper
// costs per closure creation — docs/agents/benchmarking.md).

import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cpus, freemem, release, totalmem } from 'node:os';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);

  return i >= 0 ? args[i + 1] : fallback;
};
const N = Number(opt('--nodes', 100000));
const REPEAT = Number(opt('--repeat', 5));
const FROM_SRC = args.includes('--src');
const SHOW_SAMPLES = args.includes('--samples');
const JSON_PATH = opt('--json', undefined);
const gc = globalThis.gc;

const bundle = resolve(ROOT, 'build/cytoscape-headless.esm.mjs');

if (!FROM_SRC && !existsSync(bundle)) {
  console.error('no build/cytoscape-headless.esm.mjs — run `npm run build`');
  process.exit(1);
}

if (
  !FROM_SRC &&
  statSync(resolve(ROOT, 'src/core.mts')).mtimeMs > statSync(bundle).mtimeMs
) {
  console.warn('warning: src/core.mts is newer than the bundle');
}

const cytoscape = FROM_SRC
  ? (await import('../src/headless.mjs')).default
  : (await import(pathToFileURL(bundle).href)).default;

const STYLE = {
  nodes: {
    label: 'data(label)',
    width: { data: 'score', domain: [0, 1], range: [10, 40] },
  },
};

const KEYS = ['label', 'score', 'rank', 'group', 'region', 'active', 'note'];
const COLS = ['id', ...KEYS];
const GROUPS = Array.from({ length: 20 }, (_, i) => `g${i}`);
const REGIONS = ['north', 'south', 'east', 'west', 'centre'];

/** A small deterministic PRNG (mulberry32). */
const rng = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;

  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);

  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function buildDefs(n) {
  const rand = rng(84);
  const nodes = [];
  const edges = [];

  for (let i = 0; i < n; i++) {
    const data = {
      id: 'n' + i,
      label: 'node ' + Math.floor(rand() * 1e9).toString(36) + ' ' + i,
      score: rand(),
      rank: Math.floor(rand() * 1000),
      group: GROUPS[Math.floor(rand() * GROUPS.length)],
      region: REGIONS[i % REGIONS.length],
      active: rand() < 0.5,
    };

    if (i % 10 === 0) {
      data.note = 'note ' + (i % 37);
    }

    nodes.push({
      data,
      position: { x: (i % 300) * 20, y: Math.floor(i / 300) * 20 },
    });
  }

  // a skewed degree distribution, so a degree filter selects a real subset
  for (let j = 0; j < n; j++) {
    const s = Math.floor(rand() * rand() * n);
    const t = Math.floor(rand() * n);

    edges.push({ data: { id: 'e' + j, source: 'n' + s, target: 'n' + t } });
  }

  return { nodes, edges };
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);

  return s[Math.floor(s.length / 2)];
};

const percentile = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);

  return s[Math.max(0, Math.ceil(p * s.length) - 1)];
};

const fmt = (ms) =>
  ms < 0.01
    ? `${(ms * 1000).toFixed(2)} µs`
    : ms < 1
      ? `${(ms * 1000).toFixed(0)} µs`
      : `${ms.toFixed(ms < 10 ? 2 : 1)} ms`;

let sink = 0;
const rawMeasurements = [];
const rawTraces = [];
const rawControls = [];

/**
 * Median ms of `fn` over REPEAT runs after one warm-up; `before` runs
 * untimed ahead of each (to invalidate a cache, or reset state).
 */
function time(fn, before) {
  const xs = [];
  let out;

  for (let r = 0; r < REPEAT + 1; r++) {
    before?.();

    const t0 = performance.now();

    out = fn();

    const ms = performance.now() - t0;

    if (r > 0) {
      xs.push(ms);
    }
  }

  sink ^= typeof out === 'number' ? out : (out?.length ?? 1);

  return { ms: median(xs), samples: xs, out };
}

/**
 * Memory deltas around one result-producing call (needs --expose-gc).  The
 * pre-collection heap-plus-array-buffer delta is noisy, not total allocation;
 * allocations already collected during `fn` are absent.
 */
function heapEvidence(fn, prepare) {
  if (gc == null) {
    return undefined;
  }

  prepare?.();
  gc();
  gc();

  const mem = () => {
    const m = process.memoryUsage();

    return m.heapUsed + m.arrayBuffers;
  };
  const beforeBytes = mem();
  const keep = fn();
  const beforeCollectionBytes = mem();

  gc();
  gc();

  const retainedBytes = mem() - beforeBytes;

  sink ^= keep == null ? 0 : 1;

  return {
    keep,
    retainedBytes,
    preCollectionDeltaBytes: beforeCollectionBytes - beforeBytes,
  };
}

const MB = (b) => (b == null ? '' : `${(b / 1048576).toFixed(2)} MB`);
const heapNumbers = (m) =>
  m == null
    ? null
    : {
        retainedHeapAndArrayBufferBytesAfterGC: m.retainedBytes,
        approximateNetHeapAndArrayBufferDeltaBeforeGCBytes:
          m.preCollectionDeltaBytes,
        note: 'Not total allocation; short-lived objects reclaimed during the call are absent.',
      };
const heapExtra = (m) =>
  m == null
    ? ''
    : `retained ${MB(m.retainedBytes)}; pre-GC net heap+buffers Δ ${MB(m.preCollectionDeltaBytes)} (approx.)`;

function row(label, resultOrMs, extra = '', details = {}) {
  const result = typeof resultOrMs === 'number' ? undefined : resultOrMs;
  const ms = result?.ms ?? resultOrMs;

  rawMeasurements.push({
    label,
    medianMs: ms,
    samplesMs: result?.samples ?? null,
    details: { ...details, annotation: extra || undefined },
  });

  console.log(`  ${label.padEnd(58)} ${fmt(ms).padStart(10)}  ${extra}`);
}

function sampleRow(label, result, extra = '', details = {}) {
  row(label, result, extra, details);

  if (SHOW_SAMPLES) {
    console.log(`    raw samples: ${result.samples.map(fmt).join(', ')}`);
  }
}

function assert(cond, message) {
  if (!cond) {
    throw new Error(`assertion failed: ${message}`);
  }
}

// -- the fixture --------------------------------------------------------------

const defs = buildDefs(N);

console.log(
  `table view: ${N.toLocaleString()} nodes (rows), ` +
    `${defs.edges.length.toLocaleString()} edges; median of ${REPEAT}; ` +
    (FROM_SRC ? 'src/ via tsx' : 'build/cytoscape-headless.esm.mjs') +
    (gc == null ? '' : '; heap via --expose-gc'),
);
console.log(
  `node ${process.version}, ${cpus()[0].model}, ` +
    `${Math.round(totalmem() / 1073741824)} GiB`,
);

const cy = cytoscape({
  headless: true,
  styleEnabled: true,
  style: STYLE,
  elements: defs,
});
const nodes = cy.nodes();
const store = cy._store;
const dataStore = store.data;

assert(nodes.length === N, 'every node loaded');

let bump = 0;

/** One data write elsewhere: invalidates every row's data() memo. */
const invalidate = () => cy.$id('n0').data('rank', bump++ % 1000);

// -- the prototype (84.1's column view, outside the public API) --------------

/** The slots of a collection, in its order (84.1's row order). */
const slotsOf = (eles) => {
  const refs = eles._refs;
  const out = new Uint32Array(refs.length);

  for (let i = 0; i < refs.length; i++) {
    out[i] = refs[i].slot;
  }

  return out;
};

/** One key's snapshot, aligned to `slots` — the `exportColumns` shapes. */
function protoColumn(
  group,
  key,
  slots,
  sourceStore = store,
  sourceDataStore = dataStore,
) {
  const n = slots.length;

  if (key === 'id') {
    const ids = new Array(n);

    for (let i = 0; i < n; i++) {
      ids[i] = sourceStore.idAt(group, slots[i]);
    }

    return { kind: 'id', values: ids };
  }

  const col = sourceDataStore.column(group, key);

  if (col == null) {
    return undefined;
  }

  switch (col.kind) {
    case 'number': {
      const values = new Float64Array(n);

      for (let i = 0; i < n; i++) {
        const s = slots[i];

        values[i] = col.present[s] ? col.values[s] : NaN;
      }

      return { kind: 'number', values };
    }
    case 'string': {
      const indices = new Uint32Array(n);
      const src = col.indices;

      for (let i = 0; i < n; i++) {
        const s = slots[i];

        indices[i] = s < src.length ? src[s] : 0;
      }

      return {
        kind: 'string',
        dict: col.dict.slice(),
        indices,
        dictEpoch: col.epoch,
      };
    }
    case 'mixed': {
      const values = new Array(n);

      for (let i = 0; i < n; i++) {
        values[i] = col.values[slots[i]];
      }

      return { kind: 'mixed', values };
    }
  }
}

/** A collection-order string snapshot with only the window's used values. */
function protoColumnCompact(group, key, slots) {
  if (key === 'id') {
    return protoColumn(group, key, slots);
  }

  const col = dataStore.column(group, key);

  if (col == null || col.kind !== 'string') {
    return protoColumn(group, key, slots);
  }

  const indices = new Uint32Array(slots.length);
  const dict = [];
  const localIndex = new Map();

  for (let i = 0; i < slots.length; i++) {
    const sourceIndex =
      slots[i] < col.indices.length ? col.indices[slots[i]] : 0;

    if (sourceIndex === 0) {
      continue;
    }

    const value = col.dict[sourceIndex - 1];
    let compactIndex = localIndex.get(value);

    if (compactIndex === undefined) {
      dict.push(value);
      compactIndex = dict.length;
      localIndex.set(value, compactIndex);
    }

    indices[i] = compactIndex;
  }

  return { kind: 'string', dict, indices, dictEpoch: col.epoch };
}

/** A snapshot for already selected slots, stamped with the store epoch. */
function protoTableSlotsWith(slots, keys, columnReader) {
  const columns = {};

  for (const k of keys) {
    columns[k] = columnReader('nodes', k, slots);
  }

  return { epoch: dataStore.epoch, rows: slots.length, columns };
}

function protoTableSlots(slots, keys = COLS) {
  return protoTableSlotsWith(slots, keys, protoColumn);
}

function protoTableSlotsCompact(slots, keys = COLS) {
  return protoTableSlotsWith(slots, keys, protoColumnCompact);
}

/** The collection's snapshot, aligned with its order. */
function protoTable(eles, keys = COLS) {
  return protoTableSlots(slotsOf(eles), keys);
}

/** A snapshot cell as `data( k )` would read it (for the assertions). */
function cell(col, i) {
  switch (col.kind) {
    case 'number':
      return Number.isNaN(col.values[i]) ? undefined : col.values[i];
    case 'string':
      return col.indices[i] === 0 ? undefined : col.dict[col.indices[i] - 1];
    default:
      return col.values[i];
  }
}

const snapMaterialization = (t) => {
  let typedBytes = 0;
  let jsArraySlots = 0;
  let dictionaryEntries = 0;

  for (const col of Object.values(t.columns)) {
    if (col.kind === 'number') {
      typedBytes += col.values.byteLength;
    } else if (col.kind === 'string') {
      typedBytes += col.indices.byteLength;
      dictionaryEntries += col.dict.length;
    } else {
      jsArraySlots += col.values.length;
    }
  }

  return { typedBytes, jsArraySlots, dictionaryEntries };
};

// -- 1. grid pull ------------------------------------------------------------

console.log('\n1. grid pull: every row × 8 columns (id + 7 data keys)');

const pullObjects = () => nodes.map((n) => n.data());

const objCold = time(pullObjects, invalidate);
const objWarm = time(pullObjects);
const objHeap = heapEvidence(pullObjects, invalidate);

sampleRow(
  'data() objects, cold (a write since the last pull)',
  objCold,
  heapExtra(objHeap),
  { memory: heapNumbers(objHeap) },
);
sampleRow('data() objects, warm (no write since: the 62.4 memo)', objWarm);

const pullPerKey = () => {
  const out = {};

  for (const k of COLS) {
    const arr = new Array(nodes.length);

    for (let i = 0; i < nodes.length; i++) {
      arr[i] = nodes[i].data(k);
    }

    out[k] = arr;
  }

  return out;
};
const perKey = time(pullPerKey);
const perKeyHeap = heapEvidence(pullPerKey);

sampleRow(
  'data( k ) per cell into 8 arrays',
  perKey,
  `${heapExtra(perKeyHeap)}; 8 arrays × ${N.toLocaleString()} slots`,
  { memory: heapNumbers(perKeyHeap), materializedArraySlots: 8 * N },
);

const keyUnion = time(() => {
  const seen = new Set();

  for (const d of objWarm.out) {
    for (const k in d) {
      seen.add(k);
    }
  }

  return seen.size;
});

row('  + key discovery: Object.keys union over warm objects', keyUnion);

const proto = time(() => protoTable(nodes));
const protoHeap = heapEvidence(() => protoTable(nodes));
const protoSizes = snapMaterialization(proto.out);

sampleRow(
  'prototype: column snapshots (8 columns, ids synthesized)',
  proto,
  `${heapExtra(protoHeap)}; typed ${MB(protoSizes.typedBytes)}; ` +
    `JS array slots ${protoSizes.jsArraySlots.toLocaleString()}; ` +
    `dictionary entries ${protoSizes.dictionaryEntries.toLocaleString()}`,
  { memory: heapNumbers(protoHeap), materialization: protoSizes },
);

const protoData = time(() => protoTable(nodes, KEYS));
const protoDataHeap = heapEvidence(() => protoTable(nodes, KEYS));

sampleRow(
  'prototype: the 7 data columns alone (no ids)',
  protoData,
  heapExtra(protoDataHeap),
  { memory: heapNumbers(protoDataHeap) },
);

const protoOne = time(() => protoColumn('nodes', 'score', slotsOf(nodes)));

row('prototype: one number column (a per-column re-pull)', protoOne);

const protoKeys = time(() =>
  dataStore.keys('nodes').map((k) => [k, dataStore.kind('nodes', k)]),
);

row('prototype: keys + kinds (dataKeys without coverage)', protoKeys);

// every column carries values and agrees with data( k ), row by row
{
  const t = proto.out;

  for (const k of COLS) {
    const col = t.columns[k];
    let present = 0;

    for (let i = 0; i < N; i++) {
      const want = perKey.out[k][i];

      assert(cell(col, i) === want, `column ${k} row ${i}`);
      present += want === undefined ? 0 : 1;
    }

    assert(present > 0, `column ${k} carries values`);
  }

  const noteCount = perKey.out.note.reduce(
    (count, value) => count + (value === undefined ? 0 : 1),
    0,
  );

  assert(noteCount === Math.ceil(N / 10), 'sparse note coverage is 10%');
  assert(
    cell(t.columns.note, 1) === undefined,
    'sparse note hole stays absent',
  );
  assert(
    cell(t.columns.note, 0) === perKey.out.note[0],
    'present sparse note stays its string value',
  );
}

// NaN cannot live in a number column: the store promotes it to mixed, where
// the snapshot keeps actual NaN distinct from an absent/undefined row.
{
  const probe = cytoscape({
    headless: true,
    styleEnabled: false,
    layout: { name: 'preset' },
    elements: {
      nodes: [
        { data: { id: 'nan-value', rank: 1 } },
        { data: { id: 'missing-value' } },
      ],
    },
  });
  const probeNodes = probe.nodes();

  probeNodes[0].data('rank', NaN);

  const slots = Uint32Array.from(probeNodes._refs, (ref) => ref.slot);
  const snapshot = protoColumn(
    'nodes',
    'rank',
    slots,
    probe._store,
    probe._store.data,
  );

  assert(Number.isNaN(probeNodes[0].data('rank')), 'public NaN survives');
  assert(Number.isNaN(cell(snapshot, 0)), 'snapshot NaN stays distinct');
  assert(
    probeNodes[1].data('rank') === undefined && cell(snapshot, 1) === undefined,
    'absent numeric value remains undefined',
  );
  console.log(
    '  control: sparse holes stay undefined; NaN is preserved in mixed columns',
  );
  rawControls.push({
    name: 'sparse missing versus present; NaN preserved in mixed column',
    passed: true,
  });
}

// -- 2. the visible window -----------------------------------------------------

console.log('\n2. the visible window: 60 rows × 8 columns, cell by cell');

const WINDOW = 60;
const top = Math.floor(N / 2);

const windowCells = () => {
  let n = 0;

  for (let r = top; r < top + WINDOW; r++) {
    const ele = nodes[r];

    for (const k of COLS) {
      if (ele.data(k) !== undefined) {
        n++;
      }
    }
  }

  return n;
};

row('data( k ) per visible cell', time(windowCells));
row(
  'data() per visible row, cold',
  time(() => {
    let n = 0;

    for (let r = top; r < top + WINDOW; r++) {
      n += Object.keys(nodes[r].data()).length;
    }

    return n;
  }, invalidate),
);

console.log(
  '\n2b. scrolling and jumps: equal 60-row × 8-column viewport traces',
);

const TRACE_WINDOWS = 32;
const VISIBLE_CELLS = WINDOW * COLS.length;
const MAX_START = N - WINDOW - 1; // keep the final row outside sampled windows
const sequentialStarts = Array.from({ length: TRACE_WINDOWS }, (_, i) => i);
const jumpRand = rng(N ^ 8401);
const jumpStarts = [];

for (let i = 0; i < TRACE_WINDOWS; i++) {
  let at = Math.floor(jumpRand() * (MAX_START + 1));

  if (i > 0) {
    for (let tries = 0; tries < 100; tries++) {
      if (Math.abs(at - jumpStarts[i - 1]) >= WINDOW * 2) {
        break;
      }

      at = Math.floor(jumpRand() * (MAX_START + 1));
    }

    assert(
      Math.abs(at - jumpStarts[i - 1]) >= WINDOW,
      `distant jump ${i} moves at least one viewport`,
    );
  }

  jumpStarts.push(at);
}

const invalidateOutsideTrace = () => nodes[N - 1].data('rank', bump++ % 1000);

const scrollSnapshotHeap = heapEvidence(
  () => protoTable(nodes),
  invalidateOutsideTrace,
);
const scrollSnapshot = time(() => protoTable(nodes), invalidateOutsideTrace);

sampleRow(
  'rebuild cached snapshot after a store epoch change',
  scrollSnapshot,
  heapExtra(scrollSnapshotHeap),
  {
    memory: heapNumbers(scrollSnapshotHeap),
    materialization: snapMaterialization(scrollSnapshot.out),
    snapshotEpoch: scrollSnapshot.out.epoch,
    storeEpoch: dataStore.epoch,
  },
);
assert(
  scrollSnapshot.out.epoch === dataStore.epoch,
  'rebuilt scrolling snapshot has the current data epoch',
);

const valueScore = (value) =>
  value === undefined
    ? 0
    : typeof value === 'string'
      ? value.length
      : typeof value === 'number'
        ? value
        : value
          ? 1
          : 0;

function publicWindow(start, rowObjects) {
  let checksum = 0;
  let present = 0;

  for (let r = start; r < start + WINDOW; r++) {
    const ele = nodes[r];
    const data = rowObjects ? ele.data() : undefined;

    for (const key of COLS) {
      const value = rowObjects ? data[key] : ele.data(key);

      checksum += valueScore(value);
      present += value === undefined ? 0 : 1;
    }
  }

  return { checksum, present };
}

function snapshotWindow(start, snapshot) {
  let checksum = 0;
  let present = 0;

  for (let r = start; r < start + WINDOW; r++) {
    const local = snapshot == null ? r - start : r;

    for (const key of COLS) {
      const column = snapshot.columns[key];
      const value = cell(column, local);

      checksum += valueScore(value);
      present += value === undefined ? 0 : 1;
    }
  }

  return { checksum, present };
}

/** Measure trace total time and the distribution of per-window latencies. */
function traceTime(starts, readWindow) {
  const totals = [];
  const windows = [];
  let out;

  for (let r = 0; r < REPEAT + 1; r++) {
    const t0 = performance.now();
    let checksum = 0;
    let present = 0;

    for (const start of starts) {
      const w0 = performance.now();
      const result = readWindow(start);

      windows.push(performance.now() - w0);
      checksum += result.checksum;
      present += result.present;
    }

    const ms = performance.now() - t0;

    if (r > 0) {
      totals.push(ms);
    } else {
      windows.length = 0;
    }

    out = { checksum, present };
  }

  return {
    ms: median(totals),
    samples: totals,
    windowMs: windows,
    out,
  };
}

function traceRow(label, result, starts) {
  const p50 = percentile(result.windowMs, 0.5);
  const p95 = percentile(result.windowMs, 0.95);
  const lo = Math.min(...result.windowMs);
  const hi = Math.max(...result.windowMs);

  console.log(
    `  ${label.padEnd(52)} ${fmt(result.ms).padStart(10)}  ` +
      `window p50 ${fmt(p50)}, p95 ${fmt(p95)}, range ${fmt(lo)}–${fmt(hi)}`,
  );
  console.log(
    `    ${starts.length} windows × ${WINDOW} rows × ${COLS.length} columns = ` +
      `${(starts.length * VISIBLE_CELLS).toLocaleString()} cell reads / trace` +
      (SHOW_SAMPLES
        ? `; trace samples [${result.samples.map(fmt).join(', ')}]`
        : ''),
  );
  rawTraces.push({
    label,
    windowsPerTrace: starts.length,
    rowsPerWindow: WINDOW,
    columnsPerWindow: COLS.length,
    cellsPerTrace: starts.length * VISIBLE_CELLS,
    medianTraceMs: result.ms,
    traceSamplesMs: result.samples,
    perWindowSamplesMs: result.windowMs,
    perWindow: {
      p50Ms: percentile(result.windowMs, 0.5),
      p95Ms: percentile(result.windowMs, 0.95),
      minMs: Math.min(...result.windowMs),
      maxMs: Math.max(...result.windowMs),
      samples: result.windowMs.length,
    },
    controlChecksum: result.out.checksum,
    controlPresentCells: result.out.present,
  });
}

function slotsForWindow(start) {
  const slots = new Uint32Array(WINDOW);

  for (let i = 0; i < WINDOW; i++) {
    slots[i] = nodes._refs[start + i].slot;
  }

  return slots;
}

function snapshotMatchesWindow(start, snapshot, firstSnapshotRow) {
  for (let local = 0; local < WINDOW; local++) {
    for (const key of COLS) {
      const snapshotRow =
        firstSnapshotRow == null ? local : firstSnapshotRow + local;
      const actual = cell(snapshot.columns[key], snapshotRow);
      const expected = nodes[start + local].data(key);

      if (!Object.is(actual, expected)) {
        return false;
      }
    }
  }

  return true;
}

const oneWindowSlots = slotsForWindow(top);
const fullWindowSnapshot = protoTableSlots(oneWindowSlots);
const compactWindowSnapshot = protoTableSlotsCompact(oneWindowSlots);

for (let r = 0; r < WINDOW; r++) {
  for (const key of COLS) {
    const want = nodes[top + r].data(key);

    assert(
      Object.is(cell(fullWindowSnapshot.columns[key], r), want),
      `full window snapshot ${key} row ${r}`,
    );
    assert(
      Object.is(cell(compactWindowSnapshot.columns[key], r), want),
      `compact window snapshot ${key} row ${r}`,
    );
  }
}

const fullWindowBuild = time(() => protoTableSlots(oneWindowSlots));
const compactWindowBuild = time(() => protoTableSlotsCompact(oneWindowSlots));
const fullWindowHeap = heapEvidence(() => protoTableSlots(oneWindowSlots));
const compactWindowHeap = heapEvidence(() =>
  protoTableSlotsCompact(oneWindowSlots),
);
const fullWindowSizes = snapMaterialization(fullWindowSnapshot);
const compactWindowSizes = snapMaterialization(compactWindowSnapshot);

sampleRow(
  'build one full-dictionary 60-row snapshot',
  fullWindowBuild,
  `${heapExtra(fullWindowHeap)}; typed ${MB(fullWindowSizes.typedBytes)}; ` +
    `dictionary entries ${fullWindowSizes.dictionaryEntries.toLocaleString()}`,
  {
    memory: heapNumbers(fullWindowHeap),
    materialization: fullWindowSizes,
    snapshotRows: WINDOW,
    dictionaryMode: 'full table dictionaries copied into window snapshot',
  },
);
sampleRow(
  'build one compact-dictionary 60-row snapshot',
  compactWindowBuild,
  `${heapExtra(compactWindowHeap)}; typed ${MB(compactWindowSizes.typedBytes)}; ` +
    `dictionary entries ${compactWindowSizes.dictionaryEntries.toLocaleString()}`,
  {
    memory: heapNumbers(compactWindowHeap),
    materialization: compactWindowSizes,
    snapshotRows: WINDOW,
    dictionaryMode: 'window-local dictionary built from used string values',
  },
);

const scrollModes = [
  ['public: data( k ) per cell', (start) => publicWindow(start, false)],
  ['public: data() per row', (start) => publicWindow(start, true)],
  [
    'prototype: cached full-table snapshot',
    (start) => snapshotWindow(start, scrollSnapshot.out),
  ],
  [
    'prototype: build a 60-row snapshot, then read it',
    (start) => {
      const view = protoTableSlots(slotsForWindow(start));

      return snapshotWindow(0, view);
    },
  ],
  [
    'prototype: compact window dictionary, then read',
    (start) => {
      const view = protoTableSlotsCompact(slotsForWindow(start));

      return snapshotWindow(0, view);
    },
  ],
];

const allTraceStarts = [...sequentialStarts, ...jumpStarts];

for (const start of allTraceStarts) {
  const slots = slotsForWindow(start);
  const fullView = protoTableSlots(slots);
  const compactView = protoTableSlotsCompact(slots);

  assert(
    snapshotMatchesWindow(start, scrollSnapshot.out, start),
    `cached full snapshot exact cells at ${start}`,
  );
  assert(
    snapshotMatchesWindow(start, fullView, 0),
    `full-dictionary window exact cells at ${start}`,
  );
  assert(
    snapshotMatchesWindow(start, compactView, 0),
    `compact-dictionary window exact cells at ${start}`,
  );
}

{
  const label = compactWindowSnapshot.columns.label;
  const badLabel = { ...label, dict: [...label.dict] };

  badLabel.dict[badLabel.indices[0] - 1] = 'corrupted dictionary control';

  const corrupt = {
    ...compactWindowSnapshot,
    columns: { ...compactWindowSnapshot.columns, label: badLabel },
  };

  assert(
    !snapshotMatchesWindow(top, corrupt, 0),
    'exact string control rejects a same-shape corrupted dictionary',
  );
}

console.log(
  `  exact controls: ${allTraceStarts.length} trace windows × ` +
    `${VISIBLE_CELLS} cells per snapshot; corrupted dictionary rejected`,
);
rawControls.push({
  name: 'scroll snapshots exact cells against public data(k)',
  windows: allTraceStarts.length,
  cellsPerWindow: VISIBLE_CELLS,
  variants: ['cached full table', 'full-dictionary window', 'compact window'],
  corruptedDictionaryRejected: true,
  passed: true,
});

for (const [traceName, starts] of [
  ['sequential scroll (+1 row per viewport)', sequentialStarts],
  ['seeded distant jumps (≥1 viewport apart)', jumpStarts],
]) {
  const expectedTrace = { checksum: 0, present: 0 };

  for (const start of starts) {
    const expected = publicWindow(start, false);

    expectedTrace.checksum += expected.checksum;
    expectedTrace.present += expected.present;
  }

  const controlIndexes = [0, Math.floor(starts.length / 2), starts.length - 1];

  for (const [name, readWindow] of scrollModes) {
    for (const i of controlIndexes) {
      const start = starts[i];
      const expected = publicWindow(start, false);
      const actual = readWindow(start);

      assert(
        actual.checksum === expected.checksum &&
          actual.present === expected.present,
        `${traceName}/${name}: control viewport ${i}`,
      );
    }
  }

  console.log(
    `  ${traceName}: ${starts.length} viewports, ` +
      `${VISIBLE_CELLS.toLocaleString()} cells each; ` +
      'compare full-dictionary and window-local compact snapshots',
  );

  for (const [name, readWindow] of scrollModes) {
    const result = traceTime(starts, readWindow);

    assert(
      result.out.present === expectedTrace.present &&
        result.out.checksum === expectedTrace.checksum,
      `${traceName}/${name}: consumer result matches public read`,
    );
    traceRow(`${traceName}: ${name}`, result, starts);
  }

  rawControls.push({
    name: `${traceName}: timed consumer checksums and missing counts match public reads`,
    windows: starts.length,
    cellsPerWindow: VISIBLE_CELLS,
    variants: scrollModes.map(([name]) => name),
    passed: true,
  });
}

console.log(
  '  allocation evidence: snapshot rows/columns and post-GC retained bytes are ' +
    'reported above; per-window snapshots materialize one 60-row result each. ' +
    'Heap growth is approximate and does not count short-lived allocations reclaimed during a call.',
);

// -- 3. sort -------------------------------------------------------------------

console.log('\n3. sort: a row permutation by one column (ties by row)');

/** A permutation by `key`, extracting the column with data( k ) first. */
const sortByExtracted = (key) => {
  const vals = new Array(N);

  for (let i = 0; i < N; i++) {
    vals[i] = nodes[i].data(key);
  }

  const perm = Array.from({ length: N }, (_, i) => i);

  perm.sort((a, b) => (vals[a] < vals[b] ? -1 : vals[a] > vals[b] ? 1 : a - b));

  return perm;
};

/** The same off a snapshot: numbers direct, strings by dictionary rank. */
const sortBySnapshot = (key) => {
  const col = protoColumn('nodes', key, slotsOf(nodes));
  const perm = new Uint32Array(N);

  for (let i = 0; i < N; i++) {
    perm[i] = i;
  }

  if (col.kind === 'number') {
    const v = col.values;

    return perm.sort((a, b) => v[a] - v[b] || a - b);
  }

  // rank the (small) dictionary once, then compare u32 ranks per pair
  const order = col.dict.map((_, i) => i);

  order.sort((a, b) =>
    col.dict[a] < col.dict[b] ? -1 : col.dict[a] > col.dict[b] ? 1 : 0,
  );

  const rank = new Uint32Array(col.dict.length + 1);

  order.forEach((d, r) => (rank[d + 1] = r + 1));

  const keyOf = new Uint32Array(N);

  for (let i = 0; i < N; i++) {
    keyOf[i] = rank[col.indices[i]];
  }

  return perm.sort((a, b) => keyOf[a] - keyOf[b] || a - b);
};

for (const key of ['score', 'label', 'group']) {
  const cmp = time(() =>
    nodes.sort((a, b) => {
      const x = a.data(key);
      const y = b.data(key);

      return x < y ? -1 : x > y ? 1 : 0;
    }),
  );
  const ext = time(() => sortByExtracted(key));
  const snap = time(() => sortBySnapshot(key));

  // Tie order is each API's own, so compare every sorted value, not row ids.
  assert(cmp.out.length === N, `sort ${key}: collection result length`);
  assert(ext.out.length === N, `sort ${key}: extracted result length`);
  assert(snap.out.length === N, `sort ${key}: snapshot result length`);

  for (let i = 0; i < N; i++) {
    const v = nodes[ext.out[i]].data(key);

    assert(
      Object.is(nodes[snap.out[i]].data(key), v),
      `sort ${key} snapshot @${i}`,
    );
    assert(Object.is(cmp.out[i].data(key), v), `sort ${key} collection @${i}`);
  }

  row(`${key}: eles.sort( comparator over data( k ) )`, cmp);
  row(`${key}: data( k ) extract + index sort`, ext);
  row(`${key}: prototype snapshot + index sort`, snap);
  rawControls.push({
    name: `sort ${key}: every sorted value agrees; tie identities may differ`,
    rows: N,
    passed: true,
  });
}

// -- 4. distinct values ---------------------------------------------------------

console.log('\n4. distinct values: a facet table (value → count)');

for (const key of ['group', 'label']) {
  const loop = time(() => {
    const counts = new Map();

    for (let i = 0; i < N; i++) {
      const v = nodes[i].data(key);

      counts.set(v, (counts.get(v) ?? 0) + 1);
    }

    return counts;
  });
  const snap = time(() => {
    const col = protoColumn('nodes', key, slotsOf(nodes));
    const hist = new Uint32Array(col.dict.length + 1);

    for (let i = 0; i < N; i++) {
      hist[col.indices[i]]++;
    }

    const counts = new Map();

    for (let d = 1; d < hist.length; d++) {
      if (hist[d] > 0) {
        counts.set(col.dict[d - 1], hist[d]);
      }
    }

    return counts;
  });

  assert(loop.out.size === snap.out.size, `distinct ${key}: same size`);

  for (const [v, c] of snap.out) {
    assert(loop.out.get(v) === c, `distinct ${key}: ${v}`);
  }

  row(`${key} (${snap.out.size} values): data( k ) loop into a Map`, loop);
  row(`${key}: prototype dict-index histogram`, snap);
}

// -- 5. filters ------------------------------------------------------------------

console.log(
  '\n5. filters: result as a collection (app) or row indices (prototype)',
);

/** Rows of `eles` passing a compiled column test, as a Uint32Array. */
const rowsWhere = (slots, test) => {
  const out = new Uint32Array(slots.length);
  let n = 0;

  for (let i = 0; i < slots.length; i++) {
    if (test(slots[i])) {
      out[n++] = i;
    }
  }

  return out.subarray(0, n);
};

const dictTest = (key, value) => {
  const col = dataStore.column('nodes', key);
  const at = col.dict.indexOf(value) + 1; // 0: never matches a present row
  const idx = col.indices;

  return (s) => at !== 0 && s < idx.length && idx[s] === at;
};

const rangeTest = (key, lo, hi) => {
  const col = dataStore.column('nodes', key);
  const v = col.values;
  const p = col.present;

  return (s) => p[s] === 1 && v[s] >= lo && v[s] < hi;
};

function filterRows(label, eles, spellings) {
  const results = spellings.map(([name, fn]) => [name, time(fn)]);
  const normalized = results.map(([, r]) => normalizeFilterRows(r.out, eles));
  const counts = normalized.map((rows) => rows.length);

  assert(
    counts.every((c) => c === counts[0]),
    `${label}: counts agree (${counts.join(', ')})`,
  );
  assert(
    counts[0] > 0 && counts[0] < eles.length,
    `${label}: 0 < ${counts[0]} < ${eles.length}`,
  );

  for (let result = 1; result < normalized.length; result++) {
    assert(
      normalized[result].length === normalized[0].length &&
        normalized[result].every((row, i) => row === normalized[0][i]),
      `${label}: ${results[result][0]} returns the exact same row set/order`,
    );
  }

  console.log(
    `  ${label} — ${counts[0].toLocaleString()} of ${eles.length.toLocaleString()}`,
  );

  for (const [name, r] of results) {
    row(`  ${name}`, r);
  }

  rawControls.push({
    name: `${label}: exact ordered row identity comparison across spellings`,
    matchedRows: counts[0],
    spellings: results.map(([name]) => name),
    passed: true,
  });

  return results;
}

const half = nodes.filter((n, i) => i % 2 === 0);
const halfSlots = slotsOf(half);
const allSlots = slotsOf(nodes);
const nodeRowBySlot = new Int32Array(N).fill(-1);

for (let i = 0; i < allSlots.length; i++) {
  const slot = allSlots[i];

  assert(slot < N && nodeRowBySlot[slot] === -1, `node slot ${slot} is unique`);
  nodeRowBySlot[slot] = i;
}

function normalizeFilterRows(result, base) {
  if (result?._refs != null) {
    return Array.from(result._refs, (ref) => nodeRowBySlot[ref.slot]);
  }

  return Array.from(
    result,
    (localRow) => nodeRowBySlot[base._refs[localRow].slot],
  );
}

// the 84.3 gate's middle rung: the reader hoisted, no dict path
const hoisted = (eles, key, value) => {
  const read = dataStore.reader('nodes', key);
  const refs = eles._refs;
  const out = [];

  for (let i = 0; i < refs.length; i++) {
    if (read(refs[i].slot) === value) {
      out.push(i);
    }
  }

  return out;
};

/** Rows → a collection the internal way (what a core filter would do). */
const spawnRows = (eles, rows) => {
  const refs = eles._refs;
  const out = new Array(rows.length);

  for (let i = 0; i < rows.length; i++) {
    out[i] = refs[rows[i]];
  }

  return eles._spawnUnique(out);
};

filterRows('group = g3, whole node table', nodes, [
  [
    'eles.filter( n => n.data( k ) === v )',
    () => nodes.filter((n) => n.data('group') === 'g3'),
  ],
  [
    'cy.nodes( { data: { group: v } } ) (scan, readers hoisted)',
    () => cy.nodes({ data: { group: 'g3' } }),
  ],
  [
    'prototype: dict index, u32 compare → rows',
    () => rowsWhere(allSlots, dictTest('group', 'g3')),
  ],
  [
    'prototype: dict index, u32 compare → collection (internal)',
    () => spawnRows(nodes, rowsWhere(allSlots, dictTest('group', 'g3'))),
  ],
]);

filterRows('group = g3, a half-size subset', half, [
  [
    'sub.filter( n => n.data( k ) === v )',
    () => half.filter((n) => n.data('group') === 'g3'),
  ],
  [
    'sub.filter( { data: { group: v } } ) (store.data.get per row)',
    () => half.filter({ data: { group: 'g3' } }),
  ],
  [
    '84.3 gate: the reader hoisted, string compare → rows',
    () => hoisted(half, 'group', 'g3'),
  ],
  [
    '84.3 gate: the reader hoisted → collection (internal)',
    () => spawnRows(half, hoisted(half, 'group', 'g3')),
  ],
  [
    'prototype: dict index, u32 compare → rows',
    () => rowsWhere(halfSlots, dictTest('group', 'g3')),
  ],
  [
    'prototype: dict index, u32 compare → collection (internal)',
    () => spawnRows(half, rowsWhere(halfSlots, dictTest('group', 'g3'))),
  ],
]);

filterRows('0.2 ≤ score < 0.4, whole node table', nodes, [
  [
    'eles.filter( n => … n.data( k ) … )',
    () =>
      nodes.filter((n) => {
        const v = n.data('score');

        return v >= 0.2 && v < 0.4;
      }),
  ],
  [
    'cy.nodes( { gte } ).filter( { lt } ) (one op per key)',
    () =>
      cy
        .nodes({ data: { score: { gte: 0.2 } } })
        .filter({ data: { score: { lt: 0.4 } } }),
  ],
  [
    'prototype: Float64Array + presence → rows',
    () => rowsWhere(allSlots, rangeTest('score', 0.2, 0.4)),
  ],
]);

const K = 3;

filterRows(`degree ≥ ${K}, whole node table`, nodes, [
  [
    'eles.filter( n => n.degree() >= k )',
    () => nodes.filter((n) => n.degree() >= K),
  ],
  [
    'prototype: CSR out + in degree per slot → rows',
    () => {
      const adj = store.adj;

      return rowsWhere(
        allSlots,
        (s) => adj.outDegree(s) + adj.inDegree(s) >= K,
      );
    },
  ],
]);

// what a row-index result costs to turn into a collection (to select or
// style it): cy.collection() takes no arguments, so the public route is a
// mask read by an index-aware predicate
{
  const rows = rowsWhere(allSlots, dictTest('group', 'g3'));
  const toEles = time(() => {
    const mask = new Uint8Array(N);

    for (let i = 0; i < rows.length; i++) {
      mask[rows[i]] = 1;
    }

    return nodes.filter((n, i) => mask[i] === 1);
  });

  assert(toEles.out.length === rows.length, 'rows → collection');
  row('  rows → a collection (mask + eles.filter( ( n, i ) => … ))', toEles);
}

// -- 6. change tracking -----------------------------------------------------------

console.log(
  '\n6. dirty updates: same sparse/bulk writes, event collection and consumed values',
);

const pickUnique = (count, seed) => {
  const rand = rng(seed);
  const chosen = new Set();

  while (chosen.size < count) {
    chosen.add(Math.floor(rand() * N));
  }

  return [...chosen];
};

const baseScores = new Float64Array(N);
const slotToRow = nodeRowBySlot;
const rebuildAfterScroll = time(
  () => protoTable(nodes),
  invalidateOutsideTrace,
);
const dirtySnapshot = rebuildAfterScroll.out;
const dirtyScore = dirtySnapshot.columns.score;
const scoreColumn = dataStore.column('nodes', 'score');

assert(dirtyScore.kind === 'number', 'score snapshot has number column');
assert(scoreColumn.kind === 'number', 'score source has number column');
sampleRow(
  'full snapshot rebuild after an epoch change',
  rebuildAfterScroll,
  `typed ${MB(snapMaterialization(dirtySnapshot).typedBytes)}`,
);

for (let i = 0; i < N; i++) {
  baseScores[i] = nodes[i].data('score');
}

const nextScore = (rowIndex) => {
  return baseScores[rowIndex] < 0.5
    ? baseScores[rowIndex] + 0.125
    : baseScores[rowIndex] - 0.125;
};

function restoreDirtyRows(rows) {
  cy.batch(() => {
    for (const rowIndex of rows) {
      nodes[rowIndex].data('score', baseScores[rowIndex]);
    }
  });

  for (const rowIndex of rows) {
    dirtyScore.values[rowIndex] = baseScores[rowIndex];
  }

  dirtySnapshot.epoch = dataStore.epoch;

  for (const i of [0, Math.floor(rows.length / 2), rows.length - 1]) {
    const rowIndex = rows[i];

    assert(
      nodes[rowIndex].data('score') === baseScores[rowIndex],
      'public before guard',
    );
    assert(
      dirtyScore.values[rowIndex] === baseScores[rowIndex],
      'snapshot before guard',
    );
  }
}

function updateAndConsume(rows, viaSnapshot) {
  const epochBefore = dataStore.epoch;
  const dirty = new Set();
  const dirtyRows = [];
  const onData = (event) => {
    dirty.add(event.target);
    dirtyRows.push(event.target);
  };

  cy.on('data', onData);

  try {
    cy.batch(() => {
      for (const rowIndex of rows) {
        nodes[rowIndex].data('score', nextScore(rowIndex));
      }
    });
  } finally {
    cy.off('data', onData);
  }

  const epochAfterWrites = dataStore.epoch;
  const resultRows = new Uint32Array(dirtyRows.length);
  const values = new Float64Array(dirtyRows.length);

  assert(epochAfterWrites !== epochBefore, 'data epoch moves on writes');
  assert(dirty.size === rows.length, 'listener sees each changed row once');

  for (let i = 0; i < dirtyRows.length; i++) {
    const slot = dirtyRows[i]._refs[0].slot;
    const rowIndex = slot < slotToRow.length ? slotToRow[slot] : -1;

    assert(rowIndex >= 0, `dirty slot ${slot} maps to a snapshot row`);
    resultRows[i] = rowIndex;

    if (viaSnapshot) {
      const value = scoreColumn.present[slot] ? scoreColumn.values[slot] : NaN;

      dirtyScore.values[rowIndex] = value;
      values[i] = value;
    } else {
      values[i] = dirtyRows[i].data('score');
    }
  }

  if (viaSnapshot) {
    dirtySnapshot.epoch = dataStore.epoch;
  }

  return {
    rows: resultRows,
    values,
    dirtyCount: dirty.size,
    epochBefore,
    epochAfter: dataStore.epoch,
  };
}

function assertDirtyResult(result, rows, viaSnapshot, label) {
  assert(
    result.epochAfter !== result.epochBefore,
    `${label}: after guard epoch`,
  );
  assert(result.dirtyCount === rows.length, `${label}: exact dirty count`);
  assert(result.rows.length === rows.length, `${label}: row output count`);
  assert(result.values.length === rows.length, `${label}: value output count`);

  for (let i = 0; i < rows.length; i++) {
    const rowIndex = rows[i];
    const value = nextScore(rowIndex);

    assert(result.rows[i] === rowIndex, `${label}: row ${i} order`);
    assert(result.values[i] === value, `${label}: row ${i} result`);
    assert(
      nodes[rowIndex].data('score') === value,
      `${label}: row ${i} public value`,
    );

    if (viaSnapshot) {
      assert(
        dirtyScore.values[rowIndex] === value,
        `${label}: row ${i} snapshot value`,
      );
    } else {
      assert(
        dirtyScore.values[rowIndex] === baseScores[rowIndex],
        `${label}: public-only path leaves cached snapshot old`,
      );
    }

    for (const key of COLS) {
      if (key === 'score' && !viaSnapshot) {
        continue;
      }

      assert(
        cell(dirtySnapshot.columns[key], rowIndex) ===
          nodes[rowIndex].data(key),
        `${label}: changed-row column ${rowIndex}/${key}`,
      );
    }
  }

  if (viaSnapshot) {
    assert(
      dirtySnapshot.epoch === dataStore.epoch,
      `${label}: snapshot epoch current`,
    );
  } else {
    assert(
      dirtySnapshot.epoch !== dataStore.epoch,
      `${label}: snapshot epoch stale`,
    );
  }

  const changedRows = new Set(rows);
  const sentinels = [0, N - 1].filter((rowIndex) => !changedRows.has(rowIndex));

  if (sentinels.length === 0) {
    let rowIndex = 0;

    while (changedRows.has(rowIndex)) {
      rowIndex++;
    }

    sentinels.push(rowIndex);
  }

  for (const rowIndex of sentinels) {
    for (const key of COLS) {
      assert(
        cell(dirtySnapshot.columns[key], rowIndex) ===
          nodes[rowIndex].data(key),
        `${label}: unchanged-row sentinel ${rowIndex}/${key}`,
      );
    }
  }
}

/** 1000 "did anything move?" checks against a held epoch. */
const epochMoved = (held) => {
  let moved = 0;

  for (let i = 0; i < 1000; i++) {
    moved += dataStore.epoch !== held ? 1 : 0;
  }

  return moved;
};

for (let i = 0; i < 100; i++) {
  epochMoved(i);
}

for (const [index, count] of [
  1,
  Math.max(1, Math.round(N / 1000)),
  Math.max(1, Math.round(N / 100)),
  Math.max(1, Math.round(N / 10)),
].entries()) {
  const rows = pickUnique(count, N ^ (840 + index));

  console.log(
    `  ${count.toLocaleString()} unique score row(s) ` +
      `(${((count / N) * 100).toFixed(count === 1 ? 4 : 2)}% of table):`,
  );

  const publicUpdate = time(
    () => updateAndConsume(rows, false),
    () => restoreDirtyRows(rows),
  );
  assertDirtyResult(publicUpdate.out, rows, false, 'public dirty refresh');
  const publicHeap = heapEvidence(
    () => updateAndConsume(rows, false),
    () => restoreDirtyRows(rows),
  );
  if (publicHeap != null) {
    assertDirtyResult(
      publicHeap.keep,
      rows,
      false,
      'public allocation control',
    );
  }

  const prototypeUpdate = time(
    () => updateAndConsume(rows, true),
    () => restoreDirtyRows(rows),
  );
  assertDirtyResult(prototypeUpdate.out, rows, true, 'prototype dirty refresh');
  const prototypeHeap = heapEvidence(
    () => updateAndConsume(rows, true),
    () => restoreDirtyRows(rows),
  );
  if (prototypeHeap != null) {
    assertDirtyResult(
      prototypeHeap.keep,
      rows,
      true,
      'prototype allocation control',
    );
  }

  sampleRow(
    'public writes + event rows + data( score ) values',
    publicUpdate,
    heapExtra(publicHeap),
    {
      memory: heapNumbers(publicHeap),
      updatedRows: count,
      writesPerRun: count,
      resultRows: publicUpdate.out.rows.length,
      resultValues: publicUpdate.out.values.length,
    },
  );
  sampleRow(
    'prototype writes + event rows + dirty snapshot refresh',
    prototypeUpdate,
    heapExtra(prototypeHeap),
    {
      memory: heapNumbers(prototypeHeap),
      updatedRows: count,
      writesPerRun: count,
      resultRows: prototypeUpdate.out.rows.length,
      resultValues: prototypeUpdate.out.values.length,
    },
  );

  rawControls.push({
    name: `dirty update ${count}: public and snapshot paths agree on consumer rows/values`,
    updatedRows: count,
    publicAndPrototypeExact: true,
    beforeAndAfterGuardsPassed: true,
    passed: true,
  });
}

sampleRow(
  'epoch: 1000 "did it move?" comparisons',
  time(() => epochMoved(dataStore.epoch)),
);
row('keys payload (hypothetical): re-pull the one column', protoOne);
sampleRow('batchend, no tracking: re-pull every row object, cold', objCold);

// -- 7. the coverage gate (84.1) --------------------------------------------------

console.log(
  "\n7. coverage: an on-demand presence scan (84.1's measure-first gate)",
);

{
  const M = 200000;
  const present = new Uint8Array(M);
  const indices = new Uint32Array(M);
  const rand = rng(7);

  for (let i = 0; i < M; i++) {
    present[i] = rand() < 0.9 ? 1 : 0;
    indices[i] = rand() < 0.1 ? 1 + (i % 37) : 0;
  }

  const scanNum = time(() => {
    let c = 0;

    for (let i = 0; i < M; i++) {
      c += present[i];
    }

    return c;
  });
  const scanStr = time(() => {
    let c = 0;

    for (let i = 0; i < M; i++) {
      c += indices[i] !== 0 ? 1 : 0;
    }

    return c;
  });

  row('200k number column: sum of presence bytes', scanNum);
  row('200k string column: nonzero dict indices', scanStr);

  // live: every data column of this graph, masked by the live slots
  const live = time(() => {
    const out = {};

    for (const k of KEYS) {
      const col = dataStore.column('nodes', k);
      let c = 0;

      for (let i = 0; i < allSlots.length; i++) {
        const s = allSlots[i];

        c +=
          col.kind === 'number'
            ? col.present[s]
            : col.kind === 'string'
              ? s < col.indices.length && col.indices[s] !== 0
                ? 1
                : 0
              : col.values[s] !== undefined
                ? 1
                : 0;
      }

      out[k] = c;
    }

    return out;
  });

  assert(live.out.note === Math.ceil(N / 10), 'note coverage is 10%');
  assert(live.out.score === N, 'score coverage is every row');
  row(`all 7 columns of this graph (${N.toLocaleString()} live slots)`, live);
}

console.log(`\n(sink ${sink & 1})`);

if (JSON_PATH != null) {
  const sha256 = (path) =>
    createHash('sha256').update(readFileSync(path)).digest('hex');
  const fingerprintPaths = [
    'benchmark/table-view.mjs',
    'build/cytoscape-headless.esm.mjs',
    'src/core.mts',
    'src/collection/data.mts',
    'src/collection/filtering.mts',
    'src/store/data-store.mts',
  ];
  const fingerprints = Object.fromEntries(
    fingerprintPaths.map((path) => [path, sha256(resolve(ROOT, path))]),
  );
  let gitHead;

  try {
    gitHead = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();
  } catch {
    gitHead = null;
  }

  const artifact = {
    format: 'cytoscape-round84-table-view-raw-v1',
    capturedAt: new Date().toISOString(),
    command: [process.execPath, ...process.argv.slice(1)],
    gitHead,
    workload: {
      rows: N,
      edges: N,
      repeat: REPEAT,
      warmupIterations: 1,
      visibleRows: WINDOW,
      visibleColumns: COLS,
      traceWindowsPerPattern: TRACE_WINDOWS,
      sequentialStartRows: sequentialStarts,
      distantJumpStartRows: jumpStarts,
      dirtyUpdateSizes: [
        1,
        Math.max(1, Math.round(N / 1000)),
        Math.max(1, Math.round(N / 100)),
        Math.max(1, Math.round(N / 10)),
      ],
      dataShape: {
        uniqueStrings: 'label',
        numbers: ['score', 'rank'],
        lowCardinalityStrings: ['group (20 values)', 'region (5 values)'],
        mixed: 'active (boolean)',
        sparse: 'note (present on each tenth row)',
      },
    },
    environment: {
      node: process.version,
      v8: process.versions.v8,
      executable: process.execPath,
      gcExposed: gc != null,
      platform: process.platform,
      architecture: process.arch,
      osRelease: release(),
      cpuModel: cpus()[0]?.model ?? null,
      logicalCpuCount: cpus().length,
      totalMemoryBytes: totalmem(),
      freeMemoryAtEndBytes: freemem(),
    },
    fingerprints,
    timings: rawMeasurements,
    scrolling: rawTraces,
    controls: rawControls,
    memoryMethod: {
      retainedHeapAndArrayBufferBytesAfterGC:
        'Combined heapUsed+arrayBuffers kept live after forced GC with the result held; not total allocation.',
      approximateNetHeapAndArrayBufferDeltaBeforeGCBytes:
        'Noisy net process heapUsed+arrayBuffers delta before forced GC; allocations reclaimed during the call are absent.',
      payloadCounts:
        'Typed-array bytes, JavaScript array slots and string dictionary entries are reported separately.',
    },
    sink: sink & 1,
  };
  const outputPath = resolve(ROOT, JSON_PATH);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(artifact, null, 2) + '\n');
  console.log(`raw JSON: ${outputPath}`);
}
