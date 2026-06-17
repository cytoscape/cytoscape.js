// Snapshot audit for the named exports of the generated build/dts/index.d.ts.
//
// Checks two things:
//   1. Every name in EXPECTED_EXPORTS is present as a named export.
//   2. No extra names are exported beyond EXPECTED_EXPORTS (catches accidental leaks).
//
// Update EXPECTED_EXPORTS deliberately when the public API surface changes.
// Run via `npm run test:types:exports` (no build step needed; uses build/dts directly).

import fs from 'node:fs';
import ts from 'typescript';

// Canonical set of public named exports. Changing this list is a conscious API decision.
const EXPECTED_EXPORTS = new Set( [
  'AbstractEventObject',
  'BoundingBox',
  'Collection',
  'Core',
  'Css',
  'CytoscapeExtension',
  'CytoscapeFactory',
  'CytoscapeOptions',
  'EdgeCollection',
  'EdgeSingular',
  'Element',
  'ElementDefinition',
  'ElementJson',
  'EventHandler',
  'EventObject',
  'EventObjectCore',
  'EventObjectEdge',
  'EventObjectNode',
  'InputEventObject',
  'LayoutEventObject',
  'LayoutInstance',
  'NodeCollection',
  'NodeSingular',
  'Position',
  'RendererInstance',
  'Singular',
  'StyleJson',
  'StyleJsonBlock',
  'default',
] );

const dtsPath = new URL( '../build/dts/index.d.ts', import.meta.url );
const dts = fs.readFileSync( dtsPath, 'utf8' );
const source = ts.createSourceFile( dtsPath.pathname, dts, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS );

const actual = new Set();

for( const stmt of source.statements ){
  if( ts.isExportDeclaration( stmt ) && stmt.exportClause && ts.isNamedExports( stmt.exportClause ) ){
    for( const spec of stmt.exportClause.elements ){
      // use the exported name (after `as`), not the local name
      actual.add( ( spec.name ?? spec.propertyName ).text );
    }
  }

  // `export default` / `export const` / `export function` etc.
  if( stmt.modifiers?.some( m => m.kind === ts.SyntaxKind.ExportKeyword ) ){
    if( ts.isFunctionDeclaration( stmt ) || ts.isClassDeclaration( stmt ) || ts.isVariableStatement( stmt ) ){
      actual.add( 'default' ); // coarse; named exports above cover the typed names
    }
  }
}

const missing = [ ...EXPECTED_EXPORTS ].filter( n => !actual.has( n ) ).sort();
const extra   = [ ...actual ].filter( n => !EXPECTED_EXPORTS.has( n ) ).sort();

let failed = false;

if( missing.length ){
  failed = true;
  console.error( `Named exports missing from build/dts/index.d.ts:\n${missing.join( '\n' )}` );
  console.error( '\nIf these were intentionally removed, update EXPECTED_EXPORTS in test/types-exports.mjs.' );
}

if( extra.length ){
  failed = true;
  console.error( `Unexpected extra named exports in build/dts/index.d.ts:\n${extra.join( '\n' )}` );
  console.error( '\nIf these are intentional additions, add them to EXPECTED_EXPORTS in test/types-exports.mjs.' );
}

if( failed ){
  process.exit( 1 );
}

console.log( `export snapshot audit passed (${actual.size} named exports)` );
