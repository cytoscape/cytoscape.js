;(function($$){ 'use strict';
  
  var defaults = {
    animate: true, // whether to show the layout as it's running
    maxSimulationTime: 4000, // max length in ms to run the layout
    fit: true, // on every layout reposition of nodes, fit the viewport
    padding: 30, // padding around the simulation
    boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
    ungrabifyWhileSimulating: false, // so you can't drag nodes during layout

    // callbacks on layout events
    ready: undefined, // callback on layoutready 
    stop: undefined, // callback on layoutstop

    // forces used by arbor (use arbor default on undefined)
    repulsion: undefined,
    stiffness: undefined,
    friction: undefined,
    gravity: true,
    fps: undefined,
    precision: undefined,

    // static numbers or functions that dynamically return what these
    // values should be for each element
    // e.g. nodeMass: function(n){ return n.data('weight') }
    nodeMass: undefined, 
    edgeLength: undefined,

    stepSize: 0.1, // smoothing of arbor bounding box

    // function that returns true if the system is stable to indicate
    // that the layout can be stopped
    stableEnergy: function( energy ){
      var e = energy; 
      return (e.max <= 0.5) || (e.mean <= 0.3);
    },

    // infinite layout options
    infinite: false // overrides all other options for a forces-all-the-time mode
  };
  
  function ArborLayout(options){
    this._private = {};

    this._private.options = $$.util.extend({}, defaults, options);
  }
    
  ArborLayout.prototype.run = function(){
    var layout = this;
    var options = this._private.options;

    $$.util.require('arbor', function(arbor){

      var cy = options.cy;
      var eles = options.eles;
      var nodes = eles.nodes().not(':parent');
      var edges = eles.edges();
      var bb = $$.util.makeBoundingBox( options.boundingBox ? options.boundingBox : {
        x1: 0, y1: 0, w: cy.width(), h: cy.height()
      } );
      var simUpdatingPos = false;

      layout.trigger({ type: 'layoutstart', layout: layout });

      // backward compatibility for old animation option
      if( options.liveUpdate !== undefined ){
        options.animate = options.liveUpdate;
      }

      // arbor doesn't work with just 1 node 
      if( cy.nodes().size() <= 1 ){
        if( options.fit ){
          cy.reset();
        }

        cy.nodes().position({
          x: Math.round( (bb.x1 + bb.x2)/2 ),
          y: Math.round( (bb.y1 + bb.y2)/2 )
        });

        layout.one('layoutready', options.ready);
        layout.trigger({ type: 'layoutready', layout: layout });

        layout.one('layoutstop', options.stop);
        layout.trigger({ type: 'layoutstop', layout: layout });

        return;
      }

      var sys = layout._private.system = arbor.ParticleSystem();

      sys.parameters({
        repulsion: options.repulsion,
        stiffness: options.stiffness, 
        friction: options.friction, 
        gravity: options.gravity, 
        fps: options.fps, 
        dt: options.dt, 
        precision: options.precision
      });

      if( options.animate && options.fit ){
        cy.fit( bb, options.padding );
      }
      
      var doneTime = 250;
      var doneTimeout;
      
      var ready = false;
      
      var lastDraw = +new Date();
      var sysRenderer = {
        init: function(system){
        },
        redraw: function(){
          var energy = sys.energy();

          // if we're stable (according to the client), we're done
          if( !options.infinite && options.stableEnergy != null && energy != null && energy.n > 0 && options.stableEnergy(energy) ){
            layout.stop();
            return;
          }

          if( !options.infinite && doneTime != Infinity ){
            clearTimeout(doneTimeout);
            doneTimeout = setTimeout(doneHandler, doneTime);
          }
          
          var movedNodes = cy.collection();
          
          sys.eachNode(function(n, point){ 
            var data = n.data;
            var node = data.element;
            
            if( node == null ){
              return;
            }

            if( !node.locked() && !node.grabbed() ){
              node.silentPosition({
                x: bb.x1 + point.x,
                y: bb.y1 + point.y
              });

              movedNodes.merge( node );
            }
          });
          

          if( options.animate && movedNodes.length > 0 ){
            simUpdatingPos = true;

            movedNodes.rtrigger('position');

            if( options.fit ){
              cy.fit( options.padding );
            }

            lastDraw = +new Date();
            simUpdatingPos = false;
          }

          
          if( !ready ){
            ready = true;
            layout.one('layoutready', options.ready);
            layout.trigger({ type: 'layoutready', layout: layout });
          }
        }
        
      };
      sys.renderer = sysRenderer;
      sys.screenSize( bb.w, bb.h );
      sys.screenPadding( options.padding, options.padding, options.padding, options.padding );
      sys.screenStep( options.stepSize );

      function calculateValueForElement(element, value){
        if( value == null ){
          return undefined;
        } else if( typeof value == typeof function(){} ){
          return value.apply(element, [element._private.data, {
            nodes: nodes.length,
            edges: edges.length,
            element: element
          }]); 
        } else {
          return value;
        }
      }

      var grabHandler;
      nodes.on('grab free position', grabHandler = function(e){
        if( simUpdatingPos ){ return; }

        var pos = this.position();
        var apos = sys.fromScreen( pos );
        if( !apos ){ return; }

        var p = arbor.Point(apos.x, apos.y);
        var padding = options.padding;

        if(
          bb.x1 + padding <= pos.x && pos.x <= bb.x2 - padding &&
          bb.y1 + padding <= pos.y && pos.y <= bb.y2 - padding
        ){
          this.scratch().arbor.p = p;
        }
        
        switch( e.type ){
        case 'grab':
          this.scratch().arbor.fixed = true;
          break;
        case 'free':
          this.scratch().arbor.fixed = false;
          //this.scratch().arbor.tempMass = 1000;
          break;
        }
      });

      var lockHandler;
      nodes.on('lock unlock', lockHandler = function(e){
        node.scratch().arbor.fixed = node.locked();
      });
            
      var removeHandler;
      eles.on('remove', removeHandler = function(e){ return; // TODO enable when layout add/remove api added
        // var ele = this;
        // var arborEle = ele.scratch().arbor;

        // if( !arborEle ){ return; }

        // if( ele.isNode() ){
        //   sys.pruneNode( arborEle );
        // } else {
        //   sys.pruneEdge( arborEle );
        // }
      });

      var addHandler;
      cy.on('add', '*', addHandler = function(){ return; // TODO enable when layout add/remove api added
        // var ele = this;

        // if( ele.isNode() ){
        //   addNode( ele );
        // } else {
        //   addEdge( ele );
        // }
      });

      var resizeHandler;
      cy.on('resize', resizeHandler = function(){
        if( options.boundingBox == null && layout._private.system != null ){
          var w = cy.width();
          var h = cy.height();

          sys.screenSize( w, h );
        }
      });

      function addNode( node ){
        if( node.isFullAutoParent() ){ return; } // they don't exist in the sim

        var id = node._private.data.id;
        var mass = calculateValueForElement(node, options.nodeMass);
        var locked = node._private.locked;
        var nPos = node.position();
        
        var pos = sys.fromScreen({
          x: nPos.x,
          y: nPos.y
        });

        node.scratch().arbor = sys.addNode(id, {
          element: node,
          mass: mass,
          fixed: locked,
          x: locked ? pos.x : undefined,
          y: locked ? pos.y : undefined
        });
      }

      function addEdge( edge ){
        var src = edge.source().id();
        var tgt = edge.target().id();
        var length = calculateValueForElement(edge, options.edgeLength);
        
        edge.scratch().arbor = sys.addEdge(src, tgt, {
          length: length
        }); 
      }

      nodes.each(function(i, node){
        addNode( node );
      });
      
      edges.each(function(i, edge){
        addEdge( edge );
      });
      
      var grabbableNodes = nodes.filter(":grabbable");
      // disable grabbing if so set
      if( options.ungrabifyWhileSimulating ){
        grabbableNodes.ungrabify();
      }
      
      var doneHandler = layout._private.doneHandler = function(){
        layout._private.doneHandler = null;

        if( !options.animate ){
          if( options.fit ){
            cy.reset();
          }

          nodes.rtrigger('position');
        }

        // unbind handlers
        nodes.off('grab free position', grabHandler);
        nodes.off('lock unlock', lockHandler);
        eles.off('remove', removeHandler);
        cy.off('add', '*', addHandler);
        cy.off('resize', resizeHandler);
        
        // enable back grabbing if so set
        if( options.ungrabifyWhileSimulating ){
          grabbableNodes.grabify();
        }

        layout.one('layoutstop', options.stop);
        layout.trigger({ type: 'layoutstop', layout: layout });
      };
      
      sys.start();
      if( !options.infinite && options.maxSimulationTime != null && options.maxSimulationTime > 0 && options.maxSimulationTime !== Infinity ){
        setTimeout(function(){
          layout.stop();
        }, options.maxSimulationTime);
      }
    
    }); // require

    return this; // chaining
  };


  ArborLayout.prototype.stop = function(){
    if( this._private.system != null ){
      this._private.system.stop();
    }

    if( this._private.doneHandler ){
      this._private.doneHandler();
    }

    return this; // chaining
  };
  
  $$('layout', 'arbor', ArborLayout);
  
  
})(cytoscape);
