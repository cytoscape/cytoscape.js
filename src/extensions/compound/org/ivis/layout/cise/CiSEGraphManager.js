Clazz.declarePackage ("org.ivis.layout.cise");
Clazz.load (["org.ivis.layout.LGraphManager"], "org.ivis.layout.cise.CiSEGraphManager", null, function () {
c$ = Clazz.decorateAsClass (function () {
this.onCircleNodes = null;
this.nonOnCircleNodes = null;
this.inCircleNodes = null;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.cise, "CiSEGraphManager", org.ivis.layout.LGraphManager);
Clazz.makeConstructor (c$, 
function (layout) {
Clazz.superConstructor (this, org.ivis.layout.cise.CiSEGraphManager, [layout]);
this.onCircleNodes = null;
this.inCircleNodes = null;
this.nonOnCircleNodes = null;
}, "org.ivis.layout.Layout");
Clazz.defineMethod (c$, "getOnCircleNodes", 
function () {
return this.onCircleNodes;
});
Clazz.defineMethod (c$, "getInCircleNodes", 
function () {
return this.inCircleNodes;
});
Clazz.defineMethod (c$, "getNonOnCircleNodes", 
function () {
return this.nonOnCircleNodes;
});
Clazz.defineMethod (c$, "setOnCircleNodes", 
function (nodes) {
this.onCircleNodes = nodes;
}, "~A");
Clazz.defineMethod (c$, "setInCircleNodes", 
function (nodes) {
this.inCircleNodes = nodes;
}, "~A");
Clazz.defineMethod (c$, "setNonOnCircleNodes", 
function (nodes) {
this.nonOnCircleNodes = nodes;
}, "~A");
});
