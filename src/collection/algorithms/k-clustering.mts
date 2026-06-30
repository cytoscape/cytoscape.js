// Implemented by Zoe Xi @zoexi for GSOC 2016
// https://github.com/cytoscape/cytoscape.js-k-means

// References for k-means: https://harthur.github.io/clusterfck/
// References for k-medoids: http://www.math.le.ac.uk/people/ag153/homepage/KmeansKmedoids/Kmeans_Kmedoids.html
// References for fuzzy c-means: Ross, Fuzzy Logic w/Engineering Applications (2010), pages 352-353
//                               http://yaikhom.com/2013/03/16/implementing-the-fuzzy-c-means-algorithm.html

import clusteringDistance from './clustering-distances.mjs';
import type { DistanceMetric } from './clustering-distances.mjs';
import * as util from '../../util/index.mjs';
import type { Collection, SharedCollection, Element, CoreAccess } from '../eles-types.mjs';

/** A node attribute accessor used as a clustering feature. */
export type KAttributeFn = ( node: Element ) => number;

/** A feature-vector centroid (k-means / fuzzy c-means). */
export type FeatureCentroid = number[];

/** Options accepted by the k-clustering methods. */
export interface KClusteringOptions {
  k?: number;
  m?: number;
  sensitivityThreshold?: number;
  distance?: DistanceMetric;
  maxIterations?: number;
  attributes?: KAttributeFn[];
  testMode?: boolean;
  testCentroids?: number | FeatureCentroid[] | Element[] | null;
}

/** Result of `fuzzyCMeans`. */
export interface FuzzyCMeansResult {
  clusters: Collection[];
  degreeOfMembership: number[][];
}

export interface AlgorithmsKClustering {
  kMeans( this: SharedCollection, options?: KClusteringOptions ): Collection[];
  kMedoids( this: SharedCollection, options?: KClusteringOptions ): Collection[];
  fuzzyCMeans( this: SharedCollection, options?: KClusteringOptions ): FuzzyCMeansResult;
  fcm( this: SharedCollection, options?: KClusteringOptions ): FuzzyCMeansResult;
}

/** The kind of clustering being run; controls how distances are computed. */
type KMode = 'kMeans' | 'kMedoids' | 'cmeans';

let defaults = util.defaults({
  k: 2,
  m: 2,
  sensitivityThreshold: 0.0001,
  distance: 'euclidean' as DistanceMetric,
  maxIterations: 10,
  attributes: [] as KAttributeFn[],
  testMode: false,
  testCentroids: null as number | FeatureCentroid[] | Element[] | null
});

let setOptions = ( options?: KClusteringOptions ) => defaults( options );

let getDist = function(
  type: DistanceMetric,
  node: Element,
  centroid: FeatureCentroid | Element,
  attributes: KAttributeFn[],
  mode: KMode
): number {
  let noNodeP = mode !== 'kMedoids';
  let getP = noNodeP ? ( ( i: number ) => ( centroid as FeatureCentroid )[i] ) : ( ( i: number ) => attributes[i](centroid as Element) );
  let getQ = ( i: number ) => attributes[i](node);
  let nodeP = centroid;
  let nodeQ = node;

  return clusteringDistance( type, attributes.length, getP, getQ, nodeP, nodeQ );
};

 
let randomCentroids = function( nodes: SharedCollection, k: number, attributes: KAttributeFn[], _seed?: number ): FeatureCentroid[] {
  let ndim = attributes.length;
  let min: number[]  = new Array(ndim);
  let max: number[]  = new Array(ndim);
  let centroids: FeatureCentroid[] = new Array(k);
  let centroid: FeatureCentroid | null;

  // Find min, max values for each attribute dimension
  for ( let i = 0; i < ndim; i++ ) {
    min[i] = nodes.min( attributes[i] ).value;
    max[i] = nodes.max( attributes[i] ).value;
  }

  // Build k centroids, each represented as an n-dim feature vector
  for ( let c = 0; c < k; c++ ) {
    centroid = [];
    for ( let i = 0; i < ndim; i++ ) {
      centroid[i] = Math.random() * (max[i] - min[i]) + min[i]; // random initial value
    }
    centroids[c] = centroid;
  }

  return centroids;
};

let classify = function(
  node: Element,
  centroids: FeatureCentroid[] | Element[],
  distance: DistanceMetric,
  attributes: KAttributeFn[],
  type: KMode
): number {
  let min   = Infinity;
  let index = 0;

  for ( let i = 0; i < centroids.length; i++ ) {
    let dist = getDist( distance, node, centroids[i], attributes, type );
    if (dist < min) {
      min = dist;
      index = i;
    }
  }

  return index;
};

