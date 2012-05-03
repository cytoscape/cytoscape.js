function Network(nodeCount, edgeCount) {
	this.nodes = [];
	this.edges = [];
	var node;

	for (var i = 0; i < nodeCount; i++) {
		node = new Node(i);
		node.x = 5;
		node.y = 5;

		this.nodes[i] = node;
	}

	var start, end;

	for (var i = 0; i < edgeCount; i++) {

		start = Math.floor(Math.random() * nodeCount);
		end = Math.floor(Math.random() * nodeCount);

		var edge = new Edge(start, end);
		var startNode = this.nodes[start];

		startNode.edges[startNode.edges.length] = edge;
		
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
	this.edges = [];
}

Node.prototype.toString = function nodeToString() {
	return "node, index: " + this.index + ", edge count: " + this.edges.length;
}

function Edge(start, end) {
	this.start = start;
	this.end = end;
}

Edge.prototype.toString = function edgeToString() {
	return this.start + ", " + this.end;
}

