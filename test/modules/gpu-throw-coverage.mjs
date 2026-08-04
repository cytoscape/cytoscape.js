import { audit, BROWSER_ONLY, MISATTRIBUTED, UNREACHABLE } from '../../scripts/gpu-throw-coverage.mjs';
import { expect } from 'chai';

/*
Round 30.4: the error-contract measurement tool, checked against a
hand-written lcov report.

The tool itself is a reporting script, not a gate — a coverage floor is a
policy call, recorded in PLAN.md's open calls — but its *parser* is the thing
every number it prints depends on, and the round it comes from exists because
the first version of this measurement was silently wrong.  So the parser is
pinned here rather than trusted.

`audit( lcovText )` reads real src/gpu sources and only takes the line counts
from the report, so the fixture names real files and real throw lines.
*/

// src/gpu/style.mts has hundreds of throws; two known lines stand in for
// "covered" and "never run" without the fixture having to describe them all.
const lcov = ( { covered = [], dead = [], file = 'src/gpu/style.mts' } ) => [
  'TN:',
  `SF:${file}`,
  ...covered.map( ln => `DA:${ln},7` ),
  ...dead.map( ln => `DA:${ln},0` ),
  'end_of_record',
  ''
].join( '\n' );

describe('scripts/gpu-throw-coverage', function(){

  it('reads a source-mapped lcov report and classifies each throw', function(){
    // 874 is the wrap family's keyword guard, 1031 the gradient stop percent
    const result = audit( lcov( { covered: [ 874 ], dead: [ 1031 ] } ) );
    const at = ( file, line ) => result.sites.find( s => s.file === file && s.line === line );

    expect( at( 'src/gpu/style.mts', 874 ).covered ).to.equal( true );
    expect( at( 'src/gpu/style.mts', 1031 ).covered ).to.equal( false );

    // and a throw the report says nothing about is unknown, not covered
    expect( at( 'src/gpu/style.mts', 1074 ).covered ).to.equal( null );
  });

  it('counts only Node-reachable sites as dead', function(){
    // three never-run throws, one per classification
    const report = [
      lcov( { dead: [ 874 ] } ),
      lcov( { dead: [ 740 ], file: 'src/gpu/render/renderer.mts' } ),
      lcov( { dead: [ 68 ], file: 'src/gpu/wire.mts' } )
    ].join( '' );
    const result = audit( report );
    const isDead = ( file, line ) => result.dead.some( s => s.file === file && s.line === line );

    expect( isDead( 'src/gpu/style.mts', 874 ) ).to.equal( true );
    expect( isDead( 'src/gpu/render/renderer.mts', 740 ) ).to.equal( false ); // browser
    expect( isDead( 'src/gpu/wire.mts', 68 ) ).to.equal( false ); // unreachable by design

    expect( result.browser ).to.be.greaterThan( 0 );
    expect( result.unreachable ).to.equal( Object.keys( UNREACHABLE ).length );
  });

  it('classifies a browser-file site that is also unreachable as unreachable', function(){
    // Round 36.4: three of the browser tier's unpinned sites are guards
    // no input reaches (a shadowed check, a column-id invariant, a
    // write-kind invariant), so they moved to UNREACHABLE while staying
    // in a BROWSER_ONLY directory.  The two tallies then double-counted
    // them and summed past the site total — which is how it was noticed,
    // and is what this pins.
    const result = audit( lcov( {} ) );
    const both = Object.keys( UNREACHABLE )
      .filter( at => BROWSER_ONLY.some( prefix => at.startsWith( prefix ) ) );

    expect( both.length, 'no site is in both lists; this spec is vacuous' )
      .to.be.greaterThan( 0 );

    // the tallies partition: their sum is the number of *distinct* sites
    // in either category, so a site in both is counted once
    const unrun = result.sites.filter( s => s.covered !== true );
    const distinct = new Set( [
      ...unrun.filter( s => s.browser ),
      ...unrun.filter( s => s.unreachable != null )
    ] );

    expect( result.browser + result.unreachable ).to.equal( distinct.size );

    // and --verbose labels them the same way the tally counts them
    for( const at of both ){
      const [ file, line ] = [ at.slice( 0, at.lastIndexOf( ':' ) ), Number( at.slice( at.lastIndexOf( ':' ) + 1 ) ) ];
      const site = result.sites.find( s => s.file === file && s.line === line );

      expect( site, `${at} is listed in UNREACHABLE but is not a throw site` )
        .to.not.equal( undefined );
      expect( site.unreachable ).to.be.a( 'string' );
    }
  });

  it('reports a throw the lcov says nothing about as unknown, never as dead', function(){
    // the distinction matters: "no data" means the file never loaded, which
    // is a different problem from "loaded and never reached"
    const result = audit( lcov( {} ) );

    expect( result.sites.every( s => s.covered !== true ) ).to.equal( true );
    expect( result.dead.length ).to.equal( 0 );
  });

  it('overrides the known-misattributed site rather than counting it covered', function(){
    // exportScale's body reads as the module-evaluation count, so the raw
    // report claims this line runs in Node.  It cannot: there is no renderer.
    const [ file, line ] = Object.keys( MISATTRIBUTED )[ 0 ].split( ':' );
    const result = audit( lcov( { covered: [ Number( line ) ], file } ) );
    const site = result.sites.find( s => s.file === file && s.line === Number( line ) );

    expect( site.covered ).to.equal( false );
    expect( site.misattributed ).to.be.a( 'string' );
    expect( result.dead ).to.not.include( site ); // still browser, not a gap
  });

  it('finds a throw in every audited file it claims to scan', function(){
    const result = audit( lcov( {} ) );
    const files = new Set( result.sites.map( s => s.file ) );

    expect( result.sites.length ).to.be.greaterThan( 100 );
    expect( files.has( 'src/gpu/style.mts' ) ).to.equal( true );
    expect( files.has( 'src/gpu/core.mts' ) ).to.equal( true );

    // the browser prefixes are matched against repo-relative paths: every
    // site under one is classified browser, and at least one prefix matches
    // (src/gpu/interact/ holds no throws today — the prefix is there so its
    // first one is classified correctly rather than read as a Node gap)
    const under = result.sites.filter( s => BROWSER_ONLY.some( p => s.file.startsWith( p ) ) );

    expect( under.length ).to.be.greaterThan( 0 );
    expect( under.every( s => s.browser ) ).to.equal( true );
    expect( result.sites.filter( s => s.browser ).length ).to.equal( under.length );
  });

});
