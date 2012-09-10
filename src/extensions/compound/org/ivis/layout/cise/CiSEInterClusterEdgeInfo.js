Clazz.declarePackage ("org.ivis.layout.cise");
c$ = Clazz.decorateAsClass (function () {
this.edge = null;
this.angle = 0;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.cise, "CiSEInterClusterEdgeInfo");
Clazz.makeConstructor (c$, 
function (edge, angle) {
this.edge = edge;
this.angle = angle;
}, "org.ivis.layout.cise.CiSEEdge,~N");
Clazz.defineMethod (c$, "getEdge", 
function () {
return this.edge;
});
Clazz.defineMethod (c$, "getAngle", 
function () {
return this.angle;
});
