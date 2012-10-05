
/* cytoscape.js */

/**
 * This file is part of cytoscape.js 2.0.0beta1-github-snapshot-2012.10.03-17.10.29.
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
			nodeShape: { enums: ["rectangle", "roundrectangle", "ellipse", "triangle"] },
			arrowShape: { enums: ["tee", "triangle", "square", "circle", "diamond", "none"] },
			visibility: { enums: ["hidden", "visible"] },
			valign: { enums: ["top", "center", "bottom"] },
			halign: { enums: ["left", "center", "right"] },
			cursor: { enums: ["auto", "crosshair", "default", "e-resize", "n-resize", "ne-resize", "nw-resize", "pointer", "progress", "s-resize", "sw-resize", "text", "w-resize", "wait", "grab", "grabbing"] },
			text: { string: true },
			data: { mapping: true, regex: "^data\\s*\\(\\s*(\\w+)\\s*\\)$" },
			mapData: { mapping: true, regex: "^mapData\\((\\w+)\\s*\\,\\s*(" + number + ")\\s*\\,\\s*(" + number + ")\\s*,\\s*(\\w+)\\s*\\,\\s*(\\w+)\\)$" }
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
			reg.ready = false; // b/c an old core instance could have been using this reg and this instance is not yet ready
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
			reg.ready = true;

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
			var eles;

			if( !selector || ( $$.is.elementOrCollection(selector) && selector.length === 0 ) ){
				eles = this.$();
			} else if( $$.is.string(selector) ){
				eles = this.$( selector );
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

(function($$){

	var debug = function(o) {
		if (false) {
			console.log(o);
		}
	}

	var defaults = {
		minZoom: 0.001,
		maxZoom: 1000,
		maxPan: -1 >>> 1,
		minPan: (-(-1>>>1)-1),
		selectionToPanDelay: 500,
		dragToSelect: true,
		dragToPan: true,
	};
	
	var debugStats = {};
	
	// The 5th element in the array can be used to indicate whether 
	// the box should be drawn (0=hide)
	var selectBox = [0, 0, 0, 0, 0];
	
	var dragPanStartX;
	var dragPanStartY;
	var dragPanInitialCenter;
	var dragPanMode = false;
	
	var shiftDown = false;
	
	var nodeHovered = false;
	
	var minDistanceEdge;
	var minDistanceEdges = [];
	var minDistanceEdgeValue = 999;
	
	var minDistanceNode;
	var minDistanceNodes = [];
	var minDistanceNodeValue = 999;
	
	var arrowShapes = {};
	var arrowShapeDrawers = {};
	var arrowShapeSpacing = {};
	var arrowShapeGap = {};
	var nodeShapeDrawers = {};
	var nodeShapeIntersectLine = {};
	var nodeShapePoints = {};
	
	var nodeDragging = false;
	var draggingSelectedNode = false;
	var draggedNode;
	
	var draggedElementsMovedLayer = false;
	var nodesBeingDragged = [];
	var edgesBeingDragged = [];
	
	var cy;
	var renderer;
	
	var curTouch1Position = new Array(2);
	var curTouch2Position = new Array(2);
	var curTouchDistance;
	
	var prevTouch1Position = new Array(2);
	var prevTouch2Position = new Array(2);
	var prevTouchDistance;
	
	var skipNextViewportRedraw = false;
	
	// Timeout variable used to prevent mouseMove events from being triggered too often
	var mouseMoveTimeout = 0;
	
	// Timeout variable to prevent frequent redraws
	var redrawTimeout = 0;
	
	var currentMouseDownNode = undefined;
	var currentMouseDownEdge = undefined;
	var currentMouseDownInCanvas = false;
	var currentMouseDownUnmoved = false;
	
	// Used for mouseover/mouseout
	var currentHoveredNode = undefined
	var currentHoveredEdge = undefined;
	var currentMouseInCanvas = false;
	var mouseJustEnteredCanvas = false;
	
	var wheelZoomEnabled = false;
	
	var previousMouseX = undefined;
	var currentMouseX = undefined;
	
	var secondsElapsed = 0;
	var mouseDownTime = undefined;
	
	function CanvasRenderer(options) {
		this.options = $.extend(true, {}, defaults, options);
		this.cy = options.cy;
		
		cy = options.cy;
		
		this.init();
		
		// Information about the number of edges between each pair of nodes
		// used to find different curvatures for the edges
		this.nodePairEdgeData = {};		
		
		var numCanvases = 5;
		
		// Create canvases, place in container
		
		this.canvases = new Array(numCanvases);
		this.canvasContexts = new Array(numCanvases);
		
		var numBufferCanvases = 2;
		this.bufferCanvases = new Array(numBufferCanvases);
		this.bufferCanvasContexts = new Array(numBufferCanvases);
		
		this.canvasNeedsRedraw = new Array(numCanvases);
		this.redrawReason = new Array(numCanvases);
		
		var container = this.options.cy.container();
		this.container = container;
		
		setInterval(function() {
			secondsElapsed++;
		}, 450);
		
		for (var i = 0; i < numCanvases + numBufferCanvases; i++) {
			var canvas = document.createElement("canvas");
			
			canvas.width = container.clientWidth;
			canvas.height = container.clientHeight;
			// console.log(canvas)
			
			/*
			canvas.style.width = '100%';
			canvas.style.height = '100%';			
			*/
			canvas.style.position = "absolute";
			
			if (i < numCanvases) {
				// Create main set of canvas layers for drawing
				canvas.id = "layer" + i;
				canvas.style.zIndex = String(-i - numBufferCanvases);
				canvas.style.visibility = "hidden";
				
				this.canvases[i] = canvas;
				this.canvasContexts[i] = canvas.getContext("2d");
				
				this.canvasNeedsRedraw[i] = false;
				this.redrawReason[i] = new Array();
				
			} else {
				// Create the buffer canvas which is the cached drawn result
				canvas.id = "buffer" + (i - numCanvases);
				canvas.style.zIndex = -(i - numCanvases);
				
				this.bufferCanvases[i - numCanvases] = canvas;
				this.bufferCanvasContexts[i - numCanvases] = canvas.getContext("2d");
			}
			
			container.appendChild(canvas);
		}
		
		this.bufferCanvases[0].style.visibility = "visible";
//		this.bufferCanvases[0].style.visibility = "hidden";
		
		this.bufferCanvases[1].style.visibility = "hidden";
