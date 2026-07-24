import { srgbToOklab } from '../style-schemes.mjs';
import type { GroupName, ColumnId } from '../contract.mjs';
import type { DataStore } from '../store/data-store.mjs';
import type { CompiledMapper, Evaluated, Program, Transform, RGBA } from '../style-scales.mjs';

/*
CPU-side packing for the GPU mapper eval pass: lowers compiled paint-
channel mapper programs (style-scales.mts) into the buffers the eval
kernel consumes.  Pure functions over typed arrays — no device — so the
byte layout is Node-testable; the kernel wiring lives in the renderer.

Layout (all little-endian, WGSL-uniform compatible):

MapperProgram — 16 words / 64 B per program:
  words  0..3   meta   (u32): target channel, scale kind, flags, dataBase
  words  4..7   domain (f32): lo, hi, p0, p1 — untransformed domain
                endpoints (clamping happens pre-transform); p0 = pow
                exponent | log base, p1 = symlog constant
  words  8..11  table  (u32): outBase, count, inBase, 0 — vec4 indices
                into the stop table
  words 12..15  fallback (f32): normalized rgba (colors) or scalar in x

Stop table — array<vec4f>:
  - transformed input stops (continuous) / cut points (discrete): floats
    packed 4 per vec4 starting at inBase
  - output stops: one vec4 per stop at outBase — continuous colors as
    (L, a, b, alpha) in OKLab (or normalized sRGB under FLAG.SRGB),
    discrete colors as normalized straight sRGB (no interpolation, so
    the exact bytes ride along), scalars in x

Data regions — per distinct mapped key, one region of alignSlots(cap)
f32 values (f64 data narrowed once into a persistent shadow; dict
indices bitcast as u32) plus the same span of present bytes, mirrored
byte-identical and bound as array<u32> (4 slots per word).  dataBase is
the region's element offset; the present word/lane derive from it, so no
second base is stored.
*/

export const PROGRAM_WORDS = 16;
export const PROGRAM_BYTES = PROGRAM_WORDS * 4;

/** meta.y — the kernel's evaluation families (compile-time lowering did the rest). */
export const KIND = {
  /** the datum is the value (numeric passthrough) */
  PASSTHROUGH: 0,
  /** piecewise-linear over transformed stops; 1..4 pick the transform */
  IDENTITY: 1,
  LOG: 2,
  POW: 3,
  SYMLOG: 4,
  /** cut-point search into discrete outputs (threshold/quantize) */
  DISCRETE: 5,
  /** dict-index LUT (string ordinal; packed by the dict path) */
  ORDINAL: 6,
  /** fixed output (arrow color riding a mapped opacity) */
  CONSTANT: 7
} as const;

/** meta.z flag bits. */
export const FLAG = {
  /** output is a color (packed to the column as rgba8); else a scalar */
  COLOR: 1,
  /** multiply the output alpha by the evaluated opacity (arrow folding) */
  MUL_ALPHA: 2,
  CLAMP: 4,
  /** the data region holds bitcast u32 dict indices, not f32 values */
  DICT: 8,
  /** color stops are normalized sRGB (interpolate: 'srgb'), not OKLab */
  SRGB: 16
} as const;

/** meta.x — which stored channel the program writes, per group kernel. */
export const TARGETS: Record<GroupName, Record<string, { target: number; column: ColumnId }>> = {
  nodes: {
    'background-color': { target: 0, column: 'node.fillColor' },
    'border-color': { target: 1, column: 'node.borderColor' },
    'opacity': { target: 2, column: 'node.opacity' }
  },
  edges: {
    'line-color': { target: 0, column: 'edge.lineColor' },
    'opacity': { target: 1, column: 'edge.opacity' }
    // source/target arrows join with the in-kernel alpha folding
  }
};

export interface PackInput {
  m: CompiledMapper;
  /** resolved missing-value output: spec fallback ?? channel default */
  fallback: Evaluated;
}

export interface PackedPrograms {
  group: GroupName;
  /** programCount × PROGRAM_BYTES, uniform-buffer ready */
  programData: ArrayBuffer;
  programCount: number;
  /** vec4-packed stop/LUT table (empty ⇒ bind a 1-vec4 dummy) */
  stopData: Float32Array;
  /** distinct mapped data keys, in data-region order */
  keys: string[];
  /** columns the kernel writes — the mirror's gpu-owned set */
  ownedColumns: ColumnId[];
  /** mappers that stay CPU-evaluated (unsupported prop/kind/column) */
  skipped: CompiledMapper[];
}

const transformKind = ( t: Transform ): number => {
  switch( t.kind ){
    case 'identity': return KIND.IDENTITY;
    case 'log': return KIND.LOG;
    case 'pow': return KIND.POW;
    case 'symlog': return KIND.SYMLOG;
  }
};

