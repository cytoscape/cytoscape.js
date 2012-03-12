;(function($, $$){
	
	$$.fn.collection({
		name: "data",
		
		impl: function(attr, val){
			// get whole field
			if( attr === undefined ){
				return $$.util.copy( this.eq(0).element()._private.data );
			}
			
			if( attr == "id" && val !== undefined ){
				$$.console.error("Can not change ID of collection with element with group `%s` and ID `%s`", this.element()._private.group, this.element()._private.data.id);
				return this;
			}
			
			// bind to event
			else if( $$.is.fn(attr) ){
				var handler = attr;
				
				this.bind("data", handler);
				return this;
			}
			
			// bind to event with data
			else if( $$.is.fn(val) ){
				var data = attr;
				var handler = val;
				
				this.bind("data", data, handler);
				return this;
			}
			
			// set whole field from obj
			else if( $$.is.plainObject(attr) ){
				var newValObj = attr;
				
				this.each(function(){
					for(var field in newValObj){
						var val = newValObj[field];
						
						if( field == "id" || ( this._private.group == "edges" && ( field == "source" || field == "target" ) ) ){
							$$.console.error("Can not change immutable field `%s` for element with group `%s` and ID `%s` to `%o`", field, this._private.group, this._private.data.id, val);
						} else {
							this.cy().updateContinuousMapperBounds(this, field, this._private.data[field], val);
							this._private.data[field] = $$.util.copy( val );
						}
					}
				});
				
				this.rtrigger("data");
				return this;
			} 
			
			// get attr val by name
			else if( val === undefined ){
				var ret = this.element()._private.data[ attr ];
				ret =  ( $$.is.plainObject(ret) ? $$.util.copy(ret) : ret );
				
				return ret;
			}
			
			// set attr val by name
			else {
				if( attr == "id" ){
					$$.console.error("Can not change `%s` of element with ID `%s` --- you can not change IDs", attr, this.element()._private.data.id);
					return this;
				}
				
				if( attr == "source" || attr == "target" ){
					$$.console.error("Can not change `%s` of collection with element with ID `%s` --- you can not change IDs", attr, this._private.data.id);
					return this;
				}
				
				this.each(function(){
					var oldVal = this._private.data[ attr ];
					this._private.data[ attr ] = ( $$.is.plainObject(val) ? $$.util.copy(val) : val );
					this.cy().updateContinuousMapperBounds(this, attr, oldVal, val);
				});
				
				this.rtrigger("data");
				return this;
			}
			
			return this; // just in case
		}
	});
	
	$$.fn.collection({
		name: "removeData",
		
		impl: function(field){
			if( field == undefined ){
				
				// delete all non-essential data
				this.each(function(){
					var oldData = this._private.data;
					var self = this;
					
					$.each(this._private.data, function(attr, val){
						self.cy().removeContinuousMapperBounds(self, attr, val);
					});
					
					if( this.isNode() ){
						this._private.data = {
							id: oldData.id
						};
					} else if( this.isEdge() ){
						this._private.data = {
							id: oldData.id,
							source: oldData.source,
							target: oldData.target
						};
					}
				});
				
			} else {
				// delete only one field
				
				if( field == "id" ){
					$$.console.error("You can not delete the `id` data field; tried to delete on collection with element with group `%s` and ID `%s`", this.element()._private.group, this.element()._private.data.id);
					return this;
				}
				
				if( field == "source" || field == "target" ){
					$$.console.error("You can not delete the `%s` data field; tried to delete on collection with element `%s`", field, this.element()._private.data.id);
					return this;
				} 
				
				this.each(function(){
					this.cy().removeContinuousMapperBounds(this, field, this._private.data[field]);
					delete this._private.data[field];
				});
			}
			
			this.rtrigger("data");
			return this;
		}
	});
	
})(jQuery, jQuery.cytoscapeweb);


