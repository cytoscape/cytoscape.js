$v(function(jQuery, $, version){
	
	defaultModule("Add/remove elements");
	
	test("Remove a node", function(){ debugger;
		var n1 = cy.$("#n1");
		var n2 = cy.$("#n2");
		var n3 = cy.$("#n3");
		
		n1.remove();
		
		equal( cy.nodes().size(), 2, "Expected number of nodes" );
		ok( cy.$("#n2").size() == 1, "n2 still there" );
		ok( cy.$("#n3").size() == 1, "n3 still there" );
		ok( n1.removed(), "Node has removed state" );
	});

	test("Remove a node vi cy.remove()", function(){
		var n1 = cy.$("#n1");
		var n2 = cy.$("#n2");
		var n3 = cy.$("#n3");
		
		cy.remove( n1 );
		
		equal( cy.nodes().size(), 2, "Expected number of nodes" );
		ok( cy.$("#n2").size() == 1, "n2 still there" );
		ok( cy.$("#n3").size() == 1, "n3 still there" );
		ok( n1.removed(), "Node has removed state" );
	});
	
	test("Restore a node", function(){
		var n1 = cy.$("#n1");
		
		n1.remove();
		ok( n1.removed() && cy.$("#n1").size() == 0, "Node indeed removed" );
		
		n1.restore();
		ok( !n1.removed(), "n1 doesn't have removed state anymore" );
		ok( cy.getElementById("n1").size() == 1, "n1 found via getElementById" );
		ok( cy.$("#n1").size() == 1, "n1 found in graph via selector" );
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