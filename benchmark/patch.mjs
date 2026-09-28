// Round 107's measurement: what an id-keyed reconcile of a fresh payload
// costs, against the two things an app does today, at 100k elements and
// 90% / 50% / 10% id overlap.
//
//   npm run build
//   node benchmark/patch.mjs                 # 100k elements, 5 repeats
//   node benchmark/patch.mjs --elements 20000 --repeat 3
//   node benchmark/patch.mjs --src           # through src/ (tsx) instead
//
// The strategies, each timed from a freshly loaded graph A to the state
// of payload B (the timed region is the strategy alone; building A is
// not in it):
//
//   1. **recreate** — `cy.destroy()` and a new instance from B, the
//      honest baseline apps use today (it drops selection, positions,
//      listeners and viewport, which no row here charges it for).  Two
//      rows: from the definition form, and from the wire buffer (the
//      fastest load v4 has).
//   2. **app diff** — the reconcile an app writes over the public API
//      inside one `cy.batch()`: remove what is gone, re-add a rewired
//      edge, write changed data keys and clear dropped ones, add what is
//      new.
//   3. **patch** — `cy.patch( B )` from the definition, columnar and wire
//      forms (skipped, with a note, when the bundle has no `patch`).
//
// Payloads.  A has n nodes (a quarter of the elements) and 3n edges.  B
// keeps exactly `overlap` of each group's ids — the survivor edges join
// survivor nodes by construction, so the overlap is exact for both
// groups — and replaces the rest with fresh ids.  10% of the surviving
// nodes change their `score` (the GeneMANIA re-query shape: the same
// genes, new weights), and 1% of the surviving edges are rewired (the
// id kept, an endpoint changed), which a patch must turn into a
// remove + add.  B carries no positions, as a server's query result does
// not; survivors keep theirs.
//
// Every row asserts its end state — the element count and a sample of
// ids, data values and endpoints against B — so a strategy that does
// less work than the others cannot read faster.  A final identity row
// patches B onto a graph already equal to B, the controlled no-op.
//
// Through the built headless bundle by default: the tsx path's `__name`
// wrapper costs per closure creation (docs/agents/benchmarking.md).

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
const OVERLAPS = String(opt('--overlaps', '0.9,0.5,0.1'))
  .split(',')
  .map(Number);
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
  const age = statSync(bundle).mtimeMs;
  const srcNewer = statSync(resolve(ROOT, 'src/core.mts')).mtimeMs > age;

  if (srcNewer) {
    console.warn('warning: src/core.mts is newer than the bundle');
  }
}

const STYLE = {
  nodes: {
    label: 'data(label)',
    width: { data: 'score', domain: [0, 1], range: [10, 40] },
    'background-color': { data: 'score', domain: [0, 1], range: 'viridis' },
  },
  edges: { width: { data: 'weight', domain: [0, 1], range: [1, 6] } },
};

// -- payloads ----------------------------------------------------------------

/** A small deterministic PRNG (mulberry32), so every run builds the same graphs. */
const rng = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;

  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);

  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const GROUPS = Array.from({ length: 20 }, (_, i) => `g${i}`);

/**
 * Graph A and payload B at one overlap, both in definition form.
 *
 * A's nodes 0..keepN-1 survive into B; its edges 0..keepM-1 join two
 * survivor nodes and survive too, the rest touch at least one node B
 * drops.  B adds fresh nodes and edges (each fresh edge touches a fresh
 * node) back up to the same counts.
 */
