require(['cytoscape'], function(rjsCy){
  console.log( 'requirejs cytoscape OK? ' + (rjsCy === window.cytoscape) );
});

$(function(){
        
  var height, width;
  
  var defaultSty = window.defaultSty = cytoscape.stylesheet()
      .selector('node, edge')
        .css({
          // 'transition-property': 'background-color, line-color, source-arrow-color, target-arrow-color',
          // 'transition-duration': '0.25s'
        })

      .selector('node')
        .css({
          'content': 'data(id)',
          'border-width': 3,
          'background-color': '#DDD',
          'border-color': '#555',
          'shape': 'ellipse',
          //'shape': 'data(shape)',
          // 'width': 'mapData(weight, 0, 100, 5, 15)',
          // 'height': 'mapData(weight, 0, 100, 5, 15)',
          //'width': 'mapLayoutData(concentric, 0, 10, 10, 50)',
          //'height': 'mapLayoutData(concentric, 0, 10, 10, 50)',
          //'border-style': 'dashed'
          //'background-position-x': '5',
          //'background-position-y': '5',
          // 'background-image': 'images/gnu.png',
          // 'background-image-opacity': 0.5,
          // 'background-fit': 'contain',
          // 'background-repeat': 'no-repeat',
          // 'background-clip': 'none',
          //'background-position-x': 5,
          // 'pie-1-background-size': '33%',
          // 'pie-1-background-color': 'red',
          // 'pie-2-background-size': '25%',
          // 'pie-2-background-color': 'green',
          // 'pie-3-background-size': '10%',
          // 'pie-3-background-color': 'blue',
          // 'pie-4-background-size': '15%',
          // 'pie-4-background-color': 'yellow',
          // 'pie-4-background-opacity': 0.5
        })
      .selector('$node > node') // compound (parent) nodes
        .css({
          'width': 'auto',
          'height': 'auto',
          'textValign': 'bottom',
          'font-weight': 'bold',
          'font-style': 'italic',
          'background-color': '#B7E1ED',
          'padding-left': 10,
          'padding-right': 20,
          'padding-top': 5,
          'padding-bottom': 30
        })
      .selector('node[id="non-auto"]') // to init a non-auto sized compound
        .css({
          'width': 100,
          'height': 50,
          'shape': 'triangle'
          })
      .selector('edge')
        .css({
          'width': '3',
          'source-arrow-shape': 'triangle-backcurve',
          'target-arrow-shape': 'triangle',
          'mid-target-arrow-shape': 'triangle',
          'mid-source-arrow-shape': 'triangle-backcurve',
          'target-arrow-fill': 'filled',
          // 'source-arrow-shape': 'data(srcShape)',
          // 'curve-style': 'haystack',
          'opacity': 0.5
          //'content': 'data(weight)'
        })
      // .selector('[source="n1"]')
      //   .css({
      //     'control-point-distance': 200,
      //     'control-point-weight': 0
      //   })
      .selector(':selected')
        .css({
          'background-color': '#000',
          'line-color': '#000',
          'source-arrow-color': '#000',
          'target-arrow-color': '#000',
          'mid-source-arrow-color': '#000',
          'mid-target-arrow-color': '#000'
        })
  ;
  
  window.options = {
    // hideEdgesOnViewport: true,
    // hideLabelsOnViewport: true,
    // textureOnViewport: true,
    renderer: {
      name: 'canvas',
      showFps: true
    },
    // layout: {
    //   name: 'arbor',
    //   infinite: true
    // },
    style: defaultSty,
    
    elements: {
      nodes: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' } },
        { data: { id: 'd' } },
        { data: { id: 'e' } }
      ], 
      
      edges: [
        { data: { id: 'ae', weight: 1, source: 'a', target: 'e' } },
        { data: { id: 'ab', weight: 3, source: 'a', target: 'b' } },
        { data: { id: 'be', weight: 4, source: 'b', target: 'e' } },
        { data: { id: 'bc', weight: 5, source: 'b', target: 'c' } },
        { data: { id: 'ce', weight: 6, source: 'c', target: 'e' } },
        { data: { id: 'cd', weight: 2, source: 'c', target: 'd' } },
        { data: { id: 'de', weight: 7, source: 'd', target: 'e' } }
      ]
    },
    ready: function(){
      console.log('cy ready');

      window.cy = this;
      window.$$ = cytoscape;
    },
    initrender: function(){
      console.log('initrender');
      console.log(arguments);
    }
  };
  
  var cliques = 1;
  var numNodes = 2;
  var numEdges = 20;
  
  function randNodeId( clique ){
    var min = numNodes * clique / cliques;
    var max = numNodes * (clique + 1) / cliques - (cliques == 1 ? 0 : 1);
    var rand = Math.floor( Math.random() * (max - min) + min );
    var id = 'n' + rand;

    return id;
  }
  
  function randShape(){
    var r = Math.random();
    var shapes = ['ellipse', 'triangle', 'rectangle', 'roundrectangle', 'pentagon', 'hexagon', 'heptagon', 'octagon', 'star'];
    var index = Math.round( (shapes.length - 1) * r );

    return shapes[index];
  }

  function randSrcArrow(){
    var r = Math.random();
    var shapes = ['tee', 'square', 'circle', 'roundrectangle', 'none'];
    var index = Math.round( (shapes.length - 1) * r );

    return shapes[index];
  }

  function randTgtArrow(){
    var r = Math.random();
    var shapes = ['triangle', 'diamond', 'none'];
    var index = Math.round( (shapes.length - 1) * r );

    return shapes[index];
  }

  for(var i = 0; i < numNodes; i++){

    options.elements.nodes.push({
      data: {
        id: 'n' + i,
        weight: Math.round( Math.random() * 100 ),
        shape: randShape()
      }
    });
  }
  
  var j = 0;
  for(var clique = 0; clique < cliques; clique++){
    for(var i = 0; i < numEdges/cliques; i++){
      var srcId = randNodeId( clique );
      var tgtId = randNodeId( clique );

      options.elements.edges.push({
        data: {
          id: 'e' + (j++),
          source: srcId,
          target: tgtId,
          weight: Math.round( Math.random() * 100 ),
          tgtShape: randTgtArrow(),
          srcShape: randSrcArrow()
        }
      });
    }
  }
  
  var $container = $('#cytoscape');
  var $container2 = $('#cytoscape2');
  
  $container.cy(options).cy(function(){
    
    height = $container.height();
    width = $container.width();
    
    // test renderTo
    var $d = $('#dummy-canvas');
    if( $d.length > 0 ){
      var dc = $d[0].getContext('2d');
      setInterval(function(){
        dc.setTransform(1, 0, 0, 1, 0, 0);
        dc.clearRect(0, 0, 600, 600);
        cy.renderTo( dc, 0.5, { x: 0, y: 0 } );
      }, 1000/30);
    }
    
    function number(group){
      var input = $('#' + group + '-number');
      var val = parseInt( input.val() );
      
      if( isNaN(val) ){
        return 0;
      }
      
      return val;
    }
    
    function time(callback){
      var start = new Date();
      callback();
      var end = new Date();
      
      $('#add-remove-time').html( (end - start) + ' ms' );
    }
    
    $('#add-elements-button').click(function(){
      var n = number('nodes');
      var e = number('edges');
      
      var nodes = [];
      for(var i = 0; i < n; i++){
        nodes.push({
          group: 'nodes',
          data: { id: 'n' + (i + numNodes), weight: Math.round( Math.random() * 100 ) },
          position: { x: Math.random() * width, y: Math.random() * height }
        });
      }
      numNodes += n;
      
      function nodeId(){
        return randNodeId( Math.round( Math.random() * (cliques - 1) ) );
      }
      
      var edges = [];
      for(var i = 0; i < e; i++){
        edges.push({
          group: 'edges',
          data: {
            id: 'e' + (i + numEdges), 
            weight: Math.round( Math.random() * 100 ),
            source: nodeId(),
            target: nodeId()
          }
        });
      }
      numEdges += e;
      
      time(function(){
        cy.add( nodes.concat(edges) );
      });
    });

    
    $('#remove-elements-button').click(function(){
      var n = number('nodes');
      var e = number('edges');
      
      time(function(){
        cy.nodes().slice(0, n).remove();
        cy.edges().slice(0, e).remove();
      });
      

    });
    
    $('#remove-selected-button').click(function(){
      cy.elements(':selected').remove();
    });

  });

  // compound graph in the second instance
  $container2.cy({
    elements: {
       nodes: [{ data: { id: 'n8', parent: 'n4' } },
         { data: { id: 'n9', parent: 'n4' } },
         { data: { id: 'n4', parent: 'n1' } },
         { data: { id: 'n5', parent: 'n1', shape: 'triangle' } },
         { data: { id: 'n1' } },
           { data: { id: 'n2' } },
           { data: { id: 'node-really-long-name-6', parent: 'n2' } },
           { data: { id: 'n7', parent: 'n2', shape: 'square' } },
         { data: { id: 'n3', parent: 'non-auto', shape: 'rectangle' } },
         { data: { id: 'non-auto'}}],
       edges: [ { data: { id: 'e1', source: 'n1', target: 'n3' } },
           { data: { id: 'e2', source: 'n3', target: 'n7' } },
           { data: { id: 'e3', source: 'node-really-long-name-6', target: 'n7' } },
           { data: { id: 'e4', source: 'node-really-long-name-6', target: 'n9' } },
           { data: { id: 'e5', source: 'n8', target: 'n9' } },
           { data: { id: 'e6', source: 'n5', target: 'n8' } },
           { data: { id: 'e7', source: 'n2', target: 'n4' } }]
    },
    style: defaultSty,

    ready: function(){
       window.cy2 = this;
       cy2.on('click', 'node', function(evt){
           var node = this;
           console.log('%o', node);
       });
    }
  }).cy(function(){
    $('#compound-remove-selected-button').click(function(){
      cy2.elements(':selected').remove();
    });

    $('#compound-hide-selected-button').click(function(){
      cy2.elements(':selected').hide();
    });

    $('#compound-show-all-button').click(function(){
      cy2.elements().show();
    });

    var numChildren = 0;

    $('#add-child-button').click(function(){

      var parentId = $('#parent-node').val();
      var nodes = [];

      nodes.push({group: 'nodes',
                   data: {id: 'c' + numChildren, parent: parentId},
                   position: {x: Math.random() * width, y: Math.random() * height}});

      numChildren++;

      cy2.add(nodes);
    });

    $('#set-random-style').click(function(){

      var nodes = cy2.elements('node:selected');

      for (var i=0; i < nodes.size(); i++)
      {
        var shapes = ['triangle', 'rectangle', 'ellipse', 'pentagon'];

        // pick a random shape and dimensions
        nodes[i].css({'width': Math.round(Math.random() * 50 + 1),
          'height': Math.round(Math.random() * 50 + 1),
          'shape': shapes[Math.floor(Math.random() * 4)]});
      }

    });
  });
  


  
});