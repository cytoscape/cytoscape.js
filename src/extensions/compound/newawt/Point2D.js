Clazz.declarePackage ("newawt");
Clazz.load (null, "newawt.Point2D", ["java.lang.Double", "$.InternalError"], function () {
c$ = Clazz.declareType (newawt, "Point2D", null, Cloneable);
Clazz.makeConstructor (c$, 
function () {
});
Clazz.defineMethod (c$, "setLocation", 
function (p) {
this.setLocation (p.getX (), p.getY ());
}, "newawt.Point2D");
c$.distanceSq = Clazz.defineMethod (c$, "distanceSq", 
function (X1, Y1, X2, Y2) {
X1 -= X2;
Y1 -= Y2;
return (X1 * X1 + Y1 * Y1);
}, "~N,~N,~N,~N");
c$.distance = Clazz.defineMethod (c$, "distance", 
function (X1, Y1, X2, Y2) {
X1 -= X2;
Y1 -= Y2;
return Math.sqrt (X1 * X1 + Y1 * Y1);
}, "~N,~N,~N,~N");
Clazz.defineMethod (c$, "distanceSq", 
function (PX, PY) {
PX -= this.getX ();
PY -= this.getY ();
return (PX * PX + PY * PY);
}, "~N,~N");
Clazz.defineMethod (c$, "distanceSq", 
function (pt) {
var PX = pt.getX () - this.getX ();
var PY = pt.getY () - this.getY ();
return (PX * PX + PY * PY);
}, "newawt.Point2D");
Clazz.defineMethod (c$, "distance", 
function (PX, PY) {
PX -= this.getX ();
PY -= this.getY ();
return Math.sqrt (PX * PX + PY * PY);
}, "~N,~N");
Clazz.defineMethod (c$, "distance", 
function (pt) {
var PX = pt.getX () - this.getX ();
var PY = pt.getY () - this.getY ();
return Math.sqrt (PX * PX + PY * PY);
}, "newawt.Point2D");
Clazz.defineMethod (c$, "clone", 
function () {
try {
return Clazz.superCall (this, newawt.Point2D, "clone", []);
} catch (e) {
if (Clazz.instanceOf (e, CloneNotSupportedException)) {
throw  new InternalError ();
} else {
throw e;
}
}
});
Clazz.overrideMethod (c$, "hashCode", 
function () {
var bits = java.lang.Double.doubleToLongBits (this.getX ());
bits ^= java.lang.Double.doubleToLongBits (this.getY ()) * 31;
return ((bits) ^ ((bits >> 32)));
});
Clazz.defineMethod (c$, "equals", 
function (obj) {
if (Clazz.instanceOf (obj, newawt.Point2D)) {
var p2d = obj;
return (this.getX () == p2d.getX ()) && (this.getY () == p2d.getY ());
}return Clazz.superCall (this, newawt.Point2D, "equals", [obj]);
}, "~O");
Clazz.pu$h ();
c$ = Clazz.decorateAsClass (function () {
this.x = 0;
this.y = 0;
Clazz.instantialize (this, arguments);
}, newawt.Point2D, "Float", newawt.Point2D);
Clazz.makeConstructor (c$, 
function () {
Clazz.superConstructor (this, newawt.Point2D.Float, []);
});
Clazz.makeConstructor (c$, 
function (a, b) {
Clazz.superConstructor (this, newawt.Point2D.Float, []);
this.x = a;
this.y = b;
}, "~N,~N");
Clazz.overrideMethod (c$, "getX", 
function () {
return this.x;
});
Clazz.overrideMethod (c$, "getY", 
function () {
return this.y;
});
Clazz.defineMethod (c$, "setLocation", 
function (a, b) {
this.x = a;
this.y = b;
}, "~N,~N");
Clazz.defineMethod (c$, "setLocation", 
function (a, b) {
this.x = a;
this.y = b;
}, "~N,~N");
Clazz.overrideMethod (c$, "toString", 
function () {
return "Point2D.Float[" + this.x + ", " + this.y + "]";
});
c$ = Clazz.p0p ();
Clazz.pu$h ();
c$ = Clazz.decorateAsClass (function () {
this.x = 0;
this.y = 0;
Clazz.instantialize (this, arguments);
}, newawt.Point2D, "Double", newawt.Point2D);
Clazz.makeConstructor (c$, 
function () {
Clazz.superConstructor (this, newawt.Point2D.Double, []);
});
Clazz.makeConstructor (c$, 
function (a, b) {
Clazz.superConstructor (this, newawt.Point2D.Double, []);
this.x = a;
this.y = b;
}, "~N,~N");
Clazz.overrideMethod (c$, "getX", 
function () {
return this.x;
});
Clazz.overrideMethod (c$, "getY", 
function () {
return this.y;
});
Clazz.defineMethod (c$, "setLocation", 
function (a, b) {
this.x = a;
this.y = b;
}, "~N,~N");
Clazz.overrideMethod (c$, "toString", 
function () {
return "Point2D.Double[" + this.x + ", " + this.y + "]";
});
c$ = Clazz.p0p ();
});
