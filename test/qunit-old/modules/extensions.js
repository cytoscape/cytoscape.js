$v(function(jQuery, $, version){
	
	module("Extensions", {
		setup: function(){
		},
		
		teardown: function(){
			
		}
	});
	
	function init( callback ){
		$("#cytoscape").cytoscape({
			renderer: {
				name: "null"
			},
			layout: {
				name: "null"
			},
			elements: {
				nodes: [{}, {}]
			},
			ready: function(){
				window.cy = this;
				
				callback();
				start();
			}
		});
	}
	
	asyncTest("Add a core function", function(){
		$.cytoscape("core", "foo", function(){
			return 1;
		});
		
		$.cytoscape("core", "bar", function(){
			return this;
		});
		
		init(function(){
			equal( cy.foo(), 1, "cy.foo() returns correctly" );
			strictEqual( cy.bar(), cy, "cy.bar() returns cy" );
		});
	});
	
	
	asyncTest("Add a collection function", function(){
		$.cytoscape("collection", "oddSize", function(){
			return !this.evenSize();
		});
		
		$.cytoscape("collection", "evenSize", function(){
			return this.size() % 2 == 0;
		});
		
		$.cytoscape("collection", "self", function(){
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