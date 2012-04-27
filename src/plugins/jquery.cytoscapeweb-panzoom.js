
/*

Cytoscape Web panzoom UI plugin

Depends on
- jQuery UI core
	- draggable
	- slider
	- Theme Roller UI icons (if you want)

*/

;(function($){
	
	var defaults = {
		zoomFactor: 0.05, // zoom factor per zoom tick
		zoomDelay: 16, // how many ms between zoom ticks
		minZoom: 0.1, // min zoom level
		maxZoom: 10, // max zoom level
		panSpeed: 10, // how many ms in between pan ticks
		panDistance: 10, // max pan distance per tick
		panDragAreaSize: 75, // the length of the pan drag box in which the vector for panning is calculated (bigger = finer control of pan speed and direction)
		panMinPercentSpeed: 0.25, // the slowest speed we can pan by (as a percent of panSpeed)
		panInactiveArea: 8, // radius of inactive area in pan drag box
		panIndicatorMinOpacity: 0.65, // min opacity of pan indicator (the draggable nib); scales from this to 1.0
		staticPosition: true, // should the panzoom control be static (like Google Maps) or in a draggable control (like VLC)
		autodisableForMobile: true // disable the panzoom completely for mobile (since we don't really need it with gestures like pinch to zoom)
	};
	
	$.fn.cytoscapewebPanzoom = function(params){
		var options = $.extend(true, {}, defaults, params);
		var fn = params;
		
		var functions = {
			destroy: function(){
				var $this = $(this);
				
				$this.find(".ui-cytoscapeweb-panzoom").remove();
			},
				
			init: function(){
				var browserIsMobile = 'ontouchstart' in window;
				
				if( browserIsMobile && options.autodisableForMobile ){
					return $(this);
				}
				
				return $(this).each(function(){
					var $container = $(this);
					
					var $panzoom = $('<div class="ui-cytoscapeweb-panzoom"></div>');
					$container.append( $panzoom );
					
					if( options.staticPosition ){
						$panzoom.addClass("ui-cytoscapeweb-panzoom-static");
					}
					
					var $zoomIn = $('<div class="ui-cytoscapeweb-panzoom-zoom-in ui-cytoscapeweb-panzoom-zoom-button"><span class="ui-icon ui-icon-plusthick"></span></div>');
					$panzoom.append( $zoomIn );
					
					var $zoomOut = $('<div class="ui-cytoscapeweb-panzoom-zoom-out ui-cytoscapeweb-panzoom-zoom-button"><span class="ui-icon ui-icon-minusthick"></span></div>');
					$panzoom.append( $zoomOut );
					
					var $reset = $('<div class="ui-cytoscapeweb-panzoom-reset ui-cytoscapeweb-panzoom-zoom-button"><span class="ui-icon ui-icon-arrowthick-2-ne-sw"></span></div>');
					$panzoom.append( $reset );
					
					var $slider = $('<div class="ui-cytoscapeweb-panzoom-slider"></div>');
					$panzoom.append( $slider );
					
					$slider.append('<div class="ui-cytoscapeweb-panzoom-slider-background"></div>');
					
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
						var $parent = $handle.parent();
						var pos = $handle.position();
						
						var width = $parent.width();
						var height = $parent.height();
						var left = pos.left;
						var bottom = height - pos.top;
						
						var range = sliderMax - sliderMin;
						var min = sliderMin;
						var percent = options.staticPosition ? (bottom / height) : (left / width);
						
						return Math.round( percent * range + min );
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
						val: zoom2slider( $container.cytoscapeweb("get").zoom() ),
						orientation: options.staticPosition ? "vertical" : "horizontal",
						slide: function(e){
							if( e.originalEvent.type == "keydown" ){
								return false; // don't allow keyboard to modify slider
							}
						}
					});
					
					function sliderHandler(){
						setZoomViaSlider();
					};
					
					function startSliding(){
						sliderMdown = true;
						
						sliderHandler();
						
						$(window).unbind("mousemove", sliderHandler);
						$(window).bind("mousemove", sliderHandler);
					}
					
					function doneSliding(){
						$(window).unbind("mousemove", sliderHandler);
						
						sliderMdown = false;
					}
					
					var sliderMdown = false;
					$slider.find(".ui-slider-handle").bind("mousedown", function(){
						startSliding();
					}).bind("mouseup", function(){
						doneSliding();
					});
					
					$slider.bind("mousedown", function(e){
						if( e.target != $slider.find(".ui-slider-handle")[0] ){ // update so long as not handle
							startSliding();
						}
					});
					
					$(window).bind("mouseup blur", function(){
						doneSliding();
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
							
							var property = options.staticPosition ? "bottom" : "left";
							
							$slider.find(".ui-slider-handle").css(property, (100 * percent) + "%");
							sliderTimeout = null;
						}, 10);
					});
					
					function slider2zoom(slider){
						return Math.pow( 10, slider/100 );
					}
					
					function zoom2slider(zoom){
						return Math.log(zoom) * 100 / Math.log(10);
					}
					
					if( !options.staticPosition ){
						$panzoom.draggable({
							containment: "parent"
						});
					}
				
					var zoomInterval;
					function bindButton($button, factor){
						$button.bind("mousedown", function(e){
							e.preventDefault();
							e.stopPropagation();
							
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
			}
		};
		
		if( functions[fn] ){
			return functions[fn].apply(this, Array.prototype.slice.call( arguments, 1 ));
		} else if( typeof fn == 'object' || !fn ) {
			return functions.init.apply( this, arguments );
		} else {
			$.error("No such function `"+ fn +"` for jquery.cytoscapewebPanzoom");
		}
		
		return $(this);
	};
	
})(jQuery);