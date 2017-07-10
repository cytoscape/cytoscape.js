var is = require( '../../is' );

var elesfn = ({

  // Implemented from pseudocode from wikipedia
  aStar: function( options ){
    var eles = this;

    options = options || {};

    // Reconstructs the path from Start to End, acumulating the result in pathAcum
    var reconstructPath = function( start, end, cameFromMap, pathAcum ){
      // Base case
      if( start == end ){
        pathAcum.unshift( cy.getElementById( end ) );
        return pathAcum;
      }

      if( end in cameFromMap ){
        // We know which node is before the last one
        var previous = cameFromMap[ end ];
        var previousEdge = cameFromEdge[ end ];

        pathAcum.unshift( cy.getElementById( previousEdge ) );
        pathAcum.unshift( cy.getElementById( end ) );

        return reconstructPath( start,
                     previous,
                     cameFromMap,
                     pathAcum );
      }

      // We should not reach here!
      return undefined;
    };

    // Returns the index of the element in openSet which has minimum fScore
    var findMin = function( openSet, fScore ){
      if( openSet.length === 0 ){
        // Should never be the case
        return undefined;
      }
      var minPos = 0;
      var tempScore = fScore[ openSet[0] ];
      for( var i = 1; i < openSet.length; i++ ){
        var s = fScore[ openSet[ i ] ];
        if( s < tempScore ){
          tempScore = s;
          minPos = i;
        }
      }
      return minPos;
    };

    var cy = this._private.cy;

    // root - mandatory!
    if( options != null && options.root != null ){
      var source = is.string( options.root ) ?
        // use it as a selector, e.g. "#rootID
        this.filter( options.root )[0] :
        options.root[0];
    } else {
      return undefined;
    }

    // goal - mandatory!
    if( options.goal != null ){
      var target = is.string( options.goal ) ?
        // use it as a selector, e.g. "#goalID
        this.filter( options.goal )[0] :
        options.goal[0];
    } else {
      return undefined;
    }

    // Heuristic function - optional
    if( options.heuristic != null && is.fn( options.heuristic ) ){
      var heuristic = options.heuristic;
    } else {
      var heuristic = function(){ return 0; }; // use constant if unspecified
    }

    // Weight function - optional
    if( options.weight != null && is.fn( options.weight ) ){
      var weightFn = options.weight;
    } else {
      // If not specified, assume each edge has equal weight (1)
      var weightFn = function( e ){return 1;};
    }

    // directed - optional
    if( options.directed != null ){
      var directed = options.directed;
    } else {
      var directed = false;
    }

    var sid = source.id();
    var tid = target.id();

    var closedSet = [];
    var openSet = [ sid ];
    var cameFrom = {};
    var cameFromEdge = {};
    var gScore = {};
    var fScore = {};

    gScore[ sid ] = 0;
    fScore[ sid ] = heuristic( source );

    // Counter
    var steps = 0;

    // Main loop
    while( openSet.length > 0 ){
      var minPos = findMin( openSet, fScore );
      var cMin = cy.getElementById( openSet[ minPos ] );
      var cMinId = cMin.id();
      steps++;

      // If we've found our goal, then we are done
      if( cMinId == tid ){
        var rPath = reconstructPath( sid, tid, cameFrom, [] );

        return {
          found: true,
          distance: gScore[ cMinId ],
          path: eles.spawn( rPath ),
          steps: steps
        };
      }

      // Add cMin to processed nodes
      closedSet.push( cMinId );
      // Remove cMin from boundary nodes
      openSet.splice( minPos, 1 );

      // Update scores for neighbors of cMin
      // Take into account if graph is directed or not
      var vwEdges = cMin._private.edges;

      for( var i = 0; i < vwEdges.length; i++ ){
        var e = vwEdges[ i ];

        // edge must be in set of calling eles
        if( !this.hasElementWithId( e.id() ) ){ continue; }

        // cMin must be the source of edge if directed
        if( directed && e.data('source') !== cMinId ){ continue; }

        var wSrc = e.source();
        var wTgt = e.target();

        var w = wSrc.id() !== cMinId ? wSrc : wTgt;
        var wid = w.id();

        // node must be in set of calling eles
        if( !this.hasElementWithId( wid ) ){ continue; }

        // if node is in closedSet, ignore it
        if( closedSet.indexOf( wid ) != -1 ){
          continue;
        }

        // New tentative score for node w
        var tempScore = gScore[ cMinId ] + weightFn( e );

        // Update gScore for node w if:
        //   w not present in openSet
        // OR
        //   tentative gScore is less than previous value

        // w not in openSet
        if( openSet.indexOf( wid ) == -1 ){
          gScore[ wid ] = tempScore;
          fScore[ wid ] = tempScore + heuristic( w );
          openSet.push( wid ); // Add node to openSet
          cameFrom[ wid ] = cMinId;
          cameFromEdge[ wid ] = e.id();
          continue;
        }
        // w already in openSet, but with greater gScore
        if( tempScore < gScore[ wid ] ){
          gScore[ wid ] = tempScore;
          fScore[ wid ] = tempScore + heuristic( w );
          cameFrom[ wid ] = cMinId;
        }

      } // End of neighbors update

    } // End of main loop

    // If we've reached here, then we've not reached our goal
    return {
      found: false,
      distance: undefined,
      path: undefined,
      steps: steps
    };
  }

}); // elesfn


module.exports = elesfn;
