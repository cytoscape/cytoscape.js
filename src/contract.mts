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

/** "No slot here" sentinel in slot-valued arrays (compaction remaps,
 * the columnar `parent` column's NO_PARENT twin). */
export const NO_SLOT = 0xffffffff;

// -- element flag bits (shared by node.flags and edge.flags) --

export const FLAG_ALIVE = 1;
/**
 * The *effective* shown bit (round 14.4): the element's own display
 * state AND no hidden ancestor.  Every consumer — the WGSL SHOWN test,
 * the cull predicates, scanRefsInto, boundingBox, the CPU pick, the
 * edge kernels' both-endpoints tests — reads this one bit, so
 * ancestor-gated visibility costs them nothing.  The own state lives in
 * FLAG_SELF_HIDDEN; the store recomputes the effective bit over
 * affected subtrees on visibility and hierarchy changes.
 */
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
/**
 * Node-only, store-managed (derived, round 14): set while the node has at
 * least one child.  Maintained by the HierarchyIndex, never a user switch.
 * Lives in the flags column so the cull kernels (which already bind flags)
 * can split the node draw into a parent stream and a leaf stream, and so
 * `:parent`-style queries stay pure flag scans.
 */
export const FLAG_PARENT = 4096;
/**
 * Node-only, store-managed (derived, round 14): set while the node has a
 * parent.  The `child`/`orphan` query predicates and the structural `case`
 * conditions read it.
 */
export const FLAG_CHILD = 8192;
/**
 * Node/edge own display state (round 14.4): set = hidden by the
 * element's own show()/hide().  FLAG_VISIBLE derives from it (and the
 * ancestor chain for nodes); consumers never read this bit directly.
 */
export const FLAG_SELF_HIDDEN = 16384;
/**
 * Style-managed (round 20.2): set while the element styles
 * `events: 'no'` — pointer-transparent, but still rendered.  Every
 * pointer path excludes flagged elements by reading this one bit: the
 * CPU node pick (grab/tap targeting, hover, tapdragover), the GPU edge
 * pick tile (the edge cull kernels test it in pick mode only — scene
 * draws are untouched), and the box-selection gesture (`interactive()`
 * folds it; `cy.elementsInBox()` stays a pure geometric query).
 * Maintained by the StyleEngine's write() — never a user switch.
 */
export const FLAG_NO_EVENTS = 32768;
/**
 * Node-only, style-managed (round 20.3): set while the node styles
 * `text-events: 'yes'` — the label block box (the exact laid dims at
 * the D3 anchor) is part of the node for the CPU pick.  Default off
 * (v3's default: labels are pointer-transparent).  Edge labels are
 * never pickable in v4 (recorded), so the bit is meaningless on edges.
 */
export const FLAG_TEXT_EVENTS = 65536;
/**
 * Style-managed own state (round 22): set while the element styles
 * `visibility: 'hidden'` — paint-only invisibility.  Consumers never
 * read this bit directly; the derived FLAG_DRAWN folds it (with the
 * ancestor chain for nodes).
 */
export const FLAG_SELF_INVISIBLE = 131072;
/**
 * The derived *rendered* bit (round 22): effective shown
 * (FLAG_VISIBLE) AND no `visibility: 'hidden'` on the element or, for
 * nodes, any ancestor.  The draw tier — the WGSL SHOWN mask, the CPU
 * pick and `visible()` — reads ALIVE|DRAWN, while space consumers
 * (bb/fit scans, compound auto-bounds, box geometry) keep reading
 * ALIVE|VISIBLE: an invisible element draws nothing but keeps its
 * space.  Maintained by the store beside FLAG_VISIBLE in the same
 * subtree walk.
 */
export const FLAG_DRAWN = 262144;

