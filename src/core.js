;(function($$){
	
	$$.fn.core = function( fnMap, options ){
		for( var name in fnMap ){
			var fn = fnMap[name];
			$$.Core.prototype[ name ] = fn;
		}
	};
	
	$$.Core = function( opts ){
		if( !(this instanceof $$.Core) ){
			return new $$.Core(opts);
		}

		var reg = $$.getRegistrationForInstance(opts.container);
		if( reg ){ // already registered => just update ref
			reg.cy = this;
		} else { // then we have to register
			reg = $$.registerInstance( this );
		}
		var readies = reg.readies;

		var cy = this;		

		var options = opts;
		options.layout = $$.util.extend( { name: "grid" }, options.layout );
		options.renderer = $$.util.extend( { name: "svg" }, options.renderer );
		
		if( options.container == null ){
			$$.util.error("Cytoscape.js must be called on an element");
			return;
		}
		
		this._private = {
			instanceId: reg.id, // the registered instance id (used for prev'ly reg'd ready fns)
			options: options, // cached options
			elements: [], // array of elements
			id2index: {}, // element id => index in elements array
			listeners: [], // list of listeners
			animation: { 
				// normally shouldn't use collections here, but animation is not related
				// to the functioning of Selectors, so it's ok
				elements: null // elements queued or currently animated
			},
			scratch: {}, // scratch object for core
			layout: null,
			renderer: null,
			notificationsEnabled: true, // whether notifications are sent to the renderer
			zoomEnabled: true,
			panEnabled: true,
			zoom: 1,
			pan: { x: 0, y: 0 }
		};

		// init style
		this._private.style = $$.is.stylesheet(options.style) ? options.style.generateStyle(this) : new $$.Style( cy );

		cy.initRenderer( options.renderer );

		// initial load
		cy.load(options.elements, function(){ // onready
			reg.ready = true;
			
			// bind all the ready handlers registered before creating this instance
			for( var i = 0; i < readies.length; i++ ){
				var fn = readies[i];
				cy.bind("ready", fn);
			}
			
			// if a ready callback is specified as an option, the bind it
			if( $$.is.fn( options.ready ) ){
				cy.bind("ready", options.ready);
			}

			cy.startAnimationLoop();
			
			cy.trigger("ready");
		}, options.done);
	};

	$$.corefn = $$.Core.prototype; // short alias
	

	$$.fn.core({
		getElementById: function( id ){
			var index = this._private.id2index[ id ];
			if( index !== undefined ){
				return this._private.elements[ index ];
			}

			// worst case, return an empty collection
			return new $$.Collection( this );
		},

		addToPool: function( eles ){
			var elements = this._private.elements;
			var id2index = this._private.id2index;

			for( var i = 0; i < eles.length; i++ ){
				var ele = eles[i];

				var id = ele._private.data.id;
				var index = id2index[ id ];
				var alreadyInPool = index !== undefined;

				if( !alreadyInPool ){
					index = elements.length;
					elements.push( ele )
					id2index[ id ] = index;
				}
			}

			return this; // chaining
		},

		removeFromPool: function( eles ){
			var elements = this._private.elements;
			var id2index = this._private.id2index;

			for( var i = 0; i < eles.length; i++ ){
				var ele = eles[i];

				var id = ele._private.data.id;
				var index = id2index[ id ];
				var inPool = index !== undefined;

				if( inPool ){
					delete this._private.id2index[ id ];
					elements.splice(index, 1);

					// adjust the index of all elements past this index
					for( var j = index; j < elements.length; j++ ){
						var jid = elements[j]._private.data.id;
						id2index[ jid ]--;
					}
				}
			}
		},

		container: function(){
			return this._private.options.container;
		},

		options: function(){
			return $$.util.copy( this._private.options );
		},
		
		json: function(params){
			var json = {};
			var cy = this;
			
			json.elements = {};
			cy.elements().each(function(i, ele){
				var group = ele.group();
				
				if( !json.elements[group] ){
					json.elements[group] = [];
				}
				
				json.elements[group].push( ele.json() );
			});

			json.style = cy.style();
			json.scratch = cy.scratch();
			json.zoomEnabled = cy._private.zoomEnabled;
			json.panEnabled = cy._private.panEnabled;
			json.layout = cy._private.options.layout;
			json.renderer = cy._private.options.renderer;
			
			return json;
		}
		
	});	
	
})( cytoscape );
