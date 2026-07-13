// Freshness gate for committed generated type artifacts.
//
// css-types.mts is generated from the runtime style inventory by
// `npm run gen:css-types` and is committed to the repo so consumers see it
// in source. This gate regenerates it and fails if the result differs from
// what is committed — i.e. someone edited src/style/properties.mts without
// running the generator.
//
// The caller builds declarations first.  Comparing both generated files to
// the index keeps package installs from Git or source archives from exposing
// stale types between releases.
import { execFileSync } from 'node:child_process';

const generated = [ 'src/style/css-types.mts', 'dist/cytoscape.d.ts' ];

run( 'npm', [ 'run', 'gen:css-types' ] );

// `git diff` (working tree vs index) surfaces content that doesn't match
// the committed copy.
const stale = execFileSync( 'git', [ 'diff', '--name-only', '--', ...generated ], { encoding: 'utf8' } ).trim();

if( stale ){
  console.error( `\nCommitted generated file is stale:\n${stale.split( '\n' ).map( f => `  ${f}` ).join( '\n' )}\n` );
  console.error( 'Regenerate and commit type artifacts:' );
  console.error( '  npm run gen:css-types' );
  console.error( '  npm run build:types' );
  console.error( '\nTo inspect the drift: git diff -- ' + generated.join( ' ' ) );
  process.exit( 1 );
}

console.log( 'generated type artifacts are fresh' );

function run( cmd, args ){
  execFileSync( cmd, args, { stdio: 'inherit' } );
}
