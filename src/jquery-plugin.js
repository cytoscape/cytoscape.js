;(function($, $$){

	// allow calls on a jQuery selector by proxying calls to $.cytoscapeweb
	// e.g. $("#foo").cytoscapeweb(options) => $.cytoscapeweb(options) on #foo
	$.fn.cytoscapeweb = function(opts){
		
		// get object
		if( opts == "get" ){
			var data = $(this).data("cytoscapeweb");
			return data.cy;
		}
		
		// bind to ready
		else if( $$.is.fn(opts) ){
			var ready = opts;
			var data = $(this).data("cytoscapeweb");
			
			if( data != null && data.cy != null && data.ready ){
				// already ready so just trigger now
				ready.apply(data.cy, []);
			} else {
				// not yet ready, so add to readies list
				
				if( data == null ){
					data = {}
				}
				
				if( data.readies == null ){
					data.readies = [];
				}
				
				data.readies.push(ready);
				$(this).data("cytoscapeweb", data);
			} 
			
		}
		
		// proxy to create instance
		else if( $$.is.plainObject(opts) ){
			return $(this).each(function(){
				var options = $.extend({}, opts, {
					container: $(this)
				});
			
				$.cytoscapeweb(options);
			});
		}
		
		// proxy a function call
		else {
			var rets = [];
			var args = [];
			for(var i = 1; i < arguments.length; i++){
				args[i - 1] = arguments[i];
			}
			
			$(this).each(function(){
				var data = $(this).data("cytoscapeweb");
				var cy = data.cy;
				var fnName = opts;
				
				if( cy != null && $$.is.fn( cy[fnName] ) ){
					var ret = cy[fnName].apply(cy, args);
					rets.push(ret);
				}
			});
			
			// if only one instance, don't need to return array
			if( rets.length == 1 ){
				rets = rets[0];
			} else if( rets.length == 0 ){
				rets = $(this);
			}
			
			return rets;
		}

	};
	
	// use short alias (cy) if not already defined
	if( $.fn.cy == null && $.cy == null ){
		$.fn.cy = $.fn.cytoscapeweb;
		$.cy = $.cytoscapeweb;
	}
	
})(jQuery, jQuery.cytoscapeweb);
