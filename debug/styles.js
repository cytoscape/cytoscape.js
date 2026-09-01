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
// One thing these sheets deliberately cannot reproduce, a decided design:
// `z-index` was dropped outright 2026-08-01.  Draw order in v4 is structural
// (parents, then edges, then leaves, then labels), so EnrichmentMap's
// "selected nodes to the front" has no v4 spelling.
//
// Two rules govern every sheet here (the maintainer's, round 57.11 —
// v3's own philosophy):
//   * **The default style carries the affordances**: grey bodies, blue on
//     selection, the active-overlay press wash — all default-sheet rules
//     since round 57.1.  The 'default' kind is therefore an *empty* sheet,
//     and the four v3 demo ports add only what their demo exercises.
//   * **A custom sheet must not bury those affordances.**  Selection blue is
//     a default-sheet conditional, so any sheet naming a colour channel
//     replaces it — exactly as in v3, where the default `:selected` block
//     loses to any later block naming the same property.  Every sheet below
//     therefore re-states selection: constant colours through `selectable`,
//     case mappers through `withSelected`, and scale-mapped colours (a
//     `then` cannot nest a mapper) through another channel — a border or an
//     underlay, which is how real v3 apps solve the same problem.  A spec
//     in `test/modules/debug-harness.mjs` selects an element under every
//     sheet and fails if nothing visible changes.

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

  // -- selection stays visible (round 57.11) -------------------------------

  var SELECT_BLUE = '#0169D9'; // v3's selection blue, the default sheet's own

  /** A constant colour that still turns selection blue. */
  function selectable(colour) {
    return {
      case: [{ when: { selected: true }, then: SELECT_BLUE }],
      else: colour,
    };
  }

  /** A `case` mapper with the selected clause prepended, so selection wins
   * over the sheet's own clauses. */
  function withSelected(mapper) {
    var out = {
      case: [{ when: { selected: true }, then: SELECT_BLUE }].concat(
        mapper.case,
      ),
    };

    if ('else' in mapper) {
      out.else = mapper.else;
    }
    if ('fallback' in mapper) {
      out.fallback = mapper.fallback;
    }

    return out;
  }

  /** `selected ? then : otherwise` for any prop. */
  function onSelected(then, otherwise) {
    return {
      case: [{ when: { selected: true }, then: then }],
      else: otherwise,
    };
  }

  // -- the default sheet: v4 exactly as it comes (round 57.11) --------------
  //
  // An empty sheet: grey nodes and edges, blue on selection, the press
  // overlay — v3's default look, carried by v4's default stylesheet since
  // round 57.1.  Useful when you are looking at the *renderer* or at the
  // default affordances themselves: nothing to blame but geometry, and
  // nothing on top to bury the built-ins.  (This replaced the old 'plain'
  // hand-written sheet, which was itself a style — small blue discs — and so
  // demonstrated neither the defaults nor the renderer alone.)

  function defaultSheet(elements, def) {
    return {};
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
          // EnrichmentMap reserves a fat transparent border so a selected node
          // can fill it without moving anything: 12px at zero opacity, filled
          // on selection — the web app's own affordance (round 57.11)
          'border-width': 12,
          'border-opacity': onSelected(1, 0),
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
        'line-color': selectable('#888'),
        'line-opacity': onSelected(0.9, 0.3),
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
          // fill is data-mapped (a `then` cannot nest a mapper), so selection
          // takes the border instead (round 57.11)
          'border-width': onSelected(4, 1),
          'border-color': selectable('#333333'),
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
        'line-color': selectable('#9aa5b1'),
        'line-opacity': onSelected(0.9, 0.35),
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
          // selection first, then the three classifications (round 57.11)
          'background-color': withSelected({
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
          }),
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
        'line-color': selectable('#009900'),
        'line-opacity': onSelected(0.9, 0.2),
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
          // fill is scale-mapped, so selection takes the border (57.11)
          'border-width': onSelected(3, 1),
          'border-color': selectable('#ffffff'),
          'border-opacity': onSelected(1, 0.7),
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
        'line-color': selectable('#c4ccd4'),
        'line-opacity': onSelected(0.9, 0.35),
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
          'background-color': withSelected({
            case: [{ when: { data: 'Node_Type', eq: 'TF' }, then: '#3366ff' }],
            else: '#66ccff',
          }),
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
        // the line colour is data-mapped, so a selected edge shows through
        // a blue underlay stroke instead (round 57.11)
        'line-opacity': onSelected(1, 0.25),
        'underlay-color': SELECT_BLUE,
        'underlay-opacity': onSelected(0.4, 0),
        'underlay-padding': 2,
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
          // fill is scale-mapped, so selection takes a border (57.11)
          'border-width': onSelected(3, 0),
          'border-color': SELECT_BLUE,
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
      edges: { width: 1, 'line-color': selectable('#bbb'), opacity: 0.6 },
      parents: {
        padding: 14,
        'background-opacity': onSelected(0.25, 0.06),
        'background-color': selectable('#4a7dbd'),
        'border-width': 1,
        'border-color': selectable('#4a7dbd'),
        'border-opacity': onSelected(1, 0.35),
      },
    };
  }

  // Round 112: the workflow-DAG scenes — the flow layout's recommended
  // pairing made visible.  The generated sheet's band colouring stays
  // (stage = colour, so ranks read as rows); edges take the taxi
  // contract the layout is designed for: round-taxi, downward, a 20px
  // turn near the source so a long edge's vertical leg runs in the
  // reserved corridor, and arrowheads so direction is legible.
  function workflowDag(elements, def) {
    var sheet = generated(elements, def);

    return Object.assign({}, sheet, {
      nodes: Object.assign({}, sheet.nodes, { width: 18, height: 18 }),
      edges: {
        width: 1.5,
        'line-color': selectable('#9aa5b1'),
        opacity: 0.85,
        'curve-style': 'round-taxi',
        'taxi-direction': 'downward',
        'taxi-turn': 20,
        'taxi-radius': 8,
        'target-arrow-shape': 'triangle',
        'target-arrow-color': selectable('#9aa5b1'),
        'arrow-scale': 0.8,
      },
    });
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
          'background-color': selectable('#e07a5f'),
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
        'line-color': selectable('#3d405b'),
        'line-opacity': onSelected(1, 0.6),
        'curve-style': 'bezier',
        'target-arrow-shape': 'triangle',
        'target-arrow-color': selectable('#3d405b'),
      },
      parents: {
        padding: 16,
        // the parents block *overlays* the nodes block (round 14.6), so the
        // shape mapper above reaches parents too and resolves 'ellipse' for
        // them — they carry no `shape` data.  v3's `:parent` default is
        // rectangle, and a round parent box round a rectangular child reads
        // as a mistake, so say so here rather than leave it to the overlay.
        shape: 'rectangle',
        'background-color': selectable('#81b29a'),
        'background-opacity': onSelected(0.4, 0.18),
        'border-width': 2,
        'border-color': selectable('#81b29a'),
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
  // `[source = "c"][target = "e"]`, …).  v4 has no selectors, so each of
  // those becomes a `case` mapper over `data( 'id' )` — declarative and
  // serializable.  (Round 63's `bypasses` section is the other spelling
  // for most props; the mappers stay because this sheet is also the mapper
  // demo.)
  //
  // **The former deviation, closed by bypasses (round 96).**  The
  // list-valued curve parameters — `control-point-distances`/`-weights`,
  // `segment-distances`/`-weights`/`-radii` — and the arrow *widths* accept
  // constants only; they reject mappers outright.  v3 gives `ab`, `bc`, `eh`
  // and `ed` each their own arrays, and a `case` mapper cannot carry them —
  // but a round-63 bypass entry is a per-element *constant*, which is
  // exactly what a per-edge array is.  So for the list props the bypass is
  // not the other spelling but the only one, and the `bypasses` section
  // below carries v3's four arrays verbatim (`v3/debug/init.js`).  The
  // constants in the edges block remain as the family defaults for any
  // other edge switched into those families.  Nothing is lost any more;
  // `test/modules/debug-harness.mjs` pins the four edges' route points to
  // v3's values.
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
          'background-color': selectable('#dfe6ee'),
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
        'line-color': selectable('#5b6472'),
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
        'source-arrow-color': selectable('#5b6472'),
        'target-arrow-color': selectable('#5b6472'),
        'mid-source-arrow-color': selectable('#5b6472'),
        'mid-target-arrow-color': selectable('#5b6472'),
        'source-arrow-fill': 'hollow',
        'target-arrow-fill': 'hollow',
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
        // Family defaults for any edge *toggled* into these families — every
        // edge that starts in one carries its own arrays in `bypasses` below.
        // Deliberately distinct from every bypass entry, so the spec's
        // control (drop the section, watch all four edges move) can prove
        // each entry load-bearing.
        'control-point-distances': [30, -120, 30],
        'control-point-weights': [0.2, 0.5, 0.8],
        'segment-distances': [30, -60],
        'segment-weights': [0.3, 0.6],
        'segment-radii': [15, 15],
        'haystack-radius': 0.5,
        'taxi-direction': 'downward',
        'taxi-turn-min-distance': 50,
        'taxi-radius': 50,
      },
      parents: {
        shape: 'rectangle',
        padding: 20,
        'background-color': selectable('#81b29a'),
        'background-opacity': onSelected(0.4, 0.15),
        'border-width': 2,
        'border-color': selectable('#81b29a'),
        label: { data: 'id' },
        'text-valign': 'top',
        'text-margin-y': -4,
        'font-size': 12,
        color: '#2f4f42',
      },
      // v3's per-edge curve arrays, verbatim (`v3/debug/init.js`) — the
      // list props' only per-edge spelling; see the note above the function
      bypasses: {
        ab: {
          'control-point-distances': [20, -100, 20],
          'control-point-weights': [0.25, 0.5, 0.75],
        },
        bc: {
          'segment-distances': [20, -80],
          'segment-weights': [0.25, 0.5],
        },
        ed: {
          'segment-distances': [-100],
          'segment-weights': [0.5],
        },
        eh: {
          'segment-distances': [-50, -50, -50],
          'segment-weights': [0.25, 0.5, 0.75],
          'segment-radii': [50, 50, 50],
        },
      },
    };
  }

  // -- round 57.5: the four demos ported from v3's documentation -----------
  //
  // Where v3 writes a class selector these read a data key through a `case`
  // mapper, which is v4's answer to per-element styling: declarative, so it
  // stays analyzable, serializable and (for paint channels) GPU-evaluable.

  /** `case` over `data(key)`, with an else. */
  function byData(key, map, fallback) {
    return {
      case: Object.keys(map).map(function (v) {
        return { when: { data: key, eq: v }, then: map[v] };
      }),
      else: fallback,
    };
  }

  // v3's node-types demo is four properties: `shape: data(type)`, a label
  // and a 40px body — everything else is the default sheet, which is the
  // point (round 57.11): grey bodies, blue on selection, the press overlay,
  // all visible because nothing here paints over them.  v4's shape channel
  // is mapper-capable but enum-valued, so the raw `data(type)` passthrough
  // is a `case` over the keyword list — a typo in the fixture renders as the
  // `else` rather than throwing at an arbitrary element.
  function nodeTypes(elements, def) {
    var shapes = {};

    elements.nodes.forEach(function (n) {
      shapes[n.data.type] = n.data.type;
    });

    return {
      nodes: {
        shape: byData('type', shapes, 'ellipse'),
        width: 40,
        height: 40,
        // `shape-polygon-points` is constants-only (a list prop — the 12b
        // scope rule), so v3's `shape-polygon-points: data(points)` has no v4
        // spelling.  A constant is enough here because the points are read
        // only by the one node whose shape resolves to `polygon`; every other
        // node ignores them.  It is v3's own cross from the same demo.
        'shape-polygon-points': [
          -0.33, -1, 0.33, -1, 0.33, -0.33, 1, -0.33, 1, 0.33, 0.33, 0.33, 0.33,
          1, -0.33, 1, -0.33, 0.33, -1, 0.33, -1, -0.33, -0.33, -0.33,
        ],
        label: { data: 'label' },
        'text-wrap': 'wrap',
        'text-max-width': 130,
      },
    };
  }

  // v3's edge-types demo styles nothing but the curve families and the row
  // labels — default nodes, default (grey) lines, so the default selection
  // blue reads on every family (round 57.11).
  function edgeTypes(elements, def) {
    return {
      nodes: {
        label: { data: 'label' },
        'text-valign': 'center',
        'text-halign': 'left',
      },
      edges: {
        // v3's demo: `edge { width: 3 }` and straight-triangle at 10
        width: byData('type', { 'straight-triangle': 10 }, 3),
        'curve-style': byData(
          'type',
          {
            bezier: 'bezier',
            'unbundled-bezier': 'unbundled-bezier',
            'multi-unbundled-bezier': 'unbundled-bezier',
            straight: 'straight',
            haystack: 'haystack',
            segments: 'segments',
            'round-segments': 'round-segments',
            taxi: 'taxi',
            'round-taxi': 'round-taxi',
            'straight-triangle': 'straight-triangle',
          },
          'straight',
        ),
        // These list props are constants-only, so v3's *multi* row's arrays
        // serve as the family constants; the single unbundled-bezier row's
        // own arrays (120 / 0.1 in v3) ride a bypass below — the list props'
        // only per-edge spelling (round 96), the same mechanism that closed
        // the v3-default port's deviation.  The two rows draw different
        // curves again, which is the demo's point.
        'control-point-distances': [40, -40],
        'control-point-weights': [0.25, 0.75],
        'segment-distances': [40, -40],
        'segment-weights': [0.25, 0.75],
        'segment-radii': [15, 15],
        'haystack-radius': 0.5,
        'taxi-direction': 'downward',
        'taxi-turn': 20,
        'taxi-turn-min-distance': 5,
        'taxi-radius': 10,
      },
      // v3's single unbundled-bezier row (`s1-0` is the fixture's id for
      // it): `control-point-distances: 120, control-point-weights: 0.1`
      bypasses: {
        's1-0': {
          'control-point-distances': [120],
          'control-point-weights': [0.1],
        },
      },
    };
  }

  function edgeArrows(elements, def) {
    var heads = {};

    elements.edges.forEach(function (e) {
      heads[e.data.arrow] = e.data.arrow;
    });

    return {
      nodes: {
        // v3's demo body: 16px, everything else default (round 57.11)
        width: 16,
        height: 16,
        label: { data: 'label' },
        // above the node rather than beside it: a left-aligned
        // `triangle-backcurve (hollow)` is wider than the gap between
        // columns and lands on the previous row's target node
        'text-valign': 'top',
        'text-margin-y': -4,
      },
      edges: {
        'target-arrow-shape': byData('arrow', heads, 'none'),
        // hollow heads are the ones that show whether the line stops where it
        // should: v3 erases the head's footprint, v4 trims the line to it
        // (round 56), and the two agree to 0.442% on the parity scene.  A
        // filled head hides the whole question, which is why both are here.
        // NOT `byData` here: its keys come from `Object.keys`, which turns a
        // boolean into the *string* 'true', so the clause would compare
        // `eq: 'true'` against a boolean `true` and never match.  The spec in
        // `test/modules/debug-harness.mjs` caught exactly that on its first
        // run — every edge read back `filled` while the fixture alternated.
        'target-arrow-fill': {
          case: [{ when: { data: 'hollow', eq: true }, then: 'hollow' }],
          else: 'filled',
        },
        'arrow-scale': 2,
      },
    };
  }

  function labels(elements, def) {
    var VALIGN = { top: 'top', center: 'center', bottom: 'bottom' };
    var HALIGN = { left: 'left', center: 'center', right: 'right' };

    return {
      nodes: {
        // the body is default-styled (round 57.11); every prop here is a
        // *label* feature, which is what the demo exercises
        label: { data: 'label' },
        // v4 has v3's 3x3 anchor grid and **not** its `-inside` variants
        // (round 13 D3), so those three cells of v3's demo have no port; the
        // fixture drops them rather than approximating them.
        'text-valign': byData('valign', VALIGN, 'bottom'),
        'text-halign': byData('halign', HALIGN, 'center'),
        'text-wrap': byData(
          'kind',
          {
            'multiline-manual': 'wrap',
            'multiline-auto': 'wrap',
            ellipsis: 'ellipsis',
          },
          'none',
        ),
        'text-max-width': byData(
          'kind',
          { 'multiline-auto': 80, ellipsis: 120 },
          9999,
        ),
        // v4-only next to v3's page: any label takes a numeric rotation
        // (round 27.7), in radians rather than v3's '30deg' string
        'text-rotation': byData('kind', { rotated: Math.PI / 6 }, 0),
        'text-outline-width': byData('kind', { outline: 3 }, 0),
        'text-outline-color': '#5b6472',
        'text-background-opacity': byData('kind', { background: 1 }, 0),
        'text-background-color': '#888',
        'text-background-shape': 'round-rectangle',
        'text-background-padding': 3,
        'text-border-width': byData('kind', { background: 1 }, 0),
        'text-border-color': '#1d2433',
        'text-border-opacity': byData('kind', { background: 1 }, 0),
        // the outline and background cells read their text in white; the
        // else is the channel default (an omitted `else` falls through)
        color: byData('kind', { outline: '#fff', background: '#fff' }, '#000'),
      },
      edges: {
        label: { data: 'label' },
        'text-outline-width': 3,
        'text-outline-color': '#fff',
        // the edge label re-angles in the vertex shader from the live endpoint
        // positions, so dragging either node re-rotates it with no rebuild
        'text-rotation': 'autorotate',
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
    'node-types': nodeTypes,
    'edge-types': edgeTypes,
    'edge-arrows': edgeArrows,
    labels: labels,
    gen: generated,
    compound: generated,
    'workflow-dag': workflowDag,
    'workflow-dag-clustered': workflowDag,
    'npm-deps': workflowDag,
    reactome: workflowDag,
  };

  return {
    /**
     * The sheet for a network.
     *
     * @param kind 'production' | 'default' ('plain', the pre-57.11 name for
     *   the non-production kind, still resolves to 'default' so old URLs work)
     * @param networkID the key in `networks`
     * @param elements  { nodes, edges } in definition form, for data extents
     * @param def       the `networks` entry (labelKey and friends)
     */
    sheet: function (kind, networkID, elements, def) {
      var build =
        kind === 'production'
          ? production[networkID] || generated
          : defaultSheet;

      return build(elements, def || {});
    },

    kinds: ['production', 'default'],
  };
})();

// see debug/fixtures.js — the module suite loads these as scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = styles;
}
