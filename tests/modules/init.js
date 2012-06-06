$v(function(jQuery, $, version){
	// Test invalid init options module
	////////////////////////////////////////////////////////////////////////////////////////////
	
	module("Initialisation", {
		setup: function(){},
		teardown: function(){}
	});
	
	asyncTest("Two nodes, same ID", function(){

		try {
			$("#cytoscape").cytoscape({
				renderer: {
					name: "null"
				},
				layout: {
					name: "null"
				},
				elements: {
					nodes: [
					    { data: { id: "n1", foo: "one" } },
					    { data: { id: "n2", foo: "two" } },
				    	{ data: { id: "n1", foo: "what is this guy doing here" } }
					]
				}, 
				ready: function(cy){
					window.cy = cy;
					ok(false, "Didn't get exception");
					
					start();
				}
			});

		} catch(e) {
			ok(true, "Got exception");
			start();
		}

	});
	
	asyncTest("Edge specifies two bad IDs (no nodes)", function(){

		try {
			$("#cytoscape").cy({
				renderer: {
					name: "null"
				},
				layout: {
					name: "null"
				},
				elements: {
					edges: [ { data: { source: "n1", target: "n2" } } ]
				},
				ready: function(cy){
					ok( false, "Didn't get exception" );
					
					start();
				}
			});
		} catch(e) {
			ok( true, "Got exception" );
			start();
		}
		
		
	});
	
	asyncTest("Edge specifies one bad ID", function(){
		try {
			$("#cytoscape").cy({
				renderer: {
					name: "null"
				},
				layout: {
					name: "null"
				},
				elements: {
					nodes: [ { data: { id: "n1" } } ],
					edges: [ { data: { source: "n1", target: "n2" } } ]
				},
				ready: function(cy){
					ok( cy.edges().size() == 0, "There are no edges" );
					ok( cy.nodes().size() == 1, "The node is still there" );
					
					start();
				}
			});
		} catch(e) {
			ok( true, "Got exception" );
			start();
		}
	});
	
	asyncTest("Edge specifies good IDs", function(){
		$("#cytoscape").cytoscape({
			renderer: {
				name: "null"
			},
			layout: {
				name: "null"
			},
			elements: {
				nodes: [ { data: { id: "n1" } }, { data: { id: "n2" } } ],
				edges: [ { data: { source: "n1", target: "n2" } } ]
			},
			ready: function(cy){
				ok( cy.edges().size() == 1, "The edge exists" );
				ok( cy.nodes().size() == 2, "The nodes are still there" );
				
				start();
			}
		});
		
	});

	asyncTest("Node has self as parent", function(){

		try {
			$("#cytoscape").cy({
				renderer: {
					name: "null"
				},
				layout: {
					name: "null"
				},
				elements: {
					nodes: [ { data: { id: "n1", parent: "n1" } } ]
				},
				ready: function(cy){
					ok(false, "Didn't get exception");
					
					start();
				}
			});
		} catch(e) {
			ok( true, "Got exception" );
			start();
		}
	});

	asyncTest("Two nodes have a parent cycle", function(){

		try {
			$("#cytoscape").cy({
				renderer: {
					name: "null"
				},
				layout: {
					name: "null"
				},
				elements: {
					nodes: [
						{ data: { id: "n1", parent: "n2" } },
						{ data: { id: "n2", parent: "n1" } }
					]
				},
				ready: function(cy){
					ok(false, "Didn't get exception");
					
					start();
				}
			});
		} catch(e) {
			ok( true, "Got exception" );
			start();
		}
	});
	
});