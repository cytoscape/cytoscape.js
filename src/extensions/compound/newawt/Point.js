Clazz.declarePackage ("newawt");
Clazz.load (["newawt.Point2D"], "newawt.Point", null, function () {
c$ = Clazz.decorateAsClass (function () {
this.x = 0;
this.y = 0;
Clazz.instantialize (this, arguments);
}, newawt, "Point", newawt.Point2D, java.io.Serializable);
Clazz.makeConstructor (c$, 
function () {
this.construct (0, 0);
});
Clazz.makeConstructor (c$, 
function (p) {
this.construct (p.x, p.y);
}, "newawt.Point");
Clazz.makeConstructor (c$, 
function (x, y) {
Clazz.superConstructor (this, newawt.Point, []);
this.x = x;
this.y = y;
}, "~N,~N");
Clazz.overrideMethod (c$, "getX", 
function () {
return this.x;
});
Clazz.overrideMethod (c$, "getY", 
function () {
return this.y;
});
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
Clazz.defineMethod (c$, "setLocation", 
function (x, y) {
this.x = Math.round (Math.floor (x + 0.5));
this.y = Math.round (Math.floor (y + 0.5));
}, "~N,~N");
Clazz.defineMethod (c$, "move", 
function (x, y) {
this.x = x;
this.y = y;
}, "~N,~N");
Clazz.defineMethod (c$, "translate", 
function (dx, dy) {
this.x += dx;
this.y += dy;
}, "~N,~N");
Clazz.defineMethod (c$, "equals", 
function (obj) {
if (Clazz.instanceOf (obj, newawt.Point)) {
var pt = obj;
return (this.x == pt.x) && (this.y == pt.y);
}return Clazz.superCall (this, newawt.Point, "equals", [obj]);
}, "~O");
Clazz.overrideMethod (c$, "toString", 
function () {
return this.getClass ().getName () + "[x=" + this.x + ",y=" + this.y + "]";
});
});
