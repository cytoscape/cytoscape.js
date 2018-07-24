import * as is from '../../is';

let elesfn = ({

  pageRank: function( options ){
    options = options || {};

    let normalizeVector = function( vector ){
      let length = vector.length;

      // First, get sum of all elements
      let total = 0;
      for( let i = 0; i < length; i++ ){
        total += vector[ i ];
      }

      // Now, divide each by the sum of all elements
      for( let i = 0; i < length; i++ ){
        vector[ i ] = vector[ i ] / total;
      }
    };

    // dampingFactor - optional
    let dampingFactor;
    if( options != null &&
      options.dampingFactor != null ){
      dampingFactor = options.dampingFactor;
    } else {
      dampingFactor = 0.8; // Default damping factor
    }

    // desired precision - optional
    let epsilon;
    if( options != null &&
      options.precision != null ){
      epsilon = options.precision;
    } else {
      epsilon = 0.000001; // Default precision
    }

    // Max number of iterations - optional
    let numIter;
    if( options != null &&
      options.iterations != null ){
      numIter = options.iterations;
    } else {
      numIter = 200; // Default number of iterations
    }

    // Weight function - optional
    let weightFn;
    if( options != null && options.weight != null && is.fn( options.weight ) ){
      weightFn = options.weight;
    } else {
      // If not specified, assume each edge has equal weight (1)
      weightFn = () => 1;
    }

    let cy = this._private.cy;
    let { nodes, edges } = this.byGroup();
    let numNodes = nodes.length;
    let numEdges = edges.length;

    // Create numerical identifiers for each node
    // mapping: node id -> position in nodes array
    // for reverse mapping, simply use nodes array
    let id2position = {};
    for( let i = 0; i < numNodes; i++ ){
      id2position[ nodes[ i ].id() ] = i;
    }

    // Construct transposed adjacency matrix
    // First lets have a zeroed matrix of the right size
    // We'll also keep track of the sum of each column
    let matrix = [];
    let columnSum = [];
    let additionalProb = (1 - dampingFactor) / numNodes;

    // Create null matrix
    for( let i = 0; i < numNodes; i++ ){
      let newRow = [];
      for( let j = 0; j < numNodes; j++ ){
        newRow.push( 0.0 );
      }
      matrix.push( newRow );
      columnSum.push( 0.0 );
    }

    // Now, process edges
    for( let i = 0; i < numEdges; i++ ){
      let edge = edges[ i ];

      // Don't include loops in the matrix
      if( edge.isLoop() ){ continue; }

      let s = id2position[ edge.data('source') ];
      let t = id2position[ edge.data('target') ];
      let w = weightFn( edge );

      // Update matrix
      matrix[ t ][ s ] += w;

      // Update column sum
      columnSum[ s ] += w;
    }

    // Add additional probability based on damping factor
    // Also, take into account columns that have sum = 0
    let p = 1.0 / numNodes + additionalProb; // Shorthand
    // Traverse matrix, column by column
    for( let j = 0; j < numNodes; j++ ){
      if( columnSum[ j ] === 0 ){
        // No 'links' out from node jth, assume equal probability for each possible node
        for( let i = 0; i < numNodes; i++ ){
          matrix[ i ][ j ] = p;
        }
      } else {
        // Node jth has outgoing link, compute normalized probabilities
        for( let i = 0; i < numNodes; i++ ){
          matrix[ i ][ j ] = matrix[ i ][ j ] / columnSum[ j ] + additionalProb;
        }
      }
    }

    // Compute dominant eigenvector using power method
    let eigenvector = [];
    let nullVector = [];
    let previous;

    // Start with a vector of all 1's
    // Also, initialize a null vector which will be used as shorthand
    for( let i = 0; i < numNodes; i++ ){
      eigenvector.push( 1.0 );
      nullVector.push( 0.0 );
    }

    for( let iter = 0; iter < numIter; iter++ ){
      // New array with all 0's
      let temp = nullVector.slice( 0 );

      // Multiply matrix with previous result
      for( let i = 0; i < numNodes; i++ ){
        for( let j = 0; j < numNodes; j++ ){
          temp[ i ] += matrix[ i ][ j ] * eigenvector[ j ];
        }
      }

      normalizeVector( temp );
      previous = eigenvector;
      eigenvector = temp;

      let diff = 0;
      // Compute difference (squared module) of both vectors
      for( let i = 0; i < numNodes; i++ ){
        let delta = previous[ i ] - eigenvector[ i ];

        diff += delta * delta;
      }

      // If difference is less than the desired threshold, stop iterating
      if( diff < epsilon ){
        break;
      }
    }

    // Construct result
    let res = {
      rank: function( node ){
        let nodeId;

        if( is.string( node ) ){
          // is a selector string
          nodeId = (cy.filter( node )[0]).id();
        } else {
          // is a node object
          nodeId = node.id();
        }
        return eigenvector[ id2position[ nodeId ] ];
      }
    };


    return res;
  } // pageRank

}); // elesfn

export default elesfn;
