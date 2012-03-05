$(function(){
	
	defaultModule("Iteration");
	
	test("each", function(){
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
	});
	
	test("eq", function(){
		var list = [];
		var nodes = cy.nodes();
		
		nodes.each(function(){
			list.push( this );
		});
		
		$.each(list, function(i){
			strictEqual( nodes.eq(i).element(), list[i].element(), "node " + i + " ok via eq" );
		});
	});
	
	test("size", function(){
		equal( cy.nodes().size(), cy.nodes().length, "Size and length the same" );
		equal( cy.nodes().size(), 3, "Should have 3 nodes" );
	});
	
	test("slice", function(){
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
	
});