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
  /** labels fade out as on-screen glyph height drops below this (default 6) */
  labelFadePx?: number;
  /** labels below this on-screen glyph height are not rendered at all —
   * too small to read anyway (default 0 = off; the fade's own cutoff at
   * labelFadePx/2 still applies) */
  labelMinPx?: number;
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
  elements?: GpuElementsDefinition;
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
