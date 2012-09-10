Clazz.declarePackage ("org.ivis.layout.util");
Clazz.load (null, "org.ivis.layout.util.GraphMLWriter", ["java.io.BufferedWriter", "$.FileWriter", "java.util.HashMap"], function () {
c$ = Clazz.decorateAsClass (function () {
this.filePath = null;
this.fstream = null;
this.out = null;
this.map = null;
this.INITIAL_INDENTATION = 4;
this.FILE_HEADER = "<graphml xmlns=\"http://graphml.graphdrawing.org/xmlns\">\n  <key id=\"x\" for=\"node\" attr.name=\"x\" attr.type=\"int\"/>\n  <key id=\"y\" for=\"node\" attr.name=\"y\" attr.type=\"int\"/>\n  <key id=\"height\" for=\"node\" attr.name=\"height\" attr.type=\"int\"/>\n  <key id=\"width\" for=\"node\" attr.name=\"width\" attr.type=\"int\"/>\n  <key id=\"shape\" for=\"node\" attr.name=\"shape\" attr.type=\"string\"/>\n  <key id=\"clusterID\" for=\"node\" attr.name=\"clusterID\" attr.type=\"string\"/>\n  <key id=\"margin\" for=\"graph\" attr.name=\"margin\" attr.type=\"int\"/>\n  <key id=\"style\" for=\"edge\" attr.name=\"style\" attr.type=\"string\"/>\n  <key id=\"arrow\" for=\"edge\" attr.name=\"arrow\" attr.type=\"string\"/>\n  <key id=\"bendpoint\" for=\"edge\" attr.name=\"bendpoint\" attr.type=\"string\"/>\n  <key id=\"color\" for=\"all\" attr.name=\"color\" attr.type=\"string\"/>\n  <key id=\"borderColor\" for=\"all\" attr.name=\"borderColor\" attr.type=\"string\"/>\n  <key id=\"text\" for=\"all\" attr.name=\"text\" attr.type=\"string\"/>\n  <key id=\"textFont\" for=\"all\" attr.name=\"textFont\" attr.type=\"string\"/>\n  <key id=\"textColor\" for=\"all\" attr.name=\"textColor\" attr.type=\"string\"/>\n  <key id=\"highlightColor\" for=\"all\" attr.name=\"highlightColor\" attr.type=\"string\"/>\n";
this.NODE_DATA_1 = null;
this.NODE_DATA_2 = null;
this.EDGE_DATA = null;
this.FILE_FOOTER = "    <data key=\"margin\">-1</data>\n  </graph>\n</graphml>";
Clazz.instantialize (this, arguments);
}, org.ivis.layout.util, "GraphMLWriter");
Clazz.prepareFields (c$, function () {
this.NODE_DATA_1 = ["<data key=\"color\">14 112 130</data>\n", "<data key=\"borderColor\">14 112 130</data>\n"];
this.NODE_DATA_2 = ["<data key=\"textFont\">1|Arial|8.25|0|WINDOWS|1|-11|0|0|0|0|0|0|0|1|0|0|0|0|Arial</data>\n", "<data key=\"textColor\">0 0 0</data>\n", "<data key=\"clusterID\">0</data>\n"];
this.EDGE_DATA = ["<data key=\"color\">0 0 0</data>\n", "<data key=\"text\"/>\n", "<data key=\"textFont\">1|Arial|8|0|WINDOWS|1|-11|0|0|0|0|0|0|0|1|0|0|0|0|Arial</data>\n", "<data key=\"textColor\">0 0 0</data>\n", "<data key=\"style\">Solid</data>\n", "<data key=\"arrow\">None</data>\n", "<data key=\"width\">1</data>\n"];
});
Clazz.makeConstructor (c$, 
function (_filePath) {
this.filePath = _filePath;
this.map =  new java.util.HashMap ();
try {
this.fstream =  new java.io.FileWriter (this.filePath);
this.out =  new java.io.BufferedWriter (this.fstream);
} catch (e) {
if (Clazz.instanceOf (e, Exception)) {
e.printStackTrace ();
} else {
throw e;
}
}
}, "~S");
Clazz.defineMethod (c$, "saveGraph", 
function (lgm) {
try {
this.out.write (this.FILE_HEADER);
this.mapNodes (lgm.getRoot (), 0, "");
this.writeNodes (lgm.getRoot (), 0, "");
this.writeEdges (lgm);
this.out.write (this.FILE_FOOTER);
this.out.close ();
} catch (e) {
if (Clazz.instanceOf (e, Exception)) {
e.printStackTrace ();
} else {
throw e;
}
}
}, "org.ivis.layout.LGraphManager");
Clazz.defineMethod (c$, "mapNodes", 
($fz = function (root, level, parentStr) {
var currNodeStr;
var node;
for (var i = 0; i < root.getNodes ().size (); i++) {
node = root.getNodes ().get (i);
if (level != 0) currNodeStr = parentStr + ":n" + i;
 else currNodeStr = "n" + i;
this.map.put (node, currNodeStr);
if (node.getChild () != null) {
this.mapNodes (node.getChild (), (level + 1), currNodeStr);
}}
}, $fz.isPrivate = true, $fz), "org.ivis.layout.LGraph,~N,~S");
Clazz.defineMethod (c$, "writeNodes", 
($fz = function (root, level, parentStr) {
var currIndentation = (this.INITIAL_INDENTATION + (level * 2));
var node;
var parent = root.getParent ();
var x;
var y;
var currNodeStr;
try {
this.writeSpaces ((currIndentation - 2));
if (level == 0) this.out.write ("<graph id=\"\" edgedefault=\"undirected\">\n");
 else this.out.write ("  <graph id=\"" + parentStr + ":\" edgedefault=\"undirected\">\n");
for (var i = 0; i < root.getNodes ().size (); i++) {
node = root.getNodes ().get (i);
if (parent == null) {
x = Math.round (node.getRect ().x);
y = Math.round (node.getRect ().y);
} else {
x = Math.round ((node.getRect ().x - parent.getRect ().x));
y = Math.round ((node.getRect ().y - parent.getRect ().y));
}this.writeSpaces (currIndentation);
this.out.write ("<node id=\"");
currNodeStr = this.map.get (node);
this.out.write (currNodeStr + "\">\n");
this.writeSpaces ((currIndentation + 2));
this.out.write ("<data key=\"x\">" + x + "</data>\n");
this.writeSpaces ((currIndentation + 2));
this.out.write ("<data key=\"y\">" + y + "</data>\n");
this.writeSpaces ((currIndentation + 2));
this.out.write ("<data key=\"height\">" + Math.round (node.getRect ().height) + "</data>\n");
this.writeSpaces ((currIndentation + 2));
this.out.write ("<data key=\"width\">" + Math.round (node.getRect ().width) + "</data>\n");
this.writeToFile (this.NODE_DATA_1, (currIndentation + 2));
this.writeSpaces ((currIndentation + 2));
this.out.write ("<data key=\"text\">" + currNodeStr + "</data>\n");
this.writeToFile (this.NODE_DATA_2, (currIndentation + 2));
if (node.getChild () != null) {
this.writeNodes (node.getChild (), (level + 1), currNodeStr);
} else {
this.writeSpaces ((currIndentation + 2));
this.out.write ("<data key=\"shape\">Rectangle</data>\n");
}this.writeSpaces (currIndentation);
this.out.write ("</node>\n");
}
if (level != 0) {
this.writeSpaces (currIndentation);
this.out.write ("<data key=\"margin\">10</data>\n");
this.writeSpaces ((currIndentation - 2));
this.out.write ("</graph>\n");
}} catch (e) {
if (Clazz.instanceOf (e, Exception)) {
e.printStackTrace ();
} else {
throw e;
}
}
}, $fz.isPrivate = true, $fz), "org.ivis.layout.LGraph,~N,~S");
Clazz.defineMethod (c$, "writeEdges", 
($fz = function (lgm) {
var sourceStr;
var targetStr;
var edge;
try {
for (var i = 0; i < lgm.getAllEdges ().length; i++) {
edge = lgm.getAllEdges ()[i];
sourceStr = this.map.get (edge.getSource ());
targetStr = this.map.get (edge.getTarget ());
this.out.write ("    <edge id=\"e" + i + "\" source=\"" + sourceStr + "\" target=\"" + targetStr + "\">\n");
this.writeToFile (this.EDGE_DATA, 6);
this.out.write ("    </edge>\n");
}
} catch (e) {
if (Clazz.instanceOf (e, Exception)) {
e.printStackTrace ();
} else {
throw e;
}
}
}, $fz.isPrivate = true, $fz), "org.ivis.layout.LGraphManager");
Clazz.defineMethod (c$, "writeSpaces", 
($fz = function (n) {
try {
for (var i = 0; i < n; i++) {
this.out.write (" ");
}
} catch (e) {
if (Clazz.instanceOf (e, Exception)) {
e.printStackTrace ();
} else {
throw e;
}
}
}, $fz.isPrivate = true, $fz), "~N");
Clazz.defineMethod (c$, "writeToFile", 
($fz = function (inp, n) {
try {
for (var i = 0; i < inp.length; i++) {
this.writeSpaces (n);
this.out.write (inp[i]);
}
} catch (e) {
if (Clazz.instanceOf (e, Exception)) {
e.printStackTrace ();
} else {
throw e;
}
}
}, $fz.isPrivate = true, $fz), "~A,~N");
});
