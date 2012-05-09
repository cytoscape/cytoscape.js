$v(function(jQuery, $, version){
	
	defaultModule("Data");
	
	function confirmScratch( options ){
		confirm( $.extend({}, options, {
			storage: "scratch"
		}) );
	}
	
	function confirmData( options ){
		confirm( $.extend({}, options, {
			storage: "data"
		}) );
	}
	
	function confirmPosition( options ){
		confirm( $.extend({}, options, {
			storage: "position"
		}) );
	}
	
	function confirm( options ){
		var self = options.element;
		var fields = options.fields;
		var storage = options.storage;
		
		var actualFieldCount = 0;
		for(var fieldName in self[storage]()){
			actualFieldCount++;
		}
		
		var expectedFieldCount = 0;
		for(var fieldName in fields){
			expectedFieldCount++;
		}
		
		equal(actualFieldCount, expectedFieldCount, "Expected number of fields for " + self.data("id"));		
		
		$.each(fields, function(name, value){
			var expected = value;
			var actual = self[storage](name);
			
			equal(actual, expected, "Field `" + name + "` for " + self.data("id"));
		});
	}
	
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
	
	test("Delete data", function(){
		// data fields: id, foo, weight
		
		// delete just weight field and confirm
		cy.nodes("#n1").removeData("weight");
		confirmData({
			element: cy.nodes("#n1"),
			fields: {
				id: "n1",
				foo: "one"
			}
		});
		
		// delete all data from n1
		cy.nodes("#n1").removeData();
		confirmData({
			element: cy.nodes("#n1"),
			fields: {
				id: "n1"
			}
		});
		
		// delete all data for all nodes and confirm
		cy.nodes().removeData();
		confirmData({
			element: cy.nodes("#n1"),
			fields: {
				id: "n1"
			}
		});
		confirmData({
			element: cy.nodes("#n2"),
			fields: {
				id: "n2"
			}
		});
		confirmData({
			element: cy.nodes("#n3"),
			fields: {
				id: "n3"
			}
		});
	});
	
	test("position", function(){
		var n1 = cy.$("#n1");
		
		n1.one("position", function(){
			confirmPosition({
				element: n1, 
				fields: {
					x: 1,
					y: 2
				}
			});
		});
		n1.position({
			x: 1,
			y: 2
		});
		
		n1.one("position", function(){
			confirmPosition({
				element: n1,
				fields: {
					x: 123,
					y: 2
				}
			});
		});
		n1.position("x", 123);
		
		equal( n1.position("x"), 123, "x via 1 param get" );
		equal( n1.position("y"), 2, "y via 1 param get" );
		deepEqual( n1.position(), { x: 123, y: 2 }, "position obj via 0 param get" );
		
	});
	
	test("Scratch", function(){
		
		// write scratch to all
		cy.nodes().scratch("foo", "bar").each(function(){
			confirmScratch({
				element: this,
				fields: {
					foo: "bar"
				}
			});
		});
		
		// add scratch to n1
		cy.nodes("#n1").scratch("hello", "there").each(function(){
			confirmScratch({
				element: this,
				fields: {
					foo: "bar",
					hello: "there"
				}
			});
		});
		
		// remove scratch for n1
		cy.nodes("#n1").removeScratch().each(function(){
			confirmScratch({
				element: this,
				fields: {}
			});
		});
		
		// remove scratch for all others
		cy.nodes("#n1").removeScratch().each(function(){
			confirmScratch({
				element: this,
				fields: {}
			});
		});
		
		// try out dot namespace notation
		cy.nodes("#n1").scratch("foo", {}).scratch("foo.bar", "hello");
		equal( cy.nodes("#n1").scratch("foo.bar"), "hello" );
		cy.nodes("#n1").scratch("foo.uh", "huh").removeScratch("foo.bar");
		equal( cy.nodes("#n1").scratch("foo.uh"), "huh", "uh: huh there" );
		equal( cy.nodes("#n1").scratch("foo.bar"), null, "foo.bar deleted" );
		
		// delete two scratches at once
		cy.nodes("#n1").scratch("baz", {}).removeScratch("foo baz");
		equal( cy.nodes("#n1").scratch("foo"), null, "foo deleted" );
		equal( cy.nodes("#n1").scratch("baz"), null, "baz deleted" );
		
	});
	
});