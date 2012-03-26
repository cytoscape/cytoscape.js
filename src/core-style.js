;(function($, $$){
	
	$$.fn.core({
		
		style: function(val){
			var ret;
			
			if( val === undefined ){
				ret = $$.util.copy( this._private.style );
			} else {
				this._private.style = $$.util.copy( val );
				ret = this;
				
				this.notify({
					type: "style",
					style: this._private.style
				});
			}
			
			return ret;
		},
		
		getContinuousMapperUpdates: function(){
			var cy = this;
			var structs = cy._private;
			
			return structs.continuousMapperUpdates;
		},
		
		clearContinuousMapperUpdates: function(){
			var cy = this;
			var structs = cy._private;
			
			structs.continuousMapperUpdates = [];
		},
		
		// update continuous mapper bounds when new data is added
		addContinuousMapperBounds: function(element, name, val){
			var cy = this;
			var structs = cy._private;
			var group = element._private.group;
			
			if( $$.is.number(val) ){
				if( structs.continuousMapperBounds[ group ][ name ] == null ){
					structs.continuousMapperBounds[ group ][ name ] = {
						min: val,
						max: val,
						vals: []
					};
				}
				
				var bounds = structs.continuousMapperBounds[ group ][ name ];
				var vals = bounds.vals;
				var inserted = false;
				var oldMin = null, oldMax = null;
				
				if( vals.length > 0 ){
					oldMin = vals[0];
					oldMax = vals[ vals.length - 1 ];
				}
				
				for(var i = 0; i < vals.length; i++){
					if( val <= vals[i] ){
						vals.splice(i, 0, val);
						inserted = true;
						break;
					}
				}
				
				if(!inserted){
					vals.push(val);
				}
				
				bounds.min = vals[0];
				bounds.max = vals[vals.length - 1];
				
				if( oldMin != bounds.min || oldMax != bounds.max ){
					structs.continuousMapperUpdates.push({
						group: element.group(),
						element: element
					});
				}
			}
		},
		
		// update continuous mapper bounds for a change in data value
		updateContinuousMapperBounds: function(element, name, oldVal, newVal){
			var cy = this;
			var structs = cy._private;
			var group = element._private.group;
			var bounds = structs.continuousMapperBounds[ group ][ name ];
			
			if( bounds == null ){
				this.addContinuousMapperBounds(element, name, newVal);
				return;
			}
			
			var vals = bounds.vals;
			var oldMin = null, oldMax = null;
			
			if( vals.length > 0 ){
				oldMin = vals[0];
				oldMax = vals[ vals.length - 1 ];
			}
			
			this.removeContinuousMapperBounds(element, name, oldVal);
			this.addContinuousMapperBounds(element, name, newVal);
			
			if( oldMin != bounds.min || oldMax != bounds.max ){
				structs.continuousMapperUpdates.push({
					group: element.group(),
					element: element
				});
			}
		},
		
		// update the continuous mapper bounds for a removal of data
		removeContinuousMapperBounds: function(element, name, val){
			var cy = this;
			var structs = cy._private;
			var group = element._private.group;
			var bounds = structs.continuousMapperBounds[ group ][ name ];
			
			if( bounds == null ){
				return;
			}
			
			var oldMin = null, oldMax = null;
			var vals = bounds.vals;
			
			if( vals.length > 0 ){
				oldMin = vals[0];
				oldMax = vals[ vals.length - 1 ];
			}
			
			
			for(var i = 0; i < vals.length; i++){
				if( val == vals[i] ){
					vals.splice(i, 1);
					break;
				}
			}
			
			if( vals.length > 0 ){
				bounds.min = vals[0];
				bounds.max = vals[vals.length - 1];
			} else {
				bounds.min = null;
				bounds.max = null;
			}
		
			if( oldMin != bounds.min || oldMax != bounds.max ){
				structs.continuousMapperUpdates.push({
					group: element.group(),
					element: element
				});
			}
		}	
	});
	
})(jQuery, jQuery.cytoscapeweb);

		
		
		
		