const transformParam = ( t: Transform ): number => {
  switch( t.kind ){
    case 'identity': return 0;
    case 'log': return t.base;
    case 'pow': return t.exponent;
    case 'symlog': return t.constant;
  }
};

/** Whether this program can evaluate in the kernel against its current column. */
const packable = ( group: GroupName, m: CompiledMapper, data: DataStore ): boolean => {
  if( TARGETS[ group ][ m.prop ] == null ){ return false; }

  const col = data.column( group, m.key );

  // mixed columns and the string paths (ordinal/passthrough dict LUTs)
  // stay CPU-evaluated until the dict path lands
  if( col != null && col.kind !== 'number' ){ return false; }

  switch( m.program.kind ){
    case 'passthrough': return m.kind === 'number';
    case 'continuous':
    case 'discrete': return true;
    default: return false;
  }
};

/** vec4-align and append floats; returns the vec4 base index. */
const appendPacked = ( table: number[], floats: ArrayLike<number> ): number => {
  const base = table.length / 4;

  for( let i = 0; i < floats.length; i++ ){ table.push( floats[ i ] ); }

  while( table.length % 4 !== 0 ){ table.push( 0 ); }

  return base;
};

/** Append one vec4 per entry; returns the vec4 base index. */
const appendVec4s = ( table: number[], vec4s: number[][] ): number => {
  const base = table.length / 4;

  for( const v of vec4s ){ table.push( v[ 0 ], v[ 1 ], v[ 2 ], v[ 3 ] ); }

  return base;
};

const colorVec4 = ( rgba: RGBA, oklab: boolean ): number[] => {
  const [ r, g, b, a ] = rgba;

  if( !oklab ){ return [ r / 255, g / 255, b / 255, a / 255 ]; }

  const [ L, A, B ] = srgbToOklab( r, g, b );

  return [ L, A, B, a / 255 ];
};

const fallbackVec4 = ( fallback: Evaluated ): number[] => {
  return typeof fallback === 'number'
    ? [ fallback, 0, 0, 0 ]
    : [ fallback[ 0 ] / 255, fallback[ 1 ] / 255, fallback[ 2 ] / 255, fallback[ 3 ] / 255 ];
};

/**
 * Lower the group's paint mappers into the kernel's program + stop
 * buffers.  Programs whose output feeds another program's alpha folding
 * (edge opacity) sort first so the fold reads an evaluated value.
 */
export const packPrograms = (
  group: GroupName, inputs: PackInput[], data: DataStore, cap: number
): PackedPrograms => {
  const eligible: PackInput[] = [];
  const skipped: CompiledMapper[] = [];

  for( const input of inputs ){
    if( packable( group, input.m, data ) ){
      eligible.push( input );
    } else {
      skipped.push( input.m );
    }
  }

  // opacity first: arrow programs (commit-later) multiply by its result
  eligible.sort( ( a, b ) =>
    ( a.m.prop === 'opacity' ? 0 : 1 ) - ( b.m.prop === 'opacity' ? 0 : 1 ) );

  const keys: string[] = [];
  const keyIndex = ( key: string ): number => {
    let at = keys.indexOf( key );

    if( at < 0 ){ at = keys.length; keys.push( key ); }

    return at;
  };

  const table: number[] = [];
  const programData = new ArrayBuffer( Math.max( eligible.length, 1 ) * PROGRAM_BYTES );
  const u32 = new Uint32Array( programData );
  const f32 = new Float32Array( programData );
  const ownedColumns: ColumnId[] = [];
  const capAligned = alignSlots( cap );

  for( let p = 0; p < eligible.length; p++ ){
    const { m, fallback } = eligible[ p ];
    const { target, column } = TARGETS[ group ][ m.prop ];
    const program = m.program;
    const at = p * PROGRAM_WORDS;
    const isColor = m.kind === 'color';
    const dataBase = keyIndex( m.key ) * capAligned;

    ownedColumns.push( column );

    let kind: number;
    let flags = isColor ? FLAG.COLOR : 0;
    let lo = 0;
    let hi = 0;
    let p0 = 0;
    let p1 = 0;
    let outBase = 0;
    let count = 0;
    let inBase = 0;

    if( program.kind === 'passthrough' ){
      kind = KIND.PASSTHROUGH;
    } else if( program.kind === 'continuous' ){
      kind = transformKind( program.transform );
      lo = program.lo;
      hi = program.hi;
      p0 = transformParam( program.transform );

      if( program.clamp ){ flags |= FLAG.CLAMP; }

      const out = program.outStops;

      count = program.inStops.length;
      inBase = appendPacked( table, program.inStops );

      if( out.kind === 'number' ){
        outBase = appendVec4s( table, [ ...out.values ].map( v => [ v, 0, 0, 0 ] ) );
      } else {
        if( out.space === 'srgb' ){ flags |= FLAG.SRGB; }

        const vec4s: number[][] = [];

        for( let i = 0; i < count; i++ ){
          const a = out.alpha[ i ] / 255;

          vec4s.push( out.space === 'srgb'
            ? [ out.triples[ i * 3 ] / 255, out.triples[ i * 3 + 1 ] / 255, out.triples[ i * 3 + 2 ] / 255, a ]
            : [ out.triples[ i * 3 ], out.triples[ i * 3 + 1 ], out.triples[ i * 3 + 2 ], a ] );
        }

        outBase = appendVec4s( table, vec4s );
      }
    } else { // discrete (threshold/quantize; ordinal never packs here)
      const discrete = program as Extract<Program, { kind: 'discrete' }>;

      kind = KIND.DISCRETE;
      count = discrete.outputs.length;
      inBase = appendPacked( table, discrete.cuts );
      outBase = appendVec4s( table, discrete.outputs.map( out =>
        typeof out === 'number' ? [ out, 0, 0, 0 ] : colorVec4( out, false ) ) );
    }

    u32[ at ] = target;
    u32[ at + 1 ] = kind;
    u32[ at + 2 ] = flags;
    u32[ at + 3 ] = dataBase;
    f32[ at + 4 ] = lo;
    f32[ at + 5 ] = hi;
    f32[ at + 6 ] = p0;
    f32[ at + 7 ] = p1;
    u32[ at + 8 ] = outBase;
    u32[ at + 9 ] = count;
    u32[ at + 10 ] = inBase;
    u32[ at + 11 ] = 0;

    const fb = fallbackVec4( fallback );

    f32[ at + 12 ] = fb[ 0 ];
    f32[ at + 13 ] = fb[ 1 ];
    f32[ at + 14 ] = fb[ 2 ];
    f32[ at + 15 ] = fb[ 3 ];
  }

  return {
    group,
    programData,
    programCount: eligible.length,
    stopData: Float32Array.from( table.length > 0 ? table : [ 0, 0, 0, 0 ] ),
    keys,
    ownedColumns,
    skipped
  };
};

