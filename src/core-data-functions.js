;(function($$){ 'use strict';
  
  $$.fn.core({
    data: $$.define.data({
      field: 'data',
      bindingEvent: 'data',
      allowBinding: true,
      allowSetting: true,
      settingEvent: 'data',
      settingTriggersEvent: true,
      triggerFnName: 'trigger',
      allowGetting: true
    }),

    removeData: $$.define.removeData({
      field: 'data',
      event: 'data',
      triggerFnName: 'trigger',
      triggerEvent: true
    }),

    batchData: $$.define.batchData({
      field: 'data',
      event: 'data',
      triggerFnName: 'trigger',
      immutableKeys: {
        'id': true,
        'source': true,
        'target': true,
        'parent': true
      },
      updateMappers: true
    }),

    batchPosition: $$.define.batchData({
      field: 'position',
      event: 'position',
      triggerFnName: 'rtrigger'
    }),

    scratch: $$.define.data({
      field: 'scratch',
      allowBinding: false,
      allowSetting: true,
      settingTriggersEvent: false,
      allowGetting: true
    }),

    removeScratch: $$.define.removeData({
      field: 'scratch',
      triggerEvent: false
    }),
  });
  
})( cytoscape );
