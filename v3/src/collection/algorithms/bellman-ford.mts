import * as is from '../../is.mjs';
import { warn, defaults } from '../../util/index.mjs';
import Map from '../../map.mjs';
import type { Collection, EdgeSingular, Element, SharedCollection } from '../eles-types.mjs';

/** Edge weighting function. */
export type BellmanFordWeightFn = ( edge: EdgeSingular ) => number;

/** Options accepted by `bellmanFord`. */
export interface BellmanFordOptions {
  weight?: BellmanFordWeightFn;
  directed?: boolean;
  root?: SharedCollection | string | null;
  findNegativeWeightCycles?: boolean;
}

/** Per-node bookkeeping accumulated by the algorithm. */
interface BellmanFordInfo {
  dist?: number;
  pred?: Element | null;
  edge?: Element | null;
}

/** Result of `bellmanFord`. */
export interface BellmanFordResult {
  distanceTo( to: SharedCollection | string ): number | undefined;
  pathTo( to: SharedCollection | string, thisStart?: SharedCollection ): Collection;
  hasNegativeWeightCycle: boolean;
  negativeWeightCycles: Collection[];
}

export interface AlgorithmsBellmanFord {
  bellmanFord( this: SharedCollection, options?: BellmanFordOptions ): BellmanFordResult;
}

const bellmanFordDefaults = defaults({
  weight: ( () => 1 ) as BellmanFordWeightFn,
  directed: false,
  root: null as SharedCollection | string | null
});

let elesfn = ({

  // Implemented from pseudocode from wikipedia
  bellmanFord: function( this: SharedCollection, options?: BellmanFordOptions ): BellmanFordResult {
    let { weight, directed, root } = bellmanFordDefaults(options);
    let weightFn = weight;
    let eles = this; // eslint-disable-line @typescript-eslint/no-this-alias
    let cy = this.cy();
    let { edges, nodes } = this.byGroup();
    let numNodes = nodes.length;
    let infoMap = new Map<string, BellmanFordInfo>();
    let hasNegativeWeightCycle = false;
    let negativeWeightCycles: Collection[] = [];

    let rootEle: Element = cy.collection(root)[0]; // in case selector passed

    edges.unmergeBy(( edge: Element ) => edge.isLoop() );

    let numEdges = edges.length;

    let getInfo = ( node: Element ): BellmanFordInfo => {
      let obj = infoMap.get( node.id()! );

      if( !obj ){
        obj = {};

        infoMap.set( node.id()!, obj );
      }

      return obj;
    };

    let getNodeFromTo = ( to: SharedCollection | string ): Element => (is.string(to) ? cy.$( to ) : to)[0] as Element;

    let distanceTo = ( to: SharedCollection | string ) => getInfo( getNodeFromTo(to) ).dist;

    let pathTo = ( to: SharedCollection | string, thisStart: SharedCollection = rootEle ): Collection => {
      let end = getNodeFromTo(to);
      let path: Element[] = [];
      let node: Element | null | undefined = end;

      for( ;; ){
        if( node == null ){ return this.spawn(); }

        let { edge, pred } = getInfo( node );

        path.unshift( node[0] );

        if( node.same(thisStart) && path.length > 0 ){ break; }

        if( edge != null ){
          path.unshift( edge );
        }

        node = pred;
      }

      return eles.spawn( path );
    };

    // Initializations { dist, pred, edge }
    for( let i = 0; i < numNodes; i++ ){
      let node = nodes[i];
      let info = getInfo( node );

      if( node.same(rootEle) ){
        info.dist = 0;
      } else {
        info.dist = Infinity;
      }

      info.pred = null;
      info.edge = null;
    }

    // Edges relaxation
    let replacedEdge = false;

    let checkForEdgeReplacement = (
      node1: Element, node2: Element, edge: Element, info1: BellmanFordInfo, info2: BellmanFordInfo, weight: number
    ) => {
      let dist = ( info1.dist as number ) + weight;

      if( dist < ( info2.dist as number ) && !edge.same(info1.edge as Collection) ){
        info2.dist = dist;
        info2.pred = node1;
        info2.edge = edge;
        replacedEdge = true;
      }
    };

    for( let i = 1; i < numNodes; i++ ){
      replacedEdge = false;

      for( let e = 0; e < numEdges; e++ ){
        let edge = edges[e];
        let src = edge.source()[0] as Element;
        let tgt = edge.target()[0] as Element;
        let weight = weightFn(edge);
        let srcInfo = getInfo(src);
        let tgtInfo = getInfo(tgt);

        checkForEdgeReplacement(src, tgt, edge, srcInfo, tgtInfo, weight);

        // If undirected graph, we need to take into account the 'reverse' edge
        if( !directed ){
          checkForEdgeReplacement(tgt, src, edge, tgtInfo, srcInfo, weight);
        }
      }

      if( !replacedEdge ){ break; }
    }

    if( replacedEdge ){
      // Check for negative weight cycles
      const negativeWeightCycleIds: string[] = [];
      for( let e = 0; e < numEdges; e++ ){
        let edge = edges[e];
        let src = edge.source()[0] as Element;
        let tgt = edge.target()[0] as Element;
        let weight = weightFn(edge);
        let srcDist = getInfo(src).dist as number;
        let tgtDist = getInfo(tgt).dist as number;

        if( srcDist + weight < tgtDist || (!directed && tgtDist + weight < srcDist) ){
          if( !hasNegativeWeightCycle ){
            warn('Graph contains a negative weight cycle for Bellman-Ford');

            hasNegativeWeightCycle = true;
          }

          if( ( options as BellmanFordOptions ).findNegativeWeightCycles !== false ){
            const negativeNodes: Element[] = [];

            if( srcDist + weight < tgtDist ){
              negativeNodes.push(src);
            }

            if( !directed && tgtDist + weight < srcDist ) {
              negativeNodes.push(tgt);
            }

            const numNegativeNodes = negativeNodes.length;
            for( let n = 0; n < numNegativeNodes; n++ ){
              const start = negativeNodes[n];
              let cycle: Element[] = [start];

              cycle.push(getInfo(start).edge as Element);

              let node = getInfo(start).pred as Element;
              while( cycle.indexOf(node) === -1 ){
                cycle.push(node);
                cycle.push(getInfo(node).edge as Element);
                node = getInfo(node).pred as Element;
              }
              cycle = cycle.slice(cycle.indexOf(node));

              let smallestId = cycle[0].id()!;
              let smallestIndex = 0;
              for( let c = 2; c < cycle.length; c+=2 ){
                if( cycle[c].id()! < smallestId ){
                  smallestId = cycle[c].id()!;
                  smallestIndex = c;
                }
              }
              cycle = cycle.slice(smallestIndex)
                .concat(cycle.slice(0, smallestIndex));
              cycle.push(cycle[0]);

              const cycleId = cycle.map(( el: Element ) => el.id()).join(",");
              if( negativeWeightCycleIds.indexOf(cycleId) === -1 ){
                negativeWeightCycles.push(eles.spawn(cycle));
                negativeWeightCycleIds.push(cycleId);
              }
            }
          } else {
            break;
          }
        }
      }
    }

    return {
      distanceTo,
      pathTo,
      hasNegativeWeightCycle,
      negativeWeightCycles
    };

  } // bellmanFord

}) satisfies AlgorithmsBellmanFord; // elesfn

export default elesfn as AlgorithmsBellmanFord;
