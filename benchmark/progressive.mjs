// Round 103's measurement: progressive ingest — what showing a partial
// graph early costs, and where the cost lands.
//
//   npm run build
//   node --expose-gc benchmark/progressive.mjs                 # ndex-x-large, k = 1..100
//   node --expose-gc benchmark/progressive.mjs --k 10 --repeat 5
//   node --expose-gc benchmark/progressive.mjs --src           # through src/ (tsx)
//
// The fixture is ndex-x-large (19,607 nodes / 464,657 edges, preset
// positions — both flagship apps' streamed shape), loaded from
// `debug/network-ndex-x-large.json` with the harness's production sheet
// (`debug/styles.js`), so the style apply is the one round 67 measured.
//
// **103.1 — the zero-format-change baseline.**  The graph is split into k
// chunks, and each strategy is timed from nothing to the whole graph:
//
//   * **monolithic** — `cytoscape( { elements, style } )`, the reference
//     (definitions, and the wire buffer).
//   * **vertex-closed, defs** — the nodes split in payload order; an edge
//     travels with whichever of its endpoints arrives last, so chunk j is
//     its nodes, the edges among them, and the *cut* edges back into
//     chunks < j.  Chunk one through the factory, every later chunk
//     through `cy.add( defs )` — the definition form is the only one in
//     which a cut edge can name an earlier chunk's node today.
//   * **vertex-closed, columnar + cut defs** — the same chunks, each
//     chunk's self-contained part converted to the columnar form app-side
//     and its cut edges added as definitions: the best a zero-format app
//     can do.
//   * **nodes first** — chunk one is every node (and nothing else); the
//     edges follow in k − 1 definition chunks.  Every edge is a cut edge.
//
// Each row reports the time to the **first chunk** (the headless proxy
// for the first frame — the browser rows are `--browser`), the **total**,
// and the **churn factor** (total ÷ monolithic).  "Where the churn
// lands" splits every later chunk's add into its parts: the ingest
// (inside a batch, so the style apply defers), the style apply (the
// batch's end), and the curve derivation flush a frame would run
// (`flushDerived`, which is what `takeDelta` calls).
//
// Every row asserts its end state — the element count, and every node's
// position and a sample of edges' endpoints against the monolithic load
// — so a strategy that loses elements cannot read faster.
//
// Through the built headless bundle by default: the tsx path's `__name`
// wrapper costs per closure creation (docs/agents/benchmarking.md).

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cpus, totalmem } from 'node:os';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, '..');
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);

  return i >= 0 ? args[i + 1] : fallback;
};
const REPEAT = Number(opt('--repeat', 3));
const KS = opt('--k', '2,5,10,20,50,100').split(',').map(Number);
const FROM_SRC = args.includes('--src');
const ONLY = opt('--only', null);
const bundle = resolve(ROOT, 'build/cytoscape-headless.esm.mjs');

if (!FROM_SRC && !existsSync(bundle)) {
  console.error('no build/cytoscape-headless.esm.mjs — run `npm run build`');
  process.exit(1);
}

const cytoscape = FROM_SRC
  ? (await import('../src/headless.mjs')).default
  : (await import(pathToFileURL(bundle).href)).default;

const styles = require('../debug/styles.js');
const networks = require('../debug/networks.js');
const NET = 'ndex-x-large';
const json = JSON.parse(
  readFileSync(resolve(ROOT, 'debug/network-ndex-x-large.json'), 'utf8'),
).elements;
const STYLE = styles.sheet('production', NET, json, networks[NET]);
const gc = globalThis.gc;
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);

  return s[Math.floor(s.length / 2)];
};
const now = () => performance.now();

// the definition form, cloned per use: a factory adopts position objects
// by reference (benchmark/load.mjs's header), so a def array is consumed
const cloneDef = (d) => ({
  data: { ...d.data },
  ...(d.position != null ? { position: { ...d.position } } : {}),
});
const NODES = json.nodes;
// ndex's edges carry no ids; give them stable ones so the end-state check
// can compare edge by edge across strategies
const EDGES = json.edges.map((e, i) => ({
  ...e,
  data: { id: 'e' + i, ...e.data },
}));
const total = NODES.length + EDGES.length;

/** Split into k vertex-closed chunks: nodes in payload order; an edge
 * travels with the later of its endpoints' chunks. */
function vertexClosed(k) {
  const chunkOf = new Map();
  const per = Math.ceil(NODES.length / k);
  const chunks = Array.from({ length: k }, () => ({
    nodes: [],
    internal: [],
    cut: [],
  }));

  NODES.forEach((n, i) => {
    const c = Math.floor(i / per);

    chunkOf.set(n.data.id, c);
    chunks[c].nodes.push(n);
  });

  for (const e of EDGES) {
    const a = chunkOf.get(e.data.source);
    const b = chunkOf.get(e.data.target);
    const c = Math.max(a, b);

    (a === b ? chunks[c].internal : chunks[c].cut).push(e);
  }

  return chunks;
}

/** Chunk one is every node; the edges follow in k − 1 chunks. */
function nodesFirst(k) {
  const chunks = [{ nodes: NODES, internal: [], cut: [] }];
  const per = Math.ceil(EDGES.length / Math.max(1, k - 1));

  for (let i = 0; i < EDGES.length; i += per) {
    chunks.push({ nodes: [], internal: [], cut: EDGES.slice(i, i + per) });
  }

  return chunks;
}

const reference = cytoscape({
  elements: {
    nodes: NODES.map(cloneDef),
    edges: EDGES.map(cloneDef),
  },
  style: STYLE,
});

