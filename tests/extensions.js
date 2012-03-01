$(function(){
	
	module("Extensions", {
		setup: function(){
		},
		
		teardown: function(){
			
		}
	});
	
	function init( callback ){
		$("#cytoscapeweb").cytoscapeweb({
			renderer: {
				name: "null"
			},
			layout: {
				name: "null"
			},
			elements: {
				nodes: [{}, {}]
			},
			ready: function(cy){
				window.cy = cy;
				
				callback();
				start();
			}
		});
	}
	
	asyncTest("Add a core function", function(){
		$.cytoscapeweb("core", "foo", function(){
			return 1;
		});
		
		$.cytoscapeweb("core", "bar", function(){
			return this;
		});
		
		init(function(){
			equal( cy.foo(), 1, "cy.foo() returns correctly" );
			strictEqual( cy.bar(), cy, "cy.bar() returns cy" );
		});
	});
	
	asyncTest("Add a collection function", function(){
		$.cytoscapeweb("collection", "oddSize", function(){
			return !this.evenSize();
		});
		
		$.cytoscapeweb("collection", "evenSize", function(){
			return this.size() % 2 == 0;
		});
		
		$.cytoscapeweb("collection", "self", function(){
			return this;
		});
		
		init(function(){
			equal( cy.nodes().size(), 2, "there are 2 nodes" );
			ok( cy.nodes().evenSize(), true, "two nodes are even" );
			ok( cy.nodes()[0].element().oddSize(), true, "one node (element) is odd" );
			ok( cy.nodes()[0].collection().oddSize(), true, "one node (collection) is odd" );
		});
	});
	
});