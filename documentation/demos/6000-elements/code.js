var domReady = new Promise(function(resolve) {
  window.addEventListener('DOMContentLoaded', function() {
    resolve();
  });
});

var fetchData = fetch('data.json', {mode: 'no-cors'})
  .then(function(res) {
    return res.json()
  });

var initCy = function(cy3json) {
  return cytoscape({
    container: document.getElementById('cy'),
    elements: cy3json.elements,
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
};

Promise.all([fetchData, domReady])
  .then(function(val) {
    return initCy(val[0]);
  })
  .then(function(cy) {
    window.cy = cy; // put it in the window so you can play with the instance
  });
