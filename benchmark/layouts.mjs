// Layout sweep (round 33.1): v3 vs GPU/v4 for every built-in layout,
// plus the round-17 extension contract's own overhead.
//
// Before this round no layout had a benchmark at all.  The only numbers
// on record were the pass-1 grid figure (200k nodes 270 -> 24 ms, from
// one-off profiling of the perf-round-2 slot path) and the browser
// bench's --layout force-vs-cose mode, run once.  Every row here is
// re-runnable:
//
//   node --import tsx benchmark/layouts.mjs         # N=2000
//   BENCH_N=20000 node --import tsx benchmark/layouts.mjs
//   BENCH_N=500   node --import tsx benchmark/layouts.mjs   # + cose
//   BENCH_OP=grid node --import tsx benchmark/layouts.mjs
//
// Method notes, both load-bearing:
//
//  * **Both sides get an explicit `boundingBox`.**  A headless v3
//    viewport is 1x1 px, so a layout that sizes itself to the viewport
//    would lay 2000 nodes into a pixel and measure nothing recognisable.
//    The box is the same on both sides, so the packing maths runs over
//    the same area.
//  * **`fit: false` everywhere.**  Fitting is a viewport op with its own
//    row (33.5's bounds sweep); leaving it on would fold a whole-graph
//    bounds scan into every layout number and hide the layout itself.
//  * **v3 instances are `styleEnabled` with a preset layout** — the
//    scenarios.mjs configuration, and the realistic one: v3 layouts read
//    node dimensions, which are meaningless with style disabled.
//  * `grid` and `preset` take v4's slot path (no handles, one bulk
//    `setPositions`); `circle`/`concentric`/`breadthfirst`/`random` are
//    handle-level ports of v3's maths (round 10 A6).  The split between
//    those two groups of rows is itself the result worth reading.

import { bench, group, summary } from 'mitata';
import { finishRun } from './bench-run.mjs';
import { buildElements, makeV3, makeGpu, N } from './graph.mjs';

const OP = process.env.BENCH_OP;
const elements = buildElements();
const instances = [];

// the shared area both sides pack into (see the header)
const BOX = {
  x1: 0,
  y1: 0,
  w: 100 * Math.ceil(Math.sqrt(N)),
  h: 100 * Math.ceil(Math.sqrt(N)),
};

const V3_OPTS = { styleEnabled: true, layout: { name: 'preset' } };

function v3Instance() {
  const cy = makeV3(elements, V3_OPTS);

  instances.push(cy);

  return cy;
}

function gpuInstance() {
  const cy = makeGpu(elements);

  instances.push(cy);

  return cy;
}

/** A v3-comparative row: the same layout name run on both sides. */
function cmpLayout(name, options, label = name) {
  if (OP != null && !label.includes(OP)) {
    return;
  }

  const a = v3Instance();
  const b = gpuInstance();
  const opts = { fit: false, boundingBox: BOX, ...options };

  group(`layout: ${label}`, () => {
    summary(() => {
      // v3 discrete layouts run synchronously under animate: false
      bench('v3', () => {
        a.layout({ name, animate: false, ...opts }).run();
      });
      bench('gpu', () => {
        b.layout({ name, ...opts }).run();
      });
    });
  });
}

/** A gpu-only row: two v4 spellings of the same work. */
function cmpGpu(name, aLabel, aFn, bLabel, bFn) {
  if (OP != null && !name.includes(OP)) {
    return;
  }

  const a = gpuInstance();
  const b = gpuInstance();

  group(name, () => {
    summary(() => {
      bench(aLabel, () => {
        aFn(a);
      });
      bench(bLabel, () => {
        bFn(b);
      });
    });
  });
}

console.log(
  `\n== layout sweep (N=${N} nodes, ${2 * N} edges; box ${BOX.w}x${BOX.h}) ==`,
);

// -- the six built-ins -------------------------------------------------------
// `preset` needs a real `positions` map or the row measures nothing: with
// no positions v4's preset does no work at all (node positions are
// already in the model — see its module comment) while v3 still walks
// every node, which read as a 2388x "win" on the first version of this
// suite.  The map form is also the real use case (restoring saved
// positions) and it is the path with the interesting implementation: v4
// resolves ids straight to slots and bulk-writes, where v3 applies per
// element.  The function form takes handles by contract on both sides,
// so it gets its own row.
const savedPositions = {};

for (let i = 0; i < N; i++) {
  savedPositions['n' + i] = { x: (i % 100) * 25, y: Math.floor(i / 100) * 25 };
}

