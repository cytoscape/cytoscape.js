Clazz.declarePackage ("org.ivis.layout.cise");
Clazz.load (["org.ivis.layout.fd.FDLayoutEdge"], "org.ivis.layout.cise.CiSEEdge", null, function () {
c$ = Clazz.decorateAsClass (function () {
this.isIntraCluster = false;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.cise, "CiSEEdge", org.ivis.layout.fd.FDLayoutEdge);
Clazz.makeConstructor (c$, 
function (source, target, vEdge) {
Clazz.superConstructor (this, org.ivis.layout.cise.CiSEEdge, [source, target, vEdge]);
this.isIntraCluster = true;
}, "org.ivis.layout.LNode,org.ivis.layout.LNode,~O");
Clazz.defineMethod (c$, "crossesWithEdge", 
function (other) {
var result = false;
var sourceExt = (this.source).getOnCircleNodeExt ();
var targetExt = (this.target).getOnCircleNodeExt ();
var otherSourceExt = (other.source).getOnCircleNodeExt ();
var otherTargetExt = (other.target).getOnCircleNodeExt ();
var sourcePos = -1;
var targetPos = -1;
var otherSourcePos = -1;
var otherTargetPos = -1;
if (sourceExt != null) {
sourcePos = sourceExt.getIndex ();
}if (targetExt != null) {
targetPos = targetExt.getIndex ();
}if (otherSourceExt != null) {
otherSourcePos = otherSourceExt.getIndex ();
}if (otherTargetExt != null) {
otherTargetPos = otherTargetExt.getIndex ();
}if (!this.$isInterGraph && !other.$isInterGraph) {
if (this.source.getOwner () !== this.target.getOwner ()) {
result = false;
} else {
if (sourcePos == -1 || targetPos == -1 || otherSourcePos == -1 || otherTargetPos == -1) {
result = false;
}var otherSourceDist = otherSourceExt.getCircDistWithTheNode (sourceExt);
var otherTargetDist = otherTargetExt.getCircDistWithTheNode (sourceExt);
var thisTargetDist = targetExt.getCircDistWithTheNode (sourceExt);
if (thisTargetDist < Math.max (otherSourceDist, otherTargetDist) && thisTargetDist > Math.min (otherSourceDist, otherTargetDist) && otherTargetDist != 0 && otherSourceDist != 0) {
result = true;
}}} else {
result = true;
}return result;
}, "org.ivis.layout.cise.CiSEEdge");
Clazz.defineMethod (c$, "calculateTotalCrossingWithList", 
function (edgeList) {
var totalCrossing = 0;
var iter = edgeList.iterator ();
while (iter.hasNext ()) {
var edge = iter.next ();
totalCrossing += this.crossingWithEdge (edge);
}
return totalCrossing;
}, "java.util.List");
Clazz.defineMethod (c$, "crossingWithEdge", 
function (other) {
var crosses = this.crossesWithEdge (other);
var result = 0;
if (crosses) {
result = 1;
}return result;
}, "org.ivis.layout.cise.CiSEEdge");
});
