Clazz.declarePackage ("newawt");
Clazz.load (["newawt.Shape"], "newawt.GeneralPath", ["java.lang.IllegalArgumentException", "$.InternalError", "newawt.FlatteningPathIterator", "$.GeneralPathIterator", "$.IllegalPathStateException", "$.Point2D", "$.Rectangle2D"], function () {
c$ = Clazz.decorateAsClass (function () {
this.pointTypes = null;
this.pointCoords = null;
this.numTypes = 0;
this.numCoords = 0;
this.windingRule = 0;
Clazz.instantialize (this, arguments);
}, newawt, "GeneralPath", null, [newawt.Shape, Cloneable]);
Clazz.makeConstructor (c$, 
function () {
this.construct (1, 20, 20);
});
Clazz.makeConstructor (c$, 
function (rule) {
this.construct (rule, 20, 20);
}, "~N");
Clazz.makeConstructor (c$, 
function (rule, initialCapacity) {
this.construct (rule, initialCapacity, initialCapacity);
}, "~N,~N");
Clazz.makeConstructor (c$, 
function (rule, initialTypes, initialCoords) {
this.setWindingRule (rule);
this.pointTypes =  Clazz.newArray (initialTypes, 0);
this.pointCoords =  Clazz.newArray (initialCoords * 2, 0);
}, "~N,~N,~N");
Clazz.makeConstructor (c$, 
function (s) {
this.construct (1, 20, 20);
var pi = s.getPathIterator (null);
this.setWindingRule (pi.getWindingRule ());
this.append (pi, false);
}, "newawt.Shape");
Clazz.defineMethod (c$, "needRoom", 
($fz = function (newTypes, newCoords, needMove) {
if (needMove && this.numTypes == 0) {
throw  new newawt.IllegalPathStateException ("missing initial moveto in path definition");
}var size = this.pointCoords.length;
if (this.numCoords + newCoords > size) {
var grow = size;
if (grow > 1000) {
grow = 1000;
}if (grow < newCoords) {
grow = newCoords;
}var arr =  Clazz.newArray (size + grow, 0);
System.arraycopy (this.pointCoords, 0, arr, 0, this.numCoords);
this.pointCoords = arr;
}size = this.pointTypes.length;
if (this.numTypes + newTypes > size) {
var grow = size;
if (grow > 500) {
grow = 500;
}if (grow < newTypes) {
grow = newTypes;
}var arr =  Clazz.newArray (size + grow, 0);
System.arraycopy (this.pointTypes, 0, arr, 0, this.numTypes);
this.pointTypes = arr;
}}, $fz.isPrivate = true, $fz), "~N,~N,~B");
Clazz.defineMethod (c$, "moveTo", 
function (x, y) {
if (this.numTypes > 0 && this.pointTypes[this.numTypes - 1] == 0) {
this.pointCoords[this.numCoords - 2] = x;
this.pointCoords[this.numCoords - 1] = y;
} else {
this.needRoom (1, 2, false);
this.pointTypes[this.numTypes++] = 0;
this.pointCoords[this.numCoords++] = x;
this.pointCoords[this.numCoords++] = y;
}}, "~N,~N");
Clazz.defineMethod (c$, "lineTo", 
function (x, y) {
this.needRoom (1, 2, true);
this.pointTypes[this.numTypes++] = 1;
this.pointCoords[this.numCoords++] = x;
this.pointCoords[this.numCoords++] = y;
}, "~N,~N");
Clazz.defineMethod (c$, "quadTo", 
function (x1, y1, x2, y2) {
this.needRoom (1, 4, true);
this.pointTypes[this.numTypes++] = 2;
this.pointCoords[this.numCoords++] = x1;
this.pointCoords[this.numCoords++] = y1;
this.pointCoords[this.numCoords++] = x2;
this.pointCoords[this.numCoords++] = y2;
}, "~N,~N,~N,~N");
Clazz.defineMethod (c$, "curveTo", 
function (x1, y1, x2, y2, x3, y3) {
this.needRoom (1, 6, true);
this.pointTypes[this.numTypes++] = 3;
this.pointCoords[this.numCoords++] = x1;
this.pointCoords[this.numCoords++] = y1;
this.pointCoords[this.numCoords++] = x2;
this.pointCoords[this.numCoords++] = y2;
this.pointCoords[this.numCoords++] = x3;
this.pointCoords[this.numCoords++] = y3;
}, "~N,~N,~N,~N,~N,~N");
Clazz.defineMethod (c$, "closePath", 
function () {
if (this.numTypes == 0 || this.pointTypes[this.numTypes - 1] != 4) {
this.needRoom (1, 0, true);
this.pointTypes[this.numTypes++] = 4;
}});
Clazz.defineMethod (c$, "append", 
function (s, connect) {
var pi = s.getPathIterator (null);
this.append (pi, connect);
}, "newawt.Shape,~B");
Clazz.defineMethod (c$, "append", 
function (pi, connect) {
var coords =  Clazz.newArray (6, 0);
while (!pi.isDone ()) {
switch (pi.currentSegment (coords)) {
case 0:
if (!connect || this.numTypes < 1 || this.numCoords < 2) {
this.moveTo (coords[0], coords[1]);
break;
}if (this.pointTypes[this.numTypes - 1] != 4 && this.pointCoords[this.numCoords - 2] == coords[0] && this.pointCoords[this.numCoords - 1] == coords[1]) {
break;
}case 1:
this.lineTo (coords[0], coords[1]);
break;
case 2:
this.quadTo (coords[0], coords[1], coords[2], coords[3]);
break;
case 3:
this.curveTo (coords[0], coords[1], coords[2], coords[3], coords[4], coords[5]);
break;
case 4:
this.closePath ();
break;
}
pi.next ();
connect = false;
}
}, "newawt.PathIterator,~B");
Clazz.defineMethod (c$, "getWindingRule", 
function () {
return this.windingRule;
});
Clazz.defineMethod (c$, "setWindingRule", 
function (rule) {
if (rule != 0 && rule != 1) {
throw  new IllegalArgumentException ("winding rule must be WIND_EVEN_ODD or WIND_NON_ZERO");
}this.windingRule = rule;
}, "~N");
Clazz.defineMethod (c$, "getCurrentPoint", 
function () {
if (this.numTypes < 1 || this.numCoords < 2) {
return null;
}var index = this.numCoords;
if (this.pointTypes[this.numTypes - 1] == 4) {
loop : for (var i = this.numTypes - 2; i > 0; i--) {
switch (this.pointTypes[i]) {
case 0:
break loop;
case 1:
index -= 2;
break;
case 2:
index -= 4;
break;
case 3:
index -= 6;
break;
case 4:
break;
}
}
}return  new newawt.Point2D.Float (this.pointCoords[index - 2], this.pointCoords[index - 1]);
});
Clazz.defineMethod (c$, "reset", 
function () {
this.numTypes = this.numCoords = 0;
});
Clazz.defineMethod (c$, "transform", 
function (at) {
at.transform (this.pointCoords, 0, this.pointCoords, 0, Math.floor (this.numCoords / 2));
}, "newawt.AffineTransform");
Clazz.defineMethod (c$, "createTransformedShape", 
function (at) {
var gp = this.clone ();
if (at != null) {
gp.transform (at);
}return gp;
}, "newawt.AffineTransform");
Clazz.overrideMethod (c$, "getBounds", 
function () {
return this.getBounds2D ().getBounds ();
});
Clazz.overrideMethod (c$, "getBounds2D", 
function () {
var x1;
var y1;
var x2;
var y2;
var i = this.numCoords;
if (i > 0) {
y1 = y2 = this.pointCoords[--i];
x1 = x2 = this.pointCoords[--i];
while (i > 0) {
var y = this.pointCoords[--i];
var x = this.pointCoords[--i];
if (x < x1) x1 = x;
if (y < y1) y1 = y;
if (x > x2) x2 = x;
if (y > y2) y2 = y;
}
} else {
x1 = y1 = x2 = y2 = 0.0;
}return  new newawt.Rectangle2D.Float (x1, y1, x2 - x1, y2 - y1);
});
Clazz.defineMethod (c$, "contains", 
function (p) {
return this.contains (p.getX (), p.getY ());
}, "newawt.Point2D");
Clazz.defineMethod (c$, "contains", 
function (r) {
return this.contains (r.getX (), r.getY (), r.getWidth (), r.getHeight ());
}, "newawt.Rectangle2D");
Clazz.defineMethod (c$, "intersects", 
function (r) {
return this.intersects (r.getX (), r.getY (), r.getWidth (), r.getHeight ());
}, "newawt.Rectangle2D");
Clazz.defineMethod (c$, "getPathIterator", 
function (at) {
return  new newawt.GeneralPathIterator (this, at);
}, "newawt.AffineTransform");
Clazz.defineMethod (c$, "getPathIterator", 
function (at, flatness) {
return  new newawt.FlatteningPathIterator (this.getPathIterator (at), flatness);
}, "newawt.AffineTransform,~N");
Clazz.defineMethod (c$, "clone", 
function () {
try {
var copy = Clazz.superCall (this, newawt.GeneralPath, "clone", []);
copy.pointTypes = this.pointTypes.clone ();
copy.pointCoords = this.pointCoords.clone ();
return copy;
} catch (e) {
if (Clazz.instanceOf (e, CloneNotSupportedException)) {
throw  new InternalError ();
} else {
throw e;
}
}
});
Clazz.makeConstructor (c$, 
function (windingRule, pointTypes, numTypes, pointCoords, numCoords) {
this.windingRule = windingRule;
this.pointTypes = pointTypes;
this.numTypes = numTypes;
this.pointCoords = pointCoords;
this.numCoords = numCoords;
}, "~N,~A,~N,~A,~N");
Clazz.defineMethod (c$, "contains", 
function (x, y) {
return false;
}, "~N,~N");
Clazz.defineMethod (c$, "intersects", 
function (x, y, w, h) {
return false;
}, "~N,~N,~N,~N");
Clazz.defineMethod (c$, "contains", 
function (x, y, w, h) {
return false;
}, "~N,~N,~N,~N");
Clazz.defineStatics (c$,
"WIND_EVEN_ODD", 0,
"WIND_NON_ZERO", 1,
"SEG_MOVETO", 0,
"SEG_LINETO", 1,
"SEG_QUADTO", 2,
"SEG_CUBICTO", 3,
"SEG_CLOSE", 4,
"INIT_SIZE", 20,
"EXPAND_MAX", 500);
});
