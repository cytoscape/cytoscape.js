;(function($$){ 'use strict';

  // default layout options
  var defaults = {
    animate: true, // whether to show the layout as it's running
    refresh: 1, // number of ticks per frame; higher is faster but more jerky
    maxSimulationTime: 4000, // max length in ms to run the layout
    ungrabifyWhileSimulating: false, // so you can't drag nodes during layout
    fit: true, // on every layout reposition of nodes, fit the viewport
    padding: 30, // padding around the simulation
    boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }

    // layout event callbacks
    ready: function(){}, // on layoutready
    stop: function(){}, // on layoutstop

    // positioning options
    randomize: false, // use random node positions at beginning of layout
    avoidOverlap: true, // if true, prevents overlap of node bounding boxes
    handleDisconnected: true, // if true, avoids disconnected components from overlapping
    nodeSpacing: function( node ){ return 10; }, // extra spacing around nodes
    flow: undefined, // use DAG/tree flow layout if specified, e.g. { axis: 'y', minSeparation: 30 }
    alignment: undefined, // relative alignment constraints on nodes, e.g. function( node ){ return { x: 0, y: 1 } }

    // different methods of specifying edge length
    // each can be a constant numerical value or a function like `function( edge ){ return 2; }`
    edgeLength: undefined, // sets edge length directly in simulation
    edgeSymDiffLength: undefined, // symmetric diff edge length in simulation
    edgeJaccardLength: undefined, // jaccard edge length in simulation

    // iterations of cola algorithm; uses default values on undefined
    unconstrIter: undefined, // unconstrained initial layout iterations
    userConstIter: undefined, // initial layout iterations with user-specified constraints
    allConstIter: undefined, // initial layout iterations with all constraints including non-overlap

    // infinite layout options
    infinite: false // overrides all other options for a forces-all-the-time mode
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

    $$.util.require('cola', function(cola){

      var cy = options.cy; // cy is automatically populated for us in the constructor
      var eles = options.eles;
      var nodes = eles.nodes();
      var edges = eles.edges();
      var ready = false;
      
      var bb = $$.util.makeBoundingBox( options.boundingBox ? options.boundingBox : {
        x1: 0, y1: 0, w: cy.width(), h: cy.height()
      } );

      var getOptVal = function( val, ele ){
        if( $$.is.fn(val) ){
          var fn = val;
          return fn.apply( ele, [ ele ] );
        } else {
          return val;
        }
      };

      var updateNodePositions = function(){
        var x = { min: Infinity, max: -Infinity };
        var y = { min: Infinity, max: -Infinity };

        for( var i = 0; i < nodes.length; i++ ){
          var node = nodes[i];
          var scratch = node._private.scratch.cola;

          x.min = Math.min( x.min, scratch.x );
          x.max = Math.max( x.max, scratch.x );

          y.min = Math.min( y.min, scratch.y );
          y.max = Math.max( y.max, scratch.y );
        }

        nodes.positions(function(i, node){
          var pos = node._private.position;
          var scratch = node._private.scratch.cola;

          if( !node.grabbed() ){
            pos.x = bb.x1 + scratch.x - x.min;
            pos.y = bb.y1 + scratch.y - y.min;
          }
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
        layout.manuallyStopped = false;

        if( options.ungrabifyWhileSimulating ){
          grabbableNodes.grabify();
        }

        nodes.off('grab free position', grabHandler);
        nodes.off('lock unlock', lockHandler);

        // trigger layoutstop when the layout stops (e.g. finishes)
        layout.one('layoutstop', options.stop);
        layout.trigger({ type: 'layoutstop', layout: layout });
      };

      var onReady = function(){
        // trigger layoutready when each node has had its position set at least once
        layout.one('layoutready', options.ready);
        layout.trigger({ type: 'layoutready', layout: layout });
      };

      var ticksPerFrame = options.refresh;
      var tickSkip = 1; // frames until a tick; used to slow down sim for debugging

      if( options.refresh < 0 ){
        tickSkip = Math.abs( options.refresh );
        ticksPerFrame = 1;
      } else {
        ticksPerFrame = Math.max( 1, ticksPerFrame ); // at least 1
      }

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
              if( !options.infinite || layout.manuallyStopped ){ onDone(); }           
              break;
          }
        },

        kick: function( tick ){ // kick off the simulation
          var skip = 0;

          var inftick = function(){
            var ret = tick();

            if( ret && options.infinite ){ // resume layout if done
              adaptor.resume(); // resume => new kick
            }
            
            return ret; // allow regular finish b/c of new kick
          };

          var multitick = function(){ // multiple ticks in a row
            var ret;

            // skip ticks to slow down layout for debugging
            var thisSkip = skip;
            skip = (skip + 1) % tickSkip;
            if( thisSkip !== 0 ){
              return false;
            }

            for( var i = 0; i < ticksPerFrame && !ret; i++ ){
              ret = ret || inftick(); // pick up true ret vals => sim done
            }

            return ret;
          };

          if( options.animate ){
            var frame = function(){
              if( multitick() ){ return; }

              $$.util.requestAnimationFrame( frame );
            };

            $$.util.requestAnimationFrame( frame );
          } else {
            while( !inftick() ){}
          }
        },

        on: function( type, listener ){}, // dummy; not needed

        drag: function(){} // TODO
      });
      layout.adaptor = adaptor;

      // if set no grabbing during layout
      var grabbableNodes = nodes.filter(':grabbable');
      if( options.ungrabifyWhileSimulating ){
        grabbableNodes.ungrabify();
      }

      // handle node dragging
      var grabHandler;
      nodes.on('grab free position', grabHandler = function(e){
        var node = this;
        var scrCola = node._private.scratch.cola;
        var pos = node._private.position;

        if( node.grabbed() ){
          scrCola.x = pos.x - bb.x1;
          scrCola.y = pos.y - bb.y1;

          adaptor.dragstart( scrCola );
        } else if( $$.is.number(scrCola.x) && $$.is.number(scrCola.y) ){
          pos.x = scrCola.x + bb.x1;
          pos.y = scrCola.y + bb.y1;
        }

        switch( e.type ){
          case 'grab':
            adaptor.dragstart( scrCola );
            adaptor.resume();
            break;
          case 'free':
            adaptor.dragend( scrCola );
            break;
        }
        
      });

      var lockHandler;
      nodes.on('lock unlock', lockHandler = function(e){
        var node = this;
        var scrCola = node._private.scratch.cola;
      
        if( node.locked() ){
          adaptor.dragstart( scrCola );
        } else {
          adaptor.dragend( scrCola );
        }
      });

      var nonparentNodes = nodes.stdFilter(function( node ){
        return !node.isParent();
      });

      // add nodes to cola
      adaptor.nodes( nonparentNodes.map(function( node, i ){
        var padding = getOptVal( options.nodeSpacing, node );
        var pos = node.position();

        var struct = node._private.scratch.cola = {
          x: options.randomize ? Math.round( Math.random() * bb.w ) : pos.x,
          y: options.randomize ? Math.round( Math.random() * bb.h ) : pos.y,
          width: node.outerWidth() + 2*padding,
          height: node.outerHeight() + 2*padding,
          index: i
        };

        return struct;
      }) );

      if( options.alignment ){ // then set alignment constraints

        var offsetsX = [];
        var offsetsY = [];

        nonparentNodes.forEach(function( node ){
          var align = getOptVal( options.alignment, node );
          var scrCola = node._private.scratch.cola;
          var index = scrCola.index;

          if( !align ){ return; }

          if( align.x != null ){
            offsetsX.push({
              node: index,
              offset: align.x
            });
          }

          if( align.y != null ){
            offsetsY.push({
              node: index,
              offset: align.y
            });
          }
        });

        // add alignment constraints on nodes
        var constraints = [];

        if( offsetsX.length > 0 ){
          constraints.push({
            type: 'alignment',
            axis: 'x',
            offsets: offsetsX
          });
        }

        if( offsetsY.length > 0 ){
          constraints.push({
            type: 'alignment',
            axis: 'y',
            offsets: offsetsY
          });
        }
        
        adaptor.constraints( constraints );

      }

      // add compound nodes to cola
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

      // get the edge length setting mechanism
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

      // add the edges to cola
      adaptor.links( edges.stdFilter(function( edge ){
        return !edge.source().isParent() && !edge.target().isParent();
      }).map(function( edge, i ){
        var c = edge._private.scratch.cola = {
          source: edge.source()[0]._private.scratch.cola.index,
          target: edge.target()[0]._private.scratch.cola.index
        };

        if( length != null ){
          c.calcLength = getOptVal( length, edge );
        }

        return c;
      }) );

      adaptor.size([ bb.w, bb.h ]);

      if( length != null ){
        adaptor[ lengthFnName ]( lengthGetter );
      }

      // set the flow of cola
      if( options.flow ){
        var flow;
        var defAxis = 'y';
        var defMinSep = 50;

        if( $$.is.string(options.flow) ){
          flow = {
            axis: options.flow,
            minSeparation: defMinSep
          };
        } else if( $$.is.number(options.flow) ){
          flow = {
            axis: defAxis,
            minSeparation: options.flow
          };
        } else if( $$.is.plainObject(options.flow) ){
          flow = options.flow;

          flow.axis = flow.axis || defAxis;
          flow.minSeparation = flow.minSeparation != null ? flow.minSeparation : defMinSep;
        } else { // e.g. options.flow: true
          flow = {
            axis: defAxis,
            minSeparation: defMinSep
          };
        }

        adaptor.flowLayout( flow.axis , flow.minSeparation );
      }

      adaptor
        .avoidOverlaps( options.avoidOverlap )
        .handleDisconnected( options.handleDisconnected )
        .start( options.unconstrIter, options.userConstIter, options.allConstIter)
      ;

      layout.trigger({ type: 'layoutstart', layout: layout });

      if( !options.infinite ){
        setTimeout(function(){
          adaptor.stop();
        }, options.maxSimulationTime);
      }

    }); // require

    return this; // chaining
  };

  // called on continuous layouts to stop them before they finish
  ColaLayout.prototype.stop = function(){
    if( this.adaptor ){
      this.manuallyStopped = true;
      this.adaptor.stop();
    }

    return this; // chaining
  };

  // register the layout
  $$('layout', 'cola', ColaLayout);

})(cytoscape);