function buildPair(total, overlap) {
  const n = Math.round(total / 4);
  const m = total - n;
  const keepN = Math.round(n * overlap);
  const keepM = Math.round(m * overlap);
  const rand = rng(107);
  const pick = (lo, hi) => lo + Math.floor(rand() * (hi - lo));
  const node = (id, i) => ({
    data: {
      id,
      label: id,
      score: (i % 97) / 97,
      group: GROUPS[i % GROUPS.length],
    },
  });
  const aNodes = [];
  const bNodes = [];

  for (let i = 0; i < n; i++) {
    const def = node('n' + i, i);

    def.position = { x: (i % 300) * 20, y: Math.floor(i / 300) * 20 };
    aNodes.push(def);

    if (i < keepN) {
      const b = node('n' + i, i);

      // 10% of the survivors carry a new score
      if (i % 10 === 0) {
        b.data.score = ((i * 7) % 97) / 97;
      }

      bNodes.push(b);
    }
  }

  for (let i = keepN; i < n; i++) {
    bNodes.push(node('m' + i, i));
  }

  const aEdges = [];
  const bEdges = [];
  const survivorNode = () => 'n' + pick(0, keepN);

  for (let j = 0; j < m; j++) {
    const weight = (j % 89) / 89;
    let source;
    let target;

    if (j < keepM) {
      source = survivorNode();
      target = survivorNode();
    } else {
      // at least one endpoint B drops
      source = 'n' + pick(keepN, n);
      target = 'n' + pick(0, n);
    }

    aEdges.push({ data: { id: 'e' + j, source, target, weight } });

    if (j < keepM) {
      // 1% of the survivors are rewired: same id, a new target
      const rewired = j % 100 === 0;

      bEdges.push({
        data: {
          id: 'e' + j,
          source,
          target: rewired ? survivorNode() : target,
          weight,
        },
      });
    }
  }

  for (let j = keepM; j < m; j++) {
    const fresh = 'm' + pick(keepN, n);
    const other = rand() < 0.5 ? survivorNode() : 'm' + pick(keepN, n);

    bEdges.push({
      data: { id: 'f' + j, source: fresh, target: other, weight: rand() },
    });
  }

  return {
    a: { nodes: aNodes, edges: aEdges },
    b: { nodes: bNodes, edges: bEdges },
    counts: { n, m, keepN, keepM },
  };
}

/** Definition payloads are consumed by some paths; hand each run its own copy. */
const copyDefs = (defs) => ({
  nodes: defs.nodes.map((d) => ({
    data: { ...d.data },
    ...(d.position ? { position: { ...d.position } } : {}),
  })),
  edges: defs.edges.map((d) => ({ data: { ...d.data } })),
});

// -- strategies --------------------------------------------------------------

const RESERVED = new Set(['id', 'source', 'target', 'parent']);

/** Strategy 2: the reconcile an app writes over the public API today. */
function appDiff(cy, b) {
  const next = new Set();

  for (const d of b.nodes) {
    next.add(d.data.id);
  }
  for (const d of b.edges) {
    next.add(d.data.id);
  }

  cy.batch(() => {
    cy.remove(cy.elements().filter((ele) => !next.has(ele.id())));

    const adds = [];
    const reconcile = (d, isEdge) => {
      const ele = cy.getElementById(d.data.id);

      if (ele.empty()) {
        adds.push(d);

        return;
      }

      if (
        isEdge &&
        (ele.source().id() !== d.data.source ||
          ele.target().id() !== d.data.target)
      ) {
        ele.remove();
        adds.push(d);

        return;
      }

      const cur = ele.data();
      const write = {};
      let changed = false;

      for (const k of Object.keys(d.data)) {
        if (!RESERVED.has(k) && cur[k] !== d.data[k]) {
          write[k] = d.data[k];
          changed = true;
        }
      }

      const dropped = Object.keys(cur).filter(
        (k) => !RESERVED.has(k) && !(k in d.data),
      );

      if (changed) {
        ele.data(write);
      }
      if (dropped.length > 0) {
        ele.removeData(dropped.join(' '));
      }
    };

    for (const d of b.nodes) {
      reconcile(d, false);
    }
    for (const d of b.edges) {
      reconcile(d, true);
    }

    cy.add(adds);
  });

  return cy;
}

