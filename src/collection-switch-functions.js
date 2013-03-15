;(function($$){
	
	// Collection functions that toggle a boolean value
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	
	function defineSwitchFunction(params){
		return function(){
			var args = arguments;
			
			// e.g. cy.nodes().select( data, handler )
			if( args.length === 2 ){
				var data = args[0];
				var handler = args[1];
				this.bind( params.event, data, handler );
			} 
			
			// e.g. cy.nodes().select( handler )
			else if( args.length === 1 ){
				var handler = args[0];
				this.bind( params.event, handler );
			}
			
			// e.g. cy.nodes().select()
			else if( args.length === 0 ){
				for( var i = 0; i < this.length; i++ ){
					var ele = this[i];

					if( !params.ableField || ele._private[params.ableField] ){
						ele._private[params.field] = params.value;
					}
				}
				this.updateStyle(); // change of state => possible change of style
				this.trigger(params.event);
			}

			return this;
		};
	}
	
	function defineSwitchSet( params ){
		$$.elesfn[ params.field ] = function(){
			var ele = this[0];
			if( ele ){
				return ele._private[ params.field ];
			}
		};
		
		$$.elesfn[ params.on ] = defineSwitchFunction({
			event: params.on,
			field: params.field,
			ableField: params.ableField,
			value: true
		});

		$$.elesfn[ params.off ] = defineSwitchFunction({
			event: params.off,
			field: params.field,
			ableField: params.ableField,
			value: false
		});
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
	
	$$.elesfn.grabbed = function(){
		var ele = this[0];
		if( ele ){
			return ele._private.grabbed;
		}
	};

	$$.elesfn.active = function(){
		var ele = this[0];
		if( ele ){
			return ele._private.active;
		}
	};

	$$.elesfn.inactive = function(){
		var ele = this[0];
		if( ele ){
			return !ele._private.active;
		}
	};
	
})( cytoscape );
