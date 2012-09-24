$v(function(jQuery, $, version){

	// Test aliases
	////////////////////////////////////////////////////////////////////////////////////////////
	
	module("Aliases", {
		setup: function(){
		},
		
		teardown: function(){
		}
	});
	
	asyncTest("Test short `cy` notation", function(){
		$("#cytoscape").cy({
			renderer: {
				name: "null"
			},
			layout: {
				name: "null"
			},
			elements: {
				nodes: [
				    { data: { foo: "the node" } }
				]
			},
			ready: function(){
				cy = this;
				
				ok( cy != null, "Not null object" );
				ok( cy.nodes().size() == 1, "Node is there" );
				equal( cy.nodes().eq(0).data("foo"), "the node", "Data attribute is there" );
				
				start();
			}
		});
	});
	
	asyncTest("Test jQuery selector style", function(){
		$("#cytoscape").cy({
			renderer: {
				name: "null"
			},
			layout: {
				name: "null"
			},
			elements: {
				nodes: [
				    { data : { foo: "the node" } }
				]
			},
			ready: function(){
				cy = this;

				ok( cy != null, "Not null object" );
				ok( cy.nodes().size() == 1, "Node is there" );

				// this doesn't work for some reason, we don't really need it; let's keep the feature undocumented for now
				//ok( $("#cytoscape").cy("nodes").size() == 1, "Node is there via jQuery style" );
				
				start();
			}
		});
	});

	asyncTest("Test plain w/o jQuery style", function(){
		var container = document.getElementById("cytoscape");

		cytoscape({
			container: container,
			renderer: {
				name: "null"
			},
			layout: {
				name: "null"
			},
			elements: {
				nodes: [
				    { data : { foo: "the node" } }
				]
			},
			ready: function(){
				cy = this;

				ok( cy != null, "Not null object" );
				ok( cy.nodes().size() == 1, "Node is there" );
				
				start();
			}
		});

	});

	asyncTest("Test plain w/o jQuery style & no container", function(){
		cytoscape({
			renderer: {
				name: "null"
			},
			layout: {
				name: "null"
			},
			elements: {
				nodes: [
				    { data : { foo: "the node" } }
				]
			},
			ready: function(){
				cy = this;

				ok( cy != null, "Not null object" );
				ok( cy.nodes().size() == 1, "Node is there" );
				
				start();
			}
		});

	});
	
});