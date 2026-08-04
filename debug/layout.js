/* eslint-disable no-console, no-unused-vars */
/* global $ */

// The layout section (round 43.5), carried over from v3/debug/layout.js —
// including its layoutstart/layoutstop timing readout, which is the cheapest
// possible demonstration that those events fire.
//
// v3's page passes only `{ name }` and runs everything at defaults.  v4's
// `force` is worth more than that, so the animate toggle and the seed are
// wired: a seeded CPU run is bit-reproducible (round 18), while an animated
// run on a flat rendered graph hands the integrator to the GPU.

(function(){

  window.onCy(cy => {
    let start = 0;

    cy.on('layoutstart', () => { start = performance.now(); });
    cy.on('layoutstop', () => {
      const ms = performance.now() - start;

      $('#layout-time').textContent = ms.toFixed(0) + ' ms';
    });
  });

  $('#layout-button').addEventListener('click', () => {
    const cy = window.cy;

    if(cy == null) { return; }

    const name = $('#layout-select').value;

    if(name === '') { return; }

    if(name === 'spiral') {
      // the round-17 extension contract: a plain class, no registry
      cy.layout({ impl: window.SpiralLayout }).run();

      return;
    }

    const options = { name };

    if(name === 'force') {
      options.animate = $('#layout-animate-check').checked;
      options.seed = parseInt($('#seed-input').value || '1', 10);
    }

    console.time('layout ' + name);
    cy.layout(options).run().promise()
      .then(() => console.timeEnd('layout ' + name))
      .catch(err => console.error(err));
  });

})();
