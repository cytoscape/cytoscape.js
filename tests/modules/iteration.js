$v(function(jQuery, $, version){
	
	defaultModule("Iteration");
	
	test("eles.each()", function(){
		var visited = { n1: false, n2: false, n3: false };
		
		// native cytoweb each
		cy.nodes().each(function(){
			visited[ this.data("id") ] = true;
		});
		
		$.each(visited, function(id, didVisit){
			ok( didVisit, "Visited " + id );
			visited[ id ] = false;
		});
		
		// jquery each
		$.each(cy.nodes(), function(i, node){
			visited[ this.data("id") ] = true;
		});
		
		$.each(visited, function(id, didVisit){
			ok( didVisit, "Visited via jQuery.each " + id );
		});

		var j;
		cy.nodes().each(function(i, ele){
			if( i == 1 ){
				return false;
			} else {
				j = i;
			}
		});
		equal( j, 0, "return false exits each early" );
	});
	
	test("eles.eq()", function(){
		var list = [];
		var nodes = cy.nodes();
		
		nodes.each(function(){
			list.push( this );
		});
		
		$.each(list, function(i){
			strictEqual( nodes.eq(i).element(), list[i].element(), "node " + i + " ok via eq" );
		});
	});
	
	test("eles.size()", function(){
		equal( cy.nodes().size(), cy.nodes().length, "Size and length the same" );
		equal( cy.nodes().size(), 3, "Should have 3 nodes" );
	});

	test("eles.empty() et al", function(){
		ok( cy.$("#notgonnamatch").empty(), "empty collection is empty" );
		ok( !cy.$("#n1").empty(), "nonempty collection is !empty" );
		ok( !cy.$("#notgonnamatch").nonempty(), "empty collection is !nonempty" );
		ok( cy.$("#n1").nonempty(), "nonempty collection is nonempty" );
	})
	
	test("eles.slice()", function(){
		var array = [];
		var nodes = cy.nodes();
		
		nodes.each(function(){
			array.push( this );
		});
		
		// test against browser array slice function for all combinations :)
		for(var i = 0; i < array.length; i++){
			for(var j = undefined; j == undefined || j <= array.length; j = (j == undefined ? i : j + 1) ){
				
				var slicedArray = array.slice(i, j);
				var slicedNodes = nodes.slice(i, j);
				
				$.each(slicedArray, function(k){
					ok( slicedNodes[k].element() === slicedArray[k].element(), "node " + k + " same for slice(" + i + ", " + j + ")" );
				});
			}
		}
	});

	test("eles.toArray()", function(){
		var nodes = cy.nodes();
		var nodesArray = nodes.toArray();

		nodes.each(function(i, node){
			ok( node.same( nodesArray[i] ), "node " + i + " same" );
		});
	});

	test('ele.parallelIndex() & eles.parallelSize()', function(){
		var foo = cy.add({
			group: 'nodes',
			data: { id: 'foo' }
		});

		var bar = cy.add({
			group: 'nodes',
			data: { id: 'bar' }
		});

		var edge1 = cy.add({
			group: 'edges',
			data: { id: 'edge1', source: 'foo', target: 'bar' }
		});

		equal( edge1.parallelIndex(), 0, 'only edge index' );
		equal( edge1.parallelSize(), 1, 'number of || edges' );

		var edge2 = cy.add({
			group: 'edges',
			data: { id: 'edge2', source: 'foo', target: 'bar' }
		});

		equal( edge1.parallelIndex(), 0, '1st edge index unchanged' );
		equal( edge2.parallelIndex(), 1, '2nd edge with same direction index' );
		equal( edge1.parallelSize(), 2, '|| size for 1st edge' );
		equal( edge2.parallelSize(), 2, '|| size for 2nd edge' );

		var edge3 = cy.add({
			group: 'edges',
			data: { id: 'edge3', source: 'bar', target: 'foo' }
		});

		equal( edge1.parallelIndex(), 0, '1st edge index unchanged' );
		equal( edge2.parallelIndex(), 1, '2nd edge index unchanged' );
		equal( edge3.parallelIndex(), 2, '3rd edge with diff directed index' );
		equal( edge1.parallelSize(), 3, '|| size for 1st edge' );
		equal( edge2.parallelSize(), 3, '|| size for 2nd edge' );
		equal( edge3.parallelSize(), 3, '|| size for 3rd edge' );
	});
	
});