
/* cytoscape.js */

/**
 * This file is part of cytoscape.js 2.0.0beta2-github-snapshot-2013.01.10-13.58.56.
 * 
 * Cytoscape.js is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option) any
 * later version.
 * 
 * Cytoscape.js is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU Lesser General Public License along with
 * cytoscape.js. If not, see <http://www.gnu.org/licenses/>.
 */
 

// this is put as a global var in the browser
// or it's just a global to this module if commonjs
var cytoscape;

(function(){

	// the object iteself is a function that init's an instance of cytoscape
	var $$ = cytoscape = function(){
		return cytoscape.init.apply(cytoscape, arguments);
	};
	
	// allow functional access to cytoscape.js
	// e.g. var cyto = $.cytoscape({ selector: "#foo", ... });
	//      var nodes = cyto.nodes();
	$$.init = function( options ){
		
		// if no options specified, use default
		if( options === undefined ){
			options = {};
		}

		// create instance
		if( $$.is.plainObject( options ) ){
			return new $$.Core( options );
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

	// define the function namespace here, since it has members in many places
	$$.fn = {};

	// TODO test that this works:
	if( typeof exports !== 'undefined' ){ // expose as a commonjs module
		exports = module.exports = cytoscape;
	}
	
})();

// type testing utility functions

;(function($$){
	
	$$.is = {
		string: function(obj){
			return obj != null && typeof obj == typeof "";
		},
		
		fn: function(obj){
			return obj != null && typeof obj === typeof function(){};
		},
		
		array: function(obj){
			return obj != null && obj instanceof Array;
		},
		
		plainObject: function(obj){
			return obj != null && typeof obj === typeof {} && !$$.is.array(obj) && obj.constructor === Object;
		},
		
		number: function(obj){
			return obj != null && typeof obj === typeof 1 && !isNaN(obj);
		},

		integer: function( obj ){
			return $$.is.number(obj) && Math.floor(obj) === obj;
		},
		
		color: function(obj){
			return obj != null && typeof obj === typeof "" && $.Color(obj).toString() !== "";
		},
		
		bool: function(obj){
			return obj != null && typeof obj === typeof true;
		},
		
		elementOrCollection: function(obj){
			return $$.is.element(obj) || $$.is.collection(obj);
		},
		
		element: function(obj){
			return obj instanceof $$.Element && obj._private.single;
		},
		
		collection: function(obj){
			return obj instanceof $$.Collection && !obj._private.single;
		},
		
		core: function(obj){
			return obj instanceof $$.Core;
		},

		style: function(obj){
			return obj instanceof $$.Style;
		},

		stylesheet: function(obj){
			return obj instanceof $$.Stylesheet;
		},

		event: function(obj){
			return obj instanceof $$.Event;
		},

		emptyString: function(obj){
			if( !obj ){ // null is empty
				return true; 
			} else if( $$.is.string(obj) ){
				if( obj === "" || obj.match(/^\s+$/) ){
					return true; // empty string is empty
				}
			}
			
			return false; // otherwise, we don't know what we've got
		},
		
		nonemptyString: function(obj){
			if( obj && $$.is.string(obj) && obj !== "" && !obj.match(/^\s+$/) ){
				return true;
			}

			return false;
		},

		domElement: function(obj){
			if( typeof HTMLElement === 'undefined' ){
				return false; // we're not in a browser so it doesn't matter
			} else {
				return obj instanceof HTMLElement;
			}

			
		}
	};	
	
})( cytoscape );

;(function($$){
	
	// utility functions only for internal use

	$$.util = {

		// the jquery extend() function
		// NB: modified to use $$.is etc since we can't use jquery functions
		extend: function() {
			var options, name, src, copy, copyIsArray, clone,
				target = arguments[0] || {},
				i = 1,
				length = arguments.length,
				deep = false;

			// Handle a deep copy situation
			if ( typeof target === "boolean" ) {
				deep = target;
				target = arguments[1] || {};
				// skip the boolean and the target
				i = 2;
			}

			// Handle case when target is a string or something (possible in deep copy)
			if ( typeof target !== "object" && !$$.is.fn(target) ) {
				target = {};
			}

			// extend jQuery itself if only one argument is passed
			if ( length === i ) {
				target = this;
				--i;
			}

			for ( ; i < length; i++ ) {
				// Only deal with non-null/undefined values
				if ( (options = arguments[ i ]) != null ) {
					// Extend the base object
					for ( name in options ) {
						src = target[ name ];
						copy = options[ name ];

						// Prevent never-ending loop
						if ( target === copy ) {
							continue;
						}

						// Recurse if we're merging plain objects or arrays
						if ( deep && copy && ( $$.is.plainObject(copy) || (copyIsArray = $$.is.array(copy)) ) ) {
							if ( copyIsArray ) {
								copyIsArray = false;
								clone = src && $$.is.array(src) ? src : [];

							} else {
								clone = src && $$.is.plainObject(src) ? src : {};
							}

							// Never move original objects, clone them
							target[ name ] = $$.util.extend( deep, clone, copy );

						// Don't bring in undefined values
						} else if ( copy !== undefined ) {
							target[ name ] = copy;
						}
					}
				}
			}

			// Return the modified object
			return target;
		},

		error: function( msg ){
			if( console ){
				if( console.error ){
					console.error( msg );
				} else if( console.log ){
					console.log( msg );
				} else {
					throw msg;
				}
			} else {
				throw msg;
			}
		},		

		clone: function( obj ){
			var target = {};
			for (var i in obj) {
				if ( obj.hasOwnProperty(i) ) { // TODO is this hasOwnProperty() call necessary for our use?
					target[i] = obj[i];
				}
			}
			return target;
		},

		// gets a shallow copy of the argument
		copy: function( obj ){
			if( obj == null ){
				return obj;
			} if( $$.is.array(obj) ){
				return obj.slice();
			} else if( $$.is.plainObject(obj) ){
				return $$.util.clone( obj );
			} else {
				return obj;
			}
		},
		
		// has anything been set in the map
		mapEmpty: function( map ){
			var empty = true;

			if( map != null ){
				for(var i in map){
					empty = false;
					break;
				}
			}

			return empty;
		},

		// pushes to the array at the end of a map (map may not be built)
		pushMap: function( options ){
			var array = $$.util.getMap(options);

			if( array == null ){ // if empty, put initial array
				$$.util.setMap( $.extend({}, options, {
					value: [ options.value ]
				}) );
			} else {
				array.push( options.value );
			}
		},

		// sets the value in a map (map may not be built)
		setMap: function( options ){
			var obj = options.map;
			var key;
			var keys = options.keys;
			var l = keys.length;

			for(var i = 0; i < l; i++){
				var key = keys[i];

				if( $$.is.plainObject( key ) ){
					$$.util.error("Tried to set map with object key");
				}

				if( i < keys.length - 1 ){
					
					// extend the map if necessary
					if( obj[key] == null ){
						obj[key] = {};
					}
					
					obj = obj[key];
				} else {
					// set the value
					obj[key] = options.value;
				}
			}
		},
		
		// gets the value in a map even if it's not built in places
		getMap: function( options ){
			var obj = options.map;
			var keys = options.keys;
			var l = keys.length;
			
			for(var i = 0; i < l; i++){
				var key = keys[i];

				if( $$.is.plainObject( key ) ){
					$$.util.error("Tried to get map with object key");
				}

				obj = obj[key];
				
				if( obj == null ){
					return obj;
				}
			}
			
			return obj;
		},

		// deletes the entry in the map
		deleteMap: function( options ){
			var obj = options.map;
			var keys = options.keys;
			var l = keys.length;
			var keepChildren = options.keepChildren;
			
			for(var i = 0; i < l; i++){
				var key = keys[i];

				if( $$.is.plainObject( key ) ){
					$$.util.error("Tried to delete map with object key");
				}

				var lastKey = i === options.keys.length - 1;
				if( lastKey ){
					
					if( keepChildren ){ // then only delete child fields not in keepChildren
						for( var child in obj ){
							if( !keepChildren[child] ){
								delete obj[child];
							}
						}
					} else {
						delete obj[key];
					}

				} else {
					obj = obj[key];
				}
			}
		},
		
		capitalize: function(str){
			if( $$.is.emptyString(str) ){
				return str;
			}
			
			return str.charAt(0).toUpperCase() + str.substring(1);
		},

		camel2dash: function( str ){
			var ret = [];

			for( var i = 0; i < str.length; i++ ){
				var ch = str[i];
				var chLowerCase = ch.toLowerCase();
				var isUpperCase = ch !== chLowerCase;

				if( isUpperCase ){
					ret.push( "-" );
					ret.push( chLowerCase );
				} else {
					ret.push( ch );
				}
			}

			var noUpperCases = ret.length === str.length;
			if( noUpperCases ){ return str } // cheaper than .join()

			return ret.join("");
		},

		dash2camel: function( str ){
			var ret = [];
			var nextIsUpper = false;

			for( var i = 0; i < str.length; i++ ){
				var ch = str[i];
				var isDash = ch === "-";

				if( isDash ){
					nextIsUpper = true;
				} else {
					if( nextIsUpper ){
						ret.push( ch.toUpperCase() );
					} else {
						ret.push( ch );
					}

					nextIsUpper = false;
				}
			}

			return ret.join("");
		},

		// strip spaces from beginning of string and end of string
		trim: function( str ){
			var first, last;

			// find first non-space char
			for( first = 0; first < str.length && str[first] === " "; first++ ){}

			// find last non-space char
			for( last = str.length - 1; last > first && str[last] === " "; last-- ){}

			return str.substring(first, last + 1);
		},

		// get [r, g, b] from #abc or #aabbcc
		hex2tuple: function( hex ){
			if( !(hex.length === 4 || hex.length === 7) || hex[0] !== "#" ){ return; }

			var shortHex = hex.length === 4;
			var r, g, b;
			var base = 16;

			if( shortHex ){
				r = parseInt( hex[1] + hex[1], base );
				g = parseInt( hex[2] + hex[2], base );
				b = parseInt( hex[3] + hex[3], base );
			} else {
				r = parseInt( hex[1] + hex[2], base );
				g = parseInt( hex[3] + hex[4], base );
				b = parseInt( hex[5] + hex[6], base );
			}

			return [r, g, b];
		},

		// get [r, g, b, a] from hsl(0, 0, 0) or hsla(0, 0, 0, 0)
		hsl2tuple: function( hsl ){
			var ret;
			var number = $$.util.regex.number;
			var h, s, l, a, r, g, b;

			var m = new RegExp("^hsl[a]?\\(("+ number +")\\s*,\\s*("+ number +"[%])\\s*,\\s*("+ number +"[%])(?:\\s*,\\s*("+ number +"))?\\)$").exec(hsl);
			if( m ){

				// get hue
				h = parseInt( m[1] ); 
				if( h < 0 ){
					h = ( 360 - (-1*h % 360) ) % 360;
				} else if( h > 360 ){
					h = h % 360;
				}
				h /= 360; // normalise on [0, 1]

				s = parseFloat( m[2] );
				if( s < 0 || s > 100 ){ return; } // saturation is [0, 100]
				s = s/100; // normalise on [0, 1]

				l = parseFloat( m[3] );
				if( l < 0 || l > 100 ){ return; } // lightness is [0, 100]
				l = l/100; // normalise on [0, 1]

				a = m[4];
				if( a !== undefined ){
					a = parseFloat( a );

					if( a < 0 || a > 1 ){ return; } // alpha is [0, 1]
				}

				// now, convert to rgb
				// code from http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript
				if( s === 0 ){
					r = g = b = Math.round(l * 255); // achromatic
				} else {
					function hue2rgb(p, q, t){
						if(t < 0) t += 1;
						if(t > 1) t -= 1;
						if(t < 1/6) return p + (q - p) * 6 * t;
						if(t < 1/2) return q;
						if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
						return Math.round(255 * p);
					}

					var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
					var p = 2 * l - q;
					r = hue2rgb(p, q, h + 1/3);
					g = hue2rgb(p, q, h);
					b = hue2rgb(p, q, h - 1/3);
				}

				ret = [r, g, b, a];
			}

			return ret;
		},

		// get [r, g, b, a] from rgb(0, 0, 0) or rgba(0, 0, 0, 0)
		rgb2tuple: function( rgb ){
			var ret;
			var number = $$.util.regex.number;

			var m = new RegExp("^rgb[a]?\\(("+ number +"[%]?)\\s*,\\s*("+ number +"[%]?)\\s*,\\s*("+ number +"[%]?)(?:\\s*,\\s*("+ number +"))?\\)$").exec(rgb);
			if( m ){
				ret = [];

				var isPct = [];
				for( var i = 1; i <= 3; i++ ){
					var channel = m[i];

					if( channel[ channel.length - 1 ] === "%" ){
						isPct[i] = true;
					}
					channel = parseFloat( channel );

					if( isPct[i] ){
						channel = channel/100 * 255; // normalise to [0, 255]
					}

					if( channel < 0 || channel > 255 ){ return; } // invalid channel value

					ret.push( Math.floor(channel) );
				}

				var atLeastOneIsPct = isPct[1] || isPct[2] || isPct[3];
				var allArePct = isPct[1] && isPct[2] && isPct[3];
				if( atLeastOneIsPct && !allArePct ){ return; } // must all be percent values if one is

				var alpha = m[4];
				if( alpha !== undefined ){
					alpha = parseFloat( alpha );

					if( alpha < 0 || alpha > 1 ){ return; } // invalid alpha value

					ret.push( alpha );
				}
			}

			return ret;
		},

		colorname2tuple: function( color ){
			return $$.util.colors[ color.toLowerCase() ];
		},

		color2tuple: function( color ){
			return $$.util.colorname2tuple(color)
				|| $$.util.hex2tuple(color)
				|| $$.util.rgb2tuple(color)
				|| $$.util.hsl2tuple(color);
		},

		tuple2hex: function( tuple ){
			var r = tuple[0];
			var g = tuple[1];
			var b = tuple[2];

			function ch2hex( ch ){
				var hex = ch.toString(16);

				if( hex.length === 1 ){
					hex = '0' + hex;
				}

				return hex;
			}

			return '#' + ch2hex(r) + ch2hex(g) + ch2hex(b);
		},

		regex: {
			number: "(?:\\d*\\.\\d+|\\d+|\\d*\\.\\d+[eE]\\d+)"
		},

		colors: {
			// special colour names
			transparent:			[0,0,0,0], // NB alpha === 0

			// regular colours
			aliceblue:				[240,248,255],
			antiquewhite:			[250,235,215],
			aqua:					[0,255,255],
			aquamarine:				[127,255,212],
			azure:					[240,255,255],
			beige:					[245,245,220],
			bisque:					[255,228,196],
			black:					[0,0,0],
			blanchedalmond:			[255,235,205],
			blue:					[0,0,255],
			blueviolet:				[138,43,226],
			brown:					[165,42,42],
			burlywood:				[222,184,135],
			cadetblue:				[95,158,160],
			chartreuse:				[127,255,0],
			chocolate:				[210,105,30],
			coral:					[255,127,80],
			cornflowerblue:			[100,149,237],
			cornsilk:				[255,248,220],
			crimson:				[220,20,60],
			cyan:					[0,255,255],
			darkblue:				[0,0,139],
			darkcyan:				[0,139,139],
			darkgoldenrod:			[184,134,11],
			darkgray:				[169,169,169],
			darkgreen:				[0,100,0],
			darkgrey:				[169,169,169],
			darkkhaki:				[189,183,107],
			darkmagenta:			[139,0,139],
			darkolivegreen:			[85,107,47],
			darkorange:				[255,140,0],
			darkorchid:				[153,50,204],
			darkred:				[139,0,0],
			darksalmon:				[233,150,122],
			darkseagreen:			[143,188,143],
			darkslateblue:			[72,61,139],
			darkslategray:			[47,79,79],
			darkslategrey:			[47,79,79],
			darkturquoise:			[0,206,209],
			darkviolet:				[148,0,211],
			deeppink:				[255,20,147],
			deepskyblue:			[0,191,255],
			dimgray:				[105,105,105],
			dimgrey:				[105,105,105],
			dodgerblue:				[30,144,255],
			firebrick:				[178,34,34],
			floralwhite:			[255,250,240],
			forestgreen:			[34,139,34],
			fuchsia:				[255,0,255],
			gainsboro:				[220,220,220],
			ghostwhite:				[248,248,255],
			gold:					[255,215,0],
			goldenrod:				[218,165,32],
			gray:					[128,128,128],
			grey:					[128,128,128],
			green:					[0,128,0],
			greenyellow:			[173,255,47],
			honeydew:				[240,255,240],
			hotpink:				[255,105,180],
			indianred:				[205,92,92],
			indigo:					[75,0,130],
			ivory:					[255,255,240],
			khaki:					[240,230,140],
			lavender:				[230,230,250],
			lavenderblush:			[255,240,245],
			lawngreen:				[124,252,0],
			lemonchiffon:			[255,250,205],
			lightblue:				[173,216,230],
			lightcoral:				[240,128,128],
			lightcyan:				[224,255,255],
			lightgoldenrodyellow:	[250,250,210],
			lightgray:				[211,211,211],
			lightgreen:				[144,238,144],
			lightgrey:				[211,211,211],
			lightpink:				[255,182,193],
			lightsalmon:			[255,160,122],
			lightseagreen:			[32,178,170],
			lightskyblue:			[135,206,250],
			lightslategray:			[119,136,153],
			lightslategrey:			[119,136,153],
			lightsteelblue:			[176,196,222],
			lightyellow:			[255,255,224],
			lime:					[0,255,0],
			limegreen:				[50,205,50],
			linen:					[250,240,230],
			magenta:				[255,0,255],
			maroon:					[128,0,0],
			mediumaquamarine:		[102,205,170],
			mediumblue:				[0,0,205],
			mediumorchid:			[186,85,211],
			mediumpurple:			[147,112,219],
			mediumseagreen:			[60,179,113],
			mediumslateblue:		[123,104,238],
			mediumspringgreen:		[0,250,154],
			mediumturquoise:		[72,209,204],
			mediumvioletred:		[199,21,133],
			midnightblue:			[25,25,112],
			mintcream:				[245,255,250],
			mistyrose:				[255,228,225],
			moccasin:				[255,228,181],
			navajowhite:			[255,222,173],
			navy:					[0,0,128],
			oldlace:				[253,245,230],
			olive:					[128,128,0],
			olivedrab:				[107,142,35],
			orange:					[255,165,0],
			orangered:				[255,69,0],
			orchid:					[218,112,214],
			palegoldenrod:			[238,232,170],
			palegreen:				[152,251,152],
			paleturquoise:			[175,238,238],
			palevioletred:			[219,112,147],
			papayawhip:				[255,239,213],
			peachpuff:				[255,218,185],
			peru:					[205,133,63],
			pink:					[255,192,203],
			plum:					[221,160,221],
			powderblue:				[176,224,230],
			purple:					[128,0,128],
			red:					[255,0,0],
			rosybrown:				[188,143,143],
			royalblue:				[65,105,225],
			saddlebrown:			[139,69,19],
			salmon:					[250,128,114],
			sandybrown:				[244,164,96],
			seagreen:				[46,139,87],
			seashell:				[255,245,238],
			sienna:					[160,82,45],
			silver:					[192,192,192],
			skyblue:				[135,206,235],
			slateblue:				[106,90,205],
			slategray:				[112,128,144],
			slategrey:				[112,128,144],
			snow:					[255,250,250],
			springgreen:			[0,255,127],
			steelblue:				[70,130,180],
			tan:					[210,180,140],
			teal:					[0,128,128],
			thistle:				[216,191,216],
			tomato:					[255,99,71],
			turquoise:				[64,224,208],
			violet:					[238,130,238],
			wheat:					[245,222,179],
			white:					[255,255,255],
			whitesmoke:				[245,245,245],
			yellow:					[255,255,0],
			yellowgreen:			[154,205,50]
		}
			
	};
	
})( cytoscape );

;(function($$){
	
	$$.math = {};
	
	$$.math.boxInBezierVicinity = function(
		x1box, y1box, x2box, y2box, x1, y1, x2, y2, x3, y3, tolerance) {
		
		// Return values:
		// 0 - curve is not in box
		// 1 - curve may be in box; needs precise check
		// 2 - curve is in box
		
		var boxMinX = Math.min(x1box, x2box) - tolerance;
		var boxMinY = Math.min(y1box, y2box) - tolerance;
		var boxMaxX = Math.max(x1box, x2box) + tolerance;
		var boxMaxY = Math.max(y1box, y2box) + tolerance;
		
		if (x1 >= boxMinX && x1 <= boxMaxX && y1 >= boxMinY && y1 <= boxMaxY) {
			return 2;
		} else if (x3 >= boxMinX && x3 <= boxMaxX && y3 >= boxMinY && y3 <= boxMaxY) {
			return 2;
		} else if (x2 >= boxMinX && x2 <= boxMaxX && y2 >= boxMinY && y2 <= boxMaxY) { 
			return 1;
		}
		
		var curveMinX = Math.min(x1, x2, x3);
		var curveMinY = Math.min(y1, y2, y3);
		var curveMaxX = Math.max(x1, x2, x3);
		var curveMaxY = Math.max(y1, y2, y3);
		
		/*
		console.log(curveMinX + ", " + curveMinY + ", " + curveMaxX 
			+ ", " + curveMaxY);
		if (curveMinX == undefined) {
			console.log("undefined curveMinX: " + x1 + ", " + x2 + ", " + x3);
		}
		*/
		
		if (curveMinX > boxMaxX
			|| curveMaxX < boxMinX
			|| curveMinY > boxMaxY
			|| curveMaxY < boxMinY) {
			
			return 0;	
		}
		
		return 1;
	}
	
	$$.math.checkStraightEdgeCrossesBox = function(
		x1box, y1box, x2box, y2box, x1, y1, x2, y2, tolerance) {
		
		var boxMinX = Math.min(x1box, x2box) - tolerance;
		var boxMinY = Math.min(y1box, y2box) - tolerance;
		var boxMaxX = Math.max(x1box, x2box) + tolerance;
		var boxMaxY = Math.max(y1box, y2box) + tolerance;
		
		// Check left + right bounds
		var aX = x2 - x1;
		var bX = x1;
		var yValue;
		
		// Top and bottom
		var aY = y2 - y1;
		var bY = y1;
		var xValue;
		
		if (Math.abs(aX) < 0.0001) {
			return (x1 >= boxMinX && x1 <= boxMaxX
				&& Math.min(y1, y2) <= boxMinY
				&& Math.max(y1, y2) >= boxMaxY);	
		}
		
		var tLeft = (boxMinX - bX) / aX;
		if (tLeft > 0 && tLeft <= 1) {
			yValue = aY * tLeft + bY;
			if (yValue >= boxMinY && yValue <= boxMaxY) {
				return true;
			} 
		}
		
		var tRight = (boxMaxX - bX) / aX;
		if (tRight > 0 && tRight <= 1) {
			yValue = aY * tRight + bY;
			if (yValue >= boxMinY && yValue <= boxMaxY) {
				return true;
			} 
		}
		
		var tTop = (boxMinY - bY) / aY;
		if (tTop > 0 && tTop <= 1) {
			xValue = aX * tTop + bX;
			if (xValue >= boxMinX && xValue <= boxMaxX) {
				return true;
			} 
		}
		
		var tBottom = (boxMaxY - bY) / aY;
		if (tBottom > 0 && tBottom <= 1) {
			xValue = aX * tBottom + bX;
			if (xValue >= boxMinX && xValue <= boxMaxX) {
				return true;
			} 
		}
		
		return false;
	}
	
	$$.math.checkBezierCrossesBox = function(
		x1box, y1box, x2box, y2box, x1, y1, x2, y2, x3, y3, tolerance) {
		
		var boxMinX = Math.min(x1box, x2box) - tolerance;
		var boxMinY = Math.min(y1box, y2box) - tolerance;
		var boxMaxX = Math.max(x1box, x2box) + tolerance;
		var boxMaxY = Math.max(y1box, y2box) + tolerance;
		
		if (x1 >= boxMinX && x1 <= boxMaxX && y1 >= boxMinY && y1 <= boxMaxY) {
			return true;
		} else if (x3 >= boxMinX && x3 <= boxMaxX && y3 >= boxMinY && y3 <= boxMaxY) {
			return true;
		}
		
		var aX = x1 - 2 * x2 + x3;
		var bX = -2 * x1 + 2 * x2;
		var cX = x1;

		var xIntervals = [];
		
		if (Math.abs(aX) < 0.0001) {
			var leftParam = (boxMinX - x1) / bX;
			var rightParam = (boxMaxX - x1) / bX;
			
			xIntervals.push(leftParam, rightParam);
		} else {
			// Find when x coordinate of the curve crosses the left side of the box
			var discriminantX1 = bX * bX - 4 * aX * (cX - boxMinX);
			var tX1, tX2;
			if (discriminantX1 > 0) {
				var sqrt = Math.sqrt(discriminantX1);
				tX1 = (-bX + sqrt) / (2 * aX);
				tX2 = (-bX - sqrt) / (2 * aX);
				
				xIntervals.push(tX1, tX2);
			}
			
			var discriminantX2 = bX * bX - 4 * aX * (cX - boxMaxX);
			var tX3, tX4;
			if (discriminantX2 > 0) {
				var sqrt = Math.sqrt(discriminantX2);
				tX3 = (-bX + sqrt) / (2 * aX);
				tX4 = (-bX - sqrt) / (2 * aX);
				
				xIntervals.push(tX3, tX4);
			}
		}
		
		xIntervals.sort(function(a, b) { return a - b; });

		
		var aY = y1 - 2 * y2 + y3;
		var bY = -2 * y1 + 2 * y2;
		var cY = y1;
		
		var yIntervals = [];
		
		if (Math.abs(aY) < 0.0001) {
			var topParam = (boxMinY - y1) / bY;
			var bottomParam = (boxMaxY - y1) / bY;
			
			yIntervals.push(topParam, bottomParam);
		} else {
			var discriminantY1 = bY * bY - 4 * aY * (cY - boxMinY);
			
			var tY1, tY2;
			if (discriminantY1 > 0) {
				var sqrt = Math.sqrt(discriminantY1);
				tY1 = (-bY + sqrt) / (2 * aY);
				tY2 = (-bY - sqrt) / (2 * aY);
				
				yIntervals.push(tY1, tY2);
			}
	
			var discriminantY2 = bY * bY - 4 * aY * (cY - boxMaxY);
			
			var tY3, tY4;
			if (discriminantY2 > 0) {
				var sqrt = Math.sqrt(discriminantY2);
				tY3 = (-bY + sqrt) / (2 * aY);
				tY4 = (-bY - sqrt) / (2 * aY);
				
				yIntervals.push(tY3, tY4);
			}
		}
				
		yIntervals.sort(function(a, b) { return a - b; });

		for (var index = 0; index < xIntervals.length; index += 2) {
			for (var yIndex = 1; yIndex < yIntervals.length; yIndex += 2) {
				
				// Check if there exists values for the Bezier curve
				// parameter between 0 and 1 where both the curve's
				// x and y coordinates are within the bounds specified by the box
				if (xIntervals[index] < yIntervals[yIndex]
					&& yIntervals[yIndex] >= 0.0
					&& xIntervals[index] <= 1.0
					&& xIntervals[index + 1] > yIntervals[yIndex - 1]
					&& yIntervals[yIndex - 1] <= 1.0
					&& xIntervals[index + 1] >= 0.0) {
					
					return true;
				}
			}
		}
		
		return false;
	}
	
	$$.math.inBezierVicinity = function(
		x, y, x1, y1, x2, y2, x3, y3, toleranceSquared) {
		
		// Middle point occurs when t = 0.5, this is when the Bezier
		// is closest to (x2, y2)
		var middlePointX = 0.25 * x1 + 0.5 * x2 + 0.25 * x3;
		var middlePointY = 0.25 * y1 + 0.5 * y2 + 0.25 * y3;
		
		var displacementX, displacementY, offsetX, offsetY;
		var dotProduct, dotSquared, hypSquared;
		var outside = function(x, y, startX, startY, endX, endY,
				toleranceSquared, counterClockwise) {

			dotProduct = (endY - startY) * (x - startX) + (startX - endX) * (y - startY);
			dotSquared = dotProduct * dotProduct;
			sideSquared = (endY - startY) * (endY - startY) 
				+ (startX - endX) * (startX - endX);

			if (counterClockwise) {
				if (dotProduct > 0) {
					return false;
				}
			} else {
				if (dotProduct < 0) {
					return false;
				}
			}
			
			return (dotSquared / sideSquared > toleranceSquared);
		};
		
		// Used to check if the test polygon winding is clockwise or counterclockwise
		var testPointX = (middlePointX + x2) / 2.0;
		var testPointY = (middlePointY + y2) / 2.0;
		
		var counterClockwise = true;
		
		// The test point is always inside
		if (outside(testPointX, testPointY, x1, y1, x2, y2, 0, counterClockwise)) {
			counterClockwise = !counterClockwise;
		}
		
		/*
		return (!outside(x, y, x1, y1, x2, y2, toleranceSquared, counterClockwise)
			&& !outside(x, y, x2, y2, x3, y3, toleranceSquared, counterClockwise)
			&& !outside(x, y, x3, y3, middlePointX, middlePointY, toleranceSquared,
				counterClockwise)
			&& !outside(x, y, middlePointX, middlePointY, x1, y1, toleranceSquared,
				counterClockwise)
		);
		*/
		
		return (!outside(x, y, x1, y1, x2, y2, toleranceSquared, counterClockwise)
			&& !outside(x, y, x2, y2, x3, y3, toleranceSquared, counterClockwise)
			&& !outside(x, y, x3, y3, x1, y1, toleranceSquared,
				counterClockwise)
		);
	}
	
	// Solves a cubic function, returns root in form [r1, i1, r2, i2, r3, i3], where
	// r is the real component, i is the imaginary component
	$$.math.solveCubic = function(a, b, c, d, result) {

		// An implementation of the Cardano method
		// http://en.wikipedia.org/wiki/Cubic_function#The_nature_of_the_roots
		// provided by http://www3.telus.net/thothworks/Quad3Deg.html
		
		// Get rid of a
		b /= a;
		c /= a;
		d /= a;
		
		var discrim, q, r, dum1, s, t, term1, r13;

		q = (3.0 * c - (b * b)) / 9.0;
		r = -(27.0 * d) + b * (9.0 * c - 2.0 * (b * b));
		r /= 54.0;
		
		discrim = q * q * q + r * r;
		result[1] = 0; //The first root is always real.
		term1 = (b / 3.0);
		
		if (discrim > 0) { // one root real, two are complex
			s = r + Math.sqrt(discrim);
			s = ((s < 0) ? -Math.pow(-s, (1.0 / 3.0)) : Math.pow(s, (1.0 / 3.0)));
			t = r - Math.sqrt(discrim);
			t = ((t < 0) ? -Math.pow(-t, (1.0 / 3.0)) : Math.pow(t, (1.0 / 3.0)));
			result[0] = -term1 + s + t;
			term1 += (s + t) / 2.0;
			result[4] = result[2] = -term1;
			term1 = Math.sqrt(3.0) * (-t + s) / 2;
			result[3] = term1;
			result[5] = -term1;
			return;
		} // End if (discrim > 0)
		
		// The remaining options are all real
		result[5] = result[3] = 0;
		
		if (discrim == 0){ // All roots real, at least two are equal.
			r13 = ((r < 0) ? -Math.pow(-r, (1.0 / 3.0)) : Math.pow(r, (1.0 / 3.0)));
			result[0] = -term1 + 2.0 * r13;
			result[4] = result[2] = -(r13 + term1);
			return;
		} // End if (discrim == 0)
		
		// Only option left is that all roots are real and unequal (to get here, q < 0)
		q = -q;
		dum1 = q * q * q;
		dum1 = Math.acos(r / Math.sqrt(dum1));
		r13 = 2.0 * Math.sqrt(q);
		result[0] = -term1 + r13 * Math.cos(dum1 / 3.0);
		result[2] = -term1 + r13 * Math.cos((dum1 + 2.0 * Math.PI) / 3.0);
		result[4] = -term1 + r13 * Math.cos((dum1 + 4.0 * Math.PI) / 3.0);
		return;
	}

	$$.math.sqDistanceToQuadraticBezier = function(x, y, 
		x1, y1, x2, y2, x3, y3) {
		
		// Find minimum distance by using the minimum of the distance 
		// function between the given point and the curve
		
		// This gives the coefficients of the resulting cubic equation
		// whose roots tell us where a possible minimum is
		// (Coefficients are divided by 4)
		
		var a = 1.0 * x1*x1 - 4*x1*x2 + 2*x1*x3 + 4*x2*x2 - 4*x2*x3 + x3*x3
			+ y1*y1 - 4*y1*y2 + 2*y1*y3 + 4*y2*y2 - 4*y2*y3 + y3*y3;
		
		var b = 1.0 * 9*x1*x2 - 3*x1*x1 - 3*x1*x3 - 6*x2*x2 + 3*x2*x3
			+ 9*y1*y2 - 3*y1*y1 - 3*y1*y3 - 6*y2*y2 + 3*y2*y3;
		
		var c = 1.0 * 3*x1*x1 - 6*x1*x2 + x1*x3 - x1*x + 2*x2*x2 + 2*x2*x - x3*x
			+ 3*y1*y1 - 6*y1*y2 + y1*y3 - y1*y + 2*y2*y2 + 2*y2*y - y3*y;
			
		var d = 1.0 * x1*x2 - x1*x1 + x1*x - x2*x
			+ y1*y2 - y1*y1 + y1*y - y2*y;
		
		debug("coefficients: " + a / a + ", " + b / a + ", " + c / a + ", " + d / a);
		
		var roots = [];
		
		// Use the cubic solving algorithm
		this.solveCubic(a, b, c, d, roots);
		
		var zeroThreshold = 0.0000001;
		
		var params = [];
		
		for (var index = 0; index < 6; index += 2) {
			if (Math.abs(roots[index + 1]) < zeroThreshold
					&& roots[index] >= 0
					&& roots[index] <= 1.0) {
				params.push(roots[index]);
			}
		}
		
		params.push(1.0);
		params.push(0.0);
		
		var minDistanceSquared = -1;
		var closestParam;
		
		var curX, curY, distSquared;
		for (var i = 0; i < params.length; i++) {
			curX = Math.pow(1.0 - params[i], 2.0) * x1
				+ 2.0 * (1 - params[i]) * params[i] * x2
				+ params[i] * params[i] * x3;
				
			curY = Math.pow(1 - params[i], 2.0) * y1
				+ 2 * (1.0 - params[i]) * params[i] * y2
				+ params[i] * params[i] * y3;
				
			distSquared = Math.pow(curX - x, 2) + Math.pow(curY - y, 2);
			debug("distance for param " + params[i] + ": " + Math.sqrt(distSquared));
			if (minDistanceSquared >= 0) {
				if (distSquared < minDistanceSquared) {
					minDistanceSquared = distSquared;
					closestParam = params[i];
				}
			} else {
				minDistanceSquared = distSquared;
				closestParam = params[i];
			}
		}
		
		/*
		debugStats.clickX = x;
		debugStats.clickY = y;
		
		debugStats.closestX = Math.pow(1.0 - closestParam, 2.0) * x1
				+ 2.0 * (1.0 - closestParam) * closestParam * x2
				+ closestParam * closestParam * x3;
				
		debugStats.closestY = Math.pow(1.0 - closestParam, 2.0) * y1
				+ 2.0 * (1.0 - closestParam) * closestParam * y2
				+ closestParam * closestParam * y3;
		*/
		
		debug("given: " 
			+ "( " + x + ", " + y + "), " 
			+ "( " + x1 + ", " + y1 + "), " 
			+ "( " + x2 + ", " + y2 + "), "
			+ "( " + x3 + ", " + y3 + ")");
		
		
		debug("roots: " + roots);
		debug("params: " + params);
		debug("closest param: " + closestParam);
		return minDistanceSquared;
	}
	
	var debug = function(o) {
		if (false) {
			console.log(o);
		}
	}
	
})( cytoscape );

// type testing utility functions

;(function($$){
	
	// list of ids with other metadata assoc'd with it
	$$.instances = [];
	$$.instanceCounter = 0;
	$$.lastInstanceTime;

	$$.registerInstance = function( instance, domElement ){
		var cy;

		if( $$.is.core(instance) ){
			cy = instance;
		} else if( $$.is.domElement(instance) ){
			domElement = instance;
		}

		var time = +new Date;
		var suffix;

		// add a suffix in case instances collide on the same time
		if( !$$.lastInstanceTime || $$.lastInstanceTime === time ){
			$$.instanceCounter = 0;
		} else {
			++$$.instanceCounter;
		}
		$$.lastInstanceTime = time;
		suffix = $$.instanceCounter;

		var id = "cy-" + time + "-" + suffix;

		// create the registration object
		var registration = {
			id: id,
			cy: cy,
			domElement: domElement,
			readies: [] // list of bound ready functions before calling init
		};

		// put the registration object in the pool
		$$.instances.push( registration );
		$$.instances[ id ] = registration;

		return registration;
	};

	$$.getRegistrationForInstance = function( instance, domElement ){
		var cy;

		if( $$.is.core(instance) ){
			if( instance.registered() ){ // only want it if it's registered b/c if not it has no reg'd id
				cy = instance;
			}
		} else if( $$.is.domElement(instance) ){
			domElement = instance;
		}

		if( $$.is.core(cy) ){
			var id = cy.instanceId();
			return $$.instances[ id ];

		} else if( $$.is.domElement(domElement) ){
			for( var i = $$.instances.length - 1; i >= 0; i-- ){ // look backwards, since most recent is the one we want
				var reg = $$.instances[i];

				if( reg.domElement === domElement ){
					return reg;
				}
			}
		}
	};
	
})( cytoscape );

;(function($$){
	
	// registered extensions to cytoscape, indexed by name
	var extensions = {};
	$$.extensions = extensions;
	
	// registered modules for extensions, indexed by name
	var modules = {};
	$$.modules = modules;
	
	function setExtension(type, name, registrant){
		var impl = {};
		impl[name] = registrant;
		
		switch( type ){
		case "core":
		case "collection":
			$$.fn[type]( impl );
		}
		
		return $$.util.setMap({
			map: extensions,
			keys: [ type, name ],
			value: registrant
		});
	}
	
	function getExtension(type, name){
		return $$.util.getMap({
			map: extensions,
			keys: [ type, name ]
		});
	}
	
	function setModule(type, name, moduleType, moduleName, registrant){
		return $$.util.setMap({
			map: modules,
			keys: [ type, name, moduleType, moduleName ],
			value: registrant
		});
	}
	
	function getModule(type, name, moduleType, moduleName){
		return $$.util.getMap({
			map: modules,
			keys: [ type, name, moduleType, moduleName ]
		});
	}
	
	$$.extension = function(){
		// e.g. $$.extension("renderer", "svg")
		if( arguments.length == 2 ){
			return getExtension.apply(this, arguments);
		}
		
		// e.g. $$.extension("renderer", "svg", { ... })
		else if( arguments.length == 3 ){
			return setExtension.apply(this, arguments);
		}
		
		// e.g. $$.extension("renderer", "svg", "nodeShape", "ellipse")
		else if( arguments.length == 4 ){
			return getModule.apply(this, arguments);
		}
		
		// e.g. $$.extension("renderer", "svg", "nodeShape", "ellipse", { ... })
		else if( arguments.length == 5 ){
			return setModule.apply(this, arguments);
		}
		
		else {
			$.error("Invalid extension access syntax");
		}
	
	};
	
})( cytoscape );

;(function($, $$){
	
	if( !$ ){ return } // no jquery => don't need this

	// allow calls on a jQuery selector by proxying calls to $.cytoscape
	// e.g. $("#foo").cytoscape(options) => $.cytoscape(options) on #foo
	$.fn.cytoscape = function(opts){
		var $this = $(this);

		// get object
		if( opts === "get" ){
			var reg = $$.getRegistrationForInstance( $this[0] );
			return reg.cy;
		}
		
		// bind to ready
		else if( $$.is.fn(opts) ){
			//debugger;

			var ready = opts;
			var domEle = $this[0];
			var reg = $$.getRegistrationForInstance( domEle );

			if( !reg ){
				reg = $$.registerInstance( domEle );
			}
			
			if( reg && reg.cy && reg.cy.ready() ){
				// already ready so just trigger now
				reg.cy.trigger("ready", [], ready);

			} else {
				// not yet ready, so add to readies list
				
				reg.readies.push( ready );
			} 
			
		}
		
		// proxy to create instance
		else if( $$.is.plainObject(opts) ){
			return $this.each(function(){
				var options = $.extend({}, opts, {
					container: $(this)[0]
				});
			
				cytoscape(options);
			});
		}
		
		// proxy a function call
		else {
			var domEle = $this[0];
			var rets = [];
			var args = [];
			for(var i = 1; i < arguments.length; i++){
				args[i - 1] = arguments[i];
			}
			
			$this.each(function(){
				var reg = $$.getRegistrationForInstance( domEle );
				var cy = reg.cy;
				var fnName = opts;
				
				if( cy && $$.is.fn( cy[fnName] ) ){
					var ret = cy[fnName].apply(cy, args);
					rets.push(ret);
				}
			});
			
			// if only one instance, don't need to return array
			if( rets.length === 1 ){
				rets = rets[0];
			} else if( rets.length == 0 ){
				rets = $(this);
			}
			
			return rets;
		}

	};
	
	// allow access to the global cytoscape object under jquery for legacy reasons
	$.cytoscape = cytoscape;
	
	// use short alias (cy) if not already defined
	if( $.fn.cy == null && $.cy == null ){
		$.fn.cy = $.fn.cytoscape;
		$.cy = $.cytoscape;
	}
	
})(typeof jQuery !== 'undefined' ? jQuery : null , cytoscape);

;(function($$){
	
	// shamelessly taken from jQuery
	// https://github.com/jquery/jquery/blob/master/src/event.js

	$$.Event = function( src, props ) {
		// Allow instantiation without the 'new' keyword
		if ( !(this instanceof $$.Event) ) {
			return new $$.Event( src, props );
		}

		// Event object
		if ( src && src.type ) {
			this.originalEvent = src;
			this.type = src.type;

			// Events bubbling up the document may have been marked as prevented
			// by a handler lower down the tree; reflect the correct value.
			this.isDefaultPrevented = ( src.defaultPrevented || src.returnValue === false ||
				src.getPreventDefault && src.getPreventDefault() ) ? returnTrue : returnFalse;

		// Event type
		} else {
			this.type = src;
		}

		// Put explicitly provided properties onto the event object
		if ( props ) {
			$$.util.extend( this, props );
		}

		// Create a timestamp if incoming event doesn't have one
		this.timeStamp = src && src.timeStamp || +new Date;

		// Mark it as fixed
		//this[ jQuery.expando ] = true;
	};

	function returnFalse() {
		return false;
	}
	function returnTrue() {
		return true;
	}

	// jQuery.Event is based on DOM3 Events as specified by the ECMAScript Language Binding
	// http://www.w3.org/TR/2003/WD-DOM-Level-3-Events-20030331/ecma-script-binding.html
	$$.Event.prototype = {
		preventDefault: function() {
			this.isDefaultPrevented = returnTrue;

			var e = this.originalEvent;
			if ( !e ) {
				return;
			}

			// if preventDefault exists run it on the original event
			if ( e.preventDefault ) {
				e.preventDefault();

			// otherwise set the returnValue property of the original event to false (IE)
			} else {
				e.returnValue = false;
			}
		},
		stopPropagation: function() {
			this.isPropagationStopped = returnTrue;

			var e = this.originalEvent;
			if ( !e ) {
				return;
			}
			// if stopPropagation exists run it on the original event
			if ( e.stopPropagation ) {
				e.stopPropagation();
			}
			// otherwise set the cancelBubble property of the original event to true (IE)
			e.cancelBubble = true;
		},
		stopImmediatePropagation: function() {
			this.isImmediatePropagationStopped = returnTrue;
			this.stopPropagation();
		},
		isDefaultPrevented: returnFalse,
		isPropagationStopped: returnFalse,
		isImmediatePropagationStopped: returnFalse
	};
	
	
})( cytoscape );

;(function($$){
	
	// metaprogramming makes me happy

	// use this module to cherry pick functions into your prototype
	// (useful for functions shared between the core and collections, for example)

	// e.g.
	// $$.fn.collection({
	//   foo: $$.define.foo({ /* params... */ })
	// });

	$$.define = {

		// access data field
		data: function( params ){
			var defaults = { 
				field: "data",
				bindingEvent: "data",
				allowBinding: false,
				allowSetting: false,
				allowGetting: false,
				settingEvent: "data",
				settingTriggersEvent: false,
				triggerFnName: "trigger",
				immutableKeys: {}, // key => true if immutable
				updateMappers: false
			};
			params = $$.util.extend({}, defaults, params);

			return function( name, value ){
				var p = params;
				var self = this;
				var selfIsArrayLike = self.length !== undefined;
				var all = selfIsArrayLike ? self : [self]; // put in array if not array-like
				var single = selfIsArrayLike ? self[0] : self;

				// .data("foo", ...)
				if( $$.is.string(name) ){ // set or get property

					// .data("foo")
					if( p.allowGetting && value === undefined ){ // get

						var ret;
						if( single ){
							ret = single._private[ p.field ][ name ];
						}
						return ret;
					
					// .data("foo", "bar")
					} else if( p.allowSetting && value !== undefined ) { // set
						var valid = !p.immutableKeys[name];
						if( valid ){

							for( var i = 0, l = all.length; i < l; i++ ){
								all[i]._private[ p.field ][ name ] = value;
							}

							// update mappers if asked
							if( p.updateMappers ){ self.updateMappers(); }

							if( p.settingTriggersEvent ){
								self[ p.triggerFnName ]( p.settingEvent );
							}
						}
					}

				// .data({ "foo": "bar" })
				} else if( p.allowSetting && $$.is.plainObject(name) ){ // extend
					var obj = name;
					var k, v;

					for( k in obj ){
						v = obj[ k ];

						var valid = !p.immutableKeys[k];
						if( valid ){
							for( var i = 0, l = all.length; i < l; i++ ){
								all[i]._private[ p.field ][ k ] = v;
							}
						}
					}
					
					// update mappers if asked
					if( p.updateMappers ){ self.updateMappers(); }

					if( p.settingTriggersEvent ){
						self[ p.triggerFnName ]( p.settingEvent );
					}
				
				// .data(function(){ ... })
				} else if( p.allowBinding && $$.is.fn(name) ){ // bind to event
					var fn = name;
					self.bind( p.bindingEvent, fn );
				
				// .data()
				} else if( p.allowGetting && name === undefined ){ // get whole object
					var ret;
					if( single ){
						ret = single._private[ p.field ];
					}
					return ret;
				}

				return self; // maintain chainability
			}; // function
		}, // data

		// remove data field
		removeData: function( params ){
			var defaults = { 
				field: "data",
				event: "data",
				triggerFnName: "trigger",
				triggerEvent: false,
				immutableKeys: {} // key => true if immutable
			};
			params = $$.util.extend({}, defaults, params);

			return function( names ){
				var p = params;
				var self = this;
				var selfIsArrayLike = self.length !== undefined;
				var all = selfIsArrayLike ? self : [self]; // put in array if not array-like
				var single = selfIsArrayLike ? self[0] : self;
				
				// .removeData("foo bar")
				if( $$.is.string(names) ){ // then get the list of keys, and delete them
					var keys = names.split(/\s+/);
					var l = keys.length;

					for( var i = 0; i < l; i++ ){ // delete each non-empty key
						var key = keys[i];
						if( $$.is.emptyString(key) ){ continue; }

						var valid = !p.immutableKeys[ key ]; // not valid if immutable
						if( valid ){
							for( var i_a = 0, l_a = all.length; i_a < l_a; i_a++ ){
								delete all[ i_a ]._private[ p.field ][ key ];
							}
						}
					}

					if( p.triggerEvent ){
						self[ p.triggerFnName ]( p.event );
					}

				// .removeData()
				} else if( names === undefined ){ // then delete all keys

					for( var i_a = 0, l_a = all.length; i_a < l_a; i_a++ ){
						var _privateFields = all[ i_a ]._private[ p.field ];
						
						for( var key in _privateFields ){
							var validKeyToDelete = !p.immutableKeys[ key ];

							if( validKeyToDelete ){
								delete _privateFields[ key ];
							}
						}
					}

					if( p.triggerEvent ){
						self[ p.triggerFnName ]( p.event );
					}
				}

				return self; // maintain chaining
			}; // function
		}, // removeData

		// event function reusable stuff
		event: {
			regex: /(\w+)(\.\w+)?/, // regex for matching event strings (e.g. "click.namespace")
			optionalTypeRegex: /(\w+)?(\.\w+)?/,

			// properties to copy to the event obj
			props: "altKey bubbles button cancelable charCode clientX clientY ctrlKey currentTarget data detail eventPhase metaKey offsetX offsetY originalTarget pageX pageY prevValue relatedTarget screenX screenY shiftKey target view which".split(/\s+/),

			aliases: "mousedown mouseup click mouseover mouseout mousemove touchstart touchmove touchend grab drag free".split(/\s+/),

			aliasesOn: function( thisPrototype ){

				var aliases = $$.define.event.aliases;
				for( var i = 0; i < aliases.length; i++ ){
					var eventType = aliases[i];

					thisPrototype[ eventType ] = function(data, callback){
						if( $$.is.fn(callback) ){
							this.on(eventType, data, callback);

						} else if( $$.is.fn(data) ){
							callback = data;
							this.on(eventType, callback);

						} else {
							this.trigger(eventType);
						}

						return this; // maintain chaining
					};
				}
			},

			falseCallback: function(){ return false; }
		},

		// event binding
		on: function( params ){
			var defaults = {
				unbindSelfOnTrigger: false,
				unbindAllBindersOnTrigger: false
			};
			params = $$.util.extend({}, defaults, params);
			
			return function(events, selector, data, callback){
				var self = this;
				var selfIsArrayLike = self.length !== undefined;
				var all = selfIsArrayLike ? self : [self]; // put in array if not array-like
				var single = selfIsArrayLike ? self[0] : self;
				var eventsIsString = $$.is.string(events);
				var p = params;

				if( $$.is.plainObject(selector) ){ // selector is actually data
					callback = data;
					data = selector;
					selector = undefined;
				} else if( $$.is.fn(selector) || selector === false ){ // selector is actually callback
					callback = selector;
					data = undefined;
					selector = undefined;
				}

				if( $$.is.fn(data) || data === false ){ // data is actually callback
					callback = data;
					data = undefined;
				}

				// if there isn't a callback, we can't really do anything
				// (can't speak for mapped events arg version)
				if( !($$.is.fn(callback) || callback === false) && eventsIsString ){
					return self; // maintain chaining
				}

				if( eventsIsString ){ // then convert to map
					var map = {};
					map[ events ] = callback;
					events = map;
				}

				for( var evts in events ){
					callback = events[evts];
					if( callback === false ){
						callback = $$.define.event.falseCallback;
					}

					if( !$$.is.fn(callback) ){ continue; }

					evts = evts.split(/\s+/);
					for( var i = 0; i < evts.length; i++ ){
						var evt = evts[i];
						if( $$.is.emptyString(evt) ){ continue; }

						var match = evt.match( $$.define.event.regex ); // type[.namespace]

						if( match ){
							var type = match[1];
							var namespace = match[2] ? match[2] : undefined;

							var listener = {
								callback: callback, // callback to run
								data: data, // extra data in eventObj.data
								delegated: selector ? true : false, // whether the evt is delegated
								selector: selector, // the selector to match for delegated events
								type: type, // the event type (e.g. "click")
								namespace: namespace, // the event namespace (e.g. ".foo")
								unbindSelfOnTrigger: p.unbindSelfOnTrigger,
								unbindAllBindersOnTrigger: p.unbindAllBindersOnTrigger,
								binders: all // who bound together
							};

							for( var j = 0; j < all.length; j++ ){
								all[j]._private.listeners.push( listener );
							}
						}
					} // for events array
				} // for events map
				
				return self; // maintain chaining
			}; // function
		}, // on

		off: function( params ){
			var defaults = {
			};
			params = $$.util.extend({}, defaults, params);
			
			return function(events, selector, callback){
				var self = this;
				var selfIsArrayLike = self.length !== undefined;
				var all = selfIsArrayLike ? self : [self]; // put in array if not array-like
				var single = selfIsArrayLike ? self[0] : self;
				var eventsIsString = $$.is.string(events);
				var p = params;

				if( arguments.length === 0 ){ // then unbind all

					for( var i = 0; i < all.length; i++ ){
						all[i]._private.listeners = [];
					}

					return self; // maintain chaining
				}

				if( $$.is.fn(selector) || selector === false ){ // selector is actually callback
					callback = selector;
					selector = undefined;
				}

				if( eventsIsString ){ // then convert to map
					var map = {};
					map[ events ] = callback;
					events = map;
				}

				for( var evts in events ){
					callback = events[evts];

					if( callback === false ){
						callback = $$.define.event.falseCallback;
					}

					evts = evts.split(/\s+/);
					for( var h = 0; h < evts.length; h++ ){
						var evt = evts[h];
						if( $$.is.emptyString(evt) ){ continue; }

						var match = evt.match( $$.define.event.optionalTypeRegex ); // [type][.namespace]
						if( match ){
							var type = match[1] ? match[1] : undefined;
							var namespace = match[2] ? match[2] : undefined;

							for( var i = 0; i < all.length; i++ ){ //
								var listeners = all[i]._private.listeners;

								for( var j = 0; j < listeners.length; j++ ){
									var listener = listeners[j];
									var nsMatches = !namespace || namespace === listener.namespace;
									var typeMatches = !type || listener.type === type;
									var cbMatches = !callback || callback === listener.callback;
									var listenerMatches = nsMatches && typeMatches && cbMatches;

									// delete listener if it matches
									if( listenerMatches ){
										listeners.splice(j, 1);
										j--;
									}
								} // for listeners
							} // for all
						} // if match
					} // for events array

				} // for events map
				
				return self; // maintain chaining
			}; // function
		}, // off

		trigger: function( params ){
			var defaults = {};
			params = $$.util.extend({}, defaults, params);
			
			return function(events, extraParams, fnToTrigger){
				var self = this;
				var selfIsArrayLike = self.length !== undefined;
				var all = selfIsArrayLike ? self : [self]; // put in array if not array-like
				var single = selfIsArrayLike ? self[0] : self;
				var eventsIsString = $$.is.string(events);
				var eventsIsObject = $$.is.plainObject(events);
				var eventsIsEvent = $$.is.event(events);
				var p = params;
				var cy = this._private.cy || this;

				if( eventsIsString ){ // then make a plain event object for each event name
					var evts = events.split(/\s+/);
					events = [];

					for( var i = 0; i < evts.length; i++ ){
						var evt = evts[i];
						if( $$.is.emptyString(evt) ){ continue; }

						var match = evt.match( $$.define.event.regex ); // type[.namespace]
						var type = match[1];
						var namespace = match[2] ? match[2] : undefined;

						events.push( {
							type: type,
							namespace: namespace
						} );
					}
				} else if( eventsIsObject ){ // put in length 1 array
					var eventArgObj = events;

					events = [ eventArgObj ];
				}

				if( extraParams ){
					if( !$$.is.array(extraParams) ){ // make sure extra params are in an array if specified
						extraParams = [ extraParams ];
					}
				} else { // otherwise, we've got nothing
					extraParams = [];
				}

				for( var i = 0; i < events.length; i++ ){ // trigger each event in order
					var evtObj = events[i];
					
					for( var j = 0; j < all.length; j++ ){ // for each
						var triggerer = all[j];
						var listeners = triggerer._private.listeners;
						var triggererIsElement = $$.is.element(triggerer);
						var bubbleUp = triggererIsElement;

						// create the event for this element from the event object
						var evt;

						if( eventsIsEvent ){ // then just get the object
							evt = evtObj;
							
							evt.cyTarget = evt.cyTarget || triggerer;
							evt.cy = evt.cy || cy;
							evt.namespace = evt.namespace || evtObj.namespace;

						} else { // then we have to make one
							evt = new $$.Event( evtObj, {
								cyTarget: triggerer,
								cy: cy,
								namespace: evtObj.namespace
							} );

							// copy properties like jQuery does
							var props = $$.define.event.props;
							for( var k = 0; k < props.length; k++ ){
								var prop = props[k];
								evt[ prop ] = evtObj[ prop ];
							}
						}

						if( fnToTrigger ){ // then override the listeners list with just the one we specified
							listeners = [{
								namespace: evt.namespace,
								type: evt.type,
								callback: fnToTrigger
							}];
						}

						for( var k = 0; k < listeners.length; k++ ){ // check each listener
							var lis = listeners[k];
							var nsMatches = !lis.namespace || lis.namespace === evt.namespace;
							var typeMatches = lis.type === evt.type;
							var targetMatches = lis.delegated ? ( triggerer !== evt.cyTarget && $$.is.element(evt.cyTarget) && evt.cyTarget.is(lis.selector) ) : (true); // we're not going to validate the hierarchy; that's too expensive
							var listenerMatches = nsMatches && typeMatches && targetMatches;

							if( listenerMatches ){ // then trigger it
								var args = [ evt ];
								args = args.concat( extraParams ); // add extra params to args list

								if( lis.data ){ // add on data plugged into binding
									evt.data = lis.data;
								} else { // or clear it in case the event obj is reused
									evt.data = undefined;
								}

								if( lis.unbindSelfOnTrigger || lis.unbindAllBindersOnTrigger ){ // then remove listener
									listeners.splice(k, 1);
									k--;
								}

								if( lis.unbindAllBindersOnTrigger ){ // then delete the listener for all binders
									var binders = lis.binders;
									for( var l = 0; l < binders.length; l++ ){
										var binder = binders[l];
										if( !binder || binder === triggerer ){ continue; } // already handled triggerer or we can't handle it

										var binderListeners = binder._private.listeners;
										for( var m = 0; m < binderListeners.length; m++ ){
											var binderListener = binderListeners[m];

											if( binderListener === lis ){ // delete listener from list
												binderListeners.splice(m, 1);
												m--;
											}
										}
									}
								}

								// run the callback
								var context = lis.delegated ? evt.cyTarget : triggerer;
								var ret = lis.callback.apply( context, args );

								if( ret === false || evt.isPropagationStopped() ){
									// then don't bubble
									bubbleUp = false;

									if( ret === false ){
										// returning false is a shorthand for stopping propagation and preventing the def. action
										evt.stopPropagation();
										evt.preventDefault();
									}
								}
							} // if listener matches
						} // for each listener

						// bubble up event for elements
						if( bubbleUp ){
							var parent = triggerer.parent();
							var hasParent = parent.length !== 0;

							if( hasParent ){ // then bubble up to parent
								parent = parent[0];
								parent.trigger(evt);
							} else { // otherwise, bubble up to the core
								cy.trigger(evt);
							}
						}

					} // for each of all
				} // for each event
				
				return self; // maintain chaining
			}; // function
		} // trigger

	}; // define

	
})( cytoscape );

;(function($$, window){
	
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

	$$.Stylesheet.prototype.assignToStyle = function( style ){
		style.clear();

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

		// each visual style property has a type and needs to be validated according to it
		$$.style.types = {
			zeroOneNumber: { number: true, min: 0, max: 1, unitless: true },
			nonNegativeInt: { number: true, min: 0, integer: true, unitless: true },
			size: { number: true, min: 0 },
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
			cursor: { enums: ["auto", "crosshair", "default", "e-resize", "n-resize", "ne-resize", "nw-resize", "pointer", "progress", "s-resize", "sw-resize", "text", "w-resize", "wait", "grab", "grabbing"] },
			text: { string: true },
			data: { mapping: true, regex: "^data\\s*\\(\\s*(\\w+)\\s*\\)$" },
			mapData: { mapping: true, regex: "^mapData\\((\\w+)\\s*\\,\\s*(" + number + ")\\s*\\,\\s*(" + number + ")\\s*,\\s*(\\w+)\\s*\\,\\s*(\\w+)\\)$" },
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
			{ name: "visibility", type: t.visibility },
			{ name: "opacity", type: t.zeroOneNumber },
			{ name: "z-index", type: t.nonNegativeInt },

			// these are just for nodes
			{ name: "background-color", type: t.color },
			{ name: "background-opacity", type: t.zeroOneNumber },
			{ name: "border-color", type: t.color },
			{ name: "border-opacity", type: t.zeroOneNumber },
			{ name: "border-width", type: t.size },
			{ name: "border-style", type: t.lineStyle },
			{ name: "background-image", type: t.url },
			{ name: "height", type: t.size },
			{ name: "width", type: t.size },
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
			{ name: "panning-cursor", type: t.cursor }
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
					"text-outline-color": "transparent",
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
					"visibility": "visible",
					"opacity": 1,
					"z-index": 0,
					"content": ""
				})
			.selector("node") // just node properties
				.css({
					"background-color": "#888",
					"background-opacity": 1,
					"background-image": "none",
					"border-color": "#000",
					"border-opacity": 1,
					"border-width": 0,
					"border-style": "solid",
					"height": 30,
					"width": 30,
					"shape": "ellipse"
				})
			.selector("edge") // just edge properties
				.css({
					"source-arrow-shape": "none",
					"target-arrow-shape": "none",
					"source-arrow-color": "#bbb",
					"target-arrow-color": "#bbb",
					"line-style": "solid",
					"line-color": "#bbb",
					"width": 1,
					"control-point-step-size": 40,
					"curve-style": "bezier"
				})
			.selector("core") // just core properties
				.css({
					"selection-box-color": "#ddd",
					"selection-box-opacity": 0.65,
					"selection-box-border-color": "#aaa",
					"selection-box-border-width": 1,
					"panning-cursor": "grabbing"
				})
		;
	};

	// remove all contexts
	$$.styfn.clear = function(){
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
					var match = value.match( "^(" + $$.util.regex.number + ")(px|em)?" + "$" );
					if( !match ){ return null; } // no match => not a number

					value = match[1];
					units = match[2] || "px";
				} else {
					units = "px"; // implicitly px if unspecified
				}
			}

			value = parseFloat( value );

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
				pxValue: type.unitless ?
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
	$$.styfn.applyParsedProperty = function( ele, parsedProp ){
		var prop = parsedProp;
		var style = ele._private.style;
		var fieldVal, flatProp;
		var type = $$.style.properties[ prop.name ].type;
		var propIsBypass = prop.bypass;
		var origProp = style[ prop.name ];
		var origPropIsBypass = origProp && origProp.bypass;

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

			if( !flatProp ){ return false; } // don't apply if invalid

			flatProp.mapping = prop; // keep a reference to the mapping
			prop = flatProp; // the flattened (mapped) property is the one we want

			break;

		case $$.style.types.data: // direct mapping
			fieldVal = ele._private.data[ prop.field ];

			flatProp = this.parse( prop.name, fieldVal, prop.bypass );
			if( !flatProp ){ return false; } // don't apply property if the field isn't a valid prop val

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
			if( origPropIsBypass ){ // then keep the orig prop (since it's a bypass) and link to the new prop
				origProp.bypassed = prop;
			} else { // then just replace the old prop with the new one
				style[ prop.name ] = prop; 
			}
		}

		return true;
	};

	// parse a property and then apply it
	$$.styfn.applyProperty = function( ele, name, value ){
		var parsedProp = this.parse(name, value);
		if( !parsedProp ){ return false; } // can't apply if we can't parse

		return this.applyParsedProperty( ele, parsedProp );
	};

	// (potentially expensive calculation)
	// apply the style to the element based on
	// - its bypass
	// - what selectors match it
	$$.styfn.apply = function( eles ){
		for( var ie = 0; ie < eles.length; ie++ ){
			var ele = eles[ie];

			// apply the styles
			for( var i = 0; i < this.length; i++ ){
				var context = this[i];
				var contextSelectorMatches = context.selector && context.selector.filter( ele ).length > 0; // NB: context.selector may be null for "core"
				var props = context.properties;

				if( contextSelectorMatches ){ // then apply its properties
					for( var j = 0; j < props.length; j++ ){ // for each prop
						var prop = props[j];
						this.applyParsedProperty( ele, prop );
					}
				}
			} // for context

		} // for elements
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

	// gets the control points for the specified edges (assuming bezier curve-style)
	// 
	$$.styfn.calculateControlPoints = function( parallelEdges ){
		var ctrlpts = {};

		var someEdgesAreBundled = false;
		var numParallelEdges = parallelEdges.length;
		for( var i = 0; i < parallelEdges.length; i++ ){
			var e = parallelEdges[i];
			var isBundled = e._private.style["curve-style"].strValue === "bundled";
			if( isBundled ){
				someEdgesAreBundled = true;
				break;
			}
		}
		var useStraightLineInMiddle = numParallelEdges % 2 !== 0 && !someEdgesAreBundled;
		
		// calculate the control point for each edge
		for( var i = 0; i < parallelEdges.length; i++ ){ // index is the parallel index
			var edge = parallelEdges[i];
			var id = edge._private.data.id;

			// source & target node stats
			var src = edge.source();
			var tgt = edge.target();
			var srcPos = src.position();
			var tgtPos = tgt.position();
			var midpt = {
				x: (srcPos.x + tgtPos.x)/2,
				y: (srcPos.y + tgtPos.y)/2
			};

			var stepSize = edge._private.style["control-point-step-size"].pxValue;

			var start = (numParallelEdges - 1) * -stepSize / 2;

			if (src.id() == tgt.id()) {
				parallelEdges[i]._private.rscratch.isSelfEdge = true;
				
				// For self-edges, use 2 quadratic Beziers, with control points West
				// and North of the node
				
				edge._private.rscratch.cp2ax = srcPos.x;
				edge._private.rscratch.cp2ay = srcPos.y - 1.3 * stepSize * (i / 3 + 1);
				
				edge._private.rscratch.cp2cx = srcPos.x - 1.3 * stepSize * (i / 3 + 1);
				edge._private.rscratch.cp2cy = srcPos.y;
				
				edge._private.rscratch.selfEdgeMidX =
					(edge._private.rscratch.cp2ax + edge._private.rscratch.cp2cx) / 2.0;
				
				edge._private.rscratch.selfEdgeMidY =
					(edge._private.rscratch.cp2ay + edge._private.rscratch.cp2cy) / 2.0;
				
				continue;
			}
		
			var distFromMidpt = start + stepSize * i; // NB may be negative to indicate other side

			if (numParallelEdges % 2 == 1 
				&& i == Math.floor(numParallelEdges / 2)) {
				parallelEdges[i]._private.rscratch.isStraightEdge = true;
				
				continue;
			}
			
			parallelEdges[i]._private.rscratch.isBezierEdge = true;
			
			var displacement = {
				x: tgtPos.y - srcPos.y,
				y: srcPos.x - tgtPos.x
			};
			var displacementLength = Math.sqrt(displacement.x * displacement.x
				+ displacement.y * displacement.y);
		
			if (src.id() > tgt.id()) {
				displacementLength *= -1;
			}
			
			displacement.x /= displacementLength;
			displacement.y /= displacementLength;
			
			parallelEdges[i]._private.rscratch.cp2x
				= midpt.x + displacement.x * distFromMidpt;
			
			parallelEdges[i]._private.rscratch.cp2y
				= midpt.y + displacement.y * distFromMidpt;
		}
	};

})( cytoscape, typeof window === 'undefined' ? null : window );

