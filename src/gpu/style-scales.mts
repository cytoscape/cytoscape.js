import { color2tuple } from '../util/colors.mjs';
import { resolveScheme, hexToRgb, srgbToOklab, oklabToSrgb } from './style-schemes.mjs';
import type { SchemeDef } from './style-schemes.mjs';
import type { GroupName } from './contract.mjs';
import type { DataStore } from './store/data-store.mjs';
import type { GpuMapper, GpuCaseMapper, GpuMapperSpec, GpuCondition } from './gpu-types.mjs';

/*
The mapper DSL's compiled form and CPU evaluator.  A mapper spec is a
plain serializable object (`{ data, scale?, domain?, range?, ... }`, see
gpu-types.mts); `compileMapper` validates it against the target channel
and lowers it to a data-only Program — numeric params and stop tables,
no closures — so the same IR later serializes to the GPU eval kernel.

Lowerings, so evaluation stays a single shape per family:
- linear/log/sqrt/pow/symlog, diverging, and multi-stop ranges all become
  one n-stop piecewise-linear program over *transformed* input stops
  (diverging piecewise-inverts around its midpoint at compile time).  The
  stop tables serialize to the GPU verbatim and the kernel runs the same
  stop search, so CPU and GPU evaluation cannot diverge.
- threshold/quantize become cuts + discrete outputs; ordinal becomes a
  category → output map (dictionary-encoded string columns evaluate
  through a dict-index LUT, which is also the GPU form).

Auto domains (`domain` omitted or 'auto') are *live*: they track the data
extent.  The extent is applied at bind time and re-checked by the style
engine on data writes to the mapped key — an extent change re-evaluates
the whole channel, otherwise only the written slots refresh.  A log scale
takes the extent of the positive values only (log can't span zero).

Missing policy (also the non-numeric-datum and unknown-category policy):
the spec's `fallback` value, else the channel default — never
keep-previous, so refresh stays idempotent and order-independent.
*/

export type RGBA = [ number, number, number, number ];

export type Transform =
  | { kind: 'identity' }
  | { kind: 'log'; base: number }
  | { kind: 'pow'; exponent: number }
  | { kind: 'symlog'; constant: number };

export type OutputStops =
  | { kind: 'number'; values: Float64Array }
  | {
    kind: 'color';
    space: 'oklab' | 'srgb';
    /** n×3 channel triples in `space` (OKLab floats, or sRGB bytes) */
    triples: Float64Array;
    /** n alpha bytes, interpolated separately (straight, not premultiplied) */
    alpha: Float64Array;
  };

/** A compiled condition over one data key (data-only; CPU-evaluated). */
export type CompiledCondition = {
  key: string;
  op: 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte' | 'in';
  value: string | number | ( string | number )[];
};

export type Program =
  | { kind: 'passthrough' }
  | { kind: 'const'; value: number | RGBA }
  | {
    kind: 'case';
    /** ordered clauses; conds AND-ed within a clause, first matching wins */
    clauses: { conds: CompiledCondition[]; value: number | RGBA }[];
    elseValue: number | RGBA;
  }
  | {
    kind: 'continuous';
    transform: Transform;
    /** ascending transformed input stops, length = output stop count ≥ 2 */
    inStops: Float64Array;
    /** untransformed domain endpoints (clamping happens pre-transform) */
    lo: number;
    hi: number;
    outStops: OutputStops;
    clamp: boolean;
    autoDomain: boolean;
    /** the extent the auto stops were built from (null until first bind) */
    applied: [ number, number ] | null;
  }
  | {
    kind: 'discrete';
    /** ascending cut points, length = outputs.length − 1 */
    cuts: Float64Array;
    outputs: ( number | RGBA )[];
    /** quantize-with-auto-domain only (cuts recompute from the extent) */
    autoDomain: boolean;
    applied: [ number, number ] | null;
  }
  | { kind: 'ordinal'; map: Map<string | number, number | RGBA> };

/** What the target style channel stores (label mappers never reach here). */
export type ChannelKind = 'number' | 'color' | 'enum';

