$(function(){

  var nodeCount = 10;
  var edgeCount = 12;

  var demoNodes = [];
  var demoEdges = [];

  var r = $('#demo').width() * 0.333;
  var ctr = {
    x: $('#demo').width()/2,
    y: $('#demo').height()/2
  };

  for (var i = 0; i < nodeCount; i++) {
    var theta = 2 * Math.PI * i / nodeCount;

    demoNodes.push({
      data: {
        id: 'n' + i,
        weight: Math.round( Math.random() * 100 )
      },

      position: {
        x: ctr.x + r * Math.cos(theta),
        y: ctr.y + r * Math.sin(theta)
      }
    });
  }

  for (var i = 0; i < nodeCount; i++) {
    demoEdges.push({
      data: {
        id: 'e' + (i * 2),
        source: 'n' + ((i + 1) >= nodeCount ? i + 1 - nodeCount : i + 1),
        target: 'n' + i,
        weight: 30
      }
    });

    if (i % 2 == 0) {
      demoEdges.push({
        data: {
          id: 'e' + (i * 2 + 1),
          target: 'n' + i,
          source: 'n' + ((i + 3) >= nodeCount ? i + 3 - nodeCount : i + 3),
          weight: 21
        }
      });
    }
  }

  $('#demo').cytoscape({
    layout: {
      name: 'preset'
    },

    elements: { 
      nodes: demoNodes,
      edges: demoEdges
    },

    style: cytoscape.stylesheet()
      .selector('node')
        .css({
          'content': 'data(id)'
        })
      .selector('edge')
        .css({
          'target-arrow-shape': 'triangle',
          'source-arrow-shape': 'circle'
        })
      .selector(':selected')
        .css({
          'background-color': '#000',
          'line-color': '#000',
          'source-arrow-color': '#000',
          'target-arrow-color': '#000'
        })
    ,

    ready: function(){
      var cy = this; // now, we can do stuff
    
    }
    
  });
  
});