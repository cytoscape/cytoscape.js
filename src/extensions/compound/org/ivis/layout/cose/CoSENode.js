Clazz.declarePackage ("org.ivis.layout.cose");
Clazz.load (["org.ivis.layout.fd.FDLayoutNode"], "org.ivis.layout.cose.CoSENode", ["org.ivis.util.IMath"], function () {
c$ = Clazz.decorateAsClass (function () {
this.pred1 = null;
this.pred2 = null;
this.next = null;
this.processed = false;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.cose, "CoSENode", org.ivis.layout.fd.FDLayoutNode);
Clazz.overrideMethod (c$, "move", 
function () {
var layout = this.graphManager.getLayout ();
this.displacementX = layout.coolingFactor * (this.springForceX + this.repulsionForceX + this.gravitationForceX);
this.displacementY = layout.coolingFactor * (this.springForceY + this.repulsionForceY + this.gravitationForceY);
if (Math.abs (this.displacementX) > layout.maxNodeDisplacement) {
this.displacementX = layout.maxNodeDisplacement * org.ivis.util.IMath.sign (this.displacementX);
}if (Math.abs (this.displacementY) > layout.maxNodeDisplacement) {
this.displacementY = layout.maxNodeDisplacement * org.ivis.util.IMath.sign (this.displacementY);
}if (this.child == null) {
this.moveBy (this.displacementX, this.displacementY);
} else if (this.child.getNodes ().size () == 0) {
this.moveBy (this.displacementX, this.displacementY);
} else {
this.propogateDisplacementToChildren (this.displacementX, this.displacementY);
}layout.totalDisplacement += Math.abs (this.displacementX) + Math.abs (this.displacementY);
this.springForceX = 0;
this.springForceY = 0;
this.repulsionForceX = 0;
this.repulsionForceY = 0;
this.gravitationForceX = 0;
this.gravitationForceY = 0;
this.displacementX = 0;
this.displacementY = 0;
});
Clazz.defineMethod (c$, "propogateDisplacementToChildren", 
function (dX, dY) {
var nodeIter = this.getChild ().getNodes ().iterator ();
while (nodeIter.hasNext ()) {
var lNode = nodeIter.next ();
if (lNode.getChild () == null) {
lNode.moveBy (dX, dY);
lNode.displacementX += dX;
lNode.displacementY += dY;
} else {
lNode.propogateDisplacementToChildren (dX, dY);
}}
}, "~N,~N");
Clazz.defineMethod (c$, "setPred1", 
function (pred1) {
this.pred1 = pred1;
}, "org.ivis.layout.cose.CoSENode");
Clazz.defineMethod (c$, "getPred1", 
function () {
return this.pred1;
});
Clazz.defineMethod (c$, "setPred2", 
function (pred2) {
this.pred2 = pred2;
}, "org.ivis.layout.cose.CoSENode");
Clazz.defineMethod (c$, "getPred2", 
function () {
return this.pred2;
});
Clazz.defineMethod (c$, "setNext", 
function (next) {
this.next = next;
}, "org.ivis.layout.cose.CoSENode");
Clazz.defineMethod (c$, "getNext", 
function () {
return this.next;
});
Clazz.defineMethod (c$, "setProcessed", 
function (processed) {
this.processed = processed;
}, "~B");
Clazz.defineMethod (c$, "isProcessed", 
function () {
return this.processed;
});
});