/**
 * The styleable states: the reserved case-condition key each flag
 * answers.  This is the whole binding between a bit and the stylesheet —
 * `style-scales.mts` lowers every state spelling to one of these keys,
 * the StyleEngine's value reader answers it from the flags word, and the
 * store's flag choke points use the reverse direction to know that a bit
 * flip may need a restyle.
 *
 * Only bits a *user* can meaningfully style are here.  The structural
 * ones (ALIVE, CURVED, NO_EVENTS) decide which pipeline draws an element
 * rather than what it looks like, and VISIBLE/DRAWN are computed *from*
 * style, so a rule conditioned on one would be circular.
 */
export const CONDITION_FLAGS: Readonly<Record<string, number>> = {
  '::parent': FLAG_PARENT,
  '::child': FLAG_CHILD,
  '::selected': FLAG_SELECTED,
  '::selectable': FLAG_SELECTABLE,
  '::locked': FLAG_LOCKED,
  '::grabbed': FLAG_GRABBED,
  '::grabbable': FLAG_GRABBABLE,
  '::active': FLAG_ACTIVE,
  '::hovered': FLAG_HOVERED,
};

/** The same binding, bit → key, for the flag-write side. */
export const CONDITION_KEY_OF: ReadonlyMap<number, string> = new Map(
  Object.entries(CONDITION_FLAGS).map(([key, bit]) => [bit, key]),
);

/** Every styleable state bit OR-ed — a one-test gate on a flag write. */
export const CONDITION_FLAG_MASK: number = Object.values(
  CONDITION_FLAGS,
).reduce((m, bit) => m | bit, 0);

/** The fixed model-px gap between a node's box and a top/bottom-row
 * label (see the D3 label-alignment record); shared by the StyleEngine's
 * anchor bake and the store's parent-label re-anchor on auto-bounds
 * resize (round 14.3). */
export const LABEL_MARGIN = 4;

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

// round 27.2: the plain-polygon keywords v3 had and round 13 left
// unported.  `cut-rectangle` is not a unit polygon — its chamfer is an
// absolute length (v3's 8 model px, or the element's corner-radius) —
// so it carries its own SDF rather than a point table.
export const SHAPE_RIGHT_RHOMBOID = 15;
export const SHAPE_CONCAVE_HEXAGON = 16;
export const SHAPE_CUT_RECTANGLE = 17;

/** v3's default cut-rectangle chamfer, in model px (`getCutRectangleCornerLength`). */
export const CUT_RECTANGLE_CORNER = 8;

// round 27.4: the round-corner family.  Each of these reuses its sharp
// counterpart's point table (v3 does the same) and rounds every corner
// with a tangent arc, so they cost one shared SDF rather than seven.
export const SHAPE_ROUND_TRIANGLE = 18;
export const SHAPE_ROUND_DIAMOND = 19;
export const SHAPE_ROUND_PENTAGON = 20;
export const SHAPE_ROUND_HEXAGON = 21;
export const SHAPE_ROUND_HEPTAGON = 22;
export const SHAPE_ROUND_OCTAGON = 23;
export const SHAPE_ROUND_TAG = 24;
export const SHAPE_BOTTOM_ROUND_RECTANGLE = 25;

/**
 * v3's `getRoundPolygonRadius`: the 'auto' corner radius for the
 * round-* family, in model px.  A *third* meaning for one prop —
 * round-rectangle uses min(w/4, h/4, 8) and cut-rectangle a flat 8 —
 * which is v3's behaviour, not a v4 invention.
 */
export const ROUND_POLYGON_RADIUS_DIV = 10;
export const ROUND_POLYGON_RADIUS_MAX = 8;

// round 27.5: v3's barrel — a rectangle whose four corners are quadratic
// beziers.  The offsets are size-relative until they hit absolute caps,
// so like cut-rectangle it is a parameterized shape, not a unit table.
export const SHAPE_BARREL = 26;

/** v3's `getBarrelCurveConstants`, in model px. */
export const BARREL_HEIGHT_OFFSET_MAX = 15;
export const BARREL_HEIGHT_OFFSET_PCT = 0.05;
export const BARREL_WIDTH_OFFSET_MAX = 100;
export const BARREL_WIDTH_OFFSET_PCT = 0.25;
export const BARREL_CTRL_OFFSET_PCT = 0.05;

