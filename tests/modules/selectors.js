$v(function(jQuery, $, version){
	
	defaultModule("Selectors");
	
	test("Filter function", function(){
		
		equal( cy.nodes().filter(function(i, node){
			if( node.data("foo") == "one" ){
				return true;
			}
		}).size(), 1, "Expected number of matching nodes");
		
	});
	
	test("Basic test", function(){
		
		var n = cy.nodes("[foo='one']").size();
		equal(n, 1, "Expected number of matching nodes");
		
	});
	
	test("Chaining gives same result", function(){
		
		ok( cy.nodes("[foo='one']").size() == 1, "cy.nodes works" );
		ok( cy.nodes().filter("[foo='one']").size() == 1, "node.filter works" );
	});
	
	test("Boolean selectors", function(){
		var n1 = cy.$("#n1").data("bool", true);
		var n2 = cy.$("#n2").data("bool", null);
		var n3 = cy.$("#n3");
		
		ok( cy.$("node[bool]").allSame( n1.add(n2) ), "n1, n2 have bool defined" );
		ok( cy.$("node[?bool]").allSame( n1 ), "n1 has bool truthy" );
		ok( cy.$("node[!bool]").allSame( n2.add(n3) ), "n2, n3 have bool falsey" );
		ok( cy.$("node[^bool]").allSame( n3 ), "only n3 has bool not defined" );
	});
	
	test("Syntax variants", function(){
		var n1 = cy.nodes("#n1");     // 0.25
		var n2 = cy.nodes("#n2");     // 0.5
		var n3 = cy.nodes("#n3");     // 0.75
		var n1n2 = cy.edges("#n1n2"); // 0.33 
		var n2n3 = cy.edges("#n2n3"); // 0.66
		
		n1.data("weird", "foo\nbar");
		n2.data("weird", "foo, bar");
		
		ok( cy.filter("[weight=0.5]").allSame( n2 ), "n2 weight = 0.5" );
		ok( cy.filter("[weight>=0.5]").allSame( n2.add(n3).add(n2n3) ), "n2 weight >= 0.5" );
		ok( cy.filter("node").allSame( cy.nodes() ), "filter node same as cy.nodes()" );
		ok( cy.filter("node").allSame( cy.elements("node") ), "filter node same as cy.elements('node')" );
		ok( cy.filter("node").allSame( n1.add(n2).add(n3) ), "node" );
		equal( cy.nodes("[foo]").size(), 3, "nodes that have foo defined" );
		equal( cy.edges("[foo]").size(), 0, "edges that have foo defined" );
		ok( cy.filter("node[foo='one']").allSame( n1 ), "node[foo='one']" );
		ok( cy.filter("node[foo='one'][id='n1']").allSame( n1 ), "node[foo='one'][id='n1']" );
		ok( cy.filter("node[ foo = 'one' ][ id = 'n1' ]").allSame( n1 ), "node[ foo = 'one' ][ id = 'n1' ]" );
		ok( cy.filter("node[foo= 'one' ][ id ='n1']").allSame( n1 ), "node[foo= 'one' ][ id ='n1']" );
		ok( cy.filter("node[foo='one'][id!='n2']").allSame( n1 ), "node[foo='one'][id!='n2']" );
		ok( cy.filter("node[foo='one'][id!='n2'], edge[weight<0.5]").allSame( n1.add(n1n2) ), "node[foo='one'][id!='n2'], edge[weight<0.5]" );
		ok( cy.filter("node[foo!='one'][weight<1]").allSame( n2.add(n3) ), "node[foo!='one'][weight<1]" );
		ok( cy.filter("node[foo!='two'][weight>0.3]").allSame( n3 ), "node[foo!='two'][weight>0.3]" );
		ok( cy.filter("node[foo='one']").allSame( n1 ), "node[foo='one']" );
		ok( cy.filter("node[foo=\"one\"]").allSame( n1 ), "node[foo=\"one\"]" );
		ok( cy.filter("node.odd").allSame( n1.add(n3) ), "node.odd" );
		ok( cy.filter(".odd.even").size() == 0, ".odd.even" );
		ok( cy.filter(".one.odd").allSame(n1), ".one.odd" );
		ok( cy.filter("node.one[weight < 0.5][foo = 'one'].odd:unlocked").allSame(n1), "node.one[weight < 0.5][foo = 'one'].odd:unlocked" );	
		ok( cy.filter("[weird = 'foo, bar']").allSame(n2), "[weird = 'foo, bar']" );
		ok( $$("*").same( cy.elements() ), "* gives all elements" );
	});

	test("Compound selectors", function(){
		cy.add({
			nodes: [
				{ data: { id: "np1" } },
				{ data: { id: "np2", parent: "np1" } },
				{ data: { id: "np3a", parent: "np2" }, classes: "foo" },
				{ data: { id: "np3b", parent: "np2" } }
			]
		});

		ok( $$("#np1 node").same("#np2, #np3a, #np3b"), "np1 descendants are { np2, np31a, np3b }" );
		ok( $$("#np1 > node").same("#np2"), "np1 children are { np2 }" );
		ok( $$("#np2 > node").same("#np3a, #np3b"), "np2 children { np3a, np3b }" );
		ok( $$("#np1 .foo").same("#np3a"), "np1 .foo descendants { np3a }" );
		ok( $$("#np1 > * > *").same("#np3a, #np3b"), "np1 children's children { np3a, np3b }" );
	});
	
});