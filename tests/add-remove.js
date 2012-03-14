$(function(){
	
	defaultModule("Add/remove elements");
	
	test("Nothing fancy", function(){
		ok(true, "OK");
	});
	
	return;
	
	test("Remove a node", function(){
		
		var removedNode = cy.nodes().filter("[foo='one']").remove().eq(0);
		
		equal( cy.nodes().size(), 2, "Expected number of nodes" );
		
		var expected = [ "three", "two" ];
		var vals = [];
		
		cy.nodes().each(function(i, node){
			vals.push( node.data("foo") );
		});
		vals.sort();
		
		deepEqual( vals, expected, "Expected values remaining" );
		ok(removedNode.removed(), "Node has removed state");
		
		cy.add(removedNode);

		equal( cy.nodes().size(), 3, "Expected number of nodes after adding the node back" );
		ok( cy.nodes("[foo='one']").size() == 1, "Node is indeed added back" );
		
		
	});
	
	asyncTest("Load a new graph on top", function(){
		
		cy.load({
			nodes: [
			        {
			        	data: { id: "foo" }
			        }
			        ]
		}, function(){
			// on ready
			
			equal( cy.elements().size(), 1, "Expected number of nodes after loading" );
			equal( cy.nodes().eq(0).data("id"), "foo", "ID of loaded node" );
			ok( cy.elements("#foo").size() == 1, "Can get loaded node with selector" );
			
			start();
		}, function(){
			// on done
		});
		
	});
	
});