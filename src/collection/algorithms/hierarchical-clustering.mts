// Implemented by Zoe Xi @zoexi for GSOC 2016
// https://github.com/cytoscape/cytoscape.js-hierarchical

// Implemented from the reference library: https://harthur.github.io/clusterfck/

import * as util from '../../util/index.mjs';
import clusteringDistance from './clustering-distances.mjs';
import type { Collection, Element, CoreAccess, NodeSingular, SharedCollection } from '../eles-types.mjs';
import type { DistanceMetric, DimGetter } from './clustering-distances.mjs';

// A node of the dendrogram / cluster tree built during clustering. `value` is a
// graph node (dendrogram mode) or an array of graph nodes (threshold mode).
interface ClusterNode {
  value?: Element | Element[];
  key: number | null;
  index: number | null;
  size?: number;
  left?: ClusterNode;
  right?: ClusterNode;
}

type ResolvedOptions = Required<HierarchicalClusteringOptions>;

export interface HierarchicalClusteringOptions {
  distance?: DistanceMetric;
  linkage?: string;
  mode?: 'threshold' | 'dendrogram';
  threshold?: number;
  addDendrogram?: boolean;
  dendrogramDepth?: number;
  attributes?: Array<( node: NodeSingular ) => number>;
}

export interface AlgorithmsHierarchicalClustering {
  hierarchicalClustering( options?: HierarchicalClusteringOptions ): Collection[];
  hca( options?: HierarchicalClusteringOptions ): Collection[];
}

const defaults = util.defaults({
  distance: 'euclidean', // distance metric to compare nodes
  linkage: 'min', // linkage criterion : how to determine the distance between clusters of nodes
  mode: 'threshold',
  // mode:'threshold' => clusters must be threshold distance apart
    threshold: Infinity, // the distance threshold
  // mode:'dendrogram' => the nodes are organised as leaves in a tree (siblings are close), merging makes clusters
    addDendrogram: false, // whether to add the dendrogram to the graph for viz
    dendrogramDepth: 0, // depth at which dendrogram branches are merged into the returned clusters
  attributes: [] // array of attr functions
});

const linkageAliases: { [key: string]: string } = {
  'single': 'min',
  'complete': 'max'
};

let setOptions = ( options?: HierarchicalClusteringOptions ): ResolvedOptions => {
  // `defaults` infers `attributes: never[]`; cast through unknown at this boundary.
  let opts = defaults( options as unknown as Parameters<typeof defaults>[0] ) as unknown as ResolvedOptions;

  let preferredAlias = linkageAliases[ opts.linkage ];

  if( preferredAlias != null ){
    opts.linkage = preferredAlias;
  }

  return opts;
};

