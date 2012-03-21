(function($, $$){
	
	$$.fn.core({
		notify: function( params ){
			var renderer = this.renderer();
			
			if( $$.is.element(params.collection) ){
				var element = params.collection;
				params.collection = new $$.CyCollection(cy, [ element ]);	
			
			} else if( $$.is.array(params.collection) ){
				var elements = params.collection;
				params.collection = new $$.CyCollection(cy, elements);	
			} 
			
			if( this.getContinuousMapperUpdates().length != 0 ){
				params.updateMappers = true;
				this.clearContinuousMapperUpdates();
			}
			
			renderer.notify(params);
		},
		
		notifications: function( bool ){
			var p = this._private;
			
			if( bool === undefined ){
				return p.notificationsEnabled;
			} else {
				p.notificationsEnabled = bool ? true : false;
			}
		},
		
		noNotifications: function( callback ){
			this.notifications(false);
			callback();
			this.notifications(true);
		}
	});
	
})(jQuery, jQuery.cytoscapeweb);
