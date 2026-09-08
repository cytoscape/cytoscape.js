import { expect } from 'chai';
import { MAX_BATCH, nextBatch } from '../../src/render/gpu-force.mjs';

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
});
