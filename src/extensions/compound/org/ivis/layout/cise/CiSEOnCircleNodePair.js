Clazz.declarePackage ("org.ivis.layout.cise");
c$ = Clazz.decorateAsClass (function () {
this.firstNode = null;
this.secondNode = null;
this.discrepancy = 0;
this.$inSameDirection = false;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.cise, "CiSEOnCircleNodePair", null, Comparable);
Clazz.makeConstructor (c$, 
function (first, second, displacement, inSameDirection) {
this.firstNode = first;
this.secondNode = second;
this.discrepancy = displacement;
this.$inSameDirection = inSameDirection;
}, "org.ivis.layout.cise.CiSENode,org.ivis.layout.cise.CiSENode,~N,~B");
Clazz.defineMethod (c$, "getDiscrepancy", 
function () {
return this.discrepancy;
});
Clazz.defineMethod (c$, "inSameDirection", 
function () {
return this.$inSameDirection;
});
Clazz.defineMethod (c$, "getFirstNode", 
function () {
return this.firstNode;
});
Clazz.defineMethod (c$, "getSecondNode", 
function () {
return this.secondNode;
});
Clazz.overrideMethod (c$, "compareTo", 
function (other) {
return Math.round ((this.getDiscrepancy () - other.getDiscrepancy ()));
}, "org.ivis.layout.cise.CiSEOnCircleNodePair");
Clazz.defineMethod (c$, "swap", 
function () {
this.getFirstNode ().getOnCircleNodeExt ().swapWith (this.getSecondNode ().getOnCircleNodeExt ());
});
Clazz.defineMethod (c$, "equals", 
function (other) {
var result = Clazz.instanceOf (other, org.ivis.layout.cise.CiSEOnCircleNodePair);
if (result) {
var pair = other;
result = new Boolean (result & ((this.firstNode.equals (pair.getFirstNode ()) && this.secondNode.equals (pair.getSecondNode ())) || (this.secondNode.equals (pair.getFirstNode ()) && this.firstNode.equals (pair.getSecondNode ())))).valueOf ();
}return result;
}, "~O");
Clazz.defineMethod (c$, "hashCode", 
function () {
return this.firstNode.hashCode () + this.secondNode.hashCode ();
});
Clazz.overrideMethod (c$, "toString", 
function () {
var result = "Swap: " + this.getFirstNode ().label;
result += "<->" + this.getSecondNode ().label;
result += ", " + this.getDiscrepancy ();
return result;
});
