Clazz.declarePackage ("org.ivis.layout.fd");
Clazz.load (["org.ivis.layout.LNode"], "org.ivis.layout.fd.FDLayoutNode", null, function () {
c$ = Clazz.decorateAsClass (function () {
this.springForceX = 0;
this.springForceY = 0;
this.repulsionForceX = 0;
this.repulsionForceY = 0;
this.gravitationForceX = 0;
this.gravitationForceY = 0;
this.displacementX = 0;
this.displacementY = 0;
this.startX = 0;
this.finishX = 0;
this.startY = 0;
this.finishY = 0;
this.surrounding = null;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.fd, "FDLayoutNode", org.ivis.layout.LNode);
Clazz.defineMethod (c$, "setGridCoordinates", 
function (_startX, _finishX, _startY, _finishY) {
this.startX = _startX;
this.finishX = _finishX;
this.startY = _startY;
this.finishY = _finishY;
}, "~N,~N,~N,~N");
});
