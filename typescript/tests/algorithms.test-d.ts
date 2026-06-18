// Compile-only test for algorithm return-type shapes.
// Each algorithm returns a specific result object; this file asserts that
// the return type is correct and that the documented result fields/methods
// are present and correctly typed.

import cytoscape from '../../build/dts/index.js';
import type { Core, Collection, NodeSingular } from '../../build/dts/index.js';

const cy: Core = cytoscape({ headless: true, elements: [
  { data: { id: 'a' } }, { data: { id: 'b' } }, { data: { id: 'c' } },
  { data: { id: 'ab', source: 'a', target: 'b' } },
  { data: { id: 'bc', source: 'b', target: 'c' } },
] });

const eles: Collection = cy.elements();

// --- dijkstra ---
const dijkstra = eles.dijkstra({ root: '#a', directed: true });
const dijkstraDist: number = dijkstra.distanceTo(cy.getElementById('b'));
const dijkstraPath: Collection = dijkstra.pathTo(cy.getElementById('c'));
void [dijkstraDist, dijkstraPath];

// --- A* ---
const aStar = eles.aStar({
  root: '#a',
  goal: '#c',
  heuristic: ( node: NodeSingular ) => 0,
  directed: true,
});
const aStarFound: boolean = aStar.found;
const aStarDist: number | undefined = aStar.distance;
const aStarPath: Collection | undefined = aStar.path;
void [aStarFound, aStarDist, aStarPath];

// --- bfs / dfs ---
const bfs = eles.bfs({ roots: '#a', directed: true });
const bfsPath: Collection = bfs.path;
const bfsFound: Collection = bfs.found;
const dfs = eles.dfs({ roots: '#a' });
const dfsPath: Collection = dfs.path;
void [bfsPath, bfsFound, dfsPath];

// --- kruskal ---
const mst: Collection = eles.kruskal(e => e.data('weight') as number);
void mst;

// --- floydWarshall ---
const fw = eles.floydWarshall({ directed: false });
const fwDist: number = fw.distance(cy.getElementById('a'), cy.getElementById('c'));
const fwPath: Collection = fw.path(cy.getElementById('a'), cy.getElementById('c'));
void [fwDist, fwPath];

// --- pageRank ---
const pr = eles.pageRank({});
const prRank: number = pr.rank(cy.getElementById('a'));
void prRank;

// --- degreeCentrality ---
// result is a union; narrow to the undirected form to access .degree
const dcResult = eles.degreeCentrality({ root: '#a' });
void dcResult;

// --- degreeCentralityNormalized ---
const dcn = eles.degreeCentralityNormalized({});
void dcn;

// --- betweennessCentrality ---
const bc = eles.betweennessCentrality({});
const bcVal: number | undefined = bc.betweenness(cy.getElementById('b'));
const bcNorm: number | undefined = bc.betweennessNormalized(cy.getElementById('b'));
void [bcVal, bcNorm];

// --- closenessCentralityNormalized ---
const ccn = eles.closenessCentralityNormalized({});
const ccnVal: number = ccn.closeness(cy.getElementById('b'));
void ccnVal;
