/* eslint-disable no-console, no-unused-vars */
/* global $ */

// Round 106's minimap proof: a second view of the graph as a second
// instance.  `cy.clone()` builds it into its own container with its own,
// simplified sheet (dots and hairlines, no labels, no arrows), and
// `follow` keeps it current by a throttled id-keyed patch of the main
// view's serialize() — so a drag, an add, a remove or a layout on the main
// view reaches the minimap, while a hover, a selection or a restyle there
// costs it nothing.  The minimap owns its state: it cannot be dragged or
// panned (autolock, autoungrabify, no user pan/zoom — positions still
// follow, since a sync writes through the clone's locks), it refits after
// each sync, and it draws the main view's extent as a rectangle.  A tap on
// it centres the main view there.
//
// The pure parts — the sheet, the clone's options and the extent
// rectangle — are exported for the module suite, which runs them
// headless against the real library (test/modules/minimap.mjs).

const minimap = (function () {
  /** The minimap's own sheet: a per-view style no shared store could have. */
  const MINIMAP_STYLE = {
    // model px, so a minimap fitted to a few thousand px still shows
    // dots (the main view's sheets size nodes for reading, not overview)
    nodes: {
      width: 40,
      height: 40,
      'background-color': '#5b6b7b',
      'border-width': 0,
      label: '',
    },
    parents: {
      'background-color': '#c9d3dc',
      'background-opacity': 0.5,
      'border-width': 1,
      'border-color': '#9aa8b5',
      label: '',
    },
    edges: {
      width: 4,
      'line-color': '#b8c2cc',
      'curve-style': 'straight',
      'target-arrow-shape': 'none',
      'source-arrow-shape': 'none',
      label: '',
    },
  };

  /**
   * The clone's options: its container, its sheet, following, and every
   * user gesture off — a minimap is looked at, and tapped, not dragged.
   *
   * @param container — the element to render into (null: headless)
   * @param throttle — the least ms between two syncs
   * @returns the options for `cy.clone()`
   */
  const cloneOptions = (container, throttle = 50) => ({
    ...(container != null ? { container } : {}),
    style: MINIMAP_STYLE,
    follow: { throttle },
    autolock: true,
    autoungrabify: true,
    autounselectify: true,
    userPanningEnabled: false,
    userZoomingEnabled: false,
    boxSelectionEnabled: false,
  });

  /**
   * The main view's extent as a box in the minimap's rendered px.
   *
   * @param main — the main instance
   * @param mini — the minimap instance
   * @returns `{ left, top, width, height }`
   */
  const viewRect = (main, mini) => {
    const ext = main.extent();
    const z = mini.zoom();
    const pan = mini.pan();

    return {
      left: ext.x1 * z + pan.x,
      top: ext.y1 * z + pan.y,
      width: ext.w * z,
      height: ext.h * z,
    };
  };

  /**
   * The pan that centres the main view on a model position (the tap).
   *
   * @param main — the main instance
   * @param pos — the model position to centre
   * @returns the pan
   */
  const centrePan = (main, pos) => ({
    x: main.width() / 2 - pos.x * main.zoom(),
    y: main.height() / 2 - pos.y * main.zoom(),
  });

  /**
   * Open a minimap on `cy` in `container` (the page's wiring).
   *
   * @returns a close function
   */
  const open = (cy, container, rectEl) => {
    console.time('minimap clone');
    const mini = cy.clone(cloneOptions(container));
    console.timeEnd('minimap clone');

    const draw = () => {
      const r = viewRect(cy, mini);

      rectEl.style.left = r.left + 'px';
      rectEl.style.top = r.top + 'px';
      rectEl.style.width = Math.max(2, r.width) + 'px';
      rectEl.style.height = Math.max(2, r.height) + 'px';
    };
    const refit = () => {
      mini.fit(undefined, 8);
      draw();
    };
    let syncs = 0;

    mini.on('patch', (e) => {
      syncs++;
      refit();
      console.log(
        `minimap sync ${syncs}: +${e.diff.added.length} ` +
          `-${e.diff.removed.length} ~${e.diff.updated.length}`,
      );
    });
    mini.on('tap', (e) => {
      if (e.position != null) {
        cy.pan(centrePan(cy, e.position));
      }
    });

    const onViewport = () => draw();

    cy.on('viewport', onViewport);
    mini.ready.then(refit, () => {});
    refit();

    window.minimap = mini; // for the console and scripted drives

    return () => {
      cy.off('viewport', onViewport);
      mini.destroy();
      window.minimap = null;
    };
  };

  if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    const toggle = $('#minimap-toggle');
    const box = $('#minimap');
    let close = null;

    const set = (on) => {
      if (close != null) {
        close();
        close = null;
      }

      box.style.display = on ? 'block' : 'none';

      if (on && window.cy != null) {
        close = open(window.cy, $('#minimap-cy'), $('#minimap-view'));
      }
    };

    if (toggle != null) {
      toggle.checked =
        new URLSearchParams(window.location.search).get('minimap') === 'true';
      toggle.addEventListener('change', () => set(toggle.checked));
      window.onCy(() => set(toggle.checked));
    }
  }

  return { MINIMAP_STYLE, cloneOptions, viewRect, centrePan };
})();

// see debug/fixtures.js — the module suite loads this as a script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = minimap;
}
