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
			this.animate({
				delay: time
			}, {
				duration: time,
				complete: complete
			});

			return this;
		},

		animate: function( properties, params ){
			var callTime = +new Date;
			var cy = this._private.cy;
			var style = cy.style();

			debugger;
			
			for( var i = 0; i < this.length; i++ ){
				var self = this[i];

				var pos = self._private.position;
				var startPosition = {
					x: pos.x,
					y: pos.y
				};
				var startStyle = style.getValueStyle( self );

				if( params.duration === undefined ){
					params.duration = 400;
				}
				
				switch( params.duration ){
				case "slow":
					params.duration = 600;
					break;
				case "fast":
					params.duration = 200;
					break;
				}
				
				if( properties == null || (properties.position == null && properties.css == null && properties.delay == null) ){
					continue; // nothing to animate
				}
				
				if( self.animated() && (params.queue === undefined || params.queue) ){
					q = self._private.animation.queue;
				} else {
					q = self._private.animation.current;
				}
				
				if( properties.css ){
					properties.css = style.getValueStyle( properties.css );
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

			return this; // chaining
		}, // animate

		stop: function(clearQueue, jumpToEnd){
			for( var i = 0; i < this.length; i++ ){
				var self = this[i];
				var anis = self._private.animation.current;

				for( var j = 0; j < anis.length; j++ ){
					var animation = anis[j];		
					if( jumpToEnd ){
						// next iteration of the animation loop, the animation
						// will go straight to the end and be removed
						animation.params.duration = 0; 
					}
				}
				
				// clear the queue of future animations
				if( clearQueue ){
					self._private.animation.queue = [];
				}
			}
			
			// we have to notify (the animation loop doesn't do it for us on `stop`)
			this.cy().notify({
				collection: this,
				type: "draw"
			});
			
			return this;
		}
	});
	
})( cytoscape );	
