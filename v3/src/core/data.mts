import define from '../define/index.mjs';
import type { DataFunc, RemoveDataFunc } from '../define/data.mjs';
import type { Core } from './core-types.mjs';

const fn = {
  data: define.data<Core>( {
    field: 'data',
    bindingEvent: 'data',
    allowBinding: true,
    allowSetting: true,
    settingEvent: 'data',
    settingTriggersEvent: true,
    triggerFnName: 'trigger',
    allowGetting: true,
    updateStyle: true
  } ),

  removeData: define.removeData<Core>( {
    field: 'data',
    event: 'data',
    triggerFnName: 'trigger',
    triggerEvent: true,
    updateStyle: true
  } ),

  scratch: define.data<Core>( {
    field: 'scratch',
    bindingEvent: 'scratch',
    allowBinding: true,
    allowSetting: true,
    settingEvent: 'scratch',
    settingTriggersEvent: true,
    triggerFnName: 'trigger',
    allowGetting: true,
    updateStyle: true
  } ),

  removeScratch: define.removeData<Core>( {
    field: 'scratch',
    event: 'scratch',
    triggerFnName: 'trigger',
    triggerEvent: true,
    updateStyle: true
  } )
} as CoreData;

// aliases
fn.attr = fn.data;
fn.removeAttr = fn.removeData;

/** Data/scratch accessor methods contributed to the core prototype. */
export interface CoreData {
  data: DataFunc<Core>;
  removeData: RemoveDataFunc<Core>;
  scratch: DataFunc<Core>;
  removeScratch: RemoveDataFunc<Core>;
  attr: DataFunc<Core>;
  removeAttr: RemoveDataFunc<Core>;
}

export default fn as CoreData;
