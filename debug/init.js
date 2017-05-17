// require(['cytoscape'], function(rjsCy){
//   console.log( 'requirejs cytoscape OK? ' + (rjsCy === window.cytoscape) );
// });

$(function(){

  var addRandomEles = false;
  var height, width;

  var cliques = 4;
  var numNodes = 100;
  var numEdges = 1000;

  var defaultSty = window.defaultSty = cytoscape.stylesheet()
      .selector('node, edge')
        .css({
          // 'transition-property': 'background-color, line-color, source-arrow-color, target-arrow-color',
          // 'transition-duration': '0.25s'
        })

      .selector('node')
        .css({
          'label': 'data(id)',
          // 'min-zoomed-font-size': 10,
          // 'border-width': 3,
          // 'background-color': '#888',
          // 'border-color': '#555',
          // 'shape': 'ellipse',
          // 'shape': 'polygon',
          // 'shape-polygon-points': [ 0, -1,   1, 1,   -1, 1 ],
          //'shape': 'data(shape)',
          // 'width': 'mapData(weight, 0, 100, 15, 50)',
          // 'height': 'mapData(weight, 0, 100, 15, 50)',
          //'width': 'mapLayoutData(concentric, 0, 10, 10, 50)',
          //'height': 'mapLayoutData(concentric, 0, 10, 10, 50)',
          //'border-style': 'dashed'
          //'background-position-x': '5',
          //'background-position-y': '5',
          // 'background-image': 'images/gnu.svg',
          // 'background-image-opacity': 0.5,
          // 'background-fit': 'contain',
          // 'background-repeat': 'no-repeat',
          // 'background-clip': 'none',
          //'background-position-x': 5,
          //'background-image': 'data:image/png;base64,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',
          // 'pie-1-background-size': 'mapData(weight, 0, 100, 0, 100)',
          // 'pie-1-background-color': 'red',
          // 'pie-2-background-size': '25%',
          // 'pie-2-background-color': 'green',
          // 'pie-3-background-size': '10%',
          // 'pie-3-background-color': 'blue',
          // 'pie-4-background-size': '15%',
          // 'pie-4-background-color': 'yellow',
          // 'pie-4-background-opacity': 0.5
          // 'text-rotation': Math.PI/2
        })
      .selector('$node > node') // compound (parent) nodes
        .css({
          // 'width': 'auto',
          // 'height': 'auto',
          // 'textValign': 'bottom',
          // 'font-weight': 'bold',
          // 'font-style': 'italic',
          // 'background-color': '#B7E1ED',
          // 'padding-left': 10,
          // 'padding-right': 10,
          // 'padding-top': 10,
          // 'padding-bottom': 10,
          // 'background-opacity': 1
        })
      .selector('node[id="non-auto"]') // to init a non-auto sized compound
        .css({
          // 'width': 10,
          // 'height': 10,
          // 'shape': 'triangle'
          })
      .selector('edge')
        .css({
          // 'line-color': 'red',
          // 'edge-distances': 'node-position',
          // 'source-arrow-color': '#ccc',
          // 'mid-source-arrow-color': '#ccc',
          // 'target-arrow-color': '#ccc',
          // 'mid-target-arrow-color': '#ccc',
          // 'curve-style': 'unbundled-bezier',
          // 'control-point-distance': 100,
          // 'control-point-step-size': 100,
          // 'width': '3',
          'source-arrow-shape': 'triangle-backcurve',
          'target-arrow-shape': 'triangle',
          'mid-target-arrow-shape': 'triangle',
          'mid-source-arrow-shape': 'triangle-backcurve',
          // 'target-arrow-fill': 'filled',
          // 'source-arrow-shape': 'data(srcShape)',
          // 'curve-style': 'haystack',
          // 'haystack-radius': 0.5,
          // 'opacity': 0.5
          // 'content': 'data(weight)',
          // 'text-rotation': 'autorotate',
          // 'label': 'edge',
          // 'source-label': 'src',
          // 'source-text-offset': 25,
          // 'target-label': 'tgt',
          // 'target-text-offset': 25,
          // 'text-border-opacity': 1,
          // 'text-border-width': 2,
          // 'text-border-color': 'red'
        })
      .selector('[source="n1"]')
        .css({
          // 'control-point-distance': 200,
          // 'control-point-weight': 0
        })
      .selector(':selected')
        .css({
          // 'background-color': '#000',
          // 'line-color': '#000',
          // 'source-arrow-color': '#000',
          // 'target-arrow-color': '#000',
          // 'mid-source-arrow-color': '#000',
          // 'mid-target-arrow-color': '#000'
        })
      .selector('.foo')
        .css({
          // 'width': 15
        })
      .selector('#ab')
        .css({
          'curve-style': 'unbundled-bezier',
          'control-point-distances': [ 20, -100, 20 ],
          'control-point-weights': [ 0.25, 0.5, 0.75 ],
          // 'label': 'hello world',
          // 'edge-text-rotation': 'autorotate'
        })
      .selector('#bc')
        .css({
          'curve-style': 'segments',
          'segment-distances': [ 20, -80 ],
          'segment-weights': [ 0.25, 0.5 ],
          // 'label': 'hello world'
        })
      .selector('[source = "c"][target = "e"]')
        .css({
          'curve-style': 'haystack',
          'haystack-radius': 0.5
        })
      .selector('[source = "d"][target = "e"]')
        .css({
          'curve-style': 'bezier'
        })
      .selector('node#n1')
        .css({
          // 'min-width': 400,
          // 'min-width-bias-left': 30,
          // 'min-width-bias-right': 60,
          // 'padding-left': 0,
          // 'padding-right': 0,
          // 'padding-bottom': 0,
          // 'padding-top': 0,
          // 'min-height': 400,
          // 'min-height-bias-top': 20,
          // 'min-height-bias-bottom': 40
        })
  ;

  window.options = {
    // boxSelectionEnabled: true,
    // hideEdgesOnViewport: true,
    // hideLabelsOnViewport: true,
    // textureOnViewport: true,
    // motionBlur: true,
    // pixelRatio: 'auto',
    // motionBlurOpacity: 0.125,
    renderer: {
      name: 'canvas',
      showFps: true
    },
    layout: {
      name: 'grid'
    },
    style: defaultSty,

    elements: {
      nodes: [
        { data: { id: 'a', weight: 50 } },
        { data: { id: 'b', weight: 30 } },
        { data: { id: 'c', weight: 20 } },
        { data: { id: 'd', weight: 10 } },
        { data: { id: 'e', weight: 75 } }
      ],

      edges: [
        { data: { id: 'ae', weight: 1, source: 'a', target: 'e' } },
        { data: { id: 'aa', weight: 2, source: 'a', target: 'a' } },
        { data: { id: 'aa2', weight: 2, source: 'a', target: 'a' } },
        { data: { id: 'aa3', weight: 2, source: 'a', target: 'a' } },
        { data: { id: 'ab', weight: 3, source: 'a', target: 'b' } },
        { data: { id: 'be', weight: 4, source: 'b', target: 'e' } },
        { data: { id: 'bc', weight: 5, source: 'b', target: 'c' } },
        { data: { id: 'ce', weight: 6, source: 'c', target: 'e' } },
        { data: { id: 'ce2', weight: 6, source: 'c', target: 'e' } },
        { data: { id: 'cd', weight: 2, source: 'c', target: 'd' } },
        { data: { id: 'de', weight: 7, source: 'd', target: 'e' } },
        { data: { id: 'de2', weight: 7, source: 'd', target: 'e' } },
        { data: { id: 'de3', weight: 7, source: 'd', target: 'e' } },
        { data: { id: 'de4', weight: 7, source: 'd', target: 'e' } },
        { data: { id: 'de5', weight: 7, source: 'd', target: 'e' } }
      ]
    },
    ready: function(){
      window.cy = this;
      window.$$ = cytoscape;
    }
  };

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

  if( addRandomEles ){
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
  }

  var $container = $('#cytoscape');
  var $container2 = $('#cytoscape2');

  options.container = $container;

  window.cy = cytoscape(options);

  cy.ready(function(){

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

  var init2;
  $('#init2').on('click', init2 = function(){
    // compound graph in the second instance
    window.cy2 = cytoscape({
      container: $container2,

      renderer: {
        name: 'canvas',
        showFps: true
      },

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
             { data: { id: 'e7', source: 'n2', target: 'n4' } },
             { data: { id: 'e8', source: 'n8', target: 'n8' } },
             { data: { id: 'e9', source: 'n1', target: 'n1' } },
             { data: { id: 'e10', source: 'n1', target: 'n9' } },
             { data: { id: 'e11', source: 'n4', target: 'n1' } }
          ]
      },
      style: defaultSty,

      ready: function(){
         window.cy2 = this;
         cy2.on('click', 'node', function(evt){
             var node = this;
             console.log('%o', node);
         });
      }
    }).ready(function(){
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

  init2();


});
