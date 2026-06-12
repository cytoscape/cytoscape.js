// Central type declarations for the collection module. Type-only: no
// runtime exports. The runtime Collection/Element constructor functions
// live in ./index.mts and ./element.mts; the wide `Collection` interface
// here is assembled from the per-mixin contribution interfaces, mirroring
// the runtime prototype assembly.
//
// `Element extends Collection` mirrors the runtime fact that an element
// is array-like and shares the collection prototype (and the public
// d.ts's `Singular extends Collection`).

import type { Position, BoundingBox } from '../types.mjs';
import type { MapLike } from '../map.mjs';
import type { SetLike } from '../set.mjs';
import type Animation from '../animation.mjs';
import type Emitter from '../emitter.mjs';
import type { ParsedStyleProperty } from '../style/parse.mjs';

// per-mixin contribution interfaces (each mixin file exports its own)
import type { CollectionAlgorithms } from './algorithms/index.mjs';
import type { CollectionAnimation } from './animation.mjs';
import type { CollectionClass } from './class.mjs';
import type { CollectionComparators } from './comparators.mjs';
import type { CollectionCompounds } from './compounds.mjs';
import type { CollectionData } from './data.mjs';
import type { CollectionDegree } from './degree.mjs';
import type { CollectionDimensions } from './dimensions/index.mjs';
import type { CollectionEvents } from './events.mjs';
import type { CollectionFilter } from './filter.mjs';
import type { CollectionGroup } from './group.mjs';
import type { CollectionIteration } from './iteration.mjs';
import type { CollectionLayout } from './layout.mjs';
import type { CollectionStyle } from './style.mjs';
import type { CollectionSwitchFunctions } from './switch-functions.mjs';
import type { CollectionTraversing } from './traversing.mjs';

/**
 * The collection module's structural view of the Core. Grown as needed
 * by collection code; src/core's real Core type must satisfy it (it is
 * swapped in during the core conversion phase).
 */
export interface CoreAccess {
  hasElementWithId( id: string | number ): boolean;
  getElementById( id: string | number ): Collection;
  collection( eles?: unknown, opts?: unknown ): Collection;
  batch( fn: () => void ): unknown;
  startBatch(): unknown;
  endBatch(): unknown;
  batching(): boolean;
  addToPool( eles: Collection | Element ): unknown;
  removeFromPool( eles: Collection | Element[] ): unknown;
  addToAnimationPool( eles: Collection | Element ): void;
  zoom(): number;
  pan(): Position;
  styleEnabled(): boolean;
  style(): CoreStyleAccess;
  notify( event: string, eles?: Collection ): void;
  renderer(): CoreRendererAccess;
  hasCompoundNodes(): boolean;
  headless(): boolean;
  destroyed(): boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- emit passes through arbitrary extra params
  emit( events: string, extraParams?: any[] ): unknown;
  _private: CorePrivateAccess;
}

export interface CorePrivateAccess {
  elements: Collection;
  hasCompoundNodes: boolean;
  [key: string]: unknown;
}

/** Loose structural view of the style engine as used by collection code. */
export interface CoreStyleAccess {
  apply( eles: Collection | Element ): unknown;
  applyBypass( eles: Collection | Element, name?: unknown, value?: unknown, updateTransitions?: boolean ): unknown;
  removeBypasses( eles: Collection | Element, names?: string[], updateTransitions?: boolean ): unknown;
  getPropsList( props: unknown ): unknown;
  getRenderedStyle( ele: Element, prop?: string ): unknown;
  getRawStyle( ele: Element, isRenderedVal?: boolean ): unknown;
  getStylePropertyValue( ele: Element, propName: string, isRenderedVal?: boolean ): unknown;
  update(): unknown;
  updateTransitions( ele: Element, diffProps: unknown ): unknown;
  updateMappers( eles: Collection | Element ): unknown;
  [key: string]: unknown;
}

/** Loose structural view of the renderer as used by collection code. */
export interface CoreRendererAccess {
  notify?( event: string, eles?: Collection ): void;
  [key: string]: unknown;
}

/** An entry in a collection's id => element map. */
export interface ElesEntry {
  ele: Element;
  index: number;
}

