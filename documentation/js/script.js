$(function(){
	var isTouch = ('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch;
	var events = isTouch ? 'touchstart' : 'mousedown';

/*
	$('#navigation').on(events, '.expander', function(){
		var $expander = $(this);
		var $section = $expander.parent();
		var lvl = $section.hasClass('lvl2') ? 2 : 1;
		var $children = $section.nextUntil('.lvl' + lvl);

		console.log($children)

		if( $expander.hasClass('collapsed') ){
			$children.add( $expander ).removeClass('collapsed');
		} else {
			$children.add( $expander ).addClass('collapsed');
		}
	});
*/

	$('#show-demo').on('mousedown touchstart', function(){
		$('#demo-code-area').removeClass('hidden');
		return;
	});

	$('#hide-demo').on('mousedown touchstart', function(){
		$('#demo-code-area').addClass('hidden');
		return;
	});
});