Clazz.declarePackage ("org.ivis.layout.fd");
Clazz.load (["org.ivis.layout.Layout"], "org.ivis.layout.fd.FDLayout", ["java.util.HashSet", "$.Vector", "org.ivis.layout.LayoutOptionsPack", "org.ivis.util.IGeometry", "$.IMath", "$.RectangleD"], function () {
c$ = Clazz.decorateAsClass (function () {
this.useSmartIdealEdgeLengthCalculation = true;
this.idealEdgeLength = 50;
this.springConstant = 0.45;
this.repulsionConstant = 4500.0;
this.gravityConstant = 0.4;
this.compoundGravityConstant = 1.0;
this.gravityRangeFactor = 2.0;
this.compoundGravityRangeFactor = 1.5;
this.displacementThresholdPerNode = 1.5;
this.useFRGridVariant = true;
this.coolingFactor = 1.0;
this.initialCoolingFactor = 1.0;
this.totalDisplacement = 0.0;
this.oldTotalDisplacement = 0.0;
this.maxIterations = 2500;
this.totalIterations = 0;
this.notAnimatedIterations = 0;
this.totalDisplacementThreshold = 0;
this.maxNodeDisplacement = 0;
this.repulsionRange = 0;
this.grid = null;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.fd, "FDLayout", org.ivis.layout.Layout);
Clazz.defineMethod (c$, "initParameters", 
function () {
Clazz.superCall (this, org.ivis.layout.fd.FDLayout, "initParameters", []);
var layoutOptionsPack = org.ivis.layout.LayoutOptionsPack.getInstance ().getCoSE ();
if (this.layoutQuality == 2) {
this.displacementThresholdPerNode += 0.30;
this.maxIterations *= 0.8;
} else if (this.layoutQuality == 0) {
this.displacementThresholdPerNode -= 0.30;
this.maxIterations *= 1.2;
}this.totalIterations = 0;
this.notAnimatedIterations = 0;
this.useFRGridVariant = layoutOptionsPack.isSmartRepulsionRangeCalc ();
});
Clazz.defineMethod (c$, "calcIdealEdgeLengths", 
function () {
var edge;
var lcaDepth;
var source;
var target;
var sizeOfSourceInLca;
var sizeOfTargetInLca;
for (var obj, $obj = 0, $$obj = this.graphManager.getAllEdges (); $obj < $$obj.length && ((obj = $$obj[$obj]) || true); $obj++) {
edge = obj;
edge.idealLength = this.idealEdgeLength;
if (edge.isInterGraph ()) {
source = edge.getSource ();
target = edge.getTarget ();
sizeOfSourceInLca = edge.getSourceInLca ().getEstimatedSize ();
sizeOfTargetInLca = edge.getTargetInLca ().getEstimatedSize ();
if (this.useSmartIdealEdgeLengthCalculation) {
edge.idealLength += sizeOfSourceInLca + sizeOfTargetInLca - 80;
}lcaDepth = edge.getLca ().getInclusionTreeDepth ();
edge.idealLength += 50 * 0.1 * (source.getInclusionTreeDepth () + target.getInclusionTreeDepth () - 2 * lcaDepth);
}}
});
Clazz.defineMethod (c$, "initSpringEmbedder", 
function () {
if (this.incremental) {
this.coolingFactor = 0.8;
this.initialCoolingFactor = 0.8;
this.maxNodeDisplacement = 100.0;
} else {
this.coolingFactor = 1.0;
this.initialCoolingFactor = 1.0;
this.maxNodeDisplacement = 300.0;
}this.maxIterations = Math.max (this.getAllNodes ().length * 5, this.maxIterations);
this.totalDisplacementThreshold = this.displacementThresholdPerNode * this.getAllNodes ().length;
this.repulsionRange = this.calcRepulsionRange ();
});
Clazz.defineMethod (c$, "calcSpringForces", 
function () {
var lEdges = this.getAllEdges ();
var edge;
for (var i = 0; i < lEdges.length; i++) {
edge = lEdges[i];
this.calcSpringForce (edge, edge.idealLength);
}
});
Clazz.defineMethod (c$, "calcRepulsionForces", 
function () {
var i;
var j;
var nodeA;
var nodeB;
var lNodes = this.getAllNodes ();
var processedNodeSet;
if (this.useFRGridVariant) {
if (this.totalIterations % 10 == 1) {
this.grid = this.calcGrid (this.graphManager.getRoot ());
for (i = 0; i < lNodes.length; i++) {
nodeA = lNodes[i];
this.addNodeToGrid (nodeA, this.grid, this.graphManager.getRoot ().getLeft (), this.graphManager.getRoot ().getTop ());
}
}processedNodeSet =  new java.util.HashSet ();
for (i = 0; i < lNodes.length; i++) {
nodeA = lNodes[i];
this.calculateRepulsionForceOfANode (this.grid, nodeA, processedNodeSet);
processedNodeSet.add (nodeA);
}
} else {
for (i = 0; i < lNodes.length; i++) {
nodeA = lNodes[i];
for (j = i + 1; j < lNodes.length; j++) {
nodeB = lNodes[j];
if (nodeA.getOwner () !== nodeB.getOwner ()) {
continue ;}this.calcRepulsionForce (nodeA, nodeB);
}
}
}});
Clazz.defineMethod (c$, "calcGravitationalForces", 
function () {
var node;
var lNodes = this.getAllNodesToApplyGravitation ();
for (var i = 0; i < lNodes.length; i++) {
node = lNodes[i];
this.calcGravitationalForce (node);
}
});
Clazz.defineMethod (c$, "moveNodes", 
function () {
var lNodes = this.getAllNodes ();
var node;
for (var i = 0; i < lNodes.length; i++) {
node = lNodes[i];
node.move ();
}
});
Clazz.defineMethod (c$, "calcSpringForce", 
function (edge, idealLength) {
var sourceNode = edge.getSource ();
var targetNode = edge.getTarget ();
var length;
var springForce;
var springForceX;
var springForceY;
if (this.uniformLeafNodeSizes && sourceNode.getChild () == null && targetNode.getChild () == null) {
edge.updateLengthSimple ();
} else {
edge.updateLength ();
if (edge.isOverlapingSourceAndTarget ()) {
return ;
}}length = edge.getLength ();
springForce = this.springConstant * (length - idealLength);
springForceX = springForce * (edge.getLengthX () / length);
springForceY = springForce * (edge.getLengthY () / length);
sourceNode.springForceX += springForceX;
sourceNode.springForceY += springForceY;
targetNode.springForceX -= springForceX;
targetNode.springForceY -= springForceY;
}, "org.ivis.layout.LEdge,~N");
Clazz.defineMethod (c$, "calcRepulsionForce", 
function (nodeA, nodeB) {
var rectA = nodeA.getRect ();
var rectB = nodeB.getRect ();
var overlapAmount =  Clazz.newArray (2, 0);
var clipPoints =  Clazz.newArray (4, 0);
var distanceX;
var distanceY;
var distanceSquared;
var distance;
var repulsionForce;
var repulsionForceX;
var repulsionForceY;
if (rectA.intersects (rectB)) {
org.ivis.util.IGeometry.calcSeparationAmount (rectA, rectB, overlapAmount, 25.0);
repulsionForceX = overlapAmount[0];
repulsionForceY = overlapAmount[1];
} else {
if (this.uniformLeafNodeSizes && nodeA.getChild () == null && nodeB.getChild () == null) {
distanceX = rectB.getCenterX () - rectA.getCenterX ();
distanceY = rectB.getCenterY () - rectA.getCenterY ();
} else {
org.ivis.util.IGeometry.getIntersection (rectA, rectB, clipPoints);
distanceX = clipPoints[2] - clipPoints[0];
distanceY = clipPoints[3] - clipPoints[1];
}if (Math.abs (distanceX) < 5.0) {
distanceX = org.ivis.util.IMath.sign (distanceX) * 5.0;
}if (Math.abs (distanceY) < 5.0) {
distanceY = org.ivis.util.IMath.sign (distanceY) * 5.0;
}distanceSquared = distanceX * distanceX + distanceY * distanceY;
distance = Math.sqrt (distanceSquared);
repulsionForce = this.repulsionConstant / distanceSquared;
repulsionForceX = repulsionForce * distanceX / distance;
repulsionForceY = repulsionForce * distanceY / distance;
}nodeA.repulsionForceX -= repulsionForceX;
nodeA.repulsionForceY -= repulsionForceY;
nodeB.repulsionForceX += repulsionForceX;
nodeB.repulsionForceY += repulsionForceY;
}, "org.ivis.layout.fd.FDLayoutNode,org.ivis.layout.fd.FDLayoutNode");
Clazz.defineMethod (c$, "calcGravitationalForce", 
function (node) {
var ownerGraph;
var ownerCenterX;
var ownerCenterY;
var distanceX;
var distanceY;
var absDistanceX;
var absDistanceY;
var estimatedSize;
ownerGraph = node.getOwner ();
ownerCenterX = (ownerGraph.getRight () + ownerGraph.getLeft ()) / 2;
ownerCenterY = (ownerGraph.getTop () + ownerGraph.getBottom ()) / 2;
distanceX = node.getCenterX () - ownerCenterX;
distanceY = node.getCenterY () - ownerCenterY;
absDistanceX = Math.abs (distanceX);
absDistanceY = Math.abs (distanceY);
if (node.getOwner () === this.graphManager.getRoot ()) {
estimatedSize = Math.round ((ownerGraph.getEstimatedSize () * this.gravityRangeFactor));
if (absDistanceX > estimatedSize || absDistanceY > estimatedSize) {
node.gravitationForceX = -this.gravityConstant * distanceX;
node.gravitationForceY = -this.gravityConstant * distanceY;
}} else {
estimatedSize = Math.round ((ownerGraph.getEstimatedSize () * this.compoundGravityRangeFactor));
if (absDistanceX > estimatedSize || absDistanceY > estimatedSize) {
node.gravitationForceX = -this.gravityConstant * distanceX * this.compoundGravityConstant;
node.gravitationForceY = -this.gravityConstant * distanceY * this.compoundGravityConstant;
}}}, "org.ivis.layout.fd.FDLayoutNode");
Clazz.defineMethod (c$, "isConverged", 
function () {
var converged;
var oscilating = false;
if (this.totalIterations > Math.floor (this.maxIterations / 3)) {
oscilating = Math.abs (this.totalDisplacement - this.oldTotalDisplacement) < 2;
}converged = this.totalDisplacement < this.totalDisplacementThreshold;
this.oldTotalDisplacement = this.totalDisplacement;
return converged || oscilating;
});
Clazz.defineMethod (c$, "animate", 
function () {
if (this.animationDuringLayout && !this.isSubLayout) {
if (this.notAnimatedIterations == this.animationPeriod) {
this.update ();
this.notAnimatedIterations = 0;
} else {
this.notAnimatedIterations++;
}}});
Clazz.defineMethod (c$, "calcGrid", 
($fz = function (g) {
var i;
var j;
var grid;
var sizeX = 0;
var sizeY = 0;
sizeX = Math.round (Math.ceil ((g.getRight () - g.getLeft ()) / this.repulsionRange));
sizeY = Math.round (Math.ceil ((g.getBottom () - g.getTop ()) / this.repulsionRange));
grid =  Clazz.newArray (sizeX, sizeY, null);
for (i = 0; i < sizeX; i++) {
for (j = 0; j < sizeY; j++) {
grid[i][j] =  new java.util.Vector ();
}
}
return grid;
}, $fz.isPrivate = true, $fz), "org.ivis.layout.LGraph");
Clazz.defineMethod (c$, "addNodeToGrid", 
($fz = function (v, grid, left, top) {
var startX = 0;
var finishX = 0;
var startY = 0;
var finishY = 0;
startX = Math.round (Math.floor ((v.getRect ().x - left) / this.repulsionRange));
finishX = Math.round (Math.floor ((v.getRect ().width + v.getRect ().x - left) / this.repulsionRange));
startY = Math.round (Math.floor ((v.getRect ().y - top) / this.repulsionRange));
finishY = Math.round (Math.floor ((v.getRect ().height + v.getRect ().y - top) / this.repulsionRange));
for (var i = startX; i <= finishX; i++) {
for (var j = startY; j <= finishY; j++) {
grid[i][j].add (v);
v.setGridCoordinates (startX, finishX, startY, finishY);
}
}
}, $fz.isPrivate = true, $fz), "org.ivis.layout.fd.FDLayoutNode,~A,~N,~N");
Clazz.defineMethod (c$, "calculateRepulsionForceOfANode", 
($fz = function (grid, nodeA, processedNodeSet) {
var i;
var j;
if (this.totalIterations % 10 == 1) {
var surrounding =  new java.util.HashSet ();
var nodeB;
for (i = (nodeA.startX - 1); i < (nodeA.finishX + 2); i++) {
for (j = (nodeA.startY - 1); j < (nodeA.finishY + 2); j++) {
if (!((i < 0) || (j < 0) || (i >= grid.length) || (j >= grid[0].length))) {
for (var obj, $obj = grid[i][j].iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
nodeB = obj;
if ((nodeA.getOwner () !== nodeB.getOwner ()) || (nodeA === nodeB)) {
continue ;}if (!processedNodeSet.contains (nodeB) && !surrounding.contains (nodeB)) {
var distanceX = Math.abs (nodeA.getCenterX () - nodeB.getCenterX ()) - ((nodeA.getWidth () / 2) + (nodeB.getWidth () / 2));
var distanceY = Math.abs (nodeA.getCenterY () - nodeB.getCenterY ()) - ((nodeA.getHeight () / 2) + (nodeB.getHeight () / 2));
if ((distanceX <= this.repulsionRange) && (distanceY <= this.repulsionRange)) {
surrounding.add (nodeB);
}}}
}}
}
nodeA.surrounding = surrounding.toArray ();
}for (i = 0; i < nodeA.surrounding.length; i++) {
this.calcRepulsionForce (nodeA, nodeA.surrounding[i]);
}
}, $fz.isPrivate = true, $fz), "~A,org.ivis.layout.fd.FDLayoutNode,java.util.HashSet");
Clazz.defineMethod (c$, "calcRepulsionRange", 
function () {
return 0.0;
});
});
