fetch('data.json', {mode: 'no-cors'})
  .then(function(res) {
    return res.json()
  })
  .then(function(data) {
    var cy = window.cy = cytoscape({
      // these options hide parts of the graph during interaction
      //hideEdgesOnViewport: true,
      //hideLabelsOnViewport: true,

      // this is an alternative that uses a bitmap during interaction
      // textureOnViewport: true,

      // interpolate on high density displays instead of increasing resolution
      // pixelRatio: 1,

      // a motion blur effect that increases perceived performance for little or no cost
      // motionBlur: true,

      container: document.getElementById('cy'),

      style: cytoscape.stylesheet()
        .selector('node')
          .css({
            'width': 'mapData(weight, 0, 100, 10, 60)',
            'height': 'mapData(weight, 0, 100, 10, 60)'
          })
        .selector('edge')
          .css({
            'opacity': '0.666',
            'width': 'mapData(weight, 0, 100, 1, 6)',
            'curve-style': 'haystack' // fast edges!
          })
        .selector(':selected')
         .css({
           'background-color': 'black',
           'opacity': 1
         }),

      layout: {
        name: 'concentric',
        concentric: function( ele ){ return ele.data('weight'); },
        levelWidth: function( nodes ){ return 10; },
        padding: 10
      },

      elements: data
    });
  });
