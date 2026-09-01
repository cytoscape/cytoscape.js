#!/usr/bin/env node
/*
Round 112.1: the DAG fixture set for the layout-quality harness.

  node benchmark/fixtures/dag/derive.mjs   regenerate every fixture JSON

The harness ("comparable to dagre" as a measured bar, PLAN.md item 49)
needs inputs whose shape is *argued for*, not assumed, so each fixture
here is either real or a deterministic generator whose parameters are
stated:

- `deps.json` — the repo's own `package-lock.json` as a dependency DAG
  (a real npm graph: 400+ packages, heavy fan-in on the popular
  utilities, a few long chains).  Derivation lives here, the same rule
  as `debug/slim-ndex.mjs`: the checked-in JSON has a re-runnable
  source.
- `workflow-1k.json` / `workflow-10k.json` — staged pipeline DAGs
  (seeded): stages of varying width, dense stage-to-stage edges, ~6%
  skip edges spanning 2–4 stages.  The scale points for runtime-at-N.
- `deep-skips.json` — a narrow 120-stage ladder with skip edges up to
  30 stages long: the dummy-node stressor (dagre materializes a dummy
  per intermediate rank; Eiglsperger segments exist for exactly this).
- `compound.json` — the workflow generator plus contiguous-stage
  cluster assignments (~36 parents, 2 nesting levels): the compound
  fixture for round 112.3's gates (dagre clusters / elk hierarchy take
  it today).

Node sizes vary (seeded, 20–80 px wide) so size-aware placement is
actually exercised — uniform boxes would let a size-blind x-pass look
correct.  Every generator is deterministic (mulberry32, fixed seeds);
`nodes`/`edges` use the cytoscape-ish `{ id, w, h, parent? }` /
`{ id, source, target }` shape shared by the harness adapters.
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, '..', '..', '..');

const mulberry32 = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Seeded node size: most nodes 30x30, widths spread 20-80. */
const sizeOf = (rand) => {
  const w = Math.round(20 + rand() * 60);
  const h = Math.round(24 + rand() * 12);
  return { w, h };
};

const write = (name, fixture) => {
  const path = join(DIR, `${name}.json`);
  writeFileSync(path, JSON.stringify(fixture));
  console.log(
    `${name}.json: ${fixture.nodes.length} nodes, ${fixture.edges.length} edges` +
      (fixture.nodes.some((n) => n.parent != null)
        ? `, ${new Set(fixture.nodes.map((n) => n.parent).filter(Boolean)).size} parents`
        : ''),
  );
};

// --- deps: the repo's package-lock as a real dependency DAG -------------

