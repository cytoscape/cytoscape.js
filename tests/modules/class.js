$v(function(jQuery, $, version){
	
	defaultModule("Class");
	
	test("eles.hasClass()", function(){
		ok( cy.$("#n1").hasClass("one"), "n1 has class `one`" );
	});

	test("eles.addClass()", function(){
		var n1 = cy.$("#n1");
			
		n1.addClass("foo bar baz");
		ok( n1.hasClass("foo"), "n1 has class `foo`" );
		ok( n1.hasClass("bar"), "n1 has `bar`" );
		ok( n1.hasClass("baz"), "n1 has `baz`" );
	});

	asyncTest("eles.addClass() triggers event", function(){
		var triggered = {};

		cy.$("node").on("class", function(){
			triggered[ this.id() ] = true;
		});

		cy.nodes().addClass("foo");

		async(function(){
			cy.nodes().each(function(){
				ok(triggered[ this.id() ], this.id() + " had `class` triggered");
			});

			start();
		});
	});

	test("eles.removeClass()", function(){
		var n1 = cy.$("#n1");

		n1.removeClass("one");
		ok( !n1.hasClass("one"), "n1 doesn't have class `one`" );
	});

	asyncTest("eles.removeClass() triggers event", function(){
		var triggered = {};

		cy.nodes().addClass("foo");
		cy.$("node").on("class", function(){
			triggered[ this.id() ] = true;
		});

		cy.nodes().removeClass("foo");

		async(function(){
			cy.nodes().each(function(){
				ok(triggered[ this.id() ], this.id() + " had `class` triggered");
			});

			start();
		});
	});
	
});