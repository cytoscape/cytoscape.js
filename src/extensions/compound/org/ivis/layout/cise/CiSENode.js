Clazz.declarePackage ("org.ivis.layout.cise");
Clazz.load (["org.ivis.layout.fd.FDLayoutNode"], "org.ivis.layout.cise.CiSENode", ["org.ivis.layout.cise.CiSEOnCircleNodeExt", "org.ivis.util.IMath"], function () {
c$ = Clazz.decorateAsClass (function () {
this.rotationAmount = 0;
this.onCircleNodeExt = null;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.cise, "CiSENode", org.ivis.layout.fd.FDLayoutNode);
Clazz.makeConstructor (c$, 
function (gm, vNode) {
Clazz.superConstructor (this, org.ivis.layout.cise.CiSENode, [gm, vNode]);
this.onCircleNodeExt = null;
}, "org.ivis.layout.LGraphManager,~O");
Clazz.makeConstructor (c$, 
function (gm, loc, size, vNode) {
Clazz.superConstructor (this, org.ivis.layout.cise.CiSENode, [gm, loc, size, vNode]);
this.onCircleNodeExt = null;
}, "org.ivis.layout.LGraphManager,newawt.Point,newawt.Dimension,~O");
Clazz.defineMethod (c$, "getLimitedDisplacement", 
function (displacement) {
if (Math.abs (displacement) > 300.0) {
displacement = 300.0 * org.ivis.util.IMath.sign (displacement);
}return displacement;
}, "~N");
Clazz.defineMethod (c$, "getOnCircleNodeExt", 
function () {
return this.onCircleNodeExt;
});
Clazz.defineMethod (c$, "getOnCircleNeighbors", 
function () {
var neighbors = this.getNeighborsList ();
var neighborIterator = neighbors.iterator ();
while (neighborIterator.hasNext ()) {
var neighbor = neighborIterator.next ();
if (neighbor.getOnCircleNodeExt () == null || !neighbor.getClusterID ().equals (this.getClusterID ())) {
neighborIterator.remove ();
}}
return neighbors;
});
Clazz.defineMethod (c$, "setAsOnCircleNode", 
function () {
this.onCircleNodeExt =  new org.ivis.layout.cise.CiSEOnCircleNodeExt (this);
return this.onCircleNodeExt;
});
Clazz.defineMethod (c$, "setAsNonOnCircleNode", 
function () {
this.onCircleNodeExt = null;
});
Clazz.overrideMethod (c$, "move", 
function () {
var layout = this.getOwner ().getGraphManager ().getLayout ();
this.displacementX = this.getLimitedDisplacement (this.displacementX);
this.displacementY = this.getLimitedDisplacement (this.displacementY);
if (this.getChild () != null) {
var noOfNodesOnCircle = this.getChild ().getNodes ().size ();
this.displacementX /= noOfNodesOnCircle;
this.displacementY /= noOfNodesOnCircle;
var iter = this.getChild ().getNodes ().iterator ();
while (iter.hasNext ()) {
var node = iter.next ();
node.moveBy (this.displacementX, this.displacementY);
layout.totalDisplacement += Math.abs (this.displacementX) + Math.abs (this.displacementY);
}
}this.moveBy (this.displacementX, this.displacementY);
layout.totalDisplacement += Math.abs (this.displacementX) + Math.abs (this.displacementY);
if (this.getChild () != null) {
this.getChild ().updateBounds (true);
}this.displacementX = 0.0;
this.displacementY = 0.0;
});
});
