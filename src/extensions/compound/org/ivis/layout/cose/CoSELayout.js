Clazz.declarePackage ("org.ivis.layout.cose");
Clazz.load (["org.ivis.layout.fd.FDLayout"], "org.ivis.layout.cose.CoSELayout", ["java.util.ArrayList", "$.Arrays", "$.HashSet", "$.LinkedList", "newawt.Point", "org.ivis.layout.LGraph", "$.Layout", "$.LayoutOptionsPack", "org.ivis.layout.cose.CoSEEdge", "$.CoSEGraph", "$.CoSEGraphManager", "$.CoSENode", "org.ivis.util.PointD", "$.Transform"], function () {
c$ = Clazz.decorateAsClass (function () {
this.useMultiLevelScaling = false;
this.level = 0;
this.noOfLevels = 0;
this.MList = null;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.cose, "CoSELayout", org.ivis.layout.fd.FDLayout);
Clazz.overrideMethod (c$, "newGraphManager", 
function () {
var gm =  new org.ivis.layout.cose.CoSEGraphManager (this);
this.graphManager = gm;
return gm;
});
Clazz.overrideMethod (c$, "newGraph", 
function (vGraph) {
return  new org.ivis.layout.cose.CoSEGraph (null, this.graphManager, vGraph);
}, "~O");
Clazz.overrideMethod (c$, "newNode", 
function (vNode) {
return  new org.ivis.layout.cose.CoSENode (this.graphManager, vNode);
}, "~O");
Clazz.overrideMethod (c$, "newEdge", 
function (vEdge) {
return  new org.ivis.layout.cose.CoSEEdge (null, null, vEdge);
}, "~O");
Clazz.defineMethod (c$, "initParameters", 
function () {
Clazz.superCall (this, org.ivis.layout.cose.CoSELayout, "initParameters", []);
if (!this.isSubLayout) {
var layoutOptionsPack = org.ivis.layout.LayoutOptionsPack.getInstance ().getCoSE ();
if (layoutOptionsPack.getIdealEdgeLength () < 10) {
this.idealEdgeLength = 10;
} else {
this.idealEdgeLength = layoutOptionsPack.getIdealEdgeLength ();
}this.useSmartIdealEdgeLengthCalculation = layoutOptionsPack.isSmartEdgeLengthCalc ();
this.useMultiLevelScaling = layoutOptionsPack.isMultiLevelScaling ();
this.springConstant = org.ivis.layout.Layout.transform (layoutOptionsPack.getSpringStrength (), 0.45, 5.0, 5.0);
this.repulsionConstant = org.ivis.layout.Layout.transform (layoutOptionsPack.getRepulsionStrength (), 4500.0, 5.0, 5.0);
this.gravityConstant = org.ivis.layout.Layout.transform (layoutOptionsPack.getGravityStrength (), 0.4);
this.compoundGravityConstant = org.ivis.layout.Layout.transform (layoutOptionsPack.getCompoundGravityStrength (), 1.0);
this.gravityRangeFactor = org.ivis.layout.Layout.transform (layoutOptionsPack.getGravityRange (), 2.0);
this.compoundGravityRangeFactor = org.ivis.layout.Layout.transform (layoutOptionsPack.getCompoundGravityRange (), 1.5);
}});
Clazz.overrideMethod (c$, "layout", 
function () {
var createBendsAsNeeded = org.ivis.layout.LayoutOptionsPack.getInstance ().getGeneral ().isCreateBendsAsNeeded ();
if (createBendsAsNeeded) {
this.createBendpoints ();
this.graphManager.resetAllEdges ();
}if (this.useMultiLevelScaling && !this.incremental) {
return this.multiLevelScalingLayout ();
} else {
this.level = 0;
return this.classicLayout ();
}});
Clazz.defineMethod (c$, "multiLevelScalingLayout", 
($fz = function () {
var gm = this.graphManager;
this.MList = gm.coarsenGraph ();
this.noOfLevels = this.MList.size () - 1;
this.level = this.noOfLevels;
while (this.level >= 0) {
this.graphManager = gm = this.MList.get (this.level);
this.classicLayout ();
this.incremental = true;
if (this.level >= 1) {
this.uncoarsen ();
}this.totalIterations = 0;
this.level--;
}
this.incremental = false;
return true;
}, $fz.isPrivate = true, $fz));
Clazz.defineMethod (c$, "classicLayout", 
($fz = function () {
this.calculateNodesToApplyGravitationTo ();
this.graphManager.calcLowestCommonAncestors ();
this.graphManager.calcInclusionTreeDepths ();
this.graphManager.getRoot ().calcEstimatedSize ();
this.calcIdealEdgeLengths ();
if (!this.incremental) {
var forest = this.getFlatForest ();
if (forest.size () > 0) {
this.positionNodesRadially (forest);
} else {
this.positionNodesRandomly ();
}}this.initSpringEmbedder ();
this.runSpringEmbedder ();
System.out.println ("Classic CoSE layout finished after " + this.totalIterations + " iterations");
return true;
}, $fz.isPrivate = true, $fz));
Clazz.defineMethod (c$, "runSpringEmbedder", 
function () {
do {
this.totalIterations++;
if (this.totalIterations % 100 == 0) {
if (this.isConverged ()) {
break;
}this.coolingFactor = this.initialCoolingFactor * ((this.maxIterations - this.totalIterations) / this.maxIterations);
}this.totalDisplacement = 0;
this.graphManager.updateBounds ();
this.calcSpringForces ();
this.calcRepulsionForces ();
this.calcGravitationalForces ();
this.moveNodes ();
this.animate ();
} while (this.totalIterations < this.maxIterations);
this.graphManager.updateBounds ();
});
Clazz.defineMethod (c$, "calculateNodesToApplyGravitationTo", 
function () {
var nodeList =  new java.util.LinkedList ();
var graph;
for (var obj, $obj = this.graphManager.getGraphs ().iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
graph = obj;
graph.updateConnected ();
if (!graph.isConnected ()) {
nodeList.addAll (graph.getNodes ());
}}
this.graphManager.setAllNodesToApplyGravitation (nodeList);
});
Clazz.defineMethod (c$, "createBendpoints", 
($fz = function () {
var edges =  new java.util.ArrayList ();
edges.addAll (java.util.Arrays.asList (this.graphManager.getAllEdges ()));
var visited =  new java.util.HashSet ();
for (var i = 0; i < edges.size (); i++) {
var edge = edges.get (i);
if (!visited.contains (edge)) {
var source = edge.getSource ();
var target = edge.getTarget ();
if (source === target) {
edge.getBendpoints ().add ( new org.ivis.util.PointD ());
edge.getBendpoints ().add ( new org.ivis.util.PointD ());
this.createDummyNodesForBendpoints (edge);
visited.add (edge);
} else {
var edgeList =  new java.util.ArrayList ();
edgeList.addAll (source.getEdgeListToNode (target));
edgeList.addAll (target.getEdgeListToNode (source));
if (!visited.contains (edgeList.get (0))) {
if (edgeList.size () > 1) {
for (var k = 0; k < edgeList.size (); k++) {
var multiEdge = edgeList.get (k);
multiEdge.getBendpoints ().add ( new org.ivis.util.PointD ());
this.createDummyNodesForBendpoints (multiEdge);
}
}visited.addAll (edgeList);
}}}if (visited.size () == edges.size ()) {
break;
}}
}, $fz.isPrivate = true, $fz));
Clazz.defineMethod (c$, "positionNodesRadially", 
function (forest) {
var currentStartingPoint =  new newawt.Point (0, 0);
var numberOfColumns = Math.round (Math.ceil (Math.sqrt (forest.size ())));
var height = 0;
var currentY = 0;
var currentX = 0;
var point =  new org.ivis.util.PointD (0, 0);
for (var i = 0; i < forest.size (); i++) {
if (i % numberOfColumns == 0) {
currentX = 0;
currentY = height;
if (i != 0) {
currentY += 60;
}height = 0;
}var tree = forest.get (i);
var centerNode = org.ivis.layout.Layout.findCenterOfTree (tree);
currentStartingPoint.x = currentX;
currentStartingPoint.y = currentY;
point = org.ivis.layout.cose.CoSELayout.radialLayout (tree, centerNode, currentStartingPoint);
if (point.y > height) {
height = Math.round (point.y);
}currentX = Math.round ((point.x + 60));
}
this.transform ( new org.ivis.util.PointD (1200 - point.x / 2, 900 - point.y / 2));
}, "java.util.ArrayList");
c$.radialLayout = Clazz.defineMethod (c$, "radialLayout", 
($fz = function (tree, centerNode, startingPoint) {
var radialSep = Math.max (org.ivis.layout.cose.CoSELayout.maxDiagonalInTree (tree), 50.0);
org.ivis.layout.cose.CoSELayout.branchRadialLayout (centerNode, null, 0, 359, 0, radialSep);
var bounds = org.ivis.layout.LGraph.calculateBounds (tree);
var transform =  new org.ivis.util.Transform ();
transform.setDeviceOrgX (bounds.getMinX ());
transform.setDeviceOrgY (bounds.getMinY ());
transform.setWorldOrgX (startingPoint.x);
transform.setWorldOrgY (startingPoint.y);
for (var i = 0; i < tree.size (); i++) {
var node = tree.get (i);
node.transform (transform);
}
var bottomRight =  new org.ivis.util.PointD (bounds.getMaxX (), bounds.getMaxY ());
return transform.inverseTransformPoint (bottomRight);
}, $fz.isPrivate = true, $fz), "java.util.ArrayList,org.ivis.layout.LNode,newawt.Point");
c$.branchRadialLayout = Clazz.defineMethod (c$, "branchRadialLayout", 
($fz = function (node, parentOfNode, startAngle, endAngle, distance, radialSeparation) {
var halfInterval = ((endAngle - startAngle) + 1) / 2;
if (halfInterval < 0) {
halfInterval += 180;
}var nodeAngle = (halfInterval + startAngle) % 360;
var teta = (nodeAngle * 6.283185307179586) / 360;
var x = distance * Math.cos (teta);
var y = distance * Math.sin (teta);
node.setCenter (x, y);
var neighborEdges =  new java.util.LinkedList (node.getEdges ());
var childCount = neighborEdges.size ();
if (parentOfNode != null) {
childCount--;
}var branchCount = 0;
var incEdgesCount = neighborEdges.size ();
var startIndex;
var edges = node.getEdgesBetween (parentOfNode);
while (edges.size () > 1) {
neighborEdges.remove (edges.remove (0));
incEdgesCount--;
childCount--;
}
if (parentOfNode != null) {
startIndex = (neighborEdges.indexOf (edges.get (0)) + 1) % incEdgesCount;
} else {
startIndex = 0;
}var stepAngle = Math.abs (endAngle - startAngle) / childCount;
for (var i = startIndex; branchCount != childCount; i = (++i) % incEdgesCount) {
var currentNeighbor = neighborEdges.get (i).getOtherEnd (node);
if (currentNeighbor === parentOfNode) {
continue ;}var childStartAngle = (startAngle + branchCount * stepAngle) % 360;
var childEndAngle = (childStartAngle + stepAngle) % 360;
org.ivis.layout.cose.CoSELayout.branchRadialLayout (currentNeighbor, node, childStartAngle, childEndAngle, distance + radialSeparation, radialSeparation);
branchCount++;
}
}, $fz.isPrivate = true, $fz), "org.ivis.layout.LNode,org.ivis.layout.LNode,~N,~N,~N,~N");
c$.maxDiagonalInTree = Clazz.defineMethod (c$, "maxDiagonalInTree", 
($fz = function (tree) {
var maxDiagonal = 4.9E-324;
for (var i = 0; i < tree.size (); i++) {
var node = tree.get (i);
var diagonal = node.getDiagonal ();
if (diagonal > maxDiagonal) {
maxDiagonal = diagonal;
}}
return maxDiagonal;
}, $fz.isPrivate = true, $fz), "java.util.ArrayList");
Clazz.defineMethod (c$, "uncoarsen", 
function () {
for (var obj, $obj = 0, $$obj = this.graphManager.getAllNodes (); $obj < $$obj.length && ((obj = $$obj[$obj]) || true); $obj++) {
var v = obj;
v.getPred1 ().setLocation (v.getLeft (), v.getTop ());
if (v.getPred2 () != null) {
v.getPred2 ().setLocation (v.getLeft () + this.idealEdgeLength, v.getTop () + this.idealEdgeLength);
}}
});
Clazz.overrideMethod (c$, "calcRepulsionRange", 
function () {
return (2 * (this.level + 1) * this.idealEdgeLength);
});
});
