$(function(){
	// Elements module
	////////////////////////////////////////////////////////////////////////////////////////////
	
	module("Elements", {
		setup: function(){
			stop();
			
			$("#cytoscapeweb").cytoscapeweb({
				renderer: {
					name: "null"
				},
				layout: {
					name: "null"
				},
				elements: {
					nodes: [
					    { data: { id: "n1", foo: "one", weight: 0.25 }, classes: "odd one" },
				    	{ data: { id: "n2", foo: "two", weight: 0.5 }, classes: "even two" },
				    	{ data: { id: "n3", foo: "three", weight: 0.75 }, classes: "odd three" }
					],
					
					edges: [
					    { data: { id: "n1n2", source: "n1", target: "n2", weight: 0.33 }, classes: "uh" },
				    	{ data: { id: "n2n3", source: "n2", target: "n3", weight: 0.66 }, classes: "huh" }
					]
				},
				ready: function(cy){
					window.cy = cy;
					start();
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
		
		var n = cy.nodes("[foo='one']").size();
		equal(n, 1, "Expected number of matching nodes");
		
	});

	test("Selector with this reference for node", function(){
		
		ok( cy.nodes("[foo='one']").size() == 1, "cy.nodes works" );
		
		ok( cy.nodes().filter("[foo='one']").size() == 1, "node.filter works" );
	});
	
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
	
	asyncTest("Unbind selection", function(){
		
		var node = cy.nodes().eq(0);
		var fired = 0;
				
		node.bind("select", function(){
			fired++;
		});
		
		setTimeout(function(){
			node.select();
		}, 100);
		
		setTimeout(function(){
			equal( fired, 1, "Listener was fired when bound" );
			fired = 0;
			node.unbind("select");
		}, 200);
		
		setTimeout(function(){
			node.select();
		}, 300);
		
		setTimeout(function(){
			equal( fired, 0, "Listener was not fired when unbound" );
			start();
		}, 400);
		
	});
	
	asyncTest("Unbind API", function(){
		var node = cy.nodes().eq(0);
		
		var handler1Calls = 0;
		var handler1 = function(){
			handler1Calls++;
		};
		
		var handler2Calls = 0;
		var handler2 = function(){
			handler2Calls++;
		};
		
		node.bind("click", handler1);
		node.bind("click", handler2);
		
		async(function(){
			node.trigger("click");
		});
		
		async(function(){
			equal( handler1Calls, 1, "handler1 called first time" );
			equal( handler2Calls, 1, "handler2 called first time" );
			
			node.unbind("click", handler2);
			node.trigger("click");
		});
		
		async(function(){
			equal( handler1Calls, 2, "handler1 called again" );
			equal( handler2Calls, 1, "handler2 not called" );
			
			node.unbind("click");
			node.trigger("click");
		});
		
		async(function(){
			equal( handler1Calls, 2, "no change for handler1" );
			equal( handler2Calls, 1, "no change for handler2" );

			node.bind("click", handler1);
			node.bind("click", handler2);
		});
		
		async(function(){
			node.unbind();
			node.trigger("click");
		});
		
		async(function(){
			equal( handler1Calls, 2, "no change for handler1 after unbind all" );
			equal( handler2Calls, 1, "no change for handler2 after unbind all" );
			
			start();
		});
		
	});
	
	asyncTest("`once` with click", function(){
		var triggers = 0;
		
		cy.nodes().once("click", function(){
			triggers++;
		});
		
		async(function(){
			cy.nodes().eq(0).trigger("click");
		});
		
		async(function(){
			equal(triggers, 1, "Triggered once");
		});
		
		async(function(){
			cy.nodes().eq(0).trigger("click");
		});
		
		async(function(){
			equal(triggers, 1, "Not triggered again after clicking same node");
		});
		
		async(function(){
			cy.nodes().eq(1).trigger("click");
		});
		
		async(function(){
			equal(triggers, 1, "Not triggered again after clicking different node");
			
			start();
		});
	});
	
	asyncTest("Unbinding `once`", function(){
		var triggers = 0;
		var handler = function(){
			triggers++;
		};
		
		cy.nodes().once("click", handler);
		cy.nodes().unbind("click", handler);
		cy.nodes().eq(0).trigger("click");
		
		async(function(){
			equal(triggers, 0, "Handler never triggered");
			
			start();
		});
	});
	
	asyncTest("Manual event binding & triggering", function(){
		
		var events = [ "data", "bypass", "position", "select", "unselect", "lock", "unlock", "mouseover", "mouseout", "mousemove", "mousedown", "mouseup", "click", "grabify", "ungrabify", "grab", "free", "touchstart", "touchmove", "touchend" ];
		var triggered = {};
		var cyTriggered = {};
		var aliasTriggered = {};
		
		var node = cy.nodes()[0];
		$.each(events, function(i, event){
			node.bind(event, function(e, d){
				triggered[event] = triggered[event] != null ? triggered[event] + 1 : 1;
			});
			
			node[event](function(){
				aliasTriggered[event] = aliasTriggered[event] != null ? aliasTriggered[event] + 1 : 1;
			});
			
			cy.bind(event, function(e, d){
				cyTriggered[event] = cyTriggered[event] != null ? cyTriggered[event] + 1 : 1;
			});
			
			setTimeout(function(){
				node.trigger(event);
			}, 100);
		});
		
		setTimeout(function(){
			
			$.each(events, function(i, event){
				equal(triggered[event], 1, "Handler fired for `" + event + "`");
				equal(aliasTriggered[event], 1, "Aandler fired for `" + event + "` alias");
				equal(cyTriggered[event], 1, "Handler bubbled up to core for `" + event + "`");
			});
			
		}, 500);
		
		var bgClick = 0;
		cy.background().bind("click", function(){
			bgClick++;
		});
		
		var cyClick = 0;
		cy.bind("click", function(){
			cyClick++;
		});
		
		setTimeout(function(){
			cy.background().trigger("click");
		}, 100);
		
		setTimeout(function(){
			equal(bgClick, 1, "BG clicked once");
			equal(cyClick, 1, "BG click bubbled up to core");
			
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
	
	test("Same", function(){
		var n1 = cy.nodes("#n1");
		var n2 = cy.nodes("#n2");
		var n3 = cy.nodes("#n3");
		
		ok(n1.same(n1), "n1 is same as self");
		ok(!n1.same(n2), "n2 is not same as n1");
		ok(n1.add(n2).anySame(n1), "(n1, n2) is anySame to n1");
		ok(!n1.add(n2).anySame(n3), "(n1, n2) is not anySame to n3");
		ok(n1.add(n2).allSame(n2.add(n1)), "(n1, n2) allSame as (n2, n1)");
		ok(!n1.add(n2).allSame(n2.add(n3)), "(n1, n2) not allSame as (n2, n3)");
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
	
	test("Selectors", function(){
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
	});
	
	asyncTest("Bypass", function(){
		var n1 = cy.nodes("#n1");
		
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
				foo: 1,
				bar: 2
			}, "bypass has foo & bar" );
		});
		n1.bypass({
			bar: 2
		});
		
		n1.one("bypass", function(){
			deepEqual( this.bypass(), {
				bar: 2
			}, "bypass has bar" );
		});
		n1.removeBypass("foo");
		
		n1.one("bypass", function(){
			deepEqual( this.bypass(), {
			}, "bypass is empty" );
			
			start();
		});
		n1.removeBypass("bar");
	});
	
	asyncTest("Data", function(){
		var n1 = cy.nodes("#n1");
		
		n1.one("data", function(){
			equal( this.data("foo"), 1, "foo" );
		});
		n1.data("foo", 1);
		
		n1.one("data", function(){
			equal( this.data("foo"), undefined, "foo" );
			
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
	
	test("Functions are chainable", function(){
		
		var fn = {
			plain: {
				args: [],
				names: [
				        "remove", "restore",
				        "removeData",
				        "removeBypass",
				        "grabify", "ungrabify",
				        "lock", "unlock",
				        "show", "hide",
				        "select", "unselect",
				        "die", "unbind"
				        ]
			},
					
			setters: {
				args: [ { x: 1 } ],
				names: [
				          "data",
				          "position",
				          "bypass"
				          ]
			},
			
			events: {
				args: [ function(){} ],
				names: [ 
		          "mousedown", "mouseup", "click", "mouseover", "mouseout", 
		          "touchstart", "touchmove", "touchend", 
		          "grabify", "ungrabify", "grab", "drag", "free", 
		          "select", "unselect", 
		          "lock", "unlock", 
		          "data", "bypass", "remove", "restore"
		          ],
			},
			
			binders: {
				args: [ "click", function(){} ],
				names: [
			          "bind", "one", "once", "live"
			          ]
			}
		};
		
		var node = cy.nodes().eq(0);
		var nodes = cy.nodes();
		$.each(fn, function(type, fnSet){
			
			$.each(fnSet.names, function(i, fnName){
				var ret = node[fnName].apply(node, fnSet.args);
				ok( ret != null && ret.collection != null, "`node." + fnName + "()` w. args [" + fnSet.args + "] chainable" );
				
				var ret = nodes[fnName].apply(nodes, fnSet.args);
				ok( ret != null && ret.collection != null, "`nodes." + fnName + "()` w. args [" + fnSet.args + "] chainable" );
			});
			
		});
		
	});
});