;(function($$){
	
	$$.fn.core = function( fnMap, options ){
		for( var name in fnMap ){
			var fn = fnMap[name];
			$$.Core.prototype[ name ] = fn;
		}
	};
	
	$$.Core = function( opts ){
		if( !(this instanceof $$.Core) ){
			return new $$.Core(opts);
		}
		var cy = this;

		var container = opts.container;
		var reg = $$.getRegistrationForInstance(cy, container);
		if( reg ){ // already registered => just update ref
			reg.cy = this;
			reg.domElement = container;
		} else { // then we have to register
			reg = $$.registerInstance( cy, container );
		}
		var readies = reg.readies;

		var options = opts;
		options.layout = $$.util.extend( { name: typeof module === 'undefined' ? "grid" : "null" }, options.layout );
		options.renderer = $$.util.extend( { name: typeof module === 'undefined' ? "canvas" : "null" }, options.renderer );
		
		// TODO determine whether we need a check like this even though we allow running headless now
		// 
		// if( !$$.is.domElement(options.container) ){
		// 	$$.util.error("Cytoscape.js must be called on an element");
		// 	return;
		// }
		
		this._private = {
			ready: false, // whether ready has been triggered
			instanceId: null, // the registered instance id
			options: options, // cached options
			elements: [], // array of elements
			id2index: {}, // element id => index in elements array
			listeners: [], // list of listeners
			aniEles: [], // array of elements being animated
			scratch: {}, // scratch object for core
			layout: null,
			renderer: null,
			notificationsEnabled: true, // whether notifications are sent to the renderer
			minZoom: 1e-50,
			maxZoom: 1e50,
			zoomEnabled: true,
			panEnabled: true,
			zoom: $$.is.number(options.zoom) ? options.zoom : 1,
			pan: {
				x: $$.is.plainObject(options.pan) && $$.is.number(options.pan.x) ? options.pan.x : 0,
				y: $$.is.plainObject(options.pan) && $$.is.number(options.pan.y) ? options.pan.y : 0,
			}
		};

		// init zoom bounds
		if( $$.is.number(options.minZoom) && $$.is.number(options.maxZoom) && options.minZoom < options.maxZoom ){
			this._private.minZoom = options.minZoom;
			this._private.maxZoom = options.maxZoom;
		} else if( $$.is.number(options.minZoom) && options.maxZoom === undefined ){
			this._private.minZoom = options.minZoom;
		} else if( $$.is.number(options.maxZoom) && options.minZoom === undefined ){
			this._private.maxZoom = options.maxZoom;
		}

		// init style
		this._private.style = $$.is.stylesheet(options.style) ? options.style.generateStyle(this) : new $$.Style( cy );

		cy.initRenderer( options.renderer );

		// initial load
		cy.load(options.elements, function(){ // onready
			cy.startAnimationLoop();
			cy._private.ready = true;

			// bind all the ready handlers registered before creating this instance
			for( var i = 0; i < readies.length; i++ ){
				var fn = readies[i];
				cy.bind("ready", fn);
			}
			reg.readies = []; // clear b/c we've bound them all and don't want to keep it around in case a new core uses the same div etc
			
			// if a ready callback is specified as an option, the bind it
			if( $$.is.fn( options.ready ) ){
				cy.bind("ready", options.ready);
			}
			
			cy.trigger("ready");
		}, options.done);
	};

	$$.corefn = $$.Core.prototype; // short alias
	

	$$.fn.core({
		ready: function(){
			return this._private.ready;
		},

		registered: function(){
			if( this._private && this._private.instanceId != null ){
				return true;
			} else {
				return false;
			}
		},

		registeredId: function(){
			return this._private.instanceId;
		},

		getElementById: function( id ){
			var index = this._private.id2index[ id ];
			if( index !== undefined ){
				return this._private.elements[ index ];
			}

			// worst case, return an empty collection
			return new $$.Collection( this );
		},

		addToPool: function( eles ){
			var elements = this._private.elements;
			var id2index = this._private.id2index;

			for( var i = 0; i < eles.length; i++ ){
				var ele = eles[i];

				var id = ele._private.data.id;
				var index = id2index[ id ];
				var alreadyInPool = index !== undefined;

				if( !alreadyInPool ){
					index = elements.length;
					elements.push( ele )
					id2index[ id ] = index;
				}
			}

			return this; // chaining
		},

		removeFromPool: function( eles ){
			var elements = this._private.elements;
			var id2index = this._private.id2index;

			for( var i = 0; i < eles.length; i++ ){
				var ele = eles[i];

				var id = ele._private.data.id;
				var index = id2index[ id ];
				var inPool = index !== undefined;

				if( inPool ){
					delete this._private.id2index[ id ];
					elements.splice(index, 1);

					// adjust the index of all elements past this index
					for( var j = index; j < elements.length; j++ ){
						var jid = elements[j]._private.data.id;
						id2index[ jid ]--;
					}
				}
			}
		},

		container: function(){
			return this._private.options.container;
		},

		options: function(){
			return $$.util.copy( this._private.options );
		},
		
		json: function(params){
			var json = {};
			var cy = this;
			
			json.elements = {};
			cy.elements().each(function(i, ele){
				var group = ele.group();
				
				if( !json.elements[group] ){
					json.elements[group] = [];
				}
				
				json.elements[group].push( ele.json() );
			});

			json.style = cy.style();
			json.scratch = cy.scratch();
			json.zoomEnabled = cy._private.zoomEnabled;
			json.panEnabled = cy._private.panEnabled;
			json.layout = cy._private.options.layout;
			json.renderer = cy._private.options.renderer;
			
			return json;
		}
		
	});	
	
})( cytoscape );

(function($$, window){
	
	$$.fn.core({
		add: function(opts){
			
			var elements;
			var cy = this;
			
			// add the elements
			if( $$.is.elementOrCollection(opts) ){
				var eles = opts;
				var jsons = [];

				for( var i = 0; i < eles.length; i++ ){
					var ele = eles[i];
					jsons.push( ele.json() );
				}

				elements = new $$.Collection( cy, jsons );
			}
			
			// specify an array of options
			else if( $$.is.array(opts) ){
				var jsons = opts;

				elements = new $$.Collection(cy, jsons);
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

							var mjson = $$.util.extend({}, json, { group: group });
							jsons.push( mjson );
						}
					} 
				}

				elements = new $$.Collection(cy, jsons);
			}
			
			// specify options for one element
			else {
				var json = opts;
				elements = (new $$.Element( cy, json )).collection();
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
			if( window && window.chrome ){
				setTimeout(function(){
					callback();
				}, 30);
			} else {
				callback();
			}

			return this;
		}
	});
	
})( cytoscape, typeof window === 'undefined' ? null : window );

