import Heap from '../../heap.mjs';
import Set from '../../set.mjs';
import { defaults } from '../../util/index.mjs';
import type { Collection, Element } from '../eles-types.mjs';

/** Edge/node weighting or heuristic function. */
export type AStarWeightFn = ( ele: Element ) => number;

/** Options accepted by `aStar`. */
export interface AStarOptions {
  root?: Collection | Element | string | null;
  goal?: Collection | Element | string | null;
  weight?: AStarWeightFn;
  heuristic?: AStarWeightFn;
  directed?: boolean;
}

/** Result of an A* search. */
export interface AStarResult {
  found: boolean;
  distance: number | undefined;
  path: Collection | undefined;
  steps: number;
}

export interface AlgorithmsAStar {
  aStar( this: Collection, options?: AStarOptions ): AStarResult;
}

const aStarDefaults = defaults({
  root: null as Collection | Element | string | null,
  goal: null as Collection | Element | string | null,
  weight: ( ( _edge: Element ) => 1 ) as AStarWeightFn,
  heuristic: ( ( _edge: Element ) => 0 ) as AStarWeightFn,
  directed: false
});

let elesfn = ({

  // Implemented from pseudocode from wikipedia
  aStar: function( this: Collection, options?: AStarOptions ): AStarResult {
    let cy = this.cy();
    let { root, goal, heuristic, directed, weight } = aStarDefaults(options);

    let rootEle: Element = cy.collection(root)[0];
    let goalEle: Element = cy.collection(goal)[0];

    let sid = rootEle.id()!;
    let tid = goalEle.id()!;

    let gScore: Record<string, number> = {};
    let fScore: Record<string, number> = {};
    let closedSetIds: Record<string, boolean> = {};
    let openSet = new Heap<Element>( (a, b) => fScore[a.id()!] - fScore[b.id()!] );
    let openSetIds = new Set<string>();
    let cameFrom: Record<string, Element> = {};
    let cameFromEdge: Record<string, Element> = {};

    let addToOpenSet = ( ele: Element, id: string ) => {
      openSet.push(ele);
      openSetIds.add(id);
    };

    let cMin: Element = undefined as unknown as Element;
    let cMinId: string = undefined as unknown as string;

    let popFromOpenSet = () => {
      cMin = openSet.pop() as Element;
      cMinId = cMin.id()!;
      openSetIds.delete(cMinId);
    };

    let isInOpenSet = ( id: string ) => openSetIds.has(id);

    addToOpenSet(rootEle, sid);

    gScore[ sid ] = 0;
    fScore[ sid ] = heuristic( rootEle );

    // Counter
    let steps = 0;

    // Main loop
    while( openSet.size() > 0 ){
      popFromOpenSet();
      steps++;

      // If we've found our goal, then we are done
      if( cMinId === tid ){
        let path: Element[] = [];
        let pathNode: Element | null = goalEle;
        let pathNodeId = tid;
        let pathEdge = cameFromEdge[pathNodeId];

        for( ;; ){
          path.unshift(pathNode as Element);

          if( pathEdge != null ){
            path.unshift(pathEdge);
          }

          pathNode = cameFrom[pathNodeId];

          if( pathNode == null ){ break; }

          pathNodeId = pathNode.id()!;
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
        if( !this.hasElementWithId( e.id()! ) ){ continue; }

        // cMin must be the source of edge if directed
        if( directed && e.data('source') !== cMinId ){ continue; }

        let wSrc: Element = e.source()[0];
        let wTgt: Element = e.target()[0];

        let w = wSrc.id() !== cMinId ? wSrc : wTgt;
        let wid = w.id()!;

        // node must be in set of calling eles
        if( !this.hasElementWithId( wid ) ){ continue; }

        // if node is in closedSet, ignore it
        if( closedSetIds[ wid ] ){
          continue;
        }

        // New tentative score for node w
        let tempScore = gScore[ cMinId ] + weight( e );

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
          cameFromEdge[ wid ] = e;
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

}) satisfies AlgorithmsAStar; // elesfn


export default elesfn as AlgorithmsAStar;