cmpLayout('grid');
cmpLayout('preset', { positions: savedPositions });
cmpLayout(
  'preset',
  { positions: (node) => savedPositions[node.id()] },
  'preset (fn form)',
);
cmpLayout('circle');
cmpLayout('concentric');
cmpLayout('breadthfirst');
cmpLayout('random');

// -- the radial tree layout (85.1) -------------------------------------------
// No v3 twin exists (v3 has no radial); the comparison partner is v4's
// own breadthfirst-circle — same rings, no wedges — pricing what the
// hierarchy-aware allocation costs.  The fixture is an unbalanced
// 2000-node tree (a 4-ary heavy subtree with 80% of the nodes against
// a light one with 20%), and the row asserts in-row the property it is
// named for: distinct radii == depth count, and the heavy subtree's
// angular span exceeds the light's — a run without the wedge weights
// fails here rather than mispricing quietly.
if (OP == null || 'radial'.includes(OP)) {
  const treeEls = [{ data: { id: 't0' } }];
  const addSubtree = (prefix, count) => {
    for (let k = 0; k < count; k++) {
      const id = prefix + k;
      const parent = k === 0 ? 't0' : prefix + Math.floor((k - 1) / 4);

      treeEls.push({ data: { id } });
      treeEls.push({ data: { id: 'e' + id, source: parent, target: id } });
    }
  };

  addSubtree('h', Math.floor(N * 0.8));
  addSubtree('l', Math.max(1, Math.floor(N * 0.2)));

  const radialCy = makeGpu(treeEls);
  const bfCy = makeGpu(treeEls);

  instances.push(radialCy, bfCy);

  const radialOpts = {
    name: 'radial',
    roots: ['t0'],
    // 0 keeps the heavy wedge from wrapping through the angle origin,
    // so the measured spans below are true wedge spans
    startAngle: 0,
    fit: false,
    boundingBox: BOX,
  };

  // the in-row assertion, once, outside the timed loop
  radialCy.layout(radialOpts).run();

  const center = { x: BOX.x1 + BOX.w / 2, y: BOX.y1 + BOX.h / 2 };
  const rings = new Set();
  let depthMax = 0;

  for (const prefix of ['h', 'l']) {
    // depth of node k in a 4-ary subtree, +1 for the root hop
    const countOf = prefix === 'h' ? Math.floor(N * 0.8) : Math.floor(N * 0.2);

    for (let k = 0; k < countOf; k++) {
      let d = 1;

      for (let at = k; at !== 0; at = Math.floor((at - 1) / 4)) {
        d++;
      }

      depthMax = Math.max(depthMax, d);
    }
  }

  const span = (prefix, count) => {
    let lo = Infinity;
    let hi = -Infinity;

    for (let k = 0; k < count; k++) {
      const p = radialCy.$id(prefix + k).position();
      const a =
        (Math.atan2(p.y - center.y, p.x - center.x) + 2 * Math.PI) %
        (2 * Math.PI);

      lo = Math.min(lo, a);
      hi = Math.max(hi, a);
      rings.add(Math.round(Math.hypot(p.x - center.x, p.y - center.y) * 8) / 8);
    }

    return hi - lo;
  };

  const heavySpan = span('h', Math.floor(N * 0.8));
  const lightSpan = span('l', Math.max(1, Math.floor(N * 0.2)));

  // + the root's own ring
  if (rings.size + 1 !== depthMax + 1) {
    throw new Error(
      `radial row: ${rings.size + 1} distinct radii for ${depthMax + 1} depths — ` +
        `the row would not be measuring the layout it is named for`,
    );
  }

  if (heavySpan <= lightSpan) {
    throw new Error(
      `radial row: heavy subtree span ${heavySpan.toFixed(2)} rad does not ` +
        `exceed the light's ${lightSpan.toFixed(2)} — the wedge weights are off`,
    );
  }

  console.log(
    `  radial fixture: ${depthMax + 1} depths == ${rings.size + 1} radii; ` +
      `heavy span ${heavySpan.toFixed(2)} rad vs light ${lightSpan.toFixed(2)}`,
  );

  group('layout: radial vs breadthfirst-circle (unbalanced tree)', () => {
    summary(() => {
      bench('radial', () => {
        radialCy.layout(radialOpts).run();
      });
      bench('breadthfirst circle', () => {
        bfCy
          .layout({
            name: 'breadthfirst',
            circle: true,
            directed: true,
            roots: ['t0'],
            fit: false,
            boundingBox: BOX,
          })
          .run();
      });
    });
  });
}

