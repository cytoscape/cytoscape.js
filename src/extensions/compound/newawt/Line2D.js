Clazz.declarePackage ("newawt");
Clazz.load (["newawt.Shape"], "newawt.Line2D", ["java.lang.InternalError", "newawt.LineIterator", "$.Point2D", "$.Rectangle2D"], function () {
c$ = Clazz.declareType (newawt, "Line2D", null, [newawt.Shape, Cloneable]);
Clazz.makeConstructor (c$, 
function () {
});
Clazz.defineMethod (c$, "setLine", 
function (p1, p2) {
this.setLine (p1.getX (), p1.getY (), p2.getX (), p2.getY ());
}, "newawt.Point2D,newawt.Point2D");
Clazz.defineMethod (c$, "setLine", 
function (l) {
this.setLine (l.getX1 (), l.getY1 (), l.getX2 (), l.getY2 ());
}, "newawt.Line2D");
c$.relativeCCW = Clazz.defineMethod (c$, "relativeCCW", 
function (X1, Y1, X2, Y2, PX, PY) {
X2 -= X1;
Y2 -= Y1;
PX -= X1;
PY -= Y1;
var ccw = PX * Y2 - PY * X2;
if (ccw == 0.0) {
ccw = PX * X2 + PY * Y2;
if (ccw > 0.0) {
PX -= X2;
PY -= Y2;
ccw = PX * X2 + PY * Y2;
if (ccw < 0.0) {
ccw = 0.0;
}}}return (ccw < 0.0) ? -1 : ((ccw > 0.0) ? 1 : 0);
}, "~N,~N,~N,~N,~N,~N");
Clazz.defineMethod (c$, "relativeCCW", 
function (PX, PY) {
return newawt.Line2D.relativeCCW (this.getX1 (), this.getY1 (), this.getX2 (), this.getY2 (), PX, PY);
}, "~N,~N");
Clazz.defineMethod (c$, "relativeCCW", 
function (p) {
return newawt.Line2D.relativeCCW (this.getX1 (), this.getY1 (), this.getX2 (), this.getY2 (), p.getX (), p.getY ());
}, "newawt.Point2D");
c$.linesIntersect = Clazz.defineMethod (c$, "linesIntersect", 
function (X1, Y1, X2, Y2, X3, Y3, X4, Y4) {
return ((newawt.Line2D.relativeCCW (X1, Y1, X2, Y2, X3, Y3) * newawt.Line2D.relativeCCW (X1, Y1, X2, Y2, X4, Y4) <= 0) && (newawt.Line2D.relativeCCW (X3, Y3, X4, Y4, X1, Y1) * newawt.Line2D.relativeCCW (X3, Y3, X4, Y4, X2, Y2) <= 0));
}, "~N,~N,~N,~N,~N,~N,~N,~N");
Clazz.defineMethod (c$, "intersectsLine", 
function (X1, Y1, X2, Y2) {
return newawt.Line2D.linesIntersect (X1, Y1, X2, Y2, this.getX1 (), this.getY1 (), this.getX2 (), this.getY2 ());
}, "~N,~N,~N,~N");
Clazz.defineMethod (c$, "intersectsLine", 
function (l) {
return newawt.Line2D.linesIntersect (l.getX1 (), l.getY1 (), l.getX2 (), l.getY2 (), this.getX1 (), this.getY1 (), this.getX2 (), this.getY2 ());
}, "newawt.Line2D");
c$.ptSegDistSq = Clazz.defineMethod (c$, "ptSegDistSq", 
function (X1, Y1, X2, Y2, PX, PY) {
X2 -= X1;
Y2 -= Y1;
PX -= X1;
PY -= Y1;
var dotprod = PX * X2 + PY * Y2;
var projlenSq;
if (dotprod <= 0.0) {
projlenSq = 0.0;
} else {
PX = X2 - PX;
PY = Y2 - PY;
dotprod = PX * X2 + PY * Y2;
if (dotprod <= 0.0) {
projlenSq = 0.0;
} else {
projlenSq = dotprod * dotprod / (X2 * X2 + Y2 * Y2);
}}var lenSq = PX * PX + PY * PY - projlenSq;
if (lenSq < 0) {
lenSq = 0;
}return lenSq;
}, "~N,~N,~N,~N,~N,~N");
c$.ptSegDist = Clazz.defineMethod (c$, "ptSegDist", 
function (X1, Y1, X2, Y2, PX, PY) {
return Math.sqrt (newawt.Line2D.ptSegDistSq (X1, Y1, X2, Y2, PX, PY));
}, "~N,~N,~N,~N,~N,~N");
Clazz.defineMethod (c$, "ptSegDistSq", 
function (PX, PY) {
return newawt.Line2D.ptSegDistSq (this.getX1 (), this.getY1 (), this.getX2 (), this.getY2 (), PX, PY);
}, "~N,~N");
Clazz.defineMethod (c$, "ptSegDistSq", 
function (pt) {
return newawt.Line2D.ptSegDistSq (this.getX1 (), this.getY1 (), this.getX2 (), this.getY2 (), pt.getX (), pt.getY ());
}, "newawt.Point2D");
Clazz.defineMethod (c$, "ptSegDist", 
function (PX, PY) {
return newawt.Line2D.ptSegDist (this.getX1 (), this.getY1 (), this.getX2 (), this.getY2 (), PX, PY);
}, "~N,~N");
Clazz.defineMethod (c$, "ptSegDist", 
function (pt) {
return newawt.Line2D.ptSegDist (this.getX1 (), this.getY1 (), this.getX2 (), this.getY2 (), pt.getX (), pt.getY ());
}, "newawt.Point2D");
c$.ptLineDistSq = Clazz.defineMethod (c$, "ptLineDistSq", 
function (X1, Y1, X2, Y2, PX, PY) {
X2 -= X1;
Y2 -= Y1;
PX -= X1;
PY -= Y1;
var dotprod = PX * X2 + PY * Y2;
var projlenSq = dotprod * dotprod / (X2 * X2 + Y2 * Y2);
var lenSq = PX * PX + PY * PY - projlenSq;
if (lenSq < 0) {
lenSq = 0;
}return lenSq;
}, "~N,~N,~N,~N,~N,~N");
c$.ptLineDist = Clazz.defineMethod (c$, "ptLineDist", 
function (X1, Y1, X2, Y2, PX, PY) {
return Math.sqrt (newawt.Line2D.ptLineDistSq (X1, Y1, X2, Y2, PX, PY));
}, "~N,~N,~N,~N,~N,~N");
Clazz.defineMethod (c$, "ptLineDistSq", 
function (PX, PY) {
return newawt.Line2D.ptLineDistSq (this.getX1 (), this.getY1 (), this.getX2 (), this.getY2 (), PX, PY);
}, "~N,~N");
Clazz.defineMethod (c$, "ptLineDistSq", 
function (pt) {
return newawt.Line2D.ptLineDistSq (this.getX1 (), this.getY1 (), this.getX2 (), this.getY2 (), pt.getX (), pt.getY ());
}, "newawt.Point2D");
Clazz.defineMethod (c$, "ptLineDist", 
function (PX, PY) {
return newawt.Line2D.ptLineDist (this.getX1 (), this.getY1 (), this.getX2 (), this.getY2 (), PX, PY);
}, "~N,~N");
Clazz.defineMethod (c$, "ptLineDist", 
function (pt) {
return newawt.Line2D.ptLineDist (this.getX1 (), this.getY1 (), this.getX2 (), this.getY2 (), pt.getX (), pt.getY ());
}, "newawt.Point2D");
Clazz.defineMethod (c$, "contains", 
function (x, y) {
return false;
}, "~N,~N");
Clazz.defineMethod (c$, "contains", 
function (p) {
return false;
}, "newawt.Point2D");
Clazz.defineMethod (c$, "intersects", 
function (x, y, w, h) {
return this.intersects ( new newawt.Rectangle2D.Double (x, y, w, h));
}, "~N,~N,~N,~N");
Clazz.defineMethod (c$, "intersects", 
function (r) {
return r.intersectsLine (this.getX1 (), this.getY1 (), this.getX2 (), this.getY2 ());
}, "newawt.Rectangle2D");
Clazz.defineMethod (c$, "contains", 
function (x, y, w, h) {
return false;
}, "~N,~N,~N,~N");
Clazz.defineMethod (c$, "contains", 
function (r) {
return false;
}, "newawt.Rectangle2D");
Clazz.overrideMethod (c$, "getBounds", 
function () {
return this.getBounds2D ().getBounds ();
});
Clazz.defineMethod (c$, "getPathIterator", 
function (at) {
return  new newawt.LineIterator (this, at);
}, "newawt.AffineTransform");
Clazz.defineMethod (c$, "getPathIterator", 
function (at, flatness) {
return  new newawt.LineIterator (this, at);
}, "newawt.AffineTransform,~N");
Clazz.defineMethod (c$, "clone", 
function () {
try {
return Clazz.superCall (this, newawt.Line2D, "clone", []);
} catch (e) {
if (Clazz.instanceOf (e, CloneNotSupportedException)) {
throw  new InternalError ();
} else {
throw e;
}
}
});
Clazz.pu$h ();
c$ = Clazz.decorateAsClass (function () {
this.x1 = 0;
this.y1 = 0;
this.x2 = 0;
this.y2 = 0;
Clazz.instantialize (this, arguments);
}, newawt.Line2D, "Float", newawt.Line2D);
Clazz.makeConstructor (c$, 
function () {
Clazz.superConstructor (this, newawt.Line2D.Float, []);
});
Clazz.makeConstructor (c$, 
function (a, b, c, d) {
Clazz.superConstructor (this, newawt.Line2D.Float, []);
this.setLine (a, b, c, d);
}, "~N,~N,~N,~N");
Clazz.makeConstructor (c$, 
function (a, b) {
Clazz.superConstructor (this, newawt.Line2D.Float, []);
this.setLine (a, b);
}, "newawt.Point2D,newawt.Point2D");
Clazz.overrideMethod (c$, "getX1", 
function () {
return this.x1;
});
Clazz.overrideMethod (c$, "getY1", 
function () {
return this.y1;
});
Clazz.overrideMethod (c$, "getP1", 
function () {
return  new newawt.Point2D.Float (this.x1, this.y1);
});
Clazz.overrideMethod (c$, "getX2", 
function () {
return this.x2;
});
Clazz.overrideMethod (c$, "getY2", 
function () {
return this.y2;
});
Clazz.overrideMethod (c$, "getP2", 
function () {
return  new newawt.Point2D.Float (this.x2, this.y2);
});
Clazz.defineMethod (c$, "setLine", 
function (a, b, c, d) {
this.x1 = a;
this.y1 = b;
this.x2 = c;
this.y2 = d;
}, "~N,~N,~N,~N");
Clazz.defineMethod (c$, "setLine", 
function (a, b, c, d) {
this.x1 = a;
this.y1 = b;
this.x2 = c;
this.y2 = d;
}, "~N,~N,~N,~N");
Clazz.overrideMethod (c$, "getBounds2D", 
function () {
var a;
var b;
var c;
var d;
if (this.x1 < this.x2) {
a = this.x1;
c = this.x2 - this.x1;
} else {
a = this.x2;
c = this.x1 - this.x2;
}if (this.y1 < this.y2) {
b = this.y1;
d = this.y2 - this.y1;
} else {
b = this.y2;
d = this.y1 - this.y2;
}return  new newawt.Rectangle2D.Float (a, b, c, d);
});
Clazz.defineMethod (c$, "contains", 
function (a) {
return false;
}, "java.awt.geom.Point2D");
Clazz.defineMethod (c$, "intersects", 
function (a) {
return false;
}, "java.awt.geom.Rectangle2D");
Clazz.defineMethod (c$, "contains", 
function (a) {
return false;
}, "java.awt.geom.Rectangle2D");
Clazz.defineMethod (c$, "getPathIterator", 
function (a) {
return null;
}, "java.awt.geom.AffineTransform");
Clazz.defineMethod (c$, "getPathIterator", 
function (a, b) {
return null;
}, "java.awt.geom.AffineTransform,~N");
c$ = Clazz.p0p ();
Clazz.pu$h ();
c$ = Clazz.decorateAsClass (function () {
this.x1 = 0;
this.y1 = 0;
this.x2 = 0;
this.y2 = 0;
Clazz.instantialize (this, arguments);
}, newawt.Line2D, "Double", newawt.Line2D);
Clazz.makeConstructor (c$, 
function () {
Clazz.superConstructor (this, newawt.Line2D.Double, []);
});
Clazz.makeConstructor (c$, 
function (a, b, c, d) {
Clazz.superConstructor (this, newawt.Line2D.Double, []);
this.setLine (a, b, c, d);
}, "~N,~N,~N,~N");
Clazz.makeConstructor (c$, 
function (a, b) {
Clazz.superConstructor (this, newawt.Line2D.Double, []);
this.setLine (a, b);
}, "newawt.Point2D,newawt.Point2D");
Clazz.overrideMethod (c$, "getX1", 
function () {
return this.x1;
});
Clazz.overrideMethod (c$, "getY1", 
function () {
return this.y1;
});
Clazz.overrideMethod (c$, "getP1", 
function () {
return  new newawt.Point2D.Double (this.x1, this.y1);
});
Clazz.overrideMethod (c$, "getX2", 
function () {
return this.x2;
});
Clazz.overrideMethod (c$, "getY2", 
function () {
return this.y2;
});
Clazz.overrideMethod (c$, "getP2", 
function () {
return  new newawt.Point2D.Double (this.x2, this.y2);
});
Clazz.defineMethod (c$, "setLine", 
function (a, b, c, d) {
this.x1 = a;
this.y1 = b;
this.x2 = c;
this.y2 = d;
}, "~N,~N,~N,~N");
Clazz.overrideMethod (c$, "getBounds2D", 
function () {
var a;
var b;
var c;
var d;
if (this.x1 < this.x2) {
a = this.x1;
c = this.x2 - this.x1;
} else {
a = this.x2;
c = this.x1 - this.x2;
}if (this.y1 < this.y2) {
b = this.y1;
d = this.y2 - this.y1;
} else {
b = this.y2;
d = this.y1 - this.y2;
}return  new newawt.Rectangle2D.Double (a, b, c, d);
});
Clazz.defineMethod (c$, "contains", 
function (a) {
return false;
}, "java.awt.geom.Point2D");
Clazz.defineMethod (c$, "intersects", 
function (a) {
return false;
}, "java.awt.geom.Rectangle2D");
Clazz.defineMethod (c$, "contains", 
function (a) {
return false;
}, "java.awt.geom.Rectangle2D");
Clazz.defineMethod (c$, "getPathIterator", 
function (a) {
return null;
}, "java.awt.geom.AffineTransform");
Clazz.defineMethod (c$, "getPathIterator", 
function (a, b) {
return null;
}, "java.awt.geom.AffineTransform,~N");
c$ = Clazz.p0p ();
});
