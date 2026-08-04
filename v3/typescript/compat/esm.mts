// The export-assignment compatibility shape still supports the package's ESM
// runtime entry through normal synthetic-default interop and named types.
import cytoscape, {
  type Core,
  type ElementsDefinition,
  type GridLayoutOptions,
  type SearchDijkstraOptions
} from '../../dist/cytoscape.js';

const cy: Core = cytoscape( { headless: true } );
const layout: GridLayoutOptions = { name: 'grid' };
const elements: ElementsDefinition = { nodes: [], edges: [] };
const search: SearchDijkstraOptions = { root: '#a', directed: true };

cy.layout( layout ).run();
cytoscape.warnings( false );
const version: string = cytoscape.version;
void [ elements, search, version ];
