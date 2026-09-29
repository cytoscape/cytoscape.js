// Round 102's measurement: what a hover emphasis costs per hover change
// at ndex-x-large scale, for the app spelling today and for the two
// designs the round's plan carried to the measurement.
//
//   npm run build
//   node benchmark/emphasis.mjs                  # ndex-x-large, 7 repeats
//   node benchmark/emphasis.mjs --repeat 3
//   node benchmark/emphasis.mjs --src            # through src/ (tsx) instead
//   node benchmark/emphasis.mjs --only 'app: bypass dim'   # one row, to profile
//
// The fixture is ndex-x-large (19,607 nodes, 464,657 edges) loaded from
// the wire form.  Two targets per row, because the hub is what an app
// actually hovers: a *typical* node (the first of degree 11 — a
// closed neighbourhood of ~23 elements) and the *hub* (the highest
// degree — its closed neighbourhood is ~1,400 elements).  A "hover
// change" is one emphasize plus its restore, the pair a pointer
// crossing a node costs; each half is timed and reported.
//
// The rows, in the plan's order:
//
//   1. **query** — `closedNeighborhood()` of the target, and the
//      complement an app builds to dim (`cy.elements().not( keep )`).
//      If the query dominated, the fix would be a slot-native walk,
//      not a style mechanism.
//   2. **app: bypass dim / app: hide** — the app spelling today (the
//      debug page's hover panel, round 114.7): a per-element `opacity`
//      bypass over everything outside the neighbourhood, or `hide()`,
//      and the restore.
//   3. **(a) store state** — the dim as a styled flag bit: a sheet
//      whose `opacity` is a `case` on a state (`selected` stands in for
//      a `dimmed` bit — the flag write and the round-61 banded reapply
//      are the same machinery), set over the rest and cleared again.
//      This is also what a *derived* `dimmed` costs on the frame the
//      emphasis turns on or off: every non-emphasized element's record
//      changes.  The neighbourhood-only delta (moving from one
//      emphasis straight to another) is its own row.
//   4. **(b) overlay** — the dim as view state: one flag bit per
//      element of the neighbourhood (no condition watches it, so no
//      restyle), the rest dimmed by the renderer as a composite.  Its
//      CPU cost is the flag write; its GPU cost is a second cull and
//      the emphasized tier's draw, priced in the browser (see the round
//      record).  Priced here through `cy.emphasize()` when the bundle
//      has it, and through the raw flag write it lowers to otherwise.
//
// Every row reports the dirty bytes a renderer would upload (every
// column span, from a registered dirty-stream consumer) as its second
// number, and asserts what it is named for — the dim is readable, the
// restore restored it — so a row that did less work cannot read faster.
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
const REPEAT = Number(opt('--repeat', 7));
const ONLY = opt('--only', null);
const SRC = args.includes('--src');
const FIXTURE = join(ROOT, 'debug', 'network-ndex-x-large.json');

const { default: cytoscape } = await import(
  SRC
    ? pathToFileURL(join(ROOT, 'src', 'index.mts')).href
    : pathToFileURL(join(ROOT, 'build', 'cytoscape.esm.mjs')).href
);

// the flag bits this file writes raw (contract.mts; spelled here because
// a benchmark imports the bundle, not src/)
const FLAG_SELECTED = 4;
const FLAG_EMPHASIZED = 524288;

// round 110.1's census sheet, as benchmark/sheet-diff.mjs uses it
const base = {
  nodes: {
    width: 12,
    height: 12,
    'background-color': '#4a7dbd',
    label: { data: 'name' },
    'font-size': 10,
    color: '#333',
  },
  edges: { width: 1, 'line-color': '#bbb', opacity: 0.6 },
};
// design (a): the dim as a styled state (selected stands in for dimmed)
const stateDim = {
  nodes: {
    ...base.nodes,
    opacity: { case: [{ when: { selected: true }, then: 0.15 }], else: 1 },
  },
  edges: {
    ...base.edges,
    opacity: { case: [{ when: { selected: true }, then: 0.09 }], else: 0.6 },
  },
};

const json = JSON.parse(readFileSync(FIXTURE, 'utf8'));
const wire = cytoscape.serializeElements(
  cytoscape.toColumnarElements(json.elements),
);
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);

  return s[Math.floor(s.length / 2)];
};

