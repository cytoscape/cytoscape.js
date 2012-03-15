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
				this.each(function(){
					this.element()._private[params.field] = params.value;
				});
				this.rtrigger(params.event);
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
				return this.element()._private[ params.field ];
			})
		);
		
		$$.fn.collection(
			impl( params.on, defineSwitchFunction({
					event: params.on,
					field: params.field,
					value: true
				})
			)
		);
	
		$$.fn.collection(
			impl( params.off, defineSwitchFunction({
					event: params.off,
					field: params.field,
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
		on: "select",
		off: "unselect"
	});
	
	$$.fn.collection({
		grabbed: function(){
			return this.element()._private.grabbed;
		}
	});
	
})(jQuery, jQuery.cytoscapeweb);
