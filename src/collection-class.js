;(function($, $$){
	
	$$.fn.collection({
		name: "addClass",
		
		impl: function(classes){
			classes = classes.split(/\s+/);
			var self = this;
			var addedElements = [];
			
			$.each(classes, function(i, cls){
				if( cls == null || cls == "" ){ return; }
				
				self.each(function(){
					var added = this._private.classes[cls] === undefined;
					this._private.classes[cls] = true;
					
					if( added ){
						addedElements.push( this );
					}
				});
			});
			
			if( addedElements.length > 0 ){
				var collection = new $$.CyCollection(self.cy(), addedElements);
				collection.rtrigger("class");
			}
			
			return self;
		}
	});
	
	$$.fn.collection({
		name: "hasClass",
		
		impl: function(className){
			return this.element()._private.classes[className] == true;
		}
	});
	
	$$.fn.collection({
		name: "toggleClass",
		
		impl: function(classesStr, toggle){
			var classes = classesStr.split(/\s+/);
			var self = this;
			var toggledElements = [];
			
			function remove(self, cls){
				var toggled = self._private.classes[cls] !== undefined;
				delete self._private.classes[cls];
				
				if( toggled ){
					toggledElements.push( self );
				}
			}
			
			function add(self, cls){
				var toggled = self._private.classes[cls] === undefined;
				self._private.classes[cls] = true;
				
				if( toggled ){
					toggledElements.push( self );
				}
			}
			
			self.each(function(){
				var self = this;
				
				$.each(classes, function(i, cls){
					if( cls == null || cls == "" ){ return; }
					
					if( toggle === undefined ){
						if( self.hasClass(cls) ){
							remove(self, cls);
						} else {
							add(self, cls);
						}
					} else if( toggle ){
						add(self, cls);
					} else {
						remove(self, cls);
					}
				});
			});
			
			if( toggledElements.length > 0 ){
				var collection = new $$.CyCollection( self.cy(), toggledElements );
				collection.rtrigger("class");
			}
			
			return self;
		}
	});
	
	$$.fn.collection({
		name: "removeClass",
		
		impl: function(classes){
			classes = classes.split(/\s+/);
			var self = this;
			var removedElements = [];
			
			$.each(classes, function(i, cls){
				if( cls == null || cls == "" ){ return; }
				
				self.each(function(){
					var removed = this._private.classes[cls] !== undefined;
					delete this._private.classes[cls];
					
					if( removed ){
						removedElements.push( this );
					}
				});
			});
			
			if( removedElements.length > 0 ){
				var collection = new $$.CyCollection( self.cy(), removedElements );
				collection.rtrigger("class");
			}
			
			return self;
		}
	});
	
	
})(jQuery, jQuery.cytoscapeweb);
