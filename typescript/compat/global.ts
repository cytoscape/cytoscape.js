/// <reference path="../../dist/cytoscape.d.ts" />

// Script-tag/UMD declaration shape: both the callable global and its type
// namespace are available without an import.
const globalCy: cytoscape.Core = cytoscape( { headless: true } );
const globalLayout: cytoscape.CircleLayoutOptions = { name: 'circle' };
globalCy.layout( globalLayout ).run();
cytoscape.warnings( false );
const globalVersion: string = cytoscape.version;

void [ globalCy, globalVersion ];
