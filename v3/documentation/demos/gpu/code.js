fetch('enrichment-map.networks.json', {mode: 'no-cors'})
  .then(function(res) {
    return res.json()
  })
  .then(function(data) {

    const nodeColor = (node) => {
      const nes = node.data('NES');
      return nes > 0 ? 'red' : 'blue';
    };

    var cy = window.cy = cytoscape({
      container: document.getElementById('cy'),

      // boxSelectionEnabled: false,
      // autounselectify: true,

      layout: {
        name: 'cose',
        animate: false
      },

      renderer: {
        name: 'canvas',
      },
      // TODO this should be under 'renderer' no?
      webgl: true,

      style: [
        {
          selector: 'node',
          style: {
            'height': 20,
            'width': 20,
            'background-color': nodeColor
          }
        },
        {
          selector: 'node:selected',
          style: {
            'background-color': 'yellow'
          }
        },
        {
          selector: 'edge',
          style: {
            'curve-style': 'haystack',
            'haystack-radius': 0,
            'width': 5,
            'opacity': 0.5,
            'line-color': '#a2efa2'
          }
        }
      ],

      elements: data.elements
    });
  });
