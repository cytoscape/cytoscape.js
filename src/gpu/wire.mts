import { isColumnarElements, isPackedIds, toColumnarElements } from './columnar.mjs';
import { isDictColumn } from './store/data-store.mjs';
import type {
  GpuColumnarEdges, GpuColumnarElements, GpuColumnarNodes, GpuDataColumn,
  GpuElementDefinition, GpuElementsDefinition, GpuPackedIds
} from './gpu-types.mjs';

/*
Binary wire format for the columnar elements form: one little-endian
ArrayBuffer — a fixed header followed by the columns — so a graph can be
fetched as binary and passed straight to `options.elements`/`cy.add()`
with no JSON parse.  Numeric columns deserialize as zero-copy views into
the buffer; ids are a UTF-8 blob + prefix byte offsets, and stay packed
through deserialization — the store ingests the bytes directly and only
decodes an id string when the element is actually touched.

Header (6 × u32 LE): magic 'CYGE', version, nodeCount, edgeCount,
presence flags, total byte length (truncation check; trailing padding
beyond it is ignored).  Sections follow in a fixed order — node
positions, node parents (v3, round 14.8: u32 payload indices,
0xffffffff = orphan), edge sources, edge targets, node ids (offsets +
blob), edge ids, the u8 selection columns, then the data() blocks — each multi-byte
section aligned to its element width (f64 columns to 8).  Absent
optional columns (see the flag bits) take zero bytes.

A data() block is: u32 keyCount, then per key — u32 name byte length,
the UTF-8 name, u32 kind, and the column: kind 0 numeric (f64 × count,
NaN = absent), kind 1 dictionary strings (u32 dictCount, dict offsets +
blob, u32 1-based indices × count, 0 = absent), kind 2 JSON fallback
(offsets + blob of JSON text per present element, zero length =
absent).  Numeric and index columns deserialize zero-copy; only the
small dictionaries and the rare JSON values decode.

Zero-length ids serialize as holes and deserialize to `undefined`
(auto-generated on ingest), so an explicitly empty-string id does not
round-trip — it becomes a generated id.
*/

const MAGIC = 0x45475943; // bytes 'C','Y','G','E' read as LE u32
// v3 added the node parent section (round 14.8); v2 added the data()
// blocks; v1 was never released.  The reader accepts v2 buffers (a v2
// buffer can never carry the parent flag).
const VERSION = 3;
const MIN_VERSION = 2;
const HEADER_BYTES = 24;

const F_NODE_POSITIONS = 1;
const F_NODE_IDS = 2;
const F_NODE_SELECTED = 4;
const F_NODE_SELECTABLE = 8;
const F_EDGE_IDS = 16;
const F_EDGE_SELECTED = 32;
const F_EDGE_SELECTABLE = 64;
const F_NODE_DATA = 128;
const F_EDGE_DATA = 256;
const F_NODE_PARENT = 512; // round 14.8 (v3 buffers only)

const KIND_NUMBER = 0;
const KIND_DICT = 1;
const KIND_JSON = 2;

type Section = Float32Array | Float64Array | Uint32Array | Uint8Array;

const alignTo = ( n: number, width: number ): number => ( n + width - 1 ) & ~( width - 1 );

const assertLittleEndian = (): void => {
  if( new Uint8Array( new Uint32Array( [ 1 ] ).buffer )[ 0 ] !== 1 ){
    throw new Error( 'Serialized elements buffers are little-endian; this platform is big-endian' );
  }
};

/** Any binary input `add()`/`options.elements` should route through `deserializeElements`. */
export const isSerializedElements = ( x: unknown ): x is ArrayBuffer | ArrayBufferView => {
  return x instanceof ArrayBuffer || ArrayBuffer.isView( x );
};

/**
 * Serialize elements (definition form or columnar form) into one
 * transferable/fetchable ArrayBuffer.  `deserializeElements` (or passing
 * the buffer straight to `options.elements`/`cy.add()`) reverses it.
 */
