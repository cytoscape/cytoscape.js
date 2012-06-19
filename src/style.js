;(function($, $$){
	
	$$.style = $$.Style = function(){

		if( !(this instanceof $$.Style) ){
			return new $$.Style();
		}

		this._private = {
		};
		
		this.length = 0;

		// TODO fill the style with the defaults
		this
			.selector("node")
				.css({
					"height": 20,
					"width": 20,
					"background-color": "#888"
				})
			.selector("edge")
				.css({
					"source-arrow-shape": "none",
					"target-arrow-shape": "none"
				})
			.selector("core")
				.css({

				})
		;
	};

	$$.styfn = $$.Style.prototype;

	(function(){
		var number = $$.util.regex.number;

		$$.style.types = types: {
			opacity: { number: true, min: 0, max: 1 },
			size: { number: true, min: 0 },
			color: { color: true },
			lineStyle: { enums: ["solid", "dotted", "dashed"] },
			fontFace: { regex:/TODO/ },
			fontVariant: { enums: ["small-caps", "normal"] },
			fontWeight: { enums: ["normal", "bold", "bolder", "lighter", "100", "200", "300", "400", "500", "600", "800", "900", 100, 200, 300, 400, 500, 600, 700, 800, 900] },
			nodeShape: { enums: ["rectangle", "roundrectangle", "ellipse", "triangle"] },
			arrowShape: { enums: ["tee", "triangle", "square", "circle", "diamond"] },
			visibility: { enums: ["hidden", "visible"] },
			valign: { enums: ["top", "center", "bottom"] },
			halign: { enums: ["left", "center", "right"] },
			cursor: { enums: ["auto", "crosshair", "default", "e-resize", "n-resize", "ne-resize", "nw-resize", "pointer", "progress", "s-resize", "sw-resize", "text", "w-resize", "wait", "grab", "grabbing"] },
			text: { string: true },
			data: { regex: "data\\s*\\(\\s*(\\w+)\\s*\\)\\s*" },
			mapData: { regex: "mapData\\((\\w+)\\s*\\,\\s*(" + number + ")\\s*\\,\\s*(" + number + ")\\s*,\\s*(\\w+)\\s*\\,\\s*(\\w+)\\)") }
		};

		var t = $$.style.types;
		$$.style.properties = [
			{ name: "background-color", type: t.color },
			{ name: "background-opacity", type: t.opacity },
			{ name: "border-color", type: t.color },
			{ name: "border-opacity", type: t.opacity },
			{ name: "border-width", type: t.size },
			{ name: "border-style", type: t.lineStyle },
			{ name: "height", type: t.size },
			{ name: "width", type: t.size },
			{ name: "shape", type: t.nodeShape },
			{ name: "cursor", type: t.cursor },
			{ name: "text-valign", type: t.valign },
			{ name: "text-halign", type: t.halign },
			{ name: "color": type: t.color },
			{ name: "content", type: t.text }
			{ name: "text-outline-color", type: t.color },
			{ name: "text-outline-width", type: t.size },
			{ name: "text-outline-opacity", type: t.opacity },
			{ name: "text-decoration", type: t.textDecoration },
			{ name: "text-transform", type: t.textTransform },
			{ name: "font-style", type: t.fontStyle },
			{ name: "font-variant", type: t.fontVariant },
			{ name: "font-weight", type: t.fontWeight },
			{ name: "visibility", type: t.visibility },
			{ name: "source-arrow-shape", type: t.arrowShape },
			{ name: "target-arrrow-shape", type: t.arrowShape },
			{ name: "source-arrow-color", type: t.color },
			{ name: "target-arrow-color", type: t.color },
			{ name: "line-style", type: t.lineStyle },
			{ name: "selection-box-color", type: t.color },
			{ name: "selection-box-opacity": type: t.opacity },
			{ name: "selection-box-border-color", type: t.color },
			{ name: "selection-box-border-width", type: t.size },
			{ name: "panning-cursor", type: t.cursor }
		];

		// allow access of properties by name ( e.g. $$.style.properties.height )
		var props = $$.style.properties;
		for( var i = 0; i < props.length; i++ ){
			var prop = props[i];
			
			props[ prop.name ] = prop;
		}
	})();

	// parse a property; return null on invalid
	$$.style.parse = function( name, value ){
		name = $$.util.camel2dash( name ); // make sure the property name is in dash form (e.g. "property-name" not "propertyName")
		var property = $$.style.properties[ name ];
		
		if( !property ){ return null; } // return null on property of unknown name

		var valueIsString = $$.is.string(value);
		if( valueIsString ){ // trim the value to make parsing easier
			value = $$.util.trim( value );
		}

		var type = property.type;

		// TODO check if value is mapped
		var isMapped = false;

		if( type.number ){
			var units;
			if( !type.unitless ){
				if( valueIsString ){
					var match = value.match( "^(" + $$.util.regex.number + ")(px|em)?" + "$" );
					units = match[2];
				} else {
					units = "px"; // implicitly px if unspecified
				}
			}

			value = parseFloat( value );

			if( (type.min && value < type.min)
			|| (type.max && value > type.max)
			){
				return null;
			}

			return {
				value: value,
				strValue: "" + value + (units ? units : ""),
				units: units
			};
		} else if( type.color ){
			var tuple = $$.util.color2tuple( value );

			return {
				value: tuple,
				strValue: value
			};
		} else if( type.enums ){

		} else if( type.string ){
			// don't need to do anything
		} else if( type.regex ){

		} else {
			return null; // not a type we can handle
		}

	};

	$$.style.getEmSizeInPixels = function( domElement ){
		if( window ){
			var pxAsStr = window.getComputedStyle(domElement).getPropertyValue("font-size");
			var px = parseFloat( pxAsStr );
			return px;
		} else {
			return 1; // in case we're running outside of the browser
		}
	};

	$$.fn.style = function( fnMap, options ){
		for( var fnName in fnMap ){
			var fn = fnMap[ fnName ];
			$$.Style.prototype = fn;
		}
	};

	// create a new context from the specified selector string and switch to that context
	$$.styfn.selector = function( selectorStr ){
		// "core" is a special case and does not need a selector
		var selector = selectorStr === "core" ? null : new $$.Selector( selectorStr );

		var i = this.length++;
		this[i] = {
			selector: selector,
			properties: []
		};

		return this; // chaining
	};

	// add a property to the current context
	$$.styfn.css = function( name, value ){
		// name-value pair
		var property = $$.style.parse( name, value );

		// add property to current context if valid
		if( property ){
			var i = this.length - 1;
			this[i].properties.push( property );
		}

		return this; // chaining
	};

	// apply the style to the element based on
	// - its bypass
	// - what selectors match it
	$$.styfn.applyTo = function( ele ){
		var style = ele._private.style = {};
		var bypass = ele._private.bypass;

		for( var i = 0; i < this.length; i++ ){
			var context = this[i];
			var contextSelectorMatches = context.selector.filter( ele ).length > 0;
			var props = context.properties;

			if( contextSelectorMatches ){
				for( var j = 0; j < props.length; j++ ){
					var prop = props[j];

					style[ prop.name ]
				}
			}
		}
	};
	
})(jQuery, jQuery.cytoscape);
