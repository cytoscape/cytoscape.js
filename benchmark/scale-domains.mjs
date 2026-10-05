// Partial automatic scale domains and cached legend reads (round 147).
//
// This sweep prices the distinct bound-change policies on one shared
// node channel: a moved automatic endpoint re-writes the group, an
// unchanged automatic endpoint writes only the changed slot, and an
// explicit domain skips the extent scan. The batch row repeats endpoint
// writes inside one transaction and confirms that only its final bound
// is applied. Legend reads return detached JSON from the last committed
// snapshot; the repeated-read row makes that cache observable.
//
// The one-off controls below instrument engine.write outside the timed
// rows. They prove the fixture actually exercises N, 1, 1 and N style
// writes for the changed, unchanged, explicit and batched cases.

import assert from 'node:assert/strict';
import { bench, group, summary } from 'mitata';
import cytoscape from '../src/index.mjs';
import { N } from './bench-size.mjs';
import { finishRun } from './bench-run.mjs';

const nodeDefs = Array.from({ length: Math.max(3, N) }, (_, i) => ({
  data: { id: `n${i}`, w: i },
}));
const size = nodeDefs.length;
const lastId = `n${size - 1}`;
const autoSheet = {
  nodes: { width: { data: 'w', domain: [0, 'auto'], range: [10, 30] } },
};
const explicitSheet = {
  nodes: { width: { data: 'w', domain: [0, size - 1], range: [10, 30] } },
};
const legendSheet = {
  nodes: {
    width: { data: 'w', domain: [0, 'auto'], range: [10, 30] },
    'background-color': {
      data: 'w',
      domain: [0, 'auto'],
      range: ['#2166ac', '#b2182b'],
    },
  },
};
const make = (style) =>
  cytoscape({
    elements: nodeDefs.map(({ data }) => ({ data: { ...data } })),
    style,
  });

const instrument = (cy, op) => {
  let writes = 0;
  const original = cy._styleEngine.write;
  cy._styleEngine.write = function (...args) {
    writes++;
    return original.apply(this, args);
  };
  op();
  cy._styleEngine.write = original;
  return writes;
};

const changed = make(autoSheet);
const unchanged = make(autoSheet);
const explicit = make(explicitSheet);
const batched = make(autoSheet);
const movedWrites = instrument(changed, () =>
  changed.$id(lastId).data('w', size),
);
const unchangedWrites = instrument(unchanged, () =>
  unchanged.$id('n1').data('w', 1.5),
);
const explicitWrites = instrument(explicit, () =>
  explicit.$id('n1').data('w', 1.5),
);
let batchMax = size - 1;
const batchWrites = instrument(batched, () =>
  batched.batch(() => {
    for (let i = 0; i < 25; i++) {
      batchMax = batchMax === size ? size + 1 : size;
      batched.$id(lastId).data('w', batchMax);
    }
  }),
);

assert.equal(movedWrites, size, 'a changed endpoint rebuilds the node group');
assert.equal(unchangedWrites, 1, 'an unchanged endpoint writes one node');
assert.equal(explicitWrites, 1, 'an explicit domain writes one node');
assert.equal(
  batchWrites,
  size,
  'a batch rebuilds the group once at its boundary',
);

console.log(
  `scale-domain controls: ${size} nodes; rebuilt channels: width; writes ` +
    `changed=${movedWrites}, unchanged=${unchangedWrites}, ` +
    `explicit=${explicitWrites}, 25-write batch=${batchWrites}`,
);

const autoChanged = make(autoSheet);
const autoUnchanged = make(autoSheet);
const fixed = make(explicitSheet);
const batch = make(autoSheet);
const repeatedLegend = make(legendSheet);
const changedNode = autoChanged.$id(lastId);
const unchangedNode = autoUnchanged.$id('n1');
const fixedNode = fixed.$id('n1');
const batchNode = batch.$id(lastId);
let high = size - 1;
let low = 1;
let batchHigh = size - 1;
let batchTurn = false;
let sink = 0;

console.log(`\n== scale-domain and legend sweep (N=${size} nodes) ==`);

group(`auto domain: endpoint refresh (N=${size}; width rebuilt)`, () => {
  summary(() => {
    bench('moved maximum', () => {
      high = high === size ? size + 1 : size;
      changedNode.data('w', high);
    });
    bench('unchanged maximum', () => {
      low = low >= size - 2 ? 1 : low + 0.25;
      unchangedNode.data('w', low);
    });
    bench('explicit domain control', () => {
      low = low >= size - 2 ? 1 : low + 0.25;
      fixedNode.data('w', low);
    });
  });
});

group(`batch extent refresh: 25 writes, N=${size}; width rebuilt once`, () => {
  summary(() => {
    bench('25 writes / one moved bound', () => {
      batch.batch(() => {
        batchTurn = !batchTurn;
        for (let i = 0; i < 25; i++) {
          batchHigh = batchTurn ? size + (i % 2) : size + 1 - (i % 2);
          batchNode.data('w', batchHigh);
        }
      });
    });
  });
});

group('legend: repeated detached reads (2 mapping entries)', () => {
  summary(() => {
    bench('100 reads from one committed snapshot', () => {
      for (let i = 0; i < 100; i++) {
        sink += repeatedLegend.legend().entries.length;
      }
    });
  });
});

void sink;
await finishRun('scale-domains');
