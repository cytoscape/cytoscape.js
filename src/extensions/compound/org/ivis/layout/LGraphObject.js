Clazz.declarePackage ("org.ivis.layout");
c$ = Clazz.decorateAsClass (function () {
this.vGraphObject = null;
this.label = null;
Clazz.instantialize (this, arguments);
}, org.ivis.layout, "LGraphObject");
Clazz.makeConstructor (c$, 
function (vGraphObject) {
this.vGraphObject = vGraphObject;
}, "~O");