;(function($$){
	
	$$.fn.core({
		
		addToAnimationPool: function( eles ){
			var cy = this;
			var aniEles = cy._private.aniEles;
			var aniElesHas = [];

			for( var i = 0; i < aniEles.length; i++ ){
				var id = aniEles[i]._private.data.id;
				aniElesHas[ id ] = true;
			}

			for( var i = 0; i < eles.length; i++ ){
				var ele = eles[i];
				var id = ele._private.data.id;

				if( !aniElesHas[id] ){
					aniEles.push( ele );
				} 
			}
		},

		startAnimationLoop: function(){
			var cy = this;
			var stepDelay = 10;
			var useTimeout = false;
			var useRequestAnimationFrame = true;
			
			// initialise the list
			cy._private.aniEles = [];
			
			// TODO change this when standardised
			var requestAnimationFrame = typeof window === 'undefined' ? function(){} : ( window.requestAnimationFrame || window.mozRequestAnimationFrame ||  
				window.webkitRequestAnimationFrame || window.msRequestAnimationFrame );
			
			if( requestAnimationFrame == null || !useRequestAnimationFrame ){
				requestAnimationFrame = function(fn){
					window.setTimeout(function(){
						fn(+new Date);
					}, stepDelay);
				};
			}
			
			var containerDom = cy.container();
			
			function globalAnimationStep(){
				function exec(){
					requestAnimationFrame(function(now){
						handleElements(now);
						globalAnimationStep();
					}, containerDom);
				}
				
				if( useTimeout ){
					setTimeout(function(){
						exec();
					}, stepDelay);
				} else {
					exec();
				}
			}
			
			globalAnimationStep(); // first call
			
			function handleElements(now){

				var eles = cy._private.aniEles;
				for( var e = 0; e < eles.length; e++ ){
					var ele = eles[e];
					
					// we might have errors if we edit animation.queue and animation.current
					// for ele (i.e. by stopping)
					// try{

						var current = ele._private.animation.current;
						var queue = ele._private.animation.queue;
						
						// if nothing currently animating, get something from the queue
						if( current.length === 0 ){
							var q = queue;
							var next = q.length > 0 ? q.shift() : null;
							
							if( next != null ){
								next.callTime = +new Date; // was queued, so update call time
								current.push( next );
							}
						}
						
						// step and remove if done
						var completes = [];
						for(var i = 0; i < current.length; i++){
							var ani = current[i];
							step( ele, ani, now );

							if( current[i].done ){
								completes.push( ani );
								
								// remove current[i]
								current.splice(i, 1);
								i--;
							}
						}
						
						// call complete callbacks
						for( var i = 0; i < completes.length; i++ ){
							var ani = completes[i];
							var complete = ani.params.complete;

							if( $$.is.fn(complete) ){
								complete.apply( ele, [ now ] );
							}
						}
						
					// } catch(e){
					// 	// do nothing
					// }
					
				} // each element
				
				
				// notify renderer
				if( eles.length > 0 ){
					cy.notify({
						type: "draw",
						collection: eles
					});
				}
				
				// remove elements from list of currently animating if its queues are empty
				for( var i = 0; i < eles.length; i++ ){
					var ele = eles[i];
					var queue = ele._private.animation.queue;
					var current = ele._private.animation.current;
					var keepEle = current.length > 0 || queue.length > 0;
					
					if( !keepEle ){ // then remove from the array
						eles.splice(i, 1);
						i--;
					}
				}

			} // handleElements
				
			function step( self, animation, now ){
				var style = cy.style();
				var properties = animation.properties;
				var params = animation.params;
				var startTime = animation.callTime;
				var percent;
				
				if( animation.duration === 0 ){
					percent = 1;
				} else {
					percent = Math.min(1, (now - startTime)/animation.duration);
				}
				
				if( properties.delay == null ){ // then update the position
					var startPos = animation.startPosition;
					var endPos = properties.position;
					var pos = self._private.position;
					if( endPos ){
						if( valid( startPos.x, endPos.x ) ){
							pos.x = ease( startPos.x, endPos.x, percent );
						}

						if( valid( startPos.y, endPos.y ) ){
							pos.y = ease( startPos.y, endPos.y, percent );
						}
					}

					if( properties.css ){
						var props = $$.style.properties;
						for( var i = 0; i < props.length; i++ ){
							var name = props[i].name;
							var end = properties.css[ name ];

							if( end !== undefined ){
								var start = animation.startStyle[ name ];
								var easedVal = ease( start, end, percent );
								
								style.applyBypass( self, name, easedVal );
							}
						} // for props
					} // if 
				}
				
				if( $$.is.fn(params.step) ){
					params.step.apply( self, [ now ] );
				}
				
				if( percent >= 1 ){
					animation.done = true;
				}
				
				return percent;
			}
			
			function valid(start, end){
				if( start == null || end == null ){
					return false;
				}
				
				if( $$.is.number(start) && $$.is.number(end) ){
					return true;
				} else if( (start) && (end) ){
					return true;
				}
				
				return false;
			}
			
			function ease(start, end, percent){
				if( $$.is.number(start) && $$.is.number(end) ){
					return start + (end - start) * percent;

				} else if( $$.is.number(start[0]) && $$.is.number(end[0]) ){ // then assume a colour
					var c1 = start;
					var c2 = end;

					function ch(ch1, ch2){
						var diff = ch2 - ch1;
						var min = ch1;
						return Math.round( percent * diff + min );
					}
					
					var r = ch( c1[0], c2[0] );
					var g = ch( c1[1], c2[1] );
					var b = ch( c1[2], c2[2] );
					
					return $$.util.tuple2hex( [r, g, b] );
				}
				
				return undefined;
			}
			
		}
		
	});
	
})( cytoscape );


	
		

