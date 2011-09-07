/**
 * jQuery Colour 0.6
 *
 * Copyright (c) 2009 Adaptavist.com
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 *
 * Author: Mark Gibson (jollytoad at gmail dot com)
 *
 * http://www.adaptavist.com/display/jQuery/Colour+Library
 */
(jQuery.color || (function($) {

$.color = {

	// Compare two colour tuples (must be of the same colour space)
	isEqual: function ( tupleA, tupleB ) {
		if ( tupleA.length !== tupleB.length ) { return false; }
		
		var i = tupleA.length;
		while (i--) {
			if ( tupleA[i] !== tupleB[i] ) { return false; }
		}
		
		return true;
	},
	
	// Fix the values in a colour tuple
	fix: function ( tuple, format ) {
		var i = format.length;
		while (i--) {
			if ( typeof tuple[i] === 'number' ) {
				switch(format.charAt(i)) {
					case 'i': // integer
						tuple[i] = Math.round(tuple[i]);
						break;
					case 'o': // octet; integer 0..255
						tuple[i] = Math.min(255, Math.max(0, Math.round(tuple[i])));
						break;
					case '1': // one: float, 0..1
						tuple[i] = Math.min(1, Math.max(0, tuple[i]));
						break;
				}
			}
		}
		return tuple;
	},
	
	self: function( tuple ) {
		return tuple;
	},
	
	// Common alpha channel retrieval, defaults to 1
	alpha: function( val ) {
		return val === undefined ? 1 : val;
	},
	
	// A collection of colour palettes
	palette: {},
	
	// Registered colour functions
	fns: []
};

})(jQuery)
);

/*
 * jQuery UI Colour Red-Green-Blue 0.6
 *
 * Copyright (c) 2009 Adaptavist.com
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 *
 * Depends:
 *	color.core.js
 */
(jQuery.color && (function($) {

$.color.RGB = {

	fix: function ( rgb ) {
		rgb = $.color.fix(rgb, 'ooo1');
		return rgb;
	},
	
	toRGB: $.color.self,

	// RGB values must be integers in the range 0-255
	toHEX: function ( rgb ) {
		return '#' + (0x1000000 + rgb[0]*0x10000 + rgb[1]*0x100 + rgb[2]).toString(16).slice(-6);
	},

	toCSS: function ( rgb ) {
		if ( $.color.alpha(rgb[3]) === 0 ) {
			// Completely transparent, use the universally supported name
			return 'transparent';
		}
		if ( $.color.alpha(rgb[3]) < 1 ) {
			// Color is not opaque - according to the CSS3 working draft we should
			// not simply treat an RGBA value as an RGB value with opacity ignored.
			return 'rgba(' + rgb.join(',') + ')';
		}
		return 'rgb(' + Array.prototype.slice.call(rgb,0,3).join(',') + ')';
	},
	
	red: function ( rgb ) {
		return rgb[0];
	},
	
	green: function ( rgb ) {
		return rgb[1];
	},
	
	blue: function ( rgb ) {
		return rgb[2];
	},
	
	alpha: function ( rgb ) {
		return $.color.alpha(rgb[3]);
	}
};

$.color.RGB.toString = $.color.RGB.toHEX;

// Register the colour space methods
$.color.fns.push(
	'RGB.toRGB', 'RGB.toHEX', 'RGB.toCSS',
	'RGB.red', 'RGB.green', 'RGB.blue', 'RGB.alpha'
);

})(jQuery)
);

/*
 * jQuery Colour - Common functions for HSV & HSL colour spaces 0.6
 *
 * Copyright (c) 2009 Adaptavist.com
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 *
 * Depends:
 *	color.core.js
 *  color.rgb.js
 */
(jQuery.color && (function($) {

$.color.HueBased = {

	fix: function ( hx ) {
		hx[0] = (hx[0] + 1) % 1;
		return $.color.fix(hx, '1111');
	},

	complementary: function ( hx, offset ) {
		return [ (hx[0] + 0.5 + (offset || 0)) % 1.0, hx[1], hx[2], hx[3] ];
	},

	analogous: function ( hx, offset ) {
		return [ (hx[0] + 1.0 + (offset || 0)) % 1.0, hx[1], hx[2], hx[3] ];
	},

	hue: function ( hx ) {
		return hx[0];
	},

	alpha: function ( hx ) {
		return $.color.alpha(hx[3]);
	}
};

})(jQuery)
);

/*
 * jQuery Colour Hue-Saturation-Value 0.6
 *
 * Copyright (c) 2009 Adaptavist.com
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 *
 * Depends:
 *	color.core.js
 *  color.rgb.js
 *  color.huebased.js
 */
