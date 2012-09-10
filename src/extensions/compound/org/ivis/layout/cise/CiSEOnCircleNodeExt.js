Clazz.declarePackage ("org.ivis.layout.cise");
Clazz.load (null, "org.ivis.layout.cise.CiSEOnCircleNodeExt", ["java.util.ArrayList", "org.ivis.util.IGeometry"], function () {
c$ = Clazz.decorateAsClass (function () {
this.ciseNode = null;
this.intraClusterEdges = null;
this.interClusterEdges = null;
this.angle = -1;
this.orderIndex = -1;
this.$canSwapWithNext = false;
this.canSwapWithPrevious = false;
this.displacementForSwap = 0;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.cise, "CiSEOnCircleNodeExt");
Clazz.makeConstructor (c$, 
function (ciseNode) {
this.ciseNode = ciseNode;
}, "org.ivis.layout.cise.CiSENode");
Clazz.defineMethod (c$, "getCiSENode", 
function () {
return this.ciseNode;
});
Clazz.defineMethod (c$, "getAngle", 
function () {
return this.angle;
});
Clazz.defineMethod (c$, "setAngle", 
function (angle) {
this.angle = angle % 6.283185307179586;
if (this.angle < 0) {
this.angle += 6.283185307179586;
}}, "~N");
Clazz.defineMethod (c$, "getIndex", 
function () {
return this.orderIndex;
});
Clazz.defineMethod (c$, "setIndex", 
function (index) {
this.orderIndex = index;
}, "~N");
Clazz.defineMethod (c$, "getCharCode", 
function () {
var charCode;
if (this.orderIndex < 26) {
charCode = String.fromCharCode ((('a').charCodeAt (0) + this.orderIndex));
} else if (this.orderIndex < 52) {
charCode = String.fromCharCode ((('A').charCodeAt (0) + this.orderIndex - 26));
} else {
charCode = '?';
}return charCode;
});
Clazz.defineMethod (c$, "getNextNode", 
function () {
var circle = this.ciseNode.getOwner ();
var totalNodes = circle.getOnCircleNodes ().size ();
var nextNodeIndex = this.orderIndex + 1;
if (nextNodeIndex == totalNodes) {
nextNodeIndex = 0;
}return circle.getOnCircleNodes ().get (nextNodeIndex);
});
Clazz.defineMethod (c$, "getPrevNode", 
function () {
var circle = this.ciseNode.getOwner ();
var nextNodeIndex = this.orderIndex - 1;
if (nextNodeIndex == -1) {
nextNodeIndex = circle.getOnCircleNodes ().size () - 1;
}return circle.getOnCircleNodes ().get (nextNodeIndex);
});
Clazz.defineMethod (c$, "getNextNodeExt", 
function () {
return this.getNextNode ().getOnCircleNodeExt ();
});
Clazz.defineMethod (c$, "getPrevNodeExt", 
function () {
return this.getPrevNode ().getOnCircleNodeExt ();
});
Clazz.defineMethod (c$, "canSwapWithNext", 
function () {
return this.$canSwapWithNext;
});
Clazz.defineMethod (c$, "canSwapWithPrev", 
function () {
return this.canSwapWithPrevious;
});
Clazz.defineMethod (c$, "getDisplacementForSwap", 
function () {
return this.displacementForSwap;
});
Clazz.defineMethod (c$, "setDisplacementForSwap", 
function (displacementForSwap) {
this.displacementForSwap = displacementForSwap;
}, "~N");
Clazz.defineMethod (c$, "addDisplacementForSwap", 
function (displacementIncrForSwap) {
this.displacementForSwap = displacementIncrForSwap;
}, "~N");
Clazz.defineMethod (c$, "updatePosition", 
function () {
var ownerGraph = this.ciseNode.getOwner ();
var parentNode = ownerGraph.getParent ();
var parentX = parentNode.getCenterX ();
var parentY = parentNode.getCenterY ();
var xDifference = ownerGraph.getRadius () * Math.cos (this.angle);
var yDifference = ownerGraph.getRadius () * Math.sin (this.angle);
this.ciseNode.setCenter (parentX + xDifference, parentY + yDifference);
});
Clazz.defineMethod (c$, "getCircDistWithTheNode", 
function (refNode) {
var otherIndex = refNode.getIndex ();
if (otherIndex == -1 || this.getIndex () == -1) {
return -1;
}var diff = this.getIndex () - otherIndex;
if (diff < 0) {
diff += (this.ciseNode.getOwner ()).getOnCircleNodes ().size ();
}return diff;
}, "org.ivis.layout.cise.CiSEOnCircleNodeExt");
Clazz.defineMethod (c$, "calculateTotalCrossing", 
function () {
var iter = this.getIntraClusterEdges ().iterator ();
var count = 0;
var temp =  new java.util.ArrayList ();
temp.addAll ((this.ciseNode.getOwner ()).getIntraClusterEdges ());
temp.removeAll (this.ciseNode.getEdges ());
while (iter.hasNext ()) {
var edge = iter.next ();
count += edge.calculateTotalCrossingWithList (temp);
}
return count;
});
Clazz.defineMethod (c$, "updateSwappingConditions", 
function () {
var currentCrossingNumber = this.calculateTotalCrossing ();
var currentNodeIndex = this.orderIndex;
var nextNodeExt = this.getNextNode ().getOnCircleNodeExt ();
this.orderIndex = nextNodeExt.getIndex ();
nextNodeExt.setIndex (currentNodeIndex);
var tempCrossingNumber = this.calculateTotalCrossing ();
if (tempCrossingNumber > currentCrossingNumber) {
this.$canSwapWithNext = false;
} else {
this.$canSwapWithNext = true;
}nextNodeExt.setIndex (this.orderIndex);
this.setIndex (currentNodeIndex);
var prevNodeExt = this.getPrevNode ().getOnCircleNodeExt ();
this.orderIndex = prevNodeExt.getIndex ();
prevNodeExt.setIndex (currentNodeIndex);
tempCrossingNumber = this.calculateTotalCrossing ();
if (tempCrossingNumber > currentCrossingNumber) {
this.canSwapWithPrevious = false;
} else {
this.canSwapWithPrevious = true;
}prevNodeExt.setIndex (this.orderIndex);
this.setIndex (currentNodeIndex);
});
Clazz.defineMethod (c$, "swapWith", 
function (neighborExt) {
(this.ciseNode.getOwner ()).swapNodes (this.ciseNode, neighborExt.ciseNode);
}, "org.ivis.layout.cise.CiSEOnCircleNodeExt");
Clazz.defineMethod (c$, "getInterClusterIntersections", 
function (other) {
var count = 0;
var thisInterClusterEdges = this.getInterClusterEdges ();
var otherInterClusterEdges = other.getInterClusterEdges ();
var iter1 = thisInterClusterEdges.iterator ();
while (iter1.hasNext ()) {
var edge = iter1.next ();
var point1 = this.ciseNode.getCenter ();
var point2 = edge.getOtherEnd (this.ciseNode).getCenter ();
var iter2 = otherInterClusterEdges.iterator ();
while (iter2.hasNext ()) {
var otherEdge = iter2.next ();
var point3 = other.ciseNode.getCenter ();
var point4 = otherEdge.getOtherEnd (other.ciseNode).getCenter ();
if (edge.getOtherEnd (this.ciseNode) !== otherEdge.getOtherEnd (other.ciseNode)) {
var result = org.ivis.util.IGeometry.doIntersect (point1, point2, point3, point4);
if (result) {
count++;
}}}
}
return count;
}, "org.ivis.layout.cise.CiSEOnCircleNodeExt");
Clazz.defineMethod (c$, "getInterClusterEdges", 
function () {
if (this.interClusterEdges == null) {
this.interClusterEdges =  new java.util.ArrayList ();
var iterator = this.ciseNode.getEdges ().iterator ();
while (iterator.hasNext ()) {
var edge = iterator.next ();
if (!edge.isIntraCluster) {
this.interClusterEdges.add (edge);
}}
}return this.interClusterEdges;
});
Clazz.defineMethod (c$, "getIntraClusterEdges", 
function () {
if (this.intraClusterEdges == null) {
this.intraClusterEdges =  new java.util.ArrayList ();
var iterator = this.ciseNode.getEdges ().iterator ();
while (iterator.hasNext ()) {
var edge = iterator.next ();
if (edge.isIntraCluster) {
this.intraClusterEdges.add (edge);
}}
}return this.intraClusterEdges;
});
});
