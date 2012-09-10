Clazz.declarePackage ("org.ivis.layout.cose");
Clazz.load (["org.ivis.layout.LNode"], "org.ivis.layout.cose.CoarseningNode", null, function () {
c$ = Clazz.decorateAsClass (function () {
this.reference = null;
this.node1 = null;
this.node2 = null;
this.matched = false;
this.weight = 0;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.cose, "CoarseningNode", org.ivis.layout.LNode);
Clazz.makeConstructor (c$, 
function (gm, vNode) {
Clazz.superConstructor (this, org.ivis.layout.cose.CoarseningNode, [gm, vNode]);
this.weight = 1;
}, "org.ivis.layout.LGraphManager,~O");
Clazz.makeConstructor (c$, 
function () {
this.construct (null, null);
});
Clazz.defineMethod (c$, "setMatched", 
function (matched) {
this.matched = matched;
}, "~B");
Clazz.defineMethod (c$, "isMatched", 
function () {
return this.matched;
});
Clazz.defineMethod (c$, "setWeight", 
function (weight) {
this.weight = weight;
}, "~N");
Clazz.defineMethod (c$, "getWeight", 
function () {
return this.weight;
});
Clazz.defineMethod (c$, "setNode1", 
function (node1) {
this.node1 = node1;
}, "org.ivis.layout.cose.CoarseningNode");
Clazz.defineMethod (c$, "getNode1", 
function () {
return this.node1;
});
Clazz.defineMethod (c$, "setNode2", 
function (node2) {
this.node2 = node2;
}, "org.ivis.layout.cose.CoarseningNode");
Clazz.defineMethod (c$, "getNode2", 
function () {
return this.node2;
});
Clazz.defineMethod (c$, "setReference", 
function (reference) {
this.reference = reference;
}, "org.ivis.layout.cose.CoSENode");
Clazz.defineMethod (c$, "getReference", 
function () {
return this.reference;
});
Clazz.defineMethod (c$, "getMatching", 
function () {
var minWeighted = null;
var minWeight = 2147483647;
for (var obj, $obj = this.getNeighborsList ().iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
var v = obj;
if ((!v.isMatched ()) && (v !== this) && (v.getWeight () < minWeight)) {
minWeighted = v;
minWeight = v.getWeight ();
}}
return minWeighted;
});
});
