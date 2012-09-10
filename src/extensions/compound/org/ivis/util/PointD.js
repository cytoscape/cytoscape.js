Clazz.declarePackage ("org.ivis.util");
Clazz.load (null, "org.ivis.util.PointD", ["org.ivis.util.DimensionD"], function () {
c$ = Clazz.decorateAsClass (function () {
this.x = 0;
this.y = 0;
Clazz.instantialize (this, arguments);
}, org.ivis.util, "PointD");
Clazz.makeConstructor (c$, 
function () {
this.x = 0.0;
this.y = 0.0;
});
Clazz.makeConstructor (c$, 
function (x, y) {
this.x = x;
this.y = y;
}, "~N,~N");
Clazz.defineMethod (c$, "getX", 
function () {
return this.x;
});
Clazz.defineMethod (c$, "setX", 
function (x) {
this.x = x;
}, "~N");
Clazz.defineMethod (c$, "getY", 
function () {
return this.y;
});
Clazz.defineMethod (c$, "setY", 
function (y) {
this.y = y;
}, "~N");
Clazz.defineMethod (c$, "getDifference", 
function (pt) {
return  new org.ivis.util.DimensionD (this.x - pt.x, this.y - pt.y);
}, "org.ivis.util.PointD");
Clazz.defineMethod (c$, "getCopy", 
function () {
return  new org.ivis.util.PointD (this.x, this.y);
});
Clazz.defineMethod (c$, "translate", 
function (dim) {
this.x += dim.width;
this.y += dim.height;
return this;
}, "org.ivis.util.DimensionD");
});