// -- the flow layout (112.2) -------------------------------------------------
// No v3 twin (v3 shipped no layered layout); the in-suite partner is
// breadthfirst — v4's pre-112 hierarchical answer — on one directed
// fixture.  The row asserts the property it is named for: flow's
// straight-line drawing has strictly fewer edge crossings than
// breadthfirst's on the same DAG (the whole point of the crossing-min
// phase), and its ranks form rows.  Quality vs dagre/elkjs lives in
// the layout-quality harness, not here — this row prices the runtime.
if (OP == null || 'flow'.includes(OP)) {
  // a layered DAG fixture: the wrap edges of the shared fixture create
  // cycles, so build a staged DAG of the same size instead
  const dagElements = [];
  const stageW = Math.ceil(Math.sqrt(N));

  for (let i = 0; i < N; i++) {
    dagElements.push({ data: { id: 'f' + i } });
  }

  for (let i = 0; i < N; i++) {
    const stage = Math.floor(i / stageW);

    if (stage > 0) {
      const prev = (stage - 1) * stageW + (i % stageW);

      dagElements.push({
        data: { id: 'fe' + i, source: 'f' + prev, target: 'f' + i },
      });

      const skew = (stage - 1) * stageW + ((i * 7) % stageW);

      dagElements.push({
        data: { id: 'fs' + i, source: 'f' + skew, target: 'f' + i },
      });
    }
  }

  const flowCy = makeGpu(dagElements);
  const bfCy = makeGpu(dagElements);

  instances.push(flowCy, bfCy);

  const flowOpts = { name: 'flow', fit: false };
  const bfOpts = {
    name: 'breadthfirst',
    directed: true,
    fit: false,
    boundingBox: BOX,
  };

  // -- the assertion, outside the timed loop --
  const crossingsOf = (cy) => {
    const segs = [];

    cy.edges().forEach((e) => {
      const s = e.source().position();
      const t = e.target().position();

      segs.push([s.x, s.y, t.x, t.y, e.source().id(), e.target().id()]);
    });

    const crosses = (a, b) => {
      if (a[4] === b[4] || a[4] === b[5] || a[5] === b[4] || a[5] === b[5]) {
        return false;
      }

      const o = (px, py, qx, qy, rx, ry) => {
        const v = (qx - px) * (ry - py) - (qy - py) * (rx - px);

        return v > 1e-9 ? 1 : v < -1e-9 ? -1 : 0;
      };
      const o1 = o(a[0], a[1], a[2], a[3], b[0], b[1]);
      const o2 = o(a[0], a[1], a[2], a[3], b[2], b[3]);
      const o3 = o(b[0], b[1], b[2], b[3], a[0], a[1]);
      const o4 = o(b[0], b[1], b[2], b[3], a[2], a[3]);

      return (
        o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0
      );
    };

    // sweep by x-interval so the count is exact but not O(m^2) pairs
    const order = segs
      .map((s, i) => ({
        lo: Math.min(s[0], s[2]),
        hi: Math.max(s[0], s[2]),
        i,
      }))
      .sort((p, q) => p.lo - q.lo);
    let count = 0;

    for (let i = 0; i < order.length; i++) {
      for (let j = i + 1; j < order.length && order[j].lo <= order[i].hi; j++) {
        if (crosses(segs[order[i].i], segs[order[j].i])) {
          count++;
        }
      }
    }

    return count;
  };

  flowCy.layout(flowOpts).run();
  bfCy.layout(bfOpts).run();

  const flowCross = crossingsOf(flowCy);
  const bfCross = crossingsOf(bfCy);
  const flowYs = new Set();

  flowCy.nodes().forEach((n) => {
    flowYs.add(Math.round(n.position().y * 8) / 8);
  });

  if (flowCross >= bfCross) {
    throw new Error(
      `flow row: ${flowCross} crossings does not beat breadthfirst's ${bfCross} — ` +
        `the row would not be measuring the layout it is named for`,
    );
  }

  if (flowYs.size > Math.ceil(N / stageW) + 1) {
    throw new Error(
      `flow row: ${flowYs.size} distinct rows for ~${Math.ceil(N / stageW)} stages — ` +
        `ranks are not forming rows`,
    );
  }

  console.log(
    `  flow fixture: ${flowCross} crossings vs breadthfirst's ${bfCross}; ` +
      `${flowYs.size} rank rows`,
  );

  group('layout: flow vs breadthfirst (staged DAG)', () => {
    summary(() => {
      bench('flow', () => {
        flowCy.layout(flowOpts).run();
      });
      bench('breadthfirst', () => {
        bfCy.layout(bfOpts).run();
      });
    });
  });
}

