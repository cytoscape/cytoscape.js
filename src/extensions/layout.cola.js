;(function($$){ 'use strict';

  // default layout options
  var defaults = {
    animate: true,
    maxSimulationTime: 4000, // max length in ms to run the layout
    fit: true, // on every layout reposition of nodes, fit the viewport
    padding: 30, // padding around the simulation

    // layout forces & constraints
    avoidOverlaps: true, // if true, prevents overlap of node bounding boxes
    nodeSpacing: function( node ){ return 10; }, // extra spacing around nodes

    // different methods of specifying edge length
    // each can be a constant numerical value or a function like `function( edge ){ return 2; }`
    edgeLength: undefined, // sets edge length directly in simulation
    edgeSymDiffLength: undefined, // symmetric diff edge length in simulation
    edgeJaccardLength: undefined, // jaccard edge length in simulation

    // iterations of cola algorithm; uses default values on undefined
    unconstrIter: undefined, // unconstrained initial layout iterations
    userConstIter: undefined, // initial layout iterations with user-specified constraints
    allConstIter: undefined, // initial layout iterations with all constraints including non-overlap

    // layout event callbacks
    ready: function(){}, // on layoutready
    stop: function(){} // on layoutstop
  };

  // constructor
  // options : object containing layout options
  function ColaLayout( options ){
    this.options = $$.util.extend(true, {}, defaults, options); 
  }

  // runs the layout
  ColaLayout.prototype.run = function(){
    var layout = this;
    var options = this.options;
    var cy = options.cy; // cy is automatically populated for us in the constructor
    var eles = cy.elements();
    var nodes = eles.nodes();
    var edges = eles.edges();
    var ready = false;

    var getOptVal = function( val, ele ){
      if( $$.is.fn(val) ){
        var fn = val;
        return fn.apply( ele, [ ele ] );
      } else {
        return val;
      }
    }

    var updateNodePositions = function(){
      nodes.positions(function(i, node){
        var pos = node._private.position;
        var scratch = node._private.scratch.cola;

        pos.x = scratch.x;
        pos.y = scratch.y;
      });

      if( !ready ){
        onReady();
        ready = true;
      }

      if( options.fit ){
        cy.fit( options.padding );
      }
    };

    var onDone = function(){
      // trigger layoutstop when the layout stops (e.g. finishes)
      cy.one('layoutstop', options.stop);
      cy.trigger({ type: 'layoutstop', layout: layout });
    };

    var onReady = function(){
      // trigger layoutready when each node has had its position set at least once
      cy.one('layoutready', options.ready);
      cy.trigger({ type: 'layoutready', layout: layout });
    };

    var adaptor = cola.adaptor({
      trigger: function( e ){ // on sim event
        switch( e.type ){
          case 'tick':
            if( options.animate ){
              updateNodePositions();
            }
            break;

          case 'end': 
            updateNodePositions();
            onDone();
            break;
        }
      },

      kick: function( tick ){ // kick off the simulation
        if( options.animate ){
          var frame = function(){
            if( tick() ){ return; }

            $$.util.requestAnimationFrame( frame );
          };

          $$.util.requestAnimationFrame( frame );
        } else {
          while( !tick() ){}
        }
      },

      on: function( type, listener ){}, // dummy; not needed

      drag: function(){} // TODO
    });
    layout.adaptor = adaptor;

    adaptor.nodes( nodes.stdFilter(function( node ){
      return !node.isParent();
    }).map(function( node, i ){
      var padding = getOptVal( options.nodeSpacing, node );

      return node._private.scratch.cola = {
        width: node.outerWidth() + 2*padding,
        height: node.outerHeight() + 2*padding,
        index: i
      };
    }) );

    adaptor.groups( nodes.stdFilter(function( node ){
      return node.isParent();
    }).map(function( node, i ){ // add basic group incl leaf nodes
      node._private.scratch.cola = {
        index: i,

        leaves: node.children().stdFilter(function( child ){
          return !child.isParent();
        }).map(function( child ){
          return child[0]._private.scratch.cola.index;
        })
      };

      return node;
    }).map(function( node ){ // add subgroups
      node._private.scratch.cola.groups = node.children().stdFilter(function( child ){
        return child.isParent();
      }).map(function( child ){
        return child._private.scratch.cola.index;
      });

      return node._private.scratch.cola;
    }) );

    var length;
    var lengthFnName;
    if( options.edgeLength != null ){
      length = options.edgeLength;
      lengthFnName = 'linkDistance';
    } else if( options.edgeSymDiffLength != null ){
      length = options.edgeSymDiffLength;
      lengthFnName = 'symmetricDiffLinkLengths';
    } else if( options.edgeJaccardLength != null ){
      length = options.edgeJaccardLength;
      lengthFnName = 'jaccardLinkLengths';
    } else {
      length = 100;
      lengthFnName = 'linkDistance';
    }

    var lengthGetter = function( link ){
      return link.calcLength;
    };

    adaptor.links( edges.stdFilter(function( edge ){
      return !edge.source().isParent() && !edge.target().isParent();
    }).map(function( edge, i ){
      var c = edge._private.scratch.cola = {
        source: edge.source()[0]._private.scratch.cola.index,
        target: edge.target()[0]._private.scratch.cola.index
      };

      if( length != null ){
        c.calcLength = getOptVal( length, edge )
      }

      return c;
    }) );

    adaptor.size([ cy.width(), cy.height() ]);

    if( length != null ){
      adaptor[ lengthFnName ]( lengthGetter );
    }

    adaptor
      .avoidOverlaps( options.avoidOverlaps )
      .handleDisconnected( true )
      //.flowLayout() // TODO
      //.constraints() // TODO
      //.distanceMatrix() // TODO
      .start( options.unconstrIter, options.userConstIter, options.allConstIter)
    ;

    cy.trigger({ type: 'layoutstart', layout: layout });

    setTimeout(function(){
      adaptor.stop();
    }, options.maxSimulationTime);

  };

  // called on continuous layouts to stop them before they finish
  ColaLayout.prototype.stop = function(){
    this.adaptor.stop();
  };

  // register the layout
  $$('layout', 'cola', ColaLayout);

})(cytoscape);