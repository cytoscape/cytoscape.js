/*
Easing — one curve layer, two executors.

v3's easing enum is `linear` plus 25 named cubic-beziers, and
`cubic-bezier(x1, y1, x2, y2)` names any other curve.  Two forms are new
here: `linear(...)` interpolates an explicit progression array (the CSS
easing-function form, stops and all), and `spring(bounce)` replaces v3's
`spring(tension, friction)` with the perceptual parameterization Apple
uses.  A spring compiles *to* a progression array, so it costs the kernel
nothing beyond the `linear()` path — the physics all happens once, on the
CPU, at capture time.

Every form compiles to an `EasingProgram`: the CPU calls `fn`, and the GPU
tween kernel reads `kind`/`bezier`/`points` out of its params (the WGSL
twin of each evaluator lives in render/gpu-tween.mts and mirrors the code
here step for step).  The two agree to float precision, not bit-exactly —
invisible mid-flight, and irrelevant at the ends, since t=0 and t=1 are
exact on both sides and a settle re-derives the value on the CPU anyway.

Easings are **names only** — a custom function is not accepted (v3 allowed
one).  There is no way to ship a closure to the device, so supporting one
would mean an animation whose curve silently depends on whether it got
offloaded; between that and `cubic-bezier()`/`linear()` covering any curve
you can draw, the parity is worth more than the escape hatch.
*/

export type Easing = ( t: number ) => number;

/** Evaluator selector, shared with the WGSL `easeAt` (render/gpu-tween.mts). */
export const EASING_KIND = { linear: 0, bezier: 1, points: 2 } as const;

export interface EasingProgram {
  /** one of EASING_KIND */
  kind: number;
  /** control points (x1, y1, x2, y2) when kind is bezier */
  bezier: readonly [ number, number, number, number ] | null;
  /** flat (x, y) pairs when kind is points; x ascending across [0, 1] */
  points: Float32Array | null;
  /**
   * Multiplies the requested duration.  Always 1 except for springs: their
   * `duration` is the *perceptual* duration — the pace of the key movement
   * — and the animation runs on past it to finish settling.
   */
  durationScale: number;
  /** the CPU evaluator */
  fn: Easing;
}

const clamp = ( v: number, lo: number, hi: number ): number => v < lo ? lo : v > hi ? hi : v;

/*
The v3 easing enum, as cubic-bezier control points (the same numbers v3's
easings.mts passes to its generator, so the curves are identical).
*/
export const BEZIER_EASINGS: Record<string, readonly [ number, number, number, number ]> = {
  'ease': [ 0.25, 0.1, 0.25, 1 ],
  'ease-in': [ 0.42, 0, 1, 1 ],
  'ease-out': [ 0, 0, 0.58, 1 ],
  'ease-in-out': [ 0.42, 0, 0.58, 1 ],

  'ease-in-sine': [ 0.47, 0, 0.745, 0.715 ],
  'ease-out-sine': [ 0.39, 0.575, 0.565, 1 ],
  'ease-in-out-sine': [ 0.445, 0.05, 0.55, 0.95 ],

  'ease-in-quad': [ 0.55, 0.085, 0.68, 0.53 ],
  'ease-out-quad': [ 0.25, 0.46, 0.45, 0.94 ],
  'ease-in-out-quad': [ 0.455, 0.03, 0.515, 0.955 ],

  'ease-in-cubic': [ 0.55, 0.055, 0.675, 0.19 ],
  'ease-out-cubic': [ 0.215, 0.61, 0.355, 1 ],
  'ease-in-out-cubic': [ 0.645, 0.045, 0.355, 1 ],

  'ease-in-quart': [ 0.895, 0.03, 0.685, 0.22 ],
  'ease-out-quart': [ 0.165, 0.84, 0.44, 1 ],
  'ease-in-out-quart': [ 0.77, 0, 0.175, 1 ],

  'ease-in-quint': [ 0.755, 0.05, 0.855, 0.06 ],
  'ease-out-quint': [ 0.23, 1, 0.32, 1 ],
  'ease-in-out-quint': [ 0.86, 0, 0.07, 1 ],

  'ease-in-expo': [ 0.95, 0.05, 0.795, 0.035 ],
  'ease-out-expo': [ 0.19, 1, 0.22, 1 ],
  'ease-in-out-expo': [ 1, 0, 0, 1 ],

  'ease-in-circ': [ 0.6, 0.04, 0.98, 0.335 ],
  'ease-out-circ': [ 0.075, 0.82, 0.165, 1 ],
  'ease-in-out-circ': [ 0.785, 0.135, 0.15, 0.86 ]
};

