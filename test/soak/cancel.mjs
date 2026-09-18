import { expect } from 'chai';
import cytoscape from '../../src/index.mjs';

/*
Round 128.4: the in-flight registry over time.

`cy._inflight` holds every pending algorithm handle and every open
layout run so `destroy()` can cancel them; `cy._layoutRuns` maps a
layout object to its open run.  Both must empty on settle — a run
that finishes, one that is stopped, one that is cancelled — or the
registry becomes the one place a layout object is pinned for the life
of the instance.  Reachability is the gate (`lifecycle.mjs`'s rule):
`WeakRef`s to layout objects whose runs ended must clear under forced
collection.  Runs under `--expose-gc` (`npm run test:soak`).
*/

const RING = (n = 40) => {
  const elements = [];

  for (let i = 0; i < n; i++) {
    elements.push({ data: { id: 'n' + i }, position: { x: 7 * i, y: 3 * i } });
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

    if (i >= 2 && now === alive) break;
    alive = now;
  }
};

describe('soak: the in-flight registry (round 128)', () => {
  it('has a working reachability probe (the control)', async () => {
    const held = [];
    const heldRefs = [];
    const droppedRefs = [];

    for (let i = 0; i < 4; i++) {
      const kept = { i };

      held.push(kept);
      heldRefs.push(new WeakRef(kept));
      droppedRefs.push(new WeakRef({ i }));
    }

    await collect([...heldRefs, ...droppedRefs]);
    expect(aliveOf(heldRefs)).to.equal(4);
    expect(aliveOf(droppedRefs)).to.equal(0);
    expect(held.length).to.equal(4);
  });

  it('finished, stopped and cancelled runs all leave both registries, and their layouts collect', async () => {
    const cy = cytoscape({
      elements: RING(),
      headlessWidth: 800,
      headlessHeight: 600,
    });
    const refs = [];

    // one run per call: a loop body's bindings in this frame would pin
    // the last iteration's layout until the frame ends
    const runOne = async (kind, i) => {
      let layout;

      if (kind === 'finish') {
        layout = cy.layout({ name: i % 2 ? 'grid' : 'circle', fit: false });
        layout.run();
      } else if (kind === 'tween-cancel') {
        layout = cy.layout({
          name: 'circle',
          animate: true,
          animationDuration: 100,
          fit: false,
        });
        layout.run();
        await tick(5);
        layout.cancel();
      } else if (kind === 'force-stop') {
        layout = cy.layout({
          name: 'force',
          seed: i,
          fit: false,
          animateLive: true,
          stepsPerFrame: 1,
          iterations: 100000,
          threshold: 0,
          decay: 0.0005,
        });
        layout.run();
        await tick(5);
        layout.stop();
        await layout.promise();
      } else {
        layout = cy.layout({
          name: 'force',
          seed: i,
          fit: false,
          animateLive: true,
          stepsPerFrame: 1,
          iterations: 100000,
          threshold: 0,
          decay: 0.0005,
        });
        layout.run();
        await tick(5);
        layout.cancel();
        await layout.promise().catch(() => undefined);
      }

      refs.push(new WeakRef(layout));
    };

    for (let i = 0; i < 6; i++) {
      await runOne('finish', i);
      await runOne('tween-cancel', i);
      await runOne('force-stop', i);
      await runOne('force-cancel', i);
    }

    // the algorithm side: pending handles leave on settle and on cancel
    const runs = [];

    for (let i = 0; i < 6; i++) {
      const run = cy.elements().pageRank({ executor: 'cpu' });

      runs.push(run);
      await run;
    }

    expect(cy._inflight.size).to.equal(0);
    expect(cy._layoutRuns.size).to.equal(0);

    await collect(refs);
    expect(aliveOf(refs), 'a settled run pinned its layout').to.equal(0);
    cy.destroy();
  });

  it('destroy() empties a registry with runs still open', async () => {
    const cy = cytoscape({
      elements: RING(),
      headlessWidth: 800,
      headlessHeight: 600,
    });

    cy.layout({
      name: 'circle',
      animate: true,
      animationDuration: 200,
      fit: false,
    }).run();
    cy.layout({
      name: 'force',
      seed: 1,
      fit: false,
      animateLive: true,
      stepsPerFrame: 1,
      iterations: 100000,
      threshold: 0,
      decay: 0.0005,
    }).run();
    await tick(10);

    expect(cy._inflight.size).to.equal(2);

    cy.destroy();

    expect(cy._inflight.size).to.equal(0);
    expect(cy._layoutRuns.size).to.equal(0);
  });
});
