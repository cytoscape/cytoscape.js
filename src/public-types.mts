// Public compatibility type surface.
//
// These names were available from the v3 `cytoscape` namespace.  Keeping the
// aliases in source means the generated declaration supports both legacy
// `cytoscape.Type` references and ESM named type imports.

import type AnimationClass from './animation.mjs';
import type { AnimationOptions as RuntimeAnimationOptions } from './animation.mjs';
import type {
  Collection as RuntimeCollection,
  EdgeCollection as RuntimeEdgeCollection,
  EdgeSingular as RuntimeEdgeSingular,
  ElementData,
  ElementDefinition as RuntimeElementDefinition,
  ElementJson,
  NodeCollection as RuntimeNodeCollection,
  NodeSingular as RuntimeNodeSingular,
  SharedCollection as RuntimeSharedCollection,
} from './collection/eles-types.mjs';
import type { CollectionAlgorithms as RuntimeCollectionAlgorithms } from './collection/algorithms/index.mjs';
import type { AStarOptions, AStarResult } from './collection/algorithms/a-star.mjs';
import type { AffinityPropagationOptions as RuntimeAffinityPropagationOptions } from './collection/algorithms/affinity-propagation.mjs';
import type { BellmanFordOptions, BellmanFordResult } from './collection/algorithms/bellman-ford.mjs';
import type { BetweennessCentralityOptions, BetweennessCentralityResult } from './collection/algorithms/betweenness-centrality.mjs';
import type { SearchOptions, SearchResult, SearchVisitFn } from './collection/algorithms/bfs-dfs.mjs';
import type { ClosenessCentralityOptions, ClosenessCentralityNormalizedResult } from './collection/algorithms/closeness-centrality.mjs';
import type {
  DegreeCentralityOptions,
  DirectedDegreeCentrality,
  DirectedDegreeCentralityNormalized,
  UndirectedDegreeCentrality,
  UndirectedDegreeCentralityNormalized
} from './collection/algorithms/degree-centrality.mjs';
import type { DijkstraOptions, DijkstraResult } from './collection/algorithms/dijkstra.mjs';
import type { FloydWarshallOptions, FloydWarshallResult } from './collection/algorithms/floyd-warshall.mjs';
import type { HierarchicalClusteringOptions as RuntimeHierarchicalClusteringOptions } from './collection/algorithms/hierarchical-clustering.mjs';
import type { HierholzerOptions as RuntimeHierholzerOptions, HierholzerResult as RuntimeHierholzerResult } from './collection/algorithms/hierholzer.mjs';
import type { FuzzyCMeansResult as RuntimeFuzzyCMeansResult, KClusteringOptions } from './collection/algorithms/k-clustering.mjs';
import type { MarkovClusteringOptions as RuntimeMarkovClusteringOptions } from './collection/algorithms/markov-clustering.mjs';
import type { PageRankOptions, PageRankResult } from './collection/algorithms/page-rank.mjs';
import type { CollectionAnimation as RuntimeCollectionAnimation } from './collection/animation.mjs';
import type { CollectionComparators } from './collection/comparators.mjs';
import type { CollectionCompounds } from './collection/compounds.mjs';
import type { CollectionData as RuntimeCollectionData } from './collection/data.mjs';
import type { BoundingBoxOptions as RuntimeBoundingBoxOptions, CollectionBounds } from './collection/dimensions/bounds.mjs';
import type { CollectionDimensions } from './collection/dimensions/index.mjs';
import type { CollectionPosition as RuntimeCollectionPosition } from './collection/dimensions/position.mjs';
import type { CollectionEdgePoints } from './collection/dimensions/edge-points.mjs';
import type { CollectionEvents as RuntimeCollectionEvents } from './collection/events.mjs';
import type { CollectionFilter } from './collection/filter.mjs';
import type { CollectionIteration as RuntimeCollectionIteration } from './collection/iteration.mjs';
import type {
  CollectionLayout as RuntimeCollectionLayout,
  LayoutDimensionsOptions as RuntimeLayoutDimensionsOptions,
  LayoutOptions as RuntimeLayoutPositionOptions
} from './collection/layout.mjs';
import type { CollectionStyle as RuntimeCollectionStyle } from './collection/style.mjs';
import type { CollectionSwitchFunctions } from './collection/switch-functions.mjs';
import type { CollectionTraversing as RuntimeCollectionTraversing } from './collection/traversing.mjs';
import type { CoreAnimation as RuntimeCoreAnimation } from './core/animation/index.mjs';
import type {
  Core as RuntimeCore,
  CytoscapeOptions as RuntimeCytoscapeOptions,
  LayoutInstance,
  RendererInstance
} from './core/core-types.mjs';
import type { CoreData as RuntimeCoreData } from './core/data.mjs';
import type { CoreEvents as RuntimeCoreEvents } from './core/events.mjs';
import type {
  CoreExport as RuntimeCoreExport,
  ExportBlobOptions as RuntimeExportBlobOptions,
  ExportBlobPromiseOptions as RuntimeExportBlobPromiseOptions,
  ExportJpgBlobOptions as RuntimeExportJpgBlobOptions,
  ExportJpgBlobPromiseOptions as RuntimeExportJpgBlobPromiseOptions,
  ExportJpgOptions as RuntimeExportJpgOptions,
  ExportJpgStringOptions as RuntimeExportJpgStringOptions,
  ExportOptions as RuntimeExportOptions,
  ExportStringOptions as RuntimeExportStringOptions
} from './core/export.mjs';
import type { CoreLayout as RuntimeCoreLayout } from './core/layout.mjs';
import type { CoreStyle as RuntimeCoreStyle } from './core/style.mjs';
import type { CoreViewport } from './core/viewport.mjs';
import type {
  AbstractEventObject as RuntimeAbstractEventObject,
  EventHandler as RuntimeEventHandler,
  EventObject as RuntimeEventObject,
  EventObjectCore as RuntimeEventObjectCore,
  EventObjectEdge as RuntimeEventObjectEdge,
  EventObjectNode as RuntimeEventObjectNode,
  InputEventObject as RuntimeInputEventObject,
  LayoutEventObject as RuntimeLayoutEventObject
} from './event-types.mjs';
import type { BreadthFirstLayoutOptions as RuntimeBreadthFirstLayoutOptions } from './extensions/layout/breadthfirst.mjs';
import type { CircleLayoutOptions as RuntimeCircleLayoutOptions } from './extensions/layout/circle.mjs';
import type { ConcentricLayoutOptions as RuntimeConcentricLayoutOptions } from './extensions/layout/concentric.mjs';
import type { CoseLayoutOptions as RuntimeCoseLayoutOptions } from './extensions/layout/cose.mjs';
import type { GridLayoutOptions as RuntimeGridLayoutOptions } from './extensions/layout/grid.mjs';
import type { LayoutOptionsBase as RuntimeLayoutOptionsBase } from './extensions/layout/layout-base.mjs';
import type { NullLayoutOptions as RuntimeNullLayoutOptions } from './extensions/layout/null.mjs';
import type { PresetLayoutOptions as RuntimePresetLayoutOptions } from './extensions/layout/preset.mjs';
import type { RandomLayoutOptions as RuntimeRandomLayoutOptions } from './extensions/layout/random.mjs';
import type { Style as RuntimeStyle } from './style/index.mjs';
import type { Css } from './style/css-types.mjs';
import type { StyleJson, StyleJsonBlock } from './style/json.mjs';
import type { BoundingBox as RuntimeBoundingBox, BoundingBox12 as RuntimeBoundingBox12, Position as RuntimePosition } from './types.mjs';

