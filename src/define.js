;(function($$){
	
	// metaprogramming makes me happy

	// use this module to cherry pick functions into your prototype
	// (useful for functions shared between the core and collections, for example)

	// e.g.
	// $$.fn.collection({
	//   foo: $$.define.foo({ /* params... */ })
	// });

	$$.define = {

		// access data field
		data: function( params ){
			var defaults = { 
				field: "data",
				bindingEvent: "data",
				allowBinding: false,
				allowSetting: false,
				allowGetting: false,
				settingEvent: "data",
				settingTriggersEvent: false,
				triggerFnName: "trigger",
				immutableKeys: {}, // key => true if immutable
				updateMappers: false
			};
			params = $$.util.extend({}, defaults, params);

			return function( name, value ){
				var p = params;
				var self = this;
				var selfIsArrayLike = self.length !== undefined;
				var all = selfIsArrayLike ? self : [self]; // put in array if not array-like
				var single = selfIsArrayLike ? self[0] : self;

				// .data("foo", ...)
				if( $$.is.string(name) ){ // set or get property

					// .data("foo")
					if( p.allowGetting && value === undefined ){ // get

						var ret;
						if( single ){
							ret = single._private[ p.field ][ name ];
						}
						return ret;
					
					// .data("foo", "bar")
					} else if( p.allowSetting && value !== undefined ) { // set
						var valid = !p.immutableKeys[name];
						if( valid ){

							for( var i = 0, l = all.length; i < l; i++ ){
								all[i]._private[ p.field ][ name ] = value;
							}

							// update mappers if asked
							if( p.updateMappers ){ self.updateMappers(); }

							if( p.settingTriggersEvent ){
								self[ p.triggerFnName ]( p.settingEvent );
							}
						}
					}

				// .data({ "foo": "bar" })
				} else if( p.allowSetting && $$.is.plainObject(name) ){ // extend
					var obj = name;
					var k, v;

					for( k in obj ){
						v = obj[ k ];

						var valid = !p.immutableKeys[k];
						if( valid ){
							for( var i = 0, l = all.length; i < l; i++ ){
								all[i]._private[ p.field ][ k ] = v;
							}
						}
					}
					
					// update mappers if asked
					if( p.updateMappers ){ self.updateMappers(); }

					if( p.settingTriggersEvent ){
						self[ p.triggerFnName ]( p.settingEvent );
					}
				
				// .data(function(){ ... })
				} else if( p.allowBinding && $$.is.fn(name) ){ // bind to event
					var fn = name;
					self.bind( p.bindingEvent, fn );
				
				// .data()
				} else if( p.allowGetting && name === undefined ){ // get whole object
					var ret;
					if( single ){
						ret = single._private[ p.field ];
					}
					return ret;
				}

				return self; // maintain chainability
			}; // function
		}, // data

		batchData: function( params ){
			var defaults = {
				field: "data",
				event: "data",
				triggerFnName: "trigger",
				immutableKeys: {}, // key => true if immutable
				updateMappers: false
			};
			var p = params = $$.util.extend({}, defaults, params);

			return function( map ){
				var self = this;
				var selfIsArrayLike = self.length !== undefined;
				var eles = selfIsArrayLike ? self : self._private.elements;

				if( eles.length === 0 ){ return self; }
				var cy = selfIsArrayLike ? eles[0]._private.cy : self; // NB must have at least 1 ele to get cy
				
				for( var i = 0; i < eles.length; i++ ){
					var ele = eles[i];
					var id = ele._private.data.id;
					var mapData = map[id];

					if( mapData !== undefined && mapData !== null ){
						var obj = mapData;
						var k, v;

						// set the (k, v) pairs from the map
						for( k in obj ){
							v = obj[ k ];

							var valid = !p.immutableKeys[k];
							if( valid ){
								ele._private[ p.field ][ k ] = v;
							}
						}
					} // if
				} // for

				// update mappers if asked
				var coln = new $$.Collection(cy, eles);
				if( p.updateMappers ){ coln.updateMappers(); }

				coln[ p.triggerFnName ]( p.event );

				return self; // chaining
			};
		},

		// remove data field
		removeData: function( params ){
			var defaults = { 
				field: "data",
				event: "data",
				triggerFnName: "trigger",
				triggerEvent: false,
				immutableKeys: {} // key => true if immutable
			};
			params = $$.util.extend({}, defaults, params);

			return function( names ){
				var p = params;
				var self = this;
				var selfIsArrayLike = self.length !== undefined;
				var all = selfIsArrayLike ? self : [self]; // put in array if not array-like
				var single = selfIsArrayLike ? self[0] : self;
				
				// .removeData("foo bar")
				if( $$.is.string(names) ){ // then get the list of keys, and delete them
					var keys = names.split(/\s+/);
					var l = keys.length;

					for( var i = 0; i < l; i++ ){ // delete each non-empty key
						var key = keys[i];
						if( $$.is.emptyString(key) ){ continue; }

						var valid = !p.immutableKeys[ key ]; // not valid if immutable
						if( valid ){
							for( var i_a = 0, l_a = all.length; i_a < l_a; i_a++ ){
								delete all[ i_a ]._private[ p.field ][ key ];
							}
						}
					}

					if( p.triggerEvent ){
						self[ p.triggerFnName ]( p.event );
					}

				// .removeData()
				} else if( names === undefined ){ // then delete all keys

					for( var i_a = 0, l_a = all.length; i_a < l_a; i_a++ ){
						var _privateFields = all[ i_a ]._private[ p.field ];
						
						for( var key in _privateFields ){
							var validKeyToDelete = !p.immutableKeys[ key ];

							if( validKeyToDelete ){
								delete _privateFields[ key ];
							}
						}
					}

					if( p.triggerEvent ){
						self[ p.triggerFnName ]( p.event );
					}
				}

				return self; // maintain chaining
			}; // function
		}, // removeData

		// event function reusable stuff
		event: {
			regex: /(\w+)(\.\w+)?/, // regex for matching event strings (e.g. "click.namespace")
			optionalTypeRegex: /(\w+)?(\.\w+)?/,

			// properties to copy to the event obj
			props: "altKey bubbles button cancelable charCode clientX clientY ctrlKey currentTarget data detail eventPhase metaKey offsetX offsetY originalTarget pageX pageY prevValue relatedTarget screenX screenY shiftKey target view which".split(/\s+/),

			aliases: "mousedown mouseup click mouseover mouseout mousemove touchstart touchmove touchend grab drag free".split(/\s+/),

			aliasesOn: function( thisPrototype ){

				var aliases = $$.define.event.aliases;
				for( var i = 0; i < aliases.length; i++ ){
					var eventType = aliases[i];

					(function(eventType){
						thisPrototype[ eventType ] = function(data, callback){
							if( $$.is.fn(callback) ){
								this.on(eventType, data, callback);

							} else if( $$.is.fn(data) ){
								callback = data;
								this.on(eventType, callback);

							} else {
								this.trigger(eventType);
							}

							return this; // maintain chaining
						};
					})( eventType );
				}
			},

			falseCallback: function(){ return false; }
		},

		// event binding
		on: function( params ){
			var defaults = {
				unbindSelfOnTrigger: false,
				unbindAllBindersOnTrigger: false
			};
			params = $$.util.extend({}, defaults, params);
			
			return function(events, selector, data, callback){
				var self = this;
				var selfIsArrayLike = self.length !== undefined;
				var all = selfIsArrayLike ? self : [self]; // put in array if not array-like
				var single = selfIsArrayLike ? self[0] : self;
				var eventsIsString = $$.is.string(events);
				var p = params;

				if( $$.is.plainObject(selector) ){ // selector is actually data
					callback = data;
					data = selector;
					selector = undefined;
				} else if( $$.is.fn(selector) || selector === false ){ // selector is actually callback
					callback = selector;
					data = undefined;
					selector = undefined;
				}

				if( $$.is.fn(data) || data === false ){ // data is actually callback
					callback = data;
					data = undefined;
				}

				// if there isn't a callback, we can't really do anything
				// (can't speak for mapped events arg version)
				if( !($$.is.fn(callback) || callback === false) && eventsIsString ){
					return self; // maintain chaining
				}

				if( eventsIsString ){ // then convert to map
					var map = {};
					map[ events ] = callback;
					events = map;
				}

				for( var evts in events ){
					callback = events[evts];
					if( callback === false ){
						callback = $$.define.event.falseCallback;
					}

					if( !$$.is.fn(callback) ){ continue; }

					evts = evts.split(/\s+/);
					for( var i = 0; i < evts.length; i++ ){
						var evt = evts[i];
						if( $$.is.emptyString(evt) ){ continue; }

						var match = evt.match( $$.define.event.regex ); // type[.namespace]

						if( match ){
							var type = match[1];
							var namespace = match[2] ? match[2] : undefined;

							var listener = {
								callback: callback, // callback to run
								data: data, // extra data in eventObj.data
								delegated: selector ? true : false, // whether the evt is delegated
								selector: selector, // the selector to match for delegated events
								type: type, // the event type (e.g. "click")
								namespace: namespace, // the event namespace (e.g. ".foo")
								unbindSelfOnTrigger: p.unbindSelfOnTrigger,
								unbindAllBindersOnTrigger: p.unbindAllBindersOnTrigger,
								binders: all // who bound together
							};

							for( var j = 0; j < all.length; j++ ){
								all[j]._private.listeners.push( listener );
							}
						}
					} // for events array
				} // for events map
				
				return self; // maintain chaining
			}; // function
		}, // on

		off: function( params ){
			var defaults = {
			};
			params = $$.util.extend({}, defaults, params);
			
			return function(events, selector, callback){
				var self = this;
				var selfIsArrayLike = self.length !== undefined;
				var all = selfIsArrayLike ? self : [self]; // put in array if not array-like
				var single = selfIsArrayLike ? self[0] : self;
				var eventsIsString = $$.is.string(events);
				var p = params;

				if( arguments.length === 0 ){ // then unbind all

					for( var i = 0; i < all.length; i++ ){
						all[i]._private.listeners = [];
					}

					return self; // maintain chaining
				}

				if( $$.is.fn(selector) || selector === false ){ // selector is actually callback
					callback = selector;
					selector = undefined;
				}

				if( eventsIsString ){ // then convert to map
					var map = {};
					map[ events ] = callback;
					events = map;
				}

				for( var evts in events ){
					callback = events[evts];

					if( callback === false ){
						callback = $$.define.event.falseCallback;
					}

					evts = evts.split(/\s+/);
					for( var h = 0; h < evts.length; h++ ){
						var evt = evts[h];
						if( $$.is.emptyString(evt) ){ continue; }

						var match = evt.match( $$.define.event.optionalTypeRegex ); // [type][.namespace]
						if( match ){
							var type = match[1] ? match[1] : undefined;
							var namespace = match[2] ? match[2] : undefined;

							for( var i = 0; i < all.length; i++ ){ //
								var listeners = all[i]._private.listeners;

								for( var j = 0; j < listeners.length; j++ ){
									var listener = listeners[j];
									var nsMatches = !namespace || namespace === listener.namespace;
									var typeMatches = !type || listener.type === type;
									var cbMatches = !callback || callback === listener.callback;
									var listenerMatches = nsMatches && typeMatches && cbMatches;

									// delete listener if it matches
									if( listenerMatches ){
										listeners.splice(j, 1);
										j--;
									}
								} // for listeners
							} // for all
						} // if match
					} // for events array

				} // for events map
				
				return self; // maintain chaining
			}; // function
		}, // off

		trigger: function( params ){
			var defaults = {};
			params = $$.util.extend({}, defaults, params);
			
			return function(events, extraParams, fnToTrigger){
				var self = this;
				var selfIsArrayLike = self.length !== undefined;
				var all = selfIsArrayLike ? self : [self]; // put in array if not array-like
				var single = selfIsArrayLike ? self[0] : self;
				var eventsIsString = $$.is.string(events);
				var eventsIsObject = $$.is.plainObject(events);
				var eventsIsEvent = $$.is.event(events);
				var p = params;
				var cy = this._private.cy || this;

				if( eventsIsString ){ // then make a plain event object for each event name
					var evts = events.split(/\s+/);
					events = [];

					for( var i = 0; i < evts.length; i++ ){
						var evt = evts[i];
						if( $$.is.emptyString(evt) ){ continue; }

						var match = evt.match( $$.define.event.regex ); // type[.namespace]
						var type = match[1];
						var namespace = match[2] ? match[2] : undefined;

						events.push( {
							type: type,
							namespace: namespace
						} );
					}
				} else if( eventsIsObject ){ // put in length 1 array
					var eventArgObj = events;

					events = [ eventArgObj ];
				}

				if( extraParams ){
					if( !$$.is.array(extraParams) ){ // make sure extra params are in an array if specified
						extraParams = [ extraParams ];
					}
				} else { // otherwise, we've got nothing
					extraParams = [];
				}

				for( var i = 0; i < events.length; i++ ){ // trigger each event in order
					var evtObj = events[i];
					
					for( var j = 0; j < all.length; j++ ){ // for each
						var triggerer = all[j];
						var listeners = triggerer._private.listeners;
						var triggererIsElement = $$.is.element(triggerer);
						var bubbleUp = triggererIsElement;

						// create the event for this element from the event object
						var evt;

						if( eventsIsEvent ){ // then just get the object
							evt = evtObj;
							
							evt.cyTarget = evt.cyTarget || triggerer;
							evt.cy = evt.cy || cy;
							evt.namespace = evt.namespace || evtObj.namespace;

						} else { // then we have to make one
							evt = new $$.Event( evtObj, {
								cyTarget: triggerer,
								cy: cy,
								namespace: evtObj.namespace
							} );

							// copy properties like jQuery does
							var props = $$.define.event.props;
							for( var k = 0; k < props.length; k++ ){
								var prop = props[k];
								evt[ prop ] = evtObj[ prop ];
							}
						}

						if( fnToTrigger ){ // then override the listeners list with just the one we specified
							listeners = [{
								namespace: evt.namespace,
								type: evt.type,
								callback: fnToTrigger
							}];
						}

						for( var k = 0; k < listeners.length; k++ ){ // check each listener
							var lis = listeners[k];
							var nsMatches = !lis.namespace || lis.namespace === evt.namespace;
							var typeMatches = lis.type === evt.type;
							var targetMatches = lis.delegated ? ( triggerer !== evt.cyTarget && $$.is.element(evt.cyTarget) && evt.cyTarget.is(lis.selector) ) : (true); // we're not going to validate the hierarchy; that's too expensive
							var listenerMatches = nsMatches && typeMatches && targetMatches;

							if( listenerMatches ){ // then trigger it
								var args = [ evt ];
								args = args.concat( extraParams ); // add extra params to args list

								if( lis.data ){ // add on data plugged into binding
									evt.data = lis.data;
								} else { // or clear it in case the event obj is reused
									evt.data = undefined;
								}

								if( lis.unbindSelfOnTrigger || lis.unbindAllBindersOnTrigger ){ // then remove listener
									listeners.splice(k, 1);
									k--;
								}

								if( lis.unbindAllBindersOnTrigger ){ // then delete the listener for all binders
									var binders = lis.binders;
									for( var l = 0; l < binders.length; l++ ){
										var binder = binders[l];
										if( !binder || binder === triggerer ){ continue; } // already handled triggerer or we can't handle it

										var binderListeners = binder._private.listeners;
										for( var m = 0; m < binderListeners.length; m++ ){
											var binderListener = binderListeners[m];

											if( binderListener === lis ){ // delete listener from list
												binderListeners.splice(m, 1);
												m--;
											}
										}
									}
								}

								// run the callback
								var context = lis.delegated ? evt.cyTarget : triggerer;
								var ret = lis.callback.apply( context, args );

								if( ret === false || evt.isPropagationStopped() ){
									// then don't bubble
									bubbleUp = false;

									if( ret === false ){
										// returning false is a shorthand for stopping propagation and preventing the def. action
										evt.stopPropagation();
										evt.preventDefault();
									}
								}
							} // if listener matches
						} // for each listener

						// bubble up event for elements
						if( bubbleUp ){
							var parent = triggerer.parent();
							var hasParent = parent.length !== 0;

							if( hasParent ){ // then bubble up to parent
								parent = parent[0];
								parent.trigger(evt);
							} else { // otherwise, bubble up to the core
								cy.trigger(evt);
							}
						}

					} // for each of all
				} // for each event
				
				return self; // maintain chaining
			}; // function
		} // trigger

	}; // define

	
})( cytoscape );
