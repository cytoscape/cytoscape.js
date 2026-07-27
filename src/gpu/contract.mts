/*
The model↔renderer contract for the GPU prototype (issue #3486, pass 1).

This file is the co-signed source of truth for the columnar layout shared by
the CPU-canonical model (`store/`) and the WebGPU renderer (`render/`):
column ids and their backing formats, shared element flag bits, node shape
ids, the per-frame `StoreDelta`, and the `ModelView` surface the renderer
reads from.  Both halves must agree on everything in here; change it first
when the layout changes.
*/

export type GroupName = 'nodes' | 'edges';

// -- element flag bits (shared by node.flags and edge.flags) --

export const FLAG_ALIVE = 1;
export const FLAG_VISIBLE = 2;
export const FLAG_SELECTED = 4;
export const FLAG_SELECTABLE = 8;
export const FLAG_GRABBED = 16;
export const FLAG_HOVERED = 32;
export const FLAG_GRABBABLE = 64;
export const FLAG_LOCKED = 128;
export const FLAG_ACTIVE = 256;
export const FLAG_PANNABLE = 512;

// -- node shape ids (u32 because WGSL can't index u8 arrays) --

export const SHAPE_CIRCLE = 0;
export const SHAPE_ELLIPSE = 1;
export const SHAPE_RECTANGLE = 2;
export const SHAPE_ROUND_RECTANGLE = 3;
// polygon shapes (round 10): unit points in shape-points.mts, evaluated in
// normalized space in both the WGSL SDF and the CPU pick
export const SHAPE_TRIANGLE = 4;
export const SHAPE_PENTAGON = 5;
export const SHAPE_HEXAGON = 6;
export const SHAPE_HEPTAGON = 7;
export const SHAPE_OCTAGON = 8;
export const SHAPE_DIAMOND = 9;
export const SHAPE_RHOMBOID = 10;
export const SHAPE_VEE = 11;
export const SHAPE_STAR = 12;
export const SHAPE_TAG = 13;

// -- edge line-style ids (round 10) --

export const LINE_SOLID = 0;
export const LINE_DASHED = 1;
export const LINE_DOTTED = 2;

// -- arrowhead shape ids (round 10; packed source | target<<8 in edge.arrowShapes) --

export const ARROW_NONE = 0;
export const ARROW_TRIANGLE = 1;
export const ARROW_VEE = 2;
export const ARROW_CHEVRON = 3;
export const ARROW_CIRCLE = 4;
export const ARROW_SQUARE = 5;
export const ARROW_DIAMOND = 6;
export const ARROW_TEE = 7;

// -- columns --

export type ColumnId =
  | 'node.position' // Float32Array(2·cap), interleaved x,y
  | 'node.size' // Float32Array(2·cap), w,h
  | 'node.fillColor' // Uint8Array(4·cap), RGBA bytes; WGSL binds array<u32> + unpack4x8unorm
  | 'node.borderColor' // Uint8Array(4·cap)
  | 'node.borderWidth' // Float32Array(cap)
  | 'node.opacity' // Float32Array(cap)
  | 'node.shape' // Uint32Array(cap)
  | 'node.flags' // Uint32Array(cap)
  | 'edge.endpoints' // Uint32Array(2·cap), source,target node *slots*
  | 'edge.lineColor' // Uint8Array(4·cap)
  | 'edge.width' // Float32Array(cap)
  | 'edge.opacity' // Float32Array(cap)
  | 'edge.flags' // Uint32Array(cap)
  | 'edge.sourceArrow' // Uint8Array(4·cap), arrowhead RGBA; a=0 means no arrow at this end
  | 'edge.targetArrow' // Uint8Array(4·cap)
  | 'edge.lineStyle' // Uint32Array(cap), LINE_* ids
  | 'edge.arrowShapes'; // Uint32Array(cap), ARROW_* ids packed source | target<<8

export type ColumnArray = Float32Array | Uint32Array | Uint8Array;

export type ColumnCtor = Float32ArrayConstructor | Uint32ArrayConstructor | Uint8ArrayConstructor;

export interface ColumnSpec {
  id: ColumnId;
  group: GroupName;
  ctor: ColumnCtor;
  /** components (array elements) per slot */
  components: number;
  /** bytes per slot (components × bytes per element) */
  bytesPerSlot: number;
}

const spec = ( id: ColumnId, group: GroupName, ctor: ColumnCtor, components: number ): ColumnSpec => ( {
  id, group, ctor, components,
  bytesPerSlot: components * ctor.BYTES_PER_ELEMENT
} );

