;(function($$) {

    /**
     * @brief :  default layout options
     */
    var defaults = {
	ready               : function() {},
	stop                : function() {},
	numIter             : 100,
	refresh             : 0,
	fit                 : true, 
	randomize           : false,
	debug               : false,
	nodeRepulsion       : 10000,
	nodeOverlap         : 1,
	edgeElasticity      : 2000,
	defaultEdgeWeigth   : 1,
	nestingFactor       : 10, 
	gravity             : 10, 
	initialTemp         : 100,
	coolingFactor       : 0.9
    };


    /**
     * @brief       : constructor
     * @arg options : object containing layout options
     */
    function CoseLayout(options) {
	this.options = $$.util.extend(true, {}, defaults, options); 
    }


    /**
     * @brief : runs the layout
     */
    CoseLayout.prototype.run = function() {	
	var options = this.options;
	var cy      = options.cy;

	// Set DEBUG - Global variable
	if (true == options.debug) {
	    DEBUG = true;
	} else {
	    DEBUG = false;
	}

	// Get start time
	var startTime = new Date();

	// Initialize layout info
	var layoutInfo = createLayoutInfo(cy, options);
	
	// Show LayoutInfo contents if debugging
	if (DEBUG) {
	    printLayoutInfo(layoutInfo);
	}

	// If required, randomize node positions
	if (true == options.randomize) {
	    randomizePositions(layoutInfo, cy);
	    if (0 < options.refresh) {
		refreshPositions(layoutInfo, cy, options);
	    }
	}

	// Main loop
	for (var i = 0; i < options.numIter; i++) {
	    // Do one step in the phisical simmulation
	    step(layoutInfo, cy, options, i);

	    // If required, update positions
	    if (0 < options.refresh && 0 == (i % options.refresh)) {
		refreshPositions(layoutInfo, cy, options);
	    }
	    
	    // Update temperature
	    layoutInfo.temperature = layoutInfo.temperature * options.coolingFactor;
	    logDebug("New temperature: " + layoutInfo.temperature);
	}
	
	refreshPositions(layoutInfo, cy, options);

	// Fit the graph if necessary
	if (true == options.fit) {
	    cy.fit();
	}
	
	// Get end time
	var endTime = new Date();

	console.info("Layout took " + (endTime - startTime) + " ms");

	// Layout has finished
	cy.one("layoutstop", options.stop);
	cy.trigger("layoutstop");
    };


    /**
     * @brief : called on continuous layouts to stop them before they finish
     */
    CoseLayout.prototype.stop = function(){
	var options = this.options;

	cy.one("layoutstop", options.stop);
	cy.trigger("layoutstop");
    };


    /**
     * @brief     : Creates an object which is contains all the data
     *              used in the layout process
     * @arg cy    : cytoscape.js object
     * @return    : layoutInfo object initialized
     */
    function createLayoutInfo(cy, options) {
	var layoutInfo   = {
	    layoutNodes  : [], 
	    idToIndex    : {},
	    nodeSize     : cy.nodes().size(),
	    graphSet     : [],
	    indexToGraph : [], 
	    layoutEdges  : [],
	    edgeSize     : cy.edges().size(),
	    temperature  : options.initialTemp
	}; 
	
	// Shortcut
	var nodes = cy.nodes();
	
	// Iterate over all nodes, creating layout nodes
	for (var i = 0; i < layoutInfo.nodeSize; i++) {
	    var tempNode        = {};
	    tempNode.id         = nodes[i].data('id');
	    tempNode.parentId   = nodes[i].data('parent');	    
	    tempNode.children   = [];
	    tempNode.positionX  = nodes[i].position('x');
	    tempNode.positionY  = nodes[i].position('y');
	    tempNode.offsetX    = 0;	    
	    tempNode.offsetY    = 0;
	    tempNode.height     = nodes[i].height();
	    tempNode.width      = nodes[i].width();
	    tempNode.maxX       = tempNode.positionX + tempNode.width  / 2;
	    tempNode.minX       = tempNode.positionX - tempNode.width  / 2;
	    tempNode.maxY       = tempNode.positionY + tempNode.height / 2;
	    tempNode.minY       = tempNode.positionY - tempNode.height / 2;
	    
	    // Add new node
	    layoutInfo.layoutNodes.push(tempNode);
	    // Add entry to id-index map
	    layoutInfo.idToIndex[tempNode.id] = i;
	}

	// Inline implementation of a queue, used for traversing the graph in BFS order
	var queue = [];
	var start = 0;   // Points to the start the queue
	var end   = -1;  // Points to the end of the queue

	var tempGraph = [];

	// Second pass to add child information and 
	// initialize queue for hierarchical traversal
	for (var i = 0; i < layoutInfo.nodeSize; i++) {
	    var n = layoutInfo.layoutNodes[i];
	    var p_id = n.parentId;
	    // Check if node n has a parent node
	    if (undefined != p_id) {
		// Add node Id to parent's list of children
		layoutInfo.layoutNodes[layoutInfo.idToIndex[p_id]].children.push(n.id);
	    } else {
		// If a node doesn't have a parent, then it's in the root graph
		queue[++end] = n.id;
		tempGraph.push(n.id);
		
	    }
	}
	
	// Add root graph to graphSet
	layoutInfo.graphSet.push(tempGraph);

	// Traverse the graph, level by level, 
	while (start <= end) {
	    // Get the node to visit and remove it from queue
	    var node_id  = queue[start++];
	    var node_ix  = layoutInfo.idToIndex[node_id];
	    var node     = layoutInfo.layoutNodes[node_ix];
	    var children = node.children;
	    if (children.length > 0) {
		// Add children nodes as a new graph to graph set
		layoutInfo.graphSet.push(children);
		// Add children to que queue to be visited
		for (var i = 0; i < children.length; i++) {
		    queue[++end] = children[i];
		}
	    }
	}

	// Create indexToGraph map
	for (var i = 0; i < layoutInfo.graphSet.length; i++) {	    
	    var graph = layoutInfo.graphSet[i];
	    for (var j = 0; j < graph.length; j++) {
		var index = layoutInfo.idToIndex[graph[j]];
		layoutInfo.indexToGraph[index] = i;
	    }
	}

	// Shortcut
	var edges = cy.edges();
	
	// Iterate over all edges, creating Layout Edges
	for (var i = 0; i < layoutInfo.edgeSize; i++) {
	    var e = edges[i];
	    var tempEdge = {};	    
	    tempEdge.id       = e.data('id');
	    tempEdge.sourceId = e.data('source');
	    tempEdge.targetId = e.data('target');
	    // Check whether the edge has a defined weigth
	    var weigth = e.data('weigth');
	    if (undefined != weigth) {
		tempEdge.weigth = weigth;
	    } else {
		// Use default weigth
		tempEdge.weigth = options.defaultEdgeWeigth;
	    }
	    // Compute ideal length
	    var idealLength = 10;       // TODO: Change this.

	    // Check if it's an inter graph edge
	    var sourceIx    = layoutInfo.idToIndex[tempEdge.sourceId];
	    var targetIx    = layoutInfo.idToIndex[tempEdge.targetId];
	    var sourceGraph = layoutInfo.indexToGraph[sourceIx];
	    var targetGraph = layoutInfo.indexToGraph[targetIx];

	    if (sourceGraph != targetGraph) {
		// Find lowest common graph ancestor
		var lca = findLCA(tempEdge.sourceId, tempEdge.targetId, layoutInfo);

		// Compute sum of node depths, relative to lca graph
		var lcaGraph = layoutInfo.graphSet[lca];
		var depth    = 0;

		// Source depth
		var tempNode = layoutInfo.layoutNodes[sourceIx];
		while (-1 == $.inArray(tempNode.id, lcaGraph)) {
		    tempNode = layoutInfo.layoutNodes[layoutInfo.idToIndex[tempNode.parentId]];
		    depth++;
		}

		// Target depth
		tempNode = layoutInfo.layoutNodes[targetIx];
		while (-1 == $.inArray(tempNode.id, lcaGraph)) {
		    tempNode = layoutInfo.layoutNodes[layoutInfo.idToIndex[tempNode.parentId]];
		    depth++;
		}

		logDebug("LCA of nodes " + tempEdge.sourceId + " and " + tempEdge.targetId +  
			 ". Index: " + lca + " Contents: " + lcaGraph.toString() + 
			 ". Depth: " + depth);

		// Update idealLength
		idealLength *= depth * options.nestingFactor;
	    }

	    tempEdge.idealLength = idealLength;

	    layoutInfo.layoutEdges.push(tempEdge);
	}

	// Finally, return layoutInfo object
	return layoutInfo;
    }

    
    /**
     * @brief : This function finds the index of the lowest common 
     *          graph ancestor between 2 nodes in the subtree 
     *          (from the graph hierarchy induced tree) whose
     *          root is graphIx
     *
     */
    function findLCA(node1, node2, layoutInfo) {
	// Find their common ancester, starting from the root graph
	var res = findLCA_aux(node1, node2, 0, layoutInfo);
	if (2 > res.count) {
	    // If aux function couldn't find the common ancester, 
	    // then it is the root graph
	    return 0;
	} else {
	    return res.graph;
	}
    }


    /**
     * @brief : 
     *          
     *          
     *          
     */
    function findLCA_aux(node1, node2, graphIx, layoutInfo) {
	var graph = layoutInfo.graphSet[graphIx];
	// If both nodes belongs to graphIx
	if (-1 < $.inArray(node1, graph) && -1 < $.inArray(node2, graph)) {
	    return {count:2, graph:graphIx};
	}

	// Make recursive calls for all subgraphs
	var c = 0;
	for (var i = 0; i < graph.length; i++) {
	    var nodeId   = graph[i];
	    var nodeIx   = layoutInfo.idToIndex[nodeId];
	    var children = layoutInfo.layoutNodes[nodeIx].children;

	    // If the node has no child, skip it
	    if (0 == children.length) {
		continue;
	    }

	    var childGraphIx = layoutInfo.indexToGraph[layoutInfo.idToIndex[children[0]]];
	    var result = findLCA_aux(node1, node2, childGraphIx, layoutInfo);
	    if (0 == result.count) {
		// Neither node1 nor node2 are present in this subgraph
		continue;
	    } else if (1 == result.count) {
		// One of (node1, node2) is present in this subgraph
		c++;
		if (2 == c) {
		    // We've already found both nodes, no need to keep searching
		    break;
		}
	    } else {
		// Both nodes are present in this subgraph
		return result;
	    }	    
	}
	
	return {count:c, graph:graphIx};
    }


    /**
     * @brief: printsLayoutInfo into js console
     *         Only used for debbuging 
     */
    function printLayoutInfo(layoutInfo) {
	if (!DEBUG) {
	    return;
	}
	console.debug("layoutNodes:");
	for (var i = 0; i < layoutInfo.nodeSize; i++) {
	    var n = layoutInfo.layoutNodes[i];
	    var s = 
		"\nindex: "     + i + 
		"\nId: "        + n.id + 
		"\nChildren: "  + n.children.toString() +  
		"\nparentId: "  + n.parentId  + 
		"\npositionX: " + n.positionX + 
		"\npositionY: " + n.positionY +
		"\nOffsetX: " + n.offsetX + 
		"\nOffsetY: " + n.offsetY;
	    console.debug(s);		
	}	
	
	console.debug("idToIndex");
	for (var i in layoutInfo.idToIndex) {
	    console.debug("Id: " + i + "\nIndex: " + layoutInfo.idToIndex[i]);
	}

	console.debug("Graph Set");
	var set = layoutInfo.graphSet;
	for (var i = 0; i < set.length; i ++) {
	    console.debug("Set : " + i + ": " + set[i].toString());
	} 

	var s = "IndexToGraph";
	for (var i = 0; i < layoutInfo.indexToGraph.length; i ++) {
	    s += "\nIndex : " + i + " Graph: "+ layoutInfo.indexToGraph[i];
	}
	console.debug(s);

	s = "Layout Edges";
	for (var i = 0; i < layoutInfo.layoutEdges.length; i++) {
	    var e = layoutInfo.layoutEdges[i];
	    s += "\nEdge Index: " + i + " ID: " + e.id + 
		" SouceID: " + e.sourceId + " TargetId: " + e.targetId + 
		" Weigth: " + e.weigth + " Ideal Length: " + e.idealLength;
	}
	console.debug(s);

	s =  "nodeSize: " + layoutInfo.nodeSize;
	s += "\nedgeSize: " + layoutInfo.edgeSize;
	s += "\ntemperature: " + layoutInfo.temperature;
	console.debug(s);

	return;
    }


    /**
     * @brief : Randomizes the position of all nodes
     */
    function randomizePositions(layoutInfo, cy) {
	var container = cy.container();
	var width     = container.clientWidth;
	var height    = container.clientHeight;

	for (var i = 0; i < layoutInfo.nodeSize; i++) {
	    var n = layoutInfo.layoutNodes[i];
	    // No need to randomize compound nodes
	    if (0 == n.children.length) {
		n.positionX = Math.random() * width;
		n.positionY = Math.random() * height;
	    }
	}
    }

    
    /**
     * @brief          : Updates the positions of nodes in the network
     * @arg layoutInfo : LayoutInfo object
     * @arg cy         : Cytoscape object
     * @arg options    : Layout options
     */
    function refreshPositions(layoutInfo, cy, options) {
	var container = cy.container();
	var width     = container.clientWidth;
	var height    = container.clientHeight;
	
	var s = "Refreshing positions";
	logDebug(s);

	cy.nodes().positions(function(i, ele) {
	    lnode = layoutInfo.layoutNodes[layoutInfo.idToIndex[ele.data('id')]];
	    s = "Node: " + lnode.id + ". Refreshed position: (" + 
		lnode.positionX + ", " + lnode.positionY + ").";
	    logDebug(s);
	    return {
		x: lnode.positionX,
		y: lnode.positionY
	    };
	});
	
	if (true != refreshPositions.ready) {
	    s = "Triggering layoutready";
	    logDebug(s);
	    refreshPositions.ready = true;
	    cy.one("layoutready", options.ready);
	    cy.trigger("layoutready");
	}
    }


    /**
     * @brief          : Performs one iteration of the physical simulation
     * @arg layoutInfo : LayoutInfo object already initialized
     * @arg cy         : Cytoscape object
     * @arg options    : Layout options
     */
    function step(layoutInfo, cy, options, step) {	
	var s = "\n\n###############################";
	s += "\nSTEP: " + step;
	s += "\n###############################\n";
	logDebug(s);

	// Calculate node repulsions
	calculateNodeForces(layoutInfo, cy, options);
	// Calculate edge forces
	calculateEdgeForces(layoutInfo, cy, options);
	// Calculate gravity forces
	calculateGravityForces(layoutInfo, cy, options);
	// Propagate forces from parent to child
	propagateForces(layoutInfo, cy, options);
	// Update positions based on calculated forces
	updatePositions(layoutInfo, cy, options);
    }

    
    /**
     * @brief : 
     */
    function calculateNodeForces(layoutInfo, cy, options) {
	// Go through each of the graphs in graphSet
	// Nodes only repel each other if they belong to the same graph
	var s = "calculateNodeForces";
	logDebug(s);
	for (var i = 0; i < layoutInfo.graphSet.length; i ++) {
	    var graph    = layoutInfo.graphSet[i];
	    var numNodes = graph.length;

	    s = "Set: " + graph.toString();
	    logDebug(s);

	    // Now get all the pairs of nodes 
	    // Only get each pair once, (A, B) = (B, A)
	    for (var j = 0; j < numNodes; j++) {
		var node1 = layoutInfo.layoutNodes[layoutInfo.idToIndex[graph[j]]];
		for (var k = j + 1; k < numNodes; k++) {
		    var node2 = layoutInfo.layoutNodes[layoutInfo.idToIndex[graph[k]]];
		    nodeRepulsion(node1, node2, layoutInfo, cy, options);
		} 
	    }
	} 
    }


    /**
     * @brief : 
     */
    function nodeRepulsion(node1, node2, layoutInfo, cy, options) {
	var s = "Node repulsion. Node1: " + node1.id + " Node2: " + node2.id;

	// Get direction of line connecting both node centers
	var directionX = node2.positionX - node1.positionX;
	var directionY = node2.positionY - node1.positionY;

	// If both centers are the same, apply a random force
	if (0 == directionX && 0 == directionY) {
	    s += "\nNodes have the same position.";
	    return; // TODO
	}

	// Get clipping points for both nodes
	var point1 = findClippingPoint(node1, directionX, directionY);
	var point2 = findClippingPoint(node2, -1 * directionX, -1 * directionY);

	if (nodesOverlap(node1, node2, point1, point2, directionX, directionY)) {
	    s += "\nNodes DO overlap.";
	    // If nodes overlap, repulsion force is proportional 
	    // to the overlap
	    // Use clipping points to compute overlap
	    var overlapX   = point1.x - point2.x;
	    var overlapY   = point1.y - point2.y;
	    var overlapSqr = overlapX * overlapX + overlapY * overlapY;
	    var overlap    = Math.sqrt(overlapSqr);
	    s += "\nOverlap: " + overlap;
	    // Compute the module and components of the force vector
	    var force  = options.nodeOverlap * overlap;
	    var forceX = force * overlapX / overlap;
	    var forceY = force * overlapY / overlap;

	} else {
	    s += "\nNodes do NOT overlap.";
	    // If there's no overlap, force is inversely to squared distance
	    // Use clipping points to compute distance
	    var distanceX   = point2.x - point1.x;
	    var distanceY   = point2.y - point1.y;
	    var distanceSqr = distanceX * distanceX + distanceY * distanceY;
	    var distance    = Math.sqrt(distanceSqr);
	    s += "\nDistance: " + distance;

	    // Compute the module and components of the force vector
	    var force  = options.nodeRepulsion / distanceSqr;
	    var forceX = force * distanceX / distance;
	    var forceY = force * distanceY / distance;
	}

	// Apply force
	node1.offsetX -= forceX;
	node1.offsetY -= forceY;
	node2.offsetX += forceX;
	node2.offsetY += forceY;

	s += "\nForceX: " + forceX + " ForceY: " + forceY;
	logDebug(s);

	return;
    }


    /**
     * @brief : 
     */
    function findClippingPoint(node, dX, dY) {

	// Shorcuts
	var X = node.positionX;
	var Y = node.positionY;
	var H = node.height;
	var W = node.width;
	var dirSlope     = dY / dX;
	var nodeSlope    = H / W;
	var nodeinvSlope = W / H;

	var s = "Computing clipping point of node " + node.id + 
	    " . Height:  " + H + ", Width: " + W + 
	    "\nDirection " + dX + ", " + dY; 
	
	// Compute intersection
	var res = {};
	do {
	    // Case: Vertical direction (up)
	    if (0 == dX && 0 < dY) {
		res.x = X;
		s += "\nUp direction";
		res.y = Y + H / 2;
		break;
	    }

	    // Case: Vertical direction (down)
	    if (0 == dX && 0 > dY) {
		res.x = X;
		res.y = Y + H / 2;
		s += "\nDown direction";
		break;
	    }	    

	    // Case: Intersects the right border
	    if (0 < dX && 
		-1 * nodeSlope <= dirSlope && 
		dirSlope <= nodeSlope) {
		res.x = X + W / 2;
		res.y = Y + (W * dY / 2 / dX);
		s += "\nRightborder";
		break;
	    }

	    // Case: Intersects the left border
	    if (0 > dX && 
		-1 * nodeSlope <= dirSlope && 
		dirSlope <= nodeSlope) {
		res.x = X - W / 2;
		res.y = Y - (W * dY / 2 / dX);
		s += "\nLeftborder";
		break;
	    }

	    // Case: Intersects the top border
	    if (0 < dY && 
		( dirSlope <= -1 * nodeSlope ||
		  dirSlope >= nodeSlope )) {
		res.x = X + (H * dX / 2 / dY);
		res.y = Y + H / 2;
		s += "\nTop border";
		break;
	    }

	    // Case: Intersects the bottom border
	    if (0 > dY && 
		( dirSlope <= -1 * nodeSlope ||
		  dirSlope >= nodeSlope )) {
		res.x = X - (H * dX / 2 / dY);
		res.y = Y - H / 2;
		s += "\nBottom border";
		break;
	    }

	} while (false);

	s += "\nClipping point found at " + res.x + ", " + res.y;
	logDebug(s);
	return res;
    }


    /**
     * @brief : 
     */
    function nodesOverlap(node1, node2, point1, point2, dX, dY) {

	if (0 != dX) {
	    // 'distance' to point1 from node1
	    var aux1 = solveAuxEq(point1.x, node1.positionX, dX);
	    // 'distance' to point2 from node1
	    var aux2 = solveAuxEq(point2.x, node1.positionX, dX);

	    // 'distance' to point2 from node2
	    var aux3 = solveAuxEq(point2.x, node2.positionX, -1 * dX);
	    // 'distance' to point1 from node2
	    var aux4 = solveAuxEq(point1.x, node2.positionX, -1 * dX);

	} else {

	    // 'distance' to point1 from node1
	    var aux1 = solveAuxEq(point1.y, node1.positionY, dY);
	    // 'distance' to point2 from node1
	    var aux2 = solveAuxEq(point2.y, node1.positionY, dY);

	    // 'distance' to point2 from node2
	    var aux3 = solveAuxEq(point2.y, node2.positionY, -1 * dY);
	    // 'distance' to point1 from node2
	    var aux4 = solveAuxEq(point1.y, node2.positionY, -1 * dY);
	}
	
	// If clipping point of node2 is 'before' than the clipping 
	// point of node1, going from the center of node1 in direction 
	// (dX, dY), then there's an overlapping
	if (aux1 > aux2) {
	    return true;
	}

	// If clipping point of node1 is 'before' than the clipping 
	// point of node2, going from the center of node2 in direction 
	// (-dX, -dY), then there's an overlapping
	if (aux3 > aux4) {
	    return true;
	}

	// Otherwise, nodes do not overlap
	return false;
    }
    

    /**
     * @brief : 
     */
    function solveAuxEq(point, center, direction) {
	return ((point - center) / direction);	
    }
    
    
    /**
     * @brief : 
     */
    function calculateEdgeForces(layoutInfo, cy, options) {
	// Iterate over all edges
	for (var i = 0; i < layoutInfo.edgeSize; i++) {
	    // Get edge, source & target nodes
	    var edge     = layoutInfo.layoutEdges[i];
	    var sourceIx = layoutInfo.idToIndex[edge.sourceId];
	    var source   = layoutInfo.layoutNodes[sourceIx];
	    var targetIx = layoutInfo.idToIndex[edge.targetId];
	    var target   = layoutInfo.layoutNodes[targetIx];

	    // TODO: Compute current length using node sizes
	    var lx = target.positionX - source.positionX;
	    var ly = target.positionY - source.positionY;
	    var l  = Math.sqrt(lx * lx + ly * ly);

	    var force  = Math.pow(edge.idealLength - l, 2) / options.edgeElasticity; 

	    if (0 != l) {
		var forceX = force * lx / l;
		var forceY = force * ly / l;
	    } else {
		var forceX = 0;
		var forceY = 0;
	    }

	    // Add this force to target and source nodes
	    source.offsetX += forceX;
	    source.offsetY += forceY;
	    target.offsetX -= forceX;
	    target.offsetY -= forceY;

	    var s = "Edge force between nodes " + source.id + " and " + target.id;
	    s += "\nDistance: " + l + " Force: (" + forceX + ", " + forceY + ")";
	    logDebug(s);
	}
    }


    /**
     * @brief : 
     */
    function calculateGravityForces(layoutInfo, cy, options) {
	var s = "calculateGravityForces";
	logDebug(s);
	for (var i = 0; i < layoutInfo.graphSet.length; i ++) {
	    var graph    = layoutInfo.graphSet[i];
	    var numNodes = graph.length;

	    s = "Set: " + graph.toString();
	    logDebug(s);
	    	    
	    // Compute graph center
	    if (0 == i) {
		var container = cy.container();		
		var centerX   = container.clientHeight / 2;
		var centerY   = container.clientWidth  / 2;		
	    } else {
		// Get Parent node for this graph, and use its position as center
		var temp    = layoutInfo.layoutNodes[layoutInfo.idToIndex[graph[0]]];
		var parent  = layoutInfo.layoutNodes[layoutInfo.idToIndex[temp.parentId]];
		var centerX = parent.positionX;
		var centerY = parent.positionY;
	    }
	    s = "Center found at: " + centerX + ", " + centerY;
	    logDebug(s);

	    // Apply force to all nodes in graph
	    for (var j = 0; j < numNodes; j++) {
		var node = layoutInfo.layoutNodes[layoutInfo.idToIndex[graph[j]]];
		s = "Node: " + node.id;
		var dx = centerX - node.positionX;
		var dy = centerY - node.positionY;
		var d  = Math.sqrt(dx * dx + dy * dy);
		if (d > 1.0) { // TODO: Use global variable for distance threshold
		    var fx = options.gravity * dx / d;
		    var fy = options.gravity * dy / d;
		    node.offsetX += fx;
		    node.offsetY += fy;
		    s += ": Applied force: " + fx + ", " + fy;
		} else {
		    s += ": skypped since it's too close to center";
		}
		logDebug(s);
	    }
	}
    }


    /**
     * @brief          : This function propagates the existing offsets from 
     *                   parent nodes to its descendents.
     * @arg layoutInfo : layoutInfo Object
     * @arg cy         : cytoscape Object
     * @arg options    : Layout options
     */
    function propagateForces(layoutInfo, cy, options) {	
	// Inline implementation of a queue, used for traversing the graph in BFS order
	var queue = [];
	var start = 0;   // Points to the start the queue
	var end   = -1;  // Points to the end of the queue

	logDebug("propagateForces");

	// Start by visiting the nodes in the root graph
	queue.push.apply(queue, layoutInfo.graphSet[0]);
	end += layoutInfo.graphSet[0].length;

	// Traverse the graph, level by level, 
	while (start <= end) {
	    // Get the node to visit and remove it from queue
	    var nodeId    = queue[start++];
	    var nodeIndex = layoutInfo.idToIndex[nodeId];
	    var node      = layoutInfo.layoutNodes[nodeIndex];
	    var children  = node.children;

	    // We only need to process the node if it's compound
	    if (0 < children.length) {		
		var offX = node.offsetX;
		var offY = node.offsetY;

		var s = "Propagating offset from parent node : " + node.id + 
		    ". OffsetX: " + offX + ". OffsetY: " + offY;
		s += "\n Children: " + children.toString();
		logDebug(s);
		
		for (var i = 0; i < children.length; i++) {
		    var childNode = layoutInfo.layoutNodes[layoutInfo.idToIndex[children[i]]];
		    // Propagate offset
		    childNode.offsetX += offX;
		    childNode.offsetY += offY;
		    // Add children to queue to be visited
		    queue[++end] = children[i];
		}
		
		// Reset parent offsets
		node.offsetX = 0;
		node.offsetY = 0;
	    }
	    
	}
    }


    /**
     * @brief : 
     */
    function updatePositions(layoutInfo, cy, options) {
	var s = "Updating positions";
	logDebug(s);

	// Reset boundaries for compound nodes
	for (var i = 0; i < layoutInfo.nodeSize; i++) {
	    var n = layoutInfo.layoutNodes[i];
	    if (0 < n.children.length) {
		logDebug("Resetting boundaries of compound node: " + n.id);
		n.maxX = undefined;
		n.minX = undefined;
		n.maxY = undefined;
		n.minY = undefined;
	    }
	}

	for (var i = 0; i < layoutInfo.nodeSize; i++) {
	    var n = layoutInfo.layoutNodes[i];
	    if (0 < n.children.length) {
		// No need to set compound node position
		logDebug("Skipping position update of node: " + n.id);
		continue;
	    }
	    s = "Node: " + n.id + " Previous position: (" + 
		n.positionX + ", " + n.positionY + ")."; 

	    // Limit displacement in order to improve stability
	    var tempX = limitForce(n.offsetX, layoutInfo.temperature);
	    var tempY = limitForce(n.offsetY, layoutInfo.temperature);
	    n.positionX += tempX; 
	    n.positionY += tempY;
	    n.offsetX = 0;
	    n.offsetY = 0;
	    n.minX    = n.positionX - n.width; 
	    n.maxX    = n.positionX + n.width; 
	    n.minY    = n.positionY - n.height; 
	    n.maxY    = n.positionY + n.height; 
	    s += " New Position: (" + n.positionX + ", " + n.positionY + ").";
	    logDebug(s);

	    // Update ancestry boudaries
	    updateAncestryBoundaries(n, layoutInfo);
	}

	// Update size, position of compund nodes
	for (var i = 0; i < layoutInfo.nodeSize; i++) {
	    var n = layoutInfo.layoutNodes[i];
	    if (0 < n.children.length) {
		n.positionX = (n.maxX + n.minX) / 2;
		n.positionY = (n.maxY + n.minY) / 2;
		n.width     = n.maxX - n.minX;
		n.height    = n.maxY - n.minY;
		s = "Updating position, size of compound node " + n.id;
		s += "\nPositionX: " + n.positionX + ", PositionY: " + n.positionY;
		s += "\nWidth: " + n.width + ", Height: " + n.height;
		logDebug(s);
	    }
	}	
    }


    /**
     * @brief : 
     */
    function limitForce(force, max) {
	var s = "Limiting force: " + force;
	s += ". Max: " + max;
	if (force > max) {
	    var res = max;
	} else if (force < (-1 * max)) {
	    var res =  -1 * max;
	} else {
	    var res = force;
	}
	s += ".\nResult: " + res;
	logDebug(s);

	return res;
    }


    /**
     * @brief : 
     */
    function updateAncestryBoundaries(node, layoutInfo) {
	var s = "Propagating new position/size of node " + node.id;
	var parentId = node.parentId;
	if (undefined == parentId) {
	    // If there's no parent, we are done
	    s += ". No parent node.";
	    logDebug(s);
	    return;
	}

	// Get Parent Node
	var p = layoutInfo.layoutNodes[layoutInfo.idToIndex[parentId]];
	var flag = false;

	// MaxX
	if (undefined == p.maxX || node.maxX > p.maxX) {
	    p.maxX = node.maxX;
	    flag = true;
	    s += "\nNew maxX for parent node " + p.id + ": " + p.maxX;
	}

	// MinX
	if (undefined == p.minX || node.minX < p.minX) {
	    p.minX = node.minX;
	    flag = true;
	    s += "\nNew minX for parent node " + p.id + ": " + p.minX;
	}

	// MaxY
	if (undefined == p.maxY || node.maxY > p.maxY) {
	    p.maxY = node.maxY;
	    flag = true;
	    s += "\nNew maxY for parent node " + p.id + ": " + p.maxY;
	}

	// MinY
	if (undefined == p.minY || node.minY < p.minY) {
	    p.minY = node.minY;
	    flag = true;
	    s += "\nNew minY for parent node " + p.id + ": " + p.minY;
	}

	// If updated boundaries, propagate changes upward
	if (flag) {
	    logDebug(s);
	    return updateAncestryBoundaries(p, layoutInfo);
	} 

	s += ". No changes in boundaries/position of parent node " + p.id;  
	logDebug(s);
	return;
    }


    /**
     * @brief : Logs a debug message in JS console, if DEBUG is on
     */
    function logDebug(text) {
	if (DEBUG) {
	    console.debug(text);
	}
    }


    // register the layout
    $$("layout", "cose", CoseLayout);

})(cytoscape);