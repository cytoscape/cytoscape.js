// Central type declarations for the core module. Type-only. The runtime
// Core constructor lives in ./index.mts; the wide `Core` interface here is
// assembled from the per-mixin contribution interfaces, mirroring the
// runtime prototype assembly (parallel to collection/eles-types.mts).

import type { Collection, Element, CoreStyleAccess, ElementDefinition } from '../collection/eles-types.mjs';
import type { StyleJson } from '../style/json.mjs';
import type { Position, BoundingBox } from '../types.mjs';
import type Emitter from '../emitter.mjs';
import type Animation from '../animation.mjs';

// per-mixin contribution interfaces (each core mixin file exports its own)
import type { CoreAddRemove } from './add-remove.mjs';
import type { CoreAnimation } from './animation/index.mjs';
import type { CoreEvents } from './events.mjs';
import type { CoreExport } from './export.mjs';
import type { CoreLayout } from './layout.mjs';
import type { CoreNotification } from './notification.mjs';
import type { CoreRenderer } from './renderer.mjs';
import type { CoreSearch } from './search.mjs';
import type { CoreStyle } from './style.mjs';
import type { CoreViewport } from './viewport.mjs';
import type { CoreData } from './data.mjs';

export type { Collection, Element };

/** A layout instance produced by `cy.layout()` / `cy.makeLayout()`. */
export interface LayoutInstance {
  run(): this;
  start(): this;
  stop(): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- layout emits/accepts arbitrary handler args
  on( events: string, handler: ( ...args: any[] ) => void ): this;
  one( events: string, handler: ( ...args: unknown[] ) => void ): this;
  off( events: string, handler?: ( ...args: unknown[] ) => void ): this;
  trigger( events: unknown ): this;
  [key: string]: unknown;
}

/** A registered renderer instance. */
export interface RendererInstance {
  isHeadless(): boolean;
  notify( eles?: Collection, evts?: unknown ): void;
  [key: string]: unknown;
}

interface StylesheetLike {
  generateStyle( cy: unknown ): unknown;
}

/** Options accepted by the `cytoscape(...)` factory. */
export interface CytoscapeOptions {
  container?: HTMLElement | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- elements accept the broad public json/collection forms
  elements?: any;
  style?: string | StyleJson | Promise<StyleJson> | StylesheetLike;
  layout?: { name?: string; [key: string]: unknown };
  data?: Record<string, unknown>;
  zoom?: number;
  pan?: Position;
  minZoom?: number;
  maxZoom?: number;
  zoomingEnabled?: boolean;
  userZoomingEnabled?: boolean;
  panningEnabled?: boolean;
  userPanningEnabled?: boolean;
  boxSelectionEnabled?: boolean;
  selectionType?: 'single' | 'additive';
  autolock?: boolean;
  autolockNodes?: boolean; // legacy alias
  autoungrabify?: boolean;
  autoungrabifyNodes?: boolean; // legacy alias
  autounselectify?: boolean;
  styleEnabled?: boolean;
  headless?: boolean;
  multiClickDebounceTime?: number;
  renderer?: { name?: string; [key: string]: unknown };
  hideEdgesOnViewport?: boolean;
  textureOnViewport?: boolean;
  wheelSensitivity?: number;
  motionBlur?: boolean;
  ready?: ( evt: unknown ) => void;
  done?: () => void;
  // additional renderer/extension hints are accepted
  [key: string]: unknown;
}

/** Internal core state (`cy._private`). Tagged @internal at use sites. */
/** @internal */
export interface CorePrivate {
  container: HTMLElement | null;
  ready: boolean;
  options: CytoscapeOptions & { layout: { name?: string; [k: string]: unknown }; renderer: { name?: string; [k: string]: unknown } };
  elements: Collection;
  listeners: unknown[];
  aniEles: Collection;
  data: Record<string, unknown>;
  scratch: Record<string, unknown>;
  layout: LayoutInstance | null;
  renderer: RendererInstance | null;
  destroyed: boolean;
  notificationsEnabled: boolean;
  minZoom: number;
  maxZoom: number;
  zoomingEnabled: boolean;
  userZoomingEnabled: boolean;
  panningEnabled: boolean;
  userPanningEnabled: boolean;
  boxSelectionEnabled: boolean;
  autolock: boolean;
  autoungrabify: boolean;
  autounselectify: boolean;
  styleEnabled: boolean;
  zoom: number;
  pan: Position;
  animation: { current: Animation[]; queue: Animation[] };
  hasCompoundNodes: boolean;
  multiClickDebounceTime: number;
  emitter?: Emitter<Core>;
  style?: CoreStyleAccess;
  batchCount?: number;
  batchingStyle?: boolean;
  batchStyleEles?: Collection;
  selectionType?: 'single' | 'additive';
  [key: string]: unknown;
}

/** Methods defined directly in core/index.mts (not via mixins). */
export interface CoreBaseFns {
  instanceString(): string;
  /** @internal */
  isReady(): boolean;
  destroyed(): boolean;
  ready( fn: ( evt: unknown ) => void ): this;
  destroy(): this | undefined;
  /** @internal */
  hasElementWithId( id: string | number ): boolean;
  getElementById( id: string | number ): Collection;
  $id( id: string | number ): Collection;
  /** @internal */
  hasCompoundNodes(): boolean;
  /** @internal */
  headless(): boolean;
  /** @internal */
  styleEnabled(): boolean;
  /** @internal */
  addToPool( eles: Collection | Element ): this;
  /** @internal */
  removeFromPool( eles: Collection | Element[] ): this;
  container(): HTMLElement | null;
  /** @internal */
  window(): Window | null;
  mount( container: HTMLElement ): this | undefined;
  unmount(): this;
  /** @internal */
  options(): CytoscapeOptions;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- json get/set is broad and shape-dependent
  json( obj?: any ): any;
  // installed by src/extension.mts; lets a core reach the extension registry
  /** @internal */
  extension( type: string, name: string, ...args: unknown[] ): unknown;
}

/**
 * The full Core instance type: the union of all mixin contributions plus
 * the base methods. Structurally a superset of the collection module's
 * `CoreAccess`, so a Core is accepted wherever CoreAccess is required.
 */
export interface Core extends
  CoreBaseFns,
  CoreAddRemove,
  CoreAnimation,
  CoreEvents,
  CoreExport,
  CoreLayout,
  CoreNotification,
  CoreRenderer,
  CoreSearch,
  CoreStyle,
  CoreViewport,
  CoreData {
  /** @internal */
  _private: CorePrivate;
}

/** The runtime Core constructor (a function, mirroring Collection). */
/** @internal */
export interface CoreStatic {
  new ( opts?: CytoscapeOptions ): Core;
  ( this: Core, opts?: CytoscapeOptions ): void;
  prototype: Core;
}

// re-exports used widely by core mixins
export type { Position, BoundingBox, ElementDefinition };
