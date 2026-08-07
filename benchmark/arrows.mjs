/*
Round 55: what arrowheads cost the CPU — pure Node, no GPU.

Nothing priced arrows before this.  `benchmark/curves.mjs` measures the
curve premium on an arrow-free graph, and the renderer bench had no arrow
scene at all, so round 55 — which ports v3's arrow `gap`/`spacing` and
therefore touches the edge style write, the endpoint accessors and the
edge column layout — had no baseline to move against.  This suite is that
baseline.

Every row reports the **arrow premium**: the same operation on a graph
whose edges carry a source and target head, against the identical graph
with `arrow-shape: none`.  That structure is also the suite's own
discrimination control, in the sense AGENTS.md asks for — the "feature
off" side is not a variant that has to be remembered, it is one of the two
numbers every row prints.  A row whose two sides read the same is a row
that cannot see this round's work, and two of them are here deliberately
(bounds and box selection) precisely because they *should* not move: they
are the controls that say the premium rows are measuring arrows rather
than ambient noise.

The row that matters most for round 55 is `cy.style(...)` re-apply.  v4
resolves arrow shape, scale, fill and colour per edge on the style write,
and that is where a CPU-computed line trim would land if the in-shader
derivation is ever swapped out for the logged alternative (PLAN.md, round
55's carrier note).  If that row does not move when the trim work changes,
the trim is free on the CPU, which is the claim this suite exists to
check.

  node --import tsx benchmark/arrows.mjs               # 20k nodes
  BENCH_N=100000 node --import tsx benchmark/arrows.mjs
*/

import cytoscape from '../src/index.mjs';
import { columnSpecsForGroup } from '../src/contract.mjs';
import { finishManualRun } from './bench-run.mjs';

const N = Number(process.env.BENCH_N ?? 20000);
const PAIRS = Math.floor(N / 2);
// Arrows are a per-edge property, so the graph is deliberately
// edge-heavy: at one edge per pair the style-write row read 0.97x
// (arrowed *faster* than arrow-free), because two thirds of the elements
// written were nodes and the edge work could not be seen past them.
const PER_PAIR = 4;
const EDGES = PAIRS * PER_PAIR;
// Every timed row does at least this much work.  The first draft sized
// the accessor rows by the graph, which put them under a millisecond at
// the default N — where the arrowed and arrow-free sides differed by
// more than the thing being measured.
const WORK = 200000;

/** One measurement, reported per unit of work. */
const time = (fn) => {
  const t0 = performance.now();

  fn();

  return performance.now() - t0;
};

const rows = [];

/**
 * Run `fn` on the arrowed graph and on the arrow-free graph of the same
 * shape, and record the ratio.
 *
 * Two guards, both of which this suite needed.  Each side runs once
 * unmeasured first, for curves.mjs's reason: whichever ran first would
 * otherwise pay the module's JIT warmup and read slower for no reason of
 * its own.  Then each side is timed **twice, in the order A B B A**, and
 * the faster of its two readings is kept — because the single-pass form
 * put a whole-millisecond order bias on every row.  Measured on the first
 * draft: the drag row read 1.21x and the build row 1.19x with the arrowed
 * side timed first, on operations that touch no arrow data at all.  Under
 * A B B A both settle at parity, which is the true answer.  Keep the
 * palindrome if you edit this: A B A B would preserve the bias.
 */
const compare = (label, unit, count, fn) => {
  fn(arrowed);
  fn(plain);

  const a1 = time(() => fn(arrowed));
  const p1 = time(() => fn(plain));
  const p2 = time(() => fn(plain));
  const a2 = time(() => fn(arrowed));

  const arrowedMs = Math.min(a1, a2);
  const plainMs = Math.min(p1, p2);
  const ratio = plainMs === 0 ? Infinity : arrowedMs / plainMs;

  rows.push({ label, unit, count, arrowedMs, plainMs, ratio });

  console.log(
    `${label.padEnd(40)} arrowed ${arrowedMs.toFixed(1).padStart(8)} ms  ` +
      `none ${plainMs.toFixed(1).padStart(8)} ms  ` +
      `${ratio.toFixed(2)}x  (${((arrowedMs * 1e6) / count).toFixed(0)} ns/${unit})`,
  );
};

