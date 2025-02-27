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
        name: 'cose-bilkent',
        animate: false
      },

      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#ad1a66'
          }
        },

        {
          selector: 'edge',
          style: {
            'width': 3,
            'line-color': '#ad1a66'
          }
        }
      ],

      elements: data
    });
  });
