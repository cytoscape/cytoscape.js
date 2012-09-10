Clazz.declarePackage ("newawt");
Clazz.load (["newawt.PathIterator"], "newawt.GeneralPathIterator", null, function () {
c$ = Clazz.decorateAsClass (function () {
this.typeIdx = 0;
this.pointIdx = 0;
this.path = null;
this.affine = null;
Clazz.instantialize (this, arguments);
}, newawt, "GeneralPathIterator", null, newawt.PathIterator);
Clazz.makeConstructor (c$, 
function (path) {
this.construct (path, null);
}, "newawt.GeneralPath");
Clazz.makeConstructor (c$, 
function (path, at) {
this.path = path;
this.affine = at;
}, "newawt.GeneralPath,newawt.AffineTransform");
Clazz.overrideMethod (c$, "getWindingRule", 
function () {
return this.path.getWindingRule ();
});
Clazz.overrideMethod (c$, "isDone", 
function () {
return (this.typeIdx >= this.path.numTypes);
});
Clazz.overrideMethod (c$, "next", 
function () {
var type = this.path.pointTypes[this.typeIdx++];
this.pointIdx += newawt.GeneralPathIterator.curvesize[type];
});
Clazz.defineMethod (c$, "currentSegment", 
function (coords) {
var type = this.path.pointTypes[this.typeIdx];
var numCoords = newawt.GeneralPathIterator.curvesize[type];
if (numCoords > 0 && this.affine != null) {
this.affine.transform (this.path.pointCoords, this.pointIdx, coords, 0, Math.floor (numCoords / 2));
} else {
System.arraycopy (this.path.pointCoords, this.pointIdx, coords, 0, numCoords);
}return type;
}, "~A");
Clazz.defineMethod (c$, "currentSegment", 
function (coords) {
var type = this.path.pointTypes[this.typeIdx];
var numCoords = newawt.GeneralPathIterator.curvesize[type];
if (numCoords > 0 && this.affine != null) {
this.affine.transform (this.path.pointCoords, this.pointIdx, coords, 0, Math.floor (numCoords / 2));
} else {
for (var i = 0; i < numCoords; i++) {
coords[i] = this.path.pointCoords[this.pointIdx + i];
}
}return type;
}, "~A");
Clazz.defineStatics (c$,
"curvesize", [2, 2, 4, 6, 0]);
});
