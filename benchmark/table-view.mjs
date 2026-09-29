// Round 84's measurement (the eleventh design sitting's "measure first"):
// what an attribute table — a data grid plus a filter panel over the node
// table — costs at 100k rows through today's public `ele.data()` loops,
// against a prototype of the plan's column view (84.1) and compiled
// column filters (84.2).  The prototype lives in this file and reads the
// store's private columns (`cy._store.data`); nothing here is public API.
//
//   npm run build
//   node benchmark/table-view.mjs                  # 100k nodes, 5 repeats
//   node benchmark/table-view.mjs --nodes 20000 --repeat 3
//   node --expose-gc benchmark/table-view.mjs      # adds the heap column
//   node --import tsx benchmark/table-view.mjs --src   # through src/ (tsx)
//
// Measured for round 84 (i9-9900K, Node 24.18): the numbers and the
// recommendation are in the round file,
// plan/rounds/2026-08-14-15-rnd0084-plan-attribute-table-and-filter-affordances.md.
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

import { existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cpus, totalmem } from 'node:os';

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

const fmt = (ms) =>
  ms < 0.01
    ? `${(ms * 1000).toFixed(2)} µs`
    : ms < 1
      ? `${(ms * 1000).toFixed(0)} µs`
      : `${ms.toFixed(ms < 10 ? 2 : 1)} ms`;

let sink = 0;

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

  return { ms: median(xs), out };
}

/** Heap retained by `fn`'s result (needs --expose-gc; else undefined). */
function retained(fn) {
  if (gc == null) {
    return undefined;
  }

  gc();
  gc();

  const mem = () => {
    const m = process.memoryUsage();

    return m.heapUsed + m.arrayBuffers;
  };
  const before = mem();
  const keep = fn();

  gc();
  gc();

  const bytes = mem() - before;

  sink ^= keep == null ? 0 : 1;

  return bytes;
}

const MB = (b) => (b == null ? '' : `${(b / 1048576).toFixed(2)} MB`);

