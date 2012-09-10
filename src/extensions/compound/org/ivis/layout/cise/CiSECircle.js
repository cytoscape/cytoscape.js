Clazz.declarePackage ("org.ivis.layout.cise");
Clazz.load (["org.ivis.layout.LGraph"], "org.ivis.layout.cise.CiSECircle", ["java.io.CharArrayReader", "java.util.ArrayList", "$.HashSet", "org.ivis.layout.cise.CiSEInterClusterEdgeInfo", "$.CiSEInterClusterEdgeSort", "$.CiSENodeSort", "$.CircularForce", "org.ivis.util.IGeometry", "org.ivis.util.alignment.BasicScoringScheme", "$.NeedlemanWunsch"], function () {
c$ = Clazz.decorateAsClass (function () {
this.intraClusterEdges = null;
this.interClusterEdges = null;
this.inNodes = null;
this.outNodes = null;
this.onCircleNodes = null;
this.inCircleNodes = null;
this.radius = 0;
this.orderMatrix = null;
this.$mayBeReversed = false;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.cise, "CiSECircle", org.ivis.layout.LGraph);
Clazz.makeConstructor (c$, 
function (parent, graphMgr, vNode) {
Clazz.superConstructor (this, org.ivis.layout.cise.CiSECircle, [parent, graphMgr, vNode]);
this.inNodes =  new java.util.HashSet ();
this.outNodes =  new java.util.HashSet ();
this.onCircleNodes =  new java.util.ArrayList ();
this.inCircleNodes =  new java.util.ArrayList ();
this.$mayBeReversed = true;
}, "org.ivis.layout.LNode,org.ivis.layout.LGraphManager,~O");
Clazz.defineMethod (c$, "getChildAt", 
function (index) {
return this.getOnCircleNodes ().get (index);
}, "~N");
Clazz.defineMethod (c$, "add", 
function (newNode) {
this.onCircleNodes.add (newNode);
return Clazz.superCall (this, org.ivis.layout.cise.CiSECircle, "add", [newNode]);
}, "org.ivis.layout.LNode");
Clazz.defineMethod (c$, "rotate", 
function () {
var parentNode = this.getParent ();
var noOfNodes = this.getOnCircleNodes ().size ();
var rotationAmount = parentNode.rotationAmount / noOfNodes;
var onCircleNode;
var onCircleNodeExt;
var layout = (this.getGraphManager ().getLayout ());
if (rotationAmount != 0.0) {
var teta = rotationAmount / this.radius;
if (teta > 0.08726646259971647) {
teta = 0.08726646259971647;
} else if (teta < -0.08726646259971647) {
teta = -0.08726646259971647;
}for (var i = 0; i < noOfNodes; i++) {
onCircleNode = this.getChildAt (i);
onCircleNodeExt = onCircleNode.getOnCircleNodeExt ();
onCircleNodeExt.setAngle (onCircleNodeExt.getAngle () + teta);
onCircleNodeExt.updatePosition ();
}
layout.totalDisplacement += parentNode.rotationAmount;
parentNode.rotationAmount = 0.0;
}});
Clazz.defineMethod (c$, "getRadius", 
function () {
return this.radius;
});
Clazz.defineMethod (c$, "getInNodes", 
function () {
return this.inNodes;
});
Clazz.defineMethod (c$, "getOutNodes", 
function () {
return this.outNodes;
});
Clazz.defineMethod (c$, "getOnCircleNodes", 
function () {
return this.onCircleNodes;
});
Clazz.defineMethod (c$, "getInCircleNodes", 
function () {
return this.inCircleNodes;
});
Clazz.defineMethod (c$, "setRadius", 
function (radius) {
this.radius = radius;
}, "~N");
Clazz.defineMethod (c$, "getOrder", 
function (nodeA, nodeB) {
return this.orderMatrix[nodeA.getOnCircleNodeExt ().getIndex ()][nodeB.getOnCircleNodeExt ().getIndex ()];
}, "org.ivis.layout.cise.CiSENode,org.ivis.layout.cise.CiSENode");
Clazz.defineMethod (c$, "computeOrderMatrix", 
function () {
var N = this.onCircleNodes.size ();
this.orderMatrix =  Clazz.newArray (N, N, false);
var nodeIterA = this.onCircleNodes.iterator ();
var nodeIterB;
var nodeA;
var nodeB;
var angleDiff;
for (var i = 0; i < N; i++) {
nodeA = nodeIterA.next ();
nodeIterB = this.onCircleNodes.iterator ();
for (var j = 0; j < N; j++) {
nodeB = nodeIterB.next ();
if (j > i) {
angleDiff = nodeB.getOnCircleNodeExt ().getAngle () - nodeA.getOnCircleNodeExt ().getAngle ();
if (angleDiff < 0) {
angleDiff += 6.283185307179586;
}if (angleDiff <= 3.141592653589793) {
this.orderMatrix[i][j] = true;
this.orderMatrix[j][i] = false;
} else {
this.orderMatrix[i][j] = false;
this.orderMatrix[j][i] = true;
}}}
}
});
Clazz.defineMethod (c$, "mayBeReversed", 
function () {
return this.$mayBeReversed;
});
Clazz.defineMethod (c$, "setMayNotBeReversed", 
function () {
this.$mayBeReversed = false;
});
Clazz.defineMethod (c$, "getThisEnd", 
function (edge) {
var sourceNode = edge.getSource ();
var targetNode = edge.getTarget ();
if (sourceNode.getOwner () === this) {
return sourceNode;
} else {
return targetNode;
}}, "org.ivis.layout.cise.CiSEEdge");
Clazz.defineMethod (c$, "getOtherEnd", 
function (edge) {
var sourceNode = edge.getSource ();
var targetNode = edge.getTarget ();
if (sourceNode.getOwner () === this) {
return targetNode;
} else {
return sourceNode;
}}, "org.ivis.layout.cise.CiSEEdge");
Clazz.defineMethod (c$, "calculateParentNodeDimension", 
function () {
var maxOnCircleNodeDimension = -2147483648;
var iterator = this.getOnCircleNodes ().iterator ();
while (iterator.hasNext ()) {
var node = iterator.next ();
if (node.getWidth () > maxOnCircleNodeDimension) {
maxOnCircleNodeDimension = node.getWidth ();
}if (node.getHeight () > maxOnCircleNodeDimension) {
maxOnCircleNodeDimension = node.getHeight ();
}}
var dimension = 2.0 * (this.radius + this.getMargin ()) + maxOnCircleNodeDimension;
var parentNode = this.getParent ();
parentNode.setHeight (dimension);
parentNode.setWidth (dimension);
});
Clazz.defineMethod (c$, "decomposeForce", 
function (node) {
var circularForce;
if (node.displacementX != 0.0 || node.displacementY != 0.0) {
var ownerNode = this.getParent ();
var Cx = ownerNode.getCenterX ();
var Cy = ownerNode.getCenterY ();
var Nx = node.getCenterX ();
var Ny = node.getCenterY ();
var Fx = node.displacementX;
var Fy = node.displacementY;
var C_angle = org.ivis.util.IGeometry.angleOfVector (Cx, Cy, Nx, Ny);
var F_angle = org.ivis.util.IGeometry.angleOfVector (0.0, 0.0, Fx, Fy);
var C_rev_angle = C_angle + 3.141592653589793;
var isRotationClockwise;
if (3.141592653589793 <= C_rev_angle && C_rev_angle < 6.283185307179586) {
if (C_angle <= F_angle && F_angle < C_rev_angle) {
isRotationClockwise = true;
} else {
isRotationClockwise = false;
}} else {
C_rev_angle -= 6.283185307179586;
if (C_rev_angle <= F_angle && F_angle < C_angle) {
isRotationClockwise = false;
} else {
isRotationClockwise = true;
}}var angle_diff = Math.abs (C_angle - F_angle);
var F_magnitude = Math.sqrt (Fx * Fx + Fy * Fy);
var R_magnitude = Math.abs (Math.sin (angle_diff) * F_magnitude);
if (!isRotationClockwise) {
R_magnitude = -R_magnitude;
}circularForce =  new org.ivis.layout.cise.CircularForce (R_magnitude, Fx, Fy);
} else {
circularForce =  new org.ivis.layout.cise.CircularForce (0.0, 0.0, 0.0);
}return circularForce;
}, "org.ivis.layout.cise.CiSENode");
Clazz.defineMethod (c$, "swapNodes", 
function (first, second) {
var smallIndexNode = first;
var bigIndexNode = second;
var firstExt = first.getOnCircleNodeExt ();
var secondExt = second.getOnCircleNodeExt ();
if (smallIndexNode.getOnCircleNodeExt ().getIndex () > second.getOnCircleNodeExt ().getIndex ()) {
smallIndexNode = second;
bigIndexNode = first;
}if (smallIndexNode.getOnCircleNodeExt ().getPrevNode () === bigIndexNode) {
var tempNode = bigIndexNode;
bigIndexNode = smallIndexNode;
smallIndexNode = tempNode;
}var smallIndexNodeExt = smallIndexNode.getOnCircleNodeExt ();
var bigIndexNodeExt = bigIndexNode.getOnCircleNodeExt ();
var smallIndexPrevNode = smallIndexNodeExt.getPrevNode ();
var layout = (this.getGraphManager ().getLayout ());
var nodeSeparation = layout.getNodeSeparation ();
var angle = (smallIndexPrevNode.getOnCircleNodeExt ().getAngle () + (smallIndexPrevNode.getHalfTheDiagonal () + bigIndexNode.getHalfTheDiagonal () + nodeSeparation) / this.radius) % (6.283185307179586);
bigIndexNodeExt.setAngle (angle);
angle = (bigIndexNodeExt.getAngle () + (bigIndexNode.getHalfTheDiagonal () + smallIndexNode.getHalfTheDiagonal () + nodeSeparation) / this.radius) % (6.283185307179586);
smallIndexNodeExt.setAngle (angle);
smallIndexNodeExt.updatePosition ();
bigIndexNodeExt.updatePosition ();
var tempIndex = firstExt.getIndex ();
firstExt.setIndex (secondExt.getIndex ());
secondExt.setIndex (tempIndex);
this.getOnCircleNodes ().set (firstExt.getIndex (), first);
this.getOnCircleNodes ().set (secondExt.getIndex (), second);
firstExt.updateSwappingConditions ();
secondExt.updateSwappingConditions ();
if (firstExt.getNextNode () === second) {
firstExt.getPrevNode ().getOnCircleNodeExt ().updateSwappingConditions ();
secondExt.getNextNode ().getOnCircleNodeExt ().updateSwappingConditions ();
} else {
firstExt.getNextNode ().getOnCircleNodeExt ().updateSwappingConditions ();
secondExt.getPrevNode ().getOnCircleNodeExt ().updateSwappingConditions ();
}}, "org.ivis.layout.cise.CiSENode,org.ivis.layout.cise.CiSENode");
Clazz.defineMethod (c$, "getIntraClusterEdges", 
function () {
if (this.intraClusterEdges == null) {
this.intraClusterEdges =  new java.util.ArrayList ();
var iterator = this.getEdges ().iterator ();
while (iterator.hasNext ()) {
var edge = iterator.next ();
if (edge.isIntraCluster) {
this.intraClusterEdges.add (edge);
}}
}return this.intraClusterEdges;
});
Clazz.defineMethod (c$, "getInterClusterEdges", 
function () {
if (this.interClusterEdges == null) {
this.interClusterEdges =  new java.util.ArrayList ();
var nodeIterator = this.outNodes.iterator ();
var node;
while (nodeIterator.hasNext ()) {
node = nodeIterator.next ();
this.interClusterEdges.addAll (node.getOnCircleNodeExt ().getInterClusterEdges ());
}
}return this.interClusterEdges;
});
Clazz.defineMethod (c$, "checkAndReverseIfReverseIsBetter", 
function () {
var interClusterEdges = this.getInterClusterEdges ();
var interClusterEdgeInfos =  new Array (interClusterEdges.size ());
var angle;
var clusterCenter = this.getParent ().getCenter ();
var interClusterEdge;
var endInThisCluster;
var endInOtherCluster;
var centerOfEndInOtherCluster;
var nodeCount = this.onCircleNodes.size ();
var interClusterEdgeDegree =  Clazz.newArray (nodeCount, 0);
var noOfOnCircleNodesToBeRepeated = 0;
for (var i = 0; i < interClusterEdges.size (); i++) {
interClusterEdge = interClusterEdges.get (i);
endInOtherCluster = this.getOtherEnd (interClusterEdge);
centerOfEndInOtherCluster = endInOtherCluster.getCenter ();
angle = org.ivis.util.IGeometry.angleOfVector (clusterCenter.x, clusterCenter.y, centerOfEndInOtherCluster.x, centerOfEndInOtherCluster.y);
interClusterEdgeInfos[i] =  new org.ivis.layout.cise.CiSEInterClusterEdgeInfo (interClusterEdge, angle);
endInThisCluster = this.getThisEnd (interClusterEdge);
interClusterEdgeDegree[endInThisCluster.getOnCircleNodeExt ().getIndex ()]++;
if (interClusterEdgeDegree[endInThisCluster.getOnCircleNodeExt ().getIndex ()] > 1) {
noOfOnCircleNodesToBeRepeated++;
}}
var onCircleNodes = this.onCircleNodes.toArray ();
var nodeCountWithRepetitions = nodeCount + noOfOnCircleNodesToBeRepeated;
var clusterNodes =  Clazz.newArray (2 * nodeCountWithRepetitions, '\0');
var reversedClusterNodes =  Clazz.newArray (2 * nodeCountWithRepetitions, '\0');
var node;
var index = -1;
for (var i = 0; i < nodeCount; i++) {
node = onCircleNodes[i];
if (interClusterEdgeDegree[i] == 0) {
interClusterEdgeDegree[i] = 1;
}for (var j = 0; j < interClusterEdgeDegree[i]; j++) {
index++;
clusterNodes[index] = String.fromCharCode (  (clusterNodes[nodeCountWithRepetitions + index] = String.fromCharCode (  (reversedClusterNodes[nodeCountWithRepetitions - 1 - index] = String.fromCharCode (  (reversedClusterNodes[2 * nodeCountWithRepetitions - 1 - index] = node.getOnCircleNodeExt ().getCharCode ()).charCodeAt (0))).charCodeAt (0))).charCodeAt (0));
}
}
var edgeSorter =  new org.ivis.layout.cise.CiSEInterClusterEdgeSort (this, interClusterEdgeInfos);
edgeSorter.quicksort ();
var neighborNodes =  Clazz.newArray (interClusterEdgeInfos.length, '\0');
for (var i = 0; i < interClusterEdgeInfos.length; i++) {
interClusterEdge = interClusterEdgeInfos[i].getEdge ();
endInThisCluster = this.getThisEnd (interClusterEdge);
neighborNodes[i] = endInThisCluster.getOnCircleNodeExt ().getCharCode ();
}
var alignmentScoreCurrent = this.computeAlignmentScore ( new java.io.CharArrayReader (clusterNodes),  new java.io.CharArrayReader (neighborNodes));
if (alignmentScoreCurrent != -1) {
var alignmentScoreReversed = this.computeAlignmentScore ( new java.io.CharArrayReader (reversedClusterNodes),  new java.io.CharArrayReader (neighborNodes));
if (alignmentScoreReversed != -1) {
if (alignmentScoreReversed > alignmentScoreCurrent) {
this.reverseNodes ();
this.setMayNotBeReversed ();
return true;
}}}return false;
});
c$.computeAlignmentScore = Clazz.defineMethod (c$, "computeAlignmentScore", 
function (charArrayReader1, charArrayReader2) {
var alignmentScore;
var aligner =  new org.ivis.util.alignment.NeedlemanWunsch ();
aligner.setScoringScheme ( new org.ivis.util.alignment.BasicScoringScheme (20, -1, -2));
try {
aligner.loadSequences (charArrayReader1, charArrayReader2);
} catch (e$$) {
if (Clazz.instanceOf (e$$, java.io.IOException)) {
var e = e$$;
{
System.err.println ("Caught IOException: " + e.getMessage ());
}
} else if (Clazz.instanceOf (e$$, org.ivis.util.alignment.InvalidSequenceException)) {
var e = e$$;
{
System.err.println ("Caught InvalidSequenceException: " + e.getMessage ());
}
} else {
throw e$$;
}
}
try {
aligner.getPairwiseAlignment ();
alignmentScore = aligner.getScore ();
} catch (e) {
if (Clazz.instanceOf (e, org.ivis.util.alignment.IncompatibleScoringSchemeException)) {
alignmentScore = -1;
} else {
throw e;
}
}
return alignmentScore;
}, "java.io.CharArrayReader,java.io.CharArrayReader");
Clazz.defineMethod (c$, "reverseNodes", 
function () {
var iterator = this.getOnCircleNodes ().iterator ();
var noOfNodesOnCircle = this.getOnCircleNodes ().size ();
var node;
var nodeExt;
while (iterator.hasNext ()) {
node = iterator.next ();
nodeExt = node.getOnCircleNodeExt ();
nodeExt.setIndex ((noOfNodesOnCircle - nodeExt.getIndex ()) % noOfNodesOnCircle);
}
this.reCalculateNodeAnglesAndPositions ();
});
Clazz.defineMethod (c$, "moveOnCircleNodeInside", 
function (node) {
this.onCircleNodes.remove (node);
this.inCircleNodes.add (node);
for (var i = 0; i < this.onCircleNodes.size (); i++) {
var onCircleNode = this.onCircleNodes.get (i);
onCircleNode.getOnCircleNodeExt ().setIndex (i);
}
node.setAsNonOnCircleNode ();
this.reCalculateCircleSizeAndRadius ();
this.reCalculateNodeAnglesAndPositions ();
node.setCenter (this.getParent ().getCenterX (), this.getParent ().getCenterY ());
}, "org.ivis.layout.cise.CiSENode");
Clazz.defineMethod (c$, "reCalculateCircleSizeAndRadius", 
function () {
var totalDiagonal = 0;
var iterator = this.getOnCircleNodes ().iterator ();
var temp;
while (iterator.hasNext ()) {
var node = iterator.next ();
temp = node.getWidth () * node.getWidth () + node.getHeight () * node.getHeight ();
totalDiagonal += Math.sqrt (temp);
}
var layout = (this.getGraphManager ().getLayout ());
var nodeSeparation = layout.getNodeSeparation ();
var perimeter = totalDiagonal + this.getOnCircleNodes ().size () * nodeSeparation;
this.radius = perimeter / (6.283185307179586);
this.calculateParentNodeDimension ();
});
Clazz.defineMethod (c$, "reCalculateNodeAnglesAndPositions", 
function () {
var layout = (this.getGraphManager ().getLayout ());
var nodeSeparation = layout.getNodeSeparation ();
var inOrderCopy = this.onCircleNodes;
 new org.ivis.layout.cise.CiSENodeSort (inOrderCopy).quicksort ();
var parentCenterX = this.getParent ().getCenterX ();
var parentCenterY = this.getParent ().getCenterY ();
for (var i = 0; i < inOrderCopy.size (); i++) {
var node = inOrderCopy.get (i);
var angle;
if (i == 0) {
angle = new Double (0.0);
} else {
var previousNode = inOrderCopy.get (i - 1);
angle = new Double (previousNode.getOnCircleNodeExt ().getAngle () + (node.getHalfTheDiagonal () + nodeSeparation + previousNode.getHalfTheDiagonal ()) / this.radius);
}node.getOnCircleNodeExt ().setAngle ((angle).doubleValue ());
node.setCenter (parentCenterX + this.radius * Math.cos ((angle).doubleValue ()), parentCenterY + this.radius * Math.sin ((angle).doubleValue ()));
}
});
c$.main = Clazz.defineMethod (c$, "main", 
function (args) {
var charArrayA = ['a', 'b', 'c', 'd', 'e', 'a', 'b', 'c', 'd', 'e'];
var charArrayB = ['c', 'b', 'd', 'c', 'b', 'd'];
org.ivis.layout.cise.CiSECircle.computeAlignmentScore ( new java.io.CharArrayReader (charArrayA),  new java.io.CharArrayReader (charArrayB));
}, "~A");
});
