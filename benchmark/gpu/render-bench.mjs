// Renderer benchmark runner: drives render-bench.html in Chromium via
// Playwright, replaying the interactions behind PLAN.md's recorded
// renderer numbers — continuous-pan steady state (fit-all / zoomed-in
// 20× / far-zoom, labels off and on), hover-while-panning pick latency,
// and one-shot costs (init, columnar init, full png export) — for the v3
// canvas renderer and the v4 WebGPU renderer on the same scenes.
//
//   npm run benchmark:gpu:renderer                 # all scenes
//   npm run benchmark:gpu:renderer -- --scene gen  # filter by key/label
//   npm run benchmark:gpu:renderer -- --layout     # live layout mode
//                                                  # (+ --layout-uncapped
//                                                  #  for full baseline runs)
//   node --import tsx benchmark/gpu/render-bench.mjs --json out.json
//                                                  # jobs bundle only
//                                                  # (report.mjs --renderer)
//
// Needs built UMD bundles (npm run build) and a real GPU adapter — the
// run aborts rather than silently benchmarking a software rasterizer.
// Metrics: wall ms per rendered frame (vsync-bound — both sides floor at
// the display refresh when fast), gpu 'device' rows from timestamp-query
// (the unbounded cost), pick latency percentiles, one-shot init/export.
// The adaptive render scale is pinned to 1; dpr 2, 1280×800.

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import { chromium } from '@playwright/test';
import { toStats, oneShotStats } from './render-stats.mjs';
import { renderReport } from './report-html.mjs';

const DIR = dirname( fileURLToPath( import.meta.url ) );
const ROOT = resolve( DIR, '../..' );
const RESULTS_DIR = join( DIR, 'results' );

const SCENES = [
  { key: 'gen-25k', label: 'generated 25k × 50k', page: { n: 25000, m: 50000 } },
  { key: 'gen-100k', label: 'generated 100k × 300k', page: { n: 100000, m: 300000 } },
  { key: 'ndex', label: 'ndex-x-large (19.6k × 465k)', page: { url: '/debug/webgpu/network-ndex-x-large.json' } },
  // round 12a: bundled-bezier pan cost — edges come in parallel pairs so
  // every edge actually curves (a lone bezier edge renders straight)
  { key: 'gen-25k-curved', label: 'generated 25k × 50k curved (bezier pairs)', page: { n: 25000, m: 50000, parallel: 2, curved: true } },
  { key: 'gen-25k-compound', label: 'generated 25k × 50k compound (1k parents)', page: { n: 25000, m: 50000, compound: 1000 } },
  // round 15.7: icon-per-type background images through the url mapper
  { key: 'gen-25k-images', label: 'generated 25k × 50k images (icon-per-type)', page: { n: 25000, m: 50000, images: true } }
];

// --layout: instead of the pan scenarios, run the round-18 force layout
// live on the gpu side (fps + wall time to convergence) and v3's cose as
// the classic baseline — layout quality differs by design; the numbers
// compare the *interactive experience* of a live layout at scale.
//
// Layout runs are double-bounded by default, like test timeouts:
// the page asks the layout to stop after LAYOUT_CAP_MS (reported as a
// floor value), and if even that can't land — cose only yields between
// iterations, and a single iteration at 100k nodes is ~50 min — the
// runner bails at LAYOUT_BAIL_MS, force-closes the hung page and reports
// "> bail".  --layout-uncapped removes both bounds to measure a full run.
const LAYOUT_MODE = process.argv.includes( '--layout' );
const LAYOUT_UNCAPPED = process.argv.includes( '--layout-uncapped' );
const LAYOUT_CAP_MS = 30000; // polite stop — reports the measured floor
const LAYOUT_BAIL_MS = 60000; // hard bail — must exceed the cap + one iteration

const PAN_VIEWS = [
  [ 'fit-all', 'frame: pan fit-all' ],
  [ 'zoomed-in', 'frame: pan zoomed-in 20×' ],
  [ 'far-zoom', 'frame: pan far-zoom ÷8' ]
];
const LABEL_VIEWS = PAN_VIEWS.slice( 0, 2 ); // fit-all + zoomed-in, as PLAN.md's label table

// -- cli ---------------------------------------------------------------------
const argv = process.argv.slice( 2 );
const flagValue = name => { const i = argv.indexOf( name ); return i >= 0 ? argv[ i + 1 ] : null; };
const jsonOut = flagValue( '--json' );
const sceneFilter = flagValue( '--scene' );
const headed = argv.includes( '--headed' );

