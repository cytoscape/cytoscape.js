Clazz.declarePackage ("newawt");
Clazz.load (["newawt.Shape"], "newawt.CubicCurve2D", ["java.lang.InternalError", "java.util.Arrays", "newawt.CubicIterator", "$.FlatteningPathIterator", "$.Line2D", "$.Point2D", "$.QuadCurve2D", "$.Rectangle2D"], function () {
c$ = Clazz.declareType (newawt, "CubicCurve2D", null, [newawt.Shape, Cloneable]);
Clazz.makeConstructor (c$, 
function () {
});
Clazz.defineMethod (c$, "setCurve", 
function (coords, offset) {
this.setCurve (coords[offset + 0], coords[offset + 1], coords[offset + 2], coords[offset + 3], coords[offset + 4], coords[offset + 5], coords[offset + 6], coords[offset + 7]);
}, "~A,~N");
Clazz.defineMethod (c$, "setCurve", 
function (p1, cp1, cp2, p2) {
this.setCurve (p1.getX (), p1.getY (), cp1.getX (), cp1.getY (), cp2.getX (), cp2.getY (), p2.getX (), p2.getY ());
}, "newawt.Point2D,newawt.Point2D,newawt.Point2D,newawt.Point2D");
Clazz.defineMethod (c$, "setCurve", 
function (pts, offset) {
this.setCurve (pts[offset + 0].getX (), pts[offset + 0].getY (), pts[offset + 1].getX (), pts[offset + 1].getY (), pts[offset + 2].getX (), pts[offset + 2].getY (), pts[offset + 3].getX (), pts[offset + 3].getY ());
}, "~A,~N");
Clazz.defineMethod (c$, "setCurve", 
function (c) {
this.setCurve (c.getX1 (), c.getY1 (), c.getCtrlX1 (), c.getCtrlY1 (), c.getCtrlX2 (), c.getCtrlY2 (), c.getX2 (), c.getY2 ());
}, "newawt.CubicCurve2D");
c$.getFlatnessSq = Clazz.defineMethod (c$, "getFlatnessSq", 
function (x1, y1, ctrlx1, ctrly1, ctrlx2, ctrly2, x2, y2) {
return Math.max (newawt.Line2D.ptSegDistSq (x1, y1, x2, y2, ctrlx1, ctrly1), newawt.Line2D.ptSegDistSq (x1, y1, x2, y2, ctrlx2, ctrly2));
}, "~N,~N,~N,~N,~N,~N,~N,~N");
c$.getFlatness = Clazz.defineMethod (c$, "getFlatness", 
function (x1, y1, ctrlx1, ctrly1, ctrlx2, ctrly2, x2, y2) {
return Math.sqrt (newawt.CubicCurve2D.getFlatnessSq (x1, y1, ctrlx1, ctrly1, ctrlx2, ctrly2, x2, y2));
}, "~N,~N,~N,~N,~N,~N,~N,~N");
c$.getFlatnessSq = Clazz.defineMethod (c$, "getFlatnessSq", 
function (coords, offset) {
return newawt.CubicCurve2D.getFlatnessSq (coords[offset + 0], coords[offset + 1], coords[offset + 2], coords[offset + 3], coords[offset + 4], coords[offset + 5], coords[offset + 6], coords[offset + 7]);
}, "~A,~N");
c$.getFlatness = Clazz.defineMethod (c$, "getFlatness", 
function (coords, offset) {
return newawt.CubicCurve2D.getFlatness (coords[offset + 0], coords[offset + 1], coords[offset + 2], coords[offset + 3], coords[offset + 4], coords[offset + 5], coords[offset + 6], coords[offset + 7]);
}, "~A,~N");
Clazz.defineMethod (c$, "getFlatnessSq", 
function () {
return newawt.CubicCurve2D.getFlatnessSq (this.getX1 (), this.getY1 (), this.getCtrlX1 (), this.getCtrlY1 (), this.getCtrlX2 (), this.getCtrlY2 (), this.getX2 (), this.getY2 ());
});
Clazz.defineMethod (c$, "getFlatness", 
function () {
return newawt.CubicCurve2D.getFlatness (this.getX1 (), this.getY1 (), this.getCtrlX1 (), this.getCtrlY1 (), this.getCtrlX2 (), this.getCtrlY2 (), this.getX2 (), this.getY2 ());
});
Clazz.defineMethod (c$, "subdivide", 
function (left, right) {
newawt.CubicCurve2D.subdivide (this, left, right);
}, "newawt.CubicCurve2D,newawt.CubicCurve2D");
c$.subdivide = Clazz.defineMethod (c$, "subdivide", 
function (src, left, right) {
var x1 = src.getX1 ();
var y1 = src.getY1 ();
var ctrlx1 = src.getCtrlX1 ();
var ctrly1 = src.getCtrlY1 ();
var ctrlx2 = src.getCtrlX2 ();
var ctrly2 = src.getCtrlY2 ();
var x2 = src.getX2 ();
var y2 = src.getY2 ();
var centerx = (ctrlx1 + ctrlx2) / 2.0;
var centery = (ctrly1 + ctrly2) / 2.0;
ctrlx1 = (x1 + ctrlx1) / 2.0;
ctrly1 = (y1 + ctrly1) / 2.0;
ctrlx2 = (x2 + ctrlx2) / 2.0;
ctrly2 = (y2 + ctrly2) / 2.0;
var ctrlx12 = (ctrlx1 + centerx) / 2.0;
var ctrly12 = (ctrly1 + centery) / 2.0;
var ctrlx21 = (ctrlx2 + centerx) / 2.0;
var ctrly21 = (ctrly2 + centery) / 2.0;
centerx = (ctrlx12 + ctrlx21) / 2.0;
centery = (ctrly12 + ctrly21) / 2.0;
if (left != null) {
left.setCurve (x1, y1, ctrlx1, ctrly1, ctrlx12, ctrly12, centerx, centery);
}if (right != null) {
right.setCurve (centerx, centery, ctrlx21, ctrly21, ctrlx2, ctrly2, x2, y2);
}}, "newawt.CubicCurve2D,newawt.CubicCurve2D,newawt.CubicCurve2D");
c$.subdivide = Clazz.defineMethod (c$, "subdivide", 
function (src, srcoff, left, leftoff, right, rightoff) {
var x1 = src[srcoff + 0];
var y1 = src[srcoff + 1];
var ctrlx1 = src[srcoff + 2];
var ctrly1 = src[srcoff + 3];
var ctrlx2 = src[srcoff + 4];
var ctrly2 = src[srcoff + 5];
var x2 = src[srcoff + 6];
var y2 = src[srcoff + 7];
if (left != null) {
left[leftoff + 0] = x1;
left[leftoff + 1] = y1;
}if (right != null) {
right[rightoff + 6] = x2;
right[rightoff + 7] = y2;
}x1 = (x1 + ctrlx1) / 2.0;
y1 = (y1 + ctrly1) / 2.0;
x2 = (x2 + ctrlx2) / 2.0;
y2 = (y2 + ctrly2) / 2.0;
var centerx = (ctrlx1 + ctrlx2) / 2.0;
var centery = (ctrly1 + ctrly2) / 2.0;
ctrlx1 = (x1 + centerx) / 2.0;
ctrly1 = (y1 + centery) / 2.0;
ctrlx2 = (x2 + centerx) / 2.0;
ctrly2 = (y2 + centery) / 2.0;
centerx = (ctrlx1 + ctrlx2) / 2.0;
centery = (ctrly1 + ctrly2) / 2.0;
if (left != null) {
left[leftoff + 2] = x1;
left[leftoff + 3] = y1;
left[leftoff + 4] = ctrlx1;
left[leftoff + 5] = ctrly1;
left[leftoff + 6] = centerx;
left[leftoff + 7] = centery;
}if (right != null) {
right[rightoff + 0] = centerx;
right[rightoff + 1] = centery;
right[rightoff + 2] = ctrlx2;
right[rightoff + 3] = ctrly2;
right[rightoff + 4] = x2;
right[rightoff + 5] = y2;
}}, "~A,~N,~A,~N,~A,~N");
c$.solveCubic = Clazz.defineMethod (c$, "solveCubic", 
function (eqn) {
return newawt.CubicCurve2D.solveCubic (eqn, eqn);
}, "~A");
c$.solveCubic = Clazz.defineMethod (c$, "solveCubic", 
function (eqn, res) {
var d = eqn[3];
if (d == 0.0) {
return newawt.QuadCurve2D.solveQuadratic (eqn, res);
}var a = eqn[2] / d;
var b = eqn[1] / d;
var c = eqn[0] / d;
var roots = 0;
var Q = (a * a - 3.0 * b) / 9.0;
var R = (2.0 * a * a * a - 9.0 * a * b + 27.0 * c) / 54.0;
var R2 = R * R;
var Q3 = Q * Q * Q;
a = a / 3.0;
if (R2 < Q3) {
var theta = Math.acos (R / Math.sqrt (Q3));
Q = -2.0 * Math.sqrt (Q);
if (res === eqn) {
eqn =  Clazz.newArray (4, 0);
System.arraycopy (res, 0, eqn, 0, 4);
}res[roots++] = Q * Math.cos (theta / 3.0) - a;
res[roots++] = Q * Math.cos ((theta + 6.283185307179586) / 3.0) - a;
res[roots++] = Q * Math.cos ((theta - 6.283185307179586) / 3.0) - a;
newawt.CubicCurve2D.fixRoots (res, eqn);
} else {
var neg = (R < 0.0);
var S = Math.sqrt (R2 - Q3);
if (neg) {
R = -R;
}var A = Math.pow (R + S, 0.3333333333333333);
if (!neg) {
A = -A;
}var B = (A == 0.0) ? 0.0 : (Q / A);
res[roots++] = (A + B) - a;
}return roots;
}, "~A,~A");
c$.fixRoots = Clazz.defineMethod (c$, "fixRoots", 
($fz = function (res, eqn) {
var EPSILON = 1E-5;
for (var i = 0; i < 3; i++) {
var t = res[i];
if (Math.abs (t) < 1.0E-5) {
res[i] = newawt.CubicCurve2D.findZero (t, 0, eqn);
} else if (Math.abs (t - 1) < 1.0E-5) {
res[i] = newawt.CubicCurve2D.findZero (t, 1, eqn);
}}
}, $fz.isPrivate = true, $fz), "~A,~A");
c$.solveEqn = Clazz.defineMethod (c$, "solveEqn", 
($fz = function (eqn, order, t) {
var v = eqn[order];
while (--order >= 0) {
v = v * t + eqn[order];
}
return v;
}, $fz.isPrivate = true, $fz), "~A,~N,~N");
c$.findZero = Clazz.defineMethod (c$, "findZero", 
($fz = function (t, target, eqn) {
var slopeqn = [eqn[1], 2 * eqn[2], 3 * eqn[3]];
var slope;
var origdelta = 0;
var origt = t;
while (true) {
slope = newawt.CubicCurve2D.solveEqn (slopeqn, 2, t);
if (slope == 0) {
return t;
}var y = newawt.CubicCurve2D.solveEqn (eqn, 3, t);
if (y == 0) {
return t;
}var delta = -(y / slope);
if (origdelta == 0) {
origdelta = delta;
}if (t < target) {
if (delta < 0) return t;
} else if (t > target) {
if (delta > 0) return t;
} else {
return (delta > 0 ? (target + 4.9E-324) : (target - 4.9E-324));
}var newt = t + delta;
if (t == newt) {
return t;
}if (delta * origdelta < 0) {
var tag = (origt < t ? newawt.CubicCurve2D.getTag (target, origt, t) : newawt.CubicCurve2D.getTag (target, t, origt));
if (tag != 0) {
return (origt + t) / 2;
}t = target;
} else {
t = newt;
}}
}, $fz.isPrivate = true, $fz), "~N,~N,~A");
Clazz.defineMethod (c$, "contains", 
function (x, y) {
var crossings = 0;
var x1 = this.getX1 ();
var y1 = this.getY1 ();
var x2 = this.getX2 ();
var y2 = this.getY2 ();
var dy = y2 - y1;
if ((dy > 0.0 && y >= y1 && y <= y2) || (dy < 0.0 && y <= y1 && y >= y2)) {
if (x < x1 + (y - y1) * (x2 - x1) / dy) {
crossings++;
}}var ctrlx1 = this.getCtrlX1 ();
var ctrly1 = this.getCtrlY1 ();
var ctrlx2 = this.getCtrlX2 ();
var ctrly2 = this.getCtrlY2 ();
var include0 = ((y2 - y1) * (ctrly1 - y1) >= 0);
var include1 = ((y1 - y2) * (ctrly2 - y2) >= 0);
var eqn =  Clazz.newArray (4, 0);
var res =  Clazz.newArray (4, 0);
newawt.CubicCurve2D.fillEqn (eqn, y, y1, ctrly1, ctrly2, y2);
var roots = newawt.CubicCurve2D.solveCubic (eqn, res);
roots = newawt.CubicCurve2D.evalCubic (res, roots, include0, include1, eqn, x1, ctrlx1, ctrlx2, x2);
while (--roots >= 0) {
if (x < res[roots]) {
crossings++;
}}
return ((crossings & 1) == 1);
}, "~N,~N");
Clazz.defineMethod (c$, "contains", 
function (p) {
return this.contains (p.getX (), p.getY ());
}, "newawt.Point2D");
c$.fillEqn = Clazz.defineMethod (c$, "fillEqn", 
($fz = function (eqn, val, c1, cp1, cp2, c2) {
eqn[0] = c1 - val;
eqn[1] = (cp1 - c1) * 3.0;
eqn[2] = (cp2 - cp1 - cp1 + c1) * 3.0;
eqn[3] = c2 + (cp1 - cp2) * 3.0 - c1;
return ;
}, $fz.isPrivate = true, $fz), "~A,~N,~N,~N,~N,~N");
c$.evalCubic = Clazz.defineMethod (c$, "evalCubic", 
($fz = function (vals, num, include0, include1, inflect, c1, cp1, cp2, c2) {
var j = 0;
for (var i = 0; i < num; i++) {
var t = vals[i];
if ((include0 ? t >= 0 : t > 0) && (include1 ? t <= 1 : t < 1) && (inflect == null || inflect[1] + (2 * inflect[2] + 3 * inflect[3] * t) * t != 0)) {
var u = 1 - t;
vals[j++] = c1 * u * u * u + 3 * cp1 * t * u * u + 3 * cp2 * t * t * u + c2 * t * t * t;
}}
return j;
}, $fz.isPrivate = true, $fz), "~A,~N,~B,~B,~A,~N,~N,~N,~N");
c$.getTag = Clazz.defineMethod (c$, "getTag", 
($fz = function (coord, low, high) {
if (coord <= low) {
return (coord < low ? -2 : -1);
}if (coord >= high) {
return (coord > high ? 2 : 1);
}return 0;
}, $fz.isPrivate = true, $fz), "~N,~N,~N");
c$.inwards = Clazz.defineMethod (c$, "inwards", 
($fz = function (pttag, opt1tag, opt2tag) {
switch (pttag) {
case -2:
case 2:
default:
return false;
case -1:
return (opt1tag >= 0 || opt2tag >= 0);
case 0:
return true;
case 1:
return (opt1tag <= 0 || opt2tag <= 0);
}
}, $fz.isPrivate = true, $fz), "~N,~N,~N");
Clazz.defineMethod (c$, "intersects", 
function (x, y, w, h) {
if (w < 0 || h < 0) {
return false;
}var x1 = this.getX1 ();
var y1 = this.getY1 ();
var x1tag = newawt.CubicCurve2D.getTag (x1, x, x + w);
var y1tag = newawt.CubicCurve2D.getTag (y1, y, y + h);
if (x1tag == 0 && y1tag == 0) {
return true;
}var x2 = this.getX2 ();
var y2 = this.getY2 ();
var x2tag = newawt.CubicCurve2D.getTag (x2, x, x + w);
var y2tag = newawt.CubicCurve2D.getTag (y2, y, y + h);
if (x2tag == 0 && y2tag == 0) {
return true;
}var ctrlx1 = this.getCtrlX1 ();
var ctrly1 = this.getCtrlY1 ();
var ctrlx2 = this.getCtrlX2 ();
var ctrly2 = this.getCtrlY2 ();
var ctrlx1tag = newawt.CubicCurve2D.getTag (ctrlx1, x, x + w);
var ctrly1tag = newawt.CubicCurve2D.getTag (ctrly1, y, y + h);
var ctrlx2tag = newawt.CubicCurve2D.getTag (ctrlx2, x, x + w);
var ctrly2tag = newawt.CubicCurve2D.getTag (ctrly2, y, y + h);
if (x1tag < 0 && x2tag < 0 && ctrlx1tag < 0 && ctrlx2tag < 0) {
return false;
}if (y1tag < 0 && y2tag < 0 && ctrly1tag < 0 && ctrly2tag < 0) {
return false;
}if (x1tag > 0 && x2tag > 0 && ctrlx1tag > 0 && ctrlx2tag > 0) {
return false;
}if (y1tag > 0 && y2tag > 0 && ctrly1tag > 0 && ctrly2tag > 0) {
return false;
}if (newawt.CubicCurve2D.inwards (x1tag, x2tag, ctrlx1tag) && newawt.CubicCurve2D.inwards (y1tag, y2tag, ctrly1tag)) {
return true;
}if (newawt.CubicCurve2D.inwards (x2tag, x1tag, ctrlx2tag) && newawt.CubicCurve2D.inwards (y2tag, y1tag, ctrly2tag)) {
return true;
}var xoverlap = (x1tag * x2tag <= 0);
var yoverlap = (y1tag * y2tag <= 0);
if (x1tag == 0 && x2tag == 0 && yoverlap) {
return true;
}if (y1tag == 0 && y2tag == 0 && xoverlap) {
return true;
}var eqn =  Clazz.newArray (4, 0);
var res =  Clazz.newArray (4, 0);
if (!yoverlap) {
newawt.CubicCurve2D.fillEqn (eqn, (y1tag < 0 ? y : y + h), y1, ctrly1, ctrly2, y2);
var num = newawt.CubicCurve2D.solveCubic (eqn, res);
num = newawt.CubicCurve2D.evalCubic (res, num, true, true, null, x1, ctrlx1, ctrlx2, x2);
return (num == 2 && newawt.CubicCurve2D.getTag (res[0], x, x + w) * newawt.CubicCurve2D.getTag (res[1], x, x + w) <= 0);
}if (!xoverlap) {
newawt.CubicCurve2D.fillEqn (eqn, (x1tag < 0 ? x : x + w), x1, ctrlx1, ctrlx2, x2);
var num = newawt.CubicCurve2D.solveCubic (eqn, res);
num = newawt.CubicCurve2D.evalCubic (res, num, true, true, null, y1, ctrly1, ctrly2, y2);
return (num == 2 && newawt.CubicCurve2D.getTag (res[0], y, y + h) * newawt.CubicCurve2D.getTag (res[1], y, y + h) <= 0);
}var dx = x2 - x1;
var dy = y2 - y1;
var k = y2 * x1 - x2 * y1;
var c1tag;
var c2tag;
if (y1tag == 0) {
c1tag = x1tag;
} else {
c1tag = newawt.CubicCurve2D.getTag ((k + dx * (y1tag < 0 ? y : y + h)) / dy, x, x + w);
}if (y2tag == 0) {
c2tag = x2tag;
} else {
c2tag = newawt.CubicCurve2D.getTag ((k + dx * (y2tag < 0 ? y : y + h)) / dy, x, x + w);
}if (c1tag * c2tag <= 0) {
return true;
}c1tag = ((c1tag * x1tag <= 0) ? y1tag : y2tag);
newawt.CubicCurve2D.fillEqn (eqn, (c2tag < 0 ? x : x + w), x1, ctrlx1, ctrlx2, x2);
var num = newawt.CubicCurve2D.solveCubic (eqn, res);
num = newawt.CubicCurve2D.evalCubic (res, num, true, true, null, y1, ctrly1, ctrly2, y2);
var tags =  Clazz.newArray (num + 1, 0);
for (var i = 0; i < num; i++) {
tags[i] = newawt.CubicCurve2D.getTag (res[i], y, y + h);
}
tags[num] = c1tag;
java.util.Arrays.sort (tags);
return ((num >= 1 && tags[0] * tags[1] <= 0) || (num >= 3 && tags[2] * tags[3] <= 0));
}, "~N,~N,~N,~N");
Clazz.defineMethod (c$, "intersects", 
function (r) {
return this.intersects (r.getX (), r.getY (), r.getWidth (), r.getHeight ());
}, "newawt.Rectangle2D");
Clazz.defineMethod (c$, "contains", 
function (x, y, w, h) {
if (!(this.contains (x, y) && this.contains (x + w, y) && this.contains (x + w, y + h) && this.contains (x, y + h))) {
return false;
}var rect =  new newawt.Rectangle2D.Double (x, y, w, h);
return !rect.intersectsLine (this.getX1 (), this.getY1 (), this.getX2 (), this.getY2 ());
}, "~N,~N,~N,~N");
Clazz.defineMethod (c$, "contains", 
function (r) {
return this.contains (r.getX (), r.getY (), r.getWidth (), r.getHeight ());
}, "newawt.Rectangle2D");
Clazz.overrideMethod (c$, "getBounds", 
function () {
return this.getBounds2D ().getBounds ();
});
Clazz.defineMethod (c$, "getPathIterator", 
function (at) {
return  new newawt.CubicIterator (this, at);
}, "newawt.AffineTransform");
Clazz.defineMethod (c$, "getPathIterator", 
function (at, flatness) {
return  new newawt.FlatteningPathIterator (this.getPathIterator (at), flatness);
}, "newawt.AffineTransform,~N");
Clazz.defineMethod (c$, "clone", 
function () {
try {
return Clazz.superCall (this, newawt.CubicCurve2D, "clone", []);
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
this.ctrlx1 = 0;
this.ctrly1 = 0;
this.ctrlx2 = 0;
this.ctrly2 = 0;
this.x2 = 0;
this.y2 = 0;
Clazz.instantialize (this, arguments);
}, newawt.CubicCurve2D, "Float", newawt.CubicCurve2D);
Clazz.makeConstructor (c$, 
function () {
Clazz.superConstructor (this, newawt.CubicCurve2D.Float, []);
});
Clazz.makeConstructor (c$, 
function (a, b, c, d, e, f, g, h) {
Clazz.superConstructor (this, newawt.CubicCurve2D.Float, []);
this.setCurve (a, b, c, d, e, f, g, h);
}, "~N,~N,~N,~N,~N,~N,~N,~N");
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
Clazz.overrideMethod (c$, "getCtrlX1", 
function () {
return this.ctrlx1;
});
Clazz.overrideMethod (c$, "getCtrlY1", 
function () {
return this.ctrly1;
});
Clazz.overrideMethod (c$, "getCtrlP1", 
function () {
return  new newawt.Point2D.Float (this.ctrlx1, this.ctrly1);
});
Clazz.overrideMethod (c$, "getCtrlX2", 
function () {
return this.ctrlx2;
});
Clazz.overrideMethod (c$, "getCtrlY2", 
function () {
return this.ctrly2;
});
Clazz.overrideMethod (c$, "getCtrlP2", 
function () {
return  new newawt.Point2D.Float (this.ctrlx2, this.ctrly2);
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
Clazz.defineMethod (c$, "setCurve", 
function (a, b, c, d, e, f, g, h) {
this.x1 = a;
this.y1 = b;
this.ctrlx1 = c;
this.ctrly1 = d;
this.ctrlx2 = e;
this.ctrly2 = f;
this.x2 = g;
this.y2 = h;
}, "~N,~N,~N,~N,~N,~N,~N,~N");
Clazz.defineMethod (c$, "setCurve", 
function (a, b, c, d, e, f, g, h) {
this.x1 = a;
this.y1 = b;
this.ctrlx1 = c;
this.ctrly1 = d;
this.ctrlx2 = e;
this.ctrly2 = f;
this.x2 = g;
this.y2 = h;
}, "~N,~N,~N,~N,~N,~N,~N,~N");
Clazz.overrideMethod (c$, "getBounds2D", 
function () {
var a = Math.min (Math.min (this.x1, this.x2), Math.min (this.ctrlx1, this.ctrlx2));
var b = Math.min (Math.min (this.y1, this.y2), Math.min (this.ctrly1, this.ctrly2));
var c = Math.max (Math.max (this.x1, this.x2), Math.max (this.ctrlx1, this.ctrlx2));
var d = Math.max (Math.max (this.y1, this.y2), Math.max (this.ctrly1, this.ctrly2));
return  new newawt.Rectangle2D.Float (a, b, c - a, d - b);
});
c$ = Clazz.p0p ();
Clazz.pu$h ();
c$ = Clazz.decorateAsClass (function () {
this.x1 = 0;
this.y1 = 0;
this.ctrlx1 = 0;
this.ctrly1 = 0;
this.ctrlx2 = 0;
this.ctrly2 = 0;
this.x2 = 0;
this.y2 = 0;
Clazz.instantialize (this, arguments);
}, newawt.CubicCurve2D, "Double", newawt.CubicCurve2D);
Clazz.makeConstructor (c$, 
function () {
Clazz.superConstructor (this, newawt.CubicCurve2D.Double, []);
});
Clazz.makeConstructor (c$, 
function (a, b, c, d, e, f, g, h) {
Clazz.superConstructor (this, newawt.CubicCurve2D.Double, []);
this.setCurve (a, b, c, d, e, f, g, h);
}, "~N,~N,~N,~N,~N,~N,~N,~N");
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
Clazz.overrideMethod (c$, "getCtrlX1", 
function () {
return this.ctrlx1;
});
Clazz.overrideMethod (c$, "getCtrlY1", 
function () {
return this.ctrly1;
});
Clazz.overrideMethod (c$, "getCtrlP1", 
function () {
return  new newawt.Point2D.Double (this.ctrlx1, this.ctrly1);
});
Clazz.overrideMethod (c$, "getCtrlX2", 
function () {
return this.ctrlx2;
});
Clazz.overrideMethod (c$, "getCtrlY2", 
function () {
return this.ctrly2;
});
Clazz.overrideMethod (c$, "getCtrlP2", 
function () {
return  new newawt.Point2D.Double (this.ctrlx2, this.ctrly2);
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
Clazz.defineMethod (c$, "setCurve", 
function (a, b, c, d, e, f, g, h) {
this.x1 = a;
this.y1 = b;
this.ctrlx1 = c;
this.ctrly1 = d;
this.ctrlx2 = e;
this.ctrly2 = f;
this.x2 = g;
this.y2 = h;
}, "~N,~N,~N,~N,~N,~N,~N,~N");
Clazz.overrideMethod (c$, "getBounds2D", 
function () {
var a = Math.min (Math.min (this.x1, this.x2), Math.min (this.ctrlx1, this.ctrlx2));
var b = Math.min (Math.min (this.y1, this.y2), Math.min (this.ctrly1, this.ctrly2));
var c = Math.max (Math.max (this.x1, this.x2), Math.max (this.ctrlx1, this.ctrlx2));
var d = Math.max (Math.max (this.y1, this.y2), Math.max (this.ctrly1, this.ctrly2));
return  new newawt.Rectangle2D.Double (a, b, c - a, d - b);
});
c$ = Clazz.p0p ();
Clazz.defineStatics (c$,
"BELOW", -2,
"LOWEDGE", -1,
"INSIDE", 0,
"HIGHEDGE", 1,
"ABOVE", 2);
});
