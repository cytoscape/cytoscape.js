#!/usr/bin/env node
/*
Round 112.1: the layout-quality harness — "comparable to dagre" as a
measured bar (PLAN.md item 49's required first measurement).

  npm run benchmark:layout-quality              all engines, all fixtures
  node benchmark/layout-quality.mjs --fixture deps --engine dagre
  node benchmark/layout-quality.mjs --json out.json

For each engine x fixture it reports:

- crossings   exact polyline-edge crossing count over the geometry the
              engine actually emits (bend points included — routing
              quality is part of the product), pairs sharing an
              endpoint node excluded
- len mean/cv edge polyline length mean and coefficient of variation
- area        bounding box over node boxes, Mpx^2
- overlaps    node-body pairwise overlaps (a placement *validity*
              check: a layered engine should read 0 on flat fixtures)
- time        median of 3 timed runs after 1 warmup, ms

How the rows avoid measuring nothing: the crossing counter self-tests
on hand-countable fixtures before any engine runs (an X counts 1, a
parallel pair counts 0, a shared-endpoint fan counts 0); every engine
result must move at least one node off the origin and place every
node, or the row aborts loudly.  Engines run through the same adapter
interface (`{ pos: Map<id,{x,y}>, poly: Map<edgeId, [x,y,...]> }`), so
the v4 flow layout joins as a third adapter in round 112.2 without
touching the metrics.

Each (fixture, engine) cell runs in a child process under a timeout
(`--timeout <s>`, default 300 — the maintainer's cap: no interactive
use case waits five minutes for a layout), because the first full sweep
found the baseline the hard way: dagre does not finish the 846-node
nested-cluster fixture at all (its cluster machinery has known hang
defects) and ran the 10k workflow fixture past 20 CPU-minutes before
being killed.  A hung engine is a *recorded* `timeout` row, not a
stalled sweep.

The reference engines are devDependencies; `src/` never imports them
(`test/modules/import-graph.mjs` guards that boundary).
*/
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import dagre from '@dagrejs/dagre';
import ELK from 'elkjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(DIR, 'fixtures', 'dag');

// ---------------------------------------------------------------- metrics

/** Proper segment intersection (shared coordinates do not count). */
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

/**
 * Exact crossing count over polylines, endpoint-sharing edge pairs
 * excluded, binned on a uniform grid so 20k-edge fixtures stay
 * tractable (candidate pairs come only from co-located cells).
 */
const countCrossings = (fixture, result) => {
  const ends = new Map(fixture.edges.map((e) => [e.id, [e.source, e.target]]));
  // flatten polylines to segments
  const segs = []; // [x1,y1,x2,y2, edgeIdx]
  const edgeIds = [];
  for (const e of fixture.edges) {
    const pts = result.poly.get(e.id);
    const idx = edgeIds.push(e.id) - 1;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      segs.push([pts[i], pts[i + 1], pts[i + 2], pts[i + 3], idx]);
    }
  }
  // grid bin by segment bbox
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    totalLen = 0;
  for (const [x1, y1, x2, y2] of segs) {
    minX = Math.min(minX, x1, x2);
    maxX = Math.max(maxX, x1, x2);
    minY = Math.min(minY, y1, y2);
    maxY = Math.max(maxY, y1, y2);
    totalLen += Math.hypot(x2 - x1, y2 - y1);
  }
  const cell = Math.max(1, totalLen / segs.length);
  const cols = Math.max(1, Math.min(2048, Math.ceil((maxX - minX) / cell)));
  const rows = Math.max(1, Math.min(2048, Math.ceil((maxY - minY) / cell)));
  const cw = (maxX - minX) / cols || 1;
  const ch = (maxY - minY) / rows || 1;
  const bins = new Map();
  segs.forEach((s, si) => {
    const c1 = Math.min(
      cols - 1,
      Math.max(0, Math.floor((Math.min(s[0], s[2]) - minX) / cw)),
    );
    const c2 = Math.min(
      cols - 1,
      Math.max(0, Math.floor((Math.max(s[0], s[2]) - minX) / cw)),
    );
    const r1 = Math.min(
      rows - 1,
      Math.max(0, Math.floor((Math.min(s[1], s[3]) - minY) / ch)),
    );
    const r2 = Math.min(
      rows - 1,
      Math.max(0, Math.floor((Math.max(s[1], s[3]) - minY) / ch)),
    );
    for (let c = c1; c <= c2; c++) {
      for (let r = r1; r <= r2; r++) {
        const key = r * cols + c;
        let list = bins.get(key);
        if (!list) bins.set(key, (list = []));
        list.push(si);
      }
    }
  });
  const seen = new Set();
  let crossings = 0;
  for (const list of bins.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = segs[list[i]],
          b = segs[list[j]];
        if (a[4] === b[4]) continue; // same edge
        const key =
          a[4] < b[4]
            ? list[i] * segs.length + list[j]
            : list[j] * segs.length + list[i];
        if (seen.has(key)) continue;
        seen.add(key);
        const [sa, ta] = ends.get(edgeIds[a[4]]);
        const [sb, tb] = ends.get(edgeIds[b[4]]);
        if (sa === sb || sa === tb || ta === sb || ta === tb) continue;
        if (segCross(a[0], a[1], a[2], a[3], b[0], b[1], b[2], b[3])) {
          crossings++;
        }
      }
    }
  }
  return crossings;
};

