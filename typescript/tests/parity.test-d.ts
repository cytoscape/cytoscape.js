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
  Collection, Core, EdgeCollection, EdgeSingular,
  EventHandler, EventObject, NodeCollection, NodeSingular, Position,
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
const nodes: NodeCollection = cy.nodes();
const edges: EdgeCollection = cy.edges();

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
const _chainLen: number = dataSet.length;
dataSet.addClass( 'x' );
posSet.addClass( 'y' );

// KNOWN PARITY GAP: these setters return the kind-agnostic base collection
// (`SharedCollection`, not exported), which omits the clustering/algorithm
// methods carried by `Collection`. So algorithm chaining that compiled against
// the hand-written index.d.ts no longer does. Locking the boundary here: if a
// future change widens the setter return to the full `Collection` (closing the
// gap), this `@ts-expect-error` goes unused and tsc flags it — prompting an
// update of this test.
// @ts-expect-error data(field, value) return omits clustering methods (see above)
nodes.data( 'w', 1 ).kMeans;

// =============================================================================
// Algorithm result-shape precision.
// =============================================================================
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
export type _Cases = [ ReturnCases, EventCases, AccessorCases, AlgorithmCases, _Sanity ];
void [ cy, nodes, edges, dataAll, dataField, posAll, posDim, dataSet, posSet, _chainLen,
  dijkstraDist, dijkstraPath ];
