/* eslint-disable no-console, no-unused-vars */
/* global $, cytoscape, options, cy */

var cy, defaultSty, options;

(function(){
  options = {
    container: $('#cytoscape'),
    renderer: {
      name: 'canvas',
      showFps: true
    },
    webgl: true,
    layout: {
      name: 'preset',
      animate: false
    },

    style: [{
        "selector": "node",
        "style": {
          "border-width": "12px",
          "border-opacity": "0",
          "width": "40px",
          "height": "40px",
          "font-size": "8px",
          "text-valign": "center",
          "text-wrap": "wrap",
          "text-max-width": "80px",
          "background-color": "lightblue",
          "z-index": "1",
          "label": "data(description)",
          'text-outline-width': 2,
          'color': '#fff',
          'background-color': 'mapData(NES, -3.14, 3.14, blue, red)',
          'text-outline-color': 'mapData(NES, -3.14, 3.14, blue, red)',
        },
      },
      {
        selector: 'edge',
        style: {
          'line-color' : '#888',
          'line-opacity': 0.9,
          'curve-style': 'haystack',
          'haystack-radius': 0,
          'width': ele => ele.data('similarity_coefficient') * 15,
        }
      },
    ]
  };

  fetch('./em-network.json')
    .then(res => res.json())
    .then(json => {
      options.elements = json.elements;
      cy = cytoscape(options);
    });

})();
