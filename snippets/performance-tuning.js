yourDiv.style.left = 0;
yourDiv.style.top = 0;
yourDiv.style.width = "100%";
yourDiv.style.height = "100%";
yourDiv.style.position = "absolute";

var cytoscape = require("cytoscape");

jQuery.getJSON("./data/performance-tuning.json", function(data){
  var cy = cytoscape({
    // these options hide parts of the graph during interaction
    //hideEdgesOnViewport: true,
    //hideLabelsOnViewport: true,

    // this is an alternative that uses a bitmap during interaction
    textureOnViewport: true,

    // interpolate on high density displays instead of increasing resolution
    pixelRatio: 1,

    // a motion blur effect that increases perceived performance for little or no cost
    motionBlur: true,

    container: yourDiv,

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
      concentric: function(){ return this.data('weight'); },
      levelWidth: function( nodes ){ return 10; },
      padding: 10
    },
    elements: data 
  });
});