let mergeClosest = function( clusters: ClusterNode[], index: ClusterNode[], dists: number[][], mins: number[], opts: ResolvedOptions ) {
  // Find two closest clusters from cached mins
  let minKey = 0;
  let min = Infinity;
  let dist;
  let attrs = opts.attributes;

  let getDist = (n1: Element, n2: Element) => clusteringDistance( opts.distance, attrs.length, ( ( i: number ) => attrs[i](n1 as unknown as NodeSingular) ) as DimGetter, ( ( i: number ) => attrs[i](n2 as unknown as NodeSingular) ) as DimGetter, n1, n2 );

  for ( let i = 0; i < clusters.length; i++ ) {
    let key  = clusters[i].key!;
    let dist = dists[key][mins[key]];
    if ( dist < min ) {
      minKey = key;
      min = dist;
    }
  }
  if ( (opts.mode === 'threshold'  && min >= opts.threshold) ||
       (opts.mode === 'dendrogram' && clusters.length === 1) ) {
    return false;
  }

  let c1 = index[minKey];
  let c2 = index[mins[minKey]];
  let merged: ClusterNode;

  // Merge two closest clusters
  if ( opts.mode === 'dendrogram' ) {
    merged = {
      left: c1,
      right: c2,
      key: c1.key,
      index: null
    };
  }
  else {
    merged = {
      value: ( c1.value as Element[] ).concat( c2.value as Element[] ),
      key: c1.key,
      index: null
    };
  }

  clusters[c1.index!] = merged;
  clusters.splice(c2.index!, 1);

  index[c1.key!] = merged;

  // Update distances with new merged cluster
  for ( let i = 0; i < clusters.length; i++ ) {
    let cur = clusters[i];

    if ( c1.key === cur.key ) {
      dist = Infinity;
    }
    else if ( opts.linkage === 'min' ) {
      dist = dists[c1.key!][cur.key!];
      if ( dists[c1.key!][cur.key!] > dists[c2.key!][cur.key!] ) {
        dist = dists[c2.key!][cur.key!];
      }
    }
    else if ( opts.linkage === 'max' ) {
      dist = dists[c1.key!][cur.key!];
      if ( dists[c1.key!][cur.key!] < dists[c2.key!][cur.key!] ) {
        dist = dists[c2.key!][cur.key!];
      }
    }
    else if ( opts.linkage === 'mean' ) {
      dist = (dists[c1.key!][cur.key!] * c1.size! + dists[c2.key!][cur.key!] * c2.size!) / (c1.size! + c2.size!);
    }
    else {
      if ( opts.mode === 'dendrogram' )
        dist = getDist( cur.value as Element, c1.value as Element );
      else
        dist = getDist( ( cur.value as Element[] )[0], ( c1.value as Element[] )[0] );
    }

    dists[c1.key!][cur.key!] = dists[cur.key!][c1.key!] = dist; // distance matrix is symmetric
  }

  // Update cached mins
  for ( let i = 0; i < clusters.length; i++ ) {
    let key1 = clusters[i].key!;
    if ( mins[key1] === c1.key || mins[key1] === c2.key ) {
      let min = key1;
      for ( let j = 0; j < clusters.length; j++ ) {
        let key2 = clusters[j].key!;
        if ( dists[key1][key2] < dists[key1][min] ) {
          min = key2;
        }
      }
      mins[key1] = min;
    }
    clusters[i].index = i;
  }

  // Clean up meta data used for clustering
  c1.key = c2.key = c1.index = c2.index = null;

  return true;
};

let getAllChildren = function( root: ClusterNode | undefined, arr: Element[], cy: CoreAccess ) {

  if ( !root )
      return;

  if ( root.value ) {
    arr.push( root.value as Element );
  }
  else {
    if ( root.left )
      getAllChildren( root.left, arr, cy );
    if ( root.right )
      getAllChildren( root.right, arr, cy );
  }
};

let buildDendrogram = function ( root: ClusterNode | undefined, cy: CoreAccess ): string | undefined {

  if ( !root )
      return '';

  if ( root.left && root.right ) {

    let leftStr = buildDendrogram( root.left, cy );
    let rightStr = buildDendrogram( root.right, cy );

    // `add` is part of the Core API but not modelled on CoreAccess; cast at the boundary.
    let cyAdd = cy as unknown as { add( spec: unknown ): Element };
    let node = cyAdd.add({group:'nodes', data: {id: leftStr + ',' + rightStr}});

    cyAdd.add({group:'edges', data: { source: leftStr, target: node.id() }});
    cyAdd.add({group:'edges', data: { source: rightStr, target: node.id() }});

    return node.id();
  }
  else if ( root.value ) {
    return ( root.value as Element ).id();
  }

};

let buildClustersFromTree = function( root: ClusterNode | undefined, k: number, cy: CoreAccess ): Collection[] {

  if ( !root )
      return [];

  // `left`/`right` hold leaf Elements (k <= 1) or recursively-built clusters (k > 1).
  let left: Element[] = [], right: Element[] = [], leaves: Element[];

  if ( k === 0 ) { // don't cut tree, simply return all nodes as 1 single cluster
    if ( root.left )
      getAllChildren( root.left, left, cy );
    if ( root.right )
      getAllChildren( root.right, right, cy );

    leaves = left.concat(right);
    return [ cy.collection(leaves) ];
  }
  else if ( k === 1 ) { // cut at root

    if ( root.value ) { // leaf node
      return [ cy.collection( root.value ) ];
    }
    else {
      if ( root.left )
        getAllChildren( root.left, left, cy );
      if ( root.right )
        getAllChildren( root.right, right, cy );

      return [ cy.collection(left), cy.collection(right) ];
    }
  }
  else {
    if ( root.value ) {
      return [ cy.collection(root.value) ];
    }
    else {
      // Recursion returns Collection[]; reuse the locals via a cast at this boundary.
      let leftC: Collection[] = [], rightC: Collection[] = [];
      if ( root.left )
        leftC  = buildClustersFromTree( root.left, k - 1, cy );
      if ( root.right )
        rightC = buildClustersFromTree( root.right, k - 1, cy );

      return leftC.concat(rightC);
    }
  }
};

