;(function($){
	
	var defaults = {
		zoomFactor: 0.05,
		zoomDelay: 50,
		minZoom: 0.1,
		maxZoom: 10,
		panSpeed: 25,
		panDistance: 1.5
	};
	
	$.fn.cytoscapewebPanzoom = function(params){
		var options = $.extend(true, {}, defaults, params);
		
		return $(this).each(function(){
			var $container = $(this);
			
			var $panzoom = $('<div class="ui-cytoscapeweb-panzoom"></div>');
			$container.append( $panzoom );
			
			var $zoomIn = $('<div class="ui-cytoscapeweb-panzoom-zoom-in ui-cytoscapeweb-panzoom-zoom-button"><span class="ui-icon ui-icon-plusthick"></span></div>');
			$panzoom.append( $zoomIn );
			
			var $zoomOut = $('<div class="ui-cytoscapeweb-panzoom-zoom-out ui-cytoscapeweb-panzoom-zoom-button"><span class="ui-icon ui-icon-minusthick"></span></div>');
			$panzoom.append( $zoomOut );
			
			var $reset = $('<div class="ui-cytoscapeweb-panzoom-reset ui-cytoscapeweb-panzoom-zoom-button"><span class="ui-icon ui-icon-arrowthick-2-ne-sw"></span></div>');
			$panzoom.append( $reset );
			
			var $slider = $('<div class="ui-cytoscapeweb-panzoom-slider"></div>');
			$panzoom.append( $slider );
			
			var $panner = $('<div class="ui-cytoscapeweb-panzoom-panner"></div>');
			$panzoom.append( $panner );
			
			var $pHandle = $('<div class="ui-cytoscapeweb-panzoom-panner-handle"></div>');
			$panner.append( $pHandle );
			
			function handle2pan(){
				var pos = $pHandle.position();
				var x = pos.left;
				var y = pos.top;
				var w = $panner.width() - $pHandle.outerWidth();
				var h = $panner.height() - $pHandle.outerHeight();
				var r = $panner.width()/2;
				
				var v = {
					x: x - w/2,
					y: y - h/2
				};
				
				var d = Math.sqrt( v.x*v.x + v.y*v.y );
				var percent = d/r;
				
				var vnorm = {
					x: -1 * v.x * (percent * options.panDistance),
					y: -1 * v.y * (percent * options.panDistance)
				};
	
				return vnorm;
			}
			
			function donePanning(){
				clearInterval(panInterval);
				
				$pHandle.css({
					left: $panner.width()/2 - $pHandle.outerWidth()/2,
					top: $panner.height()/2 - $pHandle.outerHeight()/2
				});
			}
			
			var panInterval;
			$pHandle.draggable({
				containment: "parent",
				drag: function(){
					var pan = handle2pan();
					
					if( isNaN(pan.x) || isNaN(pan.y) ){
						return;
					}
					
					clearInterval(panInterval);
					panInterval = setInterval(function(){
						$container.cytoscapeweb("get").panBy(pan);
					}, options.panSpeed);
				},
				stop: function(){
					donePanning();
				}
			});
			
			$pHandle.bind("mouseup", function(){
				donePanning();
			});
			
			$(window).bind("mouseup blur", function(){
				donePanning();
			});
			
			var sliderMax = 100;
			var sliderMin = Math.floor( Math.log(options.minZoom)/Math.log(options.maxZoom) * sliderMax );
			
			$slider.slider({
				min: sliderMin,
				max: sliderMax,
				step: 1,
				val: zoom2slider( $container.cytoscapeweb("get").zoom() ),
				slide: function(){
					var cy = $container.cytoscapeweb("get");
					var val = $slider.slider("value");
					var zoom = slider2zoom(val);
					
					clearTimeout(sliderTimeout);
					sliderTimeout = null;
					cy.zoom({
						level: zoom,
						renderedPosition: {
							x: $container.width()/2,
							y: $container.height()/2
						}
					});
				}
			});
			
			var sliderMdown = false;
			$slider.find(".ui-slider-handle").bind("mousedown", function(){
				sliderMdown = true;
			}).bind("mouseup", function(){
				sliderMdown = false;
			});
			
			$(window).bind("mouseup blur", function(){
				sliderMdown = false;
			});
			
			var sliderTimeout;
			$container.cytoscapeweb("get").bind("zoom", function(){
				
				if( sliderTimeout != null || sliderMdown ){
					return;
				}
				
				sliderTimeout = setTimeout(function(){
					var lvl = cy.zoom();
					var slider = zoom2slider(lvl);
					var percent = (slider - sliderMin) / (sliderMax - sliderMin);
					
					if( percent > 1 ){
						percent = 1;
					}
					
					if( percent < 0 ){
						percent = 0;
					}
					
					$slider.find(".ui-slider-handle").css("left", (100 * percent) + "%");
					sliderTimeout = null;
				}, 10);
			});
			
			function slider2zoom(slider){
				return Math.pow( 10, slider/100 );
			}
			
			function zoom2slider(zoom){
				return Math.log(zoom) * 100 / Math.log(10);
			}
			
			$panzoom.draggable({
				containment: "parent"
			});
			
			var zoomInterval;
			function bindButton($button, factor){
				$button.bind("mousedown", function(e){
					if( e.button != 0 ){
						return;
					}
					
					var cy = $container.cytoscapeweb("get");
					
					zoomInterval = setInterval(function(){
						var zoom = cy.zoom();
						var lvl = cy.zoom() * factor;
						
						if( lvl < options.minZoom ){
							lvl = options.minZoom;
						}
						
						if( lvl > options.maxZoom ){
							lvl = options.maxZoom;
						}
						
						if( (lvl == options.maxZoom && zoom == options.maxZoom) ||
							(lvl == options.minZoom && zoom == options.minZoom)
						){
							return;
						}
						
						cy.zoom({
							level: lvl,
							renderedPosition: {
								x: $container.width()/2,
								y: $container.height()/2
							}
						});
					}, options.zoomDelay);
					
					return false;
				})
				
				$(window).bind("mouseup blur", function(){
					clearInterval(zoomInterval);
				});
			}
			
			bindButton( $zoomIn, (1 + options.zoomFactor) );
			bindButton( $zoomOut, (1 - options.zoomFactor) );
			
			$reset.bind("mousedown", function(e){
				if( e.button != 0 ){
					return;
				}
				
				var cy = $container.cytoscapeweb("get");
				cy.fit();
				return false;
			});
			
			
			
		});
	};
	
})(jQuery);