$v(function(jQuery, $, version){
	
	defaultModule("Traversing");
	
	// note: you can elide tests for eles.filter() here, because
	// we handle that in the selectors tests

	test("eles.add()", function(){
		var n1 = cy.nodes("#n1");
		var n2 = cy.nodes("#n2");
		var n3 = cy.nodes("#n3");
		
		var collection = n1.add(n2);
		equal(collection[0].data("id"), "n1", "1st is n1");
		equal(collection[1].data("id"), "n2", "2nd is n2");
		
		collection = collection.add(n3);
		equal(collection[2].data("id"), "n3", "3rd is n3");
		
		collection = collection.add(n2);
		equal(collection.size(), 3, "Adding n2 again doesn't change the collection");
		
		collection = collection.add( n2.add(n3) );
		equal(collection.size(), 3, "Adding (n2, n3) again doesn't change the collection");
	});

	test("eles.not()", function(){
		var n1 = cy.$("#n1");
		var n2 = cy.$("#n2");
		var n3 = cy.$("#n3");

		var nodes = cy.nodes();
		var not_n1 = n2.add(n3);

		ok( nodes.not("#n1").allSame(not_n1), "not with selectors" );
		ok( nodes.allSame(cy.nodes()), "original collection not modified" );
		ok( nodes.not(n1).allSame(not_n1), "not with element" );
		ok( nodes.not("#n2, #n3").allSame(n1), "not with multiple elements via selectors" );
		ok( nodes.not(n2.add(n3)).allSame(n1), "not with multiple elements via collection" );
	});
	
	test("eles.neighborhood() et al", function(){
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

	test("edges.parallelEdges() et al", function(){
		cy.add({
			edges: [
			        { data: { source: "n1", target: "n2", id: "ep1" } },
			        { data: { source: "n2", target: "n1", id: "ep2" } }
		    ]
		});
		
		// parallelEdges
		var pedges = cy.$("#ep1").parallelEdges();
		equal( pedges.size(), 3, "number of parallel edges" );
		ok( pedges.anySame( cy.$("#ep1") ), "has ep1" );
		ok( pedges.anySame( cy.$("#ep2") ), "has ep2" );
		ok( pedges.anySame( cy.$("#n1n2") ), "has n1n2" );

		// codirectedEdges
		var cedges = cy.$("#n1n2").codirectedEdges();
		equal( cedges.size(), 2, "number of codirected edges" );
		ok( cedges.allSame( cy.$("#n1n2, #ep1") ), "codirected edges are n1n2 & ep2" );

		// connectedNodes
		ok( pedges.connectedNodes().allSame( cy.$("#n1, #n2") ), "connected nodes of || edges are n1 & n2" );
		ok( cy.$("#n1n2").connectedNodes().allSame( cy.$("#n1, #n2") ), "connected nodes of n1n2 are n1 & n2" );

		// source & target
		ok( cedges.source().allAre("#n1"), "codirected edges source is n1" );
		ok( cedges.target().allAre("#n2"), "codirected edges source is n2" );
		ok( pedges.source().allSame( cy.$("#n1, #n2") ), "source of || edges is n1 & n2" );

		// edgesWith
		ok( cy.$("#n1").edgesWith("#n2").allSame( cy.$("#n1n2, #ep1, #ep2") ), "n1 edgesWith n2 is { n1n2, ep1, ep2 }" );
		ok( cy.$("#n2").edgesWith("#n1, #n3").allSame("#n1n2, #n2n3, #ep1, #ep2"), "n2 edgesWith {n2, n3} is { n1n2, n2n3, ep1, ep2 }" );

		// edgesTo
		ok( cy.$("#n1").edgesTo("#n2").same("#n1n2, #ep1"), "n1 edgesTo n2 is { n1n2, ep1 }" );
	});

	test("edges.source() & edges.target()", function(){
		ok( cy.$("#n1n2").source().allAre("#n1"), "n1n2 source is n1" );
		ok( cy.$("#n1n2").target().allAre("#n2"), "n1n2 target is n2" );
	});

	asyncTest("eles.parent() et al", function(){
		$("#cytoscape").cy({
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