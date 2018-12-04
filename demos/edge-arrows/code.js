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

  document.getElementById('hollow').addEventListener('click', function(){
    cy.edges().toggleClass('hollow');
  });
})();