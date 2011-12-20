;(function($){
	
	var defaults = {
		zoomFactor: 0.05,
		zoomDelay: 50
	};
	
	$.fn.cytoscapewebPanzoom = function(params){
		var options = $.extend(true, {}, defaults, params);
		
		return $(this).each(function(){
			var $container = $(this);
			
			var $panzoom = $('<div class="ui-cytoscapeweb-panzoom"></div>');
			$container.append( $panzoom );
			
			var $zoomIn = $('<div class="ui-cytoscapeweb-panzoom-zoom-in ui-cytoscapeweb-panzoom-zoom-button">+</div>');
			$panzoom.append( $zoomIn );
			
			var $zoomOut = $('<div class="ui-cytoscapeweb-panzoom-zoom-out ui-cytoscapeweb-panzoom-zoom-button">&ndash;</div>');
			$panzoom.append( $zoomOut );
			
			var $reset = $('<div class="ui-cytoscapeweb-panzoom-reset ui-cytoscapeweb-panzoom-zoom-button">=</div>');
			$panzoom.append( $reset );
			
			var zoomInterval;
			function bindButton($button, factor){
				$button.bind("mousedown", function(e){
					var cy = $container.cytoscapeweb("get");
					
					zoomInterval = setInterval(function(){
						cy.zoom({
							level: cy.zoom() * factor,
							renderedPosition: {
								x: $container.width()/2,
								y: $container.height()/2
							}
						});
					}, options.zoomDelay);
					
					e.preventDefault();
				}).bind("mouseup", function(){
					clearInterval(zoomInterval);
				});
			}
			
			bindButton( $zoomIn, (1 + options.zoomFactor) );
			bindButton( $zoomOut, (1 - options.zoomFactor) );
			
			$reset.bind("click", function(){
				var cy = $container.cytoscapeweb("get");
				cy.reset();
			});
			
			
			
		});
	};
	
})(jQuery);