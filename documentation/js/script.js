$(function(){
	
	// fix for webkit
	$('#navigation').on('mousewheel DOMMouseScroll MozMousePixelScroll', function(e){
		e.stopPropagation();
	});

});