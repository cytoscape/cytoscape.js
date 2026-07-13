import type { Collection, EdgeSingular, Element, SharedCollection } from '../eles-types.mjs';

/** Edge weighting function. */
export type KruskalWeightFn = ( edge: EdgeSingular ) => number;

export interface AlgorithmsKruskal {
  kruskal( this: SharedCollection, weightFn?: KruskalWeightFn ): Collection;
}

let elesfn = ({

  // kruskal's algorithm (finds min spanning tree, assuming undirected graph)
  // implemented from pseudocode from wikipedia
  kruskal: function( this: SharedCollection, weightFn?: KruskalWeightFn ): Collection {
    let weight: KruskalWeightFn = weightFn || ( ( _edge: EdgeSingular ) => 1 );

    let { nodes, edges } = this.byGroup();
    let numNodes = nodes.length;
    let forest: Collection[] = new Array(numNodes);
    // byGroup() creates a fresh collection safe to mutate; A accumulates the
    // spanning tree (nodes + merged edges), so it is the mixed/wide Collection
    let A: Collection = nodes as unknown as Collection;

    let findSetIndex = ( ele: Element ): number | undefined => {
      for( let i = 0; i < forest.length; i++ ){
        let eles = forest[i];

        if( eles.has(ele) ){ return i; }
      }
    };

    // start with one forest per node
    for( let i = 0; i < numNodes; i++ ){
      forest[i] = this.spawn( nodes[i] );
    }

    let S = edges.sort( (a: Element, b: Element) => weight(a as unknown as EdgeSingular) - weight(b as unknown as EdgeSingular) );

    for( let i = 0; i < S.length; i++ ){
      let edge = S[i];
      let u = edge.source()[0];
      let v = edge.target()[0];
      let setUIndex = findSetIndex(u) as number;
      let setVIndex = findSetIndex(v) as number;
      let setU = forest[ setUIndex ];
      let setV = forest[ setVIndex ];

      if( setUIndex !== setVIndex ){
        A.merge( edge );

        // combine forests for u and v
        setU.merge( setV );
        forest.splice( setVIndex, 1 );
      }
    }

    return A;
  }
}) satisfies AlgorithmsKruskal;

export default elesfn as AlgorithmsKruskal;
