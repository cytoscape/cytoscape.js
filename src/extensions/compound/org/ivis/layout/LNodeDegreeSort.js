Clazz.declarePackage ("org.ivis.layout");
Clazz.load (["org.ivis.util.QuickSort"], "org.ivis.layout.LNodeDegreeSort", null, function () {
c$ = Clazz.declareType (org.ivis.layout, "LNodeDegreeSort", org.ivis.util.QuickSort);
Clazz.overrideMethod (c$, "compare", 
function (a, b) {
var node1 = a;
var node2 = b;
return (node2.getEdges ().size () > node1.getEdges ().size ());
}, "~O,~O");
});
