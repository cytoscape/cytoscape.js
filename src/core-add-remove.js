(function($, $$){
	
	$$.fn.core({
		add: function(opts){
			
			var elements;
			var cy = this;
			
			// add the element
			if( $$.is.element(opts) ){
				var element = opts;
				elements = element.collection().restore();
			}
			
			// add the collection
			else if( $$.is.collection(opts) ){
				var collection = opts;
				elements = collection.restore();
			} 
			
			// specify an array of options
			else if( $$.is.array(opts) ){
				var jsons = opts;

				elements = new $$.CyCollection(cy, jsons);
			}
			
			// specify via opts.nodes and opts.edges
			else if( $$.is.plainObject(opts) && ($$.is.array(opts.nodes) || $$.is.array(opts.edges)) ){
				var elesByGroup = opts;
				var jsons = [];

				var grs = ["nodes", "edges"];
				for( var i = 0, il = grs.length; i < il; i++ ){
					var group = grs[i];
					var elesArray = elesByGroup[group];

					if( $$.is.array(elesArray) ){

						for( var j = 0, jl = elesArray.length; j < jl; j++ ){
							var json = elesArray[j];

							var mjson = $.extend({}, json, { group: group });
							jsons.push( mjson );
						}
					} 
				}

				elements = new $$.CyCollection(cy, jsons);
			}
			
			// specify options for one element
			else {
				var json = opts;
				elements = (new $$.CyElement( cy, json )).collection();
			}
			
			return elements.filter(function(){
				return !this.removed();
			});
		},
		
		remove: function(collection){
			if( !$$.is.elementOrCollection(collection) ){
				collection = collection;
			} else if( $$.is.string(collection) ){
				var selector = collection;
				collection = this.$( selector );
			}
			
			return collection.remove();
		},
		
		load: function(elements, onload, ondone){
			var cy = this;
			
			// remove old elements
			var oldEles = cy.elements();
			if( oldEles.length > 0 ){
				oldEles.remove();
			}

			cy.notifications(false);
			
			var processedElements = [];

			if( elements != null ){
				if( $$.is.plainObject(elements) || $$.is.array(elements) ){
					cy.add( elements );
				} 
			}
			
			function callback(){				
				cy.one("layoutready", function(e){
					cy.notifications(true);
					cy.trigger(e); // we missed this event by turning notifications off, so pass it on

					cy.notify({
						type: "load",
						collection: cy.elements(),
						style: cy._private.style
					});

					cy.one("load", onload);
					cy.trigger("load");
				}).one("layoutstop", function(){
					cy.one("done", ondone);
					cy.trigger("done");
				});
				
				cy.layout( cy._private.options.layout );

			}

			// TODO remove timeout when chrome reports dimensions onload properly
			// only affects when loading the html from localhost, i think...
			if( window.chrome ){
				setTimeout(function(){
					callback();
				}, 30);
			} else {
				callback();
			}

			return this;
		}
	});
	
})(jQuery, jQuery.cytoscape);