const edgeLengthStats = (fixture, result) => {
  let sum = 0,
    sumSq = 0,
    n = 0;
  for (const e of fixture.edges) {
    const pts = result.poly.get(e.id);
    let len = 0;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      len += Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]);
    }
    sum += len;
    sumSq += len * len;
    n++;
  }
  const mean = sum / n;
  const cv = Math.sqrt(Math.max(0, sumSq / n - mean * mean)) / (mean || 1);
  return { mean, cv };
};

const areaOf = (fixture, result) => {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const nd of fixture.nodes) {
    if (nd.w == null) continue; // compound parents derive; skip
    const p = result.pos.get(nd.id);
    minX = Math.min(minX, p.x - nd.w / 2);
    maxX = Math.max(maxX, p.x + nd.w / 2);
    minY = Math.min(minY, p.y - nd.h / 2);
    maxY = Math.max(maxY, p.y + nd.h / 2);
  }
  return (maxX - minX) * (maxY - minY);
};

const countOverlaps = (fixture, result) => {
  const leaves = fixture.nodes.filter((n) => n.w != null);
  const items = leaves
    .map((n) => ({ ...result.pos.get(n.id), w: n.w, h: n.h }))
    .sort((a, b) => a.x - b.x);
  let overlaps = 0;
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      if (b.x - b.w / 2 >= a.x + a.w / 2) break;
      if (
        Math.abs(a.x - b.x) * 2 < a.w + b.w - 0.5 &&
        Math.abs(a.y - b.y) * 2 < a.h + b.h - 0.5
      ) {
        overlaps++;
      }
    }
  }
  return overlaps;
};

// --------------------------------------------------------------- adapters

const dagreAdapter = {
  name: 'dagre',
  async layout(fixture) {
    const g = new dagre.graphlib.Graph({ compound: true, multigraph: true });
    g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 60 });
    g.setDefaultEdgeLabel(() => ({}));
    for (const n of fixture.nodes) {
      g.setNode(n.id, n.w != null ? { width: n.w, height: n.h } : {});
    }
    for (const n of fixture.nodes) {
      if (n.parent != null) g.setParent(n.id, n.parent);
    }
    for (const e of fixture.edges) {
      g.setEdge(e.source, e.target, {}, e.id);
    }
    dagre.layout(g);
    const pos = new Map();
    for (const n of fixture.nodes) {
      const nd = g.node(n.id);
      pos.set(n.id, { x: nd.x, y: nd.y });
    }
    const poly = new Map();
    for (const e of fixture.edges) {
      const pts = g.edge(e.source, e.target, e.id).points;
      poly.set(
        e.id,
        pts.flatMap((p) => [p.x, p.y]),
      );
    }
    return { pos, poly };
  },
};

