/* global document, window, fetch, cytoscape */

(function(){
  var toJson = function(res){ return res.json(); };

  var cy = window.cy = cytoscape({
    container: document.getElementById('cy'),

    layout: {
      name: 'grid',
      columns: 6
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

    // make round-taxi nodes better organised
    var n22 = cy.$('#n22');
    var n20 = cy.$('#n20');
    var n21 = cy.$('#n21');
    var p20 = n20.position();
    var p21 = n21.position();
    var dr = (p21.x - p20.x)/4;

    n22.position({
      x: (p20.x + p21.x)/2,
      y: p20.y -d
    });

    n20.add(n21).position({ y: p20.y + dr });

  });
})();