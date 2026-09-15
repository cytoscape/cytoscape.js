#!/usr/bin/env node
/*
Round 125: the layout audit's baseline — the numbers a sitting reads
before and after a change, for a layout on one of the debug page's
networks, headless, with the page's own sheet so the label boxes are
the page's label boxes.

  node benchmark/layout-audit.mjs --network reactome --layout flow
  node benchmark/layout-audit.mjs --network em-web --layout force \
      --opts '{"avoidOverlap":true,"nodeDimensionsIncludeLabels":true}'
  node benchmark/layout-audit.mjs --network reactome --layout flow --labels --json out.json

One row per call:

- overlaps      pairs of node boxes (bodies, or labels under --labels)
                that intersect — the failure the quality suite guards
- crossings     straight-line edge crossings, endpoint-sharing pairs
                excluded, binned on a grid (112.1's counter, reduced to
                straight lines)
- area          bounding box over node boxes, Mpx²
- fill          the boxes' summed area over the bounding box (114.8's
                measure: 1 is a tiling)
- gap           the nearest-box gap per node, median / p90 in px and
                the median in node sizes (debug/airiness.js — the
                "too airy" column the first sitting asked for)
- edge gap      the gap between endpoint boxes per edge, median / p90 /
                max — a node far from its only neighbour is the max
- parent gap    for a directed graph, per node the *smallest* gap over
                its incoming edges: how far a node sits from its
                nearest DAG parent — median / p90 / max, and the id of
                the max (the IRAK1 column)
- stable        whether a second run reproduces the first's positions
- ms            the layout's wall time, median of --repeat runs

The sheet is the page's production sheet for the network (debug/
styles.js), the elements the page's (debug/fixtures.js), so a number
here is a number the page shows.  The page's checkboxes spell
`avoidOverlap` and `nodeDimensionsIncludeLabels` explicitly on every
run; --opts is merged over `{ name, fit: false }` and nothing else, so
a row at defaults is the library's defaults, not the page's.
*/
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, '..');
const DEBUG = join(ROOT, 'debug');

// -- the page's modules, loaded as the module suite loads them --

const loadGlobal = (name) => {
  const src = readFileSync(join(DEBUG, `${name}.js`), 'utf8');
  const ctx = createContext({ module: { exports: {} }, console, TextDecoder });

  runInContext(src, ctx);

  return ctx.module.exports;
};

const networks = loadGlobal('networks');
const fixtures = loadGlobal('fixtures');
const styles = loadGlobal('styles');
const airiness = loadGlobal('airiness');

// -- arguments --

const args = process.argv.slice(2);
const flag = (name, def = null) => {
  const i = args.indexOf(`--${name}`);

  return i >= 0 ? (args[i + 1] ?? true) : def;
};
const has = (name) => args.includes(`--${name}`);

const networkId = flag('network', 'reactome');
// --elements <file>: a plain elements JSON ({ nodes, edges } or an
// array) with a 30 px sheet, for the synthetic fixtures the suites use
const elementsFile = flag('elements');
const layoutName = flag('layout', 'grid');
const opts = JSON.parse(flag('opts', '{}'));
const labels = has('labels');
const repeat = Number(flag('repeat', 1));
const jsonOut = flag('json');
const gen = flag('gen', '400x800');
const width = Number(flag('width', 1400));
const height = Number(flag('height', 1000));

const def = elementsFile != null ? { desc: elementsFile } : networks[networkId];

if (def == null) {
  console.error(
    `unknown network '${networkId}'; one of ${Object.keys(networks).join(', ')}`,
  );
  process.exit(1);
}

// -- the elements and the sheet, as the page builds them --

const elementsFor = () => {
  if (def.generated) {
    return fixtures.derive(def.derive, fixtures.generate(def.generated, gen));
  }

  const json = JSON.parse(readFileSync(resolve(DEBUG, def.url), 'utf8'));

  return fixtures.derive(def.derive, fixtures.toGpuElements(json.elements));
};

const { default: cytoscape } = await import('../src/index.mjs');

