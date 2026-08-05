// Round 46.5: build the status site.
//
//   npm run status                assemble into ./status
//   npm run status:all            build the bundles and the docs model first
//
// The site is a live preview of the v4 branch, deployed to Cloudflare Pages.
// It is not the documentation site — round 46 owns that — and every page says
// so in its footer.
//
// Structure: `buildPlan()` decides what the site contains and is pure (stat
// calls only); `executePlan()` is the only thing that writes.  That split is
// what lets `test/modules/status-site.mjs` check the *intended* output without
// copying 48 MiB of fixtures first.
//
// Options:
//   --out <dir>           output root                              [status]
//   --skip <a,b,...>      parts to skip: debug, benchmark, docs, api, goldens
//   --no-gzip             skip bundle gzip measurement (the only slow step)
//   --no-wire             ship fixtures as JSON instead of the binary wire form
//   --strict              exit 1 if any part is unavailable
//   --dry-run             print the plan, write nothing
//   --json                print the plan as JSON
import {
  readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync, statSync
} from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

import { esc, fmtBytes } from './theme.mjs';
import { generate } from './docs-generate.mjs';
import { loadPublished } from './benchmark-publish.mjs';
import { page, NAV } from './status/shell.mjs';
import { renderMarkdown, tocHtml } from './status/markdown.mjs';
import { repoState } from './status/repo-state.mjs';
import { planDebug, write, copy, PAGES_MAX_BYTES } from './status/plan.mjs';
import { encodeFixture } from './status/wire-fixtures.mjs';
import { apiPage, API_CSS } from './status/api-page.mjs';
import { planGoldens, GOLDENS_CSS } from './status/goldens-page.mjs';
import { planBenchmarks } from './status/bench-pages.mjs';
import { indexPage, INDEX_CSS } from './status/index-page.mjs';

const ROOT = resolve( dirname( fileURLToPath( import.meta.url ) ), '..' );

/** The documents the site publishes, in the order the index lists them. */
export const DOCUMENTS = [
  { file: 'PLAN.md', to: 'plan.html', nav: 'plan', title: 'Development record',
    blurb: 'Every round, its plan, what it found and the controls that proved it.' },
  { file: 'src/README.md', to: 'design.html', nav: 'design', title: 'Scope and design decisions',
    blurb: 'What v4 does, what it deliberately does not, and why.' },
  { file: 'MIGRATING.md', to: 'migrating.html', nav: null, title: 'Migration guide',
    blurb: 'v3 to v4, with the property tables measured against both libraries.' },
  { file: 'CHANGELOG.md', to: 'changelog.html', nav: null, title: 'Changelog',
    blurb: 'The 4.0 summary.' },
  { file: 'README.md', to: 'readme.html', nav: null, title: 'Readme',
    blurb: 'The repository front page.' },
  { file: 'AGENTS.md', to: 'agents.html', nav: null, title: 'Contributor guide',
    blurb: 'The conventions and the hard-won testing rules.' },
  { file: 'CONTRIBUTING.md', to: 'contributing.html', nav: null, title: 'Contributing',
    blurb: 'How to propose a change.' }
];

const DOC_PAGE_BY_FILE = new Map( DOCUMENTS.map( d => [ d.file, d.to ] ) );

/** Read `debug/networks.js`, which is a plain script declaring `var networks`. */
export function readNetworks( root ){
  const src = readFileSync( join( root, 'debug', 'networks.js' ), 'utf8' );
  const ctx = createContext( { module: undefined } );

  runInContext( src, ctx );

  return ctx.networks;
}

/**
 * Decide the whole site.  Pure apart from `stat`/`readFile`.
 *
 * @returns `{ ops, parts, warnings, state }`
 */
