/*
Public option/type surface of the GPU prototype entry point.
*/

import type { Position } from './types.mjs';

export type { Position };

export interface ElementData {
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

export interface ElementDefinition {
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

export type ElementsDefinition =
  | ElementDefinition[]
  | { nodes?: ElementDefinition[]; edges?: ElementDefinition[] };

/**
 * Ids as bytes: one UTF-8 blob + prefix byte offsets (length count + 1).
 * Zero-length entries are auto-generated.  This is the wire format's id
 * representation, and the store ingests it without materializing any JS
 * strings — id strings are decoded lazily, per element touched.
 */
export interface PackedIds {
  offsets: Uint32Array;
  blob: Uint8Array;
}

/**
 * A dictionary-encoded string data column: `indices[i]` is a 1-based
 * index into `dict` (0 = absent).  Data values repeat heavily, so this
 * is both the compact in-memory shape and the wire shape.
 */
export interface DictColumn {
  dict: string[];
  indices: Uint32Array;
}

/**
 * One data() column, index-aligned with the payload: a plain array
 * (holes/undefined = absent), a Float64Array (NaN = absent), or a
 * dictionary-encoded string column.
 */
export type DataColumn = ArrayLike<unknown> | Float64Array | DictColumn;

/** Columnar node payload; all arrays are index-aligned with `count`. */
export interface ColumnarNodes {
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
export const NO_PARENT = 0xffffffff;

/** Columnar edge payload; endpoints are indices into the payload's nodes. */
export interface ColumnarEdges {
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
export interface ColumnarElements {
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
export type ElementsInput =
  | ElementsDefinition
  | ElementDefinition
  | ColumnarElements
  | ArrayBuffer
  | ArrayBufferView;

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
export interface Mapper {
  /** data() sidecar key to read */
  data: string;
  scale?:
    | 'linear'
    | 'log'
    | 'sqrt'
    | 'pow'
    | 'symlog'
    | 'diverging'
    | 'ordinal'
    | 'threshold'
    | 'quantize';
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
export interface Condition {
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
export interface CaseClause {
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
export interface CaseMapper {
  case: CaseClause[];
  else?: string | number;
  /** value for missing/unmappable data (defaults to `else` then the channel default) */
  fallback?: string | number;
}

/** Any data-driven style value: a scale mapper or a conditional. */
export type MapperSpec = Mapper | CaseMapper;

/** A style prop value: a constant, or a mapper object. */
export type StylePropValue = string | number | MapperSpec;

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
export type StyleProps = Record<string, StylePropValue>;

/**
 * The v4 stylesheet — no selectors, no style functions.  Each group key
 * is a props object whose values are constants or mapper objects; all
 * per-element variation is expressed declaratively through mappers
 * ({@link Mapper} scales, {@link CaseMapper} conditionals), which
 * are analyzable, serializable, and evaluated on the GPU where possible.
 * Everything stays fresh automatically: a data write re-derives the
 * mapped channels of the affected elements (gated on the mapped keys).
 */
export interface Stylesheet {
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
export interface ExportOptions {
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

export type BoundingBoxInput = {
  x1: number;
  y1: number;
  x2?: number;
  y2?: number;
  w?: number;
  h?: number;
};

/** A data-driven score for a layout param (round 85.3, #1514) — the
 * canonical, serializable alternative to a function.  Bare `{ data }`
 * passes the column value through (the value *is* the score/length);
 * with `range`, the column's extent is normalized through `scale` into
 * `[range[0], range[1]]`, and `invert: true` flips it — e.g.
 * `edgeLength: { data: 'score', scale: 'log', range: [40, 200],
 * invert: true }` maps large scores to short edges.  Resolved once at
 * layout start; a missing value takes `default` (else the option's
 * own default); an unknown key or a non-number column throws. */
export interface LayoutScoreMapping {
  /** the numeric data column to read */
  data: string;
  /** how the extent is normalized when `range` is given (default 'linear') */
  scale?: 'linear' | 'log' | 'sqrt';
  /** the output interval the extent maps onto; omitted, values pass through */
  range?: [number, number];
  /** flip the mapping so the largest score lands at `range[0]` */
  invert?: boolean;
  /** what a missing value resolves to (else the option's own default) */
  default?: number;
}

/** A data-driven sort for a layout param (round 85.3) — the canonical,
 * serializable alternative to a comparator function: order by one
 * column, missing values last, ties broken ascending on the id (so the
 * order is deterministic by construction).  A number or string column;
 * mixed throws. */
export interface LayoutSortMapping {
  /** the data column to order by */
  data: string;
  /** the direction (default 'ascending'); missing values sort last either way */
  order?: 'ascending' | 'descending';
}

/** Options shared by the discrete layouts (scope, fit, spacing, animation). */
export interface LayoutBaseOptions {
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

export interface GridLayoutOptions extends LayoutBaseOptions {
  name: 'grid';
  avoidOverlap?: boolean;
  avoidOverlapPadding?: number;
  condense?: boolean;
  rows?: number;
  cols?: number;
  /** returns a fixed { row, col } for a node handle */
  position?: (node: unknown) => { row?: number; col?: number } | undefined;
  /** the cell order: a `{ data, order? }` sort mapping (canonical,
   * serializable — 85.3) or a comparator over node handles */
  sort?: LayoutSortMapping | ((a: unknown, b: unknown) => number);
}

export interface PresetLayoutOptions extends LayoutBaseOptions {
  name: 'preset';
  /** node id → position map, or a function of a node handle; absent nodes keep their position */
  positions?:
    | Record<string, Position>
    | ((node: unknown) => Position | null | undefined);
}

export interface CircleLayoutOptions extends LayoutBaseOptions {
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
  /** the order around the circle: a `{ data, order? }` sort mapping
   * (canonical, serializable — 85.3) or a comparator over node handles */
  sort?: LayoutSortMapping | ((a: unknown, b: unknown) => number);
}

export interface ConcentricLayoutOptions extends LayoutBaseOptions {
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
  /** the score deciding ring membership — higher sits closer to the
   * center (default: degree).  A `{ data, … }` score mapping
   * (canonical, serializable — 85.3) or a function of the node handle */
  concentric?: LayoutScoreMapping | ((node: unknown) => number);
  /** the variation of concentric values per level (default: maxDegree / 4) */
  levelWidth?: (nodes: unknown) => number;
}

export interface BreadthFirstLayoutOptions extends LayoutBaseOptions {
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
  /** the order within a depth: a `{ data, order? }` sort mapping
   * (canonical, serializable — 85.3) or a comparator over node handles */
  depthSort?: LayoutSortMapping | ((a: unknown, b: unknown) => number);
  /** shift nodes down to their maximal depths (DAGs only) */
  maximal?: boolean;
  /** with maximal: the graph is known acyclic (no cycle bail-out) */
  acyclic?: boolean;
}

export interface RandomLayoutOptions extends LayoutBaseOptions {
  name: 'random';
}

/** The radial tree layout (round 85.1): concentric rings with
 * hierarchy-aware angular wedges — each subtree occupies a contiguous
 * sector sized by its weight, so subtrees never interleave. */
export interface RadialLayoutOptions extends LayoutBaseOptions {
  name: 'radial';
  /** the tree roots: a collection or an array of node ids (never a
   * selector string); omitted, inferred per component by max degree */
  roots?: unknown;
  /** where the sweep begins, in radians (default 3π/2 — up) */
  startAngle?: number;
  /** the total angle the trees share, in radians (default 2π) */
  sweep?: number;
  /** wedge order runs clockwise (default true) */
  clockwise?: boolean;
  /** the ring gap in model px; derived from the bounding box unset */
  levelSpacing?: number;
  /** what sizes a subtree's wedge: its leaf count (default) or its
   * whole node count */
  weight?: 'leaves' | 'subtree';
}

/** The built-in force layout (round 18): spring–electric with
 * uniform-grid cutoff repulsion, seeded and deterministic; runs
 * through the extension contract. */
export interface ForceLayoutOptions extends LayoutBaseOptions {
  name: 'force';
  /** ideal edge length: a number; a `{ data, scale?, range?, invert?,
   * default? }` score mapping (canonical, serializable — 85.3, e.g.
   * `{ data: 'score', scale: 'log', range: [40, 200], invert: true }`
   * for large scores → short edges); or a plain fn of the edge handle.
   * Resolved once at start either way */
  edgeLength?: number | LayoutScoreMapping | ((edge: unknown) => number);
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
  /** live display: stream positions per frame while the sim runs;
   * false shows nothing until convergence.  Presentation only (87.2):
   * a rendered flat-graph run is async for both values — read
   * positions at `layoutstop` / `promise()`.  Headless runs stay
   * synchronous. */
  animate?: boolean;
  /** iterations per animation frame (animate: true; default 3) */
  stepsPerFrame?: number;
  /** the gap between disconnected components' packed boxes (59.2;
   * v3 cose's option of the same name — default 40) */
  componentSpacing?: number;
  /** what a fresh placement is (59.4): 'spectral' (the default —
   * landmark-MDS per component, the global untangling) or 'scatter'
   * (the plain seeded scatter).  Ignored under `randomize: false`. */
  init?: 'spectral' | 'scatter';
  /** ideal-length multiplier per compound boundary an edge spans
   * (59.5; v3 cose's rule — length × levels × nestingFactor; 1.2) */
  nestingFactor?: number;
  /** the compound centroid pull, as a multiple of `gravity` (59.5;
   * the Bilkent line's gravityCompound — default 1.5) */
  gravityCompound?: number;
}

/** The extension contract (round 17.5): a direct impl object/class —
 * no name, no registry — plus any custom knobs the impl reads off
 * ctx.options. */
export interface CustomLayoutOptions extends LayoutBaseOptions {
  impl: unknown;
  name?: undefined;
  /** internal (round 17.5): the wrapper already emitted layoutstart */
  _startEmitted?: boolean;
  [key: string]: unknown;
}

export type LayoutOptions =
  | GridLayoutOptions
  | PresetLayoutOptions
  | CircleLayoutOptions
  | ConcentricLayoutOptions
  | BreadthFirstLayoutOptions
  | RandomLayoutOptions
  | RadialLayoutOptions
  | ForceLayoutOptions
  | CustomLayoutOptions;

/** Renderer tuning knobs (all LOD values in device px). */
export interface RendererOptions {
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
  /**
   * Host the renderer in a worker via OffscreenCanvas (round 86.3):
   * the frame loop, GPU pipelines and uploads leave the main thread,
   * which keeps the page responsive under render load.  The model
   * stays main-side and synchronous; per-frame deltas cross as
   * transferable span messages.  Requires Worker + OffscreenCanvas +
   * WebGPU-in-worker support, and mounting rejects loudly without
   * them — there is no silent same-thread fallback.  Pass-1
   * deferrals, recorded in the round record: background images are
   * not drawn, and tweens/the force layout take their CPU executors.
   */
  worker?: boolean;
}

/** Snapshot returned by `cy.renderer().stats()`. */
export interface RendererStats {
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
  /** the glyph atlas raster tier (round 94): 1 = the 32 px base raster,
   * 2 = the 64 px raster the zoom meter promotes to when the largest
   * label in use displays taller than ~40 device px.  Promotion is
   * one-way for the renderer's lifetime. */
  glyphAtlasTier: number;
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
export type BoxSelectionMode = 'contain' | 'overlap';

/**
 * What the pointer is doing and what it is over, as the cursor map reads
 * it (round 89.1).  `gesture` is the press mode the interaction layer
 * decided at pointerdown — a press outranks hover, so a drag that
 * crosses another node keeps saying `grabbing`.
 */
export interface CursorState {
  /** the active press, or `'idle'` between gestures */
  gesture: 'idle' | 'pan' | 'grab' | 'box';
  /** what the hover pick found: nothing, an element, or a node the drag
   * predicate accepts (grabbable, unlocked, not animating) */
  hover: 'none' | 'element' | 'draggable-node';
  /** the pointer's `pointerType`; `'touch'` never gets a cursor */
  pointerType: string;
}

/**
 * The CSS cursor per interaction state (round 89).  Every value is a CSS
 * cursor keyword, or `''` meaning inherit — which hands that state back
 * to whatever the app's own container sets, and is the default for
 * `idle` so a v4 canvas is silent where it has nothing to say.
 *
 * v3 set no cursors at all, so nothing here is a v3 deviation; the
 * defaults are the standard browser affordances.
 */
export interface CursorMap {
  /** no gesture, nothing under the pointer (default `''` — inherit) */
  idle: string;
  /** hovering any interactive element (default `'pointer'`) */
  hoverElement: string;
  /** hovering a node the drag predicate accepts (default `'grab'`) */
  hoverNode: string;
  /** an active pan press (default `'grabbing'`) */
  pan: string;
  /** an active node-drag press (default `'grabbing'`) */
  grab: string;
  /** an active box-selection press (default `'crosshair'`) */
  box: string;
}

export interface CytoscapeOptions {
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
  /** whether the canvas writes CSS cursors for the gesture affordances —
   * `grab`/`grabbing` around dragging, `pointer` over an element,
   * `crosshair` while boxing (default true).  Round 89.
   *
   * `false` means the interaction layer never touches `style.cursor`, for
   * an app that sets its own; an object overrides individual entries
   * (`{ pan: 'move' }`), where `''` means inherit. */
  pointerCursors?: boolean | Partial<CursorMap>;
  /** rendered dimensions used when headless */
  headlessWidth?: number;
  headlessHeight?: number;
  /** device pixel ratio override; defaults to the window's */
  pixelRatio?: number | 'auto';
  renderer?: RendererOptions;
}
