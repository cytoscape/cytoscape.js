Clazz.declarePackage ("org.ivis.layout.spring");
Clazz.load (["org.ivis.layout.Layout", "org.ivis.layout.spring.SpringConstants"], "org.ivis.layout.spring.SpringLayout", ["java.util.ArrayList", "org.ivis.layout.LayoutOptionsPack", "org.ivis.layout.spring.SpringNode", "$.SpringNodeDistances"], function () {
c$ = Clazz.decorateAsClass (function () {
this.numLayoutPasses = 0;
this.nodeCount = 0;
this.layoutPass = 0;
this.averageIterationsPerNode = 0;
this.nodeDistanceStrengthConstant = 0;
this.nodeDistanceRestLengthConstant = 0;
this.disconnectedNodeDistanceSpringStrength = 0;
this.nodeDistanceSpringScalars = null;
this.anticollisionSpringScalars = null;
this.disconnectedNodeDistanceSpringRestLength = 0;
this.anticollisionSpringStrength = 0;
this.nodeDistanceSpringStrengths = null;
this.nodeDistanceSpringRestLengths = null;
this.nodeList = null;
this.totalEnergy = 0.0;
Clazz.instantialize (this, arguments);
}, org.ivis.layout.spring, "SpringLayout", org.ivis.layout.Layout);
Clazz.prepareFields (c$, function () {
this.nodeDistanceSpringScalars = org.ivis.layout.spring.SpringConstants.DEFAULT_NODE_DISTANCE_SPRING_SCALARS;
this.anticollisionSpringScalars = org.ivis.layout.spring.SpringConstants.DEFAULT_ANTICOLLISION_SPRING_SCALARS;
});
Clazz.defineMethod (c$, "doLayout", 
function () {
this.nodeList =  new java.util.ArrayList ();
for (var obj, $obj = 0, $$obj = this.getGraphManager ().getAllNodes (); $obj < $$obj.length && ((obj = $$obj[$obj]) || true); $obj++) {
var node = obj;
if (node.getChild () == null) {
this.nodeList.add (node);
}}
this.nodeCount = this.nodeList.size ();
var edgeCount = this.getGraphManager ().getAllEdges ().length;
var euclidean_distance_threshold = 0.5 * (this.nodeCount + edgeCount);
var num_iterations = Math.round (((this.nodeCount * this.averageIterationsPerNode) / this.numLayoutPasses));
var partials_list =  new java.util.ArrayList ();
var furthest_node_partials = null;
for (this.layoutPass = 0; this.layoutPass < this.numLayoutPasses; this.layoutPass++) {
this.setupNodeDistanceSprings ();
this.totalEnergy = 0.0;
partials_list.clear ();
var node_views_iterator = this.nodeList.iterator ();
do {
if (!node_views_iterator.hasNext ()) {
break;
}var partials = node_views_iterator.next ();
this.calculatePartials (partials, null, false);
partials_list.add (partials);
if (furthest_node_partials == null || partials.euclideanDistance > furthest_node_partials.euclideanDistance) {
furthest_node_partials = partials;
}} while (true);
for (var iterations_i = 0; iterations_i < num_iterations && furthest_node_partials.euclideanDistance >= euclidean_distance_threshold; iterations_i++) {
furthest_node_partials = this.moveNode (furthest_node_partials, partials_list);
}
}
var graphs = this.graphManager.getGraphs ();
for (var i = 0; i < graphs.size () - 1; i++) {
var graph = graphs.get (i);
graph.getParent ().updateBounds ();
}
});
Clazz.defineMethod (c$, "setupNodeDistanceSprings", 
function () {
if (this.layoutPass != 0) {
return ;
}this.nodeDistanceSpringRestLengths =  Clazz.newArray (this.nodeCount, this.nodeCount, 0);
this.nodeDistanceSpringStrengths =  Clazz.newArray (this.nodeCount, this.nodeCount, 0);
if (this.nodeDistanceSpringScalars[this.layoutPass] == 0.0) {
return ;
}var ind =  new org.ivis.layout.spring.SpringNodeDistances (this.nodeList);
var node_distances = ind.calculate ();
if (node_distances == null) {
return ;
}var node_distance_strength_constant = this.nodeDistanceStrengthConstant;
var node_distance_rest_length_constant = this.nodeDistanceRestLengthConstant;
for (var node_i = 0; node_i < this.nodeCount; node_i++) {
for (var node_j = node_i + 1; node_j < this.nodeCount; node_j++) {
if (node_distances[node_i][node_j] == 2147483647) {
this.nodeDistanceSpringRestLengths[node_i][node_j] = this.disconnectedNodeDistanceSpringRestLength;
} else {
this.nodeDistanceSpringRestLengths[node_i][node_j] = node_distance_rest_length_constant * node_distances[node_i][node_j];
}this.nodeDistanceSpringRestLengths[node_j][node_i] = this.nodeDistanceSpringRestLengths[node_i][node_j];
if (node_distances[node_i][node_j] == 2147483647) {
this.nodeDistanceSpringStrengths[node_i][node_j] = this.disconnectedNodeDistanceSpringStrength;
} else {
this.nodeDistanceSpringStrengths[node_i][node_j] = node_distance_strength_constant / (node_distances[node_i][node_j] * node_distances[node_i][node_j]);
}this.nodeDistanceSpringStrengths[node_j][node_i] = this.nodeDistanceSpringStrengths[node_i][node_j];
}
}
});
Clazz.defineMethod (c$, "calculatePartials", 
function (partials, partials_list, reversed) {
partials.reset ();
var node = partials;
var node_view_index = this.nodeList.indexOf (node);
var node_view_radius = node.getWidth ();
var node_view_x = node.getRect ().x;
var node_view_y = node.getRect ().y;
var other_node_partials = null;
var furthest_partials = null;
var iterator;
if (partials_list == null) {
iterator = this.nodeList.iterator ();
} else {
iterator = partials_list.iterator ();
}do {
if (!iterator.hasNext ()) {
break;
}var other_node;
if (partials_list == null) {
other_node = iterator.next ();
} else {
other_node_partials = iterator.next ();
other_node = other_node_partials;
}if (this.nodeList.indexOf (node) != this.nodeList.indexOf (other_node)) {
var other_node_view_index = this.nodeList.indexOf (other_node);
var other_node_view_radius = other_node.getWidth ();
var delta_x = node_view_x - other_node.getRect ().x;
var delta_y = node_view_y - other_node.getRect ().y;
var euclidean_distance = Math.sqrt (delta_x * delta_x + delta_y * delta_y);
var euclidean_distance_cubed = Math.pow (euclidean_distance, 3);
var distance_from_touching = euclidean_distance - (node_view_radius + other_node_view_radius);
var incremental_change = this.nodeDistanceSpringScalars[this.layoutPass] * (this.nodeDistanceSpringStrengths[node_view_index][other_node_view_index] * (delta_x - (this.nodeDistanceSpringRestLengths[node_view_index][other_node_view_index] * delta_x) / euclidean_distance));
if (!reversed) {
partials.x += incremental_change;
}if (other_node_partials != null) {
incremental_change = this.nodeDistanceSpringScalars[this.layoutPass] * (this.nodeDistanceSpringStrengths[other_node_view_index][node_view_index] * (-delta_x - (this.nodeDistanceSpringRestLengths[other_node_view_index][node_view_index] * -delta_x) / euclidean_distance));
if (reversed) {
other_node_partials.x -= incremental_change;
} else {
other_node_partials.x += incremental_change;
}}if (distance_from_touching < 0.0) {
incremental_change = this.anticollisionSpringScalars[this.layoutPass] * (this.anticollisionSpringStrength * (delta_x - ((node_view_radius + other_node_view_radius) * delta_x) / euclidean_distance));
if (!reversed) {
partials.x += incremental_change;
}if (other_node_partials != null) {
incremental_change = this.anticollisionSpringScalars[this.layoutPass] * (this.anticollisionSpringStrength * (-delta_x - ((node_view_radius + other_node_view_radius) * -delta_x) / euclidean_distance));
if (reversed) {
other_node_partials.x -= incremental_change;
} else {
other_node_partials.x += incremental_change;
}}}incremental_change = this.nodeDistanceSpringScalars[this.layoutPass] * (this.nodeDistanceSpringStrengths[node_view_index][other_node_view_index] * (delta_y - (this.nodeDistanceSpringRestLengths[node_view_index][other_node_view_index] * delta_y) / euclidean_distance));
if (!reversed) {
partials.y += incremental_change;
}if (other_node_partials != null) {
incremental_change = this.nodeDistanceSpringScalars[this.layoutPass] * (this.nodeDistanceSpringStrengths[other_node_view_index][node_view_index] * (-delta_y - (this.nodeDistanceSpringRestLengths[other_node_view_index][node_view_index] * -delta_y) / euclidean_distance));
if (reversed) {
other_node_partials.y -= incremental_change;
} else {
other_node_partials.y += incremental_change;
}}if (distance_from_touching < 0.0) {
incremental_change = this.anticollisionSpringScalars[this.layoutPass] * (this.anticollisionSpringStrength * (delta_y - ((node_view_radius + other_node_view_radius) * delta_y) / euclidean_distance));
if (!reversed) {
partials.y += incremental_change;
}if (other_node_partials != null) {
incremental_change = this.anticollisionSpringScalars[this.layoutPass] * (this.anticollisionSpringStrength * (-delta_y - ((node_view_radius + other_node_view_radius) * -delta_y) / euclidean_distance));
if (reversed) {
other_node_partials.y -= incremental_change;
} else {
other_node_partials.y += incremental_change;
}}}incremental_change = this.nodeDistanceSpringScalars[this.layoutPass] * (this.nodeDistanceSpringStrengths[node_view_index][other_node_view_index] * (1.0 - (this.nodeDistanceSpringRestLengths[node_view_index][other_node_view_index] * (delta_y * delta_y)) / euclidean_distance_cubed));
if (reversed) {
if (other_node_partials != null) {
other_node_partials.xx -= incremental_change;
}} else {
partials.xx += incremental_change;
if (other_node_partials != null) {
other_node_partials.xx += incremental_change;
}}if (distance_from_touching < 0.0) {
incremental_change = this.anticollisionSpringScalars[this.layoutPass] * (this.anticollisionSpringStrength * (1.0 - ((node_view_radius + other_node_view_radius) * (delta_y * delta_y)) / euclidean_distance_cubed));
if (reversed) {
if (other_node_partials != null) {
other_node_partials.xx -= incremental_change;
}} else {
partials.xx += incremental_change;
if (other_node_partials != null) {
other_node_partials.xx += incremental_change;
}}}incremental_change = this.nodeDistanceSpringScalars[this.layoutPass] * (this.nodeDistanceSpringStrengths[node_view_index][other_node_view_index] * (1.0 - (this.nodeDistanceSpringRestLengths[node_view_index][other_node_view_index] * (delta_x * delta_x)) / euclidean_distance_cubed));
if (reversed) {
if (other_node_partials != null) {
other_node_partials.yy -= incremental_change;
}} else {
partials.yy += incremental_change;
if (other_node_partials != null) {
other_node_partials.yy += incremental_change;
}}if (distance_from_touching < 0.0) {
incremental_change = this.anticollisionSpringScalars[this.layoutPass] * (this.anticollisionSpringStrength * (1.0 - ((node_view_radius + other_node_view_radius) * (delta_x * delta_x)) / euclidean_distance_cubed));
if (reversed) {
if (other_node_partials != null) {
other_node_partials.yy -= incremental_change;
}} else {
partials.yy += incremental_change;
if (other_node_partials != null) {
other_node_partials.yy += incremental_change;
}}}incremental_change = this.nodeDistanceSpringScalars[this.layoutPass] * (this.nodeDistanceSpringStrengths[node_view_index][other_node_view_index] * ((this.nodeDistanceSpringRestLengths[node_view_index][other_node_view_index] * (delta_x * delta_y)) / euclidean_distance_cubed));
if (reversed) {
if (other_node_partials != null) {
other_node_partials.xy -= incremental_change;
}} else {
partials.xy += incremental_change;
if (other_node_partials != null) {
other_node_partials.xy += incremental_change;
}}if (distance_from_touching < 0.0) {
incremental_change = this.anticollisionSpringScalars[this.layoutPass] * (this.anticollisionSpringStrength * (((node_view_radius + other_node_view_radius) * (delta_x * delta_y)) / euclidean_distance_cubed));
if (reversed) {
if (other_node_partials != null) {
other_node_partials.xy -= incremental_change;
}} else {
partials.xy += incremental_change;
if (other_node_partials != null) {
other_node_partials.xy += incremental_change;
}}}var distance_from_rest = euclidean_distance - this.nodeDistanceSpringRestLengths[node_view_index][other_node_view_index];
incremental_change = this.nodeDistanceSpringScalars[this.layoutPass] * ((this.nodeDistanceSpringStrengths[node_view_index][other_node_view_index] * (distance_from_rest * distance_from_rest)) / 2);
if (reversed) {
if (other_node_partials != null) {
this.totalEnergy -= incremental_change;
}} else {
this.totalEnergy += incremental_change;
if (other_node_partials != null) {
this.totalEnergy += incremental_change;
}}if (distance_from_touching < 0.0) {
incremental_change = this.anticollisionSpringScalars[this.layoutPass] * ((this.anticollisionSpringStrength * (distance_from_touching * distance_from_touching)) / 2);
if (reversed) {
if (other_node_partials != null) {
this.totalEnergy -= incremental_change;
}} else {
this.totalEnergy += incremental_change;
if (other_node_partials != null) {
this.totalEnergy += incremental_change;
}}}if (other_node_partials != null) {
other_node_partials.euclideanDistance = Math.sqrt (other_node_partials.x * other_node_partials.x + other_node_partials.y * other_node_partials.y);
if (furthest_partials == null || other_node_partials.euclideanDistance > furthest_partials.euclideanDistance) {
furthest_partials = other_node_partials;
}}}} while (true);
if (!reversed) {
partials.euclideanDistance = Math.sqrt (partials.x * partials.x + partials.y * partials.y);
}if (furthest_partials == null || partials.euclideanDistance > furthest_partials.euclideanDistance) {
furthest_partials = partials;
}return furthest_partials;
}, "org.ivis.layout.spring.SpringNode,java.util.List,~B");
Clazz.defineMethod (c$, "moveNode", 
function (partials, partials_list) {
var starting_partials =  new org.ivis.layout.spring.SpringNode (partials);
this.calculatePartials (partials, partials_list, true);
this.simpleMoveNode (starting_partials, partials);
return this.calculatePartials (partials, partials_list, false);
}, "org.ivis.layout.spring.SpringNode,java.util.List");
Clazz.defineMethod (c$, "simpleMoveNode", 
function (partialsInfo, partials) {
var denomenator = partialsInfo.xx * partialsInfo.yy - partialsInfo.xy * partialsInfo.xy;
var delta_x = (-partialsInfo.x * partialsInfo.yy - -partialsInfo.y * partialsInfo.xy) / denomenator;
var delta_y = (-partialsInfo.y * partialsInfo.xx - -partialsInfo.x * partialsInfo.xy) / denomenator;
var p = partials.getLocation ();
partials.setLocation (p.x + delta_x, p.y + delta_y);
}, "org.ivis.layout.spring.SpringNode,org.ivis.layout.spring.SpringNode");
Clazz.overrideMethod (c$, "newNode", 
function (vNode) {
return  new org.ivis.layout.spring.SpringNode (this.graphManager, vNode);
}, "~O");
Clazz.overrideMethod (c$, "layout", 
function () {
if (!this.incremental) {
this.positionNodesRandomly ();
}this.doLayout ();
return true;
});
Clazz.defineMethod (c$, "initParameters", 
function () {
Clazz.superCall (this, org.ivis.layout.spring.SpringLayout, "initParameters", []);
var layoutOptionsPack = org.ivis.layout.LayoutOptionsPack.getInstance ().getSpring ();
this.nodeDistanceStrengthConstant = 15.0;
this.disconnectedNodeDistanceSpringStrength = 0.05;
this.anticollisionSpringStrength = 100.0;
this.nodeDistanceRestLengthConstant = layoutOptionsPack.getNodeDistanceRestLength ();
this.disconnectedNodeDistanceSpringRestLength = layoutOptionsPack.getDisconnectedNodeDistanceSpringRestLength ();
if (this.layoutQuality == 1) {
this.numLayoutPasses = 4;
this.averageIterationsPerNode = 40.0;
} else if (this.layoutQuality == 2) {
this.numLayoutPasses = 2;
this.averageIterationsPerNode = 20.0;
} else {
this.numLayoutPasses = 6;
this.averageIterationsPerNode = 60.0;
}});
});