// -- data regions --

/** Data regions are 4-slot aligned so present bytes pack whole u32 words. */
export const alignSlots = ( cap: number ): number => ( cap + 3 ) & ~3;

export interface DataRegions {
  /** keys.length × capAligned f32 values (dict indices bitcast as u32) */
  values: Float32Array;
  /** keys.length × capAligned present bytes (bound as array<u32>) */
  present: Uint8Array;
  keys: string[];
  capAligned: number;
}

/**
 * Build the packed per-key data shadow for a group: one aligned region
 * per key, f64 values narrowed to f32 with their present mask.
 */
export const buildDataRegions = (
  group: GroupName, keys: string[], data: DataStore, cap: number
): DataRegions => {
  const capAligned = alignSlots( cap );
  const regions: DataRegions = {
    values: new Float32Array( Math.max( keys.length * capAligned, 4 ) ),
    present: new Uint8Array( Math.max( keys.length * capAligned, 4 ) ),
    keys,
    capAligned
  };

  for( let i = 0; i < keys.length; i++ ){
    updateDataRegion( regions, group, i, data, 0, cap );
  }

  return regions;
};

/**
 * Refresh one key's region over [start, end) from the data column.
 * Returns the touched byte range within `values` (the present range is
 * the same offsets at 1 byte per slot, 4-byte aligned by construction).
 */
export const updateDataRegion = (
  regions: DataRegions, group: GroupName, keyIndex: number,
  data: DataStore, start: number, end: number
): { valueByteStart: number; valueByteEnd: number } => {
  const base = keyIndex * regions.capAligned;
  const col = data.column( group, regions.keys[ keyIndex ] );
  const to = Math.min( end, regions.capAligned );

  if( col?.kind === 'number' ){
    const { values, present } = col;

    for( let slot = start; slot < to; slot++ ){
      const ok = slot < values.length && present[ slot ] === 1;

      regions.values[ base + slot ] = ok ? Math.fround( values[ slot ] ) : 0;
      regions.present[ base + slot ] = ok ? 1 : 0;
    }
  } else if( col?.kind === 'string' ){
    const u32 = new Uint32Array( regions.values.buffer );
    const indices = col.indices;

    for( let slot = start; slot < to; slot++ ){
      const at = slot < indices.length ? indices[ slot ] : 0;

      u32[ base + slot ] = at;
      regions.present[ base + slot ] = at > 0 ? 1 : 0;
    }
  } else {
    for( let slot = start; slot < to; slot++ ){
      regions.values[ base + slot ] = 0;
      regions.present[ base + slot ] = 0;
    }
  }

  return {
    valueByteStart: ( base + start ) * 4,
    valueByteEnd: ( base + to ) * 4
  };
};
