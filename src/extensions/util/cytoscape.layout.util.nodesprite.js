;(function($$){

	/**
	 * Represents a node with the connection data between this node and
	 * the other nodes in the graph.
	 * 
	 * Using NodeSprite objects a tree structure can be constructed since
	 * parent and child edges of a node is stored inside NodeSprite, and
	 * tree traversing functions are also available.
	 * 
	 * This Javascript code is based on Flare's flare.vis.data.NodeSprite
	 * 
	 * Note that some functionality is not used by the current Cytoscape
	 * 
	 * This prototype is based on Flare's flare.vis.data.NodeSprite
	 */

	NodeSprite = function( id, data) {
		/** Flag indicating inlinks, edges that point to this node. */
		this.IN_LINKS = 1;
		/** Flag indicating outlinks, edges that point away from node. */
		this.OUT_LINKS = 2;
		/** Flag indicating both inlinks and outlinks. */
		this.GRAPH_LINKS = 3;  // IN_LINKS | OUT_LINKS
		/** Flag indicating child links in a tree structure. */
		this.CHILD_LINKS = 4;
		/** Flag indicating the link to a parent in a tree structure. */
		this.PARENT_LINK = 8;
		/** Flag indicating both child and parent links. */
		this.TREE_LINKS = 12; // CHILD_LINKS | PARENT_LINK
		/** Flag indicating all links, including graph and tree links. */
		this.ALL_LINKS = 15; // GRAPH_LINKS | TREE_LINKS
		/** Flag indicating that a traversal should be performed in reverse. */
		this.REVERSE = 16;
		
		this._parentEdge;
		this._idx = -1; // node index in parent's array
		this._childEdges;
		this._inEdges;
		this._outEdges;
		this._expanded = true;
		
		this.id = id; // id of this node
		// data of the node element, this is the original Cytoscape Node
		this.data = typeof(data) !== 'undefined' ? data : {};
		// edges that form a graph 
		this._allEdges;
		
		this.w = 10;
		this.h = 10;
		
		this.x = 0;
		this.y = 0;
		this.size = 1;
		
		this.radius = 0;
		this.angle = 0;
	}
	
	NodeSprite.prototype.getExpanded = function() { return this._expanded; }
	NodeSprite.prototype.setExpanded = function(b) { if (this._expanded != b) { this._expanded = b; dirty(); } }
	NodeSprite.prototype.getParentEdge = function() { return this._parentEdge; }
	NodeSprite.prototype.setParentEdge = function(e) { this._parentEdge = e; }
	NodeSprite.prototype.getParentIndex = function() { return this._idx; }
	NodeSprite.prototype.setParentIndex = function(i) { this._idx = i; }
	
	NodeSprite.prototype.getChildDegree = function() { return this._childEdges==null ? 0 : this._childEdges.length; }
	NodeSprite.prototype.getDegree = function() { return this.getInDegree() + this.getOutDegree(); }
	NodeSprite.prototype.getInDegree = function() { return this._inEdges==null ? 0 : this._inEdges.length; }
	NodeSprite.prototype.getOutDegree = function() { return this._outEdges==null ? 0 : this._outEdges.length; }

	NodeSprite.prototype.getDepth = function() {
		for (var d=0, p=this.getParentNode(); p!=null; p=p.getParentNode(), d++){}
		return d;
	}
	
	NodeSprite.prototype.getParentNode = function()
	{
		return this._parentEdge == null ? null : this._parentEdge.other(this);
	}

	/** The first child of this node in the tree structure. */
	NodeSprite.prototype.getFirstChildNode = function()
	{
		return this.getChildDegree() > 0 ? this._childEdges[0].other(this) : null;
	}

	/** The last child of this node in the tree structure. */
	NodeSprite.prototype.getLastChildNode = function()
	{
		var len = this.getChildDegree();
		return len > 0 ? this._childEdges[len-1].other(this) : null;
	}

	/** The next sibling of this node in the tree structure. */
	NodeSprite.prototype.getNextNode = function()
	{
		var p = this.getParentNode();
		var i = this._idx+1;
		if (p == null || i >= p.getChildDegree()) return null;
		return this.getParentNode().getChildNode(i);
	}

	/** The previous sibling of this node in the tree structure. */
	NodeSprite.prototype.getPrevNode = function()
	{
		var p = this.getParentNode();
		var i = this._idx-1;
		if (p == null || i < 0) return null;
		return this.getParentNode().getChildNode(i);
	}
	
	NodeSprite.prototype.setX = function(v) {
		this.data.element[0].position("x", v);
	}
	
	NodeSprite.prototype.setY = function(v) {
		this.data.element[0].position("y", v);
	}
	
	NodeSprite.prototype.getChildEdge = function(i) {
		return this._childEdges[i];
	}

	NodeSprite.prototype.getChildNode = function(i)
	{
		return this._childEdges[i].other(this);
	}

	NodeSprite.prototype.addChildEdge = function(e)
	{
		if (this._childEdges == null) this._childEdges = new Array();
		this._childEdges.push(e);
		return this._childEdges.length - 1;
	}
	
	NodeSprite.prototype.addAllEdge = function(e)
	{
		if (this._allEdges == null) this._allEdges  = new Array();
		this._allEdges.push(e);
		return this._allEdges.length - 1;
	}
	
	NodeSprite.prototype.visitAllEdges = function(f, opt, tree)
	{
		var ff = null; // Filter.$(filter); TODO filter
		var rev = (opt & this.REVERSE) > 0;
		if( typeof(this._allEdges) === 'undefined') return false;
		if (this.visitEdgeHelper(f, this._allEdges, rev, ff, tree)) return true;
	}
		
	NodeSprite.prototype.visitEdges = function(f, opt, filter)
	{
		var ff = null; // Filter.$(filter); TODO filter
		var rev = (opt & this.REVERSE) > 0;
		if (opt & this.IN_LINKS && this._inEdges != null) { 
			if (this.visitEdgeHelper(f, this._inEdges, rev, ff)) return true;
		}
		if (opt & this.OUT_LINKS && this._outEdges != null) {
			if (this.visitEdgeHelper(f, this._outEdges, rev, ff)) return true;
		}
		if (opt & this.CHILD_LINKS && this._childEdges != null) {
			if (this.visitEdgeHelper(f, this._childEdges, rev, ff)) return true;
		}
		if (opt & this.PARENT_LINK && this._parentEdge != null) {
			if ((ff==null || ff(this._parentEdge)) && f(this._parentEdge))
				return true;
		}
		return false;
	}

	NodeSprite.prototype.visitEdgeHelper = function(f, a, r, ff,tree)
	{
		var i;
		var n=a.length;
		var v;
		
		if (r) {
			for (i=n; --i>=0;) {
				if ((ff==null || ff(a[i])) && f(a[i],tree))
					return true;
			}
		} else {
			for (i=0; i<n; ++i) {
				if ((ff==null || ff(a[i])) && f(a[i],tree))
					return true;
			}
		}
		return false;
	}
	
	NodeSprite.prototype.visitTreeDepthFirst = function(f, preorder)
	{
		if (preorder == null) { preorder = false; }
	    
		if (preorder && (f(this))) return true;
		for (var i = 0; i<this.getChildDegree(); ++i) {
			if (this.getChildNode(i).visitTreeDepthFirst(f, preorder))
				return true;
		}
		if (!preorder && (f(this))) return true;
		return false;
	}

})(cytoscape);
