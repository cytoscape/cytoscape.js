$v(function(jQuery, $, version){
	
	defaultModule("Collection manipulation");
	
	test("Add to collection", function(){
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
	
});