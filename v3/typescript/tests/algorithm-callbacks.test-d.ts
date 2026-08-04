import cytoscape from '../../build/dts/index.js';
import type { EdgeSingular, NodeSingular } from '../../build/dts/index.js';

const cy = cytoscape( {
  headless: true,
  elements: [
    { data: { id: 'a', value: 1 } },
    { data: { id: 'b', value: 2 } },
    { data: { id: 'ab', source: 'a', target: 'b', weight: 3 } },
  ],
} );

cy.elements().dijkstra( {
  root: '#a',
  weight: edge => {
    const preciseEdge: EdgeSingular = edge;
    edge.source();
    // @ts-expect-error edge weight callbacks do not receive nodes
    edge.degree();
    return preciseEdge.data( 'weight' ) as number;
  },
} );

cy.elements().pageRank( {
  weight: edge => edge.data( 'weight' ) as number,
} );

cy.elements().kruskal( edge => edge.data( 'weight' ) as number );

cy.nodes().kMeans( {
  k: 2,
  attributes: [ node => {
    const preciseNode: NodeSingular = node;
    node.degree();
    // @ts-expect-error node attribute callbacks do not receive edges
    node.source();
    return preciseNode.data( 'value' ) as number;
  } ],
} );

cy.elements().markovClustering( {
  attributes: [ edge => edge.data( 'weight' ) as number ],
} );

cy.elements().bfs( {
  roots: '#a',
  visit: ( node, edge, parent ) => {
    const preciseNode: NodeSingular = node;
    const preciseEdge: EdgeSingular | undefined = edge;
    const preciseParent: NodeSingular | undefined = parent;
    void [ preciseNode, preciseEdge, preciseParent ];
  },
} );