/** A fresh instance under `style`, with its dirty stream drained. */
function fresh(style) {
  const cy = cytoscape({
    headless: true,
    elements: cytoscape.deserializeElements(wire),
    style,
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

// the two targets, found once on a probe instance
const probe = fresh(base);
const byDegree = probe.cy
  .nodes()
  .map((n) => [n.id(), n.degree()])
  .sort((a, b) => b[1] - a[1]);
const TARGETS = [
  ['typical', byDegree.find(([, d]) => d === 11)[0]],
  ['hub', byDegree[0][0]],
];

console.log(
  `\n== hover emphasis (ndex-x-large: ${probe.cy.nodes().length} nodes, ${probe.cy.edges().length} edges; ${REPEAT} hover changes per row; ${SRC ? 'src via tsx' : 'built ESM bundle'}; ${cpus()[0].model}, Node ${process.version}) ==`,
);

for (const [name, id] of TARGETS) {
  const n = probe.cy.getElementById(id);

  console.log(
    `   ${name}: ${id}, degree ${n.degree()}, closed neighbourhood ${n.closedNeighborhood().length} elements`,
  );
}

probe.cy.destroy();

const HAS_API = (() => {
  const { cy } = fresh(base);
  const has = typeof cy.emphasize === 'function';

  cy.destroy();

  return has;
})();

/**
 * One row per target: `on( cy, node )` then `off( cy, node )`, REPEAT
 * times on one instance, each half timed with its dirty bytes.  `check`
 * runs after the last `on` and must return null.
 */
function row(name, { style = base, on, off, check, afterOff }) {
  for (const [target, id] of TARGETS) {
    const label = `${name} [${target}]`;

    if (ONLY != null && ONLY !== name && ONLY !== label) {
      continue;
    }

    const { cy, consumer } = fresh(style);
    const node = cy.getElementById(id);
    const onMs = [];
    const offMs = [];
    const onBytes = [];
    const offBytes = [];
    let problem = null;

    for (let r = 0; r < REPEAT; r++) {
      let t = performance.now();

      on(cy, node);
      onMs.push(performance.now() - t);
      onBytes.push(deltaBytes(cy, consumer.take()));

      if (r === REPEAT - 1) {
        problem = check?.(cy, node) ?? null;
      }

      t = performance.now();
      off(cy, node);
      offMs.push(performance.now() - t);
      offBytes.push(deltaBytes(cy, consumer.take()));
    }

    problem ??= afterOff?.(cy, node) ?? null;

    if (problem != null) {
      console.log(`${label}: ASSERTION FAILED — ${problem}`);
      process.exitCode = 1;
    }

    const on_ = median(onMs);
    const off_ = median(offMs);

    console.log(
      `${label.padEnd(40)} on ${on_.toFixed(3).padStart(9)} ms · off ${off_.toFixed(3).padStart(9)} ms · change ${(on_ + off_).toFixed(3).padStart(9)} ms · ${(median(onBytes) / 1e6).toFixed(2).padStart(6)} + ${(median(offBytes) / 1e6).toFixed(2).padStart(6)} MB dirty`,
    );

    consumer.dispose();
    cy.destroy();
  }
}

/** A query row: the median of REPEAT calls, no restore half. */
function query(name, fn) {
  for (const [target, id] of TARGETS) {
    const label = `${name} [${target}]`;

    if (ONLY != null && ONLY !== name && ONLY !== label) {
      continue;
    }

    const { cy } = fresh(base);
    const node = cy.getElementById(id);
    const ms = [];
    let size = 0;

    for (let r = 0; r < REPEAT; r++) {
      const t = performance.now();

      size = fn(cy, node).length;
      ms.push(performance.now() - t);
    }

    console.log(
      `${label.padEnd(40)} ${median(ms).toFixed(3).padStart(9)} ms · ${size} elements`,
    );
    cy.destroy();
  }
}

// opacity is a float32 column, so 0.15 reads back as 0.15000000596…
const opacityOf = (ele) => Math.round(Number(ele.style('opacity')) * 1e4) / 1e4;
const farNode = (cy, node) => {
  const keep = node.closedNeighborhood();

  return cy.nodes().filter((n) => !keep.has(n))[0];
};

// -- 1. the query --

query('query: closedNeighborhood', (cy, node) => node.closedNeighborhood());
query('query: the rest (elements().not)', (cy, node) =>
  cy.elements().not(node.closedNeighborhood()),
);

// -- 2. the app spelling today --

{
  let rest = null;

  row('app: bypass dim', {
    on: (cy, node) => {
      rest = cy.elements().not(node.closedNeighborhood());
      cy.batch(() => rest.style({ opacity: 0.15 }));
    },
    off: (cy) => cy.batch(() => rest.removeStyle('opacity')),
    check: (cy, node) =>
      opacityOf(farNode(cy, node)) === 0.15 && opacityOf(node) === 1
        ? null
        : 'the rest is not dimmed',
    afterOff: (cy, node) =>
      opacityOf(farNode(cy, node)) === 1 ? null : 'the restore left a dim',
  });

  row('app: hide', {
    on: (cy, node) => {
      rest = cy.elements().not(node.closedNeighborhood());
      rest.hide();
    },
    off: () => rest.show(),
    check: (cy, node) =>
      !farNode(cy, node).visible() && node.visible()
        ? null
        : 'the rest is not hidden',
    afterOff: (cy, node) =>
      farNode(cy, node).visible() ? null : 'the restore left a hidden element',
  });
}

// -- 3. design (a): the dim as a styled flag bit --

{
  // the complement per target, built outside the timed write: an app
  // has to name the rest somehow, and a native setter would walk the
  // slots instead — so the row prices the write alone and the query row
  // above prices the naming
  const rest = new WeakMap(); // one instance per row and target
  const refsOf = (cy, node) => {
    if (!rest.has(cy)) {
      rest.set(cy, cy.elements().not(node.closedNeighborhood())._refs);
    }

    return rest.get(cy);
  };

  row('(a) state dim: set over the rest', {
    style: stateDim,
    on: (cy, node) => cy._store.flagRefs(refsOf(cy, node), FLAG_SELECTED, true),
    off: (cy, node) =>
      cy._store.flagRefs(refsOf(cy, node), FLAG_SELECTED, false),
    check: (cy, node) =>
      opacityOf(farNode(cy, node)) === 0.15 && opacityOf(node) === 1
        ? null
        : 'the rest is not dimmed',
    afterOff: (cy, node) =>
      opacityOf(farNode(cy, node)) === 1 ? null : 'the clear left a dim',
  });
}

row('(a) state dim: neighbourhood delta', {
  style: stateDim,
  // the neighbourhood's own records flip (moving straight from one
  // emphasis to another costs this, twice)
  on: (cy, node) =>
    cy._store.flagRefs(node.closedNeighborhood()._refs, FLAG_SELECTED, true),
  off: (cy, node) =>
    cy._store.flagRefs(node.closedNeighborhood()._refs, FLAG_SELECTED, false),
  check: (cy, node) =>
    opacityOf(node) === 0.15 ? null : 'the neighbourhood did not restyle',
});

// -- 4. design (b): the dim as view state --

if (HAS_API) {
  row('(b) overlay: cy.emphasize', {
    on: (cy, node) => cy.emphasize(node.closedNeighborhood()),
    off: (cy) => cy.unemphasize(),
    check: (cy, node) =>
      node.emphasized() &&
      !farNode(cy, node).emphasized() &&
      cy._store.emphasisDim() >= 0
        ? null
        : 'the emphasis is not set',
    afterOff: (cy, node) =>
      !node.emphasized() && cy._store.emphasisDim() < 0
        ? null
        : 'unemphasize left state behind',
  });

  // a sheet that styles the emphasized set (design (a)'s half that
  // stays: the emphasized elements restyle, O(neighbourhood))
  row('(b) overlay + styled emphasized', {
    style: {
      nodes: {
        ...base.nodes,
        'border-width': {
          case: [{ when: { emphasized: true }, then: 2 }],
          else: 0,
        },
      },
      edges: {
        ...base.edges,
        opacity: {
          case: [{ when: { emphasized: true }, then: 1 }],
          else: 0.6,
        },
      },
    },
    on: (cy, node) => cy.emphasize(node.closedNeighborhood()),
    off: (cy) => cy.unemphasize(),
    check: (cy, node) =>
      Number(node.style('border-width')) === 2
        ? null
        : 'the emphasized node did not restyle',
  });
} else {
  if (ONLY == null) {
    console.log(
      '(b) overlay rows: this build has no cy.emphasize — the raw flag write it lowers to:',
    );
  }
  row('(b) overlay: flag write (raw)', {
    on: (cy, node) =>
      cy._store.flagRefs(
        node.closedNeighborhood()._refs,
        FLAG_EMPHASIZED,
        true,
      ),
    off: (cy, node) =>
      cy._store.flagRefs(
        node.closedNeighborhood()._refs,
        FLAG_EMPHASIZED,
        false,
      ),
  });
}
