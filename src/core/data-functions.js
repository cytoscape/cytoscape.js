'use strict';

var define = require('../define');

var corefn = ({
  data: define.data({
    field: 'data',
    bindingEvent: 'data',
    allowBinding: true,
    allowSetting: true,
    settingEvent: 'data',
    settingTriggersEvent: true,
    triggerFnName: 'trigger',
    allowGetting: true
  }),

  removeData: define.removeData({
    field: 'data',
    event: 'data',
    triggerFnName: 'trigger',
    triggerEvent: true
  }),

  scratch: define.data({
    field: 'scratch',
    allowBinding: false,
    allowSetting: true,
    settingTriggersEvent: false,
    allowGetting: true
  }),

  removeScratch: define.removeData({
    field: 'scratch',
    triggerEvent: false
  })
});

module.exports = corefn;