let buildCluster = function( centroid: number, nodes: SharedCollection, assignment: Record<string, number> ): Element[] {
  let cluster: Element[] = [];
  let node: Element | null;

  for ( let n = 0; n < nodes.length; n++ ) {
    node = nodes[n];
    if ( assignment[ node.id()! ] === centroid ) {
      //console.log("Node " + node.id() + " is associated with medoid #: " + m);
      cluster.push( node );
    }
  }
  return cluster;
};

let haveValuesConverged = function( v1: number, v2: number, sensitivityThreshold: number ): boolean {
  return Math.abs( v2 - v1 ) <= sensitivityThreshold;
};

let haveMatricesConverged = function( v1: number[][], v2: number[][], sensitivityThreshold: number ): boolean {
  for ( let i = 0; i < v1.length; i++ ) {
    for (let j = 0; j < v1[i].length; j++ ) {
      let diff = Math.abs( v1[i][j] - v2[i][j] );

      if( diff > sensitivityThreshold ){ return false; }
    }
  }
  return true;
};

let seenBefore = function ( node: Element, medoids: Element[], n: number ): boolean {
  for ( let i = 0; i < n; i++ ) {
    if ( node === medoids[i] )
      return true;
  }
  return false;
};

let randomMedoids = function( nodes: SharedCollection, k: number ): Element[] {
  let medoids: Element[] = new Array(k);

  // For small data sets, the probability of medoid conflict is greater,
  // so we need to check to see if we've already seen or chose this node before.
  if (nodes.length < 50) {

    // Randomly select k medoids from the n nodes
    for (let i = 0; i < k; i++) {
      let node = nodes[ Math.floor( Math.random() * nodes.length ) ];

      // If we've already chosen this node to be a medoid, don't choose it again (for small data sets).
      // Instead choose a different random node.
      while ( seenBefore( node, medoids, i ) ) {
        node = nodes[ Math.floor( Math.random() * nodes.length ) ];
      }
      medoids[i] = node;
    }
  }
  else { // Relatively large data set, so pretty safe to not check and just select random nodes
    for (let i = 0; i < k; i++) {
      medoids[i] = nodes[ Math.floor( Math.random() * nodes.length ) ];
    }
  }
  return medoids;
};

let findCost = function( potentialNewMedoid: Element, cluster: Element[], attributes: KAttributeFn[] ): number {
  let cost = 0;
  for ( let n = 0; n < cluster.length; n++ ) {
    cost += getDist( 'manhattan', cluster[n], potentialNewMedoid, attributes, 'kMedoids' );
  }
  return cost;
};

let kMeans = function( this: SharedCollection, options?: KClusteringOptions ): Collection[] {
  let cy    = this.cy();
  let nodes = this.nodes();
  let node: Element | null;

  // Set parameters of algorithm: # of clusters, distance metric, etc.
  let opts = setOptions( options );

  // Begin k-means algorithm
  let clusters: Collection[]   = new Array(opts.k);
  let assignment: Record<string, number> = {};
  let centroids: FeatureCentroid[];

  // Step 1: Initialize centroid positions
  if ( opts.testMode ) {
    if( typeof opts.testCentroids === 'number') {
      // TODO: implement a seeded random number generator.
      let seed  = opts.testCentroids;
      centroids = randomCentroids( nodes, opts.k, opts.attributes, seed );
    }
    else if ( typeof opts.testCentroids === 'object') {
      centroids = opts.testCentroids as FeatureCentroid[];
    }
    else {
      centroids = randomCentroids( nodes, opts.k, opts.attributes );
    }
  }
  else {
    centroids = randomCentroids( nodes, opts.k, opts.attributes );
  }

  let isStillMoving = true;
  let iterations = 0;

  while ( isStillMoving && iterations < opts.maxIterations ) {

    // Step 2: Assign nodes to the nearest centroid
    for ( let n = 0; n < nodes.length; n++ ) {
      node = nodes[n];
      // Determine which cluster this node belongs to: node id => cluster #
      assignment[ node.id()! ] = classify( node, centroids, opts.distance, opts.attributes, 'kMeans' );
    }

    // Step 3: For each of the k clusters, update its centroid
    isStillMoving = false;
    for ( let c = 0; c < opts.k; c++ ) {

      // Get all nodes that belong to this cluster
      let cluster = buildCluster( c, nodes, assignment );

      if ( cluster.length === 0 ) { // If cluster is empty, break out early & move to next cluster
        continue;
      }

      // Update centroids by calculating avg of all nodes within the cluster.
      let ndim        = opts.attributes.length;
      let centroid    = centroids[c];           // [ dim_1, dim_2, dim_3, ... , dim_n ]
      let newCentroid: FeatureCentroid = new Array(ndim);
      let sum: number[]         = new Array(ndim);

      for ( let d = 0; d < ndim; d++ ) {
        sum[d] = 0.0;
        for ( let i = 0; i < cluster.length; i++ ) {
          node = cluster[i];
          sum[d] += opts.attributes[d](node);
        }
        newCentroid[d] = sum[d] / cluster.length;

        // Check to see if algorithm has converged, i.e. when centroids no longer change
        if ( !haveValuesConverged(newCentroid[d], centroid[d], opts.sensitivityThreshold) ) {
          isStillMoving = true;
        }
      }

      centroids[c] = newCentroid;
      clusters[c]  = cy.collection( cluster );
    }

    iterations++;
  }

  return clusters;
};

