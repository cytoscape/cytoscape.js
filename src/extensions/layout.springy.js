;(function($$){ 'use strict';
  
  var defaults = {
    animate: true, // whether to show the layout as it's running
    maxSimulationTime: 4000, // max length in ms to run the layout
    ungrabifyWhileSimulating: false, // so you can't drag nodes during layout
    fit: true, // whether to fit the viewport to the graph
    padding: 30, // padding on fit
    boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
    random: false, // whether to use random initial positions
    infinite: false, // overrides all other options for a forces-all-the-time mode
    ready: undefined, // callback on layoutready
    stop: undefined, // callback on layoutstop

    // springy forces
    stiffness: 400,
    repulsion: 400,
    damping: 0.5
  };

  function SpringyLayout( options ){
    this.options = $$.util.extend(true, {}, defaults, options);
  }
  
  SpringyLayout.prototype.run = function(){
    var layout = this;
    var self = this;
    var options = this.options;

    $$.util.require('Springy', function(Springy){

      var simUpdatingPos = false;

      var cy = options.cy;
      layout.trigger({ type: 'layoutstart', layout: layout });
      
      var eles = options.eles;
      var nodes = eles.nodes().not(':parent');
      var edges = eles.edges();
   
      var bb = $$.util.makeBoundingBox( options.boundingBox ? options.boundingBox : {
        x1: 0, y1: 0, w: cy.width(), h: cy.height()
      } );
      
      // make a new graph
      var graph = new Springy.Graph();

      // make some nodes
      nodes.each(function(i, node){
        node.scratch('springy', {
          model: graph.newNode({
            element: node
          })
        });
      });

      // connect them with edges
      edges.each(function(i, edge){
        var fdSrc = edge.source().scratch('springy').model;
        var fdTgt = edge.target().scratch('springy').model;
        
        edge.scratch('springy', {
          model: graph.newEdge(fdSrc, fdTgt, {
            element: edge
          })
        });
      });
      
      var sim = window.sim = new Springy.Layout.ForceDirected(graph, options.stiffness, options.repulsion, options.damping);

      if( options.infinite ){
        sim.minEnergyThreshold = -Infinity;
      }

      var currentBB = sim.getBoundingBox();
      // var targetBB = {bottomleft: new Springy.Vector(-2, -2), topright: new Springy.Vector(2, 2)};
      
      // convert to/from screen coordinates
      var toScreen = function(p) {
        currentBB = sim.getBoundingBox();

        var size = currentBB.topright.subtract(currentBB.bottomleft);
        var sx = p.subtract(currentBB.bottomleft).divide(size.x).x * bb.w + bb.x1;
        var sy = p.subtract(currentBB.bottomleft).divide(size.y).y * bb.h + bb.x1;

        return new Springy.Vector(sx, sy);
      };

      var fromScreen = function(s) {
        currentBB = sim.getBoundingBox();

        var size = currentBB.topright.subtract(currentBB.bottomleft);
        var px = ((s.x - bb.x1) / bb.w) * size.x + currentBB.bottomleft.x;
        var py = ((s.y - bb.y1) / bb.h) * size.y + currentBB.bottomleft.y;

        return new Springy.Vector(px, py);
      };
      
      var movedNodes = cy.collection();
      
      var numNodes = cy.nodes().size();
      var drawnNodes = 1;
      var fdRenderer = new Springy.Renderer(sim,
        function clear() {
          if( movedNodes.length > 0 && options.animate ){
            simUpdatingPos = true;

            movedNodes.rtrigger('position');

            if( options.fit ){
              cy.fit( options.padding );
            }

            movedNodes = cy.collection();

            simUpdatingPos = false;
          }
        },

        function drawEdge(edge, p1, p2) {
          // draw an edge
        },

        function drawNode(node, p) {
          var v = toScreen(p);
          var element = node.data.element;
          
          if( !element.locked() && !element.grabbed() ){
              element._private.position = {
                x: v.x,
                y: v.y
              };
              movedNodes.merge(element);
          } else {
            //setLayoutPositionForElement(element);
          }
          
          if( drawnNodes == numNodes ){
            layout.one('layoutready', options.ready);
            layout.trigger({ type: 'layoutready', layout: layout });
          } 
          
          drawnNodes++;
        
        }
      );
      
      // set initial node points
      nodes.each(function(i, ele){
        if( !options.random ){
          setLayoutPositionForElement(ele);
        }
      });
      
      // update node positions when dragging
      var dragHandler;
      nodes.on('position', dragHandler = function(){
        if( simUpdatingPos ){ return; }

        setLayoutPositionForElement(this);
      });
      
      function setLayoutPositionForElement(element){
        var fdId = element.scratch('springy').model.id;
        var fdP = fdRenderer.layout.nodePoints[fdId].p;
        var pos = element.position();
        var positionInFd = (pos.x != null && pos.y != null) ? fromScreen(element.position()) : {
          x: Math.random() * 4 - 2,
          y: Math.random() * 4 - 2
        };
        
        fdP.x = positionInFd.x;
        fdP.y = positionInFd.y;
      }
      
      var grabbableNodes = nodes.filter(":grabbable");
      
      function start(){
        // disable grabbing if so set
        if( options.ungrabifyWhileSimulating ){
          grabbableNodes.ungrabify();
        }
        
        fdRenderer.start();
      }
      
      self.stopSystem = function(){
        graph.filterNodes(function(){
          return false; // remove all nodes
        });
        
        if( options.ungrabifyWhileSimulating ){
          grabbableNodes.grabify();
        }

        if( options.fit ){
          cy.fit( options.padding );
        }
        
        nodes.off('drag position', dragHandler);

        layout.one('layoutstop', options.stop);
        layout.trigger({ type: 'layoutstop', layout: layout });

        self.stopSystem = null;
      };
      
      start();
      if( !options.infinite ){
        setTimeout(function(){
          self.stop();
        }, options.maxSimulationTime);
      }

    }); // require

    return this; // chaining
  };

  SpringyLayout.prototype.stop = function(){
    if( this.stopSystem != null ){
      this.stopSystem();
    }

    return this; // chaining
  };
  
  $$('layout', 'springy', SpringyLayout);

  
})(cytoscape);