/** Every name the enum accepts (`linear` plus the beziers). */
export const EASING_NAMES: readonly string[] = [ 'linear', ...Object.keys( BEZIER_EASINGS ) ];

/*
Cubic-bezier solve, after Gaetan Renaudeau's bezier-easing (MIT) — the same
implementation v3 uses, so the numbers match.  An 11-entry sample table
brackets x, then Newton refines t; a near-flat bracket falls back to binary
subdivision.  Mirrored in WGSL.
*/
const SPLINE_SIZE = 11;
const SPLINE_STEP = 1 / ( SPLINE_SIZE - 1 );
const NEWTON_ITERATIONS = 4;
const NEWTON_MIN_SLOPE = 0.001;
const SUBDIVISION_PRECISION = 1e-7;
const SUBDIVISION_ITERATIONS = 10;

const bezA = ( a1: number, a2: number ): number => 1 - 3 * a2 + 3 * a1;
const bezB = ( a1: number, a2: number ): number => 3 * a2 - 6 * a1;
const bezC = ( a1: number ): number => 3 * a1;

const calcBezier = ( t: number, a1: number, a2: number ): number =>
  ( ( bezA( a1, a2 ) * t + bezB( a1, a2 ) ) * t + bezC( a1 ) ) * t;

const bezSlope = ( t: number, a1: number, a2: number ): number =>
  3 * bezA( a1, a2 ) * t * t + 2 * bezB( a1, a2 ) * t + bezC( a1 );

const newtonRefine = ( x: number, guess: number, x1: number, x2: number ): number => {
  let t = guess;

  for( let i = 0; i < NEWTON_ITERATIONS; i++ ){
    const slope = bezSlope( t, x1, x2 );

    if( slope === 0 ){ return t; }

    t -= ( calcBezier( t, x1, x2 ) - x ) / slope;
  }

  return t;
};

const subdivide = ( x: number, lo: number, hi: number, x1: number, x2: number ): number => {
  let a = lo, b = hi, t = lo;

  for( let i = 0; i < SUBDIVISION_ITERATIONS; i++ ){
    t = a + ( b - a ) / 2;

    const err = calcBezier( t, x1, x2 ) - x;

    if( err > 0 ){ b = t; } else { a = t; }

    if( Math.abs( err ) <= SUBDIVISION_PRECISION ){ break; }
  }

  return t;
};

const tForX = ( x: number, table: Float32Array, x1: number, x2: number ): number => {
  let start = 0;
  let i = 1;

  for( ; i !== SPLINE_SIZE - 1 && table[ i ] <= x; i++ ){ start += SPLINE_STEP; }

  i--;

  const dist = ( x - table[ i ] ) / ( table[ i + 1 ] - table[ i ] );
  const guess = start + dist * SPLINE_STEP;
  const slope = bezSlope( guess, x1, x2 );

  if( slope >= NEWTON_MIN_SLOPE ){ return newtonRefine( x, guess, x1, x2 ); }
  if( slope === 0 ){ return guess; }

  return subdivide( x, start, start + SPLINE_STEP, x1, x2 );
};

/** A cubic-bezier easing over control points (x1, y1) and (x2, y2). */
export const bezierEasing = ( x1: number, y1: number, x2: number, y2: number ): Easing => {
  if( x1 === y1 && x2 === y2 ){ return t => t; } // the diagonal: identity

  // f32, so the bracket search matches the kernel's table exactly
  const table = new Float32Array( SPLINE_SIZE );

  for( let i = 0; i < SPLINE_SIZE; i++ ){ table[ i ] = calcBezier( i * SPLINE_STEP, x1, x2 ); }

  return t => {
    if( t <= 0 ){ return 0; }
    if( t >= 1 ){ return 1; }

    return calcBezier( tForX( t, table, x1, x2 ), y1, y2 );
  };
};

