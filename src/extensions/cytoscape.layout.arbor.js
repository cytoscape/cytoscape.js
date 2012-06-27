;(function($, $$){
	
	var defaults = {
		liveUpdate: true,
		ready: undefined,
		maxSimulationTime: 4000,
		fit: true,
		padding: [ 50, 50, 50, 50 ],
		ungrabifyWhileSimulating: true,
		repulsion: undefined,
		stiffness: undefined,
		friction: undefined,
		gravity: true,
		fps: undefined,
		precision: undefined,
		nodeMass: undefined,
		edgeLength: undefined,
		stepSize: 1,
		stableEnergy: function( energy ){
			var e = energy; 
			return (e.max <= 7) || (e.mean <= 5);
		}
	};
	
	function ArborLayout(options){
		this.options = $.extend(true, {}, defaults, options);
	}
		
	ArborLayout.prototype.run = function(){
		var options = this.options;
		var cy = options.cy;
		var nodes = cy.nodes();
		var edges = cy.edges();
		var $container = cy.container();
		
		// arbor doesn't work with just 1 node
		if( cy.nodes().size() <= 1 ){
			if( options.fit ){
				cy.reset();
			}

			cy.nodes().position({
				x: $container.width()/2,
				y: $container.height()/2
			});

			cy.one("layoutstop", options.stop);
			cy.trigger("layoutstop");

			cy.one("layoutstop", options.stop);
			cy.trigger("layoutstop");

			return;
		}

		var sys = this.system = arbor.ParticleSystem(options.repulsion, options.stiffness, options.friction, options.gravity, options.fps, options.dt, options.precision);
		
		if( options.liveUpdate && options.fit ){
			cy.reset();
		};
		
		var doneTime = 250;
		var doneTimeout;
		
		var ready = false;
		
		var lastDraw = +new Date;
		var sysRenderer = {
			init: function(system){
			},
			redraw: function(){
				var energy = sys.energy();

				// if we're stable (according to the client), we're done
				if( options.stableEnergy != null && energy != null && options.stableEnergy(energy) ){
					sys.stop();
					return;
				}

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
					var pos = node.position();
					
					if( !node.locked() && !node.grabbed() ){
						pos.x = point.x;
						pos.y = point.y;
						
						movedNodes = movedNodes.add(node);
					}
				});
				

				var timeToDraw = (+new Date - lastDraw) >= 16;
				if( options.liveUpdate && movedNodes.size() > 0 && timeToDraw ){
					movedNodes.rtrigger("position");
					lastDraw = +new Date;
				}

				
				if( !ready ){
					ready = true;
					cy.one("layoutready", options.ready);
					cy.trigger("layoutready");
				}
			}
			
		};
		sys.renderer = sysRenderer;
		
		var width = $container.width();
		var height = $container.height();
		
		sys.screenSize( width, height );
		sys.screenPadding( options.padding[0], options.padding[1], options.padding[2], options.padding[3] );
		sys.screenStep( options.stepSize );

		function calculateValueForElement(element, value){
			if( value == null ){
				return undefined;
			} else if( typeof value == typeof function(){} ){
				return value.apply(element, [element.data(), {
					nodes: nodes.size(),
					edges: edges.size(),
					element: element
				}]); 
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
			var pos = sys.fromScreen( this.position() );
			var p = arbor.Point(pos.x, pos.y);
			this.scratch().arbor.p = p;
			
			switch( e.type ){
			case "grab":
				this.scratch().arbor.fixed = true;
				break;
			case "dragstop":
				this.scratch().arbor.fixed = false;
				this.scratch().arbor.tempMass = 1000
				break;
			}
		};
		nodes.bind("grab drag dragstop", grabHandler);
			  	
		nodes.each(function(i, node){
			var id = this._private.data.id;
			var mass = calculateValueForElement(this, options.nodeMass);
			var locked = this._private.locked;
			
			var pos = fromScreen({
				x: node.position().x,
				y: node.position().y
			});

			this.scratch().arbor = sys.addNode(id, {
				element: this,
				mass: mass,
				fixed: locked,
				x: locked ? pos.x : undefined,
				y: locked ? pos.y : undefined
			});
		});
		
		edges.each(function(){
			var id = this.id();
			var src = this.source().id();
			var tgt = this.target().id();
			var length = calculateValueForElement(this, options.edgeLength);
			
			this.scratch().arbor = sys.addEdge(src, tgt, {
				length: length
			});
		});
		
		function packToCenter(callback){
			// TODO implement this for IE :(
			
			if( options.fit ){
				cy.fit();
			}
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
				if( !options.liveUpdate ){
					if( options.fit ){
						cy.reset();
					}

					cy.nodes().rtrigger("position");
				}

				// unbind handlers
				nodes.unbind("grab drag dragstop", grabHandler);
				
				// enable back grabbing if so set
				if( options.ungrabifyWhileSimulating ){
					grabbableNodes.grabify();
				}

				cy.one("layoutstop", options.stop);
				cy.trigger("layoutstop");
			}
		};
		
		sys.start();
		setTimeout(function(){
			sys.stop();
		}, options.maxSimulationTime);
		
	};

	ArborLayout.prototype.stop = function(){
		if( this.system != null ){
			system.stop();
		}
	};
	
	$$("layout", "arbor", ArborLayout);
	
	
})(jQuery, jQuery.cytoscape);
