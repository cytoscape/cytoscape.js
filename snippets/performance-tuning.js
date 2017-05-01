yourDiv.style.left = 0;
yourDiv.style.top = 0;
yourDiv.style.width = "100%";
yourDiv.style.height = "100%";
yourDiv.style.position = "absolute";

var fetchJson = function( path ){
  return fetch( path ).then(function( res ){
    return res.json();
  });
};

var cytoscape = require("cytoscape");

var cy = cytoscape({
  // these options hide parts of the graph during interaction
  //hideEdgesOnViewport: true,
  //hideLabelsOnViewport: true,

  // this is an alternative that uses a bitmap during interaction
  // textureOnViewport: true,

  // interpolate on high density displays instead of increasing resolution
  pixelRatio: 1,

  // a motion blur effect that increases perceived performance for little or no cost
  // motionBlur: true,

  container: yourDiv,

  style: cytoscape.stylesheet()
  .selector('node')
    .style({
      'width': 'mapData(weight, 0, 100, 10, 60)',
      'height': 'mapData(weight, 0, 100, 10, 60)'
    })
  .selector('edge')
    .style({
      'opacity': '0.666',
      'width': 'mapData(weight, 0, 100, 1, 6)',
      'curve-style': 'haystack' // fast edges!
    })
  .selector(':selected')
    .style({
      'background-color': 'black',
      'opacity': 1
    }),

  layout: {
    name: 'concentric',
    concentric: function( node ){ return node.data('weight'); },
    levelWidth: function( nodes ){ return 10; },
    padding: 10
  },

  elements: fetchJson('./data/performance-tuning.json')
});
