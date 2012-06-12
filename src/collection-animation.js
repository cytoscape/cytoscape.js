;(function($, $$){
	
	$$.fn.collection({
		animated: function(){
			var ele = this[0];

			return ele && ele._private.animation.current.length > 0
		}
	});
	
	$$.fn.collection({
		clearQueue: function(){
			for( var i = 0; i < this.length; i++ ){
				var ele = this[i];
				ele._private.animation.queue = [];
			}

			return this;
		}
	});
	
	$$.fn.collection({
		delay: function( time, complete ){
			return this.animate({
				delay: time
			}, {
				duration: time,
				complete: complete
			});
		}
	});
	
	$$.fn.collection({
		animate: function( properties, params ){
			var callTime = +new Date;
			
			return this.each(function(){
				var self = this;
				var startPosition = $$.util.copy( self._private.position );
				var startStyle = $$.util.copy( self.style() );
				var structs = this.cy()._private; // TODO remove ref to `structs` after refactoring
				
				params = $.extend(true, {}, {
					duration: 400
				}, params);
				
				switch( params.duration ){
				case "slow":
					params.duration = 600;
					break;
				case "fast":
					params.duration = 200;
					break;
				}
				
				if( properties == null || (properties.position == null && properties.bypass == null && properties.delay == null) ){
					return; // nothing to animate
				}
				
				if( self.animated() && (params.queue === undefined || params.queue) ){
					enqueue();
				} else {
					run();
				}
				
				var q;
				
				function enqueue(){
					q = self._private.animation.queue;
					add();
				}
				
				function run(){
					q = self._private.animation.current;
					add();
				} 
				
				function add(){
					q.push({
						properties: properties,
						params: params,
						callTime: callTime,
						startPosition: startPosition,
						startStyle: startStyle
					});
					
					structs.animation.elements = structs.animation.elements.add( self );
				}
			});
		}
	});
	
	$$.fn.collection({
		stop: function(clearQueue, jumpToEnd){
			this.each(function(){
				var self = this;
				
				$.each(self._private.animation.current, function(i, animation){				
					if( jumpToEnd ){
						$.each(animation.properties, function(propertyName, property){
							$.each(property, function(field, value){
								self._private[propertyName][field] = value;
							});
						});
					}
				});
				
				self._private.animation.current = [];
				
				if( clearQueue ){
					self._private.animation.queue = [];
				}
			});
			
			// we have to notify (the animation loop doesn't do it for us on `stop`)
			this.cy().notify({
				collection: this,
				type: "draw"
			});
			
			return this;
		}
	});
	
	$$.fn.collection({
		show: function(){
			this.cy().renderer().showElements( this.collection() );
			
			return this;
		}
	});
	
	$$.fn.collection({
		hide: function(){
			this.cy().renderer().hideElements( this.collection() );
			
			return this;
		}
	});
	
	$$.fn.collection({
		visible: function(){
			var ele = this.element();
			
			if( ele != null ){
				return this.cy().renderer().elementIsVisible( ele );
			}
		}
	});
	
})(jQuery, jQuery.cytoscape);	
