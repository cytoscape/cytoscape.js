Clazz.declarePackage ("org.ivis.layout.spring");
Clazz.load (null, "org.ivis.layout.spring.SpringNodeDistances", ["java.util.Arrays", "$.LinkedList"], function () {
c$ = Clazz.decorateAsClass (function () {
this.nodesList = null;
this.distances = null;
this.directed = false;
this.done = false;
this.canceled = false;
this.currentProgress = 0;
this.lengthOfTask = 0;
this.statusMessage = null;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.spring, "SpringNodeDistances");
Clazz.makeConstructor (c$, 
function (nodes_list, distances) {
this.construct (nodes_list, distances, false);
}, "java.util.List,~A");
Clazz.makeConstructor (c$, 
function (nodes_list, distances, directed) {
this.nodesList = nodes_list;
if (distances == null) {
this.distances =  Clazz.newArray (this.nodesList.size (), 0);
} else {
this.distances = distances;
}this.directed = directed;
}, "java.util.List,~A,~B");
Clazz.makeConstructor (c$, 
function (nodesList) {
this.nodesList = nodesList;
this.distances =  Clazz.newArray (nodesList.size (), 0);
this.directed = false;
}, "java.util.List");
Clazz.defineMethod (c$, "getCurrentProgress", 
function () {
return this.currentProgress;
});
Clazz.defineMethod (c$, "getLengthOfTask", 
function () {
return this.lengthOfTask;
});
Clazz.defineMethod (c$, "getTaskDescription", 
function () {
return "Calculating Node Distances";
});
Clazz.defineMethod (c$, "getCurrentStatusMessage", 
function () {
return this.statusMessage;
});
Clazz.defineMethod (c$, "isDone", 
function () {
return this.done;
});
Clazz.defineMethod (c$, "stop", 
function () {
this.canceled = true;
this.statusMessage = null;
});
Clazz.defineMethod (c$, "wasCanceled", 
function () {
return this.canceled;
});
Clazz.defineMethod (c$, "calculate", 
function () {
this.currentProgress = 0;
this.lengthOfTask = this.distances.length;
this.done = false;
this.canceled = false;
var nodes =  new Array (this.nodesList.size ());
var integers =  new Array (nodes.length);
for (var i = 0; i < nodes.length; i++) {
var from_node = this.nodesList.get (i);
if (from_node == null) {
continue ;}var index = this.nodesList.indexOf (from_node);
if (index < 0 || index >= nodes.length) {
System.err.println ("WARNING: GraphLNode \"" + from_node + "\" has an index value that is out of range: " + index + ".  Graph indices should be maintained such " + "that no index is unused.");
return null;
}if (nodes[index] != null) {
System.err.println ("WARNING: GraphLNode \"" + from_node + "\" has an index value ( " + index + " ) that is the same as " + "that of another GraphLNode ( \"" + nodes[index] + "\" ).  Graph indices should be maintained such " + "that indices are unique.");
return null;
}nodes[index] = from_node;
var $in =  new Integer (index);
integers[index] = $in;
}
var queue =  new java.util.LinkedList ();
var completed_nodes =  Clazz.newArray (nodes.length, false);
for (var from_node_index = 0; from_node_index < nodes.length; from_node_index++) {
if (this.canceled) {
this.distances = null;
return this.distances;
}var from_node = nodes[from_node_index];
if (from_node == null) {
if (this.distances[from_node_index] == null) {
this.distances[from_node_index] =  Clazz.newArray (nodes.length, 0);
}java.util.Arrays.fill (this.distances[from_node_index], 2147483647);
continue ;}if (this.distances[from_node_index] == null) {
this.distances[from_node_index] =  Clazz.newArray (nodes.length, 0);
}java.util.Arrays.fill (this.distances[from_node_index], 2147483647);
this.distances[from_node_index][from_node_index] = 0;
java.util.Arrays.fill (completed_nodes, false);
queue.add (integers[from_node_index]);
while (!queue.isEmpty ()) {
if (this.canceled) {
this.distances = null;
return this.distances;
}var index = (queue.removeFirst ()).intValue ();
if (!completed_nodes[index]) {
completed_nodes[index] = true;
var to_node = nodes[index];
var to_node_distance = this.distances[from_node_index][index];
if (index < from_node_index) {
var i = 0;
while (i < nodes.length) {
if (this.distances[index][i] != 2147483647) {
var distance_through_to_node = to_node_distance + this.distances[index][i];
if (distance_through_to_node <= this.distances[from_node_index][i]) {
if (this.distances[index][i] == 1) {
completed_nodes[i] = true;
}this.distances[from_node_index][i] = distance_through_to_node;
}}i++;
}
} else {
var neighbors = to_node.getNeighborsList ().iterator ();
while (neighbors.hasNext ()) {
if (this.canceled) {
this.distances = null;
return this.distances;
}var neighbor = neighbors.next ();
var neighbor_index = this.nodesList.indexOf (neighbor);
if (neighbor_index >= 0) {
if (nodes[neighbor_index] == null) {
this.distances[from_node_index][neighbor_index] = 2147483647;
} else if (!completed_nodes[neighbor_index]) {
var neighbor_distance = this.distances[from_node_index][neighbor_index];
if (to_node_distance != 2147483647 && neighbor_distance > to_node_distance + 1) {
this.distances[from_node_index][neighbor_index] = to_node_distance + 1;
queue.addLast (integers[neighbor_index]);
}}}}
}}}
this.currentProgress++;
var percentDone = Math.floor ((this.currentProgress * 100) / this.lengthOfTask);
this.statusMessage = "Completed " + percentDone + "%.";
}
this.done = true;
this.currentProgress = this.lengthOfTask;
return this.distances;
});
Clazz.defineMethod (c$, "getDistances", 
function () {
return this.distances;
});
Clazz.defineStatics (c$,
"INFINITY", 2147483647);
});
