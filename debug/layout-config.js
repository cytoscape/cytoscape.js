/* eslint-disable no-unused-vars */

// The layout section's pure parts (round 114.7), split out of layout.js
// and init.js so `test/modules/debug-harness.mjs` can exercise the same
// code without a DOM: which curve style suits which layout, the load
// snapshot Preset restores, how the two force checkboxes spell the
// run, and the hover panel's size gate.

var layoutConfig = (function () {
  // The edge style a layout reads best with.  Flow and breadthfirst are
  // layered, so taxi edges (turning in the rank gap the layout leaves
  // for them) are the routing they were designed for; the ring layouts
  // draw chords, so bezier keeps multi-edges apart and loops drawable;
  // force is the scale layout, so haystack — the sheets that author it
  // (em-web, em-desktop) author it for exactly that reason — unless
  // arrows are on, since haystack draws none; preset and random keep
  // the sheet's own, because the sheet was written for the positions.
  var EDGE_STYLE = {
    grid: { 'curve-style': 'bezier' },
    preset: null,
    circle: { 'curve-style': 'bezier' },
    concentric: { 'curve-style': 'bezier' },
    breadthfirst: { 'curve-style': 'round-taxi', 'taxi-turn': 20 },
    random: null,
    radial: { 'curve-style': 'bezier' },
    force: { 'curve-style': 'haystack' },
    // the combo is force twice (120): the same sheet
    'force-by-sign': { 'curve-style': 'haystack' },
    flow: { 'curve-style': 'round-taxi', 'taxi-turn': 20 },
    spiral: { 'curve-style': 'bezier' },
  };

  /**
   * The edge-style override for a layout, or null for the sheet's own.
   *
   * @param name the layout select's value
   * @param opts { direction: the flow / breadthfirst direction; arrows:
   *   whether the sheet draws target arrows }
   */
  function edgeOverride(name, opts) {
    opts = opts || {};

    var base = EDGE_STYLE[name];

    if (base == null) {
      return null;
    }

    var out = Object.assign({}, base);

    if (out['curve-style'] === 'round-taxi') {
      out['taxi-direction'] = opts.direction || 'downward';
    }

    if (out['curve-style'] === 'haystack' && opts.arrows) {
      out['curve-style'] = 'straight';
    }

    return out;
  }

  /** A sheet with an edge override laid over its edge block. */
  function sheetWith(sheet, override) {
    return Object.assign({}, sheet, {
      edges: Object.assign({}, sheet.edges, override),
    });
  }

  /**
   * The id -> { x, y } map of every leaf node's current position — what
   * Preset restores.  Parents derive from their children, so they are
   * left out (preset ignores them anyway).
   */
  function snapshotPositions(cy) {
    var out = {};

    cy.nodes().forEach(function (node) {
      if (!node.isParent()) {
        var p = node.position();

        out[node.id()] = { x: p.x, y: p.y };
      }
    });

    return out;
  }

  /**
   * How the three checkboxes spell a force run: Infinite keeps the run
   * open (`infinite`, which streams and wins over both), Live streams
   * the sim (`animateLive`, which wins over Animate), otherwise Animate
   * tweens to the settle.
   */
  function forceAnimation(ui) {
    if (ui.infinite) {
      return { infinite: true };
    }

    return ui.live ? { animateLive: true } : { animate: !!ui.animate };
  }

  // The force overlap mechanisms the select offers (118.4): the value
  // `avoidOverlap` takes on force since 118.2.
  var OVERLAP_MODES = ['settle', 'sim', 'both'];

  /**
   * The `avoidOverlap` value a force run takes from the panel: off is
   * false; on is the select's mechanism — and always `sim` under
   * Infinite, since an infinite run has no settle for a pass to land on
   * (the library reads `settle` as `sim` there anyway; the page spells
   * it so the options read true).
   *
   * @param ui { avoidOverlap, overlapMode, infinite }
   */
  function forceOverlap(ui) {
    if (!ui.avoidOverlap) {
      return false;
    }

    if (ui.infinite) {
      return 'sim';
    }

    return OVERLAP_MODES.indexOf(ui.overlapMode) >= 0
      ? ui.overlapMode
      : 'settle';
  }

  // The layouts with an avoidOverlap option (115).  Preset and random
  // have none — positions are the user's, and a pushed-apart scatter is
  // neither random nor uniform — so the page never sends them one.
  var OVERLAP_LAYOUTS = {
    grid: true,
    circle: true,
    concentric: true,
    breadthfirst: true,
    radial: true,
    force: true,
    flow: true,
    spiral: true,
  };

  // A layout's own spacingFactor default (115.6): the slider is a
  // multiple over it, so 1x on breadthfirst is breadthfirst's 1.75.
  // Preset has no spacing to scale — the positions are the user's.
  var DEFAULT_SPACING = {
    breadthfirst: 1.75,
  };

  /**
   * The spacingFactor a slider value spells for a layout, or null when
   * the layout takes none.
   *
   * @param name the layout select's value
   * @param slider the slider's value (a string or number; default 1)
   */
  function spacingFactor(name, slider) {
    if (name === 'preset') {
      return null;
    }

    var multiple = Number(slider);

    if (!(multiple > 0)) {
      multiple = 1;
    }

    return (DEFAULT_SPACING[name] || 1) * multiple;
  }

  /**
   * The options object for `cy.layout()` given the panel's state.
   *
   * @param name the layout select's value
   * @param ui { animate, live, infinite, seed, positions, avoidOverlap,
   *   overlapMode, overlapLabels, spacing }
   * @param impl the spiral example's class (a page global)
   */
  function layoutOptions(name, ui, impl) {
    ui = ui || {};

    var options;

    if (name === 'spiral') {
      // the round-17 extension contract: a plain class, no registry
      options = { impl: impl, animate: !!ui.animate };
    } else {
      options = { name: name, animate: !!ui.animate };
    }

    if (OVERLAP_LAYOUTS[name]) {
      // both checkboxes are spelled out every run, so the page's
      // defaults (off) are the run's, whatever the library's are
      options.avoidOverlap = !!ui.avoidOverlap;
      options.nodeDimensionsIncludeLabels = !!ui.overlapLabels;
    }

    var factor = spacingFactor(name, ui.spacing == null ? 1 : ui.spacing);

    if (factor != null) {
      options.spacingFactor = factor;
    }

    if (name === 'force') {
      Object.assign(options, forceAnimation(ui));
      options.seed = parseInt(ui.seed || '1', 10);
      options.avoidOverlap = forceOverlap(ui);
      // spelled out every run (120): the page's box is the run's
      options.tidyComponents = ui.tidy !== false;
    }

    if (name === 'preset') {
      options.positions = ui.positions || {};
    }

    return options;
  }

  // The combo entry (120): two force runs, one per sign of a network's
  // signed field, packed side by side — the EnrichmentMap preset's
  // shape, where the blue components sit left and the red right, each
  // side's components largest first.  The page runs it; these are the
  // pure parts.
  var COMBO_BY_SIGN = 'force-by-sign';

  function isCombo(name) {
    return name === COMBO_BY_SIGN;
  }

  /**
   * Which side each component goes to: whole, by the sign of the mean
   * of its members' finite values; a component with no value at all
   * follows the negative side, so an unsigned graph is one run.
   *
   * @param components [{ ids: string[], values: (number|null)[] }]
   * @returns { negative: string[], positive: string[] }
   */
  function splitBySign(components) {
    var negative = [];
    var positive = [];

    (components || []).forEach(function (c) {
      var sum = 0;
      var count = 0;

      (c.values || []).forEach(function (v) {
        var x = Number(v);

        if (Number.isFinite(x)) {
          sum += x;
          count++;
        }
      });

      var side = count > 0 && sum / count > 0 ? positive : negative;

      c.ids.forEach(function (id) {
        side.push(id);
      });
    });

    return { negative: negative, positive: positive };
  }

  // Past this many elements the hover panel stays off: a neighbourhood
  // emphasis is a per-element bypass over everything *outside* it, and
  // the 465k-edge fixture is the measurement, not the demo.
  var HOVER_MAX_ELEMENTS = 100000;

  function hoverAllowed(count) {
    return count <= HOVER_MAX_ELEMENTS;
  }

  return {
    EDGE_STYLE: EDGE_STYLE,
    OVERLAP_LAYOUTS: OVERLAP_LAYOUTS,
    DEFAULT_SPACING: DEFAULT_SPACING,
    spacingFactor: spacingFactor,
    edgeOverride: edgeOverride,
    sheetWith: sheetWith,
    snapshotPositions: snapshotPositions,
    forceAnimation: forceAnimation,
    OVERLAP_MODES: OVERLAP_MODES,
    forceOverlap: forceOverlap,
    COMBO_BY_SIGN: COMBO_BY_SIGN,
    isCombo: isCombo,
    splitBySign: splitBySign,
    layoutOptions: layoutOptions,
    HOVER_MAX_ELEMENTS: HOVER_MAX_ELEMENTS,
    hoverAllowed: hoverAllowed,
  };
})();

// see debug/fixtures.js — the module suite loads this as a script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = layoutConfig;
}
