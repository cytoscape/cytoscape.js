(function($){
	
	// set up testing params
	
	window.cy = null;
	window.$$ = null;

	var isIE = navigator.userAgent.indexOf(' MSIE ') > -1;
	
	if( isIE ){
		window.console = {
			log: function(){},
			group: function(){},
			groupEnd: function(){}
		};
	}
	
	QUnit.moduleStart = function(module){
		console.group(module.name);
	};
	
	QUnit.moduleDone = function(){
		console.groupEnd();
	};
	
	var testCount = 1;
	QUnit.testStart = function(test){
		console.group((testCount++) + ". " + test.name);
	};
	
	QUnit.testDone = function(){
		console.groupEnd();
		
		asyncCalls = 0;
	};
	
	var asyncCalls = 0;
	window.async = function(fn){
		setTimeout(fn, 100 * ++asyncCalls);
	}

	var asyncChecks = 0;
	var asyncExpect = 0;
	var asyncFunction = null;

	window.asyncExpect = function( calls, fn ){
		asyncExpect = calls;
		asyncChecks = 0;
		asyncFunction = fn;
	};

	window.asyncStart = function(){
		asyncChecks++;

		if( asyncChecks >= asyncExpect ){
			if( asyncFunction != null ){
				asyncFunction();
			}
			start();
		}
	};
	
	var width = 500;
	var height = 500;
	
	$("#cytoscape").css({
		width: width,
		height: height,
		border: "1px solid #888",
		position: "relative"
	});
	
	window.defaultModule = function(name){
		module(name, {
			setup: function(){
				stop();

				$("#cytoscape").cytoscape({
					renderer: {
						name: "null"
					},
					layout: {
						name: "null"
					},
					elements: {
						nodes: [
						    { data: { id: "n1", foo: "one", weight: 0.25 }, classes: "odd one" },
					    	{ data: { id: "n2", foo: "two", weight: 0.5 }, classes: "even two" },
					    	{ data: { id: "n3", foo: "three", weight: 0.75 }, classes: "odd three" }
						],
						
						edges: [
						    { data: { id: "n1n2", source: "n1", target: "n2", weight: 0.33 }, classes: "uh" },
					    	{ data: { id: "n2n3", source: "n2", target: "n3", weight: 0.66 }, classes: "huh" }
						]
					},
					ready: function(){
						var cy = this;
						window.cy = cy;

						start();
					}
				});
				
			},
			
			teardown: function(){
			}
		});
	}
	
})(jQuery);