// Compile-only test for the layout API surface.
// Verifies that cy.layout() / eles.layout() return a usable LayoutInstance with
// the documented lifecycle methods.
//
// Note: per-layout option types (GridLayoutOptions, BreadthFirstLayoutOptions,
// etc.) were present in the hand-written index.d.ts but are NOT currently
// exported from the generated declarations. Consumers who reference those named
// types directly will get a compile error until they are added. The base
// LayoutOptions shape ({ name: string }) is the only exported layout type.

import cytoscape from '../../build/dts/index.js';
import type { Core, LayoutInstance } from '../../build/dts/index.js';

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

// LayoutInstance lifecycle methods
grid.run();
grid.start();
grid.stop();
grid.on( 'layoutstop', () => {} );
grid.one( 'layoutstop', () => {} );
grid.off( 'layoutstop' );

// chaining
grid.run().stop();

// eles.layout() returns the internal LayoutLike (a permissive structural type);
// run() and on() are available on it
cy.nodes().layout({ name: 'grid' }).run();
cy.nodes().layout({ name: 'grid' }).on( 'layoutstop', () => {} );

// LayoutInstance.run() returns `this` for chaining
const chained: LayoutInstance = grid.run();

void [bfs, circle, concentric, random, preset, cose, makeL, createL, chained];
