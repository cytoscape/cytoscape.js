CanvasRenderer.prototype.findEdges = function(nodeSet) {
	
	var edges = cy.edges();
	
	var hashTable = {};
	var adjacentEdges = [];
	
	for (var i = 0; i < nodeSet.length; i++) {
		hashTable[nodeSet[i]._private.data.id] = nodeSet[i];
	}
	
	for (var i = 0; i < edges.length; i++) {
		if (hashTable[edges[i]._private.data.source]
			|| hashTable[edges[i]._private.data.target]) {
			
			adjacentEdges.push(edges[i]);
		}
	}
	
	return adjacentEdges;
}
	
	