(jQuery.color && (function($) {

$.color.HSV = $.extend({

	toHSV: $.color.self,

	// HSV values are normalized to the range 0..1
	toRGB: function ( hsv ) {
		var ha = hsv[0]*6,
			hb = Math.floor( ha ),
			f = ha - hb,
			s = hsv[1],
			v = hsv[2] * 255,
			a = hsv[3],
			p = Math.round(v * ( 1 - s )),
			q = Math.round(v * ( 1 - f * s)),
			t = Math.round(v * ( 1 - ( 1 - f ) * s ));
		v = Math.round(v);
		switch (hb % 6) {
			case 0: return [v,t,p,a];
			case 1: return [q,v,p,a];
			case 2: return [p,v,t,a];
			case 3: return [p,q,v,a];
			case 4: return [t,p,v,a];
			case 5: return [v,p,q,a];
		}
	},

	// NOTE: the 'V' this is to distingush HSV from HSL which has a differing view of saturation
	saturationV: function ( hsv ) {
		return hsv[1];
	},

	value: function ( hsv ) {
		return hsv[2];
	}

}, $.color.HueBased);

$.color.RGB.toHSV = function ( rgb ) {
	var r = rgb[0]/255,
		g = rgb[1]/255,
		b = rgb[2]/255,
		min = Math.min(r,g,b),
		max = Math.max(r,g,b),
		d = max - min;

	return [
		d === 0 ? 0 :
		(g === max ? (b-r)/d/6 + (1/3) :
		 b === max ? (r-g)/d/6 + (2/3) :
		         (g-b)/d/6 + 1) % 1,
		d === 0 ? 0 : d/max,
		max,
		rgb[3]
	];
};

// Register the colour space methods
$.color.fns.push(
	'HSV.toHSV', 'HSV.toRGB', 'RGB.toHSV',
	'HSV.complementary', 'HSV.analogous',
	'HSV.hue', 'HSV.saturationV', 'HSV.value', 'HSV.alpha'
);

})(jQuery)
);

/*
 * jQuery Colour Hue-Saturation-Lightness 0.6
 *
 * Copyright (c) 2009 Adaptavist.com
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 *
 * Depends:
 *	color.core.js
 *  color.rgb.js
 *  color.huebased.js
 */
(jQuery.color && (function($) {

$.color.HSL = $.extend({

	toHSL: $.color.self,

	toRGB: function ( hsl ) {
		var h = hsl[0],
			s = hsl[1],
			l = hsl[2],
			q = l < 0.5 ? l*(1+s) : l+s-(l*s),
			p = 2*l-q;

		function c(x) {
			var t = x < 0 ? x+1 : x > 1 ? x-1 : x;
			return t < 1/6 ? p + (q-p) * 6 * t :
			       t < 1/2 ? q :
			       t < 2/3 ? p + (q-p) * 6 * (2/3 - t) :
			                 p;
		}

		return [
			Math.round(255 * c(h + 1/3)),
			Math.round(255 * c(h)),
			Math.round(255 * c(h - 1/3)),
			hsl[3]
		];
	},

	// NOTE: the 'L' this is to distingush HSL from HSV which has a differing view of saturation
	saturationL: function ( hsl ) {
		return hsl[1];
	},

	lightness: function ( hsl ) {
		return hsl[2];
	}

}, $.color.HueBased);

$.color.RGB.toHSL = function ( rgb ) {
	var r = rgb[0]/255,
		g = rgb[1]/255,
		b = rgb[2]/255,
		min = Math.min(r,g,b),
		max = Math.max(r,g,b),
		d = max - min,
		p = max + min;

	return [
		d === 0 ? 0 :
		(g === max ? (b-r)/d/6 + (1/3) :
		 b === max ? (r-g)/d/6 + (2/3) :
		             (g-b)/d/6 + 1) % 1,

		d === 0 ? 0 :
		p > 1 ? d / (2 - max - min) :
		        d / p,

		p/2,
		rgb[3]
	];
};

$.color.fns.push(
	'HSL.toHSL', 'HSL.toRGB', 'RGB.toHSL',
	'HSL.complementary', 'HSL.analogous',
	'HSL.hue', 'HSL.saturationL', 'HSL.lightness', 'HSL.alpha'
);

})(jQuery)
);

/*
 * jQuery Colour Object 0.6
 *
 * Copyright (c) 2009 Adaptavist.com
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 *
 * Depends:
 *  color.core.js
 *  color.rgb.js
 */