// Primary public objects
export type Animation = AnimationClass;
export type AnimationOptions = RuntimeAnimationOptions;
export type Collection = RuntimeCollection;
export type Core = RuntimeCore;
export type CytoscapeOptions = RuntimeCytoscapeOptions;
export type EdgeCollection = RuntimeEdgeCollection;
export type EdgeSingular = RuntimeEdgeSingular;
export type Element = RuntimeSharedCollection & { length: 1 };
export type ElementDefinition = RuntimeElementDefinition;
export type { ElementJson, LayoutInstance, RendererInstance };
export type NodeCollection = RuntimeNodeCollection;
export type NodeSingular = RuntimeNodeSingular;
export type Singular = Element;
export type Position = RuntimePosition;
export type BoundingBox = RuntimeBoundingBox;
export type BoundingBox12 = RuntimeBoundingBox12;
export type BoundingBoxWH = Pick<RuntimeBoundingBox, 'x1' | 'y1' | 'w' | 'h'>;
export type BoundingBoxOptions = RuntimeBoundingBoxOptions;
export type { Css, StyleJson, StyleJsonBlock };

// Element JSON and common scalar helpers
export type ElementGroup = 'nodes' | 'edges';
export type PositionDimension = 'x' | 'y';
export type SelectionType = 'additive' | 'single';
export type Selector = string;
export type ClassName = string;
export type ClassNames = string | ClassName[];
export type Scratchpad = Record<string, unknown>;
export type CssStyleDeclaration = Css.Node | Css.Edge | Css.Core;
export type ElementDataDefinition = ElementData;
export interface NodeDataDefinition extends ElementData {
  parent?: string;
}
export interface EdgeDataDefinition extends ElementData {
  source: string;
  target: string;
}
export type NodeDefinition = Omit<RuntimeElementDefinition, 'group' | 'data'> & {
  group?: 'nodes';
  data: NodeDataDefinition;
};
export type EdgeDefinition = Omit<RuntimeElementDefinition, 'group' | 'data'> & {
  group?: 'edges';
  data: EdgeDataDefinition;
};
export interface ElementsDefinition {
  nodes: NodeDefinition[];
  edges: EdgeDefinition[];
}

