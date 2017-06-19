fetch('data.json', {mode: 'no-cors'})
  .then(function(res) {
    return res.json()
  })
  .then(function(data) {
    var cy = window.cy = cytoscape({
      container: document.getElementById('cy'),
      elements: data.elements,
      layout: {
        name: 'preset'
      },
      style: [{
          selector: 'node',
          style: {
            'label': 'data(label)',
            'background-color': '#aaa'
          }
        },
        {
          selector: 'edge',
          style: {
            'opacity': 0.2,
            'line-color': '#ccc',
            'width': 3
          }
        }
      ]
    });
  });
