;(function($, $$){
	
	$$.fn.core({
		
		layout: function( params ){
			var cy = this;
			
			// if no params, use the previous ones
			if( params == null ){
				params = this._private.options.layout;
			}
			
			this.initLayout( params );
			
			cy.trigger("layoutstart");
			
			this._private.layout.run( $.extend({}, params, {
				renderer: cy._private.renderer,
				cy: cy
			}) );
			
			return this;
			
		},
		
		initLayout: function( options ){
			if( options == null ){
				$$.console.error("Layout options must be specified to run a layout");
				return;
			}
			
			if( options.name == null ){
				$$.console.error("A `name` must be specified to run a layout");
				return;
			}
			
			var name = options.name;
			var layoutProto = $$.extension("layout", name);
			
			if( layoutProto == null ){
				$$.console.error("Can not apply layout: No such layout `%s` found; did you include its JS file?", name);
				return;
			}
			
			this._private.layout = new layoutProto();
			this._private.options.layout = options; // save options
		}
		
	});
	
})(jQuery, jQuery.cytoscapeweb);