;(function($$){
	
	$$.fn.core({
		data: $$.define.data({
			field: "data",
			bindingEvent: "data",
			allowBinding: true,
			allowSetting: true,
			settingEvent: "data",
			settingTriggersEvent: true,
			triggerFnName: "trigger",
			allowGetting: true
		}),

		removeData: $$.define.removeData({
			field: "data",
			event: "data",
			triggerFnName: "trigger",
			triggerEvent: true
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
	});
	
})( cytoscape );

;(function($$){

	$$.fn.core({
		on: $$.define.on(), // .on( events [, selector] [, data], handler)
		one: $$.define.on({ unbindSelfOnTrigger: true }),
		once: $$.define.on({ unbindAllBindersOnTrigger: true }),
		off: $$.define.off(), // .off( events [, selector] [, handler] )
		trigger: $$.define.trigger(), // .trigger( events [, extraParams] )
	});

	// aliases for those folks who like old stuff:
	$$.corefn.bind = $$.corefn.on;
	$$.corefn.unbind = $$.corefn.off;

	// add event aliases like .click()
	$$.define.event.aliasesOn( $$.corefn );
		
})( cytoscape );

;(function($$){
	
	$$.fn.core({
		
		layout: function( params ){
			var cy = this;
			
			// if no params, use the previous ones
			if( params == null ){
				params = this._private.options.layout;
			}
			
			this.initLayout( params );
			
			cy.trigger("layoutstart");
			
			this._private.layout.run();
			
			return this;
			
		},
		
		initLayout: function( options ){
			if( options == null ){
				$$.util.error("Layout options must be specified to run a layout");
				return;
			}
			
			if( options.name == null ){
				$$.util.error("A `name` must be specified to run a layout");
				return;
			}
			
			var name = options.name;
			var layoutProto = $$.extension("layout", name);
			
			if( layoutProto == null ){
				$$.util.error("Can not apply layout: No such layout `%s` found; did you include its JS file?", name);
				return;
			}
			
			this._private.layout = new layoutProto( $$.util.extend({}, options, {
				renderer: this._private.renderer,
				cy: this
			}) );
			this._private.options.layout = options; // save options
		}
		
	});
	
})( cytoscape );

(function($$){
	
	$$.fn.core({
		notify: function( params ){
			if( !this._private.notificationsEnabled ){ return; } // exit on disabled
			
			var renderer = this.renderer();
			var cy = this;
			
			// normalise params.collection 
			if( $$.is.element(params.collection) ){ // make collection from element
				var element = params.collection;
				params.collection = new $$.Collection(cy, [ element ]);	
			
			} else if( $$.is.array(params.collection) ){ // make collection from elements array
				var elements = params.collection;
				params.collection = new $$.Collection(cy, elements);	
			} 
			
			renderer.notify(params);
		},
		
		notifications: function( bool ){
			var p = this._private;
			
			if( bool === undefined ){
				return p.notificationsEnabled;
			} else {
				p.notificationsEnabled = bool ? true : false;
			}
		},
		
		noNotifications: function( callback ){
			this.notifications(false);
			callback();
			this.notifications(true);
		}
	});
	
})( cytoscape );

;(function($$){
	
	$$.fn.core({
		
		renderer: function(){
			return this._private.renderer;
		},
		
		initRenderer: function( options ){
			var cy = this;

			var rendererProto = $$.extension("renderer", options.name);
			if( rendererProto == null ){
				$$.util.error("Can not initialise: No such renderer `%s` found; did you include its JS file?", options.name);
				return;
			}
			
			this._private.renderer = new rendererProto(
				$$.util.extend({}, options, {
					cy: cy,
					style: cy._private.style
				})
			);
			
			
		}
		
	});	
	
})( cytoscape );

;(function($$){
	
	$$.fn.core({

		// get a collection
		// - empty collection on no args
		// - collection of elements in the graph on selector arg
		// - guarantee a returned collection when elements or collection specified
		collection: function( eles ){

			if( $$.is.string(eles) ){
				return this.$( eles );
			} else if( $$.is.elementOrCollection(eles) ){
				return eles.collection();
			}

			return new $$.Collection( this );
		},
		
		nodes: function( selector ){
			var nodes = this.$("node");

			if( selector ){
				return nodes.filter( selector );
			} 

			return nodes;
		},
		
		edges: function( selector ){
			var edges = this.$("edge");

			if( selector ){
				return edges.filter( selector );
			}

			return edges;
		},
			
		// search the graph like jQuery
		$: function( selector ){
			var eles = new $$.Collection( this, this._private.elements );

			if( selector ){
				return eles.filter( selector );
			}

			return eles;
		}
		
	});	

	// aliases
	$$.corefn.elements = $$.corefn.filter = $$.corefn.$;	
	
})( cytoscape );

;(function($$){
	
	$$.fn.core({
		
		style: function(val){
			return this._private.style;
		}
	});
	
})( cytoscape );


;(function($$){
	
	$$.fn.core({
		
		panningEnabled: function( bool ){
			if( bool !== undefined ){
				this._private.panEnabled = bool ? true : false;
			} else {
				return this._private.panEnabled;
			}
			
			return this; // chaining
		},
		
		zoomingEnabled: function( bool ){
			if( bool !== undefined ){
				this._private.zoomEnabled = bool ? true : false;
			} else {
				return this._private.zoomEnabled;
			}
			
			return this; // chaining
		},
		
		pan: function(){
			var args = arguments;
			var pan = this._private.pan;
			var dim, val, dims, x, y;

			switch( args.length ){
			case 0: // .pan()
				return pan;

			case 1: 

				if( !this._private.panEnabled ){
					return this;

				} else if( $$.is.string( args[0] ) ){ // .pan("x")
					dim = args[0];
					return pan[ dim ];

				} else if( $$.is.plainObject( args[0] ) ) { // .pan({ x: 0, y: 100 })
					dims = args[0];
					x = dims.x;
					y = dims.y;

					if( $$.is.number(x) ){
						pan.x = x;
					}

					if( $$.is.number(y) ){
						pan.y = y;
					}

					this.trigger("pan");
				}
				break;

			case 2: // .pan("x", 100)
				if( !this._private.panEnabled ){
					return this;
				}

				dim = args[0];
				val = args[1];

				if( (dim === "x" || dim === "y") && $$.is.number(val) ){
					pan[dim] = val;
				}

				this.trigger("pan");
				break;

			default:
				break; // invalid
			}

			this.notify({ // notify the renderer that the viewport changed
				type: "viewport"
			});

			return this; // chaining
		},
		
		panBy: function(params){
			var args = arguments;
			var pan = this._private.pan;
			var dim, val, dims, x, y;

			if( !this._private.panEnabled ){
				return this;
			}

			switch( args.length ){
			case 1: 

				if( $$.is.plainObject( args[0] ) ) { // .panBy({ x: 0, y: 100 })
					dims = args[0];
					x = dims.x;
					y = dims.y;

					if( $$.is.number(x) ){
						pan.x += x;
					}

					if( $$.is.number(y) ){
						pan.y += y;
					}

					this.trigger("pan");
				}
				break;

			case 2: // .panBy("x", 100)
				dim = args[0];
				val = args[1];

				if( (dim === "x" || dim === "y") && $$.is.number(val) ){
					pan[dim] += val;
				}

				this.trigger("pan");
				break;

			default:
				break; // invalid
			}

			this.notify({ // notify the renderer that the viewport changed
				type: "viewport"
			});

			return this; // chaining
		},
		
		fit: function( elements, padding ){
			if( $$.is.number(elements) && padding === undefined ){ // elements is optional
				padding = elements;
				elements = undefined;
			}

			if( !this._private.panEnabled || !this._private.zoomEnabled ){
				return this;
			}

			var bb = this.boundingBox( elements );
			var style = this.style();

			var w = parseFloat( style.containerCss("width") );
			var h = parseFloat( style.containerCss("height") );
			var zoom;
			padding = $$.is.number(padding) ? padding : 0;

			if( !isNaN(w) && !isNaN(h) ){
				zoom = this._private.zoom = Math.min( (w - 2*padding)/bb.w, (h - 2*padding)/bb.h );

				// crop zoom
				zoom = zoom > this._private.maxZoom ? this._private.maxZoom : zoom;
				zoom = zoom < this._private.minZoom ? this._private.minZoom : zoom;

				this._private.pan = { // now pan to middle
					x: (w - zoom*( bb.x1 + bb.x2 ))/2,
					y: (h - zoom*( bb.y1 + bb.y2 ))/2
				};
			}

			this.trigger("pan zoom");

			this.notify({ // notify the renderer that the viewport changed
				type: "viewport"
			});

			return this; // chaining
		},
		
		minZoom: function( zoom ){
			if( zoom === undefined ){
				return this._private.minZoom;
			} else if( $$.is.number(zoom) ){
				this._private.minZoom = zoom;
			}

			return this;
		},

		maxZoom: function( zoom ){
			if( zoom === undefined ){
				return this._private.maxZoom;
			} else if( $$.is.number(zoom) ){
				this._private.maxZoom = zoom;
			}

			return this;
		},

		zoom: function( params ){
			var pos;
			var zoom;

			if( params === undefined ){ // then get the zoom
				return this._private.zoom;

			} else if( $$.is.number(params) ){ // then set the zoom
				zoom = params;
				pos = {
					x: 0,
					y: 0
				};

			} else if( $$.is.plainObject(params) ){ // then zoom about a point
				zoom = params.level;

				if( params.renderedPosition ){
					var rpos = params.renderedPosition;
					var p = this._private.pan;
					var z = this._private.zoom;

					pos = {
						x: (rpos.x - p.x)/z,
						y: (rpos.y - p.y)/z
					};
				} else if( params.position ){
					pos = params.position;
				}

				if( pos && !this._private.panEnabled ){
					return this; // panning disabled
				}
			}

			if( !this._private.zoomEnabled ){
				return this; // zooming disabled
			}

			if( !$$.is.number(zoom) || !$$.is.number(pos.x) || !$$.is.number(pos.y) ){
				return this; // can't zoom with invalid params
			}

			// crop zoom
			zoom = zoom > this._private.maxZoom ? this._private.maxZoom : zoom;
			zoom = zoom < this._private.minZoom ? this._private.minZoom : zoom;

			var pan1 = this._private.pan;
			var zoom1 = this._private.zoom;
			var zoom2 = zoom;
			
			var pan2 = {
				x: -zoom2/zoom1 * (pos.x - pan1.x) + pos.x,
				y: -zoom2/zoom1 * (pos.y - pan1.y) + pos.y
			};

			this._private.zoom = zoom;
			this._private.pan = pan2;

			var posChanged = pan1.x !== pan2.x || pan1.y !== pan2.y;
			this.trigger("zoom" + (posChanged ? " pan" : "") );

			this.notify({ // notify the renderer that the viewport changed
				type: "viewport"
			});

			return this; // chaining
		},
		
		// get the bounding box of the elements (in raw model position)
		boundingBox: function( selector ){
			var eles = this.$( selector );

			return eles.boundingBox();
		},

		center: function(elements){
			if( !this._private.panEnabled || !this._private.zoomEnabled ){
				return this;
			}

			var bb = this.boundingBox( elements );
			var style = this.style();
			var w = parseFloat( style.containerCss("width") );
			var h = parseFloat( style.containerCss("height") );
			var zoom = this._private.zoom;

			this.pan({ // now pan to middle
				x: (w - zoom*( bb.x1 + bb.x2 ))/2,
				y: (h - zoom*( bb.y1 + bb.y2 ))/2
			});
			
			this.trigger("pan");

			this.notify({ // notify the renderer that the viewport changed
				type: "viewport"
			});

			return this; // chaining
		},
		
		reset: function(){
			if( !this._private.panEnabled || !this._private.zoomEnabled ){
				return this;
			}

			this.pan({ x: 0, y: 0 });

			if( this._private.maxZoom > 1 && this._private.minZoom < 1 ){
				this.zoom(1);
			}

			this.notify({ // notify the renderer that the viewport changed
				type: "viewport"
			});
			
			return this; // chaining
		}
	});	
	
})( cytoscape );

;(function($$){
	
	// Use this interface to define functions for collections/elements.
	// This interface is good, because it forces you to think in terms
	// of the collections case (more than 1 element), so we don't need
	// notification blocking nonsense everywhere.
	//
	// Other collection-*.js files depend on this being defined first.
	// It's a trade off: It simplifies the code for Collection and 
	// Element integration so much that it's worth it to create the
	// JS dependency.
	//
	// Having this integration guarantees that we can call any
	// collection function on an element and vice versa.
	$$.fn.collection = $$.fn.eles = function( fnMap, options ){
		for( var name in fnMap ){
			var fn = fnMap[name];

			$$.Collection.prototype[ name ] = fn;
		}
	};
	
	// factory for generating edge ids when no id is specified for a new element
	var idFactory = {
		prefix: {
			nodes: "n",
			edges: "e"
		},
		id: {
			nodes: 0,
			edges: 0
		},
		generate: function(cy, element, tryThisId){
			var json = $$.is.element( element ) ? element._private : element;
			var group = json.group;
			var id = tryThisId != null ? tryThisId : this.prefix[group] + this.id[group];
			
			if( cy.getElementById(id).empty() ){
				this.id[group]++; // we've used the current id, so move it up
			} else { // otherwise keep trying successive unused ids
				while( !cy.getElementById(id).empty() ){
					id = this.prefix[group] + ( ++this.id[group] );
				}
			}
			
			return id;
		}
	};
	
	// Element
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	// represents a node or an edge
	$$.Element = function(cy, params, restore){
		if( !(this instanceof $$.Element) ){
			return new $$.Element(cy, params, restore);
		}

		var self = this;
		restore = (restore === undefined || restore ? true : false);
		
		if( cy === undefined || params === undefined || !$$.is.core(cy) ){
			$$.util.error("An element must have a core reference and parameters set");
			return;
		}
		
		// validate group
		if( params.group !== "nodes" && params.group !== "edges" ){
			$$.util.error("An element must be of type `nodes` or `edges`; you specified `" + params.group + "`");
			return;
		}
		
		// make the element array-like, just like a collection
		this.length = 1;
		this[0] = this;
		
		// NOTE: when something is added here, add also to ele.json()
		this._private = {
			cy: cy,
			single: true, // indicates this is an element
			data: params.data || {}, // data object
			position: params.position || {}, // fields x, y, etc (could be 3d or radial coords; renderer decides)
			listeners: [], // array of bound listeners
			group: params.group, // string; "nodes" or "edges"
			style: {}, // properties as set by the style
			removed: true, // whether it's inside the vis; true if removed (set true here since we call restore)
			selected: params.selected ? true : false, // whether it's selected
			selectable: params.selectable === undefined ? true : ( params.selectable ? true : false ), // whether it's selectable
			locked: params.locked ? true : false, // whether the element is locked (cannot be moved)
			grabbed: false, // whether the element is grabbed by the mouse; renderer sets this privately
			grabbable: params.grabbable === undefined ? true : ( params.grabbable ? true : false ), // whether the element can be grabbed
			classes: {}, // map ( className => true )
			animation: { // object for currently-running animations
				current: [],
				queue: []
			},
			rscratch: {}, // object in which the renderer can store information
			scratch: {}, // scratch objects
			edges: [], // array of connected edges
			children: [] // array of children
		};
		
		// renderedPosition overrides if specified
		if( params.renderedPosition ){
			var rpos = params.renderedPosition;
			var pan = cy.pan();
			var zoom = cy.zoom();

			this._private.position = {
				x: (rpos.x - pan.x)/zoom,
				y: (rpos.y - pan.y)/zoom
			};
		}
		
		if( $$.is.string(params.classes) ){
			var classes = params.classes.split(/\s+/);
			for( var i = 0, l = classes.length; i < l; i++ ){
				var cls = classes[i];
				if( !cls || cls === "" ){ continue; }

				self._private.classes[cls] = true;
			}
		}
		
		if( restore === undefined || restore ){
			this.restore();
		}
		
	};

	
	// Collection
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	// represents a set of nodes, edges, or both together
	$$.Collection = function(cy, elements){
		if( !(this instanceof $$.Collection) ){
			return new $$.Collection(cy, elements);
		}

		if( cy === undefined || !$$.is.core(cy) ){
			$$.util.error("A collection must have a reference to the core");
			return;
		}
		
		var ids = {};
		var uniqueElements = [];
		var createdElements = false;
		
		if( !elements ){
			elements = [];
		} else if( elements.length > 0 && $$.is.plainObject( elements[0] ) && !$$.is.element( elements[0] ) ){
			createdElements = true;

			// make elements from json and restore all at once later
			var eles = [];
			var elesIds = {};

			for( var i = 0, l = elements.length; i < l; i++ ){
				var json = elements[i];

				if( json.data == null ){
					json.data = {};
				}
				
				var data = json.data;

				// make sure newly created elements have valid ids
				if( data.id == null ){
					data.id = idFactory.generate( cy, json );
				} else if( cy.getElementById( data.id ).length != 0 || elesIds[ data.id ] ){
					continue; // can't create element
				}

				var ele = new $$.Element( cy, json, false );
				eles.push( ele );
				elesIds[ data.id ] = true;
			}

			elements = eles;
		}
		
		for( var i = 0, l = elements.length; i < l; i++ ){
			var element = elements[i];
			if( !element ){	continue; }
			
			var id = element._private.data.id;
			
			if( !ids[ id ] ){
				ids[ id ] = element;
				uniqueElements.push( element );
			}
		}
		
		for(var i = 0, l = uniqueElements.length; i < l; i++){
			this[i] = uniqueElements[i];
		}
		this.length = uniqueElements.length;
		
		this._private = {
			cy: cy,
			ids: ids
		};

		// restore the elements if we created them from json
		if( createdElements ){
			this.restore();
		}
	};
	
	
	// Functions
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	// keep the prototypes in sync (an element has the same functions as a collection)
	// and use $$.elefn and $$.elesfn as shorthands to the prototypes
	$$.elefn = $$.elesfn = $$.Element.prototype = $$.Collection.prototype;

	$$.elesfn.cy = function(){
		return this._private.cy;
	};
	
	$$.elesfn.element = function(){
		return this[0];
	};
	
	$$.elesfn.collection = function(){
		if( $$.is.collection(this) ){
			return this;
		} else { // an element
			return new $$.Collection( this._private.cy, [this] );
		}
	};

	$$.elesfn.json = function(){
		var ele = this.element();
		if( ele == null ){ return undefined }

		var p = ele._private;
		
		var json = $$.util.copy({
			data: p.data,
			position: p.position,
			group: p.group,
			bypass: p.bypass,
			removed: p.removed,
			selected: p.selected,
			selectable: p.selectable,
			locked: p.locked,
			grabbed: p.grabbed,
			grabbable: p.grabbable,
			classes: "",
			scratch: p.scratch
		});
		
		var classes = [];
		for( var cls in p.classes ){
			classes.push(cls);
		}
		
		for( var i = 0; i < classes.length; i++ ){
			var cls = classes[i];
			json.classes += cls + ( i < classes.length - 1 ? " " : "" );
		}
		
		return json;
	};

	$$.elesfn.restore = function( notifyRenderer ){
		var self = this;
		var restored = [];
		var cy = self.cy();
		
		if( notifyRenderer === undefined ){
			notifyRenderer = true;
		}

		// create arrays of nodes and edges, since we need to
		// restore the nodes first
		var elements = [];
		var numNodes = 0;
		var numEdges = 0;
		for( var i = 0, l = self.length; i < l; i++ ){
			var ele = self[i];
			
			// keep nodes first in the array and edges after
			if( ele.isNode() ){ // put to front of array if node
				elements.unshift( ele );
				numNodes++;
			} else { // put to end of array if edge
				elements.push( ele );
				numEdges++;
			}
		}

		// now, restore each element
		for( var i = 0, l = elements.length; i < l; i++ ){
			var ele = elements[i];

			if( !ele.removed() ){
				// don't need to do anything
				continue;
			}
			
			var _private = ele._private;
			var data = _private.data;
			
			// set id and validate
			if( data.id === undefined ){
				data.id = idFactory.generate( cy, ele );
			} else if( $$.is.emptyString(data.id) || !$$.is.string(data.id) ){
				// can't create element if it has empty string as id or non-string id
				continue;
			} else if( cy.getElementById( data.id ).length != 0 ){
				// can't create element if one already has that id
				continue;
			}

			var id = data.id; // id is finalised, now let's keep a ref
			
			if( ele.isEdge() ){ // extra checks for edges
				
				var edge = ele;
				var fields = ["source", "target"];
				var fieldsLength = fields.length;
				for(var j = 0; j < fieldsLength; j++){
					
					var field = fields[j];
					var val = data[field];
					
					if( val == null || val === "" ){
						// can't create if source or target is not defined properly
						continue;
					} else if( cy.getElementById(val).empty() ){ 
						// can't create edge if one of its nodes doesn't exist
						continue;
					}
				}
				
				var src = cy.getElementById( data.source );
				var tgt = cy.getElementById( data.target );

				src._private.edges.push( edge );
				tgt._private.edges.push( edge );

			} // if is edge
			 
			// create mock ids map for element so it can be used like collections
			_private.ids = {};
			_private.ids[ data.id ] = ele;

			_private.removed = false;
			cy.addToPool( ele );
			
			restored.push( ele );
		} // for each element

		// do compound node sanity checks
		for( var i = 0; i < numNodes; i++ ){ // each node 
			var node = elements[i];
			var data = node._private.data;
			var id = data.id;

			var parentId = node._private.data.parent;
			var specifiedParent = parentId != null;

			if( specifiedParent ){
				var parent = cy.getElementById( parentId );

				if( parent.empty() ){
					// non-existant parent; just remove it
					delete data.parent;
				} else {
					var selfAsParent = false;
					var ancestor = parent;
					while( !ancestor.empty() ){
						if( node.same(ancestor) ){
							// mark self as parent and remove from data
							selfAsParent = true;
							delete data.parent; // remove parent reference

							// exit or we loop forever
							break;
						}

						ancestor = ancestor.parent();
					}

					if( !selfAsParent ){
						// connect with children
						parent[0]._private.children.push( node );
					}
				} // else
			} // if specified parent
		} // for each node
		
		restored = new $$.Collection( cy, restored );
		if( restored.length > 0 ){

			restored.updateStyle( false ); // when we restore/add elements, they need their style
			restored.connectedNodes().updateStyle( notifyRenderer ); // may need to update style b/c of {degree} selectors

			if( notifyRenderer ){
				restored.rtrigger("add");
			} else {
				restored.trigger("add");
			}
		}
		
		return self; // chainability
	};
	
	$$.elesfn.removed = function(){
		var ele = this[0];
		return ele && ele._private.removed;
	};

	$$.elesfn.inside = function(){
		var ele = this[0];
		return ele && !ele._private.removed;
	};

	$$.elesfn.remove = function( notifyRenderer ){
		var self = this;
		var removed = [];
		var elesToRemove = [];
		var elesToRemoveIds = {};
		var cy = self._private.cy;
		
		if( notifyRenderer === undefined ){
			notifyRenderer = true;
		}
		
		// add connected edges
		function addConnectedEdges(node){
			var edges = node._private.edges; 
			for( var i = 0; i < edges.length; i++ ){
				add( edges[i] );
			}
		}
		

		// add descendant nodes
		function addChildren(node){
			var children = node._private.children;
			
			for( var i = 0; i < children.length; i++ ){
				add( children[i] );
			}
		}

		function add( ele ){
			var alreadyAdded =  elesToRemoveIds[ ele.id() ];
			if( alreadyAdded ){
				return;
			} else {
				elesToRemoveIds[ ele.id() ] = true;
			}

			if( ele.isNode() ){
				elesToRemove.push( ele ); // nodes are removed last

				addConnectedEdges( ele );
				addChildren( ele );
			} else {
				elesToRemove.unshift( ele ); // edges are removed first
			}
		}

		// make the list of elements to remove
		// (may be removing more than specified due to connected edges etc)

		for( var i = 0, l = self.length; i < l; i++ ){
			var ele = self[i];

			add( ele );
		}
		
		function removeEdgeRef(node, edge){
			var connectedEdges = node._private.edges;
			for( var j = 0; j < connectedEdges.length; j++ ){
				var connectedEdge = connectedEdges[j];
				
				if( edge === connectedEdge ){
					connectedEdges.splice( j, 1 );
					break;
				}
			}
		}

		for( var i = 0; i < elesToRemove.length; i++ ){
			var ele = elesToRemove[i];

			// mark as removed
			ele._private.removed = true;

			// remove from core pool
			cy.removeFromPool( ele );

			// add to list of removed elements
			removed.push( ele );

			if( ele.isEdge() ){ // remove references to this edge in its connected nodes
				var src = ele.source()[0];
				var tgt = ele.target()[0];

				removeEdgeRef( src, ele );
				removeEdgeRef( tgt, ele );
			}
		}
		
		var removedElements = new $$.Collection( this.cy(), removed );
		if( removedElements.size() > 0 ){
			// must manually notify since trigger won't do this automatically once removed
			
			if( notifyRenderer ){
				this.cy().notify({
					type: "remove",
					collection: removedElements
				});
			}
			
			removedElements.trigger("remove");
		}
		
		return this;
	};
	
})( cytoscape );


;(function( $$ ){

	$$.fn.eles({
		animated: function(){
			var ele = this[0];

			if( ele ){
				return ele._private.animation.current.length > 0;
			}
		},

		clearQueue: function(){
			for( var i = 0; i < this.length; i++ ){
				var ele = this[i];
				ele._private.animation.queue = [];
			}

			return this;
		},

		delay: function( time, complete ){
			this.animate({
				delay: time
			}, {
				duration: time,
				complete: complete
			});

			return this;
		},

		animate: function( properties, params ){
			var callTime = +new Date;
			var cy = this._private.cy;
			var style = cy.style();
			
			if( params === undefined ){
				params = {};
			}

			if( params.duration === undefined ){
				params.duration = 400;
			}
			
			switch( params.duration ){
			case "slow":
				params.duration = 600;
				break;
			case "fast":
				params.duration = 200;
				break;
			}
			
			if( properties == null || (properties.position == null && properties.css == null && properties.delay == null) ){
				return this; // nothing to animate
			}

			if( properties.css ){
				properties.css = style.getValueStyle( properties.css );
			}

			for( var i = 0; i < this.length; i++ ){
				var self = this[i];

				var pos = self._private.position;
				var startPosition = {
					x: pos.x,
					y: pos.y
				};
				var startStyle = style.getValueStyle( self );
				
				if( self.animated() && (params.queue === undefined || params.queue) ){
					q = self._private.animation.queue;
				} else {
					q = self._private.animation.current;
				}

				q.push({
					properties: properties,
					duration: params.duration,
					params: params,
					callTime: callTime,
					startPosition: startPosition,
					startStyle: startStyle
				});
			}

			cy.addToAnimationPool( this );

			return this; // chaining
		}, // animate

		stop: function(clearQueue, jumpToEnd){
			for( var i = 0; i < this.length; i++ ){
				var self = this[i];
				var anis = self._private.animation.current;

				for( var j = 0; j < anis.length; j++ ){
					var animation = anis[j];		
					if( jumpToEnd ){
						// next iteration of the animation loop, the animation
						// will go straight to the end and be removed
						animation.duration = 0; 
					}
				}
				
				// clear the queue of future animations
				if( clearQueue ){
					self._private.animation.queue = [];
				}
			}
			
			// we have to notify (the animation loop doesn't do it for us on `stop`)
			this.cy().notify({
				collection: this,
				type: "draw"
			});
			
			return this;
		}
	});
	
})( cytoscape );	

;(function( $$ ){
	
	$$.fn.eles({
		addClass: function(classes){
			classes = classes.split(/\s+/);
			var self = this;
			var changed = [];
			
			for( var i = 0; i < classes.length; i++ ){
				var cls = classes[i];
				if( $$.is.emptyString(cls) ){ continue; }
				
				for( var j = 0; j < self.length; j++ ){
					var ele = self[j];
					var hasClass = ele._private.classes[cls];
					ele._private.classes[cls] = true;

					if( !hasClass ){ // if didn't already have, add to list of changed
						changed.push( ele );
					}
				}
			}
			
			// trigger update style on those eles that had class changes
			new $$.Collection(this._private.cy, changed).updateStyle();

			self.trigger("class");
			return self;
		},

		hasClass: function(className){
			var ele = this[0];
			return ele != null && ele._private.classes[className];
		},

		toggleClass: function(classesStr, toggle){
			var classes = classesStr.split(/\s+/);
			var self = this;
			var changed = []; // eles who had classes changed
			
			for( var i = 0, il = self.length; i < il; i++ ){
				var ele = self[i];

				for( var j = 0; j < classes.length; j++ ){
					var cls = classes[j];

					if( $$.is.emptyString(cls) ){ continue; }
					
					var hasClass = ele._private.classes[cls];
					var shouldAdd = toggle || (toggle === undefined && !hasClass);

					if( shouldAdd ){
						ele._private.classes[cls] = true;

						if( !hasClass ){ changed.push(ele); }
					} else { // then remove
						ele._private.classes[cls] = false;

						if( hasClass ){ changed.push(ele); }
					}

				} // for j classes
			} // for i eles
			
			// trigger update style on those eles that had class changes
			new $$.Collection(this._private.cy, changed).updateStyle();

			self.trigger("class");
			return self;
		},

		removeClass: function(classes){
			classes = classes.split(/\s+/);
			var self = this;
			var changed = [];

			for( var i = 0; i < self.length; i++ ){
				var ele = self[i];

				for( var j = 0; j < classes.length; j++ ){
					var cls = classes[j];
					if( !cls || cls === "" ){ continue; }

					var hasClass = ele._private.classes[cls];
					delete ele._private.classes[cls];

					if( hasClass ){ // then we changed its set of classes
						changed.push( ele );
					}
				}
			}
			
			// trigger update style on those eles that had class changes
			new $$.Collection(self._private.cy, changed).updateStyle();

			self.trigger("class");
			return self;
		}
	});
	
})( cytoscape );

;(function($$){

	$$.fn.eles({
		allAre: function(selector){
			return this.filter(selector).length === this.length;
		},

		is: function(selector){
			return this.filter(selector).length > 0;
		},

		same: function( collection ){
			collection = this.cy().collection( collection );

			// cheap extra check
			if( this.length !== collection.length ){
				return false;
			}

			return this.intersect( collection ).length === this.length;
		},

		anySame: function(collection){
			collection = this.cy().collection( collection );

			return this.intersect( collection ).length > 0;
		},

		allAreNeighbors: function(collection){
			collection = this.cy().collection( collection );

			return this.neighborhood().intersect( collection ).length === collection.length;
		}
	});
	
})( cytoscape );

;(function($$){
	
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

					var elePos = ele._private.position;
					elePos.x = pos.x;
					elePos.y = pos.y;
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
				return this._private.style.width.pxValue;
			}
		},

		outerWidth: function(){
			var ele = this[0];

			if( ele ){
				var style = this._private.style;
				var width = style.width.pxValue;
				var border = style["border-width"] ? style["border-width"].pxValue : 0;

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
				return this._private.style.height.pxValue;
			}
		},

		outerHeight: function(){
			var ele = this[0];

			if( ele ){
				var style = this._private.style;
				var height = style.height.pxValue;
				var border = style["border-width"] ? style["border-width"].pxValue : 0;

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

				if( ele.isNode() ){
					var pos = ele._private.position;
					var x = pos.x;
					var y = pos.y;
					var w = ele.outerWidth();
					var halfW = w/2;
					var h = ele.outerHeight();
					var halfH = h/2;

					var ex1 = x - halfW;
					var ex2 = x + halfW;
					var ey1 = y - halfH;
					var ey2 = y + halfH;

					x1 = ex1 < x1 ? ex1 : x1;
					x2 = ex2 > x2 ? ex2 : x2;
					y1 = ey1 < y1 ? ey1 : y1;
					y2 = ey2 > y2 ? ey2 : y2;
				}
			}

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

;(function( $$ ){
	
	// Regular degree functions (works on single element)
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	function defineDegreeFunction(callback){
		return function(){
			var self = this;
			
			if( self.length === 0 ){ return; }

			if( self.isNode() && !self.removed() ){
				var degree = 0;
				var node = self[0];
				var connectedEdges = node._private.edges;

				for( var i = 0; i < connectedEdges.length; i++ ){
					var edge = connectedEdges[i];
					degree += callback( node, edge );
				}
				
				return degree;
			} else {
				return;
			}
		};
	}
	
	$$.fn.eles({
		degree: defineDegreeFunction(function(node, edge){
			if( edge.source().same( edge.target() ) ){
				return 2;
			} else {
				return 1;
			}
		}),

		indegree: defineDegreeFunction(function(node, edge){
			if( edge.target().same(node) ){
				return 1;
			} else {
				return 0;
			}
		}),

		outdegree: defineDegreeFunction(function(node, edge){
			if( edge.source().same(node) ){
				return 1;
			} else {
				return 0;
			}
		})
	});
	
	
	// Collection degree stats
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	function defineDegreeBoundsFunction(degreeFn, callback){
		return function(){
			var ret = undefined;
			var nodes = this.nodes();

			for( var i = 0; i < nodes.length; i++ ){
				var ele = nodes[i];
				var degree = ele[degreeFn]();
				if( degree !== undefined && (ret === undefined || callback(degree, ret)) ){
					ret = degree;
				}
			}
			
			return ret;
		};
	}
	
	$$.fn.eles({
		minDegree: defineDegreeBoundsFunction("degree", function(degree, min){
			return degree < min;
		}),

		maxDegree: defineDegreeBoundsFunction("degree", function(degree, max){
			return degree > max;
		}),

		minIndegree: defineDegreeBoundsFunction("indegree", function(degree, min){
			return degree < min;
		}),

		maxIndegree: defineDegreeBoundsFunction("indegree", function(degree, max){
			return degree > max;
		}),

		minOutdegree: defineDegreeBoundsFunction("outdegree", function(degree, min){
			return degree < min;
		}),

		maxOutdegree: defineDegreeBoundsFunction("outdegree", function(degree, max){
			return degree > max;
		})
	});
	
	$$.fn.eles({
		totalDegree: function(){
			var total = 0;
			var nodes = this.nodes();

			for( var i = 0; i < nodes.length; i++ ){
				total += nodes[i].degree();
			}

			return total;
		}
	});
	
})( cytoscape );

	

;(function($$){
	
	// Functions for binding & triggering events
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	$$.fn.eles({
		on: $$.define.on(), // .on( events [, selector] [, data], handler)
		one: $$.define.on({ unbindSelfOnTrigger: true }),
		once: $$.define.on({ unbindAllBindersOnTrigger: true }),
		off: $$.define.off(), // .off( events [, selector] [, handler] )
		trigger: $$.define.trigger(), // .trigger( events [, extraParams] )

		rtrigger: function(event, extraParams){ // for internal use only
			// notify renderer unless removed
			this.cy().notify({
				type: event,
				collection: this.filter(function(){
					return !this.removed();
				})
			});
			
			this.trigger(event, extraParams);
			return this;
		}
	});

	// aliases for those folks who like old stuff:
	$$.elesfn.bind = $$.elesfn.on;
	$$.elesfn.unbind = $$.elesfn.off;

	// add event aliases like .click()
	$$.define.event.aliasesOn( $$.elesfn );
	
})( cytoscape );

;(function($$){

	$$.fn.eles({
		isNode: function(){
			return this.group() === "nodes";
		},

		isEdge: function(){
			return this.group() === "edges";
		},

		isLoop: function(){
			return this.isEdge() && this.source().id() === this.target().id();
		},

		group: function(){
			var ele = this[0];

			if( ele ){
				return ele._private.group;
			}
		}
	});

	
})( cytoscape );

;(function($$){
	
	// Functions for iterating over collections
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	$$.fn.eles({
		each: function(fn){
			if( $$.is.fn(fn) ){
				for(var i = 0; i < this.length; i++){
					var ele = this[i];
					var ret = fn.apply( ele, [ i, ele ] );

					if( ret === false ){ break; } // exit each early on return false
				}
			}
			return this;
		},

		toArray: function(){
			var array = [];
			
			for(var i = 0; i < this.length; i++){
				array.push( this[i] );
			}
			
			return array;
		},

		slice: function(start, end){
			var array = [];
			var thisSize = this.length;
			
			if( end == null ){
				end = thisSize;
			}
			
			if( start < 0 ){
				start = thisSize + start;
			}
			
			for(var i = start; i >= 0 && i < end && i < thisSize; i++){
				array.push( this[i] );
			}
			
			return new $$.Collection(this.cy(), array);
		},

		size: function(){
			return this.length;
		},

		eq: function(i){
			return this[i];
		},

		empty: function(){
			return this.length === 0;
		},

		nonempty: function(){
			return !this.empty();
		}
	});
	
})( cytoscape );

;(function($$){
	
	// Collection functions that toggle a boolean value
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	
	function defineSwitchFunction(params){
		return function(){
			var args = arguments;
			
			// e.g. cy.nodes().select( data, handler )
			if( args.length === 2 ){
				var data = args[0];
				var handler = args[1];
				this.bind( params.event, data, handler );
			} 
			
			// e.g. cy.nodes().select( handler )
			else if( args.length === 1 ){
				var handler = args[0];
				this.bind( params.event, handler );
			}
			
			// e.g. cy.nodes().select()
			else if( args.length === 0 ){
				for( var i = 0; i < this.length; i++ ){
					var ele = this[i];

					if( !params.ableField || ele._private[params.ableField] ){
						ele._private[params.field] = params.value;
					}
				}
				this.updateStyle(); // change of state => possible change of style
				this.trigger(params.event);
			}

			return this;
		};
	}
	
	function defineSwitchSet( params ){
		$$.elesfn[ params.field ] = function(){
			var ele = this[0];
			if( ele ){
				return ele._private[ params.field ];
			}
		};
		
		$$.elesfn[ params.on ] = defineSwitchFunction({
			event: params.on,
			field: params.field,
			ableField: params.ableField,
			value: true
		});

		$$.elesfn[ params.off ] = defineSwitchFunction({
			event: params.off,
			field: params.field,
			ableField: params.ableField,
			value: false
		});
	}
	
	defineSwitchSet({
		field: "locked",
		on: "lock",
		off: "unlock"
	});
	
	defineSwitchSet({
		field: "grabbable",
		on: "grabify",
		off: "ungrabify"
	});
	
	defineSwitchSet({
		field: "selected",
		ableField: "selectable",
		on: "select",
		off: "unselect"
	});
	
	defineSwitchSet({
		field: "selectable",
		on: "selectify",
		off: "unselectify"
	});
	
	$$.elesfn.grabbed = function(){
		var ele = this[0];
		if( ele ){
			return ele._private.grabbed;
		}
	};
	
})( cytoscape );

;(function($$){
	
	$$.fn.eles({
		nodes: function(selector){
			return this.filter(function(i, element){
				return element.isNode();
			}).filter(selector);
		},

		edges: function(selector){
			return this.filter(function(i, element){
				return element.isEdge();
			}).filter(selector);
		},

		filter: function(filter){
			var cy = this._private.cy;
			
			if( $$.is.fn(filter) ){
				var elements = [];

				for( var i = 0; i < this.length; i++ ){
					var ele = this[i];

					if( filter.apply(ele, [i, ele]) ){
						elements.push(ele);
					}
				}
				
				return new $$.Collection(cy, elements);
			
			} else if( $$.is.string(filter) || $$.is.elementOrCollection(filter) ){
				return new $$.Selector(filter).filter(this);
			
			} else if( filter === undefined ){
				return this;
			}

			return new $$.Collection( cy ); // if not handled by above, give 'em an empty collection
		},

		not: function(toRemove){
			var cy = this._private.cy;

			if( !toRemove ){
				return this;
			} else {
			
				if( $$.is.string( toRemove ) ){
					toRemove = this.filter( toRemove );
				}
				
				var elements = [];
				
				for( var i = 0; i < this.length; i++ ){
					var element = this[i];

					var remove = toRemove._private.ids[ element.id() ];
					if( !remove ){
						elements.push( element );
					}
				}
				
				return new $$.Collection( cy, elements );
			}
			
		},

		intersect: function( other ){
			var self = this;
			var cy = this._private.cy;
			
			// if a selector is specified, then filter by it
			if( $$.is.string(other) ){
				var selector = other;
				return this.filter( selector );
			}
			
			var elements = [];
			var col1 = this;
			var col2 = other;
			var col1Smaller = this.length < other.length;
			var ids1 = col1Smaller ? col1._private.ids : col2._private.ids;
			var ids2 = col1Smaller ? col2._private.ids : col1._private.ids;
			
			for( var id in ids1 ){
				var ele = ids2[ id ];

				if( ele ){
					elements.push( ele );
				}
			}
			
			return new $$.Collection( cy, elements );
		},

		add: function(toAdd){
			var self = this;
			var cy = this._private.cy;		
			
			if( !toAdd ){
				return this;
			}
			
			if( $$.is.string(toAdd) ){
				var selector = toAdd;
				toAdd = cy.elements(selector);
			}
			
			var elements = [];
			var ids = {};
		
			function add(element){
				if( !element ){
					return;
				}
				
				if( !ids[ element.id() ] ){
					elements.push( element );
					ids[ element.id() ] = true;
				}
			}
			
			// add own
			for( var i = 0; i < self.length; i++ ){
				var element = self[i];
				add(element);
			}
			
			// add toAdd
			for( var i = 0; i < toAdd.length; i++ ){
				var element = toAdd[i];
				add(element);
			}
			
			return new $$.Collection(cy, elements);
		}
	});



	// Neighbourhood functions
	//////////////////////////

	$$.fn.eles({
		neighborhood: function(selector){
			var elements = [];
			var cy = this._private.cy;
			var nodes = this.nodes();

			for( var i = 0; i < nodes.length; i++ ){ // for all nodes
				var node = nodes[i];
				var connectedEdges = node.connectedEdges();

				// for each connected edge, add the edge and the other node
				for( var j = 0; j < connectedEdges.length; j++ ){
					var edge = connectedEdges[j];
					var otherNode = edge.connectedNodes().not(node);

					// need check in case of loop
					if( otherNode.length > 0 ){
						elements.push( otherNode[0] ); // add node 1 hop away
					}
					
					// add connected edge
					elements.push( edge[0] );
				}

			}
			
			return ( new $$.Collection( cy, elements ) ).filter( selector );
		},

		closedNeighborhood: function(selector){
			return this.neighborhood().add(this).filter(selector);
		},

		openNeighborhood: function(selector){
			return this.neighborhood(selector);
		}
	});	


	// Edge functions
	/////////////////

	$$.fn.eles({
		source: defineSourceFunction({
			attr: "source"
		}),

		target: defineSourceFunction({
			attr: "target"
		})
	});
	
	function defineSourceFunction( params ){
		return function( selector ){
			var sources = [];
			var edges = this.edges();
			var cy = this._private.cy;

			for( var i = 0; i < edges.length; i++ ){
				var edge = edges[i];
				var id = edge._private.data[params.attr];
				var src = cy.getElementById( id );

				if( src.length > 0 ){
					sources.push( src );
				}
			}
			
			return new $$.Collection( cy, sources ).filter( selector );
		}
	}

	$$.fn.eles({
		edgesWith: defineEdgesWithFunction(),

		edgesTo: defineEdgesWithFunction({
			thisIs: "source"
		})
	});
	
	function defineEdgesWithFunction( params ){
		
		return function(otherNodes){
			var elements = [];
			var cy = this._private.cy;
			var p = params || {};

			// get elements if a selector is specified
			if( $$.is.string(otherNodes) ){
				otherNodes = cy.$( otherNodes );
			}
			
			var edges = otherNodes.connectedEdges();
			var thisIds = this._private.ids;
			
			for( var i = 0; i < edges.length; i++ ){
				var edge = edges[i];
				var foundId;
				var edgeData = edge._private.data;

				if( p.thisIs ){
					var idToFind = edgeData[ p.thisIs ];
					foundId = thisIds[ idToFind ];
				} else {
					foundId = thisIds[ edgeData.source ] || thisIds[ edgeData.target ];
				}
				
				if( foundId ){
					elements.push( edge );
				}
			}
			
			return new $$.Collection( cy, elements );
		};
	}
	
	$$.fn.eles({
		connectedEdges: function( selector ){
			var elements = [];
			var cy = this._private.cy;
			
			var nodes = this.nodes();
			for( var i = 0; i < nodes.length; i++ ){
				var node = nodes[i];
				var edges = node._private.edges;

				for( var j = 0; j < edges.length; j++ ){
					var edge = edges[j];					
					elements.push( edge );
				}
			}
			
			return new $$.Collection( cy, elements ).filter( selector );
		},

		connectedNodes: function( selector ){
			var elements = [];
			var cy = this._private.cy;

			var edges = this.edges();
			for( var i = 0; i < edges.length; i++ ){
				var edge = edges[i];

				elements.push( edge.source()[0] );
				elements.push( edge.target()[0] );
			}

			return new $$.Collection( cy, elements ).filter( selector );
		},

		parallelEdges: defineParallelEdgesFunction(),

		codirectedEdges: defineParallelEdgesFunction({
			codirected: true
		}),

		parallelIndex: function(){
			var edge = this[0];

			if( edge.isEdge() ){
				var src = edge.source()[0];
				var srcEdges = src._private.edges;
				var index = 0;

				for( var i = 0; i < srcEdges.length; i++ ){
					var srcEdge = srcEdges[i];
					var thisIsTheIndex = srcEdge === edge;

					if( thisIsTheIndex ){
						return index;
					}

					var codirected = edge._private.data.source === srcEdge._private.data.source
						&& edge._private.data.target === srcEdge._private.data.target;
					var opdirected = edge._private.data.source === srcEdge._private.data.target
						&& edge._private.data.target === srcEdge._private.data.source;
					var parallel = codirected || opdirected;

					if( parallel ){ // then increase the count
						index++;
					}
				}
			}
		},

		parallelSize: function(){
			var edge = this[0];

			if( edge.isEdge() ){
				var src = edge.source()[0];
				var srcEdges = src._private.edges;
				var numEdges = 0;

				for( var i = 0; i < srcEdges.length; i++ ){
					var srcEdge = srcEdges[i];
					var codirected = edge._private.data.source === srcEdge._private.data.source
						&& edge._private.data.target === srcEdge._private.data.target;
					var opdirected = edge._private.data.source === srcEdge._private.data.target
						&& edge._private.data.target === srcEdge._private.data.source;
					var parallel = codirected || opdirected;

					if( parallel ){ // then increase the count
						numEdges++;
					}
				}

				return numEdges;
			}
		}
	});
	
	function defineParallelEdgesFunction(params){
		var defaults = {
			codirected: false
		};
		params = $$.util.extend({}, defaults, params);
		
		return function( selector ){
			var cy = this._private.cy;
			var elements = [];
			var edges = this.edges();
			var p = params;

			// look at all the edges in the collection
			for( var i = 0; i < edges.length; i++ ){
				var edge1 = edges[i];
				var src1 = edge1.source()[0];
				var srcid1 = src1.id();
				var tgt1 = edge1.target()[0];
				var tgtid1 = tgt1.id();
				var srcEdges1 = src1._private.edges;

				// look at edges connected to the src node of this edge
				for( var j = 0; j < srcEdges1.length; j++ ){
					var edge2 = srcEdges1[j];
					var edge2data = edge2._private.data;
					var tgtid2 = edge2data.target;
					var srcid2 = edge2data.source;

					var codirected = tgtid2 === tgtid1 && srcid2 === srcid1;
					var oppdirected = srcid1 === tgtid2 && tgtid1 === srcid2;
					
					if( (p.codirected && codirected)
					|| (!p.codirected && (codirected || oppdirected)) ){
						elements.push( edge2 );
					}
				}
			}
			
			return new $$.Collection( cy, elements ).filter( selector );
		};
	
	}


	// Compound functions
	/////////////////////

	$$.fn.eles({
		parent: function( selector ){
			var parents = [];
			var cy = this._private.cy;

			for( var i = 0; i < this.length; i++ ){
				var ele = this[i];
				var parent = cy.getElementById( ele._private.data.parent );

				if( parent.size() > 0 ){
					parents.push( parent );
				}
			}
			
			return new $$.Collection( cy, parents ).filter( selector );
		},

		parents: function( selector ){
			var parents = [];

			var eles = this.parent();
			while( eles.nonempty() ){
				for( var i = 0; i < eles.length; i++ ){
					var ele = eles[i];
					parents.push( ele );
				}

				eles = eles.parent();
			}

			return new $$.Collection( this.cy(), parents ).filter( selector );
		},

		children: function( selector ){
			var children = [];

			for( var i = 0; i < this.length; i++ ){
				var ele = this[i];
				children = children.concat( ele._private.children );
			}

			return new $$.Collection( this.cy(), children ).filter( selector );
		},

		siblings: function( selector ){
			return this.parent().children().not( this ).filter( selector );
		},

		descendants: function( selector ){
			var elements = [];

			function add( eles ){
				for( var i = 0; i < eles.length; i++ ){
					var ele = eles[i];

					elements.push( ele );

					if( ele.children().nonempty() ){
						add( ele.children() );
					}
				}
			}

			add( this.children() );

			return new $$.Collection( this.cy(), elements ).filter( selector );
		}
	});

	
})( cytoscape );

;(function($$){
		

	$$.fn.selector = function(map, options){
		for( var name in map ){
			var fn = map[name];
			$$.Selector.prototype[ name ] = fn;
		}
	};

	$$.Selector = function(onlyThisGroup, selector){
		
		if( !(this instanceof $$.Selector) ){
			return new $$.Selector(onlyThisGroup, selector);
		}
	
		if( selector === undefined && onlyThisGroup !== undefined ){
			selector = onlyThisGroup;
			onlyThisGroup = undefined;
		}
		
		var self = this;
		
		self._private = {
			selectorText: null,
			invalid: true
		}
	
		// storage for parsed queries
		// when you add something here, also add to Selector.toString()
		function newQuery(){
			return {
				classes: [], 
				colonSelectors: [],
				data: [],
				group: null,
				ids: [],
				meta: [],

				// fake selectors
				collection: null, // a collection to match against
				filter: null, // filter function

				// these are defined in the upward direction rather than down (e.g. child)
				// because we need to go up in Selector.filter()
				parent: null, // parent query obj
				ancestor: null, // ancestor query obj
				subject: null, // defines subject in compound query (subject query obj; points to self if subject)

				// use these only when subject has been defined
				child: null,
				descendant: null
			};
		}
		
		if( !selector || ( $$.is.string(selector) && selector.match(/^\s*$/) ) ){
			
			if( onlyThisGroup == null ){
				// ignore
				self.length = 0;
			} else {
				self[0] = newQuery();
				self[0].group = onlyThisGroup;
				self.length = 1;
			}
							
		} else if( $$.is.element( selector ) ){
			var collection = new $$.Collection(self.cy(), [ selector ]);
			
			self[0] = newQuery();
			self[0].collection = collection;
			self.length = 1;
			
		} else if( $$.is.collection( selector ) ){
			self[0] = newQuery();
			self[0].collection = selector;
			self.length = 1;
			
		} else if( $$.is.fn( selector ) ) {
			self[0] = newQuery();
			self[0].filter = selector;
			self.length = 1;
			
		} else if( $$.is.string( selector ) ){
		
			// these are the actual tokens in the query language
			var metaChar = "[\\!\\\"\\#\\$\\%\\&\\\'\\(\\)\\*\\+\\,\\.\\/\\:\\;\\<\\=\\>\\?\\@\\[\\]\\^\\`\\{\\|\\}\\~]"; // chars we need to escape in var names, etc
			var variable = "(?:[\\w-]|(?:\\\\"+ metaChar +"))+"; // a variable name
			var comparatorOp = "=|\\!=|>|>=|<|<=|\\$=|\\^=|\\*="; // binary comparison op (used in data selectors)
			var boolOp = "\\?|\\!|\\^"; // boolean (unary) operators (used in data selectors)
			var string = '"(?:\\\\"|[^"])+"' + "|" + "'(?:\\\\'|[^'])+'"; // string literals (used in data selectors) -- doublequotes | singlequotes
			var number = $$.util.regex.number; // number literal (used in data selectors) --- e.g. 0.1234, 1234, 12e123
			var value = string + "|" + number; // a value literal, either a string or number
			var meta = "degree|indegree|outdegree"; // allowed metadata fields (i.e. allowed functions to use from $$.Collection)
			var separator = "\\s*,\\s*"; // queries are separated by commas; e.g. edge[foo = "bar"], node.someClass
			var className = variable; // a class name (follows variable conventions)
			var descendant = "\\s+";
			var child = "\\s+>\\s+";
			var subject = "\\$";
			var id = variable; // an element id (follows variable conventions)
			
			// when a token like a variable has escaped meta characters, we need to clean the backslashes out
			// so that values get compared properly in Selector.filter()
			function cleanMetaChars(str){
				return str.replace(new RegExp("\\\\(" + metaChar + ")", "g"), "\1");
			}
			
			// add @ variants to comparatorOp
			var ops = comparatorOp.split("|");
			for( var i = 0; i < ops.length; i++ ){
				var op = ops[i];
				comparatorOp += "|@" + op;
			}

			// the current subject in the query
			var currentSubject = null;
			
			// NOTE: add new expression syntax here to have it recognised by the parser;
			// a query contains all adjacent (i.e. no separator in between) expressions;
			// the current query is stored in self[i] --- you can use the reference to `this` in the populate function;
			// you need to check the query objects in Selector.filter() for it actually filter properly, but that's pretty straight forward
			var exprs = {
				group: {
					query: true,
					regex: "(node|edge|\\*)",
					populate: function( group ){
						this.group = group == "*" ? group : group + "s";
					}
				},
				
				state: {
					query: true,
					regex: "(:selected|:unselected|:locked|:unlocked|:visible|:hidden|:grabbed|:free|:removed|:inside|:grabbable|:ungrabbable|:animated|:unanimated|:selectable|:unselectable|:parent|:child)",
					populate: function( state ){
						this.colonSelectors.push( state );
					}
				},
				
				id: {
					query: true,
					regex: "\\#("+ id +")",
					populate: function( id ){
						this.ids.push( cleanMetaChars(id) );
					}
				},
				
				className: {
					query: true,
					regex: "\\.("+ className +")",
					populate: function( className ){
						this.classes.push( cleanMetaChars(className) );
					}
				},
				
				dataExists: {
					query: true,
					regex: "\\[\\s*("+ variable +")\\s*\\]",
					populate: function( variable ){
						this.data.push({
							field: cleanMetaChars(variable)
						});
					}
				},
				
				dataCompare: {
					query: true,
					regex: "\\[\\s*("+ variable +")\\s*("+ comparatorOp +")\\s*("+ value +")\\s*\\]",
					populate: function( variable, comparatorOp, value ){
						this.data.push({
							field: cleanMetaChars(variable),
							operator: comparatorOp,
							value: value
						});
					}
				},
				
				dataBool: {
					query: true,
					regex: "\\[\\s*("+ boolOp +")\\s*("+ variable +")\\s*\\]",
					populate: function( boolOp, variable ){
						this.data.push({
							field: cleanMetaChars(variable),
							operator: boolOp
						});
					}
				},
				
				metaCompare: {
					query: true,
					regex: "\\{\\s*("+ meta +")\\s*("+ comparatorOp +")\\s*("+ number +")\\s*\\}",
					populate: function( meta, comparatorOp, number ){
						this.meta.push({
							field: cleanMetaChars(meta),
							operator: comparatorOp,
							value: number
						});
					}
				},

				nextQuery: {
					separator: true,
					regex: separator,
					populate: function(){
						// go on to next query
						self[++i] = newQuery();
						currentSubject = null;
					}
				},

				child: {
					separator: true,
					regex: child,
					populate: function(){
						// this query is the parent of the following query
						var childQuery = newQuery();
						childQuery.parent = this;
						childQuery.subject = currentSubject;

						// we're now populating the child query with expressions that follow
						self[i] = childQuery;
					}
				},

				descendant: {
					separator: true,
					regex: descendant,
					populate: function(){
						// this query is the ancestor of the following query
						var descendantQuery = newQuery();
						descendantQuery.ancestor = this;
						descendantQuery.subject = currentSubject;

						// we're now populating the descendant query with expressions that follow
						self[i] = descendantQuery;
					}
				},

				subject: {
					modifier: true,
					regex: subject,
					populate: function(){
						if( currentSubject != null && this.subject != this ){
							$$.util.error("Redefinition of subject in selector `%s`", selector);
							return false;
						}

						currentSubject = this;
						this.subject = this;
					},

				}
			};

			var j = 0;
			for( var name in exprs ){
				exprs[j] = exprs[name];
				exprs[j].name = name;

				j++;
			}
			exprs.length = j;

			self._private.selectorText = selector;
			var remaining = selector;
			var i = 0;
			
			// of all the expressions, find the first match in the remaining text
			function consumeExpr( expectation ){
				var expr;
				var match;
				var name;
				
				for( var j = 0; j < exprs.length; j++ ){
					var e = exprs[j];
					var n = e.name;

					// ignore this expression if it doesn't meet the expectation function
					if( $$.is.fn( expectation ) && !expectation(n, e) ){ continue }

					var m = remaining.match(new RegExp( "^" + e.regex ));
					
					if( m != null ){
						match = m;
						expr = e;
						name = n;
						
						var consumed = m[0];
						remaining = remaining.substring( consumed.length );								
						
						break; // we've consumed one expr, so we can return now
					}
				}
				
				return {
					expr: expr,
					match: match,
					name: name
				};
			}
			
			// consume all leading whitespace
			function consumeWhitespace(){
				var match = remaining.match(/^\s+/);
				
				if( match ){
					var consumed = match[0];
					remaining = remaining.substring( consumed.length );
				}
			}
			
			self[0] = newQuery(); // get started

			consumeWhitespace(); // get rid of leading whitespace
			for(;;){				
				var check = consumeExpr();
				
				if( check.expr == null ){
					$$.util.error("The selector `%s` is invalid", selector);
					return;
				} else {
					var args = [];
					for(var j = 1; j < check.match.length; j++){
						args.push( check.match[j] );
					}
					
					// let the token populate the selector object (i.e. in self[i])
					var ret = check.expr.populate.apply( self[i], args );

					if( ret === false ){ return } // exit if population failed
				}
				
				// we're done when there's nothing left to parse
				if( remaining.match(/^\s*$/) ){
					break;
				}
			}
			
			self.length = i + 1;

			// adjust references for subject
			for(j = 0; j < self.length; j++){
				var query = self[j];

				if( query.subject != null ){
					// go up the tree until we reach the subject
					for(;;){
						if( query.subject == query ){ break } // done if subject is self

						if( query.parent != null ){ // swap parent/child reference
							var parent = query.parent;
							var child = query;

							child.parent = null;
							parent.child = child;

							query = parent; // go up the tree
						} else if( query.ancestor != null ){ // swap ancestor/descendant
							var ancestor = query.ancestor;
							var descendant = query;

							descendant.ancestor = null;
							ancestor.descendant = descendant;

							query = ancestor; // go up the tree
						} else {
							$.error("When adjusting references for the selector `%s`, neither parent nor ancestor was found");
							break;
						}
					} // for

					self[j] = query.subject; // subject should be the root query
				} // if
			} // for

			// make sure for each query that the subject group matches the implicit group if any
			if( onlyThisGroup != null ){
				for(var j = 0; j < self.length; j++){
					if( self[j].group != null && self[j].group != onlyThisGroup ){
						$.error("Group `%s` conflicts with implicit group `%s` in selector `%s`", self[j].group, onlyThisGroup, selector);
						return;
					}

					self[j].group = onlyThisGroup; // set to implicit group
				}
			}
			
		} else {
			$.error("A selector must be created from a string; found %o", selector);
			return;
		}

		self._private.invalid = false;
		
	};

	$$.selfn = $$.Selector.prototype;
	
	$$.selfn.size = function(){
		return this.length;
	};
	
	$$.selfn.eq = function(i){
		return this[i];
	};
	
	// get elements from the core and then filter them
	$$.selfn.find = function(){
		// TODO impl if we decide to use a DB for storing elements
	};
	
	// filter an existing collection
	$$.selfn.filter = function(collection, addLiveFunction){
		var self = this;
		var cy = collection.cy();
		
		// don't bother trying if it's invalid
		if( self._private.invalid ){
			return new $$.Collection( cy );
		}
		
		var queryMatches = function(query, element){
			// check group
			if( query.group != null && query.group != "*" && query.group != element._private.group ){
				return false;
			}
			
			// check colon selectors
			var allColonSelectorsMatch = true;
			for(var k = 0; k < query.colonSelectors.length; k++){
				var sel = query.colonSelectors[k];
				var renderer = cy.renderer(); // TODO remove reference after refactoring
				
				switch(sel){
				case ":selected":
					allColonSelectorsMatch = element.selected();
					break;
				case ":unselected":
					allColonSelectorsMatch = !element.selected();
					break;
				case ":selectable":
					allColonSelectorsMatch = element.selectable();
					break;
				case ":unselectable":
					allColonSelectorsMatch = !element.selectable();
					break;
				case ":locked":
					allColonSelectorsMatch = element.locked();
					break;
				case ":unlocked":
					allColonSelectorsMatch = !element.locked();
					break;
				case ":visible":
					allColonSelectorsMatch = element.visible();
					break;
				case ":hidden":
					allColonSelectorsMatch = !element.visible();
					break;
				case ":grabbed":
					allColonSelectorsMatch = element.grabbed();
					break;
				case ":free":
					allColonSelectorsMatch = !element.grabbed();
					break;
				case ":removed":
					allColonSelectorsMatch = element.removed();
					break;
				case ":inside":
					allColonSelectorsMatch = !element.removed();
					break;
				case ":grabbable":
					allColonSelectorsMatch = element.grabbable();
					break;
				case ":ungrabbable":
					allColonSelectorsMatch = !element.grabbable();
					break;
				case ":animated":
					allColonSelectorsMatch = element.animated();
					break;
				case ":unanimated":
					allColonSelectorsMatch = !element.animated();
					break;
				case ":parent":
					allColonSelectorsMatch = element.children().nonempty();
					break;
				case ":child":
					allColonSelectorsMatch = element.parent().nonempty();
					break;
				}
				
				if( !allColonSelectorsMatch ) break;
			}
			if( !allColonSelectorsMatch ) return false;
			
			// check id
			var allIdsMatch = true;
			for(var k = 0; k < query.ids.length; k++){
				var id = query.ids[k];
				var actualId = element._private.data.id;
				
				allIdsMatch = allIdsMatch && (id == actualId);
				
				if( !allIdsMatch ) break;
			}
			if( !allIdsMatch ) return false;
			
			// check classes
			var allClassesMatch = true;
			for(var k = 0; k < query.classes.length; k++){
				var cls = query.classes[k];
				
				allClassesMatch = allClassesMatch && element.hasClass(cls);
				
				if( !allClassesMatch ) break;
			}
			if( !allClassesMatch ) return false;
			
			// generic checking for data/metadata
			function operandsMatch(params){
				var allDataMatches = true;
				for(var k = 0; k < query[params.name].length; k++){
					var data = query[params.name][k];
					var operator = data.operator;
					var value = data.value;
					var field = data.field;
					var matches;
					
					if( operator != null && value != null ){
						
						var fieldStr = "" + params.fieldValue(field);
						var valStr = "" + eval(value);
						
						var caseInsensitive = false;
						if( operator.charAt(0) == "@" ){
							fieldStr = fieldStr.toLowerCase();
							valStr = valStr.toLowerCase();
							
							operator = operator.substring(1);
							caseInsensitive = true;
						}
						
						if( operator == "=" ){
							operator = "==";
						}
						
						switch(operator){
						case "*=":
							matches = fieldStr.search(valStr) >= 0;
							break;
						case "$=":
							matches = new RegExp(valStr + "$").exec(fieldStr) != null;
							break;
						case "^=":
							matches = new RegExp("^" + valStr).exec(fieldStr) != null;
							break;
						default:
							// if we're doing a case insensitive comparison, then we're using a STRING comparison
							// even if we're comparing numbers
							if( caseInsensitive ){
								// eval with lower case strings
								var expr = "fieldStr " + operator + " valStr";
								matches = eval(expr);
							} else {
								// just eval as normal
								var expr = params.fieldRef(field) + " " + operator + " " + value;
								matches = eval(expr);
							}
							
						}
					} else if( operator != null ){
						switch(operator){
						case "?":
							matches = params.fieldTruthy(field);
							break;
						case "!":
							matches = !params.fieldTruthy(field);
							break;
						case "^":
							matches = params.fieldUndefined(field);
							break;
						}
					} else { 	
						matches = !params.fieldUndefined(field);
					}
					
					if( !matches ){
						allDataMatches = false;
						break;
					}
				} // for
				
				return allDataMatches;
			} // operandsMatch
			
			// check data matches
			var allDataMatches = operandsMatch({
				name: "data",
				fieldValue: function(field){
					return element._private.data[field];
				},
				fieldRef: function(field){
					return "element._private.data." + field;
				},
				fieldUndefined: function(field){
					return element._private.data[field] === undefined;
				},
				fieldTruthy: function(field){
					if( element._private.data[field] ){
						return true;
					}
					return false;
				}
			});
			
			if( !allDataMatches ){
				return false;
			}
			
			// check metadata matches
			var allMetaMatches = operandsMatch({
				name: "meta",
				fieldValue: function(field){
					return element[field]();
				},
				fieldRef: function(field){
					return "element." + field + "()";
				},
				fieldUndefined: function(field){
					return element[field]() == undefined;
				},
				fieldTruthy: function(field){
					if( element[field]() ){
						return true;
					}
					return false;
				}
			});
			
			if( !allMetaMatches ){
				return false;
			}
			
			// check collection
			if( query.collection != null ){
				var matchesAny = query.collection._private.ids[ element.id() ] != null;
				
				if( !matchesAny ){
					return false;
				}
			}
			
			// check filter function
			if( query.filter != null && element.collection().filter( query.filter ).size() == 0 ){
				return false;
			}
			

			// check parent/child relations
			function confirmRelations( query, elements ){
				if( query != null ){
					var matches = false;
					elements = elements(); // make elements functional so we save cycles if query == null

					// query must match for at least one element (may be recursive)
					for(var i = 0; i < elements.size(); i++){
						if( queryMatches( query, elements.eq(i) ) ){
							matches = true;
							break;
						}
					}

					return matches;
				} else {
					return true;
				}
			}

			if (! confirmRelations(query.parent, function(){
				return element.parent()
			}) ){ return false }

			if (! confirmRelations(query.ancestor, function(){
				return element.parents()
			}) ){ return false }

			if (! confirmRelations(query.child, function(){
				return element.children()
			}) ){ return false }

			if (! confirmRelations(query.descendant, function(){
				return element.descendants()
			}) ){ return false }

			// we've reached the end, so we've matched everything for this query
			return true;
		}; // queryMatches

		var selectorFunction = function(i, element){
			for(var j = 0; j < self.length; j++){
				var query = self[j];
				
				if( queryMatches(query, element) ){
					return true;
				}
			}
			
			return false;
		};
		
		if( self._private.selectorText == null ){
			selectorFunction = function(){ return true; };
		}
		
		var filteredCollection = collection.filter( selectorFunction );
		
		return filteredCollection;
	}; // filter
	
	// ith query to string
	$$.selfn.toString = $$.selfn.selector = function(){
		
		var str = "";
		
		function clean(obj){
			if( $$.is.string(obj) ){
				return obj;
			} 
			return "";
		}
		
		function queryToString(query){
			var str = "";

			var group = clean(query.group);
			str += group.substring(0, group.length - 1);
			
			for(var j = 0; j < query.data.length; j++){
				var data = query.data[j];
				str += "[" + data.field + clean(data.operator) + clean(data.value) + "]"
			}

			for(var j = 0; j < query.meta.length; j++){
				var meta = query.meta[j];
				str += "{" + meta.field + clean(meta.operator) + clean(meta.value) + "}"
			}
			
			for(var j = 0; j < query.colonSelectors.length; j++){
				var sel = query.colonSelectors[i];
				str += sel;
			}
			
			for(var j = 0; j < query.ids.length; j++){
				var sel = "#" + query.ids[i];
				str += sel;
			}
			
			for(var j = 0; j < query.classes.length; j++){
				var sel = "." + query.classes[i];
				str += sel;
			}

			if( query.parent != null ){
				str = queryToString( query.parent ) + " > " + str; 
			}

			if( query.ancestor != null ){
				str = queryToString( query.ancestor ) + " " + str; 
			}

			if( query.child != null ){
				str += " > " + queryToString( query.child ); 
			}

			if( query.descendant != null ){
				str += " " + queryToString( query.descendant ); 
			}

			return str;
		}

		for(var i = 0; i < this.length; i++){
			var query = this[i];
			
			str += queryToString( query );
			
			if( this.length > 1 && i < this.length - 1 ){
				str += ", ";
			}
		}
		
		return str;
	};
	
})( cytoscape );

;(function($$){
		
	function NullRenderer(options){
	}
	
	NullRenderer.prototype.notify = function(params){
	};
	
	$$("renderer", "null", NullRenderer);
	
})( cytoscape );

(function($$) {

	var time = function() { return Date.now(); } ; 
	var arrowShapes = {}; var nodeShapes = {}; 
	var rendFunc = CanvasRenderer.prototype;

	// Canvas layer constants
	var CANVAS_LAYERS = 5, SELECT_BOX = 0, DRAG = 2, NODE = 4, BUFFER_COUNT = 2;
	
	function CanvasRenderer(options) {
		
		this.data = {
				
			select: [0, 0, 0, 0, 0], // Coordinates for selection box, plus enabled flag 
			renderer: this, cy: options.cy, container: options.cy.container(),
			
			canvases: new Array(CANVAS_LAYERS),
			canvasRedrawReason: new Array(CANVAS_LAYERS),
			canvasNeedsRedraw: new Array(CANVAS_LAYERS),
			
			bufferCanvases: new Array(BUFFER_COUNT)
			/*
			canvases: [null, null, null, null, null, 
			    [], [], [], [], [],
			    false, false, false, false, false],
			
			bufferCanvases: [null, null]
			*/
		};
		
		//--Pointer-related data
		this.hoverData = {down: null, last: null, 
				downTime: null, triggerMode: null, 
				dragging: false, 
				initialPan: [null, null], capture: false};
		
		this.timeoutData = {panTimeout: null};
		
		this.dragData = {possibleDragElements: []};
		
		this.touchData = {start: null, capture: false,
				// These 3 fields related to tap, taphold events
				startPosition: [null, null, null, null, null, null],
				singleTouchStartTime: null,
				singleTouchMoved: true,
				
				
				now: [null, null, null, null, null, null], 
				earlier: [null, null, null, null, null, null] };
		//--
		
		//--Wheel-related data
		this.zoomData = {freeToZoom: false, lastPointerX: null};
		//--
		
		this.redraws = 0;
		
		this.init();
		
		for (var i = 0; i < CANVAS_LAYERS; i++) {
			this.data.canvases[i] = document.createElement("canvas");
			this.data.canvases[i].style.position = "absolute";
			this.data.canvases[i].id = "layer" + i;
			this.data.canvases[i].style.zIndex = String(-i);
			this.data.canvases[i].style.visibility = "hidden"; 
			this.data.container.appendChild(this.data.canvases[i]);
			
			this.data.canvasRedrawReason[i] = new Array();
			this.data.canvasNeedsRedraw[i] = false;
		}
		
		for (var i = 0; i < BUFFER_COUNT; i++) {
			this.data.bufferCanvases[i] = document.createElement("canvas");
			this.data.bufferCanvases[i].style.position = "absolute";
			this.data.bufferCanvases[i].id = "buffer" + i;
			this.data.bufferCanvases[i].style.zIndex = String(-i);
			this.data.bufferCanvases[i].style.visibility = "visible";
			this.data.container.appendChild(this.data.bufferCanvases[i]);
		}
	}

	CanvasRenderer.prototype.notify = function(params) {
		if (params.type == "add"
			|| params.type == "remove") {
			
			this.updateNodesCache();
			this.updateEdgesCache();
		}
		
		if (params.type == "load") { this.load(); }

		if (params.type == "viewport") {
			this.data.canvasNeedsRedraw[SELECT_BOX] = true;
			this.data.canvasRedrawReason[SELECT_BOX].push("viewchange");
			this.data.canvasNeedsRedraw[DRAG] = true;
			this.data.canvasRedrawReason[DRAG].push("viewchange");
			this.data.canvasNeedsRedraw[NODE] = true;
			this.data.canvasRedrawReason[NODE].push("viewchange");
		}
		
		this.data.canvasNeedsRedraw[DRAG] = true; this.data.canvasRedrawReason[DRAG].push("notify");
		this.data.canvasNeedsRedraw[NODE] = true; this.data.canvasRedrawReason[NODE].push("notify");

		this.redraws++;
		this.redraw();
	};
	
	// @O Initialization functions
	{
	CanvasRenderer.prototype.load = function() {
		var r = this;

		// Primary key
		r.data.container.addEventListener("mousedown", function(e) {
		
			r.hoverData.capture = true;
			
			var cy = r.data.cy; var pos = r.projectIntoViewport(e.pageX, e.pageY);
			var select = r.data.select;
			
			var near = r.findNearestElement(pos[0], pos[1]);
			var down = r.hoverData.down;
			var draggedElements = r.dragData.possibleDragElements;

			// Primary button
			if (e.button == 0) {
				
				// Element dragging
				{
					if (near && near._private.grabbable) {
						if (near._private.group == "nodes" && near._private.selected == false) {
							near._private.grabbed = true; near.trigger(new $$.Event(e, {type: "grab"})); 
							
							var unselectEvent = new $$.Event(e, {type: "unselect"});
							var ungrabEvent = new $$.Event(e, {type: "free"});
							
							for (var i=0;i<draggedElements.length;i++) {
								var popped = draggedElements[i];
								
								var updateStyle = false; 
								if (popped._private.selected || popped._private.grabbed) { updateStyle = true; }
								
								if (popped._private.selected) { popped._private.selected = false; popped.trigger(unselectEvent); }
								if (popped._private.grabbed) { popped._private.grabbed = false; popped.trigger(ungrabEvent); }
								
								if (updateStyle) { popped.updateStyle(false); };
							}
							
							r.dragData.possibleDragElements = draggedElements = []; draggedElements.push(near);
								for (var i=0;i<near._private.edges.length;i++) { near._private.edges[i]._private.grabbed = true; };
						}
								
						if (near._private.group == "nodes" && near._private.selected == true) {
							
							var event = new $$.Event(e, {type: "grab"}); 
							for (var i=0;i<draggedElements.length;i++) {
								if (draggedElements[i]._private.group == "nodes") {
									draggedElements[i]._private.grabbed = true;
									var subEdges = draggedElements[i]._private.edges;
									
									for (var j=0;j<subEdges.length;j++) {
										subEdges[j]._private.grabbed = true;
									}
									
									draggedElements[i].trigger(event)
								}
							}
						}
								
						r.data.canvasNeedsRedraw[DRAG] = true; r.data.canvasRedrawReason[DRAG].push("Single node moved to drag layer"); 
						r.data.canvasNeedsRedraw[NODE] = true; r.data.canvasRedrawReason[NODE].push("Single node moved to drag layer");
						
//						console.log(draggedElements);
					}
					
					if (near) { near.trigger(new $$.Event(e, {type: "mousedown"})); }
					
					r.hoverData.down = near;
					r.hoverData.downTime = (new Date()).getTime();
				}
			
				// Selection box
				if (near == null) { select[4] = 1; }
			
			// Middle/auxilliary button
			} else if (e.button == 1) {
				
				// Drag pan
				r.hoverData.dragging = true;
				r.hoverData.initialPan = [cy.pan().x, cy.pan().y];
				
			}
			
			select[0] = select[2] = pos[0]; select[1] = select[3] = pos[1];
			
			r.redraw();
			
		}, false);
		
		window.addEventListener("mousemove", function(e) {
			
			var cy = r.data.cy; var pos = r.projectIntoViewport(e.pageX, e.pageY); var select = r.data.select;
			
			var near = r.findNearestElement(pos[0], pos[1]); var last = r.hoverData.last; var down = r.hoverData.down;
			var disp = [pos[0] - select[2], pos[1] - select[3]]; var nodes = r.getCachedNodes(); var edges = r.getCachedEdges();
		
			var draggedElements = r.dragData.possibleDragElements;
			
			var capture = r.hoverData.capture; if (!capture) { 
				
				var containerPageCoords = r.findContainerPageCoords();
				
				if (e.pageX > containerPageCoords[0] && e.pageX < containerPageCoords[0] + r.data.container.clientWidth
					&& e.pageY > containerPageCoords[1] && e.pageY < containerPageCoords[1] + r.data.container.clientHeight) {
					
				} else {
					return;
				}
			}
			
			if (r.hoverData.dragging) {
				
				// console.log(pos[0], select[0], r.hoverData.initialPan[0], pos[1], select[1], r.hoverData.initialPan[1]);
				
				cy.panBy({x: disp[0] * cy.zoom(), y: disp[1] * cy.zoom()});
				
				// Needs reproject due to pan changing viewport
				pos = r.projectIntoViewport(e.pageX, e.pageY);
			
			// Mousemove event
			{
				var event = new $$.Event(e, {type: "mousemove"});
				
				if (near != null) {
					near.trigger(event);
				} else if (near == null) {
					cy.trigger(event);
				}
			}
			
			// Checks primary button down & out of time & mouse not moved much
			} else if (select[4] == 1 && down == null 
					&& (new Date()).getTime() - r.hoverData.downTime > 200 
					&& (Math.abs(select[3] - select[1]) + Math.abs(select[2] - select[0]) < 4)) {
				
				r.hoverData.dragging = true;
				select[4] = 0;
				
			} else {
				if (near != last) {
					
					if (last) { last.trigger(new $$.Event(e, {type: "mouseout"})); }
					if (near) { near.trigger(new $$.Event(e, {type: "mouseover"})); }
					
					r.hoverData.last = near;
				}
				
				if (down) {
					var drag = new $$.Event(e, {type: "position"});
				
					for (var i=0;i<draggedElements.length;i++) {
					
						// Locked nodes not draggable
						if (!draggedElements[i]._private.locked 
							&& draggedElements[i]._private.group == "nodes") {
							
							draggedElements[i]._private.position.x += disp[0];
							draggedElements[i]._private.position.y += disp[1];
							draggedElements[i].trigger(drag);
						}
					}
					
					r.data.canvasNeedsRedraw[DRAG] = true; r.data.canvasRedrawReason[DRAG].push("Nodes dragged");
				}
				
				if (near) {
					near.trigger(new $$.Event(e, {type: "mousemove"}));
				}
				
				r.data.canvasNeedsRedraw[SELECT_BOX] = true; r.data.canvasRedrawReason[SELECT_BOX].push("Mouse moved, redraw selection box");
			}
			
			select[2] = pos[0]; select[3] = pos[1];
			
			r.redraw();
			
		}, false);
		
		window.addEventListener("mouseup", function(e) {
			
			var capture = r.hoverData.capture; if (!capture) { return; }; r.hoverData.capture = false;
		
			var cy = r.data.cy; var pos = r.projectIntoViewport(e.pageX, e.pageY); var select = r.data.select;
			var near = r.findNearestElement(pos[0], pos[1]);
			var nodes = r.getCachedNodes(); var edges = r.getCachedEdges(); 
			var draggedElements = r.dragData.possibleDragElements; var down = r.hoverData.down;
			
			if (near == null || near != down || !near.selected()) {

//++clock+unselect
//				var a = time();
				
				var unselectEvent = new $$.Event(e, {type: "unselect"}); 
				for (var i=0;i<draggedElements.length;i++) {
					if (draggedElements[i]._private.selected) {
						draggedElements[i]._private.selected = false;
						draggedElements[i].trigger(unselectEvent);
						draggedElements[i].updateStyle(false);
					}
				}
				
//++clock+unselect
//				console.log("unselect", time() - a);
				
				if (draggedElements.length > 0) {
					r.data.canvasNeedsRedraw[NODE] = true; r.data.canvasRedrawReason[NODE].push("De-select");
				}
				
				draggedElements = r.dragData.possibleDragElements = [];
			}
			
			// Click event
			{
				if (Math.pow(select[2] - select[0], 2) + Math.pow(select[3] - select[1], 2) == 0) {
					var clickEvent = new $$.Event(e, {type: "click"});
					
					if (near != null) {
						near.trigger(clickEvent);
					} else if (near == null) {
						cy.trigger(clickEvent);
					}
				}
			}
			
			// Mouseup event
			{
				var upEvent = new $$.Event(e, {type: "mouseup"});
				
				if (near != null) {
					near.trigger(upEvent);
				} else if (near == null) {
					cy.trigger(upEvent);
				}
			}
			
			// Single selection
			if (near == down && (Math.pow(select[2] - select[0], 2) + Math.pow(select[3] - select[1], 2) < 7)) {
				if (near != null && near._private.selectable && near._private.selected == false) {
					near._private.selected = true; near.trigger(new $$.Event(e, {type: "select"})); near.updateStyle(false);
					draggedElements.push(near);
					
					r.data.canvasNeedsRedraw[NODE] = true; r.data.canvasRedrawReason[NODE].push("sglslct");
					
				}
			// Ungrab single drag
			} else if (near == down) {
				if (near != null && near._private.grabbed) {
					var freeEvent = new $$.Event(e, {type: "free"});
					
					near._private.grabbed = false; near.trigger(freeEvent);
					
					var sEdges = near._private.edges; for (var j=0;j<sEdges.length;j++) { sEdges[j]._private.grabbed = false; } 		
				}
			}
			
			if (Math.pow(select[2] - select[0], 2) + Math.pow(select[3] - select[1], 2) > 7 && select[4]) {
//				console.log("selecting");
				
				var box = r.getAllInBox(select[0], select[1], select[2], select[3]);
				// console.log(box);
				var event = new $$.Event(e, {type: "select"});
				for (var i=0;i<box.length;i++) { 
					if (box[i]._private.selectable) {
						box[i]._private.selected = true; box[i].trigger(event); box[i].updateStyle(false); draggedElements.push(box[i]); 
					}
				}
				
				if (box.length > 0) { 
					r.data.canvasNeedsRedraw[NODE] = true; r.data.canvasRedrawReason[NODE].push("Selection");
				}
			}
			
			// Cancel drag pan
			r.hoverData.dragging = false;
			
			if (!select[4]) {
				var freeEvent = new $$.Event(e, {type: "free"}); 
				
				for (var i=0;i<draggedElements.length;i++) {
					
					draggedElements[i]._private.grabbed = false; 
					if (draggedElements[i]._private.group == "nodes") { 
						var sEdges = draggedElements[i]._private.edges;
						
						for (var j=0;j<sEdges.length;j++) { sEdges[j]._private.grabbed = false; } 
					}
					
					draggedElements[i].trigger(freeEvent);
				}
//				draggedElements = r.dragData.possibleDragElements = [];
				r.data.canvasNeedsRedraw[DRAG] = true; r.data.canvasRedrawReason[DRAG].push("Node/nodes back from drag");
				r.data.canvasNeedsRedraw[NODE] = true; r.data.canvasRedrawReason[NODE].push("Node/nodes back from drag");
			}
			
			select[4] = 0; r.hoverData.down = null;
			
			r.data.canvasNeedsRedraw[SELECT_BOX] = true; r.data.canvasRedrawReason[SELECT_BOX].push("Mouse up, selection box gone");
			
//			console.log("mu", pos[0], pos[1]);
//			console.log("ss", select);
			
			r.redraw();
			
		}, false);
		
		var wheelHandler = function(e) {
			
			var cy = r.data.cy; var pos = r.projectIntoViewport(e.pageX, e.pageY);
			
			var unpos = [pos[0] * cy.zoom() + cy.pan().x,
			              pos[1] * cy.zoom() + cy.pan().y];
			
//			console.log("update");
			
			if (r.zoomData.freeToZoom) {
				e.preventDefault();
				
				var diff = e.wheelDeltaY / 1000 || e.detail / -8.4;
				
//				console.log({level: cy.zoom() * (1 + diff), position: {x: unpos[0], y: unpos[1]}});
				cy.zoom({level: cy.zoom() * (1 + diff), position: {x: unpos[0], y: unpos[1]}});
//				console.log("new zoom" + cy.zoom());
			}

		}
		
		// Uses old functions
		// --
		r.data.container.addEventListener("mousewheel", wheelHandler, false);
		r.data.container.addEventListener("DOMMouseScroll", wheelHandler, false);
		r.data.container.addEventListener("mousemove", function(e) { 
			if (r.zoomData.lastPointerX && r.zoomData.lastPointerX != e.pageX && !r.zoomData.freeToZoom) 
				{ r.zoomData.freeToZoom = true; } r.zoomData.lastPointerX = e.pageX; }, false);
		r.data.container.addEventListener("mouseout", function(e) { 
			r.zoomData.freeToZoom = false; r.zoomData.lastPointerX = null }, false);
		// --
		
		
		r.data.container.addEventListener("touchstart", function(e) {
			e.preventDefault();
		
			r.touchData.capture = true;
		
			var cy = r.data.cy; 
			var nodes = r.getCachedNodes(); var edges = r.getCachedEdges();
			var now = r.touchData.now; var earlier = r.touchData.earlier;
			
			if (e.touches[0]) { var pos = r.projectIntoViewport(e.touches[0].pageX, e.touches[0].pageY); now[0] = pos[0]; now[1] = pos[1]; }
			if (e.touches[1]) { var pos = r.projectIntoViewport(e.touches[1].pageX, e.touches[1].pageY); now[2] = pos[0]; now[3] = pos[1]; }
			if (e.touches[2]) { var pos = r.projectIntoViewport(e.touches[2].pageX, e.touches[2].pageY); now[4] = pos[0]; now[5] = pos[1]; }
			
			if (e.touches[2]) {
			
			} else if (e.touches[1]) {
				
			} else if (e.touches[0]) {
				var near = r.findNearestElement(now[0], now[1]);
				
				if (near != null) {
					r.touchData.start = near;
					
					if (near._private.group == "nodes") {
						
						near._private.grabbed = true; near.trigger(new $$.Event(e, {type: "grab"}));
						r.data.canvasNeedsRedraw[DRAG] = true; r.data.canvasRedrawReason[DRAG].push("touchdrag node start");
						r.data.canvasNeedsRedraw[NODE] = true; r.data.canvasRedrawReason[NODE].push("touchdrag node start");
						
						var sEdges = near._private.edges;
						for (var j=0;j<sEdges.length;j++) { sEdges[j]._private.grabbed = true; }
					}
					
					near.trigger(new $$.Event(e, {type: "touchstart"}));
				} else if (near == null) {
					cy.trigger(new $$.Event(e, {type: "touchstart"}));
				}
				
				
				// Tap, taphold
				// -----
				
				for (var i=0;i<now.length;i++) {
					earlier[i] = now[i];
					r.touchData.startPosition[i] = now[i];
				};
				
				r.touchData.singleTouchMoved = false;
				r.touchData.singleTouchStartTime = time();
				
				var tapHoldTimeout = setTimeout(function() {
					if (r.touchData.singleTouchMoved == false
							// This time double constraint prevents multiple quick taps
							// followed by a taphold triggering multiple taphold events
							&& time() - r.touchData.singleTouchStartTime < 1040
							&& time() - r.touchData.singleTouchStartTime > 960) {
						if (r.touchData.start) {
							r.touchData.start.trigger(new $$.Event(e, {type: "taphold"}));
						} else {
							r.data.cy.trigger(new $$.Event(e, {type: "taphold"}));
						}

//						console.log("taphold");
					}
				}, 1000);
			}
			
			r.redraw();
			
		}, true);
		
		window.addEventListener("touchmove", function(e) {
		
			var capture = r.touchData.capture; if (!capture) { return; }; 
			e.preventDefault();
		
			var cy = r.data.cy; 
			var nodes = r.getCachedNodes(); var edges = r.getCachedEdges();
			var now = r.touchData.now; var earlier = r.touchData.earlier;
			
			if (e.touches[0]) { var pos = r.projectIntoViewport(e.touches[0].pageX, e.touches[0].pageY); now[0] = pos[0]; now[1] = pos[1]; }
			if (e.touches[1]) { var pos = r.projectIntoViewport(e.touches[1].pageX, e.touches[1].pageY); now[2] = pos[0]; now[3] = pos[1]; }
			if (e.touches[2]) { var pos = r.projectIntoViewport(e.touches[2].pageX, e.touches[2].pageY); now[4] = pos[0]; now[5] = pos[1]; }
			var disp = []; for (var j=0;j<now.length;j++) { disp[j] = now[j] - earlier[j]; }
			
			if (e.touches[2]) {
			
			} else if (e.touches[1]) {
				var avgDsp = [(disp[0] + disp[2]) / 2, (disp[1] + disp[3]) / 2]
				
				cy.panBy({x: avgDsp[0] * cy.zoom(), y: avgDsp[1] * cy.zoom()});
				
				
				var earlierDist = Math.sqrt(Math.pow(earlier[2] - earlier[0], 2) + Math.pow(earlier[3] - earlier[1], 2));
				var nowDist = Math.sqrt(Math.pow(now[2] - now[0], 2) + Math.pow(now[3] - now[1], 2));
				
				var factor = nowDist / earlierDist;
				
				if (factor > 1) {
					factor = (factor - 1) * 1.5 + 1;
				} else {
					factor = 1 - (1 - factor) * 1.5;
				}
				
				cy.zoom({level: cy.zoom() * factor,
					position: {x: (now[0] + now[2]) / 2,
								y: (now[1] + now[3]) / 2}});
				
				// Re-project
				if (e.touches[0]) { var pos = r.projectIntoViewport(e.touches[0].pageX, e.touches[0].pageY); now[0] = pos[0]; now[1] = pos[1]; }
				if (e.touches[1]) { var pos = r.projectIntoViewport(e.touches[1].pageX, e.touches[1].pageY); now[2] = pos[0]; now[3] = pos[1]; }
				if (e.touches[2]) { var pos = r.projectIntoViewport(e.touches[2].pageX, e.touches[2].pageY); now[4] = pos[0]; now[5] = pos[1]; }
				
			} else if (e.touches[0]) {
				var start = r.touchData.start;
				
				if (start != null && start._private.group == "nodes") {
					start._private.position.x += disp[0]; start._private.position.y += disp[1];
					
					r.data.canvasNeedsRedraw[DRAG] = true; r.data.canvasRedrawReason[DRAG].push("touchdrag node");
//					r.data.canvasNeedsRedraw[NODE] = true; r.data.canvasRedrawReason[NODE].push("touchdrag node");
					
					start.trigger(new $$.Event(e, {type: "position"}));
				}
				
				// Touchmove event
				{
					if (start != null) { start.trigger(new $$.Event(e, {type: "touchmove"})); }
					
					if (start == null) { 
						var near = r.findNearestElement(now[0], now[1]);
						if (near != null) { near.trigger(new $$.Event(e, {type: "touchmove"})); }
						if (near == null) {   cy.trigger(new $$.Event(e, {type: "touchmove"})); }
					}
				}
				
				// Check to cancel taphold
				for (var i=0;i<now.length;i++) {
					if (now[i] 
						&& r.touchData.startPosition[i]
						&& Math.abs(now[i] - r.touchData.startPosition[i]) > 4) {
						
						r.touchData.singleTouchMoved = true;
					}
				}
				
				if (start == null) {
					cy.panBy({x: disp[0] * cy.zoom(), y: disp[1] * cy.zoom()});
					
					// Re-project
					var pos = r.projectIntoViewport(e.touches[0].pageX, e.touches[0].pageY);
					now[0] = pos[0]; now[1] = pos[1];
				}
			}
			
			for (var j=0;j<now.length;j++) { earlier[j] = now[j]; };
			r.redraw();
			
		}, true);
		
		window.addEventListener("touchend", function(e) {
			
			var capture = r.touchData.capture; if (!capture) { return; }; r.touchData.capture = false;
			e.preventDefault();
			
			var cy = r.data.cy; 
			var nodes = r.getCachedNodes(); var edges = r.getCachedEdges();
			var now = r.touchData.now; var earlier = r.touchData.earlier;
			
			if (e.touches[0]) { var pos = r.projectIntoViewport(e.touches[0].pageX, e.touches[0].pageY); now[0] = pos[0]; now[1] = pos[1]; }
			if (e.touches[1]) { var pos = r.projectIntoViewport(e.touches[1].pageX, e.touches[1].pageY); now[2] = pos[0]; now[3] = pos[1]; }
			if (e.touches[2]) { var pos = r.projectIntoViewport(e.touches[2].pageX, e.touches[2].pageY); now[4] = pos[0]; now[5] = pos[1]; }
			
			if (e.touches[2]) {
			
			} else if (e.touches[1]) {
				
			} else if (e.touches[0]) {
			
			// Last touch released
			} else if (!e.touches[0]) {
			
				var start = r.touchData.start;
				
				if (start != null ) {
					if (start._private.grabbed == true) {
						start._private.grabbed = false; start.trigger(new $$.Event(e, {type: "free"}));
					}
					
					var sEdges = start._private.edges;
					for (var j=0;j<sEdges.length;j++) { sEdges[j]._private.grabbed = false; }
					
					r.data.canvasNeedsRedraw[DRAG] = true; r.data.canvasRedrawReason[DRAG].push("touchdrag node end");
					r.data.canvasNeedsRedraw[NODE] = true; r.data.canvasRedrawReason[NODE].push("touchdrag node end");
					
					start.trigger(new $$.Event(e, {type: "touchend"}));
					
					r.touchData.start = null;
					
				} else {
					var near = r.findNearestElement(now[0], now[1]);
				
					if (near != null) { near.trigger(new $$.Event(e, {type: "touchend"})); }
					if (near == null) { cy.trigger(new $$.Event(e, {type: "touchend"})); }
				}
				
				// Tap event, roughly same as mouse click event for touch
				if (r.touchData.singleTouchMoved == false) {
					
					if (start) {
						start.trigger(new $$.Event(e, {type: "tap"}));
					} else {
						cy.trigger(new $$.Event(e, {type: "tap"}));
					}
					
//					console.log("tap");
				}
				
				r.touchData.singleTouchMoved = true;
			}
			
			for (var j=0;j<now.length;j++) { earlier[j] = now[j]; };
			r.redraw();
			
		}, true);
	};
	
	CanvasRenderer.prototype.init = function() { };
	}
	
	// @O Caching functions
	{
	CanvasRenderer.prototype.getCachedNodes = function() {
		var data = this.data; var cy = this.data.cy;
		
		if (data.cache == undefined) {
			data.cache = {};
		}
		
		if (data.cache.cachedNodes == undefined) {
			data.cache.cachedNodes = cy.nodes();
		}
		
		return data.cache.cachedNodes;
	}
	
	CanvasRenderer.prototype.updateNodesCache = function() {
		var data = this.data; var cy = this.data.cy;
		
		if (data.cache == undefined) {
			data.cache = {};
		}
		
		data.cache.cachedNodes = cy.nodes();
	}
	
	CanvasRenderer.prototype.getCachedEdges = function() {
		var data = this.data; var cy = this.data.cy;
		
		if (data.cache == undefined) {
			data.cache = {};
		}
		
		if (data.cache.cachedEdges == undefined) {
			data.cache.cachedEdges = cy.edges();
		}
		
		return data.cache.cachedEdges;
	}
	
	CanvasRenderer.prototype.updateEdgesCache = function() {
		var data = this.data; var cy = this.data.cy;
		
		if (data.cache == undefined) {
			data.cache = {};
		}
		
		data.cache.cachedEdges = cy.edges();
	}
	}
	
	// @O High-level collision application functions

	// Project mouse
	CanvasRenderer.prototype.projectIntoViewport = function(pageX, pageY) {
		
		var x, y; var offsetLeft = 0; var offsetTop = 0; var n; n = this.data.container;
		
		// Stop checking scroll past the level of the DOM tree containing document.body. At this point, scroll values do not have the same impact on pageX/pageY.
		var stopCheckingScroll = false;
		
		while (n != null) {
			if (typeof(n.offsetLeft) == "number") {
				// The idea is to add offsetLeft/offsetTop, subtract scrollLeft/scrollTop, ignoring scroll values for elements in DOM tree levels 2 and higher.
				offsetLeft += n.offsetLeft; offsetTop += n.offsetTop;
				
				if (n == document.body || n == document.header) { stopCheckingScroll = true; }
				if (!stopCheckingScroll) { offsetLeft -= n.scrollLeft; offsetTop -= n.scrollTop; }
				
			} n = n.parentNode;
		}
		
		// By here, offsetLeft and offsetTop represent the "pageX/pageY" of the top-left corner of the div. So, do subtraction to find relative position.
		x = pageX - offsetLeft; y = pageY - offsetTop;
		
		x -= this.data.cy.pan().x; y -= this.data.cy.pan().y; x /= this.data.cy.zoom(); y /= this.data.cy.zoom();
		return [x, y];
	}
	
	CanvasRenderer.prototype.findContainerPageCoords = function() {
		var x, y; var offsetLeft = 0; var offsetTop = 0; var n; n = this.data.container;
		
		// Stop checking scroll past the level of the DOM tree containing document.body. At this point, scroll values do not have the same impact on pageX/pageY.
		var stopCheckingScroll = false;
		
		while (n != null) {
			if (typeof(n.offsetLeft) == "number") {
				// The idea is to add offsetLeft/offsetTop, subtract scrollLeft/scrollTop, ignoring scroll values for elements in DOM tree levels 2 and higher.
				offsetLeft += n.offsetLeft; offsetTop += n.offsetTop;
				
				if (n == document.body || n == document.header) { stopCheckingScroll = true; }
				if (!stopCheckingScroll) { offsetLeft -= n.scrollLeft; offsetTop -= n.scrollTop; }
				
			} n = n.parentNode;
		}
		
		// By here, offsetLeft and offsetTop represent the "pageX/pageY" of the top-left corner of the div.
		return [offsetLeft, offsetTop];
	}
	
	// Find nearest element
	CanvasRenderer.prototype.findNearestElement = function(x, y) {
		var data = this.data; var nodes = this.getCachedNodes(); var edges = this.getCachedEdges(); var near = [];
		
		// Check nodes
		for (var i = 0; i < nodes.length; i++) {
			if (nodeShapes[nodes[i]._private.style["shape"].value].checkPointRough(x, y,
					nodes[i]._private.style["border-width"].value,
					nodes[i]._private.style["width"].value, nodes[i]._private.style["height"].value,
					nodes[i]._private.position.x, nodes[i]._private.position.y)
				&&
				nodeShapes[nodes[i]._private.style["shape"].value].checkPoint(x, y,
					nodes[i]._private.style["border-width"].value,
					nodes[i]._private.style["width"].value / 2, nodes[i]._private.style["height"].value / 2,
					nodes[i]._private.position.x, nodes[i]._private.position.y)) {
				
				near.push(nodes[i]);
			}
		}
		
		// Check edges
		for (var i = 0; i < edges.length; i++) {
			if (edges[i]._private.rscratch.isSelfEdge) {
				if ((this.inBezierVicinity(x, y,
						edges[i]._private.rscratch.startX,
						edges[i]._private.rscratch.startY,
						edges[i]._private.rscratch.cp2ax,
						edges[i]._private.rscratch.cp2ay,
						edges[i]._private.rscratch.selfEdgeMidX,
						edges[i]._private.rscratch.selfEdgeMidY,
						Math.pow(edges[i]._private.style["width"].value / 2, 2))
							&&
					(Math.pow(edges[i]._private.style["width"].value / 2, 2) > 
						this.sqDistanceToQuadraticBezier(x, y,
							edges[i]._private.rscratch.startX,
							edges[i]._private.rscratch.startY,
							edges[i]._private.rscratch.cp2ax,
							edges[i]._private.rscratch.cp2ay,
							edges[i]._private.rscratch.selfEdgeMidX,
							edges[i]._private.rscratch.selfEdgeMidY)))
					||
					(this.inBezierVicinity(x, y,
						edges[i]._private.rscratch.selfEdgeMidX,
						edges[i]._private.rscratch.selfEdgeMidY,
						edges[i]._private.rscratch.cp2cx,
						edges[i]._private.rscratch.cp2cy,
						edges[i]._private.rscratch.endX,
						edges[i]._private.rscratch.endY,
						Math.pow(edges[i]._private.style["width"].value / 2, 2))
							&&
					(Math.pow(edges[i]._private.style["width"].value / 2, 2) > 
						this.sqDistanceToQuadraticBezier(x, y,
							edges[i]._private.rscratch.selfEdgeMidX,
							edges[i]._private.rscratch.selfEdgeMidY,
							edges[i]._private.rscratch.cp2cx,
							edges[i]._private.rscratch.cp2cy,
							edges[i]._private.rscratch.endX,
							edges[i]._private.rscratch.endY))))
					 { near.push(edges[i]); }
			} else if (edges[i]._private.rscratch.isStraightEdge) {
				if (Math.pow(edges[i]._private.style["width"].value / 2, 2) >
					this.sqDistanceToFiniteLine(x, y,
						edges[i]._private.rscratch.startX,
						edges[i]._private.rscratch.startY,
						edges[i]._private.rscratch.endX,
						edges[i]._private.rscratch.endY))
					{ near.push(edges[i]); }
			} else if (edges[i]._private.rscratch.isBezierEdge) {
				if (this.inBezierVicinity(x, y,
					edges[i]._private.rscratch.startX,
					edges[i]._private.rscratch.startY,
					edges[i]._private.rscratch.cp2x,
					edges[i]._private.rscratch.cp2y,
					edges[i]._private.rscratch.endX,
					edges[i]._private.rscratch.endY,
					Math.pow(edges[i]._private.style["width"].value / 2, 2))
						&&
					(Math.pow(edges[i]._private.style["width"].value / 2, 2) >
						this.sqDistanceToQuadraticBezier(x, y,
							edges[i]._private.rscratch.startX,
							edges[i]._private.rscratch.startY,
							edges[i]._private.rscratch.cp2x,
							edges[i]._private.rscratch.cp2y,
							edges[i]._private.rscratch.endX,
							edges[i]._private.rscratch.endY)))
					{ near.push(edges[i]); }
			}
			
			if (!near.length || near[near.length - 1] != edges[i]) {
				if ((arrowShapes[edges[i]._private.style["source-arrow-shape"].value].roughCollide(x, y,
						edges[i]._private.rscratch.arrowStartX, edges[i]._private.rscratch.arrowStartY,
						this.getArrowWidth(edges[i]._private.style["width"].value),
						this.getArrowHeight(edges[i]._private.style["width"].value),
						[edges[i]._private.rscratch.arrowStartX - edges[i].source()[0]._private.position.x,
							edges[i]._private.rscratch.arrowStartY - edges[i].source()[0]._private.position.y], 0)
						&&
					arrowShapes[edges[i]._private.style["source-arrow-shape"].value].collide(x, y,
						edges[i]._private.rscratch.arrowStartX, edges[i]._private.rscratch.arrowStartY,
						this.getArrowWidth(edges[i]._private.style["width"].value),
						this.getArrowHeight(edges[i]._private.style["width"].value),
						[edges[i]._private.rscratch.arrowStartX - edges[i].source()[0]._private.position.x,
							edges[i]._private.rscratch.arrowStartY - edges[i].source()[0]._private.position.y], 0))
					||
					(arrowShapes[edges[i]._private.style["target-arrow-shape"].value].roughCollide(x, y,
						edges[i]._private.rscratch.arrowEndX, edges[i]._private.rscratch.arrowEndY,
						this.getArrowWidth(edges[i]._private.style["width"].value),
						this.getArrowHeight(edges[i]._private.style["width"].value),
						[edges[i]._private.rscratch.arrowEndX - edges[i].target()[0]._private.position.x,
							edges[i]._private.rscratch.arrowEndY - edges[i].target()[0]._private.position.y], 0)
						&&
					arrowShapes[edges[i]._private.style["target-arrow-shape"].value].collide(x, y,
						edges[i]._private.rscratch.arrowEndX, edges[i]._private.rscratch.arrowEndY,
						this.getArrowWidth(edges[i]._private.style["width"].value),
						this.getArrowHeight(edges[i]._private.style["width"].value),
						[edges[i]._private.rscratch.arrowEndX - edges[i].target()[0]._private.position.x,
							edges[i]._private.rscratch.arrowEndY - edges[i].target()[0]._private.position.y], 0)))
					{ near.push(edges[i]); }
			}
		} 
		
		near.sort(function(a, b) {
		
			var zIndexCompare = b._private.style["z-index"].value - a._private.style["z-index"].value;
			// Reverse id order, same as given by cy.nodes()
			var idCompare = b._private.data.id.localeCompare(a._private.data.id);
			var nodeEdgeTypeCompare = (function(a, b){
				if (a.isEdge() && b.isNode()) {
					return 1;
				} else if (a.isNode() && b.isEdge()) {
					return -1;
				}
				
				return 0;
			})(a, b);
			
			return zIndexCompare || nodeEdgeTypeCompare || idCompare;
		});
		
		if (near.length > 0) { return near[0]; } else { return null; }
	}
	
	// "Give me everything from this box"
	CanvasRenderer.prototype.getAllInBox = function(x1, y1, x2, y2) {
		var data = this.data; var nodes = this.getCachedNodes(); var edges = this.getCachedEdges(); var box = [];
		
//		console.log(x1, y1, x2, y2, "e") 
		var x1c = Math.min(x1, x2); var x2c = Math.max(x1, x2); var y1c = Math.min(y1, y2); var y2c = Math.max(y1, y2); x1 = x1c; x2 = x2c; y1 = y1c; y2 = y2c; var heur;
//		console.log(x1, y1, x2, y2, "ec") 
		
		for (var i=0;i<nodes.length;i++) {
			if (nodeShapes[nodes[i]._private.style["shape"].value].intersectBox(x1, y1, x2, y2,
				nodes[i]._private.style["width"].value, nodes[i]._private.style["height"].value,
				nodes[i]._private.position.x, nodes[i]._private.position.y, nodes[i]._private.style["border-width"].value / 2))
			{ box.push(nodes[i]); }
		}
		
		for (var i=0;i<edges.length;i++) {
			if (edges[i]._private.rscratch.isSelfEdge) {
				if ((heur = this.boxInBezierVicinity(x1, y1, x2, y2,
						edges[i]._private.rscratch.startX, edges[i]._private.rscratch.startY,
						edges[i]._private.rscratch.cp2ax, edges[i]._private.rscratch.cp2ay,
						edges[i]._private.rscratch.endX, edges[i]._private.rscratch.endY, edges[i]._private.style["width"].value))
							&&
						(heur == 2 || (heur == 1 && this.checkBezierCrossesBox(x1, y1, x2, y2,
							edges[i]._private.rscratch.startX, edges[i]._private.rscratch.startY,
							edges[i]._private.rscratch.cp2ax, edges[i]._private.rscratch.cp2ay,
							edges[i]._private.rscratch.endX, edges[i]._private.rscratch.endY, edges[i]._private.style["width"].value)))
								||
					(heur = this.boxInBezierVicinity(x1, y1, x2, y2,
						edges[i]._private.rscratch.startX, edges[i]._private.rscratch.startY,
						edges[i]._private.rscratch.cp2cx, edges[i]._private.rscratch.cp2cy,
						edges[i]._private.rscratch.endX, edges[i]._private.rscratch.endY, edges[i]._private.style["width"].value))
							&&
						(heur == 2 || (heur == 1 && this.checkBezierCrossesBox(x1, y1, x2, y2,
							edges[i]._private.rscratch.startX, edges[i]._private.rscratch.startY,
							edges[i]._private.rscratch.cp2cx, edges[i]._private.rscratch.cp2cy,
							edges[i]._private.rscratch.endX, edges[i]._private.rscratch.endY, edges[i]._private.style["width"].value)))
					)
				{ box.push(edges[i]); }
			}
			
			if (edges[i]._private.rscratch.isBezierEdge &&
				(heur = this.boxInBezierVicinity(x1, y1, x2, y2,
						edges[i]._private.rscratch.startX, edges[i]._private.rscratch.startY,
						edges[i]._private.rscratch.cp2x, edges[i]._private.rscratch.cp2y,
						edges[i]._private.rscratch.endX, edges[i]._private.rscratch.endY, edges[i]._private.style["width"].value))
							&&
						(heur == 2 || (heur == 1 && this.checkBezierCrossesBox(x1, y1, x2, y2,
							edges[i]._private.rscratch.startX, edges[i]._private.rscratch.startY,
							edges[i]._private.rscratch.cp2x, edges[i]._private.rscratch.cp2y,
							edges[i]._private.rscratch.endX, edges[i]._private.rscratch.endY, edges[i]._private.style["width"].value))))
				{ box.push(edges[i]); }
		
			if (edges[i]._private.rscratch.isStraightEdge &&
				(heur = this.boxInBezierVicinity(x1, y1, x2, y2,
						edges[i]._private.rscratch.startX, edges[i]._private.rscratch.startY,
						edges[i]._private.rscratch.startX * 0.5 + edges[i]._private.rscratch.endX * 0.5, 
						edges[i]._private.rscratch.startY * 0.5 + edges[i]._private.rscratch.endY * 0.5, 
						edges[i]._private.rscratch.endX, edges[i]._private.rscratch.endY, edges[i]._private.style["width"].value))
							&& /* console.log("test", heur) == undefined && */
						(heur == 2 || (heur == 1 && this.checkStraightEdgeCrossesBox(x1, y1, x2, y2,
							edges[i]._private.rscratch.startX, edges[i]._private.rscratch.startY,
							edges[i]._private.rscratch.endX, edges[i]._private.rscratch.endY, edges[i]._private.style["width"].value))))
				{ box.push(edges[i]); }
			
		}
		
		return box;
	}
	
	// @O Keyboard functions
	{
	}
	
	// @O Drawing functions
	{
	
	// Resize canvas
	CanvasRenderer.prototype.matchCanvasSize = function(container) {
		var data = this.data; var width = container.clientWidth; var height = container.clientHeight;
		
		var canvas;
		for (var i = 0; i < 5; i++) {
			
			canvas = data.canvases[i];
			
			if (canvas.width !== width || canvas.height !== height) {
				
				canvas.width = width;
				canvas.height = height;
			
			}
		}
		
		for (var i = 0; i < 2; i++) {
			
			canvas = data.bufferCanvases[i];
			
			if (canvas.width !== width || canvas.height !== height) {
				
				canvas.width = width;
				canvas.height = height;
				
			}
		}
	}
	
	// Redraw frame
	CanvasRenderer.prototype.redraw = function() {
		//console.log("redrawing");
		var cy = this.data.cy; var data = this.data; 
		var nodes = this.getCachedNodes(); var edges = this.getCachedEdges();
		this.matchCanvasSize(data.container);
		
		var elements = nodes.add(edges).toArray();
		
		if (data.canvasNeedsRedraw[DRAG] || data.canvasNeedsRedraw[NODE]) {
		
			this.findEdgeControlPoints(edges);
			
			elements.sort(function(a, b) {
				var result = a._private.style["z-index"].value
					- b._private.style["z-index"].value;
				
				if (result == 0) {
					if (a._private.group == "nodes"
						&& b._private.group == "edges") {
						
						return 1;
					} else if (a._private.group == "edges"
						&& b._private.group == "nodes") {
						
						return -1;
					}
				}
				
				return 0;
			});
		}
		
		if (data.canvasNeedsRedraw[NODE]) {
			var context = data.canvases[4].getContext("2d");

			context.setTransform(1, 0, 0, 1, 0, 0);
			context.clearRect(0, 0, context.canvas.width, context.canvas.height);
			
			context.translate(cy.pan().x, cy.pan().y);
			context.scale(cy.zoom(), cy.zoom());
		
			var element;
			
			for (var index = 0; index < elements.length; index++) {
				element = elements[index];
				
				if (!element._private.grabbed) {
					if (element._private.group == "nodes") {
						this.drawNode(context, element);
						
					} else if (element._private.group == "edges") {
						this.drawEdge(context, element);
					}
				}
			}
			
			for (var index = 0; index < elements.length; index++) {
				element = elements[index];
				
				if (!element._private.grabbed) {
					if (element._private.group == "nodes") {
						this.drawNodeText(context, element);
					} else if (element._private.group == "edges") {
						this.drawEdgeText(context, element);
					}
				}
			}
			
			data.canvasNeedsRedraw[NODE] = false; data.canvasRedrawReason[NODE] = [];
		}
		
		if (data.canvasNeedsRedraw[DRAG]) {
			var context = data.canvases[2].getContext("2d");
			
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.clearRect(0, 0, context.canvas.width, context.canvas.height);
			
			context.translate(cy.pan().x, cy.pan().y);
			context.scale(cy.zoom(), cy.zoom());
			
			var element;

			for (var index = 0; index < elements.length; index++) {
				element = elements[index];
				
				if (element._private.grabbed) {
					if (element._private.group == "nodes") {
						this.drawNode(context, element);
					} else if (element._private.group == "edges") {
						this.drawEdge(context, element);
					}
				}
			}
			
			for (var index = 0; index < elements.length; index++) {
				element = elements[index];
				
				if (element._private.grabbed) {
					if (element._private.group == "nodes") {
						this.drawNodeText(context, element);
					} else if (element._private.group == "edges") {
						this.drawEdgeText(context, element);
					}
				}
			}
			
			data.canvasNeedsRedraw[DRAG] = false; data.canvasRedrawReason[DRAG] = [];
		}
		
		if (data.canvasNeedsRedraw[SELECT_BOX]) {
			var context = data.canvases[0].getContext("2d");
			
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.clearRect(0, 0, context.canvas.width, context.canvas.height);
		
			context.translate(cy.pan().x, cy.pan().y);
			context.scale(cy.zoom(), cy.zoom());			
			
			if (data.select[4] == 1) {
				var coreStyle = cy.style()._private.coreStyle;
				var borderWidth = coreStyle["selection-box-border-width"].value
					/ data.cy.zoom();
				
				context.lineWidth = borderWidth;
				context.fillStyle = "rgba(" 
					+ coreStyle["selection-box-color"].value[0] + ","
					+ coreStyle["selection-box-color"].value[1] + ","
					+ coreStyle["selection-box-color"].value[2] + ","
					+ coreStyle["selection-box-opacity"].value + ")";
				
				context.fillRect(
					data.select[0],
					data.select[1],
					data.select[2] - data.select[0],
					data.select[3] - data.select[1]);
				
				if (borderWidth > 0) {
					context.strokeStyle = "rgba(" 
						+ coreStyle["selection-box-border-color"].value[0] + ","
						+ coreStyle["selection-box-border-color"].value[1] + ","
						+ coreStyle["selection-box-border-color"].value[2] + ","
						+ coreStyle["selection-box-opacity"].value + ")";
					
					context.strokeRect(
						data.select[0],
						data.select[1],
						data.select[2] - data.select[0],
						data.select[3] - data.select[1]);
				}
			}
			
			data.canvasNeedsRedraw[SELECT_BOX] = false; data.canvasRedrawReason[SELECT_BOX] = [];
		}

		{
			var context;
			
			// Rasterize the layers, but only if container has nonzero size
			if (this.data.container.clientHeight > 0
					&& this.data.container.clientWidth > 0) {
				
				context = data.bufferCanvases[1].getContext("2d");
				context.globalCompositeOperation = "copy";
				context.drawImage(data.canvases[4], 0, 0);
				context.globalCompositeOperation = "source-over";
				context.drawImage(data.canvases[2], 0, 0);
				context.drawImage(data.canvases[0], 0, 0);
				
				context = data.bufferCanvases[0].getContext("2d");
				context.globalCompositeOperation = "copy";
				context.drawImage(data.bufferCanvases[1], 0, 0);
			}
		}
	};
	
	var imageCache = {};
	
	// Discard after 5 min. of disuse
	var IMAGE_KEEP_TIME = 30 * 300; // 300frames@30fps, or. 5min
	
	CanvasRenderer.prototype.getCachedImage = function(url) {

		if (imageCache[url] && imageCache[url].image) {

			// Reset image discard timer
			imageCache[url].keepTime = IMAGE_KEEP_TIME; 
			return imageCache[url].image;
		}
		
		var imageContainer = imageCache[url];
		
		if (imageContainer == undefined) { 
			imageCache[url] = new Object();
			imageCache[url].image = new Image();
			imageCache[url].image.src = url;
			
			// Initialize image discard timer
			imageCache[url].keepTime = IMAGE_KEEP_TIME;
			
			imageContainer = imageCache[url];
		}
		
		return imageContainer.image;
	}
	
	CanvasRenderer.prototype.updateImageCaches = function() {
		
		for (var url in imageCache) {
			if (imageCache[url].keepTime <= 0) {
				
				if (imageCache[url].image != undefined) {
					imageCache[url].image.src = undefined;
					imageCache[url].image = undefined;
				}
				
				imageCache[url] = undefined;
			} else {
				imageCache[url] -= 1;
			}
		}
	}
	
	CanvasRenderer.prototype.drawImage = function(context, x, y, widthScale, heightScale, rotationCW, image) {
		
		image.widthScale = 0.5;
		image.heightScale = 0.5;
		
		image.rotate = rotationCW;
		
		var finalWidth; var finalHeight;
		
		canvas.drawImage(image, x, y);
	}
	
	// Draw edge
	CanvasRenderer.prototype.drawEdge = function(context, edge) {
	
		var startNode, endNode;

		startNode = edge.source()[0];
		endNode = edge.target()[0];
		
		if (edge._private.style["visibility"].value != "visible"
			|| startNode._private.style["visibility"].value != "visible"
			|| endNode._private.style["visibility"].value != "visible") {
			return;
		}
		
		// Edge color & opacity
		context.strokeStyle = "rgba(" 
			+ edge._private.style["line-color"].value[0] + ","
			+ edge._private.style["line-color"].value[1] + ","
			+ edge._private.style["line-color"].value[2] + ","
			+ edge._private.style.opacity.value + ")";
		
		// Edge line width
		if (edge._private.style["width"].value <= 0) {
			return;
		}
		
		context.lineWidth = edge._private.style["width"].value;
		
		this.findEndpoints(edge);
		
		if (edge._private.rscratch.isSelfEdge) {
					
			var details = edge._private.rscratch;
			this.drawStyledEdge(context, [details.startX, details.startY, details.cp2ax,
				details.cp2ay, details.selfEdgeMidX, details.selfEdgeMidY],
				edge._private.style["line-style"].value,
				edge._private.style["width"].value);
			
			this.drawStyledEdge(context, [details.selfEdgeMidX, details.selfEdgeMidY,
				details.cp2cx, details.cp2cy, details.endX, details.endY],
				edge._private.style["line-style"].value,
				edge._private.style["width"].value);
			
		} else if (edge._private.rscratch.isStraightEdge) {
			
			var nodeDirectionX = endNode._private.position.x - startNode._private.position.x;
			var nodeDirectionY = endNode._private.position.y - startNode._private.position.y;
			
			var edgeDirectionX = edge._private.rscratch.endX - edge._private.rscratch.startX;
			var edgeDirectionY = edge._private.rscratch.endY - edge._private.rscratch.startY;
			
			if (nodeDirectionX * edgeDirectionX
				+ nodeDirectionY * edgeDirectionY < 0) {
				
				edge._private.rscratch.straightEdgeTooShort = true;	
			} else {
				
				var details = edge._private.rscratch;
				this.drawStyledEdge(context, [details.startX, details.startY,
				                              details.endX, details.endY],
				                              edge._private.style["line-style"].value,
				                              edge._private.style["width"].value);
				
				edge._private.rscratch.straightEdgeTooShort = false;	
			}	
		} else {
			
			var details = edge._private.rscratch;
			this.drawStyledEdge(context, [details.startX, details.startY,
				details.cp2x, details.cp2y, details.endX, details.endY],
				edge._private.style["line-style"].value,
				edge._private.style["width"].value);
			
		}
		
		if (edge._private.rscratch.noArrowPlacement !== true
				&& edge._private.rscratch.startX !== undefined) {
			this.drawArrowheads(context, edge);
		}
	}
	
	var _genPoints = function(pt, spacing, even) {
		
		var approxLen = Math.sqrt(Math.pow(pt[4] - pt[0], 2) + Math.pow(pt[5] - pt[1], 2));
		approxLen += Math.sqrt(Math.pow((pt[4] + pt[0]) / 2 - pt[2], 2) + Math.pow((pt[5] + pt[1]) / 2 - pt[3], 2));

		var pts = Math.ceil(approxLen / spacing); var inc = approxLen / spacing;
		var pz;
		
		if (pts > 0) {
			pz = new Array(pts * 2);
		} else {
			return null;
		}
		
		for (var i = 0; i < pts; i++) {
			var cur = i / pts;
			pz[i * 2] = pt[0] * (1 - cur) * (1 - cur) + 2 * (pt[2]) * (1 - cur) * cur + pt[4] * (cur) * (cur);
			pz[i * 2 + 1] = pt[1] * (1 - cur) * (1 - cur) + 2 * (pt[3]) * (1 - cur) * cur + pt[5] * (cur) * (cur);
		}
		
		return pz;
	}
	
	var _genStraightLinePoints = function(pt, spacing, even) {
		
		var approxLen = Math.sqrt(Math.pow(pt[2] - pt[0], 2) + Math.pow(pt[3] - pt[1], 2));
		
		var pts = Math.ceil(approxLen / spacing);
		var pz;
		
		if (pts > 0) {
			pz = new Array(pts * 2);
		} else {
			return null;
		}
		
		var lineOffset = [pt[2] - pt[0], pt[3] - pt[1]];
		for (var i = 0; i < pts; i++) {
			var cur = i / pts;
			pz[i * 2] = lineOffset[0] * cur + pt[0];
			pz[i * 2 + 1] = lineOffset[1] * cur + pt[1];
		}
		
		return pz;
	}
	
	var _genEvenOddpts = function(pt, evenspac, oddspac) {
		
		pt1 = _genpts(pt, evenspac);
		pt2 = _genpts(pt, oddspac);
	}
	
	CanvasRenderer.prototype.createBuffer = function(w, h) {
		var buffer = document.createElement("canvas");
		buffer.width = w;
		buffer.height = h;
		
		return [buffer, buffer.getContext("2d")];
	}
	
	/*
	CanvasRenderer.prototype.
	
	CanvasRenderer.prototype.drawStraightEdge = function(context, x1, y1, x2, y2, type, width) {
		
		if (type == "solid") {
			context.beginPath();
			context.moveTo(
				edge._private.rscratch.startX,
				edge._private.rscratch.startY);
	
			
			context.stroke();
		} else if (type == "dotted") {
			var pt = _genStraightLinePoints([x1, y1, x2, y2], 10, false);
			
			
		} else if (type == "dashed") {
			var pt = _genStraightLinePoints([x1, y1, x2, y2], 10, false);
		}
		
	}
	*/
	
	CanvasRenderer.prototype.drawStyledEdge = function(
			context, pts, type, width) {
		
		// 3 points given -> assume Bezier
		// 2 -> assume straight
		
		var zoom = this.data.cy.zoom();
		
		// Adjusted edge width for dotted
//		width = Math.max(width * 1.6, 3.4) * zoom;

		//		console.log("w", width);
		
		if (type == "solid") {
			
			context.beginPath();
			context.moveTo(pts[0], pts[1]);
			if (pts.length == 3 * 2) {
				context.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
			} else {
				context.lineTo(pts[2], pts[3]);
			}
//			context.closePath();
			context.stroke();
			
		} else if (type == "dotted") {
			
			var pt;
			if (pts.length == 3 * 2) {
				pt = _genPoints(pts, 16, true);
			} else {
				pt = _genStraightLinePoints(pts, 16, true);
			}
			
			if (!pt) { return; }
			
			var dotRadius = Math.max(width * 1.6, 3.4) * zoom;
			var bufW = dotRadius * 2, bufH = dotRadius * 2;
			var buffer = this.createBuffer(bufW, bufH);
			
			var context2 = buffer[1];
//			console.log(buffer);
//			console.log(bufW, bufH);
			
			// Draw on buffer
			context2.setTransform(1, 0, 0, 1, 0, 0);
			context2.clearRect(0, 0, bufW, bufH);
			
			context2.fillStyle = context.strokeStyle;
			context2.beginPath();
			context2.arc(dotRadius, dotRadius, dotRadius * 0.5, 0, Math.PI * 2, false);
			context2.fill();
			
			// Now use buffer
			context.beginPath();
			context.save();
			
			for (var i=0; i<pt.length/2; i++) {
				
//				context.beginPath();
//				context.arc(pt[i*2], pt[i*2+1], width * 0.5, 0, Math.PI * 2, false);
//				context.fill();
				
				context.drawImage(
						buffer[0],
						pt[i*2] - bufW/2 / zoom,
						pt[i*2+1] - bufH/2 / zoom,
						bufW / zoom,
						bufH / zoom);
			}
			
			context.restore();
			
		} else if (type == "dashed") {
			var pt;
			if (pts.length == 3 * 2) {
				pt = _genPoints(pts, 13, true);
			} else {
				pt = _genStraightLinePoints(pts, 13, true);
			}
			if (!pt) { return; }
			
//			var dashSize = Math.max(width * 1.6, 3.4);
//			dashSize = Math.min(dashSize)
			
			//var bufW = width * 2 * zoom, bufH = width * 2.5 * zoom;
			var bufW = width * 2 * zoom, bufH = width * 1.7 * zoom;
			
			var buffer = this.createBuffer(bufW, bufH);
			var context2 = buffer[1];

			// Draw on buffer
			context2.setTransform(1, 0, 0, 1, 0, 0);
			context2.clearRect(0, 0, bufW, bufH);
			
			if (context.strokeStyle) {
				context2.strokeStyle = context.strokeStyle;
			}
			
	//		context2.fillStyle = context.strokeStyle;
			
			context2.beginPath();
			context2.moveTo(bufW / 2, bufH * 0.2);
			context2.lineTo(bufW / 2,  bufH * 0.8);
			
	//		context2.arc(bufH, dotRadius, dotRadius * 0.5, 0, Math.PI * 2, false);
			
	//		context2.fill();
			context2.stroke();
			
			context.save();
			
			// document.body.appendChild(buffer[0]);
			
			var quadraticBezierVaryingTangent = false;
			var rotateVector, angle;
			
			// Straight line; constant tangent angle
			if (pts.length == 2 * 2) {
				rotateVector = [pts[2] - pts[0], pts[3] - pt[1]];
				
				angle = Math.acos((rotateVector[0] * 0 + rotateVector[1] * -1)
						/ Math.sqrt(rotateVector[0] * rotateVector[0] 
						+ rotateVector[1] * rotateVector[1]));
	
				if (rotateVector[0] < 0) {
					angle = -angle + 2 * Math.PI;
				}
			} else if (pts.length == 3 * 2) {
				quadraticBezierVaryingTangent = true;
			}
			
			for (var i=0; i<pt.length/2; i++) {
				
				var p = i / (Math.max(pt.length/2 - 1, 1));
			
				// Quadratic bezier; varying tangent
				// So, use derivative of quadratic Bezier function to find tangents
				if (quadraticBezierVaryingTangent) {
					rotateVector = [2 * (1-p) * (pts[2] - pts[0]) 
					                	+ 2 * p * (pts[4] - pts[2]),
					                    2 * (1-p) * (pts[3] - pts[1]) 
					                    + 2 * p * (pts[5] - pts[3])];
	
					angle = Math.acos((rotateVector[0] * 0 + rotateVector[1] * -1)
							/ Math.sqrt(rotateVector[0] * rotateVector[0] 
								+ rotateVector[1] * rotateVector[1]));
	
					if (rotateVector[0] < 0) {
						angle = -angle + 2 * Math.PI;
					}
				}
				
				context.translate(pt[i*2], pt[i*2+1]);
				
				context.rotate(angle);
				context.translate(-bufW/2 / zoom, -bufH/2 / zoom);
				
				context.drawImage(
						buffer[0],
						0,
						0,
						bufW / zoom,
						bufH / zoom);
				
				context.translate(bufW/2 / zoom, bufH/2 / zoom);
				context.rotate(-angle);
				
				context.translate(-pt[i*2], -pt[i*2+1]);
				
			}
			context.restore();
		} else {
			this.drawStyledEdge(context, pts, "solid", width);
		}
		
	}
	
	// Draw edge text
	CanvasRenderer.prototype.drawEdgeText = function(context, edge) {
	
		if (edge._private.style["visibility"].value != "visible") {
			return;
		}
	
		// Calculate text draw position
		
		context.textAlign = "center";
		context.textBaseline = "middle";
		
		var textX, textY;	
		var edgeCenterX, edgeCenterY;
		
		if (edge._private.rscratch.isSelfEdge) {
			edgeCenterX = edge._private.rscratch.selfEdgeMidX;
			edgeCenterY = edge._private.rscratch.selfEdgeMidY;
		} else if (edge._private.rscratch.isStraightEdge
				&& !edge._private.rscratch.isBezierEdge) {
			edgeCenterX = (edge._private.rscratch.startX
				+ edge._private.rscratch.endX) / 2;
			edgeCenterY = (edge._private.rscratch.startY
				+ edge._private.rscratch.endY) / 2;
		} else if (edge._private.rscratch.isBezierEdge
				&& !edge._private.rscratch.isStraightEdge) {
			edgeCenterX = 0.25 * edge._private.rscratch.startX
				+ 2 * 0.5 * 0.5 * edge._private.rscratch.cp2x
				+ (0.5 * 0.5) * edge._private.rscratch.endX;
			edgeCenterY = Math.pow(1 - 0.5, 2) * edge._private.rscratch.startY
				+ 2 * (1 - 0.5) * 0.5 * edge._private.rscratch.cp2y
				+ (0.5 * 0.5) * edge._private.rscratch.endY;
		}
		
		textX = edgeCenterX;
		textY = edgeCenterY;
		
		this.drawText(context, edge, textX, textY);
	}
	
	// Draw node
	CanvasRenderer.prototype.drawNode = function(context, node) {
	
		var nodeWidth, nodeHeight;
		
		if (node._private.style["visibility"].value != "visible") {
			return;
		}
		
		// Node color & opacity
		context.fillStyle = "rgba(" 
			+ node._private.style["background-color"].value[0] + ","
			+ node._private.style["background-color"].value[1] + ","
			+ node._private.style["background-color"].value[2] + ","
			+ (node._private.style["background-opacity"].value 
			* node._private.style["opacity"].value) + ")";
		
		// Node border color & opacity
		context.strokeStyle = "rgba(" 
			+ node._private.style["border-color"].value[0] + ","
			+ node._private.style["border-color"].value[1] + ","
			+ node._private.style["border-color"].value[2] + ","
			+ (node._private.style["border-opacity"].value 
			* node._private.style["opacity"].value) + ")";
		
		nodeWidth = node._private.style["width"].value;
		nodeHeight = node._private.style["height"].value;
		
		{
			//var image = this.getCachedImage("url");
			
			if (node._private.style["background-image"].value[2] ||
					node._private.style["background-image"].value[1]) {
				
				var image = this.getCachedImage(node._private.style["background-image"].value[2]
					|| node._private.style["background-image"].value[1]);
				
				//context.clip
				this.drawInscribedImage(context, image, node);
				
			} else {
				
				// Draw node
				nodeShapes[node._private.style["shape"].value].draw(
					context,
					node._private.position.x,
					node._private.position.y,
					nodeWidth,
					nodeHeight); //node._private.data.weight / 5.0
			}
			/*
			context.drawImage(image, 
			*/
		}
		
		// Border width, draw border
		context.lineWidth = node._private.style["border-width"].value;
		if (node._private.style["border-width"].value > 0) {
			context.stroke();
		}
	}
	
	CanvasRenderer.prototype.drawInscribedImage = function(context, img, node) {
		
		console.log(this.data);
		var zoom = this.data.cy._private.zoom;
		
		var nodeX = node._private.position.x;
		var nodeY = node._private.position.y;
		
		var nodeWidth = node._private.style["width"].value;
		var nodeHeight = node._private.style["height"].value;
		
		nodeShapes[node._private.style["shape"].value].drawPath(
				context,
				nodeX, nodeY, 
				nodeWidth, nodeHeight);
		
		context.clip();
		
		var imgDim = [img.width, img.height];
		context.drawImage(img, 
				nodeX - imgDim[0] / 2 * zoom,
				nodeY - imgDim[1] / 2 * zoom,
				imgDim[0] * zoom,
				imgDim[1] * zoom);
		
		context.resetClip();
		context.stroke();
		
	}
	
	// Draw node text
	CanvasRenderer.prototype.drawNodeText = function(context, node) {
		
		if (node._private.style["visibility"].value != "visible") {
			return;
		}
	
		var textX, textY;
		
		var nodeWidth = node._private.style["width"].value;
		var nodeHeight = node._private.style["height"].value;
	
		// Find text position
		var textHalign = node._private.style["text-halign"].strValue;
		if (textHalign == "left") {
			// Align right boundary of text with left boundary of node
			context.textAlign = "right";
			textX = node._private.position.x - nodeWidth / 2;
		} else if (textHalign == "right") {
			// Align left boundary of text with right boundary of node
			context.textAlign = "left";
			textX = node._private.position.x + nodeWidth / 2;
		} else if (textHalign == "center") {
			context.textAlign = "center";
			textX = node._private.position.x;
		} else {
			// Same as center
			context.textAlign = "center";
			textX = node._private.position.x;
		}
		
		var textValign = node._private.style["text-valign"].strValue;
		if (textValign == "top") {
			context.textBaseline = "bottom";
			textY = node._private.position.y - nodeHeight / 2;
		} else if (textValign == "bottom") {
			context.textBaseline = "top";
			textY = node._private.position.y + nodeHeight / 2;
		} else if (textValign == "middle" || textValign == "center") {
			context.textBaseline = "middle";
			textY = node._private.position.y;
		} else {
			// same as center
			context.textBaseline = "middle";
			textY = node._private.position.y;
		}
		
		this.drawText(context, node, textX, textY);
	}
	
	// Draw text
	CanvasRenderer.prototype.drawText = function(context, element, textX, textY) {
	
		// Font style
		var labelStyle = element._private.style["font-style"].strValue;
		var labelSize = element._private.style["font-size"].strValue;
		var labelFamily = element._private.style["font-family"].strValue;
		var labelVariant = element._private.style["font-variant"].strValue;
		var labelWeight = element._private.style["font-weight"].strValue;
		
		context.font = labelStyle + " " + labelVariant + " " + labelWeight + " " 
			+ labelSize + " " + labelFamily;
		
		var text = String(element._private.style["content"].value);
		var textTransform = element._private.style["text-transform"].value;
		
		if (textTransform == "none") {
		} else if (textTransform == "uppercase") {
			text = text.toUpperCase();
		} else if (textTransform == "lowercase") {
			text = text.toLowerCase();
		}
		
		// Calculate text draw position based on text alignment
		
		context.fillStyle = "rgba(" 
			+ element._private.style["color"].value[0] + ","
			+ element._private.style["color"].value[1] + ","
			+ element._private.style["color"].value[2] + ","
			+ (element._private.style["text-opacity"].value
			* element._private.style["opacity"].value) + ")";
		
		context.strokeStyle = "rgba(" 
			+ element._private.style["text-outline-color"].value[0] + ","
			+ element._private.style["text-outline-color"].value[1] + ","
			+ element._private.style["text-outline-color"].value[2] + ","
			+ (element._private.style["text-opacity"].value
			* element._private.style["opacity"].value) + ")";
		
		if (text != undefined) {
			// Thanks sysord@github for the isNaN checks!
			if (isNaN(textX)) { textX = 0; }
			if (isNaN(textY)) { textY = 0; }

			context.fillText("" + text, textX, textY);
		}
		
		var lineWidth = element._private.style["text-outline-width"].value;
		
		if (lineWidth > 0) {
			context.lineWidth = lineWidth;
			context.strokeText(text, textX, textY);
		}
	}

	}
	
	// @O Edge calculation functions
	{
	
	// Find edge control points
	CanvasRenderer.prototype.findEdgeControlPoints = function(edges) {
		var hashTable = {}; var cy = this.data.cy;
		
		var pairId;
		for (var i = 0; i < edges.length; i++) {
			pairId = edges[i]._private.data.source > edges[i]._private.data.target ?
				edges[i]._private.data.target + edges[i]._private.data.source :
				edges[i]._private.data.source + edges[i]._private.data.target;

			if (hashTable[pairId] == undefined) {
				hashTable[pairId] = [];
			}
			
			hashTable[pairId].push(edges[i]);
		}
		var src, tgt;
		
		// Nested for loop is OK; total number of iterations for both loops = edgeCount	
		for (var pairId in hashTable) {
		
			src = cy.getElementById(hashTable[pairId][0]._private.data.source);
			tgt = cy.getElementById(hashTable[pairId][0]._private.data.target);

			var midPointX = (src._private.position.x + tgt._private.position.x) / 2;
			var midPointY = (src._private.position.y + tgt._private.position.y) / 2;
			
			var displacementX, displacementY;
			
			if (hashTable[pairId].length > 1) {
				displacementX = tgt._private.position.y - src._private.position.y;
				displacementY = src._private.position.x - tgt._private.position.x;
				
				var displacementLength = Math.sqrt(displacementX * displacementX
					+ displacementY * displacementY);
				
				displacementX /= displacementLength;
				displacementY /= displacementLength;
			}
			
			var edge;
			
			for (var i = 0; i < hashTable[pairId].length; i++) {
				edge = hashTable[pairId][i];
							
				// Self-edge
				if (src._private.data.id == tgt._private.data.id) {
					var stepSize = edge._private.style["control-point-step-size"].pxValue;
						
					edge._private.rscratch.isSelfEdge = true;
					
					
					// Old -- before fix for large nodes hiding the edge
					// ===
//					edge._private.rscratch.cp2ax = src._private.position.x;
//					edge._private.rscratch.cp2ay = src._private.position.y
//						- 1.3 * stepSize * (i / 3 + 1);
//					
//					edge._private.rscratch.cp2cx = src._private.position.x
//						- 1.3 * stepSize * (i / 3 + 1);
//					edge._private.rscratch.cp2cy = src._private.position.y;
					
//					edge._private.rscratch.selfEdgeMidX =
//						(edge._private.rscratch.cp2ax + edge._private.rscratch.cp2cx) / 2.0;
//				
//					edge._private.rscratch.selfEdgeMidY =
//						(edge._private.rscratch.cp2ay + edge._private.rscratch.cp2cy) / 2.0;
					
					// New -- fix for large nodes
					edge._private.rscratch.cp2ax = src._private.position.x;
					edge._private.rscratch.cp2ay = src._private.position.y
						- (1 + Math.pow(src._private.style["height"].value, 1.12) / 100) * stepSize * (i / 3 + 1);
					
					edge._private.rscratch.cp2cx = src._private.position.x
						- (1 + Math.pow(src._private.style["width"].value, 1.12) / 100) * stepSize * (i / 3 + 1);
					edge._private.rscratch.cp2cy = src._private.position.y;
					
					edge._private.rscratch.selfEdgeMidX =
						(edge._private.rscratch.cp2ax + edge._private.rscratch.cp2cx) / 2.0;
				
					edge._private.rscratch.selfEdgeMidY =
						(edge._private.rscratch.cp2ay + edge._private.rscratch.cp2cy) / 2.0;
					
				// Straight edge
				} else if (hashTable[pairId].length % 2 == 1
					&& i == Math.floor(hashTable[pairId].length / 2)) {
					
					edge._private.rscratch.isStraightEdge = true;
					
				// Bezier edge
				} else {
					var stepSize = edge._private.style["control-point-step-size"].value;
					var distanceFromMidpoint = (0.5 - hashTable[pairId].length / 2 + i) * stepSize;
					
					edge._private.rscratch.isBezierEdge = true;
					
					edge._private.rscratch.cp2x = midPointX
						+ displacementX * distanceFromMidpoint;
					edge._private.rscratch.cp2y = midPointY
						+ displacementY * distanceFromMidpoint;
					
					// console.log(edge, midPointX, displacementX, distanceFromMidpoint);
				}
			}
		}
		
		return hashTable;
	}

	CanvasRenderer.prototype.findEndpoints = function(edge) {
		var intersect;

		var source = edge.source()[0];
		var target = edge.target()[0];
		
		var sourceRadius = Math.max(edge.source()[0]._private.style["width"].value,
			edge.source()[0]._private.style["height"].value);
		
		var targetRadius = Math.max(edge.target()[0]._private.style["width"].value,
			edge.target()[0]._private.style["height"].value);
		
		sourceRadius = 0;
		targetRadius /= 2;
		
		var start = [edge.source().position().x, edge.source().position().y];
		var end = [edge.target().position().x, edge.target().position().y];
		
		if (edge._private.rscratch.isSelfEdge) {
			
			var cp = [edge._private.rscratch.cp2cx, edge._private.rscratch.cp2cy];
			
			intersect = nodeShapes[target._private.style["shape"].value].intersectLine(
				target._private.position.x,
				target._private.position.y,
				target._private.style["width"].value,
				target._private.style["height"].value,
				cp[0], //halfPointX,
				cp[1], //halfPointY
				target._private.style["border-width"].value / 2
			);
			
			var arrowEnd = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["target-arrow-shape"].value].spacing(edge));
			var edgeEnd = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["target-arrow-shape"].value].gap(edge));
			
			edge._private.rscratch.endX = edgeEnd[0];
			edge._private.rscratch.endY = edgeEnd[1];
			
			edge._private.rscratch.arrowEndX = arrowEnd[0];
			edge._private.rscratch.arrowEndY = arrowEnd[1];
			
			var cp = [edge._private.rscratch.cp2ax, edge._private.rscratch.cp2ay];

			intersect = nodeShapes[source._private.style["shape"].value].intersectLine(
				source._private.position.x,
				source._private.position.y,
				source._private.style["width"].value,
				source._private.style["height"].value,
				cp[0], //halfPointX,
				cp[1], //halfPointY
				source._private.style["border-width"].value / 2
			);
			
			var arrowStart = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["source-arrow-shape"].value].spacing(edge));
			var edgeStart = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["source-arrow-shape"].value].gap(edge));
			
			edge._private.rscratch.startX = edgeStart[0];
			edge._private.rscratch.startY = edgeStart[1];
			
			edge._private.rscratch.arrowStartX = arrowStart[0];
			edge._private.rscratch.arrowStartY = arrowStart[1];
			
		} else if (edge._private.rscratch.isStraightEdge) {
		
			intersect = nodeShapes[target._private.style["shape"].value].intersectLine(
				target._private.position.x,
				target._private.position.y,
				target._private.style["width"].value,
				target._private.style["height"].value,
				source.position().x,
				source.position().y,
				target._private.style["border-width"].value / 2);
				
			if (intersect.length == 0) {
				edge._private.rscratch.noArrowPlacement = true;
	//			return;
			} else {
				edge._private.rscratch.noArrowPlacement = false;
			}
			
			var arrowEnd = this.shortenIntersection(intersect,
				[source.position().x, source.position().y],
				arrowShapes[edge._private.style["target-arrow-shape"].value].spacing(edge));
			var edgeEnd = this.shortenIntersection(intersect,
				[source.position().x, source.position().y],
				arrowShapes[edge._private.style["target-arrow-shape"].value].gap(edge));

			edge._private.rscratch.endX = edgeEnd[0];
			edge._private.rscratch.endY = edgeEnd[1];
			
			edge._private.rscratch.arrowEndX = arrowEnd[0];
			edge._private.rscratch.arrowEndY = arrowEnd[1];
		
			intersect = nodeShapes[source._private.style["shape"].value].intersectLine(
				source._private.position.x,
				source._private.position.y,
				source._private.style["width"].value,
				source._private.style["height"].value,
				target.position().x,
				target.position().y,
				source._private.style["border-width"].value / 2);
			
			if (intersect.length == 0) {
				edge._private.rscratch.noArrowPlacement = true;
	//			return;
			} else {
				edge._private.rscratch.noArrowPlacement = false;
			}
			
			/*
			console.log("1: "
				+ arrowShapes[edge._private.style["source-arrow-shape"].value],
					edge._private.style["source-arrow-shape"].value);
			*/
			var arrowStart = this.shortenIntersection(intersect,
				[target.position().x, target.position().y],
				arrowShapes[edge._private.style["source-arrow-shape"].value].spacing(edge));
			var edgeStart = this.shortenIntersection(intersect,
				[target.position().x, target.position().y],
				arrowShapes[edge._private.style["source-arrow-shape"].value].gap(edge));

			edge._private.rscratch.startX = edgeStart[0];
			edge._private.rscratch.startY = edgeStart[1];
			
			edge._private.rscratch.arrowStartX = arrowStart[0];
			edge._private.rscratch.arrowStartY = arrowStart[1];
						
		} else if (edge._private.rscratch.isBezierEdge) {
			
			var cp = [edge._private.rscratch.cp2x, edge._private.rscratch.cp2y];
			
			// Point at middle of Bezier
			var halfPointX = start[0] * 0.25 + end[0] * 0.25 + cp[0] * 0.5;
			var halfPointY = start[1] * 0.25 + end[1] * 0.25 + cp[1] * 0.5;
			
			intersect = nodeShapes[
				target._private.style["shape"].value].intersectLine(
				target._private.position.x,
				target._private.position.y,
				target._private.style["width"].value,
				target._private.style["height"].value,
				cp[0], //halfPointX,
				cp[1], //halfPointY
				target._private.style["border-width"].value / 2
			);
			
			/*
			console.log("2: "
				+ arrowShapes[edge._private.style["source-arrow-shape"].value],
					edge._private.style["source-arrow-shape"].value);
			*/
			var arrowEnd = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["target-arrow-shape"].value].spacing(edge));
			var edgeEnd = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["target-arrow-shape"].value].gap(edge));
			
			edge._private.rscratch.endX = edgeEnd[0];
			edge._private.rscratch.endY = edgeEnd[1];
			
			edge._private.rscratch.arrowEndX = arrowEnd[0];
			edge._private.rscratch.arrowEndY = arrowEnd[1];
			
			intersect = nodeShapes[
				source._private.style["shape"].value].intersectLine(
				source._private.position.x,
				source._private.position.y,
				source._private.style["width"].value,
				source._private.style["height"].value,
				cp[0], //halfPointX,
				cp[1], //halfPointY
				source._private.style["border-width"].value / 2
			);
			
			var arrowStart = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["source-arrow-shape"].value].spacing(edge));
			var edgeStart = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["source-arrow-shape"].value].gap(edge));
			
			edge._private.rscratch.startX = edgeStart[0];
			edge._private.rscratch.startY = edgeStart[1];
			
			edge._private.rscratch.arrowStartX = arrowStart[0];
			edge._private.rscratch.arrowStartY = arrowStart[1];
			
		} else if (edge._private.rscratch.isArcEdge) {
			return;
		}
	}

	}

	// @O Graph traversal functions
	{
	
	// Find adjacent edges
	CanvasRenderer.prototype.findEdges = function(nodeSet) {
		
		var edges = this.getCachedEdges();
		
		var hashTable = {};
		var adjacentEdges = [];
		
		for (var i = 0; i < nodeSet.length; i++) {
			hashTable[nodeSet[i]._private.data.id] = nodeSet[i];
		}
		
		for (var i = 0; i < edges.length; i++) {
			if (hashTable[edges[i]._private.data.source]
				|| hashTable[edges[i]._private.data.target]) {
				
				adjacentEdges.push(edges[i]);
			}
		}
		
		return adjacentEdges;
	}
	
	}
	
	// @O Intersection functions
	{
	CanvasRenderer.prototype.intersectLineEllipse = function(
		x, y, centerX, centerY, ellipseWradius, ellipseHradius) {
		
		var dispX = centerX - x;
		var dispY = centerY - y;
		
		dispX /= ellipseWradius;
		dispY /= ellipseHradius;
		
		var len = Math.sqrt(dispX * dispX + dispY * dispY);
		
		var newLength = len - 1;
		
		if (newLength < 0) {
			return [];
		}
		
		var lenProportion = newLength / len;
		
		return [(centerX - x) * lenProportion + x, (centerY - y) * lenProportion + y];
	}
	
	CanvasRenderer.prototype.findCircleNearPoint = function(centerX, centerY, 
		radius, farX, farY) {
		
		var displacementX = farX - centerX;
		var displacementY = farY - centerY;
		var distance = Math.sqrt(displacementX * displacementX 
			+ displacementY * displacementY);
		
		var unitDisplacementX = displacementX / distance;
		var unitDisplacementY = displacementY / distance;
		
		return [centerX + unitDisplacementX * radius, 
			centerY + unitDisplacementY * radius];
	}
	
	CanvasRenderer.prototype.findMaxSqDistanceToOrigin = function(points) {
		var maxSqDistance = 0.000001;
		var sqDistance;
		
		for (var i = 0; i < points.length / 2; i++) {
			
			sqDistance = points[i * 2] * points[i * 2] 
				+ points[i * 2 + 1] * points[i * 2 + 1];
			
			if (sqDistance > maxSqDistance) {
				maxSqDistance = sqDistance;
			}
		}
		
		return maxSqDistance;
	}
	
	CanvasRenderer.prototype.finiteLinesIntersect = function(
		x1, y1, x2, y2, x3, y3, x4, y4, infiniteLines) {
		
		var ua_t = (x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3);
		var ub_t = (x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3);
		var u_b = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);

		if (u_b != 0) {
			var ua = ua_t / u_b;
			var ub = ub_t / u_b;
			
			if (0 <= ua && ua <= 1 && 0 <= ub && ub <= 1) {	
				return [x1 + ua * (x2 - x1), y1 + ua * (y2 - y1)];
				
			} else {
				if (!infiniteLines) {
					return [];
				} else {
					return [x1 + ua * (x2 - x1), y1 + ua * (y2 - y1)];
				}
			}
		} else {
			if (ua_t == 0 || ub_t == 0) {

				// Parallel, coincident lines. Check if overlap

				// Check endpoint of second line
				if ([x1, x2, x4].sort()[1] == x4) {
					return [x4, y4];
				}
				
				// Check start point of second line
				if ([x1, x2, x3].sort()[1] == x3) {
					return [x3, y3];
				}
				
				// Endpoint of first line
				if ([x3, x4, x2].sort()[1] == x2) {
					return [x2, y2];
				}
				
				return [];
			} else {
			
				// Parallel, non-coincident
				return [];
			}
		}
	}
	
	CanvasRenderer.prototype.boxIntersectEllipse = function(
		x1, y1, x2, y2, padding, width, height, centerX, centerY) {
		
		if (x2 < x1) {
			var oldX1 = x1;
			x1 = x2;
			x2 = oldX1;
		}
		
		if (y2 < y1) {
			var oldY1 = y1;
			y1 = y2;
			y2 = oldY1;
		}
		
		// 4 ortho extreme points
		var east = [centerX - width / 2 - padding, centerY];
		var west = [centerX + width / 2 + padding, centerY];
		var north = [centerX, centerY + height / 2 + padding];
		var south = [centerX, centerY - height / 2 - padding];
		
		// out of bounds: return false
		if (x2 < east[0]) {
			return false;
		}
		
		if (x1 > west[0]) {
			return false;
		}
		
		if (y2 < south[1]) {
			return false;
		}
		
		if (y1 > north[1]) {
			return false;
		}
		
		// 1 of 4 ortho extreme points in box: return true
		if (x1 <= east[0] && east[0] <= x2
				&& y1 <= east[1] && east[1] <= y2) {
			return true;
		}
		
		if (x1 <= west[0] && west[0] <= x2
				&& y1 <= west[1] && west[1] <= y2) {
			return true;
		}
		
		if (x1 <= north[0] && north[0] <= x2
				&& y1 <= north[1] && north[1] <= y2) {
			return true;
		}
		
		if (x1 <= south[0] && south[0] <= x2
				&& y1 <= south[1] && south[1] <= y2) {
			return true;
		}
		
		// box corner in ellipse: return true		
		x1 = (x1 - centerX) / (width + padding);
		x2 = (x2 - centerX) / (width + padding);
		
		y1 = (y1 - centerY) / (height + padding);
		y2 = (y2 - centerY) / (height + padding);
		
		if (x1 * x1 + y1 * y1 <= 1) {
			return true;
		}
		
		if (x2 * x2 + y1 * y1 <= 1) {
			return true;
		}
		
		if (x2 * x2 + y2 * y2 <= 1) {
			return true;
		}
		
		if (x1 * x1 + y2 * y2 <= 1) {
			return true;
		}
		
		return false;
	}
	
	CanvasRenderer.prototype.boxIntersectPolygon = function(
		x1, y1, x2, y2, basePoints, width, height, centerX, centerY, direction, padding) {
		
//		console.log(arguments);
		
		if (x2 < x1) {
			var oldX1 = x1;
			x1 = x2;
			x2 = oldX1;
		}
		
		if (y2 < y1) {
			var oldY1 = y1;
			y1 = y2;
			y2 = oldY1;
		}
		
		var transformedPoints = new Array(basePoints.length)
		
		// Gives negative of angle
		var angle = Math.asin(direction[1] / (Math.sqrt(direction[0] * direction[0] 
			+ direction[1] * direction[1])));
		
		if (direction[0] < 0) {
			angle = angle + Math.PI / 2;
		} else {
			angle = -angle - Math.PI / 2;
		}
		
		var cos = Math.cos(-angle);
		var sin = Math.sin(-angle);
		
		for (var i = 0; i < transformedPoints.length / 2; i++) {
			transformedPoints[i * 2] = 
				width * (basePoints[i * 2] * cos
					- basePoints[i * 2 + 1] * sin);
			
			transformedPoints[i * 2 + 1] = 
				height * (basePoints[i * 2 + 1] * cos 
					+ basePoints[i * 2] * sin);
			
			transformedPoints[i * 2] += centerX;
			transformedPoints[i * 2 + 1] += centerY;
		}
		
		var points;
		
		if (padding > 0) {
			var expandedLineSet = renderer.expandPolygon(
				transformedPoints,
				-padding);
			
			points = renderer.joinLines(expandedLineSet);
		} else {
			points = transformedPoints;
		}
		
		// Check if a point is in box
		for (var i = 0; i < transformedPoints.length / 2; i++) {
			if (x1 <= transformedPoints[i * 2]
					&& transformedPoints[i * 2] <= x2) {
				
				if (y1 <= transformedPoints[i * 2 + 1]
						&& transformedPoints[i * 2 + 1] <= y2) {
					
					return true;
				}
			}
		}
		
		// Check if box corner in the polygon
		if (renderer.pointInsidePolygon(
			x1, y1, points, 0, 0, 1, 1, 0, direction)) {
			
			return true;
		} else if (renderer.pointInsidePolygon(
			x1, y2, points, 0, 0, 1, 1, 0, direction)) {
			
			return true;
		} else if (renderer.pointInsidePolygon(
			x2, y2, points, 0, 0, 1, 1, 0, direction)) {
			
			return true;
		} else if (renderer.pointInsidePolygon(
			x2, y1, points, 0, 0, 1, 1, 0, direction)) {
			
			return true;
		}
		
		return false;
	}
	
	CanvasRenderer.prototype.polygonIntersectLine = function(
		x, y, basePoints, centerX, centerY, width, height, padding) {
		
		var intersections = [];
		var intersection;
		
		var transformedPoints = new Array(basePoints.length);
		
		for (var i = 0; i < transformedPoints.length / 2; i++) {
			transformedPoints[i * 2] = basePoints[i * 2] * width + centerX;
			transformedPoints[i * 2 + 1] = basePoints[i * 2 + 1] * height + centerY;
		}
		
		var points;
		
		if (padding > 0) {
			var expandedLineSet = renderer.expandPolygon(
				transformedPoints,
				-padding);
			
			points = renderer.joinLines(expandedLineSet);
		} else {
			points = transformedPoints;
		}
		// var points = transformedPoints;
		
		var currentX, currentY, nextX, nextY;
		
		for (var i = 0; i < points.length / 2; i++) {
		
			currentX = points[i * 2];
			currentY = points[i * 2 + 1];

			if (i < points.length / 2 - 1) {
				nextX = points[(i + 1) * 2];
				nextY = points[(i + 1) * 2 + 1];
			} else {
				nextX = points[0]; 
				nextY = points[1];
			}
			
			intersection = this.finiteLinesIntersect(
				x, y, centerX, centerY,
				currentX, currentY,
				nextX, nextY);
			
			if (intersection.length != 0) {
				intersections.push(intersection[0], intersection[1]);
			}
		}
		
		return intersections;
	}
	
	CanvasRenderer.prototype.shortenIntersection = function(
		intersection, offset, amount) {
		
		var disp = [intersection[0] - offset[0], intersection[1] - offset[1]];
		
		var length = Math.sqrt(disp[0] * disp[0] + disp[1] * disp[1]);
		
		var lenRatio = (length - amount) / length;
		
		if (lenRatio < 0) {
			return [];
		} else {
			return [offset[0] + lenRatio * disp[0], offset[1] + lenRatio * disp[1]];
		}
	}
	}
	
	// @O Arrow shapes
	{
	// Contract for arrow shapes:
	{
	// 0, 0 is arrow tip
	// (0, 1) is direction towards node
	// (1, 0) is right
	//
	// functional api:
	// collide: check x, y in shape
	// roughCollide: called before collide, no false negatives
	// draw: draw
	// spacing: dist(arrowTip, nodeBoundary)
	// gap: dist(edgeTip, nodeBoundary), edgeTip may != arrowTip
	}
	
	// Declarations
	{
	arrowShapes["arrow"] = {
		_points: [
			-0.15, -0.3,
			0, 0,
			0.15, -0.3
		],
		collide: function(x, y, centerX, centerY, width, height, direction, padding) {
			var points = arrowShapes["arrow"]._points;
			
//			console.log("collide(): " + direction);
			
			return rendFunc.pointInsidePolygon(
				x, y, points, centerX, centerY, width, height, direction, padding);
		},
		roughCollide: function(x, y, centerX, centerY, width, height, direction, padding) {
			if (typeof(arrowShapes["arrow"]._farthestPointSqDistance) == "undefined") {
				arrowShapes["arrow"]._farthestPointSqDistance = 
					rendFunc.findMaxSqDistanceToOrigin(arrowShapes["arrow"]._points);
			}
		
			return rendFunc.checkInBoundingCircle(
				x, y, arrowShapes["arrow"]._farthestPointSqDistance,
				0, width, height, centerX, centerY);
		},
		draw: function(context) {
			var points = arrowShapes["arrow"]._points;
		
			for (var i = 0; i < points.length / 2; i++) {
				context.lineTo(points[i * 2], points[i * 2 + 1]);
			}
		},
		spacing: function(edge) {
			return 0;
		},
		gap: function(edge) {
			return edge._private.style["width"].value * 2;
		}
	}
	
	arrowShapes["triangle"] = arrowShapes["arrow"];
	
	arrowShapes["none"] = {
		collide: function(x, y, centerX, centerY, width, height, direction, padding) {
			return false;
		},
		roughCollide: function(x, y, centerX, centerY, width, height, direction, padding) {
			return false;
		},
		draw: function(context) {
		},
		spacing: function(edge) {
			return 0;
		},
		gap: function(edge) {
			return 0;
		}
	}
	
	arrowShapes["circle"] = {
		_baseRadius: 0.15,
		
		collide: function(x, y, centerX, centerY, width, height, direction, padding) {
			// Transform x, y to get non-rotated ellipse
			
			if (width != height) {
				// This gives negative of the angle
				var angle = Math.asin(direction[1] / 
					(Math.sqrt(direction[0] * direction[0] 
						+ direction[1] * direction[1])));
			
				var cos = Math.cos(-angle);
				var sin = Math.sin(-angle);
				
				var rotatedPoint = 
					[x * cos - y * sin,
						y * cos + x * sin];
				
				var aspectRatio = (height + padding) / (width + padding);
				y /= aspectRatio;
				centerY /= aspectRatio;
				
				return (Math.pow(centerX - x, 2) 
					+ Math.pow(centerY - y, 2) <= Math.pow((width + padding)
						* arrowShapes["circle"]._baseRadius, 2));
			} else {
				return (Math.pow(centerX - x, 2) 
					+ Math.pow(centerY - y, 2) <= Math.pow((width + padding)
						* arrowShapes["circle"]._baseRadius, 2));
			}
		},
		roughCollide: function(x, y, centerX, centerY, width, height, direction, padding) {
			return true;
		},
		draw: function(context) {
			context.arc(0, 0, arrowShapes["circle"]._baseRadius, 0, Math.PI * 2, false);
		},
		spacing: function(edge) {
			return rendFunc.getArrowWidth(edge._private.style["width"].value)
				* arrowShapes["circle"]._baseRadius;
		},
		gap: function(edge) {
			return edge._private.style["width"].value * 2;
		}
	}
	
	arrowShapes["inhibitor"] = {
		_points: [
			-0.25, 0,
			-0.25, -0.1,
			0.25, -0.1,
			0.25, 0
		],
		collide: function(x, y, centerX, centerY, width, height, direction, padding) {
			var points = arrowShapes["inhibitor"]._points;
			
			return rendFunc.pointInsidePolygon(
				x, y, points, centerX, centerY, width, height, direction, padding);
		},
		roughCollide: function(x, y, centerX, centerY, width, height, direction, padding) {
			if (typeof(arrowShapes["inhibitor"]._farthestPointSqDistance) == "undefined") {
				arrowShapes["inhibitor"]._farthestPointSqDistance = 
					rendFunc.findMaxSqDistanceToOrigin(arrowShapes["inhibitor"]._points);
			}
		
			return rendFunc.checkInBoundingCircle(
				x, y, arrowShapes["inhibitor"]._farthestPointSqDistance,
				0, width, height, centerX, centerY);
		},
		draw: function(context) {
			var points = arrowShapes["inhibitor"]._points;
			
			for (var i = 0; i < points.length / 2; i++) {
				context.lineTo(points[i * 2], points[i * 2 + 1]);
			}
		},
		spacing: function(edge) {
			return 4;
		},
		gap: function(edge) {
			return 4;
		}
	}
	
	arrowShapes["square"] = {
		_points: [
			-0.12, 0.00,
			0.12, 0.00,
			0.12, -0.24,
			-0.12, -0.24
		],
		collide: function(x, y, centerX, centerY, width, height, direction, padding) {
			var points = arrowShapes["square"]._points;
			
			return rendFunc.pointInsidePolygon(
				x, y, points, centerX, centerY, width, height, direction, padding);
		},
		roughCollide: function(x, y, centerX, centerY, width, height, direction, padding) {
			if (typeof(arrowShapes["square"]._farthestPointSqDistance) == "undefined") {
				arrowShapes["square"]._farthestPointSqDistance = 
					rendFunc.findMaxSqDistanceToOrigin(arrowShapes["square"]._points);
			}
		
			return rendFunc.checkInBoundingCircle(
				x, y, arrowShapes["square"]._farthestPointSqDistance,
				0, width, height, centerX, centerY);
		},
		draw: function(context) {
			var points = arrowShapes["square"]._points;
		
			for (var i = 0; i < points.length / 2; i++) {
				context.lineTo(points[i * 2], points[i * 2 + 1]);
			}
		},
		spacing: function(edge) {
			return 0;
		},
		gap: function(edge) {
			return edge._private.style["width"].value * 2;
		}
	}
	
	arrowShapes["diamond"] = {
		_points: [
			-0.14, -0.14,
			0, -0.28,
			0.14, -0.14,
			0, 0
		],
		collide: function(x, y, centerX, centerY, width, height, direction, padding) {
			var points = arrowShapes["diamond"]._points;
					
			return rendFunc.pointInsidePolygon(
				x, y, points, centerX, centerY, width, height, direction, padding);
		},
		roughCollide: function(x, y, centerX, centerY, width, height, direction, padding) {
			if (typeof(arrowShapes["diamond"]._farthestPointSqDistance) == "undefined") {
				arrowShapes["diamond"]._farthestPointSqDistance = 
					rendFunc.findMaxSqDistanceToOrigin(arrowShapes["diamond"]._points);
			}
				
			return rendFunc.checkInBoundingCircle(
				x, y, arrowShapes["diamond"]._farthestPointSqDistance,
				0, width, height, centerX, centerY);
		},
		draw: function(context) {
//			context.translate(0, 0.16);
			context.lineTo(-0.14, -0.14);
			context.lineTo(0, -0.28);
			context.lineTo(0.14, -0.14);
			context.lineTo(0, 0.0);
		},
		spacing: function(edge) {
			return 0;
		},
		gap: function(edge) {
			return edge._private.style["width"].value * 2;
		}
	}
	
	arrowShapes["tee"] = arrowShapes["inhibitor"];
	}
	
	// @O Arrow shape sizing (w + l)
	{
	
	CanvasRenderer.prototype.getArrowWidth = function(edgeWidth) {
		return Math.max(Math.pow(edgeWidth * 13.37, 0.9), 29);
	}
	
	CanvasRenderer.prototype.getArrowHeight = function(edgeWidth) {
		return Math.max(Math.pow(edgeWidth * 13.37, 0.9), 29);
	}
	
	}
	
	// @O Arrow shape drawing
	
	// Draw arrowheads on edge
	CanvasRenderer.prototype.drawArrowheads = function(context, edge) {
		// Displacement gives direction for arrowhead orientation
		var dispX, dispY;

		var startX = edge._private.rscratch.arrowStartX;
		var startY = edge._private.rscratch.arrowStartY;
		
		dispX = startX - edge.source().position().x;
		dispY = startY - edge.source().position().y;
		
		//this.context.strokeStyle = "rgba("
		context.fillStyle = "rgba("
			+ edge._private.style["source-arrow-color"].value[0] + ","
			+ edge._private.style["source-arrow-color"].value[1] + ","
			+ edge._private.style["source-arrow-color"].value[2] + ","
			+ edge._private.style.opacity.value + ")";
		
		context.lineWidth = edge._private.style["width"].value;
		
		this.drawArrowShape(context, edge._private.style["source-arrow-shape"].value, 
			startX, startY, dispX, dispY);
		
		var endX = edge._private.rscratch.arrowEndX;
		var endY = edge._private.rscratch.arrowEndY;
		
		dispX = endX - edge.target().position().x;
		dispY = endY - edge.target().position().y;
		
		//this.context.strokeStyle = "rgba("
		context.fillStyle = "rgba("
			+ edge._private.style["target-arrow-color"].value[0] + ","
			+ edge._private.style["target-arrow-color"].value[1] + ","
			+ edge._private.style["target-arrow-color"].value[2] + ","
			+ edge._private.style.opacity.value + ")";
		
		context.lineWidth = edge._private.style["width"].value;
		
		this.drawArrowShape(context, edge._private.style["target-arrow-shape"].value,
			endX, endY, dispX, dispY);
	}
	
	// Draw arrowshape
	CanvasRenderer.prototype.drawArrowShape = function(context, shape, x, y, dispX, dispY) {
	
		// Negative of the angle
		var angle = Math.asin(dispY / (Math.sqrt(dispX * dispX + dispY * dispY)));
	
		if (dispX < 0) {
			//context.strokeStyle = "AA99AA";
			angle = angle + Math.PI / 2;
		} else {
			//context.strokeStyle = "AAAA99";
			angle = - (Math.PI / 2 + angle);
		}
		
		context.save();
		
		context.translate(x, y);
		
		context.moveTo(0, 0);
		context.rotate(-angle);
		
		var size = this.getArrowWidth(context.lineWidth);
		/// size = 100;
		context.scale(size, size);
		
		context.beginPath();
		
		arrowShapes[shape].draw(context);
		
		context.closePath();
		
//		context.stroke();
		context.fill();
		context.restore();
	}
	}
	
	// @O Node shapes
	{
	
	// Generate polygon points
	var generateUnitNgonPoints = function(sides, rotationRadians) {
		
		var increment = 1.0 / sides * 2 * Math.PI;
		var startAngle = sides % 2 == 0 ? 
			Math.PI / 2.0 + increment / 2.0 : Math.PI / 2.0;
//		console.log(nodeShapes["square"]);
		startAngle += rotationRadians;
		
		var points = new Array(sides * 2);
		
		var currentAngle;
		for (var i = 0; i < sides; i++) {
			currentAngle = i * increment + startAngle;
			
			points[2 * i] = Math.cos(currentAngle);// * (1 + i/2);
			points[2 * i + 1] = Math.sin(-currentAngle);//  * (1 + i/2);
		}
		
		return points;
	}
	
	// Node shape declarations
	
	// Contract for node shapes:
	{
	// Node shape contract:
	//
	// draw: draw
	// intersectLine: report intersection from x, y, to node center
	// checkPointRough: heuristic check x, y in node, no false negatives
	// checkPoint: check x, y in node
	}
	
	// Declarations
	{
	
	var renderer = rendFunc;	
	
	nodeShapes["ellipse"] = {
		draw: function(context, centerX, centerY, width, height) {
			nodeShapes["ellipse"].drawPath(context, centerX, centerY, width, height);
			context.fill();
			
//			console.log("drawing ellipse");
//			console.log(arguments);
		},
		
		drawPath: function(context, centerX, centerY, width, height) {
			context.beginPath();
			context.save();
			context.translate(centerX, centerY);
			context.scale(width / 2, height / 2);
			// At origin, radius 1, 0 to 2pi
			context.arc(0, 0, 1, 0, Math.PI * 2, false);
			context.closePath();
			context.restore();
			
//			console.log("drawing ellipse");
//			console.log(arguments);
			
		},
		
		intersectLine: function(nodeX, nodeY, width, height, x, y, padding) {
			var intersect = rendFunc.intersectLineEllipse(
				x, y,
				nodeX,
				nodeY,
				width / 2 + padding,
				height / 2 + padding);
			
			return intersect;
		},
		
		intersectBox: function(
			x1, y1, x2, y2, width, height, centerX, centerY, padding) {
			
			return CanvasRenderer.prototype.boxIntersectEllipse(
				x1, y1, x2, y2, padding, width, height, centerX, centerY);
		},
		
		checkPointRough: function(
			x, y, padding, width, height, centerX, centerY) {
		
			return true;
		},
		
		checkPoint: function(
			x, y, padding, width, height, centerX, centerY) {
			
//			console.log(arguments);
			
			x -= centerX;
			y -= centerY;
			
			x /= (width + padding);
			y /= (height + padding);
			
			return (Math.pow(x, 2) + Math.pow(y, 2) <= 1);
		}
	}
	
	nodeShapes["triangle"] = {
		points: generateUnitNgonPoints(3, 0),
		
		draw: function(context, centerX, centerY, width, height) {
			renderer.drawPolygon(context,
				centerX, centerY,
				width, height,
				nodeShapes["triangle"].points);
		},
		
		drawPath: function(context, centerX, centerY, width, height) {
			renderer.drawPolygonPath(context,
				centerX, centerY,
				width, height,
				nodeShapes["triangle"].points);
		},
		
		intersectLine: function(nodeX, nodeY, width, height, x, y, padding) {
			return renderer.polygonIntersectLine(
				x, y,
				nodeShapes["triangle"].points,
				nodeX,
				nodeY,
				width / 2, height / 2,
				padding);
		
			/*
			polygonIntersectLine(x, y, basePoints, centerX, centerY, 
				width, height, padding);
			*/
			
			
			/*
			return renderer.polygonIntersectLine(
				node, width, height,
				x, y, nodeShapes["triangle"].points);
			*/
		},
		
		intersectBox: function(
			x1, y1, x2, y2, width, height, centerX, centerY, padding) {
			
			var points = nodeShapes["triangle"].points;
			
			return renderer.boxIntersectPolygon(
				x1, y1, x2, y2,
				points, width, height, centerX, centerY, [0, -1], padding);
		},
		
		checkPointRough: function(
			x, y, padding, width, height, centerX, centerY) {
		
			return renderer.checkInBoundingBox(
				x, y, nodeShapes["triangle"].points, // Triangle?
					padding, width, height, centerX, centerY);
		},
		
		checkPoint: function(
			x, y, padding, width, height, centerX, centerY) {
			
			return renderer.pointInsidePolygon(
				x, y, nodeShapes["triangle"].points,
				centerX, centerY, width, height,
				[0, -1], padding);
		}
	}
	
	nodeShapes["square"] = {
		points: generateUnitNgonPoints(4, 0),
		
		draw: function(context, centerX, centerY, width, height) {
			renderer.drawPolygon(context,
				centerX, centerY,
				width, height,
				nodeShapes["square"].points);
		},
		
		drawPath: function(context, centerX, centerY, width, height) {
			renderer.drawPolygonPath(context,
				centerX, centerY,
				width, height,
				nodeShapes["square"].points);
		},
		
		intersectLine: function(nodeX, nodeY, width, height, x, y, padding) {
			return renderer.polygonIntersectLine(
					x, y,
					nodeShapes["square"].points,
					nodeX,
					nodeY,
					width / 2, height / 2,
					padding);
		},
		
		intersectBox: function(
			x1, y1, x2, y2,
			width, height, centerX, 
			centerY, padding) {
			
			var points = nodeShapes["square"].points;
			
			return renderer.boxIntersectPolygon(
				x1, y1, x2, y2,
				points, width, height, centerX, 
				centerY, [0, -1], padding);
		},
		
		checkPointRough: function(
			x, y, padding, width, height,
			centerX, centerY) {
		
			return renderer.checkInBoundingBox(
				x, y, nodeShapes["square"].points, 
					padding, width, height, centerX, centerY);
		},
		
		checkPoint: function(
			x, y, padding, width, height, centerX, centerY) {
			
			return renderer.pointInsidePolygon(x, y, nodeShapes["square"].points,
				centerX, centerY, width, height, [0, -1], padding);
		}
	}
	
	nodeShapes["rectangle"] = nodeShapes["square"];
	
	nodeShapes["octogon"] = {};
	
	nodeShapes["roundrectangle"] = nodeShapes["square"];
	
	nodeShapes["roundrectangle2"] = {
		roundness: 4.99,
		
		draw: function(node, width, height) {
			if (width <= roundness * 2) {
				return;
			}
		
			renderer.drawPolygon(node._private.position.x,
				node._private.position.y, width, height, nodeSapes["roundrectangle2"].points);
		},

		intersectLine: function(node, width, height, x, y) {
			return renderer.findPolygonIntersection(
				node, width, height, x, y, nodeShapes["square"].points);
		},
		
		// TODO: Treat rectangle as sharp-cornered for now. This is a not-large approximation.
		intersectBox: function(x1, y1, x2, y2, width, height, centerX, centerY, padding) {
			var points = nodeShapes["square"].points;
			
			/*
			return renderer.boxIntersectPolygon(
				x1, y1, x2, y2,
				points, 
			*/
		}	
	}
	
	/*
	function PolygonNodeShape(points) {
		this.points = points;
		
		this.draw = function(context, node, width, height) {
			renderer.drawPolygon(context,
					node._private.position.x,
					node._private.position.y,
					width, height, nodeShapes["pentagon"].points);
		};
		
		this.drawPath = 
	}
	*/
	
	nodeShapes["pentagon"] = {
		points: generateUnitNgonPoints(5, 0),
		
		draw: function(context, centerX, centerY, width, height) {
			renderer.drawPolygon(context,
				centerX, centerY,
				width, height, nodeShapes["pentagon"].points);
		},
		
		drawPath: function(context, centerX, centerY, width, height) {
			renderer.drawPolygonPath(context,
				centerX, centerY,
				width, height, nodeShapes["pentagon"].points);
		},
		
		intersectLine: function(nodeX, nodeY, width, height, x, y, padding) {
			return renderer.polygonIntersectLine(
				x, y,
				nodeShapes["pentagon"].points,
				nodeX,
				nodeY,
				width / 2, height / 2,
				padding);
		},
		
		intersectBox: function(
			x1, y1, x2, y2, width, height, centerX, centerY, padding) {
			
			var points = nodeShapes["pentagon"].points;
			
			return renderer.boxIntersectPolygon(
				x1, y1, x2, y2,
				points, width, height, centerX, centerY, [0, -1], padding);
		},
		
		checkPointRough: function(
			x, y, padding, width, height, centerX, centerY) {
		
			return renderer.checkInBoundingBox(
				x, y, nodeShapes["pentagon"].points, 
					padding, width, height, centerX, centerY);
		},
		
		checkPoint: function(
			x, y, padding, width, height, centerX, centerY) {
			
			return renderer.pointInsidePolygon(x, y, nodeShapes["pentagon"].points,
				centerX, centerY, width, height, [0, -1], padding);
		}
	}
	
	nodeShapes["hexagon"] = {
		points: generateUnitNgonPoints(6, 0),
		
		draw: function(context, centerX, centerY, width, height) {
			renderer.drawPolygon(context,
				centerX, centerY,
				width, height,
				nodeShapes["hexagon"].points);
		},
		
		drawPath: function(context, centerX, centerY, width, height) {
			renderer.drawPolygonPath(context,
				centerX, centerY,
				width, height,
				nodeShapes["hexagon"].points);
		},
		
		intersectLine: function(nodeX, nodeY, width, height, x, y, padding) {
			return renderer.polygonIntersectLine(
				x, y,
				nodeShapes["hexagon"].points,
				nodeX,
				nodeY,
				width / 2, height / 2,
				padding);
		},
		
		intersectBox: function(
				x1, y1, x2, y2, width, height, centerX, centerY, padding) {
				
			var points = nodeShapes["hexagon"].points;
			
			return renderer.boxIntersectPolygon(
				x1, y1, x2, y2,
				points, width, height, centerX, centerY, [0, -1], padding);
		},
		
		checkPointRough: function(
			x, y, padding, width, height, centerX, centerY) {
		
			return renderer.checkInBoundingBox(
				x, y, nodeShapes["hexagon"].points, 
					padding, width, height, centerX, centerY);
		},
		
		checkPoint: function(
			x, y, padding, width, height, centerX, centerY) {
			
			return renderer.pointInsidePolygon(x, y, nodeShapes["hexagon"].points,
				centerX, centerY, width, height, [0, -1], padding);
		}
	}
	
	nodeShapes["heptagon"] = {
		points: generateUnitNgonPoints(7, 0),
		
		draw: function(context, centerX, centerY, width, height) {
			renderer.drawPolygon(context,
				centerX, centerY,
				width, height,
				nodeShapes["heptagon"].points);
		},
		
		drawPath: function(context, centerX, centerY, width, height) {
			renderer.drawPolygonPath(context,
				centerX, centerY,
				width, height,
				nodeShapes["heptagon"].points);
		},
		
		intersectLine: function(nodeX, nodeY, width, height, x, y, padding) {
			return renderer.polygonIntersectLine(
				x, y,
				nodeShapes["heptagon"].points,
				nodeX,
				nodeY,
				width / 2, height / 2,
				padding);
		},
		
		intersectBox: function(
				x1, y1, x2, y2, width, height, centerX, centerY, padding) {
			
			var points = nodeShapes["heptagon"].points;
			
			return renderer.boxIntersectPolygon(
				x1, y1, x2, y2,
				points, width, height, centerX, centerY, [0, -1], padding);
		},
		
		checkPointRough: function(
			x, y, padding, width, height, centerX, centerY) {
		
			return renderer.checkInBoundingBox(
				x, y, nodeShapes["heptagon"].points, 
					padding, width, height, centerX, centerY);
		},
		
		checkPoint: function(
			x, y, padding, width, height, centerX, centerY) {
			
			return renderer.pointInsidePolygon(x, y, nodeShapes["heptagon"].points,
				centerX, centerY, width, height, [0, -1], padding);
		}
	}
	
	nodeShapes["octagon"] = {
		points: generateUnitNgonPoints(8, 0),
		
		draw: function(context, centerX, centerY, width, height) {
			renderer.drawPolygon(context,
				centerX, centerY,
				width, height,
				nodeShapes["octagon"].points);
		},
		
		drawPath: function(context, centerX, centerY, width, height) {
			renderer.drawPolygonPath(context,
				centerX, centerY,
				width, height,
				nodeShapes["octagon"].points);
		},
		
		intersectLine: function(nodeX, nodeY, width, height, x, y, padding) {
			return renderer.polygonIntersectLine(
				x, y,
				nodeShapes["octagon"].points,
				nodeX,
				nodeY,
				width / 2, height / 2,
				padding);
		},
		
		intersectBox: function(
				x1, y1, x2, y2, width, height, centerX, centerY, padding) {
			
			var points = nodeShapes["octagon"].points;
			
			return renderer.boxIntersectPolygon(
					x1, y1, x2, y2,
					points, width, height, centerX, centerY, [0, -1], padding);
		},
		
		checkPointRough: function(
			x, y, padding, width, height, centerX, centerY) {
		
			return renderer.checkInBoundingBox(
				x, y, nodeShapes["octagon"].points, 
					padding, width, height, centerX, centerY);
		},
		
		checkPoint: function(
			x, y, padding, width, height, centerX, centerY) {
			
			return renderer.pointInsidePolygon(x, y, nodeShapes["octagon"].points,
				centerX, centerY, width, height, [0, -1], padding);
		}
	};
	
	var star5Points = new Array(20);
	{
		var outerPoints = generateUnitNgonPoints(5, 0);
		var innerPoints = generateUnitNgonPoints(5, Math.PI / 5);
		
//		console.log(outerPoints);
//		console.log(innerPoints);
		
		// Outer radius is 1; inner radius of star is smaller
		var innerRadius = 0.5 * (3 - Math.sqrt(5));
		innerRadius *= 1.57;
		
		for (var i=0;i<innerPoints.length/2;i++) {
			innerPoints[i*2] *= innerRadius;
			innerPoints[i*2+1] *= innerRadius;
		}
		
		for (var i=0;i<20/4;i++) {
			star5Points[i*4] = outerPoints[i*2];
			star5Points[i*4+1] = outerPoints[i*2+1];
			
			star5Points[i*4+2] = innerPoints[i*2];
			star5Points[i*4+3] = innerPoints[i*2+1];
		}
		
//		console.log(star5Points);
	}
	
	nodeShapes["star5"] = {
		points: star5Points,
		
		draw: function(context, centerX, centerY, width, height) {
			renderer.drawPolygon(context,
				centerX, centerY,
				width, height,
				nodeShapes["star5"].points);
		},
		
		drawPath: function(context, centerX, centerY, width, height) {
			renderer.drawPolygonPath(context,
				centerX, centerY,
				width, height,
				nodeShapes["star5"].points);
		},
		
		intersectLine: function(nodeX, nodeY, width, height, x, y, padding) {
			return renderer.polygonIntersectLine(
				x, y,
				nodeShapes["star5"].points,
				nodeX,
				nodeY,
				width / 2, height / 2,
				padding);
		},
		
		intersectBox: function(
				x1, y1, x2, y2, width, height, centerX, centerY, padding) {
			
			var points = nodeShapes["star5"].points;
			
			return renderer.boxIntersectPolygon(
					x1, y1, x2, y2,
					points, width, height, centerX, centerY, [0, -1], padding);
		},
		
		checkPointRough: function(
			x, y, padding, width, height, centerX, centerY) {
		
			return renderer.checkInBoundingBox(
				x, y, nodeShapes["star5"].points, 
					padding, width, height, centerX, centerY);
		},
		
		checkPoint: function(
			x, y, padding, width, height, centerX, centerY) {
			
			return renderer.pointInsidePolygon(x, y, nodeShapes["star5"].points,
				centerX, centerY, width, height, [0, -1], padding);
		}
	};
	
	}

	}
	
	// @O Polygon calculations
	{
	CanvasRenderer.prototype.expandPolygon = function(points, pad) {
		
		var expandedLineSet = new Array(points.length * 2);
		
		var currentPointX, currentPointY, nextPointX, nextPointY;
		
		for (var i = 0; i < points.length / 2; i++) {
			currentPointX = points[i * 2];
			currentPointY = points[i * 2 + 1];
			
			if (i < points.length / 2 - 1) {
				nextPointX = points[(i + 1) * 2];
				nextPointY = points[(i + 1) * 2 + 1];
			} else {
				nextPointX = points[0];
				nextPointY = points[1];
			}
			
			// Current line: [currentPointX, currentPointY] to [nextPointX, nextPointY]
			
			// Assume CCW polygon winding
			
			var offsetX = (nextPointY - currentPointY);
			var offsetY = -(nextPointX - currentPointX);
			
			// Normalize
			var offsetLength = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
			var normalizedOffsetX = offsetX / offsetLength;
			var normalizedOffsetY = offsetY / offsetLength;
			
			expandedLineSet[i * 4] = currentPointX + normalizedOffsetX * pad;
			expandedLineSet[i * 4 + 1] = currentPointY + normalizedOffsetY * pad;
			expandedLineSet[i * 4 + 2] = nextPointX + normalizedOffsetX * pad;
			expandedLineSet[i * 4 + 3] = nextPointY + normalizedOffsetY * pad;
		}
		
		return expandedLineSet;
	}
	
	CanvasRenderer.prototype.joinLines = function(lineSet) {
		
		var vertices = new Array(lineSet.length / 2);
		
		var currentLineStartX, currentLineStartY, currentLineEndX, currentLineEndY;
		var nextLineStartX, nextLineStartY, nextLineEndX, nextLineEndY;
		
		for (var i = 0; i < lineSet.length / 4; i++) {
			currentLineStartX = lineSet[i * 4];
			currentLineStartY = lineSet[i * 4 + 1];
			currentLineEndX = lineSet[i * 4 + 2];
			currentLineEndY = lineSet[i * 4 + 3];
			
			if (i < lineSet.length / 4 - 1) {
				nextLineStartX = lineSet[(i + 1) * 4];
				nextLineStartY = lineSet[(i + 1) * 4 + 1];
				nextLineEndX = lineSet[(i + 1) * 4 + 2];
				nextLineEndY = lineSet[(i + 1) * 4 + 3];
			} else {
				nextLineStartX = lineSet[0];
				nextLineStartY = lineSet[1];
				nextLineEndX = lineSet[2];
				nextLineEndY = lineSet[3];
			}
			
			var intersection = this.finiteLinesIntersect(
				currentLineStartX, currentLineStartY,
				currentLineEndX, currentLineEndY,
				nextLineStartX, nextLineStartY,
				nextLineEndX, nextLineEndY,
				true);
			
			vertices[i * 2] = intersection[0];
			vertices[i * 2 + 1] = intersection[1];
		}
		
		return vertices;
	}
	
	CanvasRenderer.prototype.pointInsidePolygon = function(
		x, y, basePoints, centerX, centerY, width, height, direction, padding) {

		//var direction = arguments[6];
		var transformedPoints = new Array(basePoints.length)

		// Gives negative angle
		var angle = Math.asin(direction[1] / (Math.sqrt(direction[0] * direction[0] 
			+ direction[1] * direction[1])));
		
		if (direction[0] < 0) {
			angle = angle + Math.PI / 2;
		} else {
			angle = -angle - Math.PI / 2;
		}
				
		var cos = Math.cos(-angle);
		var sin = Math.sin(-angle);
		
//		console.log("base: " + basePoints);
		for (var i = 0; i < transformedPoints.length / 2; i++) {
			transformedPoints[i * 2] = 
				width * (basePoints[i * 2] * cos
					- basePoints[i * 2 + 1] * sin);
			
			transformedPoints[i * 2 + 1] = 
				height * (basePoints[i * 2 + 1] * cos 
					+ basePoints[i * 2] * sin);

			transformedPoints[i * 2] += centerX;
			transformedPoints[i * 2 + 1] += centerY;
		}
		
		var points;
		
		if (padding > 0) {
			var expandedLineSet = renderer.expandPolygon(
				transformedPoints,
				-padding);
			
			points = renderer.joinLines(expandedLineSet);
		} else {
			points = transformedPoints;
		}
		
		var x1, y1, x2, y2;
		var y3;
		
		// Intersect with vertical line through (x, y)
		var up = 0;
		var down = 0;
		for (var i = 0; i < points.length / 2; i++) {
			
			x1 = points[i * 2];
			y1 = points[i * 2 + 1];
			
			if (i + 1 < points.length / 2) {
				x2 = points[(i + 1) * 2];
				y2 = points[(i + 1) * 2 + 1];
			} else {
				x2 = points[(i + 1 - points.length / 2) * 2];
				y2 = points[(i + 1 - points.length / 2) * 2 + 1];
			}
			
//*			console.log("line from (" + x1 + ", " + y1 + ") to (" + x2 + ", " + y2 + ")");

//&			console.log(x1, x, x2);

			if (x1 == x && x2 == x) {
				
			} else if ((x1 >= x && x >= x2)
				|| (x1 <= x && x <= x2)) {
				
				y3 = (x - x1) / (x2 - x1) * (y2 - y1) + y1;
				
				if (y3 > y) {
					up++;
				}
				
				if (y3 < y) {
					down++;
				}
				
//*				console.log(y3, y);
				
			} else {
//*				console.log("22");
				continue;
			}
			
		}
		
//*		console.log("up: " + up + ", down: " + down);
		
		if (up % 2 == 0) {
			return false;
		} else {
			return true;
		}
	}
	}
	
	// @O Polygon drawing
	CanvasRenderer.prototype.drawPolygonPath = function(
		context, x, y, width, height, points) {

		context.save();
		context.translate(x, y);
		context.beginPath();
		
		context.scale(width / 2, height / 2);
		context.moveTo(points[0], points[1]);
		
		for (var i = 1; i < points.length / 2; i++) {
			context.lineTo(points[i * 2], points[i * 2 + 1]);
		}
		
		context.closePath();
		context.restore();
	}
	
	CanvasRenderer.prototype.drawPolygon = function(
		context, x, y, width, height, points) {

		// Draw path
		this.drawPolygonPath(context, x, y, width, height, points);
		
		// Fill path
		context.fill();
	}
	
	// @O Approximate collision functions
	CanvasRenderer.prototype.checkInBoundingCircle = function(
		x, y, farthestPointSqDistance, padding, width, height, centerX, centerY) {
		
		x = (x - centerX) / (width + padding);
		y = (y - centerY) / (height + padding);
		
		return (x * x + y * y) <= farthestPointSqDistance;
	}
	
	CanvasRenderer.prototype.checkInBoundingBox = function(
		x, y, points, padding, width, height, centerX, centerY) {
		
		// Assumes width, height >= 0, points.length > 0
		
		var minX = points[0], minY = points[1];
		var maxX = points[0], maxY = points[1];
		
		for (var i = 1; i < points.length / 2; i++) {
			
			if (points[i * 2] < minX) {
				minX = points[i * 2];
			} else if (points[i * 2] > maxX) {
				maxX = points[i * 2];
			}
			
			if (points[i * 2 + 1] < minY) {
				minY = points[i * 2 + 1];
			} else if (points[i * 2 + 1] > maxY) {
				maxY = points[i * 2 + 1];
			}
		}
		
		x -= centerX;
		y -= centerY;
		
		x /= width;
		y /= height;
		
		if (x < minX) {
			return false;
		} else if (x > maxX) {
			return false;
		}
		
		if (y < minY) {
			return false;
		} else if (y > maxY) {
			return false;
		}
		
		return true;
	}
	
	// @O Straight/bezier edge approximate collision, precise collision, and distance calculation functions
	{
	CanvasRenderer.prototype.boxInBezierVicinity = function(
		x1box, y1box, x2box, y2box, x1, y1, x2, y2, x3, y3, tolerance) {
		
		// Return values:
		// 0 - curve is not in box
		// 1 - curve may be in box; needs precise check
		// 2 - curve is in box
		
		var boxMinX = Math.min(x1box, x2box) - tolerance;
		var boxMinY = Math.min(y1box, y2box) - tolerance;
		var boxMaxX = Math.max(x1box, x2box) + tolerance;
		var boxMaxY = Math.max(y1box, y2box) + tolerance;
		
		if (x1 >= boxMinX && x1 <= boxMaxX && y1 >= boxMinY && y1 <= boxMaxY) {
			return 2;
		} else if (x3 >= boxMinX && x3 <= boxMaxX && y3 >= boxMinY && y3 <= boxMaxY) {
			return 2;
		} else if (x2 >= boxMinX && x2 <= boxMaxX && y2 >= boxMinY && y2 <= boxMaxY) { 
			return 1;
		}
		
		var curveMinX = Math.min(x1, x2, x3);
		var curveMinY = Math.min(y1, y2, y3);
		var curveMaxX = Math.max(x1, x2, x3);
		var curveMaxY = Math.max(y1, y2, y3);
		
		/*
		console.log(curveMinX + ", " + curveMinY + ", " + curveMaxX 
			+ ", " + curveMaxY);
		if (curveMinX == undefined) {
			console.log("undefined curveMinX: " + x1 + ", " + x2 + ", " + x3);
		}
		*/
		
		if (curveMinX > boxMaxX
			|| curveMaxX < boxMinX
			|| curveMinY > boxMaxY
			|| curveMaxY < boxMinY) {
			
			return 0;	
		}
		
		return 1;
	}
	
	CanvasRenderer.prototype.checkStraightEdgeCrossesBox = function(
		x1box, y1box, x2box, y2box, x1, y1, x2, y2, tolerance) {
		
	 //console.log(arguments);
		
		var boxMinX = Math.min(x1box, x2box) - tolerance;
		var boxMinY = Math.min(y1box, y2box) - tolerance;
		var boxMaxX = Math.max(x1box, x2box) + tolerance;
		var boxMaxY = Math.max(y1box, y2box) + tolerance;
		
		// Check left + right bounds
		var aX = x2 - x1;
		var bX = x1;
		var yValue;
		
		// Top and bottom
		var aY = y2 - y1;
		var bY = y1;
		var xValue;
		
		if (Math.abs(aX) < 0.0001) {
			return (x1 >= boxMinX && x1 <= boxMaxX
				&& Math.min(y1, y2) <= boxMinY
				&& Math.max(y1, y2) >= boxMaxY);	
		}
		
		var tLeft = (boxMinX - bX) / aX;
		if (tLeft > 0 && tLeft <= 1) {
			yValue = aY * tLeft + bY;
			if (yValue >= boxMinY && yValue <= boxMaxY) {
				return true;
			} 
		}
		
		var tRight = (boxMaxX - bX) / aX;
		if (tRight > 0 && tRight <= 1) {
			yValue = aY * tRight + bY;
			if (yValue >= boxMinY && yValue <= boxMaxY) {
				return true;
			} 
		}
		
		var tTop = (boxMinY - bY) / aY;
		if (tTop > 0 && tTop <= 1) {
			xValue = aX * tTop + bX;
			if (xValue >= boxMinX && xValue <= boxMaxX) {
				return true;
			} 
		}
		
		var tBottom = (boxMaxY - bY) / aY;
		if (tBottom > 0 && tBottom <= 1) {
			xValue = aX * tBottom + bX;
			if (xValue >= boxMinX && xValue <= boxMaxX) {
				return true;
			} 
		}
		
		return false;
	}
	
	CanvasRenderer.prototype.checkBezierCrossesBox = function(
		x1box, y1box, x2box, y2box, x1, y1, x2, y2, x3, y3, tolerance) {
		
		var boxMinX = Math.min(x1box, x2box) - tolerance;
		var boxMinY = Math.min(y1box, y2box) - tolerance;
		var boxMaxX = Math.max(x1box, x2box) + tolerance;
		var boxMaxY = Math.max(y1box, y2box) + tolerance;
		
		if (x1 >= boxMinX && x1 <= boxMaxX && y1 >= boxMinY && y1 <= boxMaxY) {
			return true;
		} else if (x3 >= boxMinX && x3 <= boxMaxX && y3 >= boxMinY && y3 <= boxMaxY) {
			return true;
		}
		
		var aX = x1 - 2 * x2 + x3;
		var bX = -2 * x1 + 2 * x2;
		var cX = x1;

		var xIntervals = [];
		
		if (Math.abs(aX) < 0.0001) {
			var leftParam = (boxMinX - x1) / bX;
			var rightParam = (boxMaxX - x1) / bX;
			
			xIntervals.push(leftParam, rightParam);
		} else {
			// Find when x coordinate of the curve crosses the left side of the box
			var discriminantX1 = bX * bX - 4 * aX * (cX - boxMinX);
			var tX1, tX2;
			if (discriminantX1 > 0) {
				var sqrt = Math.sqrt(discriminantX1);
				tX1 = (-bX + sqrt) / (2 * aX);
				tX2 = (-bX - sqrt) / (2 * aX);
				
				xIntervals.push(tX1, tX2);
			}
			
			var discriminantX2 = bX * bX - 4 * aX * (cX - boxMaxX);
			var tX3, tX4;
			if (discriminantX2 > 0) {
				var sqrt = Math.sqrt(discriminantX2);
				tX3 = (-bX + sqrt) / (2 * aX);
				tX4 = (-bX - sqrt) / (2 * aX);
				
				xIntervals.push(tX3, tX4);
			}
		}
		
		xIntervals.sort(function(a, b) { return a - b; });
		
		var aY = y1 - 2 * y2 + y3;
		var bY = -2 * y1 + 2 * y2;
		var cY = y1;
		
		var yIntervals = [];
		
		if (Math.abs(aY) < 0.0001) {
			var topParam = (boxMinY - y1) / bY;
			var bottomParam = (boxMaxY - y1) / bY;
			
			yIntervals.push(topParam, bottomParam);
		} else {
			var discriminantY1 = bY * bY - 4 * aY * (cY - boxMinY);
			
			var tY1, tY2;
			if (discriminantY1 > 0) {
				var sqrt = Math.sqrt(discriminantY1);
				tY1 = (-bY + sqrt) / (2 * aY);
				tY2 = (-bY - sqrt) / (2 * aY);
				
				yIntervals.push(tY1, tY2);
			}
	
			var discriminantY2 = bY * bY - 4 * aY * (cY - boxMaxY);
			
			var tY3, tY4;
			if (discriminantY2 > 0) {
				var sqrt = Math.sqrt(discriminantY2);
				tY3 = (-bY + sqrt) / (2 * aY);
				tY4 = (-bY - sqrt) / (2 * aY);
				
				yIntervals.push(tY3, tY4);
			}
		}
				
		yIntervals.sort(function(a, b) { return a - b; });

		for (var index = 0; index < xIntervals.length; index += 2) {
			for (var yIndex = 1; yIndex < yIntervals.length; yIndex += 2) {
				
				// Check if there exists values for the Bezier curve
				// parameter between 0 and 1 where both the curve's
				// x and y coordinates are within the bounds specified by the box
				if (xIntervals[index] < yIntervals[yIndex]
					&& yIntervals[yIndex] >= 0.0
					&& xIntervals[index] <= 1.0
					&& xIntervals[index + 1] > yIntervals[yIndex - 1]
					&& yIntervals[yIndex - 1] <= 1.0
					&& xIntervals[index + 1] >= 0.0) {
					
					return true;
				}
			}
		}
		
		return false;
	}
	
	CanvasRenderer.prototype.inBezierVicinity = function(
		x, y, x1, y1, x2, y2, x3, y3, toleranceSquared) {
		
		// Middle point occurs when t = 0.5, this is when the Bezier
		// is closest to (x2, y2)
		var middlePointX = 0.25 * x1 + 0.5 * x2 + 0.25 * x3;
		var middlePointY = 0.25 * y1 + 0.5 * y2 + 0.25 * y3;
		
		var displacementX, displacementY, offsetX, offsetY;
		var dotProduct, dotSquared, hypSquared;
		var outside = function(x, y, startX, startY, endX, endY,
				toleranceSquared, counterClockwise) {

			dotProduct = (endY - startY) * (x - startX) + (startX - endX) * (y - startY);
			dotSquared = dotProduct * dotProduct;
			sideSquared = (endY - startY) * (endY - startY) 
				+ (startX - endX) * (startX - endX);

			if (counterClockwise) {
				if (dotProduct > 0) {
					return false;
				}
			} else {
				if (dotProduct < 0) {
					return false;
				}
			}
			
			return (dotSquared / sideSquared > toleranceSquared);
		};
		
		// Used to check if the test polygon winding is clockwise or counterclockwise
		var testPointX = (middlePointX + x2) / 2.0;
		var testPointY = (middlePointY + y2) / 2.0;
		
		var counterClockwise = true;
		
		// The test point is always inside
		if (outside(testPointX, testPointY, x1, y1, x2, y2, 0, counterClockwise)) {
			counterClockwise = !counterClockwise;
		}
		
		/*
		return (!outside(x, y, x1, y1, x2, y2, toleranceSquared, counterClockwise)
			&& !outside(x, y, x2, y2, x3, y3, toleranceSquared, counterClockwise)
			&& !outside(x, y, x3, y3, middlePointX, middlePointY, toleranceSquared,
				counterClockwise)
			&& !outside(x, y, middlePointX, middlePointY, x1, y1, toleranceSquared,
				counterClockwise)
		);
		*/
		
		return (!outside(x, y, x1, y1, x2, y2, toleranceSquared, counterClockwise)
			&& !outside(x, y, x2, y2, x3, y3, toleranceSquared, counterClockwise)
			&& !outside(x, y, x3, y3, x1, y1, toleranceSquared,
				counterClockwise)
		);
	}
	
	CanvasRenderer.prototype.solveCubic = function(a, b, c, d, result) {
		
		// Solves a cubic function, returns root in form [r1, i1, r2, i2, r3, i3], where
		// r is the real component, i is the imaginary component

		// An implementation of the Cardano method from the year 1545
		// http://en.wikipedia.org/wiki/Cubic_function#The_nature_of_the_roots

		b /= a;
		c /= a;
		d /= a;
		
		var discriminant, q, r, dum1, s, t, term1, r13;

		q = (3.0 * c - (b * b)) / 9.0;
		r = -(27.0 * d) + b * (9.0 * c - 2.0 * (b * b));
		r /= 54.0;
		
		discriminant = q * q * q + r * r;
		result[1] = 0;
		term1 = (b / 3.0);
		
		if (discriminant > 0) {
			s = r + Math.sqrt(discriminant);
			s = ((s < 0) ? -Math.pow(-s, (1.0 / 3.0)) : Math.pow(s, (1.0 / 3.0)));
			t = r - Math.sqrt(discriminant);
			t = ((t < 0) ? -Math.pow(-t, (1.0 / 3.0)) : Math.pow(t, (1.0 / 3.0)));
			result[0] = -term1 + s + t;
			term1 += (s + t) / 2.0;
			result[4] = result[2] = -term1;
			term1 = Math.sqrt(3.0) * (-t + s) / 2;
			result[3] = term1;
			result[5] = -term1;
			return;
		}
		
		result[5] = result[3] = 0;
		
		if (discriminant == 0) {
			r13 = ((r < 0) ? -Math.pow(-r, (1.0 / 3.0)) : Math.pow(r, (1.0 / 3.0)));
			result[0] = -term1 + 2.0 * r13;
			result[4] = result[2] = -(r13 + term1);
			return;
		}
		
		q = -q;
		dum1 = q * q * q;
		dum1 = Math.acos(r / Math.sqrt(dum1));
		r13 = 2.0 * Math.sqrt(q);
		result[0] = -term1 + r13 * Math.cos(dum1 / 3.0);
		result[2] = -term1 + r13 * Math.cos((dum1 + 2.0 * Math.PI) / 3.0);
		result[4] = -term1 + r13 * Math.cos((dum1 + 4.0 * Math.PI) / 3.0);
		
		return;
	}

	CanvasRenderer.prototype.sqDistanceToQuadraticBezier = function(
		x, y, x1, y1, x2, y2, x3, y3) {
		
		// Find minimum distance by using the minimum of the distance 
		// function between the given point and the curve
		
		// This gives the coefficients of the resulting cubic equation
		// whose roots tell us where a possible minimum is
		// (Coefficients are divided by 4)
		
		var a = 1.0 * x1*x1 - 4*x1*x2 + 2*x1*x3 + 4*x2*x2 - 4*x2*x3 + x3*x3
			+ y1*y1 - 4*y1*y2 + 2*y1*y3 + 4*y2*y2 - 4*y2*y3 + y3*y3;
		
		var b = 1.0 * 9*x1*x2 - 3*x1*x1 - 3*x1*x3 - 6*x2*x2 + 3*x2*x3
			+ 9*y1*y2 - 3*y1*y1 - 3*y1*y3 - 6*y2*y2 + 3*y2*y3;
		
		var c = 1.0 * 3*x1*x1 - 6*x1*x2 + x1*x3 - x1*x + 2*x2*x2 + 2*x2*x - x3*x
			+ 3*y1*y1 - 6*y1*y2 + y1*y3 - y1*y + 2*y2*y2 + 2*y2*y - y3*y;
			
		var d = 1.0 * x1*x2 - x1*x1 + x1*x - x2*x
			+ y1*y2 - y1*y1 + y1*y - y2*y;
		
		debug("coefficients: " + a / a + ", " + b / a + ", " + c / a + ", " + d / a);
		
		var roots = [];
		
		// Use the cubic solving algorithm
		this.solveCubic(a, b, c, d, roots);
		
		var zeroThreshold = 0.0000001;
		
		var params = [];
		
		for (var index = 0; index < 6; index += 2) {
			if (Math.abs(roots[index + 1]) < zeroThreshold
					&& roots[index] >= 0
					&& roots[index] <= 1.0) {
				params.push(roots[index]);
			}
		}
		
		params.push(1.0);
		params.push(0.0);
		
		var minDistanceSquared = -1;
		var closestParam;
		
		var curX, curY, distSquared;
		for (var i = 0; i < params.length; i++) {
			curX = Math.pow(1.0 - params[i], 2.0) * x1
				+ 2.0 * (1 - params[i]) * params[i] * x2
				+ params[i] * params[i] * x3;
				
			curY = Math.pow(1 - params[i], 2.0) * y1
				+ 2 * (1.0 - params[i]) * params[i] * y2
				+ params[i] * params[i] * y3;
				
			distSquared = Math.pow(curX - x, 2) + Math.pow(curY - y, 2);
			debug("distance for param " + params[i] + ": " + Math.sqrt(distSquared));
			if (minDistanceSquared >= 0) {
				if (distSquared < minDistanceSquared) {
					minDistanceSquared = distSquared;
					closestParam = params[i];
				}
			} else {
				minDistanceSquared = distSquared;
				closestParam = params[i];
			}
		}
		
		/*
		debugStats.clickX = x;
		debugStats.clickY = y;
		
		debugStats.closestX = Math.pow(1.0 - closestParam, 2.0) * x1
				+ 2.0 * (1.0 - closestParam) * closestParam * x2
				+ closestParam * closestParam * x3;
				
		debugStats.closestY = Math.pow(1.0 - closestParam, 2.0) * y1
				+ 2.0 * (1.0 - closestParam) * closestParam * y2
				+ closestParam * closestParam * y3;
		*/
		
		debug("given: " 
			+ "( " + x + ", " + y + "), " 
			+ "( " + x1 + ", " + y1 + "), " 
			+ "( " + x2 + ", " + y2 + "), "
			+ "( " + x3 + ", " + y3 + ")");
		
		
		debug("roots: " + roots);
		debug("params: " + params);
		debug("closest param: " + closestParam);
		return minDistanceSquared;
	}
	
	CanvasRenderer.prototype.sqDistanceToFiniteLine = function(x, y, x1, y1, x2, y2) {
		var offset = [x - x1, y - y1];
		var line = [x2 - x1, y2 - y1];
		
		var lineSq = line[0] * line[0] + line[1] * line[1];
		var hypSq = offset[0] * offset[0] + offset[1] * offset[1];
		
		var dotProduct = offset[0] * line[0] + offset[1] * line[1];
		var adjSq = dotProduct * dotProduct / lineSq;
		
		if (dotProduct < 0) {
			return hypSq;
		}
		
		if (adjSq > lineSq) {
			return (x - x2) * (x - x2) + (y - y2) * (y - y2);
		}
		
		return (hypSq - adjSq);
	}
	}
	
	var debug = function(){};
	$$("renderer", "canvas", CanvasRenderer);
	
})( cytoscape );

