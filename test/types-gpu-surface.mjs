// Audit for the generated and shipped declaration of the `cytoscape/gpu`
// entry point (round 26.5).
//
// Checks five things:
//   1. The declaration exists and exports the factory as default.
//   2. Every name in EXPECTED_EXPORTS is present as a named type export.
//   3. No extra names leak beyond EXPECTED_EXPORTS.
//   4. The factory's static helpers (toColumnarElements, serializeElements,
//      deserializeElements) survive as namespace members — they are expando
//      properties on a function, which is exactly the shape a declaration
//      bundler is most likely to drop silently.
//   5. The round-26 JSDoc actually reaches the shipped declaration.  This is
//      the whole point of pairing the comment pass with the types build: if
//      the doc comments stop surviving the roll-up, consumers lose their
//      editor hover text and nothing else would notice.
//
// Update EXPECTED_EXPORTS deliberately when the v4 public surface changes.
// Run via `npm run test:types:gpu`; use the `:run` variant after an existing
// build.

import fs from 'node:fs';
import ts from 'typescript-compiler-api';

/** The v4 public type surface, as exported from `cytoscape/gpu`. */
const EXPECTED_EXPORTS = new Set( [
  'CytoscapeGpuOptions',
  'GpuBoundingBoxInput',
  'GpuBreadthFirstLayoutOptions',
  'GpuCaseClause',
  'GpuCaseMapper',
  'GpuCircleLayoutOptions',
  'GpuCollection',
  'GpuColumnarEdges',
  'GpuColumnarElements',
  'GpuColumnarNodes',
  'GpuConcentricLayoutOptions',
  'GpuCondition',
  'GpuCore',
  'GpuCustomLayoutOptions',
  'GpuDataColumn',
  'GpuDictColumn',
  'GpuElementData',
  'GpuElementDefinition',
  'GpuElementsDefinition',
  'GpuElementsInput',
  'GpuExportOptions',
  'GpuForceLayoutOptions',
  'GpuGridLayoutOptions',
  'GpuLayoutBaseOptions',
  'GpuLayoutOptions',
  'GpuMapper',
  'GpuMapperSpec',
  'GpuPackedIds',
  'GpuPresetLayoutOptions',
  'GpuRandomLayoutOptions',
  'GpuRendererOptions',
  'GpuStylePropValue',
  'GpuStyleProps',
  'GpuStylesheet',
  'NO_PARENT',
  'Position',
  'RendererStats'
] );

/** Statics hung off the factory function (the UMD-friendly shape). */
const EXPECTED_STATICS = [
  'toColumnarElements',
  'serializeElements',
  'deserializeElements'
];

/**
 * Minimum JSDoc blocks expected in the shipped declaration.  A ratchet, well
 * below the ~1000 the round-26 pass produced: it catches the roll-up dropping
 * comments wholesale, without breaking on ordinary edits.
 */
const MIN_DOC_BLOCKS = 700;

const generatedPath = new URL( '../build/dts-gpu/index.d.ts', import.meta.url );
const shippedPath = new URL( '../dist/cytoscape-gpu.d.ts', import.meta.url );

let failed = false;

const fail = message => {
  console.error( `FAIL  ${message}` );
  failed = true;
};

for( const path of [ generatedPath, shippedPath ] ){
  if( !fs.existsSync( path ) ){
    fail( `${path.pathname} does not exist; run \`npm run build:types\`` );
  }
}

if( failed ){
  process.exit( 1 );
}

const shipped = fs.readFileSync( shippedPath, 'utf8' );
const source = ts.createSourceFile(
  shippedPath.pathname, shipped, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS );

// -- 1. the default export --

if( !/\bcytoscapeGpu as default\b/.test( shipped ) ){
  fail( 'the shipped declaration does not export cytoscapeGpu as default' );
}

if( !/^export as namespace cytoscapeGpu;$/m.test( shipped ) ){
  fail( 'the shipped declaration is missing the UMD global name' );
}

// -- 2 and 3. the named type surface --

const exported = new Set();

for( const statement of source.statements ){
  if( !ts.isExportDeclaration( statement ) || statement.exportClause == null ) continue;
  if( !ts.isNamedExports( statement.exportClause ) ) continue;

  for( const element of statement.exportClause.elements ){
    const name = element.name.text;

    if( name !== 'default' ) exported.add( name );
  }
}

for( const name of EXPECTED_EXPORTS ){
  if( !exported.has( name ) ) fail( `expected export '${name}' is missing` );
}

for( const name of exported ){
  if( !EXPECTED_EXPORTS.has( name ) ){
    fail( `unexpected export '${name}' — add it to EXPECTED_EXPORTS if intended` );
  }
}

// -- 4. the factory's statics --

const namespaceBlock = shipped.match(
  /declare namespace cytoscapeGpu \{([\s\S]*?)\n\}/ );

if( namespaceBlock == null ){
  fail( 'the factory namespace (its static helpers) is missing entirely' );
} else {
  for( const name of EXPECTED_STATICS ){
    if( !namespaceBlock[1].includes( name ) ){
      fail( `factory static '${name}' did not survive into the declaration` );
    }
  }
}

// -- 5. the JSDoc reaches consumers --

const docBlocks = ( shipped.match( /\/\*\*/g ) ?? [] ).length;

if( docBlocks < MIN_DOC_BLOCKS ){
  fail(
    `only ${docBlocks} JSDoc blocks reached the shipped declaration ` +
    `(expected at least ${MIN_DOC_BLOCKS}) — the round-26 comments are not ` +
    `reaching consumers' editors`
  );
}

if( failed ){
  process.exit( 1 );
}

console.log(
  `gpu declaration surface ok: ${exported.size} type exports, ` +
  `${EXPECTED_STATICS.length} statics, ${docBlocks} doc blocks`
);
