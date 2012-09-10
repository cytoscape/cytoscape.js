Clazz.declarePackage ("org.ivis.util");
Clazz.load (["org.ivis.util.QuickSort"], "org.ivis.util.IndexedObjectSort", null, function () {
c$ = Clazz.decorateAsClass (function () {
this.indexMapping = null;
Clazz.instantialize (this, arguments);
}, org.ivis.util, "IndexedObjectSort", org.ivis.util.QuickSort);
Clazz.makeConstructor (c$, 
function (objectList, indexMapping) {
Clazz.superConstructor (this, org.ivis.util.IndexedObjectSort, [objectList]);
this.indexMapping = indexMapping;
}, "java.util.List,java.util.Map");
Clazz.makeConstructor (c$, 
function (objectArray, indexMapping) {
Clazz.superConstructor (this, org.ivis.util.IndexedObjectSort, [objectArray]);
this.indexMapping = indexMapping;
}, "~A,java.util.Map");
Clazz.overrideMethod (c$, "compare", 
function (a, b) {
return (this.indexMapping.get (b)).doubleValue () > (this.indexMapping.get (a)).doubleValue ();
}, "~O,~O");
});
