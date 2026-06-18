// Compile-only test for the extension/plugin registration API surface.
// Verifies that the `CytoscapeFactory` call signatures and `CytoscapeExtension`
// type enforce the documented contract:
//
//   cytoscape.use(ext)            — registers a plugin
//   ext receives (cy, ...args)    — cy is CytoscapeFactory
//   cy('core', name, fn)          — registers a core method
//   cy('collection', name, fn)    — registers a collection method
//   cy('layout', name, ctor)      — registers a layout constructor

import cytoscape from '../../build/dts/index.js';
import type { Core, Collection, CytoscapeFactory, CytoscapeExtension } from '../../build/dts/index.js';

// A well-typed extension that registers a core method, a collection method,
// and a layout constructor via the two-arg factory call form.
const myExtension: CytoscapeExtension = ( cy: CytoscapeFactory ) => {
  cy( 'core', 'myMethod', function( this: Core ) {
    return this.elements();
  } );

  cy( 'collection', 'myCollectionMethod', function( this: Collection ) {
    return this.size();
  } );

  cy( 'layout', 'myLayout', function( this: unknown, options: Record<string, unknown> ) {
    void options;
  } );
};

// use() accepts the extension and returns CytoscapeFactory for chaining
const chained: CytoscapeFactory = cytoscape.use( myExtension );
void chained;

// use() can forward extra args to the extension; extra params arrive as unknown
cytoscape.use( ( _cy, _a: unknown, _b: unknown ) => {}, 'hello', 42 );

// CytoscapeExtension must receive CytoscapeFactory as its first arg — other
// types should not satisfy the parameter.
// @ts-expect-error extension receives CytoscapeFactory, not Core
const _bad: CytoscapeExtension = ( _cy: Core ) => {};
void _bad;
