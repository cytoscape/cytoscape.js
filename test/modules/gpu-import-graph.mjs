import { expect } from 'chai';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
Round 41.3: what `src/gpu` imports from outside itself.

This is round 42's precondition — v4's source promotes from `src/gpu/` to
`src/` and v3's whole file set moves to `v3/`, so every edge leaving
`src/gpu` is a question that restructure has to answer: does this module go
with v4, stay shared, or move to `v3/` and get replaced?

Round 41's plan stated the answer in advance — "v4's one remaining
shared-module dependency on v3 is `src/emitter.mts`".  That was **wrong**,
and this spec is how it was measured rather than assumed.  41.2 severed the
emitter and the event object with it, and five shared modules remain, listed
below.  They are a different kind of dependency from the emitter: generic
utilities rather than v3 core or renderer code, so the restructure may
legitimately keep them shared instead of duplicating them.  That is a round-42
scope call, logged rather than pre-empted here.

The spec's job in the meantime is to stop the list *growing*: a new edge out
of `src/gpu` fails, and so does an allowlist entry nothing imports any more —
the maintained-allowlist discipline round 37.1 applied to the throw gate,
for the same reason (an exemption nobody checks is an exemption that spreads).
*/

const ROOT = resolve( fileURLToPath( new URL( '../..', import.meta.url ) ) );
const GPU = join( ROOT, 'src/gpu' );

/**
 * Shared modules `src/gpu` still imports, each with why it is not a problem
 * the way the emitter was.  Round 42 decides whether each promotes with v4,
 * stays shared at the new root, or is replaced.
 */
const SHARED = {
  'src/math.mjs':
    'generic geometry/number helpers (bounding boxes, clamping) — no v3 model '
    + 'or renderer types in its signature',
  'src/types.mjs':
    'shared structural types (Position, BoundingBox) that v3 and v4 both '
    + 'describe the same way',
  'src/util/colors.mjs':
    'colour parsing and conversion, used by the mapper DSL, the style engine '
    + 'and the renderer alike',
  'src/util/position.mjs':
    'position helpers used by the breadthfirst layout',
  'src/util/sort.mjs':
    'comparator helpers used by the breadthfirst layout'
};

/** Every .mts under src/gpu, absolute. */
const gpuFiles = ( dir = GPU, out = [] ) => {
  for( const name of readdirSync( dir ) ){
    const p = join( dir, name );

    if( statSync( p ).isDirectory() ){ gpuFiles( p, out ); }
    else if( name.endsWith( '.mts' ) ){ out.push( p ); }
  }

  return out;
};

/** target (repo-relative .mjs specifier) -> the src/gpu files importing it */
const outwardEdges = () => {
  const edges = new Map();

  for( const file of gpuFiles() ){
    const src = readFileSync( file, 'utf8' );

    // `from '...'` covers both `import` and `export ... from`; v4 has no
    // dynamic imports and no require
    for( const m of src.matchAll( /from\s+'([^']+)'/g ) ){
      const spec = m[ 1 ];

      if( !spec.startsWith( '.' ) ){ continue; } // bare = a dependency, not a repo edge

      const target = resolve( dirname( file ), spec );

      if( target.startsWith( GPU + '/' ) ){ continue; }

      const key = relative( ROOT, target );

      if( !edges.has( key ) ){ edges.set( key, [] ); }

      edges.get( key ).push( relative( ROOT, file ) );
    }
  }

  return edges;
};

describe( 'gpu/import graph: what src/gpu reaches outside itself (round 41.3)', function(){

  const edges = outwardEdges();

  it( 'imports nothing outside src/gpu but the listed shared modules', function(){
    const unlisted = [ ...edges.keys() ].filter( k => SHARED[ k ] == null ).sort();

    expect(
      unlisted,
      'new dependencies out of src/gpu:\n  ' +
      unlisted.map( k => `${k}  (from ${edges.get( k ).join( ', ' )})` ).join( '\n  ' )
    ).to.deep.equal( [] );
  } );

  it( 'lists no shared module that nothing imports any more', function(){
    // the allowlist half: an entry that has gone stale is one nobody would
    // notice had been fixed
    const stale = Object.keys( SHARED ).filter( k => !edges.has( k ) );

    expect( stale, `SHARED lists modules src/gpu no longer imports: ${stale.join( ', ' )}` )
      .to.deep.equal( [] );
  } );

  it( 'no longer imports v3\'s emitter or event object (round 41.2)', function(){
    // the round's own achievement, pinned: these two were the dependency the
    // v4 Event and emitter were built to sever, and re-importing either
    // would restore v3's namespace parsing along with them
    expect( edges.has( 'src/emitter.mjs' ), 'src/gpu imports v3\'s emitter again' )
      .to.equal( false );
    expect( edges.has( 'src/event.mjs' ), 'src/gpu imports v3\'s event object again' )
      .to.equal( false );
  } );

  it( 'finds a non-trivial number of edges to check', function(){
    // the guard every audit in this repo carries: a regex that stops
    // matching must not read as a clean bill of health
    const total = [ ...edges.values() ].reduce( ( n, v ) => n + v.length, 0 );

    expect( total, 'the scanner found no outward edges at all; is it still parsing?' )
      .to.be.at.least( 10 );
    expect( gpuFiles().length, 'the file walk found too few sources' ).to.be.at.least( 80 );
  } );

  it( 'gives every shared module a reason, not just a name', function(){
    for( const [ name, why ] of Object.entries( SHARED ) ){
      expect( why, `${name} has no reason recorded` ).to.be.a( 'string' );
      expect( why.trim().length, `${name}'s reason is empty` ).to.be.at.least( 20 );
    }
  } );

} );
