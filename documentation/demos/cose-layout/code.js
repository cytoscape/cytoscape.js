Promise.all([
  fetch('cy-style.json', {mode: 'no-cors'})
    .then(function(res) {
      return res.json()
    }),
  fetch('data.json', {mode: 'no-cors'})
    .then(function(res) {
      return res.json()
    })
])
  .then(function(dataArray) {
    var cy = window.cy = cytoscape({
      container: document.getElementById('cy'),

      layout: {
        name: 'cose',
        idealEdgeLength: 100,
        nodeOverlap: 20
      },

      style: dataArray[0],

      elements: dataArray[1]

    });
  });