export interface CompileOpts {
  kind: ChannelKind;
  /** normalized prop name, for error messages */
  prop: string;
  /** enum channels: keyword → stored id, null for unknown keywords */
  parseEnum?: ( value: unknown ) => number | null;
}

export interface CompiledMapper {
  /** primary data key (a single-key scale mapper; '' for conditionals) — the GPU-pack path */
  key: string;
  /** every data key this mapper reads — the refresh-dependency set */
  keys: string[];
  kind: ChannelKind;
  prop: string;
  program: Program;
  /** parsed spec fallback; null = use the channel default */
  fallback: number | RGBA | null;
  parseEnum: ( ( value: unknown ) => number | null ) | null;
  /** the original spec object, never mutated (json() fidelity) */
  spec: GpuMapperSpec;
}

/** Output of a bound evaluator: the channel value for one slot. */
export type Evaluated = number | RGBA;

/** Mapper specs are plain objects with a string `data` field or a `case` array. */
export const isMapperSpec = ( value: unknown ): value is GpuMapperSpec => {
  if( value == null || typeof value !== 'object' || Array.isArray( value ) ){ return false; }

  return typeof ( value as GpuMapper ).data === 'string'
    || Array.isArray( ( value as GpuCaseMapper ).case );
};

const isCaseSpec = ( spec: GpuMapperSpec ): spec is GpuCaseMapper => {
  return Array.isArray( ( spec as GpuCaseMapper ).case );
};

