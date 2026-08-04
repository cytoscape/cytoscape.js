// Snapshot audit for the generated and shipped declaration entry points.
//
// Checks four things:
//   1. Every name in EXPECTED_EXPORTS is present as a named export.
//   2. No extra names are exported beyond EXPECTED_EXPORTS (catches accidental leaks).
//   3. The shipped export-assignment namespace contains the same type surface.
//   4. The count of `any` occurrences in the generated d.ts does not exceed
//      ANY_THRESHOLD — guards against new `any` escape hatches silently appearing
//      in the public surface during future edits.
//
// Update EXPECTED_EXPORTS deliberately when the public API surface changes.
// Update ANY_THRESHOLD only when new `any` usage is intentional and justified.
// Run via `npm run test:types:exports`; use the `:run` variant after an existing build.

import fs from 'node:fs';
import ts from 'typescript-compiler-api';

// Canonical public surface: every v3 namespace type plus the intentional v4
// additions.  Keeping the fixture separate makes omissions reviewable and
// prevents this audit from silently blessing a reduced generated surface.
const expectedPath = new URL( './legacy-public-types.txt', import.meta.url );
const EXPECTED_EXPORTS = new Set(
  fs.readFileSync( expectedPath, 'utf8' ).split( /\r?\n/ ).filter( Boolean )
);

// Maximum number of `any` tokens allowed in the generated d.ts. The remaining
// uses are compatibility escape hatches for event/plugin varargs, dynamic JSON,
// style getters, layout extension options, and callback `thisArg` values. This
// is a ratchet: lower it whenever one of those boundaries becomes more precise.
const ANY_THRESHOLD = 26;

const generatedPath = new URL( '../build/dts/index.d.ts', import.meta.url );
const generatedDts = fs.readFileSync( generatedPath, 'utf8' );
const generatedSource = ts.createSourceFile( generatedPath.pathname, generatedDts, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS );
const generatedExports = collectNamedExports( generatedSource.statements );
let failed = compareExports( generatedExports, EXPECTED_EXPORTS, 'build/dts/index.d.ts' );

const shippedPath = new URL( '../dist/cytoscape.d.ts', import.meta.url );
const shippedDts = fs.readFileSync( shippedPath, 'utf8' );
const shippedSource = ts.createSourceFile( shippedPath.pathname, shippedDts, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS );
const namespaceExports = new Set();
const factoryValueExports = new Set( [ 'Stylesheet', 'version', 'warnings' ] );

for( const stmt of shippedSource.statements ){
  if( ts.isModuleDeclaration( stmt ) && stmt.name.text === 'cytoscape' && stmt.body && ts.isModuleBlock( stmt.body ) ){
    for( const name of collectNamedExports( stmt.body.statements ) ){
      if( !factoryValueExports.has( name ) ){
        namespaceExports.add( name );
      }
    }
  }
}

const expectedNamespaceExports = new Set( [ ...EXPECTED_EXPORTS ].filter( name => name !== 'default' ) );
failed = compareExports( namespaceExports, expectedNamespaceExports, 'dist/cytoscape.d.ts namespace' ) || failed;

const hasExportAssignment = shippedSource.statements.some( stmt => ts.isExportAssignment( stmt ) && stmt.isExportEquals );
const hasGlobalNamespace = shippedSource.statements.some( stmt => ts.isNamespaceExportDeclaration( stmt ) && stmt.name.text === 'cytoscape' );
const hasCallableFactory = shippedSource.statements.some( stmt => ts.isFunctionDeclaration( stmt ) && stmt.name?.text === 'cytoscape' );

if( !hasExportAssignment || !hasGlobalNamespace || !hasCallableFactory ){
  failed = true;
  console.error( 'dist/cytoscape.d.ts must expose a callable export assignment and the cytoscape UMD namespace.' );
}

// Count `any` tokens in non-comment lines of the generated d.ts.
const anyCount = generatedDts.split( '\n' )
  .filter( line => {
    const t = line.trimStart();
    return !t.startsWith( '//' ) && !t.startsWith( '*' ) && !t.startsWith( '/*' );
  } )
  .join( '\n' )
  .match( /\bany\b/g )?.length ?? 0;

if( anyCount > ANY_THRESHOLD ){
  failed = true;
  console.error( `\`any\` count in build/dts/index.d.ts is ${anyCount}, exceeds threshold of ${ANY_THRESHOLD}.` );
  console.error( 'If the new `any` usage is intentional, raise ANY_THRESHOLD in test/types-exports.mjs and document why in the source.' );
}

if( failed ){
  process.exit( 1 );
}

console.log( `export snapshot audit passed (${generatedExports.size} generated / ${namespaceExports.size} namespace exports, ${anyCount}/${ANY_THRESHOLD} any tokens)` );

function collectNamedExports( statements ){
  const exports = new Set();

  for( const stmt of statements ){
    if( ts.isExportDeclaration( stmt ) && stmt.exportClause && ts.isNamedExports( stmt.exportClause ) ){
      for( const spec of stmt.exportClause.elements ){
        // use the exported name (after `as`), not the local name
        exports.add( ( spec.name ?? spec.propertyName ).text );
      }
    }

    if( stmt.modifiers?.some( modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword ) ){
      exports.add( 'default' );
    }
  }

  return exports;
}

function compareExports( actual, expected, label ){
  const missing = [ ...expected ].filter( name => !actual.has( name ) ).sort();
  const extra = [ ...actual ].filter( name => !expected.has( name ) ).sort();

  if( missing.length ){
    console.error( `Named exports missing from ${label}:\n${missing.join( '\n' )}` );
  }

  if( extra.length ){
    console.error( `Unexpected extra named exports in ${label}:\n${extra.join( '\n' )}` );
  }

  if( missing.length || extra.length ){
    console.error( '\nUpdate test/legacy-public-types.txt only for an intentional public API change.' );
  }

  return missing.length > 0 || extra.length > 0;
}
