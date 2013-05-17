;(function($$){
	
	var borderWidthMultiplier = 1.4;
	var borderWidthAdjustment = 1;

	$$.fn.eles({

		// fully updates (recalculates) the style for the elements
		updateStyle: function( notifyRenderer ){
			var cy = this._private.cy;
			var style = cy.style();
			notifyRenderer = notifyRenderer || notifyRenderer === undefined ? true : false;

			style.apply( this );

			if( notifyRenderer ){
				this.rtrigger("style"); // let renderer know we changed style
			} else {
				this.trigger("style"); // just fire the event
			}
			return this; // chaining
		},

		// just update the mappers in the elements' styles; cheaper than eles.updateStyle()
		updateMappers: function( notifyRenderer ){
			var cy = this._private.cy;
			var style = cy.style();
			notifyRenderer = notifyRenderer || notifyRenderer === undefined ? true : false;

			for( var i = 0; i < this.length; i++ ){
				var ele = this[i];
				style.apply( ele );
			}

			if( notifyRenderer ){
				this.rtrigger("style"); // let renderer know we changed style
			} else {
				this.trigger("style"); // just fire the event
			}
			return this; // chaining
		},

		data: $$.define.data({
			field: "data",
			bindingEvent: "data",
			allowBinding: true,
			allowSetting: true,
			settingEvent: "data",
			settingTriggersEvent: true,
			triggerFnName: "trigger",
			allowGetting: true,
			immutableKeys: {
				"id": true,
				"source": true,
				"target": true,
				"parent": true
			},
			updateMappers: true
		}),

		removeData: $$.define.removeData({
			field: "data",
			event: "data",
			triggerFnName: "trigger",
			triggerEvent: true,
			immutableKeys: {
				"id": true,
				"source": true,
				"target": true,
				"parent": true
			},
			updateMappers: true
		}),

		batchData: $$.define.batchData({
			field: "data",
			event: "data",
			triggerFnName: "trigger",
			immutableKeys: {
				"id": true,
				"source": true,
				"target": true,
				"parent": true
			},
			updateMappers: true
		}),

		scratch: $$.define.data({
			field: "scratch",
			allowBinding: false,
			allowSetting: true,
			settingTriggersEvent: false,
			allowGetting: true
		}),

		removeScratch: $$.define.removeData({
			field: "scratch",
			triggerEvent: false
		}),

		rscratch: $$.define.data({
			field: "rscratch",
			allowBinding: false,
			allowSetting: true,
			settingTriggersEvent: false,
			allowGetting: true
		}),

		removeRscratch: $$.define.removeData({
			field: "rscratch",
			triggerEvent: false
		}),

		id: function(){
			var ele = this[0];

			if( ele ){
				return ele._private.data.id;
			}
		},

		position: $$.define.data({
			field: "position",
			bindingEvent: "position",
			allowBinding: true,
			allowSetting: true,
			settingEvent: "position",
			settingTriggersEvent: true,
			triggerFnName: "rtrigger",
			allowGetting: true,
			validKeys: ["x", "y"]
		}),

		positions: function( pos ){
			if( $$.is.plainObject(pos) ){
				this.position(pos);
				
			} else if( $$.is.fn(pos) ){
				var fn = pos;
				
				for( var i = 0; i < this.length; i++ ){
					var ele = this[i];

					var pos = fn.apply(ele, [i, ele]);

					if( pos && !ele.locked() ){
						var elePos = ele._private.position;
						elePos.x = pos.x;
						elePos.y = pos.y;
					}
				}
				
				this.rtrigger("position");
			}

			return this; // chaining
		},

		// get the rendered (i.e. on screen) positon of the element
		// TODO allow setting
		renderedPosition: function( dim ){
			var ele = this[0];
			var cy = this.cy();
			var zoom = cy.zoom();
			var pan = cy.pan();

			if( ele && ele.isNode() ){ // must have an element and must be a node to return position
				var pos = ele._private.position;
				var rpos = {
					x: pos.x * zoom + pan.x,
					y: pos.y * zoom + pan.y
				};

				if( dim === undefined ){ // then return the whole rendered position
					return rpos;
				} else { // then return the specified dimension
					return rpos[ dim ];
				}
			}
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
			this.css("visibility", "visible");
			return this; // chaining
		},

		hide: function(){
			this.css("visibility", "hidden");
			return this; // chaining
		},

		visible: function(){
			var ele = this[0];

			if( ele ){
				if( ele.css("visibility") !== "visible" ){
					return false;
				}
				
				if( ele.isNode() ){
					var parents = ele.parents();
					for( var i = 0; i < parents.length; i++ ){
						var parent = parents[i];
						var parentVisibility = parent.css("visibility");

						if( parentVisibility !== "visible" ){
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
				return !this.visible();
			}
		},

		// convenience function to get a numerical value for the width of the node/edge
		width: function(){
			var ele = this[0];

			if( ele ){
				var w = this._private.style.width;
				return w.strValue === "auto" ? ele._private.autoWidth : w.pxValue;
			}
		},

		outerWidth: function(){
			var ele = this[0];

			if( ele ){
				var style = this._private.style;
				var width = style.width.strValue === "auto" ? ele._private.autoWidth : style.width.pxValue;;
				var border = style["border-width"] ? style["border-width"].pxValue * borderWidthMultiplier + borderWidthAdjustment : 0;

				return width + border;
			}
		},

		renderedWidth: function(){
			var ele = this[0];

			if( ele ){
				var width = this.width();
				return width * this.cy().zoom();
			}
		},

		renderedOuterWidth: function(){
			var ele = this[0];

			if( ele ){
				var owidth = this.outerWidth();
				return owidth * this.cy().zoom();
			}
		},

		// convenience function to get a numerical value for the height of the node
		height: function(){
			var ele = this[0];

			if( ele && ele.isNode() ){
				var h = this._private.style.height;
				return h.strValue === "auto" ? ele._private.autoHeight : h.pxValue;
			}
		},

		outerHeight: function(){
			var ele = this[0];

			if( ele ){
				var style = this._private.style;
				var height = style.height.strValue === "auto" ? ele._private.autoHeight : style.height.pxValue;
				var border = style["border-width"] ? style["border-width"].pxValue * borderWidthMultiplier + borderWidthAdjustment : 0;

				return height + border;
			}
		},

		renderedHeight: function(){
			var ele = this[0];

			if( ele ){
				var height = this.height();
				return height * this.cy().zoom();
			}
		},

		renderedOuterHeight: function(){
			var ele = this[0];

			if( ele ){
				var oheight = this.outerHeight();
				return oheight * this.cy().zoom();
			}
		},

		// get the position of the element relative to the container (i.e. not relative to parent node)
		offset: function(){
			var ele = this[0];

			if( ele && ele.isNode() ){
				var offset = {
					x: ele._private.position.x,
					y: ele._private.position.y
				};

				var parents = ele.parents();
				for( var i = 0; i < parents.length; i++ ){
					var parent = parents[i];
					var parentPos = parent._private.position;

					offset.x += parentPos.x;
					offset.y += parentPos.y;
				}

				return offset;
			}
		},

		renderedOffset: function(){
			var ele = this[0];

			if( ele && ele.isNode() ){
				var offset = this.offset();
				var cy = this.cy();
				var zoom = cy.zoom();
				var pan = cy.pan();

				return {
					x: offset.x * zoom + pan.x,
					y: offset.y * zoom + pan.y
				};
			}
		},

		// get the bounding box of the elements (in raw model position)
		boundingBox: function( selector ){
			var eles = this;

			if( !selector || ( $$.is.elementOrCollection(selector) && selector.length === 0 ) ){
				eles = this;
			} else if( $$.is.string(selector) ){
				eles = this.filter( selector );
			} else if( $$.is.elementOrCollection(selector) ){
				eles = selector;
			}

			var x1 = Infinity;
			var x2 = -Infinity;
			var y1 = Infinity;
			var y2 = -Infinity;

			// find bounds of elements
			for( var i = 0; i < eles.length; i++ ){
				var ele = eles[i];
				var ex1, ex2, ey1, ey2, x, y;				

				if( ele.isNode() ){
					var pos = ele._private.position;
					x = pos.x;
					y = pos.y;
					var w = ele.outerWidth();
					var halfW = w/2;
					var h = ele.outerHeight();
					var halfH = h/2;

					// handle node dimensions
					/////////////////////////

					ex1 = x - halfW;
					ex2 = x + halfW;
					ey1 = y - halfH;
					ey2 = y + halfH;

					x1 = ex1 < x1 ? ex1 : x1;
					x2 = ex2 > x2 ? ex2 : x2;
					y1 = ey1 < y1 ? ey1 : y1;
					y2 = ey2 > y2 ? ey2 : y2;

				} else { // is edge
					var n1pos = ele.source()[0]._private.position;
					var n2pos = ele.target()[0]._private.position;

					// handle edge dimensions (rough box estimate)
					//////////////////////////////////////////////

					var rstyle = ele._private.rstyle;
					x = rstyle.labelX;
					y = rstyle.labelY;

					ex1 = n1pos.x;
					ex2 = n2pos.x;
					ey1 = n1pos.y;
					ey2 = n2pos.y;

					if( ex1 > ex2 ){
						var temp = ex1;
						ex1 = ex2;
						ex2 = temp;
					}

					if( ey1 > ey2 ){
						var temp = ey1;
						ey1 = ey2;
						ey2 = temp;
					}

					x1 = ex1 < x1 ? ex1 : x1;
					x2 = ex2 > x2 ? ex2 : x2;
					y1 = ey1 < y1 ? ey1 : y1;
					y2 = ey2 > y2 ? ey2 : y2;

					// handle points along edge (sanity check)
					//////////////////////////////////////////

					var bpts = rstyle.bezierPts || [];
					var w = ele._private.style['width'].value;
					for( var j = 0; j < bpts.length; j++ ){
						var bpt = bpts[j];

						x1 = bpt.x - w < x1 ? bpt.x - w : x1;
						x2 = bpt.x + w > x2 ? bpt.x + w : x2;
						y1 = bpt.y - w < y1 ? bpt.y - w : y1;
						y2 = bpt.y + w > y2 ? bpt.y + w : y2;
					}

				}

				// handle label dimensions
				//////////////////////////

				var style = ele._private.style;
				var label = style['content'].value;
				var fontSize = style['font-size'];
				var halign = style['text-halign'];
				var valign = style['text-valign'];
				var labelWidth = ele._private.rstyle.labelWidth;

				if( label && fontSize && labelWidth != undefined && halign && valign ){
					var lh = fontSize.value;
					var lw = labelWidth;
					var lx1, lx2, ly1, ly2;

					switch( halign.value ){
						case "left":
							lx1 = ex1 - lw;
							lx2 = ex1;
							break;

						case "center":
							lx1 = x - lw/2;
							lx2 = x + lw/2;
							break;

						case "right":
							lx1 = ex2;
							lx2 = ex2 + lw;
							break;
					}

					if( ele.isEdge() ){ // force center case
						lx1 = x - lw/2;
						lx2 = x + lw/2;
					}

					switch( valign.value ){
						case "top":
							ly1 = ey1 - lh;
							ly2 = ey1;
							break;

						case "center":
							ly1 = y - lh/2;
							ly2 = y + lh/2;
							break;

						case "bottom":
							ly1 = ey2;
							ly2 = ey2 + lh;
							break;
					}

					if( ele.isEdge() ){ // force center case
						ly1 = y - lh/2;
						ly2 = y + lh/2;
					}

					x1 = lx1 < x1 ? lx1 : x1;
					x2 = lx2 > x2 ? lx2 : x2;
					y1 = ly1 < y1 ? ly1 : y1;
					y2 = ly2 > y2 ? ly2 : y2;
				}
			} // for

			// testing on debug page
			// $('#bb').remove();
			// $('#cytoscape').css('position', 'relative').append('<div id="bb"></div>');
			// $('#bb').css({
			// 	'position': 'absolute',
			// 	'left': x1,
			// 	'top': y1,
			// 	'width': x2 - x1,
			// 	'height': y2 - y1,
			// 	'background': 'rgba(255, 0, 0, 0.5)'
			// })

			return {
				x1: x1,
				x2: x2,
				y1: y1,
				y2: y2,
				w: x2 - x1,
				h: y2 - y1
			};
		}
	});

	
})( cytoscape );
