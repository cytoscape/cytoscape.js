;(function($, $$){
	
	// allow calls on a jQuery selector by proxying calls to $.cytoscape
	// e.g. $("#foo").cytoscape(options) => $.cytoscape(options) on #foo
	$.fn.cytoscape = function(opts){
		
		// get object
		if( opts == "get" ){
			var data = $(this).data("cytoscape");
			return data.cy;
		}
		
		// bind to ready
		else if( $$.is.fn(opts) ){
			var ready = opts;
			var data = $(this).data("cytoscape");
			
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
				$(this).data("cytoscape", data);
			} 
			
		}
		
		// proxy to create instance
		else if( $$.is.plainObject(opts) ){
			return $(this).each(function(){
				var options = $.extend({}, opts, {
					container: $(this)
				});
			
				$.cytoscape(options);
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
				var data = $(this).data("cytoscape");
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
	
	// allow functional access to cyto
	// e.g. var cyto = $.cytoscape({ selector: "#foo", ... });
	//      var nodes = cyto.nodes();
	$$.init = function( options ){
		
		// create instance
		if( $$.is.plainObject( options ) ){
			return new $$.CyCore( options );
		} 
		
		// allow for registration of extensions
		// e.g. $.cytoscape("renderer", "svg", SvgRenderer);
		// e.g. $.cytoscape("renderer", "svg", "nodeshape", "ellipse", SvgEllipseNodeShape);
		// e.g. $.cytoscape("core", "doSomething", function(){ /* doSomething code */ });
		// e.g. $.cytoscape("collection", "doSomething", function(){ /* doSomething code */ });
		else if( $$.is.string( options ) ) {
			return $$.extension.apply($$.extension, arguments);
		}
	};
	
	// use short alias (cy) if not already defined
	if( $.fn.cy == null && $.cy == null ){
		$.fn.cy = $.fn.cytoscape;
		$.cy = $.cytoscape;
	}
	
})(jQuery, jQuery.cytoscape);
