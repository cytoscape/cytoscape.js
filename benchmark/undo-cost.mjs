// Round 139's measurement (PLAN.md item 41, "first measurement"): what a
// snapshot undo costs at 100k elements — bytes and milliseconds to take a
// snapshot, and to restore one — and, beside it, the per-operation price
// of the inverse-operation log, the other fork.
//
//   npm run build
//   node benchmark/undo-cost.mjs                   # 100k elements, 5 repeats
//   node benchmark/undo-cost.mjs --elements 20000 --repeat 3
//   node benchmark/undo-cost.mjs --ops 5000        # inverse-log ops per row
//   node --import tsx benchmark/undo-cost.mjs --src   # through src/ (tsx)
//
// Measured for round 139 (i9-9900K, Node 24.18): the numbers and what
// they imply are in src/README.md, "Undo: the snapshot price".
//
// The graph is round 107's shape (benchmark/patch.mjs): n nodes (a
// quarter of the elements) and 3n edges, nodes carrying label / score /
// group, edges weight, under a sheet with data-mapped width, colour and
// labels, so a restore pays the style work a real one does.
//
// Sections:
//
//   1. **public snapshot** — `cy.serialize()`: the snapshot an app takes
//      at `batchstart` today (round 139's events), bytes and ms.  It
//      carries ids, positions, parents, endpoints, selection and data();
//      not classes, bypasses, locks or the sheet.
//   2. **public restore** — from each edit, back to the snapshot:
//      `cy.patch( snapshot )` (keeps survivors' session state; the undo an
//      app can write in four lines) and, for comparison, recreating the
//      instance from the snapshot (drops listeners, selection-by-handle,
//      scratch, viewport).  Each row asserts the restored state against
//      the snapshot, so a restore that did less cannot read faster, and
//      each edit is checked to have changed that state first.
//   3. **the core-internal floor** — the store's own typed arrays copied
//      (`slice`) and written back (`set`): every column of both tables
//      up to highWater, the generation counters, and the data store's
//      typed columns.  This is the least a core snapshot could cost; it
//      omits the id map, adjacency, hierarchy, blob pools, label sidecars
//      and object-valued data, which a real one must also copy or rebuild
//      (their share is printed as "not in the floor").
//   4. **inverse log** — per-op cost of recording each op's inverse
//      before doing it, over the public API, against the op alone:
//      data(), position(), and a node remove (whose inverse must capture
//      the removed closure as definitions — v4 cannot restore a removed
//      element).
//
// Through the built headless bundle by default (the tsx `__name`
// wrapper costs per closure creation — docs/agents/benchmarking.md).

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
const ELEMENTS = Number(opt('--elements', 100000));
const REPEAT = Number(opt('--repeat', 5));
const FROM_SRC = args.includes('--src');
const OPS = Number(opt('--ops', 2000));

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
    'background-color': { data: 'score', domain: [0, 1], range: 'viridis' },
  },
  edges: { width: { data: 'weight', domain: [0, 1], range: [1, 6] } },
};

const GROUPS = Array.from({ length: 20 }, (_, i) => `g${i}`);

/** A small deterministic PRNG (mulberry32). */
const rng = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;

  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);

  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function buildDefs(total) {
  const n = Math.round(total / 4);
  const m = total - n;
  const rand = rng(139);
  const nodes = [];
  const edges = [];

  for (let i = 0; i < n; i++) {
    nodes.push({
      data: {
        id: 'n' + i,
        label: 'n' + i,
        score: (i % 97) / 97,
        group: GROUPS[i % GROUPS.length],
      },
      position: { x: (i % 300) * 20, y: Math.floor(i / 300) * 20 },
    });
  }

  for (let j = 0; j < m; j++) {
    edges.push({
      data: {
        id: 'e' + j,
        source: 'n' + Math.floor(rand() * n),
        target: 'n' + Math.floor(rand() * n),
        weight: (j % 89) / 89,
      },
    });
  }

  return { nodes, edges, n, m };
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);

  return s[Math.floor(s.length / 2)];
};

