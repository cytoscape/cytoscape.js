let Emitter = require('../emitter');
let define = require('../define');
let is = require('../is');
let util = require('../util');
let Selector = require('../selector');

let emitterOptions = {
  qualifierCompare: function( selector1, selector2 ){
    if( selector1 == null || selector2 == null ){
      return selector1 == null && selector2 == null;
    } else {
      return selector1.sameText( selector2 );
    }
  },
  eventMatches: function( cy, listener, eventObj ){
    let selector = listener.qualifier;

    if( selector != null ){
      return cy !== eventObj.target && is.element( eventObj.target ) && selector.matches( eventObj.target );
    }

    return true;
  },
  eventFields: function( cy ){
    return {
      cy: cy,
      target: cy
    };
  },
  callbackContext: function( cy, listener, eventObj ){
    return listener.qualifier != null ? eventObj.target : cy;
  }
};

let argSelector = function( arg ){
  if( is.string(arg) ){
    return new Selector( arg );
  } else {
    return arg;
  }
};

let elesfn = ({
  createEmitter: function(){
    let _p = this._private;

    if( !_p.emitter ){
      _p.emitter = new Emitter( util.assign( {
        context: this
      }, emitterOptions ) );
    }

    return this;
  },

  emitter: function(){
    return this._private.emitter;
  },

  on: function( events, selector, callback ){
    this.emitter().on( events, argSelector(selector), callback );

    return this;
  },

  removeListener: function( events, selector, callback ){
    this.emitter().removeListener( events, argSelector(selector), callback );

    return this;
  },

  one: function( events, selector, callback ){
    this.emitter().one( events, argSelector(selector), callback );

    return this;
  },

  once: function( events, selector, callback ){
    this.emitter().one( events, argSelector(selector), callback );

    return this;
  },

  emit: function( events, extraParams ){
    this.emitter().emit( events, extraParams );

    return this;
  }
});

define.eventAliasesOn( elesfn );

module.exports = elesfn;