/*
Progression arrays (CSS `linear()`).  `points` is flat (x, y) pairs with x
ascending; evaluation is a piecewise-linear lookup.  Repeated x values are
legal and mean a jump — the search takes the last segment starting at or
before t, so it lands on the far side.
*/
const samplePoints = ( points: Float32Array, t: number ): number => {
  const last = points.length / 2 - 1;

  if( t <= points[ 0 ] ){ return points[ 1 ]; }
  if( t >= points[ last * 2 ] ){ return points[ last * 2 + 1 ]; }

  let lo = 0, hi = last;

  while( hi - lo > 1 ){
    const mid = ( lo + hi ) >> 1;

    if( points[ mid * 2 ] <= t ){ lo = mid; } else { hi = mid; }
  }

  const x0 = points[ lo * 2 ], y0 = points[ lo * 2 + 1 ];
  const x1 = points[ hi * 2 ], y1 = points[ hi * 2 + 1 ];

  if( x1 === x0 ){ return y1; }

  return y0 + ( y1 - y0 ) * ( ( t - x0 ) / ( x1 - x0 ) );
};

/** A CSS `linear()` easing over a progression array (flat (x, y) pairs,
 * x ascending — `parseLinearPoints`'s output).  The array is held by
 * reference, so it must not be mutated after the easing is built. */
export const pointsEasing = ( points: Float32Array ): Easing => t => samplePoints( points, t );

const percent = ( s: string, src: string ): number => {
  const m = /^(-?(?:\d+\.?\d*|\.\d+))%$/.exec( s );

  if( m == null ){
    throw new Error( `The stop '${s}' in '${src}' is not a percentage` );
  }

  return Number( m[ 1 ] ) / 100;
};

/**
 * Parse CSS `linear()` args into flat (x, y) pairs.  Each entry is a value
 * with 0, 1 or 2 stop positions; two positions repeat the value, producing
 * a flat segment.  Missing positions follow the CSS rules: the first is 0%,
 * the last is 100%, runs in between spread evenly, and every position is
 * pulled up to at least the largest one before it.
 */
export const parseLinearPoints = ( args: string, src: string ): Float32Array => {
  const values: number[] = [];
  const stops: ( number | null )[] = [];

  for( const entry of args.split( ',' ) ){
    const parts = entry.trim().split( /\s+/ ).filter( p => p.length > 0 );

    if( parts.length === 0 || parts.length > 3 ){
      throw new Error( `'${entry.trim()}' in '${src}' needs a value and at most two stops` );
    }

    const value = Number( parts[ 0 ] );

    if( !Number.isFinite( value ) ){
      throw new Error( `'${parts[ 0 ]}' in '${src}' is not a number` );
    }

    if( parts.length === 1 ){
      values.push( value );
      stops.push( null );
    } else {
      for( const p of parts.slice( 1 ) ){
        values.push( value );
        stops.push( percent( p, src ) );
      }
    }
  }

  const n = values.length;

  if( n < 2 ){
    throw new Error( `'${src}' needs at least two points` );
  }

  if( stops[ 0 ] == null ){ stops[ 0 ] = 0; }
  if( stops[ n - 1 ] == null ){ stops[ n - 1 ] = 1; }

  let max = -Infinity;

  for( let i = 0; i < n; i++ ){
    const s = stops[ i ];

    if( s != null ){
      stops[ i ] = max = Math.max( s, max );
    }
  }

  for( let i = 1; i < n; i++ ){
    if( stops[ i ] != null ){ continue; }

    let j = i;

    while( stops[ j ] == null ){ j++; } // stops[n-1] is set, so this terminates

    const a = stops[ i - 1 ] as number;
    const b = stops[ j ] as number;

    for( let k = i; k < j; k++ ){
      stops[ k ] = a + ( b - a ) * ( k - i + 1 ) / ( j - i + 1 );
    }

    i = j;
  }

  const out = new Float32Array( n * 2 );

  for( let i = 0; i < n; i++ ){
    out[ i * 2 ] = stops[ i ] as number;
    out[ i * 2 + 1 ] = values[ i ];
  }

  return out;
};

/*
Springs, perceptually parameterized.

`spring(bounce)` follows the mapping Apple's spring API uses (mass 1,
stiffness (2π/D)², damping 4π(1 − bounce)/D), which reduces to a damping
ratio of exactly `1 − bounce` — so bounce *is* the damping ratio, and the
curve's shape depends on nothing else.  bounce 0 is critically damped (no
overshoot), positive bounces oscillate, negative ones are overdamped.

`duration` is the *perceptual* duration in that model — the pace of the key
movement, held constant as bounce changes — so the animation must run on
past it while the ringing decays.  Sampling over the whole settling window
and reporting the ratio as `durationScale` is what buys that: the shape is
a pure function of bounce, and the caller's duration sets the pace.
*/
const SPRING_EPSILON = 0.002; // residual that counts as settled
const SPRING_BOUNCE_LIMIT = 0.9; // ζ = 0.1: already ~10× the perceptual duration
const SPRING_SCAN_STEPS = 4096;
const SPRING_POINTS_PER_CYCLE = 48;
const SPRING_POINTS_MIN = 25;
const SPRING_POINTS_MAX = 513;

