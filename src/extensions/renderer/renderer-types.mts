// Shared types for the built-in renderers (base + canvas + webgl).
//
// This code is entirely @internal — it never appears in the generated
// public d.ts. The renderer instance is assembled at runtime from ~40
// prototype-mixin files across base/ and canvas/; declaration-merging all
// of them would be enormous and low-value here. Instead we model the
// instance as a single permissive interface: load-bearing fields are
// typed, and the open-ended tail of mixin methods/fields is reached
// through a documented index signature. Per-file params, locals and data
// structures are still typed honestly in each converted file.

import type { Core } from '../../core/core-types.mjs';
import type { Collection, SharedCollection, Element } from '../../collection/eles-types.mjs';
import type { Position } from '../../types.mjs';

export type { Core, Collection, SharedCollection, Element, Position };

/* eslint-disable @typescript-eslint/no-explicit-any --
   the renderer prototype-mixin surface is open-ended and internal */

export type RenderingContext = CanvasRenderingContext2D | WebGL2RenderingContext;

/** Per-renderer canvas/context bookkeeping (`renderer.data`). */
export interface RendererData {
  canvases?: HTMLCanvasElement[];
  contexts?: ( RenderingContext | null )[];
  canvasNeedsRedraw?: boolean[];
  bufferCanvases?: HTMLCanvasElement[];
  bufferContexts?: ( RenderingContext | null )[];
  canvasContainer?: HTMLElement;
  topCanvas?: HTMLCanvasElement;
  [key: string]: any;
}

/** Options passed to a renderer constructor (`renderer.options`). */
export interface RendererOptions {
  cy: Core;
  [key: string]: any;
}

/**
 * The runtime renderer instance (`this` inside renderer methods). Known
 * fields are typed; everything contributed by the many prototype mixins is
 * reached via the index signature.
 */
export interface Renderer {
  cy: Core;
  options: RendererOptions;
  container: HTMLElement | null;
  data: RendererData;
  [key: string]: any;
}
