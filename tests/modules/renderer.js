$v(function(jQuery, $, version){
	
	// Renderer tests
	////////////////////////////////////////////////////////////////////////////////////////////
	
	var notifications = [];
	
	var Renderer = function(){};
	Renderer.prototype.notify = function(params){
		notifications.push(params);
	};
	
	// register the dummy renderer
	cytoscape("renderer", "test", Renderer);
	
	function same(){
		var args = arguments;
		
		for(var i = 0; i < args.length; i++){
			var arg = args[i];
			var params = arg;
			
			deepEqual(notifications[i], params, "Expected %ith notification");
		}
	}
	
	// assume number 1
	function verify(theType, fnName, args){
		clear();

		var nodes = cy.nodes();
		var theSize = nodes.size();
		
		nodes[fnName].apply(nodes, args);
		
		equal(notifications.length, 1, "Number of notifications for `" + fnName + "` with args [ " + args + " ]");
		
		if( notifications.length == 0 ){
			return;
		}
		
		equal(notifications[0].type, theType, "Type of notification for `" + fnName + "` with args [ " + args + " ]");
		equal(notifications[0].collection.size(), theSize, "Number of elements for `" + fnName + "` with args [ " + args + " ]");
	}
	
	function clear(){
		notifications = [];
	}
	
	module("Renderer", {
		setup: function(){
			stop();
			
			$("#cytoscape").cytoscape({
				renderer: {
					name: "test"
				},
				layout: {
					name: "null"
				},
				elements: {
					nodes: [
					    { data: { id: "n1", foo: "one", weight: 0.25 }, classes: "odd one" },
				    	{ data: { id: "n2", foo: "two", weight: 0.5 }, classes: "even two" },
				    	{ data: { id: "n3", foo: "three", weight: 0.75 }, classes: "odd three" }
					],
					
					edges: [
					    { data: { id: "n1n2", source: "n1", target: "n2", weight: 0.33 }, classes: "uh" },
				    	{ data: { id: "n2n3", source: "n2", target: "n3", weight: 0.66 }, classes: "huh" }
					]
				},
				ready: function(cy){
					window.cy = cy;
					clear();
					start();
				}
			});
			
		},
		
		teardown: function(){
		}
	});
		
});