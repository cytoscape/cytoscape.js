import { expect } from 'chai';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import cytoscape from '../../src/index.mjs';
import {
  _algoWorkersStats,
  _resetAlgoWorkers,
} from '../../src/algorithms/algo-workers.mjs';

/*
Round 74.4: the worker pool over time.

A pool is a process-wide singleton that outlives every instance, so
the questions a soak asks are lifecycle ones: does repeated use grow
the pool or pin instances; does a reset really let go; do two
instances' runs interleave without touching each other; and does a
process that used the pool exit on its own — the `unref()` claim,
which 2026-09-18 found wrong twice while writing this round (a
listener added after `unref()` re-refs the port; an unref'ed worker
does not keep the loop alive for a pending reply), asserted here
rather than believed.

Reachability is the gate, as in `lifecycle.mjs`: `WeakRef`s to
destroyed instances that ran on the pool must clear under forced
collection, which is the property "the pool holds no instance" states.
Runs under `--expose-gc` (`npm run test:soak`).
*/

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

const ring = (n) => {
  const els = [];

  for (let i = 0; i < n; i++) {
    els.push({ data: { id: 'n' + i } });
  }

  for (let i = 0; i < n; i++) {
    els.push({
      data: { source: 'n' + i, target: 'n' + ((i + 1) % n), w: 1 + (i % 5) },
    });

    if (i % 3 === 0) {
      els.push({
        data: { source: 'n' + i, target: 'n' + ((i * 13 + 29) % n), w: 2 },
      });
    }
  }

  return els;
};

const weight = (e) => e.data('w');

const aliveOf = (refs) =>
  refs.filter((ref) => ref.deref() !== undefined).length;

const tick = () => new Promise((r) => setTimeout(r, 0));

const collect = async (refs = []) => {
  let alive = -1;

  for (let i = 0; i < 10; i++) {
    global.gc();
    await tick();

    const now = aliveOf(refs);

    await tick();

    if (i >= 2 && now === alive) break;
    alive = now;
  }
};

describe('soak: the algorithm worker pool', () => {
  beforeEach(() => {
    _resetAlgoWorkers(2);
  });

  after(() => {
    _resetAlgoWorkers();
  });

  it('has a working reachability probe (the control)', async () => {
    const dropped = [];
    const held = [];

    for (let i = 0; i < 20; i++) {
      held.push(cytoscape({ elements: ring(20) }));
      dropped.push(new WeakRef(cytoscape({ elements: ring(20) })));
    }

    await collect(dropped);
    expect(aliveOf(dropped), 'gc is not running').to.be.at.most(1);
    expect(held.length).to.equal(20);
    held.forEach((cy) => cy.destroy());
  });

  it('repeated runs grow neither the pool nor the reachable instances', async () => {
    const refs = [];
    const before = _algoWorkersStats();

    // in a helper, so no frame of this test still holds the last
    // instance when collection is forced
    const runOne = async () => {
      const cy = cytoscape({ elements: ring(300) });
      const r = await cy
        .elements()
        .betweennessCentrality({ weight, executor: 'workers' });

      expect(r.betweenness(cy.nodes()[1])).to.be.a('number');
      refs.push(new WeakRef(cy));
      cy.destroy();
    };

    for (let i = 0; i < 12; i++) {
      await runOne();
    }

    const after = _algoWorkersStats();

    expect(after.spawns).to.equal(before.spawns + 1);
    expect(after.workers).to.equal(2);
    expect(after.runs).to.equal(before.runs + 12);

    await collect(refs);
    expect(aliveOf(refs), 'the pool pinned a destroyed instance').to.equal(0);
  });

  it('a reset drops the pool, and the next run spawns afresh', async () => {
    const cy = cytoscape({ elements: ring(300) });

    await cy.elements().closenessCentralityNormalized({ executor: 'workers' });
    expect(_algoWorkersStats().workers).to.equal(2);

    _resetAlgoWorkers(1);
    expect(_algoWorkersStats().workers).to.equal(0);

    const before = _algoWorkersStats().spawns;

    await cy.elements().closenessCentralityNormalized({ executor: 'workers' });
    expect(_algoWorkersStats().spawns).to.equal(before + 1);
    expect(_algoWorkersStats().workers).to.equal(1);
    cy.destroy();
  });

  it('two instances interleaving runs stay isolated', async () => {
    const a = cytoscape({ elements: ring(300) });
    const b = cytoscape({ elements: ring(280) });
    const [ra, rb, ca, cb] = await Promise.all([
      a.elements().betweennessCentrality({ weight, executor: 'workers' }),
      b.elements().betweennessCentrality({ weight, executor: 'workers' }),
      a.elements().betweennessCentrality({ weight, executor: 'cpu' }),
      b.elements().betweennessCentrality({ weight, executor: 'cpu' }),
    ]);

    a.nodes().forEach((n) => {
      expect(ra.betweenness(n)).to.be.closeTo(ca.betweenness(n), 1e-9);
    });
    b.nodes().forEach((n) => {
      expect(rb.betweenness(n)).to.be.closeTo(cb.betweenness(n), 1e-9);
    });

    // and the pool served both without growing
    expect(_algoWorkersStats().workers).to.equal(2);
    a.destroy();
    b.destroy();
  });

  it('a child process exits on its own after a workers run (the unref claim)', function () {
    const script = `
      import cytoscape from '${ROOT}/src/index.mjs';
      const els = [];
      for (let i = 0; i < 300; i++) els.push({ data: { id: 'n' + i } });
      for (let i = 0; i < 300; i++) els.push({ data: { source: 'n' + i, target: 'n' + ((i + 1) % 300), w: 1 + (i % 5) } });
      const cy = cytoscape({ elements: els });
      const r = await cy.elements().betweennessCentrality({ weight: (e) => e.data('w'), executor: 'workers' });
      console.log('ran', r.betweenness(cy.nodes()[1]));
      // no _resetAlgoWorkers(), no process.exit(): the pool must let go
    `;
    const child = spawnSync(
      process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', script],
      { cwd: ROOT, encoding: 'utf8', timeout: 60000 },
    );

    expect(child.error, 'the child hung: the pool held the process open').to.be
      .undefined;
    expect(child.status, child.stderr).to.equal(0);
    expect(child.stdout).to.match(/^ran \d/);
  });
});
