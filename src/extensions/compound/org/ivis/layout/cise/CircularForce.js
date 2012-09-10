Clazz.declarePackage ("org.ivis.layout.cise");
c$ = Clazz.decorateAsClass (function () {
this.rotationAmount = 0;
this.displacementX = 0;
this.displacementY = 0;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.cise, "CircularForce");
Clazz.makeConstructor (c$, 
function () {
});
Clazz.makeConstructor (c$, 
function (rotationAmount, displacementX, displacementY) {
this.rotationAmount = rotationAmount;
this.displacementX = displacementX;
this.displacementY = displacementY;
}, "~N,~N,~N");
Clazz.defineMethod (c$, "getRotationAmount", 
function () {
return this.rotationAmount;
});
Clazz.defineMethod (c$, "setRotationAmount", 
function (rotationAmount) {
this.rotationAmount = rotationAmount;
}, "~N");
Clazz.defineMethod (c$, "getDisplacementX", 
function () {
return this.displacementX;
});
Clazz.defineMethod (c$, "setDisplacementX", 
function (displacementX) {
this.displacementX = displacementX;
}, "~N");
Clazz.defineMethod (c$, "getDisplacementY", 
function () {
return this.displacementY;
});
Clazz.defineMethod (c$, "setDisplacementY", 
function (displacementY) {
this.displacementY = displacementY;
}, "~N");
