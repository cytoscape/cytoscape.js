// k-means / k-medoids / fuzzy c-means over node attribute vectors — a
// handle-level port of v3's k-clustering (the algorithms are feature-space,
// not adjacency-walks, so handles are the natural representation).

import type { GpuCollection } from '../collection.mjs';
import { clusteringDistance } from './clustering-distances.mjs';
import type { DistanceMetric } from './clustering-distances.mjs';

/** A node attribute accessor used as a clustering feature. */
export type KAttributeFn = ( node: GpuCollection ) => number;

export type FeatureCentroid = number[];

export interface KClusteringOptions {
  k?: number;
  m?: number;
  sensitivityThreshold?: number;
  distance?: DistanceMetric;
  maxIterations?: number;
  attributes?: KAttributeFn[];
  testMode?: boolean;
  testCentroids?: number | FeatureCentroid[] | GpuCollection[] | null;
}

export interface FuzzyCMeansResult {
  clusters: GpuCollection[];
  degreeOfMembership: number[][];
}

type KMode = 'kMeans' | 'kMedoids' | 'cmeans';

interface ResolvedKOptions {
  k: number;
  m: number;
  sensitivityThreshold: number;
  distance: DistanceMetric;
  maxIterations: number;
  attributes: KAttributeFn[];
  testMode: boolean;
  testCentroids: number | FeatureCentroid[] | GpuCollection[] | null;
}

const setOptions = ( options: KClusteringOptions = {} ): ResolvedKOptions => ( {
  k: options.k ?? 2,
  m: options.m ?? 2,
  sensitivityThreshold: options.sensitivityThreshold ?? 0.0001,
  distance: options.distance ?? 'euclidean',
  maxIterations: options.maxIterations ?? 10,
  attributes: options.attributes ?? [],
  testMode: options.testMode ?? false,
  testCentroids: options.testCentroids ?? null
} );

const spawnHandles = ( coll: GpuCollection, eles: GpuCollection[] ): GpuCollection =>
  coll._spawn( eles.map( ele => ele._refs[ 0 ] ) );

const getDist = (
  type: DistanceMetric, node: GpuCollection, centroid: FeatureCentroid | GpuCollection,
  attributes: KAttributeFn[], mode: KMode
): number => {
  const noNodeP = mode !== 'kMedoids';
  const getP = noNodeP
    ? ( i: number ) => ( centroid as FeatureCentroid )[ i ]
    : ( i: number ) => attributes[ i ]( centroid as GpuCollection );
  const getQ = ( i: number ) => attributes[ i ]( node );

  return clusteringDistance( type, attributes.length, getP, getQ, centroid, node );
};

const randomCentroids = ( nodes: GpuCollection, k: number, attributes: KAttributeFn[] ): FeatureCentroid[] => {
  const ndim = attributes.length;
  const min = new Array<number>( ndim );
  const max = new Array<number>( ndim );
  const centroids: FeatureCentroid[] = new Array( k );

  for( let i = 0; i < ndim; i++ ){
    min[ i ] = nodes.min( attributes[ i ] ).value as number;
    max[ i ] = nodes.max( attributes[ i ] ).value as number;
  }

  for( let c = 0; c < k; c++ ){
    const centroid: FeatureCentroid = [];

    for( let i = 0; i < ndim; i++ ){
      centroid[ i ] = Math.random() * ( max[ i ] - min[ i ] ) + min[ i ];
    }

    centroids[ c ] = centroid;
  }

  return centroids;
};

const classify = (
  node: GpuCollection, centroids: FeatureCentroid[] | GpuCollection[],
  distance: DistanceMetric, attributes: KAttributeFn[], type: KMode
): number => {
  let min = Infinity;
  let index = 0;

  for( let i = 0; i < centroids.length; i++ ){
    const dist = getDist( distance, node, centroids[ i ], attributes, type );

    if( dist < min ){
      min = dist;
      index = i;
    }
  }

  return index;
};