// Factory and viewport helpers
export type CytoscapeRegistry = ( type: 'core' | 'collection' | 'layout', name: string, extension: unknown ) => void;
export interface ZoomOptionsModel { position: Position }
export interface ZoomOptionsRendered { renderedPosition: Position }
export interface ZoomOptionsLevel { level: number }
export type ZoomOptions = number | ( ZoomOptionsLevel & ( ZoomOptionsModel | ZoomOptionsRendered ) );

// Core contribution interfaces
export type CoreAnimation = RuntimeCoreAnimation;
export type CoreData = RuntimeCoreData;
export type CoreEvents = RuntimeCoreEvents;
export type CoreExport = RuntimeCoreExport;
export type CoreLayout = RuntimeCoreLayout;
export type CoreStyle = RuntimeCoreStyle;
export type CoreViewportManipulation = CoreViewport;
export type CoreGraphManipulation = Pick<RuntimeCore,
  | 'add' | 'remove' | 'collection'
  | 'getElementById' | '$id'
  | '$' | 'elements' | 'nodes' | 'edges' | 'filter'
  | 'batch' | 'startBatch' | 'endBatch'
  | 'mount' | 'unmount' | 'destroy' | 'destroyed'
>;
export type CoreGraphManipulationExt = Pick<RuntimeCore, 'scratch' | 'removeScratch'>;

// Collection contribution interfaces and legacy generic helper names
export type CollectionAlgorithms = RuntimeCollectionAlgorithms;
export type CollectionAnimation = RuntimeCollectionAnimation;
export type CollectionComparision = CollectionComparators;
export type CollectionData = RuntimeCollectionData;
export type CollectionEvents = RuntimeCollectionEvents;
export interface CollectionIteration<TOut = Element, TIn = TOut> extends Pick<RuntimeCollectionIteration,
  'size' | 'empty' | 'nonempty'