;(function($$){
	
	// default layout options
	var defaults = {
		ready: function(){},
		stop: function(){}
	};

	// constructor
	// options : object containing layout options
	function NullLayout( options ){
		this.options = $$.util.extend(true, {}, defaults, options); 
	}
	
	// runs the layout
	NullLayout.prototype.run = function(){
		var options = this.options;
		var cy = options.cy; // cy is automatically populated for us in the constructor
		
		// puts all nodes at (0, 0)
		cy.nodes().positions(function(){
			return {
				x: 0,
				y: 0
			};
		});
		
		// trigger layoutready when each node has had its position set at least once
		cy.one("layoutready", options.ready);
		cy.trigger("layoutready");
		
		// trigger layoutstop when the layout stops (e.g. finishes)
		cy.one("layoutstop", options.stop);
		cy.trigger("layoutstop");
	};

	// called on continuous layouts to stop them before they finish
	NullLayout.prototype.stop = function(){
		var options = this.options;

		cy.one("layoutstop", options.stop);
		cy.trigger("layoutstop");
	};
	
	// register the layout
	$$("layout", "null", NullLayout);
	
})(cytoscape);

;(function($$){
	
	var defaults = {
		ready: undefined, // callback on layoutready
		stop: undefined, // callback on layoutstop
		fit: true // whether to fit to viewport
	};
	
	function RandomLayout( options ){
		this.options = $$.util.extend(true, {}, defaults, options);
	}
	
	RandomLayout.prototype.run = function(){
		var options = this.options;
		var cy = options.cy;
		var nodes = cy.nodes();
		var edges = cy.edges();
		var container = cy.container();
		
		var width = container.clientWidth;
		var height = container.clientHeight;
		

		nodes.positions(function(i, element){
			
			if( element.locked() ){
				return false;
			}

			return {
				x: Math.round( Math.random() * width ),
				y: Math.round( Math.random() * height )
			};
		});
		
		// layoutready should be triggered when the layout has set each node's
		// position at least once
		cy.one("layoutready", options.ready);
		cy.trigger("layoutready");
		
		if( options.fit ){
			cy.fit();
		}
		
		// layoutstop should be triggered when the layout stops running
		cy.one("layoutstop", options.stop);
		cy.trigger("layoutstop");
	};
	
	RandomLayout.prototype.stop = function(){
		// stop the layout if it were running continuously
	};

	// register the layout
	$$(
		"layout", // we're registering a layout
		"random", // the layout name
		RandomLayout // the layout prototype
	);
	
})(cytoscape);

