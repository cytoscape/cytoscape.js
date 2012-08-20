;(function( $$ ){

	$$.fn.eles({
		animated: function(){
			var ele = this[0];

			if( ele ){
				ele._private.animation.current.length > 0;
			}
		},

		clearQueue: function(){
			for( var i = 0; i < this.length; i++ ){
				var ele = this[i];
				ele._private.animation.queue = [];
			}

			return this;
		},

		delay: function( time, complete ){
			return this.animate({
				delay: time
			}, {
				duration: time,
				complete: complete
			});
		},

		animate: function( properties, params ){
			var callTime = +new Date;
			
			for( var i = 0; i < this.length; i++ ){
				var self = this[i];

				var self = this;
				var pos = self._private.position;
				var startPosition = {
					x: pos.x,
					y: pos.y
				};
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
					q = self._private.animation.queue;
				} else {
					q = self._private.animation.current;
				}
				
				q.push({
					properties: properties,
					params: params,
					callTime: callTime,
					startPosition: startPosition,
					startStyle: startStyle
				});
				
				structs.animation.elements = structs.animation.elements.add( self );
			}
		}, // animate

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
	
})( cytoscape );	
