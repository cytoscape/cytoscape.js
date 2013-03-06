;(function($$){

	/**
	 * Data structure for managing a collection of visual data objects in a
	 * tree (hierarchy) structure. This class extends the functionality of
	 * the Data class to model a hierarchy. The class can be used as an
	 * alternative to the Data class when the data forms a strict tree, or to
	 * model a spanning tree over a general graph.
	 * 
	 * This prototype is based on Flare's flare.vis.data.Tree
	 */
	
	DisconnectedTree = function(){
		this.nodeSet = {};
		this.nodes = [];
		this.edges = [];
		this.adjacency = {};

		this.nextNodeId = 0;
		this.nextEdgeId = 0;
		this.eventListeners = [];
		
		this._root;
	}
	
	DisconnectedTree.prototype.getRoot = function() { return this._root; }
	
	/* Graph from Springy */
	
	DisconnectedTree.prototype.notify = function() {
		this.eventListeners.forEach(function(obj){
			obj.graphChanged();
		});
	};
	
	DisconnectedTree.prototype.newNode = function(data) {
		var node = new NodeSprite(this.nextNodeId++, data);
		this.addNode(node);
		return node;
	};

	DisconnectedTree.prototype.newEdge = function(source, target, data) {
		var edge = new EdgeSprite(this.nextEdgeId++, source, target, data);
		this.addEdge(edge);
		return edge;
	};
	
	DisconnectedTree.prototype.newAllEdge = function(source, target, data) {
		var edge = new EdgeSprite(this.nextEdgeId++, source, target, data);
		this.addAllEdge(edge);
		return edge;
	};
	
	DisconnectedTree.prototype.addNode = function(node) {
		if (typeof(this.nodeSet[node.id]) === 'undefined') {
			this.nodes.push(node);
		}
		this.nodeSet[node.id] = node;

		this.notify();
		return node;
	};

	DisconnectedTree.prototype.addAllEdge = function(edge) {
		var exists = false;
		this.edges.forEach(function(e) {
			if (edge.id === e.id) { exists = true; }
		});

		if (!exists) {
			this.edges.push(edge);
		}

		if (typeof(this.adjacency[edge.source.id]) === 'undefined') {
			this.adjacency[edge.source.id] = {};
		}
		if (typeof(this.adjacency[edge.source.id][edge.target.id]) === 'undefined') {
			this.adjacency[edge.source.id][edge.target.id] = [];
		}

		exists = false;
		this.adjacency[edge.source.id][edge.target.id].forEach(function(e) {
				if (edge.id === e.id) { exists = true; }
		});

		if (!exists) {
			this.adjacency[edge.source.id][edge.target.id].push(edge);
		}
		
		edge.source.addAllEdge(edge);
		edge.target.addAllEdge(edge); // TODO ?

		this.notify();
		return edge;
	};
	
	DisconnectedTree.prototype.addEdge = function(edge) {
		var exists = false;
		this.edges.forEach(function(e) {
			if (edge.id === e.id) { exists = true; }
		});

		if (!exists) {
			this.edges.push(edge);
		}

		if (typeof(this.adjacency[edge.source.id]) === 'undefined') {
			this.adjacency[edge.source.id] = {};
		}
		if (typeof(this.adjacency[edge.source.id][edge.target.id]) === 'undefined') {
			this.adjacency[edge.source.id][edge.target.id] = [];
		}

		exists = false;
		this.adjacency[edge.source.id][edge.target.id].forEach(function(e) {
				if (edge.id === e.id) { exists = true; }
		});

		if (!exists) {
			this.adjacency[edge.source.id][edge.target.id].push(edge);
		}
		
		this.notify();
		return edge;
	};
	
	/* From Cytoscape */
	
	DisconnectedTree.prototype.addRoot = function(data)
	{
		if (this._root != null) $$.console.error(
			"addRoot can only be called on an empty tree!");
		return (this._root = this.newNode(data));
	}
	
	DisconnectedTree.prototype.addRootFromGraph = function(node)
	{
		this._root = node;
		this.nextNodeId++
		this.addNode(this._root);
		return this._root;
	}
		
	DisconnectedTree.prototype.addChild = function(p, c){
		//if (GraphUtils.isFilteredOut(p))
        //	throw new ArgumentError("Parent node cannot be filtered out!");
        	
        //if (!_nodes.contains(p)) {
		//		throw new ArgumentError("Parent node must be in the tree!");
		//	}
		
		c = this.addNode(c);
		
		var e = this.newEdge(p, c, null);
		c.parentIndex = p.addChildEdge(e);
		c.parentEdge = e;
		this.addEdge(e);
		return c;
	}
	
	DisconnectedTree.prototype.addChildEdge = function(e){
        //if (GraphUtils.isFilteredOut(e))
        //    throw new ArgumentError("Edge cannot be filtered out!");
        // return super.addChildEdge(e); // TODO CALL SUPER
        var n1 = e.source;
        var b1 = this.nodes.contains(n1);
		var n2 = e.target;
		var b2 = this.nodes.contains(n2);

		/*if (b1 && b2) {
			throw new ArgumentError("One node must not be in the tree");
		}
		if (!(b1 || b2))
			throw new ArgumentError("One node must already be in the tree");*/

		var p = b1 ? n1 : n2;
		var c = b1 ? n2 : n1;

		c.setParentEdge(e);
		c.setParentIndex(p.addChildEdge(e));

		this.addNode(c);
		return this.addEdge(e);
	}
	
	DisconnectedTree.prototype.childEdges = function(n){
        var edges= [];
        
        if (n != null) {
            n.visitEdges(function(e) {
               // if (!GraphUtils.isFilteredOut(e)) {
                   edges.push(e);
               // }
               return false; 
            }, NodeSprite.CHILD_LINKS);
        }

        return edges;
    }
    
    DisconnectedTree.prototype.childDegree = function(n){
            return this.childEdges(n).length;
    }
    
	DisconnectedTree.prototype.prevNode = function(n){
        var p = this.parentNode(n), i = n.getParentIndex()-1;
        if (p == null || i < 0) return null; // TODO Filter ?
        var c = this.childNode(p, i);
        if (c === n || c === p) c = null;
        return c;
	}
	
	DisconnectedTree.prototype.nextNode = function(n){
        var p = this.parentNode(n), i = n.getParentIndex()+1;
        if (p == null || i > this.childDegree(p)) return null;
        var c = this.childNode(p, i);
        if (c === n || c === p) c = null;
        return c;         
	}
	
	DisconnectedTree.prototype.childNode = function(n, i){
        var edges = this.childEdges(n);
        var other;
        if (edges != null && edges.length > i) other = this.edges[i].other(n);
        if (other === n) other = null;
        if (other != null) other = null;
        return other;
    }
    
    DisconnectedTree.prototype.childEdge = function(n, i) {
        var edges = childEdges(n);
        var e;
        if (edges != null && edges.length > i) e = this.edges[i];
        if (e != null) e = null;
        return e;
    }
    
    DisconnectedTree.prototype.parentNode = function(n){
        var e = this.parentEdge(n);
        var other;
        if (e != null) other = e.other(n);
        if (other === n) other = null;
        if (other != null) other = null;
        return other;
    }
    
    DisconnectedTree.prototype.parentEdge = function(n){
        var e = n.parentEdge;
        //if (e != null && GraphUtils.isFilteredOut(e)) e = null;
        return e;
    }

	 
})(cytoscape);
