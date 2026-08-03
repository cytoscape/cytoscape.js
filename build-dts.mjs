// Finalizes the bundled declarations (build/dts/index.d.ts, generated from
// the TypeScript source) into the shipped dist/cytoscape.d.ts.  The source
// declaration is ESM-shaped; the package declaration uses the historical
// callable export-assignment shape so CommonJS and script-global consumers
// keep working.  Namespace members remain available as named type imports.
//
// The v4 GPU prototype entry (round 26.5) is finalized here too, from
// build/dts-gpu/index.d.ts into dist/cytoscape-gpu.d.ts.  That entry is
// ESM-only — the package's "./gpu" export has no `require` condition — so its
// declaration keeps the generated ESM shape and only gains the UMD global
// name, for consumers loading build/cytoscape-gpu.umd.js from a script tag.
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { pathToFileURL } from 'url';

const src = 'build/dts/index.d.ts';
const out = 'dist/cytoscape.d.ts';

const gpuSrc = 'build/dts-gpu/index.d.ts';
const gpuOut = 'dist/cytoscape-gpu.d.ts';

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

/**
 * Finalize the GPU prototype's declaration.  Unlike the v3 entry this needs
 * no reshaping — the generated ESM form is what `cytoscape/gpu` consumers
 * import — so the only addition is the UMD global name.  Idempotent: a
 * declaration that already carries the line is returned unchanged.
 */
export function finalizeGpuDts( source ){
  if( !/\bcytoscapeGpu as default\b/.test( source ) ){
    throw new Error( 'Generated gpu declaration has no default factory export' );
  }

  if( /^export as namespace cytoscapeGpu;$/m.test( source ) ){
    return source;
  }

  return `${source.trimEnd()}\nexport as namespace cytoscapeGpu;\n`;
}

if( process.argv[1] && import.meta.url === pathToFileURL( process.argv[1] ).href ){
  const dts = finalizeDts( readFileSync( src, 'utf8' ) );

  mkdirSync( 'dist', { recursive: true } );
  writeFileSync( out, dts );
  console.log( `wrote ${out} (${dts.split( '\n' ).length} lines)` );

  const gpuDts = finalizeGpuDts( readFileSync( gpuSrc, 'utf8' ) );

  writeFileSync( gpuOut, gpuDts );
  console.log( `wrote ${gpuOut} (${gpuDts.split( '\n' ).length} lines)` );
}
