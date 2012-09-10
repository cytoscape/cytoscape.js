Clazz.declarePackage ("newawt");
Clazz.load (["newawt.Shape"], "newawt.RectangularShape", ["java.lang.InternalError"], function () {
c$ = Clazz.declareType (newawt, "RectangularShape", null, [newawt.Shape, Cloneable]);
Clazz.makeConstructor (c$, 
function () {
});
Clazz.defineMethod (c$, "getMinX", 
function () {
return this.getX ();
});
Clazz.defineMethod (c$, "getMinY", 
function () {
return this.getY ();
});
Clazz.defineMethod (c$, "getMaxX", 
function () {
return this.getX () + this.getWidth ();
});
Clazz.defineMethod (c$, "getMaxY", 
function () {
return this.getY () + this.getHeight ();
});
Clazz.defineMethod (c$, "getCenterX", 
function () {
return this.getX () + this.getWidth () / 2.0;
});
Clazz.defineMethod (c$, "getCenterY", 
function () {
return this.getY () + this.getHeight () / 2.0;
});
Clazz.defineMethod (c$, "getFrame", 
function () {
return  new newawt.Rectangle2D.Double (this.getX (), this.getY (), this.getWidth (), this.getHeight ());
});
Clazz.defineMethod (c$, "setFrame", 
function (loc, size) {
this.setFrame (loc.getX (), loc.getY (), size.getWidth (), size.getHeight ());
}, "newawt.Point2D,newawt.Dimension2D");
Clazz.defineMethod (c$, "setFrame", 
function (r) {
this.setFrame (r.getX (), r.getY (), r.getWidth (), r.getHeight ());
}, "newawt.Rectangle2D");
Clazz.defineMethod (c$, "setFrameFromDiagonal", 
function (x1, y1, x2, y2) {
if (x2 < x1) {
var t = x1;
x1 = x2;
x2 = t;
}if (y2 < y1) {
var t = y1;
y1 = y2;
y2 = t;
}this.setFrame (x1, y1, x2 - x1, y2 - y1);
}, "~N,~N,~N,~N");
Clazz.defineMethod (c$, "setFrameFromDiagonal", 
function (p1, p2) {
this.setFrameFromDiagonal (p1.getX (), p1.getY (), p2.getX (), p2.getY ());
}, "newawt.Point2D,newawt.Point2D");
Clazz.defineMethod (c$, "setFrameFromCenter", 
function (centerX, centerY, cornerX, cornerY) {
var halfW = Math.abs (cornerX - centerX);
var halfH = Math.abs (cornerY - centerY);
this.setFrame (centerX - halfW, centerY - halfH, halfW * 2.0, halfH * 2.0);
}, "~N,~N,~N,~N");
Clazz.defineMethod (c$, "setFrameFromCenter", 
function (center, corner) {
this.setFrameFromCenter (center.getX (), center.getY (), corner.getX (), corner.getY ());
}, "newawt.Point2D,newawt.Point2D");
Clazz.defineMethod (c$, "contains", 
function (p) {
return this.contains (p.getX (), p.getY ());
}, "newawt.Point2D");
Clazz.overrideMethod (c$, "intersects", 
function (r) {
return this.intersects (r.getX (), r.getY (), r.getWidth (), r.getHeight ());
}, "newawt.Rectangle2D");
Clazz.defineMethod (c$, "contains", 
function (r) {
return this.contains (r.getX (), r.getY (), r.getWidth (), r.getHeight ());
}, "newawt.Rectangle2D");
Clazz.overrideMethod (c$, "getBounds", 
function () {
var width = this.getWidth ();
var height = this.getHeight ();
if (width < 0 || height < 0) {
return  new newawt.Rectangle ();
}var x = this.getX ();
var y = this.getY ();
var x1 = Math.floor (x);
var y1 = Math.floor (y);
var x2 = Math.ceil (x + width);
var y2 = Math.ceil (y + height);
return  new newawt.Rectangle (Math.round (x1), Math.round (y1), Math.round ((x2 - x1)), Math.round ((y2 - y1)));
});
Clazz.defineMethod (c$, "clone", 
function () {
try {
return Clazz.superCall (this, newawt.RectangularShape, "clone", []);
} catch (e) {
if (Clazz.instanceOf (e, CloneNotSupportedException)) {
throw  new InternalError ();
} else {
throw e;
}
}
});
});
