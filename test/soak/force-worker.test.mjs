import { expect } from 'chai';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import cytoscape from '../../src/index.mjs';
import {
  _forceWorkerStats,
  _resetForceWorker,
} from '../../src/layout/force-remote.mjs';

/*
Round 129.3: the force sim worker over time.

One worker per process, kept for the session: repeated runs must
spawn nothing more, and the instances that ran on it must collect once
destroyed — reachability is the gate (`lifecycle.mjs`'s rule; the
`runOne` shape keeps no frame of this file holding the last instance).
A reset drops the worker and the next run spawns afresh; a run open
under the reset closes rather than hanging.  And a child process that
ran a worker sim exits on its own — the `unref()` claim, asserted
rather than believed (the round-74 lesson).  Runs under `--expose-gc`
(`npm run test:soak`).
*/

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
// a src module as a quoted file URL, for a child's inline script: a bare
// `D:\…` path reads as a URL with scheme `d:` (round 151)
const srcUrl = (file) =>
  JSON.stringify(pathToFileURL(resolve(ROOT, 'src', file)).href);

const RING = (n = 24) => {
  const elements = [];

  for (let i = 0; i < n; i++) {
    elements.push({ data: { id: 'n' + i } });
    elements.push({
      data: { id: 'e' + i, source: 'n' + i, target: 'n' + ((i + 1) % n) },
    });
  }

  return elements;
};

const aliveOf = (refs) =>
  refs.filter((ref) => ref.deref() !== undefined).length;

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

const collect = async (refs = []) => {
  let alive = -1;

  for (let i = 0; i < 10; i++) {
    global.gc();
    await tick();

    const now = aliveOf(refs);

    await tick();

    if (i >= 2 && now === alive && now === 0) break;
    alive = now;
  }
};

describe('soak: the force sim worker (round 129.3)', () => {
  before(() => {
    _resetForceWorker();
  });

  after(() => {
    _resetForceWorker();
  });

  it('repeated runs spawn one worker, and the instances collect', async () => {
    const refs = [];
    const before = _forceWorkerStats();

    const runOne = async () => {
      const cy = cytoscape({ elements: RING() });
      const layout = cy.layout({
        name: 'force',
        seed: 4,
        fit: false,
        executor: 'workers',
      });

      layout.run();
      await layout.promise();
      expect(cy.$id('n1').position().x).to.be.a('number');
      refs.push(new WeakRef(cy));
      refs.push(new WeakRef(layout));
      cy.destroy();
    };

    for (let i = 0; i < 12; i++) {
      await runOne();
    }

    const after = _forceWorkerStats();

    expect(after.spawns).to.equal(before.spawns + 1);
    expect(after.runs).to.equal(before.runs + 12);

    await collect(refs);
    expect(aliveOf(refs), 'the worker pinned a destroyed instance').to.equal(0);
  });

  it('a reset drops the worker, closes an open run, and the next run spawns afresh', async () => {
    const cy = cytoscape({ elements: RING() });
    const open = cy.layout({
      name: 'force',
      seed: 4,
      fit: false,
      executor: 'workers',
      animateLive: true,
      iterations: 100000,
      threshold: 0,
      decay: 0.0005,
    });

    open.run();
    await tick(100);

    const spawns = _forceWorkerStats().spawns;

    _resetForceWorker();

    // the run closes (its worker is gone): the promise settles rather
    // than hanging — resolved, with the positions as last seen
    // a watchdog that is cleared, not raced: a pending 5 s timer held the
    // process open ~4 s past its last test
    let watchdog;

    await Promise.race([
      open.promise(),
      new Promise((_, reject) => {
        watchdog = setTimeout(
          () => reject(new Error('the reset left the run pending')),
          5000,
        );
      }),
    ]).finally(() => clearTimeout(watchdog));

    const next = cy.layout({
      name: 'force',
      seed: 4,
      fit: false,
      executor: 'workers',
    });

    next.run();
    await next.promise();
    expect(_forceWorkerStats().spawns).to.equal(spawns + 1);
    cy.destroy();
  });

  it('a child process exits on its own after a worker run (the unref claim)', function () {
    const script = `
      import cytoscape from ${srcUrl('index.mjs')};
      import { _setForceWorkerLoader } from ${srcUrl('layout/force-remote.mjs')};
      if (process.versions.bun == null) {
        _setForceWorkerLoader((url) => "import('tsx/esm/api').then(({ register }) => { register(); return import(" + url + "); })");
      }
      const els = [];
      for (let i = 0; i < 40; i++) els.push({ data: { id: 'n' + i } });
      for (let i = 0; i < 40; i++) els.push({ data: { source: 'n' + i, target: 'n' + ((i + 1) % 40) } });
      const cy = cytoscape({ elements: els });
      const layout = cy.layout({ name: 'force', seed: 4, fit: false, executor: 'workers' });
      layout.run();
      await layout.promise();
      console.log('ran ' + cy.nodes()[1].position().x);
      // no _resetForceWorker(), no process.exit(): the worker must let go
    `;
    const loaderArgs = process.versions.bun == null ? ['--import', 'tsx'] : [];
    for (const forceColor of ['0', '1']) {
      const child = spawnSync(
        process.execPath,
        [...loaderArgs, '--input-type=module', '-e', script],
        {
          cwd: ROOT,
          encoding: 'utf8',
          timeout: 60000,
          env: { ...process.env, FORCE_COLOR: forceColor },
        },
      );

      expect(child.error, 'the child hung: the worker held the process open').to
        .be.undefined;
      expect(child.status, child.stderr).to.equal(0);
      expect(child.stdout).to.match(/^ran -?\d/);
    }
  });
});