export interface ElementData {
  id?: string;
  source?: string;
  target?: string;
  parent?: string;
  [key: string]: unknown;
}

/** JSON definition used to create an element. */
export interface ElementDefinition {
  group?: 'nodes' | 'edges';
  data?: ElementData;
  position?: Position;
  renderedPosition?: Position;
  selected?: boolean;
  selectable?: boolean;
  locked?: boolean;
  grabbable?: boolean;
  pannable?: boolean;
  classes?: string | string[];
  style?: Record<string, unknown>;
  css?: Record<string, unknown>;
  scratch?: Record<string, unknown>;
  parent?: Element | null;
}

/** The shape produced/consumed by `eles.json()`. */
export interface ElementJson {
  data: ElementData;
  position: Position;
  group: 'nodes' | 'edges';
  removed: boolean;
  selected: boolean;
  selectable: boolean;
  locked: boolean;
  grabbable: boolean;
  pannable: boolean;
  classes: string | null;
}

/**
 * Private state shared by collections and elements. The collection-only
 * members are optional so that ElementPrivate remains a subtype (and
 * therefore Element remains assignable to Collection).
 */
export interface CollectionPrivate {
  cy: CoreAccess;
  map: MapLike<string, ElesEntry>;
  eles?: Collection;
  lazyMap?: MapLike<string, ElesEntry> | null;
  rebuildMap?(): void;
  single?: boolean;
}

/** Per-element private state (see the literal in element.mts). */
/** @internal */
export interface ElementPrivate extends CollectionPrivate {
  single: true;
  data: ElementData;
  position: Position;
  autoWidth?: number;
  autoHeight?: number;
  autoPadding?: number;
  compoundBoundsClean: boolean;
  listeners: unknown[];
  group: 'nodes' | 'edges';
  style: Record<string, ParsedStyleProperty | undefined>;
  rstyle: Record<string, unknown>;
  styleCxts: unknown[];
  styleKeys: Record<string, unknown>;
  removed: boolean;
  selected: boolean;
  selectable: boolean;
  locked: boolean;
  grabbed: boolean;
  grabbable: boolean;
  pannable: boolean;
  active: boolean;
  classes: SetLike<string>;
  animation: {
    current: Animation[];
    queue: Animation[];
  };
  rscratch: Record<string, unknown>;
  scratch: Record<string, unknown>;
  edges: Element[];
  children: Element[];
  parent: Element | null;
  traversalCache: Record<string, unknown>;
  backgrounding: boolean;
  bbCache: ( BoundingBox & Record<string, unknown> ) | null;
  bbCacheShift: Position;
  bodyBounds: ( BoundingBox & Record<string, unknown> ) | null;
  overlayBounds: ( BoundingBox & Record<string, unknown> ) | null;
  labelBounds: Record<string, ( BoundingBox & Record<string, unknown> ) | null>;
  arrowBounds: Record<string, ( BoundingBox & Record<string, unknown> ) | null>;
  emitter?: Emitter<Element>;
  source?: Element;
  target?: Element;
  [key: string]: unknown;
}

/** Inputs accepted where elements are expected (constructor, spawn, ...). */
export type ElementsInput =
  Element[] | Collection | ElementDefinition[] | ( Element | Collection )[] | ( Element | ElementDefinition )[];

/** Methods defined directly in collection/index.mts (not via mixins). */
export interface CollectionBaseFns {
  instanceString(): string;
  /** @internal */
  spawn( eles?: ElementsInput, unique?: boolean ): Collection;
  /** @internal */
  spawnSelf(): Collection;
  cy(): CoreAccess;
  /** @internal */
  renderer(): CoreRendererAccess;
  /** @internal */
  element(): Element | undefined;
  /** @internal */
  collection(): Collection;
  /** @internal */
  unique(): Collection;
  /** @internal */
  hasElementWithId( id: string | number ): boolean;
  getElementById( id: string | number ): Collection;
  $id( id: string | number ): Collection;
  /** @internal */
  poolIndex(): number;
  /** @internal */
  indexOf( ele: Collection | Element ): number;
  /** @internal */
  indexOfId( id: string | number ): number;
  json( obj?: Partial<ElementJson> ): ElementJson | this | undefined;
  jsons(): ( ElementJson | undefined )[];
  clone(): Collection;
  copy(): Collection;
  restore( notifyRenderer?: boolean, addToPool?: boolean ): this;
  removed(): boolean;
  inside(): boolean;
  remove( notifyRenderer?: boolean, removeFromPool?: boolean ): Collection;
  move( struct: { source?: string | number; target?: string | number; parent?: string | number | null } ): this;
}

