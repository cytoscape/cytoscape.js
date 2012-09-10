Clazz.declarePackage ("newawt");
Clazz.load (["newawt.RectangularShape"], "newawt.Rectangle2D", ["java.lang.Double", "newawt.RectIterator"], function () {
c$ = Clazz.declareType (newawt, "Rectangle2D", newawt.RectangularShape);
Clazz.makeConstructor (c$, 
function () {
Clazz.superConstructor (this, newawt.Rectangle2D, []);
});
Clazz.defineMethod (c$, "setRect", 
function (r) {
this.setRect (r.getX (), r.getY (), r.getWidth (), r.getHeight ());
}, "newawt.Rectangle2D");
Clazz.defineMethod (c$, "intersectsLine", 
function (x1, y1, x2, y2) {
var out1;
var out2;
if ((out2 = this.outcode (x2, y2)) == 0) {
return true;
}while ((out1 = this.outcode (x1, y1)) != 0) {
if ((out1 & out2) != 0) {
return false;
}if ((out1 & (5)) != 0) {
var x = this.getX ();
if ((out1 & 4) != 0) {
x += this.getWidth ();
}y1 = y1 + (x - x1) * (y2 - y1) / (x2 - x1);
x1 = x;
} else {
var y = this.getY ();
if ((out1 & 8) != 0) {
y += this.getHeight ();
}x1 = x1 + (y - y1) * (x2 - x1) / (y2 - y1);
y1 = y;
}}
return true;
}, "~N,~N,~N,~N");
Clazz.defineMethod (c$, "intersectsLine", 
function (l) {
return this.intersectsLine (l.getX1 (), l.getY1 (), l.getX2 (), l.getY2 ());
}, "newawt.Line2D");
Clazz.defineMethod (c$, "outcode", 
function (p) {
return this.outcode (p.getX (), p.getY ());
}, "newawt.Point2D");
Clazz.defineMethod (c$, "setFrame", 
function (x, y, w, h) {
this.setRect (x, y, w, h);
}, "~N,~N,~N,~N");
Clazz.overrideMethod (c$, "getBounds2D", 
function () {
return this.clone ();
});
Clazz.defineMethod (c$, "contains", 
function (x, y) {
var x0 = this.getX ();
var y0 = this.getY ();
return (x >= x0 && y >= y0 && x < x0 + this.getWidth () && y < y0 + this.getHeight ());
}, "~N,~N");
Clazz.defineMethod (c$, "intersects", 
function (x, y, w, h) {
if (this.isEmpty () || w <= 0 || h <= 0) {
return false;
}var x0 = this.getX ();
var y0 = this.getY ();
return (x + w > x0 && y + h > y0 && x < x0 + this.getWidth () && y < y0 + this.getHeight ());
}, "~N,~N,~N,~N");
Clazz.defineMethod (c$, "contains", 
function (x, y, w, h) {
if (this.isEmpty () || w <= 0 || h <= 0) {
return false;
}var x0 = this.getX ();
var y0 = this.getY ();
return (x >= x0 && y >= y0 && (x + w) <= x0 + this.getWidth () && (y + h) <= y0 + this.getHeight ());
}, "~N,~N,~N,~N");
c$.intersect = Clazz.defineMethod (c$, "intersect", 
function (src1, src2, dest) {
var x1 = Math.max (src1.getMinX (), src2.getMinX ());
var y1 = Math.max (src1.getMinY (), src2.getMinY ());
var x2 = Math.min (src1.getMaxX (), src2.getMaxX ());
var y2 = Math.min (src1.getMaxY (), src2.getMaxY ());
dest.setFrame (x1, y1, x2 - x1, y2 - y1);
}, "newawt.Rectangle2D,newawt.Rectangle2D,newawt.Rectangle2D");
c$.union = Clazz.defineMethod (c$, "union", 
function (src1, src2, dest) {
var x1 = Math.min (src1.getMinX (), src2.getMinX ());
var y1 = Math.min (src1.getMinY (), src2.getMinY ());
var x2 = Math.max (src1.getMaxX (), src2.getMaxX ());
var y2 = Math.max (src1.getMaxY (), src2.getMaxY ());
dest.setFrameFromDiagonal (x1, y1, x2, y2);
}, "newawt.Rectangle2D,newawt.Rectangle2D,newawt.Rectangle2D");
Clazz.defineMethod (c$, "add", 
function (newx, newy) {
var x1 = Math.min (this.getMinX (), newx);
var x2 = Math.max (this.getMaxX (), newx);
var y1 = Math.min (this.getMinY (), newy);
var y2 = Math.max (this.getMaxY (), newy);
this.setRect (x1, y1, x2 - x1, y2 - y1);
}, "~N,~N");
Clazz.defineMethod (c$, "add", 
function (pt) {
this.add (pt.getX (), pt.getY ());
}, "newawt.Point2D");
Clazz.defineMethod (c$, "add", 
function (r) {
var x1 = Math.min (this.getMinX (), r.getMinX ());
var x2 = Math.max (this.getMaxX (), r.getMaxX ());
var y1 = Math.min (this.getMinY (), r.getMinY ());
var y2 = Math.max (this.getMaxY (), r.getMaxY ());
this.setRect (x1, y1, x2 - x1, y2 - y1);
}, "newawt.Rectangle2D");
Clazz.defineMethod (c$, "getPathIterator", 
function (at) {
return  new newawt.RectIterator (this, at);
}, "newawt.AffineTransform");
Clazz.defineMethod (c$, "getPathIterator", 
function (at, flatness) {
return  new newawt.RectIterator (this, at);
}, "newawt.AffineTransform,~N");
Clazz.overrideMethod (c$, "hashCode", 
function () {
var bits = java.lang.Double.doubleToLongBits (this.getX ());
bits += java.lang.Double.doubleToLongBits (this.getY ()) * 37;
bits += java.lang.Double.doubleToLongBits (this.getWidth ()) * 43;
bits += java.lang.Double.doubleToLongBits (this.getHeight ()) * 47;
return ((bits) ^ ((bits >> 32)));
});
Clazz.overrideMethod (c$, "equals", 
function (obj) {
if (obj === this) {
return true;
}if (Clazz.instanceOf (obj, newawt.Rectangle2D)) {
var r2d = obj;
return ((this.getX () == r2d.getX ()) && (this.getY () == r2d.getY ()) && (this.getWidth () == r2d.getWidth ()) && (this.getHeight () == r2d.getHeight ()));
}return false;
}, "~O");
Clazz.pu$h ();
c$ = Clazz.decorateAsClass (function () {
this.x = 0;
this.y = 0;
this.width = 0;
this.height = 0;
Clazz.instantialize (this, arguments);
}, newawt.Rectangle2D, "Float", newawt.Rectangle2D);
Clazz.makeConstructor (c$, 
function () {
Clazz.superConstructor (this, newawt.Rectangle2D.Float, []);
});
Clazz.makeConstructor (c$, 
function (a, b, c, d) {
Clazz.superConstructor (this, newawt.Rectangle2D.Float, []);
this.setRect (a, b, c, d);
}, "~N,~N,~N,~N");
Clazz.defineMethod (c$, "getX", 
function () {
return this.x;
});
Clazz.defineMethod (c$, "getY", 
function () {
return this.y;
});
Clazz.defineMethod (c$, "getWidth", 
function () {
return this.width;
});
Clazz.defineMethod (c$, "getHeight", 
function () {
return this.height;
});
Clazz.overrideMethod (c$, "isEmpty", 
function () {
return (this.width <= 0.0) || (this.height <= 0.0);
});
Clazz.defineMethod (c$, "setRect", 
function (a, b, c, d) {
this.x = a;
this.y = b;
this.width = c;
this.height = d;
}, "~N,~N,~N,~N");
Clazz.defineMethod (c$, "setRect", 
function (a, b, c, d) {
this.x = a;
this.y = b;
this.width = c;
this.height = d;
}, "~N,~N,~N,~N");
Clazz.defineMethod (c$, "setRect", 
function (a) {
this.x = a.getX ();
this.y = a.getY ();
this.width = a.getWidth ();
this.height = a.getHeight ();
}, "newawt.Rectangle2D");
Clazz.defineMethod (c$, "outcode", 
function (a, b) {
var c = 0;
if (this.width <= 0) {
c |= 5;
} else if (a < this.x) {
c |= 1;
} else if (a > this.x + this.width) {
c |= 4;
}if (this.height <= 0) {
c |= 10;
} else if (b < this.y) {
c |= 2;
} else if (b > this.y + this.height) {
c |= 8;
}return c;
}, "~N,~N");
Clazz.overrideMethod (c$, "getBounds2D", 
function () {
return  new newawt.Rectangle2D.Float (this.x, this.y, this.width, this.height);
});
Clazz.overrideMethod (c$, "createIntersection", 
function (a) {
var b;
if (Clazz.instanceOf (a, newawt.Rectangle2D.Float)) {
b =  new newawt.Rectangle2D.Float ();
} else {
b =  new newawt.Rectangle2D.Double ();
}newawt.Rectangle2D.intersect (this, a, b);
return b;
}, "newawt.Rectangle2D");
Clazz.overrideMethod (c$, "createUnion", 
function (a) {
var b;
if (Clazz.instanceOf (a, newawt.Rectangle2D.Float)) {
b =  new newawt.Rectangle2D.Float ();
} else {
b =  new newawt.Rectangle2D.Double ();
}newawt.Rectangle2D.union (this, a, b);
return b;
}, "newawt.Rectangle2D");
Clazz.overrideMethod (c$, "toString", 
function () {
return this.getClass ().getName () + "[x=" + this.x + ",y=" + this.y + ",w=" + this.width + ",h=" + this.height + "]";
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
this.x = 0;
this.y = 0;
this.width = 0;
this.height = 0;
Clazz.instantialize (this, arguments);
}, newawt.Rectangle2D, "Double", newawt.Rectangle2D);
Clazz.makeConstructor (c$, 
function () {
Clazz.superConstructor (this, newawt.Rectangle2D.Double, []);
});
Clazz.makeConstructor (c$, 
function (a, b, c, d) {
Clazz.superConstructor (this, newawt.Rectangle2D.Double, []);
this.setRect (a, b, c, d);
}, "~N,~N,~N,~N");
Clazz.defineMethod (c$, "getX", 
function () {
return this.x;
});
Clazz.defineMethod (c$, "getY", 
function () {
return this.y;
});
Clazz.defineMethod (c$, "getWidth", 
function () {
return this.width;
});
Clazz.defineMethod (c$, "getHeight", 
function () {
return this.height;
});
Clazz.overrideMethod (c$, "isEmpty", 
function () {
return (this.width <= 0.0) || (this.height <= 0.0);
});
Clazz.defineMethod (c$, "setRect", 
function (a, b, c, d) {
this.x = a;
this.y = b;
this.width = c;
this.height = d;
}, "~N,~N,~N,~N");
Clazz.defineMethod (c$, "setRect", 
function (a) {
this.x = a.getX ();
this.y = a.getY ();
this.width = a.getWidth ();
this.height = a.getHeight ();
}, "newawt.Rectangle2D");
Clazz.defineMethod (c$, "outcode", 
function (a, b) {
var c = 0;
if (this.width <= 0) {
c |= 5;
} else if (a < this.x) {
c |= 1;
} else if (a > this.x + this.width) {
c |= 4;
}if (this.height <= 0) {
c |= 10;
} else if (b < this.y) {
c |= 2;
} else if (b > this.y + this.height) {
c |= 8;
}return c;
}, "~N,~N");
Clazz.overrideMethod (c$, "getBounds2D", 
function () {
return  new newawt.Rectangle2D.Double (this.x, this.y, this.width, this.height);
});
Clazz.overrideMethod (c$, "createIntersection", 
function (a) {
var b =  new newawt.Rectangle2D.Double ();
newawt.Rectangle2D.intersect (this, a, b);
return b;
}, "newawt.Rectangle2D");
Clazz.overrideMethod (c$, "createUnion", 
function (a) {
var b =  new newawt.Rectangle2D.Double ();
newawt.Rectangle2D.union (this, a, b);
return b;
}, "newawt.Rectangle2D");
Clazz.overrideMethod (c$, "toString", 
function () {
return this.getClass ().getName () + "[x=" + this.x + ",y=" + this.y + ",w=" + this.width + ",h=" + this.height + "]";
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
Clazz.defineStatics (c$,
"OUT_LEFT", 1,
"OUT_TOP", 2,
"OUT_RIGHT", 4,
"OUT_BOTTOM", 8);
});
