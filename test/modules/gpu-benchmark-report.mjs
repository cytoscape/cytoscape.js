import { renderReport, fmtTime, fmtSpeedup } from '../../benchmark/gpu/report-html.mjs';
import { toStats, oneShotStats } from '../../benchmark/gpu/render-stats.mjs';
import { finishManualRun } from '../../benchmark/gpu/bench-run.mjs';
import { readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'chai';

const stats = ( p50, extra = {} ) => ( {
  min: p50 * 0.9, max: p50 * 2, p25: p50 * 0.95, p50, p75: p50 * 1.05,
  p99: p50 * 1.5, avg: p50 * 1.02, ticks: 1000, samples: 100, ...extra
} );

const fixture = () => ( {
  meta: {
    date: '2026-07-28T12:00:00.000Z',
    commit: 'abc1234', branch: 'v4', nodeVersion: 'v24.0.0',
    cpu: 'Test CPU', arch: 'arm64-darwin', runtime: 'node',
    profile: 'quick', suiteFilter: null, totalMs: 90000, failures: []
  },
  jobs: [
    {
      suite: 'materializers', n: 2000, op: null, durationMs: 60000,
      context: { arch: 'arm64-darwin', runtime: 'node', cpu: 'Test CPU' },
      groups: [
        { name: 'sweep: nodes()', benches: [
          { name: 'v3', stats: stats( 25000 ) },
          { name: 'gpu', stats: stats( 2500 ) }
        ] },
        { name: 'sweep: <edges> & "quotes"', benches: [
          { name: 'v3', stats: stats( 1000 ) },
          { name: 'gpu', stats: stats( 2000 ) } // a v3 win
        ] }
      ]
    },
    // an op-split job at the same (suite, n) must merge, deduping groups
    {
      suite: 'materializers', n: 2000, op: 'nodes', durationMs: 5000,
      context: { arch: 'arm64-darwin', runtime: 'node', cpu: 'Test CPU' },
      groups: [
        { name: 'sweep: nodes()', benches: [
          { name: 'v3', stats: stats( 999 ) },
          { name: 'gpu', stats: stats( 999 ) }
        ] }
      ]
    },
    // a manually-timed suite (round 33.10): one bench per group, every
    // percentile the single measurement
    {
      suite: 'labels', n: 20000, op: null, durationMs: 4000,
      context: { arch: 'arm64-darwin', runtime: 'node', cpu: 'Test CPU' },
      groups: [
        { name: 'labels: breakLines x 20000', benches: [ { name: 'gpu', stats: stats( 76e6 ) } ] }
      ]
    },
    // a gpu-only suite (no v3/gpu pair) must still render
    {
      suite: 'mappers', n: 2000, op: null, durationMs: 25000,
      context: { arch: 'arm64-darwin', runtime: 'node', cpu: 'Test CPU' },
      groups: [
        { name: 'mapper: bulk write, color', benches: [
          { name: 'cpu eval', stats: stats( 5e6 ) },
          { name: 'gpu path', stats: stats( 1e6 ) }
        ] }
      ]
    }
  ]
} );

describe( 'gpu benchmark report', function(){

  describe( 'formatting', function(){
    it( 'formats times across units', function(){
      expect( fmtTime( 500 ) ).to.equal( '500 ns' );
      expect( fmtTime( 25084.5 ) ).to.equal( '25.1 µs' );
      expect( fmtTime( 3.2e6 ) ).to.equal( '3.20 ms' );
      expect( fmtTime( 1.5e9 ) ).to.equal( '1.50 s' );
    } );

    it( 'formats speedups by magnitude', function(){
      expect( fmtSpeedup( 137.4 ) ).to.equal( '137×' );
      expect( fmtSpeedup( 4.26 ) ).to.equal( '4.3×' );
      expect( fmtSpeedup( 0.834 ) ).to.equal( '0.83×' );
    } );
  } );

  describe( 'renderReport', function(){
    it( 'produces a standalone page with the run context and sections', function(){
      const html = renderReport( fixture() );

      expect( html ).to.match( /^<!doctype html>/ );
      expect( html ).to.include( '</html>' );
      expect( html ).to.include( 'abc1234' );
      expect( html ).to.include( 'Test CPU' );
      expect( html ).to.include( 'materializers' );
      expect( html ).to.include( 'mappers' );
      expect( html ).to.not.include( 'src="http' ); // self-contained
      expect( html ).to.not.include( 'href="http' );
    } );

    it( 'reports pair speedups and escapes group names', function(){
      const html = renderReport( fixture() );

      expect( html ).to.include( '10×' ); // 25000/2500
      expect( html ).to.include( '0.50×' ); // the v3 win
      expect( html ).to.include( 'sweep: &lt;edges&gt; &amp; &quot;quotes&quot;' );
      expect( html ).to.not.include( 'sweep: <edges>' );
    } );

    it( 'merges op-split jobs without duplicating groups', function(){
      const html = renderReport( fixture() );
      const matches = html.match( /sweep: nodes\(\)/g ) ?? [];

      // once in the overview, once in the section chart (title attr + text
      // count as one row via the pair), once in the details table
      expect( html.match( /999 ns/g ) ?? [] ).to.have.length( 0 ); // dupe group dropped
      expect( matches.length ).to.be.greaterThan( 0 );
    } );

    it( 'renders gpu-only benches with their own labels', function(){
      const html = renderReport( fixture() );

      expect( html ).to.include( 'cpu eval' );
      expect( html ).to.include( 'gpu path' );
    } );

    it( 'renders a single-bench (manually timed) section', function(){
      const html = renderReport( fixture() );

      // round 33.10: curves.mjs and labels.mjs time one shot per row and
      // join the job table through finishManualRun, so a group may hold
      // exactly one bench and must still get a row and a table entry
      expect( html ).to.include( 'labels: breakLines x 20000' );
      expect( html ).to.include( '76.0 ms' );
    } );

    it( 'lists failed jobs when present', function(){
      const results = fixture();

      results.meta.failures = [ { job: 'mutators.mjs @ N=200000 op=select', exitCode: 1 } ];

      const html = renderReport( results );

      expect( html ).to.include( 'Failed jobs' );
      expect( html ).to.include( 'op=select' );
    } );

    it( 'renders an empty run without throwing', function(){
      const html = renderReport( { meta: { totalMs: 0, failures: [] }, jobs: [] } );

      expect( html ).to.include( '</html>' );
    } );

    it( 'renders a section note once per (suite, n)', function(){
      const results = fixture();

      results.jobs[ 0 ].note = 'Wall frame times are vsync-bound.';
      results.jobs[ 1 ].note = 'A different note that must not double-render.';

      const html = renderReport( results );

      expect( html ).to.include( 'Wall frame times are vsync-bound.' );
      expect( html ).to.not.include( 'must not double-render' );
    } );
  } );

  describe( 'finishManualRun (round 33.10)', function(){
    let dir;

    beforeEach( function(){
      dir = mkdtempSync( join( tmpdir(), 'gpu-bench-' ) );
    } );

    it( 'writes the report job shape from one-shot rows', function(){
      const path = join( dir, 'job.json' );

      process.env.BENCH_JSON = path;

      try {
        finishManualRun( 'curves', [
          { name: 'curve premium: drag', benches: [ { name: 'curved', ms: 12 }, { name: 'straight', ms: 8 } ] }
        ] );
      } finally {
        delete process.env.BENCH_JSON;
      }

      const job = JSON.parse( readFileSync( path, 'utf8' ) );

      expect( job.suite ).to.equal( 'curves' );
      expect( job.groups ).to.have.length( 1 );
      expect( job.groups[ 0 ].benches.map( b => b.name ) ).to.eql( [ 'curved', 'straight' ] );

      // a one-shot measurement is every percentile of itself, in ns
      const s = job.groups[ 0 ].benches[ 0 ].stats;

      expect( s.p50 ).to.equal( 12e6 );
      expect( s.p99 ).to.equal( 12e6 );
      expect( s.min ).to.equal( 12e6 );
      expect( s.samples ).to.equal( 1 );

      // and the shape the report reads must survive a round-trip
      expect( () => renderReport( { meta: { totalMs: 1, failures: [] }, jobs: [ { ...job, durationMs: 1 } ] } ) )
        .to.not.throw();
    } );

    it( 'writes nothing without BENCH_JSON (terminal runs are unchanged)', function(){
      delete process.env.BENCH_JSON;

      expect( () => finishManualRun( 'curves', [] ) ).to.not.throw();
    } );

    afterEach( function(){
      rmSync( dir, { recursive: true, force: true } );
    } );
  } );

  describe( 'render-bench stat shaping', function(){
    it( 'converts sampled ms to the ns stats shape with mitata indexing', function(){
      const s = toStats( [ 3, 1, 2, 4, 5 ] ); // ms

      expect( s.min ).to.equal( 1e6 );
      expect( s.max ).to.equal( 5e6 );
      expect( s.p50 ).to.equal( 3e6 );
      expect( s.p25 ).to.equal( 2e6 ); // (0.25 * 4) | 0 = index 1
      expect( s.avg ).to.equal( 3e6 );
      expect( s.samples ).to.equal( 5 );
    } );

    it( 'returns null for no samples and a flat one-shot otherwise', function(){
      expect( toStats( [] ) ).to.equal( null );

      const s = oneShotStats( 250 );

      expect( s.p50 ).to.equal( 250e6 );
      expect( s.p99 ).to.equal( 250e6 );
      expect( s.samples ).to.equal( 1 );
    } );
  } );

} );
