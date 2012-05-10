$v(function(jQuery, $, version){
	
	defaultModule("Traversing");
	
	test("eles.parallelEdges()", function(){
		cy.add({
			edges: [
			        { data: { source: "n1", target: "n2", id: "ep1" } },
			        { data: { source: "n1", target: "n2", id: "ep2" } }
		    ]
		});
		
		var edges = cy.edges("#ep1").parallelEdges();
		
		equal( edges.size(), 3, "number of parallel edges" );
		ok( edges.anySame( cy.edges("#ep1") ), "has ep1" );
		ok( edges.anySame( cy.edges("#ep2") ), "has ep2" );
		ok( edges.anySame( cy.edges("#n1n2") ), "has n1n2" );
	});
	
	test("eles.neighborhood()", function(){
		var n1 = cy.nodes("#n1");
		var n2 = cy.nodes("#n2");
		var n3 = cy.nodes("#n3");
		var n1n2 = cy.edges("#n1n2");
		var n2n3 = cy.edges("#n2n3");
		
		equal( n2.neighborhood().nodes().size(), 2, "number of n2 neighbour nodes" );
		equal( n2.neighborhood().edges().size(), 2, "number of n2 neighbour edges" );
		ok( n2.neighborhood().anySame(n1), "neighbourhood of n2 has n1" );
		ok( n2.neighborhood().anySame(n3), "neighbourhood of n2 has n3" );
		ok( n2.neighborhood().anySame(n1n2), "neighbourhood of n2 has n1n2" );
		ok( n2.neighborhood().anySame(n2n3), "neighbourhood of n2 has n2n3" );
		ok( !n2.neighborhood().anySame(n2), "default neighbourhood does not contain self" );
		ok( !n2.openNeighborhood().anySame(n2), "open neighbourhood does not contain self" );
		ok( n2.closedNeighborhood().anySame(n2), "closed neighbourhood does contain self" );
		ok( n2.neighborhood().allSame( n2.openNeighborhood() ), "default neighbourhood is open" );
		
		equal( n2.add(n1).neighborhood().nodes().size(), 3, "number of (n2, n1) neighbour nodes" );
		equal( n1.add(n2).add(n3).neighborhood().size(), 5, "number of (n1, n2, n3) neighbour elements" );
		equal( n2.openNeighborhood().size(), 4, "number of n2 open neighbourhood elements" );
		equal( n2.closedNeighborhood().size(), 5, "number of n2 closed neighbourhood elements" );
		equal( n2.allAreNeighbors(n1), true, "n1 neighbour of n2" );
		equal( n2.allAreNeighbors( n1.add(n3) ), true, "n1 and n3 neighbours of n2" );
		equal( n1.allAreNeighbors(n3), false, "n1 and n3 neighbours" );
		equal( n1.allAreNeighbors( n2.add(n3) ), false, "(n2, n3) all neighbours of n1" );
	});

	test("eles.nodes()", function(){
		var eles = cy.elements();

		equal(3, eles.nodes().size(), "3 nodes");
		equal(1, eles.nodes("#n1").size(), "#n1 filter worked");
	});

	test("eles.edges()", function(){
		var eles = cy.elements();

		equal(2, eles.edges().size(), "2 edges");
		equal(1, eles.edges("#n1n2").size(), "#n1n2 filter worked");
	});

	asyncTest("eles.parent() et al", function(){
		$("#cytoscapeweb").cy({
			renderer: {
				name: "null"
			},
			layout: {
				name: "null"
			},
			elements: {
				nodes: [
					{ data: { id: "father" } },
					{ data: { id: "son", parent: "father" } },
					{ data: { id: "grandson", parent: "son" } },
					{ data: { id: "son2", parent: "father" } }
				]
			},
			ready: function(cy){
				var f = cy.$("#father");
				var s = cy.$("#son");
				var g = cy.$("#grandson");
				var s2 = cy.$("#son2");

				ok( f.parent().empty(), "father has no parent" );
				ok( f.children().allSame( s.add(s2) ), "father has son and son2 as children" );
				ok( f.descendants().allSame( s.add(s2).add(g) ), "father's descendants correct" );
				ok( s.siblings().allSame( s2 ), "son2 sibling of son" );
				ok( g.parents().allSame( f.add(s) ), "grandson has father and son as parents" );
				
				start();
				window.cy = cy;
			}
		});
	});
	
});