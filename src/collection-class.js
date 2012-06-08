;(function($, $$){
	
	$$.fn.collection({
		addClass: function(classes){
			classes = classes.split(/\s+/);
			var self = this;
			
			for( var i = 0, il = classes.length; i < il; i++ ){
				var cls = classes[i];
				if( $$.is.emptyString(cls) ){ continue; }
				
				for( var j = 0, jl = self.length; j < jl; j++ ){
					var ele = self[j];
					ele._private.classes[cls] = true;
				}
			}
			
			self.rtrigger("class");
			return self;
		}
	});
	
	$$.fn.collection({	
		hasClass: function(className){
			var ele = this[0];
			return ele != null && ele._private.classes[className];
		}
	});
	
	$$.fn.collection({
		toggleClass: function(classesStr, toggle){
			var classes = classesStr.split(/\s+/);
			var self = this;
			var toggledElements = [];
			
			for( var i = 0, il = self.length; i < il; i++ ){
				var ele = self[i];

				for( var j = 0, jl = classes.length; j < jl; j++ ){
					var cls = classes[j];

					if( !cls || cls === "" ){ continue; }
					
					var hasClass = ele._private.classes[cls];
					var shouldAdd = toggle || (toggle === undefined && !hasClass);
					var toggled = false;

					if( shouldAdd ){
						toggled = hasClass;
						ele._private.classes[cls] = true;
					} else { // then remove
						toggled = !hasClass;
						ele._private.classes[cls] = false;
					}

					if( toggled ){
						toggledElements.push( ele );
					}
				} // for j classes
			} // for i eles
			
			if( toggledElements.length > 0 ){
				var collection = new $$.CyCollection( self.cy(), toggledElements );
				collection.rtrigger("class");
			}
			
			return self;
		}
	});
	
	$$.fn.collection({
		removeClass: function(classes){
			classes = classes.split(/\s+/);
			var self = this;
			var removedElements = [];
			
			for( var i = 0, il = self.length; i < il; i++ ){
				var ele = self[i];

				for( var j = 0, jl = classes.length; j < jl; j++ ){
					var cls = classes[j];
					if( !cls || cls === "" ){ continue; }

					var hasClass = ele._private.classes[cls];
					var removed = hasClass;
					delete ele._private.classes[cls];
					
					if( removed ){
						removedElements.push( ele );
					}
				}
			}
			
			if( removedElements.length > 0 ){
				var collection = new $$.CyCollection( self.cy(), removedElements );
				collection.rtrigger("class");
			}
			
			return self;
		}
	});
	
	
})(jQuery, jQuery.cytoscape);
