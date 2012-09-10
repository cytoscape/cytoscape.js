Clazz.declarePackage ("org.ivis.util");
Clazz.load (null, "org.ivis.util.Transform", ["org.ivis.util.DimensionD", "$.PointD", "$.RectangleD"], function () {
c$ = Clazz.decorateAsClass (function () {
this.lworldOrgX = 0;
this.lworldOrgY = 0;
this.lworldExtX = 0;
this.lworldExtY = 0;
this.ldeviceOrgX = 0;
this.ldeviceOrgY = 0;
this.ldeviceExtX = 0;
this.ldeviceExtY = 0;
Clazz.instantialize (this, arguments);
}, org.ivis.util, "Transform");
Clazz.makeConstructor (c$, 
function () {
this.init ();
});
Clazz.defineMethod (c$, "init", 
function () {
this.lworldOrgX = 0.0;
this.lworldOrgY = 0.0;
this.ldeviceOrgX = 0.0;
this.ldeviceOrgY = 0.0;
this.lworldExtX = 1.0;
this.lworldExtY = 1.0;
this.ldeviceExtX = 1.0;
this.ldeviceExtY = 1.0;
});
Clazz.defineMethod (c$, "getWorldOrgX", 
function () {
return this.lworldOrgX;
});
Clazz.defineMethod (c$, "setWorldOrgX", 
function (wox) {
this.lworldOrgX = wox;
}, "~N");
Clazz.defineMethod (c$, "getWorldOrgY", 
function () {
return this.lworldOrgY;
});
Clazz.defineMethod (c$, "setWorldOrgY", 
function (woy) {
this.lworldOrgY = woy;
}, "~N");
Clazz.defineMethod (c$, "getWorldExtX", 
function () {
return this.lworldExtX;
});
Clazz.defineMethod (c$, "setWorldExtX", 
function (wex) {
this.lworldExtX = wex;
}, "~N");
Clazz.defineMethod (c$, "getWorldExtY", 
function () {
return this.lworldExtY;
});
Clazz.defineMethod (c$, "setWorldExtY", 
function (wey) {
this.lworldExtY = wey;
}, "~N");
Clazz.defineMethod (c$, "getDeviceOrgX", 
function () {
return this.ldeviceOrgX;
});
Clazz.defineMethod (c$, "setDeviceOrgX", 
function (dox) {
this.ldeviceOrgX = dox;
}, "~N");
Clazz.defineMethod (c$, "getDeviceOrgY", 
function () {
return this.ldeviceOrgY;
});
Clazz.defineMethod (c$, "setDeviceOrgY", 
function (doy) {
this.ldeviceOrgY = doy;
}, "~N");
Clazz.defineMethod (c$, "getDeviceExtX", 
function () {
return this.ldeviceExtX;
});
Clazz.defineMethod (c$, "setDeviceExtX", 
function (dex) {
this.ldeviceExtX = dex;
}, "~N");
Clazz.defineMethod (c$, "getDeviceExtY", 
function () {
return this.ldeviceExtY;
});
Clazz.defineMethod (c$, "setDeviceExtY", 
function (dey) {
this.ldeviceExtY = dey;
}, "~N");
Clazz.defineMethod (c$, "transformX", 
function (x) {
var xDevice;
var worldExtX = this.lworldExtX;
if (worldExtX != 0.0) {
xDevice = this.ldeviceOrgX + ((x - this.lworldOrgX) * this.ldeviceExtX / worldExtX);
} else {
xDevice = 0.0;
}return (xDevice);
}, "~N");
Clazz.defineMethod (c$, "transformY", 
function (y) {
var yDevice;
var worldExtY = this.lworldExtY;
if (worldExtY != 0.0) {
yDevice = this.ldeviceOrgY + ((y - this.lworldOrgY) * this.ldeviceExtY / worldExtY);
} else {
yDevice = 0.0;
}return (yDevice);
}, "~N");
Clazz.defineMethod (c$, "inverseTransformX", 
function (x) {
var xWorld;
var deviceExtX = this.ldeviceExtX;
if (deviceExtX != 0.0) {
xWorld = this.lworldOrgX + ((x - this.ldeviceOrgX) * this.lworldExtX / deviceExtX);
} else {
xWorld = 0.0;
}return (xWorld);
}, "~N");
Clazz.defineMethod (c$, "inverseTransformY", 
function (y) {
var yWorld;
var deviceExtY = this.ldeviceExtY;
if (deviceExtY != 0.0) {
yWorld = this.lworldOrgY + ((y - this.ldeviceOrgY) * this.lworldExtY / deviceExtY);
} else {
yWorld = 0.0;
}return (yWorld);
}, "~N");
Clazz.defineMethod (c$, "transformPoint", 
function (inPoint) {
var outPoint =  new org.ivis.util.PointD (this.transformX (inPoint.x), this.transformY (inPoint.y));
return (outPoint);
}, "org.ivis.util.PointD");
Clazz.defineMethod (c$, "transformDimension", 
function (inDimension) {
var outDimension =  new org.ivis.util.DimensionD (this.transformX (inDimension.width) - this.transformX (0.0), this.transformY (inDimension.height) - this.transformY (0.0));
return outDimension;
}, "org.ivis.util.DimensionD");
Clazz.defineMethod (c$, "transformRect", 
function (inRect) {
var outRect =  new org.ivis.util.RectangleD ();
var inRectDim =  new org.ivis.util.DimensionD (inRect.width, inRect.height);
var outRectDim = this.transformDimension (inRectDim);
outRect.setWidth (outRectDim.width);
outRect.setHeight (outRectDim.height);
outRect.setX (this.transformX (inRect.x));
outRect.setY (this.transformY (inRect.y));
return (outRect);
}, "org.ivis.util.RectangleD");
Clazz.defineMethod (c$, "inverseTransformPoint", 
function (inPoint) {
var outPoint =  new org.ivis.util.PointD (this.inverseTransformX (inPoint.x), this.inverseTransformY (inPoint.y));
return (outPoint);
}, "org.ivis.util.PointD");
Clazz.defineMethod (c$, "inverseTransformDimension", 
function (inDimension) {
var outDimension =  new org.ivis.util.DimensionD (this.inverseTransformX (inDimension.width - this.inverseTransformX (0.0)), this.inverseTransformY (inDimension.height - this.inverseTransformY (0.0)));
return (outDimension);
}, "org.ivis.util.DimensionD");
Clazz.defineMethod (c$, "inverseTransformRect", 
function (inRect) {
var outRect =  new org.ivis.util.RectangleD ();
var inRectDim =  new org.ivis.util.DimensionD (inRect.width, inRect.height);
var outRectDim = this.inverseTransformDimension (inRectDim);
outRect.setWidth (outRectDim.width);
outRect.setHeight (outRectDim.height);
outRect.setX (this.inverseTransformX (inRect.x));
outRect.setY (this.inverseTransformY (inRect.y));
return (outRect);
}, "org.ivis.util.RectangleD");
Clazz.defineMethod (c$, "adjustExtToPreserveAspectRatio", 
function () {
var deviceExtX = this.ldeviceExtX;
var deviceExtY = this.ldeviceExtY;
if (deviceExtY != 0.0 && deviceExtX != 0.0) {
var worldExtX = this.lworldExtX;
var worldExtY = this.lworldExtY;
if (deviceExtY * worldExtX < deviceExtX * worldExtY) {
this.setWorldExtX ((deviceExtY > 0.0) ? deviceExtX * worldExtY / deviceExtY : 0.0);
} else {
this.setWorldExtY ((deviceExtX > 0.0) ? deviceExtY * worldExtX / deviceExtX : 0.0);
}}});
c$.main = Clazz.defineMethod (c$, "main", 
function (args) {
var trans =  new org.ivis.util.Transform ();
trans.setWorldOrgX (0.0);
trans.setWorldOrgY (0.0);
trans.setWorldExtX (100.0);
trans.setWorldExtY (50.0);
trans.setDeviceOrgX (10.0);
trans.setDeviceOrgY (20.0);
trans.setDeviceExtX (50.0);
trans.setDeviceExtY (-100.0);
var rectWorld =  new org.ivis.util.RectangleD ();
rectWorld.x = 12.0;
rectWorld.y = -25.0;
rectWorld.width = 150.0;
rectWorld.height = 150.0;
var pointWorld =  new org.ivis.util.PointD (rectWorld.x, rectWorld.y);
var dimWorld =  new org.ivis.util.DimensionD (rectWorld.width, rectWorld.height);
var pointDevice = trans.transformPoint (pointWorld);
var dimDevice = trans.transformDimension (dimWorld);
var rectDevice = trans.transformRect (rectWorld);
}, "~A");
});
