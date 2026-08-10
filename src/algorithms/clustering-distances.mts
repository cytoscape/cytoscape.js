// Common distance metrics for the clustering algorithms — v3's
// clustering-distances, retyped for gpu collections.
// https://en.wikipedia.org/wiki/Hierarchical_clustering#Metric

/** Retrieves the value of attribute dimension `dim`. */
export type DimGetter = (dim: number) => number;

export type DistanceMetricName =
  | 'euclidean'
  | 'squaredEuclidean'
  | 'squared-euclidean'
  | 'squaredeuclidean'
  | 'manhattan'
  | 'max';

/**
 * A user-supplied distance function.  With no attributes (length 0) it
 * receives the two operands directly; otherwise the per-dimension accessors.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- duck-typed like v3
export type CustomDistanceFn = (...args: any[]) => number;

export type DistanceMetric = DistanceMetricName | CustomDistanceFn;

type Visit = (ret: number, p: number, q: number) => number;

const absDiff = (p: number, q: number): number => Math.abs(q - p);
const addAbsDiff: Visit = (total, p, q) => total + absDiff(p, q);
const addSquaredDiff: Visit = (total, p, q) => total + Math.pow(q - p, 2);
const maxAbsDiff: Visit = (currentMax, p, q) =>
  Math.max(currentMax, absDiff(p, q));

const getDistance = (
  length: number,
  getP: DimGetter,
  getQ: DimGetter,
  init: number,
  visit: Visit,
  post: (ret: number) => number = (x) => x,
): number => {
  let ret = init;

  for (let dim = 0; dim < length; dim++) {
    ret = visit(ret, getP(dim), getQ(dim));
  }

  return post(ret);
};

const distances: Record<
  string,
  (length: number, getP: DimGetter, getQ: DimGetter) => number
> = {
  euclidean(length, getP, getQ) {
    if (length >= 2) {
      return getDistance(length, getP, getQ, 0, addSquaredDiff, Math.sqrt);
    }

    // single-attr case: cheaper to avoid the sqrt
    return getDistance(length, getP, getQ, 0, addAbsDiff);
  },
  squaredEuclidean(length, getP, getQ) {
    return getDistance(length, getP, getQ, 0, addSquaredDiff);
  },
  manhattan(length, getP, getQ) {
    return getDistance(length, getP, getQ, 0, addAbsDiff);
  },
  max(length, getP, getQ) {
    return getDistance(length, getP, getQ, -Infinity, maxAbsDiff);
  },
};

distances['squared-euclidean'] = distances.squaredEuclidean;
distances['squaredeuclidean'] = distances.squaredEuclidean;

/** Resolve a metric name (or custom fn) to its implementation — the
 * per-call typeof/table hop, hoistable by callers that price a whole
 * run (round 62.2).
 *
 * @param method — a `DistanceMetricName` or a custom function
 * @returns the implementation; an unrecognised name silently falls back
 *   to `euclidean`, matching v3
 */
export const resolveDistance = (method: DistanceMetric): CustomDistanceFn =>
  typeof method === 'function'
    ? method
    : distances[method] || distances.euclidean;

/**
 * Distance between two attribute vectors under the named metric, or under
 * a caller-supplied function.  An unrecognised name silently falls back to
 * `euclidean`, matching v3.  A custom function is called with v3's
 * duck-typed argument shape: with no attribute dimensions it gets the two
 * raw operands, otherwise `( length, getP, getQ, nodeP, nodeQ )`.
 *
 * @param method — a `DistanceMetricName` or a custom function
 * @param length — the number of attribute dimensions
 * @param getP — reads dimension `dim` of the first operand
 * @param getQ — reads dimension `dim` of the second operand
 * @param nodeP — the first operand itself, for custom functions
 * @param nodeQ — the second operand itself, for custom functions
 * @returns the distance; non-negative for every built-in metric
 */
export const clusteringDistance = (
  method: DistanceMetric,
  length: number,
  getP: DimGetter,
  getQ: DimGetter,
  nodeP?: unknown,
  nodeQ?: unknown,
): number => {
  const impl = resolveDistance(method);

  if (length === 0 && typeof method === 'function') {
    return impl(nodeP, nodeQ);
  }

  return impl(length, getP, getQ, nodeP, nodeQ);
};
