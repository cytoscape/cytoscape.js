import define from '../define/index.mjs';
import type { DataFunc, RemoveDataFunc } from '../define/data.mjs';
import type { Collection, Element } from './eles-types.mjs';

/** Data/scratch accessors contributed to the collection prototype. */
export interface CollectionData {
  data: DataFunc<Collection>;
  removeData: RemoveDataFunc<Collection>;
  scratch: DataFunc<Collection>;
  removeScratch: RemoveDataFunc<Collection>;
  /** @internal */
  rscratch: DataFunc<Collection>;
  /** @internal */
  removeRscratch: RemoveDataFunc<Collection>;
  attr: DataFunc<Collection>;
  removeAttr: RemoveDataFunc<Collection>;
  id(): string | undefined;
}

let fn: CollectionData;
let elesfn: CollectionData;

fn = elesfn = ({

  data: define.data<Collection, Element>( {
    field: 'data',
    bindingEvent: 'data',
    allowBinding: true,
    allowSetting: true,
    settingEvent: 'data',
    settingTriggersEvent: true,
    triggerFnName: 'trigger',
    allowGetting: true,
    immutableKeys: {
      'id': true,
      'source': true,
      'target': true,
      'parent': true
    },
    updateStyle: true
  } ),

  removeData: define.removeData<Collection>( {
    field: 'data',
    event: 'data',
    triggerFnName: 'trigger',
    triggerEvent: true,
    immutableKeys: {
      'id': true,
      'source': true,
      'target': true,
      'parent': true
    },
    updateStyle: true
  } ),

  scratch: define.data<Collection, Element>( {
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

  removeScratch: define.removeData<Collection>( {
    field: 'scratch',
    event: 'scratch',
    triggerFnName: 'trigger',
    triggerEvent: true,
    updateStyle: true
  } ),

  rscratch: define.data<Collection, Element>( {
    field: 'rscratch',
    allowBinding: false,
    allowSetting: true,
    settingTriggersEvent: false,
    allowGetting: true
  } ),

  removeRscratch: define.removeData<Collection>( {
    field: 'rscratch',
    triggerEvent: false
  } ),

  id: function( this: Collection ){
    let ele = this[0];

    if( ele ){
      return ele._private.data.id;
    }
  }

}) as CollectionData;

// aliases
fn.attr = fn.data;
fn.removeAttr = fn.removeData;

export default elesfn;
