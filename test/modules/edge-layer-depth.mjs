import { expect } from 'chai';

import { CURVED_EDGE_SHADER } from '../../src/render/shaders.mjs';

/*
Round 88.2: the curved layer strokes write depth — each instance at its own
depth, so a fragment of the same edge fails the 'less' test where an
earlier quad of that edge already drew (v3's stroke-once compositing).  A
layer pass that writes depth sits in the middle of the frame's early-z
scheme, so the bands have to keep four orderings, and nothing but these
constants holds them:

  - the underlay band sits above EDGE_Z, so the lines and heads drawn
    after it (at EDGE_Z, 'less') still pass over it;
  - the overlay band sits under the underlay band, so the overlay passes
    over the underlay where both drew;
  - both sit above NODE_Z, so the node depth prepass still kills layer
    fragments under opaque bodies, and the ghosts and tested node
    underlays drawn after them (at NODE_Z, 'less') still pass;
  - both sit under the clear value, 1 — fringe fragments included, which
    sit half a step deeper than their instance.

A wrong guess is silent: a layer that occludes the lines, or a head that
vanishes under an underlay, still renders a plausible frame.
*/
const constant = (name) => {
  const m = CURVED_EDGE_SHADER.match(
    new RegExp(`const ${name}(?::\\s*\\w+)?\\s*=\\s*([0-9.e-]+)u?;`),
  );

  expect(m, `WGSL constant ${name}`).to.not.equal(null);

  return Number(m[1]);
};

describe('edge layer depth bands (round 88.2)', () => {
  const NODE_Z = constant('NODE_Z');
  const EDGE_Z = constant('EDGE_Z');
  const UNDER = constant('LAYER_Z_UNDERLAY');
  const OVER = constant('LAYER_Z_OVERLAY');
  const STEP = constant('LAYER_Z_STEP');
  const FRINGE = constant('LAYER_Z_FRINGE');
  const SPAN = constant('LAYER_Z_SPAN');
  const lowest = (base) => base - (SPAN - 1) * STEP;

  it('parses every constant it reasons about', () => {
    for (const v of [NODE_Z, EDGE_Z, UNDER, OVER, STEP, FRINGE, SPAN]) {
      expect(Number.isFinite(v) && v > 0).to.equal(true);
    }
  });

  it('keeps the underlay band above EDGE_Z and under the clear value', () => {
    expect(UNDER + FRINGE).to.be.below(1);
    expect(lowest(UNDER)).to.be.above(EDGE_Z);
  });

  it('keeps the overlay band under the underlay band', () => {
    expect(OVER + FRINGE).to.be.below(lowest(UNDER));
  });

  it('keeps both bands above NODE_Z', () => {
    expect(lowest(OVER)).to.be.above(NODE_Z);
    expect(lowest(UNDER)).to.be.above(NODE_Z);
  });

  it('separates every instance, and its fringe, by more than a depth24 unit', () => {
    // two adjacent instances must round to different unorm24 values, or
    // the later edge would fail against the earlier one's fragments; and
    // an instance's fringe (half a step deeper) must stay distinct from
    // both its own body and the next instance's
    const unit = 1 / (2 ** 24 - 1);

    expect(FRINGE / unit).to.be.above(1.5);
    expect((STEP - FRINGE) / unit).to.be.above(1.5);
  });
});