export const serializeElements = (
  elements: GpuElementsDefinition | GpuElementDefinition | GpuColumnarElements
): ArrayBuffer => {
  assertLittleEndian();

  const payload = isColumnarElements( elements ) ? elements : toColumnarElements( elements );
  const nodes = payload.nodes;
  const edges = payload.edges;
  const nodeCount = nodes?.count ?? 0;
  const edgeCount = edges?.count ?? 0;

  let flags = 0;
  const sections: Section[] = [];
  const push = ( bit: number, ...views: Section[] ): void => {
    flags |= bit;
    sections.push( ...views );
  };

  if( nodes?.positions != null && nodeCount > 0 ){
    if( nodes.positions.length < nodeCount * 2 ){
      throw new Error( `Columnar nodes must provide ${nodeCount * 2} position values (x,y per node)` );
    }

    push( F_NODE_POSITIONS, nodes.positions.subarray( 0, nodeCount * 2 ) );
  }

  if( nodes?.parent != null && nodeCount > 0 ){
    if( nodes.parent.length < nodeCount ){
      throw new Error( `Columnar node parent column must hold ${nodeCount} entries` );
    }

    push( F_NODE_PARENT, nodes.parent.subarray( 0, nodeCount ) );
  }

  if( edgeCount > 0 ){
    if( edges!.sources == null || edges!.targets == null
        || edges!.sources.length < edgeCount || edges!.targets.length < edgeCount ){
      throw new Error( `Columnar edges must provide ${edgeCount} sources and targets` );
    }

    sections.push( edges!.sources.subarray( 0, edgeCount ), edges!.targets.subarray( 0, edgeCount ) );
  }

  const nodeIds = encodeIds( nodes?.ids, nodeCount );
  const edgeIds = encodeIds( edges?.ids, edgeCount );

  if( nodeIds != null ){ push( F_NODE_IDS, nodeIds.offsets, nodeIds.blob ); }
  if( edgeIds != null ){ push( F_EDGE_IDS, edgeIds.offsets, edgeIds.blob ); }

  const u8 = ( bit: number, column: Uint8Array | undefined, count: number, what: string ): void => {
    if( column == null || count === 0 ){ return; }

    if( column.length < count ){
      throw new Error( `Columnar ${what} column must have ${count} entries` );
    }

    push( bit, column.subarray( 0, count ) );
  };

  u8( F_NODE_SELECTED, nodes?.selected, nodeCount, 'node selected' );
  u8( F_NODE_SELECTABLE, nodes?.selectable, nodeCount, 'node selectable' );
  u8( F_EDGE_SELECTED, edges?.selected, edgeCount, 'edge selected' );
  u8( F_EDGE_SELECTABLE, edges?.selectable, edgeCount, 'edge selectable' );

  const nodeData = encodeDataBlock( nodes?.data, nodeCount );
  const edgeData = encodeDataBlock( edges?.data, edgeCount );

  if( nodeData != null ){ push( F_NODE_DATA, ...nodeData ); }
  if( edgeData != null ){ push( F_EDGE_DATA, ...edgeData ); }

  let size = HEADER_BYTES;

  for( const s of sections ){
    size = alignTo( size, s.BYTES_PER_ELEMENT );
    size += s.byteLength;
  }

  const buffer = new ArrayBuffer( size );
  const dv = new DataView( buffer );
  const bytes = new Uint8Array( buffer );

  dv.setUint32( 0, MAGIC, true );
  dv.setUint32( 4, VERSION, true );
  dv.setUint32( 8, nodeCount, true );
  dv.setUint32( 12, edgeCount, true );
  dv.setUint32( 16, flags, true );
  dv.setUint32( 20, size, true );

  let off = HEADER_BYTES;

  for( const s of sections ){
    off = alignTo( off, s.BYTES_PER_ELEMENT );
    bytes.set( new Uint8Array( s.buffer, s.byteOffset, s.byteLength ), off );
    off += s.byteLength;
  }

  return buffer;
};

