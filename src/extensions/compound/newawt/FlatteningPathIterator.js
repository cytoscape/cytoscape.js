Clazz.declarePackage ("newawt");
Clazz.load (["newawt.PathIterator"], "newawt.FlatteningPathIterator", ["java.lang.IllegalArgumentException", "java.util.NoSuchElementException", "newawt.CubicCurve2D", "$.QuadCurve2D"], function () {
c$ = Clazz.decorateAsClass (function () {
this.src = null;
this.squareflat = 0;
this.limit = 0;
this.hold = null;
this.curx = 0;
this.cury = 0;
this.movx = 0;
this.movy = 0;
this.holdType = 0;
this.holdEnd = 0;
this.holdIndex = 0;
this.levels = null;
this.levelIndex = 0;
this.done = false;
Clazz.instantialize (this, arguments);
}, newawt, "FlatteningPathIterator", null, newawt.PathIterator);
Clazz.prepareFields (c$, function () {
this.hold =  Clazz.newArray (14, 0);
});
Clazz.makeConstructor (c$, 
function (src, flatness) {
this.construct (src, flatness, 10);
}, "newawt.PathIterator,~N");
Clazz.makeConstructor (c$, 
function (src, flatness, limit) {
if (flatness < 0.0) {
throw  new IllegalArgumentException ("flatness must be >= 0");
}if (limit < 0) {
throw  new IllegalArgumentException ("limit must be >= 0");
}this.src = src;
this.squareflat = flatness * flatness;
this.limit = limit;
this.levels =  Clazz.newArray (limit + 1, 0);
this.next (false);
}, "newawt.PathIterator,~N,~N");
Clazz.defineMethod (c$, "getFlatness", 
function () {
return Math.sqrt (this.squareflat);
});
Clazz.defineMethod (c$, "getRecursionLimit", 
function () {
return this.limit;
});
Clazz.defineMethod (c$, "getWindingRule", 
function () {
return this.src.getWindingRule ();
});
Clazz.defineMethod (c$, "isDone", 
function () {
return this.done;
});
Clazz.defineMethod (c$, "ensureHoldCapacity", 
function (want) {
if (this.holdIndex - want < 0) {
var have = this.hold.length - this.holdIndex;
var newsize = this.hold.length + 24;
var newhold =  Clazz.newArray (newsize, 0);
System.arraycopy (this.hold, this.holdIndex, newhold, this.holdIndex + 24, have);
this.hold = newhold;
this.holdIndex += 24;
this.holdEnd += 24;
}}, "~N");
Clazz.defineMethod (c$, "next", 
function () {
this.next (true);
});
Clazz.defineMethod (c$, "next", 
($fz = function (doNext) {
var level;
if (this.holdIndex >= this.holdEnd) {
if (doNext) {
this.src.next ();
}if (this.src.isDone ()) {
this.done = true;
return ;
}this.holdType = this.src.currentSegment (this.hold);
this.levelIndex = 0;
this.levels[0] = 0;
}switch (this.holdType) {
case 0:
case 1:
this.curx = this.hold[0];
this.cury = this.hold[1];
if (this.holdType == 0) {
this.movx = this.curx;
this.movy = this.cury;
}this.holdIndex = 0;
this.holdEnd = 0;
break;
case 4:
this.curx = this.movx;
this.cury = this.movy;
this.holdIndex = 0;
this.holdEnd = 0;
break;
case 2:
if (this.holdIndex >= this.holdEnd) {
this.holdIndex = this.hold.length - 6;
this.holdEnd = this.hold.length - 2;
this.hold[this.holdIndex + 0] = this.curx;
this.hold[this.holdIndex + 1] = this.cury;
this.hold[this.holdIndex + 2] = this.hold[0];
this.hold[this.holdIndex + 3] = this.hold[1];
this.hold[this.holdIndex + 4] = this.curx = this.hold[2];
this.hold[this.holdIndex + 5] = this.cury = this.hold[3];
}level = this.levels[this.levelIndex];
while (level < this.limit) {
if (newawt.QuadCurve2D.getFlatnessSq (this.hold, this.holdIndex) < this.squareflat) {
break;
}this.ensureHoldCapacity (4);
newawt.QuadCurve2D.subdivide (this.hold, this.holdIndex, this.hold, this.holdIndex - 4, this.hold, this.holdIndex);
this.holdIndex -= 4;
level++;
this.levels[this.levelIndex] = level;
this.levelIndex++;
this.levels[this.levelIndex] = level;
}
this.holdIndex += 4;
this.levelIndex--;
break;
case 3:
if (this.holdIndex >= this.holdEnd) {
this.holdIndex = this.hold.length - 8;
this.holdEnd = this.hold.length - 2;
this.hold[this.holdIndex + 0] = this.curx;
this.hold[this.holdIndex + 1] = this.cury;
this.hold[this.holdIndex + 2] = this.hold[0];
this.hold[this.holdIndex + 3] = this.hold[1];
this.hold[this.holdIndex + 4] = this.hold[2];
this.hold[this.holdIndex + 5] = this.hold[3];
this.hold[this.holdIndex + 6] = this.curx = this.hold[4];
this.hold[this.holdIndex + 7] = this.cury = this.hold[5];
}level = this.levels[this.levelIndex];
while (level < this.limit) {
if (newawt.CubicCurve2D.getFlatnessSq (this.hold, this.holdIndex) < this.squareflat) {
break;
}this.ensureHoldCapacity (6);
newawt.CubicCurve2D.subdivide (this.hold, this.holdIndex, this.hold, this.holdIndex - 6, this.hold, this.holdIndex);
this.holdIndex -= 6;
level++;
this.levels[this.levelIndex] = level;
this.levelIndex++;
this.levels[this.levelIndex] = level;
}
this.holdIndex += 6;
this.levelIndex--;
break;
}
}, $fz.isPrivate = true, $fz), "~B");
Clazz.defineMethod (c$, "currentSegment", 
function (coords) {
if (this.isDone ()) {
throw  new java.util.NoSuchElementException ("flattening iterator out of bounds");
}var type = this.holdType;
if (type != 4) {
coords[0] = this.hold[this.holdIndex + 0];
coords[1] = this.hold[this.holdIndex + 1];
if (type != 0) {
type = 1;
}}return type;
}, "~A");
Clazz.defineMethod (c$, "currentSegment", 
function (coords) {
if (this.isDone ()) {
throw  new java.util.NoSuchElementException ("flattening iterator out of bounds");
}var type = this.holdType;
if (type != 4) {
coords[0] = this.hold[this.holdIndex + 0];
coords[1] = this.hold[this.holdIndex + 1];
if (type != 0) {
type = 1;
}}return type;
}, "~A");
Clazz.defineStatics (c$,
"GROW_SIZE", 24);
});
