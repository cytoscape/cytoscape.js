import type { GroupName } from '../contract.mjs';
import type { GpuDictColumn } from '../gpu-types.mjs';

/*
The data() sidecar: per-(group, key) columns instead of a per-element
properties object.  Each column adapts to what it holds —

- number:  Float64Array + presence bytes
- string:  dictionary-encoded (Uint32Array of 1-based indices into a
           small unique-value list; 0 = absent) — data values repeat
           heavily, so this is both the compact and the wire-friendly
           shape
- mixed:   plain array fallback for booleans/objects/heterogeneous keys

A column starts in the kind of its first value and promotes to mixed on
the first mismatched write.  Bulk ingest takes an index-aligned column
(plain array, Float64Array with NaN holes, or a pre-built dictionary
column straight off the wire) and classifies it in one pass.  NaN means
absent in numeric columns everywhere — JSON can't represent NaN, so
nothing is lost.
*/

interface NumberCol { kind: 'number'; values: Float64Array; present: Uint8Array }
interface StringCol { kind: 'string'; indices: Uint32Array; dict: string[]; index: Map<string, number> }
interface MixedCol { kind: 'mixed'; values: unknown[] }
type Col = NumberCol | StringCol | MixedCol;

export class DataStore {
  private cols: Record<GroupName, Map<string, Col>> = {
    nodes: new Map(), edges: new Map()
  };

  get( group: GroupName, slot: number, key: string ): unknown {
    const col = this.cols[ group ].get( key );

    if( col == null ){ return undefined; }

    switch( col.kind ){
      case 'number':
        return col.present[ slot ] ? col.values[ slot ] : undefined;
      case 'string': {
        const i = slot < col.indices.length ? col.indices[ slot ] : 0;

        return i === 0 ? undefined : col.dict[ i - 1 ];
      }
      case 'mixed':
        return col.values[ slot ];
    }
  }

  /** All present values at a slot, as a fresh object. */
  object( group: GroupName, slot: number ): Record<string, unknown> {
    const out: Record<string, unknown> = {};

    for( const [ key ] of this.cols[ group ] ){
      const value = this.get( group, slot, key );

      if( value !== undefined ){ out[ key ] = value; }
    }

    return out;
  }

  keys( group: GroupName ): string[] {
    return [ ...this.cols[ group ].keys() ];
  }

  set( group: GroupName, slot: number, key: string, value: unknown ): void {
    if( value === undefined ){
      this.clearValue( group, slot, key );

      return;
    }

    const cols = this.cols[ group ];
    let col = cols.get( key );

    if( col == null ){
      col = this.emptyColFor( value );
      cols.set( key, col );
    } else if( !this.fits( col, value ) ){
      col = this.promote( group, key, col );
    }

    this.write( col, slot, value );
  }

  /**
   * Bulk column ingest for `slots[i] = column[i]`.  Classifies the column
   * (all-number → numeric, all-string → dictionary, else mixed) unless it
   * is already a dictionary column, which is adopted index-for-index.
   */
  ingestColumn(
    group: GroupName, slots: Uint32Array,
    key: string, column: ArrayLike<unknown> | GpuDictColumn
  ): void {
    const cols = this.cols[ group ];
    const existing = cols.get( key );

    if( isDictColumn( column ) ){
      if( existing == null ){
        const col: StringCol = {
          kind: 'string',
          indices: new Uint32Array( 0 ),
          dict: [ ...column.dict ],
          index: new Map( column.dict.map( ( v, i ) => [ v, i + 1 ] ) )
        };

        cols.set( key, col );

        for( let i = 0; i < slots.length; i++ ){
          const at = column.indices[ i ];

          if( at === 0 ){ continue; }

          const slot = slots[ i ];

          if( slot >= col.indices.length ){ col.indices = growU32( col.indices, slot ); }

          col.indices[ slot ] = at; // dictionaries align, so indices adopt directly
        }
      } else {
        for( let i = 0; i < slots.length; i++ ){
          const at = column.indices[ i ];

          if( at !== 0 ){ this.set( group, slots[ i ], key, column.dict[ at - 1 ] ); }
        }
      }

      return;
    }

    for( let i = 0; i < slots.length; i++ ){
      const value = column[ i ];

      // NaN means absent in numeric columns (JSON can't carry NaN)
      if( value == null || ( typeof value === 'number' && Number.isNaN( value ) ) ){ continue; }

      this.set( group, slots[ i ], key, value );
    }
  }

