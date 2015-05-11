;( function( $$ ){ 'use strict';

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
    animate: true, // whether to show the layout as it's running
    ready: undefined, // Callback on layoutready
    stop: undefined, // Callback on layoutstop
    fit: true, // Reset viewport to fit default simulationBounds
    minDist: 20, // Minimum distance between nodes
    padding: 20, // Padding
    expandingFactor: -1.0, // If the network does not satisfy the minDist
    // criterium then it expands the network of this amount
    // If it is set to -1.0 the amount of expansion is automatically
    // calculated based on the minDist, the aspect ratio and the
    // number of nodes
    maxFruchtermanReingoldIterations: 50, // Maximum number of initial force-directed iterations
    maxExpandIterations: 4, // Maximum number of expanding iterations
    boundingBox: undefined // Constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
  };

  function SpreadLayout( options ) {
    this.options = $$.util.extend( {}, defaults, options );
  }

  function cellCentroid( cell ) {
    var hes = cell.halfedges;
    var area = 0,
      x = 0,
      y = 0;
    var p1, p2, f;

    for( var i = 0; i < hes.length; ++i ) {
      p1 = hes[ i ].getEndpoint();
      p2 = hes[ i ].getStartpoint();

      area += p1.x * p2.y;
      area -= p1.y * p2.x;

      f = p1.x * p2.y - p2.x * p1.y;
      x += ( p1.x + p2.x ) * f;
      y += ( p1.y + p2.y ) * f;
    }

    area /= 2;
    f = area * 6;
    return {
      x: x / f,
      y: y / f
    };
  }

  function sitesDistance( ls, rs ) {
    var dx = ls.x - rs.x;
    var dy = ls.y - rs.y;
    return Math.sqrt( dx * dx + dy * dy );
  }

  SpreadLayout.prototype.run = function() {

    var layout = this;
    // var self = this;
    var options = this.options;

    $$.util.requires(['foograph', 'Voronoi'], function(foograph, Voronoi){

      var cy = options.cy;
      // var allNodes = cy.nodes();
      var nodes = cy.nodes();
      //var allEdges = cy.edges();
      var edges = cy.edges();
      var cWidth = cy.width();
      var cHeight = cy.height();
      var simulationBounds = options.boundingBox ? $$.util.makeBoundingBox( options.boundingBox ) : null;
      var padding = options.padding;
      var simBBFactor = Math.max( 1, Math.log(nodes.length) * 0.8 );
      
      if( nodes.length < 100 ){
        simBBFactor /= 2;
      }

      layout.trigger( {
        type: 'layoutstart',
        layout: layout
      } );

      var simBB = {
        x1: 0,
        y1: 0,
        x2: cWidth * simBBFactor,
        y2: cHeight * simBBFactor
      };

      if( simulationBounds ) {
        simBB.x1 = simulationBounds.x1;
        simBB.y1 = simulationBounds.y1;
        simBB.x2 = simulationBounds.x2;
        simBB.y2 = simulationBounds.y2;
      }

      simBB.x1 += padding;
      simBB.y1 += padding;
      simBB.x2 -= padding;
      simBB.y2 -= padding;

      var width = simBB.x2 - simBB.x1;
      var height = simBB.y2 - simBB.y1;

      // Get start time
      var startTime = Date.now();

      // layout doesn't work with just 1 node
      if( nodes.size() <= 1 ) {
        nodes.positions( {
          x: Math.round( ( simBB.x1 + simBB.x2 ) / 2 ),
          y: Math.round( ( simBB.y1 + simBB.y2 ) / 2 )
        } );

        if( options.fit ) {
          cy.fit( options.padding );
        }

        // Get end time
        var endTime = Date.now();
        console.info( "Layout on " + nodes.size() + " nodes took " + ( endTime - startTime ) + " ms" );

        layout.one( "layoutready", options.ready );
        layout.trigger( "layoutready" );

        layout.one( "layoutstop", options.stop );
        layout.trigger( "layoutstop" );

        return;
      }

      // First I need to create the data structure to pass to the worker
      var pData = {
        'width': width,
        'height': height,
        'minDist': options.minDist,
        'expFact': options.expandingFactor,
        'expIt': 0,
        'maxExpIt': options.maxExpandIterations,
        'vertices': [],
        'edges': [],
        'startTime': startTime,
        'maxFruchtermanReingoldIterations': options.maxFruchtermanReingoldIterations
      };

      nodes.each(
        function( i, node ) {
          var nodeId = this._private.data.id;
          pData[ 'vertices' ].push( {
            id: nodeId,
            x: 0,
            y: 0
          } );
        } );

      edges.each(
        function() {
          var srcNodeId = this.source().id();
          var tgtNodeId = this.target().id();
          pData[ 'edges' ].push( {
            src: srcNodeId,
            tgt: tgtNodeId
          } );
        } );

      //Decleration
      var t1 = $$.Thread();
      // And to add the required scripts
      //EXTERNAL 1
      t1.require( foograph, 'foograph' );
      //EXTERNAL 2
      t1.require( Voronoi );

      //Local function
      t1.require( sitesDistance );
      t1.require( cellCentroid );

      function setPositions( pData ){ //console.log('set posns')
        // First we retrieve the important data
        // var expandIteration = pData[ 'expIt' ];
        var dataVertices = pData[ 'vertices' ];
        var vertices = [];
        for( var i = 0; i < dataVertices.length; ++i ) {
          var dv = dataVertices[ i ];
          vertices[ dv.id ] = {
            x: dv.x,
            y: dv.y
          };
        }
        /*
         * FINALLY:
         *
         * We position the nodes based on the calculation
         */
        nodes.positions(
          function( i, node ) {
            var id = node._private.data.id;
            // var pos = node._private.position;
            var vertex = vertices[ id ];

            return {
              x: Math.round( simBB.x1 + vertex.x ),
              y: Math.round( simBB.y1 + vertex.y )
            };
          } );

        if( options.fit ) {
          cy.fit( options.padding );
        }

        cy.nodes().rtrigger( "position" );
      }

      var didLayoutReady = false;
      t1.on('message', function(e){
        var pData = e.message; //console.log('message', e)

        if( !options.animate ){
          return;
        }

        setPositions( pData );

        if( !didLayoutReady ){
          layout.trigger( "layoutready" );

          didLayoutReady = true;
        }
      });

      layout.one( "layoutready", options.ready );

      t1.pass( pData ).run( function( pData ) {
        // I need to retrieve the important data
        var lWidth = pData[ 'width' ];
        var lHeight = pData[ 'height' ];
        var lMinDist = pData[ 'minDist' ];
        var lExpFact = pData[ 'expFact' ];
        var lMaxExpIt = pData[ 'maxExpIt' ];
        var lMaxFruchtermanReingoldIterations = pData[ 'maxFruchtermanReingoldIterations' ];

        // Prepare the data to output
        var savePositions = function(){
          pData[ 'width' ] = lWidth;
          pData[ 'height' ] = lHeight;
          pData[ 'expIt' ] = expandIteration;
          pData[ 'expFact' ] = lExpFact;

          pData[ 'vertices' ] = [];
          for( var i = 0; i < fv.length; ++i ) {
            pData[ 'vertices' ].push( {
              id: fv[ i ].label,
              x: fv[ i ].x,
              y: fv[ i ].y
            } );
          }
        };

        var messagePositions = function(){
          broadcast( pData );
        };

        /*
         * FIRST STEP: Application of the Fruchterman-Reingold algorithm
         *
         * We use the version implemented by the foograph library
         *
         * Ref.: https://code.google.com/p/foograph/
         */

        // We need to create an instance of a graph compatible with the library
        var frg = new foograph.Graph( "FRgraph", false );

        var frgNodes = {};

        // Then we have to add the vertices
        var dataVertices = pData[ 'vertices' ];
        for( var ni = 0; ni < dataVertices.length; ++ni ) {
          var id = dataVertices[ ni ][ 'id' ];
          var v = new foograph.Vertex( id, Math.round( Math.random() * lHeight ), Math.round( Math.random() * lHeight ) );
          frgNodes[ id ] = v;
          frg.insertVertex( v );
        }

        var dataEdges = pData[ 'edges' ];
        for( var ei = 0; ei < dataEdges.length; ++ei ) {
          var srcNodeId = dataEdges[ ei ][ 'src' ];
          var tgtNodeId = dataEdges[ ei ][ 'tgt' ];
          frg.insertEdge( "", 1, frgNodes[ srcNodeId ], frgNodes[ tgtNodeId ] );
        }

        var fv = frg.vertices;

        // Then we apply the layout
        var iterations = lMaxFruchtermanReingoldIterations;
        var frLayoutManager = new foograph.ForceDirectedVertexLayout( lWidth, lHeight, iterations, false, lMinDist );

        frLayoutManager.callback = function(){
          savePositions();
          messagePositions();
        };

        frLayoutManager.layout( frg );

        savePositions();
        messagePositions();

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
        var bbox = {
          xl: 0,
          xr: lWidth,
          yt: 0,
          yb: lHeight
        };
        var vSites = [];
        for( var i = 0; i < fv.length; ++i ) {
          vSites[ fv[ i ].label ] = fv[ i ];
        }

        function checkMinDist( ee ) {
          var infractions = 0;
          // Then we check if the minimum distance is satisfied
          for( var eei = 0; eei < ee.length; ++eei ) {
            var e = ee[ eei ];
            if( ( e.lSite != null ) && ( e.rSite != null ) && sitesDistance( e.lSite, e.rSite ) < lMinDist ) {
              ++infractions;
            }
          }
          return infractions;
        }

        var diagram = voronoi.compute( fv, bbox );

        // Then we reposition the nodes at the centroid of their Voronoi cells
        var cells = diagram.cells;
        for( var i = 0; i < cells.length; ++i ) {
          var cell = cells[ i ];
          var site = cell.site;
          var centroid = cellCentroid( cell );
          var currv = vSites[ site.label ];
          currv.x = centroid.x;
          currv.y = centroid.y;
        }

        if( lExpFact < 0.0 ) {
          // Calculates the expanding factor
          lExpFact = Math.max( 0.05, Math.min( 0.10, lMinDist / Math.sqrt( ( lWidth * lHeight ) / fv.length ) * 0.5 ) );
          //console.info("Expanding factor is " + (options.expandingFactor * 100.0) + "%");
        }

        var prevInfractions = checkMinDist( diagram.edges );
        //console.info("Initial infractions " + prevInfractions);

        var bStop = ( prevInfractions <= 0 );

        var voronoiIteration = 0;
        var expandIteration = 0;

        // var initWidth = lWidth;

        while( !bStop ) {
          ++voronoiIteration;
          for( var it = 0; it <= 4; ++it ) {
            voronoi.recycle( diagram );
            diagram = voronoi.compute( fv, bbox );

            // Then we reposition the nodes at the centroid of their Voronoi cells
            cells = diagram.cells;
            for( var i = 0; i < cells.length; ++i ) {
              var cell = cells[ i ];
              var site = cell.site;
              var centroid = cellCentroid( cell );
              var currv = vSites[ site.label ];
              currv.x = centroid.x;
              currv.y = centroid.y;
            }
          }

          var currInfractions = checkMinDist( diagram.edges );
          //console.info("Current infractions " + currInfractions);

          if( currInfractions <= 0 ) {
            bStop = true;
          } else {
            if( currInfractions >= prevInfractions || voronoiIteration >= 4 ) {
              if( expandIteration >= lMaxExpIt ) {
                bStop = true;
              } else {
                lWidth += lWidth * lExpFact;
                lHeight += lHeight * lExpFact;
                bbox = {
                  xl: 0,
                  xr: lWidth,
                  yt: 0,
                  yb: lHeight
                };
                ++expandIteration;
                voronoiIteration = 0;
                //console.info("Expanded to ("+width+","+height+")");
              }
            }
          }
          prevInfractions = currInfractions;

          savePositions();
          messagePositions();
        }

        savePositions();
        return pData;

      } ).then( function( pData ) {
        // var expandIteration = pData[ 'expIt' ];
        var dataVertices = pData[ 'vertices' ];

        setPositions( pData );

        // Get end time
        var startTime = pData[ 'startTime' ];
        var endTime = new Date();
        console.info( "Layout on " + dataVertices.length + " nodes took " + ( endTime - startTime ) + " ms" );

        layout.one( "layoutstop", options.stop );

        if( !options.animate ){
          layout.trigger( "layoutready" );
        }

        layout.trigger( "layoutstop" );

        t1.stop();
      } );

    });

    return this;
  }; // run

  SpreadLayout.prototype.stop = function() {};

  $$( 'layout', 'spread', SpreadLayout );


} )( cytoscape );