> {
  length: number;
  [index: number]: TOut;
  each( fn: ( ele: TIn, i: number, eles: this ) => unknown, thisArg?: unknown ): this;
  forEach( fn: ( ele: TIn, i: number, eles: this ) => unknown, thisArg?: unknown ): this;
  eq( index: number ): TOut;
  first(): TOut;
  last(): TOut;
  slice( start?: number, end?: number ): this;
  toArray(): TOut[];
  sort( sort: ( a: TIn, b: TIn ) => number ): this;
  map<T>( fn: ( ele: TIn, i: number, eles: this ) => T, thisArg?: unknown ): T[];
  reduce<T>( fn: ( value: T, ele: TIn, i: number, eles: this ) => T, initialValue: T ): T;
  max( fn: ( ele: TIn, i: number, eles: this ) => number, thisArg?: unknown ): { value: number; ele: TOut | undefined };
  min( fn: ( ele: TIn, i: number, eles: this ) => number, thisArg?: unknown ): { value: number; ele: TOut | undefined };
  [Symbol.iterator](): Iterator<TOut>;
}
export type CollectionLayout = RuntimeCollectionLayout;
export type CollectionPosition = RuntimeCollectionPosition & CollectionDimensions & CollectionBounds;
export type CollectionSelection = CollectionSwitchFunctions;
export type CollectionStyle = RuntimeCollectionStyle;
export type CollectionTraversing = RuntimeCollectionTraversing;
export type CollectionGraphManipulation = Pick<RuntimeCollection, 'remove' | 'restore' | 'clone' | 'copy' | 'move'>;
export type CollectionArgument = Collection | EdgeCollection | NodeCollection | SingularElementArgument;
export type CollectionReturnValue = Collection;
export type SingularElementArgument = EdgeSingular | NodeSingular;
export type SingularElementReturnValue = Singular;
export type CollectionBuildingDifferenceFunc = ( eles: CollectionArgument | Selector ) => CollectionReturnValue;
export type CollectionBuildingIntersectionFunc = ( eles: CollectionArgument | Selector ) => CollectionReturnValue;
export type CollectionBuildingUnionFunc = ( eles: CollectionArgument | Selector ) => CollectionReturnValue;
export type CollectionSymmetricDifferenceFunc = ( eles: CollectionArgument | Selector ) => CollectionReturnValue;
type PublicCollectionFilter = Pick<CollectionFilter,
  | 'nodes' | 'edges'
  | 'not' | 'difference' | 'relativeComplement' | 'subtract'
  | 'diff' | 'absoluteComplement' | 'complement' | 'abscomp'
  | 'intersect' | 'intersection' | 'and'
  | 'xor' | 'symmetricDifference' | 'symdiff'
  | 'add' | 'union' | 'or' | 'merge' | 'unmerge'
>;
export type CollectionBuildingFiltering<TIn = SingularElementArgument, TOut = SingularElementReturnValue> =
  PublicCollectionFilter
  & Pick<RuntimeCollection, 'getElementById' | '$id'>
  & {
    u: PublicCollectionFilter['union'];
    '+': PublicCollectionFilter['union'];
    '|': PublicCollectionFilter['union'];
    '\\': PublicCollectionFilter['difference'];
    '!': PublicCollectionFilter['difference'];
    '-': PublicCollectionFilter['difference'];
    n: PublicCollectionFilter['intersection'];
    '&': PublicCollectionFilter['intersection'];
    '.': PublicCollectionFilter['intersection'];
    '^': PublicCollectionFilter['symmetricDifference'];
    '(+)': PublicCollectionFilter['symmetricDifference'];
    '(-)': PublicCollectionFilter['symmetricDifference'];
    filter( selector?: Selector | ( ( ele: TIn, i: number, eles: CollectionArgument ) => boolean ) ): CollectionReturnValue;
    sort( sort: ( a: TIn, b: TIn ) => number ): CollectionReturnValue;
    map<T>( fn: ( ele: TIn, i: number, eles: CollectionArgument ) => T, thisArg?: unknown ): T[];
    reduce<T>( fn: ( value: T, ele: TIn, i: number, eles: CollectionArgument ) => T, initialValue: T ): T;
    min( fn: ( ele: TIn, i: number, eles: CollectionArgument ) => number, thisArg?: unknown ): { value: number; ele: TOut | undefined };
    max( fn: ( ele: TIn, i: number, eles: CollectionArgument ) => number, thisArg?: unknown ): { value: number; ele: TOut | undefined };
  };
