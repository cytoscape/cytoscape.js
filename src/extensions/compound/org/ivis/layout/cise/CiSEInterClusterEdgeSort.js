Clazz.declarePackage ("org.ivis.layout.cise");
Clazz.load (["org.ivis.util.QuickSort"], "org.ivis.layout.cise.CiSEInterClusterEdgeSort", null, function () {
c$ = Clazz.decorateAsClass (function () {
this.ownerCircle = null;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.cise, "CiSEInterClusterEdgeSort", org.ivis.util.QuickSort);
Clazz.makeConstructor (c$, 
function (ownerCircle, objectArray) {
Clazz.superConstructor (this, org.ivis.layout.cise.CiSEInterClusterEdgeSort, [objectArray]);
this.ownerCircle = ownerCircle;
}, "org.ivis.layout.cise.CiSECircle,~A");
Clazz.overrideMethod (c$, "compare", 
function (a, b) {
var edgeInfoA = a;
var edgeInfoB = b;
if (edgeInfoB.getAngle () > edgeInfoA.getAngle ()) {
return true;
} else if (edgeInfoB.getAngle () == edgeInfoA.getAngle ()) {
if (edgeInfoA === edgeInfoB) {
return false;
} else {
return this.ownerCircle.getOrder (this.ownerCircle.getThisEnd (edgeInfoA.getEdge ()), this.ownerCircle.getThisEnd (edgeInfoB.getEdge ()));
}} else {
return false;
}}, "~O,~O");
});
