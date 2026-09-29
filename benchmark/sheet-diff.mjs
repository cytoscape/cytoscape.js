// Round 133 (ledger item 67): what a whole-sheet `cy.style( sheet )`
// re-apply costs when the only change is one property, against the
// item's hand-simulated target and the sheet diff that replaced the
// whole-sheet pass.
//
//   npm run build
//   node benchmark/sheet-diff.mjs                  # ndex-x-large, 60 applies
//   node benchmark/sheet-diff.mjs --applies 20
//   node benchmark/sheet-diff.mjs --src            # through src/ (tsx) instead
//   node benchmark/sheet-diff.mjs --only 'sheet diff'   # one row, to profile
//
// The fixture is round 110.1's census: ndex-x-large (19,607 nodes,
// 464,657 edges) loaded from the wire form, under the census's sheet.
// Each row starts from a fresh instance and runs APPLIES operations,
// alternating the node `background-color` between two constants, so
// every operation is a real change:
//
//   1. **full re-apply** — `cy.style( sheet )` with the diff switched
//      off (`_styleEngine.sheetDiff = false`): the pre-round path, every
//      channel of every element re-derived and re-written.
//   2. **hand diff** — `cy.nodes().style( 'background-color', c )`, the
//      item's stated target: the one property, by hand.  (It writes a
//      bypass per node, which a later sheet replace clears — the row is
//      a floor for the work, not a substitute for the API.)
//   3. **sheet diff** — `cy.style( sheet )` as shipped: only the
//      properties whose declaration differs from the installed sheet's
//      are re-written, per group.
//
// Three control rows price what the diff must *not* skip: an identical
// sheet (the diff is empty — the floor of the compile), an edge `width`
// change (no narrow writer, so the edge group takes the full pass and
// the nodes are skipped) and a constant → data-mapper swap of the node
// colour (the diff evaluates the new mapper per node).
//
// Every row asserts what it is named for.  The dirty bytes per
// operation (every column span a renderer would upload, from a
// registered dirty-stream consumer) are the row's second number, and
// each `sheet diff` row's end state is compared column for column with
// the same sheets applied through the full path — a diff that did less
// work by being wrong cannot read faster, it exits non-zero.
//
// Through the built bundle by default: the tsx path's `__name` wrapper
// costs per closure creation (docs/agents/benchmarking.md).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);

  return i >= 0 ? args[i + 1] : fallback;
};
const APPLIES = Number(opt('--applies', 60));
const ONLY = opt('--only', null);
const SRC = args.includes('--src');
const FIXTURE = join(ROOT, 'debug', 'network-ndex-x-large.json');

const { default: cytoscape } = await import(
  SRC
    ? pathToFileURL(join(ROOT, 'src', 'index.mts')).href
    : pathToFileURL(join(ROOT, 'build', 'cytoscape.esm.mjs')).href
);

// round 110.1's census sheet
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
const COLORS = ['#123456', '#654321'];
const withNodeColor = (f) => ({
  nodes: { ...style.nodes, 'background-color': COLORS[f % 2] },
  edges: style.edges,
});

const json = JSON.parse(readFileSync(FIXTURE, 'utf8'));
const wire = cytoscape.serializeElements(
  cytoscape.toColumnarElements(json.elements),
);
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);

  return s[Math.floor(s.length / 2)];
};

/** A fresh instance under the census sheet, with its dirty stream drained. */
function fresh(first = withNodeColor(1)) {
  const cy = cytoscape({
    headless: true,
    elements: cytoscape.deserializeElements(wire),
    style: first,
  });
  const consumer = cy._store.registerConsumer();

  consumer.take();

  return { cy, consumer };
}

/** Bytes a renderer would upload for one delta: every column span. */
function deltaBytes(cy, delta) {
  const store = cy._store;
  let bytes = 0;

  for (const span of delta.spans) {
    const col = store.column(span.column);
    const group = span.column.startsWith('node.') ? 'nodes' : 'edges';
    const perSlot = col.byteLength / store.table(group).cap;

    bytes += (span.end - span.start) * perSlot;
  }

  return bytes;
}

/** Every column of both groups, for the end-state comparison. */
function snapshot(cy) {
  const store = cy._store;
  const out = new Map();

  // every column the two tables hold (`arrays` is TypeScript-private,
  // which is a compile-time fence only)
  for (const table of [store.table('nodes'), store.table('edges')]) {
    for (const [id, col] of table.arrays) {
      out.set(id, new Uint8Array(col.buffer, col.byteOffset, col.byteLength));
    }
  }

  return out;
}

function sameColumns(a, b) {
  const diffs = [];

  for (const [id, bytes] of a) {
    const other = b.get(id);

    if (other == null || other.length !== bytes.length) {
      diffs.push(`${id} (shape)`);
      continue;
    }

    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] !== other[i]) {
        diffs.push(id);
        break;
      }
    }
  }

  return diffs;
}

const hasDiff = (cy) => 'sheetDiff' in cy._styleEngine;