export function buildPlan( { root = ROOT, skip = new Set(), gzip = true, wireEnabled = true, now = Date.now() } = {} ){
  const ops = [];
  const warnings = [];
  const parts = [];
  const state = repoState( root, { now, gzip } );
  const sha = state.commit.pushed ? state.commit.sha : null;
  const mdCtx = { root, sha, pageFor: href => DOC_PAGE_BY_FILE.get( href ) ?? null };

  // -- the documents --
  if( !skip.has( 'docs' ) ){
    for( const doc of DOCUMENTS ){
      const path = join( root, doc.file );

      if( !existsSync( path ) ){
        warnings.push( `${doc.file} is missing` );
        continue;
      }

      const md = readFileSync( path, 'utf8' );
      const { html, toc, paths } = renderMarkdown( md, mdCtx );
      const unresolved = paths.filter( p => p.resolved == null );

      if( unresolved.length > 0 ){
        // AGENTS.md's own prescription: extract every rooted path and test it.
        // Reported, not fatal — the page marks them and the build says how many
        warnings.push( `${doc.file}: ${unresolved.length} documented path(s) do not resolve: `
          + unresolved.slice( 0, 5 ).map( p => p.path ).join( ', ' ) );
      }

      ops.push( write( doc.to, page( {
        title: `${doc.title} — cytoscape.js v4`,
        body: html,
        toc: tocHtml( toc ),
        active: doc.nav,
        state
      } ) ) );

      parts.push( {
        id: doc.to, title: doc.title, href: `/${doc.to}`, blurb: esc( doc.blurb ),
        available: true, reason: null,
        badges: [ `${toc.length} sections`, fmtBytes( Buffer.byteLength( md ) ) ].filter( v => v != null )
      } );
    }
  }

  // -- the harness --
  if( !skip.has( 'debug' ) ){
    const networks = readNetworks( root );
    const debug = planDebug( { root, networks, wireEnabled } );

    ops.push( ...debug.ops );
    warnings.push( ...debug.warnings );

    const live = Object.keys( networks ).length - ( debug.dropped?.length ?? 0 );

    parts.unshift( {
      id: 'debug', title: 'Debug harness', href: '/debug/index.html',
      blurb: 'The development harness on the WebGPU renderer, with hand-authored v4 stylesheets. '
        + '<strong>Needs a WebGPU browser.</strong>',
      available: debug.available, reason: debug.reason,
      badges: debug.available ? [ `${live} networks` ] : []
    } );
  }

  // -- the API reference --
  if( !skip.has( 'api' ) ){
    try {
      const model = generate();
      const { html, toc, members } = apiPage( model, mdCtx );

      ops.push( write( 'api.html', page( {
        title: 'API reference — cytoscape.js v4',
        body: html, toc: tocHtml( toc ), active: 'api', state
      } ).replace( '</style>', `${API_CSS}</style>` ) ) );

      parts.push( {
        id: 'api', title: 'API reference', href: '/api.html',
        blurb: 'Generated from the JSDoc on <code>src/</code>. A preview of round 46\'s site.',
        available: true, reason: null, badges: [ `${members} members` ]
      } );
    } catch( err ){
      warnings.push( `api: ${err?.message ?? err}` );
      parts.push( { id: 'api', title: 'API reference', href: '/api.html', blurb: 'Generated from the JSDoc.',
        available: false, reason: `the docs model could not be generated: ${err?.message ?? err}` } );
    }
  }

  // -- the benchmarks --
  if( !skip.has( 'benchmark' ) ){
    const bench = planBenchmarks( { runs: loadPublished(), now } );

    ops.push( ...bench.ops );
    ops.push( write( 'benchmark/index.html', page( {
      title: 'Benchmarks — cytoscape.js v4',
      body: bench.html, active: 'benchmark', state
    } ) ) );

    parts.push( {
      id: 'benchmark', title: 'Benchmarks', href: '/benchmark/index.html',
      blurb: 'v4 against v3, with the machine each run was measured on.',
      available: bench.available, reason: bench.reason,
      badges: bench.available
        ? [ `${bench.count} run${bench.count === 1 ? '' : 's'}`, bench.age ].filter( v => v != null )
        : []
    } );
  }

  // -- the goldens --
  if( !skip.has( 'goldens' ) ){
    const goldens = planGoldens( { root } );

    ops.push( ...goldens.ops );
    ops.push( write( 'goldens.html', page( {
      title: 'Visual goldens — cytoscape.js v4',
      body: goldens.html, active: 'goldens', state
    } ).replace( '</style>', `${GOLDENS_CSS}</style>` ) ) );

    warnings.push( ...goldens.orphans.map( o => `goldens: ${o}` ) );

    parts.push( {
      id: 'goldens', title: 'Visual goldens', href: '/goldens.html',
      blurb: 'What the renderer currently produces for each pinned scene.',
      available: goldens.available, reason: goldens.reason,
      badges: goldens.available ? [ `${goldens.count} images` ] : []
    } );
  }

  // -- the landing page, last: it reports on every part above --
  ops.push( write( 'index.html', page( {
    title: 'cytoscape.js v4 — status',
    body: indexPage( { state, parts } ),
    active: 'index', state, prose: false
  } ).replace( '</style>', `${INDEX_CSS}</style>` ) ) );

  ops.push( write( 'version.json', `${JSON.stringify( { ...state, parts, warnings }, null, 2 )}\n` ) );
  ops.push( write( '_headers', HEADERS ) );

  return { ops, parts, warnings, state };
}

