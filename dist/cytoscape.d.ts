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
  same(collection: SharedCollection | string): boolean;
  anySame(collection: SharedCollection | string): boolean;
  allAreNeighbors(collection: SharedCollection | string): boolean;
  allAreNeighbours(collection: SharedCollection | string): boolean;
  contains(collection: SharedCollection | string): boolean;
  has(collection: SharedCollection | string): boolean;
}
//#endregion
//#region src/collection/filter.d.mts
/** A predicate run against each element of a collection. */
type FilterEleFn = (ele: Element$1, i: number, eles: Collection) => boolean | unknown;
/** Inputs accepted by `.filter()` and friends: selector string, predicate, or collection. */
type FilterArg = string | FilterEleFn | SharedCollection | undefined | null;
/** Inputs accepted by set operations: selector string or collection. */
type SetArg = string | SharedCollection | undefined | null;
/** Result of `.diff()`/`.difference()`. */
interface DiffResult {
  left: Collection;
  right: Collection;
  both: Collection;
}
interface CollectionFilter {
  nodes(selector?: FilterArg): NodeCollection;
  edges(selector?: FilterArg): EdgeCollection;
  filter(filter?: FilterArg, thisArg?: unknown): Collection;
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
  css(map: Css.Node | Css.Edge | Css.Core): Style;
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
//#region src/style/json.d.mts
/** A JSON stylesheet block: a selector and its style properties. */
interface StyleJsonBlock {
  selector: string;
  style?: Css.Node | Css.Edge | Css.Core;
  css?: Css.Node | Css.Edge | Css.Core;
}
type StyleJson = StyleJsonBlock[];
interface JsonStyfn {
  appendFromJson(this: Style, json: StyleJsonBlock[]): Style;
  fromJson(this: Style, json: StyleJsonBlock[]): Style;
  json(this: Style): StyleJsonBlock[];
}
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
//#region src/event.d.mts
type NativeEvent$1 = globalThis.Event;
interface EventProps {
  originalEvent?: NativeEvent$1;
  type?: string;
  cy?: CoreShim;
  target?: unknown;
  position?: Position;
  renderedPosition?: Position;
  namespace?: string | null;
  layout?: unknown;
  timeStamp?: number;
}
type EventSrc = string | NativeEvent$1 | EventProps | null | undefined;
declare class Event {
  type: string;
  originalEvent?: NativeEvent$1;
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
type EmitInput = string | string[] | Event | EventProps;
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
//#region src/core/events.d.mts
/** Public selector/handler arg of `.on()` and friends (2- or 3-arg form). */
type EventSelectorArg$1 = string | Selector | EventHandler | null | undefined;
interface CoreEvents {
  on(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler): Core;
  removeListener(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler): Core;
  removeAllListeners(): Core;
  one(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler): Core;
  emit(events: EmitInput, extraParams?: unknown[]): Core;
  addListener(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler): Core;
  listen(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler): Core;
  bind(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler): Core;
  unlisten(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler): Core;
  unbind(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler): Core;
  off(events: string | string[], selector?: EventSelectorArg$1, callback?: EventHandler): Core;
  trigger(events: EmitInput, extraParams?: unknown[]): Core;
  pon(events: string, selector?: EventSelectorArg$1): Promise<EventObject>;
  promiseOn(events: string, selector?: EventSelectorArg$1): Promise<EventObject>;
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
interface LayoutOptions$1 {
  name: string;
  eles?: Collection | string;
  [key: string]: unknown;
}
/** Layout construction methods contributed to the core prototype. */
interface CoreLayout {
  layout(this: Core, options?: LayoutOptions$1): LayoutInstance;
  makeLayout(this: Core, options?: LayoutOptions$1): LayoutInstance;
  createLayout(this: Core, options?: LayoutOptions$1): LayoutInstance;
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
interface StylesheetLike {
  generateStyle(cy: unknown): unknown;
}
/** Options accepted by the `cytoscape(...)` factory. */
interface CytoscapeOptions {
  container?: HTMLElement | null;
  elements?: any;
  style?: string | StyleJson | Promise<StyleJson> | StylesheetLike;
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
//#region src/event-types.d.mts
type NativeEvent = globalThis.Event;
/** Fields and methods common to every event object (jQuery-like). */
interface AbstractEventObject {
  /** the corresponding core instance */
  cy: Core;
  /**
   * the element or core that first caused the event.
   *
   * Typed `any` so the narrowed `EventObjectNode`/`EventObjectEdge`/
   * `EventObjectCore` variants (which fix `target` to a specific kind) remain
   * usable as handler parameters despite function-parameter contravariance —
   * matching the original hand-written declarations. Prefer the narrowed
   * variants when the target kind is known.
   */
  target: any;
  /** the event type string (e.g. `'tap'`) */
  type: string;
  /** the event namespace string (e.g. `'foo'` for `'tap.foo'`) */
  namespace: string;
  /** Unix epoch time of the event, in milliseconds */
  timeStamp: number;
  preventDefault(): void;
  stopPropagation(): void;
  stopImmediatePropagation(): void;
  isDefaultPrevented(): boolean;
  isPropagationStopped(): boolean;
  isImmediatePropagationStopped(): boolean;
}
/** Event object for user-input device events (taps, drags, …). */
interface InputEventObject extends AbstractEventObject {
  /** the model position of the event */
  position: Position;
  /** the rendered position of the event */
  renderedPosition: Position;
  /** the original user input device event */
  originalEvent: NativeEvent;
}
/** Event object for layout events. */
interface LayoutEventObject extends AbstractEventObject {
  /** the layout that triggered the event */
  layout: unknown;
}
/** The event object passed to handlers; carries both input and layout fields. */
interface EventObject extends InputEventObject, LayoutEventObject {}
/** An event whose target is a node. */
interface EventObjectNode extends EventObject {
  target: NodeSingular;
}
/** An event whose target is an edge. */
interface EventObjectEdge extends EventObject {
  target: EdgeSingular;
}
/** An event whose target is the core. */
interface EventObjectCore extends EventObject {
  target: Core;
}
/** A user-supplied event-binding callback. */
type EventHandler = (event: EventObject, ...extraParams: unknown[]) => void;
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
  data: DataFunc<SharedCollection>;
  removeData: RemoveDataFunc<SharedCollection>;
  scratch: DataFunc<SharedCollection>;
  removeScratch: RemoveDataFunc<SharedCollection>;
  attr: DataFunc<SharedCollection>;
  removeAttr: RemoveDataFunc<SharedCollection>;
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
  (this: SharedCollection): Position;
  (this: SharedCollection, pos: Partial<Position>): Collection;
  (this: SharedCollection, name: string): number;
  (this: SharedCollection, name: string, value: number): Collection;
  (this: SharedCollection, handler: (...args: any[]) => void): Collection;
}
/** Position accessor methods contributed to the collection prototype. */
interface CollectionPosition {
  position: PositionAccessor;
  modelPosition: PositionAccessor;
  point: PositionAccessor;
  positions(this: SharedCollection, pos: Partial<Position> | PositionFn, silent?: boolean): Collection;
  modelPositions(this: SharedCollection, pos: Partial<Position> | PositionFn, silent?: boolean): Collection;
  points(this: SharedCollection, pos: Partial<Position> | PositionFn, silent?: boolean): Collection;
  shift(this: SharedCollection, dim: Partial<Position> | string, val?: number | boolean, silent?: boolean): Collection;
  renderedPosition(this: SharedCollection, dim?: Partial<Position> | string, val?: number): Position | number | Collection | undefined;
  renderedPoint(this: SharedCollection, dim?: Partial<Position> | string, val?: number): Position | number | Collection | undefined;
  relativePosition(this: SharedCollection, dim?: Partial<Position> | string, val?: number): Position | number | Collection | undefined;
  relativePoint(this: SharedCollection, dim?: Partial<Position> | string, val?: number): Position | number | Collection | undefined;
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
  renderedBoundingBox(this: SharedCollection, options?: BoundingBoxOptions): BoundingBox;
  renderedBoundingbox(this: SharedCollection, options?: BoundingBoxOptions): BoundingBox;
  boundingBox(this: SharedCollection, options?: BoundingBoxOptions): BoundingBox;
  boundingbox(this: SharedCollection, options?: BoundingBoxOptions): BoundingBox;
  bb(this: SharedCollection, options?: BoundingBoxOptions): BoundingBox;
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
//#region src/collection/events.d.mts
/** Public selector/handler arg of `.on()` and friends (2- or 3-arg form). */
type EventSelectorArg = string | Selector | EventHandler | null | undefined;
interface CollectionEvents {
  on(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler): Collection;
  removeListener(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler): Collection;
  removeAllListeners(): Collection;
  one(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler): Collection;
  once(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler): void;
  emit(events: EmitInput, extraParams?: unknown[]): Collection;
  addListener(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler): Collection;
  listen(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler): Collection;
  bind(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler): Collection;
  unlisten(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler): Collection;
  unbind(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler): Collection;
  off(events: string | string[], selector?: EventSelectorArg, callback?: EventHandler): Collection;
  trigger(events: EmitInput, extraParams?: unknown[]): Collection;
  pon(events: string, selector?: EventSelectorArg): Promise<EventObject>;
  promiseOn(events: string, selector?: EventSelectorArg): Promise<EventObject>;
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
interface LayoutOptions {
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
  layoutDimensions(this: SharedCollection, options: LayoutDimensionsOptions): LayoutDimensions;
  layoutPositions(this: SharedCollection, layout: LayoutLike, options: LayoutOptions, fn: LayoutPositionFn): Collection;
  layout(this: SharedCollection, options?: Partial<LayoutOptions>): LayoutLike;
  createLayout(this: SharedCollection, options?: Partial<LayoutOptions>): LayoutLike;
  makeLayout(this: SharedCollection, options?: Partial<LayoutOptions>): LayoutLike;
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
  lock(...args: unknown[]): Collection;
  unlock(...args: unknown[]): Collection;
  grabify(...args: unknown[]): Collection;
  ungrabify(...args: unknown[]): Collection;
  select(...args: unknown[]): Collection;
  unselect(...args: unknown[]): Collection;
  deselect(...args: unknown[]): Collection;
  selectify(...args: unknown[]): Collection;
  unselectify(...args: unknown[]): Collection;
  panify(...args: unknown[]): Collection;
  unpanify(...args: unknown[]): Collection;
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
type SelectorArg = string | ((ele: Element$1, i: number, eles: Collection) => boolean | unknown) | SharedCollection | undefined | null;
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
  style?: Css.Node | Css.Edge;
  css?: Css.Node | Css.Edge;
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
type PublicSelectorArg = string | SharedCollection | ((ele: Element$1, i: number, eles: Collection) => boolean | unknown) | undefined | null;
type Singular = Element$1;
/** Edge-only members hidden from the public node types. */
type EdgeOnlyKeys = 'source' | 'target' | 'sources' | 'targets' | 'connectedNodes' | 'parallelEdges' | 'codirectedEdges' | 'isLoop' | 'isSimple' | 'midpoint' | 'controlPoints' | 'segmentPoints' | 'sourceEndpoint' | 'targetEndpoint' | 'renderedMidpoint' | 'renderedControlPoints' | 'renderedSegmentPoints' | 'renderedSourceEndpoint' | 'renderedTargetEndpoint';
/** Node-only members hidden from the public edge types. */
type NodeOnlyKeys = 'parent' | 'parents' | 'ancestors' | 'commonAncestors' | 'children' | 'siblings' | 'descendants' | 'roots' | 'leaves' | 'orphans' | 'nonorphans' | 'isParent' | 'isChild' | 'isChildless' | 'isOrphan' | 'connectedEdges' | 'edgesWith' | 'edgesTo' | 'degree' | 'indegree' | 'outdegree' | 'totalDegree' | 'minDegree' | 'maxDegree' | 'minIndegree' | 'maxIndegree' | 'minOutdegree' | 'maxOutdegree' | 'incomers' | 'outgoers' | 'successors' | 'predecessors' | 'position' | 'positions' | 'modelPosition' | 'modelPositions' | 'point' | 'points' | 'relativePosition' | 'relativePoint' | 'renderedPosition' | 'renderedPoint' | 'shift' | 'grabbable' | 'grabbed' | 'grabify' | 'ungrabify' | 'lock' | 'unlock' | 'locked' | 'layoutDimensions' | 'layoutPositions' | 'affinityPropagation' | 'ap' | 'fuzzyCMeans' | 'fcm' | 'hierarchicalClustering' | 'hca' | 'kMeans' | 'kMedoids';
/** Node-kind return-type narrowings layered over the wide collection. */
interface NodeCollectionNarrowed {
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
/** Edge-kind return-type narrowings layered over the wide collection. */
interface EdgeCollectionNarrowed {
  source(selector?: PublicSelectorArg): NodeSingular;
  target(selector?: PublicSelectorArg): NodeSingular;
  sources(selector?: PublicSelectorArg): NodeCollection;
  targets(selector?: PublicSelectorArg): NodeCollection;
  connectedNodes(selector?: PublicSelectorArg): NodeCollection;
  parallelEdges(selector?: PublicSelectorArg): EdgeCollection;
  codirectedEdges(selector?: PublicSelectorArg): EdgeCollection;
}
type NodeNarrowedKeys = keyof NodeCollectionNarrowed;
type EdgeNarrowedKeys = keyof EdgeCollectionNarrowed;
/** Kind-agnostic collection: members common to both nodes and edges. */
type SharedCollection = Omit<Collection, EdgeOnlyKeys | NodeOnlyKeys>;
type NodeCollection = Omit<Collection, EdgeOnlyKeys | NodeNarrowedKeys> & NodeCollectionNarrowed;
type EdgeCollection = Omit<Collection, NodeOnlyKeys | EdgeNarrowedKeys> & EdgeCollectionNarrowed;
type NodeSingular = Omit<Element$1, EdgeOnlyKeys | NodeNarrowedKeys> & NodeCollectionNarrowed;
type EdgeSingular = Omit<Element$1, NodeOnlyKeys | EdgeNarrowedKeys> & EdgeCollectionNarrowed;
//#endregion
//#region src/style/css-types.d.mts
/**
 * Public style ("CSS") typing surface.
 *
 * GENERATED FILE — do not hand-edit the property blocks. It mirrors the runtime
 * style inventory in `src/style/properties.mts` (the source of truth for
 * property names and value families). Regenerate with `npm run gen:css-types`
 * after changing the style properties; `npm run test:types:css` audits that
 * this declaration set stays in sync with that inventory.
 */
declare namespace Css {
  type Colour = string;
  type MapperFunction<Element, Type> = (ele: Element) => Type;
  type PropertyValue<SingularType extends NodeSingular | EdgeSingular | Core, Type> = Type | MapperFunction<SingularType, Type>;
  type PropertyValueNode<Type> = PropertyValue<NodeSingular, Type>;
  type PropertyValueEdge<Type> = PropertyValue<EdgeSingular, Type>;
  type PropertyValueCore<Type> = PropertyValue<Core, Type>;
  type ArrowFill = 'filled' | 'hollow';
  type ArrowShape = 'tee' | 'triangle' | 'triangle-tee' | 'circle-triangle' | 'triangle-cross' | 'triangle-backcurve' | 'vee' | 'square' | 'circle' | 'diamond' | 'chevron' | 'none';
  type AxisDirection = 'horizontal' | 'leftward' | 'rightward' | 'vertical' | 'upward' | 'downward' | 'auto';
  type AxisDirectionPrimary = 'horizontal' | 'vertical';
  type BackgroundClip = 'none' | 'node';
  type BackgroundContainment = 'inside' | 'over';
  type BackgroundCrossOrigin = 'anonymous' | 'use-credentials' | 'null';
  type BackgroundFit = 'none' | 'contain' | 'cover';
  type BackgroundRelativeTo = 'inner' | 'include-padding';
  type BackgroundRepeat = 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';
  type BorderStyle = 'solid' | 'dotted' | 'dashed' | 'double';
  type BoxSelection = 'contain' | 'overlap' | 'none';
  type CompoundPosition = 'parent' | 'origin';
  type CompoundSizingWrtLabels = 'include' | 'exclude';
  type CurveStyle = 'bezier' | 'unbundled-bezier' | 'haystack' | 'segments' | 'straight' | 'straight-triangle' | 'taxi' | 'round-segments' | 'round-taxi';
  type Display = 'element' | 'none';
  type EdgeDistances = 'intersection' | 'node-position' | 'endpoints';
  type Fill = 'solid' | 'linear-gradient' | 'radial-gradient';
  type FontStyle = 'italic' | 'normal' | 'oblique';
  type FontWeight = 'normal' | 'bold' | 'bolder' | 'lighter' | '100' | '200' | '300' | '400' | '500' | '600' | '800' | '900' | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  type GradientDirection = 'to-bottom' | 'to-top' | 'to-left' | 'to-right' | 'to-bottom-right' | 'to-bottom-left' | 'to-top-right' | 'to-top-left' | 'to-right-bottom' | 'to-left-bottom' | 'to-right-top' | 'to-left-top';
  type HorizontalAlign = 'left' | 'left-inside' | 'center' | 'right' | 'right-inside';
  type Justification = 'left' | 'center' | 'right' | 'auto';
  type LineCap = 'butt' | 'round' | 'square';
  type LineJoin = 'round' | 'bevel' | 'miter';
  type LinePosition = 'center' | 'inside' | 'outside';
  type LineStyle = 'solid' | 'dotted' | 'dashed';
  type NodeShape = 'rectangle' | 'roundrectangle' | 'round-rectangle' | 'cutrectangle' | 'cut-rectangle' | 'bottomroundrectangle' | 'bottom-round-rectangle' | 'barrel' | 'ellipse' | 'triangle' | 'round-triangle' | 'square' | 'pentagon' | 'round-pentagon' | 'hexagon' | 'round-hexagon' | 'concavehexagon' | 'concave-hexagon' | 'heptagon' | 'round-heptagon' | 'octagon' | 'round-octagon' | 'tag' | 'round-tag' | 'star' | 'diamond' | 'round-diamond' | 'vee' | 'rhomboid' | 'right-rhomboid' | 'polygon';
  type OverlayShape = 'roundrectangle' | 'round-rectangle' | 'ellipse';
  type PaddingRelativeTo = 'width' | 'height' | 'average' | 'min' | 'max';
  type RadiusType = 'arc-radius' | 'influence-radius';
  type TextBackgroundShape = 'rectangle' | 'roundrectangle' | 'round-rectangle' | 'circle';
  type TextMetrics = 'font' | 'glyph';
  type TextOverflowWrap = 'whitespace' | 'anywhere';
  type TextTransform = 'none' | 'uppercase' | 'lowercase';
  type TextWrap = 'none' | 'wrap' | 'ellipsis';
  type TransitionTimingFunction = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'ease-in-sine' | 'ease-out-sine' | 'ease-in-out-sine' | 'ease-in-quad' | 'ease-out-quad' | 'ease-in-out-quad' | 'ease-in-cubic' | 'ease-out-cubic' | 'ease-in-out-cubic' | 'ease-in-quart' | 'ease-out-quart' | 'ease-in-out-quart' | 'ease-in-quint' | 'ease-out-quint' | 'ease-in-out-quint' | 'ease-in-expo' | 'ease-out-expo' | 'ease-in-out-expo' | 'ease-in-circ' | 'ease-out-circ' | 'ease-in-out-circ';
  type VerticalAlign = 'top' | 'top-inside' | 'center' | 'bottom' | 'bottom-inside';
  type Visibility = 'hidden' | 'visible';
  type ZCompoundDepth = 'bottom' | 'orphan' | 'auto' | 'top';
  type ZIndexCompare = 'auto' | 'manual';
  interface CommonElement {
    [name: string]: PropertyValueNode<unknown> | PropertyValueEdge<unknown> | undefined;
    events?: PropertyValueNode<'yes' | 'no'> | PropertyValueEdge<'yes' | 'no'>;
    'text-events'?: PropertyValueNode<'yes' | 'no'> | PropertyValueEdge<'yes' | 'no'>;
    'box-selection'?: PropertyValueNode<BoxSelection> | PropertyValueEdge<BoxSelection>;
    'transition-property'?: PropertyValueNode<string | string[]> | PropertyValueEdge<string | string[]>;
    'transition-duration'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'transition-delay'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'transition-timing-function'?: PropertyValueNode<TransitionTimingFunction> | PropertyValueEdge<TransitionTimingFunction>;
    display?: PropertyValueNode<Display> | PropertyValueEdge<Display>;
    visibility?: PropertyValueNode<Visibility> | PropertyValueEdge<Visibility>;
    opacity?: PropertyValueNode<number> | PropertyValueEdge<number>;
    'text-opacity'?: PropertyValueNode<number> | PropertyValueEdge<number>;
    'min-zoomed-font-size'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'z-compound-depth'?: PropertyValueNode<ZCompoundDepth> | PropertyValueEdge<ZCompoundDepth>;
    'z-index-compare'?: PropertyValueNode<ZIndexCompare> | PropertyValueEdge<ZIndexCompare>;
    'z-index'?: PropertyValueNode<number> | PropertyValueEdge<number>;
    'overlay-padding'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'overlay-color'?: PropertyValueNode<Colour> | PropertyValueEdge<Colour>;
    'overlay-opacity'?: PropertyValueNode<number> | PropertyValueEdge<number>;
    'overlay-shape'?: PropertyValueNode<OverlayShape> | PropertyValueEdge<OverlayShape>;
    'overlay-corner-radius'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'underlay-padding'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'underlay-color'?: PropertyValueNode<Colour> | PropertyValueEdge<Colour>;
    'underlay-opacity'?: PropertyValueNode<number> | PropertyValueEdge<number>;
    'underlay-shape'?: PropertyValueNode<OverlayShape> | PropertyValueEdge<OverlayShape>;
    'underlay-corner-radius'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    ghost?: PropertyValueNode<'yes' | 'no'> | PropertyValueEdge<'yes' | 'no'>;
    'ghost-offset-x'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'ghost-offset-y'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'ghost-opacity'?: PropertyValueNode<number> | PropertyValueEdge<number>;
    'text-valign'?: PropertyValueNode<VerticalAlign> | PropertyValueEdge<VerticalAlign>;
    'text-halign'?: PropertyValueNode<HorizontalAlign> | PropertyValueEdge<HorizontalAlign>;
    color?: PropertyValueNode<Colour> | PropertyValueEdge<Colour>;
    'text-outline-color'?: PropertyValueNode<Colour> | PropertyValueEdge<Colour>;
    'text-outline-opacity'?: PropertyValueNode<number> | PropertyValueEdge<number>;
    'text-background-color'?: PropertyValueNode<Colour> | PropertyValueEdge<Colour>;
    'text-background-opacity'?: PropertyValueNode<number> | PropertyValueEdge<number>;
    'text-background-padding'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'text-border-opacity'?: PropertyValueNode<number> | PropertyValueEdge<number>;
    'text-border-color'?: PropertyValueNode<Colour> | PropertyValueEdge<Colour>;
    'text-border-width'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'text-border-style'?: PropertyValueNode<BorderStyle> | PropertyValueEdge<BorderStyle>;
    'text-background-shape'?: PropertyValueNode<TextBackgroundShape> | PropertyValueEdge<TextBackgroundShape>;
    'text-justification'?: PropertyValueNode<Justification> | PropertyValueEdge<Justification>;
    'text-metrics'?: PropertyValueNode<TextMetrics> | PropertyValueEdge<TextMetrics>;
    'box-select-labels'?: PropertyValueNode<'yes' | 'no'> | PropertyValueEdge<'yes' | 'no'>;
    'font-family'?: PropertyValueNode<string> | PropertyValueEdge<string>;
    'font-style'?: PropertyValueNode<FontStyle> | PropertyValueEdge<FontStyle>;
    'font-weight'?: PropertyValueNode<FontWeight> | PropertyValueEdge<FontWeight>;
    'font-size'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'text-transform'?: PropertyValueNode<TextTransform> | PropertyValueEdge<TextTransform>;
    'text-wrap'?: PropertyValueNode<TextWrap> | PropertyValueEdge<TextWrap>;
    'text-overflow-wrap'?: PropertyValueNode<TextOverflowWrap> | PropertyValueEdge<TextOverflowWrap>;
    'text-max-width'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'text-outline-width'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'line-height'?: PropertyValueNode<number> | PropertyValueEdge<number>;
    label?: PropertyValueNode<string> | PropertyValueEdge<string>;
    'text-rotation'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'text-margin-x'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'text-margin-y'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'source-label'?: PropertyValueNode<string> | PropertyValueEdge<string>;
    'source-text-rotation'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'source-text-margin-x'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'source-text-margin-y'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'source-text-offset'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'target-label'?: PropertyValueNode<string> | PropertyValueEdge<string>;
    'target-text-rotation'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'target-text-margin-x'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'target-text-margin-y'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    'target-text-offset'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
    content?: PropertyValueNode<string> | PropertyValueEdge<string>;
    'edge-text-rotation'?: PropertyValueNode<number | string> | PropertyValueEdge<number | string>;
  }
  interface Node extends CommonElement {
    height?: PropertyValueNode<number | string>;
    width?: PropertyValueNode<number | string>;
    shape?: PropertyValueNode<NodeShape>;
    'shape-polygon-points'?: PropertyValueNode<string | number[]>;
    'corner-radius'?: PropertyValueNode<number | string>;
    'background-color'?: PropertyValueNode<Colour>;
    'background-fill'?: PropertyValueNode<Fill>;
    'background-opacity'?: PropertyValueNode<number>;
    'background-blacken'?: PropertyValueNode<number>;
    'background-gradient-stop-colors'?: PropertyValueNode<Colour | Colour[]>;
    'background-gradient-stop-positions'?: PropertyValueNode<number | string | Array<number | string>>;
    'background-gradient-direction'?: PropertyValueNode<GradientDirection>;
    padding?: PropertyValueNode<number | string>;
    'padding-relative-to'?: PropertyValueNode<PaddingRelativeTo>;
    'bounds-expansion'?: PropertyValueNode<number | number[]>;
    'border-color'?: PropertyValueNode<Colour>;
    'border-opacity'?: PropertyValueNode<number>;
    'border-width'?: PropertyValueNode<number | string>;
    'border-style'?: PropertyValueNode<BorderStyle>;
    'border-cap'?: PropertyValueNode<LineCap>;
    'border-join'?: PropertyValueNode<LineJoin>;
    'border-dash-pattern'?: PropertyValueNode<number | number[]>;
    'border-dash-offset'?: PropertyValueNode<number>;
    'border-position'?: PropertyValueNode<LinePosition>;
    'outline-color'?: PropertyValueNode<Colour>;
    'outline-opacity'?: PropertyValueNode<number>;
    'outline-width'?: PropertyValueNode<number | string>;
    'outline-style'?: PropertyValueNode<BorderStyle>;
    'outline-offset'?: PropertyValueNode<number | string>;
    'background-image'?: PropertyValueNode<string | string[]>;
    'background-image-crossorigin'?: PropertyValueNode<BackgroundCrossOrigin>;
    'background-image-opacity'?: PropertyValueNode<number | number[]>;
    'background-image-containment'?: PropertyValueNode<BackgroundContainment>;
    'background-image-smoothing'?: PropertyValueNode<'yes' | 'no' | Array<'yes' | 'no'>>;
    'background-position-x'?: PropertyValueNode<number | string | Array<number | string>>;
    'background-position-y'?: PropertyValueNode<number | string | Array<number | string>>;
    'background-width-relative-to'?: PropertyValueNode<BackgroundRelativeTo>;
    'background-height-relative-to'?: PropertyValueNode<BackgroundRelativeTo>;
    'background-repeat'?: PropertyValueNode<BackgroundRepeat>;
    'background-fit'?: PropertyValueNode<BackgroundFit>;
    'background-clip'?: PropertyValueNode<BackgroundClip>;
    'background-width'?: PropertyValueNode<number | string | Array<number | string>>;
    'background-height'?: PropertyValueNode<number | string | Array<number | string>>;
    'background-offset-x'?: PropertyValueNode<number | string | Array<number | string>>;
    'background-offset-y'?: PropertyValueNode<number | string | Array<number | string>>;
    'pie-size'?: PropertyValueNode<number | string>;
    'pie-hole'?: PropertyValueNode<number | string>;
    'pie-start-angle'?: PropertyValueNode<number | string>;
    'pie-1-background-color'?: PropertyValueNode<Colour>;
    'pie-1-background-size'?: PropertyValueNode<number | string>;
    'pie-1-background-opacity'?: PropertyValueNode<number>;
    'pie-2-background-color'?: PropertyValueNode<Colour>;
    'pie-2-background-size'?: PropertyValueNode<number | string>;
    'pie-2-background-opacity'?: PropertyValueNode<number>;
    'pie-3-background-color'?: PropertyValueNode<Colour>;
    'pie-3-background-size'?: PropertyValueNode<number | string>;
    'pie-3-background-opacity'?: PropertyValueNode<number>;
    'pie-4-background-color'?: PropertyValueNode<Colour>;
    'pie-4-background-size'?: PropertyValueNode<number | string>;
    'pie-4-background-opacity'?: PropertyValueNode<number>;
    'pie-5-background-color'?: PropertyValueNode<Colour>;
    'pie-5-background-size'?: PropertyValueNode<number | string>;
    'pie-5-background-opacity'?: PropertyValueNode<number>;
    'pie-6-background-color'?: PropertyValueNode<Colour>;
    'pie-6-background-size'?: PropertyValueNode<number | string>;
    'pie-6-background-opacity'?: PropertyValueNode<number>;
    'pie-7-background-color'?: PropertyValueNode<Colour>;
    'pie-7-background-size'?: PropertyValueNode<number | string>;
    'pie-7-background-opacity'?: PropertyValueNode<number>;
    'pie-8-background-color'?: PropertyValueNode<Colour>;
    'pie-8-background-size'?: PropertyValueNode<number | string>;
    'pie-8-background-opacity'?: PropertyValueNode<number>;
    'pie-9-background-color'?: PropertyValueNode<Colour>;
    'pie-9-background-size'?: PropertyValueNode<number | string>;
    'pie-9-background-opacity'?: PropertyValueNode<number>;
    'pie-10-background-color'?: PropertyValueNode<Colour>;
    'pie-10-background-size'?: PropertyValueNode<number | string>;
    'pie-10-background-opacity'?: PropertyValueNode<number>;
    'pie-11-background-color'?: PropertyValueNode<Colour>;
    'pie-11-background-size'?: PropertyValueNode<number | string>;
    'pie-11-background-opacity'?: PropertyValueNode<number>;
    'pie-12-background-color'?: PropertyValueNode<Colour>;
    'pie-12-background-size'?: PropertyValueNode<number | string>;
    'pie-12-background-opacity'?: PropertyValueNode<number>;
    'pie-13-background-color'?: PropertyValueNode<Colour>;
    'pie-13-background-size'?: PropertyValueNode<number | string>;
    'pie-13-background-opacity'?: PropertyValueNode<number>;
    'pie-14-background-color'?: PropertyValueNode<Colour>;
    'pie-14-background-size'?: PropertyValueNode<number | string>;
    'pie-14-background-opacity'?: PropertyValueNode<number>;
    'pie-15-background-color'?: PropertyValueNode<Colour>;
    'pie-15-background-size'?: PropertyValueNode<number | string>;
    'pie-15-background-opacity'?: PropertyValueNode<number>;
    'pie-16-background-color'?: PropertyValueNode<Colour>;
    'pie-16-background-size'?: PropertyValueNode<number | string>;
    'pie-16-background-opacity'?: PropertyValueNode<number>;
    'stripe-size'?: PropertyValueNode<number | string>;
    'stripe-direction'?: PropertyValueNode<AxisDirectionPrimary>;
    'stripe-1-background-color'?: PropertyValueNode<Colour>;
    'stripe-1-background-size'?: PropertyValueNode<number | string>;
    'stripe-1-background-opacity'?: PropertyValueNode<number>;
    'stripe-2-background-color'?: PropertyValueNode<Colour>;
    'stripe-2-background-size'?: PropertyValueNode<number | string>;
    'stripe-2-background-opacity'?: PropertyValueNode<number>;
    'stripe-3-background-color'?: PropertyValueNode<Colour>;
    'stripe-3-background-size'?: PropertyValueNode<number | string>;
    'stripe-3-background-opacity'?: PropertyValueNode<number>;
    'stripe-4-background-color'?: PropertyValueNode<Colour>;
    'stripe-4-background-size'?: PropertyValueNode<number | string>;
    'stripe-4-background-opacity'?: PropertyValueNode<number>;
    'stripe-5-background-color'?: PropertyValueNode<Colour>;
    'stripe-5-background-size'?: PropertyValueNode<number | string>;
    'stripe-5-background-opacity'?: PropertyValueNode<number>;
    'stripe-6-background-color'?: PropertyValueNode<Colour>;
    'stripe-6-background-size'?: PropertyValueNode<number | string>;
    'stripe-6-background-opacity'?: PropertyValueNode<number>;
    'stripe-7-background-color'?: PropertyValueNode<Colour>;
    'stripe-7-background-size'?: PropertyValueNode<number | string>;
    'stripe-7-background-opacity'?: PropertyValueNode<number>;
    'stripe-8-background-color'?: PropertyValueNode<Colour>;
    'stripe-8-background-size'?: PropertyValueNode<number | string>;
    'stripe-8-background-opacity'?: PropertyValueNode<number>;
    'stripe-9-background-color'?: PropertyValueNode<Colour>;
    'stripe-9-background-size'?: PropertyValueNode<number | string>;
    'stripe-9-background-opacity'?: PropertyValueNode<number>;
    'stripe-10-background-color'?: PropertyValueNode<Colour>;
    'stripe-10-background-size'?: PropertyValueNode<number | string>;
    'stripe-10-background-opacity'?: PropertyValueNode<number>;
    'stripe-11-background-color'?: PropertyValueNode<Colour>;
    'stripe-11-background-size'?: PropertyValueNode<number | string>;
    'stripe-11-background-opacity'?: PropertyValueNode<number>;
    'stripe-12-background-color'?: PropertyValueNode<Colour>;
    'stripe-12-background-size'?: PropertyValueNode<number | string>;
    'stripe-12-background-opacity'?: PropertyValueNode<number>;
    'stripe-13-background-color'?: PropertyValueNode<Colour>;
    'stripe-13-background-size'?: PropertyValueNode<number | string>;
    'stripe-13-background-opacity'?: PropertyValueNode<number>;
    'stripe-14-background-color'?: PropertyValueNode<Colour>;
    'stripe-14-background-size'?: PropertyValueNode<number | string>;
    'stripe-14-background-opacity'?: PropertyValueNode<number>;
    'stripe-15-background-color'?: PropertyValueNode<Colour>;
    'stripe-15-background-size'?: PropertyValueNode<number | string>;
    'stripe-15-background-opacity'?: PropertyValueNode<number>;
    'stripe-16-background-color'?: PropertyValueNode<Colour>;
    'stripe-16-background-size'?: PropertyValueNode<number | string>;
    'stripe-16-background-opacity'?: PropertyValueNode<number>;
    position?: PropertyValueNode<CompoundPosition>;
    'compound-sizing-wrt-labels'?: PropertyValueNode<CompoundSizingWrtLabels>;
    'min-width'?: PropertyValueNode<number | string>;
    'min-width-bias-left'?: PropertyValueNode<number | string>;
    'min-width-bias-right'?: PropertyValueNode<number | string>;
    'min-height'?: PropertyValueNode<number | string>;
    'min-height-bias-top'?: PropertyValueNode<number | string>;
    'min-height-bias-bottom'?: PropertyValueNode<number | string>;
    'padding-left'?: PropertyValueNode<number | string>;
    'padding-right'?: PropertyValueNode<number | string>;
    'padding-top'?: PropertyValueNode<number | string>;
    'padding-bottom'?: PropertyValueNode<number | string>;
  }
  interface Edge extends CommonElement {
    'line-style'?: PropertyValueEdge<LineStyle>;
    'line-color'?: PropertyValueEdge<Colour>;
    'line-fill'?: PropertyValueEdge<Fill>;
    'line-cap'?: PropertyValueEdge<LineCap>;
    'line-opacity'?: PropertyValueEdge<number>;
    'line-dash-pattern'?: PropertyValueEdge<number | number[]>;
    'line-dash-offset'?: PropertyValueEdge<number>;
    'line-outline-width'?: PropertyValueEdge<number | string>;
    'line-outline-color'?: PropertyValueEdge<Colour>;
    'line-gradient-stop-colors'?: PropertyValueEdge<Colour | Colour[]>;
    'line-gradient-stop-positions'?: PropertyValueEdge<number | string | Array<number | string>>;
    'curve-style'?: PropertyValueEdge<CurveStyle>;
    'haystack-radius'?: PropertyValueEdge<number>;
    'source-endpoint'?: PropertyValueEdge<string | number | Array<number | string>>;
    'target-endpoint'?: PropertyValueEdge<string | number | Array<number | string>>;
    'control-point-step-size'?: PropertyValueEdge<number | string>;
    'control-point-distances'?: PropertyValueEdge<number | string | Array<number | string>>;
    'control-point-weights'?: PropertyValueEdge<number | number[]>;
    'segment-distances'?: PropertyValueEdge<number | string | Array<number | string>>;
    'segment-weights'?: PropertyValueEdge<number | number[]>;
    'segment-radii'?: PropertyValueEdge<number | number[]>;
    'radius-type'?: PropertyValueEdge<RadiusType>;
    'taxi-turn'?: PropertyValueEdge<number | string>;
    'taxi-turn-min-distance'?: PropertyValueEdge<number | string>;
    'taxi-direction'?: PropertyValueEdge<AxisDirection>;
    'taxi-radius'?: PropertyValueEdge<number>;
    'edge-distances'?: PropertyValueEdge<EdgeDistances>;
    'arrow-scale'?: PropertyValueEdge<number>;
    'loop-direction'?: PropertyValueEdge<number | string>;
    'loop-sweep'?: PropertyValueEdge<number | string>;
    'source-distance-from-node'?: PropertyValueEdge<number | string>;
    'target-distance-from-node'?: PropertyValueEdge<number | string>;
    'source-arrow-shape'?: PropertyValueEdge<ArrowShape>;
    'mid-source-arrow-shape'?: PropertyValueEdge<ArrowShape>;
    'target-arrow-shape'?: PropertyValueEdge<ArrowShape>;
    'mid-target-arrow-shape'?: PropertyValueEdge<ArrowShape>;
    'source-arrow-color'?: PropertyValueEdge<Colour>;
    'mid-source-arrow-color'?: PropertyValueEdge<Colour>;
    'target-arrow-color'?: PropertyValueEdge<Colour>;
    'mid-target-arrow-color'?: PropertyValueEdge<Colour>;
    'source-arrow-fill'?: PropertyValueEdge<ArrowFill>;
    'mid-source-arrow-fill'?: PropertyValueEdge<ArrowFill>;
    'target-arrow-fill'?: PropertyValueEdge<ArrowFill>;
    'mid-target-arrow-fill'?: PropertyValueEdge<ArrowFill>;
    'source-arrow-width'?: PropertyValueEdge<number | string>;
    'mid-source-arrow-width'?: PropertyValueEdge<number | string>;
    'target-arrow-width'?: PropertyValueEdge<number | string>;
    'mid-target-arrow-width'?: PropertyValueEdge<number | string>;
    'control-point-distance'?: PropertyValueEdge<number | string | Array<number | string>>;
    'control-point-weight'?: PropertyValueEdge<number | number[]>;
    'segment-distance'?: PropertyValueEdge<number | string | Array<number | string>>;
    'segment-weight'?: PropertyValueEdge<number | number[]>;
    'segment-radius'?: PropertyValueEdge<number | number[]>;
  }
  interface Core {
    [name: string]: PropertyValueCore<unknown> | undefined;
    'selection-box-color'?: PropertyValueCore<Colour>;
    'selection-box-opacity'?: PropertyValueCore<number>;
    'selection-box-border-color'?: PropertyValueCore<Colour>;
    'selection-box-border-width'?: PropertyValueCore<number | string>;
    'active-bg-color'?: PropertyValueCore<Colour>;
    'active-bg-opacity'?: PropertyValueCore<number>;
    'active-bg-size'?: PropertyValueCore<number | string>;
    'outside-texture-bg-color'?: PropertyValueCore<Colour>;
    'outside-texture-bg-opacity'?: PropertyValueCore<number>;
  }
}
//#endregion
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
  css(name: string | Css.Node | Css.Edge | Css.Core, value?: unknown): Stylesheet;
  style(name: string | Css.Node | Css.Edge | Css.Core, value?: unknown): Stylesheet;
  generateStyle(cy: unknown): unknown;
  appendToStyle<S>(style: S): S;
}
interface StylesheetStatic {
  (this: unknown): Stylesheet;
  new (): Stylesheet;
  prototype: Stylesheet;
}
declare let Stylesheet: StylesheetStatic;
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
export { type AbstractEventObject, type BoundingBox, type Collection, type Core, type Css, CytoscapeExtension, CytoscapeFactory, type CytoscapeOptions, type EdgeCollection, type EdgeSingular, type Element$1 as Element, type ElementDefinition, type ElementJson, type EventHandler, type EventObject, type EventObjectCore, type EventObjectEdge, type EventObjectNode, type InputEventObject, type LayoutEventObject, type LayoutInstance, type NodeCollection, type NodeSingular, type Position, type RendererInstance, type Singular, type StyleJson, type StyleJsonBlock, cytoscape as default };
export as namespace cytoscape;
