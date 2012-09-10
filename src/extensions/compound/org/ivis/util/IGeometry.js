Clazz.declarePackage ("org.ivis.util");
Clazz.load (null, "org.ivis.util.IGeometry", ["newawt.Line2D", "$.Point", "org.ivis.util.RectangleD"], function () {
c$ = Clazz.declareType (org.ivis.util, "IGeometry");
c$.calcSeparationAmount = Clazz.defineMethod (c$, "calcSeparationAmount", 
function (rectA, rectB, overlapAmount, separationBuffer) {
var directions =  Clazz.newArray (2, 0);
org.ivis.util.IGeometry.decideDirectionsForOverlappingNodes (rectA, rectB, directions);
overlapAmount[0] = Math.min (rectA.getRight (), rectB.getRight ()) - Math.max (rectA.x, rectB.x);
overlapAmount[1] = Math.min (rectA.getBottom (), rectB.getBottom ()) - Math.max (rectA.y, rectB.y);
if ((rectA.getX () <= rectB.getX ()) && (rectA.getRight () >= rectB.getRight ())) {
overlapAmount[0] += Math.min ((rectB.getX () - rectA.getX ()), (rectA.getRight () - rectB.getRight ()));
} else if ((rectB.getX () <= rectA.getX ()) && (rectB.getRight () >= rectA.getRight ())) {
overlapAmount[0] += Math.min ((rectA.getX () - rectB.getX ()), (rectB.getRight () - rectA.getRight ()));
}if ((rectA.getY () <= rectB.getY ()) && (rectA.getBottom () >= rectB.getBottom ())) {
overlapAmount[1] += Math.min ((rectB.getY () - rectA.getY ()), (rectA.getBottom () - rectB.getBottom ()));
} else if ((rectB.getY () <= rectA.getY ()) && (rectB.getBottom () >= rectA.getBottom ())) {
overlapAmount[1] += Math.min ((rectA.getY () - rectB.getY ()), (rectB.getBottom () - rectA.getBottom ()));
}var slope = Math.abs ((rectB.getCenterY () - rectA.getCenterY ()) / (rectB.getCenterX () - rectA.getCenterX ()));
if ((rectB.getCenterY () == rectA.getCenterY ()) && (rectB.getCenterX () == rectA.getCenterX ())) {
slope = 1.0;
}var moveByY = slope * overlapAmount[0];
var moveByX = overlapAmount[1] / slope;
if (overlapAmount[0] < moveByX) {
moveByX = overlapAmount[0];
} else {
moveByY = overlapAmount[1];
}overlapAmount[0] = -1 * directions[0] * ((moveByX / 2) + separationBuffer);
overlapAmount[1] = -1 * directions[1] * ((moveByY / 2) + separationBuffer);
}, "org.ivis.util.RectangleD,org.ivis.util.RectangleD,~A,~N");
c$.decideDirectionsForOverlappingNodes = Clazz.defineMethod (c$, "decideDirectionsForOverlappingNodes", 
($fz = function (rectA, rectB, directions) {
if (rectA.getCenterX () < rectB.getCenterX ()) {
directions[0] = -1;
} else {
directions[0] = 1;
}if (rectA.getCenterY () < rectB.getCenterY ()) {
directions[1] = -1;
} else {
directions[1] = 1;
}}, $fz.isPrivate = true, $fz), "org.ivis.util.RectangleD,org.ivis.util.RectangleD,~A");
c$.getIntersection = Clazz.defineMethod (c$, "getIntersection", 
function (rectA, rectB, result) {
var p1x = rectA.getCenterX ();
var p1y = rectA.getCenterY ();
var p2x = rectB.getCenterX ();
var p2y = rectB.getCenterY ();
if (rectA.intersects (rectB)) {
result[0] = p1x;
result[1] = p1y;
result[2] = p2x;
result[3] = p2y;
return true;
}var topLeftAx = rectA.getX ();
var topLeftAy = rectA.getY ();
var topRightAx = rectA.getRight ();
var bottomLeftAx = rectA.getX ();
var bottomLeftAy = rectA.getBottom ();
var bottomRightAx = rectA.getRight ();
var halfWidthA = rectA.getWidthHalf ();
var halfHeightA = rectA.getHeightHalf ();
var topLeftBx = rectB.getX ();
var topLeftBy = rectB.getY ();
var topRightBx = rectB.getRight ();
var bottomLeftBx = rectB.getX ();
var bottomLeftBy = rectB.getBottom ();
var bottomRightBx = rectB.getRight ();
var halfWidthB = rectB.getWidthHalf ();
var halfHeightB = rectB.getHeightHalf ();
var clipPointAFound = false;
var clipPointBFound = false;
if (p1x == p2x) {
if (p1y > p2y) {
result[0] = p1x;
result[1] = topLeftAy;
result[2] = p2x;
result[3] = bottomLeftBy;
return false;
} else if (p1y < p2y) {
result[0] = p1x;
result[1] = bottomLeftAy;
result[2] = p2x;
result[3] = topLeftBy;
return false;
} else {
}} else if (p1y == p2y) {
if (p1x > p2x) {
result[0] = topLeftAx;
result[1] = p1y;
result[2] = topRightBx;
result[3] = p2y;
return false;
} else if (p1x < p2x) {
result[0] = topRightAx;
result[1] = p1y;
result[2] = topLeftBx;
result[3] = p2y;
return false;
} else {
}} else {
var slopeA = rectA.height / rectA.width;
var slopeB = rectB.height / rectB.width;
var slopePrime = (p2y - p1y) / (p2x - p1x);
var cardinalDirectionA;
var cardinalDirectionB;
var tempPointAx;
var tempPointAy;
var tempPointBx;
var tempPointBy;
if ((-slopeA) == slopePrime) {
if (p1x > p2x) {
result[0] = bottomLeftAx;
result[1] = bottomLeftAy;
clipPointAFound = true;
} else {
result[0] = topRightAx;
result[1] = topLeftAy;
clipPointAFound = true;
}} else if (slopeA == slopePrime) {
if (p1x > p2x) {
result[0] = topLeftAx;
result[1] = topLeftAy;
clipPointAFound = true;
} else {
result[0] = bottomRightAx;
result[1] = bottomLeftAy;
clipPointAFound = true;
}}if ((-slopeB) == slopePrime) {
if (p2x > p1x) {
result[2] = bottomLeftBx;
result[3] = bottomLeftBy;
clipPointBFound = true;
} else {
result[2] = topRightBx;
result[3] = topLeftBy;
clipPointBFound = true;
}} else if (slopeB == slopePrime) {
if (p2x > p1x) {
result[2] = topLeftBx;
result[3] = topLeftBy;
clipPointBFound = true;
} else {
result[2] = bottomRightBx;
result[3] = bottomLeftBy;
clipPointBFound = true;
}}if (clipPointAFound && clipPointBFound) {
return false;
}if (p1x > p2x) {
if (p1y > p2y) {
cardinalDirectionA = org.ivis.util.IGeometry.getCardinalDirection (slopeA, slopePrime, 4);
cardinalDirectionB = org.ivis.util.IGeometry.getCardinalDirection (slopeB, slopePrime, 2);
} else {
cardinalDirectionA = org.ivis.util.IGeometry.getCardinalDirection (-slopeA, slopePrime, 3);
cardinalDirectionB = org.ivis.util.IGeometry.getCardinalDirection (-slopeB, slopePrime, 1);
}} else {
if (p1y > p2y) {
cardinalDirectionA = org.ivis.util.IGeometry.getCardinalDirection (-slopeA, slopePrime, 1);
cardinalDirectionB = org.ivis.util.IGeometry.getCardinalDirection (-slopeB, slopePrime, 3);
} else {
cardinalDirectionA = org.ivis.util.IGeometry.getCardinalDirection (slopeA, slopePrime, 2);
cardinalDirectionB = org.ivis.util.IGeometry.getCardinalDirection (slopeB, slopePrime, 4);
}}if (!clipPointAFound) {
switch (cardinalDirectionA) {
case 1:
tempPointAy = topLeftAy;
tempPointAx = p1x + (-halfHeightA) / slopePrime;
result[0] = tempPointAx;
result[1] = tempPointAy;
break;
case 2:
tempPointAx = bottomRightAx;
tempPointAy = p1y + halfWidthA * slopePrime;
result[0] = tempPointAx;
result[1] = tempPointAy;
break;
case 3:
tempPointAy = bottomLeftAy;
tempPointAx = p1x + halfHeightA / slopePrime;
result[0] = tempPointAx;
result[1] = tempPointAy;
break;
case 4:
tempPointAx = bottomLeftAx;
tempPointAy = p1y + (-halfWidthA) * slopePrime;
result[0] = tempPointAx;
result[1] = tempPointAy;
break;
}
}if (!clipPointBFound) {
switch (cardinalDirectionB) {
case 1:
tempPointBy = topLeftBy;
tempPointBx = p2x + (-halfHeightB) / slopePrime;
result[2] = tempPointBx;
result[3] = tempPointBy;
break;
case 2:
tempPointBx = bottomRightBx;
tempPointBy = p2y + halfWidthB * slopePrime;
result[2] = tempPointBx;
result[3] = tempPointBy;
break;
case 3:
tempPointBy = bottomLeftBy;
tempPointBx = p2x + halfHeightB / slopePrime;
result[2] = tempPointBx;
result[3] = tempPointBy;
break;
case 4:
tempPointBx = bottomLeftBx;
tempPointBy = p2y + (-halfWidthB) * slopePrime;
result[2] = tempPointBx;
result[3] = tempPointBy;
break;
}
}}return false;
}, "org.ivis.util.RectangleD,org.ivis.util.RectangleD,~A");
c$.getCardinalDirection = Clazz.defineMethod (c$, "getCardinalDirection", 
($fz = function (slope, slopePrime, line) {
if (slope > slopePrime) {
return line;
} else {
return 1 + line % 4;
}}, $fz.isPrivate = true, $fz), "~N,~N,~N");
c$.getIntersection = Clazz.defineMethod (c$, "getIntersection", 
function (s1, s2, f1, f2) {
var x1 = s1.x;
var y1 = s1.y;
var x2 = s2.x;
var y2 = s2.y;
var x3 = f1.x;
var y3 = f1.y;
var x4 = f2.x;
var y4 = f2.y;
var x;
var y;
var a1;
var a2;
var b1;
var b2;
var c1;
var c2;
var denom;
a1 = y2 - y1;
b1 = x1 - x2;
c1 = x2 * y1 - x1 * y2;
a2 = y4 - y3;
b2 = x3 - x4;
c2 = x4 * y3 - x3 * y4;
denom = a1 * b2 - a2 * b1;
if (denom == 0) {
return null;
}x = Math.floor ((b1 * c2 - b2 * c1) / denom);
y = Math.floor ((a2 * c1 - a1 * c2) / denom);
return  new newawt.Point (x, y);
}, "newawt.Point,newawt.Point,newawt.Point,newawt.Point");
c$.angleOfVector = Clazz.defineMethod (c$, "angleOfVector", 
function (Cx, Cy, Nx, Ny) {
var C_angle;
if (Cx != Nx) {
C_angle = Math.atan ((Ny - Cy) / (Nx - Cx));
if (Nx < Cx) {
C_angle += 3.141592653589793;
} else if (Ny < Cy) {
C_angle += 6.283185307179586;
}} else if (Ny < Cy) {
C_angle = 4.71238898038469;
} else {
C_angle = 1.5707963267948966;
}return C_angle;
}, "~N,~N,~N,~N");
c$.radian2degree = Clazz.defineMethod (c$, "radian2degree", 
function (rad) {
return 180.0 * rad / 3.141592653589793;
}, "~N");
c$.doIntersect = Clazz.defineMethod (c$, "doIntersect", 
function (p1, p2, p3, p4) {
var result = newawt.Line2D.linesIntersect (p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y);
return result;
}, "org.ivis.util.PointD,org.ivis.util.PointD,org.ivis.util.PointD,org.ivis.util.PointD");
c$.testClippingPoints = Clazz.defineMethod (c$, "testClippingPoints", 
($fz = function () {
var rectA =  new org.ivis.util.RectangleD (5, 6, 2, 4);
var rectB;
rectB =  new org.ivis.util.RectangleD (0, 4, 1, 4);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (1, 4, 1, 2);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (1, 3, 3, 2);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (2, 3, 2, 4);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (3, 3, 2, 2);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (3, 2, 4, 2);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (6, 3, 2, 2);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (9, 2, 4, 2);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (9, 3, 2, 2);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (8, 3, 2, 4);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (11, 3, 3, 2);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (11, 4, 1, 2);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (10, 4, 1, 4);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (10, 5, 2, 2);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (9, 4.5, 2, 4);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (10, 5.8, 0.4, 2);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (11, 6, 2, 2);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (10, 7.8, 0.4, 2);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (9, 7.5, 1, 4);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (10, 7, 2, 2);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (10, 9, 2, 6);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (11, 9, 2, 4);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (12, 8, 4, 2);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (7, 9, 2, 4);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (8, 9, 4, 2);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (10, 9, 2, 2);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (6, 10, 2, 2);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (3, 8, 4, 2);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (3, 9, 2, 2);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (2, 8, 4, 4);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (2, 8, 2, 2);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (1, 8, 2, 4);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (1, 8.5, 1, 4);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (3, 7, 2, 2);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (1, 7.5, 1, 4);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (3, 7.8, 0.4, 2);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (1, 6, 2, 2);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (3, 5.8, 0.4, 2);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (1, 5, 1, 3);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (1, 4, 3, 3);
org.ivis.util.IGeometry.findAndPrintClipPoints (rectA, rectB);
rectB =  new org.ivis.util.RectangleD (4, 4, 3, 3);
rectB =  new org.ivis.util.RectangleD (5, 6, 2, 4);
}, $fz.isPrivate = true, $fz));
c$.findAndPrintClipPoints = Clazz.defineMethod (c$, "findAndPrintClipPoints", 
($fz = function (rectA, rectB) {
System.out.println ("---------------------");
var clipPoints =  Clazz.newArray (4, 0);
System.out.println ("RectangleA  X: " + rectA.x + "  Y: " + rectA.y + "  Width: " + rectA.width + "  Height: " + rectA.height);
System.out.println ("RectangleB  X: " + rectB.x + "  Y: " + rectB.y + "  Width: " + rectB.width + "  Height: " + rectB.height);
org.ivis.util.IGeometry.getIntersection (rectA, rectB, clipPoints);
System.out.println ("Clip Point of RectA X:" + clipPoints[0] + " Y: " + clipPoints[1]);
System.out.println ("Clip Point of RectB X:" + clipPoints[2] + " Y: " + clipPoints[3]);
}, $fz.isPrivate = true, $fz), "org.ivis.util.RectangleD,org.ivis.util.RectangleD");
c$.main = Clazz.defineMethod (c$, "main", 
function (args) {
org.ivis.util.IGeometry.testClippingPoints ();
}, "~A");
Clazz.defineStatics (c$,
"HALF_PI", 1.5707963267948966,
"ONE_AND_HALF_PI", 4.71238898038469,
"TWO_PI", 6.283185307179586,
"THREE_PI", 9.42477796076938);
});
