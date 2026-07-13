import cytoscape from '../../build/dts/index.js';
import type {
  AnimatedLayoutOptions,
  ClusteringAlgorithms,
  CollectionBuildingFiltering,
  CollectionIteration,
  CoreGraphManipulation,
  CoreGraphManipulationExt,
  EdgeSingularData,
  GridLayoutOptions,
  KMeansResult,
  NodeCollectionTraversing,
  NodePositionFunction,
  NodeSingular,
  PresetLayoutOptions,
  SearchAStarOptions,
  SearchAlgorithms,
  SearchDijkstraOptions,
  SingularElementReturnValue,
  SingularStyle,
  SortingFunction,
  WeightFn,
} from '../../build/dts/index.js';

const cy = cytoscape( {
  headless: true,
  elements: [
    { data: { id: 'a', value: 1 } },
    { data: { id: 'b', value: 2 } },
    { data: { id: 'ab', source: 'a', target: 'b' } },
  ],
} );

const nodes = cy.nodes();
const edges = cy.edges();

const iteration: CollectionIteration<NodeSingular, NodeSingular> = nodes;
declare const filtering: CollectionBuildingFiltering<NodeSingular, NodeSingular>;
const nodeTraversal: NodeCollectionTraversing = nodes;
const edgeData: EdgeSingularData = edges.first();
const singularStyle: SingularStyle = nodes.first();
const singularResult: SingularElementReturnValue = nodes.first();
const coreGraph: CoreGraphManipulation = cy;
const coreGraphExt: CoreGraphManipulationExt = cy;

const sort: SortingFunction = ( a, b ) => a.degree()! - b.degree()!;
const grid: GridLayoutOptions = { name: 'grid', sort };
const position: NodePositionFunction = node => node.position();
const preset: PresetLayoutOptions = { name: 'preset', positions: position };
const animated: AnimatedLayoutOptions = {
  animate: true,
  animateFilter: node => node.degree()! > 0,
};

const weight: WeightFn = edge => edge.data( 'weight' ) as number;
const dijkstra: SearchDijkstraOptions = { root: '#a', weight };
const aStar: SearchAStarOptions = { root: '#a', goal: '#b', weight };
cy.elements().dijkstra( dijkstra );
cy.elements().aStar( aStar );

// @ts-expect-error Dijkstra dereferences a root at runtime
const missingDijkstraRoot: SearchDijkstraOptions = {};
// @ts-expect-error A* requires both endpoints at runtime
const missingAStarGoal: SearchAStarOptions = { root: '#a' };

const searchAlgorithms: SearchAlgorithms = cy.elements();
const clusteringAlgorithms: ClusteringAlgorithms = cy.elements();
const clusters: KMeansResult = nodes.kMeans( {
  k: 2,
  attributes: [ node => node.data( 'value' ) as number ],
} );

iteration.forEach( node => node.degree() );
filtering.filter( node => node.degree()! > 0 );
nodeTraversal.connectedEdges();
edgeData.isLoop();
coreGraph.batch( () => {} );
cy.layout( grid );
cy.layout( preset );

void [
  singularResult,
  singularStyle,
  coreGraphExt,
  animated,
  missingDijkstraRoot,
  missingAStarGoal,
  searchAlgorithms,
  clusteringAlgorithms,
  clusters,
];