const CONDITION_OPS: ReadonlySet<string> = new Set( [ 'eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'in' ] );

const CONTINUOUS_SCALES: ReadonlySet<string> = new Set( [ 'linear', 'log', 'sqrt', 'pow', 'symlog' ] );
const SCALES: ReadonlySet<string> = new Set( [
  ...CONTINUOUS_SCALES, 'diverging', 'ordinal', 'threshold', 'quantize'
] );

const err = ( prop: string, msg: string ): Error => {
  return new Error( `Invalid mapper for '${prop}': ${msg}` );
};

// -- output-value parsing (compile-time; throws carry the prop name) --

const coerceNumber = ( value: unknown ): number | null => {
  const num = typeof value === 'number' ? value : parseFloat( String( value ) );

  return isFinite( num ) ? num : null;
};

const coerceColor = ( value: unknown ): RGBA | null => {
  if( typeof value !== 'string' ){ return null; }

  const tuple = color2tuple( value );

  if( tuple == null ){ return null; }

  const [ r, g, b, a ] = tuple;

  return [ r, g, b, Math.round( ( a ?? 1 ) * 255 ) ];
};

const parseOutput = ( opts: CompileOpts, value: unknown ): number | RGBA => {
  const out = opts.kind === 'number' ? coerceNumber( value )
    : opts.kind === 'color' ? coerceColor( value )
    : ( opts.parseEnum as NonNullable<CompileOpts['parseEnum']> )( value );

  if( out == null ){
    throw err( opts.prop, `'${String( value )}' is not a valid ${opts.kind} value` );
  }

  return out;
};

// -- transforms --

const fwd = ( t: Transform, x: number ): number => {
  switch( t.kind ){
    case 'identity': return x;
    case 'log': // signed so all-negative log domains stay monotone ascending
      return x > 0 ? Math.log( x ) / Math.log( t.base ) : -Math.log( -x ) / Math.log( t.base );
    case 'pow':
      return Math.sign( x ) * Math.pow( Math.abs( x ), t.exponent );
    case 'symlog':
      return Math.sign( x ) * Math.log1p( Math.abs( x ) / t.constant );
  }
};

const transformOf = ( spec: GpuMapper, prop: string ): Transform => {
  switch( spec.scale ?? 'linear' ){
    case 'log': {
      const base = spec.base ?? 10;

      if( !( base > 0 ) || base === 1 ){ throw err( prop, `log base must be positive and ≠ 1` ); }

      return { kind: 'log', base };
    }
    case 'sqrt': return { kind: 'pow', exponent: 0.5 };
    case 'pow': return { kind: 'pow', exponent: spec.exponent ?? 2 };
    case 'symlog': {
      const constant = spec.constant ?? 1;

      if( !( constant > 0 ) ){ throw err( prop, `symlog constant must be positive` ); }

      return { kind: 'symlog', constant };
    }
    default: return { kind: 'identity' };
  }
};

// -- range resolution --

interface ResolvedRange {
  outputs: ( number | RGBA )[];
  scheme: SchemeDef | null;
}

const resolveRange = ( opts: CompileOpts, spec: GpuMapper, count: number | null ): ResolvedRange => {
  const range = spec.range;

  if( typeof range === 'string' ){
    if( opts.kind !== 'color' ){
      throw err( opts.prop, `scheme ranges are only valid for color properties` );
    }

    const scheme = resolveScheme( range );
    let stops = scheme.stops as readonly string[];

    if( count != null ){
      if( count > stops.length ){
        throw err( opts.prop, `scheme '${range}' has only ${stops.length} entries; ${count} needed` );
      }

      // discrete/ordinal consumers sample the scheme: categorical palettes
      // index from the start, continuous ramps spread across the range
      stops = scheme.kind === 'categorical'
        ? stops.slice( 0, count )
        : Array.from( { length: count }, ( _, i ) =>
          stops[ Math.round( i * ( stops.length - 1 ) / Math.max( 1, count - 1 ) ) ] );
    }

    return {
      outputs: stops.map( hex => [ ...hexToRgb( hex ), 255 ] as RGBA ),
      scheme
    };
  }

  if( !Array.isArray( range ) || range.length < 1 ){
    throw err( opts.prop, `range must be a non-empty array or a scheme name` );
  }

  return { outputs: range.map( v => parseOutput( opts, v ) ), scheme: null };
};

const toOutputStops = ( opts: CompileOpts, spec: GpuMapper, outputs: ( number | RGBA )[] ): OutputStops => {
  if( opts.kind === 'number' ){
    return { kind: 'number', values: Float64Array.from( outputs as number[] ) };
  }

  const space = spec.interpolate ?? 'oklab';
  const n = outputs.length;
  const triples = new Float64Array( n * 3 );
  const alpha = new Float64Array( n );

  for( let i = 0; i < n; i++ ){
    const [ r, g, b, a ] = outputs[ i ] as RGBA;
    const [ c0, c1, c2 ] = space === 'oklab' ? srgbToOklab( r, g, b ) : [ r, g, b ];

    triples[ i * 3 ] = c0;
    triples[ i * 3 + 1 ] = c1;
    triples[ i * 3 + 2 ] = c2;
    alpha[ i ] = a;
  }

  return { kind: 'color', space, triples, alpha };
};

// -- compile --

const numericDomain = ( opts: CompileOpts, spec: GpuMapper ): number[] | null => {
  const domain = spec.domain;

  if( domain == null || domain === 'auto' ){ return null; }

  if( !Array.isArray( domain ) || domain.length < 1
    || domain.some( d => typeof d !== 'number' || !isFinite( d ) ) ){
    throw err( opts.prop, `domain must be an ascending array of finite numbers, or 'auto'` );
  }

  for( let i = 1; i < domain.length; i++ ){
    if( ( domain as number[] )[ i ] <= ( domain as number[] )[ i - 1 ] ){
      throw err( opts.prop, `domain must be strictly ascending` );
    }
  }

  return domain as number[];
};

const evenStops = ( t0: number, t1: number, n: number ): Float64Array => {
  const stops = new Float64Array( n );

  for( let i = 0; i < n; i++ ){
    stops[ i ] = t0 + ( t1 - t0 ) * ( n === 1 ? 0 : i / ( n - 1 ) );
  }

  return stops;
};

const compileContinuous = ( opts: CompileOpts, spec: GpuMapper ): Program => {
  if( opts.kind === 'enum' ){
    throw err( opts.prop, `'${opts.prop}' cannot be continuously interpolated; ` +
      `use scale 'ordinal', 'threshold' or 'quantize', or a passthrough mapper` );
  }

  const diverging = spec.scale === 'diverging';
  const transform = diverging ? { kind: 'identity' } as Transform : transformOf( spec, opts.prop );
  const domain = numericDomain( opts, spec );
  const autoDomain = domain == null;

  if( diverging ){
    if( domain == null || domain.length !== 3 ){
      throw err( opts.prop, `a diverging scale needs an explicit [min, mid, max] domain` );
    }
  } else if( domain != null && domain.length < 2 ){
    throw err( opts.prop, `a continuous domain needs at least 2 stops` );
  }

  if( transform.kind === 'log' && domain != null && domain[ 0 ] <= 0 && domain[ domain.length - 1 ] >= 0 ){
    throw err( opts.prop, `a log domain cannot span or touch 0; use scale 'symlog'` );
  }

  const { outputs, scheme } = resolveRange( opts, spec, null );

  if( scheme?.kind === 'categorical' ){
    throw err( opts.prop, `categorical scheme ranges cannot be interpolated; ` +
      `use a sequential or diverging scheme, or scale 'ordinal'` );
  }

  if( outputs.length < 2 ){
    throw err( opts.prop, `a continuous range needs at least 2 stops` );
  }

  const pairwise = domain != null && domain.length > 2;

  if( pairwise && domain.length !== outputs.length ){
    throw err( opts.prop, `a multi-stop domain must pair 1:1 with the range ` +
      `(domain has ${domain.length} stops, range has ${outputs.length})` );
  }

  // transformed input stops; auto domains fill in at bind time
  let inStops: Float64Array;

  if( autoDomain ){
    inStops = evenStops( 0, 1, outputs.length ); // placeholder until the extent applies
  } else if( diverging ){
    // piecewise-invert around mid: stop j at t = j/(n-1); t ≤ 0.5 lands in
    // [min, mid], t > 0.5 in [mid, max] — diverging is a compiler, not an evaluator
    const [ min, mid, max ] = domain as number[];

    inStops = Float64Array.from( { length: outputs.length }, ( _, j ) => {
      const t = j / ( outputs.length - 1 );

      return t <= 0.5 ? min + ( mid - min ) * ( t / 0.5 ) : mid + ( max - mid ) * ( ( t - 0.5 ) / 0.5 );
    } );
  } else if( pairwise ){
    inStops = Float64Array.from( ( domain as number[] ), d => fwd( transform, d ) );
  } else {
    inStops = evenStops( fwd( transform, domain[ 0 ] ), fwd( transform, domain[ 1 ] ), outputs.length );
  }

  const outStops = toOutputStops( opts, spec, outputs );

  return {
    kind: 'continuous',
    transform,
    inStops,
    lo: autoDomain ? 0 : ( domain as number[] )[ 0 ],
    hi: autoDomain ? 1 : ( domain as number[] )[ ( domain as number[] ).length - 1 ],
    outStops,
    clamp: spec.clamp ?? true,
    autoDomain,
    applied: autoDomain ? null : [ NaN, NaN ]
  };
};

const compileDiscrete = ( opts: CompileOpts, spec: GpuMapper ): Program => {
  if( spec.scale === 'threshold' ){
    const cuts = numericDomain( opts, spec );

    if( cuts == null ){ throw err( opts.prop, `a threshold scale needs an explicit domain of cut points` ); }

    const { outputs } = resolveRange( opts, spec, cuts.length + 1 );

    if( outputs.length !== cuts.length + 1 ){
      throw err( opts.prop, `a threshold range needs domain.length + 1 outputs ` +
        `(${cuts.length} cuts, ${outputs.length} outputs)` );
    }

    return { kind: 'discrete', cuts: Float64Array.from( cuts ), outputs, autoDomain: false, applied: [ NaN, NaN ] };
  }

  // quantize: uniform bins over [lo, hi] (or the live extent)
  const domain = numericDomain( opts, spec );

  if( domain != null && domain.length !== 2 ){
    throw err( opts.prop, `a quantize domain must be [min, max] or 'auto'` );
  }

  const bins = typeof spec.range === 'string' ? spec.bins : ( spec.range as unknown[] ).length;

  if( bins == null || !Number.isInteger( bins ) || bins < 2 ){
    throw err( opts.prop, `quantize needs 'bins' (≥ 2) with a scheme range` );
  }

  const { outputs } = resolveRange( opts, spec, bins );
  const program: Program = {
    kind: 'discrete',
    cuts: new Float64Array( bins - 1 ),
    outputs,
    autoDomain: domain == null,
    applied: domain == null ? null : [ NaN, NaN ]
  };

  if( domain != null ){ quantizeCuts( program.cuts, domain[ 0 ], domain[ 1 ] ); }

  return program;
};

const quantizeCuts = ( cuts: Float64Array, lo: number, hi: number ): void => {
  const k = cuts.length + 1;

  for( let i = 0; i < cuts.length; i++ ){
    cuts[ i ] = lo + ( hi - lo ) * ( i + 1 ) / k;
  }
};

const compileOrdinal = ( opts: CompileOpts, spec: GpuMapper ): Program => {
  const domain = spec.domain;

  if( !Array.isArray( domain ) || domain.length === 0
    || domain.some( d => typeof d !== 'string' && typeof d !== 'number' ) ){
    throw err( opts.prop, `an ordinal scale needs an explicit domain of categories ` +
      `(dictionary order is load-order-dependent)` );
  }

  const { outputs } = resolveRange( opts, spec, domain.length );

  if( outputs.length !== domain.length ){
    throw err( opts.prop, `an ordinal range must pair 1:1 with the domain ` +
      `(${domain.length} categories, ${outputs.length} outputs)` );
  }

  const map = new Map<string | number, number | RGBA>();

  for( let i = 0; i < domain.length; i++ ){
    map.set( domain[ i ] as string | number, outputs[ i ] );
  }

  return { kind: 'ordinal', map };
};

const compileCondition = ( opts: CompileOpts, cond: GpuCondition ): CompiledCondition => {
  if( cond == null || typeof cond.data !== 'string' || cond.data === '' ){
    throw err( opts.prop, `each case condition needs a non-empty 'data' key` );
  }

  const ops = ( Object.keys( cond ) as ( keyof GpuCondition )[] ).filter( k => CONDITION_OPS.has( k ) );

  if( ops.length !== 1 ){
    throw err( opts.prop, `each case condition needs exactly one comparison ` +
      `(${[ ...CONDITION_OPS ].join( ', ' )}); got ${ops.length}` );
  }

  const op = ops[ 0 ] as CompiledCondition['op'];
  const raw = cond[ op ];

  if( op === 'in' ){
    if( !Array.isArray( raw ) || raw.length === 0 ){
      throw err( opts.prop, `'in' needs a non-empty array of values` );
    }

    return { key: cond.data, op, value: raw as ( string | number )[] };
  }

  if( ( op === 'lt' || op === 'lte' || op === 'gt' || op === 'gte' ) && typeof raw !== 'number' ){
    throw err( opts.prop, `'${op}' needs a numeric value` );
  }

  return { key: cond.data, op, value: raw as string | number };
};

const compileCase = ( opts: CompileOpts, spec: GpuCaseMapper ): { program: Program; keys: string[] } => {
  if( spec.case.length === 0 ){
    throw err( opts.prop, `a case mapper needs at least one clause` );
  }

  const keys = new Set<string>();
  const clauses = spec.case.map( clause => {
    if( clause == null || clause.when == null || !( 'then' in clause ) ){
      throw err( opts.prop, `each case clause needs 'when' and 'then'` );
    }

    const conds = ( Array.isArray( clause.when ) ? clause.when : [ clause.when ] ).map( c => {
      const compiled = compileCondition( opts, c );

      keys.add( compiled.key );

      return compiled;
    } );

    return { conds, value: parseOutput( opts, clause.then ) };
  } );

  const elseValue = spec.else !== undefined ? parseOutput( opts, spec.else )
    : spec.fallback !== undefined ? parseOutput( opts, spec.fallback )
    : channelDefaultOf( opts );

  return { program: { kind: 'case', clauses, elseValue }, keys: [ ...keys ] };
};

/** The channel's own default output, used when a case has no `else`/`fallback`. */
const channelDefaultOf = ( opts: CompileOpts ): number | RGBA => {
  // a neutral, valid output per kind; sheets that care set an explicit else
  return opts.kind === 'color' ? [ 0, 0, 0, 255 ] : 0;
};

export const compileMapper = ( spec: GpuMapperSpec, opts: CompileOpts ): CompiledMapper => {
  if( isCaseSpec( spec ) ){
    const { program, keys } = compileCase( opts, spec );

    return {
      key: '', // conditionals are never GPU-packed; the primary-key slot is unused
      keys,
      kind: opts.kind,
      prop: opts.prop,
      program,
      fallback: spec.fallback === undefined ? null : parseOutput( opts, spec.fallback ),
      parseEnum: opts.parseEnum ?? null,
      spec
    };
  }

  if( spec.data === '' ){ throw err( opts.prop, `the data key must be a non-empty string` ); }

  const scale = spec.scale;
  const passthrough = scale == null && spec.domain == null && spec.range == null;

  if( !passthrough && scale != null && !SCALES.has( scale ) ){
    throw err( opts.prop, `unknown scale '${scale}'; ` +
      `supported scales: ${[ ...SCALES ].join( ', ' )}` );
  }

  if( !passthrough && spec.range == null ){
    throw err( opts.prop, `a scaled mapper needs a range` );
  }

  const program: Program = passthrough ? { kind: 'passthrough' }
    : scale === 'ordinal' ? compileOrdinal( opts, spec )
    : scale === 'threshold' || scale === 'quantize' ? compileDiscrete( opts, spec )
    : compileContinuous( opts, spec );

  const fallback = spec.fallback === undefined ? null : parseOutput( opts, spec.fallback );

  return {
    key: spec.data,
    keys: [ spec.data ],
    kind: opts.kind,
    prop: opts.prop,
    program,
    fallback,
    parseEnum: opts.parseEnum ?? null,
    spec
  };
};

// -- live auto-domain extents --

/**
 * The current extent an auto-domain program should map — the numeric data
 * extent, restricted to positive values under a log transform (log can't
 * span zero), `[0, 1]` when the column is empty or non-numeric.
 */
export const autoExtentFor = (
  m: CompiledMapper, data: DataStore, group: GroupName
): [ number, number ] => {
  const positiveOnly = m.program.kind === 'continuous' && m.program.transform.kind === 'log';
  const col = data.column( group, m.key );
  let lo = Infinity;
  let hi = -Infinity;

  if( col?.kind === 'number' ){
    const { values, present } = col;

    for( let i = 0; i < values.length; i++ ){
      if( !present[ i ] ){ continue; }

      const v = values[ i ];

      if( positiveOnly && v <= 0 ){ continue; }

      if( v < lo ){ lo = v; }
      if( v > hi ){ hi = v; }
    }
  } else if( col?.kind === 'mixed' ){
    for( const v of col.values ){
      if( typeof v !== 'number' || !isFinite( v ) || ( positiveOnly && v <= 0 ) ){ continue; }

      if( v < lo ){ lo = v; }
      if( v > hi ){ hi = v; }
    }
  }

  if( lo > hi ){ return positiveOnly ? [ 1, 10 ] : [ 0, 1 ]; }

  return [ lo, hi ];
};

/**
 * Rebuild an auto-domain program's stops for a new extent.  Returns true
 * when the extent differs from the one already applied (the caller then
 * re-evaluates the whole channel, not just the written slots).
 */
export const applyAutoExtent = ( program: Program, lo: number, hi: number ): boolean => {
  if( program.kind === 'continuous' && program.autoDomain ){
    if( program.applied != null && program.applied[ 0 ] === lo && program.applied[ 1 ] === hi ){
      return false;
    }

    const n = program.inStops.length;

    program.inStops = evenStops( fwd( program.transform, lo ), fwd( program.transform, hi ), n );
    program.lo = lo;
    program.hi = hi;
    program.applied = [ lo, hi ];

    return true;
  }

  if( program.kind === 'discrete' && program.autoDomain ){
    if( program.applied != null && program.applied[ 0 ] === lo && program.applied[ 1 ] === hi ){
      return false;
    }

    quantizeCuts( program.cuts, lo, hi );
    program.applied = [ lo, hi ];

    return true;
  }

  return false;
};

// -- evaluation --

/**
 * Segment index + fraction for a transformed input.  The index clamps to
 * the end segments, so an unclamped out-of-domain input extrapolates
 * linearly along them.
 */
const segmentAt = ( inStops: Float64Array, tx: number ): [ number, number ] => {
  const n = inStops.length;
  let i = 0;

  while( i < n - 2 && tx > inStops[ i + 1 ] ){ i++; }

  const span = inStops[ i + 1 ] - inStops[ i ];

  return [ i, span === 0 ? 0 : ( tx - inStops[ i ] ) / span ];
};

const lerpColor = ( outStops: Extract<OutputStops, { kind: 'color' }>, i: number, u: number ): RGBA => {
  const { triples, alpha } = outStops;
  const at = i * 3;
  const next = at + 3;

  return [
    triples[ at ] + ( triples[ next ] - triples[ at ] ) * u,
    triples[ at + 1 ] + ( triples[ next + 1 ] - triples[ at + 1 ] ) * u,
    triples[ at + 2 ] + ( triples[ next + 2 ] - triples[ at + 2 ] ) * u,
    alpha[ i ] + ( alpha[ i + 1 ] - alpha[ i ] ) * u
  ];
};

const continuousEval = ( program: Extract<Program, { kind: 'continuous' }> ) => {
  const { transform, clamp, outStops } = program;

  return ( x: number ): Evaluated | null => {
    const { inStops, lo, hi } = program; // re-read: auto extents rebuild these

    if( transform.kind === 'log' && ( x === 0 || ( x > 0 ) !== ( lo > 0 ) ) ){
      if( !clamp ){ return null; } // sign mismatch is unmappable without clamping

      x = lo > 0 ? lo : hi;
    }

    if( clamp ){ x = Math.min( hi, Math.max( lo, x ) ); }

    const n = inStops.length;
    let i: number;
    let u: number;

    if( inStops[ 0 ] === inStops[ n - 1 ] ){
      // degenerate (single-value) domain maps to the center of the range
      const mid = ( n - 1 ) / 2;

      i = Math.min( n - 2, Math.floor( mid ) );
      u = mid - i;
    } else {
      [ i, u ] = segmentAt( inStops, fwd( transform, x ) );
    }

    if( outStops.kind === 'number' ){
      const values = outStops.values;

      return values[ i ] + ( values[ i + 1 ] - values[ i ] ) * u;
    }

    const [ c0, c1, c2, a ] = lerpColor( outStops, i, u );

    if( outStops.space === 'oklab' ){
      const [ r, g, b ] = oklabToSrgb( c0, c1, c2 );

      return [ r, g, b, Math.round( a ) ];
    }

    return [ Math.round( c0 ), Math.round( c1 ), Math.round( c2 ), Math.round( a ) ];
  };
};

const discreteEval = ( program: Extract<Program, { kind: 'discrete' }> ) => {
  return ( x: number ): Evaluated => {
    const { cuts, outputs } = program;
    let i = 0;

    // d3 semantics: x < cuts[0] → outputs[0]; cuts[i] ≤ x < cuts[i+1] → outputs[i+1]
    while( i < cuts.length && x >= cuts[ i ] ){ i++; }

    return outputs[ i ];
  };
};

/** Test one compiled condition against a data value (missing fails every op). */
const testCondition = ( cond: CompiledCondition, v: unknown ): boolean => {
  if( v === undefined ){ return false; }

  switch( cond.op ){
    case 'eq': return v === cond.value;
    case 'ne': return v !== cond.value;
    case 'in': return ( cond.value as ( string | number )[] ).includes( v as string | number );
    case 'lt': return typeof v === 'number' && v < ( cond.value as number );
    case 'lte': return typeof v === 'number' && v <= ( cond.value as number );
    case 'gt': return typeof v === 'number' && v > ( cond.value as number );
    case 'gte': return typeof v === 'number' && v >= ( cond.value as number );
  }
};

/**
 * Bind a conditional program.  Reads the condition keys per slot straight
 * off the data store (multi-key, no single-column hoist); the first clause
 * whose conditions all hold supplies the value, else the else value.
 */
const bindCase = (
  program: Extract<Program, { kind: 'case' }>, data: DataStore, group: GroupName
): ( slot: number ) => Evaluated => {
  const { clauses, elseValue } = program;

  return slot => {
    for( let c = 0; c < clauses.length; c++ ){
      const conds = clauses[ c ].conds;
      let all = true;

      for( let i = 0; i < conds.length; i++ ){
        if( !testCondition( conds[ i ], data.get( group, slot, conds[ i ].key ) ) ){
          all = false;
          break;
        }
      }

      if( all ){ return clauses[ c ].value; }
    }

    return elseValue;
  };
};

/**
 * Bind a compiled mapper to its data column for bulk evaluation.  Hoists
 * the column arrays out of the per-slot loop; dictionary-encoded string
 * columns evaluate through a dict-index LUT (the GPU form).  Applies the
 * live extent to auto-domain programs on first bind.
 */
export const bindEvaluator = (
  m: CompiledMapper, data: DataStore, group: GroupName,
  channelDefault: Evaluated
): ( slot: number ) => Evaluated => {
  const program = m.program;
  const missing = m.fallback ?? channelDefault;

  if( program.kind === 'const' ){
    const value = program.value;

    return () => value;
  }

  if( program.kind === 'case' ){
    return bindCase( program, data, group );
  }

  if( ( program.kind === 'continuous' || program.kind === 'discrete' ) && program.applied == null ){
    applyAutoExtent( program, ...autoExtentFor( m, data, group ) );
  }

  const col = data.column( group, m.key );

  if( col == null ){ return () => missing; }

  const coerce: ( value: unknown ) => Evaluated | null =
    m.kind === 'number' ? coerceNumber
      : m.kind === 'color' ? coerceColor
      : ( m.parseEnum as NonNullable<CompiledMapper['parseEnum']> );

  if( program.kind === 'ordinal' ){
    const map = program.map;

    if( col.kind === 'string' ){
      const lut = col.dict.map( entry => map.get( entry ) ?? missing );
      const indices = col.indices;

      return slot => {
        const at = slot < indices.length ? indices[ slot ] : 0;

        return at === 0 ? missing : lut[ at - 1 ];
      };
    }

    if( col.kind === 'number' ){
      const { values, present } = col;

      return slot => ( present[ slot ] ? map.get( values[ slot ] ) ?? missing : missing );
    }

    const values = col.values;

    return slot => {
      const v = values[ slot ];

      return ( typeof v === 'string' || typeof v === 'number' ) ? map.get( v ) ?? missing : missing;
    };
  }

  if( program.kind === 'passthrough' ){
    if( col.kind === 'string' ){
      const lut = col.dict.map( entry => coerce( entry ) ?? missing );
      const indices = col.indices;

      return slot => {
        const at = slot < indices.length ? indices[ slot ] : 0;

        return at === 0 ? missing : lut[ at - 1 ];
      };
    }

    if( col.kind === 'number' ){
      const { values, present } = col;

      if( m.kind === 'number' ){
        return slot => ( present[ slot ] ? values[ slot ] : missing );
      }

      return slot => ( present[ slot ] ? coerce( values[ slot ] ) ?? missing : missing );
    }

    const values = col.values;

    return slot => {
      const v = values[ slot ];

      return v === undefined ? missing : coerce( v ) ?? missing;
    };
  }

  // continuous / discrete: numeric input only
  const evalNum = program.kind === 'continuous' ? continuousEval( program ) : discreteEval( program );

  if( col.kind === 'number' ){
    const { values, present } = col;

    return slot => ( present[ slot ] ? evalNum( values[ slot ] ) ?? missing : missing );
  }

  if( col.kind === 'mixed' ){
    const values = col.values;

    return slot => {
      const v = values[ slot ];

      return typeof v === 'number' && isFinite( v ) ? evalNum( v ) ?? missing : missing;
    };
  }

  return () => missing; // string column under a numeric scale: unmappable
};