(jQuery.color && jQuery.Color || (function($) {

// Construct a colour object of a given space (eg. 'RGB', 'HSV')
$.Color = function ( color, space, name ) {
	if ( typeof this === 'function' ) {
		return new $.Color(color, space, name);
	}
	
	if ( typeof color === 'string' && $.color.parse ) {
		if (!name) {
			name = color;
		}
		// Attempt to parse the string if the parser is available
		color = $.color.parse(color);
	}
	
	if ( color && color.length ) {
		// Copy channel values
		var i;
		i = this.length = color.length;
		while( i-- ) {
			this[i] = color[i];
		}
	}
	
	if ( color ) {
		this.space = space || color.space || 'RGB';
		this.name = name || color.name;
	}
};

function modify( tuple, relative ) {
	// Ensure the color to be modified is the same space as the argument
	var color = $.Color.isInstance(tuple) && tuple.space !== this.space ?
				this.to(tuple.space) :
				new $.Color(this),
		i = color.length,
		mod = false;
	
	while( i-- ) {
		if ( typeof tuple[i] === 'number' ) {
			var v = relative ? color[i] + tuple[i] : tuple[i];
			if ( v !== color[i] ) {
				color[i] = v;
				mod = true;
			}
		}
	}
	
	return mod ? color.setName() : this;
}

$.Color.fn = $.Color.prototype = {

	color: "0.6",
	
	// Get the utility functions for the colour space
	util: function() {
		return $.color[this.space];
	},
	
	// Convert the colour to a different colour space
	to: function( space ) {
		return this['to'+space]();
	},

	// Ensure colour channels values are within the valid limits
	fix: function() {
		return this.util().fix(this);
	},
	
	// Modify the individual colour channels, returning a new color object
	modify: function( tuple ) {
		return modify.call(this, tuple);
	},
	
	// Adjust the colour channels relative to current values
	adjust: function( tuple ) {
		return modify.call(this, tuple, true);
	},
	
	setName: function( newName ) {
		this.name = newName;
		return this;
	},

	toString: function() {
		if ( !this.space ) { return ''; }
		var util = this.util();
		return util.hasOwnProperty('toString') ? util.toString(this) : this.to('RGB').toString();
	},
	
	join: [].join,
	push: [].push
};

// Check whether the given argument is a valid color object
$.Color.isInstance = function( color ) {
	return color && typeof color === 'object' && color.color === $.Color.fn.color && color.space;
};

// Hold the default colour space for each method
$.Color.fnspace = {};

// Generate the wrapper for colour methods calls
function wrapper( color, subject, fn, space, copyName ) {
	return function() {
		var args = [color];
		Array.prototype.push.apply(args, arguments);
		var result = fn.apply(subject, args);
		return $.isArray(result) ? new $.Color(result, space, copyName ? color.name : undefined) : result;
	};
}

// Generate the prototype for method calls
function method( color, name ) {
	var toSpace = /^to/.test(name) ? name.substring(2) : false;
	
	return function() {
		var color = this,
			util = color.util();
		
		if ( !util[name] ) {
			// Convert to the appropriate colour space
			color = color.to($.Color.fnspace[name]);
			util = color.util();
		}
		
		var fn = wrapper(color, util, util[name], toSpace || color.space, !!toSpace),
			result = fn.apply(color, arguments);
		
		// Override the function for this instance so it can be reused
		// without the overhead of another lookup or conversion.
		if ( toSpace ) {
			// The function will return the same result every time, so cache the result
			this[name] = function() {
				return result;
			};
			if ( $.Color.isInstance(result) ) {
				color = this;
				result['to'+this.space] = function() {
					return color;
				};
			}
		} else {
			this[name] = fn;
		}
		
		return result;
	};
}

// Add colour function to the prototype
function addfn() {
	var s = this.split('.'),
		name = s[1],
		space = s[0];
	
	// Ensure the colour space conversion function isn't associated with it's own space
	if ( !$.Color.fnspace[name] && name !== 'to'+space ) {
		$.Color.fnspace[name] = space;
	}
	
	if ( !$.Color.fn[name] ) {
		$.Color.fn[name] = method(this, name);
	}
}

// Add existing functions
$.each($.color.fns, addfn);

// Override push to catch new functions
$.color.fns.push = function() {
	$.each(arguments, addfn);
	return Array.prototype.push.apply(this, arguments);
};

})(jQuery)
);

/*
 * jQuery Colour Parsing 0.6
 *
 * Copyright (c) 2009 Adaptavist.com
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 *
 * Depends:
 *  color.core.js
 */