CyElement.prototype.position = function(val){
	
	var self = this;
	
	if( val === undefined ){
		if( this.isNode() ){
			return $$.util.copy( this._private.position );
		} else {
			$$.console.warn("Can not get position for edge with ID `%s`; edges have no position", this._private.data.id);
			return null;
		}
	} else if( $$.is.fn(val) ){
		var fn = val;
		this.bind("position", fn);
	} else if( this.isEdge() ){
		$$.console.warn("Can not move edge with ID `%s`; edges can not be moved", this._private.data.id);
	} else if( this.locked() ) {
		$$.console.warn("Can not move locked node with ID `%s`", this._private.data.id);
	} else if( $$.is.string(val) ) {
		var param = arguments[0];
		var value = arguments[1];
		
		if( value === undefined ){
			 return this._private.position[param];
		} else {
			this._private.position[param] = $$.util.copy(value);
		}
	} else if( $$.is.plainObject(val) ) {
		$.each(val, function(k, v){
			self._private.position[k] = $$.util.copy( v );
		});
		this.rtrigger("position");
	} else {
		$$.console.error("Can not set position on node `%s` with non-object `%o`", this._private.data.id, val);
	}
	
	return this;
	
};

CyElement.prototype.positions = function(fn){
	var positionOpts = fn.apply(this, [0, this]);
	
	if( $$.is.plainObject(positionOpts) ){
		this.position(positionOpts);
	}
};

CyElement.prototype.renderedPosition = function(coord, val){
	if( this.isEdge() ){
		$.cytoscapeweb("warn", "Can not access rendered position for edge `" + this._private.data.id + "`; edges have no position");
		return null;
	}
	var renderer = this.cy().renderer(); // TODO remove reference after refactoring
	
	var pos = renderer.renderedPosition(this);
	
	if( coord === undefined ){
		return pos;
	} else if( $$.is.string(coord) ) {
		if( val === undefined ){
			return pos[coord];
		} else {
			pos[coord] = val;
			this.position( renderer.modelPoint(pos) );
		}
	} else if( $$.is.plainObject(coord) ){
		pos = $.extend(true, {}, pos, coord);
		this.position( renderer.modelPoint(pos) );
	}
	
	return this;
};

CyElement.prototype.renderedDimensions = function(dimension){
	var renderer = this.cy().renderer(); // TODO remove reference after refactoring
	var dim = renderer.renderedDimensions(this);
	
	if( dimension === undefined ){
		return dim;
	} else {
		return dim[dimension];
	}
};

CyElement.prototype.style = function(){
	// the renderer should populate this field and keep it up-to-date
	return $$.util.copy( this._private.style );
};

function setterGetterFunction(params){
		return function(key, val){

			// bind to event
			if( $$.is.fn(key) ){
				var handler = key;
				this.bind(params.event, handler);
			}
			
			// bind to event with data
			else if( $$.is.fn(val) ){
				var data = key;
				var handler = val;
				this.bind(params.event, data, handler);
			}
			
			// set or get field with key
			else if( $$.is.string(key) ){
				if( val === undefined ){
					return $$.util.copy( this._private[params.field][key] );
				} else {
					this._private[params.field][key] = $$.util.copy( val );
					this.rtrigger(params.event);
				}
			}
			
			// update via object
			else if( $$.is.plainObject(key) ) {
				var map = key;
				var current = this._private[params.field];
				
				this._private[params.field] = $.extend(true, {}, current, map);
				this.rtrigger(params.event);
			}
			
			// return the whole object
			else if( key === undefined ){
				return $$.util.copy( this._private[params.field] );
			}
			
			return this;
		};
	};
	
	function removerFunction(params){
		return function(key){
			var self = this;
			
			// remove all
			if( key === undefined ){
				this._private[params.field] = {};
			}
			
			else {
				var keys = key.split(/\s+/);
				for(var i = 0; i < keys.length; i++){
					delete this._private[params.field][ keys[i] ];
				}
			}
				
			if( params.event != null ){
				this.rtrigger(params.event);
			}					
			
			return this;
		};
	};
	
	CyElement.prototype.removeBypass = removerFunction({ field: "bypass", event: "bypass" });
	CyElement.prototype.bypass = setterGetterFunction({ field: "bypass", event: "bypass" });

	CyCollection.prototype.positions = function(fn){
		
		var collection = this;
		
		this.cy().noNotifications(function(){
			collection.each(function(i, element){
				var positionOpts = fn.apply(element, [i, element]);
				
				if( $$.is.plainObject(positionOpts) ){
					element.position(positionOpts);
				}
			});
		});

		this.cy().notify({
			type: "position",
			collection: this
		});
	};
	