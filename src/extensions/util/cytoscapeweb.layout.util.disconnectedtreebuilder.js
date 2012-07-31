;(function($, $$){
	
	/**
	 * Calculates a spanning tree for a graph structure.
	 * 
	 * This prototype is based on Flare's flare.vis.data.TreeBuilder
	 */
	
	DisconnectedTreeBuilder = function() {
		this.buildTree = true;
		this.annotateEdges = false;
		this.DEPTH_FIRST = "depth-first";
		this.BREADTH_FIRST = "breadth-first";
		this.MINIMUM_SPAN  = "minimum-span";
	
		this.buildTree;
		this.annotateEdges;
		
		// var _s= Property.$("props.spanning"); TODO
	    this._w= null;
	    this._policy= this.MINIMUM_SPAN;
	    this._links= 3; //NodeSprite.GRAPH_LINKS;
	    this._tree= null;
	    
	    this.root;	
	}
	
	/* Extend Array */
	Array.prototype.contains = function(obj) {
	    var i = this.length;
	    while (i--) {
	        if (this[i].id == obj.id) {
	            return true;
	        }
	    }
	    return false;
	}
	
	DisconnectedTreeBuilder.prototype.getTree = function(){
		return this._tree;
	}
	
	DisconnectedTreeBuilder.prototype.getPolicy = function(){
		return _policy;
	}
	
	DisconnectedTreeBuilder.prototype.setPolicy = function(p){
		if (p==DEPTH_FIRST || p==BREADTH_FIRST || p==MINIMUM_SPAN) {
			_policy = p;
		} else {
			throw new Error("Unrecognized policy: "+p);
		}
	}
	
	DisconnectedTreeBuilder.prototype.getSpanningField = function(){
		return _s.name;
	}
	
	DisconnectedTreeBuilder.prototype.setSpanningField = function(f){
		_s = Property.$(f);
	}
	
	DisconnectedTreeBuilder.prototype.getLinks = function(){
		return _links;
	}
	
	DisconnectedTreeBuilder.prototype.setLinks = function(linkType){
		if (linkType == NodeSprite.GRAPH_LINKS ||
			linkType == NodeSprite.IN_LINKS ||
			linkType == NodeSprite.OUT_LINKS) 
		{
			_links = linkType;
		} else {
			throw new Error("Unsupported link type: "+linkType);
		}
	}
	
	DisconnectedTreeBuilder.prototype.getEdgeWeight = function(){
		return this._w;
	}
	
	DisconnectedTreeBuilder.prototype.setEdgeWeight = function(w){
		if (w==null) {
                this._w = null;
            } else if (w instanceof String) {
                this._w = Property.$(String(w)).getValue;
            } else if (this.w instanceof IEvaluable) {
                this._w = IEvaluable(w).eval;
            } else if (w instanceof Function) {
                this._w = w;
            } else {
                throw new Error("Unrecognized edgeWeight value. " +
                    "The value should be a Function or String.");
            }
	}
	
	
	DisconnectedTreeBuilder.prototype.calculate = function(data, n){
		var w = this.getEdgeWeight();
        if (n==null) { this._tree = null; return; } // do nothing for null root
		//if (!buildTree && !annotateEdges) return; // nothing to do TODO ?
            
		// initialize
		if (this.buildTree) {
			/*data.nodes.visit(function(nn) {
				nn.removeEdges(NodeSprite.TREE_LINKS);
			});*/
			this._tree = new DisconnectedTree();
		} else {
			this._tree = null;
		}
		/*if (annotateEdges) {
			data.edges.setProperty(_s.name, false);
		}*/
            
        switch (this._policy) {
            case this.DEPTH_FIRST:
                this.depthFirstTree(data, n);
                return;
            case this.BREADTH_FIRST:
                this.breadthFirstTree(data, n);
                return;
            case this.MINIMUM_SPAN:
                if (w==null) {
                    this.breadthFirstTree(data, n);
                } else {
                    this.minimumSpanningTree(data, n, w);
                }
                return;
        }
	}
	
	DisconnectedTreeBuilder.prototype.minimumSpanningTree = function(data, n, w){
        var hn, weight, e;
        _tree = null;
        if (buildTree) {
            _tree = new DisconnectedTree();
            _tree._root = n;
        }
        
        // initialize the heap
        var heap = new FibonacciHeap();
        data.nodes.visit(function(nn) {
            nn.props.heapNode = heap.insert(nn);
        });
        heap.decreaseKey(n.props.heapNode, 0);
        
        // collect spanning tree edges (Prim's algorithm)
        while (!heap.empty) {
            hn = heap.removeMin();
            n = hn.data;
            // add saved tree edge to spanning tree
            if ((e=(n.props.treeEdge))) {
                if (annotateEdges) _s.setValue(e, true);
                if (buildTree) _tree.addChildEdge(e);   
            }
            
            n.visitEdges(function(e) {
                if (!GraphUtils.isFilteredOut(e)) { // IGNORE FILTERED OUT EDGES!!!
                    var nn = e.other(n);
                    var hnn = nn.props.heapNode;
                    weight = (w==null ? 1 : w(e));
                    if (hnn.inHeap && weight < hnn.key) {
                        nn.props.treeEdge = e; // set tree edge
                        heap.decreaseKey(hnn, weight);
                    }
                }
            }, _links);
        }
            
            // clean-up nodes
            data.nodes.visit(function(nn) {
                delete nn.props.treeEdge;
                delete nn.props.heapNode;
            });
        }
        
        
    DisconnectedTreeBuilder.prototype.breadthFirstTree = function(data, n){
        
        var graph = new DisconnectedTree();
        
		var nodes = data.nodes();
		var edges = data.edges();
        
        var ty = data.edges("[source="+n.id+"]");
        // make some nodes
		nodes.each(function(i, node){
			node.scratch("springy", {
				model: graph.newNode({
					element: node
				})
			});
		});

		// connect them with edges
		edges.each(function(i, edge){
			fdSrc = edge.source().scratch("springy.model");
			fdTgt = edge.target().scratch("springy.model");

			edge.scratch("springy", {
				model: graph.newAllEdge(fdSrc, fdTgt, {
					element: edge
				})
			});
		});
        
        this.buildTree = true;
        this.visited = {};
        
        this._tree.addRootFromGraph(graph.nodes[0]);
        // this._tree._root._allEdges = graph.nodes[0]._allEdges;
        var q = [this._tree._root];   
        
        while (q.length > 0) {
            n = q.shift();
            var edges = n._allEdges;
            if (typeof(edges) !== 'undefined') {
	            for( var i = 0; i < edges.length; i++)
	            {
	            	var e = edges[i];
	            	var nn = e.other(n);
	            	if (!(this._tree.nodes.contains(nn))) {
	            		this._tree.addChildEdge(e);
	            		q.push(nn);
	            	}
	            }
            }
            /*n.visitAllEdges(function(e,tree) {
                //if (!GraphUtils.isFilteredOut(e)) { // IGNORE FILTERED OUT EDGES!!!
                    var nn = e.other(n);
                    if (tree.nodes.contains(nn))
                        return;
                    // if (this.annotateEdges) this._s.setValue(e, true);
                        tree.addChildEdge(e);
                    
                    q.push(nn);
                //}
            }, this._links, this._tree);*/
        }
    }
    
    DisconnectedTreeBuilder.prototype.depthFirstTree = function(data, n) {
            depthFirstHelper(n, buildTree ? null : new Dictionary());
	}
    
    DisconnectedTreeBuilder.prototype.depthFirstHelper = function(n, visited) {
        n.visitEdges(function(e) {
            var nn = e.other(n);
            if (buildTree ? _tree.nodes.contains(nn) : visited[nn])
                return;
            if (annotateEdges) _s.setValue(e, true);
            if (buildTree) {
                _tree.addChildEdge(e);
            } else {
                visited[nn] = true;
            }
            if (nn.degree > 1) depthFirstHelper(nn, visited);
        }, _links);
    }   
			
})(jQuery, jQuery.cytoscapeweb);