/**
 * Segments each barrel corner's bezier is sampled into.  Four is not a
 * shortcut: it is exactly the fidelity v3's own hit test uses
 * (`intersectLine` samples t = 0.15, 0.5, 0.85 between the endpoints),
 * and at v3's corner offsets the deviation from the drawn curve is
 * sub-pixel.  The parity diff in round 27.5 is what settled it.
 */
export const BARREL_CURVE_SEGMENTS = 4;

/*
The node shape id rides `borderGeom.y` alongside the border position
(bits 0..7).  Round 27.1 widened the field from four bits to a full byte
— 15 of the 16 ids were used, and round 27's twelve new keywords would
not have fitted.  Round 38 took four of the free bits for the two
stroke-style enums; bits 12..15 and 24..31 of that word remain free.
*/
export const SHAPE_SHIFT = 16;
export const SHAPE_MASK = 0xff;

// -- border / outline stroke styles (round 38; borderGeom.y bit fields) --

/*
`border-style` rides borderGeom.y bits 8..9 and `outline-style` bits
10..11, so the node fragment shader reads both from a word it already
binds — the node pipeline is at exactly 8 fragment-visible storage
buffers per stage, which is why the dashed border's *pattern* travels
differently: the `node.borderDash`/`node.borderDashMeta` columns bind
vertex-only and reach the FS as flat varyings (the round-57.1b slot
trick, in reverse).  v3 semantics per style: `dashed` reads
border-dash-pattern/-offset, `dotted` hardcodes [1, 1] (it ignores the
pattern — measured in v3's drawBorder switch), `double` strokes solid
and then erases the middle third (destination-out; v4 ports it as
alpha-0 stripe fragments), and `outline-style` takes no dash props at
all ([4, 2] hardcoded, [1, 1] for dotted, and its `double` draws SOLID
— v3's drawOutline has no double branch, a quirk kept for parity).
*/
export const BORDER_STYLE_SHIFT = 8;
export const OUTLINE_STYLE_SHIFT = 10;
export const STROKE_STYLE_MASK = 0x3;
export const STROKE_SOLID = 0;
export const STROKE_DASHED = 1;
export const STROKE_DOTTED = 2;
export const STROKE_DOUBLE = 3;

// -- node chart kinds (round 23; stored in the chart blob record) --

export const CHART_NONE = 0;
export const CHART_PIE = 1;
export const CHART_STRIPES = 2;
/** floats before the (value, color) triples: kind, size, hole,
 * startAngle, direction, opacity, n.  (Opacity is folded into the
 * slice alphas for the FS; the header copy keeps readback exact.) */
export const CHART_HEADER = 7;
/** slice cap (v3's numbered-prop N; longer value lists truncate) */
export const CHART_MAX_SLICES = 16;

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
 * Compound loop (round 14.10): an edge between a node and its own
 * ancestor/descendant (or a self-loop on a parent) routes around the
 * outside via v3's findCompoundLoopPoints — two control points off the
 * endpoints' min top-left corner, rendered like a CURVE_LOOP (two C1
 * quadratics through the control midpoint).  Params: [0] loop distance,
 * [1] bundle index j, [2] the derivation-time excursion bound (feeds
 * curveSlack; the kind is box-bounded — FLAG_CURVED_BOX).  Control
 * points evaluate from live positions/outer halves in both
 * implementations, so drags and auto-bounds resizes follow with zero
 * re-derivation; the relation itself re-derives on reparent.
 *
 * The value sits above the CURVE_HAS_ENDPT flag range (8 | blob kind =
 * 11..13) so the endpoint-strip arithmetic (kind - 8) can never confuse
 * a compound loop with a flagged blob kind; always test CURVE_CMPD on
 * the *raw* kind, before any endpoint strip.
 */
export const CURVE_CMPD = 16;
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

