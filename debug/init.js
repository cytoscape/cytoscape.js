/* eslint-disable no-console, no-unused-vars */
/* global $, cytoscape, options, cy */

var cy, defaultSty, options;

(function(){
  defaultSty  = cytoscape.stylesheet()

      .selector('node')
        .style({
          'label': 'data(id)'
        })
      .selector('node#a')
        .style({
          'shape': 'round-rectangle',
          'width': 35,
          'corner-radius': 200
        })
      .selector('node#b')
      .style({
        'shape': 'round-triangle',
        'width': 40,
        'corner-radius': 4
      })

      .selector('edge')
        .style({
          'source-arrow-shape': 'triangle-backcurve',
          'target-arrow-shape': 'triangle',
          'mid-target-arrow-shape': 'triangle',
          'mid-source-arrow-shape': 'triangle-backcurve',
        })
      .selector('#ab')
        .style({
          'curve-style': 'unbundled-bezier',
          'control-point-distances': [ 20, -100, 20 ],
          'control-point-weights': [ 0.25, 0.5, 0.75 ],
          'source-arrow-fill': 'hollow',
          'source-arrow-width': 2,
          'target-arrow-fill': 'hollow',
          'target-arrow-width': 'match-line',
        })
      .selector('#bc')
        .style({
          'curve-style': 'segments',
          'segment-distances': [ 20, -80 ],
          'segment-weights': [ 0.25, 0.5 ],
          'source-arrow-fill': 'hollow',
          'source-arrow-width': '50%',
          'target-arrow-fill': 'hollow',
        })
      .selector('#ef')
        .style({
          'curve-style': 'straight-triangle',
          'source-arrow-shape': 'none',
          'target-arrow-shape': 'none',
          'mid-target-arrow-shape': 'none',
          'mid-source-arrow-shape': 'none',
          'width': 6,
        })
      .selector('[source = "c"][target = "e"]')
        .style({
          'curve-style': 'haystack',
          'haystack-radius': 0.5
        })
      .selector('[source = "d"][target = "e"]')
        .style({
          'curve-style': 'bezier'
        })
      .selector('[source = "b"][target = "f"]')
        .style({
          'curve-style': 'taxi'
        })
  ;

  options = {
    container: $('#cytoscape'),

    renderer: {
      name: 'canvas',
      showFps: true
    },

    layout: {
      name: 'grid',
      cols: 3
    },

    style: defaultSty,

    elements: {
      nodes: [
        { data: { id: 'a', weight: 50 } },
        { data: { id: 'b', weight: 30 } },
        { data: { id: 'c', weight: 20 } },
        { data: { id: 'd', weight: 10 } },
        { data: { id: 'e', weight: 75 } },
        { data: { id: 'f', weight: 100 } }
      ],

      edges: [
        { data: { id: 'ae', weight: 1, source: 'a', target: 'e' } },
        { data: { id: 'aa', weight: 2, source: 'a', target: 'a' } },
        { data: { id: 'aa2', weight: 2, source: 'a', target: 'a' } },
        { data: { id: 'aa3', weight: 2, source: 'a', target: 'a' } },
        { data: { id: 'ab', weight: 3, source: 'a', target: 'b' } },
        { data: { id: 'be', weight: 4, source: 'b', target: 'e' } },
        { data: { id: 'bc', weight: 5, source: 'b', target: 'c' } },
        { data: { id: 'ce', weight: 6, source: 'c', target: 'e' } },
        { data: { id: 'ce2', weight: 6, source: 'c', target: 'e' } },
        { data: { id: 'cd', weight: 2, source: 'c', target: 'd' } },
        { data: { id: 'de', weight: 7, source: 'd', target: 'e' } },
        { data: { id: 'de2', weight: 7, source: 'd', target: 'e' } },
        { data: { id: 'de3', weight: 7, source: 'd', target: 'e' } },
        { data: { id: 'de4', weight: 7, source: 'd', target: 'e' } },
        { data: { id: 'de5', weight: 7, source: 'd', target: 'e' } },
        { data: { id: 'bf', weight: 3, source: 'b', target: 'f' } },
        { data: { id: 'ef', weight: 3, source: 'e', target: 'f' } }
      ]
    }
  };

  cy = cytoscape(options);
})();
