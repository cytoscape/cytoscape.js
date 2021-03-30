import define from '../define';

const fn = {
    /**
 *  name, value
 * @typedef {object} cy_data_name_val
 * @property {object} name - The name of the field to set.
 * @property {object} value - The value to set for the field.
 */

/**
 * @typedef {object} cy_data
 * @property {object} NULL
 * @property {object} name - The name of the field to get.
 * @property {cy_data_name_val} cy_data_name_val - Set a particular data property value.
 * @property {object} obj - The object containing name-value pairs to update data fields.
 */

  /**
 * Read and write developer-defined data associated with the graph.
 * @memberof cy
 * @path Core/Data
 * @pureAliases cy.attr
 * @param {...cy_data} value - Get the entire data object. | Get a particular data field. | Set a particular data field. | Update multiple data fields at once via an object.
 * @methodName cy.data
 */
  data: define.data( {
    field: 'data',
    bindingEvent: 'data',
    allowBinding: true,
    allowSetting: true,
    settingEvent: 'data',
    settingTriggersEvent: true,
    triggerFnName: 'trigger',
    allowGetting: true
  } ),

/**
 * @typedef {object} cy_removeData
 * @property {object} NULL
 * @property {object} names - A space-separated list of fields to delete.
 */

  /**
 * Remove developer-defined data associated with the elements.
 * @memberof cy
 * @path Core/removeData
 * @pureAliases cy.removeAttr
 * @param {...cy_removeData} value - Removes all mutable data fields for the elements. | Removes the specified mutable data fields for the elements.
 * @methodName cy.removeData
 */
  removeData: define.removeData( {
    field: 'data',
    event: 'data',
    triggerFnName: 'trigger',
    triggerEvent: true
  } ),

  /**
 *  name, value
 * @typedef {object} cy_scratch_name_val
 * @property {object} namespace - A namespace string.
 * @property {object} value - The value to set at the specified namespace.
 */

/**
 * @typedef {object} cy_scratch
 * @property {object} NULL
 * @property {object} namespace - A namespace string.
 * @property {cy_scratch_name_val} cy_scratch_name_val - Set a particular scratch property value.
 */

  /**
 * Set or get scratchpad scratch, where temporary or non-JSON scratch can be stored.  App-level scratchpad scratch should use namespaces prefixed with underscore, like `'_foo'`.  This is analogous to the more common [`ele.scratch()`](#ele.scratch) but for graph global scratch.
 * @memberof cy
 * @path Core/Data
 * @extFn true
 * @param {...cy_scratch} value - Get the entire scratchpad object for the core. | Get the scratchpad at a particular namespace. | Set the scratchpad at a particular namespace.
 * @methodName cy.scratch
 */
  scratch: define.data( {
    field: 'scratch',
    bindingEvent: 'scratch',
    allowBinding: true,
    allowSetting: true,
    settingEvent: 'scratch',
    settingTriggersEvent: true,
    triggerFnName: 'trigger',
    allowGetting: true
  } ),

  /**
 * @typedef {object} cy_removeScratch
 * @property {object} namespace - A namespace string.
 */

  /**
 * Remove scratchpad data. You should remove scratchpad data only at your own namespaces.  This is analogous to the more common [`ele.removeScratch()`](#ele.removeScratch) but for graph global data.
 * @memberof cy
 * @path Core/Data
 * @extFn true
 * @param {...cy_removeScratch} value - Remove the scratchpad data at a particular namespace.
 * @methodName cy.removeScratch
 */
  removeScratch: define.removeData( {
    field: 'scratch',
    event: 'scratch',
    triggerFnName: 'trigger',
    triggerEvent: true
  } )
};

// aliases
fn.attr = fn.data;
fn.removeAttr = fn.removeData;

export default fn;