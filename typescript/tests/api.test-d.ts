// Compile-only test that the GENERATED d.ts (build/dts/index.d.ts, emitted
// from the TypeScript source) is usable as a public API surface. Run via
// `npm run test:types` (tsc --noEmit against tsconfig.types-test.json).
//
// This is the proof that the type definitions can be generated from source
// and consumed the way the hand-written index.d.ts was.

import cytoscape from '../../build/dts/index.js';
import type { Core, Collection, Element, CytoscapeOptions } from '../../build/dts/index.js';

// factory: create an instance
const opts: CytoscapeOptions = {
  headless: true,
  styleEnabled: true,
  elements: [
    { data: { id: 'a' } },
    { data: { id: 'b' } },
    { data: { id: 'ab', source: 'a', target: 'b' } }
  ],
  layout: { name: 'grid' }
};
const cy: Core = cytoscape(opts);

// core methods
const all: Collection = cy.elements();
const byId: Collection = cy.getElementById('a');
cy.add({ data: { id: 'c' } });
const removed: Collection = cy.remove(byId);
cy.zoom(2);
const z: number = cy.zoom();
cy.fit();
cy.json();

// events
cy.on('tap', 'node', () => {});
cy.emit('custom');

// collection methods, traversal, data
const nodes: Collection = cy.nodes();
const edges: Collection = cy.edges();
const ele: Element | undefined = nodes.element();
const id: string | undefined = nodes.id();
const deg: number | undefined = nodes.degree();
nodes.forEach((n) => n.data('weight', 1));
const filtered: Collection = nodes.filter(':selected');
const nhood: Collection = nodes.neighborhood();
const conn: Collection = nodes.connectedEdges();

// algorithms
const dijkstra = cy.elements().dijkstra({ root: '#a', directed: false });
const dist: number = dijkstra.distanceTo(cy.getElementById('b'));
const bfs = cy.elements().bfs({ roots: '#a' });
const path: Collection = bfs.path;

// layout + extension registration
const layout = cy.layout({ name: 'grid' });
layout.run();
cytoscape.use(() => {});
const v: string = cytoscape.version;

// silence unused-locals
void [all, removed, z, edges, ele, id, deg, filtered, nhood, conn, dist, path, v];
