/* eslint-disable no-unused-vars */

// Networks for the v4 harness.
//
// The fixture JSON is shared with v3's WebGL harness and lives under
// `v3/debug/webgl/` — round 42 moved the v3 tree there, and these paths did not
// go with it (they read `../webgl/` until round 43 fixed them, which is why
// four of these silently 404'd).  Reading a v3 asset from a v4 harness is the
// direction `benchmark/graph.mjs` and `playwright-page/parity.html` already
// take; the files are 69 MB, so a copy would double the repo's weight for
// nothing.
//
// Each entry may declare:
//   url        the elements JSON (a v3 `{ elements: { nodes, edges } }` export)
//   derive     an in-page transform applied after load (see init.js)
//   generated  build it in-page instead ('fixture' | true | 'compound')
//   labelKey   the data key `debug/styles.js` maps the label from
//   layout     the layout run at load for a network with no positions
//              (default `{ name: 'grid' }`)
//   note       a one-line "what is this fixture for", shown under the dropdown

var networks = {
  'em-web': {
    desc: 'EnrichmentMap web',
    nodes: 569,
    edges: 6899,
    url: '../v3/debug/webgl/network-em-web.json',
    labelKey: 'label',
    note: 'The enrichmentmap.org style ported to v4: a diverging NES colour mapper, wrapped labels in a matching text outline, haystack edges.',
  },
  'em-web-clustered': {
    desc: 'EnrichmentMap web, clustered',
    nodes: 610,
    edges: 6899,
    url: '../v3/debug/webgl/network-em-web.json',
    derive: 'mcode-parents',
    labelKey: 'label',
    note: 'The same network with its 41 MCODE clusters materialised as compound parents — a real compound graph from real data.',
  },
  'em-desktop': {
    desc: 'EnrichmentMap desktop',
    nodes: 1260,
    edges: 16030,
    url: '../v3/debug/webgl/network-em-desktop.json',
    labelKey: 'EM1_GS_DESCR',
    note: 'The Cytoscape desktop export: gene-set size drives node size, the two-tailed enrichment colouring drives fill.',
  },
  'white-matter': {
    desc: 'White Matter',
    nodes: 1499,
    edges: 18288,
    url: '../v3/debug/webgl/network-white-matter.json',
    labelKey: 'alias',
    note: 'A `case` mapper over the Classification column — what v3 spells as three [attr = value] selector blocks.',
  },
  'ndex-large': {
    desc: 'NDEx large',
    nodes: 3238,
    edges: 68641,
    url: '../v3/debug/webgl/network-ndex-large.json',
    labelKey: 'name',
    note: 'MCL cluster ids (1..30) through an ordinal colour scheme; edge correlation drives width and opacity.',
  },
  'ndex-x-large': {
    // Re-slimmed in round 43 from the full-fat original at
    // https://pub-835fc16db602427ba8b9a874e4754257.r2.dev/network-ndex-x-large.json
    // by `debug/slim-ndex.mjs`.  The previous slim kept id/source/target/
    // position only, which left the biggest fixture unlabellable and unstylable.
    desc: 'NDEx x-large',
    nodes: 19607,
    edges: 464657,
    url: 'network-ndex-x-large.json',
    labelKey: 'name',
    note: 'The scale fixture, and now the mapper-at-scale one: a diverging colour mapper evaluated on the GPU across 465k edges.',
  },
  'v3-default': {
    desc: 'v3 default debug graph',
    nodes: 10,
    edges: 23,
    generated: 'v3-default',
    labelKey: 'label',
    // v3's own page runs grid at cols 3, and the order in fixtures.js is v3's
    // declaration order, so this reproduces its arrangement
    layout: { name: 'grid', cols: 3 },
    note: "The graph v3's debug page opens on: three self-loops, two multi-edge fans, a compound parent, and a different curve-style on almost every edge. The one to open for arrows and edge routing.",
  },
  'compound-fixture': {
    desc: 'Compound fixture (v3 debug graph)',
    nodes: 10,
    edges: 11,
    generated: 'fixture',
    labelKey: 'id',
    // v3's page runs `cy.layout({ name: 'grid', cols: 3 })` on this graph, and
    // the 3 is not decoration: six leaves over three columns is the one
    // arrangement in which each parent's children stay adjacent, so the four
    // auto-sized parent boxes come out disjoint.  At the default column count
    // grid picks 2, which interleaves the families and nests every box inside
    // n1's — the graph the maintainer could not read.
    layout: { name: 'grid', cols: 3 },
    note: 'Ported from v3/debug/compound.js: three levels of nesting, a self-loop on a parent, parent-to-descendant edges, one very long label. Awkward on purpose.',
  },
  gen: {
    desc: 'Random generated (?gen=NxM)',
    nodes: '?',
    edges: '?',
    generated: true,
    labelKey: 'id',
    note: 'A uniform random scatter at whatever size you ask for. The scale knob.',
  },
  compound: {
    // round 14: clustered compound scene — leaves grouped under parents
    // (1 per ~20 leaves, every 4th parent nested), intra-cluster edges
    // plus a sprinkle of child->parent edges (compound loops)
    desc: 'Generated compound clusters (?gen=NxM)',
    nodes: '?',
    edges: '?',
    generated: 'compound',
    labelKey: 'id',
    note: 'Compound nodes at scale: auto-sized parents, nested parents, and compound loop edges.',
  },
};

// see debug/fixtures.js — the module suite loads these as scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = networks;
}
