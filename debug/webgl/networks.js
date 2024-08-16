
var networks = {
  'style_test': {
    desc: 'Style Test',
    nodes: 5,
    edges: 10,
    url: 'network-tiny.json',
    layout: { name: 'cose' }
  },
  'compound': {
    desc: 'Compound nodes',
    nodes: 6,
    edges: 2,
    url: 'network-compound-nodes.json',
    layout: { name: 'preset' }
  },
  'em-web': {
    desc: 'EM web',
    nodes: 569,
    edges: 6899,
    url: 'network-em-web.json',
    layout: { name: 'preset' }
  },
  'em-desktop': {
    desc: 'EM desktop',
    nodes: 1260,
    edges: 16030,
    url: 'network-em-desktop.json',
    layout: { name: 'preset' }
  },
  'ndex-large': {
    desc: 'NDEX large',
    nodes: 3238,
    edges: 68641,
    url: 'https://pub-835fc16db602427ba8b9a874e4754257.r2.dev/network-ndex-large.json',
    layout: { name: 'preset' }
  }
};

// The style can be in the same file as the netowrk or in a separate file.
var styles = {
  'em-desktop': {
    file: 'network-em-desktop-style.json'
  },
  'ndex-large': {
    file: 'network-ndex-large-style.json'
  },
};