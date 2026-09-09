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
    // the EM entry is force with a grouping and an order (120; one run
    // since 121): the same sheet
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

    if (isForce(name)) {
      options.name = 'force';
      Object.assign(options, forceAnimation(ui));
      options.seed = parseInt(ui.seed || '1', 10);
      options.avoidOverlap = forceOverlap(ui);
      // spelled out every run (120): the page's box is the run's
      options.tidyComponents = ui.tidy !== false;
    }

    // the EM entry (121.1): the grouping and the order, for a network
    // with a signed field; without one it is a plain force run
    if (isCombo(name) && ui.signKey != null) {
      Object.assign(options, signedPacking(ui.signKey));
    }

    if (name === 'preset') {
      options.positions = ui.positions || {};
    }

    return options;
  }

  // The EM entry (120; one run since 121.1): force with the library's
  // `componentGroup` and `componentOrder` — the components grouped by
  // the sign of a network's signed field, negatives left, a mixed
  // component in the middle, positives right, and each group's rows by
  // node count and then by score, the EnrichmentMap preset's shape.
  // The page runs it; these are the pure parts.
  var FORCE_BY_SIGN = 'force-by-sign';
  /** a component is mixed when its minority sign holds this share of
   * its signed members: em-web's 187-node component is 59 positive
   * against 128, and sits between the sides rather than with either */
  var MIXED_SHARE = 0.25;

  function isCombo(name) {
    return name === FORCE_BY_SIGN;
  }

  /** the layouts that are force runs: the select's force, and the EM
   * entry that is force with a grouping */
  function isForce(name) {
    return name === 'force' || name === FORCE_BY_SIGN;
  }

  function finite(values) {
    var out = [];

    (values || []).forEach(function (v) {
      if (v == null || v === '') {
        return;
      }

      var x = Number(v);

      if (Number.isFinite(x)) {
        out.push(x);
      }
    });

    return out;
  }

  /**
   * A component's group by sign: -1 for negative, 1 for positive, 0
   * for a mixed one (its minority sign holding at least MIXED_SHARE of
   * its signed members), and null for one with no signed member at all
   * — the library packs the unkeyed last, and a graph with no signed
   * field is one group.
   *
   * @param values the members' values (strings count, blanks skip)
   */
  function signGroup(values) {
    var v = finite(values);

    if (v.length === 0) {
      return null;
    }

    var pos = 0;
    var neg = 0;

    v.forEach(function (x) {
      if (x > 0) {
        pos++;
      } else if (x < 0) {
        neg++;
      }
    });

    if (pos === 0 && neg === 0) {
      return null;
    }

    var minority = Math.min(pos, neg);

    if (minority / (pos + neg) >= MIXED_SHARE) {
      return 0;
    }

    return pos > neg ? 1 : -1;
  }

  /** a component's score: the mean of its members' finite values, or
   * 0 with none */
  function scoreOf(values) {
    var v = finite(values);

    if (v.length === 0) {
      return 0;
    }

    return (
      v.reduce(function (a, b) {
        return a + b;
      }, 0) / v.length
    );
  }

  /**
   * The grouping and the order the EM entry hands force, for a signed
   * field: `componentGroup` by `signGroup` over the component's nodes,
   * `componentOrder` by node count and then by score descending — the
   * preset's rows, each read from the strongest score down.
   *
   * @param key the network's signed data field
   */
  function signedPacking(key) {
    var valuesOf = function (c) {
      var out = [];

      c.nodes.forEach(function (n) {
        out.push(n.data(key));
      });

      return out;
    };

    return {
      componentGroup: function (c) {
        return signGroup(valuesOf(c));
      },
      componentOrder: function (a, b) {
        return b.size - a.size || scoreOf(valuesOf(b)) - scoreOf(valuesOf(a));
      },
    };
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
    FORCE_BY_SIGN: FORCE_BY_SIGN,
    MIXED_SHARE: MIXED_SHARE,
    isCombo: isCombo,
    isForce: isForce,
    signGroup: signGroup,
    scoreOf: scoreOf,
    signedPacking: signedPacking,
    layoutOptions: layoutOptions,
    HOVER_MAX_ELEMENTS: HOVER_MAX_ELEMENTS,
    hoverAllowed: hoverAllowed,
  };
})();

// see debug/fixtures.js — the module suite loads this as a script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = layoutConfig;
}
