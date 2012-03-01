$(function(){
	
	defaultModule("Data");
	
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
	
	asyncTest("Read, write, and get events", function(){
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
	
});