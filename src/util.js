;(function($$, window){ 'use strict';
  
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
      if ( typeof target === 'boolean' ) {
        deep = target;
        target = arguments[1] || {};
        // skip the boolean and the target
        i = 2;
      }

      // Handle case when target is a string or something (possible in deep copy)
      if ( typeof target !== 'object' && !$$.is.fn(target) ) {
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

    // ported lodash throttle function
    throttle: function(func, wait, options) {
      var leading = true,
          trailing = true;

      if (options === false) {
        leading = false;
      } else if ($$.is.plainObject(options)) {
        leading = 'leading' in options ? options.leading : leading;
        trailing = 'trailing' in options ? options.trailing : trailing;
      }
      options = options || {};
      options.leading = leading;
      options.maxWait = wait;
      options.trailing = trailing;

      return $$.util.debounce(func, wait, options);
    },

    now: function(){
      return +new Date();
    },

    // ported lodash debounce function
    debounce: function(func, wait, options) {
      var args,
          maxTimeoutId,
          result,
          stamp,
          thisArg,
          timeoutId,
          trailingCall,
          lastCalled = 0,
          maxWait = false,
          trailing = true;

      if (!$$.is.fn(func)) {
        return;
      }
      wait = Math.max(0, wait) || 0;
      if (options === true) {
        var leading = true;
        trailing = false;
      } else if ($$.is.plainObject(options)) {
        leading = options.leading;
        maxWait = 'maxWait' in options && (Math.max(wait, options.maxWait) || 0);
        trailing = 'trailing' in options ? options.trailing : trailing;
      }
      var delayed = function() {
        var remaining = wait - ($$.util.now() - stamp);
        if (remaining <= 0) {
          if (maxTimeoutId) {
            clearTimeout(maxTimeoutId);
          }
          var isCalled = trailingCall;
          maxTimeoutId = timeoutId = trailingCall = undefined;
          if (isCalled) {
            lastCalled = $$.util.now();
            result = func.apply(thisArg, args);
            if (!timeoutId && !maxTimeoutId) {
              args = thisArg = null;
            }
          }
        } else {
          timeoutId = setTimeout(delayed, remaining);
        }
      };

      var maxDelayed = function() {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        maxTimeoutId = timeoutId = trailingCall = undefined;
        if (trailing || (maxWait !== wait)) {
          lastCalled = $$.util.now();
          result = func.apply(thisArg, args);
          if (!timeoutId && !maxTimeoutId) {
            args = thisArg = null;
          }
        }
      };

      return function() {
        args = arguments;
        stamp = $$.util.now();
        thisArg = this;
        trailingCall = trailing && (timeoutId || !leading);

        if (maxWait === false) {
          var leadingCall = leading && !timeoutId;
        } else {
          if (!maxTimeoutId && !leading) {
            lastCalled = stamp;
          }
          var remaining = maxWait - (stamp - lastCalled),
              isCalled = remaining <= 0;

          if (isCalled) {
            if (maxTimeoutId) {
              maxTimeoutId = clearTimeout(maxTimeoutId);
            }
            lastCalled = stamp;
            result = func.apply(thisArg, args);
          }
          else if (!maxTimeoutId) {
            maxTimeoutId = setTimeout(maxDelayed, remaining);
          }
        }
        if (isCalled && timeoutId) {
          timeoutId = clearTimeout(timeoutId);
        }
        else if (!timeoutId && wait !== maxWait) {
          timeoutId = setTimeout(delayed, wait);
        }
        if (leadingCall) {
          isCalled = true;
          result = func.apply(thisArg, args);
        }
        if (isCalled && !timeoutId && !maxTimeoutId) {
          args = thisArg = null;
        }
        return result;
      };
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
        for(var i in map){ // jshint ignore:line
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
          $$.util.error('Tried to set map with object key');
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
          $$.util.error('Tried to get map with object key');
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
          $$.util.error('Tried to delete map with object key');
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
          ret.push( '-' );
          ret.push( chLowerCase );
        } else {
          ret.push( ch );
        }
      }

      var noUpperCases = ret.length === str.length;
      if( noUpperCases ){ return str; } // cheaper than .join()

      return ret.join('');
    },

    dash2camel: function( str ){
      var ret = [];
      var nextIsUpper = false;

      for( var i = 0; i < str.length; i++ ){
        var ch = str[i];
        var isDash = ch === '-';

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

      return ret.join('');
    },

    // strip spaces from beginning of string and end of string
    trim: function( str ){
      var first, last;

      // find first non-space char
      for( first = 0; first < str.length && str[first] === ' '; first++ ){}

      // find last non-space char
      for( last = str.length - 1; last > first && str[last] === ' '; last-- ){}

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
      var h, s, l, a, r, g, b;
      function hue2rgb(p, q, t){
        if(t < 0) t += 1;
        if(t > 1) t -= 1;
        if(t < 1/6) return p + (q - p) * 6 * t;
        if(t < 1/2) return q;
        if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      }

      var m = new RegExp("^" + $$.util.regex.hsla + "$").exec(hsl);
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
          var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          var p = 2 * l - q;
          r = Math.round( 255 * hue2rgb(p, q, h + 1/3) );
          g = Math.round( 255 * hue2rgb(p, q, h) );
          b = Math.round( 255 * hue2rgb(p, q, h - 1/3) );
        }

        ret = [r, g, b, a];
      }

      return ret;
    },

    // get [r, g, b, a] from rgb(0, 0, 0) or rgba(0, 0, 0, 0)
    rgb2tuple: function( rgb ){
      var ret;

      var m = new RegExp("^" + $$.util.regex.rgba + "$").exec(rgb);
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

    colors: {
      // special colour names
      transparent:      [0,0,0,0], // NB alpha === 0

      // regular colours
      aliceblue:        [240,248,255],
      antiquewhite:      [250,235,215],
      aqua:          [0,255,255],
      aquamarine:        [127,255,212],
      azure:          [240,255,255],
      beige:          [245,245,220],
      bisque:          [255,228,196],
      black:          [0,0,0],
      blanchedalmond:      [255,235,205],
      blue:          [0,0,255],
      blueviolet:        [138,43,226],
      brown:          [165,42,42],
      burlywood:        [222,184,135],
      cadetblue:        [95,158,160],
      chartreuse:        [127,255,0],
      chocolate:        [210,105,30],
      coral:          [255,127,80],
      cornflowerblue:      [100,149,237],
      cornsilk:        [255,248,220],
      crimson:        [220,20,60],
      cyan:          [0,255,255],
      darkblue:        [0,0,139],
      darkcyan:        [0,139,139],
      darkgoldenrod:      [184,134,11],
      darkgray:        [169,169,169],
      darkgreen:        [0,100,0],
      darkgrey:        [169,169,169],
      darkkhaki:        [189,183,107],
      darkmagenta:      [139,0,139],
      darkolivegreen:      [85,107,47],
      darkorange:        [255,140,0],
      darkorchid:        [153,50,204],
      darkred:        [139,0,0],
      darksalmon:        [233,150,122],
      darkseagreen:      [143,188,143],
      darkslateblue:      [72,61,139],
      darkslategray:      [47,79,79],
      darkslategrey:      [47,79,79],
      darkturquoise:      [0,206,209],
      darkviolet:        [148,0,211],
      deeppink:        [255,20,147],
      deepskyblue:      [0,191,255],
      dimgray:        [105,105,105],
      dimgrey:        [105,105,105],
      dodgerblue:        [30,144,255],
      firebrick:        [178,34,34],
      floralwhite:      [255,250,240],
      forestgreen:      [34,139,34],
      fuchsia:        [255,0,255],
      gainsboro:        [220,220,220],
      ghostwhite:        [248,248,255],
      gold:          [255,215,0],
      goldenrod:        [218,165,32],
      gray:          [128,128,128],
      grey:          [128,128,128],
      green:          [0,128,0],
      greenyellow:      [173,255,47],
      honeydew:        [240,255,240],
      hotpink:        [255,105,180],
      indianred:        [205,92,92],
      indigo:          [75,0,130],
      ivory:          [255,255,240],
      khaki:          [240,230,140],
      lavender:        [230,230,250],
      lavenderblush:      [255,240,245],
      lawngreen:        [124,252,0],
      lemonchiffon:      [255,250,205],
      lightblue:        [173,216,230],
      lightcoral:        [240,128,128],
      lightcyan:        [224,255,255],
      lightgoldenrodyellow:  [250,250,210],
      lightgray:        [211,211,211],
      lightgreen:        [144,238,144],
      lightgrey:        [211,211,211],
      lightpink:        [255,182,193],
      lightsalmon:      [255,160,122],
      lightseagreen:      [32,178,170],
      lightskyblue:      [135,206,250],
      lightslategray:      [119,136,153],
      lightslategrey:      [119,136,153],
      lightsteelblue:      [176,196,222],
      lightyellow:      [255,255,224],
      lime:          [0,255,0],
      limegreen:        [50,205,50],
      linen:          [250,240,230],
      magenta:        [255,0,255],
      maroon:          [128,0,0],
      mediumaquamarine:    [102,205,170],
      mediumblue:        [0,0,205],
      mediumorchid:      [186,85,211],
      mediumpurple:      [147,112,219],
      mediumseagreen:      [60,179,113],
      mediumslateblue:    [123,104,238],
      mediumspringgreen:    [0,250,154],
      mediumturquoise:    [72,209,204],
      mediumvioletred:    [199,21,133],
      midnightblue:      [25,25,112],
      mintcream:        [245,255,250],
      mistyrose:        [255,228,225],
      moccasin:        [255,228,181],
      navajowhite:      [255,222,173],
      navy:          [0,0,128],
      oldlace:        [253,245,230],
      olive:          [128,128,0],
      olivedrab:        [107,142,35],
      orange:          [255,165,0],
      orangered:        [255,69,0],
      orchid:          [218,112,214],
      palegoldenrod:      [238,232,170],
      palegreen:        [152,251,152],
      paleturquoise:      [175,238,238],
      palevioletred:      [219,112,147],
      papayawhip:        [255,239,213],
      peachpuff:        [255,218,185],
      peru:          [205,133,63],
      pink:          [255,192,203],
      plum:          [221,160,221],
      powderblue:        [176,224,230],
      purple:          [128,0,128],
      red:          [255,0,0],
      rosybrown:        [188,143,143],
      royalblue:        [65,105,225],
      saddlebrown:      [139,69,19],
      salmon:          [250,128,114],
      sandybrown:        [244,164,96],
      seagreen:        [46,139,87],
      seashell:        [255,245,238],
      sienna:          [160,82,45],
      silver:          [192,192,192],
      skyblue:        [135,206,235],
      slateblue:        [106,90,205],
      slategray:        [112,128,144],
      slategrey:        [112,128,144],
      snow:          [255,250,250],
      springgreen:      [0,255,127],
      steelblue:        [70,130,180],
      tan:          [210,180,140],
      teal:          [0,128,128],
      thistle:        [216,191,216],
      tomato:          [255,99,71],
      turquoise:        [64,224,208],
      violet:          [238,130,238],
      wheat:          [245,222,179],
      white:          [255,255,255],
      whitesmoke:        [245,245,245],
      yellow:          [255,255,0],
      yellowgreen:      [154,205,50]
    }
      
  };

  $$.util.regex = {};
  
  $$.util.regex.number = "(?:[-]?\\d*\\.\\d+|[-]?\\d+|[-]?\\d*\\.\\d+[eE]\\d+)";
  
  $$.util.regex.rgba = "rgb[a]?\\(("+ $$.util.regex.number +"[%]?)\\s*,\\s*("+ $$.util.regex.number +"[%]?)\\s*,\\s*("+ $$.util.regex.number +"[%]?)(?:\\s*,\\s*("+ $$.util.regex.number +"))?\\)";
  $$.util.regex.rgbaNoBackRefs = "rgb[a]?\\((?:"+ $$.util.regex.number +"[%]?)\\s*,\\s*(?:"+ $$.util.regex.number +"[%]?)\\s*,\\s*(?:"+ $$.util.regex.number +"[%]?)(?:\\s*,\\s*(?:"+ $$.util.regex.number +"))?\\)";
  
  $$.util.regex.hsla = "hsl[a]?\\(("+ $$.util.regex.number +")\\s*,\\s*("+ $$.util.regex.number +"[%])\\s*,\\s*("+ $$.util.regex.number +"[%])(?:\\s*,\\s*("+ $$.util.regex.number +"))?\\)";
  $$.util.regex.hslaNoBackRefs = "hsl[a]?\\((?:"+ $$.util.regex.number +")\\s*,\\s*(?:"+ $$.util.regex.number +"[%])\\s*,\\s*(?:"+ $$.util.regex.number +"[%])(?:\\s*,\\s*(?:"+ $$.util.regex.number +"))?\\)";
  
  $$.util.regex.hex3 = "\\#[0-9a-fA-F]{3}";
  $$.util.regex.hex6 = "\\#[0-9a-fA-F]{6}";

  var raf = !window ? null : ( window.requestAnimationFrame || window.mozRequestAnimationFrame ||  
        window.webkitRequestAnimationFrame || window.msRequestAnimationFrame );

  raf = raf || function(fn){ if(fn){ setTimeout(fn, 1000/60) } };

  $$.util.requestAnimationFrame = function(fn){
    raf( fn );
  };

})( cytoscape, typeof window === 'undefined' ? null : window  );
