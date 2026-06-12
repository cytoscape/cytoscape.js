// Compile-only test that the GENERATED d.ts (build/dts/index.d.ts, emitted
// from the TypeScript source) is usable as a public API surface. Run via
// `npm run test:types` (tsc --noEmit against tsconfig.types-test.json).
//
// This is the proof that the type definitions can be generated from source
// and consumed the way the hand-written index.d.ts was.

import cytoscape from '../../build/dts/index.js';
import type { Core, Collection, Css, Element, CytoscapeOptions, NodeCollection, EdgeCollection, NodeSingular, StyleJsonBlock } from '../../build/dts/index.js';

// factory: create an instance
const opts: CytoscapeOptions = {
  headless: true,
  styleEnabled: true,
  style: [
    {
      selector: 'node',
      style: {
        'background-color': 'red',
        width: ( ele ) => ele.data('w') as number,
        shape: 'ellipse'
      }
    }
  ],
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
const nodes: NodeCollection = cy.nodes();
const edges: EdgeCollection = cy.edges();
const ele: Element = nodes.first();
const id: string | undefined = nodes.id();
const deg: number | undefined = nodes.degree();
nodes.forEach((n) => n.data('weight', 1));
const filtered: Collection = nodes.filter(':selected');
const nhood: Collection = nodes.neighborhood();
const conn: EdgeCollection = nodes.connectedEdges();
const src: NodeSingular = edges.source();

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

const nodeCss: Css.Node = {
  'background-color': 'blue',
  'transition-timing-function': 'ease-in-out',
  shape: 'round-rectangle'
};

const styleJsonBlock: StyleJsonBlock = {
  selector: 'core',
  style: { 'selection-box-color': 'red' }
};

cytoscape.stylesheet()
  .selector('node')
  .style(nodeCss)
  .selector('edge')
  .css({ 'line-color': 'black', 'target-arrow-shape': 'triangle' });

// silence unused-locals
void [all, removed, z, edges, ele, id, deg, filtered, nhood, conn, src, dist, path, v, styleJsonBlock];