(jQuery.color && (function($) {

$.extend($.color, {

	// Color string parsing taken from effects.core.js
	parse: function ( color ) {
		var m;

		if ( typeof color === 'string' ) {

			// Look for rgb(int,int,int) or rgba(int,int,int,float)
			if ( (m = /^\s*rgb(a)?\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*(?:,\s*([0-9]+(?:\.[0-9]+)?)\s*)?\)\s*$/.exec(color)) && !m[1] === !m[5] ) {
				return [parseInt(m[2],10), parseInt(m[3],10), parseInt(m[4],10), m[5] ? parseFloat(m[5]) : 1];
			}

			// Look for rgb(float%,float%,float%) or rgba(float%,float%,float%,float)
			if ( (m = /^\s*rgb(a)?\(\s*([0-9]+(?:\.[0-9]+)?)\%\s*,\s*([0-9]+(?:\.[0-9]+)?)\%\s*,\s*([0-9]+(?:\.[0-9]+)?)\%\s*(?:,\s*([0-9]+(?:\.[0-9]+)?)\s*)?\)\s*$/.exec(color)) && !m[1] === !m[5] ) {
				return [parseFloat(m[2])*255/100, parseFloat(m[3])*255/100, parseFloat(m[4])*255/100, m[5] ? parseFloat(m[5]) : 1];
			}

			// Look for #a0b1c2
			if ( (m = /^\s*#([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})\s*$/.exec(color)) ) {
				return [parseInt(m[1],16), parseInt(m[2],16), parseInt(m[3],16), 1];
			}

			// Look for #fff
			if ( (m = /^\s*#([a-fA-F0-9])([a-fA-F0-9])([a-fA-F0-9])\s*$/.exec(color)) ) {
				return [parseInt(m[1]+m[1],16), parseInt(m[2]+m[2],16), parseInt(m[3]+m[3],16), 1];
			}

			// Look for hsl(int,float%,float%) or hsla(int,float%,float%,float)
			if ( (m = /^\s*hsl(a)?\(\s*([0-9]{1,3})\s*,\s*([0-9]+(?:\.[0-9]+)?)\%\s*,\s*([0-9]+(?:\.[0-9]+)?)\%\s*(?:,\s*([0-9]+(?:\.[0-9]+)?)\s*)?\)\s*$/.exec(color)) && !m[1] === !m[5] ) {
				return [parseInt(m[2],10)/360, parseFloat(m[3])/100, parseFloat(m[4])/100, m[5] ? parseFloat(m[5]) : 1];
			}

			// Otherwise, we're most likely dealing with a named color
			return $.color.named(color);
		}

		// Check if we're already dealing with a color tuple
		if ( color && ( color.length === 3 || color.length === 4 ) ) {
			if ( color.length === 3 ) {
				color.push( 1 );
			}
			return color;
		}
	},

	named: function ( color ) {
		var result;
		color = $.trim(color.toLowerCase());

		// Check for transparent
		if ( color === "transparent" ) {
			return [0, 0, 0, 0];
		}

		$.each($.color.palette, function(n, palette) {
			if (palette[color]) {
				result = palette[color];
				return false;
			}
		});
		return result;
	}

});

})(jQuery)
);

/*
 * jQuery Colour Related Palette Generator 0.6
 *
 * Copyright (c) 2009 Adaptavist.com
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 *
 * Depends:
 *  color.object.js
 */
(jQuery.Color && (function($) {

// Generate a palette of related colours
$.Color.fn.related = function( offset ) {
	var i18n = $.Color.fn.related.i18n,
		off = offset || $.Color.fn.related.offset,
		offD = Math.round(off * 360) + i18n.deg;
	
	return {
		'anal-': this.analogous(-off).setName(i18n.anal + ' -' + offD),
		'anal0': this.analogous().setName(i18n.orig),
		'anal+': this.analogous(off).setName(i18n.anal + ' +' + offD),
		
		'comp-': this.complementary(-off).setName(i18n.split + ' -' + offD),
		'comp0': this.complementary().setName(i18n.comp),
		'comp+': this.complementary(off).setName(i18n.split + ' +' + offD),
		
		'triad-': this.analogous(-1/3).setName(i18n.triad + ' -120' + i18n.deg),
		'triad0': this.analogous().setName(i18n.orig),
		'triad+': this.analogous(1/3).setName(i18n.triad + ' +120' + i18n.deg)
	};
};

$.Color.fn.related.offset = 30/360;

$.Color.fn.related.i18n = {
	'deg': '°',
	'anal': 'Analogous',
	'orig': 'Original',
	'split': 'Split Complementary',
	'comp': 'Complementary',
	'triad': 'Triadic'
};

})(jQuery)
);

/*
 * jQuery Colour SVG/X11/CSS3 Palette 0.6
 *
 * Copyright (c) 2009 Adaptavist.com
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 *
 * Depends:
 *  color.core.js
 */
(jQuery.color && (function($) {

$.color.palette.css3 = {
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
};

})(jQuery)
);

/*
 * jQuery CSS Colour Manipulation 0.6
 *
 * Copyright (c) 2010 Mark Gibson
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 *
 * Depends:
 *  color.core.js
 *  color.object.js
 */
(function($) {

	// Extract a CSS colour property as a Color object from the selection
	$.fn.cssColor = function(prop) {
		return $.Color(this.css(prop));
	};

	// Apply the colour to a CSS property on the selection
	$.Color.fn.applyCSS = function(selector, prop) {
		$(selector).css(prop, this.toCSS());
		return this;
	};

})(jQuery);

