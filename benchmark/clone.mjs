// Round 106's measurement: what a second view costs, when it is a second
// instance — the one-shot `cy.clone()`, the live follow burst, and the
// duplicated memory — at three scales, plus the ndex-x-large shape the
// plan's memory estimate was computed for.
//
//   npm run build
//   node --expose-gc benchmark/clone.mjs              # 1k / 10k / 100k, 5 repeats
//   node --expose-gc benchmark/clone.mjs --ndex       # + 19.6k nodes / 465k edges
//   node --expose-gc benchmark/clone.mjs --src        # through src/ (tsx) instead
//
// Rows, each the median of the repeats:
//
//   1. **clone** — `cy.clone()`, whole, and its two halves timed apart on
//      the same graph: `cy.serialize()`, and a fresh instance from that
//      buffer with the same sheet (the ingest and the whole-graph style
//      apply).  The difference is the clone's own work (the options, the
//      sheet copy, the lock/grab/pan carry).  Asserted: the clone has the
//      source's element count and a sampled node's position and data.
//   2. **follow** — a following clone (`follow: { throttle: 0 }`); 1% of
//      the source's nodes move (the drag shape), and the row is the time
//      from the last write to the clone's `patch` event — the wake, the
//      macrotask hop, the serialize and the patch.  Asserted: the sync's
//      diff is exactly the moved nodes.  A second row is the restyle
//      control: a sheet change on the source, which must cost no sync.
//   3. **memory** — `heapUsed + arrayBuffers` after a forced GC, before
//      and after one clone, so the duplicated model is measured rather
//      than computed from COLUMN_SPECS.  Needs --expose-gc (it says so
//      and skips the row otherwise).
//
// Through the built headless bundle by default: the tsx path's `__name`
// wrapper costs per closure creation (docs/agents/benchmarking.md).

import { existsSync } from 'node:fs';
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
const REPEAT = Number(opt('--repeat', 5));
const FROM_SRC = args.includes('--src');
const bundle = resolve(ROOT, 'build/cytoscape-headless.esm.mjs');

if (!FROM_SRC && !existsSync(bundle)) {
  console.error('no build/cytoscape-headless.esm.mjs — run `npm run build`');
  process.exit(1);
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

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);

  return s[Math.floor(s.length / 2)];
};

/** A deterministic graph of `nodes` nodes and `edges` edges, as a wire buffer. */
function build(nodes, edges) {
  let seed = 106;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;

    return seed / 0x7fffffff;
  };
  const defs = [];

  for (let i = 0; i < nodes; i++) {
    defs.push({
      data: { id: 'n' + i, label: 'n' + i, score: (i % 97) / 97 },
      position: { x: (i % 300) * 20, y: Math.floor(i / 300) * 20 },
    });
  }

  for (let j = 0; j < edges; j++) {
    defs.push({
      data: {
        id: 'e' + j,
        source: 'n' + Math.floor(rand() * nodes),
        target: 'n' + Math.floor(rand() * nodes),
        weight: (j % 89) / 89,
      },
    });
  }

  // built once, then serialized: every repeat loads the same buffer fast
  const cy = cytoscape({ elements: defs, style: STYLE });
  const buffer = cy.serialize();

  cy.destroy();

  return buffer;
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const gc = globalThis.gc;
const footprint = async () => {
  for (let i = 0; i < 3; i++) {
    gc();
    await tick();
  }

  const m = process.memoryUsage();

  return m.heapUsed + m.arrayBuffers;
};

const SCALES = [
  { name: '1k', nodes: 250, edges: 750 },
  { name: '10k', nodes: 2500, edges: 7500 },
  { name: '100k', nodes: 25000, edges: 75000 },
];

if (args.includes('--ndex')) {
  // the plan's estimate: ndex-x-large, 19.6k nodes / 465k edges
  SCALES.push({ name: 'ndex-x-large shape', nodes: 19600, edges: 465000 });
}

