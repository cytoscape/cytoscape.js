$(function(){
	
	$.cytoscapeweb("quiet", false);
	$.cytoscapeweb("debugging", true);
	
	window.cy = null;
	
	QUnit.moduleStart = function(module){
		console.group(module.name);
	};
	
	QUnit.moduleDone = function(){
		console.groupEnd();
	};
	
	var testCount = 1;
	QUnit.testStart = function(test){
		console.group((testCount++) + ". " + test.name);
	};
	
	QUnit.testDone = function(){
		console.groupEnd();
	};
	
	var width = 500;
	var height = 500;
	
	$("#cytoscapeweb").css({
		width: width,
		height: height,
		border: "1px solid #888",
		position: "relative"
	});
	
	// Test aliases
	////////////////////////////////////////////////////////////////////////////////////////////
	
	module("Test aliases", {
		setup: function(){
		},
		
		teardown: function(){
		}
	});
	
	test("Test short `cy` notation", function(){
		cy = $.cy({
			selector: "#cytoscapeweb",
			renderer: {
				name: "null"
			},
			layout: {
				name: "null"
			},
			elements: {
				nodes: [
				    { foo: "the node" }
				]
			}
		});
		
		ok( cy != null, "Not null object" );
		ok( cy.nodes().size() == 1, "Node is there" );
	});
	
	test("Test jQuery selector style", function(){
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
			}
		});
		
		cy = $("#cytoscapeweb").cy("get");
		
		ok( cy != null, "Not null object" );
		ok( cy.nodes().size() == 1, "Node is there" );
		ok( $("#cytoscapeweb").cy("nodes").size() == 1, "Node is there via jQuery style" );
	});
	
	// Test invalid init options module
	////////////////////////////////////////////////////////////////////////////////////////////
	
	module("Test invalid init options", {
		setup: function(){},
		teardown: function(){}
	});
	
	test("Two nodes, same ID", function(){
		cy = $.cytoscapeweb({
			selector: "#cytoscapeweb",
			renderer: {
				name: "null"
			},
			layout: {
				name: "null"
			},
			elements: {
				nodes: [
				    { data: { id: "n1", foo: "one" } },
				    { data: { id: "n2", foo: "two" } },
			    	{ data: { id: "n1", foo: "what is this guy doing here" } }
				]
			}
		});
		
		equal( 2, cy.nodes().size(), "Number of nodes" );
		equal( 1, cy.nodes("[id=n1]").size(), "Instances of node `n1`" );
		ok( cy.node("n2") != null, "Node `n2` is there" );
	});
	
	test("Edge specifies two bad IDs (no nodes)", function(){
		cy = $.cytoscapeweb({
			selector: "#cytoscapeweb",
			renderer: {
				name: "null"
			},
			layout: {
				name: "null"
			},
			elements: {
				edges: [ { data: { source: "n1", target: "n2" } } ]
			}
		});
		
		ok( cy.elements().size() == 0, "There are no elements" );
	});
	
	test("Edge specifies one bad ID", function(){
		cy = $.cytoscapeweb({
			selector: "#cytoscapeweb",
			renderer: {
				name: "null"
			},
			layout: {
				name: "null"
			},
			elements: {
				nodes: [ { data: { id: "n1" } } ],
				edges: [ { data: { source: "n1", target: "n2" } } ]
			}
		});
		
		ok( cy.edges().size() == 0, "There are no edges" );
		ok( cy.nodes().size() == 1, "The node is still there" );
	});
	
	test("Edge specifies good IDs", function(){
		cy = $.cytoscapeweb({
			selector: "#cytoscapeweb",
			renderer: {
				name: "null"
			},
			layout: {
				name: "null"
			},
			elements: {
				nodes: [ { data: { id: "n1" } }, { data: { id: "n2" } } ],
				edges: [ { data: { source: "n1", target: "n2" } } ]
			}
		});
		
		ok( cy.edges().size() == 1, "The edge exists" );
		ok( cy.nodes().size() == 2, "The nodes are still there" );
	});
	
	// Elements module
	////////////////////////////////////////////////////////////////////////////////////////////
	
	module("Elements", {
		setup: function(){
			
			cy = $.cytoscapeweb({
				selector: "#cytoscapeweb",
				renderer: {
					name: "null"
				},
				layout: {
					name: "null"
				},
				elements: {
					nodes: [
					    { data: { id: "n1", foo: "one", weight: 0.25 } },
				    	{ data: { id: "n2", foo: "two", weight: 0.5 } },
				    	{ data: { id: "n3", foo: "three", weight: 0.75 } }
					],
					
					edges: [
					    { data: { id: "n1n2", source: "n1", target: "n2", weight: 0.33 } },
				    	{ data: { id: "n2n3", source: "n2", target: "n3", weight: 0.66 } }
					]
				}
			});
			
		},
		
		teardown: function(){
		}
	});
	
	test("Verify all elements are there", function(){
		equal( cy.nodes().size(), 3, "There are 3 nodes" );
		equal( cy.elements().size(), 5, "There are 5 elements" );
		equal( cy.edges().size(), 2, "There are 2 edges" );
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
	
	test("Get a node with the cy.nodes function using a selector", function(){
		
		var n = cy.nodes("[foo=one]").size();
		equal(n , 1, "Expected number of matching nodes");
		
	});

	test("Selector with this reference for node", function(){
		
		ok( cy.nodes("[foo=one]").size() == 1, "cy.nodes works" );
		
		ok( cy.nodes().filter("[foo=one]").size() == 1, "node.filter works" );
	});
	
	test("Remove a node", function(){
		
		var removedNode = cy.nodes().filter("[foo=one]").remove().eq(0);
		
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
		ok( cy.nodes("[foo=one]").size() == 1, "Node is indeed added back" );
		
		
	});
	
	asyncTest("Select a node", function(){
		expect(4);
		
		var node = cy.nodes().eq(0);
		
		node.bind("select", function(){
			ok(true, "Selection listener fired");
			
			ok( node.selected(), "Node state selected" );
		});
		
		node.bind("unselect", function(){
			ok(true, "Unselection listener fired");
			
			ok( !node.selected(), "Node state unselected" );
			
			start();
		});
		
		setTimeout(function(){
			node.select();
		}, 100);
		
		setTimeout(function(){
			node.unselect();
		}, 200);
		
	});
	
	asyncTest("Test unbind selection", function(){
		
		var node = cy.nodes().eq(0);
		var fired = false;
				
		node.bind("select", function(){
			fired = true;
		});
		
		setTimeout(function(){
			node.select();
		}, 100);
		
		setTimeout(function(){
			ok( fired, "Listener was fired when bound" );
			fired = false;
			node.unbind("select");
		}, 200);
		
		setTimeout(function(){
			node.select();
		}, 300);
		
		setTimeout(function(){
			ok( !fired, "Listener was not fired when unbound" );
			start();
		}, 400);
		
	});
	
	asyncTest("Test manual event binding & triggering", function(){
		
		var events = [ "data", "bypass", "position", "select", "unselect", "lock", "unlock", "mouseover", "mouseout", "mousemove", "mousedown", "mouseup", "click" ];
		var triggered = {};
		
		var node = cy.nodes()[0];
		$.each(events, function(i, event){
			node.bind(event, function(e, d){
				triggered[event] = true;
			});
			
			setTimeout(function(){
				node.trigger(event);
			}, 100);
		});
		
		setTimeout(function(){
			
			$.each(events, function(i, event){
				ok(triggered[event], "Handler fired for `" + event + "`");
			});
			
			start();
		}, 500);
		
	});
	
	test("Node's group is `nodes`", function(){
		cy.nodes().each(function(i, node){
			ok( node.group() == "nodes", "Node has proper group" );
		});
	});
	
	test("Edge's group is `edges`", function(){
		cy.edges().each(function(i, edge){
			ok( edge.group() == "edges", "Edge has proper group" );
		});
	});
	
	test("Collection add", function(){
		var n1 = cy.node("n1");
		var n2 = cy.node("n2");
		var n3 = cy.node("n3");
		
		var collection = n1.collection().add(n2);
		equal(collection[0].data("id"), "n1", "1st is n1");
		equal(collection[1].data("id"), "n2", "2nd is n2");
		
		collection = collection.add(n3);
		equal(collection[2].data("id"), "n3", "3rd is n3");
		
		collection = collection.add(n2);
		equal(collection.size(), 3, "Adding n2 again doesn't change the collection");
		
		collection = collection.add( n2.collection().add(n3) );
		equal(collection.size(), 3, "Adding (n2, n3) again doesn't change the collection");
	});
	
	test("Same", function(){
		var n1 = cy.node("n1");
		var n2 = cy.node("n2");
		var n3 = cy.node("n3");
		
		ok(n1.same(n1), "n1 is same as self");
		ok(!n1.same(n2), "n2 is not same as n1");
		ok(n1.collection().add(n2).anySame(n1), "(n1, n2) is anySame to n1");
		ok(n1.collection().add(n2).allSame(n2.collection().add(n1)), "(n1, n2) allSame as (n2, n1)");
		ok(!n1.collection().add(n2).allSame(n2.collection().add(n3)), "(n1, n2) not allSame as (n2, n3)");
	});
	
	test("Neighborhood", function(){
		var n1 = cy.node("n1");
		var n2 = cy.node("n2");
		var n3 = cy.node("n3");
		var n1n2 = cy.edge("n1n2");
		var n2n3 = cy.edge("n2n3");
		
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
		
		equal( n2.collection().add(n1).neighborhood().nodes().size(), 3, "number of (n2, n1) neighbour nodes" );
		equal( n1.collection().add(n2).add(n3).neighborhood().size(), 5, "number of (n1, n2, n3) neighbour elements" );
		equal( n2.openNeighborhood().size(), 4, "number of n2 open neighbourhood elements" );
		equal( n2.closedNeighborhood().size(), 5, "number of n2 closed neighbourhood elements" );
		equal( n2.allAreNeighbors(n1), true, "n1 neighbour of n2" );
		equal( n2.allAreNeighbors( n1.collection().add(n3) ), true, "n1 and n3 neighbours of n2" );
		equal( n1.allAreNeighbors(n3), false, "n1 and n3 neighbours" );
		equal( n1.allAreNeighbors( n2.collection().add(n3) ), false, "(n2, n3) all neighbours of n1" );
	});
	
	test("Test selectors", function(){
		var n1 = cy.node("n1");     // 0.25
		var n2 = cy.node("n2");     // 0.5
		var n3 = cy.node("n3");     // 0.75
		var n1n2 = cy.edge("n1n2"); // 0.33 
		var n2n3 = cy.edge("n2n3"); // 0.66
		
		ok( cy.filter("[weight=0.5]").allSame( n2 ), "n2 weight = 0.5" );
		ok( cy.filter("[weight>=0.5]").allSame( n2.collection().add(n3).add(n2n3) ), "n2 weight >= 0.5" );
		ok( cy.filter("node").allSame( cy.nodes() ), "filter node same as nodes()" );
		ok( cy.filter("node").allSame( cy.elements("node") ), "filter node same as nodes()" );
		equal( cy.nodes("[foo]").size(), 3, "nodes that have foo defined" );
		equal( cy.edges("[foo]").size(), 0, "edges that have foo defined" );
		ok( cy.filter("node[foo=one]").allSame( n1 ), "node[foo=one]" );
		ok( cy.filter("node[foo=one][id=n1]").allSame( n1 ), "node[foo=one][id=n1]" );
		ok( cy.filter("node[ foo = one ][ id = n1 ]").allSame( n1 ), "node[ foo = one ][ id = n1 ]" );
		ok( cy.filter("node[foo= one ][ id =n1]").allSame( n1 ), "node[foo= one ][ id =n1]" );
		ok( cy.filter("node[foo=one][id!=n2]").allSame( n1 ), "node[foo=one][id!=n2]" );
		ok( cy.filter("node[foo=one][id!=n2], edge[weight<0.5]").allSame( n1.collection().add(n1n2) ), "node[foo=one][id!=n2], edge[weight<0.5]" );
		ok( cy.filter("node[foo!=one][weight<1]").allSame( n2.collection().add(n3) ), "node[foo!=one][weight<1]" );
		ok( cy.filter("node[foo!=two][weight>0.3]").allSame( n3 ), "node[foo!=two][weight>0.3]" );
		ok( cy.filter("node[foo='one']").allSame( n1 ), "node[foo='one']" );
		ok( cy.filter("node[foo=\"one\"]").allSame( n1 ), "node[foo=\"one\"]" );
	});
	
	asyncTest("Test bypass", function(){
		var n1 = cy.node("n1");
		
		n1.one("bypass", function(){
			deepEqual( this.bypass(), {
				foo: 1
			}, "bypass has foo" );
		});
		n1.bypass({
			foo: 1
		});
		
		n1.one("bypass", function(){
			deepEqual( this.bypass(), {
				bar: 2
			}, "bypass has bar" );
		});
		n1.bypass({
			bar: 2
		});
		
		n1.one("bypass", function(){
			deepEqual( this.bypass(), {
				foo: 1,
				bar: 2
			}, "bypass has foo & bar" );
		});
		n1.bypass("foo", 1);
		
		n1.one("bypass", function(){
			deepEqual( this.bypass(), {
				foo: 1
			}, "bypass has only foo" );
			
			start();
		});
		n1.removeBypass("bar");
	});
	
	asyncTest("Test data", function(){
		var n1 = cy.node("n1");
		
		n1.one("data", function(){
			equal( this.data("foo"), 1, "foo" );
		});
		n1.data("foo", 1);
		
		n1.one("data", function(){
			equal( this.data("foo"), null, "foo" );
			
			var d = this.data();
			for(var i in d){
				ok( i != "foo", i + " is not `foo` attribute" )
			}
		});
		n1.removeData("foo");
		
		n1.one("data", function(){
			equal( n1.data("foo"), 2, "foo" );
			equal( n1.data("id"), "n1", "id didn't change" );
			start();
		});
		n1.data({
			foo: 2,
			id: "should-not-be-this"
		});
		
		n1.one("data", function(){
			ok( n1.data("weight") == null, "n1 no weight" );
			start();
		});
		cy.nodes().removeData("weight").each(function(){
			ok( this.data("weight") == null, "no weight " + this.data("id") );
			ok( this.data("id") != null, "has id " + this.data("id") );
		});
	});
	
	test("Test parallel edges", function(){
		cy.addEdges([
		    { data: { source: "n1", target: "n2", id: "ep1" } },
		    { data: { source: "n1", target: "n2", id: "ep2" } }
		]);
		
		var edges = cy.edge("ep1").parallelEdges();
		
		equal( edges.size(), 3, "number of parallel edges" );
		ok( edges.anySame( cy.edge("ep1") ), "has ep1" );
		ok( edges.anySame( cy.edge("ep2") ), "has ep2" );
		ok( edges.anySame( cy.edge("n1n2") ), "has n1n2" );
	});
	
	// Random layout
	////////////////////////////////////////////////////////////////////////////////////////////
	
	module("Random layout", {
		setup: function(){
			
			cy = $.cytoscapeweb({
				selector: "#cytoscapeweb",
				renderer: {
					name: "null"
				},
				layout: {
					name: "random"
				},
				elements: {
					nodes: [
					    { data: { id: "n1", foo: "one" } },
				    	{ data: { id: "n2", foo: "two" } },
				    	{ data: { id: "n3", foo: "three" } }
					],
					
					edges: [
					    { data: { id: "n1n2", source: "n1", target: "n2" } },
				    	{ data: { id: "n2n3", source: "n2", target: "n3" } }
					]
				}
			});
			
		},
		
		teardown: function(){
		}
	});
	
	test("Positions are different", function(){
		var n1 = cy.node("n1");
		var n2 = cy.node("n2");
		var n3 = cy.node("n3");
		
		notDeepEqual( n1.position(), n2.position(), "n1 and n2 different" );
		notDeepEqual( n2.position(), n3.position(), "n2 and n3 different" );
		notDeepEqual( n1.position(), n3.position(), "n1 and n3 different" );
	});
	
	test("Position changes after relayout", function(){
		var oldPos = cy.nodes().eq(0).position();
		
		cy.layout();
		var newPos = cy.nodes().eq(0).position();
		
		notDeepEqual( oldPos, newPos, "Node position changed" );
	});
	
//	module("SVG renderer", {
//		setup: function(){
//			
//			cy = $.cytoscapeweb({
//				selector: "#cytoscapeweb",
//				renderer: {
//					name: "svg"
//				},
//				layout: {
//					name: "grid"
//				},
//				elements: {
//					nodes: [
//					    { data: { id: "n1", foo: "one" } },
//				    	{ data: { id: "n2", foo: "two" } },
//				    	{ data: { id: "n3", foo: "three" } }
//					],
//					
//					edges: [
//					    { data: { id: "n1n2", source: "n1", target: "n2" } },
//				    	{ data: { id: "n2n3", source: "n2", target: "n3" } }
//					]
//				}
//			});
//			
//		},
//		
//		teardown: function(){
//		}
//	});
//	
//	test("Initial SVG test", function(){
//		
//		
//		
//	});
	
});