export type ElementPositionFunction = ( ele: NodeSingular, ix: number ) => Position;
export type ElementCollectionFunction = ( ele: NodeSingular, ix: number, eles: CollectionArgument ) => Position;
export type NodeCollectionCompound = CollectionCompounds;
export type NodeCollectionLayout = RuntimeCollectionLayout;
export type NodeCollectionMetadata = Pick<NodeCollection,
  | 'totalDegree'
  | 'minDegree' | 'maxDegree'
  | 'minIndegree' | 'maxIndegree'
  | 'minOutdegree' | 'maxOutdegree'
>;
export type NodeCollectionPosition = RuntimeCollectionPosition;
export type NodeCollectionTraversing = Pick<NodeCollection,
  | 'edgesWith' | 'edgesTo' | 'connectedEdges'
  | 'roots' | 'leaves'
  | 'outgoers' | 'successors' | 'incomers' | 'predecessors'
>;
export type NodeSingularCompound = CollectionCompounds;
export type NodeSingularLayout = RuntimeCollectionLayout;
export type NodeSingularMetadata = Pick<NodeSingular, 'degree' | 'indegree' | 'outdegree'>;
export type NodeSingularPosition = RuntimeCollectionPosition;
export type EdgeCollectionTraversing = Pick<EdgeCollection,
  'connectedNodes' | 'sources' | 'targets' | 'parallelEdges' | 'codirectedEdges'
>;
export type EdgeSingularData = Pick<EdgeSingular, 'isLoop' | 'isSimple'>;
export type EdgeSingularPoints = CollectionEdgePoints;
export type EdgeSingularTraversing = Pick<EdgeSingular, 'source' | 'target'>;
export type SingularData = Pick<Singular,
  'scratch' | 'removeScratch' | 'id' | 'json'
  | 'group' | 'isNode' | 'isEdge' | 'component'
>;
export type SingularGraphManipulation = CollectionGraphManipulation;
export type SingularPosition = RuntimeCollectionPosition;
export type SingularSelection = CollectionSwitchFunctions;
export type SingularStyle = Pick<Singular,
  | 'hasClass'
  | 'renderedStyle' | 'renderedCss'
  | 'numericStyle' | 'numericStyleUnits'
  | 'visible' | 'hidden' | 'effectiveOpacity' | 'transparent'
>;

// Animation helpers
export interface AnimationFitOptions {
  eles: CollectionArgument | Selector;
  padding: number;
}
export interface CenterOptions {
  eles: CollectionArgument | Selector;
}
export type AnimateOptions = RuntimeAnimationOptions;
export type AnimationManipulation = AnimationClass;
export type ElementAnimateOptionsBase = RuntimeAnimationOptions;
export type ElementAnimateOptionPos = RuntimeAnimationOptions & { position?: Position };
export type ElementAnimateOptionRen = RuntimeAnimationOptions & { renderedPosition?: Position };
export type SingularAnimation = RuntimeCollectionAnimation;
export type SingularAnimationOptionsBase = RuntimeAnimationOptions;
export type SingularAnimationOptionsPos = RuntimeAnimationOptions & { position?: Position };
export type SingularAnimationOptionsRen = RuntimeAnimationOptions & { renderedPosition?: Position };

// Image export overload option families
export type ExportOptions = RuntimeExportOptions;
export type ExportStringOptions = RuntimeExportStringOptions;
export type ExportBlobOptions = RuntimeExportBlobOptions;
export type ExportBlobPromiseOptions = RuntimeExportBlobPromiseOptions;
export type ExportJpgOptions = RuntimeExportJpgOptions;
export type ExportJpgStringOptions = RuntimeExportJpgStringOptions;
export type ExportJpgBlobOptions = RuntimeExportJpgBlobOptions;
export type ExportJpgBlobPromiseOptions = RuntimeExportJpgBlobPromiseOptions;

