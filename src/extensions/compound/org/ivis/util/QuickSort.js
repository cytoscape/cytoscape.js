Clazz.declarePackage ("org.ivis.util");
c$ = Clazz.decorateAsClass (function () {
this.objectList = null;
this.objectArray = null;
this.fromList = false;
Clazz.instantialize (this, arguments);
}, org.ivis.util, "QuickSort");
Clazz.makeConstructor (c$, 
function (objectList) {
this.objectList = objectList;
this.fromList = true;
}, "java.util.List");
Clazz.makeConstructor (c$, 
function (objectArray) {
this.objectArray = objectArray;
this.fromList = false;
}, "~A");
Clazz.defineMethod (c$, "quicksort", 
function () {
var endIndex;
if (this.fromList) {
endIndex = this.objectList.size () - 1;
} else {
endIndex = this.objectArray.length - 1;
}if (endIndex >= 0) {
this.quicksort (0, endIndex);
}});
Clazz.defineMethod (c$, "quicksort", 
function (lo, hi) {
var i = lo;
var j = hi;
var temp;
var middleIndex = Math.floor ((lo + hi) / 2);
var middle = this.getObjectAt (middleIndex);
do {
while (this.compare (this.getObjectAt (i), middle)) i++;

while (this.compare (middle, this.getObjectAt (j))) j--;

if (i <= j) {
temp = this.getObjectAt (i);
this.setObjectAt (i, this.getObjectAt (j));
this.setObjectAt (j, temp);
i++;
j--;
}} while (i <= j);
if (lo < j) this.quicksort (lo, j);
if (i < hi) this.quicksort (i, hi);
}, "~N,~N");
Clazz.defineMethod (c$, "getObjectAt", 
($fz = function (i) {
if (this.fromList) {
return this.objectList.get (i);
} else {
return this.objectArray[i];
}}, $fz.isPrivate = true, $fz), "~N");
Clazz.defineMethod (c$, "setObjectAt", 
($fz = function (i, o) {
if (this.fromList) {
this.objectList.set (i, o);
} else {
this.objectArray[i] = o;
}}, $fz.isPrivate = true, $fz), "~N,~O");