// -- the force layout --------------------------------------------------------
// The CPU executor is what the Node specs pin and what headless and
// compound graphs always run (18.1; model rebuilt in round 59 — the
// row now includes the one-time spectral seed, which dominates a
// capped-iteration run at small N); the GPU integrator is the browser
// bench's --layout mode.  A fixed iteration cap keeps the row a
// measurement of the integrator rather than of how fast this particular
// graph happens to converge.  `edgeLength` also takes the 85.3 score
// mapping ({ data, scale?, range?, invert? }) — same cost shape as the
// fn form (one resolve at start), so it carries no row of its own.
if (OP == null || 'force'.includes(OP)) {
  const force = gpuInstance();

  group('layout: force (CPU executor, 20 iterations)', () => {
    bench('gpu', () => {
      force
        .layout({
          name: 'force',
          animate: false,
          fit: false,
          iterations: 20,
          randomize: true,
          seed: 1,
        })
        .run();
    });
  });
}

// -- force constraints (85.2) ------------------------------------------------
// The projection's price, on the CPU executor both sides so the delta
// is the projection alone.  The row verifies constraints were active
// (in-row, outside the timed loop): the constrained settle's aligned
// spread reads < eps while the unconstrained twin's is large — a row
// whose constraint plumbing silently disengaged fails here rather
// than pricing nothing.
if (OP == null || 'constrained'.includes(OP)) {
  const constrainedCy = gpuInstance();
  const plainCy = gpuInstance();
  const alignment = { horizontal: [['n0', 'n50', 'n100', 'n150']] };
  const opts = {
    name: 'force',
    animate: false,
    fit: false,
    iterations: 20,
    randomize: true,
    seed: 1,
  };

  const spreadOf = (cy) => {
    const ys = alignment.horizontal[0].map((id) => cy.$id(id).position().y);

    return Math.max(...ys) - Math.min(...ys);
  };

  constrainedCy.layout({ ...opts, iterations: 400, alignment }).run();
  plainCy.layout({ ...opts, iterations: 400 }).run();

  const constrainedSpread = spreadOf(constrainedCy);
  const plainSpread = spreadOf(plainCy);

  if (constrainedSpread > 1e-3) {
    throw new Error(
      `constrained row: aligned spread ${constrainedSpread} — the ` +
        `constraints were not active, the row would price nothing`,
    );
  }

  if (plainSpread < 10) {
    throw new Error(
      `constrained row: the unconstrained twin's spread ${plainSpread} is ` +
        `too small to discriminate — the fixture is degenerate`,
    );
  }

  console.log(
    `  constrained fixture: aligned spread ${constrainedSpread.toFixed(4)} ` +
      `vs unconstrained ${plainSpread.toFixed(1)} — the delta below is the projection`,
  );

  group('layout: force constrained vs plain (CPU, 20 iterations)', () => {
    summary(() => {
      bench('constrained', () => {
        constrainedCy.layout({ ...opts, alignment }).run();
      });
      bench('plain', () => {
        plainCy.layout(opts).run();
      });
    });
  });
}

// The round-59 seed split, made re-runnable: 59.7 recorded "the one-time
// spectral seed (~12 ms warm at 2k) dominates the 20-iteration row" as a
// one-off decomposition, and a figure nobody can re-run is a record
// rather than a measurement (round 33's rule).  Same run either side;
// the only difference is what a fresh placement is, so the gap between
// the rows *is* the landmark-MDS seed.
if (OP == null || 'seed'.includes(OP)) {
  const a = gpuInstance();
  const b = gpuInstance();
  const opts = {
    name: 'force',
    animate: false,
    fit: false,
    iterations: 20,
    randomize: true,
    seed: 1,
  };

  group('layout: force seed — spectral vs scatter (20 iterations)', () => {
    summary(() => {
      bench('spectral (landmark MDS, the default)', () => {
        a.layout({ ...opts, init: 'spectral' }).run();
      });
      bench('scatter', () => {
        b.layout({ ...opts, init: 'scatter' }).run();
      });
    });
  });
}