/**
 * Deserialize a `serializeElements` buffer (or a view over one) back into
 * the columnar elements form.  Numeric columns are zero-copy views into
 * the given buffer; a misaligned view is copied once to realign.
 */
export const deserializeElements = ( input: ArrayBuffer | ArrayBufferView ): GpuColumnarElements => {
  assertLittleEndian();

  let buffer: ArrayBuffer;
  let base: number;
  let byteLength: number;

  if( ArrayBuffer.isView( input ) ){
    buffer = input.buffer as ArrayBuffer;
    base = input.byteOffset;
    byteLength = input.byteLength;
  } else {
    buffer = input;
    base = 0;
    byteLength = input.byteLength;
  }

  if( base % 8 !== 0 ){
    // typed-array views need element-aligned byte offsets (f64 columns need 8)
    const copy = new Uint8Array( byteLength );

    copy.set( new Uint8Array( buffer, base, byteLength ) );
    buffer = copy.buffer;
    base = 0;
  }

  const dv = new DataView( buffer, base, byteLength );

  if( byteLength < HEADER_BYTES || dv.getUint32( 0, true ) !== MAGIC ){
    throw new Error( 'Not a serialized elements buffer (see cytoscapeGpu.serializeElements)' );
  }

  const version = dv.getUint32( 4, true );

  if( version < MIN_VERSION || version > VERSION ){
    throw new Error(
      `Unsupported serialized elements version ${version} ` +
      `(this build reads versions ${MIN_VERSION}-${VERSION})` );
  }

  const nodeCount = dv.getUint32( 8, true );
  const edgeCount = dv.getUint32( 12, true );
  const flags = dv.getUint32( 16, true );
  const total = dv.getUint32( 20, true );

  if( byteLength < total ){
    throw new Error( `Serialized elements buffer is truncated: expected ${total} bytes, got ${byteLength}` );
  }

  let off = HEADER_BYTES;

  const readU8 = ( len: number ): Uint8Array => {
    const view = new Uint8Array( buffer, base + off, len );

    off += len;

    return view;
  };
  const read4 = <T extends Float32Array | Float64Array | Uint32Array>(
    Ctor: ( new ( b: ArrayBuffer, o: number, l: number ) => T ) & { BYTES_PER_ELEMENT: number },
    len: number
  ): T => {
    off = alignTo( off, Ctor.BYTES_PER_ELEMENT );

    const view = new Ctor( buffer, base + off, len );

    off += len * Ctor.BYTES_PER_ELEMENT;

    return view;
  };
  const readScalar = (): number => read4( Uint32Array, 1 )[ 0 ];

  const nodes: GpuColumnarNodes = { count: nodeCount };
  let sources: Uint32Array | null = null;
  let targets: Uint32Array | null = null;

  if( flags & F_NODE_POSITIONS ){ nodes.positions = read4( Float32Array, nodeCount * 2 ); }
  if( flags & F_NODE_PARENT ){ nodes.parent = read4( Uint32Array, nodeCount ); }

  if( edgeCount > 0 ){
    sources = read4( Uint32Array, edgeCount );
    targets = read4( Uint32Array, edgeCount );
  }

  // ids stay packed (blob + offsets): the store ingests the bytes
  // directly and decodes id strings lazily, per element touched
  const readPacked = ( count: number ): GpuPackedIds => {
    const offsets = read4( Uint32Array, count + 1 );

    return { offsets, blob: readU8( offsets[ count ] ) };
  };

  if( flags & F_NODE_IDS ){ nodes.ids = readPacked( nodeCount ); }

  const edgeIds = ( flags & F_EDGE_IDS ) ? readPacked( edgeCount ) : undefined;

  if( flags & F_NODE_SELECTED ){ nodes.selected = readU8( nodeCount ); }
  if( flags & F_NODE_SELECTABLE ){ nodes.selectable = readU8( nodeCount ); }

  const edgeSelected = ( flags & F_EDGE_SELECTED ) ? readU8( edgeCount ) : undefined;
  const edgeSelectable = ( flags & F_EDGE_SELECTABLE ) ? readU8( edgeCount ) : undefined;

  const readDataBlock = ( count: number ): Record<string, GpuDataColumn> => {
    const keyCount = readScalar();
    const data: Record<string, GpuDataColumn> = {};
    const decoder = new TextDecoder();

    for( let k = 0; k < keyCount; k++ ){
      const name = decoder.decode( readU8( readScalar() ) );
      const kind = readScalar();

      if( kind === KIND_NUMBER ){
        data[ name ] = read4( Float64Array, count ); // zero-copy; NaN = absent
      } else if( kind === KIND_DICT ){
        const dictCount = readScalar();
        const dictOffsets = read4( Uint32Array, dictCount + 1 );
        const dictBlob = readU8( dictOffsets[ dictCount ] );
        const dict = new Array<string>( dictCount );

        for( let i = 0; i < dictCount; i++ ){
          dict[ i ] = decoder.decode( dictBlob.subarray( dictOffsets[ i ], dictOffsets[ i + 1 ] ) );
        }

        data[ name ] = { dict, indices: read4( Uint32Array, count ) }; // indices zero-copy
      } else if( kind === KIND_JSON ){
        const offsets = read4( Uint32Array, count + 1 );
        const blob = readU8( offsets[ count ] );
        const values = new Array<unknown>( count );

        for( let i = 0; i < count; i++ ){
          if( offsets[ i + 1 ] > offsets[ i ] ){
            values[ i ] = JSON.parse( decoder.decode( blob.subarray( offsets[ i ], offsets[ i + 1 ] ) ) );
          }
        }

        data[ name ] = values;
      } else {
        throw new Error( `Unknown serialized data column kind ${kind}` );
      }
    }

    return data;
  };

  if( flags & F_NODE_DATA ){ nodes.data = readDataBlock( nodeCount ); }

  const edgeData = ( flags & F_EDGE_DATA ) ? readDataBlock( edgeCount ) : undefined;

  const out: GpuColumnarElements = { columnar: true, nodes };

  if( edgeCount > 0 ){
    const edges: GpuColumnarEdges = { count: edgeCount, sources: sources!, targets: targets! };

    if( edgeIds != null ){ edges.ids = edgeIds; }
    if( edgeSelected != null ){ edges.selected = edgeSelected; }
    if( edgeSelectable != null ){ edges.selectable = edgeSelectable; }
    if( edgeData != null ){ edges.data = edgeData; }

    out.edges = edges;
  }

  return out;
};

