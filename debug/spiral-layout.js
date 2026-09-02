/* eslint-disable no-unused-vars */

// The extension-contract worked example (round 17.5/17.6, rewritten in
// round 114.7): a spiral layout as a plain class — no registry, passed
// straight to cy.layout({ impl: SpiralLayout }).  Try it with
// ?layout=spiral.
//
// It is the template an external layout author can crib, so it uses the
// contract the way a built-in does: `nodeSlots()` for what to place,
// `nodeDimensions()` for how big each node is (labels included by
// default), `packComponents()` over its own array so disconnected
// components do not interleave along one spiral, and `finish()` to land
// the positions — the bulk write on a bare run, the shared finisher
// (animate / animateFilter / transform / spacingFactor, fit / zoom /
// pan, the lifecycle) when the run asks for any of that.  Nothing here
// writes a position before `finish`, which is what lets `animate: true`
// tween from wherever the nodes were.
//
// Options (read off ctx.options): `spiralStep` (the turn pitch and arc
// step, default 14), `avoidOverlap` (default true: the pitch grows to the
// widest node and the arc step to each neighbouring pair's extents, so
// no two boxes touch — constructively, no push-apart pass),
// `avoidOverlapPadding` (default 10), `componentSpacing` (default 40),
// plus the shared plumbing.

var SpiralLayout = class SpiralLayout {
  run(ctx) {
    const options = ctx.options;
    const slots = ctx.nodeSlots();
    const n = slots.length;
    const xy = new Float32Array(n * 2);

    if (n === 0) {
      ctx.finish(slots, xy);

      return;
    }

    const step = Number(options.spiralStep || 14);
    const avoidOverlap = options.avoidOverlap !== false;
    const dims = ctx.nodeDimensions(slots, {
      padding: avoidOverlap ? (options.avoidOverlapPadding ?? 10) : 0,
    });
    // a box's footprint is its diagonal: two boxes whose centres are at
    // least the mean of their diagonals apart cannot overlap
    const ext = (i) =>
      Math.hypot(dims.x2[i] - dims.x1[i], dims.y2[i] - dims.y1[i]);
    let pitch = step;

    if (avoidOverlap) {
      for (let i = 0; i < n; i++) {
        pitch = Math.max(pitch, ext(i));
      }
    }

    // an Archimedean spiral r = pitch * theta / 2pi, walked by arc length:
    // node 0 at the centre, each next node one step (or the two
    // neighbours' mean extent) further along the curve, so consecutive
    // nodes never touch and successive turns sit a pitch apart
    let theta = 0;

    for (let i = 1; i < n; i++) {
      const need = avoidOverlap ? (ext(i - 1) + ext(i)) / 2 : step;
      const r0 = (pitch * theta) / (2 * Math.PI);

      theta += need / Math.max(r0, pitch / (2 * Math.PI));

      const r = (pitch * theta) / (2 * Math.PI);

      xy[i * 2] = Math.cos(theta) * r;
      xy[i * 2 + 1] = Math.sin(theta) * r;
    }

    // disconnected components would interleave along one spiral: pack
    // them (body boxes) in the local array, before anything lands
    ctx.packComponents(options.componentSpacing ?? 40, { positions: xy });

    ctx.finish(slots, xy);
  }
};

// see debug/fixtures.js — the module suite loads this as a script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpiralLayout;
}
