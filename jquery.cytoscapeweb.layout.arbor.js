$(function(){
	
	var defaults = {
		ready: undefined,
		maxSimulationTime: 1000,
		fit: true,
		padding: [ 50, 50, 50, 50 ],
		ungrabifyWhileSimulating: true,
		repulsion: undefined,
		stiffness: undefined,
		friction: undefined,
		gravity: undefined,
		fps: 30,
		dt: undefined,
		precision: undefined,
		nodeMass: undefined,
		edgeLength: undefined
	};
	
	function ForceDirectedLayout(){
		$.cytoscapeweb("debug", "Creating force-directed layout");
	}
	
	function exec(fn){
		if( fn != null && typeof fn == typeof function(){} ){
			fn();
		}
	}
	
	ForceDirectedLayout.prototype.run = function(params){
		var options = $.extend(true, {}, defaults, params);
		$.cytoscapeweb("debug", "Running force-directed layout with options (%o)", options);
		
		var cy = options.cy;
		var nodes = cy.nodes();
		var edges = cy.edges();
		var container = cy.container();
		
		var sys = window.sys = arbor.ParticleSystem(options.repulsion, options.stiffness, options.friction, options.gravity, options.fps, options.dt, options.precision);
		
		if( options.fit ){
			cy.reset();
		};
		
		var framesToDoneCheck = 3;
		var doneTime = framesToDoneCheck * 1000/options.fps;
		var doneTimeout;
		
		var ready = false;
		
		var sysRenderer = {
			init: function(system){
			},
			redraw: function(){
				clearTimeout(doneTimeout);
				doneTimeout = setTimeout(doneHandler, doneTime);
				
				var movedNodes = cy.collection();
				
				sys.eachNode(function(n, point){ 
					var id = n.name;
					var data = n.data;
					var node = data.element;
					
					if( node == null ){
						return;
					}
					var pos = node._private.position;
					
					if( !node.locked() && !node.grabbed() ){
						pos.x = point.x;
						pos.y = point.y;
						
						movedNodes = movedNodes.add(node);
					}
				});
				
				if( movedNodes.size() > 0 ){
					movedNodes.rtrigger("position");
				}
				
				if( !ready ){
					ready = true;
					cy.trigger("layoutready");
					exec( params.ready );
				}
			}
			
		};
		sys.renderer = sysRenderer;
		
		var width = container.width();
		var height = container.height();
		
		sys.screenSize( width, height );
		sys.screenPadding( options.padding[0], options.padding[1], options.padding[2], options.padding[3] );
		
		function calculateValueForElement(element, value){
			if( value == null ){
				return undefined;
			} else if( typeof value == typeof function(){} ){
				return value.apply(element, [element.data()]); 
			} else {
				return value;
			}
		}
		
		// TODO we're using a hack; sys.toScreen should work :(
		function fromScreen(pos){
			var x = pos.x;
			var y = pos.y;
			var w = width;
			var h = height;
			
			var left = -2;
			var right = 2;
			var top = -2;
			var bottom = 2;
			
			var d = 4;
			
			return {
				x: x/w * d + left,
				y: y/h * d + right
			};
		}
		
		var grabHandler = function(e){
			grabbed = this;
			var pos = sys.fromScreen(this._private.position);
			var p = arbor.Point(pos.x, pos.y);
			this._private.arbor.p = p;
			
			switch( e.type ){
			case "grab":
				this._private.arbor.fixed = true;
				break;
			case "dragstop":
				this._private.arbor.fixed = false;
				this._private.arbor.tempMass = 1000
				break;
			}
		};
		nodes.bind("grab drag dragstop", grabHandler);
			  	
		nodes.each(function(i, node){
			var id = this._private.data.id;
			var mass = calculateValueForElement(this, options.nodeMass);
			var locked = this._private.locked;
			
			var pos = fromScreen({
				x: node._private.position.x,
				y: node._private.position.y
			});

			this._private.arbor = sys.addNode(id, {
				element: this,
				mass: mass,
				fixed: locked,
				x: locked ? pos.x : undefined,
				y: locked ? pos.y : undefined
			});
		});
		
		edges.each(function(){
			var id = this._private.data.id;
			var src = this.source()._private.data.id;
			var tgt = this.target()._private.data.id;
			var length = calculateValueForElement(this, options.edgeLength);
			
			this._private.arbor = sys.addEdge(src, tgt, {
				length: length
			});
		});
		
		function packToCenter(callback){
			// TODO implement this for IE :(
			
			cy.fit();
			callback();
		};
		
		var grabbableNodes = nodes.filter(":grabbable");
		// disable grabbing if so set
		if( options.ungrabifyWhileSimulating ){
			grabbableNodes.ungrabify();
		}
		
		var doneHandler = function(){
			if( $.browser.msie ){
				packToCenter(function(){
					done();
				});
			} else {
				done();
			}
			
			function done(){
				// unbind handlers
				nodes.unbind("grab drag dragstop", grabHandler);
				
				// enable back grabbing if so set
				if( options.ungrabifyWhileSimulating ){
					grabbableNodes.grabify();
				}
				
				cy.trigger("layoutstop");
				exec( params.stop );
			}
		};
		
		sys.start();
		setTimeout(function(){
			sys.stop();
		}, options.maxSimulationTime);
	};
	
	$.cytoscapeweb("layout", "arbor", ForceDirectedLayout);
	
	
});