Clazz.declarePackage ("org.ivis.layout.cise");
Clazz.load (["org.ivis.util.QuickSort"], "org.ivis.layout.cise.CiSENodeSort", null, function () {
c$ = Clazz.declareType (org.ivis.layout.cise, "CiSENodeSort", org.ivis.util.QuickSort);
Clazz.overrideMethod (c$, "compare", 
function (a, b) {
return (b).getOnCircleNodeExt ().getIndex () > (a).getOnCircleNodeExt ().getIndex ();
}, "~O,~O");
});
