Clazz.declarePackage ("newawt");
Clazz.load (["newawt.Shape"], "newawt.QuadCurve2D", ["java.lang.InternalError", "newawt.FlatteningPathIterator", "$.Line2D", "$.Point2D", "$.QuadIterator", "$.Rectangle2D"], function () {
c$ = Clazz.declareType (newawt, "QuadCurve2D", null, [newawt.Shape, Cloneable]);
Clazz.makeConstructor (c$, 
function () {
});
Clazz.defineMethod (c$, "setCurve", 
function (coords, offset) {
this.setCurve (coords[offset + 0], coords[offset + 1], coords[offset + 2], coords[offset + 3], coords[offset + 4], coords[offset + 5]);
}, "~A,~N");
Clazz.defineMethod (c$, "setCurve", 
function (p1, cp, p2) {
this.setCurve (p1.getX (), p1.getY (), cp.getX (), cp.getY (), p2.getX (), p2.getY ());
}, "newawt.Point2D,newawt.Point2D,newawt.Point2D");
Clazz.defineMethod (c$, "setCurve", 
function (pts, offset) {
this.setCurve (pts[offset + 0].getX (), pts[offset + 0].getY (), pts[offset + 1].getX (), pts[offset + 1].getY (), pts[offset + 2].getX (), pts[offset + 2].getY ());
}, "~A,~N");
Clazz.defineMethod (c$, "setCurve", 
function (c) {
this.setCurve (c.getX1 (), c.getY1 (), c.getCtrlX (), c.getCtrlY (), c.getX2 (), c.getY2 ());
}, "newawt.QuadCurve2D");
c$.getFlatnessSq = Clazz.defineMethod (c$, "getFlatnessSq", 
function (x1, y1, ctrlx, ctrly, x2, y2) {
return newawt.Line2D.ptSegDistSq (x1, y1, x2, y2, ctrlx, ctrly);
}, "~N,~N,~N,~N,~N,~N");
c$.getFlatness = Clazz.defineMethod (c$, "getFlatness", 
function (x1, y1, ctrlx, ctrly, x2, y2) {
return newawt.Line2D.ptSegDist (x1, y1, x2, y2, ctrlx, ctrly);
}, "~N,~N,~N,~N,~N,~N");
c$.getFlatnessSq = Clazz.defineMethod (c$, "getFlatnessSq", 
function (coords, offset) {
return newawt.Line2D.ptSegDistSq (coords[offset + 0], coords[offset + 1], coords[offset + 4], coords[offset + 5], coords[offset + 2], coords[offset + 3]);
}, "~A,~N");
c$.getFlatness = Clazz.defineMethod (c$, "getFlatness", 
function (coords, offset) {
return newawt.Line2D.ptSegDist (coords[offset + 0], coords[offset + 1], coords[offset + 4], coords[offset + 5], coords[offset + 2], coords[offset + 3]);
}, "~A,~N");
Clazz.defineMethod (c$, "getFlatnessSq", 
function () {
return newawt.Line2D.ptSegDistSq (this.getX1 (), this.getY1 (), this.getX2 (), this.getY2 (), this.getCtrlX (), this.getCtrlY ());
});
Clazz.defineMethod (c$, "getFlatness", 
function () {
return newawt.Line2D.ptSegDist (this.getX1 (), this.getY1 (), this.getX2 (), this.getY2 (), this.getCtrlX (), this.getCtrlY ());
});
Clazz.defineMethod (c$, "subdivide", 
function (left, right) {
newawt.QuadCurve2D.subdivide (this, left, right);
}, "newawt.QuadCurve2D,newawt.QuadCurve2D");
c$.subdivide = Clazz.defineMethod (c$, "subdivide", 
function (src, left, right) {
var x1 = src.getX1 ();
var y1 = src.getY1 ();
var ctrlx = src.getCtrlX ();
var ctrly = src.getCtrlY ();
var x2 = src.getX2 ();
var y2 = src.getY2 ();
var ctrlx1 = (x1 + ctrlx) / 2.0;
var ctrly1 = (y1 + ctrly) / 2.0;
var ctrlx2 = (x2 + ctrlx) / 2.0;
var ctrly2 = (y2 + ctrly) / 2.0;
ctrlx = (ctrlx1 + ctrlx2) / 2.0;
ctrly = (ctrly1 + ctrly2) / 2.0;
if (left != null) {
left.setCurve (x1, y1, ctrlx1, ctrly1, ctrlx, ctrly);
}if (right != null) {
right.setCurve (ctrlx, ctrly, ctrlx2, ctrly2, x2, y2);
}}, "newawt.QuadCurve2D,newawt.QuadCurve2D,newawt.QuadCurve2D");
c$.subdivide = Clazz.defineMethod (c$, "subdivide", 
function (src, srcoff, left, leftoff, right, rightoff) {
var x1 = src[srcoff + 0];
var y1 = src[srcoff + 1];
var ctrlx = src[srcoff + 2];
var ctrly = src[srcoff + 3];
var x2 = src[srcoff + 4];
var y2 = src[srcoff + 5];
if (left != null) {
left[leftoff + 0] = x1;
left[leftoff + 1] = y1;
}if (right != null) {
right[rightoff + 4] = x2;
right[rightoff + 5] = y2;
}x1 = (x1 + ctrlx) / 2.0;
y1 = (y1 + ctrly) / 2.0;
x2 = (x2 + ctrlx) / 2.0;
y2 = (y2 + ctrly) / 2.0;
ctrlx = (x1 + x2) / 2.0;
ctrly = (y1 + y2) / 2.0;
if (left != null) {
left[leftoff + 2] = x1;
left[leftoff + 3] = y1;
left[leftoff + 4] = ctrlx;
left[leftoff + 5] = ctrly;
}if (right != null) {
right[rightoff + 0] = ctrlx;
right[rightoff + 1] = ctrly;
right[rightoff + 2] = x2;
right[rightoff + 3] = y2;
}}, "~A,~N,~A,~N,~A,~N");
c$.solveQuadratic = Clazz.defineMethod (c$, "solveQuadratic", 
function (eqn) {
return newawt.QuadCurve2D.solveQuadratic (eqn, eqn);
}, "~A");
c$.solveQuadratic = Clazz.defineMethod (c$, "solveQuadratic", 
function (eqn, res) {
var a = eqn[2];
var b = eqn[1];
var c = eqn[0];
var roots = 0;
if (a == 0.0) {
if (b == 0.0) {
return -1;
}res[roots++] = -c / b;
} else {
var d = b * b - 4.0 * a * c;
if (d < 0.0) {
return 0;
}d = Math.sqrt (d);
if (b < 0.0) {
d = -d;
}var q = (b + d) / -2.0;
res[roots++] = q / a;
if (q != 0.0) {
res[roots++] = c / q;
}}return roots;
}, "~A,~A");
Clazz.defineMethod (c$, "contains", 
function (x, y) {
var x1 = this.getX1 ();
var y1 = this.getY1 ();
var xc = this.getCtrlX ();
var yc = this.getCtrlY ();
var x2 = this.getX2 ();
var y2 = this.getY2 ();
var kx = x1 - 2 * xc + x2;
var ky = y1 - 2 * yc + y2;
var dx = x - x1;
var dy = y - y1;
var dxl = x2 - x1;
var dyl = y2 - y1;
var t0 = (dx * ky - dy * kx) / (dxl * ky - dyl * kx);
if (t0 < 0 || t0 > 1 || t0 != t0) {
return false;
}var xb = kx * t0 * t0 + 2 * (xc - x1) * t0 + x1;
var yb = ky * t0 * t0 + 2 * (yc - y1) * t0 + y1;
var xl = dxl * t0 + x1;
var yl = dyl * t0 + y1;
return (x >= xb && x < xl) || (x >= xl && x < xb) || (y >= yb && y < yl) || (y >= yl && y < yb);
}, "~N,~N");
Clazz.defineMethod (c$, "contains", 
function (p) {
return this.contains (p.getX (), p.getY ());
}, "newawt.Point2D");
c$.fillEqn = Clazz.defineMethod (c$, "fillEqn", 
($fz = function (eqn, val, c1, cp, c2) {
eqn[0] = c1 - val;
eqn[1] = cp + cp - c1 - c1;
eqn[2] = c1 - cp - cp + c2;
return ;
}, $fz.isPrivate = true, $fz), "~A,~N,~N,~N,~N");
c$.evalQuadratic = Clazz.defineMethod (c$, "evalQuadratic", 
($fz = function (vals, num, include0, include1, inflect, c1, ctrl, c2) {
var j = 0;
for (var i = 0; i < num; i++) {
var t = vals[i];
if ((include0 ? t >= 0 : t > 0) && (include1 ? t <= 1 : t < 1) && (inflect == null || inflect[1] + 2 * inflect[2] * t != 0)) {
var u = 1 - t;
vals[j++] = c1 * u * u + 2 * ctrl * t * u + c2 * t * t;
}}
return j;
}, $fz.isPrivate = true, $fz), "~A,~N,~B,~B,~A,~N,~N,~N");
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
var x1tag = newawt.QuadCurve2D.getTag (x1, x, x + w);
var y1tag = newawt.QuadCurve2D.getTag (y1, y, y + h);
if (x1tag == 0 && y1tag == 0) {
return true;
}var x2 = this.getX2 ();
var y2 = this.getY2 ();
var x2tag = newawt.QuadCurve2D.getTag (x2, x, x + w);
var y2tag = newawt.QuadCurve2D.getTag (y2, y, y + h);
if (x2tag == 0 && y2tag == 0) {
return true;
}var ctrlx = this.getCtrlX ();
var ctrly = this.getCtrlY ();
var ctrlxtag = newawt.QuadCurve2D.getTag (ctrlx, x, x + w);
var ctrlytag = newawt.QuadCurve2D.getTag (ctrly, y, y + h);
if (x1tag < 0 && x2tag < 0 && ctrlxtag < 0) {
return false;
}if (y1tag < 0 && y2tag < 0 && ctrlytag < 0) {
return false;
}if (x1tag > 0 && x2tag > 0 && ctrlxtag > 0) {
return false;
}if (y1tag > 0 && y2tag > 0 && ctrlytag > 0) {
return false;
}if (newawt.QuadCurve2D.inwards (x1tag, x2tag, ctrlxtag) && newawt.QuadCurve2D.inwards (y1tag, y2tag, ctrlytag)) {
return true;
}if (newawt.QuadCurve2D.inwards (x2tag, x1tag, ctrlxtag) && newawt.QuadCurve2D.inwards (y2tag, y1tag, ctrlytag)) {
return true;
}var xoverlap = (x1tag * x2tag <= 0);
var yoverlap = (y1tag * y2tag <= 0);
if (x1tag == 0 && x2tag == 0 && yoverlap) {
return true;
}if (y1tag == 0 && y2tag == 0 && xoverlap) {
return true;
}var eqn =  Clazz.newArray (3, 0);
var res =  Clazz.newArray (3, 0);
if (!yoverlap) {
newawt.QuadCurve2D.fillEqn (eqn, (y1tag < 0 ? y : y + h), y1, ctrly, y2);
return (newawt.QuadCurve2D.solveQuadratic (eqn, res) == 2 && newawt.QuadCurve2D.evalQuadratic (res, 2, true, true, null, x1, ctrlx, x2) == 2 && newawt.QuadCurve2D.getTag (res[0], x, x + w) * newawt.QuadCurve2D.getTag (res[1], x, x + w) <= 0);
}if (!xoverlap) {
newawt.QuadCurve2D.fillEqn (eqn, (x1tag < 0 ? x : x + w), x1, ctrlx, x2);
return (newawt.QuadCurve2D.solveQuadratic (eqn, res) == 2 && newawt.QuadCurve2D.evalQuadratic (res, 2, true, true, null, y1, ctrly, y2) == 2 && newawt.QuadCurve2D.getTag (res[0], y, y + h) * newawt.QuadCurve2D.getTag (res[1], y, y + h) <= 0);
}var dx = x2 - x1;
var dy = y2 - y1;
var k = y2 * x1 - x2 * y1;
var c1tag;
var c2tag;
if (y1tag == 0) {
c1tag = x1tag;
} else {
c1tag = newawt.QuadCurve2D.getTag ((k + dx * (y1tag < 0 ? y : y + h)) / dy, x, x + w);
}if (y2tag == 0) {
c2tag = x2tag;
} else {
c2tag = newawt.QuadCurve2D.getTag ((k + dx * (y2tag < 0 ? y : y + h)) / dy, x, x + w);
}if (c1tag * c2tag <= 0) {
return true;
}c1tag = ((c1tag * x1tag <= 0) ? y1tag : y2tag);
newawt.QuadCurve2D.fillEqn (eqn, (c2tag < 0 ? x : x + w), x1, ctrlx, x2);
var num = newawt.QuadCurve2D.solveQuadratic (eqn, res);
newawt.QuadCurve2D.evalQuadratic (res, num, true, true, null, y1, ctrly, y2);
c2tag = newawt.QuadCurve2D.getTag (res[0], y, y + h);
return (c1tag * c2tag <= 0);
}, "~N,~N,~N,~N");
Clazz.defineMethod (c$, "intersects", 
function (r) {
return this.intersects (r.getX (), r.getY (), r.getWidth (), r.getHeight ());
}, "newawt.Rectangle2D");
Clazz.defineMethod (c$, "contains", 
function (x, y, w, h) {
return (this.contains (x, y) && this.contains (x + w, y) && this.contains (x + w, y + h) && this.contains (x, y + h));
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
return  new newawt.QuadIterator (this, at);
}, "newawt.AffineTransform");
Clazz.defineMethod (c$, "getPathIterator", 
function (at, flatness) {
return  new newawt.FlatteningPathIterator (this.getPathIterator (at), flatness);
}, "newawt.AffineTransform,~N");
Clazz.defineMethod (c$, "clone", 
function () {
try {
return Clazz.superCall (this, newawt.QuadCurve2D, "clone", []);
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
this.ctrlx = 0;
this.ctrly = 0;
this.x2 = 0;
this.y2 = 0;
Clazz.instantialize (this, arguments);
}, newawt.QuadCurve2D, "Float", newawt.QuadCurve2D);
Clazz.makeConstructor (c$, 
function () {
Clazz.superConstructor (this, newawt.QuadCurve2D.Float, []);
});
Clazz.makeConstructor (c$, 
function (a, b, c, d, e, f) {
Clazz.superConstructor (this, newawt.QuadCurve2D.Float, []);
this.setCurve (a, b, c, d, e, f);
}, "~N,~N,~N,~N,~N,~N");
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
Clazz.overrideMethod (c$, "getCtrlX", 
function () {
return this.ctrlx;
});
Clazz.overrideMethod (c$, "getCtrlY", 
function () {
return this.ctrly;
});
Clazz.overrideMethod (c$, "getCtrlPt", 
function () {
return  new newawt.Point2D.Float (this.ctrlx, this.ctrly);
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
function (a, b, c, d, e, f) {
this.x1 = a;
this.y1 = b;
this.ctrlx = c;
this.ctrly = d;
this.x2 = e;
this.y2 = f;
}, "~N,~N,~N,~N,~N,~N");
Clazz.defineMethod (c$, "setCurve", 
function (a, b, c, d, e, f) {
this.x1 = a;
this.y1 = b;
this.ctrlx = c;
this.ctrly = d;
this.x2 = e;
this.y2 = f;
}, "~N,~N,~N,~N,~N,~N");
Clazz.overrideMethod (c$, "getBounds2D", 
function () {
var a = Math.min (Math.min (this.x1, this.x2), this.ctrlx);
var b = Math.min (Math.min (this.y1, this.y2), this.ctrly);
var c = Math.max (Math.max (this.x1, this.x2), this.ctrlx);
var d = Math.max (Math.max (this.y1, this.y2), this.ctrly);
return  new newawt.Rectangle2D.Float (a, b, c - a, d - b);
});
c$ = Clazz.p0p ();
Clazz.pu$h ();
c$ = Clazz.decorateAsClass (function () {
this.x1 = 0;
this.y1 = 0;
this.ctrlx = 0;
this.ctrly = 0;
this.x2 = 0;
this.y2 = 0;
Clazz.instantialize (this, arguments);
}, newawt.QuadCurve2D, "Double", newawt.QuadCurve2D);
Clazz.makeConstructor (c$, 
function () {
Clazz.superConstructor (this, newawt.QuadCurve2D.Double, []);
});
Clazz.makeConstructor (c$, 
function (a, b, c, d, e, f) {
Clazz.superConstructor (this, newawt.QuadCurve2D.Double, []);
this.setCurve (a, b, c, d, e, f);
}, "~N,~N,~N,~N,~N,~N");
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
Clazz.overrideMethod (c$, "getCtrlX", 
function () {
return this.ctrlx;
});
Clazz.overrideMethod (c$, "getCtrlY", 
function () {
return this.ctrly;
});
Clazz.overrideMethod (c$, "getCtrlPt", 
function () {
return  new newawt.Point2D.Double (this.ctrlx, this.ctrly);
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
function (a, b, c, d, e, f) {
this.x1 = a;
this.y1 = b;
this.ctrlx = c;
this.ctrly = d;
this.x2 = e;
this.y2 = f;
}, "~N,~N,~N,~N,~N,~N");
Clazz.overrideMethod (c$, "getBounds2D", 
function () {
var a = Math.min (Math.min (this.x1, this.x2), this.ctrlx);
var b = Math.min (Math.min (this.y1, this.y2), this.ctrly);
var c = Math.max (Math.max (this.x1, this.x2), this.ctrlx);
var d = Math.max (Math.max (this.y1, this.y2), this.ctrly);
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
