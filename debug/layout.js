/* eslint-disable no-console, no-unused-vars */
/* global $, layoutConfig, layoutOptionsPanel, airiness, SpiralLayout */

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
// Round 118.4 added the force-only Infinite box (`infinite` — the run
// keeps going at no cost at rest, and a dragged node reflows its
// neighbourhood; Stop ends it, Reheat wakes it) and the force overlap
// mechanism select (`avoidOverlap: 'settle' | 'sim' | 'both'`, pinned to
// `sim` under Infinite, where there is no settle).
//
// Round 125.10 made the page the layout audit's instrument: a *live*
// spacing slider that rescales the current positions about their
// centre as it is dragged (the existing Spacing slider is a
// spacingFactor for the next run), so a sitting finds the right
// spacing by eye and reads the factor off; and an airiness readout —
// the nearest-box and edge gaps of debug/airiness.js for the positions
// as they stand, refreshed at every layoutstop and every slider move.
// Round 125.11 added the options panel: every option the selected
// layout takes that the boxes do not already spell, generated from
// debug/layout-options.js, merged over the boxes' options on Apply
// (only the fields that differ from the library's default are sent),
// and the `cy.layout({...})` call the panel spells, as a readout.

(function () {
  // -- the live spacing slider and the airiness readout (125.10) --

  const liveSpacing = $('#live-spacing-input');
  const liveSpacingValue = $('#live-spacing-value');
  const readout = $('#airiness-readout');
  // the positions the slider scales: a snapshot at each layoutstop
  let base = {};

  const measure = (cy) => {
    const labels = $('#layout-overlap-labels-check').checked;

    readout.textContent = airiness.format(airiness.airiness(cy, { labels }));
  };

  window.measureAiriness = measure;

  const rebase = (cy) => {
    base = layoutConfig.snapshotPositions(cy);
    liveSpacing.value = '1';
    liveSpacingValue.textContent = '1.00';
    measure(cy);
  };

  // a drag at 60 Hz over the 19.6k-node scene: one apply per frame
  let queued = false;

  liveSpacing.addEventListener('input', () => {
    liveSpacingValue.textContent = Number(liveSpacing.value).toFixed(2);

    if (queued) {
      return;
    }

    queued = true;
    requestAnimationFrame(() => {
      queued = false;

      const cy = window.cy;

      if (cy == null) {
        return;
      }

      const scaled = layoutConfig.scaledPositions(base, liveSpacing.value);

      // positions(), not a preset run: a layout's stop would re-base the
      // slider to its own output and the factor would read 1 again
      cy.nodes().positions((n) => scaled[n.id()] || n.position());
      measure(cy);
    });
  });

  $('#layout-overlap-labels-check').addEventListener('change', () => {
    if (window.cy != null) {
      measure(window.cy);
    }
  });

  window.onCy((cy) => {
    let start = 0;
    let ready = 0;

    // the readout splits the layout from its presentation (119): the
    // positions are computed at layoutready, and what follows to
    // layoutstop is the finisher's tween under Animate — most of what
    // the page shows on em-web once the sim itself is fast
    cy.on('layoutstart', () => {
      start = performance.now();
      ready = 0;
    });
    cy.on('layoutready', () => {
      ready = performance.now();
    });
    cy.on('layoutstop', () => {
      const end = performance.now();
      const layoutMs = (ready > 0 ? ready : end) - start;
      const tweenMs = ready > 0 ? end - ready : 0;

      $('#layout-time').textContent =
        tweenMs > 50
          ? layoutMs.toFixed(0) + ' ms + ' + tweenMs.toFixed(0) + ' ms tween'
          : (end - start).toFixed(0) + ' ms';

      // the layout's output is the new base for the live slider (125.10)
      rebase(cy);
    });

    rebase(cy);
  });

  const liveCheck = $('#layout-live-check');
  const infiniteCheck = $('#layout-infinite-check');
  const stopButton = $('#layout-stop-button');
  const reheatButton = $('#layout-reheat-button');
  const overlapMode = $('#layout-overlap-mode');
  const avoidOverlapCheck = $('#layout-avoid-overlap-check');
  const select = $('#layout-select');

  // the infinite run under way (118.4), for Stop and Reheat — and for
  // Apply, which ends it before starting anything else
  let running = null;
  const spacing = $('#spacing-input');
  const spacingValue = $('#spacing-value');

  // the slider's readout follows it (115.6); Apply reads the value
  const syncSpacing = () => {
    spacingValue.textContent = Number(spacing.value).toFixed(2);
  };

  spacing.addEventListener('input', syncSpacing);
  syncSpacing();

  // -- the options panel (125.11) --

  const optionsContainer = $('#layout-options');
  const callReadout = $('#layout-call');
  let panel = null;

  /** the options object Apply will run: the boxes' spelling, the
   * panel's fields over it */
  const currentOptions = () => {
    const name = select.value;

    if (name === '') {
      return null;
    }

    const base = layoutConfig.layoutOptions(
      name,
      {
        animate: $('#layout-animate-check').checked,
        live: liveCheck.checked,
        infinite: layoutConfig.isForce(name) && infiniteCheck.checked,
        seed: $('#seed-input').value,
        positions: window.initialPositions,
        avoidOverlap: avoidOverlapCheck.checked,
        overlapMode: overlapMode.value,
        overlapLabels: $('#layout-overlap-labels-check').checked,
        spacing: $('#spacing-input').value,
        tidy: $('#layout-tidy-check').checked,
        pack: $('#layout-pack-check').checked,
        signKey: (window.currentNetwork || {}).signKey,
      },
      SpiralLayout,
    );

    try {
      return Object.assign(base, panel != null ? panel.read() : {});
    } catch (err) {
      callReadout.textContent = String(err.message || err);

      return null;
    }
  };

  const syncCall = () => {
    const options = currentOptions();

    if (options != null) {
      callReadout.textContent = layoutOptionsPanel.describe(options);
    }
  };

  const renderPanel = () => {
    panel = layoutOptionsPanel.render(optionsContainer, select.value, syncCall);
    syncCall();
  };

  window.syncLayoutCall = syncCall;

  // Live and Infinite are force's alone: the other layouts have no
  // stream to show; the overlap mechanism select is force's too, read
  // only under Avoid overlap, and pinned to `sim` under Infinite
  const syncForce = () => {
    const force = layoutConfig.isForce(select.value);

    liveCheck.disabled = !force;
    infiniteCheck.disabled = !force;
    overlapMode.disabled =
      !force || !avoidOverlapCheck.checked || infiniteCheck.checked;

    if (force && infiniteCheck.checked) {
      overlapMode.value = 'sim';
    }
  };

  select.addEventListener('change', syncForce);
  infiniteCheck.addEventListener('change', syncForce);
  avoidOverlapCheck.addEventListener('change', syncForce);
  syncForce();

  select.addEventListener('change', renderPanel);
  renderPanel();

  // every box the call reads refreshes the readout
  for (const id of [
    '#layout-animate-check',
    '#layout-live-check',
    '#layout-infinite-check',
    '#layout-avoid-overlap-check',
    '#layout-overlap-labels-check',
    '#layout-pack-check',
    '#layout-tidy-check',
    '#layout-overlap-mode',
    '#seed-input',
    '#spacing-input',
  ]) {
    $(id).addEventListener('change', syncCall);
    $(id).addEventListener('input', syncCall);
  }

  const syncRunning = () => {
    stopButton.disabled = running == null;
    reheatButton.disabled = running == null;
  };

  stopButton.addEventListener('click', () => {
    if (running != null) {
      running.stop();
    }
  });
  reheatButton.addEventListener('click', () => {
    if (running != null) {
      running.reheat();
    }
  });
  syncRunning();

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

    // an infinite run under way ends first: two sims over one graph
    // would fight for the positions
    if (running != null) {
      running.stop();
      running = null;
      syncRunning();
    }

    const infinite = layoutConfig.isForce(name) && infiniteCheck.checked;
    // the boxes' spelling with the panel's fields over it (125.11); a
    // field that does not parse leaves its message in the readout
    const options = currentOptions();

    if (options == null) {
      return;
    }

    const layout = cy.layout(options);

    applyEdgeTypes(cy, name);
    console.time('layout ' + name);
    layout.run();

    if (infinite) {
      running = layout;
      syncRunning();
    }

    // the discrete built-ins have no promise() (the lifecycle-unification
    // hook) — the old unguarded chain threw uncaught on every Apply
    const done =
      typeof layout.promise === 'function'
        ? layout.promise()
        : Promise.resolve();

    done
      .then(() => {
        console.timeEnd('layout ' + name);

        if (running === layout) {
          running = null;
          syncRunning();
        }
      })
      .catch((err) => console.error(err));
  });
})();
