/* eslint-disable no-unused-vars */

// Hand-authored v4 stylesheets, one per fixture (round 43.3).
//
// These replace the old `sanitizeStyle`, which folded each fixture's *v3* sheet
// down to a 14-property whitelist with every mapper dropped — so every network
// rendered as flat monochrome discs and the harness read as "v4 can't style".
// Written natively instead, because the interesting part is what a v4 sheet
// looks like, not what survives a translation.
//
// Each entry is `( elements, def ) => Stylesheet`; the argument is there because
// a couple of sheets need a data extent (EnrichmentMap sizes its diverging
// colour domain to max |NES|).  `labelKey` comes from `networks.js`.
//
// Two things these sheets deliberately cannot reproduce, both decided design:
//   * `z-index` — dropped outright 2026-08-01.  Draw order in v4 is structural
//     (parents, then edges, then leaves, then labels), so EnrichmentMap's
//     "selected nodes to the front" has no v4 spelling.
//   * `node:selected` restyling — there are no selector blocks and no
//     pseudo-classes; v4 draws the selection accent in the shader.

var styles = (function () {
  // -- shared helpers ------------------------------------------------------

  /** Largest |value| of a numeric data key, for a symmetric diverging domain. */
  function magnitude(nodes, key, fallback) {
    var mag = 0;

    for (var i = 0; i < nodes.length; i++) {
      var v = nodes[i].data[key];

      if (typeof v === 'number' && isFinite(v) && Math.abs(v) > mag) {
        mag = Math.abs(v);
      }
    }

    return mag > 0 ? mag : fallback;
  }

  /** Min/max of a numeric data key over a group. */
  function extent(eles, key, fallback) {
    var lo = Infinity,
      hi = -Infinity;

    for (var i = 0; i < eles.length; i++) {
      var v = eles[i].data[key];

      if (typeof v === 'number' && isFinite(v)) {
        if (v < lo) {
          lo = v;
        }
        if (v > hi) {
          hi = v;
        }
      }
    }

    return lo <= hi ? [lo, hi] : fallback;
  }

  // ColorBrewer RdBu, the palette EnrichmentMap uses for regulation.  Stops
  // interpolate in sRGB here to match chroma.js, which is what the web app
  // uses — v4's own default is OKLab.
  var RdBu3 = ['#0571b0', '#f7f7f7', '#ca0020'];

  /** The label channel, with the graph's own key. */
  function label(def) {
    return { label: { data: def.labelKey || 'id' } };
  }

  // -- the plain sheet: the pre-round-43 look, kept for contrast ------------
  //
  // Useful when you are looking at the *renderer* rather than the style —
  // no mappers, no labels, nothing to blame but geometry.

  function plain(elements, def) {
    return {
      nodes: { width: 12, height: 12, 'background-color': '#4a7dbd' },
      edges: { width: 1, 'line-color': '#bbb', opacity: 0.6 },
      parents: { padding: 14, 'background-opacity': 0.08 },
    };
  }

  // -- per-network production sheets ---------------------------------------

  // The enrichmentmap.org web app's style, ported from
  // src/client/components/network-editor/network-style.js in
  // github.com/cytoscape/enrichment-map-webapp.  The v3 form of the same sheet
  // is embedded in the fixture, so the two can be compared side by side.
  //
  // The one structural difference is the point of the exercise: EnrichmentMap
  // computes its node colour with a memoized per-element function over a chroma
  // scale.  v4 has no style functions (removed round 8) — the same thing is a
  // declarative `diverging` mapper, which is analyzable, serializable, and
  // evaluated on the GPU.
  function emWeb(elements, def) {
    var mag = magnitude(elements.nodes, 'NES', 3);
    var nesColour = {
      data: 'NES',
      scale: 'diverging',
      domain: [-mag, 0, mag],
      range: RdBu3,
      interpolate: 'srgb',
      fallback: '#f7f7f7',
    };

    return {
      nodes: Object.assign(
        {
          width: 40,
          height: 40,
          'background-color': nesColour,
          // EnrichmentMap reserves a fat transparent border so a selected node can
          // fill it without moving anything: 12px at zero opacity
          'border-width': 12,
          'border-opacity': 0,
          'border-color': '#333333',
          'font-size': 8,
          color: '#fff',
          'text-valign': 'center',
          'text-halign': 'center',
          'text-wrap': 'wrap',
          'text-max-width': 80,
          // the outline is the node's own colour, which is what keeps white text
          // legible over both ends of the diverging scale
          'text-outline-width': 2,
          'text-outline-color': nesColour,
          'text-outline-opacity': 1,
          'min-zoomed-font-size': 6,
        },
        label(def),
      ),
      edges: {
        'curve-style': 'haystack',
        'haystack-radius': 0,
        'line-color': '#888',
        'line-opacity': 0.3,
        width: {
          data: 'similarity_coefficient',
          domain: [0, 1],
          range: [0, 15],
          fallback: 1,
        },
      },
    };
  }

  // The clustered variant styles the MCODE parents the way EnrichmentMap styles
  // clusters: no body of their own, the label hanging above the group.
  function emWebClustered(elements, def) {
    var sheet = emWeb(elements, def);

    sheet.parents = {
      'background-opacity': 0,
      'border-width': 0,
      padding: 18,
      label: { data: 'name' },
      'font-size': 14,
      color: '#555',
      'text-opacity': 0.6,
      'text-valign': 'top',
      'text-halign': 'center',
      'text-outline-width': 0,
      'min-zoomed-font-size': 8,
    };

    return sheet;
  }

  // The Cytoscape desktop export.  Its own sheet maps size from gene-set size
  // and fill from a two-tailed enrichment score expressed as eight overlapping
  // `[k > a][k < b]` blocks; both are one mapper here.
  function emDesktop(elements, def) {
    var size = extent(elements.nodes, 'EM1_gs_size', [0, 1300]);

    return {
      nodes: Object.assign(
        {
          width: {
            data: 'EM1_gs_size',
            domain: size,
            range: [20, 60],
            fallback: 20,
          },
          height: {
            data: 'EM1_gs_size',
            domain: size,
            range: [20, 60],
            fallback: 20,
          },
          'background-color': {
            data: 'EM1_Colouring_Data_Set_1_',
            scale: 'diverging',
            domain: [-1, 0, 1],
            range: ['#2166ac', '#f7f7f7', '#b2182b'],
            interpolate: 'srgb',
            fallback: '#f0f0f0',
          },
          'border-width': 1,
          'border-color': '#333333',
          'font-size': 9,
          color: '#222',
          'text-valign': 'center',
          'text-wrap': 'wrap',
          'text-max-width': 90,
          'text-outline-width': 2,
          'text-outline-color': '#fff',
          'text-outline-opacity': 0.9,
          'min-zoomed-font-size': 7,
        },
        label(def),
      ),
      edges: {
        'curve-style': 'haystack',
        'haystack-radius': 0,
        'line-color': '#9aa5b1',
        'line-opacity': 0.35,
        width: {
          data: 'EM1_similarity_coefficient',
          domain: [0.375, 1],
          range: [1, 5],
          fallback: 1,
        },
      },
    };
  }

  // Three Classification values, three fills — a `case` mapper, which is v4's
  // replacement for the [attr = value] selector blocks the fixture ships.
  function whiteMatter(elements, def) {
    return {
      nodes: Object.assign(
        {
          width: 18,
          height: 18,
          'background-color': {
            case: [
              {
                when: { data: 'Classification', eq: 'candidate' },
                then: '#0099ff',
              },
              {
                when: { data: 'Classification', eq: 'known' },
                then: '#00cc44',
              },
              {
                when: { data: 'Classification', eq: 'novel' },
                then: '#ff9900',
              },
            ],
            else: '#c9d2da',
          },
          'border-width': 1,
          'border-color': '#33691e',
          'border-opacity': 0.5,
          'font-size': 8,
          color: '#25323d',
          'text-valign': 'bottom',
          'text-margin-y': 2,
          'text-outline-width': 2,
          'text-outline-color': '#fff',
          'text-outline-opacity': 0.85,
          'min-zoomed-font-size': 7,
        },
        label(def),
      ),
      edges: {
        width: 1,
        'line-color': '#009900',
        'line-opacity': 0.2,
      },
    };
  }

  // 30 MCL clusters.  The fixture spells them as 30 `node[MCL = n]` blocks;
  // v4 spells the same thing as one ordinal mapper, which is both shorter and
  // GPU-evaluable.
  //
  // The range is cycled by hand rather than named: `range: 'category10'` throws
  // here — "scheme 'category10' has only 10 entries; 30 needed" — because v4
  // will not silently recycle a categorical palette and leave you wondering why
  // clusters 3 and 13 look identical.  Recycling is fine, it just has to be
  // something you asked for.
  function ndexLarge(elements, def) {
    var CAT10 = [
      '#1f77b4',
      '#ff7f0e',
      '#2ca02c',
      '#d62728',
      '#9467bd',
      '#8c564b',
      '#e377c2',
      '#7f7f7f',
      '#bcbd22',
      '#17becf',
    ];
    var domain = [];
    var range = [];

    for (var i = 1; i <= 30; i++) {
      domain.push(i);
      range.push(CAT10[(i - 1) % CAT10.length]);
    }

    return {
      nodes: Object.assign(
        {
          width: 22,
          height: 22,
          'background-color': {
            data: 'MCL',
            scale: 'ordinal',
            domain: domain,
            range: range,
            fallback: '#b0b8bf',
          },
          'border-width': 1,
          'border-color': '#ffffff',
          'border-opacity': 0.7,
          'font-size': 9,
          color: '#1b2733',
          'text-valign': 'center',
          'text-outline-width': 2,
          'text-outline-color': '#fff',
          'text-outline-opacity': 0.9,
          'min-zoomed-font-size': 8,
        },
        label(def),
      ),
      edges: {
        width: { data: 'corr', domain: [0, 1], range: [0.5, 3], fallback: 0.5 },
        'line-color': '#c4ccd4',
        'line-opacity': 0.35,
      },
    };
  }

  // The scale fixture.  Round 43.2 re-slimmed it to carry `name` and
  // `Node_Type` on nodes and `Mechanism_of_Action` on edges, so the 465k-edge
  // scene now also demonstrates a paint mapper evaluated on the device.
  function ndexXLarge(elements, def) {
    return {
      nodes: Object.assign(
        {
          width: {
            case: [{ when: { data: 'Node_Type', eq: 'TF' }, then: 26 }],
            else: 14,
          },
          height: {
            case: [{ when: { data: 'Node_Type', eq: 'TF' }, then: 26 }],
            else: 14,
          },
          'background-color': {
            case: [{ when: { data: 'Node_Type', eq: 'TF' }, then: '#3366ff' }],
            else: '#66ccff',
          },
          'border-width': 1,
          'border-color': '#0d47a1',
          'border-opacity': 0.6,
          'font-size': 10,
          color: '#0d2137',
          'text-valign': 'bottom',
          'text-margin-y': 2,
          'text-outline-width': 2,
          'text-outline-color': '#fff',
          'text-outline-opacity': 0.9,
          // 19.6k labels: only draw them once they are worth reading
          'min-zoomed-font-size': 9,
        },
        label(def),
      ),
      edges: {
        width: 0.5,
        'line-color': {
          data: 'Mechanism_of_Action',
          scale: 'diverging',
          domain: [-1, 0, 1],
          range: ['#cc0033', '#e8e8e8', '#009966'],
          fallback: '#e8e8e8',
        },
        'line-opacity': 0.25,
      },
    };
  }

  // The generated scenes get a sheet too — an unlabelled scatter demos nothing
  // but fill rate.  `id` is a string, so the colour mapper keys off the degree
  // the generator writes instead.
  function generated(elements, def) {
    return {
      nodes: Object.assign(
        {
          width: 12,
          height: 12,
          'background-color': {
            data: 'band',
            scale: 'ordinal',
            domain: [0, 1, 2, 3, 4],
            range: 'category10',
            fallback: '#4a7dbd',
          },
          'font-size': 8,
          color: '#333',
          'text-valign': 'center',
          'text-outline-width': 2,
          'text-outline-color': '#fff',
          'text-outline-opacity': 0.85,
          'min-zoomed-font-size': 8,
        },
        label(def),
      ),
      edges: { width: 1, 'line-color': '#bbb', opacity: 0.6 },
      parents: {
        padding: 14,
        'background-opacity': 0.06,
        'background-color': '#4a7dbd',
        'border-width': 1,
        'border-color': '#4a7dbd',
        'border-opacity': 0.35,
      },
    };
  }

  // The v3 debug fixture: ten nodes, deliberately awkward.  Styled so the
  // awkward parts are visible — nesting depth by parent tint, the long label
  // wrapped rather than overflowing.
  function compoundFixture(elements, def) {
    return {
      nodes: Object.assign(
        {
          width: 40,
          height: 40,
          // v3's fixture carries a `shape` on three of its nodes and its debug
          // page never reads it, so they all draw as discs there.  A `case`
          // mapper is what v4 spells that with, and it makes the port's data
          // visible rather than inert.
          shape: {
            case: [
              { when: { data: 'shape', eq: 'triangle' }, then: 'triangle' },
              { when: { data: 'shape', eq: 'square' }, then: 'square' },
              { when: { data: 'shape', eq: 'rectangle' }, then: 'rectangle' },
            ],
            else: 'ellipse',
          },
          'background-color': '#e07a5f',
          'border-width': 2,
          'border-color': '#3d405b',
          'font-size': 11,
          color: '#3d405b',
          'text-valign': 'center',
          'text-wrap': 'wrap',
          'text-max-width': 70,
          'text-outline-width': 2,
          'text-outline-color': '#fff',
          'text-outline-opacity': 0.9,
        },
        label(def),
      ),
      edges: {
        width: 2,
        'line-color': '#3d405b',
        'line-opacity': 0.6,
        'curve-style': 'bezier',
        'target-arrow-shape': 'triangle',
        'target-arrow-color': '#3d405b',
      },
      parents: {
        padding: 16,
        // the parents block *overlays* the nodes block (round 14.6), so the
        // shape mapper above reaches parents too and resolves 'ellipse' for
        // them — they carry no `shape` data.  v3's `:parent` default is
        // rectangle, and a round parent box round a rectangular child reads
        // as a mistake, so say so here rather than leave it to the overlay.
        shape: 'rectangle',
        'background-color': '#81b29a',
        'background-opacity': 0.18,
        'border-width': 2,
        'border-color': '#81b29a',
        label: { data: 'id' },
        'font-size': 12,
        color: '#2f4f42',
        'text-valign': 'top',
        'text-margin-y': -4,
      },
    };
  }

  // v3's default debug graph, ported to a v4 sheet.
  //
  // v3 styles this graph with **eighteen id selectors** (`#ab`, `node#c`,
  // `[source = "c"][target = "e"]`, …).  v4 has neither selectors nor a
  // per-element bypass, so each of those becomes a `case` mapper over
  // `data( 'id' )` — which is the shape v4 intends per-element styling to
  // take, and it keeps the whole sheet serializable.
  //
  // **One deviation, and it is a real limit rather than a shortcut.**  The
  // list-valued curve parameters — `control-point-distances`/`-weights`,
  // `segment-distances`/`-weights`/`-radii` — and the arrow *widths* accept
  // constants only; they reject mappers outright.  v3 gives `ab`, `bc`, `eh`
  // and `ed` each their own arrays.  v4 cannot, so each family gets one
  // parameterisation here.  It costs nothing visually, because a family's
  // parameters are only read by edges *of* that family: `control-point-*`
  // reaches only the unbundled bezier, `segment-*` only the segment kinds.
  // What is genuinely lost is v3's *three different* segment arrays.
  function v3Default(elements, def) {
    var byId = function (map, fallback) {
      var cases = Object.keys(map).map(function (id) {
        return { when: { data: 'id', eq: id }, then: map[id] };
      });

      return { case: cases, else: fallback };
    };

    var RING = ['b', 'c', 'f', 'i']; // v3's `#b, #c, #f, #i` outline group
    var ringed = function (on, off) {
      var m = {};

      RING.forEach(function (id) {
        m[id] = on;
      });

      return byId(m, off);
    };

    return {
      nodes: Object.assign(
        {
          width: byId({ c: 220, b: 60, f: 50 }, 40),
          height: byId({ c: 60, b: 60 }, 40),
          shape: byId(
            { c: 'round-rectangle', b: 'round-hexagon', f: 'cut-rectangle' },
            'ellipse',
          ),
          'corner-radius': byId({ c: 30, b: 10, f: 10 }, 5),
          'background-color': '#dfe6ee',
          // the outline group: v3 also sets `outline-style: solid`, which v4 has
          // not ported (round 38) — solid is the default, so the ring still draws
          'outline-width': ringed(10, 0),
          'outline-color': 'red',
          'outline-opacity': 0.125,
          'outline-offset': 5,
          'border-width': ringed(5, 1),
          'border-color': ringed('cyan', '#8a94a6'),
          'border-opacity': ringed(0.25, 1),
          'border-position': 'inside',
          // v3 rotates b by 38deg and d by 45deg; v4 takes radians, not a
          // '38deg' string, so the conversion is explicit here
          'text-rotation': byId(
            { b: (38 * Math.PI) / 180, d: (45 * Math.PI) / 180 },
            0,
          ),
          'text-wrap': 'wrap',
          'text-max-width': byId({ b: 100, c: 100, d: 100 }, 60),
          'text-valign': 'center',
          'font-size': 12,
          color: '#1d2433',
          'text-events': 'yes',
        },
        label(def),
      ),
      edges: {
        width: byId({ fi: 6 }, 2),
        'line-color': '#5b6472',
        label: { data: 'id' },
        'font-size': 10,
        color: '#5b6472',
        'text-outline-width': 2,
        'text-outline-color': '#fff',
        // v3's edge defaults: a back-curved source arrow, a plain target
        // arrow, and both mid arrows — `fi` turns all four off
        'source-arrow-shape': byId({ fi: 'none' }, 'triangle-backcurve'),
        'target-arrow-shape': byId({ fi: 'none' }, 'triangle'),
        'mid-source-arrow-shape': byId({ fi: 'none' }, 'triangle-backcurve'),
        'mid-target-arrow-shape': byId({ fi: 'none' }, 'triangle'),
        'source-arrow-color': '#5b6472',
        'target-arrow-color': '#5b6472',
        'mid-source-arrow-color': '#5b6472',
        'mid-target-arrow-color': '#5b6472',
        'source-arrow-fill': 'hollow',
        'target-arrow-fill': 'hollow',
        // the one v3 line this sheet cannot vary per edge (see above)
        'curve-style': byId(
          {
            ab: 'unbundled-bezier',
            bc: 'segments',
            ed: 'segments',
            eh: 'round-segments',
            bf: 'taxi',
            eg: 'round-taxi',
            ei: 'round-taxi',
            ep: 'round-taxi',
            gh: 'round-taxi',
            ce: 'haystack',
            ce2: 'haystack',
            fi: 'straight-triangle',
            ae: 'bezier',
            be: 'bezier',
            cf: 'bezier',
            de: 'bezier',
          },
          'bezier',
        ),
        'control-point-distances': [20, -100, 20],
        'control-point-weights': [0.25, 0.5, 0.75],
        'segment-distances': [20, -80],
        'segment-weights': [0.25, 0.5],
        'segment-radii': [20, 20],
        'haystack-radius': 0.5,
        'taxi-direction': 'downward',
        'taxi-turn-min-distance': 50,
        'taxi-radius': 50,
      },
      parents: {
        shape: 'rectangle',
        padding: 20,
        'background-color': '#81b29a',
        'background-opacity': 0.15,
        'border-width': 2,
        'border-color': '#81b29a',
        label: { data: 'id' },
        'text-valign': 'top',
        'text-margin-y': -4,
        'font-size': 12,
        color: '#2f4f42',
      },
    };
  }

  var production = {
    'em-web': emWeb,
    'em-web-clustered': emWebClustered,
    'em-desktop': emDesktop,
    'white-matter': whiteMatter,
    'ndex-large': ndexLarge,
    'ndex-x-large': ndexXLarge,
    'v3-default': v3Default,
    'compound-fixture': compoundFixture,
    gen: generated,
    compound: generated,
  };

  return {
    /**
     * The sheet for a network.
     *
     * @param kind 'production' | 'plain'
     * @param networkID the key in `networks`
     * @param elements  { nodes, edges } in definition form, for data extents
     * @param def       the `networks` entry (labelKey and friends)
     */
    sheet: function (kind, networkID, elements, def) {
      var build = kind === 'plain' ? plain : production[networkID] || generated;

      return build(elements, def || {});
    },

    kinds: ['production', 'plain'],
  };
})();

// see debug/fixtures.js — the module suite loads these as scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = styles;
}
