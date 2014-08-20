;(function($$){ 'use strict';
  
  var defaults = {
    animate: true, // whether to show the layout as it's running
    maxSimulationTime: 4000, // max length in ms to run the layout
    fit: true, // on every layout reposition of nodes, fit the viewport
    padding: 30, // padding around the simulation
    simulationWidth: undefined, // uses viewport width by default
    simulationHeight: undefined, // uses viewport height by default
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
    var options = this._private.options;
    var cy = options.cy;
    var nodes = cy.nodes().not(':parent');
    var edges = cy.edges();
    var eles = nodes.add( edges );
    var container = cy.container();
    this._private.width = cy.width();
    this._private.height = cy.height();
    var simUpdatingPos = false;
    var layout = this;

    cy.trigger({ type: 'layoutstart', layout: this });

    // backward compatibility for old animation option
    if( options.liveUpdate !== undefined ){
      options.animate = options.liveUpdate;
    }

    if( options.simulationWidth != null && options.simulationHeight != null ){
      this._private.width = options.simulationWidth; 
      this._private.height = options.simulationHeight;
    }

    // make nice x & y fields
    this._private.simBB = {
      x1: 0,
      y1: 0,
      x2: this._private.width,
      y2: this._private.height
    };

    // arbor doesn't work with just 1 node 
    if( cy.nodes().size() <= 1 ){
      if( options.fit ){
        cy.reset();
      }

      var bb = this._private.simBB;

      cy.nodes().position({
        x: Math.round( (bb.x1 + bb.x2)/2 ),
        y: Math.round( (bb.y1 + bb.y2)/2 )
      });

      cy.one('layoutready', options.ready);
      cy.trigger({ type: 'layoutready', layout: layout });

      cy.one('layoutstop', options.stop);
      cy.trigger({ type: 'layoutstop', layout: layout });

      return;
    }

    var sys = this._private.system = arbor.ParticleSystem();

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
      cy.fit( this._private.simBB, options.padding );
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
          
          var bb = layout._private.simBB;

          if( !node.locked() && !node.grabbed() ){
            node.silentPosition({
              x: bb.x1 + point.x,
              y: bb.y1 + point.y
            });

            movedNodes.merge( node );
          }
        });
        

        var timeToDraw = (+new Date() - lastDraw) >= 16;
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
          cy.one('layoutready', options.ready);
          cy.trigger({ type: 'layoutready', layout: layout });
        }
      }
      
    };
    sys.renderer = sysRenderer;
    sys.screenSize( this._private.width, this._private.height );
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
    
    // TODO we're using a hack; sys.toScreen should work :(
    function fromScreen(pos){
      var x = pos.x;
      var y = pos.y;
      var w = this._private.width;
      var h = this._private.height;
      
      var left = -2;
      var right = 2;
      
      var d = 4;
      
      return {
        x: x/w * d + left,
        y: y/h * d + right
      };
    }

    var grabHandler;
    nodes.on('grab free position', grabHandler = function(e){
      if( simUpdatingPos ){ return; }

      var pos = this.position();
      var apos = sys.fromScreen( pos );
      if( !apos ){ return; }

      var p = arbor.Point(apos.x, apos.y);
      var padding = options.padding;
      var bb = layout._private.simBB;

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
    eles.on('remove', removeHandler = function(e){
      var ele = this;
      var arborEle = ele.scratch().arbor;

      if( !arborEle ){ return; }

      if( ele.isNode() ){
        sys.pruneNode( arborEle );
      } else {
        sys.pruneEdge( arborEle );
      }
    });

    var addHandler;
    cy.on('add', '*', addHandler = function(){
      var ele = this;

      if( ele.isNode() ){
        addNode( ele );
      } else {
        addEdge( ele );
      }
    });

    var resizeHandler;
    cy.on('resize', resizeHandler = function(){
      if( layout._private.system != null ){
        var w = layout._private.width = cy.width();
        var h = layout._private.height = cy.height();

        layout._private.system.screenSize( w, h );
      }
    });

    function addNode( node ){
      if( node.isFullAutoParent() ){ return; } // they don't exist in the sim

      var id = node._private.data.id;
      var mass = calculateValueForElement(node, options.nodeMass);
      var locked = node._private.locked;
      
      var pos = sys.fromScreen({
        x: node.position().x,
        y: node.position().y
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

      cy.one('layoutstop', options.stop);
      cy.trigger({ type: 'layoutstop', layout: layout });
    };
    
    sys.start();
    if( !options.infinite && options.maxSimulationTime != null && options.maxSimulationTime > 0 && options.maxSimulationTime !== Infinity ){
      setTimeout(function(){
        layout.stop();
      }, options.maxSimulationTime);
    }
    
  };


  ArborLayout.prototype.stop = function(){
    if( this._private.system != null ){
      this._private.system.stop();
    }

    if( this._private.doneHandler ){
      this._private.doneHandler();
    }
  };
  
  $$('layout', 'arbor', ArborLayout);
  
  
})(cytoscape);