// round 27.6: v3's compound arrowheads.  All four fit the 4-bit fields
// the 27.1 repack created, which is what that pass existed for.
export const ARROW_TRIANGLE_TEE = 8;
export const ARROW_CIRCLE_TRIANGLE = 9;
export const ARROW_TRIANGLE_CROSS = 10;
export const ARROW_TRIANGLE_BACKCURVE = 11;

/** v3's circle-triangle circle radius, in arrow-frame units. */
export const ARROW_CIRCLE_TRIANGLE_RADIUS = 0.15;

/** Segments the backcurve's quadratic is sampled into (see round 27.5). */
export const ARROW_BACKCURVE_SEGMENTS = 6;

/*
`edge.arrowShapes` packing (repacked in round 27.1).

One u32 carries all four arrowhead ids, the two hollow flags and the
quantized arrow scale:

    bits  0..3   source shape id
    bits  4..7   target shape id
    bits  8..11  mid-source shape id
    bits 12..15  mid-target shape id
    bit  16      source arrow hollow
    bit  17      target arrow hollow
    bits 18..23  reserved
    bits 24..31  arrow scale, x16

Before 27.1 the end ids took a byte each and the mid ids were squeezed
into three bits, which ids 0..7 filled exactly — so any new arrow id
truncated silently on mid arrows.  Four bits each fits v3's whole arrow
vocabulary (12 shapes) in the same word with six bits to spare, which is
what let round 27.6 add the compound shapes without growing the column.

Recorded cap: 16 arrow shapes.  Adding a seventeenth means finding two
more bits (the reserved span holds one more id, or the scale byte can be
re-quantized), not a silent truncation — `packArrowShapes` throws.
*/
/**
 * Two flags that exist **only in `edge.width`'s mirror lane**, never in
 * `edge.arrowShapes` (round 56).
 *
 * Each says: *this end's head does not hide the line beneath it* — it is
 * hollow, or its stored alpha is below opaque.  That is precisely the
 * condition under which the drawn line has to be shortened past v3's
 * `gap` to the head's own depth, because v3 relies on its
 * `destination-out` erase there and an opaque head would have hidden the
 * difference.
 *
 * They live in the mirror rather than in `edge.arrowShapes` deliberately.
 * The real column's bits 18..23 are reserved, and both a seventeenth
 * arrow shape and a finer `arrow-scale` want them; the mirror is v4's own
 * private channel to the vertex stages and spending its copy of that span
 * costs the reserve nothing.  The consequence is that **the mirror is a
 * derived word, not a bit-exact copy** — if the reserve is ever spent,
 * these two move.
 */
export const ARROW_SHIFT_SRC_SHOWS_LINE = 18;
export const ARROW_SHIFT_TGT_SHOWS_LINE = 19;

export const ARROW_SHAPE_MASK = 0xf;
export const ARROW_SHIFT_SOURCE = 0;
export const ARROW_SHIFT_TARGET = 4;
export const ARROW_SHIFT_MID_SOURCE = 8;
export const ARROW_SHIFT_MID_TARGET = 12;
export const ARROW_SHIFT_HOLLOW_SOURCE = 16;
export const ARROW_SHIFT_HOLLOW_TARGET = 17;
export const ARROW_SHIFT_SCALE = 24;

/**
 * Pack the arrowhead record for one edge.  The single place the layout
 * above is written; every reader (the two arrow shaders and the style
 * getters) derives from the same shift constants.
 *
 * @param source — source-end shape id
 * @param target — target-end shape id
 * @param midSource — mid-source shape id
 * @param midTarget — mid-target shape id
 * @param hollowSource — whether the source arrow is stroked, not filled
 * @param hollowTarget — whether the target arrow is stroked, not filled
 * @param scaleQ — the arrow scale, already quantized to x16 and clamped
 *   into a byte
 * @returns the packed u32
 * @throws if a shape id exceeds the 4-bit field — a silent truncation
 *   here would mis-draw mid arrows only, which is exactly the failure
 *   that went unnoticed before 27.1
 */
