// Measures how much of the v4 GPU prototype's *error contract* the Node
// suite actually runs (round 30; see PLAN.md's round-30 plan).
//
// v4 fails loudly by decided design — an unknown sheet key, an unknown style
// property, an unknown query key and an unknown boundingBox() option all
// throw, on the reasoning that a typo must not silently do nothing — and a
// throw nothing has ever executed is a contract nobody has checked. This
// script finds every `throw new` in src/gpu and reports which ones the Node
// suite reaches.
//
// Since round 37.1 it is a **gate**, at the floor the fifth design sitting
// chose: zero tolerance for a Node-reachable site the suite never runs. The
// call it was waiting on (PLAN.md's "Open calls for the maintainer", item 8)
// was taken on 2026-08-04, by which point round 36.4 had already finished the
// browser tier, so the reading was 0 and the gate held the day it was written.
//
// The two classification lists below are what make a zero-tolerance gate
// honest, so they are **maintained allowlists** rather than one-off notes:
// every entry names a real `throw new` line and carries a reason, and the gate
// fails when one stops doing either. That check exists because the keys are
// `file:line` and so move when the code above them moves — round 34 inserted
// two methods into graph-store.mts and the SHAPE_MASK entry silently stopped
// matching. Under a gate, a stale entry is worse than noise: it would quietly
// re-classify whatever line it now lands on.
//
// Two footguns are baked in, both learned the hard way in round 30:
//
//   1. Raw NODE_V8_COVERAGE offsets do not line up with the .mts sources —
//      tsx transpiles before V8 sees the file, so a byte-offset mapping is
//      fiction. The first measurement this replaced reported 47 dead sites
//      including two with throw specs since round 13. Coverage is therefore
//      collected through the test runner's own source-mapped lcov output.
//   2. Line-level (`DA:`) data on a multi-line throw body is sound; the
//      function-level (`FN:`/`FNDA:`) records misattribute one-line arrow
//      functions badly enough to be useless. Nothing here reads them.
//
// Usage:
//   node scripts/gpu-throw-coverage.mjs             # run the suite, gate
//   node scripts/gpu-throw-coverage.mjs --verbose   # list every dead site
//   node scripts/gpu-throw-coverage.mjs --lcov cov.lcov   # reuse a report
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath( new URL( '..', import.meta.url ) );
const GPU_DIR = join( ROOT, 'src/gpu' );

/**
 * Directories whose throws the Node suite *cannot* reach: they need a GPU
 * device, a canvas or a pointer. Their contract is pinned in the `webgpu`
 * Playwright project instead (round 30.2), so they are reported separately
 * rather than counted as gaps.
 */
export const BROWSER_ONLY = [ 'src/gpu/render/', 'src/gpu/interact/', 'src/gpu/gpu-context.mts' ];

/**
 * Throws that exist to make an internal invariant loud and are unreachable
 * from any input a caller can supply. Each is listed with the reason, so the
 * list stays a decision rather than a silence.
 *
 * A **maintained allowlist** since round 37.1: this is the gate's only escape
 * hatch, so `gateFailures` checks that every entry still names a real throw
 * site and still carries a reason.
 */
export const UNREACHABLE = {
  'src/gpu/wire.mts:68':
    'big-endian platform guard — every supported platform is little-endian',
  'src/gpu/store/graph-store.mts:2226':
    'SHAPE_MASK field invariant — fires only if a shape id is added without widening the field',

  // Round 36.4 classified the browser-only tier the same way 30.4
  // classified the Node one: four of the seven unpinned sites are
  // reachable and now have specs in the `webgpu` project; these three
  // are not, and saying so is better than a spec that fakes its
  // precondition.
  'src/gpu/gpu-context.mts:38':
    'shadowed: index.mts\'s _attachFn checks navigator.gpu and then '
    + 'constructs the Renderer synchronously, whose ctor calls init() '
    + 'whose first statement reads navigator.gpu again — nothing can run '
    + 'between the two, so no caller can pass one and fail the other',
  'src/gpu/render/column-mirror.mts:113':
    'column spec/group mismatch — an internal invariant; every caller '
    + 'passes a ColumnId the mirror was built from, and no public input '
    + 'chooses the id',
  'src/gpu/render/gpu-tween.mts:408':
    'geometry write-kind invariant — barred one layer up by the '
    + 'all-or-nothing eligibility rule (round 25.1), which keeps a lane/'
    + 'padding/fontSize write off the device by refusing the whole '
    + 'animation; the guard exists so a future eligibility bug is loud'
};