// Stylesheet JSON aliases
export type StylesheetJson = StyleJson;
export type StylesheetJsonBlock = StyleJsonBlock;
export interface StylesheetStyle {
  selector: string;
  style: Css.Node | Css.Edge | Css.Core;
}
export interface StylesheetCSS {
  selector: string;
  css: Css.Node | Css.Edge | Css.Core;
}
export type ElementStylesheetStyle = StylesheetStyle;
export type ElementStylesheetCSS = StylesheetCSS;
export type Style = RuntimeStyle;

// Public layout option types omit the constructor-injected `cy` and `eles`
// fields used by the runtime layout implementations.
type RemoveIndexSignature<T> = {
  [Key in keyof T as
    string extends Key ? never
      : number extends Key ? never
        : symbol extends Key ? never
          : Key]: T[Key]
};
type PublicLayoutCallbacks = {
  ready?: () => void;
  stop?: () => void;
  transform?: ( node: NodeSingular, position: Position ) => Position;
  animateFilter?: ( node: NodeSingular, index: number ) => boolean;
};
type PublicLayoutOptions<T, TName extends string, Omitted extends PropertyKey = never> =
  Omit<RemoveIndexSignature<T>, 'cy' | 'eles' | 'name' | keyof PublicLayoutCallbacks | Omitted>
  & PublicLayoutCallbacks
  & { name: TName; [key: string]: unknown };
export type BaseLayoutOptions = PublicLayoutOptions<RuntimeLayoutOptionsBase, string>;
export type AnimatedLayoutOptions = Pick<BaseLayoutOptions, 'animate' | 'animationDuration' | 'animationEasing' | 'animateFilter'>;
export type ShapedLayoutOptions = BaseLayoutOptions & AnimatedLayoutOptions & {
  fit?: boolean;
  padding?: number;
  boundingBox?: BoundingBox12 | BoundingBoxWH;
  avoidOverlap?: boolean;
  nodeDimensionsIncludeLabels?: boolean;
  spacingFactor?: number;
  sort?: SortingFunction;
};
export type NullLayoutOptions = PublicLayoutOptions<RuntimeNullLayoutOptions, 'null'>;
export type RandomLayoutOptions = PublicLayoutOptions<RuntimeRandomLayoutOptions, 'random'>;
export type PresetLayoutOptions = PublicLayoutOptions<RuntimePresetLayoutOptions, 'preset', 'positions'> & {
  positions?: NodePositionMap | NodePositionFunction;
};
export type GridLayoutOptions = PublicLayoutOptions<RuntimeGridLayoutOptions, 'grid'>;
export type CircleLayoutOptions = PublicLayoutOptions<RuntimeCircleLayoutOptions, 'circle'>;
export type ConcentricLayoutOptions = PublicLayoutOptions<RuntimeConcentricLayoutOptions, 'concentric'>;
export type BreadthFirstLayoutOptions = PublicLayoutOptions<RuntimeBreadthFirstLayoutOptions, 'breadthfirst'>;
export type CoseLayoutOptions = PublicLayoutOptions<RuntimeCoseLayoutOptions, 'cose'>;
export type LayoutOptions =
  | NullLayoutOptions
  | RandomLayoutOptions
  | PresetLayoutOptions
  | GridLayoutOptions
  | CircleLayoutOptions
  | ConcentricLayoutOptions
  | BreadthFirstLayoutOptions
  | CoseLayoutOptions
  | BaseLayoutOptions;
export type Layouts = LayoutInstance;
export type LayoutManipulation = LayoutInstance;
export type LayoutEvents = LayoutInstance;
export type LayoutHandler = ( event: LayoutEventObject ) => void;
export type LayoutPositionOptions = Pick<RuntimeLayoutPositionOptions,
  | 'animate' | 'animationDuration' | 'animationEasing'
  | 'fit' | 'padding' | 'spacingFactor' | 'pan' | 'zoom'
