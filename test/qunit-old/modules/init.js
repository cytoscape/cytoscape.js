$v(function(jQuery, $, version){
	// Test invalid init options module
	////////////////////////////////////////////////////////////////////////////////////////////
	
	module("Initialisation", {
		setup: function(){},
		teardown: function(){}
	});
	
	asyncTest("Two nodes, same ID", function(){

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
				ready: function(){
					window.cy = this;
					
					equal( cy.elements().size(), 2, "3rd node not added" );
					equal( cy.$("#n1").data("foo"), "one", "3rd node doesn't override 1st" );
					
					start();
				}
			});

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
				ready: function(){
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
				ready: function(){
					window.cy = this;

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
			ready: function(){
				window.cy = this;

				ok( cy.edges().size() == 1, "The edge exists" );
				ok( cy.nodes().size() == 2, "The nodes are still there" );
				
				start();
			}
		});
		
	});

	asyncTest("Node has self as parent", function(){

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
			ready: function(){
				window.cy = this;

				equal( cy.$("#n1").parent().size(), 0, "n1 doesn't have parent" );
				
				start();
			}
		});
	});

	asyncTest("Two nodes have a parent cycle", function(){

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
			ready: function(){
				window.cy = this;

				ok( cy.$("#n1").parent().parent().length === 0, "there is no cycle between n1 and n2" );
				start();
			}
		});
	});
	
});