const elkAdapter = {
  name: 'elk',
  async layout(fixture) {
    const elk = new ELK();
    const childrenOf = new Map();
    for (const n of fixture.nodes) {
      const key = n.parent ?? null;
      if (!childrenOf.has(key)) childrenOf.set(key, []);
      childrenOf.get(key).push(n);
    }
    const toElk = (n) => ({
      id: n.id,
      ...(n.w != null ? { width: n.w, height: n.h } : {}),
      children: (childrenOf.get(n.id) ?? []).map(toElk),
    });
    const graph = {
      id: '(elk-root)',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.spacing.nodeNode': '50',
        'elk.layered.spacing.nodeNodeBetweenLayers': '60',
        // one layout run over the whole nesting so cross-hierarchy edges
        // get sections at all (the recursive default leaves them unrouted)
        'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      },
      children: (childrenOf.get(null) ?? []).map(toElk),
      edges: fixture.edges.map((e) => ({
        id: e.id,
        sources: [e.source],
        targets: [e.target],
      })),
    };
    const out = await elk.layout(graph);
    // elk positions are relative to the containing node; accumulate
    const pos = new Map();
    const sizes = new Map();
    const walk = (node, ox, oy) => {
      for (const c of node.children ?? []) {
        pos.set(c.id, {
          x: ox + c.x + c.width / 2,
          y: oy + c.y + c.height / 2,
        });
        sizes.set(c.id, { ox: ox + c.x, oy: oy + c.y });
        walk(c, ox + c.x, oy + c.y);
      }
    };
    walk(out, 0, 0);
    // edge sections are relative to the edge's containing node
    const containerOffset = (edge) => {
      const c = edge.container;
      if (c == null || c === '(elk-root)') return { ox: 0, oy: 0 };
      return sizes.get(c) ?? { ox: 0, oy: 0 };
    };
    const poly = new Map();
    for (const e of out.edges ?? []) {
      const { ox, oy } = containerOffset(e);
      const s = e.sections[0];
      const pts = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint];
      poly.set(
        e.id,
        pts.flatMap((p) => [ox + p.x, oy + p.y]),
      );
    }
    return { pos, poly };
  },
};

const ENGINES = [dagreAdapter, elkAdapter];

// ------------------------------------------------------------ self-tests

const selfTest = () => {
  const fx = (nodes, edges) => ({
    nodes: nodes.map((id) => ({ id, w: 10, h: 10 })),
    edges,
  });
  const res = (poly) => ({ poly: new Map(Object.entries(poly)) });
  // an X crosses once
  let n = countCrossings(
    fx(
      ['a', 'b', 'c', 'd'],
      [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'c', target: 'd' },
      ],
    ),
    res({ e1: [0, 0, 10, 10], e2: [0, 10, 10, 0] }),
  );
  if (n !== 1)
    throw new Error(`self-test: X should count 1 crossing, got ${n}`);
  // parallels cross zero times
  n = countCrossings(
    fx(
      ['a', 'b', 'c', 'd'],
      [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'c', target: 'd' },
      ],
    ),
    res({ e1: [0, 0, 10, 0], e2: [0, 5, 10, 5] }),
  );
  if (n !== 0) throw new Error(`self-test: parallels should count 0, got ${n}`);
  // a shared-endpoint fan counts zero even though the segments touch
  n = countCrossings(
    fx(
      ['a', 'b', 'c'],
      [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'a', target: 'c' },
      ],
    ),
    res({ e1: [0, 0, 10, 10], e2: [0, 0, 10, -10] }),
  );
  if (n !== 0)
    throw new Error(`self-test: shared-endpoint fan should count 0, got ${n}`);
  // polyline bends participate: an S-route crosses the vertical twice,
  // where the same edge drawn straight (x=0 to x=0) would cross zero
  n = countCrossings(
    fx(
      ['a', 'b', 'c', 'd'],
      [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'c', target: 'd' },
      ],
    ),
    res({ e1: [0, 0, 20, 0, 20, 10, 0, 10], e2: [10, -10, 10, 30] }),
  );
  if (n !== 2) throw new Error(`self-test: S-route should count 2, got ${n}`);
};

// ---------------------------------------------------------------- runner

const validate = (fixture, result, engine) => {
  let moved = false;
  for (const n of fixture.nodes) {
    const p = result.pos.get(n.id);
    if (p == null || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      throw new Error(`${engine}: node ${n.id} not placed`);
    }
    if (p.x !== 0 || p.y !== 0) moved = true;
  }
  for (const e of fixture.edges) {
    const pts = result.poly.get(e.id);
    if (pts == null || pts.length < 4) {
      throw new Error(`${engine}: edge ${e.id} has no geometry`);
    }
  }
  if (!moved)
    throw new Error(`${engine}: every node at the origin — layout did not run`);
};