let kMedoids = function( this: SharedCollection, options?: KClusteringOptions ): Collection[] {
  let cy    = this.cy();
  let nodes = this.nodes();
  let node: Element | null;
  let opts  = setOptions( options );

  // k distinct medoids are required, so k cannot exceed the number of nodes.
  // Otherwise randomMedoids() can never pick k unique nodes and loops forever
  // (e.g. an empty collection, where it also reads from an empty node list).
  if ( opts.k > nodes.length ) {
    util.error(`kMedoids: k (${opts.k}) cannot exceed the number of nodes (${nodes.length}).`);
  }

  // Begin k-medoids algorithm
  let clusters: Collection[] = new Array(opts.k);
  let medoids: Element[];
  let assignment: Record<string, number> = {};
  let curCost;
  let minCosts: number[] = new Array(opts.k);    // minimum cost configuration for each cluster

  // Step 1: Initialize k medoids
  if ( opts.testMode ) {
    if( typeof opts.testCentroids === 'number') {
      // TODO: implement random generator so user can just input seed number
      medoids = randomMedoids(nodes, opts.k);
    }
    else if ( typeof opts.testCentroids === 'object') {
      medoids = opts.testCentroids as Element[];
    }
    else {
      medoids = randomMedoids(nodes, opts.k);
    }
  }
  else {
    medoids = randomMedoids(nodes, opts.k);
  }

  let isStillMoving = true;
  let iterations = 0;

  while ( isStillMoving && iterations < opts.maxIterations ) {

    // Step 2: Assign nodes to the nearest medoid
    for ( let n = 0; n < nodes.length; n++ ) {
      node = nodes[n];
      // Determine which cluster this node belongs to: node id => cluster #
      assignment[ node.id()! ] = classify( node, medoids, opts.distance, opts.attributes, 'kMedoids' );
    }

    isStillMoving = false;
    // Step 3: For each medoid m, and for each node associated with mediod m,
    // select the node with the lowest configuration cost as new medoid.
    for ( let m = 0; m < medoids.length; m++ ) {

      // Get all nodes that belong to this medoid
      let cluster = buildCluster( m, nodes, assignment );

      if ( cluster.length === 0 ) { // If cluster is empty, break out early & move to next cluster
        continue;
      }

      minCosts[m] = findCost( medoids[m], cluster, opts.attributes ); // original cost

      // Select different medoid if its configuration has the lowest cost
      for ( let n = 0; n < cluster.length; n++ ) {
        curCost = findCost( cluster[n], cluster, opts.attributes );
        if ( curCost < minCosts[m] ) {
          minCosts[m] = curCost;
          medoids[m]  = cluster[n];
          isStillMoving = true;
        }
      }

      clusters[m] = cy.collection( cluster );
    }

    iterations++;
  }

  return clusters;
};

let updateCentroids = function(
  centroids: FeatureCentroid[], nodes: SharedCollection, U: number[][], weight: number[][], opts: ReturnType<typeof setOptions>
): void {
  let numerator, denominator;

  for ( let n = 0; n < nodes.length; n++ ) {
    for ( let c = 0; c < centroids.length; c++ ) {
      weight[n][c] = Math.pow( U[n][c], opts.m );
    }
  }

  for ( let c = 0; c < centroids.length; c++ ) {
    for ( let dim = 0; dim < opts.attributes.length; dim++ ) {
      numerator   = 0;
      denominator = 0;
      for ( let n = 0; n < nodes.length; n++ ) {
        numerator   += weight[n][c] * opts.attributes[dim](nodes[n]);
        denominator += weight[n][c];
      }
      centroids[c][dim] = numerator / denominator;
    }
  }
};

