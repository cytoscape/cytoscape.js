Clazz.declarePackage ("org.ivis.layout");
Clazz.load (["org.ivis.layout.Clustered", "$.LGraphObject", "java.util.Random"], "org.ivis.layout.LNode", ["java.util.ArrayList", "$.HashSet", "$.LinkedList", "$.Vector", "org.ivis.layout.Cluster", "org.ivis.util.PointD", "$.RectangleD"], function () {
c$ = Clazz.decorateAsClass (function () {
this.graphManager = null;
this.child = null;
this.owner = null;
this.edges = null;
this.rect = null;
this.clusters = null;
this.estimatedSize = -2147483648;
this.inclusionTreeDepth = 2147483647;
Clazz.instantialize (this, arguments);
}, org.ivis.layout, "LNode", org.ivis.layout.LGraphObject, org.ivis.layout.Clustered);
Clazz.makeConstructor (c$, 
function (gm, vNode) {
Clazz.superConstructor (this, org.ivis.layout.LNode, [vNode]);
this.initialize ();
this.graphManager = gm;
this.rect =  new org.ivis.util.RectangleD ();
}, "org.ivis.layout.LGraphManager,~O");
Clazz.makeConstructor (c$, 
function (gm, loc, size, vNode) {
Clazz.superConstructor (this, org.ivis.layout.LNode, [vNode]);
this.initialize ();
this.graphManager = gm;
this.rect =  new org.ivis.util.RectangleD (loc.x, loc.y, size.width, size.height);
}, "org.ivis.layout.LGraphManager,newawt.Point,newawt.Dimension,~O");
Clazz.makeConstructor (c$, 
function (layout, vNode) {
Clazz.superConstructor (this, org.ivis.layout.LNode, [vNode]);
this.initialize ();
this.graphManager = layout.graphManager;
this.rect =  new org.ivis.util.RectangleD ();
}, "org.ivis.layout.Layout,~O");
Clazz.defineMethod (c$, "initialize", 
function () {
this.edges =  new java.util.LinkedList ();
this.clusters =  new java.util.LinkedList ();
});
Clazz.defineMethod (c$, "getEdges", 
function () {
return this.edges;
});
Clazz.defineMethod (c$, "getChild", 
function () {
return this.child;
});
Clazz.defineMethod (c$, "setChild", 
function (child) {
this.child = child;
}, "org.ivis.layout.LGraph");
Clazz.defineMethod (c$, "getOwner", 
function () {
return this.owner;
});
Clazz.defineMethod (c$, "setOwner", 
function (owner) {
this.owner = owner;
}, "org.ivis.layout.LGraph");
Clazz.defineMethod (c$, "getWidth", 
function () {
return this.rect.width;
});
Clazz.defineMethod (c$, "setWidth", 
function (width) {
this.rect.width = width;
}, "~N");
Clazz.defineMethod (c$, "getHeight", 
function () {
return this.rect.height;
});
Clazz.defineMethod (c$, "setHeight", 
function (height) {
this.rect.height = height;
}, "~N");
Clazz.overrideMethod (c$, "getLeft", 
function () {
return this.rect.x;
});
Clazz.overrideMethod (c$, "getRight", 
function () {
return this.rect.x + this.rect.width;
});
Clazz.overrideMethod (c$, "getTop", 
function () {
return this.rect.y;
});
Clazz.overrideMethod (c$, "getBottom", 
function () {
return this.rect.y + this.rect.height;
});
Clazz.defineMethod (c$, "getCenterX", 
function () {
return this.rect.x + this.rect.width / 2;
});
Clazz.defineMethod (c$, "getCenterY", 
function () {
return this.rect.y + this.rect.height / 2;
});
Clazz.defineMethod (c$, "getCenter", 
function () {
return  new org.ivis.util.PointD (this.rect.x + this.rect.width / 2, this.rect.y + this.rect.height / 2);
});
Clazz.defineMethod (c$, "getLocation", 
function () {
return  new org.ivis.util.PointD (this.rect.x, this.rect.y);
});
Clazz.defineMethod (c$, "getRect", 
function () {
return this.rect;
});
Clazz.defineMethod (c$, "getDiagonal", 
function () {
return Math.sqrt (this.rect.width * this.rect.width + this.rect.height * this.rect.height);
});
Clazz.defineMethod (c$, "getHalfTheDiagonal", 
function () {
return Math.sqrt (this.rect.height * this.rect.height + this.rect.width * this.rect.width) / 2;
});
Clazz.defineMethod (c$, "setRect", 
function (upperLeft, dimension) {
this.rect.x = upperLeft.x;
this.rect.y = upperLeft.y;
this.rect.width = dimension.width;
this.rect.height = dimension.height;
}, "newawt.Point,newawt.Dimension");
Clazz.defineMethod (c$, "setCenter", 
function (cx, cy) {
this.rect.x = cx - this.rect.width / 2;
this.rect.y = cy - this.rect.height / 2;
}, "~N,~N");
Clazz.defineMethod (c$, "setLocation", 
function (x, y) {
this.rect.x = x;
this.rect.y = y;
}, "~N,~N");
Clazz.defineMethod (c$, "moveBy", 
function (dx, dy) {
this.rect.x += dx;
this.rect.y += dy;
}, "~N,~N");
Clazz.defineMethod (c$, "getClusterID", 
function () {
if (this.clusters.isEmpty ()) {
return null;
}return ( new Integer (this.clusters.get (0).clusterID)).toString ();
});
Clazz.defineMethod (c$, "getClusters", 
function () {
return this.clusters;
});
Clazz.defineMethod (c$, "getEdgeListToNode", 
function (to) {
var edgeList =  new java.util.ArrayList ();
var edge;
for (var obj, $obj = this.edges.iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
edge = obj;
if (edge.target === to) {
edgeList.add (edge);
}}
return edgeList;
}, "org.ivis.layout.LNode");
Clazz.defineMethod (c$, "getEdgesBetween", 
function (other) {
var edgeList =  new java.util.ArrayList ();
var edge;
for (var obj, $obj = this.edges.iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
edge = obj;
if ((edge.target === other) || (edge.source === other)) {
edgeList.add (edge);
}}
return edgeList;
}, "org.ivis.layout.LNode");
Clazz.defineMethod (c$, "isNeighbor", 
function (node) {
var edge;
for (var obj, $obj = this.edges.iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
edge = obj;
if (edge.source === node || edge.target === node) {
return true;
}}
return false;
}, "org.ivis.layout.LNode");
Clazz.defineMethod (c$, "getNeighborsList", 
function () {
var neighbors =  new java.util.HashSet ();
var edge;
for (var obj, $obj = this.edges.iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
edge = obj;
if (edge.source.equals (this)) {
neighbors.add (edge.target);
} else {
neighbors.add (edge.source);
}}
return neighbors;
});
Clazz.defineMethod (c$, "getSuccessors", 
function () {
var neighbors =  new java.util.HashSet ();
var edge;
for (var obj, $obj = this.edges.iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
edge = obj;
if (edge.source.equals (this)) {
neighbors.add (edge.target);
}}
return neighbors;
});
Clazz.defineMethod (c$, "withChildren", 
function () {
var withNeighborsList =  new java.util.LinkedList ();
var childNode;
withNeighborsList.add (this);
if (this.child != null) {
for (var childObject, $childObject = this.child.getNodes ().iterator (); $childObject.hasNext () && ((childObject = $childObject.next ()) || true);) {
childNode = childObject;
withNeighborsList.addAll (childNode.withChildren ());
}
}return withNeighborsList;
});
Clazz.defineMethod (c$, "getEstimatedSize", 
function () {
return this.estimatedSize;
});
Clazz.defineMethod (c$, "calcEstimatedSize", 
function () {
if (this.child == null) {
return this.estimatedSize = Math.round (((this.rect.width + this.rect.height) / 2));
} else {
this.estimatedSize = this.child.calcEstimatedSize ();
this.rect.width = this.estimatedSize;
this.rect.height = this.estimatedSize;
return this.estimatedSize;
}});
Clazz.defineMethod (c$, "scatter", 
function () {
var randomCenterX;
var randomCenterY;
var minX = -1000;
var maxX = 1000;
randomCenterX = 1200 + (org.ivis.layout.LNode.random.nextDouble () * (maxX - minX)) + minX;
var minY = -1000;
var maxY = 1000;
randomCenterY = 900 + (org.ivis.layout.LNode.random.nextDouble () * (maxY - minY)) + minY;
this.rect.x = randomCenterX;
this.rect.y = randomCenterY;
});
Clazz.defineMethod (c$, "updateBounds", 
function () {
if (this.getChild ().getNodes ().size () != 0) {
var childGraph = this.getChild ();
childGraph.updateBounds (true);
this.rect.x = childGraph.getLeft ();
this.rect.y = childGraph.getTop ();
this.setWidth (childGraph.getRight () - childGraph.getLeft () + 10);
this.setHeight (childGraph.getBottom () - childGraph.getTop () + 10 + 20);
}});
Clazz.defineMethod (c$, "getInclusionTreeDepth", 
function () {
return this.inclusionTreeDepth;
});
Clazz.defineMethod (c$, "getAllParents", 
function () {
var parents =  new java.util.Vector ();
var rootNode = this.owner.getGraphManager ().getRoot ().getParent ();
var parent = this.owner.getParent ();
while (true) {
if (parent !== rootNode) {
parents.add (parent);
} else {
break;
}parent = parent.getOwner ().getParent ();
}
parents.add (rootNode);
return parents;
});
Clazz.defineMethod (c$, "transform", 
function (trans) {
var left = this.rect.x;
if (left > 1000000) {
left = 1000000;
} else if (left < -1000000) {
left = -1000000;
}var top = this.rect.y;
if (top > 1000000) {
top = 1000000;
} else if (top < -1000000) {
top = -1000000;
}var leftTop =  new org.ivis.util.PointD (left, top);
var vLeftTop = trans.inverseTransformPoint (leftTop);
this.setLocation (vLeftTop.x, vLeftTop.y);
}, "org.ivis.util.Transform");
Clazz.defineMethod (c$, "addCluster", 
function (clusterID) {
var cm = this.graphManager.getClusterManager ();
var cluster = cm.getClusterByID (clusterID);
if (cluster == null) {
cluster =  new org.ivis.layout.Cluster (cm, clusterID, "Cluster " + clusterID);
cm.addCluster (cluster);
}this.addCluster (cluster);
}, "~N");
Clazz.defineMethod (c$, "addCluster", 
function (cluster) {
if (cluster == null) {
return ;
}if (!this.clusters.contains (cluster)) {
this.clusters.add (cluster);
cluster.getNodes ().add (this);
if (this.child != null) {
var childrenNodes = this.child.getNodes ();
var itr = childrenNodes.iterator ();
while (itr.hasNext ()) {
var childNode = itr.next ();
childNode.addCluster (cluster);
}
}}}, "org.ivis.layout.Cluster");
Clazz.overrideMethod (c$, "removeCluster", 
function (cluster) {
if (cluster == null) {
return ;
}if (this.clusters.contains (cluster)) {
this.clusters.remove (cluster);
cluster.getNodes ().remove (this);
if (this.child != null) {
var childrenNodes = this.child.getNodes ();
var itr = childrenNodes.iterator ();
while (itr.hasNext ()) {
var childNode = itr.next ();
childNode.removeCluster (cluster);
}
}}}, "org.ivis.layout.Cluster");
Clazz.overrideMethod (c$, "resetClusters", 
function () {
for (var cluster, $cluster = this.clusters.iterator (); $cluster.hasNext () && ((cluster = $cluster.next ()) || true);) {
cluster.getNodes ().remove (this);
}
this.clusters.clear ();
});
Clazz.overrideMethod (c$, "getParent", 
function () {
if (this.owner == null) {
return null;
}return this.owner.getParent ();
});
Clazz.defineMethod (c$, "belongsToCluster", 
function (cluster) {
if (this.clusters.contains (cluster)) {
return true;
} else {
return false;
}}, "org.ivis.layout.Cluster");
Clazz.defineMethod (c$, "printTopology", 
function () {
System.out.print (this.label == null ? "?" : this.label + "{");
var edge;
var otherEnd;
for (var obj, $obj = this.edges.iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
edge = obj;
otherEnd = edge.getOtherEnd (this);
System.out.print (otherEnd.label == null ? "?" : otherEnd.label + ",");
}
System.out.print ("} ");
});
c$.random = c$.prototype.random =  new java.util.Random (1);
});
