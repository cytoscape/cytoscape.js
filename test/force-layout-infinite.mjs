import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// Split from test/force-layout.mjs so the two run in parallel: this
// suite waits on a live run in real time, and as one file the pair was
// the longest spec in test:js.

const RING = (n = 12) => {
  const elements = [];

  for (let i = 0; i < n; i++) {
    elements.push({ data: { id: 'n' + i } });
    elements.push({
      data: { id: 'e' + i, source: 'n' + i, target: 'n' + ((i + 1) % n) },
    });
  }

  return elements;
};

// Round 118.3: the infinite run — the live force-directed layout that
// never ends, done so that it costs nothing at rest: the sim ticks only
// while its field moves, a drag pins the grabbed node and heats the
// field, a moved node or an added element does the same, and stop()
// lands the positions as they stand.
describe('gpu/layout: the infinite force run (118.3)', function () {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const snapshot = (cy) =>
    Object.fromEntries(cy.nodes().map((n) => [n.id(), { ...n.position() }]));
  // Wait for the field to move and then hold still for `quietMs`: an
  // infinite run ticks only while its field moves, so a still field is a
  // resting one.  Polling for it, rather than sleeping a fixed time long
  // enough for the slowest machine, took this suite from 12.5 s to 9.5 s.
  const rest = async (cy, quietMs = 200, timeoutMs = 10000) => {
    const deadline = Date.now() + timeoutMs;
    let last = JSON.stringify(snapshot(cy));
    let moved = false;
    let since = Date.now();

    while (Date.now() < deadline) {
      await wait(20);

      const now = JSON.stringify(snapshot(cy));

      if (now !== last) {
        last = now;
        moved = true;
        since = Date.now();
      } else if (moved && Date.now() - since >= quietMs) {
        return;
      }
    }

    throw new Error(
      `the field did not move and come to rest in ${timeoutMs} ms`,
    );
  };
  const start = (cy, extra = {}) => {
    const layout = cy.layout({
      name: 'force',
      seed: 4,
      fit: false,
      infinite: true,
      stepsPerFrame: 6,
      ...extra,
    });
    let settled = false;

    layout.run();
    layout.promise().then(() => {
      settled = true;
    });

    return { layout, isSettled: () => settled };
  };

  it('stays open at rest: the positions stop moving, the promise stays pending, stop() lands them without a fit', async function () {
    const cy = cytoscape({
      elements: RING(),
      headlessWidth: 800,
      headlessHeight: 600,
    });
    const zoom = cy.zoom();
    const { layout, isSettled } = start(cy);

    await rest(cy);

    const a = snapshot(cy);

    await wait(300);

    expect(snapshot(cy)).to.deep.equal(a);
    expect(isSettled()).to.equal(false);

    layout.stop();
    await layout.promise();

    expect(snapshot(cy)).to.deep.equal(a);
    expect(cy.zoom()).to.equal(zoom);
  });

  it('a drag reheats the field: the grabbed node holds where it is put and its neighbours follow', async function () {
    const cy = cytoscape({ elements: RING() });
    const { layout } = start(cy);

    await rest(cy);

    const before = snapshot(cy);
    const n0 = cy.$id('n0');
    const target = { x: before.n0.x + 400, y: before.n0.y };

    n0.emit('grab');
    n0.position({ x: before.n0.x + 200, y: before.n0.y });
    n0.position(target);

    await rest(cy);

    // held: the grabbed node is pinned where the pointer put it while
    // the field reflows around it, and its ring neighbours are pulled
    // after it
    expect(cy.$id('n0').position().x).to.be.closeTo(target.x, 0.01);
    for (const id of ['n1', 'n11']) {
      expect(cy.$id(id).position().x, id).to.be.greaterThan(before[id].x + 50);
    }

    n0.emit('free');
    await rest(cy);

    // released: the node joins the sim again and the ring relaxes —
    // the springs pull it back toward its neighbours, and the field
    // comes to rest somewhere between
    const after = cy.$id('n0').position().x;

    expect(after).to.be.lessThan(target.x - 20);
    expect(after).to.be.greaterThan(before.n0.x + 20);

    layout.stop();
    await layout.promise();
  });

  it('control: after a finished animateLive run the same gesture moves nothing else', async function () {
    const cy = cytoscape({ elements: RING() });

    await cy
      .layout({ name: 'force', seed: 4, fit: false, animateLive: true })
      .run()
      .promise();

    const before = snapshot(cy);
    const n0 = cy.$id('n0');

    n0.emit('grab');
    n0.position({ x: before.n0.x + 400, y: before.n0.y });
    n0.emit('free');

    await wait(300);

    for (const id of ['n1', 'n11']) {
      expect(cy.$id(id).position()).to.deep.equal(before[id]);
    }
  });

  it('an added node and edge are absorbed: the sim is rebuilt on the live graph', async function () {
    const cy = cytoscape({ elements: RING() });
    const { layout, isSettled } = start(cy);

    await rest(cy);

    const n0 = cy.$id('n0').position();

    cy.add([
      { data: { id: 'extra' }, position: { x: n0.x + 2000, y: n0.y + 2000 } },
      { data: { id: 'e-extra', source: 'extra', target: 'n0' } },
    ]);

    await rest(cy);

    const p = cy.$id('extra').position();

    expect(
      Math.hypot(
        p.x - cy.$id('n0').position().x,
        p.y - cy.$id('n0').position().y,
      ),
    ).to.be.lessThan(250);
    expect(isSettled()).to.equal(false);

    layout.stop();
    await layout.promise();
  });

  it('control: a finished run leaves an added node where it was added', async function () {
    const cy = cytoscape({ elements: RING() });

    await cy
      .layout({ name: 'force', seed: 4, fit: false, animateLive: true })
      .run()
      .promise();

    const n0 = cy.$id('n0').position();

    cy.add([
      { data: { id: 'extra' }, position: { x: n0.x + 2000, y: n0.y + 2000 } },
      { data: { id: 'e-extra', source: 'extra', target: 'n0' } },
    ]);

    await wait(300);

    expect(cy.$id('extra').position().x).to.be.closeTo(n0.x + 2000, 0.01);
    expect(cy.$id('extra').position().y).to.be.closeTo(n0.y + 2000, 0.01);
  });

  it("a subset scope ignores an add: the caller's collection is the scope", async function () {
    const cy = cytoscape({ elements: RING() });
    const layout = cy.nodes().slice(0, 6).layout({
      name: 'force',
      seed: 4,
      fit: false,
      infinite: true,
      stepsPerFrame: 6,
    });

    layout.run();
    await rest(cy);

    cy.add([
      { data: { id: 'extra' }, position: { x: 5000, y: 5000 } },
      { data: { id: 'e-extra', source: 'extra', target: 'n0' } },
    ]);

    await wait(600);

    expect(cy.$id('extra').position()).to.deep.equal({ x: 5000, y: 5000 });

    layout.stop();
    await layout.promise();
  });

  it('reheat() returns the layout and wakes an infinite run', async function () {
    const cy = cytoscape({ elements: RING() });
    const { layout } = start(cy);

    await rest(cy);

    expect(layout.reheat()).to.equal(layout);

    layout.stop();
    await layout.promise();
  });

  it('a locked node stays through a drag of its neighbour', async function () {
    const cy = cytoscape({ elements: RING() });

    cy.$id('n6').position({ x: 300, y: 300 }).lock();

    const { layout } = start(cy);

    await rest(cy);

    const n5 = cy.$id('n5');
    const p = n5.position();

    n5.emit('grab');
    n5.position({ x: p.x + 300, y: p.y });
    n5.emit('free');

    await rest(cy);

    expect(cy.$id('n6').position()).to.deep.equal({ x: 300, y: 300 });

    layout.stop();
    await layout.promise();
  });
});
