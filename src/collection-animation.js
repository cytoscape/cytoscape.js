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
			var cy = this._private.cy;
			
			for( var i = 0; i < this.length; i++ ){
				var self = this[i];

				var self = this;
				var pos = self._private.position;
				var startPosition = {
					x: pos.x,
					y: pos.y
				};
				var startStyle = self.css();

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
				
				cy.addToAnimationPool( self );
			}
		}, // animate

		stop: function(clearQueue, jumpToEnd){
			this.each(function(){
				var self = this;
				var anis = self._private.animation.current;

				for( var i = 0; i < anis.length; i++ ){
					var animation = anis[i];		
					if( jumpToEnd ){
						for( var propertyName in animation.properties ){
							var property = animation.properties[ propertyName ];
							for( var field in property ){
								var value = property[field];
								self._private[propertyName][field] = value;
							}
						}
					}
				}
				
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