// -- preflight ---------------------------------------------------------------
const BUNDLES = [ 'build/cytoscape.umd.js', 'build/cytoscape-gpu.umd.js' ].map( p => join( ROOT, p ) );

for( const b of BUNDLES ){
  if( !existsSync( b ) ){
    console.error( `missing ${b} — run \`npm run build\` first` );
    process.exit( 1 );
  }
}

{ // stale-bundle warning (the PLAN-documented footgun, in mtime form)
  const newestSrc = readdirSync( join( ROOT, 'src' ), { recursive: true } )
    .map( f => { try { return statSync( join( ROOT, 'src', f ) ).mtimeMs; } catch { return 0; } } )
    .reduce( ( a, b ) => Math.max( a, b ), 0 );

  if( BUNDLES.some( b => statSync( b ).mtimeMs < newestSrc ) ){
    console.warn( 'warning: build/ bundles are older than src/ — results may reflect stale code (npm run build)' );
  }
}

// -- static server (ephemeral port; no dependence on a possibly-stale :3333) --
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png'
};

function serve( root ){
  return new Promise( ( resolveSrv ) => {
    const srv = createServer( ( req, res ) => {
      const path = resolve( root, '.' + new URL( req.url, 'http://x' ).pathname );

      if( !path.startsWith( root ) ){ res.writeHead( 403 ); res.end(); return; }

      try {
        const body = readFileSync( path );

        res.writeHead( 200, { 'content-type': MIME[ extname( path ) ] ?? 'application/octet-stream' } );
        res.end( body );
      } catch {
        res.writeHead( 404 ); res.end();
      }
    } );

    srv.listen( 0, '127.0.0.1', () => resolveSrv( srv ) );
  } );
}

// -- run ----------------------------------------------------------------------
const startedAt = Date.now();
const git = ( ...args ) => {
  const r = spawnSync( 'git', args, { cwd: DIR, encoding: 'utf8' } );

  return r.status === 0 ? r.stdout.trim() : null;
};

let scenes = SCENES;

if( sceneFilter != null ){
  scenes = SCENES.filter( s => s.key.includes( sceneFilter ) || s.label.includes( sceneFilter ) );
}

if( scenes.length === 0 ){
  console.error( `no scenes match --scene ${sceneFilter}` );
  process.exit( 1 );
}

const server = await serve( ROOT );
const port = server.address().port;
const browser = await chromium.launch( {
  channel: 'chromium', // new headless: real GPU adapters (Metal on macOS)
  headless: !headed,
  args: [
    '--enable-unsafe-webgpu',
    // Linux headless needs the ANGLE-on-Vulkan compositor for WebGPU
    // canvases to present (and for the hardware Vulkan adapter to be
    // offered at all) — same platform-gated flags as playwright.config.js
    ...( process.platform === 'linux'
      ? [ '--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan' ]
      : [] )
  ]
} );
const context = await browser.newContext( { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 } );

let page;
let pageError = null;

const openPage = async () => {
  page = await context.newPage();
  page.on( 'pageerror', err => { pageError = err; } );

  if( process.env.DEBUG ){ page.on( 'console', msg => console.log( `  [page] ${msg.text()}` ) ); }

  await page.goto( `http://127.0.0.1:${port}/benchmark/gpu/render-bench.html` );
};

// After a layout bail the page's main thread is wedged in a synchronous
// layout iteration, so no in-page cleanup can run: close the hung page
// from the browser process and start a fresh one.
const recyclePage = async () => {
  await page.close( { runBeforeUnload: false } ).catch( () => {} );
  await openPage();
};

await openPage();

const adapter = await page.evaluate( async () => {
  const a = await navigator.gpu?.requestAdapter();

  if( a == null ){ return null; }

  const i = a.info ?? {};

  return { vendor: i.vendor ?? '', architecture: i.architecture ?? '', description: i.description ?? '' };
} );

if( adapter == null ){
  console.error( 'no WebGPU adapter available — renderer benchmarks need a real GPU (try --headed)' );
  await browser.close(); server.close();
  process.exit( 1 );
}

const adapterLabel = [ adapter.vendor, adapter.architecture || adapter.description ]
  .filter( s => s !== '' ).join( ' ' ) || 'unknown adapter';

if( /swiftshader|llvmpipe|software/i.test( JSON.stringify( adapter ) ) ){
  console.warn( `warning: software adapter (${adapterLabel}) — numbers are not comparable to hardware runs` );
}

