$(function(){
	
	function fail(msg){
		ok(false, msg);
	}
	
	window.cy = null;

	cy = $.cytoscapeweb({
		selector: "#cytoscapeweb",
		renderer: {
			name: "null"
		},
		layout: {
			name: "null"
		},
		data: {
			nodes: [
			    { foo: "one" },
			    { foo: "two" },
			    { foo: "three" }
			]
		}
	});
	
	module("Null renderer", {
		setup: function(){
			cy = $.cytoscapeweb({
				selector: "#cytoscapeweb",
				renderer: {
					name: "null"
				},
				layout: {
					name: "null"
				},
				data: {
					nodes: [
					    { foo: "one" },
					    { foo: "two" },
					    { foo: "three" }
					]
				}
			});
		},
		
		teardown: function(){
		}
	});
	
	test("Verify all nodes are there", function(){
		ok( cy.nodes().size() == 3, "There are 3 nodes" );
	});
	
	test("Verify the data for the nodes is there", function(){
		
		var expectedValues = { "one": false, "two": false, "three": false };
		
		cy.nodes().each(function(i, node){
			var val = node.data("foo");
			expectedValues[ val ] = true;
		});
		
		$.each(expectedValues, function(val, found){
			ok( found, "Found value `" + val + "`" );
		});
	});
	
	test("Get a node with the filter function", function(){
		
		equal( cy.nodes().filter(function(i, node){
			if( node.data("foo") == "one" ){
				return true;
			}
		}).size(), 1, "Expected number of matching nodes");
		
	});
	
	test("Get a node with the cy.nodes function using a filter function", function(){
		
		equal( cy.nodes(function(node){
			if( node.data("foo") == "one" ){
				return true;
			}
		}).size(), 1, "Expected number of matching nodes");
		
	});

	test("Filter with this reference for node", function(){
		
		ok( cy.nodes(function(){ return this.data("foo") == "one"; }).size() == 1, "cy.nodes works" );
		
		ok( cy.nodes().filter(function(){ return this.data("foo") == "one"; }).size() == 1, "node.filter works" );
		
	});
	
	test("Remove a node", function(){
		
		var removedNode = cy.nodes(function(node){
			return node.data("foo") == "one";
		}).remove().eq(0);
		
		equal( cy.nodes().size(), 2, "Expected number of nodes" );
		
		var expected = [ "three", "two" ];
		var vals = [];
		
		cy.nodes().each(function(i, node){
			vals.push( node.data("foo") );
		});
		vals.sort();
		
		deepEqual( vals, expected, "Expected values remaining" );
		
		cy.add(removedNode);
		
		equal( cy.nodes().size(), 3, "Expected number of nodes after adding the node back" );
		ok( cy.nodes(function(node){ return this.data("foo") == "one" }).size() == 1, "Node is indeed added back" );
		
	});
	
});