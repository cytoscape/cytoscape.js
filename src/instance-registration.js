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
	};

	$$.getRegistrationForInstance = function( instance ){
		var id, domElement;

		if( $$.is.domElement(instance) ){ // then find the reg by matching to the dom ele
			domElement = instance;

			for( var i = $$.instances.length - 1; i >= 0; i-- ){
				var reg = $$.instances[i];

				if( reg.domElement === domElement ){
					return reg;
				}
			}
		} else { // then just look up by id
			id = instance;

			return $$.instances[ id ];
		}
	};
	
})( cytoscape );
