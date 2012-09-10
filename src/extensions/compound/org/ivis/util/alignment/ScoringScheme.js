Clazz.declarePackage ("org.ivis.util.alignment");
c$ = Clazz.decorateAsClass (function () {
this.case_sensitive = false;
Clazz.instantialize (this, arguments);
}, org.ivis.util.alignment, "ScoringScheme");
Clazz.makeConstructor (c$, 
function () {
this.construct (true);
});
Clazz.makeConstructor (c$, 
function (case_sensitive) {
this.case_sensitive = case_sensitive;
}, "~B");
Clazz.defineMethod (c$, "isCaseSensitive", 
function () {
return this.case_sensitive;
});