const HEADERS = `/*
  X-Content-Type-Options: nosniff
/build/*
  Cache-Control: public, max-age=31536000, immutable
/v3/debug/webgl/*
  Cache-Control: public, max-age=31536000, immutable
/goldens/*
  Cache-Control: public, max-age=31536000, immutable
/*.html
  Cache-Control: public, max-age=0, must-revalidate
`;

/** Write a plan. Returns the per-op byte sizes, for the size report. */
export function executePlan( ops, out ){
  const written = [];

  for( const op of ops ){
    if( op.kind === 'omit' ){ continue; }

    const dest = join( out, op.to );

    mkdirSync( dirname( dest ), { recursive: true } );

    if( op.kind === 'write' ){
      writeFileSync( dest, op.text );
    } else if( op.kind === 'jsonmin' ){
      writeFileSync( dest, JSON.stringify( JSON.parse( readFileSync( op.from, 'utf8' ) ) ) );
    } else if( op.kind === 'wire' ){
      writeFileSync( dest, encodeFixture( ROOT, op.from ) );
    } else {
      copyFileSync( op.from, dest );
    }

    written.push( { to: op.to, bytes: statSync( dest ).size } );
  }

  return written;
}

// -- CLI --

function flagValue( name, argv ){
  const i = argv.indexOf( name );

  return i >= 0 ? argv[ i + 1 ] ?? null : null;
}

async function main( argv ){
  const out = resolve( flagValue( '--out', argv ) ?? join( ROOT, 'status' ) );
  const skip = new Set( ( flagValue( '--skip', argv ) ?? '' ).split( ',' ).filter( s => s !== '' ) );
  const dryRun = argv.includes( '--dry-run' );
  const strict = argv.includes( '--strict' );
  const asJson = argv.includes( '--json' );
  const gzip = !argv.includes( '--no-gzip' );

  const { ops, parts, warnings, state } = buildPlan( { root: ROOT, skip, gzip, wireEnabled: !argv.includes( '--no-wire' ) } );

  if( asJson ){
    console.log( JSON.stringify( { ops: ops.map( o => ( { kind: o.kind, to: o.to, from: o.from ?? null } ) ), parts, warnings }, null, 2 ) );

    return;
  }

  console.log( `status site: ${ops.filter( o => o.kind !== 'omit' ).length} file(s) -> ${relative( ROOT, out ) || out}` );

  for( const w of warnings ){ console.warn( `  warning: ${w}` ); }

  for( const op of ops.filter( o => o.kind === 'omit' ) ){
    console.warn( `  omitted: ${op.to} — ${op.reason}` );
  }

  if( dryRun ){
    for( const op of ops ){ console.log( `  ${op.kind.padEnd( 8 )} ${op.to}` ); }
    console.log( '\n--dry-run: nothing written' );

    return;
  }

  rmSync( out, { recursive: true, force: true } );

  const written = executePlan( ops, out );
  const total = written.reduce( ( n, w ) => n + w.bytes, 0 );
  const tooBig = written.filter( w => w.bytes > PAGES_MAX_BYTES );

  console.log( `\n${written.length} file(s), ${fmtBytes( total )}` );
  console.log( `commit ${state.commit.short ?? '?'} (${state.branch ?? '?'})${state.dirty.count > 0 ? `, ${state.dirty.count} uncommitted` : ''}` );

  for( const w of tooBig ){
    // the one constraint that turns a green build into a broken deploy
    console.error( `  OVER THE 25 MiB PAGES CAP: ${w.to} (${fmtBytes( w.bytes )})` );
  }

  const unavailable = parts.filter( p => !p.available );

  for( const p of unavailable ){ console.warn( `  unavailable: ${p.title} — ${p.reason}` ); }

  console.log( `\nserve it: npm run status:serve` );

  if( tooBig.length > 0 ){ process.exit( 1 ); }
  if( strict && ( unavailable.length > 0 || warnings.length > 0 ) ){ process.exit( 1 ); }
}

if( import.meta.filename === process.argv[ 1 ] ){ await main( process.argv.slice( 2 ) ); }

export { copy, NAV };
