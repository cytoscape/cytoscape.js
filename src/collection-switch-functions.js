;(function($, $$){
	
	// Collection functions that toggle a boolean value
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	
	function defineSwitchFunction(params){
		return function(){
			var args = arguments;
			
			// e.g. cy.nodes().select( data, handler )
			if( args.length == 2 ){
				this.bind( params.event, args[0], args[1] );
			} 
			
			// e.g. cy.nodes().select( handler )
			else if( args.length == 1 ){
				this.bind( params.event, args[0] );
			}
			
			// e.g. cy.nodes().select()
			else if( args.length == 0 ){
				var selected = new $$.Collection( this.cy() );
				
				this.each(function(){
					if( params.ableField == null || this.element()._private[params.ableField] ){
						this.element()._private[params.field] = params.value;
						
						selected = selected.add( this );
					}
				});
				selected.rtrigger(params.event);
			}

			return this;
		};
	}
	
	function defineSwitchSet( params ){
		function impl(name, fn){
			var impl = {};
			impl[ name ] = fn;
			
			return impl;
		}
		
		$$.fn.collection(
			impl( params.field, function(){
				var ele = this.element();
				if( ele != null ){
					return ele._private[ params.field ];
				}
			})
		);
		
		$$.fn.collection(
			impl( params.on, defineSwitchFunction({
					event: params.on,
					field: params.field,
					ableField: params.ableField,
					value: true
				})
			)
		);
	
		$$.fn.collection(
			impl( params.off, defineSwitchFunction({
					event: params.off,
					field: params.field,
					ableField: params.ableField,
					value: false
				})
			)
		);
	}
	
	defineSwitchSet({
		field: "locked",
		on: "lock",
		off: "unlock"
	});
	
	defineSwitchSet({
		field: "grabbable",
		on: "grabify",
		off: "ungrabify"
	});
	
	defineSwitchSet({
		field: "selected",
		ableField: "selectable",
		on: "select",
		off: "unselect"
	});
	
	defineSwitchSet({
		field: "selectable",
		on: "selectify",
		off: "unselectify"
	});
	
	$$.fn.collection({
		grabbed: function(){
			var ele = this.element();
			if( ele != null ){
				return ele._private.grabbed;
			}
		}
	});
	
})(jQuery, jQuery.cytoscape);
