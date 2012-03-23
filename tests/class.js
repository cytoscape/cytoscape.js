$v(function(jQuery, $, version){
	
	defaultModule("Class");
	
	function testBind(options){
		var triggered = {};
		
//		stop();
		
		options.elements.each(function(){
			triggered[ this.data("id") ] = 0;
		}).one("class", function(){
			triggered[ this.data("id") ]++;
			console.log("class");
		});
		
//		setTimeout(function(){
//			options.elements.each(function(){
//				equal( triggered[ this.data("id") ], 1, "`class` triggered once for " + this.data("id") );
//			});
//			
//			options.after();
//			start();
//		}, 100);
	}
	
	asyncTest("Add class", function(){
		var n1 = cy.nodes("#n1");
		var n2 = cy.nodes("#n2");
		var n3 = cy.nodes("#n3");
		
		cy.nodes().addClass("foo");
		testBind({
			elements: cy.nodes(),
			after: function(){
				cy.nodes().each(function(){
					ok( this.hasClass("foo"), "`foo` added properly to " + this.data("id") );
				});
			}
		});
		
		n1.addClass("foo bar baz");
		ok( n1.hasClass("foo"), "n1 still has `foo`" );
		ok( n1.hasClass("bar"), "n1 has `bar`" );
		ok( n1.hasClass("baz"), "n1 has `baz`" );
		
		start();
	});
	
});