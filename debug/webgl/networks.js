
// The style can be in the same file as the netowrk or in a separate file.

var networks = {
  'style_test': {
    desc: 'Style Test',
    nodes: 5,
    edges: 13,
    url: 'network-styles.json',
    layout: { name: 'preset' }
  },
  'curve_test': {
    desc: 'Curve Test',
    nodes: 3,
    edges: 7,
    url: 'network-curve.json',
    layout: { name: 'preset' }
  },
  // 'compound': {
  //   desc: 'Compound nodes',
  //   nodes: 6,
  //   edges: 2,
  //   url: 'network-compound-nodes.json',
  //   layout: { name: 'preset' }
  // },
  // 'images': {
  //   desc: 'Image Load Test',
  //   nodes: 5,
  //   edges: 10,
  //   url: 'network-images.json',
  //   layout: { name: 'preset' }
  // },
  'em-web': {
    desc: 'EnrichmentMap web',
    nodes: 569,
    edges: 6899,
    url: 'network-em-web.json',
    layout: { name: 'preset' }
  },
  'em-desktop': {
    desc: 'EnrichmentMap desktop',
    nodes: 1260,
    edges: 16030,
    url: 'network-em-desktop.json',
    layout: { name: 'preset' },
    style: { file: 'network-em-desktop-style.json' },
  },
  'white-matter': {
    desc: 'White Matter',
    nodes: 1499,
    edges: 18288,
    url: 'network-white-matter.json',
    layout: { name: 'preset' },
    style: { file: 'network-white-matter-style.json' },
  },
  'ndex-large': {
    desc: 'NDEX large',
    nodes: 3238,
    edges: 68641,
    url: 'https://pub-835fc16db602427ba8b9a874e4754257.r2.dev/network-ndex-large.json',
    // url: 'network-ndex-large.json',
    layout: { name: 'preset' },
    style: { file: 'network-ndex-large-style.json' },
  },
  // 'ndex-x-large': {
  //   desc: 'NDEX x-large',
  //   nodes: 19607,
  //   edges: 464657,
  //   url: 'https://pub-835fc16db602427ba8b9a874e4754257.r2.dev/network-ndex-x-large.json',
  //   layout: { name: 'preset' },
  //   style: { file: 'network-ndex-x-large-style.json' },
  // }
};