function row(label, ms, extra = '') {
  console.log(`  ${label.padEnd(58)} ${fmt(ms).padStart(10)}  ${extra}`);
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
function protoColumn(group, key, slots) {
  const n = slots.length;

  if (key === 'id') {
    const ids = new Array(n);

    for (let i = 0; i < n; i++) {
      ids[i] = store.idAt(group, slots[i]);
    }

    return { kind: 'id', values: ids };
  }

  const col = dataStore.column(group, key);

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

/** The whole table's snapshot, stamped with the store epoch. */
function protoTable(eles, keys = COLS) {
  const slots = slotsOf(eles);
  const columns = {};

  for (const k of keys) {
    columns[k] = protoColumn('nodes', k, slots);
  }

  return { epoch: dataStore.epoch, rows: slots.length, columns };
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

const snapBytes = (t) => {
  let b = 0;

  for (const col of Object.values(t.columns)) {
    if (col.kind === 'number') {
      b += col.values.byteLength;
    } else if (col.kind === 'string') {
      b += col.indices.byteLength;
    } else {
      b += col.values.length * 8; // pointer-sized slots; payload shared
    }
  }

  return b;
};

// -- 1. grid pull ------------------------------------------------------------

console.log('\n1. grid pull: every row × 8 columns (id + 7 data keys)');

const pullObjects = () => nodes.map((n) => n.data());

const objCold = time(pullObjects, invalidate);
const objWarm = time(pullObjects);

row(
  'data() objects, cold (a write since the last pull)',
  objCold.ms,
  MB(retained(() => (invalidate(), pullObjects()))),
);
row('data() objects, warm (no write since: the 62.4 memo)', objWarm.ms);

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

row('data( k ) per cell into 8 arrays', perKey.ms, MB(retained(pullPerKey)));

const keyUnion = time(() => {
  const seen = new Set();

  for (const d of objWarm.out) {
    for (const k in d) {
      seen.add(k);
    }
  }

  return seen.size;
});

row('  + key discovery: Object.keys union over warm objects', keyUnion.ms);

const proto = time(() => protoTable(nodes));

row(
  'prototype: column snapshots (8 columns, ids synthesized)',
  proto.ms,
  `${MB(retained(() => protoTable(nodes)))}  (typed payload ${MB(snapBytes(proto.out))})`,
);

const protoData = time(() => protoTable(nodes, KEYS));

row('prototype: the 7 data columns alone (no ids)', protoData.ms);

const protoOne = time(() => protoColumn('nodes', 'score', slotsOf(nodes)));

row('prototype: one number column (a per-column re-pull)', protoOne.ms);

const protoKeys = time(() =>
  dataStore.keys('nodes').map((k) => [k, dataStore.kind('nodes', k)]),
);

row('prototype: keys + kinds (dataKeys without coverage)', protoKeys.ms);

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

row('data( k ) per visible cell', time(windowCells).ms);
row(
  'data() per visible row, cold',
  time(() => {
    let n = 0;

    for (let r = top; r < top + WINDOW; r++) {
      n += Object.keys(nodes[r].data()).length;
    }

    return n;
  }, invalidate).ms,
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

  // the three agree on the sorted values (the collection sort's tie order
  // is its own, so compare values, not rows)
  for (let i = 0; i < N; i += 997) {
    const v = nodes[ext.out[i]].data(key);

    assert(nodes[snap.out[i]].data(key) === v, `sort ${key} snapshot @${i}`);
    assert(cmp.out[i].data(key) === v, `sort ${key} collection @${i}`);
  }

  row(`${key}: eles.sort( comparator over data( k ) )`, cmp.ms);
  row(`${key}: data( k ) extract + index sort`, ext.ms);
  row(`${key}: prototype snapshot + index sort`, snap.ms);
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

  row(`${key} (${snap.out.size} values): data( k ) loop into a Map`, loop.ms);
  row(`${key}: prototype dict-index histogram`, snap.ms);
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
  const counts = results.map(([, r]) => r.out.length);

  assert(
    counts.every((c) => c === counts[0]),
    `${label}: counts agree (${counts.join(', ')})`,
  );
  assert(
    counts[0] > 0 && counts[0] < eles.length,
    `${label}: 0 < ${counts[0]} < ${eles.length}`,
  );

  console.log(
    `  ${label} — ${counts[0].toLocaleString()} of ${eles.length.toLocaleString()}`,
  );

  for (const [name, r] of results) {
    row(`  ${name}`, r.ms);
  }

  return results;
}

const half = nodes.filter((n, i) => i % 2 === 0);
const halfSlots = slotsOf(half);
const allSlots = slotsOf(nodes);

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
  row('  rows → a collection (mask + eles.filter( ( n, i ) => … ))', toEles.ms);
}

// -- 6. change tracking -----------------------------------------------------------

console.log('\n6. change tracking: a write burst to one key, then the re-read');

const pick = (count) => {
  const rand = rng(count);

  return Array.from({ length: count }, () => Math.floor(rand() * N));
};

let wv = 0;

const burst = (rows) =>
  cy.batch(() => {
    for (const r of rows) {
      nodes[r].data('score', (wv++ % 1000) / 1000);
    }
  });

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

for (const count of [1, Math.round(N / 100), Math.round(N / 10)]) {
  const rows = pick(count);
  const quiet = time(() => burst(rows));

  const dirty = new Set();
  const onData = (e) => dirty.add(e.target);

  cy.on('data', onData);

  const heard = time(
    () => burst(rows),
    () => dirty.clear(),
  );

  cy.off('data', onData);

  const reread = time(
    () => {
      let n = 0;

      for (const ele of dirty) {
        n += Object.keys(ele.data()).length;
      }

      return n;
    },
    () => invalidate(),
  );

  const epoch0 = dataStore.epoch;

  burst(rows);

  assert(dataStore.epoch !== epoch0, 'the epoch moves on a write');

  const epochCheck = time(() => epochMoved(epoch0));

  console.log(
    `  ${count.toLocaleString()} row(s), score (${dirty.size.toLocaleString()} distinct):`,
  );
  row('  write burst, no listener', quiet.ms);
  row('  write burst, a `data` listener collecting the rows', heard.ms);
  row('  listener: re-read the dirty rows with data()', reread.ms);
  row('  epoch: 1000 "did it move?" compares', epochCheck.ms);
}

console.log(
  '  the re-pulls a coarser signal implies (section 1, whatever the burst):',
);
row('  epoch / cursor: re-pull every column (store-grained)', proto.ms);
row('  keys payload (hypothetical): re-pull the one column', protoOne.ms);
row('  batchend, no tracking: re-pull every row object, cold', objCold.ms);

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

  row('200k number column: sum of presence bytes', scanNum.ms);
  row('200k string column: nonzero dict indices', scanStr.ms);

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
  row(
    `all 7 columns of this graph (${N.toLocaleString()} live slots)`,
    live.ms,
  );
}

console.log(`\n(sink ${sink & 1})`);
