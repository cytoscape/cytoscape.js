Clazz.declarePackage ("org.ivis.util");
Clazz.load (["org.ivis.util.QuickSort"], "org.ivis.util.IntegerQuickSort", null, function () {
c$ = Clazz.declareType (org.ivis.util, "IntegerQuickSort", org.ivis.util.QuickSort);
Clazz.overrideMethod (c$, "compare", 
function (a, b) {
var i = (a).intValue ();
var j = (b).intValue ();
return j > i;
}, "~O,~O");
});
