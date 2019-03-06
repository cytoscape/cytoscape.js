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
    var n13 = cy.$('#n13');
    var n11 = cy.$('#n11');
    var n12 = cy.$('#n12');
    var p11 = n11.position();
    var p12 = n12.position();
    var d = (p12.x - p11.x)/4;

    n13.position({
      x: (p11.x + p12.x)/2,
      y: p11.y - d
    });

    n11.add(n12).position({ y: p11.y + d });
  });
})();