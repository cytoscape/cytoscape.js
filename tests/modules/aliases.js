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
			ready: function(cy){
				console.log("tests");
				console.log(cy);
				
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
			ready: function(cy){
				ok( cy != null, "Not null object" );
				ok( cy.nodes().size() == 1, "Node is there" );
				ok( $("#cytoscape").cy("nodes").size() == 1, "Node is there via jQuery style" );
				
				start();
			}
		});
	});
	
});