import { renderReport, fmtTime, fmtSpeedup } from '../../benchmark/gpu/report-html.mjs';
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
  } );

} );
