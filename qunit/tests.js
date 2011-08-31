$(function(){
	
	$.cytoscapeweb("quiet", false);
	$.cytoscapeweb("debugging", true);
	
	window.cy = null;
	
	QUnit.moduleStart = function(module){
		console.groupCollapsed(module.name);
	};
	
	QUnit.moduleDone = function(){
		console.groupEnd();
	};
	
	QUnit.testStart = function(test){
		console.groupCollapsed(test.name);
	};
	
	QUnit.testDone = function(){
		console.groupEnd();
	};
	
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
			data: {
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
			data: {
				nodes: [
				    { foo: "the node" }
				]
			}
		});
		
		cy = $("#cytoscapeweb").cy("object");
		
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
			data: {
				nodes: [
				    { id: "n1", foo: "one" },
				    { id: "n2", foo: "two" },
				    { id: "n1", foo: "what is this guy doing here" }
				]
			}
		});
		
		equal( 2, cy.nodes().size(), "Number of nodes" );
		equal( 1, cy.nodes(function(node){ if( node.data("id") == "n1" ) return true; }).size(), "Instances of node `n1`" );
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
			data: {
				edges: [ { source: "n1", target: "n2" } ]
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
			data: {
				nodes: [ { id: "n1" } ],
				edges: [ { source: "n1", target: "n2" } ]
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
			data: {
				nodes: [ { id: "n1" }, { id: "n2" } ],
				edges: [ { source: "n1", target: "n2" } ]
			}
		});
		
		ok( cy.edges().size() == 1, "The edge exists" );
		ok( cy.nodes().size() == 2, "The nodes are still there" );
	});
	
	// Null renderer & layout module
	////////////////////////////////////////////////////////////////////////////////////////////
	
	module("Null renderer & layout", {
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
					    { id: "n1", foo: "one" },
					    { id: "n2", foo: "two" },
					    { id: "n3", foo: "three" }
					],
					
					edges: [
					    { id: "n1n2", source: "n1", target: "n2" },
					    { id: "n2n3", source: "n2", target: "n3" }
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
	
	test("Node's group is `node`", function(){
		cy.nodes().each(function(i, node){
			ok( node.group() == "nodes", "Node has proper group" );
		});
	});
	
});