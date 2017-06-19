fetch('data.json', {mode: 'no-cors'})
  .then(function(res) {
    return res.json()
  })
  .then(function(data) {
    var cy = window.cy = cytoscape({
      container: document.getElementById('cy'),

      boxSelectionEnabled: false,
      autounselectify: true,

      layout: {
        name: 'concentric',
        concentric: function( node ){
          return node.degree();
        },
        levelWidth: function( nodes ){
          return 2;
        }
      },

      style: [
        {
          selector: 'node',
          style: {
            'height': 20,
            'width': 20,
            'background-color': '#30c9bc'
          }
        },

        {
          selector: 'edge',
          style: {
            'curve-style': 'haystack',
            'haystack-radius': 0,
            'width': 5,
            'opacity': 0.5,
            'line-color': '#a8eae5'
          }
        }
      ],

      elements: data
    });
  });
