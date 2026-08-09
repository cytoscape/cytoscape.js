// Style-engine sweep (round 33.3): what applying a stylesheet costs.
//
// Before this round the engine's apply paths were priced only obliquely —
// a whole-sheet swap appears in transitions.mjs as a transitions-off-vs-on
// ratio and in scenarios.mjs as one step of the refresh trace, and
// mappers.mjs prices the *data-write* refresh rather than the apply.  This
// suite prices the apply itself:
//
//   node --import tsx benchmark/style.mjs            # N=2000
//   BENCH_N=200000 BENCH_OP=swap node --import tsx benchmark/style.mjs
//
// Two sheets alternate on every row that re-applies, so no iteration can
// be skipped as unchanged — the same reason mappers.mjs rotates its
// written value.
//
// A history note this suite once stated as permanent: "v4 has no
// selection-dependent blocks at all... there is nothing to turn on and
// off."  True from the selector removal until round 57.1d, which made
// state a `case` condition — the default stylesheet's selection blue is
// `{ when: { selected: true } }` — so the selection restyle is
// measurable again and the round-60 rows below price it: the flag
// partition (`applyPartitioned`, one computed record per state
// combination) against both the constant path it claims to match and
// the per-element path it avoids, and what a select/unselect costs once
// a sheet conditions on the state.  The plain select/unselect
// round-trip stays priced in mutators.mjs (~38x at 200k).

import { bench, group, summary, do_not_optimize } from 'mitata';
import { finishRun } from './bench-run.mjs';
import { buildElements, makeV3, makeGpu, MIDNUM, N } from './graph.mjs';

const OP = process.env.BENCH_OP;
const elements = buildElements();
const instances = [];

// -- the two alternating looks -----------------------------------------------
// Constants only: mapper evaluation has its own suite (mappers.mjs), and
// mixing one in here would make these rows measure the DSL instead of the
// apply.  Same channels on both sides, so the same columns are written.
const GPU_SHEETS = [
  {
    nodes: {
      'background-color': '#3366cc',
      width: 30,
      height: 30,
      'border-width': 2,
      'border-color': '#222',
    },
    edges: { 'line-color': '#999', width: 2 },
  },
  {
    nodes: {
      'background-color': '#cc6633',
      width: 34,
      height: 34,
      'border-width': 3,
      'border-color': '#444',
    },
    edges: { 'line-color': '#777', width: 3 },
  },
];

const V3_SHEETS = GPU_SHEETS.map((sheet) => [
  { selector: 'node', style: { ...sheet.nodes } },
  { selector: 'edge', style: { ...sheet.edges } },
]);

function v3Instance() {
  const cy = makeV3(elements, {
    styleEnabled: true,
    layout: { name: 'preset' },
  });

  instances.push(cy);

  return cy;
}

function gpuInstance() {
  const cy = makeGpu(elements);

  instances.push(cy);

  return cy;
}

function cmp(name, v3Op, gpuOp) {
  if (OP != null && !name.includes(OP)) {
    return;
  }

  const a = v3Instance();
  const b = gpuInstance();
  let i = 0;

  group(name, () => {
    summary(() => {
      bench('v3', () => {
        v3Op(a, i++);
      });
      bench('gpu', () => {
        gpuOp(b, i++);
      });
    });
  });
}

function cmpGpu(name, aLabel, aSetup, aFn, bLabel, bSetup, bFn) {
  if (OP != null && !name.includes(OP)) {
    return;
  }

  const a = aSetup();
  const b = bSetup();
  let i = 0;

  group(name, () => {
    summary(() => {
      bench(aLabel, () => {
        aFn(a, i++);
      });
      bench(bLabel, () => {
        bFn(b, i++);
      });
    });
  });
}

console.log(`\n== style sweep (N=${N} nodes, ${2 * N} edges) ==`);

// -- whole-sheet application --------------------------------------------------
// The headline: compile + validate + apply every channel of every
// element.  v3 re-applies its stylesheet the same way.
cmp(
  'style: sheet swap (compile + applyAll)',
  (cy, i) => {
    cy.style(V3_SHEETS[i & 1]);
  },
  (cy, i) => {
    cy.style(GPU_SHEETS[i & 1]);
  },
);

// Compile alone, separated from apply through the public batching
// semantics: inside a batch `cy.style( sheet )` compiles and validates
// immediately and defers the apply to the outermost endBatch (round 6).
// So the difference between these two rows is the applyAll.
cmpGpu(
  'style: compile vs compile + apply',
  'compile only (in batch)',
  gpuInstance,
  (cy, i) => {
    cy.startBatch();
    cy.style(GPU_SHEETS[i & 1]);
    // drop the apply the batch deferred, so this row is the compile alone
    // (the batch records it as `pending.sheet`, flushed as one applyAll)
    cy._batchPending.sheet = false;
    cy.endBatch();
  },
  'compile + apply',
  gpuInstance,
  (cy, i) => {
    cy.style(GPU_SHEETS[i & 1]);
  },
);

