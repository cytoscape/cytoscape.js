/* eslint-disable no-unused-vars */

// The extension-contract worked example (round 17.5/17.6, rewritten in
// round 114.7, per component and exact in 115.6): a spiral layout as a
// plain class — no registry, passed straight to
// cy.layout({ impl: SpiralLayout }).  Try it with ?layout=spiral.
//
// It is the template an external layout author can crib, so it uses the
// contract the way a built-in does: `nodeSlots()` for what to place,
// `nodeDimensions()` for how big each node is (labels on request),
// `components()` so each connected component gets its own spiral (one
// spiral over everything put every component's nodes along the whole
// curve, and the pack that followed laid out a hundred whole-spiral
// boxes — the 115 finding), `packComponents()` over its own array so the
// spirals sit apart, and `finish()` to land the positions — the bulk
// write on a bare run, the shared finisher (animate / animateFilter /
// transform / spacingFactor, fit / zoom / pan, the lifecycle) when the
// run asks for any of that.  Nothing here writes a position before
// `finish`, which is what lets `animate: true` tween from wherever the
// nodes were.
//
// Options (read off ctx.options): `spiralStep` (the turn pitch and arc
// step, default 14), `avoidOverlap` (default true: the pitch grows to
// the component's largest diagonal — a turn must clear the turn inside
// it whatever angle a box sits at — and each node walks along the curve
// until its box clears the boxes placed before it, exactly, no
// push-apart pass), `avoidOverlapPadding` (default 10),
// `componentSpacing` (default 40), plus the shared plumbing.

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
    const diagonal = (i) =>
      Math.hypot(dims.x2[i] - dims.x1[i], dims.y2[i] - dims.y1[i]);

    // do boxes i (at ax, ay) and j (at bx, by) overlap?
    const overlaps = (i, ax, ay, j, bx, by) =>
      ax + dims.x1[i] < bx + dims.x2[j] &&
      bx + dims.x1[j] < ax + dims.x2[i] &&
      ay + dims.y1[i] < by + dims.y2[j] &&
      by + dims.y1[j] < ay + dims.y2[i];

    // the distance box j needs from box i along the unit direction
    // (ux, uy) to clear it: separated on either axis is enough, so the
    // cheaper axis decides (the rule src/layout/separation.mts spells)
    const separationAlong = (i, j, ux, uy) => {
      let dx = Infinity;
      let dy = Infinity;

      if (ux > 1e-9) {
        dx = (dims.x2[i] - dims.x1[j]) / ux;
      } else if (ux < -1e-9) {
        dx = (dims.x1[i] - dims.x2[j]) / ux;
      }

      if (uy > 1e-9) {
        dy = (dims.y2[i] - dims.y1[j]) / uy;
      } else if (uy < -1e-9) {
        dy = (dims.y1[i] - dims.y2[j]) / uy;
      }

      return Math.max(0, Math.min(dx, dy));
    };

    // one spiral per component, each from its own origin
    const comps = ctx.components();
    const members = [];

    for (let c = 0; c < comps.count; c++) {
      members.push([]);
    }

    for (let i = 0; i < n; i++) {
      members[comps.compOf[i]].push(i);
    }

    for (const list of members) {
      let pitch = step;

      if (avoidOverlap) {
        for (const i of list) {
          pitch = Math.max(pitch, diagonal(i));
        }
      }

      // an Archimedean spiral r = pitch * theta / 2pi: the first node
      // at the centre, each next one further along the curve — one
      // step, or (under avoidOverlap) far enough along that its box
      // clears the previous node along their chord, then nudged on
      // until it clears every box placed on the turn before it
      const k = pitch / (2 * Math.PI);
      const thetaOf = new Float64Array(list.length);
      let theta = 0;

      xy[list[0] * 2] = 0;
      xy[list[0] * 2 + 1] = 0;

      for (let m = 1; m < list.length; m++) {
        const i = list[m];
        const prev = list[m - 1];
        const speed = Math.max(Math.hypot(k * theta, k), k); // |dp/dtheta|
        let need = step;

        if (avoidOverlap) {
          // the chord to the next position runs roughly along the
          // tangent: read the separation along it, then confirm
          const tx = -Math.sin(theta) * k * theta + Math.cos(theta) * k;
          const ty = Math.cos(theta) * k * theta + Math.sin(theta) * k;
          const tl = Math.hypot(tx, ty) || 1;

          need = separationAlong(prev, i, tx / tl, ty / tl);
        }

        theta += need / speed;

        let x = k * theta * Math.cos(theta);
        let y = k * theta * Math.sin(theta);

        if (avoidOverlap) {
          // the placed boxes within reach: the last turn and a bit
          let guard = 0;

          for (let j = m - 1; j >= 0 && guard < 10000; j--) {
            const q = list[j];
            const qx = xy[q * 2];
            const qy = xy[q * 2 + 1];

            if (theta - thetaOf[j] > 4 * Math.PI) {
              break; // more than two turns back: out of reach for good
            }

            if (Math.hypot(qx - x, qy - y) > diagonal(i) + diagonal(q)) {
              continue;
            }

            if (overlaps(i, x, y, q, qx, qy)) {
              // nudge along the curve by a tenth of the box and re-scan
              theta += diagonal(i) / 10 / Math.max(k * theta, k);
              x = k * theta * Math.cos(theta);
              y = k * theta * Math.sin(theta);
              j = m; // restart against every reachable box
              guard++;
            }
          }
        }

        thetaOf[m] = theta;
        xy[i * 2] = x;
        xy[i * 2 + 1] = y;
      }
    }

    // the spirals would sit on one another: pack them (body boxes) in
    // the local array, before anything lands
    ctx.packComponents(options.componentSpacing ?? 40, { positions: xy });

    ctx.finish(slots, xy);
  }
};

// see debug/fixtures.js — the module suite loads this as a script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpiralLayout;
}
