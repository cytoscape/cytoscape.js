Clazz.declarePackage ("org.ivis.util");
c$ = Clazz.decorateAsClass (function () {
this.width = 0;
this.height = 0;
Clazz.instantialize (this, arguments);
}, org.ivis.util, "DimensionD");
Clazz.makeConstructor (c$, 
function () {
this.height = 0;
this.width = 0;
});
Clazz.makeConstructor (c$, 
function (width, height) {
this.height = height;
this.width = width;
}, "~N,~N");
Clazz.defineMethod (c$, "getWidth", 
function () {
return this.width;
});
Clazz.defineMethod (c$, "setWidth", 
function (width) {
this.width = width;
}, "~N");
Clazz.defineMethod (c$, "getHeight", 
function () {
return this.height;
});
Clazz.defineMethod (c$, "setHeight", 
function (height) {
this.height = height;
}, "~N");
