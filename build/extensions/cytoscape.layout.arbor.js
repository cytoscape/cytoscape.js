
/* cytoscape.layout.arbor.js */

/**
 * This file is part of cytoscape.js 2.0.2.
 * 
 * Cytoscape.js is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option) any
 * later version.
 * 
 * Cytoscape.js is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU Lesser General Public License along with
 * cytoscape.js. If not, see <http://www.gnu.org/licenses/>.
 */
 
;(function($$){
	
	var defaults = {
		liveUpdate: true, // whether to show the layout as it's running
		ready: undefined, // callback on layoutready 
		stop: undefined, // callback on layoutstop
		maxSimulationTime: 4000, // max length in ms to run the layout
		fit: true, // fit to viewport
		padding: [ 50, 50, 50, 50 ], // top, right, bottom, left
		ungrabifyWhileSimulating: true, // so you can't drag nodes during layout

		// forces used by arbor (use arbor default on undefined)
		repulsion: undefined,
		stiffness: undefined,
		friction: undefined,
		gravity: true,
		fps: undefined,
		precision: undefined,

		// static numbers or functions that dynamically return what these
		// values should be for each element
		nodeMass: undefined, 
		edgeLength: undefined,

		stepSize: 1, // size of timestep in simulation

		// function that returns true if the system is stable to indicate
		// that the layout can be stopped
		stableEnergy: function( energy ){
			var e = energy; 
			return (e.max <= 0.5) || (e.mean <= 0.3);
		}
	};
	
	function ArborLayout(options){
		this.options = $$.util.extend({}, defaults, options);
	}
		
	ArborLayout.prototype.run = function(){
		var options = this.options;
		var cy = options.cy;
		var nodes = cy.nodes();
		var edges = cy.edges();
		var container = cy.container();
		var width = container.clientWidth;
		var height = container.clientHeight;

		// arbor doesn't work with just 1 node
		if( cy.nodes().size() <= 1 ){
			if( options.fit ){
				cy.reset();
			}

			cy.nodes().position({
				x: Math.round( width/2 ),
				y: Math.round( height/2 )
			});

			cy.one("layoutstop", options.stop);
			cy.trigger("layoutstop");

			cy.one("layoutstop", options.stop);
			cy.trigger("layoutstop");

			return;
		}

		var sys = this.system = arbor.ParticleSystem(options.repulsion, options.stiffness, options.friction, options.gravity, options.fps, options.dt, options.precision);
		this.system = sys;

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
				if( options.stableEnergy != null && energy != null && energy.n > 0 && options.stableEnergy(energy) ){
					sys.stop();
					return;
				}

				clearTimeout(doneTimeout);
				doneTimeout = setTimeout(doneHandler, doneTime);
				
				var movedNodes = [];
				
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
						
						movedNodes.push( node );
					}
				});
				

				var timeToDraw = (+new Date - lastDraw) >= 16;
				if( options.liveUpdate && movedNodes.length > 0 && timeToDraw ){
					new $$.Collection(cy, movedNodes).rtrigger("position");
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
		sys.screenSize( width, height );
		sys.screenPadding( options.padding[0], options.padding[1], options.padding[2], options.padding[3] );
		sys.screenStep( options.stepSize );

		function calculateValueForElement(element, value){
			if( value == null ){
				return undefined;
			} else if( typeof value == typeof function(){} ){
				return value.apply(element, [element._private.data, {
					nodes: nodes.length,
					edges: edges.length,
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

			if( node.locked() ){
				return;
			}

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
			if( window.isIE ){
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
	
	
})(cytoscape);