/**
 * The wide internal collection type: the union of node and edge
 * capabilities, matching how the shared prototype actually behaves at
 * runtime. Public node/edge-narrowed projections are layered on top in
 * the entry point's public API types.
 */
export interface Collection extends
  CollectionBaseFns,
  CollectionAlgorithms,
  CollectionAnimation,
  CollectionClass,
  CollectionComparators,
  CollectionCompounds,
  CollectionData,
  CollectionDegree,
  CollectionDimensions,
  CollectionEvents,
  CollectionFilter,
  CollectionGroup,
  CollectionIteration,
  CollectionLayout,
  CollectionStyle,
  CollectionSwitchFunctions,
  CollectionTraversing {

  length: number;
  [index: number]: Element;
  /** @internal */
  _private: CollectionPrivate;
}

/** A single element (node or edge); array-like of itself, length 1. */
export interface Element extends Collection {
  /** @internal */
  _private: ElementPrivate;
}

type PublicSelectorArg = string | Collection | Element | ( ( ele: Element, i: number, eles: Collection ) => boolean | unknown ) | undefined | null;

export interface Singular extends Element {}

export interface NodeCollection extends Collection {
  parent( selector?: PublicSelectorArg ): NodeCollection;
  parents( selector?: PublicSelectorArg ): NodeCollection;
  ancestors( selector?: PublicSelectorArg ): NodeCollection;
  commonAncestors( selector?: PublicSelectorArg ): NodeCollection;
  orphans( selector?: PublicSelectorArg ): NodeCollection;
  nonorphans( selector?: PublicSelectorArg ): NodeCollection;
  children( selector?: PublicSelectorArg ): NodeCollection;
  siblings( selector?: PublicSelectorArg ): NodeCollection;
  descendants( selector?: PublicSelectorArg ): NodeCollection;
  roots( selector?: PublicSelectorArg ): NodeCollection;
  leaves( selector?: PublicSelectorArg ): NodeCollection;
  connectedEdges( selector?: PublicSelectorArg ): EdgeCollection;
}

export interface EdgeCollection extends Collection {
  source( selector?: PublicSelectorArg ): NodeSingular;
  target( selector?: PublicSelectorArg ): NodeSingular;
  sources( selector?: PublicSelectorArg ): NodeCollection;
  targets( selector?: PublicSelectorArg ): NodeCollection;
  edgesWith( otherNodes: string | Collection ): EdgeCollection;
  edgesTo( otherNodes: string | Collection ): EdgeCollection;
  connectedNodes( selector?: PublicSelectorArg ): NodeCollection;
  parallelEdges( selector?: PublicSelectorArg ): EdgeCollection;
  codirectedEdges( selector?: PublicSelectorArg ): EdgeCollection;
}

export type NodeSingular = Singular & NodeCollection;

export type EdgeSingular = Singular & EdgeCollection;

/** The runtime Collection constructor (a function, not a class — the
 * shared prototype is reassigned, which classes don't allow). */
/** @internal */
export interface CollectionStatic {
  new ( cy: CoreAccess, elements?: ElementsInput, unique?: boolean, removed?: boolean ): Collection;
  ( this: Collection, cy: CoreAccess, elements?: ElementsInput, unique?: boolean, removed?: boolean ): void;
  prototype: Collection;
}

/** The runtime Element constructor. */
/** @internal */
export interface ElementStatic {
  new ( cy: CoreAccess, params: ElementDefinition, restore?: boolean ): Element;
  ( this: Element, cy: CoreAccess, params: ElementDefinition, restore?: boolean ): void;
  prototype: Element;
}
