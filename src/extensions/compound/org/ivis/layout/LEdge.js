Clazz.declarePackage ("org.ivis.layout");
Clazz.load (["org.ivis.layout.LGraphObject"], "org.ivis.layout.LEdge", ["java.lang.IllegalArgumentException", "java.util.ArrayList", "org.ivis.util.IGeometry", "$.IMath"], function () {
c$ = Clazz.decorateAsClass (function () {
this.source = null;
this.target = null;
this.$isInterGraph = false;
this.length = 0;
this.lengthX = 0;
this.lengthY = 0;
this.$isOverlapingSourceAndTarget = false;
this.bendpoints = null;
this.lca = null;
this.sourceInLca = null;
this.targetInLca = null;
Clazz.instantialize (this, arguments);
}, org.ivis.layout, "LEdge", org.ivis.layout.LGraphObject);
Clazz.makeConstructor (c$, 
function (source, target, vEdge) {
Clazz.superConstructor (this, org.ivis.layout.LEdge, [vEdge]);
this.bendpoints =  new java.util.ArrayList ();
this.source = source;
this.target = target;
}, "org.ivis.layout.LNode,org.ivis.layout.LNode,~O");
Clazz.defineMethod (c$, "getSource", 
function () {
return this.source;
});
Clazz.defineMethod (c$, "getTarget", 
function () {
return this.target;
});
Clazz.defineMethod (c$, "isInterGraph", 
function () {
return this.$isInterGraph;
});
Clazz.defineMethod (c$, "getLength", 
function () {
return this.length;
});
Clazz.defineMethod (c$, "getLengthX", 
function () {
return this.lengthX;
});
Clazz.defineMethod (c$, "getLengthY", 
function () {
return this.lengthY;
});
Clazz.defineMethod (c$, "isOverlapingSourceAndTarget", 
function () {
return this.$isOverlapingSourceAndTarget;
});
Clazz.defineMethod (c$, "resetOverlapingSourceAndTarget", 
function () {
this.$isOverlapingSourceAndTarget = false;
});
Clazz.defineMethod (c$, "getBendpoints", 
function () {
return this.bendpoints;
});
Clazz.defineMethod (c$, "reRoute", 
function (bendPoints) {
this.bendpoints.clear ();
this.bendpoints.addAll (bendPoints);
}, "java.util.List");
Clazz.defineMethod (c$, "getLca", 
function () {
return this.lca;
});
Clazz.defineMethod (c$, "getSourceInLca", 
function () {
return this.sourceInLca;
});
Clazz.defineMethod (c$, "getTargetInLca", 
function () {
return this.targetInLca;
});
Clazz.defineMethod (c$, "getOtherEnd", 
function (node) {
if (this.source.equals (node)) {
return this.target;
} else if (this.target.equals (node)) {
return this.source;
} else {
throw  new IllegalArgumentException ("Node is not incident with this edge");
}}, "org.ivis.layout.LNode");
Clazz.defineMethod (c$, "getOtherEndInGraph", 
function (node, graph) {
var otherEnd = this.getOtherEnd (node);
var root = graph.getGraphManager ().getRoot ();
while (true) {
if (otherEnd.getOwner () === graph) {
return otherEnd;
}if (otherEnd.getOwner () === root) {
break;
}otherEnd = otherEnd.getOwner ().getParent ();
}
return null;
}, "org.ivis.layout.LNode,org.ivis.layout.LGraph");
Clazz.defineMethod (c$, "updateLength", 
function () {
var clipPointCoordinates =  Clazz.newArray (4, 0);
this.$isOverlapingSourceAndTarget = org.ivis.util.IGeometry.getIntersection (this.target.getRect (), this.source.getRect (), clipPointCoordinates);
if (!this.$isOverlapingSourceAndTarget) {
this.lengthX = clipPointCoordinates[0] - clipPointCoordinates[2];
this.lengthY = clipPointCoordinates[1] - clipPointCoordinates[3];
if (Math.abs (this.lengthX) < 1.0) {
this.lengthX = org.ivis.util.IMath.sign (this.lengthX);
}if (Math.abs (this.lengthY) < 1.0) {
this.lengthY = org.ivis.util.IMath.sign (this.lengthY);
}this.length = Math.sqrt (this.lengthX * this.lengthX + this.lengthY * this.lengthY);
}});
Clazz.defineMethod (c$, "updateLengthSimple", 
function () {
this.lengthX = this.target.getCenterX () - this.source.getCenterX ();
this.lengthY = this.target.getCenterY () - this.source.getCenterY ();
if (Math.abs (this.lengthX) < 1.0) {
this.lengthX = org.ivis.util.IMath.sign (this.lengthX);
}if (Math.abs (this.lengthY) < 1.0) {
this.lengthY = org.ivis.util.IMath.sign (this.lengthY);
}this.length = Math.sqrt (this.lengthX * this.lengthX + this.lengthY * this.lengthY);
});
Clazz.defineMethod (c$, "printTopology", 
function () {
System.out.print ((this.label == null ? "?" : this.label) + "[" + (this.source.label == null ? "?" : this.source.label) + "-" + (this.target.label == null ? "?" : this.target.label) + "] ");
});
});
