/* eslint-disable no-console, no-unused-vars */
/* global $, cytoscape, options, cy */

var cy, defaultSty, options;

(function () {
  defaultSty = {
    "curve-style": "unbundled-bezier",
    "control-point-weight": 0.5,
    "control-point-distance": 20,
  };
  options = {
    container: $("#cytoscape"),

    renderer: {
      name: "canvas",
      showFps: true,
    },

    elements: [
      // { data: { id: 1 }, position: { x: 0, y: 0 } },
      // { data: { id: 2 }, position: { x: 40, y: 0 } },
      // { data: { id: "e1", source: 1, target: 2 } }, // normal

      { data: { id: 3 }, position: { x: 0, y: 40 } },
      { data: { id: 4 }, position: { x: 20, y: 40 } },
      { data: { id: "e2", source: 3, target: 4 } }, // disappear
      // { data: { id: 7 }, position: { x: 20, y: 40 } },
      // { data: { id: 8 }, position: { x: 20, y: 60 } },
      // { data: { id: "e2", source: 7, target: 8 } }, // disappear

      // { data: { id: 5 }, position: { x: 0, y: 80 } },
      // { data: { id: 6 }, position: { x: 19, y: 80 } },
      // { data: { id: "e3", source: 5, target: 6 } }, // flip
    ],
    style: [
      { selector: "node", style: { width: 20, height: 20 } },
      {
        selector: "edge",
        style: {
          "curve-style": "unbundled-bezier",
          "control-point-weight": 0.5,
          "control-point-distance": 20,
        },
      },
    ],
    layout: { name: "preset" },
  };

  cy = cytoscape(options);
})();
