Clazz.declarePackage ("org.ivis.layout.cluster");
Clazz.load (["org.ivis.layout.cose.CoSELayout", "org.ivis.layout.LayoutConstants"], "org.ivis.layout.cluster.ClusterLayout", ["java.util.ArrayList", "$.Collections", "$.HashMap", "org.ivis.layout.LayoutOptionsPack", "org.ivis.layout.cose.CoSEEdge"], function () {
c$ = Clazz.decorateAsClass (function () {
this.graphMargin = 0;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.cluster, "ClusterLayout", org.ivis.layout.cose.CoSELayout);
Clazz.prepareFields (c$, function () {
this.graphMargin = org.ivis.layout.LayoutConstants.DEFAULT_GRAPH_MARGIN;
});
Clazz.defineMethod (c$, "initParameters", 
function () {
Clazz.superCall (this, org.ivis.layout.cluster.ClusterLayout, "initParameters", []);
if (!this.isSubLayout) {
var layoutOptionsPack = org.ivis.layout.LayoutOptionsPack.getInstance ().getCluster ();
if (layoutOptionsPack.getIdealEdgeLength () < 10) {
this.idealEdgeLength = 50;
} else {
this.idealEdgeLength = layoutOptionsPack.getIdealEdgeLength ();
}this.graphMargin = Math.round (org.ivis.layout.Layout.transform (layoutOptionsPack.getClusterSeperation (), 40));
this.compoundGravityConstant = org.ivis.layout.Layout.transform (layoutOptionsPack.getClusterGravityStrength (), 6.0);
}this.springConstant = 0.45;
this.repulsionConstant = 4500.0;
this.gravityConstant = 0.4;
});
Clazz.defineMethod (c$, "getRegionName", 
($fz = function (node) {
var result = "";
var clusterIDs =  new java.util.ArrayList ();
var clusters = node.getClusters ();
var itr = clusters.iterator ();
while (itr.hasNext ()) {
var cluster = itr.next ();
if (!clusterIDs.contains (new Integer (cluster.getClusterID ()))) {
clusterIDs.add (new Integer (cluster.getClusterID ()));
}}
java.util.Collections.sort (clusterIDs);
result += clusterIDs.get (0);
for (var i = 1; i < clusterIDs.size (); i++) {
result += "," + clusterIDs.get (i);
}
return result;
}, $fz.isPrivate = true, $fz), "org.ivis.layout.LNode");
Clazz.defineMethod (c$, "calcIdealEdgeLengths", 
function () {
Clazz.superCall (this, org.ivis.layout.cluster.ClusterLayout, "calcIdealEdgeLengths", []);
var edge;
for (var obj, $obj = 0, $$obj = this.graphManager.getAllEdges (); $obj < $$obj.length && ((obj = $$obj[$obj]) || true); $obj++) {
edge = obj;
if (edge.getTarget ().getChild () != null && edge.getSource ().getChild () != null) {
edge.idealLength = edge.idealLength / 4;
}}
});
Clazz.defineMethod (c$, "isSubSequence", 
($fz = function (key1, key2) {
var seq1 =  new java.util.ArrayList ();
var seq2 =  new java.util.ArrayList ();
var ids1 = key1.$plit (",");
var ids2 = key2.$plit (",");
for (var idString, $idString = 0, $$idString = ids1; $idString < $$idString.length && ((idString = $$idString[$idString]) || true); $idString++) {
if (!idString.equals ("")) {
seq1.add (new Integer (Integer.parseInt (idString)));
}}
for (var idString, $idString = 0, $$idString = ids2; $idString < $$idString.length && ((idString = $$idString[$idString]) || true); $idString++) {
if (!idString.equals ("")) {
seq2.add (new Integer (Integer.parseInt (idString)));
}}
var size1 = seq1.size ();
var size2 = seq2.size ();
if (size1 < size2) {
for (var i = 0; i < size2 - size1 + 1; i++) {
var found = false;
for (var j = i; j < i + size1; j++) {
if (!seq1.get (j - i).equals (seq2.get (j))) {
found = true;
break;
}}
if (!found) {
return true;
}}
} else if (size1 > size2) {
for (var i = 0; i < size1 - size2 + 1; i++) {
var found = false;
for (var j = i; j < i + size2; j++) {
if (!seq2.get (j - i).equals (seq1.get (j))) {
found = true;
break;
}}
if (!found) {
return true;
}}
} else {
}return false;
}, $fz.isPrivate = true, $fz), "~S,~S");
Clazz.defineMethod (c$, "layout", 
function () {
var clusterMap =  new java.util.HashMap ();
var edgesToAdd =  new java.util.ArrayList ();
var rootGraph = this.getGraphManager ().getRoot ();
var nodeList =  new java.util.ArrayList ();
var childGraph;
var clusterNode;
for (var obj, $obj = rootGraph.getNodes ().iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
var node = obj;
nodeList.add (node);
}
for (var node, $node = nodeList.iterator (); $node.hasNext () && ((node = $node.next ()) || true);) {
if (!node.getClusters ().isEmpty ()) {
var regionName = this.getRegionName (node);
clusterNode = clusterMap.get (regionName);
if (clusterNode == null) {
clusterNode = this.newNode (node.vGraphObject);
childGraph = this.newGraph (null);
childGraph.setMargin (this.graphMargin);
this.getGraphManager ().add (childGraph, clusterNode);
clusterMap.put (regionName, clusterNode);
rootGraph.add (clusterNode);
}edgesToAdd.addAll (node.getEdges ());
rootGraph.remove (node);
clusterNode.getChild ().add (node);
}}
for (var key1, $key1 = clusterMap.keySet ().iterator (); $key1.hasNext () && ((key1 = $key1.next ()) || true);) {
for (var key2, $key2 = clusterMap.keySet ().iterator (); $key2.hasNext () && ((key2 = $key2.next ()) || true);) {
if (this.isSubSequence (key1, key2)) {
var source = clusterMap.get (key1);
var destination = clusterMap.get (key2);
var newEdge =  new org.ivis.layout.cose.CoSEEdge (source, destination, null);
this.graphManager.add (newEdge, source, destination);
}}
}
for (var edge, $edge = edgesToAdd.iterator (); $edge.hasNext () && ((edge = $edge.next ()) || true);) {
this.graphManager.add (edge, edge.getSource (), edge.getTarget ());
}
this.graphManager.resetAllEdges ();
edgesToAdd.clear ();
var result = Clazz.superCall (this, org.ivis.layout.cluster.ClusterLayout, "layout", []);
for (var cluster, $cluster = this.graphManager.getClusterManager ().getClusters ().iterator (); $cluster.hasNext () && ((cluster = $cluster.next ()) || true);) {
cluster.calculatePolygon ();
}
for (var key, $key = clusterMap.keySet ().iterator (); $key.hasNext () && ((key = $key.next ()) || true);) {
clusterNode = clusterMap.get (key);
nodeList.clear ();
for (var obj, $obj = clusterNode.getChild ().getNodes ().iterator (); $obj.hasNext () && ((obj = $obj.next ()) || true);) {
var node = obj;
nodeList.add (node);
}
for (var node, $node = nodeList.iterator (); $node.hasNext () && ((node = $node.next ()) || true);) {
edgesToAdd.addAll (node.getEdges ());
clusterNode.getChild ().remove (node);
rootGraph.add (node);
}
rootGraph.remove (clusterNode);
}
for (var edge, $edge = edgesToAdd.iterator (); $edge.hasNext () && ((edge = $edge.next ()) || true);) {
this.graphManager.add (edge, edge.getSource (), edge.getTarget ());
}
this.graphManager.resetAllEdges ();
return result;
});
Clazz.defineStatics (c$,
"DEFAULT_CLUSTER_SEPARATION", 40);
});
