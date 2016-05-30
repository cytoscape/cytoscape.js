$(function(){

	function shortcut( prereq, fn ){

		$(window).bind("keydown", function(e){

			var matches = true;
			$.each( prereq, function(name, val){
				if( val != e[name] ){
					matches = false;
				}
			} );

			if( matches ){
				fn();
			}
		});
	}

	shortcut({
		which: 8,
		metaKey: true
	}, function(){
		cy.$(":selected").remove();
	});

	shortcut({
		which: 192
	}, function(){
		console.log("Pressed backtab (`) at " + (new Date()));
	});

	shortcut({
		which: 'F'.charCodeAt(0)
	}, function(){
		$("#cytoscape").toggleClass('full');
	});

});