/**
 * One row: `op( cy, f )` APPLIES times on a fresh instance, timed per
 * operation, with the dirty bytes each one left.
 */
function row(name, { op, diff = true, check, first, compare }) {
  if (ONLY != null && ONLY !== name) {
    return;
  }

  const { cy, consumer } = fresh(first);

  if (hasDiff(cy)) {
    cy._styleEngine.sheetDiff = diff;
  } else if (diff === true && op.usesSheet) {
    console.log(`${name}: skipped — this build has no sheet diff`);
    cy.destroy();

    return;
  }

  const ms = [];
  const bytes = [];

  for (let f = 0; f < APPLIES; f++) {
    const t = performance.now();

    op(cy, f);
    ms.push(performance.now() - t);
    bytes.push(deltaBytes(cy, consumer.take()));
  }

  const problem = check?.(cy);

  if (problem != null) {
    console.log(`${name}: ASSERTION FAILED — ${problem}`);
    process.exitCode = 1;
  }

  let equivalence = '';

  if (compare != null) {
    // the same sheets, in the same order, through the full path
    const ref = fresh(first);

    ref.cy._styleEngine.sheetDiff = false;

    for (let f = 0; f < APPLIES; f++) {
      compare(ref.cy, f);
    }

    const diffs = sameColumns(snapshot(cy), snapshot(ref.cy));

    equivalence =
      diffs.length === 0
        ? ' · end state = full re-apply, every column'
        : ` · END STATE DIFFERS from the full re-apply: ${diffs.join(', ')}`;

    if (diffs.length > 0) {
      process.exitCode = 1;
    }

    ref.cy.destroy();
  }

  console.log(
    `${name.padEnd(34)} ${median(ms).toFixed(2).padStart(8)} ms/op (median of ${APPLIES}; min ${Math.min(...ms).toFixed(2)}) · ${(median(bytes) / 1e6).toFixed(2).padStart(6)} MB dirty/op${equivalence}`,
  );

  consumer.dispose();
  cy.destroy();
}

const sheetOp = (sheetFor) => {
  const op = (cy, f) => cy.style(sheetFor(f));

  op.usesSheet = true;

  return op;
};
const fillOf = (cy, id) => cy.getElementById(id).style('background-color');
const firstNode = (cy) => cy.nodes()[0].id();
const expectFill = (want) => (cy) => {
  const got = fillOf(cy, firstNode(cy));

  return got === want ? null : `node fill reads ${got}, expected ${want}`;
};
// the last operation (f = APPLIES − 1) wrote COLORS[(APPLIES − 1) % 2]
const LAST = COLORS[(APPLIES - 1) % 2];
const LAST_RGB = (() => {
  const h = LAST.slice(1);

  return `rgb(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)})`;
})();

{
  const probe = fresh();

  console.log(
    `\n== sheet re-apply (ndex-x-large: ${probe.cy.nodes().length} nodes, ${probe.cy.edges().length} edges; ${APPLIES} operations per row; ${SRC ? 'src via tsx' : 'built ESM bundle'}; ${cpus()[0].model}, Node ${process.version}) ==`,
  );
  probe.cy.destroy();
}

row('full re-apply', {
  op: sheetOp(withNodeColor),
  diff: false,
  check: expectFill(LAST_RGB),
});

{
  const op = (cy, f) => cy.nodes().style('background-color', COLORS[f % 2]);

  row('hand diff (cy.nodes().style)', { op, check: expectFill(LAST_RGB) });
}

row('sheet diff', {
  op: sheetOp(withNodeColor),
  check: expectFill(LAST_RGB),
  compare: (cy, f) => cy.style(withNodeColor(f)),
});

row('sheet diff: identical sheet', {
  op: sheetOp(() => withNodeColor(1)),
  check: expectFill('rgb(101,67,33)'),
  compare: (cy) => cy.style(withNodeColor(1)),
});

{
  const edgeWidth = (f) => ({
    nodes: style.nodes,
    edges: { ...style.edges, width: 1 + (f % 2) },
  });

  row('sheet diff: edge width (full edges)', {
    op: sheetOp(edgeWidth),
    first: edgeWidth(1),
    check: (cy) => {
      const w = cy.edges()[0].style('width');
      const want = `${1 + ((APPLIES - 1) % 2)}px`;

      return w === want ? null : `edge width reads ${w}, expected ${want}`;
    },
    compare: (cy, f) => cy.style(edgeWidth(f)),
  });
}

{
  const mapperSwap = (f) =>
    f % 2
      ? withNodeColor(0)
      : {
          nodes: {
            ...style.nodes,
            'background-color': {
              case: [
                { when: { data: 'Node_Type', eq: 'TF' }, then: '#00ff00' },
              ],
              else: '#0000ff',
            },
          },
          edges: style.edges,
        };

  row('sheet diff: constant <-> mapper', {
    op: sheetOp(mapperSwap),
    first: mapperSwap(1),
    compare: (cy, f) => cy.style(mapperSwap(f)),
  });
}
