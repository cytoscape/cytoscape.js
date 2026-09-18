// Round 110.1: the copy census, headless half — what a byte pays to get
// from a wire buffer into the model, phase by phase, through the *built*
// ESM bundle (a per-element ingest that builds closures is exactly the
// shape the `__name` lesson says tsx distorts).
//
//   npm run build
//   node benchmark/copy-census-headless.mjs            # the phase table
//   node --cpu-prof --cpu-prof-dir=/tmp/cy-prof \
//     benchmark/copy-census-headless.mjs --profile     # 3 inits, sampled
//   node benchmark/copy-census-headless.mjs --aggregate /tmp/cy-prof/*.cpuprofile
//
// Rows: JSON.parse / toColumnarElements / serialize / deserialize (with
// the zero-copy check — every numeric column must be a view over the
// wire buffer), init from the three payload forms (median of REPS,
// construct + destroy), and the two typed-array column copies ingest
// pays in isolation: the position memcpy and the endpoint index→slot
// remap.  `--aggregate` splits a CPU profile of `--profile` by the
// ingest's own function names, so the record can say what share of
// init is a *copy* against id registration, adjacency and style apply.
//
// The row would not move if the copy were free; the control is the
// byte count — the position memcpy is 157 KB and the remap 3.7 MB, and
// the remap reads ~200× the memcpy (the round record has the numbers).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import cytoscape from '../build/cytoscape.esm.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(DIR, '..', 'debug', 'network-ndex-x-large.json');
const args = process.argv.slice(2);
const REPS = 5;

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);

  return s[Math.floor(s.length / 2)];
};
const timed = (f) => {
  const t = performance.now();
  const r = f();

  return [performance.now() - t, r];
};

// the ingest's own phases, as the CPU profile names them
const PHASES = [
  '_addColumnar',
  'addNodesColumnar',
  'addEdgesColumnar',
  'registerBulk',
  'setBulk',
  'ingestDataColumns',
  'allocBulk',
  'writeBulkFlags',
  'onAddEdge',
  'addBulk',
  '_applyStyle',
  'deserializeElements',
];

if (args[0] === '--aggregate') {
  aggregate(args[1]);
  process.exit(0);
}

const style = {
  nodes: {
    width: 12,
    height: 12,
    'background-color': {
      case: [{ when: { data: 'Node_Type', eq: 'TF' }, then: '#c0392b' }],
      else: '#4a7dbd',
    },
    label: { data: 'name' },
    'font-size': 10,
    color: '#333',
  },
  edges: { width: 1, 'line-color': '#bbb', opacity: 0.6 },
};

const text = readFileSync(FIXTURE, 'utf8');
const [parseMs, json] = timed(() => JSON.parse(text));
const [columnarMs, columnar] = timed(() =>
  cytoscape.toColumnarElements(json.elements),
);
const [serializeMs, wire] = timed(() => cytoscape.serializeElements(columnar));
const [deserializeMs, dec] = timed(() => cytoscape.deserializeElements(wire));

if (args[0] === '--profile') {
  for (let i = 0; i < 3; i++) {
    cytoscape({
      headless: true,
      elements: cytoscape.deserializeElements(wire),
      style,
    }).destroy();
  }

  process.exit(0);
}

const numeric = [
  dec.nodes.positions,
  dec.edges.sources,
  dec.edges.targets,
  dec.nodes.selected,
  dec.edges.selected,
  ...Object.values(dec.nodes.data ?? {}),
  ...Object.values(dec.edges.data ?? {}),
]
  .map((c) => (c != null && 'indices' in c ? c.indices : c))
  .filter((c) => ArrayBuffer.isView(c));
const zeroCopy = numeric.every((c) => c.buffer === wire);

console.log(
  `\n== copy census, headless (ndex-x-large: ${dec.nodes.count} nodes, ${dec.edges.count} edges; wire ${(wire.byteLength / 1e6).toFixed(2)} MB) ==`,
);
console.log(
  `JSON.parse ${parseMs.toFixed(0)} ms · toColumnarElements ${columnarMs.toFixed(0)} ms · serialize ${serializeMs.toFixed(0)} ms · deserialize ${deserializeMs.toFixed(1)} ms (${numeric.length} numeric columns ${zeroCopy ? 'all views over the wire buffer' : 'NOT all views — a copy crept in'})`,
);

if (!zeroCopy) {
  process.exitCode = 1;
}

const initRow = (name, make) => {
  const t = [];

  for (let i = 0; i < REPS; i++) {
    const elements = make();
    const t0 = performance.now();
    const cy = cytoscape({ headless: true, elements, style });

    t.push(performance.now() - t0);
    cy.destroy();
  }

  console.log(
    `init ${name}: ${median(t).toFixed(0)} ms (median of ${REPS}; ${t.map((x) => x.toFixed(0)).join(' ')})`,
  );
};

initRow('from wire views', () => cytoscape.deserializeElements(wire));
initRow('from columnar', () => columnar);
initRow('from definitions', () => json.elements);

// the column copies in isolation
const n = dec.nodes.count;
const m = dec.edges.count;
const pos = new Float32Array(n * 4);
const ends = new Uint32Array(m * 4);
const slots = new Uint32Array(n).map((_, i) => i);
const posMs = [];
const endsMs = [];

for (let r = 0; r < 20; r++) {
  posMs.push(timed(() => pos.set(dec.nodes.positions, 0))[0]);
  endsMs.push(
    timed(() => {
      const s = dec.edges.sources;
      const tg = dec.edges.targets;

      for (let i = 0; i < m; i++) {
        ends[i * 2] = slots[s[i]];
        ends[i * 2 + 1] = slots[tg[i]];
      }
    })[0],
  );
}

console.log(
  `position column memcpy (${n * 8} B): ${median(posMs).toFixed(3)} ms · endpoint index→slot remap (${m * 8} B): ${median(endsMs).toFixed(2)} ms`,
);

function aggregate(file) {
  const p = JSON.parse(readFileSync(file, 'utf8'));
  const byId = new Map(p.nodes.map((node) => [node.id, node]));
  const selfById = new Map();
  let total = 0;

  for (let i = 0; i < p.samples.length; i++) {
    const dt = p.timeDeltas[i] / 1000;

    total += dt;
    selfById.set(p.samples[i], (selfById.get(p.samples[i]) ?? 0) + dt);
  }

  const inclusive = (id) => {
    let s = selfById.get(id) ?? 0;

    for (const c of byId.get(id).children ?? []) {
      s += inclusive(c);
    }

    return s;
  };
  const agg = new Map();
  // a function's inclusive time counts once, at its outermost frame
  const walk = (id, active) => {
    const name = byId.get(id).callFrame.functionName;
    let next = active;

    if (PHASES.includes(name) && !active.has(name)) {
      agg.set(name, (agg.get(name) ?? 0) + inclusive(id));
      next = new Set([...active, name]);
    }

    for (const c of byId.get(id).children ?? []) {
      walk(c, next);
    }
  };

  walk(p.nodes[0].id, new Set());
  console.log(
    `sampled ${total.toFixed(0)} ms over the profile; inclusive ms per phase:`,
  );

  for (const name of PHASES) {
    console.log(`  ${(agg.get(name) ?? 0).toFixed(1).padStart(8)}  ${name}`);
  }
}
