Clazz.declarePackage ("org.ivis.layout");
Clazz.load (null, "org.ivis.layout.LGraphManager", ["java.util.ArrayList", "$.LinkedList", "org.ivis.layout.ClusterManager"], function () {
c$ = Clazz.decorateAsClass (function () {
this.graphs = null;
this.edges = null;
this.allNodes = null;
this.allEdges = null;
this.allNodesToApplyGravitation = null;
this.rootGraph = null;
this.layout = null;
this.clusterManager = null;
Clazz.instantialize (this, arguments);
}, org.ivis.layout, "LGraphManager");
Clazz.makeConstructor (c$, 
function () {
this.layout = null;
this.init ();
});
Clazz.makeConstructor (c$, 
function (layout) {
this.layout = layout;
this.init ();
}, "org.ivis.layout.Layout");
Clazz.defineMethod (c$, "init", 
($fz = function () {
this.graphs =  new java.util.ArrayList ();
this.edges =  new java.util.ArrayList ();
this.allNodes = null;
this.allEdges = null;
this.allNodesToApplyGravitation = null;
this.rootGraph = null;
this.clusterManager =  new org.ivis.layout.ClusterManager ();
}, $fz.isPrivate = true, $fz));
Clazz.defineMethod (c$, "addRoot", 
function () {
this.setRootGraph (this.add (this.layout.newGraph (null), this.layout.newNode (null)));
return this.rootGraph;
});
Clazz.defineMethod (c$, "add", 
function (newGraph, parentNode) {
this.graphs.add (newGraph);
newGraph.parent = parentNode;
parentNode.child = newGraph;
return newGraph;
}, "org.ivis.layout.LGraph,org.ivis.layout.LNode");
Clazz.defineMethod (c$, "add", 
function (newEdge, sourceNode, targetNode) {
var sourceGraph = sourceNode.getOwner ();
var targetGraph = targetNode.getOwner ();
if (sourceGraph === targetGraph) {
newEdge.$isInterGraph = false;
return sourceGraph.add (newEdge, sourceNode, targetNode);
} else {
newEdge.$isInterGraph = true;
newEdge.source = sourceNode;
newEdge.target = targetNode;
this.edges.add (newEdge);
newEdge.source.edges.add (newEdge);
newEdge.target.edges.add (newEdge);
return newEdge;
}}, "org.ivis.layout.LEdge,org.ivis.layout.LNode,org.ivis.layout.LNode");
Clazz.defineMethod (c$, "remove", 
function (graph) {
var edgesToBeRemoved =  new java.util.ArrayList ();
edgesToBeRemoved.addAll (graph.getEdges ());
var edge;
for (var obj, $obj = edgesToBeRemoved.iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
edge = obj;
graph.remove (edge);
}
var nodesToBeRemoved =  new java.util.ArrayList ();
nodesToBeRemoved.addAll (graph.getNodes ());
var node;
for (var obj, $obj = nodesToBeRemoved.iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
node = obj;
graph.remove (node);
}
if (graph === this.rootGraph) {
this.setRootGraph (null);
}this.graphs.remove (graph);
graph.parent = null;
}, "org.ivis.layout.LGraph");
Clazz.defineMethod (c$, "remove", 
function (edge) {
edge.source.edges.remove (edge);
edge.target.edges.remove (edge);
edge.source.owner.getGraphManager ().edges.remove (edge);
}, "org.ivis.layout.LEdge");
Clazz.defineMethod (c$, "updateBounds", 
function () {
this.rootGraph.updateBounds (true);
});
Clazz.defineMethod (c$, "getClusterManager", 
function () {
return this.clusterManager;
});
Clazz.defineMethod (c$, "getGraphs", 
function () {
return this.graphs;
});
Clazz.defineMethod (c$, "getInterGraphEdges", 
function () {
return this.edges;
});
Clazz.defineMethod (c$, "getAllNodes", 
function () {
if (this.allNodes == null) {
var nodeList =  new java.util.LinkedList ();
for (var iterator = this.getGraphs ().iterator (); iterator.hasNext (); ) {
nodeList.addAll ((iterator.next ()).getNodes ());
}
this.allNodes = nodeList.toArray ();
}return this.allNodes;
});
Clazz.defineMethod (c$, "resetAllNodes", 
function () {
this.allNodes = null;
});
Clazz.defineMethod (c$, "resetAllEdges", 
function () {
this.allEdges = null;
});
Clazz.defineMethod (c$, "resetAllNodesToApplyGravitation", 
function () {
this.allNodesToApplyGravitation = null;
});
Clazz.defineMethod (c$, "getAllEdges", 
function () {
if (this.allEdges == null) {
var edgeList =  new java.util.LinkedList ();
for (var iterator = this.getGraphs ().iterator (); iterator.hasNext (); ) {
edgeList.addAll ((iterator.next ()).getEdges ());
}
edgeList.addAll (this.edges);
this.allEdges = edgeList.toArray ();
}return this.allEdges;
});
Clazz.defineMethod (c$, "getAllNodesToApplyGravitation", 
function () {
return this.allNodesToApplyGravitation;
});
Clazz.defineMethod (c$, "setAllNodesToApplyGravitation", 
function (nodeList) {
this.allNodesToApplyGravitation = nodeList.toArray ();
}, "java.util.List");
Clazz.defineMethod (c$, "setAllNodesToApplyGravitation", 
function (nodes) {
this.allNodesToApplyGravitation = nodes;
}, "~A");
Clazz.defineMethod (c$, "getRoot", 
function () {
return this.rootGraph;
});
Clazz.defineMethod (c$, "setRootGraph", 
function (graph) {
this.rootGraph = graph;
if (graph.parent == null) {
graph.parent = this.layout.newNode ("Root node");
}}, "org.ivis.layout.LGraph");
Clazz.defineMethod (c$, "getLayout", 
function () {
return this.layout;
});
Clazz.defineMethod (c$, "setLayout", 
function (layout) {
this.layout = layout;
}, "org.ivis.layout.Layout");
c$.isOneAncestorOfOther = Clazz.defineMethod (c$, "isOneAncestorOfOther", 
function (firstNode, secondNode) {
if (firstNode === secondNode) {
return true;
}var ownerGraph = firstNode.getOwner ();
var parentNode;
do {
parentNode = ownerGraph.getParent ();
if (parentNode == null) {
break;
}if (parentNode === secondNode) {
return true;
}ownerGraph = parentNode.getOwner ();
if (ownerGraph == null) {
break;
}} while (true);
ownerGraph = secondNode.getOwner ();
do {
parentNode = ownerGraph.getParent ();
if (parentNode == null) {
break;
}if (parentNode === firstNode) {
return true;
}ownerGraph = parentNode.getOwner ();
if (ownerGraph == null) {
break;
}} while (true);
return false;
}, "org.ivis.layout.LNode,org.ivis.layout.LNode");
Clazz.defineMethod (c$, "calcLowestCommonAncestors", 
function () {
var edge;
var sourceNode;
var targetNode;
var sourceAncestorGraph;
var targetAncestorGraph;
for (var obj, $obj = 0, $$obj = this.getAllEdges (); $obj < $$obj.length && ((obj = $$obj[$obj]) || true); $obj++) {
edge = obj;
sourceNode = edge.source;
targetNode = edge.target;
edge.lca = null;
edge.sourceInLca = sourceNode;
edge.targetInLca = targetNode;
if (sourceNode === targetNode) {
edge.lca = sourceNode.getOwner ();
continue ;}sourceAncestorGraph = sourceNode.getOwner ();
while (edge.lca == null) {
targetAncestorGraph = targetNode.getOwner ();
while (edge.lca == null) {
if (targetAncestorGraph === sourceAncestorGraph) {
edge.lca = targetAncestorGraph;
break;
}if (targetAncestorGraph === this.rootGraph) {
break;
}edge.targetInLca = targetAncestorGraph.getParent ();
targetAncestorGraph = edge.targetInLca.getOwner ();
}
if (sourceAncestorGraph === this.rootGraph) {
break;
}if (edge.lca == null) {
edge.sourceInLca = sourceAncestorGraph.getParent ();
sourceAncestorGraph = edge.sourceInLca.getOwner ();
}}
}
});
Clazz.defineMethod (c$, "calcLowestCommonAncestor", 
function (firstNode, secondNode) {
if (firstNode === secondNode) {
return firstNode.getOwner ();
}var firstOwnerGraph = firstNode.getOwner ();
do {
if (firstOwnerGraph == null) {
break;
}var secondOwnerGraph = secondNode.getOwner ();
do {
if (secondOwnerGraph == null) {
break;
}if (secondOwnerGraph === firstOwnerGraph) {
return secondOwnerGraph;
}secondOwnerGraph = secondOwnerGraph.getParent ().getOwner ();
} while (true);
firstOwnerGraph = firstOwnerGraph.getParent ().getOwner ();
} while (true);
return firstOwnerGraph;
}, "org.ivis.layout.LNode,org.ivis.layout.LNode");
Clazz.defineMethod (c$, "calcInclusionTreeDepths", 
function () {
this.calcInclusionTreeDepths (this.rootGraph, 1);
});
Clazz.defineMethod (c$, "calcInclusionTreeDepths", 
($fz = function (graph, depth) {
var node;
for (var obj, $obj = graph.getNodes ().iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
node = obj;
node.inclusionTreeDepth = depth;
if (node.child != null) {
this.calcInclusionTreeDepths (node.child, depth + 1);
}}
}, $fz.isPrivate = true, $fz), "org.ivis.layout.LGraph,~N");
Clazz.defineMethod (c$, "includesInvalidEdge", 
function () {
var edge;
for (var obj, $obj = this.edges.iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
edge = obj;
if (org.ivis.layout.LGraphManager.isOneAncestorOfOther (edge.source, edge.target)) {
return true;
}}
return false;
});
Clazz.defineMethod (c$, "printTopology", 
function () {
this.rootGraph.printTopology ();
var graph;
for (var obj, $obj = this.graphs.iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
graph = obj;
if (graph !== this.rootGraph) {
graph.printTopology ();
}}
System.out.print ("Inter-graph edges:");
var edge;
for (var obj, $obj = this.edges.iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
edge = obj;
edge.printTopology ();
}
System.out.println ();
System.out.println ();
});
});
