// type testing utility functions

;(function($$){
	
	// list of ids with other metadata assoc'd with it
	$$.instances = [];
	$$.instanceCounter = 0;
	$$.lastInstanceTime;

	$$.registerInstance = function( instance, domElement ){
		var cy;

		if( $$.is.core(instance) ){
			cy = instance;
		} else if( $$.is.domElement(instance) ){
			domElement = instance;
		}

		// if we have an old reg that is empty (no cy), then 
		var oldReg = $$.getRegistrationForInstance(instance, domElement);
		if( oldReg ){
			if( !oldReg.cy ){
				oldReg.cy = instance;
				oldReg.domElement = domElement;
			} else {
				$$.util.error('Tried to register on a pre-existing registration');
			}

			return oldReg;

		// otherwise, just make a new registration
		} else {
			var time = +new Date;
			var suffix;

			// add a suffix in case instances collide on the same time
			if( !$$.lastInstanceTime || $$.lastInstanceTime === time ){
				$$.instanceCounter = 0;
			} else {
				++$$.instanceCounter;
			}
			$$.lastInstanceTime = time;
			suffix = $$.instanceCounter;

			var id = "cy-" + time + "-" + suffix;

			// create the registration object
			var registration = {
				id: id,
				cy: cy,
				domElement: domElement,
				readies: [] // list of bound ready functions before calling init
			};

			// put the registration object in the pool
			$$.instances.push( registration );
			$$.instances[ id ] = registration;

			return registration;
		}
	};

	$$.removeRegistrationForInstance = function(instance, domElement){
		var cy;

		if( $$.is.core(instance) ){
			cy = instance;
		} else if( $$.is.domElement(instance) ){
			domElement = instance;
		}

		if( $$.is.core(cy) ){
			var id = cy._private.instanceId;
			delete $$.instances[ id ];
			$$.instances.splice(id, 1);

		} else if( $$.is.domElement(domElement) ){
			for( var i = 0; i < $$.instances.length; i++ ){
				var reg = $$.instances[i];

				if( reg.domElement === domElement ){
					delete $$.instances[ reg.id ];
					$$.instances.splice(i, 1);
					i--;
				}
			}
		}
	}

	$$.getRegistrationForInstance = function( instance, domElement ){
		var cy;

		if( $$.is.core(instance) ){
			if( instance.registered() ){ // only want it if it's registered b/c if not it has no reg'd id
				cy = instance;
			}
		} else if( $$.is.domElement(instance) ){
			domElement = instance;
		}

		if( $$.is.core(cy) ){
			var id = cy._private.instanceId;
			return $$.instances[ id ];

		} else if( $$.is.domElement(domElement) ){
			for( var i = $$.instances.length - 1; i >= 0; i-- ){ // look backwards, since most recent is the one we want
				var reg = $$.instances[i];

				if( reg.domElement === domElement ){
					return reg;
				}
			}
		}
	};
	
})( cytoscape );
