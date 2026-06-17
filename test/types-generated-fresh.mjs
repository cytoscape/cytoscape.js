// Freshness gate for the COMMITTED generated type artifacts.
//
// Two generated files are checked into the repo and shipped to consumers:
//
//   * src/style/css-types.mts  — the public `Css.*` style typing surface,
//     emitted from the runtime style inventory by `npm run gen:css-types`.
//   * dist/cytoscape.d.ts      — the shipped declarations, emitted from the
//     TypeScript source by `npm run build:types`.
//
// The surface audits (types-docmaker-surface.mjs / types-css-surface.mjs) run
// against the freshly-regenerated `build/dts/index.d.ts`, so they cannot catch
// a *committed* artifact that has drifted from source. This gate closes that
// hole: it regenerates both files from source and fails if either differs from
// what is committed — i.e. someone edited src/style/properties.mts or the typed
// source without regenerating and committing the outputs.
import { execFileSync } from 'node:child_process';

const generated = [ 'src/style/css-types.mts', 'dist/cytoscape.d.ts' ];

// Regenerate both committed artifacts from source. Self-contained so this check
// is order-independent of the other type runners.
run( 'npm', [ 'run', 'gen:css-types' ] );
run( 'npm', [ 'run', 'build:types' ] );

// `git diff` (working tree vs index) surfaces any regenerated content that does
// not match the committed copy. Tracked files only, which is what we want.
const stale = execFileSync( 'git', [ 'diff', '--name-only', '--', ...generated ], { encoding: 'utf8' } ).trim();

if( stale ){
  console.error( `\nCommitted generated type artifacts are stale:\n${stale.split( '\n' ).map( f => `  ${f}` ).join( '\n' )}\n` );
  console.error( 'Regenerate and commit them:' );
  console.error( '  npm run gen:css-types   # after changing src/style/properties.mts' );
  console.error( '  npm run build:types     # after changing the typed source\n' );
  console.error( 'To inspect the drift: git diff -- ' + generated.join( ' ' ) );
  process.exit( 1 );
}

console.log( 'generated type artifacts are fresh (css-types.mts, dist/cytoscape.d.ts)' );

function run( cmd, args ){
  execFileSync( cmd, args, { stdio: 'inherit' } );
}
