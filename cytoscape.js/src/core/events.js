'use strict';

var define = require( '../define' );

var corefn = ({
  on: define.on(), // .on( events [, selector] [, data], handler)
  one: define.on( { unbindSelfOnTrigger: true } ),
  once: define.on( { unbindAllBindersOnTrigger: true } ),
  off: define.off(), // .off( events [, selector] [, handler] )
  trigger: define.trigger() // .trigger( events [, extraParams] )
});

define.eventAliasesOn( corefn );

module.exports = corefn;