const mk = () => {
  if (elementsFile != null) {
    const raw = JSON.parse(readFileSync(elementsFile, 'utf8'));

    return cytoscape({
      headless: true,
      headlessWidth: width,
      headlessHeight: height,
      elements: raw,
      style: { nodes: { width: 30, height: 30, label: { data: 'label' } } },
    });
  }

  const gpuElements = elementsFor();
  const sheet = styles.sheet('production', networkId, gpuElements, def);

  return cytoscape({
    headless: true,
    headlessWidth: width,
    headlessHeight: height,
    elements: { nodes: gpuElements.nodes, edges: gpuElements.edges },
    style: sheet,
  });
};

// -- the metrics --

const boxOf = (n) => n.boundingBox({ includeLabels: labels });

const overlaps = (a, b) =>
  a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;

/** strictly overlapping box pairs, through a grid of median-size cells */
const countOverlaps = (boxes) => {
  let n = 0;
  const cell = Math.max(
    1,
    airiness.summary(boxes.map((b) => Math.max(b.x2 - b.x1, b.y2 - b.y1)))
      .median,
  );
  const grid = new Map();
  const key = (x, y) => `${x},${y}`;

  boxes.forEach((b, i) => {
    for (let x = Math.floor(b.x1 / cell); x <= Math.floor(b.x2 / cell); x++) {
      for (let y = Math.floor(b.y1 / cell); y <= Math.floor(b.y2 / cell); y++) {
        const k = key(x, y);

        if (!grid.has(k)) {
          grid.set(k, []);
        }

        grid.get(k).push(i);
      }
    }
  });

  const seen = new Set();

  for (const members of grid.values()) {
    for (let a = 0; a < members.length; a++) {
      for (let b = a + 1; b < members.length; b++) {
        const i = Math.min(members[a], members[b]);
        const j = Math.max(members[a], members[b]);
        const k = i * boxes.length + j;

        if (seen.has(k)) {
          continue;
        }

        seen.add(k);

        if (overlaps(boxes[i], boxes[j])) {
          n++;
        }
      }
    }
  }

  return n;
};

const segCross = (ax, ay, bx, by, cx, cy, dx, dy) => {
  const o = (px, py, qx, qy, rx, ry) => {
    const v = (qx - px) * (ry - py) - (qy - py) * (rx - px);

    return v > 1e-9 ? 1 : v < -1e-9 ? -1 : 0;
  };
  const o1 = o(ax, ay, bx, by, cx, cy);
  const o2 = o(ax, ay, bx, by, dx, dy);
  const o3 = o(cx, cy, dx, dy, ax, ay);
  const o4 = o(cx, cy, dx, dy, bx, by);

  return o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0;
};

/** straight-line crossings, grid-binned; pairs sharing a node excluded */
const countCrossings = (segs) => {
  if (segs.length === 0) {
    return 0;
  }

  let sum = 0;

  for (const s of segs) {
    sum += Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
  }

  const cell = Math.max(1, sum / segs.length);
  const grid = new Map();

  segs.forEach((s, i) => {
    const x0 = Math.floor(Math.min(s.x1, s.x2) / cell);
    const x1 = Math.floor(Math.max(s.x1, s.x2) / cell);
    const y0 = Math.floor(Math.min(s.y1, s.y2) / cell);
    const y1 = Math.floor(Math.max(s.y1, s.y2) / cell);

    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const k = `${x},${y}`;

        if (!grid.has(k)) {
          grid.set(k, []);
        }

        grid.get(k).push(i);
      }
    }
  });

  const seen = new Set();
  let n = 0;

  for (const members of grid.values()) {
    for (let a = 0; a < members.length; a++) {
      for (let b = a + 1; b < members.length; b++) {
        const i = Math.min(members[a], members[b]);
        const j = Math.max(members[a], members[b]);
        const k = i * segs.length + j;

        if (seen.has(k)) {
          continue;
        }

        seen.add(k);

        const p = segs[i];
        const q = segs[j];

        if (p.s === q.s || p.s === q.t || p.t === q.s || p.t === q.t) {
          continue;
        }

        if (segCross(p.x1, p.y1, p.x2, p.y2, q.x1, q.y1, q.x2, q.y2)) {
          n++;
        }
      }
    }
  }

  return n;
};

