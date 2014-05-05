;(function($$){ 'use strict';
  
  var defaults = {
    maxSimulationTime: 1000,
    ungrabifyWhileSimulating: true,
    fit: true,
    random: false
  };
  
  function SpringyLayout( options ){
    this.options = $$.util.extend(true, {}, defaults, options);
  }
  
  function exec(fn){
    if( fn != null && typeof fn == typeof function(){} ){
      fn();
    }
  }
  
  SpringyLayout.prototype.run = function(){
    var self = this;
    var options = this.options;
    var params = options;
  
    var cy = options.cy;
    var nodes = cy.nodes();
    var edges = cy.edges();

    var container = cy.container();
    
    var width = container.clientWidth;
    var height = container.clientHeight;
    
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
    
    var layout = new Springy.Layout.ForceDirected(graph, 400.0, 400.0, 0.5);
    
    var currentBB = layout.getBoundingBox();
    var targetBB = {bottomleft: new Springy.Vector(-2, -2), topright: new Springy.Vector(2, 2)};
    
    // convert to/from screen coordinates
    var toScreen = function(p) {
      var size = currentBB.topright.subtract(currentBB.bottomleft);
      var sx = p.subtract(currentBB.bottomleft).divide(size.x).x * width;
      var sy = p.subtract(currentBB.bottomleft).divide(size.y).y * height;
      return new Springy.Vector(sx, sy);
    };

    var fromScreen = function(s) {
      var size = currentBB.topright.subtract(currentBB.bottomleft);
      var px = (s.x / width) * size.x + currentBB.bottomleft.x;
      var py = (s.y / height) * size.y + currentBB.bottomleft.y;
      return new Springy.Vector(px, py);
    };
    
    var movedNodes = cy.collection();
    
    var numNodes = cy.nodes().size();
    var drawnNodes = 1;
    var fdRenderer = new Springy.Renderer(layout,
      function clear() {
        // code to clear screen
      },
      function drawEdge(edge, p1, p2) {
        // draw an edge
      },
      function drawNode(node, p) {
      var v = toScreen(p);
      var element = node.data.element;
      
      window.p = p;
      window.n = node;
      
      if( !element.locked() ){
          element._private.position = {
            x: v.x,
            y: v.y
          };
          movedNodes = movedNodes.add(element);
      } else {
        setLayoutPositionForElement(element);
      }
      
      if( drawnNodes == numNodes ){
        cy.one('layoutready', options.ready);
        cy.trigger('layoutready');
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
  
    // update actual node positions every once in a while
    setInterval(function(){
      if( movedNodes.size() > 0 ){
        movedNodes.rtrigger('position');
        movedNodes = cy.collection();
      }
    }, 50);
    
    // update node positions when dragging
    nodes.bind('drag', function(){
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
    
    function stop(callback){
      graph.filterNodes(function(){
        return false; // remove all nodes
      });
      
      setTimeout(function(){
        if( options.ungrabifyWhileSimulating ){
          grabbableNodes.grabify();
        }
        
        callback();
      }, 100);
    }

    var stopSystem = self.stopSystem = function(){
      stop(function(){
        if( options.fit ){
          cy.fit();
        }
        
        cy.one('layoutstop', options.stop);
        cy.trigger('layoutstop');

        self.stopSystem = null;
      });
    };
    
    start();
    setTimeout(function(){
      stopSystem();
    }, options.maxSimulationTime);

  };

  SpringyLayout.prototype.stop = function(){
    if( this.stopSystem != null ){
      this.stopSystem();
    }
  };
  
  $$('layout', 'springy', SpringyLayout);

  
})(cytoscape);