/** The end-state check every row runs: counts, and a sample against B. */
function assertMatches(cy, b, label) {
  const fail = (what) => {
    throw new Error(`${label}: ${what}`);
  };

  if (cy.nodes().length !== b.nodes.length) {
    fail(`${cy.nodes().length} nodes, want ${b.nodes.length}`);
  }
  if (cy.edges().length !== b.edges.length) {
    fail(`${cy.edges().length} edges, want ${b.edges.length}`);
  }

  for (let i = 0; i < b.nodes.length; i += 97) {
    const d = b.nodes[i].data;
    const ele = cy.getElementById(d.id);

    if (ele.empty() || ele.data('score') !== d.score) {
      fail(`node ${d.id} score ${ele.data('score')}, want ${d.score}`);
    }
  }

  for (let i = 0; i < b.edges.length; i += 89) {
    const d = b.edges[i].data;
    const ele = cy.getElementById(d.id);

    if (
      ele.empty() ||
      ele.source().id() !== d.source ||
      ele.target().id() !== d.target
    ) {
      fail(`edge ${d.id} endpoints differ from B`);
    }
  }
}

const median = (xs) => {
  const s = [...xs].sort((p, q) => p - q);

  return s[Math.floor(s.length / 2)];
};

// -- run ---------------------------------------------------------------------

const hasPatch = typeof cytoscape({}).patch === 'function';

console.log(
  `patch benchmark: ${ELEMENTS} elements, ${REPEAT} repeats, ` +
    `${FROM_SRC ? 'src/ via tsx' : 'build/cytoscape-headless.esm.mjs'}; ` +
    `node ${process.version}, ${cpus()[0].model}, ` +
    `${Math.round(totalmem() / 2 ** 30)} GiB`,
);

if (!hasPatch) {
  console.log('(no cy.patch in this build: the patch rows are skipped)');
}

const rows = [];

for (const overlap of OVERLAPS) {
  const { a, b, counts } = buildPair(ELEMENTS, overlap);
  const bColumnar = cytoscape.toColumnarElements(copyDefs(b));
  const bWire = cytoscape.serializeElements(copyDefs(b));
  const load = () => cytoscape({ elements: copyDefs(a), style: STYLE });

  const strategies = [
    [
      'recreate (defs)',
      (cy) => {
        cy.destroy();

        return cytoscape({ elements: copyDefs(b), style: STYLE });
      },
      () => copyDefs(b),
    ],
    [
      'recreate (wire)',
      (cy) => {
        cy.destroy();

        return cytoscape({ elements: bWire, style: STYLE });
      },
      null,
    ],
    ['app diff (defs)', (cy, input) => appDiff(cy, input), () => copyDefs(b)],
  ];

  if (hasPatch) {
    strategies.push(
      ['patch (defs)', (cy, input) => (cy.patch(input), cy), () => copyDefs(b)],
      ['patch (columnar)', (cy) => (cy.patch(bColumnar), cy), null],
      ['patch (wire)', (cy) => (cy.patch(bWire), cy), null],
    );
  }

  for (const [name, run, prepare] of strategies) {
    const times = [];

    for (let r = 0; r < REPEAT; r++) {
      const cy = load();
      const input = prepare?.();
      const t0 = performance.now();
      const out = run(cy, input);
      const ms = performance.now() - t0;

      assertMatches(out, b, `${name} @ ${overlap}`);
      times.push(ms);
      out.destroy();
    }

    rows.push({ overlap, name, ms: median(times), counts });
  }

  if (hasPatch) {
    // the identity control: B onto a graph already equal to B
    const times = [];

    for (let r = 0; r < REPEAT; r++) {
      const cy = cytoscape({ elements: copyDefs(b), style: STYLE });
      const t0 = performance.now();
      const diff = cy.patch(bWire);
      const ms = performance.now() - t0;
      const changed =
        diff.added.length + diff.removed.length + diff.updated.length;

      if (changed !== 0) {
        throw new Error(`identity patch changed ${changed} elements`);
      }

      times.push(ms);
      cy.destroy();
    }

    rows.push({ overlap, name: 'patch (wire), identity', ms: median(times) });
  }
}

console.log('');
console.log('| overlap | strategy | median ms | vs recreate (defs) |');
console.log('|---:|---|---:|---:|');

for (const row of rows) {
  const base = rows.find(
    (r) => r.overlap === row.overlap && r.name === 'recreate (defs)',
  );

  console.log(
    `| ${Math.round(row.overlap * 100)}% | ${row.name} | ${row.ms.toFixed(1)} | ` +
      `${(base.ms / row.ms).toFixed(2)}x |`,
  );
}