// Keys here are `file:line`, which **moves when the file above the site
// moves**.  Round 34 inserted two methods into graph-store.mts and the
// SHAPE_MASK entry silently stopped matching, which surfaced as this
// script reporting a Node-reachable dead site and as a failing spec in
// test/modules/gpu-throw-coverage.mjs — the right way round, but worth
// knowing: after moving code, re-run this script rather than assuming
// the classification survived.  Since 37.1 the gate says so directly:
// an entry that no longer names a throw site fails the build in its own
// right, rather than only through the site it stopped exempting.

/**
 * Sites the line-level data reads as covered but that the Node suite cannot
 * run — the measure's known error, kept explicit rather than silently
 * inflating the covered tally.
 *
 * The cause: inside a module-level arrow const, every body line can be
 * attributed to the module-evaluation count rather than to the call, so the
 * whole body reads as run-once-per-import. `exportScale` is such a const, and
 * the throw's line reports the same count as its neighbours and as the
 * declaration.
 *
 * How this list was calibrated, and why it is one entry long: of the 14 throw
 * sites under BROWSER_ONLY, exactly two read as covered, and one of those
 * (`GlyphBuffer.set`) genuinely is — `test/gpu-label-render.mjs` drives it
 * with a mock device. The other is this. Treat the tally as a lower bound on
 * dead sites, not an exact count.
 *
 * Maintained on the same terms as `UNREACHABLE` since round 37.1 — an entry
 * here suppresses a *covered* reading, which is the direction that hides work.
 */
export const MISATTRIBUTED = {
  'src/gpu/render/renderer.mts:144':
    'inside the module-level exportScale const; its body reads as module-eval count'
};

/** Every .mts file under src/gpu, repo-relative. */
const gpuFiles = ( dir = GPU_DIR, out = [] ) => {
  for( const name of readdirSync( dir ) ){
    const p = join( dir, name );

    if( statSync( p ).isDirectory() ){ gpuFiles( p, out ); }
    else if( name.endsWith( '.mts' ) ){ out.push( relative( ROOT, p ) ); }
  }

  return out;
};

/** Collect source-mapped line counts by running the Node suite under coverage. */
const collectLcov = () => {
  const dir = mkdtempSync( join( tmpdir(), 'gpu-throw-cov-' ) );
  const out = join( dir, 'cov.lcov' );

  try {
    execFileSync( process.execPath, [
      '--import', 'tsx',
      '--import', './test/node-test-setup.mjs',
      '--enable-source-maps',
      '--experimental-test-coverage',
      '--test-reporter=lcov',
      `--test-reporter-destination=${out}`,
      '--test', 'test/!(types-*|node-test-setup).mjs'
    ], { cwd: ROOT, stdio: [ 'ignore', 'ignore', 'inherit' ], maxBuffer: 256 * 1024 * 1024 } );
  } catch {
    // a failing suite still produces a usable report; the caller sees the
    // failures from the normal test run, not from here
  }

  const text = readFileSync( out, 'utf8' );

  rmSync( dir, { recursive: true, force: true } );

  return text;
};

/** file (repo-relative) -> Map( 1-based line -> execution count ) */
const parseLcov = text => {
  const perFile = new Map();
  let cur = null;

  for( const line of text.split( '\n' ) ){
    if( line.startsWith( 'SF:' ) ){
      cur = relative( ROOT, resolve( ROOT, line.slice( 3 ).trim() ) );

      if( !perFile.has( cur ) ){ perFile.set( cur, new Map() ); }
    } else if( line.startsWith( 'DA:' ) && cur != null ){
      const [ ln, count ] = line.slice( 3 ).split( ',' ).map( Number );
      const counts = perFile.get( cur );

      counts.set( ln, Math.max( counts.get( ln ) ?? 0, count ) );
    }
  }

  return perFile;
};

/**
 * Audit the error contract's coverage.
 *
 * @param lcovText — an lcov report; the Node suite is run under coverage when
 *   omitted
 * @returns per-site records plus the three tallies (`covered`, `dead`,
 *   `browser`), where `dead` counts only Node-reachable sites
 */
