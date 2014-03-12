;(function($$){ 'use strict';
  
  var defaults = {
    fit: true, // whether to fit the viewport to the graph
    ready: undefined, // callback on layoutready
    stop: undefined, // callback on layoutstop
    padding: 30, // the padding on fit
    startAngle: 3/2 * Math.PI, // the position of the first node
    counterclockwise: false, // whether the layout should go counterclockwise (true) or clockwise (false)
    minNodeSpacing: 10, // min spacing between outside of nodes (used for radius adjustment)
    height: undefined, // height of layout area (overrides container height)
    width: undefined, // width of layout area (overrides container width)
    concentric: function(){ // returns numeric value for each node, placing higher nodes in levels towards the centre
      return this.degree();
    },
    levelWidth: function(nodes){ // the variation of concentric values in each level
      return nodes.maxDegree() / 4;
    } 
  };
  
  function ConcentricLayout( options ){
    this.options = $$.util.extend({}, defaults, options);
  }
  
  ConcentricLayout.prototype.run = function(){
    var params = this.options;
    var options = params;
    
    var cy = params.cy;
    var nodes = cy.nodes().filter(function(){
      return !this.isFullAutoParent();
    });
    var edges = cy.edges();
    var container = cy.container();
    
    var width = options.width !== undefined ? options.width : container.clientWidth;
    var height = options.height !== undefined ? options.height : container.clientHeight;

    var center = {
      x: width/2,
      y: height/2
    };
    
    var nodeValues = []; // { node, value }
    var theta = options.startAngle;
    var maxNodeSize = 0;

    for( var i = 0; i < nodes.length; i++ ){
      var node = nodes[i];
      var value;
      
      // calculate the node value
      value = options.concentric.call(node);
      nodeValues.push({
        value: value,
        node: node
      });

      // for style mapping
      node._private.layoutData.concentric = value;
    }

    // in case we used the `concentric` in style
    nodes.updateMappers();

    // calculate max size now based on potentially updated mappers
    for( var i = 0; i < nodes.length; i++ ){
      var node = nodes[i];

      maxNodeSize = Math.max( maxNodeSize, node.outerWidth(), node.outerHeight() );
    }

    // sort node values in descreasing order
    nodeValues.sort(function(a, b){
      return b.value - a.value;
    });

    var levelWidth = options.levelWidth( nodes );

    // put the values into levels
    var levels = [ [] ];
    var currentLevel = levels[0];
    for( var i = 0; i < nodeValues.length; i++ ){
      var val = nodeValues[i];

      if( currentLevel.length > 0 ){
        var diff = Math.abs( currentLevel[0].value - val.value );

        if( diff >= levelWidth ){
          currentLevel = [];
          levels.push( currentLevel );
        }
      }

      currentLevel.push( val );
    }

    // create positions from levels

    var pos = {}; // id => position
    var r = 0;
    var minDist = maxNodeSize + options.minNodeSpacing; // min dist between nodes

    for( var i = 0; i < levels.length; i++ ){
      var level = levels[i];
      var dTheta = 2 * Math.PI / level.length;

      // calculate the radius
      if( level.length > 1 ){ // but only if more than one node (can't overlap)
        var dcos = Math.cos(dTheta) - Math.cos(0);
        var dsin = Math.sin(dTheta) - Math.sin(0);
        var rMin = Math.sqrt( minDist * minDist / ( dcos*dcos + dsin*dsin ) ); // s.t. no nodes overlapping
        r = Math.max( rMin, r );
      }

      for( var j = 0; j < level.length; j++ ){
        var val = level[j];
        var theta = options.startAngle + (options.counterclockwise ? 1 : -1) * dTheta * j;

        var p = {
          x: center.x + r * Math.cos(theta),
          y: center.y + r * Math.sin(theta)
        };

        pos[ val.node.id() ] = p;
      }

      r += minDist;
      
    } 

    // position the nodes
    nodes.positions(function(){
      var id = this.id();

      return pos[id];
    });
    
    if( params.fit ){
      cy.fit( options.padding );
    } 
    
    cy.one('layoutready', params.ready);
    cy.trigger('layoutready');
    
    cy.one('layoutstop', params.stop);
    cy.trigger('layoutstop');
  };

  ConcentricLayout.prototype.stop = function(){
    // not a continuous layout
  };
  
  $$('layout', 'concentric', ConcentricLayout);
  
})( cytoscape );
