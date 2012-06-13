;(function($, $$){
	
	$$.elesfn.addClass = function(classes){
		classes = classes.split(/\s+/);
		var self = this;
		
		for( var i = 0; i < classes.length; i++ ){
			var cls = classes[i];
			if( $$.is.emptyString(cls) ){ continue; }
			
			for( var j = 0; j < self.length; j++ ){
				var ele = self[j];
				ele._private.classes[cls] = true;
			}
		}
		
		self.rtrigger("class");
		return self;
	};

	$$.elesfn.hasClass = function(className){
		var ele = this[0];
		return ele != null && ele._private.classes[className];
	};
	
	$$.elesfn.toggleClass = function(classesStr, toggle){
		var classes = classesStr.split(/\s+/);
		var self = this;
		
		for( var i = 0, il = self.length; i < il; i++ ){
			var ele = self[i];

			for( var j = 0; j < classes.length; j++ ){
				var cls = classes[j];

				if( $$.is.emptyString(cls) ){ continue; }
				
				var hasClass = ele._private.classes[cls];
				var shouldAdd = toggle || (toggle === undefined && !hasClass);

				if( shouldAdd ){
					ele._private.classes[cls] = true;
				} else { // then remove
					ele._private.classes[cls] = false;
				}

			} // for j classes
		} // for i eles
		
		self.rtrigger("class");
		return self;
	};
	
	$$.elesfn.removeClass = function(classes){
		classes = classes.split(/\s+/);
		var self = this;
		
		for( var i = 0, il = self.length; i < il; i++ ){
			var ele = self[i];

			for( var j = 0, jl = classes.length; j < jl; j++ ){
				var cls = classes[j];
				if( !cls || cls === "" ){ continue; }

				delete ele._private.classes[cls];
			}
		}
		
		self.rtrigger("class");
		return self;
	};
	
	
})(jQuery, jQuery.cytoscape);
