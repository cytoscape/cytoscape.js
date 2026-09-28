/*
The GPU executor registry (round 131.2): the seam between the algorithms
and their WGSL kernels.

Until 131 every async algorithm imported its kernel statically and handed
`runAlgo` a closure over it, so every build carried every kernel — ~45 KB
minified of device code in a bundle that might run where `navigator.gpu`
never exists (a Cloudflare Worker, a CI container).  Now an algorithm
asks this module for its lane by key, and the kernels are reached only
through a `GpuRuntime` an entry registers: the full entry (`index.mts`)
and `cytoscape/headless-gpu` register `gpu-lanes.mts`'s `GPU_RUNTIME`;
`cytoscape/headless` registers nothing, and so carries no kernel.

This module is GPU-free by construction — types, one class and a slot —
because every algorithm imports it, and the tier walk
(`test/modules/import-graph.mjs`) follows type imports too: nothing here
may name `gpu/`, `render/` or an `algo-gpu-*` module.  The lane table's
signatures are therefore spelled out rather than derived with
`typeof import(…)`.

How `runAlgo` reads it (`executor.mts`'s `route()`): an explicit
`executor: 'gpu'` with no runtime registered rejects with
`NO_GPU_BUILD` — the build's message, never "no GPU path for these
options", so a headless build is not mistaken for an unsupported option
combination; then `!supported()` rejects with the WebGPU-unavailable
text; then a null lane rejects with the family's own reason.  `'auto'`
takes the lane only when a runtime is registered, the family produced a
lane for these options, the input clears the crossover and
`supported()` answers true — otherwise it falls through exactly as it
did when `navigator.gpu` was absent.
*/

import type { Collection } from '../collection.mjs';
import type { SubgraphView } from './algo-shared.mjs';
import type { AffinityPropagationOptions } from './affinity-propagation.mjs';
import type {
  BetweennessCentralityOptions,
  BetweennessCentralityResult,
} from './betweenness-centrality.mjs';
import type {
  ClosenessCentralityNormalizedResult,
  ClosenessCentralityOptions,
} from './closeness-centrality.mjs';
import type {
  EffectiveResistanceOptions,
  EffectiveResistanceResult,
} from './effective-resistance.mjs';
import type {
  FloydWarshallOptions,
  FloydWarshallResult,
} from './floyd-warshall.mjs';
import type { HeatDiffusionOptions, HeatKernelResult } from './heat-kernel.mjs';
import type { HierarchicalClusteringOptions } from './hierarchical-clustering.mjs';
import type { FuzzyCMeansResult, KClusteringOptions } from './k-clustering.mjs';
import type {
  KatzCentralityOptions,
  KatzCentralityResult,
} from './katz-centrality.mjs';
import type { MarkovClusteringOptions } from './markov-clustering.mjs';
import type {
  buildTriadStructure,
  MotifCensusResult,
} from './motif-census.mjs';
import type {
  NeighborhoodSimilarityResult,
  SimilarityMetric,
} from './neighborhood-similarity.mjs';
import type { PageRankOptions, PageRankResult } from './page-rank.mjs';
import type {
  RandomWalkWithRestartOptions,
  RandomWalkWithRestartProximityResult,
} from './random-walk.mjs';
import type { SimRankOptions, SimRankResult } from './sim-rank.mjs';
import type { TriangleCountResult } from './triangle-counting.mjs';

/** The shared per-device state every GPU algorithm run borrows. */
export interface AlgoGpu {
  device: GPUDevice;
  /** compute pipelines keyed by kernel id, compiled once per device */
  pipelines: Map<string, GPUComputePipeline>;
}

/**
 * Thrown by a GPU implementation whose input does not fit the device
 * (a dense matrix past the storage-binding limit, say).  `runAlgo`
 * treats it like an acquisition failure: under `'auto'` the run falls
 * back to the CPU reference, under an explicit `'gpu'` it propagates —
 * unlike every other kernel error, which always propagates.  Defined
 * here, not beside the kernels, so the router's `instanceof` needs no
 * kernel module; `algo-gpu.mts` re-exports it.
 */
export class GpuUnfitError extends Error {}

/** The rejection an explicit `executor: 'gpu'` gets from a build that
 * registered no GPU runtime (`cytoscape/headless`). */
export const NO_GPU_BUILD =
  "this build has no GPU executors — import 'cytoscape/headless-gpu' or " +
  "'cytoscape'";

/**
 * Every GPU lane, by key, with its real signature: the kernel takes the
 * shared device state first, then whatever its family snapshots on the
 * CPU side.  Closeness has two lanes — the batched BFS and the dense
 * Floyd–Warshall relaxation — chosen by density at the call site.
 */