const measure = (cy) => {
  const nodes = cy.nodes().filter((n) => !n.isParent());
  const boxes = nodes.map(boxOf);
  const index = new Map(nodes.map((n, i) => [n.id(), i]));
  const a = airiness.airiness(cy, { labels });

  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  let boxArea = 0;

  for (const b of boxes) {
    x1 = Math.min(x1, b.x1);
    y1 = Math.min(y1, b.y1);
    x2 = Math.max(x2, b.x2);
    y2 = Math.max(y2, b.y2);
    boxArea += (b.x2 - b.x1) * (b.y2 - b.y1);
  }

  const area = (x2 - x1) * (y2 - y1);
  const segs = [];
  const parentGap = new Map();

  cy.edges().forEach((e) => {
    const s = index.get(e.source().id());
    const t = index.get(e.target().id());

    if (s == null || t == null || s === t) {
      return;
    }

    const ps = nodes[s].position();
    const pt = nodes[t].position();

    segs.push({ s, t, x1: ps.x, y1: ps.y, x2: pt.x, y2: pt.y });

    const gap = airiness.boxGap(boxes[s], boxes[t]);
    const id = nodes[t].id();

    parentGap.set(id, Math.min(parentGap.get(id) ?? Infinity, gap));
  });

  let worst = { id: null, gap: -Infinity };

  for (const [id, gap] of parentGap) {
    if (gap > worst.gap) {
      worst = { id, gap };
    }
  }

  return {
    nodes: nodes.length,
    edges: segs.length,
    overlaps: countOverlaps(boxes),
    crossings: countCrossings(segs),
    area: area / 1e6,
    aspect: (x2 - x1) / Math.max(1, y2 - y1),
    fill: boxArea / Math.max(1, area),
    size: a.size,
    gap: a.nodeGap,
    ratio: a.ratio,
    edgeGap: a.edgeGap,
    parentGap: {
      ...airiness.summary([...parentGap.values()]),
      worst: worst.id,
    },
  };
};

const runLayout = async (cy) => {
  const layout = cy.layout({ name: layoutName, fit: false, ...opts });
  const stopped = cy.promiseOn('layoutstop');
  const t0 = performance.now();

  layout.run();
  await (typeof layout.promise === 'function' ? layout.promise() : stopped);

  return performance.now() - t0;
};

const snapshot = (cy) =>
  cy
    .nodes()
    .map((n) => [n.id(), n.position().x, n.position().y])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));

const same = (a, b) =>
  a.length === b.length &&
  a.every(
    (r, i) =>
      r[0] === b[i][0] &&
      Math.abs(r[1] - b[i][1]) < 1e-6 &&
      Math.abs(r[2] - b[i][2]) < 1e-6,
  );

// -- run --

const times = [];
let first = null;
let stable = true;
let metrics = null;

for (let i = 0; i < Math.max(1, repeat) + 1; i++) {
  const cy = mk();

  times.push(await runLayout(cy));

  const snap = snapshot(cy);

  if (first == null) {
    first = snap;
    metrics = measure(cy);
  } else if (!same(first, snap)) {
    stable = false;
  }

  cy.destroy();
}

times.sort((a, b) => a - b);

const row = {
  network: elementsFile ?? networkId,
  layout: layoutName,
  opts,
  labels,
  ms: times[Math.floor(times.length / 2)],
  stable,
  ...metrics,
};

const px = (v) => (Number.isFinite(v) ? v.toFixed(0) : '—');
const line =
  `${row.network} ${layoutName} ${JSON.stringify(opts)}${labels ? ' [labels]' : ''}\n` +
  `  n ${row.nodes} e ${row.edges}  ${row.ms.toFixed(0)} ms  stable ${stable}\n` +
  `  overlaps ${row.overlaps}  crossings ${row.crossings}  area ${row.area.toFixed(2)} Mpx² (aspect ${row.aspect.toFixed(1)})  fill ${row.fill.toFixed(3)}\n` +
  `  gap median ${px(row.gap.median)} p90 ${px(row.gap.p90)} (${row.ratio.toFixed(2)}× size ${px(row.size)})\n` +
  `  edge gap median ${px(row.edgeGap.median)} p90 ${px(row.edgeGap.p90)} max ${px(row.edgeGap.max)}\n` +
  `  parent gap median ${px(row.parentGap.median)} p90 ${px(row.parentGap.p90)} max ${px(row.parentGap.max)} (${row.parentGap.worst})`;

console.log(line);

if (jsonOut != null) {
  const rows = existsSync(jsonOut)
    ? JSON.parse(readFileSync(jsonOut, 'utf8'))
    : [];

  rows.push(row);
  writeFileSync(jsonOut, JSON.stringify(rows, null, 2) + '\n');
}