/** UTF-8 blob + prefix byte offsets; holes (and empty strings) get zero length. */
const encodeIds = (
  ids: ( string | undefined )[] | GpuPackedIds | undefined,
  count: number
): { offsets: Uint32Array; blob: Uint8Array } | null => {
  if( ids == null || count === 0 ){ return null; }

  if( isPackedIds( ids ) ){ // already the wire representation
    if( ids.offsets.length < count + 1 ){
      throw new Error( `Packed ids must have ${count + 1} offsets` );
    }

    const offsets = ids.offsets.subarray( 0, count + 1 );

    return { offsets, blob: ids.blob.subarray( 0, offsets[ count ] ) };
  }

  const encoder = new TextEncoder();
  const offsets = new Uint32Array( count + 1 );
  const joined = ids.join( '' ); // holes join as ''
  const blob = encoder.encode( joined );

  if( blob.length === joined.length ){
    // ASCII: per-id byte length === string length
    let end = 0;

    for( let i = 0; i < count; i++ ){
      end += ids[ i ]?.length ?? 0;
      offsets[ i + 1 ] = end;
    }
  } else {
    // non-ASCII: measure each id's UTF-8 length for exact byte offsets
    let end = 0;

    for( let i = 0; i < count; i++ ){
      const id = ids[ i ];

      if( id != null && id.length > 0 ){ end += encoder.encode( id ).length; }

      offsets[ i + 1 ] = end;
    }
  }

  return { offsets, blob };
};

