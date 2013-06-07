;(function($$, window){
	
	var isTouch = ('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch;

	$$.Style = function( cy ){

		if( !(this instanceof $$.Style) ){
			return new $$.Style(cy);
		}

		if( !$$.is.core(cy) ){
			$$.util.error("A style must have a core reference");
			return;
		}

		this._private = {
			cy: cy,
			coreStyle: {}
		};
		
		this.length = 0;

		this.addDefaultStylesheet();
	};

	// nice-to-have aliases
	$$.style = $$.Style;
	$$.styfn = $$.Style.prototype;

	// define functions in the Style prototype
	$$.fn.style = function( fnMap, options ){
		for( var fnName in fnMap ){
			var fn = fnMap[ fnName ];
			$$.Style.prototype = fn;
		}
	};

	// a dummy stylesheet object that doesn't need a reference to the core
	$$.stylesheet = $$.Stylesheet = function(){
		if( !(this instanceof $$.Stylesheet) ){
			return new $$.Stylesheet();
		}

		this.length = 0;
	};

	// just store the selector to be parsed later
	$$.Stylesheet.prototype.selector = function( selector ){
		var i = this.length++;

		this[i] = {
			selector: selector,
			properties: []
		};

		return this; // chaining
	};

	// just store the property to be parsed later
	$$.Stylesheet.prototype.css = function( name, value ){
		var i = this.length - 1;

		if( $$.is.string(name) ){
			this[i].properties.push({
				name: name,
				value: value
			});
		} else if( $$.is.plainObject(name) ){
			map = name;

			for( var j = 0; j < $$.style.properties.length; j++ ){
				var prop = $$.style.properties[j];
				var mapVal = map[ prop.name ];

				if( mapVal === undefined ){ // also try camel case name
					mapVal = map[ $$.util.dash2camel(prop.name) ];
				}

				if( mapVal !== undefined ){
					var name = prop.name;
					var value = mapVal;

					this[i].properties.push({
						name: name,
						value: value
					});
				}
			}
		}

		return this; // chaining
	};

	// generate a real style object from the dummy stylesheet
	$$.Stylesheet.prototype.generateStyle = function( cy ){
		var style = new $$.Style(cy);

		for( var i = 0; i < this.length; i++ ){
			var context = this[i];
			var selector = context.selector;
			var props = context.properties;

			style.selector(selector); // apply selector

			for( var j = 0; j < props.length; j++ ){
				var prop = props[j];

				style.css( prop.name, prop.value ); // apply property
			}
		}

		return style;
	};

	$$.Stylesheet.prototype.assignToStyle = function( style, addDefaultStylesheet ){
		style.clear();

		if( addDefaultStylesheet || addDefaultStylesheet === undefined ){
			style.addDefaultStylesheet();
		}

		for( var i = 0; i < this.length; i++ ){
			var context = this[i];
			var selector = context.selector;
			var props = context.properties;

			style.selector(selector); // apply selector

			for( var j = 0; j < props.length; j++ ){
				var prop = props[j];

				style.css( prop.name, prop.value ); // apply property
			}
		}
	};

	(function(){
		var number = $$.util.regex.number;
		var rgba = $$.util.regex.rgbaNoBackRefs;
		var hsla = $$.util.regex.hslaNoBackRefs;
		var hex3 = $$.util.regex.hex3;
		var hex6 = $$.util.regex.hex6;

		// each visual style property has a type and needs to be validated according to it
		$$.style.types = {
			zeroOneNumber: { number: true, min: 0, max: 1, unitless: true },
			nonNegativeInt: { number: true, min: 0, integer: true, unitless: true },
			size: { number: true, min: 0, enums: ["auto"] },
			bgSize: { number: true, min: 0, allowPercent: true },
			color: { color: true },
			lineStyle: { enums: ["solid", "dotted", "dashed"] },
			curveStyle: { enums: ["bundled", "bezier"] },
			fontFamily: { regex: "^([\\w- ]+(?:\\s*,\\s*[\\w- ]+)*)$" },
			fontVariant: { enums: ["small-caps", "normal"] },
			fontStyle: { enums: ["italic", "normal", "oblique"] },
			fontWeight: { enums: ["normal", "bold", "bolder", "lighter", "100", "200", "300", "400", "500", "600", "800", "900", 100, 200, 300, 400, 500, 600, 700, 800, 900] },
			textDecoration: { enums: ["none", "underline", "overline", "line-through"] },
			textTransform: { enums: ["none", "capitalize", "uppercase", "lowercase"] },
			nodeShape: { enums: ["rectangle", "roundrectangle", "ellipse", "triangle",
			                     "square", "pentagon", "hexagon", "heptagon", "octagon"] },
			arrowShape: { enums: ["tee", "triangle", "square", "circle", "diamond", "none"] },
			visibility: { enums: ["hidden", "visible"] },
			valign: { enums: ["top", "center", "bottom"] },
			halign: { enums: ["left", "center", "right"] },
			positionx: { enums: ["left", "center", "right"], number: true, allowPercent: true },
			positiony: { enums: ["top", "center", "bottom"], number: true, allowPercent: true },
			bgRepeat: { enums: ["repeat", "repeat-x", "repeat-y", "no-repeat"] },
			cursor: { enums: ["auto", "crosshair", "default", "e-resize", "n-resize", "ne-resize", "nw-resize", "pointer", "progress", "s-resize", "sw-resize", "text", "w-resize", "wait", "grab", "grabbing"] },
			text: { string: true },
			data: { mapping: true, regex: "^data\\s*\\(\\s*([\\w\\.]+)\\s*\\)$" },
			mapData: { mapping: true, regex: "^mapData\\(([\\w\\.]+)\\s*\\,\\s*(" + number + ")\\s*\\,\\s*(" + number + ")\\s*,\\s*(" + number + "|\\w+|" + rgba + "|" + hsla + "|" + hex3 + "|" + hex6 + ")\\s*\\,\\s*(" + number + "|\\w+|" + rgba + "|" + hsla + "|" + hex3 + "|" + hex6 + ")\\)$" },
			url: { regex: "^url\\s*\\(\\s*([^\\s]+)\\s*\\s*\\)|none|(.+)$" }
		};

		// define visual style properties
		var t = $$.style.types;
		$$.style.properties = [
			// these are for elements
			{ name: "cursor", type: t.cursor },
			{ name: "text-valign", type: t.valign },
			{ name: "text-halign", type: t.halign },
			{ name: "color", type: t.color },
			{ name: "content", type: t.text },
			{ name: "text-outline-color", type: t.color },
			{ name: "text-outline-width", type: t.size },
			{ name: "text-outline-opacity", type: t.zeroOneNumber },
			{ name: "text-opacity", type: t.zeroOneNumber },
			{ name: "text-decoration", type: t.textDecoration },
			{ name: "text-transform", type: t.textTransform },
			{ name: "font-family", type: t.fontFamily },
			{ name: "font-style", type: t.fontStyle },
			{ name: "font-variant", type: t.fontVariant },
			{ name: "font-weight", type: t.fontWeight },
			{ name: "font-size", type: t.size },
			{ name: "min-zoomed-font-size", type: t.size },
			{ name: "visibility", type: t.visibility },
			{ name: "opacity", type: t.zeroOneNumber },
			{ name: "z-index", type: t.nonNegativeInt },
			{ name: "overlay-padding", type: t.size },
			{ name: "overlay-color", type: t.color },
			{ name: "overlay-opacity", type: t.zeroOneNumber },

			// these are just for nodes
			{ name: "background-color", type: t.color },
			{ name: "background-opacity", type: t.zeroOneNumber },
			{ name: "background-image", type: t.url },
			{ name: "background-position-x", type: t.positionx },
			{ name: "background-position-y", type: t.positiony },
			{ name: "background-repeat", type: t.bgRepeat },
			{ name: "background-size-x", type: t.bgSize },
			{ name: "background-size-y", type: t.bgSize },
			{ name: "border-color", type: t.color },
			{ name: "border-opacity", type: t.zeroOneNumber },
			{ name: "border-width", type: t.size },
			{ name: "border-style", type: t.lineStyle },
			{ name: "height", type: t.size },
			{ name: "width", type: t.size },
			{ name: "padding-left", type: t.size },
			{ name: "padding-right", type: t.size },
			{ name: "padding-top", type: t.size },
			{ name: "padding-bottom", type: t.size },
			{ name: "shape", type: t.nodeShape },

			// these are just for edges
			{ name: "source-arrow-shape", type: t.arrowShape },
			{ name: "target-arrow-shape", type: t.arrowShape },
			{ name: "source-arrow-color", type: t.color },
			{ name: "target-arrow-color", type: t.color },
			{ name: "line-style", type: t.lineStyle },
			{ name: "line-color", type: t.color },
			{ name: "control-point-step-size", type: t.size },
			{ name: "curve-style", type: t.curveStyle },

			// these are just for the core
			{ name: "selection-box-color", type: t.color },
			{ name: "selection-box-opacity", type: t.zeroOneNumber },
			{ name: "selection-box-border-color", type: t.color },
			{ name: "selection-box-border-width", type: t.size },
			{ name: "panning-cursor", type: t.cursor },
			{ name: "active-bg-color", type: t.color },
			{ name: "active-bg-opacity", type: t.zeroOneNumber },
			{ name: "active-bg-size", type: t.size }
		];

		// allow access of properties by name ( e.g. $$.style.properties.height )
		var props = $$.style.properties;
		for( var i = 0; i < props.length; i++ ){
			var prop = props[i];
			
			props[ prop.name ] = prop; // allow lookup by name
		}
	})();

	// adds the default stylesheet to the current style
	$$.styfn.addDefaultStylesheet = function(){
		// to be nice, we build font related style properties from the core container
		// so that cytoscape matches the style of its container by default
		var fontFamily = this.containerPropertyAsString("font-family") || "sans-serif";
		var fontStyle = this.containerPropertyAsString("font-style") || "normal";
		var fontVariant = this.containerPropertyAsString("font-variant") || "normal";
		var fontWeight = this.containerPropertyAsString("font-weight") || "normal";
		var color = this.containerPropertyAsString("color") || "#000";
		var textTransform = this.containerPropertyAsString("text-transform") || "none";
		var textDecoration = this.containerPropertyAsString("text-decoration") || "none";
		var fontSize = this.containerPropertyAsString("font-size") || 12;

		// fill the style with the default stylesheet
		this
			.selector("node, edge") // common properties
				.css({
					"cursor": "default",
					"text-valign": "top",
					"text-halign": "center",
					"color": color,
					"content": undefined, // => no label
					"text-outline-color": "#000",
					"text-outline-width": 0,
					"text-outline-opacity": 1,
					"text-opacity": 1,
					"text-decoration": "none",
					"text-transform": textTransform,
					"font-family": fontFamily,
					"font-style": fontStyle,
					"font-variant": fontVariant,
					"font-weight": fontWeight,
					"font-size": fontSize,
					"min-zoomed-font-size": 0,
					"visibility": "visible",
					"opacity": 1,
					"z-index": 0,
					"content": "",
					"overlay-opacity": 0,
					"overlay-color": "#000",
					"overlay-padding": 10,

					// node props
					"background-color": "#888",
					"background-opacity": 1,
					"background-image": "none",
					"border-color": "#000",
					"border-opacity": 1,
					"border-width": 0,
					"border-style": "solid",
					"height": 30,
					"width": 30,
					"padding-top": 0,
					"padding-bottom": 0,
					"padding-left": 0,
					"padding-right": 0,
					"shape": "ellipse",

					// edge props
					"source-arrow-shape": "none",
					"target-arrow-shape": "none",
					"source-arrow-color": "#bbb",
					"target-arrow-color": "#bbb",
					"line-style": "solid",
					"line-color": "#bbb",
					"control-point-step-size": 40,
					"curve-style": "bezier"
				})
			.selector("$node > node") // compound (parent) node properties
				.css({
					"width": "auto",
					"height": "auto",
					"shape": "rectangle",
					"background-opacity": 0.5,
					"padding-top": 10,
					"padding-right": 10,
					"padding-left": 10,
					"padding-bottom": 10
				})
			.selector("edge") // just edge properties
				.css({
					"width": 1,
				})
			.selector(":active")
				.css({
					"overlay-color": "black",
					"overlay-padding": 10,
					"overlay-opacity": 0.25
				})
			.selector("core") // just core properties
				.css({
					"selection-box-color": "#ddd",
					"selection-box-opacity": 0.65,
					"selection-box-border-color": "#aaa",
					"selection-box-border-width": 1,
					"panning-cursor": "grabbing",
					"active-bg-color": "black",
					"active-bg-opacity": 0.15,
					"active-bg-size": isTouch ? 40 : 15
				})
		;
	};

	// remove all contexts
	$$.styfn.clear = function(){
		this._private.newStyle = true;

		for( var i = 0; i < this.length; i++ ){
			delete this[i];
		}
		this.length = 0;

		return this; // chaining
	};

	$$.styfn.resetToDefault = function(){
		this.clear();
		this.addDefaultStylesheet();

		return this;
	};

	// builds a style object for the "core" selector
	$$.styfn.core = function(){
		return this._private.coreStyle;
	};

	// parse a property; return null on invalid; return parsed property otherwise
	// fields :
	// - name : the name of the property
	// - value : the parsed, native-typed value of the property
	// - strValue : a string value that represents the property value in valid css
	// - bypass : true iff the property is a bypass property
	$$.styfn.parse = function( name, value, propIsBypass ){
		
		name = $$.util.camel2dash( name ); // make sure the property name is in dash form (e.g. "property-name" not "propertyName")
		var property = $$.style.properties[ name ];
		var passedValue = value;
		
		if( !property ){ return null; } // return null on property of unknown name
		if( value === undefined || value === null ){ return null; } // can't assign null

		var valueIsString = $$.is.string(value);
		if( valueIsString ){ // trim the value to make parsing easier
			value = $$.util.trim( value );
		}

		var type = property.type;
		if( !type ){ return null; } // no type, no luck

		// check if bypass is null or empty string (i.e. indication to delete bypass property)
		if( propIsBypass && (value === "" || value === null) ){
			return {
				name: name,
				value: value,
				bypass: true,
				deleteBypass: true
			};
		}

		// check if value is mapped
		var data, mapData;
		if( !valueIsString ){
			// then don't bother to do the expensive regex checks

		} else if( data = new RegExp( $$.style.types.data.regex ).exec( value ) ){
			return {
				name: name,
				value: data,
				strValue: value,
				mapped: $$.style.types.data,
				field: data[1],
				bypass: propIsBypass
			};

		} else if( mapData = new RegExp( $$.style.types.mapData.regex ).exec( value ) ){
			// we can map only if the type is a colour or a number
			if( !(type.color || type.number) ){ return false; }

			var valueMin = this.parse( name, mapData[4]); // parse to validate
			if( !valueMin || valueMin.mapped ){ return false; } // can't be invalid or mapped

			var valueMax = this.parse( name, mapData[5]); // parse to validate
			if( !valueMax || valueMax.mapped ){ return false; } // can't be invalid or mapped

			// check if valueMin and valueMax are the same
			if( valueMin.value === valueMax.value ){
				return false; // can't make much of a mapper without a range
			
			} else if( type.color ){
				var c1 = valueMin.value;
				var c2 = valueMax.value;
				
				var same = c1[0] === c2[0] // red
					&& c1[1] === c2[1] // green
					&& c1[2] === c2[2] // blue
					&& ( // optional alpha
						c1[3] === c2[3] // same alpha outright
						|| (
							(c1[3] == null || c1[3] === 1) // full opacity for colour 1?
							&&
							(c2[3] == null || c2[3] === 1) // full opacity for colour 2?
						)
					)
				;

				if( same ){ return false; } // can't make a mapper without a range
			}

			return {
				name: name,
				value: mapData,
				strValue: value,
				mapped: $$.style.types.mapData,
				field: mapData[1],
				fieldMin: parseFloat( mapData[2] ), // min & max are numeric
				fieldMax: parseFloat( mapData[3] ),
				valueMin: valueMin.value,
				valueMax: valueMax.value,
				bypass: propIsBypass
			};
		}

		// TODO check if value is inherited (i.e. "inherit")

		// check the type and return the appropriate object
		if( type.number ){
			var units;
			if( !type.unitless ){
				if( valueIsString ){
					var match = value.match( "^(" + $$.util.regex.number + ")(px|em" + (type.allowPercent ? "|\\%" : "") + ")?" + "$" );
					
					if( !type.enums ){
						if( !match ){ return null; } // no match => not a number

						value = match[1];
						units = match[2] || "px";
					}
				} else {
					units = "px"; // implicitly px if unspecified
				}
			}

			value = parseFloat( value );

			// check if this number type also accepts special keywords in place of numbers
			// (i.e. `left`, `auto`, etc)
			if( isNaN(value) && type.enums !== undefined ){
				value = passedValue;

				for( var i = 0; i < type.enums.length; i++ ){
					var en = type.enums[i];

					if( en === value ){
						return {
							name: name,
							value: value,
							strValue: value,
							bypass: propIsBypass
						};
					}
				}

				return null; // failed on enum after failing on number
			}

			// check if value must be an integer
			if( type.integer && !$$.is.integer(value) ){
				return null;
			}

			// check value is within range
			if( (type.min !== undefined && value < type.min) 
			|| (type.max !== undefined && value > type.max)
			){
				return null;
			}

			var ret = {
				name: name,
				value: value,
				strValue: "" + value + (units ? units : ""),
				units: units,
				bypass: propIsBypass,
				pxValue: type.unitless || units === "%" ?
					undefined
					:
					( units === "px" || !units ? (value) : (this.getEmSizeInPixels() * value) )
			};

			return ret;

		} else if( type.color ){
			var tuple = $$.util.color2tuple( value );

			return {
				name: name,
				value: tuple,
				strValue: value,
				bypass: propIsBypass
			};

		} else if( type.enums ){
			for( var i = 0; i < type.enums.length; i++ ){
				var en = type.enums[i];

				if( en === value ){
					return {
						name: name,
						value: value,
						strValue: value,
						bypass: propIsBypass
					};
				}
			}

		} else if( type.regex ){
			var regex = new RegExp( type.regex ); // make a regex from the type
			var m = regex.exec( value );

			if( m ){ // regex matches
				return {
					name: name,
					value: m,
					strValue: value,
					bypass: propIsBypass
				};
			} else { // regex doesn't match
				return null; // didn't match the regex so the value is bogus
			}

		} else if( type.string ){
			// just return
			return {
				name: name,
				value: value,
				strValue: value,
				bypass: propIsBypass
			};

		} else {
			return null; // not a type we can handle
		}

	};

	// gets what an em size corresponds to in pixels relative to a dom element
	$$.styfn.getEmSizeInPixels = function(){
		var cy = this._private.cy;
		var domElement = cy.container();

		if( window && domElement ){
			var pxAsStr = window.getComputedStyle(domElement).getPropertyValue("font-size");
			var px = parseFloat( pxAsStr );
			return px;
		} else {
			return 1; // in case we're running outside of the browser
		}
	};

	// gets css property from the core container
	$$.styfn.containerCss = function( propName ){
		var cy = this._private.cy;
		var domElement = cy.container();

		if( window && domElement ){
			return window.getComputedStyle(domElement).getPropertyValue( propName );
		}
	};

	$$.styfn.containerProperty = function( propName ){
		var propStr = this.containerCss( propName );
		var prop = this.parse( propName, propStr );
		return prop;
	};

	$$.styfn.containerPropertyAsString = function( propName ){
		var prop = this.containerProperty( propName );

		if( prop ){
			return prop.strValue;
		}
	};

	// create a new context from the specified selector string and switch to that context
	$$.styfn.selector = function( selectorStr ){
		// "core" is a special case and does not need a selector
		var selector = selectorStr === "core" ? null : new $$.Selector( selectorStr );

		var i = this.length++; // new context means new index
		this[i] = {
			selector: selector,
			properties: []
		};

		return this; // chaining
	};

	// add one or many css rules to the current context
	$$.styfn.css = function(){
		var args = arguments;

		switch( args.length ){
		case 1:
			var map = args[0];

			for( var i = 0; i < $$.style.properties.length; i++ ){
				var prop = $$.style.properties[i];
				var mapVal = map[ prop.name ];

				if( mapVal === undefined ){
					mapVal = map[ $$.util.dash2camel(prop.name) ];
				}

				if( mapVal !== undefined ){
					this.cssRule( prop.name, mapVal );
				}
			}

			break;

		case 2:
			this.cssRule( args[0], args[1] );
			break;

		default:
			break; // do nothing if args are invalid
		}

		return this; // chaining
	};

	// add a single css rule to the current context
	$$.styfn.cssRule = function( name, value ){
		// name-value pair
		var property = this.parse( name, value );

		// add property to current context if valid
		if( property ){
			var i = this.length - 1;
			this[i].properties.push( property );

			// add to core style if necessary
			var currentSelectorIsCore = !this[i].selector;
			if( currentSelectorIsCore ){
				this._private.coreStyle[ property.name ] = property;
			}
		}

		return this; // chaining
	};

	// apply a property to the style (for internal use)
	// returns whether application was successful
	//
	// now, this function flattens the property, and here's how:
	//
	// for parsedProp:{ bypass: true, deleteBypass: true }
	// no property is generated, instead the bypass property in the
	// element's style is replaced by what's pointed to by the `bypassed`
	// field in the bypass property (i.e. restoring the property the
	// bypass was overriding)
	//
	// for parsedProp:{ mapped: truthy }
	// the generated flattenedProp:{ mapping: prop }
	// 
	// for parsedProp:{ bypass: true }
	// the generated flattenedProp:{ bypassed: parsedProp } 
	$$.styfn.applyParsedProperty = function( ele, parsedProp, context ){
		parsedProp = $$.util.clone( parsedProp ); // copy b/c the same parsedProp may be applied to many elements, BUT
		// the instances put in each element should be unique to avoid overwriting other the lists of other elements

		var prop = parsedProp;
		var style = ele._private.style;
		var fieldVal, flatProp;
		var type = $$.style.properties[ prop.name ].type;
		var propIsBypass = prop.bypass;
		var origProp = style[ prop.name ];
		var origPropIsBypass = origProp && origProp.bypass;

		// can't apply auto to width or height unless it's a parent node
		if( (parsedProp.name === "height" || parsedProp.name === "width") && parsedProp.value === "auto" && ele.isNode() && !ele.isParent() ){
			return false;
		}

		// check if we need to delete the current bypass
		if( propIsBypass && prop.deleteBypass ){ // then this property is just here to indicate we need to delete
			var currentProp = style[ prop.name ];

			// can only delete if the current prop is a bypass and it points to the property it was overriding
			if( !currentProp ){
				return true; // property is already not defined
			} else if( currentProp.bypass && currentProp.bypassed ){ // then replace the bypass property with the original
				
				// because the bypassed property was already applied (and therefore parsed), we can just replace it (no reapplying necessary)
				style[ prop.name ] = currentProp.bypassed;
				return true;
			
			} else {
				return false; // we're unsuccessful deleting the bypass
			}
		}

		// put the property in the style objects
		switch( prop.mapped ){ // flatten the property if mapped
		case $$.style.types.mapData:
			fieldVal = ele._private.data[ prop.field ];
			if( !$$.is.number(fieldVal) ){ return false; } // it had better be a number

			var percent = (fieldVal - prop.fieldMin) / (prop.fieldMax - prop.fieldMin);

			if( type.color ){
				var r1 = prop.valueMin[0];
				var r2 = prop.valueMax[0];
				var g1 = prop.valueMin[1];
				var g2 = prop.valueMax[1];
				var b1 = prop.valueMin[2];
				var b2 = prop.valueMax[2];
				var a1 = prop.valueMin[3] == null ? 1 : prop.valueMin[3];
				var a2 = prop.valueMax[3] == null ? 1 : prop.valueMax[3];

				var clr = [
					Math.round( r1 + (r2 - r1)*percent ),
					Math.round( g1 + (g2 - g1)*percent ),
					Math.round( b1 + (b2 - b1)*percent ),
					Math.round( a1 + (a2 - a1)*percent )
				];

				flatProp = { // colours are simple, so just create the flat property instead of expensive string parsing
					bypass: prop.bypass, // we're a bypass if the mapping property is a bypass
					name: prop.name,
					value: clr,
					strValue: [ "rgba(", clr[0], ", ", clr[1], ", ", clr[2], ", ", clr[3] , ")" ].join("") // fake it til you make it
				};
			
			} else if( type.number ){
				var calcValue = prop.valueMin + (prop.valueMax - prop.valueMin) * percent;
				flatProp = this.parse( prop.name, calcValue, prop.bypass );
			
			} else {
				return false; // can only map to colours and numbers
			}

			if( !flatProp ){ // if we can't flatten the property, then use the origProp so we still keep the mapping itself
				flatProp = this.parse( prop.name, origProp.strValue, prop.bypass);
			} 

			flatProp.mapping = prop; // keep a reference to the mapping
			prop = flatProp; // the flattened (mapped) property is the one we want

			break;

		case $$.style.types.data: // direct mapping
			fieldVal = eval('ele._private.data.' + prop.field );

			flatProp = this.parse( prop.name, fieldVal, prop.bypass );
			if( !flatProp ){ // if we can't flatten the property, then use the origProp so we still keep the mapping itself
				flatProp = this.parse( prop.name, origProp.strValue, prop.bypass);
			} 

			flatProp.mapping = prop; // keep a reference to the mapping
			prop = flatProp; // the flattened (mapped) property is the one we want
			break;

		case undefined:
			break; // just set the property

		default: 
			return false; // danger, will robinson
		}

		// if the property is a bypass property, then link the resultant property to the original one
		if( propIsBypass ){
			if( origPropIsBypass ){ // then this bypass overrides the existing one
				prop.bypassed = origProp.bypassed; // steal bypassed prop from old bypass
			} else { // then link the orig prop to the new bypass
				prop.bypassed = origProp;
			}

			style[ prop.name ] = prop; // and set
		
		} else { // prop is not bypass
			var prevProp;

			if( origPropIsBypass ){ // then keep the orig prop (since it's a bypass) and link to the new prop
				prevProp = origProp.bypassed;
				
				origProp.bypassed = prop;
			} else { // then just replace the old prop with the new one
				prevProp = style[ prop.name ];

				style[ prop.name ] = prop; 
			}

			if( prevProp && prevProp.mapping && prop.mapping && prevProp.context === context ){
				prevProp = prevProp.prev;
			}

			if( prevProp && prevProp !== prop ){
				prop.prev = prevProp;
			}
		}

		prop.context = context;

		return true;
	};

	$$.styfn.rollBackContext = function( ele, context ){
		for( var j = 0; j < context.properties.length; j++ ){ // for each prop
			var prop = context.properties[j];
			var eleProp = ele._private.style[ prop.name ];

			// because bypasses do not store prevs, look at the bypassed property
			if( eleProp.bypassed ){
				eleProp = eleProp.bypassed;
			}

			var first = true;
			var lastEleProp;
			var l = 0;
			while( eleProp.prev ){
				var prev = eleProp.prev;

				if( eleProp.context === context ){

					if( first ){
						ele._private.style[ prop.name ] = prev;
					} else if( lastEleProp ){
						lastEleProp.prev = prev;
					}
					
				}

				lastEleProp = eleProp;
				eleProp = prev;
				first = false;
				l++;

				// in case we have a problematic prev list
				// if( l >= 100 ){
				// 	debugger;
				// }
			}
		}
	};


	// (potentially expensive calculation)
	// apply the style to the element based on
	// - its bypass
	// - what selectors match it
	$$.styfn.apply = function( eles ){
		var self = this;

		for( var ie = 0; ie < eles.length; ie++ ){
			var ele = eles[ie];

			if( self._private.newStyle ){
				ele._private.styleCxts = [];
				ele._private.style = {};
			}

			// apply the styles
			for( var i = 0; i < this.length; i++ ){
				var context = this[i];
				var contextSelectorMatches = context.selector && context.selector.filter( ele ).length > 0; // NB: context.selector may be null for "core"
				var props = context.properties;

				if( contextSelectorMatches ){ // then apply its properties

					// apply the properties in the context
					
					for( var j = 0; j < props.length; j++ ){ // for each prop
						var prop = props[j];

						//if(prop.mapped) debugger;

						if( !ele._private.styleCxts[i] || prop.mapped ){
							this.applyParsedProperty( ele, prop, context );
						}
					}

					// keep a note that this context matches
					ele._private.styleCxts[i] = context;
				} else {

					// roll back style cxts that don't match now
					if( ele._private.styleCxts[i] ){
						this.rollBackContext( ele, context );
					}

					delete ele._private.styleCxts[i];
				}
			} // for context

		} // for elements

		self._private.newStyle = false;
	};

	// updates the visual style for all elements (useful for manual style modification after init)
	$$.styfn.update = function(){
		var cy = this._private.cy;
		var eles = cy.elements();

		eles.updateStyle();
	};

	// gets the rendered style for an element
	$$.styfn.getRenderedStyle = function( ele ){
		var ele = ele[0]; // insure it's an element

		if( ele ){
			var rstyle = {};
			var style = ele._private.style;
			var cy = this._private.cy;
			var zoom = cy.zoom();

			for( var i = 0; i < $$.style.properties.length; i++ ){
				var prop = $$.style.properties[i];
				var styleProp = style[ prop.name ];

				if( styleProp ){
					var val = styleProp.unitless ? styleProp.strValue : (styleProp.pxValue * zoom) + "px";
					rstyle[ prop.name ] = val;
					rstyle[ $$.util.dash2camel(prop.name) ] = val;
				}
			}

			return rstyle;
		}
	};

	// gets the raw style for an element
	$$.styfn.getRawStyle = function( ele ){
		var ele = ele[0]; // insure it's an element

		if( ele ){
			var rstyle = {};
			var style = ele._private.style;

			for( var i = 0; i < $$.style.properties.length; i++ ){
				var prop = $$.style.properties[i];
				var styleProp = style[ prop.name ];

				if( styleProp ){
					rstyle[ prop.name ] = styleProp.strValue;
					rstyle[ $$.util.dash2camel(prop.name) ] = styleProp.strValue;
				}
			}

			return rstyle;
		}
	};

	// gets the value style for an element (useful for things like animations)
	$$.styfn.getValueStyle = function( ele ){
		var rstyle, style;

		if( $$.is.element(ele) ){
			rstyle = {};
			style = ele._private.style;		
		} else {
			rstyle = {};
			style = ele; // just passed the style itself
		}

		if( style ){
			for( var i = 0; i < $$.style.properties.length; i++ ){
				var prop = $$.style.properties[i];
				var styleProp = style[ prop.name ] || style[ $$.util.dash2camel(prop.name) ];

				if( styleProp !== undefined && !$$.is.plainObject( styleProp ) ){ // then make a prop of it
					styleProp = this.parse(prop.name, styleProp);
				}

				if( styleProp ){
					var val = styleProp.value === undefined ? styleProp : styleProp.value;

					rstyle[ prop.name ] = val;
					rstyle[ $$.util.dash2camel(prop.name) ] = val;
				}
			}
		}

		return rstyle;
	};

	// just update the functional properties (i.e. mappings) in the elements'
	// styles (less expensive than recalculation)
	$$.styfn.updateFunctionalProperties = function( eles ){
		for( var i = 0; i < eles.length; i++ ){ // for each ele
			var ele = eles[i];
			var style = ele._private.style;

			for( var j = 0; j < $$.style.properties.length; j++ ){ // for each prop
				var prop = $$.style.properties[j];
				var propInStyle = style[ prop.name ];

				if( propInStyle && propInStyle.mapping ){
					var mapping = propInStyle.mapping;
					this.applyParsedProperty( ele, mapping ); // reapply the mapping property
				}
			}
		}
	};

	// bypasses are applied to an existing style on an element, and just tacked on temporarily
	// returns true iff application was successful for at least 1 specified property
	$$.styfn.applyBypass = function( eles, name, value ){
		var props = [];
		
		// put all the properties (can specify one or many) in an array after parsing them
		if( name === "*" || name === "**" ){ // apply to all property names

			if( value !== undefined ){
				for( var i = 0; i < $$.style.properties.length; i++ ){
					var prop = $$.style.properties[i];
					var name = prop.name;

					var parsedProp = this.parse(name, value, true);
					
					if( parsedProp ){
						props.push( parsedProp );
					}
				}
			}

		} else if( $$.is.string(name) ){ // then parse the single property
			var parsedProp = this.parse(name, value, true);

			if( parsedProp ){
				props.push( parsedProp );
			}
		} else if( $$.is.plainObject(name) ){ // then parse each property
			var specifiedProps = name;

			for( var i = 0; i < $$.style.properties.length; i++ ){
				var prop = $$.style.properties[i];
				var name = prop.name;
				var value = specifiedProps[ name ];

				if( value === undefined ){ // try camel case name too
					value = specifiedProps[ $$.util.dash2camel(name) ];
				}

				if( value !== undefined ){
					var parsedProp = this.parse(name, value, true);
					
					if( parsedProp ){
						props.push( parsedProp );
					}
				}
			}
		} else { // can't do anything without well defined properties
			return false;
		}

		// we've failed if there are no valid properties
		if( props.length === 0 ){ return false; }

		// now, apply the bypass properties on the elements
		var ret = false; // return true if at least one succesful bypass applied
		for( var i = 0; i < eles.length; i++ ){ // for each ele
			var ele = eles[i];

			for( var j = 0; j < props.length; j++ ){ // for each prop
				var prop = props[j];

				ret = this.applyParsedProperty( ele, prop ) || ret;
			}
		}

		return ret;
	};

	$$.styfn.removeAllBypasses = function( eles ){
		for( var i = 0; i < $$.style.properties.length; i++ ){
			var prop = $$.style.properties[i];
			var name = prop.name;
			var value = ""; // empty => remove bypass

			var parsedProp = this.parse(name, value, true);

			for( var j = 0; j < eles.length; j++ ){
				var ele = eles[j];
				this.applyParsedProperty(ele, parsedProp);
			}
		}
	};


})( cytoscape, typeof window === 'undefined' ? null : window );