const fmtMs = (ms) => ms.toFixed(ms < 10 ? 2 : 1);
const fmtMB = (b) => (b / 1048576).toFixed(2);

const load = (elements) =>
  cytoscape({ headless: true, styleEnabled: true, style: STYLE, elements });

const defs = buildDefs(ELEMENTS);

console.log(
  `undo cost: ${defs.n.toLocaleString()} nodes, ${defs.m.toLocaleString()} ` +
    `edges; median of ${REPEAT}; ` +
    (FROM_SRC ? 'src/ via tsx' : 'build/cytoscape-headless.esm.mjs'),
);
console.log(
  `node ${process.version}, ${cpus()[0].model}, ` +
    `${Math.round(totalmem() / 1073741824)} GiB`,
);

const cy = load(defs);

// -- 1. the public snapshot --------------------------------------------------

const snapTimes = [];
let snapshot = null;

for (let r = 0; r < REPEAT + 1; r++) {
  const t0 = performance.now();

  snapshot = cy.serialize();

  const ms = performance.now() - t0;

  if (r > 0) {
    snapTimes.push(ms);
  }
}

const jsonTimes = [];
let jsonBytes = 0;

for (let r = 0; r < REPEAT; r++) {
  const t0 = performance.now();
  const text = JSON.stringify(cy.elements().jsons());

  jsonTimes.push(performance.now() - t0);
  jsonBytes = text.length;
}

console.log('\n1. public snapshot');
console.log(
  `  cy.serialize()                 ${fmtMs(median(snapTimes)).padStart(8)} ms   ` +
    `${fmtMB(snapshot.byteLength).padStart(7)} MB`,
);
console.log(
  `  JSON.stringify(eles.jsons())   ${fmtMs(median(jsonTimes)).padStart(8)} ms   ` +
    `${fmtMB(jsonBytes).padStart(7)} MB  (the v3-shaped snapshot, for scale)`,
);

// -- 2. the public restore ---------------------------------------------------

const expected = {
  count: cy.elements().length,
  score5: cy.$id('n5').data('score'),
  pos7: { ...cy.$id('n7').position() },
  n: defs.n,
};

/** Assert the instance matches the snapshot's state (a sample). */
function checkRestored(target, label) {
  const ok =
    target.elements().length === expected.count &&
    target.$id('n5').data('score') === expected.score5 &&
    target.$id('n7').position().x === expected.pos7.x &&
    target.$id('n7').position().y === expected.pos7.y &&
    target.nodes().length === expected.n &&
    !target.$id('n3').empty() &&
    target.$id('e0').source().id() === defs.edges[0].data.source;

  if (!ok) {
    throw new Error(`${label}: restore did not reach the snapshot`);
  }
}

const EDITS = [
  {
    name: 'nothing (identity)',
    run: () => {},
    changed: () => true,
  },
  {
    name: 'one data value',
    run: (c) => c.$id('n5').data('score', 0.999),
    changed: (c) => c.$id('n5').data('score') === 0.999,
  },
  {
    name: '1% of nodes moved',
    run: (c) =>
      c.batch(() => {
        for (let i = 7; i < defs.n; i += 100) {
          c.$id('n' + i).position({ x: -5, y: -5 });
        }
      }),
    changed: (c) => c.$id('n7').position().x === -5,
  },
  {
    name: '10% of nodes data()',
    run: (c) =>
      c.batch(() => {
        for (let i = 5; i < defs.n; i += 10) {
          c.$id('n' + i).data('score', 0.5);
        }
      }),
    changed: (c) => c.$id('n5').data('score') === 0.5,
  },
  {
    name: '1% of nodes removed',
    run: (c) => {
      const doomed = new Set();

      for (let i = 3; i < defs.n; i += 100) {
        doomed.add('n' + i);
      }

      c.nodes()
        .filter((ele) => doomed.has(ele.id()))
        .remove();
    },
    changed: (c) => c.$id('n3').empty(),
  },
];

console.log('\n2. public restore, from each edit back to the snapshot');
console.log('  edit                        patch(snapshot)');

