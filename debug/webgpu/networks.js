/* eslint-disable no-unused-vars */

// Networks for the WebGPU harness; fixture JSON is reused from ../webgl/.
// The 'gen' pseudo-network is generated in-page: control its size with the
// ?gen=NxM URL param (e.g. ?network=gen&gen=100000x300000).

var networks = {
  'em-web': {
    desc: 'EnrichmentMap web',
    nodes: 569,
    edges: 6899,
    url: '../webgl/network-em-web.json'
  },
  'em-desktop': {
    desc: 'EnrichmentMap desktop',
    nodes: 1260,
    edges: 16030,
    url: '../webgl/network-em-desktop.json',
    styleUrl: '../webgl/network-em-desktop-style.json'
  },
  'white-matter': {
    desc: 'White Matter',
    nodes: 1499,
    edges: 18288,
    url: '../webgl/network-white-matter.json',
    styleUrl: '../webgl/network-white-matter-style.json'
  },
  'ndex-large': {
    desc: 'NDEX large',
    nodes: 3238,
    edges: 68641,
    url: '../webgl/network-ndex-large.json',
    styleUrl: '../webgl/network-ndex-large-style.json'
  },
  'ndex-x-large': {
    // local copy slimmed to the fields the gpu prototype reads
    // (id/source/target/position); the full-fat original lives at
    // https://pub-835fc16db602427ba8b9a874e4754257.r2.dev/network-ndex-x-large.json
    desc: 'NDEX x-large',
    nodes: 19607,
    edges: 464657,
    url: 'network-ndex-x-large.json',
    styleUrl: '../webgl/network-ndex-x-large-style.json'
  },
  'gen': {
    desc: 'Random generated (?gen=NxM)',
    nodes: '?',
    edges: '?',
    generated: true
  }
};
