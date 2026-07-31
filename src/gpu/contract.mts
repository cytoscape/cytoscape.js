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
/**
 * Edge-only, store-managed (derived, not a user-visible switch): set when
 * edge.curveParams holds a non-straight kind.  The cull kernels split the
 * edge draw into a straight and a curved stream on this bit — per-edge
 * curve params can't bind in every kernel (the 8-storage-buffer budget),
 * but flags already do.
 */
export const FLAG_CURVED = 1024;
/**
 * Edge-only, store-managed (round 12b): set when the edge's curve is not
 * chord-bounded — a taxi route (its excursion from the chord is
 * position-dependent, so no frame-level slack can bound it), or a
 * multibezier/segments edge whose weights extrapolate outside [0, 1].
 * Kernels that can't bind the per-edge params (cull, edge-glyph cull)
 * test these edges against the endpoint AABB grown by slack + chord
 * length instead of the slack-grown chord.
 */
export const FLAG_CURVED_BOX = 2048;

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
/** custom polygon (round 13 C3): unit points in the node poly blob;
 * the record ref (offset | count << 24) rides borderGeom[0] — the
 * corner-radius word is meaningless for polygons. */
export const SHAPE_POLYGON_CUSTOM = 14;

// -- edge curve kinds (rounds 12a/12b; stored in edge.curveParams[3]) --

export const CURVE_STRAIGHT = 0;
export const CURVE_BEZIER = 1;
export const CURVE_LOOP = 2;
/** unbundled bezier: one quadratic piece per control point, C1-joined
 * through the inserted midpoints (v3's multibezier).  Param lists live in
 * the curve param blob; the params column holds the header (see below). */
export const CURVE_MULTI = 3;
/** segments / round-segments: straight legs through the segment points,
 * with optional round-corner arcs.  Blob-backed like CURVE_MULTI. */
export const CURVE_SEGMENTS = 4;
/** taxi / round-taxi: axis-aligned routing derived from live positions in
 * the vertex stage / CPU twin (the blob holds only the fixed params).
 * Taxi routes are not chord-bounded — they carry FLAG_CURVED_BOX. */
export const CURVE_TAXI = 5;
/**
 * haystack (12c): a straight line between hash-stable endpoint offsets
 * *inside* each node body — params [srcAngle, tgtAngle, radius, kind],
 * offsets = (cos/sin(angle) · outerHalf · radius).  A *straight-stream*
 * kind: FLAG_CURVED stays clear, so haystack edges ride the straight
 * pipeline — decimated at far zoom like any straight edge (the 12a
 * "curved stream is never decimated" trade-off does not apply).
 */
export const CURVE_HAYSTACK = 6;
/**
 * straight-triangle (12c): a filled triangle from the source (base
 * width = edge width, centered on the source boundary point) tapering
 * to the target boundary point.  Also a straight-stream kind (no
 * FLAG_CURVED); params carry only the kind.
 */
export const CURVE_TRIANGLE = 7;
/**
 * Kind flag (12c), OR-ed onto a blob-backed kind (CURVE_MULTI /
 * CURVE_SEGMENTS / CURVE_TAXI): the blob record is prefixed by a
 * 10-float manual-endpoint block (see store/curve-blob.mts) resolving
 * `source/target-endpoint` and `source/target-distance-from-node`.
 * Strip with `kind & 7` (or kind - 8) for the base kind.  A *straight*
 * edge with manual endpoints derives as CURVE_MULTI | CURVE_HAS_ENDPT
 * with n = 0 (the route degenerates to the chord between the resolved
 * endpoints); a *bundled bezier* with manual endpoints promotes to
 * CURVE_MULTI n = 1 (its control point is the same weighted-frame +
 * perpendicular-offset formula).
 */