for (const edit of EDITS) {
  const patchTimes = [];

  for (let r = 0; r < REPEAT + 1; r++) {
    edit.run(cy);

    if (!edit.changed(cy)) {
      throw new Error(`${edit.name}: the edit changed nothing`);
    }

    const t0 = performance.now();

    cy.patch(snapshot);

    const ms = performance.now() - t0;

    checkRestored(cy, `patch after ${edit.name}`);

    if (r > 0) {
      patchTimes.push(ms);
    }
  }

  console.log(
    `  ${edit.name.padEnd(26)} ${fmtMs(median(patchTimes)).padStart(9)} ms`,
  );
}

// recreating does not depend on the edit: it rebuilds from the snapshot
const recreateTimes = [];

for (let r = 0; r < REPEAT; r++) {
  const t0 = performance.now();
  const fresh = load(snapshot);
  const ms = performance.now() - t0;

  checkRestored(fresh, 'recreate');
  fresh.destroy();
  recreateTimes.push(ms);
}

console.log(
  `  recreate from the snapshot (any edit) ${fmtMs(median(recreateTimes))} ms`,
);

// -- 3. the core-internal floor ----------------------------------------------

/** Every typed array the store holds in its tables and data columns. */
function storeArrays(c) {
  const store = c._store;
  const out = [];

  for (const table of [store.nodes, store.edges]) {
    const hw = table.highWater;

    out.push({ name: `${table.group}.gen`, arr: table.gen, len: hw });

    for (const [id, arr] of table.arrays) {
      const components = arr.length / table.cap;

      out.push({ name: id, arr, len: hw * components });
    }
  }

  let untyped = 0;

  for (const group of ['nodes', 'edges']) {
    const hw = store.table(group).highWater;

    for (const [key, col] of store.data.cols[group]) {
      if (col.kind === 'number') {
        out.push({ name: `data.${key}`, arr: col.values, len: hw });
        out.push({ name: `data.${key}.present`, arr: col.present, len: hw });
      } else if (col.kind === 'string') {
        out.push({ name: `data.${key}`, arr: col.indices, len: hw });
        untyped += col.dict.length;
      } else {
        untyped += col.values.length;
      }
    }
  }

  return { arrays: out, untyped };
}

const { arrays, untyped } = storeArrays(cy);
const copyTimes = [];
const setTimes = [];
let floorBytes = 0;
let copies = null;

for (let r = 0; r < REPEAT + 1; r++) {
  const t0 = performance.now();

  copies = arrays.map(({ arr, len }) => arr.slice(0, len));

  const t1 = performance.now();

  for (let i = 0; i < arrays.length; i++) {
    arrays[i].arr.set(copies[i]);
  }

  const t2 = performance.now();

  if (r > 0) {
    copyTimes.push(t1 - t0);
    setTimes.push(t2 - t1);
  }
}

floorBytes = copies.reduce((sum, a) => sum + a.byteLength, 0);

const byGroup = (prefix) =>
  arrays
    .map((a, i) => (a.name.startsWith(prefix) ? copies[i].byteLength : 0))
    .reduce((x, y) => x + y, 0);
const nodeBytes = byGroup('node');
const edgeBytes = byGroup('edge');
const dataBytes = byGroup('data.');
const largest = arrays
  .map((a, i) => ({ name: a.name, bytes: copies[i].byteLength }))
  .sort((a, b) => b.bytes - a.bytes)
  .slice(0, 5);

console.log('\n3. core-internal floor (typed-array copies of the store)');
console.log(
  `  ${arrays.length} arrays, ${fmtMB(floorBytes)} MB ` +
    `(node tables ${fmtMB(nodeBytes)}, edge tables ${fmtMB(edgeBytes)}, ` +
    `data columns ${fmtMB(dataBytes)})`,
);
console.log(`  snapshot (slice) ${fmtMs(median(copyTimes)).padStart(8)} ms`);
console.log(`  restore (set)    ${fmtMs(median(setTimes)).padStart(8)} ms`);
console.log(
  '  largest: ' +
    largest.map((l) => `${l.name} ${fmtMB(l.bytes)} MB`).join(', '),
);
// the model subset: what an element *is* (positions, flags, endpoints,
// generations, data) as against the style channels a restore could
// re-derive by re-applying the sheet
const MODEL = new Set([
  'node.position',
  'node.flags',
  'edge.endpoints',
  'edge.flags',
  'nodes.gen',
  'edges.gen',
]);
const model = arrays.filter(
  (a) => MODEL.has(a.name) || a.name.startsWith('data.'),
);

