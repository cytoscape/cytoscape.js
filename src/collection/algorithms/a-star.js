import * as is from '../../is';
import Heap from '../../heap';
import Set from '../../set';

let elesfn = ({

  // Implemented from pseudocode from wikipedia
  aStar: function( options ){
    options = options || {};

    let cy = this._private.cy;

    // root - mandatory!
    let source;
    if( options != null && options.root != null ){
      source = is.string( options.root ) ?
        // use it as a selector, e.g. "#rootID
        this.filter( options.root )[0] :
        options.root[0];
    } else {
      return undefined;
    }

    // goal - mandatory!
    let target;
    if( options.goal != null ){
      target = is.string( options.goal ) ?
        // use it as a selector, e.g. "#goalID
        this.filter( options.goal )[0] :
        options.goal[0];
    } else {
      return undefined;
    }

    // Heuristic function - optional
    let heuristic;
    if( options.heuristic != null && is.fn( options.heuristic ) ){
      heuristic = options.heuristic;
    } else {
      heuristic = function(){ return 0; }; // use constant if unspecified
    }

    // Weight function - optional
    let weightFn;
    if( options.weight != null && is.fn( options.weight ) ){
      weightFn = options.weight;
    } else {
      // If not specified, assume each edge has equal weight (1)
      weightFn = function( e ){return 1;};
    }

    // directed - optional
    let directed;
    if( options.directed != null ){
      directed = options.directed;
    } else {
      directed = false;
    }

    let sid = source.id();
    let tid = target.id();

    let gScore = {};
    let fScore = {};
    let closedSetIds = {};
    let openSet = new Heap( (a, b) => fScore[a.id()] - fScore[b.id()] );
    let openSetIds = new Set();
    let cameFrom = {};
    let cameFromEdge = {};

    let addToOpenSet = (ele, id) => {
      openSet.push(ele);
      openSetIds.add(id);
    };

    let cMin, cMinId;

    let popFromOpenSet = () => {
      cMin = openSet.pop();
      cMinId = cMin.id();
      openSetIds.delete(cMinId);
    };

    let isInOpenSet = id => openSetIds.has(id);

    addToOpenSet(source, sid);

    gScore[ sid ] = 0;
    fScore[ sid ] = heuristic( source );

    // Counter
    let steps = 0;

    // Main loop
    while( openSet.size() > 0 ){
      popFromOpenSet();
      steps++;

      // If we've found our goal, then we are done
      if( cMinId === tid ){
        let path = [];
        let pathNode = target;
        let pathNodeId = tid;
        let pathEdge = cameFromEdge[pathNodeId];

        for( ;; ){
          path.unshift(pathNode);

          if( pathEdge != null ){
            path.unshift(pathEdge);
          }

          pathNode = cameFrom[pathNodeId];

          if( pathNode == null ){ break; }

          pathNodeId = pathNode.id();
          pathEdge = cameFromEdge[pathNodeId];
        }

        return {
          found: true,
          distance: gScore[ cMinId ],
          path: this.spawn( path ),
          steps
        };
      }

      // Add cMin to processed nodes
      closedSetIds[ cMinId ] = true;

      // Update scores for neighbors of cMin
      // Take into account if graph is directed or not
      let vwEdges = cMin._private.edges;

      for( let i = 0; i < vwEdges.length; i++ ){
        let e = vwEdges[ i ];

        // edge must be in set of calling eles
        if( !this.hasElementWithId( e.id() ) ){ continue; }

        // cMin must be the source of edge if directed
        if( directed && e.data('source') !== cMinId ){ continue; }

        let wSrc = e.source();
        let wTgt = e.target();

        let w = wSrc.id() !== cMinId ? wSrc : wTgt;
        let wid = w.id();

        // node must be in set of calling eles
        if( !this.hasElementWithId( wid ) ){ continue; }

        // if node is in closedSet, ignore it
        if( closedSetIds[ wid ] ){
          continue;
        }

        // New tentative score for node w
        let tempScore = gScore[ cMinId ] + weightFn( e );

        // Update gScore for node w if:
        //   w not present in openSet
        // OR
        //   tentative gScore is less than previous value

        // w not in openSet
        if( !isInOpenSet(wid) ){
          gScore[ wid ] = tempScore;
          fScore[ wid ] = tempScore + heuristic( w );
          addToOpenSet( w, wid );
          cameFrom[ wid ] = cMin;
          cameFromEdge[ wid ] = e;

          continue;
        }

        // w already in openSet, but with greater gScore
        if( tempScore < gScore[ wid ] ){
          gScore[ wid ] = tempScore;
          fScore[ wid ] = tempScore + heuristic( w );
          cameFrom[ wid ] = cMin;
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


export default elesfn;
