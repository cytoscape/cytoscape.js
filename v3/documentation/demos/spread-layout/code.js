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
        name: 'spread',
        minDist: 40
      },

      style: [
        {
          selector: 'node',
          style: {
            'content': 'data(id)',
            'font-size': 8,
            'background-color': '#ea8a31'
          }
        },

        {
          selector: 'edge',
          style: {
            'curve-style': 'haystack',
            'haystack-radius': 0,
            'width': 3,
            'opacity': 0.666,
            'line-color': '#fcc694'
          }
        }
      ],

      elements: data
    });
  });