// -- the first apply of newly added elements ----------------------------------
// A band added and removed per iteration: the add pays the first style
// application of its elements (v4 batches it; v3 applies per element).
{
  const BAND = 256;
  const band = Array.from({ length: BAND }, (_, k) => ({
    data: { id: 'add' + k, foo: k, weight: k % 7 },
    position: { x: k * 3, y: k * 3 },
  }));

  const addRemove = (cy) => {
    const added = cy.add(
      band.map((e) => ({ data: { ...e.data }, position: { ...e.position } })),
    );

    added.remove();
  };

  cmp(`style: first apply on add (${BAND}-node band)`, addRemove, addRemove);
}

// -- the parents overlay ------------------------------------------------------
// Round 14.6 partitions node slots by FLAG_PARENT and resolves the
// parents overlay for the parent half.  This prices that partition: the
// same sheet applied to a flat graph and to a compound one of the same
// element count.  Not a v3 comparison — the two sides are two v4 graphs.
// Both sides run one generator so the two graphs differ in exactly one
// thing.  The first version of this row built the compound side without
// edges and read 3.55x *faster* than flat — which was not the parents
// partition being free, it was 4000 edges missing from one side (design
// call 1, caught by design call 5 for the second time this round).
//
// The one difference that cannot be removed is inherent: a compound graph
// has parent nodes, so the compound side carries N/CLUSTER extra node
// slots.  That is the thing being priced, and it is noted rather than
// engineered away.
{
  const CLUSTER = 20;
  const clusters = Math.max(1, Math.floor(N / CLUSTER));

  const withHierarchy = (parents) => {
    const out = [];

    if (parents) {
      for (let c = 0; c < clusters; c++) {
        out.push({ data: { id: 'p' + c } });
      }
    }

    for (const e of elements) {
      const data = { ...e.data };

      if (parents && data.source == null && /^n\d+$/.test(data.id)) {
        data.parent = 'p' + (Number(data.id.slice(1)) % clusters);
      }

      out.push({ data, position: e.position ? { ...e.position } : undefined });
    }

    return out;
  };

  const PARENT_SHEETS = GPU_SHEETS.map((sheet) => ({
    ...sheet,
    parents: { 'background-color': '#eee', padding: 10 },
  }));

  const instance = (parents) => () => {
    const cy = makeGpu(withHierarchy(parents));

    instances.push(cy);

    return cy;
  };

  cmpGpu(
    `style: applyAll, flat vs compound (${clusters} parents — the 14.6 partition)`,
    'flat',
    instance(false),
    (cy, i) => {
      cy.style(PARENT_SHEETS[i & 1]);
    },
    'compound',
    instance(true),
    (cy, i) => {
      cy.style(PARENT_SHEETS[i & 1]);
    },
  );
}

