;(function($, $$){
	
	$$.fn.core({
		
		startAnimationLoop: function(){
			var cy = this;
			var structs = this._private;
			var stepDelay = 10;
			var useTimeout = false;
			var useRequestAnimationFrame = true;
			
			// initialise the list
			structs.animation.elements = new $$.Collection( cy );
			
			// TODO change this when standardised
			var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||  
				window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
			
			if( requestAnimationFrame == null || !useRequestAnimationFrame ){
				requestAnimationFrame = function(fn){
					window.setTimeout(function(){
						fn(+new Date);
					}, stepDelay);
				};
			}
			
			var containerDom = cy.container()[0];
			
			function globalAnimationStep(){
				function exec(){
					requestAnimationFrame(function(now){
						handleElements(now);
						globalAnimationStep();
					}, containerDom);
				}
				
				if( useTimeout ){
					setTimeout(function(){
						exec();
					}, stepDelay);
				} else {
					exec();
				}
			}
			
			globalAnimationStep(); // first call
			
			function handleElements(now){
				
				structs.animation.elements.each(function(i, ele){
					
					// we might have errors if we edit animation.queue and animation.current
					// for ele (i.e. by stopping)
					try{
						ele = ele.element(); // make sure we've actually got a Element
						var current = ele._private.animation.current;
						var queue = ele._private.animation.queue;
						
						// if nothing currently animating, get something from the queue
						if( current.length == 0 ){
							var q = queue;
							var next = q.length > 0 ? q.shift() : null;
							
							if( next != null ){
								next.callTime = +new Date; // was queued, so update call time
								current.push( next );
							}
						}
						
						// step and remove if done
						var completes = [];
						for(var i = 0; i < current.length; i++){
							var ani = current[i];
							step( ele, ani, now );

							if( current[i].done ){
								completes.push( ani );
								
								// remove current[i]
								current.splice(i, 1);
								i--;
							}
						}
						
						// call complete callbacks
						$.each(completes, function(i, ani){
							var complete = ani.params.complete;

							if( $$.is.fn(complete) ){
								complete.apply( ele, [ now ] );
							}
						});
						
					} catch(e){
						// do nothing
					}
					
				}); // each element
				
				
				// notify renderer
				if( structs.animation.elements.size() > 0 ){
					cy.notify({
						type: "draw",
						collection: structs.animation.elements
					});
				}
				
				// remove elements from list of currently animating if its queues are empty
				structs.animation.elements = structs.animation.elements.filter(function(){
					var ele = this;
					var queue = ele._private.animation.queue;
					var current = ele._private.animation.current;
					
					return current.length > 0 || queue.length > 0;
				});
			} // handleElements
				
			function step( self, animation, now ){
				var properties = animation.properties;
				var params = animation.params;
				var startTime = animation.callTime;
				var percent;
				
				if( params.duration == 0 ){
					percent = 1;
				} else {
					percent = Math.min(1, (now - startTime)/params.duration);
				}
				
				function update(p){
					if( p.end != null ){
						var start = p.start;
						var end = p.end;
						
						// for each field in end, update the current value
						$.each(end, function(name, val){
							if( valid(start[name], end[name]) ){
								self._private[p.field][name] = ease( start[name], end[name], percent );
							}
						});					
					}
				}
				
				if( properties.delay == null ){
					update({
						end: properties.position,
						start: animation.startPosition,
						field: "position"
					});
					
					update({
						end: properties.bypass,
						start: animation.startStyle,
						field: "bypass"
					});
				}
				
				if( $$.is.fn(params.step) ){
					params.step.apply( self, [ now ] );
				}
				
				if( percent >= 1 ){
					animation.done = true;
				}
				
				return percent;
			}
			
			function valid(start, end){
				if( start == null || end == null ){
					return false;
				}
				
				if( $$.is.number(start) && $$.is.number(end) ){
					return true;
				} else if( (start) && (end) ){
					return true;
				}
				
				return false;
			}
			
			function ease(start, end, percent){
				if( $$.is.number(start) && $$.is.number(end) ){
					return start + (end - start) * percent;
				} else if( (start) && (end) ){
					var c1 = $.Color(start).fix().toRGB();
					var c2 = $.Color(end).fix().toRGB();

					function ch(ch1, ch2){
						var diff = ch2 - ch1;
						var min = ch1;
						return Math.round( percent * diff + min );
					}
					
					var r = ch( c1.red(), c2.red() );
					var g = ch( c1.green(), c2.green() );
					var b = ch( c1.blue(), c2.blue() );
					
					return $.Color([r, g, b], "RGB").toHEX().toString();
				}
				
				return undefined;
			}
			
		}
		
	});
	
})(jQuery, jQuery.cytoscape);


	
		