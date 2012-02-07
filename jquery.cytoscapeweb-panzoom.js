;(function($){
	
	var defaults = {
		zoomFactor: 0.05,
		zoomDelay: 16,
		minZoom: 0.1,
		maxZoom: 10,
		panSpeed: 10,
		panDistance: 10,
		panDragAreaSize: 100,
		panMinPercentSpeed: 0.25,
		panInactiveArea: 10,
		panIndicatorMinOpacity: 0.65
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
			
			var $pUp = $('<div class="ui-cytoscapeweb-panzoom-pan-up ui-cytoscapeweb-panzoom-pan-button"><span class="ui-icon ui-icon-triangle-1-n"></span></div>');
			var $pDown = $('<div class="ui-cytoscapeweb-panzoom-pan-down ui-cytoscapeweb-panzoom-pan-button"><span class="ui-icon ui-icon-triangle-1-s"></span></div>');
			var $pLeft = $('<div class="ui-cytoscapeweb-panzoom-pan-left ui-cytoscapeweb-panzoom-pan-button"><span class="ui-icon ui-icon-triangle-1-w"></span></div>');
			var $pRight = $('<div class="ui-cytoscapeweb-panzoom-pan-right ui-cytoscapeweb-panzoom-pan-button"><span class="ui-icon ui-icon-triangle-1-e"></span></div>');
			$panner.append( $pUp ).append( $pDown ).append( $pLeft ).append( $pRight );
			
			var $pIndicator = $('<div class="ui-cytoscapeweb-panzoom-pan-indicator"></div>');
			$panner.append( $pIndicator );
			
			function handle2pan(e){
				var v = {
					x: e.originalEvent.pageX - $panner.offset().left - $panner.width()/2,
					y: e.originalEvent.pageY - $panner.offset().top - $panner.height()/2
				}
				
				var r = options.panDragAreaSize;
				var d = Math.sqrt( v.x*v.x + v.y*v.y );
				var percent = Math.min( d/r, 1 );
				
				if( d < options.panInactiveArea ){
					return {
						x: NaN,
						y: NaN
					};
				}
				
				v = {
					x: v.x/d,
					y: v.y/d
				};
				
				percent = Math.max( options.panMinPercentSpeed, percent );
				
				var vnorm = {
					x: -1 * v.x * (percent * options.panDistance),
					y: -1 * v.y * (percent * options.panDistance)
				};
				
				return vnorm;
			}
			
			function donePanning(){
				clearInterval(panInterval);
				$(window).unbind("mousemove", handler);
				
				$pIndicator.hide();
			}
			
			function positionIndicator(pan){
				var v = pan;
				var d = Math.sqrt( v.x*v.x + v.y*v.y );
				var vnorm = {
					x: -1 * v.x/d,
					y: -1 * v.y/d
				};
				
				var w = $panner.width();
				var h = $panner.height();
				var percent = d/options.panDistance;
				
				$pIndicator.show().css({
					left: w/2 * vnorm.x + w/2,
					top: h/2 * vnorm.y + h/2,
					opacity: Math.max( options.panIndicatorMinOpacity, percent )
				});
			}
			
			var panInterval;
			
			var handler = function(e){
				e.stopPropagation(); // don't trigger dragging of panzoom
				e.preventDefault(); // don't cause text selection
				clearInterval(panInterval);
				
				var pan = handle2pan(e);
				
				if( isNaN(pan.x) || isNaN(pan.y) ){
					$pIndicator.hide();
					return;
				}
				
				positionIndicator(pan);
				panInterval = setInterval(function(){
					$container.cytoscapeweb("get").panBy(pan);
				}, options.panSpeed);
			};
			
			$pHandle.bind("mousedown", function(e){
				// handle click of icon
				handler(e);
				
				// update on mousemove
				$(window).bind("mousemove", handler);
			});
			
			$pHandle.bind("mouseup", function(){
				donePanning();
			});
			
			$(window).bind("mouseup blur", function(){
				donePanning();
			});
			
			var sliderMax = 100;
			var sliderMin = Math.floor( Math.log(options.minZoom)/Math.log(options.maxZoom) * sliderMax );
			
			function getSliderVal(){
				var $handle = $slider.find(".ui-slider-handle");
				var left = $handle.position().left;
				var width = $handle.parent().width();
				
				var range = sliderMax - sliderMin;
				var min = sliderMin;
				
				return Math.round( left / width * range + min );
			}
			
			function setZoomViaSlider(){
				var cy = $container.cytoscapeweb("get");
				var val = getSliderVal();
				
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
			
			$slider.slider({
				min: sliderMin,
				max: sliderMax,
				step: 1,
				val: zoom2slider( $container.cytoscapeweb("get").zoom() )
			});
			
			function sliderHandler(){
				setZoomViaSlider();
			};
			
			var sliderMdown = false;
			$slider.find(".ui-slider-handle").bind("mousedown", function(){
				sliderMdown = true;				
				$(window).bind("mousemove", sliderHandler);
			}).bind("mouseup", function(){
				$(window).unbind("mousemove", sliderHandler);
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