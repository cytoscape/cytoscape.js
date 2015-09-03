;(function($$){ 'use strict';

  $$.fn.core({
    on: $$.define.on(), // .on( events [, selector] [, data], handler)
    one: $$.define.on({ unbindSelfOnTrigger: true }),
    once: $$.define.on({ unbindAllBindersOnTrigger: true }),
    off: $$.define.off(), // .off( events [, selector] [, handler] )
    trigger: $$.define.trigger() // .trigger( events [, extraParams] )
  });

  $$.define.eventAliasesOn( $$.corefn );

})( cytoscape );
