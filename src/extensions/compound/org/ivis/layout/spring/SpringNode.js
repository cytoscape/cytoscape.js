Clazz.declarePackage ("org.ivis.layout.spring");
Clazz.load (["org.ivis.layout.LNode"], "org.ivis.layout.spring.SpringNode", null, function () {
c$ = Clazz.decorateAsClass (function () {
this.x = 0;
this.y = 0;
this.xx = 0;
this.yy = 0;
this.xy = 0;
this.euclideanDistance = 0;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.spring, "SpringNode", org.ivis.layout.LNode);
Clazz.defineMethod (c$, "reset", 
function () {
this.x = 0.0;
this.y = 0.0;
this.xx = 0.0;
this.yy = 0.0;
this.xy = 0.0;
this.euclideanDistance = 0.0;
});
Clazz.defineMethod (c$, "copyFrom", 
function (other_partial_derivatives) {
this.x = other_partial_derivatives.x;
this.y = other_partial_derivatives.y;
this.xx = other_partial_derivatives.xx;
this.yy = other_partial_derivatives.yy;
this.xy = other_partial_derivatives.xy;
this.euclideanDistance = other_partial_derivatives.euclideanDistance;
}, "org.ivis.layout.spring.SpringNode");
Clazz.makeConstructor (c$, 
function (node) {
this.construct (node.graphManager, node.vGraphObject);
this.copyFrom (node);
}, "org.ivis.layout.spring.SpringNode");
});
