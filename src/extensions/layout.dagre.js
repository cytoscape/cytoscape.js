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
    animate: true, // whether to transition the node positions
    animationDuration: 500, // duration of animation in ms if enabled
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
    var cy = options.cy; // cy is automatically populated for us in the constructor

    var g = new dagre.Digraph();

    // add nodes to dagre
    var nodes = cy.nodes().not(':parent');
    for( var i = 0; i < nodes.length; i++ ){
      var node = nodes[i];

      g.addNode( node.id(), {
        width: node.width(),
        height: node.height()
      } );
    }

    // add edges to dagre
    var edges = cy.edges();
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
      
    d = d.run(g);

    d.eachNode(function(id, n) {
      cy.getElementById(id).scratch().dagre = n;
    });

    nodes.layoutPositions(this, options, function(){
      var dModel = this.scratch().dagre;

      return {
        x: dModel.x,
        y: dModel.y
      };
    });
  };

  // called on continuous layouts to stop them before they finish
  DagreLayout.prototype.stop = function(){
    // not continuous
  };

  // register the layout
  $$('layout', 'dagre', DagreLayout);

})(cytoscape);