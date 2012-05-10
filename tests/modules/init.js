$v(function(jQuery, $, version){
	// Test invalid init options module
	////////////////////////////////////////////////////////////////////////////////////////////
	
	module("Initialisation", {
		setup: function(){},
		teardown: function(){}
	});
	
	asyncTest("Two nodes, same ID", function(){
		$("#cytoscapeweb").cytoscapeweb({
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
				equal( cy.nodes().size(), 2, "Number of nodes" );
				equal( cy.nodes("#n1").size(), 1, "Instances of node `n1`" );
				ok( cy.nodes("#n2") != null, "Node `n2` is there" );
				
				start();
			}
		});

	});
	
	asyncTest("Edge specifies two bad IDs (no nodes)", function(){
		$("#cytoscapeweb").cy({
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
				ok( cy.elements().size() == 0, "There are no elements" );
				
				start();
			}
		});
		
		
	});
	
	asyncTest("Edge specifies one bad ID", function(){
		$("#cytoscapeweb").cy({
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
	});
	
	asyncTest("Edge specifies good IDs", function(){
		$("#cytoscapeweb").cytoscapeweb({
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
		$("#cytoscapeweb").cy({
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
				ok( cy.nodes().size() == 1, "The node is still there" );
				ok( cy.nodes().eq(0).parent().empty(), "The node has no parent" );
				
				start();
			}
		});
	});

	asyncTest("Two nodes have a parent cycle", function(){
		$("#cytoscapeweb").cy({
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
				ok( cy.nodes().size() == 2, "The nodes are still there" );
				ok( cy.nodes().eq(0).parent().empty(), "The nodes have no parents" );
				
				start();
			}
		});
	});
	
});