;(function($$){
	
	var defaults = {
		fit: true, // whether to fit the viewport to the graph
		rows: undefined, // force num of rows in the grid
		columns: undefined, // force num of cols in the grid
		ready: undefined, // callback on layoutready
		stop: undefined // callback on layoutstop
	};
	
	function GridLayout( options ){
		this.options = $$.util.extend({}, defaults, options);
	}
	
	GridLayout.prototype.run = function(){
		var params = options = this.options;
		
		var cy = params.cy;
		var nodes = cy.nodes();
		var edges = cy.edges();
		var container = cy.container();
		
		var width = container.clientWidth;
		var height = container.clientHeight;

		if( height == 0 || width == 0){
			nodes.positions(function(){
				return { x: 0, y: 0 };
			});
			
		} else {
			
			// width/height * splits^2 = cells where splits is number of times to split width
			var cells = nodes.size();
			var splits = Math.sqrt( cells * height/width );
			var rows = Math.round( splits );
			var cols = Math.round( width/height * splits );

			function small(val){
				if( val == undefined ){
					return Math.min(rows, cols);
				} else {
					var min = Math.min(rows, cols);
					if( min == rows ){
						rows = val;
					} else {
						cols = val;
					}
				}
			}
			
			function large(val){
				if( val == undefined ){
					return Math.max(rows, cols);
				} else {
					var max = Math.max(rows, cols);
					if( max == rows ){
						rows = val;
					} else {
						cols = val;
					}
				}
			}
			
			// if rows or columns were set in options, use those values
			if( options.rows != null && options.columns != null ){
				rows = options.rows;
				cols = options.columns;
			} else if( options.rows != null && options.columns == null ){
				rows = options.rows;
				cols = Math.ceil( cells / rows );
			} else if( options.rows == null && options.columns != null ){
				cols = options.columns;
				rows = Math.ceil( cells / cols );
			}
			
			// otherwise use the automatic values and adjust accordingly
			
			// if rounding was up, see if we can reduce rows or columns
			else if( cols * rows > cells ){
				var sm = small();
				var lg = large();
				
				// reducing the small side takes away the most cells, so try it first
				if( (sm - 1) * lg >= cells ){
					small(sm - 1);
				} else if( (lg - 1) * sm >= cells ){
					large(lg - 1);
				} 
			} else {
				
				// if rounding was too low, add rows or columns
				while( cols * rows < cells ){
					var sm = small();
					var lg = large();
					
					// try to add to larger side first (adds less in multiplication)
					if( (lg + 1) * sm >= cells ){
						large(lg + 1);
					} else {
						small(sm + 1);
					}
				}
			}
			
			var cellWidth = width / cols;
			var cellHeight = height / rows;
			
			var row = 0;
			var col = 0;
			nodes.positions(function(i, element){
				
				if( element.locked() ){
					return false;
				}
				
				var x = col * cellWidth + cellWidth/2;
				var y = row * cellHeight + cellHeight/2;
				
				col++;
				if( col >= cols ){
					col = 0;
					row++;
				}
				
				return { x: x, y: y };
				
			});
		}
		
		if( params.fit ){
			cy.reset();
		} 
		
		cy.one("layoutready", params.ready);
		cy.trigger("layoutready");
		
		cy.one("layoutstop", params.stop);
		cy.trigger("layoutstop");
	};

	GridLayout.prototype.stop = function(){
		// not a continuous layout
	};
	
	$$("layout", "grid", GridLayout);
	
})( cytoscape );

