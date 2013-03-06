;(function($, $$){  

	/**
	 * Layout that places nodes using a tidy layout of a node-link tree
	 * diagram. This algorithm lays out a rooted tree such that each
	 * depth level of the tree is on a shared line. The orientation of the
	 * tree can be set such that the tree goes left-to-right (default),
	 * right-to-left, top-to-bottom, or bottom-to-top.
	 * 
	 * This algorithm is based on Flare's flare.vis.operator.layout.NodeLinkTreeLayout
	 */
        
	var defaults = {
		depthSpace: 50,
		breadthSpace: 25,
		subtreeSpace: 50
	};
	
	TreeLayout = function( options ){
	  	this.PARAMS= "NLTLParams";
	  	this.LEFT_TO_RIGHT = "leftToRight"
		this.RIGHT_TO_LEFT = "rightToLeft";
        this.TOP_TO_BOTTOM = "topToBottom";
        this.BOTTOM_TO_TOP = "bottomToTop";
        
	    this._orient = this.TOP_TO_BOTTOM;
		this._bspace = defaults.breadthSpace;  // the spacing between sibling nodes
	    this._tspace = defaults.subtreeSpace; // the spacing between subtrees
	    this._dspace = defaults.depthSpace; // the spacing between depth levels
	    
	    this._depths = new Array(20); // stores depth co-ords
	    this._maxDepth= 0;
	    this._ax;
	    this._ay; // for holding anchor co-ordinates
	    
	    this._data;
	    this._tree;
	    
	    this.layoutRoot;
	    
	    this.layoutAnchor = 0;
	    
		this.options = $.extend(true, {}, defaults, options);
	};
	
	TreeLayout.prototype.run = function(){
		var options = this.options;
		var cy = options.cy;
		var nodes = cy.nodes();
		var edges = cy.edges();
		var $container = cy.container(); // the container div for cytoscapeweb
		
		var width = $container.width();
		var height = $container.height();
		
		cy.nodes().positions(function(){
			return {
				x: 50,
				y: 50
			};
		});
		
		if(options != null) { 
			this._bspace = options.breadthSpace;  // the spacing between sibling nodes
		    this._dspace = options.depthSpace; // the spacing between depth levels
		    this._tspace = options.subtreeSpace; // the spacing between subtrees
		    this._orient = options.orientation;
		}
		
		this.setup();
		this.layout();
		
		cy.one("layoutready", options.ready);
		cy.trigger("layoutready");
		
		cy.one("layoutstop", options.stop);
		cy.trigger("layoutstop");
	};
	
	TreeLayout.prototype.getOrientation = function() { return this._orient; }
	TreeLayout.prototype.setOrientation = function(o) { this._orient = o; }

	TreeLayout.prototype.getDepthSpacing = function() { return this._dspace; }
	TreeLayout.prototype.setDepthSpacing = function(s) { this._dspace = s; }

	TreeLayout.prototype.getBreadthSpacing = function() { return this._bspace; }
	TreeLayout.prototype.setBreadthSpacing = function(s) { this._bspace = s; }

	TreeLayout.prototype.getSubtreeSpacing = function() { return this._tspace; }
	TreeLayout.prototype.setSubtreeSpacing = function(s) { this._tspace = s; }
	
	 
     TreeLayout.prototype.setup = function(){
     	// if (visualization == null) return; TODO
        if (this._data == null) this._data = this.options.cy; //visualization.data;
        
        if (this.layoutRoot == null) this.layoutRoot = this._data.nodes()[0]; // TODO !layoutRoot == NodeSprite
            
        var a = new DisconnectedTree();
		
		var tb = new DisconnectedTreeBuilder();
		tb.calculate(this.options.cy, a.newNode(this.layoutRoot));
		this._tree = tb.getTree(); //  = DisconnectedTree(tb.tree); TODO ?
		
		this.layoutRoot = this._tree.getRoot();
		
        /*var tb = new DisconnectedTreeBuilder();
        tb.calculate(_data, NodeSprite(layoutRoot));
        _tree = DisconnectedTree(tb.tree);*/
     };
    	
     TreeLayout.prototype.layout = function(){
     	var options = this.options;
		var cy = options.cy;
		var nodes = cy.nodes();
		var edges = cy.edges();
		var $container = cy.container(); // the container div for cytoscapeweb
		
		var width = $container.width();
		var height = $container.height();
		
		var arrays = new Arrays();
     	arrays.fill(this._depths, 0);
		this._maxDepth = 0;
            
        var root = this.layoutRoot;
        
        if (root == null) { this._t = null; return; }
        var rp = this.params(root);

        this.firstWalk(root, 0, 1);                       // breadth/depth stats
        // var a = layoutAnchor;
        this._ax = width / 2; // a.x; TODO hack
        this._ay = height / 2;// a.y;  TODO hack                       // determine anchor
        this.determineDepths();                           // sum depth info
        this.secondWalk(root, null, -rp.prelim, 0, true); // assign positions
        // this.updateEdgePoints(this._t);                        // update edges TODO ?
     };
    
     TreeLayout.prototype.autoAnchor = function(){
     	// otherwise generate anchor based on the bounds
        var b = layoutBounds;
        var r= layoutRoot;
        switch (orientation) {
            case Orientation.LEFT_TO_RIGHT:
                this._ax = b.x + getDepthSpacing() + r.w;
                this._ay = b.y + b.height / 2;
                break;
            case Orientation.RIGHT_TO_LEFT:
                this._ax = b.width - (getDepthSpacing() + r.w);
                this._ay = b.y + b.height / 2;
                break;
            case Orientation.TOP_TO_BOTTOM:
                this._ax = b.x + b.width / 2;
                this._ay = b.y + getDepthSpacing() + r.h;
                break;
            case Orientation.BOTTOM_TO_TOP:
                this._ax = b.x + b.width / 2;
                this._ay = b.height - (getDepthSpacing() + r.h);
                break;
            default:
                throw new Error("Unrecognized orientation value");
        }
        this._anchor.x = this._ax;
        this._anchor.y = this._ay;
     };
        	
	TreeLayout.prototype.firstWalk = function(n,num,depth){
		// this.setSizes(n); TODO ?
        this.updateDepths(depth, n);
        var np = this.params(n);
        np.number = num;
        
        var expanded = n.getExpanded();
        if (n.getChildDegree() == 0 || !expanded) // is leaf
        {
            var l = n.getPrevNode(n);
            np.prelim = l==null ? 0 : this.params(l).prelim + this.spacing(l,n,true);
        }
        else if (expanded) // has children, is expanded
        {
            var midpoint;
            var i;
            var lefty = n.getFirstChildNode();
            var right = n.getLastChildNode();
            var ancestor = lefty;
            var c = lefty;
            
            for (i=0; c != null; ++i, c = c.getNextNode()) {
                this.firstWalk(c, i, depth+1);
                ancestor = this.apportion(c, ancestor);
            }
            this.executeShifts(n);
            midpoint = 0.5 * (this.params(lefty).prelim + this.params(right).prelim);
            
            l = n.getPrevNode();
            if (l != null) {
                np.prelim = this.params(l).prelim + this.spacing(l,n,true);
                np.mod = np.prelim - midpoint;
            } else {
                np.prelim = midpoint;
            }
        }
    };
        
    TreeLayout.prototype.apportion = function(v, a){
        var w = v.getPrevNode();
        if (w != null) {
            var vip;
            var vim;
            var vop;
            var vom;
            var sip;
            var sim;
            var sop;
            var som;
            
            vip = vop = v;
            vim = w;
            vom = vip.getParentNode().getFirstChildNode();
            
            sip = this.params(vip).mod;
            sop = this.params(vop).mod;
            sim = this.params(vim).mod;
            som = this.params(vom).mod;
            
            var shift;
            var nr = this.nextRight(vim);
            var nl = this.nextLeft(vip);
            
            while (nr != null && nl != null) {
                vim = nr;
                vip = nl;
                vom = this.nextLeft(vom);
                vop = this.nextRight(vop);
                this.params(vop).ancestor = v;
                shift = (this.params(vim).prelim + sim) - 
                    (this.params(vip).prelim + sip) + this.spacing(vim,vip,false);
                
                if (shift > 0) {
                    this.moveSubtree(this.ancestor(vim,v,a), v, shift);
                    sip += shift;
                    sop += shift;
                }
                
                sim += this.params(vim).mod;
                sip += this.params(vip).mod;
                som += this.params(vom).mod;
                sop += this.params(vop).mod;
            
                nr = this.nextRight(vim);
                nl = this.nextLeft(vip);
            }
            if (nr != null && this.nextRight(vop) == null) {
                var vopp = this.params(vop);
                vopp.thread = nr;
                vopp.mod += sim - sop;
            }
            if (nl != null && this.nextLeft(vom) == null) {
                var vomp = this.params(vom);
                vomp.thread = nl;
                vomp.mod += sip - som;
                a = v;
            }
        }
		return a;
    };
    
    
    TreeLayout.prototype.nextLeft = function(n){
       	var c= null;
        if (n.getExpanded()) c = n.getFirstChildNode();
        return (c != null ? c : this.params(n).thread);
    };
    
	TreeLayout.prototype.nextRight = function(n){
        var c = null;
        if (n.getExpanded()) c = n.getLastChildNode();
        return (c != null ? c : this.params(n).thread);
    };
        
	TreeLayout.prototype.moveSubtree = function(wm,wp,shift){
        var wmp = this.params(wm);
        var wpp = this.params(wp);
        var subtrees = wpp.number - wmp.number;
        wpp.change -= shift/subtrees;
        wpp.shift += shift;
        wmp.change += shift/subtrees;
        wpp.prelim += shift;
        wpp.mod += shift;
    };   
        
	TreeLayout.prototype.executeShifts = function(n){
        var shift = 0;
        var change = 0;
        for (var c = n.getLastChildNode(); c != null; c = c.getPrevNode()) {
            var cp = this.params(c);
            cp.prelim += shift;
            cp.mod += shift;
            change += cp.change;
            shift += cp.shift + change;
        }
    };
        
	TreeLayout.prototype.ancestor = function(vim,v,a){
            var vimp = this.params(vim);
            var p = v.getParentNode(v);
            return (vimp.ancestor.getParentNode() == p ? vimp.ancestor : a);
    };
        
	TreeLayout.prototype.secondWalk = function(n, p, m, depth, visible){
        // set position
        var np = this.params(n);
        var o = n; // TODO //_t.$(n);
        this.setBreadth(o, p, (visible ? np.prelim : 0) + m);
        this.setDepth(o, p, this._depths[depth]);
        // this.setVisibility(n, o, visible); TODO
        
        // recurse
        var v = n.getExpanded() ? visible : false;
        var b = m + (n.getExpanded() ? np.mod : np.prelim)
        if (v) depth += 1;
        for (var c = n.getFirstChildNode(); c!=null; c=c.getNextNode()) {
            this.secondWalk(c, n, b, depth, v);
        }
        np.clear();
    };
        
  TreeLayout.prototype.setBreadth = function(n,p,b){
        switch (this._orient) {
            case this.LEFT_TO_RIGHT:
            case this.RIGHT_TO_LEFT:
                n.setY( this._ay + b);
                break;
            case this.TOP_TO_BOTTOM:
            case this.BOTTOM_TO_TOP:
                n.setX( this._ax + b);
                break;
            default:
                throw new Error("Unrecognized orientation value");
        }
    };
	  
	  TreeLayout.prototype.setDepth = function(n,p,d){
            switch (this._orient) {
                case this.LEFT_TO_RIGHT:
                    n.setX( this._ax + d);
                    break;
                case this.RIGHT_TO_LEFT:
                    n.setX( this._ax - d);
                    break;
                case this.TOP_TO_BOTTOM:
                    n.setY( this._ay + d);
                    break;
                case this.BOTTOM_TO_TOP:
                    n.setY( this._ax - d);
                    break;
                default:
                    throw new Error("Unrecognized orientation value");
            }
        };
        
	TreeLayout.prototype.setVisibility = function(n,o,visible){
        o.mouseEnabled = visible;
        if (n.getParentEdge() != null) {
            o = _t.$(n.getParentEdge());
            o.mouseEnabled = visible;
        }
	};
        
	TreeLayout.prototype.setSizes = function(n){
		if (n != null) {
            this._t.endSize(n, _rect);
            n.w = _rect.width;
            n.h = _rect.height;
        }        
	};
	
	TreeLayout.prototype.spacing = function(l,r,siblings){
		var w = (this._orient == this.TOP_TO_BOTTOM || this._orient == this.BOTTOM_TO_TOP);
            return (siblings ? this.getBreadthSpacing() : this.getSubtreeSpacing()) + 0.5 *
                    (w ? l.w + r.w : l.h + r.h)
	};
	
	// Updates the depth spaces according to the given item which is a node
	TreeLayout.prototype.updateDepths = function(depth, item){
		var v = (this._orient == this.TOP_TO_BOTTOM || this._orient == this.BOTTOM_TO_TOP);
        var d = v ? item.h : item.w;

        // resize if needed
        if (depth >= this._depths.length) {
        	var arr = new Arrays;
        	alert(1.5*depth);
            this._depths = arr.copy(this._depths, new Array(Math.round(1.5*depth)));
            for (var i=depth; i<this._depths.length; ++i) this._depths[i] = 0;
        } 

        this._depths[depth] = Math.max(this._depths[depth], d);
        this._maxDepth = Math.max(this._maxDepth, depth);
	};
	
	// Determines the depth spaces in the tree
	TreeLayout.prototype.determineDepths = function(){
		for (var i =1; i<this._maxDepth; ++i)
            this._depths[i] += this._depths[i-1] + this.getDepthSpacing();
	};
	
	// Used for creating NLTLParams objects
	TreeLayout.prototype.params = function(n){
        var p = n.params;
        if (p == null) {
            p = new NLTLParams();
            n.params = p;
        }
        if (p.number == -2) { p.init(n); }
        return p;
	};
	
	// Specific parameters used for Node Link Tree Layout
	NLTLParams = function() {
		this.prelim = 0;
		this.mod = 0;
		this.shift = 0;
		this.change = 0;
		this.number = -2;
		this.ancestor = null;
		this.thread = null;
	};
	
	NLTLParams.prototype.init = function(item){
    	this.ancestor = item;
    	this.number = -1;
    };
	
	NLTLParams.prototype.clear = function(){
		this.number = -2;
		this.prelim = this.mod = this.shift = this.change = 0;
		this.ancestor = this.thread = null;
	};

	TreeLayout.prototype.stop = function(){
		// not a continuous layout
	};
	
	// register the layout
	$.cytoscapeweb(
		"layout", // we're registering a layout
		"tree", // the layout name
		TreeLayout // the layout prototype
	);
		
})(jQuery, jQuery.cytoscapeweb);
