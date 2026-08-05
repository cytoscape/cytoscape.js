import { expect } from 'chai';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPlan, readNetworks, DOCUMENTS } from '../../scripts/status-build.mjs';
import { fixturePolicy, patchDebugHtml, networksPatch, PAGES_MAX_BYTES, minifiedSize } from '../../scripts/status/plan.mjs';
import { enumerateRefs, markupRefs, networkRefs } from '../../scripts/status/refs.mjs';
import { goldenTitles } from '../../scripts/status/goldens-page.mjs';

const ROOT = resolve( dirname( fileURLToPath( import.meta.url ) ), '..', '..' );

/*
Round 46.5: the status site, checked as a *plan* rather than as a built tree.

`buildPlan()` is pure — stat calls only — so these specs decide what the site
would contain without copying 30 MiB of fixtures.  That is the whole reason the
build is split that way.

Three of these encode failures this repo has already had:

  - **the runtime-asset check**.  Round 42 verified every `src`/`href` in six
    harness pages and four of the debug page's networks were 404ing anyway,
    because their URLs live in JS and go to `fetch()`.  So the check reads the
    *emitted* `networks.js` through `node:vm` and enumerates what the runtime
    will ask for.
  - **the 25 MiB cap**.  It is the one constraint that turns a green local
    build into a broken deploy, and nothing else in the repo would notice.
  - **the closed transform list**.  "Ported verbatim" is a claim this repo has
    been burned by (round 43.4), and a diff answers it in seconds.

Controls run while writing.  Each failed the spec named:
  1. `network-em-web.json` dropped from the plan -> 'every url the runtime asks
     for is in the plan'
  2. the `networks.js` patch suppressed, leaving the omitted network in the
     dropdown -> same spec, naming ndex-x-large
  3. the mirror flattened (`debug/` written to `harness/`) -> 'the mirror is
     path-invariant'
  4. a third edit added to `index.html` -> 'the harness page carries exactly
     two edits'
  5. `fixturePolicy` returning 'copy' for an oversized file -> 'omits an
     oversized fixture with no remote'
  6. the `jsonmin` branch removed -> 'minifies a pretty-printed fixture'

Control 6 is worth recording because of what it did *not* fail.  It was aimed
at 'nothing in the plan exceeds the Pages per-file cap', and that spec stayed
green — because both oversized fixtures load from their bucket, so no planned
file is anywhere near the cap and the loop had nothing to discriminate on.
The measured on-disk spec was added in response, and control 6 fails it.  The
cap loop is kept as a forward guard, labelled as one.
*/

describe( 'status site: the plan', function(){
  let plan;

  before( function(){
    // gzip off: it is the only slow step and nothing here reads the numbers
    plan = buildPlan( { root: ROOT, gzip: false } );
  } );

  it( 'plans a non-trivial site', function(){
    // the guard every audit in this repo carries: a planner that stops finding
    // parts must not read as "all parts fine"
    expect( plan.ops.length ).to.be.at.least( 30 );
    expect( plan.parts.length ).to.be.at.least( 8 );
  } );

  it( 'never writes two files to the same place', function(){
    const seen = new Map();

    for( const op of plan.ops ){
      expect( seen.has( op.to ), `${op.to} is written twice (${seen.get( op.to )} and ${op.kind})` )
        .to.equal( false );
      seen.set( op.to, op.kind );
    }
  } );

  it( 'never writes outside the output root', function(){
    for( const op of plan.ops ){
      expect( op.to, `${op.to} escapes the output directory` ).to.not.match( /(^|\/)\.\.(\/|$)/ );
      expect( op.to.startsWith( '/' ), `${op.to} is absolute` ).to.equal( false );
    }
  } );

  it( 'copies only files that exist', function(){
    for( const op of plan.ops ){
      if( op.kind !== 'copy' && op.kind !== 'jsonmin' ){ continue; }

      expect( existsSync( op.from ), `${op.from} is planned but missing` ).to.equal( true );
    }
  } );

  it( 'emits every document the site advertises', function(){
    const written = new Set( plan.ops.map( op => op.to ) );

    for( const doc of DOCUMENTS ){
      if( !existsSync( join( ROOT, doc.file ) ) ){ continue; }

      expect( written.has( doc.to ), `${doc.file} -> ${doc.to} is not in the plan` ).to.equal( true );
    }

    expect( written.has( 'index.html' ) ).to.equal( true );
    expect( written.has( 'version.json' ) ).to.equal( true );
    expect( written.has( '_headers' ) ).to.equal( true );
  } );
} );

