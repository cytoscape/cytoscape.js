;(function($$){
	
	/**
	 * Layout that places items in a circular layout. If the tree option is
	 * selected than the circle is modified to represent a tree.
	 * 
	 * This algorithm is based on Flare's flare.vis.operator.layout.CircleLayout
	 */
	
	var _data;
	var _tree;
        
	var defaults = {
		angleWidth: 2 * Math.PI,
		treeLayout: false
	};
	
	function CircleLayout( options ){
		/** The padding around the circumference of the circle, in pixels. */
		this.padding = 50;
		/** The starting angle for the layout, in radians. */
		this.startAngle = Math.PI / 2;
		/** The angular width of the layout, in radians (default is 2 pi). */
		this.angleWidth = defaults.angleWidth;
		/** Flag indicating if tree structure should inform the layout. */
		this.treeLayout = defaults.treeLayout;

		this._inner = 0;
		this._innerFrac = NaN;
		this._outer = 50;
		this._group;
		this._rField;
		this._aField;
		this._tree;
		this._rBinding = {};
		this._aBinding = {};
		
		this.options = $.extend(true, {}, defaults, options);
	}
	
	function exec(fn){
		if( fn != null && typeof fn == typeof function(){} ){
			fn();
		}
	}
	
	CircleLayout.prototype.run = function(){
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
     
     CircleLayout.prototype.setup = function(){
     	// if (visualization == null) return;
     	
     	if (this._data == null) this._data = this.options.cy; //visualization.data;
        
        if (this.layoutRoot == null) this.layoutRoot = this._data.nodes()[0]; // TODO !layoutRoot == NodeSprite
            
        var a = new DisconnectedTree();
		
		var tb = new DisconnectedTreeBuilder();
		tb.calculate(this.options.cy, a.newNode(this.layoutRoot));
		this._tree = tb.getTree(); //  = DisconnectedTree(tb.tree); TODO ?
		
		this.layoutRoot = this._tree.getRoot();
		
        this._rBinding.data = _tree;
        this._aBinding.data = _tree;
     }
    	
    CircleLayout.prototype.visit = function(visitor, array) {			 
		var a = array; // use our own reference to the list
		var i;
		var n = a.length;
		var b = false;

		for (i=0; i<n; ++i)
			if (visitor(a[i], this)) {
				b = true; break;
			}
		
		return b;
	}
	
     CircleLayout.prototype.layout = function(){
     	var options = this.options;
		var cy = options.cy;
		var nodes = cy.nodes();
		var edges = cy.edges();
		var $container = cy.container(); // the container div for cytoscapeweb
		

		var list = this._tree.nodes;
		
        var i = 0;
        var N = list.length;
        var dr;
        var visitor = null;
        
        if(options != null) { 
			this.angleWidth = options.angleWidth;
			this.treeLayout = options.treeLayout;
		}
		
        // this._rBinding.property = false;
        
        // determine radius
        var b = {}
        b.width = $container.width();
        b.height = $container.height();
        
        this._outer = Math.min(b.width, b.height)/2 - this.padding;
        this._inner = isNaN(this._innerFrac) ? this._inner : this._outer * this._innerFrac;
        
        // set the anchor point
        var anchor = 0; // TODO
        this.visit(function(n) { n.origin = anchor; }, list);
        
        // compute angles
        if (this._aBinding.property) {
            // if angle property, get scale binding and do layout
            this._aBinding.updateBinding();
            this._aField = Property.$(this._aBinding.property);
            visitor = function(n, layout) {
                var f = layout._aBinding.interpolate(layout._aField.getValue(n));
                n.angle = layout.minAngle(n.angle, 
                                         layout.startAngle - f*layout.angleWidth);
            };
        } else if (this.treeLayout) {
            // if tree mode, use tree order
            this.setTreeAngles();
        } else {
            // if nothing use total sort order
            i = 0;
            visitor = function(n, layout) {
                n.angle = layout.minAngle(n.angle, layout.startAngle - (i/N)*layout.angleWidth);
                i++;
            };
        }
        if (visitor != null) this.visit(visitor, list);
        
        // compute radii
        visitor = null;
        if (this._rBinding.property) {
            // if radius property, get scale binding and do layout
            _rBinding.updateBinding();
            _rField = Property.$(_rBinding.property);
            dr = _outer - _inner;
            visitor = function(n) {
                var f = _rBinding.interpolate(_rField.getValue(n));
                _t.$(n).radius = _inner + f * dr;
            };
        } else if (this.treeLayout) {
            // if tree-mode, use tree depth
            this.setTreeRadii();
        } else {
            // if nothing, use outer radius
            var outer = this._outer;
            visitor = function(n) {
                n.radius = outer;
            };
        }
        if (visitor != null) this.visit(visitor, list);
        if (this.treeLayout) {
            // Modified here to accept another root:
            // if (this.layoutRoot == null) this.layoutRoot = _data.tree.root;
            this.layoutRoot.radius = 0;
        }
        
        // finish up
        // updateEdgePoints(_t);
        

		var listsize = list.length;
		var b = false;
		var anchorX = $container.width() / 2;
		var anchorY = $container.height() / 2;

		for (i=0; i<listsize; ++i)
		{
			var element = list[i];
		    element.setX( anchorX + element.radius * Math.cos(element.angle));
            element.setY( anchorY +element.radius * Math.sin(element.angle));
		}
			
 
     }
    
     CircleLayout.prototype.setTreeAngles = function(){
	     // first pass, determine the angular spacing
        var root = this.layoutRoot;
        var p = null;
        var leafCount = 0;
        var parentCount = 0;
        
        root.visitTreeDepthFirst(function(n) {
            if (n.getChildDegree() == 0) {
                if (p != n.getParentNode()) {
                    p = n.getParentNode();
                    ++parentCount;
                }
                ++leafCount;
            }
        });
        var inc = (-this.angleWidth) / (leafCount + parentCount);
        var angle = this.startAngle;
        
        NodeSprite.prototype.incCL = inc;
        NodeSprite.prototype.angleCL = angle;
        
        // second pass, set the angles
        root.visitTreeDepthFirst(function(n) {
            var a = 0;
            var b;
            if (n.getChildDegree() == 0) {
                if (p != n.getParentNode()) {
                    p = n.getParentNode();
                    angle += inc;
                }
                a = angle;
                angle+= inc;
            } else if (n.getParentNode() != null) {
                a = n.getFirstChildNode().angle;
                b = n.getLastChildNode().angle - a;
                while (b >  Math.PI) b -= 2*Math.PI;
                while (b < -Math.PI) b += 2*Math.PI;
                a += b / 2;
            }
            var a1 = n.angle;
            var a2 = a;
            var inc2= 2*Math.PI*(a1 > a2 ? 1 : -1);
			for (; Math.abs(a1-a2) > Math.PI; a2 += inc2){}
			n.angle = a2;
        });
     }
    
    CircleLayout.prototype.setTreeRadii = function(){ 
        var n;
        var depth = 0;
        var dr = this._outer - this._inner;
        var nodes = this._tree.nodes;
        
        var length = nodes.length;
        for (var i = 0; i < length; i++) {
        	n = nodes[i]; 
            if (n.getChildDegree() == 0) {
                depth = Math.max(n.getDepth(), depth);
                n.radius = this._outer;
            }
        }
        for (var i = 0; i < length; i++) {
        	n = nodes[i];
            if (n.getChildDegree() != 0) {
                n.radius = this._inner + (n.getDepth()/depth) * dr;
            }
        }
        
        n = this.layoutRoot;
        
        /*if (!_t.immediate) {
            delete _t._(n).values.radius;
            delete _t._(n).values.angle;
        }*/
       
        n.setX( n.origin.x);
        n.setY( n.origin.y);
    }
    
    CircleLayout.prototype.minAngle = function(a1, a2)
	{
		var inc= 2*Math.PI*(a1 > a2 ? 1 : -1);
		for (; Math.abs(a1-a2) > Math.PI; a2 += inc){}
		return a2;
	}
	
	CircleLayout.prototype.updateEdgePoints = function(t)
	{
		if (t==null || t.immediate || layoutType==POLAR) {
			clearEdgePoints();
		} else {
			_clear = false;
			straightenEdges(visualization.data.edges, t);
			// after transition, clear out control points
			if (_clear) {
				var f = function(evt) {
					clearEdgePoints();
					t.removeEventListener(TransitionEvent.END, f);
				};
				t.addEventListener(TransitionEvent.END, f);
			}
		}
	}
	
	/* Finds the min angle*/
	CircleLayout.prototype.minAngle = function(a1, a2)
	{
		var inc = 2*Math.PI*(a1 > a2 ? 1 : -1);
		for (; Math.abs(a1-a2) > Math.PI; a2 += inc){}
		return a2;
	}

	// register the layout
	cytoscape(
		"layout", // we're registering a layout
		"circle", // the layout name
		CircleLayout // the layout prototype
	);
		
})(cytoscape);
