;(function($$){ 'use strict';
  
  var defaults = {
    fit: true, // whether to fit the viewport to the graph
    padding: 30, // the padding on fit
    boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
    avoidOverlap: true, // prevents node overlap, may overflow boundingBox and radius if not enough space
    radius: undefined, // the radius of the circle
    startAngle: 3/2 * Math.PI, // the position of the first node
    counterclockwise: false, // whether the layout should go counterclockwise (true) or clockwise (false)
    animate: false, // whether to transition the node positions
    animationDuration: 500, // duration of animation in ms if enabled
    ready: undefined, // callback on layoutready
    stop: undefined // callback on layoutstop
  };
  
  function CircleLayout( options ){
    this.options = $$.util.extend({}, defaults, options);
  }
  
  CircleLayout.prototype.run = function(){
    var params = this.options;
    var options = params;
    
    var cy = params.cy;
    var eles = options.eles;
      
    var nodes = eles.nodes().not(':parent');
    
    var bb = $$.util.makeBoundingBox( options.boundingBox ? options.boundingBox : {
      x1: 0, y1: 0, w: cy.width(), h: cy.height()
    } );

    var center = {
      x: bb.x1 + bb.w/2,
      y: bb.y1 + bb.h/2
    };
    
    var theta = options.startAngle;
    var dTheta = 2 * Math.PI / nodes.length;
    var r;

    var minDistance = 0;
    for( var i = 0; i < nodes.length; i++ ){
      var w = nodes[i].outerWidth();
      var h = nodes[i].outerHeight();
      
      minDistance = Math.max(minDistance, w, h);
    }

    if( $$.is.number(options.radius) ){
      r = options.radius;
    } else if( nodes.length <= 1 ){
      r = 0;
    } else {
      r = Math.min( bb.h, bb.w )/2 - minDistance;
    }

    // calculate the radius
    if( nodes.length > 1 && options.avoidOverlap ){ // but only if more than one node (can't overlap)
      minDistance *= 1.75; // just to have some nice spacing

      var dTheta = 2 * Math.PI / nodes.length;
      var dcos = Math.cos(dTheta) - Math.cos(0);
      var dsin = Math.sin(dTheta) - Math.sin(0);
      var rMin = Math.sqrt( minDistance * minDistance / ( dcos*dcos + dsin*dsin ) ); // s.t. no nodes overlapping
      r = Math.max( rMin, r );
    }

    var getPos = function( i, ele ){
      var rx = r * Math.cos( theta );
      var ry = r * Math.sin( theta );
      var pos = {
        x: center.x + rx,
        y: center.y + ry
      };

      theta = options.counterclockwise ? theta - dTheta : theta + dTheta;
      return pos;
    };
    
    nodes.layoutPositions( this, options, getPos );

    return this; // chaining
  };
  
  $$('layout', 'circle', CircleLayout);
  
})( cytoscape );