if (model.length < MODEL.size) {
  throw new Error('the model subset is missing a column — ids changed?');
}

const modelTimes = [];
let modelBytes = 0;

for (let r = 0; r < REPEAT + 1; r++) {
  const t0 = performance.now();
  const c = model.map(({ arr, len }) => arr.slice(0, len));
  const ms = performance.now() - t0;

  modelBytes = c.reduce((sum, a) => sum + a.byteLength, 0);

  if (r > 0) {
    modelTimes.push(ms);
  }
}

console.log(
  `  model subset (positions, flags, endpoints, gen, data): ` +
    `${fmtMB(modelBytes)} MB, slice ${fmtMs(median(modelTimes))} ms`,
);
console.log(
  `  not in the floor: id map, adjacency, hierarchy, blob pools, label ` +
    `sidecars, ${untyped.toLocaleString()} untyped data entries`,
);

// -- 4. the inverse log ------------------------------------------------------

/** Time `fn( i )` over OPS distinct nodes inside one batch; ns per op. */
function perOp(target, fn) {
  const t0 = performance.now();

  target.batch(() => {
    for (let i = 0; i < OPS; i++) {
      fn(i);
    }
  });

  return ((performance.now() - t0) * 1e6) / OPS;
}

const inverse = [];
const node = (c, i) => c.$id('n' + ((i * 7) % defs.n));

const rows = [
  {
    name: 'data( k, v )',
    plain: (c) => (i) => node(c, i).data('score', (i % 50) / 50),
    logged: (c) => (i) => {
      const ele = node(c, i);

      inverse.push([ele, 'score', ele.data('score')]);
      ele.data('score', (i % 50) / 50);
    },
  },
  {
    name: 'position( p )',
    plain: (c) => (i) => node(c, i).position({ x: i, y: -i }),
    logged: (c) => (i) => {
      const ele = node(c, i);
      const p = ele.position();

      inverse.push([ele, p.x, p.y]);
      ele.position({ x: i, y: -i });
    },
  },
  {
    name: 'node remove()',
    plain: (c) => (i) => node(c, i).remove(),
    logged: (c) => (i) => {
      const ele = node(c, i);

      if (ele.empty()) {
        return;
      }

      const closure = ele.union(ele.connectedEdges());

      inverse.push(closure.jsons());
      closure.remove();
    },
  },
];

console.log(`\n4. inverse log, ${OPS.toLocaleString()} ops in one batch`);
console.log('  op               alone      +inverse   overhead');

for (const row of rows) {
  const plain = [];
  const logged = [];

  for (let r = 0; r < REPEAT; r++) {
    // alternate the order and start each from a fresh graph, so neither
    // variant samples the other's state (removals especially)
    const a = load(snapshot);
    const b = load(snapshot);

    inverse.length = 0;

    if (r % 2 === 0) {
      plain.push(perOp(a, row.plain(a)));
      logged.push(perOp(b, row.logged(b)));
    } else {
      logged.push(perOp(b, row.logged(b)));
      plain.push(perOp(a, row.plain(a)));
    }

    if (inverse.length === 0) {
      throw new Error(`${row.name}: the logged variant recorded nothing`);
    }

    a.destroy();
    b.destroy();
  }

  const p = median(plain);
  const l = median(logged);

  console.log(
    `  ${row.name.padEnd(16)} ${(p / 1000).toFixed(2).padStart(6)} µs ` +
      `${(l / 1000).toFixed(2).padStart(8)} µs ` +
      `${((l - p) / 1000).toFixed(2).padStart(8)} µs`,
  );
}

cy.destroy();
