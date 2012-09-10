Clazz.declarePackage ("newawt");
Clazz.load (["newawt.Dimension2D"], "newawt.Dimension", null, function () {
c$ = Clazz.decorateAsClass (function () {
this.width = 0;
this.height = 0;
Clazz.instantialize (this, arguments);
}, newawt, "Dimension", newawt.Dimension2D, java.io.Serializable);
Clazz.makeConstructor (c$, 
function () {
this.construct (0, 0);
});
Clazz.makeConstructor (c$, 
function (d) {
this.construct (d.width, d.height);
}, "newawt.Dimension");
Clazz.makeConstructor (c$, 
function (width, height) {
Clazz.superConstructor (this, newawt.Dimension, []);
this.width = width;
this.height = height;
}, "~N,~N");
Clazz.overrideMethod (c$, "getWidth", 
function () {
return this.width;
});
Clazz.overrideMethod (c$, "getHeight", 
function () {
return this.height;
});
Clazz.defineMethod (c$, "setSize", 
function (width, height) {
this.width = Math.round (Math.ceil (width));
this.height = Math.round (Math.ceil (height));
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
this.width = width;
this.height = height;
}, "~N,~N");
Clazz.overrideMethod (c$, "equals", 
function (obj) {
if (Clazz.instanceOf (obj, newawt.Dimension)) {
var d = obj;
return (this.width == d.width) && (this.height == d.height);
}return false;
}, "~O");
Clazz.overrideMethod (c$, "hashCode", 
function () {
var sum = this.width + this.height;
return Math.floor (sum * (sum + 1) / 2) + this.width;
});
Clazz.overrideMethod (c$, "toString", 
function () {
return this.getClass ().getName () + "[width=" + this.width + ",height=" + this.height + "]";
});
});