;(function($$){
	
	var defaults = {
		fit: true, // whether to fit to viewport
		ready: undefined, // callback on layoutready
		stop: undefined, // callback on layoutstop
		positions: undefined, // map of (node id) => (position obj)
		zoom: undefined, // the zoom level to set (prob want fit = false if set)
		pan: undefined // the pan level to set (prob want fit = false if set)
	};
	
	function PresetLayout( options ){
		this.options = $$.util.extend(true, {}, defaults, options);
	}
	
	PresetLayout.prototype.run = function(){
		var options = this.options;
		var cy = options.cy;
		var nodes = cy.nodes();
		var edges = cy.edges();
		var container = cy.container();
		
		function getPosition(node){
			if( options.positions == null ){
				return null;
			}
			
			if( options.positions[node._private.data.id] == null ){
				return null;
			}
			
			return options.positions[node._private.data.id];
		}
		
		nodes.positions(function(i, node){
			var position = getPosition(node);
			
			if( node.locked() || position == null ){
				return false;
			}
			
			return position;
		});
		
		if( options.pan != null ){
			cy.pan( options.pan );
		}

		if( options.zoom != null ){
			cy.zoom( options.zoom );
		}

		cy.one("layoutready", options.ready);
		cy.trigger("layoutready");
		
		if( options.fit ){
			cy.fit();
		}
		
		cy.one("layoutstop", options.stop);
		cy.trigger("layoutstop");
	};
	
	$$("layout", "preset", PresetLayout);
	
	$$("core", "presetLayout", function(){
		var cy = this;
		var layout = {};
		var elements = {};
		
		cy.nodes().each(function(i, ele){
			elements[ ele.data("id") ] = ele.position();
		});
		
		layout.positions = elements;
		layout.name = "preset";
		layout.zoom = cy.zoom();
		layout.pan = cy.pan();

		return layout;
	});
	
})(cytoscape);

