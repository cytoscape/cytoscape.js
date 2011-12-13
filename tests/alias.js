$(function(){

	// Test aliases
	////////////////////////////////////////////////////////////////////////////////////////////
	
	module("Test aliases", {
		setup: function(){
		},
		
		teardown: function(){
		}
	});
	
	asyncTest("Test short `cy` notation", function(){
		$("#cytoscapeweb").cy({
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
				ok( cy != null, "Not null object" );
				ok( cy.nodes().size() == 1, "Node is there" );
				equal( cy.nodes().eq(0).data("foo"), "the node", "Data attribute is there" );
				
				start();
			}
		});
	});
	
	asyncTest("Test jQuery selector style", function(){
		$("#cytoscapeweb").cy({
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
				ok( $("#cytoscapeweb").cy("nodes").size() == 1, "Node is there via jQuery style" );
				
				start();
			}
		});
	
	});
	
});