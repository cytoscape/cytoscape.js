/*
The GPU lanes (round 131.2): every WGSL kernel of the async algorithms,
gathered into the one `GpuRuntime` the full entry and
`cytoscape/headless-gpu` register (`gpu-registry.mts`).  This module is
the only static edge from the algorithm tier to the kernels — the tier
walk forbids it from `cytoscape/headless`, which is how that build ships
without ~45 KB of device code.
*/

import { acquireAlgoGpu, algoGpuSupported } from './algo-gpu.mjs';
import { affinityPropagationGpu } from './algo-gpu-ap.mjs';
import { betweennessCentralityGpu } from './algo-gpu-brandes.mjs';
import {
  closenessCentralityNormalizedBfsGpu,
  closenessCentralityNormalizedGpu,
} from './algo-gpu-closeness.mjs';
import {
  fuzzyCMeansGpu,
  hierarchicalClusteringGpu,
  kMeansGpu,
  kMedoidsGpu,
} from './algo-gpu-cluster.mjs';
import { floydWarshallGpu } from './algo-gpu-fw.mjs';
import { heatKernelGpu } from './algo-gpu-heat.mjs';
import { katzCentralityGpu } from './algo-gpu-katz.mjs';
import { markovClusteringGpu } from './algo-gpu-mcl.mjs';
import { motifCensusGpu } from './algo-gpu-motifs.mjs';
import { pageRankGpu } from './algo-gpu-pagerank.mjs';
import { effectiveResistanceGpu } from './algo-gpu-resistance.mjs';
import { rwrProximityGpu } from './algo-gpu-rwr.mjs';
import { neighborhoodSimilarityGpu } from './algo-gpu-similarity.mjs';
import { simRankGpu } from './algo-gpu-simrank.mjs';
import { triangleCountGpu } from './algo-gpu-triangles.mjs';
import type { GpuLaneTable, GpuRuntime } from './gpu-registry.mjs';

const LANES: GpuLaneTable = {
  affinityPropagation: affinityPropagationGpu,
  betweenness: betweennessCentralityGpu,
  closenessBfs: closenessCentralityNormalizedBfsGpu,
  closenessDense: closenessCentralityNormalizedGpu,
  effectiveResistance: effectiveResistanceGpu,
  floydWarshall: floydWarshallGpu,
  fuzzyCMeans: fuzzyCMeansGpu,
  heatKernel: heatKernelGpu,
  hierarchical: hierarchicalClusteringGpu,
  katz: katzCentralityGpu,
  kMeans: kMeansGpu,
  kMedoids: kMedoidsGpu,
  markov: markovClusteringGpu,
  motifCensus: motifCensusGpu,
  pageRank: pageRankGpu,
  rwr: rwrProximityGpu,
  similarity: neighborhoodSimilarityGpu,
  simRank: simRankGpu,
  triangles: triangleCountGpu,
};

/** The GPU runtime the full and headless-gpu entries register. */
export const GPU_RUNTIME: GpuRuntime = {
  supported: algoGpuSupported,
  acquire: acquireAlgoGpu,
  lanes: LANES,
};