// -- state conditions (round 57.1d, priced in round 60) ----------------------
// The default stylesheet is made of state-only `case` mappers
// (`{ when: { selected: true } }`), and 57.1d's `applyPartitioned` claims
// that costs nothing: a group whose mappers read *only* state flags has
// one computed record per distinct flag combination, so the apply masks
// the flags word and hits a Map instead of evaluating per element.
//
// Three rows carry the claim and its control:
//   - constant vs state-case must read ~1x (the claim — an optimisation
//     must be invisible);
//   - state-case vs data-case must NOT read ~1x (the discrimination —
//     a data condition is the per-element path the partition avoids, so
//     a ~1x here would mean the partition rows measure nothing);
//   - select+unselect under a state-conditional sheet prices what the
//     default look costs on the most common interaction, against the
//     constant sheet's skip-restyle fast path (round 4, generalised by
//     57.1's dependsOnState).
{
  // Every channel of the shared sheets is conditioned, not just the
  // colours.  The first version of these rows case-mapped two channels
  // of seven and could not discriminate: with `applyPartitioned`
  // disabled outright, constant-vs-state still read 1.02x — the apply's
  // per-element constant work drowned a 2/7-mapped sheet.  A row whose
  // claim is ~1x and whose control is also ~1x measures nothing (the
  // round-27 rule), so the conditional sheets condition everything the
  // constant sheets set.
  const caseAll = (when) => (sheet) => {
    // `then` must differ from `else`, or the condition decides nothing
    // observable and the startup probe below cannot prove the sheet
    // restyles on state
    const thenOf = (value) =>
      typeof value === 'number' ? value + 1 : '#0169d9';
    const wrap = (obj) =>
      Object.fromEntries(
        Object.entries(obj).map(([prop, value]) => [
          prop,
          { case: [{ when, then: thenOf(value) }], else: value },
        ]),
      );

    return { nodes: wrap(sheet.nodes), edges: wrap(sheet.edges) };
  };

  const STATE_SHEETS = GPU_SHEETS.map(caseAll({ selected: true }));
  // `weight` is 0..6 in the shared fixture; gt 3 splits the graph, so
  // the per-element evaluation cannot be constant-folded away.  (Edges
  // carry no `weight`, so their conditions all miss into `else` — still
  // evaluated per element, which is the thing being priced.)
  const DATA_SHEETS = GPU_SHEETS.map(caseAll({ data: 'weight', gt: 3 }));

  // the rows are guilty until they discriminate: prove the state sheet
  // actually restyles on selection before pricing anything
  {
    const probe = gpuInstance();

    probe.style(STATE_SHEETS[0]);

    const n = probe.$id('n' + MIDNUM);
    const before = n.style('background-color');

    n.select();

    const after = n.style('background-color');

    if (before === after) {
      console.warn(
        '  !! the state-case sheet does not restyle on selection — the 57.1d rows below measure nothing',
      );
    }

    n.unselect();
  }

  cmpGpu(
    'style: applyAll — constant vs state-case (the 57.1d partition)',
    'constant sheet',
    gpuInstance,
    (cy, i) => {
      cy.style(GPU_SHEETS[i & 1]);
    },
    'state-case sheet',
    gpuInstance,
    (cy, i) => {
      cy.style(STATE_SHEETS[i & 1]);
    },
  );

  cmpGpu(
    'style: applyAll — state-case vs data-case (what the partition avoids)',
    'state-case sheet',
    gpuInstance,
    (cy, i) => {
      cy.style(STATE_SHEETS[i & 1]);
    },
    'data-case sheet',
    gpuInstance,
    (cy, i) => {
      cy.style(DATA_SHEETS[i & 1]);
    },
  );

  // select + unselect a band: the constant sheet takes round 4's
  // skip-restyle fast path; the state sheet must restyle the changed
  // slots (57.1's dependsOnState), which is the per-selection price of
  // the default look
  {
    const BAND = Math.min(256, N);
    // built by union: `cy.collection()` takes no arguments in v4 (it is
    // the empty accumulator), and the first version of this row handed
    // it an array it silently ignored — a 0-element band selecting in
    // 53 ns, caught because 53 ns for 256 elements is not a number a
    // real select can produce
    const bandOf = (cy) => {
      let band = cy.collection();

      for (let k = 0; k < BAND; k++) {
        band = band.union(cy.$id('n' + ((MIDNUM + k) % N)));
      }

      if (band.length !== BAND) {
        console.warn(`  !! select band is ${band.length}, wanted ${BAND}`);
      }

      return band;
    };

    const constCy = gpuInstance();
    const stateCy = gpuInstance();

    constCy.style(GPU_SHEETS[0]);
    stateCy.style(STATE_SHEETS[0]);

    const constBand = bandOf(constCy);
    const stateBand = bandOf(stateCy);

    if (OP == null || 'select'.includes(OP)) {
      group(
        `style: select+unselect ${BAND}-band — constant vs state-case sheet`,
        () => {
          summary(() => {
            bench('constant sheet (skips restyle)', () => {
              constBand.select();
              constBand.unselect();
            });
            bench('state-case sheet (restyles the band)', () => {
              stateBand.select();
              stateBand.unselect();
            });
          });
        },
      );
    }
  }
}

// -- readback -----------------------------------------------------------------
// v4's getters read the *stored channels* — the resolved values the
// renderer draws from — where v3 resolves through its style cache.  Ids
// rotate over a band so nothing is hoisted out of the measured region
// (the core.mjs methodology).
//
// These rows were the finding that became rounds 34.5 and 35: they read
// 13–21× v3 here, which was mostly tsx's `__name` wrapper (this suite
// imports `src/`), and under it a real 5.8× gap that memoizing
// `normalizeProp` took to 2.3×.  **They also all read
// `background-color` and `width`, which were the 4th and 6th cases of
// readProp's switch** — the cheapest end of a dispatch whose cost then
// depended on position, so they understated every other property.  The
// switch is a `Map` since round 35, so position no longer matters; the
// row to watch for the whole surface is the whole-object `style()`
// below, which reads every property of the group.
{
  const K = 8;
  const MASK = K - 1;

  function cmpRead(name, op) {
    if (OP != null && !name.includes(OP)) {
      return;
    }

    const a = v3Instance();
    const b = gpuInstance();

    a.style(V3_SHEETS[0]);
    b.style(GPU_SHEETS[0]);

    const vs = Array.from({ length: K }, (_, k) =>
      a.getElementById('n' + (MIDNUM + k)),
    );
    const gs = Array.from({ length: K }, (_, k) => b.$id('n' + (MIDNUM + k)));
    let i = 0;

    group(name, () => {
      summary(() => {
        bench('v3', () => {
          const k = i++ & MASK;
          return do_not_optimize(op(vs[k]));
        });
        bench('gpu', () => {
          const k = i++ & MASK;
          return do_not_optimize(op(gs[k]));
        });
      });
    });
  }

  cmpRead('style: read one prop (color)', (n) => n.style('background-color'));
  cmpRead('style: read one prop (width)', (n) => n.style('width'));
  cmpRead('style: numericStyle', (n) => n.numericStyle('width'));
  cmpRead('style: renderedStyle (one prop)', (n) => n.renderedStyle('width'));
  cmpRead('style: whole-object style()', (n) => n.style());
}

await finishRun('style');

for (const cy of instances) {
  cy.destroy();
}