console.log( `adapter: ${adapterLabel} · dpr 2 · 1280×800 · render scale pinned to 1` );

const NOTE = `Wall frame times are vsync-bound (both sides floor at the display refresh when fast); ` +
  `“gpu (device)” table rows are GPU-pass time via timestamp-query — the unbounded cost metric. ` +
  `init/export rows are one-shot timings. Adapter: ${adapterLabel}; dpr 2; 1280×800; adaptive render scale pinned to 1.`;

const failures = [];
const jobs = [];

const step = ( fn, ...args ) => page.evaluate(
  ( [ name, a ] ) => window.bench[ name ]( ...a ), [ fn, args ]
);

function pushBench( groups, name, benchName, stats ){
  if( stats == null ){ return; }
  if( !groups.has( name ) ){ groups.set( name, [] ); }

  groups.get( name ).push( { name: benchName, stats } );
}

for( const scene of scenes ){
  const t0 = Date.now();

  console.log( `\nscene: ${scene.label}` );

  try {
    const counts = await step( 'loadScene', scene.page );
    const groups = new Map();

    for( const side of [ 'v3', 'gpu' ] ){
      const benchSide = side; // bench names: 'v3' | 'gpu'

      // labels off: init, the three pan views, export, pick (gpu)
      const init = await step( 'createInstance', side, false );

      console.log( `  ${side} init ${init.initMs.toFixed( 0 )} ms` );
      pushBench( groups, 'init: create + ready', benchSide, oneShotStats( init.initMs ) );

      // --layout (round 18.5): live force to convergence instead of the
      // pan scenarios (v3 runs cose — the classic baseline experience)
      if( LAYOUT_MODE ){
        // Two bounds unless --layout-uncapped (see the flag comment up
        // top): the in-page cap asks the layout to stop at LAYOUT_CAP_MS,
        // and the runner-side bail covers the case where the page can't
        // even do that (a single synchronous iteration longer than the
        // cap — cose at 100k measured ~52 min/iteration).
        let bailed = false;
        const run = step( 'forceLayoutScenario', LAYOUT_UNCAPPED ? 0 : LAYOUT_CAP_MS )
          .catch( err => { if( !bailed ){ throw err; } return null; } );
        let bailTimer = null;
        const r = LAYOUT_UNCAPPED ? await run : await Promise.race( [
          run,
          new Promise( res => { bailTimer = setTimeout( () => res( 'bail' ), LAYOUT_BAIL_MS ); } )
        ] );

        clearTimeout( bailTimer );

        if( r === 'bail' ){
          bailed = true;
          console.log( `  ${side} live layout: > ${( LAYOUT_BAIL_MS / 1000 ).toFixed( 0 )} s — ` +
            `bailed (--layout-uncapped measures the full run)` );
          pushBench( groups, 'layout: live run to convergence', benchSide, oneShotStats( LAYOUT_BAIL_MS ) );
          await recyclePage();
          await step( 'loadScene', scene.page );
          continue;
        }

        console.log( `  ${side} live layout: ${r.wallMs.toFixed( 0 )} ms to ` +
          ( r.timedOut ? 'wall-clock cap (floor value — did not converge)' : 'converge' ) +
          ( r.fps != null ? `, ${r.fps.toFixed( 0 )} fps` : '' ) );
        pushBench( groups, 'layout: live run to convergence', benchSide, oneShotStats( r.wallMs ) );

        await step( 'destroyInstance' );
        continue;
      }

      for( const [ view, groupName ] of PAN_VIEWS ){
        const r = await step( 'panScenario', view );

        console.log( `  ${side} ${view}: ${r.frames} frames, wall p50 ${median( r.wallMs ).toFixed( 1 )} ms` );
        pushBench( groups, groupName, benchSide, toStats( r.wallMs ) );

        if( side === 'gpu' ){ pushBench( groups, groupName, 'gpu (device)', toStats( r.gpuMs ) ); }
      }

      const exp = await step( 'exportPng' );

      pushBench( groups, 'export: png full (≤2048 px)', benchSide, oneShotStats( exp.exportMs ) );

      if( side === 'gpu' ){
        const pick = await step( 'pickScenario' );

        console.log( `  gpu pick: ${pick.latenciesMs.length} picks, p50 ${median( pick.latenciesMs ).toFixed( 1 )} ms (${pick.nulls} background, ${pick.deferrals ?? 0} ring-deferred)` );
        pushBench( groups, 'pick: hover while panning', 'gpu', toStats( pick.latenciesMs ) );
      }

      await step( 'destroyInstance' );

      // labels on: init + the two label pan views
      const initL = await step( 'createInstance', side, true );

      pushBench( groups, 'init: create + ready (labels)', benchSide, oneShotStats( initL.initMs ) );

      for( const [ view, groupName ] of LABEL_VIEWS ){
        const r = await step( 'panScenario', view );

        console.log( `  ${side} ${view} labels: wall p50 ${median( r.wallMs ).toFixed( 1 )} ms` );
        pushBench( groups, `${groupName} (labels)`, benchSide, toStats( r.wallMs ) );

        if( side === 'gpu' ){ pushBench( groups, `${groupName} (labels)`, 'gpu (device)', toStats( r.gpuMs ) ); }
      }

      await step( 'destroyInstance' );
    }

    // gpu-only: the columnar-form init
    const initC = await step( 'createInstance', 'gpu', false, 'columnar' );

    pushBench( groups, 'init: columnar form (gpu-only)', 'gpu', oneShotStats( initC.initMs ) );
    pushBench( groups, 'init: columnar form (gpu-only)', 'convert (toColumnarElements)', oneShotStats( initC.convertMs ) );
    await step( 'destroyInstance' );

    if( pageError != null ){ throw pageError; }

    // fixed group order: frames, pick, one-shots
    const order = [
      ...PAN_VIEWS.map( ( [ , g ] ) => g ),
      ...LABEL_VIEWS.map( ( [ , g ] ) => `${g} (labels)` ),
      'pick: hover while panning',
      'init: create + ready', 'init: create + ready (labels)',
      'init: columnar form (gpu-only)', 'export: png full (≤2048 px)'
    ];

    jobs.push( {
      suite: `render — ${scene.label}`,
      n: counts.nodes,
      op: null,
      context: { arch: `${os.arch()}-${process.platform}`, runtime: 'chromium', cpu: `${os.cpus()[ 0 ]?.model ?? 'unknown cpu'} · GPU: ${adapterLabel}` },
      note: NOTE,
      durationMs: Date.now() - t0,
      groups: order.filter( g => groups.has( g ) ).map( g => ( { name: g, benches: groups.get( g ) } ) )
    } );
  } catch( err ){
    console.error( `  scene FAILED: ${err?.message ?? err}` );
    failures.push( { job: `render-bench ${scene.key}`, exitCode: 1 } );
    pageError = null;
    await step( 'destroyInstance' ).catch( () => {} );
  }
}

