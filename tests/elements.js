$v(function(jQuery, $, version){
	// Elements module
	////////////////////////////////////////////////////////////////////////////////////////////
	
	defaultModule("Elements");
	
	test("Verify all elements are there", function(){
		equal( cy.nodes().size(), 3, "There are 3 nodes" );
		equal( cy.elements().size(), 5, "There are 5 elements" );
		equal( cy.edges().size(), 2, "There are 2 edges" );
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