let updateMembership = function(
  U: number[][], _U: number[][], centroids: FeatureCentroid[], nodes: SharedCollection, opts: ReturnType<typeof setOptions>
): void {
  // Save previous step
  for (let i = 0; i < U.length; i++) {
    _U[i] = U[i].slice();
  }

  let sum, numerator, denominator;
  let pow = 2 / (opts.m - 1);

  for ( let c = 0; c < centroids.length; c++ ) {
    for ( let n = 0; n < nodes.length; n++ ) {

      sum = 0;
      for ( let k = 0; k < centroids.length; k++ ) { // against all other centroids
        numerator   = getDist( opts.distance,  nodes[n], centroids[c], opts.attributes, 'cmeans' );
        denominator = getDist( opts.distance,  nodes[n], centroids[k], opts.attributes, 'cmeans' );
        sum += Math.pow( numerator / denominator, pow );
      }
      U[n][c] = 1 / sum;
    }
  }
};

let assign = function( nodes: SharedCollection, U: number[][], opts: ReturnType<typeof setOptions>, cy: CoreAccess ): Collection[] {
  let clustersArr: Element[][] = new Array(opts.k);
  for ( let c = 0; c < clustersArr.length; c++ ) {
    clustersArr[c] = [];
  }

  let max;
  let index;
  for ( let n = 0; n < U.length; n++ ) { // for each node (U is N x C matrix)
    max   = -Infinity;
    index = -1;
    // Determine which cluster the node is most likely to belong in
    for ( let c = 0; c < U[0].length; c++ ) {
      if ( U[n][c] > max ) {
        max = U[n][c];
        index = c;
      }
    }
    clustersArr[index].push( nodes[n] );
  }

  // Turn every array into a collection of nodes
  let clusters: Collection[] = new Array(opts.k);
  for ( let c = 0; c < clustersArr.length; c++ ) {
    clusters[c] = cy.collection( clustersArr[c] );
  }
  return clusters;
};

let fuzzyCMeans = function( this: SharedCollection, options?: KClusteringOptions ): FuzzyCMeansResult {
  let cy    = this.cy();
  let nodes = this.nodes();
  let opts  = setOptions( options );

  // Begin fuzzy c-means algorithm
  let clusters: Collection[];
  let centroids: FeatureCentroid[];
  let U: number[][];
  let _U: number[][];
  let weight: number[][];

  // Step 1: Initialize letiables.
  _U = new Array(nodes.length);
  for ( let i = 0; i < nodes.length; i++ ) { // N x C matrix
    _U[i] = new Array(opts.k);
  }

  U = new Array(nodes.length);
  for ( let i = 0; i < nodes.length; i++ ) { // N x C matrix
    U[i] = new Array(opts.k);
  }

  for (let i = 0; i < nodes.length; i++) {
    let total = 0;
    for (let j = 0; j < opts.k; j++) {
      U[i][j] = Math.random();
      total += U[i][j];
    }
    for (let j = 0; j < opts.k; j++) {
      U[i][j] = U[i][j] / total;
    }
  }

  centroids = new Array(opts.k);
  for ( let i = 0; i < opts.k; i++ ) {
    centroids[i] = new Array(opts.attributes.length);
  }

  weight = new Array(nodes.length);
  for ( let i = 0; i < nodes.length; i++ ) { // N x C matrix
    weight[i] = new Array(opts.k);
  }
  // end init FCM

  let isStillMoving = true;
  let iterations = 0;

  while ( isStillMoving && iterations < opts.maxIterations ) {
    isStillMoving = false;

    // Step 2: Calculate the centroids for each step.
    updateCentroids( centroids, nodes, U, weight, opts );

    // Step 3: Update the partition matrix U.
    updateMembership( U, _U, centroids, nodes, opts );

    // Step 4: Check for convergence.
    if ( !haveMatricesConverged( U, _U, opts.sensitivityThreshold ) ) {
      isStillMoving = true;
    }

    iterations++;
  }

  // Assign nodes to clusters with highest probability.
  clusters = assign( nodes, U, opts, cy );

  return {
    clusters: clusters,
    degreeOfMembership: U
  };
};

export default {
  kMeans, kMedoids, fuzzyCMeans, fcm: fuzzyCMeans
} as AlgorithmsKClustering;