export interface GpuLaneTable {
  affinityPropagation: (
    ctx: AlgoGpu,
    coll: Collection,
    options?: AffinityPropagationOptions,
  ) => Promise<Collection[]>;
  betweenness: (
    ctx: AlgoGpu,
    coll: Collection,
    options?: BetweennessCentralityOptions,
  ) => Promise<BetweennessCentralityResult>;
  closenessBfs: (
    ctx: AlgoGpu,
    coll: Collection,
    options?: ClosenessCentralityOptions,
  ) => Promise<ClosenessCentralityNormalizedResult>;
  closenessDense: (
    ctx: AlgoGpu,
    coll: Collection,
    options?: ClosenessCentralityOptions,
  ) => Promise<ClosenessCentralityNormalizedResult>;
  effectiveResistance: (
    ctx: AlgoGpu,
    view: SubgraphView,
    options?: EffectiveResistanceOptions,
  ) => Promise<EffectiveResistanceResult>;
  floydWarshall: (
    ctx: AlgoGpu,
    coll: Collection,
    options?: FloydWarshallOptions,
  ) => Promise<FloydWarshallResult>;
  fuzzyCMeans: (
    ctx: AlgoGpu,
    coll: Collection,
    options?: KClusteringOptions,
  ) => Promise<FuzzyCMeansResult>;
  heatKernel: (
    ctx: AlgoGpu,
    view: SubgraphView,
    options?: HeatDiffusionOptions,
  ) => Promise<HeatKernelResult>;
  hierarchical: (
    ctx: AlgoGpu,
    coll: Collection,
    options?: HierarchicalClusteringOptions,
  ) => Promise<Collection[]>;
  katz: (
    ctx: AlgoGpu,
    coll: Collection,
    options?: KatzCentralityOptions,
  ) => Promise<KatzCentralityResult>;
  kMeans: (
    ctx: AlgoGpu,
    coll: Collection,
    options?: KClusteringOptions,
  ) => Promise<Collection[]>;
  kMedoids: (
    ctx: AlgoGpu,
    coll: Collection,
    options?: KClusteringOptions,
  ) => Promise<Collection[]>;
  markov: (
    ctx: AlgoGpu,
    coll: Collection,
    options?: MarkovClusteringOptions,
  ) => Promise<Collection[]>;
  motifCensus: (
    ctx: AlgoGpu,
    structure: ReturnType<typeof buildTriadStructure>,
  ) => Promise<MotifCensusResult>;
  pageRank: (
    ctx: AlgoGpu,
    coll: Collection,
    options?: PageRankOptions,
  ) => Promise<PageRankResult>;
  rwr: (
    ctx: AlgoGpu,
    view: SubgraphView,
    options?: RandomWalkWithRestartOptions,
  ) => Promise<RandomWalkWithRestartProximityResult>;
  similarity: (
    ctx: AlgoGpu,
    view: SubgraphView,
    hoods: { neighbors: Int32Array[]; sizes: Int32Array },
    metric: SimilarityMetric,
    directed: boolean,
  ) => Promise<NeighborhoodSimilarityResult>;
  simRank: (
    ctx: AlgoGpu,
    view: SubgraphView,
    hoods: { inLists: Int32Array[] },
    options?: SimRankOptions,
  ) => Promise<SimRankResult>;
  triangles: (
    ctx: AlgoGpu,
    view: SubgraphView,
    adjacency: { neighbors: Int32Array[]; degrees: Int32Array },
  ) => Promise<TriangleCountResult>;
}

/** A lane's arguments after the device state. */
type LaneArgs<K extends keyof GpuLaneTable> = GpuLaneTable[K] extends (
  ctx: AlgoGpu,
  ...args: infer A
) => unknown
  ? A
  : never;

/** A lane's resolved value. */
type LaneResult<K extends keyof GpuLaneTable> = GpuLaneTable[K] extends (
  ...args: never[]
) => Promise<infer R>
  ? R
  : never;

/** What an entry registers: the device half of every async algorithm. */
export interface GpuRuntime {
  /** the sync half of availability: `navigator.gpu` is present */
  supported(): boolean;
  /** acquire (or reuse) the shared compute device */
  acquire(): Promise<AlgoGpu>;
  /** every lane, by key */
  lanes: GpuLaneTable;
}

let registered: GpuRuntime | null = null;

/**
 * Register the build's GPU runtime (the full and headless-gpu entries do,
 * at module evaluation).  Replaces any earlier registration; `null`
 * clears it — the spec hook for the headless case on a full import.
 *
 * @param runtime — the runtime, or null for a build without GPU executors
 */
export const registerGpu = (runtime: GpuRuntime | null): void => {
  registered = runtime;
};

/**
 * The registered GPU runtime, or null when the build carries none.
 *
 * @returns the runtime, or null
 */
export const gpuRuntime = (): GpuRuntime | null => registered;

/**
 * One lane of the registered runtime, or null when no runtime is
 * registered.
 *
 * @param key — the lane's key in {@link GpuLaneTable}
 * @returns the kernel, or null
 */
export const gpuLane = <K extends keyof GpuLaneTable>(
  key: K,
): GpuLaneTable[K] | null => registered?.lanes[key] ?? null;

/**
 * The closure `runAlgo` takes for one run's GPU lane: the kernel with the
 * run's arguments bound, or null when the build has no GPU runtime —
 * `runAlgo`'s signature is unchanged, so the executor and cancel specs
 * still hand it a plain function.
 *
 * @param key — the lane's key
 * @param args — the kernel's arguments after the device state
 * @returns the bound lane, or null
 */
export const gpuCall = <K extends keyof GpuLaneTable>(
  key: K,
  ...args: LaneArgs<K>
): ((ctx: AlgoGpu) => Promise<LaneResult<K>>) | null => {
  const lane = gpuLane(key) as
    | ((ctx: AlgoGpu, ...rest: LaneArgs<K>) => Promise<LaneResult<K>>)
    | null;

  return lane == null ? null : (ctx) => lane(ctx, ...args);
};
