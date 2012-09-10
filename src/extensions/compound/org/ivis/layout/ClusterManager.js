Clazz.declarePackage ("org.ivis.layout");
Clazz.load (null, "org.ivis.layout.ClusterManager", ["java.util.ArrayList", "$.Collections", "org.ivis.layout.Cluster"], function () {
c$ = Clazz.decorateAsClass (function () {
this.clusters = null;
this.polygonUsed = false;
Clazz.instantialize (this, arguments);
}, org.ivis.layout, "ClusterManager");
Clazz.makeConstructor (c$, 
function () {
this.clusters =  new java.util.ArrayList ();
this.polygonUsed = false;
});
Clazz.defineMethod (c$, "getClusters", 
function () {
return this.clusters;
});
Clazz.defineMethod (c$, "setPolygonUsed", 
function (polygonUsed) {
this.polygonUsed = polygonUsed;
}, "~B");
Clazz.defineMethod (c$, "getClusterIDs", 
function () {
var result =  new java.util.ArrayList ();
var iterator = this.clusters.iterator ();
while (iterator.hasNext ()) {
var cluster = iterator.next ();
if (cluster.getClusterID () > 0) {
result.add (new Integer (cluster.getClusterID ()));
}}
java.util.Collections.sort (result);
return result;
});
Clazz.defineMethod (c$, "createCluster", 
function (clusterID, clusterName) {
var cluster =  new org.ivis.layout.Cluster (this, clusterID, clusterName);
this.clusters.add (cluster);
}, "~N,~S");
Clazz.defineMethod (c$, "createCluster", 
function (clusterName) {
var lCluster =  new org.ivis.layout.Cluster (this, clusterName);
this.clusters.add (lCluster);
}, "~S");
Clazz.defineMethod (c$, "addCluster", 
function (cluster) {
cluster.setClusterManager (this);
this.clusters.add (cluster);
}, "org.ivis.layout.Cluster");
Clazz.defineMethod (c$, "removeCluster", 
function (cluster) {
cluster.$delete ();
}, "org.ivis.layout.Cluster");
Clazz.defineMethod (c$, "isClusterIDUsed", 
function (clusterID) {
var itr = this.clusters.iterator ();
while (itr.hasNext ()) {
var cluster = itr.next ();
if (cluster.getClusterID () == clusterID) {
return true;
}}
return false;
}, "~N");
Clazz.defineMethod (c$, "getClusterByID", 
function (clusterID) {
var itr = this.clusters.iterator ();
while (itr.hasNext ()) {
var cluster = itr.next ();
if (cluster.getClusterID () == clusterID) {
return cluster;
}}
return null;
}, "~N");
Clazz.defineMethod (c$, "clearClusters", 
function () {
var clusterIDs =  new java.util.ArrayList ();
var iter = this.clusters.iterator ();
while (iter.hasNext ()) {
clusterIDs.add (new Integer (iter.next ().getClusterID ()));
}
for (var id, $id = clusterIDs.iterator (); $id.hasNext () && ((id = $id.next ()) || true);) {
this.getClusterByID ((id).intValue ()).$delete ();
}
});
Clazz.defineStatics (c$,
"idCounter", 1);
});
