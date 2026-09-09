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
// Round 118.4 added the force-only Infinite box (`infinite` — the run
// keeps going at no cost at rest, and a dragged node reflows its
// neighbourhood; Stop ends it, Reheat wakes it) and the force overlap
// mechanism select (`avoidOverlap: 'settle' | 'sim' | 'both'`, pinned to
// `sim` under Infinite, where there is no settle).

(function () {
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
    });
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
    const layout = cy.layout(
      layoutConfig.layoutOptions(
        name,
        {
          animate: $('#layout-animate-check').checked,
          live: liveCheck.checked,
          infinite,
          seed: $('#seed-input').value,
          positions: window.initialPositions,
          avoidOverlap: avoidOverlapCheck.checked,
          overlapMode: overlapMode.value,
          overlapLabels: $('#layout-overlap-labels-check').checked,
          spacing: $('#spacing-input').value,
          tidy: $('#layout-tidy-check').checked,
          pack: $('#layout-pack-check').checked,
          // the EM entry (121.1) groups by the network's signed field
          signKey: (window.currentNetwork || {}).signKey,
        },
        SpiralLayout,
      ),
    );

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
