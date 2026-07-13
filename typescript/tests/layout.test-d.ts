// Compile-only test for the layout API surface.
// Verifies that cy.layout() / eles.layout() return a usable LayoutInstance with
// the documented lifecycle methods.
//
// Per-layout option types are exported from the generated declarations. These
// checks cover both named aliases and contextual callback types on direct calls.

import cytoscape from '../../build/dts/index.js';
import type {
  Core, CoseLayoutOptions, EdgeSingular, GridLayoutOptions,
  LayoutInstance, NodeSingular,
} from '../../build/dts/index.js';

const cy: Core = cytoscape({ headless: true });

// cy.layout() and its aliases return LayoutInstance
const grid: LayoutInstance = cy.layout({ name: 'grid' });
const bfs: LayoutInstance = cy.layout({ name: 'breadthfirst', roots: '#a' });
const circle: LayoutInstance = cy.layout({ name: 'circle' });
const concentric: LayoutInstance = cy.layout({ name: 'concentric' });
const random: LayoutInstance = cy.layout({ name: 'random' });
const preset: LayoutInstance = cy.layout({ name: 'preset' });
const cose: LayoutInstance = cy.layout({ name: 'cose' });
const makeL: LayoutInstance = cy.makeLayout({ name: 'grid' });
const createL: LayoutInstance = cy.createLayout({ name: 'grid' });

// Built-in option aliases retain named fields despite their runtime index
// signature, including contextual node/edge callback types.
const typedGrid: GridLayoutOptions = {
  name: 'grid',
  position: node => {
    const inferredNode: NodeSingular = node;
    return { row: inferredNode.degree(), col: 0 };
  },
};
const typedCose: CoseLayoutOptions = {
  name: 'cose',
  nodeRepulsion: node => {
    const inferredNode: NodeSingular = node;
    return inferredNode.degree() || 2048;
  },
  idealEdgeLength: edge => {
    const inferredEdge: EdgeSingular = edge;
    return inferredEdge.source().degree() || 32;
  },
  edgeElasticity: edge => {
    const inferredEdge: EdgeSingular = edge;
    return inferredEdge.target().degree() || 32;
  },
};
cy.layout( typedGrid );
cy.layout( typedCose );

// Inline options receive the same callback context without a pre-annotation.
cy.layout( {
  name: 'grid',
  position: node => ( { row: node.degree(), col: 0 } ),
} );
cy.nodes().layout( {
  name: 'grid',
  sort: ( a, b ) => a.degree()! - b.degree()!,
} );
cytoscape( {
  headless: true,
  layout: {
    name: 'cose',
    nodeRepulsion: node => node.degree() || 2048,
    idealEdgeLength: edge => edge.source().degree() || 32,
  },
} );

// LayoutInstance lifecycle methods
grid.run();
grid.start();
grid.stop();
grid.on( 'layoutstop', () => {} );
grid.one( 'layoutstop', () => {} );
grid.off( 'layoutstop' );

// documented layout event API (the layout mixes in the event emitter)
grid.emit( 'layoutstop' );
const layoutReady: Promise<unknown> = grid.promiseOn( 'layoutready' );
grid.removeListener( 'layoutstop' );
grid.removeAllListeners();
void layoutReady;

// chaining
grid.run().stop();

// eles.layout() returns a LayoutInstance (run/on/emit/… available + chainable)
cy.nodes().layout({ name: 'grid' }).run();
cy.nodes().layout({ name: 'grid' }).on( 'layoutstop', () => {} );
cy.nodes().layout({ name: 'grid' }).emit( 'layoutready' );
const elesLayout: LayoutInstance = cy.nodes().layout({ name: 'grid' });
void elesLayout;

// LayoutInstance.run() returns `this` for chaining
const chained: LayoutInstance = grid.run();

void [bfs, circle, concentric, random, preset, cose, makeL, createL, typedGrid, typedCose, chained];
