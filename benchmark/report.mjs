// Benchmark report runner: runs the gpu suites, collects their JSON
// (via bench-run.mjs's BENCH_JSON hook) and renders a self-contained
// single-page HTML report.
//
//   npm run benchmark:gpu:report                # quick profile (~minutes)
//   npm run benchmark:gpu:report -- --all       # + every standalone suite
//   npm run benchmark:gpu:report -- --full      # 2k/20k/200k matrix (long)
//   npm run benchmark:gpu:report -- --renderer  # + the browser renderer bench
//                                               #   (render-bench.mjs: built
//                                               #   bundles + real GPU)
//   npm run benchmark:gpu:report -- --suite traversal
//   npm run benchmark:gpu:report -- --render-only results/results-<ts>.json
//
// Results land in benchmark/results/ (gitignored): a timestamped
// results-*.json plus report.html rendered from it.  --render-only
// re-renders an existing results file without re-running anything.

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderReport } from './report-html.mjs';

const DIR = dirname( fileURLToPath( import.meta.url ) );
const RESULTS_DIR = join( DIR, 'results' );

// -- job tables --------------------------------------------------------------
// Three tiers, and the reason for the split is the reason open call 7
// existed (round 33.10): before this, six suites were standalone and
// absent from every table, so the report understated what had been
// measured.  Now every suite is addressable from here — but the *quick*
// profile stays quick, because a default profile nobody waits for is
// worth as little as a report that shows half the suite.
//
//   quick  — the v3-vs-v4 micro/scenario suites at their default scale
//   --all  — + every standalone suite (the subsystem sweeps, which are
//            mostly gpu-only and each take minutes)
//   --full — + the 2k/20k/200k matrix
//
// `--suite <substr>` filters any of them, which is how a single sweep
// gets run and re-rendered on its own.
const QUICK_JOBS = [
  { file: 'index.mjs',          n: 2000 },
  { file: 'materializers.mjs',  n: 2000 },
  { file: 'mutators.mjs',       n: 2000 },
  { file: 'scenarios.mjs',      n: 2000 },
  { file: 'traversal.mjs',      n: 2000 },
  { file: 'algorithms.mjs',     n: 2000 },
  { file: 'algorithms.mjs',     n: 500 },  // adds the superlinear ops the 2k run gates off
  { file: 'mappers.mjs',        n: 2000 }
];

// Full extras: the 20k/200k matrix.  At 200k, mutators/scenarios must run
// one group per process (their headers document why: eight v3 instances of
// a 200k graph exceed the heap), so the tables below enumerate BENCH_OP
// substrings — these must track the group names in the suite files.
const MUTATOR_OPS = [ 'select', 'hide', 'lock', 'positions(obj)', 'positions(fn)', 'shift', 'data', 'remove' ];
const SCENARIO_OPS = [ 'explore', 'select-all', 'drag', 'edit', 'refresh' ];

// The standalone sweeps.  Most are gpu-only (no v3 counterpart exists for
// compaction, the store internals, the curve premium, ...), which the
// report already renders as individual labelled rows rather than as
// dumbbells against a 1x line that would mean nothing for them.
const STANDALONE_JOBS = [
  { file: 'layouts.mjs',        n: 2000 },
  { file: 'style.mjs',          n: 2000 },
  // round 36.5: the same getters through the built bundle, where the
  // tsx `__name` wrapper does not exist.  Needs `npm run build` first
  // and warns when the bundle is older than src/.
  { file: 'style-bundle.mjs',   n: 2000 },
  { file: 'load.mjs',           n: 2000 },
  { file: 'spatial.mjs',        n: 2000 },
  { file: 'data.mjs',           n: 2000 },
  { file: 'events.mjs',         n: 2000 },
  { file: 'store.mjs',          n: 2000 },
  { file: 'surface.mjs',        n: 2000 },
  { file: 'compaction.mjs',     n: 20000 },
  { file: 'compound.mjs',       n: 2000 },
  { file: 'curves.mjs',         n: 2000 },
  { file: 'labels.mjs',         n: 20000 },
  { file: 'transitions.mjs',    n: 2000 },
  { file: 'geometry-tween.mjs', n: 2000 },
  { file: 'algorithms.mjs',     n: 500 }   // the superlinear + clustering tier
];

const FULL_JOBS = [
  { file: 'materializers.mjs', n: 20000 },
  { file: 'materializers.mjs', n: 200000 },
  { file: 'mappers.mjs',       n: 20000 },
  { file: 'mappers.mjs',       n: 200000 },
  { file: 'traversal.mjs',     n: 20000 },
  { file: 'mutators.mjs',      n: 20000 },
  ...MUTATOR_OPS.map( op => ( { file: 'mutators.mjs', n: 200000, op } ) ),
  { file: 'scenarios.mjs',     n: 20000 },
  ...SCENARIO_OPS.map( op => ( { file: 'scenarios.mjs', n: 200000, op } ) )
];

