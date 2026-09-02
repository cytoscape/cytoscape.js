/* eslint-disable no-console, no-unused-vars */
/* global $, layoutConfig, SpiralLayout */

// The layout section (round 43.5), carried over from v3/debug/layout.js —
// including its layoutstart/layoutstop timing readout, which is the cheapest
// possible demonstration that those events fire.
//
// v3's page passes only `{ name }` and runs everything at defaults.  Since
// round 114.7 the panel spells four more things, all through the pure
// helpers in layout-config.js: Preset restores the positions the page
// snapshotted after load (`window.initialPositions`); the Animate box
// tweens every layout to its finished positions and the force-only Live
// box streams the sim instead; the Edge types box re-applies the sheet
// with the curve style the layout reads best with (taxi for the layered
// ones); and the spiral example forwards the same options as a built-in.

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

  const liveCheck = $('#layout-live-check');
  const select = $('#layout-select');

  // Live is force's alone: the other layouts have no stream to show
  const syncLive = () => {
    liveCheck.disabled = select.value !== 'force';
  };

  select.addEventListener('change', syncLive);
  syncLive();

  // One bulk sheet apply rather than a per-edge bypass loop, and the
  // restore is exact by construction: the page keeps the sheet it built.
  let overridden = false;

  const applyEdgeTypes = (cy, name) => {
    const wanted = $('#layout-edge-types-check').checked;
    const override = wanted
      ? layoutConfig.edgeOverride(name, {
          arrows: $('#arrows-check').checked,
        })
      : null;

    if (override != null) {
      cy.style(layoutConfig.sheetWith(window.currentStyle, override));
      overridden = true;
    } else if (overridden) {
      cy.style(window.currentStyle);
      overridden = false;
    }
  };

  window.applyEdgeTypes = applyEdgeTypes;

  $('#layout-edge-types-check').addEventListener('change', () => {
    const cy = window.cy;

    if (cy != null && !$('#layout-edge-types-check').checked && overridden) {
      cy.style(window.currentStyle);
      overridden = false;
    }
  });

  $('#layout-button').addEventListener('click', () => {
    const cy = window.cy;

    if (cy == null) {
      return;
    }

    const name = select.value;

    if (name === '') {
      return;
    }

    const layout = cy.layout(
      layoutConfig.layoutOptions(
        name,
        {
          animate: $('#layout-animate-check').checked,
          live: liveCheck.checked,
          seed: $('#seed-input').value,
          positions: window.initialPositions,
        },
        SpiralLayout,
      ),
    );

    applyEdgeTypes(cy, name);
    console.time('layout ' + name);
    layout.run();

    // the discrete built-ins have no promise() (the lifecycle-unification
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
