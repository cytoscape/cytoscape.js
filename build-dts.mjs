// Finalizes the bundled declarations (build/dts/index.d.ts, generated from
// the TypeScript source) into the shipped dist/cytoscape.d.ts.  The source
// declaration is ESM-shaped; the package declaration uses the historical
// callable export-assignment shape so CommonJS and script-global consumers
// keep working.  Namespace members remain available as named type imports.
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { pathToFileURL } from 'url';

const src = 'build/dts/index.d.ts';
const out = 'dist/cytoscape.d.ts';

/**
 * Convert the generated ESM export list into the v3-compatible callable
 * module/namespace declaration.  TypeScript exposes namespace members as
 * named type imports, so this retains the generated named surface too.
 */
export function finalizeDts( source ){
  const exportMatch = source.match( /\nexport\s*\{([\s\S]*?)\};\s*$/ );

  if( !exportMatch ){
    throw new Error( 'Generated declaration does not end in an export list' );
  }

  const entries = exportMatch[1].split( ',' ).map( entry => entry.trim() ).filter( Boolean );
  const defaultEntry = entries.find( entry => /\s+as\s+default$/.test( entry ) );

  if( !defaultEntry ){
    throw new Error( 'Generated declaration has no default factory export' );
  }

  const factoryName = defaultEntry.replace( /\s+as\s+default$/, '' );
  const namespaceEntries = entries.filter( entry => entry !== defaultEntry );
  const prefix = source.slice( 0, exportMatch.index ).trimEnd();

  return `${prefix}\n\ndeclare namespace ${factoryName} {\n  export { ${namespaceEntries.join( ', ' )} };\n}\nexport = ${factoryName};\nexport as namespace ${factoryName};\n`;
}

if( process.argv[1] && import.meta.url === pathToFileURL( process.argv[1] ).href ){
  const dts = finalizeDts( readFileSync( src, 'utf8' ) );

  mkdirSync( 'dist', { recursive: true } );
  writeFileSync( out, dts );
  console.log( `wrote ${out} (${dts.split( '\n' ).length} lines)` );
}
