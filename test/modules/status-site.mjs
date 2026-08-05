import { expect } from 'chai';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPlan, readNetworks, DOCUMENTS } from '../../scripts/status-build.mjs';
import { fixturePolicy, patchDebugHtml, networksPatch, PAGES_MAX_BYTES, minifiedSize } from '../../scripts/status/plan.mjs';
import { wireSize } from '../../scripts/status/wire-fixtures.mjs';
import { enumerateRefs, markupRefs, networkRefs } from '../../scripts/status/refs.mjs';
import { goldenTitles } from '../../scripts/status/goldens-page.mjs';
import { newestMtime, SOURCE_EXT } from '../../scripts/status/repo-state.mjs';
import { mkdtempSync, writeFileSync, utimesSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

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
  7. a `src/` import added to a status module -> 'reaches neither v3/ nor src/'

Control 6 is worth recording because of what it did *not* fail.  It was aimed
at 'nothing in the plan exceeds the Pages per-file cap', and that spec stayed
green — because both oversized fixtures load from their bucket, so no planned
file is anywhere near the cap and the loop had nothing to discriminate on.
The measured on-disk spec was added in response, and control 6 fails it.  The
cap loop is kept as a forward guard, labelled as one.

Control 7 did the same thing on its first run, and for the same class of
reason: the import walker matched `import x from './y.mjs'` but not the
side-effect form `import './y.mjs'`, so the deliberately-added dependency was
walked straight past.  The walker handles both now.  *Read the enumerator, not
the percentage.*
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
  it( 'prefers the binary wire form whenever it fits', function(){
    // the maintainer's call (2026-08-05), taken after the sizes were measured:
    // binary is the smaller file at rest and it removes the off-site bucket
    expect( fixturePolicy( { bytes: 35_804_679, minifiedBytes: 35_804_679, wireBytes: 9_961_472 } ) )
      .to.equal( 'wire' );
  } );

  it( 'falls back to minifying when the encoding does not fit either', function(){
    expect( fixturePolicy( { bytes: 33_173_439, minifiedBytes: 21_500_000, wireBytes: 30e6 } ) )
      .to.equal( 'jsonmin' );
    expect( fixturePolicy( { bytes: 33_173_439, minifiedBytes: 21_500_000 } ) ).to.equal( 'jsonmin' );
  } );

  it( 'omits a fixture no encoding brings under the cap, rather than shipping a broken deploy', function(){
    expect( fixturePolicy( { bytes: 35_804_679, minifiedBytes: 35_804_679, wireBytes: 30e6 } ) )
      .to.equal( 'omit' );
  } );

  it( 'copies a small already-compact fixture', function(){
    expect( fixturePolicy( { bytes: 1000, minifiedBytes: 1000 } ) ).to.equal( 'copy' );
  } );

  it( 'the binary encoding really does take the largest fixture under the cap, measured', function(){
    // The load-bearing measurement of this change: `ndex-x-large` is 34.1 MiB
    // of already-compact JSON — minifying gains nothing — and the wire form
    // takes it to ~9.5 MiB.  That single number is why the deploy needs no
    // off-site bucket.
    this.timeout?.( 180000 );

    const path = join( ROOT, 'debug', 'network-ndex-x-large.json' );

    if( !existsSync( path ) || !existsSync( join( ROOT, 'build', 'cytoscape.cjs.js' ) ) ){ return; }

    const onDisk = statSync( path ).size;
    const encoded = wireSize( ROOT, path );

    expect( onDisk, 'the fixture no longer exceeds the cap; this spec has nothing to prove' )
      .to.be.greaterThan( PAGES_MAX_BYTES );
    expect( encoded, 'the fixture could not be encoded at all' ).to.be.a( 'number' );
    expect( encoded ).to.be.at.most( PAGES_MAX_BYTES );
    // and it must be a real reduction, not a rounding win
    expect( encoded ).to.be.lessThan( onDisk / 2 );
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
          : op.kind === 'wire' ? wireSize( ROOT, op.from )
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
        .to.match( /^https:\/\/(img\.shields\.io|github\.com|raw\.githubusercontent\.com)\// );
    }
  } );

  it( 'fetches no fixture from off-site — the whole point of the binary form', function(){
    // Until the fixtures were re-encoded, the two oversized NDEx networks
    // loaded from an R2 bucket, which meant a CORS rule and an upload someone
    // had to remember.  The binary form put every fixture under the cap, so the
    // deploy is self-contained; this asserts it stays that way.
    expect( refs.filter( r => r.external && r.source.startsWith( 'runtime:' ) ).map( r => r.url ) )
      .to.eql( [] );
  } );

  it( 'loads no external resource beyond the readme badges', function(){
    // the count matters as much as the hosts: this is the whole list, and it
    // should stay short.  If it grows, someone added a CDN.
    const external = [ ...new Set(
      refs.filter( r => r.external && r.kind === 'resource' ).map( r => new URL( r.url ).host )
    ) ].sort();

    expect( external ).to.eql( [
      'github.com',               // the CI status badge
      'img.shields.io',           // the rest of README.md's badges
      'raw.githubusercontent.com' // the logo
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

  it( 'names every encoded fixture in a manifest the source harness does not have', function(){
    const plan = buildPlan( { root: ROOT, gzip: false } );
    const config = plan.ops.find( op => op.to === 'debug/status-config.js' );
    const wired = plan.ops.filter( op => op.kind === 'wire' );

    expect( config.text ).to.match( /DEBUG_FIXTURE_WIRE\s*=/ );

    for( const op of wired ){
      const base = op.to.split( '/' ).pop();

      expect( config.text, `${base} was encoded but is not in the manifest` ).to.include( base );
    }

    // `npm run watch` has no manifest, so it reads the JSON unchanged.  The
    // comment in init.js quotes the assignment, so comments come out first — a
    // naive regex over the raw source matches the comment and fails a correct
    // file.
    const init = readFileSync( join( ROOT, 'debug', 'init.js' ), 'utf8' )
      .split( '\n' ).filter( l => !l.trim().startsWith( '//' ) ).join( '\n' );

    expect( init, 'debug/init.js assigns the manifest; local dev would read the wire form' )
      .to.not.match( /DEBUG_FIXTURE_WIRE\s*=[^=]/ );
    expect( init, 'debug/init.js no longer reads the manifest' ).to.match( /DEBUG_FIXTURE_WIRE/ );
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

  it( 'every network the source declares is either copied, encoded or omitted', function(){
    // no fourth state: a network that is none of these renders nothing and says
    // nothing, which is exactly round 42's failure
    const plan = buildPlan( { root: ROOT, gzip: false } );
    const networks = readNetworks( ROOT );
    const written = new Set( plan.ops.map( op => op.to ) );

    for( const [ id, def ] of Object.entries( networks ) ){
      if( def.generated || def.url == null ){ continue; }

      const json = def.url.startsWith( '../' ) ? def.url.replace( /^\.\.\//, '' ) : `debug/${def.url}`;
      const encoded = `${json.replace( /\.json$/, '' )}.cyge`;

      expect( written.has( json ) || written.has( encoded ),
        `${id} is neither copied, encoded nor omitted` ).to.equal( true );
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

describe( 'status site: the stale-bundle check', function(){
  it( 'counts only files that compile into the bundle', function(){
    // Found by a real false alarm: `benchmark:renderer` warned that the bundle
    // was stale when the newest thing under src/ was `src/README.md`, a docs
    // file this repo's process rules require touching on nearly every commit.
    // A staleness warning that fires on every docs edit is one nobody reads —
    // and this module had inherited the same bug by writing the same walk.
    const dir = mkdtempSync( join( tmpdir(), 'cy-stale-' ) );

    mkdirSync( join( dir, 'nested' ) );
    writeFileSync( join( dir, 'code.mts' ), 'x' );
    writeFileSync( join( dir, 'nested', 'shader.wgsl' ), 'x' );
    writeFileSync( join( dir, 'README.md' ), 'x' );

    utimesSync( join( dir, 'code.mts' ), new Date( 1000 ), new Date( 1000 ) );
    utimesSync( join( dir, 'nested', 'shader.wgsl' ), new Date( 2000 ), new Date( 2000 ) );
    // the doc is the newest thing by far, and must not count
    utimesSync( join( dir, 'README.md' ), new Date( 9000 ), new Date( 9000 ) );

    expect( newestMtime( dir ) ).to.equal( 2000 ); // new Date( 2000 ) is 2000 ms since epoch

    rmSync( dir, { recursive: true, force: true } );
  } );

  it( 'recognises the extensions that actually build', function(){
    for( const name of [ 'a.mts', 'a.ts', 'a.mjs', 'a.js', 'shader.wgsl', 'data.json' ] ){
      expect( SOURCE_EXT.test( name ), `${name} should count as source` ).to.equal( true );
    }

    for( const name of [ 'README.md', 'notes.txt', 'image.png' ] ){
      expect( SOURCE_EXT.test( name ), `${name} should not count as source` ).to.equal( false );
    }
  } );
} );

describe( 'status site: what the builder needs', function(){
  it( 'reaches neither v3/ nor src/, so a Cloudflare build needs only the root install', function(){
    // The site is built from a git checkout by Cloudflare, which runs `npm ci`
    // at the root and nothing else.  `cd v3 && npm install` is a requirement of
    // the *test* suite (benchmark/graph.mjs -> v3/src/test.mjs -> heap), and if
    // the status build ever acquired that dependency the deploy would fail with
    // a module-not-found nobody would connect to this.  Measured, not asserted:
    // the precedent is `test/modules/import-graph.mjs`.
    const seen = new Set();

    const walk = file => {
      if( seen.has( file ) ){ return; }

      seen.add( file );

      let source;

      try {
        source = readFileSync( file, 'utf8' );
      } catch{
        return;
      }

      // two forms, and the second is the blind spot the control found: a
      // side-effect import (`import './x.mjs';`) has no `from`, so a pattern
      // built only around `from` walks straight past it
      for( const m of source.matchAll( /^import\s[^;]*?from\s+'(\.[^']+)'/gm ) ){
        walk( resolve( dirname( file ), m[ 1 ] ) );
      }

      for( const m of source.matchAll( /^import\s+'(\.[^']+)'/gm ) ){
        walk( resolve( dirname( file ), m[ 1 ] ) );
      }
    };

    walk( join( ROOT, 'scripts', 'status-build.mjs' ) );

    const outside = [ ...seen ].filter( f => /[/\\](v3|src)[/\\]/.test( f ) );

    expect( seen.size, 'the walker stopped finding modules' ).to.be.at.least( 10 );
    expect( outside, `the status build now imports:\n  ${outside.join( '\n  ' )}` ).to.eql( [] );
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