/** PAIRS node pairs, PER_PAIR edges each.  The edges are straight, so
 * the parallelism costs no bundle derivation — v4 fans bezier bundles
 * only — and buys an edge-dominated graph, which is what a per-edge
 * property has to be measured on. */
const elements = () => {
  const eles = [];

  for (let i = 0; i < PAIRS; i++) {
    eles.push({
      data: { id: `a${i}` },
      position: { x: (i % 200) * 60, y: Math.floor(i / 200) * 60 },
    });
    eles.push({
      data: { id: `b${i}` },
      position: { x: (i % 200) * 60 + 40, y: Math.floor(i / 200) * 60 },
    });

    for (let k = 0; k < PER_PAIR; k++) {
      eles.push({
        data: { id: `e${i}_${k}`, source: `a${i}`, target: `b${i}` },
      });
    }
  }

  return eles;
};

/** The edge id at a flat index, for the accessor rows. */
const edgeId = (i) => `e${i % PAIRS}_${i % PER_PAIR}`;

/** The two edge sheets.  Everything but the four arrow props is shared,
 * so the delta between the sides is the arrow work and nothing else. */
const edgeStyle = (arrows) => ({
  'curve-style': 'straight',
  width: 3,
  'line-color': '#999',
  ...(arrows
    ? {
        'source-arrow-shape': 'triangle-backcurve',
        'target-arrow-shape': 'triangle',
        'source-arrow-color': '#5b6472',
        'target-arrow-color': '#5b6472',
      }
    : {
        'source-arrow-shape': 'none',
        'target-arrow-shape': 'none',
      }),
});

/** The re-apply pair: alternating sheets, so each call is a real style
 * write rather than a no-op against an unchanged sheet. */
const sheets = (arrows) =>
  [3, 5].map((width) => ({
    nodes: { width: 30, height: 30 },
    edges: { ...edgeStyle(arrows), width },
  }));

const build = (arrows) =>
  cytoscape({
    elements: elements(),
    style: { nodes: { width: 30, height: 30 }, edges: edgeStyle(arrows) },
  });

console.log(
  `arrows: ${PAIRS * 2} nodes, ${EDGES} edges (${PER_PAIR} per pair)\n`,
);

// -- construction ------------------------------------------------------------
// the arrow record (both shape ids, both hollow flags, the quantized
// scale) is packed by the first style apply, alongside the two arrow
// colour columns.  A throwaway pair goes first so neither side pays the
// module's warmup.
build(true).destroy();
build(false).destroy();

let arrowed;
let plain;

// the same A B B A debias `compare` uses; the extra pair is thrown away
const buildA1 = time(() => {
  arrowed = build(true);
});
const buildP1 = time(() => {
  plain = build(false);
});
const spareP = (() => {
  let cy;
  const ms = time(() => {
    cy = build(false);
  });
  cy.destroy();
  return ms;
})();
const spareA = (() => {
  let cy;
  const ms = time(() => {
    cy = build(true);
  });
  cy.destroy();
  return ms;
})();

const arrowedBuildMs = Math.min(buildA1, spareA);
const plainBuildMs = Math.min(buildP1, spareP);

console.log(
  `${'build (style apply + arrow fold)'.padEnd(40)} arrowed ${arrowedBuildMs.toFixed(1).padStart(8)} ms  ` +
    `none ${plainBuildMs.toFixed(1).padStart(8)} ms  ` +
    `${(arrowedBuildMs / plainBuildMs).toFixed(2)}x  ` +
    `(${((arrowedBuildMs * 1e6) / EDGES).toFixed(0)} ns/edge)`,
);

rows.push({
  label: 'build (style apply + arrow fold)',
  unit: 'edge',
  count: EDGES,
  arrowedMs: arrowedBuildMs,
  plainMs: plainBuildMs,
  ratio: arrowedBuildMs / plainBuildMs,
});

