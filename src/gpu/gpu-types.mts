/*
Public option/type surface of the GPU prototype entry point.
*/

import type { Position } from '../types.mjs';

export type { Position };

export interface GpuElementData {
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

export interface GpuElementDefinition {
  /** inferred from `data.source`/`data.target` when omitted */
  group?: 'nodes' | 'edges';
  data?: GpuElementData;
  /** nodes only */
  position?: Position;
  selected?: boolean;
  selectable?: boolean;
  grabbable?: boolean;
  locked?: boolean;
  /** dragging this element pans the graph instead (default: true for edges, false for nodes) */
  pannable?: boolean;
}

export type GpuElementsDefinition =
  | GpuElementDefinition[]
  | { nodes?: GpuElementDefinition[]; edges?: GpuElementDefinition[] };

/**
 * Ids as bytes: one UTF-8 blob + prefix byte offsets (length count + 1).
 * Zero-length entries are auto-generated.  This is the wire format's id
 * representation, and the store ingests it without materializing any JS
 * strings — id strings are decoded lazily, per element touched.
 */
export interface GpuPackedIds {
  offsets: Uint32Array;
  blob: Uint8Array;
}

/**
 * A dictionary-encoded string data column: `indices[i]` is a 1-based
 * index into `dict` (0 = absent).  Data values repeat heavily, so this
 * is both the compact in-memory shape and the wire shape.
 */
export interface GpuDictColumn {
  dict: string[];
  indices: Uint32Array;
}

/**
 * One data() column, index-aligned with the payload: a plain array
 * (holes/undefined = absent), a Float64Array (NaN = absent), or a
 * dictionary-encoded string column.
 */
export type GpuDataColumn = ArrayLike<unknown> | Float64Array | GpuDictColumn;

/** Columnar node payload; all arrays are index-aligned with `count`. */
export interface GpuColumnarNodes {
  count: number;
  /** unique ids; missing entries (or the whole array) are auto-generated */
  ids?: ( string | undefined )[] | GpuPackedIds;
  /** interleaved x,y pairs, length 2 × count; omitted = all (0, 0) */
  positions?: Float32Array;
  /** 1 = selected; omitted = all unselected */
  selected?: Uint8Array;
  /** 0 = unselectable; omitted = all selectable */
  selectable?: Uint8Array;
  /** data() sidecar columns by key */
  data?: Record<string, GpuDataColumn>;
}

/** Columnar edge payload; endpoints are indices into the payload's nodes. */
export interface GpuColumnarEdges {
  count: number;
  ids?: ( string | undefined )[] | GpuPackedIds;
  /** source node index per edge (into the payload's nodes), length count */
  sources: Uint32Array;
  /** target node index per edge (into the payload's nodes), length count */
  targets: Uint32Array;
  selected?: Uint8Array;
  selectable?: Uint8Array;
  /** data() sidecar columns by key */
  data?: Record<string, GpuDataColumn>;
}

/**
 * Columnar bulk-load form of `elements`: typed-array columns ingest
 * directly into the store with no per-element objects, and edges resolve
 * endpoints by index with no id lookups.  Payloads are self-contained —
 * every edge endpoint must index a node in the same payload.  Convert
 * definition-form JSON with `cytoscapeGpu.toColumnarElements(json)`.
 */
export interface GpuColumnarElements {
  /** discriminant so the loader can tell the forms apart */
  columnar: true;
  nodes?: GpuColumnarNodes;
  edges?: GpuColumnarEdges;
}

/**
 * Any accepted `elements` input: the definition form (v3-style JSON), a
 * single definition, the columnar bulk-load form, or a binary buffer from
 * `cytoscapeGpu.serializeElements` (one little-endian ArrayBuffer +
 * header — fetch it as binary and pass it straight in; no JSON parse).
 */
export type GpuElementsInput =
  | GpuElementsDefinition
  | GpuElementDefinition
  | GpuColumnarElements
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
export interface GpuMapper {
  /** data() sidecar key to read */
  data: string;
  scale?: 'linear' | 'log' | 'sqrt' | 'pow' | 'symlog'
    | 'diverging' | 'ordinal' | 'threshold' | 'quantize';
  /** ascending numeric stops (categories for 'ordinal'); 'auto'/omitted = live data extent */
  domain?: ( string | number )[] | 'auto';
  /** output stops (numbers, colors, or keywords), or a named color scheme */
  range?: ( string | number )[] | string;
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
export interface GpuCondition {
  /** the data key to compare ('id' reads the first-class id); omitted
   * for the structural forms below */
  data?: string;
  eq?: string | number;
  ne?: string | number;
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
  in?: ( string | number )[];
  /** structural (round 14.7, nodes only): the element has >= 1 child.
   * A structural condition stands alone — AND it with data conditions
   * via the `when` array form. */
  parent?: boolean;
  /** structural (round 14.7, nodes only): the element has a parent */
  child?: boolean;
}

/** One case clause: `when` (a condition, or an array AND-ed together) → `then`. */
export interface GpuCaseClause {
  when: GpuCondition | GpuCondition[];
  then: string | number;
}

/**
 * A conditional mapper: the first clause whose `when` holds supplies the
 * value, else `else` (or the channel default).  Clauses are tried in
 * order.  CPU-evaluated (multi-key, data-driven) — the declarative
 * replacement for `(ele) => cond ? a : b` style functions, and the
 * natural form for typed edges (`type == 'activation' → ...`).
 */
export interface GpuCaseMapper {
  case: GpuCaseClause[];
  else?: string | number;
  /** value for missing/unmappable data (defaults to `else` then the channel default) */
  fallback?: string | number;
}

/** Any data-driven style value: a scale mapper or a conditional. */
export type GpuMapperSpec = GpuMapper | GpuCaseMapper;

/** A style prop value: a constant, or a mapper object. */
export type GpuStylePropValue = string | number | GpuMapperSpec;

/**
 * Style props for one element or group; names are kebab-case or
 * camelCase.  Values are constants, scale mappers ({@link GpuMapper}), or
 * conditionals ({@link GpuCaseMapper}); `label` also takes the
 * `data(key)` mapper string ('id' reads the first-class id).
 * Node props: background-color, width, height, shape, opacity,
 * border-color, border-width, label, font-size, font-family (constant
 * only, effectively global — one font per glyph atlas), color.  Edge
 * props: line-color, width, opacity, source/target-arrow-shape and
 * -color.
 */
export type GpuStyleProps = Record<string, GpuStylePropValue>;

/**
 * The v4 stylesheet — no selectors, no style functions.  Each group key
 * is a props object whose values are constants or mapper objects; all
 * per-element variation is expressed declaratively through mappers
 * ({@link GpuMapper} scales, {@link GpuCaseMapper} conditionals), which
 * are analyzable, serializable, and evaluated on the GPU where possible.
 * Everything stays fresh automatically: a data write re-derives the
 * mapped channels of the affected elements (gated on the mapped keys).
 */
export interface GpuStylesheet {
  nodes?: GpuStyleProps;
  edges?: GpuStyleProps;
  /**
   * Compound-parent overlay (round 14.6): node props that apply to
   * parent nodes on top of the nodes group and v3's `:parent` defaults
   * (rectangle, #eee fill, 1px #ccc border, padding 10) — constants or
   * mappers — plus the compound props `padding`, `padding-relative-to`,
   * `min-width`, `min-height` and `compound-sizing-wrt-labels`
   * (constants only; `'exclude'` is the only accepted sizing value —
   * labels are excluded from bounding boxes in v4).
   */
  parents?: GpuStyleProps;
  /**
   * Core (viewport-level) theming props (round 13 A2), constants only:
   * `selection-box-color`/`-opacity`/`-border-color`/`-border-width`
   * (the DOM selection box) and `active-bg-color`/`-opacity`/`-size`
   * (the background-grab indicator circle).  v3's core-selector props.
   */
  core?: GpuStyleProps;
}

/**
 * Options for `cy.png()`/`cy.jpg()` image export.  Export is async (the
 * pixels are rendered on and read back from the GPU) and only available
 * on rendered instances — headless instances reject.
 */
export interface GpuExportOptions {
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

export type GpuBoundingBoxInput = { x1: number; y1: number; x2?: number; y2?: number; w?: number; h?: number };

/** Options shared by the discrete layouts (scope, fit, spacing, animation). */
export interface GpuLayoutBaseOptions {
  /** the elements to lay out (set automatically by `eles.layout()`); defaults to the whole graph */
  eles?: unknown;
  fit?: boolean;
  padding?: number;
  boundingBox?: GpuBoundingBoxInput;
  /** include labels in node dimensions (v4 note: label metrics are not in bb yet) */
  nodeDimensionsIncludeLabels?: boolean;
  spacingFactor?: number;
  /** transform a computed position (e.g. to flip an axis) */
  transform?: ( node: unknown, position: Position ) => Position;
  /** whether to animate node positions into place */
  animate?: boolean;
  animationDuration?: number;
  animationEasing?: string;
  /** which nodes animate (others jump); all by default */
  animateFilter?: ( node: unknown, i: number ) => boolean;
  /** callback on layoutready */
  ready?: () => void;
  /** callback on layoutstop */
  stop?: () => void;
  /** zoom to set when fit is false */
  zoom?: number;
  /** pan to set when fit is false */
  pan?: Position;
}

export interface GpuGridLayoutOptions extends GpuLayoutBaseOptions {
  name: 'grid';
  avoidOverlap?: boolean;
  avoidOverlapPadding?: number;
  condense?: boolean;
  rows?: number;
  cols?: number;
  /** returns a fixed { row, col } for a node handle */
  position?: ( node: unknown ) => { row?: number; col?: number } | undefined;
  /** comparator over node handles */
  sort?: ( a: unknown, b: unknown ) => number;
}

export interface GpuPresetLayoutOptions extends GpuLayoutBaseOptions {
  name: 'preset';
  /** node id → position map, or a function of a node handle; absent nodes keep their position */
  positions?: Record<string, Position> | ( ( node: unknown ) => Position | null | undefined );
}

export interface GpuCircleLayoutOptions extends GpuLayoutBaseOptions {
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
  sort?: ( a: unknown, b: unknown ) => number;
}

export interface GpuConcentricLayoutOptions extends GpuLayoutBaseOptions {
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
  concentric?: ( node: unknown ) => number;
  /** the variation of concentric values per level (default: maxDegree / 4) */
  levelWidth?: ( nodes: unknown ) => number;
}

export interface GpuBreadthFirstLayoutOptions extends GpuLayoutBaseOptions {
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
  depthSort?: ( a: unknown, b: unknown ) => number;
  /** shift nodes down to their maximal depths (DAGs only) */
  maximal?: boolean;
  /** with maximal: the graph is known acyclic (no cycle bail-out) */
  acyclic?: boolean;
}

export interface GpuRandomLayoutOptions extends GpuLayoutBaseOptions {
  name: 'random';
}

export type GpuLayoutOptions =
  GpuGridLayoutOptions | GpuPresetLayoutOptions | GpuCircleLayoutOptions |
  GpuConcentricLayoutOptions | GpuBreadthFirstLayoutOptions | GpuRandomLayoutOptions;

/** Renderer tuning knobs (all LOD values in device px). */
export interface GpuRendererOptions {
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

export interface CytoscapeGpuOptions {
  /**
   * Where to render.  When given, WebGPU is required: the factory throws
   * synchronously if `navigator.gpu` is missing.  When omitted, the instance
   * is headless (works in Node, never throws for missing GPU).
   */
  container?: HTMLElement | null;
  elements?: GpuElementsInput;
  style?: GpuStylesheet;
  layout?: GpuLayoutOptions;
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
  /** 'single' (tap/box replaces the selection) or 'additive' (taps toggle, boxes add); default 'single' */
  selectionType?: 'single' | 'additive';
  /** the dbltap/onetap debounce window in ms (default 250, as v3) */
  multiClickDebounceTime?: number;
  /** rendered dimensions used when headless */
  headlessWidth?: number;
  headlessHeight?: number;
  /** device pixel ratio override; defaults to the window's */
  pixelRatio?: number | 'auto';
  renderer?: GpuRendererOptions;
}
