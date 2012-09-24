$(function(){
  $('#demo').cytoscape({
    elements: { // TODO specify some elements like http://cytoscapeweb.cytoscape.org/demos/simple
      nodes: [ {} ],
      edges: []
    },

    // TODO specify a nice style like http://cytoscapeweb.cytoscape.org/demos/simple
    style: cytoscape.stylesheet()
      .selector("node")
        .css({
          "content": "data(id)",
          "shape": "data(shape)"
        })
    ,

    ready: function(){
      window.cy = this; // for debugging
    }
  });
});