let hierarchicalClustering = function( this: SharedCollection, options?: HierarchicalClusteringOptions ){
  let cy    = this.cy();
  let nodes = this.nodes();

  // Nothing to cluster: return no clusters and add no dendrogram. Handles the
  // empty case locally so dendrogram mode never indexes into empty `clusters`
  // (which previously threw a TypeError), and keeps both modes consistent.
  if ( nodes.length === 0 ){
    return [];
  }

  // Set parameters of algorithm: linkage type, distance metric, etc.
  let opts = setOptions( options );

  let attrs = opts.attributes;
  let getDist = (n1: Element, n2: Element) => clusteringDistance( opts.distance, attrs.length, ( ( i: number ) => attrs[i](n1 as unknown as NodeSingular) ) as DimGetter, ( ( i: number ) => attrs[i](n2 as unknown as NodeSingular) ) as DimGetter, n1, n2 );

  // Begin hierarchical algorithm
  let clusters: ClusterNode[] = [];
  let dists: number[][]    = [];  // distances between each pair of clusters
  let mins: number[]     = [];  // closest cluster for each cluster
  let index: ClusterNode[]    = [];  // hash of all clusters by key

  // In agglomerative (bottom-up) clustering, each node starts as its own cluster
  for ( let n = 0; n < nodes.length; n++ ) {
    let cluster = {
      value: (opts.mode === 'dendrogram') ? nodes[n] : [ nodes[n] ],
      key:   n,
      index: n
    };
    clusters[n] = cluster;
    index[n]    = cluster;
    dists[n]    = [];
    mins[n]     = 0;
  }

  // Calculate the distance between each pair of clusters
  for ( let i = 0; i < clusters.length; i++ ) {
    for ( let j = 0; j <= i; j++ ) {
      let dist;

      if ( opts.mode === 'dendrogram' ){ // modes store cluster values differently
        dist = (i === j) ? Infinity : getDist( clusters[i].value as Element, clusters[j].value as Element );
      } else {
        dist = (i === j) ? Infinity : getDist( ( clusters[i].value as Element[] )[0], ( clusters[j].value as Element[] )[0] );
      }

      dists[i][j] = dist;
      dists[j][i] = dist;

      if ( dist < dists[i][mins[i]] ) {
        mins[i] = j;  // Cache mins: closest cluster to cluster i is cluster j
      }
    }
  }

  // Find the closest pair of clusters and merge them into a single cluster.
  // Update distances between new cluster and each of the old clusters, and loop until threshold reached.
  let merged = mergeClosest( clusters, index, dists, mins, opts );
  while ( merged ) {
    merged = mergeClosest( clusters, index, dists, mins, opts );
  }

  let retClusters;

  // Dendrogram mode builds the hierarchy and adds intermediary nodes + edges
  // in addition to returning the clusters.
  if ( opts.mode === 'dendrogram') {
    retClusters = buildClustersFromTree( clusters[0], opts.dendrogramDepth, cy );

    if ( opts.addDendrogram )
      buildDendrogram( clusters[0], cy );
  }
  else { // Regular mode simply returns the clusters

    retClusters = new Array(clusters.length);
    clusters.forEach( function( cluster, i ) {
      // Clean up meta data used for clustering
      cluster.key = cluster.index = null;

      retClusters[i] = cy.collection( cluster.value );
    });
  }

  return retClusters;
};

export default { hierarchicalClustering, hca: hierarchicalClustering };