const buildCluster = ( centroid: number, nodes: GpuCollection, assignment: Record<string, number> ): GpuCollection[] => {
  const cluster: GpuCollection[] = [];

  for( let n = 0; n < nodes.length; n++ ){
    if( assignment[ nodes[ n ].id() as string ] === centroid ){
      cluster.push( nodes[ n ] );
    }
  }

  return cluster;
};

const haveValuesConverged = ( v1: number, v2: number, sensitivityThreshold: number ): boolean =>
  Math.abs( v2 - v1 ) <= sensitivityThreshold;

const haveMatricesConverged = ( v1: number[][], v2: number[][], sensitivityThreshold: number ): boolean => {
  for( let i = 0; i < v1.length; i++ ){
    for( let j = 0; j < v1[ i ].length; j++ ){
      if( Math.abs( v1[ i ][ j ] - v2[ i ][ j ] ) > sensitivityThreshold ){ return false; }
    }
  }

  return true;
};

const seenBefore = ( node: GpuCollection, medoids: GpuCollection[], n: number ): boolean => {
  for( let i = 0; i < n; i++ ){
    if( node === medoids[ i ] ){ return true; } // handles are interned singletons
  }

  return false;
};

const randomMedoids = ( nodes: GpuCollection, k: number ): GpuCollection[] => {
  const medoids: GpuCollection[] = new Array( k );

  if( nodes.length < 50 ){
    // small sets: medoid conflicts are likely, so re-roll duplicates
    for( let i = 0; i < k; i++ ){
      let node = nodes[ Math.floor( Math.random() * nodes.length ) ];

      while( seenBefore( node, medoids, i ) ){
        node = nodes[ Math.floor( Math.random() * nodes.length ) ];
      }

      medoids[ i ] = node;
    }
  } else {
    for( let i = 0; i < k; i++ ){
      medoids[ i ] = nodes[ Math.floor( Math.random() * nodes.length ) ];
    }
  }

  return medoids;
};

const findCost = ( potentialNewMedoid: GpuCollection, cluster: GpuCollection[], attributes: KAttributeFn[] ): number => {
  let cost = 0;

  for( let n = 0; n < cluster.length; n++ ){
    cost += getDist( 'manhattan', cluster[ n ], potentialNewMedoid, attributes, 'kMedoids' );
  }

  return cost;
};

/**
 * k-means over the calling collection's nodes in attribute space.  Unlike
 * the graph-walk algorithms this one never touches the adjacency: nodes
 * are points given by `attributes`, so the edges of the collection are
 * irrelevant.  Seeded randomly (uniform within the per-dimension range of
 * the data) unless `testMode` supplies `testCentroids`, so repeat runs on
 * the same graph need not agree.  Iterates until every centroid moves less
 * than `sensitivityThreshold` per dimension, or `maxIterations` passes.
 *
 * @param coll — the calling collection; only its nodes are clustered
 * @param options — `k` (default 2), `attributes`, `distance`,
 *   `maxIterations`, `sensitivityThreshold`
 * @returns `k` collections; entries stay empty (`undefined`) for centroids
 *   that attracted no node, as in v3
 */
export const kMeans = ( coll: GpuCollection, options?: KClusteringOptions ): GpuCollection[] => {
  const nodes = coll.nodes();
  const opts = setOptions( options );

  const clusters: GpuCollection[] = new Array( opts.k );
  const assignment: Record<string, number> = {};
  let centroids: FeatureCentroid[];

  if( opts.testMode && typeof opts.testCentroids === 'object' && opts.testCentroids != null ){
    centroids = opts.testCentroids as FeatureCentroid[];
  } else {
    centroids = randomCentroids( nodes, opts.k, opts.attributes );
  }

  let isStillMoving = true;
  let iterations = 0;

  while( isStillMoving && iterations < opts.maxIterations ){
    for( let n = 0; n < nodes.length; n++ ){
      assignment[ nodes[ n ].id() as string ] =
        classify( nodes[ n ], centroids, opts.distance, opts.attributes, 'kMeans' );
    }

    isStillMoving = false;

    for( let c = 0; c < opts.k; c++ ){
      const cluster = buildCluster( c, nodes, assignment );

      if( cluster.length === 0 ){ continue; }

      const ndim = opts.attributes.length;
      const centroid = centroids[ c ];
      const newCentroid: FeatureCentroid = new Array( ndim );

      for( let d = 0; d < ndim; d++ ){
        let sum = 0.0;

        for( let i = 0; i < cluster.length; i++ ){
          sum += opts.attributes[ d ]( cluster[ i ] );
        }

        newCentroid[ d ] = sum / cluster.length;

        if( !haveValuesConverged( newCentroid[ d ], centroid[ d ], opts.sensitivityThreshold ) ){
          isStillMoving = true;
        }
      }

      centroids[ c ] = newCentroid;
      clusters[ c ] = spawnHandles( coll, cluster );
    }

    iterations++;
  }

  return clusters;
};

