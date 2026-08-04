// Compile-only EXACT-type parity tests for the generated public d.ts.
//
// The other *.test-d.ts files assert *assignability* (a value flows into a
// declared type) plus a few `satisfies` / `@ts-expect-error` direction checks.
// Assignability is necessary but not sufficient: an overly-wide declared type
// (e.g. `Collection` where `NodeCollection` is documented) still satisfies an
// assignment, so widening regressions slip through.
//
// This file pins the EXACT type of high-value API entry points using an
// invariant `Equal<>` check, so both widening AND narrowing of a return type,
// overload, or value family is caught. It is intentionally a curated set; new
// cases can be appended to `cases` over time to broaden coverage toward the
// full documented surface (see TYPESCRIPT-MIGRATION.md, "validation coverage").
//
// Run via `npm run test:types` (tsc --noEmit against tsconfig.types-test.json).

import cytoscape from '../../build/dts/index.js';
import type {
  Collection, Core, CytoscapeOptions, EdgeCollection, EdgeSingular, Element,
  EventHandler, EventObject, ExportBlobOptions, ExportBlobPromiseOptions,
  ExportJpgBlobOptions, NodeCollection, NodeSingular, Position, Singular,
} from '../../build/dts/index.js';

// --- invariant type-equality harness -----------------------------------------
// `Equal` is true only when X and Y are mutually assignable AND identical (the
// two-conditional-function trick makes it invariant, unlike `extends`).
// `Expect<T>` compiles only when T is exactly `true`, so `Expect<Equal<A, B>>`
// is a compile error whenever A and B drift apart in either direction.
type Equal<X, Y> =
  ( <T>() => T extends X ? 1 : 2 ) extends ( <T>() => T extends Y ? 1 : 2 ) ? true : false;
type Expect<T extends true> = T;

// =============================================================================
// Return-type precision on traversal / accessor methods (single-overload).
// Indexed-access + ReturnType so the assertion does not depend on `this` or
// on overload-resolution order.
// =============================================================================
type ReturnCases = [
  // core element accessors
  Expect<Equal<ReturnType<Core['nodes']>, NodeCollection>>,
  Expect<Equal<ReturnType<Core['edges']>, EdgeCollection>>,
  Expect<Equal<ReturnType<Core['elements']>, Collection>>,
  Expect<Equal<ReturnType<Core['getElementById']>, Collection>>,

  // collection ownership and kind-aware iteration
  Expect<Equal<ReturnType<NodeCollection['cy']>, Core>>,
  Expect<Equal<NodeSingular['length'], 1>>,
  Expect<Equal<EdgeSingular['length'], 1>>,
  Expect<Equal<ReturnType<NodeCollection['first']>, NodeSingular>>,

  // edge endpoints are nodes
  Expect<Equal<ReturnType<EdgeCollection['source']>, NodeSingular>>,
  Expect<Equal<ReturnType<EdgeCollection['target']>, NodeSingular>>,
  Expect<Equal<ReturnType<EdgeSingular['source']>, NodeSingular>>,

  // node traversal projections
  Expect<Equal<ReturnType<NodeCollection['connectedEdges']>, EdgeCollection>>,
  Expect<Equal<ReturnType<NodeCollection['neighborhood']>, Collection>>,

  // scalar accessors carry the documented `| undefined`
  Expect<Equal<ReturnType<NodeCollection['id']>, string | undefined>>,
  Expect<Equal<ReturnType<NodeCollection['degree']>, number | undefined>>,
];

// =============================================================================
// Event handler parameter narrowing.
// =============================================================================
type EventCases = [
  // the public EventHandler hands callbacks an EventObject (not the internal Event)
  Expect<Equal<Parameters<EventHandler>[0], EventObject>>,
];

// =============================================================================
// Overload-shape precision for the data() and position() accessor families.
// These are multi-overload, so assert the result type of concrete call shapes
// (ReturnType would only see the last overload).
// =============================================================================
const cy: Core = cytoscape( { headless: true, elements: [
  { data: { id: 'a' }, position: { x: 0, y: 0 } },
  { data: { id: 'b' }, position: { x: 1, y: 1 } },
  { data: { id: 'ab', source: 'a', target: 'b' } },
] } );
const inferredCy = cytoscape( { headless: true } );
const inferredNode: NodeSingular = inferredCy.nodes()[0];
inferredCy.nodes().forEach( node => {
  node.degree();
  // @ts-expect-error the factory return must contextually narrow node iteration
  node.source();
} );
const nodes: NodeCollection = cy.nodes();
const edges: EdgeCollection = cy.edges();
const nodeInput: NodeSingular = nodes[0];
const mixedElement: Element = cy.elements()[0];
const mixedSingular: Singular = cy.elements().first();
cy.elements().forEach( ( element: Element ) => void element.id() );