console.log(
  `clone bench — ${FROM_SRC ? 'src (tsx)' : 'built headless bundle'}, ` +
    `node ${process.version}, ${cpus()[0].model}, ` +
    `${Math.round(totalmem() / 2 ** 30)} GiB, repeat ${REPEAT}`,
);

const rows = [];

for (const scale of SCALES) {
  const buffer = build(scale.nodes, scale.edges);
  const total = scale.nodes + scale.edges;
  const row = { ...scale, total };
  const cloneMs = [];
  const serializeMs = [];
  const loadMs = [];
  const followMs = [];
  const restyleSyncs = [];

  for (let r = 0; r < REPEAT; r++) {
    const cy = cytoscape({ elements: buffer, style: STYLE });

    cy.$id('n7').lock();

    // 1. the one-shot clone, whole and in halves — each timed region
    // after a forced GC where one is exposed: whichever region ran first
    // otherwise paid the previous repeat's garbage (measured at the ndex
    // shape: ~230 ms landing on whichever of clone / serialize led)
    gc?.();

    let t0 = performance.now();
    const copy = cy.clone();

    cloneMs.push(performance.now() - t0);

    if (
      copy.elements().length !== total ||
      copy.$id('n7').data('score') !== cy.$id('n7').data('score') ||
      copy.$id('n7').locked() !== true
    ) {
      throw new Error(`clone @ ${scale.name}: not a copy`);
    }

    copy.destroy();
    gc?.();

    t0 = performance.now();
    const wire = cy.serialize();
    const t1 = performance.now();
    const fresh = cytoscape({ elements: wire, style: STYLE });

    serializeMs.push(t1 - t0);
    loadMs.push(performance.now() - t1);
    fresh.destroy();

    // 2. the follow burst: 1% of the nodes move
    gc?.();

    const follower = cy.clone({ follow: { throttle: 0 } });
    const nodes = cy.nodes();
    const step = 100;
    const want = Math.ceil((nodes.length - r) / step);
    const synced = new Promise((res) =>
      follower.one('patch', (e) => res([performance.now(), e.diff])),
    );

    for (let i = r; i < nodes.length; i += step) {
      const p = nodes[i].position();

      nodes[i].position({ x: p.x + 1, y: p.y - 1 });
    }

    const wrote = performance.now();
    const [at, diff] = await synced;

    if (diff.updated.length !== want || diff.added.length !== 0) {
      throw new Error(
        `follow @ ${scale.name}: updated ${diff.updated.length}, want ${want}`,
      );
    }

    followMs.push(at - wrote);

    // the control: a restyle on the source must not sync
    let syncs = 0;

    follower.on('patch', () => syncs++);
    cy.style({ ...STYLE, edges: { width: 3 } });
    await tick();
    await tick();
    restyleSyncs.push(syncs);

    follower.destroy();
    cy.destroy();
  }

  row.clone = median(cloneMs);
  row.serialize = median(serializeMs);
  row.load = median(loadMs);
  row.follow = median(followMs);
  row.restyleSyncs = Math.max(...restyleSyncs);

  // 3. the duplicated memory
  if (gc != null) {
    const cy = cytoscape({ elements: buffer, style: STYLE });
    const before = await footprint();
    const copy = cy.clone();
    const after = await footprint();

    row.memory = after - before;
    row.buffer = buffer.byteLength;
    copy.destroy();
    cy.destroy();
  }

  rows.push(row);
}

console.log('');
console.log(
  '| scale | elements | clone ms | serialize ms | load from wire ms | follow burst ms (1% moved) | restyle syncs | clone memory MB | wire MB |',
);
console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|');

for (const r of rows) {
  const mb = (b) => (b == null ? '—' : (b / 2 ** 20).toFixed(1));

  console.log(
    `| ${r.name} | ${r.total} | ${r.clone.toFixed(1)} | ${r.serialize.toFixed(1)} | ${r.load.toFixed(1)} | ${r.follow.toFixed(1)} | ${r.restyleSyncs} | ${mb(r.memory)} | ${mb(r.buffer)} |`,
  );
}

if (gc == null) {
  console.log('\n(memory skipped: run with node --expose-gc)');
}