const deriveDeps = () => {
  const lock = JSON.parse(
    readFileSync(join(ROOT, 'package-lock.json'), 'utf8'),
  );
  const rand = mulberry32(112);
  const entries = Object.entries(lock.packages).filter(([k]) => k !== '');
  // name a package by its node_modules path tail; the path is unique in
  // the lockfile even for multi-version installs
  const idOf = (path) => path.replace(/^node_modules\//, '');
  const ids = new Set(entries.map(([k]) => idOf(k)));
  const nodes = entries.map(([k]) => ({ id: idOf(k), ...sizeOf(rand) }));
  nodes.unshift({ id: '(root)', w: 60, h: 30 });

  const edges = [];
  const addDeps = (fromId, deps) => {
    for (const dep of Object.keys(deps ?? {})) {
      // hoisted resolution is enough for a fixture: prefer the top-level
      // install, which the lockfile guarantees exists for hoisted deps
      if (ids.has(dep)) {
        edges.push({ id: `e${edges.length}`, source: fromId, target: dep });
      }
    }
  };
  addDeps('(root)', {
    ...lock.packages[''].dependencies,
    ...lock.packages[''].devDependencies,
  });
  for (const [k, v] of entries) {
    addDeps(idOf(k), v.dependencies);
  }
  return { nodes, edges };
};

// --- workflow: staged pipeline DAGs -------------------------------------

const genWorkflow = ({ seed, stages, meanWidth, skipShare }) => {
  const rand = mulberry32(seed);
  const nodes = [];
  const edges = [];
  const stageNodes = [];
  for (let s = 0; s < stages; s++) {
    const width = Math.max(1, Math.round(meanWidth * (0.4 + rand() * 1.2)));
    const layer = [];
    for (let i = 0; i < width; i++) {
      const id = `s${s}n${i}`;
      nodes.push({ id, ...sizeOf(rand) });
      layer.push(id);
    }
    stageNodes.push(layer);
  }
  for (let s = 1; s < stages; s++) {
    const prev = stageNodes[s - 1];
    for (const id of stageNodes[s]) {
      // 1-3 parents from the previous stage
      const k = 1 + Math.floor(rand() * 3);
      for (let j = 0; j < k; j++) {
        const src = prev[Math.floor(rand() * prev.length)];
        edges.push({ id: `e${edges.length}`, source: src, target: id });
      }
    }
  }
  // skip edges spanning 2-4 stages
  const skips = Math.round(edges.length * skipShare);
  for (let i = 0; i < skips; i++) {
    const s = Math.floor(rand() * (stages - 4));
    const span = 2 + Math.floor(rand() * 3);
    const from = stageNodes[s];
    const to = stageNodes[s + span];
    edges.push({
      id: `e${edges.length}`,
      source: from[Math.floor(rand() * from.length)],
      target: to[Math.floor(rand() * to.length)],
    });
  }
  return { nodes, edges, stageNodes };
};

// --- deep-skips: the dummy-node stressor --------------------------------

const genDeepSkips = () => {
  const rand = mulberry32(1121);
  const { nodes, edges, stageNodes } = genWorkflow({
    seed: 1121,
    stages: 120,
    meanWidth: 8,
    skipShare: 0,
  });
  // long skips: 400 edges spanning up to 30 stages, each of which costs
  // dagre span-1 dummies apiece
  for (let i = 0; i < 400; i++) {
    const s = Math.floor(rand() * (stageNodes.length - 31));
    const span = 5 + Math.floor(rand() * 26);
    const from = stageNodes[s];
    const to = stageNodes[s + span];
    edges.push({
      id: `e${edges.length}`,
      source: from[Math.floor(rand() * from.length)],
      target: to[Math.floor(rand() * to.length)],
    });
  }
  return { nodes, edges };
};

// --- compound: workflow plus contiguous-stage clusters ------------------

const genCompound = () => {
  const rand = mulberry32(1123);
  const { nodes, edges, stageNodes } = genWorkflow({
    seed: 1123,
    stages: 24,
    meanWidth: 32,
    skipShare: 0.05,
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  // group runs of 2-3 stages into top-level clusters, and within each,
  // group half of a stage's nodes into a nested child cluster
  let parentN = 0;
  for (let s = 0; s + 1 < stageNodes.length;) {
    const span = 2 + Math.floor(rand() * 2);
    const top = `p${parentN++}`;
    nodes.push({ id: top });
    for (let t = s; t < Math.min(s + span, stageNodes.length); t++) {
      const layer = stageNodes[t];
      const nested = `p${parentN++}`;
      nodes.push({ id: nested, parent: top });
      for (let i = 0; i < layer.length; i++) {
        byId.get(layer[i]).parent = i < layer.length / 2 ? nested : top;
      }
    }
    s += span;
  }
  return { nodes, edges };
};

write('deps', deriveDeps());
write(
  'workflow-1k',
  (() => {
    const { nodes, edges } = genWorkflow({
      seed: 112,
      stages: 25,
      meanWidth: 40,
      skipShare: 0.06,
    });
    return { nodes, edges };
  })(),
);
write(
  'workflow-10k',
  (() => {
    const { nodes, edges } = genWorkflow({
      seed: 113,
      stages: 80,
      meanWidth: 125,
      skipShare: 0.06,
    });
    return { nodes, edges };
  })(),
);
write('deep-skips', genDeepSkips());
write('compound', genCompound());
