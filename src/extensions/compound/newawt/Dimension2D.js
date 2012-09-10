Clazz.declarePackage ("newawt");
Clazz.load (null, "newawt.Dimension2D", ["java.lang.InternalError"], function () {
c$ = Clazz.declareType (newawt, "Dimension2D", null, Cloneable);
Clazz.makeConstructor (c$, 
function () {
});
Clazz.defineMethod (c$, "setSize", 
function (d) {
this.setSize (d.getWidth (), d.getHeight ());
}, "newawt.Dimension2D");
Clazz.defineMethod (c$, "clone", 
function () {
try {
return Clazz.superCall (this, newawt.Dimension2D, "clone", []);
} catch (e) {
if (Clazz.instanceOf (e, CloneNotSupportedException)) {
throw  new InternalError ();
} else {
throw e;
}
}
});
});
