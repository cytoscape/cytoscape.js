import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

/*
Round 24.3: animation controls — pause()/resume()/reverse() on the
Animation handle, plus the read-only progress() and paused()
introspection (progress is a getter only — no scrubbing; v3's
apply/applying stay out).

Semantics (the fourth-sitting calls):
- pause freezes elapsed time in place: values hold, the promise stays
  pending, and ticks during the pause are excluded from the timeline
  (resume shifts the start clock by the paused span).
- reverse swaps the tween's ends and remaps elapsed so the current
  value is continuous (exactly so for linear and other point-symmetric
  easings — v3's start/end swap had the same rule); reversing an
  animation still in its delay completes at the captured start state.
- a paused GPU tween settles its lease (the device is released, the
  CPU holds the value it reached) and re-acquires on resume.
- a paused animation still owns its channels: the round-21 eviction
  stops it like any running animation.

Ticks drive deterministically via cy._animations.tick(now).
*/

describe('gpu/animation: controls (round 24.3)', function () {
  const makeCy = () =>
    cytoscape({
      elements: [{ data: { id: 'a' }, position: { x: 0, y: 0 } }],
    });

  const x = (cy) =>
    cy._store.column('node.position')[cy._store.lookup('a').slot * 2];
  const drive = (cy, ...times) => {
    for (const t of times) {
      cy._animations.tick(t);
    }
  };

  describe('pause/resume', function () {
    it('pause freezes values; resume excludes the paused span from the timeline', function () {
      const cy = makeCy();
      const ani = cy.$id('a').animation({
        position: { x: 100, y: 0 },
        duration: 100,
        easing: 'linear',
      });

      ani.play();
      drive(cy, 0, 50);
      expect(x(cy)).to.be.closeTo(50, 1e-4);

      ani.pause();
      expect(ani.paused()).to.equal(true);
      expect(ani.playing()).to.equal(false);

      drive(cy, 80, 150); // 100 ms pass while paused
      expect(x(cy)).to.be.closeTo(50, 1e-4); // frozen

      ani.resume();
      expect(ani.paused()).to.equal(false);

      drive(cy, 175); // 25 ms after resume → t = 0.75
      expect(x(cy)).to.be.closeTo(75, 1e-4);

      drive(cy, 200);
      expect(x(cy)).to.equal(100);
    });

    it('the promise stays pending across a pause and resolves on completion', async function () {
      const cy = makeCy();
      const ani = cy.$id('a').animation({
        position: { x: 100, y: 0 },
        duration: 100,
        easing: 'linear',
      });
      let resolved = false;

      const p = ani.play().then(() => {
        resolved = true;
      });

      drive(cy, 0, 50);
      ani.pause();
      drive(cy, 500);
      await Promise.resolve();
      expect(resolved).to.equal(false);

      ani.resume();
      drive(cy, 550);
      await p;
      expect(resolved).to.equal(true);
      expect(x(cy)).to.equal(100);
    });

    it('stop() works on a paused animation (freeze in place)', function () {
      const cy = makeCy();
      const ani = cy.$id('a').animation({
        position: { x: 100, y: 0 },
        duration: 100,
        easing: 'linear',
      });

      ani.play();
      drive(cy, 0, 40);
      ani.pause();
      ani.stop();

      drive(cy, 200);
      expect(x(cy)).to.be.closeTo(40, 1e-4); // stopped where paused
      expect(cy._animations.active()).to.equal(false);
    });

    it('a paused animation still owns its channels: an overlapping start evicts it', async function () {
      const cy = makeCy();
      const ani = cy.$id('a').animation({
        position: { x: 100, y: 0 },
        duration: 100,
        easing: 'linear',
      });
      const p = ani.play();

      drive(cy, 0, 50);
      ani.pause();

      cy.$id('a').animate({
        position: { x: 0, y: 50 },
        duration: 100,
        easing: 'linear',
      });

      await p; // evicted in place — the promise resolved

      drive(cy, 60, 160);
      expect(x(cy)).to.equal(0); // the new animation ran from the frozen x=50
      expect(
        cy._store.column('node.position')[cy._store.lookup('a').slot * 2 + 1],
      ).to.equal(50);
    });
  });

  describe('reverse', function () {
    it('reverse swaps the ends with a continuous value (linear)', function () {
      const cy = makeCy();
      const ani = cy.$id('a').animation({
        position: { x: 100, y: 0 },
        duration: 100,
        easing: 'linear',
      });

      ani.play();
      drive(cy, 0, 60);
      expect(x(cy)).to.be.closeTo(60, 1e-4);

      ani.reverse();

      drive(cy, 70); // 10 ms later, heading back
      expect(x(cy)).to.be.closeTo(50, 1e-4);

      drive(cy, 120); // t = 1 of the reversed run
      expect(x(cy)).to.equal(0);
    });

    it('the reversed run completes normally (promise resolves at the start values)', async function () {
      const cy = makeCy();
      const ani = cy.$id('a').animation({
        position: { x: 100, y: 0 },
        duration: 100,
        easing: 'linear',
      });
      const p = ani.play();

      drive(cy, 0, 60);
      ani.reverse();
      drive(cy, 120);

      await p;
      expect(x(cy)).to.equal(0);
      expect(cy._animations.active()).to.equal(false);
    });

    it('reversing during the delay completes at the captured start state', function () {
      const cy = makeCy();
      const ani = cy.$id('a').animation({
        position: { x: 100, y: 0 },
        duration: 100,
        delay: 200,
        easing: 'linear',
      });

      ani.play();
      drive(cy, 0, 50); // still in the delay
      expect(x(cy)).to.equal(0);

      ani.reverse();
      drive(cy, 60);

      expect(x(cy)).to.equal(0); // never left the start
      expect(cy._animations.active()).to.equal(false);
    });
  });

  describe('progress()', function () {
    it('reads 0 before, elapsed fraction mid-flight, frozen while paused, 1 when done', function () {
      const cy = makeCy();
      const ani = cy.$id('a').animation({
        position: { x: 100, y: 0 },
        duration: 100,
        easing: 'linear',
      });

      expect(ani.progress()).to.equal(0);

      ani.play();
      drive(cy, 0, 25);
      expect(ani.progress()).to.be.closeTo(0.25, 1e-6);

      ani.pause();
      drive(cy, 90);
      expect(ani.progress()).to.be.closeTo(0.25, 1e-6); // frozen

      ani.resume();
      drive(cy, 140); // 50 ms after resume → t = 0.75
      expect(ani.progress()).to.be.closeTo(0.75, 1e-6);

      drive(cy, 200);
      expect(ani.progress()).to.equal(1);
    });
  });

  describe('the GPU lease (mock sink)', function () {
    const setup = () => {
      const cy = makeCy();
      const registered = [];
      const unregistered = [];

      cy._animations.attachDriver({
        register: (id, writes, start) => registered.push({ id, writes, start }),
        unregister: (id) => unregistered.push(id),
      });

      return { cy, registered, unregistered };
    };

    it('pause settles the lease at the value reached; resume re-acquires with a shifted clock', function () {
      const { cy, registered, unregistered } = setup();
      const ani = cy.$id('a').animation({
        position: { x: 100, y: 0 },
        duration: 100,
        easing: 'linear',
      });

      ani.play();
      drive(cy, 0);
      expect(registered).to.have.length(1);

      drive(cy, 50);
      ani.pause();

      // the device released the columns and the CPU holds the mid value
      expect(unregistered).to.deep.equal([registered[0].id]);
      expect(x(cy)).to.be.closeTo(50, 1e-4);

      drive(cy, 150);
      ani.resume();
      drive(cy, 160);

      // re-registered; the shifted start keeps the timeline continuous
      expect(registered).to.have.length(2);
      expect(160 - registered[1].start).to.be.closeTo(60, 1e-6);

      drive(cy, 200); // t = 1 on the shifted clock → settle
      expect(x(cy)).to.equal(100);
      expect(cy._animations.active()).to.equal(false);
    });

    it('reverse releases the lease and re-registers the swapped writes', function () {
      const { cy, registered, unregistered } = setup();
      const ani = cy.$id('a').animation({
        position: { x: 100, y: 0 },
        duration: 100,
        easing: 'linear',
      });

      ani.play();
      drive(cy, 0, 60);
      ani.reverse();

      expect(unregistered).to.have.length(1);

      drive(cy, 70);
      expect(registered).to.have.length(2);

      // the re-registered write runs toward the original start
      const w = registered[1].writes.find((w) => w.column === 'node.position');

      expect(w.data[2]).to.equal(0); // to-x is the captured start
      expect(w.data[0]).to.equal(100); // from-x is the old target

      drive(cy, 200);
      expect(x(cy)).to.equal(0);
    });
  });

  describe('the viewport', function () {
    it('pause/resume and reverse work on viewport animations', function () {
      const cy = makeCy();
      const ani = cy.animation({
        pan: { x: 100, y: 0 },
        duration: 100,
        easing: 'linear',
      });

      ani.play();
      drive(cy, 0, 50);
      expect(cy.pan().x).to.be.closeTo(50, 1e-4);

      ani.pause();
      drive(cy, 150);
      expect(cy.pan().x).to.be.closeTo(50, 1e-4);

      ani.resume();
      drive(cy, 175);
      expect(cy.pan().x).to.be.closeTo(75, 1e-4);

      ani.reverse(); // heading back to pan x = 0
      drive(cy, 250);
      expect(cy.pan().x).to.equal(0);
      expect(cy._animations.active()).to.equal(false);
    });
  });
});
