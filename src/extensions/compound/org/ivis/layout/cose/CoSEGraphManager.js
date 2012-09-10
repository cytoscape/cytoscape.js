Clazz.declarePackage ("org.ivis.layout.cose");
Clazz.load (["org.ivis.layout.LGraphManager"], "org.ivis.layout.cose.CoSEGraphManager", ["java.util.ArrayList", "$.HashMap", "org.ivis.layout.cose.CoarseningEdge", "$.CoarseningGraph", "$.CoarseningNode"], function () {
c$ = Clazz.declareType (org.ivis.layout.cose, "CoSEGraphManager", org.ivis.layout.LGraphManager);
Clazz.defineMethod (c$, "coarsenGraph", 
function () {
var MList =  new java.util.ArrayList ();
var prevNodeCount;
var currNodeCount;
MList.add (this);
var G =  new org.ivis.layout.cose.CoarseningGraph (this.getLayout ());
this.convertToCoarseningGraph (this.getRoot (), G);
currNodeCount = G.getNodes ().size ();
var lastM;
var newM;
do {
prevNodeCount = currNodeCount;
G.coarsen ();
lastM = MList.get ((MList.size () - 1));
newM = this.coarsen (lastM);
MList.add (newM);
currNodeCount = G.getNodes ().size ();
} while ((prevNodeCount != currNodeCount) && (currNodeCount > 1));
this.getLayout ().setGraphManager (this);
MList.remove (MList.size () - 1);
return MList;
});
Clazz.defineMethod (c$, "convertToCoarseningGraph", 
($fz = function (coseG, G) {
var map =  new java.util.HashMap ();
for (var obj, $obj = coseG.getNodes ().iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
var v = obj;
if (v.getChild () != null) {
this.convertToCoarseningGraph (v.getChild (), G);
} else {
var u =  new org.ivis.layout.cose.CoarseningNode ();
u.setReference (v);
map.put (v, u);
G.add (u);
}}
for (var obj, $obj = coseG.getEdges ().iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
var e = obj;
if ((e.getSource ().getChild () == null) && (e.getTarget ().getChild () == null)) {
G.add ( new org.ivis.layout.cose.CoarseningEdge (), map.get (e.getSource ()), map.get (e.getTarget ()));
}}
}, $fz.isPrivate = true, $fz), "org.ivis.layout.cose.CoSEGraph,org.ivis.layout.cose.CoarseningGraph");
Clazz.defineMethod (c$, "coarsen", 
($fz = function (lastM) {
var newM =  new org.ivis.layout.cose.CoSEGraphManager (lastM.getLayout ());
newM.getLayout ().setGraphManager (newM);
newM.addRoot ();
newM.getRoot ().vGraphObject = lastM.getRoot ().vGraphObject;
this.coarsenNodes (lastM.getRoot (), newM.getRoot ());
lastM.getLayout ().setGraphManager (lastM);
this.addEdges (lastM, newM);
return newM;
}, $fz.isPrivate = true, $fz), "org.ivis.layout.cose.CoSEGraphManager");
Clazz.defineMethod (c$, "coarsenNodes", 
($fz = function (g, coarserG) {
for (var obj, $obj = g.getNodes ().iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
var v = obj;
if (v.getChild () != null) {
v.setNext (coarserG.getGraphManager ().getLayout ().newNode (null));
coarserG.getGraphManager ().add (coarserG.getGraphManager ().getLayout ().newGraph (null), v.getNext ());
v.getNext ().setPred1 (v);
coarserG.add (v.getNext ());
this.coarsenNodes (v.getChild (), v.getNext ().getChild ());
} else {
if (!v.getNext ().isProcessed ()) {
coarserG.add (v.getNext ());
v.getNext ().setProcessed (true);
}}v.getNext ().setLocation (v.getLocation ().x, v.getLocation ().y);
v.getNext ().setHeight (v.getHeight ());
v.getNext ().setWidth (v.getWidth ());
}
}, $fz.isPrivate = true, $fz), "org.ivis.layout.cose.CoSEGraph,org.ivis.layout.cose.CoSEGraph");
Clazz.defineMethod (c$, "addEdges", 
($fz = function (lastM, newM) {
for (var obj, $obj = 0, $$obj = lastM.getAllEdges (); $obj < $$obj.length && ((obj = $$obj[$obj]) || true); $obj++) {
var e = obj;
if ((e.isInterGraph ()) || (e.getSource ().getChild () != null) || (e.getTarget ().getChild () != null)) {
if (!(e.getSource ()).getNext ().getNeighborsList ().contains ((e.getTarget ()).getNext ())) {
newM.add (newM.getLayout ().newEdge (null), (e.getSource ()).getNext (), (e.getTarget ()).getNext ());
}} else {
if ((e.getSource ()).getNext () !== (e.getTarget ()).getNext ()) {
if (!(e.getSource ()).getNext ().getNeighborsList ().contains ((e.getTarget ()).getNext ())) {
newM.add (newM.getLayout ().newEdge (null), (e.getSource ()).getNext (), (e.getTarget ()).getNext ());
}}}}
}, $fz.isPrivate = true, $fz), "org.ivis.layout.cose.CoSEGraphManager,org.ivis.layout.cose.CoSEGraphManager");
});
