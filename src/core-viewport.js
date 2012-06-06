;(function($, $$){
	
	$$.fn.core({
		
		panning: function(bool){
			if( bool !== undefined ){
				this._private.panEnabled = bool ? true : false;
			} else {
				return this._private.panEnabled;
			}
			
			return this;
		},
		
		zooming: function(bool){
			if( bool !== undefined ){
				this._private.zoomEnabled = bool ? true : false;
			} else {
				return this._private.zoomEnabled;
			}
			
			return this;
		},
		
		pan: function(params){
			var ret = this.renderer().pan(params);
			
			if( ret == null ){
				this.trigger("pan");
				return this;
			}
			
			return ret;
		},
		
		panBy: function(params){
			var ret = this.renderer().panBy(params);
			
			if( ret == null ){
				this.trigger("pan");
				return this;
			}
			
			return ret;
		},
		
		fit: function(elements){
			var ret = this.renderer().fit({
				elements: elements,
				zoom: true
			});
			
			if( ret == null ){
				this.trigger("zoom");
				this.trigger("pan");
				return this;
			}
			
			return ret;
		},
		
		zoom: function(params){
			var ret = this.renderer().zoom(params);
			
			if( ret != null ){
				return ret;
			} else {
				this.trigger("zoom");
				return this;
			}
		},
		
		center: function(elements){
			this.renderer().fit({
				elements: elements,
				zoom: false
			});
			
			this.trigger("pan");
			return this;
		},
		
		centre: function(){ // alias to center
			return this.center.apply(cy, arguments); 
		},
		
		reset: function(){
			this.renderer().pan({ x: 0, y: 0 });
			this.renderer().zoom(1);
			
			this.trigger("zoom");
			this.trigger("pan");
			
			return this;
		}
	});	
	
})(jQuery, jQuery.cytoscape);
