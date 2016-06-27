'use strict';

// use this module to cherry pick functions into your prototype
// (useful for functions shared between the core and collections, for example)

// e.g.
// var foo = define.foo({ /* params... */ })

var util = require( './util' );
var is = require( './is' );
var Selector = require( './selector' );
var Promise = require( './promise' );
var Event = require( './event' );
var Animation = require( './animation' );

var define = {

  // access data field
  data: function( params ){
    var defaults = {
      field: 'data',
      bindingEvent: 'data',
      allowBinding: false,
      allowSetting: false,
      allowGetting: false,
      settingEvent: 'data',
      settingTriggersEvent: false,
      triggerFnName: 'trigger',
      immutableKeys: {}, // key => true if immutable
      updateStyle: false,
      onSet: function( self ){},
      canSet: function( self ){ return true; }
    };
    params = util.extend( {}, defaults, params );

    return function dataImpl( name, value ){
      var p = params;
      var self = this;
      var selfIsArrayLike = self.length !== undefined;
      var all = selfIsArrayLike ? self : [ self ]; // put in array if not array-like
      var single = selfIsArrayLike ? self[0] : self;

      // .data('foo', ...)
      if( is.string( name ) ){ // set or get property

        // .data('foo')
        if( p.allowGetting && value === undefined ){ // get

          var ret;
          if( single ){
            ret = single._private[ p.field ][ name ];
          }
          return ret;

        // .data('foo', 'bar')
        } else if( p.allowSetting && value !== undefined ){ // set
          var valid = !p.immutableKeys[ name ];
          if( valid ){
            for( var i = 0, l = all.length; i < l; i++ ){
              if( p.canSet( all[ i ] ) ){
                all[ i ]._private[ p.field ][ name ] = value;
              }
            }

            // update mappers if asked
            if( p.updateStyle ){ self.updateStyle(); }

            // call onSet callback
            p.onSet( self );

            if( p.settingTriggersEvent ){
              self[ p.triggerFnName ]( p.settingEvent );
            }
          }
        }

      // .data({ 'foo': 'bar' })
      } else if( p.allowSetting && is.plainObject( name ) ){ // extend
        var obj = name;
        var k, v;
        var keys = Object.keys( obj );

        for( var i = 0; i < keys.length; i++ ){
          k = keys[ i ];
          v = obj[ k ];

          var valid = !p.immutableKeys[ k ];
          if( valid ){
            for( var j = 0; j < all.length; j++ ){
              var ele = all[j];

              if( p.canSet( ele ) ){
                ele._private[ p.field ][ k ] = v;
              }
            }
          }
        }

        // update mappers if asked
        if( p.updateStyle ){ self.updateStyle(); }

        // call onSet callback
        p.onSet( self );

        if( p.settingTriggersEvent ){
          self[ p.triggerFnName ]( p.settingEvent );
        }

      // .data(function(){ ... })
      } else if( p.allowBinding && is.fn( name ) ){ // bind to event
        var fn = name;
        self.on( p.bindingEvent, fn );

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

  // remove data field
  removeData: function( params ){
    var defaults = {
      field: 'data',
      event: 'data',
      triggerFnName: 'trigger',
      triggerEvent: false,
      immutableKeys: {} // key => true if immutable
    };
    params = util.extend( {}, defaults, params );

    return function removeDataImpl( names ){
      var p = params;
      var self = this;
      var selfIsArrayLike = self.length !== undefined;
      var all = selfIsArrayLike ? self : [ self ]; // put in array if not array-like

      // .removeData('foo bar')
      if( is.string( names ) ){ // then get the list of keys, and delete them
        var keys = names.split( /\s+/ );
        var l = keys.length;

        for( var i = 0; i < l; i++ ){ // delete each non-empty key
          var key = keys[ i ];
          if( is.emptyString( key ) ){ continue; }

          var valid = !p.immutableKeys[ key ]; // not valid if immutable
          if( valid ){
            for( var i_a = 0, l_a = all.length; i_a < l_a; i_a++ ){
              all[ i_a ]._private[ p.field ][ key ] = undefined;
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
          var keys = Object.keys( _privateFields );

          for( var i = 0; i < keys.length; i++ ){
            var key = keys[i];
            var validKeyToDelete = !p.immutableKeys[ key ];

            if( validKeyToDelete ){
              _privateFields[ key ] = undefined;
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
    regex: /(\w+)(\.(?:\w+|\*))?/, // regex for matching event strings (e.g. "click.namespace")
    universalNamespace: '.*', // matches as if no namespace specified and prevents users from unbinding accidentally
    optionalTypeRegex: /(\w+)?(\.(?:\w+|\*))?/,
    falseCallback: function(){ return false; }
  },

  // event binding
  on: function( params ){
    var defaults = {
      unbindSelfOnTrigger: false,
      unbindAllBindersOnTrigger: false
    };
    params = util.extend( {}, defaults, params );

    return function onImpl( events, selector, data, callback ){
      var self = this;
      var selfIsArrayLike = self.length !== undefined;
      var all = selfIsArrayLike ? self : [ self ]; // put in array if not array-like
      var eventsIsString = is.string( events );
      var p = params;

      if( is.plainObject( selector ) ){ // selector is actually data
        callback = data;
        data = selector;
        selector = undefined;
      } else if( is.fn( selector ) || selector === false ){ // selector is actually callback
        callback = selector;
        data = undefined;
        selector = undefined;
      }

      if( is.fn( data ) || data === false ){ // data is actually callback
        callback = data;
        data = undefined;
      }

      // if there isn't a callback, we can't really do anything
      // (can't speak for mapped events arg version)
      if( !(is.fn( callback ) || callback === false) && eventsIsString ){
        return self; // maintain chaining
      }

      if( eventsIsString ){ // then convert to map
        var map = {};
        map[ events ] = callback;
        events = map;
      }

      var keys = Object.keys( events );

      for( var k = 0; k < keys.length; k++ ){
        var evts = keys[k];

        callback = events[ evts ];
        if( callback === false ){
          callback = define.event.falseCallback;
        }

        if( !is.fn( callback ) ){ continue; }

        evts = evts.split( /\s+/ );
        for( var i = 0; i < evts.length; i++ ){
          var evt = evts[ i ];
          if( is.emptyString( evt ) ){ continue; }

          var match = evt.match( define.event.regex ); // type[.namespace]

          if( match ){
            var type = match[1];
            var namespace = match[2] ? match[2] : undefined;

            var listener = {
              callback: callback, // callback to run
              data: data, // extra data in eventObj.data
              delegated: selector ? true : false, // whether the evt is delegated
              selector: selector, // the selector to match for delegated events
              selObj: new Selector( selector ), // cached selector object to save rebuilding
              type: type, // the event type (e.g. 'click')
              namespace: namespace, // the event namespace (e.g. ".foo")
              unbindSelfOnTrigger: p.unbindSelfOnTrigger,
              unbindAllBindersOnTrigger: p.unbindAllBindersOnTrigger,
              binders: all // who bound together
            };

            for( var j = 0; j < all.length; j++ ){
              var _p = all[ j ]._private = all[ j ]._private || {};

              _p.listeners = _p.listeners || [];
              _p.listeners.push( listener );
            }
          }
        } // for events array
      } // for events map

      return self; // maintain chaining
    }; // function
  }, // on

  eventAliasesOn: function( proto ){
    var p = proto;

    p.addListener = p.listen = p.bind = p.on;
    p.removeListener = p.unlisten = p.unbind = p.off;
    p.emit = p.trigger;

    // this is just a wrapper alias of .on()
    p.pon = p.promiseOn = function( events, selector ){
      var self = this;
      var args = Array.prototype.slice.call( arguments, 0 );

      return new Promise( function( resolve, reject ){
        var callback = function( e ){
          self.off.apply( self, offArgs );

          resolve( e );
        };

        var onArgs = args.concat( [ callback ] );
        var offArgs = onArgs.concat( [] );

        self.on.apply( self, onArgs );
      } );
    };
  },

  off: function offImpl( params ){
    var defaults = {
    };
    params = util.extend( {}, defaults, params );

    return function( events, selector, callback ){
      var self = this;
      var selfIsArrayLike = self.length !== undefined;
      var all = selfIsArrayLike ? self : [ self ]; // put in array if not array-like
      var eventsIsString = is.string( events );

      if( arguments.length === 0 ){ // then unbind all

        for( var i = 0; i < all.length; i++ ){
          all[ i ]._private = all[ i ]._private || {};

          _p.listeners = [];
        }

        return self; // maintain chaining
      }

      if( is.fn( selector ) || selector === false ){ // selector is actually callback
        callback = selector;
        selector = undefined;
      }

      if( eventsIsString ){ // then convert to map
        var map = {};
        map[ events ] = callback;
        events = map;
      }

      var keys = Object.keys( events );

      for( var k = 0; k < keys.length; k++ ){
        var evts = keys[k];

        callback = events[ evts ];

        if( callback === false ){
          callback = define.event.falseCallback;
        }

        evts = evts.split( /\s+/ );
        for( var h = 0; h < evts.length; h++ ){
          var evt = evts[ h ];
          if( is.emptyString( evt ) ){ continue; }

          var match = evt.match( define.event.optionalTypeRegex ); // [type][.namespace]
          if( match ){
            var type = match[1] ? match[1] : undefined;
            var namespace = match[2] ? match[2] : undefined;

            for( var i = 0; i < all.length; i++ ){ //
              var _p = all[ i ]._private = all[ i ]._private || {};
              var listeners = _p.listeners = _p.listeners || [];

              for( var j = 0; j < listeners.length; j++ ){
                var listener = listeners[ j ];
                var nsMatches = !namespace || namespace === listener.namespace;
                var typeMatches = !type || listener.type === type;
                var cbMatches = !callback || callback === listener.callback;
                var listenerMatches = nsMatches && typeMatches && cbMatches;

                // delete listener if it matches
                if( listenerMatches ){
                  listeners.splice( j, 1 );
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
    params = util.extend( {}, defaults, params );

    return function triggerImpl( events, extraParams, fnToTrigger ){
      var self = this;
      var selfIsArrayLike = self.length !== undefined;
      var all = selfIsArrayLike ? self : [ self ]; // put in array if not array-like
      var eventsIsString = is.string( events );
      var eventsIsObject = is.plainObject( events );
      var eventsIsEvent = is.event( events );
      var _p = this._private = this._private || {};
      var cy = _p.cy || ( is.core( this ) ? this : null );
      var hasCompounds = cy ? cy.hasCompoundNodes() : false;

      if( eventsIsString ){ // then make a plain event object for each event name
        var evts = events.split( /\s+/ );
        events = [];

        for( var i = 0; i < evts.length; i++ ){
          var evt = evts[ i ];
          if( is.emptyString( evt ) ){ continue; }

          var match = evt.match( define.event.regex ); // type[.namespace]
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
        if( !is.array( extraParams ) ){ // make sure extra params are in an array if specified
          extraParams = [ extraParams ];
        }
      } else { // otherwise, we've got nothing
        extraParams = [];
      }

      for( var i = 0; i < events.length; i++ ){ // trigger each event in order
        var evtObj = events[ i ];

        for( var j = 0; j < all.length; j++ ){ // for each
          var triggerer = all[ j ];
          var _p = triggerer._private = triggerer._private || {};
          var listeners = _p.listeners = _p.listeners || [];
          var triggererIsElement = is.element( triggerer );
          var bubbleUp = triggererIsElement || params.layout;

          // create the event for this element from the event object
          var evt;

          if( eventsIsEvent ){ // then just get the object
            evt = evtObj;

            evt.cyTarget = evt.cyTarget || triggerer;
            evt.cy = evt.cy || cy;

          } else { // then we have to make one
            evt = new Event( evtObj, {
              cyTarget: triggerer,
              cy: cy,
              namespace: evtObj.namespace
            } );
          }

          // if a layout was specified, then put it in the typed event
          if( evtObj.layout ){
            evt.layout = evtObj.layout;
          }

          // if triggered by layout, put in event
          if( params.layout ){
            evt.layout = triggerer;
          }

          // create a rendered position based on the passed position
          if( evt.cyPosition ){
            var pos = evt.cyPosition;
            var zoom = cy.zoom();
            var pan = cy.pan();

            evt.cyRenderedPosition = {
              x: pos.x * zoom + pan.x,
              y: pos.y * zoom + pan.y
            };
          }

          if( fnToTrigger ){ // then override the listeners list with just the one we specified
            listeners = [ {
              namespace: evt.namespace,
              type: evt.type,
              callback: fnToTrigger
            } ];
          }

          for( var k = 0; k < listeners.length; k++ ){ // check each listener
            var lis = listeners[ k ];
            var nsMatches = !lis.namespace || lis.namespace === evt.namespace || lis.namespace === define.event.universalNamespace;
            var typeMatches = lis.type === evt.type;
            var targetMatches = lis.delegated ? ( triggerer !== evt.cyTarget && is.element( evt.cyTarget ) && lis.selObj.matches( evt.cyTarget ) ) : (true); // we're not going to validate the hierarchy; that's too expensive
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
                listeners.splice( k, 1 );
                k--;
              }

              if( lis.unbindAllBindersOnTrigger ){ // then delete the listener for all binders
                var binders = lis.binders;
                for( var l = 0; l < binders.length; l++ ){
                  var binder = binders[ l ];
                  if( !binder || binder === triggerer ){ continue; } // already handled triggerer or we can't handle it

                  var binderListeners = binder._private.listeners;
                  for( var m = 0; m < binderListeners.length; m++ ){
                    var binderListener = binderListeners[ m ];

                    if( binderListener === lis ){ // delete listener from list
                      binderListeners.splice( m, 1 );
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
            var parent = hasCompounds ? triggerer._private.parent : null;
            var hasParent = parent != null && parent.length !== 0;

            if( hasParent ){ // then bubble up to parent
              parent = parent[0];
              parent.trigger( evt );
            } else { // otherwise, bubble up to the core
              cy.trigger( evt );
            }
          }

        } // for each of all
      } // for each event

      return self; // maintain chaining
    }; // function
  }, // trigger

  animated: function( fnParams ){
    var defaults = {};
    fnParams = util.extend( {}, defaults, fnParams );

    return function animatedImpl(){
      var self = this;
      var selfIsArrayLike = self.length !== undefined;
      var all = selfIsArrayLike ? self : [ self ]; // put in array if not array-like
      var cy = this._private.cy || this;

      if( !cy.styleEnabled() ){ return false; }

      var ele = all[0];

      if( ele ){
        return ele._private.animation.current.length > 0;
      }
    };
  }, // animated

  clearQueue: function( fnParams ){
    var defaults = {};
    fnParams = util.extend( {}, defaults, fnParams );

    return function clearQueueImpl(){
      var self = this;
      var selfIsArrayLike = self.length !== undefined;
      var all = selfIsArrayLike ? self : [ self ]; // put in array if not array-like
      var cy = this._private.cy || this;

      if( !cy.styleEnabled() ){ return this; }

      for( var i = 0; i < all.length; i++ ){
        var ele = all[ i ];
        ele._private.animation.queue = [];
      }

      return this;
    };
  }, // clearQueue

  delay: function( fnParams ){
    var defaults = {};
    fnParams = util.extend( {}, defaults, fnParams );

    return function delayImpl( time, complete ){
      var cy = this._private.cy || this;

      if( !cy.styleEnabled() ){ return this; }

      return this.animate( {
        delay: time,
        duration: time,
        complete: complete
      } );
    };
  }, // delay

  delayAnimation: function( fnParams ){
    var defaults = {};
    fnParams = util.extend( {}, defaults, fnParams );

    return function delayAnimationImpl( time, complete ){
      var cy = this._private.cy || this;

      if( !cy.styleEnabled() ){ return this; }

      return this.animation( {
        delay: time,
        duration: time,
        complete: complete
      } );
    };
  }, // delay

  animation: function( fnParams ){
    var defaults = {};
    fnParams = util.extend( {}, defaults, fnParams );

    return function animationImpl( properties, params ){
      var self = this;
      var selfIsArrayLike = self.length !== undefined;
      var all = selfIsArrayLike ? self : [ self ]; // put in array if not array-like
      var cy = this._private.cy || this;
      var isCore = !selfIsArrayLike;
      var isEles = !isCore;

      if( !cy.styleEnabled() ){ return this; }

      var style = cy.style();

      properties = util.extend( {}, properties, params );

      if( properties.duration === undefined ){
        properties.duration = 400;
      }

      switch( properties.duration ){
      case 'slow':
        properties.duration = 600;
        break;
      case 'fast':
        properties.duration = 200;
        break;
      }

      var propertiesEmpty = Object.keys( properties ).length === 0;

      if( propertiesEmpty ){
        return new Animation( all[0], properties ); // nothing to animate
      }

      if( isEles ){
        properties.style = style.getPropsList( properties.style || properties.css );

        properties.css = undefined;
      }

      if( properties.renderedPosition && isEles ){
        var rpos = properties.renderedPosition;
        var pan = cy.pan();
        var zoom = cy.zoom();

        properties.position = {
          x: ( rpos.x - pan.x ) / zoom,
          y: ( rpos.y - pan.y ) / zoom
        };
      }

      // override pan w/ panBy if set
      if( properties.panBy && isCore ){
        var panBy = properties.panBy;
        var cyPan = cy.pan();

        properties.pan = {
          x: cyPan.x + panBy.x,
          y: cyPan.y + panBy.y
        };
      }

      // override pan w/ center if set
      var center = properties.center || properties.centre;
      if( center && isCore ){
        var centerPan = cy.getCenterPan( center.eles, properties.zoom );

        if( centerPan ){
          properties.pan = centerPan;
        }
      }

      // override pan & zoom w/ fit if set
      if( properties.fit && isCore ){
        var fit = properties.fit;
        var fitVp = cy.getFitViewport( fit.eles || fit.boundingBox, fit.padding );

        if( fitVp ){
          properties.pan = fitVp.pan;
          properties.zoom = fitVp.zoom;
        }
      }

      return new Animation( all[0], properties );
    };
  }, // animate

  animate: function( fnParams ){
    var defaults = {};
    fnParams = util.extend( {}, defaults, fnParams );

    return function animateImpl( properties, params ){
      var self = this;
      var selfIsArrayLike = self.length !== undefined;
      var all = selfIsArrayLike ? self : [ self ]; // put in array if not array-like
      var cy = this._private.cy || this;

      if( !cy.styleEnabled() ){ return this; }

      if( params ){
        properties = util.extend( {}, properties, params );
      }

      // manually hook and run the animation
      for( var i = 0; i < all.length; i++ ){
        var ele = all[ i ];
        var queue = ele.animated() && (properties.queue === undefined || properties.queue);

        var ani = ele.animation( properties, (queue ? { queue: true } : undefined) );

        ani.play();
      }

      return this; // chaining
    };
  }, // animate

  stop: function( fnParams ){
    var defaults = {};
    fnParams = util.extend( {}, defaults, fnParams );

    return function stopImpl( clearQueue, jumpToEnd ){
      var self = this;
      var selfIsArrayLike = self.length !== undefined;
      var all = selfIsArrayLike ? self : [ self ]; // put in array if not array-like
      var cy = this._private.cy || this;

      if( !cy.styleEnabled() ){ return this; }

      for( var i = 0; i < all.length; i++ ){
        var ele = all[ i ];
        var _p = ele._private;
        var anis = _p.animation.current;

        for( var j = 0; j < anis.length; j++ ){
          var ani = anis[ j ];
          var ani_p = ani._private;

          if( jumpToEnd ){
            // next iteration of the animation loop, the animation
            // will go straight to the end and be removed
            ani_p.duration = 0;
          }
        }

        // clear the queue of future animations
        if( clearQueue ){
          _p.animation.queue = [];
        }

        if( !jumpToEnd ){
          _p.animation.current = [];
        }
      }

      // we have to notify (the animation loop doesn't do it for us on `stop`)
      cy.notify( {
        eles: this,
        type: 'draw'
      } );

      return this;
    };
  } // stop

}; // define

module.exports = define;
