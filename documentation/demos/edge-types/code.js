/* global document, window, fetch, cytoscape */

(function(){
  var toJson = function(res){ return res.json(); };

  var cy = window.cy = cytoscape({
    container: document.getElementById('cy'),

    layout: {
      name: 'grid',
      columns: 4
    },

    style: fetch('cy-style.json').then(toJson),

    elements: fetch('data.json').then(toJson)
  });

  cy.ready(function(){ // make taxi nodes better organised
    var n19 = cy.$('#n19');
    var n17 = cy.$('#n17');
    var n18 = cy.$('#n18');
    var p17 = n17.position();
    var p18 = n18.position();
    var d = (p18.x - p17.x)/4;

    n19.position({
      x: (p17.x + p18.x)/2,
      y: p17.y - d
    });

    n17.add(n18).position({ y: p17.y + d });

    //// make round-taxi nodes better organised
    var n23 = cy.$('#n23');
    var n21 = cy.$('#n21');
    var n22 = cy.$('#n22');
    var p21 = n21.position();
    var p22 = n22.position();
    var dr = (p22.x - p21.x)/4;

    n23.position({
      x: (p21.x + p22.x)/2,
      y: p21.y
    });

    n21.add(n22).position({ y: p21.y + 2 * dr });

  });
})();