//		this.bufferCanvases[1].style.visibility = "visible";
		
		this.canvas = this.bufferCanvases[0];
		this.context = this.bufferCanvasContexts[0];
		
		this.center = [container.clientWidth / 2, container.clientHeight / 2];
		this.scale = [1, 1];
		this.zoomLevel = 0;
		
		renderer = this;
	}

	CanvasRenderer.prototype.notify = function(params) {

		if (params.type == "load") {
			this.load();
			
			this.canvasNeedsRedraw[2] = true;
			this.redrawReason[2].push("Load");
				
			this.canvasNeedsRedraw[4] = true;
			this.redrawReason[4].push("Load");
			
			this.redraw();
		
		} else if (params.type == "viewport") {
		
			if (!skipNextViewportRedraw) {
				this.canvasNeedsRedraw[2] = true;
				this.redrawReason[2].push("Viewport change");
				
				this.canvasNeedsRedraw[4] = true;
				this.redrawReason[4].push("Viewport change");
				
				this.redraw();
			} else {
				skipNextViewportRedraw = false;
			}
		} else if (params.type == "style") {
			
			doSingleRedraw = true;

			this.canvasNeedsRedraw[2] = true;
			this.redrawReason[2].push("Style change");
			
			this.canvasNeedsRedraw[4] = true;
			this.redrawReason[4].push("Style change");
			
			this.redraw();
			
		} else if (params.type == "add"
			|| params.type == "remove") {
			
			this.canvasNeedsRedraw[4] = true;
			this.redrawReason[4].push("Elements added/removed");
			
			this.redraw();
		} else if (params.type == "draw") {
			this.canvasNeedsRedraw[2] = true;
			this.redrawReason[2].push("Draw call");
			
			this.canvasNeedsRedraw[4] = true;
			this.redrawReason[4].push("Draw call");
			
			this.redraw();
		} else if (params.type == "position") {
			this.canvasNeedsRedraw[2] = true;
			this.redrawReason[2].push("Position call");
			
			this.canvasNeedsRedraw[4] = true;
			this.redrawReason[4].push("Position call");
			
			this.redraw();	
		} else {
			console.log("event: " + params.type);
		}
	};
	
	CanvasRenderer.prototype.projectMouse = function(mouseEvent) {
		
		/* sept25-2012
		var x = mouseEvent.clientX - this.canvas.offsetParent.offsetLeft - 2;
		var y = mouseEvent.clientY - this.canvas.offsetParent.offsetTop - 2;

		x += (mouseEvent.pageX - mouseEvent.clientX);
		y += (mouseEvent.pageY - mouseEvent.clientY);
		*/
		
		/*
		console.log(renderer.container.HTMLElement);
		console.log(renderer.container);
		*/
		var x, y;
		/*
		if (mouseEvent.offsetX !== undefined && mouseEvent.offsetY !== undefined) {
			x = mouseEvent.offsetX;
			y = mouseEvent.offsetY;
		} else {
		*/	
		
		var offsetLeft = 0;
		var offsetTop = 0;
		var n;
		
		n = cy.container();
		while (n != null) {
			if (typeof(n.offsetLeft) == "number") {
				offsetLeft += n.offsetLeft;
				offsetTop += n.offsetTop;
			}
			
			n = n.parentNode;
		}
		// console.log(offsetLeft, offsetTop);
		
		x = mouseEvent.pageX - offsetLeft;
		y = mouseEvent.pageY - offsetTop;
		//}
			
		x -= cy.pan().x;
		y -= cy.pan().y;
		
		x /= cy.zoom();
		y /= cy.zoom();
		
		return [x, y];
		
		/*
		mouseDownEvent.clientX,
		mouseDownEvent.clientY,
		cy.container().offset().left + 2, // container offsets
		cy.container().offset().top + 2);
		*/
	}
	
	CanvasRenderer.prototype.findEdgeMetrics = function(edges) {
		this.nodePairEdgeData = {};
		
		var edge, nodePairId;
		for (var i = 0; i < edges.length; i++) {
			edge = edges[i];
			nodePairId = edge._private.data.source <= edge._private.data.target?
				edge._private.data.source + edge._private.data.target
				: edge._private.data.target + edge._private.data.source;
				
			if (this.nodePairEdgeData[nodePairId] == undefined) {
				this.nodePairEdgeData[nodePairId] = 1;
			} else {
				this.nodePairEdgeData[nodePairId]++;
			}
			
			edge._private.rscratch.nodePairId = nodePairId;
			edge._private.rscratch.nodePairEdgeNum = this.nodePairEdgeData[nodePairId];
		}
		
		// console.log(this.nodePairEdgeData);
	}
	
	CanvasRenderer.prototype.findEdges = function(nodeSet) {
		
		var edges = cy.edges();
		
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
	
	CanvasRenderer.prototype.findEdgeControlPoints = function(edges) {
		var hashTable = {};
		
		var pairId;
		for (var i = 0; i < edges.length; i++) {
			
			pairId = edges[i]._private.data.source > edges[i]._private.data.target ?
				edges[i]._private.data.target + edges[i]._private.data.source :
				edges[i]._private.data.source + edges[i]._private.data.target;

			if (hashTable[pairId] == undefined) {
				hashTable[pairId] = [];
			}
			
			hashTable[pairId].push(edges[i]); // ._private.data.id);
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
					
					edge._private.rscratch.cp2ax = src._private.position.x;
					edge._private.rscratch.cp2ay = src._private.position.y
						- 1.3 * stepSize * (i / 3 + 1);
					
					edge._private.rscratch.cp2cx = src._private.position.x
						- 1.3 * stepSize * (i / 3 + 1);
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
	
	CanvasRenderer.prototype.findEdgeControlPoints2 = function(edges) {
		var visitedEdges = {};
		
		var parallelEdges;
		for (var i = 0; i < edges.length; i++) {
			if (visitedEdges[edges[i]._private.data.id] == undefined) {
				parallelEdges = edges[i].parallelEdges();
				
				for (var j = 0; j < edges.length; j++) {
					visitedEdges[edges[i]._private.data.id] = true;
				}
				
				$$.styfn.calculateControlPoints(parallelEdges);
			}
		}
	}
	
	CanvasRenderer.prototype.checkRecordPinchCoordinates = function(touchEvent) {
		
		if (touchEvent.touches.length >= 2) {
			prevTouch1 = touchEvent.touches[0];
			prevTouch2 = touchEvent.touches[1];
			
			prevTouch1.offsetX = prevTouch1.clientX + renderer.canvas.parentElement.offsetLeft;
			prevTouch1.offsetY = prevTouch1.clientY + renderer.canvas.parentElement.offsetTop;
			
			prevTouch2.offsetX = prevTouch2.clientX + renderer.canvas.parentElement.offsetLeft;
			prevTouch2.offsetY = prevTouch2.clientY + renderer.canvas.parentElement.offsetTop;
		} else {
			prevTouch1 = undefined;
			prevTouch2 = undefined;
		}
	}
	
	CanvasRenderer.prototype.mouseDownHandler = function(event) {
		var nodes = cy.nodes();
		var edges = cy.edges();

		var touch = false;
		
		var originalEvent = event;
		if (event.changedTouches) {					
			event.preventDefault();
			touch = true;
				
			// Check for 2-finger, prepare for pinch-to-zoom
			if (event.touches.length >= 2) {
				firstTouchFinger = event.touches[0];
				secondTouchFinger = event.touches[1];
				
				var canvasOffset = [
					renderer.canvas.parentElement.offsetLeft,
					-renderer.canvas.parentElement.offsetTop];
				
				prevTouch1Position[0] = event.touches[0].clientX + canvasOffset[0];
				prevTouch1Position[1] = event.touches[0].clientY + canvasOffset[1];
				
				prevTouch2Position[0] = event.touches[1].clientX + canvasOffset[0];
				prevTouch2Position[1] = event.touches[1].clientY + canvasOffset[1];
				
				prevTouchDistance = Math.sqrt(
					Math.pow(prevTouch2Position[0] - prevTouch1Position[0], 2)
					+ Math.pow(prevTouch2Position[1] - prevTouch1Position[1], 2));
			}
			
			event = event.changedTouches[0];
			event.button = 0;
			event.touch = 1;
			
			// Look for nodes and edges under the touch event			
			// minDistanceNode = minDistanceEdge = undefined;
			renderer.mouseMoveHelper.hoverHandler(nodes, edges, event);
		}
		
		var mouseDownEvent = event;
		
		mouseDownTime = secondsElapsed;
		
		clearTimeout( this.panTimeout );
		if( !minDistanceNode && !touch){
			this.panTimeout = setTimeout(function() {
			
				// Delayed pan
				if (mouseDownTime !== undefined
					&& !touch
					&& event.button === 0) {
					
					dragPanStartX = mouseDownEvent.clientX;
					dragPanStartY = mouseDownEvent.clientY;
					
		//			dragPanInitialCenter = [cy.renderer().center[0], cy.renderer().center[1]];
					
					dragPanMode = true;
					
					if (cy.renderer().canvas.style.cursor 
						!= cy.style()._private.coreStyle["panning-cursor"].value) {
		
						cy.renderer().canvas.style.cursor 
							= cy.style()._private.coreStyle["panning-cursor"].value;
					}
					
					// Cancel selection box
					selectBox[4] = 0;
					
					renderer.canvasNeedsRedraw[0] = true;
					renderer.redrawReason[0].push("selection boxed removed");
					
					mouseDownTime = undefined;
				}
			}, 250);
		}
				
		// Process middle button panning
		if ((!event.touch
				&& mouseDownEvent.button == 1
				&& mouseDownEvent.target == cy.renderer().canvas)
				||
			(event.touch
				&& minDistanceNode == undefined
				&& minDistanceEdge == undefined)) {
		
			dragPanStartX = mouseDownEvent.clientX;
			dragPanStartY = mouseDownEvent.clientY;
			
//			dragPanInitialCenter = [cy.renderer().center[0], cy.renderer().center[1]];
			
			dragPanMode = true;
			
			if (cy.renderer().canvas.style.cursor 
				!= cy.style()._private.coreStyle["panning-cursor"].value) {

				cy.renderer().canvas.style.cursor 
					= cy.style()._private.coreStyle["panning-cursor"].value;
			}
		}
		
		currentMouseDownInCanvas = true;
		currentMouseDownUnmoved = true;
		
		var start = cy.renderer().projectMouse(event);
		
		/*
		console.log("x: " + start[0]);
		console.log("y: " + start[1]);
		console.log(mouseDownEvent);
		console.log(mouseDownEvent.target);
		console.log(mouseDownEvent.button);
		*/
		
		selectBox[0] = start[0];
		selectBox[1] = start[1];
		
		/*
		// The lower right corner shouldn't have a coordinate,
		// but this prevents the default 0, 0 from being used for touch
		selectBox[2] = start[0];
		selectBox[3] = start[1];
		*/
		
		// Left button drag selection
		if (mouseDownEvent.button == 0
				&& mouseDownEvent.target == cy.renderer().canvas
				&& minDistanceNode == undefined
				&& minDistanceEdge == undefined
				&& !touch) {
		
			selectBox[4] = 1;
		}
		
		if (mouseDownEvent.button == 0) {
		
			if (minDistanceNode != undefined && minDistanceNode.grabbable()) {
				
				nodeDragging = true;
				nodesBeingDragged = [];
				
				if (minDistanceNode.selected()) {
					draggingSelectedNode = true;
					
					for (var index = 0; index < nodes.length; index++) {
						if (nodes[index].selected() && nodes[index].grabbable()) {
							
							nodes[index]._private.rscratch.dragStartX = 
								nodes[index]._private.position.x;
							nodes[index]._private.rscratch.dragStartY =
								nodes[index]._private.position.y;
										
							nodesBeingDragged.push(nodes[index]);
//**						nodes[index]._private.rscratch.layer2 = true;
							
							// Proxy grab() event
							nodes[index]._private.grabbed = true;
							nodes[index].trigger("grab");
						}
					}
					
				} else if( minDistanceNode.grabbable() ) {
					draggingSelectedNode = false;
					draggedNode = minDistanceNode;
					
					draggedNode._private.rscratch.dragStartX = 
						draggedNode._private.position.x;
					draggedNode._private.rscratch.dragStartY = 
						draggedNode._private.position.y;
					
					nodesBeingDragged.push(draggedNode);
					draggedNode._private.rscratch.layer2 = true;	

					// Proxy grab() event
					draggedNode._private.grabbed = true;
					draggedNode.trigger("grab");
				}
				
				edgesBeingDragged = renderer.findEdges(nodesBeingDragged);
				
				for (var i = 0; i < edgesBeingDragged.length; i++) {
//**				edgesBeingDragged[i]._private.rscratch.layer2 = true;
				}
				
/***
				renderer.canvasNeedsRedraw[4] = true;
				renderer.redrawReason[4].push("nodes being dragged, moved to drag layer");
				
				renderer.canvasNeedsRedraw[2] = true;
				renderer.redrawReason[2].push("nodes being dragged, moved to drag layer");
***/

				draggedElementsMovedLayer = false;
				
				// Proxy touchstart/mousedown to core
				if (touch) {
					minDistanceNode.trigger("touchstart");
				} else {
					minDistanceNode.trigger("mousedown");
				}
				
				currentMouseDownNode = minDistanceNode;
			} else if (minDistanceEdge != undefined) {
				// Proxy touchstart/mousedown to core
				if (touch) {
					minDistanceEdge.trigger("touchstart");
				} else {
					minDistanceEdge.trigger("mousedown");
				}
				
				currentMouseDownEdge = minDistanceEdge;
			} else {
			
				// Proxy touchstart/mousedown to core
				if (touch) {
					cy.trigger("touchstart");
				} else {
					cy.trigger("mousedown");
				}
				
				currentMouseDownInCanvas = true;
			}
		}
		
		cy.renderer().redraw();
	}
	
	CanvasRenderer.prototype.mouseOverHandler = function(event) {
		mouseJustEnteredCanvas = true;
		currentMouseInCanvas = true;
	}
	
	CanvasRenderer.prototype.mouseOutHandler = function(event) {
		wheelZoomEnabled = false;
		currentMouseInCanvas = false;
		
		cy.trigger("mouseout");
		
		previousMouseX = undefined;
		
		// Possibly move this later
//		dragPanMode = false;
	}
	
	CanvasRenderer.prototype.touchStartHandler = function(event) {
	
	}
	
	CanvasRenderer.prototype.touchStartHandler = function(event) {
	
	}
	
	
	
	CanvasRenderer.prototype.documentMouseMoveHandler = function(event) {
		
		var touch = false;
		var eventWithCoords = event;
		
		if (event.touches) {
			touch = true;
			eventWithCoords = event.touches[0];
		}
		
//		if (eventWithCoords.target == this.bufferCanvases[0]) {
//			if (
//		}
	}
	
	CanvasRenderer.prototype.mouseMoveHandler = function(e) {
		
		/*
		if (currentMouseInCanvas === true) {
		//	wheelZoomEnabled = true;
		} else {
			currentMouseInCanvas = true;
		}
		*/
		
		currentMouseInCanvas = true;

		mouseMoveTimeout = setTimeout(function() {
			mouseMoveTimeout = null;		
		}, 1000/100);
		
		var event = e;
		var touch = false;
		
		if (e.touches) {						
			e.preventDefault();
			touch = true;
			
			// Pinch to zoom
			if (e.touches.length >= 2) {
				var canvasOffset = [
					renderer.canvas.parentElement.offsetLeft,
					-renderer.canvas.parentElement.offsetTop];
				
				curTouch1Position[0] = event.touches[0].clientX + canvasOffset[0];
				curTouch1Position[1] = event.touches[0].clientY + canvasOffset[1];
				
				curTouch2Position[0] = event.touches[1].clientX + canvasOffset[0];
				curTouch2Position[1] = event.touches[1].clientY + canvasOffset[1];
				
				curTouchDistance = Math.sqrt(
					Math.pow(prevTouch2Position[0] - prevTouch1Position[0], 2)
					+ Math.pow(prevTouch2Position[1] - prevTouch1Position[1], 2));
				
				var displacement1 = 
					[curTouch1Position[0] - prevTouch1Position[0],
					curTouch1Position[1] - prevTouch1Position[1]];
					
				var displacement2 = 
					[curTouch2Position[0] - prevTouch2Position[0],
					curTouch2Position[1] - prevTouch2Position[1]];
						
				var averageDisplacement =
					[(displacement1[0] + displacement2[0]) / 2,
					(displacement2[1] + displacement2[1]) / 2];
				
				var zoomFactor = curTouchDistance / prevTouchDistance;
				
				if (zoomFactor > 1) {
					zoomFactor = (zoomFactor - 1) * 1.5 + 1;
				} else {
					zoomFactor = 1 - (1 - zoomFactor) * 1.5;
				}
				
				skipNextViewportRedraw = true;
				
				cy.panBy({x: averageDisplacement[0], 
							y: averageDisplacement[1]});
				
				cy.zoom({level: cy.zoom() * zoomFactor,
					position: {x: (curTouch1Position[0] + curTouch2Position[0]) / 2,
								y: (curTouch1Position[1] + curTouch2Position[1]) / 2}});
				
				prevTouch1Position[0] = curTouch1Position[0];
				prevTouch1Position[1] = curTouch1Position[1];
				
				prevTouch2Position[0] = curTouch2Position[0];
				prevTouch2Position[1] = curTouch2Position[1];
				
				prevTouchDistance = curTouchDistance;
				
//				console.log(">= 2 touches, exiting");
				return;	
			}
			
			e = e.touches[0];
			e.button = 0;
		}
		
		var mouseDownEvent = event;
		
//		var renderer = cy.renderer();
		
		// Get references to helper functions
		var dragHandler = renderer.mouseMoveHelper.dragHandler;
		var checkBezierEdgeHover = renderer.mouseMoveHelper.checkBezierEdgeHover;
		var checkStraightEdgeHover = renderer.mouseMoveHelper.checkStraightEdgeHover;
		var checkNodeHover = renderer.mouseMoveHelper.checkNodeHover;
		var hoverHandler = renderer.mouseMoveHelper.hoverHandler;
		
		// Offset for Cytoscape container
		// var mouseOffsetX = cy.container().offset().left + 2;
		// var mouseOffsetY = cy.container().offset().top + 2;
		
		var edges = cy.edges();
		var nodes = cy.nodes();
		
		//cy.renderer().canvas.style.cursor = "default";
		
		mouseDownTime = undefined;
		
		// Drag pan
		if (dragPanMode) {
			dragHandler(e);
		}
		
		var current = cy.renderer().projectMouse(e);
		
		currentMouseX = e.screenX;
		// console.log(previousMouseX, currentMouseX);
		if (previousMouseX !== undefined && Math.abs(previousMouseX - currentMouseX) > 1) {
			// console.log(previousMouseX, currentMouseX);
			wheelZoomEnabled = true;
		}
		
		previousMouseX = currentMouseX;
		
//		console.log("current: " + current[0] + ", " + current[1]);
		
		// Update selection box
		selectBox[2] = current[0];
		selectBox[3] = current[1];
		
//		console.log("sel after: " + selectBox[2] + ", " + selectBox[3]);
		
		if (!selectBox[4]) {
			hoverHandler(nodes, edges, e);
		}
		
		// No mouseclick
		currentMouseDownNode = undefined;
		currentMouseDownEdge = undefined;
		currentMouseDownUnmoved = false;
		
		if (minDistanceNode != undefined) {
		
			if (cy.renderer().canvas.style.cursor != 
					minDistanceNode._private.style["cursor"].value) {

				cy.renderer().canvas.style.cursor = 
					minDistanceNode._private.style["cursor"].value;
			}
			
			if (currentHoveredNode !== minDistanceNode) {

				// Proxy mouseout
				if (currentHoveredNode !== undefined) {
					if (touch) {
//						event.type = "touchend";
					} else {
//						event.type = "mouseout";
						currentHoveredNode.trigger("mouseout");
					}					
				}
				
				currentHoveredNode = minDistanceNode;
				
				var nodeGrabbed = minDistanceNode.grabbed();
				
				// Proxy mouseover
				if (touch && !nodeGrabbed) {
//					event.type = "touchmove";
				} else if (!touch && !nodeGrabbed) {
//					event.type = "mouseover";
					minDistanceNode.trigger("mouseover");
				}
				
			} else {
			
				// Proxy mousemove/touchmove
				if (touch) {
//					event.type = "touchmove";
					minDistanceNode.trigger("touchmove");
				} else {
//					event.type = "mousemove";
					minDistanceNode.trigger("mousemove");
				}
			}
			
		} else if (minDistanceEdge != undefined) {
		
			if (cy.renderer().canvas.style.cursor != 
					minDistanceEdge._private.style["cursor"].value) {

				cy.renderer().canvas.style.cursor = 
					minDistanceEdge._private.style["cursor"].value;
			}
			
			if (currentHoveredEdge !== minDistanceEdge) {

				// Proxy mouseout
				if (currentHoveredEdge !== undefined) {
					if (touch) {

					} else {
						currentHoveredEdge.trigger("mouseout");
					}
				}
				
				currentHoveredEdge = minDistanceEdge;
				
				var edgeGrabbed = minDistanceEdge.grabbed();
				
				// Proxy mouseover
				if (touch && !edgeGrabbed) {

				} else if (!touch && !edgeGrabbed) {
					minDistanceEdge.trigger("mouseover");
				}
				
			} else {
			
				// Proxy mousemove/touchmove
				if (touch) {
					minDistanceEdge.trigger("touchmove");
				} else {
					minDistanceEdge.trigger("mousemove");
				}
			}
			
			/*
			if (currentMouseInCanvas) {
			
				// Proxy mousemove/touchmove
				if (touch) {
					minDistanceEdge.trigger("touchmove");
				} else {
					minDistanceEdge.trigger("mousemove");
				}
				
			} else {
				
				// Proxy mouseover/touchstart
				if (touch) {
					minDistanceEdge.trigger("touchstart");
				} else {
					minDistanceEdge.trigger("mouseover");
				}
				
				currentMouseInCanvas = true;
			}
			*/
			
		} else {
		
			if (!minDistanceNode
				&& !minDistanceEdge
				&& cy.renderer().canvas.style.cursor != "default") {

					cy.renderer().canvas.style.cursor = "default";
			}
			
			// Proxy mouseout for elements
			if (currentHoveredEdge !== undefined) {
				if (touch) {

				} else {
					currentHoveredEdge.trigger("mouseout");
				}
				
				currentHoveredEdge = undefined;
			}
			
			if (currentHoveredNode !== undefined) {
				if (touch) {
					
				} else {
					currentHoveredNode.trigger("mouseout");
				}
				
				currentHoveredNode = undefined;
			}
			
			if (mouseJustEnteredCanvas) {
				// Proxy mouseover
				if (touch) {
	
				} else {
					cy.trigger("mouseover");
				}
				
				currentMouseInCanvas = true;
				mouseJustEnteredCanvas = false;
				
			} else {
//				console.log(currentMouseInCanvas);
				// Proxy mousemove/touchmove
				if (currentMouseInCanvas) {

					if (touch) {
						cy.trigger("touchmove");
					} else {
						cy.trigger("mousemove");
					}
				}
			}	
		}
		
		if (nodeDragging) {
		
			if (!draggedElementsMovedLayer) {
				for (var i = 0; i < nodesBeingDragged.length; i++) {
					nodesBeingDragged[i]._private.rscratch.layer2 = true;
				}
				
				for (var i = 0; i < edgesBeingDragged.length; i++) {
					edgesBeingDragged[i]._private.rscratch.layer2 = true;
				}
				
				renderer.canvasNeedsRedraw[4] = true;
				renderer.redrawReason[4].push("nodes being dragged, moved to drag layer");
				
				renderer.canvasNeedsRedraw[2] = true;
				renderer.redrawReason[2].push("nodes being dragged, moved to drag layer");
				
				draggedElementsMovedLayer = true;
			}
		
			for (var index = 0; index < nodes.length; index++) {
			
				/*
				if ((draggingSelectedNode && nodes[index].selected())
					|| (!draggingSelectedNode && nodes[index] == draggedNode)) {
				*/
				
				if ((draggingSelectedNode && nodes[index].selected())
					|| (!draggingSelectedNode && nodes[index] == draggedNode)) {
					
					if ( !nodes[index]._private.locked && nodes[index]._private.grabbable ) {					
						nodes[index]._private.position.x = 
							nodes[index]._private.rscratch.dragStartX
							+ (selectBox[2] - selectBox[0]);
						nodes[index]._private.position.y = 
							nodes[index]._private.rscratch.dragStartY
							+ (selectBox[3] - selectBox[1]);
							
						// Proxy event
						nodes[index].trigger("drag");
						nodes[index].trigger("position");
					}
				}
			}
			
			renderer.canvasNeedsRedraw[2] = true;
			renderer.redrawReason[2].push("nodes being dragged");
			
			/*
			if (draggingSelectedNode) {
				
			} else {
				draggedNode._private.position.x ==
					draggedNode._private.rscratch.dragStartX
					+ (selectBox[2] - selectBox[0]);
				draggedNode._private.position.y ==
					draggedNode._private.rscratch.dragStartY
					+ (selectBox[3] - selectBox[1]);
					
				console.log("dragging");
				console.log(draggedNode._private.rscratch.dragStartX 
					+ (selectBox[2] - selectBox[0]));
				
				console.log(draggedNode.position());
				console.log("pos:" + draggedNode._private.position.x);
			}
			*/
		}
		
		if (selectBox[4]) {
			renderer.canvasNeedsRedraw[0] = true;
			renderer.redrawReason[0].push("selection boxed moved");
		}
		
		if (dragPanMode || nodeDragging || selectBox[4]) {
			cy.renderer().redraw();
		}
	}
	
	CanvasRenderer.prototype.mouseUpHandler = function(event) {
	
		var touchEvent = undefined;
		
		if (event.changedTouches) {						
			event.preventDefault();
			
//			console.log("touchUp, " + event.changedTouches.length);
			
			touchEvent = event;
			
			event = event.changedTouches[0];
			event.button = 0;

			selectBox[2] = renderer.projectMouse(event)[0];
			selectBox[3] = renderer.projectMouse(event)[1];
		}
		
		var mouseDownEvent = event;
	
		var edges = cy.edges();
		var nodes = cy.nodes();
	
		var nodeBeingDragged = nodeDragging
				&& (Math.abs(selectBox[2] - selectBox[0]) 
				+ Math.abs(selectBox[3] - selectBox[1]) > 1);
				
		/*
		console.log("dx: " + Math.abs(selectBox[2] - selectBox[0]));
		console.log("dy: " + Math.abs(selectBox[3] - selectBox[1]));
		console.log("start: " + selectBox[0] + ", " + selectBox[1]);
		console.log("end: " + selectBox[2] + ", " + selectBox[3]);
		*/
		
		/*	
		if (draggedNode != undefined) {
			draggedNode._private.rscratch.layer2 = false;
		}
		*/
		
		for (var i = 0; i < nodesBeingDragged.length; i++) {
			nodesBeingDragged[i]._private.rscratch.layer2 = false;

			// Proxy free() event
			nodesBeingDragged[i]._private.grabbed = false;
			nodesBeingDragged[i].trigger("free");
		}
		
		nodesBeingDragged = [];
		
		for (var i = 0; i < edgesBeingDragged.length; i++) {
			edgesBeingDragged[i]._private.rscratch.layer2 = false;
		}
		
		// Proxy mouseup event
		var mouseUpElement = undefined;
		if (minDistanceNode !== undefined) {
			mouseUpElement = minDistanceNode;
		} else if (minDistanceEdge !== undefined) {
			mouseUpElement = minDistanceEdge;
		}
		
		mouseDownTime = undefined;
		
		var mouseUpEventName = undefined;
		if (touchEvent) {
			mouseUpEventName = "touchend";
		} else {
			mouseUpEventName = "mouseup";
		}
		
		if (mouseUpElement != undefined) {
			mouseUpElement.trigger(mouseUpEventName);

			if (mouseUpElement === currentMouseDownNode ||
				mouseUpElement === currentMouseDownEdge) {
				
				mouseUpElement.trigger("click");
			}
		} else {
			cy.trigger(mouseUpEventName);
		
			if (currentMouseDownUnmoved) {
				cy.trigger("click");
			}
		}
		
		// Deselect if not dragging or selecting additional
		if (!shiftDown && 
			!nodeBeingDragged) {
			
			var elementsToUnselect = cy.collection();
			
			for (var index = 0; index < nodes.length; index++) {
				nodes[index]._private.rscratch.selected = false;
				if (nodes[index]._private.selected) {
					// nodes[index].unselect();
					
					elementsToUnselect = elementsToUnselect.add(nodes[index]);
				}
			}
			
			for (var index = 0; index < edges.length; index++) {
				edges[index]._private.rscratch.selected = false;
				if (edges[index]._private.selected) {
					// edges[index].unselect();
					
					elementsToUnselect = elementsToUnselect.add(edges[index]);
				}
			}
			
			if (elementsToUnselect.length > 0) {
				elementsToUnselect.unselect();
			}
		}
		
		if (selectBox[4] == 1
			&& !nodeDragging
			&& Math.abs(selectBox[2] - selectBox[0]) 
				+ Math.abs(selectBox[3] - selectBox[1]) > 2) {
			
			var padding = 2;
			
			var edgeSelected;
			var select;
			
			var elementsToSelect = cy.collection();
			
			for (var index = 0; index < edges.length; index++) {
			
				edgeSelected = edges[index]._private.selected;

				var boxInBezierVicinity;
				var rscratch = edges[index]._private.rscratch;
				
				if (edges[index]._private.rscratch.isStraightEdge) {
				
					boxInBezierVicinity = $$.math.boxInBezierVicinity(
						selectBox[0], selectBox[1],
						selectBox[2], selectBox[3],
						edges[index]._private.rscratch.startX,
						edges[index]._private.rscratch.startY,
						(edges[index]._private.rscratch.startX + 
						 edges[index]._private.rscratch.endX) / 2,
						(edges[index]._private.rscratch.startY + 
						 edges[index]._private.rscratch.endY) / 2,
						edges[index]._private.rscratch.endX,
						edges[index]._private.rscratch.endY, padding);
						
				} else if (edges[index]._private.rscratch.isSelfEdge) {
				
					boxInBezierVicinity = $$.math.boxInBezierVicinity(
						selectBox[0], selectBox[1],
						selectBox[2], selectBox[3],
						edges[index]._private.rscratch.startX,
						edges[index]._private.rscratch.startY,
						edges[index]._private.rscratch.cp2ax,
						edges[index]._private.rscratch.cp2ay,
						edges[index]._private.rscratch.selfEdgeMidX,
						edges[index]._private.rscratch.selfEdgeMidY, padding);
					
					if (boxInBezierVicinity == 0) {
					
						boxInBezierVicinity = $$.math.boxInBezierVicinity(
							selectBox[0], selectBox[1],
							selectBox[2], selectBox[3],
							edges[index]._private.rscratch.selfEdgeMidX,
							edges[index]._private.rscratch.selfEdgeMidY,
							edges[index]._private.rscratch.cp2cx,
							edges[index]._private.rscratch.cp2cy,
							edges[index]._private.rscratch.endX,
							edges[index]._private.rscratch.endY, padding);
						
					}
					
				} else {
					
					boxInBezierVicinity = $$.math.boxInBezierVicinity(
							selectBox[0], selectBox[1],
							selectBox[2], selectBox[3],
							edges[index]._private.rscratch.startX,
							edges[index]._private.rscratch.startY,
							edges[index]._private.rscratch.cp2x,
							edges[index]._private.rscratch.cp2y,
							edges[index]._private.rscratch.endX,
							edges[index]._private.rscratch.endY, padding);
					
				}
				
				if (boxInBezierVicinity == 2) {
					select = true;
				} else if (boxInBezierVicinity == 1) {
					
					if (edges[index]._private.rscratch.isSelfEdge) {
					
						select = $$.math.checkBezierCrossesBox(
								selectBox[0], selectBox[1],
								selectBox[2], selectBox[3],
								edges[index]._private.rscratch.startX,
								edges[index]._private.rscratch.startY,
								edges[index]._private.rscratch.cp2ax,
								edges[index]._private.rscratch.cp2ay,
								edges[index]._private.rscratch.selfEdgeMidX,
								edges[index]._private.rscratch.selfEdgeMidY, padding);
						
						if (!select) {
						
							select = $$.math.checkBezierCrossesBox(
								selectBox[0], selectBox[1],
								selectBox[2], selectBox[3],
								edges[index]._private.rscratch.selfEdgeMidX,
								edges[index]._private.rscratch.selfEdgeMidY,
								edges[index]._private.rscratch.cp2cx,
								edges[index]._private.rscratch.cp2cy,
								edges[index]._private.rscratch.endX,
								edges[index]._private.rscratch.endY, padding);
						}
										
					} else if (edges[index]._private.rscratch.isStraightEdge) {
						
						select = $$.math.checkStraightEdgeCrossesBox(
								selectBox[0], selectBox[1],
								selectBox[2], selectBox[3],
								edges[index]._private.rscratch.startX,
								edges[index]._private.rscratch.startY,
								edges[index]._private.rscratch.endX,
								edges[index]._private.rscratch.endY, padding);
	
					} else {
						
						select = $$.math.checkBezierCrossesBox(
								selectBox[0], selectBox[1],
								selectBox[2], selectBox[3],
								edges[index]._private.rscratch.startX,
								edges[index]._private.rscratch.startY,
								edges[index]._private.rscratch.cp2x,
								edges[index]._private.rscratch.cp2y,
								edges[index]._private.rscratch.endX,
								edges[index]._private.rscratch.endY, padding);
						
					}
				} else {
					select = false;
				}
				
				if (select && !edgeSelected) {
					// edges[index].select();
					
					elementsToSelect = elementsToSelect.add(edges[index]);
				} else if (!select && edgeSelected) {
					// edges[index].unselect();
				}
			}
			
			var boxMinX = Math.min(selectBox[0], selectBox[2]);
			var boxMinY = Math.min(selectBox[1], selectBox[3]);
			var boxMaxX = Math.max(selectBox[0], selectBox[2]);
			var boxMaxY = Math.max(selectBox[1], selectBox[3]);
			
			var nodeSelected, select;
			
			var nodePosition, boundingRadius;
			for (var index = 0; index < nodes.length; index++) {
				nodeSelected = nodes[index]._private.selected;

				nodePosition = nodes[index].position();
				boundingRadius = nodes[index]._private.data.weight / 5.0;
				
				if (nodePosition.x > boxMinX
						- boundingRadius
					&& nodePosition.x < boxMaxX 
						+ boundingRadius
					&& nodePosition.y > boxMinY
						- boundingRadius
					&& nodePosition.y < boxMaxY
						+ boundingRadius) {
					
					select = true;
					nodes[index]._private.rscratch.selected = true;		
				} else {
					select = false;
					nodes[index]._private.rscratch.selected = false;
				}
				
				if (select && !nodeSelected) {
					// nodes[index].select();	
					
					elementsToSelect = elementsToSelect.add(nodes[index]);
				} else if (!select && nodeSelected) {
					// nodes[index].unselect();				
				}
			}
			
			if (elementsToSelect.length > 0) {
				elementsToSelect.select();
			}
			
		} else if (selectBox[4] == 0 && !nodeBeingDragged) {

			// Single node/edge selection
			if (minDistanceNode != undefined) {
				minDistanceNode._private.rscratch.hovered = false;
				minDistanceNode._private.rscratch.selected = true;
				
				if (!minDistanceNode._private.selected) {
					minDistanceNode.select();
				}
			} else if (minDistanceEdge != undefined) {
				minDistanceEdge._private.rscratch.hovered = false;
				minDistanceEdge._private.rscratch.selected = true;
				
				if (!minDistanceEdge._private.selected) {
					minDistanceEdge.select();
				}
			}
		}
	
		// Stop drag panning on mouseup
		dragPanMode = false;
//		console.log("drag pan stopped");
		
		if (cy.renderer().canvas.style.cursor != "default") {
			cy.renderer().canvas.style.cursor = "default";
		}
		
		selectBox[4] = 0;
//		selectBox[2] = selectBox[0];
//		selectBox[3] = selectBox[1];
		
		
		renderer.canvasNeedsRedraw[0] = true;
		renderer.redrawReason[0].push("Selection box gone");
		
		if (nodeBeingDragged) {
			renderer.canvasNeedsRedraw[2] = true;
			renderer.redrawReason[2].push("Node drag completed");
			
			renderer.canvasNeedsRedraw[4] = true;
			renderer.redrawReason[4].push("Node drag completed");
		}
		
		// Stop node dragging on mouseup
		nodeDragging = false;
		
		cy.renderer().redraw();
		
		if (touchEvent && touchEvent.touches.length == 1) {
			dragPanStartX = touchEvent.touches[0].clientX;
			dragPanStartY = touchEvent.touches[0].clientY;
			
			dragPanMode = true;
			
			if (cy.renderer().canvas.style.cursor 
				!= cy.style()._private.coreStyle["panning-cursor"].value) {

				cy.renderer().canvas.style.cursor 
					= cy.style()._private.coreStyle["panning-cursor"].value;
			}
		}
	}
	
	CanvasRenderer.prototype.windowMouseDownHandler = function(event) {
		
	}
	
	CanvasRenderer.prototype.windowMouseMoveHandler = function(event) {
		
	}
	
	CanvasRenderer.prototype.windowMouseUpHandler = function(event) {
		
	}
	
	CanvasRenderer.prototype.mouseWheelHandler = function(event) {
		
		if (!wheelZoomEnabled) {
			return;
		} else {
			event.preventDefault();
		}
		
		var deltaY = event.wheelDeltaY;
		
		cy.renderer().zoomLevel -= deltaY / 5.0 / 500;
		
		//console.log("zoomLevel: " + cy.renderer().zoomLevel);
		cy.renderer().scale[0] = Math.pow(10, -cy.renderer().zoomLevel);
		cy.renderer().scale[1] = Math.pow(10, -cy.renderer().zoomLevel);
		
		var current = cy.renderer().projectMouse(event);
		
		var zoomLevel = cy.zoom() * Math.pow(10, event.wheelDeltaY / 500);

		zoomLevel = Math.min(zoomLevel, 100);
		zoomLevel = Math.max(zoomLevel, 0.01);
		
		cy.zoom({level: zoomLevel, 
				position: {x: event.offsetX, 
							y: event.offsetY}});
		
		
		/*
		cy.zoom({level: zoomLevel, 
					renderedPosition: {x: current[0], 
							y: current[1]}});
		*/
		
//		cy.renderer().redraw();
	}
	
	CanvasRenderer.prototype.keyDownHandler = function(event) {
		if (event.keyCode == 16 && selectBox[4] != 1) {
			shiftDown = true;
		}
	}
	
	CanvasRenderer.prototype.keyUpHandler = function(event) {
		if (event.keyCode == 16) {
			selectBox[4] = 0;
			shiftDown = false;
		}
	}
	
	CanvasRenderer.prototype.mouseMoveHelper = function() {
		var dragHandler = function(mouseMoveEvent) {
			var offsetX = mouseMoveEvent.clientX - dragPanStartX;
			var offsetY = mouseMoveEvent.clientY - dragPanStartY;
			
			cy.panBy({x: offsetX, y: offsetY});

			dragPanStartX = mouseMoveEvent.clientX;
			dragPanStartY = mouseMoveEvent.clientY;

			/*
			cy.renderer().center[0] = dragPanInitialCenter[0] - offsetX / cy.renderer().scale[0];
			cy.renderer().center[1] = dragPanInitialCenter[1] - offsetY / cy.renderer().scale[1];
			*/
		};
		
		var checkBezierEdgeHover = function(mouseX, mouseY, edge) {
		
			// var squaredDistanceLimit = 19;
			var squaredDistanceLimit = Math.pow(edge._private.style["width"].value / 2, 2);
			var edgeWithinDistance = false;
		
			if ($$.math.inBezierVicinity(
					mouseX, mouseY,
					edge._private.rscratch.startX,
					edge._private.rscratch.startY,
					edge._private.rscratch.cp2x,
					edge._private.rscratch.cp2y,
					edge._private.rscratch.endX,
					edge._private.rscratch.endY,
					squaredDistanceLimit)) {
				
				//console.log("in vicinity")
				
				// edge._private.rscratch.selected = true;
				
				var squaredDistance = $$.math.sqDistanceToQuadraticBezier(
					mouseX,
					mouseY,
					edge._private.rscratch.startX,
					edge._private.rscratch.startY,
					edge._private.rscratch.cp2x,
					edge._private.rscratch.cp2y,
					edge._private.rscratch.endX,
					edge._private.rscratch.endY);
				
				// debug(distance);
				if (squaredDistance <= squaredDistanceLimit) {
					edgeWithinDistance = true;
					
					if (squaredDistance < minDistanceEdgeValue) {
						minDistanceEdge = edge;
						minDistanceEdgeValue = squaredDistance;
					}
				}	
			}
			
			return edgeWithinDistance;
		}
		
		var checkSelfEdgeHover = function(mouseX, mouseY, edge) {
			
			// var squaredDistanceLimit = 19;
			var squaredDistanceLimit = Math.pow(edge._private.style["width"].value / 2, 2);
			var edgeWithinDistance = false;
			var edgeFound = false;
			
			if ($$.math.inBezierVicinity(
					mouseX, mouseY,
					edge._private.rscratch.startX,
					edge._private.rscratch.startY,
					edge._private.rscratch.cp2ax,
					edge._private.rscratch.cp2ay,
					edge._private.rscratch.selfEdgeMidX,
					edge._private.rscratch.selfEdgeMidY)) {
				
				var squaredDistance = $$.math.sqDistanceToQuadraticBezier(
					mouseX, mouseY,
					edge._private.rscratch.startX,
					edge._private.rscratch.startY,
					edge._private.rscratch.cp2ax,
					edge._private.rscratch.cp2ay,
					edge._private.rscratch.selfEdgeMidX,
					edge._private.rscratch.selfEdgeMidY);
				
				// debug(distance);
				if (squaredDistance < squaredDistanceLimit) {
					
					edgeWithinDistance = true;
					
					if (squaredDistance < minDistanceEdgeValue) {
						minDistanceEdge = edge;
						minDistanceEdgeValue = squaredDistance;
						edgeFound = true;
					}
				}
			}
			
			// Perform the check with the second of the 2 quadratic Beziers
			// making up the self-edge if the first didn't pass
			if (!edgeFound && $$.math.inBezierVicinity(
					mouseX, mouseY,
					edge._private.rscratch.selfEdgeMidX,
					edge._private.rscratch.selfEdgeMidY,
					edge._private.rscratch.cp2cx,
					edge._private.rscratch.cp2cy,
					edge._private.rscratch.endX,
					edge._private.rscratch.endY)) {
				
				var squaredDistance = $$.math.sqDistanceToQuadraticBezier(
					mouseX, mouseY,
					edge._private.rscratch.selfEdgeMidX,
					edge._private.rscratch.selfEdgeMidY,
					edge._private.rscratch.cp2cx,
					edge._private.rscratch.cp2cy,
					edge._private.rscratch.endX,
					edge._private.rscratch.endY);
					
				// debug(distance);
				if (squaredDistance < squaredDistanceLimit) {
					
					edgeWithinDistance = true;
					
					if (squaredDistance < minDistanceEdgeValue) {
						minDistanceEdge = edge;
						minDistanceEdgeValue = squaredDistance;
						edgeFound = true;
					}
				}
			}
			
			return edgeWithinDistance;
		}
		
		var checkStraightEdgeHover = function(mouseX, mouseY, edge, x1, y1, x2, y2) {
			
			// var squaredDistanceLimit = 19;
			var squaredDistanceLimit = Math.pow(edge._private.style["width"].value / 2, 2);
			
			var nearEndOffsetX = mouseX - x1;
			var nearEndOffsetY = mouseY - y1;
			
			var farEndOffsetX = mouseX - x2;
			var farEndOffsetY = mouseY - y2;
			
			var displacementX = x2 - x1;
			var displacementY = y2 - y1;
			
			var distanceSquared;
			var edgeWithinDistance = false;
			
			if (nearEndOffsetX * displacementX 
				+ nearEndOffsetY * displacementY <= 0) {
				
					distanceSquared = (Math.pow(x1 - mouseX, 2)
						+ Math.pow(y1 - mouseY, 2));
			
			} else if (farEndOffsetX * displacementX 
				+ farEndOffsetY * displacementY >= 0) {
				
					distanceSquared = (Math.pow(x2 - mouseX, 2)
						+ Math.pow(y2 - mouseY, 2));
				
			} else {
				var rotatedX = displacementY;
				var rotatedY = -displacementX;
			
				// Use projection on rotated vector
				distanceSquared = Math.pow(nearEndOffsetX * rotatedX 
					+ nearEndOffsetY * rotatedY, 2)
					/ (rotatedX * rotatedX + rotatedY * rotatedY);
			}
			
			if (distanceSquared <= squaredDistanceLimit) {
				edgeWithinDistance = true;
			
				if (distanceSquared < minDistanceEdgeValue) {
					minDistanceEdge = edge;
					minDistanceEdgeValue = distanceSquared;
				}
			}
			
			return edgeWithinDistance;
		}
		
		var checkNodeHover = function(mouseX, mouseY, node) {
			var dX = mouseX - node.position().x;
			var dY = mouseY - node.position().y;
			
			/*
			console.log(node._private.rscratch.boundingRadiusSquared);
			console.log(dX * dX + dY * dY);
			*/
			
			var boundingRadiusSquared = Math.pow(
				Math.max(
					node._private.style["width"].value, 
					node._private.style["height"].value
						+ node._private.style["border-width"].value) / 2, 2);
			
			var distanceSquared = dX * dX + dY * dY;
			
			if (boundingRadiusSquared > distanceSquared) {
				
				if (distanceSquared < minDistanceNodeValue) {
					minDistanceNode = node;
					minDistanceNodeValue = distanceSquared;
					
					nodeHovered = true;
				}
				
				return true;
			}
			
			return false;
		}
	
		var hoverHandler = function(nodes, edges, mouseMoveEvent) {
			
			// Project mouse coordinates to world absolute coordinates
			var projected = cy.renderer().projectMouse(mouseMoveEvent); 

			/*
			console.log("projected x: " + projected[0]);
			console.log("projected y: " + projected[1]);
			cy.nodes()[0]._private.position.x = projected[0];
			cy.nodes()[0]._private.position.y = projected[1];
			*/
			
			var mouseX = projected[0];
			var mouseY = projected[1];
			
			if (minDistanceNode != undefined) {
				minDistanceNode = undefined;
				minDistanceNodeValue = 99999;
		
			} else if (minDistanceEdge != undefined) {
				minDistanceEdge = undefined;
				minDistanceEdgeValue = 99999;
			}
			
			nodeHovered = false;
			
			for (var index = 0; index < nodes.length; index++) {
				checkNodeHover(mouseX, mouseY, nodes[index]);
			}
			
			var edgeWithinDistance = false;
			var potentialPickedEdges = [];
			
			for (var index = 0; index < edges.length; index++) {
				if (nodeHovered) {
					break;
				} else if (edges[index]._private.rscratch.isStraightEdge) {
					edgeWithinDistance = checkStraightEdgeHover(
						mouseX, mouseY, edges[index],
						edges[index]._private.rscratch.startX,
						edges[index]._private.rscratch.startY,
						edges[index]._private.rscratch.endX,
						edges[index]._private.rscratch.endY);
				} else if (edges[index]._private.rscratch.isSelfEdge) {
					edgeWithinDistance = checkSelfEdgeHover(
						mouseX, mouseY, edges[index]);
				} else {
					edgeWithinDistance = checkBezierEdgeHover(
						mouseX, mouseY, edges[index]);
				}
				
				if (edgeWithinDistance) {
					potentialPickedEdges.push(edges[index]);
				}
				
				edgeWithinDistance = false;
			}
			
			if (potentialPickedEdges.length > 0) {
				potentialPickedEdges.sort(function(a, b) {
					return b._private.data.id.localeCompare(a._private.data.id);
				});
				
				potentialPickedEdges.sort(function(a, b) {
					return b._private.style["z-index"].value
						- a._private.style["z-index"].value
				});
				
				minDistanceEdge = potentialPickedEdges[0];
			} else {
				minDistanceEdge = undefined;
			}
			
			if (minDistanceNode != undefined) {
				minDistanceNode._private.rscratch.hovered = true;
			} else if (minDistanceEdge != undefined) {
				minDistanceEdge._private.rscratch.hovered = true;
			}
		}
		
		// Make these related functions (they reference each other) available
		this.mouseMoveHelper.dragHandler = dragHandler;
		this.mouseMoveHelper.checkBezierEdgeHover = checkBezierEdgeHover;
		this.mouseMoveHelper.checkStraightEdgeHover = checkStraightEdgeHover;
		this.mouseMoveHelper.checkNodeHover = checkNodeHover;
		this.mouseMoveHelper.hoverHandler = hoverHandler;
	}
	
	CanvasRenderer.prototype.load = function() {
		var self = this;
		
		this.mouseMoveHelper();
		
		document.addEventListener("keydown", this.keyDownHandler, false);
		document.addEventListener("keyup", this.keyUpHandler, false);
	
		this.bufferCanvases[0].addEventListener("mousedown", this.mouseDownHandler, false);
		window.addEventListener("mouseup", this.mouseUpHandler, false);
	
		window.addEventListener("mousemove", this.mouseMoveHandler, false);
		this.bufferCanvases[0].addEventListener("mouseout", this.mouseOutHandler, false);
		this.bufferCanvases[0].addEventListener("mouseover", this.mouseOverHandler, false);
		
		
		window.addEventListener("mousedown", this.windowMouseDownHandler, false);
		window.addEventListener("mousemove", this.windowMouseMoveHandler, false);
		window.addEventListener("mouseup", this.windowMouseUpHandler, false);
		
		this.bufferCanvases[0].addEventListener("mousewheel", this.mouseWheelHandler, false);
		
//		document.addEventListener("mousemove", this.documentMouseMoveHandler, false);
		
//		document.addEventListener("mousewheel", this.mouseWheelHandler, false);
	
		this.bufferCanvases[0].addEventListener("touchstart", this.mouseDownHandler, true);
		this.bufferCanvases[0].addEventListener("touchmove", this.mouseMoveHandler, true);
		this.bufferCanvases[0].addEventListener("touchend", this.mouseUpHandler, true);
		
		/*
		this.bufferCanvases[0].addEventListener("touchstart", this.mouseDownHandler, true);
		this.bufferCanvases[0].addEventListener("touchmove", this.mouseMoveHandler, true);
		this.bufferCanvases[0].addEventListener("touchend", this.mouseUpHandler, true);
		*/
	}
	
	CanvasRenderer.prototype.init = function() {}

	CanvasRenderer.prototype.complexSqrt = function(real, imaginary, zeroThreshold) {
		var hyp = Math.sqrt(real * real 
			+ imaginary * imaginary)
	
		var gamma = Math.sqrt(0.5 * (real + hyp));
			
		var sigma = Math.sqrt(0.5 * (hyp - real));
		if (imaginary < -zeroThreshold) {
			sigma = -sigma;
		} else if (imaginary < zeroThreshold) {
			sigma = 0;
		}
		
		return [gamma, sigma];
	}

	CanvasRenderer.prototype.initStyle = function() {
		var nodes = this.options.cy.nodes();
		var edges = this.options.cy.edges();
		
		var node;
		for (var index = 0; index < nodes.length; index++) {
			node = nodes[index];
			
			/*
			node._private.rscratch.boundingRadiusSquared = 
				Math.pow(node._private.style.size, 2);
				*/
			node._private.rscratch.override = {};
			
			// console.log(node._private.rscratch.override);
			
			var color = Math.max(Math.random(), 0.6);
			node._private.rscratch.override.regularColor = "rgba(" 
				+ String(Math.floor(color * 100 + 125)) + "," 
				+ String(Math.floor(color * 100 + 125)) + "," 
				+ String(Math.floor(color * 100 + 125)) + "," + 255 + ")"; 
			
			//String(color * 16777215);
			node._private.rscratch.override.regularBorderColor = "rgba(" 
				+ String(Math.floor(color * 70 + 160)) + "," 
				+ String(Math.floor(color * 70 + 160)) + "," 
				+ String(Math.floor(color * 70 + 160)) + "," + 255 + ")"; 
			
			var shape = Math.random();
			if (shape < 10.35) {
				node._private.rscratch.override.shape = "ellipse";
			} else if (shape < 0.49) {
				node._private.rscratch.override.shape = "hexagon";
			} else if (shape < 0.76) {
				node._private.rscratch.override.shape = "square";
			} else if (shape < 0.91) {
				node._private.rscratch.override.shape = "pentagon";
			} else {
				node._private.rscratch.override.shape = "octogon";
			}
			
			node._private.rscratch.canvas = document.createElement('canvas');
		}
		
		var edge;
		for (var index = 0; index < edges.length; index++) {
			edge = edges[index];
			
			edge._private.rscratch.cp2x = Math.random() 
				* this.options.cy.container().width();
			edge._private.rscratch.cp2y = Math.random() 
				* this.options.cy.container().height();
			
			edge._private.rscratch.override = {};
			
			if (Math.random() < 0.45) {
				edge._private.rscratch.override.endShape = "inhibitor";
			}
			
			edge._private.rscratch.override.regularColor = 
				edge.source()[0]._private.rscratch.override.regularBorderColor
				|| defaultNode.regularColor;
		}
	}
	
	CanvasRenderer.prototype.findBezierIntersection = function(edge, targetRadius) {
		
		var x1 = edge.source().position().x;
		var x3 = edge.target().position().x;
		var y1 = edge.source().position().y;
		var y3 = edge.target().position().y;
		
		var approxParam;
		
		var cp2x = edge._private.rscratch.cp2x;
		var cp2y = edge._private.rscratch.cp2y;
		
		approxParam = 0.5 + (0.5 - 0.5 * targetRadius / Math.sqrt(
			Math.pow(cp2x - x3, 2) + Math.pow(cp2y - y3, 2)));
		
		// console.log("approxParam: " + approxParam);
		
		var aX = x1 - 2 * cp2x + x3;
		var bX = -2 * x1 + 2 * cp2x;
		var cX = x1;

		var aY = y1 - 2 * cp2y + y3;
		var bY = -2 * y1 + 2 * cp2y;
		var cY = y1;
		
		var newEndPointX = aX * approxParam * approxParam + bX * approxParam + cX;
		var newEndPointY = aY * approxParam * approxParam + bY * approxParam + cY;
		
		var tan1ax = cp2x - x1;
		var tan1bx = x1;
		
		var tan1ay = cp2y - y1;
		var tan1by = y1;
		
		var tan2ax = newEndPointX - x3;
		var tan2bx = x3;
		
		var tan2ay = newEndPointY - y3;
		var tan2by = y3;
		
		var k;
		if (Math.abs(tan1ax) > 0.0001) {
			k = (tan1ay / tan1ax * (tan2bx - tan1bx) + tan1by - tan2by)
				/ (tan2ay - (tan1ay / tan1ax) * tan2ax);
		} else {
			k = (tan1bx - tan2bx) / (tan2ax);
		}
		
		// console.log("k: " + k);
		
		var newCp2x = tan2ax * k + tan2bx;
		var newCp2y = tan2ay * k + tan2by;

		edge._private.rscratch.newCp2x = newCp2x;
		edge._private.rscratch.newCp2y = newCp2y;
		
		edge._private.rscratch.newEndPointX = newEndPointX;
		edge._private.rscratch.newEndPointY = newEndPointY;
		
		/*
		console.log(newCp2x + ", " + newCp2y);
		console.log(newEndPointX + ", " + newEndPointY);
		*/
	}
	
	CanvasRenderer.prototype.findIntersection = function(x1, y1, x2, y2, targetRadius) {
		var dispX = x2 - x1;
		var dispY = y2 - y1;
		
		var len = Math.sqrt(dispX * dispX + dispY * dispY);
		
		var newLength = len - targetRadius;

		if (newLength < 0) {
			newLength = 0;
		}
		
		return [(newLength / len) * dispX + x1, (newLength / len) * dispY + y1];
	}
	
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
	
	// Finds new endpoints for a bezier edge based on desired source and target radii
	CanvasRenderer.prototype.findNewEndPoints 
		= function(startX, startY, cp2x, cp2y, endX, endY, radius1, radius2) {
		
		var startNearPt = this.findCircleNearPoint(startX, startY, radius1, cp2x, cp2y);
		var endNearPt = this.findCircleNearPoint(endX, endY, radius2, cp2x, cp2y);
		
		return [startNearPt[0], startNearPt[1], endNearPt[0], endNearPt[1]];
	}
	
	// Calculates new endpoints for all bezier edges based on desired source and 
	// target radii
	CanvasRenderer.prototype.calculateNewEndPoints = function() {
		
		var edges = cy.edges();
		var source, target;
		var endpoints;
		
		for (var i = 0; i < edges.length; i++) {
			source = edges[i].source()[0];
			target = edges[i].target()[0];
			
			if (edges[i]._private.rscratch.isStraightEdge) {
				continue;
			}
			
			endpoints = this.findNewEndPoints(
				source.position().x,
				source.position().y,
				edges[i]._private.rscratch.controlPointX,
				edges[i]._private.rscratch.controlPointY,
				target.position().x,
				target.position().y
			);
				
			edges[i]._private.rscratch.updatedStartX = endpoints[0];
			edges[i]._private.rscratch.updatedStartY = endpoints[1];
			edges[i]._private.rscratch.updatedEndX = endpoints[2];
			edges[i]._private.rscratch.updatedEndY = endpoints[3];
		}
		
	}
	
	arrowShapes["arrow"] = {
		draw: function(context) {
			context.lineTo(-0.15, -0.3);
			context.lineTo(0, 0);
			context.lineTo(0.15, -0.3);
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
		draw: function(context) {
			context.translate(0, -0.15);
			context.arc(0, 0, 0.15, 0, Math.PI * 2, false);
		},
		spacing: function(edge) {
			return 0;
		},
		gap: function(edge) {
			return edge._private.style["width"].value * 2;
		}
	}
	
	arrowShapes["inhibitor"] = {
		draw: function(context) {
			context.lineTo(-0.25, 0);
			context.lineTo(-0.25, -0.1);
			context.lineTo(0.25, -0.1);
			context.lineTo(0.25, 0);
		},
		spacing: function(edge) {
			return 4;
		},
		gap: function(edge) {
			return 4;
		}
	}
	
	arrowShapes["square"] = {
		draw: function(context) {
//			context.translate(-0.15, -0.15);
			context.lineTo(-0.12, 0.00);
			context.lineTo(0.12, 0.00);
			context.lineTo(0.12, -0.24);
			context.lineTo(-0.12, -0.24);
		},
		spacing: function(edge) {
			return 0;
		},
		gap: function(edge) {
			return edge._private.style["width"].value * 2;
		}
	}
	
	arrowShapes["diamond"] = {
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
	
	arrowShapeDrawers["arrow"] = function(context) {
		// context.scale(context.lineWidth, context.lineWidth);
		context.lineTo(-0.15, 0.3);
		context.lineTo(0, 0);
		context.lineTo(0.15, 0.3);
	}
	arrowShapeSpacing["arrow"] = 0;
	arrowShapeGap["arrow"] = 4.5;
	
	arrowShapeDrawers["triangle"] = arrowShapeDrawers["arrow"];
	arrowShapeSpacing["triangle"] = arrowShapeSpacing["arrow"];
	arrowShapeGap["triangle"] = arrowShapeGap["arrow"];
	
	arrowShapeDrawers["none"] = function(context) {};
	arrowShapeSpacing["none"] = 0;
	arrowShapeGap["none"] = 0;
	
	arrowShapeDrawers["circle"] = function(context) {
		context.translate(0, -0.15);
		context.arc(0, 0, 0.15, 0, Math.PI * 2, false);
	};
	arrowShapeSpacing["circle"] = 0;
	arrowShapeGap["circle"] = 0.3;
	
	arrowShapeDrawers["inhibitor"] = function(context) {
		// context.scale(context.lineWidth, context.lineWidth);
		context.lineTo(-0.25, 0);
		context.lineTo(-0.25, -0.1);
		context.lineTo(0.25, -0.1);
		context.lineTo(0.25, 0);
	};
	arrowShapeSpacing["inhibitor"] = 4;
	arrowShapeGap["inhibitor"] = 4;
	
	arrowShapeDrawers["tee"] = arrowShapeDrawers["inhibitor"];
	arrowShapeSpacing["tee"] = arrowShapeSpacing["inhibitor"];
	arrowShapeGap["tee"] = arrowShapeGap["inhibitor"];
	
	CanvasRenderer.prototype.drawArrowShape = function(shape, x, y, dispX, dispY) {
		var angle = Math.asin(dispY / (Math.sqrt(dispX * dispX + dispY * dispY)));
						
		if (dispX < 0) {
			//context.strokeStyle = "AA99AA";
			angle = angle + Math.PI / 2;
		} else {
			//context.strokeStyle = "AAAA99";
			angle = - (Math.PI / 2 + angle);
		}
		
		var context = this.context;
		
		context.save();
		
		context.translate(x, y);
		
		context.moveTo(0, 0);
		context.rotate(-angle);
		
		var size = Math.max(Math.pow(context.lineWidth * 13.37, 0.9), 29);
		/// size = 100;
		context.scale(size, size);
		
		context.beginPath();
		
		arrowShapes[shape].draw(context);
		
		context.closePath();
		
//		context.stroke();
		context.fill();
		context.restore();
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
			
			intersect = nodeShapeIntersectLine[target._private.style["shape"].value](
				target,
				target._private.style["width"].value,
				target._private.style["height"].value,
				cp[0], //halfPointX,
				cp[1] //halfPointY
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

			intersect = nodeShapeIntersectLine[source._private.style["shape"].value](
				source,
				source._private.style["width"].value,
				source._private.style["height"].value,
				cp[0], //halfPointX,
				cp[1] //halfPointY
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
			
			intersect = nodeShapeIntersectLine[target._private.style["shape"].value](
				target,
				target._private.style["width"].value,
				target._private.style["height"].value,
				source.position().x,
				source.position().y);
				
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
		
			intersect = nodeShapeIntersectLine[source._private.style["shape"].value](
				source,
				source._private.style["width"].value,
				source._private.style["height"].value,
				target.position().x,
				target.position().y);
			
			if (intersect.length == 0) {
				edge._private.rscratch.noArrowPlacement = true;
	//			return;
			} else {
				edge._private.rscratch.noArrowPlacement = false;
			}
			
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
			
			intersect = nodeShapeIntersectLine[
				target._private.style["shape"].value](
				target,
				target._private.style["width"].value,
				target._private.style["height"].value,
				cp[0], //halfPointX,
				cp[1] //halfPointY
			);
			
			var arrowEnd = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["target-arrow-shape"].value].spacing(edge));
			var edgeEnd = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["target-arrow-shape"].value].gap(edge));
			
			edge._private.rscratch.endX = edgeEnd[0];
			edge._private.rscratch.endY = edgeEnd[1];
			
			edge._private.rscratch.arrowEndX = arrowEnd[0];
			edge._private.rscratch.arrowEndY = arrowEnd[1];
			
			intersect = nodeShapeIntersectLine[
				source._private.style["shape"].value](
				source,
				source._private.style["width"].value,
				source._private.style["height"].value,
				cp[0], //halfPointX,
				cp[1] //halfPointY
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
	
	CanvasRenderer.prototype.drawArrowhead = function(edge) {
		
		var endShape = edge._private.rscratch.override.endShape;
		endShape = endShape ? endShape : defaultEdge.endShape;
		
		var dispX = edge.target().position().x - edge._private.rscratch.newEndPointX;
		var dispY = edge.target().position().y - edge._private.rscratch.newEndPointY;
		
		this.drawArrowShape(edge, edge._private.rscratch.newEndPointX, 
			edge._private.rscratch.newEndPointY, dispX, dispY);
	}
	
	CanvasRenderer.prototype.drawArrowheads = function(edge) {
		// Displacement gives direction for arrowhead orientation
		var dispX, dispY;

		var startX = edge._private.rscratch.arrowStartX;
		var startY = edge._private.rscratch.arrowStartY;
		
		dispX = startX - edge.source().position().x;
		dispY = startY - edge.source().position().y;
		
		//this.context.strokeStyle = "rgba("
		this.context.fillStyle = "rgba("
			+ edge._private.style["source-arrow-color"].value[0] + ","
			+ edge._private.style["source-arrow-color"].value[1] + ","
			+ edge._private.style["source-arrow-color"].value[2] + ","
			+ edge._private.style.opacity.value + ")";
		
		this.context.lineWidth = edge._private.style["width"].value;
		
		this.drawArrowShape(edge._private.style["source-arrow-shape"].value, 
			startX, startY, dispX, dispY);
		
		var endX = edge._private.rscratch.arrowEndX;
		var endY = edge._private.rscratch.arrowEndY;
		
		dispX = -(edge.target().position().x - endX);
		dispY = -(edge.target().position().y - endY);
		
		//this.context.strokeStyle = "rgba("
		this.context.fillStyle = "rgba("
			+ edge._private.style["target-arrow-color"].value[0] + ","
			+ edge._private.style["target-arrow-color"].value[1] + ","
			+ edge._private.style["target-arrow-color"].value[2] + ","
			+ edge._private.style.opacity.value + ")";
		
		this.context.lineWidth = edge._private.style["width"].value;
		
		this.drawArrowShape(edge._private.style["target-arrow-shape"].value,
			endX, endY, dispX, dispY);
	}
	
	CanvasRenderer.prototype.drawStraightArrowhead = function(edge) {
		
		var dispX = edge.target().position().x 
			- edge._private.rscratch.newStraightEndX;
		var dispY = edge.target().position().y 
			- edge._private.rscratch.newStraightEndY;
		
		this.drawArrowShape(
			edge, edge._private.rscratch.newStraightEndX,
			edge._private.rscratch.newStraightEndY,
			dispX, dispY);
	}
	
	
	CanvasRenderer.prototype.calculateEdgeMetrics = function(edge) {
		if (edge._private.data.source == edge._private.data.target) {
			edge._private.rscratch.selfEdge = true;
			return;
		}
		
		// Calculate the 2nd control point
		var startNode = edge._private.data.source < edge._private.data.target ?
			edge.source()[0] : edge.target()[0];
		var endNode = edge._private.data.target < edge._private.data.source ? 
			edge.source()[0] : edge.target()[0];
		
		var middlePointX = 0.5 * (startNode._private.position.x + endNode._private.position.x);
		var middlePointY = 0.5 * (startNode._private.position.y + endNode._private.position.y);
		
		if (this.nodePairEdgeData[edge._private.rscratch.nodePairId] == 1) {
			edge._private.rscratch.straightEdge = true;
			edge._private.rscratch.cp2x = middlePointX;
			edge._private.rscratch.cp2y = middlePointY;
			
			return;
		}
	
		/*
		console.log(startNode._private);
		console.log(endNode._private);
		*/
		
		var numerator = edge._private.rscratch.nodePairEdgeNum - 1;
		var denominator = this.nodePairEdgeData[edge._private.rscratch.nodePairId] - 1;
		var offsetFactor = (numerator / denominator - 0.5);
		
		if (Math.abs(offsetFactor) < 0.0001) {
			edge._private.rscratch.straightEdge = true;
			edge._private.rscratch.cp2x = middlePointX;
			edge._private.rscratch.cp2y = middlePointY;
			//console.log(edge._private.rscratch.cp2x + ", " + edge._private.rscratch.cp2y);
			return;
		}
		
			
		var displacementX = endNode._private.position.x - startNode._private.position.x;
		var displacementY = endNode._private.position.y - startNode._private.position.y;
		
		var offsetX = displacementY * offsetFactor;
		var offsetY = -displacementX * offsetFactor;
		
		edge._private.rscratch.cp2x = middlePointX + offsetX;
		edge._private.rscratch.cp2y = middlePointY + offsetY;
	}
	
	nodeShapeDrawers["ellipse"] = function(node, width, height) {
		var context = renderer.context;
	
		context.beginPath();
		context.save();
		context.translate(node._private.position.x, node._private.position.y);
		context.scale(width / 2, height / 2);
		// At origin, radius 1, 0 to 2pi
		context.arc(0, 0, 1, 0, Math.PI * 2, false);
		context.closePath();
		context.restore();
		context.fill();
	}
	
	// Intersect node shape vs line from (x, y) to node center
	nodeShapeIntersectLine["ellipse"] = function(
		node, width, height, x, y) {
	
		var intersect = renderer.intersectLineEllipse(
			x, y,
			node.position().x,
			node.position().y,
			width / 2 + node._private.style["border-width"].value / 2,
			height / 2 + node._private.style["border-width"].value / 2);
			
		return intersect;
	}
	
	var generateUnitNgonPoints = function(sides, rotationRadians) {
		
		var increment = 1.0 / sides * 2 * Math.PI;
		var startAngle = sides % 2 == 0 ? 
			Math.PI / 2.0 + increment / 2.0 : Math.PI / 2.0;
		
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
	
	CanvasRenderer.prototype.findPolygonIntersection = function(
		node, width, height, x, y, nodeShape, numSides) {
		
		if (nodeShapePoints[nodeShape] == undefined) {
			nodeShapePoints[nodeShape] = generateUnitNgonPoints(numSides, 0);
		}
		
		var intersections = renderer.polygonIntersectLine(
			x, y,
			nodeShapePoints[nodeShape],
			node._private.position.x,
			node._private.position.y,
			width / 2, height / 2,
			node._private.style["border-width"].value / 2);
		
		// If there's multiple, only give the nearest
		return renderer.findNearestIntersection(intersections, x, y);
	}

	
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
	
	nodeShapeDrawers["triangle"] = function(node, width, height) {
		cy.renderer().drawPolygon(node._private.position.x,
			node._private.position.y, width, height, "triangle", 3);
	}
	
	nodeShapeIntersectLine["triangle"] = function(node, width, height, x, y) {
		return renderer.findPolygonIntersection(node, width, height, x, y, "triangle", 3);
	}
	
	nodeShapeDrawers["square"] = function(node, width, height) {
		cy.renderer().drawPolygon(node._private.position.x,
			node._private.position.y, width, height, "square", 4);
	}
	
	nodeShapeIntersectLine["square"] = function(node, width, height, x, y) {
		return renderer.findPolygonIntersection(node, width, height, x, y, "square", 4);
	}
	
	nodeShapeDrawers["rectangle"] = nodeShapeDrawers["square"];
	nodeShapeIntersectLine["rectangle"] = nodeShapeIntersectLine["square"];
	
	nodeShapeDrawers["pentagon"] = function(node, width, height) {
		cy.renderer().drawNgon(node._private.position.x,
			node._private.position.y, width, height, "pentagon", 5);
	}
	
	nodeShapeIntersectLine["pentagon"] = function(node, width, height, x, y) {
		return renderer.findPolygonIntersection(node, width, height, x, y, "pentagon", 5);
	}
	
	nodeShapeDrawers["hexagon"] = function(node, width, height) {
		cy.renderer().drawNgon(node._private.position.x,
			node._private.position.y, width, height, "hexagon", 6);
	}
	
	nodeShapeIntersectLine["hexagon"] = function(node, width, height, x, y) {
		return renderer.findPolygonIntersection(node, width, height, x, y, "hexagon", 6);
	}
	
	nodeShapeDrawers["heptagon"] = function(node, width, height) {
		cy.renderer().drawNgon(node._private.position.x,
			node._private.position.y, width, height, "heptagon", 7);
	}
	
	nodeShapeIntersectLine["heptagon"] = function(node, width, height, x, y) {
		return renderer.findPolygonIntersection(node, width, height, x, y, "heptagon", 7);
	}
	
	nodeShapeDrawers["octagon"] = function(node, width, height) {
		cy.renderer().drawNgon(node._private.position.x,
			node._private.position.y, width, height, "octagon", 8);
	}
	
	nodeShapeIntersectLine["octagon"] = function(node, width, height, x, y) {
		return renderer.findPolygonIntersection(node, width, height, x, y, "octagon", 8);
	}
	
	// nodeShapeUnitPoints["triangle"] = generateNgonPoints(
	
	// Generates points for an n-sided polygon, using a circle of radius 1.
	/*
	CanvasRenderer.prototype.generateUnitNgonPoints = function(sides, rotationRadians) {
		
		var increment = 1.0 / sides * 2 * Math.PI;
		var startAngle = sides % 2 == 0 ? Math.PI / 2.0 + increment / 2.0 : Math.PI / 2.0;
		
		startAngle += rotationRadians;
		
		var points = new Array(sides * 2);
		
		var currentAngle;
		for (var i = 0; i < sides; i++) {
			currentAngle = i * increment + startAngle;
			
			points[2 * i] = Math.cos(currentAngle);
			points[2 * i + 1] = Math.sin(currentAngle);
		}
		
		return points;
	}
	*/
	
	CanvasRenderer.prototype.findNearestIntersection = function(intersections, x, y) {
		
		var distSquared;
		var minDistSquared;
		
		var minDistanceX;
		var minDistanceY;
		
		if (intersections.length == 0) {
			return [];
		}
		
		for (var i = 0; i < intersections.length / 2; i++) {
			distSquared = Math.pow(x - intersections[i * 2], 2)
				+ Math.pow(y - intersections[i * 2 + 1], 2);
			
			if (minDistSquared == undefined || minDistSquared > distSquared) {
				minDistSquared = distSquared;
				
				minDistanceX = intersections[i * 2];
				minDistanceY = intersections[i * 2 + 1];
			}
		}
		
		return [minDistanceX, minDistanceY];
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

	CanvasRenderer.prototype.drawPolygon = function(
		x, y, width, height, nodeShape, numSides) {

		if (nodeShapePoints[nodeShape] == undefined) {
			nodeShapePoints[nodeShape] = generateUnitNgonPoints(numSides, 0);
		}
		
		var points = nodeShapePoints[nodeShape];

		var context = cy.renderer().context;
		context.save();
		context.translate(x, y);
		context.beginPath();
		
		context.scale(width / 2, height / 2);
		context.moveTo(points[0], points[1]);
		
		for (var i = 1; i < points.length / 2; i++) {
			context.lineTo(points[i * 2], points[i * 2 + 1]);
		}
		
		context.closePath();
		context.fill();
		
		context.restore();
	}

	CanvasRenderer.prototype.pointInsidePolygon = function(
		x, y, basePoints, centerX, centerY, width, height, rotation, padding) {
		
		var transformedPoints = new Array(basePoints.length)
		
		for (var i = 0; i < transformedPoints.length / 2; i++) {
			transformedPoints[i * 2] = 
				basePoints[i * 2] * width * Math.cos(rotation) + centerX;
			transformedPoints[i * 2 + 1] = 
				basePoints[i * 2 + 1] * height * Math.sin(rotation) + centerY;
		}
		
		var expandedLineSet = this.expandPolygon(
			transformedPoints,
			-padding);
		
		var points = this.joinLines(expandedLineSet);
		
		
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
		
		var expandedLineSet = this.expandPolygon(
			transformedPoints,
			-padding);
		
		var points = this.joinLines(expandedLineSet);
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
	};
	
	CanvasRenderer.prototype.drawNgon = function(x, y, sides, width, height) {
		var context = cy.renderer().context;
		context.save();
		context.translate(x, y);
		context.beginPath();
		
		var increment = 1 / sides * 2 * Math.PI;
		var startAngle = sides % 2 == 0? Math.PI / 2 + increment / 2 : Math.PI / 2;
		
		context.scale(width / 2, height / 2);
		
		context.moveTo(Math.cos(startAngle), -Math.sin(startAngle));
		for (var angle = startAngle;
			angle < startAngle + 2 * Math.PI; angle += increment) {
		
			context.lineTo(Math.cos(angle), -Math.sin(angle));
		}
		
		context.closePath();
		context.fill();
		
		context.restore();
	}
	
	// Sizes canvas to container if different size
	CanvasRenderer.prototype.matchCanvasSize = function(container) {
		var width = container.clientWidth;
		var height = container.clientHeight;
		
		var canvas;
		for (var i = 0; i < this.canvases.length + this.bufferCanvases.length; i++) {
			
			if (i < this.canvases.length) {
				canvas = this.canvases[i];
			} else {
				canvas = this.bufferCanvases[i - this.canvases.length];
			}
			
			if (canvas.width !== width || canvas.height !== height) {
				
				canvas.width = width;
				canvas.height = height;
			
			}
		}
	}
	
	var doSingleRedraw = false;
	
	CanvasRenderer.prototype.redraw = function(singleRedraw) {
		
		renderer.matchCanvasSize(renderer.container);
		
		if (redrawTimeout) {
//			doSingleRedraw = true;
			// return;
		}
		
		redrawTimeout = setTimeout(function() {
			redrawTimeout = null;
			if (doSingleRedraw && !singleRedraw) {
				renderer.redraw(true);
				doSingleRedraw = false;
				
				// console.log("singleRedraw");
			}
		}, 1000 / 80);
		
		var context = this.context;
		var contexts = this.canvasContexts;
		
		var elements = this.options.cy.elements().toArray();
		var elementsLayer2 = [];
		var elementsLayer4 = [];
		
		if (this.canvasNeedsRedraw[2] || this.canvasNeedsRedraw[4]) {
		
			this.findEdgeControlPoints(this.options.cy.edges());
			
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
		
		if (this.canvasNeedsRedraw[2]) {
			context = this.canvasContexts[2];
			this.context = context;
			
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.clearRect(0, 0, context.canvas.width, context.canvas.height);
			
			context.translate(this.cy.pan().x, this.cy.pan().y);
			context.scale(this.cy.zoom(), this.cy.zoom());
			
			var element;

			for (var index = 0; index < elements.length; index++) {
				element = elements[index];
				
				if (element._private.rscratch.layer2) {
					if (element._private.group == "nodes") {
						this.drawNode(element);
					} else if (element._private.group == "edges") {
						this.drawEdge(element);
					}
				}
			}
			
			for (var index = 0; index < elements.length; index++) {
				element = elements[index];
				
				if (element._private.rscratch.layer2) {
					if (element._private.group == "nodes") {
						this.drawNodeText(element);
					} else if (element._private.group == "edges") {
						this.drawEdgeText(element);
					}
				}
			}
			
			this.canvasNeedsRedraw[2] = false;
			this.redrawReason[2] = [];
		}
		
		if (this.canvasNeedsRedraw[4]) {
			context = this.canvasContexts[4];
			this.context = context;
			
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.clearRect(0, 0, context.canvas.width, context.canvas.height);
			
			context.translate(this.cy.pan().x, this.cy.pan().y);
			context.scale(this.cy.zoom(), this.cy.zoom());
		
//			console.log(4, this.redrawReason[4]);
		
			var element;
			
			for (var index = 0; index < elements.length; index++) {
				element = elements[index];
				
				if (!element._private.rscratch.layer2) {
					if (element._private.group == "nodes") {
						this.drawNode(element);
					} else if (element._private.group == "edges") {
						this.drawEdge(element);
					}
				}
			}
			
			for (var index = 0; index < elements.length; index++) {
				element = elements[index];
				
				if (!element._private.rscratch.layer2) {
					if (element._private.group == "nodes") {
						this.drawNodeText(element);
					} else if (element._private.group == "edges") {
						this.drawEdgeText(element);
					}
				}
			}
			
			this.canvasNeedsRedraw[4] = false;
			this.redrawReason[4] = [];
		}
		
		if (this.canvasNeedsRedraw[0]) {
			context = this.canvasContexts[0];
			
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.clearRect(0, 0, context.canvas.width, context.canvas.height);
		
			context.translate(this.cy.pan().x, this.cy.pan().y);
			context.scale(this.cy.zoom(), this.cy.zoom());
			
			// console.log(0, this.redrawReason[0], selectBox[4]);
			
			if (selectBox[4] == 1) {
				var coreStyle = cy.style()._private.coreStyle;
				var borderWidth = coreStyle["selection-box-border-width"].value;
				
				context.lineWidth = borderWidth;
				context.fillStyle = "rgba(" 
					+ coreStyle["selection-box-color"].value[0] + ","
					+ coreStyle["selection-box-color"].value[1] + ","
					+ coreStyle["selection-box-color"].value[2] + ","
					+ coreStyle["selection-box-opacity"].value + ")";
				
				context.fillRect(selectBox[0] + borderWidth / 2,
					selectBox[1] + borderWidth / 2,
					selectBox[2] - selectBox[0] - borderWidth / 2,
					selectBox[3] - selectBox[1] - borderWidth / 2);
				
				if (borderWidth > 0) {
					context.strokeStyle = "rgba(" 
						+ coreStyle["selection-box-border-color"].value[0] + ","
						+ coreStyle["selection-box-border-color"].value[1] + ","
						+ coreStyle["selection-box-border-color"].value[2] + ","
						+ coreStyle["selection-box-opacity"].value + ")";
					
					context.strokeRect(selectBox[0] + borderWidth / 2,
						selectBox[1] + borderWidth / 2,
						selectBox[2] - selectBox[0] - borderWidth / 2,
						selectBox[3] - selectBox[1] - borderWidth / 2);
				}
			}
			
			this.canvasNeedsRedraw[0] = false;
			this.redrawReason[0] = [];
		}
		
		// Rasterize the layers
		this.bufferCanvasContexts[1].globalCompositeOperation = "copy";
		this.bufferCanvasContexts[1].drawImage(this.canvases[4], 0, 0);
		this.bufferCanvasContexts[1].globalCompositeOperation = "source-over";
		this.bufferCanvasContexts[1].drawImage(this.canvases[2], 0, 0);
		this.bufferCanvasContexts[1].drawImage(this.canvases[0], 0, 0);

		this.bufferCanvasContexts[0].globalCompositeOperation = "copy";
		this.bufferCanvasContexts[0].drawImage(this.bufferCanvases[1], 0, 0);
	};
	
	CanvasRenderer.prototype.drawEdge = function(edge) {
		var context = renderer.context;
		
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
		
			context.beginPath();
			context.moveTo(
				edge._private.rscratch.startX,
				edge._private.rscratch.startY)
			
			context.quadraticCurveTo(
				edge._private.rscratch.cp2ax,
				edge._private.rscratch.cp2ay,
				edge._private.rscratch.selfEdgeMidX,
				edge._private.rscratch.selfEdgeMidY);
			
			context.moveTo(
				edge._private.rscratch.selfEdgeMidX,
				edge._private.rscratch.selfEdgeMidY);
			
			context.quadraticCurveTo(
				edge._private.rscratch.cp2cx,
				edge._private.rscratch.cp2cy,
				edge._private.rscratch.endX,
				edge._private.rscratch.endY);
			
			context.stroke();
			
		} else if (edge._private.rscratch.isStraightEdge) {
			
			// Check if the edge is inverted due to close node proximity
			var nodeDirectionX = endNode._private.position.x - startNode._private.position.x;
			var nodeDirectionY = endNode._private.position.y - startNode._private.position.y;
			
			var edgeDirectionX = edge._private.rscratch.endX - edge._private.rscratch.startX;
			var edgeDirectionY = edge._private.rscratch.endY - edge._private.rscratch.startY;
			
			if (nodeDirectionX * edgeDirectionX
				+ nodeDirectionY * edgeDirectionY < 0) {
				
				edge._private.rscratch.straightEdgeTooShort = true;	
			} else {			
				context.beginPath();
				context.moveTo(
					edge._private.rscratch.startX,
					edge._private.rscratch.startY);
	
				context.lineTo(edge._private.rscratch.endX, 
					edge._private.rscratch.endY);
				context.stroke();
				
				edge._private.rscratch.straightEdgeTooShort = false;	
			}	
		} else {
			
			context.beginPath();
			context.moveTo(
				edge._private.rscratch.startX,
				edge._private.rscratch.startY);
			
			context.quadraticCurveTo(
				edge._private.rscratch.cp2x, 
				edge._private.rscratch.cp2y, 
				edge._private.rscratch.endX, 
				edge._private.rscratch.endY);
			context.stroke();
			
		}
		
		if (edge._private.rscratch.noArrowPlacement !== true
				&& edge._private.rscratch.startX !== undefined) {
			this.drawArrowheads(edge);
		}
	}
	
	CanvasRenderer.prototype.drawEdgeText = function(edge) {
		var context = renderer.context;
	
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
		} else if (edge._private.rscratch.isStraightEdge) {
			edgeCenterX = (edge._private.rscratch.startX
				+ edge._private.rscratch.endX) / 2;
			edgeCenterY = (edge._private.rscratch.startY
				+ edge._private.rscratch.endY) / 2;
		} else if (edge._private.rscratch.isBezierEdge) {
			edgeCenterX = Math.pow(1 - 0.5, 2) * edge._private.rscratch.startX
				+ 2 * (1 - 0.5) * 0.5 * edge._private.rscratch.cp2x
				+ (0.5 * 0.5) * edge._private.rscratch.endX;
			
			edgeCenterY = Math.pow(1 - 0.5, 2) * edge._private.rscratch.startY
				+ 2 * (1 - 0.5) * 0.5 * edge._private.rscratch.cp2y
				+ (0.5 * 0.5) * edge._private.rscratch.endY;
		}
		
		textX = edgeCenterX;
		textY = edgeCenterY;
		
		this.drawText(edge, textX, textY);
	}
	
	CanvasRenderer.prototype.drawNode = function(node) {
		var context = renderer.context;
		
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
		
		// Draw node
		nodeShapeDrawers[node._private.style["shape"].value](
			node,
			nodeWidth,
			nodeHeight); //node._private.data.weight / 5.0
		
		// Border width, draw border
		context.lineWidth = node._private.style["border-width"].value;
		if (node._private.style["border-width"].value > 0) {
			context.stroke();
		}
	}
	
	CanvasRenderer.prototype.drawNodeText = function(node) {
		var context = renderer.context;
		
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
		
		this.drawText(node, textX, textY);
	}
	
	CanvasRenderer.prototype.drawText = function(element, textX, textY) {
		var context = renderer.context;
		
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
		
		context.fillText(text, textX, textY);
		
		var lineWidth = element._private.style["text-outline-width"].value;
		
		if (lineWidth > 0) {
			context.lineWidth = lineWidth;
			context.strokeText(text, textX, textY);
		}
	}
	
	CanvasRenderer.prototype.zoom = function(params){
		// debug(params);
		if (params != undefined && params.level != undefined) {
		
			this.scale[0] = params.level;
			this.scale[1] = params.level;
		}
		
		console.log("zoom call");
		console.log(params);
	};
	
	CanvasRenderer.prototype.fit = function(params){
		console.log("fit call");
		console.log(params);
	};
	
	CanvasRenderer.prototype.pan = function(params){
		console.log("pan call");
		console.log(params);
		
		if (this.context != undefined) {
			
		}
	};
	
	CanvasRenderer.prototype.panBy = function(params){
		this.center[0] -= params.x;
		this.center[1] -= params.y;
		
		this.redraw();
		
		console.log("panBy call");
		console.log(params);
	};
	
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
				
				var movedNodes = cy.collection();
				
				sys.eachNode(function(n, point){ 
					var id = n.name;
					var data = n.data;
					var node = data.element;
					
					if( node == null ){
						return;
					}
					var pos = node.position();
					
					if( !node.locked() && !node.grabbed() ){
						pos.x = point.x;
						pos.y = point.y;
						
						movedNodes = movedNodes.add(node);
					}
				});
				

				var timeToDraw = (+new Date - lastDraw) >= 16;
				if( options.liveUpdate && movedNodes.size() > 0 && timeToDraw ){
					movedNodes.rtrigger("position");
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

/* cytoscape.js */

/**
 * This file is part of cytoscape.js 2.0.0beta1-github-snapshot-2012.10.03-17.10.29.
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
			nodeShape: { enums: ["rectangle", "roundrectangle", "ellipse", "triangle"] },
			arrowShape: { enums: ["tee", "triangle", "square", "circle", "diamond", "none"] },
			visibility: { enums: ["hidden", "visible"] },
			valign: { enums: ["top", "center", "bottom"] },
			halign: { enums: ["left", "center", "right"] },
			cursor: { enums: ["auto", "crosshair", "default", "e-resize", "n-resize", "ne-resize", "nw-resize", "pointer", "progress", "s-resize", "sw-resize", "text", "w-resize", "wait", "grab", "grabbing"] },
			text: { string: true },
			data: { mapping: true, regex: "^data\\s*\\(\\s*(\\w+)\\s*\\)$" },
			mapData: { mapping: true, regex: "^mapData\\((\\w+)\\s*\\,\\s*(" + number + ")\\s*\\,\\s*(" + number + ")\\s*,\\s*(\\w+)\\s*\\,\\s*(\\w+)\\)$" }
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
			reg.ready = false; // b/c an old core instance could have been using this reg and this instance is not yet ready
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
			reg.ready = true;

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
			var eles;

			if( !selector || ( $$.is.elementOrCollection(selector) && selector.length === 0 ) ){
				eles = this.$();
			} else if( $$.is.string(selector) ){
				eles = this.$( selector );
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

(function($$){

	var debug = function(o) {
		if (false) {
			console.log(o);
		}
	}

	var defaults = {
		minZoom: 0.001,
		maxZoom: 1000,
		maxPan: -1 >>> 1,
		minPan: (-(-1>>>1)-1),
		selectionToPanDelay: 500,
		dragToSelect: true,
		dragToPan: true,
	};
	
	var debugStats = {};
	
	// The 5th element in the array can be used to indicate whether 
	// the box should be drawn (0=hide)
	var selectBox = [0, 0, 0, 0, 0];
	
	var dragPanStartX;
	var dragPanStartY;
	var dragPanInitialCenter;
	var dragPanMode = false;
	
	var shiftDown = false;
	
	var nodeHovered = false;
	
	var minDistanceEdge;
	var minDistanceEdges = [];
	var minDistanceEdgeValue = 999;
	
	var minDistanceNode;
	var minDistanceNodes = [];
	var minDistanceNodeValue = 999;
	
	var arrowShapes = {};
	var arrowShapeDrawers = {};
	var arrowShapeSpacing = {};
	var arrowShapeGap = {};
	var nodeShapeDrawers = {};
	var nodeShapeIntersectLine = {};
	var nodeShapePoints = {};
	
	var nodeDragging = false;
	var draggingSelectedNode = false;
	var draggedNode;
	
	var draggedElementsMovedLayer = false;
	var nodesBeingDragged = [];
	var edgesBeingDragged = [];
	
	var cy;
	var renderer;
	
	var curTouch1Position = new Array(2);
	var curTouch2Position = new Array(2);
	var curTouchDistance;
	
	var prevTouch1Position = new Array(2);
	var prevTouch2Position = new Array(2);
	var prevTouchDistance;
	
	var skipNextViewportRedraw = false;
	
	// Timeout variable used to prevent mouseMove events from being triggered too often
	var mouseMoveTimeout = 0;
	
	// Timeout variable to prevent frequent redraws
	var redrawTimeout = 0;
	
	var currentMouseDownNode = undefined;
	var currentMouseDownEdge = undefined;
	var currentMouseDownInCanvas = false;
	var currentMouseDownUnmoved = false;
	
	// Used for mouseover/mouseout
	var currentHoveredNode = undefined
	var currentHoveredEdge = undefined;
	var currentMouseInCanvas = false;
	var mouseJustEnteredCanvas = false;
	
	var wheelZoomEnabled = false;
	
	var previousMouseX = undefined;
	var currentMouseX = undefined;
	
	var secondsElapsed = 0;
	var mouseDownTime = undefined;
	
	function CanvasRenderer(options) {
		this.options = $.extend(true, {}, defaults, options);
		this.cy = options.cy;
		
		cy = options.cy;
		
		this.init();
		
		// Information about the number of edges between each pair of nodes
		// used to find different curvatures for the edges
		this.nodePairEdgeData = {};		
		
		var numCanvases = 5;
		
		// Create canvases, place in container
		
		this.canvases = new Array(numCanvases);
		this.canvasContexts = new Array(numCanvases);
		
		var numBufferCanvases = 2;
		this.bufferCanvases = new Array(numBufferCanvases);
		this.bufferCanvasContexts = new Array(numBufferCanvases);
		
		this.canvasNeedsRedraw = new Array(numCanvases);
		this.redrawReason = new Array(numCanvases);
		
		var container = this.options.cy.container();
		this.container = container;
		
		setInterval(function() {
			secondsElapsed++;
		}, 450);
		
		for (var i = 0; i < numCanvases + numBufferCanvases; i++) {
			var canvas = document.createElement("canvas");
			
			canvas.width = container.clientWidth;
			canvas.height = container.clientHeight;
			// console.log(canvas)
			
			/*
			canvas.style.width = '100%';
			canvas.style.height = '100%';			
			*/
			canvas.style.position = "absolute";
			
			if (i < numCanvases) {
				// Create main set of canvas layers for drawing
				canvas.id = "layer" + i;
				canvas.style.zIndex = String(-i - numBufferCanvases);
				canvas.style.visibility = "hidden";
				
				this.canvases[i] = canvas;
				this.canvasContexts[i] = canvas.getContext("2d");
				
				this.canvasNeedsRedraw[i] = false;
				this.redrawReason[i] = new Array();
				
			} else {
				// Create the buffer canvas which is the cached drawn result
				canvas.id = "buffer" + (i - numCanvases);
				canvas.style.zIndex = -(i - numCanvases);
				
				this.bufferCanvases[i - numCanvases] = canvas;
				this.bufferCanvasContexts[i - numCanvases] = canvas.getContext("2d");
			}
			
			container.appendChild(canvas);
		}
		
		this.bufferCanvases[0].style.visibility = "visible";
//		this.bufferCanvases[0].style.visibility = "hidden";
		
		this.bufferCanvases[1].style.visibility = "hidden";
//		this.bufferCanvases[1].style.visibility = "visible";
		
		this.canvas = this.bufferCanvases[0];
		this.context = this.bufferCanvasContexts[0];
		
		this.center = [container.clientWidth / 2, container.clientHeight / 2];
		this.scale = [1, 1];
		this.zoomLevel = 0;
		
		renderer = this;
	}

	CanvasRenderer.prototype.notify = function(params) {

		if (params.type == "load") {
			this.load();
			
			this.canvasNeedsRedraw[2] = true;
			this.redrawReason[2].push("Load");
				
			this.canvasNeedsRedraw[4] = true;
			this.redrawReason[4].push("Load");
			
			this.redraw();
		
		} else if (params.type == "viewport") {
		
			if (!skipNextViewportRedraw) {
				this.canvasNeedsRedraw[2] = true;
				this.redrawReason[2].push("Viewport change");
				
				this.canvasNeedsRedraw[4] = true;
				this.redrawReason[4].push("Viewport change");
				
				this.redraw();
			} else {
				skipNextViewportRedraw = false;
			}
		} else if (params.type == "style") {
			
			doSingleRedraw = true;

			this.canvasNeedsRedraw[2] = true;
			this.redrawReason[2].push("Style change");
			
			this.canvasNeedsRedraw[4] = true;
			this.redrawReason[4].push("Style change");
			
			this.redraw();
			
		} else if (params.type == "add"
			|| params.type == "remove") {
			
			this.canvasNeedsRedraw[4] = true;
			this.redrawReason[4].push("Elements added/removed");
			
			this.redraw();
		} else if (params.type == "draw") {
			this.canvasNeedsRedraw[2] = true;
			this.redrawReason[2].push("Draw call");
			
			this.canvasNeedsRedraw[4] = true;
			this.redrawReason[4].push("Draw call");
			
			this.redraw();
		} else if (params.type == "position") {
			this.canvasNeedsRedraw[2] = true;
			this.redrawReason[2].push("Position call");
			
			this.canvasNeedsRedraw[4] = true;
			this.redrawReason[4].push("Position call");
			
			this.redraw();	
		} else {
			console.log("event: " + params.type);
		}
	};
	
	CanvasRenderer.prototype.projectMouse = function(mouseEvent) {
		
		/* sept25-2012
		var x = mouseEvent.clientX - this.canvas.offsetParent.offsetLeft - 2;
		var y = mouseEvent.clientY - this.canvas.offsetParent.offsetTop - 2;

		x += (mouseEvent.pageX - mouseEvent.clientX);
		y += (mouseEvent.pageY - mouseEvent.clientY);
		*/
		
		/*
		console.log(renderer.container.HTMLElement);
		console.log(renderer.container);
		*/
		var x, y;
		/*
		if (mouseEvent.offsetX !== undefined && mouseEvent.offsetY !== undefined) {
			x = mouseEvent.offsetX;
			y = mouseEvent.offsetY;
		} else {
		*/	
		
		var offsetLeft = 0;
		var offsetTop = 0;
		var n;
		
		n = cy.container();
		while (n != null) {
			if (typeof(n.offsetLeft) == "number") {
				offsetLeft += n.offsetLeft;
				offsetTop += n.offsetTop;
			}
			
			n = n.parentNode;
		}
		// console.log(offsetLeft, offsetTop);
		
		x = mouseEvent.pageX - offsetLeft;
		y = mouseEvent.pageY - offsetTop;
		//}
			
		x -= cy.pan().x;
		y -= cy.pan().y;
		
		x /= cy.zoom();
		y /= cy.zoom();
		
		return [x, y];
		
		/*
		mouseDownEvent.clientX,
		mouseDownEvent.clientY,
		cy.container().offset().left + 2, // container offsets
		cy.container().offset().top + 2);
		*/
	}
	
	CanvasRenderer.prototype.findEdgeMetrics = function(edges) {
		this.nodePairEdgeData = {};
		
		var edge, nodePairId;
		for (var i = 0; i < edges.length; i++) {
			edge = edges[i];
			nodePairId = edge._private.data.source <= edge._private.data.target?
				edge._private.data.source + edge._private.data.target
				: edge._private.data.target + edge._private.data.source;
				
			if (this.nodePairEdgeData[nodePairId] == undefined) {
				this.nodePairEdgeData[nodePairId] = 1;
			} else {
				this.nodePairEdgeData[nodePairId]++;
			}
			
			edge._private.rscratch.nodePairId = nodePairId;
			edge._private.rscratch.nodePairEdgeNum = this.nodePairEdgeData[nodePairId];
		}
		
		// console.log(this.nodePairEdgeData);
	}
	
	CanvasRenderer.prototype.findEdges = function(nodeSet) {
		
		var edges = cy.edges();
		
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
	
	CanvasRenderer.prototype.findEdgeControlPoints = function(edges) {
		var hashTable = {};
		
		var pairId;
		for (var i = 0; i < edges.length; i++) {
			
			pairId = edges[i]._private.data.source > edges[i]._private.data.target ?
				edges[i]._private.data.target + edges[i]._private.data.source :
				edges[i]._private.data.source + edges[i]._private.data.target;

			if (hashTable[pairId] == undefined) {
				hashTable[pairId] = [];
			}
			
			hashTable[pairId].push(edges[i]); // ._private.data.id);
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
					
					edge._private.rscratch.cp2ax = src._private.position.x;
					edge._private.rscratch.cp2ay = src._private.position.y
						- 1.3 * stepSize * (i / 3 + 1);
					
					edge._private.rscratch.cp2cx = src._private.position.x
						- 1.3 * stepSize * (i / 3 + 1);
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
	
	CanvasRenderer.prototype.findEdgeControlPoints2 = function(edges) {
		var visitedEdges = {};
		
		var parallelEdges;
		for (var i = 0; i < edges.length; i++) {
			if (visitedEdges[edges[i]._private.data.id] == undefined) {
				parallelEdges = edges[i].parallelEdges();
				
				for (var j = 0; j < edges.length; j++) {
					visitedEdges[edges[i]._private.data.id] = true;
				}
				
				$$.styfn.calculateControlPoints(parallelEdges);
			}
		}
	}
	
	CanvasRenderer.prototype.checkRecordPinchCoordinates = function(touchEvent) {
		
		if (touchEvent.touches.length >= 2) {
			prevTouch1 = touchEvent.touches[0];
			prevTouch2 = touchEvent.touches[1];
			
			prevTouch1.offsetX = prevTouch1.clientX + renderer.canvas.parentElement.offsetLeft;
			prevTouch1.offsetY = prevTouch1.clientY + renderer.canvas.parentElement.offsetTop;
			
			prevTouch2.offsetX = prevTouch2.clientX + renderer.canvas.parentElement.offsetLeft;
			prevTouch2.offsetY = prevTouch2.clientY + renderer.canvas.parentElement.offsetTop;
		} else {
			prevTouch1 = undefined;
			prevTouch2 = undefined;
		}
	}
	
	CanvasRenderer.prototype.mouseDownHandler = function(event) {
		var nodes = cy.nodes();
		var edges = cy.edges();

		var touch = false;
		
		var originalEvent = event;
		if (event.changedTouches) {					
			event.preventDefault();
			touch = true;
				
			// Check for 2-finger, prepare for pinch-to-zoom
			if (event.touches.length >= 2) {
				firstTouchFinger = event.touches[0];
				secondTouchFinger = event.touches[1];
				
				var canvasOffset = [
					renderer.canvas.parentElement.offsetLeft,
					-renderer.canvas.parentElement.offsetTop];
				
				prevTouch1Position[0] = event.touches[0].clientX + canvasOffset[0];
				prevTouch1Position[1] = event.touches[0].clientY + canvasOffset[1];
				
				prevTouch2Position[0] = event.touches[1].clientX + canvasOffset[0];
				prevTouch2Position[1] = event.touches[1].clientY + canvasOffset[1];
				
				prevTouchDistance = Math.sqrt(
					Math.pow(prevTouch2Position[0] - prevTouch1Position[0], 2)
					+ Math.pow(prevTouch2Position[1] - prevTouch1Position[1], 2));
			}
			
			event = event.changedTouches[0];
			event.button = 0;
			event.touch = 1;
			
			// Look for nodes and edges under the touch event			
			// minDistanceNode = minDistanceEdge = undefined;
			renderer.mouseMoveHelper.hoverHandler(nodes, edges, event);
		}
		
		var mouseDownEvent = event;
		
		mouseDownTime = secondsElapsed;
		
		clearTimeout( this.panTimeout );
		if( !minDistanceNode && !touch){
			this.panTimeout = setTimeout(function() {
			
				// Delayed pan
				if (mouseDownTime !== undefined
					&& !touch
					&& event.button === 0) {
					
					dragPanStartX = mouseDownEvent.clientX;
					dragPanStartY = mouseDownEvent.clientY;
					
		//			dragPanInitialCenter = [cy.renderer().center[0], cy.renderer().center[1]];
					
					dragPanMode = true;
					
					if (cy.renderer().canvas.style.cursor 
						!= cy.style()._private.coreStyle["panning-cursor"].value) {
		
						cy.renderer().canvas.style.cursor 
							= cy.style()._private.coreStyle["panning-cursor"].value;
					}
					
					// Cancel selection box
					selectBox[4] = 0;
					
					renderer.canvasNeedsRedraw[0] = true;
					renderer.redrawReason[0].push("selection boxed removed");
					
					mouseDownTime = undefined;
				}
			}, 250);
		}
				
		// Process middle button panning
		if ((!event.touch
				&& mouseDownEvent.button == 1
				&& mouseDownEvent.target == cy.renderer().canvas)
				||
			(event.touch
				&& minDistanceNode == undefined
				&& minDistanceEdge == undefined)) {
		
			dragPanStartX = mouseDownEvent.clientX;
			dragPanStartY = mouseDownEvent.clientY;
			
//			dragPanInitialCenter = [cy.renderer().center[0], cy.renderer().center[1]];
			
			dragPanMode = true;
			
			if (cy.renderer().canvas.style.cursor 
				!= cy.style()._private.coreStyle["panning-cursor"].value) {

				cy.renderer().canvas.style.cursor 
					= cy.style()._private.coreStyle["panning-cursor"].value;
			}
		}
		
		currentMouseDownInCanvas = true;
		currentMouseDownUnmoved = true;
		
		var start = cy.renderer().projectMouse(event);
		
		/*
		console.log("x: " + start[0]);
		console.log("y: " + start[1]);
		console.log(mouseDownEvent);
		console.log(mouseDownEvent.target);
		console.log(mouseDownEvent.button);
		*/
		
		selectBox[0] = start[0];
		selectBox[1] = start[1];
		
		/*
		// The lower right corner shouldn't have a coordinate,
		// but this prevents the default 0, 0 from being used for touch
		selectBox[2] = start[0];
		selectBox[3] = start[1];
		*/
		
		// Left button drag selection
		if (mouseDownEvent.button == 0
				&& mouseDownEvent.target == cy.renderer().canvas
				&& minDistanceNode == undefined
				&& minDistanceEdge == undefined
				&& !touch) {
		
			selectBox[4] = 1;
		}
		
		if (mouseDownEvent.button == 0) {
		
			if (minDistanceNode != undefined && minDistanceNode.grabbable()) {
				
				nodeDragging = true;
				nodesBeingDragged = [];
				
				if (minDistanceNode.selected()) {
					draggingSelectedNode = true;
					
					for (var index = 0; index < nodes.length; index++) {
						if (nodes[index].selected() && nodes[index].grabbable()) {
							
							nodes[index]._private.rscratch.dragStartX = 
								nodes[index]._private.position.x;
							nodes[index]._private.rscratch.dragStartY =
								nodes[index]._private.position.y;
										
							nodesBeingDragged.push(nodes[index]);
//**						nodes[index]._private.rscratch.layer2 = true;
							
							// Proxy grab() event
							nodes[index]._private.grabbed = true;
							nodes[index].trigger("grab");
						}
					}
					
				} else if( minDistanceNode.grabbable() ) {
					draggingSelectedNode = false;
					draggedNode = minDistanceNode;
					
					draggedNode._private.rscratch.dragStartX = 
						draggedNode._private.position.x;
					draggedNode._private.rscratch.dragStartY = 
						draggedNode._private.position.y;
					
					nodesBeingDragged.push(draggedNode);
					draggedNode._private.rscratch.layer2 = true;	

					// Proxy grab() event
					draggedNode._private.grabbed = true;
					draggedNode.trigger("grab");
				}
				
				edgesBeingDragged = renderer.findEdges(nodesBeingDragged);
				
				for (var i = 0; i < edgesBeingDragged.length; i++) {
//**				edgesBeingDragged[i]._private.rscratch.layer2 = true;
				}
				
/***
				renderer.canvasNeedsRedraw[4] = true;
				renderer.redrawReason[4].push("nodes being dragged, moved to drag layer");
				
				renderer.canvasNeedsRedraw[2] = true;
				renderer.redrawReason[2].push("nodes being dragged, moved to drag layer");
***/

				draggedElementsMovedLayer = false;
				
				// Proxy touchstart/mousedown to core
				if (touch) {
					minDistanceNode.trigger("touchstart");
				} else {
					minDistanceNode.trigger("mousedown");
				}
				
				currentMouseDownNode = minDistanceNode;
			} else if (minDistanceEdge != undefined) {
				// Proxy touchstart/mousedown to core
				if (touch) {
					minDistanceEdge.trigger("touchstart");
				} else {
					minDistanceEdge.trigger("mousedown");
				}
				
				currentMouseDownEdge = minDistanceEdge;
			} else {
			
				// Proxy touchstart/mousedown to core
				if (touch) {
					cy.trigger("touchstart");
				} else {
					cy.trigger("mousedown");
				}
				
				currentMouseDownInCanvas = true;
			}
		}
		
		cy.renderer().redraw();
	}
	
	CanvasRenderer.prototype.mouseOverHandler = function(event) {
		mouseJustEnteredCanvas = true;
		currentMouseInCanvas = true;
	}
	
	CanvasRenderer.prototype.mouseOutHandler = function(event) {
		wheelZoomEnabled = false;
		currentMouseInCanvas = false;
		
		cy.trigger("mouseout");
		
		previousMouseX = undefined;
		
		// Possibly move this later
//		dragPanMode = false;
	}
	
	CanvasRenderer.prototype.touchStartHandler = function(event) {
	
	}
	
	CanvasRenderer.prototype.touchStartHandler = function(event) {
	
	}
	
	
	
	CanvasRenderer.prototype.documentMouseMoveHandler = function(event) {
		
		var touch = false;
		var eventWithCoords = event;
		
		if (event.touches) {
			touch = true;
			eventWithCoords = event.touches[0];
		}
		
//		if (eventWithCoords.target == this.bufferCanvases[0]) {
//			if (
//		}
	}
	
	CanvasRenderer.prototype.mouseMoveHandler = function(e) {
		
		/*
		if (currentMouseInCanvas === true) {
		//	wheelZoomEnabled = true;
		} else {
			currentMouseInCanvas = true;
		}
		*/
		
		currentMouseInCanvas = true;

		mouseMoveTimeout = setTimeout(function() {
			mouseMoveTimeout = null;		
		}, 1000/100);
		
		var event = e;
		var touch = false;
		
		if (e.touches) {						
			e.preventDefault();
			touch = true;
			
			// Pinch to zoom
			if (e.touches.length >= 2) {
				var canvasOffset = [
					renderer.canvas.parentElement.offsetLeft,
					-renderer.canvas.parentElement.offsetTop];
				
				curTouch1Position[0] = event.touches[0].clientX + canvasOffset[0];
				curTouch1Position[1] = event.touches[0].clientY + canvasOffset[1];
				
				curTouch2Position[0] = event.touches[1].clientX + canvasOffset[0];
				curTouch2Position[1] = event.touches[1].clientY + canvasOffset[1];
				
				curTouchDistance = Math.sqrt(
					Math.pow(prevTouch2Position[0] - prevTouch1Position[0], 2)
					+ Math.pow(prevTouch2Position[1] - prevTouch1Position[1], 2));
				
				var displacement1 = 
					[curTouch1Position[0] - prevTouch1Position[0],
					curTouch1Position[1] - prevTouch1Position[1]];
					
				var displacement2 = 
					[curTouch2Position[0] - prevTouch2Position[0],
					curTouch2Position[1] - prevTouch2Position[1]];
						
				var averageDisplacement =
					[(displacement1[0] + displacement2[0]) / 2,
					(displacement2[1] + displacement2[1]) / 2];
				
				var zoomFactor = curTouchDistance / prevTouchDistance;
				
				if (zoomFactor > 1) {
					zoomFactor = (zoomFactor - 1) * 1.5 + 1;
				} else {
					zoomFactor = 1 - (1 - zoomFactor) * 1.5;
				}
				
				skipNextViewportRedraw = true;
				
				cy.panBy({x: averageDisplacement[0], 
							y: averageDisplacement[1]});
				
				cy.zoom({level: cy.zoom() * zoomFactor,
					position: {x: (curTouch1Position[0] + curTouch2Position[0]) / 2,
								y: (curTouch1Position[1] + curTouch2Position[1]) / 2}});
				
				prevTouch1Position[0] = curTouch1Position[0];
				prevTouch1Position[1] = curTouch1Position[1];
				
				prevTouch2Position[0] = curTouch2Position[0];
				prevTouch2Position[1] = curTouch2Position[1];
				
				prevTouchDistance = curTouchDistance;
				
//				console.log(">= 2 touches, exiting");
				return;	
			}
			
			e = e.touches[0];
			e.button = 0;
		}
		
		var mouseDownEvent = event;
		
//		var renderer = cy.renderer();
		
		// Get references to helper functions
		var dragHandler = renderer.mouseMoveHelper.dragHandler;
		var checkBezierEdgeHover = renderer.mouseMoveHelper.checkBezierEdgeHover;
		var checkStraightEdgeHover = renderer.mouseMoveHelper.checkStraightEdgeHover;
		var checkNodeHover = renderer.mouseMoveHelper.checkNodeHover;
		var hoverHandler = renderer.mouseMoveHelper.hoverHandler;
		
		// Offset for Cytoscape container
		// var mouseOffsetX = cy.container().offset().left + 2;
		// var mouseOffsetY = cy.container().offset().top + 2;
		
		var edges = cy.edges();
		var nodes = cy.nodes();
		
		//cy.renderer().canvas.style.cursor = "default";
		
		mouseDownTime = undefined;
		
		// Drag pan
		if (dragPanMode) {
			dragHandler(e);
		}
		
		var current = cy.renderer().projectMouse(e);
		
		currentMouseX = e.screenX;
		// console.log(previousMouseX, currentMouseX);
		if (previousMouseX !== undefined && Math.abs(previousMouseX - currentMouseX) > 1) {
			// console.log(previousMouseX, currentMouseX);
			wheelZoomEnabled = true;
		}
		
		previousMouseX = currentMouseX;
		
//		console.log("current: " + current[0] + ", " + current[1]);
		
		// Update selection box
		selectBox[2] = current[0];
		selectBox[3] = current[1];
		
//		console.log("sel after: " + selectBox[2] + ", " + selectBox[3]);
		
		if (!selectBox[4]) {
			hoverHandler(nodes, edges, e);
		}
		
		// No mouseclick
		currentMouseDownNode = undefined;
		currentMouseDownEdge = undefined;
		currentMouseDownUnmoved = false;
		
		if (minDistanceNode != undefined) {
		
			if (cy.renderer().canvas.style.cursor != 
					minDistanceNode._private.style["cursor"].value) {

				cy.renderer().canvas.style.cursor = 
					minDistanceNode._private.style["cursor"].value;
			}
			
			if (currentHoveredNode !== minDistanceNode) {

				// Proxy mouseout
				if (currentHoveredNode !== undefined) {
					if (touch) {
//						event.type = "touchend";
					} else {
//						event.type = "mouseout";
						currentHoveredNode.trigger("mouseout");
					}					
				}
				
				currentHoveredNode = minDistanceNode;
				
				var nodeGrabbed = minDistanceNode.grabbed();
				
				// Proxy mouseover
				if (touch && !nodeGrabbed) {
//					event.type = "touchmove";
				} else if (!touch && !nodeGrabbed) {
//					event.type = "mouseover";
					minDistanceNode.trigger("mouseover");
				}
				
			} else {
			
				// Proxy mousemove/touchmove
				if (touch) {
//					event.type = "touchmove";
					minDistanceNode.trigger("touchmove");
				} else {
//					event.type = "mousemove";
					minDistanceNode.trigger("mousemove");
				}
			}
			
		} else if (minDistanceEdge != undefined) {
		
			if (cy.renderer().canvas.style.cursor != 
					minDistanceEdge._private.style["cursor"].value) {

				cy.renderer().canvas.style.cursor = 
					minDistanceEdge._private.style["cursor"].value;
			}
			
			if (currentHoveredEdge !== minDistanceEdge) {

				// Proxy mouseout
				if (currentHoveredEdge !== undefined) {
					if (touch) {

					} else {
						currentHoveredEdge.trigger("mouseout");
					}
				}
				
				currentHoveredEdge = minDistanceEdge;
				
				var edgeGrabbed = minDistanceEdge.grabbed();
				
				// Proxy mouseover
				if (touch && !edgeGrabbed) {

				} else if (!touch && !edgeGrabbed) {
					minDistanceEdge.trigger("mouseover");
				}
				
			} else {
			
				// Proxy mousemove/touchmove
				if (touch) {
					minDistanceEdge.trigger("touchmove");
				} else {
					minDistanceEdge.trigger("mousemove");
				}
			}
			
			/*
			if (currentMouseInCanvas) {
			
				// Proxy mousemove/touchmove
				if (touch) {
					minDistanceEdge.trigger("touchmove");
				} else {
					minDistanceEdge.trigger("mousemove");
				}
				
			} else {
				
				// Proxy mouseover/touchstart
				if (touch) {
					minDistanceEdge.trigger("touchstart");
				} else {
					minDistanceEdge.trigger("mouseover");
				}
				
				currentMouseInCanvas = true;
			}
			*/
			
		} else {
		
			if (!minDistanceNode
				&& !minDistanceEdge
				&& cy.renderer().canvas.style.cursor != "default") {

					cy.renderer().canvas.style.cursor = "default";
			}
			
			// Proxy mouseout for elements
			if (currentHoveredEdge !== undefined) {
				if (touch) {

				} else {
					currentHoveredEdge.trigger("mouseout");
				}
				
				currentHoveredEdge = undefined;
			}
			
			if (currentHoveredNode !== undefined) {
				if (touch) {
					
				} else {
					currentHoveredNode.trigger("mouseout");
				}
				
				currentHoveredNode = undefined;
			}
			
			if (mouseJustEnteredCanvas) {
				// Proxy mouseover
				if (touch) {
	
				} else {
					cy.trigger("mouseover");
				}
				
				currentMouseInCanvas = true;
				mouseJustEnteredCanvas = false;
				
			} else {
//				console.log(currentMouseInCanvas);
				// Proxy mousemove/touchmove
				if (currentMouseInCanvas) {

					if (touch) {
						cy.trigger("touchmove");
					} else {
						cy.trigger("mousemove");
					}
				}
			}	
		}
		
		if (nodeDragging) {
		
			if (!draggedElementsMovedLayer) {
				for (var i = 0; i < nodesBeingDragged.length; i++) {
					nodesBeingDragged[i]._private.rscratch.layer2 = true;
				}
				
				for (var i = 0; i < edgesBeingDragged.length; i++) {
					edgesBeingDragged[i]._private.rscratch.layer2 = true;
				}
				
				renderer.canvasNeedsRedraw[4] = true;
				renderer.redrawReason[4].push("nodes being dragged, moved to drag layer");
				
				renderer.canvasNeedsRedraw[2] = true;
				renderer.redrawReason[2].push("nodes being dragged, moved to drag layer");
				
				draggedElementsMovedLayer = true;
			}
		
			for (var index = 0; index < nodes.length; index++) {
			
				/*
				if ((draggingSelectedNode && nodes[index].selected())
					|| (!draggingSelectedNode && nodes[index] == draggedNode)) {
				*/
				
				if ((draggingSelectedNode && nodes[index].selected())
					|| (!draggingSelectedNode && nodes[index] == draggedNode)) {
					
					if ( !nodes[index]._private.locked && nodes[index]._private.grabbable ) {					
						nodes[index]._private.position.x = 
							nodes[index]._private.rscratch.dragStartX
							+ (selectBox[2] - selectBox[0]);
						nodes[index]._private.position.y = 
							nodes[index]._private.rscratch.dragStartY
							+ (selectBox[3] - selectBox[1]);
							
						// Proxy event
						nodes[index].trigger("drag");
						nodes[index].trigger("position");
					}
				}
			}
			
			renderer.canvasNeedsRedraw[2] = true;
			renderer.redrawReason[2].push("nodes being dragged");
			
			/*
			if (draggingSelectedNode) {
				
			} else {
				draggedNode._private.position.x ==
					draggedNode._private.rscratch.dragStartX
					+ (selectBox[2] - selectBox[0]);
				draggedNode._private.position.y ==
					draggedNode._private.rscratch.dragStartY
					+ (selectBox[3] - selectBox[1]);
					
				console.log("dragging");
				console.log(draggedNode._private.rscratch.dragStartX 
					+ (selectBox[2] - selectBox[0]));
				
				console.log(draggedNode.position());
				console.log("pos:" + draggedNode._private.position.x);
			}
			*/
		}
		
		if (selectBox[4]) {
			renderer.canvasNeedsRedraw[0] = true;
			renderer.redrawReason[0].push("selection boxed moved");
		}
		
		if (dragPanMode || nodeDragging || selectBox[4]) {
			cy.renderer().redraw();
		}
	}
	
	CanvasRenderer.prototype.mouseUpHandler = function(event) {
	
		var touchEvent = undefined;
		
		if (event.changedTouches) {						
			event.preventDefault();
			
//			console.log("touchUp, " + event.changedTouches.length);
			
			touchEvent = event;
			
			event = event.changedTouches[0];
			event.button = 0;

			selectBox[2] = renderer.projectMouse(event)[0];
			selectBox[3] = renderer.projectMouse(event)[1];
		}
		
		var mouseDownEvent = event;
	
		var edges = cy.edges();
		var nodes = cy.nodes();
	
		var nodeBeingDragged = nodeDragging
				&& (Math.abs(selectBox[2] - selectBox[0]) 
				+ Math.abs(selectBox[3] - selectBox[1]) > 1);
				
		/*
		console.log("dx: " + Math.abs(selectBox[2] - selectBox[0]));
		console.log("dy: " + Math.abs(selectBox[3] - selectBox[1]));
		console.log("start: " + selectBox[0] + ", " + selectBox[1]);
		console.log("end: " + selectBox[2] + ", " + selectBox[3]);
		*/
		
		/*	
		if (draggedNode != undefined) {
			draggedNode._private.rscratch.layer2 = false;
		}
		*/
		
		for (var i = 0; i < nodesBeingDragged.length; i++) {
			nodesBeingDragged[i]._private.rscratch.layer2 = false;

			// Proxy free() event
			nodesBeingDragged[i]._private.grabbed = false;
			nodesBeingDragged[i].trigger("free");
		}
		
		nodesBeingDragged = [];
		
		for (var i = 0; i < edgesBeingDragged.length; i++) {
			edgesBeingDragged[i]._private.rscratch.layer2 = false;
		}
		
		// Proxy mouseup event
		var mouseUpElement = undefined;
		if (minDistanceNode !== undefined) {
			mouseUpElement = minDistanceNode;
		} else if (minDistanceEdge !== undefined) {
			mouseUpElement = minDistanceEdge;
		}
		
		mouseDownTime = undefined;
		
		var mouseUpEventName = undefined;
		if (touchEvent) {
			mouseUpEventName = "touchend";
		} else {
			mouseUpEventName = "mouseup";
		}
		
		if (mouseUpElement != undefined) {
			mouseUpElement.trigger(mouseUpEventName);

			if (mouseUpElement === currentMouseDownNode ||
				mouseUpElement === currentMouseDownEdge) {
				
				mouseUpElement.trigger("click");
			}
		} else {
			cy.trigger(mouseUpEventName);
		
			if (currentMouseDownUnmoved) {
				cy.trigger("click");
			}
		}
		
		// Deselect if not dragging or selecting additional
		if (!shiftDown && 
			!nodeBeingDragged) {
			
			var elementsToUnselect = cy.collection();
			
			for (var index = 0; index < nodes.length; index++) {
				nodes[index]._private.rscratch.selected = false;
				if (nodes[index]._private.selected) {
					// nodes[index].unselect();
					
					elementsToUnselect = elementsToUnselect.add(nodes[index]);
				}
			}
			
			for (var index = 0; index < edges.length; index++) {
				edges[index]._private.rscratch.selected = false;
				if (edges[index]._private.selected) {
					// edges[index].unselect();
					
					elementsToUnselect = elementsToUnselect.add(edges[index]);
				}
			}
			
			if (elementsToUnselect.length > 0) {
				elementsToUnselect.unselect();
			}
		}
		
		if (selectBox[4] == 1
			&& !nodeDragging
			&& Math.abs(selectBox[2] - selectBox[0]) 
				+ Math.abs(selectBox[3] - selectBox[1]) > 2) {
			
			var padding = 2;
			
			var edgeSelected;
			var select;
			
			var elementsToSelect = cy.collection();
			
			for (var index = 0; index < edges.length; index++) {
			
				edgeSelected = edges[index]._private.selected;

				var boxInBezierVicinity;
				var rscratch = edges[index]._private.rscratch;
				
				if (edges[index]._private.rscratch.isStraightEdge) {
				
					boxInBezierVicinity = $$.math.boxInBezierVicinity(
						selectBox[0], selectBox[1],
						selectBox[2], selectBox[3],
						edges[index]._private.rscratch.startX,
						edges[index]._private.rscratch.startY,
						(edges[index]._private.rscratch.startX + 
						 edges[index]._private.rscratch.endX) / 2,
						(edges[index]._private.rscratch.startY + 
						 edges[index]._private.rscratch.endY) / 2,
						edges[index]._private.rscratch.endX,
						edges[index]._private.rscratch.endY, padding);
						
				} else if (edges[index]._private.rscratch.isSelfEdge) {
				
					boxInBezierVicinity = $$.math.boxInBezierVicinity(
						selectBox[0], selectBox[1],
						selectBox[2], selectBox[3],
						edges[index]._private.rscratch.startX,
						edges[index]._private.rscratch.startY,
						edges[index]._private.rscratch.cp2ax,
						edges[index]._private.rscratch.cp2ay,
						edges[index]._private.rscratch.selfEdgeMidX,
						edges[index]._private.rscratch.selfEdgeMidY, padding);
					
					if (boxInBezierVicinity == 0) {
					
						boxInBezierVicinity = $$.math.boxInBezierVicinity(
							selectBox[0], selectBox[1],
							selectBox[2], selectBox[3],
							edges[index]._private.rscratch.selfEdgeMidX,
							edges[index]._private.rscratch.selfEdgeMidY,
							edges[index]._private.rscratch.cp2cx,
							edges[index]._private.rscratch.cp2cy,
							edges[index]._private.rscratch.endX,
							edges[index]._private.rscratch.endY, padding);
						
					}
					
				} else {
					
					boxInBezierVicinity = $$.math.boxInBezierVicinity(
							selectBox[0], selectBox[1],
							selectBox[2], selectBox[3],
							edges[index]._private.rscratch.startX,
							edges[index]._private.rscratch.startY,
							edges[index]._private.rscratch.cp2x,
							edges[index]._private.rscratch.cp2y,
							edges[index]._private.rscratch.endX,
							edges[index]._private.rscratch.endY, padding);
					
				}
				
				if (boxInBezierVicinity == 2) {
					select = true;
				} else if (boxInBezierVicinity == 1) {
					
					if (edges[index]._private.rscratch.isSelfEdge) {
					
						select = $$.math.checkBezierCrossesBox(
								selectBox[0], selectBox[1],
								selectBox[2], selectBox[3],
								edges[index]._private.rscratch.startX,
								edges[index]._private.rscratch.startY,
								edges[index]._private.rscratch.cp2ax,
								edges[index]._private.rscratch.cp2ay,
								edges[index]._private.rscratch.selfEdgeMidX,
								edges[index]._private.rscratch.selfEdgeMidY, padding);
						
						if (!select) {
						
							select = $$.math.checkBezierCrossesBox(
								selectBox[0], selectBox[1],
								selectBox[2], selectBox[3],
								edges[index]._private.rscratch.selfEdgeMidX,
								edges[index]._private.rscratch.selfEdgeMidY,
								edges[index]._private.rscratch.cp2cx,
								edges[index]._private.rscratch.cp2cy,
								edges[index]._private.rscratch.endX,
								edges[index]._private.rscratch.endY, padding);
						}
										
					} else if (edges[index]._private.rscratch.isStraightEdge) {
						
						select = $$.math.checkStraightEdgeCrossesBox(
								selectBox[0], selectBox[1],
								selectBox[2], selectBox[3],
								edges[index]._private.rscratch.startX,
								edges[index]._private.rscratch.startY,
								edges[index]._private.rscratch.endX,
								edges[index]._private.rscratch.endY, padding);
	
					} else {
						
						select = $$.math.checkBezierCrossesBox(
								selectBox[0], selectBox[1],
								selectBox[2], selectBox[3],
								edges[index]._private.rscratch.startX,
								edges[index]._private.rscratch.startY,
								edges[index]._private.rscratch.cp2x,
								edges[index]._private.rscratch.cp2y,
								edges[index]._private.rscratch.endX,
								edges[index]._private.rscratch.endY, padding);
						
					}
				} else {
					select = false;
				}
				
				if (select && !edgeSelected) {
					// edges[index].select();
					
					elementsToSelect = elementsToSelect.add(edges[index]);
				} else if (!select && edgeSelected) {
					// edges[index].unselect();
				}
			}
			
			var boxMinX = Math.min(selectBox[0], selectBox[2]);
			var boxMinY = Math.min(selectBox[1], selectBox[3]);
			var boxMaxX = Math.max(selectBox[0], selectBox[2]);
			var boxMaxY = Math.max(selectBox[1], selectBox[3]);
			
			var nodeSelected, select;
			
			var nodePosition, boundingRadius;
			for (var index = 0; index < nodes.length; index++) {
				nodeSelected = nodes[index]._private.selected;

				nodePosition = nodes[index].position();
				boundingRadius = nodes[index]._private.data.weight / 5.0;
				
				if (nodePosition.x > boxMinX
						- boundingRadius
					&& nodePosition.x < boxMaxX 
						+ boundingRadius
					&& nodePosition.y > boxMinY
						- boundingRadius
					&& nodePosition.y < boxMaxY
						+ boundingRadius) {
					
					select = true;
					nodes[index]._private.rscratch.selected = true;		
				} else {
					select = false;
					nodes[index]._private.rscratch.selected = false;
				}
				
				if (select && !nodeSelected) {
					// nodes[index].select();	
					
					elementsToSelect = elementsToSelect.add(nodes[index]);
				} else if (!select && nodeSelected) {
					// nodes[index].unselect();				
				}
			}
			
			if (elementsToSelect.length > 0) {
				elementsToSelect.select();
			}
			
		} else if (selectBox[4] == 0 && !nodeBeingDragged) {

			// Single node/edge selection
			if (minDistanceNode != undefined) {
				minDistanceNode._private.rscratch.hovered = false;
				minDistanceNode._private.rscratch.selected = true;
				
				if (!minDistanceNode._private.selected) {
					minDistanceNode.select();
				}
			} else if (minDistanceEdge != undefined) {
				minDistanceEdge._private.rscratch.hovered = false;
				minDistanceEdge._private.rscratch.selected = true;
				
				if (!minDistanceEdge._private.selected) {
					minDistanceEdge.select();
				}
			}
		}
	
		// Stop drag panning on mouseup
		dragPanMode = false;
//		console.log("drag pan stopped");
		
		if (cy.renderer().canvas.style.cursor != "default") {
			cy.renderer().canvas.style.cursor = "default";
		}
		
		selectBox[4] = 0;
//		selectBox[2] = selectBox[0];
//		selectBox[3] = selectBox[1];
		
		
		renderer.canvasNeedsRedraw[0] = true;
		renderer.redrawReason[0].push("Selection box gone");
		
		if (nodeBeingDragged) {
			renderer.canvasNeedsRedraw[2] = true;
			renderer.redrawReason[2].push("Node drag completed");
			
			renderer.canvasNeedsRedraw[4] = true;
			renderer.redrawReason[4].push("Node drag completed");
		}
		
		// Stop node dragging on mouseup
		nodeDragging = false;
		
		cy.renderer().redraw();
		
		if (touchEvent && touchEvent.touches.length == 1) {
			dragPanStartX = touchEvent.touches[0].clientX;
			dragPanStartY = touchEvent.touches[0].clientY;
			
			dragPanMode = true;
			
			if (cy.renderer().canvas.style.cursor 
				!= cy.style()._private.coreStyle["panning-cursor"].value) {

				cy.renderer().canvas.style.cursor 
					= cy.style()._private.coreStyle["panning-cursor"].value;
			}
		}
	}
	
	CanvasRenderer.prototype.windowMouseDownHandler = function(event) {
		
	}
	
	CanvasRenderer.prototype.windowMouseMoveHandler = function(event) {
		
	}
	
	CanvasRenderer.prototype.windowMouseUpHandler = function(event) {
		
	}
	
	CanvasRenderer.prototype.mouseWheelHandler = function(event) {
		
		if (!wheelZoomEnabled) {
			return;
		} else {
			event.preventDefault();
		}
		
		var deltaY = event.wheelDeltaY;
		
		cy.renderer().zoomLevel -= deltaY / 5.0 / 500;
		
		//console.log("zoomLevel: " + cy.renderer().zoomLevel);
		cy.renderer().scale[0] = Math.pow(10, -cy.renderer().zoomLevel);
		cy.renderer().scale[1] = Math.pow(10, -cy.renderer().zoomLevel);
		
		var current = cy.renderer().projectMouse(event);
		
		var zoomLevel = cy.zoom() * Math.pow(10, event.wheelDeltaY / 500);

		zoomLevel = Math.min(zoomLevel, 100);
		zoomLevel = Math.max(zoomLevel, 0.01);
		
		cy.zoom({level: zoomLevel, 
				position: {x: event.offsetX, 
							y: event.offsetY}});
		
		
		/*
		cy.zoom({level: zoomLevel, 
					renderedPosition: {x: current[0], 
							y: current[1]}});
		*/
		
//		cy.renderer().redraw();
	}
	
	CanvasRenderer.prototype.keyDownHandler = function(event) {
		if (event.keyCode == 16 && selectBox[4] != 1) {
			shiftDown = true;
		}
	}
	
	CanvasRenderer.prototype.keyUpHandler = function(event) {
		if (event.keyCode == 16) {
			selectBox[4] = 0;
			shiftDown = false;
		}
	}
	
	CanvasRenderer.prototype.mouseMoveHelper = function() {
		var dragHandler = function(mouseMoveEvent) {
			var offsetX = mouseMoveEvent.clientX - dragPanStartX;
			var offsetY = mouseMoveEvent.clientY - dragPanStartY;
			
			cy.panBy({x: offsetX, y: offsetY});

			dragPanStartX = mouseMoveEvent.clientX;
			dragPanStartY = mouseMoveEvent.clientY;

			/*
			cy.renderer().center[0] = dragPanInitialCenter[0] - offsetX / cy.renderer().scale[0];
			cy.renderer().center[1] = dragPanInitialCenter[1] - offsetY / cy.renderer().scale[1];
			*/
		};
		
		var checkBezierEdgeHover = function(mouseX, mouseY, edge) {
		
			// var squaredDistanceLimit = 19;
			var squaredDistanceLimit = Math.pow(edge._private.style["width"].value / 2, 2);
			var edgeWithinDistance = false;
		
			if ($$.math.inBezierVicinity(
					mouseX, mouseY,
					edge._private.rscratch.startX,
					edge._private.rscratch.startY,
					edge._private.rscratch.cp2x,
					edge._private.rscratch.cp2y,
					edge._private.rscratch.endX,
					edge._private.rscratch.endY,
					squaredDistanceLimit)) {
				
				//console.log("in vicinity")
				
				// edge._private.rscratch.selected = true;
				
				var squaredDistance = $$.math.sqDistanceToQuadraticBezier(
					mouseX,
					mouseY,
					edge._private.rscratch.startX,
					edge._private.rscratch.startY,
					edge._private.rscratch.cp2x,
					edge._private.rscratch.cp2y,
					edge._private.rscratch.endX,
					edge._private.rscratch.endY);
				
				// debug(distance);
				if (squaredDistance <= squaredDistanceLimit) {
					edgeWithinDistance = true;
					
					if (squaredDistance < minDistanceEdgeValue) {
						minDistanceEdge = edge;
						minDistanceEdgeValue = squaredDistance;
					}
				}	
			}
			
			return edgeWithinDistance;
		}
		
		var checkSelfEdgeHover = function(mouseX, mouseY, edge) {
			
			// var squaredDistanceLimit = 19;
			var squaredDistanceLimit = Math.pow(edge._private.style["width"].value / 2, 2);
			var edgeWithinDistance = false;
			var edgeFound = false;
			
			if ($$.math.inBezierVicinity(
					mouseX, mouseY,
					edge._private.rscratch.startX,
					edge._private.rscratch.startY,
					edge._private.rscratch.cp2ax,
					edge._private.rscratch.cp2ay,
					edge._private.rscratch.selfEdgeMidX,
					edge._private.rscratch.selfEdgeMidY)) {
				
				var squaredDistance = $$.math.sqDistanceToQuadraticBezier(
					mouseX, mouseY,
					edge._private.rscratch.startX,
					edge._private.rscratch.startY,
					edge._private.rscratch.cp2ax,
					edge._private.rscratch.cp2ay,
					edge._private.rscratch.selfEdgeMidX,
					edge._private.rscratch.selfEdgeMidY);
				
				// debug(distance);
				if (squaredDistance < squaredDistanceLimit) {
					
					edgeWithinDistance = true;
					
					if (squaredDistance < minDistanceEdgeValue) {
						minDistanceEdge = edge;
						minDistanceEdgeValue = squaredDistance;
						edgeFound = true;
					}
				}
			}
			
			// Perform the check with the second of the 2 quadratic Beziers
			// making up the self-edge if the first didn't pass
			if (!edgeFound && $$.math.inBezierVicinity(
					mouseX, mouseY,
					edge._private.rscratch.selfEdgeMidX,
					edge._private.rscratch.selfEdgeMidY,
					edge._private.rscratch.cp2cx,
					edge._private.rscratch.cp2cy,
					edge._private.rscratch.endX,
					edge._private.rscratch.endY)) {
				
				var squaredDistance = $$.math.sqDistanceToQuadraticBezier(
					mouseX, mouseY,
					edge._private.rscratch.selfEdgeMidX,
					edge._private.rscratch.selfEdgeMidY,
					edge._private.rscratch.cp2cx,
					edge._private.rscratch.cp2cy,
					edge._private.rscratch.endX,
					edge._private.rscratch.endY);
					
				// debug(distance);
				if (squaredDistance < squaredDistanceLimit) {
					
					edgeWithinDistance = true;
					
					if (squaredDistance < minDistanceEdgeValue) {
						minDistanceEdge = edge;
						minDistanceEdgeValue = squaredDistance;
						edgeFound = true;
					}
				}
			}
			
			return edgeWithinDistance;
		}
		
		var checkStraightEdgeHover = function(mouseX, mouseY, edge, x1, y1, x2, y2) {
			
			// var squaredDistanceLimit = 19;
			var squaredDistanceLimit = Math.pow(edge._private.style["width"].value / 2, 2);
			
			var nearEndOffsetX = mouseX - x1;
			var nearEndOffsetY = mouseY - y1;
			
			var farEndOffsetX = mouseX - x2;
			var farEndOffsetY = mouseY - y2;
			
			var displacementX = x2 - x1;
			var displacementY = y2 - y1;
			
			var distanceSquared;
			var edgeWithinDistance = false;
			
			if (nearEndOffsetX * displacementX 
				+ nearEndOffsetY * displacementY <= 0) {
				
					distanceSquared = (Math.pow(x1 - mouseX, 2)
						+ Math.pow(y1 - mouseY, 2));
			
			} else if (farEndOffsetX * displacementX 
				+ farEndOffsetY * displacementY >= 0) {
				
					distanceSquared = (Math.pow(x2 - mouseX, 2)
						+ Math.pow(y2 - mouseY, 2));
				
			} else {
				var rotatedX = displacementY;
				var rotatedY = -displacementX;
			
				// Use projection on rotated vector
				distanceSquared = Math.pow(nearEndOffsetX * rotatedX 
					+ nearEndOffsetY * rotatedY, 2)
					/ (rotatedX * rotatedX + rotatedY * rotatedY);
			}
			
			if (distanceSquared <= squaredDistanceLimit) {
				edgeWithinDistance = true;
			
				if (distanceSquared < minDistanceEdgeValue) {
					minDistanceEdge = edge;
					minDistanceEdgeValue = distanceSquared;
				}
			}
			
			return edgeWithinDistance;
		}
		
		var checkNodeHover = function(mouseX, mouseY, node) {
			var dX = mouseX - node.position().x;
			var dY = mouseY - node.position().y;
			
			/*
			console.log(node._private.rscratch.boundingRadiusSquared);
			console.log(dX * dX + dY * dY);
			*/
			
			var boundingRadiusSquared = Math.pow(
				Math.max(
					node._private.style["width"].value, 
					node._private.style["height"].value
						+ node._private.style["border-width"].value) / 2, 2);
			
			var distanceSquared = dX * dX + dY * dY;
			
			if (boundingRadiusSquared > distanceSquared) {
				
				if (distanceSquared < minDistanceNodeValue) {
					minDistanceNode = node;
					minDistanceNodeValue = distanceSquared;
					
					nodeHovered = true;
				}
				
				return true;
			}
			
			return false;
		}
	
		var hoverHandler = function(nodes, edges, mouseMoveEvent) {
			
			// Project mouse coordinates to world absolute coordinates
			var projected = cy.renderer().projectMouse(mouseMoveEvent); 

			/*
			console.log("projected x: " + projected[0]);
			console.log("projected y: " + projected[1]);
			cy.nodes()[0]._private.position.x = projected[0];
			cy.nodes()[0]._private.position.y = projected[1];
			*/
			
			var mouseX = projected[0];
			var mouseY = projected[1];
			
			if (minDistanceNode != undefined) {
				minDistanceNode = undefined;
				minDistanceNodeValue = 99999;
		
			} else if (minDistanceEdge != undefined) {
				minDistanceEdge = undefined;
				minDistanceEdgeValue = 99999;
			}
			
			nodeHovered = false;
			
			for (var index = 0; index < nodes.length; index++) {
				checkNodeHover(mouseX, mouseY, nodes[index]);
			}
			
			var edgeWithinDistance = false;
			var potentialPickedEdges = [];
			
			for (var index = 0; index < edges.length; index++) {
				if (nodeHovered) {
					break;
				} else if (edges[index]._private.rscratch.isStraightEdge) {
					edgeWithinDistance = checkStraightEdgeHover(
						mouseX, mouseY, edges[index],
						edges[index]._private.rscratch.startX,
						edges[index]._private.rscratch.startY,
						edges[index]._private.rscratch.endX,
						edges[index]._private.rscratch.endY);
				} else if (edges[index]._private.rscratch.isSelfEdge) {
					edgeWithinDistance = checkSelfEdgeHover(
						mouseX, mouseY, edges[index]);
				} else {
					edgeWithinDistance = checkBezierEdgeHover(
						mouseX, mouseY, edges[index]);
				}
				
				if (edgeWithinDistance) {
					potentialPickedEdges.push(edges[index]);
				}
				
				edgeWithinDistance = false;
			}
			
			if (potentialPickedEdges.length > 0) {
				potentialPickedEdges.sort(function(a, b) {
					return b._private.data.id.localeCompare(a._private.data.id);
				});
				
				potentialPickedEdges.sort(function(a, b) {
					return b._private.style["z-index"].value
						- a._private.style["z-index"].value
				});
				
				minDistanceEdge = potentialPickedEdges[0];
			} else {
				minDistanceEdge = undefined;
			}
			
			if (minDistanceNode != undefined) {
				minDistanceNode._private.rscratch.hovered = true;
			} else if (minDistanceEdge != undefined) {
				minDistanceEdge._private.rscratch.hovered = true;
			}
		}
		
		// Make these related functions (they reference each other) available
		this.mouseMoveHelper.dragHandler = dragHandler;
		this.mouseMoveHelper.checkBezierEdgeHover = checkBezierEdgeHover;
		this.mouseMoveHelper.checkStraightEdgeHover = checkStraightEdgeHover;
		this.mouseMoveHelper.checkNodeHover = checkNodeHover;
		this.mouseMoveHelper.hoverHandler = hoverHandler;
	}
	
	CanvasRenderer.prototype.load = function() {
		var self = this;
		
		this.mouseMoveHelper();
		
		document.addEventListener("keydown", this.keyDownHandler, false);
		document.addEventListener("keyup", this.keyUpHandler, false);
	
		this.bufferCanvases[0].addEventListener("mousedown", this.mouseDownHandler, false);
		window.addEventListener("mouseup", this.mouseUpHandler, false);
	
		window.addEventListener("mousemove", this.mouseMoveHandler, false);
		this.bufferCanvases[0].addEventListener("mouseout", this.mouseOutHandler, false);
		this.bufferCanvases[0].addEventListener("mouseover", this.mouseOverHandler, false);
		
		
		window.addEventListener("mousedown", this.windowMouseDownHandler, false);
		window.addEventListener("mousemove", this.windowMouseMoveHandler, false);
		window.addEventListener("mouseup", this.windowMouseUpHandler, false);
		
		this.bufferCanvases[0].addEventListener("mousewheel", this.mouseWheelHandler, false);
		
//		document.addEventListener("mousemove", this.documentMouseMoveHandler, false);
		
//		document.addEventListener("mousewheel", this.mouseWheelHandler, false);
	
		this.bufferCanvases[0].addEventListener("touchstart", this.mouseDownHandler, true);
		this.bufferCanvases[0].addEventListener("touchmove", this.mouseMoveHandler, true);
		this.bufferCanvases[0].addEventListener("touchend", this.mouseUpHandler, true);
		
		/*
		this.bufferCanvases[0].addEventListener("touchstart", this.mouseDownHandler, true);
		this.bufferCanvases[0].addEventListener("touchmove", this.mouseMoveHandler, true);
		this.bufferCanvases[0].addEventListener("touchend", this.mouseUpHandler, true);
		*/
	}
	
	CanvasRenderer.prototype.init = function() {}

	CanvasRenderer.prototype.complexSqrt = function(real, imaginary, zeroThreshold) {
		var hyp = Math.sqrt(real * real 
			+ imaginary * imaginary)
	
		var gamma = Math.sqrt(0.5 * (real + hyp));
			
		var sigma = Math.sqrt(0.5 * (hyp - real));
		if (imaginary < -zeroThreshold) {
			sigma = -sigma;
		} else if (imaginary < zeroThreshold) {
			sigma = 0;
		}
		
		return [gamma, sigma];
	}

	CanvasRenderer.prototype.initStyle = function() {
		var nodes = this.options.cy.nodes();
		var edges = this.options.cy.edges();
		
		var node;
		for (var index = 0; index < nodes.length; index++) {
			node = nodes[index];
			
			/*
			node._private.rscratch.boundingRadiusSquared = 
				Math.pow(node._private.style.size, 2);
				*/
			node._private.rscratch.override = {};
			
			// console.log(node._private.rscratch.override);
			
			var color = Math.max(Math.random(), 0.6);
			node._private.rscratch.override.regularColor = "rgba(" 
				+ String(Math.floor(color * 100 + 125)) + "," 
				+ String(Math.floor(color * 100 + 125)) + "," 
				+ String(Math.floor(color * 100 + 125)) + "," + 255 + ")"; 
			
			//String(color * 16777215);
			node._private.rscratch.override.regularBorderColor = "rgba(" 
				+ String(Math.floor(color * 70 + 160)) + "," 
				+ String(Math.floor(color * 70 + 160)) + "," 
				+ String(Math.floor(color * 70 + 160)) + "," + 255 + ")"; 
			
			var shape = Math.random();
			if (shape < 10.35) {
				node._private.rscratch.override.shape = "ellipse";
			} else if (shape < 0.49) {
				node._private.rscratch.override.shape = "hexagon";
			} else if (shape < 0.76) {
				node._private.rscratch.override.shape = "square";
			} else if (shape < 0.91) {
				node._private.rscratch.override.shape = "pentagon";
			} else {
				node._private.rscratch.override.shape = "octogon";
			}
			
			node._private.rscratch.canvas = document.createElement('canvas');
		}
		
		var edge;
		for (var index = 0; index < edges.length; index++) {
			edge = edges[index];
			
			edge._private.rscratch.cp2x = Math.random() 
				* this.options.cy.container().width();
			edge._private.rscratch.cp2y = Math.random() 
				* this.options.cy.container().height();
			
			edge._private.rscratch.override = {};
			
			if (Math.random() < 0.45) {
				edge._private.rscratch.override.endShape = "inhibitor";
			}
			
			edge._private.rscratch.override.regularColor = 
				edge.source()[0]._private.rscratch.override.regularBorderColor
				|| defaultNode.regularColor;
		}
	}
	
	CanvasRenderer.prototype.findBezierIntersection = function(edge, targetRadius) {
		
		var x1 = edge.source().position().x;
		var x3 = edge.target().position().x;
		var y1 = edge.source().position().y;
		var y3 = edge.target().position().y;
		
		var approxParam;
		
		var cp2x = edge._private.rscratch.cp2x;
		var cp2y = edge._private.rscratch.cp2y;
		
		approxParam = 0.5 + (0.5 - 0.5 * targetRadius / Math.sqrt(
			Math.pow(cp2x - x3, 2) + Math.pow(cp2y - y3, 2)));
		
		// console.log("approxParam: " + approxParam);
		
		var aX = x1 - 2 * cp2x + x3;
		var bX = -2 * x1 + 2 * cp2x;
		var cX = x1;

		var aY = y1 - 2 * cp2y + y3;
		var bY = -2 * y1 + 2 * cp2y;
		var cY = y1;
		
		var newEndPointX = aX * approxParam * approxParam + bX * approxParam + cX;
		var newEndPointY = aY * approxParam * approxParam + bY * approxParam + cY;
		
		var tan1ax = cp2x - x1;
		var tan1bx = x1;
		
		var tan1ay = cp2y - y1;
		var tan1by = y1;
		
		var tan2ax = newEndPointX - x3;
		var tan2bx = x3;
		
		var tan2ay = newEndPointY - y3;
		var tan2by = y3;
		
		var k;
		if (Math.abs(tan1ax) > 0.0001) {
			k = (tan1ay / tan1ax * (tan2bx - tan1bx) + tan1by - tan2by)
				/ (tan2ay - (tan1ay / tan1ax) * tan2ax);
		} else {
			k = (tan1bx - tan2bx) / (tan2ax);
		}
		
		// console.log("k: " + k);
		
		var newCp2x = tan2ax * k + tan2bx;
		var newCp2y = tan2ay * k + tan2by;

		edge._private.rscratch.newCp2x = newCp2x;
		edge._private.rscratch.newCp2y = newCp2y;
		
		edge._private.rscratch.newEndPointX = newEndPointX;
		edge._private.rscratch.newEndPointY = newEndPointY;
		
		/*
		console.log(newCp2x + ", " + newCp2y);
		console.log(newEndPointX + ", " + newEndPointY);
		*/
	}
	
	CanvasRenderer.prototype.findIntersection = function(x1, y1, x2, y2, targetRadius) {
		var dispX = x2 - x1;
		var dispY = y2 - y1;
		
		var len = Math.sqrt(dispX * dispX + dispY * dispY);
		
		var newLength = len - targetRadius;

		if (newLength < 0) {
			newLength = 0;
		}
		
		return [(newLength / len) * dispX + x1, (newLength / len) * dispY + y1];
	}
	
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
	
	// Finds new endpoints for a bezier edge based on desired source and target radii
	CanvasRenderer.prototype.findNewEndPoints 
		= function(startX, startY, cp2x, cp2y, endX, endY, radius1, radius2) {
		
		var startNearPt = this.findCircleNearPoint(startX, startY, radius1, cp2x, cp2y);
		var endNearPt = this.findCircleNearPoint(endX, endY, radius2, cp2x, cp2y);
		
		return [startNearPt[0], startNearPt[1], endNearPt[0], endNearPt[1]];
	}
	
	// Calculates new endpoints for all bezier edges based on desired source and 
	// target radii
	CanvasRenderer.prototype.calculateNewEndPoints = function() {
		
		var edges = cy.edges();
		var source, target;
		var endpoints;
		
		for (var i = 0; i < edges.length; i++) {
			source = edges[i].source()[0];
			target = edges[i].target()[0];
			
			if (edges[i]._private.rscratch.isStraightEdge) {
				continue;
			}
			
			endpoints = this.findNewEndPoints(
				source.position().x,
				source.position().y,
				edges[i]._private.rscratch.controlPointX,
				edges[i]._private.rscratch.controlPointY,
				target.position().x,
				target.position().y
			);
				
			edges[i]._private.rscratch.updatedStartX = endpoints[0];
			edges[i]._private.rscratch.updatedStartY = endpoints[1];
			edges[i]._private.rscratch.updatedEndX = endpoints[2];
			edges[i]._private.rscratch.updatedEndY = endpoints[3];
		}
		
	}
	
	arrowShapes["arrow"] = {
		draw: function(context) {
			context.lineTo(-0.15, -0.3);
			context.lineTo(0, 0);
			context.lineTo(0.15, -0.3);
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
		draw: function(context) {
			context.translate(0, -0.15);
			context.arc(0, 0, 0.15, 0, Math.PI * 2, false);
		},
		spacing: function(edge) {
			return 0;
		},
		gap: function(edge) {
			return edge._private.style["width"].value * 2;
		}
	}
	
	arrowShapes["inhibitor"] = {
		draw: function(context) {
			context.lineTo(-0.25, 0);
			context.lineTo(-0.25, -0.1);
			context.lineTo(0.25, -0.1);
			context.lineTo(0.25, 0);
		},
		spacing: function(edge) {
			return 4;
		},
		gap: function(edge) {
			return 4;
		}
	}
	
	arrowShapes["square"] = {
		draw: function(context) {
//			context.translate(-0.15, -0.15);
			context.lineTo(-0.12, 0.00);
			context.lineTo(0.12, 0.00);
			context.lineTo(0.12, -0.24);
			context.lineTo(-0.12, -0.24);
		},
		spacing: function(edge) {
			return 0;
		},
		gap: function(edge) {
			return edge._private.style["width"].value * 2;
		}
	}
	
	arrowShapes["diamond"] = {
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
	
	arrowShapeDrawers["arrow"] = function(context) {
		// context.scale(context.lineWidth, context.lineWidth);
		context.lineTo(-0.15, 0.3);
		context.lineTo(0, 0);
		context.lineTo(0.15, 0.3);
	}
	arrowShapeSpacing["arrow"] = 0;
	arrowShapeGap["arrow"] = 4.5;
	
	arrowShapeDrawers["triangle"] = arrowShapeDrawers["arrow"];
	arrowShapeSpacing["triangle"] = arrowShapeSpacing["arrow"];
	arrowShapeGap["triangle"] = arrowShapeGap["arrow"];
	
	arrowShapeDrawers["none"] = function(context) {};
	arrowShapeSpacing["none"] = 0;
	arrowShapeGap["none"] = 0;
	
	arrowShapeDrawers["circle"] = function(context) {
		context.translate(0, -0.15);
		context.arc(0, 0, 0.15, 0, Math.PI * 2, false);
	};
	arrowShapeSpacing["circle"] = 0;
	arrowShapeGap["circle"] = 0.3;
	
	arrowShapeDrawers["inhibitor"] = function(context) {
		// context.scale(context.lineWidth, context.lineWidth);
		context.lineTo(-0.25, 0);
		context.lineTo(-0.25, -0.1);
		context.lineTo(0.25, -0.1);
		context.lineTo(0.25, 0);
	};
	arrowShapeSpacing["inhibitor"] = 4;
	arrowShapeGap["inhibitor"] = 4;
	
	arrowShapeDrawers["tee"] = arrowShapeDrawers["inhibitor"];
	arrowShapeSpacing["tee"] = arrowShapeSpacing["inhibitor"];
	arrowShapeGap["tee"] = arrowShapeGap["inhibitor"];
	
	CanvasRenderer.prototype.drawArrowShape = function(shape, x, y, dispX, dispY) {
		var angle = Math.asin(dispY / (Math.sqrt(dispX * dispX + dispY * dispY)));
						
		if (dispX < 0) {
			//context.strokeStyle = "AA99AA";
			angle = angle + Math.PI / 2;
		} else {
			//context.strokeStyle = "AAAA99";
			angle = - (Math.PI / 2 + angle);
		}
		
		var context = this.context;
		
		context.save();
		
		context.translate(x, y);
		
		context.moveTo(0, 0);
		context.rotate(-angle);
		
		var size = Math.max(Math.pow(context.lineWidth * 13.37, 0.9), 29);
		/// size = 100;
		context.scale(size, size);
		
		context.beginPath();
		
		arrowShapes[shape].draw(context);
		
		context.closePath();
		
//		context.stroke();
		context.fill();
		context.restore();
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
			
			intersect = nodeShapeIntersectLine[target._private.style["shape"].value](
				target,
				target._private.style["width"].value,
				target._private.style["height"].value,
				cp[0], //halfPointX,
				cp[1] //halfPointY
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

			intersect = nodeShapeIntersectLine[source._private.style["shape"].value](
				source,
				source._private.style["width"].value,
				source._private.style["height"].value,
				cp[0], //halfPointX,
				cp[1] //halfPointY
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
			
			intersect = nodeShapeIntersectLine[target._private.style["shape"].value](
				target,
				target._private.style["width"].value,
				target._private.style["height"].value,
				source.position().x,
				source.position().y);
				
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
		
			intersect = nodeShapeIntersectLine[source._private.style["shape"].value](
				source,
				source._private.style["width"].value,
				source._private.style["height"].value,
				target.position().x,
				target.position().y);
			
			if (intersect.length == 0) {
				edge._private.rscratch.noArrowPlacement = true;
	//			return;
			} else {
				edge._private.rscratch.noArrowPlacement = false;
			}
			
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
			
			intersect = nodeShapeIntersectLine[
				target._private.style["shape"].value](
				target,
				target._private.style["width"].value,
				target._private.style["height"].value,
				cp[0], //halfPointX,
				cp[1] //halfPointY
			);
			
			var arrowEnd = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["target-arrow-shape"].value].spacing(edge));
			var edgeEnd = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["target-arrow-shape"].value].gap(edge));
			
			edge._private.rscratch.endX = edgeEnd[0];
			edge._private.rscratch.endY = edgeEnd[1];
			
			edge._private.rscratch.arrowEndX = arrowEnd[0];
			edge._private.rscratch.arrowEndY = arrowEnd[1];
			
			intersect = nodeShapeIntersectLine[
				source._private.style["shape"].value](
				source,
				source._private.style["width"].value,
				source._private.style["height"].value,
				cp[0], //halfPointX,
				cp[1] //halfPointY
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
	
	CanvasRenderer.prototype.drawArrowhead = function(edge) {
		
		var endShape = edge._private.rscratch.override.endShape;
		endShape = endShape ? endShape : defaultEdge.endShape;
		
		var dispX = edge.target().position().x - edge._private.rscratch.newEndPointX;
		var dispY = edge.target().position().y - edge._private.rscratch.newEndPointY;
		
		this.drawArrowShape(edge, edge._private.rscratch.newEndPointX, 
			edge._private.rscratch.newEndPointY, dispX, dispY);
	}
	
	CanvasRenderer.prototype.drawArrowheads = function(edge) {
		// Displacement gives direction for arrowhead orientation
		var dispX, dispY;

		var startX = edge._private.rscratch.arrowStartX;
		var startY = edge._private.rscratch.arrowStartY;
		
		dispX = startX - edge.source().position().x;
		dispY = startY - edge.source().position().y;
		
		//this.context.strokeStyle = "rgba("
		this.context.fillStyle = "rgba("
			+ edge._private.style["source-arrow-color"].value[0] + ","
			+ edge._private.style["source-arrow-color"].value[1] + ","
			+ edge._private.style["source-arrow-color"].value[2] + ","
			+ edge._private.style.opacity.value + ")";
		
		this.context.lineWidth = edge._private.style["width"].value;
		
		this.drawArrowShape(edge._private.style["source-arrow-shape"].value, 
			startX, startY, dispX, dispY);
		
		var endX = edge._private.rscratch.arrowEndX;
		var endY = edge._private.rscratch.arrowEndY;
		
		dispX = -(edge.target().position().x - endX);
		dispY = -(edge.target().position().y - endY);
		
		//this.context.strokeStyle = "rgba("
		this.context.fillStyle = "rgba("
			+ edge._private.style["target-arrow-color"].value[0] + ","
			+ edge._private.style["target-arrow-color"].value[1] + ","
			+ edge._private.style["target-arrow-color"].value[2] + ","
			+ edge._private.style.opacity.value + ")";
		
		this.context.lineWidth = edge._private.style["width"].value;
		
		this.drawArrowShape(edge._private.style["target-arrow-shape"].value,
			endX, endY, dispX, dispY);
	}
	
	CanvasRenderer.prototype.drawStraightArrowhead = function(edge) {
		
		var dispX = edge.target().position().x 
			- edge._private.rscratch.newStraightEndX;
		var dispY = edge.target().position().y 
			- edge._private.rscratch.newStraightEndY;
		
		this.drawArrowShape(
			edge, edge._private.rscratch.newStraightEndX,
			edge._private.rscratch.newStraightEndY,
			dispX, dispY);
	}
	
	
	CanvasRenderer.prototype.calculateEdgeMetrics = function(edge) {
		if (edge._private.data.source == edge._private.data.target) {
			edge._private.rscratch.selfEdge = true;
			return;
		}
		
		// Calculate the 2nd control point
		var startNode = edge._private.data.source < edge._private.data.target ?
			edge.source()[0] : edge.target()[0];
		var endNode = edge._private.data.target < edge._private.data.source ? 
			edge.source()[0] : edge.target()[0];
		
		var middlePointX = 0.5 * (startNode._private.position.x + endNode._private.position.x);
		var middlePointY = 0.5 * (startNode._private.position.y + endNode._private.position.y);
		
		if (this.nodePairEdgeData[edge._private.rscratch.nodePairId] == 1) {
			edge._private.rscratch.straightEdge = true;
			edge._private.rscratch.cp2x = middlePointX;
			edge._private.rscratch.cp2y = middlePointY;
			
			return;
		}
	
		/*
		console.log(startNode._private);
		console.log(endNode._private);
		*/
		
		var numerator = edge._private.rscratch.nodePairEdgeNum - 1;
		var denominator = this.nodePairEdgeData[edge._private.rscratch.nodePairId] - 1;
		var offsetFactor = (numerator / denominator - 0.5);
		
		if (Math.abs(offsetFactor) < 0.0001) {
			edge._private.rscratch.straightEdge = true;
			edge._private.rscratch.cp2x = middlePointX;
			edge._private.rscratch.cp2y = middlePointY;
			//console.log(edge._private.rscratch.cp2x + ", " + edge._private.rscratch.cp2y);
			return;
		}
		
			
		var displacementX = endNode._private.position.x - startNode._private.position.x;
		var displacementY = endNode._private.position.y - startNode._private.position.y;
		
		var offsetX = displacementY * offsetFactor;
		var offsetY = -displacementX * offsetFactor;
		
		edge._private.rscratch.cp2x = middlePointX + offsetX;
		edge._private.rscratch.cp2y = middlePointY + offsetY;
	}
	
	nodeShapeDrawers["ellipse"] = function(node, width, height) {
		var context = renderer.context;
	
		context.beginPath();
		context.save();
		context.translate(node._private.position.x, node._private.position.y);
		context.scale(width / 2, height / 2);
		// At origin, radius 1, 0 to 2pi
		context.arc(0, 0, 1, 0, Math.PI * 2, false);
		context.closePath();
		context.restore();
		context.fill();
	}
	
	// Intersect node shape vs line from (x, y) to node center
	nodeShapeIntersectLine["ellipse"] = function(
		node, width, height, x, y) {
	
		var intersect = renderer.intersectLineEllipse(
			x, y,
			node.position().x,
			node.position().y,
			width / 2 + node._private.style["border-width"].value / 2,
			height / 2 + node._private.style["border-width"].value / 2);
			
		return intersect;
	}
	
	var generateUnitNgonPoints = function(sides, rotationRadians) {
		
		var increment = 1.0 / sides * 2 * Math.PI;
		var startAngle = sides % 2 == 0 ? 
			Math.PI / 2.0 + increment / 2.0 : Math.PI / 2.0;
		
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
	
	CanvasRenderer.prototype.findPolygonIntersection = function(
		node, width, height, x, y, nodeShape, numSides) {
		
		if (nodeShapePoints[nodeShape] == undefined) {
			nodeShapePoints[nodeShape] = generateUnitNgonPoints(numSides, 0);
		}
		
		var intersections = renderer.polygonIntersectLine(
			x, y,
			nodeShapePoints[nodeShape],
			node._private.position.x,
			node._private.position.y,
			width / 2, height / 2,
			node._private.style["border-width"].value / 2);
		
		// If there's multiple, only give the nearest
		return renderer.findNearestIntersection(intersections, x, y);
	}

	
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
	
	nodeShapeDrawers["triangle"] = function(node, width, height) {
		cy.renderer().drawPolygon(node._private.position.x,
			node._private.position.y, width, height, "triangle", 3);
	}
	
	nodeShapeIntersectLine["triangle"] = function(node, width, height, x, y) {
		return renderer.findPolygonIntersection(node, width, height, x, y, "triangle", 3);
	}
	
	nodeShapeDrawers["square"] = function(node, width, height) {
		cy.renderer().drawPolygon(node._private.position.x,
			node._private.position.y, width, height, "square", 4);
	}
	
	nodeShapeIntersectLine["square"] = function(node, width, height, x, y) {
		return renderer.findPolygonIntersection(node, width, height, x, y, "square", 4);
	}
	
	nodeShapeDrawers["rectangle"] = nodeShapeDrawers["square"];
	nodeShapeIntersectLine["rectangle"] = nodeShapeIntersectLine["square"];
	
	nodeShapeDrawers["pentagon"] = function(node, width, height) {
		cy.renderer().drawNgon(node._private.position.x,
			node._private.position.y, width, height, "pentagon", 5);
	}
	
	nodeShapeIntersectLine["pentagon"] = function(node, width, height, x, y) {
		return renderer.findPolygonIntersection(node, width, height, x, y, "pentagon", 5);
	}
	
	nodeShapeDrawers["hexagon"] = function(node, width, height) {
		cy.renderer().drawNgon(node._private.position.x,
			node._private.position.y, width, height, "hexagon", 6);
	}
	
	nodeShapeIntersectLine["hexagon"] = function(node, width, height, x, y) {
		return renderer.findPolygonIntersection(node, width, height, x, y, "hexagon", 6);
	}
	
	nodeShapeDrawers["heptagon"] = function(node, width, height) {
		cy.renderer().drawNgon(node._private.position.x,
			node._private.position.y, width, height, "heptagon", 7);
	}
	
	nodeShapeIntersectLine["heptagon"] = function(node, width, height, x, y) {
		return renderer.findPolygonIntersection(node, width, height, x, y, "heptagon", 7);
	}
	
	nodeShapeDrawers["octagon"] = function(node, width, height) {
		cy.renderer().drawNgon(node._private.position.x,
			node._private.position.y, width, height, "octagon", 8);
	}
	
	nodeShapeIntersectLine["octagon"] = function(node, width, height, x, y) {
		return renderer.findPolygonIntersection(node, width, height, x, y, "octagon", 8);
	}
	
	// nodeShapeUnitPoints["triangle"] = generateNgonPoints(
	
	// Generates points for an n-sided polygon, using a circle of radius 1.
	/*
	CanvasRenderer.prototype.generateUnitNgonPoints = function(sides, rotationRadians) {
		
		var increment = 1.0 / sides * 2 * Math.PI;
		var startAngle = sides % 2 == 0 ? Math.PI / 2.0 + increment / 2.0 : Math.PI / 2.0;
		
		startAngle += rotationRadians;
		
		var points = new Array(sides * 2);
		
		var currentAngle;
		for (var i = 0; i < sides; i++) {
			currentAngle = i * increment + startAngle;
			
			points[2 * i] = Math.cos(currentAngle);
			points[2 * i + 1] = Math.sin(currentAngle);
		}
		
		return points;
	}
	*/
	
	CanvasRenderer.prototype.findNearestIntersection = function(intersections, x, y) {
		
		var distSquared;
		var minDistSquared;
		
		var minDistanceX;
		var minDistanceY;
		
		if (intersections.length == 0) {
			return [];
		}
		
		for (var i = 0; i < intersections.length / 2; i++) {
			distSquared = Math.pow(x - intersections[i * 2], 2)
				+ Math.pow(y - intersections[i * 2 + 1], 2);
			
			if (minDistSquared == undefined || minDistSquared > distSquared) {
				minDistSquared = distSquared;
				
				minDistanceX = intersections[i * 2];
				minDistanceY = intersections[i * 2 + 1];
			}
		}
		
		return [minDistanceX, minDistanceY];
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

	CanvasRenderer.prototype.drawPolygon = function(
		x, y, width, height, nodeShape, numSides) {

		if (nodeShapePoints[nodeShape] == undefined) {
			nodeShapePoints[nodeShape] = generateUnitNgonPoints(numSides, 0);
		}
		
		var points = nodeShapePoints[nodeShape];

		var context = cy.renderer().context;
		context.save();
		context.translate(x, y);
		context.beginPath();
		
		context.scale(width / 2, height / 2);
		context.moveTo(points[0], points[1]);
		
		for (var i = 1; i < points.length / 2; i++) {
			context.lineTo(points[i * 2], points[i * 2 + 1]);
		}
		
		context.closePath();
		context.fill();
		
		context.restore();
	}

	CanvasRenderer.prototype.pointInsidePolygon = function(
		x, y, basePoints, centerX, centerY, width, height, rotation, padding) {
		
		var transformedPoints = new Array(basePoints.length)
		
		for (var i = 0; i < transformedPoints.length / 2; i++) {
			transformedPoints[i * 2] = 
				basePoints[i * 2] * width * Math.cos(rotation) + centerX;
			transformedPoints[i * 2 + 1] = 
				basePoints[i * 2 + 1] * height * Math.sin(rotation) + centerY;
		}
		
		var expandedLineSet = this.expandPolygon(
			transformedPoints,
			-padding);
		
		var points = this.joinLines(expandedLineSet);
		
		
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
		
		var expandedLineSet = this.expandPolygon(
			transformedPoints,
			-padding);
		
		var points = this.joinLines(expandedLineSet);
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
	};
	
	CanvasRenderer.prototype.drawNgon = function(x, y, sides, width, height) {
		var context = cy.renderer().context;
		context.save();
		context.translate(x, y);
		context.beginPath();
		
		var increment = 1 / sides * 2 * Math.PI;
		var startAngle = sides % 2 == 0? Math.PI / 2 + increment / 2 : Math.PI / 2;
		
		context.scale(width / 2, height / 2);
		
		context.moveTo(Math.cos(startAngle), -Math.sin(startAngle));
		for (var angle = startAngle;
			angle < startAngle + 2 * Math.PI; angle += increment) {
		
			context.lineTo(Math.cos(angle), -Math.sin(angle));
		}
		
		context.closePath();
		context.fill();
		
		context.restore();
	}
	
	// Sizes canvas to container if different size
	CanvasRenderer.prototype.matchCanvasSize = function(container) {
		var width = container.clientWidth;
		var height = container.clientHeight;
		
		var canvas;
		for (var i = 0; i < this.canvases.length + this.bufferCanvases.length; i++) {
			
			if (i < this.canvases.length) {
				canvas = this.canvases[i];
			} else {
				canvas = this.bufferCanvases[i - this.canvases.length];
			}
			
			if (canvas.width !== width || canvas.height !== height) {
				
				canvas.width = width;
				canvas.height = height;
			
			}
		}
	}
	
	var doSingleRedraw = false;
	
	CanvasRenderer.prototype.redraw = function(singleRedraw) {
		
		renderer.matchCanvasSize(renderer.container);
		
		if (redrawTimeout) {
//			doSingleRedraw = true;
			// return;
		}
		
		redrawTimeout = setTimeout(function() {
			redrawTimeout = null;
			if (doSingleRedraw && !singleRedraw) {
				renderer.redraw(true);
				doSingleRedraw = false;
				
				// console.log("singleRedraw");
			}
		}, 1000 / 80);
		
		var context = this.context;
		var contexts = this.canvasContexts;
		
		var elements = this.options.cy.elements().toArray();
		var elementsLayer2 = [];
		var elementsLayer4 = [];
		
		if (this.canvasNeedsRedraw[2] || this.canvasNeedsRedraw[4]) {
		
			this.findEdgeControlPoints(this.options.cy.edges());
			
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
		
		if (this.canvasNeedsRedraw[2]) {
			context = this.canvasContexts[2];
			this.context = context;
			
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.clearRect(0, 0, context.canvas.width, context.canvas.height);
			
			context.translate(this.cy.pan().x, this.cy.pan().y);
			context.scale(this.cy.zoom(), this.cy.zoom());
			
			var element;

			for (var index = 0; index < elements.length; index++) {
				element = elements[index];
				
				if (element._private.rscratch.layer2) {
					if (element._private.group == "nodes") {
						this.drawNode(element);
					} else if (element._private.group == "edges") {
						this.drawEdge(element);
					}
				}
			}
			
			for (var index = 0; index < elements.length; index++) {
				element = elements[index];
				
				if (element._private.rscratch.layer2) {
					if (element._private.group == "nodes") {
						this.drawNodeText(element);
					} else if (element._private.group == "edges") {
						this.drawEdgeText(element);
					}
				}
			}
			
			this.canvasNeedsRedraw[2] = false;
			this.redrawReason[2] = [];
		}
		
		if (this.canvasNeedsRedraw[4]) {
			context = this.canvasContexts[4];
			this.context = context;
			
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.clearRect(0, 0, context.canvas.width, context.canvas.height);
			
			context.translate(this.cy.pan().x, this.cy.pan().y);
			context.scale(this.cy.zoom(), this.cy.zoom());
		
//			console.log(4, this.redrawReason[4]);
		
			var element;
			
			for (var index = 0; index < elements.length; index++) {
				element = elements[index];
				
				if (!element._private.rscratch.layer2) {
					if (element._private.group == "nodes") {
						this.drawNode(element);
					} else if (element._private.group == "edges") {
						this.drawEdge(element);
					}
				}
			}
			
			for (var index = 0; index < elements.length; index++) {
				element = elements[index];
				
				if (!element._private.rscratch.layer2) {
					if (element._private.group == "nodes") {
						this.drawNodeText(element);
					} else if (element._private.group == "edges") {
						this.drawEdgeText(element);
					}
				}
			}
			
			this.canvasNeedsRedraw[4] = false;
			this.redrawReason[4] = [];
		}
		
		if (this.canvasNeedsRedraw[0]) {
			context = this.canvasContexts[0];
			
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.clearRect(0, 0, context.canvas.width, context.canvas.height);
		
			context.translate(this.cy.pan().x, this.cy.pan().y);
			context.scale(this.cy.zoom(), this.cy.zoom());
			
			// console.log(0, this.redrawReason[0], selectBox[4]);
			
			if (selectBox[4] == 1) {
				var coreStyle = cy.style()._private.coreStyle;
				var borderWidth = coreStyle["selection-box-border-width"].value;
				
				context.lineWidth = borderWidth;
				context.fillStyle = "rgba(" 
					+ coreStyle["selection-box-color"].value[0] + ","
					+ coreStyle["selection-box-color"].value[1] + ","
					+ coreStyle["selection-box-color"].value[2] + ","
					+ coreStyle["selection-box-opacity"].value + ")";
				
				context.fillRect(selectBox[0] + borderWidth / 2,
					selectBox[1] + borderWidth / 2,
					selectBox[2] - selectBox[0] - borderWidth / 2,
					selectBox[3] - selectBox[1] - borderWidth / 2);
				
				if (borderWidth > 0) {
					context.strokeStyle = "rgba(" 
						+ coreStyle["selection-box-border-color"].value[0] + ","
						+ coreStyle["selection-box-border-color"].value[1] + ","
						+ coreStyle["selection-box-border-color"].value[2] + ","
						+ coreStyle["selection-box-opacity"].value + ")";
					
					context.strokeRect(selectBox[0] + borderWidth / 2,
						selectBox[1] + borderWidth / 2,
						selectBox[2] - selectBox[0] - borderWidth / 2,
						selectBox[3] - selectBox[1] - borderWidth / 2);
				}
			}
			
			this.canvasNeedsRedraw[0] = false;
			this.redrawReason[0] = [];
		}
		
		// Rasterize the layers
		this.bufferCanvasContexts[1].globalCompositeOperation = "copy";
		this.bufferCanvasContexts[1].drawImage(this.canvases[4], 0, 0);
		this.bufferCanvasContexts[1].globalCompositeOperation = "source-over";
		this.bufferCanvasContexts[1].drawImage(this.canvases[2], 0, 0);
		this.bufferCanvasContexts[1].drawImage(this.canvases[0], 0, 0);

		this.bufferCanvasContexts[0].globalCompositeOperation = "copy";
		this.bufferCanvasContexts[0].drawImage(this.bufferCanvases[1], 0, 0);
	};
	
	CanvasRenderer.prototype.drawEdge = function(edge) {
		var context = renderer.context;
		
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
		
			context.beginPath();
			context.moveTo(
				edge._private.rscratch.startX,
				edge._private.rscratch.startY)
			
			context.quadraticCurveTo(
				edge._private.rscratch.cp2ax,
				edge._private.rscratch.cp2ay,
				edge._private.rscratch.selfEdgeMidX,
				edge._private.rscratch.selfEdgeMidY);
			
			context.moveTo(
				edge._private.rscratch.selfEdgeMidX,
				edge._private.rscratch.selfEdgeMidY);
			
			context.quadraticCurveTo(
				edge._private.rscratch.cp2cx,
				edge._private.rscratch.cp2cy,
				edge._private.rscratch.endX,
				edge._private.rscratch.endY);
			
			context.stroke();
			
		} else if (edge._private.rscratch.isStraightEdge) {
			
			// Check if the edge is inverted due to close node proximity
			var nodeDirectionX = endNode._private.position.x - startNode._private.position.x;
			var nodeDirectionY = endNode._private.position.y - startNode._private.position.y;
			
			var edgeDirectionX = edge._private.rscratch.endX - edge._private.rscratch.startX;
			var edgeDirectionY = edge._private.rscratch.endY - edge._private.rscratch.startY;
			
			if (nodeDirectionX * edgeDirectionX
				+ nodeDirectionY * edgeDirectionY < 0) {
				
				edge._private.rscratch.straightEdgeTooShort = true;	
			} else {			
				context.beginPath();
				context.moveTo(
					edge._private.rscratch.startX,
					edge._private.rscratch.startY);
	
				context.lineTo(edge._private.rscratch.endX, 
					edge._private.rscratch.endY);
				context.stroke();
				
				edge._private.rscratch.straightEdgeTooShort = false;	
			}	
		} else {
			
			context.beginPath();
			context.moveTo(
				edge._private.rscratch.startX,
				edge._private.rscratch.startY);
			
			context.quadraticCurveTo(
				edge._private.rscratch.cp2x, 
				edge._private.rscratch.cp2y, 
				edge._private.rscratch.endX, 
				edge._private.rscratch.endY);
			context.stroke();
			
		}
		
		if (edge._private.rscratch.noArrowPlacement !== true
				&& edge._private.rscratch.startX !== undefined) {
			this.drawArrowheads(edge);
		}
	}
	
	CanvasRenderer.prototype.drawEdgeText = function(edge) {
		var context = renderer.context;
	
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
		} else if (edge._private.rscratch.isStraightEdge) {
			edgeCenterX = (edge._private.rscratch.startX
				+ edge._private.rscratch.endX) / 2;
			edgeCenterY = (edge._private.rscratch.startY
				+ edge._private.rscratch.endY) / 2;
		} else if (edge._private.rscratch.isBezierEdge) {
			edgeCenterX = Math.pow(1 - 0.5, 2) * edge._private.rscratch.startX
				+ 2 * (1 - 0.5) * 0.5 * edge._private.rscratch.cp2x
				+ (0.5 * 0.5) * edge._private.rscratch.endX;
			
			edgeCenterY = Math.pow(1 - 0.5, 2) * edge._private.rscratch.startY
				+ 2 * (1 - 0.5) * 0.5 * edge._private.rscratch.cp2y
				+ (0.5 * 0.5) * edge._private.rscratch.endY;
		}
		
		textX = edgeCenterX;
		textY = edgeCenterY;
		
		this.drawText(edge, textX, textY);
	}
	
	CanvasRenderer.prototype.drawNode = function(node) {
		var context = renderer.context;
		
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
		
		// Draw node
		nodeShapeDrawers[node._private.style["shape"].value](
			node,
			nodeWidth,
			nodeHeight); //node._private.data.weight / 5.0
		
		// Border width, draw border
		context.lineWidth = node._private.style["border-width"].value;
		if (node._private.style["border-width"].value > 0) {
			context.stroke();
		}
	}
	
	CanvasRenderer.prototype.drawNodeText = function(node) {
		var context = renderer.context;
		
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
		
		this.drawText(node, textX, textY);
	}
	
	CanvasRenderer.prototype.drawText = function(element, textX, textY) {
		var context = renderer.context;
		
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
		
		context.fillText(text, textX, textY);
		
		var lineWidth = element._private.style["text-outline-width"].value;
		
		if (lineWidth > 0) {
			context.lineWidth = lineWidth;
			context.strokeText(text, textX, textY);
		}
	}
	
	CanvasRenderer.prototype.zoom = function(params){
		// debug(params);
		if (params != undefined && params.level != undefined) {
		
			this.scale[0] = params.level;
			this.scale[1] = params.level;
		}
		
		console.log("zoom call");
		console.log(params);
	};
	
	CanvasRenderer.prototype.fit = function(params){
		console.log("fit call");
		console.log(params);
	};
	
	CanvasRenderer.prototype.pan = function(params){
		console.log("pan call");
		console.log(params);
		
		if (this.context != undefined) {
			
		}
	};
	
	CanvasRenderer.prototype.panBy = function(params){
		this.center[0] -= params.x;
		this.center[1] -= params.y;
		
		this.redraw();
		
		console.log("panBy call");
		console.log(params);
	};
	
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
				
				var movedNodes = cy.collection();
				
				sys.eachNode(function(n, point){ 
					var id = n.name;
					var data = n.data;
					var node = data.element;
					
					if( node == null ){
						return;
					}
					var pos = node.position();
					
					if( !node.locked() && !node.grabbed() ){
						pos.x = point.x;
						pos.y = point.y;
						
						movedNodes = movedNodes.add(node);
					}
				});
				

				var timeToDraw = (+new Date - lastDraw) >= 16;
				if( options.liveUpdate && movedNodes.size() > 0 && timeToDraw ){
					movedNodes.rtrigger("position");
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
