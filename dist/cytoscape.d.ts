//#region src/stylesheet.d.mts
interface StylesheetProperty {
  name: string;
  value: unknown;
}
interface StylesheetContext {
  selector: string;
  properties: StylesheetProperty[];
}
interface Stylesheet {
  length: number;
  [index: number]: StylesheetContext;
  instanceString(): string;
  selector(selector: string): Stylesheet;
  css(name: string | Record<string, unknown>, value?: unknown): Stylesheet;
  style(name: string | Record<string, unknown>, value?: unknown): Stylesheet;
  generateStyle(cy: unknown): unknown;
  appendToStyle<S>(style: S): S;
}
interface StylesheetStatic {
  (this: Stylesheet | void): Stylesheet;
  new (): Stylesheet;
  prototype: Stylesheet;
}
declare let Stylesheet: StylesheetStatic;
//#endregion
//#region src/types.d.mts
interface Position {
  x: number;
  y: number;
}
interface BoundingBox12 {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
interface BoundingBoxWH {
  w: number;
  h: number;
}
type BoundingBox = BoundingBox12 & BoundingBoxWH;
/**
 * Minimal structural view of the Core instance, used by low-level modules
 * that are converted before src/core. Replaced by `import type Core` from
 * the real core module once it is converted.
 */
interface CoreShim {
  zoom(): number;
  pan(): Position;
}
/**
 * Minimal structural view of a Collection, used by low-level modules that
 * are converted before src/collection. Replaced by the real Collection
 * type once it is converted.
 */
interface CollectionShim {
  instanceString(): string;
  _private: {
    single: boolean;
  };
}
//#endregion
//#region src/collection/algorithms/bfs-dfs.d.mts
/** Callback invoked for each visited node during a search. Return `true` to
 * stop and record the node as `found`; return `false` to stop without. */
type SearchVisitFn = (v: Element$1, e: Element$1 | undefined, u: Element$1 | undefined, i: number, depth: number) => boolean | void;
/** Options object accepted by breadthFirstSearch / depthFirstSearch. */
interface SearchOptions {
  roots?: Collection | Element$1 | string;
  root?: Collection | Element$1 | string;
  visit?: SearchVisitFn;
  directed?: boolean;
}
/** Result of a breadth/depth-first search. */
interface SearchResult {
  path: Collection;
  found: Collection;
}
/** A configured search method (bfs or dfs). */
type SearchFn = (this: Collection, roots?: SearchOptions | Collection | Element$1 | string, fn?: SearchVisitFn | boolean, directed?: boolean) => SearchResult;
interface AlgorithmsBfsDfs {
  breadthFirstSearch: SearchFn;
  depthFirstSearch: SearchFn;
  bfs: SearchFn;
  dfs: SearchFn;
}
//#endregion
//#region src/collection/algorithms/dijkstra.d.mts
/** Edge weighting function. */
type DijkstraWeightFn = (edge: Element$1) => number;
/** Options accepted by `dijkstra`. */
interface DijkstraOptions {
  root?: Collection | Element$1 | string | null;
  weight?: DijkstraWeightFn;
  directed?: boolean;
}
/** Result of `dijkstra`: distance/path lookups from the root node. */
interface DijkstraResult {
  distanceTo(node: Collection | Element$1 | string): number;
  pathTo(node: Collection | Element$1 | string): Collection;
}
interface AlgorithmsDijkstra {
  dijkstra(this: Collection, options?: DijkstraOptions | Collection | Element$1 | string, weight?: DijkstraWeightFn, directed?: boolean): DijkstraResult;
}
//#endregion
//#region src/collection/algorithms/kruskal.d.mts
/** Edge weighting function. */
type KruskalWeightFn = (edge: Element$1) => number;
interface AlgorithmsKruskal {
  kruskal(this: Collection, weightFn?: KruskalWeightFn): Collection;
}
//#endregion
//#region src/collection/algorithms/a-star.d.mts
/** Edge/node weighting or heuristic function. */
type AStarWeightFn = (ele: Element$1) => number;
/** Options accepted by `aStar`. */
interface AStarOptions {
  root?: Collection | Element$1 | string | null;
  goal?: Collection | Element$1 | string | null;
  weight?: AStarWeightFn;
  heuristic?: AStarWeightFn;
  directed?: boolean;
}
/** Result of an A* search. */
interface AStarResult {
  found: boolean;
  distance: number | undefined;
  path: Collection | undefined;
  steps: number;
}
interface AlgorithmsAStar {
  aStar(this: Collection, options?: AStarOptions): AStarResult;
}
//#endregion
//#region src/collection/algorithms/floyd-warshall.d.mts
/** Edge weighting function. */
type FloydWarshallWeightFn = (edge: Element$1) => number;
/** Options accepted by `floydWarshall`. */
interface FloydWarshallOptions {
  weight?: FloydWarshallWeightFn;
  directed?: boolean;
}
/** Result of `floydWarshall`: all-pairs distance/path lookups. */
interface FloydWarshallResult {
  distance(from: Collection | Element$1 | string, to: Collection | Element$1 | string): number;
  path(from: Collection | Element$1 | string, to: Collection | Element$1 | string): Collection;
}
interface AlgorithmsFloydWarshall {
  floydWarshall(this: Collection, options?: FloydWarshallOptions): FloydWarshallResult;
}
//#endregion
//#region src/collection/algorithms/bellman-ford.d.mts
/** Edge weighting function. */
type BellmanFordWeightFn = (edge: Element$1) => number;
/** Options accepted by `bellmanFord`. */
interface BellmanFordOptions {
  weight?: BellmanFordWeightFn;
  directed?: boolean;
  root?: Collection | Element$1 | string | null;
  findNegativeWeightCycles?: boolean;
}
/** Result of `bellmanFord`. */
interface BellmanFordResult {
  distanceTo(to: Collection | Element$1 | string): number | undefined;
  pathTo(to: Collection | Element$1 | string, thisStart?: Element$1): Collection;
  hasNegativeWeightCycle: boolean;
  negativeWeightCycles: Collection[];
}
interface AlgorithmsBellmanFord {
  bellmanFord(this: Collection, options?: BellmanFordOptions): BellmanFordResult;
}
//#endregion
//#region src/collection/algorithms/karger-stein.d.mts
/** Result of `kargerStein`. */
interface KargerSteinResult {
  cut: Collection;
  components: Collection[];
  partition1: Collection;
  partition2: Collection;
}
interface AlgorithmsKargerStein {
  kargerStein(this: Collection): KargerSteinResult | undefined;
}
//#endregion
//#region src/collection/algorithms/page-rank.d.mts
/** Edge weighting function. */
type PageRankWeightFn = (edge: Element$1) => number;
/** Options accepted by `pageRank`. */
interface PageRankOptions {
  dampingFactor?: number;
  precision?: number;
  iterations?: number;
  weight?: PageRankWeightFn;
}
/** Result of `pageRank`: the rank of a given node. */
interface PageRankResult {
  rank(node: Collection | Element$1 | string): number;
}
interface AlgorithmsPageRank {
  pageRank(this: Collection, options?: PageRankOptions): PageRankResult;
}
//#endregion
//#region src/collection/algorithms/degree-centrality.d.mts
/** Edge weighting function. */
type DegreeCentralityWeightFn = (edge: Element$1) => number;
/** Options accepted by the degree-centrality methods. */
interface DegreeCentralityOptions {
  root?: Collection | Element$1 | string | null;
  weight?: DegreeCentralityWeightFn;
  directed?: boolean;
  alpha?: number;
}
/** Result of `degreeCentrality` for an undirected graph. */
interface UndirectedDegreeCentrality {
  degree: number;
}
/** Result of `degreeCentrality` for a directed graph. */
interface DirectedDegreeCentrality {
  indegree: number;
  outdegree: number;
}
type DegreeCentralityResult = UndirectedDegreeCentrality | DirectedDegreeCentrality;
/** Result of `degreeCentralityNormalized` for an undirected graph. */
interface UndirectedDegreeCentralityNormalized {
  degree(node: Collection | Element$1 | string): number;
}
/** Result of `degreeCentralityNormalized` for a directed graph. */
interface DirectedDegreeCentralityNormalized {
  indegree(node: Collection | Element$1 | string): number;
  outdegree(node: Collection | Element$1 | string): number;
}
type DegreeCentralityNormalizedResult = UndirectedDegreeCentralityNormalized | DirectedDegreeCentralityNormalized;
interface AlgorithmsDegreeCentrality {
  degreeCentralityNormalized(this: Collection, options?: DegreeCentralityOptions): DegreeCentralityNormalizedResult;
  degreeCentrality(this: Collection, options?: DegreeCentralityOptions): DegreeCentralityResult;
  dc(this: Collection, options?: DegreeCentralityOptions): DegreeCentralityResult;
  dcn(this: Collection, options?: DegreeCentralityOptions): DegreeCentralityNormalizedResult;
  degreeCentralityNormalised(this: Collection, options?: DegreeCentralityOptions): DegreeCentralityNormalizedResult;
}
//#endregion
//#region src/collection/algorithms/closeness-centrality.d.mts
/** Edge weighting function. */
type ClosenessCentralityWeightFn = (edge: Element$1) => number;
/** Options accepted by the closeness-centrality methods. */
interface ClosenessCentralityOptions {
  harmonic?: boolean;
  weight?: ClosenessCentralityWeightFn;
  directed?: boolean;
  root?: Collection | Element$1 | string | null;
}
/** Result of `closenessCentralityNormalized`. */
interface ClosenessCentralityNormalizedResult {
  closeness(node: Collection | Element$1 | string): number;
}
interface AlgorithmsClosenessCentrality {
  closenessCentralityNormalized(this: Collection, options?: ClosenessCentralityOptions): ClosenessCentralityNormalizedResult;
  closenessCentrality(this: Collection, options?: ClosenessCentralityOptions): number;
  cc(this: Collection, options?: ClosenessCentralityOptions): number;
  ccn(this: Collection, options?: ClosenessCentralityOptions): ClosenessCentralityNormalizedResult;
  closenessCentralityNormalised(this: Collection, options?: ClosenessCentralityOptions): ClosenessCentralityNormalizedResult;
}
//#endregion
//#region src/collection/algorithms/betweenness-centrality.d.mts
/** Edge weighting function. */
type BetweennessWeightFn = (edge: Element$1) => number;
/** Options accepted by `betweennessCentrality`. */
interface BetweennessCentralityOptions {
  weight?: BetweennessWeightFn | null;
  directed?: boolean;
}
/** Result of `betweennessCentrality`. */
interface BetweennessCentralityResult {
  betweenness(node: Collection | Element$1 | string): number | undefined;
  betweennessNormalized(node: Collection | Element$1 | string): number;
  betweennessNormalised(node: Collection | Element$1 | string): number;
}
interface AlgorithmsBetweennessCentrality {
  betweennessCentrality(this: Collection, options?: BetweennessCentralityOptions): BetweennessCentralityResult;
  bc(this: Collection, options?: BetweennessCentralityOptions): BetweennessCentralityResult;
}
//#endregion
//#region src/collection/algorithms/markov-clustering.d.mts
/** A similarity/attribute function: maps an edge to a numeric contribution. */
type MarkovAttributeFn = (edge: Element$1) => number;
/** Options accepted by `markovClustering`. */
interface MarkovClusteringOptions {
  expandFactor?: number;
  inflateFactor?: number;
  multFactor?: number;
  maxIterations?: number;
  attributes?: MarkovAttributeFn[];
}
interface AlgorithmsMarkovClustering {
  markovClustering(this: Collection, options?: MarkovClusteringOptions): Collection[];
  mcl(this: Collection, options?: MarkovClusteringOptions): Collection[];
}
//#endregion
//#region src/collection/algorithms/clustering-distances.d.mts
/** A built-in metric name (or a convenience alias for one). */
type DistanceMetricName = 'euclidean' | 'squaredEuclidean' | 'squared-euclidean' | 'squaredeuclidean' | 'manhattan' | 'max';
/**
 * A user-supplied distance function. When called via the function-method
 * branch (length === 0), it receives the two operands directly; otherwise it
 * is treated like a built-in and called with the per-dimension accessors.
 */
type CustomDistanceFn = (...args: any[]) => number;
type DistanceMetric = DistanceMetricName | CustomDistanceFn;
//#endregion
//#region src/collection/algorithms/k-clustering.d.mts
/** A node attribute accessor used as a clustering feature. */
type KAttributeFn = (node: Element$1) => number;
/** A feature-vector centroid (k-means / fuzzy c-means). */
type FeatureCentroid = number[];
/** Options accepted by the k-clustering methods. */
interface KClusteringOptions {
  k?: number;
  m?: number;
  sensitivityThreshold?: number;
  distance?: DistanceMetric;
  maxIterations?: number;
  attributes?: KAttributeFn[];
  testMode?: boolean;
  testCentroids?: number | FeatureCentroid[] | Element$1[] | null;
}
/** Result of `fuzzyCMeans`. */
interface FuzzyCMeansResult {
  clusters: Collection[];
  degreeOfMembership: number[][];
}
interface AlgorithmsKClustering {
  kMeans(this: Collection, options?: KClusteringOptions): Collection[];
  kMedoids(this: Collection, options?: KClusteringOptions): Collection[];
  fuzzyCMeans(this: Collection, options?: KClusteringOptions): FuzzyCMeansResult;
  fcm(this: Collection, options?: KClusteringOptions): FuzzyCMeansResult;
}
//#endregion
//#region src/collection/algorithms/hierarchical-clustering.d.mts
interface HierarchicalClusteringOptions {
  distance?: DistanceMetric;
  linkage?: string;
  mode?: 'threshold' | 'dendrogram';
  threshold?: number;
  addDendrogram?: boolean;
  dendrogramDepth?: number;
  attributes?: Array<(ele: Element$1) => number>;
}
interface AlgorithmsHierarchicalClustering {
  hierarchicalClustering(options?: HierarchicalClusteringOptions): Collection[];
  hca(options?: HierarchicalClusteringOptions): Collection[];
}
//#endregion
//#region src/collection/algorithms/affinity-propagation.d.mts
/** A node attribute accessor used to quantify similarity. */
type AffinityAttributeFn = (node: Element$1) => number;
/** How to derive the on-diagonal preference value. */
type AffinityPreference = 'median' | 'mean' | 'min' | 'max' | number;
/** Options accepted by `affinityPropagation`. */
interface AffinityPropagationOptions {
  distance?: DistanceMetric;
  preference?: AffinityPreference;
  damping?: number;
  maxIterations?: number;
  minIterations?: number;
  attributes?: AffinityAttributeFn[];
}
interface AlgorithmsAffinityPropagation {
  affinityPropagation(this: Collection, options?: AffinityPropagationOptions): Collection[];
  ap(this: Collection, options?: AffinityPropagationOptions): Collection[];
}
//#endregion
//#region src/collection/algorithms/hierholzer.d.mts
/** Options accepted by `hierholzer`. */
interface HierholzerOptions {
  root?: Collection | Element$1 | string;
  directed?: boolean;
}
/** Result of `hierholzer`: an Eulerian trail, if one exists. */
interface HierholzerResult {
  found: boolean;
  trail: Collection | undefined;
}
interface AlgorithmsHierholzer {
  hierholzer(this: Collection, options?: HierholzerOptions | Collection | Element$1 | string, directed?: boolean): HierholzerResult;
}
//#endregion
//#region src/collection/algorithms/hopcroft-tarjan-biconnected.d.mts
/** Result of the Hopcroft-Tarjan biconnected-components algorithm. */
interface HopcroftTarjanBiconnectedResult {
  cut: Collection;
  components: Collection[];
}
interface AlgorithmsHopcroftTarjanBiconnected {
  hopcroftTarjanBiconnected(this: Collection): HopcroftTarjanBiconnectedResult;
  htbc(this: Collection): HopcroftTarjanBiconnectedResult;
  htb(this: Collection): HopcroftTarjanBiconnectedResult;
  hopcroftTarjanBiconnectedComponents(this: Collection): HopcroftTarjanBiconnectedResult;
}
//#endregion
//#region src/collection/algorithms/tarjan-strongly-connected.d.mts
/** Result of Tarjan's strongly-connected-components algorithm. */
interface TarjanStronglyConnectedResult {
  cut: Collection;
  components: Collection[];
}
interface AlgorithmsTarjanStronglyConnected {
  tarjanStronglyConnected(this: Collection): TarjanStronglyConnectedResult;
  tsc(this: Collection): TarjanStronglyConnectedResult;
  tscc(this: Collection): TarjanStronglyConnectedResult;
  tarjanStronglyConnectedComponents(this: Collection): TarjanStronglyConnectedResult;
}
//#endregion
//#region src/collection/algorithms/index.d.mts
/** All graph-algorithm methods contributed to the collection prototype. */
interface CollectionAlgorithms extends AlgorithmsBfsDfs, AlgorithmsDijkstra, AlgorithmsKruskal, AlgorithmsAStar, AlgorithmsFloydWarshall, AlgorithmsBellmanFord, AlgorithmsKargerStein, AlgorithmsPageRank, AlgorithmsDegreeCentrality, AlgorithmsClosenessCentrality, AlgorithmsBetweennessCentrality, AlgorithmsMarkovClustering, AlgorithmsKClustering, AlgorithmsHierarchicalClustering, AlgorithmsAffinityPropagation, AlgorithmsHierholzer, AlgorithmsHopcroftTarjanBiconnected, AlgorithmsTarjanStronglyConnected {}
//#endregion
//#region src/promise.d.mts
/*!
Embeddable Minimum Strictly-Compliant Promises/A+ 1.1.1 Thenable
Copyright (c) 2013-2014 Ralf S. Engelschall (http://engelschall.com)
Licensed under The MIT License (http://opensource.org/licenses/MIT)
*/
/**
 * The structural subset of the Promise API provided by both the native
 * `Promise` and the Thenable polyfill (construct with executor, `then`,
 * `resolve`, `reject`, `all`).
 */
interface PromiseLikeObject<T> {
  then<TResult1 = T, TResult2 = never>(onFulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null, onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): PromiseLikeObject<TResult1 | TResult2>;
}
//#endregion
//#region src/animation.d.mts
interface AnimationStyleProp {
  name: string;
}
/**
 * Animation options as accepted by `.animate()` / `.animation()`. The
 * same bag, plus bookkeeping fields, becomes the animation's `_private`
 * state.
 */
interface AnimationOptions {
  duration?: number | 'slow' | 'fast';
  style?: AnimationStyleProp[] | Record<string, unknown>;
  css?: AnimationStyleProp[] | Record<string, unknown>;
  queue?: boolean;
  complete?: () => void;
  step?: () => void;
  delay?: number;
  easing?: string;
  position?: Position;
  renderedPosition?: Position;
  startPosition?: Position;
  startStyle?: Record<string, AnimationStyleProp>;
  pan?: Position;
  panBy?: Position;
  startPan?: Position;
  zoom?: number | Record<string, unknown> | null;
  startZoom?: number;
  center?: {
    eles: unknown;
  };
  centre?: {
    eles: unknown;
  };
  fit?: {
    eles?: unknown;
    boundingBox?: unknown;
    padding?: number;
  };
}
/**
 * Structural view of what an Animation animates: a Core or a single
 * element. Refined to the real types when src/core and src/collection
 * are converted.
 */
interface AnimationTarget {
  _private: {
    animation: {
      current: Animation[];
      queue: Animation[];
    };
  };
}
interface AnimationPrivate extends AnimationOptions {
  target: AnimationTarget;
  started: boolean;
  playing: boolean;
  hooked: boolean;
  applying: boolean;
  progress: number;
  completes: (() => void)[];
  frames: (() => void)[];
  stopped?: boolean;
  duration: number | 'slow' | 'fast';
}
declare class Animation {
  _private: AnimationPrivate;
  length: number;
  [index: number]: Animation;
  constructor(target: AnimationTarget, opts?: AnimationOptions, opts2?: AnimationOptions);
  instanceString(): string;
  hook(): this;
  play(): this;
  playing(): boolean;
  apply(): this;
  applying(): boolean;
  pause(): this;
  stop(): this;
  rewind(): this;
  fastforward(): this;
  time(): number;
  time(t: number): this;
  progress(): number;
  progress(p: number): this;
  completed(): boolean;
  reverse(): this;
  promise(type?: string): PromiseLikeObject<void>;
  complete: this['completed'];
  run: this['play'];
  running: this['playing'];
}
//#endregion
//#region src/collection/animation.d.mts
/** Animation methods contributed to the collection prototype. */
interface CollectionAnimation {
  animate(this: Collection, properties: AnimationOptions, params?: AnimationOptions): Collection;
  animation(this: Collection, properties?: AnimationOptions, params?: AnimationOptions): Animation | Collection;
  animated(this: Collection): boolean | undefined;
  clearQueue(this: Collection): Collection;
  delay(this: Collection, time: number, complete?: () => void): Collection;
  delayAnimation(this: Collection, time: number, complete?: () => void): Animation | Collection;
  stop(this: Collection, clearQueue?: boolean, jumpToEnd?: boolean): Collection;
}
//#endregion
//#region src/collection/class.d.mts
/** Class manipulation methods contributed to the collection prototype. */
interface CollectionClass {
  classes(): string[];
  classes(classes: string | string[]): Collection;
  className(): string[];
  className(classes: string | string[]): Collection;
  classNames(): string[];
  classNames(classes: string | string[]): Collection;
  addClass(classes: string | string[]): Collection;
  hasClass(className: string): boolean;
  toggleClass(classes: string | string[], toggle?: boolean): Collection;
  removeClass(classes: string | string[]): Collection;
  flashClass(classes: string | string[], duration?: number): Collection;
}
//#endregion
//#region src/collection/comparators.d.mts
/** Test callback for some()/every(). */
type CollectionTestFn = (ele: Element$1, i: number, eles: Collection) => boolean | void;
/** Collection comparison/predicate methods contributed to the prototype. */
interface CollectionComparators {
  allAre(selector: string): boolean;
  is(selector: string): boolean;
  some(fn: CollectionTestFn, thisArg?: unknown): boolean;
  every(fn: CollectionTestFn, thisArg?: unknown): boolean;
  same(collection: Collection | Element$1 | string): boolean;
  anySame(collection: Collection | Element$1 | string): boolean;
  allAreNeighbors(collection: Collection | Element$1 | string): boolean;
  allAreNeighbours(collection: Collection | Element$1 | string): boolean;
  contains(collection: Collection | Element$1 | string): boolean;
  has(collection: Collection | Element$1 | string): boolean;
}
//#endregion
//#region src/collection/filter.d.mts
/** A predicate run against each element of a collection. */
type FilterEleFn = (ele: Element$1, i: number, eles: Collection) => boolean | unknown;
/** Inputs accepted by `.filter()` and friends: selector string, predicate, or collection. */
type FilterArg = string | FilterEleFn | Collection | Element$1 | undefined | null;
/** Inputs accepted by set operations: selector string or collection. */
type SetArg = string | Collection | Element$1 | undefined | null;
/** Result of `.diff()`/`.difference()`. */
interface DiffResult {
  left: Collection;
  right: Collection;
  both: Collection;
}
interface CollectionFilter {
  nodes(selector?: FilterArg): NodeCollection;
  edges(selector?: FilterArg): EdgeCollection;
  filter(filter?: FilterArg, thisArg?: any): Collection;
  not(toRemove?: SetArg): Collection;
  difference(toRemove?: SetArg): Collection;
  relativeComplement(toRemove?: SetArg): Collection;
  subtract(toRemove?: SetArg): Collection;
  diff(other: SetArg): DiffResult;
  absoluteComplement(): Collection;
  complement(): Collection;
  abscomp(): Collection;
  intersect(other: SetArg): Collection;
  intersection(other: SetArg): Collection;
  and(other: SetArg): Collection;
  xor(other: SetArg): Collection;
  symmetricDifference(other: SetArg): Collection;
  symdiff(other: SetArg): Collection;
  add(toAdd?: SetArg): Collection;
  union(toAdd?: SetArg): Collection;
  or(toAdd?: SetArg): Collection;
  merge(toAdd?: SetArg): Collection;
  unmerge(toRemove?: SetArg): Collection;
}
//#endregion
//#region src/collection/compounds.d.mts
/** Compound-graph navigation methods contributed to the prototype. */
interface CollectionCompounds {
  parent(selector?: FilterArg): NodeCollection;
  parents(selector?: FilterArg): NodeCollection;
  ancestors(selector?: FilterArg): NodeCollection;
  commonAncestors(selector?: FilterArg): NodeCollection;
  orphans(selector?: FilterArg): NodeCollection;
  nonorphans(selector?: FilterArg): NodeCollection;
  children(selector?: FilterArg): NodeCollection;
  siblings(selector?: FilterArg): NodeCollection;
  isParent(): boolean | undefined;
  isChildless(): boolean | undefined;
  isChild(): boolean | undefined;
  isOrphan(): boolean | undefined;
  descendants(selector?: FilterArg): NodeCollection;
}
//#endregion
//#region src/event.d.mts
type NativeEvent = globalThis.Event;
interface EventProps {
  originalEvent?: NativeEvent;
  type?: string;
  cy?: CoreShim;
  target?: unknown;
  position?: Position;
  renderedPosition?: Position;
  namespace?: string | null;
  layout?: unknown;
  timeStamp?: number;
}
type EventSrc = string | NativeEvent | EventProps | null | undefined;
declare class Event {
  type: string;
  originalEvent?: NativeEvent;
  cy?: CoreShim;
  target?: unknown;
  position?: Position;
  renderedPosition?: Position;
  namespace?: string | null;
  layout?: unknown;
  timeStamp: number;
  isDefaultPrevented: () => boolean;
  isPropagationStopped: () => boolean;
  isImmediatePropagationStopped: () => boolean;
  constructor(src: EventSrc, props?: EventProps);
  instanceString(): string;
  recycle(src: EventSrc, props?: EventProps): void;
  preventDefault(): void;
  stopPropagation(): void;
  stopImmediatePropagation(): void;
}
//#endregion
//#region src/emitter.d.mts
type EventHandler = (this: any, event: Event, ...extraParams: any[]) => unknown;
type EmitInput = string | string[] | Event | EventProps;
//#endregion
//#region src/define/data.d.mts
/** The generated data accessor (e.g. `.data()`, `.scratch()`). */
interface DataFunc<Self> {
  (this: Self): Record<string, unknown> | undefined;
  (this: Self, name: string): unknown;
  (this: Self, name: string, value: any): Self;
  (this: Self, obj: Record<string, unknown>): Self;
  (this: Self, handler: EventHandler): Self;
}
/** The generated data remover (e.g. `.removeData()`, `.removeScratch()`). */
interface RemoveDataFunc<Self> {
  (this: Self, names?: string): Self;
}
//#endregion
//#region src/collection/data.d.mts
/** Data/scratch accessors contributed to the collection prototype. */
interface CollectionData {
  data: DataFunc<Collection>;
  removeData: RemoveDataFunc<Collection>;
  scratch: DataFunc<Collection>;
  removeScratch: RemoveDataFunc<Collection>;
  attr: DataFunc<Collection>;
  removeAttr: RemoveDataFunc<Collection>;
  id(): string | undefined;
}
//#endregion
//#region src/collection/degree.d.mts
/** Degree calculation methods contributed to the collection prototype. */
interface CollectionDegree {
  degree(includeLoops?: boolean): number | undefined;
  indegree(includeLoops?: boolean): number | undefined;
  outdegree(includeLoops?: boolean): number | undefined;
  minDegree(includeLoops?: boolean): number | undefined;
  maxDegree(includeLoops?: boolean): number | undefined;
  minIndegree(includeLoops?: boolean): number | undefined;
  maxIndegree(includeLoops?: boolean): number | undefined;
  minOutdegree(includeLoops?: boolean): number | undefined;
  maxOutdegree(includeLoops?: boolean): number | undefined;
  totalDegree(includeLoops?: boolean): number;
}
//#endregion
//#region src/collection/dimensions/position.d.mts
/** A function that computes a position for an element during `.positions()`. */
type PositionFn = (ele: Element$1, i: number) => Position | undefined | false;
/**
 * The `.position()`-family accessor. Generated by `define.data`, but typed
 * with position-specific overloads (get returns a Position, set accepts a
 * full/partial Position, a (name, value) pair, or an event handler).
 */
interface PositionAccessor {
  (this: Collection): Position;
  (this: Collection, pos: Partial<Position>): Collection;
  (this: Collection, name: string): number;
  (this: Collection, name: string, value: number): Collection;
  (this: Collection, handler: (...args: any[]) => void): Collection;
}
/** Position accessor methods contributed to the collection prototype. */
interface CollectionPosition {
  position: PositionAccessor;
  modelPosition: PositionAccessor;
  point: PositionAccessor;
  positions(this: Collection, pos: Partial<Position> | PositionFn, silent?: boolean): Collection;
  modelPositions(this: Collection, pos: Partial<Position> | PositionFn, silent?: boolean): Collection;
  points(this: Collection, pos: Partial<Position> | PositionFn, silent?: boolean): Collection;
  shift(this: Collection, dim: Partial<Position> | string, val?: number | boolean, silent?: boolean): Collection;
  renderedPosition(this: Collection, dim?: Partial<Position> | string, val?: number): Position | number | Collection | undefined;
  renderedPoint(this: Collection, dim?: Partial<Position> | string, val?: number): Position | number | Collection | undefined;
  relativePosition(this: Collection, dim?: Partial<Position> | string, val?: number): Position | number | Collection | undefined;
  relativePoint(this: Collection, dim?: Partial<Position> | string, val?: number): Position | number | Collection | undefined;
}
//#endregion
//#region src/collection/dimensions/bounds.d.mts
/** Options controlling which sub-parts are included in a bounding box. */
interface BoundingBoxOptions {
  includeNodes?: boolean;
  includeEdges?: boolean;
  includeLabels?: boolean;
  includeMainLabels?: boolean;
  includeSourceLabels?: boolean;
  includeTargetLabels?: boolean;
  includeOverlays?: boolean;
  includeUnderlays?: boolean;
  includeOutlines?: boolean;
  useCache?: boolean;
  incudeNodes?: boolean;
}
/** Bounding-box methods contributed to the collection prototype. */
interface CollectionBounds {
  renderedBoundingBox(this: Collection, options?: BoundingBoxOptions): BoundingBox;
  renderedBoundingbox(this: Collection, options?: BoundingBoxOptions): BoundingBox;
  boundingBox(this: Collection, options?: BoundingBoxOptions): BoundingBox;
  boundingbox(this: Collection, options?: BoundingBoxOptions): BoundingBox;
  bb(this: Collection, options?: BoundingBoxOptions): BoundingBox;
}
//#endregion
//#region src/collection/dimensions/width-height.d.mts
/** Width/height/padding accessors contributed to the collection prototype. */
interface CollectionWidthHeight {
  width(this: Collection): number | undefined;
  outerWidth(this: Collection): number | undefined;
  renderedWidth(this: Collection): number | undefined;
  renderedOuterWidth(this: Collection): number | undefined;
  height(this: Collection): number | undefined;
  outerHeight(this: Collection): number | undefined;
  renderedHeight(this: Collection): number | undefined;
  renderedOuterHeight(this: Collection): number | undefined;
}
//#endregion
//#region src/collection/dimensions/edge-points.d.mts
/** Edge-point accessors contributed to the collection prototype. */
interface CollectionEdgePoints {
  controlPoints(this: Collection): Position[] | undefined;
  renderedControlPoints(this: Collection): Position[] | undefined;
  segmentPoints(this: Collection): Position[] | undefined;
  renderedSegmentPoints(this: Collection): Position[] | undefined;
  sourceEndpoint(this: Collection): Position | undefined;
  renderedSourceEndpoint(this: Collection): Position | undefined;
  targetEndpoint(this: Collection): Position | undefined;
  renderedTargetEndpoint(this: Collection): Position | undefined;
  midpoint(this: Collection): Position | undefined;
  renderedMidpoint(this: Collection): Position | undefined;
}
//#endregion
//#region src/collection/dimensions/index.d.mts
/**
 * All dimension/geometry methods contributed to the collection prototype,
 * assembled from the per-file mixins (mirrors the runtime assembly below).
 */
interface CollectionDimensions extends CollectionPosition, CollectionBounds, CollectionWidthHeight, CollectionEdgePoints {}
//#endregion
//#region src/selector/type.d.mts
/**
 * A check type enum-like object.  Uses integer values for fast match() lookup.
 * The ordering does not matter as long as the ints are unique.
 */
declare const Type: {
  /** E.g. node */readonly GROUP: 0; /** A collection of elements */
  readonly COLLECTION: 1; /** A filter(ele) function */
  readonly FILTER: 2; /** E.g. [foo > 1] */
  readonly DATA_COMPARE: 3; /** E.g. [foo] */
  readonly DATA_EXIST: 4; /** E.g. [?foo] */
  readonly DATA_BOOL: 5; /** E.g. [[degree > 2]] */
  readonly META_COMPARE: 6; /** E.g. :selected */
  readonly STATE: 7; /** E.g. #foo */
  readonly ID: 8; /** E.g. .foo */
  readonly CLASS: 9; /** E.g. #foo <-> #bar */
  readonly UNDIRECTED_EDGE: 10; /** E.g. #foo -> #bar */
  readonly DIRECTED_EDGE: 11; /** E.g. $#foo -> #bar */
  readonly NODE_SOURCE: 12; /** E.g. #foo -> $#bar */
  readonly NODE_TARGET: 13; /** E.g. $#foo <-> #bar */
  readonly NODE_NEIGHBOR: 14; /** E.g. #foo > #bar */
  readonly CHILD: 15; /** E.g. #foo #bar */
  readonly DESCENDANT: 16; /** E.g. $#foo > #bar */
  readonly PARENT: 17; /** E.g. $#foo #bar */
  readonly ANCESTOR: 18; /** E.g. #foo > $bar > #baz */
  readonly COMPOUND_SPLIT: 19; /** Always matches, useful placeholder for subject in `COMPOUND_SPLIT` */
  readonly TRUE: 20;
};
/** The integer value of one of the `Type` check types */
type QueryType = typeof Type[keyof typeof Type];
/** A filter(ele) function, as used by `Type.FILTER` checks */
type FilterFn = (ele: SelectorEle) => boolean;
/**
 * Structural view of an element as used by selector matching.  N.b. selector
 * code relies on first-element semantics of collections (e.g. `ele.parent()`
 * is matched like an element), so this shape covers both.
 */
interface SelectorEle {
  group(): string;
  id(): string;
  hasClass(className: string): boolean;
  data(field: string): unknown;
  collection(): SelectorCollection;
  isNode(): boolean;
  source(): SelectorEle;
  target(): SelectorEle;
  parent(): SelectorEle;
  children(): SelectorCollection;
  ancestors(): SelectorCollection;
  descendants(): SelectorCollection;
  neighborhood(): SelectorCollection;
  outgoers(): SelectorCollection;
  incomers(): SelectorCollection;
  selected(): boolean;
  selectable(): boolean;
  locked(): boolean;
  visible(): boolean;
  transparent(): boolean;
  grabbed(): boolean;
  removed(): boolean;
  grabbable(): boolean;
  animated(): boolean;
  active(): boolean;
  backgrounding(): boolean;
  isParent(): boolean;
  isChildless(): boolean;
  isChild(): boolean;
  isOrphan(): boolean;
  isLoop(): boolean;
  isSimple(): boolean;
}
/** Structural view of a collection of elements as used by the selector module */
interface SelectorCollection {
  some(fn: (ele: SelectorEle) => boolean): boolean;
  has(ele: SelectorEle): boolean;
  getElementById(id: string): SelectorEle;
  filter(fn: (ele: SelectorEle) => boolean): SelectorCollection;
  collection(): SelectorCollection;
}
/**
 * A single check made against an ele to test for a match.  Only `type` is
 * always present; which other fields are set depends on the value of `type`
 * (see the `populate()` functions in ./expressions.mts and the `match[]`
 * functions in ./query-type-match.mts).
 */
interface Check {
  /** The type enum (int) of the check */
  type: QueryType;
  /** Group, state, id, class, or data value -- or the collection/filter fn for `COLLECTION`/`FILTER` checks */
  value?: string | number | SelectorCollection | FilterFn;
  /** Data or metadata field name (`DATA_*`, `META_COMPARE`) */
  field?: string;
  /** Comparator or boolean operator (`DATA_COMPARE`, `DATA_BOOL`, `META_COMPARE`) */
  operator?: string;
  /** Edge source query (`DIRECTED_EDGE`, `NODE_SOURCE`, `NODE_TARGET`) */
  source?: Query;
  /** Edge target query (`DIRECTED_EDGE`, `NODE_SOURCE`, `NODE_TARGET`) */
  target?: Query;
  /** Endpoint queries (`UNDIRECTED_EDGE`); nulled when rewritten to `NODE_NEIGHBOR` */
  nodes?: Query[] | null;
  /** Subject node query (`NODE_NEIGHBOR`) */
  node?: Query;
  /** Neighbour query (`NODE_NEIGHBOR`) */
  neighbor?: Query;
  /** Compound queries (`CHILD`, `PARENT`) */
  parent?: Query;
  child?: Query;
  /** Compound queries (`DESCENDANT`, `ANCESTOR`) */
  ancestor?: Query;
  descendant?: Query;
  /** Compound split queries (`COMPOUND_SPLIT`) */
  left?: Query;
  right?: Query;
  subject?: Query;
}
/**
 * A query against which an ele may be matched; all `checks` must pass for the
 * query to match
 */
interface Query {
  /** List of checks to make against an ele to test for a match */
  checks: Check[];
  /** The subject query, when a `$` subject selector applies */
  subject?: Query | null;
  /** Number of edge selectors in the query (set on top-level queries by the parser) */
  edgeCount?: number;
  /** Number of compound selectors in the query (set on top-level queries by the parser) */
  compoundCount?: number;
}
//#endregion
//#region src/selector/index.d.mts
/** What a Selector may be constructed from */
type SelectorInput = string | CollectionShim | FilterFn | null | undefined;
declare class Selector {
  [index: number]: Query;
  inputText: SelectorInput;
  currentSubject: Query | null;
  compoundCount: number;
  edgeCount: number;
  length: number;
  invalid?: boolean;
  toStringCache?: string | null;
  constructor(selector?: SelectorInput);
  parse: (selector: string) => boolean;
  toString: () => string;
  matches: (ele: SelectorEle) => boolean;
  filter: (collection: SelectorCollection) => SelectorCollection;
  text: () => SelectorInput;
  size: () => number;
  eq: (i: number) => Query;
  sameText: (otherSel: Selector) => boolean;
  addQuery: (q: Query) => void;
  selector: () => string;
}
//#endregion
//#region src/collection/events.d.mts
/** Inputs accepted as the selector arg of `.on()` and friends. */
type EventSelectorArg$1 = string | Selector | EventHandler | null | undefined;
interface CollectionEvents {
  on(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler): Collection;
  removeListener(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler): Collection;
  removeAllListeners(): Collection;
  one(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler): Collection;
  once(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler): void;
  emit(events: EmitInput, extraParams?: unknown[]): Collection;
  addListener(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler): Collection;
  listen(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler): Collection;
  bind(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler): Collection;
  unlisten(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler): Collection;
  unbind(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler): Collection;
  off(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler): Collection;
  trigger(events: EmitInput, extraParams?: unknown[]): Collection;
  pon(events: string, selector?: EventSelectorArg$1): Promise<Event>;
  promiseOn(events: string, selector?: EventSelectorArg$1): Promise<Event>;
}
//#endregion
//#region src/collection/group.d.mts
/** Group/type-test methods contributed to the collection prototype. */
interface CollectionGroup {
  isNode(): boolean;
  isEdge(): boolean;
  isLoop(): boolean;
  isSimple(): boolean;
  group(): 'nodes' | 'edges' | undefined;
}
//#endregion
//#region src/collection/iteration.d.mts
/** Callback invoked per element during iteration. */
type EachFn = (ele: Element$1, i: number, eles: Collection) => unknown;
/** Callback returning a value per element (map/min/max). */
type MapFn<T> = (ele: Element$1, i: number, eles: Collection) => T;
/** Reducer callback. */
type ReduceFn<T> = (acc: T, ele: Element$1, i: number, eles: Collection) => T;
/** Comparator used by sort(). */
type SortFn = (a: Element$1, b: Element$1) => number;
/** Result of min()/max(). */
interface MinMaxResult<T = number> {
  value: T;
  ele: Element$1 | undefined;
}
interface CollectionIteration {
  forEach(fn: EachFn, thisArg?: any): Collection;
  each(fn: EachFn, thisArg?: any): Collection;
  toArray(): Element$1[];
  slice(start?: number, end?: number): Collection;
  size(): number;
  eq(i: number): Collection;
  first(): Collection;
  last(): Collection;
  empty(): boolean;
  nonempty(): boolean;
  sort(sortFn: SortFn): Collection;
  map<T>(mapFn: MapFn<T>, thisArg?: unknown): T[];
  reduce<T>(fn: ReduceFn<T>, initialValue: T): T;
  max(valFn: MapFn<number>, thisArg?: unknown): MinMaxResult;
  min(valFn: MapFn<number>, thisArg?: unknown): MinMaxResult;
  [Symbol.iterator](): Iterator<Element$1>;
}
//#endregion
//#region src/collection/layout.d.mts
/**
 * Structural view of a layout instance, as used by the collection layout
 * code. TODO(eles-types): swap to the real Layout type once layouts are
 * converted in the core/extension phase.
 */
interface LayoutLike {
  emit(evt: {
    type: string;
    layout: LayoutLike;
  } | string, ...args: any[]): unknown;
  on(events: string, handler: (...args: any[]) => void): unknown;
  one(events: string, handler?: (...args: any[]) => void): unknown;
  run(): unknown;
  stop(): unknown;
  animations: Animation[];
  [key: string]: unknown;
}
/** A node-positioning function used by `layoutPositions`. */
type LayoutPositionFn = (node: Element$1, i: number) => Position;
/** Options read by `layoutPositions` / `layout` / `makeLayout`. */
interface LayoutOptions$1 {
  eles: Collection;
  spacingFactor?: number;
  transform?: (node: Element$1, pos: Position) => Position;
  animate?: boolean;
  animateFilter?: (node: Element$1, i: number) => boolean;
  animationDuration?: number;
  animationEasing?: string;
  fit?: boolean;
  padding?: number;
  zoom?: number;
  pan?: Position;
  ready?: () => void;
  stop?: () => void;
  [key: string]: unknown;
}
/** Options read by `layoutDimensions`. */
interface LayoutDimensionsOptions {
  nodeDimensionsIncludeLabels?: boolean;
}
/** Node dimensions returned by `layoutDimensions`. */
interface LayoutDimensions {
  w: number;
  h: number;
}
/** Layout methods contributed to the collection prototype. */
interface CollectionLayout {
  layoutDimensions(this: Collection, options: LayoutDimensionsOptions): LayoutDimensions;
  layoutPositions(this: Collection, layout: LayoutLike, options: LayoutOptions$1, fn: LayoutPositionFn): Collection;
  layout(this: Collection, options?: Partial<LayoutOptions$1>): LayoutLike;
  createLayout(this: Collection, options?: Partial<LayoutOptions$1>): LayoutLike;
  makeLayout(this: Collection, options?: Partial<LayoutOptions$1>): LayoutLike;
}
//#endregion
//#region src/collection/style.d.mts
/** Style accessor methods contributed to the collection prototype. */
interface CollectionStyle {
  numericStyle(this: Collection, property: string): number | unknown;
  numericStyleUnits(this: Collection, property: string): string | (string | undefined)[] | undefined;
  style(this: Collection, name?: string | Record<string, unknown>, value?: unknown): unknown;
  css(this: Collection, name?: string | Record<string, unknown>, value?: unknown): unknown;
  removeStyle(this: Collection, names?: string): Collection;
  effectiveOpacity(this: Collection): number | undefined;
  transparent(this: Collection): boolean | undefined;
  visible(this: Collection): boolean | undefined;
  hidden(this: Collection): boolean | undefined;
}
//#endregion
//#region src/collection/switch-functions.d.mts
interface CollectionSwitchFunctions {
  lock(...args: any[]): Collection;
  unlock(...args: any[]): Collection;
  grabify(...args: any[]): Collection;
  ungrabify(...args: any[]): Collection;
  select(...args: any[]): Collection;
  unselect(...args: any[]): Collection;
  deselect(...args: any[]): Collection;
  selectify(...args: any[]): Collection;
  unselectify(...args: any[]): Collection;
  panify(...args: any[]): Collection;
  unpanify(...args: any[]): Collection;
  locked(): boolean | undefined;
  grabbable(): boolean | undefined;
  grabbed(): boolean | undefined;
  selected(): boolean | undefined;
  selectable(): boolean | undefined;
  active(): boolean | undefined;
  pannable(): boolean | undefined;
}
//#endregion
//#region src/collection/traversing.d.mts
/** Selector/filter argument accepted by traversal methods. */
type SelectorArg = string | ((ele: Element$1, i: number, eles: Collection) => boolean | unknown) | Collection | Element$1 | undefined | null;
interface CollectionTraversing {
  roots(selector?: SelectorArg): NodeCollection;
  leaves(selector?: SelectorArg): NodeCollection;
  outgoers(selector?: SelectorArg): Collection;
  successors(selector?: SelectorArg): Collection;
  incomers(selector?: SelectorArg): Collection;
  predecessors(selector?: SelectorArg): Collection;
  neighborhood(selector?: SelectorArg): Collection;
  neighbourhood(selector?: SelectorArg): Collection;
  closedNeighborhood(selector?: SelectorArg): Collection;
  closedNeighbourhood(selector?: SelectorArg): Collection;
  openNeighborhood(selector?: SelectorArg): Collection;
  openNeighbourhood(selector?: SelectorArg): Collection;
  source(selector?: SelectorArg): NodeSingular;
  target(selector?: SelectorArg): NodeSingular;
  sources(selector?: SelectorArg): NodeCollection;
  targets(selector?: SelectorArg): NodeCollection;
  edgesWith(otherNodes: string | Collection): EdgeCollection;
  edgesTo(otherNodes: string | Collection): EdgeCollection;
  connectedEdges(selector?: SelectorArg): EdgeCollection;
  connectedNodes(selector?: SelectorArg): NodeCollection;
  parallelEdges(selector?: SelectorArg): EdgeCollection;
  codirectedEdges(selector?: SelectorArg): EdgeCollection;
  components(root?: Collection | Element$1 | null): Collection[];
  componentsOf(root?: Collection | Element$1 | null): Collection[];
  component(): Collection;
}
//#endregion
//#region src/collection/eles-types.d.mts
/**
 * The collection module's structural view of the Core. Grown as needed
 * by collection code; src/core's real Core type must satisfy it (it is
 * swapped in during the core conversion phase).
 */
interface CoreAccess {
  hasElementWithId(id: string | number): boolean;
  getElementById(id: string | number): Collection;
  collection(eles?: unknown, opts?: unknown): Collection;
  batch(fn: () => void): unknown;
  startBatch(): unknown;
  endBatch(): unknown;
  batching(): boolean;
  addToPool(eles: Collection | Element$1): unknown;
  removeFromPool(eles: Collection | Element$1[]): unknown;
  addToAnimationPool(eles: Collection | Element$1): void;
  zoom(): number;
  pan(): Position;
  styleEnabled(): boolean;
  style(): CoreStyleAccess;
  notify(event: string, eles?: Collection): void;
  renderer(): CoreRendererAccess;
  hasCompoundNodes(): boolean;
  headless(): boolean;
  destroyed(): boolean;
  emit(events: string, extraParams?: any[]): unknown;
  _private: CorePrivateAccess;
}
interface CorePrivateAccess {
  elements: Collection;
  hasCompoundNodes: boolean;
  [key: string]: unknown;
}
/** Loose structural view of the style engine as used by collection code. */
interface CoreStyleAccess {
  apply(eles: Collection | Element$1): unknown;
  applyBypass(eles: Collection | Element$1, name?: unknown, value?: unknown, updateTransitions?: boolean): unknown;
  removeBypasses(eles: Collection | Element$1, names?: string[], updateTransitions?: boolean): unknown;
  getPropsList(props: unknown): unknown;
  getRenderedStyle(ele: Element$1, prop?: string): unknown;
  getRawStyle(ele: Element$1, isRenderedVal?: boolean): unknown;
  getStylePropertyValue(ele: Element$1, propName: string, isRenderedVal?: boolean): unknown;
  update(): unknown;
  updateTransitions(ele: Element$1, diffProps: unknown): unknown;
  updateMappers(eles: Collection | Element$1): unknown;
  [key: string]: unknown;
}
/** Loose structural view of the renderer as used by collection code. */
interface CoreRendererAccess {
  notify?(event: string, eles?: Collection): void;
  [key: string]: unknown;
}
interface ElementData {
  id?: string;
  source?: string;
  target?: string;
  parent?: string;
  [key: string]: unknown;
}
/** JSON definition used to create an element. */
interface ElementDefinition {
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
  parent?: Element$1 | null;
}
/** The shape produced/consumed by `eles.json()`. */
interface ElementJson {
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
/** Methods defined directly in collection/index.mts (not via mixins). */
interface CollectionBaseFns {
  instanceString(): string;
  cy(): CoreAccess;
  getElementById(id: string | number): Collection;
  $id(id: string | number): Collection;
  json(obj?: Partial<ElementJson>): ElementJson | this | undefined;
  jsons(): (ElementJson | undefined)[];
  clone(): Collection;
  copy(): Collection;
  restore(notifyRenderer?: boolean, addToPool?: boolean): this;
  removed(): boolean;
  inside(): boolean;
  remove(notifyRenderer?: boolean, removeFromPool?: boolean): Collection;
  move(struct: {
    source?: string | number;
    target?: string | number;
    parent?: string | number | null;
  }): this;
}
/**
 * The wide internal collection type: the union of node and edge
 * capabilities, matching how the shared prototype actually behaves at
 * runtime. Public node/edge-narrowed projections are layered on top in
 * the entry point's public API types.
 */
interface Collection extends CollectionBaseFns, CollectionAlgorithms, CollectionAnimation, CollectionClass, CollectionComparators, CollectionCompounds, CollectionData, CollectionDegree, CollectionDimensions, CollectionEvents, CollectionFilter, CollectionGroup, CollectionIteration, CollectionLayout, CollectionStyle, CollectionSwitchFunctions, CollectionTraversing {
  length: number;
  [index: number]: Element$1;
}
/** A single element (node or edge); array-like of itself, length 1. */
interface Element$1 extends Collection {}
type PublicSelectorArg = string | Collection | Element$1 | ((ele: Element$1, i: number, eles: Collection) => boolean | unknown) | undefined | null;
interface Singular extends Element$1 {}
interface NodeCollection extends Collection {
  parent(selector?: PublicSelectorArg): NodeCollection;
  parents(selector?: PublicSelectorArg): NodeCollection;
  ancestors(selector?: PublicSelectorArg): NodeCollection;
  commonAncestors(selector?: PublicSelectorArg): NodeCollection;
  orphans(selector?: PublicSelectorArg): NodeCollection;
  nonorphans(selector?: PublicSelectorArg): NodeCollection;
  children(selector?: PublicSelectorArg): NodeCollection;
  siblings(selector?: PublicSelectorArg): NodeCollection;
  descendants(selector?: PublicSelectorArg): NodeCollection;
  roots(selector?: PublicSelectorArg): NodeCollection;
  leaves(selector?: PublicSelectorArg): NodeCollection;
  connectedEdges(selector?: PublicSelectorArg): EdgeCollection;
}
interface EdgeCollection extends Collection {
  source(selector?: PublicSelectorArg): NodeSingular;
  target(selector?: PublicSelectorArg): NodeSingular;
  sources(selector?: PublicSelectorArg): NodeCollection;
  targets(selector?: PublicSelectorArg): NodeCollection;
  edgesWith(otherNodes: string | Collection): EdgeCollection;
  edgesTo(otherNodes: string | Collection): EdgeCollection;
  connectedNodes(selector?: PublicSelectorArg): NodeCollection;
  parallelEdges(selector?: PublicSelectorArg): EdgeCollection;
  codirectedEdges(selector?: PublicSelectorArg): EdgeCollection;
}
type NodeSingular = Singular & NodeCollection;
type EdgeSingular = Singular & EdgeCollection;
//#endregion
//#region src/core/add-remove.d.mts
/** The shapes accepted by `add()`. */
type AddOpts = Collection | Element$1 | ElementDefinition | ElementDefinition[] | {
  nodes?: ElementDefinition[];
  edges?: ElementDefinition[];
};
/** Add/remove element methods contributed to the core prototype. */
interface CoreAddRemove {
  add(this: Core, opts: AddOpts): Collection;
  remove(this: Core, collection: Collection | Element$1 | string): Collection;
}
//#endregion
//#region src/core/animation/index.d.mts
/**
 * Animation methods contributed to `Core.prototype` by this mixin. The
 * `.animate()`/`.animation()`/etc. methods are generated by `define`; the
 * loop-management methods are defined here.
 */
interface CoreAnimation {
  animate(properties: AnimationOptions, params?: AnimationOptions): Core;
  animation(properties?: AnimationOptions, params?: AnimationOptions): Animation | Core;
  animated(): boolean | undefined;
  clearQueue(): Core;
  delay(time: number, complete?: () => void): Core;
  delayAnimation(time: number, complete?: () => void): Animation | Core;
  stop(clearQueue?: boolean, jumpToEnd?: boolean): Core;
}
//#endregion
//#region src/core/events.d.mts
/** Inputs accepted as the selector arg of `.on()` and friends. */
type EventSelectorArg = string | Selector | EventHandler | null | undefined;
interface CoreEvents {
  on(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler): Core;
  removeListener(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler): Core;
  removeAllListeners(): Core;
  one(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler): Core;
  emit(events: EmitInput, extraParams?: unknown[]): Core;
  addListener(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler): Core;
  listen(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler): Core;
  bind(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler): Core;
  unlisten(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler): Core;
  unbind(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler): Core;
  off(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler): Core;
  trigger(events: EmitInput, extraParams?: unknown[]): Core;
  pon(events: string, selector?: EventSelectorArg): Promise<Event>;
  promiseOn(events: string, selector?: EventSelectorArg): Promise<Event>;
}
//#endregion
//#region src/core/export.d.mts
/** Options accepted by the image export methods (`png`/`jpg`/`jpeg`). */
interface ExportOptions {
  output?: 'base64uri' | 'base64' | 'blob' | 'blob-promise';
  bg?: string;
  full?: boolean;
  scale?: number;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  [key: string]: unknown;
}
/** Image export methods contributed to the core prototype. */
interface CoreExport {
  png(this: Core, options?: ExportOptions): string | Blob | Promise<Blob>;
  jpg(this: Core, options?: ExportOptions): string | Blob | Promise<Blob>;
  jpeg(this: Core, options?: ExportOptions): string | Blob | Promise<Blob>;
}
//#endregion
//#region src/core/layout.d.mts
/** Options accepted by `layout()`/`makeLayout()`/`createLayout()`. */
interface LayoutOptions {
  name: string;
  eles?: Collection | string;
  [key: string]: unknown;
}
/** Layout construction methods contributed to the core prototype. */
interface CoreLayout {
  layout(this: Core, options?: LayoutOptions): LayoutInstance;
  makeLayout(this: Core, options?: LayoutOptions): LayoutInstance;
  createLayout(this: Core, options?: LayoutOptions): LayoutInstance;
}
//#endregion
//#region src/core/notification.d.mts
interface CoreNotification {
  startBatch(): Core;
  endBatch(): Core;
  batch(callback: () => void): Core;
}
//#endregion
//#region src/core/renderer.d.mts
interface CoreRenderer {
  resize(): Core;
  invalidateDimensions(): Core;
}
//#endregion
//#region src/core/search.d.mts
/** Options accepted by `collection()` when building from an array. */
interface CollectionOpts {
  unique?: boolean;
  removed?: boolean;
}
/** Graph search/collection helpers contributed to the core prototype. */
interface CoreSearch {
  collection(this: Core, eles?: string | Collection | Element$1 | Element$1[], opts?: CollectionOpts): Collection;
  nodes(this: Core, selector?: FilterArg): NodeCollection;
  edges(this: Core, selector?: FilterArg): EdgeCollection;
  $(this: Core, selector?: FilterArg): Collection;
  elements(this: Core, selector?: FilterArg): Collection;
  filter(this: Core, selector?: FilterArg): Collection;
}
//#endregion
//#region src/style/properties.d.mts
/** Validation/parsing descriptor for a style property value type (an entry in `Style.types`). */
interface StylePropertyType {
  number?: boolean;
  min?: number;
  max?: number;
  strictMin?: boolean;
  strictMax?: boolean;
  integer?: boolean;
  unitless?: boolean;
  units?: string;
  implicitUnits?: string;
  allowPercent?: boolean;
  multiple?: boolean;
  evenMultiple?: boolean;
  enums?: (string | number)[];
  singleEnum?: boolean;
  color?: boolean;
  string?: boolean;
  mapping?: boolean;
  regex?: string;
  regexes?: string[];
  singleRegexMatchValue?: boolean;
  fn?: boolean;
  propList?: boolean;
  validate?: (valArr: unknown[], unitsArr: unknown[]) => boolean;
}
/** Diff function: whether a change from one value to another triggers an update. */
type StylePropertyTriggerFn = (fromValue: unknown, toValue: unknown, ele: StyleElement) => boolean;
/** Overrides the value hashed into the style key for a property. */
type StylePropertyHashOverrideFn = (ele: StyleElement, parsedProp: ParsedStyleProperty) => number | (number | undefined)[] | undefined;
/** Descriptor for a single visual style property (an entry in `Style.properties`). */
interface StyleProperty {
  name: string;
  /** the value type of the property (absent on alias entries) */
  type?: StylePropertyType;
  /** the property group the property belongs to (assigned after the group tables are built) */
  groupKey?: string;
  triggersBounds?: StylePropertyTriggerFn;
  triggersZOrder?: StylePropertyTriggerFn;
  triggersBoundsOfConnectedEdges?: StylePropertyTriggerFn;
  triggersBoundsOfParallelEdges?: StylePropertyTriggerFn;
  hashOverride?: StylePropertyHashOverrideFn;
  /** true for alias entries (e.g. `content` -> `label`) */
  alias?: boolean;
  /** the aliased property for alias entries */
  pointsTo?: StyleProperty;
}
/** The property table: an array of descriptors that doubles as a name -> descriptor map. */
type StylePropertiesTable = StyleProperty[] & {
  [name: string]: StyleProperty | undefined;
};
interface PropertiesStyfn {
  /** the value types that properties can have (statically available as `Style.types`) */
  types: Record<string, StylePropertyType>;
  /** the property table (statically available as `Style.properties`) */
  properties: StylePropertiesTable;
  propertyGroups: Record<string, StyleProperty[]>;
  propertyGroupNames: Record<string, string[]>;
  propertyGroupKeys: string[];
  propertyNames: string[];
  aliases: {
    name: string;
    pointsTo: string;
  }[];
  /** the pie properties are numbered, so give access to a constant N (for renderer use) */
  pieBackgroundN: number;
  /** the stripe properties are numbered, so give access to a constant N (for renderer use) */
  stripeBackgroundN: number;
  arrowPrefixes: string[];
  getDefaultProperty(this: Style, name: string): ParseResult;
  getDefaultProperties(this: Style): Record<string, ParseResult>;
  addDefaultStylesheet(this: Style): void;
}
//#endregion
//#region src/style/parse.d.mts
/**
 * A parsed style property value, as produced by `Style.prototype.parse()`.
 * The fields beyond `name`/`value`/`strValue`/`bypass` are written at
 * various points in a property's lifecycle (parsing, mapping, flattening,
 * bypassing), so most of them are optional.
 */
interface ParsedStyleProperty {
  /** the name of the property */
  name: string;
  /** the parsed, native-typed value of the property (number, string, value array, colour tuple, regex match array, or mapper function) */
  value?: unknown;
  /** a string value that represents the property value in valid css */
  strValue?: string;
  /** the units of the value (or per-value units for multiple-valued properties) */
  units?: string | (string | undefined)[];
  /** true iff the property is a bypass property */
  bypass?: boolean;
  /** for a bypass property: the overridden non-bypass property */
  bypassed?: ParsedStyleProperty | null;
  /** indication to delete the bypass property */
  deleteBypass?: boolean;
  /** indication to delete the bypassed property */
  deleteBypassed?: boolean;
  /** indication to delete the property (use the default value) */
  delete?: boolean;
  /** the value normalised to canonical units (px, ms, rad, [0, 1] fractions, ...) */
  pfValue?: number | (number | undefined)[];
  /** the mapping type descriptor when the value is a mapper (e.g. `types.data`) */
  mapped?: StylePropertyType;
  /** for a flattened property: a reference back to the mapping that produced it */
  mapping?: ParsedStyleProperty;
  /** the data field used by data()/mapData() mappers */
  field?: string;
  /** mapData() input range minimum */
  fieldMin?: number;
  /** mapData() input range maximum */
  fieldMax?: number;
  /** mapData() output range minimum (parsed value) */
  valueMin?: unknown;
  /** mapData() output range maximum (parsed value) */
  valueMax?: unknown;
  /** cached fn-mapper return value */
  fnValue?: unknown;
  /** previously applied fn-mapper return value */
  prevFnValue?: unknown;
}
/** `parseImpl()` returns `null` on an invalid property and `false` on a disallowed mapping. */
type ParseResult = ParsedStyleProperty | null | false;
/** Flattening flag passed through the parse functions. */
type StylePropIsFlat = boolean | 'mapping' | 'multiple' | null;
interface ParseStyfn {
  parse(this: Style, name: string, value: unknown, propIsBypass?: boolean, propIsFlat?: StylePropIsFlat): ParseResult;
  parseImplWarn(this: Style, name: string, value: unknown, propIsBypass?: boolean, propIsFlat?: StylePropIsFlat): ParseResult;
  parseImpl(this: Style, name: string, value: unknown, propIsBypass?: boolean, propIsFlat?: StylePropIsFlat): ParseResult;
}
//#endregion
//#region src/style/apply.d.mts
/** Metadata about the contexts that match an element. */
interface ContextMeta {
  /** which contexts match the element, e.g. 'ttfftt' */
  key: string;
  diffPropNames: string[];
  empty: boolean;
}
/** A computed ele style object based on matched contexts: name -> property. */
type ContextStyleMap = {
  _private: {
    key: string;
  };
} & {
  [name: string]: ParsedStyleProperty | undefined;
};
/** The previous and next values of a property that diffed during application. */
interface DiffProp {
  prev?: ParsedStyleProperty | null;
  next?: ParsedStyleProperty | null;
}
interface ApplyStyfn {
  apply(this: Style, eles: ArrayLike<StyleElement>): StyleEles;
  getPropertiesDiff(this: Style, oldCxtKey: string, newCxtKey: string): string[];
  getContextMeta(this: Style, ele: StyleElement): ContextMeta;
  getContextStyle(this: Style, cxtMeta: ContextMeta): ContextStyleMap;
  applyContextStyle(this: Style, cxtMeta: ContextMeta, cxtStyle: ContextStyleMap, ele: StyleElement): {
    diffProps: Record<string, DiffProp>;
  };
  updateStyleHints(this: Style, ele: StyleElement): boolean;
  clearStyleHints(this: Style, ele: StyleElement): void;
  applyParsedProperty(this: Style, ele: StyleElement, parsedProp: ParsedStyleProperty): boolean;
  cleanElements(this: Style, eles: ArrayLike<StyleElement>, keepBypasses?: boolean): void;
  update(this: Style): void;
  updateTransitions(this: Style, ele: StyleElement, diffProps: Record<string, DiffProp | undefined>, isBypass?: boolean): void;
  checkTrigger(this: Style, ele: StyleElement, name: string, fromValue: unknown, toValue: unknown, getTrigger: (prop: StyleProperty) => StylePropertyTriggerFn | undefined, onTrigger: (prop: StyleProperty) => void): void;
  checkZOrderTrigger(this: Style, ele: StyleElement, name: string, fromValue: unknown, toValue: unknown): void;
  checkBoundsTrigger(this: Style, ele: StyleElement, name: string, fromValue: unknown, toValue: unknown): void;
  checkConnectedEdgesBoundsTrigger(this: Style, ele: StyleElement, name: string, fromValue: unknown, toValue: unknown): void;
  checkParallelEdgesBoundsTrigger(this: Style, ele: StyleElement, name: string, fromValue: unknown, toValue: unknown): void;
  checkTriggers(this: Style, ele: StyleElement, name: string, fromValue: unknown, toValue: unknown): void;
}
//#endregion
//#region src/style/bypass.d.mts
interface BypassStyfn {
  applyBypass(this: Style, eles: ArrayLike<StyleElement>, name: string | Record<string, unknown>, value?: unknown, updateTransitions?: unknown): boolean;
  overrideBypass(this: Style, eles: ArrayLike<StyleElement>, name: string, value: unknown): void;
  removeAllBypasses(this: Style, eles: ArrayLike<StyleElement>, updateTransitions?: boolean): void;
  removeBypasses(this: Style, eles: ArrayLike<StyleElement>, props: string[], updateTransitions?: boolean): void;
}
//#endregion
//#region src/style/container.d.mts
interface ContainerStyfn {
  getEmSizeInPixels(this: Style): number;
  containerCss(this: Style, propName: string): string | undefined;
}
//#endregion
//#region src/style/get-for-ele.d.mts
interface GetForEleStyfn {
  getRenderedStyle(this: Style, ele: StyleElement, prop?: string): string | Record<string, string> | null | undefined;
  getRawStyle(this: Style, ele: StyleElement, isRenderedVal?: boolean): Record<string, string> | undefined;
  getIndexedStyle(this: Style, ele: StyleElement, property: string, subproperty: string, index: number): unknown;
  getStylePropertyValue(this: Style, ele: StyleElement, propName: string, isRenderedVal?: boolean): string | null | undefined;
  getAnimationStartStyle(this: Style, ele: StyleElement, aniProps: {
    name: string;
  }[]): Record<string, ParsedStyleProperty>;
  getPropsList(this: Style, propsObj: Record<string, unknown> | null | undefined): ParsedStyleProperty[];
  getNonDefaultPropertiesHash(this: Style, ele: StyleElement, propNames: string[], seed: number[]): number[];
  getPropertiesHash(this: Style, ele: StyleElement, propNames: string[], seed: number[]): number[];
}
//#endregion
//#region src/style/json.d.mts
/** A JSON stylesheet block: a selector and its style properties. */
interface StyleJsonBlock {
  selector: string;
  style?: Record<string, unknown>;
  css?: Record<string, unknown>;
}
interface JsonStyfn {
  appendFromJson(this: Style, json: StyleJsonBlock[]): Style;
  fromJson(this: Style, json: StyleJsonBlock[]): Style;
  json(this: Style): StyleJsonBlock[];
}
//#endregion
//#region src/style/string-sheet.d.mts
interface StringSheetStyfn {
  appendFromString(this: Style, string: string): Style;
  fromString(this: Style, string: string): Style;
}
//#endregion
//#region src/style/index.d.mts
/**
 * Minimal structural view of a Selector instance, as used by style code.
 * TODO(ts-migration): swap to the real Selector type once src/selector is converted.
 */
interface SelectorLike {
  matches(ele: StyleElement): boolean;
  text(): string;
  toString(): string;
  invalid?: boolean;
}
/** The element `_private` fields read/written by style code. */
interface StyleElementPrivate {
  /** name -> applied parsed property */
  style: Record<string, ParsedStyleProperty | null | undefined>;
  styleCxtKey?: string;
  /** style hint hashes per property group */
  styleKeys: Record<string, [number, number]>;
  styleKey: number | null;
  labelDimsKey?: number | null;
  labelKey: number | null;
  labelStyleKey: number | null;
  sourceLabelKey: number | null;
  sourceLabelStyleKey: number | null;
  targetLabelKey: number | null;
  targetLabelStyleKey: number | null;
  nodeKey: number | null;
  hasPie: boolean | null;
  hasStripe: boolean | null;
  appliedInitStyle: boolean;
  styleDirty: boolean;
  transitioning: boolean;
  group: string;
  data: Record<string, unknown>;
}
/** Minimal structural view of a playable animation, as used by style transitions. */
interface StyleAnimation {
  play(): StyleAnimation;
  promise(): PromiseLikeObject<unknown>;
}
/**
 * Minimal structural view of a single element, as used by style code.
 * Replaced by the real Element type once src/collection is converted.
 */
interface StyleElement {
  length: number;
  [index: number]: StyleElement;
  _private: StyleElementPrivate;
  pstyle(name: string, includeNonDefault?: boolean): ParsedStyleProperty;
  id(): string;
  cy(): StyleCore;
  isEdge(): boolean;
  isLoop(): boolean;
  isParent(): boolean;
  source(): StyleElement;
  target(): StyleElement;
  removed(): boolean;
  poolIndex(): number;
  dirtyCompoundBoundsCache(): void;
  dirtyBoundingBoxCache(): void;
  dirtyStyleCache(): void;
  connectedEdges(): StyleEles;
  parallelEdges(): StyleEles;
  emitAndNotify(events: string): void;
  delayAnimation(duration: number): StyleAnimation;
  animation(options: Record<string, unknown>): StyleAnimation;
}
/**
 * Minimal structural view of a collection, as used by style code.
 * Replaced by the real Collection type once src/collection is converted.
 */
interface StyleEles {
  length: number;
  [index: number]: StyleElement;
  forEach(fn: (ele: StyleElement) => void): void;
  updateStyle(): void;
  push(ele: StyleElement): unknown;
}
/**
 * Minimal structural view of the Core, as used by style code. Replaced by
 * the real Core type once src/core is converted.
 */
interface StyleCore extends CoreShim {
  collection(): StyleEles;
  elements(): StyleEles;
  mutableElements(): StyleEles;
  notify(event: string, eles?: StyleElement): void;
  container(): HTMLElement | null | undefined;
  window(): {
    getComputedStyle?: (elt: Element) => CSSStyleDeclaration;
  } | null | undefined;
  style(): Style;
}
/** The per-context parsed property list, which doubles as a name -> property map. */
type StyleContextProperties = ParsedStyleProperty[] & {
  [name: string]: ParsedStyleProperty | undefined;
};
/** A style context: a selector and the properties applied where it matches. */
interface StyleContext {
  selector: SelectorLike | null;
  properties: StyleContextProperties;
  mappedProperties: ParsedStyleProperty[];
  index: number;
}
interface StylePrivate {
  cy: StyleCore;
  coreStyle: Record<string, ParsedStyleProperty>;
  contextStyles?: Record<string, ContextStyleMap>;
  propDiffs?: Record<string, string[]>;
  hasPie?: boolean;
  hasStripe?: boolean;
  defaultProperties?: Record<string, ParseResult>;
}
interface Style extends ApplyStyfn, BypassStyfn, ContainerStyfn, GetForEleStyfn, JsonStyfn, StringSheetStyfn, PropertiesStyfn, ParseStyfn {
  length: number;
  /** the number of contexts in the default stylesheet (set by addDefaultStylesheet) */
  defaultLength: number;
  [index: number]: StyleContext;
  _private: StylePrivate;
  /** cache of parsed properties, keyed by argument hash (set lazily by parse) */
  propCache?: ParseResult[];
  instanceString(): string;
  clear(): Style;
  resetToDefault(): Style;
  core(propName: string): ParseResult;
  selector(selectorStr: string): Style;
  css(): Style;
  css(map: Record<string, unknown>): Style;
  css(name: string, value: unknown): Style;
  style: Style['css'];
  cssRule(name: string, value: unknown): Style;
  append(style: unknown): Style;
}
interface StyleStatic {
  (this: Style | void, cy: StyleCore): Style;
  new (cy: StyleCore): Style;
  prototype: Style;
  fromJson(cy: StyleCore, json: StyleJsonBlock[]): Style;
  fromString(cy: StyleCore, string: string): Style;
  types: Record<string, StylePropertyType>;
  properties: StylePropertiesTable;
  propertyGroups: Record<string, StyleProperty[]>;
  propertyGroupNames: Record<string, string[]>;
  propertyGroupKeys: string[];
}
declare let Style: StyleStatic;
//#endregion
//#region src/core/style.d.mts
/** Style engine accessor methods contributed to the core prototype. */
interface CoreStyle {
  style(this: Core, newStyle?: unknown): Style;
}
//#endregion
//#region src/core/viewport.d.mts
/** Params accepted by `zoom()` / `getZoomedViewport()` when zooming about a point. */
interface ZoomOptions {
  level?: number;
  position?: Position;
  renderedPosition?: Position;
}
/** Options accepted by `viewport()`. */
interface ViewportOptions {
  zoom?: number;
  pan?: Position;
  cancelOnFailedZoom?: boolean;
}
/** The contribution interface this mixin adds to `Core`. */
interface CoreViewport {
  autolock(): boolean;
  autolock(bool: boolean): Core;
  autoungrabify(): boolean;
  autoungrabify(bool: boolean): Core;
  autounselectify(): boolean;
  autounselectify(bool: boolean): Core;
  selectionType(): 'single' | 'additive';
  selectionType(selType: 'single' | 'additive'): Core;
  panningEnabled(): boolean;
  panningEnabled(bool: boolean): Core;
  userPanningEnabled(): boolean;
  userPanningEnabled(bool: boolean): Core;
  zoomingEnabled(): boolean;
  zoomingEnabled(bool: boolean): Core;
  userZoomingEnabled(): boolean;
  userZoomingEnabled(bool: boolean): Core;
  boxSelectionEnabled(): boolean;
  boxSelectionEnabled(bool: boolean): Core;
  pan(): Position;
  pan(dim: string): number;
  pan(dims: Position): Core;
  pan(dim: string, val: number): Core;
  panBy(dims: Position): Core;
  panBy(dim: string, val: number): Core;
  fit(elements?: Collection | string | BoundingBox | number, padding?: number): Core;
  minZoom(): number;
  minZoom(zoom: number): Core;
  maxZoom(): number;
  maxZoom(zoom: number): Core;
  zoom(): number;
  zoom(params: number | ZoomOptions): Core;
  viewport(opts: ViewportOptions): Core;
  center(elements?: Collection | string): Core;
  /** Alias of {@link center}. */
  centre(elements?: Collection | string): Core;
  reset(): Core;
  width(): number;
  height(): number;
  extent(): BoundingBox;
  renderedExtent(): BoundingBox;
}
//#endregion
//#region src/core/data.d.mts
/** Data/scratch accessor methods contributed to the core prototype. */
interface CoreData {
  data: DataFunc<Core>;
  removeData: RemoveDataFunc<Core>;
  scratch: DataFunc<Core>;
  removeScratch: RemoveDataFunc<Core>;
  attr: DataFunc<Core>;
  removeAttr: RemoveDataFunc<Core>;
}
//#endregion
//#region src/core/core-types.d.mts
/** A layout instance produced by `cy.layout()` / `cy.makeLayout()`. */
interface LayoutInstance {
  run(): this;
  start(): this;
  stop(): this;
  on(events: string, handler: (...args: any[]) => void): this;
  one(events: string, handler: (...args: unknown[]) => void): this;
  off(events: string, handler?: (...args: unknown[]) => void): this;
  trigger(events: unknown): this;
  [key: string]: unknown;
}
/** A registered renderer instance. */
interface RendererInstance {
  isHeadless(): boolean;
  notify(eles?: Collection, evts?: unknown): void;
  [key: string]: unknown;
}
/** Options accepted by the `cytoscape(...)` factory. */
interface CytoscapeOptions {
  container?: HTMLElement | null;
  elements?: any;
  style?: any;
  layout?: {
    name?: string;
    [key: string]: unknown;
  };
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
  autolockNodes?: boolean;
  autoungrabify?: boolean;
  autoungrabifyNodes?: boolean;
  autounselectify?: boolean;
  styleEnabled?: boolean;
  headless?: boolean;
  multiClickDebounceTime?: number;
  renderer?: {
    name?: string;
    [key: string]: unknown;
  };
  hideEdgesOnViewport?: boolean;
  textureOnViewport?: boolean;
  wheelSensitivity?: number;
  motionBlur?: boolean;
  ready?: (evt: unknown) => void;
  done?: () => void;
  [key: string]: unknown;
}
/** Methods defined directly in core/index.mts (not via mixins). */
interface CoreBaseFns {
  instanceString(): string;
  destroyed(): boolean;
  ready(fn: (evt: unknown) => void): this;
  destroy(): this | undefined;
  getElementById(id: string | number): Collection;
  $id(id: string | number): Collection;
  container(): HTMLElement | null;
  mount(container: HTMLElement): this | undefined;
  unmount(): this;
  json(obj?: any): any;
}
/**
 * The full Core instance type: the union of all mixin contributions plus
 * the base methods. Structurally a superset of the collection module's
 * `CoreAccess`, so a Core is accepted wherever CoreAccess is required.
 */
interface Core extends CoreBaseFns, CoreAddRemove, CoreAnimation, CoreEvents, CoreExport, CoreLayout, CoreNotification, CoreRenderer, CoreSearch, CoreStyle, CoreViewport, CoreData {}
//#endregion
//#region src/index.d.mts
/** A plugin registrant, as passed to `cytoscape.use(ext)`. */
type CytoscapeExtension = (cy: CytoscapeFactory, ...args: unknown[]) => void;
/** The cytoscape factory: create an instance, or register an extension. */
interface CytoscapeFactory {
  (options?: CytoscapeOptions): Core;
  (type: string, name: string, registrant?: unknown): unknown;
  use(ext: CytoscapeExtension, ...args: unknown[]): CytoscapeFactory;
  warnings(bool?: boolean): boolean;
  version: string;
  stylesheet: typeof Stylesheet;
  Stylesheet: typeof Stylesheet;
}
declare let cytoscape: CytoscapeFactory;
//#endregion
export { type BoundingBox, type Collection, type Core, CytoscapeExtension, CytoscapeFactory, type CytoscapeOptions, type EdgeCollection, type EdgeSingular, type Element$1 as Element, type ElementDefinition, type ElementJson, type LayoutInstance, type NodeCollection, type NodeSingular, type Position, type RendererInstance, type Singular, cytoscape as default };
export as namespace cytoscape;
