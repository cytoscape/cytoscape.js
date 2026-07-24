/*
Public option/type surface of the GPU prototype entry point.
*/

import type { Position } from '../types.mjs';
import type { GpuCollection } from './collection.mjs';

export type { Position };

export interface GpuElementData {
  id?: string;
  /** edges only; required for edges */
  source?: string;
  /** edges only; required for edges */
  target?: string;
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

/** A style prop value: a constant, or a mapper object. */
export type GpuStylePropValue = string | number | GpuMapper;

/**
 * Style props for one element or group; names are kebab-case or
 * camelCase.  Values are constants or mapper objects ({@link GpuMapper});
 * `label` also takes the `data(key)` mapper string ('id' reads the
 * first-class id).
 * Node props: background-color, width, height, shape, opacity,
 * border-color, border-width, label, font-size, color.  Edge props:
 * line-color, width, opacity, source/target-arrow-shape and -color.
 */
export type GpuStyleProps = Record<string, GpuStylePropValue>;

/** Per-element style function; a nullish return means group defaults. */
export type GpuStyleFn = ( ele: GpuCollection ) => GpuStyleProps | null | undefined;

/**
 * The v4 stylesheet — no selectors.  Each group key holds either a props
 * object (constants for the whole group) or a per-element function.
 * Constant props and declarative mappers stay fresh automatically;
 * function styles are evaluated when the sheet is set and when elements
 * are added, and re-run only on an explicit `cy.style(sheet)` /
 * `cy.style().update()`.
 */
export interface GpuStylesheet {
  nodes?: GpuStyleProps | GpuStyleFn;
  edges?: GpuStyleProps | GpuStyleFn;
}

export interface GpuGridLayoutOptions {
  name: 'grid';
  fit?: boolean;
  padding?: number;
  boundingBox?: { x1: number; y1: number; x2?: number; y2?: number; w?: number; h?: number };
  avoidOverlap?: boolean;
  avoidOverlapPadding?: number;
  spacingFactor?: number;
  condense?: boolean;
  rows?: number;
  cols?: number;
  /** returns a fixed { row, col } for a node handle */
  position?: ( node: unknown ) => { row?: number; col?: number } | undefined;
  /** comparator over node handles */
  sort?: ( a: unknown, b: unknown ) => number;
}

export interface GpuPresetLayoutOptions {
  name: 'preset';
  /** node id → position map, or a function of a node handle; absent nodes keep their position */
  positions?: Record<string, Position> | ( ( node: unknown ) => Position | null | undefined );
  /** zoom to set when fit is false */
  zoom?: number;
  /** pan to set when fit is false */
  pan?: Position;
  fit?: boolean;
  padding?: number;
}

export type GpuLayoutOptions = GpuGridLayoutOptions | GpuPresetLayoutOptions;

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
  /** rendered dimensions used when headless */
  headlessWidth?: number;
  headlessHeight?: number;
  /** device pixel ratio override; defaults to the window's */
  pixelRatio?: number | 'auto';
  renderer?: GpuRendererOptions;
}