/**
 * k-medoids: like `kMeans`, but each cluster centre is one of the nodes
 * rather than a synthetic point, and the swap cost is always Manhattan
 * (v3's choice) regardless of `distance`, which only governs assignment.
 * Cost is quadratic in cluster size per iteration, so it is markedly more
 * expensive than k-means on large clusters.
 *
 * @param coll — the calling collection; only its nodes are clustered
 * @param options — as `kMeans`; `testCentroids` here are node handles
 * @returns `k` collections, empty entries left `undefined` as in v3
 * @throws if `k` exceeds the node count — distinct medoids are required
 */
export const kMedoids = ( coll: GpuCollection, options?: KClusteringOptions ): GpuCollection[] => {
  const nodes = coll.nodes();
  const opts = setOptions( options );

  // k distinct medoids are required, so k cannot exceed the node count
  if( opts.k > nodes.length ){
    throw new Error( `kMedoids: k (${ opts.k }) cannot exceed the number of nodes (${ nodes.length }).` );
  }

  const clusters: GpuCollection[] = new Array( opts.k );
  const assignment: Record<string, number> = {};
  const minCosts: number[] = new Array( opts.k );
  let medoids: GpuCollection[];

  if( opts.testMode && typeof opts.testCentroids === 'object' && opts.testCentroids != null ){
    medoids = opts.testCentroids as GpuCollection[];
  } else {
    medoids = randomMedoids( nodes, opts.k );
  }

  let isStillMoving = true;
  let iterations = 0;

  while( isStillMoving && iterations < opts.maxIterations ){
    for( let n = 0; n < nodes.length; n++ ){
      assignment[ nodes[ n ].id() as string ] =
        classify( nodes[ n ], medoids, opts.distance, opts.attributes, 'kMedoids' );
    }

    isStillMoving = false;

    for( let m = 0; m < medoids.length; m++ ){
      const cluster = buildCluster( m, nodes, assignment );

      if( cluster.length === 0 ){ continue; }

      minCosts[ m ] = findCost( medoids[ m ], cluster, opts.attributes );

      for( let n = 0; n < cluster.length; n++ ){
        const curCost = findCost( cluster[ n ], cluster, opts.attributes );

        if( curCost < minCosts[ m ] ){
          minCosts[ m ] = curCost;
          medoids[ m ] = cluster[ n ];
          isStillMoving = true;
        }
      }

      clusters[ m ] = spawnHandles( coll, cluster );
    }

    iterations++;
  }

  return clusters;
};

const updateCentroids = (
  centroids: FeatureCentroid[], nodes: GpuCollection, U: number[][], weight: number[][], opts: ResolvedKOptions
): void => {
  for( let n = 0; n < nodes.length; n++ ){
    for( let c = 0; c < centroids.length; c++ ){
      weight[ n ][ c ] = Math.pow( U[ n ][ c ], opts.m );
    }
  }

  for( let c = 0; c < centroids.length; c++ ){
    for( let dim = 0; dim < opts.attributes.length; dim++ ){
      let numerator = 0;
      let denominator = 0;

      for( let n = 0; n < nodes.length; n++ ){
        numerator += weight[ n ][ c ] * opts.attributes[ dim ]( nodes[ n ] );
        denominator += weight[ n ][ c ];
      }

      centroids[ c ][ dim ] = numerator / denominator;
    }
  }
};