export function audit( lcovText ){
  const perFile = parseLcov( lcovText ?? collectLcov() );
  const sites = [];

  for( const file of gpuFiles() ){
    const counts = perFile.get( file );
    const lines = readFileSync( join( ROOT, file ), 'utf8' ).split( '\n' );

    lines.forEach( ( text, i ) => {
      if( !text.includes( 'throw new' ) ){ return; }

      const line = i + 1;
      // the throw's own line, else the next instrumented line of its body
      let count = counts?.get( line );

      for( let j = line + 1; count === undefined && j <= line + 3; j++ ){ count = counts?.get( j ); }

      const at = `${file}:${line}`;
      const browser = BROWSER_ONLY.some( prefix => file.startsWith( prefix ) );
      const unreachable = UNREACHABLE[ at ];
      const misattributed = MISATTRIBUTED[ at ];

      sites.push( {
        file, line, text: text.trim(), browser, unreachable, misattributed,
        covered: misattributed != null ? false : count == null ? null : count > 0
      } );
    } );
  }

  const dead = sites.filter( s => s.covered === false && !s.browser && s.unreachable == null );

  return {
    sites,
    covered: sites.filter( s => s.covered === true ).length,
    dead,
    // `unreachable` wins over `browser`, matching how --verbose labels a
    // site: a browser-only file can still hold a guard no input reaches,
    // and round 36.4 classified three of them.  Counting a site in both
    // tallies made them sum past the site total, which is how this was
    // noticed.
    browser: sites.filter( s => s.covered !== true && s.browser && s.unreachable == null ).length,
    unreachable: sites.filter( s => s.covered !== true && s.unreachable != null ).length
  };
}

/**
 * The round-37.1 gate: what would fail the build, as human-readable lines.
 *
 * Two kinds of failure, and the second is the reason the first can be trusted.
 * A Node-reachable throw the suite never runs is an unchecked contract — the
 * thing the whole measurement exists to find. A stale or reasonless allowlist
 * entry is an unchecked *exemption*: `UNREACHABLE`/`MISATTRIBUTED` are keyed by
 * `file:line`, so an insertion above a site silently re-points its entry at
 * whatever line now sits there, exempting the wrong throw and (worse) reading
 * as a pass.
 *
 * @param result — an {@link audit} result
 * @param allowlists — the `[ name, entries ]` pairs to validate, defaulting to
 *   the two this module exports; passed explicitly by the specs that check the
 *   validation itself, since a stale entry cannot be staged any other way
 * @returns one string per failure; an empty array means the gate passes
 */
export function gateFailures( result, allowlists = [
  [ 'UNREACHABLE', UNREACHABLE ], [ 'MISATTRIBUTED', MISATTRIBUTED ]
] ){
  const failures = [];
  const known = new Set( result.sites.map( s => `${s.file}:${s.line}` ) );

  for( const s of result.dead ){
    failures.push( `never run by the Node suite: ${s.file}:${s.line}  ${s.text.slice( 0, 80 )}` );
  }

  for( const [ name, list ] of allowlists ){
    for( const [ at, reason ] of Object.entries( list ) ){
      if( !known.has( at ) ){
        failures.push( `${name} exempts ${at}, which is not a throw site — did the code above it move?` );
      } else if( typeof reason !== 'string' || reason.trim() === '' ){
        failures.push( `${name}'s entry for ${at} carries no reason` );
      }
    }
  }

  return failures;
}

if( process.argv[ 1 ] && import.meta.url === pathToFileURL( process.argv[ 1 ] ).href ){
  const flag = process.argv.indexOf( '--lcov' );
  const result = audit( flag < 0 ? undefined : readFileSync( process.argv[ flag + 1 ], 'utf8' ) );

  console.log( `throw sites in src/gpu: ${result.sites.length}` );
  console.log( `  run by the Node suite: ${result.covered}` );
  console.log( `  browser-only (pinned in the webgpu project): ${result.browser}` );
  console.log( `  unreachable by design: ${result.unreachable}` );
  console.log( `  NODE-REACHABLE AND NEVER RUN: ${result.dead.length}` );

  if( process.argv.includes( '--verbose' ) ){
    for( const s of result.sites.filter( x => x.covered !== true ) ){
      const why = s.unreachable != null ? 'unreachable' : s.browser ? 'browser' : 'DEAD';

      console.log( `  ${why.padEnd( 12 )} ${s.file}:${s.line}  ${s.text.slice( 0, 90 )}` );
    }
  }

  const failures = gateFailures( result );

  if( failures.length > 0 ){
    console.error( `\nthrow-coverage gate failed (${failures.length}):` );

    for( const f of failures ){ console.error( `  ${f}` ); }

    console.error(
      '\nAdd a spec that fires the guard (a message assertion when several '
      + 'guards share a method), or — if no caller can reach it — classify it '
      + 'in UNREACHABLE with the reason.'
    );

    process.exitCode = 1;
  }
}
