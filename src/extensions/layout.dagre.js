;(function($$){ 'use strict';

  // default layout options
  var defaults = {
    // dagre algo options, uses default value on undefined
    nodeSep: undefined, // the separation between adjacent nodes in the same rank
    edgeSep: undefined, // the separation between adjacent edges in the same rank
    rankSep: undefined, // the separation between adjacent nodes in the same rank
    rankDir: undefined, // 'TB' for top to bottom flow, 'LR' for left to right
    minLen: function( edge ){ return 1; }, // number of ranks to keep between the source and target of the edge
    
    // general layout options
    fit: true, // whether to fit to viewport
    padding: 30, // fit padding
    animate: false, // whether to transition the node positions
    animationDuration: 500, // duration of animation in ms if enabled
    boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
    ready: function(){}, // on layoutready
    stop: function(){} // on layoutstop
  };

  // constructor
  // options : object containing layout options
  function DagreLayout( options ){
    this.options = $$.util.extend(true, {}, defaults, options); 
  }

  // runs the layout
  DagreLayout.prototype.run = function(){
    var options = this.options;
    var layout = this;

    $$.util.require('dagre', function(dagre){

      var cy = options.cy; // cy is automatically populated for us in the constructor
      var eles = options.eles;

      var bb = $$.util.makeBoundingBox( options.boundingBox ? options.boundingBox : {
        x1: 0, y1: 0, w: cy.width(), h: cy.height()
      } );

      var g = new dagre.Digraph();

      // add nodes to dagre
      var nodes = eles.nodes().not(':parent');
      for( var i = 0; i < nodes.length; i++ ){
        var node = nodes[i];

        g.addNode( node.id(), {
          width: node.width(),
          height: node.height()
        } );
      }

      // add edges to dagre
      var edges = eles.edges();
      for( var i = 0; i < edges.length; i++ ){
        var edge = edges[i];

        g.addEdge( edge.id(), edge.source().id(), edge.target().id(), {
          minLen: $$.is.fn(options.minLen) ? options.minLen.apply( edge, [ edge ] ) : options.minLen
        } );
      }

      var d = dagre.layout();

      if( options.nodeSep ){
        d.nodeSep( options.nodeSep );
      }

      if( options.edgeSep ){
        d.edgeSep( options.edgeSep );
      }
      
      if( options.rankSep ){
        d.rankSep( options.rankSep );
      }

      if( options.rankDir ){
        d.rankDir( options.rankDir );
      }
        
      d = d.run(g);

      d.eachNode(function(id, n) {
        cy.getElementById(id).scratch().dagre = n;
      });

      var dagreBB;

      if( options.boundingBox ){
        dagreBB = { x1: Infinity, x2: -Infinity, y1: Infinity, y2: -Infinity };
        nodes.forEach(function( node ){
          var dModel = node.scratch().dagre;

          dagreBB.x1 = Math.min( dagreBB.x1, dModel.x );
          dagreBB.x2 = Math.max( dagreBB.x2, dModel.x );

          dagreBB.y1 = Math.min( dagreBB.y1, dModel.y );
          dagreBB.y2 = Math.max( dagreBB.y2, dModel.y );
        });

        dagreBB.w = dagreBB.x2 - dagreBB.x1;
        dagreBB.h = dagreBB.y2 - dagreBB.y1;
      } else {
        dagreBB = bb;
      }

      var constrainPos = function( p ){
        if( options.boundingBox ){
          var xPct = (p.x - dagreBB.x1) / dagreBB.w;
          var yPct = (p.y - dagreBB.y1) / dagreBB.h;

          return {
            x: bb.x1 + xPct * bb.w,
            y: bb.y1 + yPct * bb.h
          };
        } else {
          return p;
        }
      };

      nodes.layoutPositions(layout, options, function(){
        var dModel = this.scratch().dagre;

        return constrainPos({
          x: dModel.x,
          y: dModel.y
        });
      });

    }); // require

    return this; // chaining
  };

  // register the layout
  $$('layout', 'dagre', DagreLayout);

})(cytoscape);