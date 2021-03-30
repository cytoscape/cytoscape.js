import * as is from '../../is';
import * as util from '../../util';

const defaults = util.defaults({
  harmonic: true,
  weight: () => 1,
  directed: false,
  root: null
});

const elesfn = ({

  /**
 * @callback closenessCentralityNormalized_options
 * @property {closenessCentralityNormalized_options_type} options - closenessCentralityNormalized_options_type
 */

/**
 * options
 * @typedef {object} closenessCentralityNormalized_options_type
 * @property {object} weight:function(edge) - [optional] A function that returns the positive weight for the edge. The weight indicates the importance of the edge, with a high value representing high importance.
 * @property {object} directed - [optional] A boolean indicating whether the directed indegree and outdegree centrality is calculated (`true`) or whether the undirected centrality is calculated (`false`, default).
 * @property {object} harmonic - [optional] A boolean indicating whether the algorithm calculates the harmonic mean (`true`, default) or the arithmetic mean (`false`) of distances.  The harmonic mean is very useful for graphs that are not strongly connected.
 */

/**
 * @typedef {object} eles_closenessCentralityNormalized
 * @property {function(closenessCentralityNormalized_options):any} closenessCentralityNormalized_options - The options for closenessCentralityNormalizeding.
 */

  /**
 * Considering only the elements in the calling collection, calculate the [degree centrality](https://en.wikipedia.org/wiki/Centrality#Degree_centrality) of the specified root nodes.
 * @memberof eles
 * @pureAliases eles.ccn|eles.closenessCentralityNormalised
 * @path Collection/Centrality
 * @param {...eles_closenessCentralityNormalized} options - NULL
 * @methodName eles.closenessCentralityNormalized
 */
  closenessCentralityNormalized: function( options ){
    let { harmonic, weight, directed } = defaults(options);

    let cy = this.cy();
    let closenesses = {};
    let maxCloseness = 0;
    let nodes = this.nodes();
    let fw = this.floydWarshall({ weight, directed });

    // Compute closeness for every node and find the maximum closeness
    for( let i = 0; i < nodes.length; i++ ){
      let currCloseness = 0;
      let node_i = nodes[i];

      for( let j = 0; j < nodes.length; j++ ){
        if( i !== j ){
          let d = fw.distance( node_i, nodes[j] );

          if( harmonic ){
            currCloseness += 1 / d;
          } else {
            currCloseness += d;
          }
        }
      }

      if( !harmonic ){
        currCloseness = 1 / currCloseness;
      }

      if( maxCloseness < currCloseness ){
        maxCloseness = currCloseness;
      }

      closenesses[ node_i.id() ] = currCloseness;
    }

    return {
      closeness: function( node ){
        if( maxCloseness == 0 ){ return 0; }

        if( is.string( node ) ){
          // from is a selector string
          node = (cy.filter( node )[0]).id();
        } else {
          // from is a node
          node = node.id();
        }

        return closenesses[ node ] / maxCloseness;
      }
    };
  },

  // Implemented from pseudocode from wikipedia

      /**
 * @callback closenessCentrality_options
 * @property {closenessCentrality_options_type} options - closenessCentrality_options_type
 */

/**
 * options
 * @typedef {object} closenessCentrality_options_type
 * @property {object} root - The root node (selector or collection) for which the centrality calculation is made.
 * @property {object} weight:function(edge) - [optional] A function that returns the positive weight for the edge. The weight indicates the importance of the edge, with a high value representing high importance.
 * @property {object} directed - [optional] A boolean indicating whether the directed indegree and outdegree centrality is calculated (`true`) or whether the undirected centrality is calculated (`false`, default).
 * @property {object} harmonic - [optional] A boolean indicating whether the algorithm calculates the harmonic mean (`true`, default) or the arithmetic mean (`false`) of distances.  The harmonic mean is very useful for graphs that are not strongly connected.
 */

/**
 * @typedef {object} eles_closenessCentrality
 * @property {function(closenessCentrality_options):any} closenessCentrality_options - The options for closenessCentralitying.
 */

  /**
 * Considering only the elements in the calling collection, calculate the [degree centrality](https://en.wikipedia.org/wiki/Centrality#Degree_centrality) of the specified root nodes.
 * @memberof eles
 * @pureAliases eles.cc
 * @path Collection/Centrality
 * @param {...eles_closenessCentrality} options - NULL
 * @methodName eles.closenessCentrality
 */
  closenessCentrality: function( options ){
    let { root, weight, directed, harmonic } = defaults(options);

    root = this.filter(root)[0];

    // we need distance from this node to every other node
    let dijkstra = this.dijkstra({ root, weight, directed });
    let totalDistance = 0;
    let nodes = this.nodes();

    for( let i = 0; i < nodes.length; i++ ){
      let n = nodes[i];

      if( !n.same(root) ){
        let d = dijkstra.distanceTo(n);

        if( harmonic ){
          totalDistance += 1 / d;
        } else {
          totalDistance += d;
        }
      }
    }

    return harmonic ? totalDistance : 1 / totalDistance;
  } // closenessCentrality

}); // elesfn

// nice, short mathemathical alias
elesfn.cc = elesfn.closenessCentrality;
elesfn.ccn = elesfn.closenessCentralityNormalised = elesfn.closenessCentralityNormalized;

export default elesfn;