// -- cli ---------------------------------------------------------------------
const argv = process.argv.slice( 2 );

function flagValue( name ){
  const i = argv.indexOf( name );

  return i >= 0 ? argv[ i + 1 ] : null;
}

const full = argv.includes( '--full' );
const all = argv.includes( '--all' );
const withRenderer = argv.includes( '--renderer' );
const suiteFilter = flagValue( '--suite' );
const sceneFilter = flagValue( '--scene' ); // forwarded to the renderer bench
const renderOnly = flagValue( '--render-only' );

function git( ...args ){
  const r = spawnSync( 'git', args, { cwd: DIR, encoding: 'utf8' } );

  return r.status === 0 ? r.stdout.trim() : null;
}

function render( results, resultsPath ){
  const htmlPath = join( RESULTS_DIR, 'report.html' );

  writeFileSync( htmlPath, renderReport( results ) );
  console.log( `\nreport:  ${htmlPath}` );
  console.log( `results: ${resultsPath}` );
}

mkdirSync( RESULTS_DIR, { recursive: true } );

if( renderOnly ){
  const path = resolve( renderOnly );

  render( JSON.parse( readFileSync( path, 'utf8' ) ), path );
  process.exit( 0 );
}

// -- run ---------------------------------------------------------------------
let jobs = [ ...QUICK_JOBS ];

if( all ){ jobs = [ ...jobs, ...STANDALONE_JOBS ]; }
if( full ){ jobs = [ ...jobs, ...FULL_JOBS ]; }

if( suiteFilter != null ){ jobs = jobs.filter( j => j.file.includes( suiteFilter ) ); }

// the browser-side renderer benchmark (render-bench.mjs: real GPU + built
// bundles required) appends its own scene jobs to the same results file
if( withRenderer ){ jobs = [ ...jobs, { file: 'render-bench.mjs', browser: true } ]; }

if( jobs.length === 0 ){
  console.error( `no jobs match --suite ${suiteFilter}` );
  process.exit( 1 );
}

const startedAt = Date.now();
const results = { meta: null, jobs: [] };
const failures = [];

for( const [ i, job ] of jobs.entries() ){
  const label = job.browser ? `${job.file} (browser)` : `${job.file} @ N=${job.n}${job.op ? ` op=${job.op}` : ''}`;
  const jsonPath = join( RESULTS_DIR, `.job-${i}.json` );

  console.log( `\n[${i + 1}/${jobs.length}] ${label}` );

  const t0 = Date.now();
  const args = job.browser
    ? [ '--import', 'tsx', join( DIR, job.file ), '--json', jsonPath,
      ...( sceneFilter != null ? [ '--scene', sceneFilter ] : [] ) ]
    : [ '--import', 'tsx', join( DIR, job.file ) ];
  const r = spawnSync( process.execPath, args, {
    cwd: resolve( DIR, '..' ),
    stdio: 'inherit',
    env: job.browser ? process.env : {
      ...process.env,
      BENCH_N: String( job.n ),
      ...( job.op != null ? { BENCH_OP: job.op } : {} ),
      BENCH_JSON: jsonPath
    }
  } );
  const durationMs = Date.now() - t0;

  if( r.status !== 0 || !existsSync( jsonPath ) ){
    console.error( `  FAILED (exit ${r.status})` );
    failures.push( { job: label, exitCode: r.status } );
    continue;
  }

  const data = JSON.parse( readFileSync( jsonPath, 'utf8' ) );

  rmSync( jsonPath );

  if( job.browser ){
    // a jobs bundle: one job per scene, durations set scene-side
    results.jobs.push( ...data.jobs );
    failures.push( ...( data.failures ?? [] ) );
  } else {
    results.jobs.push( { ...data, durationMs } );
  }
}

const context = results.jobs[ 0 ]?.context ?? {};

results.meta = {
  date: new Date( startedAt ).toISOString(),
  commit: git( 'rev-parse', '--short', 'HEAD' ),
  branch: git( 'rev-parse', '--abbrev-ref', 'HEAD' ),
  nodeVersion: process.version,
  cpu: context.cpu ?? null,
  arch: context.arch ?? null,
  runtime: context.runtime ?? null,
  profile: full ? 'full' : all ? 'all' : 'quick',
  suiteFilter,
  totalMs: Date.now() - startedAt,
  failures
};

const stamp = results.meta.date.replace( /[:.]/g, '-' );
const resultsPath = join( RESULTS_DIR, `results-${stamp}.json` );

writeFileSync( resultsPath, JSON.stringify( results, null, 2 ) );
render( results, resultsPath );

if( failures.length > 0 ){
  console.error( `\n${failures.length} job(s) failed: ${failures.map( f => f.job ).join( '; ' )}` );
}

console.log( `total: ${( results.meta.totalMs / 60000 ).toFixed( 1 ) } min (${basename( resultsPath )})` );
