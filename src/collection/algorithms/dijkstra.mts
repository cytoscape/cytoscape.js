import * as is from '../../is.mjs';
import Heap from '../../heap.mjs';
import { defaults } from '../../util/index.mjs';
import type { Collection, EdgeSingular, Element, SharedCollection } from '../eles-types.mjs';

/** Edge weighting function. */
export type DijkstraWeightFn = ( edge: EdgeSingular ) => number;

/** Options accepted by `dijkstra`. */
export interface DijkstraOptions {
  root?: SharedCollection | string | null;
  weight?: DijkstraWeightFn;
  directed?: boolean;
}

/** Result of `dijkstra`: distance/path lookups from the root node. */
export interface DijkstraResult {
  distanceTo( node: SharedCollection | string ): number;
  pathTo( node: SharedCollection | string ): Collection;
}

export interface AlgorithmsDijkstra {
  dijkstra(
    this: SharedCollection,
    options?: DijkstraOptions | SharedCollection | string,
    weight?: DijkstraWeightFn,
    directed?: boolean
  ): DijkstraResult;
}

const dijkstraDefaults = defaults({
  root: null as SharedCollection | string | null,
  weight: ( ( _edge: EdgeSingular ) => 1 ) as DijkstraWeightFn,
  directed: false
});

let elesfn = ({

  dijkstra: function(
    this: SharedCollection,
    options?: DijkstraOptions | SharedCollection | string,
    weight?: DijkstraWeightFn,
    directed?: boolean
  ): DijkstraResult {
    let opts: DijkstraOptions;
    if( !is.plainObject(options) ){
      // eslint-disable-next-line prefer-rest-params -- preserve original arguments-based behavior
      let args = arguments;

      opts = { root: args[0], weight: args[1], directed: args[2] };
    } else {
      opts = options as DijkstraOptions;
    }

    let resolved = dijkstraDefaults(opts);
    let root = resolved.root;
    ({ weight, directed } = resolved);

    let eles = this; // eslint-disable-line @typescript-eslint/no-this-alias
    let weightFn = weight as DijkstraWeightFn;
    let source: Element = is.string( root ) ? this.filter( root )[0] : ( root as Collection )[0];
    let dist: Record<string, number> = {};
    let prev: Record<string, { node: Element; edge: Element | undefined }> = {};
    let knownDist: Record<string, number> = {};

    let { nodes, edges } = this.byGroup();
    edges.unmergeBy(( ele: Element ) => ele.isLoop() );

    let getDist = ( node: Element ) => dist[ node.id()! ];

    let setDist = ( node: Element, d: number ) => {
      dist[ node.id()! ] = d;

      Q.updateItem( node );
    };

    let Q = new Heap<Element>( (a, b) => getDist(a) - getDist(b) );

    for( let i = 0; i < nodes.length; i++ ){
      let node = nodes[ i ];

      dist[ node.id()! ] = node.same( source ) ? 0 : Infinity;
      Q.push( node );
    }

    let distBetween = ( u: Element, v: Element ): { edge: Element | undefined; dist: number } => {
      let uvs = ( directed ? u.edgesTo(v) : u.edgesWith(v) ).intersect( edges );
      let smallestDistance = Infinity;
      let smallestEdge: Element | undefined;

      for( let i = 0; i < uvs.length; i++ ){
        let edge = uvs[ i ];
        let weight = weightFn( edge as unknown as EdgeSingular );

        if( weight < smallestDistance || !smallestEdge ){
          smallestDistance = weight;
          smallestEdge = edge;
        }
      }

      return {
        edge: smallestEdge,
        dist: smallestDistance
      };
    };

    while( Q.size() > 0 ){
      let u = Q.pop() as Element;
      let smalletsDist = getDist( u );
      let uid = u.id()!;

      knownDist[ uid ] = smalletsDist;

      if( smalletsDist === Infinity ){
        continue;
      }

      let neighbors = u.neighborhood().intersect( nodes );
      for( let i = 0; i < neighbors.length; i++ ){
        let v = neighbors[ i ];
        let vid = v.id()!;
        let vDist = distBetween( u, v );

        let alt = smalletsDist + vDist.dist;

        if( alt < getDist( v ) ){
          setDist( v, alt );

          prev[ vid ] = {
            node: u,
            edge: vDist.edge
          };
        }
      } // for
    } // while

    return {
      distanceTo: function( node: SharedCollection | string ): number {
        let target: Element = is.string( node ) ? nodes.filter( node )[0] : ( node as Collection )[0];

        return knownDist[ target.id()! ];
      },

      pathTo: function( node: SharedCollection | string ): Collection {
        let target: Element = is.string( node ) ? nodes.filter( node )[0] : ( node as Collection )[0];
        let S: Element[] = [];
        let u = target;
        let uid = u.id()!;

        if( target.length > 0 ){
          S.unshift( target );

          while( prev[ uid ] ){
            let p = prev[ uid ];

            S.unshift( p.edge as Element );
            S.unshift( p.node );

            u = p.node;
            uid = u.id()!;
          }
        }

        return eles.spawn( S );
      }
    };
  }
}) satisfies AlgorithmsDijkstra;

export default elesfn as AlgorithmsDijkstra;
