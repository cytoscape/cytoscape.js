var domReady = new Promise(function(resolve) {
  window.addEventListener('DOMContentLoaded', function() {
    resolve();
  });
});

var fetchData = fetch('data.json')
  .then(function(res) {
    return res.json()
  });

var initCy = function(cy3json) {
  return cytoscape({
    container: document.getElementById('cy'),

    layout: {
      name: 'cola'
    },

    style: [{
        selector: 'node',
        css: {
          'content': 'data(label)',
          'text-valign': 'center',
          'text-halign': 'center'
        }
      },
      {
        selector: '$node > node',
        css: {
          'padding-top': '10px',
          'padding-left': '10px',
          'padding-bottom': '10px',
          'padding-right': '10px',
          'text-valign': 'top',
          'text-halign': 'center',
          'background-color': '#bbb'
        }
      },
      {
        selector: 'edge',
        css: {
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier'
        }
      },
      {
        selector: ':selected',
        css: {
          'background-color': '#aaa',
          'line-color': 'black',
          'target-arrow-color': 'black',
          'source-arrow-color': 'black'
        }
      }
    ],

    elements: cy3json
  });
};

Promise.all([fetchData, domReady])
  .then(function(val) {
    return initCy(val[0]);
  })
  .then(function(cy) {
    window.cy = cy; // put it in the window so you can play with the instance
  });