const dampingRatio = ( bounce: number ): number => {
  const b = clamp( bounce, -SPRING_BOUNCE_LIMIT, SPRING_BOUNCE_LIMIT );

  return b >= 0 ? 1 - b : 1 / ( 1 + b );
};

/** Step response of a unit spring: 0 at t=0, settling to 1, t in perceptual units. */
const springAt = ( zeta: number, w0: number, t: number ): number => {
  if( zeta < 1 ){
    const wd = w0 * Math.sqrt( 1 - zeta * zeta );

    return 1 - Math.exp( -zeta * w0 * t ) * ( Math.cos( wd * t ) + ( zeta * w0 / wd ) * Math.sin( wd * t ) );
  }

  if( zeta === 1 ){
    return 1 - ( 1 + w0 * t ) * Math.exp( -w0 * t );
  }

  const s = Math.sqrt( zeta * zeta - 1 );
  const r1 = -w0 * ( zeta - s ); // the slow root
  const r2 = -w0 * ( zeta + s );

  return 1 + ( -r2 / ( r2 - r1 ) ) * Math.exp( r1 * t ) + ( r1 / ( r2 - r1 ) ) * Math.exp( r2 * t );
};

/**
 * An upper bound on the settling time, from the analytic decay envelope.
 * Loose near critical damping (the envelope's sin coefficient blows up
 * while the sine itself vanishes), which is why it only seeds the scan.
 */
const settleBound = ( zeta: number, w0: number ): number => {
  if( zeta < 1 ){
    const wd = w0 * Math.sqrt( 1 - zeta * zeta );

    return Math.log( Math.hypot( 1, zeta * w0 / wd ) / SPRING_EPSILON ) / ( zeta * w0 );
  }

  if( zeta === 1 ){
    // (1 + w0·t)·e^(−w0·t) = ε, by fixed point (log-dominated, converges fast)
    let t = 1 / w0;

    for( let i = 0; i < 32; i++ ){ t = Math.log( ( 1 + w0 * t ) / SPRING_EPSILON ) / w0; }

    return t;
  }

  const s = Math.sqrt( zeta * zeta - 1 );
  const r1 = -w0 * ( zeta - s );
  const r2 = -w0 * ( zeta + s );
  const amp = Math.abs( r2 / ( r2 - r1 ) ) + Math.abs( r1 / ( r2 - r1 ) );

  return Math.log( amp / SPRING_EPSILON ) / Math.abs( r1 );
};

/** The last time the residual is still visible, scanning back from the bound. */
const settleTime = ( zeta: number, w0: number ): number => {
  const hi = settleBound( zeta, w0 );
  const step = hi / SPRING_SCAN_STEPS;

  for( let i = SPRING_SCAN_STEPS; i >= 1; i-- ){
    if( Math.abs( springAt( zeta, w0, i * step ) - 1 ) >= SPRING_EPSILON ){
      return ( i + 1 ) * step;
    }
  }

  return step;
};

/**
 * Compile `spring(bounce)` to a progression array over its whole settling
 * window, plus the ratio of that window to the perceptual duration.
 */
export const springPoints = ( bounce: number ): { points: Float32Array; durationScale: number } => {
  const zeta = dampingRatio( bounce );
  const w0 = 2 * Math.PI; // perceptual duration of 1
  const settle = settleTime( zeta, w0 );

  /*
  Enough samples to resolve the two features a chord can miss: the ringing,
  and — for a spring that barely rings — the initial rise, which happens
  over about one perceptual duration however long the tail is.  Both come
  out as a per-perceptual-unit density over the settling window.
  */
  const cycles = zeta < 1 ? ( w0 * Math.sqrt( 1 - zeta * zeta ) * settle ) / ( 2 * Math.PI ) : 0;
  const n = clamp(
    Math.round( SPRING_POINTS_PER_CYCLE * Math.max( cycles, settle, 0.5 ) ) + 1,
    SPRING_POINTS_MIN, SPRING_POINTS_MAX );

  const points = new Float32Array( n * 2 );

  for( let i = 0; i < n; i++ ){
    const t = i / ( n - 1 );

    points[ i * 2 ] = t;
    points[ i * 2 + 1 ] = springAt( zeta, w0, t * settle );
  }

  // land exactly on the target: the residual at the end is below ε, and a
  // settle would rewrite it anyway
  points[ ( n - 1 ) * 2 ] = 1;
  points[ ( n - 1 ) * 2 + 1 ] = 1;

  return { points, durationScale: settle };
};