/** One data() block: keyCount, then (name, kind, column) per key. */
const encodeDataBlock = (
  data: Record<string, GpuDataColumn> | undefined,
  count: number
): Section[] | null => {
  if( data == null || count === 0 ){ return null; }

  const keys = Object.keys( data );

  if( keys.length === 0 ){ return null; }

  const encoder = new TextEncoder();
  const scalar = ( n: number ): Uint32Array => Uint32Array.of( n );
  const sections: Section[] = [ scalar( keys.length ) ];

  for( const key of keys ){
    const name = encoder.encode( key );
    const column = data[ key ];

    sections.push( scalar( name.length ), name );

    if( isDictColumn( column ) ){
      if( column.indices.length < count ){
        throw new Error( `Columnar data column '${key}' must have ${count} entries` );
      }

      sections.push(
        scalar( KIND_DICT ),
        ...dictSections( column.dict, encoder ),
        column.indices.subarray( 0, count )
      );
      continue;
    }

    if( column instanceof Float64Array ){
      if( column.length < count ){
        throw new Error( `Columnar data column '${key}' must have ${count} entries` );
      }

      sections.push( scalar( KIND_NUMBER ), column.subarray( 0, count ) );
      continue;
    }

    // plain column: classify by its present values
    let allNumber = true;
    let allString = true;

    for( let i = 0; i < count; i++ ){
      const v = column[ i ];

      if( v == null || ( typeof v === 'number' && Number.isNaN( v ) ) ){ continue; }
      if( typeof v !== 'number' ){ allNumber = false; }
      if( typeof v !== 'string' ){ allString = false; }
    }

    if( allNumber ){
      const values = new Float64Array( count ).fill( NaN ); // NaN = absent

      for( let i = 0; i < count; i++ ){
        const v = column[ i ];

        if( typeof v === 'number' && !Number.isNaN( v ) ){ values[ i ] = v; }
      }

      sections.push( scalar( KIND_NUMBER ), values );
    } else if( allString ){
      const dict: string[] = [];
      const index = new Map<string, number>();
      const indices = new Uint32Array( count );

      for( let i = 0; i < count; i++ ){
        const v = column[ i ];

        if( v == null ){ continue; }

        let at = index.get( v as string );

        if( at == null ){
          dict.push( v as string );
          at = dict.length;
          index.set( v as string, at );
        }

        indices[ i ] = at;
      }

      sections.push( scalar( KIND_DICT ), ...dictSections( dict, encoder ), indices );
    } else {
      // JSON fallback for booleans/objects/mixed; zero length = absent
      const offsets = new Uint32Array( count + 1 );
      const parts: ( Uint8Array | null )[] = new Array( count );
      let total = 0;

      for( let i = 0; i < count; i++ ){
        const v = column[ i ];
        const json = v === undefined ? undefined : JSON.stringify( v );

        parts[ i ] = json === undefined ? null : encoder.encode( json );
        total += parts[ i ]?.length ?? 0;
        offsets[ i + 1 ] = total;
      }

      const blob = new Uint8Array( total );

      for( let i = 0; i < count; i++ ){
        if( parts[ i ] != null ){ blob.set( parts[ i ]!, offsets[ i ] ); }
      }

      sections.push( scalar( KIND_JSON ), offsets, blob );
    }
  }

  return sections;
};

const dictSections = ( dict: string[], encoder: TextEncoder ): Section[] => {
  const offsets = new Uint32Array( dict.length + 1 );
  const parts = dict.map( v => encoder.encode( v ) );
  let total = 0;

  for( let i = 0; i < parts.length; i++ ){
    total += parts[ i ].length;
    offsets[ i + 1 ] = total;
  }

  const blob = new Uint8Array( total );

  for( let i = 0; i < parts.length; i++ ){ blob.set( parts[ i ], offsets[ i ] ); }

  return [ Uint32Array.of( dict.length ), offsets, blob ];
};

