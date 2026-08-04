import { expect } from 'chai';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
Round 41.3, rewritten by round 42: what `src` imports from outside itself.

41.3 wrote this to stop the list of v4→v3 shared-module edges *growing* while
the restructure was still ahead.  It measured five (`math`, `types`,
`util/colors`, `util/position`, `util/sort`) after 41.2 severed the emitter —
correcting round 41's plan, which had asserted in advance that the emitter was
the only one.

Round 42 took the call the list was waiting on: **duplicate, don't share.**
v4 owns lean copies of those five (`src/math.mts` carries the seven functions
v4 actually calls, not v3's 1500-line geometry module), v3's originals moved
to `v3/src/`, and the allowlist is empty.  So the invariant this file pins is
now absolute rather than budgeted: **nothing under `src/` may import anything
outside `src/`.**  An edge to `v3/` would make the package depend on a
directory that is not published; an edge to a new shared root would recreate
exactly the coupling the restructure removed.

Note what the emptied allowlist does to the audit's own failure mode.  While
edges were expected, "found no outward edges" was evidence the scanner had
broken; now it is the passing answer, and a regex that stops matching reads
identical to a clean tree.  The controls below therefore moved: they count
*internal* edges and source files, both of which stay large, so a broken
walk still fails loudly.
*/

const ROOT = resolve( fileURLToPath( new URL( '../..', import.meta.url ) ) );
const SRC = join( ROOT, 'src' );

/**
 * Modules under `src` may import from outside `src`.  Empty, and meant to
 * stay that way — see the header.  Kept as a named, checked structure rather
 * than deleted so that adding an exemption is a deliberate edit with a reason
 * attached, on round 37.1's maintained-allowlist terms.
 *
 * @type {Record<string, string>}
 */
const SHARED = {};

/** Every .mts under src, absolute. */
const srcFiles = ( dir = SRC, out = [] ) => {
  for( const name of readdirSync( dir ) ){
    const p = join( dir, name );

    if( statSync( p ).isDirectory() ){ srcFiles( p, out ); }
    else if( name.endsWith( '.mts' ) ){ out.push( p ); }
  }

  return out;
};

/** Every relative `from '...'` specifier in src, resolved and classified. */
const allEdges = () => {
  const outward = new Map();
  let internal = 0;

  for( const file of srcFiles() ){
    const src = readFileSync( file, 'utf8' );

    // `from '...'` covers both `import` and `export ... from`; v4 has no
    // dynamic imports and no require
    for( const m of src.matchAll( /from\s+'([^']+)'/g ) ){
      const spec = m[ 1 ];

      if( !spec.startsWith( '.' ) ){ continue; } // bare = a dependency, not a repo edge

      const target = resolve( dirname( file ), spec );

      if( target.startsWith( SRC + '/' ) ){ internal++; continue; }

      const key = relative( ROOT, target );

      if( !outward.has( key ) ){ outward.set( key, [] ); }

      outward.get( key ).push( relative( ROOT, file ) );
    }
  }

  return { outward, internal };
};

describe( 'import graph: what src reaches outside itself (round 41.3, 42)', function(){

  const { outward, internal } = allEdges();

  it( 'imports nothing outside src', function(){
    const unlisted = [ ...outward.keys() ].filter( k => SHARED[ k ] == null ).sort();

    expect(
      unlisted,
      'dependencies out of src:\n  ' +
      unlisted.map( k => `${k}  (from ${outward.get( k ).join( ', ' )})` ).join( '\n  ' )
    ).to.deep.equal( [] );
  } );

  it( 'reaches into v3/ from nowhere', function(){
    // the restructure's own achievement, stated separately from the general
    // rule because this is the edge that would actually get written: a source
    // file borrowing a v3 helper rather than porting it
    const intoV3 = [ ...outward.keys() ].filter( k => k.startsWith( 'v3/' ) );

    expect( intoV3, `src imports v3 sources: ${intoV3.join( ', ' )}` ).to.deep.equal( [] );
  } );

  it( 'lists no shared module that nothing imports any more', function(){
    // the allowlist half: an entry that has gone stale is one nobody would
    // notice had been fixed
    const stale = Object.keys( SHARED ).filter( k => !outward.has( k ) );

    expect( stale, `SHARED lists modules src no longer imports: ${stale.join( ', ' )}` )
      .to.deep.equal( [] );
  } );

  it( 'no longer imports v3\'s emitter or event object (round 41.2)', function(){
    // the round-41 achievement, pinned: these two were the dependency the v4
    // Event and emitter were built to sever, and re-importing either would
    // restore v3's namespace parsing along with them.  Both spellings are
    // checked because round 42 moved the files under v3/.
    for( const k of [ 'src/emitter.mjs', 'src/event.mjs', 'v3/src/emitter.mjs', 'v3/src/event.mjs' ] ){
      expect( outward.has( k ), `src imports ${k} again` ).to.equal( false );
    }
  } );

  it( 'finds a non-trivial graph to check', function(){
    // The control, inverted by round 42.  While outward edges were expected,
    // "none found" was evidence the scanner had broken; now it is the passing
    // answer, so it can no longer double as that evidence — these two counts
    // do it instead.
    expect( internal, 'the scanner found almost no edges at all; is it still parsing?' )
      .to.be.at.least( 100 );
    expect( srcFiles().length, 'the file walk found too few sources' ).to.be.at.least( 80 );
  } );

  it( 'gives every shared module a reason, not just a name', function(){
    for( const [ name, why ] of Object.entries( SHARED ) ){
      expect( why, `${name} has no reason recorded` ).to.be.a( 'string' );
      expect( why.trim().length, `${name}'s reason is empty` ).to.be.at.least( 20 );
    }
  } );

} );