// -- the style write ---------------------------------------------------------
// round 55's headline row: a full re-apply, which is where every per-edge
// arrow value is resolved and written.  A CPU-computed line trim would be
// charged here and nowhere else.
const ARROWED_SHEETS = sheets(true);
const PLAIN_SHEETS = sheets(false);
const APPLIES = 4;

let applyParity = 0;

compare(
  `cy.style() re-apply x ${APPLIES}`,
  'edge-apply',
  EDGES * APPLIES,
  (cy) => {
    const set = cy === arrowed ? ARROWED_SHEETS : PLAIN_SHEETS;

    for (let i = 0; i < APPLIES; i++) {
      cy.style(set[applyParity]);
      applyParity = applyParity === 0 ? 1 : 0;
    }
  },
);

// -- the write path ----------------------------------------------------------
// moving a node re-derives the incident edges' geometry.  With the trim
// derived in the shader this row must not move; if it ever does, the
// derivation has leaked onto the CPU.
const DRAGS = Math.min(WORK, PAIRS * Math.max(1, Math.round(WORK / PAIRS)));

compare(`node.position x ${DRAGS} (drag)`, 'move', DRAGS, (cy) => {
  for (let i = 0; i < DRAGS; i++) {
    const j = i % PAIRS;

    cy.$id(`a${j}`).position({
      x: (j % 200) * 60 + (i % 7),
      y: Math.floor(j / 200) * 60,
    });
  }
});

// -- accessors ---------------------------------------------------------------
// the endpoint accessors are what round 55's first fix changes: v3
// returns the arrow point (boundary - spacing), v4 returns the node
// centre for a plain straight edge.  Whatever the fix costs is charged
// here.
compare(`edge.sourceEndpoint x ${WORK}`, 'edge', WORK, (cy) => {
  let x = 0;

  for (let i = 0; i < WORK; i++) {
    x += cy.$id(edgeId(i)).sourceEndpoint().x;
  }

  return x;
});

compare(`edge.targetEndpoint x ${WORK}`, 'edge', WORK, (cy) => {
  let x = 0;

  for (let i = 0; i < WORK; i++) {
    x += cy.$id(edgeId(i)).targetEndpoint().x;
  }

  return x;
});

compare(`edge.midpoint x ${WORK}`, 'edge', WORK, (cy) => {
  let x = 0;

  for (let i = 0; i < WORK; i++) {
    x += cy.$id(edgeId(i)).midpoint().x;
  }

  return x;
});

// the arrow style getters, read the way an application reads them
compare(`edge.style('target-arrow-shape') x ${WORK}`, 'read', WORK, (cy) => {
  let n = 0;

  for (let i = 0; i < WORK; i++) {
    n += cy.$id(edgeId(i)).style('target-arrow-shape').length;
  }

  return n;
});

// -- the control rows --------------------------------------------------------
// These two must NOT move.  Bounds and box selection walk edge geometry
// that arrowheads do not enter (v4's edge bound is the line's, and v3's
// is too), so a premium here would mean the premium rows above are
// measuring something ambient rather than the heads.  If round 55's trim
// work moves either of these, that is a finding about the bound, not a
// benchmark artifact.
compare('cy.elements().boundingBox() x 20', 'call', 20, (cy) => {
  for (let i = 0; i < 20; i++) {
    cy.elements().boundingBox();
  }
});

compare('elementsInBox x 20 (half the graph)', 'call', 20, (cy) => {
  const bb = cy.elements().boundingBox();

  for (let i = 0; i < 20; i++) {
    cy.elementsInBox(bb.x1, bb.y1, (bb.x1 + bb.x2) / 2, bb.y2);
  }
});

