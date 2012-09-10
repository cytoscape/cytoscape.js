Clazz.declarePackage ("org.ivis.layout");
Clazz.load (["org.ivis.layout.LGraphObject", "$.LayoutConstants"], "org.ivis.layout.LGraph", ["java.util.ArrayList", "$.HashSet", "$.LinkedList", "newawt.Point", "$.Rectangle"], function () {
c$ = Clazz.decorateAsClass (function () {
this.nodes = null;
this.edges = null;
this.graphManager = null;
this.parent = null;
this.top = 0;
this.left = 0;
this.bottom = 0;
this.right = 0;
this.estimatedSize = -2147483648;
this.margin = 0;
this.$isConnected = false;
Clazz.instantialize (this, arguments);
}, org.ivis.layout, "LGraph", org.ivis.layout.LGraphObject);
Clazz.prepareFields (c$, function () {
this.margin = org.ivis.layout.LayoutConstants.DEFAULT_GRAPH_MARGIN;
});
Clazz.makeConstructor (c$, 
function (parent, graphMgr, vGraph) {
Clazz.superConstructor (this, org.ivis.layout.LGraph, [vGraph]);
this.initialize ();
this.parent = parent;
this.graphManager = graphMgr;
}, "org.ivis.layout.LNode,org.ivis.layout.LGraphManager,~O");
Clazz.makeConstructor (c$, 
function (parent, layout, vGraph) {
Clazz.superConstructor (this, org.ivis.layout.LGraph, [vGraph]);
this.initialize ();
this.parent = parent;
this.graphManager = layout.graphManager;
}, "org.ivis.layout.LNode,org.ivis.layout.Layout,~O");
Clazz.defineMethod (c$, "initialize", 
($fz = function () {
this.edges =  new java.util.ArrayList ();
this.nodes =  new java.util.ArrayList ();
this.$isConnected = false;
}, $fz.isPrivate = true, $fz));
Clazz.defineMethod (c$, "getNodes", 
function () {
return this.nodes;
});
Clazz.defineMethod (c$, "getEdges", 
function () {
return this.edges;
});
Clazz.defineMethod (c$, "getGraphManager", 
function () {
return this.graphManager;
});
Clazz.defineMethod (c$, "getParent", 
function () {
return this.parent;
});
Clazz.defineMethod (c$, "getLeft", 
function () {
return this.left;
});
Clazz.defineMethod (c$, "getRight", 
function () {
return this.right;
});
Clazz.defineMethod (c$, "getTop", 
function () {
return this.top;
});
Clazz.defineMethod (c$, "getBottom", 
function () {
return this.bottom;
});
Clazz.defineMethod (c$, "getBiggerDimension", 
function () {
return Math.max (this.right - this.left, this.bottom - this.top);
});
Clazz.defineMethod (c$, "isConnected", 
function () {
return this.$isConnected;
});
Clazz.defineMethod (c$, "getMargin", 
function () {
return this.margin;
});
Clazz.defineMethod (c$, "setMargin", 
function (margin) {
this.margin = margin;
}, "~N");
Clazz.defineMethod (c$, "add", 
function (newNode) {
newNode.setOwner (this);
this.getNodes ().add (newNode);
return newNode;
}, "org.ivis.layout.LNode");
Clazz.defineMethod (c$, "add", 
function (newEdge, sourceNode, targetNode) {
if (sourceNode.owner !== targetNode.owner) {
return null;
}newEdge.source = sourceNode;
newEdge.target = targetNode;
newEdge.$isInterGraph = false;
this.getEdges ().add (newEdge);
sourceNode.edges.add (newEdge);
if (targetNode !== sourceNode) {
targetNode.edges.add (newEdge);
}return newEdge;
}, "org.ivis.layout.LEdge,org.ivis.layout.LNode,org.ivis.layout.LNode");
Clazz.defineMethod (c$, "remove", 
function (node) {
var edgesToBeRemoved =  new java.util.ArrayList ();
edgesToBeRemoved.addAll (node.edges);
var edge;
for (var obj, $obj = edgesToBeRemoved.iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
edge = obj;
if (edge.$isInterGraph) {
this.graphManager.remove (edge);
} else {
edge.source.owner.remove (edge);
}}
this.nodes.remove (node);
}, "org.ivis.layout.LNode");
Clazz.defineMethod (c$, "remove", 
function (edge) {
edge.source.edges.remove (edge);
if (edge.target !== edge.source) {
edge.target.edges.remove (edge);
}edge.source.owner.getEdges ().remove (edge);
}, "org.ivis.layout.LEdge");
Clazz.defineMethod (c$, "updateLeftTop", 
function () {
var top = 2147483647;
var left = 2147483647;
var nodeTop;
var nodeLeft;
var itr = this.getNodes ().iterator ();
while (itr.hasNext ()) {
var lNode = itr.next ();
nodeTop = Math.round ((lNode.getTop ()));
nodeLeft = Math.round ((lNode.getLeft ()));
if (top > nodeTop) {
top = nodeTop;
}if (left > nodeLeft) {
left = nodeLeft;
}}
if (top == 2147483647) {
return null;
}this.left = left - this.margin;
this.top = top - this.margin;
return  new newawt.Point (this.left, this.top);
});
Clazz.defineMethod (c$, "updateBounds", 
function (recursive) {
var left = 2147483647;
var right = -2147483647;
var top = 2147483647;
var bottom = -2147483647;
var nodeLeft;
var nodeRight;
var nodeTop;
var nodeBottom;
var itr = this.nodes.iterator ();
while (itr.hasNext ()) {
var lNode = itr.next ();
if (recursive && lNode.child != null) {
lNode.updateBounds ();
}nodeLeft = Math.round ((lNode.getLeft ()));
nodeRight = Math.round ((lNode.getRight ()));
nodeTop = Math.round ((lNode.getTop ()));
nodeBottom = Math.round ((lNode.getBottom ()));
if (left > nodeLeft) {
left = nodeLeft;
}if (right < nodeRight) {
right = nodeRight;
}if (top > nodeTop) {
top = nodeTop;
}if (bottom < nodeBottom) {
bottom = nodeBottom;
}}
var boundingRect =  new newawt.Rectangle (left, top, right - left, bottom - top);
if (left == 2147483647) {
this.left = Math.round ((this.parent.getLeft ()));
this.right = Math.round ((this.parent.getRight ()));
this.top = Math.round ((this.parent.getTop ()));
this.bottom = Math.round ((this.parent.getBottom ()));
}this.left = boundingRect.x - this.margin;
this.right = boundingRect.x + boundingRect.width + this.margin;
this.top = boundingRect.y - this.margin;
this.bottom = boundingRect.y + boundingRect.height + this.margin;
}, "~B");
c$.calculateBounds = Clazz.defineMethod (c$, "calculateBounds", 
function (nodes) {
var left = 2147483647;
var right = -2147483647;
var top = 2147483647;
var bottom = -2147483647;
var nodeLeft;
var nodeRight;
var nodeTop;
var nodeBottom;
var itr = nodes.iterator ();
while (itr.hasNext ()) {
var lNode = itr.next ();
nodeLeft = Math.round ((lNode.getLeft ()));
nodeRight = Math.round ((lNode.getRight ()));
nodeTop = Math.round ((lNode.getTop ()));
nodeBottom = Math.round ((lNode.getBottom ()));
if (left > nodeLeft) {
left = nodeLeft;
}if (right < nodeRight) {
right = nodeRight;
}if (top > nodeTop) {
top = nodeTop;
}if (bottom < nodeBottom) {
bottom = nodeBottom;
}}
var boundingRect =  new newawt.Rectangle (left, top, right - left, bottom - top);
return boundingRect;
}, "java.util.List");
Clazz.defineMethod (c$, "getInclusionTreeDepth", 
function () {
if (this === this.graphManager.getRoot ()) {
return 1;
} else {
return this.parent.getInclusionTreeDepth ();
}});
Clazz.defineMethod (c$, "getEstimatedSize", 
function () {
return this.estimatedSize;
});
Clazz.defineMethod (c$, "setEstimatedSize", 
function (size) {
this.estimatedSize = size;
}, "~N");
Clazz.defineMethod (c$, "calcEstimatedSize", 
function () {
var size = 0;
var itr = this.nodes.iterator ();
while (itr.hasNext ()) {
var lNode = itr.next ();
size += lNode.calcEstimatedSize ();
}
if (size == 0) {
this.estimatedSize = 40;
} else {
this.estimatedSize = Math.round ((size / Math.sqrt (this.nodes.size ())));
}return this.estimatedSize;
});
Clazz.defineMethod (c$, "updateConnected", 
function () {
if (this.nodes.size () == 0) {
this.$isConnected = true;
return ;
}var toBeVisited =  new java.util.LinkedList ();
var visited =  new java.util.HashSet ();
var currentNode = this.nodes.get (0);
var neighborEdges;
var currentNeighbor;
toBeVisited.addAll (currentNode.withChildren ());
while (!toBeVisited.isEmpty ()) {
currentNode = toBeVisited.removeFirst ();
visited.add (currentNode);
neighborEdges = currentNode.getEdges ();
for (var neighborEdge, $neighborEdge = neighborEdges.iterator (); $neighborEdge.hasNext () && ((neighborEdge = $neighborEdge.next ()) || true);) {
currentNeighbor = neighborEdge.getOtherEndInGraph (currentNode, this);
if (currentNeighbor != null && !visited.contains (currentNeighbor)) {
toBeVisited.addAll (currentNeighbor.withChildren ());
}}
}
this.$isConnected = false;
if (visited.size () >= this.nodes.size ()) {
var noOfVisitedInThisGraph = 0;
for (var visitedNode, $visitedNode = visited.iterator (); $visitedNode.hasNext () && ((visitedNode = $visitedNode.next ()) || true);) {
if (visitedNode.owner === this) {
noOfVisitedInThisGraph++;
}}
if (noOfVisitedInThisGraph == this.nodes.size ()) {
this.$isConnected = true;
}}});
Clazz.defineMethod (c$, "reverse", 
function (edge) {
edge.source.getOwner ().getEdges ().remove (edge);
edge.target.getOwner ().getEdges ().add (edge);
var swap = edge.source;
edge.source = edge.target;
edge.target = swap;
}, "org.ivis.layout.LEdge");
Clazz.defineMethod (c$, "printTopology", 
function () {
System.out.print ((this.label == null ? "?" : this.label) + ": ");
System.out.print ("Nodes: ");
var node;
for (var obj, $obj = this.nodes.iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
node = obj;
node.printTopology ();
}
System.out.print ("Edges: ");
var edge;
for (var obj, $obj = this.edges.iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
edge = obj;
edge.printTopology ();
}
System.out.println ();
});
});
