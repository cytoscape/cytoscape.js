// Shared structural types for the built-in layouts. Each layout is a
// constructor function whose prototype is wrapped by src/extension.mts
// (which adds the event emitter methods). These types describe the
// instance (`this`) and the common options every layout receives.

import type { Core } from '../../core/core-types.mjs';
import type { Collection } from '../../collection/eles-types.mjs';
import type { BoundingBox } from '../../types.mjs';

export type { Core, Collection };

/** Emitter methods grafted onto every layout instance by the extension wrapper. */
export interface LayoutEmitter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- emit forwards arbitrary extra params
  emit( events: string, ...extra: any[] ): this;
  one( events: string, handler: ( ...args: unknown[] ) => void ): this;
  on( events: string, handler: ( ...args: unknown[] ) => void ): this;
  off( events: string, handler?: ( ...args: unknown[] ) => void ): this;
  trigger( events: unknown ): this;
  removeAllListeners(): this;
}

/** Options common to all built-in layouts (each layout extends this). */
export interface LayoutOptionsBase {
  cy: Core;
  eles: Collection;
  fit?: boolean;
  padding?: number;
  boundingBox?: BoundingBox | { x1: number; y1: number; w: number; h: number } | undefined;
  animate?: boolean | 'end' | 'during';
  animationDuration?: number;
  animationEasing?: string;
  animateFilter?: ( node: Collection, i: number ) => boolean;
  ready?: () => void;
  stop?: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- per-layout options vary widely
  transform?: ( node: Collection, position: any ) => any;
  [key: string]: unknown;
}

/** The runtime layout instance (`this` inside layout methods). */
export interface LayoutBase extends LayoutEmitter {
  options: LayoutOptionsBase;
  run(): this;
  start(): this;
  stop(): this;
  destroy(): this;
  cy(): Core;
}