export const COLUMN_SPECS: ColumnSpec[] = [
  spec( 'node.position', 'nodes', Float32Array, 2 ),
  spec( 'node.size', 'nodes', Float32Array, 2 ),
  spec( 'node.fillColor', 'nodes', Uint8Array, 4 ),
  spec( 'node.borderColor', 'nodes', Uint8Array, 4 ),
  spec( 'node.borderWidth', 'nodes', Float32Array, 1 ),
  spec( 'node.opacity', 'nodes', Float32Array, 1 ),
  spec( 'node.shape', 'nodes', Uint32Array, 1 ),
  spec( 'node.flags', 'nodes', Uint32Array, 1 ),
  spec( 'edge.endpoints', 'edges', Uint32Array, 2 ),
  spec( 'edge.lineColor', 'edges', Uint8Array, 4 ),
  spec( 'edge.width', 'edges', Float32Array, 1 ),
  spec( 'edge.opacity', 'edges', Float32Array, 1 ),
  spec( 'edge.flags', 'edges', Uint32Array, 1 ),
  spec( 'edge.sourceArrow', 'edges', Uint8Array, 4 ),
  spec( 'edge.targetArrow', 'edges', Uint8Array, 4 ),
  spec( 'edge.lineStyle', 'edges', Uint32Array, 1 ),
  spec( 'edge.arrowShapes', 'edges', Uint32Array, 1 )
];

const specsById = new Map<ColumnId, ColumnSpec>( COLUMN_SPECS.map( s => [ s.id, s ] ) );

export const columnSpec = ( id: ColumnId ): ColumnSpec => {
  const s = specsById.get( id );

  if( s == null ){
    throw new Error( `Unknown GPU column '${id}'` );
  }

  return s;
};

export const columnSpecsForGroup = ( group: GroupName ): ColumnSpec[] => {
  return COLUMN_SPECS.filter( s => s.group === group );
};

// -- per-frame delta --

/** A coalesced dirty range of slots [start, end) for one column. */
export interface DirtySpan {
  column: ColumnId;
  start: number;
  end: number;
}

/**
 * What changed since the last `takeDelta()`.  One coalesced span per column
 * at most; when a group's capacity grew, `resized` is set and the renderer
 * must reallocate that group's buffers and do a full re-upload (spans for
 * that group may be ignored in that case).
 */
export interface StoreDelta {
  resized: { nodes: boolean; edges: boolean };
  spans: DirtySpan[];
  nodeHighWater: number;
  edgeHighWater: number;
}

// -- labels --

/**
 * Per-node label state (model-only sidecar, never uploaded as a column).
 * The renderer derives SDF glyph instances from it; glyph instances
 * reference the node *slot*, so positions are read from the node position
 * buffer on-GPU and labels follow drags/layouts without rebuilds.  Only
 * text/style changes dirty a label.
 */
export interface LabelEntry {
  text: string;
  /** model px */
  fontSize: number;
  /** RGBA bytes packed little-endian (r | g<<8 | b<<16 | a<<24) */
  color: number;
  /** y offset of the text block's top from the node center, model px (includes marginY) */
  anchorY: number;
  /** text-margin-x, model px (shifts the run horizontally) */
  marginX: number;
  /** text-margin-y, model px (kept for readback; already folded into anchorY) */
  marginY: number;
  /** text-outline width in model px (0 = none) */
  outlineWidth: number;
  /** packed outline RGBA (text-outline-opacity folded into alpha) */
  outlineColor: number;
  /** packed background RGBA (text-background-opacity folded; a=0 = none) */
  bgColor: number;
  /** text-background-padding, model px */
  bgPadding: number;
}

// -- the read surface the renderer consumes --

/**
 * The renderer's view of the model: CPU-canonical typed-array columns plus
 * dirty bookkeeping.  Reads are always served from these arrays; uploads are
 * byte-for-byte copies of the dirty spans.
 */
export interface ModelView {
  capacity( group: GroupName ): number;
  highWater( group: GroupName ): number;
  column( id: ColumnId ): ColumnArray;
  hasDirty(): boolean;
  /** Returns the accumulated delta and clears it. */
  takeDelta(): StoreDelta;
  /** `cb` fires at most once per microtask when the model becomes dirty; returns an unsubscribe fn. */
  onInvalidate( cb: () => void ): () => void;
  /** The node's label, or undefined when it has none. */
  labelAt( slot: number ): LabelEntry | undefined;
  /** Node slots whose labels changed since the last call; returns-and-clears. */
  takeLabelDirty(): number[];
}

/** A validated reference to an element slot; stale when `gen` no longer matches. */
export interface Ref {
  group: GroupName;
  slot: number;
  gen: number;
}