export const packArrowShapes = (
  source: number,
  target: number,
  midSource: number,
  midTarget: number,
  hollowSource: number,
  hollowTarget: number,
  scaleQ: number,
): number => {
  for (const id of [source, target, midSource, midTarget]) {
    if (id > ARROW_SHAPE_MASK) {
      throw new Error(
        `Arrow shape id ${id} does not fit the ${ARROW_SHAPE_MASK + 1}-shape field; ` +
          'widen the packing in contract.mts rather than truncating',
      );
    }
  }

  return (
    ((source << ARROW_SHIFT_SOURCE) |
      (target << ARROW_SHIFT_TARGET) |
      (midSource << ARROW_SHIFT_MID_SOURCE) |
      (midTarget << ARROW_SHIFT_MID_TARGET) |
      (hollowSource << ARROW_SHIFT_HOLLOW_SOURCE) |
      (hollowTarget << ARROW_SHIFT_HOLLOW_TARGET) |
      (scaleQ << ARROW_SHIFT_SCALE)) >>>
    0
  );
};

/**
 * Read one end's shape id back out — the CPU twin of the shaders'
 * `endShapeOf`.
 *
 * @param packed — the packed word
 * @param shift — one of the `ARROW_SHIFT_*` end constants
 * @returns the shape id
 */
