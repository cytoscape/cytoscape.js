;(function($$){

	var defaults = {
		showOverlay: true,
		hideEdgesOnViewport: false
	};
	
	var origDefaults = $$.util.copy( defaults );

	$$.defaults = function( opts ){
		defaults = $$.util.extend({}, origDefaults, opts);
	};

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
		var cy = this;

		opts = $$.util.extend({}, defaults, opts);

		var container = opts.container;
		var reg = $$.getRegistrationForInstance(cy, container);
		if( reg && reg.cy ){ 
			reg.domElement.innerHTML = '';
			reg.cy.notify({ type: 'destroy' }); // destroy the renderer

			$$.removeRegistrationForInstance(reg.cy, reg.domElement);
		} 

		reg = $$.registerInstance( cy, container );
		var readies = reg.readies;

		var options = opts;
		options.layout = $$.util.extend( { name: typeof window === 'undefined' ? "null" : "grid" }, options.layout );
		options.renderer = $$.util.extend( { name: typeof window === 'undefined' ? "null" : "canvas" }, options.renderer );
		
		// TODO determine whether we need a check like this even though we allow running headless now
		// 
		// if( !$$.is.domElement(options.container) ){
		// 	$$.util.error("Cytoscape.js must be called on an element");
		// 	return;
		// }
		
		this._private = {
			ready: false, // whether ready has been triggered
			instanceId: reg.id, // the registered instance id
			options: options, // cached options
			elements: [], // array of elements
			id2index: {}, // element id => index in elements array
			listeners: [], // list of listeners
			aniEles: [], // array of elements being animated
			scratch: {}, // scratch object for core
			layout: null,
			renderer: null,
			notificationsEnabled: true, // whether notifications are sent to the renderer
			minZoom: 1e-50,
			maxZoom: 1e50,
			zoomEnabled: options.zoomEnabled === undefined ? true : options.zoomEnabled,
			panEnabled: options.panEnabled === undefined ? true : options.panEnabled,
			boxSelectionEnabled: options.boxSelectionEnabled === undefined ? true : options.boxSelectionEnabled,
			zoom: $$.is.number(options.zoom) ? options.zoom : 1,
			pan: {
				x: $$.is.plainObject(options.pan) && $$.is.number(options.pan.x) ? options.pan.x : 0,
				y: $$.is.plainObject(options.pan) && $$.is.number(options.pan.y) ? options.pan.y : 0,
			},
			hasCompoundNodes: false
		};

		// init zoom bounds
		if( $$.is.number(options.minZoom) && $$.is.number(options.maxZoom) && options.minZoom < options.maxZoom ){
			this._private.minZoom = options.minZoom;
			this._private.maxZoom = options.maxZoom;
		} else if( $$.is.number(options.minZoom) && options.maxZoom === undefined ){
			this._private.minZoom = options.minZoom;
		} else if( $$.is.number(options.maxZoom) && options.minZoom === undefined ){
			this._private.maxZoom = options.maxZoom;
		}

		// init style
		this._private.style = $$.is.stylesheet(options.style) ? options.style.generateStyle(this) : ( $$.is.array(options.style) ? $$.style.fromJson(this, options.style) : new $$.Style( cy ) );

		cy.initRenderer( $$.util.extend({
			showOverlay: options.showOverlay,
			hideEdgesOnViewport: options.hideEdgesOnViewport
		}, options.renderer) );

		if( options.initrender ){
			cy.on('initrender', options.initrender);
		}

		// initial load
		cy.load(options.elements, function(){ // onready
			cy.startAnimationLoop();
			cy._private.ready = true;

			// if a ready callback is specified as an option, the bind it
			if( $$.is.fn( options.ready ) ){
				cy.bind("ready", options.ready);
			}

			// bind all the ready handlers registered before creating this instance
			for( var i = 0; i < readies.length; i++ ){
				var fn = readies[i];
				cy.bind("ready", fn);
			}
			reg.readies = []; // clear b/c we've bound them all and don't want to keep it around in case a new core uses the same div etc
			
			cy.trigger("ready");
		}, options.done);
	};

	$$.corefn = $$.Core.prototype; // short alias
	

	$$.fn.core({
		ready: function(){
			return this._private.ready;
		},

		registered: function(){
			if( this._private && this._private.instanceId != null ){
				return true;
			} else {
				return false;
			}
		},

		registeredId: function(){
			return this._private.instanceId;
		},

		getElementById: function( id ){
			var index = this._private.id2index[ id ];
			if( index !== undefined ){
				return this._private.elements[ index ];
			}

			// worst case, return an empty collection
			return new $$.Collection( this );
		},

		hasCompoundNodes: function(){
			return this._private.hasCompoundNodes;
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
					ele._private.index = index;
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
