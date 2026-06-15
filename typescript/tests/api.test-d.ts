// Compile-only test that the GENERATED d.ts (build/dts/index.d.ts, emitted
// from the TypeScript source) is usable as a public API surface. Run via
// `npm run test:types` (tsc --noEmit against tsconfig.types-test.json).
//
// This is the proof that the type definitions can be generated from source
// and consumed the way the hand-written index.d.ts was.

import cytoscape from '../../build/dts/index.js';
import type { Core, Collection, Css, Element, CytoscapeOptions, NodeCollection, EdgeCollection, NodeSingular, EdgeSingular, StyleJsonBlock, EventObject, EventObjectNode, EventObjectEdge } from '../../build/dts/index.js';

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

// events: the EventObject hierarchy is surfaced on the public binding API
cy.on('tap', ( e: EventObject ) => {
  const t: Element | Core = e.target;
  const pos = e.position; // input-event field
  const ts: number = e.timeStamp;
  void [t, pos, ts];
});
cy.on('tap', 'node', ( e: EventObjectNode ) => {
  const n: NodeSingular = e.target; // target narrowed to a node
  void n;
});
cy.on('tap', 'edge', ( e: EventObjectEdge ) => {
  const ed: EdgeSingular = e.target; // target narrowed to an edge
  void ed;
});
const tapped: Promise<EventObject> = cy.pon('tap'); // promiseOn resolves to an EventObject
cy.elements().on('mouseover', ( e: EventObject ) => void e.cy); // collection binding
cy.emit('custom');
void tapped;

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

// node/edge public projections: each kind exposes only its own methods
nodes.degree();              // node-only, OK on nodes
edges.source();              // edge-only, OK on edges
// @ts-expect-error edge-only method is not on the node type
nodes.source();
// @ts-expect-error edge-only method is not on the node type
nodes.parallelEdges();
// @ts-expect-error node-only method is not on the edge type
edges.degree();
// @ts-expect-error node-only method is not on the edge type
edges.parent();
// shared methods remain available on both
nodes.boundingBox();
edges.boundingBox();

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

// Css.* surface: node/edge/core property maps, mapper functions, and the
// narrowed value families generated from the runtime style inventory.
const nodeCss: Css.Node = {
  'background-color': 'blue',
  'background-opacity': ( ele: NodeSingular ) => ele.data( 'o' ) as number, // node mapper
  'transition-timing-function': 'ease-in-out', // common property + enum
  shape: 'round-rectangle', // node-specific NodeShape enum
  'pie-1-background-color': 'green' // generated numbered property
};

const edgeCss: Css.Edge = {
  'line-color': 'black',
  'curve-style': 'bezier', // edge-specific CurveStyle enum
  'target-arrow-shape': 'triangle', // ArrowShape enum
  'line-opacity': ( ele ) => ele.data( 'o' ) as number, // edge mapper (ele inferred as EdgeSingular)
  width: 3 // shared property accepted via the index signature
};

const coreCss: Css.Core = {
  'active-bg-color': 'black',
  'selection-box-opacity': 0.5
};

const nodeShape: Css.NodeShape = 'hexagon'; // exported enum alias

const styleJsonBlock: StyleJsonBlock = {
  selector: 'core',
  style: coreCss
};

// public style entry points reference the Css surface
cytoscape.stylesheet()
  .selector('node')
  .style(nodeCss)
  .selector('edge')
  .css(edgeCss);

// element JSON style/css fields accept Css maps
cy.add({ group: 'nodes', data: { id: 'd' }, style: { 'border-width': 2 } });

// silence unused-locals
void [all, byId, removed, z, edges, ele, id, deg, filtered, nhood, conn, src, dist, path, v, styleJsonBlock, edgeCss, nodeShape];