export const CURVE_HAS_ENDPT = 8;

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
  /**
   * Float32Array(2·cap) — *derived*: size/2 + borderWidth/2 per axis, the
   * outer half-extent (v3's outerWidth/outerHeight frame).  Maintained by
   * the store on every node.size / node.borderWidth write, never written
   * directly.  The curve/arrow/edge-label shaders bind this single column
   * instead of size + border, which keeps their vertex stages within
   * WebGPU's base 8-storage-buffer budget (and leaves room for the 12b
   * curve param blob).
   */
  | 'node.outerHalf'
  /**
   * Float32Array(4·cap) — ghost props (round 13 A1): [offsetX, offsetY,
   * ghostOpacity, enabled].  The decided simplified form: a ghost
   * duplicates only the basic node body (shape, border, background) at
   * the offset — one extra instance draw off its own cull stream, drawn
   * after edges/arrows and under the nodes, never a full node redraw
   * (labels and decorations excluded).
   */
  | 'node.ghost'
  /**
   * Uint32Array(4·cap) — border/corner/outline geometry (rounds 13
   * B2/B5): [cornerRadius × 256 (fixed-point model px; 0xffffffff =
   * 'auto', v3's min(w/4, h/4, 8)), borderPosition (bits 0..7: 0
   * center — v3's default, 1 inside, 2 outside) | shape id << 16
   * (round 13 C2: a copy of node.shape so the node FS can drop the
   * shapes binding — the slot went to the gradient column; the style
   * engine writes both together), outline rgba (outline-opacity
   * folded into alpha; a=0 = no outline), outlineWidth × 256 |
   * outlineOffset × 256 << 16 (u16 fixed-point each)].  Read by the
   * node/ghost FS, the depth prepass, the node cull (outward borders
   * and outlines grow the quad), and the CPU pick (the
   * round-rectangle inside test).
   */
  | 'node.borderGeom'
  /**
   * Uint32Array(8·cap) — background gradient (round 13 C2), sRGB
   * stops (v3's canvas gradients), constants-only, capped at 5 (a
   * recorded cap): [meta (kind 0 solid | 1 linear | 2 radial, bits
   * 0..1; direction id bits 2..4; stop count bits 5..7), c0..c4
   * (packed rgba), pos0..3 (×255 in one word), pos4].  Same layout
   * for edges as 'edge.gradient' (line-fill; no direction — linear
   * runs along the edge, radial from the midpoint).
   */
  | 'node.gradient'
  /**
   * Uint32Array(4·cap) — overlay/underlay records (round 13 A2), one
   * column per layer: [rgba (layer opacity folded into alpha; a=0 =
   * disabled), padding × 256 (fixed-point model px), shape (0
   * round-rectangle, 1 ellipse), cornerRadius × 256 (0xffffffff =
   * 'auto' — v3's min(w/4, h/4, 8), resolved in the shader from live
   * extents)].  The underlay draws under the node body (after ghosts),
   * the overlay above the nodes (before labels).
   */
  | 'node.overlay'
  | 'node.underlay'
  | 'node.flags' // Uint32Array(cap)
  | 'edge.endpoints' // Uint32Array(2·cap), source,target node *slots*
  | 'edge.lineColor' // Uint8Array(4·cap)
  | 'edge.width' // Float32Array(cap)
  | 'edge.opacity' // Float32Array(cap)
  | 'edge.flags' // Uint32Array(cap)
  | 'edge.sourceArrow' // Uint8Array(4·cap), arrowhead RGBA; a=0 means no arrow at this end
  | 'edge.targetArrow' // Uint8Array(4·cap)
  | 'edge.lineStyle' // Uint32Array(cap), LINE_* ids
  /**
   * Uint32Array(cap) — ARROW_* ids packed source | target<<8, plus
   * (round 13 B7) hollow-fill flags at bits 16 (source) / 17 (target)
   * and the edge's arrow-scale quantized ×16 in bits 24..31 (0..15.94;
   * readback is quantized — recorded).  Round 13 C1 packs the
   * mid-arrow shapes into the free bits: mid-source at 18..20,
   * mid-target at 21..23 (3 bits each — every ARROW_* id fits).
   */
  | 'edge.arrowShapes'
  /** Uint8Array(4·cap) ×2 — mid-arrow colors per end (round 13 C1),
   * folded like the end arrows (opacity × line-opacity; a=0 = none).
   * Mid arrows anchor at the curve/route midpoint with the midpoint
   * tangent (mid-source pointing backward), and are always filled at
   * the standard width (mid fill/width props are unsupported — a
   * recorded scope note). */
  | 'edge.midSourceArrow'
  | 'edge.midTargetArrow'
  /** Float32Array(2·cap) — hollow-arrow stroke widths per end, model px
   * (round 13 B7; 'match-line' and % forms resolve at style-write). */
  | 'edge.arrowWidths'
  /**
   * Uint32Array(2·cap) — edge overlay/underlay records (round 13 A2),
   * one column per layer: [rgba (layer opacity folded; a=0 = disabled),
   * strokeWidth × 256 (fixed-point model px — the edge width + 2 ×
   * layer padding, derived at style-write so the layer shaders need no
   * width binding)].  The underlay strokes under the edges, the overlay
   * over edges + arrows; both ride the existing edge cull streams with
   * a VS collapse for disabled instances.
   */
  | 'edge.overlay'
  | 'edge.underlay'
  /**
   * Float32Array(4·cap) — line-dash-pattern (round 13 B3), normalized
   * to two on/off pairs in model px (a 2-entry pattern repeats; odd
   * patterns double, canvas semantics; longer patterns truncate — a
   * recorded cap).  Applies when line-style is dashed; dotted keeps
   * [1, 1].
   */
  /**
   * Uint32Array(2·cap) — line-outline casing (round 13 B4), the layer
   * record layout: [rgba (folded by opacity × line-opacity; a=0 =
   * disabled), strokeWidth × 256 (edge width + line-outline-width —
   * v3's context.lineWidth)].  Strokes under the edge line, over the
   * edge underlay, via the shared layer entry points.
   */
  | 'edge.gradient'
  | 'edge.casing'
  | 'edge.dashPattern'
  /** Float32Array(2·cap) — [line-dash-offset (model px), line-cap
   * (0 butt, 1 round, 2 square)] (round 13 B3). */
  | 'edge.dashMeta'
  /**
   * Float32Array(4·cap) — per-edge curve parameters (rounds 12a/12b),
   * all position-independent so drags/layouts/position tweens follow
   * on-GPU with zero rebuild.  [3] is the curve kind (CURVE_*, exact
   * small ints in f32 — packed here so the curve shaders stay within
   * the vertex stage's 8-storage-buffer budget):
   * - CURVE_STRAIGHT: unused
   * - CURVE_BEZIER: [0] signed control offset d (model px, edge frame),
   *   [1] control-point-weight
   * - CURVE_LOOP: [0] out angle, [1] in angle (radians), [2] control
   *   radius (model px)
   * - CURVE_MULTI / CURVE_SEGMENTS / CURVE_TAXI (12b, blob-backed
   *   headers): [0] record offset into the curve param blob (exact
   *   integer in f32), [1] the conservative chord deviation max|d|
   *   (model px; 0 for taxi — box-bounded, see FLAG_CURVED_BOX),
   *   [2] interior point count n (0 for taxi — the routing derives its
   *   own points).  Record layouts are documented in
   *   store/curve-blob.mts.  The CURVE_HAS_ENDPT flag (12c) marks a
   *   10-float manual-endpoint block prefixed to the record; [1] then
   *   also covers the endpoint px offsets.
   * - CURVE_HAYSTACK (12c): [0] source angle, [1] target angle
   *   (radians), [2] haystack-radius — straight-stream kind (no
   *   FLAG_CURVED)
   * - CURVE_TRIANGLE (12c): straight-stream kind, no params
   */
  | 'edge.curveParams';

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
  spec( 'node.outerHalf', 'nodes', Float32Array, 2 ),
  spec( 'node.ghost', 'nodes', Float32Array, 4 ),
  spec( 'node.borderGeom', 'nodes', Uint32Array, 4 ),
  spec( 'node.gradient', 'nodes', Uint32Array, 8 ),
  spec( 'node.overlay', 'nodes', Uint32Array, 4 ),
  spec( 'node.underlay', 'nodes', Uint32Array, 4 ),
  spec( 'node.flags', 'nodes', Uint32Array, 1 ),
  spec( 'edge.endpoints', 'edges', Uint32Array, 2 ),
  spec( 'edge.lineColor', 'edges', Uint8Array, 4 ),
  spec( 'edge.width', 'edges', Float32Array, 1 ),
  spec( 'edge.opacity', 'edges', Float32Array, 1 ),
  spec( 'edge.flags', 'edges', Uint32Array, 1 ),
  spec( 'edge.sourceArrow', 'edges', Uint8Array, 4 ),
  spec( 'edge.targetArrow', 'edges', Uint8Array, 4 ),
  spec( 'edge.lineStyle', 'edges', Uint32Array, 1 ),
  spec( 'edge.arrowShapes', 'edges', Uint32Array, 1 ),
  spec( 'edge.arrowWidths', 'edges', Float32Array, 2 ),
  spec( 'edge.midSourceArrow', 'edges', Uint8Array, 4 ),
  spec( 'edge.midTargetArrow', 'edges', Uint8Array, 4 ),
  spec( 'edge.overlay', 'edges', Uint32Array, 2 ),
  spec( 'edge.gradient', 'edges', Uint32Array, 8 ),
  spec( 'edge.casing', 'edges', Uint32Array, 2 ),
  spec( 'edge.dashPattern', 'edges', Float32Array, 4 ),
  spec( 'edge.dashMeta', 'edges', Float32Array, 2 ),
  spec( 'edge.underlay', 'edges', Uint32Array, 2 ),
  spec( 'edge.curveParams', 'edges', Float32Array, 4 )
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
  /**
   * Curve param blob dirt (round 12b), when any: a coalesced [start,
   * end) float span, or resized = realloc + full re-upload — the same
   * rules as columns.  Header rewrites (offsets after a blob
   * compaction) ride edge.curveParams spans as usual.
   */
  curveBlob?: { resized: boolean; start: number; end: number };
  /** Node polygon-point blob dirt (round 13 C3) — same rules. */
  polyBlob?: { resized: boolean; start: number; end: number };
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
  /** text-background-shape (round 13 B6): 0 rectangle, 1 round-rectangle */
  bgShape: number;
  /** packed text-border RGBA (text-border-opacity folded; a=0 = none) — B6 */
  bgBorderColor: number;
  /** text-border-width, model px (draws inward from the padded box) — B6 */
  bgBorderWidth: number;
  /** min-zoomed-font-size (round 13 D2), device px; 0 = no floor.  The
   * glyph cull hides the whole label when fontSize x zoomDpr drops
   * below it (v3's eleTextBiggerThanMin). */
  minZoomedFontSize: number;
  /**
   * text-rotation: autorotate (edge labels only; always false for nodes).
   * The renderer rotates the glyph run to the edge's angle in the VS,
   * flipped so text never reads upside-down (v3's undirected-slope rule:
   * the baseline angle stays within (-90°, 90°]).
   */
  rotate: boolean;
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
  /** The 12b curve param blob backing the params-column headers; the
   * renderer mirrors [0, curveBlobLength()) into a storage buffer. */
  curveBlob(): Float32Array;
  curveBlobLength(): number;
  /** The C3 custom-polygon unit-point blob (x,y pairs; refs ride
   * borderGeom[0] as offset | count << 24). */
  polyBlob(): Float32Array;
  polyBlobLength(): number;
  /** The node's label, or undefined when it has none. */
  labelAt( slot: number, group?: GroupName ): LabelEntry | undefined;
  /** Slots whose labels changed since the last call; returns-and-clears (default: nodes). */
  takeLabelDirty( group?: GroupName ): number[];
}

/** A validated reference to an element slot; stale when `gen` no longer matches. */
export interface Ref {
  group: GroupName;
  slot: number;
  gen: number;
}