// APIs that accept arbitrary elements or collections also accept narrowed
// node/edge projections; they do not require the internal wide collection.
const fromNodeCollection: Collection = cy.collection( nodes );
const fromNodeArray: Collection = cy.collection( [ nodeInput ] );
cy.add( nodes );
cy.add( nodeInput );
cy.remove( nodes );
cy.fit( nodes );
cy.center( nodeInput );
nodes.edgesWith( nodes );
cy.elements().dijkstra( { root: nodeInput } ).distanceTo( nodeInput );
cy.elements().aStar( { root: nodeInput, goal: nodeInput } );

// Collection construction accepts the documented JSON-definition form.
const detached: Collection = cy.collection( [
  { data: { id: 'detached-a' } },
  { data: { id: 'detached-b' } },
], { removed: true } );

// A collection's owning graph exposes the full public Core API.
const owner: Core = nodes.cy();
owner.add( { data: { id: 'owned' } } );

// data(): getter with no field returns the whole data object (or undefined);
// data(field): a single field is `unknown` (caller narrows).
const dataAll = nodes.data();
const dataField = nodes.data( 'w' );
// position(): getter returns a Position; position(name) a coordinate number.
const posAll = nodes.position();
const posDim = nodes.position( 'x' );

type AccessorCases = [
  Expect<Equal<typeof dataAll, Record<string, unknown> | undefined>>,
  Expect<Equal<typeof dataField, unknown>>,
  Expect<Equal<typeof posAll, Position>>,
  Expect<Equal<typeof posDim, number>>,
];

// data(field, value) / position(partial) are setters that return a chainable
// collection. The common chaining cases compile:
const dataSet = nodes.data( 'w', 1 );
const posSet = nodes.position( { x: 2, y: 3 } );
const removedData = nodes.removeData( 'w' );
const removedScratch = nodes.removeScratch( 'cache' );
const _chainLen: number = dataSet.length;
dataSet.addClass( 'x' );
posSet.addClass( 'y' );
nodes.data( 'w', 1 ).kMeans( { k: 2, attributes: [ n => n.data( 'w' ) as number ] } );
nodes.position( { x: 4 } ).kMeans( { k: 2, attributes: [ n => n.position( 'x' ) ] } );

type SetterCases = [
  Expect<Equal<typeof dataSet, NodeCollection>>,
  Expect<Equal<typeof posSet, NodeCollection>>,
  Expect<Equal<typeof removedData, NodeCollection>>,
  Expect<Equal<typeof removedScratch, NodeCollection>>,
];

// Style getters retain their v3 value shapes, and setters retain the caller's
// precise collection kind for chaining.
const styleValue: string = nodes.style( 'background-color' );
const numericWidth: number = nodes.numericStyle( 'width' );
const renderedValue: string = nodes.first().renderedStyle( 'width' );
const renderedMap: Record<string, unknown> = nodes.first().renderedCss();
const styledNodes = nodes.style( 'background-color', 'red' );
styledNodes.kMeans( { k: 2, attributes: [ n => n.data( 'w' ) as number ] } );

type StyleCases = [
  Expect<Equal<typeof styledNodes, NodeCollection>>,
];

// Node/edge collections expose kind-aware singulars through indexing,
// iteration, and subset accessors.
const indexedNode: NodeSingular = nodes[0];
const firstNode: NodeSingular = nodes.first();
const indexedEdge: EdgeSingular = edges[0];
const firstEdge: EdgeSingular = edges.first();
// @ts-expect-error indexed nodes must not expose edge-only methods
nodes[0].source();
// @ts-expect-error indexed edges must not expose node-only methods
edges[0].degree();
nodes.forEach( ( node, _i, nodeCollection ) => {
  node.degree();
  nodeCollection.connectedEdges();
  // @ts-expect-error node iteration must not expose edge-only methods
  node.source();
} );
edges.forEach( edge => {
  edge.source().degree();
  // @ts-expect-error edge iteration must not expose node-only methods
  edge.degree();
} );
for( const node of nodes ){
  node.position();
  // @ts-expect-error node iteration must not expose edge-only methods
  node.source();
}
// @ts-expect-error a multi-element collection is not a singular element
const _collectionAsSingular: NodeSingular = nodes;

