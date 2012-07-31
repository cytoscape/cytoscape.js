;(function($, $$){

	/**
	 * Layout that places tree nodes in a radial layout, laying out depths of a tree
	 * along circles of increasing radius.
	 * 
	 * This algorithm is based on Flare's flare.vis.operator.layout.RadialTreeLayout
	 */
	
	var defaults = {
		radius: 50,
		autoScale: true,
		angleWidth: Math.PI/2
	};
	
	function RadialLayout( options ){
		this.DEFAULT_RADIUS = 50;
	
	    this._theta1 = Math.PI/2;
	    this._theta2 = Math.PI/2 - 2*Math.PI;
	    this._setTheta = false;
	    this._prevRoot = null;
	    this._sortAngles = true;
	    this._setTheta = false;
	    this._autoScale = true;
	    this._useNodeSize = true;
	    this._prevRoot = null;
		this._maxDepth = 0;
		this._radiusInc = this.DEFAULT_RADIUS;
	    this._data;
	    this._tree;
	    this._anchor = {};
      	this.layoutRoot;
      	
		this.options = $.extend(true, {}, defaults, options);
	}
	
	RadialLayout.prototype.run = function(){
		var options = this.options;
		var cy = options.cy;
		var nodes = cy.nodes();
		var edges = cy.edges();
		var $container = cy.container(); // the container div for cytoscapeweb
		
		var width = $container.width();
		var height = $container.height();

		this.setup();
		this.layout();
		
		cy.one("layoutready", options.ready);
		cy.trigger("layoutready");
		
		cy.one("layoutstop", options.stop);
		cy.trigger("layoutstop");
	};
	
	function exec(fn){
		if( fn != null && typeof fn == typeof function(){} ){
			fn();
		}
	}
	
	RadialLayout.prototype.setup = function(){
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
	
	RadialLayout.prototype.getStartAngle = function(){
	 	return this._theta1;
	 }
	 
     RadialLayout.prototype.setStartAngle = function(a){
     	this._theta2 += (a - this._theta1);
        this._theta1 = a;
        this._setTheta = true;
     }
     
     RadialLayout.prototype.getAngleWidth = function(){
     	return this._theta1 - this._theta2;
     }
     
     RadialLayout.prototype.setAngleWidth = function(w){
     	this._theta2 = this._theta1 - w;
     	this._setTheta = true;
     }
     
 	RadialLayout.prototype.layout = function()
	{
		var n = this.layoutRoot;
		if (n == null) { this._t = null; return; }
		var np = this.params(n);
		
		var options = this.options;
		var cy = options.cy;
		var nodes = cy.nodes();
		var edges = cy.edges();
		var $container = cy.container(); // the container div for cytoscapeweb
		
		var width = $container.width();
		var height = $container.height();
		
		var layoutBounds = {};
		layoutBounds.width = width;
		layoutBounds.height = height;
		
		if(options != null) { 
			this.setAngleWidth(options.angleWidth);
			this._radiusInc = options.radius;
			this._autoScale = options.autoScale;
		}
		
		// calc relative widths and maximum tree depth
    	// performs one pass over the tree
    	this._maxDepth = 0;
    	this.calcAngularWidth(n, 0);
    	
		if (this._autoScale) this.setScale(layoutBounds);
		// if (!this._setTheta) TODO
		 this.calcAngularBounds(n);
		this._anchor.x = width / 2;
		this._anchor.y = height / 2;
		
		// perform the layout
        if (this._maxDepth > 0) {
        	this.doLayout(n, this._radiusInc, this._theta1, this._theta2);
        } else if (n.getChildDegree() > 0) {
        	n.visitTreeDepthFirst(function(n) {
        		n.origin = this._anchor;
        		var o = n;
        		// collapse to inner radius
				o.radius = o.h = o.v = this._radiusInc / 2;
				o.alpha = 0;
				o.mouseEnabled = false;
				if (n.getParentEdge() != null)
					n.getParentEdge().alpha = false;
        	});
        }
        
        var list = this._tree.nodes;
        var listsize = list.length;
		var anchorX = $container.width() / 2;
		var anchorY = $container.height() / 2;

		for (i=0; i<listsize; ++i)
		{
			var element = list[i];
		    element.setX( anchorX + element.radius * Math.cos(element.angle));
            element.setY( anchorY + element.radius * Math.sin(element.angle));
		}
        
        // update properties of the root node
        np.angle = this._theta2 - this._theta1;
        n.origin = this._anchor;
        this.update(n, 0, this._theta1+np.angle/2, np.angle, true);
        
        /*if (!this._t.immediate) {
        	delete _t._(n).values.radius;
        	delete _t._(n).values.angle;
        }*/ // TODO ?
        
        n.setX(this._anchor.x);
        n.setY(this._anchor.y);
		
		// updateEdgePoints(_t); TODO
	}
		
	RadialLayout.prototype.setScale = function(bounds) {
        var r = Math.min(bounds.width, bounds.height)/2.0;
        if (this._maxDepth > 0) this._radiusInc = r / this._maxDepth;
    }
    
	RadialLayout.prototype.calcAngularBounds = function(r)
    {
        if (this._prevRoot == null || r == this._prevRoot)
        {
            this._prevRoot = r; return;
        }
        
        // try to find previous parent of root
        var p = _prevRoot;
        var pp;
        
        while (true) {
        	pp = p.getParentNode();
            if (pp == r) {
                break;
            } else if (pp == null) {
                this._prevRoot = r;
                return;
            }
            p = pp;
        }

        // compute offset due to children's angular width
        var dt = 0;
        
        for (var n in this.sortedChildren(r)) {
        	if (n == p) break;
        	dt += this.params(n).width;
        }
        
        var rw = this.params(r).width;
        var pw = this.params(p).width;
        dt = -2*Math.PI * (dt+pw/2)/rw;

        // set angular bounds
        this._theta1 = dt + Math.atan2(p.y-r.y, p.x-r.x);
        this._theta2 = this._theta1 + 2*Math.PI;
        this._prevRoot = r;     
    }
    
	RadialLayout.prototype.calcAngularWidth = function(n, d) {
        if (d > this._maxDepth) this._maxDepth = d;       
        var aw = 0;
        var diameter = 0;
        if (this._useNodeSize && d > 0) {
        	//diameter = 1;
        	diameter = n.getExpanded() && n.getChildDegree() > 0 ? 0 : n.size;
        } else if (d > 0) {
        	var w = n.width;
        	var h = n.height;
        	diameter = Math.sqrt(w*w+h*h)/d;
        	if (isNaN(diameter)) diameter = 0;
        }

        if (n.getExpanded() && n.getChildDegree() > 0) {
        	for (var c=n.getFirstChildNode(); c!=null; c=c.getNextNode())
        	{
        		aw += this.calcAngularWidth(c, d+1);
        	}
        	aw = Math.max(diameter, aw);
        } else {
        	aw = diameter;
        }
		this.params(n).width = aw;
        return aw;
    }
    
 	RadialLayout.prototype.normalize = function(angle) {
        while (angle > 2*Math.PI)
            angle -= 2*Math.PI;
        while (angle < 0)
            angle += 2*Math.PI;
        return angle;
    }
    
 	RadialLayout.prototype.sortedChildren = function(n) {
		var cc = n.getChildDegree();
		var arr = new Arrays;
		if (cc == 0) return arr.EMPTY;
		var angles = new Array(cc);
        
        if (this._sortAngles) {
        	// update base angle for node ordering			
			var base = -this._theta1;
			var p = n.getParentNode();
        	if (p != null) base = this.normalize(Math.atan2(p.y-n.y, n.x-p.x));
        	
        	// collect the angles
        	var c = n.getFirstChildNode();
	        for (var i=0; i<cc; ++i, c=c.getNextNode()) {
	        	angles[i] = this.normalize(-base + Math.atan2(c.y-n.y,n.x-c.x));
	        }
	        // get array of indices, sorted by angle
	        angles = angles.sort();//Array.NUMERIC | Array.RETURNINDEXEDARRAY);
	        // switch in the actual nodes and return
	        for (i=0; i<cc; ++i) {
	        	angles[i] = n.getChildNode(i);
	        }
	    } else {
	    	for (i=0; i<cc; ++i) {
	        	angles[i] = n.getChildNode(i);
	        }
	    }
        
        return angles;
    }
    
	RadialLayout.prototype.doLayout = function( n, r, theta1, theta2) {
    	var dtheta = theta2 - theta1;
    	var dtheta2 = dtheta / 2.0;
    	var width = this.params(n).width;
    	var cfrac;
    	var nfrac = 0;
        
        var children = this.sortedChildren(n);
        for (var i = 0; i < children.length; i++) {
        	var c = children[i];
        	var cp = this.params(c);
            cfrac = cp.width / width;
            if (c.getExpanded() && c.getChildDegree() > 0)
            {
                this.doLayout(c, r+this._radiusInc, theta1 + nfrac*dtheta, 
                                          theta1 + (nfrac+cfrac)*dtheta);
            }
            else if (c.getChildDegree() > 0)
            {
            	var cr = r + this._radiusInc;
            	var ca = theta1 + nfrac*dtheta + cfrac*dtheta2;
            	
            	c.visitTreeDepthFirst(function(n) {
            		n.origin = this._anchor;
            		this.update(n, cr, this.minAngle(n.angle, ca), 0, false);
            	});
            }
            
            c.origin = this._anchor;
            var a = this.minAngle(c.angle, theta1 + nfrac*dtheta + cfrac*dtheta2);
            cp.angle = cfrac * dtheta;
            this.update(c, r, a, cp.angle, true);
            nfrac += cfrac;
        }
    }
    
    RadialLayout.prototype.minAngle = function(a1, a2) {
		var inc = 2*Math.PI*(a1 > a2 ? 1 : -1);
		for (; Math.abs(a1-a2) > Math.PI; a2 += inc){}
		return a2;
	}
	    
	RadialLayout.prototype.update = function(n, r, a, aw, v) {
		var o = n;
		alpha = v ? 1 : 0;
		o.radius = r;
		o.angle = a;
		
		if (aw == 0) {
			o.h = o.v = r - this._radiusInc/2;
		} else {
			o.h = r + this._radiusInc/2;
			o.v = r - this._radiusInc/2;
		}
		o.w = aw;
		o.u = a - aw/2;
		o.alpha = alpha;
		o.mouseEnabled = v;
		if (n.parentEdge != null)
			n.getParentEdge().alpha = alpha;
	}
	
	RadialLayout.prototype.params = function(n)
	{
		var p = n.params;
		if (p == null) {
			p = new RTLParams();
			n.params = p;
		}
		return p;
	}
		    
    RTLParams = function() {
	    this.angle = 0;
	    this.width = 0;
	    this.test = 0;
	    
    };
    
	// register the layout
	$.cytoscapeweb(
		"layout", // we're registering a layout
		"radial", // the layout name
		RadialLayout // the layout prototype
	);
		
})(jQuery, jQuery.cytoscapeweb);
