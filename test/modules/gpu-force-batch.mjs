import { expect } from 'chai';
import {
  BATCH_FRAME_BUDGET_MS,
  MAX_BATCH,
  nextBatch,
} from '../../src/render/gpu-force.mjs';

// Round 119: a force run nobody watches mid-run — `animate: false`, or
// `animate: true`'s tween to the settle — is no longer paced by vsync
// at the live stream's three iterations per frame.  The renderer asks
// `nextBatch` each frame how many iterations to encode: it doubles
// while the device keeps up, halves the frame after the renderer
// skipped a scene pass under its frames-in-flight backpressure, and
// never leaves [stepsPerFrame, MAX_BATCH].  The browser spec measures
// the frames a silent run takes against a live control; this pins the
// rule itself.  Control: with `nextBatch` returning `current`, the
// first three cases fail.

describe('gpu/force: the non-presenting run’s iteration batch (119)', () => {
  it('doubles from stepsPerFrame while the device keeps up, to the cap', () => {
    const seen = [];
    let batch = 3;

    for (let frame = 0; frame < 8; frame++) {
      batch = nextBatch(batch, 3, false);
      seen.push(batch);
    }

    expect(seen).to.deep.equal([6, 12, 24, 48, 64, 64, 64, 64]);
    expect(MAX_BATCH).to.equal(64);
  });

  it('halves when the renderer fell behind, never under stepsPerFrame', () => {
    expect(nextBatch(64, 3, true)).to.equal(32);
    expect(nextBatch(32, 3, true)).to.equal(16);
    expect(nextBatch(6, 3, true)).to.equal(3);
    expect(nextBatch(3, 3, true)).to.equal(3);
    expect(nextBatch(4, 3, true)).to.equal(3);
  });

  it('keeps stepsPerFrame as the floor, and the alpha window as the cap', () => {
    // a run that asked for more per frame starts there and never drops
    // below it
    expect(nextBatch(10, 10, true)).to.equal(10);
    expect(nextBatch(10, 10, false)).to.equal(20);
    // a stepsPerFrame past the window clamps to it — the encode carries
    // one alpha per iteration of the window
    expect(nextBatch(3, 1000, false)).to.equal(MAX_BATCH);
    expect(nextBatch(1000, 1000, true)).to.equal(MAX_BATCH);
    // a degenerate floor is at least one iteration
    expect(nextBatch(0, 0, false)).to.equal(1);
  });

  // 121.5: priced before doubling — the device's time on the last
  // completed batch, over its iterations, is the iteration's cost, and
  // the batch grows no further than the budget buys.  Control: with the
  // price ignored, the first two cases fail.
  it('holds the doubling at what the budget buys of the last batch’s cost per iteration', () => {
    expect(BATCH_FRAME_BUDGET_MS).to.equal(100);
    // 8 ms an iteration (the 25k scene): 12 iterations is the budget,
    // so a batch of 12 stays at 12 rather than ramping to 24
    expect(nextBatch(12, 3, false, 96)).to.equal(12);
    expect(nextBatch(6, 3, false, 48)).to.equal(12);
    // a frame past the budget holds the batch where it is — shrinking
    // is the backpressure's — and the floor holds under any price
    expect(nextBatch(24, 3, false, 200)).to.equal(24);
    expect(nextBatch(3, 3, false, 900)).to.equal(3);
    // the priced batch need not be the current one: a 6-batch that
    // took 48 ms prices an iteration at 8 ms whatever the batch now
    expect(nextBatch(3, 3, false, 48, 6)).to.equal(6);
    expect(nextBatch(12, 3, false, 48, 6)).to.equal(12);
  });

  it('never holds a cheap batch back: 16 ms over a small batch still buys the doubling', () => {
    // 16 ms over 3 prices an iteration at 5.3 ms, and the budget buys
    // 18 of those — the doubling to 6 goes through, and so on up
    let batch = 3;
    const seen = [];

    for (let frame = 0; frame < 6; frame++) {
      batch = nextBatch(batch, 3, false, 16);
      seen.push(batch);
    }

    expect(seen).to.deep.equal([6, 12, 24, 48, 64, 64]);
    // no price yet (the first frames) is the plain doubling
    expect(nextBatch(3, 3, false, 0)).to.equal(6);
    // backpressure still wins: a skipped frame halves whatever the price
    expect(nextBatch(12, 3, true, 20)).to.equal(6);
  });
});
