Clazz.declarePackage ("newawt");
Clazz.load (["newawt.PathIterator"], "newawt.RectIterator", ["java.util.NoSuchElementException"], function () {
c$ = Clazz.decorateAsClass (function () {
this.x = 0;
this.y = 0;
this.w = 0;
this.h = 0;
this.affine = null;
this.index = 0;
Clazz.instantialize (this, arguments);
}, newawt, "RectIterator", null, newawt.PathIterator);
Clazz.makeConstructor (c$, 
function (r, at) {
this.x = r.getX ();
this.y = r.getY ();
this.w = r.getWidth ();
this.h = r.getHeight ();
this.affine = at;
if (this.w < 0 || this.h < 0) {
this.index = 6;
}}, "newawt.Rectangle2D,newawt.AffineTransform");
Clazz.overrideMethod (c$, "getWindingRule", 
function () {
return 1;
});
Clazz.overrideMethod (c$, "isDone", 
function () {
return this.index > 5;
});
Clazz.overrideMethod (c$, "next", 
function () {
this.index++;
});
Clazz.defineMethod (c$, "currentSegment", 
function (coords) {
if (this.isDone ()) {
throw  new java.util.NoSuchElementException ("rect iterator out of bounds");
}if (this.index == 5) {
return 4;
}coords[0] = this.x;
coords[1] = this.y;
if (this.index == 1 || this.index == 2) {
coords[0] += this.w;
}if (this.index == 2 || this.index == 3) {
coords[1] += this.h;
}if (this.affine != null) {
this.affine.transform (coords, 0, coords, 0, 1);
}return (this.index == 0 ? 0 : 1);
}, "~A");
Clazz.defineMethod (c$, "currentSegment", 
function (coords) {
if (this.isDone ()) {
throw  new java.util.NoSuchElementException ("rect iterator out of bounds");
}if (this.index == 5) {
return 4;
}coords[0] = this.x;
coords[1] = this.y;
if (this.index == 1 || this.index == 2) {
coords[0] += this.w;
}if (this.index == 2 || this.index == 3) {
coords[1] += this.h;
}if (this.affine != null) {
this.affine.transform (coords, 0, coords, 0, 1);
}return (this.index == 0 ? 0 : 1);
}, "~A");
});
