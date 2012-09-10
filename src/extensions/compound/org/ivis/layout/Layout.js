Clazz.declarePackage ("org.ivis.layout");
Clazz.load (["java.util.HashMap"], "org.ivis.layout.Layout", ["java.util.ArrayList", "$.Arrays", "$.HashSet", "$.LinkedList", "newawt.Dimension", "$.Point", "org.ivis.layout.LEdge", "$.LGraph", "$.LGraphManager", "$.LNode", "$.LayoutOptionsPack", "org.ivis.util.PointD", "$.Transform"], function () {
c$ = Clazz.decorateAsClass (function () {
this.layoutQuality = 1;
this.createBendsAsNeeded = false;
this.incremental = false;
this.animationOnLayout = true;
this.animationDuringLayout = false;
this.animationPeriod = 50;
this.uniformLeafNodeSizes = false;
this.graphManager = null;
this.isLayoutFinished = false;
this.isSubLayout = false;
this.edgeToDummyNodes = null;
this.isRemoteUse = false;
Clazz.instantialize (this, arguments);
}, org.ivis.layout, "Layout");
Clazz.prepareFields (c$, function () {
this.edgeToDummyNodes =  new java.util.HashMap ();
});
Clazz.makeConstructor (c$, 
function () {
this.graphManager = this.newGraphManager ();
this.isLayoutFinished = false;
this.isSubLayout = false;
this.isRemoteUse = false;
});
Clazz.makeConstructor (c$, 
function (isRemoteUse) {
this.construct ();
this.isRemoteUse = isRemoteUse;
}, "~B");
Clazz.defineMethod (c$, "getGraphManager", 
function () {
return this.graphManager;
});
Clazz.defineMethod (c$, "getAllNodes", 
function () {
return this.graphManager.getAllNodes ();
});
Clazz.defineMethod (c$, "getAllEdges", 
function () {
return this.graphManager.getAllEdges ();
});
Clazz.defineMethod (c$, "getAllNodesToApplyGravitation", 
function () {
return this.graphManager.getAllNodesToApplyGravitation ();
});
Clazz.defineMethod (c$, "newGraphManager", 
function () {
var gm =  new org.ivis.layout.LGraphManager (this);
this.graphManager = gm;
return gm;
});
Clazz.defineMethod (c$, "newGraph", 
function (vGraph) {
return  new org.ivis.layout.LGraph (null, this.graphManager, vGraph);
}, "~O");
Clazz.defineMethod (c$, "newNode", 
function (vNode) {
return  new org.ivis.layout.LNode (this.graphManager, vNode);
}, "~O");
Clazz.defineMethod (c$, "newEdge", 
function (vEdge) {
return  new org.ivis.layout.LEdge (null, null, vEdge);
}, "~O");
Clazz.defineMethod (c$, "runLayout", 
function () {
this.isLayoutFinished = false;
if (!this.isSubLayout) {
this.doPreLayout ();
}this.initParameters ();
var isLayoutSuccessfull;
if ((this.graphManager.getRoot () == null) || this.graphManager.getRoot ().getNodes ().size () == 0 || this.graphManager.includesInvalidEdge ()) {
isLayoutSuccessfull = false;
} else {
var startTime = 0;
if (!this.isSubLayout) {
startTime = System.currentTimeMillis ();
}isLayoutSuccessfull = this.layout ();
if (!this.isSubLayout) {
var endTime = System.currentTimeMillis ();
var excTime = endTime - startTime;
System.out.println ("Total execution time: " + excTime + " miliseconds.");
}}if (isLayoutSuccessfull) {
if (!this.isSubLayout) {
this.doPostLayout ();
}}this.isLayoutFinished = true;
return isLayoutSuccessfull;
});
Clazz.defineMethod (c$, "doPreLayout", 
function () {
});
Clazz.defineMethod (c$, "doPostLayout", 
function () {
this.transform ();
this.update ();
});
Clazz.defineMethod (c$, "update", 
function () {
if (this.createBendsAsNeeded) {
this.createBendpointsFromDummyNodes ();
this.graphManager.resetAllEdges ();
}if (!this.isRemoteUse) {
var edge;
for (var obj, $obj = 0, $$obj = this.graphManager.getAllEdges (); $obj < $$obj.length && ((obj = $$obj[$obj]) || true); $obj++) {
edge = obj;
this.update (edge);
}
var node;
for (var obj, $obj = this.graphManager.getRoot ().getNodes ().iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
node = obj;
this.update (node);
}
this.update (this.graphManager.getRoot ());
}});
Clazz.defineMethod (c$, "update", 
function (node) {
if (node.getChild () != null) {
for (var obj, $obj = node.getChild ().getNodes ().iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
this.update (obj);
}
}if (node.vGraphObject != null) {
var vNode = node.vGraphObject;
vNode.update (node);
}}, "org.ivis.layout.LNode");
Clazz.defineMethod (c$, "update", 
function (edge) {
if (edge.vGraphObject != null) {
var vEdge = edge.vGraphObject;
vEdge.update (edge);
}}, "org.ivis.layout.LEdge");
Clazz.defineMethod (c$, "update", 
function (graph) {
if (graph.vGraphObject != null) {
var vGraph = graph.vGraphObject;
vGraph.update (graph);
}}, "org.ivis.layout.LGraph");
Clazz.defineMethod (c$, "initParameters", 
function () {
if (!this.isSubLayout) {
var layoutOptionsPack = org.ivis.layout.LayoutOptionsPack.getInstance ().getGeneral ();
this.layoutQuality = layoutOptionsPack.getLayoutQuality ();
this.animationDuringLayout = layoutOptionsPack.isAnimationDuringLayout ();
this.animationPeriod = Math.round (org.ivis.layout.Layout.transform (layoutOptionsPack.getAnimationPeriod (), 50));
this.animationOnLayout = layoutOptionsPack.isAnimationOnLayout ();
this.incremental = layoutOptionsPack.isIncremental ();
this.createBendsAsNeeded = layoutOptionsPack.isCreateBendsAsNeeded ();
this.uniformLeafNodeSizes = layoutOptionsPack.isUniformLeafNodeSizes ();
}if (this.animationDuringLayout) {
this.animationOnLayout = false;
}});
Clazz.defineMethod (c$, "transform", 
function () {
this.transform ( new org.ivis.util.PointD (0, 0));
});
Clazz.defineMethod (c$, "transform", 
function (newLeftTop) {
var trans =  new org.ivis.util.Transform ();
var leftTop = this.graphManager.getRoot ().updateLeftTop ();
if (leftTop != null) {
trans.setWorldOrgX (newLeftTop.x);
trans.setWorldOrgY (newLeftTop.y);
trans.setDeviceOrgX (leftTop.x);
trans.setDeviceOrgY (leftTop.y);
var nodes = this.getAllNodes ();
var node;
for (var i = 0; i < nodes.length; i++) {
node = nodes[i];
node.transform (trans);
}
}}, "org.ivis.util.PointD");
Clazz.defineMethod (c$, "positionNodesRandomly", 
function () {
this.positionNodesRandomly (this.getGraphManager ().getRoot ());
this.getGraphManager ().getRoot ().updateBounds (true);
});
Clazz.defineMethod (c$, "positionNodesRandomly", 
($fz = function (graph) {
var lNode;
var childGraph;
for (var obj, $obj = graph.getNodes ().iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
lNode = obj;
childGraph = lNode.getChild ();
if (childGraph == null) {
lNode.scatter ();
} else if (childGraph.getNodes ().size () == 0) {
lNode.scatter ();
} else {
this.positionNodesRandomly (childGraph);
lNode.updateBounds ();
}}
}, $fz.isPrivate = true, $fz), "org.ivis.layout.LGraph");
Clazz.defineMethod (c$, "getFlatForest", 
function () {
var flatForest =  new java.util.ArrayList ();
var isForest = true;
var allNodes = this.graphManager.getRoot ().getNodes ();
var isFlat = true;
for (var i = 0; i < allNodes.size (); i++) {
if (allNodes.get (i).getChild () != null) {
isFlat = false;
}}
if (!isFlat) {
return flatForest;
}var visited =  new java.util.HashSet ();
var toBeVisited =  new java.util.LinkedList ();
var parents =  new java.util.HashMap ();
var unProcessedNodes =  new java.util.LinkedList ();
unProcessedNodes.addAll (allNodes);
while (unProcessedNodes.size () > 0 && isForest) {
toBeVisited.add (unProcessedNodes.getFirst ());
while (!toBeVisited.isEmpty () && isForest) {
var currentNode = toBeVisited.poll ();
visited.add (currentNode);
var neighborEdges = currentNode.getEdges ();
for (var i = 0; i < neighborEdges.size (); i++) {
var currentNeighbor = neighborEdges.get (i).getOtherEnd (currentNode);
if (parents.get (currentNode) !== currentNeighbor) {
if (!visited.contains (currentNeighbor)) {
toBeVisited.addLast (currentNeighbor);
parents.put (currentNeighbor, currentNode);
} else {
isForest = false;
break;
}}}
}
if (!isForest) {
flatForest.clear ();
} else {
flatForest.add ( new java.util.ArrayList (visited));
unProcessedNodes.removeAll (visited);
visited.clear ();
parents.clear ();
}}
return flatForest;
});
Clazz.defineMethod (c$, "createDummyNodesForBendpoints", 
function (edge) {
var dummyNodes =  new java.util.ArrayList ();
var prev = edge.source;
var graph = this.graphManager.calcLowestCommonAncestor (edge.source, edge.target);
for (var i = 0; i < edge.bendpoints.size (); i++) {
var dummyNode = this.newNode (null);
dummyNode.setRect ( new newawt.Point (0, 0),  new newawt.Dimension (1, 1));
graph.add (dummyNode);
var dummyEdge = this.newEdge (null);
this.graphManager.add (dummyEdge, prev, dummyNode);
dummyNodes.add (dummyNode);
prev = dummyNode;
}
var dummyEdge = this.newEdge (null);
this.graphManager.add (dummyEdge, prev, edge.target);
this.edgeToDummyNodes.put (edge, dummyNodes);
if (edge.isInterGraph ()) {
this.graphManager.remove (edge);
} else {
graph.remove (edge);
}return dummyNodes;
}, "org.ivis.layout.LEdge");
Clazz.defineMethod (c$, "createBendpointsFromDummyNodes", 
function () {
var edges =  new java.util.ArrayList ();
edges.addAll (java.util.Arrays.asList (this.graphManager.getAllEdges ()));
edges.addAll (0, this.edgeToDummyNodes.keySet ());
for (var k = 0; k < edges.size (); k++) {
var lEdge = edges.get (k);
if (lEdge.bendpoints.size () > 0) {
var path = this.edgeToDummyNodes.get (lEdge);
for (var i = 0; i < path.size (); i++) {
var dummyNode = (path.get (i));
var p =  new org.ivis.util.PointD (dummyNode.getCenterX (), dummyNode.getCenterY ());
var ebp = lEdge.bendpoints.get (i);
ebp.x = p.x;
ebp.y = p.y;
dummyNode.getOwner ().remove (dummyNode);
}
this.graphManager.add (lEdge, lEdge.source, lEdge.target);
}}
});
c$.transform = Clazz.defineMethod (c$, "transform", 
function (sliderValue, defaultValue) {
var a;
var b;
if (sliderValue <= 50) {
a = 9.0 * defaultValue / 500.0;
b = defaultValue / 10.0;
} else {
a = 9.0 * defaultValue / 50.0;
b = -8 * defaultValue;
}return (a * sliderValue + b);
}, "~N,~N");
c$.transform = Clazz.defineMethod (c$, "transform", 
function (sliderValue, defaultValue, minDiv, maxMul) {
var value = defaultValue;
if (sliderValue <= 50) {
var minValue = defaultValue / minDiv;
value -= ((defaultValue - minValue) / 50) * (50 - sliderValue);
} else {
var maxValue = defaultValue * maxMul;
value += ((maxValue - defaultValue) / 50) * (sliderValue - 50);
}return value;
}, "~N,~N,~N,~N");
c$.findCenterOfEachTree = Clazz.defineMethod (c$, "findCenterOfEachTree", 
function (listofLists) {
var centers =  new java.util.ArrayList ();
for (var i = 0; i < listofLists.size (); i++) {
var list = listofLists.get (i);
var center = org.ivis.layout.Layout.findCenterOfTree (list);
centers.add (i, center);
}
return centers;
}, "java.util.List");
c$.findCenterOfTree = Clazz.defineMethod (c$, "findCenterOfTree", 
function (nodes) {
var list =  new java.util.ArrayList ();
list.addAll (nodes);
var removedNodes =  new java.util.ArrayList ();
var remainingDegrees =  new java.util.HashMap ();
var foundCenter = false;
var centerNode = null;
if (list.size () == 1 || list.size () == 2) {
foundCenter = true;
centerNode = list.get (0);
}var iter = list.iterator ();
while (iter.hasNext ()) {
var node = iter.next ();
var degree =  new Integer (node.getNeighborsList ().size ());
remainingDegrees.put (node, degree);
if (degree.intValue () == 1) {
removedNodes.add (node);
}}
var tempList =  new java.util.ArrayList ();
tempList.addAll (removedNodes);
while (!foundCenter) {
var tempList2 =  new java.util.ArrayList ();
tempList2.addAll (tempList);
tempList.removeAll (tempList);
iter = tempList2.iterator ();
while (iter.hasNext ()) {
var node = iter.next ();
list.remove (node);
var neighbours = node.getNeighborsList ();
for (var neighbor, $neighbor = neighbours.iterator (); $neighbor.hasNext () && ((neighbor = $neighbor.next ()) || true);) {
if (!removedNodes.contains (neighbor)) {
var otherDegree = remainingDegrees.get (neighbor);
var newDegree =  new Integer (otherDegree.intValue () - 1);
if (newDegree.intValue () == 1) {
tempList.add (neighbor);
}remainingDegrees.put (neighbor, newDegree);
}}
}
removedNodes.addAll (tempList);
if (list.size () == 1 || list.size () == 2) {
foundCenter = true;
centerNode = list.get (0);
}}
return centerNode;
}, "java.util.List");
Clazz.defineMethod (c$, "setGraphManager", 
function (gm) {
this.graphManager = gm;
}, "org.ivis.layout.LGraphManager");
Clazz.defineStatics (c$,
"RANDOM_SEED", 1);
});
