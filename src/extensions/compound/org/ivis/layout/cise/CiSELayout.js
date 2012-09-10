Clazz.declarePackage ("org.ivis.layout.cise");
Clazz.load (["org.ivis.layout.fd.FDLayout"], "org.ivis.layout.cise.CiSELayout", ["java.util.ArrayList", "$.Arrays", "$.HashMap", "$.HashSet", "$.LinkedList", "$.TreeSet", "org.ivis.layout.LNodeDegreeSort", "$.LayoutOptionsPack", "org.ivis.layout.avsdf.AVSDFLayout", "org.ivis.layout.cise.CiSECircle", "$.CiSEEdge", "$.CiSEGraphManager", "$.CiSENode", "$.CiSENodeSort", "$.CiSEOnCircleNodePair", "org.ivis.layout.cose.CoSELayout", "org.ivis.util.IndexedObjectSort", "$.IntegerQuickSort"], function () {
c$ = Clazz.decorateAsClass (function () {
this.nodeSeperation = 12;
this.idealInterClusterEdgeLengthCoefficient = 1.4;
this.allowNodesInsideCircle = false;
this.maxRatioOfNodesInsideCircle = 0;
this.step = 0;
this.phase = 0;
this.swappedPairsInLastIteration = null;
this.iterations = 0;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.cise, "CiSELayout", org.ivis.layout.fd.FDLayout);
Clazz.makeConstructor (c$, 
function () {
Clazz.superConstructor (this, org.ivis.layout.cise.CiSELayout);
this.step = 0;
this.phase = 0;
this.swappedPairsInLastIteration =  new java.util.HashSet ();
this.oldTotalDisplacement = 0.0;
});
Clazz.overrideMethod (c$, "newGraphManager", 
function () {
var gm =  new org.ivis.layout.cise.CiSEGraphManager (this);
this.graphManager = gm;
return gm;
});
Clazz.overrideMethod (c$, "newGraph", 
function (vGraph) {
return  new org.ivis.layout.cise.CiSECircle (null, this.graphManager, vGraph);
}, "~O");
Clazz.overrideMethod (c$, "newNode", 
function (vNode) {
return  new org.ivis.layout.cise.CiSENode (this.graphManager, vNode);
}, "~O");
Clazz.defineMethod (c$, "newCiSEOnCircleNode", 
function (vNode) {
var newNode = this.newNode (vNode);
newNode.setAsOnCircleNode ();
return newNode;
}, "~O");
Clazz.overrideMethod (c$, "newEdge", 
function (vEdge) {
return  new org.ivis.layout.cise.CiSEEdge (null, null, vEdge);
}, "~O");
Clazz.defineMethod (c$, "convertToClusteredGraph", 
function () {
if (this.graphManager.getGraphs ().size () > 1) {
return false;
}var rootGraph = this.graphManager.getRoot ();
var clusterMap =  new java.util.HashMap ();
var clusterID;
var nodeAndEdgeLists;
for (var obj, $obj = 0, $$obj = this.getAllNodes (); $obj < $$obj.length && ((obj = $$obj[$obj]) || true); $obj++) {
clusterID = (obj).getClusterID ();
if (clusterID != null) {
nodeAndEdgeLists = clusterMap.get (clusterID);
if (nodeAndEdgeLists == null) {
nodeAndEdgeLists =  new Array (2);
nodeAndEdgeLists[0] =  new java.util.LinkedList ();
nodeAndEdgeLists[1] =  new java.util.LinkedList ();
clusterMap.put (clusterID, nodeAndEdgeLists);
}nodeAndEdgeLists[0].add (obj);
}}
var iter = clusterMap.keySet ().iterator ();
var nodeList;
var singleNodeClusterList =  new java.util.LinkedList ();
while (iter.hasNext ()) {
clusterID = iter.next ();
nodeAndEdgeLists = clusterMap.get (clusterID);
nodeList = nodeAndEdgeLists[0];
if (nodeList.size () < 2) {
singleNodeClusterList.add (clusterID);
(nodeList.getFirst ()).resetClusters ();
}}
for (var obj, $obj = singleNodeClusterList.iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
clusterMap.remove (obj);
}
var edge;
var sourceNode;
var targetNode;
var sourceClusterID;
var targetClusterID;
var edgeList;
for (var obj, $obj = 0, $$obj = this.getAllEdges (); $obj < $$obj.length && ((obj = $$obj[$obj]) || true); $obj++) {
edge = obj;
sourceNode = edge.getSource ();
targetNode = edge.getTarget ();
sourceClusterID = sourceNode.getClusterID ();
targetClusterID = targetNode.getClusterID ();
edge.isIntraCluster = false;
if (sourceClusterID != null && targetClusterID != null) {
if (sourceClusterID.equals (targetClusterID)) {
edge.isIntraCluster = true;
}nodeAndEdgeLists = clusterMap.get (sourceClusterID);
nodeAndEdgeLists[1].add (edge);
rootGraph.remove (edge);
} else if (sourceClusterID != null && targetClusterID == null) {
nodeAndEdgeLists = clusterMap.get (sourceClusterID);
nodeAndEdgeLists[1].add (edge);
rootGraph.remove (edge);
} else if (sourceClusterID == null && targetClusterID != null) {
nodeAndEdgeLists = clusterMap.get (targetClusterID);
nodeAndEdgeLists[1].add (edge);
rootGraph.remove (edge);
}}
iter = clusterMap.keySet ().iterator ();
var circle;
var clusterNode;
var node;
while (iter.hasNext ()) {
clusterID = iter.next ();
nodeAndEdgeLists = clusterMap.get (clusterID);
nodeList = nodeAndEdgeLists[0];
clusterNode = this.newNode (null);
this.graphManager.getRoot ().add (clusterNode);
circle = this.newGraph (null);
this.graphManager.add (circle, clusterNode);
circle.setMargin (circle.getMargin () + 15);
for (var obj, $obj = nodeList.iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
node = obj;
node.getOwner ().remove (node);
node.setAsOnCircleNode ();
circle.add (node);
circle.getInNodes ().add (node);
}
}
iter = clusterMap.keySet ().iterator ();
while (iter.hasNext ()) {
clusterID = iter.next ();
nodeAndEdgeLists = clusterMap.get (clusterID);
edgeList = nodeAndEdgeLists[1];
for (var obj, $obj = edgeList.iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
edge = obj;
if (edge.isIntraCluster) {
edge.getSource ().getOwner ().add (edge, edge.getSource (), edge.getTarget ());
} else {
this.graphManager.add (edge, edge.getSource (), edge.getTarget ());
}}
}
this.graphManager.resetAllNodes ();
var onCircleNodeCount = 0;
for (var lGraph, $lGraph = this.graphManager.getGraphs ().iterator (); $lGraph.hasNext () && ((lGraph = $lGraph.next ()) || true);) {
if (lGraph !== rootGraph) {
onCircleNodeCount += (lGraph).getNodes ().size ();
}}
var nonOnCircleNodeCount = rootGraph.getNodes ().size ();
var nonOnCircleNodes =  new Array (nonOnCircleNodeCount);
var onCircleNodes =  new Array (onCircleNodeCount);
var onCircleIndex = 0;
var nonOnCircleIndex = 0;
for (var obj, $obj = 0, $$obj = this.graphManager.getAllNodes (); $obj < $$obj.length && ((obj = $$obj[$obj]) || true); $obj++) {
node = obj;
if (node.getOnCircleNodeExt () != null) {
onCircleNodes[onCircleIndex] = node;
onCircleIndex++;
} else {
nonOnCircleNodes[nonOnCircleIndex] = node;
nonOnCircleIndex++;
}}
this.getCiSEGraphManager ().setOnCircleNodes (onCircleNodes);
this.getCiSEGraphManager ().setNonOnCircleNodes (nonOnCircleNodes);
this.getCiSEGraphManager ().setInCircleNodes ( new Array (0));
for (var obj, $obj = this.getGraphManager ().getInterGraphEdges ().iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
edge = obj;
sourceNode = edge.getSource ();
targetNode = edge.getTarget ();
sourceClusterID = sourceNode.getClusterID ();
targetClusterID = targetNode.getClusterID ();
if (sourceClusterID != null) {
circle = sourceNode.getOwner ();
if (circle.getInNodes ().remove (sourceNode)) {
circle.getOutNodes ().add (sourceNode);
}}if (targetClusterID != null) {
circle = targetNode.getOwner ();
if (circle.getInNodes ().remove (targetNode)) {
circle.getOutNodes ().add (targetNode);
}}}
return true;
});
Clazz.defineMethod (c$, "initParameters", 
function () {
Clazz.superCall (this, org.ivis.layout.cise.CiSELayout, "initParameters", []);
if (!this.isSubLayout) {
var layoutOptionsPack = org.ivis.layout.LayoutOptionsPack.getInstance ().getCiSE ();
this.nodeSeperation = layoutOptionsPack.getNodeSeparation ();
this.idealEdgeLength = layoutOptionsPack.getDesiredEdgeLength ();
this.idealInterClusterEdgeLengthCoefficient = org.ivis.layout.Layout.transform (layoutOptionsPack.getInterClusterEdgeLengthFactor (), 1.4);
this.allowNodesInsideCircle = layoutOptionsPack.isAllowNodesInsideCircle ();
this.maxRatioOfNodesInsideCircle = layoutOptionsPack.getMaxRatioOfNodesInsideCircle ();
}this.springConstant = 0.675;
this.repulsionConstant = 4500.0;
this.gravityConstant = 0.4;
this.incremental = true;
});
Clazz.defineMethod (c$, "getOnCircleNodes", 
function () {
return this.getCiSEGraphManager ().getOnCircleNodes ();
});
Clazz.defineMethod (c$, "getNonOnCircleNodes", 
function () {
return this.getCiSEGraphManager ().getNonOnCircleNodes ();
});
Clazz.defineMethod (c$, "getInCircleNodes", 
function () {
return this.getCiSEGraphManager ().getInCircleNodes ();
});
Clazz.defineMethod (c$, "getCiSEGraphManager", 
function () {
return this.graphManager;
});
Clazz.defineMethod (c$, "getNodeSeparation", 
function () {
return this.nodeSeperation;
});
Clazz.overrideMethod (c$, "layout", 
function () {
var root = this.graphManager.getRoot ();
if (!this.convertToClusteredGraph ()) {
return false;
}root.updateConnected ();
root.calcEstimatedSize ();
this.doStep1 ();
this.doStep2 ();
root.setEstimatedSize (root.getBiggerDimension ());
this.prepareCirclesForReversal ();
this.calcIdealEdgeLengths (false);
this.doStep5 ();
this.doStep3 ();
this.doStep5 ();
this.doStep4 ();
this.findAndMoveInnerNodes ();
this.calcIdealEdgeLengths (true);
this.doStep5 ();
System.out.println ("CiSE layout finished after " + this.totalIterations + " iterations");
return true;
});
Clazz.defineMethod (c$, "doStep1", 
function () {
this.step = 1;
this.phase = 3;
var clusteredNodes;
var avsdfNode;
var avsdfEdge;
var ciseToAvsdf =  new java.util.HashMap ();
for (var graph, $graph = this.graphManager.getGraphs ().iterator (); $graph.hasNext () && ((graph = $graph.next ()) || true);) {
var lgraph = graph;
if (lgraph === this.graphManager.getRoot ()) {
continue ;}var avsdfLayout =  new org.ivis.layout.avsdf.AVSDFLayout ();
avsdfLayout.isSubLayout = true;
avsdfLayout.setNodeSeparation (this.nodeSeperation);
var avsdfCircle = avsdfLayout.getGraphManager ().addRoot ();
var ciseCircle = lgraph;
clusteredNodes = ciseCircle.getOnCircleNodes ();
var loc;
for (var node, $node = clusteredNodes.iterator (); $node.hasNext () && ((node = $node.next ()) || true);) {
var ciseOnCircleNode = node;
avsdfNode = avsdfLayout.newNode (ciseOnCircleNode.vGraphObject);
loc = ciseOnCircleNode.getLocation ();
avsdfNode.setLocation (loc.x, loc.y);
avsdfNode.setWidth (ciseOnCircleNode.getWidth ());
avsdfNode.setHeight (ciseOnCircleNode.getHeight ());
avsdfCircle.add (avsdfNode);
ciseToAvsdf.put (ciseOnCircleNode, avsdfNode);
}
for (var edge, $edge = 0, $$edge = this.getAllEdges (); $edge < $$edge.length && ((edge = $$edge[$edge]) || true); $edge++) {
var ciseEdge = edge;
if (clusteredNodes.contains (ciseEdge.getSource ()) && clusteredNodes.contains (ciseEdge.getTarget ())) {
var avsdfSource = ciseToAvsdf.get (ciseEdge.getSource ());
var avsdfTarget = ciseToAvsdf.get (ciseEdge.getTarget ());
avsdfEdge = avsdfLayout.newEdge ("");
avsdfCircle.add (avsdfEdge, avsdfSource, avsdfTarget);
}}
avsdfLayout.runLayout ();
for (var node, $node = clusteredNodes.iterator (); $node.hasNext () && ((node = $node.next ()) || true);) {
var ciseOnCircleNode = node;
avsdfNode = ciseToAvsdf.get (ciseOnCircleNode);
loc = avsdfNode.getLocation ();
ciseOnCircleNode.setLocation (loc.x, loc.y);
ciseOnCircleNode.getOnCircleNodeExt ().setIndex (avsdfNode.getIndex ());
ciseOnCircleNode.getOnCircleNodeExt ().setAngle (avsdfNode.getAngle ());
}
var sorter =  new org.ivis.layout.cise.CiSENodeSort (clusteredNodes);
sorter.quicksort ();
if (avsdfCircle.getNodes ().size () > 0) {
var parentCiSE = ciseCircle.getParent ();
var parentAVSDF = avsdfCircle.getParent ();
parentCiSE.setLocation (parentAVSDF.getLocation ().x, parentAVSDF.getLocation ().y);
ciseCircle.setRadius (avsdfCircle.getRadius ());
ciseCircle.calculateParentNodeDimension ();
}}
});
Clazz.defineMethod (c$, "doStep2", 
function () {
this.step = 2;
this.phase = 3;
var newCoSENodes =  new java.util.ArrayList ();
var newCoSEEdges =  new java.util.ArrayList ();
var newNode;
var newEdge;
var ciseNodeToCoseNode =  new java.util.HashMap ();
var coseEdgeToCiseEdges =  new java.util.HashMap ();
var coseLayout =  new org.ivis.layout.cose.CoSELayout ();
coseLayout.isSubLayout = true;
coseLayout.useMultiLevelScaling = false;
coseLayout.useFRGridVariant = true;
coseLayout.springConstant *= 1.5;
var coseRoot = coseLayout.getGraphManager ().addRoot ();
var nonOnCircleNodes = this.getNonOnCircleNodes ();
var loc;
for (var i = 0; i < nonOnCircleNodes.length; i++) {
var ciseNode = nonOnCircleNodes[i];
newNode = coseLayout.newNode (ciseNode.vGraphObject);
loc = ciseNode.getLocation ();
newNode.setLocation (loc.x, loc.y);
newNode.setWidth (ciseNode.getWidth ());
newNode.setHeight (ciseNode.getHeight ());
if (ciseNode.getChild () != null) {
newNode.setWidth (1.2 * newNode.getWidth ());
newNode.setHeight (1.2 * newNode.getHeight ());
}coseRoot.add (newNode);
newCoSENodes.add (newNode);
ciseNodeToCoseNode.put (ciseNode, newNode);
}
var nodePairs =  Clazz.newArray (newCoSENodes.size (), newCoSENodes.size (), null);
var allEdges = this.graphManager.getAllEdges ();
for (var i = 0; i < allEdges.length; i++) {
var ciseEdge = allEdges[i];
var sourceCise = ciseEdge.getSource ();
var targetCise = ciseEdge.getTarget ();
if (sourceCise.getOnCircleNodeExt () != null) {
sourceCise = ciseEdge.getSource ().getOwner ().getParent ();
}if (targetCise.getOnCircleNodeExt () != null) {
targetCise = ciseEdge.getTarget ().getOwner ().getParent ();
}var sourceCose = ciseNodeToCoseNode.get (sourceCise);
var targetCose = ciseNodeToCoseNode.get (targetCise);
var sourceIndex = newCoSENodes.indexOf (sourceCose);
var targetIndex = newCoSENodes.indexOf (targetCose);
if (sourceIndex != targetIndex) {
if (nodePairs[sourceIndex][targetIndex] == null && nodePairs[targetIndex][sourceIndex] == null) {
newEdge = coseLayout.newEdge ("");
coseRoot.add (newEdge, sourceCose, targetCose);
newCoSEEdges.add (newEdge);
coseEdgeToCiseEdges.put (newEdge,  new java.util.HashSet ());
nodePairs[sourceIndex][targetIndex] = newEdge;
nodePairs[targetIndex][sourceIndex] = newEdge;
} else {
newEdge = nodePairs[sourceIndex][targetIndex];
}coseEdgeToCiseEdges.get (newEdge).add (ciseEdge);
}}
this.reorderIncidentEdges (ciseNodeToCoseNode, coseEdgeToCiseEdges);
coseLayout.runLayout ();
nonOnCircleNodes = this.getNonOnCircleNodes ();
for (var i = 0; i < nonOnCircleNodes.length; i++) {
var ciseNode = nonOnCircleNodes[i];
var coseNode = ciseNodeToCoseNode.get (ciseNode);
loc = coseNode.getLocation ();
ciseNode.setLocation (loc.x, loc.y);
}
var onCircleNodes = this.getOnCircleNodes ();
var ciseNode;
var parentLoc;
for (var i = 0; i < onCircleNodes.length; i++) {
ciseNode = onCircleNodes[i];
loc = ciseNode.getLocation ();
parentLoc = ciseNode.getOwner ().getParent ().getLocation ();
ciseNode.setLocation (loc.x + parentLoc.x, loc.y + parentLoc.y);
}
});
Clazz.defineMethod (c$, "reorderIncidentEdges", 
($fz = function (ciseNodeToCoseNode, coseEdgeToCiseEdges) {
var nonOnCircleNodes = this.getNonOnCircleNodes ();
for (var i = 0; i < nonOnCircleNodes.length; i++) {
if (nonOnCircleNodes[i].getChild () == null) {
continue ;}var ciseCircle = nonOnCircleNodes[i].getChild ();
var mod = ciseCircle.getOnCircleNodes ().size ();
var coseNode = ciseNodeToCoseNode.get (ciseCircle.getParent ());
var incidentCoseEdges = coseNode.getEdges ();
var indexMapping =  new java.util.HashMap ();
for (var j = 0; j < incidentCoseEdges.size (); j++) {
var coseEdge = incidentCoseEdges.get (j);
var edgeIndices =  new java.util.ArrayList ();
var ciseEdges = coseEdgeToCiseEdges.get (coseEdge);
var edgeIter = ciseEdges.iterator ();
while (edgeIter.hasNext ()) {
var ciseEdge = edgeIter.next ();
var edgeIndex = -1;
if (ciseEdge.getSource ().getOwner () === ciseCircle) {
edgeIndex = (ciseEdge.getSource ()).getOnCircleNodeExt ().getIndex ();
} else if (ciseEdge.getTarget ().getOwner () === ciseCircle) {
edgeIndex = (ciseEdge.getTarget ()).getOnCircleNodeExt ().getIndex ();
}edgeIndices.add ( new Integer (edgeIndex));
}
var intSort =  new org.ivis.util.IntegerQuickSort (edgeIndices);
intSort.quicksort ();
var indexLargestGapStart = -1;
var largestGap = -1;
var gap;
var indexIter = edgeIndices.iterator ();
var edgeIndex = null;
var prevEdgeIndex;
var firstEdgeIndex = new Integer (-1);
var edgeIndexPos = -1;
while (indexIter.hasNext ()) {
prevEdgeIndex = edgeIndex;
edgeIndex = indexIter.next ();
edgeIndexPos++;
if (prevEdgeIndex != null) {
gap = (edgeIndex).intValue () - (prevEdgeIndex).intValue ();
if (gap > largestGap) {
largestGap = gap;
indexLargestGapStart = edgeIndexPos - 1;
}} else {
firstEdgeIndex = edgeIndex;
}}
if ((firstEdgeIndex).intValue () !== -1 && ((firstEdgeIndex).intValue () + mod - (edgeIndex).intValue ()) > largestGap) {
largestGap = (firstEdgeIndex).intValue () + mod - (edgeIndex).intValue ();
indexLargestGapStart = edgeIndexPos;
}var edgeCount = edgeIndices.size ();
if (largestGap > 0) {
var index;
for (var k = indexLargestGapStart + 1; k < edgeCount; k++) {
index = edgeIndices.get (k);
edgeIndices.set (k, new Integer ((index).intValue () - mod));
}
}var averageIndex;
var totalIndex = 0;
indexIter = edgeIndices.iterator ();
while (indexIter.hasNext ()) {
edgeIndex = indexIter.next ();
totalIndex += (edgeIndex).intValue ();
}
averageIndex = totalIndex / edgeCount;
if (averageIndex < 0) {
averageIndex += mod;
}indexMapping.put (coseEdge, new Double (averageIndex));
}
var sort =  new org.ivis.util.IndexedObjectSort (incidentCoseEdges, indexMapping);
sort.quicksort ();
}
}, $fz.isPrivate = true, $fz), "java.util.HashMap,java.util.HashMap");
Clazz.defineMethod (c$, "calcIdealEdgeLengths", 
function (isPolishingStep) {
var lEdges = this.getAllEdges ();
var edge;
for (var i = 0; i < lEdges.length; i++) {
edge = lEdges[i];
if (isPolishingStep) {
edge.idealLength = 1.5 * this.idealEdgeLength * this.idealInterClusterEdgeLengthCoefficient;
} else {
edge.idealLength = this.idealEdgeLength * this.idealInterClusterEdgeLengthCoefficient;
}}
var lNodes = this.getInCircleNodes ();
var node;
for (var i = 0; i < lNodes.length; i++) {
node = lNodes[i];
for (var obj, $obj = node.getEdges ().iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
edge = obj;
edge.idealLength = 16;
}
}
}, "~B");
Clazz.defineMethod (c$, "calcIdealEdgeLengthFactor", 
function (edge) {
if (edge.isIntraCluster) {
return 1.5;
}var rootGraph = this.getGraphManager ().getRoot ();
var srcCluster = edge.getSource ().getOwner ();
var trgCluster = edge.getTarget ().getOwner ();
var srcSize;
var trgSize;
if (srcCluster === rootGraph) {
srcSize = 1;
} else {
srcSize = srcCluster.getNodes ().size ();
}if (trgCluster === rootGraph) {
trgSize = 1;
} else {
trgSize = trgCluster.getNodes ().size ();
}var totalSize = srcSize + trgSize;
if (totalSize <= 8) {
return 1.5;
}return 0.12 * totalSize;
}, "org.ivis.layout.cise.CiSEEdge");
Clazz.defineMethod (c$, "doStep3", 
function () {
this.step = 3;
this.phase = 3;
this.initSpringEmbedder ();
this.runSpringEmbedder ();
});
Clazz.defineMethod (c$, "doStep4", 
function () {
this.step = 4;
this.phase = 3;
this.initSpringEmbedder ();
this.runSpringEmbedder ();
});
Clazz.defineMethod (c$, "doStep5", 
function () {
this.step = 5;
this.phase = 3;
this.initSpringEmbedder ();
this.runSpringEmbedder ();
});
Clazz.defineMethod (c$, "runSpringEmbedder", 
($fz = function () {
if (this.step == 4) {
for (var i = 0; i < this.getOnCircleNodes ().length; i++) {
this.getOnCircleNodes ()[i].getOnCircleNodeExt ().updateSwappingConditions ();
}
}this.totalDisplacement = 1000;
var iterations = 0;
do {
iterations++;
if (iterations % 100 == 0) {
var notTooEarly = this.step != 4 || iterations > Math.floor (this.maxIterations / 4);
if (notTooEarly && this.isConverged ()) {
break;
}this.coolingFactor = this.initialCoolingFactor * ((this.maxIterations - iterations) / this.maxIterations);
}this.totalDisplacement = 0;
if (this.step == 3) {
if (iterations % 25 == 0) {
this.checkAndReverseIfReverseIsBetter ();
}} else if (this.step == 4) {
if (iterations % 300 == 0) {
this.swappedPairsInLastIteration.clear ();
}var iterationInPeriod = iterations % 50;
if (iterationInPeriod >= 45) {
this.phase = 1;
} else if (iterationInPeriod == 0) {
this.phase = 2;
} else {
this.phase = 3;
}}this.calcSpringForces ();
this.calcRepulsionForces ();
this.calcGravitationalForces ();
this.calcTotalForces ();
this.moveNodes ();
this.animate ();
} while (iterations < this.maxIterations);
this.totalIterations += iterations;
}, $fz.isPrivate = true, $fz));
Clazz.overrideMethod (c$, "calcSpringForces", 
function () {
var lEdges = this.getAllEdges ();
var edge;
var source;
var target;
for (var i = 0; i < lEdges.length; i++) {
edge = lEdges[i];
source = edge.getSource ();
target = edge.getTarget ();
if (edge.isIntraCluster && source.getOnCircleNodeExt () != null && target.getOnCircleNodeExt () != null) {
continue ;}this.calcSpringForce (edge, edge.idealLength);
}
});
Clazz.overrideMethod (c$, "calcRepulsionForces", 
function () {
var i;
var j;
var nodeA;
var nodeB;
var lNodes = this.getNonOnCircleNodes ();
for (i = 0; i < lNodes.length; i++) {
nodeA = lNodes[i];
for (j = i + 1; j < lNodes.length; j++) {
nodeB = lNodes[j];
this.calcRepulsionForce (nodeA, nodeB);
}
}
var inCircleNodes = this.getInCircleNodes ();
for (var inCircleNode, $inCircleNode = 0, $$inCircleNode = inCircleNodes; $inCircleNode < $$inCircleNode.length && ((inCircleNode = $$inCircleNode[$inCircleNode]) || true); $inCircleNode++) {
var ownerCircle = inCircleNode.getOwner ();
for (var childNode, $childNode = ownerCircle.getNodes ().iterator (); $childNode.hasNext () && ((childNode = $childNode.next ()) || true);) {
var childCiSENode = childNode;
if (childCiSENode !== inCircleNode) {
this.calcRepulsionForce (inCircleNode, childCiSENode);
}}
}
});
Clazz.overrideMethod (c$, "calcGravitationalForces", 
function () {
var node;
var lNodes;
if (!this.getGraphManager ().getRoot ().isConnected ()) {
lNodes = this.getNonOnCircleNodes ();
for (var i = 0; i < lNodes.length; i++) {
node = lNodes[i];
this.calcGravitationalForce (node);
}
}lNodes = this.getInCircleNodes ();
for (var i = 0; i < lNodes.length; i++) {
node = lNodes[i];
this.calcGravitationalForce (node);
}
});
Clazz.defineMethod (c$, "calcTotalForces", 
function () {
var allNodes = this.getAllNodes ();
for (var i = 0; i < allNodes.length; i++) {
var node = allNodes[i];
node.displacementX = this.coolingFactor * (node.springForceX + node.repulsionForceX + node.gravitationForceX);
node.displacementY = this.coolingFactor * (node.springForceY + node.repulsionForceY + node.gravitationForceY);
node.rotationAmount = 0.0;
node.springForceX = 0.0;
node.springForceY = 0.0;
node.repulsionForceX = 0.0;
node.repulsionForceY = 0.0;
node.gravitationForceX = 0.0;
node.gravitationForceY = 0.0;
}
var onCircleNodes = this.getOnCircleNodes ();
var node;
for (var i = 0; i < onCircleNodes.length; i++) {
node = onCircleNodes[i];
var parentNode = (node.getOwner ().getParent ());
var values = ((node.getOwner ())).decomposeForce (node);
if (this.phase == 1) {
node.getOnCircleNodeExt ().addDisplacementForSwap (values.getRotationAmount ());
}parentNode.displacementX += values.getDisplacementX ();
parentNode.displacementY += values.getDisplacementY ();
node.displacementX = 0.0;
node.displacementY = 0.0;
parentNode.rotationAmount += values.getRotationAmount ();
node.rotationAmount = 0.0;
}
});
Clazz.overrideMethod (c$, "moveNodes", 
function () {
if (this.phase != 2) {
var nonOnCircleNodes = this.getNonOnCircleNodes ();
for (var i = 0; i < nonOnCircleNodes.length; i++) {
nonOnCircleNodes[i].move ();
if (nonOnCircleNodes[i].getChild () != null) {
(nonOnCircleNodes[i].getChild ()).rotate ();
}}
var inCircleNodes = this.getInCircleNodes ();
var inCircleNode;
for (var i = 0; i < inCircleNodes.length; i++) {
inCircleNode = inCircleNodes[i];
inCircleNode.displacementX /= 20.0;
inCircleNode.displacementY /= 20.0;
inCircleNode.move ();
}
} else {
var ciseOnCircleNodes = this.getOnCircleNodes ();
var size = ciseOnCircleNodes.length;
var nonSafePairs =  new java.util.TreeSet ();
var safePairs =  new java.util.ArrayList ();
var swappedNodes =  new java.util.HashSet ();
var swappedPairs =  new java.util.HashSet ();
var firstNode;
var secondNode;
var firstNodeExt;
var secondNodeExt;
var firstNodeDisp;
var secondNodeDisp;
var discrepancy;
var inSameDirection;
for (var i = 0; i < size; i++) {
firstNode = ciseOnCircleNodes[i];
secondNode = firstNode.getOnCircleNodeExt ().getNextNode ();
firstNodeExt = firstNode.getOnCircleNodeExt ();
secondNodeExt = secondNode.getOnCircleNodeExt ();
if (!firstNodeExt.canSwapWithNext () || !secondNodeExt.canSwapWithPrev ()) {
continue ;}firstNodeDisp = firstNodeExt.getDisplacementForSwap ();
secondNodeDisp = secondNodeExt.getDisplacementForSwap ();
discrepancy = firstNodeDisp - secondNodeDisp;
if (discrepancy < 0.0) {
continue ;}inSameDirection = (firstNodeDisp > 0 && secondNodeDisp > 0) || (firstNodeDisp < 0 && secondNodeDisp < 0);
var pair =  new org.ivis.layout.cise.CiSEOnCircleNodePair (firstNode, secondNode, discrepancy, inSameDirection);
if (firstNodeDisp == 0.0 || secondNodeDisp == 0.0) {
safePairs.add (pair);
} else {
nonSafePairs.add (pair);
}}
var nonSafePair;
var lookForSwap = true;
var rollback;
while (lookForSwap && nonSafePairs.size () > 0) {
nonSafePair = nonSafePairs.last ();
firstNode = nonSafePair.getFirstNode ();
secondNode = nonSafePair.getSecondNode ();
firstNodeExt = firstNode.getOnCircleNodeExt ();
secondNodeExt = secondNode.getOnCircleNodeExt ();
if (this.isSwappedPreviously (nonSafePair)) {
nonSafePairs.remove (nonSafePair);
swappedPairs.add (nonSafePair);
continue ;}var int1 = firstNodeExt.getInterClusterIntersections (secondNodeExt);
nonSafePair.swap ();
rollback = false;
var int2 = firstNodeExt.getInterClusterIntersections (secondNodeExt);
rollback = int2 > int1;
if (!rollback && int2 == int1) {
rollback = nonSafePair.inSameDirection () || nonSafePair.getDiscrepancy () < 6;
}if (rollback) {
nonSafePair.swap ();
nonSafePairs.remove (nonSafePair);
continue ;}swappedNodes.add (nonSafePair.getFirstNode ());
swappedNodes.add (nonSafePair.getSecondNode ());
swappedPairs.add (nonSafePair);
lookForSwap = false;
}
var iter = safePairs.iterator ();
while (iter.hasNext ()) {
var safePair = iter.next ();
if (safePair.inSameDirection () || safePair.getDiscrepancy () < 6) {
continue ;}if (swappedNodes.contains (safePair.getFirstNode ()) || swappedNodes.contains (safePair.getSecondNode ())) {
continue ;}if (!this.isSwappedPreviously (safePair)) {
safePair.swap ();
swappedNodes.add (safePair.getFirstNode ());
swappedNodes.add (safePair.getSecondNode ());
}swappedPairs.add (safePair);
}
this.swappedPairsInLastIteration.clear ();
this.swappedPairsInLastIteration.addAll (swappedPairs);
var node;
for (var i = 0; i < size; i++) {
node = ciseOnCircleNodes[i];
node.getOnCircleNodeExt ().setDisplacementForSwap (0.0);
}
}});
Clazz.defineMethod (c$, "isSwappedPreviously", 
($fz = function (pair) {
var iter = this.swappedPairsInLastIteration.iterator ();
var swappedPair;
while (iter.hasNext ()) {
swappedPair = iter.next ();
if ((swappedPair.getFirstNode () === pair.getFirstNode () && swappedPair.getSecondNode () === pair.getSecondNode ()) || (swappedPair.getSecondNode () === pair.getFirstNode () && swappedPair.getFirstNode () === pair.getSecondNode ())) {
return true;
}}
return false;
}, $fz.isPrivate = true, $fz), "org.ivis.layout.cise.CiSEOnCircleNodePair");
Clazz.defineMethod (c$, "calculateNodesToApplyGravitationTo", 
function () {
var gm = this.graphManager;
var root = gm.getRoot ();
root.updateConnected ();
if (!root.isConnected ()) {
gm.setAllNodesToApplyGravitation (gm.getOnCircleNodes ());
} else {
gm.setAllNodesToApplyGravitation ( new java.util.LinkedList ());
}});
Clazz.defineMethod (c$, "prepareCirclesForReversal", 
($fz = function () {
var gm = this.getGraphManager ();
var nodeIterator = gm.getRoot ().getNodes ().iterator ();
var node;
var circle;
while (nodeIterator.hasNext ()) {
node = nodeIterator.next ();
circle = node.getChild ();
if (circle != null) {
if (circle.getInterClusterEdges ().size () < 2) {
circle.setMayNotBeReversed ();
}circle.computeOrderMatrix ();
}}
}, $fz.isPrivate = true, $fz));
Clazz.defineMethod (c$, "checkAndReverseIfReverseIsBetter", 
($fz = function () {
var gm = this.getGraphManager ();
var nodeIterator = gm.getRoot ().getNodes ().iterator ();
var node;
var circle;
while (nodeIterator.hasNext ()) {
node = nodeIterator.next ();
circle = node.getChild ();
if (circle != null && circle.mayBeReversed () && circle.getNodes ().size () <= 52) {
if (circle.checkAndReverseIfReverseIsBetter ()) {
return true;
}}}
return false;
}, $fz.isPrivate = true, $fz));
Clazz.defineMethod (c$, "findAndMoveInnerNodes", 
($fz = function () {
if (!this.allowNodesInsideCircle) {
return ;
}for (var ciseCircleObject, $ciseCircleObject = this.getGraphManager ().getGraphs ().iterator (); $ciseCircleObject.hasNext () && ((ciseCircleObject = $ciseCircleObject.next ()) || true);) {
var ciseCircle = ciseCircleObject;
var innerNodeCount = 0;
if (ciseCircle !== this.getGraphManager ().getRoot ()) {
var maxInnerNodes = Math.round ((ciseCircle.getNodes ().size () * this.maxRatioOfNodesInsideCircle));
var innerNode = this.findInnerNode (ciseCircle);
while (innerNode != null && innerNodeCount < maxInnerNodes) {
this.moveInnerNode (innerNode);
innerNodeCount++;
if (innerNodeCount < maxInnerNodes) {
innerNode = this.findInnerNode (ciseCircle);
}}
}}
}, $fz.isPrivate = true, $fz));
Clazz.defineMethod (c$, "findInnerNode", 
($fz = function (ciseCircle) {
var innerNode = null;
var onCircleNodeCount = ciseCircle.getOnCircleNodes ().size ();
var sortedNodes =  new java.util.ArrayList (ciseCircle.getOnCircleNodes ());
 new org.ivis.layout.LNodeDegreeSort (sortedNodes).quicksort ();
for (var i = onCircleNodeCount - 1; i >= 0 && innerNode == null; i--) {
var candidateNode = sortedNodes.get (i);
if (candidateNode.getOnCircleNodeExt ().getInterClusterEdges ().size () != 0) {
continue ;}var circleSegment = this.findMinimalSpanningSegment (candidateNode);
if (circleSegment.size () == 0) {
continue ;}var connectedToNonImmediate = false;
for (var spanningNode, $spanningNode = circleSegment.iterator (); $spanningNode.hasNext () && ((spanningNode = $spanningNode.next ()) || true);) {
if (connectedToNonImmediate) {
break;
}for (var neighborOfSpanningNodeObject, $neighborOfSpanningNodeObject = spanningNode.getNeighborsList ().iterator (); $neighborOfSpanningNodeObject.hasNext () && ((neighborOfSpanningNodeObject = $neighborOfSpanningNodeObject.next ()) || true);) {
var neighborOfSpanningNode = neighborOfSpanningNodeObject;
if (neighborOfSpanningNode !== candidateNode && neighborOfSpanningNode.getOwner () === ciseCircle && neighborOfSpanningNode.getOnCircleNodeExt () != null) {
var spanningIndex = spanningNode.getOnCircleNodeExt ().getIndex ();
var neighborOfSpanningIndex = neighborOfSpanningNode.getOnCircleNodeExt ().getIndex ();
var indexDiff = spanningIndex - neighborOfSpanningIndex;
indexDiff += onCircleNodeCount;
indexDiff %= onCircleNodeCount;
if (indexDiff > 1) {
indexDiff = neighborOfSpanningIndex - spanningIndex;
indexDiff += onCircleNodeCount;
indexDiff %= onCircleNodeCount;
}if (indexDiff > 1) {
connectedToNonImmediate = true;
break;
}}}
}
if (!connectedToNonImmediate) {
innerNode = candidateNode;
}}
return innerNode;
}, $fz.isPrivate = true, $fz), "org.ivis.layout.cise.CiSECircle");
Clazz.defineMethod (c$, "moveInnerNode", 
($fz = function (innerNode) {
var ciseCircle = innerNode.getOwner ();
ciseCircle.moveOnCircleNodeInside (innerNode);
var onCircleNodesList =  new java.util.ArrayList (java.util.Arrays.asList (this.getCiSEGraphManager ().getOnCircleNodes ()));
onCircleNodesList.remove (innerNode);
this.getCiSEGraphManager ().setOnCircleNodes (onCircleNodesList.toArray ( new Array (0)));
var inCircleNodesList =  new java.util.ArrayList (java.util.Arrays.asList (this.getCiSEGraphManager ().getInCircleNodes ()));
inCircleNodesList.add (innerNode);
this.getCiSEGraphManager ().setInCircleNodes (inCircleNodesList.toArray ( new Array (0)));
}, $fz.isPrivate = true, $fz), "org.ivis.layout.cise.CiSENode");
Clazz.defineMethod (c$, "findMinimalSpanningSegment", 
($fz = function (node) {
var segment =  new java.util.ArrayList ();
var orderedNeigbors =  new java.util.ArrayList (node.getOnCircleNeighbors ());
if (orderedNeigbors.size () == 0) {
return segment;
} new org.ivis.layout.cise.CiSENodeSort (orderedNeigbors).quicksort ();
var orderedNodes = (node.getOwner ()).getOnCircleNodes ();
var shortestSegmentStartNode = null;
var shortestSegmentEndNode = null;
var shortestSegmentLength = orderedNodes.size ();
var segmentLength = orderedNodes.size ();
var neighSize = orderedNeigbors.size ();
var i;
var j;
var tempSegmentStartNode;
var tempSegmentEndNode;
var tempSegmentLength;
for (i = 0; i < neighSize; i++) {
j = ((i - 1) + neighSize) % neighSize;
tempSegmentStartNode = orderedNeigbors.get (i);
tempSegmentEndNode = orderedNeigbors.get (j);
tempSegmentLength = (tempSegmentEndNode.getOnCircleNodeExt ().getIndex () - tempSegmentStartNode.getOnCircleNodeExt ().getIndex () + segmentLength) % segmentLength + 1;
if (tempSegmentLength < shortestSegmentLength) {
shortestSegmentStartNode = tempSegmentStartNode;
shortestSegmentEndNode = tempSegmentEndNode;
shortestSegmentLength = tempSegmentLength;
}}
var segmentEndReached = false;
var currentNode = shortestSegmentStartNode;
while (!segmentEndReached) {
if (currentNode !== node) {
segment.add (currentNode);
}if (currentNode === shortestSegmentEndNode) {
segmentEndReached = true;
} else {
var nextIndex = currentNode.getOnCircleNodeExt ().getIndex () + 1;
if (nextIndex == orderedNodes.size ()) {
nextIndex = 0;
}currentNode = orderedNodes.get (nextIndex);
}}
return segment;
}, $fz.isPrivate = true, $fz), "org.ivis.layout.cise.CiSENode");
Clazz.defineStatics (c$,
"STEP_NOT_STARTED", 0,
"STEP_1", 1,
"STEP_2", 2,
"STEP_3", 3,
"STEP_4", 4,
"STEP_5", 5,
"PHASE_NOT_STARTED", 0,
"PHASE_SWAP_PREPERATION", 1,
"PHASE_PERFORM_SWAP", 2,
"PHASE_OTHER", 3);
});