// v3's cose is the classic baseline, and it is a different algorithm with
// a different quality target — the comparison is of the interactive
// experience, not of layout quality (the round-18.5 framing).  It is also
// superlinear: 4.5 s per iteration at 25k on the hardware-pass box, so
// this row gates hard on N and caps iterations on both sides.
if (N <= 500 && (OP == null || 'cose'.includes(OP))) {
  const a = v3Instance();
  const b = gpuInstance();

  group('layout: force vs cose (10 iterations)', () => {
    summary(() => {
      bench('v3', () => {
        a.layout({
          name: 'cose',
          animate: false,
          fit: false,
          numIter: 10,
          randomize: false,
        }).run();
      });
      bench('gpu', () => {
        b.layout({
          name: 'force',
          animate: false,
          fit: false,
          iterations: 10,
          randomize: true,
          seed: 1,
        }).run();
      });
    });
  });
}

// -- the plumbing ------------------------------------------------------------
// v3's layoutPositions finisher (spacingFactor / transform / fit / the
// lifecycle) against the bulk slot write underneath it — the overhead an
// extension author pays for the v3-shaped conveniences.  Both sides
// place identical positions.
const gridPos = (i) => ({ x: (i % 100) * 20, y: Math.floor(i / 100) * 20 });

class FinisherLayout {
  run(ctx) {
    let i = 0;

    ctx.layoutPositions(() => gridPos(i++));
  }
}

class BulkLayout {
  run(ctx) {
    const slots = ctx.nodeSlots();
    const xy = new Float64Array(slots.length * 2);

    for (let i = 0; i < slots.length; i++) {
      const p = gridPos(i);

      xy[i * 2] = p.x;
      xy[i * 2 + 1] = p.y;
    }

    ctx.setPositions(slots, xy);
  }
}

cmpGpu(
  'layout: plumbing (layoutPositions vs setPositions)',
  'finisher',
  (cy) => {
    cy.layout({ impl: FinisherLayout, fit: false }).run();
  },
  'bulk',
  (cy) => {
    cy.layout({ impl: BulkLayout, fit: false }).run();
  },
);

// The contract's own fixed cost — the number an external layout author
// needs, since it is what the wrapper charges before their code runs:
// construction, the LayoutContext, the three lifecycle emits and the
// promise plumbing.  Measured as an impl that does nothing, against the
// same wrapper doing a full bulk placement, so the row reads as
// "wrapper" and "wrapper + the work" and the delta is the placement.
//
// The first version of this row compared `{ impl: BulkLayout }` against
// the built-in grid and reported 4.5x — which was not a comparison at
// all: the two place different positions by different maths, so it
// measured BulkLayout's own body as much as the contract.  Design call 1,
// caught by design call 5.
// What that row found became round 34.4.  The wrapper's fixed cost used
// to scale with the *graph* rather than the run — 391 µs at 2000 nodes
// for an impl that does nothing — because `LayoutContext`'s
// constructor eagerly evaluated `cy.elements()` and `.nodes()`, interning
// handles for the whole graph even for the columnar-first layouts the
// contract exists to encourage.  Those two are lazy getters now, and
// `nodeSlots()`/`edgeSlots()` read the store's order list instead of
// walking handles: **333 µs → 795 ns** through the bundle.  The row
// stays as the thing that would notice it coming back.
class NoopLayout {
  run() {}
}

cmpGpu(
  'layout: contract fixed cost (empty impl vs bulk placement)',
  'wrapper only',
  (cy) => {
    cy.layout({ impl: NoopLayout, fit: false }).run();
  },
  'wrapper + bulk write',
  (cy) => {
    cy.layout({ impl: BulkLayout, fit: false }).run();
  },
);

// -- subset scopes -----------------------------------------------------------
// eles.layout() simulates the subset only (17.5); the row shows what a
// scope costs against the whole-graph run of the same layout.
if (OP == null || 'scope'.includes(OP)) {
  const a = v3Instance();
  const b = gpuInstance();
  const scopeA = a.nodes().slice(0, Math.max(1, Math.floor(N / 10)));
  const scopeB = b.nodes().slice(0, Math.max(1, Math.floor(N / 10)));

  group('layout: scope (eles.layout, 10% of nodes)', () => {
    summary(() => {
      bench('v3', () => {
        scopeA
          .layout({
            name: 'grid',
            animate: false,
            fit: false,
            boundingBox: BOX,
          })
          .run();
      });
      bench('gpu', () => {
        scopeB.layout({ name: 'grid', fit: false, boundingBox: BOX }).run();
      });
    });
  });
}

await finishRun('layouts');

// v3 styleEnabled instances leave live timers behind (the compound.mjs
// lesson), so the process would not exit on its own
for (const cy of instances) {
  cy.destroy();
}
