/*
This demo visualises the railway stations in Tokyo (東京) as a graph.

This demo gives examples of

- loading elements via ajax
- loading style via ajax
- using the preset layout with predefined positions in each element
- using motion blur for smoother viewport experience
- using `min-zoomed-font-size` to show labels only when needed for better performance
*/

$(function(){
  
  // get exported json from cytoscape desktop via ajax
  var graphP = $.ajax({
    url: 'https://cdn.rawgit.com/maxkfranz/934042c1ecc464a8de85/raw/', // tokyo-railways.json
    type: 'GET',
    dataType: 'json'
  });
  
  // also get style via ajax
  var styleP = $.ajax({
    url: 'https://cdn.rawgit.com/maxkfranz/2c23fe9a23d0cc8d43af/raw/', // tokyo-railways-style.cycss
    type: 'GET',
    dataType: 'text'
  });
  
  // when both graph export json and style loaded, init cy
  Promise.all([ graphP, styleP ]).then(initCy);
  
  function initCy( then ){
    var loading = document.getElementById('loading');
    var expJson = then[0];
    var styleJson = then[1];
    var elements = expJson.elements;
    
    loading.classList.add('loaded');
    
    var cy = window.cy = cytoscape({
      container: document.getElementById('cy'),
      layout: { name: 'preset' },
      style: styleJson,
      elements: elements,
      motionBlur: true,
      selectionType: 'single',
      boxSelectionEnabled: false
    });

  }
});