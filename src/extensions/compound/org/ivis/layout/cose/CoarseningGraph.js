Clazz.declarePackage ("org.ivis.layout.cose");
Clazz.load (["org.ivis.layout.LGraph"], "org.ivis.layout.cose.CoarseningGraph", ["org.ivis.layout.cose.CoarseningEdge", "$.CoarseningNode"], function () {
c$ = Clazz.decorateAsClass (function () {
this.layout = null;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.cose, "CoarseningGraph", org.ivis.layout.LGraph);
Clazz.makeConstructor (c$, 
function (_layout) {
this.construct (null, _layout, null);
this.layout = _layout;
}, "org.ivis.layout.Layout");
Clazz.defineMethod (c$, "coarsen", 
function () {
this.unmatchAll ();
var v;
var u;
if (this.getNodes ().size () > 0) {
while (!(this.getNodes ().get (0)).isMatched ()) {
v = this.getNodes ().get (0);
u = v.getMatching ();
this.contract (v, u);
}
for (var obj, $obj = this.getNodes ().iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
var y = obj;
var z = this.layout.newNode (null);
z.setPred1 (y.getNode1 ().getReference ());
y.getNode1 ().getReference ().setNext (z);
if (y.getNode2 () != null) {
z.setPred2 (y.getNode2 ().getReference ());
y.getNode2 ().getReference ().setNext (z);
}y.setReference (z);
}
}});
Clazz.defineMethod (c$, "unmatchAll", 
($fz = function () {
for (var obj, $obj = this.getNodes ().iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
var v = obj;
v.setMatched (false);
}
}, $fz.isPrivate = true, $fz));
Clazz.defineMethod (c$, "contract", 
($fz = function (v, u) {
var t =  new org.ivis.layout.cose.CoarseningNode ();
this.add (t);
t.setNode1 (v);
for (var obj, $obj = v.getNeighborsList ().iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
var x = obj;
if (x !== t) {
this.add ( new org.ivis.layout.cose.CoarseningEdge (), t, x);
}}
t.setWeight (v.getWeight ());
this.remove (v);
if (u != null) {
t.setNode2 (u);
for (var obj, $obj = u.getNeighborsList ().iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
var x = obj;
if (x !== t) {
this.add ( new org.ivis.layout.cose.CoarseningEdge (), t, x);
}}
t.setWeight (t.getWeight () + u.getWeight ());
this.remove (u);
}t.setMatched (true);
}, $fz.isPrivate = true, $fz), "org.ivis.layout.cose.CoarseningNode,org.ivis.layout.cose.CoarseningNode");
Clazz.defineMethod (c$, "getLayout", 
function () {
return this.layout;
});
Clazz.defineMethod (c$, "setLayout", 
function (layout) {
this.layout = layout;
}, "org.ivis.layout.Layout");
});
