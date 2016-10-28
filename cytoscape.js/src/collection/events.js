'use strict';

var define = require( '../define' );

var elesfn = ({
  on: define.on(), // .on( events [, selector] [, data], handler)
  one: define.on( { unbindSelfOnTrigger: true } ),
  once: define.on( { unbindAllBindersOnTrigger: true } ),
  off: define.off(), // .off( events [, selector] [, handler] )
  trigger: define.trigger(), // .trigger( events [, extraParams] )

  rtrigger: function( event, extraParams ){ // for internal use only
    if( this.length === 0 ){ return; } // empty collections don't need to notify anything

    // notify renderer
    this.cy().notify( {
      type: event,
      eles: this
    } );

    this.trigger( event, extraParams );
    return this;
  }
});

// aliases:
define.eventAliasesOn( elesfn );

module.exports = elesfn;
