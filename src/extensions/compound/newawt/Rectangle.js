Clazz.declarePackage ("newawt");
Clazz.load (["newawt.Rectangle2D", "$.Shape"], "newawt.Rectangle", ["newawt.Dimension", "$.Point"], function () {
c$ = Clazz.decorateAsClass (function () {
this.x = 0;
this.y = 0;
this.width = 0;
this.height = 0;
Clazz.instantialize (this, arguments);
}, newawt, "Rectangle", newawt.Rectangle2D, [newawt.Shape, java.io.Serializable]);
Clazz.makeConstructor (c$, 
function () {
this.construct (0, 0, 0, 0);
});
Clazz.makeConstructor (c$, 
function (r) {
this.construct (r.x, r.y, r.width, r.height);
}, "newawt.Rectangle");
Clazz.makeConstructor (c$, 
function (x, y, width, height) {
Clazz.superConstructor (this, newawt.Rectangle, []);
this.x = x;
this.y = y;
this.width = width;
this.height = height;
}, "~N,~N,~N,~N");
Clazz.makeConstructor (c$, 
function (width, height) {
this.construct (0, 0, width, height);
}, "~N,~N");
Clazz.makeConstructor (c$, 
function (p, d) {
this.construct (p.x, p.y, d.width, d.height);
}, "newawt.Point,newawt.Dimension");
Clazz.makeConstructor (c$, 
function (p) {
this.construct (p.x, p.y, 0, 0);
}, "newawt.Point");
Clazz.makeConstructor (c$, 
function (d) {
this.construct (0, 0, d.width, d.height);
}, "newawt.Dimension");
Clazz.overrideMethod (c$, "getX", 
function () {
return this.x;
});
Clazz.overrideMethod (c$, "getY", 
function () {
return this.y;
});
Clazz.overrideMethod (c$, "getWidth", 
function () {
return this.width;
});
Clazz.overrideMethod (c$, "getHeight", 
function () {
return this.height;
});
Clazz.overrideMethod (c$, "getBounds", 
function () {
return  new newawt.Rectangle (this.x, this.y, this.width, this.height);
});
Clazz.overrideMethod (c$, "getBounds2D", 
function () {
return  new newawt.Rectangle (this.x, this.y, this.width, this.height);
});
Clazz.defineMethod (c$, "setBounds", 
function (r) {
this.setBounds (r.x, r.y, r.width, r.height);
}, "newawt.Rectangle");
Clazz.defineMethod (c$, "setBounds", 
function (x, y, width, height) {
this.reshape (x, y, width, height);
}, "~N,~N,~N,~N");
Clazz.defineMethod (c$, "setRect", 
function (x, y, width, height) {
var x0 = Math.round (Math.floor (x));
var y0 = Math.round (Math.floor (y));
var x1 = Math.round (Math.ceil (x + width));
var y1 = Math.round (Math.ceil (y + height));
this.setBounds (x0, y0, x1 - x0, y1 - y0);
}, "~N,~N,~N,~N");
Clazz.defineMethod (c$, "reshape", 
function (x, y, width, height) {
this.x = x;
this.y = y;
this.width = width;
this.height = height;
}, "~N,~N,~N,~N");
Clazz.defineMethod (c$, "getLocation", 
function () {
return  new newawt.Point (this.x, this.y);
});
Clazz.defineMethod (c$, "setLocation", 
function (p) {
this.setLocation (p.x, p.y);
}, "newawt.Point");
Clazz.defineMethod (c$, "setLocation", 
function (x, y) {
this.move (x, y);
}, "~N,~N");
Clazz.defineMethod (c$, "move", 
function (x, y) {
this.x = x;
this.y = y;
}, "~N,~N");
Clazz.defineMethod (c$, "translate", 
function (x, y) {
this.x += x;
this.y += y;
}, "~N,~N");
Clazz.defineMethod (c$, "getSize", 
function () {
return  new newawt.Dimension (this.width, this.height);
});
Clazz.defineMethod (c$, "setSize", 
function (d) {
this.setSize (d.width, d.height);
}, "newawt.Dimension");
Clazz.defineMethod (c$, "setSize", 
function (width, height) {
this.resize (width, height);
}, "~N,~N");
Clazz.defineMethod (c$, "resize", 
function (width, height) {
this.width = width;
this.height = height;
}, "~N,~N");
Clazz.defineMethod (c$, "contains", 
function (p) {
return this.contains (p.x, p.y);
}, "newawt.Point");
Clazz.defineMethod (c$, "contains", 
function (x, y) {
return this.inside (x, y);
}, "~N,~N");
Clazz.defineMethod (c$, "contains", 
function (r) {
return this.contains (r.x, r.y, r.width, r.height);
}, "newawt.Rectangle");
Clazz.defineMethod (c$, "contains", 
function (X, Y, W, H) {
var w = this.width;
var h = this.height;
if ((w | h | W | H) < 0) {
return false;
}var x = this.x;
var y = this.y;
if (X < x || Y < y) {
return false;
}w += x;
W += X;
if (W <= X) {
if (w >= x || W > w) return false;
} else {
if (w >= x && W > w) return false;
}h += y;
H += Y;
if (H <= Y) {
if (h >= y || H > h) return false;
} else {
if (h >= y && H > h) return false;
}return true;
}, "~N,~N,~N,~N");
Clazz.defineMethod (c$, "inside", 
function (X, Y) {
var w = this.width;
var h = this.height;
if ((w | h) < 0) {
return false;
}var x = this.x;
var y = this.y;
if (X < x || Y < y) {
return false;
}w += x;
h += y;
return ((w < x || w > X) && (h < y || h > Y));
}, "~N,~N");
Clazz.defineMethod (c$, "intersects", 
function (r) {
var tw = this.width;
var th = this.height;
var rw = r.width;
var rh = r.height;
if (rw <= 0 || rh <= 0 || tw <= 0 || th <= 0) {
return false;
}var tx = this.x;
var ty = this.y;
var rx = r.x;
var ry = r.y;
rw += rx;
rh += ry;
tw += tx;
th += ty;
return ((rw < rx || rw > tx) && (rh < ry || rh > ty) && (tw < tx || tw > rx) && (th < ty || th > ry));
}, "newawt.Rectangle");
Clazz.defineMethod (c$, "intersection", 
function (r) {
var tx1 = this.x;
var ty1 = this.y;
var rx1 = r.x;
var ry1 = r.y;
var tx2 = tx1;
tx2 += this.width;
var ty2 = ty1;
ty2 += this.height;
var rx2 = rx1;
rx2 += r.width;
var ry2 = ry1;
ry2 += r.height;
if (tx1 < rx1) tx1 = rx1;
if (ty1 < ry1) ty1 = ry1;
if (tx2 > rx2) tx2 = rx2;
if (ty2 > ry2) ty2 = ry2;
tx2 -= tx1;
ty2 -= ty1;
if (tx2 < -2147483648) tx2 = -2147483648;
if (ty2 < -2147483648) ty2 = -2147483648;
return  new newawt.Rectangle (tx1, ty1, tx2, ty2);
}, "newawt.Rectangle");
Clazz.defineMethod (c$, "union", 
function (r) {
var x1 = Math.min (this.x, r.x);
var x2 = Math.max (this.x + this.width, r.x + r.width);
var y1 = Math.min (this.y, r.y);
var y2 = Math.max (this.y + this.height, r.y + r.height);
return  new newawt.Rectangle (x1, y1, x2 - x1, y2 - y1);
}, "newawt.Rectangle");
Clazz.defineMethod (c$, "add", 
function (newx, newy) {
var x1 = Math.min (this.x, newx);
var x2 = Math.max (this.x + this.width, newx);
var y1 = Math.min (this.y, newy);
var y2 = Math.max (this.y + this.height, newy);
this.x = x1;
this.y = y1;
this.width = x2 - x1;
this.height = y2 - y1;
}, "~N,~N");
Clazz.defineMethod (c$, "add", 
function (pt) {
this.add (pt.x, pt.y);
}, "newawt.Point");
Clazz.defineMethod (c$, "add", 
function (r) {
var x1 = Math.min (this.x, r.x);
var x2 = Math.max (this.x + this.width, r.x + r.width);
var y1 = Math.min (this.y, r.y);
var y2 = Math.max (this.y + this.height, r.y + r.height);
this.x = x1;
this.y = y1;
this.width = x2 - x1;
this.height = y2 - y1;
}, "newawt.Rectangle");
Clazz.defineMethod (c$, "grow", 
function (h, v) {
this.x -= h;
this.y -= v;
this.width += h * 2;
this.height += v * 2;
}, "~N,~N");
Clazz.overrideMethod (c$, "isEmpty", 
function () {
return (this.width <= 0) || (this.height <= 0);
});
Clazz.defineMethod (c$, "outcode", 
function (x, y) {
var out = 0;
if (this.width <= 0) {
out |= 5;
} else if (x < this.x) {
out |= 1;
} else if (x > this.x + this.width) {
out |= 4;
}if (this.height <= 0) {
out |= 10;
} else if (y < this.y) {
out |= 2;
} else if (y > this.y + this.height) {
out |= 8;
}return out;
}, "~N,~N");
Clazz.overrideMethod (c$, "createIntersection", 
function (r) {
if (Clazz.instanceOf (r, newawt.Rectangle)) {
return this.intersection (r);
}var dest =  new newawt.Rectangle2D.Double ();
newawt.Rectangle2D.intersect (this, r, dest);
return dest;
}, "newawt.Rectangle2D");
Clazz.overrideMethod (c$, "createUnion", 
function (r) {
if (Clazz.instanceOf (r, newawt.Rectangle)) {
return this.union (r);
}var dest =  new newawt.Rectangle2D.Double ();
newawt.Rectangle2D.union (this, r, dest);
return dest;
}, "newawt.Rectangle2D");
Clazz.defineMethod (c$, "equals", 
function (obj) {
if (Clazz.instanceOf (obj, newawt.Rectangle)) {
var r = obj;
return ((this.x == r.x) && (this.y == r.y) && (this.width == r.width) && (this.height == r.height));
}return Clazz.superCall (this, newawt.Rectangle, "equals", [obj]);
}, "~O");
Clazz.overrideMethod (c$, "toString", 
function () {
return this.getClass ().getName () + "[x=" + this.x + ",y=" + this.y + ",width=" + this.width + ",height=" + this.height + "]";
});
Clazz.defineMethod (c$, "contains", 
function (p) {
return false;
}, "java.awt.geom.Point2D");
Clazz.defineMethod (c$, "intersects", 
function (r) {
return false;
}, "java.awt.geom.Rectangle2D");
Clazz.defineMethod (c$, "contains", 
function (r) {
return false;
}, "java.awt.geom.Rectangle2D");
Clazz.defineMethod (c$, "getPathIterator", 
function (at) {
return null;
}, "java.awt.geom.AffineTransform");
Clazz.defineMethod (c$, "getPathIterator", 
function (at, flatness) {
return null;
}, "java.awt.geom.AffineTransform,~N");
});
