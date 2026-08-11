//#region src/image-registry.d.mts
/** What a decoder yields: an opaque raster handle plus its dimensions.
 * `data` is an ImageBitmap in the browser; tests pass anything. */
interface DecodedImage {
  data: unknown;
  width: number;
  height: number;
  /** vector sources (SVG) re-raster losslessly at any target size */
  vector: boolean;
}
interface ImageDecodeOpts {
  crossOrigin: string;
  /** raster size hint (px, longest side); 0 = the source's natural size */
  targetPx: number;
  /** rasterize for the single-channel sdf-icon path */
  sdf: boolean;
}
type ImageDecoder = (url: string, opts: ImageDecodeOpts) => Promise<DecodedImage>;
interface ImageEntry {
  id: number;
  url: string;
  kind: number;
  crossOrigin: string;
  refCount: number;
  status: number;
  /** opaque decoded raster (renderer uploads it; null until ready) */
  data: unknown;
  /** native source dims (vector: the intrinsic size of the last raster) */
  width: number;
  height: number;
  vector: boolean;
  /** rgba tier index into IMAGE_TIER_SIZES; -1 until ready and for sdf entries */
  tier: number;
  /** longest side of the current raster (vector promotion compares demand to this) */
  rasterPx: number;
}
declare class ImageRegistry {
  private entries;
  private freeIds;
  private byKey;
  private decoder;
  private readyQueue;
  private freedQueue;
  private warned;
  private tiers;
  /** decodes in flight (initial and promotion re-rasters alike) */
  private inFlight;
  private settleResolvers;
  /** fires when any entry changes state (ready, failed, freed) — the
   * store routes it to the dirty scheduler so a frame redraws */
  onChange: (() => void) | null;
  /**
   * @param tierSizes — the rgba tier ladder, ascending; the last entry is
   *   the cap tier.  The renderer passes a list trimmed or extended to its
   *   `imageMaxSize`, so tier indices are only meaningful against the
   *   registry that produced them
   */
  constructor(tierSizes?: readonly number[]);
  /** the smallest tier covering px, else the cap tier */
  tierFor(px: number): number;
  /**
   * Take a reference on the entry for (kind, crossOrigin, url), creating
   * and kicking a decode for it if it is new.  Every `acquire` must be
   * paired with exactly one `release`.  Returns immediately: a fresh entry
   * is `IMAGE_PENDING` and carries no raster until the decode lands (or
   * forever, if no decoder is attached).  A url that already failed once
   * is created straight into `IMAGE_FAILED` without re-kicking.
   *
   * @param url — the image source
   * @param kind — `IMAGE_KIND_AUTO` or `IMAGE_KIND_SDF`
   * @param crossOrigin — part of the dedup key, so the same url under two
   *   crossorigin modes is two entries
   * @returns the entry id — a recycled slot, valid only until its last
   *   `release`
   */
  acquire(url: string, kind: number, crossOrigin?: string): number;
  /**
   * Drop one reference.  On the last one the entry is destroyed, its id
   * pushed to the free list and to `takeFreed()` so the renderer can
   * reclaim the texture layer, and `onChange` fires.  Releasing an
   * already-freed id is a no-op; over-releasing a live id is not caught.
   *
   * @param id — an id from `acquire`
   */
  release(id: number): void;
  /**
   * The live entry for an id, or null if it was freed.  The entry is the
   * registry's own mutable object, not a copy: its `status`, `data`, and
   * `tier` change under the caller as decodes and promotions land, so read
   * it per frame rather than holding it.
   *
   * @param id — an id from `acquire`
   */
  get(id: number): ImageEntry | null;
  /** Attach (or replace) the async rasterizer; kicks every pending entry. */
  setDecoder(decoder: ImageDecoder | null): void;
  /**
   * Re-raster a vector entry to cover an on-screen demand (px, longest
   * side).  Snaps to the smallest tier covering the demand, clamped at
   * the cap tier; raster sources and already-covered demands no-op.
   */
  promote(id: number, demandPx: number): void;
  /** entry ids decoded since the last call; returns-and-clears */
  takeReady(): number[];
  /** entry ids freed since the last call; returns-and-clears */
  takeFreed(): number[];
  /** How many distinct entries are held, in any status. */
  liveCount(): number;
  /** true while any decode (initial or promotion) is in flight */
  busy(): boolean;
  /** Resolves once no decode is in flight (immediately when idle) —
   * the export path awaits this after promoting at export scale (15.6). */
  whenSettled(): Promise<void>;
  private settle;
  /** How many entries are still awaiting a first decode — an O(n) scan of
   * the entry table, so for tests and diagnostics, not per frame. */
  pendingCount(): number;
  private kick;
}
//#endregion
//#region src/contract.d.mts
type GroupName = 'nodes' | 'edges';
type ColumnId = 'node.position' | 'node.size' | 'node.fillColor' | 'node.borderColor' | 'node.borderWidth' | 'node.opacity' | 'node.shape' |
/**
 * Float32Array(2·cap) — *derived*: size/2 + borderWidth/2 per axis, the
 * outer half-extent (v3's outerWidth/outerHeight frame).  Maintained by
 * the store on every node.size / node.borderWidth write, never written
 * directly.  The curve/arrow/edge-label shaders bind this single column
 * instead of size + border, which keeps their vertex stages within
 * WebGPU's base 8-storage-buffer budget (and leaves room for the 12b
 * curve param blob).
 */
'node.outerHalf' |
/**
 * Float32Array(4·cap) — *derived* (round 58): [outerHalf.x,
 * outerHalf.y, shapeId, 0] — `node.outerHalf` and `node.shape` fused
 * into one column, so a vertex stage that binds both can swap them
 * for this and spend the freed slot on `edge.width` (the arrow-trim
 * word).  Bound by exactly the two stages that were at the
 * 8-storage-buffer budget with no slot for the trim: the curved
 * layer-stroke VS and the edge-label VS.  Maintained by the store —
 * `updateOuterHalf` writes lanes 0/1 beside every outerHalf write,
 * the `node.shape` write refreshes lane 2 — and never written
 * directly.  Shape ids are small integers, so the f32 lane is exact
 * (`node.borderGeom.y` carrying a shape copy for the node FS is the
 * precedent).  Nothing reads it on the CPU; `test/modules/`
 * pins it in lockstep with its two source columns.
 */
'node.outerGeom' |
/**
 * Float32Array(4·cap) — ghost props (round 13 A1): [offsetX, offsetY,
 * ghostOpacity, enabled].  The decided simplified form: a ghost
 * duplicates only the basic node body (shape, border, background) at
 * the offset — one extra instance draw off its own cull stream, drawn
 * after edges/arrows and under the nodes, never a full node redraw
 * (labels and decorations excluded).
 */
'node.ghost' |
/**
 * Uint32Array(4·cap) — border/corner/outline geometry (rounds 13
 * B2/B5): [cornerRadius × 256 (fixed-point model px; 0xffffffff =
 * 'auto', v3's min(w/4, h/4, 8)), borderPosition (bits 0..7: 0
 * center — v3's default, 1 inside, 2 outside) | border-style
 * bits 8..9 | outline-style bits 10..11 (round 38; see the stroke
 * style constants) | shape id << 16
 * (round 13 C2: a copy of node.shape so the node FS can drop the
 * shapes binding — the slot went to the gradient column; the style
 * engine writes both together), outline rgba (outline-opacity
 * folded into alpha; a=0 = no outline), outlineWidth × 256 |
 * outlineOffset × 256 << 16 (u16 fixed-point each)].  Read by the
 * node/ghost FS, the depth prepass, the node cull (outward borders
 * and outlines grow the quad), and the CPU pick (the
 * round-rectangle inside test).
 */
'node.borderGeom' |
/**
 * Float32Array(4·cap) — the dashed border's pattern (round 38),
 * normalized to two on/off pairs exactly like `edge.dashPattern`
 * (v3's default [4, 2] stores as [4, 2, 4, 2]).  Read only when
 * borderGeom.y's border-style bits say `dashed`; `dotted` hardcodes
 * [1, 1] in the shader (v3's rule).  Binds vertex-only in the node
 * pipeline — the FS is at its 8-storage-buffer budget — and reaches
 * the fragment stage as flat varyings.
 */
'node.borderDash' |
/**
 * Float32Array(2·cap) — [border-dash-offset (model px), reserved],
 * the `edge.dashMeta` twin for borders (round 38).  Same vertex-only
 * binding rule as 'node.borderDash'.
 */
'node.borderDashMeta' |
/**
 * Uint32Array(8·cap) — background gradient (round 13 C2), sRGB
 * stops (v3's canvas gradients), constants-only, capped at 5 (a
 * recorded cap): [meta (kind 0 solid | 1 linear | 2 radial, bits
 * 0..1; direction id bits 2..4; stop count bits 5..7), c0..c4
 * (packed rgba), pos0..3 (×255 in one word), pos4].  Same layout
 * for edges as 'edge.gradient' (line-fill; no direction — linear
 * runs along the edge, radial from the midpoint).
 */
'node.gradient' |
/**
 * Uint32Array(4·cap) — overlay/underlay records (round 13 A2), one
 * column per layer: [rgba (layer opacity folded into alpha; a=0 =
 * disabled), padding × 256 (fixed-point model px), shape (0
 * round-rectangle, 1 ellipse), cornerRadius × 256 (0xffffffff =
 * 'auto' — v3's min(w/4, h/4, 8), resolved in the shader from live
 * extents)].  The underlay draws under the node body (after ghosts),
 * the overlay above the nodes (before labels).
 */
'node.overlay' | 'node.underlay' | 'node.flags' |
/**
 * Uint32Array(cap) — background-image list ref (round 15.2): record
 * offset into the image param blob | image count << 24 (0 = no
 * images; count ≤ 4 — the recorded multi-image cap).  Records are
 * IMG_STRIDE floats per image (see store/graph-store.mts
 * setNodeImages): registry entry id, packed mode flags, opacity,
 * position/offset/size values with unit bits, and the sdf tint.
 * Draw-only paint: nothing in bb, cull-extent or CPU-pick reads it.
 */
'node.imageRef' |
/**
 * Uint32Array(cap) — chart record ref (round 23): offset into the
 * chart blob | slice count << 24 (0 = no chart).  The record is
 * CHART_HEADER floats (kind, size, hole, startAngle, direction,
 * n) then n × (value, packed-rgba-as-float-bits).  Draw-only
 * paint, like images: nothing in bb, cull-extent or CPU-pick.
 */
'node.chartRef' | 'edge.endpoints' | 'edge.lineColor' |
/**
 * Float32Array(2·cap) — `[ width, arrowBits ]` per edge.
 *
 * Lane 0 is the edge width in model px.  Lane 1 is `edge.arrowShapes`
 * **plus two derived flags** (`ARROW_SHIFT_*_SHOWS_LINE`),
 * reinterpreted as f32, so that the four edge vertex stages — all of
 * which already bind this column and none of which has a spare
 * storage-buffer slot — can derive v3's per-shape arrow `gap`/`spacing`
 * without a new binding (round 56).
 *
 * It is written by `GraphStore.updateArrowBits` alone — from the shape
 * word *and* the two stored arrow colours, so either input changing
 * refreshes it — through a `Uint32Array` view of this column's own
 * buffer rather than a bitcast via a JS number.  Today's packing leaves bit 23 clear, so no
 * reachable word is an f32 NaN and a number round trip would in fact
 * be exact — but that is a property of the *packing*, not of the
 * mirror, and the reserved span at bits 18..23 is explicitly there to
 * be spent.  The aliased view is exact for any word, so the mirror
 * does not quietly acquire a dependency on which bits are free.
 *
 * Nothing reads lane 1 on the CPU — `edge.arrowShapes` is the readable
 * truth, and a spec pins the two in step.
 *
 * Deriving the gap from the *same quantized* arrow-scale the head is
 * drawn at is deliberate: the line then meets the head exactly, where
 * a gap computed from the unquantized scale would not.
 */
'edge.width' | 'edge.opacity' | 'edge.flags' | 'edge.sourceArrow' | 'edge.targetArrow' | 'edge.lineStyle' |
/**
 * Uint32Array(cap) — the four arrowhead ids, the two hollow-fill flags
 * and the quantized arrow-scale in one word.  **The layout is written
 * out once, above `packArrowShapes`** — read it there rather than here,
 * and change it only there.
 *
 * (This comment used to restate the layout and had been wrong since
 * round 27.1: it still described the mid ids as 3-bit fields at
 * 18..20 / 21..23, which is the packing 27.1 replaced with 4-bit
 * fields at 8..11 / 12..15 — contradicting the correct block twelve
 * lines above it.  Round 56 found it by writing a spec against the
 * prose, and deleted the restatement rather than fixing it twice.)
 */
'edge.arrowShapes' |
/** Uint8Array(4·cap) ×2 — mid-arrow colors per end (round 13 C1),
 * folded like the end arrows (opacity × line-opacity; a=0 = none).
 * Mid arrows anchor at the curve/route midpoint with the midpoint
 * tangent (mid-source pointing backward), and are always filled at
 * the standard width (mid fill/width props are unsupported — a
 * recorded scope note). */
'edge.midSourceArrow' | 'edge.midTargetArrow' |
/** Float32Array(2·cap) — hollow-arrow stroke widths per end, model px
 * (round 13 B7; 'match-line' and % forms resolve at style-write). */
'edge.arrowWidths' |
/**
 * Uint32Array(2·cap) — edge overlay/underlay records (round 13 A2),
 * one column per layer: [rgba (layer opacity folded; a=0 = disabled),
 * strokeWidth × 256 (fixed-point model px — the edge width + 2 ×
 * layer padding, derived at style-write so the layer shaders need no
 * width binding)].  The underlay strokes under the edges, the overlay
 * over edges + arrows; both ride the existing edge cull streams with
 * a VS collapse for disabled instances.
 */
'edge.overlay' | 'edge.underlay' |
/**
 * Uint32Array(2·cap) — line-outline casing (round 13 B4), the layer
 * record layout: [rgba (folded by opacity × line-opacity; a=0 =
 * disabled), strokeWidth × 256 (edge width + line-outline-width —
 * v3's context.lineWidth)].  Strokes under the edge line, over the
 * edge underlay, via the shared layer entry points.
 */
'edge.gradient' | 'edge.casing' |
/**
 * Float32Array(4·cap) — line-dash-pattern (round 13 B3), normalized
 * to two on/off pairs in model px (a 2-entry pattern repeats; odd
 * patterns double, canvas semantics; longer patterns truncate — a
 * recorded cap).  Applies when line-style is dashed; dotted keeps
 * [1, 1].
 */
'edge.dashPattern' |
/** Float32Array(2·cap) — [line-dash-offset (model px), line-cap
 * (0 butt, 1 round, 2 square)] (round 13 B3). */
'edge.dashMeta' |
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
'edge.curveParams';
type ColumnArray = Float32Array | Uint32Array | Uint8Array;
type ColumnCtor = Float32ArrayConstructor | Uint32ArrayConstructor | Uint8ArrayConstructor;
interface ColumnSpec {
  id: ColumnId;
  group: GroupName;
  ctor: ColumnCtor;
  /** components (array elements) per slot */
  components: number;
  /** bytes per slot (components × bytes per element) */
  bytesPerSlot: number;
}
/** A coalesced dirty range of slots [start, end) for one column. */
interface DirtySpan {
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
interface StoreDelta {
  resized: {
    nodes: boolean;
    edges: boolean;
  };
  spans: DirtySpan[];
  nodeHighWater: number;
  edgeHighWater: number;
  /**
   * Curve param blob dirt (round 12b), when any: a coalesced [start,
   * end) float span, or resized = realloc + full re-upload — the same
   * rules as columns.  Header rewrites (offsets after a blob
   * compaction) ride edge.curveParams spans as usual.
   */
  curveBlob?: {
    resized: boolean;
    start: number;
    end: number;
  };
  /** Node polygon-point blob dirt (round 13 C3) — same rules. */
  polyBlob?: {
    resized: boolean;
    start: number;
    end: number;
  };
  /** Node image-record blob dirt (round 15.2) — same rules. */
  imageBlob?: {
    resized: boolean;
    start: number;
    end: number;
  };
  /** chart blob dirt (round 23): float range [start, end) or a realloc */
  chartBlob?: {
    resized: boolean;
    start: number;
    end: number;
  };
}
/** Label sidecar streams: main node/edge labels plus the edge
 * source/target end-label streams (round 13 D4). */
type LabelStream = GroupName | 'edgeSource' | 'edgeTarget';
/**
 * Per-node label state (model-only sidecar, never uploaded as a column).
 * The renderer derives SDF glyph instances from it; glyph instances
 * reference the node *slot*, so positions are read from the node position
 * buffer on-GPU and labels follow drags/layouts without rebuilds.  Only
 * text/style changes dirty a label.
 */
interface LabelEntry {
  text: string;
  /** model px */
  fontSize: number;
  /** RGBA bytes packed little-endian (r | g<<8 | b<<16 | a<<24) */
  color: number;
  /** valign base Y offset from the anchor, model px (includes marginY);
   * the block top lands at anchorY + valignShift x blockHeight (D3) */
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
  /** text-halign base X offset from the node center, model px (round
   * 13 D3: -w/2 left, 0 center, +w/2 right; always 0 for edges) */
  anchorX: number;
  /** halign shift as a fraction of the laid block width (the layout
   * centers the run at 0): -0.5 left, 0 center, +0.5 right */
  halignShift: number;
  /** valign shift as a fraction of the laid block height (anchorY is
   * the block-top base): -1 top, -0.5 middle, 0 bottom */
  valignShift: number;
  /** end-label arc offset (round 13 D4): source/target-text-offset in
   * model px along the drawn edge; only read on the edgeSource /
   * edgeTarget streams */
  endOffset: number;
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
  /**
   * text-rotation as a number: the label's own rotation in radians
   * (round 27.7).  Zero for the overwhelmingly common unrotated case,
   * and mutually exclusive with `rotate` — v3's prop is one value, so a
   * label is either autorotated or turned by a fixed angle, never both.
   */
  rotation: number;
  /** text-wrap (round 16.2): 0 none, 1 wrap, 2 ellipsis */
  wrap: number;
  /** text-max-width, model px (the wrap/truncation width) */
  maxWidth: number;
  /** line-height: the line advance as a multiple of the em */
  lineHeight: number;
  /** text-overflow-wrap: 0 whitespace (v3 default), 1 anywhere */
  overflowWrap: number;
  /** text-justification, resolved (auto folds against text-halign at
   * style write — v3's rule): 0 left, 1 center, 2 right */
  justification: number;
}
/**
 * The renderer's view of the model: CPU-canonical typed-array columns plus
 * dirty bookkeeping.  Reads are always served from these arrays; uploads are
 * byte-for-byte copies of the dirty spans.
 */
interface ModelView {
  capacity(group: GroupName): number;
  highWater(group: GroupName): number;
  column(id: ColumnId): ColumnArray;
  hasDirty(): boolean;
  /** Returns the accumulated delta and clears it. */
  takeDelta(): StoreDelta;
  /** `cb` fires at most once per microtask when the model becomes dirty; returns an unsubscribe fn. */
  onInvalidate(cb: () => void): () => void;
  /** The 12b curve param blob backing the params-column headers; the
   * renderer mirrors [0, curveBlobLength()) into a storage buffer. */
  curveBlob(): Float32Array;
  curveBlobLength(): number;
  /** The C3 custom-polygon unit-point blob (x,y pairs; refs ride
   * borderGeom[0] as offset | count << 24). */
  polyBlob(): Float32Array;
  polyBlobLength(): number;
  /** The 15.2 background-image record blob (refs ride node.imageRef). */
  imageBlob(): Float32Array;
  imageBlobLength(): number;
  /** The round-23 chart record blob (refs ride node.chartRef). */
  chartBlob(): Float32Array;
  chartBlobLength(): number;
  /** The unique-image pool (round 15.1) — the renderer uploads ready
   * entries into its tier arrays and reclaims freed layers from it. */
  images: ImageRegistry;
  /** The element's label on the given stream, or undefined. */
  labelAt(slot: number, group?: LabelStream): LabelEntry | undefined;
  /** Slots whose labels changed since the last call; returns-and-clears (default: nodes). */
  takeLabelDirty(group?: LabelStream): number[];
  /** The compound parent draw permutation (round 14.9): live parent
   * slots sorted (depth asc, slot asc) — the paint order of the parent
   * stream, and the reverse of the CPU pick's parent pass.  Owned by
   * the store: identity changes exactly when the hierarchy changes. */
  parentOrder(): Uint32Array;
  /** A node label's box in node-local model px (round 16.4), or null
   * when unlabelled — the CPU pick's text-events test (round 20.3). */
  nodeLabelBox(slot: number): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null;
}
/** A validated reference to an element slot; stale when `gen` no longer matches. */
interface Ref {
  group: GroupName;
  slot: number;
  gen: number;
}
//#endregion
//#region src/store/table.d.mts
interface AllocResult {
  slot: number;
  /** true when the allocation grew the table's capacity */
  resized: boolean;
}
/**
 * Struct-of-arrays storage for one element group: typed-array columns with
 * ×2 growth, a free-list of reusable slots (stable slots, no compaction) and
 * per-slot generation counters so stale handles can be detected.
 */
declare class ColumnTable {
  /** Bumped whenever the column arrays are replaced (grow or compact) —
   * the precise validity key for callers that cache an array reference
   * (round 62.5's hot accessors).  Timing-safe where an epoch key is
   * not: the bump happens in the same call that swaps the arrays. */
  arraysVersion: number;
  /** which element group this table holds ('nodes' or 'edges') */
  group: GroupName;
  /** current capacity, in slots */
  cap: number;
  /** one past the highest slot ever allocated; the renderer draws this many instances */
  highWater: number;
  /** number of live slots */
  count: number;
  /** per-slot generation counters (model-only; never uploaded) */
  gen: Uint32Array;
  private specs;
  private arrays;
  private free;
  /**
   * @param group — the element group this table holds
   * @param specs — the column set, fixed for the table's lifetime: every
   *   column allocates up front and grows in lockstep, so slot `s`
   *   addresses the same element in all of them
   * @param initialCap — starting capacity in slots; pass a known final
   *   size to skip the doubling cascade of a large bulk load
   */
  constructor(group: GroupName, specs: ColumnSpec[], initialCap?: number);
  /** number of freed slots available for reuse */
  get freeCount(): number;
  /**
   * The backing typed array for a column, indexed by
   * `slot * spec.components`.  The array is *not* stable: growth and
   * compaction replace it, so re-fetch after any mutation rather than
   * holding the reference across calls.
   *
   * @param id — the column to fetch
   * @returns the live backing array (mutate in place to write)
   * @throws if the column does not belong to this group's table
   */
  column(id: ColumnId): ColumnArray;
  /** Allocate a slot, reusing a freed one when possible.  Newly allocated slots are zeroed. */
  alloc(): AllocResult;
  /**
   * Allocate `count` slots at once: freed slots first (zeroed, like
   * alloc()), then one contiguous fresh run at highWater — fresh slots
   * have never been written, so they skip the per-slot zeroing loop
   * entirely.  Returns the slots in allocation order; entries from
   * `contiguousFrom` on are the ascending fresh run.
   */
  allocBulk(count: number): {
    slots: Uint32Array;
    resized: boolean;
    contiguousFrom: number;
  };
  /** Free a slot for reuse; bumps its generation so outstanding refs go stale. */
  freeSlot(slot: number): void;
  /**
   * Grow capacity to at least `minCap` slots, staying on the ×2 growth
   * curve — one realloc up front instead of a doubling cascade during a
   * bulk add.  Returns whether the table grew (the caller marks resized).
   */
  reserve(minCap: number): boolean;
  /**
   * Slot-moving compaction (round 19.1): rebuild every column (and the
   * gen array) against a *monotone* remap — `remap[oldSlot]` is the new
   * slot for live elements (ascending: relative order is preserved by
   * construction, the stable-draw-order rule) or NO_SLOT for holes.
   * Capacity shrinks to the ×2 step covering the live count, `highWater`
   * drops to it, and the free-list clears (a dense prefix has no holes).
   *
   * Generations: an element whose slot is unchanged keeps its gen, so
   * refs to the stable prefix stay valid with zero repair.  Every other
   * position — moved-into, vacated, or tail — takes `oldGenAt(pos) + 1`,
   * which is strictly greater than any gen ever handed out at that
   * position: *all* stale refs fail plain validation and route to the
   * forwarding repair (19.3) instead of silently matching a mover.
   */
  compact(remap: Uint32Array, newCount: number): void;
  private grow;
}
//#endregion
//#region src/types.d.mts
interface Position {
  x: number;
  y: number;
}
//#endregion
//#region src/public-types.d.mts
interface ElementData {
  id?: string;
  /** edges only; required for edges */
  source?: string;
  /** edges only; required for edges */
  target?: string;
  /** nodes only: the parent node's id (compound hierarchy; numbers are
   * coerced to string ids, as in v3) */
  parent?: string | number;
  /** anything else lands in the data() sidecar */
  [key: string]: unknown;
}
interface ElementDefinition {
  /** inferred from `data.source`/`data.target` when omitted */
  group?: 'nodes' | 'edges';
  data?: ElementData;
  /** nodes only */
  position?: Position;
  selected?: boolean;
  selectable?: boolean;
  grabbable?: boolean;
  locked?: boolean;
  /** dragging this element pans the graph instead (default: true for edges, false for nodes) */
  pannable?: boolean;
}
type ElementsDefinition = ElementDefinition[] | {
  nodes?: ElementDefinition[];
  edges?: ElementDefinition[];
};
/**
 * Ids as bytes: one UTF-8 blob + prefix byte offsets (length count + 1).
 * Zero-length entries are auto-generated.  This is the wire format's id
 * representation, and the store ingests it without materializing any JS
 * strings — id strings are decoded lazily, per element touched.
 */
interface PackedIds {
  offsets: Uint32Array;
  blob: Uint8Array;
}
/**
 * A dictionary-encoded string data column: `indices[i]` is a 1-based
 * index into `dict` (0 = absent).  Data values repeat heavily, so this
 * is both the compact in-memory shape and the wire shape.
 */
interface DictColumn {
  dict: string[];
  indices: Uint32Array;
}
/**
 * One data() column, index-aligned with the payload: a plain array
 * (holes/undefined = absent), a Float64Array (NaN = absent), or a
 * dictionary-encoded string column.
 */
type DataColumn = ArrayLike<unknown> | Float64Array | DictColumn;
/** Columnar node payload; all arrays are index-aligned with `count`. */
interface ColumnarNodes {
  count: number;
  /** unique ids; missing entries (or the whole array) are auto-generated */
  ids?: (string | undefined)[] | PackedIds;
  /** interleaved x,y pairs, length 2 × count; omitted = all (0, 0) */
  positions?: Float32Array;
  /** 1 = selected; omitted = all unselected */
  selected?: Uint8Array;
  /** 0 = unselectable; omitted = all selectable */
  selectable?: Uint8Array;
  /** compound parent per node as an index into the payload's nodes
   * (round 14.8); 0xffffffff ({@link NO_PARENT}) = orphan.  Omitted =
   * all orphans. */
  parent?: Uint32Array;
  /** data() sidecar columns by key */
  data?: Record<string, DataColumn>;
}
/** The columnar/wire parent-column sentinel for orphan nodes. */
declare const NO_PARENT = 4294967295;
/** Columnar edge payload; endpoints are indices into the payload's nodes. */
interface ColumnarEdges {
  count: number;
  ids?: (string | undefined)[] | PackedIds;
  /** source node index per edge (into the payload's nodes), length count */
  sources: Uint32Array;
  /** target node index per edge (into the payload's nodes), length count */
  targets: Uint32Array;
  selected?: Uint8Array;
  selectable?: Uint8Array;
  /** data() sidecar columns by key */
  data?: Record<string, DataColumn>;
}
/**
 * Columnar bulk-load form of `elements`: typed-array columns ingest
 * directly into the store with no per-element objects, and edges resolve
 * endpoints by index with no id lookups.  Payloads are self-contained —
 * every edge endpoint must index a node in the same payload.  Convert
 * definition-form JSON with `cytoscape.toColumnarElements(json)`.
 */
interface ColumnarElements {
  /** discriminant so the loader can tell the forms apart */
  columnar: true;
  nodes?: ColumnarNodes;
  edges?: ColumnarEdges;
  /**
   * Graph-level `data()` (round 39.2) — the whole-graph object, not a
   * per-element column.  `cy.serialize()` writes it and
   * `deserializeElements` reads it back, but the two load paths treat it
   * differently on purpose: `options.elements` applies it at
   * construction, while `cy.add( buffer )` **ignores** it, since adding
   * elements to a populated graph must not overwrite that graph's own
   * `data()`.
   */
  data?: Record<string, unknown>;
}
/**
 * Any accepted `elements` input: the definition form (v3-style JSON), a
 * single definition, the columnar bulk-load form, or a binary buffer from
 * `cytoscape.serializeElements` (one little-endian ArrayBuffer +
 * header — fetch it as binary and pass it straight in; no JSON parse).
 */
type ElementsInput = ElementsDefinition | ElementDefinition | ColumnarElements | ArrayBuffer | ArrayBufferView;
/**
 * A data-driven style mapping: a plain serializable object appearing as a
 * prop value in the sheet.  `{ data: key }` alone is a passthrough (the
 * datum is the value; 'id' reads the first-class id — label only);
 * adding `range` (and usually `domain`) scales the datum.
 *
 * Scales: 'linear' (default) | 'log' | 'sqrt' | 'pow' | 'symlog'
 * (continuous), 'diverging' (three-point [min, mid, max] domain),
 * 'ordinal' (categories → outputs), 'threshold' (cut points → bins),
 * 'quantize' (uniform bins).  `domain` omitted or 'auto' tracks the live
 * data extent.  Color ranges take color stops or a named scheme
 * ('viridis', 'plasma', 'magma', 'inferno', ColorBrewer ramps,
 * 'category10', 'dark2') and interpolate in OKLab unless
 * `interpolate: 'srgb'`.  Missing or unmappable data resolves to
 * `fallback`, else the channel default.
 */
interface Mapper {
  /** data() sidecar key to read */
  data: string;
  scale?: 'linear' | 'log' | 'sqrt' | 'pow' | 'symlog' | 'diverging' | 'ordinal' | 'threshold' | 'quantize';
  /** ascending numeric stops (categories for 'ordinal'); 'auto'/omitted = live data extent */
  domain?: (string | number)[] | 'auto';
  /** output stops (numbers, colors, or keywords), or a named color scheme */
  range?: (string | number)[] | string;
  /** clamp input to the domain (default true) */
  clamp?: boolean;
  /** pow only (default 2) */
  exponent?: number;
  /** log only (default 10) */
  base?: number;
  /** symlog linear-region constant (default 1) */
  constant?: number;
  /** color interpolation space (default 'oklab') */
  interpolate?: 'oklab' | 'srgb';
  /** bin count when a quantize range is a scheme name */
  bins?: number;
  /** output for missing/unmappable data (default: the channel default) */
  fallback?: string | number;
}
/**
 * A condition over one data key: exactly one comparison operator.  String
 * data supports `eq`/`ne`/`in`; numeric data supports all.  Missing data
 * fails every comparison (so an unset key never matches).
 */
interface Condition {
  /** the data key to compare ('id' reads the first-class id); omitted
   * for the structural forms below */
  data?: string;
  eq?: string | number;
  ne?: string | number;
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
  in?: (string | number)[];
  /** structural (round 14.7, nodes only): the element has >= 1 child.
   * A structural condition stands alone — AND it with data conditions
   * via the `when` array form. */
  parent?: boolean;
  /** structural (round 14.7, nodes only): the element has no children —
   * v3's `:childless`, and exactly `{ parent: false }` */
  childless?: boolean;
  /** structural (round 14.7, nodes only): the element has a parent */
  child?: boolean;
  /** structural (round 14.7, nodes only): the element has no parent —
   * v3's `:orphan`, and exactly `{ child: false }` */
  orphan?: boolean;
  /** state (round 57.1): the element is selected.  This is what v4's
   * **default stylesheet** uses to give selection a colour — nodes'
   * `background-color`, edges' `line-color` and the four arrow colours
   * are conditional mappers rather than constants — so declaring any of
   * those props in your own sheet replaces the rule and the selection
   * colour with it, exactly as it does in v3. */
  selected?: boolean;
  /** state (round 57.1): the element is selectable — v3's
   * `:selectable`; `false` is its `:unselectable` */
  selectable?: boolean;
  /** state (round 57.1): the element is locked — v3's `:locked`;
   * `false` is its `:unlocked` */
  locked?: boolean;
  /** state (round 57.1): the user is dragging the element — v3's
   * `:grabbed`; `false` is its `:free` */
  grabbed?: boolean;
  /** state (round 57.1): the element can be dragged — v3's
   * `:grabbable`; `false` is its `:ungrabbable` */
  grabbable?: boolean;
  /** state (round 57.1): the element is under an active press — v3's
   * `:active`; `false` is its `:inactive`.  v3 draws a fixed black wash
   * for this and v4 draws it from the default stylesheet's `overlay-*`
   * props, so restyling or removing the affordance is a sheet edit. */
  active?: boolean;
  /** state (round 57.1): the pointer is over the element.  v4's own,
   * with no v3 spelling — v3 styles hover not at all. */
  hovered?: boolean;
}
/** One case clause: `when` (a condition, or an array AND-ed together) → `then`. */
interface CaseClause {
  when: Condition | Condition[];
  then: string | number;
}
/**
 * A conditional mapper: the first clause whose `when` holds supplies the
 * value, else `else` (or the channel default).  Clauses are tried in
 * order.  CPU-evaluated (multi-key, data-driven) — the declarative
 * replacement for `(ele) => cond ? a : b` style functions, and the
 * natural form for typed edges (`type == 'activation' → ...`).
 */
interface CaseMapper {
  case: CaseClause[];
  else?: string | number;
  /** value for missing/unmappable data (defaults to `else` then the channel default) */
  fallback?: string | number;
}
/** Any data-driven style value: a scale mapper or a conditional. */
type MapperSpec = Mapper | CaseMapper;
/** A style prop value: a constant, or a mapper object. */
type StylePropValue = string | number | MapperSpec;
/**
 * Style props for one element or group; names are kebab-case or
 * camelCase.  Values are constants, scale mappers ({@link Mapper}), or
 * conditionals ({@link CaseMapper}); `label` also takes the
 * `data(key)` mapper string ('id' reads the first-class id).
 * Node props: background-color, width, height, shape, opacity,
 * border-color, border-width, label, font-size, font-family (constant
 * only, effectively global — one font per glyph atlas), color.  Edge
 * props: line-color, width, opacity, source/target-arrow-shape and
 * -color.
 */
type StyleProps = Record<string, StylePropValue>;
/**
 * The v4 stylesheet — no selectors, no style functions.  Each group key
 * is a props object whose values are constants or mapper objects; all
 * per-element variation is expressed declaratively through mappers
 * ({@link Mapper} scales, {@link CaseMapper} conditionals), which
 * are analyzable, serializable, and evaluated on the GPU where possible.
 * Everything stays fresh automatically: a data write re-derives the
 * mapped channels of the affected elements (gated on the mapped keys).
 */
interface Stylesheet {
  nodes?: StyleProps;
  edges?: StyleProps;
  /**
   * Compound-parent overlay (round 14.6): node props that apply to
   * parent nodes on top of the nodes group and v3's `:parent` defaults
   * (rectangle, #eee fill, 1px #ccc border, padding 10) — constants or
   * mappers — plus the compound props `padding`, `padding-relative-to`,
   * `min-width`, `min-height` and `compound-sizing-wrt-labels`
   * (constants only; `'exclude'` is the only accepted sizing value —
   * compound auto-sizing reads the children's body extents, not
   * their labels — public bb/fit include labels since round 16.4,
   * the auto-bounds derivation deliberately does not).
   */
  parents?: StyleProps;
  /**
   * Core (viewport-level) theming props (round 13 A2), constants only:
   * `selection-box-color`/`-opacity`/`-border-color`/`-border-width`
   * (the DOM selection box) and `active-bg-color`/`-opacity`/`-size`
   * (the background-grab indicator circle).  v3's core-selector props.
   */
  core?: StyleProps;
  /**
   * Per-element bypasses (round 63): id → prop → constant.  A bypass
   * beats everything — the user's group blocks and the default sheet's
   * state conditionals included (v3's precedence) — and is an id-keyed
   * *declaration* rather than element state: it survives remove/re-add
   * of its element, may name an id that does not exist yet (inert
   * until it does), and round-trips through `cy.json()`.  Values are
   * constants only — mappers belong in the group blocks — and prop
   * keys take dash-case or camelCase like every prop surface.  A full
   * `cy.style( sheet )` replaces the section like any other; the
   * `ele.style( name, value )` / `removeStyle()` methods are sugar
   * over it.
   */
  bypasses?: Record<string, StyleProps>;
}
/**
 * Options for `cy.png()`/`cy.jpg()` image export.  Export is async (the
 * pixels are rendered on and read back from the GPU) and only available
 * on rendered instances — headless instances reject.
 */
interface ExportOptions {
  /** result form: a data-URI string (default), the raw base64 payload,
   * or a Blob ('blob-promise' is accepted as an alias of 'blob' — every
   * output form resolves through the returned promise) */
  output?: 'base64uri' | 'base64' | 'blob' | 'blob-promise';
  /** background color under the graph (any CSS color).  Default:
   * transparent for png; white for jpg (JPEG has no alpha) */
  bg?: string;
  /** export the whole graph's bounds instead of the current viewport (default false) */
  full?: boolean;
  /** output pixels per rendered CSS px (viewport export) or per model
   * unit (full export); default 1.  Ignored when maxWidth/maxHeight are
   * given */
  scale?: number;
  /** cap the output width in px (the scale is computed to fit; overrides `scale`) */
  maxWidth?: number;
  /** cap the output height in px (the scale is computed to fit; overrides `scale`) */
  maxHeight?: number;
  /** jpg only: encode quality in [0, 1] (default: the browser's) */
  quality?: number;
}
type BoundingBoxInput = {
  x1: number;
  y1: number;
  x2?: number;
  y2?: number;
  w?: number;
  h?: number;
};
/** Options shared by the discrete layouts (scope, fit, spacing, animation). */
interface LayoutBaseOptions {
  /** the elements to lay out (set automatically by `eles.layout()`); defaults to the whole graph */
  eles?: unknown;
  fit?: boolean;
  padding?: number;
  boundingBox?: BoundingBoxInput;
  /** include labels in node dimensions (v4 note: since round 16.4
   * `boundingBox()`/fit include labels by default; this layout option
   * remains accepted for v3 compatibility but the discrete layouts
   * still place by node body size) */
  nodeDimensionsIncludeLabels?: boolean;
  spacingFactor?: number;
  /** transform a computed position (e.g. to flip an axis) */
  transform?: (node: unknown, position: Position) => Position;
  /** whether to animate node positions into place */
  animate?: boolean;
  animationDuration?: number;
  animationEasing?: string;
  /** which nodes animate (others jump); all by default */
  animateFilter?: (node: unknown, i: number) => boolean;
  /** callback on layoutready */
  ready?: () => void;
  /** callback on layoutstop */
  stop?: () => void;
  /** zoom to set when fit is false */
  zoom?: number;
  /** pan to set when fit is false */
  pan?: Position;
}
interface GridLayoutOptions extends LayoutBaseOptions {
  name: 'grid';
  avoidOverlap?: boolean;
  avoidOverlapPadding?: number;
  condense?: boolean;
  rows?: number;
  cols?: number;
  /** returns a fixed { row, col } for a node handle */
  position?: (node: unknown) => {
    row?: number;
    col?: number;
  } | undefined;
  /** comparator over node handles */
  sort?: (a: unknown, b: unknown) => number;
}
interface PresetLayoutOptions extends LayoutBaseOptions {
  name: 'preset';
  /** node id → position map, or a function of a node handle; absent nodes keep their position */
  positions?: Record<string, Position> | ((node: unknown) => Position | null | undefined);
}
interface CircleLayoutOptions extends LayoutBaseOptions {
  name: 'circle';
  avoidOverlap?: boolean;
  /** the circle's radius (computed when omitted) */
  radius?: number;
  /** where nodes start in radians (default 3/2 π) */
  startAngle?: number;
  /** radians between the first and last node (default: full circle) */
  sweep?: number;
  clockwise?: boolean;
  counterclockwise?: boolean;
  /** comparator over node handles ordering the nodes around the circle */
  sort?: (a: unknown, b: unknown) => number;
}
interface ConcentricLayoutOptions extends LayoutBaseOptions {
  name: 'concentric';
  startAngle?: number;
  sweep?: number;
  clockwise?: boolean;
  counterclockwise?: boolean;
  /** whether levels are an equal radial distance apart */
  equidistant?: boolean;
  /** min spacing between node outsides (radius adjustment) */
  minNodeSpacing?: number;
  avoidOverlap?: boolean;
  /** height/width of the layout area (override the container) */
  height?: number;
  width?: number;
  /** numeric value per node handle; higher values sit closer to the center (default: degree) */
  concentric?: (node: unknown) => number;
  /** the variation of concentric values per level (default: maxDegree / 4) */
  levelWidth?: (nodes: unknown) => number;
}
interface BreadthFirstLayoutOptions extends LayoutBaseOptions {
  name: 'breadthfirst';
  /** whether the tree is directed downwards (default false) */
  directed?: boolean;
  /** drawing direction of the tree (default 'downward') */
  direction?: 'downward' | 'upward' | 'rightward' | 'leftward';
  /** put depths in concentric circles instead of rows */
  circle?: boolean;
  /** place the DAG on an even grid (circle: false only) */
  grid?: boolean;
  avoidOverlap?: boolean;
  /** the tree roots: a collection, or an array of node ids */
  roots?: unknown;
  /** comparator ordering nodes within a depth */
  depthSort?: (a: unknown, b: unknown) => number;
  /** shift nodes down to their maximal depths (DAGs only) */
  maximal?: boolean;
  /** with maximal: the graph is known acyclic (no cycle bail-out) */
  acyclic?: boolean;
}
interface RandomLayoutOptions extends LayoutBaseOptions {
  name: 'random';
}
/** The built-in force layout (round 18): spring–electric with
 * uniform-grid cutoff repulsion, seeded and deterministic; runs
 * through the extension contract. */
interface ForceLayoutOptions extends LayoutBaseOptions {
  name: 'force';
  /** ideal edge length: number, or a plain fn of the edge handle
   * (resolved once at start) */
  edgeLength?: number | ((edge: unknown) => number);
  repulsion?: number;
  stiffness?: number;
  gravity?: number;
  /** alpha annealing rate per iteration */
  decay?: number;
  iterations?: number;
  /** convergence: settled when max displacement stays under this */
  threshold?: number;
  seed?: number;
  /** fresh seeded scatter (default) vs relaxing current positions */
  randomize?: boolean;
  /** live display: stream positions per frame while the sim runs */
  animate?: boolean;
  /** iterations per animation frame (animate: true; default 3) */
  stepsPerFrame?: number;
}
/** The extension contract (round 17.5): a direct impl object/class —
 * no name, no registry — plus any custom knobs the impl reads off
 * ctx.options. */
interface CustomLayoutOptions extends LayoutBaseOptions {
  impl: unknown;
  name?: undefined;
  /** internal (round 17.5): the wrapper already emitted layoutstart */
  _startEmitted?: boolean;
  [key: string]: unknown;
}
type LayoutOptions = GridLayoutOptions | PresetLayoutOptions | CircleLayoutOptions | ConcentricLayoutOptions | BreadthFirstLayoutOptions | RandomLayoutOptions | ForceLayoutOptions | CustomLayoutOptions;
/** Renderer tuning knobs (all LOD values in device px). */
interface RendererOptions {
  /** minimum edge width; thinner edges are floored and alpha-compensated (default 1) */
  edgeWidthFloor?: number;
  /** below this node size, nodes draw as plain AA discs without decorations (default 3) */
  nodeLodPx?: number;
  /** below this size, elements are floored to it and alpha-compensated (default 1) */
  hidePx?: number;
  /** dim edges as zoom decreases below 1 (default false) */
  edgeDimming?: boolean;
  /** labels fade out as displayed glyph height drops below this
   * (default 6).  Displayed px: measured after any adaptive render-scale
   * upscale, so labels never pop out just because the resolution dropped
   * mid-gesture. */
  labelFadePx?: number;
  /** labels below this displayed glyph height are not rendered at all —
   * too small to read anyway (default 0 = off; the fade's own cutoff at
   * labelFadePx/2 still applies) */
  labelMinPx?: number;
  /** background images are skipped on nodes below this displayed px
   * size — unreadable anyway, and far-zoom sampling is pure cost
   * (default 8; the plain-disc LOD owns the pixel below ~3px).
   * Round 15.7. */
  imageMinPx?: number;
  /** adaptive resolution band, lower bound (default 0.5).  Under GPU
   * load the renderer drops the render scale in quarter steps toward
   * this; frames below the bound's cost budget raise it back.  Scenes
   * render at scale × native resolution and upscale to the canvas with
   * Catmull-Rom bicubic filtering (fill cost ~scale²).  Shortly after
   * drawing stops, one frame re-renders at renderScaleMax so still
   * images are always full-resolution.  Picking always runs at native
   * resolution.  Set min === max to pin a fixed scale. */
  renderScaleMin?: number;
  /** adaptive resolution band, upper bound (default 1 = native) */
  renderScaleMax?: number;
  /** device pixel ratio override; defaults to the window's */
  pixelRatio?: number | 'auto';
}
/** Snapshot returned by `cy.renderer().stats()`. */
interface RendererStats {
  frames: number;
  /** CPU cost of building + submitting the last frame (encoding is fire-and-forget) */
  cpuFrameMs: number;
  /** GPU execution time of the last measured scene pass; 0 when 'timestamp-query' is unavailable */
  gpuFrameMs: number;
  /** how many GPU timings have resolved (round 65.12).  `gpuFrameMs` is
   * latest-wins and quantized, so a sampler cannot tell a repeated value from
   * a stale one; this counter can, and a sampler that keys off the value
   * instead records transitions rather than frames */
  gpuFrameReadings: number;
  /** current adaptive render scale (fraction of native resolution) */
  renderScale: number;
  uploadedBytes: number;
  nodes: number;
  edges: number;
  glyphs: number;
  pickLatencyMs: number;
  /** frames that found the pick staging ring full and deferred the request
   * to a later frame (saturation meter; requests are never dropped) */
  pickDeferrals: number;
  /** data bytes uploaded for GPU mapper evaluation (paint-channel restyles) */
  mapperUploadedBytes: number;
  /** mapper eval dispatches encoded */
  mapperDispatches: number;
  /** shaping-memo hits/misses (round 16.5): shared label texts shape once */
  labelShapeHits: number;
  labelShapeMisses: number;
}
/**
 * How the box-selection gesture decides what the band caught (round
 * 39.1): `'contain'` selects only elements wholly inside it — v3's
 * default and v4's — while `'overlap'` selects anything it touches.
 *
 * A whole-instance setting, where v3 spells the same choice as a
 * per-element style prop (`box-selection`, which also has a `'none'`
 * value covered in v4 by the `events` prop).  The v4 shape was chosen at
 * the fifth design sitting: it is an interaction preference rather than
 * an appearance, and v4 keeps the interaction quartet on the core.
 */
type BoxSelectionMode = 'contain' | 'overlap';
interface CytoscapeOptions {
  /**
   * Where to render.  When given, WebGPU is required: the factory throws
   * synchronously if `navigator.gpu` is missing.  When omitted, the instance
   * is headless (works in Node, never throws for missing GPU).
   */
  container?: HTMLElement | null;
  elements?: ElementsInput;
  style?: Stylesheet;
  layout?: LayoutOptions;
  zoom?: number;
  pan?: Position;
  minZoom?: number;
  maxZoom?: number;
  /** disable node dragging globally (default false) */
  autolock?: boolean;
  /** make all nodes ungrabbable globally (default false) */
  autoungrabify?: boolean;
  /** disable selection globally (default false) */
  autounselectify?: boolean;
  /** allow panning at all — programmatic and user (default true) */
  panningEnabled?: boolean;
  /** allow user (pointer) panning (default true) */
  userPanningEnabled?: boolean;
  /** allow zooming at all — programmatic and user (default true) */
  zoomingEnabled?: boolean;
  /** allow user (wheel/pinch) zooming (default true) */
  userZoomingEnabled?: boolean;
  /** allow box selection (default true) */
  boxSelectionEnabled?: boolean;
  /** box selection considers label boxes too (round 16.5 — the v4 form
   * of v3's box-select-labels; default false, as v3).  Its sense follows
   * `boxSelectionMode`: it narrows a 'contain' selection and widens an
   * 'overlap' one (round 39.1). */
  boxSelectionIncludesLabels?: boolean;
  /** what the box-selection gesture counts as selected: 'contain'
   * (default, v3's) takes only elements wholly inside the band;
   * 'overlap' takes anything the band touches.  Round 39.1. */
  boxSelectionMode?: BoxSelectionMode;
  /** 'single' (tap/box replaces the selection) or 'additive' (taps toggle, boxes add); default 'single' */
  selectionType?: 'single' | 'additive';
  /** the dbltap/onetap debounce window in ms (default 250, as v3) */
  multiClickDebounceTime?: number;
  /** wheel-zoom rate multiplier (default 1, as v3; custom values warn
   * once — a sensitivity tuned to one mouse/OS zooms unnaturally on
   * others).  Round 20.1. */
  wheelSensitivity?: number;
  /** css px a mouse/pen press may move and still count as a tap
   * (default 4, as v3).  Round 20.1. */
  desktopTapThreshold?: number;
  /** css px a touch press may move and still count as a tap
   * (default 8, as v3).  Round 20.1. */
  touchTapThreshold?: number;
  /** unmoved-press duration before 'taphold' fires, in ms (default
   * 500 — v3's hardcoded constant, configurable in v4).  Round 20.1. */
  tapholdDuration?: number;
  /** rendered dimensions used when headless */
  headlessWidth?: number;
  headlessHeight?: number;
  /** device pixel ratio override; defaults to the window's */
  pixelRatio?: number | 'auto';
  renderer?: RendererOptions;
}
//#endregion
//#region src/store/id-map.d.mts
interface IdEntry {
  group: GroupName;
  slot: number;
}
declare class IdMap {
  private blob;
  private blobLen;
  private table;
  private tombs;
  private scratch;
  private meta;
  private _size;
  private waste;
  /** stranded blob bytes from removed ids (the compaction meter) */
  get wasteBytes(): number;
  /** blob bytes in use, stranded bytes included */
  get blobBytes(): number;
  /** current blob capacity, in bytes */
  get blobCapacity(): number;
  /**
   * Whether any element — node or edge — holds this id.  Ids are unique
   * across both groups, so this is also the uniqueness check `set` makes.
   *
   * @param id — the id to look up
   */
  has(id: string): boolean;
  /**
   * Resolve an id to its packed `(slot << 1) | groupBit` code, or −1 —
   * the allocation-free twin of `get()` for the id-lookup hot path
   * (round 62.3: `getElementById` paid two throwaway objects per call,
   * the IdEntry here and the Ref above, and lost to v3's Map.get on
   * them alone).  Group bit 1 = edges.
   *
   * @param id — the id to look up
   * @returns the packed code, or −1 when no element holds the id
   */
  code(id: string): number;
  /**
   * Resolve an id to its group and slot.  Allocates a fresh result
   * object per hit but decodes no strings — the probe compares UTF-8
   * bytes in the blob against the encoded query.
   *
   * @param id — the id to look up
   * @returns the entry, or undefined when no element holds the id
   */
  get(id: string): IdEntry | undefined;
  /**
   * The id string at a slot — the reverse direction, and the only place
   * a JS string is ever materialized.  Decoding is lazy and cached per
   * slot, so a bulk-loaded graph pays string cost only for the elements
   * something actually asks about.
   *
   * @param group — the element group
   * @param slot — the slot within that group
   * @returns the id, or undefined when the slot holds none
   */
  idAt(group: GroupName, slot: number): string | undefined;
  /** The stored id hash for a slot (0 when none) — stable across
   * sessions and machines for a given id string; the curve derivation
   * seeds hash-stable haystack angles from it (12c). */
  hashAt(group: GroupName, slot: number): number;
  /**
   * Bind an id to a (group, slot).  The id's bytes append to the blob;
   * nothing is written and no bytes are stranded when the id is already
   * taken, since the duplicate check runs before the append.
   *
   * @param id — the id to bind (unique across both groups)
   * @param group — the element group
   * @param slot — the slot within that group
   * @throws if another element already holds this id
   */
  set(id: string, group: GroupName, slot: number): void;
  /**
   * Bulk registration for columnar ingest.  The packed form (the wire
   * format's id section) is one blob memcpy + per-id hash/probe — no JS
   * strings.  Holes (zero-length / undefined ids) get `newId()`.
   */
  setBulk(group: GroupName, slots: Uint32Array, ids: (string | undefined)[] | PackedIds | undefined, newId: () => string): void;
  /**
   * Unbind an id; a no-op when it is not registered.  The probe entry
   * becomes a tombstone and the id's blob bytes are stranded, so removal
   * itself is O(1) — but it may trigger the blob compaction (O(live
   * bytes)) once stranded bytes exceed half the blob.
   *
   * @param id — the id to unbind
   */
  remove(id: string): void;
  /** live ids across both groups (tombstones excluded) */
  get size(): number;
  /**
   * Slot-moving compaction (19.1): repoint one group's per-slot meta
   * through a monotone remap (`remap[old]` = new slot, or NO_SLOT) and
   * rebuild the probe table — its entries encode (group, slot) codes, so
   * every moved code changes.  Monotone means destinations sit at or
   * below their sources, so the ascending in-place walk never clobbers
   * an unconsumed entry (a lower slot's meta has already moved down, or
   * was a hole whose start offset is 0).  Blob offsets are untouched
   * (they key on bytes, not slots).
   */
  remapSlots(group: GroupName, remap: Uint32Array): void;
  /** Rebuild the probe table from the per-slot meta of both groups
   * (entry codes embed slots, so a slot remap invalidates them all). */
  private rehashFromMeta;
  /** Linear probe: EMPTY table code when absent (`at` = insertion point), else the entry code. */
  private probe;
  private findEntry;
  private place;
  /** Grow + rehash so live entries + tombstones stay under half the table. */
  private ensure;
  /** UTF-8 encode into the scratch buffer; returns the byte length. */
  private encodeScratch;
  private decode;
  /**
   * Reclaim stranded blob bytes: copy every live id's bytes into a fresh
   * right-sized blob and repoint the per-slot offsets.  The probe table,
   * hashes and name cache reference slots, not offsets, so they are
   * untouched.  O(live bytes); runs when stranded bytes exceed half the
   * blob, so the cost amortizes over the removals that stranded them.
   */
  private compactBlob;
  /** Append bytes to the blob (amortized-doubling growth); returns their offset. */
  private append;
}
//#endregion
//#region src/store/adjacency.d.mts
/** What adjacency queries return: iterate or index it, don't mutate it. */
type EdgeSlots = ArrayLike<number> & Iterable<number>;
declare class Adjacency {
  private csrOutOff;
  private csrOutLen;
  private csrOutE;
  private csrInnOff;
  private csrInnLen;
  private csrInnE;
  private csrN;
  private out;
  private inn;
  private overlayCount;
  private csrDead;
  /** stranded CSR entries — one per direction per removed CSR edge */
  get csrStranded(): number;
  /** overlay list entries — two per overlay edge */
  get overlayEntries(): number;
  /**
   * Register one edge.  Always lands in the overlay — CSR segments are
   * fixed-size, so an add can never grow one — which is why a graph
   * built edge-by-edge has no CSR at all until a `rebuild()`.  The
   * endpoints are passed in rather than read from the column so the
   * caller controls ordering against its own column writes.
   *
   * @param edgeSlot — the edge's slot
   * @param sourceSlot — the source node's slot
   * @param targetSlot — the target node's slot (equal to source for a loop)
   */
  addEdge(edgeSlot: number, sourceSlot: number, targetSlot: number): void;
  /**
   * Bulk registration from a columnar ingest: `endpoints` is the
   * interleaved edge.endpoints column, indexed by the slots in
   * `edgeSlots`.  On a fresh index this builds CSR in two counting
   * passes; otherwise the edges append to the overlay.
   */
  addBulk(edgeSlots: Uint32Array, endpoints: Uint32Array, nodeCap: number): void;
  /**
   * Rebuild CSR from the live edges (insertion order): folds the overlay
   * back into CSR and drops stranded entries.  O(edges); the owner
   * triggers it when the waste meters cross a threshold, so the cost
   * amortizes over the mutations that created the waste.
   */
  rebuild(edgeSlots: ArrayLike<number>, endpoints: Uint32Array, nodeCap: number): void;
  private buildCsr;
  /**
   * Unregister one edge from both directions.  O(degree): the CSR run is
   * compacted in place (order preserved) or the overlay list spliced.
   * The vacated CSR entry is stranded, not reusable — it only comes back
   * on `rebuild()`, which the owner triggers off the waste meters.
   *
   * Silently tolerates an edge that is not indexed, so a double removal
   * is harmless; the endpoints must be the ones it was added under.
   *
   * @param edgeSlot — the edge's slot
   * @param sourceSlot — the source node's slot at add time
   * @param targetSlot — the target node's slot at add time
   */
  removeEdge(edgeSlot: number, sourceSlot: number, targetSlot: number): void;
  /**
   * The node's outgoing edge slots, in incident order.  The result
   * aliases internal state — a CSR subarray view or the overlay array
   * itself — so it must be treated as read-only and re-fetched after any
   * mutation.  Only a node with both CSR *and* overlay edges allocates
   * (the concatenation); the common cases are allocation-free.
   *
   * @param nodeSlot — the node's slot
   */
  outEdges(nodeSlot: number): EdgeSlots;
  /**
   * The node's incoming edge slots, in incident order.  Same aliasing
   * and allocation rules as `outEdges`.
   *
   * @param nodeSlot — the node's slot
   */
  inEdges(nodeSlot: number): EdgeSlots;
  /**
   * Outgoing degree, counted from the CSR lengths and overlay sizes — no
   * list is materialized, so this is O(1) even where `outEdges` would
   * concatenate.  Loops count here and in `inDegree` both.
   *
   * @param nodeSlot — the node's slot
   */
  outDegree(nodeSlot: number): number;
  /**
   * Incoming degree; O(1), like `outDegree`.
   *
   * @param nodeSlot — the node's slot
   */
  inDegree(nodeSlot: number): number;
  /**
   * Append this node's incident edge slots (out then in) to `dst`,
   * skipping any slot already in `seen` and recording what it appends —
   * the allocation-free form of `outEdges`/`inEdges` for bulk traversal
   * consumers (round 62.6): the CSR rows are read in place, so no
   * subarray view is created per node.  Loops dedupe like any shared
   * slot.
   *
   * @param nodeSlot — the node's slot
   * @param seen — the caller's dedupe set, updated in place
   * @param dst — the output array, appended in incident order
   */
  appendIncident(nodeSlot: number, seen: Set<number>, dst: number[]): void;
  /** All incident edge slots (loop edges appear once). */
  connectedEdges(nodeSlot: number): number[];
  /**
   * Drop every incidence recorded *at* this node, for node removal.  It
   * clears only this node's own entries: the mirrored entry each edge
   * holds at its far endpoint is not touched, so the caller must have
   * removed the incident edges first (v3's cascade rule) or the far
   * lists will list edges that no longer exist.
   *
   * @param nodeSlot — the node's slot
   */
  clearNode(nodeSlot: number): void;
  private csrLen;
  private edgesFor;
  /** Compact `edgeSlot` out of the node's CSR run, preserving order; false when not there. */
  private removeFromCsr;
}
//#endregion
//#region src/store/data-store.d.mts
declare class DataStore {
  private cols;
  /** Bumped on every value write, clear or bulk ingest (round 62.4) —
   * the validity key for whole-object data() caches.  Dict compaction
   * and slot remaps deliberately do not bump: neither changes any
   * element's values. */
  epoch: number;
  /** Fires when a column promotes to mixed (a GPU-mirrored key must demote to CPU eval). */
  onPromote: ((group: GroupName, key: string) => void) | null;
  /** Fires after a dict compaction remapped a column's indices (see the header note). */
  onDictRemap: ((group: GroupName, key: string) => void) | null;
  /**
   * One element's value for one data key.  Absence and a stored
   * `undefined` are indistinguishable by design (v3's `data()` reads the
   * same way), and an unknown key or an out-of-range slot reads
   * undefined rather than throwing — the columns are sparse and grow
   * only where written.  For a loop over many slots use `reader`, which
   * hoists the column lookup and the kind switch out of the loop.
   *
   * @param group — the element group
   * @param slot — the slot within that group
   * @param key — the data key
   */
  get(group: GroupName, slot: number, key: string): unknown;
  /**
   * A per-slot value reader for one key, with the column resolution
   * hoisted out of the loop — for columnar scans over data conditions.
   */
  reader(group: GroupName, key: string): (slot: number) => unknown;
  /** All present values at a slot, as a fresh object. */
  object(group: GroupName, slot: number): Record<string, unknown>;
  /**
   * Every data key a group has ever held, in first-write order.  Keys
   * are never dropped — clearing the last value leaves an empty column
   * standing — so this is the union over the group's history, not the
   * keys any particular element carries.
   *
   * @param group — the element group
   */
  keys(group: GroupName): string[];
  /**
   * Index-aligned wire/columnar export: `out[key][i]` is slot `slots[i]`'s
   * value.  Numbers export as Float64Array with NaN holes, strings as a
   * dictionary column, mixed as a plain array — the shapes `ingestColumn`
   * and the wire already accept.  Undefined when there are no columns.
   */
  exportColumns(group: GroupName, slots: ArrayLike<number>): Record<string, DataColumn> | undefined;
  /**
   * Write one element's value for one data key.  The column adopts the
   * kind of its first value and promotes to `mixed` — irreversibly, and
   * firing `onPromote` — the first time a value does not fit, so a
   * single stray write demotes a GPU-mirrored key to CPU evaluation for
   * the rest of the session.  Writing `undefined` clears instead, which
   * can drop a dict entry's last reference and trigger a compaction.
   *
   * @param group — the element group
   * @param slot — the slot within that group
   * @param key — the data key
   * @param value — the value; `undefined` clears
   */
  set(group: GroupName, slot: number, key: string, value: unknown): void;
  /**
   * Bulk column ingest for `slots[i] = column[i]`.  Classifies the column
   * (all-number → numeric, all-string → dictionary, else mixed) unless it
   * is already a dictionary column, which is adopted index-for-index.
   */
  ingestColumn(group: GroupName, slots: Uint32Array, key: string, column: ArrayLike<unknown> | DictColumn): void;
  /**
   * Slot compaction (19.2): move every column's per-slot payload through
   * the monotone remap **in place** — bound mapper evaluators close over
   * these buffers by reference (the dict-remap precedent), so the arrays
   * must keep their identity.  Dictionary refcounts are untouched: the
   * values are the same, only their slots moved.
   */
  remapSlots(group: GroupName, remap: Uint32Array): void;
  /** Clear every data value at a slot (element removal). */
  clearSlot(group: GroupName, slot: number): void;
  /** The column in wire-facing shape, for serialization. */
  column(group: GroupName, key: string): {
    kind: 'number';
    values: Float64Array;
    present: Uint8Array;
  } | {
    kind: 'string';
    indices: Uint32Array;
    dict: string[];
    epoch: number;
  } | {
    kind: 'mixed';
    values: unknown[];
  } | undefined;
  private emptyColFor;
  private fits;
  private promote;
  private write;
  private writeString;
  private clearValue;
  private maybeCompactDict;
}
//#endregion
//#region src/store/dirty.d.mts
/**
 * Tracks one coalesced `[min, end)` dirty span per column per frame, plus a
 * per-group `resized` flag (capacity growth ⇒ the renderer reallocates the
 * group's buffers and re-uploads in full).  `take()` returns-and-clears.
 * Invalidation callbacks fire at most once per microtask so a burst of
 * mutations schedules a single frame.
 */
declare class DirtyTracker {
  private spans;
  private resized;
  private cbs;
  private scheduled;
  private touched;
  /** Starts clean: no spans, neither group resized, no subscribers. */
  constructor();
  /**
   * Mark non-column model state dirty (e.g. the label sidecar, which is
   * consumed separately from the span delta) so a frame gets scheduled and
   * `hasDirty()` reports work until the next `take()`.
   */
  touch(): void;
  /**
   * Mark `[start, end)` of a column dirty.  Marks coalesce into the one
   * span per column: a scattered write pattern widens the span rather
   * than accumulating entries, so the renderer re-uploads a contiguous
   * range (cheap) instead of tracking every touched slot (expensive) —
   * over-uploading unchanged slots inside the hull is the accepted cost.
   *
   * @param column — the column to dirty
   * @param start — first slot touched
   * @param end — one past the last slot touched; defaults to one slot
   */
  mark(column: ColumnId, start: number, end?: number): void;
  /**
   * Flag that a group's tables grew.  Capacity growth invalidates the
   * renderer's buffers wholesale, so the flag outranks the spans: the
   * consumer reallocates and re-uploads `[0, highWater)` regardless of
   * what any span says.
   *
   * @param group — the group whose capacity changed
   */
  markResized(group: GroupName): void;
  /** Whether anything is pending — spans, a resize, or a bare touch(). */
  hasDirty(): boolean;
  /**
   * Return the accumulated delta and reset to clean, all at once — there
   * is exactly one consumer (the renderer's frame), and a second call
   * before the next mutation yields an empty delta.  Draining is what
   * makes the accumulated spans safe to widen: nothing outlives a frame.
   *
   * @param nodeHighWater — the node table's current high water mark
   * @param edgeHighWater — the edge table's current high water mark
   * @returns the spans, resize flags and high water marks for this frame
   */
  take(nodeHighWater: number, edgeHighWater: number): StoreDelta;
  /**
   * Subscribe to invalidation.  Callbacks fire on a microtask, once per
   * burst of mutations, and are skipped entirely when the state was
   * already drained synchronously — so a caller that mutates and then
   * renders in the same task never schedules a redundant frame.
   *
   * @param cb — run when the tracker goes from clean to dirty
   * @returns an unsubscribe function (safe to call from within `cb`;
   *   the callback list is snapshotted before dispatch)
   */
  onInvalidate(cb: () => void): () => void;
  private schedule;
}
//#endregion
//#region src/store/curve-index.d.mts
/**
 * The styled manual-endpoint record (12c): `source/target-endpoint` +
 * `source/target-distance-from-node`, parsed to the endpoint-block
 * float layout (see curve-geometry.mts).  Null means all-default (the
 * common case — no block is emitted and derivation is unchanged).
 */
interface EndpointSpec {
  srcMode: number;
  srcA: number;
  srcB: number;
  srcPct: number;
  srcDist: number;
  tgtMode: number;
  tgtA: number;
  tgtB: number;
  tgtPct: number;
  tgtDist: number;
}
/**
 * The 12b styled record (only stored for blob-family styles; readback
 * falls back to these defaults — v3's — when absent).  Lists are stored
 * as parsed (copies owned by the style layer, treated read-only here).
 */
interface CurveStyleExtras {
  /** control-point-distances (null = unset; v3 has no default) */
  ctrlDists: number[] | null;
  /** control-point-weights (default [0.5]) */
  ctrlWeights: number[];
  segDists: number[];
  segWeights: number[];
  segRadii: number[];
  /** radius-type per point: 1 = arc-radius, 0 = influence-radius */
  radiusTypes: number[];
  /** EDGE_DIST_* */
  edgeDistances: number;
  taxiDir: number;
  /** percent turns store the fraction (v3's pfValue); px turns the px */
  taxiTurn: number;
  taxiTurnPercent: boolean;
  taxiTurnMinDist: number;
  taxiRadius: number;
}
/** What the index needs from the store (kept narrow for testability). */
interface CurveHost {
  /** the edge.endpoints column (source, target node slots interleaved) */
  endpoints(): Uint32Array;
  /** live edge slots in insertion order (for the lazy pair-index build) */
  aliveEdgeSlots(): number[];
  /** write the derived params (column write + FLAG_CURVED + dirty span) */
  writeParams(slot: number, p0: number, p1: number, p2: number, kind: number): void;
  /** write a blob-backed record + its header (12b families; endptPct
   * is the 12c pct-endpoint magnitude in node-half units, 0 when none) */
  writeBlobParams(slot: number, kind: number, values: ArrayLike<number>, n: number, dev: number, box: boolean, endptPct: number): void;
  /** the edge's stable id hash (haystack angle seeding, 12c) */
  idHash(slot: number): number;
  /** schedule a frame / mark non-column dirt (DirtyTracker.touch) */
  schedule(): void;
  /** display-tier shown state (round 22.3): hidden edges leave their
   * bundles and loop staggers; `visibility: 'hidden'` edges do NOT
   * (paint-only — ranks stay stable), so this reads FLAG_VISIBLE */
  edgeShown(slot: number): boolean;
  /** compound relation (round 14.10): the two nodes are in an
   * ancestor/descendant relation, or a === b names a parent — such
   * edges route around the outside regardless of curve style */
  relation(a: number, b: number): boolean;
  /** the node's outer half-width (the compound-loop stretch input) */
  outerHalfW(slot: number): number;
}
declare class CurveIndex {
  private host;
  private style;
  private step;
  private weight;
  private loopDir;
  private loopSweep;
  /** the 12b family record per slot (null for straight/bezier styles) */
  private extra;
  /** 12c styled records: haystack-radius and the manual-endpoint spec */
  private hayRadius;
  private endpt;
  /** unordered endpoint pair → member edge slots (non-loop edges only);
   * null until some edge styles bezier */
  private pairs;
  /** node slot → its loop edge slots (always maintained; loops are rare) */
  private loops;
  private pending;
  /** non-loop blob-family edges awaiting per-edge derivation */
  private pendingSlots;
  private warnedCap;
  private warnedEndptDist;
  /**
   * @param host — the store's narrow callback surface; the index reads
   *   and writes columns only through it, so the store keeps sole
   *   ownership of dirty tracking and the index stays testable against
   *   a stub.  The pair map starts null — a graph where nothing styles
   *   `bezier` (and has no compound relation) never builds one.
   */
  constructor(host: CurveHost);
  /**
   * Store an edge's styled curve record (the StyleEngine's write path).
   * A changed record marks the edge's pair for re-derivation; a bezier
   * record lazily builds the pair index on first use.
   */
  setStyle(slot: number, style: number, stepSize: number, weight: number, loopDirection: number, loopSweep: number, extras?: CurveStyleExtras | null, haystackRadius?: number, endpoints_?: EndpointSpec | null): void;
  /** The styled record (stored truth for the style getters).  `extras`
   * is null unless the style is a 12b family. */
  styleAt(slot: number): {
    style: number;
    stepSize: number;
    weight: number;
    loopDirection: number;
    loopSweep: number;
    extras: CurveStyleExtras | null;
    haystackRadius: number;
    endpoints: EndpointSpec | null;
  };
  /**
   * Register a new edge in the structural indexes.  A loop joins its
   * node's loop list and re-staggers immediately; a non-loop edge joins
   * its pair only if the pair map exists, and does *not* mark the pair
   * pending — a straight member changes no bundle, and a bezier one is
   * marked by its own style apply.  A compound relation (14.10) is the
   * exception: it routes around the outside under every style, so it
   * forces the pair map to exist and marks the pair.
   *
   * @param slot — the new edge's slot
   * @param source — the source node's slot
   * @param target — the target node's slot
   */
  onAddEdge(slot: number, source: number, target: number): void;
  /**
   * A display-tier shown/hidden flip (round 22.3): the edge's bundle
   * membership (or loop stagger) changes, so its pair re-derives —
   * v3's display semantics, where siblings re-fan around a hidden
   * member.  Visibility flips never come here, so `visibility: hidden`
   * keeps every rank stable by construction.
   */
  onEdgeShownChanged(slot: number): void;
  /**
   * A hierarchy change moved the relation of this pair (round 14.10):
   * mark it for re-derivation, building the pair map first if the pair
   * is now compound-related — the compound derivation reads bundle
   * indices, so it can not run without one.  Takes node slots, not an
   * edge slot: a single ancestry change can flip every edge between the
   * two nodes at once.
   *
   * @param a — one endpoint node's slot
   * @param b — the other endpoint node's slot (a === b names a loop)
   */
  invalidateRelation(a: number, b: number): void;
  /**
   * Unregister an edge: drop it from its loop list or pair, re-derive
   * the remaining members (a departing bezier member re-fans the
   * bundle), and reset both the styled record and the derived params so
   * a recycled slot reads benign defaults — the straight write also
   * frees any blob record the edge held.  Must be called with the
   * edge's *current* endpoints, before the store frees the slot.
   *
   * @param slot — the departing edge's slot
   * @param source — the source node's slot
   * @param target — the target node's slot
   */
  onRemoveEdge(slot: number, source: number, target: number): void;
  /**
   * Re-point an edge at new endpoints.  Unlike remove + add, the styled
   * record survives — only membership moves — so the edge keeps its
   * curve style across a `move()`.  Both the old and the new pair
   * re-derive, and an edge leaving a loop is reset to straight first,
   * since its new pair may need no derivation at all and would
   * otherwise leave the stale loop params standing.
   *
   * @param slot — the edge's slot
   * @param oldSource — the source node's slot before the move
   * @param oldTarget — the target node's slot before the move
   * @param source — the source node's slot after the move
   * @param target — the target node's slot after the move
   */
  onMoveEdge(slot: number, oldSource: number, oldTarget: number, source: number, target: number): void;
  /**
   * Whether any pair or per-edge record is awaiting derivation.  True
   * means the edge.curveParams column does not yet agree with the
   * styled records — callers that need exact params (the delta, bounds,
   * the accessors) `flush()` first.
   */
  hasPending(): boolean;
  /** Re-derive the params of every pending pair and per-edge record
   * (lazy; see module doc). */
  flush(): void;
  /**
   * The compound-loop derivation (14.10): v3's findCompoundLoopPoints
   * params — the loop distance (unbundled styles take
   * control-point-distances[0], j = 0, v3's rule) and the bundle index.
   * p2 carries a conservative derivation-time excursion bound for the
   * cull slack (the geometry itself evaluates from live inputs): the
   * control offset x the current max stretch x 2 — stretch grows only
   * logarithmically with node size, so the margin outlasts any
   * realistic auto-bounds growth, and relation changes re-derive.
   * Freshness under size changes (round 25's containment argument):
   * auto-bounds derive parents from children's *outer* halves, so an
   * ancestor's outerHalfW always dominates its descendants' — the max
   * stretch below is always the ancestor end's, and it can only move
   * when the ancestor's own box moves, which materializeParentGeom
   * invalidates.  No per-size-write invalidation is needed.
   */
  private writeCompoundDerived;
  /**
   * Slot compaction (19.2).  The per-edge styled records permute through
   * `edgeRemap` (null when only nodes compacted); the pair/loop maps —
   * keyed on *node* slots — rebuild from the live endpoints either way.
   * The remap is monotone, so bundle rank, loop stagger and the σ
   * orientation all read identically through the new slots: derived
   * params in the curveParams column (already moved with the table) stay
   * valid with **no re-derivation**.  Call after the endpoints column is
   * rewritten, with derivations flushed.
   */
  remapSlots(edgeRemap: Uint32Array | null): void;
  private markPair;
  /** Build the pair map from the live edges (first bezier record). */
  private buildPairIndex;
  private derivePair;
  private deriveLoops;
  /**
   * Per-edge derivation for the 12b blob families.  Records are
   * position-independent (the frame is applied at eval time), so only
   * style changes re-derive — never drags or layouts.  Interior counts
   * cap at the strip subdivision's limits (a recorded deviation from
   * v3's unbounded lists); weights clamp to [-1, 2] so the box cull
   * bound stays sound, and any weight outside [0, 1] marks the edge
   * box-bounded (FLAG_CURVED_BOX via the host).
   */
  private deriveEdge;
  /**
   * v3's edge-distances: 'endpoints' rule (12c): the mode only holds
   * when *both* ends are manual (point or angle forms); otherwise warn
   * once — v3's message — and fall back to 'intersection'.
   */
  private resolveEdgeDistances;
  /** Straight-styled derivation: plain straight params, or — with a
   * manual-endpoint spec — the CURVE_MULTI n = 0 chord record. */
  private writeStraightDerived;
  /** Bundled-bezier derivation: fixed-column params, or — with a
   * manual-endpoint spec — the promoted CURVE_MULTI n = 1 record (the
   * control formula is identical, so the curve is unchanged). */
  private writeBezierDerived;
  /**
   * Blob write with the 12c endpoint prefix: when the slot has a
   * manual-endpoint spec, the record is prefixed by the 10-float block
   * and the kind carries CURVE_HAS_ENDPT; px point offsets fold into
   * the header deviation, and pct offsets past the node half mark the
   * edge box-bounded and feed the store's monotone pct slack.  `taxi`
   * drops the endpoint *modes* (v3 forces outside-to-node for taxi)
   * while keeping the distances.
   */
  private writeBlob;
  private capCount;
  private clampWeight;
  private ensure;
}
//#endregion
//#region src/store/hierarchy.d.mts
/**
 * Per-parent compound style inputs (CPU-only; written by the StyleEngine
 * via GraphStore.setCompoundStyle).  `padding` is px, or a fraction when
 * `paddingUnit` is '%' (v3's pfValue convention) resolved against the
 * children bb per `relativeTo`.  The four v3 min-size bias props are
 * dropped by decided design (round 14): the min clamp splits overflow
 * evenly about the children center — exactly v3's default-bias behavior.
 */
interface CompoundStyle {
  padding: number;
  paddingUnit: 'px' | '%';
  relativeTo: 'width' | 'height' | 'average' | 'min' | 'max';
  minWidth: number;
  minHeight: number;
}
//#endregion
//#region src/curve-geometry.d.mts
/**
 * Per-end arrow shortenings for one edge, in model px (round 56).
 *
 * v3 keeps *two* shortened points per end and they are not the same
 * point: the drawn line stops `gap` behind the node boundary, while the
 * arrow tip sits `spacing` behind it.  Both are supplied by the caller
 * rather than derived here, because the arrow shape and scale live in
 * columns this module deliberately does not read — the same reason the
 * node halves arrive as numbers.
 *
 * The WGSL twins take the same two quantities out of `edge.width`'s
 * lane 1 and compute them with generated copies of `arrowGap` /
 * `arrowSpacing`, so the two sides agree by construction.
 */
interface ArrowTrim {
  /** where the drawn line stops, behind the source/target boundary */
  srcGap: number;
  tgtGap: number;
  /** where the arrow tip sits, behind the source/target boundary */
  srcSpacing: number;
  tgtSpacing: number;
}
/** One edge's evaluated curve: endpoints on the node boundaries, the
 * control point(s), and the label-anchor midpoint. */
interface CurveEval {
  kind: number;
  /** start point (source-boundary) */
  sx: number;
  sy: number;
  /** end point (target-boundary) */
  ex: number;
  ey: number;
  /** control point (bezier), or the loop's first control */
  c1x: number;
  c1y: number;
  /** the loop's second control (loop only) */
  c2x: number;
  c2y: number;
  /** curve midpoint: bezier Q(0.5); loop: the control midpoint */
  mx: number;
  my: number;
  /** the *arrow* points (round 56) — `spacing` behind each boundary,
   * where `sx/sy` and `ex/ey` are `gap` behind it.  v3 keeps both
   * (`rs.arrowStartX/Y` against `rs.startX/Y`) and the public endpoint
   * accessors report these, not the line ends. */
  asx: number;
  asy: number;
  aex: number;
  aey: number;
}
/**
 * One evaluated route: the two boundary endpoints plus the interior
 * points (multibezier: the control points; segments/taxi: the segment
 * points), stored as q[0] = start, q[1..n] = interior, q[n+1] = end.
 * Round variants carry a radius + arc-mode per interior point.
 */
interface CurveRoute {
  kind: number;
  /** interior point count */
  n: number;
  qx: Float64Array;
  qy: Float64Array;
  round: boolean;
  radius: Float64Array;
  arcMode: Uint8Array;
  /** the *arrow* points (round 56): `spacing` behind each resolved
   * endpoint, where `q[0]`/`q[n+1]` are `gap` behind it. */
  asx: number;
  asy: number;
  aex: number;
  aey: number;
}
//#endregion
//#region src/store/graph-store.d.mts
/** A percent-or-px value ({ v, pct }) as parsed by the style engine. */
interface BgLen {
  v: number;
  pct: boolean;
}
/** A background-width/-height value: mode 0 auto, 1 px, 2 percent. */
interface BgSize {
  mode: number;
  v: number;
}
/** One styled background image, as the style engine hands it over. */
interface NodeImageSpec {
  url: string;
  sdf: boolean;
  crossOrigin: string;
  fit: number;
  repeat: number;
  clip: number;
  containment: number;
  smoothing: boolean;
  opacity: number;
  posX: BgLen;
  posY: BgLen;
  offX: BgLen;
  offY: BgLen;
  w: BgSize;
  h: BgSize;
  tint: [number, number, number, number];
}
/** A stored image record decoded back out of the pool (readback). */
interface NodeImageRecord extends Omit<NodeImageSpec, 'url' | 'crossOrigin'> {
  entryId: number;
  url: string;
}
interface AddElementOpts {
  selected?: boolean;
  selectable?: boolean;
  visible?: boolean;
  grabbable?: boolean;
  locked?: boolean;
  /** defaults true for edges, false for nodes (as in v3) */
  pannable?: boolean;
}
/** A coalesced [start, end) span of data writes to one watched (group, key). */
interface MapperSpan {
  group: GroupName;
  key: string;
  start: number;
  end: number;
}
/** One group's slot-moving compaction result (round 19.1). */
interface GroupCompaction {
  /** old slot → new slot; NO_SLOT where the old slot was a hole */
  remap: Uint32Array;
  /** live elements whose slot actually changed */
  moved: number;
  oldHighWater: number;
}
/**
 * The CPU-canonical columnar model: NodeTable + EdgeTable + IdMap +
 * Adjacency, with per-column dirty spans for the renderer.  Synchronous API
 * reads always hit these typed-array columns; the store works headless (no
 * GPU, Node-testable).  The store itself never emits events — the core does.
 */
declare class GraphStore implements ModelView {
  /** the node table: one typed-array column per `node.*` column id */
  readonly nodes: ColumnTable;
  /** the edge table: one typed-array column per `edge.*` column id */
  readonly edges: ColumnTable;
  /** id <-> (group, slot) index; owns id uniqueness across both groups */
  readonly ids: IdMap;
  /** the incident-edge index (CSR + overlay); rebuilt on waste */
  readonly adj: Adjacency;
  /** the sidecar `data()` store (typed columns + dictionaries) */
  readonly data: DataStore;
  /** per-column dirty spans, drained by takeDelta() once per frame */
  readonly dirty: DirtyTracker;
  /** styled curve records + the lazy derivation of edge.curveParams */
  readonly curves: CurveIndex;
  /** the compound hierarchy (round 14); reads go through the delegates below */
  private hierarchy;
  /** per-parent stashed *style* size: the degenerate-children fallback,
   * restored to the column when the node becomes a leaf again (14.3) */
  private parentFallback;
  /** fires on the compounds 0 <-> >0 transitions (the core re-configures
   * paint eval: the opacity fold demotes the GPU mapper, round 14.4) */
  onCompoundsToggled: (() => void) | null;
  /** fires when a node flips leaf <-> parent (the core restyles the slot
   * against the right sheet group, round 14.6) */
  onParentFlip: ((slot: number) => void) | null;
  /** fires when a node's parent changes (structural case conditions on
   * the moved node re-evaluate, round 14.7) */
  onReparented: ((slot: number) => void) | null;
  private curveDevMax;
  private nodeHalfMax;
  private borderMax;
  /** monotone: some edge has carried a box-bounded curve kind (taxi /
   * extrapolated weights), so curveSlack() must stay engaged even when
   * curveDevMax is 0 */
  private hasBoxCurves;
  /** monotone: some edge has entered the curved *stream* — see
   * hasCurvedEdges(), which gates the renderer's curved pipelines */
  private curvedEver;
  /** monotone (12c): the largest pct-endpoint magnitude in node-half
   * units — offsets past 1 exceed the slack's node-half term, so the
   * excess joins curveSlack() (see that doc) */
  private endptPctMax;
  /** monotone (12c): the largest haystack-radius any edge has styled —
   * haystack offsets stray from the endpoint centers by at most
   * radius × outerHalf, and the straight-stream cull tests grow by
   * haystackSlack() to stay sound */
  private haystackRadiusMax;
  /** the 12b variable-length curve param pool (see store/curve-blob.mts) */
  private blob;
  /** the C3 custom-polygon unit-point pool */
  private polyPool;
  /** the 15.2 background-image record pool (IMG_STRIDE floats per image) */
  private imagePool;
  /** round 23: chart records (node.chartRef = offset | n << 24) */
  private chartPool;
  /** live charted nodes (the chart pass skips at 0) */
  private chartedNodes;
  /** the unique-image registry (round 15.1); style writes acquire/release */
  readonly images: ImageRegistry;
  private geoEpoch;
  private edgeBBEpoch;
  private edgeBB;
  private curveScratch;
  private routeScratch;
  private order;
  private labels;
  private labelDirty;
  /** laid (or estimated) label block dims per stream (round 16.2) */
  private labelDims;
  /** global label font-family (one font per glyph atlas); style-owned */
  labelFont: string;
  /** global label font-style ('normal' / 'italic'); style-owned (13 D1) */
  labelFontStyle: string;
  /** global label font-weight ('normal', 'bold', a number); style-owned */
  labelFontWeight: string;
  /** data keys whose writes feed GPU-evaluated mappers (registered by the StyleEngine) */
  private watchedKeys;
  /** reserved state keys some `case` condition reads (registered by the StyleEngine) */
  private watchedStates;
  /**
   * Told when a styled state bit flips on live slots — the core wires
   * this to the StyleEngine's state refresh (round 57.1; the round-61
   * partition-record diff since).  Null until then, and consulted
   * before any per-slot bookkeeping, so a store with no style attached
   * does the flag write and nothing else.
   */
  onStateChange: ((group: GroupName, key: string, slots: readonly number[]) => void) | null;
  /** coalesced watched-key write spans, keyed 'group:key' (consumed by the renderer) */
  private mapperSpans;
  /** forwarding chains for refs staled by slot compaction (19.3):
   * packed (slot, gen) → packed (newSlot, newGen), per group */
  private forwards;
  private _compactEpoch;
  /**
   * Monotonic counter of structural changes — every element added or
   * removed, and every slot compaction (round 34.2; a plain field since
   * round 62.5b, because the getter call showed on the memo-hit reads
   * that consult it).  Treat as read-only outside the store.
   */
  structureEpoch: number;
  /** Told when structureEpoch moves (round 62.5b) — the core nulls its
   * whole-graph collection cache here, so the memo-hit read needs no
   * epoch compare at all. */
  onStructureChange: (() => void) | null;
  /** The one place structureEpoch moves: bump plus the push-invalidation
   * hook (round 62.5b). */
  private bumpStructureEpoch;
  /**
   * Build an empty store: both tables at zero capacity, empty id /
   * adjacency / data / hierarchy / curve indexes, and the sub-index
   * callbacks wired.  Those callbacks are the whole point of the
   * constructor — the blob pools' relocation hooks rewrite their
   * owning header columns, the dict-remap hook re-uploads a watched
   * data column, the CurveIndex reads endpoints/flags/hierarchy back
   * out of the store, and the HierarchyIndex writes derived parent
   * geometry back into the columns.  Takes no arguments: the store is
   * headless and grows on demand.
   */
  constructor();
  /**
   * The ColumnTable for a group — the group-generic dispatch every
   * other method routes through, so callers never branch on 'nodes' /
   * 'edges' themselves.
   *
   * @param group — 'nodes' or 'edges'
   * @returns the live table (not a copy; its columns are reallocated on
   * growth, so never cache the arrays across a mutation)
   */
  table(group: GroupName): ColumnTable;
  /**
   * The group's allocated slot capacity — the length the renderer sizes
   * its GPU buffers to.  Always >= highWater(); grows by doubling and
   * shrinks only in a compaction.
   */
  capacity(group: GroupName): number;
  /**
   * One past the highest slot ever allocated in the group — the only
   * range the renderer must upload or scan.  Holes below it are
   * tombstones (flags 0, no FLAG_ALIVE), which collapse to degenerate
   * quads rather than being skipped.
   */
  highWater(group: GroupName): number;
  /**
   * The live typed array backing a column, addressed by column id (the
   * group is looked up from the contract's spec).  The array is the
   * store's own storage — writing through it bypasses the dirty
   * tracker, so readers must not mutate it.
   */
  column(id: ColumnId): ColumnArray;
  /** The node position column through the hot cache (round 62.4/5). */
  nodePositions(): Float32Array;
  /** The edge endpoints column through the hot cache (round 62.4/5). */
  edgeEndpoints(): Uint32Array;
  /** Whether any column write or touch() is pending a frame. */
  hasDirty(): boolean;
  /**
   * Drain the frame's pending writes: flushes the lazy derivations
   * first (so parent auto-bounds and curve params land as ordinary
   * column spans inside this delta), then takes the column spans and
   * each blob pool's dirty range.  Destructive — the trackers are
   * cleared, so exactly one consumer (the renderer) may call it.
   *
   * @returns the delta, with the four blob ranges attached only when
   * that pool actually changed
   */
  takeDelta(): StoreDelta;
  /** The 12b curve param pool's backing array (the renderer's upload
   * source); reallocated on growth, so re-read it every frame. */
  curveBlob(): Float32Array;
  /** Floats in use in the curve pool — the upload length (data() may be
   * longer: the pool over-allocates). */
  curveBlobLength(): number;
  /** The C3 custom-polygon unit-point pool's backing array. */
  polyBlob(): Float32Array;
  /** Floats in use in the polygon pool — the upload length. */
  polyBlobLength(): number;
  /**
   * Store a node's custom polygon points (round 13 C3): flat unit
   * [x, y, ...] pairs, or null to clear.  Returns the packed record
   * ref (offset | pointCount << 24) for borderGeom[0].
   */
  setPolygonPoints(slot: number, points: number[] | null): number;
  /** The 15.2 background-image record pool's backing array. */
  imageBlob(): Float32Array;
  /** Floats in use in the image pool — the upload length. */
  imageBlobLength(): number;
  /** The round-23 chart record pool's backing array. */
  chartBlob(): Float32Array;
  /** Floats in use in the chart pool — the upload length. */
  chartBlobLength(): number;
  /** Live charted nodes (round 23) — the renderer's pass-skip gate. */
  chartCount(): number;
  /** live imaged-node count (the renderer's zero-cost gate, 15.3) */
  private imagedNodes;
  /** Live nodes carrying background images (15.3) — the renderer's
   * pass-skip gate, so an imageless graph pays nothing. */
  imageCount(): number;
  /**
   * Store a node's background-image records (round 15.2), or null to
   * clear.  Acquires the new urls' registry entries *before* releasing
   * the old ones, so a shared url surviving a restyle never transits
   * refcount 0.  Encoding per image (IMG_STRIDE floats): [entryId,
   * modeFlags (fit | repeat<<2 | clip<<4 | containment<<5 |
   * smoothing<<6 | sdf<<7), opacity, posX, posY, offX, offY, w, h,
   * unitFlags (posXPct | posYPct<<1 | offXPct<<2 | offYPct<<3 |
   * wMode<<4 | hMode<<6), tintRG (r + g×256), tintBA (b + a×256)].
   * Draw-only paint: no geoEpoch bump, no bb/pick involvement.
   *
   * @param slot — the node slot
   * @param specs — the styled images in paint order, or null/empty to
   * clear (clearing an already-imageless node is a no-op fast path)
   */
  setNodeImages(slot: number, specs: NodeImageSpec[] | null): void;
  /**
   * Write (or clear) a node's chart record (round 23).  The blob layout
   * is CHART_HEADER floats — kind, size, hole, startAngle, direction,
   * n — then n × (value, r+g·256, b+a·256): colors split across two
   * small-integer floats (the image-record trick — packed u32 color
   * bits would risk NaN canonicalization through the f32 pool).
   * Colors arrive alpha-folded (chart-opacity, the B1 pattern).
   */
  setChart(slot: number, rec: {
    kind: number;
    size: number;
    hole: number;
    startAngle: number;
    direction: number;
    opacity: number;
    values: number[];
    colors: [number, number, number, number][];
  } | null): void;
  /** A node's decoded chart record, or null when chartless (round 23). */
  chartAt(slot: number): {
    kind: number;
    size: number;
    hole: number;
    startAngle: number;
    direction: number;
    opacity: number;
    values: number[];
    colors: [number, number, number, number][];
  } | null;
  /** A node's decoded background-image records, or null when imageless. */
  nodeImagesAt(slot: number): NodeImageRecord[] | null;
  /** A node's custom polygon points (unit pairs), or null. */
  polygonPointsAt(slot: number): Float64Array | null;
  /**
   * Subscribe to "the model changed, a frame is needed".  Fires on the
   * clean -> dirty transition only (not per write), so it is safe to
   * hook a requestAnimationFrame schedule to it.
   *
   * @param cb — called when the store goes dirty
   * @returns an unsubscribe function
   */
  onInvalidate(cb: () => void): () => void;
  /**
   * Register the data keys whose writes feed GPU-evaluated mappers.
   * Replaces the group's whole set (the StyleEngine re-derives it per
   * sheet).  Writes to unwatched keys cost one Set lookup and nothing
   * else.
   */
  watchDataKeys(group: GroupName, keys: Iterable<string>): void;
  /**
   * Register the reserved state keys (`'::selected'`, `'::active'`, …)
   * the current sheet's `case` conditions read.  Flag writes outside
   * this set skip the change notification entirely, which is what makes
   * an unstyled state cost one mask test per flip.
   *
   * Separate from `watchDataKeys` because the two sets answer different
   * questions: that one is "which data writes feed the GPU eval kernel"
   * and excludes conditionals on principle, while a state condition is
   * always a conditional and may sit on any property.
   *
   * @param group — the element group the keys belong to
   * @param keys — the reserved keys; replaces the previous set
   */
  watchStateKeys(group: GroupName, keys: Iterable<string>): void;
  /** Data write through the mapper-span choke point (the collection's data setter). */
  setData(group: GroupName, slot: number, key: string, value: unknown): void;
  /**
   * Coalesce a watched-key write span.  Schedules a frame via touch() —
   * deliberately not a column span, so paint-only data writes leave the
   * pick-tile cache valid.
   */
  markDataWrite(group: GroupName, key: string, start: number, end: number): void;
  /** Pending watched-key write spans, returned and cleared. */
  takeMapperSpans(): MapperSpan[];
  /**
   * Mint a ref for a slot: the (group, slot, gen) triple collections
   * hold instead of element objects.  The generation stamp is what
   * makes a recycled slot detectable — see isCurrent().  Cheap (one
   * object); no validity check, so minting a ref for a dead slot yields
   * a ref that immediately reads as stale.
   */
  ref(group: GroupName, slot: number): Ref;
  /**
   * Whether a ref still points at the live element it was created for.
   * Since round 19.3 a stale ref whose element merely *moved* in a slot
   * compaction is repaired **in place** through the forwarding chain
   * (fixing every holder of that ref object) and reads as current;
   * a removed element's ref stays dead — repair never resurrects.
   */
  isCurrent(ref: Ref): boolean;
  /** Bumped once per slot-moving compaction; collections use it to
   * invalidate cached packed-key membership sets (19.3). */
  get compactEpoch(): number;
  /**
   * Chase a stale ref through the forwarding chain (each compaction a
   * moved element survives adds one link) and, on reaching a live
   * identity, rewrite the ref in place.  Entries persist and compose, so
   * repair is total for any ref whose element still exists.
   */
  private repairStale;
  /**
   * Resolve an element id to a fresh ref (backs cy.getElementById).
   * Ids are unique across both groups, so no group argument is needed.
   *
   * @returns undefined when no live element carries the id
   */
  lookup(id: string): Ref | undefined;
  /**
   * The allocation-free twin of `lookup()` (round 62.3): the id's packed
   * `(slot << 1) | groupBit` code, or −1.  For callers that only need to
   * reach the interned handle — `getElementById` — the two objects
   * `lookup()` allocates per call are pure cost.
   *
   * @param id — the element id
   * @returns the packed code (group bit 1 = edges), or −1 when absent
   */
  lookupCode(id: string): number;
  /**
   * The id occupying a slot, or undefined when the slot is a hole.
   * The reverse of lookup(); ids are stored out of line, so this is the
   * only string the columnar hot paths ever touch.
   */
  idAt(group: GroupName, slot: number): string | undefined;
  /**
   * Preallocate ahead of a bulk add: grows each table at most once for the
   * incoming element counts (net of reusable free slots), so the adds
   * themselves never hit the doubling cascade.
   */
  reserve(nodeCount: number, edgeCount: number): void;
  /**
   * Add one node at a model position, reusing a free slot when there is
   * one.  Only position and flags are written — every style column keeps
   * its zero default until the StyleEngine writes it.
   *
   * @param id — must be unused across both groups
   * @param opts — initial state bits; unset ones take v3's defaults
   * (visible, selectable, grabbable, unselected, unlocked, not pannable)
   * @returns the allocated slot
   * @throws when the id already exists
   */
  addNode(id: string, x: number, y: number, opts?: AddElementOpts): number;
  /**
   * Add one edge between two existing nodes, given by *id* (the def
   * path; the columnar path takes payload indices instead).  Registers
   * the edge with the adjacency index and the CurveIndex — the latter
   * makes it a member of its endpoint pair's bundle, so its siblings
   * re-fan lazily.
   *
   * @param opts — as addNode, except `pannable` defaults true (v3)
   * @returns the allocated slot
   * @throws when the id already exists, or either endpoint id is not a
   * live node
   */
  addEdge(id: string, sourceId: string, targetId: string, opts?: AddElementOpts): number;
  /**
   * Columnar bulk node add: typed-array columns write straight into the
   * store (one memcpy for the contiguous fresh run), with no per-element
   * def objects.  Returns the allocated slots, index-aligned with the
   * payload arrays.  On error the graph may be partially mutated (as with
   * a mid-list throw in the def path).
   */
  addNodesColumnar(cols: ColumnarNodes, newId: () => string): Uint32Array;
  /**
   * Columnar bulk edge add: endpoints are indices into `nodeSlots` (the
   * same payload's nodes) — no id lookups per edge.
   */
  addEdgesColumnar(cols: ColumnarEdges, nodeSlots: Uint32Array, newId: () => string): Uint32Array;
  /**
   * Remove one edge: unlinks it from the adjacency index and its curve
   * bundle (siblings re-fan), then tombstones the slot for reuse.  The
   * slot's generation bumps, so every outstanding ref to it goes stale
   * — and stays stale, since ref repair never resurrects a removal.
   */
  removeEdge(slot: number): void;
  /** Re-point an existing edge at new endpoint node slots (updates adjacency in place). */
  moveEdge(slot: number, source: number, target: number): void;
  /** The node must have no incident edges or children left; the caller cascades removal of them first. */
  removeNode(slot: number): void;
  /**
   * Bring every lazily-derived structure up to date: stale parent
   * auto-bounds first (materialized into node.size/node.position), then
   * pending curve derivations — curve geometry reads the sizes and
   * positions the hierarchy flush writes.  Cheap when nothing is
   * pending; called from takeDelta, the bb/refsInBox scans, and the
   * geometry accessors.
   */
  flushDerived(): void;
  /**
   * The hierarchy flush's write sink: derived parent geometry lands in
   * the real columns (position, size, outerHalf) with normal dirty
   * spans — but never re-marks the hierarchy, so a flush can not
   * re-trigger itself.  A size change re-anchors the parent's label
   * (the sidecar entry bakes anchors from the node extents) and feeds
   * the monotone cull-slack meter.
   */
  private materializeParentGeom;
  /**
   * Re-derive a node label's anchor from new drawn extents.  The sidecar
   * entry carries enough to invert the StyleEngine's bake: halign/valign
   * reconstruct from the block-fraction shifts, and the anchor formulas
   * are the engine's own (see writeLabel) — no engine round trip needed.
   */
  private reanchorLabel;
  /** Shift a parent's whole subtree by a delta (raw writes, one span). */
  private shiftSubtree;
  /** Mark a node's ancestor chain (and its own derived bounds when it is
   * a parent) stale; flushed lazily by flushDerived(). */
  markNodeGeo(slot: number): void;
  /** Store a parent's compound style inputs (padding / min size); the
   * StyleEngine's write path in 14.6, and testable directly. */
  setCompoundStyle(slot: number, style: Partial<CompoundStyle>): void;
  /** Partial compound-style update over the current record — the
   * padding tween's write (round 25.4; see HierarchyIndex). */
  updateCompoundStyle(slot: number, style: Partial<CompoundStyle>): void;
  /** The parent's resolved px padding (0 for leaves); flush first. */
  paddingOf(slot: number): number;
  /** The declared compound style record (the style readbacks' truth). */
  compoundStyleOf(slot: number): CompoundStyle;
  /**
   * Link a node under a parent node slot (-1 to orphan).  Cycle-safe:
   * a link that would make the node its own ancestor warns and no-ops
   * (v3's dropped-ref rule).  Maintains FLAG_PARENT/FLAG_CHILD, depths
   * and the parent draw permutation.
   */
  setParent(slot: number, parentSlot: number): void;
  /** Re-derive curve routing for every edge incident to a subtree (14.10). */
  private invalidateSubtreeEdgeRelations;
  /**
   * show()/hide() (round 14.4): FLAG_SELF_HIDDEN records the element's
   * own state; the effective FLAG_VISIBLE recomputes over affected node
   * subtrees (pruned — an unchanged effective bit means an unchanged
   * subtree).  Hidden children leave their ancestors' auto-bounds.
   * Returns the refs-array indices whose own state changed.
   */
  setVisibility(refs: readonly Ref[], visible: boolean, changedIdx?: number[] | null): number;
  /**
   * The `visibility` style prop (round 22): paint-only invisibility.
   * Sets the element's own FLAG_SELF_INVISIBLE and re-derives FLAG_DRAWN
   * (over the subtree for nodes — descendants of an invisible parent are
   * invisible, v3's rule).  Deliberately touches nothing else: space
   * consumers (bb, auto-bounds) and the curve bundles read FLAG_VISIBLE,
   * so an invisible element keeps its space and its bundle rank.
   */
  setInvisibility(group: GroupName, slot: number, invisible: boolean): void;
  /** Re-derive an edge's FLAG_DRAWN from its shown + invisible state.
   * (Endpoint invisibility is folded by the consumers — the kernels'
   * endpoint tests and the edge `visible()` read — not stored here.) */
  private refreshEdgeDrawn;
  /** Whether the element renders (round 22): the derived FLAG_DRAWN, with
   * edges additionally folding their endpoints (v3's visible() rule). */
  isDrawn(ref: Ref): boolean;
  /**
   * Recompute effective FLAG_VISIBLE — and, round 22, the derived
   * FLAG_DRAWN (visible AND no `visibility: 'hidden'` on self or any
   * ancestor) — for a node subtree, top-down with pruning: a node with
   * both bits unchanged has consistent descendants (their inputs did not
   * move).  A shown-bit change marks the ancestor chain's auto-bounds
   * stale (it entered or left the bb); a drawn-only change is paint-only
   * (invisible elements keep their space).
   */
  private refreshEffectiveVisibility;
  /** Bases of nodes whose stored opacity carries an ancestor fold
   * (absent = the column holds the base). */
  private opacityBase;
  /** The node's declared (pre-fold) opacity — what style('opacity') reads. */
  baseOpacityOf(slot: number): number;
  /** The product of the strict ancestors' bases. */
  private ancestorOpacityProduct;
  /**
   * A node opacity write under compounds: `base` is the declared value;
   * the stored column takes base x the ancestor product (v3's rendered
   * effectiveOpacity), and a parent's write refolds its subtree.
   */
  private writeBaseOpacity;
  /** Refold a whole subtree against its (possibly new) ancestor chain. */
  private refoldOpacitySubtree;
  /** Recursive half of the fold: children of a node whose folded value is `parentFolded`. */
  private refoldChildren;
  /** The node's parent slot, or -1 for orphans. */
  parentOf(slot: number): number;
  /** The node's child slots in link order (read-only; empty for leaves). */
  childrenOf(slot: number): readonly number[];
  /** Nesting depth (0 = top-level). */
  depthOf(slot: number): number;
  /** True when `ancestor` is on `slot`'s parent chain (not reflexive). */
  isAncestorOf(ancestor: number, slot: number): boolean;
  /** Count of live parent nodes. */
  parentCount(): number;
  /** Whether any compound parent exists (backs cy.hasCompoundNodes()). */
  hasCompounds(): boolean;
  /** The parent draw permutation: live parents sorted (depth asc, slot asc). */
  parentOrder(): Uint32Array;
  /** A node's model x.  Raw column read: a parent's derived position may
   * be stale, so call flushDerived() first when that matters. */
  getX(slot: number): number;
  /** A node's model y (raw column read; see getX on staleness). */
  getY(slot: number): number;
  /**
   * Move one node.  Under compounds this carries v3's beforePositionSet
   * semantics: moving a parent translates its whole subtree by the
   * delta (so the parent's own auto-derived position then equals the
   * written one exactly), and moving a child marks its ancestor chain's
   * bounds stale.  Bumps the geometry epoch, invalidating the exact
   * curve-bb memo.
   */
  setPosition(slot: number, x: number, y: number): void;
  /** Bulk position write (e.g. from a layout): one coalesced dirty span.
   * With compounds, each slot takes the sequential setPosition semantics
   * (a parent's write shifts its subtree first — v3's per-element order). */
  setPositions(slots: number[], xy: number[] | Float32Array): void;
  /**
   * Bulk constant/axis position write over node slots: sets x and/or y
   * (null leaves that axis unchanged) with one coalesced dirty span.
   */
  setPositionsConst(slots: ArrayLike<number>, x: number | null, y: number | null): void;
  /** Bulk position offset over node slots: one coalesced dirty span.
   * With compounds, v3's shift dedupe applies: a slot whose ancestor is
   * also in the set is skipped (the ancestor's subtree shift moves it). */
  shiftPositions(slots: ArrayLike<number>, dx: number, dy: number): void;
  /** The whole flags word for a slot (see the FLAG_* bits in
   * contract.mts); 0 for a tombstoned slot. */
  flags(group: GroupName, slot: number): number;
  private hotNodeV;
  private hotEdgeV;
  private hotNFlags;
  private hotNPos;
  private hotEFlags;
  private hotEEnds;
  /** The node flags column through the hot cache (round 62.5). */
  hotNodeFlags(): Uint32Array;
  /** The edge flags column through the hot cache (round 62.5). */
  hotEdgeFlags(): Uint32Array;
  /** Whether every bit of `bit` is set — the single-bit tests read as
   * a predicate, not a mask compare. */
  hasFlag(group: GroupName, slot: number, bit: number): boolean;
  /**
   * Set or clear flag bits on one slot, marking the flags column dirty
   * only when the word actually changes.  Raw: derived bits (VISIBLE,
   * DRAWN, PARENT, CHILD, CURVED) have owners that recompute them —
   * write those through setVisibility / setInvisibility / setParent /
   * the curve writers rather than here.
   */
  setFlag(group: GroupName, slot: number, bit: number, on: boolean): void;
  /**
   * Tell the style engine that a *styled* state bit flipped, so the
   * affected slots restyle.  This is what makes `{ when: { active:
   * true } }` work on any property: the flag write is the only event,
   * and every consequence — the mapper re-evaluation, the column
   * writes, the upload — is the ordinary refresh path from there.
   *
   * Cheap when nothing styles the state, which is the common case: the
   * mask test rejects the structural and internal bits outright, and
   * `markDataWrite`'s watched-key set rejects a state no `case`
   * condition mentions.  A sheet that says nothing about press pays one
   * `&` per press.
   */
  private noteStateChange;
  /**
   * Bulk flag write over a refs array (a collection's _refs): sets or
   * clears `bit` on every live ref, with the flags/gen columns hoisted out
   * of the loop and one coalesced dirty span per touched group.  Refs
   * lacking `requireBit` (when non-zero) are skipped, as are refs already
   * in the target state.  When `changedIdx` is given, the refs-array index
   * of each changed ref is appended (for per-element restyle/emit).
   * Returns the changed count.
   */
  flagRefs(refs: readonly Ref[], bit: number, on: boolean, requireBit?: number, changedIdx?: number[] | null): number;
  /**
   * Write a single-component numeric column (the StyleEngine's scalar
   * channel).  No-ops when the value is unchanged, so an idempotent
   * restyle costs no upload.  Two columns carry a cascade: `node.opacity`
   * under compounds is a *base* (the column stores the ancestor-folded
   * product, and a parent's write refolds its subtree — round 14.4), and
   * `node.borderWidth` refreshes the derived outerHalf column, feeds the
   * monotone cull slack, and marks the ancestors' auto-bounds stale.
   * Bumps the geometry epoch: scalar channels can move geometry.
   */
  setScalar(id: ColumnId, slot: number, value: number): void;
  /**
   * Write a two-component numeric column (sizes, positions-like pairs).
   * No-ops on an unchanged pair.  `node.size` runs the size cascade:
   * the monotone node-half meter, the parent style-size stash (a parent's
   * column is owned by auto-bounds, so the declared size lives in the
   * stash — tracked before the no-op check so it can never go stale),
   * the derived outerHalf write, the label re-anchor (25.1) and the
   * ancestors' auto-bounds staleness.
   */
  setPair(id: ColumnId, slot: number, a: number, b: number): void;
  /**
   * Write one component of a multi-lane column (round 25): the tween
   * executor's entry for lane writes.  `node.size` routes through
   * `setPair`, which runs the size cascade (outerHalf, label re-anchor,
   * compound auto-bounds staleness); other float columns write the lane
   * raw with a dirty mark.
   */
  setLane(id: ColumnId, slot: number, lane: number, value: number): void;
  /** `Uint32Array` alias of `edge.width`'s buffer, for the exact bit
   * copy below.  Re-derived when growth or compaction swaps the array. */
  private widthBitsView;
  /**
   * Write the packed arrow-shapes word, mirroring it bit-for-bit into
   * lane 1 of `edge.width` (round 56).
   *
   * The mirror exists because all four edge vertex stages already bind
   * `edge.width` and none has a spare storage-buffer slot, so this is how
   * the shape word — and with it v3's per-shape `gap` and `spacing` —
   * reaches the vertex stage that has to shorten the line.
   *
   * The copy goes through a `Uint32Array` view of the column's own
   * buffer rather than a bitcast via a JS number: an `arrow-scale` of
   * 7.94 or more sets bits 30..24, and with a mid-target shape ≥ 4
   * setting bit 23 the word *is* an f32 NaN pattern, whose payload a
   * round trip through a JS double would not preserve.
   *
   * @param slot — the edge slot
   * @param word — the packed word (see `edge.arrowShapes` in the contract)
   */
  setArrowShapes(slot: number, word: number): void;
  /**
   * Write-through for `edge.width`'s mirror lane: the shape word plus the
   * two `SHOWS_LINE` flags (round 56).
   *
   * Called from every write to either input — the shape word and the two
   * end-arrow colours — because the flags derive from both.  A head
   * "shows the line" when it is hollow, or when its stored alpha is below
   * opaque: exactly the cases where v3's `destination-out` erase is doing
   * the hiding rather than the head's own fill, and so exactly the cases
   * where v4 has to shorten the line past v3's `gap` to the head's own
   * depth.  An opaque filled head hides the difference either way, and
   * shortening further would cut the slivers v3 leaves where the head is
   * narrower than the line.
   *
   * Known limit, inherited rather than introduced: a paint channel the
   * mapper kernel owns can leave the *stored* arrow bytes stale (see the
   * getters' note in `style.mts`), so a head made translucent purely
   * on-device reads as opaque here.  The CPU column is what every other
   * CPU consumer reads too.
   */
  private updateArrowBits;
  /**
   * Write-through for the derived node.outerHalf column (size/2 +
   * borderWidth/2 per axis — see the contract): follows every size/border
   * write, so the column is never stale.  The curve shaders and the CPU
   * curve evaluator both read this column, so the two sides agree on the
   * exact f32 half-extents by construction.
   */
  private updateOuterHalf;
  /** live count of ghost-enabled nodes (the renderer skips the ghost
   * cull + draw entirely while this is 0) */
  private ghosts;
  /** Live ghost-enabled nodes (13 A1) — the renderer's pass-skip gate;
   * the bb scan also uses it to skip the ghost term. */
  ghostCount(): number;
  /**
   * Write a node's ghost record [offsetX, offsetY, ghostOpacity,
   * enabled] (the StyleEngine's write path).  Offsets are geometry —
   * they grow the bb scans — so writes bump the geometry epoch.
   */
  setGhost(slot: number, offX: number, offY: number, opacity: number, enabled: boolean): void;
  /** live counts of nodes with a visible overlay / underlay (13 A2) */
  private overlays;
  private underlays;
  /** Nodes with a visible overlay (13 A2) — the pass-skip gate. */
  overlayCount(): number;
  /** Nodes with a visible underlay (13 A2) — the pass-skip gate. */
  underlayCount(): number;
  /**
   * Write a node's overlay or underlay record (the StyleEngine's write
   * path): [rgba (opacity folded), padding×256, shape, radius×256 |
   * 0xffffffff = auto].  Padding is geometry (it grows the bb scans),
   * so writes bump the geometry epoch.
   */
  setNodeLayer(id: 'node.overlay' | 'node.underlay', slot: number, rgba: number, padding: number, shape: number, radius: number): void;
  /** live counts of edges with a visible overlay / underlay / casing */
  private edgeOverlays;
  private edgeUnderlays;
  private casings;
  /** Edges with a visible overlay (13 A2) — the pass-skip gate. */
  edgeOverlayCount(): number;
  /** Edges with a visible underlay (13 A2) — the pass-skip gate. */
  edgeUnderlayCount(): number;
  /** Edges with a visible line casing — the pass-skip gate. */
  casingCount(): number;
  /**
   * Write an edge's overlay or underlay record (round 13 A2):
   * [rgba (opacity folded), strokeWidth×256] — the stroke width is the
   * edge width + 2 × padding, derived at style-write time.
   */
  setEdgeLayer(id: 'edge.overlay' | 'edge.underlay' | 'edge.casing', slot: number, rgba: number, strokeWidth: number): void;
  /** live count of edges with any visible mid arrow (round 13 C1) —
   * the renderer skips the mid draws entirely while 0 */
  private midArrows;
  /** Edges with any visible mid arrow (13 C1) — the renderer skips the
   * mid-arrow draws entirely at 0. */
  midArrowCount(): number;
  /** setColor wrapper for the mid-arrow columns that keeps the count. */
  setMidArrow(id: 'edge.midSourceArrow' | 'edge.midTargetArrow', slot: number, r: number, g: number, b: number, a: number, otherId: 'edge.midSourceArrow' | 'edge.midTargetArrow'): void;
  /** monotone (round 13 B7): the largest arrow-scale any edge styles —
   * the arrow quads size for it and the FS renders the exact scale */
  private arrowScaleMaxV;
  /** The largest arrow-scale any edge has styled (13 B7): the arrow
   * quads size for it and the FS renders the exact per-edge scale.
   * Monotone — never shrinks, which only costs quad area. */
  arrowScaleMax(): number;
  /** Raise the monotone arrow-scale maximum (the style layer's report;
   * arrow scale is not a store column). */
  noteArrowScale(scale: number): void;
  private arrowWidthMaxV;
  /**
   * The largest hollow-arrow stroke width any edge has styled, model px
   * (round 56).
   *
   * A hollow head strokes its *outline*, so the ink reaches half a stroke
   * width **outside** the polygon — furthest out at the back corners,
   * where two edges meet at an acute angle.  The arrow vertex stage has
   * no spare storage binding for `edge.arrowWidths`, so the quad grows by
   * this frame-level maximum instead, exactly as it already does for
   * `arrowScaleMax`.  Monotone, and it only costs quad area.
   */
  arrowWidthMax(): number;
  /** Raise the monotone hollow-stroke maximum (the style layer's
   * report, after 'match-line' and percent forms are resolved). */
  noteArrowWidth(width: number): void;
  /** monotone (round 13 B5): the largest outline outward extent any
   * node has styled — the ghost cull grows by it (no binding left for
   * the packed geometry there) */
  private outlineSlackMax;
  /** The largest outward outline extent any node has styled (13 B5) —
   * the ghost cull grows its tests by this.  Monotone: never shrinks on
   * a restyle, which costs cull efficiency, never correctness. */
  outlineSlack(): number;
  /**
   * Write a node's border/corner/outline record (rounds 13 B2/B5):
   * cornerRadius model px (-1 = auto), borderPosition id, the outline
   * rgba (opacity pre-folded), outline width/offset (model px,
   * u16 fixed-point), and — round 38 — the border/outline stroke-style
   * enums, packed into bits 8..11 of the position word (see the
   * contract's stroke style constants).  Corner radius and outline
   * extents are geometry (pick + bb read them), so writes bump the
   * geometry epoch.
   */
  setBorderGeom(slot: number, cornerRadius: number, borderPos: number, outlineRgba: number, outlineWidth: number, outlineOffset: number, shapeId?: number, polyRef?: number, borderStyle?: number, outlineStyle?: number): void;
  /** live count of elements carrying a gradient record (13 C2) */
  private gradients;
  /** Elements with a gradient fill (13 C2) — the pass-skip gate. */
  gradientCount(): number;
  /**
   * Write a gradient record (round 13 C2): kind 0 clears; stops are
   * [rgba, pos-fraction] pairs, capped at 5 by the style layer.
   */
  setGradient(id: 'node.gradient' | 'edge.gradient', slot: number, kind: number, dir: number, stops: {
    rgba: number;
    pos: number;
  }[]): void;
  /** Four-component f32 write (dash patterns etc.). */
  setVec4(id: ColumnId, slot: number, a: number, b: number, c: number, d: number): void;
  /** RGBA bytes on [0, 255]. */
  setColor(id: ColumnId, slot: number, r: number, g: number, b: number, a: number): void;
  /**
   * Store an edge's styled curve record (the StyleEngine's write path);
   * the derived edge.curveParams re-derive lazily via the CurveIndex.
   * `extras` carries the 12b family lists/params (null for
   * straight/bezier styles).
   */
  setCurveStyle(slot: number, style: number, stepSize: number, weight: number, loopDirection: number, loopSweep: number, extras?: CurveStyleExtras | null, haystackRadius?: number, endpoints?: EndpointSpec | null): void;
  /** The styled curve record — the stored truth the style getters read. */
  curveStyleAt(slot: number): ReturnType<CurveIndex['styleAt']>;
  /**
   * The derived curve params [p0, p1, p2, kind] for one edge, with any
   * pending derivation flushed first (the accessors' read path).
   */
  curveParamsAt(slot: number): [number, number, number, number];
  /** scratch for `arrowTrimAt` — the geometry readers never allocate */
  private trimScratch;
  /**
   * v3's two per-end shortenings for one edge, resolved from the arrow
   * and width columns (round 56).
   *
   * This is the CPU side of what `edge.width` lane 1 carries to the
   * vertex stages: the same packed word, the same `arrowGap` /
   * `arrowSpacing`, so the drawn line and every accessor agree by
   * construction rather than by two hand-kept copies of v3's table.
   *
   * Haystack is the one exception, and it is v3's: haystack edges draw
   * no heads at all and route through a different path, so they take no
   * shortening.
   *
   * @param slot — the edge slot
   * @returns a shared scratch — consume it before the next call
   */
  arrowTrimAt(slot: number): ArrowTrim;
  /**
   * Evaluate one curved edge's geometry from the live columns (null for
   * straight edges).  The returned object is a shared scratch unless
   * `out` is given — consume it before the next call.  This is the CPU
   * twin of the curve vertex shader: same params, same boundary math,
   * same frame (see curve-geometry.mts).
   */
  curveEvalAt(slot: number, out?: CurveEval): CurveEval | null;
  /**
   * Evaluate a blob-backed curved edge's route from the live columns
   * (null for straight/bezier/loop edges — those use curveEvalAt).
   * The returned object is a shared scratch unless `out` is given.
   * The CPU twin of the 12b route vertex shader: same blob record,
   * same outerHalf frame, same routing (see curve-geometry.mts).
   */
  curveRouteAt(slot: number, out?: CurveRoute): CurveRoute | null;
  /**
   * The same route evaluation at *hypothetical* endpoint centres —
   * `Collection.boundingBoxAt`'s taxi term (round 54).  Everything but
   * the two positions (blob record, outer halves, shapes, trim) reads
   * the live columns; the caller supplies where the nodes would be.
   *
   * @param slot — the edge slot
   * @param sx — hypothetical source centre x
   * @param sy — hypothetical source centre y
   * @param tx — hypothetical target centre x
   * @param ty — hypothetical target centre y
   * @param out — optional route to fill (the shared scratch otherwise)
   * @returns the route, or null for a non-blob-backed edge
   */
  curveRouteAtPositions(slot: number, sx: number, sy: number, tx: number, ty: number, out?: CurveRoute): CurveRoute | null;
  /**
   * The haystack endpoint pair of an edge (12c; null unless the edge's
   * derived kind is CURVE_HAYSTACK): the hash-stable offset points
   * inside each node body, computed from the params column + live
   * positions/outer halves — the CPU twin of the straight edge
   * shader's haystack branch.
   */
  haystackPointsAt(slot: number): {
    sx: number;
    sy: number;
    tx: number;
    ty: number;
  } | null;
  /**
   * Where a **straight** edge meets a node's boundary, along the chord
   * between the two node centres (round 55).
   *
   * This is the CPU twin of the straight arrow shader's tip placement
   * (`tip = tipC - dir * boundaryOffset(...)`), so the accessor built on
   * it reports the point the renderer actually draws to.
   *
   * It exists because v4 previously answered the node *centre* here —
   * `Collection._endpointPoint` fell through to the raw positions for
   * every straight edge — which is off by a whole node radius from v3
   * and from what is on screen.
   *
   * @param slot — the edge's slot
   * @param which — 0 for the source end, 1 for the target end
   * @returns the boundary point in model space
   */
  straightEndpointAt(slot: number, which: 0 | 1, arrows?: boolean): {
    x: number;
    y: number;
  };
  /**
   * Where a straight edge's **drawn line** ends — `gap` behind the node
   * boundary, which is further back than the arrow point
   * `straightEndpointAt` answers (round 56).
   *
   * v3 keeps both (`rs.startX/Y` against `rs.arrowStartX/Y`) and its
   * straight midpoint is the mean of all four, which is the only public
   * caller of this today.
   *
   * @param slot — the edge slot
   * @param which — 0 for the source end, 1 for the target end
   * @returns the drawn line's end in model space
   */
  straightLineEndAt(slot: number, which: 0 | 1): {
    x: number;
    y: number;
  };
  /**
   * The exact bounding box of a curved edge (null for straight ones):
   * the flattened polyline at the drawn subdivision, memoized per slot
   * against the geometry epoch — the "exact lazy CPU eval" tier of the
   * expensive-geometry design (public `.bb()` reads this; fit and cull
   * use the conservative bounds instead).
   */
  curveBBAt(slot: number): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null;
  /**
   * Conservative model-px bound on how far any curved edge strays from
   * the segment between its endpoint node centers — the cull kernels
   * grow their straight-chord tests by this (per-edge params can't bind
   * everywhere within the 8-storage-buffer budgets).  Monotone maxima:
   * never shrinks on removals/restyles, which only costs cull
   * efficiency, never correctness; 0 while nothing is curved.
   */
  curveSlack(): number;
  /**
   * Whether any edge has ever entered the curved draw stream (FLAG_CURVED
   * — every kind but straight, haystack and triangle, which draw in the
   * straight pipeline).  The renderer gates its curved edge and curved
   * arrow pipelines on this, so a graph that never curves an edge never
   * compiles their shaders.
   *
   * Monotone on purpose: it never goes back to false when the last curved
   * edge is removed or restyled straight.  A pipeline that has been needed
   * once is far cheaper to keep than to compile again, and the flag is
   * read once per frame.
   *
   * @returns true once any edge has carried a curved-stream curve-style
   */
  hasCurvedEdges(): boolean;
  /**
   * The conservative model-px bound on how far a haystack endpoint can
   * sit from its node center (12c): radius × the largest outer half.
   * The *straight*-stream cull/pick-tile tests grow by this (haystack
   * rides the straight pipeline), and it stays 0 until some edge
   * styles haystack.  Monotone, like the curve slack.
   */
  haystackSlack(): number;
  /** The CurveIndex's write sink: params column + FLAG_CURVED + dirty.
   * Fixed-kind writes (straight/bezier/loop) release any blob record
   * the slot held from a previous blob-backed style. */
  private setCurveParams;
  /**
   * The CurveIndex's write sink for blob-backed kinds (12b): store the
   * record in the blob, the header [offset, dev, n, kind] in the params
   * column, and the curved/box flags.  `dev` is the conservative chord
   * deviation (max|d|); `box` marks kinds no chord bound covers (taxi,
   * extrapolated weights) for the AABB cull branch.
   */
  private setCurveParamsBlob;
  /**
   * The sidecar label entry for a slot in one stream, or undefined when
   * unlabelled.  The live object the store holds — treat it as
   * read-only and write changes back through setLabel(), which is what
   * marks the glyph run for rebuild.
   *
   * @param group — which of the four label streams; defaults 'nodes'
   * so the node-side call sites read unchanged (round 10)
   */
  labelAt(slot: number, group?: LabelStream): LabelEntry | undefined;
  /**
   * Set the global label font — family, style and weight (round 13
   * D1); one font per glyph atlas.  Every labelled element, in all four
   * streams, re-lays-out against the new font's metrics via the
   * label-dirty channel; the renderer's atlas resets when it observes
   * the change.
   */
  setLabelFont(font: string, style?: string, weight?: string): void;
  /** Queue every labelled slot (both groups) for a glyph-run rebuild. */
  markAllLabelsDirty(): void;
  /** Set or clear (null) an element's label; no-ops when nothing changed. */
  setLabel(slot: number, entry: LabelEntry | null, group?: LabelStream): void;
  /**
   * The font-size tween's per-tick write (round 25.5): patch the
   * sidecar entry's fontSize without an engine round trip (the
   * reanchorLabel pattern).  The edge streams' anchorY is
   * fontSize-derived (-fs/2 + marginY) and re-derives with it; node
   * anchors are size-derived, not font-derived.  One edge font-size
   * drives all three of its streams (mid + end labels).
   */
  setLabelFontSize(slot: number, group: GroupName, fontSize: number): void;
  /** A label's laid (or headless-estimated) block dims, model px. */
  labelDimsAt(slot: number, group?: LabelStream): {
    w: number;
    h: number;
    exact: boolean;
  } | null;
  /**
   * The renderer's exact-dims feedback (16.2): the glyph build lays the
   * block with real atlas advances and reports the true extent.  Never
   * marks label-dirty (no rebuild loop) — only the bb consumers wake.
   */
  setLabelDims(slot: number, group: LabelStream, w: number, h: number): void;
  /**
   * Drain one stream's queue of slots needing a glyph-run rebuild.
   * Destructive (the set is cleared), so exactly one consumer — the
   * renderer's label layer — may call it per stream.
   *
   * @returns the queued slots; an empty array when nothing is pending
   */
  takeLabelDirty(group?: LabelStream): number[];
  /** Live elements in the group (holes excluded) — not highWater(). */
  count(group: GroupName): number;
  /**
   * Visit every live slot in insertion order, skipping tombstones by
   * generation compare.  A reused slot is visited at its *re-insertion*
   * position, not its original one.  The callback must not add or
   * remove elements in the group being walked.
   */
  forEachAlive(group: GroupName, cb: (slot: number) => void): void;
  /**
   * The slot-only twin of `scanRefsInto` (round 34.2/34.4): the same
   * insertion-order walk with the same `(mask, want)` flag test, writing
   * bare slot numbers instead of allocating a `Ref` each.  Callers that
   * work in slot space — the layout contract's `nodeSlots()`/
   * `edgeSlots()` — used to reach them through element handles, which
   * cost a handle intern per element for information the order list
   * already has.
   *
   * Same order as `scanRefsInto`, which is what keeps layouts placing
   * elements where they placed them before.
   *
   * @param out — destination array, written from `at`
   * @param at — first index to write
   * @param group — which group to scan
   * @param mask — flag bits to test
   * @param want — the value those bits must have
   * @returns the index one past the last slot written
   */
  scanSlotsInto(out: number[], at: number, group: GroupName, mask: number, want: number): number;
  /**
   * Scan one group's flags column, writing a ref into `out` (from index
   * `at`) for every live slot (insertion order) whose flags satisfy
   * (flags & mask) === want.  Returns the index one past the last write —
   * the columnar scan behind the whole-graph materializers and structured
   * queries, callable back to back so `out` covers several groups.  The
   * caller preallocates `out` to the live count (the exact match count for
   * a mask-0 scan, an upper bound otherwise) and trims afterwards.
   */
  scanRefsInto(out: Ref[], at: number, group: GroupName, mask: number, want: number, dataTests?: {
    test: (v: unknown) => boolean;
    key: string;
  }[]): number;
  /**
   * Live, visible elements in the model-coordinate box — the
   * box-selection query, answered by one columnar scan.  Corners may be
   * given in any order.
   *
   * **'contain'** (the default, v3's): a node counts when its bounding
   * box (position ± size/2 ± border/2) lies fully inside the box; an edge
   * counts when both of its endpoints do.  Since 12b, curved edges test
   * their *curve* boundary endpoints (exactly v3's on-boundary rule — the
   * revisit deferred from 12a); straight edges keep the endpoint-center
   * approximation (a recorded deviation).  `includeLabels` **narrows**
   * this: the node's label box must be contained too.
   *
   * **'overlap'** (round 39.1): a node counts when its bounding box
   * *intersects* the box; an edge counts when any part of its drawn path
   * does — either endpoint inside, or a flattened segment crossing, by
   * the Liang-Barsky clip the cull pass runs per frame (`segmentHitsBox`
   * is its CPU twin).  `includeLabels` **widens** this instead: a node
   * whose body misses but whose label box overlaps counts.  The
   * asymmetry is v3's and is the only thing either mode can mean —
   * containment is an AND over parts, overlap an OR.
   */
  refsInBox(x1: number, y1: number, x2: number, y2: number, includeLabels?: boolean, mode?: BoxSelectionMode): Ref[];
  /**
   * Does any part of an edge's drawn path lie in the model-space box?
   * The 'overlap' box-selection test (round 39.1), and the exact one:
   * a segment crossing the band counts even when neither endpoint is in
   * it, which is the case containment can never express.
   *
   * Curved edges take the **conservative-then-exact** shape the rest of
   * the curve geometry uses: the memoized exact bb rejects the common
   * miss for the price of a cached box, and only a survivor pays for the
   * flattened walk at the drawn subdivision — the same polyline the
   * renderer strips, so what the band catches is what the band crosses.
   *
   * @param slot — the edge slot
   * @param lx — the box's low x, in model coordinates
   * @param ly — the box's low y
   * @param hx — the box's high x
   * @param hy — the box's high y
   * @returns whether the drawn path meets the box
   */
  edgeHitsBox(slot: number, lx: number, ly: number, hx: number, hy: number): boolean;
  /** Live slots in insertion order (reused slots re-appear at their re-insertion position). */
  slotsOrdered(group: GroupName): number[];
  /**
   * A node label's box in node-local model px (round 16.4): the laid
   * (or headless-estimated) block at its D3 anchor, grown by the
   * text-background padding when a box draws.  Null when unlabelled.
   */
  nodeLabelBox(slot: number): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null;
  /**
   * The conservative edge-label slack (16.4): a radius covering the
   * label block wherever its anchor lands on the drawn path (mid or
   * end streams, rotation included), added to the edge term's growth.
   */
  edgeLabelSlack(slot: number): number;
  /** true when any edge-stream label exists (the scan's cheap gate) */
  hasEdgeLabels(): boolean;
  /** true when any node label exists (the scan's cheap gate) */
  hasNodeLabels(): boolean;
  /**
   * Whole-graph bounding box as a direct columnar scan — no element
   * handles (a no-arg fit() on a 500k-element graph is a fraction of a
   * millisecond instead of hundreds).  Nodes contribute position ±
   * (size/2 + border/2), grown by their outline, overlay/underlay
   * padding, ghost offset and label box where those apply.  Edges
   * contribute their own extent as a first-class term: the two endpoint
   * node centers, grown by the conservative curve deviation for curved
   * edges — the hull bound for chord-bounded kinds, plus the node-half
   * margin (+ chord length for extrapolated weights) for box-bounded
   * ones (rounds 12a/12b; the exact lazy curve bb is
   * Collection.boundingBox's tier).  Future edge geometry (arrow
   * heads, 12c endpoints) extends the edge term here and there
   * together.  Only the space tier counts (round 22): display-hidden
   * elements are excluded, `visibility: 'hidden'` ones still take
   * space.  Conservative by design — fit may over-fit, never under.
   *
   * @param includeLabels — whether label boxes join the box (v3's
   * default, on)
   * @returns null when nothing visible remains
   */
  boundingBox(includeLabels?: boolean): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    w: number;
    h: number;
  } | null;
  /** Sidecar data() values from a def's data object (id/source/target/parent stay first-class). */
  setDefData(group: GroupName, slot: number, data: Record<string, unknown> | undefined): void;
  private ingestDataColumns;
  /** Register bulk-allocated slots: ids (auto-generated on holes) + insertion order. */
  private registerBulk;
  /** Default flags for the whole bulk, then per-element deviations. */
  private writeBulkFlags;
  /** One coalesced dirty span covering all of `slots`. */
  private markBulk;
  private allocSlot;
  private freeSlot;
  /**
   * Rebuild the CSR adjacency when the waste meters cross the threshold:
   * stranded CSR entries (removals) plus overlay entries (post-build
   * adds) exceeding half the live entry count.  A rebuild walks the live
   * edges in insertion order — so it also folds a purely incremental
   * graph's overlay into the compact CSR shape — and O(edges) at a
   * proportional-growth threshold amortizes to O(1) per mutation.  The
   * floor keeps tiny graphs from rebuilding on every mutation.
   */
  private maybeRebuildAdjacency;
  /**
   * Slot-moving compaction (round 19.1, store core): move live elements
   * down to a dense slot prefix per group with a **monotone** remap —
   * relative slot order is preserved, so draw order, curve bundle ranks
   * and CSR incident order are all unchanged by construction (the
   * round-19 stable-draw-order call).  Shrinks `highWater` to the live
   * count (and column capacity with it), rewrites `edge.endpoints` when
   * nodes move, fuses the id index and the insertion-order list, rebuilds
   * CSR, and marks the compacted groups `resized` so the renderer's
   * existing realloc + full re-upload path takes over.  Returns each
   * group's remap (null where nothing needed doing) for the callers that
   * hold slots — 19.2 wires the dependent store indexes, 19.3 the ref
   * forwarding, 19.4 the renderer, 19.5 the triggers; until then nothing
   * calls this in production.
   */
  compact(): {
    nodes: GroupCompaction | null;
    edges: GroupCompaction | null;
  };
  /** Permute one label stream's entries, dims and dirty slots (19.2). */
  private remapLabelStream;
  private compactGroup;
  private compactOrder;
}
//#endregion
//#region src/style-scales.d.mts
type RGBA$1 = [number, number, number, number];
type Transform = {
  kind: 'identity';
} | {
  kind: 'log';
  base: number;
} | {
  kind: 'pow';
  exponent: number;
} | {
  kind: 'symlog';
  constant: number;
};
type OutputStops = {
  kind: 'number';
  values: Float64Array;
} | {
  kind: 'color';
  space: 'oklab' | 'srgb';
  /** n×3 channel triples in `space` (OKLab floats, or sRGB bytes) */
  triples: Float64Array;
  /** n alpha bytes, interpolated separately (straight, not premultiplied) */
  alpha: Float64Array;
};
/** A compiled condition over one data key (data-only; CPU-evaluated). */
type CompiledCondition = {
  key: string;
  op: 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte' | 'in';
  /** booleans back the reserved '::parent'/'::child' (round 14.7) and
   * '::selected' (round 57.1) keys */
  value: string | number | boolean | (string | number)[];
};
type Program = {
  kind: 'passthrough';
} | {
  kind: 'const';
  value: number | RGBA$1;
} | {
  kind: 'case';
  /** ordered clauses; conds AND-ed within a clause, first matching wins */
  clauses: {
    conds: CompiledCondition[];
    value: number | RGBA$1;
  }[];
  elseValue: number | RGBA$1;
} | {
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
  applied: [number, number] | null;
} | {
  kind: 'discrete';
  /** ascending cut points, length = outputs.length − 1 */
  cuts: Float64Array;
  outputs: (number | RGBA$1)[];
  /** quantize-with-auto-domain only (cuts recompute from the extent) */
  autoDomain: boolean;
  applied: [number, number] | null;
} | {
  kind: 'ordinal';
  map: Map<string | number, number | RGBA$1>;
};
/** What the target style channel stores (label mappers never reach here). */
type ChannelKind = 'number' | 'color' | 'enum';
interface CompiledMapper {
  /** primary data key (a single-key scale mapper; '' for conditionals) — the GPU-pack path */
  key: string;
  /** every data key this mapper reads — the refresh-dependency set */
  keys: string[];
  kind: ChannelKind;
  prop: string;
  program: Program;
  /** parsed spec fallback; null = use the channel default */
  fallback: number | RGBA$1 | null;
  parseEnum: ((value: unknown) => number | null) | null;
  /** the original spec object, never mutated (json() fidelity) */
  spec: MapperSpec;
}
/** Output of a bound evaluator: the channel value for one slot. */
type Evaluated = number | RGBA$1;
//#endregion
//#region src/matcher.d.mts
/** One data comparison; exactly one op per condition object. */
interface DataCondition {
  eq?: unknown;
  ne?: unknown;
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
  in?: (string | number)[];
}
/**
 * A structured element query; every present key must hold.
 *
 * The state keys are the ones a `case` mapper's `when` takes, from the
 * same table (`STATE_CONDITIONS` in style-scales.mts) — so anything you
 * can style on, you can query for.  Each is a boolean, which is how v3's
 * paired selectors collapse: `{ selected: false }` is `:unselected`,
 * `{ grabbed: false }` is `:free`, `{ parent: false }` is `:childless`.
 */
interface Query {
  /** restrict to one group */
  group?: GroupName;
  /** require the element (not) to be selected */
  selected?: boolean;
  /** whether the element may be selected by the user */
  selectable?: boolean;
  /** whether the element is locked in place */
  locked?: boolean;
  /** whether the user is dragging the element */
  grabbed?: boolean;
  /** whether the element may be dragged */
  grabbable?: boolean;
  /** whether the element is under an active press */
  active?: boolean;
  /** whether the pointer is over the element */
  hovered?: boolean;
  /** structural (round 14.7, nodes only): has at least one child */
  parent?: boolean;
  /** structural (nodes only): has no children — v3's `:childless`, and
   * exactly `{ parent: false }` */
  childless?: boolean;
  /** structural (round 14.7, nodes only): has a parent */
  child?: boolean;
  /** structural (nodes only): has no parent — v3's `:orphan`, and
   * exactly `{ child: false }` */
  orphan?: boolean;
  /** data-sidecar conditions per key; a bare value means equality */
  data?: Record<string, DataCondition | string | number | boolean | null>;
}
//#endregion
//#region src/easing.d.mts
type Easing = (t: number) => number;
interface EasingProgram {
  /** one of EASING_KIND */
  kind: number;
  /** control points (x1, y1, x2, y2) when kind is bezier */
  bezier: readonly [number, number, number, number] | null;
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
//#endregion
//#region src/style.d.mts
/** One styled end of source/target-endpoint (12c): the parsed form of
 * v3's edgeEndpoint type.  Angles store the *effective* radians (the
 * 12-o'clock start already applied); point pct components store the
 * fraction (v3's pfValue). */
interface EndpointEnd {
  mode: number;
  a: number;
  b: number;
  pct: number;
}
type RGBA = [number, number, number, number];
/** Resolved channel values for one element, before writing to columns. */
interface NodeComputed {
  /** text-rotation in radians (27.7); NaN is not valid on nodes. */
  textRotation: number;
  fillColor: RGBA;
  borderColor: RGBA;
  width: number;
  height: number;
  shape: number;
  opacity: number;
  borderWidth: number;
  /** events (round 20.2): false = pointer-transparent (FLAG_NO_EVENTS) */
  eventsEnabled: boolean;
  /** text-events (round 20.3): true = the label box picks the node (FLAG_TEXT_EVENTS) */
  textEvents: boolean;
  /** visibility (round 22): true = paint-only invisible (FLAG_SELF_INVISIBLE) */
  invisible: boolean;
  /** chart (round 23): CHART_NONE | CHART_PIE | CHART_STRIPES */
  chartKind: number;
  /** constant value list (null when unset or the data passthrough is used) */
  chartValues: number[] | null;
  /** the `{ data: key }` passthrough key (per-element arrays) */
  chartValuesKey: string | null;
  /** resolved palette (null = the default category10 scheme) */
  chartColors: RGBA[] | null;
  chartSize: number;
  chartHole: number;
  chartStartAngle: number;
  /** stripes: 0 = vertical (bands advance top->bottom), 1 = horizontal */
  chartDirection: number;
  chartOpacity: number;
  /** literal label text ('' for none) when labelKey is null */
  label: string;
  /** `data(key)` mapper key ('id' reads the first-class id) */
  labelKey: string | null;
  fontSize: number;
  textColor: RGBA;
  /** effectively global: one font per glyph atlas (keyed by character) */
  fontFamily: string;
  /** font-style + font-weight (round 13 D1): global constants like
   * font-family — the atlas rasters one face */
  fontStyle: string;
  fontWeight: string;
  textOutlineWidth: number;
  textOutlineColor: RGBA;
  textOutlineOpacity: number;
  textBgColor: RGBA;
  textBgOpacity: number;
  textBgPadding: number;
  textMarginX: number;
  textMarginY: number;
  /** min-zoomed-font-size (round 13 D2): hide the label when
   * font-size x zoom x dpr drops below this (device px; 0 = off) */
  minZoomedFontSize: number;
  /** text-halign (round 13 D3): 0 left, 1 center, 2 right */
  textHalign: number;
  /** text-valign (D3): 0 top, 1 center, 2 bottom.  v4's default is
   * 'bottom' (the round-10 below-node placement) — v3 defaults to
   * 'top'; a recorded deviation */
  textValign: number;
  /** corner-radius (round 13 B2): model px, -1 = 'auto' (v3's
   * min(w/4, h/4, 8)) — round-rectangle only */
  cornerRadius: number;
  /** border-position (B2): 0 center (v3's default), 1 inside, 2 outside */
  borderPosition: number;
  /** border-style (round 38): 0 solid, 1 dashed, 2 dotted, 3 double */
  borderStyle: number;
  /** border-dash-pattern (round 38), normalized to two on/off pairs
   * like the edge twin (v3's default [4, 2] stores as [4, 2, 4, 2]) */
  borderDashPattern: number[];
  /** border-dash-offset (round 38), model px */
  borderDashOffset: number;
  /** outline-style (round 38): same ids; `double` draws solid (v3's
   * drawOutline has no double branch — a quirk kept for parity) */
  outlineStyle: number;
  /** node outline (round 13 B5): a solid ring outside the border */
  outlineColor: RGBA;
  outlineOpacity: number;
  outlineWidth: number;
  outlineOffset: number;
  /** shape-polygon-points (C3): flat unit [x, y, ...] pairs for the
   * 'polygon' shape (v3's normalized [-1, 1] space) */
  shapePolygonPoints: number[];
  /** background-fill (C2): 0 solid, 1 linear-gradient, 2 radial-gradient */
  backgroundFill: number;
  /** background gradient stops (C2; constants-only, capped at 5) */
  backgroundGradientStopColors: RGBA[];
  backgroundGradientStopPositions: number[] | null;
  backgroundGradientDirection: number;
  /** background-opacity (round 13 B1): folds into the stored fill alpha */
  backgroundOpacity: number;
  /** border-opacity (B1): folds into the stored border alpha */
  borderOpacity: number;
  /** text-opacity (B1): v3's parentOpacity for the label block — folds
   * into the stored text/outline/background alphas */
  textOpacity: number;
  /** text-transform (B6): 0 none, 1 uppercase, 2 lowercase */
  textTransform: number;
  /** text-wrap (16.2): 0 none, 1 wrap, 2 ellipsis */
  textWrap: number;
  /** text-max-width, model px */
  textMaxWidth: number;
  /** line-height multiplier */
  lineHeight: number;
  /** text-overflow-wrap: 0 whitespace, 1 anywhere */
  textOverflowWrap: number;
  /** text-justification: -1 auto (resolves against halign at write) */
  textJustification: number;
  /** text-background-shape (B6): 0 rectangle, 1 round-rectangle */
  textBgShape: number;
  /** text-border (B6): a band inward from the padded background box */
  textBorderWidth: number;
  textBorderColor: RGBA;
  textBorderOpacity: number;
  ghost: boolean;
  ghostOffsetX: number;
  ghostOffsetY: number;
  ghostOpacity: number;
  overlayColor: RGBA;
  overlayOpacity: number;
  overlayPadding: number;
  /** 0 round-rectangle, 1 ellipse */
  overlayShape: number;
  /** model px; -1 = 'auto' (v3's min(w/4, h/4, 8)) */
  overlayRadius: number;
  underlayColor: RGBA;
  underlayOpacity: number;
  underlayPadding: number;
  underlayShape: number;
  underlayRadius: number;
  backgroundImage: string[];
  backgroundFit: number[];
  backgroundImageOpacity: number[];
  backgroundPositionX: BgLen[];
  backgroundPositionY: BgLen[];
  backgroundOffsetX: BgLen[];
  backgroundOffsetY: BgLen[];
  backgroundWidth: BgSize[];
  backgroundHeight: BgSize[];
  backgroundRepeat: number[];
  backgroundClip: number[];
  backgroundImageContainment: number[];
  backgroundImageSmoothing: boolean[];
  /** one per node (the registry dedup key includes it) */
  backgroundImageCrossorigin: string;
  /** background-image-type per image: 0 auto (rgba), 1 sdf-icon */
  backgroundImageType: number[];
  /** the sdf-icon tint (render-time color, mapper-capable) */
  backgroundImageColor: RGBA;
}
interface EdgeComputed {
  lineColor: RGBA;
  /** events (round 20.2): false = pointer-transparent (FLAG_NO_EVENTS) */
  eventsEnabled: boolean;
  /** visibility (round 22): true = paint-only invisible (FLAG_SELF_INVISIBLE) */
  invisible: boolean;
  /** line-fill (C2): 0 solid, 1 linear-gradient, 2 radial-gradient */
  lineFill: number;
  lineGradientStopColors: RGBA[];
  lineGradientStopPositions: number[] | null;
  /** line-opacity (round 13 B1): folds into the stored line alpha and
   * the arrow fold (v3's effective opacities) */
  lineOpacity: number;
  /** line-outline casing (round 13 B4): width sticks out width/2 per
   * side (v3's lineWidth = edgeWidth + line-outline-width) */
  lineOutlineWidth: number;
  lineOutlineColor: RGBA;
  /** line-cap (round 13 B3): 0 butt, 1 round, 2 square */
  lineCap: number;
  /** line-dash-pattern (B3), normalized to two on/off pairs */
  lineDashPattern: number[];
  /** line-dash-offset (B3), model px */
  lineDashOffset: number;
  width: number;
  opacity: number;
  /** 0 solid, 1 dashed, 2 dotted (contract LINE_* ids) */
  lineStyle: number;
  sourceArrowShape: ArrowShape;
  sourceArrowColor: RGBA;
  targetArrowShape: ArrowShape;
  targetArrowColor: RGBA;
  /** arrow-scale (B7): scales every arrowhead on the edge */
  arrowScale: number;
  /** mid arrows (C1): anchored at the curve/route midpoint */
  midSourceArrowShape: ArrowShape;
  midSourceArrowColor: RGBA;
  midTargetArrowShape: ArrowShape;
  midTargetArrowColor: RGBA;
  /** arrow-fill per end (B7): 0 filled, 1 hollow */
  sourceArrowFill: number;
  targetArrowFill: number;
  /** hollow stroke widths per end, model px ('match-line' and % resolve
   * at write against the edge width) */
  sourceArrowWidth: number | 'match-line' | {
    percent: number;
  };
  targetArrowWidth: number | 'match-line' | {
    percent: number;
  };
  label: string;
  labelKey: string | null;
  fontSize: number;
  textColor: RGBA;
  textOutlineWidth: number;
  textOutlineColor: RGBA;
  textOutlineOpacity: number;
  textBgColor: RGBA;
  textBgOpacity: number;
  textBgPadding: number;
  textMarginX: number;
  textMarginY: number;
  /**
   * text-rotation in radians, with NaN meaning `autorotate` (27.7).
   * Numeric rotations apply to any label; autorotate is edge-only,
   * since it resolves from the edge's own slope.
   */
  textRotation: number;
  sourceLabel: string;
  sourceLabelKey: string | null;
  sourceTextOffset: number;
  sourceTextMarginX: number;
  sourceTextMarginY: number;
  sourceTextRotation: number;
  targetLabel: string;
  targetLabelKey: string | null;
  targetTextOffset: number;
  targetTextMarginX: number;
  targetTextMarginY: number;
  targetTextRotation: number;
  curveStyle: number;
  controlPointStepSize: number;
  controlPointWeight: number;
  loopDirection: number;
  loopSweep: number;
  controlPointDistances: number[] | null;
  controlPointWeights: number[];
  segmentDistances: number[];
  segmentWeights: number[];
  segmentRadii: number[];
  /** radius-type per point: 1 = arc-radius, 0 = influence-radius */
  radiusTypes: number[];
  /** EDGE_DIST_* id */
  edgeDistances: number;
  taxiDirection: number;
  haystackRadius: number;
  sourceEndpoint: EndpointEnd;
  targetEndpoint: EndpointEnd;
  sourceDistanceFromNode: number;
  targetDistanceFromNode: number;
  /** percent turns store the fraction (v3 pfValue); px turns the px */
  taxiTurn: number;
  taxiTurnPercent: boolean;
  taxiTurnMinDistance: number;
  taxiRadius: number;
}
type Computed = NodeComputed & EdgeComputed;
type ArrowShape = 'none' | 'triangle' | 'vee' | 'chevron' | 'circle' | 'square' | 'diamond' | 'tee' | 'triangle-tee' | 'circle-triangle' | 'triangle-cross' | 'triangle-backcurve';
/** Core (viewport-level) theming (round 13 A2): v3's core-selector
 * props, resolved once per sheet — constants only (there is no element
 * to map over). */
interface CoreStyle {
  selectionBoxColor: RGBA;
  selectionBoxOpacity: number;
  selectionBoxBorderColor: RGBA;
  selectionBoxBorderWidth: number;
  activeBgColor: RGBA;
  activeBgOpacity: number;
  activeBgSize: number;
}
/**
 * One id's bypass, resolved for one group: the `Computed` fields its
 * props assign, captured once at parse time (round 63.2) so the write
 * funnel's merge is field copies with no per-write parsing.
 */
type BypassPatch = readonly (readonly [string, unknown])[];
declare class StyleEngine {
  private store;
  /**
   * The narrow view of this engine that the module-scope property
   * readers receive (35.2).  Built once here rather than per read, and
   * its getters stay live across a sheet swap that replaces `defs`.
   */
  private readonly readCtx;
  /** per-raw-name read plans (round 62.4): normalization, group
   * membership, the transition/arrow classifications and the reader,
   * resolved once per spelling — all from module tables no sheet swap
   * changes, so the cache is immortal per engine */
  private readonly readPlans;
  private sheet;
  private defs;
  /** the parents-group compound style, applied per parent slot */
  private parentCompound;
  /** normalized channel props the parents overlay resolves differently
   * from the nodes group (defaults + the user parents block) — a
   * GPU-mapped nodes channel in this set demotes to the CPU path */
  private parentsOverride;
  private arrows;
  private midArrows;
  /**
   * Bumps when the paint-mapper state changes (sheet set, or a GPU-owned
   * live auto-domain extent moved) — the renderer's mapper runtime pulls
   * on this to repack its program buffers.
   */
  paintVersion: number;
  /** props per group the GPU eval kernel currently owns (set by the runtime). */
  private gpuOwnedProps;
  /** a mapped key's column promoted to mixed while kernel-owned: re-derive on CPU */
  private demoted;
  /** Round 24.1: styled-generation marks (gen + 1; 0 = never styled).  A
   * slot joins transition diffs only when its *current* element has been
   * styled before — the first application on add is instant (v3's rule),
   * and a recycled slot's fresh generation fails the check on its own. */
  private styledGen;
  /** Round 24.1: the open transition capture (one per group-def pass). */
  private txn;
  /** id → normalized prop → raw value: the live bypass declarations
   * (the `bypasses` sheet section plus the sugar methods' writes),
   * exported by `json()`.  Id-keyed declarations, not element state —
   * an entry survives remove/re-add and may name an id that does not
   * exist yet (inert until it does). */
  private bypassRaw;
  /** id → per-group parsed patches.  Both groups parse at declaration
   * time (the id may not resolve yet); null marks a group whose guards
   * reject the entry's props (e.g. a curve prop never applies to a
   * node), decided when the id resolves. */
  private bypassParsed;
  /** slot → patch per group, resolved lazily against the store's
   * structure epoch — adds, removes and compaction all bump it, and a
   * re-resolution is O(declared ids), never O(elements). */
  private bypassSlots;
  private bypassEpoch;
  /** normalized prop → live declaration count across ids — what
   * `paintInputs` demotes by (a kernel-owned mapper would overwrite a
   * bypassed slot's stored bytes on its next dispatch). */
  private bypassPropCounts;
  /** Whether any bypass is declared — the zero-cost gate every touched
   * path checks first (the round-63 performance contract).
   *
   * @returns true when at least one id has a live bypass declaration
   */
  hasBypasses(): boolean;
  /** Validate a sheet's `bypasses` section into installable entries —
   * called before any engine state mutates, so a bad section throws
   * from `setSheet` with nothing half-applied. */
  private validateBypasses;
  /** Parse one entry's props for both groups; a group whose guards
   * reject them parses null, and both rejecting is the caller's error. */
  private parseBypassGroups;
  /** Install validated bypass entries (whole-replace — `setSheet`'s
   * swap semantics: the section is replaced like any other). */
  private installBypasses;
  /** Re-resolve declared ids to live slots when the structure epoch
   * moved — O(declared ids) per structural change, amortized over the
   * writes between changes, and nothing at all when no bypass exists. */
  private rebuildBypassSlots;
  /** The bypass patch for a slot, or null.  O(1) after the lazy
   * epoch-checked re-resolution. */
  private bypassPatchAt;
  /**
   * Clone-and-patch: the write funnel's bypass merge (round 63.3).  A
   * method rather than an inline spread so specs can count invocations
   * — a bypass-free instance must never reach it, which is the
   * performance contract's zero-cost gate made testable.
   *
   * @param computed — the slot's sheet-resolved record (never mutated)
   * @param patch — the captured field pairs for the slot's bypass
   * @returns a fresh record with the bypassed fields replaced
   */
  mergeBypass(computed: Computed, patch: BypassPatch): Computed;
  /**
   * Set bypass props for one live element — the sugar path behind
   * `ele.style( name, value )` (round 63.4).  Unlike the sheet
   * section, whose entries parse against both groups because their ids
   * may not have resolved yet, this validates against the element's
   * own group, so a wrong-group prop throws with the group's own
   * message.  The slot re-applies through the normal single-slot apply
   * afterwards, which is what makes transitions and the write-funnel
   * merge ride the same path every restyle does.
   *
   * @param ref — the live element's ref (the caller validates liveness)
   * @param id — its id, the declaration key
   * @param props — prop → constant, dash-case or camelCase
   * @throws on a mapper value, a global font prop, a transition config
   *   prop, a wrong-group prop, or an invalid value
   */
  setBypass(ref: Ref, id: string, props: Record<string, unknown>): void;
  /**
   * Remove bypass props for one live element — the path behind
   * `ele.removeStyle( name? )` (round 63.4).  Removing re-applies the
   * slot, so the sheet-resolved values return through the normal
   * funnel (transitions included).
   *
   * @param ref — the live element's ref
   * @param id — its id, the declaration key
   * @param name — the prop to remove, either spelling; omit to clear
   *   the element's whole declaration
   */
  removeBypass(ref: Ref, id: string, name?: string): void;
  /** Patch one slot's entry in the resolved maps after a sugar write —
   * only when the maps are current (stale maps re-resolve wholesale at
   * the next write anyway). */
  private refreshBypassSlot;
  /** Round 24.1: receives the diffed transition tweens — wired by the
   * core to AnimationManager.start (the round-21 eviction gives uniform
   * latest-wins); null in engine-only contexts disables capture. */
  transitionSink: ((refs: Ref[], writes: ChannelWrite[], opts: {
    duration: number;
    delay: number;
    easing: string;
  }) => void) | null;
  /** value reader for mapper/condition keys ('id' is first-class, not in
   * the sidecar; the reserved '::' keys answer a case condition from the
   * flags column — the structural pair since round 14.7, the state
   * family since 57.1) */
  private readValue;
  /**
   * @param store — the columnar store whose channel columns this engine
   *   resolves style into
   */
  constructor(store: GraphStore);
  private coreStyle;
  /**
   * The resolved core theming props (round 13 A2).
   *
   * @returns the live record — `setSheet` replaces it wholesale, so a
   *   held reference reads the *previous* sheet's theming after a swap
   */
  core(): CoreStyle;
  /**
   * Replace the stylesheet and re-apply it to every live element,
   * mapped channels included.
   *
   * The sheet is a plain `{ nodes, edges, parents, core }` object of
   * prop objects — no selector blocks, no style functions.  The
   * `parents` group overlays the `nodes` block under v3's `:parent`
   * defaults.
   *
   * @param sheet — the stylesheet to install
   * @param apply — when false, compile and validate without applying;
   *   the core uses this to defer the apply to the outermost
   *   `endBatch()` while still throwing on a bad sheet at the call site
   * @throws on an unknown sheet key, an unknown property, or an invalid
   *   value
   */
  setSheet(sheet: Stylesheet, apply?: boolean): void;
  /**
   * Paint-channel mappers with resolved fallbacks (the runtime's pack
   * input).  A mapped arrow *shape* demotes all edge paint to the CPU:
   * the shape gates the stored arrow alpha, and splitting that fold
   * between CPU and kernel would race.
   *
   * @param group — the element group to collect for
   * @returns each eligible mapper with the fallback its channel resolves to
   */
  paintInputs(group: GroupName): {
    m: CompiledMapper;
    fallback: Evaluated;
  }[];
  /**
   * Edge-sheet constants for the kernel's arrow-alpha folding.
   *
   * @param group — the element group to read the sheet for
   * @returns the constants the kernel needs to fold arrow alpha itself
   */
  paintContext(group: GroupName): {
    opacityMapped: boolean;
    constOpacity: number;
    source: {
      enabled: boolean;
      colorMapped: boolean;
      constColor: RGBA;
    };
    target: {
      enabled: boolean;
      colorMapped: boolean;
      constColor: RGBA;
    };
  } | null;
  /**
   * The runtime reports which props its kernel evaluates: the data-write
   * refresh skips their CPU evaluation (the whole point of GPU eval) and
   * the read-back getters evaluate the shared IR lazily instead of
   * trusting the stale stored bytes.
   *
   * @param group — the element group the kernel runs over
   * @param props — the props it evaluates; replaces the previous set
   */
  setGpuOwned(group: GroupName, props: Iterable<string>): void;
  /**
   * Whether a data write can change the group's computed style — the gate
   * that keeps an unrelated write from costing a restyle.
   *
   * @param group — the element group being written
   * @param keys — the data() keys the write touches
   * @returns true when any mapped channel or label depends on one of them
   */
  stylesDependOnData(group: GroupName, keys: string[]): boolean;
  /**
   * Whether the current sheet styles a flag state — i.e. whether
   * flipping that bit has to restyle at all.  Every flag-write choke
   * point asks this before doing any work, so a sheet that says nothing
   * about a state pays one Set lookup when it changes.
   *
   * v4's default stylesheet says yes for two of them.  Selection: nodes'
   * `background-color`, edges' `line-color` and the four arrow colours
   * are `{ selected: true }` case mappers.  Press: the `overlay-*` props
   * are `{ active: true }` ones.  A sheet that declares those props
   * replaces the rule and the state becomes free again — which is the
   * same trade round 4 made when v4 still had `:selected` blocks,
   * arriving from the other direction.
   *
   * @param group — the element group whose flag is changing
   * @param key — the reserved condition key, e.g. `'::selected'`
   * @returns true when the change must re-evaluate mappers
   */
  dependsOnState(group: GroupName, key: string): boolean;
  /**
   * Whether the eval kernel currently owns this prop's stored bytes —
   * the gate a direct column read carries so it never reports a value
   * a kernel has made stale (round 62.6; the same rule readProp keeps).
   *
   * @param group — the element group
   * @param prop — the normalized property name
   * @returns true when the prop is kernel-owned
   */
  ownsProp(group: GroupName, prop: string): boolean;
  /** Which arrow ends the current stylesheet can enable. */
  get arrowEnds(): {
    source: boolean;
    target: boolean;
  };
  /**
   * Which mid-edge arrow ends the current sheet can enable.  The
   * renderer skips the mid-arrow draw entirely when neither is
   * possible.
   */
  get midArrowEnds(): {
    source: boolean;
    target: boolean;
  };
  /**
   * The installed stylesheet, as given.  Part of `cy.json()`'s export.
   *
   * @returns the sheet object (live, not a copy — treat as read-only)
   */
  json(): Stylesheet;
  /** Re-apply the current sheet (e.g. to re-snapshot live auto-domain extents). */
  update(): void;
  /**
   * Apply the sheet across every live element of both groups.  This is
   * the whole-graph pass a sheet change or a batch flush runs.
   */
  applyAll(): void;
  /**
   * Bulk apply over *live* slots of one group.  The group resolves once
   * (the per-element cost is only the column writes); mapped channels
   * evaluate per element in applyMapped.
   *
   * @param group — the element group to style
   * @param slots — the live slots to write; must all be of that group
   */
  applyBulk(group: GroupName, slots: ArrayLike<number>): void;
  /**
   * The parents' compound-style write with the padding transition
   * capture (round 25.4): diff the declared padding around the sheet
   * write, snap on a px↔% unit flip (tweening across units has no
   * meaning — recorded), and restore the held pre-restyle value
   * (CSS's delay rule, like the channel diffs).
   */
  private applyCompoundStyle;
  private applyGroupDef;
  /**
   * Open a transition capture for one group-def apply pass: every
   * already-styled slot the pass writes gets its tweenable channels
   * diffed on stored truth.  Null (capture off) when nothing can
   * transition — unconfigured specs cost nothing.
   */
  private openTxn;
  /** Close a capture: pack the accumulated diffs into bulk ChannelWrites
   * (one per column — never per-element animations) and hand them to the
   * sink as one transition animation. */
  private closeTxn;
  private readTxnValue;
  /** Pre-write snapshot of one slot's capture channels (mains + rides). */
  private txnPre;
  /**
   * Post-write diff of one slot: record each moved channel (from = the
   * snapshot, to = the newly stored value) and *restore* the old value —
   * the store holds the pre-restyle state until the tween's first
   * post-delay tick, so sync reads during a transition-delay report the
   * old value (CSS's rule) and no frame can flash the target.
   */
  private txnPost;
  private wasStyled;
  private markStyled;
  /** Slot compaction: live elements moved (and took fresh generations) —
   * refresh the styled marks over the live slots, all of which have been
   * styled (style applies on add, and compaction never runs mid-batch). */
  onCompacted(): void;
  /** The group def resolving one element: the parents overlay for parent
   * nodes (round 14.6), else the element's own group. */
  private defFor;
  /** All live slots the given def styles (partitioned under compounds). */
  private allSlotsFor;
  /**
   * Scratch-evaluate every mapped channel and write whole elements — the
   * per-channel write would break the cross-channel couplings that live
   * in write() (circle collapse, arrow-alpha folding, the label anchor).
   * Live auto-domain extents re-check here; a changed extent escalates
   * the pass to the whole group (every slot's mapping moved).
   */
  private applyMapped;
  /**
   * Apply a group whose mappers read only state flags: one record per
   * distinct flag combination, cached on the def, instead of a program
   * run per element.
   *
   * The cache is unbounded in principle and tiny in practice — its size
   * is 2^(number of distinct bits the sheet's conditions read), and a
   * sheet reads one or two.  It lives on the def, so a sheet swap
   * discards it with the def that built it.
   */
  private applyPartitioned;
  /** The partition record for one masked flag word — cached on the def,
   * resolved on the first miss (round 57.1). */
  private partRecordFor;
  /** Resolve one flag combination into a computed record (cache miss). */
  private partitionRecord;
  /**
   * Re-check live auto-domain extents against the data; returns true when
   * any moved (the caller escalates to the whole group).  A moved extent
   * on a GPU-owned program also bumps paintVersion so the runtime repacks
   * its program uniform and re-evaluates in full.
   */
  private checkAutoExtents;
  /**
   * Resolve and write one element's channels.
   *
   * @param ref — the element to style; a stale ref is a no-op
   */
  apply(ref: Ref): void;
  /**
   * The data-write refresh: re-derive the mapped channels of the written
   * slots, gated per group on the written keys.  A label-only dependency
   * pays just the label text recompute (setLabel no-ops when the entry is
   * unchanged); mapped channels re-evaluate through the whole-element
   * scratch pass, which also escalates to the full group when a live
   * auto-domain extent moved.
   *
   * @param group — the element group that was written
   * @param slots — the written slots
   * @param keys — the data() keys written, which gate what re-evaluates
   */
  refreshMapped(group: GroupName, slots: ArrayLike<number>, keys: string[]): void;
  /**
   * The state-flip refresh (round 61) — `core.onStateChange`'s entry,
   * replacing the `refreshMapped` route that made every select restyle
   * whole elements (the 60.4 regression).  A flipped bit is the one
   * event whose styling consequence is knowable up front: for a
   * partitioned def the old masked word is the new word with `key`'s bit
   * flipped back, both records are cached, and the channels that differ
   * between them — one on a default-sheet node, five on a default-sheet
   * edge — are written narrowly instead of through the ~25-call full
   * `write()`.
   *
   * The general path is kept wherever it is the correct one: an
   * unpartitioned def (a data mapper puts the group per-element anyway),
   * a live transition spec (the txn capture is the general path's), a
   * demoted group, and the structural pseudo-keys (a parent flip changes
   * *which def* resolves the slot — the reparent hooks own that).  A
   * diff containing any channel without a narrow writer falls back to
   * the full `write()` of the target record per slot, byte-for-byte the
   * old behaviour.
   *
   * @param group — the element group whose flag flipped
   * @param key — the reserved condition key ('::selected', '::active', …)
   * @param slots — the slots whose bit actually changed
   */
  refreshState(group: GroupName, key: string, slots: ArrayLike<number>): void;
  /** One def's share of a state flip: the fast diff path, or the
   * general `refreshGroupDef` wherever that one is correct (see
   * `refreshState`). */
  private refreshStateDef;
  /**
   * The writers for the channels that differ between two partition
   * records — cached per unordered pair of masked flag words (the
   * changed set is symmetric; which record to write is the caller's).
   * Null when some differing channel has no narrow writer: that pair
   * takes the full `write()`.
   */
  private partitionDiffWriters;
  private refreshGroupDef;
  private refreshGroupDefInner;
  /**
   * One resolved prop for a live element.
   *
   * @param ref — the element to read
   * @param propRaw — a style property name
   * @returns the stored value, or undefined when the prop belongs to the
   *   other element group
   * @throws if the name is not a v4 style property at all — a typo must
   *   fail loudly rather than read as undefined
   */
  readProp(ref: Ref, propRaw: string): string | number | undefined;
  /**
   * All resolved props of a live element's group.
   *
   * @param ref — the element to read
   * @returns every readable prop of its group, by name
   */
  readProps(ref: Ref): Record<string, string | number>;
  /**
   * The constant line-opacity (B1) — the arrow-fold factor animation
   * needs (a mapped line-opacity never coexists with kernel-owned
   * arrows, so the constant is the truth).
   *
   * @returns the edges group's resolved `line-opacity`, the factor an
   *   arrow's stored alpha was folded with
   */
  lineOpacityConst(): number;
  /** The sheet's arrow-width modes (constants-only props) — an
   * edge-width tween needs these to carry the style-write-resolved
   * `edge.arrowWidths` along (round 25.2): 'match-line' and percent
   * forms baked the width, plain numbers did not. */
  arrowWidthModes(): {
    source: number | 'match-line' | {
      percent: number;
    };
    target: number | 'match-line' | {
      percent: number;
    };
  };
  /**
   * An arrow's colour *before* the edge-opacity fold.
   *
   * The arrow vertex stage sits at WebGPU's base 8-storage-buffer
   * limit, so edge opacity is pre-folded into the stored arrow alpha —
   * which means the stored bytes cannot recover the base when the
   * folded opacity was 0.  Animations and transitions that move edge
   * opacity read the base from here instead.
   *
   * @param ref — the edge
   * @param colorProp — `'source-arrow-color'` or
   *   `'target-arrow-color'`
   * @returns the unfolded RGBA, or the no-arrow value when that end
   *   draws no arrow
   */
  arrowBase(ref: Ref, colorProp: string): RGBA;
  /**
   * The stored-arrow-bytes truth when the kernel owns edge paint: the base
   * colour with alpha folded by the (mapped or constant) opacity.  Shapes
   * are never kernel-owned (mapped shapes demote edge paint to the CPU), so
   * the computed constants decide the gate.
   */
  private foldedArrow;
  /** One edge prop for a slot: the mapper's value when mapped, else the constant. */
  private evalEdgeProp;
  /** Resolved label channels: the sidecar when labelled, else the sheet. */
  private labelChannels;
  /**
   * Defaults + props for one group ('width' is shared; the group's own
   * default wins).  Mapper specs compile into `mappersOut`; the label
   * passthrough rides the labelKey channel instead.
   */
  private resolveConst;
  /** Stored-truth readback for the background-image family (15.2). */
  private readImageProp;
  /** Write `node.fillColor` (the B1 background-opacity fold). */
  private writeNodeFillColor;
  /** Write `node.borderColor` (the B1 border-opacity fold). */
  private writeNodeBorderColor;
  /** Write `node.opacity` — under compounds the store folds the
   * ancestor product itself (round 14.4), so one call is complete. */
  private writeNodeOpacity;
  /** Write the `node.overlay` layer record (the A2 opacity fold). */
  private writeNodeOverlay;
  /** Write the `node.underlay` layer record (the A2 opacity fold). */
  private writeNodeUnderlay;
  /** Write `edge.lineColor` (the B1 line-opacity fold). */
  private writeEdgeLineColor;
  /**
   * The B1 arrow fold: v3's effective arrow opacity is opacity ×
   * line-opacity.  A 'none' end — or any end of a haystack edge, which
   * draws no arrows (v3 skips them) — stores NO_ARROW, so the getters
   * read 'none' (the recorded deviation: v3's pstyle still reports the
   * declared shape).
   */
  private edgeArrowRgba;
  /** Write `edge.sourceArrow` — `setColor` re-derives the round-56
   * shows-line bits itself, so one call is complete. */
  private writeEdgeSourceArrowColor;
  /** Write `edge.targetArrow` (see the source twin). */
  private writeEdgeTargetArrowColor;
  /** Write `edge.midSourceArrow` — `setMidArrow` maintains the live
   * mid-arrow count, so one call is complete. */
  private writeEdgeMidSourceArrowColor;
  /** Write `edge.midTargetArrow` (see the source twin). */
  private writeEdgeMidTargetArrowColor;
  /** Write the `edge.overlay` stroke record (A2: stroke = width +
   * 2·padding, derived here so the layer shaders need no width
   * binding). */
  private writeEdgeOverlay;
  /** Write the `edge.underlay` stroke record (see the overlay twin). */
  private writeEdgeUnderlay;
  /**
   * The narrow writer for one normalized prop, or null when the prop has
   * cross-channel consequences the writers above cannot carry — geometry
   * (bb/cull/pick/label anchors), labels, charts, the edge-opacity fold
   * cluster — in which case a state flip that moves it falls back to the
   * full `write()` of the target record, byte-for-byte the general
   * path's behaviour.  The layer props share one writer per record
   * because they land in one packed store call.
   */
  private fastStateWriter;
  /**
   * The one channel funnel, wrapped by the transition capture (round
   * 24.1): an already-styled slot written inside an open capture gets
   * its tweenable channels snapshotted before and diffed after — the
   * body itself stays transition-blind.
   */
  private write;
  private writeChannels;
  /** warn-once flag for the multi-image cap (recorded: 4 per node) */
  private warnedImageCap;
  /**
   * Resolve and store a node's chart record (round 23).  Values come
   * from the constant list or the `{ data: key }` passthrough (a
   * per-element array; non-arrays and invalid entries mean no chart);
   * slices cap at CHART_MAX_SLICES and the running total clamps at 1
   * (v3's percent semantics — the remainder stays unpainted).  Colors
   * cycle the palette (category10 by default) and fold chart-opacity
   * into their alphas (the B1 pattern; the header keeps the exact
   * opacity for readback).
   */
  private writeChart;
  /** Resolve a node's background-image records and store them (15.2). */
  private writeImages;
  /** Resolve an element's label text from its computed channels and store it. */
  private writeLabel;
}
//#endregion
//#region src/viewport.d.mts
interface ZoomOptions {
  level: number;
  /** model point to keep fixed while zooming */
  position?: Position;
  /** rendered (on-screen) point to keep fixed while zooming */
  renderedPosition?: Position;
}
interface Extent {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  h: number;
}
interface BoundsLike {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  h: number;
}
/** What the viewport needs from its owner (the core): rendered dimensions. */
interface ViewportHost {
  width(): number;
  height(): number;
}
/**
 * Core-owned zoom/pan state and viewport math.  Pure state — the core wraps
 * the setters and emits zoom/pan/viewport/fit events.
 */
declare class Viewport {
  /** Lower zoom bound; the current zoom is clamped into it on every set. */
  minZoom: number;
  /** Upper zoom bound; the current zoom is clamped into it on every set. */
  maxZoom: number;
  private host;
  private _zoom;
  /** the live pan object (round 62.6: read directly by Core.pan()'s
   * getter — one field hop where a method call showed; setters replace
   * the object rather than mutating it, the round-5 contract) */
  _pan: Position;
  /**
   * @param host — supplies the rendered viewport dimensions (the core)
   * @param opts — initial `zoom` (default 1, clamped) and `pan` (default
   *   the origin), plus the `minZoom`/`maxZoom` bounds, which default
   *   wide enough (1e-50 … 1e50) to be effectively unbounded
   */
  constructor(host: ViewportHost, opts?: {
    zoom?: number;
    pan?: Position;
    minZoom?: number;
    maxZoom?: number;
  });
  /**
   * The current zoom level.
   *
   * @returns model-to-rendered scale
   */
  zoom(): number;
  /**
   * The current pan.  Live internal object (as in v3) — treat as read-only.
   *
   * @returns the rendered-space translation applied before the zoom; the
   *   *same* object on every call, which the setters replace rather than
   *   mutate, so a caller that wants a stable snapshot must copy it
   */
  pan(): Position;
  /**
   * Set the zoom, optionally about a fixed point.
   *
   * @param zoom — the level, or `{ level, position | renderedPosition }`
   *   to keep that point stationary while zooming
   * @returns true when the state changed
   */
  setZoom(zoom: number | ZoomOptions): boolean;
  /**
   * Set the pan.
   *
   * @param pan — the rendered-space pan; non-numeric components are
   *   rejected rather than written
   * @returns true when the state changed
   */
  setPan(pan: Position): boolean;
  /**
   * Shift the pan by a rendered-space delta.
   *
   * @param delta — the offset to add; missing components count as 0
   * @returns true when the pan changed
   */
  panBy(delta: Position): boolean;
  /**
   * Set the min zoom bound and re-clamp the current zoom.
   *
   * @param min — the new lower bound
   * @returns true when the current zoom moved to satisfy it
   */
  setMinZoom(min: number): boolean;
  /**
   * Set the max zoom bound and re-clamp the current zoom.
   *
   * @param max — the new upper bound
   * @returns true when the current zoom moved to satisfy it
   */
  setMaxZoom(max: number): boolean;
  private reclampZoom;
  /**
   * The { zoom, pan } that would fit the given bounds — computed, not
   * applied.
   *
   * @param bb — the model-space bounds to fit
   * @param padding — rendered px of margin on every side
   * @returns the fitting viewport, with the zoom clamped to the bounds
   */
  fitViewport(bb: BoundsLike, padding?: number): {
    zoom: number;
    pan: Position;
  };
  /**
   * Compute-and-apply a fit to the given bounds.
   *
   * @param bb — the model-space bounds to fit
   * @param padding — rendered px of margin on every side
   * @returns true when the state changed
   */
  fit(bb: BoundsLike, padding?: number): boolean;
  /**
   * The pan that would center the given bounds.
   *
   * @param bb — the model-space bounds to center
   * @param zoom — the zoom to center at; defaults to the current one
   * @returns the pan
   */
  centerPan(bb: BoundsLike, zoom?: number): Position;
  /**
   * Pan (keeping the zoom) so the given bounds are centered.
   *
   * @param bb — the model-space bounds to center
   * @returns true when the state changed
   */
  centerOn(bb: BoundsLike): boolean;
  /**
   * The rendered (on-screen) viewport rectangle.
   *
   * @returns the canvas rectangle in rendered px, always anchored at the
   *   origin — pan and zoom move the *content*, not this box, so it
   *   answers the container's size and nothing about the view
   */
  renderedExtent(): Extent;
  /**
   * The model-coordinate rectangle currently visible.
   *
   * @returns the container's rendered box projected back through the
   *   current pan and zoom — so it moves as the view moves, and its `w`/`h`
   *   shrink as the zoom rises
   */
  extent(): Extent;
  /**
   * Project a model-space point into rendered (CSS px) space.
   *
   * @param pos — the model-space point
   * @returns the rendered-space point
   */
  modelToRendered(pos: Position): Position;
  /**
   * Unproject a rendered (CSS px) point back into model space — the
   * inverse of `modelToRendered`.
   *
   * @param pos — the rendered-space point
   * @returns the model-space point
   */
  renderedToModel(pos: Position): Position;
  private clampZoom;
}
//#endregion
//#region src/animation.d.mts
interface Position$1 {
  x: number;
  y: number;
}
/** A handle to a built-but-controllable animation (from `animation()`). */
interface AnimationHandle {
  /** Enqueue and start; resolves when it completes. */
  play(): Promise<void>;
  stop(jumpToEnd?: boolean): void;
  promise(): Promise<void>;
  playing(): boolean;
  /** Round 24.3: freeze in place — values hold, the promise stays
   * pending, and the paused span is excluded from the timeline. */
  pause(): AnimationHandle;
  resume(): AnimationHandle;
  /** Swap the tween's ends, remapping elapsed so the current value is
   * continuous (exactly for point-symmetric easings — linear included). */
  reverse(): AnimationHandle;
  /** Elapsed fraction of the duration (read-only — no scrubbing). */
  progress(): number;
  paused(): boolean;
}
/** Options accepted by animate()/animation(). */
interface AnimateOptions {
  style?: Record<string, string | number>;
  position?: Partial<Position$1>;
  /** viewport targets (core.animate) */
  pan?: Position$1;
  /**
   * viewport target: pan by a delta rather than to an absolute position.
   * Resolved against the pan at creation time (v3's rule), so a manual
   * pan afterwards does not move the target.  Throws alongside `pan` —
   * the two spell the same channel, where v3 silently prefers `panBy`.
   * Core-only, as in v3: an element animation ignores it.
   */
  panBy?: Position$1;
  zoom?: number;
  /**
   * viewport target: animate to the viewport that fits the given elements
   * (or an explicit model-space box).  Resolved to pan/zoom when the
   * animation is created, as v3 does.
   */
  fit?: {
    eles?: unknown;
    boundingBox?: {
      x1: number;
      y1: number;
      x2?: number;
      y2?: number;
      w?: number;
      h?: number;
    };
    padding?: number;
  };
  /** viewport target: animate the pan that centers the given elements */
  center?: {
    eles?: unknown;
  };
  duration?: number;
  /**
   * A name from the v3 enum, `cubic-bezier()`, `linear()` or
   * `spring(bounce)`.  For a spring, `duration` is the *perceptual*
   * duration and the animation runs on past it to settle, so its total
   * length is longer (see `durationMs`).
   */
  easing?: string;
  delay?: number;
  complete?: () => void;
}
type WriteKind = 'position' | 'scalar' | 'color' | 'lane' | 'padding' | 'fontSize';
/**
 * Tween write targets: the real columns plus the pseudo-columns of the
 * round-25 geometry kinds — compound padding (25.4: a per-parent
 * compound style input routed through `updateCompoundStyle`, resolved
 * by the auto-bounds flush) and label font-size (25.5: the label
 * sidecar, patched per tick through `setLabelFontSize` — an edge's
 * write drives its end-label streams and fontSize-derived anchorY
 * along).
 */
type TweenColumn = ColumnId | 'node.padding' | 'node.fontSize' | 'edge.fontSize';
/**
 * One column's worth of resolved tween data, captured once at start.
 *
 * `data` is what both executors read.  Per slot: position `(fx, fy, tx,
 * ty)`; scalar `(from, to)`; colour two OKLab vec4s `(L, a, b, alpha)`,
 * alpha normalized — pre-converted on the CPU so the kernel only needs the
 * OKLab→sRGB direction it already has, and so both sides interpolate the
 * exact same numbers.
 */
interface ChannelWrite {
  column: TweenColumn;
  kind: WriteKind;
  /** the column has no CPU consumer, so a GPU tween may own it outright */
  paint: boolean;
  /** parallel to `slots`; carries the generation for liveness checks */
  refs: Ref[];
  slots: Uint32Array;
  data: Float32Array;
  /** scalar bounds against easing overshoot (see StyleChannel) */
  min: number;
  max: number;
  /** round 25: which component a `lane` write targets.  Lane writes are
   * geometry-tier (never GPU-registered) and route through the store's
   * cascading lane writer. */
  lane?: number;
}
/**
 * One element (or viewport) animation.  `refs` is empty for a viewport
 * animation.  Start values are captured lazily on the first tick after
 * the delay elapses, so queued animations pick up the true state left by
 * whatever ran before them.
 */
declare class Animation {
  /** the elements being animated (empty for a viewport animation) */
  readonly refs: Ref[];
  /** true when this animates the viewport rather than elements */
  readonly isViewport: boolean;
  private store;
  private styleEngine;
  private viewport;
  private duration;
  private easing;
  private delay;
  private style;
  private position;
  private pan;
  private zoom;
  private onComplete;
  private startTime;
  private started;
  private captured;
  private writes;
  private fromPan;
  private fromZoom;
  private _done;
  private resolvers;
  /**
   * The animation's real length: the requested duration times the easing's
   * `durationScale`, which is 1 for every curve except a spring (whose
   * duration is perceptual — the pace of the key movement — leaving the
   * settling tail to run past it).
   */
  readonly durationMs: number;
  /**
   * The compiled easing: a kind plus either a bezier tuple or a
   * progression array.  One curve layer, two executors — the CPU tick
   * calls it directly and the GPU kernel reads it out of its params, so
   * the two agree to float precision without parallel implementations.
   */
  readonly easingProgram: EasingProgram;
  /** set when the renderer's GPU tween runtime drives this animation */
  gpuDriven: boolean;
  /** batch id in the GPU tween runtime (null until registered) */
  gpuId: number | null;
  /** round 24.1: a transition built from pre-resolved ChannelWrites —
   * capture is a no-op and eligibility/columns derive from the writes */
  private preset;
  /** round 24.3: paused state — values hold, the promise stays pending */
  private _paused;
  private pausedAt;
  /** the shared clock as of the last manager tick — what pause/resume/
   * reverse/progress read, so the controls stay deterministic under
   * test-driven ticks (the manager stamps it every advance) */
  lastNow: number;
  /**
   * A transition animation (round 24.1): the style engine diffed stored
   * truth around a restyle into per-column writes; nothing to capture.
   *
   * @param store — the store whose columns the writes address
   * @param refs — the elements the transition covers, for eviction and
   *   ref repair; the writes carry their own slot lists
   * @param writes — the diffed per-column from/to records
   * @param opts — `duration`, and the `delay`/`easing` the sheet's
   *   `transition-*` config resolved to
   * @returns an animation whose values are already resolved — it never
   *   reads the columns at play time, so the restyle's own diff is the
   *   only place stored truth is consulted
   */
  static preset(store: GraphStore, refs: Ref[], writes: ChannelWrite[], opts: {
    duration: number;
    delay?: number;
    easing?: string;
  }): Animation;
  /**
   * Build an animation.  Reached through `eles.animate()`/
   * `eles.animation()` and `cy.animate()`/`cy.animation()` rather than
   * constructed directly.
   *
   * @param store — the columnar store the tween writes into
   * @param viewport — the viewport, for a viewport animation
   * @param refs — the elements to animate
   * @param isViewport — whether this targets the viewport
   * @param opts — targets, `duration`, `easing`, `delay`, `complete`
   * @param styleEngine — needed to resolve style targets and the arrow
   *   colour fold
   * @throws if `easing` is a function — a closure cannot cross to the
   *   device, so accepting one would make the curve depend on whether
   *   the animation got offloaded
   */
  constructor(store: GraphStore, viewport: Viewport | null, refs: Ref[], isViewport: boolean, opts: AnimateOptions, styleEngine?: StyleEngine | null);
  /**
   * True once the animation has completed or been stopped.
   *
   * @returns whether it is over, *not* whether it succeeded — a stop and
   *   a natural completion are the same answer here, and both resolve
   *   the promise
   */
  get done(): boolean;
  /** Columns this animation writes (round 21: the concurrency contract —
   * animations sharing an element may run together iff these are
   * disjoint).  A no-op tween (delay()) touches nothing. */
  private _columns;
  /**
   * The store columns this animation writes — the round-21 concurrency
   * contract: two animations on the same element run together exactly
   * when their column sets are disjoint, and overlap evicts the older
   * one.  A no-op tween (`delay()`) touches nothing.
   *
   * @returns the set of column ids, computed once and cached
   */
  touchedColumns(): ReadonlySet<string>;
  /**
   * Viewport channels (round 21): pan and zoom compose when disjoint.
   *
   * @returns whether this animation tweens the pan — the pair are
   *   separate channels, so a pan animation and a zoom animation run
   *   together rather than evicting each other
   */
  get hasPan(): boolean;
  /**
   * Whether this viewport animation tweens the zoom.
   *
   * @returns whether the zoom channel is claimed; see `hasPan` for why
   *   the two are tracked apart
   */
  get hasZoom(): boolean;
  /**
   * Slot compaction (19.3): repair the target and channel-write refs
   * through the store's forwarding (in place) and re-point the parallel
   * slot arrays — `apply` indexes columns by `slots[i]`, which would
   * otherwise write the tween into whatever moved into the old slot.
   *
   * @param store — the store that just compacted, whose forwarding chain
   *   resolves the pre-move refs
   */
  repairRefs(store: GraphStore): void;
  /**
   * True once the delay has elapsed and interpolation is under way.
   *
   * @returns whether values are actually moving — false *during* the
   *   delay, when the animation is live and owns its channels but has
   *   not started interpolating
   */
  get running(): boolean;
  /** A promise that resolves when the animation completes (or is stopped). */
  promise(): Promise<void>;
  /**
   * Advance this animation.
   *
   * @param now — the shared clock in ms
   * @returns true when the animation finished on this tick
   */
  tick(now: number): boolean;
  /**
   * Stop now.
   *
   * @param jumpToEnd — apply the final frame first, instead of freezing
   *   at the value the tween reached
   */
  stop(jumpToEnd: boolean): void;
  /**
   * Whether the animation is paused: values hold where they are and the
   * promise stays pending.  A paused animation still owns its channels,
   * so the round-21 eviction stops it like any running one.
   *
   * @returns whether the clock is frozen; a paused animation is not a
   *   stopped one — it still holds its channels against everything else
   */
  get paused(): boolean;
  /**
   * Elapsed fraction of the duration (0 before start, 1 when done;
   * frozen at the pause point while paused).  Read-only — no scrubbing.
   *
   * @returns the eased-time input in [0, 1], *before* the easing curve is
   *   applied — so it is linear in wall time, not in the value being
   *   tweened
   */
  get progress(): number;
  /**
   * Freeze in place.
   *
   * @param now — the clock to freeze against; defaults to the last tick
   */
  pause(now?: number): void;
  /**
   * Continue, excluding the paused span from the timeline.
   *
   * @param now — the clock to resume against; defaults to the last tick
   */
  resume(now?: number): void;
  /**
   * Swap the tween's ends and remap elapsed to `1 − t`, so the current
   * value is continuous (exactly for point-symmetric easings — linear
   * included; v3's start/end swap carried the same rule).  Reversing
   * inside the delay completes at the captured start state.  Works
   * paused (the frozen value is the pivot) — resume plays backward.
   */
  reverse(): void;
  /** Write the value reached at `now` onto the CPU columns without
   * finishing — how a GPU-driven animation leaves the device for a
   * pause or reverse (the caller unregisters the batch).
   *
   * @param now — the clock to evaluate at; defaults to the last tick
   */
  applyNow(now?: number): void;
  /** Swap every write's from/to halves (and the viewport targets). */
  private swapEnds;
  /** set when a slot compaction demoted this animation mid-flight: the
   * rest of its run stays on the CPU (its GPU buffers held old slots) */
  private _barred;
  /**
   * Whether the GPU tween runtime can drive this animation outright.
   *
   * All-or-nothing: one non-offloadable channel keeps the whole
   * animation on the CPU, so a column is never half-owned.  Position
   * qualifies under the round-9 lease (the pass barrier lets cull and
   * the edge shaders read the tweened positions, so edges follow for
   * free); paint qualifies because nothing on the CPU reads it;
   * geometry channels and the viewport do not — geometry is read by
   * cull, the CPU pick replica and every columnar scan, so it stays
   * CPU-canonical (round 25).
   *
   * @returns whether **every** write may offload — all-or-nothing per
   *   animation, so one geometry channel among the writes keeps the whole
   *   animation on the CPU rather than splitting it
   */
  get gpuEligible(): boolean;
  /**
   * Resolve this animation into per-column GPU batches, capturing start
   * values.  Sets the start clock so CPU settle and GPU evaluation share
   * it.
   *
   * @param now — the clock the batch's params are anchored to
   * @returns one ChannelWrite per tweened column
   */
  gpuBatches(now: number): ChannelWrite[];
  /**
   * Pin the start clock on the first tick, so `startMs` reads true before
   * capture.
   *
   * @param now — the clock of that first tick
   */
  schedule(now: number): void;
  /**
   * Start time in the shared clock (set once scheduled); ms.
   *
   * @returns the instant interpolation begins — the delay is already
   *   added in, so this is not the moment `play()` was called; 0 before
   *   the animation has been scheduled at all
   */
  get startMs(): number;
  /**
   * Settle a GPU-driven animation onto the CPU columns at `now` and finish
   * it — the tween is CPU-reproducible, so the exact current value is
   * `lerp(from, to, ease(t))` (t = 1 on natural completion).  Also how an
   * interrupted animation lands: without it the CPU would keep the start
   * values while the GPU buffers hold the last frame drawn, and nothing
   * would ever dirty the column to reconcile them.
   *
   * @param now — the clock to settle at; t = 1 on natural completion
   */
  settleGpu(now: number): void;
  /**
   * Leave the GPU path mid-flight without ending the animation (slot
   * compaction, 19.4): write the exact value reached onto the CPU
   * columns and keep ticking as a CPU tween — the device-side slot
   * buffers held pre-compaction slots, and 19.3's repair re-points the
   * CPU slot arrays.  The caller unregisters the GPU batch.
   *
   * @param now — the clock whose value is written to the CPU columns
   */
  demoteGpu(now: number): void;
  /**
   * Resolve the animation into `ChannelWrite`s against the live elements.
   * Idempotent — the first capture wins, so a queued animation still picks
   * up the state its predecessor left, and a GPU-driven animation settles
   * against the values it registered with.
   */
  private capture;
  private positionWrite;
  private scalarWrite;
  /** Round 25.4: tween a parent's declared compound padding — from is
   * the stored declaration in its declared unit; the auto-bounds flush
   * resolves it per tick. */
  private paddingWrite;
  /** Round 25.5: tween a label's font-size — from is the sidecar
   * entry's current value (refs are pre-filtered to labelled slots). */
  private fontSizeWrite;
  /** Round 25: tween one component of a multi-lane column (node size).
   * Geometry-tier by construction — lane writes never offload. */
  private laneWrite;
  private colorWrite;
  /**
   * Ride-along writes for an edge-width tween (25.2): the derived
   * channels that resolve against the width at style-write, all linear
   * in it.  Strokes ride additively from stored truth
   * (to = stored + Δwidth — mapper-resolved paddings/outline widths
   * need no engine round trip), gated per slot on the layer being
   * enabled; hollow-arrow strokes ride by mode ('match-line' → the
   * target width, percent → pct × target; plain numbers never baked
   * the width, so they stay).  Arrow-width modes are constants-only
   * sheet props, answered by the engine.
   */
  private captureEdgeWidthRides;
  /** Arrow colour writes that keep the pre-folded alpha in step with an edge-opacity tween. */
  private captureArrowFold;
  private apply;
  private finish;
}
/** The renderer's GPU tween executor, seen by the manager. */
interface GpuTweenSink {
  register(id: number, writes: readonly ChannelWrite[], start: number, duration: number, easing: EasingProgram): void;
  unregister(id: number): void;
}
/**
 * Per-core animation manager (round 21: no queue).  Every started
 * animation runs immediately; animations sharing an element compose when
 * their channel columns are disjoint, and starting one that overlaps a
 * running animation's columns stops that older animation in place (its
 * promise resolves, values freeze where they got to, any GPU lease
 * settles) — whole-animation eviction, never a half-stopped animation.
 * Sequencing is the caller's job via `await animation.promise()`.  An
 * auto-driver ticks via rAF (or setTimeout when headless) while anything
 * is active; tests can drive `tick(now)` directly.
 */
declare class AnimationManager {
  private running;
  private viewportRunning;
  private onTick;
  private ticking;
  private raf;
  /** the renderer's GPU tween runtime (position animations offload here) */
  private sink;
  /** true while the renderer drives ticks (its frame clock replaces the auto-loop) */
  private driven;
  private gpuCounter;
  /**
   * @param onTick — run after each tick; the core uses it to request a
   *   redraw and to emit viewport events while a viewport animation
   *   pans or zooms
   */
  constructor(onTick: () => void);
  /**
   * The renderer takes over the clock and provides the GPU tween sink.
   *
   * @param sink — the renderer's tween sink; the manager cedes its
   *   auto-loop to the render loop while it is attached
   */
  attachDriver(sink: GpuTweenSink): void;
  /**
   * Give the clock back: settle every GPU-driven animation onto the CPU
   * columns and drop the sink.  Called when the renderer goes away.
   */
  detachDriver(): void;
  /** Settle every GPU-driven animation onto the CPU columns.  Round
   * 14.11: a reparent mid-flight moves the tweened slots under the
   * auto-bounds/fold derivations, which read the CPU columns — the
   * store's reparent hook settles active leases before they go stale. */
  settleGpuAll(): void;
  /** Every distinct running element animation (one entry per animation,
   * however many refs it spans). */
  private allRunning;
  /**
   * Slot compaction (19.4): demote every GPU-driven animation to the CPU
   * path — the device-side slot buffers hold pre-compaction slots.  Each
   * writes the exact value it reached onto the CPU columns, unregisters
   * its batch, and keeps running as a CPU tween (whose slot lists 19.3's
   * `onCompacted` repair re-points).  Unlike `settleGpuAll` (the
   * reparent path), the animation is *not* finished early.
   */
  demoteGpuAll(): void;
  /**
   * Slot compaction (19.3): repair every queued animation's refs/slots
   * and re-key the per-element queues (keys pack the pre-move identity).
   * GPU-driven animations were demoted to the CPU by the caller before
   * the store compacted (`demoteGpuAll`).
   *
   * @param store — the store that just compacted
   */
  onCompacted(store: GraphStore): void;
  /**
   * Start an animation (round 21: immediately — there is no queue).  A
   * running animation sharing a ref *and* a channel column with the new
   * one is stopped in place first (whole-animation eviction); disjoint
   * channels compose.  Nudges the driver (or starts the auto-loop).
   *
   * @param ani — the animation to run
   */
  start(ani: Animation): void;
  /** Drop an animation from every ref's running set. */
  private remove;
  /**
   * True while any animation is running.
   *
   * @returns whether anything at all is tweening, element or viewport —
   *   the renderer cedes its auto-loop and drives the frame clock while
   *   this holds
   */
  active(): boolean;
  /**
   * True when a specific element has a running animation.
   *
   * @param ref — the element to check
   * @returns whether anything is tweening it
   */
  isAnimating(ref: Ref): boolean;
  /** Whether any element animation is running at all — the O(1) gate in
   * front of per-ref queries (round 62.4).
   *
   * @returns true when any element animation is live */
  anyRunning(): boolean;
  /**
   * True when the viewport is animating.
   *
   * @returns whether a pan/zoom animation is live; element animations do
   *   not count, which is the split `cy.animated()` exposes
   */
  isViewportAnimating(): boolean;
  /**
   * Stop every running animation on the given refs (round 21: there is
   * no queue to clear — all of them are running).
   *
   * @param refs — the elements whose animations stop
   * @param jumpToEnd — apply each animation's final frame first
   */
  stop(refs: Ref[], jumpToEnd: boolean): void;
  /**
   * Stop one animation.  A GPU-driven one settles instead of plain-stopping:
   * its columns are leased to the device, so it has to write the value it
   * actually reached back onto the CPU (v3 leaves a stopped animation where
   * it got to) or the two would diverge with nothing to reconcile them.
   */
  private stopOne;
  /**
   * Stop every running viewport animation.
   *
   * @param jumpToEnd — finish at the target instead of freezing at the
   *   current value
   */
  stopViewport(jumpToEnd: boolean): void;
  /**
   * Pause one animation.  A GPU-driven one settles its lease first —
   * the device is released and the CPU columns hold the exact value it
   * reached — so the freeze is readable and the mirror resumes its
   * uploads; resume re-acquires through the normal advance path.
   *
   * @param ani — the animation to freeze
   */
  pauseAni(ani: Animation): void;
  /**
   * Resume a paused animation.  The paused span is excluded from the
   * timeline, so the remaining motion keeps its original pace, and a
   * previously GPU-driven tween re-acquires the device on the shifted
   * clock.
   *
   * @param ani — the animation to resume
   */
  resumeAni(ani: Animation): void;
  /**
   * Reverse one animation in place.  A GPU-driven one leaves the device
   * at its current value first; the next advance re-registers the
   * swapped writes on the remapped clock.
   *
   * @param ani — the animation to reverse
   */
  reverseAni(ani: Animation): void;
  /**
   * Advance every running animation to `now`; drop finished ones.
   * Position and paint animations route to the GPU sink when one is
   * attached (registered once, driven on-device, completion detected here
   * from the shared clock).
   *
   * @param now — the shared clock in ms
   * @returns true while any animation remains active
   */
  tick(now: number): boolean;
  /** Advance one animation; returns true when it is finished. */
  private advanceOne;
  private schedule;
}
//#endregion
//#region src/algorithms/search.d.mts
/**
 * Visit callback: `(v, e, u, i, depth)` — the visited node, the edge and
 * node it was reached from (undefined at roots), the visit counter, and the
 * depth from the nearest root.  Return `true` to stop and record `v` as
 * found; `false` to stop without.
 */
type SearchVisitFn = (v: Collection, e: Collection | undefined, u: Collection | undefined, i: number, depth: number) => boolean | void;
interface SearchOptions {
  roots?: Collection;
  root?: Collection;
  visit?: SearchVisitFn;
  directed?: boolean;
}
interface SearchResult {
  path: Collection;
  found: Collection;
}
type SearchArgs = [(SearchOptions | Collection)?, (SearchVisitFn | boolean)?, boolean?];
//#endregion
//#region src/algorithms/algo-shared.d.mts
/** Edge weighting function: receives the edge handle, returns its weight. */
type WeightFn = (edge: Collection) => number;
//#endregion
//#region src/algorithms/dijkstra.d.mts
interface DijkstraOptions {
  root?: Collection | null;
  weight?: WeightFn;
  directed?: boolean;
}
interface DijkstraResult {
  distanceTo(node: Collection): number | undefined;
  pathTo(node: Collection): Collection;
}
type DijkstraArgs = [(DijkstraOptions | Collection)?, WeightFn?, boolean?];
//#endregion
//#region src/algorithms/a-star.d.mts
type AStarHeuristicFn = (node: Collection) => number;
interface AStarOptions {
  root?: Collection | null;
  goal?: Collection | null;
  weight?: WeightFn;
  heuristic?: AStarHeuristicFn;
  directed?: boolean;
}
interface AStarResult {
  found: boolean;
  distance: number | undefined;
  path: Collection | undefined;
  steps: number;
}
//#endregion
//#region src/algorithms/bellman-ford.d.mts
interface BellmanFordOptions {
  root?: Collection | null;
  weight?: WeightFn;
  directed?: boolean;
  findNegativeWeightCycles?: boolean;
}
interface BellmanFordResult {
  distanceTo(node: Collection): number | undefined;
  pathTo(node: Collection, thisStart?: Collection): Collection;
  hasNegativeWeightCycle: boolean;
  negativeWeightCycles: Collection[];
}
//#endregion
//#region src/algorithms/executor.d.mts
/** Where an async algorithm runs: the reference CPU path, the WGSL
 * kernels, or (the default) whichever fits the input and environment. */
type AlgoExecutor = 'cpu' | 'gpu' | 'auto';
//#endregion
//#region src/algorithms/floyd-warshall.d.mts
interface FloydWarshallOptions {
  weight?: WeightFn;
  directed?: boolean;
  /** where the run executes; see `AlgoExecutor` (default 'auto') */
  executor?: AlgoExecutor;
}
interface FloydWarshallResult {
  distance(from: Collection, to: Collection): number | undefined;
  path(from: Collection, to: Collection): Collection;
}
//#endregion
//#region src/algorithms/tarjan-strongly-connected.d.mts
interface TarjanStronglyConnectedResult {
  /** the elements not inside any component: the edges between components */
  cut: Collection;
  components: Collection[];
}
//#endregion
//#region src/algorithms/hopcroft-tarjan-biconnected.d.mts
interface HopcroftTarjanBiconnectedResult {
  /** the cut vertices (articulation points), in discovery order */
  cut: Collection;
  components: Collection[];
}
//#endregion
//#region src/algorithms/hierholzer.d.mts
interface HierholzerOptions {
  root?: Collection;
  directed?: boolean;
}
interface HierholzerResult {
  found: boolean;
  /**
   * the trail's elements in first-traversal order (a collection is a set, so
   * revisited nodes appear once — v3's trail dedupes the same way)
   */
  trail: Collection | undefined;
}
type HierholzerArgs = [(HierholzerOptions | Collection)?, boolean?];
//#endregion
//#region src/algorithms/karger-stein.d.mts
interface KargerSteinResult {
  cut: Collection;
  components: Collection[];
  partition1: Collection;
  partition2: Collection;
}
//#endregion
//#region src/algorithms/page-rank.d.mts
interface PageRankOptions {
  dampingFactor?: number;
  precision?: number;
  iterations?: number;
  weight?: WeightFn;
  /** where the run executes; see `AlgoExecutor` (default 'auto') */
  executor?: AlgoExecutor;
}
interface PageRankResult {
  rank(node: Collection): number | undefined;
}
//#endregion
//#region src/algorithms/degree-centrality.d.mts
interface DegreeCentralityOptions {
  root?: Collection | null;
  weight?: WeightFn;
  directed?: boolean;
  /** 0 = count degree, 1 = weight sum (Opsahl's generalized degree) */
  alpha?: number;
}
interface UndirectedDegreeCentrality {
  degree: number;
}
interface DirectedDegreeCentrality {
  indegree: number;
  outdegree: number;
}
type DegreeCentralityResult = UndirectedDegreeCentrality | DirectedDegreeCentrality;
interface UndirectedDegreeCentralityNormalized {
  degree(node: Collection): number;
}
interface DirectedDegreeCentralityNormalized {
  indegree(node: Collection): number;
  outdegree(node: Collection): number;
}
type DegreeCentralityNormalizedResult = UndirectedDegreeCentralityNormalized | DirectedDegreeCentralityNormalized;
//#endregion
//#region src/algorithms/closeness-centrality.d.mts
interface ClosenessCentralityOptions {
  root?: Collection | null;
  weight?: WeightFn;
  directed?: boolean;
  /** sum 1/d (default, tolerates disconnection) instead of 1/sum d */
  harmonic?: boolean;
}
interface ClosenessCentralityNormalizedResult {
  closeness(node: Collection): number;
}
//#endregion
//#region src/algorithms/betweenness-centrality.d.mts
interface BetweennessCentralityOptions {
  weight?: WeightFn | null;
  directed?: boolean;
  /** where the run executes; see `AlgoExecutor` (default 'auto').
   * Weighted runs have no GPU path: 'auto' quietly uses the CPU and an
   * explicit 'gpu' rejects. */
  executor?: AlgoExecutor;
}
interface BetweennessCentralityResult {
  betweenness(node: Collection): number | undefined;
  betweennessNormalized(node: Collection): number;
  betweennessNormalised(node: Collection): number;
}
//#endregion
//#region src/algorithms/clustering-distances.d.mts
type DistanceMetricName = 'euclidean' | 'squaredEuclidean' | 'squared-euclidean' | 'squaredeuclidean' | 'manhattan' | 'max';
/**
 * A user-supplied distance function.  With no attributes (length 0) it
 * receives the two operands directly; otherwise the per-dimension accessors.
 */
type CustomDistanceFn = (...args: any[]) => number;
type DistanceMetric = DistanceMetricName | CustomDistanceFn;
//#endregion
//#region src/algorithms/k-clustering.d.mts
/** A node attribute accessor used as a clustering feature. */
type KAttributeFn = (node: Collection) => number;
type FeatureCentroid = number[];
interface KClusteringOptions {
  k?: number;
  m?: number;
  sensitivityThreshold?: number;
  distance?: DistanceMetric;
  maxIterations?: number;
  attributes?: KAttributeFn[];
  testMode?: boolean;
  testCentroids?: number | FeatureCentroid[] | Collection[] | null;
  /** where the run executes; see `AlgoExecutor` (default 'auto') */
  executor?: AlgoExecutor;
}
interface FuzzyCMeansResult {
  clusters: Collection[];
  degreeOfMembership: number[][];
}
//#endregion
//#region src/algorithms/hierarchical-clustering.d.mts
type HierarchicalAttributeFn = (node: Collection) => number;
interface HierarchicalClusteringOptions {
  distance?: DistanceMetric;
  /** linkage criterion: 'min' (single), 'max' (complete), 'mean', or per-pair */
  linkage?: string;
  mode?: 'threshold' | 'dendrogram';
  threshold?: number;
  addDendrogram?: boolean;
  dendrogramDepth?: number;
  attributes?: HierarchicalAttributeFn[];
  /** where the run executes; see `AlgoExecutor` (default 'auto') */
  executor?: AlgoExecutor;
}
//#endregion
//#region src/algorithms/markov-clustering.d.mts
/** A similarity function: maps an edge to a numeric contribution. */
type MarkovAttributeFn = (edge: Collection) => number;
interface MarkovClusteringOptions {
  expandFactor?: number;
  inflateFactor?: number;
  multFactor?: number;
  maxIterations?: number;
  attributes?: MarkovAttributeFn[];
  /** where the run executes; see `AlgoExecutor` (default 'auto') */
  executor?: AlgoExecutor;
}
//#endregion
//#region src/algorithms/affinity-propagation.d.mts
type AffinityAttributeFn = (node: Collection) => number;
type AffinityPreference = 'median' | 'mean' | 'min' | 'max' | number;
interface AffinityPropagationOptions {
  distance?: DistanceMetric;
  preference?: AffinityPreference;
  damping?: number;
  maxIterations?: number;
  minIterations?: number;
  attributes?: AffinityAttributeFn[];
  /** where the run executes; see `AlgoExecutor` (default 'auto') */
  executor?: AlgoExecutor;
}
//#endregion
//#region src/event.d.mts
/** The DOM event a gesture came from, when there was one. */
type NativeEvent = globalThis.Event;
/**
 * What an event can target: the core for core-level events (viewport
 * gestures, `layoutstart`, graph `data`), or a one-element collection for
 * element events.
 */
type EventTarget = Core | Collection;
/** The fields an emit may carry. */
interface EventProps {
  type?: string;
  target?: EventTarget;
  cy?: Core;
  /** model-space position, for pointer-derived events */
  position?: Position;
  /** rendered-space position; derived from `position` when omitted */
  renderedPosition?: Position;
  /** the DOM event behind a gesture (round 41.4) */
  originalEvent?: NativeEvent;
  /** the layout instance, on `layoutstart`/`layoutready`/`layoutstop` */
  layout?: unknown;
  timeStamp?: number;
}
/**
 * A v4 event (round 41.1).  Handlers receive one of these; `cy.emit()` and
 * `eles.emit()` accept either a type string or a props object, and build it.
 *
 * @see Core#on for what a name may be, and which names never fire
 */
declare class Event {
  /** the event type, e.g. `'tap'` — never namespaced (round 41.1) */
  type: string;
  /** the core for core-level events, the element for element events */
  target?: EventTarget;
  /** the core the event was raised on */
  cy?: Core;
  /** model-space position, on pointer-derived events */
  position?: Position;
  /** rendered-space position; derived from `position` and the viewport */
  renderedPosition?: Position;
  /** the DOM event behind a gesture, when there was one (round 41.4) */
  originalEvent?: NativeEvent;
  /** the layout instance, on the layout lifecycle events */
  layout?: unknown;
  /** when the event was built, `Date.now()` unless the caller supplied one */
  timeStamp: number;
  /**
   * Whether `preventDefault()` has been called.
   *
   * **Recorded, never read by v4**: by decided design `preventDefault()`
   * suppresses no gesture default — it forwards to the DOM event when one
   * is attached, and gesture defaults are controlled by their explicit
   * toggles instead.  See the module comment.
   */
  isDefaultPrevented: () => boolean;
  /** Whether `stopPropagation()` has been called — read by the compound
   * bubbling walk (round 14.5), where it halts the phase sequence. */
  isPropagationStopped: () => boolean;
  /**
   * Build an event.
   *
   * @param props — the fields to carry; `type` is required in practice and
   *   defaults to the empty string so a malformed emit is inert rather than
   *   throwing inside a handler loop
   */
  constructor(props?: EventProps);
  /**
   * v3's type tag, kept because `is.event()`-style checks and user code read
   * it.
   *
   * @returns the string `'event'`
   */
  instanceString(): string;
  /**
   * Mark the event's default as prevented, and prevent the DOM event's
   * default when one is attached.
   *
   * **Browser-level only, by decided design** — no v4 code reads
   * `isDefaultPrevented()`, so this cannot stop a tap from selecting or a
   * grab from starting; use the explicit toggles (`autoungrabify`,
   * `autounselectify`, `boxSelectionEnabled`, …) for gesture control.
   * With `originalEvent` populated (round 41.4) this reaches the
   * browser's default.
   */
  preventDefault(): void;
  /**
   * Stop the event bubbling to further phases: the remaining ancestors and
   * the core do not see it (round 14.5).  Returning `false` from a handler
   * does the same.  With `originalEvent` attached (round 41.4) this also
   * calls the DOM event's `stopPropagation()`, so an outer DOM listener
   * stops seeing it too.
   */
  stopPropagation(): void;
}
//#endregion
//#region src/emitter.d.mts
/** An event handler.  `this` is the callback context the emitter's options
 * choose — the core, or the phase element during compound bubbling. */
type EventHandler = (this: unknown, event: Event, ...extraParams: unknown[]) => unknown;
/** A registered listener. */
interface Listener<TQualifier = unknown> {
  /** the event type, matched whole (no namespace splitting) */
  type: string;
  callback: EventHandler;
  /** what restricts this listener — an element ref or a predicate */
  qualifier?: TQualifier | null;
  /** remove after the first matching emit */
  one?: boolean;
}
/** The hooks that make one emitter behave as v4's qualified-listener model;
 * `events.mts` supplies all four. */
interface EmitterOptions<TContext, TQualifier> {
  /** the emitter context — the core */
  context: TContext;
  /** whether two qualifiers denote the same restriction, for `off()` */
  qualifierCompare(q1: TQualifier | null | undefined, q2: TQualifier | null | undefined): boolean;
  /** whether this listener should fire for this event (the phase rules) */
  eventMatches(context: TContext, listener: Listener<TQualifier>, event: Event): boolean;
  /** fill in fields every event carries (`cy`, a default `target`) */
  addEventFields(context: TContext, props: EventProps): void;
  /** what `this` is inside the callback (v3's currentTarget semantics) */
  callbackContext(context: TContext, listener: Listener<TQualifier>, event: Event): unknown;
}
/** Anything `emit()` accepts: one or more space-separated type names, a
 * props object, or an already-built event (the bubbling walk re-emits one). */
type EmitInput = string | EventProps | Event;
/**
 * The one emitter a v4 core owns (round 41.2).
 *
 * @see makeCoreEmitter in `events.mts`, which is the only place one is built
 */
declare class Emitter<TContext = unknown, TQualifier = unknown> {
  /** every listener on this core, in registration order */
  listeners: Listener<TQualifier>[];
  /** emit depth, so `off()` during an emit copies rather than mutates */
  emitting: number;
  private opts;
  /**
   * @param opts — the context and the four matching hooks
   */
  constructor(opts: EmitterOptions<TContext, TQualifier>);
  /**
   * Register a listener for one or more space-separated event names.
   *
   * @param events — the name(s); any name is legal, and one v4 never emits
   *   simply never fires
   * @param qualifier — the restriction, or null for an unqualified listener
   * @param callback — the handler; a non-function is ignored, so
   *   `cy.on( 'tap' )` registers nothing rather than throwing
   * @param one — remove the listener after its first matching emit
   * @returns this emitter
   */
  on(events: string, qualifier?: TQualifier | null, callback?: EventHandler, one?: boolean): this;
  /**
   * Register a listener that fires at most once.
   *
   * @param events — the name(s)
   * @param qualifier — the restriction, or null
   * @param callback — the handler
   * @returns this emitter
   */
  one(events: string, qualifier?: TQualifier | null, callback?: EventHandler): this;
  /**
   * Remove listeners.  A listener matches when its type matches (or `events`
   * is `'*'`), its qualifier compares equal (when one is given), and its
   * callback is identical (when one is given).
   *
   * @param events — the name(s), or `'*'` for every type
   * @param qualifier — restrict the removal to this qualifier
   * @param callback — restrict the removal to this handler
   * @returns this emitter
   */
  off(events: string, qualifier?: TQualifier | null, callback?: EventHandler): this;
  /**
   * Remove every listener on this core.
   *
   * @returns this emitter
   */
  removeAllListeners(): this;
  /**
   * Emit one or more events.
   *
   * @param events — space-separated names, a props object, or a built event
   * @param extraParams — extra arguments passed to each handler after the
   *   event; a non-array is wrapped
   * @returns this emitter
   */
  emit(events: EmitInput, extraParams?: unknown): this;
  /** Build an event from props, letting the options fill in `cy`/`target`. */
  private build;
  /** Run one event past the listener list as it stood when the emit began. */
  private emitOne;
}
//#endregion
//#region src/collection.d.mts
type EleFilterFn = (ele: Collection, i: number, eles: Collection) => boolean;
type ElePositionFn = (ele: Collection, i: number) => Position | false | undefined;
/** A subset criterion: a structured query or a per-element predicate. */
type FilterLike = Query | EleFilterFn;
/**
 * A v3-style collection over the columnar store: an element is a length-1
 * collection, interned per live slot so `eles[0]`, `forEach` args and
 * `same()` behave as expected.  Handles hold `{ group, slot, gen }` refs
 * validated on access; stale refs (removed elements) read as no-ops or
 * `undefined`, though cached `id()`/`group()` stay readable.
 */
declare class Collection {
  [index: number]: Collection;
  /** How many elements this collection holds. */
  length: number;
  _cy: Core;
  /** the owning store, held directly (round 62.5): every accessor read
   * it through a getter chain, which showed on the nanosecond rows */
  _store: GraphStore;
  private __refs;
  /** the store's compactEpoch this collection last synced against (19.3) */
  private _syncEpoch;
  _id: string | undefined;
  _group: GroupName | undefined;
  /** per-element scratchpad, lazily created on the interned singleton handle */
  _scratch?: Record<string, unknown>;
  /** lazily-built packed-key → first-index map; safe to cache since _refs is immutable */
  _keys?: Map<number, number>;
  /** lazily-built id → index map for indexOfId (round 62.4), cacheable
   * on the same immutability grounds as _keys */
  _idIdx?: Map<string, number>;
  /** the whole-object data() cache (round 62.4), valid while the
   * DataStore epoch, the synthesized-field inputs (parent slot or
   * endpoints) and the ref's generation all hold */
  _dataObj?: {
    epoch: number;
    aux: number;
    gen: number;
    obj: Record<string, unknown>;
  };
  /** the dense handle array behind the iteration family (round 62.5):
   * array-element access holds its speed in every JIT mode where
   * indexed own-property access is bimodal, and _refs immutability
   * makes the cache safe — the handles are the same interned objects
   * either way */
  _eles?: Collection[];
  /** the algorithms' SubgraphView memo (round 62.1), keyed by the
   * store's structureEpoch — sound because membership is _refs (immutable)
   * minus dead refs, and death moves the epoch.  Typed loosely to keep
   * the algorithms layer out of this module's imports. */
  _sgView?: {
    epoch: number;
    view: unknown;
  };
  /**
   * The collection's refs, repaired lazily after a slot compaction
   * (19.3): on first access past a new compaction epoch, every stale-
   * but-forwarded ref rewrites in place (fixing all holders of that ref
   * object) and the packed membership cache drops.  The array identity
   * and length never change — dead refs stay dead in place, matching
   * removed-element semantics.
   */
  get _refs(): Ref[];
  set _refs(refs: Ref[]);
  /**
   * Build a collection over a ref list.  Not part of the public API —
   * collections come from the core (`cy.nodes()`, `cy.$id()`,
   * `cy.collection()`) and from other collections; going through those
   * keeps handle interning and dedupe correct.
   *
   * @param cy — the owning core
   * @param refs — the element refs to hold
   * @param opts — `singleton` for the interned per-slot handle, `unique`
   *   when the refs are already deduped, `live` when they are also known
   *   current (both skip work on the hot path)
   */
  constructor(cy: Core, refs: Ref[], opts?: {
    singleton?: boolean;
    unique?: boolean;
    live?: boolean;
    /** interned handles matching `refs` one-for-one (round 62.4):
     * a slice of an existing collection passes its own — they are
     * exactly what re-interning would return, minus the per-element
     * validation the source collection already carries */
    handles?: Collection[];
  });
  _first(): Ref | undefined;
  /** the event system's view of this collection (see events.mts) */
  _eventRef(): Ref | null;
  _liveRefs(): Ref[];
  _spawn(refs: Ref[]): Collection;
  /**
   * Like `_spawn`, but for refs already known to be distinct (a subset of this
   * collection's deduped refs). Skips the dedupe Set build.
   */
  _spawnUnique(refs: Ref[]): Collection;
  /**
   * Like `_spawnUnique`, but for refs also known to be current (freshly
   * read off the store, e.g. traversal output): interning skips the
   * per-element gen re-validation of `_eleFromRef`.
   */
  _spawnLive(refs: Ref[]): Collection;
  /**
   * A cached Map of this collection's packed element keys to their first
   * index, for set membership (`.has()`) and `indexOf` alike.
   * Sound to cache: `_refs` is fixed at construction, and a packed key encodes
   * the ref's own {group, slot, gen}, so it stays valid even as the store
   * mutates. Built lazily — collections that never do a set op or an
   * `indexOf` pay nothing.
   */
  _keySet(): Map<number, number>;
  /**
   * The type tag `'collection'` — the counterpart of the core's
   * `'core'`, for code that accepts either.
   *
   * @returns `'collection'`
   */
  instanceString(): string;
  /**
   * The core this collection belongs to.
   *
   * @returns the instance that owns these elements — a collection cannot
   *   span two cores, so this is also the identity a set operation
   *   against a foreign collection would violate
   */
  cy(): Core;
  /**
   * The renderer, or null when headless.
   *
   * @returns the renderer, or null on a headless instance — the model is
   *   CPU-canonical, so a null renderer costs drawing, picking and image
   *   export and nothing else
   */
  renderer(): Core['_renderer'];
  /**
   * The first element as a length-1 collection (empty collection when empty).
   *
   * @returns a length-1 collection, or an empty one — v4 has no separate
   *   element type, so this narrows rather than unwraps
   */
  element(): Collection;
  /**
   * An empty collection in the same core.
   *
   * Takes no arguments, and throws if given any — the same round-64
   * guard as `cy.collection()`, since this delegate shared the same
   * silently-ignored-argument shape.
   *
   * @returns a fresh empty collection bound to this core — the seed for
   *   building a set up by union
   * @throws if called with any argument (v3's building forms are not
   *   ported; the message names the replacements)
   */
  collection(): Collection;
  /**
   * Whether this collection contains an element with the given id.
   *
   * @param id — the element id
   * @returns true when a member has that id
   */
  hasElementWithId(id: string): boolean;
  /**
   * Index of an element within this collection.
   *
   * @param ele — the element to find; only its first element is used
   * @returns the index, or -1 when it is not in this collection
   */
  indexOf(ele: Collection): number;
  /**
   * Position of the element with this id within the collection.
   *
   * @param id — the element id
   * @returns the index, or -1 when absent
   */
  indexOfId(id: string): number;
  /**
   * The number of elements — the method form of `length`.
   *
   * @returns the element count
   */
  size(): number;
  /**
   * Whether the collection holds no elements.
   *
   * @returns true when empty
   */
  empty(): boolean;
  /**
   * Whether the collection holds at least one element.
   *
   * @returns true when non-empty
   */
  nonempty(): boolean;
  /** The interned handles as a cached dense array — the iteration
   * family's backing (round 62.5).  Internal: never handed out (the
   * public form is toArray(), which copies). */
  _arr(): Collection[];
  /**
   * Call `fn` for each element.  Returning `false` from the callback
   * stops the iteration early, as in v3.
   *
   * With no `thisArg` the callback is plain-called, so `this` is
   * undefined inside it — v3's semantics, and deliberate: rebinding the
   * receiver per element costs about 2x on large collections.
   *
   * @param fn — `( ele, i, eles )`; return `false` to stop
   * @param thisArg — optional receiver for the callback
   * @returns this collection, for chaining
   */
  forEach(fn: (ele: Collection, i: number, eles: Collection) => void | false, thisArg?: unknown): this;
  each: this['forEach'];
  /**
   * The elements as a plain array of length-1 collections.
   *
   * @returns a new array of the members
   */
  toArray(): Collection[];
  /**
   * A sub-range of the collection, with `Array#slice` semantics
   * (negative indices count from the end).
   *
   * @param start — first index, inclusive
   * @param end — last index, exclusive
   * @returns the sub-range as a new collection
   */
  slice(start?: number, end?: number): Collection;
  /**
   * A copy sorted by a comparator.  Note that sort order is a property
   * of the *collection*, not of drawing: v4 draw order is structural and
   * there is no `z-index`.
   *
   * @param sortFn — `( a, b )` comparator over length-1 collections; a
   *   non-function is ignored and returns this collection unchanged
   * @returns a new, sorted collection
   */
  sort(sortFn: (a: Collection, b: Collection) => number): Collection;
  /**
   * The element at an index, as a length-1 collection.
   *
   * @param i — the index
   * @returns that element, or an empty collection when out of range
   */
  eq(i: number): Collection;
  /**
   * The first element, as a length-1 collection.
   *
   * @returns the first element, or an empty collection
   */
  first(): Collection;
  /**
   * The last element, as a length-1 collection.
   *
   * @returns the last element, or an empty collection
   */
  last(): Collection;
  /**
   * Map each element through `fn` into a plain array.
   *
   * @param fn — `( ele, i, eles )`
   * @param thisArg — optional receiver for the callback
   * @returns an array of the results
   */
  map<T>(fn: (ele: Collection, i: number, eles: Collection) => T, thisArg?: unknown): T[];
  /**
   * Whether any element satisfies the predicate.  Short-circuits.
   *
   * @param fn — `( ele, i, eles ) => boolean`
   * @param thisArg — optional receiver for the callback
   * @returns true when at least one element matches
   */
  some(fn: EleFilterFn, thisArg?: unknown): boolean;
  /**
   * Whether every element satisfies the predicate.  Short-circuits, and
   * is vacuously true for an empty collection.
   *
   * @param fn — `( ele, i, eles ) => boolean`
   * @param thisArg — optional receiver for the callback
   * @returns true when all elements match
   */
  every(fn: EleFilterFn, thisArg?: unknown): boolean;
  /**
   * The first element's id.  Cached on the handle, so it stays readable
   * after the element is removed.
   *
   * @returns the id, or undefined when the collection is empty
   */
  id(): string | undefined;
  /**
   * The first element's group.  Cached on the handle, so it stays
   * readable after removal.
   *
   * @returns `'nodes'` or `'edges'`, or undefined when empty
   */
  group(): GroupName | undefined;
  /**
   * Plain-object form of the first element (undefined when empty).
   *
   * @returns the definition-form object for the **first** element, or
   *   undefined when the collection is empty; it round-trips through
   *   `cy.add()`, which is the supported restore path since `cy.json()`'s
   *   import form is not in v4
   */
  json(): Record<string, unknown> | undefined;
  /**
   * Plain-object form of every element.
   *
   * @returns one object per element, in collection order — the plural of
   *   `json()`, not a graph-level export
   */
  jsons(): (Record<string, unknown> | undefined)[];
  /**
   * Whether the first element is a node.
   *
   * @returns true for a node
   */
  isNode(): boolean;
  /**
   * Whether the first element is an edge.
   *
   * @returns true for an edge
   */
  isEdge(): boolean;
  /**
   * Whether the first element is a self-loop — an edge whose source and
   * target are the same node.
   *
   * @returns true for a loop edge; false for nodes and removed elements
   */
  isLoop(): boolean;
  /**
   * Whether the first element is a non-loop edge.
   *
   * @returns true for an edge between two distinct nodes
   */
  isSimple(): boolean;
  private _isLoop;
  /**
   * Whether the first element has been removed from the graph.  A
   * removed element's handle stays usable — reads are no-ops or
   * undefined, and the cached `id()`/`group()` remain readable.
   *
   * @returns true when the element is no longer in the graph
   */
  removed(): boolean;
  /**
   * Whether the first element is still in the graph — the complement of
   * `removed()`.
   *
   * @returns true when the element is live
   */
  inside(): boolean;
  /**
   * Whether both collections hold exactly the same elements, ignoring
   * order.
   *
   * @param other — the collection to compare against
   * @returns true when the element sets are equal
   */
  same(other: Collection): boolean;
  /**
   * Whether the two collections share at least one element.
   *
   * @param other — the collection to compare against
   * @returns true when the sets intersect
   */
  anySame(other: Collection): boolean;
  /**
   * Whether every element of `other` is also in this collection.
   *
   * @param other — the candidate subset
   * @returns true when `other` is contained
   */
  contains(other: Collection): boolean;
  has: this['contains'];
  equal: this['same'];
  equals: this['same'];
  /**
   * Whether every element of `other` is in this collection's neighborhood.
   *
   * @param other — the elements to test
   * @returns true when all of them are neighbors
   */
  allAreNeighbors(other: Collection): boolean;
  allAreNeighbours: this['allAreNeighbors'];
  /**
   * Whether every element matches the criterion.
   *
   * @param criterion — a query object or an `( ele ) => boolean`
   *   predicate (there are no selector strings in v4)
   * @returns true when all elements match
   */
  allAre(criterion: FilterLike): boolean;
  /**
   * Whether any element matches the criterion.
   *
   * @param criterion — a query object or an `( ele ) => boolean`
   *   predicate
   * @returns true when at least one element matches
   */
  is(criterion: FilterLike): boolean;
  /**
   * The union of the two collections, deduped.
   *
   * @param other — the collection to add
   * @returns a new collection holding both sets
   */
  union(other: Collection): Collection;
  u: this['union'];
  or: this['union'];
  add: this['union'];
  merge: this['union'];
  /**
   * This collection's elements that are not in `other`.
   *
   * @param other — the collection to subtract
   * @returns a new collection
   */
  difference(other: Collection): Collection;
  not: this['difference'];
  subtract: this['difference'];
  unmerge: this['difference'];
  relativeComplement: this['difference'];
  /**
   * The elements present in both collections.
   *
   * @param other — the collection to intersect with
   * @returns a new collection
   */
  intersection(other: Collection): Collection;
  intersect: this['intersection'];
  and: this['intersection'];
  /**
   * The elements in exactly one of the two collections.
   *
   * @param other — the other collection
   * @returns a new collection
   */
  symmetricDifference(other: Collection): Collection;
  symdiff: this['symmetricDifference'];
  xor: this['symmetricDifference'];
  /**
   * The subset matching the criterion.
   *
   * A structured **query object** is answered directly off the flags
   * column — no per-element handles and no closures — while a
   * **predicate function** is called per element.  v4 has no selector
   * strings, so those two forms cover what v3 spelled with a selector.
   *
   * @param criterion — a query object (`{ selected: true }`,
   *   `{ data: { weight: { gt: 0.5 } } }`, …) or an
   *   `( ele, i, eles ) => boolean` predicate
   * @param thisArg — optional receiver, for the predicate form
   * @returns a new collection of the matching elements
   * @throws if a query object carries an unknown key — a typo must not
   *   silently match everything
   */
  filter(criterion: FilterLike, thisArg?: unknown): Collection;
  /**
   * The nodes in this collection, optionally filtered.
   *
   * @param criterion — a query object or predicate; omit for all nodes
   * @returns a new collection of nodes
   */
  nodes(criterion?: FilterLike): Collection;
  /**
   * The edges in this collection, optionally filtered.
   *
   * @param criterion — a query object or predicate; omit for all edges
   * @returns a new collection of edges
   */
  edges(criterion?: FilterLike): Collection;
  /**
   * Find a member by id.  This is a linear scan of the collection; use
   * `cy.$id( id )` for the O(1) whole-graph index.
   *
   * @param id — the element id
   * @returns a collection of one element, or an empty collection
   */
  getElementById(id: string): Collection;
  /** Split into { nodes, edges }. */
  byGroup(): {
    nodes: Collection;
    edges: Collection;
  };
  /**
   * All elements of the graph not in this collection.
   *
   * @returns the complement against the **whole graph**, not against any
   *   enclosing collection — which is what the `absolute` in the name is
   *   distinguishing
   */
  absoluteComplement(): Collection;
  complement: this['absoluteComplement'];
  abscomp: this['absoluteComplement'];
  /**
   * Three-way set difference against another collection.
   *
   * @param other — the collection to compare with
   * @returns `{ left: only in this, right: only in other, both: in both }`
   */
  diff(other: Collection): {
    left: Collection;
    right: Collection;
    both: Collection;
  };
  /**
   * Fold the collection into a single value.
   *
   * @param fn — `( accumulator, ele, i, eles )`
   * @param initial — the starting accumulator (required, unlike
   *   `Array#reduce`)
   * @returns the final accumulator
   */
  reduce<T>(fn: (acc: T, ele: Collection, i: number, eles: Collection) => T, initial: T): T;
  /**
   * The element maximizing `valFn`, with its value.
   *
   * @param valFn — `( ele, i, eles ) => number`
   * @param thisArg — optional receiver for the callback
   * @returns `{ value, ele }`, or `{ value: -Infinity, ele: undefined }`
   *   when the collection is empty
   */
  max(valFn: (ele: Collection, i: number, eles: Collection) => number, thisArg?: unknown): {
    value: number;
    ele: Collection | undefined;
  };
  /**
   * The element minimizing `valFn`, with its value.
   *
   * @param valFn — `( ele, i, eles ) => number`
   * @param thisArg — optional receiver for the callback
   * @returns `{ value, ele }`, or `{ value: Infinity, ele: undefined }`
   *   when the collection is empty
   */
  min(valFn: (ele: Collection, i: number, eles: Collection) => number, thisArg?: unknown): {
    value: number;
    ele: Collection | undefined;
  };
  private _extremum;
  /**
   * Get or set the first element's model-space position (nodes only).
   *
   * Reading a **compound parent** settles pending auto-bounds first, so
   * the derived centre is current.  Reading a node whose position is
   * under a GPU-owned tween (an offloaded position animation or a live
   * force layout) reports the stale mirror until the tween settles — the
   * motion-staleness rule; geometry channels like `width()` do *not*
   * behave this way.
   *
   * @param dim — `'x'` or `'y'` to read/write one axis, or a
   *   `{ x, y }` object to write both; omit to read the pair
   * @param value — the new coordinate, with the `'x'`/`'y'` form
   * @returns the position or coordinate when reading (undefined for
   *   edges and removed elements), this collection when writing
   */
  position(dim?: string | Position, value?: number): Position | number | undefined | this;
  /**
   * Like `position()`, but a write emits no `position` event.  For bulk
   * or intermediate moves — a layout's own iterations — where per-step
   * events would be noise.
   *
   * @param dim — `'x'`/`'y'`, or a `{ x, y }` object
   * @param value — the new coordinate, with the `'x'`/`'y'` form
   * @returns the position when reading, this collection when writing
   */
  silentPosition(dim?: string | Position, value?: number): Position | number | undefined | this;
  modelPosition: this['position'];
  point: this['position'];
  private _positionImpl;
  /**
   * Set every node's position, from a constant or per-element function.
   *
   * @param pos — a `{ x, y }` for all of them, or
   *   `( ele, i ) => ( { x, y } )`
   * @returns this collection, for chaining
   */
  positions(pos: Position | ElePositionFn): this;
  /**
   * Like `positions()`, but emits no `position` events.
   *
   * @param pos — a `{ x, y }` for all of them, or `( ele, i ) => pos`
   * @returns this collection, for chaining
   */
  silentPositions(pos: Position | ElePositionFn): this;
  modelPositions: this['positions'];
  points: this['positions'];
  /**
   * Animate these elements' style and/or position to explicit targets
   * over `duration` ms, easing the normalized time.
   *
   * There is no queue (round 21): the animation starts immediately,
   * animations on disjoint channels run concurrently, and starting one
   * that overlaps a running animation's channels stops the older one in
   * place — its promise resolves, its values freeze, and the new
   * animation captures from there.  Sequence with `await
   * animation( … ).play()` rather than by queueing.
   *
   * Animatable: `position`; `opacity` (both groups); node
   * `background-color`/`border-color`/`border-width`, edge `line-color`;
   * and — since round 25 — the geometry numerics node `width`/`height`,
   * edge `width`, compound `padding` and `font-size`.  Colours
   * interpolate in **OKLab**, matching the colour mappers, which
   * deliberately differs from v3's per-channel sRGB tweening.
   *
   * Easings are names, not functions: v3's full enum plus
   * `cubic-bezier( … )`, CSS `linear( … )` and `spring( bounce )`.  A
   * custom easing *function* is rejected — a closure cannot cross to the
   * GPU, so accepting one would mean a curve that silently depended on
   * whether the animation got offloaded.
   *
   * @param opts — targets (`position`, `style`, plus the viewport forms
   *   on `cy.animate`), `duration`, `easing`, `delay`, `complete`
   * @returns this collection, for chaining; use `animation()` when you
   *   want the handle
   * @see Collection#animation for the handle form with
   *   `promise`/`pause`/`resume`/`reverse`
   */
  animate(opts: AnimateOptions): this;
  /**
   * Build an animation for these elements without starting it.
   *
   * @param opts — the tween targets (`position`, `style`) plus
   *   `duration`, `delay`, `easing` and `complete`
   * @returns the handle; nothing runs until `play()`
   */
  animation(opts: AnimateOptions): AnimationHandle;
  /**
   * A no-op tween — a timed pause that touches no channels, so it
   * composes with any running animation (round 21: use
   * `delayAnimation().play()` + await to sequence).
   *
   * @param duration — the pause in ms
   * @param complete — called when it elapses
   * @returns this collection, for chaining
   */
  delay(duration: number, complete?: () => void): this;
  /**
   * Like {@link delay}, but returns the handle instead of chaining.
   *
   * @param duration — the pause in ms
   * @param complete — called when it elapses
   * @returns the handle; nothing runs until `play()`
   */
  delayAnimation(duration: number, complete?: () => void): AnimationHandle;
  /**
   * True when any of these elements has a running animation.
   *
   * @returns whether **any** element here is animating — not whether all
   *   are, and not whether the viewport is (that is `cy.animated()`)
   */
  animated(): boolean;
  /**
   * Stop every running animation on these elements (round 21: no queue —
   * the v3 clearQueue argument is gone).
   *
   * @param jumpToEnd — apply each animation's final values instead of
   *   freezing each channel where its tween reached
   * @returns this collection, for chaining
   */
  stop(jumpToEnd?: boolean): this;
  private _positions;
  /**
   * v3 parity: descendants moved along by a parent's position write emit
   * 'position' too — once each (members that already emitted are skipped).
   * Only called when position listeners exist.
   */
  private _emitSubtreePositions;
  /**
   * Offset positions by a vector or along one axis.
   *
   * @param dim — a `{ x, y }` delta, or 'x' / 'y' with `value`
   * @param value — the offset, when `dim` names an axis
   * @returns this collection, for chaining
   */
  shift(dim: string | Position, value?: number): this;
  /**
   * Like `shift()`, but emits no `position` events.
   *
   * @param dim — `'x'`/`'y'`, or a `{ x, y }` offset
   * @param value — the offset, with the `'x'`/`'y'` form
   * @returns this collection, for chaining
   */
  silentShift(dim: string | Position, value?: number): this;
  private _shift;
  /**
   * Compound-relative position: the model position minus the immediate
   * parent's (derived) position — the model position for orphans and
   * compound-free graphs (round 14.3, v3 semantics).
   *
   * @param dim — omit to read the pair, 'x' / 'y' to read one axis, or
   *   pass a `{ x, y }` (with no `value`) to write both
   * @param value — the relative coordinate to write, when `dim` names an axis
   * @returns the position or coordinate when reading, this when writing
   */
  relativePosition(dim?: string | Position, value?: number): Position | number | undefined | this;
  /** The immediate parent's position ({0, 0} for orphans); flushes first. */
  private _relOrigin;
  relativePoint: this['relativePosition'];
  /**
   * Get or set the first element's position in rendered (CSS px) space —
   * `position()` put through the current pan and zoom.  Writing
   * unprojects back to model space, so the element lands under the given
   * screen point at the current viewport.
   *
   * @param dim — `'x'`/`'y'`, or a `{ x, y }` object to write both;
   *   omit to read the pair
   * @param value — the new coordinate, with the `'x'`/`'y'` form
   * @returns the rendered position when reading, this collection when
   *   writing
   */
  renderedPosition(dim?: string | Position, value?: number): Position | number | undefined | this;
  renderedPoint: this['renderedPosition'];
  /**
   * The first element's width — a node's model-space width, or an edge's
   * stroke width.
   *
   * For a compound parent this is the *content* width, with the padding
   * subtracted from the stored drawn box (v3's `autoWidth`).  Mid-tween
   * this reads the exact current value: geometry tweens are
   * CPU-canonical every tick and never leased to the GPU (round 25), so
   * unlike a position tween there is no staleness window.
   *
   * @returns the width, or undefined when empty or removed
   * @see Collection#outerWidth to include the border
   */
  width(): number | undefined;
  /**
   * The first element's height — a node's model-space height, or an
   * edge's stroke width (as in v3, where an edge's `height` is its
   * width).
   *
   * For a compound parent this is the *content* height: the column
   * stores the padded drawn box, so the padding is subtracted here
   * (v3's `autoHeight`).  Mid-tween this reads the exact current value:
   * geometry tweens are CPU-canonical every tick and never leased to the
   * GPU (round 25).
   *
   * @returns the height, or undefined when empty or removed
   */
  height(): number | undefined;
  /** A node's core width/height: for parents the column stores the
   * padded/drawn box (auto-bounds, round 14.3), so the readback
   * subtracts the padding — v3's autoWidth/autoHeight. */
  private _nodeDim;
  /**
   * data() over the sidecar columns.  `id` (and `source`/`target` on
   * edges) are first-class and immutable — reading them works, writing
   * them throws.  Setters apply to every element in the collection and
   * emit `data` per element; a write refreshes data-mapped labels.
   * The whole-object read returns a built snapshot, not the store's
   * internals — and the *same* snapshot until a data write (or a
   * reparent/re-point) invalidates it, so mutating it never corrupts
   * the store but is visible to the mutator until the next write
   * (v3 hands out its live internal object here, where mutation
   * corrupts the actual store — v4's exposure is strictly narrower).
   *
   * @param key — omit it (read the first element's whole object), a key
   *   (read it), or an object of keys to merge (write)
   * @param value — with a string key: the value to write; omitting it
   *   reads the key, and an explicit `undefined` clears it
   * @returns the read value, or this collection when writing
   */
  data(key?: string | Record<string, unknown>, value?: unknown): unknown;
  private _setData;
  /**
   * Remove sidecar data keys.
   *
   * @param names — space-separated key names; omit to clear every key
   * @returns this collection, for chaining
   */
  removeData(names?: string): this;
  attr: this['data'];
  removeAttr: this['removeData'];
  /**
   * Per-element scratchpad (plain JS, not a column): `scratch()` reads the
   * first element's whole object, `scratch(ns)` one namespace, `scratch(ns,
   * val)` / `scratch(obj)` write to every element.
   *
   * @param args — the form to take: nothing (read the whole object), a
   *   namespace (read it), a namespace and a value (write it to every
   *   element), or one object (merge its keys into every element)
   * @returns the reader forms answer the first element — the whole
   *   scratch object under no argument, one namespace's value under
   *   `scratch(ns)`, undefined when the collection is empty — while the
   *   writer forms return this collection for chaining
   */
  scratch(...args: [] | [string] | [string, unknown] | [Record<string, unknown>]): unknown;
  /**
   * Delete scratchpad keys from every element.
   *
   * @param namespace — the key to remove; omit to clear each element's
   *   whole scratchpad
   * @returns this collection, for chaining
   */
  removeScratch(namespace?: string): this;
  /**
   * Resolved style read off the stored channels — all of the first
   * element's group props.
   *
   * @returns the whole group's props (numbers for numeric props,
   *   `rgb()`/`rgba()` strings for colors, keywords otherwise), or
   *   undefined when the collection is empty
   */
  style(): unknown;
  /**
   * Resolved style read off the stored channels — one value.  A
   * bypassed prop reads its bypass value, since a bypass writes stored
   * truth (round 63).
   *
   * @param name — the property to read, dash-case or camelCase
   * @returns the resolved value, or undefined when the collection is
   *   empty or the prop belongs to the other group
   */
  style(name: string): unknown;
  /**
   * Set a per-element style bypass on every element (round 63.4 — the
   * v3 spelling, returned).  Sugar over the stylesheet's `bypasses`
   * section: the value must be a constant (mappers belong in the
   * sheet's group blocks), the entry is keyed by the element's id and
   * survives remove/re-add, it beats every sheet rule including the
   * default sheet's selection color, and it exports from `cy.json()`.
   *
   * @param name — the property to bypass, dash-case or camelCase
   * @param value — the constant value to pin
   * @returns this collection, for chaining
   * @throws on a mapper value, a global font prop, a transition config
   *   prop, a wrong-group prop, or an invalid value
   */
  style(name: string, value: unknown): this;
  /**
   * Set several per-element style bypasses on every element (round
   * 63.4).  The object form of the setter: each key–value pair joins
   * the element's bypass declaration.
   *
   * @param props — prop → constant value, dash-case or camelCase keys
   * @returns this collection, for chaining
   * @throws as the name/value form does, per prop
   */
  style(props: Record<string, unknown>): this;
  css: this['style'];
  /**
   * Remove per-element style bypasses from every element (round 63.4 —
   * v3's `removeStyle`).  The sheet-resolved values return through the
   * normal apply, transitions included.
   *
   * @param name — the property to un-bypass, dash-case or camelCase;
   *   omit to clear each element's whole bypass declaration
   * @returns this collection, for chaining
   */
  removeStyle(name?: string): this;
  removeCss: this['removeStyle'];
  /**
   * Like `style()`, but with length props (width, height, border-width,
   * font-size) scaled into rendered (on-screen) px by the zoom.
   *
   * @param name — a property name; omit for the whole group
   * @returns the rendered-space value, or the whole group's props
   */
  renderedStyle(name?: string): unknown;
  renderedCss: this['renderedStyle'];
  /**
   * The numeric value of a numeric style prop.
   *
   * @param name — a numeric style property
   * @returns the number, or undefined when the collection is empty or the
   *   prop belongs to the other group
   * @throws if the prop resolves to a colour or a keyword rather than a number
   */
  numericStyle(name: string): number | undefined;
  /** The rendered opacity: a node's own opacity times its ancestors'
   * (v3's product rule — the store keeps the folded value in the
   * column, round 14.4); an edge's own opacity (edges have no parent).
   *
   * @returns the opacity actually rendered, which is what `transparent()`
   *   tests against 0 — not the declared `opacity` style value, which
   *   `style('opacity')` reads; undefined when empty or removed
   */
  effectiveOpacity(): number | undefined;
  /**
   * Whether the first element is fully transparent — its effective
   * opacity, with compound ancestors folded in, is exactly 0.
   *
   * @returns true when invisible through opacity
   */
  transparent(): boolean;
  /** The space tier (round 22): shown elements occupy space — they join
   * bb/fit and size their compound parents — even when `visibility:
   * 'hidden'` keeps them from rendering.  display-tier hide() clears it.
   *
   * @returns whether the element occupies space — since round 22 this can
   *   differ from `visible()`, which is the paint tier
   */
  takesUpSpace(): boolean;
  /** Whether the element can be interacted with: visible and not
   * pointer-transparent (`events: 'no'` — round 20.2).
   *
   * @returns whether any pointer path will resolve to this element; it
   *   rides `visible()`, so an element hidden either way is inert
   */
  interactive(): boolean;
  /**
   * The node's resolved label text ('' when none); read-only in the prototype.
   *
   * @returns the resolved text of the first element's label — `''` when it
   *   has none (a labelled-but-empty label reads the same), and undefined
   *   when the collection is empty or the element was removed
   */
  label(): string | undefined;
  /**
   * v3-parity accessor: node padding.  Leaves have no padding in v4
   * (no compound-free `padding` prop); parents answer the resolved
   * auto-bounds padding (round 14.3).
   *
   * @returns the resolved padding in model px — 0 for leaves and for any
   *   graph with no compounds at all, the derived value for a parent;
   *   undefined when the collection is empty
   */
  padding(): number | undefined;
  /**
   * The drawn box: core dims + 2 x padding (v3's paddedWidth).
   *
   * @returns the padded width — identical to `width()` for leaves, which
   *   have no padding; undefined when empty or removed
   */
  paddedWidth(): number | undefined;
  /**
   * The drawn box height: content height plus twice the padding (v3's
   * `paddedHeight`).  Identical to `height()` for leaves, which have no
   * padding.
   *
   * @returns the padded height, or undefined when empty or removed
   */
  paddedHeight(): number | undefined;
  private _paddedDim;
  /**
   * The full drawn width including the border — padded width plus the
   * border width.  This is the box bounds and endpoint clipping use.
   *
   * @returns the outer width, or undefined when empty or removed
   */
  outerWidth(): number | undefined;
  /**
   * The full drawn height including the border.
   *
   * @returns the outer height, or undefined when empty or removed
   */
  outerHeight(): number | undefined;
  private _borderWidth;
  /**
   * The model-space box enclosing every element of the collection.
   *
   * **Labels are included by default** (round 16.4) — v3 excluded them
   * unless asked.  Node label terms are exact (the laid text block at its
   * anchor plus text-box padding); edge label terms are conservative (a
   * rotation-safe radius about both endpoints), so a box may be slightly
   * larger than the ink but never smaller.  The box also covers ghost
   * offsets, overlay/underlay padding and outlines.
   *
   * @param options — `{ includeLabels }` (default true)
   * @returns `{ x1, y1, x2, y2, w, h }` in model coordinates
   * @throws on an unknown option key — a typo must not silently change
   *   fit semantics
   * @see Collection#labelBoundingBox for the label box alone
   */
  boundingBox(options?: {
    includeLabels?: boolean;
  }): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    w: number;
    h: number;
  };
  /**
   * The exact laid label boxes of this collection's elements, unioned
   * (round 16.4 — the v4 form of v3's text-metrics surface): node
   * labels at their anchors, edge mid-labels at the drawn midpoint,
   * end labels conservatively about their endpoint.  Empty (zero) when
   * nothing is labelled.  Headless dims are estimates (recorded).
   */
  labelBoundingBox(): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    w: number;
    h: number;
  };
  /**
   * `boundingBox()` transformed into rendered (on-screen) coordinates.
   *
   * @param options — as `boundingBox()`: `{ includeLabels }`, default
   *   true; an unknown key throws
   * @returns the rendered-space box
   */
  renderedBoundingBox(options?: {
    includeLabels?: boolean;
  }): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    w: number;
    h: number;
  };
  renderedBoundingbox: this['renderedBoundingBox'];
  /**
   * `width()` scaled by the current zoom — the on-screen width in CSS px.
   *
   * @returns the rendered width, or undefined when empty or removed
   */
  renderedWidth(): number | undefined;
  /**
   * `height()` scaled by the current zoom.
   *
   * @returns the rendered height, or undefined when empty or removed
   */
  renderedHeight(): number | undefined;
  /**
   * `outerWidth()` scaled by the current zoom.
   *
   * @returns the rendered outer width, or undefined when empty or
   *   removed
   */
  renderedOuterWidth(): number | undefined;
  /**
   * `outerHeight()` scaled by the current zoom.
   *
   * @returns the rendered outer height, or undefined when empty or
   *   removed
   */
  renderedOuterHeight(): number | undefined;
  private _rendered;
  /** Midpoint of the edge: the curve/route midpoint for curved edges
   * (v3's rs.mid rules per family), the endpoint-center average for
   * straight ones.
   *
   * @returns the point a mid-label and a mid-arrow anchor at, in model
   *   space; undefined for non-edges.  Mid-tween it inherits the position
   *   lease's staleness, like the endpoints it derives from
   */
  midpoint(): Position | undefined;
  /**
   * `midpoint()` in rendered (CSS px) space.
   *
   * @returns the rendered midpoint, or undefined for non-edges
   */
  renderedMidpoint(): Position | undefined;
  /**
   * The edge's source-side endpoint in model space, resolved through the
   * route evaluator — so it accounts for curve family, node boundary
   * clipping, haystack offsets and any manual `source-endpoint`.
   *
   * A **straight** edge answers the node boundary along the chord
   * between the node centres, pulled back by the arrow shape's
   * `spacing` (round 55 landed the boundary, round 56 the spacing) —
   * v3's `rs.arrowStartX/Y`.  That is the *arrow* point, not the drawn
   * line's end: the line stops `gap` behind the boundary, further back
   * again, which is what makes a hollow head read as one shape.
   *
   * @returns the endpoint, or undefined for non-edges
   */
  sourceEndpoint(): Position | undefined;
  /**
   * The edge's target-side endpoint in model space, resolved through the
   * route evaluator — so it accounts for curve family, node boundary
   * clipping, haystack offsets and any manual `target-endpoint`.
   *
   * A **straight** edge answers the node boundary along the chord
   * between the node centres, pulled back by the arrow shape's
   * `spacing` (round 55 landed the boundary, round 56 the spacing) —
   * v3's `rs.arrowStartX/Y`.  That is the *arrow* point, not the drawn
   * line's end: the line stops `gap` behind the boundary, further back
   * again, which is what makes a hollow head read as one shape.
   *
   * @returns the endpoint, or undefined for non-edges
   */
  targetEndpoint(): Position | undefined;
  /**
   * `sourceEndpoint()` in rendered (CSS px) space.
   *
   * @returns the rendered endpoint, or undefined for non-edges
   */
  renderedSourceEndpoint(): Position | undefined;
  /**
   * `targetEndpoint()` in rendered (CSS px) space.
   *
   * @returns the rendered endpoint, or undefined for non-edges
   */
  renderedTargetEndpoint(): Position | undefined;
  /** Whether the edge participates in bezier bundling — v3 semantics:
   * a style check (`curve-style: bezier`), true even for the lone or
   * odd-middle member that renders straight.
   *
   * @returns whether the *styled record* says bezier — a question about
   *   style, not about the rendered shape, which is why a lone edge under
   *   `curve-style: bezier` answers true while drawing as a line.  False
   *   for nodes and for removed elements
   */
  isBundledBezier(): boolean;
  /** The edge's curve control points (model coords): one for a bundled
   * bezier, two for a self-loop, the control list for an unbundled
   * bezier, undefined otherwise — v3's getControlPoints surface
   * (segments/taxi answer segmentPoints() instead).
   *
   * @returns the control points in model space, or undefined when the
   *   edge has none — which covers straight edges, segments/taxi routes,
   *   and a straight edge carrying manual endpoints (the 12c `n = 0`
   *   chord)
   */
  controlPoints(): Position[] | undefined;
  /**
   * `controlPoints()` in rendered (CSS px) space.
   *
   * @returns the rendered control points, or undefined when the edge has
   *   none
   */
  renderedControlPoints(): Position[] | undefined;
  /** The edge's segment points (model coords) — v3's getSegmentPoints:
   * defined for segments *and* taxi edges (taxi derives its points),
   * undefined otherwise.
   *
   * @returns the interior route points in model space — *derived* ones
   *   for taxi, which computes rather than declares them — or undefined
   *   for every other family
   */
  segmentPoints(): Position[] | undefined;
  /**
   * `segmentPoints()` in rendered (CSS px) space.
   *
   * @returns the rendered segment points, or undefined when the edge has
   *   none
   */
  renderedSegmentPoints(): Position[] | undefined;
  private _routeInteriorPoints;
  private _endpointPoint;
  private _toRenderedPoint;
  /**
   * Whether the first element is selected.
   *
   * @returns true when selected
   */
  selected(): boolean;
  /**
   * Whether the first element may be selected by the user.  The
   * graph-wide `cy.autounselectify()` overrides this for user gestures.
   *
   * @returns true when selectable
   */
  selectable(): boolean;
  /**
   * Select every selectable element, emitting `select` for each one that
   * changed.  Unselectable elements are skipped.
   *
   * @returns this collection, for chaining
   */
  select(): this;
  /**
   * Deselect every element, emitting `unselect` for each one that
   * changed.
   *
   * @returns this collection, for chaining
   */
  unselect(): this;
  deselect: this['unselect'];
  /**
   * Make these elements selectable.
   *
   * @returns this collection, for chaining
   */
  selectify(): this;
  /**
   * Make these elements unselectable.  Does not deselect them; call
   * `unselect()` for that.
   *
   * @returns this collection, for chaining
   */
  unselectify(): this;
  /**
   * Pannable elements are not draggable, so pannable overrides grabbable
   * (as in v3).
   *
   * @returns whether a drag gesture would move this element — the
   *   *effective* answer, so a grabbable-but-pannable element reads false
   *   here while `json()` reports the raw field
   */
  grabbable(): boolean;
  /**
   * Whether the first element is currently held by a drag gesture.
   *
   * @returns true while grabbed
   */
  grabbed(): boolean;
  /**
   * Make these elements grabbable.
   *
   * @returns this collection, for chaining
   */
  grabify(): this;
  /**
   * Make these elements ungrabbable — the user can no longer drag them,
   * while programmatic position writes still apply.
   *
   * @returns this collection, for chaining
   */
  ungrabify(): this;
  /**
   * Whether the first element renders (round 22: the derived FLAG_DRAWN
   * — shown AND not `visibility: 'hidden'` on self or, for nodes, any
   * ancestor; edges additionally fold their endpoints, v3's rule).  The
   * renderer's cull pass and CPU picking mask on the same bit, so an
   * element that is not visible() neither draws nor picks.  For
   * space-tier state (in the bb, sizing its compound parent) see
   * `takesUpSpace()` — an invisible element keeps its space.
   *
   * @returns whether the element draws and picks; false for a removed
   *   element, for an edge either of whose endpoints is hidden, and for a
   *   node under a hidden or invisible ancestor
   */
  visible(): boolean;
  /**
   * The complement of `visible()`.
   *
   * @returns true when the first element does not draw
   */
  hidden(): boolean;
  /**
   * Show these elements — the **display tier**, v3's structural
   * `display: element`.  Shown elements take up space again, rejoin
   * bounds and fit, and re-fan their bezier bundles.
   *
   * For paint-only invisibility that keeps space and bundle ranks, use
   * the `visibility` style property instead (round 22), and for a fade
   * use an `opacity` transition.
   *
   * @returns this collection, for chaining
   */
  show(): this;
  /**
   * Hide these elements structurally — v3's `display: none`.  They stop
   * drawing and picking, leave the bounding box and their ancestors'
   * auto-bounds, and their bezier bundles re-fan without them.
   * Descendants of a hidden node are gated too.
   *
   * @returns this collection, for chaining
   */
  hide(): this;
  /** show/hide (round 14.4): the store records the own state in
   * FLAG_SELF_HIDDEN and recomputes the effective FLAG_VISIBLE over
   * affected subtrees — descendants gate on hidden ancestors, and
   * hidden children leave their ancestors' auto-bounds. */
  private _setVisibility;
  /**
   * Whether the first element is locked — immovable, by layouts and
   * position writes alike.  The force layout treats locked nodes as
   * fixed obstacles.
   *
   * @returns true when locked
   */
  locked(): boolean;
  /**
   * Lock these elements against movement.
   *
   * @returns this collection, for chaining
   */
  lock(): this;
  /**
   * Unlock these elements.
   *
   * @returns this collection, for chaining
   */
  unlock(): this;
  /**
   * Whether the first element is in the transient pressed ("active") state.
   *
   * @returns the pressed flag the pointer layer sets while a press is
   *   held — transient interaction state, not a persisted property
   */
  active(): boolean;
  /**
   * True when the first element is live and not active (v3 `inactive()`).
   *
   * @returns not simply the negation of `active()`: a removed element is
   *   neither active nor inactive, so both read false for it
   */
  inactive(): boolean;
  /**
   * Put these elements into the transient pressed ("active") state, the
   * one the pointer layer sets while a press is held.
   *
   * @returns this collection, for chaining
   */
  activate(): this;
  /**
   * Clear the pressed ("active") state.
   *
   * @returns this collection, for chaining
   */
  unactivate(): this;
  /**
   * Whether dragging the first element pans the graph instead of grabbing it.
   *
   * @returns the raw pannable flag; because pannable overrides grabbable,
   *   a true here forces `grabbable()` false
   */
  pannable(): boolean;
  /**
   * Make dragging these elements pan the viewport instead of moving
   * them.  Pannable overrides grabbable, as in v3.
   *
   * @returns this collection, for chaining
   */
  panify(): this;
  /**
   * Stop these elements from panning the viewport when dragged, so a
   * grabbable one becomes draggable again.
   *
   * @returns this collection, for chaining
   */
  unpanify(): this;
  private _hasBit;
  private _setBit;
  private _setSelected;
  /**
   * Remove these elements from the graph; incident edges of removed nodes
   * cascade.  Already-removed elements are skipped (no second `remove`
   * event).
   *
   * @returns the elements actually removed — the closure, so it can be
   *   *larger* than the receiver: removing a parent brings its
   *   descendants, and removing a node brings its incident edges.  The
   *   returned refs are dead by construction (v4 removals are terminal),
   *   so only their cached `id()`/`group()` still read
   */
  remove(): Collection;
  /**
   * Move elements in place, keeping slot, id and data: `{ parent }`
   * re-parents nodes (null orphans them; the compound move, round 14.2 —
   * emits `moveout` before and `move` after per changed node), while
   * `{ source, target }` re-points edges.  As in v3 the modes are
   * exclusive — a `parent` key takes precedence.  An unknown parent id is
   * a silent no-op (v3); a cyclic assignment warns and drops (the
   * hierarchy rule).
   *
   * @param opts — `{ parent }` to re-parent nodes (null orphans them), or
   *   `{ source, target }` to re-point edges; `parent` wins if both are
   *   given
   * @returns this collection, for chaining
   */
  move(opts: {
    source?: string;
    target?: string;
    parent?: string | null;
  }): this;
  private _resolveNode;
  /**
   * The source node of the first edge.
   *
   * @returns the source node, or an empty collection for a non-edge
   */
  source(): Collection;
  /**
   * The target node of the first edge.
   *
   * @returns the target node, or an empty collection for a non-edge
   */
  target(): Collection;
  /**
   * The source nodes of every edge in the collection, deduped.
   *
   * @returns the source nodes
   */
  sources(): Collection;
  /**
   * The target nodes of every edge in the collection, deduped.
   *
   * @returns the target nodes
   */
  targets(): Collection;
  private _endpoint;
  private _endpoints;
  /**
   * Every edge incident on the nodes in this collection, deduped —
   * answered off the CSR adjacency index, so it is O(incident edges)
   * rather than a scan.  Loops appear once.
   *
   * @param criterion — an optional query object or predicate to filter
   *   the result
   * @returns the incident edges
   */
  connectedEdges(criterion?: FilterLike): Collection;
  /**
   * The endpoint nodes of every edge in this collection, deduped.
   *
   * @param criterion — an optional query object or predicate to filter
   *   the result
   * @returns the endpoint nodes
   */
  connectedNodes(criterion?: FilterLike): Collection;
  /**
   * The immediate outgoing neighbourhood: the edges leaving these nodes
   * plus the nodes they point at.  One hop only — use `successors()` for
   * the transitive closure.
   *
   * @param criterion — an optional query object or predicate to filter
   *   the result
   * @returns the outgoing edges and their target nodes
   */
  outgoers(criterion?: FilterLike): Collection;
  /**
   * The immediate incoming neighbourhood: the edges arriving at these
   * nodes plus the nodes they come from.  One hop only — use
   * `predecessors()` for the transitive closure.
   *
   * @param criterion — an optional query object or predicate to filter
   *   the result
   * @returns the incoming edges and their source nodes
   */
  incomers(criterion?: FilterLike): Collection;
  private _goers;
  /**
   * The *open* neighbourhood: the incident edges and the nodes on their
   * far ends, ignoring edge direction, excluding the collection's own
   * elements.
   *
   * @param criterion — an optional query object or predicate to filter
   *   the result
   * @returns the neighbouring edges and nodes
   * @see Collection#closedNeighborhood to include these nodes
   */
  neighborhood(criterion?: FilterLike): Collection;
  openNeighborhood: this['neighborhood'];
  /**
   * The open neighbourhood plus this collection's own nodes.
   *
   * @param criterion — an optional query object or predicate to filter
   *   the result
   * @returns the closed neighbourhood
   */
  closedNeighborhood(criterion?: FilterLike): Collection;
  /** Immediate parents of every node in the collection (unique).  v4
   * always returns a proper collection — v3's single-element raw-ref
   * shortcut (which also ignored the selector argument) is not ported.   *
   * @param criterion — an optional query object or predicate applied to
   *   the result, exactly as `filter()` takes it
   * @returns the immediate parents
   */
  parent(criterion?: FilterLike): Collection;
  /**
   * All ancestors, level by level: every nearest parent first, then the
   * grandparents, and so on (v3's iterated-parent() order).   *
   * @param criterion — an optional query object or predicate applied to
   *   the result, exactly as `filter()` takes it
   * @returns the ancestors, nearest first
   */
  parents(criterion?: FilterLike): Collection;
  ancestors: this['parents'];
  /**
   * Direct children of every node, in link order per parent.   *
   * @param criterion — an optional query object or predicate applied to
   *   the result, exactly as `filter()` takes it
   * @returns the children
   */
  children(criterion?: FilterLike): Collection;
  /**
   * The subtree below every node in pre-order, excluding the nodes
   * themselves.   *
   * @param criterion — an optional query object or predicate applied to
   *   the result, exactly as `filter()` takes it
   * @returns the descendants
   */
  descendants(criterion?: FilterLike): Collection;
  /**
   * Nodes sharing a parent with the collection's nodes, excluding them;
   * orphans are nobody's siblings (v3).   *
   * @param criterion — an optional query object or predicate applied to
   *   the result, exactly as `filter()` takes it
   * @returns the siblings
   */
  siblings(criterion?: FilterLike): Collection;
  /**
   * The collection's nodes without a parent.   *
   * @param criterion — an optional query object or predicate applied to
   *   the result, exactly as `filter()` takes it
   * @returns the parentless nodes
   */
  orphans(criterion?: FilterLike): Collection;
  /**
   * The collection's nodes that have a parent.   *
   * @param criterion — an optional query object or predicate applied to
   *   the result, exactly as `filter()` takes it
   * @returns the parented nodes
   */
  nonorphans(criterion?: FilterLike): Collection;
  private _byParentedness;
  /**
   * Ancestors common to every element, closest first (an edge in the
   * collection has no ancestors, so it empties the result — v3).   *
   * @param criterion — an optional query object or predicate applied to
   *   the result, exactly as `filter()` takes it
   * @returns the shared ancestors, closest first
   */
  commonAncestors(criterion?: FilterLike): Collection;
  /**
   * Whether the first element is a node with at least one child.
   *
   * @returns v3's `:parent` as a predicate; false for edges and for
   *   removed elements, which are nodes of no hierarchy
   */
  isParent(): boolean;
  /**
   * Whether the first element is a node with no children.
   *
   * @returns v3's `:childless`; false for edges, so it is not the plain
   *   negation of `isParent()`
   */
  isChildless(): boolean;
  /**
   * Whether the first element is a node with a parent.
   *
   * @returns v3's `:child`; false for edges and removed elements
   */
  isChild(): boolean;
  /**
   * Whether the first element is a node without a parent.
   *
   * @returns v3's `:orphan`; false for edges, so it is not the plain
   *   negation of `isChild()`
   */
  isOrphan(): boolean;
  private _liveNodeRef;
  /**
   * Collection nodes with no non-loop incoming edge (whole-graph
   * incidence, as in v3).   *
   * @param criterion — an optional query object or predicate applied to
   *   the result, exactly as `filter()` takes it
   * @returns the source nodes
   */
  roots(criterion?: FilterLike): Collection;
  /**
   * Collection nodes with no non-loop outgoing edge.   *
   * @param criterion — an optional query object or predicate applied to
   *   the result, exactly as `filter()` takes it
   * @returns the sink nodes
   */
  leaves(criterion?: FilterLike): Collection;
  private _dagExtremity;
  /**
   * Everything reachable by following outgoing edges, transitively — the
   * edges and nodes of the forward closure, excluding these nodes
   * themselves (unless a cycle reaches them).
   *
   * @param criterion — an optional query object or predicate to filter
   *   the result
   * @returns the reachable edges and nodes
   */
  successors(criterion?: FilterLike): Collection;
  /**
   * Everything that reaches these nodes by following incoming edges,
   * transitively.
   *
   * @param criterion — an optional query object or predicate to filter
   *   the result
   * @returns the edges and nodes of the backward closure
   */
  predecessors(criterion?: FilterLike): Collection;
  private _dagAllHops;
  /**
   * The edges connecting this collection's nodes with `others`, in
   * either direction.
   *
   * @param others — the nodes on the far side (a collection, never a
   *   selector string)
   * @returns the connecting edges
   */
  edgesWith(others: Collection): Collection;
  /**
   * The edges running *from* this collection's nodes *to* `others` —
   * `edgesWith()` restricted by direction.
   *
   * @param others — the target-side nodes
   * @returns the directed connecting edges
   */
  edgesTo(others: Collection): Collection;
  private _edgesWith;
  /**
   * The edges sharing endpoints with these edges, in either direction —
   * including each edge itself.  These are the edges a bezier bundle
   * fans apart.
   *
   * @param criterion — an optional query object or predicate to filter
   *   the result
   * @returns the parallel edges
   */
  parallelEdges(criterion?: FilterLike): Collection;
  /**
   * The parallel edges pointing the same way — same source and same
   * target — including each edge itself.
   *
   * @param criterion — an optional query object or predicate to filter
   *   the result
   * @returns the codirected edges
   */
  codirectedEdges(criterion?: FilterLike): Collection;
  private _parallelEdges;
  /**
   * Connected components within this collection (undirected), each as a
   * collection of the reached nodes plus the collection's edges internal
   * to that component.
   *
   * @param root — restricts the seed nodes; omit to seed from every node
   * @returns one collection per component
   */
  components(root?: Collection | null): Collection[];
  componentsOf: this['components'];
  /**
   * The whole-graph connected component containing the first element.
   *
   * @returns the component as nodes *and* their connecting edges, computed
   *   over the whole graph rather than within this collection; an empty
   *   collection when this one is empty
   */
  component(): Collection;
  private _nodeSlotSet;
  /**
   * The bounding box this collection would have if its nodes sat at the
   * given hypothetical positions (a position fn or one shared position) —
   * v3's boundingBoxAt, computed directly with no store writes.  Edges
   * span their endpoints' hypothetical (or, outside the collection,
   * current) positions.
   *
   * @param fn — one position shared by every node, or `( node, i ) =>
   *   position` evaluated per node in this collection's order
   * @returns the hypothetical box, in model coordinates
   */
  boundingBoxAt(fn: Position | ((node: Collection, i: number) => Position)): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    w: number;
    h: number;
  };
  /**
   * Node dimensions for layout spacing, as v3's layoutDimensions.
   *
   * @param options — `{ nodeDimensionsIncludeLabels }` to measure the
   *   label box too rather than the node body alone
   * @returns the first element's `{ w, h }`
   */
  layoutDimensions(options?: {
    nodeDimensionsIncludeLabels?: boolean;
  }): {
    w: number;
    h: number;
  };
  /**
   * Apply a layout's position function to this collection's nodes with the
   * standard layout options (spacingFactor, transform, fit/zoom/pan, animate)
   * and the layoutstart/layoutready/layoutstop event flow — v3's helper.
   * With `animate: true` the viewport animates concurrently (a fit targets
   * the bounding box at the *final* positions, as v3 does).
   *
   * @param layout — the layout instance the lifecycle events carry as
   *   `event.layout`; it is not called back, only reported
   * @param options — the standard layout options (`spacingFactor`,
   *   `transform`, `fit`/`padding`, `zoom`/`pan`, `animate`,
   *   `animationDuration`, `animateFilter`)
   * @param fn — `( node, i ) => position`, evaluated once per positioned
   *   node; parents are excluded (auto-bounds derive them)
   * @returns this collection, for chaining
   */
  layoutPositions(layout: object, options: LayoutBaseOptions, fn: (node: Collection, i: number) => Position): this;
  /**
   * A layout scoped to this collection.
   *
   * @param options — the layout options, as `cy.layout()`; `eles` is set
   *   to this collection
   * @returns the layout instance; nothing runs until `run()`
   */
  layout(options: LayoutOptions): ReturnType<Core['layout']>;
  makeLayout: this['layout'];
  createLayout: this['layout'];
  /**
   * Breadth-first search from one or more roots over this collection's
   * subgraph, walking slot-native over the CSR adjacency.
   *
   * @param args — v3's option shape (`{ roots, visit, directed }`) or the
   *   positional form; `roots` is a **collection**, since v4 has no
   *   selector strings
   * @returns `{ path, found }`
   */
  breadthFirstSearch(...args: SearchArgs): SearchResult;
  /**
   * Depth-first search from one or more roots.  Same options as
   * `breadthFirstSearch`.
   *
   * @param args — `{ roots, visit, directed }` or the positional form
   * @returns `{ path, found }`
   */
  depthFirstSearch(...args: SearchArgs): SearchResult;
  bfs: this['breadthFirstSearch'];
  dfs: this['depthFirstSearch'];
  /**
   * Dijkstra shortest paths from a root over non-negative weights.
   *
   * @param args — `{ root, weight, directed }`; `weight` is a plain
   *   function `( edge ) => number`
   * @returns `{ distanceTo, pathTo }`
   */
  dijkstra(...args: DijkstraArgs): DijkstraResult;
  /**
   * A* shortest path between two nodes.
   *
   * @param options — `{ root, goal, weight, heuristic, directed }`, with
   *   `weight` and `heuristic` as plain functions
   * @returns `{ found, distance, path }`
   */
  aStar(options?: AStarOptions): AStarResult;
  /**
   * Bellman–Ford shortest paths, which unlike Dijkstra tolerates
   * negative weights and reports negative cycles.
   *
   * @param options — `{ root, weight, directed }`
   * @returns `{ distanceTo, pathTo, hasNegativeWeightCycle, negativeWeightCycles }`
   */
  bellmanFord(options?: BellmanFordOptions): BellmanFordResult;
  /**
   * Floyd–Warshall all-pairs shortest paths.  O(n³) — for a single
   * source prefer `dijkstra`/`bellmanFord`.  Async (round 65): the
   * expensive whole-graph tier returns promises, and `executor`
   * ('cpu' | 'gpu' | 'auto', default 'auto') picks where the maths
   * runs; 'cpu' is the reproducible reference.
   *
   * @param options — `{ weight, directed, executor }`
   * @returns a promise of the `{ distance, path }` accessors
   * @throws if `executor` is invalid; rejects if `executor: 'gpu'` is
   *   unavailable in this environment
   */
  floydWarshall(options?: FloydWarshallOptions): Promise<FloydWarshallResult>;
  /**
   * Kruskal's minimum spanning tree/forest.
   *
   * @param weight — `( edge ) => number`; defaults to unit weights
   * @returns the spanning forest's nodes and edges
   */
  kruskal(weight?: WeightFn): Collection;
  /**
   * Tarjan's strongly connected components.  Implemented iteratively, so
   * deep graphs cannot overflow the JS stack.
   *
   * @returns `{ components, cut }`
   */
  tarjanStronglyConnected(): TarjanStronglyConnectedResult;
  tsc: this['tarjanStronglyConnected'];
  tscc: this['tarjanStronglyConnected'];
  tarjanStronglyConnectedComponents: this['tarjanStronglyConnected'];
  /**
   * Hopcroft–Tarjan biconnected components and articulation points.
   *
   * @returns `{ components, cut }`
   */
  hopcroftTarjanBiconnected(): HopcroftTarjanBiconnectedResult;
  htbc: this['hopcroftTarjanBiconnected'];
  htb: this['hopcroftTarjanBiconnected'];
  hopcroftTarjanBiconnectedComponents: this['hopcroftTarjanBiconnected'];
  /**
   * Hierholzer's Eulerian path/circuit.
   *
   * @param args — `{ root }` or the positional form
   * @returns `{ found, trail }`
   */
  hierholzer(...args: HierholzerArgs): HierholzerResult;
  /**
   * Karger–Stein randomized minimum cut.  Randomized, so repeated runs
   * may differ.
   *
   * @returns `{ cut, components, partition1, partition2 }`
   */
  kargerStein(): KargerSteinResult;
  /**
   * PageRank over the (directed) subgraph.  Async (round 65): returns a
   * promise, and `executor` ('cpu' | 'gpu' | 'auto', default 'auto')
   * picks where the power method runs; 'cpu' is the reproducible
   * reference.
   *
   * @param options — `{ dampingFactor, precision, iterations, executor }`
   * @returns a promise of `{ rank }`, a per-node accessor
   * @throws if `executor` is invalid; rejects if `executor: 'gpu'` is
   *   unavailable in this environment
   */
  pageRank(options?: PageRankOptions): Promise<PageRankResult>;
  /**
   * Degree centrality of one node relative to the collection.
   *
   * @param options — `{ root, weight, alpha, directed }`
   * @returns `{ degree }`, or `{ indegree, outdegree }` when directed
   */
  degreeCentrality(options?: DegreeCentralityOptions): DegreeCentralityResult;
  dc: this['degreeCentrality'];
  /**
   * Degree centrality for every node, normalized to [0, 1].
   *
   * @param options — `{ weight, alpha, directed }`
   * @returns a `degree` accessor, or `indegree`/`outdegree` when
   *   directed
   */
  degreeCentralityNormalized(options?: DegreeCentralityOptions): DegreeCentralityNormalizedResult;
  dcn: this['degreeCentralityNormalized'];
  degreeCentralityNormalised: this['degreeCentralityNormalized'];
  /**
   * Closeness centrality of one node — the reciprocal of its summed
   * shortest-path distances to the rest of the collection.
   *
   * @param options — `{ root, weight, directed, harmonic }`
   * @returns the closeness score
   */
  closenessCentrality(options?: ClosenessCentralityOptions): number;
  cc: this['closenessCentrality'];
  /**
   * Closeness centrality for every node, normalized to [0, 1].
   *
   * @param options — `{ weight, directed, harmonic }`
   * @returns a `closeness` accessor
   */
  closenessCentralityNormalized(options?: ClosenessCentralityOptions): ClosenessCentralityNormalizedResult;
  ccn: this['closenessCentralityNormalized'];
  closenessCentralityNormalised: this['closenessCentralityNormalized'];
  /**
   * Betweenness centrality — how often each node lies on shortest paths
   * between other pairs.  Async (round 65): returns a promise, and
   * `executor` ('cpu' | 'gpu' | 'auto', default 'auto') picks where the
   * Brandes sweep runs.  Weighted runs have no GPU path: 'auto' uses
   * the CPU and an explicit 'gpu' rejects.
   *
   * @param options — `{ weight, directed, executor }`
   * @returns a promise of the `{ betweenness, betweennessNormalized }`
   *   accessors
   * @throws if `executor` is invalid; rejects if `executor: 'gpu'` is
   *   unavailable or the run is weighted
   */
  betweennessCentrality(options?: BetweennessCentralityOptions): Promise<BetweennessCentralityResult>;
  bc: this['betweennessCentrality'];
  /**
   * k-means clustering in attribute space.  Like v3's clustering
   * algorithms this works on handles and `attributes` accessors rather
   * than on graph structure.
   *
   * Async (round 65): returns a promise, and `executor`
   * ('cpu' | 'gpu' | 'auto', default 'auto') picks where the iteration
   * runs; 'cpu' is the reproducible reference.
   *
   * @param options — `{ k, attributes, distance, maxIterations,
   *   sensitivityThreshold, executor }`, with `attributes` as plain
   *   functions
   * @returns a promise of one collection per cluster
   * @throws if `executor` is invalid; rejects if `executor: 'gpu'` is
   *   unavailable in this environment
   */
  kMeans(options?: KClusteringOptions): Promise<Collection[]>;
  /**
   * k-medoids clustering — like k-means, but cluster centres are actual
   * elements, which makes it robust to outliers.  Async, with the same
   * `executor` contract as `kMeans`.
   *
   * @param options — as `kMeans`
   * @returns a promise of one collection per cluster
   * @throws if `executor` is invalid; rejects if `executor: 'gpu'` is
   *   unavailable, or if `k` exceeds the node count
   */
  kMedoids(options?: KClusteringOptions): Promise<Collection[]>;
  /**
   * Fuzzy c-means clustering: each element gets a degree of membership
   * in every cluster rather than one hard assignment.  Async, with the
   * same `executor` contract as `kMeans`.
   *
   * @param options — as `kMeans`, plus the fuzziness exponent
   * @returns a promise of `{ clusters, degreeOfMembership }`
   * @throws if `executor` is invalid; rejects if `executor: 'gpu'` is
   *   unavailable in this environment
   */
  fuzzyCMeans(options?: KClusteringOptions): Promise<FuzzyCMeansResult>;
  fcm: this['fuzzyCMeans'];
  /**
   * Agglomerative hierarchical clustering.  Async (round 65): returns a
   * promise, and `executor` ('cpu' | 'gpu' | 'auto', default 'auto')
   * picks where the distance matrix is built; the merge chain itself is
   * sequential and always runs on the CPU.
   *
   * @param options — `{ attributes, distance, linkage, mode,
   *   dendrogramDepth, executor }`
   * @returns a promise of one collection per cluster
   * @throws if `executor` is invalid; rejects if `executor: 'gpu'` is
   *   unavailable in this environment
   */
  hierarchicalClustering(options?: HierarchicalClusteringOptions): Promise<Collection[]>;
  hca: this['hierarchicalClustering'];
  /**
   * Markov clustering (MCL) — flow simulation over the graph, so unlike
   * the attribute-space algorithms this one clusters by structure.
   *
   * Async (round 65): returns a promise, and `executor`
   * ('cpu' | 'gpu' | 'auto', default 'auto') picks where the
   * expand/inflate iteration runs; 'cpu' is the reproducible reference.
   *
   * @param options — `{ attributes, expandFactor, inflateFactor,
   *   multFactor, maxIterations, executor }`
   * @returns a promise of one collection per cluster
   * @throws if `executor` is invalid; rejects if `executor: 'gpu'` is
   *   unavailable in this environment
   */
  markovClustering(options?: MarkovClusteringOptions): Promise<Collection[]>;
  mcl: this['markovClustering'];
  /**
   * Affinity propagation, which picks exemplars by message passing and
   * so needs no target cluster count.
   *
   * Async (round 65): returns a promise, and `executor`
   * ('cpu' | 'gpu' | 'auto', default 'auto') picks where the message
   * passing runs; 'cpu' is the reproducible reference.
   *
   * @param options — `{ attributes, distance, preference, damping,
   *   minIterations, maxIterations, executor }`
   * @returns a promise of one collection per cluster
   * @throws if `executor` is invalid; rejects if `executor: 'gpu'` is
   *   unavailable, or if `damping`/`preference` are invalid
   */
  affinityPropagation(options?: AffinityPropagationOptions): Promise<Collection[]>;
  ap: this['affinityPropagation'];
  /**
   * The **first** element's total degree, in + out, answered in O(1) off
   * the adjacency index.
   *
   * This is a singular accessor, as in v3 — it reports one node's
   * degree, not a collection-wide figure.  For the sum over the whole
   * collection use `totalDegree()`.
   *
   * @param includeLoops — whether self-loops count (each contributes 2)
   * @returns the degree, or undefined when the first element is not a
   *   live node
   */
  degree(includeLoops?: boolean): number | undefined;
  /**
   * The first element's out-degree, in O(1).  Singular, like `degree()`.
   *
   * @param includeLoops — whether self-loops count
   * @returns the out-degree, or undefined when not a live node
   */
  outdegree(includeLoops?: boolean): number | undefined;
  /**
   * The first element's in-degree, in O(1).  Singular, like `degree()`.
   *
   * @param includeLoops — whether self-loops count
   * @returns the in-degree, or undefined when not a live node
   */
  indegree(includeLoops?: boolean): number | undefined;
  /**
   * The smallest total degree among the collection's nodes.
   *
   * @param includeLoops — whether self-loops count
   * @returns the minimum degree, or undefined when there are no nodes
   */
  minDegree(includeLoops?: boolean): number | undefined;
  /**
   * The largest total degree among the collection's nodes.
   *
   * @param includeLoops — whether self-loops count
   * @returns the maximum degree, or undefined when there are no nodes
   */
  maxDegree(includeLoops?: boolean): number | undefined;
  /**
   * The smallest in-degree among the collection's nodes.
   *
   * @param includeLoops — whether self-loops count
   * @returns the minimum in-degree, or undefined when there are no nodes
   */
  minIndegree(includeLoops?: boolean): number | undefined;
  /**
   * The largest in-degree among the collection's nodes.
   *
   * @param includeLoops — whether self-loops count
   * @returns the maximum in-degree, or undefined when there are no nodes
   */
  maxIndegree(includeLoops?: boolean): number | undefined;
  /**
   * The smallest out-degree among the collection's nodes.
   *
   * @param includeLoops — whether self-loops count
   * @returns the minimum out-degree, or undefined when there are no
   *   nodes
   */
  minOutdegree(includeLoops?: boolean): number | undefined;
  /**
   * The largest out-degree among the collection's nodes.
   *
   * @param includeLoops — whether self-loops count
   * @returns the maximum out-degree, or undefined when there are no
   *   nodes
   */
  maxOutdegree(includeLoops?: boolean): number | undefined;
  /**
   * The summed degree of every node in the collection — the
   * whole-collection figure that `degree()` deliberately is not.
   *
   * @param includeLoops — whether self-loops count
   * @returns the total degree (0 when there are no nodes)
   */
  totalDegree(includeLoops?: boolean): number;
  private _degreeBound;
  private _degree;
  /**
   * Listen for events on each element of this collection.  The handler
   * is bound per element, and keeps firing across slot compaction —
   * listeners repair with their elements rather than going stale.
   *
   * Events bubble from an element through its compound ancestors to the
   * core (round 14.5), with `stopPropagation()` honoured.
   *
   * **Any name registers**, as on the core and for the same reason — custom
   * events are supported API (`ele.emit( 'foo' )`), so names cannot be gated.
   * A name v4 never emits registers cleanly and never fires: that is v3's
   * `vmouse*` aliases and its raw mouse/touch re-emits — and, since round
   * 41.2, any name containing a dot: there is no namespace machinery, so
   * `'data.ns'` is a literal type v4 never raises.  See `Core#on`.
   *
   * @param events — one or more space-separated event names
   * @param callback — the handler
   * @returns this collection, for chaining
   */
  on(events: string, callback?: EventHandler): this;
  addListener: this['on'];
  /**
   * Like `on()`, but each element's handler runs at most once.
   *
   * @param events — one or more space-separated event names
   * @param callback — the handler
   * @returns this collection, for chaining
   */
  one(events: string, callback?: EventHandler): this;
  once: this['one'];
  listen: this['on'];
  bind: this['on'];
  /**
   * Stop listening on each element of this collection.
   *
   * @param events — one or more space-separated event names
   * @param callback — the handler to remove; omit to remove every
   *   handler these elements have for `events`
   * @returns this collection, for chaining
   */
  off(events: string, callback?: EventHandler): this;
  removeListener: this['off'];
  unlisten: this['off'];
  unbind: this['off'];
  /**
   * Emit an event on each element, bubbling through compound ancestors
   * to the core.
   *
   * @param events — one or more space-separated event names
   * @param extraParams — extra arguments passed to each handler after
   *   the event object
   * @returns this collection, for chaining
   */
  emit(events: string, extraParams?: unknown[]): this;
  trigger: this['emit'];
  /**
   * Resolve once the next matching event fires on any element of this
   * collection — the promise form of `one()`.
   *
   * @param events — one or more space-separated event names
   * @returns a promise for the event object
   */
  promiseOn(events: string): Promise<Event>;
  pon: this['promiseOn'];
}
//#endregion
//#region src/events.d.mts
/** A delegation predicate over an element event target. */
type ElePredicate = (ele: Collection) => boolean;
/** What a listener is restricted to: a single element ref, or a predicate. */
interface Qualifier {
  key?: string;
  ref?: Ref;
  fn?: ElePredicate;
}
//#endregion
//#region src/layout/contract.d.mts
interface LayoutImpl {
  run(ctx: LayoutContext): void | Promise<void>;
  stop?(): void;
}
declare class LayoutContext {
  /** the core being laid out */
  readonly cy: Core;
  /** the resolved layout options (custom knobs included) */
  readonly options: CustomLayoutOptions;
  private _eles;
  private _nodes;
  /**
   * The layout scope (handles tier); the whole graph unless this run
   * came from `eles.layout()`.
   *
   * **Lazy since round 34.4.**  It used to be assigned in the
   * constructor, which meant every run of every layout materialized
   * `cy.elements()` — a handle per element — including for the
   * columnar-first layouts this contract exists to encourage, which
   * never touch it.  That cost 333 µs per run at 25k elements for an
   * impl that does nothing.  Reading it still costs what it always did;
   * not reading it is now free.
   *
   * @returns the scope's handles — `eles.layout()`'s collection, or the
   *   whole graph's elements when the layout was started from the core.
   *   Materialized on first read and cached for the run
   */
  get eles(): Collection;
  /**
   * The scope's node handles (lazy — see `eles`).
   *
   * @returns the node subset of `eles`, *unfiltered* — unlike
   *   `nodeSlots()`, this keeps locked nodes and compound parents, so a
   *   layout iterating it must apply its own rules
   */
  get nodes(): Collection;
  /** the discrete finisher ran: its lifecycle covers the run */
  _finisherUsed: boolean;
  private layout;
  private slots;
  /**
   * Built by the wrapper, once per run — a layout impl receives one of
   * these and never constructs it.
   *
   * @param cy — the core being laid out
   * @param layout — the wrapper, passed through as `event.layout` on the
   *   lifecycle events
   * @param options — the resolved layout options; `eles` narrows the
   *   scope (from `eles.layout()`), defaulting to the whole graph
   */
  constructor(cy: Core, layout: object, options: CustomLayoutOptions);
  /**
   * The slots to lay out: the scope's nodes, pre-filtered to unlocked
   * leaves (locked nodes hold their place; parents derive from their
   * placed children — round 14.11).  Scope order.
   *
   * @returns the slots to place, in exactly `cy.nodes()` order — which is
   *   load-bearing rather than incidental, since grid and circle assign
   *   positions by index, so a different enumeration order is a different
   *   layout
   */
  nodeSlots(): number[];
  /**
   * The scope's edge slots.
   *
   * @returns every live edge of the scope in `cy.edges()` order, with no
   *   filtering — the counterpart of `nodeSlots()`, which does filter
   */
  edgeSlots(): number[];
  /**
   * The live position column (x,y interleaved by slot) — read it, write
   * through `setPositions`.
   *
   * @returns the store's own column, not a copy: it changes underneath a
   *   held reference as positions are written, and writing into it
   *   directly bypasses the dirty tracking the renderer depends on
   */
  positions(): Float32Array;
  /**
   * The live edge endpoint column (source,target node slots).
   *
   * @returns the store's own column, indexed by edge slot — node *slots*,
   *   not ids, so it pairs directly with `positions()` without a lookup
   */
  endpoints(): Uint32Array;
  /**
   * O(1) degree off the CSR adjacency.
   *
   * @param slot — a node slot, as handed out by `nodeSlots()`
   * @returns its whole-graph degree, loops counted as v3 counts them
   */
  degreeOf(slot: number): number;
  /**
   * The scope's current bounding box, labels included.
   *
   * @returns `{ x1, y1, x2, y2, w, h }` in model coordinates
   */
  boundingBox(): ReturnType<Collection['boundingBox']>;
  /**
   * The viewport width in CSS px — what a layout sizing itself to the
   * screen should use.  Headless instances report the configured
   * headless width, so a layout still works without a DOM.
   *
   * @returns the viewport width
   */
  width(): number;
  /**
   * The viewport height in CSS px.
   *
   * @returns the viewport height
   */
  height(): number;
  /**
   * The bulk write: xy[i*2], xy[i*2+1] land on slots[i] — one dirty
   * span, no handles (the round-5 slot path; under compounds it takes
   * the per-slot sequential path so auto-bounds stay exact).
   *
   * @param slots — the node slots to move
   * @param xy — the packed positions: `xy[i*2]`, `xy[i*2+1]` land on
   *   `slots[i]`
   */
  setPositions(slots: number[], xy: number[] | Float32Array): void;
  /**
   * The discrete finisher: v3's layoutPositions plumbing over the
   * scope — spacingFactor, transform, animate (with the
   * fit-at-final-positions viewport animation), fit/zoom/pan, and the
   * layoutready/layoutstop events.  The wrapper's layoutstart covers
   * the start (no double emit).
   *
   * @param fn — called per scoped node with the node and its index,
   *   returning the model position to place it at
   */
  layoutPositions(fn: (node: Collection, i: number) => Position): void;
}
/** The wrapper cy.layout({ impl }) returns: the builtins' shape plus
 * promise() (resolves at this run's layoutstop). */
declare class CustomLayout {
  /** the resolved options this run was created with */
  options: CustomLayoutOptions;
  private cy;
  private impl;
  private donePromise;
  /**
   * Wrap a layout impl.  Reached through `cy.layout( { impl } )` /
   * `eles.layout( { impl } )` rather than constructed directly.
   *
   * @param cy — the core to lay out
   * @param options — must carry `impl`, a class constructed with no
   *   arguments or a plain object, implementing `{ run( ctx ), stop?() }`
   * @throws if `impl` is missing, or does not implement `run( ctx )`
   */
  constructor(cy: Core, options: CustomLayoutOptions);
  /**
   * Start the layout.  Emits `layoutstart` on the core, calls
   * `impl.run( ctx )` and awaits it if it returns a promise (the shape a
   * GPU-resident layout needs).
   *
   * The lifecycle fires exactly once per run either way: an impl that
   * finishes through `ctx.layoutPositions()` lets the finisher emit
   * `layoutready`/`layoutstop`, and one that writes positions directly
   * has them emitted here instead.
   *
   * @returns this layout, for chaining; await `promise()` for
   *   completion
   */
  run(): this;
  /** Resolves at this run's layoutstop (immediately when never run). */
  promise(): Promise<void>;
  /**
   * Ask the layout to stop early, by calling the impl's optional
   * `stop()`.  An impl without one simply runs to completion.
   *
   * @returns this layout, for chaining
   */
  stop(): this;
}
//#endregion
//#region src/layout/grid.d.mts
/**
 * Place nodes on a regular grid, sized to fit the viewport or an explicit `boundingBox`.
 *
 * The cell-packing maths is v3's verbatim.  The default path never materializes element handles — cells come off the size and border columns by slot and land in one bulk `setPositions` write; the `sort` and `position` callbacks, which take handles by contract, fall back to the per-element path.
 */
declare class GridLayout {
  /** the resolved options this layout was created with */
  options: GridLayoutOptions;
  private cy;
  /**
   * Reached through `cy.layout( { name: 'grid' } )` /
   * `eles.layout( … )` rather than constructed directly.
   *
   * @param cy — the core to lay out
   * @param options — this layout's options merged over its defaults,
   *   plus the shared plumbing (`fit`, `padding`, `spacingFactor`,
   *   `transform`, `animate`, the lifecycle callbacks)
   */
  constructor(cy: Core, options: GridLayoutOptions);
  /**
   * Run the layout: emits `layoutstart`, writes the positions, then
   * emits `layoutready`/`layoutstop`.  Under `animate: true` the nodes
   * tween to their targets and a `fit` animates the viewport to the box
   * at the *final* positions, concurrently.
   *
   * @returns this layout, for chaining
   */
  run(): this;
  /** Columnar path: cell sizes from the size/border columns, one bulk write. */
  private runBySlot;
  /** Per-element path for the `sort`/`position` callback options and subset scopes. */
  private runWithHandles;
  /** The ported v3 grid cell-packing math, indexed by node ordinal. */
  private cellPositions;
  /** Scale positions about their bounding-box center (as v3 layoutPositions does). */
  private applySpacing;
}
//#endregion
//#region src/layout/preset.d.mts
/**
 * Place nodes at explicitly supplied positions.
 *
 * `positions` is a map from element id to `{ x, y }`, or a function of the node; nodes without a position keep the one they have.
 */
declare class PresetLayout {
  /** the resolved options this layout was created with */
  options: PresetLayoutOptions;
  private cy;
  /**
   * Reached through `cy.layout( { name: 'preset' } )` /
   * `eles.layout( … )` rather than constructed directly.
   *
   * @param cy — the core to lay out
   * @param options — this layout's options merged over its defaults,
   *   plus the shared plumbing (`fit`, `padding`, `spacingFactor`,
   *   `transform`, `animate`, the lifecycle callbacks)
   */
  constructor(cy: Core, options: PresetLayoutOptions);
  /**
   * Run the layout: emits `layoutstart`, writes the positions, then
   * emits `layoutready`/`layoutstop`.  Under `animate: true` the nodes
   * tween to their targets and a `fit` animates the viewport to the box
   * at the *final* positions, concurrently.
   *
   * @returns this layout, for chaining
   */
  run(): this;
}
//#endregion
//#region src/layout/circle.d.mts
/**
 * Place nodes evenly around a single circle.
 *
 * The radius derives from the node count and spacing unless given explicitly; `sort` controls the order around the ring.
 */
declare class CircleLayout {
  /** the resolved options this layout was created with */
  options: CircleLayoutOptions;
  private cy;
  /**
   * Reached through `cy.layout( { name: 'circle' } )` /
   * `eles.layout( … )` rather than constructed directly.
   *
   * @param cy — the core to lay out
   * @param options — this layout's options merged over its defaults,
   *   plus the shared plumbing (`fit`, `padding`, `spacingFactor`,
   *   `transform`, `animate`, the lifecycle callbacks)
   */
  constructor(cy: Core, options: CircleLayoutOptions);
  /**
   * Run the layout: emits `layoutstart`, writes the positions, then
   * emits `layoutready`/`layoutstop`.  Under `animate: true` the nodes
   * tween to their targets and a `fit` animates the viewport to the box
   * at the *final* positions, concurrently.
   *
   * @returns this layout, for chaining
   */
  run(): this;
}
//#endregion
//#region src/layout/concentric.d.mts
/**
 * Place nodes on concentric rings, most important innermost.
 *
 * `concentric` scores each node (degree by default) and `levelWidth` decides how wide a score band a ring covers.
 */
declare class ConcentricLayout {
  /** the resolved options this layout was created with */
  options: ConcentricLayoutOptions;
  private cy;
  /**
   * Reached through `cy.layout( { name: 'concentric' } )` /
   * `eles.layout( … )` rather than constructed directly.
   *
   * @param cy — the core to lay out
   * @param options — this layout's options merged over its defaults,
   *   plus the shared plumbing (`fit`, `padding`, `spacingFactor`,
   *   `transform`, `animate`, the lifecycle callbacks)
   */
  constructor(cy: Core, options: ConcentricLayoutOptions);
  /**
   * Run the layout: emits `layoutstart`, writes the positions, then
   * emits `layoutready`/`layoutstop`.  Under `animate: true` the nodes
   * tween to their targets and a `fit` animates the viewport to the box
   * at the *final* positions, concurrently.
   *
   * @returns this layout, for chaining
   */
  run(): this;
}
//#endregion
//#region src/layout/breadthfirst.d.mts
/**
 * Place nodes in hierarchical rows by breadth-first depth from the roots.
 *
 * `roots` is a collection (never a selector string); omitted, the roots are inferred.  `circle` lays the levels out as rings instead of rows.
 */
declare class BreadthFirstLayout {
  /** the resolved options this layout was created with */
  options: BreadthFirstLayoutOptions;
  private cy;
  /**
   * Reached through `cy.layout( { name: 'breadthfirst' } )` /
   * `eles.layout( … )` rather than constructed directly.
   *
   * @param cy — the core to lay out
   * @param options — this layout's options merged over its defaults,
   *   plus the shared plumbing (`fit`, `padding`, `spacingFactor`,
   *   `transform`, `animate`, the lifecycle callbacks)
   */
  constructor(cy: Core, options: BreadthFirstLayoutOptions);
  /**
   * Run the layout: emits `layoutstart`, writes the positions, then
   * emits `layoutready`/`layoutstop`.  Under `animate: true` the nodes
   * tween to their targets and a `fit` animates the viewport to the box
   * at the *final* positions, concurrently.
   *
   * @returns this layout, for chaining
   */
  run(): this;
}
//#endregion
//#region src/layout/random.d.mts
/**
 * Scatter nodes uniformly at random within the viewport or an explicit `boundingBox`.
 *
 * Useful as a starting state for a force layout that is not seeding its own.
 */
declare class RandomLayout {
  /** the resolved options this layout was created with */
  options: RandomLayoutOptions;
  private cy;
  /**
   * Reached through `cy.layout( { name: 'random' } )` /
   * `eles.layout( … )` rather than constructed directly.
   *
   * @param cy — the core to lay out
   * @param options — this layout's options merged over its defaults,
   *   plus the shared plumbing (`fit`, `padding`, `spacingFactor`,
   *   `transform`, `animate`, the lifecycle callbacks)
   */
  constructor(cy: Core, options: RandomLayoutOptions);
  /**
   * Run the layout: emits `layoutstart`, writes the positions, then
   * emits `layoutready`/`layoutstop`.  Under `animate: true` the nodes
   * tween to their targets and a `fit` animates the viewport to the box
   * at the *final* positions, concurrently.
   *
   * @returns this layout, for chaining
   */
  run(): this;
}
//#endregion
//#region src/core.d.mts
type Layout = CustomLayout | GridLayout | PresetLayout | CircleLayout | ConcentricLayout | BreadthFirstLayout | RandomLayout;
/** What the core needs from the renderer (wired by the factory), plus the
 * documented public surface reachable via `cy.renderer()` (e.g. `stats()`). */
interface RendererLike {
  destroy(): void;
  pick(x: number, y: number): Promise<Collection | null>;
  requestRender(): void;
  resize(): void;
  stats(): RendererStats;
  /** true while a GPU force-layout run owns the position column (18.3) */
  forceActive(): boolean;
  exportImage(options: ExportOptions): Promise<{
    data: Uint8ClampedArray<ArrayBuffer>;
    width: number;
    height: number;
  }>;
}
/**
 * The Core facade: the familiar synchronous core API over the columnar
 * store (#3486).  See src/README.md for the maintained API scope —
 * viewport, events, graph manipulation, compounds, style/mappers/
 * transitions, layouts, animation, algorithms, image export,
 * mount/unmount.
 */
declare class Core {
  _store: GraphStore;
  _emitter: Emitter<Core, Qualifier>;
  _styleEngine: StyleEngine;
  _renderer: RendererLike | null;
  /** the pointer handler paired with the renderer (torn down on unmount) */
  _pointer: {
    destroy(): void;
  } | null;
  /** wired by the factory: (re)attaches a renderer + pointer to a container */
  _attachFn: ((container: HTMLElement) => void) | null;
  private _recoveringDevice;
  _viewport: Viewport;
  /** resolves once the render pipeline is usable (immediately when headless) */
  ready: Promise<Core>;
  /** true once the render pipeline is usable (immediately when headless) */
  _readyResolved: boolean;
  /** interned singleton handles, dense by slot (slots are dense, so an array beats a Map) */
  _pool: {
    nodes: (Collection | undefined)[];
    edges: (Collection | undefined)[];
  };
  private _container;
  private _options;
  private _headlessWidth;
  private _headlessHeight;
  private _destroyed;
  private _idCounter;
  private _scratch;
  private _graphData;
  private _autolock;
  private _autoungrabify;
  private _autounselectify;
  private _panningEnabled;
  private _userPanningEnabled;
  private _zoomingEnabled;
  private _userZoomingEnabled;
  private _boxSelectionEnabled;
  /** box selection considers label boxes too (16.5; default off — v3).
   * Narrows a 'contain' selection, widens an 'overlap' one (39.1). */
  private _boxSelectionIncludesLabels;
  private _boxSelectionMode;
  private _selectionType;
  private _multiClickDebounceTime;
  /** round 20.1: the interaction option quartet (v3 defaults) */
  private _wheelSensitivity;
  private _wheelSensitivityWarned;
  private _desktopTapThreshold;
  private _touchTapThreshold;
  private _tapholdDuration;
  private _batchDepth;
  private _batchPending;
  /** round 34.2: the memoized unfiltered collections, keyed by store structure epoch */
  private _allCache;
  /** round 62.6: the whole-graph memo flattened to one field, so the
   * `elements()`/`mutableElements()` hit is a single load — nulled by
   * the same push-invalidation as `_allCache` */
  private _allEles;
  _animations: AnimationManager;
  /**
   * Build a core over a fresh columnar store.  Prefer the `cytoscape(
   * options )` factory: it is the documented entry point and additionally
   * ingests `options.elements`, runs `options.layout`, and attaches a
   * renderer when a `container` is given.  Constructing directly yields a
   * headless, empty instance regardless of those options.
   *
   * **Unknown options are ignored, deliberately** (decided 2026-08-04, fifth
   * design sitting).  This is the one v4 entry point that does not fail loudly
   * on a name it does not know — an unknown sheet key, style property or query
   * key all throw — because strictness here resolves at the *type* layer:
   * TypeScript's excess-property check rejects `{ motionBlur: true }` and any
   * other typo against `CytoscapeOptions`, and v4 does not replicate at
   * runtime what the build already checks.  The boundary is TypeScript's:
   * excess-property checking applies to object literals, so options assembled
   * into a variable first are widened and pass.  Pinned by the compile-only
   * consumer test in `typescript/tests/gpu.test-d.ts`.
   *
   * @param options — the instance options (see `CytoscapeOptions`);
   *   viewport, interaction-gating and interaction-tuning options are
   *   applied here, and `style` compiles immediately.  Unrecognized keys are
   *   kept as given and returned by `options()`, never validated.
   */
  constructor(options?: CytoscapeOptions);
  /**
   * Get the style engine, or set the stylesheet and return it.
   *
   * v4's sheet is a plain `{ nodes, edges, parents, core }` object of prop
   * objects — there are no selector blocks and no style functions.  All
   * per-element variation is declarative: mapper objects (`{ data, scale,
   * … }`) and `case` conditionals, which is what keeps every value
   * analyzable, serializable and GPU-evaluable.
   *
   * Inside a batch the sheet is compiled and validated immediately (so
   * errors still throw at the call site) but applied once at the outermost
   * `endBatch()`.
   *
   * @param sheet — the stylesheet to install; omit to read the engine
   * @returns the style engine (also reachable as the return value when
   *   setting, so calls chain)
   * @throws if the sheet references an unknown property or an invalid
   *   value
   */
  style(sheet?: Stylesheet): StyleEngine;
  /**
   * True while inside a startBatch()/endBatch() pair.
   *
   * @returns whether a batch is open at *any* depth — nesting is counted,
   *   and only the outermost `endBatch` flushes the deferred style work
   */
  batching(): boolean;
  /**
   * Slot-moving compaction, explicit form (round 19.5): move live
   * elements down to a dense slot prefix so `highWater`, column capacity
   * and pass-iteration widths shrink to the current graph instead of its
   * peak.  A monotone remap keeps draw order — compaction is a visual
   * no-op — and held refs/handles/listeners repair through forwarding
   * (19.3).  The automatic dead-slot-ratio trigger covers the common
   * shrink/churn profiles; this call is for deterministic timing (e.g.
   * right after a bulk filter, before an animation).  Throws mid-batch;
   * defers with a warning while a GPU force layout runs.
   */
  compact(): this;
  /**
   * v3's `cy.gc()`, kept as the spelling an upgrading app already has
   * (round 39.3).  It is an exact alias of `compact()` — the same
   * slot-moving compaction, the same triggers and the same refusals —
   * because what `gc` meant in v3 is what round 19 built.  v4 has no
   * separate garbage-collection concept for it to name: element bytes are
   * reclaimed by the slot free-list at `remove()`, and the slot-stable
   * structures self-compact on their own waste thresholds (round 11).
   *
   * @see Core#compact — the documented form, and where the semantics live
   */
  gc: this['compact'];
  /**
   * The automatic trigger (19.5), checked at safe boundaries — a
   * completed removal, the outermost endBatch: compact when a group's
   * dead slots exceed its live count (the round-11 waste-over-half
   * policy) past a floor that keeps small graphs from churning.  Defers
   * silently while batching or while a GPU force run owns positions.
   */
  _maybeCompact(): void;
  /**
   * Slot compaction, core tier (round 19.3; the public trigger policy is
   * 19.5): settle any GPU-driven tweens (the reparent precedent), compact
   * the store, then repair the core-held slot-keyed state — the interned
   * handle pool moves with its elements (handle identity and scratch
   * survive), element-bound listener qualifiers repair in place and
   * re-key so later off() calls match, and the animation queues re-key
   * with their slot arrays re-pointed.  Throws mid-batch: the deferred
   * style refs hold slots and the flush must not straddle a remap.
   */
  _compact(): void;
  /** Move the interned singleton handles to their elements' new slots
   * (dead slots' handles drop out of the pool; holders keep dead reads). */
  private _remapPool;
  /**
   * Open a batch: defer style application until the matching `endBatch()`.
   * Pairs nest — only the outermost `endBatch()` flushes.  Prefer
   * `batch( fn )`, which cannot leak a depth on an exception.
   *
   * @returns this core, for chaining
   */
  startBatch(): this;
  /**
   * Close a batch.  At the outermost close the deferred work flushes as
   * one bulk pass — filtered to elements still live, so adding and
   * removing within the same batch costs nothing — and the automatic
   * slot-compaction trigger gets its boundary check.  A sheet change
   * during the batch subsumes the per-element work: one `applyAll()`
   * covers every live element.
   *
   * Unbalanced calls are a no-op rather than an error, matching v3.
   *
   * @returns this core, for chaining
   */
  endBatch(): this;
  /**
   * Run `fn` inside a `startBatch()`/`endBatch()` pair.  The batch closes
   * even if `fn` throws, so this is the form to prefer.
   *
   * @param fn — the mutations to batch; its return value is discarded
   * @returns this core, for chaining
   */
  batch(fn: () => void): this;
  /**
   * v3 compat: per-id data() patches applied in one batch.
   *
   * @param map — element id → the data keys to merge into that element
   * @returns this core, for chaining
   */
  batchData(map: Record<string, Record<string, unknown>>): this;
  /**
   * Make a layout over the whole graph.  The layout does not run until you
   * call `.run()` on it.
   *
   * Built-ins: `grid`, `preset`, `circle`, `concentric`, `breadthfirst`,
   * `random` and `force` (the GPU-capable spring–electric layout, round
   * 18).  An external layout is passed **directly** rather than
   * registered — v4 has no `cytoscape.use` and no string registry — by
   * giving `impl`: a class or object implementing `{ run( ctx ), stop?() }`
   * (see `layout/contract.mts` for the `LayoutContext` it receives).
   *
   * Lifecycle events (`layoutstart`/`layoutready`/`layoutstop`) fire on
   * the core, once per run; layout instances are not emitters.
   *
   * @param options — `{ name }` for a built-in or `{ impl }` for an
   *   extension, plus that layout's own options and the shared
   *   `layoutPositions` plumbing (`animate`, `spacingFactor`, `transform`,
   *   `fit`, `padding`, …)
   * @returns the layout instance, unstarted
   * @throws if neither a known `name` nor an `impl` is given
   * @see Collection#layout to lay out a subset
   */
  layout(options: LayoutOptions): Layout;
  makeLayout: this['layout'];
  createLayout: this['layout'];
  /**
   * Add elements to the graph and return them as a collection.
   *
   * Takes all three input forms: the classic v3 definition form (one
   * object, an array, or `{ nodes, edges }`), the columnar bulk form
   * (typed-array columns with edge endpoints as node *indices*), and the
   * binary wire buffer produced by `serializeElements`/`cy.serialize()`.
   * Nodes are added before edges, so an edge may reference a node added in
   * the same call.
   *
   * Fires `add` per element.  Inside a batch the first style application
   * of the new elements defers to the outermost `endBatch()`, so
   * style-derived reads (`width()`, `label()`) may be stale until then.
   *
   * **Graph-level `data()` in a wire buffer is ignored here** (round
   * 39.2), where `options.elements` applies it: adding elements to a
   * populated graph must not overwrite that graph's own `data()`.  Apply
   * it explicitly with `cy.data( deserializeElements( buf ).data )` if
   * that is what you want.
   *
   * @param input — elements in definition, columnar or wire form
   * @returns a collection of the added elements
   */
  add(input: ElementsInput): Collection;
  /**
   * Bulk load path (the factory's `options.elements`): adds without
   * materializing per-element handles or a return collection — on a
   * 500k-element load the handle layer costs more than the model writes
   * and the caller uses none of it.  `add` events still fire per element
   * when anyone is listening (never the case at construction time).
   *
   * **A definition-form payload loads through the columnar ingest too**
   * (round 66): it is converted first, because convert-then-ingest is
   * cheaper than the def loop — measured 1.2-1.8x end to end, from 4k to
   * 800k elements and on the ndex-x-large renderer scene (1696 -> 980 ms).
   * The def loop pays a `Table.alloc` per element and two
   * `IdIndex` lookups per edge, where the columnar path takes one
   * contiguous `allocBulk` run and resolves endpoints by index; the
   * conversion costs about a tenth of what that saves.  The route is
   * taken only when the payload is self-contained (every edge endpoint
   * names a node in the same payload) — otherwise `buildColumnar` answers
   * null and the def path runs, and reports the error, as before.
   */
  _bulkAdd(input: ElementsInput): void;
  /** Per-element `add` for a columnar bulk, nodes before edges. */
  private _emitBulkAdds;
  /**
   * Columnar ingest: store-level bulk adds + one bulk style pass.
   *
   * The optional flag overrides come from a converted definition payload
   * — `locked`, `grabbable` and `pannable` have no column.  They are
   * written before the style pass, where the def path also has them: a
   * later write would still be *correct*, since `::locked` and
   * `::grabbable` are styleable conditions and a condition-flag write
   * restyles its slot, but it would pay for that restyle.
   */
  private _addColumnar;
  /** Write the def flags the columnar columns cannot carry. */
  private _applyFlagOverrides;
  private _columnarRefs;
  /** Shared add loop: nodes first so edges can reference same-call nodes. */
  private _addDefs;
  /**
   * `_addDefs` over defs already split by group, so the bulk load path
   * can partition once and hand the same split to whichever route it
   * takes.
   */
  private _addPartition;
  /**
   * Remove elements from the graph.  Removing a node removes its
   * connected edges, and removing a compound parent removes its
   * descendants.  Equivalent to `eles.remove()`.
   *
   * @param eles — the elements to remove
   * @returns the removed elements
   */
  remove(eles: Collection): Collection;
  /**
   * An empty collection bound to this core — the accumulator for
   * `union`/`add` chains.
   *
   * Takes **no arguments**, and throws if given any (round 64, closing
   * ledger item 28): v3's `collection( eles, opts )` also built from a
   * string, an array or a collection, so the v3-shaped call used to
   * return the empty collection *silently* — the one method boundary
   * where a typo did nothing, against the unknown-key/unknown-prop
   * throws everywhere else.  Build a set with `union()` over this
   * accumulator, or query with `cy.$( query )` / `cy.filter( query )`.
   *
   * @returns a collection of zero elements
   * @throws if called with any argument — v3's building forms are not
   *   ported; the message names the replacements
   */
  collection(): Collection;
  /**
   * Look up one element by id through the O(1) id index.
   *
   * @param id — the element id
   * @returns a collection of one element, or an empty collection when no
   *   element has that id
   */
  getElementById(id: string): Collection;
  /**
   * All elements, optionally filtered — nodes (in insertion order) then
   * edges.
   *
   * v4 has no selector strings: pass a structured **query object**
   * (`{ group, selected, parent, data: { weight: { gt: 0.5 } } }`), which
   * compiles to per-group flag tests answered by one columnar scan, or a
   * **predicate function** for anything richer.  Unknown query keys throw,
   * so a typo cannot silently match everything.
   *
   * Called with **no query**, the result is memoized until the graph
   * next gains or loses an element (round 34.2), so repeated calls are
   * O(1) and two of them return *the same collection object*.  A v4
   * collection is an immutable snapshot holding refs into the columns,
   * so it still reads live values — a style, position or data write
   * neither invalidates it nor goes unseen through it.
   *
   * @param query — a query object or an `( ele ) => boolean` predicate;
   *   omit for everything
   * @returns the matching elements
   */
  elements(query?: Query | EleFilterFn): Collection;
  /**
   * The graph's nodes, optionally filtered.  Same query forms as
   * `elements()`, restricted to the node group — and, with no query,
   * the same memo (34.2).
   *
   * @param query — a query object or an `( ele ) => boolean` predicate
   * @returns the matching nodes
   */
  nodes(query?: Query | EleFilterFn): Collection;
  /**
   * The graph's edges, optionally filtered.  Same query forms as
   * `elements()`, restricted to the edge group — and, with no query,
   * the same memo (34.2).
   *
   * @param query — a query object or an `( ele ) => boolean` predicate
   * @returns the matching edges
   */
  edges(query?: Query | EleFilterFn): Collection;
  /**
   * Filter the whole graph.  Identical to `elements( query )`, kept for
   * symmetry with `eles.filter()`.
   *
   * @param query — a query object or an `( ele ) => boolean` predicate
   * @returns the matching elements
   */
  filter(query: Query | EleFilterFn): Collection;
  $: this['filter'];
  /**
   * The unfiltered whole-graph collections (`elements()`, `nodes()`,
   * `edges()` with no query), memoized against the store's structure
   * epoch (round 34.2).
   *
   * These are the calls an app makes in a loop, and each one was an
   * O(V+E) scan plus a handle intern per element — `mutableElements()`
   * measured 121 µs at 2000 nodes against v3's 18 ns, because v3 hands
   * back a live internal collection and v4 built a fresh one every
   * time.  A v4 collection is an immutable snapshot, so the only thing
   * that can invalidate it is an element entering or leaving the graph,
   * which is exactly what the epoch counts.  Style, flag, position and
   * data writes do not move it, and a compaction does — refs would
   * self-repair anyway (19.3), but the cache drops rather than relying
   * on that.
   *
   * The visible consequence, deliberate: two calls with no structural
   * change between them now return **the same collection object**
   * where they used to return two equal ones.  Collections are
   * immutable, so nothing can observe the difference except identity
   * itself.
   */
  private _allOf;
  /**
   * Resolve a whole-graph query.  Structured queries compile to per-group
   * (mask, want) flag tests answered by one columnar scan — no element
   * handles, no per-element matching.  Predicate functions materialize
   * the group(s) and filter per element.  `restrict` narrows the result
   * to one group (for `cy.nodes(q)` / `cy.edges(q)`).
   */
  private _query;
  /**
   * Live, visible elements contained in the model-coordinate box (corners
   * in any order): the box-selection query, answered by one columnar
   * scan.  Nodes count when their bounding box lies fully inside; edges
   * when both endpoint node centers do (v3's default 'contain'
   * semantics, with straight-edge endpoints taken at the node centers).
   *
   * **`boxSelectionMode` does not reach here** (round 39.1): this stays
   * the pure geometric containment query whatever the *gesture* is set
   * to.  For the overlap question, `boxSelectionMode( 'overlap' )` and
   * drag a box, or test intersection yourself against
   * `eles.boundingBox()`.  (`boxSelectionIncludesLabels` is the one
   * interaction setting that *does* reach here: with it on, a node's
   * label box must be contained too.)
   *
   * @param x1 — one corner's model x
   * @param y1 — that corner's model y
   * @param x2 — the opposite corner's model x
   * @param y2 — that corner's model y
   * @returns the contained elements
   */
  elementsInBox(x1: number, y1: number, x2: number, y2: number): Collection;
  /**
   * The *gesture's* box query: `elementsInBox` with this instance's
   * `boxSelectionMode` applied (round 39.1).  Internal because the mode
   * is an interaction preference — the public query stays geometric, and
   * both pointer paths (mouse/pen release and the three-finger touch box)
   * come through here so they cannot drift apart.
   */
  _elementsInGestureBox(x1: number, y1: number, x2: number, y2: number): Collection;
  /** Collection of the live slots matching per-group flag tests (null matches nothing). */
  private _scanCollection;
  /**
   * Listen for events on the core.
   *
   * Delegation is **predicate-based** — there are no selector strings.
   * With a trailing callback the middle argument is a predicate over the
   * event target: `cy.on( 'tap', ele => ele.isNode(), handler )`.
   *
   * **Any name registers, and that is deliberate** (decided 2026-08-04,
   * fifth design sitting).  Custom events are supported API — `emit( 'foo' )`
   * fires handlers bound to `'foo'` — so event names cannot be validated
   * against a list without breaking them.  The consequence is worth stating
   * plainly, because it is a silent one: a name v4 never emits registers
   * cleanly and then never fires.  That covers the round-17 drops — the
   * `vmouse*` aliases and v3's raw mouse/touch re-emits (`mousedown`,
   * `click`, `touchstart`, …), for which `pointer*` is the one modern
   * spelling; `mouseover`/`mouseout` do still fire.  A ported v3 handler
   * does nothing at all rather than erroring, so port event names by the
   * vocabulary in `src/README.md` rather than by trying them.
   *
   * **Namespaces are exactly that rule, not an exception to it** (round
   * 41.2).  There is no namespace machinery: a type is matched whole, so
   * `'tap.ns'` is one literal name that `emit( 'tap' )` does not reach and
   * `off( 'tap.ns' )` removes on its own.  Until round 41 v4 imported v3's
   * emitter and so inherited v3's namespace semantics in full, against its
   * own design — measured in 37.4 and closed in 41.2.
   *
   * @param events — one or more space-separated event names
   * @param predicateOrCb — the delegation predicate when `callback` is
   *   given, otherwise the handler itself
   * @param callback — the handler, when delegating
   * @returns this core, for chaining
   * @see Core#off — removing a delegated handler takes the same
   *   `( events, predicate, handler )` triple, since predicates compare
   *   by function identity
   */
  on(events: string, callback: EventHandler): this;
  /**
   * Listen with predicate delegation: the handler runs only for events
   * whose target satisfies `predicate`.
   *
   * @param events — one or more space-separated event names
   * @param predicate — `( ele ) => boolean` over the event target; only
   *   runs for element targets
   * @param callback — the handler
   * @returns this core, for chaining
   */
  on(events: string, predicate: ElePredicate, callback: EventHandler): this;
  addListener: this['on'];
  listen: this['on'];
  bind: this['on'];
  /**
   * Like `on()`, but the handler runs at most once and then removes
   * itself.
   *
   * @param events — one or more space-separated event names
   * @param predicateOrCb — the delegation predicate when `callback` is
   *   given, otherwise the handler itself
   * @param callback — the handler, when delegating
   * @returns this core, for chaining
   */
  one(events: string, callback: EventHandler): this;
  /**
   * Like `on()` with delegation, but the handler runs at most once.
   *
   * @param events — one or more space-separated event names
   * @param predicate — `( ele ) => boolean` over the event target
   * @param callback — the handler
   * @returns this core, for chaining
   */
  one(events: string, predicate: ElePredicate, callback: EventHandler): this;
  once: this['one'];
  /**
   * Stop listening.  Removing a delegated handler takes the same
   * `( events, predicate, handler )` triple it was added with —
   * predicates compare by function identity, so the predicate must be the
   * same function object, not an equivalent one.
   *
   * @param events — one or more space-separated event names
   * @param predicateOrCb — the delegation predicate when `callback` is
   *   given, otherwise the handler itself; omit both to remove every
   *   handler for `events`
   * @param callback — the handler, when delegating
   * @returns this core, for chaining
   */
  off(events: string, callback?: EventHandler): this;
  /**
   * Remove a delegated handler.  The predicate must be the *same
   * function object* it was registered with — predicates compare by
   * identity, not by structure.
   *
   * @param events — one or more space-separated event names
   * @param predicate — the predicate the handler was added with
   * @param callback — the handler to remove
   * @returns this core, for chaining
   */
  off(events: string, predicate: ElePredicate, callback: EventHandler): this;
  removeListener: this['off'];
  unlisten: this['off'];
  unbind: this['off'];
  /**
   * Remove every listener on the core, including element-bound and
   * delegated ones.
   *
   * @returns this core, for chaining
   */
  removeAllListeners(): this;
  /**
   * Emit an event on the core.
   *
   * **Custom event names are supported API**, which is why `on()` validates
   * none: `cy.emit( 'myevent' )` runs handlers registered for `'myevent'`,
   * and the same holds on elements.  Names v4 itself never emits are
   * therefore legal to register and simply never fire — see `on()` for which
   * those are, and PLAN.md's open-call record for why no denylist exists.
   *
   * @param events — one or more space-separated event names, or an event
   *   props object
   * @param extraParams — extra arguments passed to each handler after the
   *   event object
   * @returns this core, for chaining
   */
  emit(events: string | EventProps, extraParams?: unknown[]): this;
  trigger: this['emit'];
  /**
   * Resolve once the next matching event fires — the promise form of
   * `one()`.
   *
   * @param events — one or more space-separated event names
   * @param predicate — an optional delegation predicate over the target
   * @returns a promise for the event object
   */
  promiseOn(events: string, predicate?: ElePredicate): Promise<Event>;
  pon: this['promiseOn'];
  /**
   * Get the zoom level, or set it.  Setting is a no-op while
   * `zoomingEnabled()` is false, and the level is clamped to
   * `zoomRange()`.
   *
   * @param zoom — the new level, or `{ level, position | renderedPosition }`
   *   to zoom about a fixed point; omit to read
   * @returns the current zoom when reading, this core when setting
   */
  zoom(zoom?: number | Parameters<Viewport['setZoom']>[0]): number | this;
  /**
   * Get the pan offset, or set it.  Setting is a no-op while
   * `panningEnabled()` is false.
   *
   * @param pan — the new rendered-space offset; omit to read
   * @returns the current pan when reading, this core when setting
   */
  pan(pan?: Position): Position | this;
  /**
   * Shift the pan by a delta.  A no-op while `panningEnabled()` is false.
   *
   * @param delta — the rendered-space offset to add
   * @returns this core, for chaining
   */
  panBy(delta: Position): this;
  /**
   * Pan and zoom so the given elements fill the viewport.
   *
   * Bounds **include labels by default** (round 16), so a fit never
   * clips the text it was asked to show; edge-label terms are
   * conservative, so a fit may slightly over-fit but never under-fits.
   *
   * @param eles — the elements to fit; omit for the whole graph
   * @param padding — rendered-space padding around the box
   * @returns this core, for chaining
   */
  fit(eles?: Collection, padding?: number): this;
  /**
   * Pan so the given elements are centred, leaving the zoom alone.
   * Bounds include labels, as in `fit()`.
   *
   * @param eles — the elements to centre on; omit for the whole graph
   * @returns this core, for chaining
   */
  center(eles?: Collection): this;
  centre: this['center'];
  /**
   * Animate the viewport (`pan`/`zoom`) over `duration` ms.  Element
   * animation is on the collection (`eles.animate`).  Tweens are
   * CPU-canonical; a data write / manual pan mid-animation is not
   * prevented but will be overwritten by the next tick.
   *
   * @param opts — the viewport targets (`pan`, `panBy`, `zoom`, `fit`,
   *   `center`) plus `duration`, `easing` and `complete`; `fit` beats
   *   `center` beats `panBy` beats `pan`, and `panBy` with `pan` throws
   * @returns this core, for chaining
   */
  animate(opts: AnimateOptions): this;
  /**
   * Like `animate`, but returns a handle with `play`/`stop`/`promise` —
   * the viewport counterpart of `eles.animation`.
   *
   * @param opts — as {@link animate}; the animation does not start until
   *   `play()`
   * @returns the handle
   */
  animation(opts: AnimateOptions): AnimationHandle;
  /**
   * Resolve `fit`/`center`/`panBy` targets to concrete pan/zoom at
   * creation time, as v3 does.  Precedence follows v3's override order:
   * `fit` beats `center` beats `panBy` beats an explicit `pan`.
   */
  private _resolveViewportTargets;
  /**
   * True while the viewport is animating.
   *
   * @returns whether a *viewport* animation (pan/zoom/fit/center) is
   *   running; element animations do not count here — those are
   *   `eles.animated()`
   */
  animated(): boolean;
  /**
   * Stop every running viewport animation (round 21: no queue — the v3
   * clearQueue argument is gone).
   *
   * @param jumpToEnd — apply each animation's final values instead of
   *   freezing the viewport where the tween reached
   * @returns this core, for chaining
   */
  stop(jumpToEnd?: boolean): this;
  /** Called after each animation tick: redraw, and emit viewport events while it pans/zooms. */
  private _afterAnimationTick;
  /**
   * The model-space rectangle currently visible, as
   * `{ x1, y1, x2, y2, w, h }` — the inverse of the pan/zoom transform
   * applied to the viewport box.
   *
   * @returns the visible extent in model coordinates
   * @see Core#renderedExtent for the same box in rendered coordinates
   */
  extent(): ReturnType<Viewport['extent']>;
  /**
   * The rendered (on-screen) viewport rectangle.
   *
   * @returns the container's box in rendered px, anchored at the origin —
   *   the rendered-space counterpart of `extent()`, which is the same box
   *   projected into model coordinates
   * @see Core#extent for the model-coordinate form
   */
  renderedExtent(): ReturnType<Viewport['renderedExtent']>;
  /** Rendered dimensions as { width, height }. */
  size(): {
    width: number;
    height: number;
  };
  /**
   * Get the minimum zoom, or set it.  Setting re-clamps the current zoom.
   *
   * @param zoom — the new minimum; omit to read
   * @returns the current minimum when reading, this core when setting
   */
  minZoom(zoom?: number): number | this;
  /**
   * Get the maximum zoom, or set it.  Setting re-clamps the current zoom.
   *
   * @param zoom — the new maximum; omit to read
   * @returns the current maximum when reading, this core when setting
   */
  maxZoom(zoom?: number): number | this;
  /**
   * Set both zoom bounds; accepts (min, max) or { min, max }.
   *
   * @param min — the minimum zoom, or an object carrying both bounds
   * @param max — the maximum zoom, when `min` is a number
   * @returns this core, for chaining
   */
  zoomRange(min: number | {
    min?: number;
    max?: number;
  }, max?: number): this;
  /**
   * Set zoom and/or pan together, emitting once.
   *
   * @param opts — the `zoom` and/or `pan` to apply; omitted keys are left
   *   as they are
   * @returns this core, for chaining
   */
  viewport(opts: {
    zoom?: number;
    pan?: Position;
  }): this;
  /** Reset the viewport to zoom 1, pan (0, 0). */
  reset(): this;
  /**
   * The { zoom, pan } that would fit the given elements — computed, not
   * applied.
   *
   * @param eles — the elements to fit; omit for the whole graph
   * @param padding — rendered px of margin to leave on every side
   * @returns the viewport, or null when there is nothing to fit
   */
  getFitViewport(eles?: Collection, padding?: number): {
    zoom: number;
    pan: Position;
  } | null;
  /**
   * The pan that would center the given elements.
   *
   * @param eles — the elements to center; omit for the whole graph
   * @param zoom — the zoom to center at; defaults to the current one
   * @returns the pan, or null when there is nothing to center
   */
  getCenterPan(eles?: Collection, zoom?: number): Position | null;
  /**
   * Async GPU pick at a rendered (CSS px) position; resolves with the
   * element under the point or null (always null when headless).
   *
   * Exact: a hit is a point on the drawn element.  The pointer gestures
   * additionally apply v3's hit halos (8 rendered px around edges for a
   * mouse, 24 for touch; 2/8 around nodes — round 57.9), so a press can
   * land where this method answers null; the halo belongs to the
   * gesture, not the API.
   *
   * @param x — rendered (CSS px) x, relative to the container
   * @param y — rendered (CSS px) y
   * @returns the element under the point, or null
   */
  pick(x: number, y: number): Promise<Collection | null>;
  /**
   * The renderer, or null when headless.  Its `stats()` carry the frame
   * timings, cache hit rates and pass counters — note that `cpuFrameMs`
   * is encode/submit cost only (submission is fire-and-forget), so
   * reconcile fps against `gpuFrameMs`.
   *
   * @returns the renderer, or null on a headless instance
   */
  renderer(): RendererLike | null;
  /** Force a redraw next frame (no-op when headless; the loop is render-on-dirty). */
  forceRender(): this;
  /** Re-measure the container and redraw (no-op when headless). */
  resize(): this;
  invalidateSize: this['resize'];
  /**
   * Run a callback after each rendered frame — sugar for
   * `on( 'render', … )`.  With no animation queue and no `step` callback,
   * this plus animation promises is how v4 observes progress.
   *
   * @param callback — the per-frame handler
   * @returns this core, for chaining
   */
  onRender(callback: EventHandler): this;
  /**
   * Stop running a per-frame callback.
   *
   * @param callback — the handler to remove; omit to remove all of them
   * @returns this core, for chaining
   */
  offRender(callback?: EventHandler): this;
  /**
   * Export the rendered graph as a PNG.  Async — the pixels live on the
   * GPU (offscreen render + readback), unlike v3's synchronous base64
   * form; every output form resolves through the returned promise.
   * Options as in v3: `bg`, `full`, `scale` or `maxWidth`/`maxHeight`,
   * `output` ('base64uri' default | 'base64' | 'blob'; 'blob-promise' is
   * an accepted alias of 'blob').  Headless instances reject — there is
   * no renderer to export from.
   *
   * @param options — the v3 export options named above
   * @returns the encoded image in the requested output form
   */
  png(options?: ExportOptions): Promise<string | Blob>;
  /**
   * Export as JPEG: as {@link png}, plus `quality` (0..1) and a white
   * default `bg` (JPEG has no alpha channel).
   *
   * @param options — as {@link png}, plus `quality`
   * @returns the encoded image in the requested output form
   */
  jpg(options?: ExportOptions): Promise<string | Blob>;
  jpeg: this['jpg'];
  private _exportImage;
  /**
   * Graph-level data — read all, read one key, or write.  This is a plain
   * object, not a columnar sidecar (which is `ele.data()`).  It **is**
   * carried by the wire format since round 39.2: `serialize()` writes it
   * and `options.elements` applies it, while `cy.add( buffer )`
   * deliberately ignores it.  Writing emits `data`.
   *
   * @param args — `()` for the whole object, `( key )` to read one,
   *   `( key, value )` or `( patchObject )` to write
   * @returns the data object or value when reading, this core when
   *   writing
   */
  data(...args: [] | [string] | [string, unknown] | [Record<string, unknown>]): unknown;
  /**
   * Delete graph-level data keys.  Emits `data` when anything was
   * removed.
   *
   * @param names — space-separated key names; omit to clear everything
   * @returns this core, for chaining
   */
  removeData(names?: string): this;
  attr: this['data'];
  removeAttr: this['removeData'];
  /**
   * Graph-level scratchpad — like `data()`, but for transient state that
   * is never exported and never emits.  Namespace your keys (an
   * extension convention: `'_myExtension'`).
   *
   * @param args — `()` for the whole object, `( key )` to read one,
   *   `( key, value )` or `( patchObject )` to write
   * @returns the scratch object or value when reading, this core when
   *   writing
   */
  scratch(...args: [] | [string] | [string, unknown] | [Record<string, unknown>]): unknown;
  /**
   * Delete graph-level scratch keys.
   *
   * @param names — space-separated key names; omit to clear everything
   * @returns this core, for chaining
   */
  removeScratch(names?: string): this;
  private _objectAccess;
  private _objectRemove;
  /**
   * Get or set whether every node is locked (immovable) regardless of its
   * own `locked` flag — the graph-wide override.
   *
   * @param bool — the new setting; omit to read
   * @returns the current setting when reading, this core when setting
   */
  autolock(bool?: boolean): boolean | this;
  /**
   * Get or set whether every node is ungrabbable regardless of its own
   * `grabbable` flag.  Unlike `autolock()`, this blocks only user
   * dragging; programmatic position writes still apply.
   *
   * @param bool — the new setting; omit to read
   * @returns the current setting when reading, this core when setting
   */
  autoungrabify(bool?: boolean): boolean | this;
  /**
   * Get or set whether every element is unselectable regardless of its
   * own `selectable` flag.  Programmatic `select()` still applies.
   *
   * @param bool — the new setting; omit to read
   * @returns the current setting when reading, this core when setting
   */
  autounselectify(bool?: boolean): boolean | this;
  autolockNodes: this['autolock'];
  autoungrabifyNodes: this['autoungrabify'];
  /**
   * Get or set whether panning is allowed at all — programmatic `pan()`
   * included.  Use `userPanningEnabled()` to block only the gesture.
   *
   * @param bool — the new setting; omit to read
   * @returns the current setting when reading, this core when setting
   */
  panningEnabled(bool?: boolean): boolean | this;
  /**
   * Get or set whether the user may pan by dragging.  Programmatic
   * `pan()` is unaffected.
   *
   * @param bool — the new setting; omit to read
   * @returns the current setting when reading, this core when setting
   */
  userPanningEnabled(bool?: boolean): boolean | this;
  /**
   * Get or set whether zooming is allowed at all — programmatic `zoom()`
   * included.  Use `userZoomingEnabled()` to block only the gesture.
   *
   * @param bool — the new setting; omit to read
   * @returns the current setting when reading, this core when setting
   */
  zoomingEnabled(bool?: boolean): boolean | this;
  /**
   * Get or set whether the user may zoom by wheel or pinch.
   * Programmatic `zoom()` is unaffected.
   *
   * @param bool — the new setting; omit to read
   * @returns the current setting when reading, this core when setting
   */
  userZoomingEnabled(bool?: boolean): boolean | this;
  /**
   * Whether box selection considers label boxes as well as node bodies
   * (round 16.5; v3's box-select-labels, reshaped as a core option —
   * default off).  Its sense **follows `boxSelectionMode`**: under
   * `'contain'` the label box must *also* be inside the band, under
   * `'overlap'` a label that merely crosses the band is *enough*.
   *
   * @param bool — the setting to apply; omit to read it
   * @returns the setting, or this when setting
   */
  boxSelectionIncludesLabels(bool?: boolean): boolean | this;
  /**
   * What the box-selection gesture counts as caught: `'contain'`
   * (default, v3's) selects only elements wholly inside the band;
   * `'overlap'` selects anything the band touches — a node whose box
   * intersects it, an edge any part of whose drawn path crosses it.
   * Round 39.1.
   *
   * Two notes on the boundary.  This setting is read by the **gesture**
   * only: `cy.elementsInBox()` stays the pure geometric containment
   * query it has always been, so a programmatic caller's results do not
   * change under *this* setting.  And
   * `boxSelectionIncludesLabels` reverses sense with the mode, because
   * it can only mean one thing in each: under 'contain' the label box
   * must *also* be inside, under 'overlap' a label that crosses the band
   * is *enough*.
   *
   * @param mode — the mode to set; omit to read the current one
   * @returns the mode, or this when setting
   * @throws if `mode` is neither 'contain' nor 'overlap'
   */
  boxSelectionMode(mode?: BoxSelectionMode): BoxSelectionMode | this;
  /**
   * Get or set whether the box-selection gesture is available.
   *
   * @param bool — the new setting; omit to read
   * @returns the current setting when reading, this core when setting
   */
  boxSelectionEnabled(bool?: boolean): boolean | this;
  /**
   * How user selection composes: 'single' (a tap or box replaces the
   * selection) or 'additive' (taps toggle and boxes add, as if a
   * multiple-select key were always held).
   *
   * @param type — the mode to set; omit to read the current one
   * @returns the mode, or this when setting
   * @throws if `type` is neither 'single' nor 'additive'
   */
  selectionType(type?: 'single' | 'additive'): ('single' | 'additive') | this;
  /**
   * The dbltap/onetap debounce window in ms (v3 parity; default 250).
   *
   * @param ms — the window to set; omit to read it
   * @returns the window, or this when setting
   * @throws if `ms` is not a finite non-negative number
   */
  multiClickDebounceTime(ms?: number): number | this;
  /**
   * Wheel-zoom sensitivity: a multiplier on the zoom-per-wheel-tick
   * exponent (v3 parity; default 1).  Non-default values warn once per
   * instance, as v3 does — a custom sensitivity tuned on one mouse/OS
   * zooms unnaturally on others.
   *
   * @param mult — the multiplier to set; omit to read it
   * @returns the multiplier, or this when setting
   * @throws if `mult` is not a finite positive number (0 would freeze the
   *   zoom, so the bound is strict where the threshold setters allow 0)
   */
  wheelSensitivity(mult?: number): number | this;
  /**
   * Css px a mouse/pen press may move and still count as a tap (v3 parity;
   * default 4).
   *
   * @param px — the threshold to set; omit to read it
   * @returns the threshold, or this when setting
   * @throws if `px` is not a finite non-negative number
   */
  desktopTapThreshold(px?: number): number | this;
  /**
   * Css px a touch press may move and still count as a tap (v3 parity;
   * default 8).
   *
   * @param px — the threshold to set; omit to read it
   * @returns the threshold, or this when setting
   * @throws if `px` is not a finite non-negative number
   */
  touchTapThreshold(px?: number): number | this;
  /**
   * Unmoved-press duration before 'taphold' fires, ms (default 500 — v3's
   * constant, configurable in v4).
   *
   * @param ms — the duration to set; omit to read it
   * @returns the duration, or this when setting
   * @throws if `ms` is not a finite non-negative number
   */
  tapholdDuration(ms?: number): number | this;
  /**
   * The type tag `'core'` — the counterpart of a collection's
   * `'collection'`, for code that accepts either.
   *
   * @returns `'core'`
   */
  instanceString(): string;
  /**
   * Whether the render pipeline is usable yet.  Always true on a headless
   * instance; on a rendered one this flips when `cy.ready` resolves.
   *
   * @returns true once rendering can proceed
   */
  isReady(): boolean;
  /**
   * Whether this instance has no container and therefore no GPU — the
   * Node-testable mode, in which every model API works and the render,
   * pick and image-export paths are no-ops or reject.
   *
   * @returns true when running headless
   */
  headless(): boolean;
  /**
   * Always true: v4 has no style-disabled mode, since the columnar model
   * derives geometry from stored style channels rather than treating
   * style as an optional layer.  Kept so v3 code that checks it works.
   *
   * @returns true
   */
  styleEnabled(): boolean;
  /**
   * Whether any node currently has a parent.  Worth checking because the
   * compound tier changes paint evaluation and draw order; the renderer
   * pays nothing for compounds while this is false.
   *
   * @returns true when the graph has at least one parent/child relation
   */
  hasCompoundNodes(): boolean;
  /**
   * Whether an element with this id exists, via the O(1) id index —
   * cheaper than `getElementById( id ).nonempty()` because no handle is
   * materialized.
   *
   * @param id — the element id
   * @returns true when the graph holds that element
   */
  hasElementWithId(id: string): boolean;
  $id: this['getElementById'];
  byId: this['getElementById'];
  /**
   * All elements (the prototype has no immutable/"read-only"
   * collections) — `elements()` by another name, memo included.
   *
   * @returns every element in the graph
   */
  mutableElements(): Collection;
  /**
   * The `window` this instance renders into, or null when there is no DOM
   * (Node).  v3 parity, for extensions that need the hosting realm.
   *
   * @returns the global window, or null outside a browser
   */
  window(): (Window & typeof globalThis) | null;
  /**
   * The options the instance was constructed with.
   *
   * @returns the caller's own options object, held by reference — not a
   *   copy and not a defaults-resolved view, so an option the caller
   *   omitted reads back absent rather than as the default in force
   */
  options(): CytoscapeOptions;
  /**
   * Export the live graph as the binary wire format (the buffer
   * `options.elements`/`add()` accept directly): the columnar counterpart
   * of `json()`.  Carries ids, positions, selection state, the data()
   * sidecar and — since round 39.2 — graph-level `data()`; style,
   * viewport and scratch are not part of the wire.
   *
   * Note the asymmetry in *loading* that graph data back: `options.
   * elements` applies it, `cy.add( buffer )` ignores it.  Adding elements
   * to a populated graph must not overwrite that graph's own `data()`,
   * and there is no third answer that is right in both places.
   *
   * @returns a fresh little-endian buffer, self-contained (every edge
   *   endpoint indexes a node in the same payload) and directly loadable —
   *   derived geometry is flushed first, so parent boxes are the current
   *   ones rather than whatever was last materialized
   */
  serialize(): ArrayBuffer;
  /**
   * Export the graph as a plain object — elements, stylesheet, viewport,
   * gating flags and graph-level data.
   *
   * Export-only: the v3 import/restore form (`json( obj )`) is not
   * supported, because rebuilding from a snapshot needs the stored
   * element definitions that the columnar model deliberately does not
   * keep.  Use `serialize()` for the compact binary counterpart, which
   * *can* be fed back in.
   *
   * @param flat — when true, elements export as one flat array instead of
   *   `{ nodes, edges }` (v3's option)
   * @returns the exported graph
   * @throws if given anything but a boolean — the guard that catches an
   *   attempted `json( obj )` import
   */
  json(flat?: boolean): Record<string, unknown>;
  /**
   * Detach the renderer: the instance becomes headless (the model is
   * CPU-canonical, so nothing is lost).  No-op when already headless.
   */
  unmount(): this;
  /**
   * (Re)attach a renderer to a container.  Re-mounting to a different
   * container unmounts first; the fresh renderer re-uploads every column
   * from the CPU-canonical model and rebuilds all glyph runs.
   *
   * @param container — the element to render into
   * @returns this
   * @throws if no container is given, if the instance was built directly
   *   rather than through the `cytoscape` factory (there is no renderer
   *   to attach), or if WebGPU is unavailable — mounting is the one way a
   *   headless instance can demand a GPU after construction
   */
  mount(container: HTMLElement): this;
  /**
   * Device-loss recovery (round 10 policy): auto-recover once per loss —
   * emit 'devicelost', re-mount a fresh renderer against the same
   * container (the model is CPU-canonical, so everything rebuilds), then
   * emit 'devicerestored'.  If a loss arrives while a recovery is already
   * in flight, or re-acquisition fails, the instance goes headless-dead
   * and emits 'error' (the pre-round-10 behavior).
   */
  _handleDeviceLost(message: string): void;
  /**
   * The DOM element this instance renders into, or null when headless or
   * unmounted.
   *
   * @returns the container element, or null
   */
  container(): HTMLElement | null;
  /**
   * The rendered width in CSS px.  Headless instances report the
   * configured `headlessWidth` (default 800), so viewport maths works
   * without a DOM.
   *
   * @returns the viewport width in CSS px
   */
  width(): number;
  /**
   * The rendered height in CSS px.  Headless instances report the
   * configured `headlessHeight` (default 600).
   *
   * @returns the viewport height in CSS px
   */
  height(): number;
  /**
   * Tear the instance down: emit `destroy`, drop every listener, and
   * release the pointer handler and the renderer (with its GPU
   * resources).  Idempotent.  The store is left intact but the instance
   * must not be used afterwards.
   *
   * @returns this core
   */
  destroy(): this;
  /**
   * Whether `destroy()` has run.
   *
   * @returns true once destroyed
   */
  destroyed(): boolean;
  /** Interned singleton handle for a live slot. */
  _ele(group: GroupName, slot: number): Collection;
  /** Handle for a ref that may be stale (prefers the interned pre-removal handle). */
  _eleFromRef(ref: Ref): Collection;
  /** True when writing any of these data() keys can change the group's computed style. */
  _stylesDependOnData(group: GroupName, keys: string[]): boolean;
  /** Refresh style channels computed from data() (mapped channels + labels), deferred while batching. */
  _refreshMappedStyles(group: GroupName, slots: number[], keys: string[]): void;
  /** First style apply for freshly-added slots, deferred while batching. */
  private _applyStyle;
  _emitOnEle(type: string, ele: Collection, extraParams?: unknown[], props?: Partial<EventProps>): void;
  _hasListeners(type: string): boolean;
  _emitViewportEvents(types: string[]): void;
  private _boundsOf;
  /**
   * A synthetic id for an element added without one.  The prefix read `gpu-`
   * until round 43 — a leftover the 42.6 rename missed, and a user-visible one,
   * since it is what `ele.id()` returns.
   */
  private _newId;
}
//#endregion
//#region src/columnar.d.mts
/**
 * Convert classic v3-style elements JSON into the columnar bulk-load
 * form: typed-array columns with edge endpoints as node *indices*.
 *
 * This is the compatibility path for callers holding definition-form
 * JSON; the columnar form is what the loader ingests fastest, since
 * contiguous slot runs become memcpys and no per-element objects or
 * per-edge id lookups are needed.  Exposed publicly as
 * `cytoscape.toColumnarElements`.
 *
 * **The columnar form has no column for `locked`, `grabbable` or
 * `pannable`**, so a def setting one of those converts without it.  The
 * factory's own definition-form load does not go through this function
 * for that reason — it uses the internal {@link buildColumnar}, which
 * reports the deviations so it can write them after the ingest.
 *
 * @param defs — one element, an array, or `{ nodes, edges }`
 * @returns the equivalent self-contained columnar payload
 * @throws if an edge names a source or target that is not a node in the
 *   same payload — columnar payloads must be self-contained
 */
declare const toColumnarElements: (defs: ElementsDefinition | ElementDefinition) => ColumnarElements;
//#endregion
//#region src/wire.d.mts
/**
 * Serialize elements (definition form or columnar form) into one
 * transferable/fetchable ArrayBuffer.  `deserializeElements` (or passing
 * the buffer straight to `options.elements`/`cy.add()`) reverses it.
 *
 * @param elements — the elements to serialize, in either accepted form;
 *   a definition-form payload is converted to columnar first.  A columnar
 *   payload's optional graph-level `data` rides along (round 39.2); the
 *   definition form has nowhere to put it, so it carries none
 * @returns one little-endian ArrayBuffer holding the whole payload —
 *   fixed header, columns, and ids as a UTF-8 blob with prefix offsets
 * @throws if the platform is big-endian, or if a definition-form payload
 *   names an edge endpoint that is not a node in the same payload
 */
declare const serializeElements: (elements: ElementsDefinition | ElementDefinition | ColumnarElements) => ArrayBuffer;
/**
 * Deserialize a `serializeElements` buffer (or a view over one) back into
 * the columnar elements form.  Numeric columns are zero-copy views into
 * the given buffer; a misaligned view is copied once to realign.
 *
 * @param input — a `serializeElements` buffer, or a view over one
 * @returns the columnar form, whose numeric columns are **views into the
 *   input** rather than copies — so the buffer must outlive the result,
 *   and writing into either is visible through the other.  Graph-level
 *   `data` is the exception in two ways: it is decoded from JSON rather
 *   than viewed, and `cy.add()` deliberately ignores it (see
 *   `ColumnarElements.data`)
 * @throws if the platform is big-endian, or the buffer is too short,
 *   truncated or of an unsupported format version
 */
declare const deserializeElements: (input: ArrayBuffer | ArrayBufferView) => ColumnarElements;
//#endregion
//#region src/index.d.mts
/**
 * Create a GPU-prototype cytoscape instance (issue #3486, pass 1): a
 * columnar CPU-canonical model with a WebGPU render pipeline.
 *
 * With a `container`, WebGPU is required — this throws synchronously when
 * `navigator.gpu` is unavailable.  Without a container the instance is
 * headless (Node-friendly, never throws for a missing GPU).  Adapter
 * acquisition is asynchronous and reported separately: `cy.ready` rejects
 * when no adapter can be had, which this function cannot know yet.
 *
 * Beyond the constructor's work, the factory ingests `options.elements`
 * through the bulk path (no per-element handles, no `add` events — nothing
 * can be listening yet), runs `options.layout`, and attaches the renderer and
 * pointer handler when a container is given.
 *
 * **Unknown options are ignored, deliberately** (decided 2026-08-04, fifth
 * design sitting): unlike an unknown sheet key, style property or query key,
 * a misspelled option does not throw, because strictness here resolves at the
 * type layer — TypeScript's excess-property check rejects `{ motionBlur:
 * true }` against {@link CytoscapeOptions}, and v4 does not replicate at
 * runtime what the build already checks.
 *
 * @param options — the instance options; every field is optional, and an
 *   omitted `container` is what selects headless mode
 * @returns the new core, usable synchronously — reads and writes do not wait
 *   on the device, and a rendered instance additionally resolves `cy.ready`
 * @throws when `container` is given and `navigator.gpu` is missing
 */
declare function cytoscape(options?: CytoscapeOptions): Core;
declare namespace cytoscape {
  export { toColumnarElements };
  export { serializeElements };
  export { deserializeElements };
}
//#endregion
export { type BoundingBoxInput, type BoxSelectionMode, type BreadthFirstLayoutOptions, type CaseClause, type CaseMapper, type CircleLayoutOptions, type Collection, type ColumnarEdges, type ColumnarElements, type ColumnarNodes, type ConcentricLayoutOptions, type Condition, type Core, type CustomLayout, type CustomLayoutOptions, type CytoscapeOptions, type DataColumn, type DictColumn, type ElementData, type ElementDefinition, type ElementsDefinition, type ElementsInput, type Event, type EventHandler, type EventProps, type EventTarget, type ExportOptions, type ForceLayoutOptions, type GridLayoutOptions, type LayoutBaseOptions, type LayoutContext, type LayoutImpl, type LayoutOptions, type Mapper, type MapperSpec, type NO_PARENT, type PackedIds, type Position, type PresetLayoutOptions, type RandomLayoutOptions, type RendererOptions, type RendererStats, type StylePropValue, type StyleProps, type Stylesheet, cytoscape as default };
export as namespace cytoscape;
