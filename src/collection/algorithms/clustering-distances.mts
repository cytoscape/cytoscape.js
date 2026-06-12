// Common distance metrics for clustering algorithms
// https://en.wikipedia.org/wiki/Hierarchical_clustering#Metric

import * as is from '../../is.mjs';

/** Retrieves the value of attribute dimension `dim`. */
export type DimGetter = ( dim: number ) => number;

/** A built-in metric: computes a distance from per-dimension accessors. */
export type DistanceImpl = ( length: number, getP: DimGetter, getQ: DimGetter ) => number;

/** A built-in metric name (or a convenience alias for one). */
export type DistanceMetricName =
  'euclidean' | 'squaredEuclidean' | 'squared-euclidean' | 'squaredeuclidean' | 'manhattan' | 'max';

/**
 * A user-supplied distance function. When called via the function-method
 * branch (length === 0), it receives the two operands directly; otherwise it
 * is treated like a built-in and called with the per-dimension accessors.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- duck-typed: user functions take varied operands
export type CustomDistanceFn = ( ...args: any[] ) => number;

export type DistanceMetric = DistanceMetricName | CustomDistanceFn;

let identity = ( x: number ): number => x;
let absDiff = ( p: number, q: number ): number => Math.abs( q - p );
let addAbsDiff = ( total: number, p: number, q: number ): number => total + absDiff(p, q);
let addSquaredDiff = ( total: number, p: number, q: number ): number => total + Math.pow( q - p, 2 );
let sqrt = ( x: number ): number => Math.sqrt(x);
let maxAbsDiff = ( currentMax: number, p: number, q: number ): number => Math.max( currentMax, absDiff(p, q) );

let getDistance = function(
  length: number,
  getP: DimGetter,
  getQ: DimGetter,
  init: number,
  visit: ( ret: number, p: number, q: number ) => number,
  post: ( ret: number ) => number = identity
): number {
  let ret = init;
  let p, q;

  for ( let dim = 0; dim < length; dim++ ) {
    p = getP(dim);
    q = getQ(dim);

    ret = visit( ret, p, q );
  }

  return post( ret );
};

let distances: Record<string, DistanceImpl> = {
  euclidean: function ( length, getP, getQ ) {
    if( length >= 2 ){
      return getDistance( length, getP, getQ, 0, addSquaredDiff, sqrt );
    } else { // for single attr case, more efficient to avoid sqrt
      return getDistance( length, getP, getQ, 0, addAbsDiff );
    }
  },
  squaredEuclidean: function ( length, getP, getQ ) {
    return getDistance( length, getP, getQ, 0, addSquaredDiff );
  },
  manhattan: function ( length, getP, getQ ) {
    return getDistance( length, getP, getQ, 0, addAbsDiff );
  },
  max: function ( length, getP, getQ ) {
    return getDistance( length, getP, getQ, -Infinity, maxAbsDiff );
  }
};

// in case the user accidentally doesn't use camel case
distances['squared-euclidean'] = distances['squaredEuclidean'];
distances['squaredeuclidean'] = distances['squaredEuclidean'];

export default function(
  method: DistanceMetric,
  length: number,
  getP: DimGetter,
  getQ: DimGetter,
  nodeP?: unknown,
  nodeQ?: unknown
): number {
  let impl: CustomDistanceFn;

  if( is.fn( method ) ){
    impl = method as CustomDistanceFn;
  } else {
    impl = distances[ method ] || distances.euclidean;
  }

  if( length === 0 && is.fn( method ) ){
    return impl( nodeP, nodeQ );
  } else {
    return impl( length, getP, getQ, nodeP, nodeQ );
  }
}