// -- the discrimination control ----------------------------------------------
// Every row above reads at parity, which is the honest baseline — v4 does
// almost nothing with arrows on the CPU today, and that is the defect
// round 55 is fixing.  But a suite of rows that all read 1.00x has to
// prove it *can* move, or it is measuring nothing and would report a
// regression as parity too.
//
// So: the same accessor on a *bezier* edge, which already resolves a real
// boundary point through `curveEvalAt` — the code path the gap fix makes
// straight edges take as well.  This row is both the control (it must
// differ from the straight number, or the accessor rows cannot see
// endpoint work) and the prediction (it is roughly where the straight
// rows should land once the fix is in).
const curvedArrowed = cytoscape({
  elements: elements(),
  style: {
    nodes: { width: 30, height: 30 },
    edges: { ...edgeStyle(true), 'curve-style': 'bezier' },
  },
});

const readEndpoints = (cy) => {
  let x = 0;

  for (let i = 0; i < WORK; i++) {
    x += cy.$id(edgeId(i)).sourceEndpoint().x;
  }

  return x;
};

readEndpoints(curvedArrowed);
readEndpoints(arrowed);

const curvedEndpointMs = Math.min(
  time(() => readEndpoints(curvedArrowed)),
  time(() => readEndpoints(curvedArrowed)),
);
const straightEndpointMs = Math.min(
  time(() => readEndpoints(arrowed)),
  time(() => readEndpoints(arrowed)),
);

console.log(
  `\ncontrol — edge.sourceEndpoint x ${WORK} through a real boundary resolve:`,
);
console.log(
  `${'  bezier (resolves a boundary point)'.padEnd(40)} ${curvedEndpointMs.toFixed(1).padStart(8)} ms  ` +
    `(${((curvedEndpointMs * 1e6) / WORK).toFixed(0)} ns/edge)`,
);
console.log(
  `${'  straight (returns the node centre)'.padEnd(40)} ${straightEndpointMs.toFixed(1).padStart(8)} ms  ` +
    `(${((straightEndpointMs * 1e6) / WORK).toFixed(0)} ns/edge)  ` +
    `${(curvedEndpointMs / straightEndpointMs).toFixed(2)}x`,
);

rows.push({
  label: 'control: sourceEndpoint, bezier vs straight',
  unit: 'edge',
  count: WORK,
  arrowedMs: curvedEndpointMs,
  plainMs: straightEndpointMs,
  ratio: curvedEndpointMs / straightEndpointMs,
});

curvedArrowed.destroy();

// -- resident bytes ----------------------------------------------------------
// Not a timing: the edge column layout, derived from the contract itself,
// so a widened column is measured rather than asserted.  Round 55 widens
// `edge.width` from one component to two (the arrow record rides in the
// second), and this is the line that has to show +4 B/edge and no more.
const edgeSpecs = columnSpecsForGroup('edges');
const bytesPerEdge = edgeSpecs.reduce((sum, s) => sum + s.bytesPerSlot, 0);

console.log(
  `\nedge columns: ${edgeSpecs.length} columns, ${bytesPerEdge} B/edge ` +
    `(${((bytesPerEdge * 465657) / 1048576).toFixed(1)} MiB at the ndex fixture's 465k edges)`,
);

for (const s of edgeSpecs.filter(
  (s) => s.id.startsWith('edge.arrow') || s.id === 'edge.width',
)) {
  console.log(
    `  ${s.id.padEnd(22)} ${s.ctor.name.padEnd(13)} x${s.components}  ${s.bytesPerSlot} B/edge`,
  );
}

// -- summary -----------------------------------------------------------------
console.log('\narrow premium (arrowed / none):');

for (const r of [...rows].sort((a, b) => b.ratio - a.ratio)) {
  console.log(`  ${r.ratio.toFixed(2).padStart(6)}x  ${r.label}`);
}

// join report.mjs's job table (round 33.10): one group per row, the
// arrowed and arrow-free sides as its two benches
finishManualRun('arrows', [
  ...rows.map((r) => ({
    name: `arrow premium: ${r.label}`,
    benches: [
      { name: 'arrowed', ms: r.arrowedMs },
      { name: 'none', ms: r.plainMs },
    ],
  })),
  {
    name: 'arrow premium: edge column bytes',
    benches: [{ name: 'B/edge', ms: bytesPerEdge }],
  },
]);
