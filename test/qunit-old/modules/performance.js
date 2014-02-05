$v(function(jQuery, $, version){
	
	// use only if `performance` flag set
	var search = window.location.search;
	var doPerformanceTests = false;
	if( search.match(/[\?\&]?filter\=Performance/) ){
		doPerformanceTests = true;
	}

	if( !doPerformanceTests ){
		return;
	}

	module("Performance", {
		setup: function(){
			stop();
			


			var n = 10000;
			var nodes = [];
			for(var i = 0; i < n; i++){
				nodes.push( {} );
			}

			console.time("init");
			console.profile("initprof");

			$("#cytoscape").cytoscape({
				renderer: {
					name: "null"
				},
				layout: {
					name: "null"
				},
				elements: {
					nodes: nodes
				},
				ready: function(cy){
					window.cy = cy;

					console.timeEnd("init");
					console.profileEnd("initprof");

					start();
				}
			});
			
		},
		
		teardown: function(){
		}
	});

	test(".pdata() versus _private with loop", function(){ 
		var times = 1000;
		var eles = cy.elements();

		console.time("pdata");
		for(var i = 0; i < times; i++){
			for( var ie = 0, l = eles.length; ie < l; ie++ ){
				var _private = eles[ie].pdata(); // get

				_private.foo = { bar: "baz" };

				eles[ie].pdata(_private); // save
			}
		}
		console.timeEnd("pdata");

		console.time("_private");
		for(var i = 0; i < times; i++){
			for(var ie = 0, l = eles.length; ie < l; ie++){
				var _private = eles[ie]._private; // get

				_private.foo = { bar: "baz" };

				eles[ie]._private = _private; // save
			}
		}
		console.timeEnd("_private");
	});

	test(".pdataField() versus _private with loop", function(){ 
		var times = 1000;
		var eles = cy.elements();

		console.time("pdata");
		for(var i = 0; i < times; i++){
			for( var ie = 0, l = eles.length; ie < l; ie++ ){
				eles[ie].pdataField("foo", { bar: "baz" }); // save
			}
		}
		console.timeEnd("pdata");

		console.time("_private");
		for(var i = 0; i < times; i++){
			for(var ie = 0, l = eles.length; ie < l; ie++){
				var _private = eles[ie]._private; // get

				_private.foo = { bar: "baz" };

				eles[ie]._private = _private; // save
			}
		}
		console.timeEnd("_private");
	});

	test("undef versus is.string", function(){ 
		var times = 1000000;
		var variable = "foo";
		var $$ = $.cytoscape;

		console.time("undef");
		for(var i = 0; i < times; i++){
			var ok = variable === undefined;
		}
		console.timeEnd("undef");

		console.time("is.string");
		for(var i = 0; i < times; i++){
			var ok = $$.is.string( variable );
		}
		console.timeEnd("is.string");
	});
	
});