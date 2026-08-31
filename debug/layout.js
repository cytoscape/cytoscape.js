/* eslint-disable no-console, no-unused-vars */
/* global $ */

// The layout section (round 43.5), carried over from v3/debug/layout.js —
// including its layoutstart/layoutstop timing readout, which is the cheapest
// possible demonstration that those events fire.
//
// v3's page passes only `{ name }` and runs everything at defaults.  The
// animate toggle forwards to every named layout (87.4): the discrete
// layouts tween through the finisher (87.3), and force streams its run
// live — the integrator runs on the GPU for both animate values (87.2).
// The seed stays force-only: a seeded CPU run is bit-reproducible
// (round 18).

(function () {
  window.onCy((cy) => {
    let start = 0;

    cy.on('layoutstart', () => {
      start = performance.now();
    });
    cy.on('layoutstop', () => {
      const ms = performance.now() - start;

      $('#layout-time').textContent = ms.toFixed(0) + ' ms';
    });
  });

  $('#layout-button').addEventListener('click', () => {
    const cy = window.cy;

    if (cy == null) {
      return;
    }

    const name = $('#layout-select').value;

    if (name === '') {
      return;
    }

    let layout;

    if (name === 'spiral') {
      // the round-17 extension contract: a plain class, no registry
      layout = cy.layout({ impl: window.SpiralLayout });
    } else {
      const options = { name };

      // 87.4: animate forwards for every named layout; seed stays
      // force-only
      options.animate = $('#layout-animate-check').checked;

      if (name === 'force') {
        options.seed = parseInt($('#seed-input').value || '1', 10);
      }

      layout = cy.layout(options);
    }

    console.time('layout ' + name);
    layout.run();

    // the six built-ins have no promise() (the lifecycle-unification
    // hook) — the old unguarded chain threw uncaught on every Apply
    const done =
      typeof layout.promise === 'function'
        ? layout.promise()
        : Promise.resolve();

    done
      .then(() => console.timeEnd('layout ' + name))
      .catch((err) => console.error(err));
  });
})();
