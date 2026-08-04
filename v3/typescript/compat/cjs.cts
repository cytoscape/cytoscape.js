// Legacy CommonJS declaration shape: the module itself is callable and its
// public types are available from the merged namespace.
import cytoscape = require( '../../dist/cytoscape' );

const options: cytoscape.GridLayoutOptions = { name: 'grid' };
const cy: cytoscape.Core = cytoscape( { headless: true } );
const extension: cytoscape.Ext = factory => void factory;
cy.layout( options ).run();
cytoscape.use( extension );
cytoscape.use( ( factory, option: string ) => void [ factory, option ], 'typed-option' );
cytoscape.warnings( false );
const version: string = cytoscape.version;
const stylesheet = cytoscape.stylesheet();
const Stylesheet = cytoscape.Stylesheet;

const elements: cytoscape.ElementsDefinition = {
  nodes: [ { data: { id: 'a' } } ],
  edges: []
};

void [ cy, elements, version, stylesheet, Stylesheet ];