> & PublicLayoutCallbacks & { eles: CollectionArgument };
export type LayoutDimensionOptions = RuntimeLayoutDimensionsOptions;
export interface NodePositionMap { [nodeid: string]: Position }
export type NodePositionFunction = ( node: NodeSingular ) => Position | null | undefined;
export type SortingFunction = NonNullable<GridLayoutOptions['sort']>;

// Algorithm options and results retain their v3 namespace names.
export type WeightFn = ( edge: EdgeSingular ) => number;
export type SearchVisitFunction = SearchVisitFn;
export type SearchFirstOptionsBase = Omit<SearchOptions, 'root' | 'roots'>;
export type SearchFirstOptions1 = SearchFirstOptionsBase & {
  roots: NonNullable<SearchOptions['roots']>;
  root?: SearchOptions['root'];
};
export type SearchFirstOptions2 = SearchFirstOptionsBase & {
  root: NonNullable<SearchOptions['root']>;
  roots?: SearchOptions['roots'];
};
export type SearchFirstOptions = SearchFirstOptions1 | SearchFirstOptions2;
export type SearchFirstResult = SearchResult;
export type SearchAStarOptions = Omit<AStarOptions, 'root' | 'goal'> & {
  root: NonNullable<AStarOptions['root']>;
  goal: NonNullable<AStarOptions['goal']>;
};
export type SearchAStarResult = AStarResult;
export type SearchBellmanFordOptions = Omit<BellmanFordOptions, 'root'> & {
  root: NonNullable<BellmanFordOptions['root']>;
};
export type SearchBellmanFordResult = BellmanFordResult;
export type SearchDijkstraOptions = Omit<DijkstraOptions, 'root'> & {
  root: NonNullable<DijkstraOptions['root']>;
};
export type SearchDijkstraResult = DijkstraResult;
export type SearchFloydWarshallOptions = FloydWarshallOptions;
export type SearchFloydWarshallResult = FloydWarshallResult;
export type SearchPageRankOptions = PageRankOptions;
export type SearchPageRankResult = PageRankResult;
export type SearchBetweennessOptions = BetweennessCentralityOptions;
export type SearchBetweennessResult = BetweennessCentralityResult;
export type SearchClosenessCentralityOptions = Omit<ClosenessCentralityOptions, 'root'> & {
  root: NonNullable<ClosenessCentralityOptions['root']>;
};
export type SearchClosenessCentralityNormalizedOptions = ClosenessCentralityOptions;
export type SearchClosenessCentralityNormalizedResult = ClosenessCentralityNormalizedResult;
export type SearchDegreeCentralityOptions = Omit<DegreeCentralityOptions, 'root'> & {
  root: NonNullable<DegreeCentralityOptions['root']>;
};
export type SearchDegreeCentralityNormalizedOptions = DegreeCentralityOptions;
export type SearchDegreeCentralityResultDirected = DirectedDegreeCentrality;
export type SearchDegreeCentralityResultUndirected = UndirectedDegreeCentrality;
export type SearchDegreeCentralityNormalizedResultDirected = DirectedDegreeCentralityNormalized;
export type SearchDegreeCentralityNormalizedResultUndirected = UndirectedDegreeCentralityNormalized;
export type AffinityPropagationOptions = RuntimeAffinityPropagationOptions;
export type AffinityPropagationResult = ReturnType<RuntimeCollectionAlgorithms['affinityPropagation']>;
export type KMeansOptions = KClusteringOptions;
export type KMeansResult = ReturnType<RuntimeCollectionAlgorithms['kMeans']>;
export type KMedoidsOptions = KClusteringOptions;
export type KMedoidsResult = ReturnType<RuntimeCollectionAlgorithms['kMedoids']>;
export type FuzzyCMeansOptions = KClusteringOptions;
export type FuzzyCMeansResult = RuntimeFuzzyCMeansResult;
export type HierarchicalClusteringOptions = RuntimeHierarchicalClusteringOptions;
export type HierarchicalClusteringResult = ReturnType<RuntimeCollectionAlgorithms['hierarchicalClustering']>;
export type MarkovClusteringOptions = RuntimeMarkovClusteringOptions;
export type MarkovClusteringResult = ReturnType<RuntimeCollectionAlgorithms['markovClustering']>;
export type HierholzerOptions = RuntimeHierholzerOptions;
export type HierholzerResult = RuntimeHierholzerResult;
export type SearchAlgorithms = Pick<RuntimeCollectionAlgorithms,
  | 'breadthFirstSearch' | 'bfs' | 'depthFirstSearch' | 'dfs'
  | 'dijkstra' | 'aStar' | 'floydWarshall' | 'bellmanFord' | 'hierholzer'