const updateMembership = (
  U: number[][], _U: number[][], centroids: FeatureCentroid[], nodes: GpuCollection, opts: ResolvedKOptions
): void => {
  for( let i = 0; i < U.length; i++ ){
    _U[ i ] = U[ i ].slice();
  }

  const pow = 2 / ( opts.m - 1 );

  for( let c = 0; c < centroids.length; c++ ){
    for( let n = 0; n < nodes.length; n++ ){
      let sum = 0;

      for( let k = 0; k < centroids.length; k++ ){
        const numerator = getDist( opts.distance, nodes[ n ], centroids[ c ], opts.attributes, 'cmeans' );
        const denominator = getDist( opts.distance, nodes[ n ], centroids[ k ], opts.attributes, 'cmeans' );

        sum += Math.pow( numerator / denominator, pow );
      }

      U[ n ][ c ] = 1 / sum;
    }
  }
};

const assign = ( coll: GpuCollection, nodes: GpuCollection, U: number[][], opts: ResolvedKOptions ): GpuCollection[] => {
  const clustersArr: GpuCollection[][] = new Array( opts.k );

  for( let c = 0; c < clustersArr.length; c++ ){ clustersArr[ c ] = []; }

  for( let n = 0; n < U.length; n++ ){
    let max = -Infinity;
    let index = -1;

    for( let c = 0; c < U[ 0 ].length; c++ ){
      if( U[ n ][ c ] > max ){
        max = U[ n ][ c ];
        index = c;
      }
    }

    clustersArr[ index ].push( nodes[ n ] );
  }

  return clustersArr.map( cluster => spawnHandles( coll, cluster ) );
};

/**
 * Fuzzy c-means: every node holds a graded membership in every cluster
 * instead of a single assignment.  Membership is seeded randomly and
 * normalised per node, then alternately updated with the centroids until
 * the membership matrix changes by less than `sensitivityThreshold`
 * everywhere, or `maxIterations` passes.  The returned crisp `clusters`
 * are the arg-max of each node's memberships.
 *
 * @param coll — the calling collection; only its nodes are clustered
 * @param options — as `kMeans`, plus `m`, the fuzziness exponent
 *   (default 2; must be > 1)
 * @returns the `k` crisp clusters plus `degreeOfMembership`, an
 *   N-by-`k` matrix in node order whose rows sum to 1
 */
export const fuzzyCMeans = ( coll: GpuCollection, options?: KClusteringOptions ): FuzzyCMeansResult => {
  const nodes = coll.nodes();
  const opts = setOptions( options );

  const _U: number[][] = new Array( nodes.length );
  const U: number[][] = new Array( nodes.length );
  const weight: number[][] = new Array( nodes.length );

  for( let i = 0; i < nodes.length; i++ ){
    _U[ i ] = new Array( opts.k );
    U[ i ] = new Array( opts.k );
    weight[ i ] = new Array( opts.k );
  }

  for( let i = 0; i < nodes.length; i++ ){
    let total = 0;

    for( let j = 0; j < opts.k; j++ ){
      U[ i ][ j ] = Math.random();
      total += U[ i ][ j ];
    }

    for( let j = 0; j < opts.k; j++ ){
      U[ i ][ j ] = U[ i ][ j ] / total;
    }
  }

  const centroids: FeatureCentroid[] = new Array( opts.k );

  for( let i = 0; i < opts.k; i++ ){
    centroids[ i ] = new Array( opts.attributes.length );
  }

  let isStillMoving = true;
  let iterations = 0;

  while( isStillMoving && iterations < opts.maxIterations ){
    isStillMoving = false;

    updateCentroids( centroids, nodes, U, weight, opts );
    updateMembership( U, _U, centroids, nodes, opts );

    if( !haveMatricesConverged( U, _U, opts.sensitivityThreshold ) ){
      isStillMoving = true;
    }

    iterations++;
  }

  return {
    clusters: assign( coll, nodes, U, opts ),
    degreeOfMembership: U
  };
};
