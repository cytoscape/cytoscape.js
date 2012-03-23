$v(function(jQuery, $, version){
	
	defaultModule("Navigation");
	
	test("Parallel edges", function(){
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
	
	test("Neighborhood", function(){
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
	
});