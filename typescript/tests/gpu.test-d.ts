// Compile-only test that the GENERATED gpu d.ts (build/dts-gpu/index.d.ts,
// emitted from the v4 prototype source) is usable as a public API surface.
// Run via `npm run test:types` (tsc --noEmit against tsconfig.types-test.json).
//
// Round 26.5: `cytoscape/gpu` ships declarations for the first time, so this
// is the proof that a consumer can actually import and use them — the shape
// audit lives in test/types-gpu-surface.mjs.

import cytoscapeGpu from '../../build/dts-gpu/index.js';
import type {
  CytoscapeGpuOptions, GpuCollection, GpuColumnarElements, GpuCore,
  GpuElementsDefinition, GpuExportOptions, GpuGridLayoutOptions,
  GpuLayoutOptions, GpuMapper, GpuStylesheet, Position, RendererStats,
} from '../../build/dts-gpu/index.js';

// -- the factory --

const elements: GpuElementsDefinition = {
  nodes: [
    { data: { id: 'a', weight: 1 }, position: { x: 0, y: 0 } },
    { data: { id: 'b', weight: 5 }, position: { x: 100, y: 0 } },
  ],
  edges: [ { data: { id: 'ab', source: 'a', target: 'b' } } ],
};

// the mapper DSL: a plain serializable object, no strings to parse
const sizeMapper: GpuMapper = { data: 'weight', scale: 'sqrt', range: [ 10, 60 ] };

const style: GpuStylesheet = {
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

const options: CytoscapeGpuOptions = {
  elements,
  style,
  wheelSensitivity: 1,
  boxSelectionIncludesLabels: false,
};

const cy: GpuCore = cytoscapeGpu( options );

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
cytoscapeGpu( { motionBlur: true } );
// @ts-expect-error hideEdgesOnViewport likewise
cytoscapeGpu( { elements, hideEdgesOnViewport: true } );
// @ts-expect-error and a plain typo, the case the whole rule is for
cytoscapeGpu( { totallyUnknownOption: 1 } );
// @ts-expect-error the same check through the named options type
const badOptions: CytoscapeGpuOptions = { textureOnViewport: true };

void badOptions;

// Note the boundary, which is TypeScript's and not v4's: excess-property
// checking applies to object *literals*.  Options assembled into a variable
// first are widened and pass, which is why the runtime stays permissive rather
// than pretending this is airtight — see the constructor's own doc comment.

// -- statics on the factory --

const columnar: GpuColumnarElements = cytoscapeGpu.toColumnarElements( elements );
const wire: ArrayBuffer = cytoscapeGpu.serializeElements( columnar );

cytoscapeGpu.deserializeElements( wire );
cy.add( wire );

// -- queries: structured objects and predicates, never selector strings --

const selected: GpuCollection = cy.nodes( { selected: true } );
const heavy: GpuCollection = cy.nodes( { data: { weight: { gt: 2 } } } );
const parents: GpuCollection = cy.nodes( { parent: true } );
const byFn: GpuCollection = cy.filter( ele => ele.isEdge() );
const one: GpuCollection = cy.$id( 'a' );

// -- collection reads --

const id: string | undefined = one.id();
const pos = one.position() as Position;
const w: number | undefined = one.width();
const bb = one.boundingBox( { includeLabels: true } );
const deg: number | undefined = one.degree( false );
const total: number = cy.elements().totalDegree();
const nhood: GpuCollection = one.neighborhood();
const edges: GpuCollection = one.connectedEdges();

// -- traversal and algorithms --

const dijkstra = cy.elements().dijkstra( { root: one, weight: () => 1 } );
const path: GpuCollection = dijkstra.pathTo( cy.$id( 'b' ) );
const components: GpuCollection[] = cy.elements().components();
const clusters: GpuCollection[] = cy.nodes().kMeans( { k: 2, attributes: [ n => n.degree() ?? 0 ] } );

// -- viewport --

cy.zoom( 2 );
cy.pan( { x: 10, y: 10 } );
cy.fit( heavy, 30 );
const extent = cy.extent();

// -- events: predicate delegation, no selector strings --

// `event.target` is `unknown` on the shared event type, so a consumer
// narrows it — the predicate's parameter, by contrast, is contextually
// typed by the delegation overload (round 26.5).
const onTap = ( event: { target?: unknown } ) => void ( event.target as GpuCollection ).id();
const isNode = ( ele: GpuCollection ) => ele.isNode();

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

const gridOpts: GpuGridLayoutOptions = { name: 'grid', fit: true, padding: 30 };

cy.layout( gridOpts ).run();
cy.layout( { name: 'force', animate: true } as GpuLayoutOptions ).run();

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

const exportOpts: GpuExportOptions = { full: true, scale: 2, output: 'blob' };
const png: Promise<string | Blob> = cy.png( exportOpts );

const stats: RendererStats | undefined = cy.renderer()?.stats();

void [
  cy, selected, heavy, parents, byFn, id, pos, w, bb, deg, total, nhood, edges,
  path, components, clusters, extent, progress, paused, done, png, stats, style,
];
