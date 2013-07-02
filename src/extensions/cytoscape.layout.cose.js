;(function($$){

    /**
    * @brief :  default layout options
    */
    var defaults = {
	ready:   function(){},
	stop:    function(){},
	numIter: 10,
	refresh: 1     // TODO: Change it to 0
    };


    /**
     * @brief       : constructor
     * @arg options : object containing layout options
     */
    function CoseLayout(options){
	this.options = $$.util.extend(true, {}, defaults, options); 
    }


    /**
     * @brief     : 
     * @arg cy    : cytoscape.js object
     * @return    : layout info object
     */
    function createLayoutInfo(cy) {
	var layoutInfo   = {
	    layoutNodes  : [], 
	    idToIndexMap : {},
	    nodeSize     : cy.nodes().size(),
	    graphSet     : []
	};
	
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
	    // Add new node
	    layoutInfo.layoutNodes.push(tempNode);
	    // Add entry to id-index map
	    layoutInfo.idToIndexMap[tempNode.id] = i;
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
		layoutInfo.layoutNodes[layoutInfo.idToIndexMap[p_id]].children.push(n.id);
	    } else {
		// If a node doesn't have a parent, then it's in the root graph
		queue[++end] = n.id;
		tempGraph.push(n.id);
	    }
	}
	
	// Add root graph to graphSet
	layoutInfo.graphSet.push(tempGraph);

	// traverse the graph, level by level, 
	while (start <= end) {
	    // get the node to visit and remove it from queue
	    var node_id  = queue[start++];
	    var node_ix  = layoutInfo.idToIndexMap[node_id];
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

	// Finally, return layoutInfo object
	return layoutInfo;
    }


    /**
     * @brief: printsLayoutInfo into js console
     *         Only used for debbuging 
     */
    function printLayoutInfo(layoutInfo) {
	console.debug("layoutNodes:");
	for (var i = 0; i < layoutInfo.nodeSize; i++) {
	    var n = layoutInfo.layoutNodes[i];
	    var s = 
		"\nindex: "     + i + 
		"\nId: "        + n.id + 
		"\nChildren: "  + n.children.toString() +  
		"\nparentId: "  + n.parentId  + 
		"\npositionX: " + n.positionX + 
		"\npositionY: " + n.positionY;
	    console.debug(s);		
	}	
	
	console.debug("idToIndexMap");
	for (var i in layoutInfo.idToIndexMap) {
	    console.debug("Id: " + i + "\nIndex: " + layoutInfo.idToIndexMap[i]);
	}

	console.debug("Graph Set");
	var set = layoutInfo.graphSet;
	for (var i = 0; i < set.length; i ++) {
	    console.debug("Set : " + i + ": " + set[i].toString());
	} 
	
	return;
    }


    /**
     * @brief          : Updates the positions 
     * @arg layoutInfo : LayoutInfo object
     * @arg cy         : Cytoscape object
     * @arg options    : Layout options
     */
    function updatePositions(layoutInfo, cy, options) {
	var container = cy.container();
	var width     = container.clientWidth;
	var height    = container.clientHeight;

	cy.nodes().positions(function(i, ele){
	    lnode = layoutInfo.layoutNodes[layoutInfo.idToIndexMap[ele.data('id')]];
	    return {
		x: lnode.positionX,
		y: lnode.positionY
	    };
	});	
    }


    /**
     * @brief : 
     */
    function step(layoutInfo, cy, options) {

    }


    /**
     * @brief : runs the layout
     */
    CoseLayout.prototype.run = function(){
	var options = this.options;
	var cy      = options.cy;
		
	// Initialize layout info
	var layoutInfo = createLayoutInfo(cy);
	
	// Only for debbuging - TODO: Remove before release
	printLayoutInfo(layoutInfo);
	
	for (var i = 0; i < options.numIter; i++) {
	    // Do one step in the phisical simmulation
	    step(layoutInfo, cy, options);

	    // If required, update positions
	    if (0 < options.refresh && 
		0 == i % options.refresh) {
		updatePositions(layoutInfo, cy, options);
	    }

	    // ONLY FOR DEBBUGING! TODO: Remove before release
	    var delay       = 1; 
	    var now         = new Date();
	    var desiredTime = new Date().setSeconds(now.getSeconds() + delay);	
	    while (now < desiredTime) {
		now = new Date();
	    }

	}
	
	updatePositions(layoutInfo, cy, options);

	// trigger layoutready when each node has had its position set at least once
	cy.one("layoutready", options.ready);
	cy.trigger("layoutready");

	// trigger layoutstop when the layout stops (e.g. finishes)
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


    // register the layout
    $$("layout", "cose", CoseLayout);

})(cytoscape);