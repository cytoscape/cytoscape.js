;(function($, $$){
	
	$$.fn.core({
		data: $$.define.data({
			field: "data",
			bindingEvent: "data",
			allowBinding: true,
			allowSetting: true,
			settingEvent: "data",
			settingTriggersEvent: true,
			triggerFnName: "trigger",
			allowGetting: true
		}),

		removeData: $$.define.removeData({

		}),

		scratch: $$.define.data({
			field: "scratch",
			allowBinding: false,
			allowSetting: true,
			settingTriggersEvent: false,
			allowGetting: true
		}),
		
		removeScratch: function( name ){
			if( name === undefined ){
				structs.scratch = {};
			} else {
				eval( "delete this._private.scratch." + name + ";" );
			}
			
			return this;
		}
	});
	
})(jQuery, jQuery.cytoscape);