/** The end-state check: counts, every node's position, sampled edges. */
function check(cy, name) {
  if (cy.elements().length !== total) {
    throw new Error(`${name}: ${cy.elements().length} elements, want ${total}`);
  }

  for (let i = 0; i < NODES.length; i += 97) {
    const id = NODES[i].data.id;
    const p = cy.$id(id).position();
    const q = reference.$id(id).position();

    if (p.x !== q.x || p.y !== q.y) {
      throw new Error(`${name}: node ${id} at ${p.x},${p.y}`);
    }
  }

  for (let i = 0; i < EDGES.length; i += 997) {
    const e = cy.$id(EDGES[i].data.id);

    if (
      e.data('source') !== EDGES[i].data.source ||
      e.data('target') !== EDGES[i].data.target
    ) {
      throw new Error(`${name}: edge ${EDGES[i].data.id} endpoints`);
    }
  }
}

/**
 * One chunked load.  `form` picks how a later chunk's self-contained
 * part travels ('defs' or 'columnar'); cut edges are always definitions.
 * Returns the first-chunk time, the total, and the later chunks' parts.
 */
function chunkedLoad(chunks, form) {
  // payloads built outside the timed region: an app receives them ready
  const payloads = chunks.map((c, i) => {
    const own = {
      nodes: c.nodes.map(cloneDef),
      edges: c.internal.map(cloneDef),
    };

    return {
      own:
        i > 0 && form === 'columnar' ? cytoscape.toColumnarElements(own) : own,
      cut: c.cut.map(cloneDef),
    };
  });

  gc?.();

  const t0 = now();
  const cy = cytoscape({ elements: payloads[0].own, style: STYLE });

  cy._store.flushDerived();

  const first = now() - t0;
  let ingest = 0;
  let apply = 0;
  let flush = 0;

  for (let i = 1; i < payloads.length; i++) {
    const { own, cut } = payloads[i];
    let t = now();

    cy.startBatch();

    if (form === 'columnar') {
      if (own.nodes?.count > 0 || own.edges?.count > 0) {
        cy.add(own);
      }
      if (cut.length > 0) {
        cy.add(cut);
      }
    } else {
      cy.add([...own.nodes, ...own.edges, ...cut]);
    }

    let t1 = now();

    ingest += t1 - t;
    cy.endBatch();
    t = now();
    apply += t - t1;
    cy._store.flushDerived();
    flush += now() - t;
  }

  const totalMs = now() - t0;

  return { cy, first, total: totalMs, ingest, apply, flush };
}

function monolithic(form) {
  const elements =
    form === 'wire'
      ? cytoscape.serializeElements({
          nodes: NODES.map(cloneDef),
          edges: EDGES.map(cloneDef),
        })
      : { nodes: NODES.map(cloneDef), edges: EDGES.map(cloneDef) };

  gc?.();

  const t0 = now();
  const cy = cytoscape({ elements, style: STYLE });

  cy._store.flushDerived();

  return { cy, first: now() - t0, total: now() - t0 };
}

const fmt = (x) => x.toFixed(0).padStart(6);

console.log(
  `progressive ingest bench — ${FROM_SRC ? 'src (tsx)' : 'built headless bundle'}, ` +
    `node ${process.version}, ${cpus()[0].model}, ` +
    `${Math.round(totalmem() / 2 ** 30)} GiB, repeat ${REPEAT}, ` +
    `${NODES.length} nodes / ${EDGES.length} edges`,
);

const rows = [];
const run = (name, fn) => {
  if (ONLY != null && !name.includes(ONLY)) {
    return;
  }

  const samples = [];

  for (let r = 0; r < REPEAT; r++) {
    const res = fn();

    check(res.cy, name);
    res.cy.destroy();
    delete res.cy;
    samples.push(res);
  }

  const pick = (key) =>
    samples[0][key] == null ? null : median(samples.map((s) => s[key]));
  const row = {
    name,
    first: pick('first'),
    total: pick('total'),
    ingest: pick('ingest'),
    apply: pick('apply'),
    flush: pick('flush'),
    cut: samples[0].cut ?? null,
  };

  rows.push(row);
  console.log(
    `${name.padEnd(44)} first ${fmt(row.first)}  total ${fmt(row.total)}` +
      (row.ingest != null
        ? `  | later: ingest ${fmt(row.ingest)} apply ${fmt(row.apply)} flush ${fmt(row.flush)}`
        : '') +
      (row.cut != null ? `  cut ${row.cut}` : ''),
  );
};

run('monolithic (defs)', () => monolithic('defs'));
run('monolithic (wire)', () => monolithic('wire'));

for (const k of KS) {
  const vc = vertexClosed(k);
  const cutCount = vc.reduce((n, c) => n + c.cut.length, 0);

  run(`vertex-closed k=${k}, defs`, () => ({
    ...chunkedLoad(vc, 'defs'),
    cut: cutCount,
  }));
  run(`vertex-closed k=${k}, columnar + cut defs`, () => ({
    ...chunkedLoad(vc, 'columnar'),
    cut: cutCount,
  }));

  const nf = nodesFirst(k);

  run(`nodes first k=${k}, edge defs`, () => ({
    ...chunkedLoad(nf, 'defs'),
    cut: EDGES.length,
  }));
}

const base = rows.find((r) => r.name === 'monolithic (defs)')?.total;

if (base != null) {
  console.log('\nchurn factor (total ÷ monolithic defs):');

  for (const r of rows) {
    console.log(`  ${r.name.padEnd(44)} ${(r.total / base).toFixed(2)}×`);
  }
}

reference.destroy();
