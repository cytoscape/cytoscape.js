import define from '../define';

let fn, elesfn;

fn = elesfn = ({

      /**
 *  name, value
 * @typedef {object} eles_data_name_val
 * @property {object} name - The name of the field to set.
 * @property {object} value - The value to set for the field.
 */

/**
 * @typedef {object} eles_data
 * @property {object} NULL
 * @property {object} name - The name of the field to get.
 * @property {eles_data_name_val} eles_data_name_val
 * @property {object} obj - The object containing name-value pairs to update data fields.
 */

  /**
 * Read and write developer-defined data associated with the elements.
 * @memberof eles
 * @path Collection/Data
 * @formatsSameFn true
 * @sub_functions ele.data|ele.data|ele.data|ele.data
 * @pureAliases eles.attr
 * @param {...eles_data} value - Get the entire data object. | Get a particular data field for the element. | Set a particular data field for the element. | Update multiple data fields at once via an object.
 * @methodName eles.data
 */
  data: define.data( {
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

    /**
 * @typedef {object} eles_removeData
 * @property {object} NULL
 * @property {object} names - A space-separated list of fields to delete.
 */

  /**
 * Remove developer-defined data associated with the elements.
 * @memberof eles
 * @path Collection/Data
 * @pureAliases eles.removeAttr
 * @param {...eles_removeData} eles - Removes all mutable data fields for the elements. | Removes the specified mutable data fields for the elements.
 * @methodName eles.removeData
 */
  removeData: define.removeData( {
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

        /**
 * @typedef {object} ele_scratch_type
 * @property {object} namespace - A namespace string.
 * @property {object} value - The value to set at the specified namespace.
 */

      /**
 * @typedef {object} ele_scratch
 * @property {object} NULL
 * @property {object} namespace -A namespace string.
 * @property {ele_scratch_type} ele_scratch_type
 */

  /**
 * Set or get scratchpad data, where temporary or non-JSON data can be stored.  App-level scratchpad data should use namespaces prefixed with underscore, like `'_foo'`.
 * @memberof ele
 * @path Collection/Data
 * @extFn true
 * @param {...ele_scratch} ele - Get the entire scratchpad object for the element. | Get the scratchpad at a particular namespace. | Set the scratchpad at a particular namespace.
 * @methodName ele.scratch
 */
  scratch: define.data( {
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

        /**
 * @typedef {object} ele_removeScratch
 * @property {object} namespace -A namespace string.
 */

  /**
 * Remove scratchpad data. You should remove scratchpad data only at your own namespaces.
 * @memberof ele
 * @path Collection/Data
 * @extFn true
 * @param {...ele_removeScratch} ele - Remove the scratchpad data at a particular namespace.
 * @methodName ele.removeScratch
 */
  removeScratch: define.removeData( {
    field: 'scratch',
    event: 'scratch',
    triggerFnName: 'trigger',
    triggerEvent: true,
    updateStyle: true
  } ),

  rscratch: define.data( {
    field: 'rscratch',
    allowBinding: false,
    allowSetting: true,
    settingTriggersEvent: false,
    allowGetting: true
  } ),

  removeRscratch: define.removeData( {
    field: 'rscratch',
    triggerEvent: false
  } ),

    /**
 * A shortcut to get the ID of an element.
 * @memberof ele
 * @path Collection/Data
 * @methodName ele.id
 */
  id: function(){
    let ele = this[0];

    if( ele ){
      return ele._private.data.id;
    }
  }

});

// aliases
fn.attr = fn.data;
fn.removeAttr = fn.removeData;

export default elesfn;
