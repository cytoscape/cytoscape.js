/* global document, window, fetch, cytoscape */

(function(){
  var toJson = function(res){ return res.json(); };

  window.cy = cytoscape({
    container: document.getElementById('cy'),

    layout: {
      name: 'grid'
    },

    renderer: {
      name: 'gpu'
    },

    style: fetch('cy-style.json').then(toJson),

    elements: fetch('data.json').then(toJson)
  });
})();