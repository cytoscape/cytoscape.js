$(function(){
	
	// set up testing params
	
	window.cy = null;
	
	$.cytoscapeweb("quiet", false);
	$.cytoscapeweb("debugging", true);
	
	if( $.browser.msie ){
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
	
	var width = 500;
	var height = 500;
	
	$("#cytoscapeweb").css({
		width: width,
		height: height,
		border: "1px solid #888",
		position: "relative"
	});
	
	
});