const LINEAR_PROGRAM: EasingProgram = {
  kind: EASING_KIND.linear, bezier: null, points: null, durationScale: 1, fn: t => t
};

const bezierProgram = ( p: readonly [ number, number, number, number ] ): EasingProgram => ( {
  kind: EASING_KIND.bezier, bezier: p, points: null,
  durationScale: 1, fn: bezierEasing( p[ 0 ], p[ 1 ], p[ 2 ], p[ 3 ] )
} );

const pointsProgram = ( points: Float32Array, durationScale = 1 ): EasingProgram => ( {
  kind: EASING_KIND.points, bezier: null, points, durationScale, fn: pointsEasing( points )
} );

/** the fixed enum, built once; parameterized forms compile per call */
const NAMED: Record<string, EasingProgram> = Object.fromEntries( [
  [ 'linear', LINEAR_PROGRAM ],
  ...Object.entries( BEZIER_EASINGS ).map( ( [ name, p ] ) => [ name, bezierProgram( p ) ] )
] );

const numbers = ( args: string, src: string ): number[] => args.split( ',' ).map( a => {
  const n = Number( a.trim() );

  if( !Number.isFinite( n ) ){
    throw new Error( `'${a.trim()}' in '${src}' is not a number` );
  }

  return n;
} );

const CALL = /^([a-z-]+)\((.*)\)$/;

/**
 * Compile an easing to the form both executors run: a name from the enum,
 * `cubic-bezier()`, `linear()` or `spring()`.  Anything else throws — a
 * silent fallback would animate on the wrong curve, which is much harder to
 * notice than an error.
 */
export const compileEasing = ( easing: string | undefined ): EasingProgram => {
  if( easing != null && typeof easing !== 'string' ){
    throw new Error( 'A custom easing function is unsupported: the GPU kernel cannot run a ' +
      'closure, so the curve would depend on whether the animation was offloaded. ' +
      'Use cubic-bezier(), linear() or spring() instead.' );
  }

  const src = ( easing ?? 'ease' ).trim();
  const named = NAMED[ src ];

  if( named != null ){ return named; }

  const call = CALL.exec( src );

  if( call == null ){
    throw new Error( `'${src}' is not a known easing; expected one of ${
      EASING_NAMES.join( ', ' ) }, cubic-bezier(), linear() or spring()` );
  }

  const [ , name, args ] = call;

  if( name === 'linear' ){
    return pointsProgram( parseLinearPoints( args, src ) );
  }

  if( name === 'cubic-bezier' ){
    const p = numbers( args, src );

    if( p.length !== 4 ){
      throw new Error( `'${src}' needs four control points` );
    }

    // CSS constrains the x coordinates; y is free, so the curve may overshoot
    return bezierProgram( [ clamp( p[ 0 ], 0, 1 ), p[ 1 ], clamp( p[ 2 ], 0, 1 ), p[ 3 ] ] );
  }

  if( name === 'spring' ){
    const p = numbers( args, src );

    if( p.length !== 1 ){
      throw new Error( `'${src}' takes one bounce factor in [-1, 1] (v3's spring(tension, friction) is gone)` );
    }

    const { points, durationScale } = springPoints( p[ 0 ] );

    return pointsProgram( points, durationScale );
  }

  throw new Error( `'${src}' is not a known easing function` );
};

/** The enum as plain evaluators, for callers that just want a curve. */
export const EASINGS: Record<string, Easing> = Object.fromEntries(
  Object.entries( NAMED ).map( ( [ name, program ] ) => [ name, program.fn ] ) );

/** Just the CPU evaluator for an easing. */
export const resolveEasing = ( easing: string | undefined ): Easing => compileEasing( easing ).fn;
