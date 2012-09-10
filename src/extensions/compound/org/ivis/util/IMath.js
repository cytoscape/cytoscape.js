Clazz.declarePackage ("org.ivis.util");
c$ = Clazz.declareType (org.ivis.util, "IMath");
c$.sign = Clazz.defineMethod (c$, "sign", 
function (value) {
if (value > 0) {
return 1;
} else if (value < 0) {
return -1;
} else {
return 0;
}}, "~N");
