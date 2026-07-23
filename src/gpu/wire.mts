import { isColumnarElements, isPackedIds, toColumnarElements } from './columnar.mjs';
import type {
  GpuColumnarEdges, GpuColumnarElements, GpuColumnarNodes,
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
positions, edge sources, edge targets, node ids (offsets + blob), edge
ids, then the u8 selection columns — each 4-byte-wide section aligned to
4.  Absent optional columns (see the flag bits) take zero bytes.

Zero-length ids serialize as holes and deserialize to `undefined`
(auto-generated on ingest), so an explicitly empty-string id does not
round-trip — it becomes a generated id.
*/

const MAGIC = 0x45475943; // bytes 'C','Y','G','E' read as LE u32
const VERSION = 1;
const HEADER_BYTES = 24;

const F_NODE_POSITIONS = 1;
const F_NODE_IDS = 2;
const F_NODE_SELECTED = 4;
const F_NODE_SELECTABLE = 8;
const F_EDGE_IDS = 16;
const F_EDGE_SELECTED = 32;
const F_EDGE_SELECTABLE = 64;

type Section = Float32Array | Uint32Array | Uint8Array;

const align4 = ( n: number ): number => ( n + 3 ) & ~3;

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

  let size = HEADER_BYTES;

  for( const s of sections ){
    if( s.BYTES_PER_ELEMENT === 4 ){ size = align4( size ); }

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
    if( s.BYTES_PER_ELEMENT === 4 ){ off = align4( off ); }

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

  if( base % 4 !== 0 ){
    // typed-array views need element-aligned byte offsets
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

  if( version !== VERSION ){
    throw new Error( `Unsupported serialized elements version ${version} (this build reads version ${VERSION})` );
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
  const read4 = <T extends Float32Array | Uint32Array>( Ctor: new ( b: ArrayBuffer, o: number, l: number ) => T, len: number ): T => {
    off = align4( off );

    const view = new Ctor( buffer, base + off, len );

    off += len * 4;

    return view;
  };

  const nodes: GpuColumnarNodes = { count: nodeCount };
  let sources: Uint32Array | null = null;
  let targets: Uint32Array | null = null;

  if( flags & F_NODE_POSITIONS ){ nodes.positions = read4( Float32Array, nodeCount * 2 ); }

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

  const out: GpuColumnarElements = { columnar: true, nodes };

  if( edgeCount > 0 ){
    const edges: GpuColumnarEdges = { count: edgeCount, sources: sources!, targets: targets! };

    if( edgeIds != null ){ edges.ids = edgeIds; }
    if( flags & F_EDGE_SELECTED ){ edges.selected = readU8( edgeCount ); }
    if( flags & F_EDGE_SELECTABLE ){ edges.selectable = readU8( edgeCount ); }

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

