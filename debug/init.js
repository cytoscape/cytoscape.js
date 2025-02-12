/* eslint-disable no-console, no-unused-vars */
/* global $, cytoscape, options, cy */

var cy, defaultSty, options;

(function(){
  defaultSty  = cytoscape.stylesheet()

      .selector('node')
        .style({
          'label': 'data(id)'
        })
      .selector('#b, #c, #f, #i')
        .style({
          'outline-offset': 5,
          'outline-color': 'red',
          'outline-opacity': 0.125,
          'outline-width': 10,
          'outline-style': 'solid',
          'border-width': 5,
          'border-opacity': 0.25,
          'border-color': 'cyan',
          'border-position': 'inside'
        })
      .selector('node#c')
        .style({
          'shape': 'round-rectangle',
          'width': 220,
          'height': 60,
          'corner-radius': 30,
          "label": "c has a long label over-\u200bflowing its max    width,\n but spa\u200bces are ke\u200bpt",
          "text-max-width": 100,
          "text-wrap": "wrap",
        })
      .selector('node#b')
        .style({
          'shape': 'round-hexagon',
          'width': 60,
          'height': 60,
          'corner-radius': 10
        })
      .selector('node#c')
        .style({
          'shape': 'round-rectangle',
          'width': 220,
          'height': 60,
          'corner-radius': 5
        })
      .selector('node#f')
        .style({
          'shape': 'cut-rectangle',
          'width': 50,
          'corner-radius': 10,
        })
      .selector('edge')
        .style({
          'source-arrow-shape': 'triangle-backcurve',
          'target-arrow-shape': 'triangle',
          'mid-target-arrow-shape': 'triangle',
          'mid-source-arrow-shape': 'triangle-backcurve',
          'label': e => e.data('id'),
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
      .selector('#fi')
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
      .selector('#ae')
        .style({
          'curve-style': 'bezier'
        })
      .selector('#be')
        .style({
          'curve-style': 'bezier'
        })
      .selector('#cf')
        .style({
          'curve-style': 'bezier'
        })
      .selector('#bf')
        .style({
          'curve-style': 'taxi'
        })
      .selector('#eg')
        .style({
          'curve-style': 'round-taxi',
          "taxi-direction": "downward",
          // "taxi-turn": 100,
          "taxi-turn-min-distance": 50,
          "taxi-radius": 50
        })
      .selector('#eh')
        .style({
          'curve-style': 'round-segments',
          "segment-distances": [-50, -50, -50],
          "segment-weights": [0.25,0.5,0.75],
          'segment-radii': [ 50, 50 , 50]
        })
      .selector('#ed')
        .style({
          'curve-style': 'segments',
          'segment-distances': [ -100 ],
          'segment-weights': [ 0.5 ]
        })
      .selector('#ei')
        .style({
          'curve-style': 'round-taxi'
        })
      .selector('#gh')
        .style({
          'curve-style': 'round-taxi'
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
        { data: { id: 'f', weight: 100 } },
        { data: { id: 'g', weight: 40 } },
        { data: { id: 'h', weight: 16 } },
        { data: { id: 'i', weight: 16 } },
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
        { data: { id: 'cf', weight: 2, source: 'c', target: 'f' } },
        { data: { id: 'de', weight: 7, source: 'd', target: 'e' } },
        { data: { id: 'ed', weight: 7, source: 'e', target: 'd' } },
        { data: { id: 'de2', weight: 7, source: 'd', target: 'e' } },
        { data: { id: 'de3', weight: 7, source: 'd', target: 'e' } },
        { data: { id: 'de4', weight: 7, source: 'd', target: 'e' } },
        { data: { id: 'de5', weight: 7, source: 'd', target: 'e' } },
        { data: { id: 'bf', weight: 3, source: 'b', target: 'f' } },
        { data: { id: 'eg', weight: 3, source: 'e', target: 'g' } },
        { data: { id: 'eh', weight: 3, source: 'e', target: 'h' } },
        { data: { id: 'ei', weight: 3, source: 'e', target: 'i' } },
        { data: { id: 'fi', weight: 3, source: 'f', target: 'i' } },
        { data: { id: 'gh', weight: 3, source: 'g', target: 'h' } },
      ]
    }
  };

  cy = cytoscape(options);
})();