  /** Clear every data value at a slot (element removal). */
  clearSlot( group: GroupName, slot: number ): void {
    for( const key of this.cols[ group ].keys() ){
      this.clearValue( group, slot, key );
    }
  }

  /** The column in wire-facing shape, for serialization. */
  column( group: GroupName, key: string ):
    | { kind: 'number'; values: Float64Array; present: Uint8Array }
    | { kind: 'string'; indices: Uint32Array; dict: string[] }
    | { kind: 'mixed'; values: unknown[] }
    | undefined {
    return this.cols[ group ].get( key );
  }

  // -- internals --

  private emptyColFor( value: unknown ): Col {
    if( typeof value === 'number' && !Number.isNaN( value ) ){
      return { kind: 'number', values: new Float64Array( 0 ), present: new Uint8Array( 0 ) };
    }

    if( typeof value === 'string' ){
      return { kind: 'string', indices: new Uint32Array( 0 ), dict: [], index: new Map() };
    }

    return { kind: 'mixed', values: [] };
  }

  private fits( col: Col, value: unknown ): boolean {
    switch( col.kind ){
      case 'number': return typeof value === 'number' && !Number.isNaN( value );
      case 'string': return typeof value === 'string';
      case 'mixed': return true;
    }
  }

  private promote( group: GroupName, key: string, col: Col ): MixedCol {
    const values: unknown[] = [];
    const len = col.kind === 'number' ? col.values.length : col.kind === 'string' ? col.indices.length : 0;

    for( let slot = 0; slot < len; slot++ ){
      const value = this.get( group, slot, key );

      if( value !== undefined ){ values[ slot ] = value; }
    }

    const mixed: MixedCol = { kind: 'mixed', values };

    this.cols[ group ].set( key, mixed );

    return mixed;
  }

  private write( col: Col, slot: number, value: unknown ): void {
    switch( col.kind ){
      case 'number': {
        if( slot >= col.values.length ){
          col.values = growF64( col.values, slot );
          col.present = growU8( col.present, slot );
        }

        col.values[ slot ] = value as number;
        col.present[ slot ] = 1;
        break;
      }
      case 'string': {
        if( slot >= col.indices.length ){
          col.indices = growU32( col.indices, slot );
        }

        const str = value as string;
        let at = col.index.get( str );

        if( at == null ){
          col.dict.push( str );
          at = col.dict.length;
          col.index.set( str, at );
        }

        col.indices[ slot ] = at;
        break;
      }
      case 'mixed': {
        col.values[ slot ] = value;
        break;
      }
    }
  }

  private clearValue( group: GroupName, slot: number, key: string ): void {
    const col = this.cols[ group ].get( key );

    if( col == null ){ return; }

    switch( col.kind ){
      case 'number':
        if( slot < col.present.length ){ col.present[ slot ] = 0; }
        break;
      case 'string':
        if( slot < col.indices.length ){ col.indices[ slot ] = 0; }
        break;
      case 'mixed':
        if( slot < col.values.length ){ col.values[ slot ] = undefined; }
        break;
    }
  }
}

export const isDictColumn = ( column: ArrayLike<unknown> | GpuDictColumn ): column is GpuDictColumn => {
  return !Array.isArray( column ) && !ArrayBuffer.isView( column )
    && ( column as GpuDictColumn ).dict != null && ( column as GpuDictColumn ).indices != null;
};

const growF64 = ( old: Float64Array, slot: number ): Float64Array => {
  const next = new Float64Array( Math.max( 64, old.length * 2, slot + 1 ) );

  next.set( old );

  return next;
};

const growU8 = ( old: Uint8Array, slot: number ): Uint8Array => {
  const next = new Uint8Array( Math.max( 64, old.length * 2, slot + 1 ) );

  next.set( old );

  return next;
};

const growU32 = ( old: Uint32Array, slot: number ): Uint32Array => {
  const next = new Uint32Array( Math.max( 64, old.length * 2, slot + 1 ) );

  next.set( old );

  return next;
};
