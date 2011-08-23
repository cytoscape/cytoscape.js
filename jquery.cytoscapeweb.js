;(function($){

	// registered modules to cytoweb, indexed by name
	var reg = {
		renderers: {},
		layouts: {}
	};

	// allow calls on a jQuery selector by proxing calls to $.cytoscapeweb
	// e.g. $("#foo").cytoscapeweb(options) => $.cytoscapeweb(options) on #foo
	$.fn.cytoscapeweb = function(opts){

		// proxy to create instance
		if( typeof opts == typeof {} ){
			return $(this).each(function(){
				var options = $.extend({}, opts, {
					selector: $(this)
				});
			
				$.cytoscapeweb(options);
			});
		}
		
		// proxy a function call
		else {
			var rets = [];
			
			$(this).each({
				var cy = $(this).data("cytoscapeweb");
				var fnName = opts;
				var args = Array.prototype.slice.call( arguments, 1 );
				
				if( cy != null && $.isFunction( cy[fnName] ) ){
					var ret = cy[fnName].apply(cy, args);
					rets.push(ret);
				}
			});
			
			return rets;
		}

	};

	// allow functional access to cytoweb
	// e.g. var cytoweb = $.cytoscapeweb({ selector: "#foo", ... });
	//      var nodes = cytoweb.nodes();
	$.cytoscapeweb = function(opts){
		
		// create instance
		if( typeof opts == typeof {} ){
			var defaults = {
				layout: "forcedirected",
				renderer: "svg",
				style: { // actual default style later specified by renderer
					global: {},
					nodes: {},
					edges: {}
				},
				bypass: {
					nodes: {},
					edges: {}
				} 
			};
			
			var options = $.extend(true, {}, defaults, opts);
			
			// structs to hold internal cytoweb model
			var structs = {
				style: options.style,
				bypass: options.bypass,
				data: {
					nodes: {}, // id => data
					edges: {}  // id => data
				},
				nodes: {}, // id => node object
				edges: {}  // id => edge object
			};
			
			// return a deep copy of an object
			function copy(obj){
				if( $.isArray(obj) ){
					return $.extend(true, [], obj);
				} else {
					return $.extend(true, {}, obj);
				}
			}
			
			// getter/setter for node and edge fields
			function field(params){
				return function(){
				
					if( params.json ){
						var newVal = arguments[0];
						
						if( newVal === undefined ){
							return copy( structs[params.name][params.group][this.id] );
						} else {
							structs[params.name][params.group][this.id] = copy( newVal );
						}
						
					} else {
						var attr = arguments[0];
						var val = arguments[1];
						
						if( val === undefined ){
							var ret = structs[params.name][params.group][this.id][attr];
							
							return ( typeof ret == "object" ? copy(ret) : ret );
						} else {
							structs[params.name][params.group][this.id][attr] = ( typeof val == "object" ? copy(val) : val );
						}
					}
				
				};
			}
			
			function CyNode(params){
				this.id = params.data.id;
				this.data(params.data);
				this.bypass(params.bypass);
			}
			CyNode.prototype.bypass = field({ name: "bypass",  group: "nodes", json: true });
			CyNode.prototype.data = field({ name: "data",  group: "nodes" });
			
			function CyEdge(params){
				this.id = params.data.id;
			}
			CyEdge.prototype.bypass = field({ name: "bypass",  group: "edges", json: true });
			CyEdge.prototype.data = field({ name: "data",  group: "edges" });
			
			// for getting/setting top-level object properties
			function jsonGetterSetter(field, callback){
				return function(val){
					
					if( val === undefined ){
						return copy( structs[field] );
					} else {
						structs[field] = copy( val );
					}
					
					callback();
				};
			}
			
			var renderer = reg.renderers[options.renderer.toLowerCase()];
			
			// this is the cytoweb object
			var cy = {
				
				style: jsonGetterSetter("style", function(){
					// TODO notify renderer of style change
				}),
				
				bypass: jsonGetterSetter("bypass", function(){
					// TODO notify renderer of bypass change
				}),
				
				node: function(id){
					return nodes[id];
				},
				
				edge: function(id){
					return edges[id];
				},
				
				nodes: function(){
					var ret = [];
					$.each(nodes, function(id, node){
						ret.push(node);
					});
					return ret;
				},
				
				edges: function(){
					var ret = [];
					$.each(edges, function(id, edge){
						ret.push(edge);
					});
					return ret;
				}
				
			};
			
			renderer.draw({
				nodes: nodes,
				edges: edges,
				style: style,
				bypass: bypass
			});
			
			return cy;
		} 
		
		// allow for registration of extensions
		else if( typeof opts == typeof "" ) {
			var registrant = arguments[0].toLowerCase(); // what to register (e.g. "renderer")
			var name = arguments[1].toLowerCase(); // name of the module (e.g. "svg")
			var module = arguments[2]; // the module object
			
			if( module == null ){
				// get the module by name; e.g. $.cytoscapeweb("renderer", "svg");
				return reg[registrant][name];
			} else {
				// set the module; e.g. $.cytoscapeweb("renderer", "svg", { ... });
				reg[registrant][name] = module;
			}
		}
	};
	
	// use short alias (cy) if not already defined
	if( $.fn.cy == null && $.cy == null ){
		$.fn.cy = $.fn.cytoscapeweb;
		$.cy = $.cytoscapeweb;
	}

})(jQuery);

