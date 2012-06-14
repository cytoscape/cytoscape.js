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
	
	test("Functions return undefined on empty collection", function(){
		var eles = cy.collection();

		equal( eles.id(), undefined, "eles.id()" );
		equal( eles.position(), undefined, "eles.position()" );
		equal( eles.position("x"), undefined, "eles.position('x')" );
		equal( eles.group(), undefined, "eles.group()" );
		equal( eles.json(), undefined, "eles.json()" );
		equal( eles.renderedPosition(), undefined, "eles.renderedPosition()" );
		equal( eles.renderedPosition("x"), undefined, "eles.renderedPosition('x')" );
		equal( eles.grabbed(), undefined, "eles.grabbed()" );
		equal( eles.grabbable(), undefined, "eles.grabbable()" );
		equal( eles.locked(), undefined, "eles.locked()" );
		equal( eles.style(), undefined, "eles.style()" );
		equal( eles.style("foo"), undefined, "eles.style('foo')" );
		equal( eles.renderedStyle(), undefined, "eles.renderedStyle()" );
		equal( eles.renderedStyle('foo'), undefined, "eles.renderedStyle('foo')" );
		equal( eles.visible(), undefined, "eles.visible()" );
		equal( eles.animated(), undefined, "eles.animated()" );
		equal( eles.selected(), undefined, "eles.selected()" );
		equal( eles.selectable(), undefined, "eles.selectable()" );
		equal( eles.degree(), undefined, "eles.degree()" );
		equal( eles.bypass(), undefined, "eles.bypass()" );
		equal( eles.bypass('x'), undefined, "eles.bypass('x')" );
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
				        "unbind"
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
			          "bind", "one", "once"
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