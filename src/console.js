;(function($, $$){
	
	var quiet = false;
	var debug = false;
	
	var console = $$.console = {
		option: function(name, val){
			if( name == quiet ){
				return quiet = ( val === undefined ? quiet : val );
			} else if( name == debug ){
				return debug = ( val === undeifned ? debug : val );
			}
		},
			
		debug: function(){
			if( quiet || !debug || $.browser.msie ){ return; }
			
			if( window.console != null && window.console.debug != null ){
				window.console.debug.apply(window.console, arguments);
			} else if( window.console != null && window.console.log != null ){
				window.console.log.apply(window.console, arguments);
			}
		},
			
		log: function(){
			if( quiet || $.browser.msie ){ return; }
			
			if( window.console != null && window.console.log != null ){
				window.console.log.apply(window.console, arguments);
			}
		},
		
		warn: function(){
			if( quiet || $.browser.msie ){ return; }
			
			if( window.console != null && window.console.warn != null ){
				window.console.warn.apply(window.console, arguments);
			} else {
				console.log.apply(window.console, arguments);
			}
		},
		
		error: function(){
			if( quiet || $.browser.msie ){ return; }
			
			if( window.console != null && window.console.error != null ){
				window.console.error.apply(window.console, arguments);
				
				if( window.console.trace != null ){
					window.console.trace();
				}
				
			} else {
				console.log.apply(window.console, arguments);
				throw "Cytoscape Web encountered the previously logged error";
				
				if( window.console.trace != null ){
					window.console.trace();
				}
			}
		}
	};
	
})(jQuery, jQuery.cytoscapeweb);
