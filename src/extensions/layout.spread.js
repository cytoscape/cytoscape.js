;(function($$){
  
  /*
   * This layout combines several algorithms:
   * 
   * - It generates an initial position of the nodes by using the
   *   Fruchterman-Reingold algorithm (doi:10.1002/spe.4380211102)
   * 
   * - Finally it eliminates overlaps by using the method described by
   *   Gansner and North (doi:10.1007/3-540-37623-2_28)
   */
  
  var defaults = {
    ready: undefined,            // Callback on layoutready 
    stop: undefined,             // Callback on layoutstop
    fit: true,                   // Reset viewport to fit default simulationBounds
    minDist: 40,                 // Minimum distance between nodes
    padding: 20,                 // Padding 
    expandingFactor: -1.0,       // If the network does not satisfy the minDist
                                 // criterium then it expands the network of this amount
                                 // If it is set to -1.0 the amount of expansion is automatically
                                 // calculated based on the minDist, the aspect ratio and the
                                 // number of nodes
    maxExpandIterations: 4,     // Maximum number of expanding iterations
    simulationBounds: undefined  // [x1, y1, x2, y2]; [0, 0, width, height] by default
  };
  
  function SpreadLayout(options){
    this.options = $$.util.extend({}, defaults, options);
  }
  
  function scriptPath() {
    var scripts = document.getElementsByTagName('SCRIPT');
    var path = '';
    if(scripts && scripts.length>0) {
        for(var i in scripts) {
            if(scripts[i].src && scripts[i].src.match(/script\.js$/)) {
                path = scripts[i].src.replace(/(.*)script\.js$/, '$1');
            }
        }
    }
    return path;
  }
  
  function cellCentroid( cell ) {
    var hes = cell.halfedges;
    var area = 0, x = 0, y = 0;
    var p1, p2, f;

    for( var i = 0; i < hes.length; ++i ) {
      p1 = hes[i].getEndpoint();
      p2 = hes[i].getStartpoint();
      
      area += p1.x * p2.y;
      area -= p1.y * p2.x;
      
      f  = p1.x * p2.y - p2.x * p1.y;
      x += ( p1.x + p2.x ) * f;
      y += ( p1.y + p2.y ) * f;
    }

    area /= 2;
    f = area * 6;
    return { x: x / f, y: y / f };
  }
  
  function sitesDistance( ls, rs ) {
    var dx = ls.x - rs.x;
    var dy = ls.y - rs.y;
    return Math.sqrt( dx*dx + dy*dy );
  }

  SpreadLayout.prototype.run = function(){

    var layout = this;
    var self = this;
    
    var options = this.options;
    var cy = options.cy;
    var allNodes = cy.nodes();
    var nodes = cy.elements("node:visible");
    //var allEdges = cy.edges();
    var edges = cy.elements("edge:visible");
    var container = cy.container();
    var cWidth = container.clientWidth;
    var cHeight = container.clientHeight;
    var simulationBounds = options.simulationBounds;
    var padding = options.padding;

    layout.trigger({ type: 'layoutstart', layout: layout });

    var simBB = { x1: 0, y1: 0, x2: cWidth, y2: cHeight };
    
    if( simulationBounds ){
      simBB.x1 = simulationBounds[0] + padding;
      simBB.y1 = simulationBounds[1] + padding;
      simBB.x2 = simulationBounds[2] - padding;
      simBB.y2 = simulationBounds[3] - padding;
    } else {
      simBB.x1 = padding;
      simBB.y1 = padding;
      simBB.x2 = cWidth  - padding;
      simBB.y2 = cHeight - padding;
    }

    var width  = simBB.x2 - simBB.x1;
    var height = simBB.y2 - simBB.y1;

    layout.one("layoutready", options.ready);
    layout.trigger("layoutready");

    // Get start time
    var startTime = new Date();

    // arbor doesn't work with just 1 node
    if( nodes.size() <= 1 ){
      if( options.fit ){
        cy.reset();
      }

      nodes.positions({
        x: Math.round( (simBB.x1 + simBB.x2)/2 ),
        y: Math.round( (simBB.y1 + simBB.y2)/2 )
      });

      // Get end time
      var endTime = new Date();
      console.info("Layout on "+nodes.size()+" nodes took " + (endTime - startTime) + " ms");

      layout.one("layoutstop", options.stop);
      layout.trigger("layoutstop");

      return;
    }

    // First I need to create the data structure to pass to the worker
    var pData = {
      'width'     : width,
      'height'    : height,
      'minDist'   : options.minDist,
      'expFact'   : options.expandingFactor,
      'expIt'     : 0,
      'maxExpIt'  : options.maxExpandIterations,
      'vertices'  : [],
      'edges'     : [],
      'startTime' : startTime
    };

    nodes.each(
      function(i, node){
        var nodeId = this._private.data.id;
        pData['vertices'].push({id:nodeId,x:0,y:0});
      });
    
    edges.each(
      function(){
        var srcNodeId = this.source().id();
        var tgtNodeId = this.target().id();
        pData['edges'].push({src:srcNodeId,tgt:tgtNodeId});
      });

    // Then I need to create the parallel environment
    var parallelSrcPath = $('script[src$="/parallel.js"]').attr('src');
    if( parallelSrcPath == null ) {
      throw "In order to use the 'spread' layout you need to load the parallel.js library before the cytoscape.js library.";
    }
    var evalScrPath =  parallelSrcPath.substring(0, parallelSrcPath.lastIndexOf('/'))+"/eval.js";
    var p = new Parallel( pData, { evalPath: evalScrPath } );
    
    // And to add the required scripts
    p.require("foograph.js");
    //p.require("random.js");
    //p.require("forcedirected.js");
    p.require("rhill-voronoi-core.js");
    p.require(sitesDistance);
    p.require(cellCentroid);
    
    // Then I can spawn the execution of the layout
    p.spawn(
      function(pData) {

        // I need to retrieve the important data
        var lWidth    = pData['width'];
        var lHeight   = pData['height']; 
        var lMinDist  = pData['minDist'];
        var lExpFact  = pData['expFact'];
        var lMaxExpIt = pData['maxExpIt'];

        /*
         * FIRST STEP: Application of the Fruchterman-Reingold algorithm
         * 
         * We use the version implemented by the foograph library
         *  
         * Ref.: https://code.google.com/p/foograph/
         */
        
        // We need to create an instance of a graph compatible with the library
        var frg = new foograph.Graph("FRgraph", false);
        
        var frgNodes = {};
        
        // Then we have to add the vertices
        var dataVertices = pData['vertices'];
        for( var ni = 0; ni < dataVertices.length; ++ni ) {
          var id = dataVertices[ni]['id'];
          var v = new foograph.Vertex( id, Math.round(Math.random()*lHeight), Math.round(Math.random()*lHeight) );
          frgNodes[id] = v;
          frg.insertVertex(v);
        }
        
        var dataEdges = pData['edges'];
        for( var ei = 0; ei < dataEdges.length; ++ei ) {
          var srcNodeId = dataEdges[ei]['src'];
          var tgtNodeId = dataEdges[ei]['tgt'];
          frg.insertEdge( "", 1, frgNodes[srcNodeId], frgNodes[tgtNodeId] );
        }

        var fv = frg.vertices;
    
        // Then we apply the layout
        var frLayoutManager = new foograph.ForceDirectedVertexLayout(lWidth, lHeight, 400, false, 20);
        
        frLayoutManager.layout(frg);
    
        /*
         * SECOND STEP: Tiding up of the graph.
         * 
         * We use the method described by Gansner and North, based on Voronoi
         * diagrams.
         * 
         * Ref: doi:10.1007/3-540-37623-2_28
         */
    
        // We calculate the Voronoi diagram dor the position of the nodes
        var voronoi = new Voronoi();
        var bbox = { xl:0, xr:lWidth, yt:0, yb:lHeight };
        var vSites = [];
        for( var i = 0; i < fv.length; ++i ) {
          vSites[fv[i].label] = fv[i];
        }
        
        function checkMinDist(ee) {
          var infractions = 0;
          // Then we check if the minimum distance is satisfied
          for( var eei = 0; eei < ee.length; ++eei ) {
            var e = ee[eei];
            if( (e.lSite != null) && (e.rSite != null) && sitesDistance(e.lSite,e.rSite) < lMinDist ) {
              ++infractions;
            }
          }
          return infractions;
        }
        
        var diagram = voronoi.compute(fv, bbox);
        
        // Then we reposition the nodes at the centroid of their Voronoi cells
        var cells = diagram.cells;
        for( var i = 0; i < cells.length; ++i ) {
          var cell = cells[i];
          var site = cell.site;
          var centroid = cellCentroid(cell);
          var currv = vSites[site.label];
          currv.x = centroid.x;
          currv.y = centroid.y;
        }

        if( lExpFact < 0.0 ) {
          // Calculates the expanding factor
          lExpFact = Math.max(0.05,Math.min(0.10,lMinDist / Math.sqrt((lWidth*lHeight)/fv.length) * 0.5));
          //console.info("Expanding factor is " + (options.expandingFactor * 100.0) + "%");
        }
        
        var prevInfractions = checkMinDist(diagram.edges);
        //console.info("Initial infractions " + prevInfractions);
    
        var bStop = (prevInfractions <= 0);
        
        var voronoiIteration = 0;
        var expandIteration  = 0;
        
        var initWidth  = lWidth;
        
        while( !bStop ) {
          ++voronoiIteration;
          for( var it = 0; it <= 4; ++it ) {
            voronoi.recycle(diagram);
            diagram = voronoi.compute(fv, bbox);
            
            // Then we reposition the nodes at the centroid of their Voronoi cells
            cells = diagram.cells;
            for( var i = 0; i < cells.length; ++i ) {
              var cell = cells[i];
              var site = cell.site;
              var centroid = cellCentroid(cell);
              var currv = vSites[site.label];
              currv.x = centroid.x;
              currv.y = centroid.y;
            }
          }
          
          var currInfractions = checkMinDist(diagram.edges);
          //console.info("Current infractions " + currInfractions);
    
          if( currInfractions <= 0 ) {
            bStop = true;
          } else {
            if( currInfractions >= prevInfractions || voronoiIteration >= 4 ) {
              if( expandIteration >= lMaxExpIt ) {
                bStop = true;
              } else {
                lWidth  += lWidth  * lExpFact;
                lHeight += lHeight * lExpFact;
                bbox = { xl:0, xr:lWidth, yt:0, yb:lHeight };
                ++expandIteration;
                voronoiIteration = 0;
                //console.info("Expanded to ("+width+","+height+")");
              }
            }
          }
          prevInfractions = currInfractions;
        }
        
        // Prepare the data to output
        pData['width']   = lWidth;
        pData['height']  = lHeight;
        pData['expIt']   = expandIteration;
        pData['expFact'] = lExpFact;

        pData['vertices'] = [];
        for( var i = 0; i < fv.length; ++i ) {
          pData['vertices'].push({id:fv[i].label,x:fv[i].x,y:fv[i].y});
        }
        return pData;
      }
    ).then(
      function(pData) {
        // First we retrieve the important data
        var expandIteration = pData['expIt'];
        
        var dataVertices = pData['vertices'];
        var vertices = [];
        for( var i = 0; i < dataVertices.length; ++i ) {
          var dv = dataVertices[i];
          vertices[dv.id] = {x:dv.x,y:dv.y};
        } 
        /*
         * FINALLY:
         * 
         * We position the nodes based on the calculation
         */
        allNodes.positions(
          function(i,node) {
            var pos = node._private.position;
            pos.x = simBB.x1;
            pos.y = simBB.y1;
          });

        nodes.positions(
          function(i,node) {
            var id = node._private.data.id;
            var pos = node._private.position;
            var vertex = vertices[id];
            pos.x = Math.round(simBB.x1+vertex.x);
            pos.y = Math.round(simBB.y1+vertex.y);
          });

        if( options.fit && expandIteration > 0 ){
          cy.fit(options.padding);
        } else {
          cy.reset();
        }
        
        cy.nodes().rtrigger("position");

        // Get end time
        var startTime = pData['startTime'];
        var endTime = new Date();
        console.info("Layout on "+dataVertices.length+" nodes took " + (endTime - startTime) + " ms");

        layout.one("layoutstop", options.stop);
        layout.trigger("layoutstop");
        
      }
    );
    return this;
  };

  SpreadLayout.prototype.stop = function(){
  };
  
  $$('layout', 'spread', SpreadLayout);
  
  
})(cytoscape);