;(function($$){
	
	var defaults = {
		liveUpdate: true, // whether to show the layout as it's running
		ready: undefined, // callback on layoutready 
		stop: undefined, // callback on layoutstop
		maxSimulationTime: 4000, // max length in ms to run the layout
		fit: true, // fit to viewport
		padding: [ 50, 50, 50, 50 ], // top, right, bottom, left
		ungrabifyWhileSimulating: true, // so you can't drag nodes during layout

		// forces used by arbor (use arbor default on undefined)
		repulsion: undefined,
		stiffness: undefined,
		friction: undefined,
		gravity: true,
		fps: undefined,
		precision: undefined,

		// static numbers or functions that dynamically return what these
		// values should be for each element
		nodeMass: undefined, 
		edgeLength: undefined,

		stepSize: 1, // size of timestep in simulation

		// function that returns true if the system is stable to indicate
		// that the layout can be stopped
		stableEnergy: function( energy ){
			var e = energy; 
			return (e.max <= 0.5) || (e.mean <= 0.3);
		}
	};
	
	function ArborLayout(options){
		this.options = $$.util.extend({}, defaults, options);
	}
		
	ArborLayout.prototype.run = function(){
		var options = this.options;
		var cy = options.cy;
		var nodes = cy.nodes();
		var edges = cy.edges();
		var container = cy.container();
		var width = container.clientWidth;
		var height = container.clientHeight;

		// arbor doesn't work with just 1 node
		if( cy.nodes().size() <= 1 ){
			if( options.fit ){
				cy.reset();
			}

			cy.nodes().position({
				x: Math.round( width/2 ),
				y: Math.round( height/2 )
			});

			cy.one("layoutstop", options.stop);
			cy.trigger("layoutstop");

			cy.one("layoutstop", options.stop);
			cy.trigger("layoutstop");

			return;
		}

		var sys = this.system = arbor.ParticleSystem(options.repulsion, options.stiffness, options.friction, options.gravity, options.fps, options.dt, options.precision);
		this.system = sys;

		if( options.liveUpdate && options.fit ){
			cy.reset();
		};
		
		var doneTime = 250;
		var doneTimeout;
		
		var ready = false;
		
		var lastDraw = +new Date;
		var sysRenderer = {
			init: function(system){
			},
			redraw: function(){
				var energy = sys.energy();

				// if we're stable (according to the client), we're done
				if( options.stableEnergy != null && energy != null && energy.n > 0 && options.stableEnergy(energy) ){
					sys.stop();
					return;
				}

				clearTimeout(doneTimeout);
				doneTimeout = setTimeout(doneHandler, doneTime);
				
				var movedNodes = [];
				
				sys.eachNode(function(n, point){ 
					var id = n.name;
					var data = n.data;
					var node = data.element;
					
					if( node == null ){
						return;
					}
					var pos = node._private.position;
					
					if( !node.locked() && !node.grabbed() ){
						pos.x = point.x;
						pos.y = point.y;
						
						movedNodes.push( node );
					}
				});
				

				var timeToDraw = (+new Date - lastDraw) >= 16;
				if( options.liveUpdate && movedNodes.length > 0 && timeToDraw ){
					new $$.Collection(cy, movedNodes).rtrigger("position");
					lastDraw = +new Date;
				}

				
				if( !ready ){
					ready = true;
					cy.one("layoutready", options.ready);
					cy.trigger("layoutready");
				}
			}
			
		};
		sys.renderer = sysRenderer;
		sys.screenSize( width, height );
		sys.screenPadding( options.padding[0], options.padding[1], options.padding[2], options.padding[3] );
		sys.screenStep( options.stepSize );

		function calculateValueForElement(element, value){
			if( value == null ){
				return undefined;
			} else if( typeof value == typeof function(){} ){
				return value.apply(element, [element._private.data, {
					nodes: nodes.length,
					edges: edges.length,
					element: element
				}]); 
			} else {
				return value;
			}
		}
		
		// TODO we're using a hack; sys.toScreen should work :(
		function fromScreen(pos){
			var x = pos.x;
			var y = pos.y;
			var w = width;
			var h = height;
			
			var left = -2;
			var right = 2;
			var top = -2;
			var bottom = 2;
			
			var d = 4;
			
			return {
				x: x/w * d + left,
				y: y/h * d + right
			};
		}
		
		var grabHandler = function(e){
			grabbed = this;
			var pos = sys.fromScreen( this.position() );
			var p = arbor.Point(pos.x, pos.y);
			this.scratch().arbor.p = p;
			
			switch( e.type ){
			case "grab":
				this.scratch().arbor.fixed = true;
				break;
			case "dragstop":
				this.scratch().arbor.fixed = false;
				this.scratch().arbor.tempMass = 1000
				break;
			}
		};
		nodes.bind("grab drag dragstop", grabHandler);
			  	
		nodes.each(function(i, node){
			var id = this._private.data.id;
			var mass = calculateValueForElement(this, options.nodeMass);
			var locked = this._private.locked;
			
			var pos = fromScreen({
				x: node.position().x,
				y: node.position().y
			});

			this.scratch().arbor = sys.addNode(id, {
				element: this,
				mass: mass,
				fixed: locked,
				x: locked ? pos.x : undefined,
				y: locked ? pos.y : undefined
			});
		});
		
		edges.each(function(){
			var id = this.id();
			var src = this.source().id();
			var tgt = this.target().id();
			var length = calculateValueForElement(this, options.edgeLength);
			
			this.scratch().arbor = sys.addEdge(src, tgt, {
				length: length
			});
		});
		
		function packToCenter(callback){
			// TODO implement this for IE :(
			
			if( options.fit ){
				cy.fit();
			}
			callback();
		};
		
		var grabbableNodes = nodes.filter(":grabbable");
		// disable grabbing if so set
		if( options.ungrabifyWhileSimulating ){
			grabbableNodes.ungrabify();
		}
		
		var doneHandler = function(){
			if( $.browser.msie ){
				packToCenter(function(){
					done();
				});
			} else {
				done();
			}
			
			function done(){
				if( !options.liveUpdate ){
					if( options.fit ){
						cy.reset();
					}

					cy.nodes().rtrigger("position");
				}

				// unbind handlers
				nodes.unbind("grab drag dragstop", grabHandler);
				
				// enable back grabbing if so set
				if( options.ungrabifyWhileSimulating ){
					grabbableNodes.grabify();
				}

				cy.one("layoutstop", options.stop);
				cy.trigger("layoutstop");
			}
		};
		
		sys.start();
		setTimeout(function(){
			sys.stop();
		}, options.maxSimulationTime);
		
	};

	ArborLayout.prototype.stop = function(){
		if( this.system != null ){
			system.stop();
		}
	};
	
	$$("layout", "arbor", ArborLayout);
	
	
})(cytoscape);
