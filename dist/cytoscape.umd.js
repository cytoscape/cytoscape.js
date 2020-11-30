/**
 * Copyright (c) 2016-2020, The Cytoscape Consortium.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the “Software”), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.cytoscape = factory());
}(this, (function () { 'use strict';

  function _typeof(obj) {
    if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
      _typeof = function (obj) {
        return typeof obj;
      };
    } else {
      _typeof = function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
      };
    }

    return _typeof(obj);
  }

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  function _defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    return Constructor;
  }

  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  }

  function _slicedToArray(arr, i) {
    return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest();
  }

  function _arrayWithHoles(arr) {
    if (Array.isArray(arr)) return arr;
  }

  function _iterableToArrayLimit(arr, i) {
    var _arr = [];
    var _n = true;
    var _d = false;
    var _e = undefined;

    try {
      for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"] != null) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }

  function _nonIterableRest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance");
  }

  var window$1 = typeof window === 'undefined' ? null : window; // eslint-disable-line no-undef

  var navigator = window$1 ? window$1.navigator : null;
  var document$1 = window$1 ? window$1.document : null;

  var typeofstr = _typeof('');

  var typeofobj = _typeof({});

  var typeoffn = _typeof(function () {});

  var typeofhtmlele = typeof HTMLElement === "undefined" ? "undefined" : _typeof(HTMLElement);

  var instanceStr = function instanceStr(obj) {
    return obj && obj.instanceString && fn(obj.instanceString) ? obj.instanceString() : null;
  };

  var string = function string(obj) {
    return obj != null && _typeof(obj) == typeofstr;
  };
  var fn = function fn(obj) {
    return obj != null && _typeof(obj) === typeoffn;
  };
  var array = function array(obj) {
    return !elementOrCollection(obj) && (Array.isArray ? Array.isArray(obj) : obj != null && obj instanceof Array);
  };
  var plainObject = function plainObject(obj) {
    return obj != null && _typeof(obj) === typeofobj && !array(obj) && obj.constructor === Object;
  };
  var object = function object(obj) {
    return obj != null && _typeof(obj) === typeofobj;
  };
  var number = function number(obj) {
    return obj != null && _typeof(obj) === _typeof(1) && !isNaN(obj);
  };
  var integer = function integer(obj) {
    return number(obj) && Math.floor(obj) === obj;
  };
  var htmlElement = function htmlElement(obj) {
    if ('undefined' === typeofhtmlele) {
      return undefined;
    } else {
      return null != obj && obj instanceof HTMLElement;
    }
  };
  var elementOrCollection = function elementOrCollection(obj) {
    return element(obj) || collection(obj);
  };
  var element = function element(obj) {
    return instanceStr(obj) === 'collection' && obj._private.single;
  };
  var collection = function collection(obj) {
    return instanceStr(obj) === 'collection' && !obj._private.single;
  };
  var core = function core(obj) {
    return instanceStr(obj) === 'core';
  };
  var stylesheet = function stylesheet(obj) {
    return instanceStr(obj) === 'stylesheet';
  };
  var event = function event(obj) {
    return instanceStr(obj) === 'event';
  };
  var emptyString = function emptyString(obj) {
    if (obj === undefined || obj === null) {
      // null is empty
      return true;
    } else if (obj === '' || obj.match(/^\s+$/)) {
      return true; // empty string is empty
    }

    return false; // otherwise, we don't know what we've got
  };
  var domElement = function domElement(obj) {
    if (typeof HTMLElement === 'undefined') {
      return false; // we're not in a browser so it doesn't matter
    } else {
      return obj instanceof HTMLElement;
    }
  };
  var boundingBox = function boundingBox(obj) {
    return plainObject(obj) && number(obj.x1) && number(obj.x2) && number(obj.y1) && number(obj.y2);
  };
  var promise = function promise(obj) {
    return object(obj) && fn(obj.then);
  };
  var ms = function ms() {
    return navigator && navigator.userAgent.match(/msie|trident|edge/i);
  }; // probably a better way to detect this...

  var memoize = function memoize(fn, keyFn) {
    if (!keyFn) {
      keyFn = function keyFn() {
        if (arguments.length === 1) {
          return arguments[0];
        } else if (arguments.length === 0) {
          return 'undefined';
        }

        var args = [];

        for (var i = 0; i < arguments.length; i++) {
          args.push(arguments[i]);
        }

        return args.join('$');
      };
    }

    var memoizedFn = function memoizedFn() {
      var self = this;
      var args = arguments;
      var ret;
      var k = keyFn.apply(self, args);
      var cache = memoizedFn.cache;

      if (!(ret = cache[k])) {
        ret = cache[k] = fn.apply(self, args);
      }

      return ret;
    };

    memoizedFn.cache = {};
    return memoizedFn;
  };

  var camel2dash = memoize(function (str) {
    return str.replace(/([A-Z])/g, function (v) {
      return '-' + v.toLowerCase();
    });
  });
  var dash2camel = memoize(function (str) {
    return str.replace(/(-\w)/g, function (v) {
      return v[1].toUpperCase();
    });
  });
  var prependCamel = memoize(function (prefix, str) {
    return prefix + str[0].toUpperCase() + str.substring(1);
  }, function (prefix, str) {
    return prefix + '$' + str;
  });
  var capitalize = function capitalize(str) {
    if (emptyString(str)) {
      return str;
    }

    return str.charAt(0).toUpperCase() + str.substring(1);
  };

  var number$1 = '(?:[-+]?(?:(?:\\d+|\\d*\\.\\d+)(?:[Ee][+-]?\\d+)?))';
  var rgba = 'rgb[a]?\\((' + number$1 + '[%]?)\\s*,\\s*(' + number$1 + '[%]?)\\s*,\\s*(' + number$1 + '[%]?)(?:\\s*,\\s*(' + number$1 + '))?\\)';
  var rgbaNoBackRefs = 'rgb[a]?\\((?:' + number$1 + '[%]?)\\s*,\\s*(?:' + number$1 + '[%]?)\\s*,\\s*(?:' + number$1 + '[%]?)(?:\\s*,\\s*(?:' + number$1 + '))?\\)';
  var hsla = 'hsl[a]?\\((' + number$1 + ')\\s*,\\s*(' + number$1 + '[%])\\s*,\\s*(' + number$1 + '[%])(?:\\s*,\\s*(' + number$1 + '))?\\)';
  var hslaNoBackRefs = 'hsl[a]?\\((?:' + number$1 + ')\\s*,\\s*(?:' + number$1 + '[%])\\s*,\\s*(?:' + number$1 + '[%])(?:\\s*,\\s*(?:' + number$1 + '))?\\)';
  var hex3 = '\\#[0-9a-fA-F]{3}';
  var hex6 = '\\#[0-9a-fA-F]{6}';

  var ascending = function ascending(a, b) {
    if (a < b) {
      return -1;
    } else if (a > b) {
      return 1;
    } else {
      return 0;
    }
  };
  var descending = function descending(a, b) {
    return -1 * ascending(a, b);
  };

  var extend = Object.assign != null ? Object.assign.bind(Object) : function (tgt) {
    var args = arguments;

    for (var i = 1; i < args.length; i++) {
      var obj = args[i];

      if (obj == null) {
        continue;
      }

      var keys = Object.keys(obj);

      for (var j = 0; j < keys.length; j++) {
        var k = keys[j];
        tgt[k] = obj[k];
      }
    }

    return tgt;
  };

  var hex2tuple = function hex2tuple(hex) {
    if (!(hex.length === 4 || hex.length === 7) || hex[0] !== '#') {
      return;
    }

    var shortHex = hex.length === 4;
    var r, g, b;
    var base = 16;

    if (shortHex) {
      r = parseInt(hex[1] + hex[1], base);
      g = parseInt(hex[2] + hex[2], base);
      b = parseInt(hex[3] + hex[3], base);
    } else {
      r = parseInt(hex[1] + hex[2], base);
      g = parseInt(hex[3] + hex[4], base);
      b = parseInt(hex[5] + hex[6], base);
    }

    return [r, g, b];
  }; // get [r, g, b, a] from hsl(0, 0, 0) or hsla(0, 0, 0, 0)

  var hsl2tuple = function hsl2tuple(hsl) {
    var ret;
    var h, s, l, a, r, g, b;

    function hue2rgb(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }

    var m = new RegExp('^' + hsla + '$').exec(hsl);

    if (m) {
      // get hue
      h = parseInt(m[1]);

      if (h < 0) {
        h = (360 - -1 * h % 360) % 360;
      } else if (h > 360) {
        h = h % 360;
      }

      h /= 360; // normalise on [0, 1]

      s = parseFloat(m[2]);

      if (s < 0 || s > 100) {
        return;
      } // saturation is [0, 100]


      s = s / 100; // normalise on [0, 1]

      l = parseFloat(m[3]);

      if (l < 0 || l > 100) {
        return;
      } // lightness is [0, 100]


      l = l / 100; // normalise on [0, 1]

      a = m[4];

      if (a !== undefined) {
        a = parseFloat(a);

        if (a < 0 || a > 1) {
          return;
        } // alpha is [0, 1]

      } // now, convert to rgb
      // code from http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript


      if (s === 0) {
        r = g = b = Math.round(l * 255); // achromatic
      } else {
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = Math.round(255 * hue2rgb(p, q, h + 1 / 3));
        g = Math.round(255 * hue2rgb(p, q, h));
        b = Math.round(255 * hue2rgb(p, q, h - 1 / 3));
      }

      ret = [r, g, b, a];
    }

    return ret;
  }; // get [r, g, b, a] from rgb(0, 0, 0) or rgba(0, 0, 0, 0)

  var rgb2tuple = function rgb2tuple(rgb) {
    var ret;
    var m = new RegExp('^' + rgba + '$').exec(rgb);

    if (m) {
      ret = [];
      var isPct = [];

      for (var i = 1; i <= 3; i++) {
        var channel = m[i];

        if (channel[channel.length - 1] === '%') {
          isPct[i] = true;
        }

        channel = parseFloat(channel);

        if (isPct[i]) {
          channel = channel / 100 * 255; // normalise to [0, 255]
        }

        if (channel < 0 || channel > 255) {
          return;
        } // invalid channel value


        ret.push(Math.floor(channel));
      }

      var atLeastOneIsPct = isPct[1] || isPct[2] || isPct[3];
      var allArePct = isPct[1] && isPct[2] && isPct[3];

      if (atLeastOneIsPct && !allArePct) {
        return;
      } // must all be percent values if one is


      var alpha = m[4];

      if (alpha !== undefined) {
        alpha = parseFloat(alpha);

        if (alpha < 0 || alpha > 1) {
          return;
        } // invalid alpha value


        ret.push(alpha);
      }
    }

    return ret;
  };
  var colorname2tuple = function colorname2tuple(color) {
    return colors[color.toLowerCase()];
  };
  var color2tuple = function color2tuple(color) {
    return (array(color) ? color : null) || colorname2tuple(color) || hex2tuple(color) || rgb2tuple(color) || hsl2tuple(color);
  };
  var colors = {
    // special colour names
    transparent: [0, 0, 0, 0],
    // NB alpha === 0
    // regular colours
    aliceblue: [240, 248, 255],
    antiquewhite: [250, 235, 215],
    aqua: [0, 255, 255],
    aquamarine: [127, 255, 212],
    azure: [240, 255, 255],
    beige: [245, 245, 220],
    bisque: [255, 228, 196],
    black: [0, 0, 0],
    blanchedalmond: [255, 235, 205],
    blue: [0, 0, 255],
    blueviolet: [138, 43, 226],
    brown: [165, 42, 42],
    burlywood: [222, 184, 135],
    cadetblue: [95, 158, 160],
    chartreuse: [127, 255, 0],
    chocolate: [210, 105, 30],
    coral: [255, 127, 80],
    cornflowerblue: [100, 149, 237],
    cornsilk: [255, 248, 220],
    crimson: [220, 20, 60],
    cyan: [0, 255, 255],
    darkblue: [0, 0, 139],
    darkcyan: [0, 139, 139],
    darkgoldenrod: [184, 134, 11],
    darkgray: [169, 169, 169],
    darkgreen: [0, 100, 0],
    darkgrey: [169, 169, 169],
    darkkhaki: [189, 183, 107],
    darkmagenta: [139, 0, 139],
    darkolivegreen: [85, 107, 47],
    darkorange: [255, 140, 0],
    darkorchid: [153, 50, 204],
    darkred: [139, 0, 0],
    darksalmon: [233, 150, 122],
    darkseagreen: [143, 188, 143],
    darkslateblue: [72, 61, 139],
    darkslategray: [47, 79, 79],
    darkslategrey: [47, 79, 79],
    darkturquoise: [0, 206, 209],
    darkviolet: [148, 0, 211],
    deeppink: [255, 20, 147],
    deepskyblue: [0, 191, 255],
    dimgray: [105, 105, 105],
    dimgrey: [105, 105, 105],
    dodgerblue: [30, 144, 255],
    firebrick: [178, 34, 34],
    floralwhite: [255, 250, 240],
    forestgreen: [34, 139, 34],
    fuchsia: [255, 0, 255],
    gainsboro: [220, 220, 220],
    ghostwhite: [248, 248, 255],
    gold: [255, 215, 0],
    goldenrod: [218, 165, 32],
    gray: [128, 128, 128],
    grey: [128, 128, 128],
    green: [0, 128, 0],
    greenyellow: [173, 255, 47],
    honeydew: [240, 255, 240],
    hotpink: [255, 105, 180],
    indianred: [205, 92, 92],
    indigo: [75, 0, 130],
    ivory: [255, 255, 240],
    khaki: [240, 230, 140],
    lavender: [230, 230, 250],
    lavenderblush: [255, 240, 245],
    lawngreen: [124, 252, 0],
    lemonchiffon: [255, 250, 205],
    lightblue: [173, 216, 230],
    lightcoral: [240, 128, 128],
    lightcyan: [224, 255, 255],
    lightgoldenrodyellow: [250, 250, 210],
    lightgray: [211, 211, 211],
    lightgreen: [144, 238, 144],
    lightgrey: [211, 211, 211],
    lightpink: [255, 182, 193],
    lightsalmon: [255, 160, 122],
    lightseagreen: [32, 178, 170],
    lightskyblue: [135, 206, 250],
    lightslategray: [119, 136, 153],
    lightslategrey: [119, 136, 153],
    lightsteelblue: [176, 196, 222],
    lightyellow: [255, 255, 224],
    lime: [0, 255, 0],
    limegreen: [50, 205, 50],
    linen: [250, 240, 230],
    magenta: [255, 0, 255],
    maroon: [128, 0, 0],
    mediumaquamarine: [102, 205, 170],
    mediumblue: [0, 0, 205],
    mediumorchid: [186, 85, 211],
    mediumpurple: [147, 112, 219],
    mediumseagreen: [60, 179, 113],
    mediumslateblue: [123, 104, 238],
    mediumspringgreen: [0, 250, 154],
    mediumturquoise: [72, 209, 204],
    mediumvioletred: [199, 21, 133],
    midnightblue: [25, 25, 112],
    mintcream: [245, 255, 250],
    mistyrose: [255, 228, 225],
    moccasin: [255, 228, 181],
    navajowhite: [255, 222, 173],
    navy: [0, 0, 128],
    oldlace: [253, 245, 230],
    olive: [128, 128, 0],
    olivedrab: [107, 142, 35],
    orange: [255, 165, 0],
    orangered: [255, 69, 0],
    orchid: [218, 112, 214],
    palegoldenrod: [238, 232, 170],
    palegreen: [152, 251, 152],
    paleturquoise: [175, 238, 238],
    palevioletred: [219, 112, 147],
    papayawhip: [255, 239, 213],
    peachpuff: [255, 218, 185],
    peru: [205, 133, 63],
    pink: [255, 192, 203],
    plum: [221, 160, 221],
    powderblue: [176, 224, 230],
    purple: [128, 0, 128],
    red: [255, 0, 0],
    rosybrown: [188, 143, 143],
    royalblue: [65, 105, 225],
    saddlebrown: [139, 69, 19],
    salmon: [250, 128, 114],
    sandybrown: [244, 164, 96],
    seagreen: [46, 139, 87],
    seashell: [255, 245, 238],
    sienna: [160, 82, 45],
    silver: [192, 192, 192],
    skyblue: [135, 206, 235],
    slateblue: [106, 90, 205],
    slategray: [112, 128, 144],
    slategrey: [112, 128, 144],
    snow: [255, 250, 250],
    springgreen: [0, 255, 127],
    steelblue: [70, 130, 180],
    tan: [210, 180, 140],
    teal: [0, 128, 128],
    thistle: [216, 191, 216],
    tomato: [255, 99, 71],
    turquoise: [64, 224, 208],
    violet: [238, 130, 238],
    wheat: [245, 222, 179],
    white: [255, 255, 255],
    whitesmoke: [245, 245, 245],
    yellow: [255, 255, 0],
    yellowgreen: [154, 205, 50]
  };

  var setMap = function setMap(options) {
    var obj = options.map;
    var keys = options.keys;
    var l = keys.length;

    for (var i = 0; i < l; i++) {
      var key = keys[i];

      if (plainObject(key)) {
        throw Error('Tried to set map with object key');
      }

      if (i < keys.length - 1) {
        // extend the map if necessary
        if (obj[key] == null) {
          obj[key] = {};
        }

        obj = obj[key];
      } else {
        // set the value
        obj[key] = options.value;
      }
    }
  }; // gets the value in a map even if it's not built in places

  var getMap = function getMap(options) {
    var obj = options.map;
    var keys = options.keys;
    var l = keys.length;

    for (var i = 0; i < l; i++) {
      var key = keys[i];

      if (plainObject(key)) {
        throw Error('Tried to get map with object key');
      }

      obj = obj[key];

      if (obj == null) {
        return obj;
      }
    }

    return obj;
  }; // deletes the entry in the map

  var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  function createCommonjsModule(fn, module) {
  	return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  /**
   * lodash (Custom Build) <https://lodash.com/>
   * Build: `lodash modularize exports="npm" -o ./`
   * Copyright jQuery Foundation and other contributors <https://jquery.org/>
   * Released under MIT license <https://lodash.com/license>
   * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
   * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   */

  /** Used as the `TypeError` message for "Functions" methods. */
  var FUNC_ERROR_TEXT = 'Expected a function';

  /** Used as references for various `Number` constants. */
  var NAN = 0 / 0;

  /** `Object#toString` result references. */
  var symbolTag = '[object Symbol]';

  /** Used to match leading and trailing whitespace. */
  var reTrim = /^\s+|\s+$/g;

  /** Used to detect bad signed hexadecimal string values. */
  var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

  /** Used to detect binary string values. */
  var reIsBinary = /^0b[01]+$/i;

  /** Used to detect octal string values. */
  var reIsOctal = /^0o[0-7]+$/i;

  /** Built-in method references without a dependency on `root`. */
  var freeParseInt = parseInt;

  /** Detect free variable `global` from Node.js. */
  var freeGlobal = typeof commonjsGlobal == 'object' && commonjsGlobal && commonjsGlobal.Object === Object && commonjsGlobal;

  /** Detect free variable `self`. */
  var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

  /** Used as a reference to the global object. */
  var root = freeGlobal || freeSelf || Function('return this')();

  /** Used for built-in method references. */
  var objectProto = Object.prototype;

  /**
   * Used to resolve the
   * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
   * of values.
   */
  var objectToString = objectProto.toString;

  /* Built-in method references for those with the same name as other `lodash` methods. */
  var nativeMax = Math.max,
      nativeMin = Math.min;

  /**
   * Gets the timestamp of the number of milliseconds that have elapsed since
   * the Unix epoch (1 January 1970 00:00:00 UTC).
   *
   * @static
   * @memberOf _
   * @since 2.4.0
   * @category Date
   * @returns {number} Returns the timestamp.
   * @example
   *
   * _.defer(function(stamp) {
   *   console.log(_.now() - stamp);
   * }, _.now());
   * // => Logs the number of milliseconds it took for the deferred invocation.
   */
  var now = function() {
    return root.Date.now();
  };

  /**
   * Creates a debounced function that delays invoking `func` until after `wait`
   * milliseconds have elapsed since the last time the debounced function was
   * invoked. The debounced function comes with a `cancel` method to cancel
   * delayed `func` invocations and a `flush` method to immediately invoke them.
   * Provide `options` to indicate whether `func` should be invoked on the
   * leading and/or trailing edge of the `wait` timeout. The `func` is invoked
   * with the last arguments provided to the debounced function. Subsequent
   * calls to the debounced function return the result of the last `func`
   * invocation.
   *
   * **Note:** If `leading` and `trailing` options are `true`, `func` is
   * invoked on the trailing edge of the timeout only if the debounced function
   * is invoked more than once during the `wait` timeout.
   *
   * If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
   * until to the next tick, similar to `setTimeout` with a timeout of `0`.
   *
   * See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
   * for details over the differences between `_.debounce` and `_.throttle`.
   *
   * @static
   * @memberOf _
   * @since 0.1.0
   * @category Function
   * @param {Function} func The function to debounce.
   * @param {number} [wait=0] The number of milliseconds to delay.
   * @param {Object} [options={}] The options object.
   * @param {boolean} [options.leading=false]
   *  Specify invoking on the leading edge of the timeout.
   * @param {number} [options.maxWait]
   *  The maximum time `func` is allowed to be delayed before it's invoked.
   * @param {boolean} [options.trailing=true]
   *  Specify invoking on the trailing edge of the timeout.
   * @returns {Function} Returns the new debounced function.
   * @example
   *
   * // Avoid costly calculations while the window size is in flux.
   * jQuery(window).on('resize', _.debounce(calculateLayout, 150));
   *
   * // Invoke `sendMail` when clicked, debouncing subsequent calls.
   * jQuery(element).on('click', _.debounce(sendMail, 300, {
   *   'leading': true,
   *   'trailing': false
   * }));
   *
   * // Ensure `batchLog` is invoked once after 1 second of debounced calls.
   * var debounced = _.debounce(batchLog, 250, { 'maxWait': 1000 });
   * var source = new EventSource('/stream');
   * jQuery(source).on('message', debounced);
   *
   * // Cancel the trailing debounced invocation.
   * jQuery(window).on('popstate', debounced.cancel);
   */
  function debounce(func, wait, options) {
    var lastArgs,
        lastThis,
        maxWait,
        result,
        timerId,
        lastCallTime,
        lastInvokeTime = 0,
        leading = false,
        maxing = false,
        trailing = true;

    if (typeof func != 'function') {
      throw new TypeError(FUNC_ERROR_TEXT);
    }
    wait = toNumber(wait) || 0;
    if (isObject(options)) {
      leading = !!options.leading;
      maxing = 'maxWait' in options;
      maxWait = maxing ? nativeMax(toNumber(options.maxWait) || 0, wait) : maxWait;
      trailing = 'trailing' in options ? !!options.trailing : trailing;
    }

    function invokeFunc(time) {
      var args = lastArgs,
          thisArg = lastThis;

      lastArgs = lastThis = undefined;
      lastInvokeTime = time;
      result = func.apply(thisArg, args);
      return result;
    }

    function leadingEdge(time) {
      // Reset any `maxWait` timer.
      lastInvokeTime = time;
      // Start the timer for the trailing edge.
      timerId = setTimeout(timerExpired, wait);
      // Invoke the leading edge.
      return leading ? invokeFunc(time) : result;
    }

    function remainingWait(time) {
      var timeSinceLastCall = time - lastCallTime,
          timeSinceLastInvoke = time - lastInvokeTime,
          result = wait - timeSinceLastCall;

      return maxing ? nativeMin(result, maxWait - timeSinceLastInvoke) : result;
    }

    function shouldInvoke(time) {
      var timeSinceLastCall = time - lastCallTime,
          timeSinceLastInvoke = time - lastInvokeTime;

      // Either this is the first call, activity has stopped and we're at the
      // trailing edge, the system time has gone backwards and we're treating
      // it as the trailing edge, or we've hit the `maxWait` limit.
      return (lastCallTime === undefined || (timeSinceLastCall >= wait) ||
        (timeSinceLastCall < 0) || (maxing && timeSinceLastInvoke >= maxWait));
    }

    function timerExpired() {
      var time = now();
      if (shouldInvoke(time)) {
        return trailingEdge(time);
      }
      // Restart the timer.
      timerId = setTimeout(timerExpired, remainingWait(time));
    }

    function trailingEdge(time) {
      timerId = undefined;

      // Only invoke if we have `lastArgs` which means `func` has been
      // debounced at least once.
      if (trailing && lastArgs) {
        return invokeFunc(time);
      }
      lastArgs = lastThis = undefined;
      return result;
    }

    function cancel() {
      if (timerId !== undefined) {
        clearTimeout(timerId);
      }
      lastInvokeTime = 0;
      lastArgs = lastCallTime = lastThis = timerId = undefined;
    }

    function flush() {
      return timerId === undefined ? result : trailingEdge(now());
    }

    function debounced() {
      var time = now(),
          isInvoking = shouldInvoke(time);

      lastArgs = arguments;
      lastThis = this;
      lastCallTime = time;

      if (isInvoking) {
        if (timerId === undefined) {
          return leadingEdge(lastCallTime);
        }
        if (maxing) {
          // Handle invocations in a tight loop.
          timerId = setTimeout(timerExpired, wait);
          return invokeFunc(lastCallTime);
        }
      }
      if (timerId === undefined) {
        timerId = setTimeout(timerExpired, wait);
      }
      return result;
    }
    debounced.cancel = cancel;
    debounced.flush = flush;
    return debounced;
  }

  /**
   * Checks if `value` is the
   * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
   * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
   *
   * @static
   * @memberOf _
   * @since 0.1.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is an object, else `false`.
   * @example
   *
   * _.isObject({});
   * // => true
   *
   * _.isObject([1, 2, 3]);
   * // => true
   *
   * _.isObject(_.noop);
   * // => true
   *
   * _.isObject(null);
   * // => false
   */
  function isObject(value) {
    var type = typeof value;
    return !!value && (type == 'object' || type == 'function');
  }

  /**
   * Checks if `value` is object-like. A value is object-like if it's not `null`
   * and has a `typeof` result of "object".
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
   * @example
   *
   * _.isObjectLike({});
   * // => true
   *
   * _.isObjectLike([1, 2, 3]);
   * // => true
   *
   * _.isObjectLike(_.noop);
   * // => false
   *
   * _.isObjectLike(null);
   * // => false
   */
  function isObjectLike(value) {
    return !!value && typeof value == 'object';
  }

  /**
   * Checks if `value` is classified as a `Symbol` primitive or object.
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
   * @example
   *
   * _.isSymbol(Symbol.iterator);
   * // => true
   *
   * _.isSymbol('abc');
   * // => false
   */
  function isSymbol(value) {
    return typeof value == 'symbol' ||
      (isObjectLike(value) && objectToString.call(value) == symbolTag);
  }

  /**
   * Converts `value` to a number.
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to process.
   * @returns {number} Returns the number.
   * @example
   *
   * _.toNumber(3.2);
   * // => 3.2
   *
   * _.toNumber(Number.MIN_VALUE);
   * // => 5e-324
   *
   * _.toNumber(Infinity);
   * // => Infinity
   *
   * _.toNumber('3.2');
   * // => 3.2
   */
  function toNumber(value) {
    if (typeof value == 'number') {
      return value;
    }
    if (isSymbol(value)) {
      return NAN;
    }
    if (isObject(value)) {
      var other = typeof value.valueOf == 'function' ? value.valueOf() : value;
      value = isObject(other) ? (other + '') : other;
    }
    if (typeof value != 'string') {
      return value === 0 ? value : +value;
    }
    value = value.replace(reTrim, '');
    var isBinary = reIsBinary.test(value);
    return (isBinary || reIsOctal.test(value))
      ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
      : (reIsBadHex.test(value) ? NAN : +value);
  }

  var lodash_debounce = debounce;

  var performance = window$1 ? window$1.performance : null;
  var pnow = performance && performance.now ? function () {
    return performance.now();
  } : function () {
    return Date.now();
  };

  var raf = function () {
    if (window$1) {
      if (window$1.requestAnimationFrame) {
        return function (fn) {
          window$1.requestAnimationFrame(fn);
        };
      } else if (window$1.mozRequestAnimationFrame) {
        return function (fn) {
          window$1.mozRequestAnimationFrame(fn);
        };
      } else if (window$1.webkitRequestAnimationFrame) {
        return function (fn) {
          window$1.webkitRequestAnimationFrame(fn);
        };
      } else if (window$1.msRequestAnimationFrame) {
        return function (fn) {
          window$1.msRequestAnimationFrame(fn);
        };
      }
    }

    return function (fn) {
      if (fn) {
        setTimeout(function () {
          fn(pnow());
        }, 1000 / 60);
      }
    };
  }();

  var requestAnimationFrame = function requestAnimationFrame(fn) {
    return raf(fn);
  };
  var performanceNow = pnow;

  var DEFAULT_HASH_SEED = 9261;
  var K = 65599; // 37 also works pretty well

  var DEFAULT_HASH_SEED_ALT = 5381;
  var hashIterableInts = function hashIterableInts(iterator) {
    var seed = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : DEFAULT_HASH_SEED;
    // sdbm/string-hash
    var hash = seed;
    var entry;

    for (;;) {
      entry = iterator.next();

      if (entry.done) {
        break;
      }

      hash = hash * K + entry.value | 0;
    }

    return hash;
  };
  var hashInt = function hashInt(num) {
    var seed = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : DEFAULT_HASH_SEED;
    // sdbm/string-hash
    return seed * K + num | 0;
  };
  var hashIntAlt = function hashIntAlt(num) {
    var seed = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : DEFAULT_HASH_SEED_ALT;
    // djb2/string-hash
    return (seed << 5) + seed + num | 0;
  };
  var combineHashes = function combineHashes(hash1, hash2) {
    return hash1 * 0x200000 + hash2;
  };
  var combineHashesArray = function combineHashesArray(hashes) {
    return hashes[0] * 0x200000 + hashes[1];
  };
  var hashArrays = function hashArrays(hashes1, hashes2) {
    return [hashInt(hashes1[0], hashes2[0]), hashIntAlt(hashes1[1], hashes2[1])];
  };
  var hashIntsArray = function hashIntsArray(ints, seed) {
    var entry = {
      value: 0,
      done: false
    };
    var i = 0;
    var length = ints.length;
    var iterator = {
      next: function next() {
        if (i < length) {
          entry.value = ints[i++];
        } else {
          entry.done = true;
        }

        return entry;
      }
    };
    return hashIterableInts(iterator, seed);
  };
  var hashString = function hashString(str, seed) {
    var entry = {
      value: 0,
      done: false
    };
    var i = 0;
    var length = str.length;
    var iterator = {
      next: function next() {
        if (i < length) {
          entry.value = str.charCodeAt(i++);
        } else {
          entry.done = true;
        }

        return entry;
      }
    };
    return hashIterableInts(iterator, seed);
  };
  var hashStrings = function hashStrings() {
    return hashStringsArray(arguments);
  };
  var hashStringsArray = function hashStringsArray(strs) {
    var hash;

    for (var i = 0; i < strs.length; i++) {
      var str = strs[i];

      if (i === 0) {
        hash = hashString(str);
      } else {
        hash = hashString(str, hash);
      }
    }

    return hash;
  };

  /*global console */
  var warningsEnabled = true;
  var warnSupported = console.warn != null; // eslint-disable-line no-console

  var traceSupported = console.trace != null; // eslint-disable-line no-console

  var MAX_INT = Number.MAX_SAFE_INTEGER || 9007199254740991;
  var trueify = function trueify() {
    return true;
  };
  var falsify = function falsify() {
    return false;
  };
  var zeroify = function zeroify() {
    return 0;
  };
  var noop = function noop() {};
  var error = function error(msg) {
    throw new Error(msg);
  };
  var warnings = function warnings(enabled) {
    if (enabled !== undefined) {
      warningsEnabled = !!enabled;
    } else {
      return warningsEnabled;
    }
  };
  var warn = function warn(msg) {
    /* eslint-disable no-console */
    if (!warnings()) {
      return;
    }

    if (warnSupported) {
      console.warn(msg);
    } else {
      console.log(msg);

      if (traceSupported) {
        console.trace();
      }
    }
  };
  /* eslint-enable */

  var clone = function clone(obj) {
    return extend({}, obj);
  }; // gets a shallow copy of the argument

  var copy = function copy(obj) {
    if (obj == null) {
      return obj;
    }

    if (array(obj)) {
      return obj.slice();
    } else if (plainObject(obj)) {
      return clone(obj);
    } else {
      return obj;
    }
  };
  var copyArray = function copyArray(arr) {
    return arr.slice();
  };
  var uuid = function uuid(a, b
  /* placeholders */
  ) {
    for ( // loop :)
    b = a = ''; // b - result , a - numeric letiable
    a++ < 36; //
    b += a * 51 & 52 // if "a" is not 9 or 14 or 19 or 24
    ? //  return a random number or 4
    (a ^ 15 // if "a" is not 15
    ? // genetate a random number from 0 to 15
    8 ^ Math.random() * (a ^ 20 ? 16 : 4) // unless "a" is 20, in which case a random number from 8 to 11
    : 4 //  otherwise 4
    ).toString(16) : '-' //  in other cases (if "a" is 9,14,19,24) insert "-"
    ) {
    }

    return b;
  };
  var _staticEmptyObject = {};
  var staticEmptyObject = function staticEmptyObject() {
    return _staticEmptyObject;
  };
  var defaults = function defaults(_defaults) {
    var keys = Object.keys(_defaults);
    return function (opts) {
      var filledOpts = {};

      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var optVal = opts == null ? undefined : opts[key];
        filledOpts[key] = optVal === undefined ? _defaults[key] : optVal;
      }

      return filledOpts;
    };
  };
  var removeFromArray = function removeFromArray(arr, ele, manyCopies) {
    for (var i = arr.length; i >= 0; i--) {
      if (arr[i] === ele) {
        arr.splice(i, 1);

        if (!manyCopies) {
          break;
        }
      }
    }
  };
  var clearArray = function clearArray(arr) {
    arr.splice(0, arr.length);
  };
  var push = function push(arr, otherArr) {
    for (var i = 0; i < otherArr.length; i++) {
      var el = otherArr[i];
      arr.push(el);
    }
  };
  var getPrefixedProperty = function getPrefixedProperty(obj, propName, prefix) {
    if (prefix) {
      propName = prependCamel(prefix, propName); // e.g. (labelWidth, source) => sourceLabelWidth
    }

    return obj[propName];
  };
  var setPrefixedProperty = function setPrefixedProperty(obj, propName, prefix, value) {
    if (prefix) {
      propName = prependCamel(prefix, propName); // e.g. (labelWidth, source) => sourceLabelWidth
    }

    obj[propName] = value;
  };

  /* global Map */
  var ObjectMap =
  /*#__PURE__*/
  function () {
    function ObjectMap() {
      _classCallCheck(this, ObjectMap);

      this._obj = {};
    }

    _createClass(ObjectMap, [{
      key: "set",
      value: function set(key, val) {
        this._obj[key] = val;
        return this;
      }
    }, {
      key: "delete",
      value: function _delete(key) {
        this._obj[key] = undefined;
        return this;
      }
    }, {
      key: "clear",
      value: function clear() {
        this._obj = {};
      }
    }, {
      key: "has",
      value: function has(key) {
        return this._obj[key] !== undefined;
      }
    }, {
      key: "get",
      value: function get(key) {
        return this._obj[key];
      }
    }]);

    return ObjectMap;
  }();

  var Map$1 = typeof Map !== 'undefined' ? Map : ObjectMap;

  /* global Set */
  var undef =  "undefined" ;

  var ObjectSet =
  /*#__PURE__*/
  function () {
    function ObjectSet(arrayOrObjectSet) {
      _classCallCheck(this, ObjectSet);

      this._obj = Object.create(null);
      this.size = 0;

      if (arrayOrObjectSet != null) {
        var arr;

        if (arrayOrObjectSet.instanceString != null && arrayOrObjectSet.instanceString() === this.instanceString()) {
          arr = arrayOrObjectSet.toArray();
        } else {
          arr = arrayOrObjectSet;
        }

        for (var i = 0; i < arr.length; i++) {
          this.add(arr[i]);
        }
      }
    }

    _createClass(ObjectSet, [{
      key: "instanceString",
      value: function instanceString() {
        return 'set';
      }
    }, {
      key: "add",
      value: function add(val) {
        var o = this._obj;

        if (o[val] !== 1) {
          o[val] = 1;
          this.size++;
        }
      }
    }, {
      key: "delete",
      value: function _delete(val) {
        var o = this._obj;

        if (o[val] === 1) {
          o[val] = 0;
          this.size--;
        }
      }
    }, {
      key: "clear",
      value: function clear() {
        this._obj = Object.create(null);
      }
    }, {
      key: "has",
      value: function has(val) {
        return this._obj[val] === 1;
      }
    }, {
      key: "toArray",
      value: function toArray() {
        var _this = this;

        return Object.keys(this._obj).filter(function (key) {
          return _this.has(key);
        });
      }
    }, {
      key: "forEach",
      value: function forEach(callback, thisArg) {
        return this.toArray().forEach(callback, thisArg);
      }
    }]);

    return ObjectSet;
  }();

  var Set$1 = (typeof Set === "undefined" ? "undefined" : _typeof(Set)) !== undef ? Set : ObjectSet;

  var Element = function Element(cy, params) {
    var restore = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;

    if (cy === undefined || params === undefined || !core(cy)) {
      error('An element must have a core reference and parameters set');
      return;
    }

    var group = params.group; // try to automatically infer the group if unspecified

    if (group == null) {
      if (params.data && params.data.source != null && params.data.target != null) {
        group = 'edges';
      } else {
        group = 'nodes';
      }
    } // validate group


    if (group !== 'nodes' && group !== 'edges') {
      error('An element must be of type `nodes` or `edges`; you specified `' + group + '`');
      return;
    } // make the element array-like, just like a collection


    this.length = 1;
    this[0] = this; // NOTE: when something is added here, add also to ele.json()

    var _p = this._private = {
      cy: cy,
      single: true,
      // indicates this is an element
      data: params.data || {},
      // data object
      position: params.position || {
        x: 0,
        y: 0
      },
      // (x, y) position pair
      autoWidth: undefined,
      // width and height of nodes calculated by the renderer when set to special 'auto' value
      autoHeight: undefined,
      autoPadding: undefined,
      compoundBoundsClean: false,
      // whether the compound dimensions need to be recalculated the next time dimensions are read
      listeners: [],
      // array of bound listeners
      group: group,
      // string; 'nodes' or 'edges'
      style: {},
      // properties as set by the style
      rstyle: {},
      // properties for style sent from the renderer to the core
      styleCxts: [],
      // applied style contexts from the styler
      styleKeys: {},
      // per-group keys of style property values
      removed: true,
      // whether it's inside the vis; true if removed (set true here since we call restore)
      selected: params.selected ? true : false,
      // whether it's selected
      selectable: params.selectable === undefined ? true : params.selectable ? true : false,
      // whether it's selectable
      locked: params.locked ? true : false,
      // whether the element is locked (cannot be moved)
      grabbed: false,
      // whether the element is grabbed by the mouse; renderer sets this privately
      grabbable: params.grabbable === undefined ? true : params.grabbable ? true : false,
      // whether the element can be grabbed
      pannable: params.pannable === undefined ? group === 'edges' ? true : false : params.pannable ? true : false,
      // whether the element has passthrough panning enabled
      active: false,
      // whether the element is active from user interaction
      classes: new Set$1(),
      // map ( className => true )
      animation: {
        // object for currently-running animations
        current: [],
        queue: []
      },
      rscratch: {},
      // object in which the renderer can store information
      scratch: params.scratch || {},
      // scratch objects
      edges: [],
      // array of connected edges
      children: [],
      // array of children
      parent: null,
      // parent ref
      traversalCache: {},
      // cache of output of traversal functions
      backgrounding: false,
      // whether background images are loading
      bbCache: null,
      // cache of the current bounding box
      bbCacheShift: {
        x: 0,
        y: 0
      },
      // shift applied to cached bb to be applied on next get
      bodyBounds: null,
      // bounds cache of element body, w/o overlay
      overlayBounds: null,
      // bounds cache of element body, including overlay
      labelBounds: {
        // bounds cache of labels
        all: null,
        source: null,
        target: null,
        main: null
      },
      arrowBounds: {
        // bounds cache of edge arrows
        source: null,
        target: null,
        'mid-source': null,
        'mid-target': null
      }
    };

    if (_p.position.x == null) {
      _p.position.x = 0;
    }

    if (_p.position.y == null) {
      _p.position.y = 0;
    } // renderedPosition overrides if specified


    if (params.renderedPosition) {
      var rpos = params.renderedPosition;
      var pan = cy.pan();
      var zoom = cy.zoom();
      _p.position = {
        x: (rpos.x - pan.x) / zoom,
        y: (rpos.y - pan.y) / zoom
      };
    }

    var classes = [];

    if (array(params.classes)) {
      classes = params.classes;
    } else if (string(params.classes)) {
      classes = params.classes.split(/\s+/);
    }

    for (var i = 0, l = classes.length; i < l; i++) {
      var cls = classes[i];

      if (!cls || cls === '') {
        continue;
      }

      _p.classes.add(cls);
    }

    this.createEmitter();
    var bypass = params.style || params.css;

    if (bypass) {
      warn('Setting a `style` bypass at element creation is deprecated');
      this.style(bypass);
    }

    if (restore === undefined || restore) {
      this.restore();
    }
  };

  var defineSearch = function defineSearch(params) {
    params = {
      bfs: params.bfs || !params.dfs,
      dfs: params.dfs || !params.bfs
    }; // from pseudocode on wikipedia

    return function searchFn(roots, fn$1, directed) {
      var options;

      if (plainObject(roots) && !elementOrCollection(roots)) {
        options = roots;
        roots = options.roots || options.root;
        fn$1 = options.visit;
        directed = options.directed;
      }

      directed = arguments.length === 2 && !fn(fn$1) ? fn$1 : directed;
      fn$1 = fn(fn$1) ? fn$1 : function () {};
      var cy = this._private.cy;
      var v = roots = string(roots) ? this.filter(roots) : roots;
      var Q = [];
      var connectedNodes = [];
      var connectedBy = {};
      var id2depth = {};
      var V = {};
      var j = 0;
      var found;

      var _this$byGroup = this.byGroup(),
          nodes = _this$byGroup.nodes,
          edges = _this$byGroup.edges; // enqueue v


      for (var i = 0; i < v.length; i++) {
        var vi = v[i];
        var viId = vi.id();

        if (vi.isNode()) {
          Q.unshift(vi);

          if (params.bfs) {
            V[viId] = true;
            connectedNodes.push(vi);
          }

          id2depth[viId] = 0;
        }
      }

      var _loop2 = function _loop2() {
        var v = params.bfs ? Q.shift() : Q.pop();
        var vId = v.id();

        if (params.dfs) {
          if (V[vId]) {
            return "continue";
          }

          V[vId] = true;
          connectedNodes.push(v);
        }

        var depth = id2depth[vId];
        var prevEdge = connectedBy[vId];
        var src = prevEdge != null ? prevEdge.source() : null;
        var tgt = prevEdge != null ? prevEdge.target() : null;
        var prevNode = prevEdge == null ? undefined : v.same(src) ? tgt[0] : src[0];
        var ret = void 0;
        ret = fn$1(v, prevEdge, prevNode, j++, depth);

        if (ret === true) {
          found = v;
          return "break";
        }

        if (ret === false) {
          return "break";
        }

        var vwEdges = v.connectedEdges().filter(function (e) {
          return (!directed || e.source().same(v)) && edges.has(e);
        });

        for (var _i2 = 0; _i2 < vwEdges.length; _i2++) {
          var e = vwEdges[_i2];
          var w = e.connectedNodes().filter(function (n) {
            return !n.same(v) && nodes.has(n);
          });
          var wId = w.id();

          if (w.length !== 0 && !V[wId]) {
            w = w[0];
            Q.push(w);

            if (params.bfs) {
              V[wId] = true;
              connectedNodes.push(w);
            }

            connectedBy[wId] = e;
            id2depth[wId] = id2depth[vId] + 1;
          }
        }
      };

      _loop: while (Q.length !== 0) {
        var _ret = _loop2();

        switch (_ret) {
          case "continue":
            continue;

          case "break":
            break _loop;
        }
      }

      var connectedEles = cy.collection();

      for (var _i = 0; _i < connectedNodes.length; _i++) {
        var node = connectedNodes[_i];
        var edge = connectedBy[node.id()];

        if (edge != null) {
          connectedEles.push(edge);
        }

        connectedEles.push(node);
      }

      return {
        path: cy.collection(connectedEles),
        found: cy.collection(found)
      };
    };
  }; // search, spanning trees, etc


  var elesfn = {
    breadthFirstSearch: defineSearch({
      bfs: true
    }),
    depthFirstSearch: defineSearch({
      dfs: true
    })
  }; // nice, short mathemathical alias

  elesfn.bfs = elesfn.breadthFirstSearch;
  elesfn.dfs = elesfn.depthFirstSearch;

  var heap = createCommonjsModule(function (module, exports) {
  // Generated by CoffeeScript 1.8.0
  (function() {
    var Heap, defaultCmp, floor, heapify, heappop, heappush, heappushpop, heapreplace, insort, min, nlargest, nsmallest, updateItem, _siftdown, _siftup;

    floor = Math.floor, min = Math.min;


    /*
    Default comparison function to be used
     */

    defaultCmp = function(x, y) {
      if (x < y) {
        return -1;
      }
      if (x > y) {
        return 1;
      }
      return 0;
    };


    /*
    Insert item x in list a, and keep it sorted assuming a is sorted.
    
    If x is already in a, insert it to the right of the rightmost x.
    
    Optional args lo (default 0) and hi (default a.length) bound the slice
    of a to be searched.
     */

    insort = function(a, x, lo, hi, cmp) {
      var mid;
      if (lo == null) {
        lo = 0;
      }
      if (cmp == null) {
        cmp = defaultCmp;
      }
      if (lo < 0) {
        throw new Error('lo must be non-negative');
      }
      if (hi == null) {
        hi = a.length;
      }
      while (lo < hi) {
        mid = floor((lo + hi) / 2);
        if (cmp(x, a[mid]) < 0) {
          hi = mid;
        } else {
          lo = mid + 1;
        }
      }
      return ([].splice.apply(a, [lo, lo - lo].concat(x)), x);
    };


    /*
    Push item onto heap, maintaining the heap invariant.
     */

    heappush = function(array, item, cmp) {
      if (cmp == null) {
        cmp = defaultCmp;
      }
      array.push(item);
      return _siftdown(array, 0, array.length - 1, cmp);
    };


    /*
    Pop the smallest item off the heap, maintaining the heap invariant.
     */

    heappop = function(array, cmp) {
      var lastelt, returnitem;
      if (cmp == null) {
        cmp = defaultCmp;
      }
      lastelt = array.pop();
      if (array.length) {
        returnitem = array[0];
        array[0] = lastelt;
        _siftup(array, 0, cmp);
      } else {
        returnitem = lastelt;
      }
      return returnitem;
    };


    /*
    Pop and return the current smallest value, and add the new item.
    
    This is more efficient than heappop() followed by heappush(), and can be
    more appropriate when using a fixed size heap. Note that the value
    returned may be larger than item! That constrains reasonable use of
    this routine unless written as part of a conditional replacement:
        if item > array[0]
          item = heapreplace(array, item)
     */

    heapreplace = function(array, item, cmp) {
      var returnitem;
      if (cmp == null) {
        cmp = defaultCmp;
      }
      returnitem = array[0];
      array[0] = item;
      _siftup(array, 0, cmp);
      return returnitem;
    };


    /*
    Fast version of a heappush followed by a heappop.
     */

    heappushpop = function(array, item, cmp) {
      var _ref;
      if (cmp == null) {
        cmp = defaultCmp;
      }
      if (array.length && cmp(array[0], item) < 0) {
        _ref = [array[0], item], item = _ref[0], array[0] = _ref[1];
        _siftup(array, 0, cmp);
      }
      return item;
    };


    /*
    Transform list into a heap, in-place, in O(array.length) time.
     */

    heapify = function(array, cmp) {
      var i, _i, _len, _ref1, _results, _results1;
      if (cmp == null) {
        cmp = defaultCmp;
      }
      _ref1 = (function() {
        _results1 = [];
        for (var _j = 0, _ref = floor(array.length / 2); 0 <= _ref ? _j < _ref : _j > _ref; 0 <= _ref ? _j++ : _j--){ _results1.push(_j); }
        return _results1;
      }).apply(this).reverse();
      _results = [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        i = _ref1[_i];
        _results.push(_siftup(array, i, cmp));
      }
      return _results;
    };


    /*
    Update the position of the given item in the heap.
    This function should be called every time the item is being modified.
     */

    updateItem = function(array, item, cmp) {
      var pos;
      if (cmp == null) {
        cmp = defaultCmp;
      }
      pos = array.indexOf(item);
      if (pos === -1) {
        return;
      }
      _siftdown(array, 0, pos, cmp);
      return _siftup(array, pos, cmp);
    };


    /*
    Find the n largest elements in a dataset.
     */

    nlargest = function(array, n, cmp) {
      var elem, result, _i, _len, _ref;
      if (cmp == null) {
        cmp = defaultCmp;
      }
      result = array.slice(0, n);
      if (!result.length) {
        return result;
      }
      heapify(result, cmp);
      _ref = array.slice(n);
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        elem = _ref[_i];
        heappushpop(result, elem, cmp);
      }
      return result.sort(cmp).reverse();
    };


    /*
    Find the n smallest elements in a dataset.
     */

    nsmallest = function(array, n, cmp) {
      var elem, i, los, result, _i, _j, _len, _ref, _ref1, _results;
      if (cmp == null) {
        cmp = defaultCmp;
      }
      if (n * 10 <= array.length) {
        result = array.slice(0, n).sort(cmp);
        if (!result.length) {
          return result;
        }
        los = result[result.length - 1];
        _ref = array.slice(n);
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          elem = _ref[_i];
          if (cmp(elem, los) < 0) {
            insort(result, elem, 0, null, cmp);
            result.pop();
            los = result[result.length - 1];
          }
        }
        return result;
      }
      heapify(array, cmp);
      _results = [];
      for (i = _j = 0, _ref1 = min(n, array.length); 0 <= _ref1 ? _j < _ref1 : _j > _ref1; i = 0 <= _ref1 ? ++_j : --_j) {
        _results.push(heappop(array, cmp));
      }
      return _results;
    };

    _siftdown = function(array, startpos, pos, cmp) {
      var newitem, parent, parentpos;
      if (cmp == null) {
        cmp = defaultCmp;
      }
      newitem = array[pos];
      while (pos > startpos) {
        parentpos = (pos - 1) >> 1;
        parent = array[parentpos];
        if (cmp(newitem, parent) < 0) {
          array[pos] = parent;
          pos = parentpos;
          continue;
        }
        break;
      }
      return array[pos] = newitem;
    };

    _siftup = function(array, pos, cmp) {
      var childpos, endpos, newitem, rightpos, startpos;
      if (cmp == null) {
        cmp = defaultCmp;
      }
      endpos = array.length;
      startpos = pos;
      newitem = array[pos];
      childpos = 2 * pos + 1;
      while (childpos < endpos) {
        rightpos = childpos + 1;
        if (rightpos < endpos && !(cmp(array[childpos], array[rightpos]) < 0)) {
          childpos = rightpos;
        }
        array[pos] = array[childpos];
        pos = childpos;
        childpos = 2 * pos + 1;
      }
      array[pos] = newitem;
      return _siftdown(array, startpos, pos, cmp);
    };

    Heap = (function() {
      Heap.push = heappush;

      Heap.pop = heappop;

      Heap.replace = heapreplace;

      Heap.pushpop = heappushpop;

      Heap.heapify = heapify;

      Heap.updateItem = updateItem;

      Heap.nlargest = nlargest;

      Heap.nsmallest = nsmallest;

      function Heap(cmp) {
        this.cmp = cmp != null ? cmp : defaultCmp;
        this.nodes = [];
      }

      Heap.prototype.push = function(x) {
        return heappush(this.nodes, x, this.cmp);
      };

      Heap.prototype.pop = function() {
        return heappop(this.nodes, this.cmp);
      };

      Heap.prototype.peek = function() {
        return this.nodes[0];
      };

      Heap.prototype.contains = function(x) {
        return this.nodes.indexOf(x) !== -1;
      };

      Heap.prototype.replace = function(x) {
        return heapreplace(this.nodes, x, this.cmp);
      };

      Heap.prototype.pushpop = function(x) {
        return heappushpop(this.nodes, x, this.cmp);
      };

      Heap.prototype.heapify = function() {
        return heapify(this.nodes, this.cmp);
      };

      Heap.prototype.updateItem = function(x) {
        return updateItem(this.nodes, x, this.cmp);
      };

      Heap.prototype.clear = function() {
        return this.nodes = [];
      };

      Heap.prototype.empty = function() {
        return this.nodes.length === 0;
      };

      Heap.prototype.size = function() {
        return this.nodes.length;
      };

      Heap.prototype.clone = function() {
        var heap;
        heap = new Heap();
        heap.nodes = this.nodes.slice(0);
        return heap;
      };

      Heap.prototype.toArray = function() {
        return this.nodes.slice(0);
      };

      Heap.prototype.insert = Heap.prototype.push;

      Heap.prototype.top = Heap.prototype.peek;

      Heap.prototype.front = Heap.prototype.peek;

      Heap.prototype.has = Heap.prototype.contains;

      Heap.prototype.copy = Heap.prototype.clone;

      return Heap;

    })();

    (function(root, factory) {
      {
        return module.exports = factory();
      }
    })(this, function() {
      return Heap;
    });

  }).call(commonjsGlobal);
  });

  var heap$1 = heap;

  var dijkstraDefaults = defaults({
    root: null,
    weight: function weight(edge) {
      return 1;
    },
    directed: false
  });
  var elesfn$1 = {
    dijkstra: function dijkstra(options) {
      if (!plainObject(options)) {
        var args = arguments;
        options = {
          root: args[0],
          weight: args[1],
          directed: args[2]
        };
      }

      var _dijkstraDefaults = dijkstraDefaults(options),
          root = _dijkstraDefaults.root,
          weight = _dijkstraDefaults.weight,
          directed = _dijkstraDefaults.directed;

      var eles = this;
      var weightFn = weight;
      var source = string(root) ? this.filter(root)[0] : root[0];
      var dist = {};
      var prev = {};
      var knownDist = {};

      var _this$byGroup = this.byGroup(),
          nodes = _this$byGroup.nodes,
          edges = _this$byGroup.edges;

      edges.unmergeBy(function (ele) {
        return ele.isLoop();
      });

      var getDist = function getDist(node) {
        return dist[node.id()];
      };

      var setDist = function setDist(node, d) {
        dist[node.id()] = d;
        Q.updateItem(node);
      };

      var Q = new heap$1(function (a, b) {
        return getDist(a) - getDist(b);
      });

      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        dist[node.id()] = node.same(source) ? 0 : Infinity;
        Q.push(node);
      }

      var distBetween = function distBetween(u, v) {
        var uvs = (directed ? u.edgesTo(v) : u.edgesWith(v)).intersect(edges);
        var smallestDistance = Infinity;
        var smallestEdge;

        for (var _i = 0; _i < uvs.length; _i++) {
          var edge = uvs[_i];

          var _weight = weightFn(edge);

          if (_weight < smallestDistance || !smallestEdge) {
            smallestDistance = _weight;
            smallestEdge = edge;
          }
        }

        return {
          edge: smallestEdge,
          dist: smallestDistance
        };
      };

      while (Q.size() > 0) {
        var u = Q.pop();
        var smalletsDist = getDist(u);
        var uid = u.id();
        knownDist[uid] = smalletsDist;

        if (smalletsDist === Infinity) {
          continue;
        }

        var neighbors = u.neighborhood().intersect(nodes);

        for (var _i2 = 0; _i2 < neighbors.length; _i2++) {
          var v = neighbors[_i2];
          var vid = v.id();
          var vDist = distBetween(u, v);
          var alt = smalletsDist + vDist.dist;

          if (alt < getDist(v)) {
            setDist(v, alt);
            prev[vid] = {
              node: u,
              edge: vDist.edge
            };
          }
        } // for

      } // while


      return {
        distanceTo: function distanceTo(node) {
          var target = string(node) ? nodes.filter(node)[0] : node[0];
          return knownDist[target.id()];
        },
        pathTo: function pathTo(node) {
          var target = string(node) ? nodes.filter(node)[0] : node[0];
          var S = [];
          var u = target;
          var uid = u.id();

          if (target.length > 0) {
            S.unshift(target);

            while (prev[uid]) {
              var p = prev[uid];
              S.unshift(p.edge);
              S.unshift(p.node);
              u = p.node;
              uid = u.id();
            }
          }

          return eles.spawn(S);
        }
      };
    }
  };

  var elesfn$2 = {
    // kruskal's algorithm (finds min spanning tree, assuming undirected graph)
    // implemented from pseudocode from wikipedia
    kruskal: function kruskal(weightFn) {
      weightFn = weightFn || function (edge) {
        return 1;
      };

      var _this$byGroup = this.byGroup(),
          nodes = _this$byGroup.nodes,
          edges = _this$byGroup.edges;

      var numNodes = nodes.length;
      var forest = new Array(numNodes);
      var A = nodes; // assumes byGroup() creates new collections that can be safely mutated

      var findSetIndex = function findSetIndex(ele) {
        for (var i = 0; i < forest.length; i++) {
          var eles = forest[i];

          if (eles.has(ele)) {
            return i;
          }
        }
      }; // start with one forest per node


      for (var i = 0; i < numNodes; i++) {
        forest[i] = this.spawn(nodes[i]);
      }

      var S = edges.sort(function (a, b) {
        return weightFn(a) - weightFn(b);
      });

      for (var _i = 0; _i < S.length; _i++) {
        var edge = S[_i];
        var u = edge.source()[0];
        var v = edge.target()[0];
        var setUIndex = findSetIndex(u);
        var setVIndex = findSetIndex(v);
        var setU = forest[setUIndex];
        var setV = forest[setVIndex];

        if (setUIndex !== setVIndex) {
          A.merge(edge); // combine forests for u and v

          setU.merge(setV);
          forest.splice(setVIndex, 1);
        }
      }

      return A;
    }
  };

  var aStarDefaults = defaults({
    root: null,
    goal: null,
    weight: function weight(edge) {
      return 1;
    },
    heuristic: function heuristic(edge) {
      return 0;
    },
    directed: false
  });
  var elesfn$3 = {
    // Implemented from pseudocode from wikipedia
    aStar: function aStar(options) {
      var cy = this.cy();

      var _aStarDefaults = aStarDefaults(options),
          root = _aStarDefaults.root,
          goal = _aStarDefaults.goal,
          heuristic = _aStarDefaults.heuristic,
          directed = _aStarDefaults.directed,
          weight = _aStarDefaults.weight;

      root = cy.collection(root)[0];
      goal = cy.collection(goal)[0];
      var sid = root.id();
      var tid = goal.id();
      var gScore = {};
      var fScore = {};
      var closedSetIds = {};
      var openSet = new heap$1(function (a, b) {
        return fScore[a.id()] - fScore[b.id()];
      });
      var openSetIds = new Set$1();
      var cameFrom = {};
      var cameFromEdge = {};

      var addToOpenSet = function addToOpenSet(ele, id) {
        openSet.push(ele);
        openSetIds.add(id);
      };

      var cMin, cMinId;

      var popFromOpenSet = function popFromOpenSet() {
        cMin = openSet.pop();
        cMinId = cMin.id();
        openSetIds["delete"](cMinId);
      };

      var isInOpenSet = function isInOpenSet(id) {
        return openSetIds.has(id);
      };

      addToOpenSet(root, sid);
      gScore[sid] = 0;
      fScore[sid] = heuristic(root); // Counter

      var steps = 0; // Main loop

      while (openSet.size() > 0) {
        popFromOpenSet();
        steps++; // If we've found our goal, then we are done

        if (cMinId === tid) {
          var path = [];
          var pathNode = goal;
          var pathNodeId = tid;
          var pathEdge = cameFromEdge[pathNodeId];

          for (;;) {
            path.unshift(pathNode);

            if (pathEdge != null) {
              path.unshift(pathEdge);
            }

            pathNode = cameFrom[pathNodeId];

            if (pathNode == null) {
              break;
            }

            pathNodeId = pathNode.id();
            pathEdge = cameFromEdge[pathNodeId];
          }

          return {
            found: true,
            distance: gScore[cMinId],
            path: this.spawn(path),
            steps: steps
          };
        } // Add cMin to processed nodes


        closedSetIds[cMinId] = true; // Update scores for neighbors of cMin
        // Take into account if graph is directed or not

        var vwEdges = cMin._private.edges;

        for (var i = 0; i < vwEdges.length; i++) {
          var e = vwEdges[i]; // edge must be in set of calling eles

          if (!this.hasElementWithId(e.id())) {
            continue;
          } // cMin must be the source of edge if directed


          if (directed && e.data('source') !== cMinId) {
            continue;
          }

          var wSrc = e.source();
          var wTgt = e.target();
          var w = wSrc.id() !== cMinId ? wSrc : wTgt;
          var wid = w.id(); // node must be in set of calling eles

          if (!this.hasElementWithId(wid)) {
            continue;
          } // if node is in closedSet, ignore it


          if (closedSetIds[wid]) {
            continue;
          } // New tentative score for node w


          var tempScore = gScore[cMinId] + weight(e); // Update gScore for node w if:
          //   w not present in openSet
          // OR
          //   tentative gScore is less than previous value
          // w not in openSet

          if (!isInOpenSet(wid)) {
            gScore[wid] = tempScore;
            fScore[wid] = tempScore + heuristic(w);
            addToOpenSet(w, wid);
            cameFrom[wid] = cMin;
            cameFromEdge[wid] = e;
            continue;
          } // w already in openSet, but with greater gScore


          if (tempScore < gScore[wid]) {
            gScore[wid] = tempScore;
            fScore[wid] = tempScore + heuristic(w);
            cameFrom[wid] = cMin;
          }
        } // End of neighbors update

      } // End of main loop
      // If we've reached here, then we've not reached our goal


      return {
        found: false,
        distance: undefined,
        path: undefined,
        steps: steps
      };
    }
  }; // elesfn

  var floydWarshallDefaults = defaults({
    weight: function weight(edge) {
      return 1;
    },
    directed: false
  });
  var elesfn$4 = {
    // Implemented from pseudocode from wikipedia
    floydWarshall: function floydWarshall(options) {
      var cy = this.cy();

      var _floydWarshallDefault = floydWarshallDefaults(options),
          weight = _floydWarshallDefault.weight,
          directed = _floydWarshallDefault.directed;

      var weightFn = weight;

      var _this$byGroup = this.byGroup(),
          nodes = _this$byGroup.nodes,
          edges = _this$byGroup.edges;

      var N = nodes.length;
      var Nsq = N * N;

      var indexOf = function indexOf(node) {
        return nodes.indexOf(node);
      };

      var atIndex = function atIndex(i) {
        return nodes[i];
      }; // Initialize distance matrix


      var dist = new Array(Nsq);

      for (var n = 0; n < Nsq; n++) {
        var j = n % N;
        var i = (n - j) / N;

        if (i === j) {
          dist[n] = 0;
        } else {
          dist[n] = Infinity;
        }
      } // Initialize matrix used for path reconstruction
      // Initialize distance matrix


      var next = new Array(Nsq);
      var edgeNext = new Array(Nsq); // Process edges

      for (var _i = 0; _i < edges.length; _i++) {
        var edge = edges[_i];
        var src = edge.source()[0];
        var tgt = edge.target()[0];

        if (src === tgt) {
          continue;
        } // exclude loops


        var s = indexOf(src);
        var t = indexOf(tgt);
        var st = s * N + t; // source to target index

        var _weight = weightFn(edge); // Check if already process another edge between same 2 nodes


        if (dist[st] > _weight) {
          dist[st] = _weight;
          next[st] = t;
          edgeNext[st] = edge;
        } // If undirected graph, process 'reversed' edge


        if (!directed) {
          var ts = t * N + s; // target to source index

          if (!directed && dist[ts] > _weight) {
            dist[ts] = _weight;
            next[ts] = s;
            edgeNext[ts] = edge;
          }
        }
      } // Main loop


      for (var k = 0; k < N; k++) {
        for (var _i2 = 0; _i2 < N; _i2++) {
          var ik = _i2 * N + k;

          for (var _j = 0; _j < N; _j++) {
            var ij = _i2 * N + _j;
            var kj = k * N + _j;

            if (dist[ik] + dist[kj] < dist[ij]) {
              dist[ij] = dist[ik] + dist[kj];
              next[ij] = next[ik];
            }
          }
        }
      }

      var getArgEle = function getArgEle(ele) {
        return (string(ele) ? cy.filter(ele) : ele)[0];
      };

      var indexOfArgEle = function indexOfArgEle(ele) {
        return indexOf(getArgEle(ele));
      };

      var res = {
        distance: function distance(from, to) {
          var i = indexOfArgEle(from);
          var j = indexOfArgEle(to);
          return dist[i * N + j];
        },
        path: function path(from, to) {
          var i = indexOfArgEle(from);
          var j = indexOfArgEle(to);
          var fromNode = atIndex(i);

          if (i === j) {
            return fromNode.collection();
          }

          if (next[i * N + j] == null) {
            return cy.collection();
          }

          var path = cy.collection();
          var prev = i;
          var edge;
          path.merge(fromNode);

          while (i !== j) {
            prev = i;
            i = next[i * N + j];
            edge = edgeNext[prev * N + i];
            path.merge(edge);
            path.merge(atIndex(i));
          }

          return path;
        }
      };
      return res;
    } // floydWarshall

  }; // elesfn

  var bellmanFordDefaults = defaults({
    weight: function weight(edge) {
      return 1;
    },
    directed: false,
    root: null
  });
  var elesfn$5 = {
    // Implemented from pseudocode from wikipedia
    bellmanFord: function bellmanFord(options) {
      var _this = this;

      var _bellmanFordDefaults = bellmanFordDefaults(options),
          weight = _bellmanFordDefaults.weight,
          directed = _bellmanFordDefaults.directed,
          root = _bellmanFordDefaults.root;

      var weightFn = weight;
      var eles = this;
      var cy = this.cy();

      var _this$byGroup = this.byGroup(),
          edges = _this$byGroup.edges,
          nodes = _this$byGroup.nodes;

      var numNodes = nodes.length;
      var infoMap = new Map$1();
      var hasNegativeWeightCycle = false;
      var negativeWeightCycles = [];
      root = cy.collection(root)[0]; // in case selector passed

      edges.unmergeBy(function (edge) {
        return edge.isLoop();
      });
      var numEdges = edges.length;

      var getInfo = function getInfo(node) {
        var obj = infoMap.get(node.id());

        if (!obj) {
          obj = {};
          infoMap.set(node.id(), obj);
        }

        return obj;
      };

      var getNodeFromTo = function getNodeFromTo(to) {
        return (string(to) ? cy.$(to) : to)[0];
      };

      var distanceTo = function distanceTo(to) {
        return getInfo(getNodeFromTo(to)).dist;
      };

      var pathTo = function pathTo(to) {
        var thisStart = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : root;
        var end = getNodeFromTo(to);
        var path = [];
        var node = end;

        for (;;) {
          if (node == null) {
            return _this.spawn();
          }

          var _getInfo = getInfo(node),
              edge = _getInfo.edge,
              pred = _getInfo.pred;

          path.unshift(node[0]);

          if (node.same(thisStart) && path.length > 0) {
            break;
          }

          if (edge != null) {
            path.unshift(edge);
          }

          node = pred;
        }

        return eles.spawn(path);
      }; // Initializations { dist, pred, edge }


      for (var i = 0; i < numNodes; i++) {
        var node = nodes[i];
        var info = getInfo(node);

        if (node.same(root)) {
          info.dist = 0;
        } else {
          info.dist = Infinity;
        }

        info.pred = null;
        info.edge = null;
      } // Edges relaxation


      var replacedEdge = false;

      var checkForEdgeReplacement = function checkForEdgeReplacement(node1, node2, edge, info1, info2, weight) {
        var dist = info1.dist + weight;

        if (dist < info2.dist && !edge.same(info1.edge)) {
          info2.dist = dist;
          info2.pred = node1;
          info2.edge = edge;
          replacedEdge = true;
        }
      };

      for (var _i = 1; _i < numNodes; _i++) {
        replacedEdge = false;

        for (var e = 0; e < numEdges; e++) {
          var edge = edges[e];
          var src = edge.source();
          var tgt = edge.target();

          var _weight = weightFn(edge);

          var srcInfo = getInfo(src);
          var tgtInfo = getInfo(tgt);
          checkForEdgeReplacement(src, tgt, edge, srcInfo, tgtInfo, _weight); // If undirected graph, we need to take into account the 'reverse' edge

          if (!directed) {
            checkForEdgeReplacement(tgt, src, edge, tgtInfo, srcInfo, _weight);
          }
        }

        if (!replacedEdge) {
          break;
        }
      }

      if (replacedEdge) {
        // Check for negative weight cycles
        for (var _e = 0; _e < numEdges; _e++) {
          var _edge = edges[_e];

          var _src = _edge.source();

          var _tgt = _edge.target();

          var _weight2 = weightFn(_edge);

          var srcDist = getInfo(_src).dist;
          var tgtDist = getInfo(_tgt).dist;

          if (srcDist + _weight2 < tgtDist || !directed && tgtDist + _weight2 < srcDist) {
            warn('Graph contains a negative weight cycle for Bellman-Ford');
            hasNegativeWeightCycle = true;
            break;
          }
        }
      }

      return {
        distanceTo: distanceTo,
        pathTo: pathTo,
        hasNegativeWeightCycle: hasNegativeWeightCycle,
        negativeWeightCycles: negativeWeightCycles
      };
    } // bellmanFord

  }; // elesfn

  var sqrt2 = Math.sqrt(2); // Function which colapses 2 (meta) nodes into one
  // Updates the remaining edge lists
  // Receives as a paramater the edge which causes the collapse

  var collapse = function collapse(edgeIndex, nodeMap, remainingEdges) {
    if (remainingEdges.length === 0) {
      error("Karger-Stein must be run on a connected (sub)graph");
    }

    var edgeInfo = remainingEdges[edgeIndex];
    var sourceIn = edgeInfo[1];
    var targetIn = edgeInfo[2];
    var partition1 = nodeMap[sourceIn];
    var partition2 = nodeMap[targetIn];
    var newEdges = remainingEdges; // re-use array
    // Delete all edges between partition1 and partition2

    for (var i = newEdges.length - 1; i >= 0; i--) {
      var edge = newEdges[i];
      var src = edge[1];
      var tgt = edge[2];

      if (nodeMap[src] === partition1 && nodeMap[tgt] === partition2 || nodeMap[src] === partition2 && nodeMap[tgt] === partition1) {
        newEdges.splice(i, 1);
      }
    } // All edges pointing to partition2 should now point to partition1


    for (var _i = 0; _i < newEdges.length; _i++) {
      var _edge = newEdges[_i];

      if (_edge[1] === partition2) {
        // Check source
        newEdges[_i] = _edge.slice(); // copy

        newEdges[_i][1] = partition1;
      } else if (_edge[2] === partition2) {
        // Check target
        newEdges[_i] = _edge.slice(); // copy

        newEdges[_i][2] = partition1;
      }
    } // Move all nodes from partition2 to partition1


    for (var _i2 = 0; _i2 < nodeMap.length; _i2++) {
      if (nodeMap[_i2] === partition2) {
        nodeMap[_i2] = partition1;
      }
    }

    return newEdges;
  }; // Contracts a graph until we reach a certain number of meta nodes


  var contractUntil = function contractUntil(metaNodeMap, remainingEdges, size, sizeLimit) {
    while (size > sizeLimit) {
      // Choose an edge randomly
      var edgeIndex = Math.floor(Math.random() * remainingEdges.length); // Collapse graph based on edge

      remainingEdges = collapse(edgeIndex, metaNodeMap, remainingEdges);
      size--;
    }

    return remainingEdges;
  };

  var elesfn$6 = {
    // Computes the minimum cut of an undirected graph
    // Returns the correct answer with high probability
    kargerStein: function kargerStein() {
      var _this = this;

      var _this$byGroup = this.byGroup(),
          nodes = _this$byGroup.nodes,
          edges = _this$byGroup.edges;

      edges.unmergeBy(function (edge) {
        return edge.isLoop();
      });
      var numNodes = nodes.length;
      var numEdges = edges.length;
      var numIter = Math.ceil(Math.pow(Math.log(numNodes) / Math.LN2, 2));
      var stopSize = Math.floor(numNodes / sqrt2);

      if (numNodes < 2) {
        error('At least 2 nodes are required for Karger-Stein algorithm');
        return undefined;
      } // Now store edge destination as indexes
      // Format for each edge (edge index, source node index, target node index)


      var edgeIndexes = [];

      for (var i = 0; i < numEdges; i++) {
        var e = edges[i];
        edgeIndexes.push([i, nodes.indexOf(e.source()), nodes.indexOf(e.target())]);
      } // We will store the best cut found here


      var minCutSize = Infinity;
      var minCutEdgeIndexes = [];
      var minCutNodeMap = new Array(numNodes); // Initial meta node partition

      var metaNodeMap = new Array(numNodes);
      var metaNodeMap2 = new Array(numNodes);

      var copyNodesMap = function copyNodesMap(from, to) {
        for (var _i3 = 0; _i3 < numNodes; _i3++) {
          to[_i3] = from[_i3];
        }
      }; // Main loop


      for (var iter = 0; iter <= numIter; iter++) {
        // Reset meta node partition
        for (var _i4 = 0; _i4 < numNodes; _i4++) {
          metaNodeMap[_i4] = _i4;
        } // Contract until stop point (stopSize nodes)


        var edgesState = contractUntil(metaNodeMap, edgeIndexes.slice(), numNodes, stopSize);
        var edgesState2 = edgesState.slice(); // copy
        // Create a copy of the colapsed nodes state

        copyNodesMap(metaNodeMap, metaNodeMap2); // Run 2 iterations starting in the stop state

        var res1 = contractUntil(metaNodeMap, edgesState, stopSize, 2);
        var res2 = contractUntil(metaNodeMap2, edgesState2, stopSize, 2); // Is any of the 2 results the best cut so far?

        if (res1.length <= res2.length && res1.length < minCutSize) {
          minCutSize = res1.length;
          minCutEdgeIndexes = res1;
          copyNodesMap(metaNodeMap, minCutNodeMap);
        } else if (res2.length <= res1.length && res2.length < minCutSize) {
          minCutSize = res2.length;
          minCutEdgeIndexes = res2;
          copyNodesMap(metaNodeMap2, minCutNodeMap);
        }
      } // end of main loop
      // Construct result


      var cut = this.spawn(minCutEdgeIndexes.map(function (e) {
        return edges[e[0]];
      }));
      var partition1 = this.spawn();
      var partition2 = this.spawn(); // traverse metaNodeMap for best cut

      var witnessNodePartition = minCutNodeMap[0];

      for (var _i5 = 0; _i5 < minCutNodeMap.length; _i5++) {
        var partitionId = minCutNodeMap[_i5];
        var node = nodes[_i5];

        if (partitionId === witnessNodePartition) {
          partition1.merge(node);
        } else {
          partition2.merge(node);
        }
      } // construct components corresponding to each disjoint subset of nodes


      var constructComponent = function constructComponent(subset) {
        var component = _this.spawn();

        subset.forEach(function (node) {
          component.merge(node);
          node.connectedEdges().forEach(function (edge) {
            // ensure edge is within calling collection and edge is not in cut
            if (_this.contains(edge) && !cut.contains(edge)) {
              component.merge(edge);
            }
          });
        });
        return component;
      };

      var components = [constructComponent(partition1), constructComponent(partition2)];
      var ret = {
        cut: cut,
        components: components,
        // n.b. partitions are included to be compatible with the old api spec
        // (could be removed in a future major version)
        partition1: partition1,
        partition2: partition2
      };
      return ret;
    }
  }; // elesfn

  var copyPosition = function copyPosition(p) {
    return {
      x: p.x,
      y: p.y
    };
  };
  var modelToRenderedPosition = function modelToRenderedPosition(p, zoom, pan) {
    return {
      x: p.x * zoom + pan.x,
      y: p.y * zoom + pan.y
    };
  };
  var renderedToModelPosition = function renderedToModelPosition(p, zoom, pan) {
    return {
      x: (p.x - pan.x) / zoom,
      y: (p.y - pan.y) / zoom
    };
  };
  var array2point = function array2point(arr) {
    return {
      x: arr[0],
      y: arr[1]
    };
  };
  var min = function min(arr) {
    var begin = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
    var end = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : arr.length;
    var min = Infinity;

    for (var i = begin; i < end; i++) {
      var val = arr[i];

      if (isFinite(val)) {
        min = Math.min(val, min);
      }
    }

    return min;
  };
  var max = function max(arr) {
    var begin = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
    var end = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : arr.length;
    var max = -Infinity;

    for (var i = begin; i < end; i++) {
      var val = arr[i];

      if (isFinite(val)) {
        max = Math.max(val, max);
      }
    }

    return max;
  };
  var mean = function mean(arr) {
    var begin = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
    var end = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : arr.length;
    var total = 0;
    var n = 0;

    for (var i = begin; i < end; i++) {
      var val = arr[i];

      if (isFinite(val)) {
        total += val;
        n++;
      }
    }

    return total / n;
  };
  var median = function median(arr) {
    var begin = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
    var end = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : arr.length;
    var copy = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;
    var sort = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : true;
    var includeHoles = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : true;

    if (copy) {
      arr = arr.slice(begin, end);
    } else {
      if (end < arr.length) {
        arr.splice(end, arr.length - end);
      }

      if (begin > 0) {
        arr.splice(0, begin);
      }
    } // all non finite (e.g. Infinity, NaN) elements must be -Infinity so they go to the start


    var off = 0; // offset from non-finite values

    for (var i = arr.length - 1; i >= 0; i--) {
      var v = arr[i];

      if (includeHoles) {
        if (!isFinite(v)) {
          arr[i] = -Infinity;
          off++;
        }
      } else {
        // just remove it if we don't want to consider holes
        arr.splice(i, 1);
      }
    }

    if (sort) {
      arr.sort(function (a, b) {
        return a - b;
      }); // requires copy = true if you don't want to change the orig
    }

    var len = arr.length;
    var mid = Math.floor(len / 2);

    if (len % 2 !== 0) {
      return arr[mid + 1 + off];
    } else {
      return (arr[mid - 1 + off] + arr[mid + off]) / 2;
    }
  };
  var deg2rad = function deg2rad(deg) {
    return Math.PI * deg / 180;
  };
  var getAngleFromDisp = function getAngleFromDisp(dispX, dispY) {
    return Math.atan2(dispY, dispX) - Math.PI / 2;
  };
  var log2 = Math.log2 || function (n) {
    return Math.log(n) / Math.log(2);
  };
  var signum = function signum(x) {
    if (x > 0) {
      return 1;
    } else if (x < 0) {
      return -1;
    } else {
      return 0;
    }
  };
  var dist = function dist(p1, p2) {
    return Math.sqrt(sqdist(p1, p2));
  };
  var sqdist = function sqdist(p1, p2) {
    var dx = p2.x - p1.x;
    var dy = p2.y - p1.y;
    return dx * dx + dy * dy;
  };
  var inPlaceSumNormalize = function inPlaceSumNormalize(v) {
    var length = v.length; // First, get sum of all elements

    var total = 0;

    for (var i = 0; i < length; i++) {
      total += v[i];
    } // Now, divide each by the sum of all elements


    for (var _i = 0; _i < length; _i++) {
      v[_i] = v[_i] / total;
    }

    return v;
  };

  var qbezierAt = function qbezierAt(p0, p1, p2, t) {
    return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
  };
  var qbezierPtAt = function qbezierPtAt(p0, p1, p2, t) {
    return {
      x: qbezierAt(p0.x, p1.x, p2.x, t),
      y: qbezierAt(p0.y, p1.y, p2.y, t)
    };
  };
  var lineAt = function lineAt(p0, p1, t, d) {
    var vec = {
      x: p1.x - p0.x,
      y: p1.y - p0.y
    };
    var vecDist = dist(p0, p1);
    var normVec = {
      x: vec.x / vecDist,
      y: vec.y / vecDist
    };
    t = t == null ? 0 : t;
    d = d != null ? d : t * vecDist;
    return {
      x: p0.x + normVec.x * d,
      y: p0.y + normVec.y * d
    };
  };
  var bound = function bound(min, val, max) {
    return Math.max(min, Math.min(max, val));
  }; // makes a full bb (x1, y1, x2, y2, w, h) from implicit params

  var makeBoundingBox = function makeBoundingBox(bb) {
    if (bb == null) {
      return {
        x1: Infinity,
        y1: Infinity,
        x2: -Infinity,
        y2: -Infinity,
        w: 0,
        h: 0
      };
    } else if (bb.x1 != null && bb.y1 != null) {
      if (bb.x2 != null && bb.y2 != null && bb.x2 >= bb.x1 && bb.y2 >= bb.y1) {
        return {
          x1: bb.x1,
          y1: bb.y1,
          x2: bb.x2,
          y2: bb.y2,
          w: bb.x2 - bb.x1,
          h: bb.y2 - bb.y1
        };
      } else if (bb.w != null && bb.h != null && bb.w >= 0 && bb.h >= 0) {
        return {
          x1: bb.x1,
          y1: bb.y1,
          x2: bb.x1 + bb.w,
          y2: bb.y1 + bb.h,
          w: bb.w,
          h: bb.h
        };
      }
    }
  };
  var copyBoundingBox = function copyBoundingBox(bb) {
    return {
      x1: bb.x1,
      x2: bb.x2,
      w: bb.w,
      y1: bb.y1,
      y2: bb.y2,
      h: bb.h
    };
  };
  var clearBoundingBox = function clearBoundingBox(bb) {
    bb.x1 = Infinity;
    bb.y1 = Infinity;
    bb.x2 = -Infinity;
    bb.y2 = -Infinity;
    bb.w = 0;
    bb.h = 0;
  };
  var updateBoundingBox = function updateBoundingBox(bb1, bb2) {
    // update bb1 with bb2 bounds
    bb1.x1 = Math.min(bb1.x1, bb2.x1);
    bb1.x2 = Math.max(bb1.x2, bb2.x2);
    bb1.w = bb1.x2 - bb1.x1;
    bb1.y1 = Math.min(bb1.y1, bb2.y1);
    bb1.y2 = Math.max(bb1.y2, bb2.y2);
    bb1.h = bb1.y2 - bb1.y1;
  };
  var expandBoundingBoxByPoint = function expandBoundingBoxByPoint(bb, x, y) {
    bb.x1 = Math.min(bb.x1, x);
    bb.x2 = Math.max(bb.x2, x);
    bb.w = bb.x2 - bb.x1;
    bb.y1 = Math.min(bb.y1, y);
    bb.y2 = Math.max(bb.y2, y);
    bb.h = bb.y2 - bb.y1;
  };
  var expandBoundingBox = function expandBoundingBox(bb) {
    var padding = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
    bb.x1 -= padding;
    bb.x2 += padding;
    bb.y1 -= padding;
    bb.y2 += padding;
    bb.w = bb.x2 - bb.x1;
    bb.h = bb.y2 - bb.y1;
    return bb;
  };
  var expandBoundingBoxSides = function expandBoundingBoxSides(bb) {
    var padding = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [0];
    var top, right, bottom, left;

    if (padding.length === 1) {
      top = right = bottom = left = padding[0];
    } else if (padding.length === 2) {
      top = bottom = padding[0];
      left = right = padding[1];
    } else if (padding.length === 4) {
      var _padding = _slicedToArray(padding, 4);

      top = _padding[0];
      right = _padding[1];
      bottom = _padding[2];
      left = _padding[3];
    }

    bb.x1 -= left;
    bb.x2 += right;
    bb.y1 -= top;
    bb.y2 += bottom;
    bb.w = bb.x2 - bb.x1;
    bb.h = bb.y2 - bb.y1;
    return bb;
  };

  var assignBoundingBox = function assignBoundingBox(bb1, bb2) {
    bb1.x1 = bb2.x1;
    bb1.y1 = bb2.y1;
    bb1.x2 = bb2.x2;
    bb1.y2 = bb2.y2;
    bb1.w = bb1.x2 - bb1.x1;
    bb1.h = bb1.y2 - bb1.y1;
  };
  var assignShiftToBoundingBox = function assignShiftToBoundingBox(bb, delta) {
    bb.x1 += delta.x;
    bb.x2 += delta.x;
    bb.y1 += delta.y;
    bb.y2 += delta.y;
  };
  var boundingBoxesIntersect = function boundingBoxesIntersect(bb1, bb2) {
    // case: one bb to right of other
    if (bb1.x1 > bb2.x2) {
      return false;
    }

    if (bb2.x1 > bb1.x2) {
      return false;
    } // case: one bb to left of other


    if (bb1.x2 < bb2.x1) {
      return false;
    }

    if (bb2.x2 < bb1.x1) {
      return false;
    } // case: one bb above other


    if (bb1.y2 < bb2.y1) {
      return false;
    }

    if (bb2.y2 < bb1.y1) {
      return false;
    } // case: one bb below other


    if (bb1.y1 > bb2.y2) {
      return false;
    }

    if (bb2.y1 > bb1.y2) {
      return false;
    } // otherwise, must have some overlap


    return true;
  };
  var inBoundingBox = function inBoundingBox(bb, x, y) {
    return bb.x1 <= x && x <= bb.x2 && bb.y1 <= y && y <= bb.y2;
  };
  var pointInBoundingBox = function pointInBoundingBox(bb, pt) {
    return inBoundingBox(bb, pt.x, pt.y);
  };
  var boundingBoxInBoundingBox = function boundingBoxInBoundingBox(bb1, bb2) {
    return inBoundingBox(bb1, bb2.x1, bb2.y1) && inBoundingBox(bb1, bb2.x2, bb2.y2);
  };
  var roundRectangleIntersectLine = function roundRectangleIntersectLine(x, y, nodeX, nodeY, width, height, padding) {
    var cornerRadius = getRoundRectangleRadius(width, height);
    var halfWidth = width / 2;
    var halfHeight = height / 2; // Check intersections with straight line segments

    var straightLineIntersections; // Top segment, left to right

    {
      var topStartX = nodeX - halfWidth + cornerRadius - padding;
      var topStartY = nodeY - halfHeight - padding;
      var topEndX = nodeX + halfWidth - cornerRadius + padding;
      var topEndY = topStartY;
      straightLineIntersections = finiteLinesIntersect(x, y, nodeX, nodeY, topStartX, topStartY, topEndX, topEndY, false);

      if (straightLineIntersections.length > 0) {
        return straightLineIntersections;
      }
    } // Right segment, top to bottom

    {
      var rightStartX = nodeX + halfWidth + padding;
      var rightStartY = nodeY - halfHeight + cornerRadius - padding;
      var rightEndX = rightStartX;
      var rightEndY = nodeY + halfHeight - cornerRadius + padding;
      straightLineIntersections = finiteLinesIntersect(x, y, nodeX, nodeY, rightStartX, rightStartY, rightEndX, rightEndY, false);

      if (straightLineIntersections.length > 0) {
        return straightLineIntersections;
      }
    } // Bottom segment, left to right

    {
      var bottomStartX = nodeX - halfWidth + cornerRadius - padding;
      var bottomStartY = nodeY + halfHeight + padding;
      var bottomEndX = nodeX + halfWidth - cornerRadius + padding;
      var bottomEndY = bottomStartY;
      straightLineIntersections = finiteLinesIntersect(x, y, nodeX, nodeY, bottomStartX, bottomStartY, bottomEndX, bottomEndY, false);

      if (straightLineIntersections.length > 0) {
        return straightLineIntersections;
      }
    } // Left segment, top to bottom

    {
      var leftStartX = nodeX - halfWidth - padding;
      var leftStartY = nodeY - halfHeight + cornerRadius - padding;
      var leftEndX = leftStartX;
      var leftEndY = nodeY + halfHeight - cornerRadius + padding;
      straightLineIntersections = finiteLinesIntersect(x, y, nodeX, nodeY, leftStartX, leftStartY, leftEndX, leftEndY, false);

      if (straightLineIntersections.length > 0) {
        return straightLineIntersections;
      }
    } // Check intersections with arc segments

    var arcIntersections; // Top Left

    {
      var topLeftCenterX = nodeX - halfWidth + cornerRadius;
      var topLeftCenterY = nodeY - halfHeight + cornerRadius;
      arcIntersections = intersectLineCircle(x, y, nodeX, nodeY, topLeftCenterX, topLeftCenterY, cornerRadius + padding); // Ensure the intersection is on the desired quarter of the circle

      if (arcIntersections.length > 0 && arcIntersections[0] <= topLeftCenterX && arcIntersections[1] <= topLeftCenterY) {
        return [arcIntersections[0], arcIntersections[1]];
      }
    } // Top Right

    {
      var topRightCenterX = nodeX + halfWidth - cornerRadius;
      var topRightCenterY = nodeY - halfHeight + cornerRadius;
      arcIntersections = intersectLineCircle(x, y, nodeX, nodeY, topRightCenterX, topRightCenterY, cornerRadius + padding); // Ensure the intersection is on the desired quarter of the circle

      if (arcIntersections.length > 0 && arcIntersections[0] >= topRightCenterX && arcIntersections[1] <= topRightCenterY) {
        return [arcIntersections[0], arcIntersections[1]];
      }
    } // Bottom Right

    {
      var bottomRightCenterX = nodeX + halfWidth - cornerRadius;
      var bottomRightCenterY = nodeY + halfHeight - cornerRadius;
      arcIntersections = intersectLineCircle(x, y, nodeX, nodeY, bottomRightCenterX, bottomRightCenterY, cornerRadius + padding); // Ensure the intersection is on the desired quarter of the circle

      if (arcIntersections.length > 0 && arcIntersections[0] >= bottomRightCenterX && arcIntersections[1] >= bottomRightCenterY) {
        return [arcIntersections[0], arcIntersections[1]];
      }
    } // Bottom Left

    {
      var bottomLeftCenterX = nodeX - halfWidth + cornerRadius;
      var bottomLeftCenterY = nodeY + halfHeight - cornerRadius;
      arcIntersections = intersectLineCircle(x, y, nodeX, nodeY, bottomLeftCenterX, bottomLeftCenterY, cornerRadius + padding); // Ensure the intersection is on the desired quarter of the circle

      if (arcIntersections.length > 0 && arcIntersections[0] <= bottomLeftCenterX && arcIntersections[1] >= bottomLeftCenterY) {
        return [arcIntersections[0], arcIntersections[1]];
      }
    }
    return []; // if nothing
  };
  var inLineVicinity = function inLineVicinity(x, y, lx1, ly1, lx2, ly2, tolerance) {
    var t = tolerance;
    var x1 = Math.min(lx1, lx2);
    var x2 = Math.max(lx1, lx2);
    var y1 = Math.min(ly1, ly2);
    var y2 = Math.max(ly1, ly2);
    return x1 - t <= x && x <= x2 + t && y1 - t <= y && y <= y2 + t;
  };
  var inBezierVicinity = function inBezierVicinity(x, y, x1, y1, x2, y2, x3, y3, tolerance) {
    var bb = {
      x1: Math.min(x1, x3, x2) - tolerance,
      x2: Math.max(x1, x3, x2) + tolerance,
      y1: Math.min(y1, y3, y2) - tolerance,
      y2: Math.max(y1, y3, y2) + tolerance
    }; // if outside the rough bounding box for the bezier, then it can't be a hit

    if (x < bb.x1 || x > bb.x2 || y < bb.y1 || y > bb.y2) {
      // console.log('bezier out of rough bb')
      return false;
    } else {
      // console.log('do more expensive check');
      return true;
    }
  };
  var solveQuadratic = function solveQuadratic(a, b, c, val) {
    c -= val;
    var r = b * b - 4 * a * c;

    if (r < 0) {
      return [];
    }

    var sqrtR = Math.sqrt(r);
    var denom = 2 * a;
    var root1 = (-b + sqrtR) / denom;
    var root2 = (-b - sqrtR) / denom;
    return [root1, root2];
  };
  var solveCubic = function solveCubic(a, b, c, d, result) {
    // Solves a cubic function, returns root in form [r1, i1, r2, i2, r3, i3], where
    // r is the real component, i is the imaginary component
    // An implementation of the Cardano method from the year 1545
    // http://en.wikipedia.org/wiki/Cubic_function#The_nature_of_the_roots
    var epsilon = 0.00001; // avoid division by zero while keeping the overall expression close in value

    if (a === 0) {
      a = epsilon;
    }

    b /= a;
    c /= a;
    d /= a;
    var discriminant, q, r, dum1, s, t, term1, r13;
    q = (3.0 * c - b * b) / 9.0;
    r = -(27.0 * d) + b * (9.0 * c - 2.0 * (b * b));
    r /= 54.0;
    discriminant = q * q * q + r * r;
    result[1] = 0;
    term1 = b / 3.0;

    if (discriminant > 0) {
      s = r + Math.sqrt(discriminant);
      s = s < 0 ? -Math.pow(-s, 1.0 / 3.0) : Math.pow(s, 1.0 / 3.0);
      t = r - Math.sqrt(discriminant);
      t = t < 0 ? -Math.pow(-t, 1.0 / 3.0) : Math.pow(t, 1.0 / 3.0);
      result[0] = -term1 + s + t;
      term1 += (s + t) / 2.0;
      result[4] = result[2] = -term1;
      term1 = Math.sqrt(3.0) * (-t + s) / 2;
      result[3] = term1;
      result[5] = -term1;
      return;
    }

    result[5] = result[3] = 0;

    if (discriminant === 0) {
      r13 = r < 0 ? -Math.pow(-r, 1.0 / 3.0) : Math.pow(r, 1.0 / 3.0);
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
  };
  var sqdistToQuadraticBezier = function sqdistToQuadraticBezier(x, y, x1, y1, x2, y2, x3, y3) {
    // Find minimum distance by using the minimum of the distance
    // function between the given point and the curve
    // This gives the coefficients of the resulting cubic equation
    // whose roots tell us where a possible minimum is
    // (Coefficients are divided by 4)
    var a = 1.0 * x1 * x1 - 4 * x1 * x2 + 2 * x1 * x3 + 4 * x2 * x2 - 4 * x2 * x3 + x3 * x3 + y1 * y1 - 4 * y1 * y2 + 2 * y1 * y3 + 4 * y2 * y2 - 4 * y2 * y3 + y3 * y3;
    var b = 1.0 * 9 * x1 * x2 - 3 * x1 * x1 - 3 * x1 * x3 - 6 * x2 * x2 + 3 * x2 * x3 + 9 * y1 * y2 - 3 * y1 * y1 - 3 * y1 * y3 - 6 * y2 * y2 + 3 * y2 * y3;
    var c = 1.0 * 3 * x1 * x1 - 6 * x1 * x2 + x1 * x3 - x1 * x + 2 * x2 * x2 + 2 * x2 * x - x3 * x + 3 * y1 * y1 - 6 * y1 * y2 + y1 * y3 - y1 * y + 2 * y2 * y2 + 2 * y2 * y - y3 * y;
    var d = 1.0 * x1 * x2 - x1 * x1 + x1 * x - x2 * x + y1 * y2 - y1 * y1 + y1 * y - y2 * y; // debug("coefficients: " + a / a + ", " + b / a + ", " + c / a + ", " + d / a);

    var roots = []; // Use the cubic solving algorithm

    solveCubic(a, b, c, d, roots);
    var zeroThreshold = 0.0000001;
    var params = [];

    for (var index = 0; index < 6; index += 2) {
      if (Math.abs(roots[index + 1]) < zeroThreshold && roots[index] >= 0 && roots[index] <= 1.0) {
        params.push(roots[index]);
      }
    }

    params.push(1.0);
    params.push(0.0);
    var minDistanceSquared = -1;
    var curX, curY, distSquared;

    for (var i = 0; i < params.length; i++) {
      curX = Math.pow(1.0 - params[i], 2.0) * x1 + 2.0 * (1 - params[i]) * params[i] * x2 + params[i] * params[i] * x3;
      curY = Math.pow(1 - params[i], 2.0) * y1 + 2 * (1.0 - params[i]) * params[i] * y2 + params[i] * params[i] * y3;
      distSquared = Math.pow(curX - x, 2) + Math.pow(curY - y, 2); // debug('distance for param ' + params[i] + ": " + Math.sqrt(distSquared));

      if (minDistanceSquared >= 0) {
        if (distSquared < minDistanceSquared) {
          minDistanceSquared = distSquared;
        }
      } else {
        minDistanceSquared = distSquared;
      }
    }

    return minDistanceSquared;
  };
  var sqdistToFiniteLine = function sqdistToFiniteLine(x, y, x1, y1, x2, y2) {
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

    return hypSq - adjSq;
  };
  var pointInsidePolygonPoints = function pointInsidePolygonPoints(x, y, points) {
    var x1, y1, x2, y2;
    var y3; // Intersect with vertical line through (x, y)

    var up = 0; // let down = 0;

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

      if (x1 == x && x2 == x) ; else if (x1 >= x && x >= x2 || x1 <= x && x <= x2) {
        y3 = (x - x1) / (x2 - x1) * (y2 - y1) + y1;

        if (y3 > y) {
          up++;
        } // if( y3 < y ){
        // down++;
        // }

      } else {
        continue;
      }
    }

    if (up % 2 === 0) {
      return false;
    } else {
      return true;
    }
  };
  var pointInsidePolygon = function pointInsidePolygon(x, y, basePoints, centerX, centerY, width, height, direction, padding) {
    var transformedPoints = new Array(basePoints.length); // Gives negative angle

    var angle;

    if (direction[0] != null) {
      angle = Math.atan(direction[1] / direction[0]);

      if (direction[0] < 0) {
        angle = angle + Math.PI / 2;
      } else {
        angle = -angle - Math.PI / 2;
      }
    } else {
      angle = direction;
    }

    var cos = Math.cos(-angle);
    var sin = Math.sin(-angle); //    console.log("base: " + basePoints);

    for (var i = 0; i < transformedPoints.length / 2; i++) {
      transformedPoints[i * 2] = width / 2 * (basePoints[i * 2] * cos - basePoints[i * 2 + 1] * sin);
      transformedPoints[i * 2 + 1] = height / 2 * (basePoints[i * 2 + 1] * cos + basePoints[i * 2] * sin);
      transformedPoints[i * 2] += centerX;
      transformedPoints[i * 2 + 1] += centerY;
    }

    var points;

    if (padding > 0) {
      var expandedLineSet = expandPolygon(transformedPoints, -padding);
      points = joinLines(expandedLineSet);
    } else {
      points = transformedPoints;
    }

    return pointInsidePolygonPoints(x, y, points);
  };
  var pointInsideRoundPolygon = function pointInsideRoundPolygon(x, y, basePoints, centerX, centerY, width, height) {
    var cutPolygonPoints = new Array(basePoints.length);
    var halfW = width / 2;
    var halfH = height / 2;
    var cornerRadius = getRoundPolygonRadius(width, height);
    var squaredCornerRadius = cornerRadius * cornerRadius;

    for (var i = 0; i < basePoints.length / 4; i++) {
      var sourceUv = void 0,
          destUv = void 0;

      if (i === 0) {
        sourceUv = basePoints.length - 2;
      } else {
        sourceUv = i * 4 - 2;
      }

      destUv = i * 4 + 2;
      var px = centerX + halfW * basePoints[i * 4];
      var py = centerY + halfH * basePoints[i * 4 + 1];
      var cosTheta = -basePoints[sourceUv] * basePoints[destUv] - basePoints[sourceUv + 1] * basePoints[destUv + 1];
      var offset = cornerRadius / Math.tan(Math.acos(cosTheta) / 2);
      var cp0x = px - offset * basePoints[sourceUv];
      var cp0y = py - offset * basePoints[sourceUv + 1];
      var cp1x = px + offset * basePoints[destUv];
      var cp1y = py + offset * basePoints[destUv + 1];
      cutPolygonPoints[i * 4] = cp0x;
      cutPolygonPoints[i * 4 + 1] = cp0y;
      cutPolygonPoints[i * 4 + 2] = cp1x;
      cutPolygonPoints[i * 4 + 3] = cp1y;
      var orthx = basePoints[sourceUv + 1];
      var orthy = -basePoints[sourceUv];
      var cosAlpha = orthx * basePoints[destUv] + orthy * basePoints[destUv + 1];

      if (cosAlpha < 0) {
        orthx *= -1;
        orthy *= -1;
      }

      var cx = cp0x + orthx * cornerRadius;
      var cy = cp0y + orthy * cornerRadius;
      var squaredDistance = Math.pow(cx - x, 2) + Math.pow(cy - y, 2);

      if (squaredDistance <= squaredCornerRadius) {
        return true;
      }
    }

    return pointInsidePolygonPoints(x, y, cutPolygonPoints);
  };
  var joinLines = function joinLines(lineSet) {
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

      var intersection = finiteLinesIntersect(currentLineStartX, currentLineStartY, currentLineEndX, currentLineEndY, nextLineStartX, nextLineStartY, nextLineEndX, nextLineEndY, true);
      vertices[i * 2] = intersection[0];
      vertices[i * 2 + 1] = intersection[1];
    }

    return vertices;
  };
  var expandPolygon = function expandPolygon(points, pad) {
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
      } // Current line: [currentPointX, currentPointY] to [nextPointX, nextPointY]
      // Assume CCW polygon winding


      var offsetX = nextPointY - currentPointY;
      var offsetY = -(nextPointX - currentPointX); // Normalize

      var offsetLength = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
      var normalizedOffsetX = offsetX / offsetLength;
      var normalizedOffsetY = offsetY / offsetLength;
      expandedLineSet[i * 4] = currentPointX + normalizedOffsetX * pad;
      expandedLineSet[i * 4 + 1] = currentPointY + normalizedOffsetY * pad;
      expandedLineSet[i * 4 + 2] = nextPointX + normalizedOffsetX * pad;
      expandedLineSet[i * 4 + 3] = nextPointY + normalizedOffsetY * pad;
    }

    return expandedLineSet;
  };
  var intersectLineEllipse = function intersectLineEllipse(x, y, centerX, centerY, ellipseWradius, ellipseHradius) {
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
  };
  var checkInEllipse = function checkInEllipse(x, y, width, height, centerX, centerY, padding) {
    x -= centerX;
    y -= centerY;
    x /= width / 2 + padding;
    y /= height / 2 + padding;
    return x * x + y * y <= 1;
  }; // Returns intersections of increasing distance from line's start point

  var intersectLineCircle = function intersectLineCircle(x1, y1, x2, y2, centerX, centerY, radius) {
    // Calculate d, direction vector of line
    var d = [x2 - x1, y2 - y1]; // Direction vector of line

    var f = [x1 - centerX, y1 - centerY];
    var a = d[0] * d[0] + d[1] * d[1];
    var b = 2 * (f[0] * d[0] + f[1] * d[1]);
    var c = f[0] * f[0] + f[1] * f[1] - radius * radius;
    var discriminant = b * b - 4 * a * c;

    if (discriminant < 0) {
      return [];
    }

    var t1 = (-b + Math.sqrt(discriminant)) / (2 * a);
    var t2 = (-b - Math.sqrt(discriminant)) / (2 * a);
    var tMin = Math.min(t1, t2);
    var tMax = Math.max(t1, t2);
    var inRangeParams = [];

    if (tMin >= 0 && tMin <= 1) {
      inRangeParams.push(tMin);
    }

    if (tMax >= 0 && tMax <= 1) {
      inRangeParams.push(tMax);
    }

    if (inRangeParams.length === 0) {
      return [];
    }

    var nearIntersectionX = inRangeParams[0] * d[0] + x1;
    var nearIntersectionY = inRangeParams[0] * d[1] + y1;

    if (inRangeParams.length > 1) {
      if (inRangeParams[0] == inRangeParams[1]) {
        return [nearIntersectionX, nearIntersectionY];
      } else {
        var farIntersectionX = inRangeParams[1] * d[0] + x1;
        var farIntersectionY = inRangeParams[1] * d[1] + y1;
        return [nearIntersectionX, nearIntersectionY, farIntersectionX, farIntersectionY];
      }
    } else {
      return [nearIntersectionX, nearIntersectionY];
    }
  };
  var midOfThree = function midOfThree(a, b, c) {
    if (b <= a && a <= c || c <= a && a <= b) {
      return a;
    } else if (a <= b && b <= c || c <= b && b <= a) {
      return b;
    } else {
      return c;
    }
  }; // (x1,y1)=>(x2,y2) intersect with (x3,y3)=>(x4,y4)

  var finiteLinesIntersect = function finiteLinesIntersect(x1, y1, x2, y2, x3, y3, x4, y4, infiniteLines) {
    var dx13 = x1 - x3;
    var dx21 = x2 - x1;
    var dx43 = x4 - x3;
    var dy13 = y1 - y3;
    var dy21 = y2 - y1;
    var dy43 = y4 - y3;
    var ua_t = dx43 * dy13 - dy43 * dx13;
    var ub_t = dx21 * dy13 - dy21 * dx13;
    var u_b = dy43 * dx21 - dx43 * dy21;

    if (u_b !== 0) {
      var ua = ua_t / u_b;
      var ub = ub_t / u_b;
      var flptThreshold = 0.001;

      var _min = 0 - flptThreshold;

      var _max = 1 + flptThreshold;

      if (_min <= ua && ua <= _max && _min <= ub && ub <= _max) {
        return [x1 + ua * dx21, y1 + ua * dy21];
      } else {
        if (!infiniteLines) {
          return [];
        } else {
          return [x1 + ua * dx21, y1 + ua * dy21];
        }
      }
    } else {
      if (ua_t === 0 || ub_t === 0) {
        // Parallel, coincident lines. Check if overlap
        // Check endpoint of second line
        if (midOfThree(x1, x2, x4) === x4) {
          return [x4, y4];
        } // Check start point of second line


        if (midOfThree(x1, x2, x3) === x3) {
          return [x3, y3];
        } // Endpoint of first line


        if (midOfThree(x3, x4, x2) === x2) {
          return [x2, y2];
        }

        return [];
      } else {
        // Parallel, non-coincident
        return [];
      }
    }
  }; // math.polygonIntersectLine( x, y, basePoints, centerX, centerY, width, height, padding )
  // intersect a node polygon (pts transformed)
  //
  // math.polygonIntersectLine( x, y, basePoints, centerX, centerY )
  // intersect the points (no transform)

  var polygonIntersectLine = function polygonIntersectLine(x, y, basePoints, centerX, centerY, width, height, padding) {
    var intersections = [];
    var intersection;
    var transformedPoints = new Array(basePoints.length);
    var doTransform = true;

    if (width == null) {
      doTransform = false;
    }

    var points;

    if (doTransform) {
      for (var i = 0; i < transformedPoints.length / 2; i++) {
        transformedPoints[i * 2] = basePoints[i * 2] * width + centerX;
        transformedPoints[i * 2 + 1] = basePoints[i * 2 + 1] * height + centerY;
      }

      if (padding > 0) {
        var expandedLineSet = expandPolygon(transformedPoints, -padding);
        points = joinLines(expandedLineSet);
      } else {
        points = transformedPoints;
      }
    } else {
      points = basePoints;
    }

    var currentX, currentY, nextX, nextY;

    for (var _i2 = 0; _i2 < points.length / 2; _i2++) {
      currentX = points[_i2 * 2];
      currentY = points[_i2 * 2 + 1];

      if (_i2 < points.length / 2 - 1) {
        nextX = points[(_i2 + 1) * 2];
        nextY = points[(_i2 + 1) * 2 + 1];
      } else {
        nextX = points[0];
        nextY = points[1];
      }

      intersection = finiteLinesIntersect(x, y, centerX, centerY, currentX, currentY, nextX, nextY);

      if (intersection.length !== 0) {
        intersections.push(intersection[0], intersection[1]);
      }
    }

    return intersections;
  };
  var roundPolygonIntersectLine = function roundPolygonIntersectLine(x, y, basePoints, centerX, centerY, width, height, padding) {
    var intersections = [];
    var intersection;
    var lines = new Array(basePoints.length);
    var halfW = width / 2;
    var halfH = height / 2;
    var cornerRadius = getRoundPolygonRadius(width, height);

    for (var i = 0; i < basePoints.length / 4; i++) {
      var sourceUv = void 0,
          destUv = void 0;

      if (i === 0) {
        sourceUv = basePoints.length - 2;
      } else {
        sourceUv = i * 4 - 2;
      }

      destUv = i * 4 + 2;
      var px = centerX + halfW * basePoints[i * 4];
      var py = centerY + halfH * basePoints[i * 4 + 1];
      var cosTheta = -basePoints[sourceUv] * basePoints[destUv] - basePoints[sourceUv + 1] * basePoints[destUv + 1];
      var offset = cornerRadius / Math.tan(Math.acos(cosTheta) / 2);
      var cp0x = px - offset * basePoints[sourceUv];
      var cp0y = py - offset * basePoints[sourceUv + 1];
      var cp1x = px + offset * basePoints[destUv];
      var cp1y = py + offset * basePoints[destUv + 1];

      if (i === 0) {
        lines[basePoints.length - 2] = cp0x;
        lines[basePoints.length - 1] = cp0y;
      } else {
        lines[i * 4 - 2] = cp0x;
        lines[i * 4 - 1] = cp0y;
      }

      lines[i * 4] = cp1x;
      lines[i * 4 + 1] = cp1y;
      var orthx = basePoints[sourceUv + 1];
      var orthy = -basePoints[sourceUv];
      var cosAlpha = orthx * basePoints[destUv] + orthy * basePoints[destUv + 1];

      if (cosAlpha < 0) {
        orthx *= -1;
        orthy *= -1;
      }

      var cx = cp0x + orthx * cornerRadius;
      var cy = cp0y + orthy * cornerRadius;
      intersection = intersectLineCircle(x, y, centerX, centerY, cx, cy, cornerRadius);

      if (intersection.length !== 0) {
        intersections.push(intersection[0], intersection[1]);
      }
    }

    for (var _i3 = 0; _i3 < lines.length / 4; _i3++) {
      intersection = finiteLinesIntersect(x, y, centerX, centerY, lines[_i3 * 4], lines[_i3 * 4 + 1], lines[_i3 * 4 + 2], lines[_i3 * 4 + 3], false);

      if (intersection.length !== 0) {
        intersections.push(intersection[0], intersection[1]);
      }
    }

    if (intersections.length > 2) {
      var lowestIntersection = [intersections[0], intersections[1]];
      var lowestSquaredDistance = Math.pow(lowestIntersection[0] - x, 2) + Math.pow(lowestIntersection[1] - y, 2);

      for (var _i4 = 1; _i4 < intersections.length / 2; _i4++) {
        var squaredDistance = Math.pow(intersections[_i4 * 2] - x, 2) + Math.pow(intersections[_i4 * 2 + 1] - y, 2);

        if (squaredDistance <= lowestSquaredDistance) {
          lowestIntersection[0] = intersections[_i4 * 2];
          lowestIntersection[1] = intersections[_i4 * 2 + 1];
          lowestSquaredDistance = squaredDistance;
        }
      }

      return lowestIntersection;
    }

    return intersections;
  };
  var shortenIntersection = function shortenIntersection(intersection, offset, amount) {
    var disp = [intersection[0] - offset[0], intersection[1] - offset[1]];
    var length = Math.sqrt(disp[0] * disp[0] + disp[1] * disp[1]);
    var lenRatio = (length - amount) / length;

    if (lenRatio < 0) {
      lenRatio = 0.00001;
    }

    return [offset[0] + lenRatio * disp[0], offset[1] + lenRatio * disp[1]];
  };
  var generateUnitNgonPointsFitToSquare = function generateUnitNgonPointsFitToSquare(sides, rotationRadians) {
    var points = generateUnitNgonPoints(sides, rotationRadians);
    points = fitPolygonToSquare(points);
    return points;
  };
  var fitPolygonToSquare = function fitPolygonToSquare(points) {
    var x, y;
    var sides = points.length / 2;
    var minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

    for (var i = 0; i < sides; i++) {
      x = points[2 * i];
      y = points[2 * i + 1];
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    } // stretch factors


    var sx = 2 / (maxX - minX);
    var sy = 2 / (maxY - minY);

    for (var _i5 = 0; _i5 < sides; _i5++) {
      x = points[2 * _i5] = points[2 * _i5] * sx;
      y = points[2 * _i5 + 1] = points[2 * _i5 + 1] * sy;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    if (minY < -1) {
      for (var _i6 = 0; _i6 < sides; _i6++) {
        y = points[2 * _i6 + 1] = points[2 * _i6 + 1] + (-1 - minY);
      }
    }

    return points;
  };
  var generateUnitNgonPoints = function generateUnitNgonPoints(sides, rotationRadians) {
    var increment = 1.0 / sides * 2 * Math.PI;
    var startAngle = sides % 2 === 0 ? Math.PI / 2.0 + increment / 2.0 : Math.PI / 2.0;
    startAngle += rotationRadians;
    var points = new Array(sides * 2);
    var currentAngle;

    for (var i = 0; i < sides; i++) {
      currentAngle = i * increment + startAngle;
      points[2 * i] = Math.cos(currentAngle); // x

      points[2 * i + 1] = Math.sin(-currentAngle); // y
    }

    return points;
  }; // Set the default radius, unless half of width or height is smaller than default

  var getRoundRectangleRadius = function getRoundRectangleRadius(width, height) {
    return Math.min(width / 4, height / 4, 8);
  }; // Set the default radius

  var getRoundPolygonRadius = function getRoundPolygonRadius(width, height) {
    return Math.min(width / 10, height / 10, 8);
  };
  var getCutRectangleCornerLength = function getCutRectangleCornerLength() {
    return 8;
  };
  var bezierPtsToQuadCoeff = function bezierPtsToQuadCoeff(p0, p1, p2) {
    return [p0 - 2 * p1 + p2, 2 * (p1 - p0), p0];
  }; // get curve width, height, and control point position offsets as a percentage of node height / width

  var getBarrelCurveConstants = function getBarrelCurveConstants(width, height) {
    return {
      heightOffset: Math.min(15, 0.05 * height),
      widthOffset: Math.min(100, 0.25 * width),
      ctrlPtOffsetPct: 0.05
    };
  };

  var pageRankDefaults = defaults({
    dampingFactor: 0.8,
    precision: 0.000001,
    iterations: 200,
    weight: function weight(edge) {
      return 1;
    }
  });
  var elesfn$7 = {
    pageRank: function pageRank(options) {
      var _pageRankDefaults = pageRankDefaults(options),
          dampingFactor = _pageRankDefaults.dampingFactor,
          precision = _pageRankDefaults.precision,
          iterations = _pageRankDefaults.iterations,
          weight = _pageRankDefaults.weight;

      var cy = this._private.cy;

      var _this$byGroup = this.byGroup(),
          nodes = _this$byGroup.nodes,
          edges = _this$byGroup.edges;

      var numNodes = nodes.length;
      var numNodesSqd = numNodes * numNodes;
      var numEdges = edges.length; // Construct transposed adjacency matrix
      // First lets have a zeroed matrix of the right size
      // We'll also keep track of the sum of each column

      var matrix = new Array(numNodesSqd);
      var columnSum = new Array(numNodes);
      var additionalProb = (1 - dampingFactor) / numNodes; // Create null matrix

      for (var i = 0; i < numNodes; i++) {
        for (var j = 0; j < numNodes; j++) {
          var n = i * numNodes + j;
          matrix[n] = 0;
        }

        columnSum[i] = 0;
      } // Now, process edges


      for (var _i = 0; _i < numEdges; _i++) {
        var edge = edges[_i];
        var srcId = edge.data('source');
        var tgtId = edge.data('target'); // Don't include loops in the matrix

        if (srcId === tgtId) {
          continue;
        }

        var s = nodes.indexOfId(srcId);
        var t = nodes.indexOfId(tgtId);
        var w = weight(edge);

        var _n = t * numNodes + s; // Update matrix


        matrix[_n] += w; // Update column sum

        columnSum[s] += w;
      } // Add additional probability based on damping factor
      // Also, take into account columns that have sum = 0


      var p = 1.0 / numNodes + additionalProb; // Shorthand
      // Traverse matrix, column by column

      for (var _j = 0; _j < numNodes; _j++) {
        if (columnSum[_j] === 0) {
          // No 'links' out from node jth, assume equal probability for each possible node
          for (var _i2 = 0; _i2 < numNodes; _i2++) {
            var _n2 = _i2 * numNodes + _j;

            matrix[_n2] = p;
          }
        } else {
          // Node jth has outgoing link, compute normalized probabilities
          for (var _i3 = 0; _i3 < numNodes; _i3++) {
            var _n3 = _i3 * numNodes + _j;

            matrix[_n3] = matrix[_n3] / columnSum[_j] + additionalProb;
          }
        }
      } // Compute dominant eigenvector using power method


      var eigenvector = new Array(numNodes);
      var temp = new Array(numNodes);
      var previous; // Start with a vector of all 1's
      // Also, initialize a null vector which will be used as shorthand

      for (var _i4 = 0; _i4 < numNodes; _i4++) {
        eigenvector[_i4] = 1;
      }

      for (var iter = 0; iter < iterations; iter++) {
        // Temp array with all 0's
        for (var _i5 = 0; _i5 < numNodes; _i5++) {
          temp[_i5] = 0;
        } // Multiply matrix with previous result


        for (var _i6 = 0; _i6 < numNodes; _i6++) {
          for (var _j2 = 0; _j2 < numNodes; _j2++) {
            var _n4 = _i6 * numNodes + _j2;

            temp[_i6] += matrix[_n4] * eigenvector[_j2];
          }
        }

        inPlaceSumNormalize(temp);
        previous = eigenvector;
        eigenvector = temp;
        temp = previous;
        var diff = 0; // Compute difference (squared module) of both vectors

        for (var _i7 = 0; _i7 < numNodes; _i7++) {
          var delta = previous[_i7] - eigenvector[_i7];
          diff += delta * delta;
        } // If difference is less than the desired threshold, stop iterating


        if (diff < precision) {
          break;
        }
      } // Construct result


      var res = {
        rank: function rank(node) {
          node = cy.collection(node)[0];
          return eigenvector[nodes.indexOf(node)];
        }
      };
      return res;
    } // pageRank

  }; // elesfn

  var defaults$1 = defaults({
    root: null,
    weight: function weight(edge) {
      return 1;
    },
    directed: false,
    alpha: 0
  });
  var elesfn$8 = {
    degreeCentralityNormalized: function degreeCentralityNormalized(options) {
      options = defaults$1(options);
      var cy = this.cy();
      var nodes = this.nodes();
      var numNodes = nodes.length;

      if (!options.directed) {
        var degrees = {};
        var maxDegree = 0;

        for (var i = 0; i < numNodes; i++) {
          var node = nodes[i]; // add current node to the current options object and call degreeCentrality

          options.root = node;
          var currDegree = this.degreeCentrality(options);

          if (maxDegree < currDegree.degree) {
            maxDegree = currDegree.degree;
          }

          degrees[node.id()] = currDegree.degree;
        }

        return {
          degree: function degree(node) {
            if (maxDegree === 0) {
              return 0;
            }

            if (string(node)) {
              // from is a selector string
              node = cy.filter(node);
            }

            return degrees[node.id()] / maxDegree;
          }
        };
      } else {
        var indegrees = {};
        var outdegrees = {};
        var maxIndegree = 0;
        var maxOutdegree = 0;

        for (var _i = 0; _i < numNodes; _i++) {
          var _node = nodes[_i];

          var id = _node.id(); // add current node to the current options object and call degreeCentrality


          options.root = _node;

          var _currDegree = this.degreeCentrality(options);

          if (maxIndegree < _currDegree.indegree) maxIndegree = _currDegree.indegree;
          if (maxOutdegree < _currDegree.outdegree) maxOutdegree = _currDegree.outdegree;
          indegrees[id] = _currDegree.indegree;
          outdegrees[id] = _currDegree.outdegree;
        }

        return {
          indegree: function indegree(node) {
            if (maxIndegree == 0) {
              return 0;
            }

            if (string(node)) {
              // from is a selector string
              node = cy.filter(node);
            }

            return indegrees[node.id()] / maxIndegree;
          },
          outdegree: function outdegree(node) {
            if (maxOutdegree === 0) {
              return 0;
            }

            if (string(node)) {
              // from is a selector string
              node = cy.filter(node);
            }

            return outdegrees[node.id()] / maxOutdegree;
          }
        };
      }
    },
    // degreeCentralityNormalized
    // Implemented from the algorithm in Opsahl's paper
    // "Node centrality in weighted networks: Generalizing degree and shortest paths"
    // check the heading 2 "Degree"
    degreeCentrality: function degreeCentrality(options) {
      options = defaults$1(options);
      var cy = this.cy();
      var callingEles = this;
      var _options = options,
          root = _options.root,
          weight = _options.weight,
          directed = _options.directed,
          alpha = _options.alpha;
      root = cy.collection(root)[0];

      if (!directed) {
        var connEdges = root.connectedEdges().intersection(callingEles);
        var k = connEdges.length;
        var s = 0; // Now, sum edge weights

        for (var i = 0; i < connEdges.length; i++) {
          s += weight(connEdges[i]);
        }

        return {
          degree: Math.pow(k, 1 - alpha) * Math.pow(s, alpha)
        };
      } else {
        var edges = root.connectedEdges();
        var incoming = edges.filter(function (edge) {
          return edge.target().same(root) && callingEles.has(edge);
        });
        var outgoing = edges.filter(function (edge) {
          return edge.source().same(root) && callingEles.has(edge);
        });
        var k_in = incoming.length;
        var k_out = outgoing.length;
        var s_in = 0;
        var s_out = 0; // Now, sum incoming edge weights

        for (var _i2 = 0; _i2 < incoming.length; _i2++) {
          s_in += weight(incoming[_i2]);
        } // Now, sum outgoing edge weights


        for (var _i3 = 0; _i3 < outgoing.length; _i3++) {
          s_out += weight(outgoing[_i3]);
        }

        return {
          indegree: Math.pow(k_in, 1 - alpha) * Math.pow(s_in, alpha),
          outdegree: Math.pow(k_out, 1 - alpha) * Math.pow(s_out, alpha)
        };
      }
    } // degreeCentrality

  }; // elesfn
  // nice, short mathemathical alias

  elesfn$8.dc = elesfn$8.degreeCentrality;
  elesfn$8.dcn = elesfn$8.degreeCentralityNormalised = elesfn$8.degreeCentralityNormalized;

  var defaults$2 = defaults({
    harmonic: true,
    weight: function weight() {
      return 1;
    },
    directed: false,
    root: null
  });
  var elesfn$9 = {
    closenessCentralityNormalized: function closenessCentralityNormalized(options) {
      var _defaults = defaults$2(options),
          harmonic = _defaults.harmonic,
          weight = _defaults.weight,
          directed = _defaults.directed;

      var cy = this.cy();
      var closenesses = {};
      var maxCloseness = 0;
      var nodes = this.nodes();
      var fw = this.floydWarshall({
        weight: weight,
        directed: directed
      }); // Compute closeness for every node and find the maximum closeness

      for (var i = 0; i < nodes.length; i++) {
        var currCloseness = 0;
        var node_i = nodes[i];

        for (var j = 0; j < nodes.length; j++) {
          if (i !== j) {
            var d = fw.distance(node_i, nodes[j]);

            if (harmonic) {
              currCloseness += 1 / d;
            } else {
              currCloseness += d;
            }
          }
        }

        if (!harmonic) {
          currCloseness = 1 / currCloseness;
        }

        if (maxCloseness < currCloseness) {
          maxCloseness = currCloseness;
        }

        closenesses[node_i.id()] = currCloseness;
      }

      return {
        closeness: function closeness(node) {
          if (maxCloseness == 0) {
            return 0;
          }

          if (string(node)) {
            // from is a selector string
            node = cy.filter(node)[0].id();
          } else {
            // from is a node
            node = node.id();
          }

          return closenesses[node] / maxCloseness;
        }
      };
    },
    // Implemented from pseudocode from wikipedia
    closenessCentrality: function closenessCentrality(options) {
      var _defaults2 = defaults$2(options),
          root = _defaults2.root,
          weight = _defaults2.weight,
          directed = _defaults2.directed,
          harmonic = _defaults2.harmonic;

      root = this.filter(root)[0]; // we need distance from this node to every other node

      var dijkstra = this.dijkstra({
        root: root,
        weight: weight,
        directed: directed
      });
      var totalDistance = 0;
      var nodes = this.nodes();

      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];

        if (!n.same(root)) {
          var d = dijkstra.distanceTo(n);

          if (harmonic) {
            totalDistance += 1 / d;
          } else {
            totalDistance += d;
          }
        }
      }

      return harmonic ? totalDistance : 1 / totalDistance;
    } // closenessCentrality

  }; // elesfn
  // nice, short mathemathical alias

  elesfn$9.cc = elesfn$9.closenessCentrality;
  elesfn$9.ccn = elesfn$9.closenessCentralityNormalised = elesfn$9.closenessCentralityNormalized;

  var defaults$3 = defaults({
    weight: null,
    directed: false
  });
  var elesfn$a = {
    // Implemented from the algorithm in the paper "On Variants of Shortest-Path Betweenness Centrality and their Generic Computation" by Ulrik Brandes
    betweennessCentrality: function betweennessCentrality(options) {
      var _defaults = defaults$3(options),
          directed = _defaults.directed,
          weight = _defaults.weight;

      var weighted = weight != null;
      var cy = this.cy(); // starting

      var V = this.nodes();
      var A = {};
      var _C = {};
      var max = 0;
      var C = {
        set: function set(key, val) {
          _C[key] = val;

          if (val > max) {
            max = val;
          }
        },
        get: function get(key) {
          return _C[key];
        }
      }; // A contains the neighborhoods of every node

      for (var i = 0; i < V.length; i++) {
        var v = V[i];
        var vid = v.id();

        if (directed) {
          A[vid] = v.outgoers().nodes(); // get outgoers of every node
        } else {
          A[vid] = v.openNeighborhood().nodes(); // get neighbors of every node
        }

        C.set(vid, 0);
      }

      var _loop = function _loop(s) {
        var sid = V[s].id();
        var S = []; // stack

        var P = {};
        var g = {};
        var d = {};
        var Q = new heap$1(function (a, b) {
          return d[a] - d[b];
        }); // queue
        // init dictionaries

        for (var _i = 0; _i < V.length; _i++) {
          var _vid = V[_i].id();

          P[_vid] = [];
          g[_vid] = 0;
          d[_vid] = Infinity;
        }

        g[sid] = 1; // sigma

        d[sid] = 0; // distance to s

        Q.push(sid);

        while (!Q.empty()) {
          var _v = Q.pop();

          S.push(_v);

          if (weighted) {
            for (var j = 0; j < A[_v].length; j++) {
              var w = A[_v][j];
              var vEle = cy.getElementById(_v);
              var edge = void 0;

              if (vEle.edgesTo(w).length > 0) {
                edge = vEle.edgesTo(w)[0];
              } else {
                edge = w.edgesTo(vEle)[0];
              }

              var edgeWeight = weight(edge);
              w = w.id();

              if (d[w] > d[_v] + edgeWeight) {
                d[w] = d[_v] + edgeWeight;

                if (Q.nodes.indexOf(w) < 0) {
                  //if w is not in Q
                  Q.push(w);
                } else {
                  // update position if w is in Q
                  Q.updateItem(w);
                }

                g[w] = 0;
                P[w] = [];
              }

              if (d[w] == d[_v] + edgeWeight) {
                g[w] = g[w] + g[_v];
                P[w].push(_v);
              }
            }
          } else {
            for (var _j = 0; _j < A[_v].length; _j++) {
              var _w = A[_v][_j].id();

              if (d[_w] == Infinity) {
                Q.push(_w);
                d[_w] = d[_v] + 1;
              }

              if (d[_w] == d[_v] + 1) {
                g[_w] = g[_w] + g[_v];

                P[_w].push(_v);
              }
            }
          }
        }

        var e = {};

        for (var _i2 = 0; _i2 < V.length; _i2++) {
          e[V[_i2].id()] = 0;
        }

        while (S.length > 0) {
          var _w2 = S.pop();

          for (var _j2 = 0; _j2 < P[_w2].length; _j2++) {
            var _v2 = P[_w2][_j2];
            e[_v2] = e[_v2] + g[_v2] / g[_w2] * (1 + e[_w2]);
          }

          if (_w2 != V[s].id()) {
            C.set(_w2, C.get(_w2) + e[_w2]);
          }
        }
      };

      for (var s = 0; s < V.length; s++) {
        _loop(s);
      }

      var ret = {
        betweenness: function betweenness(node) {
          var id = cy.collection(node).id();
          return C.get(id);
        },
        betweennessNormalized: function betweennessNormalized(node) {
          if (max == 0) {
            return 0;
          }

          var id = cy.collection(node).id();
          return C.get(id) / max;
        }
      }; // alias

      ret.betweennessNormalised = ret.betweennessNormalized;
      return ret;
    } // betweennessCentrality

  }; // elesfn
  // nice, short mathemathical alias

  elesfn$a.bc = elesfn$a.betweennessCentrality;

  // Implemented by Zoe Xi @zoexi for GSOC 2016
  /* eslint-disable no-unused-vars */

  var defaults$4 = defaults({
    expandFactor: 2,
    // affects time of computation and cluster granularity to some extent: M * M
    inflateFactor: 2,
    // affects cluster granularity (the greater the value, the more clusters): M(i,j) / E(j)
    multFactor: 1,
    // optional self loops for each node. Use a neutral value to improve cluster computations.
    maxIterations: 20,
    // maximum number of iterations of the MCL algorithm in a single run
    attributes: [// attributes/features used to group nodes, ie. similarity values between nodes
    function (edge) {
      return 1;
    }]
  });
  /* eslint-enable */

  var setOptions = function setOptions(options) {
    return defaults$4(options);
  };
  /* eslint-enable */


  var getSimilarity = function getSimilarity(edge, attributes) {
    var total = 0;

    for (var i = 0; i < attributes.length; i++) {
      total += attributes[i](edge);
    }

    return total;
  };

  var addLoops = function addLoops(M, n, val) {
    for (var i = 0; i < n; i++) {
      M[i * n + i] = val;
    }
  };

  var normalize = function normalize(M, n) {
    var sum;

    for (var col = 0; col < n; col++) {
      sum = 0;

      for (var row = 0; row < n; row++) {
        sum += M[row * n + col];
      }

      for (var _row = 0; _row < n; _row++) {
        M[_row * n + col] = M[_row * n + col] / sum;
      }
    }
  }; // TODO: blocked matrix multiplication?


  var mmult = function mmult(A, B, n) {
    var C = new Array(n * n);

    for (var i = 0; i < n; i++) {
      for (var j = 0; j < n; j++) {
        C[i * n + j] = 0;
      }

      for (var k = 0; k < n; k++) {
        for (var _j = 0; _j < n; _j++) {
          C[i * n + _j] += A[i * n + k] * B[k * n + _j];
        }
      }
    }

    return C;
  };

  var expand = function expand(M, n, expandFactor
  /** power **/
  ) {
    var _M = M.slice(0);

    for (var p = 1; p < expandFactor; p++) {
      M = mmult(M, _M, n);
    }

    return M;
  };

  var inflate = function inflate(M, n, inflateFactor
  /** r **/
  ) {
    var _M = new Array(n * n); // M(i,j) ^ inflatePower


    for (var i = 0; i < n * n; i++) {
      _M[i] = Math.pow(M[i], inflateFactor);
    }

    normalize(_M, n);
    return _M;
  };

  var hasConverged = function hasConverged(M, _M, n2, roundFactor) {
    // Check that both matrices have the same elements (i,j)
    for (var i = 0; i < n2; i++) {
      var v1 = Math.round(M[i] * Math.pow(10, roundFactor)) / Math.pow(10, roundFactor); // truncate to 'roundFactor' decimal places

      var v2 = Math.round(_M[i] * Math.pow(10, roundFactor)) / Math.pow(10, roundFactor);

      if (v1 !== v2) {
        return false;
      }
    }

    return true;
  };

  var assign = function assign(M, n, nodes, cy) {
    var clusters = [];

    for (var i = 0; i < n; i++) {
      var cluster = [];

      for (var j = 0; j < n; j++) {
        // Row-wise attractors and elements that they attract belong in same cluster
        if (Math.round(M[i * n + j] * 1000) / 1000 > 0) {
          cluster.push(nodes[j]);
        }
      }

      if (cluster.length !== 0) {
        clusters.push(cy.collection(cluster));
      }
    }

    return clusters;
  };

  var isDuplicate = function isDuplicate(c1, c2) {
    for (var i = 0; i < c1.length; i++) {
      if (!c2[i] || c1[i].id() !== c2[i].id()) {
        return false;
      }
    }

    return true;
  };

  var removeDuplicates = function removeDuplicates(clusters) {
    for (var i = 0; i < clusters.length; i++) {
      for (var j = 0; j < clusters.length; j++) {
        if (i != j && isDuplicate(clusters[i], clusters[j])) {
          clusters.splice(j, 1);
        }
      }
    }

    return clusters;
  };

  var markovClustering = function markovClustering(options) {
    var nodes = this.nodes();
    var edges = this.edges();
    var cy = this.cy(); // Set parameters of algorithm:

    var opts = setOptions(options); // Map each node to its position in node array

    var id2position = {};

    for (var i = 0; i < nodes.length; i++) {
      id2position[nodes[i].id()] = i;
    } // Generate stochastic matrix M from input graph G (should be symmetric/undirected)


    var n = nodes.length,
        n2 = n * n;

    var M = new Array(n2),
        _M;

    for (var _i = 0; _i < n2; _i++) {
      M[_i] = 0;
    }

    for (var e = 0; e < edges.length; e++) {
      var edge = edges[e];
      var _i2 = id2position[edge.source().id()];
      var j = id2position[edge.target().id()];
      var sim = getSimilarity(edge, opts.attributes);
      M[_i2 * n + j] += sim; // G should be symmetric and undirected

      M[j * n + _i2] += sim;
    } // Begin Markov cluster algorithm
    // Step 1: Add self loops to each node, ie. add multFactor to matrix diagonal


    addLoops(M, n, opts.multFactor); // Step 2: M = normalize( M );

    normalize(M, n);
    var isStillMoving = true;
    var iterations = 0;

    while (isStillMoving && iterations < opts.maxIterations) {
      isStillMoving = false; // Step 3:

      _M = expand(M, n, opts.expandFactor); // Step 4:

      M = inflate(_M, n, opts.inflateFactor); // Step 5: check to see if ~steady state has been reached

      if (!hasConverged(M, _M, n2, 4)) {
        isStillMoving = true;
      }

      iterations++;
    } // Build clusters from matrix


    var clusters = assign(M, n, nodes, cy); // Remove duplicate clusters due to symmetry of graph and M matrix

    clusters = removeDuplicates(clusters);
    return clusters;
  };

  var markovClustering$1 = {
    markovClustering: markovClustering,
    mcl: markovClustering
  };

  // Common distance metrics for clustering algorithms

  var identity = function identity(x) {
    return x;
  };

  var absDiff = function absDiff(p, q) {
    return Math.abs(q - p);
  };

  var addAbsDiff = function addAbsDiff(total, p, q) {
    return total + absDiff(p, q);
  };

  var addSquaredDiff = function addSquaredDiff(total, p, q) {
    return total + Math.pow(q - p, 2);
  };

  var sqrt = function sqrt(x) {
    return Math.sqrt(x);
  };

  var maxAbsDiff = function maxAbsDiff(currentMax, p, q) {
    return Math.max(currentMax, absDiff(p, q));
  };

  var getDistance = function getDistance(length, getP, getQ, init, visit) {
    var post = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : identity;
    var ret = init;
    var p, q;

    for (var dim = 0; dim < length; dim++) {
      p = getP(dim);
      q = getQ(dim);
      ret = visit(ret, p, q);
    }

    return post(ret);
  };

  var distances = {
    euclidean: function euclidean(length, getP, getQ) {
      if (length >= 2) {
        return getDistance(length, getP, getQ, 0, addSquaredDiff, sqrt);
      } else {
        // for single attr case, more efficient to avoid sqrt
        return getDistance(length, getP, getQ, 0, addAbsDiff);
      }
    },
    squaredEuclidean: function squaredEuclidean(length, getP, getQ) {
      return getDistance(length, getP, getQ, 0, addSquaredDiff);
    },
    manhattan: function manhattan(length, getP, getQ) {
      return getDistance(length, getP, getQ, 0, addAbsDiff);
    },
    max: function max(length, getP, getQ) {
      return getDistance(length, getP, getQ, -Infinity, maxAbsDiff);
    }
  }; // in case the user accidentally doesn't use camel case

  distances['squared-euclidean'] = distances['squaredEuclidean'];
  distances['squaredeuclidean'] = distances['squaredEuclidean'];
  function clusteringDistance (method, length, getP, getQ, nodeP, nodeQ) {
    var impl;

    if (fn(method)) {
      impl = method;
    } else {
      impl = distances[method] || distances.euclidean;
    }

    if (length === 0 && fn(method)) {
      return impl(nodeP, nodeQ);
    } else {
      return impl(length, getP, getQ, nodeP, nodeQ);
    }
  }

  var defaults$5 = defaults({
    k: 2,
    m: 2,
    sensitivityThreshold: 0.0001,
    distance: 'euclidean',
    maxIterations: 10,
    attributes: [],
    testMode: false,
    testCentroids: null
  });

  var setOptions$1 = function setOptions(options) {
    return defaults$5(options);
  };
  /* eslint-enable */


  var getDist = function getDist(type, node, centroid, attributes, mode) {
    var noNodeP = mode !== 'kMedoids';
    var getP = noNodeP ? function (i) {
      return centroid[i];
    } : function (i) {
      return attributes[i](centroid);
    };

    var getQ = function getQ(i) {
      return attributes[i](node);
    };

    var nodeP = centroid;
    var nodeQ = node;
    return clusteringDistance(type, attributes.length, getP, getQ, nodeP, nodeQ);
  };

  var randomCentroids = function randomCentroids(nodes, k, attributes) {
    var ndim = attributes.length;
    var min = new Array(ndim);
    var max = new Array(ndim);
    var centroids = new Array(k);
    var centroid = null; // Find min, max values for each attribute dimension

    for (var i = 0; i < ndim; i++) {
      min[i] = nodes.min(attributes[i]).value;
      max[i] = nodes.max(attributes[i]).value;
    } // Build k centroids, each represented as an n-dim feature vector


    for (var c = 0; c < k; c++) {
      centroid = [];

      for (var _i = 0; _i < ndim; _i++) {
        centroid[_i] = Math.random() * (max[_i] - min[_i]) + min[_i]; // random initial value
      }

      centroids[c] = centroid;
    }

    return centroids;
  };

  var classify = function classify(node, centroids, distance, attributes, type) {
    var min = Infinity;
    var index = 0;

    for (var i = 0; i < centroids.length; i++) {
      var dist = getDist(distance, node, centroids[i], attributes, type);

      if (dist < min) {
        min = dist;
        index = i;
      }
    }

    return index;
  };

  var buildCluster = function buildCluster(centroid, nodes, assignment) {
    var cluster = [];
    var node = null;

    for (var n = 0; n < nodes.length; n++) {
      node = nodes[n];

      if (assignment[node.id()] === centroid) {
        //console.log("Node " + node.id() + " is associated with medoid #: " + m);
        cluster.push(node);
      }
    }

    return cluster;
  };

  var haveValuesConverged = function haveValuesConverged(v1, v2, sensitivityThreshold) {
    return Math.abs(v2 - v1) <= sensitivityThreshold;
  };

  var haveMatricesConverged = function haveMatricesConverged(v1, v2, sensitivityThreshold) {
    for (var i = 0; i < v1.length; i++) {
      for (var j = 0; j < v1[i].length; j++) {
        var diff = Math.abs(v1[i][j] - v2[i][j]);

        if (diff > sensitivityThreshold) {
          return false;
        }
      }
    }

    return true;
  };

  var seenBefore = function seenBefore(node, medoids, n) {
    for (var i = 0; i < n; i++) {
      if (node === medoids[i]) return true;
    }

    return false;
  };

  var randomMedoids = function randomMedoids(nodes, k) {
    var medoids = new Array(k); // For small data sets, the probability of medoid conflict is greater,
    // so we need to check to see if we've already seen or chose this node before.

    if (nodes.length < 50) {
      // Randomly select k medoids from the n nodes
      for (var i = 0; i < k; i++) {
        var node = nodes[Math.floor(Math.random() * nodes.length)]; // If we've already chosen this node to be a medoid, don't choose it again (for small data sets).
        // Instead choose a different random node.

        while (seenBefore(node, medoids, i)) {
          node = nodes[Math.floor(Math.random() * nodes.length)];
        }

        medoids[i] = node;
      }
    } else {
      // Relatively large data set, so pretty safe to not check and just select random nodes
      for (var _i2 = 0; _i2 < k; _i2++) {
        medoids[_i2] = nodes[Math.floor(Math.random() * nodes.length)];
      }
    }

    return medoids;
  };

  var findCost = function findCost(potentialNewMedoid, cluster, attributes) {
    var cost = 0;

    for (var n = 0; n < cluster.length; n++) {
      cost += getDist('manhattan', cluster[n], potentialNewMedoid, attributes, 'kMedoids');
    }

    return cost;
  };

  var kMeans = function kMeans(options) {
    var cy = this.cy();
    var nodes = this.nodes();
    var node = null; // Set parameters of algorithm: # of clusters, distance metric, etc.

    var opts = setOptions$1(options); // Begin k-means algorithm

    var clusters = new Array(opts.k);
    var assignment = {};
    var centroids; // Step 1: Initialize centroid positions

    if (opts.testMode) {
      if (typeof opts.testCentroids === 'number') {
        centroids = randomCentroids(nodes, opts.k, opts.attributes);
      } else if (_typeof(opts.testCentroids) === 'object') {
        centroids = opts.testCentroids;
      } else {
        centroids = randomCentroids(nodes, opts.k, opts.attributes);
      }
    } else {
      centroids = randomCentroids(nodes, opts.k, opts.attributes);
    }

    var isStillMoving = true;
    var iterations = 0;

    while (isStillMoving && iterations < opts.maxIterations) {
      // Step 2: Assign nodes to the nearest centroid
      for (var n = 0; n < nodes.length; n++) {
        node = nodes[n]; // Determine which cluster this node belongs to: node id => cluster #

        assignment[node.id()] = classify(node, centroids, opts.distance, opts.attributes, 'kMeans');
      } // Step 3: For each of the k clusters, update its centroid


      isStillMoving = false;

      for (var c = 0; c < opts.k; c++) {
        // Get all nodes that belong to this cluster
        var cluster = buildCluster(c, nodes, assignment);

        if (cluster.length === 0) {
          // If cluster is empty, break out early & move to next cluster
          continue;
        } // Update centroids by calculating avg of all nodes within the cluster.


        var ndim = opts.attributes.length;
        var centroid = centroids[c]; // [ dim_1, dim_2, dim_3, ... , dim_n ]

        var newCentroid = new Array(ndim);
        var sum = new Array(ndim);

        for (var d = 0; d < ndim; d++) {
          sum[d] = 0.0;

          for (var i = 0; i < cluster.length; i++) {
            node = cluster[i];
            sum[d] += opts.attributes[d](node);
          }

          newCentroid[d] = sum[d] / cluster.length; // Check to see if algorithm has converged, i.e. when centroids no longer change

          if (!haveValuesConverged(newCentroid[d], centroid[d], opts.sensitivityThreshold)) {
            isStillMoving = true;
          }
        }

        centroids[c] = newCentroid;
        clusters[c] = cy.collection(cluster);
      }

      iterations++;
    }

    return clusters;
  };

  var kMedoids = function kMedoids(options) {
    var cy = this.cy();
    var nodes = this.nodes();
    var node = null;
    var opts = setOptions$1(options); // Begin k-medoids algorithm

    var clusters = new Array(opts.k);
    var medoids;
    var assignment = {};
    var curCost;
    var minCosts = new Array(opts.k); // minimum cost configuration for each cluster
    // Step 1: Initialize k medoids

    if (opts.testMode) {
      if (typeof opts.testCentroids === 'number') ; else if (_typeof(opts.testCentroids) === 'object') {
        medoids = opts.testCentroids;
      } else {
        medoids = randomMedoids(nodes, opts.k);
      }
    } else {
      medoids = randomMedoids(nodes, opts.k);
    }

    var isStillMoving = true;
    var iterations = 0;

    while (isStillMoving && iterations < opts.maxIterations) {
      // Step 2: Assign nodes to the nearest medoid
      for (var n = 0; n < nodes.length; n++) {
        node = nodes[n]; // Determine which cluster this node belongs to: node id => cluster #

        assignment[node.id()] = classify(node, medoids, opts.distance, opts.attributes, 'kMedoids');
      }

      isStillMoving = false; // Step 3: For each medoid m, and for each node assciated with mediod m,
      // select the node with the lowest configuration cost as new medoid.

      for (var m = 0; m < medoids.length; m++) {
        // Get all nodes that belong to this medoid
        var cluster = buildCluster(m, nodes, assignment);

        if (cluster.length === 0) {
          // If cluster is empty, break out early & move to next cluster
          continue;
        }

        minCosts[m] = findCost(medoids[m], cluster, opts.attributes); // original cost
        // Select different medoid if its configuration has the lowest cost

        for (var _n = 0; _n < cluster.length; _n++) {
          curCost = findCost(cluster[_n], cluster, opts.attributes);

          if (curCost < minCosts[m]) {
            minCosts[m] = curCost;
            medoids[m] = cluster[_n];
            isStillMoving = true;
          }
        }

        clusters[m] = cy.collection(cluster);
      }

      iterations++;
    }

    return clusters;
  };

  var updateCentroids = function updateCentroids(centroids, nodes, U, weight, opts) {
    var numerator, denominator;

    for (var n = 0; n < nodes.length; n++) {
      for (var c = 0; c < centroids.length; c++) {
        weight[n][c] = Math.pow(U[n][c], opts.m);
      }
    }

    for (var _c = 0; _c < centroids.length; _c++) {
      for (var dim = 0; dim < opts.attributes.length; dim++) {
        numerator = 0;
        denominator = 0;

        for (var _n2 = 0; _n2 < nodes.length; _n2++) {
          numerator += weight[_n2][_c] * opts.attributes[dim](nodes[_n2]);
          denominator += weight[_n2][_c];
        }

        centroids[_c][dim] = numerator / denominator;
      }
    }
  };

  var updateMembership = function updateMembership(U, _U, centroids, nodes, opts) {
    // Save previous step
    for (var i = 0; i < U.length; i++) {
      _U[i] = U[i].slice();
    }

    var sum, numerator, denominator;
    var pow = 2 / (opts.m - 1);

    for (var c = 0; c < centroids.length; c++) {
      for (var n = 0; n < nodes.length; n++) {
        sum = 0;

        for (var k = 0; k < centroids.length; k++) {
          // against all other centroids
          numerator = getDist(opts.distance, nodes[n], centroids[c], opts.attributes, 'cmeans');
          denominator = getDist(opts.distance, nodes[n], centroids[k], opts.attributes, 'cmeans');
          sum += Math.pow(numerator / denominator, pow);
        }

        U[n][c] = 1 / sum;
      }
    }
  };

  var assign$1 = function assign(nodes, U, opts, cy) {
    var clusters = new Array(opts.k);

    for (var c = 0; c < clusters.length; c++) {
      clusters[c] = [];
    }

    var max;
    var index;

    for (var n = 0; n < U.length; n++) {
      // for each node (U is N x C matrix)
      max = -Infinity;
      index = -1; // Determine which cluster the node is most likely to belong in

      for (var _c2 = 0; _c2 < U[0].length; _c2++) {
        if (U[n][_c2] > max) {
          max = U[n][_c2];
          index = _c2;
        }
      }

      clusters[index].push(nodes[n]);
    } // Turn every array into a collection of nodes


    for (var _c3 = 0; _c3 < clusters.length; _c3++) {
      clusters[_c3] = cy.collection(clusters[_c3]);
    }

    return clusters;
  };

  var fuzzyCMeans = function fuzzyCMeans(options) {
    var cy = this.cy();
    var nodes = this.nodes();
    var opts = setOptions$1(options); // Begin fuzzy c-means algorithm

    var clusters;
    var centroids;
    var U;

    var _U;

    var weight; // Step 1: Initialize letiables.

    _U = new Array(nodes.length);

    for (var i = 0; i < nodes.length; i++) {
      // N x C matrix
      _U[i] = new Array(opts.k);
    }

    U = new Array(nodes.length);

    for (var _i3 = 0; _i3 < nodes.length; _i3++) {
      // N x C matrix
      U[_i3] = new Array(opts.k);
    }

    for (var _i4 = 0; _i4 < nodes.length; _i4++) {
      var total = 0;

      for (var j = 0; j < opts.k; j++) {
        U[_i4][j] = Math.random();
        total += U[_i4][j];
      }

      for (var _j = 0; _j < opts.k; _j++) {
        U[_i4][_j] = U[_i4][_j] / total;
      }
    }

    centroids = new Array(opts.k);

    for (var _i5 = 0; _i5 < opts.k; _i5++) {
      centroids[_i5] = new Array(opts.attributes.length);
    }

    weight = new Array(nodes.length);

    for (var _i6 = 0; _i6 < nodes.length; _i6++) {
      // N x C matrix
      weight[_i6] = new Array(opts.k);
    } // end init FCM


    var isStillMoving = true;
    var iterations = 0;

    while (isStillMoving && iterations < opts.maxIterations) {
      isStillMoving = false; // Step 2: Calculate the centroids for each step.

      updateCentroids(centroids, nodes, U, weight, opts); // Step 3: Update the partition matrix U.

      updateMembership(U, _U, centroids, nodes, opts); // Step 4: Check for convergence.

      if (!haveMatricesConverged(U, _U, opts.sensitivityThreshold)) {
        isStillMoving = true;
      }

      iterations++;
    } // Assign nodes to clusters with highest probability.


    clusters = assign$1(nodes, U, opts, cy);
    return {
      clusters: clusters,
      degreeOfMembership: U
    };
  };

  var kClustering = {
    kMeans: kMeans,
    kMedoids: kMedoids,
    fuzzyCMeans: fuzzyCMeans,
    fcm: fuzzyCMeans
  };

  // Implemented by Zoe Xi @zoexi for GSOC 2016
  var defaults$6 = defaults({
    distance: 'euclidean',
    // distance metric to compare nodes
    linkage: 'min',
    // linkage criterion : how to determine the distance between clusters of nodes
    mode: 'threshold',
    // mode:'threshold' => clusters must be threshold distance apart
    threshold: Infinity,
    // the distance threshold
    // mode:'dendrogram' => the nodes are organised as leaves in a tree (siblings are close), merging makes clusters
    addDendrogram: false,
    // whether to add the dendrogram to the graph for viz
    dendrogramDepth: 0,
    // depth at which dendrogram branches are merged into the returned clusters
    attributes: [] // array of attr functions

  });
  var linkageAliases = {
    'single': 'min',
    'complete': 'max'
  };

  var setOptions$2 = function setOptions(options) {
    var opts = defaults$6(options);
    var preferredAlias = linkageAliases[opts.linkage];

    if (preferredAlias != null) {
      opts.linkage = preferredAlias;
    }

    return opts;
  };

  var mergeClosest = function mergeClosest(clusters, index, dists, mins, opts) {
    // Find two closest clusters from cached mins
    var minKey = 0;
    var min = Infinity;
    var dist;
    var attrs = opts.attributes;

    var getDist = function getDist(n1, n2) {
      return clusteringDistance(opts.distance, attrs.length, function (i) {
        return attrs[i](n1);
      }, function (i) {
        return attrs[i](n2);
      }, n1, n2);
    };

    for (var i = 0; i < clusters.length; i++) {
      var key = clusters[i].key;
      var _dist = dists[key][mins[key]];

      if (_dist < min) {
        minKey = key;
        min = _dist;
      }
    }

    if (opts.mode === 'threshold' && min >= opts.threshold || opts.mode === 'dendrogram' && clusters.length === 1) {
      return false;
    }

    var c1 = index[minKey];
    var c2 = index[mins[minKey]];
    var merged; // Merge two closest clusters

    if (opts.mode === 'dendrogram') {
      merged = {
        left: c1,
        right: c2,
        key: c1.key
      };
    } else {
      merged = {
        value: c1.value.concat(c2.value),
        key: c1.key
      };
    }

    clusters[c1.index] = merged;
    clusters.splice(c2.index, 1);
    index[c1.key] = merged; // Update distances with new merged cluster

    for (var _i = 0; _i < clusters.length; _i++) {
      var cur = clusters[_i];

      if (c1.key === cur.key) {
        dist = Infinity;
      } else if (opts.linkage === 'min') {
        dist = dists[c1.key][cur.key];

        if (dists[c1.key][cur.key] > dists[c2.key][cur.key]) {
          dist = dists[c2.key][cur.key];
        }
      } else if (opts.linkage === 'max') {
        dist = dists[c1.key][cur.key];

        if (dists[c1.key][cur.key] < dists[c2.key][cur.key]) {
          dist = dists[c2.key][cur.key];
        }
      } else if (opts.linkage === 'mean') {
        dist = (dists[c1.key][cur.key] * c1.size + dists[c2.key][cur.key] * c2.size) / (c1.size + c2.size);
      } else {
        if (opts.mode === 'dendrogram') dist = getDist(cur.value, c1.value);else dist = getDist(cur.value[0], c1.value[0]);
      }

      dists[c1.key][cur.key] = dists[cur.key][c1.key] = dist; // distance matrix is symmetric
    } // Update cached mins


    for (var _i2 = 0; _i2 < clusters.length; _i2++) {
      var key1 = clusters[_i2].key;

      if (mins[key1] === c1.key || mins[key1] === c2.key) {
        var _min = key1;

        for (var j = 0; j < clusters.length; j++) {
          var key2 = clusters[j].key;

          if (dists[key1][key2] < dists[key1][_min]) {
            _min = key2;
          }
        }

        mins[key1] = _min;
      }

      clusters[_i2].index = _i2;
    } // Clean up meta data used for clustering


    c1.key = c2.key = c1.index = c2.index = null;
    return true;
  };

  var getAllChildren = function getAllChildren(root, arr, cy) {
    if (!root) return;

    if (root.value) {
      arr.push(root.value);
    } else {
      if (root.left) getAllChildren(root.left, arr);
      if (root.right) getAllChildren(root.right, arr);
    }
  };

  var buildDendrogram = function buildDendrogram(root, cy) {
    if (!root) return '';

    if (root.left && root.right) {
      var leftStr = buildDendrogram(root.left, cy);
      var rightStr = buildDendrogram(root.right, cy);
      var node = cy.add({
        group: 'nodes',
        data: {
          id: leftStr + ',' + rightStr
        }
      });
      cy.add({
        group: 'edges',
        data: {
          source: leftStr,
          target: node.id()
        }
      });
      cy.add({
        group: 'edges',
        data: {
          source: rightStr,
          target: node.id()
        }
      });
      return node.id();
    } else if (root.value) {
      return root.value.id();
    }
  };

  var buildClustersFromTree = function buildClustersFromTree(root, k, cy) {
    if (!root) return [];
    var left = [],
        right = [],
        leaves = [];

    if (k === 0) {
      // don't cut tree, simply return all nodes as 1 single cluster
      if (root.left) getAllChildren(root.left, left);
      if (root.right) getAllChildren(root.right, right);
      leaves = left.concat(right);
      return [cy.collection(leaves)];
    } else if (k === 1) {
      // cut at root
      if (root.value) {
        // leaf node
        return [cy.collection(root.value)];
      } else {
        if (root.left) getAllChildren(root.left, left);
        if (root.right) getAllChildren(root.right, right);
        return [cy.collection(left), cy.collection(right)];
      }
    } else {
      if (root.value) {
        return [cy.collection(root.value)];
      } else {
        if (root.left) left = buildClustersFromTree(root.left, k - 1, cy);
        if (root.right) right = buildClustersFromTree(root.right, k - 1, cy);
        return left.concat(right);
      }
    }
  };
  /* eslint-enable */


  var hierarchicalClustering = function hierarchicalClustering(options) {
    var cy = this.cy();
    var nodes = this.nodes(); // Set parameters of algorithm: linkage type, distance metric, etc.

    var opts = setOptions$2(options);
    var attrs = opts.attributes;

    var getDist = function getDist(n1, n2) {
      return clusteringDistance(opts.distance, attrs.length, function (i) {
        return attrs[i](n1);
      }, function (i) {
        return attrs[i](n2);
      }, n1, n2);
    }; // Begin hierarchical algorithm


    var clusters = [];
    var dists = []; // distances between each pair of clusters

    var mins = []; // closest cluster for each cluster

    var index = []; // hash of all clusters by key
    // In agglomerative (bottom-up) clustering, each node starts as its own cluster

    for (var n = 0; n < nodes.length; n++) {
      var cluster = {
        value: opts.mode === 'dendrogram' ? nodes[n] : [nodes[n]],
        key: n,
        index: n
      };
      clusters[n] = cluster;
      index[n] = cluster;
      dists[n] = [];
      mins[n] = 0;
    } // Calculate the distance between each pair of clusters


    for (var i = 0; i < clusters.length; i++) {
      for (var j = 0; j <= i; j++) {
        var dist = void 0;

        if (opts.mode === 'dendrogram') {
          // modes store cluster values differently
          dist = i === j ? Infinity : getDist(clusters[i].value, clusters[j].value);
        } else {
          dist = i === j ? Infinity : getDist(clusters[i].value[0], clusters[j].value[0]);
        }

        dists[i][j] = dist;
        dists[j][i] = dist;

        if (dist < dists[i][mins[i]]) {
          mins[i] = j; // Cache mins: closest cluster to cluster i is cluster j
        }
      }
    } // Find the closest pair of clusters and merge them into a single cluster.
    // Update distances between new cluster and each of the old clusters, and loop until threshold reached.


    var merged = mergeClosest(clusters, index, dists, mins, opts);

    while (merged) {
      merged = mergeClosest(clusters, index, dists, mins, opts);
    }

    var retClusters; // Dendrogram mode builds the hierarchy and adds intermediary nodes + edges
    // in addition to returning the clusters.

    if (opts.mode === 'dendrogram') {
      retClusters = buildClustersFromTree(clusters[0], opts.dendrogramDepth, cy);
      if (opts.addDendrogram) buildDendrogram(clusters[0], cy);
    } else {
      // Regular mode simply returns the clusters
      retClusters = new Array(clusters.length);
      clusters.forEach(function (cluster, i) {
        // Clean up meta data used for clustering
        cluster.key = cluster.index = null;
        retClusters[i] = cy.collection(cluster.value);
      });
    }

    return retClusters;
  };

  var hierarchicalClustering$1 = {
    hierarchicalClustering: hierarchicalClustering,
    hca: hierarchicalClustering
  };

  // Implemented by Zoe Xi @zoexi for GSOC 2016
  var defaults$7 = defaults({
    distance: 'euclidean',
    // distance metric to compare attributes between two nodes
    preference: 'median',
    // suitability of a data point to serve as an exemplar
    damping: 0.8,
    // damping factor between [0.5, 1)
    maxIterations: 1000,
    // max number of iterations to run
    minIterations: 100,
    // min number of iterations to run in order for clustering to stop
    attributes: [// functions to quantify the similarity between any two points
      // e.g. node => node.data('weight')
    ]
  });

  var setOptions$3 = function setOptions(options) {
    var dmp = options.damping;
    var pref = options.preference;

    if (!(0.5 <= dmp && dmp < 1)) {
      error("Damping must range on [0.5, 1).  Got: ".concat(dmp));
    }

    var validPrefs = ['median', 'mean', 'min', 'max'];

    if (!(validPrefs.some(function (v) {
      return v === pref;
    }) || number(pref))) {
      error("Preference must be one of [".concat(validPrefs.map(function (p) {
        return "'".concat(p, "'");
      }).join(', '), "] or a number.  Got: ").concat(pref));
    }

    return defaults$7(options);
  };
  /* eslint-enable */


  var getSimilarity$1 = function getSimilarity(type, n1, n2, attributes) {
    var attr = function attr(n, i) {
      return attributes[i](n);
    }; // nb negative because similarity should have an inverse relationship to distance


    return -clusteringDistance(type, attributes.length, function (i) {
      return attr(n1, i);
    }, function (i) {
      return attr(n2, i);
    }, n1, n2);
  };

  var getPreference = function getPreference(S, preference) {
    // larger preference = greater # of clusters
    var p = null;

    if (preference === 'median') {
      p = median(S);
    } else if (preference === 'mean') {
      p = mean(S);
    } else if (preference === 'min') {
      p = min(S);
    } else if (preference === 'max') {
      p = max(S);
    } else {
      // Custom preference number, as set by user
      p = preference;
    }

    return p;
  };

  var findExemplars = function findExemplars(n, R, A) {
    var indices = [];

    for (var i = 0; i < n; i++) {
      if (R[i * n + i] + A[i * n + i] > 0) {
        indices.push(i);
      }
    }

    return indices;
  };

  var assignClusters = function assignClusters(n, S, exemplars) {
    var clusters = [];

    for (var i = 0; i < n; i++) {
      var index = -1;
      var max = -Infinity;

      for (var ei = 0; ei < exemplars.length; ei++) {
        var e = exemplars[ei];

        if (S[i * n + e] > max) {
          index = e;
          max = S[i * n + e];
        }
      }

      if (index > 0) {
        clusters.push(index);
      }
    }

    for (var _ei = 0; _ei < exemplars.length; _ei++) {
      clusters[exemplars[_ei]] = exemplars[_ei];
    }

    return clusters;
  };

  var assign$2 = function assign(n, S, exemplars) {
    var clusters = assignClusters(n, S, exemplars);

    for (var ei = 0; ei < exemplars.length; ei++) {
      var ii = [];

      for (var c = 0; c < clusters.length; c++) {
        if (clusters[c] === exemplars[ei]) {
          ii.push(c);
        }
      }

      var maxI = -1;
      var maxSum = -Infinity;

      for (var i = 0; i < ii.length; i++) {
        var sum = 0;

        for (var j = 0; j < ii.length; j++) {
          sum += S[ii[j] * n + ii[i]];
        }

        if (sum > maxSum) {
          maxI = i;
          maxSum = sum;
        }
      }

      exemplars[ei] = ii[maxI];
    }

    clusters = assignClusters(n, S, exemplars);
    return clusters;
  };

  var affinityPropagation = function affinityPropagation(options) {
    var cy = this.cy();
    var nodes = this.nodes();
    var opts = setOptions$3(options); // Map each node to its position in node array

    var id2position = {};

    for (var i = 0; i < nodes.length; i++) {
      id2position[nodes[i].id()] = i;
    } // Begin affinity propagation algorithm


    var n; // number of data points

    var n2; // size of matrices

    var S; // similarity matrix (1D array)

    var p; // preference/suitability of a data point to serve as an exemplar

    var R; // responsibility matrix (1D array)

    var A; // availability matrix (1D array)

    n = nodes.length;
    n2 = n * n; // Initialize and build S similarity matrix

    S = new Array(n2);

    for (var _i = 0; _i < n2; _i++) {
      S[_i] = -Infinity; // for cases where two data points shouldn't be linked together
    }

    for (var _i2 = 0; _i2 < n; _i2++) {
      for (var j = 0; j < n; j++) {
        if (_i2 !== j) {
          S[_i2 * n + j] = getSimilarity$1(opts.distance, nodes[_i2], nodes[j], opts.attributes);
        }
      }
    } // Place preferences on the diagonal of S


    p = getPreference(S, opts.preference);

    for (var _i3 = 0; _i3 < n; _i3++) {
      S[_i3 * n + _i3] = p;
    } // Initialize R responsibility matrix


    R = new Array(n2);

    for (var _i4 = 0; _i4 < n2; _i4++) {
      R[_i4] = 0.0;
    } // Initialize A availability matrix


    A = new Array(n2);

    for (var _i5 = 0; _i5 < n2; _i5++) {
      A[_i5] = 0.0;
    }

    var old = new Array(n);
    var Rp = new Array(n);
    var se = new Array(n);

    for (var _i6 = 0; _i6 < n; _i6++) {
      old[_i6] = 0.0;
      Rp[_i6] = 0.0;
      se[_i6] = 0;
    }

    var e = new Array(n * opts.minIterations);

    for (var _i7 = 0; _i7 < e.length; _i7++) {
      e[_i7] = 0;
    }

    var iter;

    for (iter = 0; iter < opts.maxIterations; iter++) {
      // main algorithmic loop
      // Update R responsibility matrix
      for (var _i8 = 0; _i8 < n; _i8++) {
        var max = -Infinity,
            max2 = -Infinity,
            maxI = -1,
            AS = 0.0;

        for (var _j = 0; _j < n; _j++) {
          old[_j] = R[_i8 * n + _j];
          AS = A[_i8 * n + _j] + S[_i8 * n + _j];

          if (AS >= max) {
            max2 = max;
            max = AS;
            maxI = _j;
          } else if (AS > max2) {
            max2 = AS;
          }
        }

        for (var _j2 = 0; _j2 < n; _j2++) {
          R[_i8 * n + _j2] = (1 - opts.damping) * (S[_i8 * n + _j2] - max) + opts.damping * old[_j2];
        }

        R[_i8 * n + maxI] = (1 - opts.damping) * (S[_i8 * n + maxI] - max2) + opts.damping * old[maxI];
      } // Update A availability matrix


      for (var _i9 = 0; _i9 < n; _i9++) {
        var sum = 0;

        for (var _j3 = 0; _j3 < n; _j3++) {
          old[_j3] = A[_j3 * n + _i9];
          Rp[_j3] = Math.max(0, R[_j3 * n + _i9]);
          sum += Rp[_j3];
        }

        sum -= Rp[_i9];
        Rp[_i9] = R[_i9 * n + _i9];
        sum += Rp[_i9];

        for (var _j4 = 0; _j4 < n; _j4++) {
          A[_j4 * n + _i9] = (1 - opts.damping) * Math.min(0, sum - Rp[_j4]) + opts.damping * old[_j4];
        }

        A[_i9 * n + _i9] = (1 - opts.damping) * (sum - Rp[_i9]) + opts.damping * old[_i9];
      } // Check for convergence


      var K = 0;

      for (var _i10 = 0; _i10 < n; _i10++) {
        var E = A[_i10 * n + _i10] + R[_i10 * n + _i10] > 0 ? 1 : 0;
        e[iter % opts.minIterations * n + _i10] = E;
        K += E;
      }

      if (K > 0 && (iter >= opts.minIterations - 1 || iter == opts.maxIterations - 1)) {
        var _sum = 0;

        for (var _i11 = 0; _i11 < n; _i11++) {
          se[_i11] = 0;

          for (var _j5 = 0; _j5 < opts.minIterations; _j5++) {
            se[_i11] += e[_j5 * n + _i11];
          }

          if (se[_i11] === 0 || se[_i11] === opts.minIterations) {
            _sum++;
          }
        }

        if (_sum === n) {
          // then we have convergence
          break;
        }
      }
    } // Identify exemplars (cluster centers)


    var exemplarsIndices = findExemplars(n, R, A); // Assign nodes to clusters

    var clusterIndices = assign$2(n, S, exemplarsIndices);
    var clusters = {};

    for (var c = 0; c < exemplarsIndices.length; c++) {
      clusters[exemplarsIndices[c]] = [];
    }

    for (var _i12 = 0; _i12 < nodes.length; _i12++) {
      var pos = id2position[nodes[_i12].id()];

      var clusterIndex = clusterIndices[pos];

      if (clusterIndex != null) {
        // the node may have not been assigned a cluster if no valid attributes were specified
        clusters[clusterIndex].push(nodes[_i12]);
      }
    }

    var retClusters = new Array(exemplarsIndices.length);

    for (var _c = 0; _c < exemplarsIndices.length; _c++) {
      retClusters[_c] = cy.collection(clusters[exemplarsIndices[_c]]);
    }

    return retClusters;
  };

  var affinityPropagation$1 = {
    affinityPropagation: affinityPropagation,
    ap: affinityPropagation
  };

  var hierholzerDefaults = defaults({
    root: undefined,
    directed: false
  });
  var elesfn$b = {
    hierholzer: function hierholzer(options) {
      if (!plainObject(options)) {
        var args = arguments;
        options = {
          root: args[0],
          directed: args[1]
        };
      }

      var _hierholzerDefaults = hierholzerDefaults(options),
          root = _hierholzerDefaults.root,
          directed = _hierholzerDefaults.directed;

      var eles = this;
      var dflag = false;
      var oddIn;
      var oddOut;
      var startVertex;
      if (root) startVertex = string(root) ? this.filter(root)[0].id() : root[0].id();
      var nodes = {};
      var edges = {};

      if (directed) {
        eles.forEach(function (ele) {
          var id = ele.id();

          if (ele.isNode()) {
            var ind = ele.indegree(true);
            var outd = ele.outdegree(true);
            var d1 = ind - outd;
            var d2 = outd - ind;

            if (d1 == 1) {
              if (oddIn) dflag = true;else oddIn = id;
            } else if (d2 == 1) {
              if (oddOut) dflag = true;else oddOut = id;
            } else if (d2 > 1 || d1 > 1) {
              dflag = true;
            }

            nodes[id] = [];
            ele.outgoers().forEach(function (e) {
              if (e.isEdge()) nodes[id].push(e.id());
            });
          } else {
            edges[id] = [undefined, ele.target().id()];
          }
        });
      } else {
        eles.forEach(function (ele) {
          var id = ele.id();

          if (ele.isNode()) {
            var d = ele.degree(true);

            if (d % 2) {
              if (!oddIn) oddIn = id;else if (!oddOut) oddOut = id;else dflag = true;
            }

            nodes[id] = [];
            ele.connectedEdges().forEach(function (e) {
              return nodes[id].push(e.id());
            });
          } else {
            edges[id] = [ele.source().id(), ele.target().id()];
          }
        });
      }

      var result = {
        found: false,
        trail: undefined
      };
      if (dflag) return result;else if (oddOut && oddIn) {
        if (directed) {
          if (startVertex && oddOut != startVertex) {
            return result;
          }

          startVertex = oddOut;
        } else {
          if (startVertex && oddOut != startVertex && oddIn != startVertex) {
            return result;
          } else if (!startVertex) {
            startVertex = oddOut;
          }
        }
      } else {
        if (!startVertex) startVertex = eles[0].id();
      }

      var walk = function walk(v) {
        var currentNode = v;
        var subtour = [v];
        var adj, adjTail, adjHead;

        while (nodes[currentNode].length) {
          adj = nodes[currentNode].shift();
          adjTail = edges[adj][0];
          adjHead = edges[adj][1];

          if (currentNode != adjHead) {
            nodes[adjHead] = nodes[adjHead].filter(function (e) {
              return e != adj;
            });
            currentNode = adjHead;
          } else if (!directed && currentNode != adjTail) {
            nodes[adjTail] = nodes[adjTail].filter(function (e) {
              return e != adj;
            });
            currentNode = adjTail;
          }

          subtour.unshift(adj);
          subtour.unshift(currentNode);
        }

        return subtour;
      };

      var trail = [];
      var subtour = [];
      subtour = walk(startVertex);

      while (subtour.length != 1) {
        if (nodes[subtour[0]].length == 0) {
          trail.unshift(eles.getElementById(subtour.shift()));
          trail.unshift(eles.getElementById(subtour.shift()));
        } else {
          subtour = walk(subtour.shift()).concat(subtour);
        }
      }

      trail.unshift(eles.getElementById(subtour.shift())); // final node

      for (var d in nodes) {
        if (nodes[d].length) {
          return result;
        }
      }

      result.found = true;
      result.trail = this.spawn(trail, true);
      return result;
    }
  };

  var hopcroftTarjanBiconnected = function hopcroftTarjanBiconnected() {
    var eles = this;
    var nodes = {};
    var id = 0;
    var edgeCount = 0;
    var components = [];
    var stack = [];
    var visitedEdges = {};

    var buildComponent = function buildComponent(x, y) {
      var i = stack.length - 1;
      var cutset = [];
      var component = eles.spawn();

      while (stack[i].x != x || stack[i].y != y) {
        cutset.push(stack.pop().edge);
        i--;
      }

      cutset.push(stack.pop().edge);
      cutset.forEach(function (edge) {
        var connectedNodes = edge.connectedNodes().intersection(eles);
        component.merge(edge);
        connectedNodes.forEach(function (node) {
          var nodeId = node.id();
          var connectedEdges = node.connectedEdges().intersection(eles);
          component.merge(node);

          if (!nodes[nodeId].cutVertex) {
            component.merge(connectedEdges);
          } else {
            component.merge(connectedEdges.filter(function (edge) {
              return edge.isLoop();
            }));
          }
        });
      });
      components.push(component);
    };

    var biconnectedSearch = function biconnectedSearch(root, currentNode, parent) {
      if (root === parent) edgeCount += 1;
      nodes[currentNode] = {
        id: id,
        low: id++,
        cutVertex: false
      };
      var edges = eles.getElementById(currentNode).connectedEdges().intersection(eles);

      if (edges.size() === 0) {
        components.push(eles.spawn(eles.getElementById(currentNode)));
      } else {
        var sourceId, targetId, otherNodeId, edgeId;
        edges.forEach(function (edge) {
          sourceId = edge.source().id();
          targetId = edge.target().id();
          otherNodeId = sourceId === currentNode ? targetId : sourceId;

          if (otherNodeId !== parent) {
            edgeId = edge.id();

            if (!visitedEdges[edgeId]) {
              visitedEdges[edgeId] = true;
              stack.push({
                x: currentNode,
                y: otherNodeId,
                edge: edge
              });
            }

            if (!(otherNodeId in nodes)) {
              biconnectedSearch(root, otherNodeId, currentNode);
              nodes[currentNode].low = Math.min(nodes[currentNode].low, nodes[otherNodeId].low);

              if (nodes[currentNode].id <= nodes[otherNodeId].low) {
                nodes[currentNode].cutVertex = true;
                buildComponent(currentNode, otherNodeId);
              }
            } else {
              nodes[currentNode].low = Math.min(nodes[currentNode].low, nodes[otherNodeId].id);
            }
          }
        });
      }
    };

    eles.forEach(function (ele) {
      if (ele.isNode()) {
        var nodeId = ele.id();

        if (!(nodeId in nodes)) {
          edgeCount = 0;
          biconnectedSearch(nodeId, nodeId);
          nodes[nodeId].cutVertex = edgeCount > 1;
        }
      }
    });
    var cutVertices = Object.keys(nodes).filter(function (id) {
      return nodes[id].cutVertex;
    }).map(function (id) {
      return eles.getElementById(id);
    });
    return {
      cut: eles.spawn(cutVertices),
      components: components
    };
  };

  var hopcroftTarjanBiconnected$1 = {
    hopcroftTarjanBiconnected: hopcroftTarjanBiconnected,
    htbc: hopcroftTarjanBiconnected,
    htb: hopcroftTarjanBiconnected,
    hopcroftTarjanBiconnectedComponents: hopcroftTarjanBiconnected
  };

  var tarjanStronglyConnected = function tarjanStronglyConnected() {
    var eles = this;
    var nodes = {};
    var index = 0;
    var components = [];
    var stack = [];
    var cut = eles.spawn(eles);

    var stronglyConnectedSearch = function stronglyConnectedSearch(sourceNodeId) {
      stack.push(sourceNodeId);
      nodes[sourceNodeId] = {
        index: index,
        low: index++,
        explored: false
      };
      var connectedEdges = eles.getElementById(sourceNodeId).connectedEdges().intersection(eles);
      connectedEdges.forEach(function (edge) {
        var targetNodeId = edge.target().id();

        if (targetNodeId !== sourceNodeId) {
          if (!(targetNodeId in nodes)) {
            stronglyConnectedSearch(targetNodeId);
          }

          if (!nodes[targetNodeId].explored) {
            nodes[sourceNodeId].low = Math.min(nodes[sourceNodeId].low, nodes[targetNodeId].low);
          }
        }
      });

      if (nodes[sourceNodeId].index === nodes[sourceNodeId].low) {
        var componentNodes = eles.spawn();

        for (;;) {
          var nodeId = stack.pop();
          componentNodes.merge(eles.getElementById(nodeId));
          nodes[nodeId].low = nodes[sourceNodeId].index;
          nodes[nodeId].explored = true;

          if (nodeId === sourceNodeId) {
            break;
          }
        }

        var componentEdges = componentNodes.edgesWith(componentNodes);
        var component = componentNodes.merge(componentEdges);
        components.push(component);
        cut = cut.difference(component);
      }
    };

    eles.forEach(function (ele) {
      if (ele.isNode()) {
        var nodeId = ele.id();

        if (!(nodeId in nodes)) {
          stronglyConnectedSearch(nodeId);
        }
      }
    });
    return {
      cut: cut,
      components: components
    };
  };

  var tarjanStronglyConnected$1 = {
    tarjanStronglyConnected: tarjanStronglyConnected,
    tsc: tarjanStronglyConnected,
    tscc: tarjanStronglyConnected,
    tarjanStronglyConnectedComponents: tarjanStronglyConnected
  };

  var elesfn$c = {};
  [elesfn, elesfn$1, elesfn$2, elesfn$3, elesfn$4, elesfn$5, elesfn$6, elesfn$7, elesfn$8, elesfn$9, elesfn$a, markovClustering$1, kClustering, hierarchicalClustering$1, affinityPropagation$1, elesfn$b, hopcroftTarjanBiconnected$1, tarjanStronglyConnected$1].forEach(function (props) {
    extend(elesfn$c, props);
  });

  /*!
  Embeddable Minimum Strictly-Compliant Promises/A+ 1.1.1 Thenable
  Copyright (c) 2013-2014 Ralf S. Engelschall (http://engelschall.com)
  Licensed under The MIT License (http://opensource.org/licenses/MIT)
  */

  /*  promise states [Promises/A+ 2.1]  */
  var STATE_PENDING = 0;
  /*  [Promises/A+ 2.1.1]  */

  var STATE_FULFILLED = 1;
  /*  [Promises/A+ 2.1.2]  */

  var STATE_REJECTED = 2;
  /*  [Promises/A+ 2.1.3]  */

  /*  promise object constructor  */

  var api = function api(executor) {
    /*  optionally support non-constructor/plain-function call  */
    if (!(this instanceof api)) return new api(executor);
    /*  initialize object  */

    this.id = 'Thenable/1.0.7';
    this.state = STATE_PENDING;
    /*  initial state  */

    this.fulfillValue = undefined;
    /*  initial value  */

    /*  [Promises/A+ 1.3, 2.1.2.2]  */

    this.rejectReason = undefined;
    /*  initial reason */

    /*  [Promises/A+ 1.5, 2.1.3.2]  */

    this.onFulfilled = [];
    /*  initial handlers  */

    this.onRejected = [];
    /*  initial handlers  */

    /*  provide optional information-hiding proxy  */

    this.proxy = {
      then: this.then.bind(this)
    };
    /*  support optional executor function  */

    if (typeof executor === 'function') executor.call(this, this.fulfill.bind(this), this.reject.bind(this));
  };
  /*  promise API methods  */


  api.prototype = {
    /*  promise resolving methods  */
    fulfill: function fulfill(value) {
      return deliver(this, STATE_FULFILLED, 'fulfillValue', value);
    },
    reject: function reject(value) {
      return deliver(this, STATE_REJECTED, 'rejectReason', value);
    },

    /*  "The then Method" [Promises/A+ 1.1, 1.2, 2.2]  */
    then: function then(onFulfilled, onRejected) {
      var curr = this;
      var next = new api();
      /*  [Promises/A+ 2.2.7]  */

      curr.onFulfilled.push(resolver(onFulfilled, next, 'fulfill'));
      /*  [Promises/A+ 2.2.2/2.2.6]  */

      curr.onRejected.push(resolver(onRejected, next, 'reject'));
      /*  [Promises/A+ 2.2.3/2.2.6]  */

      execute(curr);
      return next.proxy;
      /*  [Promises/A+ 2.2.7, 3.3]  */
    }
  };
  /*  deliver an action  */

  var deliver = function deliver(curr, state, name, value) {
    if (curr.state === STATE_PENDING) {
      curr.state = state;
      /*  [Promises/A+ 2.1.2.1, 2.1.3.1]  */

      curr[name] = value;
      /*  [Promises/A+ 2.1.2.2, 2.1.3.2]  */

      execute(curr);
    }

    return curr;
  };
  /*  execute all handlers  */


  var execute = function execute(curr) {
    if (curr.state === STATE_FULFILLED) execute_handlers(curr, 'onFulfilled', curr.fulfillValue);else if (curr.state === STATE_REJECTED) execute_handlers(curr, 'onRejected', curr.rejectReason);
  };
  /*  execute particular set of handlers  */


  var execute_handlers = function execute_handlers(curr, name, value) {
    /* global setImmediate: true */

    /* global setTimeout: true */

    /*  short-circuit processing  */
    if (curr[name].length === 0) return;
    /*  iterate over all handlers, exactly once  */

    var handlers = curr[name];
    curr[name] = [];
    /*  [Promises/A+ 2.2.2.3, 2.2.3.3]  */

    var func = function func() {
      for (var i = 0; i < handlers.length; i++) {
        handlers[i](value);
      }
      /*  [Promises/A+ 2.2.5]  */

    };
    /*  execute procedure asynchronously  */

    /*  [Promises/A+ 2.2.4, 3.1]  */


    if (typeof setImmediate === 'function') setImmediate(func);else setTimeout(func, 0);
  };
  /*  generate a resolver function  */


  var resolver = function resolver(cb, next, method) {
    return function (value) {
      if (typeof cb !== 'function')
        /*  [Promises/A+ 2.2.1, 2.2.7.3, 2.2.7.4]  */
        next[method].call(next, value);
        /*  [Promises/A+ 2.2.7.3, 2.2.7.4]  */
      else {
          var result;

          try {
            result = cb(value);
          }
          /*  [Promises/A+ 2.2.2.1, 2.2.3.1, 2.2.5, 3.2]  */
          catch (e) {
            next.reject(e);
            /*  [Promises/A+ 2.2.7.2]  */

            return;
          }

          resolve(next, result);
          /*  [Promises/A+ 2.2.7.1]  */
        }
    };
  };
  /*  "Promise Resolution Procedure"  */

  /*  [Promises/A+ 2.3]  */


  var resolve = function resolve(promise, x) {
    /*  sanity check arguments  */

    /*  [Promises/A+ 2.3.1]  */
    if (promise === x || promise.proxy === x) {
      promise.reject(new TypeError('cannot resolve promise with itself'));
      return;
    }
    /*  surgically check for a "then" method
      (mainly to just call the "getter" of "then" only once)  */


    var then;

    if (_typeof(x) === 'object' && x !== null || typeof x === 'function') {
      try {
        then = x.then;
      }
      /*  [Promises/A+ 2.3.3.1, 3.5]  */
      catch (e) {
        promise.reject(e);
        /*  [Promises/A+ 2.3.3.2]  */

        return;
      }
    }
    /*  handle own Thenables    [Promises/A+ 2.3.2]
      and similar "thenables" [Promises/A+ 2.3.3]  */


    if (typeof then === 'function') {
      var resolved = false;

      try {
        /*  call retrieved "then" method */

        /*  [Promises/A+ 2.3.3.3]  */
        then.call(x,
        /*  resolvePromise  */

        /*  [Promises/A+ 2.3.3.3.1]  */
        function (y) {
          if (resolved) return;
          resolved = true;
          /*  [Promises/A+ 2.3.3.3.3]  */

          if (y === x)
            /*  [Promises/A+ 3.6]  */
            promise.reject(new TypeError('circular thenable chain'));else resolve(promise, y);
        },
        /*  rejectPromise  */

        /*  [Promises/A+ 2.3.3.3.2]  */
        function (r) {
          if (resolved) return;
          resolved = true;
          /*  [Promises/A+ 2.3.3.3.3]  */

          promise.reject(r);
        });
      } catch (e) {
        if (!resolved)
          /*  [Promises/A+ 2.3.3.3.3]  */
          promise.reject(e);
        /*  [Promises/A+ 2.3.3.3.4]  */
      }

      return;
    }
    /*  handle other values  */


    promise.fulfill(x);
    /*  [Promises/A+ 2.3.4, 2.3.3.4]  */
  }; // so we always have Promise.all()


  api.all = function (ps) {
    return new api(function (resolveAll, rejectAll) {
      var vals = new Array(ps.length);
      var doneCount = 0;

      var fulfill = function fulfill(i, val) {
        vals[i] = val;
        doneCount++;

        if (doneCount === ps.length) {
          resolveAll(vals);
        }
      };

      for (var i = 0; i < ps.length; i++) {
        (function (i) {
          var p = ps[i];
          var isPromise = p != null && p.then != null;

          if (isPromise) {
            p.then(function (val) {
              fulfill(i, val);
            }, function (err) {
              rejectAll(err);
            });
          } else {
            var val = p;
            fulfill(i, val);
          }
        })(i);
      }
    });
  };

  api.resolve = function (val) {
    return new api(function (resolve, reject) {
      resolve(val);
    });
  };

  api.reject = function (val) {
    return new api(function (resolve, reject) {
      reject(val);
    });
  };

  var Promise$1 = typeof Promise !== 'undefined' ? Promise : api; // eslint-disable-line no-undef

  var Animation = function Animation(target, opts, opts2) {
    var isCore = core(target);
    var isEle = !isCore;

    var _p = this._private = extend({
      duration: 1000
    }, opts, opts2);

    _p.target = target;
    _p.style = _p.style || _p.css;
    _p.started = false;
    _p.playing = false;
    _p.hooked = false;
    _p.applying = false;
    _p.progress = 0;
    _p.completes = [];
    _p.frames = [];

    if (_p.complete && fn(_p.complete)) {
      _p.completes.push(_p.complete);
    }

    if (isEle) {
      var pos = target.position();
      _p.startPosition = _p.startPosition || {
        x: pos.x,
        y: pos.y
      };
      _p.startStyle = _p.startStyle || target.cy().style().getAnimationStartStyle(target, _p.style);
    }

    if (isCore) {
      var pan = target.pan();
      _p.startPan = {
        x: pan.x,
        y: pan.y
      };
      _p.startZoom = target.zoom();
    } // for future timeline/animations impl


    this.length = 1;
    this[0] = this;
  };

  var anifn = Animation.prototype;
  extend(anifn, {
    instanceString: function instanceString() {
      return 'animation';
    },
    hook: function hook() {
      var _p = this._private;

      if (!_p.hooked) {
        // add to target's animation queue
        var q;
        var tAni = _p.target._private.animation;

        if (_p.queue) {
          q = tAni.queue;
        } else {
          q = tAni.current;
        }

        q.push(this); // add to the animation loop pool

        if (elementOrCollection(_p.target)) {
          _p.target.cy().addToAnimationPool(_p.target);
        }

        _p.hooked = true;
      }

      return this;
    },
    play: function play() {
      var _p = this._private; // autorewind

      if (_p.progress === 1) {
        _p.progress = 0;
      }

      _p.playing = true;
      _p.started = false; // needs to be started by animation loop

      _p.stopped = false;
      this.hook(); // the animation loop will start the animation...

      return this;
    },
    playing: function playing() {
      return this._private.playing;
    },
    apply: function apply() {
      var _p = this._private;
      _p.applying = true;
      _p.started = false; // needs to be started by animation loop

      _p.stopped = false;
      this.hook(); // the animation loop will apply the animation at this progress

      return this;
    },
    applying: function applying() {
      return this._private.applying;
    },
    pause: function pause() {
      var _p = this._private;
      _p.playing = false;
      _p.started = false;
      return this;
    },
    stop: function stop() {
      var _p = this._private;
      _p.playing = false;
      _p.started = false;
      _p.stopped = true; // to be removed from animation queues

      return this;
    },
    rewind: function rewind() {
      return this.progress(0);
    },
    fastforward: function fastforward() {
      return this.progress(1);
    },
    time: function time(t) {
      var _p = this._private;

      if (t === undefined) {
        return _p.progress * _p.duration;
      } else {
        return this.progress(t / _p.duration);
      }
    },
    progress: function progress(p) {
      var _p = this._private;
      var wasPlaying = _p.playing;

      if (p === undefined) {
        return _p.progress;
      } else {
        if (wasPlaying) {
          this.pause();
        }

        _p.progress = p;
        _p.started = false;

        if (wasPlaying) {
          this.play();
        }
      }

      return this;
    },
    completed: function completed() {
      return this._private.progress === 1;
    },
    reverse: function reverse() {
      var _p = this._private;
      var wasPlaying = _p.playing;

      if (wasPlaying) {
        this.pause();
      }

      _p.progress = 1 - _p.progress;
      _p.started = false;

      var swap = function swap(a, b) {
        var _pa = _p[a];

        if (_pa == null) {
          return;
        }

        _p[a] = _p[b];
        _p[b] = _pa;
      };

      swap('zoom', 'startZoom');
      swap('pan', 'startPan');
      swap('position', 'startPosition'); // swap styles

      if (_p.style) {
        for (var i = 0; i < _p.style.length; i++) {
          var prop = _p.style[i];
          var name = prop.name;
          var startStyleProp = _p.startStyle[name];
          _p.startStyle[name] = prop;
          _p.style[i] = startStyleProp;
        }
      }

      if (wasPlaying) {
        this.play();
      }

      return this;
    },
    promise: function promise(type) {
      var _p = this._private;
      var arr;

      switch (type) {
        case 'frame':
          arr = _p.frames;
          break;

        default:
        case 'complete':
        case 'completed':
          arr = _p.completes;
      }

      return new Promise$1(function (resolve, reject) {
        arr.push(function () {
          resolve();
        });
      });
    }
  });
  anifn.complete = anifn.completed;
  anifn.run = anifn.play;
  anifn.running = anifn.playing;

  var define = {
    animated: function animated() {
      return function animatedImpl() {
        var self = this;
        var selfIsArrayLike = self.length !== undefined;
        var all = selfIsArrayLike ? self : [self]; // put in array if not array-like

        var cy = this._private.cy || this;

        if (!cy.styleEnabled()) {
          return false;
        }

        var ele = all[0];

        if (ele) {
          return ele._private.animation.current.length > 0;
        }
      };
    },
    // animated
    clearQueue: function clearQueue() {
      return function clearQueueImpl() {
        var self = this;
        var selfIsArrayLike = self.length !== undefined;
        var all = selfIsArrayLike ? self : [self]; // put in array if not array-like

        var cy = this._private.cy || this;

        if (!cy.styleEnabled()) {
          return this;
        }

        for (var i = 0; i < all.length; i++) {
          var ele = all[i];
          ele._private.animation.queue = [];
        }

        return this;
      };
    },
    // clearQueue
    delay: function delay() {
      return function delayImpl(time, complete) {
        var cy = this._private.cy || this;

        if (!cy.styleEnabled()) {
          return this;
        }

        return this.animate({
          delay: time,
          duration: time,
          complete: complete
        });
      };
    },
    // delay
    delayAnimation: function delayAnimation() {
      return function delayAnimationImpl(time, complete) {
        var cy = this._private.cy || this;

        if (!cy.styleEnabled()) {
          return this;
        }

        return this.animation({
          delay: time,
          duration: time,
          complete: complete
        });
      };
    },
    // delay
    animation: function animation() {
      return function animationImpl(properties, params) {
        var self = this;
        var selfIsArrayLike = self.length !== undefined;
        var all = selfIsArrayLike ? self : [self]; // put in array if not array-like

        var cy = this._private.cy || this;
        var isCore = !selfIsArrayLike;
        var isEles = !isCore;

        if (!cy.styleEnabled()) {
          return this;
        }

        var style = cy.style();
        properties = extend({}, properties, params);
        var propertiesEmpty = Object.keys(properties).length === 0;

        if (propertiesEmpty) {
          return new Animation(all[0], properties); // nothing to animate
        }

        if (properties.duration === undefined) {
          properties.duration = 400;
        }

        switch (properties.duration) {
          case 'slow':
            properties.duration = 600;
            break;

          case 'fast':
            properties.duration = 200;
            break;
        }

        if (isEles) {
          properties.style = style.getPropsList(properties.style || properties.css);
          properties.css = undefined;
        }

        if (isEles && properties.renderedPosition != null) {
          var rpos = properties.renderedPosition;
          var pan = cy.pan();
          var zoom = cy.zoom();
          properties.position = renderedToModelPosition(rpos, zoom, pan);
        } // override pan w/ panBy if set


        if (isCore && properties.panBy != null) {
          var panBy = properties.panBy;
          var cyPan = cy.pan();
          properties.pan = {
            x: cyPan.x + panBy.x,
            y: cyPan.y + panBy.y
          };
        } // override pan w/ center if set


        var center = properties.center || properties.centre;

        if (isCore && center != null) {
          var centerPan = cy.getCenterPan(center.eles, properties.zoom);

          if (centerPan != null) {
            properties.pan = centerPan;
          }
        } // override pan & zoom w/ fit if set


        if (isCore && properties.fit != null) {
          var fit = properties.fit;
          var fitVp = cy.getFitViewport(fit.eles || fit.boundingBox, fit.padding);

          if (fitVp != null) {
            properties.pan = fitVp.pan;
            properties.zoom = fitVp.zoom;
          }
        } // override zoom (& potentially pan) w/ zoom obj if set


        if (isCore && plainObject(properties.zoom)) {
          var vp = cy.getZoomedViewport(properties.zoom);

          if (vp != null) {
            if (vp.zoomed) {
              properties.zoom = vp.zoom;
            }

            if (vp.panned) {
              properties.pan = vp.pan;
            }
          } else {
            properties.zoom = null; // an inavalid zoom (e.g. no delta) gets automatically destroyed
          }
        }

        return new Animation(all[0], properties);
      };
    },
    // animate
    animate: function animate() {
      return function animateImpl(properties, params) {
        var self = this;
        var selfIsArrayLike = self.length !== undefined;
        var all = selfIsArrayLike ? self : [self]; // put in array if not array-like

        var cy = this._private.cy || this;

        if (!cy.styleEnabled()) {
          return this;
        }

        if (params) {
          properties = extend({}, properties, params);
        } // manually hook and run the animation


        for (var i = 0; i < all.length; i++) {
          var ele = all[i];
          var queue = ele.animated() && (properties.queue === undefined || properties.queue);
          var ani = ele.animation(properties, queue ? {
            queue: true
          } : undefined);
          ani.play();
        }

        return this; // chaining
      };
    },
    // animate
    stop: function stop() {
      return function stopImpl(clearQueue, jumpToEnd) {
        var self = this;
        var selfIsArrayLike = self.length !== undefined;
        var all = selfIsArrayLike ? self : [self]; // put in array if not array-like

        var cy = this._private.cy || this;

        if (!cy.styleEnabled()) {
          return this;
        }

        for (var i = 0; i < all.length; i++) {
          var ele = all[i];
          var _p = ele._private;
          var anis = _p.animation.current;

          for (var j = 0; j < anis.length; j++) {
            var ani = anis[j];
            var ani_p = ani._private;

            if (jumpToEnd) {
              // next iteration of the animation loop, the animation
              // will go straight to the end and be removed
              ani_p.duration = 0;
            }
          } // clear the queue of future animations


          if (clearQueue) {
            _p.animation.queue = [];
          }

          if (!jumpToEnd) {
            _p.animation.current = [];
          }
        } // we have to notify (the animation loop doesn't do it for us on `stop`)


        cy.notify('draw');
        return this;
      };
    } // stop

  }; // define

  var define$1 = {
    // access data field
    data: function data(params) {
      var defaults = {
        field: 'data',
        bindingEvent: 'data',
        allowBinding: false,
        allowSetting: false,
        allowGetting: false,
        settingEvent: 'data',
        settingTriggersEvent: false,
        triggerFnName: 'trigger',
        immutableKeys: {},
        // key => true if immutable
        updateStyle: false,
        beforeGet: function beforeGet(self) {},
        beforeSet: function beforeSet(self, obj) {},
        onSet: function onSet(self) {},
        canSet: function canSet(self) {
          return true;
        }
      };
      params = extend({}, defaults, params);
      return function dataImpl(name, value) {
        var p = params;
        var self = this;
        var selfIsArrayLike = self.length !== undefined;
        var all = selfIsArrayLike ? self : [self]; // put in array if not array-like

        var single = selfIsArrayLike ? self[0] : self; // .data('foo', ...)

        if (string(name)) {
          // set or get property
          // .data('foo')
          if (p.allowGetting && value === undefined) {
            // get
            var ret;

            if (single) {
              p.beforeGet(single);
              ret = single._private[p.field][name];
            }

            return ret; // .data('foo', 'bar')
          } else if (p.allowSetting && value !== undefined) {
            // set
            var valid = !p.immutableKeys[name];

            if (valid) {
              var change = _defineProperty({}, name, value);

              p.beforeSet(self, change);

              for (var i = 0, l = all.length; i < l; i++) {
                var ele = all[i];

                if (p.canSet(ele)) {
                  ele._private[p.field][name] = value;
                }
              } // update mappers if asked


              if (p.updateStyle) {
                self.updateStyle();
              } // call onSet callback


              p.onSet(self);

              if (p.settingTriggersEvent) {
                self[p.triggerFnName](p.settingEvent);
              }
            }
          } // .data({ 'foo': 'bar' })

        } else if (p.allowSetting && plainObject(name)) {
          // extend
          var obj = name;
          var k, v;
          var keys = Object.keys(obj);
          p.beforeSet(self, obj);

          for (var _i = 0; _i < keys.length; _i++) {
            k = keys[_i];
            v = obj[k];

            var _valid = !p.immutableKeys[k];

            if (_valid) {
              for (var j = 0; j < all.length; j++) {
                var _ele = all[j];

                if (p.canSet(_ele)) {
                  _ele._private[p.field][k] = v;
                }
              }
            }
          } // update mappers if asked


          if (p.updateStyle) {
            self.updateStyle();
          } // call onSet callback


          p.onSet(self);

          if (p.settingTriggersEvent) {
            self[p.triggerFnName](p.settingEvent);
          } // .data(function(){ ... })

        } else if (p.allowBinding && fn(name)) {
          // bind to event
          var fn$1 = name;
          self.on(p.bindingEvent, fn$1); // .data()
        } else if (p.allowGetting && name === undefined) {
          // get whole object
          var _ret;

          if (single) {
            p.beforeGet(single);
            _ret = single._private[p.field];
          }

          return _ret;
        }

        return self; // maintain chainability
      }; // function
    },
    // data
    // remove data field
    removeData: function removeData(params) {
      var defaults = {
        field: 'data',
        event: 'data',
        triggerFnName: 'trigger',
        triggerEvent: false,
        immutableKeys: {} // key => true if immutable

      };
      params = extend({}, defaults, params);
      return function removeDataImpl(names) {
        var p = params;
        var self = this;
        var selfIsArrayLike = self.length !== undefined;
        var all = selfIsArrayLike ? self : [self]; // put in array if not array-like
        // .removeData('foo bar')

        if (string(names)) {
          // then get the list of keys, and delete them
          var keys = names.split(/\s+/);
          var l = keys.length;

          for (var i = 0; i < l; i++) {
            // delete each non-empty key
            var key = keys[i];

            if (emptyString(key)) {
              continue;
            }

            var valid = !p.immutableKeys[key]; // not valid if immutable

            if (valid) {
              for (var i_a = 0, l_a = all.length; i_a < l_a; i_a++) {
                all[i_a]._private[p.field][key] = undefined;
              }
            }
          }

          if (p.triggerEvent) {
            self[p.triggerFnName](p.event);
          } // .removeData()

        } else if (names === undefined) {
          // then delete all keys
          for (var _i_a = 0, _l_a = all.length; _i_a < _l_a; _i_a++) {
            var _privateFields = all[_i_a]._private[p.field];

            var _keys = Object.keys(_privateFields);

            for (var _i2 = 0; _i2 < _keys.length; _i2++) {
              var _key = _keys[_i2];
              var validKeyToDelete = !p.immutableKeys[_key];

              if (validKeyToDelete) {
                _privateFields[_key] = undefined;
              }
            }
          }

          if (p.triggerEvent) {
            self[p.triggerFnName](p.event);
          }
        }

        return self; // maintain chaining
      }; // function
    } // removeData

  }; // define

  var define$2 = {
    eventAliasesOn: function eventAliasesOn(proto) {
      var p = proto;
      p.addListener = p.listen = p.bind = p.on;
      p.unlisten = p.unbind = p.off = p.removeListener;
      p.trigger = p.emit; // this is just a wrapper alias of .on()

      p.pon = p.promiseOn = function (events, selector) {
        var self = this;
        var args = Array.prototype.slice.call(arguments, 0);
        return new Promise$1(function (resolve, reject) {
          var callback = function callback(e) {
            self.off.apply(self, offArgs);
            resolve(e);
          };

          var onArgs = args.concat([callback]);
          var offArgs = onArgs.concat([]);
          self.on.apply(self, onArgs);
        });
      };
    }
  }; // define

  // use this module to cherry pick functions into your prototype
  var define$3 = {};
  [define, define$1, define$2].forEach(function (m) {
    extend(define$3, m);
  });

  var elesfn$d = {
    animate: define$3.animate(),
    animation: define$3.animation(),
    animated: define$3.animated(),
    clearQueue: define$3.clearQueue(),
    delay: define$3.delay(),
    delayAnimation: define$3.delayAnimation(),
    stop: define$3.stop()
  };

  var elesfn$e = {
    classes: function classes(_classes) {
      var self = this;

      if (_classes === undefined) {
        var ret = [];

        self[0]._private.classes.forEach(function (cls) {
          return ret.push(cls);
        });

        return ret;
      } else if (!array(_classes)) {
        // extract classes from string
        _classes = (_classes || '').match(/\S+/g) || [];
      }

      var changed = [];
      var classesSet = new Set$1(_classes); // check and update each ele

      for (var j = 0; j < self.length; j++) {
        var ele = self[j];
        var _p = ele._private;
        var eleClasses = _p.classes;
        var changedEle = false; // check if ele has all of the passed classes

        for (var i = 0; i < _classes.length; i++) {
          var cls = _classes[i];
          var eleHasClass = eleClasses.has(cls);

          if (!eleHasClass) {
            changedEle = true;
            break;
          }
        } // check if ele has classes outside of those passed


        if (!changedEle) {
          changedEle = eleClasses.size !== _classes.length;
        }

        if (changedEle) {
          _p.classes = classesSet;
          changed.push(ele);
        }
      } // trigger update style on those eles that had class changes


      if (changed.length > 0) {
        this.spawn(changed).updateStyle().emit('class');
      }

      return self;
    },
    addClass: function addClass(classes) {
      return this.toggleClass(classes, true);
    },
    hasClass: function hasClass(className) {
      var ele = this[0];
      return ele != null && ele._private.classes.has(className);
    },
    toggleClass: function toggleClass(classes, toggle) {
      if (!array(classes)) {
        // extract classes from string
        classes = classes.match(/\S+/g) || [];
      }

      var self = this;
      var toggleUndefd = toggle === undefined;
      var changed = []; // eles who had classes changed

      for (var i = 0, il = self.length; i < il; i++) {
        var ele = self[i];
        var eleClasses = ele._private.classes;
        var changedEle = false;

        for (var j = 0; j < classes.length; j++) {
          var cls = classes[j];
          var hasClass = eleClasses.has(cls);
          var changedNow = false;

          if (toggle || toggleUndefd && !hasClass) {
            eleClasses.add(cls);
            changedNow = true;
          } else if (!toggle || toggleUndefd && hasClass) {
            eleClasses["delete"](cls);
            changedNow = true;
          }

          if (!changedEle && changedNow) {
            changed.push(ele);
            changedEle = true;
          }
        } // for j classes

      } // for i eles
      // trigger update style on those eles that had class changes


      if (changed.length > 0) {
        this.spawn(changed).updateStyle().emit('class');
      }

      return self;
    },
    removeClass: function removeClass(classes) {
      return this.toggleClass(classes, false);
    },
    flashClass: function flashClass(classes, duration) {
      var self = this;

      if (duration == null) {
        duration = 250;
      } else if (duration === 0) {
        return self; // nothing to do really
      }

      self.addClass(classes);
      setTimeout(function () {
        self.removeClass(classes);
      }, duration);
      return self;
    }
  };
  elesfn$e.className = elesfn$e.classNames = elesfn$e.classes;

  var tokens = {
    metaChar: '[\\!\\"\\#\\$\\%\\&\\\'\\(\\)\\*\\+\\,\\.\\/\\:\\;\\<\\=\\>\\?\\@\\[\\]\\^\\`\\{\\|\\}\\~]',
    // chars we need to escape in let names, etc
    comparatorOp: '=|\\!=|>|>=|<|<=|\\$=|\\^=|\\*=',
    // binary comparison op (used in data selectors)
    boolOp: '\\?|\\!|\\^',
    // boolean (unary) operators (used in data selectors)
    string: '"(?:\\\\"|[^"])*"' + '|' + "'(?:\\\\'|[^'])*'",
    // string literals (used in data selectors) -- doublequotes | singlequotes
    number: number$1,
    // number literal (used in data selectors) --- e.g. 0.1234, 1234, 12e123
    meta: 'degree|indegree|outdegree',
    // allowed metadata fields (i.e. allowed functions to use from Collection)
    separator: '\\s*,\\s*',
    // queries are separated by commas, e.g. edge[foo = 'bar'], node.someClass
    descendant: '\\s+',
    child: '\\s+>\\s+',
    subject: '\\$',
    group: 'node|edge|\\*',
    directedEdge: '\\s+->\\s+',
    undirectedEdge: '\\s+<->\\s+'
  };
  tokens.variable = '(?:[\\w-]|(?:\\\\' + tokens.metaChar + '))+'; // a variable name

  tokens.value = tokens.string + '|' + tokens.number; // a value literal, either a string or number

  tokens.className = tokens.variable; // a class name (follows variable conventions)

  tokens.id = tokens.variable; // an element id (follows variable conventions)

  (function () {
    var ops, op, i; // add @ variants to comparatorOp

    ops = tokens.comparatorOp.split('|');

    for (i = 0; i < ops.length; i++) {
      op = ops[i];
      tokens.comparatorOp += '|@' + op;
    } // add ! variants to comparatorOp


    ops = tokens.comparatorOp.split('|');

    for (i = 0; i < ops.length; i++) {
      op = ops[i];

      if (op.indexOf('!') >= 0) {
        continue;
      } // skip ops that explicitly contain !


      if (op === '=') {
        continue;
      } // skip = b/c != is explicitly defined


      tokens.comparatorOp += '|\\!' + op;
    }
  })();

  /**
   * Make a new query object
   *
   * @prop type {Type} The type enum (int) of the query
   * @prop checks List of checks to make against an ele to test for a match
   */
  var newQuery = function newQuery() {
    return {
      checks: []
    };
  };

  /**
   * A check type enum-like object.  Uses integer values for fast match() lookup.
   * The ordering does not matter as long as the ints are unique.
   */
  var Type = {
    /** E.g. node */
    GROUP: 0,

    /** A collection of elements */
    COLLECTION: 1,

    /** A filter(ele) function */
    FILTER: 2,

    /** E.g. [foo > 1] */
    DATA_COMPARE: 3,

    /** E.g. [foo] */
    DATA_EXIST: 4,

    /** E.g. [?foo] */
    DATA_BOOL: 5,

    /** E.g. [[degree > 2]] */
    META_COMPARE: 6,

    /** E.g. :selected */
    STATE: 7,

    /** E.g. #foo */
    ID: 8,

    /** E.g. .foo */
    CLASS: 9,

    /** E.g. #foo <-> #bar */
    UNDIRECTED_EDGE: 10,

    /** E.g. #foo -> #bar */
    DIRECTED_EDGE: 11,

    /** E.g. $#foo -> #bar */
    NODE_SOURCE: 12,

    /** E.g. #foo -> $#bar */
    NODE_TARGET: 13,

    /** E.g. $#foo <-> #bar */
    NODE_NEIGHBOR: 14,

    /** E.g. #foo > #bar */
    CHILD: 15,

    /** E.g. #foo #bar */
    DESCENDANT: 16,

    /** E.g. $#foo > #bar */
    PARENT: 17,

    /** E.g. $#foo #bar */
    ANCESTOR: 18,

    /** E.g. #foo > $bar > #baz */
    COMPOUND_SPLIT: 19,

    /** Always matches, useful placeholder for subject in `COMPOUND_SPLIT` */
    TRUE: 20
  };

  var stateSelectors = [{
    selector: ':selected',
    matches: function matches(ele) {
      return ele.selected();
    }
  }, {
    selector: ':unselected',
    matches: function matches(ele) {
      return !ele.selected();
    }
  }, {
    selector: ':selectable',
    matches: function matches(ele) {
      return ele.selectable();
    }
  }, {
    selector: ':unselectable',
    matches: function matches(ele) {
      return !ele.selectable();
    }
  }, {
    selector: ':locked',
    matches: function matches(ele) {
      return ele.locked();
    }
  }, {
    selector: ':unlocked',
    matches: function matches(ele) {
      return !ele.locked();
    }
  }, {
    selector: ':visible',
    matches: function matches(ele) {
      return ele.visible();
    }
  }, {
    selector: ':hidden',
    matches: function matches(ele) {
      return !ele.visible();
    }
  }, {
    selector: ':transparent',
    matches: function matches(ele) {
      return ele.transparent();
    }
  }, {
    selector: ':grabbed',
    matches: function matches(ele) {
      return ele.grabbed();
    }
  }, {
    selector: ':free',
    matches: function matches(ele) {
      return !ele.grabbed();
    }
  }, {
    selector: ':removed',
    matches: function matches(ele) {
      return ele.removed();
    }
  }, {
    selector: ':inside',
    matches: function matches(ele) {
      return !ele.removed();
    }
  }, {
    selector: ':grabbable',
    matches: function matches(ele) {
      return ele.grabbable();
    }
  }, {
    selector: ':ungrabbable',
    matches: function matches(ele) {
      return !ele.grabbable();
    }
  }, {
    selector: ':animated',
    matches: function matches(ele) {
      return ele.animated();
    }
  }, {
    selector: ':unanimated',
    matches: function matches(ele) {
      return !ele.animated();
    }
  }, {
    selector: ':parent',
    matches: function matches(ele) {
      return ele.isParent();
    }
  }, {
    selector: ':childless',
    matches: function matches(ele) {
      return ele.isChildless();
    }
  }, {
    selector: ':child',
    matches: function matches(ele) {
      return ele.isChild();
    }
  }, {
    selector: ':orphan',
    matches: function matches(ele) {
      return ele.isOrphan();
    }
  }, {
    selector: ':nonorphan',
    matches: function matches(ele) {
      return ele.isChild();
    }
  }, {
    selector: ':compound',
    matches: function matches(ele) {
      if (ele.isNode()) {
        return ele.isParent();
      } else {
        return ele.source().isParent() || ele.target().isParent();
      }
    }
  }, {
    selector: ':loop',
    matches: function matches(ele) {
      return ele.isLoop();
    }
  }, {
    selector: ':simple',
    matches: function matches(ele) {
      return ele.isSimple();
    }
  }, {
    selector: ':active',
    matches: function matches(ele) {
      return ele.active();
    }
  }, {
    selector: ':inactive',
    matches: function matches(ele) {
      return !ele.active();
    }
  }, {
    selector: ':backgrounding',
    matches: function matches(ele) {
      return ele.backgrounding();
    }
  }, {
    selector: ':nonbackgrounding',
    matches: function matches(ele) {
      return !ele.backgrounding();
    }
  }].sort(function (a, b) {
    // n.b. selectors that are starting substrings of others must have the longer ones first
    return descending(a.selector, b.selector);
  });

  var lookup = function () {
    var selToFn = {};
    var s;

    for (var i = 0; i < stateSelectors.length; i++) {
      s = stateSelectors[i];
      selToFn[s.selector] = s.matches;
    }

    return selToFn;
  }();

  var stateSelectorMatches = function stateSelectorMatches(sel, ele) {
    return lookup[sel](ele);
  };
  var stateSelectorRegex = '(' + stateSelectors.map(function (s) {
    return s.selector;
  }).join('|') + ')';

  // so that values get compared properly in Selector.filter()

  var cleanMetaChars = function cleanMetaChars(str) {
    return str.replace(new RegExp('\\\\(' + tokens.metaChar + ')', 'g'), function (match, $1) {
      return $1;
    });
  };

  var replaceLastQuery = function replaceLastQuery(selector, examiningQuery, replacementQuery) {
    selector[selector.length - 1] = replacementQuery;
  }; // NOTE: add new expression syntax here to have it recognised by the parser;
  // - a query contains all adjacent (i.e. no separator in between) expressions;
  // - the current query is stored in selector[i]
  // - you need to check the query objects in match() for it actually filter properly, but that's pretty straight forward


  var exprs = [{
    name: 'group',
    // just used for identifying when debugging
    query: true,
    regex: '(' + tokens.group + ')',
    populate: function populate(selector, query, _ref) {
      var _ref2 = _slicedToArray(_ref, 1),
          group = _ref2[0];

      query.checks.push({
        type: Type.GROUP,
        value: group === '*' ? group : group + 's'
      });
    }
  }, {
    name: 'state',
    query: true,
    regex: stateSelectorRegex,
    populate: function populate(selector, query, _ref3) {
      var _ref4 = _slicedToArray(_ref3, 1),
          state = _ref4[0];

      query.checks.push({
        type: Type.STATE,
        value: state
      });
    }
  }, {
    name: 'id',
    query: true,
    regex: '\\#(' + tokens.id + ')',
    populate: function populate(selector, query, _ref5) {
      var _ref6 = _slicedToArray(_ref5, 1),
          id = _ref6[0];

      query.checks.push({
        type: Type.ID,
        value: cleanMetaChars(id)
      });
    }
  }, {
    name: 'className',
    query: true,
    regex: '\\.(' + tokens.className + ')',
    populate: function populate(selector, query, _ref7) {
      var _ref8 = _slicedToArray(_ref7, 1),
          className = _ref8[0];

      query.checks.push({
        type: Type.CLASS,
        value: cleanMetaChars(className)
      });
    }
  }, {
    name: 'dataExists',
    query: true,
    regex: '\\[\\s*(' + tokens.variable + ')\\s*\\]',
    populate: function populate(selector, query, _ref9) {
      var _ref10 = _slicedToArray(_ref9, 1),
          variable = _ref10[0];

      query.checks.push({
        type: Type.DATA_EXIST,
        field: cleanMetaChars(variable)
      });
    }
  }, {
    name: 'dataCompare',
    query: true,
    regex: '\\[\\s*(' + tokens.variable + ')\\s*(' + tokens.comparatorOp + ')\\s*(' + tokens.value + ')\\s*\\]',
    populate: function populate(selector, query, _ref11) {
      var _ref12 = _slicedToArray(_ref11, 3),
          variable = _ref12[0],
          comparatorOp = _ref12[1],
          value = _ref12[2];

      var valueIsString = new RegExp('^' + tokens.string + '$').exec(value) != null;

      if (valueIsString) {
        value = value.substring(1, value.length - 1);
      } else {
        value = parseFloat(value);
      }

      query.checks.push({
        type: Type.DATA_COMPARE,
        field: cleanMetaChars(variable),
        operator: comparatorOp,
        value: value
      });
    }
  }, {
    name: 'dataBool',
    query: true,
    regex: '\\[\\s*(' + tokens.boolOp + ')\\s*(' + tokens.variable + ')\\s*\\]',
    populate: function populate(selector, query, _ref13) {
      var _ref14 = _slicedToArray(_ref13, 2),
          boolOp = _ref14[0],
          variable = _ref14[1];

      query.checks.push({
        type: Type.DATA_BOOL,
        field: cleanMetaChars(variable),
        operator: boolOp
      });
    }
  }, {
    name: 'metaCompare',
    query: true,
    regex: '\\[\\[\\s*(' + tokens.meta + ')\\s*(' + tokens.comparatorOp + ')\\s*(' + tokens.number + ')\\s*\\]\\]',
    populate: function populate(selector, query, _ref15) {
      var _ref16 = _slicedToArray(_ref15, 3),
          meta = _ref16[0],
          comparatorOp = _ref16[1],
          number = _ref16[2];

      query.checks.push({
        type: Type.META_COMPARE,
        field: cleanMetaChars(meta),
        operator: comparatorOp,
        value: parseFloat(number)
      });
    }
  }, {
    name: 'nextQuery',
    separator: true,
    regex: tokens.separator,
    populate: function populate(selector, query) {
      var currentSubject = selector.currentSubject;
      var edgeCount = selector.edgeCount;
      var compoundCount = selector.compoundCount;
      var lastQ = selector[selector.length - 1];

      if (currentSubject != null) {
        lastQ.subject = currentSubject;
        selector.currentSubject = null;
      }

      lastQ.edgeCount = edgeCount;
      lastQ.compoundCount = compoundCount;
      selector.edgeCount = 0;
      selector.compoundCount = 0; // go on to next query

      var nextQuery = selector[selector.length++] = newQuery();
      return nextQuery; // this is the new query to be filled by the following exprs
    }
  }, {
    name: 'directedEdge',
    separator: true,
    regex: tokens.directedEdge,
    populate: function populate(selector, query) {
      if (selector.currentSubject == null) {
        // undirected edge
        var edgeQuery = newQuery();
        var source = query;
        var target = newQuery();
        edgeQuery.checks.push({
          type: Type.DIRECTED_EDGE,
          source: source,
          target: target
        }); // the query in the selector should be the edge rather than the source

        replaceLastQuery(selector, query, edgeQuery);
        selector.edgeCount++; // we're now populating the target query with expressions that follow

        return target;
      } else {
        // source/target
        var srcTgtQ = newQuery();
        var _source = query;

        var _target = newQuery();

        srcTgtQ.checks.push({
          type: Type.NODE_SOURCE,
          source: _source,
          target: _target
        }); // the query in the selector should be the neighbourhood rather than the node

        replaceLastQuery(selector, query, srcTgtQ);
        selector.edgeCount++;
        return _target; // now populating the target with the following expressions
      }
    }
  }, {
    name: 'undirectedEdge',
    separator: true,
    regex: tokens.undirectedEdge,
    populate: function populate(selector, query) {
      if (selector.currentSubject == null) {
        // undirected edge
        var edgeQuery = newQuery();
        var source = query;
        var target = newQuery();
        edgeQuery.checks.push({
          type: Type.UNDIRECTED_EDGE,
          nodes: [source, target]
        }); // the query in the selector should be the edge rather than the source

        replaceLastQuery(selector, query, edgeQuery);
        selector.edgeCount++; // we're now populating the target query with expressions that follow

        return target;
      } else {
        // neighbourhood
        var nhoodQ = newQuery();
        var node = query;
        var neighbor = newQuery();
        nhoodQ.checks.push({
          type: Type.NODE_NEIGHBOR,
          node: node,
          neighbor: neighbor
        }); // the query in the selector should be the neighbourhood rather than the node

        replaceLastQuery(selector, query, nhoodQ);
        return neighbor; // now populating the neighbor with following expressions
      }
    }
  }, {
    name: 'child',
    separator: true,
    regex: tokens.child,
    populate: function populate(selector, query) {
      if (selector.currentSubject == null) {
        // default: child query
        var parentChildQuery = newQuery();
        var child = newQuery();
        var parent = selector[selector.length - 1];
        parentChildQuery.checks.push({
          type: Type.CHILD,
          parent: parent,
          child: child
        }); // the query in the selector should be the '>' itself

        replaceLastQuery(selector, query, parentChildQuery);
        selector.compoundCount++; // we're now populating the child query with expressions that follow

        return child;
      } else if (selector.currentSubject === query) {
        // compound split query
        var compound = newQuery();
        var left = selector[selector.length - 1];
        var right = newQuery();
        var subject = newQuery();

        var _child = newQuery();

        var _parent = newQuery(); // set up the root compound q


        compound.checks.push({
          type: Type.COMPOUND_SPLIT,
          left: left,
          right: right,
          subject: subject
        }); // populate the subject and replace the q at the old spot (within left) with TRUE

        subject.checks = query.checks; // take the checks from the left

        query.checks = [{
          type: Type.TRUE
        }]; // checks under left refs the subject implicitly
        // set up the right q

        _parent.checks.push({
          type: Type.TRUE
        }); // parent implicitly refs the subject


        right.checks.push({
          type: Type.PARENT,
          // type is swapped on right side queries
          parent: _parent,
          child: _child // empty for now

        });
        replaceLastQuery(selector, left, compound); // update the ref since we moved things around for `query`

        selector.currentSubject = subject;
        selector.compoundCount++;
        return _child; // now populating the right side's child
      } else {
        // parent query
        // info for parent query
        var _parent2 = newQuery();

        var _child2 = newQuery();

        var pcQChecks = [{
          type: Type.PARENT,
          parent: _parent2,
          child: _child2
        }]; // the parent-child query takes the place of the query previously being populated

        _parent2.checks = query.checks; // the previous query contains the checks for the parent

        query.checks = pcQChecks; // pc query takes over

        selector.compoundCount++;
        return _child2; // we're now populating the child
      }
    }
  }, {
    name: 'descendant',
    separator: true,
    regex: tokens.descendant,
    populate: function populate(selector, query) {
      if (selector.currentSubject == null) {
        // default: descendant query
        var ancChQuery = newQuery();
        var descendant = newQuery();
        var ancestor = selector[selector.length - 1];
        ancChQuery.checks.push({
          type: Type.DESCENDANT,
          ancestor: ancestor,
          descendant: descendant
        }); // the query in the selector should be the '>' itself

        replaceLastQuery(selector, query, ancChQuery);
        selector.compoundCount++; // we're now populating the descendant query with expressions that follow

        return descendant;
      } else if (selector.currentSubject === query) {
        // compound split query
        var compound = newQuery();
        var left = selector[selector.length - 1];
        var right = newQuery();
        var subject = newQuery();

        var _descendant = newQuery();

        var _ancestor = newQuery(); // set up the root compound q


        compound.checks.push({
          type: Type.COMPOUND_SPLIT,
          left: left,
          right: right,
          subject: subject
        }); // populate the subject and replace the q at the old spot (within left) with TRUE

        subject.checks = query.checks; // take the checks from the left

        query.checks = [{
          type: Type.TRUE
        }]; // checks under left refs the subject implicitly
        // set up the right q

        _ancestor.checks.push({
          type: Type.TRUE
        }); // ancestor implicitly refs the subject


        right.checks.push({
          type: Type.ANCESTOR,
          // type is swapped on right side queries
          ancestor: _ancestor,
          descendant: _descendant // empty for now

        });
        replaceLastQuery(selector, left, compound); // update the ref since we moved things around for `query`

        selector.currentSubject = subject;
        selector.compoundCount++;
        return _descendant; // now populating the right side's descendant
      } else {
        // ancestor query
        // info for parent query
        var _ancestor2 = newQuery();

        var _descendant2 = newQuery();

        var adQChecks = [{
          type: Type.ANCESTOR,
          ancestor: _ancestor2,
          descendant: _descendant2
        }]; // the parent-child query takes the place of the query previously being populated

        _ancestor2.checks = query.checks; // the previous query contains the checks for the parent

        query.checks = adQChecks; // pc query takes over

        selector.compoundCount++;
        return _descendant2; // we're now populating the child
      }
    }
  }, {
    name: 'subject',
    modifier: true,
    regex: tokens.subject,
    populate: function populate(selector, query) {
      if (selector.currentSubject != null && selector.currentSubject !== query) {
        warn('Redefinition of subject in selector `' + selector.toString() + '`');
        return false;
      }

      selector.currentSubject = query;
      var topQ = selector[selector.length - 1];
      var topChk = topQ.checks[0];
      var topType = topChk == null ? null : topChk.type;

      if (topType === Type.DIRECTED_EDGE) {
        // directed edge with subject on the target
        // change to target node check
        topChk.type = Type.NODE_TARGET;
      } else if (topType === Type.UNDIRECTED_EDGE) {
        // undirected edge with subject on the second node
        // change to neighbor check
        topChk.type = Type.NODE_NEIGHBOR;
        topChk.node = topChk.nodes[1]; // second node is subject

        topChk.neighbor = topChk.nodes[0]; // clean up unused fields for new type

        topChk.nodes = null;
      }
    }
  }];
  exprs.forEach(function (e) {
    return e.regexObj = new RegExp('^' + e.regex);
  });

  /**
   * Of all the expressions, find the first match in the remaining text.
   * @param {string} remaining The remaining text to parse
   * @returns The matched expression and the newly remaining text `{ expr, match, name, remaining }`
   */

  var consumeExpr = function consumeExpr(remaining) {
    var expr;
    var match;
    var name;

    for (var j = 0; j < exprs.length; j++) {
      var e = exprs[j];
      var n = e.name;
      var m = remaining.match(e.regexObj);

      if (m != null) {
        match = m;
        expr = e;
        name = n;
        var consumed = m[0];
        remaining = remaining.substring(consumed.length);
        break; // we've consumed one expr, so we can return now
      }
    }

    return {
      expr: expr,
      match: match,
      name: name,
      remaining: remaining
    };
  };
  /**
   * Consume all the leading whitespace
   * @param {string} remaining The text to consume
   * @returns The text with the leading whitespace removed
   */


  var consumeWhitespace = function consumeWhitespace(remaining) {
    var match = remaining.match(/^\s+/);

    if (match) {
      var consumed = match[0];
      remaining = remaining.substring(consumed.length);
    }

    return remaining;
  };
  /**
   * Parse the string and store the parsed representation in the Selector.
   * @param {string} selector The selector string
   * @returns `true` if the selector was successfully parsed, `false` otherwise
   */


  var parse = function parse(selector) {
    var self = this;
    var remaining = self.inputText = selector;
    var currentQuery = self[0] = newQuery();
    self.length = 1;
    remaining = consumeWhitespace(remaining); // get rid of leading whitespace

    for (;;) {
      var exprInfo = consumeExpr(remaining);

      if (exprInfo.expr == null) {
        warn('The selector `' + selector + '`is invalid');
        return false;
      } else {
        var args = exprInfo.match.slice(1); // let the token populate the selector object in currentQuery

        var ret = exprInfo.expr.populate(self, currentQuery, args);

        if (ret === false) {
          return false; // exit if population failed
        } else if (ret != null) {
          currentQuery = ret; // change the current query to be filled if the expr specifies
        }
      }

      remaining = exprInfo.remaining; // we're done when there's nothing left to parse

      if (remaining.match(/^\s*$/)) {
        break;
      }
    }

    var lastQ = self[self.length - 1];

    if (self.currentSubject != null) {
      lastQ.subject = self.currentSubject;
    }

    lastQ.edgeCount = self.edgeCount;
    lastQ.compoundCount = self.compoundCount;

    for (var i = 0; i < self.length; i++) {
      var q = self[i]; // in future, this could potentially be allowed if there were operator precedence and detection of invalid combinations

      if (q.compoundCount > 0 && q.edgeCount > 0) {
        warn('The selector `' + selector + '` is invalid because it uses both a compound selector and an edge selector');
        return false;
      }

      if (q.edgeCount > 1) {
        warn('The selector `' + selector + '` is invalid because it uses multiple edge selectors');
        return false;
      } else if (q.edgeCount === 1) {
        warn('The selector `' + selector + '` is deprecated.  Edge selectors do not take effect on changes to source and target nodes after an edge is added, for performance reasons.  Use a class or data selector on edges instead, updating the class or data of an edge when your app detects a change in source or target nodes.');
      }
    }

    return true; // success
  };
  /**
   * Get the selector represented as a string.  This value uses default formatting,
   * so things like spacing may differ from the input text passed to the constructor.
   * @returns {string} The selector string
   */


  var toString = function toString() {
    if (this.toStringCache != null) {
      return this.toStringCache;
    }

    var clean = function clean(obj) {
      if (obj == null) {
        return '';
      } else {
        return obj;
      }
    };

    var cleanVal = function cleanVal(val) {
      if (string(val)) {
        return '"' + val + '"';
      } else {
        return clean(val);
      }
    };

    var space = function space(val) {
      return ' ' + val + ' ';
    };

    var checkToString = function checkToString(check, subject) {
      var type = check.type,
          value = check.value;

      switch (type) {
        case Type.GROUP:
          {
            var group = clean(value);
            return group.substring(0, group.length - 1);
          }

        case Type.DATA_COMPARE:
          {
            var field = check.field,
                operator = check.operator;
            return '[' + field + space(clean(operator)) + cleanVal(value) + ']';
          }

        case Type.DATA_BOOL:
          {
            var _operator = check.operator,
                _field = check.field;
            return '[' + clean(_operator) + _field + ']';
          }

        case Type.DATA_EXIST:
          {
            var _field2 = check.field;
            return '[' + _field2 + ']';
          }

        case Type.META_COMPARE:
          {
            var _operator2 = check.operator,
                _field3 = check.field;
            return '[[' + _field3 + space(clean(_operator2)) + cleanVal(value) + ']]';
          }

        case Type.STATE:
          {
            return value;
          }

        case Type.ID:
          {
            return '#' + value;
          }

        case Type.CLASS:
          {
            return '.' + value;
          }

        case Type.PARENT:
        case Type.CHILD:
          {
            return queryToString(check.parent, subject) + space('>') + queryToString(check.child, subject);
          }

        case Type.ANCESTOR:
        case Type.DESCENDANT:
          {
            return queryToString(check.ancestor, subject) + ' ' + queryToString(check.descendant, subject);
          }

        case Type.COMPOUND_SPLIT:
          {
            var lhs = queryToString(check.left, subject);
            var sub = queryToString(check.subject, subject);
            var rhs = queryToString(check.right, subject);
            return lhs + (lhs.length > 0 ? ' ' : '') + sub + rhs;
          }

        case Type.TRUE:
          {
            return '';
          }
      }
    };

    var queryToString = function queryToString(query, subject) {
      return query.checks.reduce(function (str, chk, i) {
        return str + (subject === query && i === 0 ? '$' : '') + checkToString(chk, subject);
      }, '');
    };

    var str = '';

    for (var i = 0; i < this.length; i++) {
      var query = this[i];
      str += queryToString(query, query.subject);

      if (this.length > 1 && i < this.length - 1) {
        str += ', ';
      }
    }

    this.toStringCache = str;
    return str;
  };
  var parse$1 = {
    parse: parse,
    toString: toString
  };

  var valCmp = function valCmp(fieldVal, operator, value) {
    var matches;
    var isFieldStr = string(fieldVal);
    var isFieldNum = number(fieldVal);
    var isValStr = string(value);
    var fieldStr, valStr;
    var caseInsensitive = false;
    var notExpr = false;
    var isIneqCmp = false;

    if (operator.indexOf('!') >= 0) {
      operator = operator.replace('!', '');
      notExpr = true;
    }

    if (operator.indexOf('@') >= 0) {
      operator = operator.replace('@', '');
      caseInsensitive = true;
    }

    if (isFieldStr || isValStr || caseInsensitive) {
      fieldStr = !isFieldStr && !isFieldNum ? '' : '' + fieldVal;
      valStr = '' + value;
    } // if we're doing a case insensitive comparison, then we're using a STRING comparison
    // even if we're comparing numbers


    if (caseInsensitive) {
      fieldVal = fieldStr = fieldStr.toLowerCase();
      value = valStr = valStr.toLowerCase();
    }

    switch (operator) {
      case '*=':
        matches = fieldStr.indexOf(valStr) >= 0;
        break;

      case '$=':
        matches = fieldStr.indexOf(valStr, fieldStr.length - valStr.length) >= 0;
        break;

      case '^=':
        matches = fieldStr.indexOf(valStr) === 0;
        break;

      case '=':
        matches = fieldVal === value;
        break;

      case '>':
        isIneqCmp = true;
        matches = fieldVal > value;
        break;

      case '>=':
        isIneqCmp = true;
        matches = fieldVal >= value;
        break;

      case '<':
        isIneqCmp = true;
        matches = fieldVal < value;
        break;

      case '<=':
        isIneqCmp = true;
        matches = fieldVal <= value;
        break;

      default:
        matches = false;
        break;
    } // apply the not op, but null vals for inequalities should always stay non-matching


    if (notExpr && (fieldVal != null || !isIneqCmp)) {
      matches = !matches;
    }

    return matches;
  };
  var boolCmp = function boolCmp(fieldVal, operator) {
    switch (operator) {
      case '?':
        return fieldVal ? true : false;

      case '!':
        return fieldVal ? false : true;

      case '^':
        return fieldVal === undefined;
    }
  };
  var existCmp = function existCmp(fieldVal) {
    return fieldVal !== undefined;
  };
  var data = function data(ele, field) {
    return ele.data(field);
  };
  var meta = function meta(ele, field) {
    return ele[field]();
  };

  /** A lookup of `match(check, ele)` functions by `Type` int */

  var match = [];
  /**
   * Returns whether the query matches for the element
   * @param query The `{ type, value, ... }` query object
   * @param ele The element to compare against
  */

  var matches = function matches(query, ele) {
    return query.checks.every(function (chk) {
      return match[chk.type](chk, ele);
    });
  };

  match[Type.GROUP] = function (check, ele) {
    var group = check.value;
    return group === '*' || group === ele.group();
  };

  match[Type.STATE] = function (check, ele) {
    var stateSelector = check.value;
    return stateSelectorMatches(stateSelector, ele);
  };

  match[Type.ID] = function (check, ele) {
    var id = check.value;
    return ele.id() === id;
  };

  match[Type.CLASS] = function (check, ele) {
    var cls = check.value;
    return ele.hasClass(cls);
  };

  match[Type.META_COMPARE] = function (check, ele) {
    var field = check.field,
        operator = check.operator,
        value = check.value;
    return valCmp(meta(ele, field), operator, value);
  };

  match[Type.DATA_COMPARE] = function (check, ele) {
    var field = check.field,
        operator = check.operator,
        value = check.value;
    return valCmp(data(ele, field), operator, value);
  };

  match[Type.DATA_BOOL] = function (check, ele) {
    var field = check.field,
        operator = check.operator;
    return boolCmp(data(ele, field), operator);
  };

  match[Type.DATA_EXIST] = function (check, ele) {
    var field = check.field,
        operator = check.operator;
    return existCmp(data(ele, field));
  };

  match[Type.UNDIRECTED_EDGE] = function (check, ele) {
    var qA = check.nodes[0];
    var qB = check.nodes[1];
    var src = ele.source();
    var tgt = ele.target();
    return matches(qA, src) && matches(qB, tgt) || matches(qB, src) && matches(qA, tgt);
  };

  match[Type.NODE_NEIGHBOR] = function (check, ele) {
    return matches(check.node, ele) && ele.neighborhood().some(function (n) {
      return n.isNode() && matches(check.neighbor, n);
    });
  };

  match[Type.DIRECTED_EDGE] = function (check, ele) {
    return matches(check.source, ele.source()) && matches(check.target, ele.target());
  };

  match[Type.NODE_SOURCE] = function (check, ele) {
    return matches(check.source, ele) && ele.outgoers().some(function (n) {
      return n.isNode() && matches(check.target, n);
    });
  };

  match[Type.NODE_TARGET] = function (check, ele) {
    return matches(check.target, ele) && ele.incomers().some(function (n) {
      return n.isNode() && matches(check.source, n);
    });
  };

  match[Type.CHILD] = function (check, ele) {
    return matches(check.child, ele) && matches(check.parent, ele.parent());
  };

  match[Type.PARENT] = function (check, ele) {
    return matches(check.parent, ele) && ele.children().some(function (c) {
      return matches(check.child, c);
    });
  };

  match[Type.DESCENDANT] = function (check, ele) {
    return matches(check.descendant, ele) && ele.ancestors().some(function (a) {
      return matches(check.ancestor, a);
    });
  };

  match[Type.ANCESTOR] = function (check, ele) {
    return matches(check.ancestor, ele) && ele.descendants().some(function (d) {
      return matches(check.descendant, d);
    });
  };

  match[Type.COMPOUND_SPLIT] = function (check, ele) {
    return matches(check.subject, ele) && matches(check.left, ele) && matches(check.right, ele);
  };

  match[Type.TRUE] = function () {
    return true;
  };

  match[Type.COLLECTION] = function (check, ele) {
    var collection = check.value;
    return collection.has(ele);
  };

  match[Type.FILTER] = function (check, ele) {
    var filter = check.value;
    return filter(ele);
  };

  var filter = function filter(collection) {
    var self = this; // for 1 id #foo queries, just get the element

    if (self.length === 1 && self[0].checks.length === 1 && self[0].checks[0].type === Type.ID) {
      return collection.getElementById(self[0].checks[0].value).collection();
    }

    var selectorFunction = function selectorFunction(element) {
      for (var j = 0; j < self.length; j++) {
        var query = self[j];

        if (matches(query, element)) {
          return true;
        }
      }

      return false;
    };

    if (self.text() == null) {
      selectorFunction = function selectorFunction() {
        return true;
      };
    }

    return collection.filter(selectorFunction);
  }; // filter
  // does selector match a single element?


  var matches$1 = function matches$1(ele) {
    var self = this;

    for (var j = 0; j < self.length; j++) {
      var query = self[j];

      if (matches(query, ele)) {
        return true;
      }
    }

    return false;
  }; // matches


  var matching = {
    matches: matches$1,
    filter: filter
  };

  var Selector = function Selector(selector) {
    this.inputText = selector;
    this.currentSubject = null;
    this.compoundCount = 0;
    this.edgeCount = 0;
    this.length = 0;

    if (selector == null || string(selector) && selector.match(/^\s*$/)) ; else if (elementOrCollection(selector)) {
      this.addQuery({
        checks: [{
          type: Type.COLLECTION,
          value: selector.collection()
        }]
      });
    } else if (fn(selector)) {
      this.addQuery({
        checks: [{
          type: Type.FILTER,
          value: selector
        }]
      });
    } else if (string(selector)) {
      if (!this.parse(selector)) {
        this.invalid = true;
      }
    } else {
      error('A selector must be created from a string; found ');
    }
  };

  var selfn = Selector.prototype;
  [parse$1, matching].forEach(function (p) {
    return extend(selfn, p);
  });

  selfn.text = function () {
    return this.inputText;
  };

  selfn.size = function () {
    return this.length;
  };

  selfn.eq = function (i) {
    return this[i];
  };

  selfn.sameText = function (otherSel) {
    return !this.invalid && !otherSel.invalid && this.text() === otherSel.text();
  };

  selfn.addQuery = function (q) {
    this[this.length++] = q;
  };

  selfn.selector = selfn.toString;

  var elesfn$f = {
    allAre: function allAre(selector) {
      var selObj = new Selector(selector);
      return this.every(function (ele) {
        return selObj.matches(ele);
      });
    },
    is: function is(selector) {
      var selObj = new Selector(selector);
      return this.some(function (ele) {
        return selObj.matches(ele);
      });
    },
    some: function some(fn, thisArg) {
      for (var i = 0; i < this.length; i++) {
        var ret = !thisArg ? fn(this[i], i, this) : fn.apply(thisArg, [this[i], i, this]);

        if (ret) {
          return true;
        }
      }

      return false;
    },
    every: function every(fn, thisArg) {
      for (var i = 0; i < this.length; i++) {
        var ret = !thisArg ? fn(this[i], i, this) : fn.apply(thisArg, [this[i], i, this]);

        if (!ret) {
          return false;
        }
      }

      return true;
    },
    same: function same(collection) {
      // cheap collection ref check
      if (this === collection) {
        return true;
      }

      collection = this.cy().collection(collection);
      var thisLength = this.length;
      var collectionLength = collection.length; // cheap length check

      if (thisLength !== collectionLength) {
        return false;
      } // cheap element ref check


      if (thisLength === 1) {
        return this[0] === collection[0];
      }

      return this.every(function (ele) {
        return collection.hasElementWithId(ele.id());
      });
    },
    anySame: function anySame(collection) {
      collection = this.cy().collection(collection);
      return this.some(function (ele) {
        return collection.hasElementWithId(ele.id());
      });
    },
    allAreNeighbors: function allAreNeighbors(collection) {
      collection = this.cy().collection(collection);
      var nhood = this.neighborhood();
      return collection.every(function (ele) {
        return nhood.hasElementWithId(ele.id());
      });
    },
    contains: function contains(collection) {
      collection = this.cy().collection(collection);
      var self = this;
      return collection.every(function (ele) {
        return self.hasElementWithId(ele.id());
      });
    }
  };
  elesfn$f.allAreNeighbours = elesfn$f.allAreNeighbors;
  elesfn$f.has = elesfn$f.contains;
  elesfn$f.equal = elesfn$f.equals = elesfn$f.same;

  var cache = function cache(fn, name) {
    return function traversalCache(arg1, arg2, arg3, arg4) {
      var selectorOrEles = arg1;
      var eles = this;
      var key;

      if (selectorOrEles == null) {
        key = '';
      } else if (elementOrCollection(selectorOrEles) && selectorOrEles.length === 1) {
        key = selectorOrEles.id();
      }

      if (eles.length === 1 && key) {
        var _p = eles[0]._private;
        var tch = _p.traversalCache = _p.traversalCache || {};
        var ch = tch[name] = tch[name] || [];
        var hash = hashString(key);
        var cacheHit = ch[hash];

        if (cacheHit) {
          return cacheHit;
        } else {
          return ch[hash] = fn.call(eles, arg1, arg2, arg3, arg4);
        }
      } else {
        return fn.call(eles, arg1, arg2, arg3, arg4);
      }
    };
  };

  var elesfn$g = {
    parent: function parent(selector) {
      var parents = []; // optimisation for single ele call

      if (this.length === 1) {
        var parent = this[0]._private.parent;

        if (parent) {
          return parent;
        }
      }

      for (var i = 0; i < this.length; i++) {
        var ele = this[i];
        var _parent = ele._private.parent;

        if (_parent) {
          parents.push(_parent);
        }
      }

      return this.spawn(parents, true).filter(selector);
    },
    parents: function parents(selector) {
      var parents = [];
      var eles = this.parent();

      while (eles.nonempty()) {
        for (var i = 0; i < eles.length; i++) {
          var ele = eles[i];
          parents.push(ele);
        }

        eles = eles.parent();
      }

      return this.spawn(parents, true).filter(selector);
    },
    commonAncestors: function commonAncestors(selector) {
      var ancestors;

      for (var i = 0; i < this.length; i++) {
        var ele = this[i];
        var parents = ele.parents();
        ancestors = ancestors || parents;
        ancestors = ancestors.intersect(parents); // current list must be common with current ele parents set
      }

      return ancestors.filter(selector);
    },
    orphans: function orphans(selector) {
      return this.stdFilter(function (ele) {
        return ele.isOrphan();
      }).filter(selector);
    },
    nonorphans: function nonorphans(selector) {
      return this.stdFilter(function (ele) {
        return ele.isChild();
      }).filter(selector);
    },
    children: cache(function (selector) {
      var children = [];

      for (var i = 0; i < this.length; i++) {
        var ele = this[i];
        var eleChildren = ele._private.children;

        for (var j = 0; j < eleChildren.length; j++) {
          children.push(eleChildren[j]);
        }
      }

      return this.spawn(children, true).filter(selector);
    }, 'children'),
    siblings: function siblings(selector) {
      return this.parent().children().not(this).filter(selector);
    },
    isParent: function isParent() {
      var ele = this[0];

      if (ele) {
        return ele.isNode() && ele._private.children.length !== 0;
      }
    },
    isChildless: function isChildless() {
      var ele = this[0];

      if (ele) {
        return ele.isNode() && ele._private.children.length === 0;
      }
    },
    isChild: function isChild() {
      var ele = this[0];

      if (ele) {
        return ele.isNode() && ele._private.parent != null;
      }
    },
    isOrphan: function isOrphan() {
      var ele = this[0];

      if (ele) {
        return ele.isNode() && ele._private.parent == null;
      }
    },
    descendants: function descendants(selector) {
      var elements = [];

      function add(eles) {
        for (var i = 0; i < eles.length; i++) {
          var ele = eles[i];
          elements.push(ele);

          if (ele.children().nonempty()) {
            add(ele.children());
          }
        }
      }

      add(this.children());
      return this.spawn(elements, true).filter(selector);
    }
  };

  function forEachCompound(eles, fn, includeSelf, recursiveStep) {
    var q = [];
    var did = new Set$1();
    var cy = eles.cy();
    var hasCompounds = cy.hasCompoundNodes();

    for (var i = 0; i < eles.length; i++) {
      var ele = eles[i];

      if (includeSelf) {
        q.push(ele);
      } else if (hasCompounds) {
        recursiveStep(q, did, ele);
      }
    }

    while (q.length > 0) {
      var _ele = q.shift();

      fn(_ele);
      did.add(_ele.id());

      if (hasCompounds) {
        recursiveStep(q, did, _ele);
      }
    }

    return eles;
  }

  function addChildren(q, did, ele) {
    if (ele.isParent()) {
      var children = ele._private.children;

      for (var i = 0; i < children.length; i++) {
        var child = children[i];

        if (!did.has(child.id())) {
          q.push(child);
        }
      }
    }
  } // very efficient version of eles.add( eles.descendants() ).forEach()
  // for internal use


  elesfn$g.forEachDown = function (fn) {
    var includeSelf = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
    return forEachCompound(this, fn, includeSelf, addChildren);
  };

  function addParent(q, did, ele) {
    if (ele.isChild()) {
      var parent = ele._private.parent;

      if (!did.has(parent.id())) {
        q.push(parent);
      }
    }
  }

  elesfn$g.forEachUp = function (fn) {
    var includeSelf = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
    return forEachCompound(this, fn, includeSelf, addParent);
  };

  function addParentAndChildren(q, did, ele) {
    addParent(q, did, ele);
    addChildren(q, did, ele);
  }

  elesfn$g.forEachUpAndDown = function (fn) {
    var includeSelf = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
    return forEachCompound(this, fn, includeSelf, addParentAndChildren);
  }; // aliases


  elesfn$g.ancestors = elesfn$g.parents;

  var fn$1, elesfn$h;
  fn$1 = elesfn$h = {
    data: define$3.data({
      field: 'data',
      bindingEvent: 'data',
      allowBinding: true,
      allowSetting: true,
      settingEvent: 'data',
      settingTriggersEvent: true,
      triggerFnName: 'trigger',
      allowGetting: true,
      immutableKeys: {
        'id': true,
        'source': true,
        'target': true,
        'parent': true
      },
      updateStyle: true
    }),
    removeData: define$3.removeData({
      field: 'data',
      event: 'data',
      triggerFnName: 'trigger',
      triggerEvent: true,
      immutableKeys: {
        'id': true,
        'source': true,
        'target': true,
        'parent': true
      },
      updateStyle: true
    }),
    scratch: define$3.data({
      field: 'scratch',
      bindingEvent: 'scratch',
      allowBinding: true,
      allowSetting: true,
      settingEvent: 'scratch',
      settingTriggersEvent: true,
      triggerFnName: 'trigger',
      allowGetting: true,
      updateStyle: true
    }),
    removeScratch: define$3.removeData({
      field: 'scratch',
      event: 'scratch',
      triggerFnName: 'trigger',
      triggerEvent: true,
      updateStyle: true
    }),
    rscratch: define$3.data({
      field: 'rscratch',
      allowBinding: false,
      allowSetting: true,
      settingTriggersEvent: false,
      allowGetting: true
    }),
    removeRscratch: define$3.removeData({
      field: 'rscratch',
      triggerEvent: false
    }),
    id: function id() {
      var ele = this[0];

      if (ele) {
        return ele._private.data.id;
      }
    }
  }; // aliases

  fn$1.attr = fn$1.data;
  fn$1.removeAttr = fn$1.removeData;
  var data$1 = elesfn$h;

  var elesfn$i = {};

  function defineDegreeFunction(callback) {
    return function (includeLoops) {
      var self = this;

      if (includeLoops === undefined) {
        includeLoops = true;
      }

      if (self.length === 0) {
        return;
      }

      if (self.isNode() && !self.removed()) {
        var degree = 0;
        var node = self[0];
        var connectedEdges = node._private.edges;

        for (var i = 0; i < connectedEdges.length; i++) {
          var edge = connectedEdges[i];

          if (!includeLoops && edge.isLoop()) {
            continue;
          }

          degree += callback(node, edge);
        }

        return degree;
      } else {
        return;
      }
    };
  }

  extend(elesfn$i, {
    degree: defineDegreeFunction(function (node, edge) {
      if (edge.source().same(edge.target())) {
        return 2;
      } else {
        return 1;
      }
    }),
    indegree: defineDegreeFunction(function (node, edge) {
      if (edge.target().same(node)) {
        return 1;
      } else {
        return 0;
      }
    }),
    outdegree: defineDegreeFunction(function (node, edge) {
      if (edge.source().same(node)) {
        return 1;
      } else {
        return 0;
      }
    })
  });

  function defineDegreeBoundsFunction(degreeFn, callback) {
    return function (includeLoops) {
      var ret;
      var nodes = this.nodes();

      for (var i = 0; i < nodes.length; i++) {
        var ele = nodes[i];
        var degree = ele[degreeFn](includeLoops);

        if (degree !== undefined && (ret === undefined || callback(degree, ret))) {
          ret = degree;
        }
      }

      return ret;
    };
  }

  extend(elesfn$i, {
    minDegree: defineDegreeBoundsFunction('degree', function (degree, min) {
      return degree < min;
    }),
    maxDegree: defineDegreeBoundsFunction('degree', function (degree, max) {
      return degree > max;
    }),
    minIndegree: defineDegreeBoundsFunction('indegree', function (degree, min) {
      return degree < min;
    }),
    maxIndegree: defineDegreeBoundsFunction('indegree', function (degree, max) {
      return degree > max;
    }),
    minOutdegree: defineDegreeBoundsFunction('outdegree', function (degree, min) {
      return degree < min;
    }),
    maxOutdegree: defineDegreeBoundsFunction('outdegree', function (degree, max) {
      return degree > max;
    })
  });
  extend(elesfn$i, {
    totalDegree: function totalDegree(includeLoops) {
      var total = 0;
      var nodes = this.nodes();

      for (var i = 0; i < nodes.length; i++) {
        total += nodes[i].degree(includeLoops);
      }

      return total;
    }
  });

  var fn$2, elesfn$j;

  var beforePositionSet = function beforePositionSet(eles, newPos, silent) {
    for (var i = 0; i < eles.length; i++) {
      var ele = eles[i];

      if (!ele.locked()) {
        var oldPos = ele._private.position;
        var delta = {
          x: newPos.x != null ? newPos.x - oldPos.x : 0,
          y: newPos.y != null ? newPos.y - oldPos.y : 0
        };

        if (ele.isParent() && !(delta.x === 0 && delta.y === 0)) {
          ele.children().shift(delta, silent);
        }

        ele.shiftCachedBoundingBox(delta);
      }
    }
  };

  var positionDef = {
    field: 'position',
    bindingEvent: 'position',
    allowBinding: true,
    allowSetting: true,
    settingEvent: 'position',
    settingTriggersEvent: true,
    triggerFnName: 'emitAndNotify',
    allowGetting: true,
    validKeys: ['x', 'y'],
    beforeGet: function beforeGet(ele) {
      ele.updateCompoundBounds();
    },
    beforeSet: function beforeSet(eles, newPos) {
      beforePositionSet(eles, newPos, false);
    },
    onSet: function onSet(eles) {
      eles.dirtyCompoundBoundsCache();
    },
    canSet: function canSet(ele) {
      return !ele.locked();
    }
  };
  fn$2 = elesfn$j = {
    position: define$3.data(positionDef),
    // position but no notification to renderer
    silentPosition: define$3.data(extend({}, positionDef, {
      allowBinding: false,
      allowSetting: true,
      settingTriggersEvent: false,
      allowGetting: false,
      beforeSet: function beforeSet(eles, newPos) {
        beforePositionSet(eles, newPos, true);
      }
    })),
    positions: function positions(pos, silent) {
      if (plainObject(pos)) {
        if (silent) {
          this.silentPosition(pos);
        } else {
          this.position(pos);
        }
      } else if (fn(pos)) {
        var _fn = pos;
        var cy = this.cy();
        cy.startBatch();

        for (var i = 0; i < this.length; i++) {
          var ele = this[i];

          var _pos = void 0;

          if (_pos = _fn(ele, i)) {
            if (silent) {
              ele.silentPosition(_pos);
            } else {
              ele.position(_pos);
            }
          }
        }

        cy.endBatch();
      }

      return this; // chaining
    },
    silentPositions: function silentPositions(pos) {
      return this.positions(pos, true);
    },
    shift: function shift(dim, val, silent) {
      var delta;

      if (plainObject(dim)) {
        delta = {
          x: number(dim.x) ? dim.x : 0,
          y: number(dim.y) ? dim.y : 0
        };
        silent = val;
      } else if (string(dim) && number(val)) {
        delta = {
          x: 0,
          y: 0
        };
        delta[dim] = val;
      }

      if (delta != null) {
        var cy = this.cy();
        cy.startBatch();

        for (var i = 0; i < this.length; i++) {
          var ele = this[i];
          var pos = ele.position();
          var newPos = {
            x: pos.x + delta.x,
            y: pos.y + delta.y
          };

          if (silent) {
            ele.silentPosition(newPos);
          } else {
            ele.position(newPos);
          }
        }

        cy.endBatch();
      }

      return this;
    },
    silentShift: function silentShift(dim, val) {
      if (plainObject(dim)) {
        this.shift(dim, true);
      } else if (string(dim) && number(val)) {
        this.shift(dim, val, true);
      }

      return this;
    },
    // get/set the rendered (i.e. on screen) positon of the element
    renderedPosition: function renderedPosition(dim, val) {
      var ele = this[0];
      var cy = this.cy();
      var zoom = cy.zoom();
      var pan = cy.pan();
      var rpos = plainObject(dim) ? dim : undefined;
      var setting = rpos !== undefined || val !== undefined && string(dim);

      if (ele && ele.isNode()) {
        // must have an element and must be a node to return position
        if (setting) {
          for (var i = 0; i < this.length; i++) {
            var _ele = this[i];

            if (val !== undefined) {
              // set one dimension
              _ele.position(dim, (val - pan[dim]) / zoom);
            } else if (rpos !== undefined) {
              // set whole position
              _ele.position(renderedToModelPosition(rpos, zoom, pan));
            }
          }
        } else {
          // getting
          var pos = ele.position();
          rpos = modelToRenderedPosition(pos, zoom, pan);

          if (dim === undefined) {
            // then return the whole rendered position
            return rpos;
          } else {
            // then return the specified dimension
            return rpos[dim];
          }
        }
      } else if (!setting) {
        return undefined; // for empty collection case
      }

      return this; // chaining
    },
    // get/set the position relative to the parent
    relativePosition: function relativePosition(dim, val) {
      var ele = this[0];
      var cy = this.cy();
      var ppos = plainObject(dim) ? dim : undefined;
      var setting = ppos !== undefined || val !== undefined && string(dim);
      var hasCompoundNodes = cy.hasCompoundNodes();

      if (ele && ele.isNode()) {
        // must have an element and must be a node to return position
        if (setting) {
          for (var i = 0; i < this.length; i++) {
            var _ele2 = this[i];
            var parent = hasCompoundNodes ? _ele2.parent() : null;
            var hasParent = parent && parent.length > 0;
            var relativeToParent = hasParent;

            if (hasParent) {
              parent = parent[0];
            }

            var origin = relativeToParent ? parent.position() : {
              x: 0,
              y: 0
            };

            if (val !== undefined) {
              // set one dimension
              _ele2.position(dim, val + origin[dim]);
            } else if (ppos !== undefined) {
              // set whole position
              _ele2.position({
                x: ppos.x + origin.x,
                y: ppos.y + origin.y
              });
            }
          }
        } else {
          // getting
          var pos = ele.position();

          var _parent = hasCompoundNodes ? ele.parent() : null;

          var _hasParent = _parent && _parent.length > 0;

          var _relativeToParent = _hasParent;

          if (_hasParent) {
            _parent = _parent[0];
          }

          var _origin = _relativeToParent ? _parent.position() : {
            x: 0,
            y: 0
          };

          ppos = {
            x: pos.x - _origin.x,
            y: pos.y - _origin.y
          };

          if (dim === undefined) {
            // then return the whole rendered position
            return ppos;
          } else {
            // then return the specified dimension
            return ppos[dim];
          }
        }
      } else if (!setting) {
        return undefined; // for empty collection case
      }

      return this; // chaining
    }
  }; // aliases

  fn$2.modelPosition = fn$2.point = fn$2.position;
  fn$2.modelPositions = fn$2.points = fn$2.positions;
  fn$2.renderedPoint = fn$2.renderedPosition;
  fn$2.relativePoint = fn$2.relativePosition;
  var position = elesfn$j;

  var fn$3, elesfn$k;
  fn$3 = elesfn$k = {};

  elesfn$k.renderedBoundingBox = function (options) {
    var bb = this.boundingBox(options);
    var cy = this.cy();
    var zoom = cy.zoom();
    var pan = cy.pan();
    var x1 = bb.x1 * zoom + pan.x;
    var x2 = bb.x2 * zoom + pan.x;
    var y1 = bb.y1 * zoom + pan.y;
    var y2 = bb.y2 * zoom + pan.y;
    return {
      x1: x1,
      x2: x2,
      y1: y1,
      y2: y2,
      w: x2 - x1,
      h: y2 - y1
    };
  };

  elesfn$k.dirtyCompoundBoundsCache = function () {
    var cy = this.cy();

    if (!cy.styleEnabled() || !cy.hasCompoundNodes()) {
      return this;
    }

    this.forEachUp(function (ele) {
      if (ele.isParent()) {
        var _p = ele._private;
        _p.compoundBoundsClean = false;
        _p.bbCache = null;
        ele.emitAndNotify('bounds');
      }
    });
    return this;
  };

  elesfn$k.updateCompoundBounds = function () {
    var force = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
    var cy = this.cy(); // not possible to do on non-compound graphs or with the style disabled

    if (!cy.styleEnabled() || !cy.hasCompoundNodes()) {
      return this;
    } // save cycles when batching -- but bounds will be stale (or not exist yet)


    if (!force && cy.batching()) {
      return this;
    }

    function update(parent) {
      if (!parent.isParent()) {
        return;
      }

      var _p = parent._private;
      var children = parent.children();
      var includeLabels = parent.pstyle('compound-sizing-wrt-labels').value === 'include';
      var min = {
        width: {
          val: parent.pstyle('min-width').pfValue,
          left: parent.pstyle('min-width-bias-left'),
          right: parent.pstyle('min-width-bias-right')
        },
        height: {
          val: parent.pstyle('min-height').pfValue,
          top: parent.pstyle('min-height-bias-top'),
          bottom: parent.pstyle('min-height-bias-bottom')
        }
      };
      var bb = children.boundingBox({
        includeLabels: includeLabels,
        includeOverlays: false,
        // updating the compound bounds happens outside of the regular
        // cache cycle (i.e. before fired events)
        useCache: false
      });
      var pos = _p.position; // if children take up zero area then keep position and fall back on stylesheet w/h

      if (bb.w === 0 || bb.h === 0) {
        bb = {
          w: parent.pstyle('width').pfValue,
          h: parent.pstyle('height').pfValue
        };
        bb.x1 = pos.x - bb.w / 2;
        bb.x2 = pos.x + bb.w / 2;
        bb.y1 = pos.y - bb.h / 2;
        bb.y2 = pos.y + bb.h / 2;
      }

      function computeBiasValues(propDiff, propBias, propBiasComplement) {
        var biasDiff = 0;
        var biasComplementDiff = 0;
        var biasTotal = propBias + propBiasComplement;

        if (propDiff > 0 && biasTotal > 0) {
          biasDiff = propBias / biasTotal * propDiff;
          biasComplementDiff = propBiasComplement / biasTotal * propDiff;
        }

        return {
          biasDiff: biasDiff,
          biasComplementDiff: biasComplementDiff
        };
      }

      function computePaddingValues(width, height, paddingObject, relativeTo) {
        // Assuming percentage is number from 0 to 1
        if (paddingObject.units === '%') {
          switch (relativeTo) {
            case 'width':
              return width > 0 ? paddingObject.pfValue * width : 0;

            case 'height':
              return height > 0 ? paddingObject.pfValue * height : 0;

            case 'average':
              return width > 0 && height > 0 ? paddingObject.pfValue * (width + height) / 2 : 0;

            case 'min':
              return width > 0 && height > 0 ? width > height ? paddingObject.pfValue * height : paddingObject.pfValue * width : 0;

            case 'max':
              return width > 0 && height > 0 ? width > height ? paddingObject.pfValue * width : paddingObject.pfValue * height : 0;

            default:
              return 0;
          }
        } else if (paddingObject.units === 'px') {
          return paddingObject.pfValue;
        } else {
          return 0;
        }
      }

      var leftVal = min.width.left.value;

      if (min.width.left.units === 'px' && min.width.val > 0) {
        leftVal = leftVal * 100 / min.width.val;
      }

      var rightVal = min.width.right.value;

      if (min.width.right.units === 'px' && min.width.val > 0) {
        rightVal = rightVal * 100 / min.width.val;
      }

      var topVal = min.height.top.value;

      if (min.height.top.units === 'px' && min.height.val > 0) {
        topVal = topVal * 100 / min.height.val;
      }

      var bottomVal = min.height.bottom.value;

      if (min.height.bottom.units === 'px' && min.height.val > 0) {
        bottomVal = bottomVal * 100 / min.height.val;
      }

      var widthBiasDiffs = computeBiasValues(min.width.val - bb.w, leftVal, rightVal);
      var diffLeft = widthBiasDiffs.biasDiff;
      var diffRight = widthBiasDiffs.biasComplementDiff;
      var heightBiasDiffs = computeBiasValues(min.height.val - bb.h, topVal, bottomVal);
      var diffTop = heightBiasDiffs.biasDiff;
      var diffBottom = heightBiasDiffs.biasComplementDiff;
      _p.autoPadding = computePaddingValues(bb.w, bb.h, parent.pstyle('padding'), parent.pstyle('padding-relative-to').value);
      _p.autoWidth = Math.max(bb.w, min.width.val);
      pos.x = (-diffLeft + bb.x1 + bb.x2 + diffRight) / 2;
      _p.autoHeight = Math.max(bb.h, min.height.val);
      pos.y = (-diffTop + bb.y1 + bb.y2 + diffBottom) / 2;
    }

    for (var i = 0; i < this.length; i++) {
      var ele = this[i];
      var _p = ele._private;

      if (!_p.compoundBoundsClean) {
        update(ele);

        if (!cy.batching()) {
          _p.compoundBoundsClean = true;
        }
      }
    }

    return this;
  };

  var noninf = function noninf(x) {
    if (x === Infinity || x === -Infinity) {
      return 0;
    }

    return x;
  };

  var updateBounds = function updateBounds(b, x1, y1, x2, y2) {
    // don't update with zero area boxes
    if (x2 - x1 === 0 || y2 - y1 === 0) {
      return;
    } // don't update with null dim


    if (x1 == null || y1 == null || x2 == null || y2 == null) {
      return;
    }

    b.x1 = x1 < b.x1 ? x1 : b.x1;
    b.x2 = x2 > b.x2 ? x2 : b.x2;
    b.y1 = y1 < b.y1 ? y1 : b.y1;
    b.y2 = y2 > b.y2 ? y2 : b.y2;
    b.w = b.x2 - b.x1;
    b.h = b.y2 - b.y1;
  };

  var updateBoundsFromBox = function updateBoundsFromBox(b, b2) {
    if (b2 == null) {
      return b;
    }

    return updateBounds(b, b2.x1, b2.y1, b2.x2, b2.y2);
  };

  var prefixedProperty = function prefixedProperty(obj, field, prefix) {
    return getPrefixedProperty(obj, field, prefix);
  };

  var updateBoundsFromArrow = function updateBoundsFromArrow(bounds, ele, prefix) {
    if (ele.cy().headless()) {
      return;
    }

    var _p = ele._private;
    var rstyle = _p.rstyle;
    var halfArW = rstyle.arrowWidth / 2;
    var arrowType = ele.pstyle(prefix + '-arrow-shape').value;
    var x;
    var y;

    if (arrowType !== 'none') {
      if (prefix === 'source') {
        x = rstyle.srcX;
        y = rstyle.srcY;
      } else if (prefix === 'target') {
        x = rstyle.tgtX;
        y = rstyle.tgtY;
      } else {
        x = rstyle.midX;
        y = rstyle.midY;
      } // always store the individual arrow bounds


      var bbs = _p.arrowBounds = _p.arrowBounds || {};
      var bb = bbs[prefix] = bbs[prefix] || {};
      bb.x1 = x - halfArW;
      bb.y1 = y - halfArW;
      bb.x2 = x + halfArW;
      bb.y2 = y + halfArW;
      bb.w = bb.x2 - bb.x1;
      bb.h = bb.y2 - bb.y1;
      expandBoundingBox(bb, 1);
      updateBounds(bounds, bb.x1, bb.y1, bb.x2, bb.y2);
    }
  };

  var updateBoundsFromLabel = function updateBoundsFromLabel(bounds, ele, prefix) {
    if (ele.cy().headless()) {
      return;
    }

    var prefixDash;

    if (prefix) {
      prefixDash = prefix + '-';
    } else {
      prefixDash = '';
    }

    var _p = ele._private;
    var rstyle = _p.rstyle;
    var label = ele.pstyle(prefixDash + 'label').strValue;

    if (label) {
      var halign = ele.pstyle('text-halign');
      var valign = ele.pstyle('text-valign');
      var labelWidth = prefixedProperty(rstyle, 'labelWidth', prefix);
      var labelHeight = prefixedProperty(rstyle, 'labelHeight', prefix);
      var labelX = prefixedProperty(rstyle, 'labelX', prefix);
      var labelY = prefixedProperty(rstyle, 'labelY', prefix);
      var marginX = ele.pstyle(prefixDash + 'text-margin-x').pfValue;
      var marginY = ele.pstyle(prefixDash + 'text-margin-y').pfValue;
      var isEdge = ele.isEdge();
      var rotation = ele.pstyle(prefixDash + 'text-rotation');
      var outlineWidth = ele.pstyle('text-outline-width').pfValue;
      var borderWidth = ele.pstyle('text-border-width').pfValue;
      var halfBorderWidth = borderWidth / 2;
      var padding = ele.pstyle('text-background-padding').pfValue;
      var lh = labelHeight;
      var lw = labelWidth;
      var lw_2 = lw / 2;
      var lh_2 = lh / 2;
      var lx1, lx2, ly1, ly2;

      if (isEdge) {
        lx1 = labelX - lw_2;
        lx2 = labelX + lw_2;
        ly1 = labelY - lh_2;
        ly2 = labelY + lh_2;
      } else {
        switch (halign.value) {
          case 'left':
            lx1 = labelX - lw;
            lx2 = labelX;
            break;

          case 'center':
            lx1 = labelX - lw_2;
            lx2 = labelX + lw_2;
            break;

          case 'right':
            lx1 = labelX;
            lx2 = labelX + lw;
            break;
        }

        switch (valign.value) {
          case 'top':
            ly1 = labelY - lh;
            ly2 = labelY;
            break;

          case 'center':
            ly1 = labelY - lh_2;
            ly2 = labelY + lh_2;
            break;

          case 'bottom':
            ly1 = labelY;
            ly2 = labelY + lh;
            break;
        }
      } // shift by margin and expand by outline and border


      lx1 += marginX - Math.max(outlineWidth, halfBorderWidth) - padding;
      lx2 += marginX + Math.max(outlineWidth, halfBorderWidth) + padding;
      ly1 += marginY - Math.max(outlineWidth, halfBorderWidth) - padding;
      ly2 += marginY + Math.max(outlineWidth, halfBorderWidth) + padding; // always store the unrotated label bounds separately

      var bbPrefix = prefix || 'main';
      var bbs = _p.labelBounds;
      var bb = bbs[bbPrefix] = bbs[bbPrefix] || {};
      bb.x1 = lx1;
      bb.y1 = ly1;
      bb.x2 = lx2;
      bb.y2 = ly2;
      bb.w = lx2 - lx1;
      bb.h = ly2 - ly1;
      expandBoundingBox(bb, 1); // expand to work around browser dimension inaccuracies

      var isAutorotate = isEdge && rotation.strValue === 'autorotate';
      var isPfValue = rotation.pfValue != null && rotation.pfValue !== 0;

      if (isAutorotate || isPfValue) {
        var theta = isAutorotate ? prefixedProperty(_p.rstyle, 'labelAngle', prefix) : rotation.pfValue;
        var cos = Math.cos(theta);
        var sin = Math.sin(theta); // rotation point (default value for center-center)

        var xo = (lx1 + lx2) / 2;
        var yo = (ly1 + ly2) / 2;

        if (!isEdge) {
          switch (halign.value) {
            case 'left':
              xo = lx2;
              break;

            case 'right':
              xo = lx1;
              break;
          }

          switch (valign.value) {
            case 'top':
              yo = ly2;
              break;

            case 'bottom':
              yo = ly1;
              break;
          }
        }

        var rotate = function rotate(x, y) {
          x = x - xo;
          y = y - yo;
          return {
            x: x * cos - y * sin + xo,
            y: x * sin + y * cos + yo
          };
        };

        var px1y1 = rotate(lx1, ly1);
        var px1y2 = rotate(lx1, ly2);
        var px2y1 = rotate(lx2, ly1);
        var px2y2 = rotate(lx2, ly2);
        lx1 = Math.min(px1y1.x, px1y2.x, px2y1.x, px2y2.x);
        lx2 = Math.max(px1y1.x, px1y2.x, px2y1.x, px2y2.x);
        ly1 = Math.min(px1y1.y, px1y2.y, px2y1.y, px2y2.y);
        ly2 = Math.max(px1y1.y, px1y2.y, px2y1.y, px2y2.y);
      }

      var bbPrefixRot = bbPrefix + 'Rot';
      var bbRot = bbs[bbPrefixRot] = bbs[bbPrefixRot] || {};
      bbRot.x1 = lx1;
      bbRot.y1 = ly1;
      bbRot.x2 = lx2;
      bbRot.y2 = ly2;
      bbRot.w = lx2 - lx1;
      bbRot.h = ly2 - ly1;
      updateBounds(bounds, lx1, ly1, lx2, ly2);
      updateBounds(_p.labelBounds.all, lx1, ly1, lx2, ly2);
    }

    return bounds;
  }; // get the bounding box of the elements (in raw model position)


  var boundingBoxImpl = function boundingBoxImpl(ele, options) {
    var cy = ele._private.cy;
    var styleEnabled = cy.styleEnabled();
    var headless = cy.headless();
    var bounds = makeBoundingBox();
    var _p = ele._private;
    var isNode = ele.isNode();
    var isEdge = ele.isEdge();
    var ex1, ex2, ey1, ey2; // extrema of body / lines

    var x, y; // node pos

    var rstyle = _p.rstyle;
    var manualExpansion = isNode && styleEnabled ? ele.pstyle('bounds-expansion').pfValue : [0]; // must use `display` prop only, as reading `compound.width()` causes recursion
    // (other factors like width values will be considered later in this function anyway)

    var isDisplayed = function isDisplayed(ele) {
      return ele.pstyle('display').value !== 'none';
    };

    var displayed = !styleEnabled || isDisplayed(ele) // must take into account connected nodes b/c of implicit edge hiding on display:none node
    && (!isEdge || isDisplayed(ele.source()) && isDisplayed(ele.target()));

    if (displayed) {
      // displayed suffices, since we will find zero area eles anyway
      var overlayOpacity = 0;
      var overlayPadding = 0;

      if (styleEnabled && options.includeOverlays) {
        overlayOpacity = ele.pstyle('overlay-opacity').value;

        if (overlayOpacity !== 0) {
          overlayPadding = ele.pstyle('overlay-padding').value;
        }
      }

      var w = 0;
      var wHalf = 0;

      if (styleEnabled) {
        w = ele.pstyle('width').pfValue;
        wHalf = w / 2;
      }

      if (isNode && options.includeNodes) {
        var pos = ele.position();
        x = pos.x;
        y = pos.y;

        var _w = ele.outerWidth();

        var halfW = _w / 2;
        var h = ele.outerHeight();
        var halfH = h / 2; // handle node dimensions
        /////////////////////////

        ex1 = x - halfW;
        ex2 = x + halfW;
        ey1 = y - halfH;
        ey2 = y + halfH;
        updateBounds(bounds, ex1, ey1, ex2, ey2);
      } else if (isEdge && options.includeEdges) {
        if (styleEnabled && !headless) {
          var curveStyle = ele.pstyle('curve-style').strValue; // handle edge dimensions (rough box estimate)
          //////////////////////////////////////////////

          ex1 = Math.min(rstyle.srcX, rstyle.midX, rstyle.tgtX);
          ex2 = Math.max(rstyle.srcX, rstyle.midX, rstyle.tgtX);
          ey1 = Math.min(rstyle.srcY, rstyle.midY, rstyle.tgtY);
          ey2 = Math.max(rstyle.srcY, rstyle.midY, rstyle.tgtY); // take into account edge width

          ex1 -= wHalf;
          ex2 += wHalf;
          ey1 -= wHalf;
          ey2 += wHalf;
          updateBounds(bounds, ex1, ey1, ex2, ey2); // precise edges
          ////////////////

          if (curveStyle === 'haystack') {
            var hpts = rstyle.haystackPts;

            if (hpts && hpts.length === 2) {
              ex1 = hpts[0].x;
              ey1 = hpts[0].y;
              ex2 = hpts[1].x;
              ey2 = hpts[1].y;

              if (ex1 > ex2) {
                var temp = ex1;
                ex1 = ex2;
                ex2 = temp;
              }

              if (ey1 > ey2) {
                var _temp = ey1;
                ey1 = ey2;
                ey2 = _temp;
              }

              updateBounds(bounds, ex1 - wHalf, ey1 - wHalf, ex2 + wHalf, ey2 + wHalf);
            }
          } else if (curveStyle === 'bezier' || curveStyle === 'unbundled-bezier' || curveStyle === 'segments' || curveStyle === 'taxi') {
            var pts;

            switch (curveStyle) {
              case 'bezier':
              case 'unbundled-bezier':
                pts = rstyle.bezierPts;
                break;

              case 'segments':
              case 'taxi':
                pts = rstyle.linePts;
                break;
            }

            if (pts != null) {
              for (var j = 0; j < pts.length; j++) {
                var pt = pts[j];
                ex1 = pt.x - wHalf;
                ex2 = pt.x + wHalf;
                ey1 = pt.y - wHalf;
                ey2 = pt.y + wHalf;
                updateBounds(bounds, ex1, ey1, ex2, ey2);
              }
            }
          } // bezier-like or segment-like edge

        } else {
          // headless or style disabled
          // fallback on source and target positions
          //////////////////////////////////////////
          var n1 = ele.source();
          var n1pos = n1.position();
          var n2 = ele.target();
          var n2pos = n2.position();
          ex1 = n1pos.x;
          ex2 = n2pos.x;
          ey1 = n1pos.y;
          ey2 = n2pos.y;

          if (ex1 > ex2) {
            var _temp2 = ex1;
            ex1 = ex2;
            ex2 = _temp2;
          }

          if (ey1 > ey2) {
            var _temp3 = ey1;
            ey1 = ey2;
            ey2 = _temp3;
          } // take into account edge width


          ex1 -= wHalf;
          ex2 += wHalf;
          ey1 -= wHalf;
          ey2 += wHalf;
          updateBounds(bounds, ex1, ey1, ex2, ey2);
        } // headless or style disabled

      } // edges
      // handle edge arrow size
      /////////////////////////


      if (styleEnabled && options.includeEdges && isEdge) {
        updateBoundsFromArrow(bounds, ele, 'mid-source');
        updateBoundsFromArrow(bounds, ele, 'mid-target');
        updateBoundsFromArrow(bounds, ele, 'source');
        updateBoundsFromArrow(bounds, ele, 'target');
      } // ghost
      ////////


      if (styleEnabled) {
        var ghost = ele.pstyle('ghost').value === 'yes';

        if (ghost) {
          var gx = ele.pstyle('ghost-offset-x').pfValue;
          var gy = ele.pstyle('ghost-offset-y').pfValue;
          updateBounds(bounds, bounds.x1 + gx, bounds.y1 + gy, bounds.x2 + gx, bounds.y2 + gy);
        }
      } // always store the body bounds separately from the labels


      var bbBody = _p.bodyBounds = _p.bodyBounds || {};
      assignBoundingBox(bbBody, bounds);
      expandBoundingBoxSides(bbBody, manualExpansion);
      expandBoundingBox(bbBody, 1); // expand to work around browser dimension inaccuracies
      // overlay
      //////////

      if (styleEnabled) {
        ex1 = bounds.x1;
        ex2 = bounds.x2;
        ey1 = bounds.y1;
        ey2 = bounds.y2;
        updateBounds(bounds, ex1 - overlayPadding, ey1 - overlayPadding, ex2 + overlayPadding, ey2 + overlayPadding);
      } // always store the body bounds separately from the labels


      var bbOverlay = _p.overlayBounds = _p.overlayBounds || {};
      assignBoundingBox(bbOverlay, bounds);
      expandBoundingBoxSides(bbOverlay, manualExpansion);
      expandBoundingBox(bbOverlay, 1); // expand to work around browser dimension inaccuracies
      // handle label dimensions
      //////////////////////////

      var bbLabels = _p.labelBounds = _p.labelBounds || {};

      if (bbLabels.all != null) {
        clearBoundingBox(bbLabels.all);
      } else {
        bbLabels.all = makeBoundingBox();
      }

      if (styleEnabled && options.includeLabels) {
        if (options.includeMainLabels) {
          updateBoundsFromLabel(bounds, ele, null);
        }

        if (isEdge) {
          if (options.includeSourceLabels) {
            updateBoundsFromLabel(bounds, ele, 'source');
          }

          if (options.includeTargetLabels) {
            updateBoundsFromLabel(bounds, ele, 'target');
          }
        }
      } // style enabled for labels

    } // if displayed


    bounds.x1 = noninf(bounds.x1);
    bounds.y1 = noninf(bounds.y1);
    bounds.x2 = noninf(bounds.x2);
    bounds.y2 = noninf(bounds.y2);
    bounds.w = noninf(bounds.x2 - bounds.x1);
    bounds.h = noninf(bounds.y2 - bounds.y1);

    if (bounds.w > 0 && bounds.h > 0 && displayed) {
      expandBoundingBoxSides(bounds, manualExpansion); // expand bounds by 1 because antialiasing can increase the visual/effective size by 1 on all sides

      expandBoundingBox(bounds, 1);
    }

    return bounds;
  };

  var getKey = function getKey(opts) {
    var i = 0;

    var tf = function tf(val) {
      return (val ? 1 : 0) << i++;
    };

    var key = 0;
    key += tf(opts.incudeNodes);
    key += tf(opts.includeEdges);
    key += tf(opts.includeLabels);
    key += tf(opts.includeMainLabels);
    key += tf(opts.includeSourceLabels);
    key += tf(opts.includeTargetLabels);
    key += tf(opts.includeOverlays);
    return key;
  };

  var getBoundingBoxPosKey = function getBoundingBoxPosKey(ele) {
    if (ele.isEdge()) {
      var p1 = ele.source().position();
      var p2 = ele.target().position();

      var r = function r(x) {
        return Math.round(x);
      };

      return hashIntsArray([r(p1.x), r(p1.y), r(p2.x), r(p2.y)]);
    } else {
      return 0;
    }
  };

  var cachedBoundingBoxImpl = function cachedBoundingBoxImpl(ele, opts) {
    var _p = ele._private;
    var bb;
    var isEdge = ele.isEdge();
    var key = opts == null ? defBbOptsKey : getKey(opts);
    var usingDefOpts = key === defBbOptsKey;
    var currPosKey = getBoundingBoxPosKey(ele);
    var isPosKeySame = _p.bbCachePosKey === currPosKey;
    var useCache = opts.useCache && isPosKeySame;

    var isDirty = function isDirty(ele) {
      return ele._private.bbCache == null;
    };

    var needRecalc = !useCache || isDirty(ele) || isEdge && isDirty(ele.source()) || isDirty(ele.target());

    if (needRecalc) {
      if (!isPosKeySame) {
        ele.recalculateRenderedStyle();
      }

      bb = boundingBoxImpl(ele, defBbOpts);
      _p.bbCache = bb;
      _p.bbCacheShift.x = _p.bbCacheShift.y = 0;
      _p.bbCachePosKey = currPosKey;
    } else {
      bb = _p.bbCache;
    }

    if (!needRecalc && (_p.bbCacheShift.x !== 0 || _p.bbCacheShift.y !== 0)) {
      var shift = assignShiftToBoundingBox;
      var delta = _p.bbCacheShift;

      var safeShift = function safeShift(bb, delta) {
        if (bb != null) {
          shift(bb, delta);
        }
      };

      shift(bb, delta);
      var bodyBounds = _p.bodyBounds,
          overlayBounds = _p.overlayBounds,
          labelBounds = _p.labelBounds,
          arrowBounds = _p.arrowBounds;
      safeShift(bodyBounds, delta);
      safeShift(overlayBounds, delta);

      if (arrowBounds != null) {
        safeShift(arrowBounds.source, delta);
        safeShift(arrowBounds.target, delta);
        safeShift(arrowBounds['mid-source'], delta);
        safeShift(arrowBounds['mid-target'], delta);
      }

      if (labelBounds != null) {
        safeShift(labelBounds.main, delta);
        safeShift(labelBounds.all, delta);
        safeShift(labelBounds.source, delta);
        safeShift(labelBounds.target, delta);
      }
    } // always reset the shift, because we either applied the shift or cleared it by doing a fresh recalc


    _p.bbCacheShift.x = _p.bbCacheShift.y = 0; // not using def opts => need to build up bb from combination of sub bbs

    if (!usingDefOpts) {
      var isNode = ele.isNode();
      bb = makeBoundingBox();

      if (opts.includeNodes && isNode || opts.includeEdges && !isNode) {
        if (opts.includeOverlays) {
          updateBoundsFromBox(bb, _p.overlayBounds);
        } else {
          updateBoundsFromBox(bb, _p.bodyBounds);
        }
      }

      if (opts.includeLabels) {
        if (opts.includeMainLabels && (!isEdge || opts.includeSourceLabels && opts.includeTargetLabels)) {
          updateBoundsFromBox(bb, _p.labelBounds.all);
        } else {
          if (opts.includeMainLabels) {
            updateBoundsFromBox(bb, _p.labelBounds.mainRot);
          }

          if (opts.includeSourceLabels) {
            updateBoundsFromBox(bb, _p.labelBounds.sourceRot);
          }

          if (opts.includeTargetLabels) {
            updateBoundsFromBox(bb, _p.labelBounds.targetRot);
          }
        }
      }

      bb.w = bb.x2 - bb.x1;
      bb.h = bb.y2 - bb.y1;
    }

    return bb;
  };

  var defBbOpts = {
    includeNodes: true,
    includeEdges: true,
    includeLabels: true,
    includeMainLabels: true,
    includeSourceLabels: true,
    includeTargetLabels: true,
    includeOverlays: true,
    useCache: true
  };
  var defBbOptsKey = getKey(defBbOpts);
  var filledBbOpts = defaults(defBbOpts);

  elesfn$k.boundingBox = function (options) {
    var bounds; // the main usecase is ele.boundingBox() for a single element with no/def options
    // specified s.t. the cache is used, so check for this case to make it faster by
    // avoiding the overhead of the rest of the function

    if (this.length === 1 && this[0]._private.bbCache != null && (options === undefined || options.useCache === undefined || options.useCache === true)) {
      if (options === undefined) {
        options = defBbOpts;
      } else {
        options = filledBbOpts(options);
      }

      bounds = cachedBoundingBoxImpl(this[0], options);
    } else {
      bounds = makeBoundingBox();
      options = options || defBbOpts;
      var opts = filledBbOpts(options);
      var eles = this;
      var cy = eles.cy();
      var styleEnabled = cy.styleEnabled();

      if (styleEnabled) {
        for (var i = 0; i < eles.length; i++) {
          var ele = eles[i];
          var _p = ele._private;
          var currPosKey = getBoundingBoxPosKey(ele);
          var isPosKeySame = _p.bbCachePosKey === currPosKey;
          var useCache = opts.useCache && isPosKeySame;
          ele.recalculateRenderedStyle(useCache);
        }
      }

      this.updateCompoundBounds();

      for (var _i = 0; _i < eles.length; _i++) {
        var _ele = eles[_i];
        updateBoundsFromBox(bounds, cachedBoundingBoxImpl(_ele, opts));
      }
    }

    bounds.x1 = noninf(bounds.x1);
    bounds.y1 = noninf(bounds.y1);
    bounds.x2 = noninf(bounds.x2);
    bounds.y2 = noninf(bounds.y2);
    bounds.w = noninf(bounds.x2 - bounds.x1);
    bounds.h = noninf(bounds.y2 - bounds.y1);
    return bounds;
  };

  elesfn$k.dirtyBoundingBoxCache = function () {
    for (var i = 0; i < this.length; i++) {
      var _p = this[i]._private;
      _p.bbCache = null;
      _p.bbCacheShift.x = _p.bbCacheShift.y = 0;
      _p.bbCachePosKey = null;
      _p.bodyBounds = null;
      _p.overlayBounds = null;
      _p.labelBounds.all = null;
      _p.labelBounds.source = null;
      _p.labelBounds.target = null;
      _p.labelBounds.main = null;
      _p.labelBounds.sourceRot = null;
      _p.labelBounds.targetRot = null;
      _p.labelBounds.mainRot = null;
      _p.arrowBounds.source = null;
      _p.arrowBounds.target = null;
      _p.arrowBounds['mid-source'] = null;
      _p.arrowBounds['mid-target'] = null;
    }

    this.emitAndNotify('bounds');
    return this;
  };

  elesfn$k.shiftCachedBoundingBox = function (delta) {
    for (var i = 0; i < this.length; i++) {
      var ele = this[i];
      var _p = ele._private;
      var bb = _p.bbCache;

      if (bb != null) {
        _p.bbCacheShift.x += delta.x;
        _p.bbCacheShift.y += delta.y;
      }
    }

    this.emitAndNotify('bounds');
    return this;
  }; // private helper to get bounding box for custom node positions
  // - good for perf in certain cases but currently requires dirtying the rendered style
  // - would be better to not modify the nodes but the nodes are read directly everywhere in the renderer...
  // - try to use for only things like discrete layouts where the node position would change anyway


  elesfn$k.boundingBoxAt = function (fn) {
    var nodes = this.nodes();
    var cy = this.cy();
    var hasCompoundNodes = cy.hasCompoundNodes();

    if (hasCompoundNodes) {
      nodes = nodes.filter(function (node) {
        return !node.isParent();
      });
    }

    if (plainObject(fn)) {
      var obj = fn;

      fn = function fn() {
        return obj;
      };
    }

    var storeOldPos = function storeOldPos(node, i) {
      return node._private.bbAtOldPos = fn(node, i);
    };

    var getOldPos = function getOldPos(node) {
      return node._private.bbAtOldPos;
    };

    cy.startBatch();
    nodes.forEach(storeOldPos).silentPositions(fn);

    if (hasCompoundNodes) {
      this.updateCompoundBounds(true); // force update b/c we're inside a batch cycle
    }

    var bb = copyBoundingBox(this.boundingBox({
      useCache: false
    }));
    nodes.silentPositions(getOldPos);
    cy.endBatch();
    return bb;
  };

  fn$3.boundingbox = fn$3.bb = fn$3.boundingBox;
  fn$3.renderedBoundingbox = fn$3.renderedBoundingBox;
  var bounds = elesfn$k;

  var fn$4, elesfn$l;
  fn$4 = elesfn$l = {};

  var defineDimFns = function defineDimFns(opts) {
    opts.uppercaseName = capitalize(opts.name);
    opts.autoName = 'auto' + opts.uppercaseName;
    opts.labelName = 'label' + opts.uppercaseName;
    opts.outerName = 'outer' + opts.uppercaseName;
    opts.uppercaseOuterName = capitalize(opts.outerName);

    fn$4[opts.name] = function dimImpl() {
      var ele = this[0];
      var _p = ele._private;
      var cy = _p.cy;
      var styleEnabled = cy._private.styleEnabled;

      if (ele) {
        if (styleEnabled) {
          if (ele.isParent()) {
            ele.updateCompoundBounds();
            return _p[opts.autoName] || 0;
          }

          var d = ele.pstyle(opts.name);

          switch (d.strValue) {
            case 'label':
              ele.recalculateRenderedStyle();
              return _p.rstyle[opts.labelName] || 0;

            default:
              return d.pfValue;
          }
        } else {
          return 1;
        }
      }
    };

    fn$4['outer' + opts.uppercaseName] = function outerDimImpl() {
      var ele = this[0];
      var _p = ele._private;
      var cy = _p.cy;
      var styleEnabled = cy._private.styleEnabled;

      if (ele) {
        if (styleEnabled) {
          var dim = ele[opts.name]();
          var border = ele.pstyle('border-width').pfValue; // n.b. 1/2 each side

          var padding = 2 * ele.padding();
          return dim + border + padding;
        } else {
          return 1;
        }
      }
    };

    fn$4['rendered' + opts.uppercaseName] = function renderedDimImpl() {
      var ele = this[0];

      if (ele) {
        var d = ele[opts.name]();
        return d * this.cy().zoom();
      }
    };

    fn$4['rendered' + opts.uppercaseOuterName] = function renderedOuterDimImpl() {
      var ele = this[0];

      if (ele) {
        var od = ele[opts.outerName]();
        return od * this.cy().zoom();
      }
    };
  };

  defineDimFns({
    name: 'width'
  });
  defineDimFns({
    name: 'height'
  });

  elesfn$l.padding = function () {
    var ele = this[0];
    var _p = ele._private;

    if (ele.isParent()) {
      ele.updateCompoundBounds();

      if (_p.autoPadding !== undefined) {
        return _p.autoPadding;
      } else {
        return ele.pstyle('padding').pfValue;
      }
    } else {
      return ele.pstyle('padding').pfValue;
    }
  };

  elesfn$l.paddedHeight = function () {
    var ele = this[0];
    return ele.height() + 2 * ele.padding();
  };

  elesfn$l.paddedWidth = function () {
    var ele = this[0];
    return ele.width() + 2 * ele.padding();
  };

  var widthHeight = elesfn$l;

  var ifEdge = function ifEdge(ele, getValue) {
    if (ele.isEdge()) {
      return getValue(ele);
    }
  };

  var ifEdgeRenderedPosition = function ifEdgeRenderedPosition(ele, getPoint) {
    if (ele.isEdge()) {
      var cy = ele.cy();
      return modelToRenderedPosition(getPoint(ele), cy.zoom(), cy.pan());
    }
  };

  var ifEdgeRenderedPositions = function ifEdgeRenderedPositions(ele, getPoints) {
    if (ele.isEdge()) {
      var cy = ele.cy();
      var pan = cy.pan();
      var zoom = cy.zoom();
      return getPoints(ele).map(function (p) {
        return modelToRenderedPosition(p, zoom, pan);
      });
    }
  };

  var controlPoints = function controlPoints(ele) {
    return ele.renderer().getControlPoints(ele);
  };

  var segmentPoints = function segmentPoints(ele) {
    return ele.renderer().getSegmentPoints(ele);
  };

  var sourceEndpoint = function sourceEndpoint(ele) {
    return ele.renderer().getSourceEndpoint(ele);
  };

  var targetEndpoint = function targetEndpoint(ele) {
    return ele.renderer().getTargetEndpoint(ele);
  };

  var midpoint = function midpoint(ele) {
    return ele.renderer().getEdgeMidpoint(ele);
  };

  var pts = {
    controlPoints: {
      get: controlPoints,
      mult: true
    },
    segmentPoints: {
      get: segmentPoints,
      mult: true
    },
    sourceEndpoint: {
      get: sourceEndpoint
    },
    targetEndpoint: {
      get: targetEndpoint
    },
    midpoint: {
      get: midpoint
    }
  };

  var renderedName = function renderedName(name) {
    return 'rendered' + name[0].toUpperCase() + name.substr(1);
  };

  var edgePoints = Object.keys(pts).reduce(function (obj, name) {
    var spec = pts[name];
    var rName = renderedName(name);

    obj[name] = function () {
      return ifEdge(this, spec.get);
    };

    if (spec.mult) {
      obj[rName] = function () {
        return ifEdgeRenderedPositions(this, spec.get);
      };
    } else {
      obj[rName] = function () {
        return ifEdgeRenderedPosition(this, spec.get);
      };
    }

    return obj;
  }, {});

  var dimensions = extend({}, position, bounds, widthHeight, edgePoints);

  /*!
  Event object based on jQuery events, MIT license

  https://jquery.org/license/
  https://tldrlegal.com/license/mit-license
  https://github.com/jquery/jquery/blob/master/src/event.js
  */
  var Event = function Event(src, props) {
    this.recycle(src, props);
  };

  function returnFalse() {
    return false;
  }

  function returnTrue() {
    return true;
  } // http://www.w3.org/TR/2003/WD-DOM-Level-3-Events-20030331/ecma-script-binding.html


  Event.prototype = {
    instanceString: function instanceString() {
      return 'event';
    },
    recycle: function recycle(src, props) {
      this.isImmediatePropagationStopped = this.isPropagationStopped = this.isDefaultPrevented = returnFalse;

      if (src != null && src.preventDefault) {
        // Browser Event object
        this.type = src.type; // Events bubbling up the document may have been marked as prevented
        // by a handler lower down the tree; reflect the correct value.

        this.isDefaultPrevented = src.defaultPrevented ? returnTrue : returnFalse;
      } else if (src != null && src.type) {
        // Plain object containing all event details
        props = src;
      } else {
        // Event string
        this.type = src;
      } // Put explicitly provided properties onto the event object


      if (props != null) {
        // more efficient to manually copy fields we use
        this.originalEvent = props.originalEvent;
        this.type = props.type != null ? props.type : this.type;
        this.cy = props.cy;
        this.target = props.target;
        this.position = props.position;
        this.renderedPosition = props.renderedPosition;
        this.namespace = props.namespace;
        this.layout = props.layout;
      }

      if (this.cy != null && this.position != null && this.renderedPosition == null) {
        // create a rendered position based on the passed position
        var pos = this.position;
        var zoom = this.cy.zoom();
        var pan = this.cy.pan();
        this.renderedPosition = {
          x: pos.x * zoom + pan.x,
          y: pos.y * zoom + pan.y
        };
      } // Create a timestamp if incoming event doesn't have one


      this.timeStamp = src && src.timeStamp || Date.now();
    },
    preventDefault: function preventDefault() {
      this.isDefaultPrevented = returnTrue;
      var e = this.originalEvent;

      if (!e) {
        return;
      } // if preventDefault exists run it on the original event


      if (e.preventDefault) {
        e.preventDefault();
      }
    },
    stopPropagation: function stopPropagation() {
      this.isPropagationStopped = returnTrue;
      var e = this.originalEvent;

      if (!e) {
        return;
      } // if stopPropagation exists run it on the original event


      if (e.stopPropagation) {
        e.stopPropagation();
      }
    },
    stopImmediatePropagation: function stopImmediatePropagation() {
      this.isImmediatePropagationStopped = returnTrue;
      this.stopPropagation();
    },
    isDefaultPrevented: returnFalse,
    isPropagationStopped: returnFalse,
    isImmediatePropagationStopped: returnFalse
  };

  var eventRegex = /^([^.]+)(\.(?:[^.]+))?$/; // regex for matching event strings (e.g. "click.namespace")

  var universalNamespace = '.*'; // matches as if no namespace specified and prevents users from unbinding accidentally

  var defaults$8 = {
    qualifierCompare: function qualifierCompare(q1, q2) {
      return q1 === q2;
    },
    eventMatches: function eventMatches()
    /*context, listener, eventObj*/
    {
      return true;
    },
    addEventFields: function addEventFields()
    /*context, evt*/
    {},
    callbackContext: function callbackContext(context
    /*, listener, eventObj*/
    ) {
      return context;
    },
    beforeEmit: function beforeEmit()
    /* context, listener, eventObj */
    {},
    afterEmit: function afterEmit()
    /* context, listener, eventObj */
    {},
    bubble: function bubble()
    /*context*/
    {
      return false;
    },
    parent: function parent()
    /*context*/
    {
      return null;
    },
    context: null
  };
  var defaultsKeys = Object.keys(defaults$8);
  var emptyOpts = {};

  function Emitter() {
    var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : emptyOpts;
    var context = arguments.length > 1 ? arguments[1] : undefined;

    // micro-optimisation vs Object.assign() -- reduces Element instantiation time
    for (var i = 0; i < defaultsKeys.length; i++) {
      var key = defaultsKeys[i];
      this[key] = opts[key] || defaults$8[key];
    }

    this.context = context || this.context;
    this.listeners = [];
    this.emitting = 0;
  }

  var p = Emitter.prototype;

  var forEachEvent = function forEachEvent(self, handler, events, qualifier, callback, conf, confOverrides) {
    if (fn(qualifier)) {
      callback = qualifier;
      qualifier = null;
    }

    if (confOverrides) {
      if (conf == null) {
        conf = confOverrides;
      } else {
        conf = extend({}, conf, confOverrides);
      }
    }

    var eventList = array(events) ? events : events.split(/\s+/);

    for (var i = 0; i < eventList.length; i++) {
      var evt = eventList[i];

      if (emptyString(evt)) {
        continue;
      }

      var match = evt.match(eventRegex); // type[.namespace]

      if (match) {
        var type = match[1];
        var namespace = match[2] ? match[2] : null;
        var ret = handler(self, evt, type, namespace, qualifier, callback, conf);

        if (ret === false) {
          break;
        } // allow exiting early

      }
    }
  };

  var makeEventObj = function makeEventObj(self, obj) {
    self.addEventFields(self.context, obj);
    return new Event(obj.type, obj);
  };

  var forEachEventObj = function forEachEventObj(self, handler, events) {
    if (event(events)) {
      handler(self, events);
      return;
    } else if (plainObject(events)) {
      handler(self, makeEventObj(self, events));
      return;
    }

    var eventList = array(events) ? events : events.split(/\s+/);

    for (var i = 0; i < eventList.length; i++) {
      var evt = eventList[i];

      if (emptyString(evt)) {
        continue;
      }

      var match = evt.match(eventRegex); // type[.namespace]

      if (match) {
        var type = match[1];
        var namespace = match[2] ? match[2] : null;
        var eventObj = makeEventObj(self, {
          type: type,
          namespace: namespace,
          target: self.context
        });
        handler(self, eventObj);
      }
    }
  };

  p.on = p.addListener = function (events, qualifier, callback, conf, confOverrides) {
    forEachEvent(this, function (self, event, type, namespace, qualifier, callback, conf) {
      if (fn(callback)) {
        self.listeners.push({
          event: event,
          // full event string
          callback: callback,
          // callback to run
          type: type,
          // the event type (e.g. 'click')
          namespace: namespace,
          // the event namespace (e.g. ".foo")
          qualifier: qualifier,
          // a restriction on whether to match this emitter
          conf: conf // additional configuration

        });
      }
    }, events, qualifier, callback, conf, confOverrides);
    return this;
  };

  p.one = function (events, qualifier, callback, conf) {
    return this.on(events, qualifier, callback, conf, {
      one: true
    });
  };

  p.removeListener = p.off = function (events, qualifier, callback, conf) {
    var _this = this;

    if (this.emitting !== 0) {
      this.listeners = copyArray(this.listeners);
    }

    var listeners = this.listeners;

    var _loop = function _loop(i) {
      var listener = listeners[i];
      forEachEvent(_this, function (self, event, type, namespace, qualifier, callback
      /*, conf*/
      ) {
        if ((listener.type === type || events === '*') && (!namespace && listener.namespace !== '.*' || listener.namespace === namespace) && (!qualifier || self.qualifierCompare(listener.qualifier, qualifier)) && (!callback || listener.callback === callback)) {
          listeners.splice(i, 1);
          return false;
        }
      }, events, qualifier, callback, conf);
    };

    for (var i = listeners.length - 1; i >= 0; i--) {
      _loop(i);
    }

    return this;
  };

  p.removeAllListeners = function () {
    return this.removeListener('*');
  };

  p.emit = p.trigger = function (events, extraParams, manualCallback) {
    var listeners = this.listeners;
    var numListenersBeforeEmit = listeners.length;
    this.emitting++;

    if (!array(extraParams)) {
      extraParams = [extraParams];
    }

    forEachEventObj(this, function (self, eventObj) {
      if (manualCallback != null) {
        listeners = [{
          event: eventObj.event,
          type: eventObj.type,
          namespace: eventObj.namespace,
          callback: manualCallback
        }];
        numListenersBeforeEmit = listeners.length;
      }

      var _loop2 = function _loop2(i) {
        var listener = listeners[i];

        if (listener.type === eventObj.type && (!listener.namespace || listener.namespace === eventObj.namespace || listener.namespace === universalNamespace) && self.eventMatches(self.context, listener, eventObj)) {
          var args = [eventObj];

          if (extraParams != null) {
            push(args, extraParams);
          }

          self.beforeEmit(self.context, listener, eventObj);

          if (listener.conf && listener.conf.one) {
            self.listeners = self.listeners.filter(function (l) {
              return l !== listener;
            });
          }

          var context = self.callbackContext(self.context, listener, eventObj);
          var ret = listener.callback.apply(context, args);
          self.afterEmit(self.context, listener, eventObj);

          if (ret === false) {
            eventObj.stopPropagation();
            eventObj.preventDefault();
          }
        } // if listener matches

      };

      for (var i = 0; i < numListenersBeforeEmit; i++) {
        _loop2(i);
      } // for listener


      if (self.bubble(self.context) && !eventObj.isPropagationStopped()) {
        self.parent(self.context).emit(eventObj, extraParams);
      }
    }, events);
    this.emitting--;
    return this;
  };

  var emitterOptions = {
    qualifierCompare: function qualifierCompare(selector1, selector2) {
      if (selector1 == null || selector2 == null) {
        return selector1 == null && selector2 == null;
      } else {
        return selector1.sameText(selector2);
      }
    },
    eventMatches: function eventMatches(ele, listener, eventObj) {
      var selector = listener.qualifier;

      if (selector != null) {
        return ele !== eventObj.target && element(eventObj.target) && selector.matches(eventObj.target);
      }

      return true;
    },
    addEventFields: function addEventFields(ele, evt) {
      evt.cy = ele.cy();
      evt.target = ele;
    },
    callbackContext: function callbackContext(ele, listener, eventObj) {
      return listener.qualifier != null ? eventObj.target : ele;
    },
    beforeEmit: function beforeEmit(context, listener
    /*, eventObj*/
    ) {
      if (listener.conf && listener.conf.once) {
        listener.conf.onceCollection.removeListener(listener.event, listener.qualifier, listener.callback);
      }
    },
    bubble: function bubble() {
      return true;
    },
    parent: function parent(ele) {
      return ele.isChild() ? ele.parent() : ele.cy();
    }
  };

  var argSelector = function argSelector(arg) {
    if (string(arg)) {
      return new Selector(arg);
    } else {
      return arg;
    }
  };

  var elesfn$m = {
    createEmitter: function createEmitter() {
      for (var i = 0; i < this.length; i++) {
        var ele = this[i];
        var _p = ele._private;

        if (!_p.emitter) {
          _p.emitter = new Emitter(emitterOptions, ele);
        }
      }

      return this;
    },
    emitter: function emitter() {
      return this._private.emitter;
    },
    on: function on(events, selector, callback) {
      var argSel = argSelector(selector);

      for (var i = 0; i < this.length; i++) {
        var ele = this[i];
        ele.emitter().on(events, argSel, callback);
      }

      return this;
    },
    removeListener: function removeListener(events, selector, callback) {
      var argSel = argSelector(selector);

      for (var i = 0; i < this.length; i++) {
        var ele = this[i];
        ele.emitter().removeListener(events, argSel, callback);
      }

      return this;
    },
    removeAllListeners: function removeAllListeners() {
      for (var i = 0; i < this.length; i++) {
        var ele = this[i];
        ele.emitter().removeAllListeners();
      }

      return this;
    },
    one: function one(events, selector, callback) {
      var argSel = argSelector(selector);

      for (var i = 0; i < this.length; i++) {
        var ele = this[i];
        ele.emitter().one(events, argSel, callback);
      }

      return this;
    },
    once: function once(events, selector, callback) {
      var argSel = argSelector(selector);

      for (var i = 0; i < this.length; i++) {
        var ele = this[i];
        ele.emitter().on(events, argSel, callback, {
          once: true,
          onceCollection: this
        });
      }
    },
    emit: function emit(events, extraParams) {
      for (var i = 0; i < this.length; i++) {
        var ele = this[i];
        ele.emitter().emit(events, extraParams);
      }

      return this;
    },
    emitAndNotify: function emitAndNotify(event, extraParams) {
      // for internal use only
      if (this.length === 0) {
        return;
      } // empty collections don't need to notify anything
      // notify renderer


      this.cy().notify(event, this);
      this.emit(event, extraParams);
      return this;
    }
  };
  define$3.eventAliasesOn(elesfn$m);

  var elesfn$n = {
    nodes: function nodes(selector) {
      return this.filter(function (ele) {
        return ele.isNode();
      }).filter(selector);
    },
    edges: function edges(selector) {
      return this.filter(function (ele) {
        return ele.isEdge();
      }).filter(selector);
    },
    // internal helper to get nodes and edges as separate collections with single iteration over elements
    byGroup: function byGroup() {
      var nodes = this.spawn();
      var edges = this.spawn();

      for (var i = 0; i < this.length; i++) {
        var ele = this[i];

        if (ele.isNode()) {
          nodes.push(ele);
        } else {
          edges.push(ele);
        }
      }

      return {
        nodes: nodes,
        edges: edges
      };
    },
    filter: function filter(_filter, thisArg) {
      if (_filter === undefined) {
        // check this first b/c it's the most common/performant case
        return this;
      } else if (string(_filter) || elementOrCollection(_filter)) {
        return new Selector(_filter).filter(this);
      } else if (fn(_filter)) {
        var filterEles = this.spawn();
        var eles = this;

        for (var i = 0; i < eles.length; i++) {
          var ele = eles[i];
          var include = thisArg ? _filter.apply(thisArg, [ele, i, eles]) : _filter(ele, i, eles);

          if (include) {
            filterEles.push(ele);
          }
        }

        return filterEles;
      }

      return this.spawn(); // if not handled by above, give 'em an empty collection
    },
    not: function not(toRemove) {
      if (!toRemove) {
        return this;
      } else {
        if (string(toRemove)) {
          toRemove = this.filter(toRemove);
        }

        var elements = this.spawn();

        for (var i = 0; i < this.length; i++) {
          var element = this[i];
          var remove = toRemove.has(element);

          if (!remove) {
            elements.push(element);
          }
        }

        return elements;
      }
    },
    absoluteComplement: function absoluteComplement() {
      var cy = this.cy();
      return cy.mutableElements().not(this);
    },
    intersect: function intersect(other) {
      // if a selector is specified, then filter by it instead
      if (string(other)) {
        var selector = other;
        return this.filter(selector);
      }

      var elements = this.spawn();
      var col1 = this;
      var col2 = other;
      var col1Smaller = this.length < other.length;
      var colS = col1Smaller ? col1 : col2;
      var colL = col1Smaller ? col2 : col1;

      for (var i = 0; i < colS.length; i++) {
        var ele = colS[i];

        if (colL.has(ele)) {
          elements.push(ele);
        }
      }

      return elements;
    },
    xor: function xor(other) {
      var cy = this._private.cy;

      if (string(other)) {
        other = cy.$(other);
      }

      var elements = this.spawn();
      var col1 = this;
      var col2 = other;

      var add = function add(col, other) {
        for (var i = 0; i < col.length; i++) {
          var ele = col[i];
          var id = ele._private.data.id;
          var inOther = other.hasElementWithId(id);

          if (!inOther) {
            elements.push(ele);
          }
        }
      };

      add(col1, col2);
      add(col2, col1);
      return elements;
    },
    diff: function diff(other) {
      var cy = this._private.cy;

      if (string(other)) {
        other = cy.$(other);
      }

      var left = this.spawn();
      var right = this.spawn();
      var both = this.spawn();
      var col1 = this;
      var col2 = other;

      var add = function add(col, other, retEles) {
        for (var i = 0; i < col.length; i++) {
          var ele = col[i];
          var id = ele._private.data.id;
          var inOther = other.hasElementWithId(id);

          if (inOther) {
            both.merge(ele);
          } else {
            retEles.push(ele);
          }
        }
      };

      add(col1, col2, left);
      add(col2, col1, right);
      return {
        left: left,
        right: right,
        both: both
      };
    },
    add: function add(toAdd) {
      var cy = this._private.cy;

      if (!toAdd) {
        return this;
      }

      if (string(toAdd)) {
        var selector = toAdd;
        toAdd = cy.mutableElements().filter(selector);
      }

      var elements = this.spawnSelf();

      for (var i = 0; i < toAdd.length; i++) {
        var ele = toAdd[i];
        var add = !this.has(ele);

        if (add) {
          elements.push(ele);
        }
      }

      return elements;
    },
    // in place merge on calling collection
    merge: function merge(toAdd) {
      var _p = this._private;
      var cy = _p.cy;

      if (!toAdd) {
        return this;
      }

      if (toAdd && string(toAdd)) {
        var selector = toAdd;
        toAdd = cy.mutableElements().filter(selector);
      }

      var map = _p.map;

      for (var i = 0; i < toAdd.length; i++) {
        var toAddEle = toAdd[i];
        var id = toAddEle._private.data.id;
        var add = !map.has(id);

        if (add) {
          var index = this.length++;
          this[index] = toAddEle;
          map.set(id, {
            ele: toAddEle,
            index: index
          });
        }
      }

      return this; // chaining
    },
    unmergeAt: function unmergeAt(i) {
      var ele = this[i];
      var id = ele.id();
      var _p = this._private;
      var map = _p.map; // remove ele

      this[i] = undefined;
      map["delete"](id);
      var unmergedLastEle = i === this.length - 1; // replace empty spot with last ele in collection

      if (this.length > 1 && !unmergedLastEle) {
        var lastEleI = this.length - 1;
        var lastEle = this[lastEleI];
        var lastEleId = lastEle._private.data.id;
        this[lastEleI] = undefined;
        this[i] = lastEle;
        map.set(lastEleId, {
          ele: lastEle,
          index: i
        });
      } // the collection is now 1 ele smaller


      this.length--;
      return this;
    },
    // remove single ele in place in calling collection
    unmergeOne: function unmergeOne(ele) {
      ele = ele[0];
      var _p = this._private;
      var id = ele._private.data.id;
      var map = _p.map;
      var entry = map.get(id);

      if (!entry) {
        return this; // no need to remove
      }

      var i = entry.index;
      this.unmergeAt(i);
      return this;
    },
    // remove eles in place on calling collection
    unmerge: function unmerge(toRemove) {
      var cy = this._private.cy;

      if (!toRemove) {
        return this;
      }

      if (toRemove && string(toRemove)) {
        var selector = toRemove;
        toRemove = cy.mutableElements().filter(selector);
      }

      for (var i = 0; i < toRemove.length; i++) {
        this.unmergeOne(toRemove[i]);
      }

      return this; // chaining
    },
    unmergeBy: function unmergeBy(toRmFn) {
      for (var i = this.length - 1; i >= 0; i--) {
        var ele = this[i];

        if (toRmFn(ele)) {
          this.unmergeAt(i);
        }
      }

      return this;
    },
    map: function map(mapFn, thisArg) {
      var arr = [];
      var eles = this;

      for (var i = 0; i < eles.length; i++) {
        var ele = eles[i];
        var ret = thisArg ? mapFn.apply(thisArg, [ele, i, eles]) : mapFn(ele, i, eles);
        arr.push(ret);
      }

      return arr;
    },
    reduce: function reduce(fn, initialValue) {
      var val = initialValue;
      var eles = this;

      for (var i = 0; i < eles.length; i++) {
        val = fn(val, eles[i], i, eles);
      }

      return val;
    },
    max: function max(valFn, thisArg) {
      var max = -Infinity;
      var maxEle;
      var eles = this;

      for (var i = 0; i < eles.length; i++) {
        var ele = eles[i];
        var val = thisArg ? valFn.apply(thisArg, [ele, i, eles]) : valFn(ele, i, eles);

        if (val > max) {
          max = val;
          maxEle = ele;
        }
      }

      return {
        value: max,
        ele: maxEle
      };
    },
    min: function min(valFn, thisArg) {
      var min = Infinity;
      var minEle;
      var eles = this;

      for (var i = 0; i < eles.length; i++) {
        var ele = eles[i];
        var val = thisArg ? valFn.apply(thisArg, [ele, i, eles]) : valFn(ele, i, eles);

        if (val < min) {
          min = val;
          minEle = ele;
        }
      }

      return {
        value: min,
        ele: minEle
      };
    }
  }; // aliases

  var fn$5 = elesfn$n;
  fn$5['u'] = fn$5['|'] = fn$5['+'] = fn$5.union = fn$5.or = fn$5.add;
  fn$5['\\'] = fn$5['!'] = fn$5['-'] = fn$5.difference = fn$5.relativeComplement = fn$5.subtract = fn$5.not;
  fn$5['n'] = fn$5['&'] = fn$5['.'] = fn$5.and = fn$5.intersection = fn$5.intersect;
  fn$5['^'] = fn$5['(+)'] = fn$5['(-)'] = fn$5.symmetricDifference = fn$5.symdiff = fn$5.xor;
  fn$5.fnFilter = fn$5.filterFn = fn$5.stdFilter = fn$5.filter;
  fn$5.complement = fn$5.abscomp = fn$5.absoluteComplement;

  var elesfn$o = {
    isNode: function isNode() {
      return this.group() === 'nodes';
    },
    isEdge: function isEdge() {
      return this.group() === 'edges';
    },
    isLoop: function isLoop() {
      return this.isEdge() && this.source()[0] === this.target()[0];
    },
    isSimple: function isSimple() {
      return this.isEdge() && this.source()[0] !== this.target()[0];
    },
    group: function group() {
      var ele = this[0];

      if (ele) {
        return ele._private.group;
      }
    }
  };

  /**
   *  Elements are drawn in a specific order based on compound depth (low to high), the element type (nodes above edges),
   *  and z-index (low to high).  These styles affect how this applies:
   *
   *  z-compound-depth: May be `bottom | orphan | auto | top`.  The first drawn is `bottom`, then `orphan` which is the
   *      same depth as the root of the compound graph, followed by the default value `auto` which draws in order from
   *      root to leaves of the compound graph.  The last drawn is `top`.
   *  z-index-compare: May be `auto | manual`.  The default value is `auto` which always draws edges under nodes.
   *      `manual` ignores this convention and draws based on the `z-index` value setting.
   *  z-index: An integer value that affects the relative draw order of elements.  In general, an element with a higher
   *      `z-index` will be drawn on top of an element with a lower `z-index`.
   */

  var zIndexSort = function zIndexSort(a, b) {
    var cy = a.cy();
    var hasCompoundNodes = cy.hasCompoundNodes();

    function getDepth(ele) {
      var style = ele.pstyle('z-compound-depth');

      if (style.value === 'auto') {
        return hasCompoundNodes ? ele.zDepth() : 0;
      } else if (style.value === 'bottom') {
        return -1;
      } else if (style.value === 'top') {
        return MAX_INT;
      } // 'orphan'


      return 0;
    }

    var depthDiff = getDepth(a) - getDepth(b);

    if (depthDiff !== 0) {
      return depthDiff;
    }

    function getEleDepth(ele) {
      var style = ele.pstyle('z-index-compare');

      if (style.value === 'auto') {
        return ele.isNode() ? 1 : 0;
      } // 'manual'


      return 0;
    }

    var eleDiff = getEleDepth(a) - getEleDepth(b);

    if (eleDiff !== 0) {
      return eleDiff;
    }

    var zDiff = a.pstyle('z-index').value - b.pstyle('z-index').value;

    if (zDiff !== 0) {
      return zDiff;
    } // compare indices in the core (order added to graph w/ last on top)


    return a.poolIndex() - b.poolIndex();
  };

  var elesfn$p = {
    forEach: function forEach(fn$1, thisArg) {
      if (fn(fn$1)) {
        var N = this.length;

        for (var i = 0; i < N; i++) {
          var ele = this[i];
          var ret = thisArg ? fn$1.apply(thisArg, [ele, i, this]) : fn$1(ele, i, this);

          if (ret === false) {
            break;
          } // exit each early on return false

        }
      }

      return this;
    },
    toArray: function toArray() {
      var array = [];

      for (var i = 0; i < this.length; i++) {
        array.push(this[i]);
      }

      return array;
    },
    slice: function slice(start, end) {
      var array = [];
      var thisSize = this.length;

      if (end == null) {
        end = thisSize;
      }

      if (start == null) {
        start = 0;
      }

      if (start < 0) {
        start = thisSize + start;
      }

      if (end < 0) {
        end = thisSize + end;
      }

      for (var i = start; i >= 0 && i < end && i < thisSize; i++) {
        array.push(this[i]);
      }

      return this.spawn(array);
    },
    size: function size() {
      return this.length;
    },
    eq: function eq(i) {
      return this[i] || this.spawn();
    },
    first: function first() {
      return this[0] || this.spawn();
    },
    last: function last() {
      return this[this.length - 1] || this.spawn();
    },
    empty: function empty() {
      return this.length === 0;
    },
    nonempty: function nonempty() {
      return !this.empty();
    },
    sort: function sort(sortFn) {
      if (!fn(sortFn)) {
        return this;
      }

      var sorted = this.toArray().sort(sortFn);
      return this.spawn(sorted);
    },
    sortByZIndex: function sortByZIndex() {
      return this.sort(zIndexSort);
    },
    zDepth: function zDepth() {
      var ele = this[0];

      if (!ele) {
        return undefined;
      } // let cy = ele.cy();


      var _p = ele._private;
      var group = _p.group;

      if (group === 'nodes') {
        var depth = _p.data.parent ? ele.parents().size() : 0;

        if (!ele.isParent()) {
          return MAX_INT - 1; // childless nodes always on top
        }

        return depth;
      } else {
        var src = _p.source;
        var tgt = _p.target;
        var srcDepth = src.zDepth();
        var tgtDepth = tgt.zDepth();
        return Math.max(srcDepth, tgtDepth, 0); // depth of deepest parent
      }
    }
  };
  elesfn$p.each = elesfn$p.forEach;

  var defineSymbolIterator = function defineSymbolIterator() {
    var typeofUndef =  "undefined" ;
    var isIteratorSupported = (typeof Symbol === "undefined" ? "undefined" : _typeof(Symbol)) != typeofUndef && _typeof(Symbol.iterator) != typeofUndef; // eslint-disable-line no-undef

    if (isIteratorSupported) {
      elesfn$p[Symbol.iterator] = function () {
        var _this = this;

        // eslint-disable-line no-undef
        var entry = {
          value: undefined,
          done: false
        };
        var i = 0;
        var length = this.length;
        return _defineProperty({
          next: function next() {
            if (i < length) {
              entry.value = _this[i++];
            } else {
              entry.value = undefined;
              entry.done = true;
            }

            return entry;
          }
        }, Symbol.iterator, function () {
          // eslint-disable-line no-undef
          return this;
        });
      };
    }
  };

  defineSymbolIterator();

  var getLayoutDimensionOptions = defaults({
    nodeDimensionsIncludeLabels: false
  });
  var elesfn$q = {
    // Calculates and returns node dimensions { x, y } based on options given
    layoutDimensions: function layoutDimensions(options) {
      options = getLayoutDimensionOptions(options);
      var dims;

      if (!this.takesUpSpace()) {
        dims = {
          w: 0,
          h: 0
        };
      } else if (options.nodeDimensionsIncludeLabels) {
        var bbDim = this.boundingBox();
        dims = {
          w: bbDim.w,
          h: bbDim.h
        };
      } else {
        dims = {
          w: this.outerWidth(),
          h: this.outerHeight()
        };
      } // sanitise the dimensions for external layouts (avoid division by zero)


      if (dims.w === 0 || dims.h === 0) {
        dims.w = dims.h = 1;
      }

      return dims;
    },
    // using standard layout options, apply position function (w/ or w/o animation)
    layoutPositions: function layoutPositions(layout, options, fn) {
      var nodes = this.nodes();
      var cy = this.cy();
      var layoutEles = options.eles; // nodes & edges

      var getMemoizeKey = function getMemoizeKey(node) {
        return node.id();
      };

      var fnMem = memoize(fn, getMemoizeKey); // memoized version of position function

      layout.emit({
        type: 'layoutstart',
        layout: layout
      });
      layout.animations = [];

      var calculateSpacing = function calculateSpacing(spacing, nodesBb, pos) {
        var center = {
          x: nodesBb.x1 + nodesBb.w / 2,
          y: nodesBb.y1 + nodesBb.h / 2
        };
        var spacingVector = {
          // scale from center of bounding box (not necessarily 0,0)
          x: (pos.x - center.x) * spacing,
          y: (pos.y - center.y) * spacing
        };
        return {
          x: center.x + spacingVector.x,
          y: center.y + spacingVector.y
        };
      };

      var useSpacingFactor = options.spacingFactor && options.spacingFactor !== 1;

      var spacingBb = function spacingBb() {
        if (!useSpacingFactor) {
          return null;
        }

        var bb = makeBoundingBox();

        for (var i = 0; i < nodes.length; i++) {
          var node = nodes[i];
          var pos = fnMem(node, i);
          expandBoundingBoxByPoint(bb, pos.x, pos.y);
        }

        return bb;
      };

      var bb = spacingBb();
      var getFinalPos = memoize(function (node, i) {
        var newPos = fnMem(node, i);

        if (useSpacingFactor) {
          var spacing = Math.abs(options.spacingFactor);
          newPos = calculateSpacing(spacing, bb, newPos);
        }

        if (options.transform != null) {
          newPos = options.transform(node, newPos);
        }

        return newPos;
      }, getMemoizeKey);

      if (options.animate) {
        for (var i = 0; i < nodes.length; i++) {
          var node = nodes[i];
          var newPos = getFinalPos(node, i);
          var animateNode = options.animateFilter == null || options.animateFilter(node, i);

          if (animateNode) {
            var ani = node.animation({
              position: newPos,
              duration: options.animationDuration,
              easing: options.animationEasing
            });
            layout.animations.push(ani);
          } else {
            node.position(newPos);
          }
        }

        if (options.fit) {
          var fitAni = cy.animation({
            fit: {
              boundingBox: layoutEles.boundingBoxAt(getFinalPos),
              padding: options.padding
            },
            duration: options.animationDuration,
            easing: options.animationEasing
          });
          layout.animations.push(fitAni);
        } else if (options.zoom !== undefined && options.pan !== undefined) {
          var zoomPanAni = cy.animation({
            zoom: options.zoom,
            pan: options.pan,
            duration: options.animationDuration,
            easing: options.animationEasing
          });
          layout.animations.push(zoomPanAni);
        }

        layout.animations.forEach(function (ani) {
          return ani.play();
        });
        layout.one('layoutready', options.ready);
        layout.emit({
          type: 'layoutready',
          layout: layout
        });
        Promise$1.all(layout.animations.map(function (ani) {
          return ani.promise();
        })).then(function () {
          layout.one('layoutstop', options.stop);
          layout.emit({
            type: 'layoutstop',
            layout: layout
          });
        });
      } else {
        nodes.positions(getFinalPos);

        if (options.fit) {
          cy.fit(options.eles, options.padding);
        }

        if (options.zoom != null) {
          cy.zoom(options.zoom);
        }

        if (options.pan) {
          cy.pan(options.pan);
        }

        layout.one('layoutready', options.ready);
        layout.emit({
          type: 'layoutready',
          layout: layout
        });
        layout.one('layoutstop', options.stop);
        layout.emit({
          type: 'layoutstop',
          layout: layout
        });
      }

      return this; // chaining
    },
    layout: function layout(options) {
      var cy = this.cy();
      return cy.makeLayout(extend({}, options, {
        eles: this
      }));
    }
  }; // aliases:

  elesfn$q.createLayout = elesfn$q.makeLayout = elesfn$q.layout;

  function styleCache(key, fn, ele) {
    var _p = ele._private;
    var cache = _p.styleCache = _p.styleCache || [];
    var val;

    if ((val = cache[key]) != null) {
      return val;
    } else {
      val = cache[key] = fn(ele);
      return val;
    }
  }

  function cacheStyleFunction(key, fn) {
    key = hashString(key);
    return function cachedStyleFunction(ele) {
      return styleCache(key, fn, ele);
    };
  }

  function cachePrototypeStyleFunction(key, fn) {
    key = hashString(key);

    var selfFn = function selfFn(ele) {
      return fn.call(ele);
    };

    return function cachedPrototypeStyleFunction() {
      var ele = this[0];

      if (ele) {
        return styleCache(key, selfFn, ele);
      }
    };
  }

  var elesfn$r = {
    recalculateRenderedStyle: function recalculateRenderedStyle(useCache) {
      var cy = this.cy();
      var renderer = cy.renderer();
      var styleEnabled = cy.styleEnabled();

      if (renderer && styleEnabled) {
        renderer.recalculateRenderedStyle(this, useCache);
      }

      return this;
    },
    dirtyStyleCache: function dirtyStyleCache() {
      var cy = this.cy();

      var dirty = function dirty(ele) {
        return ele._private.styleCache = null;
      };

      if (cy.hasCompoundNodes()) {
        var eles;
        eles = this.spawnSelf().merge(this.descendants()).merge(this.parents());
        eles.merge(eles.connectedEdges());
        eles.forEach(dirty);
      } else {
        this.forEach(function (ele) {
          dirty(ele);
          ele.connectedEdges().forEach(dirty);
        });
      }

      return this;
    },
    // fully updates (recalculates) the style for the elements
    updateStyle: function updateStyle(notifyRenderer) {
      var cy = this._private.cy;

      if (!cy.styleEnabled()) {
        return this;
      }

      if (cy.batching()) {
        var bEles = cy._private.batchStyleEles;
        bEles.merge(this);
        return this; // chaining and exit early when batching
      }

      var hasCompounds = cy.hasCompoundNodes();
      var updatedEles = this;
      notifyRenderer = notifyRenderer || notifyRenderer === undefined ? true : false;

      if (hasCompounds) {
        // then add everything up and down for compound selector checks
        updatedEles = this.spawnSelf().merge(this.descendants()).merge(this.parents());
      } // let changedEles = style.apply( updatedEles );


      var changedEles = updatedEles;

      if (notifyRenderer) {
        changedEles.emitAndNotify('style'); // let renderer know we changed style
      } else {
        changedEles.emit('style'); // just fire the event
      }

      updatedEles.forEach(function (ele) {
        return ele._private.styleDirty = true;
      });
      return this; // chaining
    },
    // get the internal parsed style object for the specified property
    parsedStyle: function parsedStyle(property) {
      var includeNonDefault = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
      var ele = this[0];
      var cy = ele.cy();

      if (!cy.styleEnabled()) {
        return;
      }

      if (ele) {
        if (ele._private.styleDirty) {
          ele._private.styleDirty = false;
          cy.style().apply(ele);
          ele.emitAndNotify('style');
        }

        var overriddenStyle = ele._private.style[property];

        if (overriddenStyle != null) {
          return overriddenStyle;
        } else if (includeNonDefault) {
          return cy.style().getDefaultProperty(property);
        } else {
          return null;
        }
      }
    },
    numericStyle: function numericStyle(property) {
      var ele = this[0];

      if (!ele.cy().styleEnabled()) {
        return;
      }

      if (ele) {
        var pstyle = ele.pstyle(property);
        return pstyle.pfValue !== undefined ? pstyle.pfValue : pstyle.value;
      }
    },
    numericStyleUnits: function numericStyleUnits(property) {
      var ele = this[0];

      if (!ele.cy().styleEnabled()) {
        return;
      }

      if (ele) {
        return ele.pstyle(property).units;
      }
    },
    // get the specified css property as a rendered value (i.e. on-screen value)
    // or get the whole rendered style if no property specified (NB doesn't allow setting)
    renderedStyle: function renderedStyle(property) {
      var cy = this.cy();

      if (!cy.styleEnabled()) {
        return this;
      }

      var ele = this[0];

      if (ele) {
        return cy.style().getRenderedStyle(ele, property);
      }
    },
    // read the calculated css style of the element or override the style (via a bypass)
    style: function style(name, value) {
      var cy = this.cy();

      if (!cy.styleEnabled()) {
        return this;
      }

      var updateTransitions = false;
      var style = cy.style();

      if (plainObject(name)) {
        // then extend the bypass
        var props = name;
        style.applyBypass(this, props, updateTransitions);
        this.emitAndNotify('style'); // let the renderer know we've updated style
      } else if (string(name)) {
        if (value === undefined) {
          // then get the property from the style
          var ele = this[0];

          if (ele) {
            return style.getStylePropertyValue(ele, name);
          } else {
            // empty collection => can't get any value
            return;
          }
        } else {
          // then set the bypass with the property value
          style.applyBypass(this, name, value, updateTransitions);
          this.emitAndNotify('style'); // let the renderer know we've updated style
        }
      } else if (name === undefined) {
        var _ele = this[0];

        if (_ele) {
          return style.getRawStyle(_ele);
        } else {
          // empty collection => can't get any value
          return;
        }
      }

      return this; // chaining
    },
    removeStyle: function removeStyle(names) {
      var cy = this.cy();

      if (!cy.styleEnabled()) {
        return this;
      }

      var updateTransitions = false;
      var style = cy.style();
      var eles = this;

      if (names === undefined) {
        for (var i = 0; i < eles.length; i++) {
          var ele = eles[i];
          style.removeAllBypasses(ele, updateTransitions);
        }
      } else {
        names = names.split(/\s+/);

        for (var _i = 0; _i < eles.length; _i++) {
          var _ele2 = eles[_i];
          style.removeBypasses(_ele2, names, updateTransitions);
        }
      }

      this.emitAndNotify('style'); // let the renderer know we've updated style

      return this; // chaining
    },
    show: function show() {
      this.css('display', 'element');
      return this; // chaining
    },
    hide: function hide() {
      this.css('display', 'none');
      return this; // chaining
    },
    effectiveOpacity: function effectiveOpacity() {
      var cy = this.cy();

      if (!cy.styleEnabled()) {
        return 1;
      }

      var hasCompoundNodes = cy.hasCompoundNodes();
      var ele = this[0];

      if (ele) {
        var _p = ele._private;
        var parentOpacity = ele.pstyle('opacity').value;

        if (!hasCompoundNodes) {
          return parentOpacity;
        }

        var parents = !_p.data.parent ? null : ele.parents();

        if (parents) {
          for (var i = 0; i < parents.length; i++) {
            var parent = parents[i];
            var opacity = parent.pstyle('opacity').value;
            parentOpacity = opacity * parentOpacity;
          }
        }

        return parentOpacity;
      }
    },
    transparent: function transparent() {
      var cy = this.cy();

      if (!cy.styleEnabled()) {
        return false;
      }

      var ele = this[0];
      var hasCompoundNodes = ele.cy().hasCompoundNodes();

      if (ele) {
        if (!hasCompoundNodes) {
          return ele.pstyle('opacity').value === 0;
        } else {
          return ele.effectiveOpacity() === 0;
        }
      }
    },
    backgrounding: function backgrounding() {
      var cy = this.cy();

      if (!cy.styleEnabled()) {
        return false;
      }

      var ele = this[0];
      return ele._private.backgrounding ? true : false;
    }
  };

  function checkCompound(ele, parentOk) {
    var _p = ele._private;
    var parents = _p.data.parent ? ele.parents() : null;

    if (parents) {
      for (var i = 0; i < parents.length; i++) {
        var parent = parents[i];

        if (!parentOk(parent)) {
          return false;
        }
      }
    }

    return true;
  }

  function defineDerivedStateFunction(specs) {
    var ok = specs.ok;
    var edgeOkViaNode = specs.edgeOkViaNode || specs.ok;
    var parentOk = specs.parentOk || specs.ok;
    return function () {
      var cy = this.cy();

      if (!cy.styleEnabled()) {
        return true;
      }

      var ele = this[0];
      var hasCompoundNodes = cy.hasCompoundNodes();

      if (ele) {
        var _p = ele._private;

        if (!ok(ele)) {
          return false;
        }

        if (ele.isNode()) {
          return !hasCompoundNodes || checkCompound(ele, parentOk);
        } else {
          var src = _p.source;
          var tgt = _p.target;
          return edgeOkViaNode(src) && (!hasCompoundNodes || checkCompound(src, edgeOkViaNode)) && (src === tgt || edgeOkViaNode(tgt) && (!hasCompoundNodes || checkCompound(tgt, edgeOkViaNode)));
        }
      }
    };
  }

  var eleTakesUpSpace = cacheStyleFunction('eleTakesUpSpace', function (ele) {
    return ele.pstyle('display').value === 'element' && ele.width() !== 0 && (ele.isNode() ? ele.height() !== 0 : true);
  });
  elesfn$r.takesUpSpace = cachePrototypeStyleFunction('takesUpSpace', defineDerivedStateFunction({
    ok: eleTakesUpSpace
  }));
  var eleInteractive = cacheStyleFunction('eleInteractive', function (ele) {
    return ele.pstyle('events').value === 'yes' && ele.pstyle('visibility').value === 'visible' && eleTakesUpSpace(ele);
  });
  var parentInteractive = cacheStyleFunction('parentInteractive', function (parent) {
    return parent.pstyle('visibility').value === 'visible' && eleTakesUpSpace(parent);
  });
  elesfn$r.interactive = cachePrototypeStyleFunction('interactive', defineDerivedStateFunction({
    ok: eleInteractive,
    parentOk: parentInteractive,
    edgeOkViaNode: eleTakesUpSpace
  }));

  elesfn$r.noninteractive = function () {
    var ele = this[0];

    if (ele) {
      return !ele.interactive();
    }
  };

  var eleVisible = cacheStyleFunction('eleVisible', function (ele) {
    return ele.pstyle('visibility').value === 'visible' && ele.pstyle('opacity').pfValue !== 0 && eleTakesUpSpace(ele);
  });
  var edgeVisibleViaNode = eleTakesUpSpace;
  elesfn$r.visible = cachePrototypeStyleFunction('visible', defineDerivedStateFunction({
    ok: eleVisible,
    edgeOkViaNode: edgeVisibleViaNode
  }));

  elesfn$r.hidden = function () {
    var ele = this[0];

    if (ele) {
      return !ele.visible();
    }
  };

  elesfn$r.isBundledBezier = cachePrototypeStyleFunction('isBundledBezier', function () {
    if (!this.cy().styleEnabled()) {
      return false;
    }

    return !this.removed() && this.pstyle('curve-style').value === 'bezier' && this.takesUpSpace();
  });
  elesfn$r.bypass = elesfn$r.css = elesfn$r.style;
  elesfn$r.renderedCss = elesfn$r.renderedStyle;
  elesfn$r.removeBypass = elesfn$r.removeCss = elesfn$r.removeStyle;
  elesfn$r.pstyle = elesfn$r.parsedStyle;

  var elesfn$s = {};

  function defineSwitchFunction(params) {
    return function () {
      var args = arguments;
      var changedEles = []; // e.g. cy.nodes().select( data, handler )

      if (args.length === 2) {
        var data = args[0];
        var handler = args[1];
        this.on(params.event, data, handler);
      } // e.g. cy.nodes().select( handler )
      else if (args.length === 1 && fn(args[0])) {
          var _handler = args[0];
          this.on(params.event, _handler);
        } // e.g. cy.nodes().select()
        // e.g. (private) cy.nodes().select(['tapselect'])
        else if (args.length === 0 || args.length === 1 && array(args[0])) {
            var addlEvents = args.length === 1 ? args[0] : null;

            for (var i = 0; i < this.length; i++) {
              var ele = this[i];
              var able = !params.ableField || ele._private[params.ableField];
              var changed = ele._private[params.field] != params.value;

              if (params.overrideAble) {
                var overrideAble = params.overrideAble(ele);

                if (overrideAble !== undefined) {
                  able = overrideAble;

                  if (!overrideAble) {
                    return this;
                  } // to save cycles assume not able for all on override

                }
              }

              if (able) {
                ele._private[params.field] = params.value;

                if (changed) {
                  changedEles.push(ele);
                }
              }
            }

            var changedColl = this.spawn(changedEles);
            changedColl.updateStyle(); // change of state => possible change of style

            changedColl.emit(params.event);

            if (addlEvents) {
              changedColl.emit(addlEvents);
            }
          }

      return this;
    };
  }

  function defineSwitchSet(params) {
    elesfn$s[params.field] = function () {
      var ele = this[0];

      if (ele) {
        if (params.overrideField) {
          var val = params.overrideField(ele);

          if (val !== undefined) {
            return val;
          }
        }

        return ele._private[params.field];
      }
    };

    elesfn$s[params.on] = defineSwitchFunction({
      event: params.on,
      field: params.field,
      ableField: params.ableField,
      overrideAble: params.overrideAble,
      value: true
    });
    elesfn$s[params.off] = defineSwitchFunction({
      event: params.off,
      field: params.field,
      ableField: params.ableField,
      overrideAble: params.overrideAble,
      value: false
    });
  }

  defineSwitchSet({
    field: 'locked',
    overrideField: function overrideField(ele) {
      return ele.cy().autolock() ? true : undefined;
    },
    on: 'lock',
    off: 'unlock'
  });
  defineSwitchSet({
    field: 'grabbable',
    overrideField: function overrideField(ele) {
      return ele.cy().autoungrabify() || ele.pannable() ? false : undefined;
    },
    on: 'grabify',
    off: 'ungrabify'
  });
  defineSwitchSet({
    field: 'selected',
    ableField: 'selectable',
    overrideAble: function overrideAble(ele) {
      return ele.cy().autounselectify() ? false : undefined;
    },
    on: 'select',
    off: 'unselect'
  });
  defineSwitchSet({
    field: 'selectable',
    overrideField: function overrideField(ele) {
      return ele.cy().autounselectify() ? false : undefined;
    },
    on: 'selectify',
    off: 'unselectify'
  });
  elesfn$s.deselect = elesfn$s.unselect;

  elesfn$s.grabbed = function () {
    var ele = this[0];

    if (ele) {
      return ele._private.grabbed;
    }
  };

  defineSwitchSet({
    field: 'active',
    on: 'activate',
    off: 'unactivate'
  });
  defineSwitchSet({
    field: 'pannable',
    on: 'panify',
    off: 'unpanify'
  });

  elesfn$s.inactive = function () {
    var ele = this[0];

    if (ele) {
      return !ele._private.active;
    }
  };

  var elesfn$t = {}; // DAG functions
  ////////////////

  var defineDagExtremity = function defineDagExtremity(params) {
    return function dagExtremityImpl(selector) {
      var eles = this;
      var ret = [];

      for (var i = 0; i < eles.length; i++) {
        var ele = eles[i];

        if (!ele.isNode()) {
          continue;
        }

        var disqualified = false;
        var edges = ele.connectedEdges();

        for (var j = 0; j < edges.length; j++) {
          var edge = edges[j];
          var src = edge.source();
          var tgt = edge.target();

          if (params.noIncomingEdges && tgt === ele && src !== ele || params.noOutgoingEdges && src === ele && tgt !== ele) {
            disqualified = true;
            break;
          }
        }

        if (!disqualified) {
          ret.push(ele);
        }
      }

      return this.spawn(ret, true).filter(selector);
    };
  };

  var defineDagOneHop = function defineDagOneHop(params) {
    return function (selector) {
      var eles = this;
      var oEles = [];

      for (var i = 0; i < eles.length; i++) {
        var ele = eles[i];

        if (!ele.isNode()) {
          continue;
        }

        var edges = ele.connectedEdges();

        for (var j = 0; j < edges.length; j++) {
          var edge = edges[j];
          var src = edge.source();
          var tgt = edge.target();

          if (params.outgoing && src === ele) {
            oEles.push(edge);
            oEles.push(tgt);
          } else if (params.incoming && tgt === ele) {
            oEles.push(edge);
            oEles.push(src);
          }
        }
      }

      return this.spawn(oEles, true).filter(selector);
    };
  };

  var defineDagAllHops = function defineDagAllHops(params) {
    return function (selector) {
      var eles = this;
      var sEles = [];
      var sElesIds = {};

      for (;;) {
        var next = params.outgoing ? eles.outgoers() : eles.incomers();

        if (next.length === 0) {
          break;
        } // done if none left


        var newNext = false;

        for (var i = 0; i < next.length; i++) {
          var n = next[i];
          var nid = n.id();

          if (!sElesIds[nid]) {
            sElesIds[nid] = true;
            sEles.push(n);
            newNext = true;
          }
        }

        if (!newNext) {
          break;
        } // done if touched all outgoers already


        eles = next;
      }

      return this.spawn(sEles, true).filter(selector);
    };
  };

  elesfn$t.clearTraversalCache = function () {
    for (var i = 0; i < this.length; i++) {
      this[i]._private.traversalCache = null;
    }
  };

  extend(elesfn$t, {
    // get the root nodes in the DAG
    roots: defineDagExtremity({
      noIncomingEdges: true
    }),
    // get the leaf nodes in the DAG
    leaves: defineDagExtremity({
      noOutgoingEdges: true
    }),
    // normally called children in graph theory
    // these nodes =edges=> outgoing nodes
    outgoers: cache(defineDagOneHop({
      outgoing: true
    }), 'outgoers'),
    // aka DAG descendants
    successors: defineDagAllHops({
      outgoing: true
    }),
    // normally called parents in graph theory
    // these nodes <=edges= incoming nodes
    incomers: cache(defineDagOneHop({
      incoming: true
    }), 'incomers'),
    // aka DAG ancestors
    predecessors: defineDagAllHops({
      incoming: true
    })
  }); // Neighbourhood functions
  //////////////////////////

  extend(elesfn$t, {
    neighborhood: cache(function (selector) {
      var elements = [];
      var nodes = this.nodes();

      for (var i = 0; i < nodes.length; i++) {
        // for all nodes
        var node = nodes[i];
        var connectedEdges = node.connectedEdges(); // for each connected edge, add the edge and the other node

        for (var j = 0; j < connectedEdges.length; j++) {
          var edge = connectedEdges[j];
          var src = edge.source();
          var tgt = edge.target();
          var otherNode = node === src ? tgt : src; // need check in case of loop

          if (otherNode.length > 0) {
            elements.push(otherNode[0]); // add node 1 hop away
          } // add connected edge


          elements.push(edge[0]);
        }
      }

      return this.spawn(elements, true).filter(selector);
    }, 'neighborhood'),
    closedNeighborhood: function closedNeighborhood(selector) {
      return this.neighborhood().add(this).filter(selector);
    },
    openNeighborhood: function openNeighborhood(selector) {
      return this.neighborhood(selector);
    }
  }); // aliases

  elesfn$t.neighbourhood = elesfn$t.neighborhood;
  elesfn$t.closedNeighbourhood = elesfn$t.closedNeighborhood;
  elesfn$t.openNeighbourhood = elesfn$t.openNeighborhood; // Edge functions
  /////////////////

  extend(elesfn$t, {
    source: cache(function sourceImpl(selector) {
      var ele = this[0];
      var src;

      if (ele) {
        src = ele._private.source || ele.cy().collection();
      }

      return src && selector ? src.filter(selector) : src;
    }, 'source'),
    target: cache(function targetImpl(selector) {
      var ele = this[0];
      var tgt;

      if (ele) {
        tgt = ele._private.target || ele.cy().collection();
      }

      return tgt && selector ? tgt.filter(selector) : tgt;
    }, 'target'),
    sources: defineSourceFunction({
      attr: 'source'
    }),
    targets: defineSourceFunction({
      attr: 'target'
    })
  });

  function defineSourceFunction(params) {
    return function sourceImpl(selector) {
      var sources = [];

      for (var i = 0; i < this.length; i++) {
        var ele = this[i];
        var src = ele._private[params.attr];

        if (src) {
          sources.push(src);
        }
      }

      return this.spawn(sources, true).filter(selector);
    };
  }

  extend(elesfn$t, {
    edgesWith: cache(defineEdgesWithFunction(), 'edgesWith'),
    edgesTo: cache(defineEdgesWithFunction({
      thisIsSrc: true
    }), 'edgesTo')
  });

  function defineEdgesWithFunction(params) {
    return function edgesWithImpl(otherNodes) {
      var elements = [];
      var cy = this._private.cy;
      var p = params || {}; // get elements if a selector is specified

      if (string(otherNodes)) {
        otherNodes = cy.$(otherNodes);
      }

      for (var h = 0; h < otherNodes.length; h++) {
        var edges = otherNodes[h]._private.edges;

        for (var i = 0; i < edges.length; i++) {
          var edge = edges[i];
          var edgeData = edge._private.data;
          var thisToOther = this.hasElementWithId(edgeData.source) && otherNodes.hasElementWithId(edgeData.target);
          var otherToThis = otherNodes.hasElementWithId(edgeData.source) && this.hasElementWithId(edgeData.target);
          var edgeConnectsThisAndOther = thisToOther || otherToThis;

          if (!edgeConnectsThisAndOther) {
            continue;
          }

          if (p.thisIsSrc || p.thisIsTgt) {
            if (p.thisIsSrc && !thisToOther) {
              continue;
            }

            if (p.thisIsTgt && !otherToThis) {
              continue;
            }
          }

          elements.push(edge);
        }
      }

      return this.spawn(elements, true);
    };
  }

  extend(elesfn$t, {
    connectedEdges: cache(function (selector) {
      var retEles = [];
      var eles = this;

      for (var i = 0; i < eles.length; i++) {
        var node = eles[i];

        if (!node.isNode()) {
          continue;
        }

        var edges = node._private.edges;

        for (var j = 0; j < edges.length; j++) {
          var edge = edges[j];
          retEles.push(edge);
        }
      }

      return this.spawn(retEles, true).filter(selector);
    }, 'connectedEdges'),
    connectedNodes: cache(function (selector) {
      var retEles = [];
      var eles = this;

      for (var i = 0; i < eles.length; i++) {
        var edge = eles[i];

        if (!edge.isEdge()) {
          continue;
        }

        retEles.push(edge.source()[0]);
        retEles.push(edge.target()[0]);
      }

      return this.spawn(retEles, true).filter(selector);
    }, 'connectedNodes'),
    parallelEdges: cache(defineParallelEdgesFunction(), 'parallelEdges'),
    codirectedEdges: cache(defineParallelEdgesFunction({
      codirected: true
    }), 'codirectedEdges')
  });

  function defineParallelEdgesFunction(params) {
    var defaults = {
      codirected: false
    };
    params = extend({}, defaults, params);
    return function parallelEdgesImpl(selector) {
      // micro-optimised for renderer
      var elements = [];
      var edges = this.edges();
      var p = params; // look at all the edges in the collection

      for (var i = 0; i < edges.length; i++) {
        var edge1 = edges[i];
        var edge1_p = edge1._private;
        var src1 = edge1_p.source;
        var srcid1 = src1._private.data.id;
        var tgtid1 = edge1_p.data.target;
        var srcEdges1 = src1._private.edges; // look at edges connected to the src node of this edge

        for (var j = 0; j < srcEdges1.length; j++) {
          var edge2 = srcEdges1[j];
          var edge2data = edge2._private.data;
          var tgtid2 = edge2data.target;
          var srcid2 = edge2data.source;
          var codirected = tgtid2 === tgtid1 && srcid2 === srcid1;
          var oppdirected = srcid1 === tgtid2 && tgtid1 === srcid2;

          if (p.codirected && codirected || !p.codirected && (codirected || oppdirected)) {
            elements.push(edge2);
          }
        }
      }

      return this.spawn(elements, true).filter(selector);
    };
  } // Misc functions
  /////////////////


  extend(elesfn$t, {
    components: function components(root) {
      var self = this;
      var cy = self.cy();
      var visited = cy.collection();
      var unvisited = root == null ? self.nodes() : root.nodes();
      var components = [];

      if (root != null && unvisited.empty()) {
        // root may contain only edges
        unvisited = root.sources(); // doesn't matter which node to use (undirected), so just use the source sides
      }

      var visitInComponent = function visitInComponent(node, component) {
        visited.merge(node);
        unvisited.unmerge(node);
        component.merge(node);
      };

      if (unvisited.empty()) {
        return self.spawn();
      }

      var _loop = function _loop() {
        // each iteration yields a component
        var cmpt = cy.collection();
        components.push(cmpt);
        var root = unvisited[0];
        visitInComponent(root, cmpt);
        self.bfs({
          directed: false,
          roots: root,
          visit: function visit(v) {
            return visitInComponent(v, cmpt);
          }
        });
        cmpt.forEach(function (node) {
          node.connectedEdges().forEach(function (e) {
            // connectedEdges() usually cached
            if (self.has(e) && cmpt.has(e.source()) && cmpt.has(e.target())) {
              // has() is cheap
              cmpt.merge(e); // forEach() only considers nodes -- sets N at call time
            }
          });
        });
      };

      do {
        _loop();
      } while (unvisited.length > 0);

      return components;
    },
    component: function component() {
      var ele = this[0];
      return ele.cy().mutableElements().components(ele)[0];
    }
  });
  elesfn$t.componentsOf = elesfn$t.components;

  var Collection = function Collection(cy, elements) {
    var unique = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

    if (cy === undefined) {
      error('A collection must have a reference to the core');
      return;
    }

    var map = new Map$1();
    var createdElements = false;

    if (!elements) {
      elements = [];
    } else if (elements.length > 0 && plainObject(elements[0]) && !element(elements[0])) {
      createdElements = true; // make elements from json and restore all at once later

      var eles = [];
      var elesIds = new Set$1();

      for (var i = 0, l = elements.length; i < l; i++) {
        var json = elements[i];

        if (json.data == null) {
          json.data = {};
        }

        var _data = json.data; // make sure newly created elements have valid ids

        if (_data.id == null) {
          _data.id = uuid();
        } else if (cy.hasElementWithId(_data.id) || elesIds.has(_data.id)) {
          continue; // can't create element if prior id already exists
        }

        var ele = new Element(cy, json, false);
        eles.push(ele);
        elesIds.add(_data.id);
      }

      elements = eles;
    }

    this.length = 0;

    for (var _i = 0, _l = elements.length; _i < _l; _i++) {
      var element$1 = elements[_i][0]; // [0] in case elements is an array of collections, rather than array of elements

      if (element$1 == null) {
        continue;
      }

      var id = element$1._private.data.id;

      if (!unique || !map.has(id)) {
        if (unique) {
          map.set(id, {
            index: this.length,
            ele: element$1
          });
        }

        this[this.length] = element$1;
        this.length++;
      }
    }

    this._private = {
      eles: this,
      cy: cy,

      get map() {
        if (this.lazyMap == null) {
          this.rebuildMap();
        }

        return this.lazyMap;
      },

      set map(m) {
        this.lazyMap = m;
      },

      rebuildMap: function rebuildMap() {
        var m = this.lazyMap = new Map$1();
        var eles = this.eles;

        for (var _i2 = 0; _i2 < eles.length; _i2++) {
          var _ele = eles[_i2];
          m.set(_ele.id(), {
            index: _i2,
            ele: _ele
          });
        }
      }
    };

    if (unique) {
      this._private.map = map;
    } // restore the elements if we created them from json


    if (createdElements) {
      this.restore();
    }
  }; // Functions
  ////////////////////////////////////////////////////////////////////////////////////////////////////
  // keep the prototypes in sync (an element has the same functions as a collection)
  // and use elefn and elesfn as shorthands to the prototypes


  var elesfn$u = Element.prototype = Collection.prototype = Object.create(Array.prototype);

  elesfn$u.instanceString = function () {
    return 'collection';
  };

  elesfn$u.spawn = function (eles, unique) {
    return new Collection(this.cy(), eles, unique);
  };

  elesfn$u.spawnSelf = function () {
    return this.spawn(this);
  };

  elesfn$u.cy = function () {
    return this._private.cy;
  };

  elesfn$u.renderer = function () {
    return this._private.cy.renderer();
  };

  elesfn$u.element = function () {
    return this[0];
  };

  elesfn$u.collection = function () {
    if (collection(this)) {
      return this;
    } else {
      // an element
      return new Collection(this._private.cy, [this]);
    }
  };

  elesfn$u.unique = function () {
    return new Collection(this._private.cy, this, true);
  };

  elesfn$u.hasElementWithId = function (id) {
    id = '' + id; // id must be string

    return this._private.map.has(id);
  };

  elesfn$u.getElementById = function (id) {
    id = '' + id; // id must be string

    var cy = this._private.cy;

    var entry = this._private.map.get(id);

    return entry ? entry.ele : new Collection(cy); // get ele or empty collection
  };

  elesfn$u.$id = elesfn$u.getElementById;

  elesfn$u.poolIndex = function () {
    var cy = this._private.cy;
    var eles = cy._private.elements;
    var id = this[0]._private.data.id;
    return eles._private.map.get(id).index;
  };

  elesfn$u.indexOf = function (ele) {
    var id = ele[0]._private.data.id;
    return this._private.map.get(id).index;
  };

  elesfn$u.indexOfId = function (id) {
    id = '' + id; // id must be string

    return this._private.map.get(id).index;
  };

  elesfn$u.json = function (obj) {
    var ele = this.element();
    var cy = this.cy();

    if (ele == null && obj) {
      return this;
    } // can't set to no eles


    if (ele == null) {
      return undefined;
    } // can't get from no eles


    var p = ele._private;

    if (plainObject(obj)) {
      // set
      cy.startBatch();

      if (obj.data) {
        ele.data(obj.data);
        var _data2 = p.data;

        if (ele.isEdge()) {
          // source and target are immutable via data()
          var move = false;
          var spec = {};
          var src = obj.data.source;
          var tgt = obj.data.target;

          if (src != null && src != _data2.source) {
            spec.source = '' + src; // id must be string

            move = true;
          }

          if (tgt != null && tgt != _data2.target) {
            spec.target = '' + tgt; // id must be string

            move = true;
          }

          if (move) {
            ele = ele.move(spec);
          }
        } else {
          // parent is immutable via data()
          var newParentValSpecd = 'parent' in obj.data;
          var parent = obj.data.parent;

          if (newParentValSpecd && (parent != null || _data2.parent != null) && parent != _data2.parent) {
            if (parent === undefined) {
              // can't set undefined imperatively, so use null
              parent = null;
            }

            if (parent != null) {
              parent = '' + parent; // id must be string
            }

            ele = ele.move({
              parent: parent
            });
          }
        }
      }

      if (obj.position) {
        ele.position(obj.position);
      } // ignore group -- immutable


      var checkSwitch = function checkSwitch(k, trueFnName, falseFnName) {
        var obj_k = obj[k];

        if (obj_k != null && obj_k !== p[k]) {
          if (obj_k) {
            ele[trueFnName]();
          } else {
            ele[falseFnName]();
          }
        }
      };

      checkSwitch('removed', 'remove', 'restore');
      checkSwitch('selected', 'select', 'unselect');
      checkSwitch('selectable', 'selectify', 'unselectify');
      checkSwitch('locked', 'lock', 'unlock');
      checkSwitch('grabbable', 'grabify', 'ungrabify');
      checkSwitch('pannable', 'panify', 'unpanify');

      if (obj.classes != null) {
        ele.classes(obj.classes);
      }

      cy.endBatch();
      return this;
    } else if (obj === undefined) {
      // get
      var json = {
        data: copy(p.data),
        position: copy(p.position),
        group: p.group,
        removed: p.removed,
        selected: p.selected,
        selectable: p.selectable,
        locked: p.locked,
        grabbable: p.grabbable,
        pannable: p.pannable,
        classes: null
      };
      json.classes = '';
      var i = 0;
      p.classes.forEach(function (cls) {
        return json.classes += i++ === 0 ? cls : ' ' + cls;
      });
      return json;
    }
  };

  elesfn$u.jsons = function () {
    var jsons = [];

    for (var i = 0; i < this.length; i++) {
      var ele = this[i];
      var json = ele.json();
      jsons.push(json);
    }

    return jsons;
  };

  elesfn$u.clone = function () {
    var cy = this.cy();
    var elesArr = [];

    for (var i = 0; i < this.length; i++) {
      var ele = this[i];
      var json = ele.json();
      var clone = new Element(cy, json, false); // NB no restore

      elesArr.push(clone);
    }

    return new Collection(cy, elesArr);
  };

  elesfn$u.copy = elesfn$u.clone;

  elesfn$u.restore = function () {
    var notifyRenderer = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
    var addToPool = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
    var self = this;
    var cy = self.cy();
    var cy_p = cy._private; // create arrays of nodes and edges, since we need to
    // restore the nodes first

    var nodes = [];
    var edges = [];
    var elements;

    for (var _i3 = 0, l = self.length; _i3 < l; _i3++) {
      var ele = self[_i3];

      if (addToPool && !ele.removed()) {
        // don't need to handle this ele
        continue;
      } // keep nodes first in the array and edges after


      if (ele.isNode()) {
        // put to front of array if node
        nodes.push(ele);
      } else {
        // put to end of array if edge
        edges.push(ele);
      }
    }

    elements = nodes.concat(edges);
    var i;

    var removeFromElements = function removeFromElements() {
      elements.splice(i, 1);
      i--;
    }; // now, restore each element


    for (i = 0; i < elements.length; i++) {
      var _ele2 = elements[i];
      var _private = _ele2._private;
      var _data3 = _private.data; // the traversal cache should start fresh when ele is added

      _ele2.clearTraversalCache(); // set id and validate


      if (!addToPool && !_private.removed) ; else if (_data3.id === undefined) {
        _data3.id = uuid();
      } else if (number(_data3.id)) {
        _data3.id = '' + _data3.id; // now it's a string
      } else if (emptyString(_data3.id) || !string(_data3.id)) {
        error('Can not create element with invalid string ID `' + _data3.id + '`'); // can't create element if it has empty string as id or non-string id

        removeFromElements();
        continue;
      } else if (cy.hasElementWithId(_data3.id)) {
        error('Can not create second element with ID `' + _data3.id + '`'); // can't create element if one already has that id

        removeFromElements();
        continue;
      }

      var id = _data3.id; // id is finalised, now let's keep a ref

      if (_ele2.isNode()) {
        // extra checks for nodes
        var pos = _private.position; // make sure the nodes have a defined position

        if (pos.x == null) {
          pos.x = 0;
        }

        if (pos.y == null) {
          pos.y = 0;
        }
      }

      if (_ele2.isEdge()) {
        // extra checks for edges
        var edge = _ele2;
        var fields = ['source', 'target'];
        var fieldsLength = fields.length;
        var badSourceOrTarget = false;

        for (var j = 0; j < fieldsLength; j++) {
          var field = fields[j];
          var val = _data3[field];

          if (number(val)) {
            val = _data3[field] = '' + _data3[field]; // now string
          }

          if (val == null || val === '') {
            // can't create if source or target is not defined properly
            error('Can not create edge `' + id + '` with unspecified ' + field);
            badSourceOrTarget = true;
          } else if (!cy.hasElementWithId(val)) {
            // can't create edge if one of its nodes doesn't exist
            error('Can not create edge `' + id + '` with nonexistant ' + field + ' `' + val + '`');
            badSourceOrTarget = true;
          }
        }

        if (badSourceOrTarget) {
          removeFromElements();
          continue;
        } // can't create this


        var src = cy.getElementById(_data3.source);
        var tgt = cy.getElementById(_data3.target); // only one edge in node if loop

        if (src.same(tgt)) {
          src._private.edges.push(edge);
        } else {
          src._private.edges.push(edge);

          tgt._private.edges.push(edge);
        }

        edge._private.source = src;
        edge._private.target = tgt;
      } // if is edge
      // create mock ids / indexes maps for element so it can be used like collections


      _private.map = new Map$1();

      _private.map.set(id, {
        ele: _ele2,
        index: 0
      });

      _private.removed = false;

      if (addToPool) {
        cy.addToPool(_ele2);
      }
    } // for each element
    // do compound node sanity checks


    for (var _i4 = 0; _i4 < nodes.length; _i4++) {
      // each node
      var node = nodes[_i4];
      var _data4 = node._private.data;

      if (number(_data4.parent)) {
        // then automake string
        _data4.parent = '' + _data4.parent;
      }

      var parentId = _data4.parent;
      var specifiedParent = parentId != null;

      if (specifiedParent) {
        var parent = cy.getElementById(parentId);

        if (parent.empty()) {
          // non-existant parent; just remove it
          _data4.parent = undefined;
        } else {
          var selfAsParent = false;
          var ancestor = parent;

          while (!ancestor.empty()) {
            if (node.same(ancestor)) {
              // mark self as parent and remove from data
              selfAsParent = true;
              _data4.parent = undefined; // remove parent reference
              // exit or we loop forever

              break;
            }

            ancestor = ancestor.parent();
          }

          if (!selfAsParent) {
            // connect with children
            parent[0]._private.children.push(node);

            node._private.parent = parent[0]; // let the core know we have a compound graph

            cy_p.hasCompoundNodes = true;
          }
        } // else

      } // if specified parent

    } // for each node


    if (elements.length > 0) {
      var restored = elements.length === self.length ? self : new Collection(cy, elements);

      for (var _i5 = 0; _i5 < restored.length; _i5++) {
        var _ele3 = restored[_i5];

        if (_ele3.isNode()) {
          continue;
        } // adding an edge invalidates the traversal caches for the parallel edges


        _ele3.parallelEdges().clearTraversalCache(); // adding an edge invalidates the traversal cache for the connected nodes


        _ele3.source().clearTraversalCache();

        _ele3.target().clearTraversalCache();
      }

      var toUpdateStyle;

      if (cy_p.hasCompoundNodes) {
        toUpdateStyle = cy.collection().merge(restored).merge(restored.connectedNodes()).merge(restored.parent());
      } else {
        toUpdateStyle = restored;
      }

      toUpdateStyle.dirtyCompoundBoundsCache().dirtyBoundingBoxCache().updateStyle(notifyRenderer);

      if (notifyRenderer) {
        restored.emitAndNotify('add');
      } else if (addToPool) {
        restored.emit('add');
      }
    }

    return self; // chainability
  };

  elesfn$u.removed = function () {
    var ele = this[0];
    return ele && ele._private.removed;
  };

  elesfn$u.inside = function () {
    var ele = this[0];
    return ele && !ele._private.removed;
  };

  elesfn$u.remove = function () {
    var notifyRenderer = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
    var removeFromPool = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
    var self = this;
    var elesToRemove = [];
    var elesToRemoveIds = {};
    var cy = self._private.cy; // add connected edges

    function addConnectedEdges(node) {
      var edges = node._private.edges;

      for (var i = 0; i < edges.length; i++) {
        add(edges[i]);
      }
    } // add descendant nodes


    function addChildren(node) {
      var children = node._private.children;

      for (var i = 0; i < children.length; i++) {
        add(children[i]);
      }
    }

    function add(ele) {
      var alreadyAdded = elesToRemoveIds[ele.id()];

      if (removeFromPool && ele.removed() || alreadyAdded) {
        return;
      } else {
        elesToRemoveIds[ele.id()] = true;
      }

      if (ele.isNode()) {
        elesToRemove.push(ele); // nodes are removed last

        addConnectedEdges(ele);
        addChildren(ele);
      } else {
        elesToRemove.unshift(ele); // edges are removed first
      }
    } // make the list of elements to remove
    // (may be removing more than specified due to connected edges etc)


    for (var i = 0, l = self.length; i < l; i++) {
      var ele = self[i];
      add(ele);
    }

    function removeEdgeRef(node, edge) {
      var connectedEdges = node._private.edges;
      removeFromArray(connectedEdges, edge); // removing an edges invalidates the traversal cache for its nodes

      node.clearTraversalCache();
    }

    function removeParallelRef(pllEdge) {
      // removing an edge invalidates the traversal caches for the parallel edges
      pllEdge.clearTraversalCache();
    }

    var alteredParents = [];
    alteredParents.ids = {};

    function removeChildRef(parent, ele) {
      ele = ele[0];
      parent = parent[0];
      var children = parent._private.children;
      var pid = parent.id();
      removeFromArray(children, ele); // remove parent => child ref

      ele._private.parent = null; // remove child => parent ref

      if (!alteredParents.ids[pid]) {
        alteredParents.ids[pid] = true;
        alteredParents.push(parent);
      }
    }

    self.dirtyCompoundBoundsCache();

    if (removeFromPool) {
      cy.removeFromPool(elesToRemove); // remove from core pool
    }

    for (var _i6 = 0; _i6 < elesToRemove.length; _i6++) {
      var _ele4 = elesToRemove[_i6];

      if (_ele4.isEdge()) {
        // remove references to this edge in its connected nodes
        var src = _ele4.source()[0];

        var tgt = _ele4.target()[0];

        removeEdgeRef(src, _ele4);
        removeEdgeRef(tgt, _ele4);

        var pllEdges = _ele4.parallelEdges();

        for (var j = 0; j < pllEdges.length; j++) {
          var pllEdge = pllEdges[j];
          removeParallelRef(pllEdge);

          if (pllEdge.isBundledBezier()) {
            pllEdge.dirtyBoundingBoxCache();
          }
        }
      } else {
        // remove reference to parent
        var parent = _ele4.parent();

        if (parent.length !== 0) {
          removeChildRef(parent, _ele4);
        }
      }

      if (removeFromPool) {
        // mark as removed
        _ele4._private.removed = true;
      }
    } // check to see if we have a compound graph or not


    var elesStillInside = cy._private.elements;
    cy._private.hasCompoundNodes = false;

    for (var _i7 = 0; _i7 < elesStillInside.length; _i7++) {
      var _ele5 = elesStillInside[_i7];

      if (_ele5.isParent()) {
        cy._private.hasCompoundNodes = true;
        break;
      }
    }

    var removedElements = new Collection(this.cy(), elesToRemove);

    if (removedElements.size() > 0) {
      // must manually notify since trigger won't do this automatically once removed
      if (notifyRenderer) {
        removedElements.emitAndNotify('remove');
      } else if (removeFromPool) {
        removedElements.emit('remove');
      }
    } // the parents who were modified by the removal need their style updated


    for (var _i8 = 0; _i8 < alteredParents.length; _i8++) {
      var _ele6 = alteredParents[_i8];

      if (!removeFromPool || !_ele6.removed()) {
        _ele6.updateStyle();
      }
    }

    return removedElements;
  };

  elesfn$u.move = function (struct) {
    var cy = this._private.cy;
    var eles = this; // just clean up refs, caches, etc. in the same way as when removing and then restoring
    // (our calls to remove/restore do not remove from the graph or make events)

    var notifyRenderer = false;
    var modifyPool = false;

    var toString = function toString(id) {
      return id == null ? id : '' + id;
    }; // id must be string


    if (struct.source !== undefined || struct.target !== undefined) {
      var srcId = toString(struct.source);
      var tgtId = toString(struct.target);
      var srcExists = srcId != null && cy.hasElementWithId(srcId);
      var tgtExists = tgtId != null && cy.hasElementWithId(tgtId);

      if (srcExists || tgtExists) {
        cy.batch(function () {
          // avoid duplicate style updates
          eles.remove(notifyRenderer, modifyPool); // clean up refs etc.

          eles.emitAndNotify('moveout');

          for (var i = 0; i < eles.length; i++) {
            var ele = eles[i];
            var _data5 = ele._private.data;

            if (ele.isEdge()) {
              if (srcExists) {
                _data5.source = srcId;
              }

              if (tgtExists) {
                _data5.target = tgtId;
              }
            }
          }

          eles.restore(notifyRenderer, modifyPool); // make new refs, style, etc.
        });
        eles.emitAndNotify('move');
      }
    } else if (struct.parent !== undefined) {
      // move node to new parent
      var parentId = toString(struct.parent);
      var parentExists = parentId === null || cy.hasElementWithId(parentId);

      if (parentExists) {
        var pidToAssign = parentId === null ? undefined : parentId;
        cy.batch(function () {
          // avoid duplicate style updates
          var updated = eles.remove(notifyRenderer, modifyPool); // clean up refs etc.

          updated.emitAndNotify('moveout');

          for (var i = 0; i < eles.length; i++) {
            var ele = eles[i];
            var _data6 = ele._private.data;

            if (ele.isNode()) {
              _data6.parent = pidToAssign;
            }
          }

          updated.restore(notifyRenderer, modifyPool); // make new refs, style, etc.
        });
        eles.emitAndNotify('move');
      }
    }

    return this;
  };

  [elesfn$c, elesfn$d, elesfn$e, elesfn$f, elesfn$g, data$1, elesfn$i, dimensions, elesfn$m, elesfn$n, elesfn$o, elesfn$p, elesfn$q, elesfn$r, elesfn$s, elesfn$t].forEach(function (props) {
    extend(elesfn$u, props);
  });

  var corefn = {
    add: function add(opts) {
      var elements;
      var cy = this; // add the elements

      if (elementOrCollection(opts)) {
        var eles = opts;

        if (eles._private.cy === cy) {
          // same instance => just restore
          elements = eles.restore();
        } else {
          // otherwise, copy from json
          var jsons = [];

          for (var i = 0; i < eles.length; i++) {
            var ele = eles[i];
            jsons.push(ele.json());
          }

          elements = new Collection(cy, jsons);
        }
      } // specify an array of options
      else if (array(opts)) {
          var _jsons = opts;
          elements = new Collection(cy, _jsons);
        } // specify via opts.nodes and opts.edges
        else if (plainObject(opts) && (array(opts.nodes) || array(opts.edges))) {
            var elesByGroup = opts;
            var _jsons2 = [];
            var grs = ['nodes', 'edges'];

            for (var _i = 0, il = grs.length; _i < il; _i++) {
              var group = grs[_i];
              var elesArray = elesByGroup[group];

              if (array(elesArray)) {
                for (var j = 0, jl = elesArray.length; j < jl; j++) {
                  var json = extend({
                    group: group
                  }, elesArray[j]);

                  _jsons2.push(json);
                }
              }
            }

            elements = new Collection(cy, _jsons2);
          } // specify options for one element
          else {
              var _json = opts;
              elements = new Element(cy, _json).collection();
            }

      return elements;
    },
    remove: function remove(collection) {
      if (elementOrCollection(collection)) ; else if (string(collection)) {
        var selector = collection;
        collection = this.$(selector);
      }

      return collection.remove();
    }
  };

  /* global Float32Array */

  /*! Bezier curve function generator. Copyright Gaetan Renaudeau. MIT License: http://en.wikipedia.org/wiki/MIT_License */
  function generateCubicBezier(mX1, mY1, mX2, mY2) {
    var NEWTON_ITERATIONS = 4,
        NEWTON_MIN_SLOPE = 0.001,
        SUBDIVISION_PRECISION = 0.0000001,
        SUBDIVISION_MAX_ITERATIONS = 10,
        kSplineTableSize = 11,
        kSampleStepSize = 1.0 / (kSplineTableSize - 1.0),
        float32ArraySupported = typeof Float32Array !== 'undefined';
    /* Must contain four arguments. */

    if (arguments.length !== 4) {
      return false;
    }
    /* Arguments must be numbers. */


    for (var i = 0; i < 4; ++i) {
      if (typeof arguments[i] !== "number" || isNaN(arguments[i]) || !isFinite(arguments[i])) {
        return false;
      }
    }
    /* X values must be in the [0, 1] range. */


    mX1 = Math.min(mX1, 1);
    mX2 = Math.min(mX2, 1);
    mX1 = Math.max(mX1, 0);
    mX2 = Math.max(mX2, 0);
    var mSampleValues = float32ArraySupported ? new Float32Array(kSplineTableSize) : new Array(kSplineTableSize);

    function A(aA1, aA2) {
      return 1.0 - 3.0 * aA2 + 3.0 * aA1;
    }

    function B(aA1, aA2) {
      return 3.0 * aA2 - 6.0 * aA1;
    }

    function C(aA1) {
      return 3.0 * aA1;
    }

    function calcBezier(aT, aA1, aA2) {
      return ((A(aA1, aA2) * aT + B(aA1, aA2)) * aT + C(aA1)) * aT;
    }

    function getSlope(aT, aA1, aA2) {
      return 3.0 * A(aA1, aA2) * aT * aT + 2.0 * B(aA1, aA2) * aT + C(aA1);
    }

    function newtonRaphsonIterate(aX, aGuessT) {
      for (var _i = 0; _i < NEWTON_ITERATIONS; ++_i) {
        var currentSlope = getSlope(aGuessT, mX1, mX2);

        if (currentSlope === 0.0) {
          return aGuessT;
        }

        var currentX = calcBezier(aGuessT, mX1, mX2) - aX;
        aGuessT -= currentX / currentSlope;
      }

      return aGuessT;
    }

    function calcSampleValues() {
      for (var _i2 = 0; _i2 < kSplineTableSize; ++_i2) {
        mSampleValues[_i2] = calcBezier(_i2 * kSampleStepSize, mX1, mX2);
      }
    }

    function binarySubdivide(aX, aA, aB) {
      var currentX,
          currentT,
          i = 0;

      do {
        currentT = aA + (aB - aA) / 2.0;
        currentX = calcBezier(currentT, mX1, mX2) - aX;

        if (currentX > 0.0) {
          aB = currentT;
        } else {
          aA = currentT;
        }
      } while (Math.abs(currentX) > SUBDIVISION_PRECISION && ++i < SUBDIVISION_MAX_ITERATIONS);

      return currentT;
    }

    function getTForX(aX) {
      var intervalStart = 0.0,
          currentSample = 1,
          lastSample = kSplineTableSize - 1;

      for (; currentSample !== lastSample && mSampleValues[currentSample] <= aX; ++currentSample) {
        intervalStart += kSampleStepSize;
      }

      --currentSample;
      var dist = (aX - mSampleValues[currentSample]) / (mSampleValues[currentSample + 1] - mSampleValues[currentSample]),
          guessForT = intervalStart + dist * kSampleStepSize,
          initialSlope = getSlope(guessForT, mX1, mX2);

      if (initialSlope >= NEWTON_MIN_SLOPE) {
        return newtonRaphsonIterate(aX, guessForT);
      } else if (initialSlope === 0.0) {
        return guessForT;
      } else {
        return binarySubdivide(aX, intervalStart, intervalStart + kSampleStepSize);
      }
    }

    var _precomputed = false;

    function precompute() {
      _precomputed = true;

      if (mX1 !== mY1 || mX2 !== mY2) {
        calcSampleValues();
      }
    }

    var f = function f(aX) {
      if (!_precomputed) {
        precompute();
      }

      if (mX1 === mY1 && mX2 === mY2) {
        return aX;
      }

      if (aX === 0) {
        return 0;
      }

      if (aX === 1) {
        return 1;
      }

      return calcBezier(getTForX(aX), mY1, mY2);
    };

    f.getControlPoints = function () {
      return [{
        x: mX1,
        y: mY1
      }, {
        x: mX2,
        y: mY2
      }];
    };

    var str = "generateBezier(" + [mX1, mY1, mX2, mY2] + ")";

    f.toString = function () {
      return str;
    };

    return f;
  }

  /*! Runge-Kutta spring physics function generator. Adapted from Framer.js, copyright Koen Bok. MIT License: http://en.wikipedia.org/wiki/MIT_License */

  /* Given a tension, friction, and duration, a simulation at 60FPS will first run without a defined duration in order to calculate the full path. A second pass
     then adjusts the time delta -- using the relation between actual time and duration -- to calculate the path for the duration-constrained animation. */
  var generateSpringRK4 = function () {
    function springAccelerationForState(state) {
      return -state.tension * state.x - state.friction * state.v;
    }

    function springEvaluateStateWithDerivative(initialState, dt, derivative) {
      var state = {
        x: initialState.x + derivative.dx * dt,
        v: initialState.v + derivative.dv * dt,
        tension: initialState.tension,
        friction: initialState.friction
      };
      return {
        dx: state.v,
        dv: springAccelerationForState(state)
      };
    }

    function springIntegrateState(state, dt) {
      var a = {
        dx: state.v,
        dv: springAccelerationForState(state)
      },
          b = springEvaluateStateWithDerivative(state, dt * 0.5, a),
          c = springEvaluateStateWithDerivative(state, dt * 0.5, b),
          d = springEvaluateStateWithDerivative(state, dt, c),
          dxdt = 1.0 / 6.0 * (a.dx + 2.0 * (b.dx + c.dx) + d.dx),
          dvdt = 1.0 / 6.0 * (a.dv + 2.0 * (b.dv + c.dv) + d.dv);
      state.x = state.x + dxdt * dt;
      state.v = state.v + dvdt * dt;
      return state;
    }

    return function springRK4Factory(tension, friction, duration) {
      var initState = {
        x: -1,
        v: 0,
        tension: null,
        friction: null
      },
          path = [0],
          time_lapsed = 0,
          tolerance = 1 / 10000,
          DT = 16 / 1000,
          have_duration,
          dt,
          last_state;
      tension = parseFloat(tension) || 500;
      friction = parseFloat(friction) || 20;
      duration = duration || null;
      initState.tension = tension;
      initState.friction = friction;
      have_duration = duration !== null;
      /* Calculate the actual time it takes for this animation to complete with the provided conditions. */

      if (have_duration) {
        /* Run the simulation without a duration. */
        time_lapsed = springRK4Factory(tension, friction);
        /* Compute the adjusted time delta. */

        dt = time_lapsed / duration * DT;
      } else {
        dt = DT;
      }

      for (;;) {
        /* Next/step function .*/
        last_state = springIntegrateState(last_state || initState, dt);
        /* Store the position. */

        path.push(1 + last_state.x);
        time_lapsed += 16;
        /* If the change threshold is reached, break. */

        if (!(Math.abs(last_state.x) > tolerance && Math.abs(last_state.v) > tolerance)) {
          break;
        }
      }
      /* If duration is not defined, return the actual time required for completing this animation. Otherwise, return a closure that holds the
         computed path and returns a snapshot of the position according to a given percentComplete. */


      return !have_duration ? time_lapsed : function (percentComplete) {
        return path[percentComplete * (path.length - 1) | 0];
      };
    };
  }();

  var cubicBezier = function cubicBezier(t1, p1, t2, p2) {
    var bezier = generateCubicBezier(t1, p1, t2, p2);
    return function (start, end, percent) {
      return start + (end - start) * bezier(percent);
    };
  };

  var easings = {
    'linear': function linear(start, end, percent) {
      return start + (end - start) * percent;
    },
    // default easings
    'ease': cubicBezier(0.25, 0.1, 0.25, 1),
    'ease-in': cubicBezier(0.42, 0, 1, 1),
    'ease-out': cubicBezier(0, 0, 0.58, 1),
    'ease-in-out': cubicBezier(0.42, 0, 0.58, 1),
    // sine
    'ease-in-sine': cubicBezier(0.47, 0, 0.745, 0.715),
    'ease-out-sine': cubicBezier(0.39, 0.575, 0.565, 1),
    'ease-in-out-sine': cubicBezier(0.445, 0.05, 0.55, 0.95),
    // quad
    'ease-in-quad': cubicBezier(0.55, 0.085, 0.68, 0.53),
    'ease-out-quad': cubicBezier(0.25, 0.46, 0.45, 0.94),
    'ease-in-out-quad': cubicBezier(0.455, 0.03, 0.515, 0.955),
    // cubic
    'ease-in-cubic': cubicBezier(0.55, 0.055, 0.675, 0.19),
    'ease-out-cubic': cubicBezier(0.215, 0.61, 0.355, 1),
    'ease-in-out-cubic': cubicBezier(0.645, 0.045, 0.355, 1),
    // quart
    'ease-in-quart': cubicBezier(0.895, 0.03, 0.685, 0.22),
    'ease-out-quart': cubicBezier(0.165, 0.84, 0.44, 1),
    'ease-in-out-quart': cubicBezier(0.77, 0, 0.175, 1),
    // quint
    'ease-in-quint': cubicBezier(0.755, 0.05, 0.855, 0.06),
    'ease-out-quint': cubicBezier(0.23, 1, 0.32, 1),
    'ease-in-out-quint': cubicBezier(0.86, 0, 0.07, 1),
    // expo
    'ease-in-expo': cubicBezier(0.95, 0.05, 0.795, 0.035),
    'ease-out-expo': cubicBezier(0.19, 1, 0.22, 1),
    'ease-in-out-expo': cubicBezier(1, 0, 0, 1),
    // circ
    'ease-in-circ': cubicBezier(0.6, 0.04, 0.98, 0.335),
    'ease-out-circ': cubicBezier(0.075, 0.82, 0.165, 1),
    'ease-in-out-circ': cubicBezier(0.785, 0.135, 0.15, 0.86),
    // user param easings...
    'spring': function spring(tension, friction, duration) {
      if (duration === 0) {
        // can't get a spring w/ duration 0
        return easings.linear; // duration 0 => jump to end so impl doesn't matter
      }

      var spring = generateSpringRK4(tension, friction, duration);
      return function (start, end, percent) {
        return start + (end - start) * spring(percent);
      };
    },
    'cubic-bezier': cubicBezier
  };

  function getEasedValue(type, start, end, percent, easingFn) {
    if (percent === 1) {
      return end;
    }

    if (start === end) {
      return end;
    }

    var val = easingFn(start, end, percent);

    if (type == null) {
      return val;
    }

    if (type.roundValue || type.color) {
      val = Math.round(val);
    }

    if (type.min !== undefined) {
      val = Math.max(val, type.min);
    }

    if (type.max !== undefined) {
      val = Math.min(val, type.max);
    }

    return val;
  }

  function getValue(prop, spec) {
    if (prop.pfValue != null || prop.value != null) {
      if (prop.pfValue != null && (spec == null || spec.type.units !== '%')) {
        return prop.pfValue;
      } else {
        return prop.value;
      }
    } else {
      return prop;
    }
  }

  function ease(startProp, endProp, percent, easingFn, propSpec) {
    var type = propSpec != null ? propSpec.type : null;

    if (percent < 0) {
      percent = 0;
    } else if (percent > 1) {
      percent = 1;
    }

    var start = getValue(startProp, propSpec);
    var end = getValue(endProp, propSpec);

    if (number(start) && number(end)) {
      return getEasedValue(type, start, end, percent, easingFn);
    } else if (array(start) && array(end)) {
      var easedArr = [];

      for (var i = 0; i < end.length; i++) {
        var si = start[i];
        var ei = end[i];

        if (si != null && ei != null) {
          var val = getEasedValue(type, si, ei, percent, easingFn);
          easedArr.push(val);
        } else {
          easedArr.push(ei);
        }
      }

      return easedArr;
    }

    return undefined;
  }

  function step(self, ani, now, isCore) {
    var isEles = !isCore;
    var _p = self._private;
    var ani_p = ani._private;
    var pEasing = ani_p.easing;
    var startTime = ani_p.startTime;
    var cy = isCore ? self : self.cy();
    var style = cy.style();

    if (!ani_p.easingImpl) {
      if (pEasing == null) {
        // use default
        ani_p.easingImpl = easings['linear'];
      } else {
        // then define w/ name
        var easingVals;

        if (string(pEasing)) {
          var easingProp = style.parse('transition-timing-function', pEasing);
          easingVals = easingProp.value;
        } else {
          // then assume preparsed array
          easingVals = pEasing;
        }

        var name, args;

        if (string(easingVals)) {
          name = easingVals;
          args = [];
        } else {
          name = easingVals[1];
          args = easingVals.slice(2).map(function (n) {
            return +n;
          });
        }

        if (args.length > 0) {
          // create with args
          if (name === 'spring') {
            args.push(ani_p.duration); // need duration to generate spring
          }

          ani_p.easingImpl = easings[name].apply(null, args);
        } else {
          // static impl by name
          ani_p.easingImpl = easings[name];
        }
      }
    }

    var easing = ani_p.easingImpl;
    var percent;

    if (ani_p.duration === 0) {
      percent = 1;
    } else {
      percent = (now - startTime) / ani_p.duration;
    }

    if (ani_p.applying) {
      percent = ani_p.progress;
    }

    if (percent < 0) {
      percent = 0;
    } else if (percent > 1) {
      percent = 1;
    }

    if (ani_p.delay == null) {
      // then update
      var startPos = ani_p.startPosition;
      var endPos = ani_p.position;

      if (endPos && isEles && !self.locked()) {
        var newPos = {};

        if (valid(startPos.x, endPos.x)) {
          newPos.x = ease(startPos.x, endPos.x, percent, easing);
        }

        if (valid(startPos.y, endPos.y)) {
          newPos.y = ease(startPos.y, endPos.y, percent, easing);
        }

        self.position(newPos);
      }

      var startPan = ani_p.startPan;
      var endPan = ani_p.pan;
      var pan = _p.pan;
      var animatingPan = endPan != null && isCore;

      if (animatingPan) {
        if (valid(startPan.x, endPan.x)) {
          pan.x = ease(startPan.x, endPan.x, percent, easing);
        }

        if (valid(startPan.y, endPan.y)) {
          pan.y = ease(startPan.y, endPan.y, percent, easing);
        }

        self.emit('pan');
      }

      var startZoom = ani_p.startZoom;
      var endZoom = ani_p.zoom;
      var animatingZoom = endZoom != null && isCore;

      if (animatingZoom) {
        if (valid(startZoom, endZoom)) {
          _p.zoom = bound(_p.minZoom, ease(startZoom, endZoom, percent, easing), _p.maxZoom);
        }

        self.emit('zoom');
      }

      if (animatingPan || animatingZoom) {
        self.emit('viewport');
      }

      var props = ani_p.style;

      if (props && props.length > 0 && isEles) {
        for (var i = 0; i < props.length; i++) {
          var prop = props[i];
          var _name = prop.name;
          var end = prop;
          var start = ani_p.startStyle[_name];
          var propSpec = style.properties[start.name];
          var easedVal = ease(start, end, percent, easing, propSpec);
          style.overrideBypass(self, _name, easedVal);
        } // for props


        self.emit('style');
      } // if

    }

    ani_p.progress = percent;
    return percent;
  }

  function valid(start, end) {
    if (start == null || end == null) {
      return false;
    }

    if (number(start) && number(end)) {
      return true;
    } else if (start && end) {
      return true;
    }

    return false;
  }

  function startAnimation(self, ani, now, isCore) {
    var ani_p = ani._private;
    ani_p.started = true;
    ani_p.startTime = now - ani_p.progress * ani_p.duration;
  }

  function stepAll(now, cy) {
    var eles = cy._private.aniEles;
    var doneEles = [];

    function stepOne(ele, isCore) {
      var _p = ele._private;
      var current = _p.animation.current;
      var queue = _p.animation.queue;
      var ranAnis = false; // if nothing currently animating, get something from the queue

      if (current.length === 0) {
        var next = queue.shift();

        if (next) {
          current.push(next);
        }
      }

      var callbacks = function callbacks(_callbacks) {
        for (var j = _callbacks.length - 1; j >= 0; j--) {
          var cb = _callbacks[j];
          cb();
        }

        _callbacks.splice(0, _callbacks.length);
      }; // step and remove if done


      for (var i = current.length - 1; i >= 0; i--) {
        var ani = current[i];
        var ani_p = ani._private;

        if (ani_p.stopped) {
          current.splice(i, 1);
          ani_p.hooked = false;
          ani_p.playing = false;
          ani_p.started = false;
          callbacks(ani_p.frames);
          continue;
        }

        if (!ani_p.playing && !ani_p.applying) {
          continue;
        } // an apply() while playing shouldn't do anything


        if (ani_p.playing && ani_p.applying) {
          ani_p.applying = false;
        }

        if (!ani_p.started) {
          startAnimation(ele, ani, now);
        }

        step(ele, ani, now, isCore);

        if (ani_p.applying) {
          ani_p.applying = false;
        }

        callbacks(ani_p.frames);

        if (ani_p.step != null) {
          ani_p.step(now);
        }

        if (ani.completed()) {
          current.splice(i, 1);
          ani_p.hooked = false;
          ani_p.playing = false;
          ani_p.started = false;
          callbacks(ani_p.completes);
        }

        ranAnis = true;
      }

      if (!isCore && current.length === 0 && queue.length === 0) {
        doneEles.push(ele);
      }

      return ranAnis;
    } // stepElement
    // handle all eles


    var ranEleAni = false;

    for (var e = 0; e < eles.length; e++) {
      var ele = eles[e];
      var handledThisEle = stepOne(ele);
      ranEleAni = ranEleAni || handledThisEle;
    } // each element


    var ranCoreAni = stepOne(cy, true); // notify renderer

    if (ranEleAni || ranCoreAni) {
      if (eles.length > 0) {
        cy.notify('draw', eles);
      } else {
        cy.notify('draw');
      }
    } // remove elements from list of currently animating if its queues are empty


    eles.unmerge(doneEles);
    cy.emit('step');
  } // stepAll

  var corefn$1 = {
    // pull in animation functions
    animate: define$3.animate(),
    animation: define$3.animation(),
    animated: define$3.animated(),
    clearQueue: define$3.clearQueue(),
    delay: define$3.delay(),
    delayAnimation: define$3.delayAnimation(),
    stop: define$3.stop(),
    addToAnimationPool: function addToAnimationPool(eles) {
      var cy = this;

      if (!cy.styleEnabled()) {
        return;
      } // save cycles when no style used


      cy._private.aniEles.merge(eles);
    },
    stopAnimationLoop: function stopAnimationLoop() {
      this._private.animationsRunning = false;
    },
    startAnimationLoop: function startAnimationLoop() {
      var cy = this;
      cy._private.animationsRunning = true;

      if (!cy.styleEnabled()) {
        return;
      } // save cycles when no style used
      // NB the animation loop will exec in headless environments if style enabled
      // and explicit cy.destroy() is necessary to stop the loop


      function headlessStep() {
        if (!cy._private.animationsRunning) {
          return;
        }

        requestAnimationFrame(function animationStep(now) {
          stepAll(now, cy);
          headlessStep();
        });
      }

      var renderer = cy.renderer();

      if (renderer && renderer.beforeRender) {
        // let the renderer schedule animations
        renderer.beforeRender(function rendererAnimationStep(willDraw, now) {
          stepAll(now, cy);
        }, renderer.beforeRenderPriorities.animations);
      } else {
        // manage the animation loop ourselves
        headlessStep(); // first call
      }
    }
  };

  var emitterOptions$1 = {
    qualifierCompare: function qualifierCompare(selector1, selector2) {
      if (selector1 == null || selector2 == null) {
        return selector1 == null && selector2 == null;
      } else {
        return selector1.sameText(selector2);
      }
    },
    eventMatches: function eventMatches(cy, listener, eventObj) {
      var selector = listener.qualifier;

      if (selector != null) {
        return cy !== eventObj.target && element(eventObj.target) && selector.matches(eventObj.target);
      }

      return true;
    },
    addEventFields: function addEventFields(cy, evt) {
      evt.cy = cy;
      evt.target = cy;
    },
    callbackContext: function callbackContext(cy, listener, eventObj) {
      return listener.qualifier != null ? eventObj.target : cy;
    }
  };

  var argSelector$1 = function argSelector(arg) {
    if (string(arg)) {
      return new Selector(arg);
    } else {
      return arg;
    }
  };

  var elesfn$v = {
    createEmitter: function createEmitter() {
      var _p = this._private;

      if (!_p.emitter) {
        _p.emitter = new Emitter(emitterOptions$1, this);
      }

      return this;
    },
    emitter: function emitter() {
      return this._private.emitter;
    },
    on: function on(events, selector, callback) {
      this.emitter().on(events, argSelector$1(selector), callback);
      return this;
    },
    removeListener: function removeListener(events, selector, callback) {
      this.emitter().removeListener(events, argSelector$1(selector), callback);
      return this;
    },
    removeAllListeners: function removeAllListeners() {
      this.emitter().removeAllListeners();
      return this;
    },
    one: function one(events, selector, callback) {
      this.emitter().one(events, argSelector$1(selector), callback);
      return this;
    },
    once: function once(events, selector, callback) {
      this.emitter().one(events, argSelector$1(selector), callback);
      return this;
    },
    emit: function emit(events, extraParams) {
      this.emitter().emit(events, extraParams);
      return this;
    },
    emitAndNotify: function emitAndNotify(event, eles) {
      this.emit(event);
      this.notify(event, eles);
      return this;
    }
  };
  define$3.eventAliasesOn(elesfn$v);

  var corefn$2 = {
    png: function png(options) {
      var renderer = this._private.renderer;
      options = options || {};
      return renderer.png(options);
    },
    jpg: function jpg(options) {
      var renderer = this._private.renderer;
      options = options || {};
      options.bg = options.bg || '#fff';
      return renderer.jpg(options);
    }
  };
  corefn$2.jpeg = corefn$2.jpg;

  var corefn$3 = {
    layout: function layout(options) {
      var cy = this;

      if (options == null) {
        error('Layout options must be specified to make a layout');
        return;
      }

      if (options.name == null) {
        error('A `name` must be specified to make a layout');
        return;
      }

      var name = options.name;
      var Layout = cy.extension('layout', name);

      if (Layout == null) {
        error('No such layout `' + name + '` found.  Did you forget to import it and `cytoscape.use()` it?');
        return;
      }

      var eles;

      if (string(options.eles)) {
        eles = cy.$(options.eles);
      } else {
        eles = options.eles != null ? options.eles : cy.$();
      }

      var layout = new Layout(extend({}, options, {
        cy: cy,
        eles: eles
      }));
      return layout;
    }
  };
  corefn$3.createLayout = corefn$3.makeLayout = corefn$3.layout;

  var corefn$4 = {
    notify: function notify(eventName, eventEles) {
      var _p = this._private;

      if (this.batching()) {
        _p.batchNotifications = _p.batchNotifications || {};
        var eles = _p.batchNotifications[eventName] = _p.batchNotifications[eventName] || this.collection();

        if (eventEles != null) {
          eles.merge(eventEles);
        }

        return; // notifications are disabled during batching
      }

      if (!_p.notificationsEnabled) {
        return;
      } // exit on disabled


      var renderer = this.renderer(); // exit if destroy() called on core or renderer in between frames #1499 #1528

      if (this.destroyed() || !renderer) {
        return;
      }

      renderer.notify(eventName, eventEles);
    },
    notifications: function notifications(bool) {
      var p = this._private;

      if (bool === undefined) {
        return p.notificationsEnabled;
      } else {
        p.notificationsEnabled = bool ? true : false;
      }

      return this;
    },
    noNotifications: function noNotifications(callback) {
      this.notifications(false);
      callback();
      this.notifications(true);
    },
    batching: function batching() {
      return this._private.batchCount > 0;
    },
    startBatch: function startBatch() {
      var _p = this._private;

      if (_p.batchCount == null) {
        _p.batchCount = 0;
      }

      if (_p.batchCount === 0) {
        _p.batchStyleEles = this.collection();
        _p.batchNotifications = {};
      }

      _p.batchCount++;
      return this;
    },
    endBatch: function endBatch() {
      var _p = this._private;

      if (_p.batchCount === 0) {
        return this;
      }

      _p.batchCount--;

      if (_p.batchCount === 0) {
        // update style for dirty eles
        _p.batchStyleEles.updateStyle();

        var renderer = this.renderer(); // notify the renderer of queued eles and event types

        Object.keys(_p.batchNotifications).forEach(function (eventName) {
          var eles = _p.batchNotifications[eventName];

          if (eles.empty()) {
            renderer.notify(eventName);
          } else {
            renderer.notify(eventName, eles);
          }
        });
      }

      return this;
    },
    batch: function batch(callback) {
      this.startBatch();
      callback();
      this.endBatch();
      return this;
    },
    // for backwards compatibility
    batchData: function batchData(map) {
      var cy = this;
      return this.batch(function () {
        var ids = Object.keys(map);

        for (var i = 0; i < ids.length; i++) {
          var id = ids[i];
          var data = map[id];
          var ele = cy.getElementById(id);
          ele.data(data);
        }
      });
    }
  };

  var rendererDefaults = defaults({
    hideEdgesOnViewport: false,
    textureOnViewport: false,
    motionBlur: false,
    motionBlurOpacity: 0.05,
    pixelRatio: undefined,
    desktopTapThreshold: 4,
    touchTapThreshold: 8,
    wheelSensitivity: 1,
    debug: false,
    showFps: false
  });
  var corefn$5 = {
    renderTo: function renderTo(context, zoom, pan, pxRatio) {
      var r = this._private.renderer;
      r.renderTo(context, zoom, pan, pxRatio);
      return this;
    },
    renderer: function renderer() {
      return this._private.renderer;
    },
    forceRender: function forceRender() {
      this.notify('draw');
      return this;
    },
    resize: function resize() {
      this.invalidateSize();
      this.emitAndNotify('resize');
      return this;
    },
    initRenderer: function initRenderer(options) {
      var cy = this;
      var RendererProto = cy.extension('renderer', options.name);

      if (RendererProto == null) {
        error("Can not initialise: No such renderer `".concat(options.name, "` found. Did you forget to import it and `cytoscape.use()` it?"));
        return;
      }

      if (options.wheelSensitivity !== undefined) {
        warn("You have set a custom wheel sensitivity.  This will make your app zoom unnaturally when using mainstream mice.  You should change this value from the default only if you can guarantee that all your users will use the same hardware and OS configuration as your current machine.");
      }

      var rOpts = rendererDefaults(options);
      rOpts.cy = cy;
      cy._private.renderer = new RendererProto(rOpts);
      this.notify('init');
    },
    destroyRenderer: function destroyRenderer() {
      var cy = this;
      cy.notify('destroy'); // destroy the renderer

      var domEle = cy.container();

      if (domEle) {
        domEle._cyreg = null;

        while (domEle.childNodes.length > 0) {
          domEle.removeChild(domEle.childNodes[0]);
        }
      }

      cy._private.renderer = null; // to be extra safe, remove the ref

      cy.mutableElements().forEach(function (ele) {
        var _p = ele._private;
        _p.rscratch = {};
        _p.rstyle = {};
        _p.animation.current = [];
        _p.animation.queue = [];
      });
    },
    onRender: function onRender(fn) {
      return this.on('render', fn);
    },
    offRender: function offRender(fn) {
      return this.off('render', fn);
    }
  };
  corefn$5.invalidateDimensions = corefn$5.resize;

  var corefn$6 = {
    // get a collection
    // - empty collection on no args
    // - collection of elements in the graph on selector arg
    // - guarantee a returned collection when elements or collection specified
    collection: function collection(eles, opts) {
      if (string(eles)) {
        return this.$(eles);
      } else if (elementOrCollection(eles)) {
        return eles.collection();
      } else if (array(eles)) {
        return new Collection(this, eles, opts);
      }

      return new Collection(this);
    },
    nodes: function nodes(selector) {
      var nodes = this.$(function (ele) {
        return ele.isNode();
      });

      if (selector) {
        return nodes.filter(selector);
      }

      return nodes;
    },
    edges: function edges(selector) {
      var edges = this.$(function (ele) {
        return ele.isEdge();
      });

      if (selector) {
        return edges.filter(selector);
      }

      return edges;
    },
    // search the graph like jQuery
    $: function $(selector) {
      var eles = this._private.elements;

      if (selector) {
        return eles.filter(selector);
      } else {
        return eles.spawnSelf();
      }
    },
    mutableElements: function mutableElements() {
      return this._private.elements;
    }
  }; // aliases

  corefn$6.elements = corefn$6.filter = corefn$6.$;

  var styfn = {}; // keys for style blocks, e.g. ttfftt

  var TRUE = 't';
  var FALSE = 'f'; // (potentially expensive calculation)
  // apply the style to the element based on
  // - its bypass
  // - what selectors match it

  styfn.apply = function (eles) {
    var self = this;
    var _p = self._private;
    var cy = _p.cy;
    var updatedEles = cy.collection();

    if (_p.newStyle) {
      // clear style caches
      _p.contextStyles = {};
      _p.propDiffs = {};
      self.cleanElements(eles, true);
    }

    for (var ie = 0; ie < eles.length; ie++) {
      var ele = eles[ie];
      var cxtMeta = self.getContextMeta(ele);

      if (cxtMeta.empty) {
        continue;
      }

      var cxtStyle = self.getContextStyle(cxtMeta);
      var app = self.applyContextStyle(cxtMeta, cxtStyle, ele);

      if (!_p.newStyle) {
        self.updateTransitions(ele, app.diffProps);
      }

      var hintsDiff = self.updateStyleHints(ele);

      if (hintsDiff) {
        updatedEles.push(ele);
      }
    } // for elements


    _p.newStyle = false;
    return updatedEles;
  };

  styfn.getPropertiesDiff = function (oldCxtKey, newCxtKey) {
    var self = this;
    var cache = self._private.propDiffs = self._private.propDiffs || {};
    var dualCxtKey = oldCxtKey + '-' + newCxtKey;
    var cachedVal = cache[dualCxtKey];

    if (cachedVal) {
      return cachedVal;
    }

    var diffProps = [];
    var addedProp = {};

    for (var i = 0; i < self.length; i++) {
      var cxt = self[i];
      var oldHasCxt = oldCxtKey[i] === TRUE;
      var newHasCxt = newCxtKey[i] === TRUE;
      var cxtHasDiffed = oldHasCxt !== newHasCxt;
      var cxtHasMappedProps = cxt.mappedProperties.length > 0;

      if (cxtHasDiffed || newHasCxt && cxtHasMappedProps) {
        var props = void 0;

        if (cxtHasDiffed && cxtHasMappedProps) {
          props = cxt.properties; // suffices b/c mappedProperties is a subset of properties
        } else if (cxtHasDiffed) {
          props = cxt.properties; // need to check them all
        } else if (cxtHasMappedProps) {
          props = cxt.mappedProperties; // only need to check mapped
        }

        for (var j = 0; j < props.length; j++) {
          var prop = props[j];
          var name = prop.name; // if a later context overrides this property, then the fact that this context has switched/diffed doesn't matter
          // (semi expensive check since it makes this function O(n^2) on context length, but worth it since overall result
          // is cached)

          var laterCxtOverrides = false;

          for (var k = i + 1; k < self.length; k++) {
            var laterCxt = self[k];
            var hasLaterCxt = newCxtKey[k] === TRUE;

            if (!hasLaterCxt) {
              continue;
            } // can't override unless the context is active


            laterCxtOverrides = laterCxt.properties[prop.name] != null;

            if (laterCxtOverrides) {
              break;
            } // exit early as long as one later context overrides

          }

          if (!addedProp[name] && !laterCxtOverrides) {
            addedProp[name] = true;
            diffProps.push(name);
          }
        } // for props

      } // if

    } // for contexts


    cache[dualCxtKey] = diffProps;
    return diffProps;
  };

  styfn.getContextMeta = function (ele) {
    var self = this;
    var cxtKey = '';
    var diffProps;
    var prevKey = ele._private.styleCxtKey || '';

    if (self._private.newStyle) {
      prevKey = ''; // since we need to apply all style if a fresh stylesheet
    } // get the cxt key


    for (var i = 0; i < self.length; i++) {
      var context = self[i];
      var contextSelectorMatches = context.selector && context.selector.matches(ele); // NB: context.selector may be null for 'core'

      if (contextSelectorMatches) {
        cxtKey += TRUE;
      } else {
        cxtKey += FALSE;
      }
    } // for context


    diffProps = self.getPropertiesDiff(prevKey, cxtKey);
    ele._private.styleCxtKey = cxtKey;
    return {
      key: cxtKey,
      diffPropNames: diffProps,
      empty: diffProps.length === 0
    };
  }; // gets a computed ele style object based on matched contexts


  styfn.getContextStyle = function (cxtMeta) {
    var cxtKey = cxtMeta.key;
    var self = this;
    var cxtStyles = this._private.contextStyles = this._private.contextStyles || {}; // if already computed style, returned cached copy

    if (cxtStyles[cxtKey]) {
      return cxtStyles[cxtKey];
    }

    var style = {
      _private: {
        key: cxtKey
      }
    };

    for (var i = 0; i < self.length; i++) {
      var cxt = self[i];
      var hasCxt = cxtKey[i] === TRUE;

      if (!hasCxt) {
        continue;
      }

      for (var j = 0; j < cxt.properties.length; j++) {
        var prop = cxt.properties[j];
        style[prop.name] = prop;
      }
    }

    cxtStyles[cxtKey] = style;
    return style;
  };

  styfn.applyContextStyle = function (cxtMeta, cxtStyle, ele) {
    var self = this;
    var diffProps = cxtMeta.diffPropNames;
    var retDiffProps = {};
    var types = self.types;

    for (var i = 0; i < diffProps.length; i++) {
      var diffPropName = diffProps[i];
      var cxtProp = cxtStyle[diffPropName];
      var eleProp = ele.pstyle(diffPropName);

      if (!cxtProp) {
        // no context prop means delete
        if (!eleProp) {
          continue; // no existing prop means nothing needs to be removed
          // nb affects initial application on mapped values like control-point-distances
        } else if (eleProp.bypass) {
          cxtProp = {
            name: diffPropName,
            deleteBypassed: true
          };
        } else {
          cxtProp = {
            name: diffPropName,
            "delete": true
          };
        }
      } // save cycles when the context prop doesn't need to be applied


      if (eleProp === cxtProp) {
        continue;
      } // save cycles when a mapped context prop doesn't need to be applied


      if (cxtProp.mapped === types.fn // context prop is function mapper
      && eleProp != null // some props can be null even by default (e.g. a prop that overrides another one)
      && eleProp.mapping != null // ele prop is a concrete value from from a mapper
      && eleProp.mapping.value === cxtProp.value // the current prop on the ele is a flat prop value for the function mapper
      ) {
          // NB don't write to cxtProp, as it's shared among eles (stored in stylesheet)
          var mapping = eleProp.mapping; // can write to mapping, as it's a per-ele copy

          var fnValue = mapping.fnValue = cxtProp.value(ele); // temporarily cache the value in case of a miss

          if (fnValue === mapping.prevFnValue) {
            continue;
          }
        }

      var retDiffProp = retDiffProps[diffPropName] = {
        prev: eleProp
      };
      self.applyParsedProperty(ele, cxtProp);
      retDiffProp.next = ele.pstyle(diffPropName);

      if (retDiffProp.next && retDiffProp.next.bypass) {
        retDiffProp.next = retDiffProp.next.bypassed;
      }
    }

    return {
      diffProps: retDiffProps
    };
  };

  styfn.updateStyleHints = function (ele) {
    var _p = ele._private;
    var self = this;
    var propNames = self.propertyGroupNames;
    var propGrKeys = self.propertyGroupKeys;

    var propHash = function propHash(ele, propNames, seedKey) {
      return self.getPropertiesHash(ele, propNames, seedKey);
    };

    var oldStyleKey = _p.styleKey;

    if (ele.removed()) {
      return false;
    }

    var isNode = _p.group === 'nodes'; // get the style key hashes per prop group
    // but lazily -- only use non-default prop values to reduce the number of hashes
    //

    var overriddenStyles = ele._private.style;
    propNames = Object.keys(overriddenStyles);

    for (var i = 0; i < propGrKeys.length; i++) {
      var grKey = propGrKeys[i];
      _p.styleKeys[grKey] = [DEFAULT_HASH_SEED, DEFAULT_HASH_SEED_ALT];
    }

    var updateGrKey1 = function updateGrKey1(val, grKey) {
      return _p.styleKeys[grKey][0] = hashInt(val, _p.styleKeys[grKey][0]);
    };

    var updateGrKey2 = function updateGrKey2(val, grKey) {
      return _p.styleKeys[grKey][1] = hashIntAlt(val, _p.styleKeys[grKey][1]);
    };

    var updateGrKey = function updateGrKey(val, grKey) {
      updateGrKey1(val, grKey);
      updateGrKey2(val, grKey);
    };

    var updateGrKeyWStr = function updateGrKeyWStr(strVal, grKey) {
      for (var j = 0; j < strVal.length; j++) {
        var ch = strVal.charCodeAt(j);
        updateGrKey1(ch, grKey);
        updateGrKey2(ch, grKey);
      }
    }; // - hashing works on 32 bit ints b/c we use bitwise ops
    // - small numbers get cut off (e.g. 0.123 is seen as 0 by the hashing function)
    // - raise up small numbers so more significant digits are seen by hashing
    // - make small numbers larger than a normal value to avoid collisions
    // - works in practice and it's relatively cheap


    var N = 2000000000;

    var cleanNum = function cleanNum(val) {
      return -128 < val && val < 128 && Math.floor(val) !== val ? N - (val * 1024 | 0) : val;
    };

    for (var _i = 0; _i < propNames.length; _i++) {
      var name = propNames[_i];
      var parsedProp = overriddenStyles[name];

      if (parsedProp == null) {
        continue;
      }

      var propInfo = this.properties[name];
      var type = propInfo.type;
      var _grKey = propInfo.groupKey;
      var normalizedNumberVal = void 0;

      if (propInfo.hashOverride != null) {
        normalizedNumberVal = propInfo.hashOverride(ele, parsedProp);
      } else if (parsedProp.pfValue != null) {
        normalizedNumberVal = parsedProp.pfValue;
      } // might not be a number if it allows enums


      var numberVal = propInfo.enums == null ? parsedProp.value : null;
      var haveNormNum = normalizedNumberVal != null;
      var haveUnitedNum = numberVal != null;
      var haveNum = haveNormNum || haveUnitedNum;
      var units = parsedProp.units; // numbers are cheaper to hash than strings
      // 1 hash op vs n hash ops (for length n string)

      if (type.number && haveNum && !type.multiple) {
        var v = haveNormNum ? normalizedNumberVal : numberVal;
        updateGrKey(cleanNum(v), _grKey);

        if (!haveNormNum && units != null) {
          updateGrKeyWStr(units, _grKey);
        }
      } else {
        updateGrKeyWStr(parsedProp.strValue, _grKey);
      }
    } // overall style key
    //


    var hash = [DEFAULT_HASH_SEED, DEFAULT_HASH_SEED_ALT];

    for (var _i2 = 0; _i2 < propGrKeys.length; _i2++) {
      var _grKey2 = propGrKeys[_i2];
      var grHash = _p.styleKeys[_grKey2];
      hash[0] = hashInt(grHash[0], hash[0]);
      hash[1] = hashIntAlt(grHash[1], hash[1]);
    }

    _p.styleKey = combineHashes(hash[0], hash[1]); // label dims
    //

    var sk = _p.styleKeys;
    _p.labelDimsKey = combineHashesArray(sk.labelDimensions);
    var labelKeys = propHash(ele, ['label'], sk.labelDimensions);
    _p.labelKey = combineHashesArray(labelKeys);
    _p.labelStyleKey = combineHashesArray(hashArrays(sk.commonLabel, labelKeys));

    if (!isNode) {
      var sourceLabelKeys = propHash(ele, ['source-label'], sk.labelDimensions);
      _p.sourceLabelKey = combineHashesArray(sourceLabelKeys);
      _p.sourceLabelStyleKey = combineHashesArray(hashArrays(sk.commonLabel, sourceLabelKeys));
      var targetLabelKeys = propHash(ele, ['target-label'], sk.labelDimensions);
      _p.targetLabelKey = combineHashesArray(targetLabelKeys);
      _p.targetLabelStyleKey = combineHashesArray(hashArrays(sk.commonLabel, targetLabelKeys));
    } // node
    //


    if (isNode) {
      var _p$styleKeys = _p.styleKeys,
          nodeBody = _p$styleKeys.nodeBody,
          nodeBorder = _p$styleKeys.nodeBorder,
          backgroundImage = _p$styleKeys.backgroundImage,
          compound = _p$styleKeys.compound,
          pie = _p$styleKeys.pie;
      var nodeKeys = [nodeBody, nodeBorder, backgroundImage, compound, pie].filter(function (k) {
        return k != null;
      }).reduce(hashArrays, [DEFAULT_HASH_SEED, DEFAULT_HASH_SEED_ALT]);
      _p.nodeKey = combineHashesArray(nodeKeys);
      _p.hasPie = pie != null && pie[0] !== DEFAULT_HASH_SEED && pie[1] !== DEFAULT_HASH_SEED_ALT;
    }

    return oldStyleKey !== _p.styleKey;
  };

  styfn.clearStyleHints = function (ele) {
    var _p = ele._private;
    _p.styleKeys = {};
    _p.styleKey = null;
    _p.labelKey = null;
    _p.labelStyleKey = null;
    _p.sourceLabelKey = null;
    _p.sourceLabelStyleKey = null;
    _p.targetLabelKey = null;
    _p.targetLabelStyleKey = null;
    _p.nodeKey = null;
    _p.hasPie = null;
  }; // apply a property to the style (for internal use)
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


  styfn.applyParsedProperty = function (ele, parsedProp) {
    var self = this;
    var prop = parsedProp;
    var style = ele._private.style;
    var flatProp;
    var types = self.types;
    var type = self.properties[prop.name].type;
    var propIsBypass = prop.bypass;
    var origProp = style[prop.name];
    var origPropIsBypass = origProp && origProp.bypass;
    var _p = ele._private;
    var flatPropMapping = 'mapping';

    var getVal = function getVal(p) {
      if (p == null) {
        return null;
      } else if (p.pfValue != null) {
        return p.pfValue;
      } else {
        return p.value;
      }
    };

    var checkTriggers = function checkTriggers() {
      var fromVal = getVal(origProp);
      var toVal = getVal(prop);
      self.checkTriggers(ele, prop.name, fromVal, toVal);
    }; // edge sanity checks to prevent the client from making serious mistakes


    if (parsedProp.name === 'curve-style' && ele.isEdge() && ( // loops must be bundled beziers
    parsedProp.value !== 'bezier' && ele.isLoop() || // edges connected to compound nodes can not be haystacks
    parsedProp.value === 'haystack' && (ele.source().isParent() || ele.target().isParent()))) {
      prop = parsedProp = this.parse(parsedProp.name, 'bezier', propIsBypass);
    }

    if (prop["delete"]) {
      // delete the property and use the default value on falsey value
      style[prop.name] = undefined;
      checkTriggers();
      return true;
    }

    if (prop.deleteBypassed) {
      // delete the property that the
      if (!origProp) {
        checkTriggers();
        return true; // can't delete if no prop
      } else if (origProp.bypass) {
        // delete bypassed
        origProp.bypassed = undefined;
        checkTriggers();
        return true;
      } else {
        return false; // we're unsuccessful deleting the bypassed
      }
    } // check if we need to delete the current bypass


    if (prop.deleteBypass) {
      // then this property is just here to indicate we need to delete
      if (!origProp) {
        checkTriggers();
        return true; // property is already not defined
      } else if (origProp.bypass) {
        // then replace the bypass property with the original
        // because the bypassed property was already applied (and therefore parsed), we can just replace it (no reapplying necessary)
        style[prop.name] = origProp.bypassed;
        checkTriggers();
        return true;
      } else {
        return false; // we're unsuccessful deleting the bypass
      }
    }

    var printMappingErr = function printMappingErr() {
      warn('Do not assign mappings to elements without corresponding data (i.e. ele `' + ele.id() + '` has no mapping for property `' + prop.name + '` with data field `' + prop.field + '`); try a `[' + prop.field + ']` selector to limit scope to elements with `' + prop.field + '` defined');
    }; // put the property in the style objects


    switch (prop.mapped) {
      // flatten the property if mapped
      case types.mapData:
        {
          // flatten the field (e.g. data.foo.bar)
          var fields = prop.field.split('.');
          var fieldVal = _p.data;

          for (var i = 0; i < fields.length && fieldVal; i++) {
            var field = fields[i];
            fieldVal = fieldVal[field];
          }

          if (fieldVal == null) {
            printMappingErr();
            return false;
          }

          var percent;

          if (!number(fieldVal)) {
            // then don't apply and fall back on the existing style
            warn('Do not use continuous mappers without specifying numeric data (i.e. `' + prop.field + ': ' + fieldVal + '` for `' + ele.id() + '` is non-numeric)');
            return false;
          } else {
            var fieldWidth = prop.fieldMax - prop.fieldMin;

            if (fieldWidth === 0) {
              // safety check -- not strictly necessary as no props of zero range should be passed here
              percent = 0;
            } else {
              percent = (fieldVal - prop.fieldMin) / fieldWidth;
            }
          } // make sure to bound percent value


          if (percent < 0) {
            percent = 0;
          } else if (percent > 1) {
            percent = 1;
          }

          if (type.color) {
            var r1 = prop.valueMin[0];
            var r2 = prop.valueMax[0];
            var g1 = prop.valueMin[1];
            var g2 = prop.valueMax[1];
            var b1 = prop.valueMin[2];
            var b2 = prop.valueMax[2];
            var a1 = prop.valueMin[3] == null ? 1 : prop.valueMin[3];
            var a2 = prop.valueMax[3] == null ? 1 : prop.valueMax[3];
            var clr = [Math.round(r1 + (r2 - r1) * percent), Math.round(g1 + (g2 - g1) * percent), Math.round(b1 + (b2 - b1) * percent), Math.round(a1 + (a2 - a1) * percent)];
            flatProp = {
              // colours are simple, so just create the flat property instead of expensive string parsing
              bypass: prop.bypass,
              // we're a bypass if the mapping property is a bypass
              name: prop.name,
              value: clr,
              strValue: 'rgb(' + clr[0] + ', ' + clr[1] + ', ' + clr[2] + ')'
            };
          } else if (type.number) {
            var calcValue = prop.valueMin + (prop.valueMax - prop.valueMin) * percent;
            flatProp = this.parse(prop.name, calcValue, prop.bypass, flatPropMapping);
          } else {
            return false; // can only map to colours and numbers
          }

          if (!flatProp) {
            // if we can't flatten the property, then don't apply the property and fall back on the existing style
            printMappingErr();
            return false;
          }

          flatProp.mapping = prop; // keep a reference to the mapping

          prop = flatProp; // the flattened (mapped) property is the one we want

          break;
        }
      // direct mapping

      case types.data:
        {
          // flatten the field (e.g. data.foo.bar)
          var _fields = prop.field.split('.');

          var _fieldVal = _p.data;

          for (var _i3 = 0; _i3 < _fields.length && _fieldVal; _i3++) {
            var _field = _fields[_i3];
            _fieldVal = _fieldVal[_field];
          }

          if (_fieldVal != null) {
            flatProp = this.parse(prop.name, _fieldVal, prop.bypass, flatPropMapping);
          }

          if (!flatProp) {
            // if we can't flatten the property, then don't apply and fall back on the existing style
            printMappingErr();
            return false;
          }

          flatProp.mapping = prop; // keep a reference to the mapping

          prop = flatProp; // the flattened (mapped) property is the one we want

          break;
        }

      case types.fn:
        {
          var fn = prop.value;
          var fnRetVal = prop.fnValue != null ? prop.fnValue : fn(ele); // check for cached value before calling function

          prop.prevFnValue = fnRetVal;

          if (fnRetVal == null) {
            warn('Custom function mappers may not return null (i.e. `' + prop.name + '` for ele `' + ele.id() + '` is null)');
            return false;
          }

          flatProp = this.parse(prop.name, fnRetVal, prop.bypass, flatPropMapping);

          if (!flatProp) {
            warn('Custom function mappers may not return invalid values for the property type (i.e. `' + prop.name + '` for ele `' + ele.id() + '` is invalid)');
            return false;
          }

          flatProp.mapping = copy(prop); // keep a reference to the mapping

          prop = flatProp; // the flattened (mapped) property is the one we want

          break;
        }

      case undefined:
        break;
      // just set the property

      default:
        return false;
      // not a valid mapping
    } // if the property is a bypass property, then link the resultant property to the original one


    if (propIsBypass) {
      if (origPropIsBypass) {
        // then this bypass overrides the existing one
        prop.bypassed = origProp.bypassed; // steal bypassed prop from old bypass
      } else {
        // then link the orig prop to the new bypass
        prop.bypassed = origProp;
      }

      style[prop.name] = prop; // and set
    } else {
      // prop is not bypass
      if (origPropIsBypass) {
        // then keep the orig prop (since it's a bypass) and link to the new prop
        origProp.bypassed = prop;
      } else {
        // then just replace the old prop with the new one
        style[prop.name] = prop;
      }
    }

    checkTriggers();
    return true;
  };

  styfn.cleanElements = function (eles, keepBypasses) {
    for (var i = 0; i < eles.length; i++) {
      var ele = eles[i];
      this.clearStyleHints(ele);
      ele.dirtyCompoundBoundsCache();
      ele.dirtyBoundingBoxCache();

      if (!keepBypasses) {
        ele._private.style = {};
      } else {
        var style = ele._private.style;
        var propNames = Object.keys(style);

        for (var j = 0; j < propNames.length; j++) {
          var propName = propNames[j];
          var eleProp = style[propName];

          if (eleProp != null) {
            if (eleProp.bypass) {
              eleProp.bypassed = null;
            } else {
              style[propName] = null;
            }
          }
        }
      }
    }
  }; // updates the visual style for all elements (useful for manual style modification after init)


  styfn.update = function () {
    var cy = this._private.cy;
    var eles = cy.mutableElements();
    eles.updateStyle();
  }; // diffProps : { name => { prev, next } }


  styfn.updateTransitions = function (ele, diffProps) {
    var self = this;
    var _p = ele._private;
    var props = ele.pstyle('transition-property').value;
    var duration = ele.pstyle('transition-duration').pfValue;
    var delay = ele.pstyle('transition-delay').pfValue;

    if (props.length > 0 && duration > 0) {
      var style = {}; // build up the style to animate towards

      var anyPrev = false;

      for (var i = 0; i < props.length; i++) {
        var prop = props[i];
        var styProp = ele.pstyle(prop);
        var diffProp = diffProps[prop];

        if (!diffProp) {
          continue;
        }

        var prevProp = diffProp.prev;
        var fromProp = prevProp;
        var toProp = diffProp.next != null ? diffProp.next : styProp;
        var diff = false;
        var initVal = void 0;
        var initDt = 0.000001; // delta time % value for initVal (allows animating out of init zero opacity)

        if (!fromProp) {
          continue;
        } // consider px values


        if (number(fromProp.pfValue) && number(toProp.pfValue)) {
          diff = toProp.pfValue - fromProp.pfValue; // nonzero is truthy

          initVal = fromProp.pfValue + initDt * diff; // consider numerical values
        } else if (number(fromProp.value) && number(toProp.value)) {
          diff = toProp.value - fromProp.value; // nonzero is truthy

          initVal = fromProp.value + initDt * diff; // consider colour values
        } else if (array(fromProp.value) && array(toProp.value)) {
          diff = fromProp.value[0] !== toProp.value[0] || fromProp.value[1] !== toProp.value[1] || fromProp.value[2] !== toProp.value[2];
          initVal = fromProp.strValue;
        } // the previous value is good for an animation only if it's different


        if (diff) {
          style[prop] = toProp.strValue; // to val

          this.applyBypass(ele, prop, initVal); // from val

          anyPrev = true;
        }
      } // end if props allow ani
      // can't transition if there's nothing previous to transition from


      if (!anyPrev) {
        return;
      }

      _p.transitioning = true;
      new Promise$1(function (resolve) {
        if (delay > 0) {
          ele.delayAnimation(delay).play().promise().then(resolve);
        } else {
          resolve();
        }
      }).then(function () {
        return ele.animation({
          style: style,
          duration: duration,
          easing: ele.pstyle('transition-timing-function').value,
          queue: false
        }).play().promise();
      }).then(function () {
        // if( !isBypass ){
        self.removeBypasses(ele, props);
        ele.emitAndNotify('style'); // }

        _p.transitioning = false;
      });
    } else if (_p.transitioning) {
      this.removeBypasses(ele, props);
      ele.emitAndNotify('style');
      _p.transitioning = false;
    }
  };

  styfn.checkTrigger = function (ele, name, fromValue, toValue, getTrigger, onTrigger) {
    var prop = this.properties[name];
    var triggerCheck = getTrigger(prop);

    if (triggerCheck != null && triggerCheck(fromValue, toValue)) {
      onTrigger(prop);
    }
  };

  styfn.checkZOrderTrigger = function (ele, name, fromValue, toValue) {
    var _this = this;

    this.checkTrigger(ele, name, fromValue, toValue, function (prop) {
      return prop.triggersZOrder;
    }, function () {
      _this._private.cy.notify('zorder', ele);
    });
  };

  styfn.checkBoundsTrigger = function (ele, name, fromValue, toValue) {
    this.checkTrigger(ele, name, fromValue, toValue, function (prop) {
      return prop.triggersBounds;
    }, function (prop) {
      ele.dirtyCompoundBoundsCache();
      ele.dirtyBoundingBoxCache(); // if the prop change makes the bb of pll bezier edges invalid,
      // then dirty the pll edge bb cache as well

      if ( // only for beziers -- so performance of other edges isn't affected
      name === 'curve-style' && (fromValue === 'bezier' || toValue === 'bezier') && prop.triggersBoundsOfParallelBeziers) {
        ele.parallelEdges().forEach(function (pllEdge) {
          if (pllEdge.isBundledBezier()) {
            pllEdge.dirtyBoundingBoxCache();
          }
        });
      }
    });
  };

  styfn.checkTriggers = function (ele, name, fromValue, toValue) {
    ele.dirtyStyleCache();
    this.checkZOrderTrigger(ele, name, fromValue, toValue);
    this.checkBoundsTrigger(ele, name, fromValue, toValue);
  };

  var styfn$1 = {}; // bypasses are applied to an existing style on an element, and just tacked on temporarily
  // returns true iff application was successful for at least 1 specified property

  styfn$1.applyBypass = function (eles, name, value, updateTransitions) {
    var self = this;
    var props = [];
    var isBypass = true; // put all the properties (can specify one or many) in an array after parsing them

    if (name === '*' || name === '**') {
      // apply to all property names
      if (value !== undefined) {
        for (var i = 0; i < self.properties.length; i++) {
          var prop = self.properties[i];
          var _name = prop.name;
          var parsedProp = this.parse(_name, value, true);

          if (parsedProp) {
            props.push(parsedProp);
          }
        }
      }
    } else if (string(name)) {
      // then parse the single property
      var _parsedProp = this.parse(name, value, true);

      if (_parsedProp) {
        props.push(_parsedProp);
      }
    } else if (plainObject(name)) {
      // then parse each property
      var specifiedProps = name;
      updateTransitions = value;
      var names = Object.keys(specifiedProps);

      for (var _i = 0; _i < names.length; _i++) {
        var _name2 = names[_i];
        var _value = specifiedProps[_name2];

        if (_value === undefined) {
          // try camel case name too
          _value = specifiedProps[dash2camel(_name2)];
        }

        if (_value !== undefined) {
          var _parsedProp2 = this.parse(_name2, _value, true);

          if (_parsedProp2) {
            props.push(_parsedProp2);
          }
        }
      }
    } else {
      // can't do anything without well defined properties
      return false;
    } // we've failed if there are no valid properties


    if (props.length === 0) {
      return false;
    } // now, apply the bypass properties on the elements


    var ret = false; // return true if at least one succesful bypass applied

    for (var _i2 = 0; _i2 < eles.length; _i2++) {
      // for each ele
      var ele = eles[_i2];
      var diffProps = {};
      var diffProp = void 0;

      for (var j = 0; j < props.length; j++) {
        // for each prop
        var _prop = props[j];

        if (updateTransitions) {
          var prevProp = ele.pstyle(_prop.name);
          diffProp = diffProps[_prop.name] = {
            prev: prevProp
          };
        }

        ret = this.applyParsedProperty(ele, copy(_prop)) || ret;

        if (updateTransitions) {
          diffProp.next = ele.pstyle(_prop.name);
        }
      } // for props


      if (ret) {
        this.updateStyleHints(ele);
      }

      if (updateTransitions) {
        this.updateTransitions(ele, diffProps, isBypass);
      }
    } // for eles


    return ret;
  }; // only useful in specific cases like animation


  styfn$1.overrideBypass = function (eles, name, value) {
    name = camel2dash(name);

    for (var i = 0; i < eles.length; i++) {
      var ele = eles[i];
      var prop = ele._private.style[name];
      var type = this.properties[name].type;
      var isColor = type.color;
      var isMulti = type.mutiple;
      var oldValue = !prop ? null : prop.pfValue != null ? prop.pfValue : prop.value;

      if (!prop || !prop.bypass) {
        // need a bypass if one doesn't exist
        this.applyBypass(ele, name, value);
      } else {
        prop.value = value;

        if (prop.pfValue != null) {
          prop.pfValue = value;
        }

        if (isColor) {
          prop.strValue = 'rgb(' + value.join(',') + ')';
        } else if (isMulti) {
          prop.strValue = value.join(' ');
        } else {
          prop.strValue = '' + value;
        }

        this.updateStyleHints(ele);
      }

      this.checkTriggers(ele, name, oldValue, value);
    }
  };

  styfn$1.removeAllBypasses = function (eles, updateTransitions) {
    return this.removeBypasses(eles, this.propertyNames, updateTransitions);
  };

  styfn$1.removeBypasses = function (eles, props, updateTransitions) {
    var isBypass = true;

    for (var j = 0; j < eles.length; j++) {
      var ele = eles[j];
      var diffProps = {};

      for (var i = 0; i < props.length; i++) {
        var name = props[i];
        var prop = this.properties[name];
        var prevProp = ele.pstyle(prop.name);

        if (!prevProp || !prevProp.bypass) {
          // if a bypass doesn't exist for the prop, nothing needs to be removed
          continue;
        }

        var value = ''; // empty => remove bypass

        var parsedProp = this.parse(name, value, true);
        var diffProp = diffProps[prop.name] = {
          prev: prevProp
        };
        this.applyParsedProperty(ele, parsedProp);
        diffProp.next = ele.pstyle(prop.name);
      } // for props


      this.updateStyleHints(ele);

      if (updateTransitions) {
        this.updateTransitions(ele, diffProps, isBypass);
      }
    } // for eles

  };

  var styfn$2 = {}; // gets what an em size corresponds to in pixels relative to a dom element

  styfn$2.getEmSizeInPixels = function () {
    var px = this.containerCss('font-size');

    if (px != null) {
      return parseFloat(px);
    } else {
      return 1; // for headless
    }
  }; // gets css property from the core container


  styfn$2.containerCss = function (propName) {
    var cy = this._private.cy;
    var domElement = cy.container();

    if (window$1 && domElement && window$1.getComputedStyle) {
      return window$1.getComputedStyle(domElement).getPropertyValue(propName);
    }
  };

  var styfn$3 = {}; // gets the rendered style for an element

  styfn$3.getRenderedStyle = function (ele, prop) {
    if (prop) {
      return this.getStylePropertyValue(ele, prop, true);
    } else {
      return this.getRawStyle(ele, true);
    }
  }; // gets the raw style for an element


  styfn$3.getRawStyle = function (ele, isRenderedVal) {
    var self = this;
    ele = ele[0]; // insure it's an element

    if (ele) {
      var rstyle = {};

      for (var i = 0; i < self.properties.length; i++) {
        var prop = self.properties[i];
        var val = self.getStylePropertyValue(ele, prop.name, isRenderedVal);

        if (val != null) {
          rstyle[prop.name] = val;
          rstyle[dash2camel(prop.name)] = val;
        }
      }

      return rstyle;
    }
  };

  styfn$3.getIndexedStyle = function (ele, property, subproperty, index) {
    var pstyle = ele.pstyle(property)[subproperty][index];
    return pstyle != null ? pstyle : ele.cy().style().getDefaultProperty(property)[subproperty][0];
  };

  styfn$3.getStylePropertyValue = function (ele, propName, isRenderedVal) {
    var self = this;
    ele = ele[0]; // insure it's an element

    if (ele) {
      var prop = self.properties[propName];

      if (prop.alias) {
        prop = prop.pointsTo;
      }

      var type = prop.type;
      var styleProp = ele.pstyle(prop.name);

      if (styleProp) {
        var value = styleProp.value,
            units = styleProp.units,
            strValue = styleProp.strValue;

        if (isRenderedVal && type.number && value != null && number(value)) {
          var zoom = ele.cy().zoom();

          var getRenderedValue = function getRenderedValue(val) {
            return val * zoom;
          };

          var getValueStringWithUnits = function getValueStringWithUnits(val, units) {
            return getRenderedValue(val) + units;
          };

          var isArrayValue = array(value);
          var haveUnits = isArrayValue ? units.every(function (u) {
            return u != null;
          }) : units != null;

          if (haveUnits) {
            if (isArrayValue) {
              return value.map(function (v, i) {
                return getValueStringWithUnits(v, units[i]);
              }).join(' ');
            } else {
              return getValueStringWithUnits(value, units);
            }
          } else {
            if (isArrayValue) {
              return value.map(function (v) {
                return string(v) ? v : '' + getRenderedValue(v);
              }).join(' ');
            } else {
              return '' + getRenderedValue(value);
            }
          }
        } else if (strValue != null) {
          return strValue;
        }
      }

      return null;
    }
  };

  styfn$3.getAnimationStartStyle = function (ele, aniProps) {
    var rstyle = {};

    for (var i = 0; i < aniProps.length; i++) {
      var aniProp = aniProps[i];
      var name = aniProp.name;
      var styleProp = ele.pstyle(name);

      if (styleProp !== undefined) {
        // then make a prop of it
        if (plainObject(styleProp)) {
          styleProp = this.parse(name, styleProp.strValue);
        } else {
          styleProp = this.parse(name, styleProp);
        }
      }

      if (styleProp) {
        rstyle[name] = styleProp;
      }
    }

    return rstyle;
  };

  styfn$3.getPropsList = function (propsObj) {
    var self = this;
    var rstyle = [];
    var style = propsObj;
    var props = self.properties;

    if (style) {
      var names = Object.keys(style);

      for (var i = 0; i < names.length; i++) {
        var name = names[i];
        var val = style[name];
        var prop = props[name] || props[camel2dash(name)];
        var styleProp = this.parse(prop.name, val);

        if (styleProp) {
          rstyle.push(styleProp);
        }
      }
    }

    return rstyle;
  };

  styfn$3.getNonDefaultPropertiesHash = function (ele, propNames, seed) {
    var hash = seed.slice();
    var name, val, strVal, chVal;
    var i, j;

    for (i = 0; i < propNames.length; i++) {
      name = propNames[i];
      val = ele.pstyle(name, false);

      if (val == null) {
        continue;
      } else if (val.pfValue != null) {
        hash[0] = hashInt(chVal, hash[0]);
        hash[1] = hashIntAlt(chVal, hash[1]);
      } else {
        strVal = val.strValue;

        for (j = 0; j < strVal.length; j++) {
          chVal = strVal.charCodeAt(j);
          hash[0] = hashInt(chVal, hash[0]);
          hash[1] = hashIntAlt(chVal, hash[1]);
        }
      }
    }

    return hash;
  };

  styfn$3.getPropertiesHash = styfn$3.getNonDefaultPropertiesHash;

  var styfn$4 = {};

  styfn$4.appendFromJson = function (json) {
    var style = this;

    for (var i = 0; i < json.length; i++) {
      var context = json[i];
      var selector = context.selector;
      var props = context.style || context.css;
      var names = Object.keys(props);
      style.selector(selector); // apply selector

      for (var j = 0; j < names.length; j++) {
        var name = names[j];
        var value = props[name];
        style.css(name, value); // apply property
      }
    }

    return style;
  }; // accessible cy.style() function


  styfn$4.fromJson = function (json) {
    var style = this;
    style.resetToDefault();
    style.appendFromJson(json);
    return style;
  }; // get json from cy.style() api


  styfn$4.json = function () {
    var json = [];

    for (var i = this.defaultLength; i < this.length; i++) {
      var cxt = this[i];
      var selector = cxt.selector;
      var props = cxt.properties;
      var css = {};

      for (var j = 0; j < props.length; j++) {
        var prop = props[j];
        css[prop.name] = prop.strValue;
      }

      json.push({
        selector: !selector ? 'core' : selector.toString(),
        style: css
      });
    }

    return json;
  };

  var styfn$5 = {};

  styfn$5.appendFromString = function (string) {
    var self = this;
    var style = this;
    var remaining = '' + string;
    var selAndBlockStr;
    var blockRem;
    var propAndValStr; // remove comments from the style string

    remaining = remaining.replace(/[/][*](\s|.)+?[*][/]/g, '');

    function removeSelAndBlockFromRemaining() {
      // remove the parsed selector and block from the remaining text to parse
      if (remaining.length > selAndBlockStr.length) {
        remaining = remaining.substr(selAndBlockStr.length);
      } else {
        remaining = '';
      }
    }

    function removePropAndValFromRem() {
      // remove the parsed property and value from the remaining block text to parse
      if (blockRem.length > propAndValStr.length) {
        blockRem = blockRem.substr(propAndValStr.length);
      } else {
        blockRem = '';
      }
    }

    for (;;) {
      var nothingLeftToParse = remaining.match(/^\s*$/);

      if (nothingLeftToParse) {
        break;
      }

      var selAndBlock = remaining.match(/^\s*((?:.|\s)+?)\s*\{((?:.|\s)+?)\}/);

      if (!selAndBlock) {
        warn('Halting stylesheet parsing: String stylesheet contains more to parse but no selector and block found in: ' + remaining);
        break;
      }

      selAndBlockStr = selAndBlock[0]; // parse the selector

      var selectorStr = selAndBlock[1];

      if (selectorStr !== 'core') {
        var selector = new Selector(selectorStr);

        if (selector.invalid) {
          warn('Skipping parsing of block: Invalid selector found in string stylesheet: ' + selectorStr); // skip this selector and block

          removeSelAndBlockFromRemaining();
          continue;
        }
      } // parse the block of properties and values


      var blockStr = selAndBlock[2];
      var invalidBlock = false;
      blockRem = blockStr;
      var props = [];

      for (;;) {
        var _nothingLeftToParse = blockRem.match(/^\s*$/);

        if (_nothingLeftToParse) {
          break;
        }

        var propAndVal = blockRem.match(/^\s*(.+?)\s*:\s*(.+?)\s*;/);

        if (!propAndVal) {
          warn('Skipping parsing of block: Invalid formatting of style property and value definitions found in:' + blockStr);
          invalidBlock = true;
          break;
        }

        propAndValStr = propAndVal[0];
        var propStr = propAndVal[1];
        var valStr = propAndVal[2];
        var prop = self.properties[propStr];

        if (!prop) {
          warn('Skipping property: Invalid property name in: ' + propAndValStr); // skip this property in the block

          removePropAndValFromRem();
          continue;
        }

        var parsedProp = style.parse(propStr, valStr);

        if (!parsedProp) {
          warn('Skipping property: Invalid property definition in: ' + propAndValStr); // skip this property in the block

          removePropAndValFromRem();
          continue;
        }

        props.push({
          name: propStr,
          val: valStr
        });
        removePropAndValFromRem();
      }

      if (invalidBlock) {
        removeSelAndBlockFromRemaining();
        break;
      } // put the parsed block in the style


      style.selector(selectorStr);

      for (var i = 0; i < props.length; i++) {
        var _prop = props[i];
        style.css(_prop.name, _prop.val);
      }

      removeSelAndBlockFromRemaining();
    }

    return style;
  };

  styfn$5.fromString = function (string) {
    var style = this;
    style.resetToDefault();
    style.appendFromString(string);
    return style;
  };

  var styfn$6 = {};

  (function () {
    var number = number$1;
    var rgba = rgbaNoBackRefs;
    var hsla = hslaNoBackRefs;
    var hex3$1 = hex3;
    var hex6$1 = hex6;

    var data = function data(prefix) {
      return '^' + prefix + '\\s*\\(\\s*([\\w\\.]+)\\s*\\)$';
    };

    var mapData = function mapData(prefix) {
      var mapArg = number + '|\\w+|' + rgba + '|' + hsla + '|' + hex3$1 + '|' + hex6$1;
      return '^' + prefix + '\\s*\\(([\\w\\.]+)\\s*\\,\\s*(' + number + ')\\s*\\,\\s*(' + number + ')\\s*,\\s*(' + mapArg + ')\\s*\\,\\s*(' + mapArg + ')\\)$';
    };

    var urlRegexes = ['^url\\s*\\(\\s*[\'"]?(.+?)[\'"]?\\s*\\)$', '^(none)$', '^(.+)$']; // each visual style property has a type and needs to be validated according to it

    styfn$6.types = {
      time: {
        number: true,
        min: 0,
        units: 's|ms',
        implicitUnits: 'ms'
      },
      percent: {
        number: true,
        min: 0,
        max: 100,
        units: '%',
        implicitUnits: '%'
      },
      percentages: {
        number: true,
        min: 0,
        max: 100,
        units: '%',
        implicitUnits: '%',
        multiple: true
      },
      zeroOneNumber: {
        number: true,
        min: 0,
        max: 1,
        unitless: true
      },
      zeroOneNumbers: {
        number: true,
        min: 0,
        max: 1,
        unitless: true,
        multiple: true
      },
      nOneOneNumber: {
        number: true,
        min: -1,
        max: 1,
        unitless: true
      },
      nonNegativeInt: {
        number: true,
        min: 0,
        integer: true,
        unitless: true
      },
      position: {
        enums: ['parent', 'origin']
      },
      nodeSize: {
        number: true,
        min: 0,
        enums: ['label']
      },
      number: {
        number: true,
        unitless: true
      },
      numbers: {
        number: true,
        unitless: true,
        multiple: true
      },
      positiveNumber: {
        number: true,
        unitless: true,
        min: 0,
        strictMin: true
      },
      size: {
        number: true,
        min: 0
      },
      bidirectionalSize: {
        number: true
      },
      // allows negative
      bidirectionalSizeMaybePercent: {
        number: true,
        allowPercent: true
      },
      // allows negative
      bidirectionalSizes: {
        number: true,
        multiple: true
      },
      // allows negative
      sizeMaybePercent: {
        number: true,
        min: 0,
        allowPercent: true
      },
      axisDirection: {
        enums: ['horizontal', 'leftward', 'rightward', 'vertical', 'upward', 'downward', 'auto']
      },
      paddingRelativeTo: {
        enums: ['width', 'height', 'average', 'min', 'max']
      },
      bgWH: {
        number: true,
        min: 0,
        allowPercent: true,
        enums: ['auto'],
        multiple: true
      },
      bgPos: {
        number: true,
        allowPercent: true,
        multiple: true
      },
      bgRelativeTo: {
        enums: ['inner', 'include-padding'],
        multiple: true
      },
      bgRepeat: {
        enums: ['repeat', 'repeat-x', 'repeat-y', 'no-repeat'],
        multiple: true
      },
      bgFit: {
        enums: ['none', 'contain', 'cover'],
        multiple: true
      },
      bgCrossOrigin: {
        enums: ['anonymous', 'use-credentials'],
        multiple: true
      },
      bgClip: {
        enums: ['none', 'node'],
        multiple: true
      },
      color: {
        color: true
      },
      colors: {
        color: true,
        multiple: true
      },
      fill: {
        enums: ['solid', 'linear-gradient', 'radial-gradient']
      },
      bool: {
        enums: ['yes', 'no']
      },
      lineStyle: {
        enums: ['solid', 'dotted', 'dashed']
      },
      lineCap: {
        enums: ['butt', 'round', 'square']
      },
      borderStyle: {
        enums: ['solid', 'dotted', 'dashed', 'double']
      },
      curveStyle: {
        enums: ['bezier', 'unbundled-bezier', 'haystack', 'segments', 'straight', 'taxi']
      },
      fontFamily: {
        regex: '^([\\w- \\"]+(?:\\s*,\\s*[\\w- \\"]+)*)$'
      },
      fontStyle: {
        enums: ['italic', 'normal', 'oblique']
      },
      fontWeight: {
        enums: ['normal', 'bold', 'bolder', 'lighter', '100', '200', '300', '400', '500', '600', '800', '900', 100, 200, 300, 400, 500, 600, 700, 800, 900]
      },
      textDecoration: {
        enums: ['none', 'underline', 'overline', 'line-through']
      },
      textTransform: {
        enums: ['none', 'uppercase', 'lowercase']
      },
      textWrap: {
        enums: ['none', 'wrap', 'ellipsis']
      },
      textOverflowWrap: {
        enums: ['whitespace', 'anywhere']
      },
      textBackgroundShape: {
        enums: ['rectangle', 'roundrectangle', 'round-rectangle']
      },
      nodeShape: {
        enums: ['rectangle', 'roundrectangle', 'round-rectangle', 'cutrectangle', 'cut-rectangle', 'bottomroundrectangle', 'bottom-round-rectangle', 'barrel', 'ellipse', 'triangle', 'round-triangle', 'square', 'pentagon', 'round-pentagon', 'hexagon', 'round-hexagon', 'concavehexagon', 'concave-hexagon', 'heptagon', 'round-heptagon', 'octagon', 'round-octagon', 'tag', 'round-tag', 'star', 'diamond', 'round-diamond', 'vee', 'rhomboid', 'polygon']
      },
      compoundIncludeLabels: {
        enums: ['include', 'exclude']
      },
      arrowShape: {
        enums: ['tee', 'triangle', 'triangle-tee', 'circle-triangle', 'triangle-cross', 'triangle-backcurve', 'vee', 'square', 'circle', 'diamond', 'chevron', 'none']
      },
      arrowFill: {
        enums: ['filled', 'hollow']
      },
      display: {
        enums: ['element', 'none']
      },
      visibility: {
        enums: ['hidden', 'visible']
      },
      zCompoundDepth: {
        enums: ['bottom', 'orphan', 'auto', 'top']
      },
      zIndexCompare: {
        enums: ['auto', 'manual']
      },
      valign: {
        enums: ['top', 'center', 'bottom']
      },
      halign: {
        enums: ['left', 'center', 'right']
      },
      justification: {
        enums: ['left', 'center', 'right', 'auto']
      },
      text: {
        string: true
      },
      data: {
        mapping: true,
        regex: data('data')
      },
      layoutData: {
        mapping: true,
        regex: data('layoutData')
      },
      scratch: {
        mapping: true,
        regex: data('scratch')
      },
      mapData: {
        mapping: true,
        regex: mapData('mapData')
      },
      mapLayoutData: {
        mapping: true,
        regex: mapData('mapLayoutData')
      },
      mapScratch: {
        mapping: true,
        regex: mapData('mapScratch')
      },
      fn: {
        mapping: true,
        fn: true
      },
      url: {
        regexes: urlRegexes,
        singleRegexMatchValue: true
      },
      urls: {
        regexes: urlRegexes,
        singleRegexMatchValue: true,
        multiple: true
      },
      propList: {
        propList: true
      },
      angle: {
        number: true,
        units: 'deg|rad',
        implicitUnits: 'rad'
      },
      textRotation: {
        number: true,
        units: 'deg|rad',
        implicitUnits: 'rad',
        enums: ['none', 'autorotate']
      },
      polygonPointList: {
        number: true,
        multiple: true,
        evenMultiple: true,
        min: -1,
        max: 1,
        unitless: true
      },
      edgeDistances: {
        enums: ['intersection', 'node-position']
      },
      edgeEndpoint: {
        number: true,
        multiple: true,
        units: '%|px|em|deg|rad',
        implicitUnits: 'px',
        enums: ['inside-to-node', 'outside-to-node', 'outside-to-node-or-label', 'outside-to-line', 'outside-to-line-or-label'],
        singleEnum: true,
        validate: function validate(valArr, unitsArr) {
          switch (valArr.length) {
            case 2:
              // can be % or px only
              return unitsArr[0] !== 'deg' && unitsArr[0] !== 'rad' && unitsArr[1] !== 'deg' && unitsArr[1] !== 'rad';

            case 1:
              // can be enum, deg, or rad only
              return string(valArr[0]) || unitsArr[0] === 'deg' || unitsArr[0] === 'rad';

            default:
              return false;
          }
        }
      },
      easing: {
        regexes: ['^(spring)\\s*\\(\\s*(' + number + ')\\s*,\\s*(' + number + ')\\s*\\)$', '^(cubic-bezier)\\s*\\(\\s*(' + number + ')\\s*,\\s*(' + number + ')\\s*,\\s*(' + number + ')\\s*,\\s*(' + number + ')\\s*\\)$'],
        enums: ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'ease-in-sine', 'ease-out-sine', 'ease-in-out-sine', 'ease-in-quad', 'ease-out-quad', 'ease-in-out-quad', 'ease-in-cubic', 'ease-out-cubic', 'ease-in-out-cubic', 'ease-in-quart', 'ease-out-quart', 'ease-in-out-quart', 'ease-in-quint', 'ease-out-quint', 'ease-in-out-quint', 'ease-in-expo', 'ease-out-expo', 'ease-in-out-expo', 'ease-in-circ', 'ease-out-circ', 'ease-in-out-circ']
      },
      gradientDirection: {
        enums: ['to-bottom', 'to-top', 'to-left', 'to-right', 'to-bottom-right', 'to-bottom-left', 'to-top-right', 'to-top-left', 'to-right-bottom', 'to-left-bottom', 'to-right-top', 'to-left-top']
      },
      boundsExpansion: {
        number: true,
        multiple: true,
        min: 0,
        validate: function validate(valArr) {
          var length = valArr.length;
          return length === 1 || length === 2 || length === 4;
        }
      }
    };
    var diff = {
      zeroNonZero: function zeroNonZero(val1, val2) {
        if ((val1 == null || val2 == null) && val1 !== val2) {
          return true; // null cases could represent any value
        }

        if (val1 == 0 && val2 != 0) {
          return true;
        } else if (val1 != 0 && val2 == 0) {
          return true;
        } else {
          return false;
        }
      },
      any: function any(val1, val2) {
        return val1 != val2;
      },
      emptyNonEmpty: function emptyNonEmpty(str1, str2) {
        var empty1 = emptyString(str1);
        var empty2 = emptyString(str2);
        return empty1 && !empty2 || !empty1 && empty2;
      }
    }; // define visual style properties
    //
    // - n.b. adding a new group of props may require updates to updateStyleHints()
    // - adding new props to an existing group gets handled automatically

    var t = styfn$6.types;
    var mainLabel = [{
      name: 'label',
      type: t.text,
      triggersBounds: diff.any,
      triggersZOrder: diff.emptyNonEmpty
    }, {
      name: 'text-rotation',
      type: t.textRotation,
      triggersBounds: diff.any
    }, {
      name: 'text-margin-x',
      type: t.bidirectionalSize,
      triggersBounds: diff.any
    }, {
      name: 'text-margin-y',
      type: t.bidirectionalSize,
      triggersBounds: diff.any
    }];
    var sourceLabel = [{
      name: 'source-label',
      type: t.text,
      triggersBounds: diff.any
    }, {
      name: 'source-text-rotation',
      type: t.textRotation,
      triggersBounds: diff.any
    }, {
      name: 'source-text-margin-x',
      type: t.bidirectionalSize,
      triggersBounds: diff.any
    }, {
      name: 'source-text-margin-y',
      type: t.bidirectionalSize,
      triggersBounds: diff.any
    }, {
      name: 'source-text-offset',
      type: t.size,
      triggersBounds: diff.any
    }];
    var targetLabel = [{
      name: 'target-label',
      type: t.text,
      triggersBounds: diff.any
    }, {
      name: 'target-text-rotation',
      type: t.textRotation,
      triggersBounds: diff.any
    }, {
      name: 'target-text-margin-x',
      type: t.bidirectionalSize,
      triggersBounds: diff.any
    }, {
      name: 'target-text-margin-y',
      type: t.bidirectionalSize,
      triggersBounds: diff.any
    }, {
      name: 'target-text-offset',
      type: t.size,
      triggersBounds: diff.any
    }];
    var labelDimensions = [{
      name: 'font-family',
      type: t.fontFamily,
      triggersBounds: diff.any
    }, {
      name: 'font-style',
      type: t.fontStyle,
      triggersBounds: diff.any
    }, {
      name: 'font-weight',
      type: t.fontWeight,
      triggersBounds: diff.any
    }, {
      name: 'font-size',
      type: t.size,
      triggersBounds: diff.any
    }, {
      name: 'text-transform',
      type: t.textTransform,
      triggersBounds: diff.any
    }, {
      name: 'text-wrap',
      type: t.textWrap,
      triggersBounds: diff.any
    }, {
      name: 'text-overflow-wrap',
      type: t.textOverflowWrap,
      triggersBounds: diff.any
    }, {
      name: 'text-max-width',
      type: t.size,
      triggersBounds: diff.any
    }, {
      name: 'text-outline-width',
      type: t.size,
      triggersBounds: diff.any
    }, {
      name: 'line-height',
      type: t.positiveNumber,
      triggersBounds: diff.any
    }];
    var commonLabel = [{
      name: 'text-valign',
      type: t.valign,
      triggersBounds: diff.any
    }, {
      name: 'text-halign',
      type: t.halign,
      triggersBounds: diff.any
    }, {
      name: 'color',
      type: t.color
    }, {
      name: 'text-outline-color',
      type: t.color
    }, {
      name: 'text-outline-opacity',
      type: t.zeroOneNumber
    }, {
      name: 'text-background-color',
      type: t.color
    }, {
      name: 'text-background-opacity',
      type: t.zeroOneNumber
    }, {
      name: 'text-background-padding',
      type: t.size,
      triggersBounds: diff.any
    }, {
      name: 'text-border-opacity',
      type: t.zeroOneNumber
    }, {
      name: 'text-border-color',
      type: t.color
    }, {
      name: 'text-border-width',
      type: t.size,
      triggersBounds: diff.any
    }, {
      name: 'text-border-style',
      type: t.borderStyle,
      triggersBounds: diff.any
    }, {
      name: 'text-background-shape',
      type: t.textBackgroundShape,
      triggersBounds: diff.any
    }, {
      name: 'text-justification',
      type: t.justification
    }];
    var behavior = [{
      name: 'events',
      type: t.bool
    }, {
      name: 'text-events',
      type: t.bool
    }];
    var visibility = [{
      name: 'display',
      type: t.display,
      triggersZOrder: diff.any,
      triggersBounds: diff.any,
      triggersBoundsOfParallelBeziers: true
    }, {
      name: 'visibility',
      type: t.visibility,
      triggersZOrder: diff.any
    }, {
      name: 'opacity',
      type: t.zeroOneNumber,
      triggersZOrder: diff.zeroNonZero
    }, {
      name: 'text-opacity',
      type: t.zeroOneNumber
    }, {
      name: 'min-zoomed-font-size',
      type: t.size
    }, {
      name: 'z-compound-depth',
      type: t.zCompoundDepth,
      triggersZOrder: diff.any
    }, {
      name: 'z-index-compare',
      type: t.zIndexCompare,
      triggersZOrder: diff.any
    }, {
      name: 'z-index',
      type: t.nonNegativeInt,
      triggersZOrder: diff.any
    }];
    var overlay = [{
      name: 'overlay-padding',
      type: t.size,
      triggersBounds: diff.any
    }, {
      name: 'overlay-color',
      type: t.color
    }, {
      name: 'overlay-opacity',
      type: t.zeroOneNumber,
      triggersBounds: diff.zeroNonZero
    }];
    var transition = [{
      name: 'transition-property',
      type: t.propList
    }, {
      name: 'transition-duration',
      type: t.time
    }, {
      name: 'transition-delay',
      type: t.time
    }, {
      name: 'transition-timing-function',
      type: t.easing
    }];

    var nodeSizeHashOverride = function nodeSizeHashOverride(ele, parsedProp) {
      if (parsedProp.value === 'label') {
        return -ele.poolIndex(); // no hash key hits is using label size (hitrate for perf probably low anyway)
      } else {
        return parsedProp.pfValue;
      }
    };

    var nodeBody = [{
      name: 'height',
      type: t.nodeSize,
      triggersBounds: diff.any,
      hashOverride: nodeSizeHashOverride
    }, {
      name: 'width',
      type: t.nodeSize,
      triggersBounds: diff.any,
      hashOverride: nodeSizeHashOverride
    }, {
      name: 'shape',
      type: t.nodeShape,
      triggersBounds: diff.any
    }, {
      name: 'shape-polygon-points',
      type: t.polygonPointList,
      triggersBounds: diff.any
    }, {
      name: 'background-color',
      type: t.color
    }, {
      name: 'background-fill',
      type: t.fill
    }, {
      name: 'background-opacity',
      type: t.zeroOneNumber
    }, {
      name: 'background-blacken',
      type: t.nOneOneNumber
    }, {
      name: 'background-gradient-stop-colors',
      type: t.colors
    }, {
      name: 'background-gradient-stop-positions',
      type: t.percentages
    }, {
      name: 'background-gradient-direction',
      type: t.gradientDirection
    }, {
      name: 'padding',
      type: t.sizeMaybePercent,
      triggersBounds: diff.any
    }, {
      name: 'padding-relative-to',
      type: t.paddingRelativeTo,
      triggersBounds: diff.any
    }, {
      name: 'bounds-expansion',
      type: t.boundsExpansion,
      triggersBounds: diff.any
    }];
    var nodeBorder = [{
      name: 'border-color',
      type: t.color
    }, {
      name: 'border-opacity',
      type: t.zeroOneNumber
    }, {
      name: 'border-width',
      type: t.size,
      triggersBounds: diff.any
    }, {
      name: 'border-style',
      type: t.borderStyle
    }];
    var backgroundImage = [{
      name: 'background-image',
      type: t.urls
    }, {
      name: 'background-image-crossorigin',
      type: t.bgCrossOrigin
    }, {
      name: 'background-image-opacity',
      type: t.zeroOneNumbers
    }, {
      name: 'background-position-x',
      type: t.bgPos
    }, {
      name: 'background-position-y',
      type: t.bgPos
    }, {
      name: 'background-width-relative-to',
      type: t.bgRelativeTo
    }, {
      name: 'background-height-relative-to',
      type: t.bgRelativeTo
    }, {
      name: 'background-repeat',
      type: t.bgRepeat
    }, {
      name: 'background-fit',
      type: t.bgFit
    }, {
      name: 'background-clip',
      type: t.bgClip
    }, {
      name: 'background-width',
      type: t.bgWH
    }, {
      name: 'background-height',
      type: t.bgWH
    }, {
      name: 'background-offset-x',
      type: t.bgPos
    }, {
      name: 'background-offset-y',
      type: t.bgPos
    }];
    var compound = [{
      name: 'position',
      type: t.position,
      triggersBounds: diff.any
    }, {
      name: 'compound-sizing-wrt-labels',
      type: t.compoundIncludeLabels,
      triggersBounds: diff.any
    }, {
      name: 'min-width',
      type: t.size,
      triggersBounds: diff.any
    }, {
      name: 'min-width-bias-left',
      type: t.sizeMaybePercent,
      triggersBounds: diff.any
    }, {
      name: 'min-width-bias-right',
      type: t.sizeMaybePercent,
      triggersBounds: diff.any
    }, {
      name: 'min-height',
      type: t.size,
      triggersBounds: diff.any
    }, {
      name: 'min-height-bias-top',
      type: t.sizeMaybePercent,
      triggersBounds: diff.any
    }, {
      name: 'min-height-bias-bottom',
      type: t.sizeMaybePercent,
      triggersBounds: diff.any
    }];
    var edgeLine = [{
      name: 'line-style',
      type: t.lineStyle
    }, {
      name: 'line-color',
      type: t.color
    }, {
      name: 'line-fill',
      type: t.fill
    }, {
      name: 'line-cap',
      type: t.lineCap
    }, {
      name: 'line-dash-pattern',
      type: t.numbers
    }, {
      name: 'line-dash-offset',
      type: t.number
    }, {
      name: 'line-gradient-stop-colors',
      type: t.colors
    }, {
      name: 'line-gradient-stop-positions',
      type: t.percentages
    }, {
      name: 'curve-style',
      type: t.curveStyle,
      triggersBounds: diff.any,
      triggersBoundsOfParallelBeziers: true
    }, {
      name: 'haystack-radius',
      type: t.zeroOneNumber,
      triggersBounds: diff.any
    }, {
      name: 'source-endpoint',
      type: t.edgeEndpoint,
      triggersBounds: diff.any
    }, {
      name: 'target-endpoint',
      type: t.edgeEndpoint,
      triggersBounds: diff.any
    }, {
      name: 'control-point-step-size',
      type: t.size,
      triggersBounds: diff.any
    }, {
      name: 'control-point-distances',
      type: t.bidirectionalSizes,
      triggersBounds: diff.any
    }, {
      name: 'control-point-weights',
      type: t.numbers,
      triggersBounds: diff.any
    }, {
      name: 'segment-distances',
      type: t.bidirectionalSizes,
      triggersBounds: diff.any
    }, {
      name: 'segment-weights',
      type: t.numbers,
      triggersBounds: diff.any
    }, {
      name: 'taxi-turn',
      type: t.bidirectionalSizeMaybePercent,
      triggersBounds: diff.any
    }, {
      name: 'taxi-turn-min-distance',
      type: t.size,
      triggersBounds: diff.any
    }, {
      name: 'taxi-direction',
      type: t.axisDirection,
      triggersBounds: diff.any
    }, {
      name: 'edge-distances',
      type: t.edgeDistances,
      triggersBounds: diff.any
    }, {
      name: 'arrow-scale',
      type: t.positiveNumber,
      triggersBounds: diff.any
    }, {
      name: 'loop-direction',
      type: t.angle,
      triggersBounds: diff.any
    }, {
      name: 'loop-sweep',
      type: t.angle,
      triggersBounds: diff.any
    }, {
      name: 'source-distance-from-node',
      type: t.size,
      triggersBounds: diff.any
    }, {
      name: 'target-distance-from-node',
      type: t.size,
      triggersBounds: diff.any
    }];
    var ghost = [{
      name: 'ghost',
      type: t.bool,
      triggersBounds: diff.any
    }, {
      name: 'ghost-offset-x',
      type: t.bidirectionalSize,
      triggersBounds: diff.any
    }, {
      name: 'ghost-offset-y',
      type: t.bidirectionalSize,
      triggersBounds: diff.any
    }, {
      name: 'ghost-opacity',
      type: t.zeroOneNumber
    }];
    var core = [{
      name: 'selection-box-color',
      type: t.color
    }, {
      name: 'selection-box-opacity',
      type: t.zeroOneNumber
    }, {
      name: 'selection-box-border-color',
      type: t.color
    }, {
      name: 'selection-box-border-width',
      type: t.size
    }, {
      name: 'active-bg-color',
      type: t.color
    }, {
      name: 'active-bg-opacity',
      type: t.zeroOneNumber
    }, {
      name: 'active-bg-size',
      type: t.size
    }, {
      name: 'outside-texture-bg-color',
      type: t.color
    }, {
      name: 'outside-texture-bg-opacity',
      type: t.zeroOneNumber
    }]; // pie backgrounds for nodes

    var pie = [];
    styfn$6.pieBackgroundN = 16; // because the pie properties are numbered, give access to a constant N (for renderer use)

    pie.push({
      name: 'pie-size',
      type: t.sizeMaybePercent
    });

    for (var i = 1; i <= styfn$6.pieBackgroundN; i++) {
      pie.push({
        name: 'pie-' + i + '-background-color',
        type: t.color
      });
      pie.push({
        name: 'pie-' + i + '-background-size',
        type: t.percent
      });
      pie.push({
        name: 'pie-' + i + '-background-opacity',
        type: t.zeroOneNumber
      });
    } // edge arrows


    var edgeArrow = [];
    var arrowPrefixes = styfn$6.arrowPrefixes = ['source', 'mid-source', 'target', 'mid-target'];
    [{
      name: 'arrow-shape',
      type: t.arrowShape,
      triggersBounds: diff.any
    }, {
      name: 'arrow-color',
      type: t.color
    }, {
      name: 'arrow-fill',
      type: t.arrowFill
    }].forEach(function (prop) {
      arrowPrefixes.forEach(function (prefix) {
        var name = prefix + '-' + prop.name;
        var type = prop.type,
            triggersBounds = prop.triggersBounds;
        edgeArrow.push({
          name: name,
          type: type,
          triggersBounds: triggersBounds
        });
      });
    }, {});
    var props = styfn$6.properties = [].concat(behavior, transition, visibility, overlay, ghost, commonLabel, labelDimensions, mainLabel, sourceLabel, targetLabel, nodeBody, nodeBorder, backgroundImage, pie, compound, edgeLine, edgeArrow, core);
    var propGroups = styfn$6.propertyGroups = {
      // common to all eles
      behavior: behavior,
      transition: transition,
      visibility: visibility,
      overlay: overlay,
      ghost: ghost,
      // labels
      commonLabel: commonLabel,
      labelDimensions: labelDimensions,
      mainLabel: mainLabel,
      sourceLabel: sourceLabel,
      targetLabel: targetLabel,
      // node props
      nodeBody: nodeBody,
      nodeBorder: nodeBorder,
      backgroundImage: backgroundImage,
      pie: pie,
      compound: compound,
      // edge props
      edgeLine: edgeLine,
      edgeArrow: edgeArrow,
      core: core
    };
    var propGroupNames = styfn$6.propertyGroupNames = {};
    var propGroupKeys = styfn$6.propertyGroupKeys = Object.keys(propGroups);
    propGroupKeys.forEach(function (key) {
      propGroupNames[key] = propGroups[key].map(function (prop) {
        return prop.name;
      });
      propGroups[key].forEach(function (prop) {
        return prop.groupKey = key;
      });
    }); // define aliases

    var aliases = styfn$6.aliases = [{
      name: 'content',
      pointsTo: 'label'
    }, {
      name: 'control-point-distance',
      pointsTo: 'control-point-distances'
    }, {
      name: 'control-point-weight',
      pointsTo: 'control-point-weights'
    }, {
      name: 'edge-text-rotation',
      pointsTo: 'text-rotation'
    }, {
      name: 'padding-left',
      pointsTo: 'padding'
    }, {
      name: 'padding-right',
      pointsTo: 'padding'
    }, {
      name: 'padding-top',
      pointsTo: 'padding'
    }, {
      name: 'padding-bottom',
      pointsTo: 'padding'
    }]; // list of property names

    styfn$6.propertyNames = props.map(function (p) {
      return p.name;
    }); // allow access of properties by name ( e.g. style.properties.height )

    for (var _i = 0; _i < props.length; _i++) {
      var prop = props[_i];
      props[prop.name] = prop; // allow lookup by name
    } // map aliases


    for (var _i2 = 0; _i2 < aliases.length; _i2++) {
      var alias = aliases[_i2];
      var pointsToProp = props[alias.pointsTo];
      var aliasProp = {
        name: alias.name,
        alias: true,
        pointsTo: pointsToProp
      }; // add alias prop for parsing

      props.push(aliasProp);
      props[alias.name] = aliasProp; // allow lookup by name
    }
  })();

  styfn$6.getDefaultProperty = function (name) {
    return this.getDefaultProperties()[name];
  };

  styfn$6.getDefaultProperties = function () {
    var _p = this._private;

    if (_p.defaultProperties != null) {
      return _p.defaultProperties;
    }

    var rawProps = extend({
      // core props
      'selection-box-color': '#ddd',
      'selection-box-opacity': 0.65,
      'selection-box-border-color': '#aaa',
      'selection-box-border-width': 1,
      'active-bg-color': 'black',
      'active-bg-opacity': 0.15,
      'active-bg-size': 30,
      'outside-texture-bg-color': '#000',
      'outside-texture-bg-opacity': 0.125,
      // common node/edge props
      'events': 'yes',
      'text-events': 'no',
      'text-valign': 'top',
      'text-halign': 'center',
      'text-justification': 'auto',
      'line-height': 1,
      'color': '#000',
      'text-outline-color': '#000',
      'text-outline-width': 0,
      'text-outline-opacity': 1,
      'text-opacity': 1,
      'text-decoration': 'none',
      'text-transform': 'none',
      'text-wrap': 'none',
      'text-overflow-wrap': 'whitespace',
      'text-max-width': 9999,
      'text-background-color': '#000',
      'text-background-opacity': 0,
      'text-background-shape': 'rectangle',
      'text-background-padding': 0,
      'text-border-opacity': 0,
      'text-border-width': 0,
      'text-border-style': 'solid',
      'text-border-color': '#000',
      'font-family': 'Helvetica Neue, Helvetica, sans-serif',
      'font-style': 'normal',
      'font-weight': 'normal',
      'font-size': 16,
      'min-zoomed-font-size': 0,
      'text-rotation': 'none',
      'source-text-rotation': 'none',
      'target-text-rotation': 'none',
      'visibility': 'visible',
      'display': 'element',
      'opacity': 1,
      'z-compound-depth': 'auto',
      'z-index-compare': 'auto',
      'z-index': 0,
      'label': '',
      'text-margin-x': 0,
      'text-margin-y': 0,
      'source-label': '',
      'source-text-offset': 0,
      'source-text-margin-x': 0,
      'source-text-margin-y': 0,
      'target-label': '',
      'target-text-offset': 0,
      'target-text-margin-x': 0,
      'target-text-margin-y': 0,
      'overlay-opacity': 0,
      'overlay-color': '#000',
      'overlay-padding': 10,
      'transition-property': 'none',
      'transition-duration': 0,
      'transition-delay': 0,
      'transition-timing-function': 'linear',
      // node props
      'background-blacken': 0,
      'background-color': '#999',
      'background-fill': 'solid',
      'background-opacity': 1,
      'background-image': 'none',
      'background-image-crossorigin': 'anonymous',
      'background-image-opacity': 1,
      'background-position-x': '50%',
      'background-position-y': '50%',
      'background-offset-x': 0,
      'background-offset-y': 0,
      'background-width-relative-to': 'include-padding',
      'background-height-relative-to': 'include-padding',
      'background-repeat': 'no-repeat',
      'background-fit': 'none',
      'background-clip': 'node',
      'background-width': 'auto',
      'background-height': 'auto',
      'border-color': '#000',
      'border-opacity': 1,
      'border-width': 0,
      'border-style': 'solid',
      'height': 30,
      'width': 30,
      'shape': 'ellipse',
      'shape-polygon-points': '-1, -1,   1, -1,   1, 1,   -1, 1',
      'bounds-expansion': 0,
      // node gradient
      'background-gradient-direction': 'to-bottom',
      'background-gradient-stop-colors': '#999',
      'background-gradient-stop-positions': '0%',
      // ghost props
      'ghost': 'no',
      'ghost-offset-y': 0,
      'ghost-offset-x': 0,
      'ghost-opacity': 0,
      // compound props
      'padding': 0,
      'padding-relative-to': 'width',
      'position': 'origin',
      'compound-sizing-wrt-labels': 'include',
      'min-width': 0,
      'min-width-bias-left': 0,
      'min-width-bias-right': 0,
      'min-height': 0,
      'min-height-bias-top': 0,
      'min-height-bias-bottom': 0
    }, {
      // node pie bg
      'pie-size': '100%'
    }, [{
      name: 'pie-{{i}}-background-color',
      value: 'black'
    }, {
      name: 'pie-{{i}}-background-size',
      value: '0%'
    }, {
      name: 'pie-{{i}}-background-opacity',
      value: 1
    }].reduce(function (css, prop) {
      for (var i = 1; i <= styfn$6.pieBackgroundN; i++) {
        var name = prop.name.replace('{{i}}', i);
        var val = prop.value;
        css[name] = val;
      }

      return css;
    }, {}), {
      // edge props
      'line-style': 'solid',
      'line-color': '#999',
      'line-fill': 'solid',
      'line-cap': 'butt',
      'line-gradient-stop-colors': '#999',
      'line-gradient-stop-positions': '0%',
      'control-point-step-size': 40,
      'control-point-weights': 0.5,
      'segment-weights': 0.5,
      'segment-distances': 20,
      'taxi-turn': '50%',
      'taxi-turn-min-distance': 10,
      'taxi-direction': 'auto',
      'edge-distances': 'intersection',
      'curve-style': 'haystack',
      'haystack-radius': 0,
      'arrow-scale': 1,
      'loop-direction': '-45deg',
      'loop-sweep': '-90deg',
      'source-distance-from-node': 0,
      'target-distance-from-node': 0,
      'source-endpoint': 'outside-to-node',
      'target-endpoint': 'outside-to-node',
      'line-dash-pattern': [6, 3],
      'line-dash-offset': 0
    }, [{
      name: 'arrow-shape',
      value: 'none'
    }, {
      name: 'arrow-color',
      value: '#999'
    }, {
      name: 'arrow-fill',
      value: 'filled'
    }].reduce(function (css, prop) {
      styfn$6.arrowPrefixes.forEach(function (prefix) {
        var name = prefix + '-' + prop.name;
        var val = prop.value;
        css[name] = val;
      });
      return css;
    }, {}));
    var parsedProps = {};

    for (var i = 0; i < this.properties.length; i++) {
      var prop = this.properties[i];

      if (prop.pointsTo) {
        continue;
      }

      var name = prop.name;
      var val = rawProps[name];
      var parsedProp = this.parse(name, val);
      parsedProps[name] = parsedProp;
    }

    _p.defaultProperties = parsedProps;
    return _p.defaultProperties;
  };

  styfn$6.addDefaultStylesheet = function () {
    this.selector(':parent').css({
      'shape': 'rectangle',
      'padding': 10,
      'background-color': '#eee',
      'border-color': '#ccc',
      'border-width': 1
    }).selector('edge').css({
      'width': 3
    }).selector(':loop').css({
      'curve-style': 'bezier'
    }).selector('edge:compound').css({
      'curve-style': 'bezier',
      'source-endpoint': 'outside-to-line',
      'target-endpoint': 'outside-to-line'
    }).selector(':selected').css({
      'background-color': '#0169D9',
      'line-color': '#0169D9',
      'source-arrow-color': '#0169D9',
      'target-arrow-color': '#0169D9',
      'mid-source-arrow-color': '#0169D9',
      'mid-target-arrow-color': '#0169D9'
    }).selector(':parent:selected').css({
      'background-color': '#CCE1F9',
      'border-color': '#aec8e5'
    }).selector(':active').css({
      'overlay-color': 'black',
      'overlay-padding': 10,
      'overlay-opacity': 0.25
    });
    this.defaultLength = this.length;
  };

  var styfn$7 = {}; // a caching layer for property parsing

  styfn$7.parse = function (name, value, propIsBypass, propIsFlat) {
    var self = this; // function values can't be cached in all cases, and there isn't much benefit of caching them anyway

    if (fn(value)) {
      return self.parseImplWarn(name, value, propIsBypass, propIsFlat);
    }

    var flatKey = propIsFlat === 'mapping' || propIsFlat === true || propIsFlat === false || propIsFlat == null ? 'dontcare' : propIsFlat;
    var bypassKey = propIsBypass ? 't' : 'f';
    var valueKey = '' + value;
    var argHash = hashStrings(name, valueKey, bypassKey, flatKey);
    var propCache = self.propCache = self.propCache || [];
    var ret;

    if (!(ret = propCache[argHash])) {
      ret = propCache[argHash] = self.parseImplWarn(name, value, propIsBypass, propIsFlat);
    } // - bypasses can't be shared b/c the value can be changed by animations or otherwise overridden
    // - mappings can't be shared b/c mappings are per-element


    if (propIsBypass || propIsFlat === 'mapping') {
      // need a copy since props are mutated later in their lifecycles
      ret = copy(ret);

      if (ret) {
        ret.value = copy(ret.value); // because it could be an array, e.g. colour
      }
    }

    return ret;
  };

  styfn$7.parseImplWarn = function (name, value, propIsBypass, propIsFlat) {
    var prop = this.parseImpl(name, value, propIsBypass, propIsFlat);

    if (!prop && value != null) {
      warn("The style property `".concat(name, ": ").concat(value, "` is invalid"));
    }

    if (prop && (prop.name === 'width' || prop.name === 'height') && value === 'label') {
      warn('The style value of `label` is deprecated for `' + prop.name + '`');
    }

    return prop;
  }; // parse a property; return null on invalid; return parsed property otherwise
  // fields :
  // - name : the name of the property
  // - value : the parsed, native-typed value of the property
  // - strValue : a string value that represents the property value in valid css
  // - bypass : true iff the property is a bypass property


  styfn$7.parseImpl = function (name, value, propIsBypass, propIsFlat) {
    var self = this;
    name = camel2dash(name); // make sure the property name is in dash form (e.g. 'property-name' not 'propertyName')

    var property = self.properties[name];
    var passedValue = value;
    var types = self.types;

    if (!property) {
      return null;
    } // return null on property of unknown name


    if (value === undefined) {
      return null;
    } // can't assign undefined
    // the property may be an alias


    if (property.alias) {
      property = property.pointsTo;
      name = property.name;
    }

    var valueIsString = string(value);

    if (valueIsString) {
      // trim the value to make parsing easier
      value = value.trim();
    }

    var type = property.type;

    if (!type) {
      return null;
    } // no type, no luck
    // check if bypass is null or empty string (i.e. indication to delete bypass property)


    if (propIsBypass && (value === '' || value === null)) {
      return {
        name: name,
        value: value,
        bypass: true,
        deleteBypass: true
      };
    } // check if value is a function used as a mapper


    if (fn(value)) {
      return {
        name: name,
        value: value,
        strValue: 'fn',
        mapped: types.fn,
        bypass: propIsBypass
      };
    } // check if value is mapped


    var data, mapData;

    if (!valueIsString || propIsFlat || value.length < 7 || value[1] !== 'a') ; else if (value.length >= 7 && value[0] === 'd' && (data = new RegExp(types.data.regex).exec(value))) {
      if (propIsBypass) {
        return false;
      } // mappers not allowed in bypass


      var mapped = types.data;
      return {
        name: name,
        value: data,
        strValue: '' + value,
        mapped: mapped,
        field: data[1],
        bypass: propIsBypass
      };
    } else if (value.length >= 10 && value[0] === 'm' && (mapData = new RegExp(types.mapData.regex).exec(value))) {
      if (propIsBypass) {
        return false;
      } // mappers not allowed in bypass


      if (type.multiple) {
        return false;
      } // impossible to map to num


      var _mapped = types.mapData; // we can map only if the type is a colour or a number

      if (!(type.color || type.number)) {
        return false;
      }

      var valueMin = this.parse(name, mapData[4]); // parse to validate

      if (!valueMin || valueMin.mapped) {
        return false;
      } // can't be invalid or mapped


      var valueMax = this.parse(name, mapData[5]); // parse to validate

      if (!valueMax || valueMax.mapped) {
        return false;
      } // can't be invalid or mapped
      // check if valueMin and valueMax are the same


      if (valueMin.pfValue === valueMax.pfValue || valueMin.strValue === valueMax.strValue) {
        warn('`' + name + ': ' + value + '` is not a valid mapper because the output range is zero; converting to `' + name + ': ' + valueMin.strValue + '`');
        return this.parse(name, valueMin.strValue); // can't make much of a mapper without a range
      } else if (type.color) {
        var c1 = valueMin.value;
        var c2 = valueMax.value;
        var same = c1[0] === c2[0] // red
        && c1[1] === c2[1] // green
        && c1[2] === c2[2] // blue
        && ( // optional alpha
        c1[3] === c2[3] // same alpha outright
        || (c1[3] == null || c1[3] === 1) && ( // full opacity for colour 1?
        c2[3] == null || c2[3] === 1) // full opacity for colour 2?
        );

        if (same) {
          return false;
        } // can't make a mapper without a range

      }

      return {
        name: name,
        value: mapData,
        strValue: '' + value,
        mapped: _mapped,
        field: mapData[1],
        fieldMin: parseFloat(mapData[2]),
        // min & max are numeric
        fieldMax: parseFloat(mapData[3]),
        valueMin: valueMin.value,
        valueMax: valueMax.value,
        bypass: propIsBypass
      };
    }

    if (type.multiple && propIsFlat !== 'multiple') {
      var vals;

      if (valueIsString) {
        vals = value.split(/\s+/);
      } else if (array(value)) {
        vals = value;
      } else {
        vals = [value];
      }

      if (type.evenMultiple && vals.length % 2 !== 0) {
        return null;
      }

      var valArr = [];
      var unitsArr = [];
      var pfValArr = [];
      var strVal = '';
      var hasEnum = false;

      for (var i = 0; i < vals.length; i++) {
        var p = self.parse(name, vals[i], propIsBypass, 'multiple');
        hasEnum = hasEnum || string(p.value);
        valArr.push(p.value);
        pfValArr.push(p.pfValue != null ? p.pfValue : p.value);
        unitsArr.push(p.units);
        strVal += (i > 0 ? ' ' : '') + p.strValue;
      }

      if (type.validate && !type.validate(valArr, unitsArr)) {
        return null;
      }

      if (type.singleEnum && hasEnum) {
        if (valArr.length === 1 && string(valArr[0])) {
          return {
            name: name,
            value: valArr[0],
            strValue: valArr[0],
            bypass: propIsBypass
          };
        } else {
          return null;
        }
      }

      return {
        name: name,
        value: valArr,
        pfValue: pfValArr,
        strValue: strVal,
        bypass: propIsBypass,
        units: unitsArr
      };
    } // several types also allow enums


    var checkEnums = function checkEnums() {
      for (var _i = 0; _i < type.enums.length; _i++) {
        var en = type.enums[_i];

        if (en === value) {
          return {
            name: name,
            value: value,
            strValue: '' + value,
            bypass: propIsBypass
          };
        }
      }

      return null;
    }; // check the type and return the appropriate object


    if (type.number) {
      var units;
      var implicitUnits = 'px'; // not set => px

      if (type.units) {
        // use specified units if set
        units = type.units;
      }

      if (type.implicitUnits) {
        implicitUnits = type.implicitUnits;
      }

      if (!type.unitless) {
        if (valueIsString) {
          var unitsRegex = 'px|em' + (type.allowPercent ? '|\\%' : '');

          if (units) {
            unitsRegex = units;
          } // only allow explicit units if so set


          var match = value.match('^(' + number$1 + ')(' + unitsRegex + ')?' + '$');

          if (match) {
            value = match[1];
            units = match[2] || implicitUnits;
          }
        } else if (!units || type.implicitUnits) {
          units = implicitUnits; // implicitly px if unspecified
        }
      }

      value = parseFloat(value); // if not a number and enums not allowed, then the value is invalid

      if (isNaN(value) && type.enums === undefined) {
        return null;
      } // check if this number type also accepts special keywords in place of numbers
      // (i.e. `left`, `auto`, etc)


      if (isNaN(value) && type.enums !== undefined) {
        value = passedValue;
        return checkEnums();
      } // check if value must be an integer


      if (type.integer && !integer(value)) {
        return null;
      } // check value is within range


      if (type.min !== undefined && (value < type.min || type.strictMin && value === type.min) || type.max !== undefined && (value > type.max || type.strictMax && value === type.max)) {
        return null;
      }

      var ret = {
        name: name,
        value: value,
        strValue: '' + value + (units ? units : ''),
        units: units,
        bypass: propIsBypass
      }; // normalise value in pixels

      if (type.unitless || units !== 'px' && units !== 'em') {
        ret.pfValue = value;
      } else {
        ret.pfValue = units === 'px' || !units ? value : this.getEmSizeInPixels() * value;
      } // normalise value in ms


      if (units === 'ms' || units === 's') {
        ret.pfValue = units === 'ms' ? value : 1000 * value;
      } // normalise value in rad


      if (units === 'deg' || units === 'rad') {
        ret.pfValue = units === 'rad' ? value : deg2rad(value);
      } // normalize value in %


      if (units === '%') {
        ret.pfValue = value / 100;
      }

      return ret;
    } else if (type.propList) {
      var props = [];
      var propsStr = '' + value;

      if (propsStr === 'none') ; else {
        // go over each prop
        var propsSplit = propsStr.split(/\s*,\s*|\s+/);

        for (var _i2 = 0; _i2 < propsSplit.length; _i2++) {
          var propName = propsSplit[_i2].trim();

          if (self.properties[propName]) {
            props.push(propName);
          } else {
            warn('`' + propName + '` is not a valid property name');
          }
        }

        if (props.length === 0) {
          return null;
        }
      }

      return {
        name: name,
        value: props,
        strValue: props.length === 0 ? 'none' : props.join(' '),
        bypass: propIsBypass
      };
    } else if (type.color) {
      var tuple = color2tuple(value);

      if (!tuple) {
        return null;
      }

      return {
        name: name,
        value: tuple,
        pfValue: tuple,
        strValue: 'rgb(' + tuple[0] + ',' + tuple[1] + ',' + tuple[2] + ')',
        // n.b. no spaces b/c of multiple support
        bypass: propIsBypass
      };
    } else if (type.regex || type.regexes) {
      // first check enums
      if (type.enums) {
        var enumProp = checkEnums();

        if (enumProp) {
          return enumProp;
        }
      }

      var regexes = type.regexes ? type.regexes : [type.regex];

      for (var _i3 = 0; _i3 < regexes.length; _i3++) {
        var regex = new RegExp(regexes[_i3]); // make a regex from the type string

        var m = regex.exec(value);

        if (m) {
          // regex matches
          return {
            name: name,
            value: type.singleRegexMatchValue ? m[1] : m,
            strValue: '' + value,
            bypass: propIsBypass
          };
        }
      }

      return null; // didn't match any
    } else if (type.string) {
      // just return
      return {
        name: name,
        value: '' + value,
        strValue: '' + value,
        bypass: propIsBypass
      };
    } else if (type.enums) {
      // check enums last because it's a combo type in others
      return checkEnums();
    } else {
      return null; // not a type we can handle
    }
  };

  var Style = function Style(cy) {
    if (!(this instanceof Style)) {
      return new Style(cy);
    }

    if (!core(cy)) {
      error('A style must have a core reference');
      return;
    }

    this._private = {
      cy: cy,
      coreStyle: {}
    };
    this.length = 0;
    this.resetToDefault();
  };

  var styfn$8 = Style.prototype;

  styfn$8.instanceString = function () {
    return 'style';
  }; // remove all contexts


  styfn$8.clear = function () {
    for (var i = 0; i < this.length; i++) {
      this[i] = undefined;
    }

    this.length = 0;
    var _p = this._private;
    _p.newStyle = true;
    return this; // chaining
  };

  styfn$8.resetToDefault = function () {
    this.clear();
    this.addDefaultStylesheet();
    return this;
  }; // builds a style object for the 'core' selector


  styfn$8.core = function (propName) {
    return this._private.coreStyle[propName] || this.getDefaultProperty(propName);
  }; // create a new context from the specified selector string and switch to that context


  styfn$8.selector = function (selectorStr) {
    // 'core' is a special case and does not need a selector
    var selector = selectorStr === 'core' ? null : new Selector(selectorStr);
    var i = this.length++; // new context means new index

    this[i] = {
      selector: selector,
      properties: [],
      mappedProperties: [],
      index: i
    };
    return this; // chaining
  }; // add one or many css rules to the current context


  styfn$8.css = function () {
    var self = this;
    var args = arguments;

    if (args.length === 1) {
      var map = args[0];

      for (var i = 0; i < self.properties.length; i++) {
        var prop = self.properties[i];
        var mapVal = map[prop.name];

        if (mapVal === undefined) {
          mapVal = map[dash2camel(prop.name)];
        }

        if (mapVal !== undefined) {
          this.cssRule(prop.name, mapVal);
        }
      }
    } else if (args.length === 2) {
      this.cssRule(args[0], args[1]);
    } // do nothing if args are invalid


    return this; // chaining
  };

  styfn$8.style = styfn$8.css; // add a single css rule to the current context

  styfn$8.cssRule = function (name, value) {
    // name-value pair
    var property = this.parse(name, value); // add property to current context if valid

    if (property) {
      var i = this.length - 1;
      this[i].properties.push(property);
      this[i].properties[property.name] = property; // allow access by name as well

      if (property.name.match(/pie-(\d+)-background-size/) && property.value) {
        this._private.hasPie = true;
      }

      if (property.mapped) {
        this[i].mappedProperties.push(property);
      } // add to core style if necessary


      var currentSelectorIsCore = !this[i].selector;

      if (currentSelectorIsCore) {
        this._private.coreStyle[property.name] = property;
      }
    }

    return this; // chaining
  };

  styfn$8.append = function (style) {
    if (stylesheet(style)) {
      style.appendToStyle(this);
    } else if (array(style)) {
      this.appendFromJson(style);
    } else if (string(style)) {
      this.appendFromString(style);
    } // you probably wouldn't want to append a Style, since you'd duplicate the default parts


    return this;
  }; // static function


  Style.fromJson = function (cy, json) {
    var style = new Style(cy);
    style.fromJson(json);
    return style;
  };

  Style.fromString = function (cy, string) {
    return new Style(cy).fromString(string);
  };

  [styfn, styfn$1, styfn$2, styfn$3, styfn$4, styfn$5, styfn$6, styfn$7].forEach(function (props) {
    extend(styfn$8, props);
  });
  Style.types = styfn$8.types;
  Style.properties = styfn$8.properties;
  Style.propertyGroups = styfn$8.propertyGroups;
  Style.propertyGroupNames = styfn$8.propertyGroupNames;
  Style.propertyGroupKeys = styfn$8.propertyGroupKeys;

  var corefn$7 = {
    style: function style(newStyle) {
      if (newStyle) {
        var s = this.setStyle(newStyle);
        s.update();
      }

      return this._private.style;
    },
    setStyle: function setStyle(style) {
      var _p = this._private;

      if (stylesheet(style)) {
        _p.style = style.generateStyle(this);
      } else if (array(style)) {
        _p.style = Style.fromJson(this, style);
      } else if (string(style)) {
        _p.style = Style.fromString(this, style);
      } else {
        _p.style = Style(this);
      }

      return _p.style;
    }
  };

  var defaultSelectionType = 'single';
  var corefn$8 = {
    autolock: function autolock(bool) {
      if (bool !== undefined) {
        this._private.autolock = bool ? true : false;
      } else {
        return this._private.autolock;
      }

      return this; // chaining
    },
    autoungrabify: function autoungrabify(bool) {
      if (bool !== undefined) {
        this._private.autoungrabify = bool ? true : false;
      } else {
        return this._private.autoungrabify;
      }

      return this; // chaining
    },
    autounselectify: function autounselectify(bool) {
      if (bool !== undefined) {
        this._private.autounselectify = bool ? true : false;
      } else {
        return this._private.autounselectify;
      }

      return this; // chaining
    },
    selectionType: function selectionType(selType) {
      var _p = this._private;

      if (_p.selectionType == null) {
        _p.selectionType = defaultSelectionType;
      }

      if (selType !== undefined) {
        if (selType === 'additive' || selType === 'single') {
          _p.selectionType = selType;
        }
      } else {
        return _p.selectionType;
      }

      return this;
    },
    panningEnabled: function panningEnabled(bool) {
      if (bool !== undefined) {
        this._private.panningEnabled = bool ? true : false;
      } else {
        return this._private.panningEnabled;
      }

      return this; // chaining
    },
    userPanningEnabled: function userPanningEnabled(bool) {
      if (bool !== undefined) {
        this._private.userPanningEnabled = bool ? true : false;
      } else {
        return this._private.userPanningEnabled;
      }

      return this; // chaining
    },
    zoomingEnabled: function zoomingEnabled(bool) {
      if (bool !== undefined) {
        this._private.zoomingEnabled = bool ? true : false;
      } else {
        return this._private.zoomingEnabled;
      }

      return this; // chaining
    },
    userZoomingEnabled: function userZoomingEnabled(bool) {
      if (bool !== undefined) {
        this._private.userZoomingEnabled = bool ? true : false;
      } else {
        return this._private.userZoomingEnabled;
      }

      return this; // chaining
    },
    boxSelectionEnabled: function boxSelectionEnabled(bool) {
      if (bool !== undefined) {
        this._private.boxSelectionEnabled = bool ? true : false;
      } else {
        return this._private.boxSelectionEnabled;
      }

      return this; // chaining
    },
    pan: function pan() {
      var args = arguments;
      var pan = this._private.pan;
      var dim, val, dims, x, y;

      switch (args.length) {
        case 0:
          // .pan()
          return pan;

        case 1:
          if (string(args[0])) {
            // .pan('x')
            dim = args[0];
            return pan[dim];
          } else if (plainObject(args[0])) {
            // .pan({ x: 0, y: 100 })
            if (!this._private.panningEnabled) {
              return this;
            }

            dims = args[0];
            x = dims.x;
            y = dims.y;

            if (number(x)) {
              pan.x = x;
            }

            if (number(y)) {
              pan.y = y;
            }

            this.emit('pan viewport');
          }

          break;

        case 2:
          // .pan('x', 100)
          if (!this._private.panningEnabled) {
            return this;
          }

          dim = args[0];
          val = args[1];

          if ((dim === 'x' || dim === 'y') && number(val)) {
            pan[dim] = val;
          }

          this.emit('pan viewport');
          break;
        // invalid
      }

      this.notify('viewport');
      return this; // chaining
    },
    panBy: function panBy(arg0, arg1) {
      var args = arguments;
      var pan = this._private.pan;
      var dim, val, dims, x, y;

      if (!this._private.panningEnabled) {
        return this;
      }

      switch (args.length) {
        case 1:
          if (plainObject(arg0)) {
            // .panBy({ x: 0, y: 100 })
            dims = args[0];
            x = dims.x;
            y = dims.y;

            if (number(x)) {
              pan.x += x;
            }

            if (number(y)) {
              pan.y += y;
            }

            this.emit('pan viewport');
          }

          break;

        case 2:
          // .panBy('x', 100)
          dim = arg0;
          val = arg1;

          if ((dim === 'x' || dim === 'y') && number(val)) {
            pan[dim] += val;
          }

          this.emit('pan viewport');
          break;
        // invalid
      }

      this.notify('viewport');
      return this; // chaining
    },
    fit: function fit(elements, padding) {
      var viewportState = this.getFitViewport(elements, padding);

      if (viewportState) {
        var _p = this._private;
        _p.zoom = viewportState.zoom;
        _p.pan = viewportState.pan;
        this.emit('pan zoom viewport');
        this.notify('viewport');
      }

      return this; // chaining
    },
    getFitViewport: function getFitViewport(elements, padding) {
      if (number(elements) && padding === undefined) {
        // elements is optional
        padding = elements;
        elements = undefined;
      }

      if (!this._private.panningEnabled || !this._private.zoomingEnabled) {
        return;
      }

      var bb;

      if (string(elements)) {
        var sel = elements;
        elements = this.$(sel);
      } else if (boundingBox(elements)) {
        // assume bb
        var bbe = elements;
        bb = {
          x1: bbe.x1,
          y1: bbe.y1,
          x2: bbe.x2,
          y2: bbe.y2
        };
        bb.w = bb.x2 - bb.x1;
        bb.h = bb.y2 - bb.y1;
      } else if (!elementOrCollection(elements)) {
        elements = this.mutableElements();
      }

      if (elementOrCollection(elements) && elements.empty()) {
        return;
      } // can't fit to nothing


      bb = bb || elements.boundingBox();
      var w = this.width();
      var h = this.height();
      var zoom;
      padding = number(padding) ? padding : 0;

      if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0 && !isNaN(bb.w) && !isNaN(bb.h) && bb.w > 0 && bb.h > 0) {
        zoom = Math.min((w - 2 * padding) / bb.w, (h - 2 * padding) / bb.h); // crop zoom

        zoom = zoom > this._private.maxZoom ? this._private.maxZoom : zoom;
        zoom = zoom < this._private.minZoom ? this._private.minZoom : zoom;
        var pan = {
          // now pan to middle
          x: (w - zoom * (bb.x1 + bb.x2)) / 2,
          y: (h - zoom * (bb.y1 + bb.y2)) / 2
        };
        return {
          zoom: zoom,
          pan: pan
        };
      }

      return;
    },
    zoomRange: function zoomRange(min, max) {
      var _p = this._private;

      if (max == null) {
        var opts = min;
        min = opts.min;
        max = opts.max;
      }

      if (number(min) && number(max) && min <= max) {
        _p.minZoom = min;
        _p.maxZoom = max;
      } else if (number(min) && max === undefined && min <= _p.maxZoom) {
        _p.minZoom = min;
      } else if (number(max) && min === undefined && max >= _p.minZoom) {
        _p.maxZoom = max;
      }

      return this;
    },
    minZoom: function minZoom(zoom) {
      if (zoom === undefined) {
        return this._private.minZoom;
      } else {
        return this.zoomRange({
          min: zoom
        });
      }
    },
    maxZoom: function maxZoom(zoom) {
      if (zoom === undefined) {
        return this._private.maxZoom;
      } else {
        return this.zoomRange({
          max: zoom
        });
      }
    },
    getZoomedViewport: function getZoomedViewport(params) {
      var _p = this._private;
      var currentPan = _p.pan;
      var currentZoom = _p.zoom;
      var pos; // in rendered px

      var zoom;
      var bail = false;

      if (!_p.zoomingEnabled) {
        // zooming disabled
        bail = true;
      }

      if (number(params)) {
        // then set the zoom
        zoom = params;
      } else if (plainObject(params)) {
        // then zoom about a point
        zoom = params.level;

        if (params.position != null) {
          pos = modelToRenderedPosition(params.position, currentZoom, currentPan);
        } else if (params.renderedPosition != null) {
          pos = params.renderedPosition;
        }

        if (pos != null && !_p.panningEnabled) {
          // panning disabled
          bail = true;
        }
      } // crop zoom


      zoom = zoom > _p.maxZoom ? _p.maxZoom : zoom;
      zoom = zoom < _p.minZoom ? _p.minZoom : zoom; // can't zoom with invalid params

      if (bail || !number(zoom) || zoom === currentZoom || pos != null && (!number(pos.x) || !number(pos.y))) {
        return null;
      }

      if (pos != null) {
        // set zoom about position
        var pan1 = currentPan;
        var zoom1 = currentZoom;
        var zoom2 = zoom;
        var pan2 = {
          x: -zoom2 / zoom1 * (pos.x - pan1.x) + pos.x,
          y: -zoom2 / zoom1 * (pos.y - pan1.y) + pos.y
        };
        return {
          zoomed: true,
          panned: true,
          zoom: zoom2,
          pan: pan2
        };
      } else {
        // just set the zoom
        return {
          zoomed: true,
          panned: false,
          zoom: zoom,
          pan: currentPan
        };
      }
    },
    zoom: function zoom(params) {
      if (params === undefined) {
        // get
        return this._private.zoom;
      } else {
        // set
        var vp = this.getZoomedViewport(params);
        var _p = this._private;

        if (vp == null || !vp.zoomed) {
          return this;
        }

        _p.zoom = vp.zoom;

        if (vp.panned) {
          _p.pan.x = vp.pan.x;
          _p.pan.y = vp.pan.y;
        }

        this.emit('zoom' + (vp.panned ? ' pan' : '') + ' viewport');
        this.notify('viewport');
        return this; // chaining
      }
    },
    viewport: function viewport(opts) {
      var _p = this._private;
      var zoomDefd = true;
      var panDefd = true;
      var events = []; // to trigger

      var zoomFailed = false;
      var panFailed = false;

      if (!opts) {
        return this;
      }

      if (!number(opts.zoom)) {
        zoomDefd = false;
      }

      if (!plainObject(opts.pan)) {
        panDefd = false;
      }

      if (!zoomDefd && !panDefd) {
        return this;
      }

      if (zoomDefd) {
        var z = opts.zoom;

        if (z < _p.minZoom || z > _p.maxZoom || !_p.zoomingEnabled) {
          zoomFailed = true;
        } else {
          _p.zoom = z;
          events.push('zoom');
        }
      }

      if (panDefd && (!zoomFailed || !opts.cancelOnFailedZoom) && _p.panningEnabled) {
        var p = opts.pan;

        if (number(p.x)) {
          _p.pan.x = p.x;
          panFailed = false;
        }

        if (number(p.y)) {
          _p.pan.y = p.y;
          panFailed = false;
        }

        if (!panFailed) {
          events.push('pan');
        }
      }

      if (events.length > 0) {
        events.push('viewport');
        this.emit(events.join(' '));
        this.notify('viewport');
      }

      return this; // chaining
    },
    center: function center(elements) {
      var pan = this.getCenterPan(elements);

      if (pan) {
        this._private.pan = pan;
        this.emit('pan viewport');
        this.notify('viewport');
      }

      return this; // chaining
    },
    getCenterPan: function getCenterPan(elements, zoom) {
      if (!this._private.panningEnabled) {
        return;
      }

      if (string(elements)) {
        var selector = elements;
        elements = this.mutableElements().filter(selector);
      } else if (!elementOrCollection(elements)) {
        elements = this.mutableElements();
      }

      if (elements.length === 0) {
        return;
      } // can't centre pan to nothing


      var bb = elements.boundingBox();
      var w = this.width();
      var h = this.height();
      zoom = zoom === undefined ? this._private.zoom : zoom;
      var pan = {
        // middle
        x: (w - zoom * (bb.x1 + bb.x2)) / 2,
        y: (h - zoom * (bb.y1 + bb.y2)) / 2
      };
      return pan;
    },
    reset: function reset() {
      if (!this._private.panningEnabled || !this._private.zoomingEnabled) {
        return this;
      }

      this.viewport({
        pan: {
          x: 0,
          y: 0
        },
        zoom: 1
      });
      return this; // chaining
    },
    invalidateSize: function invalidateSize() {
      this._private.sizeCache = null;
    },
    size: function size() {
      var _p = this._private;
      var container = _p.container;
      return _p.sizeCache = _p.sizeCache || (container ? function () {
        var style = window$1.getComputedStyle(container);

        var val = function val(name) {
          return parseFloat(style.getPropertyValue(name));
        };

        return {
          width: container.clientWidth - val('padding-left') - val('padding-right'),
          height: container.clientHeight - val('padding-top') - val('padding-bottom')
        };
      }() : {
        // fallback if no container (not 0 b/c can be used for dividing etc)
        width: 1,
        height: 1
      });
    },
    width: function width() {
      return this.size().width;
    },
    height: function height() {
      return this.size().height;
    },
    extent: function extent() {
      var pan = this._private.pan;
      var zoom = this._private.zoom;
      var rb = this.renderedExtent();
      var b = {
        x1: (rb.x1 - pan.x) / zoom,
        x2: (rb.x2 - pan.x) / zoom,
        y1: (rb.y1 - pan.y) / zoom,
        y2: (rb.y2 - pan.y) / zoom
      };
      b.w = b.x2 - b.x1;
      b.h = b.y2 - b.y1;
      return b;
    },
    renderedExtent: function renderedExtent() {
      var width = this.width();
      var height = this.height();
      return {
        x1: 0,
        y1: 0,
        x2: width,
        y2: height,
        w: width,
        h: height
      };
    }
  }; // aliases

  corefn$8.centre = corefn$8.center; // backwards compatibility

  corefn$8.autolockNodes = corefn$8.autolock;
  corefn$8.autoungrabifyNodes = corefn$8.autoungrabify;

  var fn$6 = {
    data: define$3.data({
      field: 'data',
      bindingEvent: 'data',
      allowBinding: true,
      allowSetting: true,
      settingEvent: 'data',
      settingTriggersEvent: true,
      triggerFnName: 'trigger',
      allowGetting: true
    }),
    removeData: define$3.removeData({
      field: 'data',
      event: 'data',
      triggerFnName: 'trigger',
      triggerEvent: true
    }),
    scratch: define$3.data({
      field: 'scratch',
      bindingEvent: 'scratch',
      allowBinding: true,
      allowSetting: true,
      settingEvent: 'scratch',
      settingTriggersEvent: true,
      triggerFnName: 'trigger',
      allowGetting: true
    }),
    removeScratch: define$3.removeData({
      field: 'scratch',
      event: 'scratch',
      triggerFnName: 'trigger',
      triggerEvent: true
    })
  }; // aliases

  fn$6.attr = fn$6.data;
  fn$6.removeAttr = fn$6.removeData;

  var Core = function Core(opts) {
    var cy = this;
    opts = extend({}, opts);
    var container = opts.container; // allow for passing a wrapped jquery object
    // e.g. cytoscape({ container: $('#cy') })

    if (container && !htmlElement(container) && htmlElement(container[0])) {
      container = container[0];
    }

    var reg = container ? container._cyreg : null; // e.g. already registered some info (e.g. readies) via jquery

    reg = reg || {};

    if (reg && reg.cy) {
      reg.cy.destroy();
      reg = {}; // old instance => replace reg completely
    }

    var readies = reg.readies = reg.readies || [];

    if (container) {
      container._cyreg = reg;
    } // make sure container assoc'd reg points to this cy


    reg.cy = cy;
    var head = window$1 !== undefined && container !== undefined && !opts.headless;
    var options = opts;
    options.layout = extend({
      name: head ? 'grid' : 'null'
    }, options.layout);
    options.renderer = extend({
      name: head ? 'canvas' : 'null'
    }, options.renderer);

    var defVal = function defVal(def, val, altVal) {
      if (val !== undefined) {
        return val;
      } else if (altVal !== undefined) {
        return altVal;
      } else {
        return def;
      }
    };

    var _p = this._private = {
      container: container,
      // html dom ele container
      ready: false,
      // whether ready has been triggered
      options: options,
      // cached options
      elements: new Collection(this),
      // elements in the graph
      listeners: [],
      // list of listeners
      aniEles: new Collection(this),
      // elements being animated
      data: {},
      // data for the core
      scratch: {},
      // scratch object for core
      layout: null,
      renderer: null,
      destroyed: false,
      // whether destroy was called
      notificationsEnabled: true,
      // whether notifications are sent to the renderer
      minZoom: 1e-50,
      maxZoom: 1e50,
      zoomingEnabled: defVal(true, options.zoomingEnabled),
      userZoomingEnabled: defVal(true, options.userZoomingEnabled),
      panningEnabled: defVal(true, options.panningEnabled),
      userPanningEnabled: defVal(true, options.userPanningEnabled),
      boxSelectionEnabled: defVal(true, options.boxSelectionEnabled),
      autolock: defVal(false, options.autolock, options.autolockNodes),
      autoungrabify: defVal(false, options.autoungrabify, options.autoungrabifyNodes),
      autounselectify: defVal(false, options.autounselectify),
      styleEnabled: options.styleEnabled === undefined ? head : options.styleEnabled,
      zoom: number(options.zoom) ? options.zoom : 1,
      pan: {
        x: plainObject(options.pan) && number(options.pan.x) ? options.pan.x : 0,
        y: plainObject(options.pan) && number(options.pan.y) ? options.pan.y : 0
      },
      animation: {
        // object for currently-running animations
        current: [],
        queue: []
      },
      hasCompoundNodes: false
    };

    this.createEmitter(); // set selection type

    this.selectionType(options.selectionType); // init zoom bounds

    this.zoomRange({
      min: options.minZoom,
      max: options.maxZoom
    });

    var loadExtData = function loadExtData(extData, next) {
      var anyIsPromise = extData.some(promise);

      if (anyIsPromise) {
        return Promise$1.all(extData).then(next); // load all data asynchronously, then exec rest of init
      } else {
        next(extData); // exec synchronously for convenience
      }
    }; // start with the default stylesheet so we have something before loading an external stylesheet


    if (_p.styleEnabled) {
      cy.setStyle([]);
    } // create the renderer


    var rendererOptions = extend({}, options, options.renderer); // allow rendering hints in top level options

    cy.initRenderer(rendererOptions);

    var setElesAndLayout = function setElesAndLayout(elements, onload, ondone) {
      cy.notifications(false); // remove old elements

      var oldEles = cy.mutableElements();

      if (oldEles.length > 0) {
        oldEles.remove();
      }

      if (elements != null) {
        if (plainObject(elements) || array(elements)) {
          cy.add(elements);
        }
      }

      cy.one('layoutready', function (e) {
        cy.notifications(true);
        cy.emit(e); // we missed this event by turning notifications off, so pass it on

        cy.one('load', onload);
        cy.emitAndNotify('load');
      }).one('layoutstop', function () {
        cy.one('done', ondone);
        cy.emit('done');
      });
      var layoutOpts = extend({}, cy._private.options.layout);
      layoutOpts.eles = cy.elements();
      cy.layout(layoutOpts).run();
    };

    loadExtData([options.style, options.elements], function (thens) {
      var initStyle = thens[0];
      var initEles = thens[1]; // init style

      if (_p.styleEnabled) {
        cy.style().append(initStyle);
      } // initial load


      setElesAndLayout(initEles, function () {
        // onready
        cy.startAnimationLoop();
        _p.ready = true; // if a ready callback is specified as an option, the bind it

        if (fn(options.ready)) {
          cy.on('ready', options.ready);
        } // bind all the ready handlers registered before creating this instance


        for (var i = 0; i < readies.length; i++) {
          var fn$1 = readies[i];
          cy.on('ready', fn$1);
        }

        if (reg) {
          reg.readies = [];
        } // clear b/c we've bound them all and don't want to keep it around in case a new core uses the same div etc


        cy.emit('ready');
      }, options.done);
    });
  };

  var corefn$9 = Core.prototype; // short alias

  extend(corefn$9, {
    instanceString: function instanceString() {
      return 'core';
    },
    isReady: function isReady() {
      return this._private.ready;
    },
    destroyed: function destroyed() {
      return this._private.destroyed;
    },
    ready: function ready(fn) {
      if (this.isReady()) {
        this.emitter().emit('ready', [], fn); // just calls fn as though triggered via ready event
      } else {
        this.on('ready', fn);
      }

      return this;
    },
    destroy: function destroy() {
      var cy = this;
      if (cy.destroyed()) return;
      cy.stopAnimationLoop();
      cy.destroyRenderer();
      this.emit('destroy');
      cy._private.destroyed = true;
      return cy;
    },
    hasElementWithId: function hasElementWithId(id) {
      return this._private.elements.hasElementWithId(id);
    },
    getElementById: function getElementById(id) {
      return this._private.elements.getElementById(id);
    },
    hasCompoundNodes: function hasCompoundNodes() {
      return this._private.hasCompoundNodes;
    },
    headless: function headless() {
      return this._private.renderer.isHeadless();
    },
    styleEnabled: function styleEnabled() {
      return this._private.styleEnabled;
    },
    addToPool: function addToPool(eles) {
      this._private.elements.merge(eles);

      return this; // chaining
    },
    removeFromPool: function removeFromPool(eles) {
      this._private.elements.unmerge(eles);

      return this;
    },
    container: function container() {
      return this._private.container || null;
    },
    mount: function mount(container) {
      if (container == null) {
        return;
      }

      var cy = this;
      var _p = cy._private;
      var options = _p.options;

      if (!htmlElement(container) && htmlElement(container[0])) {
        container = container[0];
      }

      cy.stopAnimationLoop();
      cy.destroyRenderer();
      _p.container = container;
      _p.styleEnabled = true;
      cy.invalidateSize();
      cy.initRenderer(extend({}, options, options.renderer, {
        // allow custom renderer name to be re-used, otherwise use canvas
        name: options.renderer.name === 'null' ? 'canvas' : options.renderer.name
      }));
      cy.startAnimationLoop();
      cy.style(options.style);
      cy.emit('mount');
      return cy;
    },
    unmount: function unmount() {
      var cy = this;
      cy.stopAnimationLoop();
      cy.destroyRenderer();
      cy.initRenderer({
        name: 'null'
      });
      cy.emit('unmount');
      return cy;
    },
    options: function options() {
      return copy(this._private.options);
    },
    json: function json(obj) {
      var cy = this;
      var _p = cy._private;
      var eles = cy.mutableElements();

      var getFreshRef = function getFreshRef(ele) {
        return cy.getElementById(ele.id());
      };

      if (plainObject(obj)) {
        // set
        cy.startBatch();

        if (obj.elements) {
          var idInJson = {};

          var updateEles = function updateEles(jsons, gr) {
            var toAdd = [];
            var toMod = [];

            for (var i = 0; i < jsons.length; i++) {
              var json = jsons[i];
              var id = '' + json.data.id; // id must be string

              var ele = cy.getElementById(id);
              idInJson[id] = true;

              if (ele.length !== 0) {
                // existing element should be updated
                toMod.push({
                  ele: ele,
                  json: json
                });
              } else {
                // otherwise should be added
                if (gr) {
                  json.group = gr;
                  toAdd.push(json);
                } else {
                  toAdd.push(json);
                }
              }
            }

            cy.add(toAdd);

            for (var _i = 0; _i < toMod.length; _i++) {
              var _toMod$_i = toMod[_i],
                  _ele = _toMod$_i.ele,
                  _json = _toMod$_i.json;

              _ele.json(_json);
            }
          };

          if (array(obj.elements)) {
            // elements: []
            updateEles(obj.elements);
          } else {
            // elements: { nodes: [], edges: [] }
            var grs = ['nodes', 'edges'];

            for (var i = 0; i < grs.length; i++) {
              var gr = grs[i];
              var elements = obj.elements[gr];

              if (array(elements)) {
                updateEles(elements, gr);
              }
            }
          }

          var parentsToRemove = cy.collection();
          eles.filter(function (ele) {
            return !idInJson[ele.id()];
          }).forEach(function (ele) {
            if (ele.isParent()) {
              parentsToRemove.merge(ele);
            } else {
              ele.remove();
            }
          }); // so that children are not removed w/parent

          parentsToRemove.forEach(function (ele) {
            return ele.children().move({
              parent: null
            });
          }); // intermediate parents may be moved by prior line, so make sure we remove by fresh refs

          parentsToRemove.forEach(function (ele) {
            return getFreshRef(ele).remove();
          });
        }

        if (obj.style) {
          cy.style(obj.style);
        }

        if (obj.zoom != null && obj.zoom !== _p.zoom) {
          cy.zoom(obj.zoom);
        }

        if (obj.pan) {
          if (obj.pan.x !== _p.pan.x || obj.pan.y !== _p.pan.y) {
            cy.pan(obj.pan);
          }
        }

        if (obj.data) {
          cy.data(obj.data);
        }

        var fields = ['minZoom', 'maxZoom', 'zoomingEnabled', 'userZoomingEnabled', 'panningEnabled', 'userPanningEnabled', 'boxSelectionEnabled', 'autolock', 'autoungrabify', 'autounselectify'];

        for (var _i2 = 0; _i2 < fields.length; _i2++) {
          var f = fields[_i2];

          if (obj[f] != null) {
            cy[f](obj[f]);
          }
        }

        cy.endBatch();
        return this; // chaining
      } else {
        // get
        var flat = !!obj;
        var json = {};

        if (flat) {
          json.elements = this.elements().map(function (ele) {
            return ele.json();
          });
        } else {
          json.elements = {};
          eles.forEach(function (ele) {
            var group = ele.group();

            if (!json.elements[group]) {
              json.elements[group] = [];
            }

            json.elements[group].push(ele.json());
          });
        }

        if (this._private.styleEnabled) {
          json.style = cy.style().json();
        }

        json.data = copy(cy.data());
        var options = _p.options;
        json.zoomingEnabled = _p.zoomingEnabled;
        json.userZoomingEnabled = _p.userZoomingEnabled;
        json.zoom = _p.zoom;
        json.minZoom = _p.minZoom;
        json.maxZoom = _p.maxZoom;
        json.panningEnabled = _p.panningEnabled;
        json.userPanningEnabled = _p.userPanningEnabled;
        json.pan = copy(_p.pan);
        json.boxSelectionEnabled = _p.boxSelectionEnabled;
        json.renderer = copy(options.renderer);
        json.hideEdgesOnViewport = options.hideEdgesOnViewport;
        json.textureOnViewport = options.textureOnViewport;
        json.wheelSensitivity = options.wheelSensitivity;
        json.motionBlur = options.motionBlur;
        return json;
      }
    }
  });
  corefn$9.$id = corefn$9.getElementById;
  [corefn, corefn$1, elesfn$v, corefn$2, corefn$3, corefn$4, corefn$5, corefn$6, corefn$7, corefn$8, fn$6].forEach(function (props) {
    extend(corefn$9, props);
  });

  /* eslint-disable no-unused-vars */

  var defaults$9 = {
    fit: true,
    // whether to fit the viewport to the graph
    directed: false,
    // whether the tree is directed downwards (or edges can point in any direction if false)
    padding: 30,
    // padding on fit
    circle: false,
    // put depths in concentric circles if true, put depths top down if false
    grid: false,
    // whether to create an even grid into which the DAG is placed (circle:false only)
    spacingFactor: 1.75,
    // positive spacing factor, larger => more space between nodes (N.B. n/a if causes overlap)
    boundingBox: undefined,
    // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
    avoidOverlap: true,
    // prevents node overlap, may overflow boundingBox if not enough space
    nodeDimensionsIncludeLabels: false,
    // Excludes the label when calculating node bounding boxes for the layout algorithm
    roots: undefined,
    // the roots of the trees
    maximal: false,
    // whether to shift nodes down their natural BFS depths in order to avoid upwards edges (DAGS only)
    animate: false,
    // whether to transition the node positions
    animationDuration: 500,
    // duration of animation in ms if enabled
    animationEasing: undefined,
    // easing of animation if enabled,
    animateFilter: function animateFilter(node, i) {
      return true;
    },
    // a function that determines whether the node should be animated.  All nodes animated by default on animate enabled.  Non-animated nodes are positioned immediately when the layout starts
    ready: undefined,
    // callback on layoutready
    stop: undefined,
    // callback on layoutstop
    transform: function transform(node, position) {
      return position;
    } // transform a given node position. Useful for changing flow direction in discrete layouts

  };
  /* eslint-enable */

  var getInfo = function getInfo(ele) {
    return ele.scratch('breadthfirst');
  };

  var setInfo = function setInfo(ele, obj) {
    return ele.scratch('breadthfirst', obj);
  };

  function BreadthFirstLayout(options) {
    this.options = extend({}, defaults$9, options);
  }

  BreadthFirstLayout.prototype.run = function () {
    var params = this.options;
    var options = params;
    var cy = params.cy;
    var eles = options.eles;
    var nodes = eles.nodes().filter(function (n) {
      return !n.isParent();
    });
    var graph = eles;
    var directed = options.directed;
    var maximal = options.maximal || options.maximalAdjustments > 0; // maximalAdjustments for compat. w/ old code

    var bb = makeBoundingBox(options.boundingBox ? options.boundingBox : {
      x1: 0,
      y1: 0,
      w: cy.width(),
      h: cy.height()
    });
    var roots;

    if (elementOrCollection(options.roots)) {
      roots = options.roots;
    } else if (array(options.roots)) {
      var rootsArray = [];

      for (var i = 0; i < options.roots.length; i++) {
        var id = options.roots[i];
        var ele = cy.getElementById(id);
        rootsArray.push(ele);
      }

      roots = cy.collection(rootsArray);
    } else if (string(options.roots)) {
      roots = cy.$(options.roots);
    } else {
      if (directed) {
        roots = nodes.roots();
      } else {
        var components = eles.components();
        roots = cy.collection();

        var _loop = function _loop(_i) {
          var comp = components[_i];
          var maxDegree = comp.maxDegree(false);
          var compRoots = comp.filter(function (ele) {
            return ele.degree(false) === maxDegree;
          });
          roots = roots.add(compRoots);
        };

        for (var _i = 0; _i < components.length; _i++) {
          _loop(_i);
        }
      }
    }

    var depths = [];
    var foundByBfs = {};

    var addToDepth = function addToDepth(ele, d) {
      if (depths[d] == null) {
        depths[d] = [];
      }

      var i = depths[d].length;
      depths[d].push(ele);
      setInfo(ele, {
        index: i,
        depth: d
      });
    };

    var changeDepth = function changeDepth(ele, newDepth) {
      var _getInfo = getInfo(ele),
          depth = _getInfo.depth,
          index = _getInfo.index;

      depths[depth][index] = null;
      addToDepth(ele, newDepth);
    }; // find the depths of the nodes


    graph.bfs({
      roots: roots,
      directed: options.directed,
      visit: function visit(node, edge, pNode, i, depth) {
        var ele = node[0];
        var id = ele.id();
        addToDepth(ele, depth);
        foundByBfs[id] = true;
      }
    }); // check for nodes not found by bfs

    var orphanNodes = [];

    for (var _i2 = 0; _i2 < nodes.length; _i2++) {
      var _ele = nodes[_i2];

      if (foundByBfs[_ele.id()]) {
        continue;
      } else {
        orphanNodes.push(_ele);
      }
    } // assign the nodes a depth and index


    var assignDepthsAt = function assignDepthsAt(i) {
      var eles = depths[i];

      for (var j = 0; j < eles.length; j++) {
        var _ele2 = eles[j];

        if (_ele2 == null) {
          eles.splice(j, 1);
          j--;
          continue;
        }

        setInfo(_ele2, {
          depth: i,
          index: j
        });
      }
    };

    var assignDepths = function assignDepths() {
      for (var _i3 = 0; _i3 < depths.length; _i3++) {
        assignDepthsAt(_i3);
      }
    };

    var adjustMaximally = function adjustMaximally(ele, shifted) {
      var eInfo = getInfo(ele);
      var incomers = ele.incomers().filter(function (el) {
        return el.isNode() && eles.has(el);
      });
      var maxDepth = -1;
      var id = ele.id();

      for (var k = 0; k < incomers.length; k++) {
        var incmr = incomers[k];
        var iInfo = getInfo(incmr);
        maxDepth = Math.max(maxDepth, iInfo.depth);
      }

      if (eInfo.depth <= maxDepth) {
        if (shifted[id]) {
          return null;
        }

        changeDepth(ele, maxDepth + 1);
        shifted[id] = true;
        return true;
      }

      return false;
    }; // for the directed case, try to make the edges all go down (i.e. depth i => depth i + 1)


    if (directed && maximal) {
      var Q = [];
      var shifted = {};

      var enqueue = function enqueue(n) {
        return Q.push(n);
      };

      var dequeue = function dequeue() {
        return Q.shift();
      };

      nodes.forEach(function (n) {
        return Q.push(n);
      });

      while (Q.length > 0) {
        var _ele3 = dequeue();

        var didShift = adjustMaximally(_ele3, shifted);

        if (didShift) {
          _ele3.outgoers().filter(function (el) {
            return el.isNode() && eles.has(el);
          }).forEach(enqueue);
        } else if (didShift === null) {
          warn('Detected double maximal shift for node `' + _ele3.id() + '`.  Bailing maximal adjustment due to cycle.  Use `options.maximal: true` only on DAGs.');
          break; // exit on failure
        }
      }
    }

    assignDepths(); // clear holes
    // find min distance we need to leave between nodes

    var minDistance = 0;

    if (options.avoidOverlap) {
      for (var _i4 = 0; _i4 < nodes.length; _i4++) {
        var n = nodes[_i4];
        var nbb = n.layoutDimensions(options);
        var w = nbb.w;
        var h = nbb.h;
        minDistance = Math.max(minDistance, w, h);
      }
    } // get the weighted percent for an element based on its connectivity to other levels


    var cachedWeightedPercent = {};

    var getWeightedPercent = function getWeightedPercent(ele) {
      if (cachedWeightedPercent[ele.id()]) {
        return cachedWeightedPercent[ele.id()];
      }

      var eleDepth = getInfo(ele).depth;
      var neighbors = ele.neighborhood();
      var percent = 0;
      var samples = 0;

      for (var _i5 = 0; _i5 < neighbors.length; _i5++) {
        var neighbor = neighbors[_i5];

        if (neighbor.isEdge() || neighbor.isParent() || !nodes.has(neighbor)) {
          continue;
        }

        var bf = getInfo(neighbor);
        var index = bf.index;
        var depth = bf.depth; // unassigned neighbours shouldn't affect the ordering

        if (index == null || depth == null) {
          continue;
        }

        var nDepth = depths[depth].length;

        if (depth < eleDepth) {
          // only get influenced by elements above
          percent += index / nDepth;
          samples++;
        }
      }

      samples = Math.max(1, samples);
      percent = percent / samples;

      if (samples === 0) {
        // put lone nodes at the start
        percent = 0;
      }

      cachedWeightedPercent[ele.id()] = percent;
      return percent;
    }; // rearrange the indices in each depth level based on connectivity


    var sortFn = function sortFn(a, b) {
      var apct = getWeightedPercent(a);
      var bpct = getWeightedPercent(b);
      var diff = apct - bpct;

      if (diff === 0) {
        return ascending(a.id(), b.id()); // make sure sort doesn't have don't-care comparisons
      } else {
        return diff;
      }
    }; // sort each level to make connected nodes closer


    for (var _i6 = 0; _i6 < depths.length; _i6++) {
      depths[_i6].sort(sortFn);

      assignDepthsAt(_i6);
    } // assign orphan nodes to a new top-level depth


    var orphanDepth = [];

    for (var _i7 = 0; _i7 < orphanNodes.length; _i7++) {
      orphanDepth.push(orphanNodes[_i7]);
    }

    depths.unshift(orphanDepth);
    assignDepths();
    var biggestDepthSize = 0;

    for (var _i8 = 0; _i8 < depths.length; _i8++) {
      biggestDepthSize = Math.max(depths[_i8].length, biggestDepthSize);
    }

    var center = {
      x: bb.x1 + bb.w / 2,
      y: bb.x1 + bb.h / 2
    };
    var maxDepthSize = depths.reduce(function (max, eles) {
      return Math.max(max, eles.length);
    }, 0);

    var getPosition = function getPosition(ele) {
      var _getInfo2 = getInfo(ele),
          depth = _getInfo2.depth,
          index = _getInfo2.index;

      var depthSize = depths[depth].length;
      var distanceX = Math.max(bb.w / ((options.grid ? maxDepthSize : depthSize) + 1), minDistance);
      var distanceY = Math.max(bb.h / (depths.length + 1), minDistance);
      var radiusStepSize = Math.min(bb.w / 2 / depths.length, bb.h / 2 / depths.length);
      radiusStepSize = Math.max(radiusStepSize, minDistance);

      if (!options.circle) {
        var epos = {
          x: center.x + (index + 1 - (depthSize + 1) / 2) * distanceX,
          y: (depth + 1) * distanceY
        };
        return epos;
      } else {
        var radius = radiusStepSize * depth + radiusStepSize - (depths.length > 0 && depths[0].length <= 3 ? radiusStepSize / 2 : 0);
        var theta = 2 * Math.PI / depths[depth].length * index;

        if (depth === 0 && depths[0].length === 1) {
          radius = 1;
        }

        return {
          x: center.x + radius * Math.cos(theta),
          y: center.y + radius * Math.sin(theta)
        };
      }
    };

    nodes.layoutPositions(this, options, getPosition);
    return this; // chaining
  };

  var defaults$a = {
    fit: true,
    // whether to fit the viewport to the graph
    padding: 30,
    // the padding on fit
    boundingBox: undefined,
    // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
    avoidOverlap: true,
    // prevents node overlap, may overflow boundingBox and radius if not enough space
    nodeDimensionsIncludeLabels: false,
    // Excludes the label when calculating node bounding boxes for the layout algorithm
    spacingFactor: undefined,
    // Applies a multiplicative factor (>0) to expand or compress the overall area that the nodes take up
    radius: undefined,
    // the radius of the circle
    startAngle: 3 / 2 * Math.PI,
    // where nodes start in radians
    sweep: undefined,
    // how many radians should be between the first and last node (defaults to full circle)
    clockwise: true,
    // whether the layout should go clockwise (true) or counterclockwise/anticlockwise (false)
    sort: undefined,
    // a sorting function to order the nodes; e.g. function(a, b){ return a.data('weight') - b.data('weight') }
    animate: false,
    // whether to transition the node positions
    animationDuration: 500,
    // duration of animation in ms if enabled
    animationEasing: undefined,
    // easing of animation if enabled
    animateFilter: function animateFilter(node, i) {
      return true;
    },
    // a function that determines whether the node should be animated.  All nodes animated by default on animate enabled.  Non-animated nodes are positioned immediately when the layout starts
    ready: undefined,
    // callback on layoutready
    stop: undefined,
    // callback on layoutstop
    transform: function transform(node, position) {
      return position;
    } // transform a given node position. Useful for changing flow direction in discrete layouts 

  };

  function CircleLayout(options) {
    this.options = extend({}, defaults$a, options);
  }

  CircleLayout.prototype.run = function () {
    var params = this.options;
    var options = params;
    var cy = params.cy;
    var eles = options.eles;
    var clockwise = options.counterclockwise !== undefined ? !options.counterclockwise : options.clockwise;
    var nodes = eles.nodes().not(':parent');

    if (options.sort) {
      nodes = nodes.sort(options.sort);
    }

    var bb = makeBoundingBox(options.boundingBox ? options.boundingBox : {
      x1: 0,
      y1: 0,
      w: cy.width(),
      h: cy.height()
    });
    var center = {
      x: bb.x1 + bb.w / 2,
      y: bb.y1 + bb.h / 2
    };
    var sweep = options.sweep === undefined ? 2 * Math.PI - 2 * Math.PI / nodes.length : options.sweep;
    var dTheta = sweep / Math.max(1, nodes.length - 1);
    var r;
    var minDistance = 0;

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var nbb = n.layoutDimensions(options);
      var w = nbb.w;
      var h = nbb.h;
      minDistance = Math.max(minDistance, w, h);
    }

    if (number(options.radius)) {
      r = options.radius;
    } else if (nodes.length <= 1) {
      r = 0;
    } else {
      r = Math.min(bb.h, bb.w) / 2 - minDistance;
    } // calculate the radius


    if (nodes.length > 1 && options.avoidOverlap) {
      // but only if more than one node (can't overlap)
      minDistance *= 1.75; // just to have some nice spacing

      var dcos = Math.cos(dTheta) - Math.cos(0);
      var dsin = Math.sin(dTheta) - Math.sin(0);
      var rMin = Math.sqrt(minDistance * minDistance / (dcos * dcos + dsin * dsin)); // s.t. no nodes overlapping

      r = Math.max(rMin, r);
    }

    var getPos = function getPos(ele, i) {
      var theta = options.startAngle + i * dTheta * (clockwise ? 1 : -1);
      var rx = r * Math.cos(theta);
      var ry = r * Math.sin(theta);
      var pos = {
        x: center.x + rx,
        y: center.y + ry
      };
      return pos;
    };

    nodes.layoutPositions(this, options, getPos);
    return this; // chaining
  };

  var defaults$b = {
    fit: true,
    // whether to fit the viewport to the graph
    padding: 30,
    // the padding on fit
    startAngle: 3 / 2 * Math.PI,
    // where nodes start in radians
    sweep: undefined,
    // how many radians should be between the first and last node (defaults to full circle)
    clockwise: true,
    // whether the layout should go clockwise (true) or counterclockwise/anticlockwise (false)
    equidistant: false,
    // whether levels have an equal radial distance betwen them, may cause bounding box overflow
    minNodeSpacing: 10,
    // min spacing between outside of nodes (used for radius adjustment)
    boundingBox: undefined,
    // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
    avoidOverlap: true,
    // prevents node overlap, may overflow boundingBox if not enough space
    nodeDimensionsIncludeLabels: false,
    // Excludes the label when calculating node bounding boxes for the layout algorithm
    height: undefined,
    // height of layout area (overrides container height)
    width: undefined,
    // width of layout area (overrides container width)
    spacingFactor: undefined,
    // Applies a multiplicative factor (>0) to expand or compress the overall area that the nodes take up
    concentric: function concentric(node) {
      // returns numeric value for each node, placing higher nodes in levels towards the centre
      return node.degree();
    },
    levelWidth: function levelWidth(nodes) {
      // the variation of concentric values in each level
      return nodes.maxDegree() / 4;
    },
    animate: false,
    // whether to transition the node positions
    animationDuration: 500,
    // duration of animation in ms if enabled
    animationEasing: undefined,
    // easing of animation if enabled
    animateFilter: function animateFilter(node, i) {
      return true;
    },
    // a function that determines whether the node should be animated.  All nodes animated by default on animate enabled.  Non-animated nodes are positioned immediately when the layout starts
    ready: undefined,
    // callback on layoutready
    stop: undefined,
    // callback on layoutstop
    transform: function transform(node, position) {
      return position;
    } // transform a given node position. Useful for changing flow direction in discrete layouts

  };

  function ConcentricLayout(options) {
    this.options = extend({}, defaults$b, options);
  }

  ConcentricLayout.prototype.run = function () {
    var params = this.options;
    var options = params;
    var clockwise = options.counterclockwise !== undefined ? !options.counterclockwise : options.clockwise;
    var cy = params.cy;
    var eles = options.eles;
    var nodes = eles.nodes().not(':parent');
    var bb = makeBoundingBox(options.boundingBox ? options.boundingBox : {
      x1: 0,
      y1: 0,
      w: cy.width(),
      h: cy.height()
    });
    var center = {
      x: bb.x1 + bb.w / 2,
      y: bb.y1 + bb.h / 2
    };
    var nodeValues = []; // { node, value }

    var maxNodeSize = 0;

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var value = void 0; // calculate the node value

      value = options.concentric(node);
      nodeValues.push({
        value: value,
        node: node
      }); // for style mapping

      node._private.scratch.concentric = value;
    } // in case we used the `concentric` in style


    nodes.updateStyle(); // calculate max size now based on potentially updated mappers

    for (var _i = 0; _i < nodes.length; _i++) {
      var _node = nodes[_i];

      var nbb = _node.layoutDimensions(options);

      maxNodeSize = Math.max(maxNodeSize, nbb.w, nbb.h);
    } // sort node values in descreasing order


    nodeValues.sort(function (a, b) {
      return b.value - a.value;
    });
    var levelWidth = options.levelWidth(nodes); // put the values into levels

    var levels = [[]];
    var currentLevel = levels[0];

    for (var _i2 = 0; _i2 < nodeValues.length; _i2++) {
      var val = nodeValues[_i2];

      if (currentLevel.length > 0) {
        var diff = Math.abs(currentLevel[0].value - val.value);

        if (diff >= levelWidth) {
          currentLevel = [];
          levels.push(currentLevel);
        }
      }

      currentLevel.push(val);
    } // create positions from levels


    var minDist = maxNodeSize + options.minNodeSpacing; // min dist between nodes

    if (!options.avoidOverlap) {
      // then strictly constrain to bb
      var firstLvlHasMulti = levels.length > 0 && levels[0].length > 1;
      var maxR = Math.min(bb.w, bb.h) / 2 - minDist;
      var rStep = maxR / (levels.length + firstLvlHasMulti ? 1 : 0);
      minDist = Math.min(minDist, rStep);
    } // find the metrics for each level


    var r = 0;

    for (var _i3 = 0; _i3 < levels.length; _i3++) {
      var level = levels[_i3];
      var sweep = options.sweep === undefined ? 2 * Math.PI - 2 * Math.PI / level.length : options.sweep;
      var dTheta = level.dTheta = sweep / Math.max(1, level.length - 1); // calculate the radius

      if (level.length > 1 && options.avoidOverlap) {
        // but only if more than one node (can't overlap)
        var dcos = Math.cos(dTheta) - Math.cos(0);
        var dsin = Math.sin(dTheta) - Math.sin(0);
        var rMin = Math.sqrt(minDist * minDist / (dcos * dcos + dsin * dsin)); // s.t. no nodes overlapping

        r = Math.max(rMin, r);
      }

      level.r = r;
      r += minDist;
    }

    if (options.equidistant) {
      var rDeltaMax = 0;
      var _r = 0;

      for (var _i4 = 0; _i4 < levels.length; _i4++) {
        var _level = levels[_i4];
        var rDelta = _level.r - _r;
        rDeltaMax = Math.max(rDeltaMax, rDelta);
      }

      _r = 0;

      for (var _i5 = 0; _i5 < levels.length; _i5++) {
        var _level2 = levels[_i5];

        if (_i5 === 0) {
          _r = _level2.r;
        }

        _level2.r = _r;
        _r += rDeltaMax;
      }
    } // calculate the node positions


    var pos = {}; // id => position

    for (var _i6 = 0; _i6 < levels.length; _i6++) {
      var _level3 = levels[_i6];
      var _dTheta = _level3.dTheta;
      var _r2 = _level3.r;

      for (var j = 0; j < _level3.length; j++) {
        var _val = _level3[j];
        var theta = options.startAngle + (clockwise ? 1 : -1) * _dTheta * j;
        var p = {
          x: center.x + _r2 * Math.cos(theta),
          y: center.y + _r2 * Math.sin(theta)
        };
        pos[_val.node.id()] = p;
      }
    } // position the nodes


    nodes.layoutPositions(this, options, function (ele) {
      var id = ele.id();
      return pos[id];
    });
    return this; // chaining
  };

  /*
  The CoSE layout was written by Gerardo Huck.
  https://www.linkedin.com/in/gerardohuck/

  Based on the following article:
  http://dl.acm.org/citation.cfm?id=1498047

  Modifications tracked on Github.
  */
  var DEBUG;
  /**
   * @brief :  default layout options
   */

  var defaults$c = {
    // Called on `layoutready`
    ready: function ready() {},
    // Called on `layoutstop`
    stop: function stop() {},
    // Whether to animate while running the layout
    // true : Animate continuously as the layout is running
    // false : Just show the end result
    // 'end' : Animate with the end result, from the initial positions to the end positions
    animate: true,
    // Easing of the animation for animate:'end'
    animationEasing: undefined,
    // The duration of the animation for animate:'end'
    animationDuration: undefined,
    // A function that determines whether the node should be animated
    // All nodes animated by default on animate enabled
    // Non-animated nodes are positioned immediately when the layout starts
    animateFilter: function animateFilter(node, i) {
      return true;
    },
    // The layout animates only after this many milliseconds for animate:true
    // (prevents flashing on fast runs)
    animationThreshold: 250,
    // Number of iterations between consecutive screen positions update
    refresh: 20,
    // Whether to fit the network view after when done
    fit: true,
    // Padding on fit
    padding: 30,
    // Constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
    boundingBox: undefined,
    // Excludes the label when calculating node bounding boxes for the layout algorithm
    nodeDimensionsIncludeLabels: false,
    // Randomize the initial positions of the nodes (true) or use existing positions (false)
    randomize: false,
    // Extra spacing between components in non-compound graphs
    componentSpacing: 40,
    // Node repulsion (non overlapping) multiplier
    nodeRepulsion: function nodeRepulsion(node) {
      return 2048;
    },
    // Node repulsion (overlapping) multiplier
    nodeOverlap: 4,
    // Ideal edge (non nested) length
    idealEdgeLength: function idealEdgeLength(edge) {
      return 32;
    },
    // Divisor to compute edge forces
    edgeElasticity: function edgeElasticity(edge) {
      return 32;
    },
    // Nesting factor (multiplier) to compute ideal edge length for nested edges
    nestingFactor: 1.2,
    // Gravity force (constant)
    gravity: 1,
    // Maximum number of iterations to perform
    numIter: 1000,
    // Initial temperature (maximum node displacement)
    initialTemp: 1000,
    // Cooling factor (how the temperature is reduced between consecutive iterations
    coolingFactor: 0.99,
    // Lower temperature threshold (below this point the layout will end)
    minTemp: 1.0
  };
  /**
   * @brief       : constructor
   * @arg options : object containing layout options
   */

  function CoseLayout(options) {
    this.options = extend({}, defaults$c, options);
    this.options.layout = this;
  }
  /**
   * @brief : runs the layout
   */


  CoseLayout.prototype.run = function () {
    var options = this.options;
    var cy = options.cy;
    var layout = this;
    layout.stopped = false;

    if (options.animate === true || options.animate === false) {
      layout.emit({
        type: 'layoutstart',
        layout: layout
      });
    } // Set DEBUG - Global variable


    if (true === options.debug) {
      DEBUG = true;
    } else {
      DEBUG = false;
    } // Initialize layout info


    var layoutInfo = createLayoutInfo(cy, layout, options); // Show LayoutInfo contents if debugging

    if (DEBUG) {
      printLayoutInfo(layoutInfo);
    } // If required, randomize node positions


    if (options.randomize) {
      randomizePositions(layoutInfo);
    }

    var startTime = performanceNow();

    var refresh = function refresh() {
      refreshPositions(layoutInfo, cy, options); // Fit the graph if necessary

      if (true === options.fit) {
        cy.fit(options.padding);
      }
    };

    var mainLoop = function mainLoop(i) {
      if (layout.stopped || i >= options.numIter) {
        // logDebug("Layout manually stopped. Stopping computation in step " + i);
        return false;
      } // Do one step in the phisical simulation


      step$1(layoutInfo, options); // Update temperature

      layoutInfo.temperature = layoutInfo.temperature * options.coolingFactor; // logDebug("New temperature: " + layoutInfo.temperature);

      if (layoutInfo.temperature < options.minTemp) {
        // logDebug("Temperature drop below minimum threshold. Stopping computation in step " + i);
        return false;
      }

      return true;
    };

    var done = function done() {
      if (options.animate === true || options.animate === false) {
        refresh(); // Layout has finished

        layout.one('layoutstop', options.stop);
        layout.emit({
          type: 'layoutstop',
          layout: layout
        });
      } else {
        var nodes = options.eles.nodes();
        var getScaledPos = getScaleInBoundsFn(layoutInfo, options, nodes);
        nodes.layoutPositions(layout, options, getScaledPos);
      }
    };

    var i = 0;
    var loopRet = true;

    if (options.animate === true) {
      var frame = function frame() {
        var f = 0;

        while (loopRet && f < options.refresh) {
          loopRet = mainLoop(i);
          i++;
          f++;
        }

        if (!loopRet) {
          // it's done
          separateComponents(layoutInfo, options);
          done();
        } else {
          var now = performanceNow();

          if (now - startTime >= options.animationThreshold) {
            refresh();
          }

          requestAnimationFrame(frame);
        }
      };

      frame();
    } else {
      while (loopRet) {
        loopRet = mainLoop(i);
        i++;
      }

      separateComponents(layoutInfo, options);
      done();
    }

    return this; // chaining
  };
  /**
   * @brief : called on continuous layouts to stop them before they finish
   */


  CoseLayout.prototype.stop = function () {
    this.stopped = true;

    if (this.thread) {
      this.thread.stop();
    }

    this.emit('layoutstop');
    return this; // chaining
  };

  CoseLayout.prototype.destroy = function () {
    if (this.thread) {
      this.thread.stop();
    }

    return this; // chaining
  };
  /**
   * @brief     : Creates an object which is contains all the data
   *              used in the layout process
   * @arg cy    : cytoscape.js object
   * @return    : layoutInfo object initialized
   */


  var createLayoutInfo = function createLayoutInfo(cy, layout, options) {
    // Shortcut
    var edges = options.eles.edges();
    var nodes = options.eles.nodes();
    var layoutInfo = {
      isCompound: cy.hasCompoundNodes(),
      layoutNodes: [],
      idToIndex: {},
      nodeSize: nodes.size(),
      graphSet: [],
      indexToGraph: [],
      layoutEdges: [],
      edgeSize: edges.size(),
      temperature: options.initialTemp,
      clientWidth: cy.width(),
      clientHeight: cy.width(),
      boundingBox: makeBoundingBox(options.boundingBox ? options.boundingBox : {
        x1: 0,
        y1: 0,
        w: cy.width(),
        h: cy.height()
      })
    };
    var components = options.eles.components();
    var id2cmptId = {};

    for (var i = 0; i < components.length; i++) {
      var component = components[i];

      for (var j = 0; j < component.length; j++) {
        var node = component[j];
        id2cmptId[node.id()] = i;
      }
    } // Iterate over all nodes, creating layout nodes


    for (var i = 0; i < layoutInfo.nodeSize; i++) {
      var n = nodes[i];
      var nbb = n.layoutDimensions(options);
      var tempNode = {};
      tempNode.isLocked = n.locked();
      tempNode.id = n.data('id');
      tempNode.parentId = n.data('parent');
      tempNode.cmptId = id2cmptId[n.id()];
      tempNode.children = [];
      tempNode.positionX = n.position('x');
      tempNode.positionY = n.position('y');
      tempNode.offsetX = 0;
      tempNode.offsetY = 0;
      tempNode.height = nbb.w;
      tempNode.width = nbb.h;
      tempNode.maxX = tempNode.positionX + tempNode.width / 2;
      tempNode.minX = tempNode.positionX - tempNode.width / 2;
      tempNode.maxY = tempNode.positionY + tempNode.height / 2;
      tempNode.minY = tempNode.positionY - tempNode.height / 2;
      tempNode.padLeft = parseFloat(n.style('padding'));
      tempNode.padRight = parseFloat(n.style('padding'));
      tempNode.padTop = parseFloat(n.style('padding'));
      tempNode.padBottom = parseFloat(n.style('padding')); // forces

      tempNode.nodeRepulsion = fn(options.nodeRepulsion) ? options.nodeRepulsion(n) : options.nodeRepulsion; // Add new node

      layoutInfo.layoutNodes.push(tempNode); // Add entry to id-index map

      layoutInfo.idToIndex[tempNode.id] = i;
    } // Inline implementation of a queue, used for traversing the graph in BFS order


    var queue = [];
    var start = 0; // Points to the start the queue

    var end = -1; // Points to the end of the queue

    var tempGraph = []; // Second pass to add child information and
    // initialize queue for hierarchical traversal

    for (var i = 0; i < layoutInfo.nodeSize; i++) {
      var n = layoutInfo.layoutNodes[i];
      var p_id = n.parentId; // Check if node n has a parent node

      if (null != p_id) {
        // Add node Id to parent's list of children
        layoutInfo.layoutNodes[layoutInfo.idToIndex[p_id]].children.push(n.id);
      } else {
        // If a node doesn't have a parent, then it's in the root graph
        queue[++end] = n.id;
        tempGraph.push(n.id);
      }
    } // Add root graph to graphSet


    layoutInfo.graphSet.push(tempGraph); // Traverse the graph, level by level,

    while (start <= end) {
      // Get the node to visit and remove it from queue
      var node_id = queue[start++];
      var node_ix = layoutInfo.idToIndex[node_id];
      var node = layoutInfo.layoutNodes[node_ix];
      var children = node.children;

      if (children.length > 0) {
        // Add children nodes as a new graph to graph set
        layoutInfo.graphSet.push(children); // Add children to que queue to be visited

        for (var i = 0; i < children.length; i++) {
          queue[++end] = children[i];
        }
      }
    } // Create indexToGraph map


    for (var i = 0; i < layoutInfo.graphSet.length; i++) {
      var graph = layoutInfo.graphSet[i];

      for (var j = 0; j < graph.length; j++) {
        var index = layoutInfo.idToIndex[graph[j]];
        layoutInfo.indexToGraph[index] = i;
      }
    } // Iterate over all edges, creating Layout Edges


    for (var i = 0; i < layoutInfo.edgeSize; i++) {
      var e = edges[i];
      var tempEdge = {};
      tempEdge.id = e.data('id');
      tempEdge.sourceId = e.data('source');
      tempEdge.targetId = e.data('target'); // Compute ideal length

      var idealLength = fn(options.idealEdgeLength) ? options.idealEdgeLength(e) : options.idealEdgeLength;
      var elasticity = fn(options.edgeElasticity) ? options.edgeElasticity(e) : options.edgeElasticity; // Check if it's an inter graph edge

      var sourceIx = layoutInfo.idToIndex[tempEdge.sourceId];
      var targetIx = layoutInfo.idToIndex[tempEdge.targetId];
      var sourceGraph = layoutInfo.indexToGraph[sourceIx];
      var targetGraph = layoutInfo.indexToGraph[targetIx];

      if (sourceGraph != targetGraph) {
        // Find lowest common graph ancestor
        var lca = findLCA(tempEdge.sourceId, tempEdge.targetId, layoutInfo); // Compute sum of node depths, relative to lca graph

        var lcaGraph = layoutInfo.graphSet[lca];
        var depth = 0; // Source depth

        var tempNode = layoutInfo.layoutNodes[sourceIx];

        while (-1 === lcaGraph.indexOf(tempNode.id)) {
          tempNode = layoutInfo.layoutNodes[layoutInfo.idToIndex[tempNode.parentId]];
          depth++;
        } // Target depth


        tempNode = layoutInfo.layoutNodes[targetIx];

        while (-1 === lcaGraph.indexOf(tempNode.id)) {
          tempNode = layoutInfo.layoutNodes[layoutInfo.idToIndex[tempNode.parentId]];
          depth++;
        } // logDebug('LCA of nodes ' + tempEdge.sourceId + ' and ' + tempEdge.targetId +
        //  ". Index: " + lca + " Contents: " + lcaGraph.toString() +
        //  ". Depth: " + depth);
        // Update idealLength


        idealLength *= depth * options.nestingFactor;
      }

      tempEdge.idealLength = idealLength;
      tempEdge.elasticity = elasticity;
      layoutInfo.layoutEdges.push(tempEdge);
    } // Finally, return layoutInfo object


    return layoutInfo;
  };
  /**
   * @brief : This function finds the index of the lowest common
   *          graph ancestor between 2 nodes in the subtree
   *          (from the graph hierarchy induced tree) whose
   *          root is graphIx
   *
   * @arg node1: node1's ID
   * @arg node2: node2's ID
   * @arg layoutInfo: layoutInfo object
   *
   */


  var findLCA = function findLCA(node1, node2, layoutInfo) {
    // Find their common ancester, starting from the root graph
    var res = findLCA_aux(node1, node2, 0, layoutInfo);

    if (2 > res.count) {
      // If aux function couldn't find the common ancester,
      // then it is the root graph
      return 0;
    } else {
      return res.graph;
    }
  };
  /**
   * @brief          : Auxiliary function used for LCA computation
   *
   * @arg node1      : node1's ID
   * @arg node2      : node2's ID
   * @arg graphIx    : subgraph index
   * @arg layoutInfo : layoutInfo object
   *
   * @return         : object of the form {count: X, graph: Y}, where:
   *                   X is the number of ancesters (max: 2) found in
   *                   graphIx (and it's subgraphs),
   *                   Y is the graph index of the lowest graph containing
   *                   all X nodes
   */


  var findLCA_aux = function findLCA_aux(node1, node2, graphIx, layoutInfo) {
    var graph = layoutInfo.graphSet[graphIx]; // If both nodes belongs to graphIx

    if (-1 < graph.indexOf(node1) && -1 < graph.indexOf(node2)) {
      return {
        count: 2,
        graph: graphIx
      };
    } // Make recursive calls for all subgraphs


    var c = 0;

    for (var i = 0; i < graph.length; i++) {
      var nodeId = graph[i];
      var nodeIx = layoutInfo.idToIndex[nodeId];
      var children = layoutInfo.layoutNodes[nodeIx].children; // If the node has no child, skip it

      if (0 === children.length) {
        continue;
      }

      var childGraphIx = layoutInfo.indexToGraph[layoutInfo.idToIndex[children[0]]];
      var result = findLCA_aux(node1, node2, childGraphIx, layoutInfo);

      if (0 === result.count) {
        // Neither node1 nor node2 are present in this subgraph
        continue;
      } else if (1 === result.count) {
        // One of (node1, node2) is present in this subgraph
        c++;

        if (2 === c) {
          // We've already found both nodes, no need to keep searching
          break;
        }
      } else {
        // Both nodes are present in this subgraph
        return result;
      }
    }

    return {
      count: c,
      graph: graphIx
    };
  };
  /**
   * @brief: printsLayoutInfo into js console
   *         Only used for debbuging
   */


  if (false) {
    var printLayoutInfo;
  }
  /**
   * @brief : Randomizes the position of all nodes
   */


  var randomizePositions = function randomizePositions(layoutInfo, cy) {
    var width = layoutInfo.clientWidth;
    var height = layoutInfo.clientHeight;

    for (var i = 0; i < layoutInfo.nodeSize; i++) {
      var n = layoutInfo.layoutNodes[i]; // No need to randomize compound nodes or locked nodes

      if (0 === n.children.length && !n.isLocked) {
        n.positionX = Math.random() * width;
        n.positionY = Math.random() * height;
      }
    }
  };

  var getScaleInBoundsFn = function getScaleInBoundsFn(layoutInfo, options, nodes) {
    var bb = layoutInfo.boundingBox;
    var coseBB = {
      x1: Infinity,
      x2: -Infinity,
      y1: Infinity,
      y2: -Infinity
    };

    if (options.boundingBox) {
      nodes.forEach(function (node) {
        var lnode = layoutInfo.layoutNodes[layoutInfo.idToIndex[node.data('id')]];
        coseBB.x1 = Math.min(coseBB.x1, lnode.positionX);
        coseBB.x2 = Math.max(coseBB.x2, lnode.positionX);
        coseBB.y1 = Math.min(coseBB.y1, lnode.positionY);
        coseBB.y2 = Math.max(coseBB.y2, lnode.positionY);
      });
      coseBB.w = coseBB.x2 - coseBB.x1;
      coseBB.h = coseBB.y2 - coseBB.y1;
    }

    return function (ele, i) {
      var lnode = layoutInfo.layoutNodes[layoutInfo.idToIndex[ele.data('id')]];

      if (options.boundingBox) {
        // then add extra bounding box constraint
        var pctX = (lnode.positionX - coseBB.x1) / coseBB.w;
        var pctY = (lnode.positionY - coseBB.y1) / coseBB.h;
        return {
          x: bb.x1 + pctX * bb.w,
          y: bb.y1 + pctY * bb.h
        };
      } else {
        return {
          x: lnode.positionX,
          y: lnode.positionY
        };
      }
    };
  };
  /**
   * @brief          : Updates the positions of nodes in the network
   * @arg layoutInfo : LayoutInfo object
   * @arg cy         : Cytoscape object
   * @arg options    : Layout options
   */


  var refreshPositions = function refreshPositions(layoutInfo, cy, options) {
    // var s = 'Refreshing positions';
    // logDebug(s);
    var layout = options.layout;
    var nodes = options.eles.nodes();
    var getScaledPos = getScaleInBoundsFn(layoutInfo, options, nodes);
    nodes.positions(getScaledPos); // Trigger layoutReady only on first call

    if (true !== layoutInfo.ready) {
      // s = 'Triggering layoutready';
      // logDebug(s);
      layoutInfo.ready = true;
      layout.one('layoutready', options.ready);
      layout.emit({
        type: 'layoutready',
        layout: this
      });
    }
  };
  /**
   * @brief : Logs a debug message in JS console, if DEBUG is ON
   */
  // var logDebug = function(text) {
  //   if (DEBUG) {
  //     console.debug(text);
  //   }
  // };

  /**
   * @brief          : Performs one iteration of the physical simulation
   * @arg layoutInfo : LayoutInfo object already initialized
   * @arg cy         : Cytoscape object
   * @arg options    : Layout options
   */


  var step$1 = function step(layoutInfo, options, _step) {
    // var s = "\n\n###############################";
    // s += "\nSTEP: " + step;
    // s += "\n###############################\n";
    // logDebug(s);
    // Calculate node repulsions
    calculateNodeForces(layoutInfo, options); // Calculate edge forces

    calculateEdgeForces(layoutInfo); // Calculate gravity forces

    calculateGravityForces(layoutInfo, options); // Propagate forces from parent to child

    propagateForces(layoutInfo); // Update positions based on calculated forces

    updatePositions(layoutInfo);
  };
  /**
   * @brief : Computes the node repulsion forces
   */


  var calculateNodeForces = function calculateNodeForces(layoutInfo, options) {
    // Go through each of the graphs in graphSet
    // Nodes only repel each other if they belong to the same graph
    // var s = 'calculateNodeForces';
    // logDebug(s);
    for (var i = 0; i < layoutInfo.graphSet.length; i++) {
      var graph = layoutInfo.graphSet[i];
      var numNodes = graph.length; // s = "Set: " + graph.toString();
      // logDebug(s);
      // Now get all the pairs of nodes
      // Only get each pair once, (A, B) = (B, A)

      for (var j = 0; j < numNodes; j++) {
        var node1 = layoutInfo.layoutNodes[layoutInfo.idToIndex[graph[j]]];

        for (var k = j + 1; k < numNodes; k++) {
          var node2 = layoutInfo.layoutNodes[layoutInfo.idToIndex[graph[k]]];
          nodeRepulsion(node1, node2, layoutInfo, options);
        }
      }
    }
  };

  var randomDistance = function randomDistance(max) {
    return -max + 2 * max * Math.random();
  };
  /**
   * @brief : Compute the node repulsion forces between a pair of nodes
   */


  var nodeRepulsion = function nodeRepulsion(node1, node2, layoutInfo, options) {
    // var s = "Node repulsion. Node1: " + node1.id + " Node2: " + node2.id;
    var cmptId1 = node1.cmptId;
    var cmptId2 = node2.cmptId;

    if (cmptId1 !== cmptId2 && !layoutInfo.isCompound) {
      return;
    } // Get direction of line connecting both node centers


    var directionX = node2.positionX - node1.positionX;
    var directionY = node2.positionY - node1.positionY;
    var maxRandDist = 1; // s += "\ndirectionX: " + directionX + ", directionY: " + directionY;
    // If both centers are the same, apply a random force

    if (0 === directionX && 0 === directionY) {
      directionX = randomDistance(maxRandDist);
      directionY = randomDistance(maxRandDist);
    }

    var overlap = nodesOverlap(node1, node2, directionX, directionY);

    if (overlap > 0) {
      // s += "\nNodes DO overlap.";
      // s += "\nOverlap: " + overlap;
      // If nodes overlap, repulsion force is proportional
      // to the overlap
      var force = options.nodeOverlap * overlap; // Compute the module and components of the force vector

      var distance = Math.sqrt(directionX * directionX + directionY * directionY); // s += "\nDistance: " + distance;

      var forceX = force * directionX / distance;
      var forceY = force * directionY / distance;
    } else {
      // s += "\nNodes do NOT overlap.";
      // If there's no overlap, force is inversely proportional
      // to squared distance
      // Get clipping points for both nodes
      var point1 = findClippingPoint(node1, directionX, directionY);
      var point2 = findClippingPoint(node2, -1 * directionX, -1 * directionY); // Use clipping points to compute distance

      var distanceX = point2.x - point1.x;
      var distanceY = point2.y - point1.y;
      var distanceSqr = distanceX * distanceX + distanceY * distanceY;
      var distance = Math.sqrt(distanceSqr); // s += "\nDistance: " + distance;
      // Compute the module and components of the force vector

      var force = (node1.nodeRepulsion + node2.nodeRepulsion) / distanceSqr;
      var forceX = force * distanceX / distance;
      var forceY = force * distanceY / distance;
    } // Apply force


    if (!node1.isLocked) {
      node1.offsetX -= forceX;
      node1.offsetY -= forceY;
    }

    if (!node2.isLocked) {
      node2.offsetX += forceX;
      node2.offsetY += forceY;
    } // s += "\nForceX: " + forceX + " ForceY: " + forceY;
    // logDebug(s);


    return;
  };
  /**
   * @brief  : Determines whether two nodes overlap or not
   * @return : Amount of overlapping (0 => no overlap)
   */


  var nodesOverlap = function nodesOverlap(node1, node2, dX, dY) {
    if (dX > 0) {
      var overlapX = node1.maxX - node2.minX;
    } else {
      var overlapX = node2.maxX - node1.minX;
    }

    if (dY > 0) {
      var overlapY = node1.maxY - node2.minY;
    } else {
      var overlapY = node2.maxY - node1.minY;
    }

    if (overlapX >= 0 && overlapY >= 0) {
      return Math.sqrt(overlapX * overlapX + overlapY * overlapY);
    } else {
      return 0;
    }
  };
  /**
   * @brief : Finds the point in which an edge (direction dX, dY) intersects
   *          the rectangular bounding box of it's source/target node
   */


  var findClippingPoint = function findClippingPoint(node, dX, dY) {
    // Shorcuts
    var X = node.positionX;
    var Y = node.positionY;
    var H = node.height || 1;
    var W = node.width || 1;
    var dirSlope = dY / dX;
    var nodeSlope = H / W; // var s = 'Computing clipping point of node ' + node.id +
    //   " . Height:  " + H + ", Width: " + W +
    //   "\nDirection " + dX + ", " + dY;
    //
    // Compute intersection

    var res = {}; // Case: Vertical direction (up)

    if (0 === dX && 0 < dY) {
      res.x = X; // s += "\nUp direction";

      res.y = Y + H / 2;
      return res;
    } // Case: Vertical direction (down)


    if (0 === dX && 0 > dY) {
      res.x = X;
      res.y = Y + H / 2; // s += "\nDown direction";

      return res;
    } // Case: Intersects the right border


    if (0 < dX && -1 * nodeSlope <= dirSlope && dirSlope <= nodeSlope) {
      res.x = X + W / 2;
      res.y = Y + W * dY / 2 / dX; // s += "\nRightborder";

      return res;
    } // Case: Intersects the left border


    if (0 > dX && -1 * nodeSlope <= dirSlope && dirSlope <= nodeSlope) {
      res.x = X - W / 2;
      res.y = Y - W * dY / 2 / dX; // s += "\nLeftborder";

      return res;
    } // Case: Intersects the top border


    if (0 < dY && (dirSlope <= -1 * nodeSlope || dirSlope >= nodeSlope)) {
      res.x = X + H * dX / 2 / dY;
      res.y = Y + H / 2; // s += "\nTop border";

      return res;
    } // Case: Intersects the bottom border


    if (0 > dY && (dirSlope <= -1 * nodeSlope || dirSlope >= nodeSlope)) {
      res.x = X - H * dX / 2 / dY;
      res.y = Y - H / 2; // s += "\nBottom border";

      return res;
    } // s += "\nClipping point found at " + res.x + ", " + res.y;
    // logDebug(s);


    return res;
  };
  /**
   * @brief : Calculates all edge forces
   */


  var calculateEdgeForces = function calculateEdgeForces(layoutInfo, options) {
    // Iterate over all edges
    for (var i = 0; i < layoutInfo.edgeSize; i++) {
      // Get edge, source & target nodes
      var edge = layoutInfo.layoutEdges[i];
      var sourceIx = layoutInfo.idToIndex[edge.sourceId];
      var source = layoutInfo.layoutNodes[sourceIx];
      var targetIx = layoutInfo.idToIndex[edge.targetId];
      var target = layoutInfo.layoutNodes[targetIx]; // Get direction of line connecting both node centers

      var directionX = target.positionX - source.positionX;
      var directionY = target.positionY - source.positionY; // If both centers are the same, do nothing.
      // A random force has already been applied as node repulsion

      if (0 === directionX && 0 === directionY) {
        continue;
      } // Get clipping points for both nodes


      var point1 = findClippingPoint(source, directionX, directionY);
      var point2 = findClippingPoint(target, -1 * directionX, -1 * directionY);
      var lx = point2.x - point1.x;
      var ly = point2.y - point1.y;
      var l = Math.sqrt(lx * lx + ly * ly);
      var force = Math.pow(edge.idealLength - l, 2) / edge.elasticity;

      if (0 !== l) {
        var forceX = force * lx / l;
        var forceY = force * ly / l;
      } else {
        var forceX = 0;
        var forceY = 0;
      } // Add this force to target and source nodes


      if (!source.isLocked) {
        source.offsetX += forceX;
        source.offsetY += forceY;
      }

      if (!target.isLocked) {
        target.offsetX -= forceX;
        target.offsetY -= forceY;
      } // var s = 'Edge force between nodes ' + source.id + ' and ' + target.id;
      // s += "\nDistance: " + l + " Force: (" + forceX + ", " + forceY + ")";
      // logDebug(s);

    }
  };
  /**
   * @brief : Computes gravity forces for all nodes
   */


  var calculateGravityForces = function calculateGravityForces(layoutInfo, options) {
    var distThreshold = 1; // var s = 'calculateGravityForces';
    // logDebug(s);

    for (var i = 0; i < layoutInfo.graphSet.length; i++) {
      var graph = layoutInfo.graphSet[i];
      var numNodes = graph.length; // s = "Set: " + graph.toString();
      // logDebug(s);
      // Compute graph center

      if (0 === i) {
        var centerX = layoutInfo.clientHeight / 2;
        var centerY = layoutInfo.clientWidth / 2;
      } else {
        // Get Parent node for this graph, and use its position as center
        var temp = layoutInfo.layoutNodes[layoutInfo.idToIndex[graph[0]]];
        var parent = layoutInfo.layoutNodes[layoutInfo.idToIndex[temp.parentId]];
        var centerX = parent.positionX;
        var centerY = parent.positionY;
      } // s = "Center found at: " + centerX + ", " + centerY;
      // logDebug(s);
      // Apply force to all nodes in graph


      for (var j = 0; j < numNodes; j++) {
        var node = layoutInfo.layoutNodes[layoutInfo.idToIndex[graph[j]]]; // s = "Node: " + node.id;

        if (node.isLocked) {
          continue;
        }

        var dx = centerX - node.positionX;
        var dy = centerY - node.positionY;
        var d = Math.sqrt(dx * dx + dy * dy);

        if (d > distThreshold) {
          var fx = options.gravity * dx / d;
          var fy = options.gravity * dy / d;
          node.offsetX += fx;
          node.offsetY += fy; // s += ": Applied force: " + fx + ", " + fy;
        } // s += ": skypped since it's too close to center";
          // logDebug(s);

      }
    }
  };
  /**
   * @brief          : This function propagates the existing offsets from
   *                   parent nodes to its descendents.
   * @arg layoutInfo : layoutInfo Object
   * @arg cy         : cytoscape Object
   * @arg options    : Layout options
   */


  var propagateForces = function propagateForces(layoutInfo, options) {
    // Inline implementation of a queue, used for traversing the graph in BFS order
    var queue = [];
    var start = 0; // Points to the start the queue

    var end = -1; // Points to the end of the queue
    // logDebug('propagateForces');
    // Start by visiting the nodes in the root graph

    queue.push.apply(queue, layoutInfo.graphSet[0]);
    end += layoutInfo.graphSet[0].length; // Traverse the graph, level by level,

    while (start <= end) {
      // Get the node to visit and remove it from queue
      var nodeId = queue[start++];
      var nodeIndex = layoutInfo.idToIndex[nodeId];
      var node = layoutInfo.layoutNodes[nodeIndex];
      var children = node.children; // We only need to process the node if it's compound

      if (0 < children.length && !node.isLocked) {
        var offX = node.offsetX;
        var offY = node.offsetY; // var s = "Propagating offset from parent node : " + node.id +
        //   ". OffsetX: " + offX + ". OffsetY: " + offY;
        // s += "\n Children: " + children.toString();
        // logDebug(s);

        for (var i = 0; i < children.length; i++) {
          var childNode = layoutInfo.layoutNodes[layoutInfo.idToIndex[children[i]]]; // Propagate offset

          childNode.offsetX += offX;
          childNode.offsetY += offY; // Add children to queue to be visited

          queue[++end] = children[i];
        } // Reset parent offsets


        node.offsetX = 0;
        node.offsetY = 0;
      }
    }
  };
  /**
   * @brief : Updates the layout model positions, based on
   *          the accumulated forces
   */


  var updatePositions = function updatePositions(layoutInfo, options) {
    // var s = 'Updating positions';
    // logDebug(s);
    // Reset boundaries for compound nodes
    for (var i = 0; i < layoutInfo.nodeSize; i++) {
      var n = layoutInfo.layoutNodes[i];

      if (0 < n.children.length) {
        // logDebug("Resetting boundaries of compound node: " + n.id);
        n.maxX = undefined;
        n.minX = undefined;
        n.maxY = undefined;
        n.minY = undefined;
      }
    }

    for (var i = 0; i < layoutInfo.nodeSize; i++) {
      var n = layoutInfo.layoutNodes[i];

      if (0 < n.children.length || n.isLocked) {
        // No need to set compound or locked node position
        // logDebug("Skipping position update of node: " + n.id);
        continue;
      } // s = "Node: " + n.id + " Previous position: (" +
      // n.positionX + ", " + n.positionY + ").";
      // Limit displacement in order to improve stability


      var tempForce = limitForce(n.offsetX, n.offsetY, layoutInfo.temperature);
      n.positionX += tempForce.x;
      n.positionY += tempForce.y;
      n.offsetX = 0;
      n.offsetY = 0;
      n.minX = n.positionX - n.width;
      n.maxX = n.positionX + n.width;
      n.minY = n.positionY - n.height;
      n.maxY = n.positionY + n.height; // s += " New Position: (" + n.positionX + ", " + n.positionY + ").";
      // logDebug(s);
      // Update ancestry boudaries

      updateAncestryBoundaries(n, layoutInfo);
    } // Update size, position of compund nodes


    for (var i = 0; i < layoutInfo.nodeSize; i++) {
      var n = layoutInfo.layoutNodes[i];

      if (0 < n.children.length && !n.isLocked) {
        n.positionX = (n.maxX + n.minX) / 2;
        n.positionY = (n.maxY + n.minY) / 2;
        n.width = n.maxX - n.minX;
        n.height = n.maxY - n.minY; // s = "Updating position, size of compound node " + n.id;
        // s += "\nPositionX: " + n.positionX + ", PositionY: " + n.positionY;
        // s += "\nWidth: " + n.width + ", Height: " + n.height;
        // logDebug(s);
      }
    }
  };
  /**
   * @brief : Limits a force (forceX, forceY) to be not
   *          greater (in modulo) than max.
   8          Preserves force direction.
    */


  var limitForce = function limitForce(forceX, forceY, max) {
    // var s = "Limiting force: (" + forceX + ", " + forceY + "). Max: " + max;
    var force = Math.sqrt(forceX * forceX + forceY * forceY);

    if (force > max) {
      var res = {
        x: max * forceX / force,
        y: max * forceY / force
      };
    } else {
      var res = {
        x: forceX,
        y: forceY
      };
    } // s += ".\nResult: (" + res.x + ", " + res.y + ")";
    // logDebug(s);


    return res;
  };
  /**
   * @brief : Function used for keeping track of compound node
   *          sizes, since they should bound all their subnodes.
   */


  var updateAncestryBoundaries = function updateAncestryBoundaries(node, layoutInfo) {
    // var s = "Propagating new position/size of node " + node.id;
    var parentId = node.parentId;

    if (null == parentId) {
      // If there's no parent, we are done
      // s += ". No parent node.";
      // logDebug(s);
      return;
    } // Get Parent Node


    var p = layoutInfo.layoutNodes[layoutInfo.idToIndex[parentId]];
    var flag = false; // MaxX

    if (null == p.maxX || node.maxX + p.padRight > p.maxX) {
      p.maxX = node.maxX + p.padRight;
      flag = true; // s += "\nNew maxX for parent node " + p.id + ": " + p.maxX;
    } // MinX


    if (null == p.minX || node.minX - p.padLeft < p.minX) {
      p.minX = node.minX - p.padLeft;
      flag = true; // s += "\nNew minX for parent node " + p.id + ": " + p.minX;
    } // MaxY


    if (null == p.maxY || node.maxY + p.padBottom > p.maxY) {
      p.maxY = node.maxY + p.padBottom;
      flag = true; // s += "\nNew maxY for parent node " + p.id + ": " + p.maxY;
    } // MinY


    if (null == p.minY || node.minY - p.padTop < p.minY) {
      p.minY = node.minY - p.padTop;
      flag = true; // s += "\nNew minY for parent node " + p.id + ": " + p.minY;
    } // If updated boundaries, propagate changes upward


    if (flag) {
      // logDebug(s);
      return updateAncestryBoundaries(p, layoutInfo);
    } // s += ". No changes in boundaries/position of parent node " + p.id;
    // logDebug(s);


    return;
  };

  var separateComponents = function separateComponents(layoutInfo, options) {
    var nodes = layoutInfo.layoutNodes;
    var components = [];

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var cid = node.cmptId;
      var component = components[cid] = components[cid] || [];
      component.push(node);
    }

    var totalA = 0;

    for (var i = 0; i < components.length; i++) {
      var c = components[i];

      if (!c) {
        continue;
      }

      c.x1 = Infinity;
      c.x2 = -Infinity;
      c.y1 = Infinity;
      c.y2 = -Infinity;

      for (var j = 0; j < c.length; j++) {
        var n = c[j];
        c.x1 = Math.min(c.x1, n.positionX - n.width / 2);
        c.x2 = Math.max(c.x2, n.positionX + n.width / 2);
        c.y1 = Math.min(c.y1, n.positionY - n.height / 2);
        c.y2 = Math.max(c.y2, n.positionY + n.height / 2);
      }

      c.w = c.x2 - c.x1;
      c.h = c.y2 - c.y1;
      totalA += c.w * c.h;
    }

    components.sort(function (c1, c2) {
      return c2.w * c2.h - c1.w * c1.h;
    });
    var x = 0;
    var y = 0;
    var usedW = 0;
    var rowH = 0;
    var maxRowW = Math.sqrt(totalA) * layoutInfo.clientWidth / layoutInfo.clientHeight;

    for (var i = 0; i < components.length; i++) {
      var c = components[i];

      if (!c) {
        continue;
      }

      for (var j = 0; j < c.length; j++) {
        var n = c[j];

        if (!n.isLocked) {
          n.positionX += x - c.x1;
          n.positionY += y - c.y1;
        }
      }

      x += c.w + options.componentSpacing;
      usedW += c.w + options.componentSpacing;
      rowH = Math.max(rowH, c.h);

      if (usedW > maxRowW) {
        y += rowH + options.componentSpacing;
        x = 0;
        usedW = 0;
        rowH = 0;
      }
    }
  };

  var defaults$d = {
    fit: true,
    // whether to fit the viewport to the graph
    padding: 30,
    // padding used on fit
    boundingBox: undefined,
    // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
    avoidOverlap: true,
    // prevents node overlap, may overflow boundingBox if not enough space
    avoidOverlapPadding: 10,
    // extra spacing around nodes when avoidOverlap: true
    nodeDimensionsIncludeLabels: false,
    // Excludes the label when calculating node bounding boxes for the layout algorithm
    spacingFactor: undefined,
    // Applies a multiplicative factor (>0) to expand or compress the overall area that the nodes take up
    condense: false,
    // uses all available space on false, uses minimal space on true
    rows: undefined,
    // force num of rows in the grid
    cols: undefined,
    // force num of columns in the grid
    position: function position(node) {},
    // returns { row, col } for element
    sort: undefined,
    // a sorting function to order the nodes; e.g. function(a, b){ return a.data('weight') - b.data('weight') }
    animate: false,
    // whether to transition the node positions
    animationDuration: 500,
    // duration of animation in ms if enabled
    animationEasing: undefined,
    // easing of animation if enabled
    animateFilter: function animateFilter(node, i) {
      return true;
    },
    // a function that determines whether the node should be animated.  All nodes animated by default on animate enabled.  Non-animated nodes are positioned immediately when the layout starts
    ready: undefined,
    // callback on layoutready
    stop: undefined,
    // callback on layoutstop
    transform: function transform(node, position) {
      return position;
    } // transform a given node position. Useful for changing flow direction in discrete layouts 

  };

  function GridLayout(options) {
    this.options = extend({}, defaults$d, options);
  }

  GridLayout.prototype.run = function () {
    var params = this.options;
    var options = params;
    var cy = params.cy;
    var eles = options.eles;
    var nodes = eles.nodes().not(':parent');

    if (options.sort) {
      nodes = nodes.sort(options.sort);
    }

    var bb = makeBoundingBox(options.boundingBox ? options.boundingBox : {
      x1: 0,
      y1: 0,
      w: cy.width(),
      h: cy.height()
    });

    if (bb.h === 0 || bb.w === 0) {
      nodes.layoutPositions(this, options, function (ele) {
        return {
          x: bb.x1,
          y: bb.y1
        };
      });
    } else {
      // width/height * splits^2 = cells where splits is number of times to split width
      var cells = nodes.size();
      var splits = Math.sqrt(cells * bb.h / bb.w);
      var rows = Math.round(splits);
      var cols = Math.round(bb.w / bb.h * splits);

      var small = function small(val) {
        if (val == null) {
          return Math.min(rows, cols);
        } else {
          var min = Math.min(rows, cols);

          if (min == rows) {
            rows = val;
          } else {
            cols = val;
          }
        }
      };

      var large = function large(val) {
        if (val == null) {
          return Math.max(rows, cols);
        } else {
          var max = Math.max(rows, cols);

          if (max == rows) {
            rows = val;
          } else {
            cols = val;
          }
        }
      };

      var oRows = options.rows;
      var oCols = options.cols != null ? options.cols : options.columns; // if rows or columns were set in options, use those values

      if (oRows != null && oCols != null) {
        rows = oRows;
        cols = oCols;
      } else if (oRows != null && oCols == null) {
        rows = oRows;
        cols = Math.ceil(cells / rows);
      } else if (oRows == null && oCols != null) {
        cols = oCols;
        rows = Math.ceil(cells / cols);
      } // otherwise use the automatic values and adjust accordingly
      // if rounding was up, see if we can reduce rows or columns
      else if (cols * rows > cells) {
          var sm = small();
          var lg = large(); // reducing the small side takes away the most cells, so try it first

          if ((sm - 1) * lg >= cells) {
            small(sm - 1);
          } else if ((lg - 1) * sm >= cells) {
            large(lg - 1);
          }
        } else {
          // if rounding was too low, add rows or columns
          while (cols * rows < cells) {
            var _sm = small();

            var _lg = large(); // try to add to larger side first (adds less in multiplication)


            if ((_lg + 1) * _sm >= cells) {
              large(_lg + 1);
            } else {
              small(_sm + 1);
            }
          }
        }

      var cellWidth = bb.w / cols;
      var cellHeight = bb.h / rows;

      if (options.condense) {
        cellWidth = 0;
        cellHeight = 0;
      }

      if (options.avoidOverlap) {
        for (var i = 0; i < nodes.length; i++) {
          var node = nodes[i];
          var pos = node._private.position;

          if (pos.x == null || pos.y == null) {
            // for bb
            pos.x = 0;
            pos.y = 0;
          }

          var nbb = node.layoutDimensions(options);
          var p = options.avoidOverlapPadding;
          var w = nbb.w + p;
          var h = nbb.h + p;
          cellWidth = Math.max(cellWidth, w);
          cellHeight = Math.max(cellHeight, h);
        }
      }

      var cellUsed = {}; // e.g. 'c-0-2' => true

      var used = function used(row, col) {
        return cellUsed['c-' + row + '-' + col] ? true : false;
      };

      var use = function use(row, col) {
        cellUsed['c-' + row + '-' + col] = true;
      }; // to keep track of current cell position


      var row = 0;
      var col = 0;

      var moveToNextCell = function moveToNextCell() {
        col++;

        if (col >= cols) {
          col = 0;
          row++;
        }
      }; // get a cache of all the manual positions


      var id2manPos = {};

      for (var _i = 0; _i < nodes.length; _i++) {
        var _node = nodes[_i];
        var rcPos = options.position(_node);

        if (rcPos && (rcPos.row !== undefined || rcPos.col !== undefined)) {
          // must have at least row or col def'd
          var _pos = {
            row: rcPos.row,
            col: rcPos.col
          };

          if (_pos.col === undefined) {
            // find unused col
            _pos.col = 0;

            while (used(_pos.row, _pos.col)) {
              _pos.col++;
            }
          } else if (_pos.row === undefined) {
            // find unused row
            _pos.row = 0;

            while (used(_pos.row, _pos.col)) {
              _pos.row++;
            }
          }

          id2manPos[_node.id()] = _pos;
          use(_pos.row, _pos.col);
        }
      }

      var getPos = function getPos(element, i) {
        var x, y;

        if (element.locked() || element.isParent()) {
          return false;
        } // see if we have a manual position set


        var rcPos = id2manPos[element.id()];

        if (rcPos) {
          x = rcPos.col * cellWidth + cellWidth / 2 + bb.x1;
          y = rcPos.row * cellHeight + cellHeight / 2 + bb.y1;
        } else {
          // otherwise set automatically
          while (used(row, col)) {
            moveToNextCell();
          }

          x = col * cellWidth + cellWidth / 2 + bb.x1;
          y = row * cellHeight + cellHeight / 2 + bb.y1;
          use(row, col);
          moveToNextCell();
        }

        return {
          x: x,
          y: y
        };
      };

      nodes.layoutPositions(this, options, getPos);
    }

    return this; // chaining
  };

  var defaults$e = {
    ready: function ready() {},
    // on layoutready
    stop: function stop() {} // on layoutstop

  }; // constructor
  // options : object containing layout options

  function NullLayout(options) {
    this.options = extend({}, defaults$e, options);
  } // runs the layout


  NullLayout.prototype.run = function () {
    var options = this.options;
    var eles = options.eles; // elements to consider in the layout

    var layout = this; // cy is automatically populated for us in the constructor
    // (disable eslint for next line as this serves as example layout code to external developers)
    // eslint-disable-next-line no-unused-vars

    var cy = options.cy;
    layout.emit('layoutstart'); // puts all nodes at (0, 0)
    // n.b. most layouts would use layoutPositions(), instead of positions() and manual events

    eles.nodes().positions(function () {
      return {
        x: 0,
        y: 0
      };
    }); // trigger layoutready when each node has had its position set at least once

    layout.one('layoutready', options.ready);
    layout.emit('layoutready'); // trigger layoutstop when the layout stops (e.g. finishes)

    layout.one('layoutstop', options.stop);
    layout.emit('layoutstop');
    return this; // chaining
  }; // called on continuous layouts to stop them before they finish


  NullLayout.prototype.stop = function () {
    return this; // chaining
  };

  var defaults$f = {
    positions: undefined,
    // map of (node id) => (position obj); or function(node){ return somPos; }
    zoom: undefined,
    // the zoom level to set (prob want fit = false if set)
    pan: undefined,
    // the pan level to set (prob want fit = false if set)
    fit: true,
    // whether to fit to viewport
    padding: 30,
    // padding on fit
    animate: false,
    // whether to transition the node positions
    animationDuration: 500,
    // duration of animation in ms if enabled
    animationEasing: undefined,
    // easing of animation if enabled
    animateFilter: function animateFilter(node, i) {
      return true;
    },
    // a function that determines whether the node should be animated.  All nodes animated by default on animate enabled.  Non-animated nodes are positioned immediately when the layout starts
    ready: undefined,
    // callback on layoutready
    stop: undefined,
    // callback on layoutstop
    transform: function transform(node, position) {
      return position;
    } // transform a given node position. Useful for changing flow direction in discrete layouts

  };

  function PresetLayout(options) {
    this.options = extend({}, defaults$f, options);
  }

  PresetLayout.prototype.run = function () {
    var options = this.options;
    var eles = options.eles;
    var nodes = eles.nodes();
    var posIsFn = fn(options.positions);

    function getPosition(node) {
      if (options.positions == null) {
        return copyPosition(node.position());
      }

      if (posIsFn) {
        return options.positions(node);
      }

      var pos = options.positions[node._private.data.id];

      if (pos == null) {
        return null;
      }

      return pos;
    }

    nodes.layoutPositions(this, options, function (node, i) {
      var position = getPosition(node);

      if (node.locked() || position == null) {
        return false;
      }

      return position;
    });
    return this; // chaining
  };

  var defaults$g = {
    fit: true,
    // whether to fit to viewport
    padding: 30,
    // fit padding
    boundingBox: undefined,
    // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
    animate: false,
    // whether to transition the node positions
    animationDuration: 500,
    // duration of animation in ms if enabled
    animationEasing: undefined,
    // easing of animation if enabled
    animateFilter: function animateFilter(node, i) {
      return true;
    },
    // a function that determines whether the node should be animated.  All nodes animated by default on animate enabled.  Non-animated nodes are positioned immediately when the layout starts
    ready: undefined,
    // callback on layoutready
    stop: undefined,
    // callback on layoutstop
    transform: function transform(node, position) {
      return position;
    } // transform a given node position. Useful for changing flow direction in discrete layouts 

  };

  function RandomLayout(options) {
    this.options = extend({}, defaults$g, options);
  }

  RandomLayout.prototype.run = function () {
    var options = this.options;
    var cy = options.cy;
    var eles = options.eles;
    var nodes = eles.nodes().not(':parent');
    var bb = makeBoundingBox(options.boundingBox ? options.boundingBox : {
      x1: 0,
      y1: 0,
      w: cy.width(),
      h: cy.height()
    });

    var getPos = function getPos(node, i) {
      return {
        x: bb.x1 + Math.round(Math.random() * bb.w),
        y: bb.y1 + Math.round(Math.random() * bb.h)
      };
    };

    nodes.layoutPositions(this, options, getPos);
    return this; // chaining
  };

  var layout = [{
    name: 'breadthfirst',
    impl: BreadthFirstLayout
  }, {
    name: 'circle',
    impl: CircleLayout
  }, {
    name: 'concentric',
    impl: ConcentricLayout
  }, {
    name: 'cose',
    impl: CoseLayout
  }, {
    name: 'grid',
    impl: GridLayout
  }, {
    name: 'null',
    impl: NullLayout
  }, {
    name: 'preset',
    impl: PresetLayout
  }, {
    name: 'random',
    impl: RandomLayout
  }];

  function NullRenderer(options) {
    this.options = options;
    this.notifications = 0; // for testing
  }

  var noop$1 = function noop() {};

  var throwImgErr = function throwImgErr() {
    throw new Error('A headless instance can not render images');
  };

  NullRenderer.prototype = {
    recalculateRenderedStyle: noop$1,
    notify: function notify() {
      this.notifications++;
    },
    init: noop$1,
    isHeadless: function isHeadless() {
      return true;
    },
    png: throwImgErr,
    jpg: throwImgErr
  };

  var BRp = {};
  BRp.arrowShapeWidth = 0.3;

  BRp.registerArrowShapes = function () {
    var arrowShapes = this.arrowShapes = {};
    var renderer = this; // Contract for arrow shapes:
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

    var bbCollide = function bbCollide(x, y, size, angle, translation, edgeWidth, padding) {
      var x1 = translation.x - size / 2 - padding;
      var x2 = translation.x + size / 2 + padding;
      var y1 = translation.y - size / 2 - padding;
      var y2 = translation.y + size / 2 + padding;
      var inside = x1 <= x && x <= x2 && y1 <= y && y <= y2;
      return inside;
    };

    var transform = function transform(x, y, size, angle, translation) {
      var xRotated = x * Math.cos(angle) - y * Math.sin(angle);
      var yRotated = x * Math.sin(angle) + y * Math.cos(angle);
      var xScaled = xRotated * size;
      var yScaled = yRotated * size;
      var xTranslated = xScaled + translation.x;
      var yTranslated = yScaled + translation.y;
      return {
        x: xTranslated,
        y: yTranslated
      };
    };

    var transformPoints = function transformPoints(pts, size, angle, translation) {
      var retPts = [];

      for (var i = 0; i < pts.length; i += 2) {
        var x = pts[i];
        var y = pts[i + 1];
        retPts.push(transform(x, y, size, angle, translation));
      }

      return retPts;
    };

    var pointsToArr = function pointsToArr(pts) {
      var ret = [];

      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        ret.push(p.x, p.y);
      }

      return ret;
    };

    var standardGap = function standardGap(edge) {
      return edge.pstyle('width').pfValue * edge.pstyle('arrow-scale').pfValue * 2;
    };

    var defineArrowShape = function defineArrowShape(name, defn) {
      if (string(defn)) {
        defn = arrowShapes[defn];
      }

      arrowShapes[name] = extend({
        name: name,
        points: [-0.15, -0.3, 0.15, -0.3, 0.15, 0.3, -0.15, 0.3],
        collide: function collide(x, y, size, angle, translation, padding) {
          var points = pointsToArr(transformPoints(this.points, size + 2 * padding, angle, translation));
          var inside = pointInsidePolygonPoints(x, y, points);
          return inside;
        },
        roughCollide: bbCollide,
        draw: function draw(context, size, angle, translation) {
          var points = transformPoints(this.points, size, angle, translation);
          renderer.arrowShapeImpl('polygon')(context, points);
        },
        spacing: function spacing(edge) {
          return 0;
        },
        gap: standardGap
      }, defn);
    };

    defineArrowShape('none', {
      collide: falsify,
      roughCollide: falsify,
      draw: noop,
      spacing: zeroify,
      gap: zeroify
    });
    defineArrowShape('triangle', {
      points: [-0.15, -0.3, 0, 0, 0.15, -0.3]
    });
    defineArrowShape('arrow', 'triangle');
    defineArrowShape('triangle-backcurve', {
      points: arrowShapes['triangle'].points,
      controlPoint: [0, -0.15],
      roughCollide: bbCollide,
      draw: function draw(context, size, angle, translation, edgeWidth) {
        var ptsTrans = transformPoints(this.points, size, angle, translation);
        var ctrlPt = this.controlPoint;
        var ctrlPtTrans = transform(ctrlPt[0], ctrlPt[1], size, angle, translation);
        renderer.arrowShapeImpl(this.name)(context, ptsTrans, ctrlPtTrans);
      },
      gap: function gap(edge) {
        return standardGap(edge) * 0.8;
      }
    });
    defineArrowShape('triangle-tee', {
      points: [0, 0, 0.15, -0.3, -0.15, -0.3, 0, 0],
      pointsTee: [-0.15, -0.4, -0.15, -0.5, 0.15, -0.5, 0.15, -0.4],
      collide: function collide(x, y, size, angle, translation, edgeWidth, padding) {
        var triPts = pointsToArr(transformPoints(this.points, size + 2 * padding, angle, translation));
        var teePts = pointsToArr(transformPoints(this.pointsTee, size + 2 * padding, angle, translation));
        var inside = pointInsidePolygonPoints(x, y, triPts) || pointInsidePolygonPoints(x, y, teePts);
        return inside;
      },
      draw: function draw(context, size, angle, translation, edgeWidth) {
        var triPts = transformPoints(this.points, size, angle, translation);
        var teePts = transformPoints(this.pointsTee, size, angle, translation);
        renderer.arrowShapeImpl(this.name)(context, triPts, teePts);
      }
    });
    defineArrowShape('circle-triangle', {
      radius: 0.15,
      pointsTr: [0, -0.15, 0.15, -0.45, -0.15, -0.45, 0, -0.15],
      collide: function collide(x, y, size, angle, translation, edgeWidth, padding) {
        var t = translation;
        var circleInside = Math.pow(t.x - x, 2) + Math.pow(t.y - y, 2) <= Math.pow((size + 2 * padding) * this.radius, 2);
        var triPts = pointsToArr(transformPoints(this.points, size + 2 * padding, angle, translation));
        return pointInsidePolygonPoints(x, y, triPts) || circleInside;
      },
      draw: function draw(context, size, angle, translation, edgeWidth) {
        var triPts = transformPoints(this.pointsTr, size, angle, translation);
        renderer.arrowShapeImpl(this.name)(context, triPts, translation.x, translation.y, this.radius * size);
      },
      spacing: function spacing(edge) {
        return renderer.getArrowWidth(edge.pstyle('width').pfValue, edge.pstyle('arrow-scale').value) * this.radius;
      }
    });
    defineArrowShape('triangle-cross', {
      points: [0, 0, 0.15, -0.3, -0.15, -0.3, 0, 0],
      baseCrossLinePts: [-0.15, -0.4, // first half of the rectangle
      -0.15, -0.4, 0.15, -0.4, // second half of the rectangle
      0.15, -0.4],
      crossLinePts: function crossLinePts(size, edgeWidth) {
        // shift points so that the distance between the cross points matches edge width
        var p = this.baseCrossLinePts.slice();
        var shiftFactor = edgeWidth / size;
        var y0 = 3;
        var y1 = 5;
        p[y0] = p[y0] - shiftFactor;
        p[y1] = p[y1] - shiftFactor;
        return p;
      },
      collide: function collide(x, y, size, angle, translation, edgeWidth, padding) {
        var triPts = pointsToArr(transformPoints(this.points, size + 2 * padding, angle, translation));
        var teePts = pointsToArr(transformPoints(this.crossLinePts(size, edgeWidth), size + 2 * padding, angle, translation));
        var inside = pointInsidePolygonPoints(x, y, triPts) || pointInsidePolygonPoints(x, y, teePts);
        return inside;
      },
      draw: function draw(context, size, angle, translation, edgeWidth) {
        var triPts = transformPoints(this.points, size, angle, translation);
        var crossLinePts = transformPoints(this.crossLinePts(size, edgeWidth), size, angle, translation);
        renderer.arrowShapeImpl(this.name)(context, triPts, crossLinePts);
      }
    });
    defineArrowShape('vee', {
      points: [-0.15, -0.3, 0, 0, 0.15, -0.3, 0, -0.15],
      gap: function gap(edge) {
        return standardGap(edge) * 0.525;
      }
    });
    defineArrowShape('circle', {
      radius: 0.15,
      collide: function collide(x, y, size, angle, translation, edgeWidth, padding) {
        var t = translation;
        var inside = Math.pow(t.x - x, 2) + Math.pow(t.y - y, 2) <= Math.pow((size + 2 * padding) * this.radius, 2);
        return inside;
      },
      draw: function draw(context, size, angle, translation, edgeWidth) {
        renderer.arrowShapeImpl(this.name)(context, translation.x, translation.y, this.radius * size);
      },
      spacing: function spacing(edge) {
        return renderer.getArrowWidth(edge.pstyle('width').pfValue, edge.pstyle('arrow-scale').value) * this.radius;
      }
    });
    defineArrowShape('tee', {
      points: [-0.15, 0, -0.15, -0.1, 0.15, -0.1, 0.15, 0],
      spacing: function spacing(edge) {
        return 1;
      },
      gap: function gap(edge) {
        return 1;
      }
    });
    defineArrowShape('square', {
      points: [-0.15, 0.00, 0.15, 0.00, 0.15, -0.3, -0.15, -0.3]
    });
    defineArrowShape('diamond', {
      points: [-0.15, -0.15, 0, -0.3, 0.15, -0.15, 0, 0],
      gap: function gap(edge) {
        return edge.pstyle('width').pfValue * edge.pstyle('arrow-scale').value;
      }
    });
    defineArrowShape('chevron', {
      points: [0, 0, -0.15, -0.15, -0.1, -0.2, 0, -0.1, 0.1, -0.2, 0.15, -0.15],
      gap: function gap(edge) {
        return 0.95 * edge.pstyle('width').pfValue * edge.pstyle('arrow-scale').value;
      }
    });
  };

  var BRp$1 = {}; // Project mouse

  BRp$1.projectIntoViewport = function (clientX, clientY) {
    var cy = this.cy;
    var offsets = this.findContainerClientCoords();
    var offsetLeft = offsets[0];
    var offsetTop = offsets[1];
    var scale = offsets[4];
    var pan = cy.pan();
    var zoom = cy.zoom();
    var x = ((clientX - offsetLeft) / scale - pan.x) / zoom;
    var y = ((clientY - offsetTop) / scale - pan.y) / zoom;
    return [x, y];
  };

  BRp$1.findContainerClientCoords = function () {
    if (this.containerBB) {
      return this.containerBB;
    }

    var container = this.container;
    var rect = container.getBoundingClientRect();
    var style = window$1.getComputedStyle(container);

    var styleValue = function styleValue(name) {
      return parseFloat(style.getPropertyValue(name));
    };

    var padding = {
      left: styleValue('padding-left'),
      right: styleValue('padding-right'),
      top: styleValue('padding-top'),
      bottom: styleValue('padding-bottom')
    };
    var border = {
      left: styleValue('border-left-width'),
      right: styleValue('border-right-width'),
      top: styleValue('border-top-width'),
      bottom: styleValue('border-bottom-width')
    };
    var clientWidth = container.clientWidth;
    var clientHeight = container.clientHeight;
    var paddingHor = padding.left + padding.right;
    var paddingVer = padding.top + padding.bottom;
    var borderHor = border.left + border.right;
    var scale = rect.width / (clientWidth + borderHor);
    var unscaledW = clientWidth - paddingHor;
    var unscaledH = clientHeight - paddingVer;
    var left = rect.left + padding.left + border.left;
    var top = rect.top + padding.top + border.top;
    return this.containerBB = [left, top, unscaledW, unscaledH, scale];
  };

  BRp$1.invalidateContainerClientCoordsCache = function () {
    this.containerBB = null;
  };

  BRp$1.findNearestElement = function (x, y, interactiveElementsOnly, isTouch) {
    return this.findNearestElements(x, y, interactiveElementsOnly, isTouch)[0];
  };

  BRp$1.findNearestElements = function (x, y, interactiveElementsOnly, isTouch) {
    var self = this;
    var r = this;
    var eles = r.getCachedZSortedEles();
    var near = []; // 1 node max, 1 edge max

    var zoom = r.cy.zoom();
    var hasCompounds = r.cy.hasCompoundNodes();
    var edgeThreshold = (isTouch ? 24 : 8) / zoom;
    var nodeThreshold = (isTouch ? 8 : 2) / zoom;
    var labelThreshold = (isTouch ? 8 : 2) / zoom;
    var minSqDist = Infinity;
    var nearEdge;
    var nearNode;

    if (interactiveElementsOnly) {
      eles = eles.interactive;
    }

    function addEle(ele, sqDist) {
      if (ele.isNode()) {
        if (nearNode) {
          return; // can't replace node
        } else {
          nearNode = ele;
          near.push(ele);
        }
      }

      if (ele.isEdge() && (sqDist == null || sqDist < minSqDist)) {
        if (nearEdge) {
          // then replace existing edge
          // can replace only if same z-index
          if (nearEdge.pstyle('z-compound-depth').value === ele.pstyle('z-compound-depth').value && nearEdge.pstyle('z-compound-depth').value === ele.pstyle('z-compound-depth').value) {
            for (var i = 0; i < near.length; i++) {
              if (near[i].isEdge()) {
                near[i] = ele;
                nearEdge = ele;
                minSqDist = sqDist != null ? sqDist : minSqDist;
                break;
              }
            }
          }
        } else {
          near.push(ele);
          nearEdge = ele;
          minSqDist = sqDist != null ? sqDist : minSqDist;
        }
      }
    }

    function checkNode(node) {
      var width = node.outerWidth() + 2 * nodeThreshold;
      var height = node.outerHeight() + 2 * nodeThreshold;
      var hw = width / 2;
      var hh = height / 2;
      var pos = node.position();

      if (pos.x - hw <= x && x <= pos.x + hw // bb check x
      && pos.y - hh <= y && y <= pos.y + hh // bb check y
      ) {
          var shape = r.nodeShapes[self.getNodeShape(node)];

          if (shape.checkPoint(x, y, 0, width, height, pos.x, pos.y)) {
            addEle(node, 0);
            return true;
          }
        }
    }

    function checkEdge(edge) {
      var _p = edge._private;
      var rs = _p.rscratch;
      var styleWidth = edge.pstyle('width').pfValue;
      var scale = edge.pstyle('arrow-scale').value;
      var width = styleWidth / 2 + edgeThreshold; // more like a distance radius from centre

      var widthSq = width * width;
      var width2 = width * 2;
      var src = _p.source;
      var tgt = _p.target;
      var sqDist;

      if (rs.edgeType === 'segments' || rs.edgeType === 'straight' || rs.edgeType === 'haystack') {
        var pts = rs.allpts;

        for (var i = 0; i + 3 < pts.length; i += 2) {
          if (inLineVicinity(x, y, pts[i], pts[i + 1], pts[i + 2], pts[i + 3], width2) && widthSq > (sqDist = sqdistToFiniteLine(x, y, pts[i], pts[i + 1], pts[i + 2], pts[i + 3]))) {
            addEle(edge, sqDist);
            return true;
          }
        }
      } else if (rs.edgeType === 'bezier' || rs.edgeType === 'multibezier' || rs.edgeType === 'self' || rs.edgeType === 'compound') {
        var pts = rs.allpts;

        for (var i = 0; i + 5 < rs.allpts.length; i += 4) {
          if (inBezierVicinity(x, y, pts[i], pts[i + 1], pts[i + 2], pts[i + 3], pts[i + 4], pts[i + 5], width2) && widthSq > (sqDist = sqdistToQuadraticBezier(x, y, pts[i], pts[i + 1], pts[i + 2], pts[i + 3], pts[i + 4], pts[i + 5]))) {
            addEle(edge, sqDist);
            return true;
          }
        }
      } // if we're close to the edge but didn't hit it, maybe we hit its arrows


      var src = src || _p.source;
      var tgt = tgt || _p.target;
      var arSize = self.getArrowWidth(styleWidth, scale);
      var arrows = [{
        name: 'source',
        x: rs.arrowStartX,
        y: rs.arrowStartY,
        angle: rs.srcArrowAngle
      }, {
        name: 'target',
        x: rs.arrowEndX,
        y: rs.arrowEndY,
        angle: rs.tgtArrowAngle
      }, {
        name: 'mid-source',
        x: rs.midX,
        y: rs.midY,
        angle: rs.midsrcArrowAngle
      }, {
        name: 'mid-target',
        x: rs.midX,
        y: rs.midY,
        angle: rs.midtgtArrowAngle
      }];

      for (var i = 0; i < arrows.length; i++) {
        var ar = arrows[i];
        var shape = r.arrowShapes[edge.pstyle(ar.name + '-arrow-shape').value];
        var edgeWidth = edge.pstyle('width').pfValue;

        if (shape.roughCollide(x, y, arSize, ar.angle, {
          x: ar.x,
          y: ar.y
        }, edgeWidth, edgeThreshold) && shape.collide(x, y, arSize, ar.angle, {
          x: ar.x,
          y: ar.y
        }, edgeWidth, edgeThreshold)) {
          addEle(edge);
          return true;
        }
      } // for compound graphs, hitting edge may actually want a connected node instead (b/c edge may have greater z-index precedence)


      if (hasCompounds && near.length > 0) {
        checkNode(src);
        checkNode(tgt);
      }
    }

    function preprop(obj, name, pre) {
      return getPrefixedProperty(obj, name, pre);
    }

    function checkLabel(ele, prefix) {
      var _p = ele._private;
      var th = labelThreshold;
      var prefixDash;

      if (prefix) {
        prefixDash = prefix + '-';
      } else {
        prefixDash = '';
      }

      ele.boundingBox();
      var bb = _p.labelBounds[prefix || 'main'];
      var text = ele.pstyle(prefixDash + 'label').value;
      var eventsEnabled = ele.pstyle('text-events').strValue === 'yes';

      if (!eventsEnabled || !text) {
        return;
      }

      var rstyle = _p.rstyle;
      var lx = preprop(rstyle, 'labelX', prefix);
      var ly = preprop(rstyle, 'labelY', prefix);
      var theta = preprop(_p.rscratch, 'labelAngle', prefix);
      var lx1 = bb.x1 - th;
      var lx2 = bb.x2 + th;
      var ly1 = bb.y1 - th;
      var ly2 = bb.y2 + th;

      if (theta) {
        var cos = Math.cos(theta);
        var sin = Math.sin(theta);

        var rotate = function rotate(x, y) {
          x = x - lx;
          y = y - ly;
          return {
            x: x * cos - y * sin + lx,
            y: x * sin + y * cos + ly
          };
        };

        var px1y1 = rotate(lx1, ly1);
        var px1y2 = rotate(lx1, ly2);
        var px2y1 = rotate(lx2, ly1);
        var px2y2 = rotate(lx2, ly2);
        var points = [px1y1.x, px1y1.y, px2y1.x, px2y1.y, px2y2.x, px2y2.y, px1y2.x, px1y2.y];

        if (pointInsidePolygonPoints(x, y, points)) {
          addEle(ele);
          return true;
        }
      } else {
        // do a cheaper bb check
        if (inBoundingBox(bb, x, y)) {
          addEle(ele);
          return true;
        }
      }
    }

    for (var i = eles.length - 1; i >= 0; i--) {
      // reverse order for precedence
      var ele = eles[i];

      if (ele.isNode()) {
        checkNode(ele) || checkLabel(ele);
      } else {
        // then edge
        checkEdge(ele) || checkLabel(ele) || checkLabel(ele, 'source') || checkLabel(ele, 'target');
      }
    }

    return near;
  }; // 'Give me everything from this box'


  BRp$1.getAllInBox = function (x1, y1, x2, y2) {
    var eles = this.getCachedZSortedEles().interactive;
    var box = [];
    var x1c = Math.min(x1, x2);
    var x2c = Math.max(x1, x2);
    var y1c = Math.min(y1, y2);
    var y2c = Math.max(y1, y2);
    x1 = x1c;
    x2 = x2c;
    y1 = y1c;
    y2 = y2c;
    var boxBb = makeBoundingBox({
      x1: x1,
      y1: y1,
      x2: x2,
      y2: y2
    });

    for (var e = 0; e < eles.length; e++) {
      var ele = eles[e];

      if (ele.isNode()) {
        var node = ele;
        var nodeBb = node.boundingBox({
          includeNodes: true,
          includeEdges: false,
          includeLabels: false
        });

        if (boundingBoxesIntersect(boxBb, nodeBb) && !boundingBoxInBoundingBox(nodeBb, boxBb)) {
          box.push(node);
        }
      } else {
        var edge = ele;
        var _p = edge._private;
        var rs = _p.rscratch;

        if (rs.startX != null && rs.startY != null && !inBoundingBox(boxBb, rs.startX, rs.startY)) {
          continue;
        }

        if (rs.endX != null && rs.endY != null && !inBoundingBox(boxBb, rs.endX, rs.endY)) {
          continue;
        }

        if (rs.edgeType === 'bezier' || rs.edgeType === 'multibezier' || rs.edgeType === 'self' || rs.edgeType === 'compound' || rs.edgeType === 'segments' || rs.edgeType === 'haystack') {
          var pts = _p.rstyle.bezierPts || _p.rstyle.linePts || _p.rstyle.haystackPts;
          var allInside = true;

          for (var i = 0; i < pts.length; i++) {
            if (!pointInBoundingBox(boxBb, pts[i])) {
              allInside = false;
              break;
            }
          }

          if (allInside) {
            box.push(edge);
          }
        } else if (rs.edgeType === 'haystack' || rs.edgeType === 'straight') {
          box.push(edge);
        }
      }
    }

    return box;
  };

  var BRp$2 = {};

  BRp$2.calculateArrowAngles = function (edge) {
    var rs = edge._private.rscratch;
    var isHaystack = rs.edgeType === 'haystack';
    var isBezier = rs.edgeType === 'bezier';
    var isMultibezier = rs.edgeType === 'multibezier';
    var isSegments = rs.edgeType === 'segments';
    var isCompound = rs.edgeType === 'compound';
    var isSelf = rs.edgeType === 'self'; // Displacement gives direction for arrowhead orientation

    var dispX, dispY;
    var startX, startY, endX, endY, midX, midY;

    if (isHaystack) {
      startX = rs.haystackPts[0];
      startY = rs.haystackPts[1];
      endX = rs.haystackPts[2];
      endY = rs.haystackPts[3];
    } else {
      startX = rs.arrowStartX;
      startY = rs.arrowStartY;
      endX = rs.arrowEndX;
      endY = rs.arrowEndY;
    }

    midX = rs.midX;
    midY = rs.midY; // source
    //

    if (isSegments) {
      dispX = startX - rs.segpts[0];
      dispY = startY - rs.segpts[1];
    } else if (isMultibezier || isCompound || isSelf || isBezier) {
      var pts = rs.allpts;
      var bX = qbezierAt(pts[0], pts[2], pts[4], 0.1);
      var bY = qbezierAt(pts[1], pts[3], pts[5], 0.1);
      dispX = startX - bX;
      dispY = startY - bY;
    } else {
      dispX = startX - midX;
      dispY = startY - midY;
    }

    rs.srcArrowAngle = getAngleFromDisp(dispX, dispY); // mid target
    //

    var midX = rs.midX;
    var midY = rs.midY;

    if (isHaystack) {
      midX = (startX + endX) / 2;
      midY = (startY + endY) / 2;
    }

    dispX = endX - startX;
    dispY = endY - startY;

    if (isSegments) {
      var pts = rs.allpts;

      if (pts.length / 2 % 2 === 0) {
        var i2 = pts.length / 2;
        var i1 = i2 - 2;
        dispX = pts[i2] - pts[i1];
        dispY = pts[i2 + 1] - pts[i1 + 1];
      } else {
        var i2 = pts.length / 2 - 1;
        var i1 = i2 - 2;
        var i3 = i2 + 2;
        dispX = pts[i2] - pts[i1];
        dispY = pts[i2 + 1] - pts[i1 + 1];
      }
    } else if (isMultibezier || isCompound || isSelf) {
      var pts = rs.allpts;
      var cpts = rs.ctrlpts;
      var bp0x, bp0y;
      var bp1x, bp1y;

      if (cpts.length / 2 % 2 === 0) {
        var p0 = pts.length / 2 - 1; // startpt

        var ic = p0 + 2;
        var p1 = ic + 2;
        bp0x = qbezierAt(pts[p0], pts[ic], pts[p1], 0.0);
        bp0y = qbezierAt(pts[p0 + 1], pts[ic + 1], pts[p1 + 1], 0.0);
        bp1x = qbezierAt(pts[p0], pts[ic], pts[p1], 0.0001);
        bp1y = qbezierAt(pts[p0 + 1], pts[ic + 1], pts[p1 + 1], 0.0001);
      } else {
        var ic = pts.length / 2 - 1; // ctrpt

        var p0 = ic - 2; // startpt

        var p1 = ic + 2; // endpt

        bp0x = qbezierAt(pts[p0], pts[ic], pts[p1], 0.4999);
        bp0y = qbezierAt(pts[p0 + 1], pts[ic + 1], pts[p1 + 1], 0.4999);
        bp1x = qbezierAt(pts[p0], pts[ic], pts[p1], 0.5);
        bp1y = qbezierAt(pts[p0 + 1], pts[ic + 1], pts[p1 + 1], 0.5);
      }

      dispX = bp1x - bp0x;
      dispY = bp1y - bp0y;
    }

    rs.midtgtArrowAngle = getAngleFromDisp(dispX, dispY);
    rs.midDispX = dispX;
    rs.midDispY = dispY; // mid source
    //

    dispX *= -1;
    dispY *= -1;

    if (isSegments) {
      var pts = rs.allpts;

      if (pts.length / 2 % 2 === 0) ; else {
        var i2 = pts.length / 2 - 1;
        var i3 = i2 + 2;
        dispX = -(pts[i3] - pts[i2]);
        dispY = -(pts[i3 + 1] - pts[i2 + 1]);
      }
    }

    rs.midsrcArrowAngle = getAngleFromDisp(dispX, dispY); // target
    //

    if (isSegments) {
      dispX = endX - rs.segpts[rs.segpts.length - 2];
      dispY = endY - rs.segpts[rs.segpts.length - 1];
    } else if (isMultibezier || isCompound || isSelf || isBezier) {
      var pts = rs.allpts;
      var l = pts.length;
      var bX = qbezierAt(pts[l - 6], pts[l - 4], pts[l - 2], 0.9);
      var bY = qbezierAt(pts[l - 5], pts[l - 3], pts[l - 1], 0.9);
      dispX = endX - bX;
      dispY = endY - bY;
    } else {
      dispX = endX - midX;
      dispY = endY - midY;
    }

    rs.tgtArrowAngle = getAngleFromDisp(dispX, dispY);
  };

  BRp$2.getArrowWidth = BRp$2.getArrowHeight = function (edgeWidth, scale) {
    var cache = this.arrowWidthCache = this.arrowWidthCache || {};
    var cachedVal = cache[edgeWidth + ', ' + scale];

    if (cachedVal) {
      return cachedVal;
    }

    cachedVal = Math.max(Math.pow(edgeWidth * 13.37, 0.9), 29) * scale;
    cache[edgeWidth + ', ' + scale] = cachedVal;
    return cachedVal;
  };

  var BRp$3 = {};

  BRp$3.findHaystackPoints = function (edges) {
    for (var i = 0; i < edges.length; i++) {
      var edge = edges[i];
      var _p = edge._private;
      var rs = _p.rscratch;

      if (!rs.haystack) {
        var angle = Math.random() * 2 * Math.PI;
        rs.source = {
          x: Math.cos(angle),
          y: Math.sin(angle)
        };
        angle = Math.random() * 2 * Math.PI;
        rs.target = {
          x: Math.cos(angle),
          y: Math.sin(angle)
        };
      }

      var src = _p.source;
      var tgt = _p.target;
      var srcPos = src.position();
      var tgtPos = tgt.position();
      var srcW = src.width();
      var tgtW = tgt.width();
      var srcH = src.height();
      var tgtH = tgt.height();
      var radius = edge.pstyle('haystack-radius').value;
      var halfRadius = radius / 2; // b/c have to half width/height

      rs.haystackPts = rs.allpts = [rs.source.x * srcW * halfRadius + srcPos.x, rs.source.y * srcH * halfRadius + srcPos.y, rs.target.x * tgtW * halfRadius + tgtPos.x, rs.target.y * tgtH * halfRadius + tgtPos.y];
      rs.midX = (rs.allpts[0] + rs.allpts[2]) / 2;
      rs.midY = (rs.allpts[1] + rs.allpts[3]) / 2; // always override as haystack in case set to different type previously

      rs.edgeType = 'haystack';
      rs.haystack = true;
      this.storeEdgeProjections(edge);
      this.calculateArrowAngles(edge);
      this.recalculateEdgeLabelProjections(edge);
      this.calculateLabelAngles(edge);
    }
  };

  BRp$3.findSegmentsPoints = function (edge, pairInfo) {
    // Segments (multiple straight lines)
    var rs = edge._private.rscratch;
    var posPts = pairInfo.posPts,
        intersectionPts = pairInfo.intersectionPts,
        vectorNormInverse = pairInfo.vectorNormInverse;
    var edgeDistances = edge.pstyle('edge-distances').value;
    var segmentWs = edge.pstyle('segment-weights');
    var segmentDs = edge.pstyle('segment-distances');
    var segmentsN = Math.min(segmentWs.pfValue.length, segmentDs.pfValue.length);
    rs.edgeType = 'segments';
    rs.segpts = [];

    for (var s = 0; s < segmentsN; s++) {
      var w = segmentWs.pfValue[s];
      var d = segmentDs.pfValue[s];
      var w1 = 1 - w;
      var w2 = w;
      var midptPts = edgeDistances === 'node-position' ? posPts : intersectionPts;
      var adjustedMidpt = {
        x: midptPts.x1 * w1 + midptPts.x2 * w2,
        y: midptPts.y1 * w1 + midptPts.y2 * w2
      };
      rs.segpts.push(adjustedMidpt.x + vectorNormInverse.x * d, adjustedMidpt.y + vectorNormInverse.y * d);
    }
  };

  BRp$3.findLoopPoints = function (edge, pairInfo, i, edgeIsUnbundled) {
    // Self-edge
    var rs = edge._private.rscratch;
    var dirCounts = pairInfo.dirCounts,
        srcPos = pairInfo.srcPos;
    var ctrlptDists = edge.pstyle('control-point-distances');
    var ctrlptDist = ctrlptDists ? ctrlptDists.pfValue[0] : undefined;
    var loopDir = edge.pstyle('loop-direction').pfValue;
    var loopSwp = edge.pstyle('loop-sweep').pfValue;
    var stepSize = edge.pstyle('control-point-step-size').pfValue;
    rs.edgeType = 'self';
    var j = i;
    var loopDist = stepSize;

    if (edgeIsUnbundled) {
      j = 0;
      loopDist = ctrlptDist;
    }

    var loopAngle = loopDir - Math.PI / 2;
    var outAngle = loopAngle - loopSwp / 2;
    var inAngle = loopAngle + loopSwp / 2; // increase by step size for overlapping loops, keyed on direction and sweep values

    var dc = String(loopDir + '_' + loopSwp);
    j = dirCounts[dc] === undefined ? dirCounts[dc] = 0 : ++dirCounts[dc];
    rs.ctrlpts = [srcPos.x + Math.cos(outAngle) * 1.4 * loopDist * (j / 3 + 1), srcPos.y + Math.sin(outAngle) * 1.4 * loopDist * (j / 3 + 1), srcPos.x + Math.cos(inAngle) * 1.4 * loopDist * (j / 3 + 1), srcPos.y + Math.sin(inAngle) * 1.4 * loopDist * (j / 3 + 1)];
  };

  BRp$3.findCompoundLoopPoints = function (edge, pairInfo, i, edgeIsUnbundled) {
    // Compound edge
    var rs = edge._private.rscratch;
    rs.edgeType = 'compound';
    var srcPos = pairInfo.srcPos,
        tgtPos = pairInfo.tgtPos,
        srcW = pairInfo.srcW,
        srcH = pairInfo.srcH,
        tgtW = pairInfo.tgtW,
        tgtH = pairInfo.tgtH;
    var stepSize = edge.pstyle('control-point-step-size').pfValue;
    var ctrlptDists = edge.pstyle('control-point-distances');
    var ctrlptDist = ctrlptDists ? ctrlptDists.pfValue[0] : undefined;
    var j = i;
    var loopDist = stepSize;

    if (edgeIsUnbundled) {
      j = 0;
      loopDist = ctrlptDist;
    }

    var loopW = 50;
    var loopaPos = {
      x: srcPos.x - srcW / 2,
      y: srcPos.y - srcH / 2
    };
    var loopbPos = {
      x: tgtPos.x - tgtW / 2,
      y: tgtPos.y - tgtH / 2
    };
    var loopPos = {
      x: Math.min(loopaPos.x, loopbPos.x),
      y: Math.min(loopaPos.y, loopbPos.y)
    }; // avoids cases with impossible beziers

    var minCompoundStretch = 0.5;
    var compoundStretchA = Math.max(minCompoundStretch, Math.log(srcW * 0.01));
    var compoundStretchB = Math.max(minCompoundStretch, Math.log(tgtW * 0.01));
    rs.ctrlpts = [loopPos.x, loopPos.y - (1 + Math.pow(loopW, 1.12) / 100) * loopDist * (j / 3 + 1) * compoundStretchA, loopPos.x - (1 + Math.pow(loopW, 1.12) / 100) * loopDist * (j / 3 + 1) * compoundStretchB, loopPos.y];
  };

  BRp$3.findStraightEdgePoints = function (edge) {
    // Straight edge within bundle
    edge._private.rscratch.edgeType = 'straight';
  };

  BRp$3.findBezierPoints = function (edge, pairInfo, i, edgeIsUnbundled, edgeIsSwapped) {
    var rs = edge._private.rscratch;
    var vectorNormInverse = pairInfo.vectorNormInverse,
        posPts = pairInfo.posPts,
        intersectionPts = pairInfo.intersectionPts;
    var edgeDistances = edge.pstyle('edge-distances').value;
    var stepSize = edge.pstyle('control-point-step-size').pfValue;
    var ctrlptDists = edge.pstyle('control-point-distances');
    var ctrlptWs = edge.pstyle('control-point-weights');
    var bezierN = ctrlptDists && ctrlptWs ? Math.min(ctrlptDists.value.length, ctrlptWs.value.length) : 1;
    var ctrlptDist = ctrlptDists ? ctrlptDists.pfValue[0] : undefined;
    var ctrlptWeight = ctrlptWs.value[0]; // (Multi)bezier

    var multi = edgeIsUnbundled;
    rs.edgeType = multi ? 'multibezier' : 'bezier';
    rs.ctrlpts = [];

    for (var b = 0; b < bezierN; b++) {
      var normctrlptDist = (0.5 - pairInfo.eles.length / 2 + i) * stepSize * (edgeIsSwapped ? -1 : 1);
      var manctrlptDist = void 0;
      var sign = signum(normctrlptDist);

      if (multi) {
        ctrlptDist = ctrlptDists ? ctrlptDists.pfValue[b] : stepSize; // fall back on step size

        ctrlptWeight = ctrlptWs.value[b];
      }

      if (edgeIsUnbundled) {
        // multi or single unbundled
        manctrlptDist = ctrlptDist;
      } else {
        manctrlptDist = ctrlptDist !== undefined ? sign * ctrlptDist : undefined;
      }

      var distanceFromMidpoint = manctrlptDist !== undefined ? manctrlptDist : normctrlptDist;
      var w1 = 1 - ctrlptWeight;
      var w2 = ctrlptWeight;
      var midptPts = edgeDistances === 'node-position' ? posPts : intersectionPts;
      var adjustedMidpt = {
        x: midptPts.x1 * w1 + midptPts.x2 * w2,
        y: midptPts.y1 * w1 + midptPts.y2 * w2
      };
      rs.ctrlpts.push(adjustedMidpt.x + vectorNormInverse.x * distanceFromMidpoint, adjustedMidpt.y + vectorNormInverse.y * distanceFromMidpoint);
    }
  };

  BRp$3.findTaxiPoints = function (edge, pairInfo) {
    // Taxicab geometry with two turns maximum
    var rs = edge._private.rscratch;
    rs.edgeType = 'segments';
    var VERTICAL = 'vertical';
    var HORIZONTAL = 'horizontal';
    var LEFTWARD = 'leftward';
    var RIGHTWARD = 'rightward';
    var DOWNWARD = 'downward';
    var UPWARD = 'upward';
    var AUTO = 'auto';
    var posPts = pairInfo.posPts,
        srcW = pairInfo.srcW,
        srcH = pairInfo.srcH,
        tgtW = pairInfo.tgtW,
        tgtH = pairInfo.tgtH;
    var edgeDistances = edge.pstyle('edge-distances').value;
    var dIncludesNodeBody = edgeDistances !== 'node-position';
    var taxiDir = edge.pstyle('taxi-direction').value;
    var rawTaxiDir = taxiDir; // unprocessed value

    var taxiTurn = edge.pstyle('taxi-turn');
    var turnIsPercent = taxiTurn.units === '%';
    var taxiTurnPfVal = taxiTurn.pfValue;
    var turnIsNegative = taxiTurnPfVal < 0; // i.e. from target side

    var minD = edge.pstyle('taxi-turn-min-distance').pfValue;
    var dw = dIncludesNodeBody ? (srcW + tgtW) / 2 : 0;
    var dh = dIncludesNodeBody ? (srcH + tgtH) / 2 : 0;
    var pdx = posPts.x2 - posPts.x1;
    var pdy = posPts.y2 - posPts.y1; // take away the effective w/h from the magnitude of the delta value

    var subDWH = function subDWH(dxy, dwh) {
      if (dxy > 0) {
        return Math.max(dxy - dwh, 0);
      } else {
        return Math.min(dxy + dwh, 0);
      }
    };

    var dx = subDWH(pdx, dw);
    var dy = subDWH(pdy, dh);
    var isExplicitDir = false;

    if (rawTaxiDir === AUTO) {
      taxiDir = Math.abs(dx) > Math.abs(dy) ? HORIZONTAL : VERTICAL;
    } else if (rawTaxiDir === UPWARD || rawTaxiDir === DOWNWARD) {
      taxiDir = VERTICAL;
      isExplicitDir = true;
    } else if (rawTaxiDir === LEFTWARD || rawTaxiDir === RIGHTWARD) {
      taxiDir = HORIZONTAL;
      isExplicitDir = true;
    }

    var isVert = taxiDir === VERTICAL;
    var l = isVert ? dy : dx;
    var pl = isVert ? pdy : pdx;
    var sgnL = signum(pl);
    var forcedDir = false;

    if (!(isExplicitDir && (turnIsPercent || turnIsNegative)) // forcing in this case would cause weird growing in the opposite direction
    && (rawTaxiDir === DOWNWARD && pl < 0 || rawTaxiDir === UPWARD && pl > 0 || rawTaxiDir === LEFTWARD && pl > 0 || rawTaxiDir === RIGHTWARD && pl < 0)) {
      sgnL *= -1;
      l = sgnL * Math.abs(l);
      forcedDir = true;
    }

    var d;

    if (turnIsPercent) {
      var p = taxiTurnPfVal < 0 ? 1 + taxiTurnPfVal : taxiTurnPfVal;
      d = p * l;
    } else {
      var k = taxiTurnPfVal < 0 ? l : 0;
      d = k + taxiTurnPfVal * sgnL;
    }

    var getIsTooClose = function getIsTooClose(d) {
      return Math.abs(d) < minD || Math.abs(d) >= Math.abs(l);
    };

    var isTooCloseSrc = getIsTooClose(d);
    var isTooCloseTgt = getIsTooClose(Math.abs(l) - Math.abs(d));
    var isTooClose = isTooCloseSrc || isTooCloseTgt;

    if (isTooClose && !forcedDir) {
      // non-ideal routing
      if (isVert) {
        // vertical fallbacks
        var lShapeInsideSrc = Math.abs(pl) <= srcH / 2;
        var lShapeInsideTgt = Math.abs(pdx) <= tgtW / 2;

        if (lShapeInsideSrc) {
          // horizontal Z-shape (direction not respected)
          var x = (posPts.x1 + posPts.x2) / 2;
          var y1 = posPts.y1,
              y2 = posPts.y2;
          rs.segpts = [x, y1, x, y2];
        } else if (lShapeInsideTgt) {
          // vertical Z-shape (distance not respected)
          var y = (posPts.y1 + posPts.y2) / 2;
          var x1 = posPts.x1,
              x2 = posPts.x2;
          rs.segpts = [x1, y, x2, y];
        } else {
          // L-shape fallback (turn distance not respected, but works well with tree siblings)
          rs.segpts = [posPts.x1, posPts.y2];
        }
      } else {
        // horizontal fallbacks
        var _lShapeInsideSrc = Math.abs(pl) <= srcW / 2;

        var _lShapeInsideTgt = Math.abs(pdy) <= tgtH / 2;

        if (_lShapeInsideSrc) {
          // vertical Z-shape (direction not respected)
          var _y = (posPts.y1 + posPts.y2) / 2;

          var _x = posPts.x1,
              _x2 = posPts.x2;
          rs.segpts = [_x, _y, _x2, _y];
        } else if (_lShapeInsideTgt) {
          // horizontal Z-shape (turn distance not respected)
          var _x3 = (posPts.x1 + posPts.x2) / 2;

          var _y2 = posPts.y1,
              _y3 = posPts.y2;
          rs.segpts = [_x3, _y2, _x3, _y3];
        } else {
          // L-shape (turn distance not respected, but works well for tree siblings)
          rs.segpts = [posPts.x2, posPts.y1];
        }
      }
    } else {
      // ideal routing
      if (isVert) {
        var _y4 = posPts.y1 + d + (dIncludesNodeBody ? srcH / 2 * sgnL : 0);

        var _x4 = posPts.x1,
            _x5 = posPts.x2;
        rs.segpts = [_x4, _y4, _x5, _y4];
      } else {
        // horizontal
        var _x6 = posPts.x1 + d + (dIncludesNodeBody ? srcW / 2 * sgnL : 0);

        var _y5 = posPts.y1,
            _y6 = posPts.y2;
        rs.segpts = [_x6, _y5, _x6, _y6];
      }
    }
  };

  BRp$3.tryToCorrectInvalidPoints = function (edge, pairInfo) {
    var rs = edge._private.rscratch; // can only correct beziers for now...

    if (rs.edgeType === 'bezier') {
      var srcPos = pairInfo.srcPos,
          tgtPos = pairInfo.tgtPos,
          srcW = pairInfo.srcW,
          srcH = pairInfo.srcH,
          tgtW = pairInfo.tgtW,
          tgtH = pairInfo.tgtH,
          srcShape = pairInfo.srcShape,
          tgtShape = pairInfo.tgtShape;
      var badStart = !number(rs.startX) || !number(rs.startY);
      var badAStart = !number(rs.arrowStartX) || !number(rs.arrowStartY);
      var badEnd = !number(rs.endX) || !number(rs.endY);
      var badAEnd = !number(rs.arrowEndX) || !number(rs.arrowEndY);
      var minCpADistFactor = 3;
      var arrowW = this.getArrowWidth(edge.pstyle('width').pfValue, edge.pstyle('arrow-scale').value) * this.arrowShapeWidth;
      var minCpADist = minCpADistFactor * arrowW;
      var startACpDist = dist({
        x: rs.ctrlpts[0],
        y: rs.ctrlpts[1]
      }, {
        x: rs.startX,
        y: rs.startY
      });
      var closeStartACp = startACpDist < minCpADist;
      var endACpDist = dist({
        x: rs.ctrlpts[0],
        y: rs.ctrlpts[1]
      }, {
        x: rs.endX,
        y: rs.endY
      });
      var closeEndACp = endACpDist < minCpADist;
      var overlapping = false;

      if (badStart || badAStart || closeStartACp) {
        overlapping = true; // project control point along line from src centre to outside the src shape
        // (otherwise intersection will yield nothing)

        var cpD = {
          // delta
          x: rs.ctrlpts[0] - srcPos.x,
          y: rs.ctrlpts[1] - srcPos.y
        };
        var cpL = Math.sqrt(cpD.x * cpD.x + cpD.y * cpD.y); // length of line

        var cpM = {
          // normalised delta
          x: cpD.x / cpL,
          y: cpD.y / cpL
        };
        var radius = Math.max(srcW, srcH);
        var cpProj = {
          // *2 radius guarantees outside shape
          x: rs.ctrlpts[0] + cpM.x * 2 * radius,
          y: rs.ctrlpts[1] + cpM.y * 2 * radius
        };
        var srcCtrlPtIntn = srcShape.intersectLine(srcPos.x, srcPos.y, srcW, srcH, cpProj.x, cpProj.y, 0);

        if (closeStartACp) {
          rs.ctrlpts[0] = rs.ctrlpts[0] + cpM.x * (minCpADist - startACpDist);
          rs.ctrlpts[1] = rs.ctrlpts[1] + cpM.y * (minCpADist - startACpDist);
        } else {
          rs.ctrlpts[0] = srcCtrlPtIntn[0] + cpM.x * minCpADist;
          rs.ctrlpts[1] = srcCtrlPtIntn[1] + cpM.y * minCpADist;
        }
      }

      if (badEnd || badAEnd || closeEndACp) {
        overlapping = true; // project control point along line from tgt centre to outside the tgt shape
        // (otherwise intersection will yield nothing)

        var _cpD = {
          // delta
          x: rs.ctrlpts[0] - tgtPos.x,
          y: rs.ctrlpts[1] - tgtPos.y
        };

        var _cpL = Math.sqrt(_cpD.x * _cpD.x + _cpD.y * _cpD.y); // length of line


        var _cpM = {
          // normalised delta
          x: _cpD.x / _cpL,
          y: _cpD.y / _cpL
        };

        var _radius = Math.max(srcW, srcH);

        var _cpProj = {
          // *2 radius guarantees outside shape
          x: rs.ctrlpts[0] + _cpM.x * 2 * _radius,
          y: rs.ctrlpts[1] + _cpM.y * 2 * _radius
        };
        var tgtCtrlPtIntn = tgtShape.intersectLine(tgtPos.x, tgtPos.y, tgtW, tgtH, _cpProj.x, _cpProj.y, 0);

        if (closeEndACp) {
          rs.ctrlpts[0] = rs.ctrlpts[0] + _cpM.x * (minCpADist - endACpDist);
          rs.ctrlpts[1] = rs.ctrlpts[1] + _cpM.y * (minCpADist - endACpDist);
        } else {
          rs.ctrlpts[0] = tgtCtrlPtIntn[0] + _cpM.x * minCpADist;
          rs.ctrlpts[1] = tgtCtrlPtIntn[1] + _cpM.y * minCpADist;
        }
      }

      if (overlapping) {
        // recalc endpts
        this.findEndpoints(edge);
      }
    }
  };

  BRp$3.storeAllpts = function (edge) {
    var rs = edge._private.rscratch;

    if (rs.edgeType === 'multibezier' || rs.edgeType === 'bezier' || rs.edgeType === 'self' || rs.edgeType === 'compound') {
      rs.allpts = [];
      rs.allpts.push(rs.startX, rs.startY);

      for (var b = 0; b + 1 < rs.ctrlpts.length; b += 2) {
        // ctrl pt itself
        rs.allpts.push(rs.ctrlpts[b], rs.ctrlpts[b + 1]); // the midpt between ctrlpts as intermediate destination pts

        if (b + 3 < rs.ctrlpts.length) {
          rs.allpts.push((rs.ctrlpts[b] + rs.ctrlpts[b + 2]) / 2, (rs.ctrlpts[b + 1] + rs.ctrlpts[b + 3]) / 2);
        }
      }

      rs.allpts.push(rs.endX, rs.endY);
      var m, mt;

      if (rs.ctrlpts.length / 2 % 2 === 0) {
        m = rs.allpts.length / 2 - 1;
        rs.midX = rs.allpts[m];
        rs.midY = rs.allpts[m + 1];
      } else {
        m = rs.allpts.length / 2 - 3;
        mt = 0.5;
        rs.midX = qbezierAt(rs.allpts[m], rs.allpts[m + 2], rs.allpts[m + 4], mt);
        rs.midY = qbezierAt(rs.allpts[m + 1], rs.allpts[m + 3], rs.allpts[m + 5], mt);
      }
    } else if (rs.edgeType === 'straight') {
      // need to calc these after endpts
      rs.allpts = [rs.startX, rs.startY, rs.endX, rs.endY]; // default midpt for labels etc

      rs.midX = (rs.startX + rs.endX + rs.arrowStartX + rs.arrowEndX) / 4;
      rs.midY = (rs.startY + rs.endY + rs.arrowStartY + rs.arrowEndY) / 4;
    } else if (rs.edgeType === 'segments') {
      rs.allpts = [];
      rs.allpts.push(rs.startX, rs.startY);
      rs.allpts.push.apply(rs.allpts, rs.segpts);
      rs.allpts.push(rs.endX, rs.endY);

      if (rs.segpts.length % 4 === 0) {
        var i2 = rs.segpts.length / 2;
        var i1 = i2 - 2;
        rs.midX = (rs.segpts[i1] + rs.segpts[i2]) / 2;
        rs.midY = (rs.segpts[i1 + 1] + rs.segpts[i2 + 1]) / 2;
      } else {
        var _i = rs.segpts.length / 2 - 1;

        rs.midX = rs.segpts[_i];
        rs.midY = rs.segpts[_i + 1];
      }
    }
  };

  BRp$3.checkForInvalidEdgeWarning = function (edge) {
    var rs = edge[0]._private.rscratch;

    if (rs.nodesOverlap || number(rs.startX) && number(rs.startY) && number(rs.endX) && number(rs.endY)) {
      rs.loggedErr = false;
    } else {
      if (!rs.loggedErr) {
        rs.loggedErr = true;
        warn('Edge `' + edge.id() + '` has invalid endpoints and so it is impossible to draw.  Adjust your edge style (e.g. control points) accordingly or use an alternative edge type.  This is expected behaviour when the source node and the target node overlap.');
      }
    }
  };

  BRp$3.findEdgeControlPoints = function (edges) {
    var _this = this;

    if (!edges || edges.length === 0) {
      return;
    }

    var r = this;
    var cy = r.cy;
    var hasCompounds = cy.hasCompoundNodes();
    var hashTable = {
      map: new Map$1(),
      get: function get(pairId) {
        var map2 = this.map.get(pairId[0]);

        if (map2 != null) {
          return map2.get(pairId[1]);
        } else {
          return null;
        }
      },
      set: function set(pairId, val) {
        var map2 = this.map.get(pairId[0]);

        if (map2 == null) {
          map2 = new Map$1();
          this.map.set(pairId[0], map2);
        }

        map2.set(pairId[1], val);
      }
    };
    var pairIds = [];
    var haystackEdges = []; // create a table of edge (src, tgt) => list of edges between them

    for (var i = 0; i < edges.length; i++) {
      var edge = edges[i];
      var _p = edge._private;
      var curveStyle = edge.pstyle('curve-style').value; // ignore edges who are not to be displayed
      // they shouldn't take up space

      if (edge.removed() || !edge.takesUpSpace()) {
        continue;
      }

      if (curveStyle === 'haystack') {
        haystackEdges.push(edge);
        continue;
      }

      var edgeIsUnbundled = curveStyle === 'unbundled-bezier' || curveStyle === 'segments' || curveStyle === 'straight' || curveStyle === 'taxi';
      var edgeIsBezier = curveStyle === 'unbundled-bezier' || curveStyle === 'bezier';
      var src = _p.source;
      var tgt = _p.target;
      var srcIndex = src.poolIndex();
      var tgtIndex = tgt.poolIndex();
      var pairId = [srcIndex, tgtIndex].sort();
      var tableEntry = hashTable.get(pairId);

      if (tableEntry == null) {
        tableEntry = {
          eles: []
        };
        hashTable.set(pairId, tableEntry);
        pairIds.push(pairId);
      }

      tableEntry.eles.push(edge);

      if (edgeIsUnbundled) {
        tableEntry.hasUnbundled = true;
      }

      if (edgeIsBezier) {
        tableEntry.hasBezier = true;
      }
    } // for each pair (src, tgt), create the ctrl pts
    // Nested for loop is OK; total number of iterations for both loops = edgeCount


    var _loop = function _loop(p) {
      var pairId = pairIds[p];
      var pairInfo = hashTable.get(pairId);
      var swappedpairInfo = void 0;

      if (!pairInfo.hasUnbundled) {
        var pllEdges = pairInfo.eles[0].parallelEdges().filter(function (e) {
          return e.isBundledBezier();
        });
        clearArray(pairInfo.eles);
        pllEdges.forEach(function (edge) {
          return pairInfo.eles.push(edge);
        }); // for each pair id, the edges should be sorted by index

        pairInfo.eles.sort(function (edge1, edge2) {
          return edge1.poolIndex() - edge2.poolIndex();
        });
      }

      var firstEdge = pairInfo.eles[0];
      var src = firstEdge.source();
      var tgt = firstEdge.target(); // make sure src/tgt distinction is consistent w.r.t. pairId

      if (src.poolIndex() > tgt.poolIndex()) {
        var temp = src;
        src = tgt;
        tgt = temp;
      }

      var srcPos = pairInfo.srcPos = src.position();
      var tgtPos = pairInfo.tgtPos = tgt.position();
      var srcW = pairInfo.srcW = src.outerWidth();
      var srcH = pairInfo.srcH = src.outerHeight();
      var tgtW = pairInfo.tgtW = tgt.outerWidth();
      var tgtH = pairInfo.tgtH = tgt.outerHeight();

      var srcShape = pairInfo.srcShape = r.nodeShapes[_this.getNodeShape(src)];

      var tgtShape = pairInfo.tgtShape = r.nodeShapes[_this.getNodeShape(tgt)];

      pairInfo.dirCounts = {
        'north': 0,
        'west': 0,
        'south': 0,
        'east': 0,
        'northwest': 0,
        'southwest': 0,
        'northeast': 0,
        'southeast': 0
      };

      for (var _i2 = 0; _i2 < pairInfo.eles.length; _i2++) {
        var _edge = pairInfo.eles[_i2];
        var rs = _edge[0]._private.rscratch;

        var _curveStyle = _edge.pstyle('curve-style').value;

        var _edgeIsUnbundled = _curveStyle === 'unbundled-bezier' || _curveStyle === 'segments' || _curveStyle === 'taxi'; // whether the normalised pair order is the reverse of the edge's src-tgt order


        var edgeIsSwapped = !src.same(_edge.source());

        if (!pairInfo.calculatedIntersection && src !== tgt && (pairInfo.hasBezier || pairInfo.hasUnbundled)) {
          pairInfo.calculatedIntersection = true; // pt outside src shape to calc distance/displacement from src to tgt

          var srcOutside = srcShape.intersectLine(srcPos.x, srcPos.y, srcW, srcH, tgtPos.x, tgtPos.y, 0);
          var srcIntn = pairInfo.srcIntn = srcOutside; // pt outside tgt shape to calc distance/displacement from src to tgt

          var tgtOutside = tgtShape.intersectLine(tgtPos.x, tgtPos.y, tgtW, tgtH, srcPos.x, srcPos.y, 0);
          var tgtIntn = pairInfo.tgtIntn = tgtOutside;
          var intersectionPts = pairInfo.intersectionPts = {
            x1: srcOutside[0],
            x2: tgtOutside[0],
            y1: srcOutside[1],
            y2: tgtOutside[1]
          };
          var posPts = pairInfo.posPts = {
            x1: srcPos.x,
            x2: tgtPos.x,
            y1: srcPos.y,
            y2: tgtPos.y
          };
          var dy = tgtOutside[1] - srcOutside[1];
          var dx = tgtOutside[0] - srcOutside[0];
          var l = Math.sqrt(dx * dx + dy * dy);
          var vector = pairInfo.vector = {
            x: dx,
            y: dy
          };
          var vectorNorm = pairInfo.vectorNorm = {
            x: vector.x / l,
            y: vector.y / l
          };
          var vectorNormInverse = {
            x: -vectorNorm.y,
            y: vectorNorm.x
          }; // if node shapes overlap, then no ctrl pts to draw

          pairInfo.nodesOverlap = !number(l) || tgtShape.checkPoint(srcOutside[0], srcOutside[1], 0, tgtW, tgtH, tgtPos.x, tgtPos.y) || srcShape.checkPoint(tgtOutside[0], tgtOutside[1], 0, srcW, srcH, srcPos.x, srcPos.y);
          pairInfo.vectorNormInverse = vectorNormInverse;
          swappedpairInfo = {
            nodesOverlap: pairInfo.nodesOverlap,
            dirCounts: pairInfo.dirCounts,
            calculatedIntersection: true,
            hasBezier: pairInfo.hasBezier,
            hasUnbundled: pairInfo.hasUnbundled,
            eles: pairInfo.eles,
            srcPos: tgtPos,
            tgtPos: srcPos,
            srcW: tgtW,
            srcH: tgtH,
            tgtW: srcW,
            tgtH: srcH,
            srcIntn: tgtIntn,
            tgtIntn: srcIntn,
            srcShape: tgtShape,
            tgtShape: srcShape,
            posPts: {
              x1: posPts.x2,
              y1: posPts.y2,
              x2: posPts.x1,
              y2: posPts.y1
            },
            intersectionPts: {
              x1: intersectionPts.x2,
              y1: intersectionPts.y2,
              x2: intersectionPts.x1,
              y2: intersectionPts.y1
            },
            vector: {
              x: -vector.x,
              y: -vector.y
            },
            vectorNorm: {
              x: -vectorNorm.x,
              y: -vectorNorm.y
            },
            vectorNormInverse: {
              x: -vectorNormInverse.x,
              y: -vectorNormInverse.y
            }
          };
        }

        var passedPairInfo = edgeIsSwapped ? swappedpairInfo : pairInfo;
        rs.nodesOverlap = passedPairInfo.nodesOverlap;
        rs.srcIntn = passedPairInfo.srcIntn;
        rs.tgtIntn = passedPairInfo.tgtIntn;

        if (hasCompounds && (src.isParent() || src.isChild() || tgt.isParent() || tgt.isChild()) && (src.parents().anySame(tgt) || tgt.parents().anySame(src) || src.same(tgt) && src.isParent())) {
          _this.findCompoundLoopPoints(_edge, passedPairInfo, _i2, _edgeIsUnbundled);
        } else if (src === tgt) {
          _this.findLoopPoints(_edge, passedPairInfo, _i2, _edgeIsUnbundled);
        } else if (_curveStyle === 'segments') {
          _this.findSegmentsPoints(_edge, passedPairInfo);
        } else if (_curveStyle === 'taxi') {
          _this.findTaxiPoints(_edge, passedPairInfo);
        } else if (_curveStyle === 'straight' || !_edgeIsUnbundled && pairInfo.eles.length % 2 === 1 && _i2 === Math.floor(pairInfo.eles.length / 2)) {
          _this.findStraightEdgePoints(_edge);
        } else {
          _this.findBezierPoints(_edge, passedPairInfo, _i2, _edgeIsUnbundled, edgeIsSwapped);
        }

        _this.findEndpoints(_edge);

        _this.tryToCorrectInvalidPoints(_edge, passedPairInfo);

        _this.checkForInvalidEdgeWarning(_edge);

        _this.storeAllpts(_edge);

        _this.storeEdgeProjections(_edge);

        _this.calculateArrowAngles(_edge);

        _this.recalculateEdgeLabelProjections(_edge);

        _this.calculateLabelAngles(_edge);
      } // for pair edges

    };

    for (var p = 0; p < pairIds.length; p++) {
      _loop(p);
    } // for pair ids
    // haystacks avoid the expense of pairInfo stuff (intersections etc.)


    this.findHaystackPoints(haystackEdges);
  };

  function getPts(pts) {
    var retPts = [];

    if (pts == null) {
      return;
    }

    for (var i = 0; i < pts.length; i += 2) {
      var x = pts[i];
      var y = pts[i + 1];
      retPts.push({
        x: x,
        y: y
      });
    }

    return retPts;
  }

  BRp$3.getSegmentPoints = function (edge) {
    var rs = edge[0]._private.rscratch;
    var type = rs.edgeType;

    if (type === 'segments') {
      this.recalculateRenderedStyle(edge);
      return getPts(rs.segpts);
    }
  };

  BRp$3.getControlPoints = function (edge) {
    var rs = edge[0]._private.rscratch;
    var type = rs.edgeType;

    if (type === 'bezier' || type === 'multibezier' || type === 'self' || type === 'compound') {
      this.recalculateRenderedStyle(edge);
      return getPts(rs.ctrlpts);
    }
  };

  BRp$3.getEdgeMidpoint = function (edge) {
    var rs = edge[0]._private.rscratch;
    this.recalculateRenderedStyle(edge);
    return {
      x: rs.midX,
      y: rs.midY
    };
  };

  var BRp$4 = {};

  BRp$4.manualEndptToPx = function (node, prop) {
    var r = this;
    var npos = node.position();
    var w = node.outerWidth();
    var h = node.outerHeight();

    if (prop.value.length === 2) {
      var p = [prop.pfValue[0], prop.pfValue[1]];

      if (prop.units[0] === '%') {
        p[0] = p[0] * w;
      }

      if (prop.units[1] === '%') {
        p[1] = p[1] * h;
      }

      p[0] += npos.x;
      p[1] += npos.y;
      return p;
    } else {
      var angle = prop.pfValue[0];
      angle = -Math.PI / 2 + angle; // start at 12 o'clock

      var l = 2 * Math.max(w, h);
      var _p = [npos.x + Math.cos(angle) * l, npos.y + Math.sin(angle) * l];
      return r.nodeShapes[this.getNodeShape(node)].intersectLine(npos.x, npos.y, w, h, _p[0], _p[1], 0);
    }
  };

  BRp$4.findEndpoints = function (edge) {
    var r = this;
    var intersect;
    var source = edge.source()[0];
    var target = edge.target()[0];
    var srcPos = source.position();
    var tgtPos = target.position();
    var tgtArShape = edge.pstyle('target-arrow-shape').value;
    var srcArShape = edge.pstyle('source-arrow-shape').value;
    var tgtDist = edge.pstyle('target-distance-from-node').pfValue;
    var srcDist = edge.pstyle('source-distance-from-node').pfValue;
    var curveStyle = edge.pstyle('curve-style').value;
    var rs = edge._private.rscratch;
    var et = rs.edgeType;
    var taxi = curveStyle === 'taxi';
    var self = et === 'self' || et === 'compound';
    var bezier = et === 'bezier' || et === 'multibezier' || self;
    var multi = et !== 'bezier';
    var lines = et === 'straight' || et === 'segments';
    var segments = et === 'segments';
    var hasEndpts = bezier || multi || lines;
    var overrideEndpts = self || taxi;
    var srcManEndpt = edge.pstyle('source-endpoint');
    var srcManEndptVal = overrideEndpts ? 'outside-to-node' : srcManEndpt.value;
    var tgtManEndpt = edge.pstyle('target-endpoint');
    var tgtManEndptVal = overrideEndpts ? 'outside-to-node' : tgtManEndpt.value;
    rs.srcManEndpt = srcManEndpt;
    rs.tgtManEndpt = tgtManEndpt;
    var p1; // last known point of edge on target side

    var p2; // last known point of edge on source side

    var p1_i; // point to intersect with target shape

    var p2_i; // point to intersect with source shape

    if (bezier) {
      var cpStart = [rs.ctrlpts[0], rs.ctrlpts[1]];
      var cpEnd = multi ? [rs.ctrlpts[rs.ctrlpts.length - 2], rs.ctrlpts[rs.ctrlpts.length - 1]] : cpStart;
      p1 = cpEnd;
      p2 = cpStart;
    } else if (lines) {
      var srcArrowFromPt = !segments ? [tgtPos.x, tgtPos.y] : rs.segpts.slice(0, 2);
      var tgtArrowFromPt = !segments ? [srcPos.x, srcPos.y] : rs.segpts.slice(rs.segpts.length - 2);
      p1 = tgtArrowFromPt;
      p2 = srcArrowFromPt;
    }

    if (tgtManEndptVal === 'inside-to-node') {
      intersect = [tgtPos.x, tgtPos.y];
    } else if (tgtManEndpt.units) {
      intersect = this.manualEndptToPx(target, tgtManEndpt);
    } else if (tgtManEndptVal === 'outside-to-line') {
      intersect = rs.tgtIntn; // use cached value from ctrlpt calc
    } else {
      if (tgtManEndptVal === 'outside-to-node' || tgtManEndptVal === 'outside-to-node-or-label') {
        p1_i = p1;
      } else if (tgtManEndptVal === 'outside-to-line' || tgtManEndptVal === 'outside-to-line-or-label') {
        p1_i = [srcPos.x, srcPos.y];
      }

      intersect = r.nodeShapes[this.getNodeShape(target)].intersectLine(tgtPos.x, tgtPos.y, target.outerWidth(), target.outerHeight(), p1_i[0], p1_i[1], 0);

      if (tgtManEndptVal === 'outside-to-node-or-label' || tgtManEndptVal === 'outside-to-line-or-label') {
        var trs = target._private.rscratch;
        var lw = trs.labelWidth;
        var lh = trs.labelHeight;
        var lx = trs.labelX;
        var ly = trs.labelY;
        var lw2 = lw / 2;
        var lh2 = lh / 2;
        var va = target.pstyle('text-valign').value;

        if (va === 'top') {
          ly -= lh2;
        } else if (va === 'bottom') {
          ly += lh2;
        }

        var ha = target.pstyle('text-halign').value;

        if (ha === 'left') {
          lx -= lw2;
        } else if (ha === 'right') {
          lx += lw2;
        }

        var labelIntersect = polygonIntersectLine(p1_i[0], p1_i[1], [lx - lw2, ly - lh2, lx + lw2, ly - lh2, lx + lw2, ly + lh2, lx - lw2, ly + lh2], tgtPos.x, tgtPos.y);

        if (labelIntersect.length > 0) {
          var refPt = srcPos;
          var intSqdist = sqdist(refPt, array2point(intersect));
          var labIntSqdist = sqdist(refPt, array2point(labelIntersect));
          var minSqDist = intSqdist;

          if (labIntSqdist < intSqdist) {
            intersect = labelIntersect;
            minSqDist = labIntSqdist;
          }

          if (labelIntersect.length > 2) {
            var labInt2SqDist = sqdist(refPt, {
              x: labelIntersect[2],
              y: labelIntersect[3]
            });

            if (labInt2SqDist < minSqDist) {
              intersect = [labelIntersect[2], labelIntersect[3]];
            }
          }
        }
      }
    }

    var arrowEnd = shortenIntersection(intersect, p1, r.arrowShapes[tgtArShape].spacing(edge) + tgtDist);
    var edgeEnd = shortenIntersection(intersect, p1, r.arrowShapes[tgtArShape].gap(edge) + tgtDist);
    rs.endX = edgeEnd[0];
    rs.endY = edgeEnd[1];
    rs.arrowEndX = arrowEnd[0];
    rs.arrowEndY = arrowEnd[1];

    if (srcManEndptVal === 'inside-to-node') {
      intersect = [srcPos.x, srcPos.y];
    } else if (srcManEndpt.units) {
      intersect = this.manualEndptToPx(source, srcManEndpt);
    } else if (srcManEndptVal === 'outside-to-line') {
      intersect = rs.srcIntn; // use cached value from ctrlpt calc
    } else {
      if (srcManEndptVal === 'outside-to-node' || srcManEndptVal === 'outside-to-node-or-label') {
        p2_i = p2;
      } else if (srcManEndptVal === 'outside-to-line' || srcManEndptVal === 'outside-to-line-or-label') {
        p2_i = [tgtPos.x, tgtPos.y];
      }

      intersect = r.nodeShapes[this.getNodeShape(source)].intersectLine(srcPos.x, srcPos.y, source.outerWidth(), source.outerHeight(), p2_i[0], p2_i[1], 0);

      if (srcManEndptVal === 'outside-to-node-or-label' || srcManEndptVal === 'outside-to-line-or-label') {
        var srs = source._private.rscratch;
        var _lw = srs.labelWidth;
        var _lh = srs.labelHeight;
        var _lx = srs.labelX;
        var _ly = srs.labelY;

        var _lw2 = _lw / 2;

        var _lh2 = _lh / 2;

        var _va = source.pstyle('text-valign').value;

        if (_va === 'top') {
          _ly -= _lh2;
        } else if (_va === 'bottom') {
          _ly += _lh2;
        }

        var _ha = source.pstyle('text-halign').value;

        if (_ha === 'left') {
          _lx -= _lw2;
        } else if (_ha === 'right') {
          _lx += _lw2;
        }

        var _labelIntersect = polygonIntersectLine(p2_i[0], p2_i[1], [_lx - _lw2, _ly - _lh2, _lx + _lw2, _ly - _lh2, _lx + _lw2, _ly + _lh2, _lx - _lw2, _ly + _lh2], srcPos.x, srcPos.y);

        if (_labelIntersect.length > 0) {
          var _refPt = tgtPos;

          var _intSqdist = sqdist(_refPt, array2point(intersect));

          var _labIntSqdist = sqdist(_refPt, array2point(_labelIntersect));

          var _minSqDist = _intSqdist;

          if (_labIntSqdist < _intSqdist) {
            intersect = [_labelIntersect[0], _labelIntersect[1]];
            _minSqDist = _labIntSqdist;
          }

          if (_labelIntersect.length > 2) {
            var _labInt2SqDist = sqdist(_refPt, {
              x: _labelIntersect[2],
              y: _labelIntersect[3]
            });

            if (_labInt2SqDist < _minSqDist) {
              intersect = [_labelIntersect[2], _labelIntersect[3]];
            }
          }
        }
      }
    }

    var arrowStart = shortenIntersection(intersect, p2, r.arrowShapes[srcArShape].spacing(edge) + srcDist);
    var edgeStart = shortenIntersection(intersect, p2, r.arrowShapes[srcArShape].gap(edge) + srcDist);
    rs.startX = edgeStart[0];
    rs.startY = edgeStart[1];
    rs.arrowStartX = arrowStart[0];
    rs.arrowStartY = arrowStart[1];

    if (hasEndpts) {
      if (!number(rs.startX) || !number(rs.startY) || !number(rs.endX) || !number(rs.endY)) {
        rs.badLine = true;
      } else {
        rs.badLine = false;
      }
    }
  };

  BRp$4.getSourceEndpoint = function (edge) {
    var rs = edge[0]._private.rscratch;
    this.recalculateRenderedStyle(edge);

    switch (rs.edgeType) {
      case 'haystack':
        return {
          x: rs.haystackPts[0],
          y: rs.haystackPts[1]
        };

      default:
        return {
          x: rs.arrowStartX,
          y: rs.arrowStartY
        };
    }
  };

  BRp$4.getTargetEndpoint = function (edge) {
    var rs = edge[0]._private.rscratch;
    this.recalculateRenderedStyle(edge);

    switch (rs.edgeType) {
      case 'haystack':
        return {
          x: rs.haystackPts[2],
          y: rs.haystackPts[3]
        };

      default:
        return {
          x: rs.arrowEndX,
          y: rs.arrowEndY
        };
    }
  };

  var BRp$5 = {};

  function pushBezierPts(r, edge, pts) {
    var qbezierAt$1 = function qbezierAt$1(p1, p2, p3, t) {
      return qbezierAt(p1, p2, p3, t);
    };

    var _p = edge._private;
    var bpts = _p.rstyle.bezierPts;

    for (var i = 0; i < r.bezierProjPcts.length; i++) {
      var p = r.bezierProjPcts[i];
      bpts.push({
        x: qbezierAt$1(pts[0], pts[2], pts[4], p),
        y: qbezierAt$1(pts[1], pts[3], pts[5], p)
      });
    }
  }

  BRp$5.storeEdgeProjections = function (edge) {
    var _p = edge._private;
    var rs = _p.rscratch;
    var et = rs.edgeType; // clear the cached points state

    _p.rstyle.bezierPts = null;
    _p.rstyle.linePts = null;
    _p.rstyle.haystackPts = null;

    if (et === 'multibezier' || et === 'bezier' || et === 'self' || et === 'compound') {
      _p.rstyle.bezierPts = [];

      for (var i = 0; i + 5 < rs.allpts.length; i += 4) {
        pushBezierPts(this, edge, rs.allpts.slice(i, i + 6));
      }
    } else if (et === 'segments') {
      var lpts = _p.rstyle.linePts = [];

      for (var i = 0; i + 1 < rs.allpts.length; i += 2) {
        lpts.push({
          x: rs.allpts[i],
          y: rs.allpts[i + 1]
        });
      }
    } else if (et === 'haystack') {
      var hpts = rs.haystackPts;
      _p.rstyle.haystackPts = [{
        x: hpts[0],
        y: hpts[1]
      }, {
        x: hpts[2],
        y: hpts[3]
      }];
    }

    _p.rstyle.arrowWidth = this.getArrowWidth(edge.pstyle('width').pfValue, edge.pstyle('arrow-scale').value) * this.arrowShapeWidth;
  };

  BRp$5.recalculateEdgeProjections = function (edges) {
    this.findEdgeControlPoints(edges);
  };

  /* global document */

  var BRp$6 = {};

  BRp$6.recalculateNodeLabelProjection = function (node) {
    var content = node.pstyle('label').strValue;

    if (emptyString(content)) {
      return;
    }

    var textX, textY;
    var _p = node._private;
    var nodeWidth = node.width();
    var nodeHeight = node.height();
    var padding = node.padding();
    var nodePos = node.position();
    var textHalign = node.pstyle('text-halign').strValue;
    var textValign = node.pstyle('text-valign').strValue;
    var rs = _p.rscratch;
    var rstyle = _p.rstyle;

    switch (textHalign) {
      case 'left':
        textX = nodePos.x - nodeWidth / 2 - padding;
        break;

      case 'right':
        textX = nodePos.x + nodeWidth / 2 + padding;
        break;

      default:
        // e.g. center
        textX = nodePos.x;
    }

    switch (textValign) {
      case 'top':
        textY = nodePos.y - nodeHeight / 2 - padding;
        break;

      case 'bottom':
        textY = nodePos.y + nodeHeight / 2 + padding;
        break;

      default:
        // e.g. middle
        textY = nodePos.y;
    }

    rs.labelX = textX;
    rs.labelY = textY;
    rstyle.labelX = textX;
    rstyle.labelY = textY;
    this.applyLabelDimensions(node);
  };

  var lineAngleFromDelta = function lineAngleFromDelta(dx, dy) {
    var angle = Math.atan(dy / dx);

    if (dx === 0 && angle < 0) {
      angle = angle * -1;
    }

    return angle;
  };

  var lineAngle = function lineAngle(p0, p1) {
    var dx = p1.x - p0.x;
    var dy = p1.y - p0.y;
    return lineAngleFromDelta(dx, dy);
  };

  var bezierAngle = function bezierAngle(p0, p1, p2, t) {
    var t0 = bound(0, t - 0.001, 1);
    var t1 = bound(0, t + 0.001, 1);
    var lp0 = qbezierPtAt(p0, p1, p2, t0);
    var lp1 = qbezierPtAt(p0, p1, p2, t1);
    return lineAngle(lp0, lp1);
  };

  BRp$6.recalculateEdgeLabelProjections = function (edge) {
    var p;
    var _p = edge._private;
    var rs = _p.rscratch;
    var r = this;
    var content = {
      mid: edge.pstyle('label').strValue,
      source: edge.pstyle('source-label').strValue,
      target: edge.pstyle('target-label').strValue
    };

    if (content.mid || content.source || content.target) ; else {
        return; // no labels => no calcs
      } // add center point to style so bounding box calculations can use it
    //


    p = {
      x: rs.midX,
      y: rs.midY
    };

    var setRs = function setRs(propName, prefix, value) {
      setPrefixedProperty(_p.rscratch, propName, prefix, value);
      setPrefixedProperty(_p.rstyle, propName, prefix, value);
    };

    setRs('labelX', null, p.x);
    setRs('labelY', null, p.y);
    var midAngle = lineAngleFromDelta(rs.midDispX, rs.midDispY);
    setRs('labelAutoAngle', null, midAngle);

    var createControlPointInfo = function createControlPointInfo() {
      if (createControlPointInfo.cache) {
        return createControlPointInfo.cache;
      } // use cache so only 1x per edge


      var ctrlpts = []; // store each ctrlpt info init

      for (var i = 0; i + 5 < rs.allpts.length; i += 4) {
        var p0 = {
          x: rs.allpts[i],
          y: rs.allpts[i + 1]
        };
        var p1 = {
          x: rs.allpts[i + 2],
          y: rs.allpts[i + 3]
        }; // ctrlpt

        var p2 = {
          x: rs.allpts[i + 4],
          y: rs.allpts[i + 5]
        };
        ctrlpts.push({
          p0: p0,
          p1: p1,
          p2: p2,
          startDist: 0,
          length: 0,
          segments: []
        });
      }

      var bpts = _p.rstyle.bezierPts;
      var nProjs = r.bezierProjPcts.length;

      function addSegment(cp, p0, p1, t0, t1) {
        var length = dist(p0, p1);
        var prevSegment = cp.segments[cp.segments.length - 1];
        var segment = {
          p0: p0,
          p1: p1,
          t0: t0,
          t1: t1,
          startDist: prevSegment ? prevSegment.startDist + prevSegment.length : 0,
          length: length
        };
        cp.segments.push(segment);
        cp.length += length;
      } // update each ctrlpt with segment info


      for (var _i = 0; _i < ctrlpts.length; _i++) {
        var cp = ctrlpts[_i];
        var prevCp = ctrlpts[_i - 1];

        if (prevCp) {
          cp.startDist = prevCp.startDist + prevCp.length;
        }

        addSegment(cp, cp.p0, bpts[_i * nProjs], 0, r.bezierProjPcts[0]); // first

        for (var j = 0; j < nProjs - 1; j++) {
          addSegment(cp, bpts[_i * nProjs + j], bpts[_i * nProjs + j + 1], r.bezierProjPcts[j], r.bezierProjPcts[j + 1]);
        }

        addSegment(cp, bpts[_i * nProjs + nProjs - 1], cp.p2, r.bezierProjPcts[nProjs - 1], 1); // last
      }

      return createControlPointInfo.cache = ctrlpts;
    };

    var calculateEndProjection = function calculateEndProjection(prefix) {
      var angle;
      var isSrc = prefix === 'source';

      if (!content[prefix]) {
        return;
      }

      var offset = edge.pstyle(prefix + '-text-offset').pfValue;

      switch (rs.edgeType) {
        case 'self':
        case 'compound':
        case 'bezier':
        case 'multibezier':
          {
            var cps = createControlPointInfo();
            var selected;
            var startDist = 0;
            var totalDist = 0; // find the segment we're on

            for (var i = 0; i < cps.length; i++) {
              var _cp = cps[isSrc ? i : cps.length - 1 - i];

              for (var j = 0; j < _cp.segments.length; j++) {
                var _seg = _cp.segments[isSrc ? j : _cp.segments.length - 1 - j];
                var lastSeg = i === cps.length - 1 && j === _cp.segments.length - 1;
                startDist = totalDist;
                totalDist += _seg.length;

                if (totalDist >= offset || lastSeg) {
                  selected = {
                    cp: _cp,
                    segment: _seg
                  };
                  break;
                }
              }

              if (selected) {
                break;
              }
            }

            var cp = selected.cp;
            var seg = selected.segment;
            var tSegment = (offset - startDist) / seg.length;
            var segDt = seg.t1 - seg.t0;
            var t = isSrc ? seg.t0 + segDt * tSegment : seg.t1 - segDt * tSegment;
            t = bound(0, t, 1);
            p = qbezierPtAt(cp.p0, cp.p1, cp.p2, t);
            angle = bezierAngle(cp.p0, cp.p1, cp.p2, t);
            break;
          }

        case 'straight':
        case 'segments':
        case 'haystack':
          {
            var d = 0,
                di,
                d0;
            var p0, p1;
            var l = rs.allpts.length;

            for (var _i2 = 0; _i2 + 3 < l; _i2 += 2) {
              if (isSrc) {
                p0 = {
                  x: rs.allpts[_i2],
                  y: rs.allpts[_i2 + 1]
                };
                p1 = {
                  x: rs.allpts[_i2 + 2],
                  y: rs.allpts[_i2 + 3]
                };
              } else {
                p0 = {
                  x: rs.allpts[l - 2 - _i2],
                  y: rs.allpts[l - 1 - _i2]
                };
                p1 = {
                  x: rs.allpts[l - 4 - _i2],
                  y: rs.allpts[l - 3 - _i2]
                };
              }

              di = dist(p0, p1);
              d0 = d;
              d += di;

              if (d >= offset) {
                break;
              }
            }

            var pD = offset - d0;

            var _t = pD / di;

            _t = bound(0, _t, 1);
            p = lineAt(p0, p1, _t);
            angle = lineAngle(p0, p1);
            break;
          }
      }

      setRs('labelX', prefix, p.x);
      setRs('labelY', prefix, p.y);
      setRs('labelAutoAngle', prefix, angle);
    };

    calculateEndProjection('source');
    calculateEndProjection('target');
    this.applyLabelDimensions(edge);
  };

  BRp$6.applyLabelDimensions = function (ele) {
    this.applyPrefixedLabelDimensions(ele);

    if (ele.isEdge()) {
      this.applyPrefixedLabelDimensions(ele, 'source');
      this.applyPrefixedLabelDimensions(ele, 'target');
    }
  };

  BRp$6.applyPrefixedLabelDimensions = function (ele, prefix) {
    var _p = ele._private;
    var text = this.getLabelText(ele, prefix);
    var labelDims = this.calculateLabelDimensions(ele, text);
    var lineHeight = ele.pstyle('line-height').pfValue;
    var textWrap = ele.pstyle('text-wrap').strValue;
    var lines = getPrefixedProperty(_p.rscratch, 'labelWrapCachedLines', prefix) || [];
    var numLines = textWrap !== 'wrap' ? 1 : Math.max(lines.length, 1);
    var normPerLineHeight = labelDims.height / numLines;
    var labelLineHeight = normPerLineHeight * lineHeight;
    var width = labelDims.width;
    var height = labelDims.height + (numLines - 1) * (lineHeight - 1) * normPerLineHeight;
    setPrefixedProperty(_p.rstyle, 'labelWidth', prefix, width);
    setPrefixedProperty(_p.rscratch, 'labelWidth', prefix, width);
    setPrefixedProperty(_p.rstyle, 'labelHeight', prefix, height);
    setPrefixedProperty(_p.rscratch, 'labelHeight', prefix, height);
    setPrefixedProperty(_p.rscratch, 'labelLineHeight', prefix, labelLineHeight);
  };

  BRp$6.getLabelText = function (ele, prefix) {
    var _p = ele._private;
    var pfd = prefix ? prefix + '-' : '';
    var text = ele.pstyle(pfd + 'label').strValue;
    var textTransform = ele.pstyle('text-transform').value;

    var rscratch = function rscratch(propName, value) {
      if (value) {
        setPrefixedProperty(_p.rscratch, propName, prefix, value);
        return value;
      } else {
        return getPrefixedProperty(_p.rscratch, propName, prefix);
      }
    }; // for empty text, skip all processing


    if (!text) {
      return '';
    }

    if (textTransform == 'none') ; else if (textTransform == 'uppercase') {
      text = text.toUpperCase();
    } else if (textTransform == 'lowercase') {
      text = text.toLowerCase();
    }

    var wrapStyle = ele.pstyle('text-wrap').value;

    if (wrapStyle === 'wrap') {
      var labelKey = rscratch('labelKey'); // save recalc if the label is the same as before

      if (labelKey != null && rscratch('labelWrapKey') === labelKey) {
        return rscratch('labelWrapCachedText');
      }

      var zwsp = "\u200B";
      var lines = text.split('\n');
      var maxW = ele.pstyle('text-max-width').pfValue;
      var overflow = ele.pstyle('text-overflow-wrap').value;
      var overflowAny = overflow === 'anywhere';
      var wrappedLines = [];
      var wordsRegex = /[\s\u200b]+/;
      var wordSeparator = overflowAny ? '' : ' ';

      for (var l = 0; l < lines.length; l++) {
        var line = lines[l];
        var lineDims = this.calculateLabelDimensions(ele, line);
        var lineW = lineDims.width;

        if (overflowAny) {
          var processedLine = line.split('').join(zwsp);
          line = processedLine;
        }

        if (lineW > maxW) {
          // line is too long
          var words = line.split(wordsRegex);
          var subline = '';

          for (var w = 0; w < words.length; w++) {
            var word = words[w];
            var testLine = subline.length === 0 ? word : subline + wordSeparator + word;
            var testDims = this.calculateLabelDimensions(ele, testLine);
            var testW = testDims.width;

            if (testW <= maxW) {
              // word fits on current line
              subline += word + wordSeparator;
            } else {
              // word starts new line
              if (subline) {
                wrappedLines.push(subline);
              }

              subline = word + wordSeparator;
            }
          } // if there's remaining text, put it in a wrapped line


          if (!subline.match(/^[\s\u200b]+$/)) {
            wrappedLines.push(subline);
          }
        } else {
          // line is already short enough
          wrappedLines.push(line);
        }
      } // for


      rscratch('labelWrapCachedLines', wrappedLines);
      text = rscratch('labelWrapCachedText', wrappedLines.join('\n'));
      rscratch('labelWrapKey', labelKey);
    } else if (wrapStyle === 'ellipsis') {
      var _maxW = ele.pstyle('text-max-width').pfValue;
      var ellipsized = '';
      var ellipsis = "\u2026";
      var incLastCh = false;

      for (var i = 0; i < text.length; i++) {
        var widthWithNextCh = this.calculateLabelDimensions(ele, ellipsized + text[i] + ellipsis).width;

        if (widthWithNextCh > _maxW) {
          break;
        }

        ellipsized += text[i];

        if (i === text.length - 1) {
          incLastCh = true;
        }
      }

      if (!incLastCh) {
        ellipsized += ellipsis;
      }

      return ellipsized;
    } // if ellipsize


    return text;
  };

  BRp$6.getLabelJustification = function (ele) {
    var justification = ele.pstyle('text-justification').strValue;
    var textHalign = ele.pstyle('text-halign').strValue;

    if (justification === 'auto') {
      if (ele.isNode()) {
        switch (textHalign) {
          case 'left':
            return 'right';

          case 'right':
            return 'left';

          default:
            return 'center';
        }
      } else {
        return 'center';
      }
    } else {
      return justification;
    }
  };

  BRp$6.calculateLabelDimensions = function (ele, text) {
    var r = this;
    var cacheKey = hashString(text, ele._private.labelDimsKey);
    var cache = r.labelDimCache || (r.labelDimCache = []);
    var existingVal = cache[cacheKey];

    if (existingVal != null) {
      return existingVal;
    }

    var padding = 6; // add padding around text dims, as the measurement isn't that accurate

    var fStyle = ele.pstyle('font-style').strValue;
    var size = ele.pstyle('font-size').pfValue;
    var family = ele.pstyle('font-family').strValue;
    var weight = ele.pstyle('font-weight').strValue;
    var canvas = this.labelCalcCanvas;
    var c2d = this.labelCalcCanvasContext;

    if (!canvas) {
      canvas = this.labelCalcCanvas = document.createElement('canvas');
      c2d = this.labelCalcCanvasContext = canvas.getContext('2d');
      var ds = canvas.style;
      ds.position = 'absolute';
      ds.left = '-9999px';
      ds.top = '-9999px';
      ds.zIndex = '-1';
      ds.visibility = 'hidden';
      ds.pointerEvents = 'none';
    }

    c2d.font = "".concat(fStyle, " ").concat(weight, " ").concat(size, "px ").concat(family);
    var width = 0;
    var height = 0;
    var lines = text.split('\n');

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var metrics = c2d.measureText(line);
      var w = Math.ceil(metrics.width);
      var h = size;
      width = Math.max(w, width);
      height += h;
    }

    width += padding;
    height += padding;
    return cache[cacheKey] = {
      width: width,
      height: height
    };
  };

  BRp$6.calculateLabelAngle = function (ele, prefix) {
    var _p = ele._private;
    var rs = _p.rscratch;
    var isEdge = ele.isEdge();
    var prefixDash = prefix ? prefix + '-' : '';
    var rot = ele.pstyle(prefixDash + 'text-rotation');
    var rotStr = rot.strValue;

    if (rotStr === 'none') {
      return 0;
    } else if (isEdge && rotStr === 'autorotate') {
      return rs.labelAutoAngle;
    } else if (rotStr === 'autorotate') {
      return 0;
    } else {
      return rot.pfValue;
    }
  };

  BRp$6.calculateLabelAngles = function (ele) {
    var r = this;
    var isEdge = ele.isEdge();
    var _p = ele._private;
    var rs = _p.rscratch;
    rs.labelAngle = r.calculateLabelAngle(ele);

    if (isEdge) {
      rs.sourceLabelAngle = r.calculateLabelAngle(ele, 'source');
      rs.targetLabelAngle = r.calculateLabelAngle(ele, 'target');
    }
  };

  var BRp$7 = {};
  var TOO_SMALL_CUT_RECT = 28;
  var warnedCutRect = false;

  BRp$7.getNodeShape = function (node) {
    var r = this;
    var shape = node.pstyle('shape').value;

    if (shape === 'cutrectangle' && (node.width() < TOO_SMALL_CUT_RECT || node.height() < TOO_SMALL_CUT_RECT)) {
      if (!warnedCutRect) {
        warn('The `cutrectangle` node shape can not be used at small sizes so `rectangle` is used instead');
        warnedCutRect = true;
      }

      return 'rectangle';
    }

    if (node.isParent()) {
      if (shape === 'rectangle' || shape === 'roundrectangle' || shape === 'round-rectangle' || shape === 'cutrectangle' || shape === 'cut-rectangle' || shape === 'barrel') {
        return shape;
      } else {
        return 'rectangle';
      }
    }

    if (shape === 'polygon') {
      var points = node.pstyle('shape-polygon-points').value;
      return r.nodeShapes.makePolygon(points).name;
    }

    return shape;
  };

  var BRp$8 = {};

  BRp$8.registerCalculationListeners = function () {
    var cy = this.cy;
    var elesToUpdate = cy.collection();
    var r = this;

    var enqueue = function enqueue(eles) {
      var dirtyStyleCaches = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
      elesToUpdate.merge(eles);

      if (dirtyStyleCaches) {
        for (var i = 0; i < eles.length; i++) {
          var ele = eles[i];
          var _p = ele._private;
          var rstyle = _p.rstyle;
          rstyle.clean = false;
          rstyle.cleanConnected = false;
        }
      }
    };

    r.binder(cy).on('bounds.* dirty.*', function onDirtyBounds(e) {
      var ele = e.target;
      enqueue(ele);
    }).on('style.* background.*', function onDirtyStyle(e) {
      var ele = e.target;
      enqueue(ele, false);
    });

    var updateEleCalcs = function updateEleCalcs(willDraw) {
      if (willDraw) {
        var fns = r.onUpdateEleCalcsFns;

        for (var i = 0; i < elesToUpdate.length; i++) {
          var ele = elesToUpdate[i];
          var rstyle = ele._private.rstyle;

          if (ele.isNode() && !rstyle.cleanConnected) {
            enqueue(ele.connectedEdges());
            rstyle.cleanConnected = true;
          }
        }

        if (fns) {
          for (var _i = 0; _i < fns.length; _i++) {
            var fn = fns[_i];
            fn(willDraw, elesToUpdate);
          }
        }

        r.recalculateRenderedStyle(elesToUpdate);
        elesToUpdate = cy.collection();
      }
    };

    r.flushRenderedStyleQueue = function () {
      updateEleCalcs(true);
    };

    r.beforeRender(updateEleCalcs, r.beforeRenderPriorities.eleCalcs);
  };

  BRp$8.onUpdateEleCalcs = function (fn) {
    var fns = this.onUpdateEleCalcsFns = this.onUpdateEleCalcsFns || [];
    fns.push(fn);
  };

  BRp$8.recalculateRenderedStyle = function (eles, useCache) {
    var isCleanConnected = function isCleanConnected(ele) {
      return ele._private.rstyle.cleanConnected;
    };

    var edges = [];
    var nodes = []; // the renderer can't be used for calcs when destroyed, e.g. ele.boundingBox()

    if (this.destroyed) {
      return;
    } // use cache by default for perf


    if (useCache === undefined) {
      useCache = true;
    }

    for (var i = 0; i < eles.length; i++) {
      var ele = eles[i];
      var _p = ele._private;
      var rstyle = _p.rstyle; // an edge may be implicitly dirty b/c of one of its connected nodes
      // (and a request for recalc may come in between frames)

      if (ele.isEdge() && (!isCleanConnected(ele.source()) || !isCleanConnected(ele.target()))) {
        rstyle.clean = false;
      } // only update if dirty and in graph


      if (useCache && rstyle.clean || ele.removed()) {
        continue;
      } // only update if not display: none


      if (ele.pstyle('display').value === 'none') {
        continue;
      }

      if (_p.group === 'nodes') {
        nodes.push(ele);
      } else {
        // edges
        edges.push(ele);
      }

      rstyle.clean = true;
    } // update node data from projections


    for (var _i2 = 0; _i2 < nodes.length; _i2++) {
      var _ele = nodes[_i2];
      var _p2 = _ele._private;
      var _rstyle = _p2.rstyle;

      var pos = _ele.position();

      this.recalculateNodeLabelProjection(_ele);
      _rstyle.nodeX = pos.x;
      _rstyle.nodeY = pos.y;
      _rstyle.nodeW = _ele.pstyle('width').pfValue;
      _rstyle.nodeH = _ele.pstyle('height').pfValue;
    }

    this.recalculateEdgeProjections(edges); // update edge data from projections

    for (var _i3 = 0; _i3 < edges.length; _i3++) {
      var _ele2 = edges[_i3];
      var _p3 = _ele2._private;
      var _rstyle2 = _p3.rstyle;
      var rs = _p3.rscratch; // update rstyle positions

      _rstyle2.srcX = rs.arrowStartX;
      _rstyle2.srcY = rs.arrowStartY;
      _rstyle2.tgtX = rs.arrowEndX;
      _rstyle2.tgtY = rs.arrowEndY;
      _rstyle2.midX = rs.midX;
      _rstyle2.midY = rs.midY;
      _rstyle2.labelAngle = rs.labelAngle;
      _rstyle2.sourceLabelAngle = rs.sourceLabelAngle;
      _rstyle2.targetLabelAngle = rs.targetLabelAngle;
    }
  };

  var BRp$9 = {};

  BRp$9.updateCachedGrabbedEles = function () {
    var eles = this.cachedZSortedEles;

    if (!eles) {
      // just let this be recalculated on the next z sort tick
      return;
    }

    eles.drag = [];
    eles.nondrag = [];
    var grabTargets = [];

    for (var i = 0; i < eles.length; i++) {
      var ele = eles[i];
      var rs = ele._private.rscratch;

      if (ele.grabbed() && !ele.isParent()) {
        grabTargets.push(ele);
      } else if (rs.inDragLayer) {
        eles.drag.push(ele);
      } else {
        eles.nondrag.push(ele);
      }
    } // put the grab target nodes last so it's on top of its neighbourhood


    for (var i = 0; i < grabTargets.length; i++) {
      var ele = grabTargets[i];
      eles.drag.push(ele);
    }
  };

  BRp$9.invalidateCachedZSortedEles = function () {
    this.cachedZSortedEles = null;
  };

  BRp$9.getCachedZSortedEles = function (forceRecalc) {
    if (forceRecalc || !this.cachedZSortedEles) {
      var eles = this.cy.mutableElements().toArray();
      eles.sort(zIndexSort);
      eles.interactive = eles.filter(function (ele) {
        return ele.interactive();
      });
      this.cachedZSortedEles = eles;
      this.updateCachedGrabbedEles();
    } else {
      eles = this.cachedZSortedEles;
    }

    return eles;
  };

  var BRp$a = {};
  [BRp$1, BRp$2, BRp$3, BRp$4, BRp$5, BRp$6, BRp$7, BRp$8, BRp$9].forEach(function (props) {
    extend(BRp$a, props);
  });

  var BRp$b = {};

  BRp$b.getCachedImage = function (url, crossOrigin, onLoad) {
    var r = this;
    var imageCache = r.imageCache = r.imageCache || {};
    var cache = imageCache[url];

    if (cache) {
      if (!cache.image.complete) {
        cache.image.addEventListener('load', onLoad);
      }

      return cache.image;
    } else {
      cache = imageCache[url] = imageCache[url] || {};
      var image = cache.image = new Image(); // eslint-disable-line no-undef

      image.addEventListener('load', onLoad);
      image.addEventListener('error', function () {
        image.error = true;
      }); // #1582 safari doesn't load data uris with crossOrigin properly
      // https://bugs.webkit.org/show_bug.cgi?id=123978

      var dataUriPrefix = 'data:';
      var isDataUri = url.substring(0, dataUriPrefix.length).toLowerCase() === dataUriPrefix;

      if (!isDataUri) {
        image.crossOrigin = crossOrigin; // prevent tainted canvas
      }

      image.src = url;
      return image;
    }
  };

  var BRp$c = {};
  /* global document, window, ResizeObserver, MutationObserver */

  BRp$c.registerBinding = function (target, event, handler, useCapture) {
    // eslint-disable-line no-unused-vars
    var args = Array.prototype.slice.apply(arguments, [1]); // copy

    var b = this.binder(target);
    return b.on.apply(b, args);
  };

  BRp$c.binder = function (tgt) {
    var r = this;
    var tgtIsDom = tgt === window || tgt === document || tgt === document.body || domElement(tgt);

    if (r.supportsPassiveEvents == null) {
      // from https://github.com/WICG/EventListenerOptions/blob/gh-pages/explainer.md#feature-detection
      var supportsPassive = false;

      try {
        var opts = Object.defineProperty({}, 'passive', {
          get: function get() {
            supportsPassive = true;
            return true;
          }
        });
        window.addEventListener('test', null, opts);
      } catch (err) {// not supported
      }

      r.supportsPassiveEvents = supportsPassive;
    }

    var on = function on(event, handler, useCapture) {
      var args = Array.prototype.slice.call(arguments);

      if (tgtIsDom && r.supportsPassiveEvents) {
        // replace useCapture w/ opts obj
        args[2] = {
          capture: useCapture != null ? useCapture : false,
          passive: false,
          once: false
        };
      }

      r.bindings.push({
        target: tgt,
        args: args
      });
      (tgt.addEventListener || tgt.on).apply(tgt, args);
      return this;
    };

    return {
      on: on,
      addEventListener: on,
      addListener: on,
      bind: on
    };
  };

  BRp$c.nodeIsDraggable = function (node) {
    return node && node.isNode() && !node.locked() && node.grabbable();
  };

  BRp$c.nodeIsGrabbable = function (node) {
    return this.nodeIsDraggable(node) && node.interactive();
  };

  BRp$c.load = function () {
    var r = this;

    var isSelected = function isSelected(ele) {
      return ele.selected();
    };

    var triggerEvents = function triggerEvents(target, names, e, position) {
      if (target == null) {
        target = r.cy;
      }

      for (var i = 0; i < names.length; i++) {
        var name = names[i];
        target.emit({
          originalEvent: e,
          type: name,
          position: position
        });
      }
    };

    var isMultSelKeyDown = function isMultSelKeyDown(e) {
      return e.shiftKey || e.metaKey || e.ctrlKey; // maybe e.altKey
    };

    var allowPanningPassthrough = function allowPanningPassthrough(down, downs) {
      var allowPassthrough = true;

      if (r.cy.hasCompoundNodes() && down && down.pannable()) {
        // a grabbable compound node below the ele => no passthrough panning
        for (var i = 0; downs && i < downs.length; i++) {
          var down = downs[i];

          if (down.isNode() && down.isParent()) {
            allowPassthrough = false;
            break;
          }
        }
      } else {
        allowPassthrough = true;
      }

      return allowPassthrough;
    };

    var setGrabbed = function setGrabbed(ele) {
      ele[0]._private.grabbed = true;
    };

    var setFreed = function setFreed(ele) {
      ele[0]._private.grabbed = false;
    };

    var setInDragLayer = function setInDragLayer(ele) {
      ele[0]._private.rscratch.inDragLayer = true;
    };

    var setOutDragLayer = function setOutDragLayer(ele) {
      ele[0]._private.rscratch.inDragLayer = false;
    };

    var setGrabTarget = function setGrabTarget(ele) {
      ele[0]._private.rscratch.isGrabTarget = true;
    };

    var removeGrabTarget = function removeGrabTarget(ele) {
      ele[0]._private.rscratch.isGrabTarget = false;
    };

    var addToDragList = function addToDragList(ele, opts) {
      var list = opts.addToList;
      var listHasEle = list.has(ele);

      if (!listHasEle) {
        list.merge(ele);
        setGrabbed(ele);
      }
    }; // helper function to determine which child nodes and inner edges
    // of a compound node to be dragged as well as the grabbed and selected nodes


    var addDescendantsToDrag = function addDescendantsToDrag(node, opts) {
      if (!node.cy().hasCompoundNodes()) {
        return;
      }

      if (opts.inDragLayer == null && opts.addToList == null) {
        return;
      } // nothing to do


      var innerNodes = node.descendants();

      if (opts.inDragLayer) {
        innerNodes.forEach(setInDragLayer);
        innerNodes.connectedEdges().forEach(setInDragLayer);
      }

      if (opts.addToList) {
        opts.addToList.unmerge(innerNodes);
      }
    }; // adds the given nodes and its neighbourhood to the drag layer


    var addNodesToDrag = function addNodesToDrag(nodes, opts) {
      opts = opts || {};
      var hasCompoundNodes = nodes.cy().hasCompoundNodes();

      if (opts.inDragLayer) {
        nodes.forEach(setInDragLayer);
        nodes.neighborhood().stdFilter(function (ele) {
          return !hasCompoundNodes || ele.isEdge();
        }).forEach(setInDragLayer);
      }

      if (opts.addToList) {
        nodes.forEach(function (ele) {
          addToDragList(ele, opts);
        });
      }

      addDescendantsToDrag(nodes, opts); // always add to drag
      // also add nodes and edges related to the topmost ancestor

      updateAncestorsInDragLayer(nodes, {
        inDragLayer: opts.inDragLayer
      });
      r.updateCachedGrabbedEles();
    };

    var addNodeToDrag = addNodesToDrag;

    var freeDraggedElements = function freeDraggedElements(grabbedEles) {
      if (!grabbedEles) {
        return;
      } // just go over all elements rather than doing a bunch of (possibly expensive) traversals


      r.getCachedZSortedEles().forEach(function (ele) {
        setFreed(ele);
        setOutDragLayer(ele);
        removeGrabTarget(ele);
      });
      r.updateCachedGrabbedEles();
    }; // helper function to determine which ancestor nodes and edges should go
    // to the drag layer (or should be removed from drag layer).


    var updateAncestorsInDragLayer = function updateAncestorsInDragLayer(node, opts) {
      if (opts.inDragLayer == null && opts.addToList == null) {
        return;
      } // nothing to do


      if (!node.cy().hasCompoundNodes()) {
        return;
      } // find top-level parent


      var parent = node.ancestors().orphans(); // no parent node: no nodes to add to the drag layer

      if (parent.same(node)) {
        return;
      }

      var nodes = parent.descendants().spawnSelf().merge(parent).unmerge(node).unmerge(node.descendants());
      var edges = nodes.connectedEdges();

      if (opts.inDragLayer) {
        edges.forEach(setInDragLayer);
        nodes.forEach(setInDragLayer);
      }

      if (opts.addToList) {
        nodes.forEach(function (ele) {
          addToDragList(ele, opts);
        });
      }
    };

    var blurActiveDomElement = function blurActiveDomElement() {
      if (document.activeElement != null && document.activeElement.blur != null) {
        document.activeElement.blur();
      }
    };

    var haveMutationsApi = typeof MutationObserver !== 'undefined';
    var haveResizeObserverApi = typeof ResizeObserver !== 'undefined'; // watch for when the cy container is removed from the dom

    if (haveMutationsApi) {
      r.removeObserver = new MutationObserver(function (mutns) {
        // eslint-disable-line no-undef
        for (var i = 0; i < mutns.length; i++) {
          var mutn = mutns[i];
          var rNodes = mutn.removedNodes;

          if (rNodes) {
            for (var j = 0; j < rNodes.length; j++) {
              var rNode = rNodes[j];

              if (rNode === r.container) {
                r.destroy();
                break;
              }
            }
          }
        }
      });

      if (r.container.parentNode) {
        r.removeObserver.observe(r.container.parentNode, {
          childList: true
        });
      }
    } else {
      r.registerBinding(r.container, 'DOMNodeRemoved', function (e) {
        // eslint-disable-line no-unused-vars
        r.destroy();
      });
    }

    var onResize = lodash_debounce(function () {
      r.cy.resize();
    }, 100);

    if (haveMutationsApi) {
      r.styleObserver = new MutationObserver(onResize); // eslint-disable-line no-undef

      r.styleObserver.observe(r.container, {
        attributes: true
      });
    } // auto resize


    r.registerBinding(window, 'resize', onResize); // eslint-disable-line no-undef

    if (haveResizeObserverApi) {
      r.resizeObserver = new ResizeObserver(onResize); // eslint-disable-line no-undef

      r.resizeObserver.observe(r.container);
    }

    var forEachUp = function forEachUp(domEle, fn) {
      while (domEle != null) {
        fn(domEle);
        domEle = domEle.parentNode;
      }
    };

    var invalidateCoords = function invalidateCoords() {
      r.invalidateContainerClientCoordsCache();
    };

    forEachUp(r.container, function (domEle) {
      r.registerBinding(domEle, 'transitionend', invalidateCoords);
      r.registerBinding(domEle, 'animationend', invalidateCoords);
      r.registerBinding(domEle, 'scroll', invalidateCoords);
    }); // stop right click menu from appearing on cy

    r.registerBinding(r.container, 'contextmenu', function (e) {
      e.preventDefault();
    });

    var inBoxSelection = function inBoxSelection() {
      return r.selection[4] !== 0;
    };

    var eventInContainer = function eventInContainer(e) {
      // save cycles if mouse events aren't to be captured
      var containerPageCoords = r.findContainerClientCoords();
      var x = containerPageCoords[0];
      var y = containerPageCoords[1];
      var width = containerPageCoords[2];
      var height = containerPageCoords[3];
      var positions = e.touches ? e.touches : [e];
      var atLeastOnePosInside = false;

      for (var i = 0; i < positions.length; i++) {
        var p = positions[i];

        if (x <= p.clientX && p.clientX <= x + width && y <= p.clientY && p.clientY <= y + height) {
          atLeastOnePosInside = true;
          break;
        }
      }

      if (!atLeastOnePosInside) {
        return false;
      }

      var container = r.container;
      var target = e.target;
      var tParent = target.parentNode;
      var containerIsTarget = false;

      while (tParent) {
        if (tParent === container) {
          containerIsTarget = true;
          break;
        }

        tParent = tParent.parentNode;
      }

      if (!containerIsTarget) {
        return false;
      } // if target is outisde cy container, then this event is not for us


      return true;
    }; // Primary key


    r.registerBinding(r.container, 'mousedown', function mousedownHandler(e) {
      if (!eventInContainer(e)) {
        return;
      }

      e.preventDefault();
      blurActiveDomElement();
      r.hoverData.capture = true;
      r.hoverData.which = e.which;
      var cy = r.cy;
      var gpos = [e.clientX, e.clientY];
      var pos = r.projectIntoViewport(gpos[0], gpos[1]);
      var select = r.selection;
      var nears = r.findNearestElements(pos[0], pos[1], true, false);
      var near = nears[0];
      var draggedElements = r.dragData.possibleDragElements;
      r.hoverData.mdownPos = pos;
      r.hoverData.mdownGPos = gpos;

      var checkForTaphold = function checkForTaphold() {
        r.hoverData.tapholdCancelled = false;
        clearTimeout(r.hoverData.tapholdTimeout);
        r.hoverData.tapholdTimeout = setTimeout(function () {
          if (r.hoverData.tapholdCancelled) {
            return;
          } else {
            var ele = r.hoverData.down;

            if (ele) {
              ele.emit({
                originalEvent: e,
                type: 'taphold',
                position: {
                  x: pos[0],
                  y: pos[1]
                }
              });
            } else {
              cy.emit({
                originalEvent: e,
                type: 'taphold',
                position: {
                  x: pos[0],
                  y: pos[1]
                }
              });
            }
          }
        }, r.tapholdDuration);
      }; // Right click button


      if (e.which == 3) {
        r.hoverData.cxtStarted = true;
        var cxtEvt = {
          originalEvent: e,
          type: 'cxttapstart',
          position: {
            x: pos[0],
            y: pos[1]
          }
        };

        if (near) {
          near.activate();
          near.emit(cxtEvt);
          r.hoverData.down = near;
        } else {
          cy.emit(cxtEvt);
        }

        r.hoverData.downTime = new Date().getTime();
        r.hoverData.cxtDragged = false; // Primary button
      } else if (e.which == 1) {
        if (near) {
          near.activate();
        } // Element dragging


        {
          // If something is under the cursor and it is draggable, prepare to grab it
          if (near != null) {
            if (r.nodeIsGrabbable(near)) {
              var makeEvent = function makeEvent(type) {
                return {
                  originalEvent: e,
                  type: type,
                  position: {
                    x: pos[0],
                    y: pos[1]
                  }
                };
              };

              var triggerGrab = function triggerGrab(ele) {
                ele.emit(makeEvent('grab'));
              };

              setGrabTarget(near);

              if (!near.selected()) {
                draggedElements = r.dragData.possibleDragElements = cy.collection();
                addNodeToDrag(near, {
                  addToList: draggedElements
                });
                near.emit(makeEvent('grabon')).emit(makeEvent('grab'));
              } else {
                draggedElements = r.dragData.possibleDragElements = cy.collection();
                var selectedNodes = cy.$(function (ele) {
                  return ele.isNode() && ele.selected() && r.nodeIsGrabbable(ele);
                });
                addNodesToDrag(selectedNodes, {
                  addToList: draggedElements
                });
                near.emit(makeEvent('grabon'));
                selectedNodes.forEach(triggerGrab);
              }

              r.redrawHint('eles', true);
              r.redrawHint('drag', true);
            }
          }

          r.hoverData.down = near;
          r.hoverData.downs = nears;
          r.hoverData.downTime = new Date().getTime();
        }
        triggerEvents(near, ['mousedown', 'tapstart', 'vmousedown'], e, {
          x: pos[0],
          y: pos[1]
        });

        if (near == null) {
          select[4] = 1;
          r.data.bgActivePosistion = {
            x: pos[0],
            y: pos[1]
          };
          r.redrawHint('select', true);
          r.redraw();
        } else if (near.pannable()) {
          select[4] = 1; // for future pan
        }

        checkForTaphold();
      } // Initialize selection box coordinates


      select[0] = select[2] = pos[0];
      select[1] = select[3] = pos[1];
    }, false);
    r.registerBinding(window, 'mousemove', function mousemoveHandler(e) {
      // eslint-disable-line no-undef
      var capture = r.hoverData.capture;

      if (!capture && !eventInContainer(e)) {
        return;
      }

      var preventDefault = false;
      var cy = r.cy;
      var zoom = cy.zoom();
      var gpos = [e.clientX, e.clientY];
      var pos = r.projectIntoViewport(gpos[0], gpos[1]);
      var mdownPos = r.hoverData.mdownPos;
      var mdownGPos = r.hoverData.mdownGPos;
      var select = r.selection;
      var near = null;

      if (!r.hoverData.draggingEles && !r.hoverData.dragging && !r.hoverData.selecting) {
        near = r.findNearestElement(pos[0], pos[1], true, false);
      }

      var last = r.hoverData.last;
      var down = r.hoverData.down;
      var disp = [pos[0] - select[2], pos[1] - select[3]];
      var draggedElements = r.dragData.possibleDragElements;
      var isOverThresholdDrag;

      if (mdownGPos) {
        var dx = gpos[0] - mdownGPos[0];
        var dx2 = dx * dx;
        var dy = gpos[1] - mdownGPos[1];
        var dy2 = dy * dy;
        var dist2 = dx2 + dy2;
        r.hoverData.isOverThresholdDrag = isOverThresholdDrag = dist2 >= r.desktopTapThreshold2;
      }

      var multSelKeyDown = isMultSelKeyDown(e);

      if (isOverThresholdDrag) {
        r.hoverData.tapholdCancelled = true;
      }

      var updateDragDelta = function updateDragDelta() {
        var dragDelta = r.hoverData.dragDelta = r.hoverData.dragDelta || [];

        if (dragDelta.length === 0) {
          dragDelta.push(disp[0]);
          dragDelta.push(disp[1]);
        } else {
          dragDelta[0] += disp[0];
          dragDelta[1] += disp[1];
        }
      };

      preventDefault = true;
      triggerEvents(near, ['mousemove', 'vmousemove', 'tapdrag'], e, {
        x: pos[0],
        y: pos[1]
      });

      var goIntoBoxMode = function goIntoBoxMode() {
        r.data.bgActivePosistion = undefined;

        if (!r.hoverData.selecting) {
          cy.emit({
            originalEvent: e,
            type: 'boxstart',
            position: {
              x: pos[0],
              y: pos[1]
            }
          });
        }

        select[4] = 1;
        r.hoverData.selecting = true;
        r.redrawHint('select', true);
        r.redraw();
      }; // trigger context drag if rmouse down


      if (r.hoverData.which === 3) {
        // but only if over threshold
        if (isOverThresholdDrag) {
          var cxtEvt = {
            originalEvent: e,
            type: 'cxtdrag',
            position: {
              x: pos[0],
              y: pos[1]
            }
          };

          if (down) {
            down.emit(cxtEvt);
          } else {
            cy.emit(cxtEvt);
          }

          r.hoverData.cxtDragged = true;

          if (!r.hoverData.cxtOver || near !== r.hoverData.cxtOver) {
            if (r.hoverData.cxtOver) {
              r.hoverData.cxtOver.emit({
                originalEvent: e,
                type: 'cxtdragout',
                position: {
                  x: pos[0],
                  y: pos[1]
                }
              });
            }

            r.hoverData.cxtOver = near;

            if (near) {
              near.emit({
                originalEvent: e,
                type: 'cxtdragover',
                position: {
                  x: pos[0],
                  y: pos[1]
                }
              });
            }
          }
        } // Check if we are drag panning the entire graph

      } else if (r.hoverData.dragging) {
        preventDefault = true;

        if (cy.panningEnabled() && cy.userPanningEnabled()) {
          var deltaP;

          if (r.hoverData.justStartedPan) {
            var mdPos = r.hoverData.mdownPos;
            deltaP = {
              x: (pos[0] - mdPos[0]) * zoom,
              y: (pos[1] - mdPos[1]) * zoom
            };
            r.hoverData.justStartedPan = false;
          } else {
            deltaP = {
              x: disp[0] * zoom,
              y: disp[1] * zoom
            };
          }

          cy.panBy(deltaP);
          r.hoverData.dragged = true;
        } // Needs reproject due to pan changing viewport


        pos = r.projectIntoViewport(e.clientX, e.clientY); // Checks primary button down & out of time & mouse not moved much
      } else if (select[4] == 1 && (down == null || down.pannable())) {
        if (isOverThresholdDrag) {
          if (!r.hoverData.dragging && cy.boxSelectionEnabled() && (multSelKeyDown || !cy.panningEnabled() || !cy.userPanningEnabled())) {
            goIntoBoxMode();
          } else if (!r.hoverData.selecting && cy.panningEnabled() && cy.userPanningEnabled()) {
            var allowPassthrough = allowPanningPassthrough(down, r.hoverData.downs);

            if (allowPassthrough) {
              r.hoverData.dragging = true;
              r.hoverData.justStartedPan = true;
              select[4] = 0;
              r.data.bgActivePosistion = array2point(mdownPos);
              r.redrawHint('select', true);
              r.redraw();
            }
          }

          if (down && down.pannable() && down.active()) {
            down.unactivate();
          }
        }
      } else {
        if (down && down.pannable() && down.active()) {
          down.unactivate();
        }

        if ((!down || !down.grabbed()) && near != last) {
          if (last) {
            triggerEvents(last, ['mouseout', 'tapdragout'], e, {
              x: pos[0],
              y: pos[1]
            });
          }

          if (near) {
            triggerEvents(near, ['mouseover', 'tapdragover'], e, {
              x: pos[0],
              y: pos[1]
            });
          }

          r.hoverData.last = near;
        }

        if (down) {
          if (isOverThresholdDrag) {
            // then we can take action
            if (cy.boxSelectionEnabled() && multSelKeyDown) {
              // then selection overrides
              if (down && down.grabbed()) {
                freeDraggedElements(draggedElements);
                down.emit('freeon');
                draggedElements.emit('free');

                if (r.dragData.didDrag) {
                  down.emit('dragfreeon');
                  draggedElements.emit('dragfree');
                }
              }

              goIntoBoxMode();
            } else if (down && down.grabbed() && r.nodeIsDraggable(down)) {
              // drag node
              var justStartedDrag = !r.dragData.didDrag;

              if (justStartedDrag) {
                r.redrawHint('eles', true);
              }

              r.dragData.didDrag = true; // indicate that we actually did drag the node

              var toTrigger = cy.collection(); // now, add the elements to the drag layer if not done already

              if (!r.hoverData.draggingEles) {
                addNodesToDrag(draggedElements, {
                  inDragLayer: true
                });
              }

              var totalShift = {
                x: 0,
                y: 0
              };

              if (number(disp[0]) && number(disp[1])) {
                totalShift.x += disp[0];
                totalShift.y += disp[1];

                if (justStartedDrag) {
                  var dragDelta = r.hoverData.dragDelta;

                  if (dragDelta && number(dragDelta[0]) && number(dragDelta[1])) {
                    totalShift.x += dragDelta[0];
                    totalShift.y += dragDelta[1];
                  }
                }
              }

              for (var i = 0; i < draggedElements.length; i++) {
                var dEle = draggedElements[i];

                if (r.nodeIsDraggable(dEle) && dEle.grabbed()) {
                  toTrigger.push(dEle);
                }
              }

              r.hoverData.draggingEles = true;
              toTrigger.silentShift(totalShift).emit('position drag');
              r.redrawHint('drag', true);
              r.redraw();
            }
          } else {
            // otherwise save drag delta for when we actually start dragging so the relative grab pos is constant
            updateDragDelta();
          }
        } // prevent the dragging from triggering text selection on the page


        preventDefault = true;
      }

      select[2] = pos[0];
      select[3] = pos[1];

      if (preventDefault) {
        if (e.stopPropagation) e.stopPropagation();
        if (e.preventDefault) e.preventDefault();
        return false;
      }
    }, false);
    r.registerBinding(window, 'mouseup', function mouseupHandler(e) {
      // eslint-disable-line no-undef
      var capture = r.hoverData.capture;

      if (!capture) {
        return;
      }

      r.hoverData.capture = false;
      var cy = r.cy;
      var pos = r.projectIntoViewport(e.clientX, e.clientY);
      var select = r.selection;
      var near = r.findNearestElement(pos[0], pos[1], true, false);
      var draggedElements = r.dragData.possibleDragElements;
      var down = r.hoverData.down;
      var multSelKeyDown = isMultSelKeyDown(e);

      if (r.data.bgActivePosistion) {
        r.redrawHint('select', true);
        r.redraw();
      }

      r.hoverData.tapholdCancelled = true;
      r.data.bgActivePosistion = undefined; // not active bg now

      if (down) {
        down.unactivate();
      }

      if (r.hoverData.which === 3) {
        var cxtEvt = {
          originalEvent: e,
          type: 'cxttapend',
          position: {
            x: pos[0],
            y: pos[1]
          }
        };

        if (down) {
          down.emit(cxtEvt);
        } else {
          cy.emit(cxtEvt);
        }

        if (!r.hoverData.cxtDragged) {
          var cxtTap = {
            originalEvent: e,
            type: 'cxttap',
            position: {
              x: pos[0],
              y: pos[1]
            }
          };

          if (down) {
            down.emit(cxtTap);
          } else {
            cy.emit(cxtTap);
          }
        }

        r.hoverData.cxtDragged = false;
        r.hoverData.which = null;
      } else if (r.hoverData.which === 1) {
        triggerEvents(near, ['mouseup', 'tapend', 'vmouseup'], e, {
          x: pos[0],
          y: pos[1]
        });

        if (!r.dragData.didDrag // didn't move a node around
        && !r.hoverData.dragged // didn't pan
        && !r.hoverData.selecting // not box selection
        && !r.hoverData.isOverThresholdDrag // didn't move too much
        ) {
            triggerEvents(down, ['click', 'tap', 'vclick'], e, {
              x: pos[0],
              y: pos[1]
            });
          } // Deselect all elements if nothing is currently under the mouse cursor and we aren't dragging something


        if (down == null && // not mousedown on node
        !r.dragData.didDrag // didn't move the node around
        && !r.hoverData.selecting // not box selection
        && !r.hoverData.dragged // didn't pan
        && !isMultSelKeyDown(e)) {
          cy.$(isSelected).unselect(['tapunselect']);

          if (draggedElements.length > 0) {
            r.redrawHint('eles', true);
          }

          r.dragData.possibleDragElements = draggedElements = cy.collection();
        } // Single selection


        if (near == down && !r.dragData.didDrag && !r.hoverData.selecting) {
          if (near != null && near._private.selectable) {
            if (r.hoverData.dragging) ; else if (cy.selectionType() === 'additive' || multSelKeyDown) {
              if (near.selected()) {
                near.unselect(['tapunselect']);
              } else {
                near.select(['tapselect']);
              }
            } else {
              if (!multSelKeyDown) {
                cy.$(isSelected).unmerge(near).unselect(['tapunselect']);
                near.select(['tapselect']);
              }
            }

            r.redrawHint('eles', true);
          }
        }

        if (r.hoverData.selecting) {
          var box = cy.collection(r.getAllInBox(select[0], select[1], select[2], select[3]));
          r.redrawHint('select', true);

          if (box.length > 0) {
            r.redrawHint('eles', true);
          }

          cy.emit({
            type: 'boxend',
            originalEvent: e,
            position: {
              x: pos[0],
              y: pos[1]
            }
          });

          var eleWouldBeSelected = function eleWouldBeSelected(ele) {
            return ele.selectable() && !ele.selected();
          };

          if (cy.selectionType() === 'additive') {
            box.emit('box').stdFilter(eleWouldBeSelected).select().emit('boxselect');
          } else {
            if (!multSelKeyDown) {
              cy.$(isSelected).unmerge(box).unselect();
            }

            box.emit('box').stdFilter(eleWouldBeSelected).select().emit('boxselect');
          } // always need redraw in case eles unselectable


          r.redraw();
        } // Cancel drag pan


        if (r.hoverData.dragging) {
          r.hoverData.dragging = false;
          r.redrawHint('select', true);
          r.redrawHint('eles', true);
          r.redraw();
        }

        if (!select[4]) {
          r.redrawHint('drag', true);
          r.redrawHint('eles', true);
          var downWasGrabbed = down && down.grabbed();
          freeDraggedElements(draggedElements);

          if (downWasGrabbed) {
            down.emit('freeon');
            draggedElements.emit('free');

            if (r.dragData.didDrag) {
              down.emit('dragfreeon');
              draggedElements.emit('dragfree');
            }
          }
        }
      } // else not right mouse


      select[4] = 0;
      r.hoverData.down = null;
      r.hoverData.cxtStarted = false;
      r.hoverData.draggingEles = false;
      r.hoverData.selecting = false;
      r.hoverData.isOverThresholdDrag = false;
      r.dragData.didDrag = false;
      r.hoverData.dragged = false;
      r.hoverData.dragDelta = [];
      r.hoverData.mdownPos = null;
      r.hoverData.mdownGPos = null;
    }, false);

    var wheelHandler = function wheelHandler(e) {
      if (r.scrollingPage) {
        return;
      } // while scrolling, ignore wheel-to-zoom


      var cy = r.cy;
      var zoom = cy.zoom();
      var pan = cy.pan();
      var pos = r.projectIntoViewport(e.clientX, e.clientY);
      var rpos = [pos[0] * zoom + pan.x, pos[1] * zoom + pan.y];

      if (r.hoverData.draggingEles || r.hoverData.dragging || r.hoverData.cxtStarted || inBoxSelection()) {
        // if pan dragging or cxt dragging, wheel movements make no zoom
        e.preventDefault();
        return;
      }

      if (cy.panningEnabled() && cy.userPanningEnabled() && cy.zoomingEnabled() && cy.userZoomingEnabled()) {
        e.preventDefault();
        r.data.wheelZooming = true;
        clearTimeout(r.data.wheelTimeout);
        r.data.wheelTimeout = setTimeout(function () {
          r.data.wheelZooming = false;
          r.redrawHint('eles', true);
          r.redraw();
        }, 150);
        var diff;

        if (e.deltaY != null) {
          diff = e.deltaY / -250;
        } else if (e.wheelDeltaY != null) {
          diff = e.wheelDeltaY / 1000;
        } else {
          diff = e.wheelDelta / 1000;
        }

        diff = diff * r.wheelSensitivity;
        var needsWheelFix = e.deltaMode === 1;

        if (needsWheelFix) {
          // fixes slow wheel events on ff/linux and ff/windows
          diff *= 33;
        }

        var newZoom = cy.zoom() * Math.pow(10, diff);

        if (e.type === 'gesturechange') {
          newZoom = r.gestureStartZoom * e.scale;
        }

        cy.zoom({
          level: newZoom,
          renderedPosition: {
            x: rpos[0],
            y: rpos[1]
          }
        });
      }
    }; // Functions to help with whether mouse wheel should trigger zooming
    // --


    r.registerBinding(r.container, 'wheel', wheelHandler, true); // disable nonstandard wheel events
    // r.registerBinding(r.container, 'mousewheel', wheelHandler, true);
    // r.registerBinding(r.container, 'DOMMouseScroll', wheelHandler, true);
    // r.registerBinding(r.container, 'MozMousePixelScroll', wheelHandler, true); // older firefox

    r.registerBinding(window, 'scroll', function scrollHandler(e) {
      // eslint-disable-line no-unused-vars
      r.scrollingPage = true;
      clearTimeout(r.scrollingPageTimeout);
      r.scrollingPageTimeout = setTimeout(function () {
        r.scrollingPage = false;
      }, 250);
    }, true); // desktop safari pinch to zoom start

    r.registerBinding(r.container, 'gesturestart', function gestureStartHandler(e) {
      r.gestureStartZoom = r.cy.zoom();

      if (!r.hasTouchStarted) {
        // don't affect touch devices like iphone
        e.preventDefault();
      }
    }, true);
    r.registerBinding(r.container, 'gesturechange', function (e) {
      if (!r.hasTouchStarted) {
        // don't affect touch devices like iphone
        wheelHandler(e);
      }
    }, true); // Functions to help with handling mouseout/mouseover on the Cytoscape container
    // Handle mouseout on Cytoscape container

    r.registerBinding(r.container, 'mouseout', function mouseOutHandler(e) {
      var pos = r.projectIntoViewport(e.clientX, e.clientY);
      r.cy.emit({
        originalEvent: e,
        type: 'mouseout',
        position: {
          x: pos[0],
          y: pos[1]
        }
      });
    }, false);
    r.registerBinding(r.container, 'mouseover', function mouseOverHandler(e) {
      var pos = r.projectIntoViewport(e.clientX, e.clientY);
      r.cy.emit({
        originalEvent: e,
        type: 'mouseover',
        position: {
          x: pos[0],
          y: pos[1]
        }
      });
    }, false);
    var f1x1, f1y1, f2x1, f2y1; // starting points for pinch-to-zoom

    var distance1, distance1Sq; // initial distance between finger 1 and finger 2 for pinch-to-zoom

    var center1, modelCenter1; // center point on start pinch to zoom

    var offsetLeft, offsetTop;
    var containerWidth, containerHeight;
    var twoFingersStartInside;

    var distance = function distance(x1, y1, x2, y2) {
      return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
    };

    var distanceSq = function distanceSq(x1, y1, x2, y2) {
      return (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    };

    var touchstartHandler;
    r.registerBinding(r.container, 'touchstart', touchstartHandler = function touchstartHandler(e) {
      r.hasTouchStarted = true;

      if (!eventInContainer(e)) {
        return;
      }

      blurActiveDomElement();
      r.touchData.capture = true;
      r.data.bgActivePosistion = undefined;
      var cy = r.cy;
      var now = r.touchData.now;
      var earlier = r.touchData.earlier;

      if (e.touches[0]) {
        var pos = r.projectIntoViewport(e.touches[0].clientX, e.touches[0].clientY);
        now[0] = pos[0];
        now[1] = pos[1];
      }

      if (e.touches[1]) {
        var pos = r.projectIntoViewport(e.touches[1].clientX, e.touches[1].clientY);
        now[2] = pos[0];
        now[3] = pos[1];
      }

      if (e.touches[2]) {
        var pos = r.projectIntoViewport(e.touches[2].clientX, e.touches[2].clientY);
        now[4] = pos[0];
        now[5] = pos[1];
      } // record starting points for pinch-to-zoom


      if (e.touches[1]) {
        r.touchData.singleTouchMoved = true;
        freeDraggedElements(r.dragData.touchDragEles);
        var offsets = r.findContainerClientCoords();
        offsetLeft = offsets[0];
        offsetTop = offsets[1];
        containerWidth = offsets[2];
        containerHeight = offsets[3];
        f1x1 = e.touches[0].clientX - offsetLeft;
        f1y1 = e.touches[0].clientY - offsetTop;
        f2x1 = e.touches[1].clientX - offsetLeft;
        f2y1 = e.touches[1].clientY - offsetTop;
        twoFingersStartInside = 0 <= f1x1 && f1x1 <= containerWidth && 0 <= f2x1 && f2x1 <= containerWidth && 0 <= f1y1 && f1y1 <= containerHeight && 0 <= f2y1 && f2y1 <= containerHeight;
        var pan = cy.pan();
        var zoom = cy.zoom();
        distance1 = distance(f1x1, f1y1, f2x1, f2y1);
        distance1Sq = distanceSq(f1x1, f1y1, f2x1, f2y1);
        center1 = [(f1x1 + f2x1) / 2, (f1y1 + f2y1) / 2];
        modelCenter1 = [(center1[0] - pan.x) / zoom, (center1[1] - pan.y) / zoom]; // consider context tap

        var cxtDistThreshold = 200;
        var cxtDistThresholdSq = cxtDistThreshold * cxtDistThreshold;

        if (distance1Sq < cxtDistThresholdSq && !e.touches[2]) {
          var near1 = r.findNearestElement(now[0], now[1], true, true);
          var near2 = r.findNearestElement(now[2], now[3], true, true);

          if (near1 && near1.isNode()) {
            near1.activate().emit({
              originalEvent: e,
              type: 'cxttapstart',
              position: {
                x: now[0],
                y: now[1]
              }
            });
            r.touchData.start = near1;
          } else if (near2 && near2.isNode()) {
            near2.activate().emit({
              originalEvent: e,
              type: 'cxttapstart',
              position: {
                x: now[0],
                y: now[1]
              }
            });
            r.touchData.start = near2;
          } else {
            cy.emit({
              originalEvent: e,
              type: 'cxttapstart',
              position: {
                x: now[0],
                y: now[1]
              }
            });
          }

          if (r.touchData.start) {
            r.touchData.start._private.grabbed = false;
          }

          r.touchData.cxt = true;
          r.touchData.cxtDragged = false;
          r.data.bgActivePosistion = undefined;
          r.redraw();
          return;
        }
      }

      if (e.touches[2]) {
        // ignore
        // safari on ios pans the page otherwise (normally you should be able to preventdefault on touchmove...)
        if (cy.boxSelectionEnabled()) {
          e.preventDefault();
        }
      } else if (e.touches[1]) ; else if (e.touches[0]) {
        var nears = r.findNearestElements(now[0], now[1], true, true);
        var near = nears[0];

        if (near != null) {
          near.activate();
          r.touchData.start = near;
          r.touchData.starts = nears;

          if (r.nodeIsGrabbable(near)) {
            var draggedEles = r.dragData.touchDragEles = cy.collection();
            var selectedNodes = null;
            r.redrawHint('eles', true);
            r.redrawHint('drag', true);

            if (near.selected()) {
              // reset drag elements, since near will be added again
              selectedNodes = cy.$(function (ele) {
                return ele.selected() && r.nodeIsGrabbable(ele);
              });
              addNodesToDrag(selectedNodes, {
                addToList: draggedEles
              });
            } else {
              addNodeToDrag(near, {
                addToList: draggedEles
              });
            }

            setGrabTarget(near);

            var makeEvent = function makeEvent(type) {
              return {
                originalEvent: e,
                type: type,
                position: {
                  x: now[0],
                  y: now[1]
                }
              };
            };

            near.emit(makeEvent('grabon'));

            if (selectedNodes) {
              selectedNodes.forEach(function (n) {
                n.emit(makeEvent('grab'));
              });
            } else {
              near.emit(makeEvent('grab'));
            }
          }
        }

        triggerEvents(near, ['touchstart', 'tapstart', 'vmousedown'], e, {
          x: now[0],
          y: now[1]
        });

        if (near == null) {
          r.data.bgActivePosistion = {
            x: pos[0],
            y: pos[1]
          };
          r.redrawHint('select', true);
          r.redraw();
        } // Tap, taphold
        // -----


        r.touchData.singleTouchMoved = false;
        r.touchData.singleTouchStartTime = +new Date();
        clearTimeout(r.touchData.tapholdTimeout);
        r.touchData.tapholdTimeout = setTimeout(function () {
          if (r.touchData.singleTouchMoved === false && !r.pinching // if pinching, then taphold unselect shouldn't take effect
          && !r.touchData.selecting // box selection shouldn't allow taphold through
          ) {
              triggerEvents(r.touchData.start, ['taphold'], e, {
                x: now[0],
                y: now[1]
              });
            }
        }, r.tapholdDuration);
      }

      if (e.touches.length >= 1) {
        var sPos = r.touchData.startPosition = [];

        for (var i = 0; i < now.length; i++) {
          sPos[i] = earlier[i] = now[i];
        }

        var touch0 = e.touches[0];
        r.touchData.startGPosition = [touch0.clientX, touch0.clientY];
      }
    }, false);
    var touchmoveHandler;
    r.registerBinding(window, 'touchmove', touchmoveHandler = function touchmoveHandler(e) {
      // eslint-disable-line no-undef
      var capture = r.touchData.capture;

      if (!capture && !eventInContainer(e)) {
        return;
      }

      var select = r.selection;
      var cy = r.cy;
      var now = r.touchData.now;
      var earlier = r.touchData.earlier;
      var zoom = cy.zoom();

      if (e.touches[0]) {
        var pos = r.projectIntoViewport(e.touches[0].clientX, e.touches[0].clientY);
        now[0] = pos[0];
        now[1] = pos[1];
      }

      if (e.touches[1]) {
        var pos = r.projectIntoViewport(e.touches[1].clientX, e.touches[1].clientY);
        now[2] = pos[0];
        now[3] = pos[1];
      }

      if (e.touches[2]) {
        var pos = r.projectIntoViewport(e.touches[2].clientX, e.touches[2].clientY);
        now[4] = pos[0];
        now[5] = pos[1];
      }

      var startGPos = r.touchData.startGPosition;
      var isOverThresholdDrag;

      if (capture && e.touches[0] && startGPos) {
        var disp = [];

        for (var j = 0; j < now.length; j++) {
          disp[j] = now[j] - earlier[j];
        }

        var dx = e.touches[0].clientX - startGPos[0];
        var dx2 = dx * dx;
        var dy = e.touches[0].clientY - startGPos[1];
        var dy2 = dy * dy;
        var dist2 = dx2 + dy2;
        isOverThresholdDrag = dist2 >= r.touchTapThreshold2;
      } // context swipe cancelling


      if (capture && r.touchData.cxt) {
        e.preventDefault();
        var f1x2 = e.touches[0].clientX - offsetLeft,
            f1y2 = e.touches[0].clientY - offsetTop;
        var f2x2 = e.touches[1].clientX - offsetLeft,
            f2y2 = e.touches[1].clientY - offsetTop; // var distance2 = distance( f1x2, f1y2, f2x2, f2y2 );

        var distance2Sq = distanceSq(f1x2, f1y2, f2x2, f2y2);
        var factorSq = distance2Sq / distance1Sq;
        var distThreshold = 150;
        var distThresholdSq = distThreshold * distThreshold;
        var factorThreshold = 1.5;
        var factorThresholdSq = factorThreshold * factorThreshold; // cancel ctx gestures if the distance b/t the fingers increases

        if (factorSq >= factorThresholdSq || distance2Sq >= distThresholdSq) {
          r.touchData.cxt = false;
          r.data.bgActivePosistion = undefined;
          r.redrawHint('select', true);
          var cxtEvt = {
            originalEvent: e,
            type: 'cxttapend',
            position: {
              x: now[0],
              y: now[1]
            }
          };

          if (r.touchData.start) {
            r.touchData.start.unactivate().emit(cxtEvt);
            r.touchData.start = null;
          } else {
            cy.emit(cxtEvt);
          }
        }
      } // context swipe


      if (capture && r.touchData.cxt) {
        var cxtEvt = {
          originalEvent: e,
          type: 'cxtdrag',
          position: {
            x: now[0],
            y: now[1]
          }
        };
        r.data.bgActivePosistion = undefined;
        r.redrawHint('select', true);

        if (r.touchData.start) {
          r.touchData.start.emit(cxtEvt);
        } else {
          cy.emit(cxtEvt);
        }

        if (r.touchData.start) {
          r.touchData.start._private.grabbed = false;
        }

        r.touchData.cxtDragged = true;
        var near = r.findNearestElement(now[0], now[1], true, true);

        if (!r.touchData.cxtOver || near !== r.touchData.cxtOver) {
          if (r.touchData.cxtOver) {
            r.touchData.cxtOver.emit({
              originalEvent: e,
              type: 'cxtdragout',
              position: {
                x: now[0],
                y: now[1]
              }
            });
          }

          r.touchData.cxtOver = near;

          if (near) {
            near.emit({
              originalEvent: e,
              type: 'cxtdragover',
              position: {
                x: now[0],
                y: now[1]
              }
            });
          }
        } // box selection

      } else if (capture && e.touches[2] && cy.boxSelectionEnabled()) {
        e.preventDefault();
        r.data.bgActivePosistion = undefined;
        this.lastThreeTouch = +new Date();

        if (!r.touchData.selecting) {
          cy.emit({
            originalEvent: e,
            type: 'boxstart',
            position: {
              x: now[0],
              y: now[1]
            }
          });
        }

        r.touchData.selecting = true;
        r.touchData.didSelect = true;
        select[4] = 1;

        if (!select || select.length === 0 || select[0] === undefined) {
          select[0] = (now[0] + now[2] + now[4]) / 3;
          select[1] = (now[1] + now[3] + now[5]) / 3;
          select[2] = (now[0] + now[2] + now[4]) / 3 + 1;
          select[3] = (now[1] + now[3] + now[5]) / 3 + 1;
        } else {
          select[2] = (now[0] + now[2] + now[4]) / 3;
          select[3] = (now[1] + now[3] + now[5]) / 3;
        }

        r.redrawHint('select', true);
        r.redraw(); // pinch to zoom
      } else if (capture && e.touches[1] && !r.touchData.didSelect // don't allow box selection to degrade to pinch-to-zoom
      && cy.zoomingEnabled() && cy.panningEnabled() && cy.userZoomingEnabled() && cy.userPanningEnabled()) {
        // two fingers => pinch to zoom
        e.preventDefault();
        r.data.bgActivePosistion = undefined;
        r.redrawHint('select', true);
        var draggedEles = r.dragData.touchDragEles;

        if (draggedEles) {
          r.redrawHint('drag', true);

          for (var i = 0; i < draggedEles.length; i++) {
            var de_p = draggedEles[i]._private;
            de_p.grabbed = false;
            de_p.rscratch.inDragLayer = false;
          }
        }

        var _start = r.touchData.start; // (x2, y2) for fingers 1 and 2

        var f1x2 = e.touches[0].clientX - offsetLeft,
            f1y2 = e.touches[0].clientY - offsetTop;
        var f2x2 = e.touches[1].clientX - offsetLeft,
            f2y2 = e.touches[1].clientY - offsetTop;
        var distance2 = distance(f1x2, f1y2, f2x2, f2y2); // var distance2Sq = distanceSq( f1x2, f1y2, f2x2, f2y2 );
        // var factor = Math.sqrt( distance2Sq ) / Math.sqrt( distance1Sq );

        var factor = distance2 / distance1;

        if (twoFingersStartInside) {
          // delta finger1
          var df1x = f1x2 - f1x1;
          var df1y = f1y2 - f1y1; // delta finger 2

          var df2x = f2x2 - f2x1;
          var df2y = f2y2 - f2y1; // translation is the normalised vector of the two fingers movement
          // i.e. so pinching cancels out and moving together pans

          var tx = (df1x + df2x) / 2;
          var ty = (df1y + df2y) / 2; // now calculate the zoom

          var zoom1 = cy.zoom();
          var zoom2 = zoom1 * factor;
          var pan1 = cy.pan(); // the model center point converted to the current rendered pos

          var ctrx = modelCenter1[0] * zoom1 + pan1.x;
          var ctry = modelCenter1[1] * zoom1 + pan1.y;
          var pan2 = {
            x: -zoom2 / zoom1 * (ctrx - pan1.x - tx) + ctrx,
            y: -zoom2 / zoom1 * (ctry - pan1.y - ty) + ctry
          }; // remove dragged eles

          if (_start && _start.active()) {
            var draggedEles = r.dragData.touchDragEles;
            freeDraggedElements(draggedEles);
            r.redrawHint('drag', true);
            r.redrawHint('eles', true);

            _start.unactivate().emit('freeon');

            draggedEles.emit('free');

            if (r.dragData.didDrag) {
              _start.emit('dragfreeon');

              draggedEles.emit('dragfree');
            }
          }

          cy.viewport({
            zoom: zoom2,
            pan: pan2,
            cancelOnFailedZoom: true
          });
          distance1 = distance2;
          f1x1 = f1x2;
          f1y1 = f1y2;
          f2x1 = f2x2;
          f2y1 = f2y2;
          r.pinching = true;
        } // Re-project


        if (e.touches[0]) {
          var pos = r.projectIntoViewport(e.touches[0].clientX, e.touches[0].clientY);
          now[0] = pos[0];
          now[1] = pos[1];
        }

        if (e.touches[1]) {
          var pos = r.projectIntoViewport(e.touches[1].clientX, e.touches[1].clientY);
          now[2] = pos[0];
          now[3] = pos[1];
        }

        if (e.touches[2]) {
          var pos = r.projectIntoViewport(e.touches[2].clientX, e.touches[2].clientY);
          now[4] = pos[0];
          now[5] = pos[1];
        }
      } else if (e.touches[0] && !r.touchData.didSelect // don't allow box selection to degrade to single finger events like panning
      ) {
          var start = r.touchData.start;
          var last = r.touchData.last;
          var near;

          if (!r.hoverData.draggingEles && !r.swipePanning) {
            near = r.findNearestElement(now[0], now[1], true, true);
          }

          if (capture && start != null) {
            e.preventDefault();
          } // dragging nodes


          if (capture && start != null && r.nodeIsDraggable(start)) {
            if (isOverThresholdDrag) {
              // then dragging can happen
              var draggedEles = r.dragData.touchDragEles;
              var justStartedDrag = !r.dragData.didDrag;

              if (justStartedDrag) {
                addNodesToDrag(draggedEles, {
                  inDragLayer: true
                });
              }

              r.dragData.didDrag = true;
              var totalShift = {
                x: 0,
                y: 0
              };

              if (number(disp[0]) && number(disp[1])) {
                totalShift.x += disp[0];
                totalShift.y += disp[1];

                if (justStartedDrag) {
                  r.redrawHint('eles', true);
                  var dragDelta = r.touchData.dragDelta;

                  if (dragDelta && number(dragDelta[0]) && number(dragDelta[1])) {
                    totalShift.x += dragDelta[0];
                    totalShift.y += dragDelta[1];
                  }
                }
              }

              r.hoverData.draggingEles = true;
              draggedEles.silentShift(totalShift).emit('position drag');
              r.redrawHint('drag', true);

              if (r.touchData.startPosition[0] == earlier[0] && r.touchData.startPosition[1] == earlier[1]) {
                r.redrawHint('eles', true);
              }

              r.redraw();
            } else {
              // otherise keep track of drag delta for later
              var dragDelta = r.touchData.dragDelta = r.touchData.dragDelta || [];

              if (dragDelta.length === 0) {
                dragDelta.push(disp[0]);
                dragDelta.push(disp[1]);
              } else {
                dragDelta[0] += disp[0];
                dragDelta[1] += disp[1];
              }
            }
          } // touchmove


          {
            triggerEvents(start || near, ['touchmove', 'tapdrag', 'vmousemove'], e, {
              x: now[0],
              y: now[1]
            });

            if ((!start || !start.grabbed()) && near != last) {
              if (last) {
                last.emit({
                  originalEvent: e,
                  type: 'tapdragout',
                  position: {
                    x: now[0],
                    y: now[1]
                  }
                });
              }

              if (near) {
                near.emit({
                  originalEvent: e,
                  type: 'tapdragover',
                  position: {
                    x: now[0],
                    y: now[1]
                  }
                });
              }
            }

            r.touchData.last = near;
          } // check to cancel taphold

          if (capture) {
            for (var i = 0; i < now.length; i++) {
              if (now[i] && r.touchData.startPosition[i] && isOverThresholdDrag) {
                r.touchData.singleTouchMoved = true;
              }
            }
          } // panning


          if (capture && (start == null || start.pannable()) && cy.panningEnabled() && cy.userPanningEnabled()) {
            var allowPassthrough = allowPanningPassthrough(start, r.touchData.starts);

            if (allowPassthrough) {
              e.preventDefault();

              if (!r.data.bgActivePosistion) {
                r.data.bgActivePosistion = array2point(r.touchData.startPosition);
              }

              if (r.swipePanning) {
                cy.panBy({
                  x: disp[0] * zoom,
                  y: disp[1] * zoom
                });
              } else if (isOverThresholdDrag) {
                r.swipePanning = true;
                cy.panBy({
                  x: dx * zoom,
                  y: dy * zoom
                });

                if (start) {
                  start.unactivate();
                  r.redrawHint('select', true);
                  r.touchData.start = null;
                }
              }
            } // Re-project


            var pos = r.projectIntoViewport(e.touches[0].clientX, e.touches[0].clientY);
            now[0] = pos[0];
            now[1] = pos[1];
          }
        }

      for (var j = 0; j < now.length; j++) {
        earlier[j] = now[j];
      } // the active bg indicator should be removed when making a swipe that is neither for dragging nodes or panning


      if (capture && e.touches.length > 0 && !r.hoverData.draggingEles && !r.swipePanning && r.data.bgActivePosistion != null) {
        r.data.bgActivePosistion = undefined;
        r.redrawHint('select', true);
        r.redraw();
      }
    }, false);
    var touchcancelHandler;
    r.registerBinding(window, 'touchcancel', touchcancelHandler = function touchcancelHandler(e) {
      // eslint-disable-line no-unused-vars
      var start = r.touchData.start;
      r.touchData.capture = false;

      if (start) {
        start.unactivate();
      }
    });
    var touchendHandler;
    r.registerBinding(window, 'touchend', touchendHandler = function touchendHandler(e) {
      // eslint-disable-line no-unused-vars
      var start = r.touchData.start;
      var capture = r.touchData.capture;

      if (capture) {
        if (e.touches.length === 0) {
          r.touchData.capture = false;
        }

        e.preventDefault();
      } else {
        return;
      }

      var select = r.selection;
      r.swipePanning = false;
      r.hoverData.draggingEles = false;
      var cy = r.cy;
      var zoom = cy.zoom();
      var now = r.touchData.now;
      var earlier = r.touchData.earlier;

      if (e.touches[0]) {
        var pos = r.projectIntoViewport(e.touches[0].clientX, e.touches[0].clientY);
        now[0] = pos[0];
        now[1] = pos[1];
      }

      if (e.touches[1]) {
        var pos = r.projectIntoViewport(e.touches[1].clientX, e.touches[1].clientY);
        now[2] = pos[0];
        now[3] = pos[1];
      }

      if (e.touches[2]) {
        var pos = r.projectIntoViewport(e.touches[2].clientX, e.touches[2].clientY);
        now[4] = pos[0];
        now[5] = pos[1];
      }

      if (start) {
        start.unactivate();
      }

      var ctxTapend;

      if (r.touchData.cxt) {
        ctxTapend = {
          originalEvent: e,
          type: 'cxttapend',
          position: {
            x: now[0],
            y: now[1]
          }
        };

        if (start) {
          start.emit(ctxTapend);
        } else {
          cy.emit(ctxTapend);
        }

        if (!r.touchData.cxtDragged) {
          var ctxTap = {
            originalEvent: e,
            type: 'cxttap',
            position: {
              x: now[0],
              y: now[1]
            }
          };

          if (start) {
            start.emit(ctxTap);
          } else {
            cy.emit(ctxTap);
          }
        }

        if (r.touchData.start) {
          r.touchData.start._private.grabbed = false;
        }

        r.touchData.cxt = false;
        r.touchData.start = null;
        r.redraw();
        return;
      } // no more box selection if we don't have three fingers


      if (!e.touches[2] && cy.boxSelectionEnabled() && r.touchData.selecting) {
        r.touchData.selecting = false;
        var box = cy.collection(r.getAllInBox(select[0], select[1], select[2], select[3]));
        select[0] = undefined;
        select[1] = undefined;
        select[2] = undefined;
        select[3] = undefined;
        select[4] = 0;
        r.redrawHint('select', true);
        cy.emit({
          type: 'boxend',
          originalEvent: e,
          position: {
            x: now[0],
            y: now[1]
          }
        });

        var eleWouldBeSelected = function eleWouldBeSelected(ele) {
          return ele.selectable() && !ele.selected();
        };

        box.emit('box').stdFilter(eleWouldBeSelected).select().emit('boxselect');

        if (box.nonempty()) {
          r.redrawHint('eles', true);
        }

        r.redraw();
      }

      if (start != null) {
        start.unactivate();
      }

      if (e.touches[2]) {
        r.data.bgActivePosistion = undefined;
        r.redrawHint('select', true);
      } else if (e.touches[1]) ; else if (e.touches[0]) ; else if (!e.touches[0]) {
        r.data.bgActivePosistion = undefined;
        r.redrawHint('select', true);
        var draggedEles = r.dragData.touchDragEles;

        if (start != null) {
          var startWasGrabbed = start._private.grabbed;
          freeDraggedElements(draggedEles);
          r.redrawHint('drag', true);
          r.redrawHint('eles', true);

          if (startWasGrabbed) {
            start.emit('freeon');
            draggedEles.emit('free');

            if (r.dragData.didDrag) {
              start.emit('dragfreeon');
              draggedEles.emit('dragfree');
            }
          }

          triggerEvents(start, ['touchend', 'tapend', 'vmouseup', 'tapdragout'], e, {
            x: now[0],
            y: now[1]
          });
          start.unactivate();
          r.touchData.start = null;
        } else {
          var near = r.findNearestElement(now[0], now[1], true, true);
          triggerEvents(near, ['touchend', 'tapend', 'vmouseup', 'tapdragout'], e, {
            x: now[0],
            y: now[1]
          });
        }

        var dx = r.touchData.startPosition[0] - now[0];
        var dx2 = dx * dx;
        var dy = r.touchData.startPosition[1] - now[1];
        var dy2 = dy * dy;
        var dist2 = dx2 + dy2;
        var rdist2 = dist2 * zoom * zoom; // Tap event, roughly same as mouse click event for touch

        if (!r.touchData.singleTouchMoved) {
          if (!start) {
            cy.$(':selected').unselect(['tapunselect']);
          }

          triggerEvents(start, ['tap', 'vclick'], e, {
            x: now[0],
            y: now[1]
          });
        } // Prepare to select the currently touched node, only if it hasn't been dragged past a certain distance


        if (start != null && !r.dragData.didDrag // didn't drag nodes around
        && start._private.selectable && rdist2 < r.touchTapThreshold2 && !r.pinching // pinch to zoom should not affect selection
        ) {
            if (cy.selectionType() === 'single') {
              cy.$(isSelected).unmerge(start).unselect(['tapunselect']);
              start.select(['tapselect']);
            } else {
              if (start.selected()) {
                start.unselect(['tapunselect']);
              } else {
                start.select(['tapselect']);
              }
            }

            r.redrawHint('eles', true);
          }

        r.touchData.singleTouchMoved = true;
      }

      for (var j = 0; j < now.length; j++) {
        earlier[j] = now[j];
      }

      r.dragData.didDrag = false; // reset for next touchstart

      if (e.touches.length === 0) {
        r.touchData.dragDelta = [];
        r.touchData.startPosition = null;
        r.touchData.startGPosition = null;
        r.touchData.didSelect = false;
      }

      if (e.touches.length < 2) {
        if (e.touches.length === 1) {
          // the old start global pos'n may not be the same finger that remains
          r.touchData.startGPosition = [e.touches[0].clientX, e.touches[0].clientY];
        }

        r.pinching = false;
        r.redrawHint('eles', true);
        r.redraw();
      } //r.redraw();

    }, false); // fallback compatibility layer for ms pointer events

    if (typeof TouchEvent === 'undefined') {
      var pointers = [];

      var makeTouch = function makeTouch(e) {
        return {
          clientX: e.clientX,
          clientY: e.clientY,
          force: 1,
          identifier: e.pointerId,
          pageX: e.pageX,
          pageY: e.pageY,
          radiusX: e.width / 2,
          radiusY: e.height / 2,
          screenX: e.screenX,
          screenY: e.screenY,
          target: e.target
        };
      };

      var makePointer = function makePointer(e) {
        return {
          event: e,
          touch: makeTouch(e)
        };
      };

      var addPointer = function addPointer(e) {
        pointers.push(makePointer(e));
      };

      var removePointer = function removePointer(e) {
        for (var i = 0; i < pointers.length; i++) {
          var p = pointers[i];

          if (p.event.pointerId === e.pointerId) {
            pointers.splice(i, 1);
            return;
          }
        }
      };

      var updatePointer = function updatePointer(e) {
        var p = pointers.filter(function (p) {
          return p.event.pointerId === e.pointerId;
        })[0];
        p.event = e;
        p.touch = makeTouch(e);
      };

      var addTouchesToEvent = function addTouchesToEvent(e) {
        e.touches = pointers.map(function (p) {
          return p.touch;
        });
      };

      var pointerIsMouse = function pointerIsMouse(e) {
        return e.pointerType === 'mouse' || e.pointerType === 4;
      };

      r.registerBinding(r.container, 'pointerdown', function (e) {
        if (pointerIsMouse(e)) {
          return;
        } // mouse already handled


        e.preventDefault();
        addPointer(e);
        addTouchesToEvent(e);
        touchstartHandler(e);
      });
      r.registerBinding(r.container, 'pointerup', function (e) {
        if (pointerIsMouse(e)) {
          return;
        } // mouse already handled


        removePointer(e);
        addTouchesToEvent(e);
        touchendHandler(e);
      });
      r.registerBinding(r.container, 'pointercancel', function (e) {
        if (pointerIsMouse(e)) {
          return;
        } // mouse already handled


        removePointer(e);
        addTouchesToEvent(e);
        touchcancelHandler(e);
      });
      r.registerBinding(r.container, 'pointermove', function (e) {
        if (pointerIsMouse(e)) {
          return;
        } // mouse already handled


        e.preventDefault();
        updatePointer(e);
        addTouchesToEvent(e);
        touchmoveHandler(e);
      });
    }
  };

  var BRp$d = {};

  BRp$d.generatePolygon = function (name, points) {
    return this.nodeShapes[name] = {
      renderer: this,
      name: name,
      points: points,
      draw: function draw(context, centerX, centerY, width, height) {
        this.renderer.nodeShapeImpl('polygon', context, centerX, centerY, width, height, this.points);
      },
      intersectLine: function intersectLine(nodeX, nodeY, width, height, x, y, padding) {
        return polygonIntersectLine(x, y, this.points, nodeX, nodeY, width / 2, height / 2, padding);
      },
      checkPoint: function checkPoint(x, y, padding, width, height, centerX, centerY) {
        return pointInsidePolygon(x, y, this.points, centerX, centerY, width, height, [0, -1], padding);
      }
    };
  };

  BRp$d.generateEllipse = function () {
    return this.nodeShapes['ellipse'] = {
      renderer: this,
      name: 'ellipse',
      draw: function draw(context, centerX, centerY, width, height) {
        this.renderer.nodeShapeImpl(this.name, context, centerX, centerY, width, height);
      },
      intersectLine: function intersectLine(nodeX, nodeY, width, height, x, y, padding) {
        return intersectLineEllipse(x, y, nodeX, nodeY, width / 2 + padding, height / 2 + padding);
      },
      checkPoint: function checkPoint(x, y, padding, width, height, centerX, centerY) {
        return checkInEllipse(x, y, width, height, centerX, centerY, padding);
      }
    };
  };

  BRp$d.generateRoundPolygon = function (name, points) {
    // Pre-compute control points
    // Since these points depend on the radius length (which in turns depend on the width/height of the node) we will only pre-compute
    // the unit vectors.
    // For simplicity the layout will be:
    // [ p0, UnitVectorP0P1, p1, UniVectorP1P2, ..., pn, UnitVectorPnP0 ]
    var allPoints = new Array(points.length * 2);

    for (var i = 0; i < points.length / 2; i++) {
      var sourceIndex = i * 2;
      var destIndex = void 0;

      if (i < points.length / 2 - 1) {
        destIndex = (i + 1) * 2;
      } else {
        destIndex = 0;
      }

      allPoints[i * 4] = points[sourceIndex];
      allPoints[i * 4 + 1] = points[sourceIndex + 1];
      var xDest = points[destIndex] - points[sourceIndex];
      var yDest = points[destIndex + 1] - points[sourceIndex + 1];
      var norm = Math.sqrt(xDest * xDest + yDest * yDest);
      allPoints[i * 4 + 2] = xDest / norm;
      allPoints[i * 4 + 3] = yDest / norm;
    }

    return this.nodeShapes[name] = {
      renderer: this,
      name: name,
      points: allPoints,
      draw: function draw(context, centerX, centerY, width, height) {
        this.renderer.nodeShapeImpl('round-polygon', context, centerX, centerY, width, height, this.points);
      },
      intersectLine: function intersectLine(nodeX, nodeY, width, height, x, y, padding) {
        return roundPolygonIntersectLine(x, y, this.points, nodeX, nodeY, width, height);
      },
      checkPoint: function checkPoint(x, y, padding, width, height, centerX, centerY) {
        return pointInsideRoundPolygon(x, y, this.points, centerX, centerY, width, height);
      }
    };
  };

  BRp$d.generateRoundRectangle = function () {
    return this.nodeShapes['round-rectangle'] = this.nodeShapes['roundrectangle'] = {
      renderer: this,
      name: 'round-rectangle',
      points: generateUnitNgonPointsFitToSquare(4, 0),
      draw: function draw(context, centerX, centerY, width, height) {
        this.renderer.nodeShapeImpl(this.name, context, centerX, centerY, width, height);
      },
      intersectLine: function intersectLine(nodeX, nodeY, width, height, x, y, padding) {
        return roundRectangleIntersectLine(x, y, nodeX, nodeY, width, height, padding);
      },
      checkPoint: function checkPoint(x, y, padding, width, height, centerX, centerY) {
        var cornerRadius = getRoundRectangleRadius(width, height);
        var diam = cornerRadius * 2; // Check hBox

        if (pointInsidePolygon(x, y, this.points, centerX, centerY, width, height - diam, [0, -1], padding)) {
          return true;
        } // Check vBox


        if (pointInsidePolygon(x, y, this.points, centerX, centerY, width - diam, height, [0, -1], padding)) {
          return true;
        } // Check top left quarter circle


        if (checkInEllipse(x, y, diam, diam, centerX - width / 2 + cornerRadius, centerY - height / 2 + cornerRadius, padding)) {
          return true;
        } // Check top right quarter circle


        if (checkInEllipse(x, y, diam, diam, centerX + width / 2 - cornerRadius, centerY - height / 2 + cornerRadius, padding)) {
          return true;
        } // Check bottom right quarter circle


        if (checkInEllipse(x, y, diam, diam, centerX + width / 2 - cornerRadius, centerY + height / 2 - cornerRadius, padding)) {
          return true;
        } // Check bottom left quarter circle


        if (checkInEllipse(x, y, diam, diam, centerX - width / 2 + cornerRadius, centerY + height / 2 - cornerRadius, padding)) {
          return true;
        }

        return false;
      }
    };
  };

  BRp$d.generateCutRectangle = function () {
    return this.nodeShapes['cut-rectangle'] = this.nodeShapes['cutrectangle'] = {
      renderer: this,
      name: 'cut-rectangle',
      cornerLength: getCutRectangleCornerLength(),
      points: generateUnitNgonPointsFitToSquare(4, 0),
      draw: function draw(context, centerX, centerY, width, height) {
        this.renderer.nodeShapeImpl(this.name, context, centerX, centerY, width, height);
      },
      generateCutTrianglePts: function generateCutTrianglePts(width, height, centerX, centerY) {
        var cl = this.cornerLength;
        var hh = height / 2;
        var hw = width / 2;
        var xBegin = centerX - hw;
        var xEnd = centerX + hw;
        var yBegin = centerY - hh;
        var yEnd = centerY + hh; // points are in clockwise order, inner (imaginary) triangle pt on [4, 5]

        return {
          topLeft: [xBegin, yBegin + cl, xBegin + cl, yBegin, xBegin + cl, yBegin + cl],
          topRight: [xEnd - cl, yBegin, xEnd, yBegin + cl, xEnd - cl, yBegin + cl],
          bottomRight: [xEnd, yEnd - cl, xEnd - cl, yEnd, xEnd - cl, yEnd - cl],
          bottomLeft: [xBegin + cl, yEnd, xBegin, yEnd - cl, xBegin + cl, yEnd - cl]
        };
      },
      intersectLine: function intersectLine(nodeX, nodeY, width, height, x, y, padding) {
        var cPts = this.generateCutTrianglePts(width + 2 * padding, height + 2 * padding, nodeX, nodeY);
        var pts = [].concat.apply([], [cPts.topLeft.splice(0, 4), cPts.topRight.splice(0, 4), cPts.bottomRight.splice(0, 4), cPts.bottomLeft.splice(0, 4)]);
        return polygonIntersectLine(x, y, pts, nodeX, nodeY);
      },
      checkPoint: function checkPoint(x, y, padding, width, height, centerX, centerY) {
        // Check hBox
        if (pointInsidePolygon(x, y, this.points, centerX, centerY, width, height - 2 * this.cornerLength, [0, -1], padding)) {
          return true;
        } // Check vBox


        if (pointInsidePolygon(x, y, this.points, centerX, centerY, width - 2 * this.cornerLength, height, [0, -1], padding)) {
          return true;
        }

        var cutTrianglePts = this.generateCutTrianglePts(width, height, centerX, centerY);
        return pointInsidePolygonPoints(x, y, cutTrianglePts.topLeft) || pointInsidePolygonPoints(x, y, cutTrianglePts.topRight) || pointInsidePolygonPoints(x, y, cutTrianglePts.bottomRight) || pointInsidePolygonPoints(x, y, cutTrianglePts.bottomLeft);
      }
    };
  };

  BRp$d.generateBarrel = function () {
    return this.nodeShapes['barrel'] = {
      renderer: this,
      name: 'barrel',
      points: generateUnitNgonPointsFitToSquare(4, 0),
      draw: function draw(context, centerX, centerY, width, height) {
        this.renderer.nodeShapeImpl(this.name, context, centerX, centerY, width, height);
      },
      intersectLine: function intersectLine(nodeX, nodeY, width, height, x, y, padding) {
        // use two fixed t values for the bezier curve approximation
        var t0 = 0.15;
        var t1 = 0.5;
        var t2 = 0.85;
        var bPts = this.generateBarrelBezierPts(width + 2 * padding, height + 2 * padding, nodeX, nodeY);

        var approximateBarrelCurvePts = function approximateBarrelCurvePts(pts) {
          // approximate curve pts based on the two t values
          var m0 = qbezierPtAt({
            x: pts[0],
            y: pts[1]
          }, {
            x: pts[2],
            y: pts[3]
          }, {
            x: pts[4],
            y: pts[5]
          }, t0);
          var m1 = qbezierPtAt({
            x: pts[0],
            y: pts[1]
          }, {
            x: pts[2],
            y: pts[3]
          }, {
            x: pts[4],
            y: pts[5]
          }, t1);
          var m2 = qbezierPtAt({
            x: pts[0],
            y: pts[1]
          }, {
            x: pts[2],
            y: pts[3]
          }, {
            x: pts[4],
            y: pts[5]
          }, t2);
          return [pts[0], pts[1], m0.x, m0.y, m1.x, m1.y, m2.x, m2.y, pts[4], pts[5]];
        };

        var pts = [].concat(approximateBarrelCurvePts(bPts.topLeft), approximateBarrelCurvePts(bPts.topRight), approximateBarrelCurvePts(bPts.bottomRight), approximateBarrelCurvePts(bPts.bottomLeft));
        return polygonIntersectLine(x, y, pts, nodeX, nodeY);
      },
      generateBarrelBezierPts: function generateBarrelBezierPts(width, height, centerX, centerY) {
        var hh = height / 2;
        var hw = width / 2;
        var xBegin = centerX - hw;
        var xEnd = centerX + hw;
        var yBegin = centerY - hh;
        var yEnd = centerY + hh;
        var curveConstants = getBarrelCurveConstants(width, height);
        var hOffset = curveConstants.heightOffset;
        var wOffset = curveConstants.widthOffset;
        var ctrlPtXOffset = curveConstants.ctrlPtOffsetPct * width; // points are in clockwise order, inner (imaginary) control pt on [4, 5]

        var pts = {
          topLeft: [xBegin, yBegin + hOffset, xBegin + ctrlPtXOffset, yBegin, xBegin + wOffset, yBegin],
          topRight: [xEnd - wOffset, yBegin, xEnd - ctrlPtXOffset, yBegin, xEnd, yBegin + hOffset],
          bottomRight: [xEnd, yEnd - hOffset, xEnd - ctrlPtXOffset, yEnd, xEnd - wOffset, yEnd],
          bottomLeft: [xBegin + wOffset, yEnd, xBegin + ctrlPtXOffset, yEnd, xBegin, yEnd - hOffset]
        };
        pts.topLeft.isTop = true;
        pts.topRight.isTop = true;
        pts.bottomLeft.isBottom = true;
        pts.bottomRight.isBottom = true;
        return pts;
      },
      checkPoint: function checkPoint(x, y, padding, width, height, centerX, centerY) {
        var curveConstants = getBarrelCurveConstants(width, height);
        var hOffset = curveConstants.heightOffset;
        var wOffset = curveConstants.widthOffset; // Check hBox

        if (pointInsidePolygon(x, y, this.points, centerX, centerY, width, height - 2 * hOffset, [0, -1], padding)) {
          return true;
        } // Check vBox


        if (pointInsidePolygon(x, y, this.points, centerX, centerY, width - 2 * wOffset, height, [0, -1], padding)) {
          return true;
        }

        var barrelCurvePts = this.generateBarrelBezierPts(width, height, centerX, centerY);

        var getCurveT = function getCurveT(x, y, curvePts) {
          var x0 = curvePts[4];
          var x1 = curvePts[2];
          var x2 = curvePts[0];
          var y0 = curvePts[5]; // var y1 = curvePts[ 3 ];

          var y2 = curvePts[1];
          var xMin = Math.min(x0, x2);
          var xMax = Math.max(x0, x2);
          var yMin = Math.min(y0, y2);
          var yMax = Math.max(y0, y2);

          if (xMin <= x && x <= xMax && yMin <= y && y <= yMax) {
            var coeff = bezierPtsToQuadCoeff(x0, x1, x2);
            var roots = solveQuadratic(coeff[0], coeff[1], coeff[2], x);
            var validRoots = roots.filter(function (r) {
              return 0 <= r && r <= 1;
            });

            if (validRoots.length > 0) {
              return validRoots[0];
            }
          }

          return null;
        };

        var curveRegions = Object.keys(barrelCurvePts);

        for (var i = 0; i < curveRegions.length; i++) {
          var corner = curveRegions[i];
          var cornerPts = barrelCurvePts[corner];
          var t = getCurveT(x, y, cornerPts);

          if (t == null) {
            continue;
          }

          var y0 = cornerPts[5];
          var y1 = cornerPts[3];
          var y2 = cornerPts[1];
          var bezY = qbezierAt(y0, y1, y2, t);

          if (cornerPts.isTop && bezY <= y) {
            return true;
          }

          if (cornerPts.isBottom && y <= bezY) {
            return true;
          }
        }

        return false;
      }
    };
  };

  BRp$d.generateBottomRoundrectangle = function () {
    return this.nodeShapes['bottom-round-rectangle'] = this.nodeShapes['bottomroundrectangle'] = {
      renderer: this,
      name: 'bottom-round-rectangle',
      points: generateUnitNgonPointsFitToSquare(4, 0),
      draw: function draw(context, centerX, centerY, width, height) {
        this.renderer.nodeShapeImpl(this.name, context, centerX, centerY, width, height);
      },
      intersectLine: function intersectLine(nodeX, nodeY, width, height, x, y, padding) {
        var topStartX = nodeX - (width / 2 + padding);
        var topStartY = nodeY - (height / 2 + padding);
        var topEndY = topStartY;
        var topEndX = nodeX + (width / 2 + padding);
        var topIntersections = finiteLinesIntersect(x, y, nodeX, nodeY, topStartX, topStartY, topEndX, topEndY, false);

        if (topIntersections.length > 0) {
          return topIntersections;
        }

        return roundRectangleIntersectLine(x, y, nodeX, nodeY, width, height, padding);
      },
      checkPoint: function checkPoint(x, y, padding, width, height, centerX, centerY) {
        var cornerRadius = getRoundRectangleRadius(width, height);
        var diam = 2 * cornerRadius; // Check hBox

        if (pointInsidePolygon(x, y, this.points, centerX, centerY, width, height - diam, [0, -1], padding)) {
          return true;
        } // Check vBox


        if (pointInsidePolygon(x, y, this.points, centerX, centerY, width - diam, height, [0, -1], padding)) {
          return true;
        } // check non-rounded top side


        var outerWidth = width / 2 + 2 * padding;
        var outerHeight = height / 2 + 2 * padding;
        var points = [centerX - outerWidth, centerY - outerHeight, centerX - outerWidth, centerY, centerX + outerWidth, centerY, centerX + outerWidth, centerY - outerHeight];

        if (pointInsidePolygonPoints(x, y, points)) {
          return true;
        } // Check bottom right quarter circle


        if (checkInEllipse(x, y, diam, diam, centerX + width / 2 - cornerRadius, centerY + height / 2 - cornerRadius, padding)) {
          return true;
        } // Check bottom left quarter circle


        if (checkInEllipse(x, y, diam, diam, centerX - width / 2 + cornerRadius, centerY + height / 2 - cornerRadius, padding)) {
          return true;
        }

        return false;
      }
    };
  };

  BRp$d.registerNodeShapes = function () {
    var nodeShapes = this.nodeShapes = {};
    var renderer = this;
    this.generateEllipse();
    this.generatePolygon('triangle', generateUnitNgonPointsFitToSquare(3, 0));
    this.generateRoundPolygon('round-triangle', generateUnitNgonPointsFitToSquare(3, 0));
    this.generatePolygon('rectangle', generateUnitNgonPointsFitToSquare(4, 0));
    nodeShapes['square'] = nodeShapes['rectangle'];
    this.generateRoundRectangle();
    this.generateCutRectangle();
    this.generateBarrel();
    this.generateBottomRoundrectangle();
    {
      var diamondPoints = [0, 1, 1, 0, 0, -1, -1, 0];
      this.generatePolygon('diamond', diamondPoints);
      this.generateRoundPolygon('round-diamond', diamondPoints);
    }
    this.generatePolygon('pentagon', generateUnitNgonPointsFitToSquare(5, 0));
    this.generateRoundPolygon('round-pentagon', generateUnitNgonPointsFitToSquare(5, 0));
    this.generatePolygon('hexagon', generateUnitNgonPointsFitToSquare(6, 0));
    this.generateRoundPolygon('round-hexagon', generateUnitNgonPointsFitToSquare(6, 0));
    this.generatePolygon('heptagon', generateUnitNgonPointsFitToSquare(7, 0));
    this.generateRoundPolygon('round-heptagon', generateUnitNgonPointsFitToSquare(7, 0));
    this.generatePolygon('octagon', generateUnitNgonPointsFitToSquare(8, 0));
    this.generateRoundPolygon('round-octagon', generateUnitNgonPointsFitToSquare(8, 0));
    var star5Points = new Array(20);
    {
      var outerPoints = generateUnitNgonPoints(5, 0);
      var innerPoints = generateUnitNgonPoints(5, Math.PI / 5); // Outer radius is 1; inner radius of star is smaller

      var innerRadius = 0.5 * (3 - Math.sqrt(5));
      innerRadius *= 1.57;

      for (var i = 0; i < innerPoints.length / 2; i++) {
        innerPoints[i * 2] *= innerRadius;
        innerPoints[i * 2 + 1] *= innerRadius;
      }

      for (var i = 0; i < 20 / 4; i++) {
        star5Points[i * 4] = outerPoints[i * 2];
        star5Points[i * 4 + 1] = outerPoints[i * 2 + 1];
        star5Points[i * 4 + 2] = innerPoints[i * 2];
        star5Points[i * 4 + 3] = innerPoints[i * 2 + 1];
      }
    }
    star5Points = fitPolygonToSquare(star5Points);
    this.generatePolygon('star', star5Points);
    this.generatePolygon('vee', [-1, -1, 0, -0.333, 1, -1, 0, 1]);
    this.generatePolygon('rhomboid', [-1, -1, 0.333, -1, 1, 1, -0.333, 1]);
    this.nodeShapes['concavehexagon'] = this.generatePolygon('concave-hexagon', [-1, -0.95, -0.75, 0, -1, 0.95, 1, 0.95, 0.75, 0, 1, -0.95]);
    {
      var tagPoints = [-1, -1, 0.25, -1, 1, 0, 0.25, 1, -1, 1];
      this.generatePolygon('tag', tagPoints);
      this.generateRoundPolygon('round-tag', tagPoints);
    }

    nodeShapes.makePolygon = function (points) {
      // use caching on user-specified polygons so they are as fast as native shapes
      var key = points.join('$');
      var name = 'polygon-' + key;
      var shape;

      if (shape = this[name]) {
        // got cached shape
        return shape;
      } // create and cache new shape


      return renderer.generatePolygon(name, points);
    };
  };

  var BRp$e = {};

  BRp$e.timeToRender = function () {
    return this.redrawTotalTime / this.redrawCount;
  };

  BRp$e.redraw = function (options) {
    options = options || staticEmptyObject();
    var r = this;

    if (r.averageRedrawTime === undefined) {
      r.averageRedrawTime = 0;
    }

    if (r.lastRedrawTime === undefined) {
      r.lastRedrawTime = 0;
    }

    if (r.lastDrawTime === undefined) {
      r.lastDrawTime = 0;
    }

    r.requestedFrame = true;
    r.renderOptions = options;
  };

  BRp$e.beforeRender = function (fn, priority) {
    // the renderer can't add tick callbacks when destroyed
    if (this.destroyed) {
      return;
    }

    if (priority == null) {
      error('Priority is not optional for beforeRender');
    }

    var cbs = this.beforeRenderCallbacks;
    cbs.push({
      fn: fn,
      priority: priority
    }); // higher priority callbacks executed first

    cbs.sort(function (a, b) {
      return b.priority - a.priority;
    });
  };

  var beforeRenderCallbacks = function beforeRenderCallbacks(r, willDraw, startTime) {
    var cbs = r.beforeRenderCallbacks;

    for (var i = 0; i < cbs.length; i++) {
      cbs[i].fn(willDraw, startTime);
    }
  };

  BRp$e.startRenderLoop = function () {
    var r = this;
    var cy = r.cy;

    if (r.renderLoopStarted) {
      return;
    } else {
      r.renderLoopStarted = true;
    }

    var renderFn = function renderFn(requestTime) {
      if (r.destroyed) {
        return;
      }

      if (cy.batching()) ; else if (r.requestedFrame && !r.skipFrame) {
        beforeRenderCallbacks(r, true, requestTime);
        var startTime = performanceNow();
        r.render(r.renderOptions);
        var endTime = r.lastDrawTime = performanceNow();

        if (r.averageRedrawTime === undefined) {
          r.averageRedrawTime = endTime - startTime;
        }

        if (r.redrawCount === undefined) {
          r.redrawCount = 0;
        }

        r.redrawCount++;

        if (r.redrawTotalTime === undefined) {
          r.redrawTotalTime = 0;
        }

        var duration = endTime - startTime;
        r.redrawTotalTime += duration;
        r.lastRedrawTime = duration; // use a weighted average with a bias from the previous average so we don't spike so easily

        r.averageRedrawTime = r.averageRedrawTime / 2 + duration / 2;
        r.requestedFrame = false;
      } else {
        beforeRenderCallbacks(r, false, requestTime);
      }

      r.skipFrame = false;
      requestAnimationFrame(renderFn);
    };

    requestAnimationFrame(renderFn);
  };

  var BaseRenderer = function BaseRenderer(options) {
    this.init(options);
  };

  var BR = BaseRenderer;
  var BRp$f = BR.prototype;
  BRp$f.clientFunctions = ['redrawHint', 'render', 'renderTo', 'matchCanvasSize', 'nodeShapeImpl', 'arrowShapeImpl'];

  BRp$f.init = function (options) {
    var r = this;
    r.options = options;
    r.cy = options.cy;
    var ctr = r.container = options.cy.container(); // prepend a stylesheet in the head such that

    if (window$1) {
      var document = window$1.document;
      var head = document.head;
      var stylesheetId = '__________cytoscape_stylesheet';
      var className = '__________cytoscape_container';
      var stylesheetAlreadyExists = document.getElementById(stylesheetId) != null;

      if (ctr.className.indexOf(className) < 0) {
        ctr.className = (ctr.className || '') + ' ' + className;
      }

      if (!stylesheetAlreadyExists) {
        var stylesheet = document.createElement('style');
        stylesheet.id = stylesheetId;
        stylesheet.innerHTML = '.' + className + ' { position: relative; }';
        head.insertBefore(stylesheet, head.children[0]); // first so lowest priority
      }

      var computedStyle = window$1.getComputedStyle(ctr);
      var position = computedStyle.getPropertyValue('position');

      if (position === 'static') {
        warn('A Cytoscape container has style position:static and so can not use UI extensions properly');
      }
    }

    r.selection = [undefined, undefined, undefined, undefined, 0]; // Coordinates for selection box, plus enabled flag

    r.bezierProjPcts = [0.05, 0.225, 0.4, 0.5, 0.6, 0.775, 0.95]; //--Pointer-related data

    r.hoverData = {
      down: null,
      last: null,
      downTime: null,
      triggerMode: null,
      dragging: false,
      initialPan: [null, null],
      capture: false
    };
    r.dragData = {
      possibleDragElements: []
    };
    r.touchData = {
      start: null,
      capture: false,
      // These 3 fields related to tap, taphold events
      startPosition: [null, null, null, null, null, null],
      singleTouchStartTime: null,
      singleTouchMoved: true,
      now: [null, null, null, null, null, null],
      earlier: [null, null, null, null, null, null]
    };
    r.redraws = 0;
    r.showFps = options.showFps;
    r.debug = options.debug;
    r.hideEdgesOnViewport = options.hideEdgesOnViewport;
    r.textureOnViewport = options.textureOnViewport;
    r.wheelSensitivity = options.wheelSensitivity;
    r.motionBlurEnabled = options.motionBlur; // on by default

    r.forcedPixelRatio = number(options.pixelRatio) ? options.pixelRatio : null;
    r.motionBlur = options.motionBlur; // for initial kick off

    r.motionBlurOpacity = options.motionBlurOpacity;
    r.motionBlurTransparency = 1 - r.motionBlurOpacity;
    r.motionBlurPxRatio = 1;
    r.mbPxRBlurry = 1; //0.8;

    r.minMbLowQualFrames = 4;
    r.fullQualityMb = false;
    r.clearedForMotionBlur = [];
    r.desktopTapThreshold = options.desktopTapThreshold;
    r.desktopTapThreshold2 = options.desktopTapThreshold * options.desktopTapThreshold;
    r.touchTapThreshold = options.touchTapThreshold;
    r.touchTapThreshold2 = options.touchTapThreshold * options.touchTapThreshold;
    r.tapholdDuration = 500;
    r.bindings = [];
    r.beforeRenderCallbacks = [];
    r.beforeRenderPriorities = {
      // higher priority execs before lower one
      animations: 400,
      eleCalcs: 300,
      eleTxrDeq: 200,
      lyrTxrDeq: 150,
      lyrTxrSkip: 100
    };
    r.registerNodeShapes();
    r.registerArrowShapes();
    r.registerCalculationListeners();
  };

  BRp$f.notify = function (eventName, eles) {
    var r = this;
    var cy = r.cy; // the renderer can't be notified after it's destroyed

    if (this.destroyed) {
      return;
    }

    if (eventName === 'init') {
      r.load();
      return;
    }

    if (eventName === 'destroy') {
      r.destroy();
      return;
    }

    if (eventName === 'add' || eventName === 'remove' || eventName === 'move' && cy.hasCompoundNodes() || eventName === 'load' || eventName === 'zorder' || eventName === 'mount') {
      r.invalidateCachedZSortedEles();
    }

    if (eventName === 'viewport') {
      r.redrawHint('select', true);
    }

    if (eventName === 'load' || eventName === 'resize' || eventName === 'mount') {
      r.invalidateContainerClientCoordsCache();
      r.matchCanvasSize(r.container);
    }

    r.redrawHint('eles', true);
    r.redrawHint('drag', true);
    this.startRenderLoop();
    this.redraw();
  };

  BRp$f.destroy = function () {
    var r = this;
    r.destroyed = true;
    r.cy.stopAnimationLoop();

    for (var i = 0; i < r.bindings.length; i++) {
      var binding = r.bindings[i];
      var b = binding;
      var tgt = b.target;
      (tgt.off || tgt.removeEventListener).apply(tgt, b.args);
    }

    r.bindings = [];
    r.beforeRenderCallbacks = [];
    r.onUpdateEleCalcsFns = [];

    if (r.removeObserver) {
      r.removeObserver.disconnect();
    }

    if (r.styleObserver) {
      r.styleObserver.disconnect();
    }

    if (r.resizeObserver) {
      r.resizeObserver.disconnect();
    }

    if (r.labelCalcDiv) {
      try {
        document.body.removeChild(r.labelCalcDiv); // eslint-disable-line no-undef
      } catch (e) {// ie10 issue #1014
      }
    }
  };

  BRp$f.isHeadless = function () {
    return false;
  };

  [BRp, BRp$a, BRp$b, BRp$c, BRp$d, BRp$e].forEach(function (props) {
    extend(BRp$f, props);
  });

  var fullFpsTime = 1000 / 60; // assume 60 frames per second

  var defs = {
    setupDequeueing: function setupDequeueing(opts) {
      return function setupDequeueingImpl() {
        var self = this;
        var r = this.renderer;

        if (self.dequeueingSetup) {
          return;
        } else {
          self.dequeueingSetup = true;
        }

        var queueRedraw = lodash_debounce(function () {
          r.redrawHint('eles', true);
          r.redrawHint('drag', true);
          r.redraw();
        }, opts.deqRedrawThreshold);

        var dequeue = function dequeue(willDraw, frameStartTime) {
          var startTime = performanceNow();
          var avgRenderTime = r.averageRedrawTime;
          var renderTime = r.lastRedrawTime;
          var deqd = [];
          var extent = r.cy.extent();
          var pixelRatio = r.getPixelRatio(); // if we aren't in a tick that causes a draw, then the rendered style
          // queue won't automatically be flushed before dequeueing starts

          if (!willDraw) {
            r.flushRenderedStyleQueue();
          }

          while (true) {
            // eslint-disable-line no-constant-condition
            var now = performanceNow();
            var duration = now - startTime;
            var frameDuration = now - frameStartTime;

            if (renderTime < fullFpsTime) {
              // if we're rendering faster than the ideal fps, then do dequeueing
              // during all of the remaining frame time
              var timeAvailable = fullFpsTime - (willDraw ? avgRenderTime : 0);

              if (frameDuration >= opts.deqFastCost * timeAvailable) {
                break;
              }
            } else {
              if (willDraw) {
                if (duration >= opts.deqCost * renderTime || duration >= opts.deqAvgCost * avgRenderTime) {
                  break;
                }
              } else if (frameDuration >= opts.deqNoDrawCost * fullFpsTime) {
                break;
              }
            }

            var thisDeqd = opts.deq(self, pixelRatio, extent);

            if (thisDeqd.length > 0) {
              for (var i = 0; i < thisDeqd.length; i++) {
                deqd.push(thisDeqd[i]);
              }
            } else {
              break;
            }
          } // callbacks on dequeue


          if (deqd.length > 0) {
            opts.onDeqd(self, deqd);

            if (!willDraw && opts.shouldRedraw(self, deqd, pixelRatio, extent)) {
              queueRedraw();
            }
          }
        };

        var priority = opts.priority || noop;
        r.beforeRender(dequeue, priority(self));
      };
    }
  };

  // Uses keys so elements may share the same cache.

  var ElementTextureCacheLookup =
  /*#__PURE__*/
  function () {
    function ElementTextureCacheLookup(getKey) {
      var doesEleInvalidateKey = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : falsify;

      _classCallCheck(this, ElementTextureCacheLookup);

      this.idsByKey = new Map$1();
      this.keyForId = new Map$1();
      this.cachesByLvl = new Map$1();
      this.lvls = [];
      this.getKey = getKey;
      this.doesEleInvalidateKey = doesEleInvalidateKey;
    }

    _createClass(ElementTextureCacheLookup, [{
      key: "getIdsFor",
      value: function getIdsFor(key) {
        if (key == null) {
          error("Can not get id list for null key");
        }

        var idsByKey = this.idsByKey;
        var ids = this.idsByKey.get(key);

        if (!ids) {
          ids = new Set$1();
          idsByKey.set(key, ids);
        }

        return ids;
      }
    }, {
      key: "addIdForKey",
      value: function addIdForKey(key, id) {
        if (key != null) {
          this.getIdsFor(key).add(id);
        }
      }
    }, {
      key: "deleteIdForKey",
      value: function deleteIdForKey(key, id) {
        if (key != null) {
          this.getIdsFor(key)["delete"](id);
        }
      }
    }, {
      key: "getNumberOfIdsForKey",
      value: function getNumberOfIdsForKey(key) {
        if (key == null) {
          return 0;
        } else {
          return this.getIdsFor(key).size;
        }
      }
    }, {
      key: "updateKeyMappingFor",
      value: function updateKeyMappingFor(ele) {
        var id = ele.id();
        var prevKey = this.keyForId.get(id);
        var currKey = this.getKey(ele);
        this.deleteIdForKey(prevKey, id);
        this.addIdForKey(currKey, id);
        this.keyForId.set(id, currKey);
      }
    }, {
      key: "deleteKeyMappingFor",
      value: function deleteKeyMappingFor(ele) {
        var id = ele.id();
        var prevKey = this.keyForId.get(id);
        this.deleteIdForKey(prevKey, id);
        this.keyForId["delete"](id);
      }
    }, {
      key: "keyHasChangedFor",
      value: function keyHasChangedFor(ele) {
        var id = ele.id();
        var prevKey = this.keyForId.get(id);
        var newKey = this.getKey(ele);
        return prevKey !== newKey;
      }
    }, {
      key: "isInvalid",
      value: function isInvalid(ele) {
        return this.keyHasChangedFor(ele) || this.doesEleInvalidateKey(ele);
      }
    }, {
      key: "getCachesAt",
      value: function getCachesAt(lvl) {
        var cachesByLvl = this.cachesByLvl,
            lvls = this.lvls;
        var caches = cachesByLvl.get(lvl);

        if (!caches) {
          caches = new Map$1();
          cachesByLvl.set(lvl, caches);
          lvls.push(lvl);
        }

        return caches;
      }
    }, {
      key: "getCache",
      value: function getCache(key, lvl) {
        return this.getCachesAt(lvl).get(key);
      }
    }, {
      key: "get",
      value: function get(ele, lvl) {
        var key = this.getKey(ele);
        var cache = this.getCache(key, lvl); // getting for an element may need to add to the id list b/c eles can share keys

        if (cache != null) {
          this.updateKeyMappingFor(ele);
        }

        return cache;
      }
    }, {
      key: "getForCachedKey",
      value: function getForCachedKey(ele, lvl) {
        var key = this.keyForId.get(ele.id()); // n.b. use cached key, not newly computed key

        var cache = this.getCache(key, lvl);
        return cache;
      }
    }, {
      key: "hasCache",
      value: function hasCache(key, lvl) {
        return this.getCachesAt(lvl).has(key);
      }
    }, {
      key: "has",
      value: function has(ele, lvl) {
        var key = this.getKey(ele);
        return this.hasCache(key, lvl);
      }
    }, {
      key: "setCache",
      value: function setCache(key, lvl, cache) {
        cache.key = key;
        this.getCachesAt(lvl).set(key, cache);
      }
    }, {
      key: "set",
      value: function set(ele, lvl, cache) {
        var key = this.getKey(ele);
        this.setCache(key, lvl, cache);
        this.updateKeyMappingFor(ele);
      }
    }, {
      key: "deleteCache",
      value: function deleteCache(key, lvl) {
        this.getCachesAt(lvl)["delete"](key);
      }
    }, {
      key: "delete",
      value: function _delete(ele, lvl) {
        var key = this.getKey(ele);
        this.deleteCache(key, lvl);
      }
    }, {
      key: "invalidateKey",
      value: function invalidateKey(key) {
        var _this = this;

        this.lvls.forEach(function (lvl) {
          return _this.deleteCache(key, lvl);
        });
      } // returns true if no other eles reference the invalidated cache (n.b. other eles may need the cache with the same key)

    }, {
      key: "invalidate",
      value: function invalidate(ele) {
        var id = ele.id();
        var key = this.keyForId.get(id); // n.b. use stored key rather than current (potential key)

        this.deleteKeyMappingFor(ele);
        var entireKeyInvalidated = this.doesEleInvalidateKey(ele);

        if (entireKeyInvalidated) {
          // clear mapping for current key
          this.invalidateKey(key);
        }

        return entireKeyInvalidated || this.getNumberOfIdsForKey(key) === 0;
      }
    }]);

    return ElementTextureCacheLookup;
  }();

  var minTxrH = 25; // the size of the texture cache for small height eles (special case)

  var txrStepH = 50; // the min size of the regular cache, and the size it increases with each step up

  var minLvl = -4; // when scaling smaller than that we don't need to re-render

  var maxLvl = 3; // when larger than this scale just render directly (caching is not helpful)

  var maxZoom = 7.99; // beyond this zoom level, layered textures are not used

  var eleTxrSpacing = 8; // spacing between elements on textures to avoid blitting overlaps

  var defTxrWidth = 1024; // default/minimum texture width

  var maxTxrW = 1024; // the maximum width of a texture

  var maxTxrH = 1024; // the maximum height of a texture

  var minUtility = 0.2; // if usage of texture is less than this, it is retired

  var maxFullness = 0.8; // fullness of texture after which queue removal is checked

  var maxFullnessChecks = 10; // dequeued after this many checks

  var deqCost = 0.15; // % of add'l rendering cost allowed for dequeuing ele caches each frame

  var deqAvgCost = 0.1; // % of add'l rendering cost compared to average overall redraw time

  var deqNoDrawCost = 0.9; // % of avg frame time that can be used for dequeueing when not drawing

  var deqFastCost = 0.9; // % of frame time to be used when >60fps

  var deqRedrawThreshold = 100; // time to batch redraws together from dequeueing to allow more dequeueing calcs to happen in the meanwhile

  var maxDeqSize = 1; // number of eles to dequeue and render at higher texture in each batch

  var getTxrReasons = {
    dequeue: 'dequeue',
    downscale: 'downscale',
    highQuality: 'highQuality'
  };
  var initDefaults = defaults({
    getKey: null,
    doesEleInvalidateKey: falsify,
    drawElement: null,
    getBoundingBox: null,
    getRotationPoint: null,
    getRotationOffset: null,
    isVisible: trueify,
    allowEdgeTxrCaching: true,
    allowParentTxrCaching: true
  });

  var ElementTextureCache = function ElementTextureCache(renderer, initOptions) {
    var self = this;
    self.renderer = renderer;
    self.onDequeues = [];
    var opts = initDefaults(initOptions);
    extend(self, opts);
    self.lookup = new ElementTextureCacheLookup(opts.getKey, opts.doesEleInvalidateKey);
    self.setupDequeueing();
  };

  var ETCp = ElementTextureCache.prototype;
  ETCp.reasons = getTxrReasons; // the list of textures in which new subtextures for elements can be placed

  ETCp.getTextureQueue = function (txrH) {
    var self = this;
    self.eleImgCaches = self.eleImgCaches || {};
    return self.eleImgCaches[txrH] = self.eleImgCaches[txrH] || [];
  }; // the list of usused textures which can be recycled (in use in texture queue)


  ETCp.getRetiredTextureQueue = function (txrH) {
    var self = this;
    var rtxtrQs = self.eleImgCaches.retired = self.eleImgCaches.retired || {};
    var rtxtrQ = rtxtrQs[txrH] = rtxtrQs[txrH] || [];
    return rtxtrQ;
  }; // queue of element draw requests at different scale levels


  ETCp.getElementQueue = function () {
    var self = this;
    var q = self.eleCacheQueue = self.eleCacheQueue || new heap$1(function (a, b) {
      return b.reqs - a.reqs;
    });
    return q;
  }; // queue of element draw requests at different scale levels (element id lookup)


  ETCp.getElementKeyToQueue = function () {
    var self = this;
    var k2q = self.eleKeyToCacheQueue = self.eleKeyToCacheQueue || {};
    return k2q;
  };

  ETCp.getElement = function (ele, bb, pxRatio, lvl, reason) {
    var self = this;
    var r = this.renderer;
    var zoom = r.cy.zoom();
    var lookup = this.lookup;

    if (bb.w === 0 || bb.h === 0 || isNaN(bb.w) || isNaN(bb.h) || !ele.visible()) {
      return null;
    }

    if (!self.allowEdgeTxrCaching && ele.isEdge() || !self.allowParentTxrCaching && ele.isParent()) {
      return null;
    }

    if (lvl == null) {
      lvl = Math.ceil(log2(zoom * pxRatio));
    }

    if (lvl < minLvl) {
      lvl = minLvl;
    } else if (zoom >= maxZoom || lvl > maxLvl) {
      return null;
    }

    var scale = Math.pow(2, lvl);
    var eleScaledH = bb.h * scale;
    var eleScaledW = bb.w * scale;
    var scaledLabelShown = r.eleTextBiggerThanMin(ele, scale);

    if (!this.isVisible(ele, scaledLabelShown)) {
      return null;
    }

    var eleCache = lookup.get(ele, lvl); // if this get was on an unused/invalidated cache, then restore the texture usage metric

    if (eleCache && eleCache.invalidated) {
      eleCache.invalidated = false;
      eleCache.texture.invalidatedWidth -= eleCache.width;
    }

    if (eleCache) {
      return eleCache;
    }

    var txrH; // which texture height this ele belongs to

    if (eleScaledH <= minTxrH) {
      txrH = minTxrH;
    } else if (eleScaledH <= txrStepH) {
      txrH = txrStepH;
    } else {
      txrH = Math.ceil(eleScaledH / txrStepH) * txrStepH;
    }

    if (eleScaledH > maxTxrH || eleScaledW > maxTxrW) {
      return null; // caching large elements is not efficient
    }

    var txrQ = self.getTextureQueue(txrH); // first try the second last one in case it has space at the end

    var txr = txrQ[txrQ.length - 2];

    var addNewTxr = function addNewTxr() {
      return self.recycleTexture(txrH, eleScaledW) || self.addTexture(txrH, eleScaledW);
    }; // try the last one if there is no second last one


    if (!txr) {
      txr = txrQ[txrQ.length - 1];
    } // if the last one doesn't exist, we need a first one


    if (!txr) {
      txr = addNewTxr();
    } // if there's no room in the current texture, we need a new one


    if (txr.width - txr.usedWidth < eleScaledW) {
      txr = addNewTxr();
    }

    var scalableFrom = function scalableFrom(otherCache) {
      return otherCache && otherCache.scaledLabelShown === scaledLabelShown;
    };

    var deqing = reason && reason === getTxrReasons.dequeue;
    var highQualityReq = reason && reason === getTxrReasons.highQuality;
    var downscaleReq = reason && reason === getTxrReasons.downscale;
    var higherCache; // the nearest cache with a higher level

    for (var l = lvl + 1; l <= maxLvl; l++) {
      var c = lookup.get(ele, l);

      if (c) {
        higherCache = c;
        break;
      }
    }

    var oneUpCache = higherCache && higherCache.level === lvl + 1 ? higherCache : null;

    var downscale = function downscale() {
      txr.context.drawImage(oneUpCache.texture.canvas, oneUpCache.x, 0, oneUpCache.width, oneUpCache.height, txr.usedWidth, 0, eleScaledW, eleScaledH);
    }; // reset ele area in texture


    txr.context.setTransform(1, 0, 0, 1, 0, 0);
    txr.context.clearRect(txr.usedWidth, 0, eleScaledW, txrH);

    if (scalableFrom(oneUpCache)) {
      // then we can relatively cheaply rescale the existing image w/o rerendering
      downscale();
    } else if (scalableFrom(higherCache)) {
      // then use the higher cache for now and queue the next level down
      // to cheaply scale towards the smaller level
      if (highQualityReq) {
        for (var _l = higherCache.level; _l > lvl; _l--) {
          oneUpCache = self.getElement(ele, bb, pxRatio, _l, getTxrReasons.downscale);
        }

        downscale();
      } else {
        self.queueElement(ele, higherCache.level - 1);
        return higherCache;
      }
    } else {
      var lowerCache; // the nearest cache with a lower level

      if (!deqing && !highQualityReq && !downscaleReq) {
        for (var _l2 = lvl - 1; _l2 >= minLvl; _l2--) {
          var _c = lookup.get(ele, _l2);

          if (_c) {
            lowerCache = _c;
            break;
          }
        }
      }

      if (scalableFrom(lowerCache)) {
        // then use the lower quality cache for now and queue the better one for later
        self.queueElement(ele, lvl);
        return lowerCache;
      }

      txr.context.translate(txr.usedWidth, 0);
      txr.context.scale(scale, scale);
      this.drawElement(txr.context, ele, bb, scaledLabelShown, false);
      txr.context.scale(1 / scale, 1 / scale);
      txr.context.translate(-txr.usedWidth, 0);
    }

    eleCache = {
      x: txr.usedWidth,
      texture: txr,
      level: lvl,
      scale: scale,
      width: eleScaledW,
      height: eleScaledH,
      scaledLabelShown: scaledLabelShown
    };
    txr.usedWidth += Math.ceil(eleScaledW + eleTxrSpacing);
    txr.eleCaches.push(eleCache);
    lookup.set(ele, lvl, eleCache);
    self.checkTextureFullness(txr);
    return eleCache;
  };

  ETCp.invalidateElements = function (eles) {
    for (var i = 0; i < eles.length; i++) {
      this.invalidateElement(eles[i]);
    }
  };

  ETCp.invalidateElement = function (ele) {
    var self = this;
    var lookup = self.lookup;
    var caches = [];
    var invalid = lookup.isInvalid(ele);

    if (!invalid) {
      return; // override the invalidation request if the element key has not changed
    }

    for (var lvl = minLvl; lvl <= maxLvl; lvl++) {
      var cache = lookup.getForCachedKey(ele, lvl);

      if (cache) {
        caches.push(cache);
      }
    }

    var noOtherElesUseCache = lookup.invalidate(ele);

    if (noOtherElesUseCache) {
      for (var i = 0; i < caches.length; i++) {
        var _cache = caches[i];
        var txr = _cache.texture; // remove space from the texture it belongs to

        txr.invalidatedWidth += _cache.width; // mark the cache as invalidated

        _cache.invalidated = true; // retire the texture if its utility is low

        self.checkTextureUtility(txr);
      }
    } // remove from queue since the old req was for the old state


    self.removeFromQueue(ele);
  };

  ETCp.checkTextureUtility = function (txr) {
    // invalidate all entries in the cache if the cache size is small
    if (txr.invalidatedWidth >= minUtility * txr.width) {
      this.retireTexture(txr);
    }
  };

  ETCp.checkTextureFullness = function (txr) {
    // if texture has been mostly filled and passed over several times, remove
    // it from the queue so we don't need to waste time looking at it to put new things
    var self = this;
    var txrQ = self.getTextureQueue(txr.height);

    if (txr.usedWidth / txr.width > maxFullness && txr.fullnessChecks >= maxFullnessChecks) {
      removeFromArray(txrQ, txr);
    } else {
      txr.fullnessChecks++;
    }
  };

  ETCp.retireTexture = function (txr) {
    var self = this;
    var txrH = txr.height;
    var txrQ = self.getTextureQueue(txrH);
    var lookup = this.lookup; // retire the texture from the active / searchable queue:

    removeFromArray(txrQ, txr);
    txr.retired = true; // remove the refs from the eles to the caches:

    var eleCaches = txr.eleCaches;

    for (var i = 0; i < eleCaches.length; i++) {
      var eleCache = eleCaches[i];
      lookup.deleteCache(eleCache.key, eleCache.level);
    }

    clearArray(eleCaches); // add the texture to a retired queue so it can be recycled in future:

    var rtxtrQ = self.getRetiredTextureQueue(txrH);
    rtxtrQ.push(txr);
  };

  ETCp.addTexture = function (txrH, minW) {
    var self = this;
    var txrQ = self.getTextureQueue(txrH);
    var txr = {};
    txrQ.push(txr);
    txr.eleCaches = [];
    txr.height = txrH;
    txr.width = Math.max(defTxrWidth, minW);
    txr.usedWidth = 0;
    txr.invalidatedWidth = 0;
    txr.fullnessChecks = 0;
    txr.canvas = self.renderer.makeOffscreenCanvas(txr.width, txr.height);
    txr.context = txr.canvas.getContext('2d');
    return txr;
  };

  ETCp.recycleTexture = function (txrH, minW) {
    var self = this;
    var txrQ = self.getTextureQueue(txrH);
    var rtxtrQ = self.getRetiredTextureQueue(txrH);

    for (var i = 0; i < rtxtrQ.length; i++) {
      var txr = rtxtrQ[i];

      if (txr.width >= minW) {
        txr.retired = false;
        txr.usedWidth = 0;
        txr.invalidatedWidth = 0;
        txr.fullnessChecks = 0;
        clearArray(txr.eleCaches);
        txr.context.setTransform(1, 0, 0, 1, 0, 0);
        txr.context.clearRect(0, 0, txr.width, txr.height);
        removeFromArray(rtxtrQ, txr);
        txrQ.push(txr);
        return txr;
      }
    }
  };

  ETCp.queueElement = function (ele, lvl) {
    var self = this;
    var q = self.getElementQueue();
    var k2q = self.getElementKeyToQueue();
    var key = this.getKey(ele);
    var existingReq = k2q[key];

    if (existingReq) {
      // use the max lvl b/c in between lvls are cheap to make
      existingReq.level = Math.max(existingReq.level, lvl);
      existingReq.eles.merge(ele);
      existingReq.reqs++;
      q.updateItem(existingReq);
    } else {
      var req = {
        eles: ele.spawn().merge(ele),
        level: lvl,
        reqs: 1,
        key: key
      };
      q.push(req);
      k2q[key] = req;
    }
  };

  ETCp.dequeue = function (pxRatio
  /*, extent*/
  ) {
    var self = this;
    var q = self.getElementQueue();
    var k2q = self.getElementKeyToQueue();
    var dequeued = [];
    var lookup = self.lookup;

    for (var i = 0; i < maxDeqSize; i++) {
      if (q.size() > 0) {
        var req = q.pop();
        var key = req.key;
        var ele = req.eles[0]; // all eles have the same key

        var cacheExists = lookup.hasCache(ele, req.level); // clear out the key to req lookup

        k2q[key] = null; // dequeueing isn't necessary with an existing cache

        if (cacheExists) {
          continue;
        }

        dequeued.push(req);
        var bb = self.getBoundingBox(ele);
        self.getElement(ele, bb, pxRatio, req.level, getTxrReasons.dequeue);
      } else {
        break;
      }
    }

    return dequeued;
  };

  ETCp.removeFromQueue = function (ele) {
    var self = this;
    var q = self.getElementQueue();
    var k2q = self.getElementKeyToQueue();
    var key = this.getKey(ele);
    var req = k2q[key];

    if (req != null) {
      if (req.eles.length === 1) {
        // remove if last ele in the req
        // bring to front of queue
        req.reqs = MAX_INT;
        q.updateItem(req);
        q.pop(); // remove from queue

        k2q[key] = null; // remove from lookup map
      } else {
        // otherwise just remove ele from req
        req.eles.unmerge(ele);
      }
    }
  };

  ETCp.onDequeue = function (fn) {
    this.onDequeues.push(fn);
  };

  ETCp.offDequeue = function (fn) {
    removeFromArray(this.onDequeues, fn);
  };

  ETCp.setupDequeueing = defs.setupDequeueing({
    deqRedrawThreshold: deqRedrawThreshold,
    deqCost: deqCost,
    deqAvgCost: deqAvgCost,
    deqNoDrawCost: deqNoDrawCost,
    deqFastCost: deqFastCost,
    deq: function deq(self, pxRatio, extent) {
      return self.dequeue(pxRatio, extent);
    },
    onDeqd: function onDeqd(self, deqd) {
      for (var i = 0; i < self.onDequeues.length; i++) {
        var fn = self.onDequeues[i];
        fn(deqd);
      }
    },
    shouldRedraw: function shouldRedraw(self, deqd, pxRatio, extent) {
      for (var i = 0; i < deqd.length; i++) {
        var eles = deqd[i].eles;

        for (var j = 0; j < eles.length; j++) {
          var bb = eles[j].boundingBox();

          if (boundingBoxesIntersect(bb, extent)) {
            return true;
          }
        }
      }

      return false;
    },
    priority: function priority(self) {
      return self.renderer.beforeRenderPriorities.eleTxrDeq;
    }
  });

  var defNumLayers = 1; // default number of layers to use

  var minLvl$1 = -4; // when scaling smaller than that we don't need to re-render

  var maxLvl$1 = 2; // when larger than this scale just render directly (caching is not helpful)

  var maxZoom$1 = 3.99; // beyond this zoom level, layered textures are not used

  var deqRedrawThreshold$1 = 50; // time to batch redraws together from dequeueing to allow more dequeueing calcs to happen in the meanwhile

  var refineEleDebounceTime = 50; // time to debounce sharper ele texture updates

  var deqCost$1 = 0.15; // % of add'l rendering cost allowed for dequeuing ele caches each frame

  var deqAvgCost$1 = 0.1; // % of add'l rendering cost compared to average overall redraw time

  var deqNoDrawCost$1 = 0.9; // % of avg frame time that can be used for dequeueing when not drawing

  var deqFastCost$1 = 0.9; // % of frame time to be used when >60fps

  var maxDeqSize$1 = 1; // number of eles to dequeue and render at higher texture in each batch

  var invalidThreshold = 250; // time threshold for disabling b/c of invalidations

  var maxLayerArea = 4000 * 4000; // layers can't be bigger than this

  var useHighQualityEleTxrReqs = true; // whether to use high quality ele txr requests (generally faster and cheaper in the longterm)
  // var log = function(){ console.log.apply( console, arguments ); };

  var LayeredTextureCache = function LayeredTextureCache(renderer) {
    var self = this;
    var r = self.renderer = renderer;
    var cy = r.cy;
    self.layersByLevel = {}; // e.g. 2 => [ layer1, layer2, ..., layerN ]

    self.firstGet = true;
    self.lastInvalidationTime = performanceNow() - 2 * invalidThreshold;
    self.skipping = false;
    self.eleTxrDeqs = cy.collection();
    self.scheduleElementRefinement = lodash_debounce(function () {
      self.refineElementTextures(self.eleTxrDeqs);
      self.eleTxrDeqs.unmerge(self.eleTxrDeqs);
    }, refineEleDebounceTime);
    r.beforeRender(function (willDraw, now) {
      if (now - self.lastInvalidationTime <= invalidThreshold) {
        self.skipping = true;
      } else {
        self.skipping = false;
      }
    }, r.beforeRenderPriorities.lyrTxrSkip);

    var qSort = function qSort(a, b) {
      return b.reqs - a.reqs;
    };

    self.layersQueue = new heap$1(qSort);
    self.setupDequeueing();
  };

  var LTCp = LayeredTextureCache.prototype;
  var layerIdPool = 0;
  var MAX_INT$1 = Math.pow(2, 53) - 1;

  LTCp.makeLayer = function (bb, lvl) {
    var scale = Math.pow(2, lvl);
    var w = Math.ceil(bb.w * scale);
    var h = Math.ceil(bb.h * scale);
    var canvas = this.renderer.makeOffscreenCanvas(w, h);
    var layer = {
      id: layerIdPool = ++layerIdPool % MAX_INT$1,
      bb: bb,
      level: lvl,
      width: w,
      height: h,
      canvas: canvas,
      context: canvas.getContext('2d'),
      eles: [],
      elesQueue: [],
      reqs: 0
    }; // log('make layer %s with w %s and h %s and lvl %s', layer.id, layer.width, layer.height, layer.level);

    var cxt = layer.context;
    var dx = -layer.bb.x1;
    var dy = -layer.bb.y1; // do the transform on creation to save cycles (it's the same for all eles)

    cxt.scale(scale, scale);
    cxt.translate(dx, dy);
    return layer;
  };

  LTCp.getLayers = function (eles, pxRatio, lvl) {
    var self = this;
    var r = self.renderer;
    var cy = r.cy;
    var zoom = cy.zoom();
    var firstGet = self.firstGet;
    self.firstGet = false; // log('--\nget layers with %s eles', eles.length);
    //log eles.map(function(ele){ return ele.id() }) );

    if (lvl == null) {
      lvl = Math.ceil(log2(zoom * pxRatio));

      if (lvl < minLvl$1) {
        lvl = minLvl$1;
      } else if (zoom >= maxZoom$1 || lvl > maxLvl$1) {
        return null;
      }
    }

    self.validateLayersElesOrdering(lvl, eles);
    var layersByLvl = self.layersByLevel;
    var scale = Math.pow(2, lvl);
    var layers = layersByLvl[lvl] = layersByLvl[lvl] || [];
    var bb;
    var lvlComplete = self.levelIsComplete(lvl, eles);
    var tmpLayers;

    var checkTempLevels = function checkTempLevels() {
      var canUseAsTmpLvl = function canUseAsTmpLvl(l) {
        self.validateLayersElesOrdering(l, eles);

        if (self.levelIsComplete(l, eles)) {
          tmpLayers = layersByLvl[l];
          return true;
        }
      };

      var checkLvls = function checkLvls(dir) {
        if (tmpLayers) {
          return;
        }

        for (var l = lvl + dir; minLvl$1 <= l && l <= maxLvl$1; l += dir) {
          if (canUseAsTmpLvl(l)) {
            break;
          }
        }
      };

      checkLvls(+1);
      checkLvls(-1); // remove the invalid layers; they will be replaced as needed later in this function

      for (var i = layers.length - 1; i >= 0; i--) {
        var layer = layers[i];

        if (layer.invalid) {
          removeFromArray(layers, layer);
        }
      }
    };

    if (!lvlComplete) {
      // if the current level is incomplete, then use the closest, best quality layerset temporarily
      // and later queue the current layerset so we can get the proper quality level soon
      checkTempLevels();
    } else {
      // log('level complete, using existing layers\n--');
      return layers;
    }

    var getBb = function getBb() {
      if (!bb) {
        bb = makeBoundingBox();

        for (var i = 0; i < eles.length; i++) {
          updateBoundingBox(bb, eles[i].boundingBox());
        }
      }

      return bb;
    };

    var makeLayer = function makeLayer(opts) {
      opts = opts || {};
      var after = opts.after;
      getBb();
      var area = bb.w * scale * (bb.h * scale);

      if (area > maxLayerArea) {
        return null;
      }

      var layer = self.makeLayer(bb, lvl);

      if (after != null) {
        var index = layers.indexOf(after) + 1;
        layers.splice(index, 0, layer);
      } else if (opts.insert === undefined || opts.insert) {
        // no after specified => first layer made so put at start
        layers.unshift(layer);
      } // if( tmpLayers ){
      //self.queueLayer( layer );
      // }


      return layer;
    };

    if (self.skipping && !firstGet) {
      // log('skip layers');
      return null;
    } // log('do layers');


    var layer = null;
    var maxElesPerLayer = eles.length / defNumLayers;
    var allowLazyQueueing =  !firstGet;

    for (var i = 0; i < eles.length; i++) {
      var ele = eles[i];
      var rs = ele._private.rscratch;
      var caches = rs.imgLayerCaches = rs.imgLayerCaches || {}; // log('look at ele', ele.id());

      var existingLayer = caches[lvl];

      if (existingLayer) {
        // reuse layer for later eles
        // log('reuse layer for', ele.id());
        layer = existingLayer;
        continue;
      }

      if (!layer || layer.eles.length >= maxElesPerLayer || !boundingBoxInBoundingBox(layer.bb, ele.boundingBox())) {
        // log('make new layer for ele %s', ele.id());
        layer = makeLayer({
          insert: true,
          after: layer
        }); // if now layer can be built then we can't use layers at this level

        if (!layer) {
          return null;
        } // log('new layer with id %s', layer.id);

      }

      if (tmpLayers || allowLazyQueueing) {
        // log('queue ele %s in layer %s', ele.id(), layer.id);
        self.queueLayer(layer, ele);
      } else {
        // log('draw ele %s in layer %s', ele.id(), layer.id);
        self.drawEleInLayer(layer, ele, lvl, pxRatio);
      }

      layer.eles.push(ele);
      caches[lvl] = layer;
    } // log('--');


    if (tmpLayers) {
      // then we only queued the current layerset and can't draw it yet
      return tmpLayers;
    }

    if (allowLazyQueueing) {
      // log('lazy queue level', lvl);
      return null;
    }

    return layers;
  }; // a layer may want to use an ele cache of a higher level to avoid blurriness
  // so the layer level might not equal the ele level


  LTCp.getEleLevelForLayerLevel = function (lvl, pxRatio) {
    return lvl;
  };

  LTCp.drawEleInLayer = function (layer, ele, lvl, pxRatio) {
    var self = this;
    var r = this.renderer;
    var context = layer.context;
    var bb = ele.boundingBox();

    if (bb.w === 0 || bb.h === 0 || !ele.visible()) {
      return;
    }

    lvl = self.getEleLevelForLayerLevel(lvl, pxRatio);

    {
      r.setImgSmoothing(context, false);
    }

    {
      r.drawCachedElement(context, ele, null, null, lvl, useHighQualityEleTxrReqs);
    }

    {
      r.setImgSmoothing(context, true);
    }
  };

  LTCp.levelIsComplete = function (lvl, eles) {
    var self = this;
    var layers = self.layersByLevel[lvl];

    if (!layers || layers.length === 0) {
      return false;
    }

    var numElesInLayers = 0;

    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i]; // if there are any eles needed to be drawn yet, the level is not complete

      if (layer.reqs > 0) {
        return false;
      } // if the layer is invalid, the level is not complete


      if (layer.invalid) {
        return false;
      }

      numElesInLayers += layer.eles.length;
    } // we should have exactly the number of eles passed in to be complete


    if (numElesInLayers !== eles.length) {
      return false;
    }

    return true;
  };

  LTCp.validateLayersElesOrdering = function (lvl, eles) {
    var layers = this.layersByLevel[lvl];

    if (!layers) {
      return;
    } // if in a layer the eles are not in the same order, then the layer is invalid
    // (i.e. there is an ele in between the eles in the layer)


    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];
      var offset = -1; // find the offset

      for (var j = 0; j < eles.length; j++) {
        if (layer.eles[0] === eles[j]) {
          offset = j;
          break;
        }
      }

      if (offset < 0) {
        // then the layer has nonexistant elements and is invalid
        this.invalidateLayer(layer);
        continue;
      } // the eles in the layer must be in the same continuous order, else the layer is invalid


      var o = offset;

      for (var j = 0; j < layer.eles.length; j++) {
        if (layer.eles[j] !== eles[o + j]) {
          // log('invalidate based on ordering', layer.id);
          this.invalidateLayer(layer);
          break;
        }
      }
    }
  };

  LTCp.updateElementsInLayers = function (eles, update) {
    var self = this;
    var isEles = element(eles[0]); // collect udpated elements (cascaded from the layers) and update each
    // layer itself along the way

    for (var i = 0; i < eles.length; i++) {
      var req = isEles ? null : eles[i];
      var ele = isEles ? eles[i] : eles[i].ele;
      var rs = ele._private.rscratch;
      var caches = rs.imgLayerCaches = rs.imgLayerCaches || {};

      for (var l = minLvl$1; l <= maxLvl$1; l++) {
        var layer = caches[l];

        if (!layer) {
          continue;
        } // if update is a request from the ele cache, then it affects only
        // the matching level


        if (req && self.getEleLevelForLayerLevel(layer.level) !== req.level) {
          continue;
        }

        update(layer, ele, req);
      }
    }
  };

  LTCp.haveLayers = function () {
    var self = this;
    var haveLayers = false;

    for (var l = minLvl$1; l <= maxLvl$1; l++) {
      var layers = self.layersByLevel[l];

      if (layers && layers.length > 0) {
        haveLayers = true;
        break;
      }
    }

    return haveLayers;
  };

  LTCp.invalidateElements = function (eles) {
    var self = this;

    if (eles.length === 0) {
      return;
    }

    self.lastInvalidationTime = performanceNow(); // log('update invalidate layer time from eles');

    if (eles.length === 0 || !self.haveLayers()) {
      return;
    }

    self.updateElementsInLayers(eles, function invalAssocLayers(layer, ele, req) {
      self.invalidateLayer(layer);
    });
  };

  LTCp.invalidateLayer = function (layer) {
    // log('update invalidate layer time');
    this.lastInvalidationTime = performanceNow();

    if (layer.invalid) {
      return;
    } // save cycles


    var lvl = layer.level;
    var eles = layer.eles;
    var layers = this.layersByLevel[lvl]; // log('invalidate layer', layer.id );

    removeFromArray(layers, layer); // layer.eles = [];

    layer.elesQueue = [];
    layer.invalid = true;

    if (layer.replacement) {
      layer.replacement.invalid = true;
    }

    for (var i = 0; i < eles.length; i++) {
      var caches = eles[i]._private.rscratch.imgLayerCaches;

      if (caches) {
        caches[lvl] = null;
      }
    }
  };

  LTCp.refineElementTextures = function (eles) {
    var self = this; // log('refine', eles.length);

    self.updateElementsInLayers(eles, function refineEachEle(layer, ele, req) {
      var rLyr = layer.replacement;

      if (!rLyr) {
        rLyr = layer.replacement = self.makeLayer(layer.bb, layer.level);
        rLyr.replaces = layer;
        rLyr.eles = layer.eles; // log('make replacement layer %s for %s with level %s', rLyr.id, layer.id, rLyr.level);
      }

      if (!rLyr.reqs) {
        for (var i = 0; i < rLyr.eles.length; i++) {
          self.queueLayer(rLyr, rLyr.eles[i]);
        } // log('queue replacement layer refinement', rLyr.id);

      }
    });
  };

  LTCp.enqueueElementRefinement = function (ele) {

    this.eleTxrDeqs.merge(ele);
    this.scheduleElementRefinement();
  };

  LTCp.queueLayer = function (layer, ele) {
    var self = this;
    var q = self.layersQueue;
    var elesQ = layer.elesQueue;
    var hasId = elesQ.hasId = elesQ.hasId || {}; // if a layer is going to be replaced, queuing is a waste of time

    if (layer.replacement) {
      return;
    }

    if (ele) {
      if (hasId[ele.id()]) {
        return;
      }

      elesQ.push(ele);
      hasId[ele.id()] = true;
    }

    if (layer.reqs) {
      layer.reqs++;
      q.updateItem(layer);
    } else {
      layer.reqs = 1;
      q.push(layer);
    }
  };

  LTCp.dequeue = function (pxRatio) {
    var self = this;
    var q = self.layersQueue;
    var deqd = [];
    var eleDeqs = 0;

    while (eleDeqs < maxDeqSize$1) {
      if (q.size() === 0) {
        break;
      }

      var layer = q.peek(); // if a layer has been or will be replaced, then don't waste time with it

      if (layer.replacement) {
        // log('layer %s in queue skipped b/c it already has a replacement', layer.id);
        q.pop();
        continue;
      } // if this is a replacement layer that has been superceded, then forget it


      if (layer.replaces && layer !== layer.replaces.replacement) {
        // log('layer is no longer the most uptodate replacement; dequeued', layer.id)
        q.pop();
        continue;
      }

      if (layer.invalid) {
        // log('replacement layer %s is invalid; dequeued', layer.id);
        q.pop();
        continue;
      }

      var ele = layer.elesQueue.shift();

      if (ele) {
        // log('dequeue layer %s', layer.id);
        self.drawEleInLayer(layer, ele, layer.level, pxRatio);
        eleDeqs++;
      }

      if (deqd.length === 0) {
        // we need only one entry in deqd to queue redrawing etc
        deqd.push(true);
      } // if the layer has all its eles done, then remove from the queue


      if (layer.elesQueue.length === 0) {
        q.pop();
        layer.reqs = 0; // log('dequeue of layer %s complete', layer.id);
        // when a replacement layer is dequeued, it replaces the old layer in the level

        if (layer.replaces) {
          self.applyLayerReplacement(layer);
        }

        self.requestRedraw();
      }
    }

    return deqd;
  };

  LTCp.applyLayerReplacement = function (layer) {
    var self = this;
    var layersInLevel = self.layersByLevel[layer.level];
    var replaced = layer.replaces;
    var index = layersInLevel.indexOf(replaced); // if the replaced layer is not in the active list for the level, then replacing
    // refs would be a mistake (i.e. overwriting the true active layer)

    if (index < 0 || replaced.invalid) {
      // log('replacement layer would have no effect', layer.id);
      return;
    }

    layersInLevel[index] = layer; // replace level ref
    // replace refs in eles

    for (var i = 0; i < layer.eles.length; i++) {
      var _p = layer.eles[i]._private;
      var cache = _p.imgLayerCaches = _p.imgLayerCaches || {};

      if (cache) {
        cache[layer.level] = layer;
      }
    } // log('apply replacement layer %s over %s', layer.id, replaced.id);


    self.requestRedraw();
  };

  LTCp.requestRedraw = lodash_debounce(function () {
    var r = this.renderer;
    r.redrawHint('eles', true);
    r.redrawHint('drag', true);
    r.redraw();
  }, 100);
  LTCp.setupDequeueing = defs.setupDequeueing({
    deqRedrawThreshold: deqRedrawThreshold$1,
    deqCost: deqCost$1,
    deqAvgCost: deqAvgCost$1,
    deqNoDrawCost: deqNoDrawCost$1,
    deqFastCost: deqFastCost$1,
    deq: function deq(self, pxRatio) {
      return self.dequeue(pxRatio);
    },
    onDeqd: noop,
    shouldRedraw: trueify,
    priority: function priority(self) {
      return self.renderer.beforeRenderPriorities.lyrTxrDeq;
    }
  });

  var CRp = {};
  var impl;

  function polygon(context, points) {
    for (var i = 0; i < points.length; i++) {
      var pt = points[i];
      context.lineTo(pt.x, pt.y);
    }
  }

  function triangleBackcurve(context, points, controlPoint) {
    var firstPt;

    for (var i = 0; i < points.length; i++) {
      var pt = points[i];

      if (i === 0) {
        firstPt = pt;
      }

      context.lineTo(pt.x, pt.y);
    }

    context.quadraticCurveTo(controlPoint.x, controlPoint.y, firstPt.x, firstPt.y);
  }

  function triangleTee(context, trianglePoints, teePoints) {
    if (context.beginPath) {
      context.beginPath();
    }

    var triPts = trianglePoints;

    for (var i = 0; i < triPts.length; i++) {
      var pt = triPts[i];
      context.lineTo(pt.x, pt.y);
    }

    var teePts = teePoints;
    var firstTeePt = teePoints[0];
    context.moveTo(firstTeePt.x, firstTeePt.y);

    for (var i = 1; i < teePts.length; i++) {
      var pt = teePts[i];
      context.lineTo(pt.x, pt.y);
    }

    if (context.closePath) {
      context.closePath();
    }
  }

  function circleTriangle(context, trianglePoints, rx, ry, r) {
    if (context.beginPath) {
      context.beginPath();
    }

    context.arc(rx, ry, r, 0, Math.PI * 2, false);
    var triPts = trianglePoints;
    var firstTrPt = triPts[0];
    context.moveTo(firstTrPt.x, firstTrPt.y);

    for (var i = 0; i < triPts.length; i++) {
      var pt = triPts[i];
      context.lineTo(pt.x, pt.y);
    }

    if (context.closePath) {
      context.closePath();
    }
  }

  function circle(context, rx, ry, r) {
    context.arc(rx, ry, r, 0, Math.PI * 2, false);
  }

  CRp.arrowShapeImpl = function (name) {
    return (impl || (impl = {
      'polygon': polygon,
      'triangle-backcurve': triangleBackcurve,
      'triangle-tee': triangleTee,
      'circle-triangle': circleTriangle,
      'triangle-cross': triangleTee,
      'circle': circle
    }))[name];
  };

  var CRp$1 = {};

  CRp$1.drawElement = function (context, ele, shiftToOriginWithBb, showLabel, showOverlay, showOpacity) {
    var r = this;

    if (ele.isNode()) {
      r.drawNode(context, ele, shiftToOriginWithBb, showLabel, showOverlay, showOpacity);
    } else {
      r.drawEdge(context, ele, shiftToOriginWithBb, showLabel, showOverlay, showOpacity);
    }
  };

  CRp$1.drawElementOverlay = function (context, ele) {
    var r = this;

    if (ele.isNode()) {
      r.drawNodeOverlay(context, ele);
    } else {
      r.drawEdgeOverlay(context, ele);
    }
  };

  CRp$1.drawCachedElementPortion = function (context, ele, eleTxrCache, pxRatio, lvl, reason, getRotation, getOpacity) {
    var r = this;
    var bb = eleTxrCache.getBoundingBox(ele);

    if (bb.w === 0 || bb.h === 0) {
      return;
    } // ignore zero size case


    var eleCache = eleTxrCache.getElement(ele, bb, pxRatio, lvl, reason);

    if (eleCache != null) {
      var opacity = getOpacity(r, ele);

      if (opacity === 0) {
        return;
      }

      var theta = getRotation(r, ele);
      var x1 = bb.x1,
          y1 = bb.y1,
          w = bb.w,
          h = bb.h;
      var x, y, sx, sy, smooth;

      if (theta !== 0) {
        var rotPt = eleTxrCache.getRotationPoint(ele);
        sx = rotPt.x;
        sy = rotPt.y;
        context.translate(sx, sy);
        context.rotate(theta);
        smooth = r.getImgSmoothing(context);

        if (!smooth) {
          r.setImgSmoothing(context, true);
        }

        var off = eleTxrCache.getRotationOffset(ele);
        x = off.x;
        y = off.y;
      } else {
        x = x1;
        y = y1;
      }

      var oldGlobalAlpha;

      if (opacity !== 1) {
        oldGlobalAlpha = context.globalAlpha;
        context.globalAlpha = oldGlobalAlpha * opacity;
      }

      context.drawImage(eleCache.texture.canvas, eleCache.x, 0, eleCache.width, eleCache.height, x, y, w, h);

      if (opacity !== 1) {
        context.globalAlpha = oldGlobalAlpha;
      }

      if (theta !== 0) {
        context.rotate(-theta);
        context.translate(-sx, -sy);

        if (!smooth) {
          r.setImgSmoothing(context, false);
        }
      }
    } else {
      eleTxrCache.drawElement(context, ele); // direct draw fallback
    }
  };

  var getZeroRotation = function getZeroRotation() {
    return 0;
  };

  var getLabelRotation = function getLabelRotation(r, ele) {
    return r.getTextAngle(ele, null);
  };

  var getSourceLabelRotation = function getSourceLabelRotation(r, ele) {
    return r.getTextAngle(ele, 'source');
  };

  var getTargetLabelRotation = function getTargetLabelRotation(r, ele) {
    return r.getTextAngle(ele, 'target');
  };

  var getOpacity = function getOpacity(r, ele) {
    return ele.effectiveOpacity();
  };

  var getTextOpacity = function getTextOpacity(e, ele) {
    return ele.pstyle('text-opacity').pfValue * ele.effectiveOpacity();
  };

  CRp$1.drawCachedElement = function (context, ele, pxRatio, extent, lvl, requestHighQuality) {
    var r = this;
    var _r$data = r.data,
        eleTxrCache = _r$data.eleTxrCache,
        lblTxrCache = _r$data.lblTxrCache,
        slbTxrCache = _r$data.slbTxrCache,
        tlbTxrCache = _r$data.tlbTxrCache;
    var bb = ele.boundingBox();
    var reason = requestHighQuality === true ? eleTxrCache.reasons.highQuality : null;

    if (bb.w === 0 || bb.h === 0 || !ele.visible()) {
      return;
    }

    if (!extent || boundingBoxesIntersect(bb, extent)) {
      var isEdge = ele.isEdge();

      var badLine = ele.element()._private.rscratch.badLine;

      r.drawCachedElementPortion(context, ele, eleTxrCache, pxRatio, lvl, reason, getZeroRotation, getOpacity);

      if (!isEdge || !badLine) {
        r.drawCachedElementPortion(context, ele, lblTxrCache, pxRatio, lvl, reason, getLabelRotation, getTextOpacity);
      }

      if (isEdge && !badLine) {
        r.drawCachedElementPortion(context, ele, slbTxrCache, pxRatio, lvl, reason, getSourceLabelRotation, getTextOpacity);
        r.drawCachedElementPortion(context, ele, tlbTxrCache, pxRatio, lvl, reason, getTargetLabelRotation, getTextOpacity);
      }

      r.drawElementOverlay(context, ele);
    }
  };

  CRp$1.drawElements = function (context, eles) {
    var r = this;

    for (var i = 0; i < eles.length; i++) {
      var ele = eles[i];
      r.drawElement(context, ele);
    }
  };

  CRp$1.drawCachedElements = function (context, eles, pxRatio, extent) {
    var r = this;

    for (var i = 0; i < eles.length; i++) {
      var ele = eles[i];
      r.drawCachedElement(context, ele, pxRatio, extent);
    }
  };

  CRp$1.drawCachedNodes = function (context, eles, pxRatio, extent) {
    var r = this;

    for (var i = 0; i < eles.length; i++) {
      var ele = eles[i];

      if (!ele.isNode()) {
        continue;
      }

      r.drawCachedElement(context, ele, pxRatio, extent);
    }
  };

  CRp$1.drawLayeredElements = function (context, eles, pxRatio, extent) {
    var r = this;
    var layers = r.data.lyrTxrCache.getLayers(eles, pxRatio);

    if (layers) {
      for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];
        var bb = layer.bb;

        if (bb.w === 0 || bb.h === 0) {
          continue;
        }

        context.drawImage(layer.canvas, bb.x1, bb.y1, bb.w, bb.h);
      }
    } else {
      // fall back on plain caching if no layers
      r.drawCachedElements(context, eles, pxRatio, extent);
    }
  };

  /* global Path2D */
  var CRp$2 = {};

  CRp$2.drawEdge = function (context, edge, shiftToOriginWithBb) {
    var drawLabel = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;
    var shouldDrawOverlay = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : true;
    var shouldDrawOpacity = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : true;
    var r = this;
    var rs = edge._private.rscratch;

    if (shouldDrawOpacity && !edge.visible()) {
      return;
    } // if bezier ctrl pts can not be calculated, then die


    if (rs.badLine || rs.allpts == null || isNaN(rs.allpts[0])) {
      // isNaN in case edge is impossible and browser bugs (e.g. safari)
      return;
    }

    var bb;

    if (shiftToOriginWithBb) {
      bb = shiftToOriginWithBb;
      context.translate(-bb.x1, -bb.y1);
    }

    var opacity = shouldDrawOpacity ? edge.pstyle('opacity').value : 1;
    var lineStyle = edge.pstyle('line-style').value;
    var edgeWidth = edge.pstyle('width').pfValue;
    var lineCap = edge.pstyle('line-cap').value;

    var drawLine = function drawLine() {
      var strokeOpacity = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : opacity;
      context.lineWidth = edgeWidth;
      context.lineCap = lineCap;
      r.eleStrokeStyle(context, edge, strokeOpacity);
      r.drawEdgePath(edge, context, rs.allpts, lineStyle);
      context.lineCap = 'butt'; // reset for other drawing functions
    };

    var drawOverlay = function drawOverlay() {
      if (!shouldDrawOverlay) {
        return;
      }

      r.drawEdgeOverlay(context, edge);
    };

    var drawArrows = function drawArrows() {
      var arrowOpacity = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : opacity;
      r.drawArrowheads(context, edge, arrowOpacity);
    };

    var drawText = function drawText() {
      r.drawElementText(context, edge, null, drawLabel);
    };

    context.lineJoin = 'round';
    var ghost = edge.pstyle('ghost').value === 'yes';

    if (ghost) {
      var gx = edge.pstyle('ghost-offset-x').pfValue;
      var gy = edge.pstyle('ghost-offset-y').pfValue;
      var ghostOpacity = edge.pstyle('ghost-opacity').value;
      var effectiveGhostOpacity = opacity * ghostOpacity;
      context.translate(gx, gy);
      drawLine(effectiveGhostOpacity);
      drawArrows(effectiveGhostOpacity);
      context.translate(-gx, -gy);
    }

    drawLine();
    drawArrows();
    drawOverlay();
    drawText();

    if (shiftToOriginWithBb) {
      context.translate(bb.x1, bb.y1);
    }
  };

  CRp$2.drawEdgeOverlay = function (context, edge) {
    if (!edge.visible()) {
      return;
    }

    var overlayOpacity = edge.pstyle('overlay-opacity').value;

    if (overlayOpacity === 0) {
      return;
    }

    var r = this;
    var usePaths = r.usePaths();
    var rs = edge._private.rscratch;
    var overlayPadding = edge.pstyle('overlay-padding').pfValue;
    var overlayWidth = 2 * overlayPadding;
    var overlayColor = edge.pstyle('overlay-color').value;
    context.lineWidth = overlayWidth;

    if (rs.edgeType === 'self' && !usePaths) {
      context.lineCap = 'butt';
    } else {
      context.lineCap = 'round';
    }

    r.colorStrokeStyle(context, overlayColor[0], overlayColor[1], overlayColor[2], overlayOpacity);
    r.drawEdgePath(edge, context, rs.allpts, 'solid');
  };

  CRp$2.drawEdgePath = function (edge, context, pts, type) {
    var rs = edge._private.rscratch;
    var canvasCxt = context;
    var path;
    var pathCacheHit = false;
    var usePaths = this.usePaths();
    var lineDashPattern = edge.pstyle('line-dash-pattern').pfValue;
    var lineDashOffset = edge.pstyle('line-dash-offset').pfValue;

    if (usePaths) {
      var pathCacheKey = pts.join('$');
      var keyMatches = rs.pathCacheKey && rs.pathCacheKey === pathCacheKey;

      if (keyMatches) {
        path = context = rs.pathCache;
        pathCacheHit = true;
      } else {
        path = context = new Path2D();
        rs.pathCacheKey = pathCacheKey;
        rs.pathCache = path;
      }
    }

    if (canvasCxt.setLineDash) {
      // for very outofdate browsers
      switch (type) {
        case 'dotted':
          canvasCxt.setLineDash([1, 1]);
          break;

        case 'dashed':
          canvasCxt.setLineDash(lineDashPattern);
          canvasCxt.lineDashOffset = lineDashOffset;
          break;

        case 'solid':
          canvasCxt.setLineDash([]);
          break;
      }
    }

    if (!pathCacheHit && !rs.badLine) {
      if (context.beginPath) {
        context.beginPath();
      }

      context.moveTo(pts[0], pts[1]);

      switch (rs.edgeType) {
        case 'bezier':
        case 'self':
        case 'compound':
        case 'multibezier':
          for (var i = 2; i + 3 < pts.length; i += 4) {
            context.quadraticCurveTo(pts[i], pts[i + 1], pts[i + 2], pts[i + 3]);
          }

          break;

        case 'straight':
        case 'segments':
        case 'haystack':
          for (var _i = 2; _i + 1 < pts.length; _i += 2) {
            context.lineTo(pts[_i], pts[_i + 1]);
          }

          break;
      }
    }

    context = canvasCxt;

    if (usePaths) {
      context.stroke(path);
    } else {
      context.stroke();
    } // reset any line dashes


    if (context.setLineDash) {
      // for very outofdate browsers
      context.setLineDash([]);
    }
  };

  CRp$2.drawArrowheads = function (context, edge, opacity) {
    var rs = edge._private.rscratch;
    var isHaystack = rs.edgeType === 'haystack';

    if (!isHaystack) {
      this.drawArrowhead(context, edge, 'source', rs.arrowStartX, rs.arrowStartY, rs.srcArrowAngle, opacity);
    }

    this.drawArrowhead(context, edge, 'mid-target', rs.midX, rs.midY, rs.midtgtArrowAngle, opacity);
    this.drawArrowhead(context, edge, 'mid-source', rs.midX, rs.midY, rs.midsrcArrowAngle, opacity);

    if (!isHaystack) {
      this.drawArrowhead(context, edge, 'target', rs.arrowEndX, rs.arrowEndY, rs.tgtArrowAngle, opacity);
    }
  };

  CRp$2.drawArrowhead = function (context, edge, prefix, x, y, angle, opacity) {
    if (isNaN(x) || x == null || isNaN(y) || y == null || isNaN(angle) || angle == null) {
      return;
    }

    var self = this;
    var arrowShape = edge.pstyle(prefix + '-arrow-shape').value;

    if (arrowShape === 'none') {
      return;
    }

    var arrowClearFill = edge.pstyle(prefix + '-arrow-fill').value === 'hollow' ? 'both' : 'filled';
    var arrowFill = edge.pstyle(prefix + '-arrow-fill').value;
    var edgeWidth = edge.pstyle('width').pfValue;
    var edgeOpacity = edge.pstyle('opacity').value;

    if (opacity === undefined) {
      opacity = edgeOpacity;
    }

    var gco = context.globalCompositeOperation;

    if (opacity !== 1 || arrowFill === 'hollow') {
      // then extra clear is needed
      context.globalCompositeOperation = 'destination-out';
      self.colorFillStyle(context, 255, 255, 255, 1);
      self.colorStrokeStyle(context, 255, 255, 255, 1);
      self.drawArrowShape(edge, context, arrowClearFill, edgeWidth, arrowShape, x, y, angle);
      context.globalCompositeOperation = gco;
    } // otherwise, the opaque arrow clears it for free :)


    var color = edge.pstyle(prefix + '-arrow-color').value;
    self.colorFillStyle(context, color[0], color[1], color[2], opacity);
    self.colorStrokeStyle(context, color[0], color[1], color[2], opacity);
    self.drawArrowShape(edge, context, arrowFill, edgeWidth, arrowShape, x, y, angle);
  };

  CRp$2.drawArrowShape = function (edge, context, fill, edgeWidth, shape, x, y, angle) {
    var r = this;
    var usePaths = this.usePaths() && shape !== 'triangle-cross';
    var pathCacheHit = false;
    var path;
    var canvasContext = context;
    var translation = {
      x: x,
      y: y
    };
    var scale = edge.pstyle('arrow-scale').value;
    var size = this.getArrowWidth(edgeWidth, scale);
    var shapeImpl = r.arrowShapes[shape];

    if (usePaths) {
      var cache = r.arrowPathCache = r.arrowPathCache || [];
      var key = hashString(shape);
      var cachedPath = cache[key];

      if (cachedPath != null) {
        path = context = cachedPath;
        pathCacheHit = true;
      } else {
        path = context = new Path2D();
        cache[key] = path;
      }
    }

    if (!pathCacheHit) {
      if (context.beginPath) {
        context.beginPath();
      }

      if (usePaths) {
        // store in the path cache with values easily manipulated later
        shapeImpl.draw(context, 1, 0, {
          x: 0,
          y: 0
        }, 1);
      } else {
        shapeImpl.draw(context, size, angle, translation, edgeWidth);
      }

      if (context.closePath) {
        context.closePath();
      }
    }

    context = canvasContext;

    if (usePaths) {
      // set transform to arrow position/orientation
      context.translate(x, y);
      context.rotate(angle);
      context.scale(size, size);
    }

    if (fill === 'filled' || fill === 'both') {
      if (usePaths) {
        context.fill(path);
      } else {
        context.fill();
      }
    }

    if (fill === 'hollow' || fill === 'both') {
      context.lineWidth = (shapeImpl.matchEdgeWidth ? edgeWidth : 1) / (usePaths ? size : 1);
      context.lineJoin = 'miter';

      if (usePaths) {
        context.stroke(path);
      } else {
        context.stroke();
      }
    }

    if (usePaths) {
      // reset transform by applying inverse
      context.scale(1 / size, 1 / size);
      context.rotate(-angle);
      context.translate(-x, -y);
    }
  };

  var CRp$3 = {};

  CRp$3.safeDrawImage = function (context, img, ix, iy, iw, ih, x, y, w, h) {
    // detect problematic cases for old browsers with bad images (cheaper than try-catch)
    if (iw <= 0 || ih <= 0 || w <= 0 || h <= 0) {
      return;
    }

    context.drawImage(img, ix, iy, iw, ih, x, y, w, h);
  };

  CRp$3.drawInscribedImage = function (context, img, node, index, nodeOpacity) {
    var r = this;
    var pos = node.position();
    var nodeX = pos.x;
    var nodeY = pos.y;
    var styleObj = node.cy().style();
    var getIndexedStyle = styleObj.getIndexedStyle.bind(styleObj);
    var fit = getIndexedStyle(node, 'background-fit', 'value', index);
    var repeat = getIndexedStyle(node, 'background-repeat', 'value', index);
    var nodeW = node.width();
    var nodeH = node.height();
    var paddingX2 = node.padding() * 2;
    var nodeTW = nodeW + (getIndexedStyle(node, 'background-width-relative-to', 'value', index) === 'inner' ? 0 : paddingX2);
    var nodeTH = nodeH + (getIndexedStyle(node, 'background-height-relative-to', 'value', index) === 'inner' ? 0 : paddingX2);
    var rs = node._private.rscratch;
    var clip = getIndexedStyle(node, 'background-clip', 'value', index);
    var shouldClip = clip === 'node';
    var imgOpacity = getIndexedStyle(node, 'background-image-opacity', 'value', index) * nodeOpacity;
    var imgW = img.width || img.cachedW;
    var imgH = img.height || img.cachedH; // workaround for broken browsers like ie

    if (null == imgW || null == imgH) {
      document.body.appendChild(img); // eslint-disable-line no-undef

      imgW = img.cachedW = img.width || img.offsetWidth;
      imgH = img.cachedH = img.height || img.offsetHeight;
      document.body.removeChild(img); // eslint-disable-line no-undef
    }

    var w = imgW;
    var h = imgH;

    if (getIndexedStyle(node, 'background-width', 'value', index) !== 'auto') {
      if (getIndexedStyle(node, 'background-width', 'units', index) === '%') {
        w = getIndexedStyle(node, 'background-width', 'pfValue', index) * nodeTW;
      } else {
        w = getIndexedStyle(node, 'background-width', 'pfValue', index);
      }
    }

    if (getIndexedStyle(node, 'background-height', 'value', index) !== 'auto') {
      if (getIndexedStyle(node, 'background-height', 'units', index) === '%') {
        h = getIndexedStyle(node, 'background-height', 'pfValue', index) * nodeTH;
      } else {
        h = getIndexedStyle(node, 'background-height', 'pfValue', index);
      }
    }

    if (w === 0 || h === 0) {
      return; // no point in drawing empty image (and chrome is broken in this case)
    }

    if (fit === 'contain') {
      var scale = Math.min(nodeTW / w, nodeTH / h);
      w *= scale;
      h *= scale;
    } else if (fit === 'cover') {
      var scale = Math.max(nodeTW / w, nodeTH / h);
      w *= scale;
      h *= scale;
    }

    var x = nodeX - nodeTW / 2; // left

    var posXUnits = getIndexedStyle(node, 'background-position-x', 'units', index);
    var posXPfVal = getIndexedStyle(node, 'background-position-x', 'pfValue', index);

    if (posXUnits === '%') {
      x += (nodeTW - w) * posXPfVal;
    } else {
      x += posXPfVal;
    }

    var offXUnits = getIndexedStyle(node, 'background-offset-x', 'units', index);
    var offXPfVal = getIndexedStyle(node, 'background-offset-x', 'pfValue', index);

    if (offXUnits === '%') {
      x += (nodeTW - w) * offXPfVal;
    } else {
      x += offXPfVal;
    }

    var y = nodeY - nodeTH / 2; // top

    var posYUnits = getIndexedStyle(node, 'background-position-y', 'units', index);
    var posYPfVal = getIndexedStyle(node, 'background-position-y', 'pfValue', index);

    if (posYUnits === '%') {
      y += (nodeTH - h) * posYPfVal;
    } else {
      y += posYPfVal;
    }

    var offYUnits = getIndexedStyle(node, 'background-offset-y', 'units', index);
    var offYPfVal = getIndexedStyle(node, 'background-offset-y', 'pfValue', index);

    if (offYUnits === '%') {
      y += (nodeTH - h) * offYPfVal;
    } else {
      y += offYPfVal;
    }

    if (rs.pathCache) {
      x -= nodeX;
      y -= nodeY;
      nodeX = 0;
      nodeY = 0;
    }

    var gAlpha = context.globalAlpha;
    context.globalAlpha = imgOpacity;

    if (repeat === 'no-repeat') {
      if (shouldClip) {
        context.save();

        if (rs.pathCache) {
          context.clip(rs.pathCache);
        } else {
          r.nodeShapes[r.getNodeShape(node)].draw(context, nodeX, nodeY, nodeTW, nodeTH);
          context.clip();
        }
      }

      r.safeDrawImage(context, img, 0, 0, imgW, imgH, x, y, w, h);

      if (shouldClip) {
        context.restore();
      }
    } else {
      var pattern = context.createPattern(img, repeat);
      context.fillStyle = pattern;
      r.nodeShapes[r.getNodeShape(node)].draw(context, nodeX, nodeY, nodeTW, nodeTH);
      context.translate(x, y);
      context.fill();
      context.translate(-x, -y);
    }

    context.globalAlpha = gAlpha;
  };

  var CRp$4 = {};

  CRp$4.eleTextBiggerThanMin = function (ele, scale) {
    if (!scale) {
      var zoom = ele.cy().zoom();
      var pxRatio = this.getPixelRatio();
      var lvl = Math.ceil(log2(zoom * pxRatio)); // the effective texture level

      scale = Math.pow(2, lvl);
    }

    var computedSize = ele.pstyle('font-size').pfValue * scale;
    var minSize = ele.pstyle('min-zoomed-font-size').pfValue;

    if (computedSize < minSize) {
      return false;
    }

    return true;
  };

  CRp$4.drawElementText = function (context, ele, shiftToOriginWithBb, force, prefix) {
    var useEleOpacity = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : true;
    var r = this;

    if (force == null) {
      if (useEleOpacity && !r.eleTextBiggerThanMin(ele)) {
        return;
      }
    } else if (force === false) {
      return;
    }

    if (ele.isNode()) {
      var label = ele.pstyle('label');

      if (!label || !label.value) {
        return;
      }

      var justification = r.getLabelJustification(ele);
      context.textAlign = justification;
      context.textBaseline = 'bottom';
    } else {
      var badLine = ele.element()._private.rscratch.badLine;

      var _label = ele.pstyle('label');

      var srcLabel = ele.pstyle('source-label');
      var tgtLabel = ele.pstyle('target-label');

      if (badLine || (!_label || !_label.value) && (!srcLabel || !srcLabel.value) && (!tgtLabel || !tgtLabel.value)) {
        return;
      }

      context.textAlign = 'center';
      context.textBaseline = 'bottom';
    }

    var applyRotation = !shiftToOriginWithBb;
    var bb;

    if (shiftToOriginWithBb) {
      bb = shiftToOriginWithBb;
      context.translate(-bb.x1, -bb.y1);
    }

    if (prefix == null) {
      r.drawText(context, ele, null, applyRotation, useEleOpacity);

      if (ele.isEdge()) {
        r.drawText(context, ele, 'source', applyRotation, useEleOpacity);
        r.drawText(context, ele, 'target', applyRotation, useEleOpacity);
      }
    } else {
      r.drawText(context, ele, prefix, applyRotation, useEleOpacity);
    }

    if (shiftToOriginWithBb) {
      context.translate(bb.x1, bb.y1);
    }
  };

  CRp$4.getFontCache = function (context) {
    var cache;
    this.fontCaches = this.fontCaches || [];

    for (var i = 0; i < this.fontCaches.length; i++) {
      cache = this.fontCaches[i];

      if (cache.context === context) {
        return cache;
      }
    }

    cache = {
      context: context
    };
    this.fontCaches.push(cache);
    return cache;
  }; // set up canvas context with font
  // returns transformed text string


  CRp$4.setupTextStyle = function (context, ele) {
    var useEleOpacity = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
    // Font style
    var labelStyle = ele.pstyle('font-style').strValue;
    var labelSize = ele.pstyle('font-size').pfValue + 'px';
    var labelFamily = ele.pstyle('font-family').strValue;
    var labelWeight = ele.pstyle('font-weight').strValue;
    var opacity = useEleOpacity ? ele.effectiveOpacity() * ele.pstyle('text-opacity').value : 1;
    var outlineOpacity = ele.pstyle('text-outline-opacity').value * opacity;
    var color = ele.pstyle('color').value;
    var outlineColor = ele.pstyle('text-outline-color').value;
    context.font = labelStyle + ' ' + labelWeight + ' ' + labelSize + ' ' + labelFamily;
    context.lineJoin = 'round'; // so text outlines aren't jagged

    this.colorFillStyle(context, color[0], color[1], color[2], opacity);
    this.colorStrokeStyle(context, outlineColor[0], outlineColor[1], outlineColor[2], outlineOpacity);
  }; // TODO ensure re-used


  function roundRect(ctx, x, y, width, height) {
    var radius = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : 5;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  CRp$4.getTextAngle = function (ele, prefix) {
    var theta;
    var _p = ele._private;
    var rscratch = _p.rscratch;
    var pdash = prefix ? prefix + '-' : '';
    var rotation = ele.pstyle(pdash + 'text-rotation');
    var textAngle = getPrefixedProperty(rscratch, 'labelAngle', prefix);

    if (rotation.strValue === 'autorotate') {
      theta = ele.isEdge() ? textAngle : 0;
    } else if (rotation.strValue === 'none') {
      theta = 0;
    } else {
      theta = rotation.pfValue;
    }

    return theta;
  };

  CRp$4.drawText = function (context, ele, prefix) {
    var applyRotation = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;
    var useEleOpacity = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : true;
    var _p = ele._private;
    var rscratch = _p.rscratch;
    var parentOpacity = useEleOpacity ? ele.effectiveOpacity() : 1;

    if (useEleOpacity && (parentOpacity === 0 || ele.pstyle('text-opacity').value === 0)) {
      return;
    } // use 'main' as an alias for the main label (i.e. null prefix)


    if (prefix === 'main') {
      prefix = null;
    }

    var textX = getPrefixedProperty(rscratch, 'labelX', prefix);
    var textY = getPrefixedProperty(rscratch, 'labelY', prefix);
    var orgTextX, orgTextY; // used for rotation

    var text = this.getLabelText(ele, prefix);

    if (text != null && text !== '' && !isNaN(textX) && !isNaN(textY)) {
      this.setupTextStyle(context, ele, useEleOpacity);
      var pdash = prefix ? prefix + '-' : '';
      var textW = getPrefixedProperty(rscratch, 'labelWidth', prefix);
      var textH = getPrefixedProperty(rscratch, 'labelHeight', prefix);
      var marginX = ele.pstyle(pdash + 'text-margin-x').pfValue;
      var marginY = ele.pstyle(pdash + 'text-margin-y').pfValue;
      var isEdge = ele.isEdge();
      var halign = ele.pstyle('text-halign').value;
      var valign = ele.pstyle('text-valign').value;

      if (isEdge) {
        halign = 'center';
        valign = 'center';
      }

      textX += marginX;
      textY += marginY;
      var theta;

      if (!applyRotation) {
        theta = 0;
      } else {
        theta = this.getTextAngle(ele, prefix);
      }

      if (theta !== 0) {
        orgTextX = textX;
        orgTextY = textY;
        context.translate(orgTextX, orgTextY);
        context.rotate(theta);
        textX = 0;
        textY = 0;
      }

      switch (valign) {
        case 'top':
          break;

        case 'center':
          textY += textH / 2;
          break;

        case 'bottom':
          textY += textH;
          break;
      }

      var backgroundOpacity = ele.pstyle('text-background-opacity').value;
      var borderOpacity = ele.pstyle('text-border-opacity').value;
      var textBorderWidth = ele.pstyle('text-border-width').pfValue;
      var backgroundPadding = ele.pstyle('text-background-padding').pfValue;

      if (backgroundOpacity > 0 || textBorderWidth > 0 && borderOpacity > 0) {
        var bgX = textX - backgroundPadding;

        switch (halign) {
          case 'left':
            bgX -= textW;
            break;

          case 'center':
            bgX -= textW / 2;
            break;
        }

        var bgY = textY - textH - backgroundPadding;
        var bgW = textW + 2 * backgroundPadding;
        var bgH = textH + 2 * backgroundPadding;

        if (backgroundOpacity > 0) {
          var textFill = context.fillStyle;
          var textBackgroundColor = ele.pstyle('text-background-color').value;
          context.fillStyle = 'rgba(' + textBackgroundColor[0] + ',' + textBackgroundColor[1] + ',' + textBackgroundColor[2] + ',' + backgroundOpacity * parentOpacity + ')';
          var styleShape = ele.pstyle('text-background-shape').strValue;

          if (styleShape.indexOf('round') === 0) {
            roundRect(context, bgX, bgY, bgW, bgH, 2);
          } else {
            context.fillRect(bgX, bgY, bgW, bgH);
          }

          context.fillStyle = textFill;
        }

        if (textBorderWidth > 0 && borderOpacity > 0) {
          var textStroke = context.strokeStyle;
          var textLineWidth = context.lineWidth;
          var textBorderColor = ele.pstyle('text-border-color').value;
          var textBorderStyle = ele.pstyle('text-border-style').value;
          context.strokeStyle = 'rgba(' + textBorderColor[0] + ',' + textBorderColor[1] + ',' + textBorderColor[2] + ',' + borderOpacity * parentOpacity + ')';
          context.lineWidth = textBorderWidth;

          if (context.setLineDash) {
            // for very outofdate browsers
            switch (textBorderStyle) {
              case 'dotted':
                context.setLineDash([1, 1]);
                break;

              case 'dashed':
                context.setLineDash([4, 2]);
                break;

              case 'double':
                context.lineWidth = textBorderWidth / 4; // 50% reserved for white between the two borders

                context.setLineDash([]);
                break;

              case 'solid':
                context.setLineDash([]);
                break;
            }
          }

          context.strokeRect(bgX, bgY, bgW, bgH);

          if (textBorderStyle === 'double') {
            var whiteWidth = textBorderWidth / 2;
            context.strokeRect(bgX + whiteWidth, bgY + whiteWidth, bgW - whiteWidth * 2, bgH - whiteWidth * 2);
          }

          if (context.setLineDash) {
            // for very outofdate browsers
            context.setLineDash([]);
          }

          context.lineWidth = textLineWidth;
          context.strokeStyle = textStroke;
        }
      }

      var lineWidth = 2 * ele.pstyle('text-outline-width').pfValue; // *2 b/c the stroke is drawn centred on the middle

      if (lineWidth > 0) {
        context.lineWidth = lineWidth;
      }

      if (ele.pstyle('text-wrap').value === 'wrap') {
        var lines = getPrefixedProperty(rscratch, 'labelWrapCachedLines', prefix);
        var lineHeight = getPrefixedProperty(rscratch, 'labelLineHeight', prefix);
        var halfTextW = textW / 2;
        var justification = this.getLabelJustification(ele);

        if (justification === 'auto') ; else if (halign === 'left') {
          // auto justification : right
          if (justification === 'left') {
            textX += -textW;
          } else if (justification === 'center') {
            textX += -halfTextW;
          } // else same as auto

        } else if (halign === 'center') {
          // auto justfication : center
          if (justification === 'left') {
            textX += -halfTextW;
          } else if (justification === 'right') {
            textX += halfTextW;
          } // else same as auto

        } else if (halign === 'right') {
          // auto justification : left
          if (justification === 'center') {
            textX += halfTextW;
          } else if (justification === 'right') {
            textX += textW;
          } // else same as auto

        }

        switch (valign) {
          case 'top':
            textY -= (lines.length - 1) * lineHeight;
            break;

          case 'center':
          case 'bottom':
            textY -= (lines.length - 1) * lineHeight;
            break;
        }

        for (var l = 0; l < lines.length; l++) {
          if (lineWidth > 0) {
            context.strokeText(lines[l], textX, textY);
          }

          context.fillText(lines[l], textX, textY);
          textY += lineHeight;
        }
      } else {
        if (lineWidth > 0) {
          context.strokeText(text, textX, textY);
        }

        context.fillText(text, textX, textY);
      }

      if (theta !== 0) {
        context.rotate(-theta);
        context.translate(-orgTextX, -orgTextY);
      }
    }
  };

  /* global Path2D */
  var CRp$5 = {};

  CRp$5.drawNode = function (context, node, shiftToOriginWithBb) {
    var drawLabel = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;
    var shouldDrawOverlay = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : true;
    var shouldDrawOpacity = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : true;
    var r = this;
    var nodeWidth, nodeHeight;
    var _p = node._private;
    var rs = _p.rscratch;
    var pos = node.position();

    if (!number(pos.x) || !number(pos.y)) {
      return; // can't draw node with undefined position
    }

    if (shouldDrawOpacity && !node.visible()) {
      return;
    }

    var eleOpacity = shouldDrawOpacity ? node.effectiveOpacity() : 1;
    var usePaths = r.usePaths();
    var path;
    var pathCacheHit = false;
    var padding = node.padding();
    nodeWidth = node.width() + 2 * padding;
    nodeHeight = node.height() + 2 * padding; //
    // setup shift

    var bb;

    if (shiftToOriginWithBb) {
      bb = shiftToOriginWithBb;
      context.translate(-bb.x1, -bb.y1);
    } //
    // load bg image


    var bgImgProp = node.pstyle('background-image');
    var urls = bgImgProp.value;
    var urlDefined = new Array(urls.length);
    var image = new Array(urls.length);
    var numImages = 0;

    for (var i = 0; i < urls.length; i++) {
      var url = urls[i];
      var defd = urlDefined[i] = url != null && url !== 'none';

      if (defd) {
        var bgImgCrossOrigin = node.cy().style().getIndexedStyle(node, 'background-image-crossorigin', 'value', i);
        numImages++; // get image, and if not loaded then ask to redraw when later loaded

        image[i] = r.getCachedImage(url, bgImgCrossOrigin, function () {
          _p.backgroundTimestamp = Date.now();
          node.emitAndNotify('background');
        });
      }
    } //
    // setup styles


    var darkness = node.pstyle('background-blacken').value;
    var borderWidth = node.pstyle('border-width').pfValue;
    var bgOpacity = node.pstyle('background-opacity').value * eleOpacity;
    var borderColor = node.pstyle('border-color').value;
    var borderStyle = node.pstyle('border-style').value;
    var borderOpacity = node.pstyle('border-opacity').value * eleOpacity;
    context.lineJoin = 'miter'; // so borders are square with the node shape

    var setupShapeColor = function setupShapeColor() {
      var bgOpy = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : bgOpacity;
      r.eleFillStyle(context, node, bgOpy);
    };

    var setupBorderColor = function setupBorderColor() {
      var bdrOpy = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : borderOpacity;
      r.colorStrokeStyle(context, borderColor[0], borderColor[1], borderColor[2], bdrOpy);
    }; //
    // setup shape


    var styleShape = node.pstyle('shape').strValue;
    var shapePts = node.pstyle('shape-polygon-points').pfValue;

    if (usePaths) {
      context.translate(pos.x, pos.y);
      var pathCache = r.nodePathCache = r.nodePathCache || [];
      var key = hashStrings(styleShape === 'polygon' ? styleShape + ',' + shapePts.join(',') : styleShape, '' + nodeHeight, '' + nodeWidth);
      var cachedPath = pathCache[key];

      if (cachedPath != null) {
        path = cachedPath;
        pathCacheHit = true;
        rs.pathCache = path;
      } else {
        path = new Path2D();
        pathCache[key] = rs.pathCache = path;
      }
    }

    var drawShape = function drawShape() {
      if (!pathCacheHit) {
        var npos = pos;

        if (usePaths) {
          npos = {
            x: 0,
            y: 0
          };
        }

        r.nodeShapes[r.getNodeShape(node)].draw(path || context, npos.x, npos.y, nodeWidth, nodeHeight);
      }

      if (usePaths) {
        context.fill(path);
      } else {
        context.fill();
      }
    };

    var drawImages = function drawImages() {
      var nodeOpacity = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : eleOpacity;
      var prevBging = _p.backgrounding;
      var totalCompleted = 0;

      for (var _i = 0; _i < image.length; _i++) {
        if (urlDefined[_i] && image[_i].complete && !image[_i].error) {
          totalCompleted++;
          r.drawInscribedImage(context, image[_i], node, _i, nodeOpacity);
        }
      }

      _p.backgrounding = !(totalCompleted === numImages);

      if (prevBging !== _p.backgrounding) {
        // update style b/c :backgrounding state changed
        node.updateStyle(false);
      }
    };

    var drawPie = function drawPie() {
      var redrawShape = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
      var pieOpacity = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : eleOpacity;

      if (r.hasPie(node)) {
        r.drawPie(context, node, pieOpacity); // redraw/restore path if steps after pie need it

        if (redrawShape) {
          if (!usePaths) {
            r.nodeShapes[r.getNodeShape(node)].draw(context, pos.x, pos.y, nodeWidth, nodeHeight);
          }
        }
      }
    };

    var darken = function darken() {
      var darkenOpacity = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : eleOpacity;
      var opacity = (darkness > 0 ? darkness : -darkness) * darkenOpacity;
      var c = darkness > 0 ? 0 : 255;

      if (darkness !== 0) {
        r.colorFillStyle(context, c, c, c, opacity);

        if (usePaths) {
          context.fill(path);
        } else {
          context.fill();
        }
      }
    };

    var drawBorder = function drawBorder() {
      if (borderWidth > 0) {
        context.lineWidth = borderWidth;
        context.lineCap = 'butt';

        if (context.setLineDash) {
          // for very outofdate browsers
          switch (borderStyle) {
            case 'dotted':
              context.setLineDash([1, 1]);
              break;

            case 'dashed':
              context.setLineDash([4, 2]);
              break;

            case 'solid':
            case 'double':
              context.setLineDash([]);
              break;
          }
        }

        if (usePaths) {
          context.stroke(path);
        } else {
          context.stroke();
        }

        if (borderStyle === 'double') {
          context.lineWidth = borderWidth / 3;
          var gco = context.globalCompositeOperation;
          context.globalCompositeOperation = 'destination-out';

          if (usePaths) {
            context.stroke(path);
          } else {
            context.stroke();
          }

          context.globalCompositeOperation = gco;
        } // reset in case we changed the border style


        if (context.setLineDash) {
          // for very outofdate browsers
          context.setLineDash([]);
        }
      }
    };

    var drawOverlay = function drawOverlay() {
      if (shouldDrawOverlay) {
        r.drawNodeOverlay(context, node, pos, nodeWidth, nodeHeight);
      }
    };

    var drawText = function drawText() {
      r.drawElementText(context, node, null, drawLabel);
    };

    var ghost = node.pstyle('ghost').value === 'yes';

    if (ghost) {
      var gx = node.pstyle('ghost-offset-x').pfValue;
      var gy = node.pstyle('ghost-offset-y').pfValue;
      var ghostOpacity = node.pstyle('ghost-opacity').value;
      var effGhostOpacity = ghostOpacity * eleOpacity;
      context.translate(gx, gy);
      setupShapeColor(ghostOpacity * bgOpacity);
      drawShape();
      drawImages(effGhostOpacity);
      drawPie(darkness !== 0 || borderWidth !== 0);
      darken(effGhostOpacity);
      setupBorderColor(ghostOpacity * borderOpacity);
      drawBorder();
      context.translate(-gx, -gy);
    }

    setupShapeColor();
    drawShape();
    drawImages();
    drawPie(darkness !== 0 || borderWidth !== 0);
    darken();
    setupBorderColor();
    drawBorder();

    if (usePaths) {
      context.translate(-pos.x, -pos.y);
    }

    drawText();
    drawOverlay(); //
    // clean up shift

    if (shiftToOriginWithBb) {
      context.translate(bb.x1, bb.y1);
    }
  };

  CRp$5.drawNodeOverlay = function (context, node, pos, nodeWidth, nodeHeight) {
    var r = this;

    if (!node.visible()) {
      return;
    }

    var overlayPadding = node.pstyle('overlay-padding').pfValue;
    var overlayOpacity = node.pstyle('overlay-opacity').value;
    var overlayColor = node.pstyle('overlay-color').value;

    if (overlayOpacity > 0) {
      pos = pos || node.position();

      if (nodeWidth == null || nodeHeight == null) {
        var padding = node.padding();
        nodeWidth = node.width() + 2 * padding;
        nodeHeight = node.height() + 2 * padding;
      }

      r.colorFillStyle(context, overlayColor[0], overlayColor[1], overlayColor[2], overlayOpacity);
      r.nodeShapes['roundrectangle'].draw(context, pos.x, pos.y, nodeWidth + overlayPadding * 2, nodeHeight + overlayPadding * 2);
      context.fill();
    }
  }; // does the node have at least one pie piece?


  CRp$5.hasPie = function (node) {
    node = node[0]; // ensure ele ref

    return node._private.hasPie;
  };

  CRp$5.drawPie = function (context, node, nodeOpacity, pos) {
    node = node[0]; // ensure ele ref

    pos = pos || node.position();
    var cyStyle = node.cy().style();
    var pieSize = node.pstyle('pie-size');
    var x = pos.x;
    var y = pos.y;
    var nodeW = node.width();
    var nodeH = node.height();
    var radius = Math.min(nodeW, nodeH) / 2; // must fit in node

    var lastPercent = 0; // what % to continue drawing pie slices from on [0, 1]

    var usePaths = this.usePaths();

    if (usePaths) {
      x = 0;
      y = 0;
    }

    if (pieSize.units === '%') {
      radius = radius * pieSize.pfValue;
    } else if (pieSize.pfValue !== undefined) {
      radius = pieSize.pfValue / 2;
    }

    for (var i = 1; i <= cyStyle.pieBackgroundN; i++) {
      // 1..N
      var size = node.pstyle('pie-' + i + '-background-size').value;
      var color = node.pstyle('pie-' + i + '-background-color').value;
      var opacity = node.pstyle('pie-' + i + '-background-opacity').value * nodeOpacity;
      var percent = size / 100; // map integer range [0, 100] to [0, 1]
      // percent can't push beyond 1

      if (percent + lastPercent > 1) {
        percent = 1 - lastPercent;
      }

      var angleStart = 1.5 * Math.PI + 2 * Math.PI * lastPercent; // start at 12 o'clock and go clockwise

      var angleDelta = 2 * Math.PI * percent;
      var angleEnd = angleStart + angleDelta; // ignore if
      // - zero size
      // - we're already beyond the full circle
      // - adding the current slice would go beyond the full circle

      if (size === 0 || lastPercent >= 1 || lastPercent + percent > 1) {
        continue;
      }

      context.beginPath();
      context.moveTo(x, y);
      context.arc(x, y, radius, angleStart, angleEnd);
      context.closePath();
      this.colorFillStyle(context, color[0], color[1], color[2], opacity);
      context.fill();
      lastPercent += percent;
    }
  };

  var CRp$6 = {};
  var motionBlurDelay = 100; // var isFirefox = typeof InstallTrigger !== 'undefined';

  CRp$6.getPixelRatio = function () {
    var context = this.data.contexts[0];

    if (this.forcedPixelRatio != null) {
      return this.forcedPixelRatio;
    }

    var backingStore = context.backingStorePixelRatio || context.webkitBackingStorePixelRatio || context.mozBackingStorePixelRatio || context.msBackingStorePixelRatio || context.oBackingStorePixelRatio || context.backingStorePixelRatio || 1;
    return (window.devicePixelRatio || 1) / backingStore; // eslint-disable-line no-undef
  };

  CRp$6.paintCache = function (context) {
    var caches = this.paintCaches = this.paintCaches || [];
    var needToCreateCache = true;
    var cache;

    for (var i = 0; i < caches.length; i++) {
      cache = caches[i];

      if (cache.context === context) {
        needToCreateCache = false;
        break;
      }
    }

    if (needToCreateCache) {
      cache = {
        context: context
      };
      caches.push(cache);
    }

    return cache;
  };

  CRp$6.createGradientStyleFor = function (context, shapeStyleName, ele, fill, opacity) {
    var gradientStyle;
    var usePaths = this.usePaths();
    var colors = ele.pstyle(shapeStyleName + '-gradient-stop-colors').value,
        positions = ele.pstyle(shapeStyleName + '-gradient-stop-positions').pfValue;

    if (fill === 'radial-gradient') {
      if (ele.isEdge()) {
        var start = ele.sourceEndpoint(),
            end = ele.targetEndpoint(),
            mid = ele.midpoint();
        var d1 = dist(start, mid);
        var d2 = dist(end, mid);
        gradientStyle = context.createRadialGradient(mid.x, mid.y, 0, mid.x, mid.y, Math.max(d1, d2));
      } else {
        var pos = usePaths ? {
          x: 0,
          y: 0
        } : ele.position(),
            width = ele.paddedWidth(),
            height = ele.paddedHeight();
        gradientStyle = context.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, Math.max(width, height));
      }
    } else {
      if (ele.isEdge()) {
        var _start = ele.sourceEndpoint(),
            _end = ele.targetEndpoint();

        gradientStyle = context.createLinearGradient(_start.x, _start.y, _end.x, _end.y);
      } else {
        var _pos = usePaths ? {
          x: 0,
          y: 0
        } : ele.position(),
            _width = ele.paddedWidth(),
            _height = ele.paddedHeight(),
            halfWidth = _width / 2,
            halfHeight = _height / 2;

        var direction = ele.pstyle('background-gradient-direction').value;

        switch (direction) {
          case 'to-bottom':
            gradientStyle = context.createLinearGradient(_pos.x, _pos.y - halfHeight, _pos.x, _pos.y + halfHeight);
            break;

          case 'to-top':
            gradientStyle = context.createLinearGradient(_pos.x, _pos.y + halfHeight, _pos.x, _pos.y - halfHeight);
            break;

          case 'to-left':
            gradientStyle = context.createLinearGradient(_pos.x + halfWidth, _pos.y, _pos.x - halfWidth, _pos.y);
            break;

          case 'to-right':
            gradientStyle = context.createLinearGradient(_pos.x - halfWidth, _pos.y, _pos.x + halfWidth, _pos.y);
            break;

          case 'to-bottom-right':
          case 'to-right-bottom':
            gradientStyle = context.createLinearGradient(_pos.x - halfWidth, _pos.y - halfHeight, _pos.x + halfWidth, _pos.y + halfHeight);
            break;

          case 'to-top-right':
          case 'to-right-top':
            gradientStyle = context.createLinearGradient(_pos.x - halfWidth, _pos.y + halfHeight, _pos.x + halfWidth, _pos.y - halfHeight);
            break;

          case 'to-bottom-left':
          case 'to-left-bottom':
            gradientStyle = context.createLinearGradient(_pos.x + halfWidth, _pos.y - halfHeight, _pos.x - halfWidth, _pos.y + halfHeight);
            break;

          case 'to-top-left':
          case 'to-left-top':
            gradientStyle = context.createLinearGradient(_pos.x + halfWidth, _pos.y + halfHeight, _pos.x - halfWidth, _pos.y - halfHeight);
            break;
        }
      }
    }

    if (!gradientStyle) return null; // invalid gradient style

    var hasPositions = positions.length === colors.length;
    var length = colors.length;

    for (var i = 0; i < length; i++) {
      gradientStyle.addColorStop(hasPositions ? positions[i] : i / (length - 1), 'rgba(' + colors[i][0] + ',' + colors[i][1] + ',' + colors[i][2] + ',' + opacity + ')');
    }

    return gradientStyle;
  };

  CRp$6.gradientFillStyle = function (context, ele, fill, opacity) {
    var gradientStyle = this.createGradientStyleFor(context, 'background', ele, fill, opacity);
    if (!gradientStyle) return null; // error

    context.fillStyle = gradientStyle;
  };

  CRp$6.colorFillStyle = function (context, r, g, b, a) {
    context.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; // turn off for now, seems context does its own caching
    // var cache = this.paintCache(context);
    // var fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    // if( cache.fillStyle !== fillStyle ){
    //   context.fillStyle = cache.fillStyle = fillStyle;
    // }
  };

  CRp$6.eleFillStyle = function (context, ele, opacity) {
    var backgroundFill = ele.pstyle('background-fill').value;

    if (backgroundFill === 'linear-gradient' || backgroundFill === 'radial-gradient') {
      this.gradientFillStyle(context, ele, backgroundFill, opacity);
    } else {
      var backgroundColor = ele.pstyle('background-color').value;
      this.colorFillStyle(context, backgroundColor[0], backgroundColor[1], backgroundColor[2], opacity);
    }
  };

  CRp$6.gradientStrokeStyle = function (context, ele, fill, opacity) {
    var gradientStyle = this.createGradientStyleFor(context, 'line', ele, fill, opacity);
    if (!gradientStyle) return null; // error

    context.strokeStyle = gradientStyle;
  };

  CRp$6.colorStrokeStyle = function (context, r, g, b, a) {
    context.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; // turn off for now, seems context does its own caching
    // var cache = this.paintCache(context);
    // var strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    // if( cache.strokeStyle !== strokeStyle ){
    //   context.strokeStyle = cache.strokeStyle = strokeStyle;
    // }
  };

  CRp$6.eleStrokeStyle = function (context, ele, opacity) {
    var lineFill = ele.pstyle('line-fill').value;

    if (lineFill === 'linear-gradient' || lineFill === 'radial-gradient') {
      this.gradientStrokeStyle(context, ele, lineFill, opacity);
    } else {
      var lineColor = ele.pstyle('line-color').value;
      this.colorStrokeStyle(context, lineColor[0], lineColor[1], lineColor[2], opacity);
    }
  }; // Resize canvas


  CRp$6.matchCanvasSize = function (container) {
    var r = this;
    var data = r.data;
    var bb = r.findContainerClientCoords();
    var width = bb[2];
    var height = bb[3];
    var pixelRatio = r.getPixelRatio();
    var mbPxRatio = r.motionBlurPxRatio;

    if (container === r.data.bufferCanvases[r.MOTIONBLUR_BUFFER_NODE] || container === r.data.bufferCanvases[r.MOTIONBLUR_BUFFER_DRAG]) {
      pixelRatio = mbPxRatio;
    }

    var canvasWidth = width * pixelRatio;
    var canvasHeight = height * pixelRatio;
    var canvas;

    if (canvasWidth === r.canvasWidth && canvasHeight === r.canvasHeight) {
      return; // save cycles if same
    }

    r.fontCaches = null; // resizing resets the style

    var canvasContainer = data.canvasContainer;
    canvasContainer.style.width = width + 'px';
    canvasContainer.style.height = height + 'px';

    for (var i = 0; i < r.CANVAS_LAYERS; i++) {
      canvas = data.canvases[i];
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
    }

    for (var i = 0; i < r.BUFFER_COUNT; i++) {
      canvas = data.bufferCanvases[i];
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
    }

    r.textureMult = 1;

    if (pixelRatio <= 1) {
      canvas = data.bufferCanvases[r.TEXTURE_BUFFER];
      r.textureMult = 2;
      canvas.width = canvasWidth * r.textureMult;
      canvas.height = canvasHeight * r.textureMult;
    }

    r.canvasWidth = canvasWidth;
    r.canvasHeight = canvasHeight;
  };

  CRp$6.renderTo = function (cxt, zoom, pan, pxRatio) {
    this.render({
      forcedContext: cxt,
      forcedZoom: zoom,
      forcedPan: pan,
      drawAllLayers: true,
      forcedPxRatio: pxRatio
    });
  };

  CRp$6.render = function (options) {
    options = options || staticEmptyObject();
    var forcedContext = options.forcedContext;
    var drawAllLayers = options.drawAllLayers;
    var drawOnlyNodeLayer = options.drawOnlyNodeLayer;
    var forcedZoom = options.forcedZoom;
    var forcedPan = options.forcedPan;
    var r = this;
    var pixelRatio = options.forcedPxRatio === undefined ? this.getPixelRatio() : options.forcedPxRatio;
    var cy = r.cy;
    var data = r.data;
    var needDraw = data.canvasNeedsRedraw;
    var textureDraw = r.textureOnViewport && !forcedContext && (r.pinching || r.hoverData.dragging || r.swipePanning || r.data.wheelZooming);
    var motionBlur = options.motionBlur !== undefined ? options.motionBlur : r.motionBlur;
    var mbPxRatio = r.motionBlurPxRatio;
    var hasCompoundNodes = cy.hasCompoundNodes();
    var inNodeDragGesture = r.hoverData.draggingEles;
    var inBoxSelection = r.hoverData.selecting || r.touchData.selecting ? true : false;
    motionBlur = motionBlur && !forcedContext && r.motionBlurEnabled && !inBoxSelection;
    var motionBlurFadeEffect = motionBlur;

    if (!forcedContext) {
      if (r.prevPxRatio !== pixelRatio) {
        r.invalidateContainerClientCoordsCache();
        r.matchCanvasSize(r.container);
        r.redrawHint('eles', true);
        r.redrawHint('drag', true);
      }

      r.prevPxRatio = pixelRatio;
    }

    if (!forcedContext && r.motionBlurTimeout) {
      clearTimeout(r.motionBlurTimeout);
    }

    if (motionBlur) {
      if (r.mbFrames == null) {
        r.mbFrames = 0;
      }

      r.mbFrames++;

      if (r.mbFrames < 3) {
        // need several frames before even high quality motionblur
        motionBlurFadeEffect = false;
      } // go to lower quality blurry frames when several m/b frames have been rendered (avoids flashing)


      if (r.mbFrames > r.minMbLowQualFrames) {
        //r.fullQualityMb = false;
        r.motionBlurPxRatio = r.mbPxRBlurry;
      }
    }

    if (r.clearingMotionBlur) {
      r.motionBlurPxRatio = 1;
    } // b/c drawToContext() may be async w.r.t. redraw(), keep track of last texture frame
    // because a rogue async texture frame would clear needDraw


    if (r.textureDrawLastFrame && !textureDraw) {
      needDraw[r.NODE] = true;
      needDraw[r.SELECT_BOX] = true;
    }

    var style = cy.style();
    var zoom = cy.zoom();
    var effectiveZoom = forcedZoom !== undefined ? forcedZoom : zoom;
    var pan = cy.pan();
    var effectivePan = {
      x: pan.x,
      y: pan.y
    };
    var vp = {
      zoom: zoom,
      pan: {
        x: pan.x,
        y: pan.y
      }
    };
    var prevVp = r.prevViewport;
    var viewportIsDiff = prevVp === undefined || vp.zoom !== prevVp.zoom || vp.pan.x !== prevVp.pan.x || vp.pan.y !== prevVp.pan.y; // we want the low quality motionblur only when the viewport is being manipulated etc (where it's not noticed)

    if (!viewportIsDiff && !(inNodeDragGesture && !hasCompoundNodes)) {
      r.motionBlurPxRatio = 1;
    }

    if (forcedPan) {
      effectivePan = forcedPan;
    } // apply pixel ratio


    effectiveZoom *= pixelRatio;
    effectivePan.x *= pixelRatio;
    effectivePan.y *= pixelRatio;
    var eles = r.getCachedZSortedEles();

    function mbclear(context, x, y, w, h) {
      var gco = context.globalCompositeOperation;
      context.globalCompositeOperation = 'destination-out';
      r.colorFillStyle(context, 255, 255, 255, r.motionBlurTransparency);
      context.fillRect(x, y, w, h);
      context.globalCompositeOperation = gco;
    }

    function setContextTransform(context, clear) {
      var ePan, eZoom, w, h;

      if (!r.clearingMotionBlur && (context === data.bufferContexts[r.MOTIONBLUR_BUFFER_NODE] || context === data.bufferContexts[r.MOTIONBLUR_BUFFER_DRAG])) {
        ePan = {
          x: pan.x * mbPxRatio,
          y: pan.y * mbPxRatio
        };
        eZoom = zoom * mbPxRatio;
        w = r.canvasWidth * mbPxRatio;
        h = r.canvasHeight * mbPxRatio;
      } else {
        ePan = effectivePan;
        eZoom = effectiveZoom;
        w = r.canvasWidth;
        h = r.canvasHeight;
      }

      context.setTransform(1, 0, 0, 1, 0, 0);

      if (clear === 'motionBlur') {
        mbclear(context, 0, 0, w, h);
      } else if (!forcedContext && (clear === undefined || clear)) {
        context.clearRect(0, 0, w, h);
      }

      if (!drawAllLayers) {
        context.translate(ePan.x, ePan.y);
        context.scale(eZoom, eZoom);
      }

      if (forcedPan) {
        context.translate(forcedPan.x, forcedPan.y);
      }

      if (forcedZoom) {
        context.scale(forcedZoom, forcedZoom);
      }
    }

    if (!textureDraw) {
      r.textureDrawLastFrame = false;
    }

    if (textureDraw) {
      r.textureDrawLastFrame = true;

      if (!r.textureCache) {
        r.textureCache = {};
        r.textureCache.bb = cy.mutableElements().boundingBox();
        r.textureCache.texture = r.data.bufferCanvases[r.TEXTURE_BUFFER];
        var cxt = r.data.bufferContexts[r.TEXTURE_BUFFER];
        cxt.setTransform(1, 0, 0, 1, 0, 0);
        cxt.clearRect(0, 0, r.canvasWidth * r.textureMult, r.canvasHeight * r.textureMult);
        r.render({
          forcedContext: cxt,
          drawOnlyNodeLayer: true,
          forcedPxRatio: pixelRatio * r.textureMult
        });
        var vp = r.textureCache.viewport = {
          zoom: cy.zoom(),
          pan: cy.pan(),
          width: r.canvasWidth,
          height: r.canvasHeight
        };
        vp.mpan = {
          x: (0 - vp.pan.x) / vp.zoom,
          y: (0 - vp.pan.y) / vp.zoom
        };
      }

      needDraw[r.DRAG] = false;
      needDraw[r.NODE] = false;
      var context = data.contexts[r.NODE];
      var texture = r.textureCache.texture;
      var vp = r.textureCache.viewport;
      context.setTransform(1, 0, 0, 1, 0, 0);

      if (motionBlur) {
        mbclear(context, 0, 0, vp.width, vp.height);
      } else {
        context.clearRect(0, 0, vp.width, vp.height);
      }

      var outsideBgColor = style.core('outside-texture-bg-color').value;
      var outsideBgOpacity = style.core('outside-texture-bg-opacity').value;
      r.colorFillStyle(context, outsideBgColor[0], outsideBgColor[1], outsideBgColor[2], outsideBgOpacity);
      context.fillRect(0, 0, vp.width, vp.height);
      var zoom = cy.zoom();
      setContextTransform(context, false);
      context.clearRect(vp.mpan.x, vp.mpan.y, vp.width / vp.zoom / pixelRatio, vp.height / vp.zoom / pixelRatio);
      context.drawImage(texture, vp.mpan.x, vp.mpan.y, vp.width / vp.zoom / pixelRatio, vp.height / vp.zoom / pixelRatio);
    } else if (r.textureOnViewport && !forcedContext) {
      // clear the cache since we don't need it
      r.textureCache = null;
    }

    var extent = cy.extent();
    var vpManip = r.pinching || r.hoverData.dragging || r.swipePanning || r.data.wheelZooming || r.hoverData.draggingEles || r.cy.animated();
    var hideEdges = r.hideEdgesOnViewport && vpManip;
    var needMbClear = [];
    needMbClear[r.NODE] = !needDraw[r.NODE] && motionBlur && !r.clearedForMotionBlur[r.NODE] || r.clearingMotionBlur;

    if (needMbClear[r.NODE]) {
      r.clearedForMotionBlur[r.NODE] = true;
    }

    needMbClear[r.DRAG] = !needDraw[r.DRAG] && motionBlur && !r.clearedForMotionBlur[r.DRAG] || r.clearingMotionBlur;

    if (needMbClear[r.DRAG]) {
      r.clearedForMotionBlur[r.DRAG] = true;
    }

    if (needDraw[r.NODE] || drawAllLayers || drawOnlyNodeLayer || needMbClear[r.NODE]) {
      var useBuffer = motionBlur && !needMbClear[r.NODE] && mbPxRatio !== 1;
      var context = forcedContext || (useBuffer ? r.data.bufferContexts[r.MOTIONBLUR_BUFFER_NODE] : data.contexts[r.NODE]);
      var clear = motionBlur && !useBuffer ? 'motionBlur' : undefined;
      setContextTransform(context, clear);

      if (hideEdges) {
        r.drawCachedNodes(context, eles.nondrag, pixelRatio, extent);
      } else {
        r.drawLayeredElements(context, eles.nondrag, pixelRatio, extent);
      }

      if (r.debug) {
        r.drawDebugPoints(context, eles.nondrag);
      }

      if (!drawAllLayers && !motionBlur) {
        needDraw[r.NODE] = false;
      }
    }

    if (!drawOnlyNodeLayer && (needDraw[r.DRAG] || drawAllLayers || needMbClear[r.DRAG])) {
      var useBuffer = motionBlur && !needMbClear[r.DRAG] && mbPxRatio !== 1;
      var context = forcedContext || (useBuffer ? r.data.bufferContexts[r.MOTIONBLUR_BUFFER_DRAG] : data.contexts[r.DRAG]);
      setContextTransform(context, motionBlur && !useBuffer ? 'motionBlur' : undefined);

      if (hideEdges) {
        r.drawCachedNodes(context, eles.drag, pixelRatio, extent);
      } else {
        r.drawCachedElements(context, eles.drag, pixelRatio, extent);
      }

      if (r.debug) {
        r.drawDebugPoints(context, eles.drag);
      }

      if (!drawAllLayers && !motionBlur) {
        needDraw[r.DRAG] = false;
      }
    }

    if (r.showFps || !drawOnlyNodeLayer && needDraw[r.SELECT_BOX] && !drawAllLayers) {
      var context = forcedContext || data.contexts[r.SELECT_BOX];
      setContextTransform(context);

      if (r.selection[4] == 1 && (r.hoverData.selecting || r.touchData.selecting)) {
        var zoom = r.cy.zoom();
        var borderWidth = style.core('selection-box-border-width').value / zoom;
        context.lineWidth = borderWidth;
        context.fillStyle = 'rgba(' + style.core('selection-box-color').value[0] + ',' + style.core('selection-box-color').value[1] + ',' + style.core('selection-box-color').value[2] + ',' + style.core('selection-box-opacity').value + ')';
        context.fillRect(r.selection[0], r.selection[1], r.selection[2] - r.selection[0], r.selection[3] - r.selection[1]);

        if (borderWidth > 0) {
          context.strokeStyle = 'rgba(' + style.core('selection-box-border-color').value[0] + ',' + style.core('selection-box-border-color').value[1] + ',' + style.core('selection-box-border-color').value[2] + ',' + style.core('selection-box-opacity').value + ')';
          context.strokeRect(r.selection[0], r.selection[1], r.selection[2] - r.selection[0], r.selection[3] - r.selection[1]);
        }
      }

      if (data.bgActivePosistion && !r.hoverData.selecting) {
        var zoom = r.cy.zoom();
        var pos = data.bgActivePosistion;
        context.fillStyle = 'rgba(' + style.core('active-bg-color').value[0] + ',' + style.core('active-bg-color').value[1] + ',' + style.core('active-bg-color').value[2] + ',' + style.core('active-bg-opacity').value + ')';
        context.beginPath();
        context.arc(pos.x, pos.y, style.core('active-bg-size').pfValue / zoom, 0, 2 * Math.PI);
        context.fill();
      }

      var timeToRender = r.lastRedrawTime;

      if (r.showFps && timeToRender) {
        timeToRender = Math.round(timeToRender);
        var fps = Math.round(1000 / timeToRender);
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.fillStyle = 'rgba(255, 0, 0, 0.75)';
        context.strokeStyle = 'rgba(255, 0, 0, 0.75)';
        context.lineWidth = 1;
        context.fillText('1 frame = ' + timeToRender + ' ms = ' + fps + ' fps', 0, 20);
        var maxFps = 60;
        context.strokeRect(0, 30, 250, 20);
        context.fillRect(0, 30, 250 * Math.min(fps / maxFps, 1), 20);
      }

      if (!drawAllLayers) {
        needDraw[r.SELECT_BOX] = false;
      }
    } // motionblur: blit rendered blurry frames


    if (motionBlur && mbPxRatio !== 1) {
      var cxtNode = data.contexts[r.NODE];
      var txtNode = r.data.bufferCanvases[r.MOTIONBLUR_BUFFER_NODE];
      var cxtDrag = data.contexts[r.DRAG];
      var txtDrag = r.data.bufferCanvases[r.MOTIONBLUR_BUFFER_DRAG];

      var drawMotionBlur = function drawMotionBlur(cxt, txt, needClear) {
        cxt.setTransform(1, 0, 0, 1, 0, 0);

        if (needClear || !motionBlurFadeEffect) {
          cxt.clearRect(0, 0, r.canvasWidth, r.canvasHeight);
        } else {
          mbclear(cxt, 0, 0, r.canvasWidth, r.canvasHeight);
        }

        var pxr = mbPxRatio;
        cxt.drawImage(txt, // img
        0, 0, // sx, sy
        r.canvasWidth * pxr, r.canvasHeight * pxr, // sw, sh
        0, 0, // x, y
        r.canvasWidth, r.canvasHeight // w, h
        );
      };

      if (needDraw[r.NODE] || needMbClear[r.NODE]) {
        drawMotionBlur(cxtNode, txtNode, needMbClear[r.NODE]);
        needDraw[r.NODE] = false;
      }

      if (needDraw[r.DRAG] || needMbClear[r.DRAG]) {
        drawMotionBlur(cxtDrag, txtDrag, needMbClear[r.DRAG]);
        needDraw[r.DRAG] = false;
      }
    }

    r.prevViewport = vp;

    if (r.clearingMotionBlur) {
      r.clearingMotionBlur = false;
      r.motionBlurCleared = true;
      r.motionBlur = true;
    }

    if (motionBlur) {
      r.motionBlurTimeout = setTimeout(function () {
        r.motionBlurTimeout = null;
        r.clearedForMotionBlur[r.NODE] = false;
        r.clearedForMotionBlur[r.DRAG] = false;
        r.motionBlur = false;
        r.clearingMotionBlur = !textureDraw;
        r.mbFrames = 0;
        needDraw[r.NODE] = true;
        needDraw[r.DRAG] = true;
        r.redraw();
      }, motionBlurDelay);
    }

    if (!forcedContext) {
      cy.emit('render');
    }
  };

  var CRp$7 = {}; // @O Polygon drawing

  CRp$7.drawPolygonPath = function (context, x, y, width, height, points) {
    var halfW = width / 2;
    var halfH = height / 2;

    if (context.beginPath) {
      context.beginPath();
    }

    context.moveTo(x + halfW * points[0], y + halfH * points[1]);

    for (var i = 1; i < points.length / 2; i++) {
      context.lineTo(x + halfW * points[i * 2], y + halfH * points[i * 2 + 1]);
    }

    context.closePath();
  };

  CRp$7.drawRoundPolygonPath = function (context, x, y, width, height, points) {
    var halfW = width / 2;
    var halfH = height / 2;
    var cornerRadius = getRoundPolygonRadius(width, height);

    if (context.beginPath) {
      context.beginPath();
    }

    for (var _i = 0; _i < points.length / 4; _i++) {
      var sourceUv = void 0,
          destUv = void 0;

      if (_i === 0) {
        sourceUv = points.length - 2;
      } else {
        sourceUv = _i * 4 - 2;
      }

      destUv = _i * 4 + 2;
      var px = x + halfW * points[_i * 4];
      var py = y + halfH * points[_i * 4 + 1];
      var cosTheta = -points[sourceUv] * points[destUv] - points[sourceUv + 1] * points[destUv + 1];
      var offset = cornerRadius / Math.tan(Math.acos(cosTheta) / 2);
      var cp0x = px - offset * points[sourceUv];
      var cp0y = py - offset * points[sourceUv + 1];
      var cp1x = px + offset * points[destUv];
      var cp1y = py + offset * points[destUv + 1];

      if (_i === 0) {
        context.moveTo(cp0x, cp0y);
      } else {
        context.lineTo(cp0x, cp0y);
      }

      context.arcTo(px, py, cp1x, cp1y, cornerRadius);
    }

    context.closePath();
  }; // Round rectangle drawing


  CRp$7.drawRoundRectanglePath = function (context, x, y, width, height) {
    var halfWidth = width / 2;
    var halfHeight = height / 2;
    var cornerRadius = getRoundRectangleRadius(width, height);

    if (context.beginPath) {
      context.beginPath();
    } // Start at top middle


    context.moveTo(x, y - halfHeight); // Arc from middle top to right side

    context.arcTo(x + halfWidth, y - halfHeight, x + halfWidth, y, cornerRadius); // Arc from right side to bottom

    context.arcTo(x + halfWidth, y + halfHeight, x, y + halfHeight, cornerRadius); // Arc from bottom to left side

    context.arcTo(x - halfWidth, y + halfHeight, x - halfWidth, y, cornerRadius); // Arc from left side to topBorder

    context.arcTo(x - halfWidth, y - halfHeight, x, y - halfHeight, cornerRadius); // Join line

    context.lineTo(x, y - halfHeight);
    context.closePath();
  };

  CRp$7.drawBottomRoundRectanglePath = function (context, x, y, width, height) {
    var halfWidth = width / 2;
    var halfHeight = height / 2;
    var cornerRadius = getRoundRectangleRadius(width, height);

    if (context.beginPath) {
      context.beginPath();
    } // Start at top middle


    context.moveTo(x, y - halfHeight);
    context.lineTo(x + halfWidth, y - halfHeight);
    context.lineTo(x + halfWidth, y);
    context.arcTo(x + halfWidth, y + halfHeight, x, y + halfHeight, cornerRadius);
    context.arcTo(x - halfWidth, y + halfHeight, x - halfWidth, y, cornerRadius);
    context.lineTo(x - halfWidth, y - halfHeight);
    context.lineTo(x, y - halfHeight);
    context.closePath();
  };

  CRp$7.drawCutRectanglePath = function (context, x, y, width, height) {
    var halfWidth = width / 2;
    var halfHeight = height / 2;
    var cornerLength = getCutRectangleCornerLength();

    if (context.beginPath) {
      context.beginPath();
    }

    context.moveTo(x - halfWidth + cornerLength, y - halfHeight);
    context.lineTo(x + halfWidth - cornerLength, y - halfHeight);
    context.lineTo(x + halfWidth, y - halfHeight + cornerLength);
    context.lineTo(x + halfWidth, y + halfHeight - cornerLength);
    context.lineTo(x + halfWidth - cornerLength, y + halfHeight);
    context.lineTo(x - halfWidth + cornerLength, y + halfHeight);
    context.lineTo(x - halfWidth, y + halfHeight - cornerLength);
    context.lineTo(x - halfWidth, y - halfHeight + cornerLength);
    context.closePath();
  };

  CRp$7.drawBarrelPath = function (context, x, y, width, height) {
    var halfWidth = width / 2;
    var halfHeight = height / 2;
    var xBegin = x - halfWidth;
    var xEnd = x + halfWidth;
    var yBegin = y - halfHeight;
    var yEnd = y + halfHeight;
    var barrelCurveConstants = getBarrelCurveConstants(width, height);
    var wOffset = barrelCurveConstants.widthOffset;
    var hOffset = barrelCurveConstants.heightOffset;
    var ctrlPtXOffset = barrelCurveConstants.ctrlPtOffsetPct * wOffset;

    if (context.beginPath) {
      context.beginPath();
    }

    context.moveTo(xBegin, yBegin + hOffset);
    context.lineTo(xBegin, yEnd - hOffset);
    context.quadraticCurveTo(xBegin + ctrlPtXOffset, yEnd, xBegin + wOffset, yEnd);
    context.lineTo(xEnd - wOffset, yEnd);
    context.quadraticCurveTo(xEnd - ctrlPtXOffset, yEnd, xEnd, yEnd - hOffset);
    context.lineTo(xEnd, yBegin + hOffset);
    context.quadraticCurveTo(xEnd - ctrlPtXOffset, yBegin, xEnd - wOffset, yBegin);
    context.lineTo(xBegin + wOffset, yBegin);
    context.quadraticCurveTo(xBegin + ctrlPtXOffset, yBegin, xBegin, yBegin + hOffset);
    context.closePath();
  };

  var sin0 = Math.sin(0);
  var cos0 = Math.cos(0);
  var sin = {};
  var cos = {};
  var ellipseStepSize = Math.PI / 40;

  for (var i = 0 * Math.PI; i < 2 * Math.PI; i += ellipseStepSize) {
    sin[i] = Math.sin(i);
    cos[i] = Math.cos(i);
  }

  CRp$7.drawEllipsePath = function (context, centerX, centerY, width, height) {
    if (context.beginPath) {
      context.beginPath();
    }

    if (context.ellipse) {
      context.ellipse(centerX, centerY, width / 2, height / 2, 0, 0, 2 * Math.PI);
    } else {
      var xPos, yPos;
      var rw = width / 2;
      var rh = height / 2;

      for (var i = 0 * Math.PI; i < 2 * Math.PI; i += ellipseStepSize) {
        xPos = centerX - rw * sin[i] * sin0 + rw * cos[i] * cos0;
        yPos = centerY + rh * cos[i] * sin0 + rh * sin[i] * cos0;

        if (i === 0) {
          context.moveTo(xPos, yPos);
        } else {
          context.lineTo(xPos, yPos);
        }
      }
    }

    context.closePath();
  };

  /* global atob, ArrayBuffer, Uint8Array, Blob */
  var CRp$8 = {};

  CRp$8.createBuffer = function (w, h) {
    var buffer = document.createElement('canvas'); // eslint-disable-line no-undef

    buffer.width = w;
    buffer.height = h;
    return [buffer, buffer.getContext('2d')];
  };

  CRp$8.bufferCanvasImage = function (options) {
    var cy = this.cy;
    var eles = cy.mutableElements();
    var bb = eles.boundingBox();
    var ctrRect = this.findContainerClientCoords();
    var width = options.full ? Math.ceil(bb.w) : ctrRect[2];
    var height = options.full ? Math.ceil(bb.h) : ctrRect[3];
    var specdMaxDims = number(options.maxWidth) || number(options.maxHeight);
    var pxRatio = this.getPixelRatio();
    var scale = 1;

    if (options.scale !== undefined) {
      width *= options.scale;
      height *= options.scale;
      scale = options.scale;
    } else if (specdMaxDims) {
      var maxScaleW = Infinity;
      var maxScaleH = Infinity;

      if (number(options.maxWidth)) {
        maxScaleW = scale * options.maxWidth / width;
      }

      if (number(options.maxHeight)) {
        maxScaleH = scale * options.maxHeight / height;
      }

      scale = Math.min(maxScaleW, maxScaleH);
      width *= scale;
      height *= scale;
    }

    if (!specdMaxDims) {
      width *= pxRatio;
      height *= pxRatio;
      scale *= pxRatio;
    }

    var buffCanvas = document.createElement('canvas'); // eslint-disable-line no-undef

    buffCanvas.width = width;
    buffCanvas.height = height;
    buffCanvas.style.width = width + 'px';
    buffCanvas.style.height = height + 'px';
    var buffCxt = buffCanvas.getContext('2d'); // Rasterize the layers, but only if container has nonzero size

    if (width > 0 && height > 0) {
      buffCxt.clearRect(0, 0, width, height);
      buffCxt.globalCompositeOperation = 'source-over';
      var zsortedEles = this.getCachedZSortedEles();

      if (options.full) {
        // draw the full bounds of the graph
        buffCxt.translate(-bb.x1 * scale, -bb.y1 * scale);
        buffCxt.scale(scale, scale);
        this.drawElements(buffCxt, zsortedEles);
        buffCxt.scale(1 / scale, 1 / scale);
        buffCxt.translate(bb.x1 * scale, bb.y1 * scale);
      } else {
        // draw the current view
        var pan = cy.pan();
        var translation = {
          x: pan.x * scale,
          y: pan.y * scale
        };
        scale *= cy.zoom();
        buffCxt.translate(translation.x, translation.y);
        buffCxt.scale(scale, scale);
        this.drawElements(buffCxt, zsortedEles);
        buffCxt.scale(1 / scale, 1 / scale);
        buffCxt.translate(-translation.x, -translation.y);
      } // need to fill bg at end like this in order to fill cleared transparent pixels in jpgs


      if (options.bg) {
        buffCxt.globalCompositeOperation = 'destination-over';
        buffCxt.fillStyle = options.bg;
        buffCxt.rect(0, 0, width, height);
        buffCxt.fill();
      }
    }

    return buffCanvas;
  };

  function b64ToBlob(b64, mimeType) {
    var bytes = atob(b64);
    var buff = new ArrayBuffer(bytes.length);
    var buffUint8 = new Uint8Array(buff);

    for (var i = 0; i < bytes.length; i++) {
      buffUint8[i] = bytes.charCodeAt(i);
    }

    return new Blob([buff], {
      type: mimeType
    });
  }

  function b64UriToB64(b64uri) {
    var i = b64uri.indexOf(',');
    return b64uri.substr(i + 1);
  }

  function output(options, canvas, mimeType) {
    var getB64Uri = function getB64Uri() {
      return canvas.toDataURL(mimeType, options.quality);
    };

    switch (options.output) {
      case 'blob-promise':
        return new Promise$1(function (resolve, reject) {
          try {
            canvas.toBlob(function (blob) {
              if (blob != null) {
                resolve(blob);
              } else {
                reject(new Error('`canvas.toBlob()` sent a null value in its callback'));
              }
            }, mimeType, options.quality);
          } catch (err) {
            reject(err);
          }
        });

      case 'blob':
        return b64ToBlob(b64UriToB64(getB64Uri()), mimeType);

      case 'base64':
        return b64UriToB64(getB64Uri());

      case 'base64uri':
      default:
        return getB64Uri();
    }
  }

  CRp$8.png = function (options) {
    return output(options, this.bufferCanvasImage(options), 'image/png');
  };

  CRp$8.jpg = function (options) {
    return output(options, this.bufferCanvasImage(options), 'image/jpeg');
  };

  var CRp$9 = {};

  CRp$9.nodeShapeImpl = function (name, context, centerX, centerY, width, height, points) {
    switch (name) {
      case 'ellipse':
        return this.drawEllipsePath(context, centerX, centerY, width, height);

      case 'polygon':
        return this.drawPolygonPath(context, centerX, centerY, width, height, points);

      case 'round-polygon':
        return this.drawRoundPolygonPath(context, centerX, centerY, width, height, points);

      case 'roundrectangle':
      case 'round-rectangle':
        return this.drawRoundRectanglePath(context, centerX, centerY, width, height);

      case 'cutrectangle':
      case 'cut-rectangle':
        return this.drawCutRectanglePath(context, centerX, centerY, width, height);

      case 'bottomroundrectangle':
      case 'bottom-round-rectangle':
        return this.drawBottomRoundRectanglePath(context, centerX, centerY, width, height);

      case 'barrel':
        return this.drawBarrelPath(context, centerX, centerY, width, height);
    }
  };

  var CR = CanvasRenderer;
  var CRp$a = CanvasRenderer.prototype;
  CRp$a.CANVAS_LAYERS = 3; //

  CRp$a.SELECT_BOX = 0;
  CRp$a.DRAG = 1;
  CRp$a.NODE = 2;
  CRp$a.BUFFER_COUNT = 3; //

  CRp$a.TEXTURE_BUFFER = 0;
  CRp$a.MOTIONBLUR_BUFFER_NODE = 1;
  CRp$a.MOTIONBLUR_BUFFER_DRAG = 2;

  function CanvasRenderer(options) {
    var r = this;
    r.data = {
      canvases: new Array(CRp$a.CANVAS_LAYERS),
      contexts: new Array(CRp$a.CANVAS_LAYERS),
      canvasNeedsRedraw: new Array(CRp$a.CANVAS_LAYERS),
      bufferCanvases: new Array(CRp$a.BUFFER_COUNT),
      bufferContexts: new Array(CRp$a.CANVAS_LAYERS)
    };
    var tapHlOffAttr = '-webkit-tap-highlight-color';
    var tapHlOffStyle = 'rgba(0,0,0,0)';
    r.data.canvasContainer = document.createElement('div'); // eslint-disable-line no-undef

    var containerStyle = r.data.canvasContainer.style;
    r.data.canvasContainer.style[tapHlOffAttr] = tapHlOffStyle;
    containerStyle.position = 'relative';
    containerStyle.zIndex = '0';
    containerStyle.overflow = 'hidden';
    var container = options.cy.container();
    container.appendChild(r.data.canvasContainer);
    container.style[tapHlOffAttr] = tapHlOffStyle;
    var styleMap = {
      '-webkit-user-select': 'none',
      '-moz-user-select': '-moz-none',
      'user-select': 'none',
      '-webkit-tap-highlight-color': 'rgba(0,0,0,0)',
      'outline-style': 'none'
    };

    if (ms()) {
      styleMap['-ms-touch-action'] = 'none';
      styleMap['touch-action'] = 'none';
    }

    for (var i = 0; i < CRp$a.CANVAS_LAYERS; i++) {
      var canvas = r.data.canvases[i] = document.createElement('canvas'); // eslint-disable-line no-undef

      r.data.contexts[i] = canvas.getContext('2d');
      Object.keys(styleMap).forEach(function (k) {
        canvas.style[k] = styleMap[k];
      });
      canvas.style.position = 'absolute';
      canvas.setAttribute('data-id', 'layer' + i);
      canvas.style.zIndex = String(CRp$a.CANVAS_LAYERS - i);
      r.data.canvasContainer.appendChild(canvas);
      r.data.canvasNeedsRedraw[i] = false;
    }

    r.data.topCanvas = r.data.canvases[0];
    r.data.canvases[CRp$a.NODE].setAttribute('data-id', 'layer' + CRp$a.NODE + '-node');
    r.data.canvases[CRp$a.SELECT_BOX].setAttribute('data-id', 'layer' + CRp$a.SELECT_BOX + '-selectbox');
    r.data.canvases[CRp$a.DRAG].setAttribute('data-id', 'layer' + CRp$a.DRAG + '-drag');

    for (var i = 0; i < CRp$a.BUFFER_COUNT; i++) {
      r.data.bufferCanvases[i] = document.createElement('canvas'); // eslint-disable-line no-undef

      r.data.bufferContexts[i] = r.data.bufferCanvases[i].getContext('2d');
      r.data.bufferCanvases[i].style.position = 'absolute';
      r.data.bufferCanvases[i].setAttribute('data-id', 'buffer' + i);
      r.data.bufferCanvases[i].style.zIndex = String(-i - 1);
      r.data.bufferCanvases[i].style.visibility = 'hidden'; //r.data.canvasContainer.appendChild(r.data.bufferCanvases[i]);
    }

    r.pathsEnabled = true;
    var emptyBb = makeBoundingBox();

    var getBoxCenter = function getBoxCenter(bb) {
      return {
        x: (bb.x1 + bb.x2) / 2,
        y: (bb.y1 + bb.y2) / 2
      };
    };

    var getCenterOffset = function getCenterOffset(bb) {
      return {
        x: -bb.w / 2,
        y: -bb.h / 2
      };
    };

    var backgroundTimestampHasChanged = function backgroundTimestampHasChanged(ele) {
      var _p = ele[0]._private;
      var same = _p.oldBackgroundTimestamp === _p.backgroundTimestamp;
      return !same;
    };

    var getStyleKey = function getStyleKey(ele) {
      return ele[0]._private.nodeKey;
    };

    var getLabelKey = function getLabelKey(ele) {
      return ele[0]._private.labelStyleKey;
    };

    var getSourceLabelKey = function getSourceLabelKey(ele) {
      return ele[0]._private.sourceLabelStyleKey;
    };

    var getTargetLabelKey = function getTargetLabelKey(ele) {
      return ele[0]._private.targetLabelStyleKey;
    };

    var drawElement = function drawElement(context, ele, bb, scaledLabelShown, useEleOpacity) {
      return r.drawElement(context, ele, bb, false, false, useEleOpacity);
    };

    var drawLabel = function drawLabel(context, ele, bb, scaledLabelShown, useEleOpacity) {
      return r.drawElementText(context, ele, bb, scaledLabelShown, 'main', useEleOpacity);
    };

    var drawSourceLabel = function drawSourceLabel(context, ele, bb, scaledLabelShown, useEleOpacity) {
      return r.drawElementText(context, ele, bb, scaledLabelShown, 'source', useEleOpacity);
    };

    var drawTargetLabel = function drawTargetLabel(context, ele, bb, scaledLabelShown, useEleOpacity) {
      return r.drawElementText(context, ele, bb, scaledLabelShown, 'target', useEleOpacity);
    };

    var getElementBox = function getElementBox(ele) {
      ele.boundingBox();
      return ele[0]._private.bodyBounds;
    };

    var getLabelBox = function getLabelBox(ele) {
      ele.boundingBox();
      return ele[0]._private.labelBounds.main || emptyBb;
    };

    var getSourceLabelBox = function getSourceLabelBox(ele) {
      ele.boundingBox();
      return ele[0]._private.labelBounds.source || emptyBb;
    };

    var getTargetLabelBox = function getTargetLabelBox(ele) {
      ele.boundingBox();
      return ele[0]._private.labelBounds.target || emptyBb;
    };

    var isLabelVisibleAtScale = function isLabelVisibleAtScale(ele, scaledLabelShown) {
      return scaledLabelShown;
    };

    var getElementRotationPoint = function getElementRotationPoint(ele) {
      return getBoxCenter(getElementBox(ele));
    };

    var addTextMargin = function addTextMargin(prefix, pt, ele) {
      var pre = prefix ? prefix + '-' : '';
      return {
        x: pt.x + ele.pstyle(pre + 'text-margin-x').pfValue,
        y: pt.y + ele.pstyle(pre + 'text-margin-y').pfValue
      };
    };

    var getRsPt = function getRsPt(ele, x, y) {
      var rs = ele[0]._private.rscratch;
      return {
        x: rs[x],
        y: rs[y]
      };
    };

    var getLabelRotationPoint = function getLabelRotationPoint(ele) {
      return addTextMargin('', getRsPt(ele, 'labelX', 'labelY'), ele);
    };

    var getSourceLabelRotationPoint = function getSourceLabelRotationPoint(ele) {
      return addTextMargin('source', getRsPt(ele, 'sourceLabelX', 'sourceLabelY'), ele);
    };

    var getTargetLabelRotationPoint = function getTargetLabelRotationPoint(ele) {
      return addTextMargin('target', getRsPt(ele, 'targetLabelX', 'targetLabelY'), ele);
    };

    var getElementRotationOffset = function getElementRotationOffset(ele) {
      return getCenterOffset(getElementBox(ele));
    };

    var getSourceLabelRotationOffset = function getSourceLabelRotationOffset(ele) {
      return getCenterOffset(getSourceLabelBox(ele));
    };

    var getTargetLabelRotationOffset = function getTargetLabelRotationOffset(ele) {
      return getCenterOffset(getTargetLabelBox(ele));
    };

    var getLabelRotationOffset = function getLabelRotationOffset(ele) {
      var bb = getLabelBox(ele);
      var p = getCenterOffset(getLabelBox(ele));

      if (ele.isNode()) {
        switch (ele.pstyle('text-halign').value) {
          case 'left':
            p.x = -bb.w;
            break;

          case 'right':
            p.x = 0;
            break;
        }

        switch (ele.pstyle('text-valign').value) {
          case 'top':
            p.y = -bb.h;
            break;

          case 'bottom':
            p.y = 0;
            break;
        }
      }

      return p;
    };

    var eleTxrCache = r.data.eleTxrCache = new ElementTextureCache(r, {
      getKey: getStyleKey,
      doesEleInvalidateKey: backgroundTimestampHasChanged,
      drawElement: drawElement,
      getBoundingBox: getElementBox,
      getRotationPoint: getElementRotationPoint,
      getRotationOffset: getElementRotationOffset,
      allowEdgeTxrCaching: false,
      allowParentTxrCaching: false
    });
    var lblTxrCache = r.data.lblTxrCache = new ElementTextureCache(r, {
      getKey: getLabelKey,
      drawElement: drawLabel,
      getBoundingBox: getLabelBox,
      getRotationPoint: getLabelRotationPoint,
      getRotationOffset: getLabelRotationOffset,
      isVisible: isLabelVisibleAtScale
    });
    var slbTxrCache = r.data.slbTxrCache = new ElementTextureCache(r, {
      getKey: getSourceLabelKey,
      drawElement: drawSourceLabel,
      getBoundingBox: getSourceLabelBox,
      getRotationPoint: getSourceLabelRotationPoint,
      getRotationOffset: getSourceLabelRotationOffset,
      isVisible: isLabelVisibleAtScale
    });
    var tlbTxrCache = r.data.tlbTxrCache = new ElementTextureCache(r, {
      getKey: getTargetLabelKey,
      drawElement: drawTargetLabel,
      getBoundingBox: getTargetLabelBox,
      getRotationPoint: getTargetLabelRotationPoint,
      getRotationOffset: getTargetLabelRotationOffset,
      isVisible: isLabelVisibleAtScale
    });
    var lyrTxrCache = r.data.lyrTxrCache = new LayeredTextureCache(r);
    r.onUpdateEleCalcs(function invalidateTextureCaches(willDraw, eles) {
      // each cache should check for sub-key diff to see that the update affects that cache particularly
      eleTxrCache.invalidateElements(eles);
      lblTxrCache.invalidateElements(eles);
      slbTxrCache.invalidateElements(eles);
      tlbTxrCache.invalidateElements(eles); // any change invalidates the layers

      lyrTxrCache.invalidateElements(eles); // update the old bg timestamp so diffs can be done in the ele txr caches

      for (var _i = 0; _i < eles.length; _i++) {
        var _p = eles[_i]._private;
        _p.oldBackgroundTimestamp = _p.backgroundTimestamp;
      }
    });

    var refineInLayers = function refineInLayers(reqs) {
      for (var i = 0; i < reqs.length; i++) {
        lyrTxrCache.enqueueElementRefinement(reqs[i].ele);
      }
    };

    eleTxrCache.onDequeue(refineInLayers);
    lblTxrCache.onDequeue(refineInLayers);
    slbTxrCache.onDequeue(refineInLayers);
    tlbTxrCache.onDequeue(refineInLayers);
  }

  CRp$a.redrawHint = function (group, bool) {
    var r = this;

    switch (group) {
      case 'eles':
        r.data.canvasNeedsRedraw[CRp$a.NODE] = bool;
        break;

      case 'drag':
        r.data.canvasNeedsRedraw[CRp$a.DRAG] = bool;
        break;

      case 'select':
        r.data.canvasNeedsRedraw[CRp$a.SELECT_BOX] = bool;
        break;
    }
  }; // whether to use Path2D caching for drawing


  var pathsImpld = typeof Path2D !== 'undefined';

  CRp$a.path2dEnabled = function (on) {
    if (on === undefined) {
      return this.pathsEnabled;
    }

    this.pathsEnabled = on ? true : false;
  };

  CRp$a.usePaths = function () {
    return pathsImpld && this.pathsEnabled;
  };

  CRp$a.setImgSmoothing = function (context, bool) {
    if (context.imageSmoothingEnabled != null) {
      context.imageSmoothingEnabled = bool;
    } else {
      context.webkitImageSmoothingEnabled = bool;
      context.mozImageSmoothingEnabled = bool;
      context.msImageSmoothingEnabled = bool;
    }
  };

  CRp$a.getImgSmoothing = function (context) {
    if (context.imageSmoothingEnabled != null) {
      return context.imageSmoothingEnabled;
    } else {
      return context.webkitImageSmoothingEnabled || context.mozImageSmoothingEnabled || context.msImageSmoothingEnabled;
    }
  };

  CRp$a.makeOffscreenCanvas = function (width, height) {
    var canvas;

    if ((typeof OffscreenCanvas === "undefined" ? "undefined" : _typeof(OffscreenCanvas)) !== ( "undefined" )) {
      canvas = new OffscreenCanvas(width, height);
    } else {
      canvas = document.createElement('canvas'); // eslint-disable-line no-undef

      canvas.width = width;
      canvas.height = height;
    }

    return canvas;
  };

  [CRp, CRp$1, CRp$2, CRp$3, CRp$4, CRp$5, CRp$6, CRp$7, CRp$8, CRp$9].forEach(function (props) {
    extend(CRp$a, props);
  });

  var renderer = [{
    name: 'null',
    impl: NullRenderer
  }, {
    name: 'base',
    impl: BR
  }, {
    name: 'canvas',
    impl: CR
  }];

  var incExts = [{
    type: 'layout',
    extensions: layout
  }, {
    type: 'renderer',
    extensions: renderer
  }];

  var extensions = {}; // registered modules for extensions, indexed by name

  var modules = {};

  function setExtension(type, name, registrant) {
    var ext = registrant;

    var overrideErr = function overrideErr(field) {
      error('Can not register `' + name + '` for `' + type + '` since `' + field + '` already exists in the prototype and can not be overridden');
    };

    if (type === 'core') {
      if (Core.prototype[name]) {
        return overrideErr(name);
      } else {
        Core.prototype[name] = registrant;
      }
    } else if (type === 'collection') {
      if (Collection.prototype[name]) {
        return overrideErr(name);
      } else {
        Collection.prototype[name] = registrant;
      }
    } else if (type === 'layout') {
      // fill in missing layout functions in the prototype
      var Layout = function Layout(options) {
        this.options = options;
        registrant.call(this, options); // make sure layout has _private for use w/ std apis like .on()

        if (!plainObject(this._private)) {
          this._private = {};
        }

        this._private.cy = options.cy;
        this._private.listeners = [];
        this.createEmitter();
      };

      var layoutProto = Layout.prototype = Object.create(registrant.prototype);
      var optLayoutFns = [];

      for (var i = 0; i < optLayoutFns.length; i++) {
        var fnName = optLayoutFns[i];

        layoutProto[fnName] = layoutProto[fnName] || function () {
          return this;
        };
      } // either .start() or .run() is defined, so autogen the other


      if (layoutProto.start && !layoutProto.run) {
        layoutProto.run = function () {
          this.start();
          return this;
        };
      } else if (!layoutProto.start && layoutProto.run) {
        layoutProto.start = function () {
          this.run();
          return this;
        };
      }

      var regStop = registrant.prototype.stop;

      layoutProto.stop = function () {
        var opts = this.options;

        if (opts && opts.animate) {
          var anis = this.animations;

          if (anis) {
            for (var _i = 0; _i < anis.length; _i++) {
              anis[_i].stop();
            }
          }
        }

        if (regStop) {
          regStop.call(this);
        } else {
          this.emit('layoutstop');
        }

        return this;
      };

      if (!layoutProto.destroy) {
        layoutProto.destroy = function () {
          return this;
        };
      }

      layoutProto.cy = function () {
        return this._private.cy;
      };

      var getCy = function getCy(layout) {
        return layout._private.cy;
      };

      var emitterOpts = {
        addEventFields: function addEventFields(layout, evt) {
          evt.layout = layout;
          evt.cy = getCy(layout);
          evt.target = layout;
        },
        bubble: function bubble() {
          return true;
        },
        parent: function parent(layout) {
          return getCy(layout);
        }
      };
      extend(layoutProto, {
        createEmitter: function createEmitter() {
          this._private.emitter = new Emitter(emitterOpts, this);
          return this;
        },
        emitter: function emitter() {
          return this._private.emitter;
        },
        on: function on(evt, cb) {
          this.emitter().on(evt, cb);
          return this;
        },
        one: function one(evt, cb) {
          this.emitter().one(evt, cb);
          return this;
        },
        once: function once(evt, cb) {
          this.emitter().one(evt, cb);
          return this;
        },
        removeListener: function removeListener(evt, cb) {
          this.emitter().removeListener(evt, cb);
          return this;
        },
        removeAllListeners: function removeAllListeners() {
          this.emitter().removeAllListeners();
          return this;
        },
        emit: function emit(evt, params) {
          this.emitter().emit(evt, params);
          return this;
        }
      });
      define$3.eventAliasesOn(layoutProto);
      ext = Layout; // replace with our wrapped layout
    } else if (type === 'renderer' && name !== 'null' && name !== 'base') {
      // user registered renderers inherit from base
      var BaseRenderer = getExtension('renderer', 'base');
      var bProto = BaseRenderer.prototype;
      var RegistrantRenderer = registrant;
      var rProto = registrant.prototype;

      var Renderer = function Renderer() {
        BaseRenderer.apply(this, arguments);
        RegistrantRenderer.apply(this, arguments);
      };

      var proto = Renderer.prototype;

      for (var pName in bProto) {
        var pVal = bProto[pName];
        var existsInR = rProto[pName] != null;

        if (existsInR) {
          return overrideErr(pName);
        }

        proto[pName] = pVal; // take impl from base
      }

      for (var _pName in rProto) {
        proto[_pName] = rProto[_pName]; // take impl from registrant
      }

      bProto.clientFunctions.forEach(function (name) {
        proto[name] = proto[name] || function () {
          error('Renderer does not implement `renderer.' + name + '()` on its prototype');
        };
      });
      ext = Renderer;
    }

    return setMap({
      map: extensions,
      keys: [type, name],
      value: ext
    });
  }

  function getExtension(type, name) {
    return getMap({
      map: extensions,
      keys: [type, name]
    });
  }

  function setModule(type, name, moduleType, moduleName, registrant) {
    return setMap({
      map: modules,
      keys: [type, name, moduleType, moduleName],
      value: registrant
    });
  }

  function getModule(type, name, moduleType, moduleName) {
    return getMap({
      map: modules,
      keys: [type, name, moduleType, moduleName]
    });
  }

  var extension = function extension() {
    // e.g. extension('renderer', 'svg')
    if (arguments.length === 2) {
      return getExtension.apply(null, arguments);
    } // e.g. extension('renderer', 'svg', { ... })
    else if (arguments.length === 3) {
        return setExtension.apply(null, arguments);
      } // e.g. extension('renderer', 'svg', 'nodeShape', 'ellipse')
      else if (arguments.length === 4) {
          return getModule.apply(null, arguments);
        } // e.g. extension('renderer', 'svg', 'nodeShape', 'ellipse', { ... })
        else if (arguments.length === 5) {
            return setModule.apply(null, arguments);
          } else {
            error('Invalid extension access syntax');
          }
  }; // allows a core instance to access extensions internally


  Core.prototype.extension = extension; // included extensions

  incExts.forEach(function (group) {
    group.extensions.forEach(function (ext) {
      setExtension(group.type, ext.name, ext.impl);
    });
  });

  // (useful for init)

  var Stylesheet = function Stylesheet() {
    if (!(this instanceof Stylesheet)) {
      return new Stylesheet();
    }

    this.length = 0;
  };

  var sheetfn = Stylesheet.prototype;

  sheetfn.instanceString = function () {
    return 'stylesheet';
  }; // just store the selector to be parsed later


  sheetfn.selector = function (selector) {
    var i = this.length++;
    this[i] = {
      selector: selector,
      properties: []
    };
    return this; // chaining
  }; // just store the property to be parsed later


  sheetfn.css = function (name, value) {
    var i = this.length - 1;

    if (string(name)) {
      this[i].properties.push({
        name: name,
        value: value
      });
    } else if (plainObject(name)) {
      var map = name;
      var propNames = Object.keys(map);

      for (var j = 0; j < propNames.length; j++) {
        var key = propNames[j];
        var mapVal = map[key];

        if (mapVal == null) {
          continue;
        }

        var prop = Style.properties[key] || Style.properties[dash2camel(key)];

        if (prop == null) {
          continue;
        }

        var _name = prop.name;
        var _value = mapVal;
        this[i].properties.push({
          name: _name,
          value: _value
        });
      }
    }

    return this; // chaining
  };

  sheetfn.style = sheetfn.css; // generate a real style object from the dummy stylesheet

  sheetfn.generateStyle = function (cy) {
    var style = new Style(cy);
    return this.appendToStyle(style);
  }; // append a dummy stylesheet object on a real style object


  sheetfn.appendToStyle = function (style) {
    for (var i = 0; i < this.length; i++) {
      var context = this[i];
      var selector = context.selector;
      var props = context.properties;
      style.selector(selector); // apply selector

      for (var j = 0; j < props.length; j++) {
        var prop = props[j];
        style.css(prop.name, prop.value); // apply property
      }
    }

    return style;
  };

  var version = "3.16.0";

  var cytoscape = function cytoscape(options) {
    // if no options specified, use default
    if (options === undefined) {
      options = {};
    } // create instance


    if (plainObject(options)) {
      return new Core(options);
    } // allow for registration of extensions
    else if (string(options)) {
        return extension.apply(extension, arguments);
      }
  }; // e.g. cytoscape.use( require('cytoscape-foo'), bar )


  cytoscape.use = function (ext) {
    var args = Array.prototype.slice.call(arguments, 1); // args to pass to ext

    args.unshift(cytoscape); // cytoscape is first arg to ext

    ext.apply(null, args);
    return this;
  };

  cytoscape.warnings = function (bool) {
    return warnings(bool);
  }; // replaced by build system


  cytoscape.version = version; // expose public apis (mostly for extensions)

  cytoscape.stylesheet = cytoscape.Stylesheet = Stylesheet;

  return cytoscape;

})));