const runCell = async (name, engine) => {
  const fixture = JSON.parse(
    readFileSync(join(FIXTURE_DIR, `${name}.json`), 'utf8'),
  );
  await engine.layout(fixture); // warmup
  const times = [];
  let result;
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    result = await engine.layout(fixture);
    times.push(performance.now() - t0);
  }
  validate(fixture, result, engine.name);
  times.sort((a, b) => a - b);
  const { mean, cv } = edgeLengthStats(fixture, result);
  return {
    fixture: name,
    engine: engine.name,
    status: 'ok',
    nodes: fixture.nodes.length,
    edges: fixture.edges.length,
    crossings: countCrossings(fixture, result),
    lenMean: Math.round(mean),
    lenCv: +cv.toFixed(3),
    areaMpx2: +(areaOf(fixture, result) / 1e6).toFixed(2),
    overlaps: countOverlaps(fixture, result),
    timeMs: +times[1].toFixed(1),
  };
};

const printRow = (row) => {
  if (row.status !== 'ok') {
    console.log(
      `${row.fixture.padEnd(14)} ${row.engine.padEnd(6)} ${row.status.toUpperCase()}`,
    );
    return;
  }
  console.log(
    `${row.fixture.padEnd(14)} ${row.engine.padEnd(6)}` +
      ` n=${String(row.nodes).padEnd(6)} m=${String(row.edges).padEnd(6)}` +
      ` cross=${String(row.crossings).padEnd(7)} len=${String(row.lenMean).padEnd(5)}` +
      ` cv=${String(row.lenCv).padEnd(6)} area=${String(row.areaMpx2).padEnd(9)}` +
      ` overlap=${String(row.overlaps).padEnd(4)} t=${row.timeMs}ms`,
  );
};

const run = async () => {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : null;
  };

  // child mode: one cell, one JSON line on stdout's last line
  const cell = args.indexOf('--cell');
  if (cell >= 0) {
    const engine = ENGINES.find((e) => e.name === args[cell + 2]);
    console.log(JSON.stringify(await runCell(args[cell + 1], engine)));
    return;
  }

  selfTest();
  const fixtureFilter = opt('fixture');
  const engineFilter = opt('engine');
  const jsonPath = opt('json');
  const timeoutMs = (Number(opt('timeout')) || 300) * 1000;

  const fixtures = readdirSync(FIXTURE_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => basename(f, '.json'))
    .filter((f) => (fixtureFilter ? f.includes(fixtureFilter) : true));
  const engines = ENGINES.filter((e) =>
    engineFilter ? e.name.includes(engineFilter) : true,
  );

  const self = fileURLToPath(import.meta.url);
  const rows = [];
  for (const name of fixtures) {
    for (const engine of engines) {
      // --stack-size: both reference engines recurse past the default V8
      // stack near 10k nodes; the bump is an accommodation, not a fix,
      // and it is part of the recorded baseline conditions
      const res = spawnSync(
        process.execPath,
        ['--stack-size=8192', self, '--cell', name, engine.name],
        { timeout: timeoutMs, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
      );
      let row;
      if (res.status === 0 && res.stdout.trim()) {
        row = JSON.parse(res.stdout.trim().split('\n').at(-1));
      } else {
        const timedOut =
          res.error?.code === 'ETIMEDOUT' || res.signal === 'SIGTERM';
        row = {
          fixture: name,
          engine: engine.name,
          status: timedOut ? `timeout(${timeoutMs / 1000}s)` : 'error',
          ...(timedOut
            ? {}
            : {
                detail:
                  (res.stderr ?? '')
                    .split('\n')
                    .find((l) => /\bError\b/.test(l))
                    ?.trim() ?? (res.stderr ?? '').trim().split('\n').at(-1),
              }),
        };
      }
      rows.push(row);
      printRow(row);
    }
  }

  if (jsonPath) {
    mkdirSync(dirname(resolve(jsonPath)), { recursive: true });
    writeFileSync(
      jsonPath,
      JSON.stringify({ date: new Date().toISOString(), rows }, null, 2),
    );
    console.log(`written: ${jsonPath}`);
  }
};

await run();