describe( 'status site: the Cloudflare Pages per-file cap', function(){
  it( 'sends anything with a remote source to that source, whatever its size', function(){
    // the maintainer's call (2026-08-05): the two NDEx fixtures load from the
    // bucket they came from rather than being carried
    expect( fixturePolicy( { bytes: 40e6, minifiedBytes: 40e6, remoteUrl: 'https://x/y.json' } ) )
      .to.equal( 'remote' );
  } );

  it( 'minifies a pretty-printed fixture, which is what puts ndex-large under the cap', function(){
    expect( fixturePolicy( { bytes: 33_173_439, minifiedBytes: 21_500_000 } ) ).to.equal( 'jsonmin' );
  } );

  it( 'omits an oversized fixture with no remote rather than shipping a broken deploy', function(){
    expect( fixturePolicy( { bytes: 35_804_679, minifiedBytes: 35_804_679 } ) ).to.equal( 'omit' );
  } );

  it( 'copies a small already-compact fixture', function(){
    expect( fixturePolicy( { bytes: 1000, minifiedBytes: 1000 } ) ).to.equal( 'copy' );
  } );

  it( 'minifying really does take ndex-large under the cap, measured on disk', function(){
    // The load-bearing measurement of this whole round, and the reason the
    // fixture policy has a `jsonmin` branch at all: the v3 fixtures are
    // pretty-printed, and the page only ever calls `res.json()`, so the
    // whitespace is unobservable.  31.6 -> 20.5 MiB.
    //
    // It reads a 31.6 MB file, which is why it is one spec and not a loop.
    const path = join( ROOT, 'v3', 'debug', 'webgl', 'network-ndex-large.json' );

    if( !existsSync( path ) ){ return; } // v3 fixtures absent; nothing to claim

    const onDisk = statSync( path ).size;
    const minified = minifiedSize( path );

    expect( onDisk, 'the fixture is no longer over the cap; this spec has nothing to prove' )
      .to.be.greaterThan( PAGES_MAX_BYTES );
    expect( minified ).to.be.at.most( PAGES_MAX_BYTES );
  } );

  it( 'nothing in the plan exceeds the Pages per-file cap', function(){
    // A forward guard, and honest about it: today no planned file is within
    // 20% of the cap, because both oversized fixtures load from their bucket
    // instead.  Removing `jsonmin` does *not* fail this spec — the control
    // proved that, and the spec above is the discriminating one.  This exists
    // so that a fixture added later, or a remote that stops being used, fails
    // here rather than at deploy time.
    const plan = buildPlan( { root: ROOT, gzip: false } );

    for( const op of plan.ops ){
      if( op.kind === 'omit' ){ continue; }

      const bytes = op.kind === 'write' ? Buffer.byteLength( op.text )
        : op.kind === 'jsonmin' ? minifiedSize( op.from )
          : statSync( op.from ).size;

      expect( bytes, `${op.to} is ${( bytes / 1048576 ).toFixed( 1 )} MiB, over the 25 MiB cap` )
        .to.be.at.most( PAGES_MAX_BYTES );
    }
  } );
} );

