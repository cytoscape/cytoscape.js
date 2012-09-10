Clazz.declarePackage ("org.ivis.layout");
Clazz.load (null, "org.ivis.layout.Cluster", ["java.util.ArrayList", "$.Collections", "$.HashSet", "$.Stack", "org.ivis.layout.ClusterManager", "org.ivis.util.PointD"], function () {
c$ = Clazz.decorateAsClass (function () {
this.nodes = null;
this.clusterManager = null;
this.clusterID = 0;
this.clusterName = null;
this.polygon = null;
if (!Clazz.isClassDefined ("org.ivis.layout.Cluster.PointComparator")) {
org.ivis.layout.Cluster.$Cluster$PointComparator$ ();
}
Clazz.instantialize (this, arguments);
}, org.ivis.layout, "Cluster", null, Comparable);
Clazz.makeConstructor (c$, 
function (clusterManager, clusterName) {
this.nodes =  new java.util.HashSet ();
this.polygon =  new java.util.ArrayList ();
this.clusterManager = clusterManager;
this.clusterName = clusterName;
if (this.clusterManager != null) {
while (!this.clusterManager.isClusterIDUsed (org.ivis.layout.ClusterManager.idCounter)) {
($t$ = org.ivis.layout.ClusterManager.idCounter ++, org.ivis.layout.ClusterManager.prototype.idCounter = org.ivis.layout.ClusterManager.idCounter, $t$);
}
}this.clusterID = org.ivis.layout.ClusterManager.idCounter;
($t$ = org.ivis.layout.ClusterManager.idCounter ++, org.ivis.layout.ClusterManager.prototype.idCounter = org.ivis.layout.ClusterManager.idCounter, $t$);
}, "org.ivis.layout.ClusterManager,~S");
Clazz.makeConstructor (c$, 
function (clusterManager, clusterID, clusterName) {
this.nodes =  new java.util.HashSet ();
this.polygon =  new java.util.ArrayList ();
this.clusterManager = clusterManager;
if (this.clusterManager != null) {
if (this.clusterManager.isClusterIDUsed (clusterID)) {
System.err.println ("Cluster ID " + clusterID + " is used" + " before. ClusterID is set automatically.");
while (this.clusterManager.isClusterIDUsed (org.ivis.layout.ClusterManager.idCounter)) {
($t$ = org.ivis.layout.ClusterManager.idCounter ++, org.ivis.layout.ClusterManager.prototype.idCounter = org.ivis.layout.ClusterManager.idCounter, $t$);
}
clusterID = org.ivis.layout.ClusterManager.idCounter;
($t$ = org.ivis.layout.ClusterManager.idCounter ++, org.ivis.layout.ClusterManager.prototype.idCounter = org.ivis.layout.ClusterManager.idCounter, $t$);
}}this.clusterName = clusterName;
this.clusterID = clusterID;
}, "org.ivis.layout.ClusterManager,~N,~S");
Clazz.defineMethod (c$, "getNodes", 
function () {
return this.nodes;
});
Clazz.defineMethod (c$, "getClusterID", 
function () {
return this.clusterID;
});
Clazz.defineMethod (c$, "setClusterManager", 
function (clusterManager) {
this.clusterManager = clusterManager;
}, "org.ivis.layout.ClusterManager");
Clazz.defineMethod (c$, "getClusterName", 
function () {
return this.clusterName;
});
Clazz.defineMethod (c$, "setClusterName", 
function (clusterName) {
this.clusterName = clusterName;
}, "~S");
Clazz.defineMethod (c$, "getPolygon", 
function () {
return this.polygon;
});
Clazz.defineMethod (c$, "setPolygon", 
function (points) {
this.polygon = points;
}, "java.util.ArrayList");
Clazz.defineMethod (c$, "addNode", 
function (node) {
node.addCluster (this);
}, "org.ivis.layout.Clustered");
Clazz.defineMethod (c$, "removeNode", 
function (node) {
node.removeCluster (this);
}, "org.ivis.layout.Clustered");
Clazz.defineMethod (c$, "$delete", 
function () {
var copy =  new java.util.ArrayList ();
copy.addAll (this.nodes);
for (var node, $node = copy.iterator (); $node.hasNext () && ((node = $node.next ()) || true);) {
node.removeCluster (this);
}
this.clusterManager.getClusters ().remove (this);
});
Clazz.defineMethod (c$, "calculatePolygon", 
function () {
if (this.clusterID == 0) {
return ;
}this.calculateConvexHull ();
});
Clazz.defineMethod (c$, "findPoints", 
($fz = function () {
this.polygon.clear ();
if (this.nodes.isEmpty ()) {
return ;
}var nodeItr = this.nodes.iterator ();
var node;
while (nodeItr.hasNext ()) {
node = nodeItr.next ();
var left = node.getLeft ();
var right = node.getRight ();
var top = node.getTop ();
var bottom = node.getBottom ();
var parent = node.getParent ();
while (parent != null) {
left += parent.getLeft ();
right += parent.getLeft ();
top += parent.getTop ();
bottom += parent.getTop ();
parent = parent.getParent ();
}
this.polygon.add ( new org.ivis.util.PointD (left, top));
this.polygon.add ( new org.ivis.util.PointD (right, top));
this.polygon.add ( new org.ivis.util.PointD (right, bottom));
this.polygon.add ( new org.ivis.util.PointD (left, bottom));
}
}, $fz.isPrivate = true, $fz));
Clazz.defineMethod (c$, "calculateConvexHull", 
($fz = function () {
this.findPoints ();
if (this.polygon.isEmpty ()) {
return ;
}java.util.Collections.sort (this.polygon, Clazz.innerTypeInstance (org.ivis.layout.Cluster.PointComparator, this, null));
var upperHull =  new java.util.Stack ();
var lowerHull =  new java.util.Stack ();
var n = this.polygon.size ();
if (n < 3) {
return ;
}upperHull.push (this.polygon.get (0));
upperHull.push (this.polygon.get (1));
for (var i = 2; i < this.polygon.size (); i++) {
var pt3 = this.polygon.get (i);
while (true) {
var pt2 = upperHull.pop ();
if (upperHull.empty ()) {
upperHull.push (pt2);
upperHull.push (pt3);
break;
}var pt1 = upperHull.peek ();
if (org.ivis.layout.Cluster.rightTurn (pt1, pt2, pt3)) {
upperHull.push (pt2);
upperHull.push (pt3);
break;
}}
}
lowerHull.push (this.polygon.get (n - 1));
lowerHull.push (this.polygon.get (n - 2));
for (var i = n - 3; i >= 0; i--) {
var pt3 = this.polygon.get (i);
while (true) {
var pt2 = lowerHull.pop ();
if (lowerHull.empty ()) {
lowerHull.push (pt2);
lowerHull.push (pt3);
break;
}var pt1 = lowerHull.peek ();
if (org.ivis.layout.Cluster.rightTurn (pt1, pt2, pt3)) {
lowerHull.push (pt2);
lowerHull.push (pt3);
break;
}}
}
this.polygon.clear ();
n = lowerHull.size ();
for (var i = 0; i < n; i++) {
this.polygon.add (lowerHull.pop ());
}
n = upperHull.size ();
for (var i = 0; i < n; i++) {
this.polygon.add (upperHull.pop ());
}
}, $fz.isPrivate = true, $fz));
c$.rightTurn = Clazz.defineMethod (c$, "rightTurn", 
($fz = function (pt1, pt2, pt3) {
var x1 = pt2.x - pt1.x;
var y1 = -(pt2.y - pt1.y);
var x2 = pt3.x - pt2.x;
var y2 = -(pt3.y - pt2.y);
if ((x1 * y2 - y1 * x2) <= 0) {
return true;
} else {
return false;
}}, $fz.isPrivate = true, $fz), "org.ivis.util.PointD,org.ivis.util.PointD,org.ivis.util.PointD");
Clazz.overrideMethod (c$, "compareTo", 
function (obj) {
if (Clazz.instanceOf (obj, org.ivis.layout.Cluster)) {
var cluster = obj;
return (this.clusterID).compareTo (new Integer (cluster.getClusterID ()));
}return 0;
}, "~O");
c$.$Cluster$PointComparator$ = function () {
Clazz.pu$h ();
c$ = Clazz.decorateAsClass (function () {
Clazz.prepareCallback (this, arguments);
Clazz.instantialize (this, arguments);
}, org.ivis.layout.Cluster, "PointComparator", null, java.util.Comparator);
Clazz.overrideMethod (c$, "compare", 
function (a, b) {
var c = a;
var d = b;
if (c.x < d.x) return -1;
 else if (c.x > d.x) return 1;
 else if (Math.abs (c.x - d.x) < 1e-9 && c.y > d.y) return -1;
 else if (Math.abs (c.x - d.x) < 1e-9 && c.y < d.y) return 1;
return 0;
}, "org.ivis.util.PointD,org.ivis.util.PointD");
c$ = Clazz.p0p ();
};
});
