CyElement.prototype.animated = function(){
		return this._private.animation.current.length > 0;
	};
	
	CyElement.prototype.clearQueue = function(){
		this._private.animation.queue = [];
	};
	
	CyElement.prototype.delay = function( time ){
		this.animate({
			delay: time
		}, {
			duration: time
		});
		
		return this;
	};
	
	CyElement.prototype.animate = function( properties, params ){
		var self = this;
		var callTime = +new Date;
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
		
		return this;
	};
	
	CyElement.prototype.stop = function(clearQueue, jumpToEnd){
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

		// we have to notify (the animation loop doesn't do it for us on `stop`)
		({
			collection: self.collection(),
			type: "draw"
		});
		
		return this;
	};
	
	CyElement.prototype.show = function(){
		this.cy().renderer().showElements(this.collection());
		
		return this;
	};
	
	CyElement.prototype.hide = function(){
		this.cy().renderer().hideElements(this.collection());
		
		return this;
	};
	
	CyElement.prototype.visible = function(){
		return this.cy().renderer().elementIsVisible(this);
	};