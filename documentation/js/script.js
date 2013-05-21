$(function(){
	
	// fix for webkit
	$('#navigation').on('mousewheel DOMMouseScroll MozMousePixelScroll', function(e){
		e.stopPropagation();
	});


	// avoid weird rendering bug in chrome etc
	$('#navigation a').on('click', function(){
		var scroll = $('#navigation').scrollTop();

		$('#navigation').scrollTop( scroll + 1 );
		$('#navigation').scrollTop( scroll );
	});

});