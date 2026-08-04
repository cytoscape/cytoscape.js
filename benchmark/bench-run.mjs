// Shared run-and-capture tail for the gpu benchmark suites.
//
// Without BENCH_JSON, finishRun() is exactly mitata's run() — the terminal
// behaviour of every suite is unchanged.  With BENCH_JSON=<path> (set by
// report.mjs), the suite runs quietly and writes its results as JSON to
// that path for the HTML report: per group, per bench, the summary stats
// (nanoseconds) with the raw sample arrays stripped.

import { writeFileSync } from 'node:fs';
import { run } from 'mitata';
import { N } from './graph.mjs';
import { oneShotStats } from './render-stats.mjs';

const STAT_KEYS = [ 'min', 'max', 'p25', 'p50', 'p75', 'p99', 'p999', 'avg', 'ticks' ];

function slimStats( stats ){
  const out = {};

  for( const key of STAT_KEYS ){
    if( typeof stats?.[ key ] === 'number' ){ out[ key ] = stats[ key ]; }
  }

  if( Array.isArray( stats?.samples ) ){ out.samples = stats.samples.length; }

  return out;
}

/**
 * The same tail for the **manually timed** suites (round 33.10).
 *
 * `curves.mjs` and `labels.mjs` time one shot per row rather than
 * sampling through mitata — deliberately, because their rows mutate or
 * are one-offs — so they have no mitata results to hand over.  Before
 * this they wrote their own JSON shape (or none), which is why they could
 * not join `report.mjs`'s job table: it reads `job.groups`.  This turns
 * their rows into that shape, with every percentile equal to the single
 * measurement (`oneShotStats`, the renderer bench's existing convention
 * for one-shot timings).
 *
 * @param suite — the suite name the report groups by
 * @param groups — `[ { name, benches: [ { name, ms } ] } ]`
 */
export function finishManualRun( suite, groups ){
  const jsonPath = process.env.BENCH_JSON;

  if( !jsonPath ){ return; }

  writeFileSync( jsonPath, JSON.stringify( {
    suite,
    n: N,
    op: process.env.BENCH_OP ?? null,
    context: { arch: null, runtime: 'node', cpu: null },
    groups: groups.map( g => ( {
      name: g.name,
      benches: g.benches.map( b => ( { name: b.name, stats: oneShotStats( b.ms ) } ) )
    } ) )
  } ) );
}

export async function finishRun( suite ){
  const jsonPath = process.env.BENCH_JSON;

  if( !jsonPath ){
    await run();

    return;
  }

  const { layout, context, benchmarks } = await run( { format: 'quiet' } );

  // group benches by their collection (mitata group()); layout[i].name is
  // the group name, null for benches registered outside any group
  const groups = layout.map( l => ( { name: l.name, benches: [] } ) );

  for( const b of benchmarks ){
    const g = groups[ b.group ];

    if( g == null ){ continue; }

    for( const r of b.runs ){
      if( r?.stats == null ){ continue; } // skipped/errored trial

      g.benches.push( { name: r.name ?? b.alias, stats: slimStats( r.stats ) } );
    }
  }

  writeFileSync( jsonPath, JSON.stringify( {
    suite,
    n: N,
    op: process.env.BENCH_OP ?? null,
    context: {
      arch: context?.arch ?? null,
      runtime: context?.runtime ?? null,
      cpu: context?.cpu?.name ?? null
    },
    // mitata's collection 0 is the implicit no-group bucket (name 0)
    groups: groups.filter( g => g.benches.length > 0 && typeof g.name === 'string' )
  } ) );
}
