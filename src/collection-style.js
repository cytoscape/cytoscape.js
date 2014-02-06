;(function($$){ "use strict";
	
	var borderWidthMultiplier = 2 * 0.5;
	var borderWidthAdjustment = 0;

	$$.fn.eles({

		// fully updates (recalculates) the style for the elements
		updateStyle: function( notifyRenderer ){
			var cy = this._private.cy;
			var style = cy.style();
			notifyRenderer = notifyRenderer || notifyRenderer === undefined ? true : false;

			style.apply( this );

			var updatedCompounds = this.updateCompoundBounds();

			if( notifyRenderer ){
				this.add( updatedCompounds ).rtrigger("style"); // let renderer know we changed style
			} else {
				this.add( updatedCompounds ).trigger("style"); // just fire the event
			}
			return this; // chaining
		},

		// just update the mappers in the elements' styles; cheaper than eles.updateStyle()
		updateMappers: function( notifyRenderer ){
			var cy = this._private.cy;
			var style = cy.style();
			notifyRenderer = notifyRenderer || notifyRenderer === undefined ? true : false;

			style.updateMappers( this );

			var updatedCompounds = this.updateCompoundBounds();

			if( notifyRenderer ){
				this.add( updatedCompounds ).rtrigger("style"); // let renderer know we changed style
			} else {
				this.add( updatedCompounds ).trigger("style"); // just fire the event
			}
			return this; // chaining
		},

		// get the specified css property as a rendered value (i.e. on-screen value)
		// or get the whole rendered style if no property specified (NB doesn't allow setting)
		renderedCss: function( property ){
			var ele = this[0];

			if( ele ){
				var renstyle = ele.cy().style().getRenderedStyle( ele );

				if( property === undefined ){
					return renstyle;
				} else {
					return renstyle[ property ];
				}
			}
		},

		// read the calculated css style of the element or override the style (via a bypass)
		css: function( name, value ){
			var style = this.cy().style();

			if( $$.is.plainObject(name) ){ // then extend the bypass
				var props = name;
				style.applyBypass( this, props );
				this.rtrigger("style"); // let the renderer know we've updated style

			} else if( $$.is.string(name) ){
	
				if( value === undefined ){ // then get the property from the style
					var ele = this[0];

					if( ele ){
						return ele._private.style[ name ].strValue;
					} else { // empty collection => can't get any value
						return;
					}

				} else { // then set the bypass with the property value
					style.applyBypass( this, name, value );
					this.rtrigger("style"); // let the renderer know we've updated style
				}

			} else if( name === undefined ){
				var ele = this[0];

				if( ele ){
					return style.getRawStyle( ele );
				} else { // empty collection => can't get any value
					return;
				}
			}

			return this; // chaining
		},

		removeCss: function(){
			var style = this.cy().style();
			var eles = this;

			for( var i = 0; i < eles.length; i++ ){
				var ele = eles[i];

				style.removeAllBypasses( ele );
			}

			this.rtrigger('style');
		},

		show: function(){
			this.css("display", "element");
			return this; // chaining
		},

		hide: function(){
			this.css("display", "none");
			return this; // chaining
		},

		visible: function(){
			var ele = this[0];

			if( ele ){
				if(
					ele.css("visibility") !== "visible"
				||  ele.css("display") !== "element"
				// ||  parseFloat( ele.css("opacity") ) === 0
				){
					return false;
				}
				
				if( ele.isNode() ){
					var parents = ele.parents();
					for( var i = 0; i < parents.length; i++ ){
						var parent = parents[i];
						var pVis = parent.css("visibility");
						var pDis = parent.css("display");
						var pOpac = parseFloat( parent.css("opacity") );

						if( pVis !== "visible" || pDis !== "element" ){
							return false;
						}
					}

					return true;
				} else if( ele.isEdge() ){
					var src = ele.source();
					var tgt = ele.target();

					return src.visible() && tgt.visible();
				}

			}
		},

		hidden: function(){
			var ele = this[0];

			if( ele ){
				return !ele.visible();
			}
		},

		effectiveOpacity: function(){
			var ele = this[0];

			if( ele ){
				var parentOpacity = ele._private.style.opacity.value;
				var parents = ele.parents();
				
				for( var i = 0; i < parents.length; i++ ){
					var parent = parents[i];
					var opacity = parent._private.style.opacity.value;

					parentOpacity = opacity * parentOpacity;
				}

				return parentOpacity;
			}
		},

		transparent: function(){
			var ele = this[0];

			if( ele ){
				return ele.effectiveOpacity() === 0;
			}
		},

		isFullAutoParent: function(){
			var ele = this[0];

			if( ele ){
				var autoW = ele._private.style["width"].value === "auto";
				var autoH = ele._private.style["height"].value === "auto";

				return ele.isParent() && autoW && autoH;
			}
		}

	});


	$$.elesfn.style = $$.elesfn.css;
	$$.elesfn.renderedStyle = $$.elesfn.renderedCss;
	$$.elesfn.removeStyle = $$.elesfn.removeCss;
	
})( cytoscape );