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
}

export interface GpuElementDefinition {
  /** inferred from `data.source`/`data.target` when omitted */
  group?: 'nodes' | 'edges';
  data?: GpuElementData;
  /** nodes only */
  position?: Position;
  selected?: boolean;
  selectable?: boolean;
}

export type GpuElementsDefinition =
  | GpuElementDefinition[]
  | { nodes?: GpuElementDefinition[]; edges?: GpuElementDefinition[] };

/** Columnar node payload; all arrays are index-aligned with `count`. */
export interface GpuColumnarNodes {
  count: number;
  /** unique ids; missing entries (or the whole array) are auto-generated */
  ids?: ( string | undefined )[];
  /** interleaved x,y pairs, length 2 × count; omitted = all (0, 0) */
  positions?: Float32Array;
  /** 1 = selected; omitted = all unselected */
  selected?: Uint8Array;
  /** 0 = unselectable; omitted = all selectable */
  selectable?: Uint8Array;
}

/** Columnar edge payload; endpoints are indices into the payload's nodes. */
export interface GpuColumnarEdges {
  count: number;
  ids?: ( string | undefined )[];
  /** source node index per edge (into the payload's nodes), length count */
  sources: Uint32Array;
  /** target node index per edge (into the payload's nodes), length count */
  targets: Uint32Array;
  selected?: Uint8Array;
  selectable?: Uint8Array;
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
 * A constrained compiled-style block: constant values only (no mappers).
 * Supported selectors: `node`, `edge`, `node:selected`, `edge:selected`, `#id`.
 * Node props: background-color, width, height, shape, opacity, border-color,
 * border-width.  Edge props: line-color, width, opacity.
 */
export interface GpuStyleBlock {
  selector: string;
  style: Record<string, string | number>;
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
  style?: GpuStyleBlock[];
  layout?: GpuGridLayoutOptions;
  zoom?: number;
  pan?: Position;
  minZoom?: number;
  maxZoom?: number;
  /** rendered dimensions used when headless */
  headlessWidth?: number;
  headlessHeight?: number;
  /** device pixel ratio override; defaults to the window's */
  pixelRatio?: number | 'auto';
  renderer?: GpuRendererOptions;
}
