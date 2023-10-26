/* eslint-disable no-console, no-unused-vars */
/* global $, cytoscape, options, cy */

var cy, defaultSty, options;

(function(){
  defaultSty  = cytoscape.stylesheet()

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

    style: [{
      "selector": "node",
      "style": {
        "shape": "data(type)",
        "label": "data(type)",
        "height": 40,
        "width": 40,
        "outline-opacity": 0.5,
        "outline-width": 3,
        "outline-color": "red",
        "outline-offset": 10
      }
    }, {
      "selector": "node[points]",
      "style": {
        "shape-polygon-points": "data(points)",
        "label": "polygon\n(custom points)",
        "text-wrap": "wrap"
      }
    }]
    ,

    elements: [{
      "data": {
        "type": "ellipse"
      }
    }, {
      "data": {
        "type": "triangle"
      }
    }, {
      "data": {
        "type": "round-triangle"
      }
    }, {
      "data": {
        "type": "rectangle"
      }
    }, {
      "data": {
        "type": "round-rectangle"
      }
    }, {
      "data": {
        "type": "bottom-round-rectangle"
      }
    }, {
      "data": {
        "type": "cut-rectangle"
      }
    }, {
      "data": {
        "type": "barrel"
      }
    }, {
      "data": {
        "type": "rhomboid"
      }
    }, {
      "data": {
        "type": "right-rhomboid"
      }
    }, {
      "data": {
        "type": "diamond"
      }
    }, {
      "data": {
        "type": "round-diamond"
      }
    }, {
      "data": {
        "type": "pentagon"
      }
    }, {
      "data": {
        "type": "round-pentagon"
      }
    }, {
      "data": {
        "type": "hexagon"
      }
    }, {
      "data": {
        "type": "round-hexagon"
      }
    }, {
      "data": {
        "type": "concave-hexagon"
      }
    }, {
      "data": {
        "type": "heptagon"
      }
    }, {
      "data": {
        "type": "round-heptagon"
      }
    }, {
      "data": {
        "type": "octagon"
      }
    }, {
      "data": {
        "type": "round-octagon"
      }
    }, {
      "data": {
        "type": "star"
      }
    }, {
      "data": {
        "type": "tag"
      }
    }, {
      "data": {
        "type": "round-tag"
      }
    }, {
      "data": {
        "type": "vee"
      }
    }, {
      "data": {
        "type": "polygon",
        "points": [
          -0.33, -1,
          0.33, -1,
          0.33, -0.33,
          1, -0.33,
          1, 0.33,
          0.33, 0.33,
          0.33, 1,
          -0.33, 1,
          -0.33, 0.33,
          -1, 0.33,
          -1, -0.33,
          -0.33, -0.33
        ]
      }
    }]
    
  };

  cy = cytoscape(options);
})();
