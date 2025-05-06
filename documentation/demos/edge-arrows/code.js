/* global document, window, fetch, cytoscape */

(function(){
  var toJson = function(res){ return res.json(); };

  Promise.all([
    fetch('cy-style.json').then(toJson),
    fetch('data.json').then(toJson)
  ]).then(function(dataArray) {
    var cy = window.cy = cytoscape({
      container: document.getElementById('cy'),

      layout: {
        name: 'grid',
        columns: 4
      },

      style: dataArray[0],

      elements: dataArray[1]
    });

    document.getElementById('hollow').addEventListener('click', function(){
      cy.edges().toggleClass('hollow');
    });
  });
})();