>;
export type SpanningAlgorithms = Pick<RuntimeCollectionAlgorithms, 'kruskal'>;
export type CutAlgorithms = Pick<RuntimeCollectionAlgorithms,
  | 'kargerStein'
  | 'hopcroftTarjanBiconnected' | 'hopcroftTarjanBiconnectedComponents' | 'htb' | 'htbc'
  | 'tarjanStronglyConnected' | 'tarjanStronglyConnectedComponents' | 'tsc' | 'tscc'
>;
export type CentralityAlgorithms = Pick<RuntimeCollectionAlgorithms,
  | 'degreeCentrality' | 'degreeCentralityNormalized'
  | 'closenessCentrality' | 'closenessCentralityNormalized'
  | 'betweennessCentrality' | 'pageRank'
>;
export type ClusteringAlgorithms = Pick<RuntimeCollectionAlgorithms,
  | 'markovClustering' | 'kMeans' | 'hierarchicalClustering'
  | 'kMedoids' | 'fuzzyCMeans' | 'affinityPropagation'
>;
export type MinumumSpanningTree = Collection;

// Public event object and event-name families
export type AbstractEventObject = RuntimeAbstractEventObject;
export type EventObject = RuntimeEventObject;
export type EventObjectNode = RuntimeEventObjectNode;
export type EventObjectEdge = RuntimeEventObjectEdge;
export type EventObjectCore = RuntimeEventObjectCore;
export type InputEventObject = RuntimeInputEventObject;
export type LayoutEventObject = RuntimeLayoutEventObject;
export type EventHandler = RuntimeEventHandler;
export type EventNames = string;
export type UserInputDeviceEventName =
  | 'mousedown' | 'mouseup' | 'click' | 'mouseover' | 'mouseout'
  | 'mousemove' | 'touchstart' | 'touchmove' | 'touchend';
export type UserInputDeviceEventNameExt =
  | 'tapstart' | 'vmousedown' | 'tapdrag' | 'vmousemove' | 'tapdragover'
  | 'tapdragout' | 'tapend' | 'vmouseup' | 'tap' | 'vclick' | 'taphold'
  | 'cxttapstart' | 'cxttapend' | 'cxttap' | 'cxtdrag' | 'cxtdragover'
  | 'cxtdragout' | 'boxstart' | 'boxend' | 'boxselect' | 'box';
export type CollectionEventName =
  | 'add' | 'remove' | 'move' | 'select' | 'unselect' | 'tapselect'
  | 'tapunselect' | 'boxselect' | 'box' | 'lock' | 'unlock' | 'grabon'
  | 'grab' | 'drag' | 'free' | 'freeon' | 'dragfree' | 'dragfreeon'
  | 'position' | 'data' | 'scratch' | 'style' | 'background';
export type GraphEventName =
  | 'layoutstart' | 'layoutready' | 'layoutstop' | 'ready' | 'destroy'
  | 'render' | 'pan' | 'dragpan' | 'zoom' | 'pinchzoom' | 'scrollzoom'
  | 'viewport' | 'resize';