await browser.close();
server.close();

function median( arr ){
  if( arr.length === 0 ){ return NaN; }

  const s = [ ...arr ].sort( ( a, b ) => a - b );

  return s[ ( s.length - 1 ) >> 1 ];
}

// -- output --------------------------------------------------------------------
if( jsonOut != null ){
  // bundle for report.mjs --renderer: jobs (+ failures for its meta)
  writeFileSync( resolve( jsonOut ), JSON.stringify( { jobs, failures } ) );
  process.exit( failures.length > 0 && jobs.length === 0 ? 1 : 0 );
}

mkdirSync( RESULTS_DIR, { recursive: true } );

const results = {
  meta: {
    date: new Date( startedAt ).toISOString(),
    commit: git( 'rev-parse', '--short', 'HEAD' ),
    branch: git( 'rev-parse', '--abbrev-ref', 'HEAD' ),
    nodeVersion: process.version,
    cpu: jobs[ 0 ]?.context.cpu ?? null,
    arch: jobs[ 0 ]?.context.arch ?? null,
    runtime: 'chromium',
    profile: 'renderer',
    suiteFilter: sceneFilter,
    totalMs: Date.now() - startedAt,
    failures
  },
  jobs
};

const stamp = results.meta.date.replace( /[:.]/g, '-' );
const resultsPath = join( RESULTS_DIR, `results-render-${stamp}.json` );

writeFileSync( resultsPath, JSON.stringify( results, null, 2 ) );
writeFileSync( join( RESULTS_DIR, 'report.html' ), renderReport( results ) );
console.log( `\nreport:  ${join( RESULTS_DIR, 'report.html' )}` );
console.log( `results: ${resultsPath}` );
console.log( `total: ${( results.meta.totalMs / 60000 ).toFixed( 1 )} min` );

if( failures.length > 0 ){
  console.error( `${failures.length} scene(s) failed` );
  process.exit( 1 );
}