export const unpackArrowShape = (packed: number, shift: number): number =>
  (packed >>> shift) & ARROW_SHAPE_MASK;

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
  | 'node.outerGeom'
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
  | 'node.borderGeom'
  /**
   * Float32Array(4·cap) — the dashed border's pattern (round 38),
   * normalized to two on/off pairs exactly like `edge.dashPattern`
   * (v3's default [4, 2] stores as [4, 2, 4, 2]).  Read only when
   * borderGeom.y's border-style bits say `dashed`; `dotted` hardcodes
   * [1, 1] in the shader (v3's rule).  Binds vertex-only in the node
   * pipeline — the FS is at its 8-storage-buffer budget — and reaches
   * the fragment stage as flat varyings.
   */
  | 'node.borderDash'
  /**
   * Float32Array(2·cap) — [border-dash-offset (model px), reserved],
   * the `edge.dashMeta` twin for borders (round 38).  Same vertex-only
   * binding rule as 'node.borderDash'.
   */
  | 'node.borderDashMeta'
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
  /**
   * Uint32Array(cap) — background-image list ref (round 15.2): record
   * offset into the image param blob | image count << 24 (0 = no
   * images; count ≤ 4 — the recorded multi-image cap).  Records are
   * IMG_STRIDE floats per image (see store/graph-store.mts
   * setNodeImages): registry entry id, packed mode flags, opacity,
   * position/offset/size values with unit bits, and the sdf tint.
   * Draw-only paint: nothing in bb, cull-extent or CPU-pick reads it.
   */
  | 'node.imageRef'
  /**
   * Uint32Array(cap) — chart record ref (round 23): offset into the
   * chart blob | slice count << 24 (0 = no chart).  The record is
   * CHART_HEADER floats (kind, size, hole, startAngle, direction,
   * n) then n × (value, packed-rgba-as-float-bits).  Draw-only
   * paint, like images: nothing in bb, cull-extent or CPU-pick.
   */
  | 'node.chartRef'
  | 'edge.endpoints' // Uint32Array(2·cap), source,target node *slots*
  | 'edge.lineColor' // Uint8Array(4·cap)
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
  | 'edge.width' // Float32Array(2·cap)
  | 'edge.opacity' // Float32Array(cap)
  | 'edge.flags' // Uint32Array(cap)
  | 'edge.sourceArrow' // Uint8Array(4·cap), arrowhead RGBA; a=0 means no arrow at this end
  | 'edge.targetArrow' // Uint8Array(4·cap)
  | 'edge.lineStyle' // Uint32Array(cap), LINE_* ids
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
   * Uint32Array(2·cap) — line-outline casing (round 13 B4), the layer
   * record layout: [rgba (folded by opacity × line-opacity; a=0 =
   * disabled), strokeWidth × 256 (edge width + line-outline-width —
   * v3's context.lineWidth)].  Strokes under the edge line, over the
   * edge underlay, via the shared layer entry points.
   */
  | 'edge.gradient'
  | 'edge.casing'
  /**
   * Float32Array(4·cap) — line-dash-pattern (round 13 B3), normalized
   * to two on/off pairs in model px (a 2-entry pattern repeats; odd
   * patterns double, canvas semantics; longer patterns truncate — a
   * recorded cap).  Applies when line-style is dashed; dotted keeps
   * [1, 1].
   */
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

export type ColumnCtor =
  | Float32ArrayConstructor
  | Uint32ArrayConstructor
  | Uint8ArrayConstructor;

export interface ColumnSpec {
  id: ColumnId;
  group: GroupName;
  ctor: ColumnCtor;
  /** components (array elements) per slot */
  components: number;
  /** bytes per slot (components × bytes per element) */
  bytesPerSlot: number;
}

const spec = (
  id: ColumnId,
  group: GroupName,
  ctor: ColumnCtor,
  components: number,
): ColumnSpec => ({
  id,
  group,
  ctor,
  components,
  bytesPerSlot: components * ctor.BYTES_PER_ELEMENT,
});

export const COLUMN_SPECS: ColumnSpec[] = [
  spec('node.position', 'nodes', Float32Array, 2),
  spec('node.size', 'nodes', Float32Array, 2),
  spec('node.fillColor', 'nodes', Uint8Array, 4),
  spec('node.borderColor', 'nodes', Uint8Array, 4),
  spec('node.borderWidth', 'nodes', Float32Array, 1),
  spec('node.opacity', 'nodes', Float32Array, 1),
  spec('node.shape', 'nodes', Uint32Array, 1),
  spec('node.outerHalf', 'nodes', Float32Array, 2),
  spec('node.outerGeom', 'nodes', Float32Array, 4),
  spec('node.ghost', 'nodes', Float32Array, 4),
  spec('node.borderGeom', 'nodes', Uint32Array, 4),
  spec('node.borderDash', 'nodes', Float32Array, 4),
  spec('node.borderDashMeta', 'nodes', Float32Array, 2),
  spec('node.gradient', 'nodes', Uint32Array, 8),
  spec('node.overlay', 'nodes', Uint32Array, 4),
  spec('node.underlay', 'nodes', Uint32Array, 4),
  spec('node.imageRef', 'nodes', Uint32Array, 1),
  spec('node.chartRef', 'nodes', Uint32Array, 1),
  spec('node.flags', 'nodes', Uint32Array, 1),
  spec('edge.endpoints', 'edges', Uint32Array, 2),
  spec('edge.lineColor', 'edges', Uint8Array, 4),
  spec('edge.width', 'edges', Float32Array, 2),
  spec('edge.opacity', 'edges', Float32Array, 1),
  spec('edge.flags', 'edges', Uint32Array, 1),
  spec('edge.sourceArrow', 'edges', Uint8Array, 4),
  spec('edge.targetArrow', 'edges', Uint8Array, 4),
  spec('edge.lineStyle', 'edges', Uint32Array, 1),
  spec('edge.arrowShapes', 'edges', Uint32Array, 1),
  spec('edge.arrowWidths', 'edges', Float32Array, 2),
  spec('edge.midSourceArrow', 'edges', Uint8Array, 4),
  spec('edge.midTargetArrow', 'edges', Uint8Array, 4),
  spec('edge.overlay', 'edges', Uint32Array, 2),
  spec('edge.gradient', 'edges', Uint32Array, 8),
  spec('edge.casing', 'edges', Uint32Array, 2),
  spec('edge.dashPattern', 'edges', Float32Array, 4),
  spec('edge.dashMeta', 'edges', Float32Array, 2),
  spec('edge.underlay', 'edges', Uint32Array, 2),
  spec('edge.curveParams', 'edges', Float32Array, 4),
];

const specsById = new Map<ColumnId, ColumnSpec>(
  COLUMN_SPECS.map((s) => [s.id, s]),
);

/**
 * The co-signed spec for one column.  Store and renderer both size their
 * allocations from this, so it is the single place either side may learn
 * a column's element type and component count.
 *
 * @param id — the column id
 * @returns the shared spec (the module's own object — do not mutate)
 * @throws if the id is not in `COLUMN_SPECS`, which means the two halves
 *   have gone out of sync
 */
export const columnSpec = (id: ColumnId): ColumnSpec => {
  const s = specsById.get(id);

  if (s == null) {
    throw new Error(`Unknown GPU column '${id}'`);
  }

  return s;
};

/**
 * Every column belonging to one group, in `COLUMN_SPECS` order — which
 * is the order both halves allocate and upload in.  Filters on each
 * call, so hoist it out of loops; it is meant for allocation and
 * teardown, not per frame.
 *
 * @param group — 'nodes' or 'edges'
 * @returns a fresh array of the shared spec objects
 */
export const columnSpecsForGroup = (group: GroupName): ColumnSpec[] => {
  return COLUMN_SPECS.filter((s) => s.group === group);
};

/**
 * Edge columns that are **per element by nature** — their value comes
 * from the graph's structure or from a derivation, never from the styled
 * record alone (round 67.2):
 *
 * - `edge.endpoints` is the ingest's, written from source/target;
 * - `edge.flags` carries per-element bits (selected, visible, drawn,
 *   curved) alongside the two the style pass sets;
 * - `edge.curveParams` is derived by the curve index from membership.
 *
 * Every *other* edge column is a pure function of the styled record, so
 * a run of slots sharing one record can be filled from a template
 * instead of written slot by slot.  That is the whole safety argument
 * behind `GraphStore.replicateEdgeStyle`, which is why the split lives
 * here beside `COLUMN_SPECS` rather than in the style engine: adding a
 * column is what forces the classification, and
 * `test/bulk-style-apply.mjs` fails until a new edge column appears in
 * one list or the other.
 */
export const EDGE_PER_ELEMENT_COLUMNS: readonly ColumnId[] = [
  'edge.endpoints',
  'edge.flags',
  'edge.curveParams',
];

/** The complement of {@link EDGE_PER_ELEMENT_COLUMNS}: edge columns a
 * shared styled record fully determines. */
export const EDGE_STYLE_COLUMNS: readonly ColumnSpec[] = COLUMN_SPECS.filter(
  (s) => s.group === 'edges' && !EDGE_PER_ELEMENT_COLUMNS.includes(s.id),
);

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
  /** Node image-record blob dirt (round 15.2) — same rules. */
  imageBlob?: { resized: boolean; start: number; end: number };
  /** chart blob dirt (round 23): float range [start, end) or a realloc */
  chartBlob?: { resized: boolean; start: number; end: number };
}

// -- labels --

/** Label sidecar streams: main node/edge labels plus the edge
 * source/target end-label streams (round 13 D4). */
export type LabelStream = GroupName | 'edgeSource' | 'edgeTarget';

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

// -- the read surface the renderer consumes --

/**
 * The renderer's view of the model: CPU-canonical typed-array columns plus
 * dirty bookkeeping.  Reads are always served from these arrays; uploads are
 * byte-for-byte copies of the dirty spans.
 */
export interface ModelView {
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
  images: import('./image-registry.mjs').ImageRegistry;
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
  nodeLabelBox(
    slot: number,
  ): { x1: number; y1: number; x2: number; y2: number } | null;
}

/** A validated reference to an element slot; stale when `gen` no longer matches. */
export interface Ref {
  group: GroupName;
  slot: number;
  gen: number;
}
