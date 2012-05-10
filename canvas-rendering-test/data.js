function Network(nodeCount, edgeCount) {
	this.nodes = [];
	this.edges = [];
	var node;

	for (var i = 0; i < nodeCount; i++) {
		node = new Node(i);
		node.x = 5;
		node.y = 5;
		node.name = "n" + i;
				
		this.nodes[i] = node;
	}

	var start, end;

	for (var i = 0; i < edgeCount; i++) {

		start = Math.floor(Math.random() * nodeCount);
		end = Math.floor(Math.random() * nodeCount);

		var edge = new Edge(start, end);
		var startNode = this.nodes[start];
		var endNode = this.nodes[end];

		startNode.outEdges[startNode.outEdges.length] = edge;
		endNode.inEdges[endNode.inEdges.length] = edge;
		

		/*
		if (startNode.edges.length > 1) {
			alert("startNode after: " + startNode);

			for (var j = 0; j < startNode.edges.length; j++) {
				alert("edge " + j + ": " + startNode.edges[j]);
			}
		}
		*/

		this.edges[i] = edge;
	}
}

Network.prototype.toString = function networkToString() {
	return this.nodes.length;
}

function Node(index) {
	this.index = index;
	this.x = 0;
	this.y = 0;
	this.outEdges = [];
	this.inEdges = [];
	this.name = "";
}

Node.prototype.toString = function nodeToString() {
	return "node, index: " + this.index + ", out edge count: " + this.outEdges.length;
}

function Edge(start, end) {
	this.start = start;
	this.end = end;
	this.line = null;
}

Edge.prototype.toString = function edgeToString() {
	return this.start + ", " + this.end;
}