// Image export output discriminators select the corresponding result type.
const pngString: string = cy.png();
const pngBlob: Blob = cy.png( { output: 'blob' } );
const pngBlobPromise: Promise<Blob> = cy.png( { output: 'blob-promise' } );
const jpgString: string = cy.jpg( { quality: 0.8 } );
const jpgBlob: Blob = cy.jpeg( { output: 'blob', quality: 0.8 } );
const typedPngBlobOptions: ExportBlobOptions = { output: 'blob' };
const typedPngPromiseOptions: ExportBlobPromiseOptions = { output: 'blob-promise' };
const typedJpgBlobOptions: ExportJpgBlobOptions = { output: 'blob', quality: 0.8 };
const typedPngBlob: Blob = cy.png( typedPngBlobOptions );
const typedPngPromise: Promise<Blob> = cy.png( typedPngPromiseOptions );
const typedJpgBlob: Blob = cy.jpg( typedJpgBlobOptions );

// Layout options are required because the runtime rejects missing names.
// @ts-expect-error core layout options are required
cy.layout();
// @ts-expect-error collection layout options require a name
nodes.layout( {} );

// Ready callbacks receive the normal public event object.
const readyOptions: CytoscapeOptions = {
  ready: ( event: EventObject ) => void event.cy,
};
cy.ready( ( event: EventObject ) => void event.target );

// Custom emitted parameters may be annotated by application handlers.
cy.on( 'custom', ( event: EventObject, value: number, label: string ) => {
  void [ event, value, label ];
} );

// =============================================================================
// Algorithm result-shape precision.
// =============================================================================
cy.elements().aStar( {
  root: '#a',
  goal: '#b',
  weight: edge => {
    edge.source();
    // @ts-expect-error weight callbacks receive edges, not nodes
    edge.degree();
    return 1;
  },
  heuristic: node => {
    node.degree();
    // @ts-expect-error heuristic callbacks receive nodes, not edges
    node.source();
    return 0;
  },
} );
const dijkstra = cy.elements().dijkstra( { root: '#a', directed: true } );
const dijkstraDist = dijkstra.distanceTo( cy.getElementById( 'b' ) );
const dijkstraPath = dijkstra.pathTo( cy.getElementById( 'b' ) );

type AlgorithmCases = [
  Expect<Equal<typeof dijkstraDist, number>>,
  Expect<Equal<typeof dijkstraPath, Collection>>,
];

// =============================================================================
// Kind-agnostic methods must be CALLABLE on the narrowed node/edge projections,
// not merely present. These previously failed to type-check because the methods
// were typed `this: Collection` and the `Omit<>`-based Node/Edge projections are
// not assignable to the wide `Collection`. The docmaker callability audit covers
// this exhaustively; these are representative compile-path regression guards.
// =============================================================================
nodes.style( 'background-color' );
nodes.css( { 'background-color': 'red' } );
nodes.numericStyle( 'width' );
nodes.width();
nodes.height();
nodes.effectiveOpacity();
nodes.dijkstra( { root: '#a' } );
nodes.pageRank( {} );
edges.style( 'line-color' );
edges.width();
edges.controlPoints();
edges.segmentPoints();
edges.dijkstra( { root: '#a' } );
const srcNode: NodeSingular = edges.source();
srcNode.style( 'background-color' );
srcNode.width();
void srcNode;

// =============================================================================
// Self-test: the Equal harness must REJECT mismatches. If `Equal` were ever
// weakened to be always-true, this `@ts-expect-error` would become unused and
// tsc would flag it — keeping the harness itself honest.
// =============================================================================
// @ts-expect-error NodeCollection and EdgeCollection are distinct types
type _Sanity = Expect<Equal<NodeCollection, EdgeCollection>>;

// Reference everything so `noUnusedLocals` is satisfied (the type-level checks
// above already fired at declaration; these keep the value/type names "used").
export type _Cases = [ ReturnCases, EventCases, AccessorCases, SetterCases, StyleCases, AlgorithmCases, _Sanity ];
void [ cy, inferredCy, inferredNode, nodes, edges, nodeInput, mixedElement, mixedSingular,
  fromNodeCollection, fromNodeArray,
  dataAll, dataField, posAll, posDim, dataSet, posSet,
  removedData, removedScratch, _chainLen,
  detached, owner, styleValue, numericWidth, renderedValue, renderedMap, styledNodes,
  indexedNode, firstNode, indexedEdge, firstEdge, _collectionAsSingular,
  pngString, pngBlob, pngBlobPromise, jpgString, jpgBlob, readyOptions,
  typedPngBlobOptions, typedPngPromiseOptions, typedJpgBlobOptions, typedPngBlob, typedPngPromise, typedJpgBlob,
  dijkstraDist, dijkstraPath ];
