import * as is from '../../is.mjs';
import * as util from '../../util/index.mjs';
import type { Collection, Element } from '../eles-types.mjs';

/** Edge weighting function. */
export type DegreeCentralityWeightFn = ( edge: Element ) => number;

/** Options accepted by the degree-centrality methods. */
export interface DegreeCentralityOptions {
  root?: Collection | Element | string | null;
  weight?: DegreeCentralityWeightFn;
  directed?: boolean;
  alpha?: number;
}

/** Result of `degreeCentrality` for an undirected graph. */
export interface UndirectedDegreeCentrality {
  degree: number;
}

/** Result of `degreeCentrality` for a directed graph. */
export interface DirectedDegreeCentrality {
  indegree: number;
  outdegree: number;
}

export type DegreeCentralityResult = UndirectedDegreeCentrality | DirectedDegreeCentrality;

/** Result of `degreeCentralityNormalized` for an undirected graph. */
export interface UndirectedDegreeCentralityNormalized {
  degree( node: Collection | Element | string ): number;
}

/** Result of `degreeCentralityNormalized` for a directed graph. */
export interface DirectedDegreeCentralityNormalized {
  indegree( node: Collection | Element | string ): number;
  outdegree( node: Collection | Element | string ): number;
}

export type DegreeCentralityNormalizedResult =
  UndirectedDegreeCentralityNormalized | DirectedDegreeCentralityNormalized;

export interface AlgorithmsDegreeCentrality {
  degreeCentralityNormalized( this: Collection, options?: DegreeCentralityOptions ): DegreeCentralityNormalizedResult;
  degreeCentrality( this: Collection, options?: DegreeCentralityOptions ): DegreeCentralityResult;
  dc( this: Collection, options?: DegreeCentralityOptions ): DegreeCentralityResult;
  dcn( this: Collection, options?: DegreeCentralityOptions ): DegreeCentralityNormalizedResult;
  degreeCentralityNormalised( this: Collection, options?: DegreeCentralityOptions ): DegreeCentralityNormalizedResult;
}

const defaults = util.defaults({
  root: null as Collection | Element | string | null,
  weight: ( ( edge: Element ) => 1 ) as DegreeCentralityWeightFn,
  directed: false,
  alpha: 0
});

let elesfn = ({
  degreeCentralityNormalized: function( this: Collection, options?: DegreeCentralityOptions ): DegreeCentralityNormalizedResult {
    let opts = defaults( options );

    // TODO(eles-types): CoreAccess.filter( selector ) is used here but not declared on CoreAccess
    let cy = this.cy() as unknown as { filter( sel: string ): Collection };
    let nodes = this.nodes();
    let numNodes = nodes.length;

    if( !opts.directed ){
      let degrees: Record<string, number> = {};
      let maxDegree = 0;

      for( let i = 0; i < numNodes; i++ ){
        let node = nodes[ i ];

        // add current node to the current options object and call degreeCentrality
        opts.root = node;

        let currDegree = this.degreeCentrality( opts ) as UndirectedDegreeCentrality;

        if( maxDegree < currDegree.degree ){
          maxDegree = currDegree.degree;
        }

        degrees[ node.id()! ] = currDegree.degree;
      }

      return {
        degree: function( node: Collection | Element | string ): number {
          if( maxDegree === 0 ){ return 0; }

          let n: Collection | Element = is.string( node )
            ? cy.filter( node ) // from is a selector string
            : ( node as Collection | Element );

          return degrees[ n.id()! ] / maxDegree;
        }
      };
    } else {
      let indegrees: Record<string, number> = {};
      let outdegrees: Record<string, number> = {};
      let maxIndegree = 0;
      let maxOutdegree = 0;

      for( let i = 0; i < numNodes; i++ ){
        let node = nodes[ i ];
        let id = node.id();

        // add current node to the current options object and call degreeCentrality
        opts.root = node;

        let currDegree = this.degreeCentrality( opts ) as DirectedDegreeCentrality;

        if( maxIndegree < currDegree.indegree )
          maxIndegree = currDegree.indegree;

        if( maxOutdegree < currDegree.outdegree )
          maxOutdegree = currDegree.outdegree;

        indegrees[ id! ] = currDegree.indegree;
        outdegrees[ id! ] = currDegree.outdegree;
      }

      return {
        indegree: function( node: Collection | Element | string ): number {
          if ( maxIndegree == 0 ){ return 0; }

          let n: Collection | Element = is.string( node )
            ? cy.filter( node ) // from is a selector string
            : ( node as Collection | Element );

          return indegrees[ n.id()! ] / maxIndegree;
        },
        outdegree: function( node: Collection | Element | string ): number {
          if ( maxOutdegree === 0 ){ return 0; }

          let n: Collection | Element = is.string( node )
            ? cy.filter( node ) // from is a selector string
            : ( node as Collection | Element );

          return outdegrees[ n.id()! ] / maxOutdegree;
        }

      };
    }

  }, // degreeCentralityNormalized

  // Implemented from the algorithm in Opsahl's paper
  // "Node centrality in weighted networks: Generalizing degree and shortest paths"
  // check the heading 2 "Degree"
  degreeCentrality: function( this: Collection, options?: DegreeCentralityOptions ): DegreeCentralityResult {
    let opts = defaults( options );

    let cy = this.cy();
    let callingEles = this; // eslint-disable-line @typescript-eslint/no-this-alias
    let { root, weight, directed, alpha } = opts;

    let rootEle: Element = cy.collection(root)[0];

    if( !directed ){
      let connEdges = rootEle.connectedEdges().intersection( callingEles );
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
      let edges = rootEle.connectedEdges();
      let incoming = edges.filter(( edge: Element ) => edge.target().same(rootEle) && callingEles.has(edge) );
      let outgoing = edges.filter(( edge: Element ) => edge.source().same(rootEle) && callingEles.has(edge) );
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

}) as AlgorithmsDegreeCentrality; // elesfn

// nice, short mathematical alias
elesfn.dc = elesfn.degreeCentrality;
elesfn.dcn = elesfn.degreeCentralityNormalised = elesfn.degreeCentralityNormalized;

export default elesfn;
