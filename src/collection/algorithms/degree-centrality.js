import * as is from '../../is';
import * as util from '../../util';

const defaults = util.defaults({
  root: null,
  weight: edge => 1,
  directed: false,
  alpha: 0
});

let elesfn = ({

    /**
 * @callback degreeCentralityNormalized_options
 * @property {degreeCentralityNormalized_options_type} options - degreeCentralityNormalized_options_type
 */

/**
 * options
 * @typedef {object} degreeCentralityNormalized_options_type
 * @property {object} weight:function(edge) - [optional] A function that returns the positive weight for the edge. The weight indicates the importance of the edge, with a high value representing high importance.
 * @property {object} alpha - [optional] The alpha value for the centrality calculation, ranging on [0, 1]. With value 0 (default), disregards edge weights and solely uses number of edges in the centrality calculation. With value 1, disregards number of edges and solely uses the edge weights in the centrality calculation.
 * @property {object} directed - [optional] A boolean indicating whether the directed indegree and outdegree centrality is calculated (`true`) or whether the undirected centrality is calculated (`false`, default).
 */

/**
 * @typedef {object} eles_degreeCentralityNormalized
 * @property {function(degreeCentralityNormalized_options):any} degreeCentralityNormalized_options - The options for degreeCentralityNormalizeding.
 */

  /**
 * Considering only the elements in the calling collection, calculate the [degree centrality](https://en.wikipedia.org/wiki/Centrality#Degree_centrality) of the nodes.
 * @memberof eles
 * @pureAliases eles.dcn|eles.degreeCentralityNormalised
 * @path Collection/Centrality
 * @param {...eles_degreeCentralityNormalized} options - NULL
 * @methodName eles.degreeCentralityNormalized
 */
  degreeCentralityNormalized: function( options ){
    options = defaults( options );

    let cy = this.cy();
    let nodes = this.nodes();
    let numNodes = nodes.length;

    if( !options.directed ){
      let degrees = {};
      let maxDegree = 0;

      for( let i = 0; i < numNodes; i++ ){
        let node = nodes[ i ];

        // add current node to the current options object and call degreeCentrality
        options.root = node;

        let currDegree = this.degreeCentrality( options );

        if( maxDegree < currDegree.degree ){
          maxDegree = currDegree.degree;
        }

        degrees[ node.id() ] = currDegree.degree;
      }

      return {
        degree: function( node ){
          if( maxDegree === 0 ){ return 0; }

          if( is.string( node ) ){
            // from is a selector string
            node = cy.filter( node );
          }

          return degrees[ node.id() ] / maxDegree;
        }
      };
    } else {
      let indegrees = {};
      let outdegrees = {};
      let maxIndegree = 0;
      let maxOutdegree = 0;

      for( let i = 0; i < numNodes; i++ ){
        let node = nodes[ i ];
        let id = node.id();

        // add current node to the current options object and call degreeCentrality
        options.root = node;

        let currDegree = this.degreeCentrality( options );

        if( maxIndegree < currDegree.indegree )
          maxIndegree = currDegree.indegree;

        if( maxOutdegree < currDegree.outdegree )
          maxOutdegree = currDegree.outdegree;

        indegrees[ id ] = currDegree.indegree;
        outdegrees[ id ] = currDegree.outdegree;
      }

      return {
        indegree: function( node ){
          if ( maxIndegree == 0 ){ return 0; }

          if( is.string( node ) ){
            // from is a selector string
            node = cy.filter( node );
          }

          return indegrees[ node.id() ] / maxIndegree;
        },
        outdegree: function( node ){
          if ( maxOutdegree === 0 ){ return 0; }

          if( is.string( node ) ){
            // from is a selector string
            node = cy.filter( node );
          }

          return outdegrees[ node.id() ] / maxOutdegree;
        }

      };
    }

  }, // degreeCentralityNormalized

  // Implemented from the algorithm in Opsahl's paper
  // "Node centrality in weighted networks: Generalizing degree and shortest paths"
  // check the heading 2 "Degree"


  /**
 * @callback degreeCentrality_options
 * @property {degreeCentrality_options_type} options - degreeCentrality_options_type
 */

/**
 * options
 * @typedef {object} degreeCentrality_options_type
 * @property {object} root - The root node (selector or collection) for which the centrality calculation is made.
 * @property {object} weight:function(edge) - [optional] A function that returns the positive weight for the edge. The weight indicates the importance of the edge, with a high value representing high importance.
 * @property {object} alpha - [optional] The alpha value for the centrality calculation, ranging on [0, 1]. With value 0 (default), disregards edge weights and solely uses number of edges in the centrality calculation. With value 1, disregards number of edges and solely uses the edge weights in the centrality calculation.
 * @property {object} directed - [optional] A boolean indicating whether the directed indegree and outdegree centrality is calculated (`true`) or whether the undirected centrality is calculated (`false`, default).
 */

/**
 * @typedef {object} eles_degreeCentrality
 * @property {function(degreeCentrality_options):any} degreeCentrality_options - The options for degreeCentralitying.
 */

  /**
 * Considering only the elements in the calling collection, calculate the [degree centrality](https://en.wikipedia.org/wiki/Centrality#Degree_centrality) of the specified root node.
 * @memberof eles
 * @pureAliases eles.dc
 * @path Collection/Centrality
 * @param {...eles_degreeCentrality} options - NULL
 * @methodName eles.degreeCentrality
 */
  degreeCentrality: function( options ){
    options = defaults( options );

    let cy = this.cy();
    let callingEles = this;
    let { root, weight, directed, alpha } = options;

    root = cy.collection(root)[0];

    if( !directed ){
      let connEdges = root.connectedEdges().intersection( callingEles );
      let k = connEdges.length;
      let s = 0;

      // Now, sum edge weights
      for( let i = 0; i < connEdges.length; i++ ){
        s += weight( connEdges[i] );
      }

      return {
        degree: Math.pow( k, 1 - alpha ) * Math.pow( s, alpha )
      };
    } else {
      let edges = root.connectedEdges();
      let incoming = edges.filter( edge => edge.target().same(root) && callingEles.has(edge) );
      let outgoing = edges.filter( edge => edge.source().same(root) && callingEles.has(edge) );
      let k_in = incoming.length;
      let k_out = outgoing.length;
      let s_in = 0;
      let s_out = 0;

      // Now, sum incoming edge weights
      for( let i = 0; i < incoming.length; i++ ){
        s_in += weight( incoming[i] );
      }

      // Now, sum outgoing edge weights
      for( let i = 0; i < outgoing.length; i++ ){
        s_out += weight( outgoing[i] );
      }

      return {
        indegree: Math.pow( k_in, 1 - alpha ) * Math.pow( s_in, alpha ),
        outdegree: Math.pow( k_out, 1 - alpha ) * Math.pow( s_out, alpha )
      };
    }
  } // degreeCentrality

}); // elesfn

// nice, short mathemathical alias
elesfn.dc = elesfn.degreeCentrality;
elesfn.dcn = elesfn.degreeCentralityNormalised = elesfn.degreeCentralityNormalized;

export default elesfn;