describe( 'status site: what the runtime asks for', function(){
  let plan;
  let refs;

  before( function(){
    plan = buildPlan( { root: ROOT, gzip: false } );
    refs = enumerateRefs( plan.ops );
  } );

  it( 'enumerates markup and runtime urls both', function(){
    expect( refs.some( r => r.source === 'markup' ) ).to.equal( true );
    expect( refs.some( r => r.source.startsWith( 'runtime:' ) ) ).to.equal( true );
  } );

  it( 'every url the runtime asks for is in the plan', function(){
    const written = new Set( plan.ops.filter( op => op.kind !== 'omit' ).map( op => op.to ) );
    const broken = refs
      .filter( r => !r.external && !written.has( r.resolved ) )
      .map( r => `${r.page} -> ${r.url} (${r.source})` );

    expect( broken, `unreachable references:\n  ${broken.join( '\n  ' )}` ).to.eql( [] );
  } );

  it( 'lists every off-site url rather than letting one be added silently', function(){
    // An external reference is legitimate here, but each host must be a
    // decision rather than an accident.  Three classes are on this list:
    //
    //   - `pub-*.r2.dev` — the fixture bucket the oversized NDEx networks load
    //     from, which is the point of the whole remote-fixture mechanism;
    //   - `img.shields.io` and `raw.githubusercontent.com` — README.md's
    //     badges and logo.  These are the site's only *runtime* external
    //     requests, and they are the repo's front page rendered as it is
    //     written rather than a dependency this site chose;
    //   - the rest are links a reader clicks, not resources a page loads.
    //
    // `http://localhost:3333/` is AGENTS.md telling a reader to run the dev
    // server; it is prose.
    const external = [ ...new Set(
      refs.filter( r => r.external && r.kind === 'resource' ).map( r => r.url )
    ) ];

    for( const url of external ){
      expect( url, `${url} is an off-site resource this site has not declared` )
        .to.match( /^https:\/\/(pub-[a-z0-9]+\.r2\.dev|img\.shields\.io|github\.com|raw\.githubusercontent\.com)\// );
    }
  } );

  it( 'loads no external resource beyond the fixture bucket and the readme badges', function(){
    // the count matters as much as the hosts: this is the whole list, and it
    // should stay short.  If it grows, someone added a CDN.
    const external = [ ...new Set(
      refs.filter( r => r.external && r.kind === 'resource' ).map( r => new URL( r.url ).host )
    ) ].sort();

    expect( external ).to.eql( [
      'github.com',                                  // the CI status badge
      'img.shields.io',                              // the rest of README.md's badges
      'pub-835fc16db602427ba8b9a874e4754257.r2.dev', // the oversized NDEx fixtures
      'raw.githubusercontent.com'                    // the logo
    ] );
  } );

  it( 'a network the build omitted is removed from the dropdown, not left to 404', function(){
    // round 42's four silent 404s: an option that fails is worse than one that
    // is absent, and the page said nothing either way
    const networksJs = plan.ops.find( op => op.to === 'debug/networks.js' );
    const written = new Set( plan.ops.filter( op => op.kind !== 'omit' ).map( op => op.to ) );
    const omitted = plan.ops.filter( op => op.kind === 'omit' );

    for( const op of omitted ){
      // whatever was omitted must not still be reachable from networks.js
      const still = networkRefs( networksJs.text )
        .filter( n => !n.remoteUrl )
        .some( n => `debug/${n.url}`.replace( 'debug/../', '' ) === op.to );

      expect( still, `${op.to} was omitted but is still in the dropdown` ).to.equal( false );
    }

    expect( written.size ).to.be.greaterThan( 0 );
  } );

  it( 'the mirror is path-invariant', function(){
    // the property that makes "no source file is edited" true: every mirrored
    // asset sits at the same path inside the site as in the repo, so
    // `debug/index.html`'s `../build/cytoscape.umd.js` resolves by construction
    const plan2 = buildPlan( { root: ROOT, gzip: false } );
    const umd = plan2.ops.find( op => op.to === 'build/cytoscape.umd.js' );

    expect( umd, 'the bundle is not mirrored at build/cytoscape.umd.js' ).to.not.equal( undefined );

    const fixture = plan2.ops.find( op => op.to.startsWith( 'v3/debug/webgl/' ) );

    expect( fixture, 'no v3 fixture is mirrored at its repo path' ).to.not.equal( undefined );
    expect( relativeFrom( 'debug/index.html', '../build/cytoscape.umd.js' ) ).to.equal( 'build/cytoscape.umd.js' );
  } );
} );

/** Resolve a page-relative url the way a browser would. */
function relativeFrom( page, url ){
  const parts = join( dirname( page ), url ).split( '/' );

  return parts.join( '/' );
}

describe( 'status site: the harness mirror', function(){
  it( 'the harness page carries exactly two edits', function(){
    // "ported verbatim" is a claim this repo has been burned by; a diff answers
    // it in seconds.  The two edits are the livereload stub (an http:// script
    // an https deploy blocks) and the fixture-source flag.
    const source = readFileSync( join( ROOT, 'debug', 'index.html' ), 'utf8' );
    const patched = patchDebugHtml( source );

    const sourceLines = source.split( '\n' );
    const patchedLines = patched.split( '\n' );
    const added = patchedLines.filter( l => !sourceLines.includes( l ) );
    const removed = sourceLines.filter( l => !patchedLines.includes( l ) );

    expect( added.map( l => l.trim() ) ).to.eql( [ '<script src="status-config.js"></script>' ] );
    expect( removed ).to.eql( [] );
  } );

  it( 'stubs livereload rather than leaving a blocked http:// script', function(){
    const plan = buildPlan( { root: ROOT, gzip: false } );
    const stub = plan.ops.find( op => op.to === 'debug/livereload-setup.js' );

    expect( stub.kind ).to.equal( 'write' );
    // the stub's prose may mention http://; what must be gone is the injection
    expect( stub.text, 'the stub still creates a script element' ).to.not.match( /createElement|appendChild/ );
    expect( stub.text, 'the stub still names the livereload port' ).to.not.match( /35729/ );
  } );

  it( 'tells the page to prefer remote fixtures, which local development never does', function(){
    const plan = buildPlan( { root: ROOT, gzip: false } );
    const config = plan.ops.find( op => op.to === 'debug/status-config.js' );

    expect( config.text ).to.match( /DEBUG_FIXTURE_SOURCE\s*=\s*'remote'/ );
    // and the source harness must not set it, or `npm run watch` reaches the network
    // Comments are stripped first.  init.js *reads* the flag with `===` and
    // its comment quotes the assignment the status build makes — a naive
    // regex over the raw source matches the comment and fails a correct file.
    const init = readFileSync( join( ROOT, 'debug', 'init.js' ), 'utf8' )
      .split( '\n' ).filter( l => !l.trim().startsWith( '//' ) ).join( '\n' );

    expect( init, 'debug/init.js assigns the flag; `npm run watch` would reach the network' )
      .to.not.match( /DEBUG_FIXTURE_SOURCE\s*=[^=]/ );
    expect( init, 'debug/init.js no longer reads the flag' ).to.match( /DEBUG_FIXTURE_SOURCE\s*===/ );
  } );

  it( 'appends to networks.js rather than rewriting it', function(){
    // `var networks` is in scope after the source's trailing export hook, so
    // the patch is plain assignment and no regex has to understand the file
    const plan = buildPlan( { root: ROOT, gzip: false } );
    const emitted = plan.ops.find( op => op.to === 'debug/networks.js' ).text;
    const source = readFileSync( join( ROOT, 'debug', 'networks.js' ), 'utf8' );

    expect( emitted.startsWith( source ) ).to.equal( true );
  } );

  it( 'the patch names every dropped network and nothing else', function(){
    expect( networksPatch( [ 'ndex-x-large' ] ) ).to.match( /delete networks\["ndex-x-large"\];/ );
    expect( networksPatch( [] ) ).to.not.match( /delete networks/ );
  } );

  it( 'every network the source declares is either mirrored, remote or omitted', function(){
    // no third state: a network that is none of these renders nothing and says
    // nothing, which is exactly round 42's failure
    const plan = buildPlan( { root: ROOT, gzip: false } );
    const networks = readNetworks( ROOT );
    const written = new Set( plan.ops.map( op => op.to ) );

    for( const [ id, def ] of Object.entries( networks ) ){
      if( def.generated || def.url == null ){ continue; }

      const to = def.url.startsWith( '../' ) ? def.url.replace( /^\.\.\//, '' ) : `debug/${def.url}`;
      const accountedFor = written.has( to ) || def.remoteUrl != null;

      expect( accountedFor, `${id} is neither mirrored nor remote nor omitted` ).to.equal( true );
    }
  } );
} );

describe( 'status site: internal links', function(){
  it( 'every link between generated pages lands on a page the build emits', function(){
    const plan = buildPlan( { root: ROOT, gzip: false } );
    const written = new Set( plan.ops.filter( op => op.kind !== 'omit' ).map( op => op.to ) );
    const broken = [];

    for( const op of plan.ops ){
      if( op.kind !== 'write' || !op.to.endsWith( '.html' ) ){ continue; }

      for( const { url } of markupRefs( op.text ) ){
        if( /^[a-z]+:/i.test( url ) || url.startsWith( '//' ) ){ continue; }

        const target = url.startsWith( '/' ) ? url.slice( 1 )
          : join( dirname( op.to ), url ).split( '/' ).join( '/' );

        if( !written.has( target.split( '#' )[ 0 ] ) ){ broken.push( `${op.to} -> ${url}` ); }
      }
    }

    expect( broken, `broken links:\n  ${broken.join( '\n  ' )}` ).to.eql( [] );
  } );

  it( 'every page is self-contained: no external stylesheet, script or font', function(){
    const plan = buildPlan( { root: ROOT, gzip: false } );

    for( const op of plan.ops ){
      if( op.kind !== 'write' || !op.to.endsWith( '.html' ) ){ continue; }
      if( op.to.startsWith( 'debug/' ) ){ continue; } // the harness is a mirror, not ours

      expect( op.text, `${op.to} loads an external script` ).to.not.match( /<script[^>]+src="https?:/ );
      expect( op.text, `${op.to} loads an external stylesheet` ).to.not.match( /<link[^>]+rel="stylesheet"/ );
    }
  } );
} );

describe( 'status site: the goldens gallery', function(){
  it( 'captions every golden with the test it came from', function(){
    // a rename that changes the PNG but not the call site (or the reverse)
    // orphans one silently, and this gallery is the only thing that would show it
    const spec = readFileSync( join( ROOT, 'playwright-tests', 'visual.spec.js' ), 'utf8' );
    const titles = goldenTitles( spec );
    const plan = buildPlan( { root: ROOT, gzip: false } );
    const pngs = plan.ops.filter( op => op.to.startsWith( 'goldens/' ) );

    expect( pngs.length ).to.be.at.least( 40 );
    expect( titles.size ).to.equal( pngs.length );
  } );

  it( 'reads the enclosing test title, not the nearest string', function(){
    const titles = goldenTitles( [
      "  test( 'golden: arrowhead shapes (round 10)', async ( { page }, testInfo ) => {",
      "    const uri = await exportPng( page );",
      "    checkGolden( 'arrow-shapes', uri, testInfo );",
      '  } );'
    ].join( '\n' ) );

    expect( titles.get( 'arrow-shapes' ) ).to.equal( 'golden: arrowhead shapes (round 10)' );
  } );
} );
