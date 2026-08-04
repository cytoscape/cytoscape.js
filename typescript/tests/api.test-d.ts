// Compile-only test that the GENERATED gpu d.ts (build/dts-gpu/index.d.ts,
// emitted from the v4 prototype source) is usable as a public API surface.
// Run via `npm run test:types` (tsc --noEmit against tsconfig.types-test.json).
//
// Round 26.5: `cytoscape/gpu` ships declarations for the first time, so this
// is the proof that a consumer can actually import and use them — the shape
// audit lives in test/types-gpu-surface.mjs.

import cytoscape from '../../build/dts/index.js';
import type {
  CytoscapeOptions, Collection, ColumnarElements, Core, Event,
  ElementsDefinition, ExportOptions, GridLayoutOptions,
  LayoutOptions, Mapper, Stylesheet, Position, RendererStats,
} from '../../build/dts/index.js';

// -- the factory --

const elements: ElementsDefinition = {
  nodes: [
    { data: { id: 'a', weight: 1 }, position: { x: 0, y: 0 } },
    { data: { id: 'b', weight: 5 }, position: { x: 100, y: 0 } },
  ],
  edges: [ { data: { id: 'ab', source: 'a', target: 'b' } } ],
};

// the mapper DSL: a plain serializable object, no strings to parse
const sizeMapper: Mapper = { data: 'weight', scale: 'sqrt', range: [ 10, 60 ] };

const style: Stylesheet = {
  nodes: {
    width: sizeMapper,
    height: sizeMapper,
    'background-color': { data: 'weight', range: [ '#eee', '#333' ] },
    'transition-property': 'background-color',
    'transition-duration': 250,
  },
  edges: { width: 2, 'line-color': '#999' },
  parents: { padding: 12 },
  core: { 'selection-box-color': '#ccf' },
};

const options: CytoscapeOptions = {
  elements,
  style,
  wheelSensitivity: 1,
  boxSelectionIncludesLabels: false,
};

const cy: Core = cytoscape( options );

// -- unknown constructor options are a build-time error (round 37.3) --
//
// v4 throws on an unknown sheet key, an unknown style property and an unknown
// query key, on the stated reasoning that a typo must fail loudly.  The
// constructor deliberately does not: the fifth design sitting decided that
// strictness here resolves at the type layer, since v4 should not replicate at
// runtime what the build already checks.  So this is where that decision is
// enforced, and these directives fail the typecheck if the options type ever
// stops rejecting excess keys.
//
// The four canvas-era options the 2026-07-29 triage dropped are the concrete
// case — `{ motionBlur: true }` constructs happily at runtime and round-trips
// through `cy.options()`:

// @ts-expect-error motionBlur was dropped by the 2026-07-29 triage
cytoscape( { motionBlur: true } );
// @ts-expect-error hideEdgesOnViewport likewise
cytoscape( { elements, hideEdgesOnViewport: true } );
// @ts-expect-error and a plain typo, the case the whole rule is for
cytoscape( { totallyUnknownOption: 1 } );
// @ts-expect-error the same check through the named options type
const badOptions: CytoscapeOptions = { textureOnViewport: true };

void badOptions;

// Note the boundary, which is TypeScript's and not v4's: excess-property
// checking applies to object *literals*.  Options assembled into a variable
// first are widened and pass, which is why the runtime stays permissive rather
// than pretending this is airtight — see the constructor's own doc comment.

// -- statics on the factory --

const columnar: ColumnarElements = cytoscape.toColumnarElements( elements );
const wire: ArrayBuffer = cytoscape.serializeElements( columnar );

cytoscape.deserializeElements( wire );
cy.add( wire );

// -- queries: structured objects and predicates, never selector strings --

const selected: Collection = cy.nodes( { selected: true } );
const heavy: Collection = cy.nodes( { data: { weight: { gt: 2 } } } );
const parents: Collection = cy.nodes( { parent: true } );
const byFn: Collection = cy.filter( ele => ele.isEdge() );
const one: Collection = cy.$id( 'a' );

// -- collection reads --

const id: string | undefined = one.id();
const pos = one.position() as Position;
const w: number | undefined = one.width();
const bb = one.boundingBox( { includeLabels: true } );
const deg: number | undefined = one.degree( false );
const total: number = cy.elements().totalDegree();
const nhood: Collection = one.neighborhood();
const edges: Collection = one.connectedEdges();

// -- traversal and algorithms --

const dijkstra = cy.elements().dijkstra( { root: one, weight: () => 1 } );
const path: Collection = dijkstra.pathTo( cy.$id( 'b' ) );
const components: Collection[] = cy.elements().components();
const clusters: Collection[] = cy.nodes().kMeans( { k: 2, attributes: [ n => n.degree() ?? 0 ] } );

// -- viewport --

cy.zoom( 2 );
cy.pan( { x: 10, y: 10 } );
cy.fit( heavy, 30 );
const extent = cy.extent();

// -- events: predicate delegation, no selector strings --

// Round 41: `event.target` is typed.  It used to be `unknown` on the shared
// v3 event object, so every handler began with a cast; a v4 event's target is
// the core or a one-element collection, and narrowing between them is a real
// type guard rather than an assertion.
const onTap = ( event: Event ) => {
  const target = event.target;

  if( target != null && 'isNode' in target ){
    void target.id();      // narrowed to Collection — no cast
  }

  // the event's own fields are typed too
  const at: number = event.timeStamp;
  const dom: string | undefined = event.originalEvent?.type;

  void [ at, dom ];
};
const isNode = ( ele: Collection ) => ele.isNode();

cy.on( 'tap', isNode, onTap );
cy.off( 'tap', isNode, onTap );
cy.on( 'tap', ele => ele.isEdge(), onTap );   // no annotation needed
one.on( 'position', () => undefined );

// -- animation, with the round-24 controls and round-25 geometry channels --

const ani = one.animation( {
  position: { x: 50, y: 50 },
  style: { width: 80, 'background-color': '#f00' },
  duration: 400,
  easing: 'spring(0.3)',
} );

ani.play();
ani.pause();
ani.resume();
ani.reverse();

const progress: number = ani.progress();
const paused: boolean = ani.paused();
const done: Promise<void> = ani.promise();

// -- layouts: built-in by name, extension by direct object --

const gridOpts: GridLayoutOptions = { name: 'grid', fit: true, padding: 30 };

cy.layout( gridOpts ).run();
cy.layout( { name: 'force', animate: true } as LayoutOptions ).run();

class SpiralLayout {
  run( ctx: { nodeSlots(): number[]; setPositions( slots: number[], xy: number[] ): void } ){
    const slots = ctx.nodeSlots();
    const xy: number[] = [];

    for( let i = 0; i < slots.length; i++ ){
      xy.push( Math.cos( i ) * i, Math.sin( i ) * i );
    }

    ctx.setPositions( slots, xy );
  }
}

cy.layout( { impl: SpiralLayout } ).run();
heavy.layout( { impl: new SpiralLayout() } ).run();

// -- batching, compaction, export --

cy.batch( () => { cy.$id( 'a' ).data( 'weight', 9 ); } );
cy.compact();

const exportOpts: ExportOptions = { full: true, scale: 2, output: 'blob' };
const png: Promise<string | Blob> = cy.png( exportOpts );

const stats: RendererStats | undefined = cy.renderer()?.stats();

void [
  cy, selected, heavy, parents, byFn, id, pos, w, bb, deg, total, nhood, edges,
  path, components, clusters, extent, progress, paused, done, png, stats, style,
];
