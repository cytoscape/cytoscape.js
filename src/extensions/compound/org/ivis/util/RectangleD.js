Clazz.declarePackage ("org.ivis.util");
c$ = Clazz.decorateAsClass (function () {
this.x = 0;
this.y = 0;
this.width = 0;
this.height = 0;
Clazz.instantialize (this, arguments);
}, org.ivis.util, "RectangleD");
Clazz.makeConstructor (c$, 
function () {
this.x = 0;
this.y = 0;
this.height = 0;
this.width = 0;
});
Clazz.makeConstructor (c$, 
function (x, y, width, height) {
this.x = x;
this.y = y;
this.height = height;
this.width = width;
}, "~N,~N,~N,~N");
Clazz.defineMethod (c$, "getX", 
function () {
return this.x;
});
Clazz.defineMethod (c$, "setX", 
function (x) {
this.x = x;
}, "~N");
Clazz.defineMethod (c$, "getY", 
function () {
return this.y;
});
Clazz.defineMethod (c$, "setY", 
function (y) {
this.y = y;
}, "~N");
Clazz.defineMethod (c$, "getWidth", 
function () {
return this.width;
});
Clazz.defineMethod (c$, "setWidth", 
function (width) {
this.width = width;
}, "~N");
Clazz.defineMethod (c$, "getHeight", 
function () {
return this.height;
});
Clazz.defineMethod (c$, "setHeight", 
function (height) {
this.height = height;
}, "~N");
Clazz.defineMethod (c$, "getRight", 
function () {
return this.x + this.width;
});
Clazz.defineMethod (c$, "getBottom", 
function () {
return this.y + this.height;
});
Clazz.defineMethod (c$, "intersects", 
function (a) {
if (this.getRight () < a.x) {
return false;
}if (this.getBottom () < a.y) {
return false;
}if (a.getRight () < this.x) {
return false;
}if (a.getBottom () < this.y) {
return false;
}return true;
}, "org.ivis.util.RectangleD");
Clazz.defineMethod (c$, "getCenterX", 
function () {
return this.x + this.width / 2;
});
Clazz.defineMethod (c$, "getCenterY", 
function () {
return this.y + this.height / 2;
});
Clazz.defineMethod (c$, "getWidthHalf", 
function () {
return this.width / 2;
});
Clazz.defineMethod (c$, "getHeightHalf", 
function () {
return this.height / 2;
});
