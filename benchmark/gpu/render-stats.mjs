// Stat shaping for the renderer benchmark: sampled milliseconds → the
// nanosecond stats shape the report pipeline renders (mitata's fields and
// its percentile indexing, so renderer sections read like the CPU ones).

export function toStats( samplesMs ){
  if( samplesMs.length === 0 ){ return null; }

  const ns = samplesMs.map( ms => ms * 1e6 ).sort( ( a, b ) => a - b );
  const at = p => ns[ ( p * ( ns.length - 1 ) ) | 0 ];

  return {
    min: ns[ 0 ],
    max: ns[ ns.length - 1 ],
    p25: at( 0.25 ),
    p50: at( 0.5 ),
    p75: at( 0.75 ),
    p99: at( 0.99 ),
    p999: at( 0.999 ),
    avg: ns.reduce( ( a, v ) => a + v, 0 ) / ns.length,
    ticks: ns.length,
    samples: ns.length
  };
}

// one-shot timings (init, export) are a single measurement by design —
// every percentile is that value
export const oneShotStats = ms => toStats( [ ms ] );
