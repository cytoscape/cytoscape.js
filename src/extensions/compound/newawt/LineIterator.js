Clazz.declarePackage ("newawt");
Clazz.load (["newawt.PathIterator"], "newawt.LineIterator", ["java.util.NoSuchElementException"], function () {
c$ = Clazz.decorateAsClass (function () {
this.line = null;
this.affine = null;
this.index = 0;
Clazz.instantialize (this, arguments);
}, newawt, "LineIterator", null, newawt.PathIterator);
Clazz.makeConstructor (c$, 
function (l, at) {
this.line = l;
this.affine = at;
}, "newawt.Line2D,newawt.AffineTransform");
Clazz.overrideMethod (c$, "getWindingRule", 
function () {
return 1;
});
Clazz.overrideMethod (c$, "isDone", 
function () {
return (this.index > 1);
});
Clazz.overrideMethod (c$, "next", 
function () {
this.index++;
});
Clazz.defineMethod (c$, "currentSegment", 
function (coords) {
if (this.isDone ()) {
throw  new java.util.NoSuchElementException ("line iterator out of bounds");
}var type;
if (this.index == 0) {
coords[0] = this.line.getX1 ();
coords[1] = this.line.getY1 ();
type = 0;
} else {
coords[0] = this.line.getX2 ();
coords[1] = this.line.getY2 ();
type = 1;
}if (this.affine != null) {
this.affine.transform (coords, 0, coords, 0, 1);
}return type;
}, "~A");
Clazz.defineMethod (c$, "currentSegment", 
function (coords) {
if (this.isDone ()) {
throw  new java.util.NoSuchElementException ("line iterator out of bounds");
}var type;
if (this.index == 0) {
coords[0] = this.line.getX1 ();
coords[1] = this.line.getY1 ();
type = 0;
} else {
coords[0] = this.line.getX2 ();
coords[1] = this.line.getY2 ();
type = 1;
}if (this.affine != null) {
this.affine.transform (coords, 0, coords, 0, 1);
}return type;
}, "~A");
});
