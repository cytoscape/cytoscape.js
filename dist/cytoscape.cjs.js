(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory(require("lodash.debounce"), require("heap"));
	else if(typeof define === 'function' && define.amd)
		define(["lodash.debounce", "heap"], factory);
	else if(typeof exports === 'object')
		exports["cytoscape"] = factory(require("lodash.debounce"), require("heap"));
	else
		root["cytoscape"] = factory(root["lodash.debounce"], root["heap"]);
})(typeof self !== 'undefined' ? self : this, function(__WEBPACK_EXTERNAL_MODULE_26__, __WEBPACK_EXTERNAL_MODULE_32__) {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 20);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

/*global HTMLElement DocumentTouch */

var window = __webpack_require__(3);
var navigator = window ? window.navigator : null;
var document = window ? window.document : null;

var typeofstr = _typeof('');
var typeofobj = _typeof({});
var typeoffn = _typeof(function () {});
var typeofhtmlele = typeof HTMLElement === 'undefined' ? 'undefined' : _typeof(HTMLElement);

var instanceStr = function instanceStr(obj) {
  return obj && obj.instanceString && is.fn(obj.instanceString) ? obj.instanceString() : null;
};

var is = {
  defined: function defined(obj) {
    return obj != null; // not undefined or null
  },

  string: function string(obj) {
    return obj != null && (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) == typeofstr;
  },

  fn: function fn(obj) {
    return obj != null && (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) === typeoffn;
  },

  array: function array(obj) {
    return Array.isArray ? Array.isArray(obj) : obj != null && obj instanceof Array;
  },

  plainObject: function plainObject(obj) {
    return obj != null && (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) === typeofobj && !is.array(obj) && obj.constructor === Object;
  },

  object: function object(obj) {
    return obj != null && (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) === typeofobj;
  },

  number: function number(obj) {
    return obj != null && (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) === _typeof(1) && !isNaN(obj);
  },

  integer: function integer(obj) {
    return is.number(obj) && Math.floor(obj) === obj;
  },

  bool: function bool(obj) {
    return obj != null && (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) === _typeof(true);
  },

  htmlElement: function htmlElement(obj) {
    if ('undefined' === typeofhtmlele) {
      return undefined;
    } else {
      return null != obj && obj instanceof HTMLElement;
    }
  },

  elementOrCollection: function elementOrCollection(obj) {
    return is.element(obj) || is.collection(obj);
  },

  element: function element(obj) {
    return instanceStr(obj) === 'collection' && obj._private.single;
  },

  collection: function collection(obj) {
    return instanceStr(obj) === 'collection' && !obj._private.single;
  },

  core: function core(obj) {
    return instanceStr(obj) === 'core';
  },

  style: function style(obj) {
    return instanceStr(obj) === 'style';
  },

  stylesheet: function stylesheet(obj) {
    return instanceStr(obj) === 'stylesheet';
  },

  event: function event(obj) {
    return instanceStr(obj) === 'event';
  },

  thread: function thread(obj) {
    return instanceStr(obj) === 'thread';
  },

  fabric: function fabric(obj) {
    return instanceStr(obj) === 'fabric';
  },

  emptyString: function emptyString(obj) {
    if (obj === undefined || obj === null) {
      // null is empty
      return true;
    } else if (obj === '' || obj.match(/^\s+$/)) {
      return true; // empty string is empty
    }

    return false; // otherwise, we don't know what we've got
  },

  nonemptyString: function nonemptyString(obj) {
    if (obj && is.string(obj) && obj !== '' && !obj.match(/^\s+$/)) {
      return true;
    }

    return false;
  },

  domElement: function domElement(obj) {
    if (typeof HTMLElement === 'undefined') {
      return false; // we're not in a browser so it doesn't matter
    } else {
      return obj instanceof HTMLElement;
    }
  },

  boundingBox: function boundingBox(obj) {
    return is.plainObject(obj) && is.number(obj.x1) && is.number(obj.x2) && is.number(obj.y1) && is.number(obj.y2);
  },

  promise: function promise(obj) {
    return is.object(obj) && is.fn(obj.then);
  },

  touch: function touch() {
    return window && ('ontouchstart' in window || window.DocumentTouch && document instanceof DocumentTouch);
  },

  gecko: function gecko() {
    return window && (typeof InstallTrigger !== 'undefined' || 'MozAppearance' in document.documentElement.style);
  },

  webkit: function webkit() {
    return window && (typeof webkitURL !== 'undefined' || 'WebkitAppearance' in document.documentElement.style);
  },

  chromium: function chromium() {
    return window && typeof chrome !== 'undefined';
  },

  khtml: function khtml() {
    return navigator && navigator.vendor.match(/kde/i); // probably a better way to detect this...
  },

  khtmlEtc: function khtmlEtc() {
    return is.khtml() || is.webkit() || is.chromium();
  },

  ms: function ms() {
    return navigator && navigator.userAgent.match(/msie|trident|edge/i); // probably a better way to detect this...
  },

  windows: function windows() {
    return navigator && navigator.appVersion.match(/Win/i);
  },

  mac: function mac() {
    return navigator && navigator.appVersion.match(/Mac/i);
  },

  linux: function linux() {
    return navigator && navigator.appVersion.match(/Linux/i);
  },

  unix: function unix() {
    return navigator && navigator.appVersion.match(/X11/i);
  }
};

module.exports = is;

/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/*global console */

var is = __webpack_require__(0);
var math = __webpack_require__(2);

var util = {

  MAX_INT: Number.MAX_SAFE_INTEGER || 9007199254740991,

  trueify: function trueify() {
    return true;
  },

  falsify: function falsify() {
    return false;
  },

  zeroify: function zeroify() {
    return 0;
  },

  noop: function noop() {},

  error: function error(msg) {
    /* eslint-disable */
    if (console.error) {
      console.error.apply(console, arguments);

      if (console.trace) {
        console.trace();
      }
    } else {
      console.log.apply(console, arguments);

      if (console.trace) {
        console.trace();
      }
    }
    /* eslint-enable */
  },

  clone: function clone(obj) {
    return this.extend({}, obj);
  },

  // gets a shallow copy of the argument
  copy: function copy(obj) {
    if (obj == null) {
      return obj;
    }if (is.array(obj)) {
      return obj.slice();
    } else if (is.plainObject(obj)) {
      return this.clone(obj);
    } else {
      return obj;
    }
  },

  copyArray: function copyArray(arr) {
    return arr.slice();
  },

  clonePosition: function clonePosition(pos) {
    return { x: pos.x, y: pos.y };
  },

  uuid: function uuid(a, b // placeholders
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
    ) {}
    return b;
  }

};

util.makeBoundingBox = math.makeBoundingBox.bind(math);

util._staticEmptyObject = {};

util.staticEmptyObject = function () {
  return util._staticEmptyObject;
};

util.extend = Object.assign != null ? Object.assign.bind(Object) : function (tgt) {
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

util.assign = util.extend;

util.default = function (val, def) {
  if (val === undefined) {
    return def;
  } else {
    return val;
  }
};

util.removeFromArray = function (arr, ele, manyCopies) {
  for (var i = arr.length; i >= 0; i--) {
    if (arr[i] === ele) {
      arr.splice(i, 1);

      if (!manyCopies) {
        break;
      }
    }
  }
};

util.clearArray = function (arr) {
  arr.splice(0, arr.length);
};

util.push = function (arr, otherArr) {
  for (var i = 0; i < otherArr.length; i++) {
    var el = otherArr[i];

    arr.push(el);
  }
};

util.getPrefixedProperty = function (obj, propName, prefix) {
  if (prefix) {
    propName = this.prependCamel(prefix, propName); // e.g. (labelWidth, source) => sourceLabelWidth
  }

  return obj[propName];
};

util.setPrefixedProperty = function (obj, propName, prefix, value) {
  if (prefix) {
    propName = this.prependCamel(prefix, propName); // e.g. (labelWidth, source) => sourceLabelWidth
  }

  obj[propName] = value;
};

[__webpack_require__(21), __webpack_require__(22), { memoize: __webpack_require__(13) }, __webpack_require__(23), __webpack_require__(24), __webpack_require__(25), __webpack_require__(27)].forEach(function (req) {
  util.extend(util, req);
});

module.exports = util;

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var math = {};

math.arePositionsSame = function (p1, p2) {
  return p1.x === p2.x && p1.y === p2.y;
};

math.copyPosition = function (p) {
  return { x: p.x, y: p.y };
};

math.modelToRenderedPosition = function (p, zoom, pan) {
  return {
    x: p.x * zoom + pan.x,
    y: p.y * zoom + pan.y
  };
};

math.renderedToModelPosition = function (p, zoom, pan) {
  return {
    x: (p.x - pan.x) / zoom,
    y: (p.y - pan.y) / zoom
  };
};

math.array2point = function (arr) {
  return {
    x: arr[0],
    y: arr[1]
  };
};

math.deg2rad = function (deg) {
  return Math.PI * deg / 180;
};

math.getAngleFromDisp = function (dispX, dispY) {
  return Math.atan2(dispY, dispX) - Math.PI / 2;
};

math.log2 = Math.log2 || function (n) {
  return Math.log(n) / Math.log(2);
};

math.signum = function (x) {
  if (x > 0) {
    return 1;
  } else if (x < 0) {
    return -1;
  } else {
    return 0;
  }
};

math.dist = function (p1, p2) {
  return Math.sqrt(math.sqdist(p1, p2));
};

math.sqdist = function (p1, p2) {
  var dx = p2.x - p1.x;
  var dy = p2.y - p1.y;

  return dx * dx + dy * dy;
};

// from http://en.wikipedia.org/wiki/Bézier_curve#Quadratic_curves
math.qbezierAt = function (p0, p1, p2, t) {
  return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
};

math.qbezierPtAt = function (p0, p1, p2, t) {
  return {
    x: math.qbezierAt(p0.x, p1.x, p2.x, t),
    y: math.qbezierAt(p0.y, p1.y, p2.y, t)
  };
};

math.lineAt = function (p0, p1, t, d) {
  var vec = {
    x: p1.x - p0.x,
    y: p1.y - p0.y
  };

  var vecDist = math.dist(p0, p1);

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

math.lineAtDist = function (p0, p1, d) {
  return math.lineAt(p0, p1, undefined, d);
};

// get angle at A via cosine law
math.triangleAngle = function (A, B, C) {
  var a = math.dist(B, C);
  var b = math.dist(A, C);
  var c = math.dist(A, B);

  return Math.acos((a * a + b * b - c * c) / (2 * a * b));
};

math.bound = function (min, val, max) {
  return Math.max(min, Math.min(max, val));
};

// makes a full bb (x1, y1, x2, y2, w, h) from implicit params
math.makeBoundingBox = function (bb) {
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

math.updateBoundingBox = function (bb1, bb2) {
  // update bb1 with bb2 bounds

  bb1.x1 = Math.min(bb1.x1, bb2.x1);
  bb1.x2 = Math.max(bb1.x2, bb2.x2);
  bb1.w = bb1.x2 - bb1.x1;

  bb1.y1 = Math.min(bb1.y1, bb2.y1);
  bb1.y2 = Math.max(bb1.y2, bb2.y2);
  bb1.h = bb1.y2 - bb1.y1;
};

math.expandBoundingBoxByPoint = function (bb, x, y) {
  bb.x1 = Math.min(bb.x1, x);
  bb.x2 = Math.max(bb.x2, x);
  bb.w = bb.x2 - bb.x1;

  bb.y1 = Math.min(bb.y1, y);
  bb.y2 = Math.max(bb.y2, y);
  bb.h = bb.y2 - bb.y1;
};

math.expandBoundingBox = function (bb, padding) {
  bb.x1 -= padding;
  bb.x2 += padding;
  bb.y1 -= padding;
  bb.y2 += padding;
  bb.w = bb.x2 - bb.x1;
  bb.h = bb.y2 - bb.y1;

  return bb;
};

math.boundingBoxesIntersect = function (bb1, bb2) {
  // case: one bb to right of other
  if (bb1.x1 > bb2.x2) {
    return false;
  }
  if (bb2.x1 > bb1.x2) {
    return false;
  }

  // case: one bb to left of other
  if (bb1.x2 < bb2.x1) {
    return false;
  }
  if (bb2.x2 < bb1.x1) {
    return false;
  }

  // case: one bb above other
  if (bb1.y2 < bb2.y1) {
    return false;
  }
  if (bb2.y2 < bb1.y1) {
    return false;
  }

  // case: one bb below other
  if (bb1.y1 > bb2.y2) {
    return false;
  }
  if (bb2.y1 > bb1.y2) {
    return false;
  }

  // otherwise, must have some overlap
  return true;
};

math.inBoundingBox = function (bb, x, y) {
  return bb.x1 <= x && x <= bb.x2 && bb.y1 <= y && y <= bb.y2;
};

math.pointInBoundingBox = function (bb, pt) {
  return this.inBoundingBox(bb, pt.x, pt.y);
};

math.boundingBoxInBoundingBox = function (bb1, bb2) {
  return math.inBoundingBox(bb1, bb2.x1, bb2.y1) && math.inBoundingBox(bb1, bb2.x2, bb2.y2);
};

math.roundRectangleIntersectLine = function (x, y, nodeX, nodeY, width, height, padding) {

  var cornerRadius = this.getRoundRectangleRadius(width, height);

  var halfWidth = width / 2;
  var halfHeight = height / 2;

  // Check intersections with straight line segments
  var straightLineIntersections = void 0;

  // Top segment, left to right
  {
    var topStartX = nodeX - halfWidth + cornerRadius - padding;
    var topStartY = nodeY - halfHeight - padding;
    var topEndX = nodeX + halfWidth - cornerRadius + padding;
    var topEndY = topStartY;

    straightLineIntersections = this.finiteLinesIntersect(x, y, nodeX, nodeY, topStartX, topStartY, topEndX, topEndY, false);

    if (straightLineIntersections.length > 0) {
      return straightLineIntersections;
    }
  }

  // Right segment, top to bottom
  {
    var rightStartX = nodeX + halfWidth + padding;
    var rightStartY = nodeY - halfHeight + cornerRadius - padding;
    var rightEndX = rightStartX;
    var rightEndY = nodeY + halfHeight - cornerRadius + padding;

    straightLineIntersections = this.finiteLinesIntersect(x, y, nodeX, nodeY, rightStartX, rightStartY, rightEndX, rightEndY, false);

    if (straightLineIntersections.length > 0) {
      return straightLineIntersections;
    }
  }

  // Bottom segment, left to right
  {
    var bottomStartX = nodeX - halfWidth + cornerRadius - padding;
    var bottomStartY = nodeY + halfHeight + padding;
    var bottomEndX = nodeX + halfWidth - cornerRadius + padding;
    var bottomEndY = bottomStartY;

    straightLineIntersections = this.finiteLinesIntersect(x, y, nodeX, nodeY, bottomStartX, bottomStartY, bottomEndX, bottomEndY, false);

    if (straightLineIntersections.length > 0) {
      return straightLineIntersections;
    }
  }

  // Left segment, top to bottom
  {
    var leftStartX = nodeX - halfWidth - padding;
    var leftStartY = nodeY - halfHeight + cornerRadius - padding;
    var leftEndX = leftStartX;
    var leftEndY = nodeY + halfHeight - cornerRadius + padding;

    straightLineIntersections = this.finiteLinesIntersect(x, y, nodeX, nodeY, leftStartX, leftStartY, leftEndX, leftEndY, false);

    if (straightLineIntersections.length > 0) {
      return straightLineIntersections;
    }
  }

  // Check intersections with arc segments
  var arcIntersections = void 0;

  // Top Left
  {
    var topLeftCenterX = nodeX - halfWidth + cornerRadius;
    var topLeftCenterY = nodeY - halfHeight + cornerRadius;
    arcIntersections = this.intersectLineCircle(x, y, nodeX, nodeY, topLeftCenterX, topLeftCenterY, cornerRadius + padding);

    // Ensure the intersection is on the desired quarter of the circle
    if (arcIntersections.length > 0 && arcIntersections[0] <= topLeftCenterX && arcIntersections[1] <= topLeftCenterY) {
      return [arcIntersections[0], arcIntersections[1]];
    }
  }

  // Top Right
  {
    var topRightCenterX = nodeX + halfWidth - cornerRadius;
    var topRightCenterY = nodeY - halfHeight + cornerRadius;
    arcIntersections = this.intersectLineCircle(x, y, nodeX, nodeY, topRightCenterX, topRightCenterY, cornerRadius + padding);

    // Ensure the intersection is on the desired quarter of the circle
    if (arcIntersections.length > 0 && arcIntersections[0] >= topRightCenterX && arcIntersections[1] <= topRightCenterY) {
      return [arcIntersections[0], arcIntersections[1]];
    }
  }

  // Bottom Right
  {
    var bottomRightCenterX = nodeX + halfWidth - cornerRadius;
    var bottomRightCenterY = nodeY + halfHeight - cornerRadius;
    arcIntersections = this.intersectLineCircle(x, y, nodeX, nodeY, bottomRightCenterX, bottomRightCenterY, cornerRadius + padding);

    // Ensure the intersection is on the desired quarter of the circle
    if (arcIntersections.length > 0 && arcIntersections[0] >= bottomRightCenterX && arcIntersections[1] >= bottomRightCenterY) {
      return [arcIntersections[0], arcIntersections[1]];
    }
  }

  // Bottom Left
  {
    var bottomLeftCenterX = nodeX - halfWidth + cornerRadius;
    var bottomLeftCenterY = nodeY + halfHeight - cornerRadius;
    arcIntersections = this.intersectLineCircle(x, y, nodeX, nodeY, bottomLeftCenterX, bottomLeftCenterY, cornerRadius + padding);

    // Ensure the intersection is on the desired quarter of the circle
    if (arcIntersections.length > 0 && arcIntersections[0] <= bottomLeftCenterX && arcIntersections[1] >= bottomLeftCenterY) {
      return [arcIntersections[0], arcIntersections[1]];
    }
  }

  return []; // if nothing
};

math.inLineVicinity = function (x, y, lx1, ly1, lx2, ly2, tolerance) {
  var t = tolerance;

  var x1 = Math.min(lx1, lx2);
  var x2 = Math.max(lx1, lx2);
  var y1 = Math.min(ly1, ly2);
  var y2 = Math.max(ly1, ly2);

  return x1 - t <= x && x <= x2 + t && y1 - t <= y && y <= y2 + t;
};

math.inBezierVicinity = function (x, y, x1, y1, x2, y2, x3, y3, tolerance) {

  var bb = {
    x1: Math.min(x1, x3, x2) - tolerance,
    x2: Math.max(x1, x3, x2) + tolerance,
    y1: Math.min(y1, y3, y2) - tolerance,
    y2: Math.max(y1, y3, y2) + tolerance
  };

  // if outside the rough bounding box for the bezier, then it can't be a hit
  if (x < bb.x1 || x > bb.x2 || y < bb.y1 || y > bb.y2) {
    // console.log('bezier out of rough bb')
    return false;
  } else {
    // console.log('do more expensive check');
    return true;
  }
};
math.solveQuadratic = function (a, b, c, val) {
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

math.solveCubic = function (a, b, c, d, result) {

  // Solves a cubic function, returns root in form [r1, i1, r2, i2, r3, i3], where
  // r is the real component, i is the imaginary component

  // An implementation of the Cardano method from the year 1545
  // http://en.wikipedia.org/wiki/Cubic_function#The_nature_of_the_roots

  b /= a;
  c /= a;
  d /= a;

  var discriminant = void 0,
      q = void 0,
      r = void 0,
      dum1 = void 0,
      s = void 0,
      t = void 0,
      term1 = void 0,
      r13 = void 0;

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

math.sqdistToQuadraticBezier = function (x, y, x1, y1, x2, y2, x3, y3) {

  // Find minimum distance by using the minimum of the distance
  // function between the given point and the curve

  // This gives the coefficients of the resulting cubic equation
  // whose roots tell us where a possible minimum is
  // (Coefficients are divided by 4)

  var a = 1.0 * x1 * x1 - 4 * x1 * x2 + 2 * x1 * x3 + 4 * x2 * x2 - 4 * x2 * x3 + x3 * x3 + y1 * y1 - 4 * y1 * y2 + 2 * y1 * y3 + 4 * y2 * y2 - 4 * y2 * y3 + y3 * y3;

  var b = 1.0 * 9 * x1 * x2 - 3 * x1 * x1 - 3 * x1 * x3 - 6 * x2 * x2 + 3 * x2 * x3 + 9 * y1 * y2 - 3 * y1 * y1 - 3 * y1 * y3 - 6 * y2 * y2 + 3 * y2 * y3;

  var c = 1.0 * 3 * x1 * x1 - 6 * x1 * x2 + x1 * x3 - x1 * x + 2 * x2 * x2 + 2 * x2 * x - x3 * x + 3 * y1 * y1 - 6 * y1 * y2 + y1 * y3 - y1 * y + 2 * y2 * y2 + 2 * y2 * y - y3 * y;

  var d = 1.0 * x1 * x2 - x1 * x1 + x1 * x - x2 * x + y1 * y2 - y1 * y1 + y1 * y - y2 * y;

  // debug("coefficients: " + a / a + ", " + b / a + ", " + c / a + ", " + d / a);

  var roots = [];

  // Use the cubic solving algorithm
  this.solveCubic(a, b, c, d, roots);

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

  var curX = void 0,
      curY = void 0,
      distSquared = void 0;
  for (var i = 0; i < params.length; i++) {
    curX = Math.pow(1.0 - params[i], 2.0) * x1 + 2.0 * (1 - params[i]) * params[i] * x2 + params[i] * params[i] * x3;

    curY = Math.pow(1 - params[i], 2.0) * y1 + 2 * (1.0 - params[i]) * params[i] * y2 + params[i] * params[i] * y3;

    distSquared = Math.pow(curX - x, 2) + Math.pow(curY - y, 2);
    // debug('distance for param ' + params[i] + ": " + Math.sqrt(distSquared));
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

math.sqdistToFiniteLine = function (x, y, x1, y1, x2, y2) {
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

math.pointInsidePolygonPoints = function (x, y, points) {
  var x1 = void 0,
      y1 = void 0,
      x2 = void 0,
      y2 = void 0;
  var y3 = void 0;

  // Intersect with vertical line through (x, y)
  var up = 0;
  // let down = 0;
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

    if (x1 == x && x2 == x) {
      // then ignore
    } else if (x1 >= x && x >= x2 || x1 <= x && x <= x2) {

      y3 = (x - x1) / (x2 - x1) * (y2 - y1) + y1;

      if (y3 > y) {
        up++;
      }

      // if( y3 < y ){
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

math.pointInsidePolygon = function (x, y, basePoints, centerX, centerY, width, height, direction, padding) {

  //let direction = arguments[6];
  var transformedPoints = new Array(basePoints.length);

  // Gives negative angle
  var angle = void 0;

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
  var sin = Math.sin(-angle);

  //    console.log("base: " + basePoints);
  for (var i = 0; i < transformedPoints.length / 2; i++) {
    transformedPoints[i * 2] = width / 2 * (basePoints[i * 2] * cos - basePoints[i * 2 + 1] * sin);

    transformedPoints[i * 2 + 1] = height / 2 * (basePoints[i * 2 + 1] * cos + basePoints[i * 2] * sin);

    transformedPoints[i * 2] += centerX;
    transformedPoints[i * 2 + 1] += centerY;
  }

  var points = void 0;

  if (padding > 0) {
    var expandedLineSet = this.expandPolygon(transformedPoints, -padding);

    points = this.joinLines(expandedLineSet);
  } else {
    points = transformedPoints;
  }

  return math.pointInsidePolygonPoints(x, y, points);
};

math.joinLines = function (lineSet) {

  var vertices = new Array(lineSet.length / 2);

  var currentLineStartX = void 0,
      currentLineStartY = void 0,
      currentLineEndX = void 0,
      currentLineEndY = void 0;
  var nextLineStartX = void 0,
      nextLineStartY = void 0,
      nextLineEndX = void 0,
      nextLineEndY = void 0;

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

    var intersection = this.finiteLinesIntersect(currentLineStartX, currentLineStartY, currentLineEndX, currentLineEndY, nextLineStartX, nextLineStartY, nextLineEndX, nextLineEndY, true);

    vertices[i * 2] = intersection[0];
    vertices[i * 2 + 1] = intersection[1];
  }

  return vertices;
};

math.expandPolygon = function (points, pad) {

  var expandedLineSet = new Array(points.length * 2);

  var currentPointX = void 0,
      currentPointY = void 0,
      nextPointX = void 0,
      nextPointY = void 0;

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

    var offsetX = nextPointY - currentPointY;
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
};

math.intersectLineEllipse = function (x, y, centerX, centerY, ellipseWradius, ellipseHradius) {

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

math.checkInEllipse = function (x, y, width, height, centerX, centerY, padding) {
  x -= centerX;
  y -= centerY;

  x /= width / 2 + padding;
  y /= height / 2 + padding;

  return x * x + y * y <= 1;
};

// Returns intersections of increasing distance from line's start point
math.intersectLineCircle = function (x1, y1, x2, y2, centerX, centerY, radius) {

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

math.findCircleNearPoint = function (centerX, centerY, radius, farX, farY) {

  var displacementX = farX - centerX;
  var displacementY = farY - centerY;
  var distance = Math.sqrt(displacementX * displacementX + displacementY * displacementY);

  var unitDisplacementX = displacementX / distance;
  var unitDisplacementY = displacementY / distance;

  return [centerX + unitDisplacementX * radius, centerY + unitDisplacementY * radius];
};

math.findMaxSqDistanceToOrigin = function (points) {
  var maxSqDistance = 0.000001;
  var sqDistance = void 0;

  for (var i = 0; i < points.length / 2; i++) {

    sqDistance = points[i * 2] * points[i * 2] + points[i * 2 + 1] * points[i * 2 + 1];

    if (sqDistance > maxSqDistance) {
      maxSqDistance = sqDistance;
    }
  }

  return maxSqDistance;
};

math.midOfThree = function (a, b, c) {
  if (b <= a && a <= c || c <= a && a <= b) {
    return a;
  } else if (a <= b && b <= c || c <= b && b <= a) {
    return b;
  } else {
    return c;
  }
};

// (x1,y1)=>(x2,y2) intersect with (x3,y3)=>(x4,y4)
math.finiteLinesIntersect = function (x1, y1, x2, y2, x3, y3, x4, y4, infiniteLines) {

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
    var min = 0 - flptThreshold;
    var max = 1 + flptThreshold;

    if (min <= ua && ua <= max && min <= ub && ub <= max) {
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
      if (this.midOfThree(x1, x2, x4) === x4) {
        return [x4, y4];
      }

      // Check start point of second line
      if (this.midOfThree(x1, x2, x3) === x3) {
        return [x3, y3];
      }

      // Endpoint of first line
      if (this.midOfThree(x3, x4, x2) === x2) {
        return [x2, y2];
      }

      return [];
    } else {

      // Parallel, non-coincident
      return [];
    }
  }
};

// math.polygonIntersectLine( x, y, basePoints, centerX, centerY, width, height, padding )
// intersect a node polygon (pts transformed)
//
// math.polygonIntersectLine( x, y, basePoints, centerX, centerY )
// intersect the points (no transform)
math.polygonIntersectLine = function (x, y, basePoints, centerX, centerY, width, height, padding) {

  var intersections = [];
  var intersection = void 0;

  var transformedPoints = new Array(basePoints.length);

  var doTransform = true;
  if (arguments.length === 5) {
    doTransform = false;
  }

  var points = void 0;

  if (doTransform) {
    for (var i = 0; i < transformedPoints.length / 2; i++) {
      transformedPoints[i * 2] = basePoints[i * 2] * width + centerX;
      transformedPoints[i * 2 + 1] = basePoints[i * 2 + 1] * height + centerY;
    }

    if (padding > 0) {
      var expandedLineSet = math.expandPolygon(transformedPoints, -padding);

      points = math.joinLines(expandedLineSet);
    } else {
      points = transformedPoints;
    }
  } else {
    points = basePoints;
  }

  var currentX = void 0,
      currentY = void 0,
      nextX = void 0,
      nextY = void 0;

  for (var _i = 0; _i < points.length / 2; _i++) {

    currentX = points[_i * 2];
    currentY = points[_i * 2 + 1];

    if (_i < points.length / 2 - 1) {
      nextX = points[(_i + 1) * 2];
      nextY = points[(_i + 1) * 2 + 1];
    } else {
      nextX = points[0];
      nextY = points[1];
    }

    intersection = this.finiteLinesIntersect(x, y, centerX, centerY, currentX, currentY, nextX, nextY);

    if (intersection.length !== 0) {
      intersections.push(intersection[0], intersection[1]);
    }
  }

  return intersections;
};

math.shortenIntersection = function (intersection, offset, amount) {

  var disp = [intersection[0] - offset[0], intersection[1] - offset[1]];

  var length = Math.sqrt(disp[0] * disp[0] + disp[1] * disp[1]);

  var lenRatio = (length - amount) / length;

  if (lenRatio < 0) {
    lenRatio = 0.00001;
  }

  return [offset[0] + lenRatio * disp[0], offset[1] + lenRatio * disp[1]];
};

math.generateUnitNgonPointsFitToSquare = function (sides, rotationRadians) {
  var points = math.generateUnitNgonPoints(sides, rotationRadians);
  points = math.fitPolygonToSquare(points);

  return points;
};

math.fitPolygonToSquare = function (points) {
  var x = void 0,
      y = void 0;
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
  }

  // stretch factors
  var sx = 2 / (maxX - minX);
  var sy = 2 / (maxY - minY);

  for (var _i2 = 0; _i2 < sides; _i2++) {
    x = points[2 * _i2] = points[2 * _i2] * sx;
    y = points[2 * _i2 + 1] = points[2 * _i2 + 1] * sy;

    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  if (minY < -1) {
    for (var _i3 = 0; _i3 < sides; _i3++) {
      y = points[2 * _i3 + 1] = points[2 * _i3 + 1] + (-1 - minY);
    }
  }

  return points;
};

math.generateUnitNgonPoints = function (sides, rotationRadians) {

  var increment = 1.0 / sides * 2 * Math.PI;
  var startAngle = sides % 2 === 0 ? Math.PI / 2.0 + increment / 2.0 : Math.PI / 2.0;

  startAngle += rotationRadians;

  var points = new Array(sides * 2);

  var currentAngle = void 0;
  for (var i = 0; i < sides; i++) {
    currentAngle = i * increment + startAngle;

    points[2 * i] = Math.cos(currentAngle); // x
    points[2 * i + 1] = Math.sin(-currentAngle); // y
  }

  return points;
};

math.getRoundRectangleRadius = function (width, height) {

  // Set the default radius, unless half of width or height is smaller than default
  return Math.min(width / 4, height / 4, 8);
};

math.getCutRectangleCornerLength = function () {
  return 8;
};

math.bezierPtsToQuadCoeff = function (p0, p1, p2) {
  return [p0 - 2 * p1 + p2, 2 * (p1 - p0), p0];
};

math.getBarrelCurveConstants = function (width, height) {
  // get curve width, height, and control point position offsets as a percentage of node height / width
  return {
    heightOffset: Math.min(15, 0.05 * height),
    widthOffset: Math.min(100, 0.25 * width),
    ctrlPtOffsetPct: 0.05
  };
};

module.exports = math;

/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = typeof window === 'undefined' ? null : window; // eslint-disable-line no-undef

/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


// use this module to cherry pick functions into your prototype
// (useful for functions shared between the core and collections, for example)

// e.g.
// let foo = define.foo({ /* params... */ })

var util = __webpack_require__(1);

var define = {};

[__webpack_require__(43), __webpack_require__(45), __webpack_require__(46)].forEach(function (m) {
  util.assign(define, m);
});

module.exports = define;

/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

/*!
Embeddable Minimum Strictly-Compliant Promises/A+ 1.1.1 Thenable
Copyright (c) 2013-2014 Ralf S. Engelschall (http://engelschall.com)
Licensed under The MIT License (http://opensource.org/licenses/MIT)
*/

/*  promise states [Promises/A+ 2.1]  */
var STATE_PENDING = 0; /*  [Promises/A+ 2.1.1]  */
var STATE_FULFILLED = 1; /*  [Promises/A+ 2.1.2]  */
var STATE_REJECTED = 2; /*  [Promises/A+ 2.1.3]  */

/*  promise object constructor  */
var api = function api(executor) {
  /*  optionally support non-constructor/plain-function call  */
  if (!(this instanceof api)) return new api(executor);

  /*  initialize object  */
  this.id = 'Thenable/1.0.7';
  this.state = STATE_PENDING; /*  initial state  */
  this.fulfillValue = undefined; /*  initial value  */ /*  [Promises/A+ 1.3, 2.1.2.2]  */
  this.rejectReason = undefined; /*  initial reason */ /*  [Promises/A+ 1.5, 2.1.3.2]  */
  this.onFulfilled = []; /*  initial handlers  */
  this.onRejected = []; /*  initial handlers  */

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
    var next = new api(); /*  [Promises/A+ 2.2.7]  */
    curr.onFulfilled.push(resolver(onFulfilled, next, 'fulfill')); /*  [Promises/A+ 2.2.2/2.2.6]  */
    curr.onRejected.push(resolver(onRejected, next, 'reject')); /*  [Promises/A+ 2.2.3/2.2.6]  */
    execute(curr);
    return next.proxy; /*  [Promises/A+ 2.2.7, 3.3]  */
  }
};

/*  deliver an action  */
var deliver = function deliver(curr, state, name, value) {
  if (curr.state === STATE_PENDING) {
    curr.state = state; /*  [Promises/A+ 2.1.2.1, 2.1.3.1]  */
    curr[name] = value; /*  [Promises/A+ 2.1.2.2, 2.1.3.2]  */
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
  curr[name] = []; /*  [Promises/A+ 2.2.2.3, 2.2.3.3]  */
  var func = function func() {
    for (var i = 0; i < handlers.length; i++) {
      handlers[i](value);
    } /*  [Promises/A+ 2.2.5]  */
  };

  /*  execute procedure asynchronously  */ /*  [Promises/A+ 2.2.4, 3.1]  */
  if (typeof setImmediate === 'function') setImmediate(func);else setTimeout(func, 0);
};

/*  generate a resolver function  */
var resolver = function resolver(cb, next, method) {
  return function (value) {
    if (typeof cb !== 'function') /*  [Promises/A+ 2.2.1, 2.2.7.3, 2.2.7.4]  */
      next[method].call(next, value); /*  [Promises/A+ 2.2.7.3, 2.2.7.4]  */
    else {
        var result;
        try {
          result = cb(value);
        } /*  [Promises/A+ 2.2.2.1, 2.2.3.1, 2.2.5, 3.2]  */
        catch (e) {
          next.reject(e); /*  [Promises/A+ 2.2.7.2]  */
          return;
        }
        resolve(next, result); /*  [Promises/A+ 2.2.7.1]  */
      }
  };
};

/*  "Promise Resolution Procedure"  */ /*  [Promises/A+ 2.3]  */
var resolve = function resolve(promise, x) {
  /*  sanity check arguments  */ /*  [Promises/A+ 2.3.1]  */
  if (promise === x || promise.proxy === x) {
    promise.reject(new TypeError('cannot resolve promise with itself'));
    return;
  }

  /*  surgically check for a "then" method
    (mainly to just call the "getter" of "then" only once)  */
  var then;
  if ((typeof x === 'undefined' ? 'undefined' : _typeof(x)) === 'object' && x !== null || typeof x === 'function') {
    try {
      then = x.then;
    } /*  [Promises/A+ 2.3.3.1, 3.5]  */
    catch (e) {
      promise.reject(e); /*  [Promises/A+ 2.3.3.2]  */
      return;
    }
  }

  /*  handle own Thenables    [Promises/A+ 2.3.2]
    and similar "thenables" [Promises/A+ 2.3.3]  */
  if (typeof then === 'function') {
    var resolved = false;
    try {
      /*  call retrieved "then" method */ /*  [Promises/A+ 2.3.3.3]  */
      then.call(x,
      /*  resolvePromise  */ /*  [Promises/A+ 2.3.3.3.1]  */
      function (y) {
        if (resolved) return;resolved = true; /*  [Promises/A+ 2.3.3.3.3]  */
        if (y === x) /*  [Promises/A+ 3.6]  */
          promise.reject(new TypeError('circular thenable chain'));else resolve(promise, y);
      },

      /*  rejectPromise  */ /*  [Promises/A+ 2.3.3.3.2]  */
      function (r) {
        if (resolved) return;resolved = true; /*  [Promises/A+ 2.3.3.3.3]  */
        promise.reject(r);
      });
    } catch (e) {
      if (!resolved) /*  [Promises/A+ 2.3.3.3.3]  */
        promise.reject(e); /*  [Promises/A+ 2.3.3.3.4]  */
    }
    return;
  }

  /*  handle other values  */
  promise.fulfill(x); /*  [Promises/A+ 2.3.4, 2.3.3.4]  */
};

// so we always have Promise.all()
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

module.exports = typeof Promise !== 'undefined' ? Promise : api; // eslint-disable-line no-undef

/***/ }),
/* 6 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);
var util = __webpack_require__(1);
var newQuery = __webpack_require__(10);

var Selector = function Selector(selector) {
  var self = this;

  self._private = {
    selectorText: selector,
    invalid: true
  };

  if (selector == null || is.string(selector) && selector.match(/^\s*$/)) {

    self.length = 0;
  } else if (selector === '*' || selector === 'edge' || selector === 'node') {

    // make single, group-only selectors cheap to make and cheap to filter

    self[0] = newQuery();
    self[0].group = selector === '*' ? selector : selector + 's';
    self[0].groupOnly = true;
    self[0].length = 1;
    self._private.invalid = false;
    self.length = 1;
  } else if (is.elementOrCollection(selector)) {

    var collection = selector.collection();

    self[0] = newQuery();
    self[0].collection = collection;
    self[0].length = 1;
    self.length = 1;
  } else if (is.fn(selector)) {

    self[0] = newQuery();
    self[0].filter = selector;
    self[0].length = 1;
    self.length = 1;
  } else if (is.string(selector)) {
    if (!self.parse(selector)) {
      return;
    }
  } else {
    util.error('A selector must be created from a string; found ', selector);
    return;
  }

  self._private.invalid = false;
};

var selfn = Selector.prototype;

selfn.valid = function () {
  return !this._private.invalid;
};

selfn.invalid = function () {
  return this._private.invalid;
};

selfn.text = function () {
  return this._private.selectorText;
};

selfn.size = function () {
  return this.length;
};

selfn.eq = function (i) {
  return this[i];
};

selfn.sameText = function (otherSel) {
  return this.text() === otherSel.text();
};

selfn.toString = selfn.selector = function () {

  if (this._private.toStringCache != null) {
    return this._private.toStringCache;
  }

  var i = void 0;
  var str = '';

  var clean = function clean(obj) {
    if (obj == null) {
      return '';
    } else {
      return obj;
    }
  };

  var cleanVal = function cleanVal(val) {
    if (is.string(val)) {
      return '"' + val + '"';
    } else {
      return clean(val);
    }
  };

  var space = function space(val) {
    return ' ' + val + ' ';
  };

  var queryToString = function queryToString(query) {
    var str = '';
    var j = void 0,
        sel = void 0;

    if (query.subject === query) {
      str += '$';
    }

    var group = clean(query.group);
    str += group.substring(0, group.length - 1);

    for (j = 0; j < query.data.length; j++) {
      var data = query.data[j];

      if (data.value) {
        str += '[' + data.field + space(clean(data.operator)) + cleanVal(data.value) + ']';
      } else {
        str += '[' + clean(data.operator) + data.field + ']';
      }
    }

    for (j = 0; j < query.meta.length; j++) {
      var meta = query.meta[j];
      str += '[[' + meta.field + space(clean(meta.operator)) + cleanVal(meta.value) + ']]';
    }

    for (j = 0; j < query.colonSelectors.length; j++) {
      sel = query.colonSelectors[i];
      str += sel;
    }

    for (j = 0; j < query.ids.length; j++) {
      sel = '#' + query.ids[i];
      str += sel;
    }

    for (j = 0; j < query.classes.length; j++) {
      sel = '.' + query.classes[j];
      str += sel;
    }

    if (query.source != null && query.target != null) {
      str = queryToString(query.source) + ' -> ' + queryToString(query.target);
    }

    if (query.connectedNodes != null) {
      var n = query.connectedNodes;

      str = queryToString(n[0]) + ' <-> ' + queryToString(n[1]);
    }

    if (query.parent != null) {
      str = queryToString(query.parent) + ' > ' + str;
    }

    if (query.ancestor != null) {
      str = queryToString(query.ancestor) + ' ' + str;
    }

    if (query.child != null) {
      str += ' > ' + queryToString(query.child);
    }

    if (query.descendant != null) {
      str += ' ' + queryToString(query.descendant);
    }

    return str;
  };

  for (i = 0; i < this.length; i++) {
    var query = this[i];

    str += queryToString(query);

    if (this.length > 1 && i < this.length - 1) {
      str += ', ';
    }
  }

  this._private.toStringCache = str;

  return str;
};

[__webpack_require__(49), __webpack_require__(52)].forEach(function (p) {
  return util.assign(selfn, p);
});

module.exports = Selector;

/***/ }),
/* 7 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);
var is = __webpack_require__(0);
var Map = __webpack_require__(28);
var Set = __webpack_require__(8);

var Element = __webpack_require__(14);

// factory for generating edge ids when no id is specified for a new element
var idFactory = {
  generate: function generate(cy, element, tryThisId) {
    var id = tryThisId != null ? tryThisId : util.uuid();

    while (cy.hasElementWithId(id)) {
      id = util.uuid();
    }

    return id;
  }
};

// represents a set of nodes, edges, or both together
var Collection = function Collection(cy, elements, options) {
  if (cy === undefined || !is.core(cy)) {
    util.error('A collection must have a reference to the core');
    return;
  }

  var map = new Map();
  var createdElements = false;

  if (!elements) {
    elements = [];
  } else if (elements.length > 0 && is.plainObject(elements[0]) && !is.element(elements[0])) {
    createdElements = true;

    // make elements from json and restore all at once later
    var eles = [];
    var elesIds = new Set();

    for (var i = 0, l = elements.length; i < l; i++) {
      var json = elements[i];

      if (json.data == null) {
        json.data = {};
      }

      var data = json.data;

      // make sure newly created elements have valid ids
      if (data.id == null) {
        data.id = idFactory.generate(cy, json);
      } else if (cy.hasElementWithId(data.id) || elesIds.has(data.id)) {
        continue; // can't create element if prior id already exists
      }

      var ele = new Element(cy, json, false);
      eles.push(ele);
      elesIds.add(data.id);
    }

    elements = eles;
  }

  this.length = 0;

  for (var _i = 0, _l = elements.length; _i < _l; _i++) {
    var element = elements[_i];
    if (element == null) {
      continue;
    }

    var id = element._private.data.id;

    if (options == null || options.unique && !map.has(id)) {
      map.set(id, {
        index: this.length,
        ele: element
      });

      this[this.length] = element;
      this.length++;
    }
  }

  this._private = {
    cy: cy,
    map: map
  };

  // restore the elements if we created them from json
  if (createdElements) {
    this.restore();
  }
};

// Functions
////////////////////////////////////////////////////////////////////////////////////////////////////

// keep the prototypes in sync (an element has the same functions as a collection)
// and use elefn and elesfn as shorthands to the prototypes
var elesfn = Element.prototype = Collection.prototype;

elesfn.instanceString = function () {
  return 'collection';
};

elesfn.spawn = function (cy, eles, opts) {
  if (!is.core(cy)) {
    // cy is optional
    opts = eles;
    eles = cy;
    cy = this.cy();
  }

  return new Collection(cy, eles, opts);
};

elesfn.spawnSelf = function () {
  return this.spawn(this);
};

elesfn.cy = function () {
  return this._private.cy;
};

elesfn.renderer = function () {
  return this._private.cy.renderer();
};

elesfn.element = function () {
  return this[0];
};

elesfn.collection = function () {
  if (is.collection(this)) {
    return this;
  } else {
    // an element
    return new Collection(this._private.cy, [this]);
  }
};

elesfn.unique = function () {
  return new Collection(this._private.cy, this, { unique: true });
};

elesfn.hasElementWithId = function (id) {
  return this._private.map.has(id);
};

elesfn.getElementById = function (id) {
  var cy = this._private.cy;
  var entry = this._private.map.get(id);

  return entry ? entry.ele : new Collection(cy); // get ele or empty collection
};

elesfn.$id = elesfn.getElementById;

elesfn.poolIndex = function () {
  var cy = this._private.cy;
  var eles = cy._private.elements;
  var id = this._private.data.id;

  return eles._private.map.get(id).index;
};

elesfn.json = function (obj) {
  var ele = this.element();
  var cy = this.cy();

  if (ele == null && obj) {
    return this;
  } // can't set to no eles

  if (ele == null) {
    return undefined;
  } // can't get from no eles

  var p = ele._private;

  if (is.plainObject(obj)) {
    // set

    cy.startBatch();

    if (obj.data) {
      ele.data(obj.data);
    }

    if (obj.position) {
      ele.position(obj.position);
    }

    // ignore group -- immutable

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

    if (obj.classes != null) {
      ele.classes(obj.classes);
    }

    cy.endBatch();

    return this;
  } else if (obj === undefined) {
    // get

    var json = {
      data: util.copy(p.data),
      position: util.copy(p.position),
      group: p.group,
      removed: p.removed,
      selected: p.selected,
      selectable: p.selectable,
      locked: p.locked,
      grabbable: p.grabbable,
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

elesfn.jsons = function () {
  var jsons = [];

  for (var i = 0; i < this.length; i++) {
    var ele = this[i];
    var json = ele.json();

    jsons.push(json);
  }

  return jsons;
};

elesfn.clone = function () {
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
elesfn.copy = elesfn.clone;

elesfn.restore = function (notifyRenderer) {
  var self = this;
  var cy = self.cy();
  var cy_p = cy._private;

  if (notifyRenderer === undefined) {
    notifyRenderer = true;
  }

  // create arrays of nodes and edges, since we need to
  // restore the nodes first
  var nodes = [];
  var edges = [];
  var elements = void 0;
  for (var _i2 = 0, l = self.length; _i2 < l; _i2++) {
    var ele = self[_i2];

    if (!ele.removed()) {
      // don't need to handle this ele
      continue;
    }

    // keep nodes first in the array and edges after
    if (ele.isNode()) {
      // put to front of array if node
      nodes.push(ele);
    } else {
      // put to end of array if edge
      edges.push(ele);
    }
  }

  elements = nodes.concat(edges);

  var i = void 0;
  var removeFromElements = function removeFromElements() {
    elements.splice(i, 1);
    i--;
  };

  // now, restore each element
  for (i = 0; i < elements.length; i++) {
    var _ele = elements[i];

    var _private = _ele._private;
    var data = _private.data;

    // the traversal cache should start fresh when ele is added
    _ele.clearTraversalCache();

    // set id and validate
    if (data.id === undefined) {
      data.id = idFactory.generate(cy, _ele);
    } else if (is.number(data.id)) {
      data.id = '' + data.id; // now it's a string
    } else if (is.emptyString(data.id) || !is.string(data.id)) {
      util.error('Can not create element with invalid string ID `' + data.id + '`');

      // can't create element if it has empty string as id or non-string id
      removeFromElements();
      continue;
    } else if (cy.hasElementWithId(data.id)) {
      util.error('Can not create second element with ID `' + data.id + '`');

      // can't create element if one already has that id
      removeFromElements();
      continue;
    }

    var id = data.id; // id is finalised, now let's keep a ref

    if (_ele.isNode()) {
      // extra checks for nodes
      var pos = _private.position;

      // make sure the nodes have a defined position

      if (pos.x == null) {
        pos.x = 0;
      }

      if (pos.y == null) {
        pos.y = 0;
      }
    }

    if (_ele.isEdge()) {
      // extra checks for edges

      var edge = _ele;
      var fields = ['source', 'target'];
      var fieldsLength = fields.length;
      var badSourceOrTarget = false;
      for (var j = 0; j < fieldsLength; j++) {

        var field = fields[j];
        var val = data[field];

        if (is.number(val)) {
          val = data[field] = '' + data[field]; // now string
        }

        if (val == null || val === '') {
          // can't create if source or target is not defined properly
          util.error('Can not create edge `' + id + '` with unspecified ' + field);
          badSourceOrTarget = true;
        } else if (!cy.hasElementWithId(val)) {
          // can't create edge if one of its nodes doesn't exist
          util.error('Can not create edge `' + id + '` with nonexistant ' + field + ' `' + val + '`');
          badSourceOrTarget = true;
        }
      }

      if (badSourceOrTarget) {
        removeFromElements();continue;
      } // can't create this

      var src = cy.getElementById(data.source);
      var tgt = cy.getElementById(data.target);

      src._private.edges.push(edge);
      tgt._private.edges.push(edge);

      edge._private.source = src;
      edge._private.target = tgt;
    } // if is edge

    // create mock ids / indexes maps for element so it can be used like collections
    _private.map = new Map();
    _private.map.set(id, { ele: _ele, index: 0 });

    _private.removed = false;
    cy.addToPool(_ele);
  } // for each element

  // do compound node sanity checks
  for (var _i3 = 0; _i3 < nodes.length; _i3++) {
    // each node
    var node = nodes[_i3];
    var _data = node._private.data;

    if (is.number(_data.parent)) {
      // then automake string
      _data.parent = '' + _data.parent;
    }

    var parentId = _data.parent;

    var specifiedParent = parentId != null;

    if (specifiedParent) {
      var parent = cy.getElementById(parentId);

      if (parent.empty()) {
        // non-existant parent; just remove it
        _data.parent = undefined;
      } else {
        var selfAsParent = false;
        var ancestor = parent;
        while (!ancestor.empty()) {
          if (node.same(ancestor)) {
            // mark self as parent and remove from data
            selfAsParent = true;
            _data.parent = undefined; // remove parent reference

            // exit or we loop forever
            break;
          }

          ancestor = ancestor.parent();
        }

        if (!selfAsParent) {
          // connect with children
          parent[0]._private.children.push(node);
          node._private.parent = parent[0];

          // let the core know we have a compound graph
          cy_p.hasCompoundNodes = true;
        }
      } // else
    } // if specified parent
  } // for each node

  if (elements.length > 0) {
    var restored = new Collection(cy, elements);

    for (var _i4 = 0; _i4 < restored.length; _i4++) {
      var _ele2 = restored[_i4];

      if (_ele2.isNode()) {
        continue;
      }

      // adding an edge invalidates the traversal caches for the parallel edges
      _ele2.parallelEdges().clearTraversalCache();

      // adding an edge invalidates the traversal cache for the connected nodes
      _ele2.source().clearTraversalCache();
      _ele2.target().clearTraversalCache();
    }

    var toUpdateStyle = void 0;

    if (cy_p.hasCompoundNodes) {
      toUpdateStyle = cy.collection().merge(restored).merge(restored.connectedNodes()).merge(restored.parent());
    } else {
      toUpdateStyle = restored;
    }

    toUpdateStyle.dirtyCompoundBoundsCache().updateStyle(notifyRenderer);

    if (notifyRenderer) {
      restored.emitAndNotify('add');
    } else {
      restored.emit('add');
    }
  }

  return self; // chainability
};

elesfn.removed = function () {
  var ele = this[0];
  return ele && ele._private.removed;
};

elesfn.inside = function () {
  var ele = this[0];
  return ele && !ele._private.removed;
};

elesfn.remove = function (notifyRenderer) {
  var self = this;
  var removed = [];
  var elesToRemove = [];
  var elesToRemoveIds = {};
  var cy = self._private.cy;

  if (notifyRenderer === undefined) {
    notifyRenderer = true;
  }

  // add connected edges
  function addConnectedEdges(node) {
    var edges = node._private.edges;
    for (var i = 0; i < edges.length; i++) {
      add(edges[i]);
    }
  }

  // add descendant nodes
  function addChildren(node) {
    var children = node._private.children;

    for (var i = 0; i < children.length; i++) {
      add(children[i]);
    }
  }

  function add(ele) {
    var alreadyAdded = elesToRemoveIds[ele.id()];
    if (ele.removed() || alreadyAdded) {
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
  }

  // make the list of elements to remove
  // (may be removing more than specified due to connected edges etc)

  for (var i = 0, l = self.length; i < l; i++) {
    var ele = self[i];

    add(ele);
  }

  function removeEdgeRef(node, edge) {
    var connectedEdges = node._private.edges;

    util.removeFromArray(connectedEdges, edge);

    // removing an edges invalidates the traversal cache for its nodes
    node.clearTraversalCache();
  }

  function removeParallelRefs(edge) {
    // removing an edge invalidates the traversal caches for the parallel edges
    edge.parallelEdges().clearTraversalCache();
  }

  var alteredParents = [];
  alteredParents.ids = {};

  function removeChildRef(parent, ele) {
    ele = ele[0];
    parent = parent[0];

    var children = parent._private.children;
    var pid = parent.id();

    util.removeFromArray(children, ele);

    if (!alteredParents.ids[pid]) {
      alteredParents.ids[pid] = true;
      alteredParents.push(parent);
    }
  }

  self.dirtyCompoundBoundsCache();

  cy.removeFromPool(elesToRemove); // remove from core pool

  for (var _i5 = 0; _i5 < elesToRemove.length; _i5++) {
    var _ele3 = elesToRemove[_i5];

    // mark as removed
    _ele3._private.removed = true;

    // add to list of removed elements
    removed.push(_ele3);

    if (_ele3.isEdge()) {
      // remove references to this edge in its connected nodes
      var src = _ele3.source()[0];
      var tgt = _ele3.target()[0];

      removeEdgeRef(src, _ele3);
      removeEdgeRef(tgt, _ele3);
      removeParallelRefs(_ele3);
    } else {
      // remove reference to parent
      var parent = _ele3.parent();

      if (parent.length !== 0) {
        removeChildRef(parent, _ele3);
      }
    }
  }

  // check to see if we have a compound graph or not
  var elesStillInside = cy._private.elements;
  cy._private.hasCompoundNodes = false;
  for (var _i6 = 0; _i6 < elesStillInside.length; _i6++) {
    var _ele4 = elesStillInside[_i6];

    if (_ele4.isParent()) {
      cy._private.hasCompoundNodes = true;
      break;
    }
  }

  var removedElements = new Collection(this.cy(), removed);
  if (removedElements.size() > 0) {
    // must manually notify since trigger won't do this automatically once removed

    if (notifyRenderer) {
      this.cy().notify({
        type: 'remove',
        eles: removedElements
      });
    }

    removedElements.emit('remove');
  }

  // the parents who were modified by the removal need their style updated
  for (var _i7 = 0; _i7 < alteredParents.length; _i7++) {
    var _ele5 = alteredParents[_i7];

    if (!_ele5.removed()) {
      _ele5.updateStyle();
    }
  }

  return new Collection(cy, removed);
};

elesfn.move = function (struct) {
  var cy = this._private.cy;

  if (struct.source !== undefined || struct.target !== undefined) {
    var srcId = struct.source;
    var tgtId = struct.target;
    var srcExists = cy.hasElementWithId(srcId);
    var tgtExists = cy.hasElementWithId(tgtId);

    if (srcExists || tgtExists) {
      var jsons = this.jsons();

      this.remove();

      for (var i = 0; i < jsons.length; i++) {
        var json = jsons[i];
        var ele = this[i];

        if (json.group === 'edges') {
          if (srcExists) {
            json.data.source = srcId;
          }

          if (tgtExists) {
            json.data.target = tgtId;
          }

          json.scratch = ele._private.scratch;
        }
      }

      return cy.add(jsons);
    }
  } else if (struct.parent !== undefined) {
    // move node to new parent
    var parentId = struct.parent;
    var parentExists = parentId === null || cy.hasElementWithId(parentId);

    if (parentExists) {
      var _jsons = this.jsons();
      var descs = this.descendants();
      var descsEtcJsons = descs.union(descs.union(this).connectedEdges()).jsons();

      this.remove(); // NB: also removes descendants and their connected edges

      for (var _i8 = 0; _i8 < _jsons.length; _i8++) {
        var _json = _jsons[_i8];
        var _ele6 = this[_i8];

        if (_json.group === 'nodes') {
          _json.data.parent = parentId === null ? undefined : parentId;

          _json.scratch = _ele6._private.scratch;
        }
      }

      return cy.add(_jsons.concat(descsEtcJsons));
    }
  }

  return this; // if nothing done
};

[__webpack_require__(29), __webpack_require__(42), __webpack_require__(47), __webpack_require__(48), __webpack_require__(53), __webpack_require__(54), __webpack_require__(55), __webpack_require__(56), __webpack_require__(61), __webpack_require__(62), __webpack_require__(63), __webpack_require__(7), __webpack_require__(64), __webpack_require__(65), __webpack_require__(66), __webpack_require__(67), __webpack_require__(68)].forEach(function (props) {
  util.extend(elesfn, props);
});

module.exports = Collection;

/***/ }),
/* 8 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/* global Set */

var undef =  true ? 'undefined' : _typeof(undefined);

var ObjectSet = function () {
  function ObjectSet(arrayOrObjectSet) {
    _classCallCheck(this, ObjectSet);

    this._obj = Object.create(null);

    if (arrayOrObjectSet != null) {
      var arr = void 0;

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
    key: 'instanceString',
    value: function instanceString() {
      return 'set';
    }
  }, {
    key: 'add',
    value: function add(val) {
      this._obj[val] = 1;
    }
  }, {
    key: 'delete',
    value: function _delete(val) {
      this._obj[val] = 0;
    }
  }, {
    key: 'clear',
    value: function clear() {
      this._obj = Object.create(null);
    }
  }, {
    key: 'has',
    value: function has(val) {
      return this._obj[val] === 1;
    }
  }, {
    key: 'toArray',
    value: function toArray() {
      var _this = this;

      return Object.keys(this._obj).filter(function (key) {
        return _this.has(key);
      });
    }
  }, {
    key: 'forEach',
    value: function forEach(callback, thisArg) {
      return this.toArray().forEach(callback, thisArg);
    }
  }, {
    key: 'size',
    get: function get() {
      return this.toArray().length;
    }
  }]);

  return ObjectSet;
}();

// TODO use the stdlib Set in future...
// module.exports = typeof Set !== undef ? Set : ObjectSet;


module.exports = ObjectSet;

/***/ }),
/* 9 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = __webpack_require__(32);

/***/ }),
/* 10 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


// storage for parsed queries
var newQuery = function newQuery() {
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
};

module.exports = newQuery;

/***/ }),
/* 11 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);
var is = __webpack_require__(0);
var Event = __webpack_require__(16);

var eventRegex = /^([^.]+)(\.(?:[^.]+))?$/; // regex for matching event strings (e.g. "click.namespace")
var universalNamespace = '.*'; // matches as if no namespace specified and prevents users from unbinding accidentally

var defaults = {
  qualifierCompare: function qualifierCompare(q1, q2) {
    return q1 === q2;
  },
  eventMatches: function eventMatches() /*context, listener, eventObj*/{
    return true;
  },
  eventFields: function eventFields() /*context*/{
    return {};
  },
  callbackContext: function callbackContext(context /*, listener, eventObj*/) {
    return context;
  },
  beforeEmit: function beforeEmit() /* context, listener, eventObj */{},
  afterEmit: function afterEmit() /* context, listener, eventObj */{},
  bubble: function bubble() /*context*/{
    return false;
  },
  parent: function parent() /*context*/{
    return null;
  },
  context: undefined
};

function Emitter(opts) {
  util.assign(this, defaults, opts);

  this.listeners = [];
  this.emitting = 0;
}

var p = Emitter.prototype;

var forEachEvent = function forEachEvent(self, handler, events, qualifier, callback, conf, confOverrides) {
  if (is.fn(qualifier)) {
    callback = qualifier;
    qualifier = null;
  }

  if (confOverrides) {
    if (conf == null) {
      conf = confOverrides;
    } else {
      conf = util.assign({}, conf, confOverrides);
    }
  }

  var eventList = events.split(/\s+/);

  for (var i = 0; i < eventList.length; i++) {
    var evt = eventList[i];

    if (is.emptyString(evt)) {
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
  return new Event(obj.type, util.assign(obj, self.eventFields(self.context)));
};

var forEachEventObj = function forEachEventObj(self, handler, events) {
  if (is.event(events)) {
    handler(self, events);

    return;
  } else if (is.plainObject(events)) {
    handler(self, makeEventObj(self, events));

    return;
  }

  var eventList = events.split(/\s+/);

  for (var i = 0; i < eventList.length; i++) {
    var evt = eventList[i];

    if (is.emptyString(evt)) {
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
    if (is.fn(callback)) {
      self.listeners.push({
        event: event, // full event string
        callback: callback, // callback to run
        type: type, // the event type (e.g. 'click')
        namespace: namespace, // the event namespace (e.g. ".foo")
        qualifier: qualifier, // a restriction on whether to match this emitter
        conf: conf // additional configuration
      });
    }
  }, events, qualifier, callback, conf, confOverrides);

  return this;
};

p.one = function (events, qualifier, callback, conf) {
  return this.on(events, qualifier, callback, conf, { one: true });
};

p.removeListener = p.off = function (events, qualifier, callback, conf) {
  var _this = this;

  if (this.emitting !== 0) {
    this.listeners = util.copyArray(this.listeners);
  }

  var listeners = this.listeners;

  var _loop = function _loop(i) {
    var listener = listeners[i];

    forEachEvent(_this, function (self, event, type, namespace, qualifier, callback /*, conf*/) {
      if (listener.type === type && (!namespace || listener.namespace === namespace) && (!qualifier || self.qualifierCompare(listener.qualifier, qualifier)) && (!callback || listener.callback === callback)) {
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

p.emit = p.trigger = function (events, extraParams, manualCallback) {
  var listeners = this.listeners;
  var numListenersBeforeEmit = listeners.length;

  this.emitting++;

  if (!is.array(extraParams)) {
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
          util.push(args, extraParams);
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

module.exports = Emitter;

/***/ }),
/* 12 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var window = __webpack_require__(3);
var util = __webpack_require__(1);
var Collection = __webpack_require__(7);
var is = __webpack_require__(0);
var Promise = __webpack_require__(5);
var define = __webpack_require__(4);

var Core = function Core(opts) {
  var cy = this;

  opts = util.extend({}, opts);

  var container = opts.container;

  // allow for passing a wrapped jquery object
  // e.g. cytoscape({ container: $('#cy') })
  if (container && !is.htmlElement(container) && is.htmlElement(container[0])) {
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

  var head = window !== undefined && container !== undefined && !opts.headless;
  var options = opts;
  options.layout = util.extend({ name: head ? 'grid' : 'null' }, options.layout);
  options.renderer = util.extend({ name: head ? 'canvas' : 'null' }, options.renderer);

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
    container: container, // html dom ele container
    ready: false, // whether ready has been triggered
    options: options, // cached options
    elements: new Collection(this), // elements in the graph
    listeners: [], // list of listeners
    aniEles: new Collection(this), // elements being animated
    scratch: {}, // scratch object for core
    layout: null,
    renderer: null,
    destroyed: false, // whether destroy was called
    notificationsEnabled: true, // whether notifications are sent to the renderer
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
    zoom: is.number(options.zoom) ? options.zoom : 1,
    pan: {
      x: is.plainObject(options.pan) && is.number(options.pan.x) ? options.pan.x : 0,
      y: is.plainObject(options.pan) && is.number(options.pan.y) ? options.pan.y : 0
    },
    animation: { // object for currently-running animations
      current: [],
      queue: []
    },
    hasCompoundNodes: false
  };

  this.createEmitter();

  // set selection type
  var selType = options.selectionType;
  if (selType === undefined || selType !== 'additive' && selType !== 'single') {
    // then set default

    _p.selectionType = 'single';
  } else {
    _p.selectionType = selType;
  }

  // init zoom bounds
  if (is.number(options.minZoom) && is.number(options.maxZoom) && options.minZoom < options.maxZoom) {
    _p.minZoom = options.minZoom;
    _p.maxZoom = options.maxZoom;
  } else if (is.number(options.minZoom) && options.maxZoom === undefined) {
    _p.minZoom = options.minZoom;
  } else if (is.number(options.maxZoom) && options.minZoom === undefined) {
    _p.maxZoom = options.maxZoom;
  }

  var loadExtData = function loadExtData(extData, next) {
    var anyIsPromise = extData.some(is.promise);

    if (anyIsPromise) {
      return Promise.all(extData).then(next); // load all data asynchronously, then exec rest of init
    } else {
      next(extData); // exec synchronously for convenience
    }
  };

  // start with the default stylesheet so we have something before loading an external stylesheet
  if (_p.styleEnabled) {
    cy.setStyle([]);
  }

  // create the renderer
  cy.initRenderer(util.extend({
    hideEdgesOnViewport: options.hideEdgesOnViewport,
    textureOnViewport: options.textureOnViewport,
    wheelSensitivity: is.number(options.wheelSensitivity) && options.wheelSensitivity > 0 ? options.wheelSensitivity : 1,
    motionBlur: options.motionBlur === undefined ? false : options.motionBlur, // off by default
    motionBlurOpacity: options.motionBlurOpacity === undefined ? 0.05 : options.motionBlurOpacity,
    pixelRatio: is.number(options.pixelRatio) && options.pixelRatio > 0 ? options.pixelRatio : undefined,
    desktopTapThreshold: options.desktopTapThreshold === undefined ? 4 : options.desktopTapThreshold,
    touchTapThreshold: options.touchTapThreshold === undefined ? 8 : options.touchTapThreshold
  }, options.renderer));

  var setElesAndLayout = function setElesAndLayout(elements, onload, ondone) {
    cy.notifications(false);

    // remove old elements
    var oldEles = cy.mutableElements();
    if (oldEles.length > 0) {
      oldEles.remove();
    }

    if (elements != null) {
      if (is.plainObject(elements) || is.array(elements)) {
        cy.add(elements);
      }
    }

    cy.one('layoutready', function (e) {
      cy.notifications(true);
      cy.emit(e); // we missed this event by turning notifications off, so pass it on

      cy.notify({
        type: 'load',
        eles: cy.mutableElements()
      });

      cy.one('load', onload);
      cy.emit('load');
    }).one('layoutstop', function () {
      cy.one('done', ondone);
      cy.emit('done');
    });

    var layoutOpts = util.extend({}, cy._private.options.layout);
    layoutOpts.eles = cy.elements();

    cy.layout(layoutOpts).run();
  };

  loadExtData([options.style, options.elements], function (thens) {
    var initStyle = thens[0];
    var initEles = thens[1];

    // init style
    if (_p.styleEnabled) {
      cy.style().append(initStyle);
    }

    // initial load
    setElesAndLayout(initEles, function () {
      // onready
      cy.startAnimationLoop();
      _p.ready = true;

      // if a ready callback is specified as an option, the bind it
      if (is.fn(options.ready)) {
        cy.on('ready', options.ready);
      }

      // bind all the ready handlers registered before creating this instance
      for (var i = 0; i < readies.length; i++) {
        var fn = readies[i];
        cy.on('ready', fn);
      }
      if (reg) {
        reg.readies = [];
      } // clear b/c we've bound them all and don't want to keep it around in case a new core uses the same div etc

      cy.emit('ready');
    }, options.done);
  });
};

var corefn = Core.prototype; // short alias

util.extend(corefn, {
  instanceString: function instanceString() {
    return 'core';
  },

  isReady: function isReady() {
    return this._private.ready;
  },

  isDestroyed: function isDestroyed() {
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
    if (cy.isDestroyed()) return;

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

  selectionType: function selectionType() {
    return this._private.selectionType;
  },

  hasCompoundNodes: function hasCompoundNodes() {
    return this._private.hasCompoundNodes;
  },

  headless: function headless() {
    return this._private.options.renderer.name === 'null';
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
    return this._private.container;
  },

  options: function options() {
    return util.copy(this._private.options);
  },

  json: function json(obj) {
    var cy = this;
    var _p = cy._private;
    var eles = cy.mutableElements();

    if (is.plainObject(obj)) {
      // set

      cy.startBatch();

      if (obj.elements) {
        var idInJson = {};

        var updateEles = function updateEles(jsons, gr) {
          for (var i = 0; i < jsons.length; i++) {
            var json = jsons[i];
            var id = json.data.id;
            var ele = cy.getElementById(id);

            idInJson[id] = true;

            if (ele.length !== 0) {
              // existing element should be updated
              ele.json(json);
            } else {
              // otherwise should be added
              if (gr) {
                cy.add(util.extend({ group: gr }, json));
              } else {
                cy.add(json);
              }
            }
          }
        };

        if (is.array(obj.elements)) {
          // elements: []
          updateEles(obj.elements);
        } else {
          // elements: { nodes: [], edges: [] }
          var grs = ['nodes', 'edges'];
          for (var i = 0; i < grs.length; i++) {
            var gr = grs[i];
            var elements = obj.elements[gr];

            if (is.array(elements)) {
              updateEles(elements, gr);
            }
          }
        }

        // elements not specified in json should be removed
        eles.stdFilter(function (ele) {
          return !idInJson[ele.id()];
        }).remove();
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

      var fields = ['minZoom', 'maxZoom', 'zoomingEnabled', 'userZoomingEnabled', 'panningEnabled', 'userPanningEnabled', 'boxSelectionEnabled', 'autolock', 'autoungrabify', 'autounselectify'];

      for (var _i = 0; _i < fields.length; _i++) {
        var f = fields[_i];

        if (obj[f] != null) {
          cy[f](obj[f]);
        }
      }

      cy.endBatch();

      return this; // chaining
    } else if (obj === undefined) {
      // get
      var json = {};

      json.elements = {};
      eles.forEach(function (ele) {
        var group = ele.group();

        if (!json.elements[group]) {
          json.elements[group] = [];
        }

        json.elements[group].push(ele.json());
      });

      if (this._private.styleEnabled) {
        json.style = cy.style().json();
      }

      json.zoomingEnabled = cy._private.zoomingEnabled;
      json.userZoomingEnabled = cy._private.userZoomingEnabled;
      json.zoom = cy._private.zoom;
      json.minZoom = cy._private.minZoom;
      json.maxZoom = cy._private.maxZoom;
      json.panningEnabled = cy._private.panningEnabled;
      json.userPanningEnabled = cy._private.userPanningEnabled;
      json.pan = util.copy(cy._private.pan);
      json.boxSelectionEnabled = cy._private.boxSelectionEnabled;
      json.renderer = util.copy(cy._private.options.renderer);
      json.hideEdgesOnViewport = cy._private.options.hideEdgesOnViewport;
      json.textureOnViewport = cy._private.options.textureOnViewport;
      json.wheelSensitivity = cy._private.options.wheelSensitivity;
      json.motionBlur = cy._private.options.motionBlur;

      return json;
    }
  },

  scratch: define.data({
    field: 'scratch',
    bindingEvent: 'scratch',
    allowBinding: true,
    allowSetting: true,
    settingEvent: 'scratch',
    settingTriggersEvent: true,
    triggerFnName: 'trigger',
    allowGetting: true
  }),

  removeScratch: define.removeData({
    field: 'scratch',
    event: 'scratch',
    triggerFnName: 'trigger',
    triggerEvent: true
  })

});

corefn.$id = corefn.getElementById;

[__webpack_require__(69), __webpack_require__(70), __webpack_require__(78), __webpack_require__(79), __webpack_require__(80), __webpack_require__(81), __webpack_require__(82), __webpack_require__(83), __webpack_require__(84), __webpack_require__(93)].forEach(function (props) {
  util.extend(corefn, props);
});

module.exports = Core;

/***/ }),
/* 13 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = function memoize(fn, keyFn) {
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
    var ret = void 0;
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

/***/ }),
/* 14 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);
var is = __webpack_require__(0);
var Set = __webpack_require__(8);

// represents a node or an edge
var Element = function Element(cy, params, restore) {
  restore = restore === undefined || restore ? true : false;

  if (cy === undefined || params === undefined || !is.core(cy)) {
    util.error('An element must have a core reference and parameters set');
    return;
  }

  var group = params.group;

  // try to automatically infer the group if unspecified
  if (group == null) {
    if (params.data && params.data.source != null && params.data.target != null) {
      group = 'edges';
    } else {
      group = 'nodes';
    }
  }

  // validate group
  if (group !== 'nodes' && group !== 'edges') {
    util.error('An element must be of type `nodes` or `edges`; you specified `' + group + '`');
    return;
  }

  // make the element array-like, just like a collection
  this.length = 1;
  this[0] = this;

  // NOTE: when something is added here, add also to ele.json()
  var _p = this._private = {
    cy: cy,
    single: true, // indicates this is an element
    data: params.data || {}, // data object
    position: params.position || {}, // (x, y) position pair
    autoWidth: undefined, // width and height of nodes calculated by the renderer when set to special 'auto' value
    autoHeight: undefined,
    autoPadding: undefined,
    compoundBoundsClean: false, // whether the compound dimensions need to be recalculated the next time dimensions are read
    listeners: [], // array of bound listeners
    group: group, // string; 'nodes' or 'edges'
    style: {}, // properties as set by the style
    rstyle: {}, // properties for style sent from the renderer to the core
    styleCxts: [], // applied style contexts from the styler
    removed: true, // whether it's inside the vis; true if removed (set true here since we call restore)
    selected: params.selected ? true : false, // whether it's selected
    selectable: params.selectable === undefined ? true : params.selectable ? true : false, // whether it's selectable
    locked: params.locked ? true : false, // whether the element is locked (cannot be moved)
    grabbed: false, // whether the element is grabbed by the mouse; renderer sets this privately
    grabbable: params.grabbable === undefined ? true : params.grabbable ? true : false, // whether the element can be grabbed
    active: false, // whether the element is active from user interaction
    classes: new Set(), // map ( className => true )
    animation: { // object for currently-running animations
      current: [],
      queue: []
    },
    rscratch: {}, // object in which the renderer can store information
    scratch: params.scratch || {}, // scratch objects
    edges: [], // array of connected edges
    children: [], // array of children
    parent: null, // parent ref
    traversalCache: {}, // cache of output of traversal functions
    backgrounding: false // whether background images are loading
  };

  // renderedPosition overrides if specified
  if (params.renderedPosition) {
    var rpos = params.renderedPosition;
    var pan = cy.pan();
    var zoom = cy.zoom();

    _p.position = {
      x: (rpos.x - pan.x) / zoom,
      y: (rpos.y - pan.y) / zoom
    };
  }

  if (is.string(params.classes)) {
    var classes = params.classes.split(/\s+/);
    for (var i = 0, l = classes.length; i < l; i++) {
      var cls = classes[i];
      if (!cls || cls === '') {
        continue;
      }

      _p.classes.add(cls);
    }
  }

  if (params.style || params.css) {
    cy.style().applyBypass(this, params.style || params.css);
  }

  this.createEmitter();

  if (restore === undefined || restore) {
    this.restore();
  }
};

module.exports = Element;

/***/ }),
/* 15 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);

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
  return util.sort.descending(a.selector, b.selector);
});

var stateSelectorMatches = function stateSelectorMatches(sel, ele) {
  var lookup = stateSelectorMatches.lookup = stateSelectorMatches.lookup || function () {
    var selToFn = {};
    var s = void 0;

    for (var i = 0; i < stateSelectors.length; i++) {
      s = stateSelectors[i];

      selToFn[s.selector] = s.matches;
    }

    return selToFn;
  }();

  return lookup[sel](ele);
};

var stateSelectorRegex = '(' + stateSelectors.map(function (s) {
  return s.selector;
}).join('|') + ')';

module.exports = { stateSelectors: stateSelectors, stateSelectorMatches: stateSelectorMatches, stateSelectorRegex: stateSelectorRegex };

/***/ }),
/* 16 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


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
}

// http://www.w3.org/TR/2003/WD-DOM-Level-3-Events-20030331/ecma-script-binding.html
Event.prototype = {
  instanceString: function instanceString() {
    return 'event';
  },

  recycle: function recycle(src, props) {
    this.isImmediatePropagationStopped = this.isPropagationStopped = this.isDefaultPrevented = returnFalse;

    if (src != null && src.preventDefault) {
      // Browser Event object
      this.type = src.type;

      // Events bubbling up the document may have been marked as prevented
      // by a handler lower down the tree; reflect the correct value.
      this.isDefaultPrevented = src.defaultPrevented ? returnTrue : returnFalse;
    } else if (src != null && src.type) {
      // Plain object containing all event details
      props = src;
    } else {
      // Event string
      this.type = src;
    }

    // Put explicitly provided properties onto the event object
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
    }

    // Create a timestamp if incoming event doesn't have one
    this.timeStamp = src && src.timeStamp || Date.now();
  },

  preventDefault: function preventDefault() {
    this.isDefaultPrevented = returnTrue;

    var e = this.originalEvent;
    if (!e) {
      return;
    }

    // if preventDefault exists run it on the original event
    if (e.preventDefault) {
      e.preventDefault();
    }
  },

  stopPropagation: function stopPropagation() {
    this.isPropagationStopped = returnTrue;

    var e = this.originalEvent;
    if (!e) {
      return;
    }

    // if stopPropagation exists run it on the original event
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

module.exports = Event;

/***/ }),
/* 17 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


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
var util = __webpack_require__(1);

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
      return util.MAX_INT;
    }
    // 'orphan'
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
    }
    // 'manual'
    return 0;
  }
  var eleDiff = getEleDepth(a) - getEleDepth(b);
  if (eleDiff !== 0) {
    return eleDiff;
  }

  var zDiff = a.pstyle('z-index').value - b.pstyle('z-index').value;
  if (zDiff !== 0) {
    return zDiff;
  }
  // compare indices in the core (order added to graph w/ last on top)
  return a.poolIndex() - b.poolIndex();
};

module.exports = zIndexSort;

/***/ }),
/* 18 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);
var util = __webpack_require__(1);
var Selector = __webpack_require__(6);

var Style = function Style(cy) {

  if (!(this instanceof Style)) {
    return new Style(cy);
  }

  if (!is.core(cy)) {
    util.error('A style must have a core reference');
    return;
  }

  this._private = {
    cy: cy,
    coreStyle: {}
  };

  this.length = 0;

  this.resetToDefault();
};

var styfn = Style.prototype;

styfn.instanceString = function () {
  return 'style';
};

// remove all contexts
styfn.clear = function () {
  for (var i = 0; i < this.length; i++) {
    this[i] = undefined;
  }
  this.length = 0;

  var _p = this._private;

  _p.newStyle = true;

  return this; // chaining
};

styfn.resetToDefault = function () {
  this.clear();
  this.addDefaultStylesheet();

  return this;
};

// builds a style object for the 'core' selector
styfn.core = function () {
  return this._private.coreStyle;
};

// create a new context from the specified selector string and switch to that context
styfn.selector = function (selectorStr) {
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
};

// add one or many css rules to the current context
styfn.css = function () {
  var self = this;
  var args = arguments;

  switch (args.length) {
    case 1:
      var map = args[0];

      for (var i = 0; i < self.properties.length; i++) {
        var prop = self.properties[i];
        var mapVal = map[prop.name];

        if (mapVal === undefined) {
          mapVal = map[util.dash2camel(prop.name)];
        }

        if (mapVal !== undefined) {
          this.cssRule(prop.name, mapVal);
        }
      }

      break;

    case 2:
      this.cssRule(args[0], args[1]);
      break;

    default:
      break; // do nothing if args are invalid
  }

  return this; // chaining
};
styfn.style = styfn.css;

// add a single css rule to the current context
styfn.cssRule = function (name, value) {
  // name-value pair
  var property = this.parse(name, value);

  // add property to current context if valid
  if (property) {
    var i = this.length - 1;
    this[i].properties.push(property);
    this[i].properties[property.name] = property; // allow access by name as well

    if (property.name.match(/pie-(\d+)-background-size/) && property.value) {
      this._private.hasPie = true;
    }

    if (property.mapped) {
      this[i].mappedProperties.push(property);
    }

    // add to core style if necessary
    var currentSelectorIsCore = !this[i].selector;
    if (currentSelectorIsCore) {
      this._private.coreStyle[property.name] = property;
    }
  }

  return this; // chaining
};

styfn.append = function (style) {
  if (is.stylesheet(style)) {
    style.appendToStyle(this);
  } else if (is.array(style)) {
    this.appendFromJson(style);
  } else if (is.string(style)) {
    this.appendFromString(style);
  } // you probably wouldn't want to append a Style, since you'd duplicate the default parts

  return this;
};

// static function
Style.fromJson = function (cy, json) {
  var style = new Style(cy);

  style.fromJson(json);

  return style;
};

Style.fromString = function (cy, string) {
  return new Style(cy).fromString(string);
};

[__webpack_require__(85), __webpack_require__(86), __webpack_require__(87), __webpack_require__(88), __webpack_require__(89), __webpack_require__(90), __webpack_require__(91), __webpack_require__(92)].forEach(function (props) {
  util.extend(styfn, props);
});

Style.types = styfn.types;
Style.properties = styfn.properties;

module.exports = Style;

/***/ }),
/* 19 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);

var fullFpsTime = 1000 / 60; // assume 60 frames per second

module.exports = {
  setupDequeueing: function setupDequeueing(opts) {
    return function setupDequeueingImpl() {
      var self = this;
      var r = this.renderer;

      if (self.dequeueingSetup) {
        return;
      } else {
        self.dequeueingSetup = true;
      }

      var queueRedraw = util.debounce(function () {
        r.redrawHint('eles', true);
        r.redrawHint('drag', true);

        r.redraw();
      }, opts.deqRedrawThreshold);

      var dequeue = function dequeue(willDraw, frameStartTime) {
        var startTime = util.performanceNow();
        var avgRenderTime = r.averageRedrawTime;
        var renderTime = r.lastRedrawTime;
        var deqd = [];
        var extent = r.cy.extent();
        var pixelRatio = r.getPixelRatio();

        while (true) {
          var now = util.performanceNow();
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
        }

        // callbacks on dequeue
        if (deqd.length > 0) {
          opts.onDeqd(self, deqd);

          if (!willDraw && opts.shouldRedraw(self, deqd, pixelRatio, extent)) {
            queueRedraw();
          }
        }
      };

      var priority = opts.priority || util.noop;

      r.beforeRender(dequeue, priority(self));
    };
  }
};

/***/ }),
/* 20 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);
var Core = __webpack_require__(12);
var extension = __webpack_require__(94);
var Stylesheet = __webpack_require__(136);

var cytoscape = function cytoscape(options) {
  // jshint ignore:line
  // if no options specified, use default
  if (options === undefined) {
    options = {};
  }

  // create instance
  if (is.plainObject(options)) {
    return new Core(options);
  }

  // allow for registration of extensions
  else if (is.string(options)) {
      return extension.apply(extension, arguments);
    }
};

// e.g. cytoscape.use( require('cytoscape-foo'), bar )
cytoscape.use = function (ext) {
  var args = Array.prototype.slice.call(arguments, 1); // args to pass to ext

  args.unshift(cytoscape); // cytoscape is first arg to ext

  ext.apply(null, args);

  return this;
};

// replaced by build system
cytoscape.version = __webpack_require__(137);

// expose public apis (mostly for extensions)
cytoscape.stylesheet = cytoscape.Stylesheet = Stylesheet;

module.exports = cytoscape;

/***/ }),
/* 21 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);

module.exports = {
  // get [r, g, b] from #abc or #aabbcc
  hex2tuple: function hex2tuple(hex) {
    if (!(hex.length === 4 || hex.length === 7) || hex[0] !== '#') {
      return;
    }

    var shortHex = hex.length === 4;
    var r = void 0,
        g = void 0,
        b = void 0;
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
  },

  // get [r, g, b, a] from hsl(0, 0, 0) or hsla(0, 0, 0, 0)
  hsl2tuple: function hsl2tuple(hsl) {
    var ret = void 0;
    var h = void 0,
        s = void 0,
        l = void 0,
        a = void 0,
        r = void 0,
        g = void 0,
        b = void 0;
    function hue2rgb(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }

    var m = new RegExp('^' + this.regex.hsla + '$').exec(hsl);
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
      }

      // now, convert to rgb
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
  },

  // get [r, g, b, a] from rgb(0, 0, 0) or rgba(0, 0, 0, 0)
  rgb2tuple: function rgb2tuple(rgb) {
    var ret = void 0;

    var m = new RegExp('^' + this.regex.rgba + '$').exec(rgb);
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
  },

  colorname2tuple: function colorname2tuple(color) {
    return this.colors[color.toLowerCase()];
  },

  color2tuple: function color2tuple(color) {
    return (is.array(color) ? color : null) || this.colorname2tuple(color) || this.hex2tuple(color) || this.rgb2tuple(color) || this.hsl2tuple(color);
  },

  colors: {
    // special colour names
    transparent: [0, 0, 0, 0], // NB alpha === 0

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
  }
};

/***/ }),
/* 22 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);

module.exports = {
  // has anything been set in the map
  mapEmpty: function mapEmpty(map) {
    var empty = true;

    if (map != null) {
      return Object.keys(map).length === 0;
    }

    return empty;
  },

  // pushes to the array at the end of a map (map may not be built)
  pushMap: function pushMap(options) {
    var array = this.getMap(options);

    if (array == null) {
      // if empty, put initial array
      this.setMap(this.extend({}, options, {
        value: [options.value]
      }));
    } else {
      array.push(options.value);
    }
  },

  // sets the value in a map (map may not be built)
  setMap: function setMap(options) {
    var obj = options.map;
    var key = void 0;
    var keys = options.keys;
    var l = keys.length;

    for (var i = 0; i < l; i++) {
      var _key = keys[i];

      if (is.plainObject(_key)) {
        this.error('Tried to set map with object key');
      }

      if (i < keys.length - 1) {

        // extend the map if necessary
        if (obj[_key] == null) {
          obj[_key] = {};
        }

        obj = obj[_key];
      } else {
        // set the value
        obj[_key] = options.value;
      }
    }
  },

  // gets the value in a map even if it's not built in places
  getMap: function getMap(options) {
    var obj = options.map;
    var keys = options.keys;
    var l = keys.length;

    for (var i = 0; i < l; i++) {
      var key = keys[i];

      if (is.plainObject(key)) {
        this.error('Tried to get map with object key');
      }

      obj = obj[key];

      if (obj == null) {
        return obj;
      }
    }

    return obj;
  },

  // deletes the entry in the map
  deleteMap: function deleteMap(options) {
    var obj = options.map;
    var keys = options.keys;
    var l = keys.length;
    var keepChildren = options.keepChildren;

    for (var i = 0; i < l; i++) {
      var key = keys[i];

      if (is.plainObject(key)) {
        this.error('Tried to delete map with object key');
      }

      var lastKey = i === options.keys.length - 1;
      if (lastKey) {

        if (keepChildren) {
          // then only delete child fields not in keepChildren
          var children = Object.keys(obj);

          for (var j = 0; j < children.length; j++) {
            var child = children[j];

            if (!keepChildren[child]) {
              obj[child] = undefined;
            }
          }
        } else {
          obj[key] = undefined;
        }
      } else {
        obj = obj[key];
      }
    }
  }
};

/***/ }),
/* 23 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var number = '(?:[-+]?(?:(?:\\d+|\\d*\\.\\d+)(?:[Ee][+-]?\\d+)?))';

var rgba = 'rgb[a]?\\((' + number + '[%]?)\\s*,\\s*(' + number + '[%]?)\\s*,\\s*(' + number + '[%]?)(?:\\s*,\\s*(' + number + '))?\\)';
var rgbaNoBackRefs = 'rgb[a]?\\((?:' + number + '[%]?)\\s*,\\s*(?:' + number + '[%]?)\\s*,\\s*(?:' + number + '[%]?)(?:\\s*,\\s*(?:' + number + '))?\\)';

var hsla = 'hsl[a]?\\((' + number + ')\\s*,\\s*(' + number + '[%])\\s*,\\s*(' + number + '[%])(?:\\s*,\\s*(' + number + '))?\\)';
var hslaNoBackRefs = 'hsl[a]?\\((?:' + number + ')\\s*,\\s*(?:' + number + '[%])\\s*,\\s*(?:' + number + '[%])(?:\\s*,\\s*(?:' + number + '))?\\)';

var hex3 = '\\#[0-9a-fA-F]{3}';
var hex6 = '\\#[0-9a-fA-F]{6}';

module.exports = {
  regex: {
    number: number,
    rgba: rgba,
    rgbaNoBackRefs: rgbaNoBackRefs,
    hsla: hsla,
    hslaNoBackRefs: hslaNoBackRefs,
    hex3: hex3,
    hex6: hex6
  }
};

/***/ }),
/* 24 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var memoize = __webpack_require__(13);
var is = __webpack_require__(0);

module.exports = {

  camel2dash: memoize(function (str) {
    return str.replace(/([A-Z])/g, function (v) {
      return '-' + v.toLowerCase();
    });
  }),

  dash2camel: memoize(function (str) {
    return str.replace(/(-\w)/g, function (v) {
      return v[1].toUpperCase();
    });
  }),

  prependCamel: memoize(function (prefix, str) {
    return prefix + str[0].toUpperCase() + str.substring(1);
  }, function (prefix, str) {
    return prefix + '$' + str;
  }),

  capitalize: function capitalize(str) {
    if (is.emptyString(str)) {
      return str;
    }

    return str.charAt(0).toUpperCase() + str.substring(1);
  }

};

/***/ }),
/* 25 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var window = __webpack_require__(3);
var performance = window ? window.performance : null;

var util = {};

var pnow = performance && performance.now ? function () {
  return performance.now();
} : function () {
  return Date.now();
};

var raf = function () {
  if (window) {
    if (window.requestAnimationFrame) {
      return function (fn) {
        window.requestAnimationFrame(fn);
      };
    } else if (window.mozRequestAnimationFrame) {
      return function (fn) {
        window.mozRequestAnimationFrame(fn);
      };
    } else if (window.webkitRequestAnimationFrame) {
      return function (fn) {
        window.webkitRequestAnimationFrame(fn);
      };
    } else if (window.msRequestAnimationFrame) {
      return function (fn) {
        window.msRequestAnimationFrame(fn);
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

util.requestAnimationFrame = function (fn) {
  raf(fn);
};

util.performanceNow = pnow;

util.debounce = __webpack_require__(26);

util.now = function () {
  return Date.now();
};

module.exports = util;

/***/ }),
/* 26 */
/***/ (function(module, exports) {

module.exports = __WEBPACK_EXTERNAL_MODULE_26__;

/***/ }),
/* 27 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function ascending(a, b) {
  if (a < b) {
    return -1;
  } else if (a > b) {
    return 1;
  } else {
    return 0;
  }
}

function descending(a, b) {
  return -1 * ascending(a, b);
}

module.exports = {
  sort: {
    ascending: ascending,
    descending: descending
  }
};

/***/ }),
/* 28 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function ObjectMap() {
  this._obj = {};
}

var p = ObjectMap.prototype;

p.set = function (key, val) {
  this._obj[key] = val;
};

p.delete = function (key) {
  this._obj[key] = null;
};

p.has = function (key) {
  return this._obj[key] != null;
};

p.get = function (key) {
  return this._obj[key];
};

// TODO use the stdlib Map in future...
// module.exports = typeof Map !== 'undefined' ? Map : ObjectMap;
module.exports = ObjectMap;

/***/ }),
/* 29 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);

var elesfn = {};

[__webpack_require__(30), __webpack_require__(31), __webpack_require__(33), __webpack_require__(34), __webpack_require__(35), __webpack_require__(36), __webpack_require__(37), __webpack_require__(38), __webpack_require__(39), __webpack_require__(40), __webpack_require__(41)].forEach(function (props) {
  util.extend(elesfn, props);
});

module.exports = elesfn;

/***/ }),
/* 30 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);

var defineSearch = function defineSearch(params) {
  params = {
    bfs: params.bfs || !params.dfs,
    dfs: params.dfs || !params.bfs
  };

  // from pseudocode on wikipedia
  return function searchFn(roots, fn, directed) {
    var options;
    if (is.plainObject(roots) && !is.elementOrCollection(roots)) {
      options = roots;
      roots = options.roots || options.root;
      fn = options.visit;
      directed = options.directed;
    }

    directed = arguments.length === 2 && !is.fn(fn) ? fn : directed;
    fn = is.fn(fn) ? fn : function () {};

    var cy = this._private.cy;
    var v = roots = is.string(roots) ? this.filter(roots) : roots;
    var Q = [];
    var connectedNodes = [];
    var connectedBy = {};
    var id2depth = {};
    var V = {};
    var j = 0;
    var found;
    var nodes = this.nodes();
    var edges = this.edges();

    // enqueue v
    for (var i = 0; i < v.length; i++) {
      if (v[i].isNode()) {
        Q.unshift(v[i]);

        if (params.bfs) {
          V[v[i].id()] = true;

          connectedNodes.push(v[i]);
        }

        id2depth[v[i].id()] = 0;
      }
    }

    while (Q.length !== 0) {
      var v = params.bfs ? Q.shift() : Q.pop();

      if (params.dfs) {
        if (V[v.id()]) {
          continue;
        }

        V[v.id()] = true;

        connectedNodes.push(v);
      }

      var depth = id2depth[v.id()];
      var prevEdge = connectedBy[v.id()];
      var prevNode = prevEdge == null ? undefined : prevEdge.connectedNodes().not(v)[0];
      var ret;

      ret = fn(v, prevEdge, prevNode, j++, depth);

      if (ret === true) {
        found = v;
        break;
      }

      if (ret === false) {
        break;
      }

      var vwEdges = v.connectedEdges(directed ? function (ele) {
        return ele.data('source') === v.id();
      } : undefined).intersect(edges);
      for (var i = 0; i < vwEdges.length; i++) {
        var e = vwEdges[i];
        var w = e.connectedNodes(function (n) {
          return n.id() !== v.id();
        }).intersect(nodes);

        if (w.length !== 0 && !V[w.id()]) {
          w = w[0];

          Q.push(w);

          if (params.bfs) {
            V[w.id()] = true;

            connectedNodes.push(w);
          }

          connectedBy[w.id()] = e;

          id2depth[w.id()] = id2depth[v.id()] + 1;
        }
      }
    }

    var connectedEles = [];

    for (var i = 0; i < connectedNodes.length; i++) {
      var node = connectedNodes[i];
      var edge = connectedBy[node.id()];

      if (edge) {
        connectedEles.push(edge);
      }

      connectedEles.push(node);
    }

    return {
      path: cy.collection(connectedEles, { unique: true }),
      found: cy.collection(found)
    };
  };
};

// search, spanning trees, etc
var elesfn = {
  breadthFirstSearch: defineSearch({ bfs: true }),
  depthFirstSearch: defineSearch({ dfs: true })
};

// nice, short mathemathical alias
elesfn.bfs = elesfn.breadthFirstSearch;
elesfn.dfs = elesfn.depthFirstSearch;

module.exports = elesfn;

/***/ }),
/* 31 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);
var Heap = __webpack_require__(9);

var elesfn = {

  dijkstra: function dijkstra(root, weightFn, directed) {
    var options;
    if (is.plainObject(root) && !is.elementOrCollection(root)) {
      options = root;
      root = options.root;
      weightFn = options.weight;
      directed = options.directed;
    }

    var cy = this._private.cy;
    weightFn = is.fn(weightFn) ? weightFn : function () {
      return 1;
    }; // if not specified, assume each edge has equal weight (1)

    var source = is.string(root) ? this.filter(root)[0] : root[0];
    var dist = {};
    var prev = {};
    var knownDist = {};

    var edges = this.edges().filter(function (ele) {
      return !ele.isLoop();
    });
    var nodes = this.nodes();

    var getDist = function getDist(node) {
      return dist[node.id()];
    };

    var setDist = function setDist(node, d) {
      dist[node.id()] = d;

      Q.updateItem(node);
    };

    var Q = new Heap(function (a, b) {
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

      for (var i = 0; i < uvs.length; i++) {
        var edge = uvs[i];
        var weight = weightFn(edge);

        if (weight < smallestDistance || !smallestEdge) {
          smallestDistance = weight;
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
      for (var i = 0; i < neighbors.length; i++) {
        var v = neighbors[i];
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
        var target = is.string(node) ? nodes.filter(node)[0] : node[0];

        return knownDist[target.id()];
      },

      pathTo: function pathTo(node) {
        var target = is.string(node) ? nodes.filter(node)[0] : node[0];
        var S = [];
        var u = target;

        if (target.length > 0) {
          S.unshift(target);

          while (prev[u.id()]) {
            var p = prev[u.id()];

            S.unshift(p.edge);
            S.unshift(p.node);

            u = p.node;
          }
        }

        return cy.collection(S);
      }
    };
  }
};

module.exports = elesfn;

/***/ }),
/* 32 */
/***/ (function(module, exports) {

module.exports = __WEBPACK_EXTERNAL_MODULE_32__;

/***/ }),
/* 33 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);

// search, spanning trees, etc
var elesfn = {

  // kruskal's algorithm (finds min spanning tree, assuming undirected graph)
  // implemented from pseudocode from wikipedia
  kruskal: function kruskal(weightFn) {
    var cy = this.cy();

    weightFn = is.fn(weightFn) ? weightFn : function () {
      return 1;
    }; // if not specified, assume each edge has equal weight (1)

    function findSet(ele) {
      for (var i = 0; i < forest.length; i++) {
        var eles = forest[i];

        if (eles.anySame(ele)) {
          return {
            eles: eles,
            index: i
          };
        }
      }
    }

    var A = cy.collection(cy, []);
    var forest = [];
    var nodes = this.nodes();

    for (var i = 0; i < nodes.length; i++) {
      forest.push(nodes[i].collection());
    }

    var edges = this.edges();
    var S = edges.toArray().sort(function (a, b) {
      var weightA = weightFn(a);
      var weightB = weightFn(b);

      return weightA - weightB;
    });

    for (var i = 0; i < S.length; i++) {
      var edge = S[i];
      var u = edge.source()[0];
      var v = edge.target()[0];
      var setU = findSet(u);
      var setV = findSet(v);

      if (setU.index !== setV.index) {
        A = A.add(edge);

        // combine forests for u and v
        forest[setU.index] = setU.eles.add(setV.eles);
        forest.splice(setV.index, 1);
      }
    }

    return nodes.add(A);
  }
};

module.exports = elesfn;

/***/ }),
/* 34 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);

var elesfn = {

  // Implemented from pseudocode from wikipedia
  aStar: function aStar(options) {
    var eles = this;

    options = options || {};

    // Reconstructs the path from Start to End, acumulating the result in pathAcum
    var reconstructPath = function reconstructPath(start, end, cameFromMap, pathAcum) {
      // Base case
      if (start == end) {
        pathAcum.unshift(cy.getElementById(end));
        return pathAcum;
      }

      if (end in cameFromMap) {
        // We know which node is before the last one
        var previous = cameFromMap[end];
        var previousEdge = cameFromEdge[end];

        pathAcum.unshift(cy.getElementById(previousEdge));
        pathAcum.unshift(cy.getElementById(end));

        return reconstructPath(start, previous, cameFromMap, pathAcum);
      }

      // We should not reach here!
      return undefined;
    };

    // Returns the index of the element in openSet which has minimum fScore
    var findMin = function findMin(openSet, fScore) {
      if (openSet.length === 0) {
        // Should never be the case
        return undefined;
      }
      var minPos = 0;
      var tempScore = fScore[openSet[0]];
      for (var i = 1; i < openSet.length; i++) {
        var s = fScore[openSet[i]];
        if (s < tempScore) {
          tempScore = s;
          minPos = i;
        }
      }
      return minPos;
    };

    var cy = this._private.cy;

    // root - mandatory!
    if (options != null && options.root != null) {
      var source = is.string(options.root) ?
      // use it as a selector, e.g. "#rootID
      this.filter(options.root)[0] : options.root[0];
    } else {
      return undefined;
    }

    // goal - mandatory!
    if (options.goal != null) {
      var target = is.string(options.goal) ?
      // use it as a selector, e.g. "#goalID
      this.filter(options.goal)[0] : options.goal[0];
    } else {
      return undefined;
    }

    // Heuristic function - optional
    if (options.heuristic != null && is.fn(options.heuristic)) {
      var heuristic = options.heuristic;
    } else {
      var heuristic = function heuristic() {
        return 0;
      }; // use constant if unspecified
    }

    // Weight function - optional
    if (options.weight != null && is.fn(options.weight)) {
      var weightFn = options.weight;
    } else {
      // If not specified, assume each edge has equal weight (1)
      var weightFn = function weightFn(e) {
        return 1;
      };
    }

    // directed - optional
    if (options.directed != null) {
      var directed = options.directed;
    } else {
      var directed = false;
    }

    var sid = source.id();
    var tid = target.id();

    var closedSet = [];
    var openSet = [sid];
    var cameFrom = {};
    var cameFromEdge = {};
    var gScore = {};
    var fScore = {};

    gScore[sid] = 0;
    fScore[sid] = heuristic(source);

    // Counter
    var steps = 0;

    // Main loop
    while (openSet.length > 0) {
      var minPos = findMin(openSet, fScore);
      var cMin = cy.getElementById(openSet[minPos]);
      var cMinId = cMin.id();
      steps++;

      // If we've found our goal, then we are done
      if (cMinId == tid) {
        var rPath = reconstructPath(sid, tid, cameFrom, []);

        return {
          found: true,
          distance: gScore[cMinId],
          path: eles.spawn(rPath),
          steps: steps
        };
      }

      // Add cMin to processed nodes
      closedSet.push(cMinId);
      // Remove cMin from boundary nodes
      openSet.splice(minPos, 1);

      // Update scores for neighbors of cMin
      // Take into account if graph is directed or not
      var vwEdges = cMin._private.edges;

      for (var i = 0; i < vwEdges.length; i++) {
        var e = vwEdges[i];

        // edge must be in set of calling eles
        if (!this.hasElementWithId(e.id())) {
          continue;
        }

        // cMin must be the source of edge if directed
        if (directed && e.data('source') !== cMinId) {
          continue;
        }

        var wSrc = e.source();
        var wTgt = e.target();

        var w = wSrc.id() !== cMinId ? wSrc : wTgt;
        var wid = w.id();

        // node must be in set of calling eles
        if (!this.hasElementWithId(wid)) {
          continue;
        }

        // if node is in closedSet, ignore it
        if (closedSet.indexOf(wid) != -1) {
          continue;
        }

        // New tentative score for node w
        var tempScore = gScore[cMinId] + weightFn(e);

        // Update gScore for node w if:
        //   w not present in openSet
        // OR
        //   tentative gScore is less than previous value

        // w not in openSet
        if (openSet.indexOf(wid) == -1) {
          gScore[wid] = tempScore;
          fScore[wid] = tempScore + heuristic(w);
          openSet.push(wid); // Add node to openSet
          cameFrom[wid] = cMinId;
          cameFromEdge[wid] = e.id();
          continue;
        }
        // w already in openSet, but with greater gScore
        if (tempScore < gScore[wid]) {
          gScore[wid] = tempScore;
          fScore[wid] = tempScore + heuristic(w);
          cameFrom[wid] = cMinId;
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


module.exports = elesfn;

/***/ }),
/* 35 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);

var elesfn = {

  // Implemented from pseudocode from wikipedia
  floydWarshall: function floydWarshall(options) {
    options = options || {};

    var cy = this.cy();

    // Weight function - optional
    if (options.weight != null && is.fn(options.weight)) {
      var weightFn = options.weight;
    } else {
      // If not specified, assume each edge has equal weight (1)
      var weightFn = function weightFn(e) {
        return 1;
      };
    }

    // directed - optional
    if (options.directed != null) {
      var directed = options.directed;
    } else {
      var directed = false;
    }

    var edges = this.edges().stdFilter(function (e) {
      return !e.isLoop();
    });
    var nodes = this.nodes();
    var numNodes = nodes.length;

    // mapping: node id -> position in nodes array
    var id2position = {};
    for (var i = 0; i < numNodes; i++) {
      id2position[nodes[i].id()] = i;
    }

    // Initialize distance matrix
    var dist = [];
    for (var i = 0; i < numNodes; i++) {
      var newRow = new Array(numNodes);
      for (var j = 0; j < numNodes; j++) {
        if (i == j) {
          newRow[j] = 0;
        } else {
          newRow[j] = Infinity;
        }
      }
      dist.push(newRow);
    }

    // Initialize matrix used for path reconstruction
    // Initialize distance matrix
    var next = [];
    var edgeNext = [];

    var initMatrix = function initMatrix(next) {
      for (var i = 0; i < numNodes; i++) {
        var newRow = new Array(numNodes);
        for (var j = 0; j < numNodes; j++) {
          newRow[j] = undefined;
        }
        next.push(newRow);
      }
    };

    initMatrix(next);
    initMatrix(edgeNext);

    // Process edges
    for (var i = 0; i < edges.length; i++) {
      var sourceIndex = id2position[edges[i].source().id()];
      var targetIndex = id2position[edges[i].target().id()];
      var weight = weightFn(edges[i]);

      // Check if already process another edge between same 2 nodes
      if (dist[sourceIndex][targetIndex] > weight) {
        dist[sourceIndex][targetIndex] = weight;
        next[sourceIndex][targetIndex] = targetIndex;
        edgeNext[sourceIndex][targetIndex] = edges[i];
      }
    }

    // If undirected graph, process 'reversed' edges
    if (!directed) {
      for (var i = 0; i < edges.length; i++) {
        var sourceIndex = id2position[edges[i].target().id()];
        var targetIndex = id2position[edges[i].source().id()];
        var weight = weightFn(edges[i]);

        // Check if already process another edge between same 2 nodes
        if (dist[sourceIndex][targetIndex] > weight) {
          dist[sourceIndex][targetIndex] = weight;
          next[sourceIndex][targetIndex] = targetIndex;
          edgeNext[sourceIndex][targetIndex] = edges[i];
        }
      }
    }

    // Main loop
    for (var k = 0; k < numNodes; k++) {
      for (var i = 0; i < numNodes; i++) {
        for (var j = 0; j < numNodes; j++) {
          if (dist[i][k] + dist[k][j] < dist[i][j]) {
            dist[i][j] = dist[i][k] + dist[k][j];
            next[i][j] = next[i][k];
          }
        }
      }
    }

    // Build result object
    var position2id = [];
    for (var i = 0; i < numNodes; i++) {
      position2id.push(nodes[i].id());
    }

    var res = {
      distance: function distance(from, to) {
        if (is.string(from)) {
          // from is a selector string
          var fromId = cy.filter(from)[0].id();
        } else {
          // from is a node
          var fromId = from.id();
        }

        if (is.string(to)) {
          // to is a selector string
          var toId = cy.filter(to)[0].id();
        } else {
          // to is a node
          var toId = to.id();
        }

        return dist[id2position[fromId]][id2position[toId]];
      },

      path: function path(from, to) {
        var reconstructPathAux = function reconstructPathAux(from, to, next, position2id, edgeNext) {
          if (from === to) {
            return cy.getElementById(position2id[from]);
          }
          if (next[from][to] === undefined) {
            return undefined;
          }

          var path = [cy.getElementById(position2id[from])];
          var prev = from;
          while (from !== to) {
            prev = from;
            from = next[from][to];

            var edge = edgeNext[prev][from];
            path.push(edge);

            path.push(cy.getElementById(position2id[from]));
          }
          return path;
        };

        if (is.string(from)) {
          // from is a selector string
          var fromId = cy.filter(from)[0].id();
        } else {
          // from is a node
          var fromId = from.id();
        }

        if (is.string(to)) {
          // to is a selector string
          var toId = cy.filter(to)[0].id();
        } else {
          // to is a node
          var toId = to.id();
        }

        var pathArr = reconstructPathAux(id2position[fromId], id2position[toId], next, position2id, edgeNext);

        return cy.collection(pathArr);
      }
    };

    return res;
  } // floydWarshall

}; // elesfn

module.exports = elesfn;

/***/ }),
/* 36 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);
var util = __webpack_require__(1);

var elesfn = {

  // Implemented from pseudocode from wikipedia
  bellmanFord: function bellmanFord(options) {
    var eles = this;

    options = options || {};

    // Weight function - optional
    if (options.weight != null && is.fn(options.weight)) {
      var weightFn = options.weight;
    } else {
      // If not specified, assume each edge has equal weight (1)
      var weightFn = function weightFn(e) {
        return 1;
      };
    }

    // directed - optional
    if (options.directed != null) {
      var directed = options.directed;
    } else {
      var directed = false;
    }

    // root - mandatory!
    if (options.root != null) {
      if (is.string(options.root)) {
        // use it as a selector, e.g. "#rootID
        var source = this.filter(options.root)[0];
      } else {
        var source = options.root[0];
      }
    } else {
      return undefined;
    }

    var cy = this._private.cy;
    var edges = this.edges().stdFilter(function (e) {
      return !e.isLoop();
    });
    var nodes = this.nodes();
    var numNodes = nodes.length;

    // mapping: node id -> position in nodes array
    var id2position = {};
    for (var i = 0; i < numNodes; i++) {
      id2position[nodes[i].id()] = i;
    }

    // Initializations
    var cost = [];
    var predecessor = [];
    var predEdge = [];

    for (var i = 0; i < numNodes; i++) {
      if (nodes[i].id() === source.id()) {
        cost[i] = 0;
      } else {
        cost[i] = Infinity;
      }
      predecessor[i] = undefined;
    }

    // Edges relaxation
    var flag = false;
    for (var i = 1; i < numNodes; i++) {
      flag = false;
      for (var e = 0; e < edges.length; e++) {
        var sourceIndex = id2position[edges[e].source().id()];
        var targetIndex = id2position[edges[e].target().id()];
        var weight = weightFn(edges[e]);

        var temp = cost[sourceIndex] + weight;
        if (temp < cost[targetIndex]) {
          cost[targetIndex] = temp;
          predecessor[targetIndex] = sourceIndex;
          predEdge[targetIndex] = edges[e];
          flag = true;
        }

        // If undirected graph, we need to take into account the 'reverse' edge
        if (!directed) {
          var temp = cost[targetIndex] + weight;
          if (temp < cost[sourceIndex]) {
            cost[sourceIndex] = temp;
            predecessor[sourceIndex] = targetIndex;
            predEdge[sourceIndex] = edges[e];
            flag = true;
          }
        }
      }

      if (!flag) {
        break;
      }
    }

    if (flag) {
      // Check for negative weight cycles
      for (var e = 0; e < edges.length; e++) {
        var sourceIndex = id2position[edges[e].source().id()];
        var targetIndex = id2position[edges[e].target().id()];
        var weight = weightFn(edges[e]);

        if (cost[sourceIndex] + weight < cost[targetIndex]) {
          util.error('Graph contains a negative weight cycle for Bellman-Ford');
          return { pathTo: undefined,
            distanceTo: undefined,
            hasNegativeWeightCycle: true };
        }
      }
    }

    // Build result object
    var position2id = [];
    for (var i = 0; i < numNodes; i++) {
      position2id.push(nodes[i].id());
    }

    var res = {
      distanceTo: function distanceTo(to) {
        if (is.string(to)) {
          // to is a selector string
          var toId = cy.filter(to)[0].id();
        } else {
          // to is a node
          var toId = to.id();
        }

        return cost[id2position[toId]];
      },

      pathTo: function pathTo(to) {

        var reconstructPathAux = function reconstructPathAux(predecessor, fromPos, toPos, position2id, acumPath, predEdge) {
          for (;;) {
            // Add toId to path
            acumPath.push(cy.getElementById(position2id[toPos]));
            acumPath.push(predEdge[toPos]);

            if (fromPos === toPos) {
              // reached starting node
              return acumPath;
            }

            // If no path exists, discart acumulated path and return undefined
            var predPos = predecessor[toPos];
            if (typeof predPos === 'undefined') {
              return undefined;
            }

            toPos = predPos;
          }
        };

        if (is.string(to)) {
          // to is a selector string
          var toId = cy.filter(to)[0].id();
        } else {
          // to is a node
          var toId = to.id();
        }
        var path = [];

        // This returns a reversed path
        var res = reconstructPathAux(predecessor, id2position[source.id()], id2position[toId], position2id, path, predEdge);

        // Get it in the correct order and return it
        if (res != null) {
          res.reverse();
        }

        return eles.spawn(res);
      },

      hasNegativeWeightCycle: false
    };

    return res;
  } // bellmanFord

}; // elesfn

module.exports = elesfn;

/***/ }),
/* 37 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);

var elesfn = {

  // Computes the minimum cut of an undirected graph
  // Returns the correct answer with high probability
  kargerStein: function kargerStein(options) {
    var eles = this;

    options = options || {};

    // Function which colapses 2 (meta) nodes into one
    // Updates the remaining edge lists
    // Receives as a paramater the edge which causes the collapse
    var colapse = function colapse(edgeIndex, nodeMap, remainingEdges) {
      var edgeInfo = remainingEdges[edgeIndex];
      var sourceIn = edgeInfo[1];
      var targetIn = edgeInfo[2];
      var partition1 = nodeMap[sourceIn];
      var partition2 = nodeMap[targetIn];

      // Delete all edges between partition1 and partition2
      var newEdges = remainingEdges.filter(function (edge) {
        if (nodeMap[edge[1]] === partition1 && nodeMap[edge[2]] === partition2) {
          return false;
        }
        if (nodeMap[edge[1]] === partition2 && nodeMap[edge[2]] === partition1) {
          return false;
        }
        return true;
      });

      // All edges pointing to partition2 should now point to partition1
      for (var i = 0; i < newEdges.length; i++) {
        var edge = newEdges[i];
        if (edge[1] === partition2) {
          // Check source
          newEdges[i] = edge.slice(0);
          newEdges[i][1] = partition1;
        } else if (edge[2] === partition2) {
          // Check target
          newEdges[i] = edge.slice(0);
          newEdges[i][2] = partition1;
        }
      }

      // Move all nodes from partition2 to partition1
      for (var i = 0; i < nodeMap.length; i++) {
        if (nodeMap[i] === partition2) {
          nodeMap[i] = partition1;
        }
      }

      return newEdges;
    };

    // Contracts a graph until we reach a certain number of meta nodes
    var contractUntil = function contractUntil(metaNodeMap, remainingEdges, size, sizeLimit) {
      // Stop condition
      if (size <= sizeLimit) {
        return remainingEdges;
      }

      // Choose an edge randomly
      var edgeIndex = Math.floor(Math.random() * remainingEdges.length);

      // Colapse graph based on edge
      var newEdges = colapse(edgeIndex, metaNodeMap, remainingEdges);

      return contractUntil(metaNodeMap, newEdges, size - 1, sizeLimit);
    };

    var cy = this._private.cy;
    var edges = this.edges().stdFilter(function (e) {
      return !e.isLoop();
    });
    var nodes = this.nodes();
    var numNodes = nodes.length;
    var numEdges = edges.length;
    var numIter = Math.ceil(Math.pow(Math.log(numNodes) / Math.LN2, 2));
    var stopSize = Math.floor(numNodes / Math.sqrt(2));

    if (numNodes < 2) {
      util.error('At least 2 nodes are required for Karger-Stein algorithm');
      return undefined;
    }

    // Create numerical identifiers for each node
    // mapping: node id -> position in nodes array
    // for reverse mapping, simply use nodes array
    var id2position = {};
    for (var i = 0; i < numNodes; i++) {
      id2position[nodes[i].id()] = i;
    }

    // Now store edge destination as indexes
    // Format for each edge (edge index, source node index, target node index)
    var edgeIndexes = [];
    for (var i = 0; i < numEdges; i++) {
      var e = edges[i];
      edgeIndexes.push([i, id2position[e.source().id()], id2position[e.target().id()]]);
    }

    // We will store the best cut found here
    var minCutSize = Infinity;
    var minCut;

    // Initial meta node partition
    var originalMetaNode = [];
    for (var i = 0; i < numNodes; i++) {
      originalMetaNode.push(i);
    }

    // Main loop
    for (var iter = 0; iter <= numIter; iter++) {
      // Create new meta node partition
      var metaNodeMap = originalMetaNode.slice(0);

      // Contract until stop point (stopSize nodes)
      var edgesState = contractUntil(metaNodeMap, edgeIndexes, numNodes, stopSize);

      // Create a copy of the colapsed nodes state
      var metaNodeMap2 = metaNodeMap.slice(0);

      // Run 2 iterations starting in the stop state
      var res1 = contractUntil(metaNodeMap, edgesState, stopSize, 2);
      var res2 = contractUntil(metaNodeMap2, edgesState, stopSize, 2);

      // Is any of the 2 results the best cut so far?
      if (res1.length <= res2.length && res1.length < minCutSize) {
        minCutSize = res1.length;
        minCut = [res1, metaNodeMap];
      } else if (res2.length <= res1.length && res2.length < minCutSize) {
        minCutSize = res2.length;
        minCut = [res2, metaNodeMap2];
      }
    } // end of main loop


    // Construct result
    var resEdges = minCut[0].map(function (e) {
      return edges[e[0]];
    });
    var partition1 = [];
    var partition2 = [];

    // traverse metaNodeMap for best cut
    var witnessNodePartition = minCut[1][0];
    for (var i = 0; i < minCut[1].length; i++) {
      var partitionId = minCut[1][i];
      if (partitionId === witnessNodePartition) {
        partition1.push(nodes[i]);
      } else {
        partition2.push(nodes[i]);
      }
    }

    var ret = {
      cut: eles.spawn(cy, resEdges),
      partition1: eles.spawn(partition1),
      partition2: eles.spawn(partition2)
    };

    return ret;
  }
}; // elesfn


module.exports = elesfn;

/***/ }),
/* 38 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);

var elesfn = {

  pageRank: function pageRank(options) {
    options = options || {};

    var normalizeVector = function normalizeVector(vector) {
      var length = vector.length;

      // First, get sum of all elements
      var total = 0;
      for (var i = 0; i < length; i++) {
        total += vector[i];
      }

      // Now, divide each by the sum of all elements
      for (var i = 0; i < length; i++) {
        vector[i] = vector[i] / total;
      }
    };

    // dampingFactor - optional
    if (options != null && options.dampingFactor != null) {
      var dampingFactor = options.dampingFactor;
    } else {
      var dampingFactor = 0.8; // Default damping factor
    }

    // desired precision - optional
    if (options != null && options.precision != null) {
      var epsilon = options.precision;
    } else {
      var epsilon = 0.000001; // Default precision
    }

    // Max number of iterations - optional
    if (options != null && options.iterations != null) {
      var numIter = options.iterations;
    } else {
      var numIter = 200; // Default number of iterations
    }

    // Weight function - optional
    if (options != null && options.weight != null && is.fn(options.weight)) {
      var weightFn = options.weight;
    } else {
      // If not specified, assume each edge has equal weight (1)
      var weightFn = function weightFn(e) {
        return 1;
      };
    }

    var cy = this._private.cy;
    var edges = this.edges().stdFilter(function (e) {
      return !e.isLoop();
    });
    var nodes = this.nodes();
    var numNodes = nodes.length;
    var numEdges = edges.length;

    // Create numerical identifiers for each node
    // mapping: node id -> position in nodes array
    // for reverse mapping, simply use nodes array
    var id2position = {};
    for (var i = 0; i < numNodes; i++) {
      id2position[nodes[i].id()] = i;
    }

    // Construct transposed adjacency matrix
    // First lets have a zeroed matrix of the right size
    // We'll also keep track of the sum of each column
    var matrix = [];
    var columnSum = [];
    var additionalProb = (1 - dampingFactor) / numNodes;

    // Create null matric
    for (var i = 0; i < numNodes; i++) {
      var newRow = [];
      for (var j = 0; j < numNodes; j++) {
        newRow.push(0.0);
      }
      matrix.push(newRow);
      columnSum.push(0.0);
    }

    // Now, process edges
    for (var i = 0; i < numEdges; i++) {
      var edge = edges[i];
      var s = id2position[edge.source().id()];
      var t = id2position[edge.target().id()];
      var w = weightFn(edge);

      // Update matrix
      matrix[t][s] += w;

      // Update column sum
      columnSum[s] += w;
    }

    // Add additional probability based on damping factor
    // Also, take into account columns that have sum = 0
    var p = 1.0 / numNodes + additionalProb; // Shorthand
    // Traverse matrix, column by column
    for (var j = 0; j < numNodes; j++) {
      if (columnSum[j] === 0) {
        // No 'links' out from node jth, assume equal probability for each possible node
        for (var i = 0; i < numNodes; i++) {
          matrix[i][j] = p;
        }
      } else {
        // Node jth has outgoing link, compute normalized probabilities
        for (var i = 0; i < numNodes; i++) {
          matrix[i][j] = matrix[i][j] / columnSum[j] + additionalProb;
        }
      }
    }

    // Compute dominant eigenvector using power method
    var eigenvector = [];
    var nullVector = [];
    var previous;

    // Start with a vector of all 1's
    // Also, initialize a null vector which will be used as shorthand
    for (var i = 0; i < numNodes; i++) {
      eigenvector.push(1.0);
      nullVector.push(0.0);
    }

    for (var iter = 0; iter < numIter; iter++) {
      // New array with all 0's
      var temp = nullVector.slice(0);

      // Multiply matrix with previous result
      for (var i = 0; i < numNodes; i++) {
        for (var j = 0; j < numNodes; j++) {
          temp[i] += matrix[i][j] * eigenvector[j];
        }
      }

      normalizeVector(temp);
      previous = eigenvector;
      eigenvector = temp;

      var diff = 0;
      // Compute difference (squared module) of both vectors
      for (var i = 0; i < numNodes; i++) {
        diff += Math.pow(previous[i] - eigenvector[i], 2);
      }

      // If difference is less than the desired threshold, stop iterating
      if (diff < epsilon) {
        break;
      }
    }

    // Construct result
    var res = {
      rank: function rank(node) {
        if (is.string(node)) {
          // is a selector string
          var nodeId = cy.filter(node)[0].id();
        } else {
          // is a node object
          var nodeId = node.id();
        }
        return eigenvector[id2position[nodeId]];
      }
    };

    return res;
  } // pageRank

}; // elesfn

module.exports = elesfn;

/***/ }),
/* 39 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);
var util = __webpack_require__(1);

var elesfn = {

  degreeCentralityNormalized: function degreeCentralityNormalized(options) {
    options = options || {};

    var cy = this.cy();

    // directed - optional
    if (options.directed != null) {
      var directed = options.directed;
    } else {
      var directed = false;
    }

    var nodes = this.nodes();
    var numNodes = nodes.length;

    if (!directed) {
      var degrees = {};
      var maxDegree = 0;

      for (var i = 0; i < numNodes; i++) {
        var node = nodes[i];
        // add current node to the current options object and call degreeCentrality
        var currDegree = this.degreeCentrality(util.extend({}, options, { root: node }));
        if (maxDegree < currDegree.degree) maxDegree = currDegree.degree;

        degrees[node.id()] = currDegree.degree;
      }

      return {
        degree: function degree(node) {
          if (maxDegree == 0) return 0;

          if (is.string(node)) {
            // from is a selector string
            var node = cy.filter(node)[0].id();
          } else {
            // from is a node
            var node = node.id();
          }

          return degrees[node] / maxDegree;
        }
      };
    } else {
      var indegrees = {};
      var outdegrees = {};
      var maxIndegree = 0;
      var maxOutdegree = 0;

      for (var i = 0; i < numNodes; i++) {
        var node = nodes[i];
        // add current node to the current options object and call degreeCentrality
        var currDegree = this.degreeCentrality(util.extend({}, options, { root: node }));

        if (maxIndegree < currDegree.indegree) maxIndegree = currDegree.indegree;

        if (maxOutdegree < currDegree.outdegree) maxOutdegree = currDegree.outdegree;

        indegrees[node.id()] = currDegree.indegree;
        outdegrees[node.id()] = currDegree.outdegree;
      }

      return {
        indegree: function indegree(node) {
          if (maxIndegree == 0) return 0;

          if (is.string(node)) {
            // from is a selector string
            var node = cy.filter(node)[0].id();
          } else {
            // from is a node
            var node = node.id();
          }

          return indegrees[node] / maxIndegree;
        },
        outdegree: function outdegree(node) {
          if (maxOutdegree == 0) return 0;

          if (is.string(node)) {
            // from is a selector string
            var node = cy.filter(node)[0].id();
          } else {
            // from is a node
            var node = node.id();
          }

          return outdegrees[node] / maxOutdegree;
        }

      };
    }
  }, // degreeCentralityNormalized

  // Implemented from the algorithm in Opsahl's paper
  // "Node centrality in weighted networks: Generalizing degree and shortest paths"
  // check the heading 2 "Degree"
  degreeCentrality: function degreeCentrality(options) {
    options = options || {};

    var callingEles = this;

    // root - mandatory!
    if (options != null && options.root != null) {
      var root = is.string(options.root) ? this.filter(options.root)[0] : options.root[0];
    } else {
      return undefined;
    }

    // weight - optional
    if (options.weight != null && is.fn(options.weight)) {
      var weightFn = options.weight;
    } else {
      // If not specified, assume each edge has equal weight (1)
      var weightFn = function weightFn(e) {
        return 1;
      };
    }

    // directed - optional
    if (options.directed != null) {
      var directed = options.directed;
    } else {
      var directed = false;
    }

    // alpha - optional
    if (options.alpha != null && is.number(options.alpha)) {
      var alpha = options.alpha;
    } else {
      alpha = 0;
    }

    if (!directed) {
      var connEdges = root.connectedEdges().intersection(callingEles);
      var k = connEdges.length;
      var s = 0;

      // Now, sum edge weights
      for (var i = 0; i < connEdges.length; i++) {
        var edge = connEdges[i];
        s += weightFn(edge);
      }

      return {
        degree: Math.pow(k, 1 - alpha) * Math.pow(s, alpha)
      };
    } else {
      var incoming = root.connectedEdges('edge[target = "' + root.id() + '"]').intersection(callingEles);
      var outgoing = root.connectedEdges('edge[source = "' + root.id() + '"]').intersection(callingEles);
      var k_in = incoming.length;
      var k_out = outgoing.length;
      var s_in = 0;
      var s_out = 0;

      // Now, sum incoming edge weights
      for (var i = 0; i < incoming.length; i++) {
        var edge = incoming[i];
        s_in += weightFn(edge);
      }

      // Now, sum outgoing edge weights
      for (var i = 0; i < outgoing.length; i++) {
        var edge = outgoing[i];
        s_out += weightFn(edge);
      }

      return {
        indegree: Math.pow(k_in, 1 - alpha) * Math.pow(s_in, alpha),
        outdegree: Math.pow(k_out, 1 - alpha) * Math.pow(s_out, alpha)
      };
    }
  } // degreeCentrality

}; // elesfn

// nice, short mathemathical alias
elesfn.dc = elesfn.degreeCentrality;
elesfn.dcn = elesfn.degreeCentralityNormalised = elesfn.degreeCentralityNormalized;

module.exports = elesfn;

/***/ }),
/* 40 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);

var elesfn = {

  closenessCentralityNormalized: function closenessCentralityNormalized(options) {
    options = options || {};

    var cy = this.cy();

    var harmonic = options.harmonic;
    if (harmonic === undefined) {
      harmonic = true;
    }

    var closenesses = {};
    var maxCloseness = 0;
    var nodes = this.nodes();
    var fw = this.floydWarshall({ weight: options.weight, directed: options.directed });

    // Compute closeness for every node and find the maximum closeness
    for (var i = 0; i < nodes.length; i++) {
      var currCloseness = 0;
      for (var j = 0; j < nodes.length; j++) {
        if (i != j) {
          var d = fw.distance(nodes[i], nodes[j]);

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

      closenesses[nodes[i].id()] = currCloseness;
    }

    return {
      closeness: function closeness(node) {
        if (maxCloseness == 0) {
          return 0;
        }

        if (is.string(node)) {
          // from is a selector string
          var node = cy.filter(node)[0].id();
        } else {
          // from is a node
          var node = node.id();
        }

        return closenesses[node] / maxCloseness;
      }
    };
  },

  // Implemented from pseudocode from wikipedia
  closenessCentrality: function closenessCentrality(options) {
    options = options || {};

    // root - mandatory!
    if (options.root != null) {
      if (is.string(options.root)) {
        // use it as a selector, e.g. "#rootID
        var root = this.filter(options.root)[0];
      } else {
        var root = options.root[0];
      }
    } else {
      return undefined;
    }

    // weight - optional
    if (options.weight != null && is.fn(options.weight)) {
      var weight = options.weight;
    } else {
      var weight = function weight() {
        return 1;
      };
    }

    // directed - optional
    if (options.directed != null && is.bool(options.directed)) {
      var directed = options.directed;
    } else {
      var directed = false;
    }

    var harmonic = options.harmonic;
    if (harmonic === undefined) {
      harmonic = true;
    }

    // we need distance from this node to every other node
    var dijkstra = this.dijkstra({
      root: root,
      weight: weight,
      directed: directed
    });
    var totalDistance = 0;

    var nodes = this.nodes();
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].id() != root.id()) {
        var d = dijkstra.distanceTo(nodes[i]);

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
elesfn.cc = elesfn.closenessCentrality;
elesfn.ccn = elesfn.closenessCentralityNormalised = elesfn.closenessCentralityNormalized;

module.exports = elesfn;

/***/ }),
/* 41 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);
var Heap = __webpack_require__(9);

var elesfn = {

  // Implemented from the algorithm in the paper "On Variants of Shortest-Path Betweenness Centrality and their Generic Computation" by Ulrik Brandes
  betweennessCentrality: function betweennessCentrality(options) {
    options = options || {};

    // Weight - optional
    var weighted, weightFn;
    if (is.fn(options.weight)) {
      weightFn = options.weight;
      weighted = true;
    } else {
      weighted = false;
    }

    // Directed - default false
    var directed = options.directed != null ? options.directed : false;

    var cy = this._private.cy;

    // starting
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
    };

    // A contains the neighborhoods of every node
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

    for (var s = 0; s < V.length; s++) {
      var sid = V[s].id();
      var S = []; // stack
      var P = {};
      var g = {};
      var d = {};
      var Q = new Heap(function (a, b) {
        return d[a] - d[b];
      }); // queue

      // init dictionaries
      for (var i = 0; i < V.length; i++) {
        var vid = V[i].id();

        P[vid] = [];
        g[vid] = 0;
        d[vid] = Infinity;
      }

      g[sid] = 1; // sigma
      d[sid] = 0; // distance to s

      Q.push(sid);

      while (!Q.empty()) {
        var v = Q.pop();

        S.push(v);

        if (weighted) {
          for (var j = 0; j < A[v].length; j++) {
            var w = A[v][j];
            var vEle = cy.getElementById(v);

            var edge;
            if (vEle.edgesTo(w).length > 0) {
              edge = vEle.edgesTo(w)[0];
            } else {
              edge = w.edgesTo(vEle)[0];
            }

            var edgeWeight = weightFn(edge);

            w = w.id();

            if (d[w] > d[v] + edgeWeight) {
              d[w] = d[v] + edgeWeight;

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

            if (d[w] == d[v] + edgeWeight) {
              g[w] = g[w] + g[v];
              P[w].push(v);
            }
          }
        } else {
          for (var j = 0; j < A[v].length; j++) {
            var w = A[v][j].id();

            if (d[w] == Infinity) {
              Q.push(w);

              d[w] = d[v] + 1;
            }

            if (d[w] == d[v] + 1) {
              g[w] = g[w] + g[v];
              P[w].push(v);
            }
          }
        }
      }

      var e = {};
      for (var i = 0; i < V.length; i++) {
        e[V[i].id()] = 0;
      }

      while (S.length > 0) {
        var w = S.pop();

        for (var j = 0; j < P[w].length; j++) {
          var v = P[w][j];

          e[v] = e[v] + g[v] / g[w] * (1 + e[w]);

          if (w != V[s].id()) {
            C.set(w, C.get(w) + e[w]);
          }
        }
      }
    }

    var ret = {
      betweenness: function betweenness(node) {
        if (is.string(node)) {
          var node = cy.filter(node).id();
        } else {
          var node = node.id();
        }

        return C.get(node);
      },

      betweennessNormalized: function betweennessNormalized(node) {
        if (max == 0) return 0;

        if (is.string(node)) {
          var node = cy.filter(node).id();
        } else {
          var node = node.id();
        }

        return C.get(node) / max;
      }
    };

    // alias
    ret.betweennessNormalised = ret.betweennessNormalized;

    return ret;
  } // betweennessCentrality

}; // elesfn

// nice, short mathemathical alias
elesfn.bc = elesfn.betweennessCentrality;

module.exports = elesfn;

/***/ }),
/* 42 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var define = __webpack_require__(4);

var elesfn = {
  animate: define.animate(),
  animation: define.animation(),
  animated: define.animated(),
  clearQueue: define.clearQueue(),
  delay: define.delay(),
  delayAnimation: define.delayAnimation(),
  stop: define.stop()
};

module.exports = elesfn;

/***/ }),
/* 43 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);
var Animation = __webpack_require__(44);
var math = __webpack_require__(2);
var is = __webpack_require__(0);

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
  }, // animated

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
  }, // clearQueue

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
  }, // delay

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
  }, // delay

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

      properties = util.assign({}, properties, params);

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

        properties.position = math.renderedToModelPosition(rpos, zoom, pan);
      }

      // override pan w/ panBy if set
      if (isCore && properties.panBy != null) {
        var panBy = properties.panBy;
        var cyPan = cy.pan();

        properties.pan = {
          x: cyPan.x + panBy.x,
          y: cyPan.y + panBy.y
        };
      }

      // override pan w/ center if set
      var center = properties.center || properties.centre;
      if (isCore && center != null) {
        var centerPan = cy.getCenterPan(center.eles, properties.zoom);

        if (centerPan != null) {
          properties.pan = centerPan;
        }
      }

      // override pan & zoom w/ fit if set
      if (isCore && properties.fit != null) {
        var fit = properties.fit;
        var fitVp = cy.getFitViewport(fit.eles || fit.boundingBox, fit.padding);

        if (fitVp != null) {
          properties.pan = fitVp.pan;
          properties.zoom = fitVp.zoom;
        }
      }

      // override zoom (& potentially pan) w/ zoom obj if set
      if (isCore && is.plainObject(properties.zoom)) {
        var vp = cy.getZoomedViewport(properties.zoom);

        if (vp != null) {
          if (vp.zoomed) {
            properties.zoom = vp.zoom;
          }

          if (vp.panned) {
            properties.pan = vp.pan;
          }
        }
      }

      return new Animation(all[0], properties);
    };
  }, // animate

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
        properties = util.extend({}, properties, params);
      }

      // manually hook and run the animation
      for (var i = 0; i < all.length; i++) {
        var ele = all[i];
        var queue = ele.animated() && (properties.queue === undefined || properties.queue);

        var ani = ele.animation(properties, queue ? { queue: true } : undefined);

        ani.play();
      }

      return this; // chaining
    };
  }, // animate

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
        }

        // clear the queue of future animations
        if (clearQueue) {
          _p.animation.queue = [];
        }

        if (!jumpToEnd) {
          _p.animation.current = [];
        }
      }

      // we have to notify (the animation loop doesn't do it for us on `stop`)
      cy.notify({
        eles: this,
        type: 'draw'
      });

      return this;
    };
  } // stop

}; // define

module.exports = define;

/***/ }),
/* 44 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);
var is = __webpack_require__(0);
var Promise = __webpack_require__(5);

var Animation = function Animation(target, opts, opts2) {
  var _p = this._private = util.extend({
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

  if (_p.complete && is.fn(_p.complete)) {
    _p.completes.push(_p.complete);
  }

  // for future timeline/animations impl
  this.length = 1;
  this[0] = this;
};

var anifn = Animation.prototype;

util.extend(anifn, {

  instanceString: function instanceString() {
    return 'animation';
  },

  hook: function hook() {
    var _p = this._private;

    if (!_p.hooked) {
      // add to target's animation queue
      var q = void 0;
      var tAni = _p.target._private.animation;
      if (_p.queue) {
        q = tAni.queue;
      } else {
        q = tAni.current;
      }
      q.push(this);

      // add to the animation loop pool
      if (is.elementOrCollection(_p.target)) {
        _p.target.cy().addToAnimationPool(_p.target);
      }

      _p.hooked = true;
    }

    return this;
  },

  play: function play() {
    var _p = this._private;

    // autorewind
    if (_p.progress === 1) {
      _p.progress = 0;
    }

    _p.playing = true;
    _p.started = false; // needs to be started by animation loop
    _p.stopped = false;

    this.hook();

    // the animation loop will start the animation...

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

    this.hook();

    // the animation loop will apply the animation at this progress

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
    swap('position', 'startPosition');

    // swap styles
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

    var arr = void 0;

    switch (type) {
      case 'frame':
        arr = _p.frames;
        break;
      default:
      case 'complete':
      case 'completed':
        arr = _p.completes;
    }

    return new Promise(function (resolve, reject) {
      arr.push(function () {
        resolve();
      });
    });
  }

});

anifn.complete = anifn.completed;

module.exports = Animation;

/***/ }),
/* 45 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var util = __webpack_require__(1);
var is = __webpack_require__(0);

var define = {

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
      immutableKeys: {}, // key => true if immutable
      updateStyle: false,
      beforeGet: function beforeGet(self) {},
      beforeSet: function beforeSet(self, obj) {},
      onSet: function onSet(self) {},
      canSet: function canSet(self) {
        return true;
      }
    };
    params = util.extend({}, defaults, params);

    return function dataImpl(name, value) {
      var p = params;
      var self = this;
      var selfIsArrayLike = self.length !== undefined;
      var all = selfIsArrayLike ? self : [self]; // put in array if not array-like
      var single = selfIsArrayLike ? self[0] : self;

      // .data('foo', ...)
      if (is.string(name)) {
        // set or get property

        // .data('foo')
        if (p.allowGetting && value === undefined) {
          // get

          var ret = void 0;
          if (single) {
            p.beforeGet(single);

            ret = single._private[p.field][name];
          }
          return ret;

          // .data('foo', 'bar')
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
            }

            // update mappers if asked
            if (p.updateStyle) {
              self.updateStyle();
            }

            // call onSet callback
            p.onSet(self);

            if (p.settingTriggersEvent) {
              self[p.triggerFnName](p.settingEvent);
            }
          }
        }

        // .data({ 'foo': 'bar' })
      } else if (p.allowSetting && is.plainObject(name)) {
        // extend
        var obj = name;
        var k = void 0,
            v = void 0;
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
        }

        // update mappers if asked
        if (p.updateStyle) {
          self.updateStyle();
        }

        // call onSet callback
        p.onSet(self);

        if (p.settingTriggersEvent) {
          self[p.triggerFnName](p.settingEvent);
        }

        // .data(function(){ ... })
      } else if (p.allowBinding && is.fn(name)) {
        // bind to event
        var fn = name;
        self.on(p.bindingEvent, fn);

        // .data()
      } else if (p.allowGetting && name === undefined) {
        // get whole object
        var _ret = void 0;
        if (single) {
          p.beforeGet(single);

          _ret = single._private[p.field];
        }
        return _ret;
      }

      return self; // maintain chainability
    }; // function
  }, // data

  // remove data field
  removeData: function removeData(params) {
    var defaults = {
      field: 'data',
      event: 'data',
      triggerFnName: 'trigger',
      triggerEvent: false,
      immutableKeys: {} // key => true if immutable
    };
    params = util.extend({}, defaults, params);

    return function removeDataImpl(names) {
      var p = params;
      var self = this;
      var selfIsArrayLike = self.length !== undefined;
      var all = selfIsArrayLike ? self : [self]; // put in array if not array-like

      // .removeData('foo bar')
      if (is.string(names)) {
        // then get the list of keys, and delete them
        var keys = names.split(/\s+/);
        var l = keys.length;

        for (var i = 0; i < l; i++) {
          // delete each non-empty key
          var key = keys[i];
          if (is.emptyString(key)) {
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
        }

        // .removeData()
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

module.exports = define;

/***/ }),
/* 46 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var Promise = __webpack_require__(5);

var define = {

  eventAliasesOn: function eventAliasesOn(proto) {
    var p = proto;

    p.addListener = p.listen = p.bind = p.on;
    p.unlisten = p.unbind = p.off = p.removeListener;
    p.trigger = p.emit;

    // this is just a wrapper alias of .on()
    p.pon = p.promiseOn = function (events, selector) {
      var self = this;
      var args = Array.prototype.slice.call(arguments, 0);

      return new Promise(function (resolve, reject) {
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

module.exports = define;

/***/ }),
/* 47 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var Set = __webpack_require__(8);

var elesfn = {
  classes: function classes(_classes) {
    _classes = (_classes || '').match(/\S+/g) || [];
    var self = this;
    var changed = [];
    var classesMap = new Set(_classes);

    // check and update each ele

    var _loop = function _loop(j) {
      var ele = self[j];
      var _p = ele._private;
      var eleClasses = _p.classes;
      var changedEle = false;

      // check if ele has all of the passed classes
      classesMap.forEach(function (cls) {
        var eleHasClass = eleClasses.has(cls);

        if (!eleHasClass) {
          changedEle = true;
        }
      });

      // check if ele has classes outside of those passed
      if (!changedEle) {
        eleClasses.forEach(function (eleCls) {
          var specdClass = classesMap.has(eleCls);

          if (!specdClass) {
            changedEle = true;
          }
        });
      }

      if (changedEle) {
        _p.classes = new Set(classesMap);

        changed.push(ele);
      }
    };

    for (var j = 0; j < self.length; j++) {
      _loop(j);
    }

    // trigger update style on those eles that had class changes
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

  toggleClass: function toggleClass(classesStr, toggle) {
    var classes = classesStr.match(/\S+/g) || [];
    var self = this;
    var changed = []; // eles who had classes changed

    for (var i = 0, il = self.length; i < il; i++) {
      var _ele = self[i];
      var _changedEle = false;

      for (var j = 0; j < classes.length; j++) {
        var cls = classes[j];
        var _eleClasses = _ele._private.classes;
        var hasClass = _eleClasses.has(cls);
        var shouldAdd = toggle || toggle === undefined && !hasClass;

        if (shouldAdd) {
          _eleClasses.add(cls);

          if (!hasClass && !_changedEle) {
            changed.push(_ele);
            _changedEle = true;
          }
        } else {
          // then remove
          _eleClasses.delete(cls);

          if (hasClass && !_changedEle) {
            changed.push(_ele);
            _changedEle = true;
          }
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

module.exports = elesfn;

/***/ }),
/* 48 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);
var Selector = __webpack_require__(6);

var elesfn = {
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
    collection = this.cy().collection(collection);

    // cheap extra check
    if (this.length !== collection.length) {
      return false;
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

elesfn.allAreNeighbours = elesfn.allAreNeighbors;
elesfn.has = elesfn.contains;

module.exports = elesfn;

/***/ }),
/* 49 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);
var exprs = __webpack_require__(50);
var newQuery = __webpack_require__(10);

// of all the expressions, find the first match in the remaining text
var consumeExpr = function consumeExpr(remaining) {
  var expr = void 0;
  var match = void 0;
  var name = void 0;

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

// consume all leading whitespace
var consumeWhitespace = function consumeWhitespace(remaining) {
  var match = remaining.match(/^\s+/);

  if (match) {
    var consumed = match[0];
    remaining = remaining.substring(consumed.length);
  }

  return remaining;
};

var parse = function parse(selector) {
  var self = this;

  var remaining = self._private.selectorText = selector;

  var currentQuery = self[0] = newQuery();
  self.length = 1;

  remaining = consumeWhitespace(remaining); // get rid of leading whitespace

  for (;;) {
    var check = consumeExpr(remaining);

    if (check.expr == null) {
      util.error('The selector `' + selector + '`is invalid');
      return false;
    } else {
      var args = check.match.slice(1);

      // let the token populate the selector object in currentQuery
      var ret = check.expr.populate(self, currentQuery, args);

      if (ret === false) {
        return false; // exit if population failed
      } else if (ret != null) {
        currentQuery = ret; // change the current query to be filled if the expr specifies
      }
    }

    remaining = check.remaining;

    // we're done when there's nothing left to parse
    if (remaining.match(/^\s*$/)) {
      break;
    }
  }

  // adjust references for subject
  for (var j = 0; j < self.length; j++) {
    var query = self[j];

    if (query.subject != null) {
      // go up the tree until we reach the subject
      for (;;) {
        if (query.subject === query) {
          break;
        } // done if subject is self

        if (query.parent != null) {
          // swap parent/child reference
          var parent = query.parent;
          var child = query;

          child.parent = null;
          parent.child = child;

          query = parent; // go up the tree
        } else if (query.ancestor != null) {
          // swap ancestor/descendant
          var ancestor = query.ancestor;
          var descendant = query;

          descendant.ancestor = null;
          ancestor.descendant = descendant;

          query = ancestor; // go up the tree
        } else if (query.source || query.target || query.connectedNodes) {
          util.error('The selector `' + self.text() + '` can not contain a subject selector that applies to the source or target of an edge selector');
          return false;
        } else {
          util.error('When adjusting references for the selector `' + self.text() + '`, neither parent nor ancestor was found');
          return false;
        }
      } // for

      self[j] = query.subject; // subject should be the root query
    } // if
  } // for

  return true; // success
};

module.exports = { parse: parse };

/***/ }),
/* 50 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _require = __webpack_require__(15),
    stateSelectorRegex = _require.stateSelectorRegex;

var tokens = __webpack_require__(51);
var util = __webpack_require__(1);
var newQuery = __webpack_require__(10);

// when a token like a variable has escaped meta characters, we need to clean the backslashes out
// so that values get compared properly in Selector.filter()
var cleanMetaChars = function cleanMetaChars(str) {
  return str.replace(new RegExp('\\\\(' + tokens.metaChar + ')', 'g'), function (match, $1) {
    return $1;
  });
};

var replaceLastQuery = function replaceLastQuery(selector, examiningQuery, replacementQuery) {
  if (examiningQuery === selector[selector.length - 1]) {
    selector[selector.length - 1] = replacementQuery;
  }
};

// NOTE: add new expression syntax here to have it recognised by the parser;
// - a query contains all adjacent (i.e. no separator in between) expressions;
// - the current query is stored in selector[i] --- you can use the reference to `this` in the populate function;
// - you need to check the query objects in Selector.filter() for it actually filter properly, but that's pretty straight forward
// - when you add something here, also add to Selector.toString()
var exprs = [{
  name: 'group',
  query: true,
  regex: '(' + tokens.group + ')',
  populate: function populate(selector, query, _ref) {
    var _ref2 = _slicedToArray(_ref, 1),
        group = _ref2[0];

    query.group = group === '*' ? group : group + 's';
  }
}, {
  name: 'state',
  query: true,
  regex: stateSelectorRegex,
  populate: function populate(selector, query, _ref3) {
    var _ref4 = _slicedToArray(_ref3, 1),
        state = _ref4[0];

    query.colonSelectors.push(state);
  }
}, {
  name: 'id',
  query: true,
  regex: '\\#(' + tokens.id + ')',
  populate: function populate(selector, query, _ref5) {
    var _ref6 = _slicedToArray(_ref5, 1),
        id = _ref6[0];

    query.ids.push(cleanMetaChars(id));
  }
}, {
  name: 'className',
  query: true,
  regex: '\\.(' + tokens.className + ')',
  populate: function populate(selector, query, _ref7) {
    var _ref8 = _slicedToArray(_ref7, 1),
        className = _ref8[0];

    query.classes.push(cleanMetaChars(className));
  }
}, {
  name: 'dataExists',
  query: true,
  regex: '\\[\\s*(' + tokens.variable + ')\\s*\\]',
  populate: function populate(selector, query, _ref9) {
    var _ref10 = _slicedToArray(_ref9, 1),
        variable = _ref10[0];

    query.data.push({
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

    query.data.push({
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

    query.data.push({
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

    query.meta.push({
      field: cleanMetaChars(meta),
      operator: comparatorOp,
      value: parseFloat(number)
    });
  }
}, {
  name: 'nextQuery',
  separator: true,
  regex: tokens.separator,
  populate: function populate(selector) {
    // go on to next query
    var nextQuery = selector[selector.length++] = newQuery();
    selector.currentSubject = null;

    return nextQuery;
  }
}, {
  name: 'directedEdge',
  separator: true,
  regex: tokens.directedEdge,
  populate: function populate(selector, query) {
    var edgeQuery = newQuery();
    var source = query;
    var target = newQuery();

    edgeQuery.group = 'edges';
    edgeQuery.target = target;
    edgeQuery.source = source;
    edgeQuery.subject = selector.currentSubject;

    // the query in the selector should be the edge rather than the source
    replaceLastQuery(selector, query, edgeQuery);

    // we're now populating the target query with expressions that follow
    return target;
  }
}, {
  name: 'undirectedEdge',
  separator: true,
  regex: tokens.undirectedEdge,
  populate: function populate(selector, query) {
    var edgeQuery = newQuery();
    var source = query;
    var target = newQuery();

    edgeQuery.group = 'edges';
    edgeQuery.connectedNodes = [source, target];
    edgeQuery.subject = selector.currentSubject;

    // the query in the selector should be the edge rather than the source
    replaceLastQuery(selector, query, edgeQuery);

    // we're now populating the target query with expressions that follow
    return target;
  }
}, {
  name: 'child',
  separator: true,
  regex: tokens.child,
  populate: function populate(selector, query) {
    // this query is the parent of the following query
    var childQuery = newQuery();
    childQuery.parent = query;
    childQuery.subject = selector.currentSubject;

    // it's cheaper to compare children first and go up so replace the parent
    replaceLastQuery(selector, query, childQuery);

    // we're now populating the child query with expressions that follow
    return childQuery;
  }
}, {
  name: 'descendant',
  separator: true,
  regex: tokens.descendant,
  populate: function populate(selector, query) {
    // this query is the ancestor of the following query
    var descendantQuery = newQuery();
    descendantQuery.ancestor = query;
    descendantQuery.subject = selector.currentSubject;

    // it's cheaper to compare descendants first and go up so replace the ancestor
    replaceLastQuery(selector, query, descendantQuery);

    // we're now populating the descendant query with expressions that follow
    return descendantQuery;
  }
}, {
  name: 'subject',
  modifier: true,
  regex: tokens.subject,
  populate: function populate(selector, query) {
    if (selector.currentSubject != null && query.subject != query) {
      util.error('Redefinition of subject in selector `' + selector.toString() + '`');
      return false;
    }

    selector.currentSubject = query;
    query.subject = query;
    selector[selector.length - 1].subject = query;
  }
}];

exprs.forEach(function (e) {
  return e.regexObj = new RegExp('^' + e.regex);
});

module.exports = exprs;

/***/ }),
/* 51 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);

// tokens in the query language
var tokens = {
  metaChar: '[\\!\\"\\#\\$\\%\\&\\\'\\(\\)\\*\\+\\,\\.\\/\\:\\;\\<\\=\\>\\?\\@\\[\\]\\^\\`\\{\\|\\}\\~]', // chars we need to escape in let names, etc
  comparatorOp: '=|\\!=|>|>=|<|<=|\\$=|\\^=|\\*=', // binary comparison op (used in data selectors)
  boolOp: '\\?|\\!|\\^', // boolean (unary) operators (used in data selectors)
  string: '"(?:\\\\"|[^"])*"' + '|' + "'(?:\\\\'|[^'])*'", // string literals (used in data selectors) -- doublequotes | singlequotes
  number: util.regex.number, // number literal (used in data selectors) --- e.g. 0.1234, 1234, 12e123
  meta: 'degree|indegree|outdegree', // allowed metadata fields (i.e. allowed functions to use from Collection)
  separator: '\\s*,\\s*', // queries are separated by commas, e.g. edge[foo = 'bar'], node.someClass
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
  var ops = void 0,
      op = void 0,
      i = void 0;

  // add @ variants to comparatorOp
  ops = tokens.comparatorOp.split('|');
  for (i = 0; i < ops.length; i++) {
    op = ops[i];
    tokens.comparatorOp += '|@' + op;
  }

  // add ! variants to comparatorOp
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

module.exports = tokens;

/***/ }),
/* 52 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _require = __webpack_require__(15),
    stateSelectorMatches = _require.stateSelectorMatches;

var is = __webpack_require__(0);

// generic checking for data/metadata
var operandsMatch = function operandsMatch(query, params) {
  var allDataMatches = true;
  for (var k = 0; k < query[params.name].length; k++) {
    var data = query[params.name][k];
    var operator = data.operator;
    var value = data.value;
    var field = data.field;
    var _matches = void 0;
    var fieldVal = params.fieldValue(field);

    if (operator != null && value != null) {
      var fieldStr = !is.string(fieldVal) && !is.number(fieldVal) ? '' : '' + fieldVal;
      var valStr = '' + value;

      var caseInsensitive = false;
      if (operator.indexOf('@') >= 0) {
        fieldStr = fieldStr.toLowerCase();
        valStr = valStr.toLowerCase();

        operator = operator.replace('@', '');
        caseInsensitive = true;
      }

      var notExpr = false;
      if (operator.indexOf('!') >= 0) {
        operator = operator.replace('!', '');
        notExpr = true;
      }

      // if we're doing a case insensitive comparison, then we're using a STRING comparison
      // even if we're comparing numbers
      if (caseInsensitive) {
        value = valStr.toLowerCase();
        fieldVal = fieldStr.toLowerCase();
      }

      var isIneqCmp = false;

      switch (operator) {
        case '*=':
          _matches = fieldStr.indexOf(valStr) >= 0;
          break;
        case '$=':
          _matches = fieldStr.indexOf(valStr, fieldStr.length - valStr.length) >= 0;
          break;
        case '^=':
          _matches = fieldStr.indexOf(valStr) === 0;
          break;
        case '=':
          _matches = fieldVal === value;
          break;
        case '>':
          isIneqCmp = true;
          _matches = fieldVal > value;
          break;
        case '>=':
          isIneqCmp = true;
          _matches = fieldVal >= value;
          break;
        case '<':
          isIneqCmp = true;
          _matches = fieldVal < value;
          break;
        case '<=':
          isIneqCmp = true;
          _matches = fieldVal <= value;
          break;
        default:
          _matches = false;
          break;
      }

      // apply the not op, but null vals for inequalities should always stay non-matching
      if (notExpr && (fieldVal != null || !isIneqCmp)) {
        _matches = !_matches;
      }
    } else if (operator != null) {
      switch (operator) {
        case '?':
          _matches = fieldVal ? true : false;
          break;
        case '!':
          _matches = fieldVal ? false : true;
          break;
        case '^':
          _matches = fieldVal === undefined;
          break;
      }
    } else {
      _matches = fieldVal !== undefined;
    }

    if (!_matches) {
      allDataMatches = false;
      break;
    }
  } // for

  return allDataMatches;
}; // operandsMatch

// check parent/child relations
var confirmRelations = function confirmRelations(query, isNecessary, eles) {
  if (query != null) {
    var _matches2 = false;

    if (!isNecessary) {
      return false;
    }

    eles = eles(); // save cycles if query == null

    // query must match for at least one element (may be recursive)
    for (var i = 0; i < eles.length; i++) {
      if (queryMatches(query, eles[i])) {
        _matches2 = true;
        break;
      }
    }

    return _matches2;
  } else {
    return true;
  }
};

var queryMatches = function queryMatches(query, ele) {
  // make single group-only selectors really cheap to check since they're the most common ones
  if (query.groupOnly) {
    return query.group === '*' || query.group === ele.group();
  }

  // check group
  if (query.group != null && query.group != '*' && query.group != ele.group()) {
    return false;
  }

  var cy = ele.cy();
  var k = void 0;

  // check colon selectors
  var allColonSelectorsMatch = true;
  for (k = 0; k < query.colonSelectors.length; k++) {
    var sel = query.colonSelectors[k];

    allColonSelectorsMatch = stateSelectorMatches(sel, ele);

    if (!allColonSelectorsMatch) break;
  }
  if (!allColonSelectorsMatch) return false;

  // check id
  var allIdsMatch = true;
  for (k = 0; k < query.ids.length; k++) {
    var id = query.ids[k];
    var actualId = ele.id();

    allIdsMatch = allIdsMatch && id == actualId;

    if (!allIdsMatch) break;
  }
  if (!allIdsMatch) return false;

  // check classes
  var allClassesMatch = true;
  for (k = 0; k < query.classes.length; k++) {
    var cls = query.classes[k];

    allClassesMatch = allClassesMatch && ele.hasClass(cls);

    if (!allClassesMatch) break;
  }
  if (!allClassesMatch) return false;

  // check data matches
  var allDataMatches = operandsMatch(query, {
    name: 'data',
    fieldValue: function fieldValue(field) {
      return ele.data(field);
    }
  });

  if (!allDataMatches) {
    return false;
  }

  // check metadata matches
  var allMetaMatches = operandsMatch(query, {
    name: 'meta',
    fieldValue: function fieldValue(field) {
      return ele[field]();
    }
  });

  if (!allMetaMatches) {
    return false;
  }

  // check collection
  if (query.collection != null) {
    var matchesAny = query.collection.hasElementWithId(ele.id());

    if (!matchesAny) {
      return false;
    }
  }

  // check filter function
  if (query.filter != null && ele.collection().some(query.filter)) {
    return false;
  }

  var isCompound = cy.hasCompoundNodes();
  var getSource = function getSource() {
    return ele.source();
  };
  var getTarget = function getTarget() {
    return ele.target();
  };

  if (!confirmRelations(query.parent, isCompound, function () {
    return ele.parent();
  })) {
    return false;
  }

  if (!confirmRelations(query.ancestor, isCompound, function () {
    return ele.parents();
  })) {
    return false;
  }

  if (!confirmRelations(query.child, isCompound, function () {
    return ele.children();
  })) {
    return false;
  }

  if (!confirmRelations(query.descendant, isCompound, function () {
    return ele.descendants();
  })) {
    return false;
  }

  if (!confirmRelations(query.source, true, getSource)) {
    return false;
  }

  if (!confirmRelations(query.target, true, getTarget)) {
    return false;
  }

  if (query.connectedNodes) {
    var q0 = query.connectedNodes[0];
    var q1 = query.connectedNodes[1];

    if (confirmRelations(q0, true, getSource) && confirmRelations(q1, true, getTarget)) {
      // match
    } else if (confirmRelations(q0, true, getTarget) && confirmRelations(q1, true, getSource)) {
      // match
    } else {
      return false;
    }
  }

  // we've reached the end, so we've matched everything for this query
  return true;
}; // queryMatches

// filter an existing collection
var filter = function filter(collection) {
  var self = this;
  var cy = collection.cy();

  // don't bother trying if it's invalid
  if (self.invalid()) {
    return cy.collection();
  }

  // for 1 id #foo queries, just get the element
  if (self.length === 1 && self[0].length === 1 && self[0].ids.length === 1) {
    return collection.getElementById(self[0].ids[0]).collection();
  }

  var selectorFunction = function selectorFunction(element) {
    for (var j = 0; j < self.length; j++) {
      var query = self[j];

      if (queryMatches(query, element)) {
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

  var filteredCollection = collection.filter(selectorFunction);

  return filteredCollection;
}; // filter

// does selector match a single element?
var matches = function matches(ele) {
  var self = this;

  // don't bother trying if it's invalid
  if (self.invalid()) {
    return false;
  }

  for (var j = 0; j < self.length; j++) {
    var query = self[j];

    if (queryMatches(query, ele)) {
      return true;
    }
  }

  return false;
}; // filter

module.exports = { matches: matches, filter: filter };

/***/ }),
/* 53 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var Set = __webpack_require__(8);

var elesfn = {
  parent: function parent(selector) {
    var parents = [];

    // optimisation for single ele call
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

    return this.spawn(parents, { unique: true }).filter(selector);
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

    return this.spawn(parents, { unique: true }).filter(selector);
  },

  commonAncestors: function commonAncestors(selector) {
    var ancestors = void 0;

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

  children: function children(selector) {
    var children = [];

    for (var i = 0; i < this.length; i++) {
      var ele = this[i];
      children = children.concat(ele._private.children);
    }

    return this.spawn(children, { unique: true }).filter(selector);
  },

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

    return this.spawn(elements, { unique: true }).filter(selector);
  }
};

function forEachCompound(eles, fn, includeSelf, recursiveStep) {
  var q = [];
  var did = new Set();
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
}

// very efficient version of eles.add( eles.descendants() ).forEach()
// for internal use
elesfn.forEachDown = function (fn) {
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

elesfn.forEachUp = function (fn) {
  var includeSelf = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

  return forEachCompound(this, fn, includeSelf, addParent);
};

function addParentAndChildren(q, did, ele) {
  addParent(q, did, ele);
  addChildren(q, did, ele);
}

elesfn.forEachUpAndDown = function (fn) {
  var includeSelf = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

  return forEachCompound(this, fn, includeSelf, addParentAndChildren);
};

// aliases
elesfn.ancestors = elesfn.parents;

module.exports = elesfn;

/***/ }),
/* 54 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var define = __webpack_require__(4);
var fn = void 0,
    elesfn = void 0;

fn = elesfn = {

  data: define.data({
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

  removeData: define.removeData({
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

  scratch: define.data({
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

  removeScratch: define.removeData({
    field: 'scratch',
    event: 'scratch',
    triggerFnName: 'trigger',
    triggerEvent: true,
    updateStyle: true
  }),

  rscratch: define.data({
    field: 'rscratch',
    allowBinding: false,
    allowSetting: true,
    settingTriggersEvent: false,
    allowGetting: true
  }),

  removeRscratch: define.removeData({
    field: 'rscratch',
    triggerEvent: false
  }),

  id: function id() {
    var ele = this[0];

    if (ele) {
      return ele._private.data.id;
    }
  }

};

// aliases
fn.attr = fn.data;
fn.removeAttr = fn.removeData;

module.exports = elesfn;

/***/ }),
/* 55 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);

var elesfn = {};

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

util.extend(elesfn, {
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
    var ret = void 0;
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

util.extend(elesfn, {
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

util.extend(elesfn, {
  totalDegree: function totalDegree(includeLoops) {
    var total = 0;
    var nodes = this.nodes();

    for (var i = 0; i < nodes.length; i++) {
      total += nodes[i].degree(includeLoops);
    }

    return total;
  }
});

module.exports = elesfn;

/***/ }),
/* 56 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);
var position = __webpack_require__(57);
var bounds = __webpack_require__(58);
var widthHeight = __webpack_require__(59);
var edgePoints = __webpack_require__(60);

module.exports = util.assign({}, position, bounds, widthHeight, edgePoints);

/***/ }),
/* 57 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var define = __webpack_require__(4);
var is = __webpack_require__(0);
var math = __webpack_require__(2);
var fn = void 0,
    elesfn = void 0;

var beforePositionSet = function beforePositionSet(eles, newPos) {
  for (var i = 0; i < eles.length; i++) {
    var ele = eles[i];

    if (ele.isParent() && !ele.locked()) {
      var oldPos = ele._private.position;
      var delta = {
        x: newPos.x - oldPos.x,
        y: newPos.y - oldPos.y
      };

      eles.children().shift(delta);
    }
  }
};

fn = elesfn = {

  position: define.data({
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
    beforeSet: beforePositionSet,
    onSet: function onSet(eles) {
      eles.dirtyCompoundBoundsCache();
    },
    canSet: function canSet(ele) {
      return !ele.locked();
    }
  }),

  // position but no notification to renderer
  silentPosition: define.data({
    field: 'position',
    bindingEvent: 'position',
    allowBinding: false,
    allowSetting: true,
    settingEvent: 'position',
    settingTriggersEvent: false,
    triggerFnName: 'trigger',
    allowGetting: false,
    validKeys: ['x', 'y'],
    beforeSet: beforePositionSet,
    onSet: function onSet(eles) {
      eles.dirtyCompoundBoundsCache();
    },
    canSet: function canSet(ele) {
      return !ele.locked();
    }
  }),

  positions: function positions(pos, silent) {
    if (is.plainObject(pos)) {
      if (silent) {
        this.silentPosition(pos);
      } else {
        this.position(pos);
      }
    } else if (is.fn(pos)) {
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

  shift: function shift(dim, val) {
    var delta = void 0;

    if (is.plainObject(dim)) {
      delta = dim;
    } else if (is.string(dim) && is.number(val)) {
      delta = { x: 0, y: 0 };

      delta[dim] = val;
    }

    if (delta != null) {
      for (var i = 0; i < this.length; i++) {
        var ele = this[i];
        var pos = ele.position();

        ele.position({
          x: pos.x + delta.x,
          y: pos.y + delta.y
        });
      }
    }

    return this;
  },

  // get/set the rendered (i.e. on screen) positon of the element
  renderedPosition: function renderedPosition(dim, val) {
    var ele = this[0];
    var cy = this.cy();
    var zoom = cy.zoom();
    var pan = cy.pan();
    var rpos = is.plainObject(dim) ? dim : undefined;
    var setting = rpos !== undefined || val !== undefined && is.string(dim);

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
            _ele.position(math.renderedToModelPosition(rpos, zoom, pan));
          }
        }
      } else {
        // getting
        var pos = ele.position();
        rpos = math.modelToRenderedPosition(pos, zoom, pan);

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
    var ppos = is.plainObject(dim) ? dim : undefined;
    var setting = ppos !== undefined || val !== undefined && is.string(dim);
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

          var origin = relativeToParent ? parent.position() : { x: 0, y: 0 };

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

        var _origin = _relativeToParent ? _parent.position() : { x: 0, y: 0 };

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
};

// aliases
fn.modelPosition = fn.point = fn.position;
fn.modelPositions = fn.points = fn.positions;
fn.renderedPoint = fn.renderedPosition;
fn.relativePoint = fn.relativePosition;

module.exports = elesfn;

/***/ }),
/* 58 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);
var util = __webpack_require__(1);
var math = __webpack_require__(2);
var fn = void 0,
    elesfn = void 0;

fn = elesfn = {};

elesfn.renderedBoundingBox = function (options) {
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

elesfn.dirtyCompoundBoundsCache = function () {
  var cy = this.cy();

  if (!cy.styleEnabled() || !cy.hasCompoundNodes()) {
    return this;
  }

  this.forEachUp(function (ele) {
    ele._private.compoundBoundsClean = false;

    if (ele.isParent()) {
      ele.emit('bounds');
    }
  });

  return this;
};

elesfn.updateCompoundBounds = function () {
  var cy = this.cy();

  // save cycles for non compound graphs or when style disabled
  if (!cy.styleEnabled() || !cy.hasCompoundNodes()) {
    return this;
  }

  // save cycles when batching -- but bounds will be stale (or not exist yet)
  if (cy.batching()) {
    return this;
  }

  var updated = [];

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
    var pos = _p.position;

    // if children take up zero area then keep position and fall back on stylesheet w/h
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

    updated.push(parent);
  }

  for (var i = 0; i < this.length; i++) {
    var ele = this[i];
    var _p = ele._private;

    if (!_p.compoundBoundsClean) {
      update(ele);

      if (!cy._private.batchingStyle) {
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
  }

  // don't update with null dim
  if (x1 == null || y1 == null || x2 == null || y2 == null) {
    return;
  }

  b.x1 = x1 < b.x1 ? x1 : b.x1;
  b.x2 = x2 > b.x2 ? x2 : b.x2;
  b.y1 = y1 < b.y1 ? y1 : b.y1;
  b.y2 = y2 > b.y2 ? y2 : b.y2;
};

var updateBoundsFromBox = function updateBoundsFromBox(b, b2) {
  return updateBounds(b, b2.x1, b2.y1, b2.x2, b2.y2);
};

var prefixedProperty = function prefixedProperty(obj, field, prefix) {
  return util.getPrefixedProperty(obj, field, prefix);
};

var updateBoundsFromArrow = function updateBoundsFromArrow(bounds, ele, prefix) {
  if (ele.cy().headless()) {
    return;
  }

  var _p = ele._private;
  var rstyle = _p.rstyle;
  var halfArW = rstyle.arrowWidth / 2;
  var arrowType = ele.pstyle(prefix + '-arrow-shape').value;
  var x = void 0;
  var y = void 0;

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
    }

    updateBounds(bounds, x - halfArW, y - halfArW, x + halfArW, y + halfArW);
  }
};

var updateBoundsFromLabel = function updateBoundsFromLabel(bounds, ele, prefix) {
  if (ele.cy().headless()) {
    return;
  }

  var prefixDash = void 0;

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

    var lh = labelHeight + 2 * padding;
    var lw = labelWidth + 2 * padding;
    var lw_2 = lw / 2;
    var lh_2 = lh / 2;
    var lx1 = void 0,
        lx2 = void 0,
        ly1 = void 0,
        ly2 = void 0;

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
    }

    var isAutorotate = isEdge && rotation.strValue === 'autorotate';
    var isPfValue = rotation.pfValue != null && rotation.pfValue !== 0;

    if (isAutorotate || isPfValue) {
      var theta = isAutorotate ? prefixedProperty(_p.rstyle, 'labelAngle', prefix) : rotation.pfValue;
      var cos = Math.cos(theta);
      var sin = Math.sin(theta);

      var rotate = function rotate(x, y) {
        x = x - labelX;
        y = y - labelY;

        return {
          x: x * cos - y * sin + labelX,
          y: x * sin + y * cos + labelY
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

    lx1 += marginX - Math.max(outlineWidth, halfBorderWidth);
    lx2 += marginX + Math.max(outlineWidth, halfBorderWidth);
    ly1 += marginY - Math.max(outlineWidth, halfBorderWidth);
    ly2 += marginY + Math.max(outlineWidth, halfBorderWidth);

    updateBounds(bounds, lx1, ly1, lx2, ly2);
  }

  return bounds;
};

// get the bounding box of the elements (in raw model position)
var boundingBoxImpl = function boundingBoxImpl(ele, options) {
  var cy = ele._private.cy;
  var styleEnabled = cy.styleEnabled();
  var headless = cy.headless();

  var bounds = {
    x1: Infinity,
    y1: Infinity,
    x2: -Infinity,
    y2: -Infinity
  };

  var _p = ele._private;
  var display = styleEnabled ? ele.pstyle('display').value : 'element';
  var isNode = ele.isNode();
  var isEdge = ele.isEdge();
  var ex1 = void 0,
      ex2 = void 0,
      ey1 = void 0,
      ey2 = void 0; // extrema of body / lines
  var x = void 0,
      y = void 0; // node pos
  var displayed = display !== 'none';

  if (displayed) {
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
      var halfH = h / 2;

      // handle node dimensions
      /////////////////////////

      ex1 = x - halfW - overlayPadding;
      ex2 = x + halfW + overlayPadding;
      ey1 = y - halfH - overlayPadding;
      ey2 = y + halfH + overlayPadding;

      updateBounds(bounds, ex1, ey1, ex2, ey2);
    } else if (isEdge && options.includeEdges) {
      var rstyle = _p.rstyle || {};

      // handle edge dimensions (rough box estimate)
      //////////////////////////////////////////////
      if (styleEnabled && !headless) {
        ex1 = Math.min(rstyle.srcX, rstyle.midX, rstyle.tgtX);
        ex2 = Math.max(rstyle.srcX, rstyle.midX, rstyle.tgtX);
        ey1 = Math.min(rstyle.srcY, rstyle.midY, rstyle.tgtY);
        ey2 = Math.max(rstyle.srcY, rstyle.midY, rstyle.tgtY);

        // take into account edge width
        ex1 -= wHalf;
        ex2 += wHalf;
        ey1 -= wHalf;
        ey2 += wHalf;

        updateBounds(bounds, ex1, ey1, ex2, ey2);
      }

      // precise haystacks
      ////////////////////
      if (styleEnabled && !headless && ele.pstyle('curve-style').strValue === 'haystack') {
        var hpts = rstyle.haystackPts || [];

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

        // handle points along edge
        ///////////////////////////
      } else {
        var pts = rstyle.bezierPts || rstyle.linePts || [];

        for (var j = 0; j < pts.length; j++) {
          var pt = pts[j];

          ex1 = pt.x - wHalf;
          ex2 = pt.x + wHalf;
          ey1 = pt.y - wHalf;
          ey2 = pt.y + wHalf;

          updateBounds(bounds, ex1, ey1, ex2, ey2);
        }

        // fallback on source and target positions
        //////////////////////////////////////////
        if (pts.length === 0) {
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
          }

          // take into account edge width
          ex1 -= wHalf;
          ex2 += wHalf;
          ey1 -= wHalf;
          ey2 += wHalf;

          updateBounds(bounds, ex1, ey1, ex2, ey2);
        }
      }
    } // edges


    // handle edge arrow size
    /////////////////////////

    if (styleEnabled && options.includeEdges && isEdge) {
      updateBoundsFromArrow(bounds, ele, 'mid-source', options);
      updateBoundsFromArrow(bounds, ele, 'mid-target', options);
      updateBoundsFromArrow(bounds, ele, 'source', options);
      updateBoundsFromArrow(bounds, ele, 'target', options);
    }

    // ghost
    ////////

    if (styleEnabled) {
      var ghost = ele.pstyle('ghost').value === 'yes';

      if (ghost) {
        var gx = ele.pstyle('ghost-offset-x').pfValue;
        var gy = ele.pstyle('ghost-offset-y').pfValue;

        updateBounds(bounds, bounds.x1 + gx, bounds.y1 + gy, bounds.x2 + gx, bounds.y2 + gy);
      }
    }

    // overlay
    //////////

    if (styleEnabled) {

      ex1 = bounds.x1;
      ex2 = bounds.x2;
      ey1 = bounds.y1;
      ey2 = bounds.y2;

      updateBounds(bounds, ex1 - overlayPadding, ey1 - overlayPadding, ex2 + overlayPadding, ey2 + overlayPadding);
    }

    // handle label dimensions
    //////////////////////////

    if (styleEnabled && options.includeLabels) {
      updateBoundsFromLabel(bounds, ele, null, options);

      if (isEdge) {
        updateBoundsFromLabel(bounds, ele, 'source', options);
        updateBoundsFromLabel(bounds, ele, 'target', options);
      }
    } // style enabled for labels
  } // if displayed

  bounds.x1 = noninf(bounds.x1);
  bounds.y1 = noninf(bounds.y1);
  bounds.x2 = noninf(bounds.x2);
  bounds.y2 = noninf(bounds.y2);
  bounds.w = noninf(bounds.x2 - bounds.x1);
  bounds.h = noninf(bounds.y2 - bounds.y1);

  // expand bounds by 1 because antialiasing can increase the visual/effective size by 1 on all sides
  if (bounds.w > 0 && bounds.h > 0 && displayed) {
    math.expandBoundingBox(bounds, 1);
  }

  return bounds;
};

var tf = function tf(val) {
  if (val) {
    return 't';
  } else {
    return 'f';
  }
};

var getKey = function getKey(opts) {
  var key = '';

  key += tf(opts.incudeNodes);
  key += tf(opts.includeEdges);
  key += tf(opts.includeLabels);
  key += tf(opts.includeOverlays);

  return key;
};

var cachedBoundingBoxImpl = function cachedBoundingBoxImpl(ele, opts) {
  var _p = ele._private;
  var bb = void 0;
  var headless = ele.cy().headless();
  var key = opts === defBbOpts ? defBbOptsKey : getKey(opts);

  if (!opts.useCache || headless || !_p.bbCache || !_p.bbCache[key]) {
    bb = boundingBoxImpl(ele, opts);

    if (!headless) {
      _p.bbCache = _p.bbCache || {};
      _p.bbCache[key] = bb;
    }
  } else {
    bb = _p.bbCache[key];
  }

  return bb;
};

var defBbOpts = {
  includeNodes: true,
  includeEdges: true,
  includeLabels: true,
  includeOverlays: true,
  useCache: true
};

var defBbOptsKey = getKey(defBbOpts);

function filledBbOpts(options) {
  return {
    includeNodes: util.default(options.includeNodes, defBbOpts.includeNodes),
    includeEdges: util.default(options.includeEdges, defBbOpts.includeEdges),
    includeLabels: util.default(options.includeLabels, defBbOpts.includeLabels),
    includeOverlays: util.default(options.includeOverlays, defBbOpts.includeOverlays),
    useCache: util.default(options.useCache, defBbOpts.useCache)
  };
}

elesfn.boundingBox = function (options) {
  // the main usecase is ele.boundingBox() for a single element with no/def options
  // specified s.t. the cache is used, so check for this case to make it faster by
  // avoiding the overhead of the rest of the function
  if (this.length === 1 && this[0]._private.bbCache && (options === undefined || options.useCache === undefined || options.useCache === true)) {
    if (options === undefined) {
      options = defBbOpts;
    } else {
      options = filledBbOpts(options);
    }

    return cachedBoundingBoxImpl(this[0], options);
  }

  var bounds = {
    x1: Infinity,
    y1: Infinity,
    x2: -Infinity,
    y2: -Infinity
  };

  options = options || util.staticEmptyObject();

  var opts = filledBbOpts(options);

  var eles = this;
  var cy = eles.cy();
  var styleEnabled = cy.styleEnabled();

  if (styleEnabled) {
    this.recalculateRenderedStyle(opts.useCache);
  }

  this.updateCompoundBounds();

  var updatedEdge = {}; // use to avoid duplicated edge updates

  for (var i = 0; i < eles.length; i++) {
    var ele = eles[i];

    if (styleEnabled && ele.isEdge() && ele.pstyle('curve-style').strValue === 'bezier' && !updatedEdge[ele.id()]) {
      var edges = ele.parallelEdges();

      for (var j = 0; j < edges.length; j++) {
        // make all as updated
        updatedEdge[edges[j].id()] = true;
      }

      edges.recalculateRenderedStyle(opts.useCache); // n.b. ele.parallelEdges() single is cached
    }

    updateBoundsFromBox(bounds, cachedBoundingBoxImpl(ele, opts));
  }

  bounds.x1 = noninf(bounds.x1);
  bounds.y1 = noninf(bounds.y1);
  bounds.x2 = noninf(bounds.x2);
  bounds.y2 = noninf(bounds.y2);
  bounds.w = noninf(bounds.x2 - bounds.x1);
  bounds.h = noninf(bounds.y2 - bounds.y1);

  return bounds;
};

// private helper to get bounding box for custom node positions
// - good for perf in certain cases but currently requires dirtying the rendered style
// - would be better to not modify the nodes but the nodes are read directly everywhere in the renderer...
// - try to use for only things like discrete layouts where the node position would change anyway
elesfn.boundingBoxAt = function (fn) {
  var nodes = this.nodes();

  if (is.plainObject(fn)) {
    var obj = fn;

    fn = function fn() {
      return obj;
    };
  }

  // save the current position and set the new one, per node
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    var _p = n._private;
    var pos = _p.position;
    var newPos = fn.call(n, n, i);

    _p.bbAtOldPos = { x: pos.x, y: pos.y };

    if (newPos) {
      pos.x = newPos.x;
      pos.y = newPos.y;
    }
  }

  this.emit('dirty'); // let the renderer know we've manually dirtied rendered dim calcs

  nodes.dirtyCompoundBoundsCache().updateCompoundBounds();

  var bb = this.boundingBox({ useCache: false });

  // restore the original position, per node
  for (var _i = 0; _i < nodes.length; _i++) {
    var _n = nodes[_i];
    var _p2 = _n._private;
    var _pos = _n._private.position;
    var old = _p2.bbAtOldPos;

    _pos.x = old.x;
    _pos.y = old.y;
  }

  nodes.dirtyCompoundBoundsCache();

  this.emit('dirty'); // let the renderer know we've manually dirtied rendered dim calcs

  return bb;
};

fn.boundingbox = fn.boundingBox;
fn.renderedBoundingbox = fn.renderedBoundingBox;

module.exports = elesfn;

/***/ }),
/* 59 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);
var fn = void 0,
    elesfn = void 0;

fn = elesfn = {};

var defineDimFns = function defineDimFns(opts) {
  opts.uppercaseName = util.capitalize(opts.name);
  opts.autoName = 'auto' + opts.uppercaseName;
  opts.labelName = 'label' + opts.uppercaseName;
  opts.outerName = 'outer' + opts.uppercaseName;
  opts.uppercaseOuterName = util.capitalize(opts.outerName);

  fn[opts.name] = function dimImpl() {
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

  fn['outer' + opts.uppercaseName] = function outerDimImpl() {
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

  fn['rendered' + opts.uppercaseName] = function renderedDimImpl() {
    var ele = this[0];

    if (ele) {
      var d = ele[opts.name]();
      return d * this.cy().zoom();
    }
  };

  fn['rendered' + opts.uppercaseOuterName] = function renderedOuterDimImpl() {
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

elesfn.padding = function () {
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

module.exports = elesfn;

/***/ }),
/* 60 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var ifEdge = function ifEdge(self, then) {
  if (self.isEdge()) {
    return then(self.renderer());
  }
};

module.exports = {
  controlPoints: function controlPoints() {
    var _this = this;

    return ifEdge(this, function (renderer) {
      return renderer.getControlPoints(_this);
    });
  },
  segmentPoints: function segmentPoints() {
    var _this2 = this;

    return ifEdge(this, function (renderer) {
      return renderer.getSegmentPoints(_this2);
    });
  },
  sourceEndpoint: function sourceEndpoint() {
    var _this3 = this;

    return ifEdge(this, function (renderer) {
      return renderer.getSourceEndpoint(_this3);
    });
  },
  targetEndpoint: function targetEndpoint() {
    var _this4 = this;

    return ifEdge(this, function (renderer) {
      return renderer.getTargetEndpoint(_this4);
    });
  },
  midpoint: function midpoint() {
    var _this5 = this;

    return ifEdge(this, function (renderer) {
      return renderer.getEdgeMidpoint(_this5);
    });
  }
};

/***/ }),
/* 61 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var Emitter = __webpack_require__(11);
var define = __webpack_require__(4);
var is = __webpack_require__(0);
var util = __webpack_require__(1);
var Selector = __webpack_require__(6);

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
      return ele !== eventObj.target && is.element(eventObj.target) && selector.matches(eventObj.target);
    }

    return true;
  },
  eventFields: function eventFields(ele) {
    return {
      cy: ele.cy(),
      target: ele
    };
  },
  callbackContext: function callbackContext(ele, listener, eventObj) {
    return listener.qualifier != null ? eventObj.target : ele;
  },
  beforeEmit: function beforeEmit(context, listener /*, eventObj*/) {
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
  if (is.string(arg)) {
    return new Selector(arg);
  } else {
    return arg;
  }
};

var elesfn = {
  createEmitter: function createEmitter() {
    for (var i = 0; i < this.length; i++) {
      var ele = this[i];
      var _p = ele._private;

      if (!_p.emitter) {
        _p.emitter = new Emitter(util.assign({
          context: ele
        }, emitterOptions));
      }
    }

    return this;
  },

  emitter: function emitter() {
    return this._private.emitter;
  },

  on: function on(events, selector, callback) {
    for (var i = 0; i < this.length; i++) {
      var ele = this[i];

      ele.emitter().on(events, argSelector(selector), callback);
    }

    return this;
  },

  removeListener: function removeListener(events, selector, callback) {
    for (var i = 0; i < this.length; i++) {
      var ele = this[i];

      ele.emitter().removeListener(events, argSelector(selector), callback);
    }

    return this;
  },

  one: function one(events, selector, callback) {
    for (var i = 0; i < this.length; i++) {
      var ele = this[i];

      ele.emitter().one(events, argSelector(selector), callback);
    }

    return this;
  },

  once: function once(events, selector, callback) {
    for (var i = 0; i < this.length; i++) {
      var ele = this[i];

      ele.emitter().on(events, argSelector(selector), callback, {
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
    this.cy().notify({
      type: event,
      eles: this
    });

    this.emit(event, extraParams);

    return this;
  }
};

define.eventAliasesOn(elesfn);

module.exports = elesfn;

/***/ }),
/* 62 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);
var Selector = __webpack_require__(6);

var elesfn = {
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

  filter: function filter(_filter, thisArg) {
    if (_filter === undefined) {
      // check this first b/c it's the most common/performant case
      return this;
    } else if (is.string(_filter) || is.elementOrCollection(_filter)) {
      return new Selector(_filter).filter(this);
    } else if (is.fn(_filter)) {
      var filterEles = this.spawn();
      var eles = this;

      for (var i = 0; i < eles.length; i++) {
        var ele = eles[i];
        var include = thisArg ? _filter.apply(thisArg, [ele, i, eles]) : _filter(ele, i, eles);

        if (include) {
          filterEles.merge(ele);
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

      if (is.string(toRemove)) {
        toRemove = this.filter(toRemove);
      }

      var elements = [];
      var rMap = toRemove._private.map;

      for (var i = 0; i < this.length; i++) {
        var element = this[i];

        var remove = rMap.has(element.id());
        if (!remove) {
          elements.push(element);
        }
      }

      return this.spawn(elements);
    }
  },

  absoluteComplement: function absoluteComplement() {
    var cy = this.cy();

    return cy.mutableElements().not(this);
  },

  intersect: function intersect(other) {
    // if a selector is specified, then filter by it instead
    if (is.string(other)) {
      var selector = other;
      return this.filter(selector);
    }

    var elements = [];
    var col1 = this;
    var col2 = other;
    var col1Smaller = this.length < other.length;
    var map2 = col1Smaller ? col2._private.map : col1._private.map;
    var col = col1Smaller ? col1 : col2;

    for (var i = 0; i < col.length; i++) {
      var id = col[i]._private.data.id;
      var entry = map2.get(id);

      if (entry) {
        elements.push(entry.ele);
      }
    }

    return this.spawn(elements);
  },

  xor: function xor(other) {
    var cy = this._private.cy;

    if (is.string(other)) {
      other = cy.$(other);
    }

    var elements = [];
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

    return this.spawn(elements);
  },

  diff: function diff(other) {
    var cy = this._private.cy;

    if (is.string(other)) {
      other = cy.$(other);
    }

    var left = [];
    var right = [];
    var both = [];
    var col1 = this;
    var col2 = other;

    var add = function add(col, other, retEles) {

      for (var i = 0; i < col.length; i++) {
        var ele = col[i];
        var id = ele._private.data.id;
        var inOther = other.hasElementWithId(id);

        if (inOther) {
          both.push(ele);
        } else {
          retEles.push(ele);
        }
      }
    };

    add(col1, col2, left);
    add(col2, col1, right);

    return {
      left: this.spawn(left, { unique: true }),
      right: this.spawn(right, { unique: true }),
      both: this.spawn(both, { unique: true })
    };
  },

  add: function add(toAdd) {
    var cy = this._private.cy;

    if (!toAdd) {
      return this;
    }

    if (is.string(toAdd)) {
      var selector = toAdd;
      toAdd = cy.mutableElements().filter(selector);
    }

    var elements = [];

    for (var i = 0; i < this.length; i++) {
      elements.push(this[i]);
    }

    var map = this._private.map;

    for (var _i = 0; _i < toAdd.length; _i++) {

      var add = !map.has(toAdd[_i].id());
      if (add) {
        elements.push(toAdd[_i]);
      }
    }

    return this.spawn(elements);
  },

  // in place merge on calling collection
  merge: function merge(toAdd) {
    var _p = this._private;
    var cy = _p.cy;

    if (!toAdd) {
      return this;
    }

    if (toAdd && is.string(toAdd)) {
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

        map.set(id, { ele: toAddEle, index: index });
      } else {
        // replace
        var _index = map.get(id).index;

        this[_index] = toAddEle;
        map.set(id, { ele: toAddEle, index: _index });
      }
    }

    return this; // chaining
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

    // remove ele
    this[i] = undefined;
    map.delete(id);

    var unmergedLastEle = i === this.length - 1;

    // replace empty spot with last ele in collection
    if (this.length > 1 && !unmergedLastEle) {
      var lastEleI = this.length - 1;
      var lastEle = this[lastEleI];
      var lastEleId = lastEle._private.data.id;

      this[lastEleI] = undefined;
      this[i] = lastEle;
      map.set(lastEleId, { ele: lastEle, index: i });
    }

    // the collection is now 1 ele smaller
    this.length--;

    return this;
  },

  // remove eles in place on calling collection
  unmerge: function unmerge(toRemove) {
    var cy = this._private.cy;

    if (!toRemove) {
      return this;
    }

    if (toRemove && is.string(toRemove)) {
      var selector = toRemove;
      toRemove = cy.mutableElements().filter(selector);
    }

    for (var i = 0; i < toRemove.length; i++) {
      this.unmergeOne(toRemove[i]);
    }

    return this; // chaining
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
    var maxEle = void 0;
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
    var minEle = void 0;
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
};

// aliases
var fn = elesfn;
fn['u'] = fn['|'] = fn['+'] = fn.union = fn.or = fn.add;
fn['\\'] = fn['!'] = fn['-'] = fn.difference = fn.relativeComplement = fn.subtract = fn.not;
fn['n'] = fn['&'] = fn['.'] = fn.and = fn.intersection = fn.intersect;
fn['^'] = fn['(+)'] = fn['(-)'] = fn.symmetricDifference = fn.symdiff = fn.xor;
fn.fnFilter = fn.filterFn = fn.stdFilter = fn.filter;
fn.complement = fn.abscomp = fn.absoluteComplement;

module.exports = elesfn;

/***/ }),
/* 63 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var elesfn = {
  isNode: function isNode() {
    return this.group() === 'nodes';
  },

  isEdge: function isEdge() {
    return this.group() === 'edges';
  },

  isLoop: function isLoop() {
    return this.isEdge() && this.source().id() === this.target().id();
  },

  isSimple: function isSimple() {
    return this.isEdge() && this.source().id() !== this.target().id();
  },

  group: function group() {
    var ele = this[0];

    if (ele) {
      return ele._private.group;
    }
  }
};

module.exports = elesfn;

/***/ }),
/* 64 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);
var zIndexSort = __webpack_require__(17);
var util = __webpack_require__(1);

var elesfn = {
  forEach: function forEach(fn, thisArg) {
    if (is.fn(fn)) {

      for (var i = 0; i < this.length; i++) {
        var ele = this[i];
        var ret = thisArg ? fn.apply(thisArg, [ele, i, this]) : fn(ele, i, this);

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
    if (!is.fn(sortFn)) {
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
    }

    // let cy = ele.cy();
    var _p = ele._private;
    var group = _p.group;

    if (group === 'nodes') {
      var depth = _p.data.parent ? ele.parents().size() : 0;

      if (!ele.isParent()) {
        return util.MAX_INT - 1; // childless nodes always on top
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

elesfn.each = elesfn.forEach;

module.exports = elesfn;

/***/ }),
/* 65 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);
var util = __webpack_require__(1);
var Promise = __webpack_require__(5);
var math = __webpack_require__(2);

var elesfn = {
  // Calculates and returns node dimensions { x, y } based on options given
  layoutDimensions: function layoutDimensions(options) {
    options = util.assign({
      nodeDimensionsIncludeLabels: true
    }, options);

    if (options.nodeDimensionsIncludeLabels) {
      var bbDim = this.boundingBox();
      return {
        w: bbDim.w,
        h: bbDim.h
      };
    } else {
      return {
        w: this.outerWidth(),
        h: this.outerHeight()
      };
    }
  },

  // using standard layout options, apply position function (w/ or w/o animation)
  layoutPositions: function layoutPositions(layout, options, fn) {
    var nodes = this.nodes();
    var cy = this.cy();
    var layoutEles = options.eles; // nodes & edges
    var getMemoizeKey = function getMemoizeKey(node, i) {
      return node.id() + '$' + i;
    };
    var fnMem = util.memoize(fn, getMemoizeKey); // memoized version of position function

    layout.emit({ type: 'layoutstart', layout: layout });

    layout.animations = [];

    var calculateSpacing = function calculateSpacing(spacing, nodesBb, pos) {
      var center = {
        x: nodesBb.x1 + nodesBb.w / 2,
        y: nodesBb.y1 + nodesBb.h / 2
      };

      var spacingVector = { // scale from center of bounding box (not necessarily 0,0)
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

      var bb = math.makeBoundingBox();

      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var pos = fnMem(node, i);

        math.expandBoundingBoxByPoint(bb, pos.x, pos.y);
      }

      return bb;
    };

    var bb = spacingBb();

    var getFinalPos = util.memoize(function (node, i) {
      var newPos = fnMem(node, i);
      var pos = node.position();

      if (!is.number(pos.x) || !is.number(pos.y)) {
        node.silentPosition({ x: 0, y: 0 });
      }

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

          ani.play();
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

        fitAni.play();
      } else if (options.zoom !== undefined && options.pan !== undefined) {
        var zoomPanAni = cy.animation({
          zoom: options.zoom,
          pan: options.pan,
          duration: options.animationDuration,
          easing: options.animationEasing
        });

        layout.animations.push(zoomPanAni);

        zoomPanAni.play();
      }

      layout.one('layoutready', options.ready);
      layout.emit({ type: 'layoutready', layout: layout });

      Promise.all(layout.animations.map(function (ani) {
        return ani.promise();
      })).then(function () {
        layout.one('layoutstop', options.stop);
        layout.emit({ type: 'layoutstop', layout: layout });
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
      layout.emit({ type: 'layoutready', layout: layout });

      layout.one('layoutstop', options.stop);
      layout.emit({ type: 'layoutstop', layout: layout });
    }

    return this; // chaining
  },

  layout: function layout(options) {
    var cy = this.cy();

    return cy.makeLayout(util.extend({}, options, {
      eles: this
    }));
  }

};

// aliases:
elesfn.createLayout = elesfn.makeLayout = elesfn.layout;

module.exports = elesfn;

/***/ }),
/* 66 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);

function styleCache(key, fn, ele) {
  var _p = ele._private;
  var cache = _p.styleCache = _p.styleCache || {};
  var val;

  if ((val = cache[key]) != null) {
    return val;
  } else {
    val = cache[key] = fn(ele);

    return val;
  }
}

function cacheStyleFunction(key, fn) {
  return function cachedStyleFunction(ele) {
    return styleCache(key, fn, ele);
  };
}

function cachePrototypeStyleFunction(key, fn) {
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

var elesfn = {

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
      return ele._private.styleCache = {};
    };

    if (cy.hasCompoundNodes()) {
      var eles = void 0;

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

    if (cy._private.batchingStyle) {
      var bEles = cy._private.batchStyleEles;

      bEles.merge(this);

      return this; // chaining and exit early when batching
    }

    var hasCompounds = cy.hasCompoundNodes();
    var style = cy.style();
    var updatedEles = this;

    notifyRenderer = notifyRenderer || notifyRenderer === undefined ? true : false;

    if (hasCompounds) {
      // then add everything up and down for compound selector checks
      updatedEles = this.spawnSelf().merge(this.descendants()).merge(this.parents());
    }

    var changedEles = style.apply(updatedEles);

    changedEles.dirtyStyleCache();
    changedEles.dirtyCompoundBoundsCache();

    if (notifyRenderer) {
      changedEles.emitAndNotify('style'); // let renderer know we changed style
    } else {
      changedEles.emit('style'); // just fire the event
    }

    return this; // chaining
  },

  // just update the mappers in the elements' styles; cheaper than eles.updateStyle()
  updateMappers: function updateMappers(notifyRenderer) {
    var cy = this._private.cy;
    var style = cy.style();
    notifyRenderer = notifyRenderer || notifyRenderer === undefined ? true : false;

    if (!cy.styleEnabled()) {
      return this;
    }

    var changedEles = style.updateMappers(this);

    changedEles.dirtyStyleCache();
    changedEles.dirtyCompoundBoundsCache();

    if (notifyRenderer) {
      changedEles.emitAndNotify('style'); // let renderer know we changed style
    } else {
      changedEles.emit('style'); // just fire the event
    }
    return this; // chaining
  },

  // get the internal parsed style object for the specified property
  parsedStyle: function parsedStyle(property) {
    var ele = this[0];
    var cy = ele.cy();

    if (!cy.styleEnabled()) {
      return;
    }

    if (ele) {
      return ele._private.style[property] || cy.style().getDefaultProperty(property);
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

    if (is.plainObject(name)) {
      // then extend the bypass
      var props = name;
      style.applyBypass(this, props, updateTransitions);

      this.dirtyStyleCache();
      this.dirtyCompoundBoundsCache();

      this.emitAndNotify('style'); // let the renderer know we've updated style
    } else if (is.string(name)) {

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

        this.dirtyStyleCache();
        this.dirtyCompoundBoundsCache();

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

    this.dirtyStyleCache();
    this.dirtyCompoundBoundsCache();

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

elesfn.takesUpSpace = cachePrototypeStyleFunction('takesUpSpace', defineDerivedStateFunction({
  ok: eleTakesUpSpace
}));

var eleInteractive = cacheStyleFunction('eleInteractive', function (ele) {
  return ele.pstyle('events').value === 'yes' && ele.pstyle('visibility').value === 'visible' && eleTakesUpSpace(ele);
});

var parentInteractive = cacheStyleFunction('parentInteractive', function (parent) {
  return parent.pstyle('visibility').value === 'visible' && eleTakesUpSpace(parent);
});

elesfn.interactive = cachePrototypeStyleFunction('interactive', defineDerivedStateFunction({
  ok: eleInteractive,
  parentOk: parentInteractive,
  edgeOkViaNode: eleTakesUpSpace
}));

elesfn.noninteractive = function () {
  var ele = this[0];

  if (ele) {
    return !ele.interactive();
  }
};

var eleVisible = cacheStyleFunction('eleVisible', function (ele) {
  return ele.pstyle('visibility').value === 'visible' && ele.pstyle('opacity').pfValue !== 0 && eleTakesUpSpace(ele);
});

var edgeVisibleViaNode = eleTakesUpSpace;

elesfn.visible = cachePrototypeStyleFunction('visible', defineDerivedStateFunction({
  ok: eleVisible,
  edgeOkViaNode: edgeVisibleViaNode
}));

elesfn.hidden = function () {
  var ele = this[0];

  if (ele) {
    return !ele.visible();
  }
};

elesfn.bypass = elesfn.css = elesfn.style;
elesfn.renderedCss = elesfn.renderedStyle;
elesfn.removeBypass = elesfn.removeCss = elesfn.removeStyle;
elesfn.pstyle = elesfn.parsedStyle;

module.exports = elesfn;

/***/ }),
/* 67 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var elesfn = {};

function defineSwitchFunction(params) {
  return function () {
    var args = arguments;
    var changedEles = [];

    // e.g. cy.nodes().select( data, handler )
    if (args.length === 2) {
      var data = args[0];
      var handler = args[1];
      this.on(params.event, data, handler);
    }

    // e.g. cy.nodes().select( handler )
    else if (args.length === 1) {
        var _handler = args[0];
        this.on(params.event, _handler);
      }

      // e.g. cy.nodes().select()
      else if (args.length === 0) {
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
        }

    return this;
  };
}

function defineSwitchSet(params) {
  elesfn[params.field] = function () {
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

  elesfn[params.on] = defineSwitchFunction({
    event: params.on,
    field: params.field,
    ableField: params.ableField,
    overrideAble: params.overrideAble,
    value: true
  });

  elesfn[params.off] = defineSwitchFunction({
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
    return ele.cy().autoungrabify() ? false : undefined;
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

elesfn.deselect = elesfn.unselect;

elesfn.grabbed = function () {
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

elesfn.inactive = function () {
  var ele = this[0];
  if (ele) {
    return !ele._private.active;
  }
};

module.exports = elesfn;

/***/ }),
/* 68 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);
var is = __webpack_require__(0);

var elesfn = {};

var cache = function cache(fn, name) {
  return function traversalCache(arg1, arg2, arg3, arg4) {
    var selectorOrEles = arg1;
    var eles = this;
    var key = void 0;

    if (selectorOrEles == null) {
      key = 'null';
    } else if (is.elementOrCollection(selectorOrEles) && selectorOrEles.length === 1) {
      key = '#' + selectorOrEles.id();
    }

    if (eles.length === 1 && key) {
      var _p = eles[0]._private;
      var tch = _p.traversalCache = _p.traversalCache || {};
      var ch = tch[name] = tch[name] || {};
      var cacheHit = ch[key];

      if (cacheHit) {
        return cacheHit;
      } else {
        return ch[key] = fn.call(eles, arg1, arg2, arg3, arg4);
      }
    } else {
      return fn.call(eles, arg1, arg2, arg3, arg4);
    }
  };
};

// DAG functions
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

    return this.spawn(ret, { unique: true }).filter(selector);
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

    return this.spawn(oEles, { unique: true }).filter(selector);
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

    return this.spawn(sEles, { unique: true }).filter(selector);
  };
};

elesfn.clearTraversalCache = function () {
  for (var i = 0; i < this.length; i++) {
    this[i]._private.traversalCache = null;
  }
};

util.extend(elesfn, {
  // get the root nodes in the DAG
  roots: defineDagExtremity({ noIncomingEdges: true }),

  // get the leaf nodes in the DAG
  leaves: defineDagExtremity({ noOutgoingEdges: true }),

  // normally called children in graph theory
  // these nodes =edges=> outgoing nodes
  outgoers: cache(defineDagOneHop({ outgoing: true }), 'outgoers'),

  // aka DAG descendants
  successors: defineDagAllHops({ outgoing: true }),

  // normally called parents in graph theory
  // these nodes <=edges= incoming nodes
  incomers: cache(defineDagOneHop({ incoming: true }), 'incomers'),

  // aka DAG ancestors
  predecessors: defineDagAllHops({ incoming: true })
});

// Neighbourhood functions
//////////////////////////

util.extend(elesfn, {
  neighborhood: cache(function (selector) {
    var elements = [];
    var nodes = this.nodes();

    for (var i = 0; i < nodes.length; i++) {
      // for all nodes
      var node = nodes[i];
      var connectedEdges = node.connectedEdges();

      // for each connected edge, add the edge and the other node
      for (var j = 0; j < connectedEdges.length; j++) {
        var edge = connectedEdges[j];
        var src = edge.source();
        var tgt = edge.target();
        var otherNode = node === src ? tgt : src;

        // need check in case of loop
        if (otherNode.length > 0) {
          elements.push(otherNode[0]); // add node 1 hop away
        }

        // add connected edge
        elements.push(edge[0]);
      }
    }

    return this.spawn(elements, { unique: true }).filter(selector);
  }, 'neighborhood'),

  closedNeighborhood: function closedNeighborhood(selector) {
    return this.neighborhood().add(this).filter(selector);
  },

  openNeighborhood: function openNeighborhood(selector) {
    return this.neighborhood(selector);
  }
});

// aliases
elesfn.neighbourhood = elesfn.neighborhood;
elesfn.closedNeighbourhood = elesfn.closedNeighborhood;
elesfn.openNeighbourhood = elesfn.openNeighborhood;

// Edge functions
/////////////////

util.extend(elesfn, {
  source: cache(function sourceImpl(selector) {
    var ele = this[0];
    var src = void 0;

    if (ele) {
      src = ele._private.source || ele.cy().collection();
    }

    return src && selector ? src.filter(selector) : src;
  }, 'source'),

  target: cache(function targetImpl(selector) {
    var ele = this[0];
    var tgt = void 0;

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

    return this.spawn(sources, { unique: true }).filter(selector);
  };
}

util.extend(elesfn, {
  edgesWith: cache(defineEdgesWithFunction(), 'edgesWith'),

  edgesTo: cache(defineEdgesWithFunction({
    thisIsSrc: true
  }), 'edgesTo')
});

function defineEdgesWithFunction(params) {

  return function edgesWithImpl(otherNodes) {
    var elements = [];
    var cy = this._private.cy;
    var p = params || {};

    // get elements if a selector is specified
    if (is.string(otherNodes)) {
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

    return this.spawn(elements, { unique: true });
  };
}

util.extend(elesfn, {
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

    return this.spawn(retEles, { unique: true }).filter(selector);
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

    return this.spawn(retEles, { unique: true }).filter(selector);
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
  params = util.extend({}, defaults, params);

  return function parallelEdgesImpl(selector) {
    // micro-optimised for renderer
    var elements = [];
    var edges = this.edges();
    var p = params;

    // look at all the edges in the collection
    for (var i = 0; i < edges.length; i++) {
      var edge1 = edges[i];
      var edge1_p = edge1._private;
      var src1 = edge1_p.source;
      var srcid1 = src1._private.data.id;
      var tgtid1 = edge1_p.data.target;
      var srcEdges1 = src1._private.edges;

      // look at edges connected to the src node of this edge
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

    return this.spawn(elements, { unique: true }).filter(selector);
  };
}

// Misc functions
/////////////////

util.extend(elesfn, {
  components: function components() {
    var self = this;
    var cy = self.cy();
    var visited = self.spawn();
    var unvisited = self.nodes().spawnSelf();
    var components = [];

    var visitInComponent = function visitInComponent(node, component) {
      visited.merge(node);
      unvisited.unmerge(node);
      component.merge(node);
    };

    if (unvisited.empty()) {
      return self.spawn();
    }

    var _loop = function _loop() {
      var component = cy.collection();
      components.push(component);

      var root = unvisited[0];
      visitInComponent(root, component);

      self.bfs({
        directed: false,
        roots: root,
        visit: function visit(v, e, u, i, depth) {
          visitInComponent(v, component);
        }
      });
    };

    do {
      _loop();
    } while (unvisited.length > 0);

    return components.map(function (component) {
      var connectedEdges = component.connectedEdges().stdFilter(function (edge) {
        return component.anySame(edge.source()) && component.anySame(edge.target());
      });

      return component.union(connectedEdges);
    });
  }
});

module.exports = elesfn;

/***/ }),
/* 69 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);
var util = __webpack_require__(1);
var Collection = __webpack_require__(7);
var Element = __webpack_require__(14);

var corefn = {
  add: function add(opts) {

    var elements = void 0;
    var cy = this;

    // add the elements
    if (is.elementOrCollection(opts)) {
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
    }

    // specify an array of options
    else if (is.array(opts)) {
        var _jsons = opts;

        elements = new Collection(cy, _jsons);
      }

      // specify via opts.nodes and opts.edges
      else if (is.plainObject(opts) && (is.array(opts.nodes) || is.array(opts.edges))) {
          var elesByGroup = opts;
          var _jsons2 = [];

          var grs = ['nodes', 'edges'];
          for (var _i = 0, il = grs.length; _i < il; _i++) {
            var group = grs[_i];
            var elesArray = elesByGroup[group];

            if (is.array(elesArray)) {

              for (var j = 0, jl = elesArray.length; j < jl; j++) {
                var json = util.extend({ group: group }, elesArray[j]);

                _jsons2.push(json);
              }
            }
          }

          elements = new Collection(cy, _jsons2);
        }

        // specify options for one element
        else {
            var _json = opts;
            elements = new Element(cy, _json).collection();
          }

    return elements;
  },

  remove: function remove(collection) {
    if (is.elementOrCollection(collection)) {
      // already have right ref
    } else if (is.string(collection)) {
      var selector = collection;
      collection = this.$(selector);
    }

    return collection.remove();
  }
};

module.exports = corefn;

/***/ }),
/* 70 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var define = __webpack_require__(4);
var util = __webpack_require__(1);
var stepAll = __webpack_require__(71);

var corefn = {

  // pull in animation functions
  animate: define.animate(),
  animation: define.animation(),
  animated: define.animated(),
  clearQueue: define.clearQueue(),
  delay: define.delay(),
  delayAnimation: define.delayAnimation(),
  stop: define.stop(),

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

      util.requestAnimationFrame(function animationStep(now) {
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

module.exports = corefn;

/***/ }),
/* 71 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var step = __webpack_require__(72);
var startAnimation = __webpack_require__(77);

function stepAll(now, cy) {
  var eles = cy._private.aniEles;
  var doneEles = [];

  function stepOne(ele, isCore) {
    var _p = ele._private;
    var current = _p.animation.current;
    var queue = _p.animation.queue;
    var ranAnis = false;

    // cancel all animations on display:none ele
    if (!isCore && ele.pstyle('display').value === 'none') {
      // put all current and queue animations in this tick's current list
      // and empty the lists for the element
      current = current.splice(0, current.length).concat(queue.splice(0, queue.length));

      // stop all animations
      for (var i = 0; i < current.length; i++) {
        current[i].stop();
      }
    }

    // if nothing currently animating, get something from the queue
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
    };

    // step and remove if done
    for (var _i = current.length - 1; _i >= 0; _i--) {
      var ani = current[_i];
      var ani_p = ani._private;

      if (ani_p.stopped) {
        current.splice(_i, 1);

        ani_p.hooked = false;
        ani_p.playing = false;
        ani_p.started = false;

        callbacks(ani_p.frames);

        continue;
      }

      if (!ani_p.playing && !ani_p.applying) {
        continue;
      }

      // an apply() while playing shouldn't do anything
      if (ani_p.playing && ani_p.applying) {
        ani_p.applying = false;
      }

      if (!ani_p.started) {
        startAnimation(ele, ani, now, isCore);
      }

      step(ele, ani, now, isCore);

      if (ani_p.applying) {
        ani_p.applying = false;
      }

      callbacks(ani_p.frames);

      if (ani.completed()) {
        current.splice(_i, 1);

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

  var ranCoreAni = stepOne(cy, true);

  // notify renderer
  if (ranEleAni || ranCoreAni) {
    if (eles.length > 0) {
      eles.dirtyCompoundBoundsCache();

      cy.notify({
        type: 'draw',
        eles: eles
      });
    } else {
      cy.notify({
        type: 'draw'
      });
    }
  }

  // remove elements from list of currently animating if its queues are empty
  eles.unmerge(doneEles);

  cy.emit('step');
} // stepAll

module.exports = stepAll;

/***/ }),
/* 72 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var easings = __webpack_require__(73);
var ease = __webpack_require__(76);
var is = __webpack_require__(0);

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
      var easingVals = void 0;

      if (is.string(pEasing)) {
        var easingProp = style.parse('transition-timing-function', pEasing);

        easingVals = easingProp.value;
      } else {
        // then assume preparsed array
        easingVals = pEasing;
      }

      var name = void 0,
          args = void 0;

      if (is.string(easingVals)) {
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
  var percent = void 0;

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
      var pos = self.position();

      if (valid(startPos.x, endPos.x)) {
        pos.x = ease(startPos.x, endPos.x, percent, easing);
      }

      if (valid(startPos.y, endPos.y)) {
        pos.y = ease(startPos.y, endPos.y, percent, easing);
      }

      self.emit('position');
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
        _p.zoom = ease(startZoom, endZoom, percent, easing);
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

  if (is.number(start) && is.number(end)) {
    return true;
  } else if (start && end) {
    return true;
  }

  return false;
}

module.exports = step;

/***/ }),
/* 73 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var generateCubicBezier = __webpack_require__(74);
var generateSpringRK4 = __webpack_require__(75);

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

module.exports = easings;

/***/ }),
/* 74 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


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
    var currentX = void 0,
        currentT = void 0,
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

module.exports = generateCubicBezier;

/***/ }),
/* 75 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


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

    return { dx: state.v, dv: springAccelerationForState(state) };
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
        have_duration = void 0,
        dt = void 0,
        last_state = void 0;

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

module.exports = generateSpringRK4;

/***/ }),
/* 76 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);

function getEasedValue(type, start, end, percent, easingFn) {
  if (percent === 1) {
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

  if (is.number(start) && is.number(end)) {
    return getEasedValue(type, start, end, percent, easingFn);
  } else if (is.array(start) && is.array(end)) {
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

module.exports = ease;

/***/ }),
/* 77 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function startAnimation(self, ani, now, isCore) {
  var isEles = !isCore;
  var ele = self;
  var ani_p = ani._private;
  var cy = isCore ? self : self.cy();
  var style = cy.style();

  if (isEles) {
    var pos = ele.position();

    ani_p.startPosition = ani_p.startPosition || {
      x: pos.x,
      y: pos.y
    };

    ani_p.startStyle = ani_p.startStyle || style.getAnimationStartStyle(ele, ani_p.style);
  }

  if (isCore) {
    var pan = cy._private.pan;

    ani_p.startPan = ani_p.startPan || {
      x: pan.x,
      y: pan.y
    };

    ani_p.startZoom = ani_p.startZoom != null ? ani_p.startZoom : cy._private.zoom;
  }

  ani_p.started = true;
  ani_p.startTime = now - ani_p.progress * ani_p.duration;
}

module.exports = startAnimation;

/***/ }),
/* 78 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var Emitter = __webpack_require__(11);
var define = __webpack_require__(4);
var is = __webpack_require__(0);
var util = __webpack_require__(1);
var Selector = __webpack_require__(6);

var emitterOptions = {
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
      return cy !== eventObj.target && is.element(eventObj.target) && selector.matches(eventObj.target);
    }

    return true;
  },
  eventFields: function eventFields(cy) {
    return {
      cy: cy,
      target: cy
    };
  },
  callbackContext: function callbackContext(cy, listener, eventObj) {
    return listener.qualifier != null ? eventObj.target : cy;
  }
};

var argSelector = function argSelector(arg) {
  if (is.string(arg)) {
    return new Selector(arg);
  } else {
    return arg;
  }
};

var elesfn = {
  createEmitter: function createEmitter() {
    var _p = this._private;

    if (!_p.emitter) {
      _p.emitter = new Emitter(util.assign({
        context: this
      }, emitterOptions));
    }

    return this;
  },

  emitter: function emitter() {
    return this._private.emitter;
  },

  on: function on(events, selector, callback) {
    this.emitter().on(events, argSelector(selector), callback);

    return this;
  },

  removeListener: function removeListener(events, selector, callback) {
    this.emitter().removeListener(events, argSelector(selector), callback);

    return this;
  },

  one: function one(events, selector, callback) {
    this.emitter().one(events, argSelector(selector), callback);

    return this;
  },

  once: function once(events, selector, callback) {
    this.emitter().one(events, argSelector(selector), callback);

    return this;
  },

  emit: function emit(events, extraParams) {
    this.emitter().emit(events, extraParams);

    return this;
  }
};

define.eventAliasesOn(elesfn);

module.exports = elesfn;

/***/ }),
/* 79 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var corefn = {

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

corefn.jpeg = corefn.jpg;

module.exports = corefn;

/***/ }),
/* 80 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);
var is = __webpack_require__(0);

var corefn = {

  layout: function layout(options) {
    var cy = this;

    if (options == null) {
      util.error('Layout options must be specified to make a layout');
      return;
    }

    if (options.name == null) {
      util.error('A `name` must be specified to make a layout');
      return;
    }

    var name = options.name;
    var Layout = cy.extension('layout', name);

    if (Layout == null) {
      util.error('Can not apply layout: No such layout `' + name + '` found; did you include its JS file?');
      return;
    }

    var eles = void 0;
    if (is.string(options.eles)) {
      eles = cy.$(options.eles);
    } else {
      eles = options.eles != null ? options.eles : cy.$();
    }

    var layout = new Layout(util.extend({}, options, {
      cy: cy,
      eles: eles
    }));

    return layout;
  }

};

corefn.createLayout = corefn.makeLayout = corefn.layout;

module.exports = corefn;

/***/ }),
/* 81 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var corefn = {
  notify: function notify(params) {
    var _p = this._private;

    if (_p.batchingNotify) {
      var bEles = _p.batchNotifyEles;
      var bTypes = _p.batchNotifyTypes;

      if (params.eles) {
        bEles.merge(params.eles);
      }

      if (!bTypes.ids[params.type]) {
        bTypes.push(params.type);
        bTypes.ids[params.type] = true;
      }

      return; // notifications are disabled during batching
    }

    if (!_p.notificationsEnabled) {
      return;
    } // exit on disabled

    var renderer = this.renderer();

    // exit if destroy() called on core or renderer in between frames #1499 #1528
    if (this.isDestroyed() || !renderer) {
      return;
    }

    renderer.notify(params);
  },

  notifications: function notifications(bool) {
    var p = this._private;

    if (bool === undefined) {
      return p.notificationsEnabled;
    } else {
      p.notificationsEnabled = bool ? true : false;
    }
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
      _p.batchingStyle = _p.batchingNotify = true;
      _p.batchStyleEles = this.collection();
      _p.batchNotifyEles = this.collection();
      _p.batchNotifyTypes = [];
      _p.batchNotifyTypes.ids = {};
    }

    _p.batchCount++;

    return this;
  },

  endBatch: function endBatch() {
    var _p = this._private;

    _p.batchCount--;

    if (_p.batchCount === 0) {
      // update style for dirty eles
      _p.batchingStyle = false;
      _p.batchStyleEles.updateStyle();

      // notify the renderer of queued eles and event types
      _p.batchingNotify = false;
      this.notify({
        type: _p.batchNotifyTypes,
        eles: _p.batchNotifyEles
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

module.exports = corefn;

/***/ }),
/* 82 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);

var corefn = {

  renderTo: function renderTo(context, zoom, pan, pxRatio) {
    var r = this._private.renderer;

    r.renderTo(context, zoom, pan, pxRatio);
    return this;
  },

  renderer: function renderer() {
    return this._private.renderer;
  },

  forceRender: function forceRender() {
    this.notify({
      type: 'draw'
    });

    return this;
  },

  resize: function resize() {
    this.invalidateSize();

    this.notify({
      type: 'resize'
    });

    this.emit('resize');

    return this;
  },

  initRenderer: function initRenderer(options) {
    var cy = this;

    var RendererProto = cy.extension('renderer', options.name);
    if (RendererProto == null) {
      util.error('Can not initialise: No such renderer `%s` found; did you include its JS file?', options.name);
      return;
    }

    cy._private.renderer = new RendererProto(util.extend({}, options, { cy: cy }));

    this.notify({ type: 'init' });
  },

  destroyRenderer: function destroyRenderer() {
    var cy = this;

    cy.notify({ type: 'destroy' }); // destroy the renderer

    var domEle = cy.container();
    if (domEle) {
      domEle._cyreg = null;

      while (domEle.childNodes.length > 0) {
        domEle.removeChild(domEle.childNodes[0]);
      }
    }

    cy._private.renderer = null; // to be extra safe, remove the ref
  },

  onRender: function onRender(fn) {
    return this.on('render', fn);
  },

  offRender: function offRender(fn) {
    return this.off('render', fn);
  }

};

corefn.invalidateDimensions = corefn.resize;

module.exports = corefn;

/***/ }),
/* 83 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);
var Collection = __webpack_require__(7);

var corefn = {

  // get a collection
  // - empty collection on no args
  // - collection of elements in the graph on selector arg
  // - guarantee a returned collection when elements or collection specified
  collection: function collection(eles, opts) {

    if (is.string(eles)) {
      return this.$(eles);
    } else if (is.elementOrCollection(eles)) {
      return eles.collection();
    } else if (is.array(eles)) {
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

};

// aliases
corefn.elements = corefn.filter = corefn.$;

module.exports = corefn;

/***/ }),
/* 84 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);
var Style = __webpack_require__(18);

var corefn = {

  style: function style(newStyle) {
    if (newStyle) {
      var s = this.setStyle(newStyle);

      s.update();
    }

    return this._private.style;
  },

  setStyle: function setStyle(style) {
    var _p = this._private;

    if (is.stylesheet(style)) {
      _p.style = style.generateStyle(this);
    } else if (is.array(style)) {
      _p.style = Style.fromJson(this, style);
    } else if (is.string(style)) {
      _p.style = Style.fromString(this, style);
    } else {
      _p.style = Style(this);
    }

    return _p.style;
  }
};

module.exports = corefn;

/***/ }),
/* 85 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);
var is = __webpack_require__(0);
var Promise = __webpack_require__(5);

var styfn = {};

// (potentially expensive calculation)
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
    } else {
      updatedEles.merge(ele);
    }

    var cxtStyle = self.getContextStyle(cxtMeta);
    var app = self.applyContextStyle(cxtMeta, cxtStyle, ele);

    if (!_p.newStyle) {
      self.updateTransitions(ele, app.diffProps);
    }

    self.updateStyleHints(ele);
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
    var oldHasCxt = oldCxtKey[i] === 't';
    var newHasCxt = newCxtKey[i] === 't';
    var cxtHasDiffed = oldHasCxt !== newHasCxt;
    var cxtHasMappedProps = cxt.mappedProperties.length > 0;

    if (cxtHasDiffed || cxtHasMappedProps) {
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
        var name = prop.name;

        // if a later context overrides this property, then the fact that this context has switched/diffed doesn't matter
        // (semi expensive check since it makes this function O(n^2) on context length, but worth it since overall result
        // is cached)
        var laterCxtOverrides = false;
        for (var k = i + 1; k < self.length; k++) {
          var laterCxt = self[k];
          var hasLaterCxt = newCxtKey[k] === 't';

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
  var diffProps = void 0;
  var prevKey = ele._private.styleCxtKey || '';

  if (self._private.newStyle) {
    prevKey = ''; // since we need to apply all style if a fresh stylesheet
  }

  // get the cxt key
  for (var i = 0; i < self.length; i++) {
    var context = self[i];
    var contextSelectorMatches = context.selector && context.selector.matches(ele); // NB: context.selector may be null for 'core'

    if (contextSelectorMatches) {
      cxtKey += 't';
    } else {
      cxtKey += 'f';
    }
  } // for context

  diffProps = self.getPropertiesDiff(prevKey, cxtKey);

  ele._private.styleCxtKey = cxtKey;

  return {
    key: cxtKey,
    diffPropNames: diffProps,
    empty: diffProps.length === 0
  };
};

// gets a computed ele style object based on matched contexts
styfn.getContextStyle = function (cxtMeta) {
  var cxtKey = cxtMeta.key;
  var self = this;
  var cxtStyles = this._private.contextStyles = this._private.contextStyles || {};

  // if already computed style, returned cached copy
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
    var hasCxt = cxtKey[i] === 't';

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
        cxtProp = { name: diffPropName, deleteBypassed: true };
      } else {
        cxtProp = { name: diffPropName, delete: true };
      }
    }

    // save cycles when the context prop doesn't need to be applied
    if (eleProp === cxtProp) {
      continue;
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

  if (ele.removed()) {
    return;
  }

  // set whether has pie or not; for greater efficiency
  var hasPie = false;
  if (_p.group === 'nodes') {
    for (var i = 1; i <= self.pieBackgroundN; i++) {
      // 1..N
      var _size = ele.pstyle('pie-' + i + '-background-size').value;

      if (_size > 0) {
        hasPie = true;
        break;
      }
    }
  }

  _p.hasPie = hasPie;

  var transform = ele.pstyle('text-transform').strValue;
  var content = ele.pstyle('label').strValue;
  var srcContent = ele.pstyle('source-label').strValue;
  var tgtContent = ele.pstyle('target-label').strValue;
  var fStyle = ele.pstyle('font-style').strValue;
  var size = ele.pstyle('font-size').pfValue + 'px';
  var family = ele.pstyle('font-family').strValue;
  // let letiant = style['font-letiant'].strValue;
  var weight = ele.pstyle('font-weight').strValue;
  var valign = ele.pstyle('text-valign').strValue;
  var halign = ele.pstyle('text-valign').strValue;
  var oWidth = ele.pstyle('text-outline-width').pfValue;
  var wrap = ele.pstyle('text-wrap').strValue;
  var wrapW = ele.pstyle('text-max-width').pfValue;
  var labelStyleKey = fStyle + '$' + size + '$' + family + '$' + weight + '$' + transform + '$' + valign + '$' + halign + '$' + oWidth + '$' + wrap + '$' + wrapW;
  _p.labelStyleKey = labelStyleKey;
  _p.sourceLabelKey = labelStyleKey + '$' + srcContent;
  _p.targetLabelKey = labelStyleKey + '$' + tgtContent;
  _p.labelKey = labelStyleKey + '$' + content;
  _p.fontKey = fStyle + '$' + weight + '$' + size + '$' + family;

  _p.styleKey = Date.now();
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
styfn.applyParsedProperty = function (ele, parsedProp) {
  var self = this;
  var prop = parsedProp;
  var style = ele._private.style;
  var fieldVal = void 0,
      flatProp = void 0;
  var types = self.types;
  var type = self.properties[prop.name].type;
  var propIsBypass = prop.bypass;
  var origProp = style[prop.name];
  var origPropIsBypass = origProp && origProp.bypass;
  var _p = ele._private;
  var flatPropMapping = 'mapping';

  var checkZOrder = function checkZOrder() {
    self.checkZOrderTrigger(ele, prop.name, origProp ? origProp.value : null, prop.value);
  };

  // edges connected to compound nodes can not be haystacks
  if (parsedProp.name === 'curve-style' && parsedProp.value === 'haystack' && ele.isEdge() && (ele.isLoop() || ele.source().isParent() || ele.target().isParent())) {
    prop = parsedProp = this.parse(parsedProp.name, 'bezier', propIsBypass);
  }

  if (prop.delete) {
    // delete the property and use the default value on falsey value
    style[prop.name] = undefined;

    checkZOrder();

    return true;
  }

  if (prop.deleteBypassed) {
    // delete the property that the
    if (!origProp) {
      checkZOrder();

      return true; // can't delete if no prop
    } else if (origProp.bypass) {
      // delete bypassed
      origProp.bypassed = undefined;

      checkZOrder();

      return true;
    } else {
      return false; // we're unsuccessful deleting the bypassed
    }
  }

  // check if we need to delete the current bypass
  if (prop.deleteBypass) {
    // then this property is just here to indicate we need to delete
    if (!origProp) {
      checkZOrder();

      return true; // property is already not defined
    } else if (origProp.bypass) {
      // then replace the bypass property with the original
      // because the bypassed property was already applied (and therefore parsed), we can just replace it (no reapplying necessary)
      style[prop.name] = origProp.bypassed;

      checkZOrder();

      return true;
    } else {
      return false; // we're unsuccessful deleting the bypass
    }
  }

  var printMappingErr = function printMappingErr() {
    util.error('Do not assign mappings to elements without corresponding data (e.g. ele `' + ele.id() + '` for property `' + prop.name + '` with data field `' + prop.field + '`); try a `[' + prop.field + ']` selector to limit scope to elements with `' + prop.field + '` defined');
  };

  // put the property in the style objects
  switch (prop.mapped) {// flatten the property if mapped
    case types.mapData:
      {
        // flatten the field (e.g. data.foo.bar)
        var fields = prop.field.split('.');
        var _fieldVal = _p.data;

        for (var i = 0; i < fields.length && _fieldVal; i++) {
          var field = fields[i];
          _fieldVal = _fieldVal[field];
        }

        var percent = void 0;
        if (!is.number(_fieldVal)) {
          // then keep the mapping but assume 0% for now
          percent = 0;
        } else {
          percent = (_fieldVal - prop.fieldMin) / (prop.fieldMax - prop.fieldMin);
        }

        // make sure to bound percent value
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

          flatProp = { // colours are simple, so just create the flat property instead of expensive string parsing
            bypass: prop.bypass, // we're a bypass if the mapping property is a bypass
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
          // if we can't flatten the property, then use the origProp so we still keep the mapping itself
          flatProp = this.parse(prop.name, origProp.strValue, prop.bypass, flatPropMapping);
        }

        if (!flatProp) {
          printMappingErr();
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
        var _fieldVal2 = _p.data;

        if (_fieldVal2) {
          for (var _i = 0; _i < _fields.length; _i++) {
            var _field = _fields[_i];
            _fieldVal2 = _fieldVal2[_field];
          }
        }

        flatProp = this.parse(prop.name, _fieldVal2, prop.bypass, flatPropMapping);

        if (!flatProp) {
          // if we can't flatten the property, then use the origProp so we still keep the mapping itself
          var flatPropVal = origProp ? origProp.strValue : '';

          flatProp = this.parse(prop.name, flatPropVal, prop.bypass, flatPropMapping);
        }

        if (!flatProp) {
          printMappingErr();
        }
        flatProp.mapping = prop; // keep a reference to the mapping
        prop = flatProp; // the flattened (mapped) property is the one we want

        break;
      }

    case types.fn:
      {
        var fn = prop.value;
        var fnRetVal = fn(ele);

        flatProp = this.parse(prop.name, fnRetVal, prop.bypass, flatPropMapping);
        flatProp.mapping = prop; // keep a reference to the mapping
        prop = flatProp; // the flattened (mapped) property is the one we want

        break;
      }

    case undefined:
      break; // just set the property

    default:
      return false; // not a valid mapping
  }

  // if the property is a bypass property, then link the resultant property to the original one
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

  checkZOrder();

  return true;
};

styfn.cleanElements = function (eles, keepBypasses) {
  var self = this;
  var props = self.properties;

  for (var i = 0; i < eles.length; i++) {
    var ele = eles[i];

    if (!keepBypasses) {
      ele._private.style = {};
    } else {
      var style = ele._private.style;

      for (var j = 0; j < props.length; j++) {
        var prop = props[j];
        var eleProp = style[prop.name];

        if (eleProp) {
          if (eleProp.bypass) {
            eleProp.bypassed = null;
          } else {
            style[prop.name] = null;
          }
        }
      }
    }
  }
};

// updates the visual style for all elements (useful for manual style modification after init)
styfn.update = function () {
  var cy = this._private.cy;
  var eles = cy.mutableElements();

  eles.updateStyle();
};

// just update the functional properties (i.e. mappings) in the elements'
// styles (less expensive than recalculation)
styfn.updateMappers = function (eles) {
  var self = this;
  var cy = this._private.cy;
  var updatedEles = cy.collection();

  for (var i = 0; i < eles.length; i++) {
    // for each ele
    var ele = eles[i];
    var style = ele._private.style;
    var updatedEle = false;

    for (var j = 0; j < self.properties.length; j++) {
      // for each prop
      var prop = self.properties[j];
      var propInStyle = style[prop.name];

      if (propInStyle && propInStyle.mapping) {
        var mapping = propInStyle.mapping;

        this.applyParsedProperty(ele, mapping); // reapply the mapping property

        updatedEle = true;
      }
    }

    if (updatedEle) {
      this.updateStyleHints(ele);

      updatedEles.merge(ele);
    }
  }

  return updatedEles;
};

// diffProps : { name => { prev, next } }
styfn.updateTransitions = function (ele, diffProps, isBypass) {
  var self = this;
  var _p = ele._private;
  var props = ele.pstyle('transition-property').value;
  var duration = ele.pstyle('transition-duration').pfValue;
  var delay = ele.pstyle('transition-delay').pfValue;

  if (props.length > 0 && duration > 0) {

    var style = {};

    // build up the style to animate towards
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
      }

      // consider px values
      if (is.number(fromProp.pfValue) && is.number(toProp.pfValue)) {
        diff = toProp.pfValue - fromProp.pfValue; // nonzero is truthy
        initVal = fromProp.pfValue + initDt * diff;

        // consider numerical values
      } else if (is.number(fromProp.value) && is.number(toProp.value)) {
        diff = toProp.value - fromProp.value; // nonzero is truthy
        initVal = fromProp.value + initDt * diff;

        // consider colour values
      } else if (is.array(fromProp.value) && is.array(toProp.value)) {
        diff = fromProp.value[0] !== toProp.value[0] || fromProp.value[1] !== toProp.value[1] || fromProp.value[2] !== toProp.value[2];

        initVal = fromProp.strValue;
      }

      // the previous value is good for an animation only if it's different
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

    new Promise(function (resolve) {
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
      ele.emitAndNotify('style');
      // }

      _p.transitioning = false;
    });
  } else if (_p.transitioning) {
    this.removeBypasses(ele, props);
    ele.emitAndNotify('style');

    _p.transitioning = false;
  }
};

styfn.checkZOrderTrigger = function (ele, name, fromValue, toValue) {
  var prop = this.properties[name];

  if (prop.triggersZOrder != null && (fromValue == null || prop.triggersZOrder(fromValue, toValue))) {
    this._private.cy.notify({
      type: 'zorder',
      eles: ele
    });
  }
};

module.exports = styfn;

/***/ }),
/* 86 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);
var util = __webpack_require__(1);

var styfn = {};

// bypasses are applied to an existing style on an element, and just tacked on temporarily
// returns true iff application was successful for at least 1 specified property
styfn.applyBypass = function (eles, name, value, updateTransitions) {
  var self = this;
  var props = [];
  var isBypass = true;

  // put all the properties (can specify one or many) in an array after parsing them
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
  } else if (is.string(name)) {
    // then parse the single property
    var _parsedProp = this.parse(name, value, true);

    if (_parsedProp) {
      props.push(_parsedProp);
    }
  } else if (is.plainObject(name)) {
    // then parse each property
    var specifiedProps = name;
    updateTransitions = value;

    var names = Object.keys(specifiedProps);

    for (var _i = 0; _i < names.length; _i++) {
      var _name2 = names[_i];
      var _prop = self.properties[_name2];
      var _value = specifiedProps[_name2];

      if (_value === undefined) {
        // try camel case name too
        _value = specifiedProps[util.dash2camel(_name2)];
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
  }

  // we've failed if there are no valid properties
  if (props.length === 0) {
    return false;
  }

  // now, apply the bypass properties on the elements
  var ret = false; // return true if at least one succesful bypass applied
  for (var _i2 = 0; _i2 < eles.length; _i2++) {
    // for each ele
    var ele = eles[_i2];
    var diffProps = {};
    var diffProp = void 0;

    for (var j = 0; j < props.length; j++) {
      // for each prop
      var _prop2 = props[j];

      if (updateTransitions) {
        var prevProp = ele.pstyle(_prop2.name);
        diffProp = diffProps[_prop2.name] = { prev: prevProp };
      }

      ret = this.applyParsedProperty(ele, _prop2) || ret;

      if (updateTransitions) {
        diffProp.next = ele.pstyle(_prop2.name);
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
};

// only useful in specific cases like animation
styfn.overrideBypass = function (eles, name, value) {
  name = util.camel2dash(name);

  for (var i = 0; i < eles.length; i++) {
    var ele = eles[i];
    var prop = ele._private.style[name];
    var type = this.properties[name].type;
    var isColor = type.color;
    var isMulti = type.mutiple;

    if (!prop || !prop.bypass) {
      // need a bypass if one doesn't exist
      this.applyBypass(ele, name, value);
      continue;
    }

    var oldValue = prop.pfValue != null ? prop.pfValue : prop.value;

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

    this.checkZOrderTrigger(ele, name, oldValue, value);
  }
};

styfn.removeAllBypasses = function (eles, updateTransitions) {
  return this.removeBypasses(eles, this.propertyNames, updateTransitions);
};

styfn.removeBypasses = function (eles, props, updateTransitions) {
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
      var diffProp = diffProps[prop.name] = { prev: prevProp };

      this.applyParsedProperty(ele, parsedProp);

      diffProp.next = ele.pstyle(prop.name);
    } // for props

    this.updateStyleHints(ele);

    if (updateTransitions) {
      this.updateTransitions(ele, diffProps, isBypass);
    }
  } // for eles
};

module.exports = styfn;

/***/ }),
/* 87 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var window = __webpack_require__(3);

var styfn = {};

// gets what an em size corresponds to in pixels relative to a dom element
styfn.getEmSizeInPixels = function () {
  var px = this.containerCss('font-size');

  if (px != null) {
    return parseFloat(px);
  } else {
    return 1; // for headless
  }
};

// gets css property from the core container
styfn.containerCss = function (propName) {
  var cy = this._private.cy;
  var domElement = cy.container();

  if (window && domElement && window.getComputedStyle) {
    return window.getComputedStyle(domElement).getPropertyValue(propName);
  }
};

module.exports = styfn;

/***/ }),
/* 88 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);
var is = __webpack_require__(0);

var styfn = {};

// gets the rendered style for an element
styfn.getRenderedStyle = function (ele, prop) {
  if (prop) {
    return this.getStylePropertyValue(ele, prop, true);
  } else {
    return this.getRawStyle(ele, true);
  }
};

// gets the raw style for an element
styfn.getRawStyle = function (ele, isRenderedVal) {
  var self = this;

  ele = ele[0]; // insure it's an element

  if (ele) {
    var rstyle = {};

    for (var i = 0; i < self.properties.length; i++) {
      var prop = self.properties[i];
      var val = self.getStylePropertyValue(ele, prop.name, isRenderedVal);

      if (val != null) {
        rstyle[prop.name] = val;
        rstyle[util.dash2camel(prop.name)] = val;
      }
    }

    return rstyle;
  }
};

styfn.getIndexedStyle = function (ele, property, subproperty, index) {
  var pstyle = ele.pstyle(property)[subproperty][index];
  return pstyle != null ? pstyle : ele.cy().style().getDefaultProperty(property)[subproperty][0];
};

styfn.getStylePropertyValue = function (ele, propName, isRenderedVal) {
  var self = this;

  ele = ele[0]; // insure it's an element

  if (ele) {
    var prop = self.properties[propName];

    if (prop.alias) {
      prop = prop.pointsTo;
    }

    var type = prop.type;
    var styleProp = ele.pstyle(prop.name);
    var zoom = ele.cy().zoom();

    if (styleProp) {
      var units = styleProp.units ? type.implicitUnits || 'px' : null;
      var val = units ? [].concat(styleProp.pfValue).map(function (pfValue) {
        return pfValue * (isRenderedVal ? zoom : 1) + units;
      }).join(' ') : styleProp.strValue;

      return val;
    }
  }
};

styfn.getAnimationStartStyle = function (ele, aniProps) {
  var rstyle = {};

  for (var i = 0; i < aniProps.length; i++) {
    var aniProp = aniProps[i];
    var name = aniProp.name;

    var styleProp = ele.pstyle(name);

    if (styleProp !== undefined) {
      // then make a prop of it
      if (is.plainObject(styleProp)) {
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

styfn.getPropsList = function (propsObj) {
  var self = this;
  var rstyle = [];
  var style = propsObj;
  var props = self.properties;

  if (style) {
    var names = Object.keys(style);

    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      var val = style[name];
      var prop = props[name] || props[util.camel2dash(name)];
      var styleProp = this.parse(prop.name, val);

      if (styleProp) {
        rstyle.push(styleProp);
      }
    }
  }

  return rstyle;
};

module.exports = styfn;

/***/ }),
/* 89 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var styfn = {};

styfn.appendFromJson = function (json) {
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
};

// accessible cy.style() function
styfn.fromJson = function (json) {
  var style = this;

  style.resetToDefault();
  style.appendFromJson(json);

  return style;
};

// get json from cy.style() api
styfn.json = function () {
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

module.exports = styfn;

/***/ }),
/* 90 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);
var Selector = __webpack_require__(6);

var styfn = {};

styfn.appendFromString = function (string) {
  var self = this;
  var style = this;
  var remaining = '' + string;
  var selAndBlockStr = void 0;
  var blockRem = void 0;
  var propAndValStr = void 0;

  // remove comments from the style string
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

  while (true) {
    var nothingLeftToParse = remaining.match(/^\s*$/);
    if (nothingLeftToParse) {
      break;
    }

    var selAndBlock = remaining.match(/^\s*((?:.|\s)+?)\s*\{((?:.|\s)+?)\}/);

    if (!selAndBlock) {
      util.error('Halting stylesheet parsing: String stylesheet contains more to parse but no selector and block found in: ' + remaining);
      break;
    }

    selAndBlockStr = selAndBlock[0];

    // parse the selector
    var selectorStr = selAndBlock[1];
    if (selectorStr !== 'core') {
      var selector = new Selector(selectorStr);
      if (selector._private.invalid) {
        util.error('Skipping parsing of block: Invalid selector found in string stylesheet: ' + selectorStr);

        // skip this selector and block
        removeSelAndBlockFromRemaining();
        continue;
      }
    }

    // parse the block of properties and values
    var blockStr = selAndBlock[2];
    var invalidBlock = false;
    blockRem = blockStr;
    var props = [];

    while (true) {
      var _nothingLeftToParse = blockRem.match(/^\s*$/);
      if (_nothingLeftToParse) {
        break;
      }

      var propAndVal = blockRem.match(/^\s*(.+?)\s*:\s*(.+?)\s*;/);

      if (!propAndVal) {
        util.error('Skipping parsing of block: Invalid formatting of style property and value definitions found in:' + blockStr);
        invalidBlock = true;
        break;
      }

      propAndValStr = propAndVal[0];
      var propStr = propAndVal[1];
      var valStr = propAndVal[2];

      var prop = self.properties[propStr];
      if (!prop) {
        util.error('Skipping property: Invalid property name in: ' + propAndValStr);

        // skip this property in the block
        removePropAndValFromRem();
        continue;
      }

      var parsedProp = style.parse(propStr, valStr);

      if (!parsedProp) {
        util.error('Skipping property: Invalid property definition in: ' + propAndValStr);

        // skip this property in the block
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
    }

    // put the parsed block in the style
    style.selector(selectorStr);
    for (var i = 0; i < props.length; i++) {
      var _prop = props[i];
      style.css(_prop.name, _prop.val);
    }

    removeSelAndBlockFromRemaining();
  }

  return style;
};

styfn.fromString = function (string) {
  var style = this;

  style.resetToDefault();
  style.appendFromString(string);

  return style;
};

module.exports = styfn;

/***/ }),
/* 91 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);
var is = __webpack_require__(0);

var styfn = {};

(function () {
  var number = util.regex.number;
  var rgba = util.regex.rgbaNoBackRefs;
  var hsla = util.regex.hslaNoBackRefs;
  var hex3 = util.regex.hex3;
  var hex6 = util.regex.hex6;
  var data = function data(prefix) {
    return '^' + prefix + '\\s*\\(\\s*([\\w\\.]+)\\s*\\)$';
  };
  var mapData = function mapData(prefix) {
    var mapArg = number + '|\\w+|' + rgba + '|' + hsla + '|' + hex3 + '|' + hex6;
    return '^' + prefix + '\\s*\\(([\\w\\.]+)\\s*\\,\\s*(' + number + ')\\s*\\,\\s*(' + number + ')\\s*,\\s*(' + mapArg + ')\\s*\\,\\s*(' + mapArg + ')\\)$';
  };
  var urlRegexes = ['^url\\s*\\(\\s*[\'"]?(.+?)[\'"]?\\s*\\)$', '^(none)$', '^(.+)$'];

  // each visual style property has a type and needs to be validated according to it
  styfn.types = {
    time: { number: true, min: 0, units: 's|ms', implicitUnits: 'ms' },
    percent: { number: true, min: 0, max: 100, units: '%', implicitUnits: '%' },
    zeroOneNumber: { number: true, min: 0, max: 1, unitless: true },
    zeroOneNumbers: { number: true, min: 0, max: 1, unitless: true, multiple: true },
    nOneOneNumber: { number: true, min: -1, max: 1, unitless: true },
    nonNegativeInt: { number: true, min: 0, integer: true, unitless: true },
    position: { enums: ['parent', 'origin'] },
    nodeSize: { number: true, min: 0, enums: ['label'] },
    number: { number: true, unitless: true },
    numbers: { number: true, unitless: true, multiple: true },
    positiveNumber: { number: true, unitless: true, min: 0, strictMin: true },
    size: { number: true, min: 0 },
    bidirectionalSize: { number: true }, // allows negative
    bidirectionalSizes: { number: true, multiple: true }, // allows negative
    sizeMaybePercent: { number: true, min: 0, allowPercent: true },
    paddingRelativeTo: { enums: ['width', 'height', 'average', 'min', 'max'] },
    bgWH: { number: true, min: 0, allowPercent: true, enums: ['auto'], multiple: true },
    bgPos: { number: true, allowPercent: true, multiple: true },
    bgRelativeTo: { enums: ['inner', 'include-padding'], multiple: true },
    bgRepeat: { enums: ['repeat', 'repeat-x', 'repeat-y', 'no-repeat'], multiple: true },
    bgFit: { enums: ['none', 'contain', 'cover'], multiple: true },
    bgCrossOrigin: { enums: ['anonymous', 'use-credentials'], multiple: true },
    bgClip: { enums: ['none', 'node'] },
    color: { color: true },
    bool: { enums: ['yes', 'no'] },
    lineStyle: { enums: ['solid', 'dotted', 'dashed'] },
    borderStyle: { enums: ['solid', 'dotted', 'dashed', 'double'] },
    curveStyle: { enums: ['bezier', 'unbundled-bezier', 'haystack', 'segments'] },
    fontFamily: { regex: '^([\\w- \\"]+(?:\\s*,\\s*[\\w- \\"]+)*)$' },
    fontletiant: { enums: ['small-caps', 'normal'] },
    fontStyle: { enums: ['italic', 'normal', 'oblique'] },
    fontWeight: { enums: ['normal', 'bold', 'bolder', 'lighter', '100', '200', '300', '400', '500', '600', '800', '900', 100, 200, 300, 400, 500, 600, 700, 800, 900] },
    textDecoration: { enums: ['none', 'underline', 'overline', 'line-through'] },
    textTransform: { enums: ['none', 'uppercase', 'lowercase'] },
    textWrap: { enums: ['none', 'wrap', 'ellipsis'] },
    textBackgroundShape: { enums: ['rectangle', 'roundrectangle'] },
    nodeShape: { enums: ['rectangle', 'roundrectangle', 'cutrectangle', 'bottomroundrectangle', 'barrel', 'ellipse', 'triangle', 'square', 'pentagon', 'hexagon', 'concavehexagon', 'heptagon', 'octagon', 'tag', 'star', 'diamond', 'vee', 'rhomboid', 'polygon'] },
    compoundIncludeLabels: { enums: ['include', 'exclude'] },
    arrowShape: { enums: ['tee', 'triangle', 'triangle-tee', 'triangle-cross', 'triangle-backcurve', 'half-triangle-overshot', 'vee', 'square', 'circle', 'diamond', 'none'] },
    arrowFill: { enums: ['filled', 'hollow'] },
    display: { enums: ['element', 'none'] },
    visibility: { enums: ['hidden', 'visible'] },
    zCompoundDepth: { enums: ['bottom', 'orphan', 'auto', 'top'] },
    zIndexCompare: { enums: ['auto', 'manual'] },
    valign: { enums: ['top', 'center', 'bottom'] },
    halign: { enums: ['left', 'center', 'right'] },
    text: { string: true },
    data: { mapping: true, regex: data('data') },
    layoutData: { mapping: true, regex: data('layoutData') },
    scratch: { mapping: true, regex: data('scratch') },
    mapData: { mapping: true, regex: mapData('mapData') },
    mapLayoutData: { mapping: true, regex: mapData('mapLayoutData') },
    mapScratch: { mapping: true, regex: mapData('mapScratch') },
    fn: { mapping: true, fn: true },
    url: { regexes: urlRegexes, singleRegexMatchValue: true },
    urls: { regexes: urlRegexes, singleRegexMatchValue: true, multiple: true },
    propList: { propList: true },
    angle: { number: true, units: 'deg|rad', implicitUnits: 'rad' },
    textRotation: { number: true, units: 'deg|rad', implicitUnits: 'rad', enums: ['none', 'autorotate'] },
    polygonPointList: { number: true, multiple: true, evenMultiple: true, min: -1, max: 1, unitless: true },
    edgeDistances: { enums: ['intersection', 'node-position'] },
    edgeEndpoint: {
      number: true, multiple: true, units: '%|px|em|deg|rad', implicitUnits: 'px',
      enums: ['inside-to-node', 'outside-to-node', 'outside-to-line'], singleEnum: true,
      validate: function validate(valArr, unitsArr) {
        switch (valArr.length) {
          case 2:
            // can be % or px only
            return unitsArr[0] !== 'deg' && unitsArr[0] !== 'rad' && unitsArr[1] !== 'deg' && unitsArr[1] !== 'rad';
          case 1:
            // can be enum, deg, or rad only
            return is.string(valArr[0]) || unitsArr[0] === 'deg' || unitsArr[0] === 'rad';
          default:
            return false;
        }
      }
    },
    easing: {
      regexes: ['^(spring)\\s*\\(\\s*(' + number + ')\\s*,\\s*(' + number + ')\\s*\\)$', '^(cubic-bezier)\\s*\\(\\s*(' + number + ')\\s*,\\s*(' + number + ')\\s*,\\s*(' + number + ')\\s*,\\s*(' + number + ')\\s*\\)$'],
      enums: ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'ease-in-sine', 'ease-out-sine', 'ease-in-out-sine', 'ease-in-quad', 'ease-out-quad', 'ease-in-out-quad', 'ease-in-cubic', 'ease-out-cubic', 'ease-in-out-cubic', 'ease-in-quart', 'ease-out-quart', 'ease-in-out-quart', 'ease-in-quint', 'ease-out-quint', 'ease-in-out-quint', 'ease-in-expo', 'ease-out-expo', 'ease-in-out-expo', 'ease-in-circ', 'ease-out-circ', 'ease-in-out-circ']
    }
  };

  var zOrderDiff = {
    zeroNonZero: function zeroNonZero(val1, val2) {
      if (val1 === 0 && val2 !== 0) {
        return true;
      } else if (val1 !== 0 && val2 === 0) {
        return true;
      } else {
        return false;
      }
    },
    anyDiff: function anyDiff(val1, val2) {
      return val1 !== val2;
    }
  };

  var zd = zOrderDiff;

  // define visual style properties
  var t = styfn.types;
  var props = styfn.properties = [
  // main label
  { name: 'label', type: t.text }, { name: 'text-rotation', type: t.textRotation }, { name: 'text-margin-x', type: t.bidirectionalSize }, { name: 'text-margin-y', type: t.bidirectionalSize },

  // source label
  { name: 'source-label', type: t.text }, { name: 'source-text-rotation', type: t.textRotation }, { name: 'source-text-margin-x', type: t.bidirectionalSize }, { name: 'source-text-margin-y', type: t.bidirectionalSize }, { name: 'source-text-offset', type: t.size },

  // target label
  { name: 'target-label', type: t.text }, { name: 'target-text-rotation', type: t.textRotation }, { name: 'target-text-margin-x', type: t.bidirectionalSize }, { name: 'target-text-margin-y', type: t.bidirectionalSize }, { name: 'target-text-offset', type: t.size },

  // common label style
  { name: 'text-valign', type: t.valign }, { name: 'text-halign', type: t.halign }, { name: 'color', type: t.color }, { name: 'text-outline-color', type: t.color }, { name: 'text-outline-width', type: t.size }, { name: 'text-outline-opacity', type: t.zeroOneNumber }, { name: 'text-opacity', type: t.zeroOneNumber }, { name: 'text-background-color', type: t.color }, { name: 'text-background-opacity', type: t.zeroOneNumber }, { name: 'text-background-padding', type: t.size }, { name: 'text-border-opacity', type: t.zeroOneNumber }, { name: 'text-border-color', type: t.color }, { name: 'text-border-width', type: t.size }, { name: 'text-border-style', type: t.borderStyle }, { name: 'text-background-shape', type: t.textBackgroundShape },
  // { name: 'text-decoration', type: t.textDecoration }, // not supported in canvas
  { name: 'text-transform', type: t.textTransform }, { name: 'text-wrap', type: t.textWrap }, { name: 'text-max-width', type: t.size }, { name: 'text-events', type: t.bool }, { name: 'font-family', type: t.fontFamily }, { name: 'font-style', type: t.fontStyle },
  // { name: 'font-letiant', type: t.fontletiant }, // not useful
  { name: 'font-weight', type: t.fontWeight }, { name: 'font-size', type: t.size }, { name: 'min-zoomed-font-size', type: t.size },

  // behaviour
  { name: 'events', type: t.bool },

  // visibility
  { name: 'display', type: t.display, triggersZOrder: zd.anyDiff }, { name: 'visibility', type: t.visibility, triggersZOrder: zd.anyDiff }, { name: 'opacity', type: t.zeroOneNumber, triggersZOrder: zd.zeroNonZero }, { name: 'z-compound-depth', type: t.zCompoundDepth, triggersZOrder: zd.anyDiff }, { name: 'z-index-compare', type: t.zIndexCompare, triggersZOrder: zd.anyDiff }, { name: 'z-index', type: t.nonNegativeInt, triggersZOrder: zd.anyDiff },

  // overlays
  { name: 'overlay-padding', type: t.size }, { name: 'overlay-color', type: t.color }, { name: 'overlay-opacity', type: t.zeroOneNumber },

  // transition anis
  { name: 'transition-property', type: t.propList }, { name: 'transition-duration', type: t.time }, { name: 'transition-delay', type: t.time }, { name: 'transition-timing-function', type: t.easing },

  // node body
  { name: 'height', type: t.nodeSize }, { name: 'width', type: t.nodeSize }, { name: 'shape', type: t.nodeShape }, { name: 'shape-polygon-points', type: t.polygonPointList }, { name: 'background-color', type: t.color }, { name: 'background-opacity', type: t.zeroOneNumber }, { name: 'background-blacken', type: t.nOneOneNumber }, { name: 'padding', type: t.sizeMaybePercent }, { name: 'padding-relative-to', type: t.paddingRelativeTo },

  // node border
  { name: 'border-color', type: t.color }, { name: 'border-opacity', type: t.zeroOneNumber }, { name: 'border-width', type: t.size }, { name: 'border-style', type: t.borderStyle },

  // node background images
  { name: 'background-image', type: t.urls }, { name: 'background-image-crossorigin', type: t.bgCrossOrigin }, { name: 'background-image-opacity', type: t.zeroOneNumbers }, { name: 'background-position-x', type: t.bgPos }, { name: 'background-position-y', type: t.bgPos }, { name: 'background-width-relative-to', type: t.bgRelativeTo }, { name: 'background-height-relative-to', type: t.bgRelativeTo }, { name: 'background-repeat', type: t.bgRepeat }, { name: 'background-fit', type: t.bgFit }, { name: 'background-clip', type: t.bgClip }, { name: 'background-width', type: t.bgWH }, { name: 'background-height', type: t.bgWH },

  // compound props
  { name: 'position', type: t.position }, { name: 'compound-sizing-wrt-labels', type: t.compoundIncludeLabels }, { name: 'min-width', type: t.size }, { name: 'min-width-bias-left', type: t.sizeMaybePercent }, { name: 'min-width-bias-right', type: t.sizeMaybePercent }, { name: 'min-height', type: t.size }, { name: 'min-height-bias-top', type: t.sizeMaybePercent }, { name: 'min-height-bias-bottom', type: t.sizeMaybePercent },

  // edge line
  { name: 'line-style', type: t.lineStyle }, { name: 'line-color', type: t.color }, { name: 'curve-style', type: t.curveStyle }, { name: 'haystack-radius', type: t.zeroOneNumber }, { name: 'source-endpoint', type: t.edgeEndpoint }, { name: 'target-endpoint', type: t.edgeEndpoint }, { name: 'control-point-step-size', type: t.size }, { name: 'control-point-distances', type: t.bidirectionalSizes }, { name: 'control-point-weights', type: t.numbers }, { name: 'segment-distances', type: t.bidirectionalSizes }, { name: 'segment-weights', type: t.numbers }, { name: 'edge-distances', type: t.edgeDistances }, { name: 'arrow-scale', type: t.positiveNumber }, { name: 'loop-direction', type: t.angle }, { name: 'loop-sweep', type: t.angle }, { name: 'source-distance-from-node', type: t.size }, { name: 'target-distance-from-node', type: t.size },

  // ghost properties
  { name: 'ghost', type: t.bool }, { name: 'ghost-offset-x', type: t.bidirectionalSize }, { name: 'ghost-offset-y', type: t.bidirectionalSize }, { name: 'ghost-opacity', type: t.zeroOneNumber },

  // these are just for the core
  { name: 'selection-box-color', type: t.color }, { name: 'selection-box-opacity', type: t.zeroOneNumber }, { name: 'selection-box-border-color', type: t.color }, { name: 'selection-box-border-width', type: t.size }, { name: 'active-bg-color', type: t.color }, { name: 'active-bg-opacity', type: t.zeroOneNumber }, { name: 'active-bg-size', type: t.size }, { name: 'outside-texture-bg-color', type: t.color }, { name: 'outside-texture-bg-opacity', type: t.zeroOneNumber }];

  // define aliases
  var aliases = styfn.aliases = [{ name: 'content', pointsTo: 'label' }, { name: 'control-point-distance', pointsTo: 'control-point-distances' }, { name: 'control-point-weight', pointsTo: 'control-point-weights' }, { name: 'edge-text-rotation', pointsTo: 'text-rotation' }, { name: 'padding-left', pointsTo: 'padding' }, { name: 'padding-right', pointsTo: 'padding' }, { name: 'padding-top', pointsTo: 'padding' }, { name: 'padding-bottom', pointsTo: 'padding' }];

  // pie backgrounds for nodes
  styfn.pieBackgroundN = 16; // because the pie properties are numbered, give access to a constant N (for renderer use)
  props.push({ name: 'pie-size', type: t.sizeMaybePercent });
  for (var i = 1; i <= styfn.pieBackgroundN; i++) {
    props.push({ name: 'pie-' + i + '-background-color', type: t.color });
    props.push({ name: 'pie-' + i + '-background-size', type: t.percent });
    props.push({ name: 'pie-' + i + '-background-opacity', type: t.zeroOneNumber });
  }

  // edge arrows
  var arrowPrefixes = styfn.arrowPrefixes = ['source', 'mid-source', 'target', 'mid-target'];
  [{ name: 'arrow-shape', type: t.arrowShape }, { name: 'arrow-color', type: t.color }, { name: 'arrow-fill', type: t.arrowFill }].forEach(function (prop) {
    arrowPrefixes.forEach(function (prefix) {
      var name = prefix + '-' + prop.name;
      var type = prop.type;

      props.push({ name: name, type: type });
    });
  }, {});

  // list of property names
  styfn.propertyNames = props.map(function (p) {
    return p.name;
  });

  // allow access of properties by name ( e.g. style.properties.height )
  for (var _i = 0; _i < props.length; _i++) {
    var prop = props[_i];

    props[prop.name] = prop; // allow lookup by name
  }

  // map aliases
  for (var _i2 = 0; _i2 < aliases.length; _i2++) {
    var alias = aliases[_i2];
    var pointsToProp = props[alias.pointsTo];
    var aliasProp = {
      name: alias.name,
      alias: true,
      pointsTo: pointsToProp
    };

    // add alias prop for parsing
    props.push(aliasProp);

    props[alias.name] = aliasProp; // allow lookup by name
  }
})();

styfn.getDefaultProperty = function (name) {
  return this.getDefaultProperties()[name];
};

styfn.getDefaultProperties = util.memoize(function () {
  var rawProps = util.extend({
    // common node/edge props
    'events': 'yes',
    'text-events': 'no',
    'text-valign': 'top',
    'text-halign': 'center',
    'color': '#000',
    'text-outline-color': '#000',
    'text-outline-width': 0,
    'text-outline-opacity': 1,
    'text-opacity': 1,
    'text-decoration': 'none',
    'text-transform': 'none',
    'text-wrap': 'none',
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
    // 'font-letiant': fontletiant,
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
    'background-opacity': 1,
    'background-image': 'none',
    'background-image-crossorigin': 'anonymous',
    'background-image-opacity': 1,
    'background-position-x': '50%',
    'background-position-y': '50%',
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
  }, [{ name: 'pie-{{i}}-background-color', value: 'black' }, { name: 'pie-{{i}}-background-size', value: '0%' }, { name: 'pie-{{i}}-background-opacity', value: 1 }].reduce(function (css, prop) {
    for (var i = 1; i <= styfn.pieBackgroundN; i++) {
      var name = prop.name.replace('{{i}}', i);
      var val = prop.value;

      css[name] = val;
    }

    return css;
  }, {}), {
    // edge props
    'line-style': 'solid',
    'line-color': '#999',
    'control-point-step-size': 40,
    'control-point-weights': 0.5,
    'segment-weights': 0.5,
    'segment-distances': 20,
    'edge-distances': 'intersection',
    'curve-style': 'bezier',
    'haystack-radius': 0,
    'arrow-scale': 1,
    'loop-direction': '-45deg',
    'loop-sweep': '-90deg',
    'source-distance-from-node': 0,
    'target-distance-from-node': 0,
    'source-endpoint': 'outside-to-node',
    'target-endpoint': 'outside-to-node'
  }, [{ name: 'arrow-shape', value: 'none' }, { name: 'arrow-color', value: '#999' }, { name: 'arrow-fill', value: 'filled' }].reduce(function (css, prop) {
    styfn.arrowPrefixes.forEach(function (prefix) {
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

  return parsedProps;
});

styfn.addDefaultStylesheet = function () {
  this.selector('$node > node') // compound (parent) node properties
  .css({
    'shape': 'rectangle',
    'padding': 10,
    'background-color': '#eee',
    'border-color': '#ccc',
    'border-width': 1
  }).selector('edge') // just edge properties
  .css({
    'width': 3,
    'curve-style': 'haystack'
  }).selector(':parent <-> node').css({
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
  }).selector('node:parent:selected').css({
    'background-color': '#CCE1F9',
    'border-color': '#aec8e5'
  }).selector(':active').css({
    'overlay-color': 'black',
    'overlay-padding': 10,
    'overlay-opacity': 0.25
  }).selector('core') // just core properties
  .css({
    'selection-box-color': '#ddd',
    'selection-box-opacity': 0.65,
    'selection-box-border-color': '#aaa',
    'selection-box-border-width': 1,
    'active-bg-color': 'black',
    'active-bg-opacity': 0.15,
    'active-bg-size': 30,
    'outside-texture-bg-color': '#000',
    'outside-texture-bg-opacity': 0.125
  });

  this.defaultLength = this.length;
};

module.exports = styfn;

/***/ }),
/* 92 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);
var is = __webpack_require__(0);
var math = __webpack_require__(2);

var styfn = {};

// a caching layer for property parsing
styfn.parse = function (name, value, propIsBypass, propIsFlat) {
  var self = this;

  // function values can't be cached in all cases, and there isn't much benefit of caching them anyway
  if (is.fn(value)) {
    return self.parseImplWarn(name, value, propIsBypass, propIsFlat);
  }

  var flatKey = propIsFlat === 'mapping' || propIsFlat === true || propIsFlat === false || propIsFlat == null ? 'dontcare' : propIsFlat;
  var argHash = [name, value, propIsBypass, flatKey].join('$');
  var propCache = self.propCache = self.propCache || {};
  var ret = void 0;

  if (!(ret = propCache[argHash])) {
    ret = propCache[argHash] = self.parseImplWarn(name, value, propIsBypass, propIsFlat);
  }

  // - bypasses can't be shared b/c the value can be changed by animations or otherwise overridden
  // - mappings can't be shared b/c mappings are per-element
  if (propIsBypass || propIsFlat === 'mapping') {
    // need a copy since props are mutated later in their lifecycles
    ret = util.copy(ret);

    if (ret) {
      ret.value = util.copy(ret.value); // because it could be an array, e.g. colour
    }
  }

  return ret;
};

styfn.parseImplWarn = function (name, value, propIsBypass, propIsFlat) {
  var prop = this.parseImpl(name, value, propIsBypass, propIsFlat);

  if (!prop && value != null) {
    util.error('The style property `%s: %s` is invalid', name, value);
  }

  return prop;
};

// parse a property; return null on invalid; return parsed property otherwise
// fields :
// - name : the name of the property
// - value : the parsed, native-typed value of the property
// - strValue : a string value that represents the property value in valid css
// - bypass : true iff the property is a bypass property
styfn.parseImpl = function (name, value, propIsBypass, propIsFlat) {
  var self = this;

  name = util.camel2dash(name); // make sure the property name is in dash form (e.g. 'property-name' not 'propertyName')

  var property = self.properties[name];
  var passedValue = value;
  var types = self.types;

  if (!property) {
    return null;
  } // return null on property of unknown name
  if (value === undefined || value === null) {
    return null;
  } // can't assign null

  // the property may be an alias
  if (property.alias) {
    property = property.pointsTo;
    name = property.name;
  }

  var valueIsString = is.string(value);
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
  }

  // check if value is a function used as a mapper
  if (is.fn(value)) {
    return {
      name: name,
      value: value,
      strValue: 'fn',
      mapped: types.fn,
      bypass: propIsBypass
    };
  }

  // check if value is mapped
  var data = void 0,
      mapData = void 0;
  if (!valueIsString || propIsFlat) {
    // then don't bother to do the expensive regex checks

  } else if (data = new RegExp(types.data.regex).exec(value)) {
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
  } else if (mapData = new RegExp(types.mapData.regex).exec(value)) {
    if (propIsBypass) {
      return false;
    } // mappers not allowed in bypass
    if (type.multiple) {
      return false;
    } // impossible to map to num

    var _mapped = types.mapData;

    // we can map only if the type is a colour or a number
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
    if (valueMin.value === valueMax.value) {
      return false; // can't make much of a mapper without a range
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
      fieldMin: parseFloat(mapData[2]), // min & max are numeric
      fieldMax: parseFloat(mapData[3]),
      valueMin: valueMin.value,
      valueMax: valueMax.value,
      bypass: propIsBypass
    };
  }

  if (type.multiple && propIsFlat !== 'multiple') {
    var vals = void 0;

    if (valueIsString) {
      vals = value.split(/\s+/);
    } else if (is.array(value)) {
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
    var hasEnum = false;

    for (var i = 0; i < vals.length; i++) {
      var p = self.parse(name, vals[i], propIsBypass, 'multiple');

      hasEnum = hasEnum || is.string(p.value);

      valArr.push(p.value);
      pfValArr.push(p.pfValue != null ? p.pfValue : p.value);
      unitsArr.push(p.units);
    }

    if (type.validate && !type.validate(valArr, unitsArr)) {
      return null;
    }

    if (type.singleEnum && hasEnum) {
      if (valArr.length === 1 && is.string(valArr[0])) {
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
      strValue: valArr.join(' '),
      bypass: propIsBypass,
      units: unitsArr
    };
  }

  // several types also allow enums
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
  };

  // check the type and return the appropriate object
  if (type.number) {
    var units = void 0;
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
        var match = value.match('^(' + util.regex.number + ')(' + unitsRegex + ')?' + '$');

        if (match) {
          value = match[1];
          units = match[2] || implicitUnits;
        }
      } else if (!units || type.implicitUnits) {
        units = implicitUnits; // implicitly px if unspecified
      }
    }

    value = parseFloat(value);

    // if not a number and enums not allowed, then the value is invalid
    if (isNaN(value) && type.enums === undefined) {
      return null;
    }

    // check if this number type also accepts special keywords in place of numbers
    // (i.e. `left`, `auto`, etc)
    if (isNaN(value) && type.enums !== undefined) {
      value = passedValue;

      return checkEnums();
    }

    // check if value must be an integer
    if (type.integer && !is.integer(value)) {
      return null;
    }

    // check value is within range
    if (type.min !== undefined && (value < type.min || type.strictMin && value === type.min) || type.max !== undefined && (value > type.max || type.strictMax && value === type.max)) {
      return null;
    }

    var ret = {
      name: name,
      value: value,
      strValue: '' + value + (units ? units : ''),
      units: units,
      bypass: propIsBypass
    };

    // normalise value in pixels
    if (type.unitless || units !== 'px' && units !== 'em') {
      ret.pfValue = value;
    } else {
      ret.pfValue = units === 'px' || !units ? value : this.getEmSizeInPixels() * value;
    }

    // normalise value in ms
    if (units === 'ms' || units === 's') {
      ret.pfValue = units === 'ms' ? value : 1000 * value;
    }

    // normalise value in rad
    if (units === 'deg' || units === 'rad') {
      ret.pfValue = units === 'rad' ? value : math.deg2rad(value);
    }

    // normalize value in %
    if (units === '%') {
      ret.pfValue = value / 100;
    }

    return ret;
  } else if (type.propList) {

    var props = [];
    var propsStr = '' + value;

    if (propsStr === 'none') {
      // leave empty

    } else {
      // go over each prop

      var propsSplit = propsStr.split(',');
      for (var _i2 = 0; _i2 < propsSplit.length; _i2++) {
        var propName = propsSplit[_i2].trim();

        if (self.properties[propName]) {
          props.push(propName);
        }
      }

      if (props.length === 0) {
        return null;
      }
    }

    return {
      name: name,
      value: props,
      strValue: props.length === 0 ? 'none' : props.join(', '),
      bypass: propIsBypass
    };
  } else if (type.color) {
    var tuple = util.color2tuple(value);

    if (!tuple) {
      return null;
    }

    return {
      name: name,
      value: tuple,
      pfValue: tuple,
      strValue: '' + value,
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

module.exports = styfn;

/***/ }),
/* 93 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);
var window = __webpack_require__(3);
var math = __webpack_require__(2);

var corefn = {

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
    var dim = void 0,
        val = void 0,
        dims = void 0,
        x = void 0,
        y = void 0;

    switch (args.length) {
      case 0:
        // .pan()
        return pan;

      case 1:

        if (is.string(args[0])) {
          // .pan('x')
          dim = args[0];
          return pan[dim];
        } else if (is.plainObject(args[0])) {
          // .pan({ x: 0, y: 100 })
          if (!this._private.panningEnabled) {
            return this;
          }

          dims = args[0];
          x = dims.x;
          y = dims.y;

          if (is.number(x)) {
            pan.x = x;
          }

          if (is.number(y)) {
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

        if ((dim === 'x' || dim === 'y') && is.number(val)) {
          pan[dim] = val;
        }

        this.emit('pan viewport');
        break;

      default:
        break; // invalid
    }

    this.notify({ // notify the renderer that the viewport changed
      type: 'viewport'
    });

    return this; // chaining
  },

  panBy: function panBy(arg0, arg1) {
    var args = arguments;
    var pan = this._private.pan;
    var dim = void 0,
        val = void 0,
        dims = void 0,
        x = void 0,
        y = void 0;

    if (!this._private.panningEnabled) {
      return this;
    }

    switch (args.length) {
      case 1:

        if (is.plainObject(arg0)) {
          // .panBy({ x: 0, y: 100 })
          dims = args[0];
          x = dims.x;
          y = dims.y;

          if (is.number(x)) {
            pan.x += x;
          }

          if (is.number(y)) {
            pan.y += y;
          }

          this.emit('pan viewport');
        }
        break;

      case 2:
        // .panBy('x', 100)
        dim = arg0;
        val = arg1;

        if ((dim === 'x' || dim === 'y') && is.number(val)) {
          pan[dim] += val;
        }

        this.emit('pan viewport');
        break;

      default:
        break; // invalid
    }

    this.notify({ // notify the renderer that the viewport changed
      type: 'viewport'
    });

    return this; // chaining
  },

  fit: function fit(elements, padding) {
    var viewportState = this.getFitViewport(elements, padding);

    if (viewportState) {
      var _p = this._private;
      _p.zoom = viewportState.zoom;
      _p.pan = viewportState.pan;

      this.emit('pan zoom viewport');

      this.notify({ // notify the renderer that the viewport changed
        type: 'viewport'
      });
    }

    return this; // chaining
  },

  getFitViewport: function getFitViewport(elements, padding) {
    if (is.number(elements) && padding === undefined) {
      // elements is optional
      padding = elements;
      elements = undefined;
    }

    if (!this._private.panningEnabled || !this._private.zoomingEnabled) {
      return;
    }

    var bb = void 0;

    if (is.string(elements)) {
      var sel = elements;
      elements = this.$(sel);
    } else if (is.boundingBox(elements)) {
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
    } else if (!is.elementOrCollection(elements)) {
      elements = this.mutableElements();
    }

    if (is.elementOrCollection(elements) && elements.empty()) {
      return;
    } // can't fit to nothing

    bb = bb || elements.boundingBox();

    var w = this.width();
    var h = this.height();
    var zoom = void 0;
    padding = is.number(padding) ? padding : 0;

    if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0 && !isNaN(bb.w) && !isNaN(bb.h) && bb.w > 0 && bb.h > 0) {
      zoom = Math.min((w - 2 * padding) / bb.w, (h - 2 * padding) / bb.h);

      // crop zoom
      zoom = zoom > this._private.maxZoom ? this._private.maxZoom : zoom;
      zoom = zoom < this._private.minZoom ? this._private.minZoom : zoom;

      var pan = { // now pan to middle
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

  minZoom: function minZoom(zoom) {
    if (zoom === undefined) {
      return this._private.minZoom;
    } else if (is.number(zoom)) {
      this._private.minZoom = zoom;
    }

    return this;
  },

  maxZoom: function maxZoom(zoom) {
    if (zoom === undefined) {
      return this._private.maxZoom;
    } else if (is.number(zoom)) {
      this._private.maxZoom = zoom;
    }

    return this;
  },

  getZoomedViewport: function getZoomedViewport(params) {
    var _p = this._private;
    var currentPan = _p.pan;
    var currentZoom = _p.zoom;
    var pos = void 0; // in rendered px
    var zoom = void 0;
    var bail = false;

    if (!_p.zoomingEnabled) {
      // zooming disabled
      bail = true;
    }

    if (is.number(params)) {
      // then set the zoom
      zoom = params;
    } else if (is.plainObject(params)) {
      // then zoom about a point
      zoom = params.level;

      if (params.position != null) {
        pos = math.modelToRenderedPosition(params.position, currentZoom, currentPan);
      } else if (params.renderedPosition != null) {
        pos = params.renderedPosition;
      }

      if (pos != null && !_p.panningEnabled) {
        // panning disabled
        bail = true;
      }
    }

    // crop zoom
    zoom = zoom > _p.maxZoom ? _p.maxZoom : zoom;
    zoom = zoom < _p.minZoom ? _p.minZoom : zoom;

    // can't zoom with invalid params
    if (bail || !is.number(zoom) || zoom === currentZoom || pos != null && (!is.number(pos.x) || !is.number(pos.y))) {
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

      this.notify({ // notify the renderer that the viewport changed
        type: 'viewport'
      });

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
    if (!is.number(opts.zoom)) {
      zoomDefd = false;
    }
    if (!is.plainObject(opts.pan)) {
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

      if (is.number(p.x)) {
        _p.pan.x = p.x;
        panFailed = false;
      }

      if (is.number(p.y)) {
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

      this.notify({
        type: 'viewport'
      });
    }

    return this; // chaining
  },

  center: function center(elements) {
    var pan = this.getCenterPan(elements);

    if (pan) {
      this._private.pan = pan;

      this.emit('pan viewport');

      this.notify({ // notify the renderer that the viewport changed
        type: 'viewport'
      });
    }

    return this; // chaining
  },

  getCenterPan: function getCenterPan(elements, zoom) {
    if (!this._private.panningEnabled) {
      return;
    }

    if (is.string(elements)) {
      var selector = elements;
      elements = this.mutableElements().filter(selector);
    } else if (!is.elementOrCollection(elements)) {
      elements = this.mutableElements();
    }

    if (elements.length === 0) {
      return;
    } // can't centre pan to nothing

    var bb = elements.boundingBox();
    var w = this.width();
    var h = this.height();
    zoom = zoom === undefined ? this._private.zoom : zoom;

    var pan = { // middle
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
      pan: { x: 0, y: 0 },
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
      var style = window.getComputedStyle(container);
      var val = function val(name) {
        return parseFloat(style.getPropertyValue(name));
      };

      return {
        width: container.clientWidth - val('padding-left') - val('padding-right'),
        height: container.clientHeight - val('padding-top') - val('padding-bottom')
      };
    }() : { // fallback if no container (not 0 b/c can be used for dividing etc)
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
};

// aliases
corefn.centre = corefn.center;

// backwards compatibility
corefn.autolockNodes = corefn.autolock;
corefn.autoungrabifyNodes = corefn.autoungrabify;

module.exports = corefn;

/***/ }),
/* 94 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);
var define = __webpack_require__(4);
var Collection = __webpack_require__(7);
var Core = __webpack_require__(12);
var incExts = __webpack_require__(95);
var is = __webpack_require__(0);
var Emitter = __webpack_require__(11);

// registered extensions to cytoscape, indexed by name
var extensions = {};

// registered modules for extensions, indexed by name
var modules = {};

function setExtension(type, name, registrant) {

  var ext = registrant;

  var overrideErr = function overrideErr(field) {
    util.error('Can not register `' + name + '` for `' + type + '` since `' + field + '` already exists in the prototype and can not be overridden');
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

      registrant.call(this, options);

      // make sure layout has _private for use w/ std apis like .on()
      if (!is.plainObject(this._private)) {
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
    }

    // either .start() or .run() is defined, so autogen the other
    if (layoutProto.start && !layoutProto.run) {
      layoutProto.run = function () {
        this.start();return this;
      };
    } else if (!layoutProto.start && layoutProto.run) {
      layoutProto.start = function () {
        this.run();return this;
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

    util.assign(layoutProto, {
      createEmitter: function createEmitter() {
        this._private.emitter = new Emitter({
          eventFields: function eventFields(layout) {
            return {
              layout: layout,
              cy: getCy(layout),
              target: layout
            };
          },
          bubble: function bubble() {
            return true;
          },
          parent: function parent(layout) {
            return getCy(layout);
          },
          context: this
        });

        return this;
      },
      emitter: function emitter() {
        return this._private.emitter;
      },
      on: function on(evt, cb) {
        this.emitter().on(evt, cb);return this;
      },
      one: function one(evt, cb) {
        this.emitter().one(evt, cb);return this;
      },
      once: function once(evt, cb) {
        this.emitter().one(evt, cb);return this;
      },
      removeListener: function removeListener(evt, cb) {
        this.emitter().removeListener(evt, cb);return this;
      },
      emit: function emit(evt, params) {
        this.emitter().emit(evt, params);return this;
      }
    });

    define.eventAliasesOn(layoutProto);

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
        util.error('Renderer does not implement `renderer.' + name + '()` on its prototype');
      };
    });

    ext = Renderer;
  }

  return util.setMap({
    map: extensions,
    keys: [type, name],
    value: ext
  });
}

function getExtension(type, name) {
  return util.getMap({
    map: extensions,
    keys: [type, name]
  });
}

function setModule(type, name, moduleType, moduleName, registrant) {
  return util.setMap({
    map: modules,
    keys: [type, name, moduleType, moduleName],
    value: registrant
  });
}

function getModule(type, name, moduleType, moduleName) {
  return util.getMap({
    map: modules,
    keys: [type, name, moduleType, moduleName]
  });
}

var extension = function extension() {
  // e.g. extension('renderer', 'svg')
  if (arguments.length === 2) {
    return getExtension.apply(null, arguments);
  }

  // e.g. extension('renderer', 'svg', { ... })
  else if (arguments.length === 3) {
      return setExtension.apply(null, arguments);
    }

    // e.g. extension('renderer', 'svg', 'nodeShape', 'ellipse')
    else if (arguments.length === 4) {
        return getModule.apply(null, arguments);
      }

      // e.g. extension('renderer', 'svg', 'nodeShape', 'ellipse', { ... })
      else if (arguments.length === 5) {
          return setModule.apply(null, arguments);
        } else {
          util.error('Invalid extension access syntax');
        }
};

// allows a core instance to access extensions internally
Core.prototype.extension = extension;

// included extensions
incExts.forEach(function (group) {
  group.extensions.forEach(function (ext) {
    setExtension(group.type, ext.name, ext.impl);
  });
});

module.exports = extension;

/***/ }),
/* 95 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = [{
  type: 'layout',
  extensions: __webpack_require__(96)
}, {
  type: 'renderer',
  extensions: __webpack_require__(105)
}];

/***/ }),
/* 96 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = [{ name: 'breadthfirst', impl: __webpack_require__(97) }, { name: 'circle', impl: __webpack_require__(98) }, { name: 'concentric', impl: __webpack_require__(99) }, { name: 'cose', impl: __webpack_require__(100) }, { name: 'grid', impl: __webpack_require__(101) }, { name: 'null', impl: __webpack_require__(102) }, { name: 'preset', impl: __webpack_require__(103) }, { name: 'random', impl: __webpack_require__(104) }];

/***/ }),
/* 97 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);
var math = __webpack_require__(2);
var is = __webpack_require__(0);

var defaults = {
  fit: true, // whether to fit the viewport to the graph
  directed: false, // whether the tree is directed downwards (or edges can point in any direction if false)
  padding: 30, // padding on fit
  circle: false, // put depths in concentric circles if true, put depths top down if false
  spacingFactor: 1.75, // positive spacing factor, larger => more space between nodes (N.B. n/a if causes overlap)
  boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
  avoidOverlap: true, // prevents node overlap, may overflow boundingBox if not enough space
  nodeDimensionsIncludeLabels: false, // Excludes the label when calculating node bounding boxes for the layout algorithm
  roots: undefined, // the roots of the trees
  maximalAdjustments: 0, // how many times to try to position the nodes in a maximal way (i.e. no backtracking)
  animate: false, // whether to transition the node positions
  animationDuration: 500, // duration of animation in ms if enabled
  animationEasing: undefined, // easing of animation if enabled,
  animateFilter: function animateFilter(node, i) {
    return true;
  }, // a function that determines whether the node should be animated.  All nodes animated by default on animate enabled.  Non-animated nodes are positioned immediately when the layout starts
  ready: undefined, // callback on layoutready
  stop: undefined, // callback on layoutstop
  transform: function transform(node, position) {
    return position;
  } // transform a given node position. Useful for changing flow direction in discrete layouts
};

function BreadthFirstLayout(options) {
  this.options = util.extend({}, defaults, options);
}

BreadthFirstLayout.prototype.run = function () {
  var params = this.options;
  var options = params;

  var cy = params.cy;
  var eles = options.eles;
  var nodes = eles.nodes().not(':parent');
  var graph = eles;

  var bb = math.makeBoundingBox(options.boundingBox ? options.boundingBox : {
    x1: 0, y1: 0, w: cy.width(), h: cy.height()
  });

  var roots = void 0;
  if (is.elementOrCollection(options.roots)) {
    roots = options.roots;
  } else if (is.array(options.roots)) {
    var rootsArray = [];

    for (var i = 0; i < options.roots.length; i++) {
      var id = options.roots[i];
      var ele = cy.getElementById(id);
      rootsArray.push(ele);
    }

    roots = cy.collection(rootsArray);
  } else if (is.string(options.roots)) {
    roots = cy.$(options.roots);
  } else {
    if (options.directed) {
      roots = nodes.roots();
    } else {
      var components = [];
      var unhandledNodes = nodes;

      var _loop = function _loop() {
        var currComp = cy.collection();

        eles.bfs({
          roots: unhandledNodes[0],
          visit: function visit(node, edge, pNode, i, depth) {
            currComp = currComp.add(node);
          },
          directed: false
        });

        unhandledNodes = unhandledNodes.not(currComp);
        components.push(currComp);
      };

      while (unhandledNodes.length > 0) {
        _loop();
      }

      roots = cy.collection();

      var _loop2 = function _loop2(_i) {
        var comp = components[_i];
        var maxDegree = comp.maxDegree(false);
        var compRoots = comp.filter(function (ele) {
          return ele.degree(false) === maxDegree;
        });

        roots = roots.add(compRoots);
      };

      for (var _i = 0; _i < components.length; _i++) {
        _loop2(_i);
      }
    }
  }

  var depths = [];
  var foundByBfs = {};
  var id2depth = {};
  var prevNode = {};
  var prevEdge = {};
  var successors = {};

  // find the depths of the nodes
  graph.bfs({
    roots: roots,
    directed: options.directed,
    visit: function visit(node, edge, pNode, i, depth) {
      var ele = node[0];
      var id = ele.id();

      if (!depths[depth]) {
        depths[depth] = [];
      }

      depths[depth].push(ele);
      foundByBfs[id] = true;
      id2depth[id] = depth;
      prevNode[id] = pNode;
      prevEdge[id] = edge;

      if (pNode) {
        var prevId = pNode.id();
        var succ = successors[prevId] = successors[prevId] || [];

        succ.push(node);
      }
    }
  });

  // check for nodes not found by bfs
  var orphanNodes = [];
  for (var _i2 = 0; _i2 < nodes.length; _i2++) {
    var _ele = nodes[_i2];

    if (foundByBfs[_ele.id()]) {
      continue;
    } else {
      orphanNodes.push(_ele);
    }
  }

  // assign orphan nodes a depth from their neighborhood
  var maxChecks = orphanNodes.length * 3;
  var checks = 0;
  while (orphanNodes.length !== 0 && checks < maxChecks) {
    var node = orphanNodes.shift();
    var neighbors = node.neighborhood().nodes();
    var assignedDepth = false;

    for (var _i3 = 0; _i3 < neighbors.length; _i3++) {
      var depth = id2depth[neighbors[_i3].id()];

      if (depth !== undefined) {
        depths[depth].push(node);
        assignedDepth = true;
        break;
      }
    }

    if (!assignedDepth) {
      orphanNodes.push(node);
    }

    checks++;
  }

  // assign orphan nodes that are still left to the depth of their subgraph
  while (orphanNodes.length !== 0) {
    var _node = orphanNodes.shift();
    //let subgraph = graph.bfs( node ).path;
    var _assignedDepth = false;

    // for( let i = 0; i < subgraph.length; i++ ){
    //   let depth = id2depth[ subgraph[i].id() ];

    //   if( depth !== undefined ){
    //     depths[depth].push( node );
    //     assignedDepth = true;
    //     break;
    //   }
    // }

    if (!_assignedDepth) {
      // worst case if the graph really isn't tree friendly, then just dump it in 0
      if (depths.length === 0) {
        depths.push([]);
      }

      depths[0].push(_node);
    }
  }

  // assign the nodes a depth and index
  var assignDepthsToEles = function assignDepthsToEles() {
    for (var _i4 = 0; _i4 < depths.length; _i4++) {
      var _eles = depths[_i4];

      for (var j = 0; j < _eles.length; j++) {
        var _ele2 = _eles[j];

        if (_ele2 == null) {
          _eles.splice(j, 1);
          j--;
          continue;
        }

        _ele2._private.scratch.breadthfirst = {
          depth: _i4,
          index: j
        };
      }
    }
  };
  assignDepthsToEles();

  var intersectsDepth = function intersectsDepth(node) {
    // returns true if has edges pointing in from a higher depth
    var edges = node.connectedEdges(function (ele) {
      return ele.data('target') === node.id();
    });
    var thisInfo = node._private.scratch.breadthfirst;
    var highestDepthOfOther = 0;
    var highestOther = void 0;
    for (var _i5 = 0; _i5 < edges.length; _i5++) {
      var edge = edges[_i5];
      var otherNode = edge.source()[0];
      var otherInfo = otherNode._private.scratch.breadthfirst;

      if (thisInfo.depth <= otherInfo.depth && highestDepthOfOther < otherInfo.depth) {
        highestDepthOfOther = otherInfo.depth;
        highestOther = otherNode;
      }
    }

    return highestOther;
  };

  // make maximal if so set by adjusting depths
  for (var adj = 0; adj < options.maximalAdjustments; adj++) {

    var nDepths = depths.length;
    var elesToMove = [];
    for (var _i6 = 0; _i6 < nDepths; _i6++) {
      var _depth = depths[_i6];

      var nDepth = _depth.length;
      for (var j = 0; j < nDepth; j++) {
        var _ele3 = _depth[j];
        var info = _ele3._private.scratch.breadthfirst;
        var intEle = intersectsDepth(_ele3);

        if (intEle) {
          info.intEle = intEle;
          elesToMove.push(_ele3);
        }
      }
    }

    for (var _i7 = 0; _i7 < elesToMove.length; _i7++) {
      var _ele4 = elesToMove[_i7];
      var _info = _ele4._private.scratch.breadthfirst;
      var _intEle = _info.intEle;
      var intInfo = _intEle._private.scratch.breadthfirst;

      depths[_info.depth][_info.index] = null; // remove from old depth & index (create hole to be cleaned)

      // add to end of new depth
      var newDepth = intInfo.depth + 1;
      while (newDepth > depths.length - 1) {
        depths.push([]);
      }
      depths[newDepth].push(_ele4);

      _info.depth = newDepth;
      _info.index = depths[newDepth].length - 1;
    }

    assignDepthsToEles();
  }

  // find min distance we need to leave between nodes
  var minDistance = 0;
  if (options.avoidOverlap) {
    for (var _i8 = 0; _i8 < nodes.length; _i8++) {
      var n = nodes[_i8];
      var nbb = n.layoutDimensions(options);
      var w = nbb.w;
      var h = nbb.h;

      minDistance = Math.max(minDistance, w, h);
    }
  }

  // get the weighted percent for an element based on its connectivity to other levels
  var cachedWeightedPercent = {};
  var getWeightedPercent = function getWeightedPercent(ele) {
    if (cachedWeightedPercent[ele.id()]) {
      return cachedWeightedPercent[ele.id()];
    }

    var eleDepth = ele._private.scratch.breadthfirst.depth;
    var neighbors = ele.neighborhood().nodes().not(':parent').intersection(nodes);
    var percent = 0;
    var samples = 0;

    for (var _i9 = 0; _i9 < neighbors.length; _i9++) {
      var neighbor = neighbors[_i9];
      var bf = neighbor._private.scratch.breadthfirst;
      var index = bf.index;
      var _depth2 = bf.depth;
      var _nDepth = depths[_depth2].length;

      if (eleDepth > _depth2 || eleDepth === 0) {
        // only get influenced by elements above
        percent += index / _nDepth;
        samples++;
      }
    }

    samples = Math.max(1, samples);
    percent = percent / samples;

    if (samples === 0) {
      // so lone nodes have a "don't care" state in sorting
      percent = undefined;
    }

    cachedWeightedPercent[ele.id()] = percent;
    return percent;
  };

  // rearrange the indices in each depth level based on connectivity

  var sortFn = function sortFn(a, b) {
    var apct = getWeightedPercent(a);
    var bpct = getWeightedPercent(b);

    return apct - bpct;
  };

  for (var times = 0; times < 3; times++) {
    // do it a few times b/c the depths are dynamic and we want a more stable result

    for (var _i10 = 0; _i10 < depths.length; _i10++) {
      depths[_i10] = depths[_i10].sort(sortFn);
    }
    assignDepthsToEles(); // and update
  }

  var biggestDepthSize = 0;
  for (var _i11 = 0; _i11 < depths.length; _i11++) {
    biggestDepthSize = Math.max(depths[_i11].length, biggestDepthSize);
  }

  var center = {
    x: bb.x1 + bb.w / 2,
    y: bb.x1 + bb.h / 2
  };

  var getPosition = function getPosition(ele, isBottomDepth) {
    var info = ele._private.scratch.breadthfirst;
    var depth = info.depth;
    var index = info.index;
    var depthSize = depths[depth].length;

    var distanceX = Math.max(bb.w / (depthSize + 1), minDistance);
    var distanceY = Math.max(bb.h / (depths.length + 1), minDistance);
    var radiusStepSize = Math.min(bb.w / 2 / depths.length, bb.h / 2 / depths.length);
    radiusStepSize = Math.max(radiusStepSize, minDistance);

    if (!options.circle) {

      var epos = {
        x: center.x + (index + 1 - (depthSize + 1) / 2) * distanceX,
        y: (depth + 1) * distanceY
      };

      if (isBottomDepth) {
        return epos;
      }

      // let succs = successors[ ele.id() ];
      // if( succs ){
      //   epos.x = 0;
      //
      //   for( let i = 0 ; i < succs.length; i++ ){
      //     let spos = pos[ succs[i].id() ];
      //
      //     epos.x += spos.x;
      //   }
      //
      //   epos.x /= succs.length;
      // } else {
      //   //debugger;
      // }

      return epos;
    } else {
      if (options.circle) {
        var radius = radiusStepSize * depth + radiusStepSize - (depths.length > 0 && depths[0].length <= 3 ? radiusStepSize / 2 : 0);
        var theta = 2 * Math.PI / depths[depth].length * index;

        if (depth === 0 && depths[0].length === 1) {
          radius = 1;
        }

        return {
          x: center.x + radius * Math.cos(theta),
          y: center.y + radius * Math.sin(theta)
        };
      } else {
        return {
          x: center.x + (index + 1 - (depthSize + 1) / 2) * distanceX,
          y: (depth + 1) * distanceY
        };
      }
    }
  };

  // get positions in reverse depth order
  var pos = {};
  for (var _i12 = depths.length - 1; _i12 >= 0; _i12--) {
    var _depth3 = depths[_i12];

    for (var _j = 0; _j < _depth3.length; _j++) {
      var _node2 = _depth3[_j];

      pos[_node2.id()] = getPosition(_node2, _i12 === depths.length - 1);
    }
  }

  nodes.layoutPositions(this, options, function (node) {
    return pos[node.id()];
  });

  return this; // chaining
};

module.exports = BreadthFirstLayout;

/***/ }),
/* 98 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);
var math = __webpack_require__(2);
var is = __webpack_require__(0);

var defaults = {
  fit: true, // whether to fit the viewport to the graph
  padding: 30, // the padding on fit
  boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
  avoidOverlap: true, // prevents node overlap, may overflow boundingBox and radius if not enough space
  nodeDimensionsIncludeLabels: false, // Excludes the label when calculating node bounding boxes for the layout algorithm
  spacingFactor: undefined, // Applies a multiplicative factor (>0) to expand or compress the overall area that the nodes take up
  radius: undefined, // the radius of the circle
  startAngle: 3 / 2 * Math.PI, // where nodes start in radians
  sweep: undefined, // how many radians should be between the first and last node (defaults to full circle)
  clockwise: true, // whether the layout should go clockwise (true) or counterclockwise/anticlockwise (false)
  sort: undefined, // a sorting function to order the nodes; e.g. function(a, b){ return a.data('weight') - b.data('weight') }
  animate: false, // whether to transition the node positions
  animationDuration: 500, // duration of animation in ms if enabled
  animationEasing: undefined, // easing of animation if enabled
  animateFilter: function animateFilter(node, i) {
    return true;
  }, // a function that determines whether the node should be animated.  All nodes animated by default on animate enabled.  Non-animated nodes are positioned immediately when the layout starts
  ready: undefined, // callback on layoutready
  stop: undefined, // callback on layoutstop
  transform: function transform(node, position) {
    return position;
  } // transform a given node position. Useful for changing flow direction in discrete layouts 

};

function CircleLayout(options) {
  this.options = util.extend({}, defaults, options);
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

  var bb = math.makeBoundingBox(options.boundingBox ? options.boundingBox : {
    x1: 0, y1: 0, w: cy.width(), h: cy.height()
  });

  var center = {
    x: bb.x1 + bb.w / 2,
    y: bb.y1 + bb.h / 2
  };

  var sweep = options.sweep === undefined ? 2 * Math.PI - 2 * Math.PI / nodes.length : options.sweep;
  var dTheta = sweep / Math.max(1, nodes.length - 1);
  var r = void 0;

  var minDistance = 0;
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    var nbb = n.layoutDimensions(options);
    var w = nbb.w;
    var h = nbb.h;

    minDistance = Math.max(minDistance, w, h);
  }

  if (is.number(options.radius)) {
    r = options.radius;
  } else if (nodes.length <= 1) {
    r = 0;
  } else {
    r = Math.min(bb.h, bb.w) / 2 - minDistance;
  }

  // calculate the radius
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

module.exports = CircleLayout;

/***/ }),
/* 99 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);
var math = __webpack_require__(2);

var defaults = {
  fit: true, // whether to fit the viewport to the graph
  padding: 30, // the padding on fit
  startAngle: 3 / 2 * Math.PI, // where nodes start in radians
  sweep: undefined, // how many radians should be between the first and last node (defaults to full circle)
  clockwise: true, // whether the layout should go clockwise (true) or counterclockwise/anticlockwise (false)
  equidistant: false, // whether levels have an equal radial distance betwen them, may cause bounding box overflow
  minNodeSpacing: 10, // min spacing between outside of nodes (used for radius adjustment)
  boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
  avoidOverlap: true, // prevents node overlap, may overflow boundingBox if not enough space
  nodeDimensionsIncludeLabels: false, // Excludes the label when calculating node bounding boxes for the layout algorithm
  height: undefined, // height of layout area (overrides container height)
  width: undefined, // width of layout area (overrides container width)
  spacingFactor: undefined, // Applies a multiplicative factor (>0) to expand or compress the overall area that the nodes take up
  concentric: function concentric(node) {
    // returns numeric value for each node, placing higher nodes in levels towards the centre
    return node.degree();
  },
  levelWidth: function levelWidth(nodes) {
    // the letiation of concentric values in each level
    return nodes.maxDegree() / 4;
  },
  animate: false, // whether to transition the node positions
  animationDuration: 500, // duration of animation in ms if enabled
  animationEasing: undefined, // easing of animation if enabled
  animateFilter: function animateFilter(node, i) {
    return true;
  }, // a function that determines whether the node should be animated.  All nodes animated by default on animate enabled.  Non-animated nodes are positioned immediately when the layout starts
  ready: undefined, // callback on layoutready
  stop: undefined, // callback on layoutstop
  transform: function transform(node, position) {
    return position;
  } // transform a given node position. Useful for changing flow direction in discrete layouts 
};

function ConcentricLayout(options) {
  this.options = util.extend({}, defaults, options);
}

ConcentricLayout.prototype.run = function () {
  var params = this.options;
  var options = params;

  var clockwise = options.counterclockwise !== undefined ? !options.counterclockwise : options.clockwise;

  var cy = params.cy;

  var eles = options.eles;
  var nodes = eles.nodes().not(':parent');

  var bb = math.makeBoundingBox(options.boundingBox ? options.boundingBox : {
    x1: 0, y1: 0, w: cy.width(), h: cy.height()
  });

  var center = {
    x: bb.x1 + bb.w / 2,
    y: bb.y1 + bb.h / 2
  };

  var nodeValues = []; // { node, value }
  var theta = options.startAngle;
  var maxNodeSize = 0;

  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    var value = void 0;

    // calculate the node value
    value = options.concentric(node);
    nodeValues.push({
      value: value,
      node: node
    });

    // for style mapping
    node._private.scratch.concentric = value;
  }

  // in case we used the `concentric` in style
  nodes.updateStyle();

  // calculate max size now based on potentially updated mappers
  for (var _i = 0; _i < nodes.length; _i++) {
    var _node = nodes[_i];
    var nbb = _node.layoutDimensions(options);

    maxNodeSize = Math.max(maxNodeSize, nbb.w, nbb.h);
  }

  // sort node values in descreasing order
  nodeValues.sort(function (a, b) {
    return b.value - a.value;
  });

  var levelWidth = options.levelWidth(nodes);

  // put the values into levels
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
  }

  // create positions from levels

  var minDist = maxNodeSize + options.minNodeSpacing; // min dist between nodes

  if (!options.avoidOverlap) {
    // then strictly constrain to bb
    var firstLvlHasMulti = levels.length > 0 && levels[0].length > 1;
    var maxR = Math.min(bb.w, bb.h) / 2 - minDist;
    var rStep = maxR / (levels.length + firstLvlHasMulti ? 1 : 0);

    minDist = Math.min(minDist, rStep);
  }

  // find the metrics for each level
  var r = 0;
  for (var _i3 = 0; _i3 < levels.length; _i3++) {
    var level = levels[_i3];
    var sweep = options.sweep === undefined ? 2 * Math.PI - 2 * Math.PI / level.length : options.sweep;
    var dTheta = level.dTheta = sweep / Math.max(1, level.length - 1);

    // calculate the radius
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
  }

  // calculate the node positions
  var pos = {}; // id => position
  for (var _i6 = 0; _i6 < levels.length; _i6++) {
    var _level3 = levels[_i6];
    var _dTheta = _level3.dTheta;
    var _r2 = _level3.r;

    for (var j = 0; j < _level3.length; j++) {
      var _val = _level3[j];
      var _theta = options.startAngle + (clockwise ? 1 : -1) * _dTheta * j;

      var p = {
        x: center.x + _r2 * Math.cos(_theta),
        y: center.y + _r2 * Math.sin(_theta)
      };

      pos[_val.node.id()] = p;
    }
  }

  // position the nodes
  nodes.layoutPositions(this, options, function (ele) {
    var id = ele.id();

    return pos[id];
  });

  return this; // chaining
};

module.exports = ConcentricLayout;

/***/ }),
/* 100 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/*
The CoSE layout was written by Gerardo Huck.
https://www.linkedin.com/in/gerardohuck/

Based on the following article:
http://dl.acm.org/citation.cfm?id=1498047

Modifications tracked on Github.
*/

var util = __webpack_require__(1);
var math = __webpack_require__(2);
var is = __webpack_require__(0);
var Promise = __webpack_require__(5);

var DEBUG;

/**
 * @brief :  default layout options
 */
var defaults = {
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
  // (0 -> only updated on the end)
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
  minTemp: 1.0,

  // Pass a reference to weaver to use threads for calculations
  weaver: false
};

/**
 * @brief       : constructor
 * @arg options : object containing layout options
 */
function CoseLayout(options) {
  this.options = util.extend({}, defaults, options);

  this.options.layout = this;
}

/**
 * @brief : runs the layout
 */
CoseLayout.prototype.run = function () {
  var options = this.options;
  var cy = options.cy;
  var layout = this;
  var thread = this.thread;
  var Thread = options.weaver ? options.weaver.Thread : null;

  var falseThread = { // use false thread as polyfill
    listeners: [],
    on: function on(e, cb) {
      this.listeners.push({ event: e, callback: cb });

      return this;
    },
    trigger: function trigger(e) {
      if (is.string(e)) {
        e = { type: e };
      }

      var matchesEvent = function matchesEvent(l) {
        return l.event === e.type;
      };
      var trigger = function trigger(l) {
        l.callback(e);
      };

      this.listeners.filter(matchesEvent).forEach(trigger);

      return this;
    },
    pass: function pass(data) {
      this.pass = data;

      return this;
    },
    run: function run(cb) {
      var pass = this.pass;

      return new Promise(function (resolve) {
        resolve(cb(pass));
      });
    },
    stop: function stop() {
      return this;
    }
  };

  function broadcast(message) {
    // for false thread
    var e = { type: 'message', message: message };

    falseThread.trigger(e);
  }

  if (!thread || thread.stopped()) {
    thread = this.thread = Thread ? new Thread() : falseThread;
  }

  layout.stopped = false;

  if (options.animate === true || options.animate === false) {
    layout.emit({ type: 'layoutstart', layout: layout });
  }

  // Set DEBUG - Global variable
  if (true === options.debug) {
    DEBUG = true;
  } else {
    DEBUG = false;
  }

  // Initialize layout info
  var layoutInfo = createLayoutInfo(cy, layout, options);

  // Show LayoutInfo contents if debugging
  if (DEBUG) {
    printLayoutInfo(layoutInfo);
  }

  // If required, randomize node positions
  if (options.randomize) {
    randomizePositions(layoutInfo, cy);
  }

  var startTime = Date.now();
  var refreshRequested = false;
  var refresh = function refresh(rOpts) {
    rOpts = rOpts || {};

    if (refreshRequested && !rOpts.next) {
      return;
    }

    if (!rOpts.force && Date.now() - startTime < options.animationThreshold) {
      return;
    }

    refreshRequested = true;

    util.requestAnimationFrame(function () {
      refreshPositions(layoutInfo, cy, options);

      // Fit the graph if necessary
      if (true === options.fit) {
        cy.fit(options.padding);
      }

      refreshRequested = false;

      if (rOpts.next) {
        rOpts.next();
      }
    });
  };

  thread.on('message', function (e) {
    var layoutNodes = e.message;

    layoutInfo.layoutNodes = layoutNodes;
    refresh();
  });

  thread.pass({
    layoutInfo: layoutInfo,
    options: {
      animate: options.animate,
      refresh: options.refresh,
      componentSpacing: options.componentSpacing,
      nodeOverlap: options.nodeOverlap,
      nestingFactor: options.nestingFactor,
      gravity: options.gravity,
      numIter: options.numIter,
      initialTemp: options.initialTemp,
      coolingFactor: options.coolingFactor,
      minTemp: options.minTemp
    }
  }).run(function (pass) {
    var layoutInfo = pass.layoutInfo;
    var options = pass.options;
    var stopped = false;

    /**
     * @brief          : Performs one iteration of the physical simulation
     * @arg layoutInfo : LayoutInfo object already initialized
     * @arg cy         : Cytoscape object
     * @arg options    : Layout options
     */
    var step = function step(layoutInfo, options, _step) {
      // var s = "\n\n###############################";
      // s += "\nSTEP: " + step;
      // s += "\n###############################\n";
      // logDebug(s);

      // Calculate node repulsions
      calculateNodeForces(layoutInfo, options);
      // Calculate edge forces
      calculateEdgeForces(layoutInfo, options);
      // Calculate gravity forces
      calculateGravityForces(layoutInfo, options);
      // Propagate forces from parent to child
      propagateForces(layoutInfo, options);
      // Update positions based on calculated forces
      updatePositions(layoutInfo, options);
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
        var numNodes = graph.length;

        // s = "Set: " + graph.toString();
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
      }

      // Get direction of line connecting both node centers
      var directionX = node2.positionX - node1.positionX;
      var directionY = node2.positionY - node1.positionY;
      var maxRandDist = 1;
      // s += "\ndirectionX: " + directionX + ", directionY: " + directionY;

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
        var force = options.nodeOverlap * overlap;

        // Compute the module and components of the force vector
        var distance = Math.sqrt(directionX * directionX + directionY * directionY);
        // s += "\nDistance: " + distance;
        var forceX = force * directionX / distance;
        var forceY = force * directionY / distance;
      } else {
        // s += "\nNodes do NOT overlap.";
        // If there's no overlap, force is inversely proportional
        // to squared distance

        // Get clipping points for both nodes
        var point1 = findClippingPoint(node1, directionX, directionY);
        var point2 = findClippingPoint(node2, -1 * directionX, -1 * directionY);

        // Use clipping points to compute distance
        var distanceX = point2.x - point1.x;
        var distanceY = point2.y - point1.y;
        var distanceSqr = distanceX * distanceX + distanceY * distanceY;
        var distance = Math.sqrt(distanceSqr);
        // s += "\nDistance: " + distance;

        // Compute the module and components of the force vector
        var force = (node1.nodeRepulsion + node2.nodeRepulsion) / distanceSqr;
        var forceX = force * distanceX / distance;
        var forceY = force * distanceY / distance;
      }

      // Apply force
      if (!node1.isLocked) {
        node1.offsetX -= forceX;
        node1.offsetY -= forceY;
      }

      if (!node2.isLocked) {
        node2.offsetX += forceX;
        node2.offsetY += forceY;
      }

      // s += "\nForceX: " + forceX + " ForceY: " + forceY;
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
      var nodeSlope = H / W;

      // var s = 'Computing clipping point of node ' + node.id +
      //   " . Height:  " + H + ", Width: " + W +
      //   "\nDirection " + dX + ", " + dY;
      //
      // Compute intersection
      var res = {};

      // Case: Vertical direction (up)
      if (0 === dX && 0 < dY) {
        res.x = X;
        // s += "\nUp direction";
        res.y = Y + H / 2;

        return res;
      }

      // Case: Vertical direction (down)
      if (0 === dX && 0 > dY) {
        res.x = X;
        res.y = Y + H / 2;
        // s += "\nDown direction";

        return res;
      }

      // Case: Intersects the right border
      if (0 < dX && -1 * nodeSlope <= dirSlope && dirSlope <= nodeSlope) {
        res.x = X + W / 2;
        res.y = Y + W * dY / 2 / dX;
        // s += "\nRightborder";

        return res;
      }

      // Case: Intersects the left border
      if (0 > dX && -1 * nodeSlope <= dirSlope && dirSlope <= nodeSlope) {
        res.x = X - W / 2;
        res.y = Y - W * dY / 2 / dX;
        // s += "\nLeftborder";

        return res;
      }

      // Case: Intersects the top border
      if (0 < dY && (dirSlope <= -1 * nodeSlope || dirSlope >= nodeSlope)) {
        res.x = X + H * dX / 2 / dY;
        res.y = Y + H / 2;
        // s += "\nTop border";

        return res;
      }

      // Case: Intersects the bottom border
      if (0 > dY && (dirSlope <= -1 * nodeSlope || dirSlope >= nodeSlope)) {
        res.x = X - H * dX / 2 / dY;
        res.y = Y - H / 2;
        // s += "\nBottom border";

        return res;
      }

      // s += "\nClipping point found at " + res.x + ", " + res.y;
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
        var target = layoutInfo.layoutNodes[targetIx];

        // Get direction of line connecting both node centers
        var directionX = target.positionX - source.positionX;
        var directionY = target.positionY - source.positionY;

        // If both centers are the same, do nothing.
        // A random force has already been applied as node repulsion
        if (0 === directionX && 0 === directionY) {
          continue;
        }

        // Get clipping points for both nodes
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
        }

        // Add this force to target and source nodes
        if (!source.isLocked) {
          source.offsetX += forceX;
          source.offsetY += forceY;
        }

        if (!target.isLocked) {
          target.offsetX -= forceX;
          target.offsetY -= forceY;
        }

        // var s = 'Edge force between nodes ' + source.id + ' and ' + target.id;
        // s += "\nDistance: " + l + " Force: (" + forceX + ", " + forceY + ")";
        // logDebug(s);
      }
    };

    /**
     * @brief : Computes gravity forces for all nodes
     */
    var calculateGravityForces = function calculateGravityForces(layoutInfo, options) {
      var distThreshold = 1;

      // var s = 'calculateGravityForces';
      // logDebug(s);
      for (var i = 0; i < layoutInfo.graphSet.length; i++) {
        var graph = layoutInfo.graphSet[i];
        var numNodes = graph.length;

        // s = "Set: " + graph.toString();
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
        }
        // s = "Center found at: " + centerX + ", " + centerY;
        // logDebug(s);

        // Apply force to all nodes in graph
        for (var j = 0; j < numNodes; j++) {
          var node = layoutInfo.layoutNodes[layoutInfo.idToIndex[graph[j]]];
          // s = "Node: " + node.id;

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
            node.offsetY += fy;
            // s += ": Applied force: " + fx + ", " + fy;
          } else {}
            // s += ": skypped since it's too close to center";

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
      end += layoutInfo.graphSet[0].length;

      // Traverse the graph, level by level,
      while (start <= end) {
        // Get the node to visit and remove it from queue
        var nodeId = queue[start++];
        var nodeIndex = layoutInfo.idToIndex[nodeId];
        var node = layoutInfo.layoutNodes[nodeIndex];
        var children = node.children;

        // We only need to process the node if it's compound
        if (0 < children.length && !node.isLocked) {
          var offX = node.offsetX;
          var offY = node.offsetY;

          // var s = "Propagating offset from parent node : " + node.id +
          //   ". OffsetX: " + offX + ". OffsetY: " + offY;
          // s += "\n Children: " + children.toString();
          // logDebug(s);

          for (var i = 0; i < children.length; i++) {
            var childNode = layoutInfo.layoutNodes[layoutInfo.idToIndex[children[i]]];
            // Propagate offset
            childNode.offsetX += offX;
            childNode.offsetY += offY;
            // Add children to queue to be visited
            queue[++end] = children[i];
          }

          // Reset parent offsets
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
        }
        // s = "Node: " + n.id + " Previous position: (" +
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
        n.maxY = n.positionY + n.height;
        // s += " New Position: (" + n.positionX + ", " + n.positionY + ").";
        // logDebug(s);

        // Update ancestry boudaries
        updateAncestryBoundaries(n, layoutInfo);
      }

      // Update size, position of compund nodes
      for (var i = 0; i < layoutInfo.nodeSize; i++) {
        var n = layoutInfo.layoutNodes[i];
        if (0 < n.children.length && !n.isLocked) {
          n.positionX = (n.maxX + n.minX) / 2;
          n.positionY = (n.maxY + n.minY) / 2;
          n.width = n.maxX - n.minX;
          n.height = n.maxY - n.minY;
          // s = "Updating position, size of compound node " + n.id;
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
      }

      // s += ".\nResult: (" + res.x + ", " + res.y + ")";
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
      }

      // Get Parent Node
      var p = layoutInfo.layoutNodes[layoutInfo.idToIndex[parentId]];
      var flag = false;

      // MaxX
      if (null == p.maxX || node.maxX + p.padRight > p.maxX) {
        p.maxX = node.maxX + p.padRight;
        flag = true;
        // s += "\nNew maxX for parent node " + p.id + ": " + p.maxX;
      }

      // MinX
      if (null == p.minX || node.minX - p.padLeft < p.minX) {
        p.minX = node.minX - p.padLeft;
        flag = true;
        // s += "\nNew minX for parent node " + p.id + ": " + p.minX;
      }

      // MaxY
      if (null == p.maxY || node.maxY + p.padBottom > p.maxY) {
        p.maxY = node.maxY + p.padBottom;
        flag = true;
        // s += "\nNew maxY for parent node " + p.id + ": " + p.maxY;
      }

      // MinY
      if (null == p.minY || node.minY - p.padTop < p.minY) {
        p.minY = node.minY - p.padTop;
        flag = true;
        // s += "\nNew minY for parent node " + p.id + ": " + p.minY;
      }

      // If updated boundaries, propagate changes upward
      if (flag) {
        // logDebug(s);
        return updateAncestryBoundaries(p, layoutInfo);
      }

      // s += ". No changes in boundaries/position of parent node " + p.id;
      // logDebug(s);
      return;
    };

    var separateComponents = function separateComponents(layutInfo, options) {
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
            n.positionX += x;
            n.positionY += y;
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

    var mainLoop = function mainLoop(i) {
      if (stopped) {
        // logDebug("Layout manually stopped. Stopping computation in step " + i);
        return false;
      }

      // Do one step in the phisical simulation
      step(layoutInfo, options, i);

      // Update temperature
      layoutInfo.temperature = layoutInfo.temperature * options.coolingFactor;
      // logDebug("New temperature: " + layoutInfo.temperature);

      if (layoutInfo.temperature < options.minTemp) {
        // logDebug("Temperature drop below minimum threshold. Stopping computation in step " + i);
        return false;
      }

      return true;
    };

    var i = 0;
    var loopRet;

    do {
      var f = 0;

      while (f < options.refresh && i < options.numIter) {
        var loopRet = mainLoop(i);
        if (!loopRet) {
          break;
        }

        f++;
        i++;
      }

      if (options.animate === true) {
        broadcast(layoutInfo.layoutNodes); // eslint-disable-line no-undef
      }
    } while (loopRet && i + 1 < options.numIter);

    separateComponents(layoutInfo, options);

    return layoutInfo;
  }).then(function (layoutInfoUpdated) {
    layoutInfo.layoutNodes = layoutInfoUpdated.layoutNodes; // get the positions

    thread.stop();
    done();
  });

  var done = function done() {
    if (options.animate === true || options.animate === false) {
      refresh({
        force: true,
        next: function next() {
          // Layout has finished
          layout.one('layoutstop', options.stop);
          layout.emit({ type: 'layoutstop', layout: layout });
        }
      });
    } else {
      options.eles.nodes().layoutPositions(layout, options, function (node) {
        var lnode = layoutInfo.layoutNodes[layoutInfo.idToIndex[node.data('id')]];

        return { x: lnode.positionX, y: lnode.positionY };
      });
    }
  };

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
    boundingBox: math.makeBoundingBox(options.boundingBox ? options.boundingBox : {
      x1: 0, y1: 0, w: cy.width(), h: cy.height()
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
  }

  // Iterate over all nodes, creating layout nodes
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
    tempNode.padBottom = parseFloat(n.style('padding'));

    // forces
    tempNode.nodeRepulsion = is.fn(options.nodeRepulsion) ? options.nodeRepulsion(n) : options.nodeRepulsion;

    // Add new node
    layoutInfo.layoutNodes.push(tempNode);
    // Add entry to id-index map
    layoutInfo.idToIndex[tempNode.id] = i;
  }

  // Inline implementation of a queue, used for traversing the graph in BFS order
  var queue = [];
  var start = 0; // Points to the start the queue
  var end = -1; // Points to the end of the queue

  var tempGraph = [];

  // Second pass to add child information and
  // initialize queue for hierarchical traversal
  for (var i = 0; i < layoutInfo.nodeSize; i++) {
    var n = layoutInfo.layoutNodes[i];
    var p_id = n.parentId;
    // Check if node n has a parent node
    if (null != p_id) {
      // Add node Id to parent's list of children
      layoutInfo.layoutNodes[layoutInfo.idToIndex[p_id]].children.push(n.id);
    } else {
      // If a node doesn't have a parent, then it's in the root graph
      queue[++end] = n.id;
      tempGraph.push(n.id);
    }
  }

  // Add root graph to graphSet
  layoutInfo.graphSet.push(tempGraph);

  // Traverse the graph, level by level,
  while (start <= end) {
    // Get the node to visit and remove it from queue
    var node_id = queue[start++];
    var node_ix = layoutInfo.idToIndex[node_id];
    var node = layoutInfo.layoutNodes[node_ix];
    var children = node.children;
    if (children.length > 0) {
      // Add children nodes as a new graph to graph set
      layoutInfo.graphSet.push(children);
      // Add children to que queue to be visited
      for (var i = 0; i < children.length; i++) {
        queue[++end] = children[i];
      }
    }
  }

  // Create indexToGraph map
  for (var i = 0; i < layoutInfo.graphSet.length; i++) {
    var graph = layoutInfo.graphSet[i];
    for (var j = 0; j < graph.length; j++) {
      var index = layoutInfo.idToIndex[graph[j]];
      layoutInfo.indexToGraph[index] = i;
    }
  }

  // Iterate over all edges, creating Layout Edges
  for (var i = 0; i < layoutInfo.edgeSize; i++) {
    var e = edges[i];
    var tempEdge = {};
    tempEdge.id = e.data('id');
    tempEdge.sourceId = e.data('source');
    tempEdge.targetId = e.data('target');

    // Compute ideal length
    var idealLength = is.fn(options.idealEdgeLength) ? options.idealEdgeLength(e) : options.idealEdgeLength;
    var elasticity = is.fn(options.edgeElasticity) ? options.edgeElasticity(e) : options.edgeElasticity;

    // Check if it's an inter graph edge
    var sourceIx = layoutInfo.idToIndex[tempEdge.sourceId];
    var targetIx = layoutInfo.idToIndex[tempEdge.targetId];
    var sourceGraph = layoutInfo.indexToGraph[sourceIx];
    var targetGraph = layoutInfo.indexToGraph[targetIx];

    if (sourceGraph != targetGraph) {
      // Find lowest common graph ancestor
      var lca = findLCA(tempEdge.sourceId, tempEdge.targetId, layoutInfo);

      // Compute sum of node depths, relative to lca graph
      var lcaGraph = layoutInfo.graphSet[lca];
      var depth = 0;

      // Source depth
      var tempNode = layoutInfo.layoutNodes[sourceIx];
      while (-1 === lcaGraph.indexOf(tempNode.id)) {
        tempNode = layoutInfo.layoutNodes[layoutInfo.idToIndex[tempNode.parentId]];
        depth++;
      }

      // Target depth
      tempNode = layoutInfo.layoutNodes[targetIx];
      while (-1 === lcaGraph.indexOf(tempNode.id)) {
        tempNode = layoutInfo.layoutNodes[layoutInfo.idToIndex[tempNode.parentId]];
        depth++;
      }

      // logDebug('LCA of nodes ' + tempEdge.sourceId + ' and ' + tempEdge.targetId +
      //  ". Index: " + lca + " Contents: " + lcaGraph.toString() +
      //  ". Depth: " + depth);

      // Update idealLength
      idealLength *= depth * options.nestingFactor;
    }

    tempEdge.idealLength = idealLength;
    tempEdge.elasticity = elasticity;

    layoutInfo.layoutEdges.push(tempEdge);
  }

  // Finally, return layoutInfo object
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
  var graph = layoutInfo.graphSet[graphIx];
  // If both nodes belongs to graphIx
  if (-1 < graph.indexOf(node1) && -1 < graph.indexOf(node2)) {
    return { count: 2, graph: graphIx };
  }

  // Make recursive calls for all subgraphs
  var c = 0;
  for (var i = 0; i < graph.length; i++) {
    var nodeId = graph[i];
    var nodeIx = layoutInfo.idToIndex[nodeId];
    var children = layoutInfo.layoutNodes[nodeIx].children;

    // If the node has no child, skip it
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

  return { count: c, graph: graphIx };
};

/**
 * @brief: printsLayoutInfo into js console
 *         Only used for debbuging
 */
var printLayoutInfo = function printLayoutInfo(layoutInfo) {
  /* eslint-disable */

  if (!DEBUG) {
    return;
  }
  console.debug('layoutNodes:');
  for (var i = 0; i < layoutInfo.nodeSize; i++) {
    var n = layoutInfo.layoutNodes[i];
    var s = '\nindex: ' + i + '\nId: ' + n.id + '\nChildren: ' + n.children.toString() + '\nparentId: ' + n.parentId + '\npositionX: ' + n.positionX + '\npositionY: ' + n.positionY + '\nOffsetX: ' + n.offsetX + '\nOffsetY: ' + n.offsetY + '\npadLeft: ' + n.padLeft + '\npadRight: ' + n.padRight + '\npadTop: ' + n.padTop + '\npadBottom: ' + n.padBottom;

    console.debug(s);
  }

  console.debug('idToIndex');
  for (var i in layoutInfo.idToIndex) {
    console.debug('Id: ' + i + '\nIndex: ' + layoutInfo.idToIndex[i]);
  }

  console.debug('Graph Set');
  var set = layoutInfo.graphSet;
  for (var i = 0; i < set.length; i++) {
    console.debug('Set : ' + i + ': ' + set[i].toString());
  }

  var s = 'IndexToGraph';
  for (var i = 0; i < layoutInfo.indexToGraph.length; i++) {
    s += '\nIndex : ' + i + ' Graph: ' + layoutInfo.indexToGraph[i];
  }
  console.debug(s);

  s = 'Layout Edges';
  for (var i = 0; i < layoutInfo.layoutEdges.length; i++) {
    var e = layoutInfo.layoutEdges[i];
    s += '\nEdge Index: ' + i + ' ID: ' + e.id + ' SouceID: ' + e.sourceId + ' TargetId: ' + e.targetId + ' Ideal Length: ' + e.idealLength;
  }
  console.debug(s);

  s = 'nodeSize: ' + layoutInfo.nodeSize;
  s += '\nedgeSize: ' + layoutInfo.edgeSize;
  s += '\ntemperature: ' + layoutInfo.temperature;
  console.debug(s);

  return;
  /* eslint-enable */
};

/**
 * @brief : Randomizes the position of all nodes
 */
var randomizePositions = function randomizePositions(layoutInfo, cy) {
  var width = layoutInfo.clientWidth;
  var height = layoutInfo.clientHeight;

  for (var i = 0; i < layoutInfo.nodeSize; i++) {
    var n = layoutInfo.layoutNodes[i];

    // No need to randomize compound nodes or locked nodes
    if (0 === n.children.length && !n.isLocked) {
      n.positionX = Math.random() * width;
      n.positionY = Math.random() * height;
    }
  }
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
  var bb = layoutInfo.boundingBox;
  var coseBB = { x1: Infinity, x2: -Infinity, y1: Infinity, y2: -Infinity };

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

  nodes.positions(function (ele, i) {
    var lnode = layoutInfo.layoutNodes[layoutInfo.idToIndex[ele.data('id')]];
    // s = "Node: " + lnode.id + ". Refreshed position: (" +
    // lnode.positionX + ", " + lnode.positionY + ").";
    // logDebug(s);

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
  });

  // Trigger layoutReady only on first call
  if (true !== layoutInfo.ready) {
    // s = 'Triggering layoutready';
    // logDebug(s);
    layoutInfo.ready = true;
    layout.one('layoutready', options.ready);
    layout.emit({ type: 'layoutready', layout: this });
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

module.exports = CoseLayout;

/***/ }),
/* 101 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);
var math = __webpack_require__(2);

var defaults = {
  fit: true, // whether to fit the viewport to the graph
  padding: 30, // padding used on fit
  boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
  avoidOverlap: true, // prevents node overlap, may overflow boundingBox if not enough space
  avoidOverlapPadding: 10, // extra spacing around nodes when avoidOverlap: true
  nodeDimensionsIncludeLabels: false, // Excludes the label when calculating node bounding boxes for the layout algorithm
  spacingFactor: undefined, // Applies a multiplicative factor (>0) to expand or compress the overall area that the nodes take up
  condense: false, // uses all available space on false, uses minimal space on true
  rows: undefined, // force num of rows in the grid
  cols: undefined, // force num of columns in the grid
  position: function position(node) {}, // returns { row, col } for element
  sort: undefined, // a sorting function to order the nodes; e.g. function(a, b){ return a.data('weight') - b.data('weight') }
  animate: false, // whether to transition the node positions
  animationDuration: 500, // duration of animation in ms if enabled
  animationEasing: undefined, // easing of animation if enabled
  animateFilter: function animateFilter(node, i) {
    return true;
  }, // a function that determines whether the node should be animated.  All nodes animated by default on animate enabled.  Non-animated nodes are positioned immediately when the layout starts
  ready: undefined, // callback on layoutready
  stop: undefined, // callback on layoutstop
  transform: function transform(node, position) {
    return position;
  } // transform a given node position. Useful for changing flow direction in discrete layouts 
};

function GridLayout(options) {
  this.options = util.extend({}, defaults, options);
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

  var bb = math.makeBoundingBox(options.boundingBox ? options.boundingBox : {
    x1: 0, y1: 0, w: cy.width(), h: cy.height()
  });

  if (bb.h === 0 || bb.w === 0) {
    nodes.layoutPositions(this, options, function (ele) {
      return { x: bb.x1, y: bb.y1 };
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
    var oCols = options.cols != null ? options.cols : options.columns;

    // if rows or columns were set in options, use those values
    if (oRows != null && oCols != null) {
      rows = oRows;
      cols = oCols;
    } else if (oRows != null && oCols == null) {
      rows = oRows;
      cols = Math.ceil(cells / rows);
    } else if (oRows == null && oCols != null) {
      cols = oCols;
      rows = Math.ceil(cells / cols);
    }

    // otherwise use the automatic values and adjust accordingly

    // if rounding was up, see if we can reduce rows or columns
    else if (cols * rows > cells) {
        var sm = small();
        var lg = large();

        // reducing the small side takes away the most cells, so try it first
        if ((sm - 1) * lg >= cells) {
          small(sm - 1);
        } else if ((lg - 1) * sm >= cells) {
          large(lg - 1);
        }
      } else {

        // if rounding was too low, add rows or columns
        while (cols * rows < cells) {
          var _sm = small();
          var _lg = large();

          // try to add to larger side first (adds less in multiplication)
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
    };

    // to keep track of current cell position
    var row = 0;
    var col = 0;
    var moveToNextCell = function moveToNextCell() {
      col++;
      if (col >= cols) {
        col = 0;
        row++;
      }
    };

    // get a cache of all the manual positions
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
      var x = void 0,
          y = void 0;

      if (element.locked() || element.isParent()) {
        return false;
      }

      // see if we have a manual position set
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

      return { x: x, y: y };
    };

    nodes.layoutPositions(this, options, getPos);
  }

  return this; // chaining
};

module.exports = GridLayout;

/***/ }),
/* 102 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);

// default layout options
var defaults = {
  ready: function ready() {}, // on layoutready
  stop: function stop() {} // on layoutstop
};

// constructor
// options : object containing layout options
function NullLayout(options) {
  this.options = util.extend({}, defaults, options);
}

// runs the layout
NullLayout.prototype.run = function () {
  var options = this.options;
  var eles = options.eles; // elements to consider in the layout
  var layout = this;

  // cy is automatically populated for us in the constructor
  var cy = options.cy; // jshint ignore:line

  layout.emit('layoutstart');

  // puts all nodes at (0, 0)
  eles.nodes().positions(function () {
    return {
      x: 0,
      y: 0
    };
  });

  // trigger layoutready when each node has had its position set at least once
  layout.one('layoutready', options.ready);
  layout.emit('layoutready');

  // trigger layoutstop when the layout stops (e.g. finishes)
  layout.one('layoutstop', options.stop);
  layout.emit('layoutstop');

  return this; // chaining
};

// called on continuous layouts to stop them before they finish
NullLayout.prototype.stop = function () {
  return this; // chaining
};

module.exports = NullLayout;

/***/ }),
/* 103 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);
var is = __webpack_require__(0);

var defaults = {
  positions: undefined, // map of (node id) => (position obj); or function(node){ return somPos; }
  zoom: undefined, // the zoom level to set (prob want fit = false if set)
  pan: undefined, // the pan level to set (prob want fit = false if set)
  fit: true, // whether to fit to viewport
  padding: 30, // padding on fit
  animate: false, // whether to transition the node positions
  animationDuration: 500, // duration of animation in ms if enabled
  animationEasing: undefined, // easing of animation if enabled
  animateFilter: function animateFilter(node, i) {
    return true;
  }, // a function that determines whether the node should be animated.  All nodes animated by default on animate enabled.  Non-animated nodes are positioned immediately when the layout starts
  ready: undefined, // callback on layoutready
  stop: undefined, // callback on layoutstop
  transform: function transform(node, position) {
    return position;
  } // transform a given node position. Useful for changing flow direction in discrete layouts 
};

function PresetLayout(options) {
  this.options = util.extend({}, defaults, options);
}

PresetLayout.prototype.run = function () {
  var options = this.options;
  var eles = options.eles;

  var nodes = eles.nodes();
  var posIsFn = is.fn(options.positions);

  function getPosition(node) {
    if (options.positions == null) {
      return null;
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

module.exports = PresetLayout;

/***/ }),
/* 104 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);
var math = __webpack_require__(2);

var defaults = {
  fit: true, // whether to fit to viewport
  padding: 30, // fit padding
  boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
  animate: false, // whether to transition the node positions
  animationDuration: 500, // duration of animation in ms if enabled
  animationEasing: undefined, // easing of animation if enabled
  animateFilter: function animateFilter(node, i) {
    return true;
  }, // a function that determines whether the node should be animated.  All nodes animated by default on animate enabled.  Non-animated nodes are positioned immediately when the layout starts
  ready: undefined, // callback on layoutready
  stop: undefined, // callback on layoutstop
  transform: function transform(node, position) {
    return position;
  } // transform a given node position. Useful for changing flow direction in discrete layouts 
};

function RandomLayout(options) {
  this.options = util.extend({}, defaults, options);
}

RandomLayout.prototype.run = function () {
  var options = this.options;
  var cy = options.cy;
  var eles = options.eles;
  var nodes = eles.nodes().not(':parent');

  var bb = math.makeBoundingBox(options.boundingBox ? options.boundingBox : {
    x1: 0, y1: 0, w: cy.width(), h: cy.height()
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

module.exports = RandomLayout;

/***/ }),
/* 105 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = [{ name: 'null', impl: __webpack_require__(106) }, { name: 'base', impl: __webpack_require__(107) }, { name: 'canvas', impl: __webpack_require__(123) }];

/***/ }),
/* 106 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function NullRenderer(options) {
  this.options = options;
  this.notifications = 0; // for testing
}

var noop = function noop() {};

NullRenderer.prototype = {
  recalculateRenderedStyle: noop,
  notify: function notify() {
    this.notifications++;
  },
  init: noop
};

module.exports = NullRenderer;

/***/ }),
/* 107 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);
var util = __webpack_require__(1);
var window = __webpack_require__(3);

var BaseRenderer = function BaseRenderer(options) {
  this.init(options);
};
var BR = BaseRenderer;
var BRp = BR.prototype;

BRp.clientFunctions = ['redrawHint', 'render', 'renderTo', 'matchCanvasSize', 'nodeShapeImpl', 'arrowShapeImpl'];

BRp.init = function (options) {
  var r = this;

  r.options = options;

  r.cy = options.cy;

  var ctr = r.container = options.cy.container();

  // prepend a stylesheet in the head such that
  if (window) {
    var document = window.document;
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

    var computedStyle = window.getComputedStyle(ctr);
    var position = computedStyle.getPropertyValue('position');

    if (position === 'static') {
      util.error('A Cytoscape container has style position:static and so can not use UI extensions properly');
    }
  }

  r.selection = [undefined, undefined, undefined, undefined, 0]; // Coordinates for selection box, plus enabled flag

  r.bezierProjPcts = [0.05, 0.225, 0.4, 0.5, 0.6, 0.775, 0.95];

  //--Pointer-related data
  r.hoverData = { down: null, last: null,
    downTime: null, triggerMode: null,
    dragging: false,
    initialPan: [null, null], capture: false };

  r.dragData = { possibleDragElements: [] };

  r.touchData = {
    start: null, capture: false,

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
  r.hideLabelsOnViewport = options.hideLabelsOnViewport;
  r.textureOnViewport = options.textureOnViewport;
  r.wheelSensitivity = options.wheelSensitivity;
  r.motionBlurEnabled = options.motionBlur; // on by default
  r.forcedPixelRatio = options.pixelRatio;
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
  r.beforeRenderPriorities = { // higher priority execs before lower one
    animations: 400,
    eleCalcs: 300,
    eleTxrDeq: 200,
    lyrTxrDeq: 100
  };

  r.registerNodeShapes();
  r.registerArrowShapes();
  r.registerCalculationListeners();
};

BRp.notify = function (params) {
  var types;
  var r = this;

  // the renderer can't be notified after it's destroyed
  if (this.destroyed) {
    return;
  }

  if (is.array(params.type)) {
    types = params.type;
  } else {
    types = [params.type];
  }

  var has = {};
  for (var i = 0; i < types.length; i++) {
    var type = types[i];

    has[type] = true;
  } // for

  if (has['init']) {
    r.load();
    return;
  }

  if (has['destroy']) {
    r.destroy();
    return;
  }

  if (has['add'] || has['remove'] || has['load'] || has['zorder']) {
    r.invalidateCachedZSortedEles();
  }

  if (has['viewport']) {
    r.redrawHint('select', true);
  }

  if (has['load'] || has['resize']) {
    r.invalidateContainerClientCoordsCache();
    r.matchCanvasSize(r.container);
  }

  r.redrawHint('eles', true);
  r.redrawHint('drag', true);

  this.startRenderLoop();

  this.redraw();
};

BRp.destroy = function () {
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

  if (r.labelCalcDiv) {
    try {
      document.body.removeChild(r.labelCalcDiv); // eslint-disable-line no-undef
    } catch (e) {
      // ie10 issue #1014
    }
  }
};

[__webpack_require__(108), __webpack_require__(109), __webpack_require__(119), __webpack_require__(120), __webpack_require__(121), __webpack_require__(122)].forEach(function (props) {
  util.extend(BRp, props);
});

module.exports = BR;

/***/ }),
/* 108 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var math = __webpack_require__(2);
var is = __webpack_require__(0);
var util = __webpack_require__(1);

var BRp = {};

BRp.arrowShapeWidth = 0.3;

BRp.registerArrowShapes = function () {
  var arrowShapes = this.arrowShapes = {};
  var renderer = this;

  // Contract for arrow shapes:
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
    if (is.string(defn)) {
      defn = arrowShapes[defn];
    }

    arrowShapes[name] = util.extend({
      name: name,

      points: [-0.15, -0.3, 0.15, -0.3, 0.15, 0.3, -0.15, 0.3],

      collide: function collide(x, y, size, angle, translation, padding) {
        var points = pointsToArr(transformPoints(this.points, size + 2 * padding, angle, translation));
        var inside = math.pointInsidePolygonPoints(x, y, points);

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
    collide: util.falsify,

    roughCollide: util.falsify,

    draw: util.noop,

    spacing: util.zeroify,

    gap: util.zeroify
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
    points: [-0.15, -0.3, 0, 0, 0.15, -0.3, -0.15, -0.3],

    pointsTee: [-0.15, -0.4, -0.15, -0.5, 0.15, -0.5, 0.15, -0.4],

    collide: function collide(x, y, size, angle, translation, edgeWidth, padding) {
      var triPts = pointsToArr(transformPoints(this.points, size + 2 * padding, angle, translation));
      var teePts = pointsToArr(transformPoints(this.pointsTee, size + 2 * padding, angle, translation));

      var inside = math.pointInsidePolygonPoints(x, y, triPts) || math.pointInsidePolygonPoints(x, y, teePts);

      return inside;
    },

    draw: function draw(context, size, angle, translation, edgeWidth) {
      var triPts = transformPoints(this.points, size, angle, translation);
      var teePts = transformPoints(this.pointsTee, size, angle, translation);

      renderer.arrowShapeImpl(this.name)(context, triPts, teePts);
    }
  });

  defineArrowShape('triangle-cross', {
    points: [-0.15, -0.3, 0, 0, 0.15, -0.3, -0.15, -0.3],

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
      var inside = math.pointInsidePolygonPoints(x, y, triPts) || math.pointInsidePolygonPoints(x, y, teePts);

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
};

module.exports = BRp;

/***/ }),
/* 109 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);

var BRp = {};

[__webpack_require__(110), __webpack_require__(111), __webpack_require__(112), __webpack_require__(113), __webpack_require__(114), __webpack_require__(115), __webpack_require__(116), __webpack_require__(117), __webpack_require__(118)].forEach(function (props) {
  util.extend(BRp, props);
});

module.exports = BRp;

/***/ }),
/* 110 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var window = __webpack_require__(3);
var math = __webpack_require__(2);
var util = __webpack_require__(1);
var window = __webpack_require__(3);

var BRp = {};

// Project mouse
BRp.projectIntoViewport = function (clientX, clientY) {
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

BRp.findContainerClientCoords = function () {
  if (this.containerBB) {
    return this.containerBB;
  }

  var container = this.container;
  var rect = container.getBoundingClientRect();
  var style = window.getComputedStyle(container);
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
  var borderVer = border.top + border.bottom;

  var scale = rect.width / (clientWidth + borderHor);

  var unscaledW = clientWidth - paddingHor;
  var unscaledH = clientHeight - paddingVer;

  var scaledW = rect.width - (paddingHor + borderHor) * scale;
  var scaledH = rect.height - (paddingVer + borderVer) * scale;

  var left = rect.left + padding.left + border.left;
  var top = rect.top + padding.top + border.top;

  return this.containerBB = [left, top, unscaledW, unscaledH, scale];
};

BRp.invalidateContainerClientCoordsCache = function () {
  this.containerBB = null;
};

BRp.findNearestElement = function (x, y, interactiveElementsOnly, isTouch) {
  return this.findNearestElements(x, y, interactiveElementsOnly, isTouch)[0];
};

BRp.findNearestElements = function (x, y, interactiveElementsOnly, isTouch) {
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
        if (nearEdge.pstyle('z-index').value === ele.pstyle('z-index').value) {
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
    var inEdgeBB = false;
    var sqDist;

    if (rs.edgeType === 'segments' || rs.edgeType === 'straight' || rs.edgeType === 'haystack') {
      var pts = rs.allpts;

      for (var i = 0; i + 3 < pts.length; i += 2) {
        if ((inEdgeBB = math.inLineVicinity(x, y, pts[i], pts[i + 1], pts[i + 2], pts[i + 3], width2)) && widthSq > (sqDist = math.sqdistToFiniteLine(x, y, pts[i], pts[i + 1], pts[i + 2], pts[i + 3]))) {
          addEle(edge, sqDist);
          return true;
        }
      }
    } else if (rs.edgeType === 'bezier' || rs.edgeType === 'multibezier' || rs.edgeType === 'self' || rs.edgeType === 'compound') {
      var pts = rs.allpts;
      for (var i = 0; i + 5 < rs.allpts.length; i += 4) {
        if ((inEdgeBB = math.inBezierVicinity(x, y, pts[i], pts[i + 1], pts[i + 2], pts[i + 3], pts[i + 4], pts[i + 5], width2)) && widthSq > (sqDist = math.sqdistToQuadraticBezier(x, y, pts[i], pts[i + 1], pts[i + 2], pts[i + 3], pts[i + 4], pts[i + 5]))) {
          addEle(edge, sqDist);
          return true;
        }
      }
    }

    // if we're close to the edge but didn't hit it, maybe we hit its arrows

    var src = src || _p.source;
    var tgt = tgt || _p.target;

    var arSize = self.getArrowWidth(styleWidth, scale);

    var arrows = [{ name: 'source', x: rs.arrowStartX, y: rs.arrowStartY, angle: rs.srcArrowAngle }, { name: 'target', x: rs.arrowEndX, y: rs.arrowEndY, angle: rs.tgtArrowAngle }, { name: 'mid-source', x: rs.midX, y: rs.midY, angle: rs.midsrcArrowAngle }, { name: 'mid-target', x: rs.midX, y: rs.midY, angle: rs.midtgtArrowAngle }];

    for (var i = 0; i < arrows.length; i++) {
      var ar = arrows[i];
      var shape = r.arrowShapes[edge.pstyle(ar.name + '-arrow-shape').value];
      var edgeWidth = edge.pstyle('width').pfValue;
      if (shape.roughCollide(x, y, arSize, ar.angle, { x: ar.x, y: ar.y }, edgeWidth, edgeThreshold) && shape.collide(x, y, arSize, ar.angle, { x: ar.x, y: ar.y }, edgeWidth, edgeThreshold)) {
        addEle(edge);
        return true;
      }
    }

    // for compound graphs, hitting edge may actually want a connected node instead (b/c edge may have greater z-index precedence)
    if (hasCompounds && near.length > 0) {
      checkNode(src);
      checkNode(tgt);
    }
  }

  function preprop(obj, name, pre) {
    return util.getPrefixedProperty(obj, name, pre);
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

    var text = ele.pstyle(prefixDash + 'label').value;
    var eventsEnabled = ele.pstyle('text-events').strValue === 'yes';

    if (!eventsEnabled || !text) {
      return;
    }

    var rstyle = _p.rstyle;
    var bw = ele.pstyle('text-border-width').pfValue;
    var pw = ele.pstyle('text-background-padding').pfValue;
    var lw = preprop(rstyle, 'labelWidth', prefix) + bw + 2 * th + 2 * pw;
    var lh = preprop(rstyle, 'labelHeight', prefix) + bw + 2 * th + 2 * pw;
    var lx = preprop(rstyle, 'labelX', prefix);
    var ly = preprop(rstyle, 'labelY', prefix);

    var theta = preprop(_p.rscratch, 'labelAngle', prefix);

    var lx1 = lx - lw / 2;
    var lx2 = lx + lw / 2;
    var ly1 = ly - lh / 2;
    var ly2 = ly + lh / 2;

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

      if (math.pointInsidePolygonPoints(x, y, points)) {
        addEle(ele);
        return true;
      }
    } else {
      // do a cheaper bb check
      var bb = {
        w: lw,
        h: lh,
        x1: lx1,
        x2: lx2,
        y1: ly1,
        y2: ly2
      };

      if (math.inBoundingBox(bb, x, y)) {
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
};

// 'Give me everything from this box'
BRp.getAllInBox = function (x1, y1, x2, y2) {
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

  var boxBb = math.makeBoundingBox({
    x1: x1, y1: y1,
    x2: x2, y2: y2
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

      if (math.boundingBoxesIntersect(boxBb, nodeBb) && !math.boundingBoxInBoundingBox(nodeBb, boxBb)) {
        box.push(node);
      }
    } else {
      var edge = ele;
      var _p = edge._private;
      var rs = _p.rscratch;

      if (rs.startX != null && rs.startY != null && !math.inBoundingBox(boxBb, rs.startX, rs.startY)) {
        continue;
      }
      if (rs.endX != null && rs.endY != null && !math.inBoundingBox(boxBb, rs.endX, rs.endY)) {
        continue;
      }

      if (rs.edgeType === 'bezier' || rs.edgeType === 'multibezier' || rs.edgeType === 'self' || rs.edgeType === 'compound' || rs.edgeType === 'segments' || rs.edgeType === 'haystack') {

        var pts = _p.rstyle.bezierPts || _p.rstyle.linePts || _p.rstyle.haystackPts;
        var allInside = true;

        for (var i = 0; i < pts.length; i++) {
          if (!math.pointInBoundingBox(boxBb, pts[i])) {
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

module.exports = BRp;

/***/ }),
/* 111 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var math = __webpack_require__(2);

var BRp = {};

BRp.calculateArrowAngles = function (edge) {
  var rs = edge._private.rscratch;
  var isHaystack = rs.edgeType === 'haystack';
  var isBezier = rs.edgeType === 'bezier';
  var isMultibezier = rs.edgeType === 'multibezier';
  var isSegments = rs.edgeType === 'segments';
  var isCompound = rs.edgeType === 'compound';
  var isSelf = rs.edgeType === 'self';

  // Displacement gives direction for arrowhead orientation
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
  midY = rs.midY;

  // source
  //

  if (isSegments) {
    dispX = startX - rs.segpts[0];
    dispY = startY - rs.segpts[1];
  } else if (isMultibezier || isCompound || isSelf || isBezier) {
    var pts = rs.allpts;
    var bX = math.qbezierAt(pts[0], pts[2], pts[4], 0.1);
    var bY = math.qbezierAt(pts[1], pts[3], pts[5], 0.1);

    dispX = startX - bX;
    dispY = startY - bY;
  } else {
    dispX = startX - midX;
    dispY = startY - midY;
  }

  rs.srcArrowAngle = math.getAngleFromDisp(dispX, dispY);

  // mid target
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

      bp0x = math.qbezierAt(pts[p0], pts[ic], pts[p1], 0.0);
      bp0y = math.qbezierAt(pts[p0 + 1], pts[ic + 1], pts[p1 + 1], 0.0);

      bp1x = math.qbezierAt(pts[p0], pts[ic], pts[p1], 0.0001);
      bp1y = math.qbezierAt(pts[p0 + 1], pts[ic + 1], pts[p1 + 1], 0.0001);
    } else {
      var ic = pts.length / 2 - 1; // ctrpt
      var p0 = ic - 2; // startpt
      var p1 = ic + 2; // endpt

      bp0x = math.qbezierAt(pts[p0], pts[ic], pts[p1], 0.4999);
      bp0y = math.qbezierAt(pts[p0 + 1], pts[ic + 1], pts[p1 + 1], 0.4999);

      bp1x = math.qbezierAt(pts[p0], pts[ic], pts[p1], 0.5);
      bp1y = math.qbezierAt(pts[p0 + 1], pts[ic + 1], pts[p1 + 1], 0.5);
    }

    dispX = bp1x - bp0x;
    dispY = bp1y - bp0y;
  }

  rs.midtgtArrowAngle = math.getAngleFromDisp(dispX, dispY);

  rs.midDispX = dispX;
  rs.midDispY = dispY;

  // mid source
  //

  dispX *= -1;
  dispY *= -1;

  if (isSegments) {
    var pts = rs.allpts;

    if (pts.length / 2 % 2 === 0) {
      // already ok
    } else {
      var i2 = pts.length / 2 - 1;
      var i3 = i2 + 2;

      dispX = -(pts[i3] - pts[i2]);
      dispY = -(pts[i3 + 1] - pts[i2 + 1]);
    }
  }

  rs.midsrcArrowAngle = math.getAngleFromDisp(dispX, dispY);

  // target
  //

  if (isSegments) {
    dispX = endX - rs.segpts[rs.segpts.length - 2];
    dispY = endY - rs.segpts[rs.segpts.length - 1];
  } else if (isMultibezier || isCompound || isSelf || isBezier) {
    var pts = rs.allpts;
    var l = pts.length;
    var bX = math.qbezierAt(pts[l - 6], pts[l - 4], pts[l - 2], 0.9);
    var bY = math.qbezierAt(pts[l - 5], pts[l - 3], pts[l - 1], 0.9);

    dispX = endX - bX;
    dispY = endY - bY;
  } else {
    dispX = endX - midX;
    dispY = endY - midY;
  }

  rs.tgtArrowAngle = math.getAngleFromDisp(dispX, dispY);
};

BRp.getArrowWidth = BRp.getArrowHeight = function (edgeWidth, scale) {
  var cache = this.arrowWidthCache = this.arrowWidthCache || {};

  var cachedVal = cache[edgeWidth + ', ' + scale];
  if (cachedVal) {
    return cachedVal;
  }

  cachedVal = Math.max(Math.pow(edgeWidth * 13.37, 0.9), 29) * scale;
  cache[edgeWidth + ', ' + scale] = cachedVal;

  return cachedVal;
};

module.exports = BRp;

/***/ }),
/* 112 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var math = __webpack_require__(2);
var is = __webpack_require__(0);

var BRp = {};

BRp.findEdgeControlPoints = function (edges) {
  if (!edges || edges.length === 0) {
    return;
  }

  var r = this;
  var cy = r.cy;
  var hasCompounds = cy.hasCompoundNodes();
  var hashTable = {};
  var pairIds = [];
  var haystackEdges = [];

  // create a table of edge (src, tgt) => list of edges between them
  var pairId;
  for (var i = 0; i < edges.length; i++) {
    var edge = edges[i];
    var _p = edge._private;
    var data = _p.data;
    var curveStyle = edge.pstyle('curve-style').value;
    var edgeIsUnbundled = curveStyle === 'unbundled-bezier' || curveStyle === 'segments';
    var edgeIsBezier = curveStyle === 'unbundled-bezier' || curveStyle === 'bezier';

    // ignore edges who are not to be displayed
    // they shouldn't take up space
    if (edge.pstyle('display').value === 'none') {
      continue;
    }

    if (curveStyle === 'haystack') {
      haystackEdges.push(edge);
      continue;
    }

    var srcId = data.source;
    var tgtId = data.target;

    pairId = srcId > tgtId ? tgtId + '$-$' + srcId : srcId + '$-$' + tgtId;

    if (edgeIsUnbundled) {
      pairId = 'unbundled' + '$-$' + data.id;
    }

    var tableEntry = hashTable[pairId];

    if (tableEntry == null) {
      tableEntry = hashTable[pairId] = [];
      pairIds.push(pairId);
    }

    tableEntry.push(edge);

    if (edgeIsUnbundled) {
      tableEntry.hasUnbundled = true;
    }

    if (edgeIsBezier) {
      tableEntry.hasBezier = true;
    }
  }

  var src, tgt, srcPos, tgtPos, srcW, srcH, tgtW, tgtH, srcShape, tgtShape;
  var vectorNormInverse;
  var badBezier;

  // for each pair (src, tgt), create the ctrl pts
  // Nested for loop is OK; total number of iterations for both loops = edgeCount
  for (var p = 0; p < pairIds.length; p++) {
    pairId = pairIds[p];
    var pairEdges = hashTable[pairId];

    // for each pair id, the edges should be sorted by index
    pairEdges.sort(function (edge1, edge2) {
      return edge1.poolIndex() - edge2.poolIndex();
    });

    src = pairEdges[0]._private.source;
    tgt = pairEdges[0]._private.target;

    // make sure src/tgt distinction is consistent for bundled edges
    if (!pairEdges.hasUnbundled && src.id() > tgt.id()) {
      var temp = src;
      src = tgt;
      tgt = temp;
    }

    srcPos = src.position();
    tgtPos = tgt.position();

    srcW = src.outerWidth();
    srcH = src.outerHeight();

    tgtW = tgt.outerWidth();
    tgtH = tgt.outerHeight();

    srcShape = r.nodeShapes[this.getNodeShape(src)];
    tgtShape = r.nodeShapes[this.getNodeShape(tgt)];

    badBezier = false;

    var edge;
    var edge_p;
    var rs;

    var dirCounts = {
      'north': 0,
      'west': 0,
      'south': 0,
      'east': 0,
      'northwest': 0,
      'southwest': 0,
      'northeast': 0,
      'southeast': 0
    };

    var srcX2 = srcPos.x;
    var srcY2 = srcPos.y;
    var srcW2 = srcW;
    var srcH2 = srcH;

    var tgtX2 = tgtPos.x;
    var tgtY2 = tgtPos.y;
    var tgtW2 = tgtW;
    var tgtH2 = tgtH;

    var numEdges2 = pairEdges.length;

    for (var i = 0; i < pairEdges.length; i++) {
      edge = pairEdges[i];
      edge_p = edge._private;
      rs = edge_p.rscratch;

      var edgeIndex1 = rs.lastEdgeIndex;
      var edgeIndex2 = i;

      var numEdges1 = rs.lastNumEdges;

      var curveStyle = edge.pstyle('curve-style').value;

      var edgeIsUnbundled = curveStyle === 'unbundled-bezier' || curveStyle === 'segments';

      // whether the normalised pair order is the reverse of the edge's src-tgt order
      var edgeIsSwapped = src.id() !== edge.source().id();

      var ctrlptDists = edge.pstyle('control-point-distances');
      var loopDir = edge.pstyle('loop-direction').pfValue;
      var loopSwp = edge.pstyle('loop-sweep').pfValue;
      var ctrlptWs = edge.pstyle('control-point-weights');
      var bezierN = ctrlptDists && ctrlptWs ? Math.min(ctrlptDists.value.length, ctrlptWs.value.length) : 1;
      var stepSize = edge.pstyle('control-point-step-size').pfValue;
      var ctrlptDist = ctrlptDists ? ctrlptDists.pfValue[0] : undefined;
      var ctrlptWeight = ctrlptWs.value[0];
      var edgeDistances = edge.pstyle('edge-distances').value;
      var segmentWs = edge.pstyle('segment-weights');
      var segmentDs = edge.pstyle('segment-distances');
      var segmentsN = Math.min(segmentWs.pfValue.length, segmentDs.pfValue.length);
      var srcEndpt = edge.pstyle('source-endpoint').value;
      var tgtEndpt = edge.pstyle('target-endpoint').value;
      var srcArrShape = edge.pstyle('source-arrow-shape').value;
      var tgtArrShape = edge.pstyle('target-arrow-shape').value;
      var arrowScale = edge.pstyle('arrow-scale').value;
      var lineWidth = edge.pstyle('width').pfValue;

      var srcX1 = rs.lastSrcCtlPtX;
      var srcY1 = rs.lastSrcCtlPtY;
      var srcW1 = rs.lastSrcCtlPtW;
      var srcH1 = rs.lastSrcCtlPtH;

      var tgtX1 = rs.lastTgtCtlPtX;
      var tgtY1 = rs.lastTgtCtlPtY;
      var tgtW1 = rs.lastTgtCtlPtW;
      var tgtH1 = rs.lastTgtCtlPtH;

      var curveStyle1 = rs.lastCurveStyle;
      var curveStyle2 = curveStyle;

      var ctrlptDists1 = rs.lastCtrlptDists;
      var ctrlptDists2 = ctrlptDists ? ctrlptDists.strValue : null;

      var ctrlptWs1 = rs.lastCtrlptWs;
      var ctrlptWs2 = ctrlptWs.strValue;

      var segmentWs1 = rs.lastSegmentWs;
      var segmentWs2 = segmentWs.strValue;

      var segmentDs1 = rs.lastSegmentDs;
      var segmentDs2 = segmentDs.strValue;

      var stepSize1 = rs.lastStepSize;
      var stepSize2 = stepSize;

      var loopDir1 = rs.lastLoopDir;
      var loopDir2 = loopDir;

      var loopSwp1 = rs.lastLoopSwp;
      var loopSwp2 = loopSwp;

      var edgeDistances1 = rs.lastEdgeDistances;
      var edgeDistances2 = edgeDistances;

      var srcEndpt1 = rs.lastSrcEndpt;
      var srcEndpt2 = srcEndpt;

      var tgtEndpt1 = rs.lastTgtEndpt;
      var tgtEndpt2 = tgtEndpt;

      var srcArr1 = rs.lastSrcArr;
      var srcArr2 = srcArrShape;

      var tgtArr1 = rs.lastTgtArr;
      var tgtArr2 = tgtArrShape;

      var lineW1 = rs.lastLineW;
      var lineW2 = lineWidth;

      var arrScl1 = rs.lastArrScl;
      var arrScl2 = arrowScale;

      if (badBezier) {
        rs.badBezier = true;
      } else {
        rs.badBezier = false;
      }

      var ptCacheHit;

      if (srcX1 === srcX2 && srcY1 === srcY2 && srcW1 === srcW2 && srcH1 === srcH2 && tgtX1 === tgtX2 && tgtY1 === tgtY2 && tgtW1 === tgtW2 && tgtH1 === tgtH2 && curveStyle1 === curveStyle2 && ctrlptDists1 === ctrlptDists2 && ctrlptWs1 === ctrlptWs2 && segmentWs1 === segmentWs2 && segmentDs1 === segmentDs2 && stepSize1 === stepSize2 && loopDir1 === loopDir2 && loopSwp1 === loopSwp2 && edgeDistances1 === edgeDistances2 && srcEndpt1 === srcEndpt2 && tgtEndpt1 === tgtEndpt2 && srcArr1 === srcArr2 && tgtArr1 === tgtArr2 && lineW1 === lineW2 && arrScl1 === arrScl2 && (edgeIndex1 === edgeIndex2 && numEdges1 === numEdges2 || edgeIsUnbundled)) {
        ptCacheHit = true; // then the control points haven't changed and we can skip calculating them
      } else {
        ptCacheHit = false;

        rs.lastSrcCtlPtX = srcX2;
        rs.lastSrcCtlPtY = srcY2;
        rs.lastSrcCtlPtW = srcW2;
        rs.lastSrcCtlPtH = srcH2;
        rs.lastTgtCtlPtX = tgtX2;
        rs.lastTgtCtlPtY = tgtY2;
        rs.lastTgtCtlPtW = tgtW2;
        rs.lastTgtCtlPtH = tgtH2;
        rs.lastEdgeIndex = edgeIndex2;
        rs.lastNumEdges = numEdges2;
        rs.lastCurveStyle = curveStyle2;
        rs.lastCtrlptDists = ctrlptDists2;
        rs.lastCtrlptWs = ctrlptWs2;
        rs.lastSegmentDs = segmentDs2;
        rs.lastSegmentWs = segmentWs2;
        rs.lastStepSize = stepSize2;
        rs.lastLoopDir = loopDir2;
        rs.lastLoopSwp = loopSwp2;
        rs.lastEdgeDistances = edgeDistances2;
        rs.lastSrcEndpt = srcEndpt2;
        rs.lastTgtEndpt = tgtEndpt2;
        rs.lastSrcArr = srcArr2;
        rs.lastTgtArr = tgtArr2;
        rs.lastLineW = lineW2;
        rs.lastArrScl = arrScl2;
      }

      if (!ptCacheHit) {

        if (!pairEdges.calculatedIntersection && src !== tgt && (pairEdges.hasBezier || pairEdges.hasUnbundled)) {

          pairEdges.calculatedIntersection = true;

          // pt outside src shape to calc distance/displacement from src to tgt
          var srcOutside = srcShape.intersectLine(srcPos.x, srcPos.y, srcW, srcH, tgtPos.x, tgtPos.y, 0);

          pairEdges.srcIntn = srcOutside;

          // pt outside tgt shape to calc distance/displacement from src to tgt
          var tgtOutside = tgtShape.intersectLine(tgtPos.x, tgtPos.y, tgtW, tgtH, srcPos.x, srcPos.y, 0);

          pairEdges.tgtIntn = tgtOutside;

          var midptSrcPts = {
            x1: srcOutside[0],
            x2: tgtOutside[0],
            y1: srcOutside[1],
            y2: tgtOutside[1]
          };

          var posPts = {
            x1: srcPos.x,
            x2: tgtPos.x,
            y1: srcPos.y,
            y2: tgtPos.y
          };

          var dy = tgtOutside[1] - srcOutside[1];
          var dx = tgtOutside[0] - srcOutside[0];
          var l = Math.sqrt(dx * dx + dy * dy);

          var vector = {
            x: dx,
            y: dy
          };

          var vectorNorm = {
            x: vector.x / l,
            y: vector.y / l
          };
          vectorNormInverse = {
            x: -vectorNorm.y,
            y: vectorNorm.x
          };

          // if node shapes overlap, then no ctrl pts to draw
          if (tgtShape.checkPoint(srcOutside[0], srcOutside[1], 0, tgtW, tgtH, tgtPos.x, tgtPos.y) && srcShape.checkPoint(tgtOutside[0], tgtOutside[1], 0, srcW, srcH, srcPos.x, srcPos.y)) {
            vectorNormInverse = {};
            badBezier = true;
          }
        }

        if (!edgeIsSwapped) {
          rs.srcIntn = pairEdges.srcIntn;
          rs.tgtIntn = pairEdges.tgtIntn;
        } else {
          // ensure that the per-edge cached value for intersections are correct for swapped bundled edges
          rs.srcIntn = pairEdges.tgtIntn;
          rs.tgtIntn = pairEdges.srcIntn;
        }

        if (src === tgt) {
          // Self-edge

          rs.edgeType = 'self';

          var j = i;
          var loopDist = stepSize;

          if (edgeIsUnbundled) {
            j = 0;
            loopDist = ctrlptDist;
          }

          var loopAngle = loopDir - Math.PI / 2;
          var outAngle = loopAngle - loopSwp / 2;
          var inAngle = loopAngle + loopSwp / 2;

          // increase by step size for overlapping loops, keyed on direction and sweep values
          var dc = String(loopDir + '_' + loopSwp);
          j = dirCounts[dc] === undefined ? dirCounts[dc] = 0 : ++dirCounts[dc];

          rs.ctrlpts = [srcPos.x + Math.cos(outAngle) * 1.4 * loopDist * (j / 3 + 1), srcPos.y + Math.sin(outAngle) * 1.4 * loopDist * (j / 3 + 1), srcPos.x + Math.cos(inAngle) * 1.4 * loopDist * (j / 3 + 1), srcPos.y + Math.sin(inAngle) * 1.4 * loopDist * (j / 3 + 1)];
        } else if (hasCompounds && (src.isParent() || src.isChild() || tgt.isParent() || tgt.isChild()) && (src.parents().anySame(tgt) || tgt.parents().anySame(src))) {
          // Compound edge

          rs.edgeType = 'compound';

          // because the line approximation doesn't apply for compound beziers
          // (loop/self edges are already elided b/c of cheap src==tgt check)
          rs.badBezier = false;

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
          };

          // avoids cases with impossible beziers
          var minCompoundStretch = 0.5;
          var compoundStretchA = Math.max(minCompoundStretch, Math.log(srcW * 0.01));
          var compoundStretchB = Math.max(minCompoundStretch, Math.log(tgtW * 0.01));

          rs.ctrlpts = [loopPos.x, loopPos.y - (1 + Math.pow(loopW, 1.12) / 100) * loopDist * (j / 3 + 1) * compoundStretchA, loopPos.x - (1 + Math.pow(loopW, 1.12) / 100) * loopDist * (j / 3 + 1) * compoundStretchB, loopPos.y];
        } else if (curveStyle === 'segments') {
          // Segments (multiple straight lines)

          rs.edgeType = 'segments';
          rs.segpts = [];

          for (var s = 0; s < segmentsN; s++) {
            var w = segmentWs.pfValue[s];
            var d = segmentDs.pfValue[s];

            var w1 = 1 - w;
            var w2 = w;

            var midptPts = edgeDistances === 'node-position' ? posPts : midptSrcPts;

            var adjustedMidpt = {
              x: midptPts.x1 * w1 + midptPts.x2 * w2,
              y: midptPts.y1 * w1 + midptPts.y2 * w2
            };

            rs.segpts.push(adjustedMidpt.x + vectorNormInverse.x * d, adjustedMidpt.y + vectorNormInverse.y * d);
          }

          // Straight edge
        } else if (pairEdges.length % 2 === 1 && i === Math.floor(pairEdges.length / 2) && !edgeIsUnbundled) {

          rs.edgeType = 'straight';
        } else {
          // (Multi)bezier

          var multi = edgeIsUnbundled;

          rs.edgeType = multi ? 'multibezier' : 'bezier';
          rs.ctrlpts = [];

          for (var b = 0; b < bezierN; b++) {
            var normctrlptDist = (0.5 - pairEdges.length / 2 + i) * stepSize;
            var manctrlptDist;
            var sign = math.signum(normctrlptDist);

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

            if (edgeIsSwapped) {
              var temp = w1;
              w1 = w2;
              w2 = temp;
            }

            var midptPts = edgeDistances === 'node-position' ? posPts : midptSrcPts;

            var adjustedMidpt = {
              x: midptPts.x1 * w1 + midptPts.x2 * w2,
              y: midptPts.y1 * w1 + midptPts.y2 * w2
            };

            rs.ctrlpts.push(adjustedMidpt.x + vectorNormInverse.x * distanceFromMidpoint, adjustedMidpt.y + vectorNormInverse.y * distanceFromMidpoint);
          }
        }

        // find endpts for edge
        this.findEndpoints(edge);

        var badStart = !is.number(rs.startX) || !is.number(rs.startY);
        var badAStart = !is.number(rs.arrowStartX) || !is.number(rs.arrowStartY);
        var badEnd = !is.number(rs.endX) || !is.number(rs.endY);
        var badAEnd = !is.number(rs.arrowEndX) || !is.number(rs.arrowEndY);

        var minCpADistFactor = 3;
        var arrowW = this.getArrowWidth(edge.pstyle('width').pfValue, edge.pstyle('arrow-scale').value) * this.arrowShapeWidth;
        var minCpADist = minCpADistFactor * arrowW;

        if (rs.edgeType === 'bezier') {
          var startACpDist = math.dist({ x: rs.ctrlpts[0], y: rs.ctrlpts[1] }, { x: rs.startX, y: rs.startY });
          var closeStartACp = startACpDist < minCpADist;
          var endACpDist = math.dist({ x: rs.ctrlpts[0], y: rs.ctrlpts[1] }, { x: rs.endX, y: rs.endY });
          var closeEndACp = endACpDist < minCpADist;

          var overlapping = false;

          if (badStart || badAStart || closeStartACp) {
            overlapping = true;

            // project control point along line from src centre to outside the src shape
            // (otherwise intersection will yield nothing)
            var cpD = { // delta
              x: rs.ctrlpts[0] - srcPos.x,
              y: rs.ctrlpts[1] - srcPos.y
            };
            var cpL = Math.sqrt(cpD.x * cpD.x + cpD.y * cpD.y); // length of line
            var cpM = { // normalised delta
              x: cpD.x / cpL,
              y: cpD.y / cpL
            };
            var radius = Math.max(srcW, srcH);
            var cpProj = { // *2 radius guarantees outside shape
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
            overlapping = true;

            // project control point along line from tgt centre to outside the tgt shape
            // (otherwise intersection will yield nothing)
            var cpD = { // delta
              x: rs.ctrlpts[0] - tgtPos.x,
              y: rs.ctrlpts[1] - tgtPos.y
            };
            var cpL = Math.sqrt(cpD.x * cpD.x + cpD.y * cpD.y); // length of line
            var cpM = { // normalised delta
              x: cpD.x / cpL,
              y: cpD.y / cpL
            };
            var radius = Math.max(srcW, srcH);
            var cpProj = { // *2 radius guarantees outside shape
              x: rs.ctrlpts[0] + cpM.x * 2 * radius,
              y: rs.ctrlpts[1] + cpM.y * 2 * radius
            };

            var tgtCtrlPtIntn = tgtShape.intersectLine(tgtPos.x, tgtPos.y, tgtW, tgtH, cpProj.x, cpProj.y, 0);

            if (closeEndACp) {
              rs.ctrlpts[0] = rs.ctrlpts[0] + cpM.x * (minCpADist - endACpDist);
              rs.ctrlpts[1] = rs.ctrlpts[1] + cpM.y * (minCpADist - endACpDist);
            } else {
              rs.ctrlpts[0] = tgtCtrlPtIntn[0] + cpM.x * minCpADist;
              rs.ctrlpts[1] = tgtCtrlPtIntn[1] + cpM.y * minCpADist;
            }
          }

          if (overlapping) {
            // recalc endpts
            this.findEndpoints(edge);
          }
        }

        if (rs.edgeType === 'multibezier' || rs.edgeType === 'bezier' || rs.edgeType === 'self' || rs.edgeType === 'compound') {
          rs.allpts = [];

          rs.allpts.push(rs.startX, rs.startY);

          for (var b = 0; b + 1 < rs.ctrlpts.length; b += 2) {
            // ctrl pt itself
            rs.allpts.push(rs.ctrlpts[b], rs.ctrlpts[b + 1]);

            // the midpt between ctrlpts as intermediate destination pts
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

            rs.midX = math.qbezierAt(rs.allpts[m], rs.allpts[m + 2], rs.allpts[m + 4], mt);
            rs.midY = math.qbezierAt(rs.allpts[m + 1], rs.allpts[m + 3], rs.allpts[m + 5], mt);
          }
        } else if (rs.edgeType === 'straight') {
          // need to calc these after endpts
          rs.allpts = [rs.startX, rs.startY, rs.endX, rs.endY];

          // default midpt for labels etc
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
            var i1 = rs.segpts.length / 2 - 1;

            rs.midX = rs.segpts[i1];
            rs.midY = rs.segpts[i1 + 1];
          }
        }

        this.storeEdgeProjections(edge);
        this.calculateArrowAngles(edge);
      } // if point cache miss

      this.recalculateEdgeLabelProjections(edge);
      this.calculateLabelAngles(edge);
    } // for pair edges
  } // for pair ids

  for (var i = 0; i < haystackEdges.length; i++) {
    var edge = haystackEdges[i];
    var _p = edge._private;
    var rscratch = _p.rscratch;
    var rs = rscratch;

    if (!rscratch.haystack) {
      var angle = Math.random() * 2 * Math.PI;

      rscratch.source = {
        x: Math.cos(angle),
        y: Math.sin(angle)
      };

      var angle = Math.random() * 2 * Math.PI;

      rscratch.target = {
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
    rs.midY = (rs.allpts[1] + rs.allpts[3]) / 2;

    // always override as haystack in case set to different type previously
    rscratch.edgeType = rscratch.lastCurveStyle = 'haystack';
    rscratch.haystack = true;

    this.storeEdgeProjections(edge);
    this.calculateArrowAngles(edge);
    this.recalculateEdgeLabelProjections(edge);
    this.calculateLabelAngles(edge);
  }
};

function getPts(pts) {
  var retPts = [];

  if (pts == null) {
    return;
  }

  for (var i = 0; i < pts.length; i += 2) {
    var x = pts[i];
    var y = pts[i + 1];

    retPts.push({ x: x, y: y });
  }

  return retPts;
}

BRp.getSegmentPoints = function (edge) {
  var rs = edge[0]._private.rscratch;
  var type = rs.edgeType;

  if (type === 'segments') {
    return getPts(rs.segpts);
  }
};

BRp.getControlPoints = function (edge) {
  var rs = edge[0]._private.rscratch;
  var type = rs.edgeType;

  if (type === 'bezier' || type === 'multibezier') {
    return getPts(rs.ctrlpts);
  }
};

BRp.getEdgeMidpoint = function (edge) {
  var rs = edge[0]._private.rscratch;

  return {
    x: rs.midX,
    y: rs.midY
  };
};

module.exports = BRp;

/***/ }),
/* 113 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var math = __webpack_require__(2);
var is = __webpack_require__(0);

var BRp = {};

BRp.manualEndptToPx = function (node, prop) {
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

BRp.findEndpoints = function (edge) {
  var r = this;
  var intersect = void 0;

  var source = edge.source()[0];
  var target = edge.target()[0];

  var srcPos = source.position();
  var tgtPos = target.position();

  var tgtArShape = edge.pstyle('target-arrow-shape').value;
  var srcArShape = edge.pstyle('source-arrow-shape').value;

  var tgtDist = edge.pstyle('target-distance-from-node').pfValue;
  var srcDist = edge.pstyle('source-distance-from-node').pfValue;

  var rs = edge._private.rscratch;

  var et = rs.edgeType;
  var self = et === 'self' || et === 'compound';
  var bezier = et === 'bezier' || et === 'multibezier' || self;
  var multi = et !== 'bezier';
  var lines = et === 'straight' || et === 'segments';
  var segments = et === 'segments';
  var hasEndpts = bezier || multi || lines;
  var srcManEndpt = edge.pstyle('source-endpoint');
  var srcManEndptVal = self ? 'outside-to-node' : srcManEndpt.value;
  var tgtManEndpt = edge.pstyle('target-endpoint');
  var tgtManEndptVal = self ? 'outside-to-node' : tgtManEndpt.value;

  rs.srcManEndpt = srcManEndpt;
  rs.tgtManEndpt = tgtManEndpt;

  var p1 = void 0; // last known point of edge on target side
  var p2 = void 0; // last known point of edge on source side

  var p1_i = void 0; // point to intersect with target shape
  var p2_i = void 0; // point to intersect with source shape

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
    if (tgtManEndptVal === 'outside-to-node') {
      p1_i = p1;
    } else if (tgtManEndptVal === 'outside-to-line') {
      p1_i = [srcPos.x, srcPos.y];
    }

    intersect = r.nodeShapes[this.getNodeShape(target)].intersectLine(tgtPos.x, tgtPos.y, target.outerWidth(), target.outerHeight(), p1_i[0], p1_i[1], 0);
  }

  var arrowEnd = math.shortenIntersection(intersect, p1, r.arrowShapes[tgtArShape].spacing(edge) + tgtDist);
  var edgeEnd = math.shortenIntersection(intersect, p1, r.arrowShapes[tgtArShape].gap(edge) + tgtDist);

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
    if (srcManEndptVal === 'outside-to-node') {
      p2_i = p2;
    } else if (srcManEndptVal === 'outside-to-line') {
      p2_i = [tgtPos.x, tgtPos.y];
    }

    intersect = r.nodeShapes[this.getNodeShape(source)].intersectLine(srcPos.x, srcPos.y, source.outerWidth(), source.outerHeight(), p2_i[0], p2_i[1], 0);
  }

  var arrowStart = math.shortenIntersection(intersect, p2, r.arrowShapes[srcArShape].spacing(edge) + srcDist);
  var edgeStart = math.shortenIntersection(intersect, p2, r.arrowShapes[srcArShape].gap(edge) + srcDist);

  rs.startX = edgeStart[0];
  rs.startY = edgeStart[1];

  rs.arrowStartX = arrowStart[0];
  rs.arrowStartY = arrowStart[1];

  if (hasEndpts) {
    if (!is.number(rs.startX) || !is.number(rs.startY) || !is.number(rs.endX) || !is.number(rs.endY)) {
      rs.badLine = true;
    } else {
      rs.badLine = false;
    }
  }
};

BRp.getSourceEndpoint = function (edge) {
  var rs = edge[0]._private.rscratch;

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

BRp.getTargetEndpoint = function (edge) {
  var rs = edge[0]._private.rscratch;

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

module.exports = BRp;

/***/ }),
/* 114 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var math = __webpack_require__(2);

var BRp = {};

function pushBezierPts(r, edge, pts) {
  var qbezierAt = function qbezierAt(p1, p2, p3, t) {
    return math.qbezierAt(p1, p2, p3, t);
  };
  var _p = edge._private;
  var bpts = _p.rstyle.bezierPts;

  for (var i = 0; i < r.bezierProjPcts.length; i++) {
    var p = r.bezierProjPcts[i];

    bpts.push({
      x: qbezierAt(pts[0], pts[2], pts[4], p),
      y: qbezierAt(pts[1], pts[3], pts[5], p)
    });
  }
}

BRp.storeEdgeProjections = function (edge) {
  var _p = edge._private;
  var rs = _p.rscratch;
  var et = rs.edgeType;

  // clear the cached points state
  _p.rstyle.bezierPts = null;
  _p.rstyle.linePts = null;
  _p.rstyle.haystackPts = null;

  if (et === 'multibezier' || et === 'bezier' || et === 'self' || et === 'compound') {
    var bpts = _p.rstyle.bezierPts = []; // jshint ignore:line

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

    _p.rstyle.haystackPts = [{ x: hpts[0], y: hpts[1] }, { x: hpts[2], y: hpts[3] }];
  }

  _p.rstyle.arrowWidth = this.getArrowWidth(edge.pstyle('width').pfValue, edge.pstyle('arrow-scale').value) * this.arrowShapeWidth;
};

BRp.recalculateEdgeProjections = function (edges) {
  this.findEdgeControlPoints(edges);
};

module.exports = BRp;

/***/ }),
/* 115 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var math = __webpack_require__(2);
var is = __webpack_require__(0);
var util = __webpack_require__(1);

var BRp = {};

BRp.recalculateNodeLabelProjection = function (node) {
  var content = node.pstyle('label').strValue;

  if (is.emptyString(content)) {
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

BRp.recalculateEdgeLabelProjections = function (edge) {
  var p;
  var _p = edge._private;
  var rs = _p.rscratch;
  var r = this;
  var content = {
    mid: edge.pstyle('label').strValue,
    source: edge.pstyle('source-label').strValue,
    target: edge.pstyle('target-label').strValue
  };

  if (content.mid || content.source || content.target) {
    // then we have to calculate...
  } else {
      return; // no labels => no calcs
    }

  // add center point to style so bounding box calculations can use it
  //
  p = {
    x: rs.midX,
    y: rs.midY
  };

  var setRs = function setRs(propName, prefix, value) {
    util.setPrefixedProperty(_p.rscratch, propName, prefix, value);
    util.setPrefixedProperty(_p.rstyle, propName, prefix, value);
  };

  setRs('labelX', null, p.x);
  setRs('labelY', null, p.y);

  var createControlPointInfo = function createControlPointInfo() {
    if (createControlPointInfo.cache) {
      return createControlPointInfo.cache;
    } // use cache so only 1x per edge

    var ctrlpts = [];

    // store each ctrlpt info init
    for (var i = 0; i + 5 < rs.allpts.length; i += 4) {
      var p0 = { x: rs.allpts[i], y: rs.allpts[i + 1] };
      var p1 = { x: rs.allpts[i + 2], y: rs.allpts[i + 3] }; // ctrlpt
      var p2 = { x: rs.allpts[i + 4], y: rs.allpts[i + 5] };

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
      var length = math.dist(p0, p1);
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
    }

    // update each ctrlpt with segment info
    for (var i = 0; i < ctrlpts.length; i++) {
      var cp = ctrlpts[i];
      var prevCp = ctrlpts[i - 1];

      if (prevCp) {
        cp.startDist = prevCp.startDist + prevCp.length;
      }

      addSegment(cp, cp.p0, bpts[i * nProjs], 0, r.bezierProjPcts[0]); // first

      for (var j = 0; j < nProjs - 1; j++) {
        addSegment(cp, bpts[i * nProjs + j], bpts[i * nProjs + j + 1], r.bezierProjPcts[j], r.bezierProjPcts[j + 1]);
      }

      addSegment(cp, bpts[i * nProjs + nProjs - 1], cp.p2, r.bezierProjPcts[nProjs - 1], 1); // last
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

    var lineAngle = function lineAngle(p0, p1) {
      var dx = p1.x - p0.x;
      var dy = p1.y - p0.y;

      return Math.atan(dy / dx);
    };

    var bezierAngle = function bezierAngle(p0, p1, p2, t) {
      var t0 = math.bound(0, t - 0.001, 1);
      var t1 = math.bound(0, t + 0.001, 1);

      var lp0 = math.qbezierPtAt(p0, p1, p2, t0);
      var lp1 = math.qbezierPtAt(p0, p1, p2, t1);

      return lineAngle(lp0, lp1);
    };

    switch (rs.edgeType) {
      case 'self':
      case 'compound':
      case 'bezier':
      case 'multibezier':
        var cps = createControlPointInfo();
        var selected;
        var startDist = 0;
        var totalDist = 0;

        // find the segment we're on
        for (var i = 0; i < cps.length; i++) {
          var cp = cps[isSrc ? i : cps.length - 1 - i];

          for (var j = 0; j < cp.segments.length; j++) {
            var seg = cp.segments[isSrc ? j : cp.segments.length - 1 - j];
            var lastSeg = i === cps.length - 1 && j === cp.segments.length - 1;

            startDist = totalDist;
            totalDist += seg.length;

            if (totalDist >= offset || lastSeg) {
              selected = { cp: cp, segment: seg };
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

        t = math.bound(0, t, 1);
        p = math.qbezierPtAt(cp.p0, cp.p1, cp.p2, t);
        angle = bezierAngle(cp.p0, cp.p1, cp.p2, t, p);

        break;

      case 'straight':
      case 'segments':
      case 'haystack':
        var d = 0,
            di,
            d0;
        var p0, p1;
        var l = rs.allpts.length;

        for (var i = 0; i + 3 < l; i += 2) {
          if (isSrc) {
            p0 = { x: rs.allpts[i], y: rs.allpts[i + 1] };
            p1 = { x: rs.allpts[i + 2], y: rs.allpts[i + 3] };
          } else {
            p0 = { x: rs.allpts[l - 2 - i], y: rs.allpts[l - 1 - i] };
            p1 = { x: rs.allpts[l - 4 - i], y: rs.allpts[l - 3 - i] };
          }

          di = math.dist(p0, p1);
          d0 = d;
          d += di;

          if (d >= offset) {
            break;
          }
        }

        var pD = offset - d0;
        var t = pD / di;

        t = math.bound(0, t, 1);
        p = math.lineAt(p0, p1, t);
        angle = lineAngle(p0, p1);

        break;
    }

    setRs('labelX', prefix, p.x);
    setRs('labelY', prefix, p.y);
    setRs('labelAutoAngle', prefix, angle);
  };

  calculateEndProjection('source');
  calculateEndProjection('target');

  this.applyLabelDimensions(edge);
};

BRp.applyLabelDimensions = function (ele) {
  this.applyPrefixedLabelDimensions(ele);

  if (ele.isEdge()) {
    this.applyPrefixedLabelDimensions(ele, 'source');
    this.applyPrefixedLabelDimensions(ele, 'target');
  }
};

BRp.applyPrefixedLabelDimensions = function (ele, prefix) {
  var _p = ele._private;

  var text = this.getLabelText(ele, prefix);
  var labelDims = this.calculateLabelDimensions(ele, text);

  util.setPrefixedProperty(_p.rstyle, 'labelWidth', prefix, labelDims.width);
  util.setPrefixedProperty(_p.rscratch, 'labelWidth', prefix, labelDims.width);

  util.setPrefixedProperty(_p.rstyle, 'labelHeight', prefix, labelDims.height);
  util.setPrefixedProperty(_p.rscratch, 'labelHeight', prefix, labelDims.height);
};

BRp.getLabelText = function (ele, prefix) {
  var _p = ele._private;
  var pfd = prefix ? prefix + '-' : '';
  var text = ele.pstyle(pfd + 'label').strValue;
  var textTransform = ele.pstyle('text-transform').value;
  var rscratch = function rscratch(propName, value) {
    if (value) {
      util.setPrefixedProperty(_p.rscratch, propName, prefix, value);
      return value;
    } else {
      return util.getPrefixedProperty(_p.rscratch, propName, prefix);
    }
  };

  if (textTransform == 'none') {
    // passthrough
  } else if (textTransform == 'uppercase') {
    text = text.toUpperCase();
  } else if (textTransform == 'lowercase') {
    text = text.toLowerCase();
  }

  var wrapStyle = ele.pstyle('text-wrap').value;

  if (wrapStyle === 'wrap') {
    //console.log('wrap');

    var labelKey = rscratch('labelKey');

    // save recalc if the label is the same as before
    if (labelKey && rscratch('labelWrapKey') === labelKey) {
      // console.log('wrap cache hit');
      return rscratch('labelWrapCachedText');
    }
    // console.log('wrap cache miss');

    var lines = text.split('\n');
    var maxW = ele.pstyle('text-max-width').pfValue;
    var wrappedLines = [];

    for (var l = 0; l < lines.length; l++) {
      var line = lines[l];
      var lineDims = this.calculateLabelDimensions(ele, line, 'line=' + line);
      var lineW = lineDims.width;

      if (lineW > maxW) {
        // line is too long
        var words = line.split(/\s+/); // NB: assume collapsed whitespace into single space
        var subline = '';

        for (var w = 0; w < words.length; w++) {
          var word = words[w];
          var testLine = subline.length === 0 ? word : subline + ' ' + word;
          var testDims = this.calculateLabelDimensions(ele, testLine, 'testLine=' + testLine);
          var testW = testDims.width;

          if (testW <= maxW) {
            // word fits on current line
            subline += word + ' ';
          } else {
            // word starts new line
            wrappedLines.push(subline);
            subline = word + ' ';
          }
        }

        // if there's remaining text, put it in a wrapped line
        if (!subline.match(/^\s+$/)) {
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

    // console.log(text)
  } else if (wrapStyle === 'ellipsis') {
    var maxW = ele.pstyle('text-max-width').pfValue;
    var ellipsized = '';
    var ellipsis = '\u2026';
    var incLastCh = false;

    for (var i = 0; i < text.length; i++) {
      var widthWithNextCh = this.calculateLabelDimensions(ele, ellipsized + text[i] + ellipsis).width;

      if (widthWithNextCh > maxW) {
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

BRp.calculateLabelDimensions = function (ele, text, extraKey) {
  var r = this;

  var cacheKey = ele._private.labelStyleKey + '$@$' + text;

  if (extraKey) {
    cacheKey += '$@$' + extraKey;
  }

  var cache = r.labelDimCache || (r.labelDimCache = {});

  if (cache[cacheKey]) {
    return cache[cacheKey];
  }

  var sizeMult = 1; // increase the scale to increase accuracy w.r.t. zoomed text
  var fStyle = ele.pstyle('font-style').strValue;
  var size = sizeMult * ele.pstyle('font-size').pfValue + 'px';
  var family = ele.pstyle('font-family').strValue;
  var weight = ele.pstyle('font-weight').strValue;

  var div = this.labelCalcDiv;

  if (!div) {
    div = this.labelCalcDiv = document.createElement('div'); // eslint-disable-line no-undef
    document.body.appendChild(div); // eslint-disable-line no-undef
  }

  var ds = div.style;

  // from ele style
  ds.fontFamily = family;
  ds.fontStyle = fStyle;
  ds.fontSize = size;
  ds.fontWeight = weight;

  // forced style
  ds.position = 'absolute';
  ds.left = '-9999px';
  ds.top = '-9999px';
  ds.zIndex = '-1';
  ds.visibility = 'hidden';
  ds.pointerEvents = 'none';
  ds.padding = '0';
  ds.lineHeight = '1';

  if (ele.pstyle('text-wrap').value === 'wrap') {
    ds.whiteSpace = 'pre'; // so newlines are taken into account
  } else {
    ds.whiteSpace = 'normal';
  }

  // put label content in div
  div.textContent = text;

  cache[cacheKey] = {
    width: Math.ceil(div.clientWidth / sizeMult),
    height: Math.ceil(div.clientHeight / sizeMult)
  };

  return cache[cacheKey];
};

BRp.calculateLabelAngles = function (ele) {
  var _p = ele._private;
  var rs = _p.rscratch;
  var isEdge = ele.isEdge();
  var rot = ele.pstyle('text-rotation');
  var rotStr = rot.strValue;

  if (rotStr === 'none') {
    rs.labelAngle = rs.sourceLabelAngle = rs.targetLabelAngle = 0;
  } else if (isEdge && rotStr === 'autorotate') {
    rs.labelAngle = Math.atan(rs.midDispY / rs.midDispX);
    rs.sourceLabelAngle = rs.sourceLabelAutoAngle;
    rs.targetLabelAngle = rs.targetLabelAutoAngle;
  } else if (rotStr === 'autorotate') {
    rs.labelAngle = rs.sourceLabelAngle = rs.targetLabelAngle = 0;
  } else {
    rs.labelAngle = rs.sourceLabelAngle = rs.targetLabelAngle = rot.pfValue;
  }
};

module.exports = BRp;

/***/ }),
/* 116 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var BRp = {};

BRp.getNodeShape = function (node) {
  var r = this;
  var shape = node.pstyle('shape').value;

  if (node.isParent()) {
    if (shape === 'rectangle' || shape === 'roundrectangle' || shape === 'cutrectangle' || shape === 'barrel') {
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

module.exports = BRp;

/***/ }),
/* 117 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var BRp = {};

BRp.registerCalculationListeners = function () {
  var cy = this.cy;
  var elesToUpdate = cy.collection();
  var r = this;

  var enqueue = function enqueue(eles, e) {
    var dirtyStyleCaches = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;

    elesToUpdate.merge(eles);

    for (var i = 0; i < eles.length; i++) {
      var ele = eles[i];
      var _p = ele._private;
      var rstyle = _p.rstyle;

      if (dirtyStyleCaches) {
        rstyle.clean = false;
        _p.bbCache = null;
      }

      var evts = rstyle.dirtyEvents = rstyle.dirtyEvents || { length: 0 };

      if (!evts[e.type]) {
        evts[e.type] = true;
        evts.length++;
      }
    }
  };

  r.binder(cy)
  // nodes

  .on('position.* style.* free.* bounds.*', 'node', function onDirtyModNode(e) {
    var node = e.target;

    enqueue(node, e);
    enqueue(node.connectedEdges(), e);
  }).on('add.*', 'node', function onDirtyAddNode(e) {
    var ele = e.target;

    enqueue(ele, e);
  }).on('background.*', 'node', function onDirtyBgNode(e) {
    var ele = e.target;

    enqueue(ele, e, false);
  })

  // edges

  .on('add.* style.*', 'edge', function onDirtyEdge(e) {
    var edge = e.target;

    enqueue(edge, e);
    enqueue(edge.parallelEdges(), e);
  }).on('remove.*', 'edge', function onDirtyRemoveEdge(e) {
    var edge = e.target;
    var pEdges = edge.parallelEdges();

    for (var i = 0; i < pEdges.length; i++) {
      var pEdge = pEdges[i];

      if (!pEdge.removed()) {
        enqueue(pEdge, e);
      }
    }
  })

  // manual dirtying

  .on('dirty.*', 'node', function onDirtyEle(e) {
    var ele = e.target;

    enqueue(ele, e);
  });

  var updateEleCalcs = function updateEleCalcs(willDraw) {
    if (willDraw) {
      var fns = r.onUpdateEleCalcsFns;

      if (fns) {
        for (var i = 0; i < fns.length; i++) {
          var fn = fns[i];

          fn(willDraw, elesToUpdate);
        }
      }

      r.recalculateRenderedStyle(elesToUpdate, false);

      for (var i = 0; i < elesToUpdate.length; i++) {
        elesToUpdate[i]._private.rstyle.dirtyEvents = null;
      }

      elesToUpdate = cy.collection();
    }
  };

  r.beforeRender(updateEleCalcs, r.beforeRenderPriorities.eleCalcs);
};

BRp.onUpdateEleCalcs = function (fn) {
  var fns = this.onUpdateEleCalcsFns = this.onUpdateEleCalcsFns || [];

  fns.push(fn);
};

BRp.recalculateRenderedStyle = function (eles, useCache) {
  var edges = [];
  var nodes = [];

  // the renderer can't be used for calcs when destroyed, e.g. ele.boundingBox()
  if (this.destroyed) {
    return;
  }

  // use cache by default for perf
  if (useCache === undefined) {
    useCache = true;
  }

  for (var i = 0; i < eles.length; i++) {
    var ele = eles[i];
    var _p = ele._private;
    var rstyle = _p.rstyle;

    // only update if dirty and in graph
    if (useCache && rstyle.clean || ele.removed()) {
      continue;
    }

    // only update if not display: none
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
    // rstyle.dirtyEvents = null;
  }

  // update node data from projections
  for (var i = 0; i < nodes.length; i++) {
    var ele = nodes[i];
    var _p = ele._private;
    var rstyle = _p.rstyle;
    var pos = ele.position();

    this.recalculateNodeLabelProjection(ele);

    rstyle.nodeX = pos.x;
    rstyle.nodeY = pos.y;
    rstyle.nodeW = ele.pstyle('width').pfValue;
    rstyle.nodeH = ele.pstyle('height').pfValue;
  }

  this.recalculateEdgeProjections(edges);

  // update edge data from projections
  for (var i = 0; i < edges.length; i++) {
    var ele = edges[i];
    var _p = ele._private;
    var rstyle = _p.rstyle;
    var rs = _p.rscratch;

    this.recalculateEdgeLabelProjections(ele);

    // update rstyle positions
    rstyle.srcX = rs.arrowStartX;
    rstyle.srcY = rs.arrowStartY;
    rstyle.tgtX = rs.arrowEndX;
    rstyle.tgtY = rs.arrowEndY;
    rstyle.midX = rs.midX;
    rstyle.midY = rs.midY;
    rstyle.labelAngle = rs.labelAngle;
    rstyle.sourceLabelAngle = rs.sourceLabelAngle;
    rstyle.targetLabelAngle = rs.targetLabelAngle;
  }
};

module.exports = BRp;

/***/ }),
/* 118 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var zIndexSort = __webpack_require__(17);

var BRp = {};

BRp.updateCachedGrabbedEles = function () {
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
  }

  // put the grab target nodes last so it's on top of its neighbourhood
  for (var i = 0; i < grabTargets.length; i++) {
    var ele = grabTargets[i];

    eles.drag.push(ele);
  }
};

BRp.invalidateCachedZSortedEles = function () {
  this.cachedZSortedEles = null;
};

BRp.getCachedZSortedEles = function (forceRecalc) {
  if (forceRecalc || !this.cachedZSortedEles) {
    //console.time('cachezorder')

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

module.exports = BRp;

/***/ }),
/* 119 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var BRp = {};

BRp.getCachedImage = function (url, crossOrigin, onLoad) {
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
    });

    // #1582 safari doesn't load data uris with crossOrigin properly
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

module.exports = BRp;

/***/ }),
/* 120 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);
var util = __webpack_require__(1);
var math = __webpack_require__(2);
var Event = __webpack_require__(16);

var BRp = {};

BRp.registerBinding = function (target, event, handler, useCapture) {
  var args = Array.prototype.slice.apply(arguments, [1]); // copy
  var b = this.binder(target);

  return b.on.apply(b, args);
};

BRp.binder = function (tgt) {
  var r = this;

  var tgtIsDom = tgt === window || tgt === document || tgt === document.body || is.domElement(tgt);

  if (r.supportsPassiveEvents == null) {

    // from https://github.com/WICG/EventListenerOptions/blob/gh-pages/explainer.md#feature-detection
    var supportsPassive = false;
    try {
      var opts = Object.defineProperty({}, 'passive', {
        get: function get() {
          supportsPassive = true;
        }
      });

      window.addEventListener('test', null, opts);
    } catch (err) {}

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

BRp.nodeIsDraggable = function (node) {
  return node && node.isNode() && !node.locked() && node.grabbable();
};

BRp.nodeIsGrabbable = function (node) {
  return this.nodeIsDraggable(node) && node.interactive();
};

BRp.load = function () {
  var r = this;

  var triggerEvents = function triggerEvents(target, names, e, props) {
    if (target == null) {
      target = r.cy;
    }

    for (var i = 0; i < names.length; i++) {
      var name = names[i];

      target.emit(util.extend({ originalEvent: e, type: name }, props));
    }
  };

  var isMultSelKeyDown = function isMultSelKeyDown(e) {
    return e.shiftKey || e.metaKey || e.ctrlKey; // maybe e.altKey
  };

  var allowPanningPassthrough = function allowPanningPassthrough(down, downs) {
    var allowPassthrough = true;

    if (r.cy.hasCompoundNodes() && down && down.isEdge()) {
      // a compound node below the edge => no passthrough panning
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

  var getDragListIds = function getDragListIds(opts) {
    var listHasId;

    if (opts.addToList && r.cy.hasCompoundNodes()) {
      // only needed for compound graphs
      if (!opts.addToList.hasId) {
        // build ids lookup if doesn't already exist
        opts.addToList.hasId = {};

        for (var i = 0; i < opts.addToList.length; i++) {
          var ele = opts.addToList[i];

          opts.addToList.hasId[ele.id()] = true;
        }
      }

      listHasId = opts.addToList.hasId;
    }

    return listHasId || {};
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
    var listHasId = getDragListIds(opts);

    if (!listHasId[ele.id()]) {
      opts.addToList.push(ele);
      listHasId[ele.id()] = true;

      setGrabbed(ele);
    }
  };

  // helper function to determine which child nodes and inner edges
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
      innerNodes.forEach(function (ele) {
        addToDragList(ele, opts);
      });
    }
  };

  // adds the given nodes and its neighbourhood to the drag layer
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
    }

    grabbedEles.hasId = {}; // clear the id list

    // just go over all elements rather than doing a bunch of (possibly expensive) traversals
    r.getCachedZSortedEles().forEach(function (ele) {
      setFreed(ele);
      setOutDragLayer(ele);
      removeGrabTarget(ele);
    });

    r.updateCachedGrabbedEles();
  };

  // helper function to determine which ancestor nodes and edges should go
  // to the drag layer (or should be removed from drag layer).
  var updateAncestorsInDragLayer = function updateAncestorsInDragLayer(node, opts) {

    if (opts.inDragLayer == null && opts.addToList == null) {
      return;
    } // nothing to do

    if (!node.cy().hasCompoundNodes()) {
      return;
    }

    // find top-level parent
    var parent = node.ancestors().orphans();

    // no parent node: no nodes to add to the drag layer
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

  var haveMutationsApi = typeof MutationObserver !== 'undefined';

  // watch for when the cy container is removed from the dom
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
      r.removeObserver.observe(r.container.parentNode, { childList: true });
    }
  } else {
    r.registerBinding(r.container, 'DOMNodeRemoved', function (e) {
      r.destroy();
    });
  }

  var onResize = util.debounce(function () {
    r.cy.resize();
  }, 100);

  if (haveMutationsApi) {
    r.styleObserver = new MutationObserver(onResize); // eslint-disable-line no-undef

    r.styleObserver.observe(r.container, { attributes: true });
  }

  // auto resize
  r.registerBinding(window, 'resize', onResize); // eslint-disable-line no-undef

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
  });

  // stop right click menu from appearing on cy
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
  };

  // Primary key
  r.registerBinding(r.container, 'mousedown', function mousedownHandler(e) {
    if (!eventInContainer(e)) {
      return;
    }

    e.preventDefault();
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
              position: { x: pos[0], y: pos[1] }
            });
          } else {
            cy.emit({
              originalEvent: e,
              type: 'taphold',
              position: { x: pos[0], y: pos[1] }
            });
          }
        }
      }, r.tapholdDuration);
    };

    // Right click button
    if (e.which == 3) {

      r.hoverData.cxtStarted = true;

      var cxtEvt = {
        originalEvent: e,
        type: 'cxttapstart',
        position: { x: pos[0], y: pos[1] }
      };

      if (near) {
        near.activate();
        near.emit(cxtEvt);

        r.hoverData.down = near;
      } else {
        cy.emit(cxtEvt);
      }

      r.hoverData.downTime = new Date().getTime();
      r.hoverData.cxtDragged = false;

      // Primary button
    } else if (e.which == 1) {

      if (near) {
        near.activate();
      }

      // Element dragging
      {
        // If something is under the cursor and it is draggable, prepare to grab it
        if (near != null) {

          if (r.nodeIsGrabbable(near)) {

            var makeEvent = function makeEvent(type) {
              return {
                originalEvent: e,
                type: type,
                position: { x: pos[0], y: pos[1] }
              };
            };

            var triggerGrab = function triggerGrab(ele) {
              ele.emit(makeEvent('grab'));
            };

            setGrabTarget(near);

            if (!near.selected()) {

              draggedElements = r.dragData.possibleDragElements = [];
              addNodeToDrag(near, { addToList: draggedElements });

              near.emit(makeEvent('grabon')).emit(makeEvent('grab'));
            } else {
              draggedElements = r.dragData.possibleDragElements = [];

              var selectedNodes = cy.$(function (ele) {
                return ele.isNode() && ele.selected() && r.nodeIsGrabbable(ele);
              });

              addNodesToDrag(selectedNodes, { addToList: draggedElements });

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
        position: { x: pos[0], y: pos[1] }
      });

      if (near == null) {
        select[4] = 1;

        r.data.bgActivePosistion = {
          x: pos[0],
          y: pos[1]
        };

        r.redrawHint('select', true);

        r.redraw();
      } else if (near.isEdge()) {
        select[4] = 1; // for future pan
      }

      checkForTaphold();
    }

    // Initialize selection box coordinates
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
      position: { x: pos[0], y: pos[1] }
    });

    var goIntoBoxMode = function goIntoBoxMode() {
      r.data.bgActivePosistion = undefined;

      if (!r.hoverData.selecting) {
        cy.emit('boxstart');
      }

      select[4] = 1;
      r.hoverData.selecting = true;

      r.redrawHint('select', true);
      r.redraw();
    };

    // trigger context drag if rmouse down
    if (r.hoverData.which === 3) {
      // but only if over threshold
      if (isOverThresholdDrag) {
        var cxtEvt = {
          originalEvent: e,
          type: 'cxtdrag',
          position: { x: pos[0], y: pos[1] }
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
              position: { x: pos[0], y: pos[1] }
            });
          }

          r.hoverData.cxtOver = near;

          if (near) {
            near.emit({
              originalEvent: e,
              type: 'cxtdragover',
              position: { x: pos[0], y: pos[1] }
            });
          }
        }
      }

      // Check if we are drag panning the entire graph
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
      }

      // Needs reproject due to pan changing viewport
      pos = r.projectIntoViewport(e.clientX, e.clientY);

      // Checks primary button down & out of time & mouse not moved much
    } else if (select[4] == 1 && (down == null || down.isEdge())) {

      if (isOverThresholdDrag) {

        if (!r.hoverData.dragging && cy.boxSelectionEnabled() && (multSelKeyDown || !cy.panningEnabled() || !cy.userPanningEnabled())) {
          goIntoBoxMode();
        } else if (!r.hoverData.selecting && cy.panningEnabled() && cy.userPanningEnabled()) {
          var allowPassthrough = allowPanningPassthrough(down, r.hoverData.downs);

          if (allowPassthrough) {
            r.hoverData.dragging = true;
            r.hoverData.justStartedPan = true;
            select[4] = 0;

            r.data.bgActivePosistion = math.array2point(mdownPos);

            r.redrawHint('select', true);
            r.redraw();
          }
        }

        if (down && down.isEdge() && down.active()) {
          down.unactivate();
        }
      }
    } else {
      if (down && down.isEdge() && down.active()) {
        down.unactivate();
      }

      if ((!down || !down.grabbed()) && near != last) {

        if (last) {
          triggerEvents(last, ['mouseout', 'tapdragout'], e, {
            position: { x: pos[0], y: pos[1] }
          });
        }

        if (near) {
          triggerEvents(near, ['mouseover', 'tapdragover'], e, {
            position: { x: pos[0], y: pos[1] }
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

              down.emit('free');
            }

            goIntoBoxMode();
          } else if (down && down.grabbed() && r.nodeIsDraggable(down)) {
            // drag node
            var justStartedDrag = !r.dragData.didDrag;

            if (justStartedDrag) {
              r.redrawHint('eles', true);
            }

            r.dragData.didDrag = true; // indicate that we actually did drag the node

            var toTrigger = [];

            // now, add the elements to the drag layer if not done already
            if (!r.hoverData.draggingEles) {
              addNodesToDrag(cy.collection(draggedElements), { inDragLayer: true });
            }

            for (var i = 0; i < draggedElements.length; i++) {
              var dEle = draggedElements[i];

              // Locked nodes not draggable, as well as non-visible nodes
              if (r.nodeIsDraggable(dEle) && dEle.grabbed()) {
                var dPos = dEle.position();

                toTrigger.push(dEle);

                if (is.number(disp[0]) && is.number(disp[1])) {
                  dPos.x += disp[0];
                  dPos.y += disp[1];

                  if (justStartedDrag) {
                    var dragDelta = r.hoverData.dragDelta;

                    if (dragDelta && is.number(dragDelta[0]) && is.number(dragDelta[1])) {
                      dPos.x += dragDelta[0];
                      dPos.y += dragDelta[1];
                    }
                  }
                }
              }
            }

            r.hoverData.draggingEles = true;

            var tcol = cy.collection(toTrigger);

            tcol.dirtyCompoundBoundsCache();
            tcol.emit('position drag');

            r.redrawHint('drag', true);
            r.redraw();
          }
        } else {
          // otherwise save drag delta for when we actually start dragging so the relative grab pos is constant
          updateDragDelta();
        }
      }

      // prevent the dragging from triggering text selection on the page
      preventDefault = true;
    }

    select[2] = pos[0];select[3] = pos[1];

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

    var cy = r.cy;var pos = r.projectIntoViewport(e.clientX, e.clientY);var select = r.selection;
    var near = r.findNearestElement(pos[0], pos[1], true, false);
    var draggedElements = r.dragData.possibleDragElements;var down = r.hoverData.down;
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
        position: { x: pos[0], y: pos[1] }
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
          position: { x: pos[0], y: pos[1] }
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

      // Deselect all elements if nothing is currently under the mouse cursor and we aren't dragging something
      if (down == null && // not mousedown on node
      !r.dragData.didDrag // didn't move the node around
      && !r.hoverData.selecting // not box selection
      && !r.hoverData.dragged // didn't pan
      && !isMultSelKeyDown(e)) {

        cy.$(function (ele) {
          return ele.selected();
        }).unselect();

        if (draggedElements.length > 0) {
          r.redrawHint('eles', true);
        }

        r.dragData.possibleDragElements = draggedElements = [];
      }

      triggerEvents(near, ['mouseup', 'tapend', 'vmouseup'], e, {
        position: { x: pos[0], y: pos[1] }
      });

      if (!r.dragData.didDrag // didn't move a node around
      && !r.hoverData.dragged // didn't pan
      && !r.hoverData.selecting // not box selection
      && !r.hoverData.isOverThresholdDrag // didn't move too much
      ) {
          triggerEvents(down, ['click', 'tap', 'vclick'], e, {
            position: { x: pos[0], y: pos[1] }
          });
        }

      // Single selection
      if (near == down && !r.dragData.didDrag && !r.hoverData.selecting) {
        if (near != null && near._private.selectable) {

          if (r.hoverData.dragging) {
            // if panning, don't change selection state
          } else if (cy.selectionType() === 'additive' || multSelKeyDown) {
            if (near.selected()) {
              near.unselect();
            } else {
              near.select();
            }
          } else {
            if (!multSelKeyDown) {
              cy.$(':selected').unmerge(near).unselect();
              near.select();
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

        cy.emit('boxend');

        var eleWouldBeSelected = function eleWouldBeSelected(ele) {
          return ele.selectable() && !ele.selected();
        };

        if (cy.selectionType() === 'additive') {
          box.emit('box').stdFilter(eleWouldBeSelected).select().emit('boxselect');
        } else {
          if (!multSelKeyDown) {
            cy.$(':selected').unmerge(box).unselect();
          }

          box.emit('box').stdFilter(eleWouldBeSelected).select().emit('boxselect');
        }

        // always need redraw in case eles unselectable
        r.redraw();
      }

      // Cancel drag pan
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
          down.emit('free');
        }
      }
    } // else not right mouse

    select[4] = 0;r.hoverData.down = null;

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
    var pos = r.projectIntoViewport(e.clientX, e.clientY);
    var rpos = [pos[0] * cy.zoom() + cy.pan().x, pos[1] * cy.zoom() + cy.pan().y];

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

      cy.zoom({
        level: cy.zoom() * Math.pow(10, diff),
        renderedPosition: { x: rpos[0], y: rpos[1] }
      });
    }
  };

  // Functions to help with whether mouse wheel should trigger zooming
  // --
  r.registerBinding(r.container, 'wheel', wheelHandler, true);

  // disable nonstandard wheel events
  // r.registerBinding(r.container, 'mousewheel', wheelHandler, true);
  // r.registerBinding(r.container, 'DOMMouseScroll', wheelHandler, true);
  // r.registerBinding(r.container, 'MozMousePixelScroll', wheelHandler, true); // older firefox

  r.registerBinding(window, 'scroll', function scrollHandler(e) {
    // eslint-disable-line no-undef
    r.scrollingPage = true;

    clearTimeout(r.scrollingPageTimeout);
    r.scrollingPageTimeout = setTimeout(function () {
      r.scrollingPage = false;
    }, 250);
  }, true);

  // Functions to help with handling mouseout/mouseover on the Cytoscape container
  // Handle mouseout on Cytoscape container
  r.registerBinding(r.container, 'mouseout', function mouseOutHandler(e) {
    var pos = r.projectIntoViewport(e.clientX, e.clientY);

    r.cy.emit({
      originalEvent: e,
      type: 'mouseout',
      position: { x: pos[0], y: pos[1] }
    });
  }, false);

  r.registerBinding(r.container, 'mouseover', function mouseOverHandler(e) {
    var pos = r.projectIntoViewport(e.clientX, e.clientY);

    r.cy.emit({
      originalEvent: e,
      type: 'mouseover',
      position: { x: pos[0], y: pos[1] }
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
    if (!eventInContainer(e)) {
      return;
    }

    r.touchData.capture = true;
    r.data.bgActivePosistion = undefined;

    var cy = r.cy;
    var now = r.touchData.now;
    var earlier = r.touchData.earlier;

    if (e.touches[0]) {
      var pos = r.projectIntoViewport(e.touches[0].clientX, e.touches[0].clientY);now[0] = pos[0];now[1] = pos[1];
    }
    if (e.touches[1]) {
      var pos = r.projectIntoViewport(e.touches[1].clientX, e.touches[1].clientY);now[2] = pos[0];now[3] = pos[1];
    }
    if (e.touches[2]) {
      var pos = r.projectIntoViewport(e.touches[2].clientX, e.touches[2].clientY);now[4] = pos[0];now[5] = pos[1];
    }

    // record starting points for pinch-to-zoom
    if (e.touches[1]) {

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
      modelCenter1 = [(center1[0] - pan.x) / zoom, (center1[1] - pan.y) / zoom];

      // consider context tap
      var cxtDistThreshold = 200;
      var cxtDistThresholdSq = cxtDistThreshold * cxtDistThreshold;
      if (distance1Sq < cxtDistThresholdSq && !e.touches[2]) {

        var near1 = r.findNearestElement(now[0], now[1], true, true);
        var near2 = r.findNearestElement(now[2], now[3], true, true);

        if (near1 && near1.isNode()) {
          near1.activate().emit({
            originalEvent: e,
            type: 'cxttapstart',
            position: { x: now[0], y: now[1] }
          });
          r.touchData.start = near1;
        } else if (near2 && near2.isNode()) {
          near2.activate().emit({
            originalEvent: e,
            type: 'cxttapstart',
            position: { x: now[0], y: now[1] }
          });
          r.touchData.start = near2;
        } else {
          cy.emit({
            originalEvent: e,
            type: 'cxttapstart',
            position: { x: now[0], y: now[1] }
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
    } else if (e.touches[1]) {
      // ignore
    } else if (e.touches[0]) {
      var nears = r.findNearestElements(now[0], now[1], true, true);
      var near = nears[0];

      if (near != null) {
        near.activate();

        r.touchData.start = near;
        r.touchData.starts = nears;

        if (r.nodeIsGrabbable(near)) {

          var draggedEles = r.dragData.touchDragEles = [];
          var selectedNodes = null;

          r.redrawHint('eles', true);
          r.redrawHint('drag', true);

          if (near.selected()) {
            // reset drag elements, since near will be added again

            selectedNodes = cy.$(function (ele) {
              return ele.selected() && r.nodeIsGrabbable(ele);
            });

            addNodesToDrag(selectedNodes, { addToList: draggedEles });
          } else {
            addNodeToDrag(near, { addToList: draggedEles });
          }

          setGrabTarget(near);

          var makeEvent = function makeEvent(type) {
            return {
              originalEvent: e,
              type: type,
              position: { x: now[0], y: now[1] }
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
        position: { x: now[0], y: now[1] }
      });

      if (near == null) {
        r.data.bgActivePosistion = {
          x: pos[0],
          y: pos[1]
        };

        r.redrawHint('select', true);
        r.redraw();
      }

      // Tap, taphold
      // -----

      r.touchData.singleTouchMoved = false;
      r.touchData.singleTouchStartTime = +new Date();

      clearTimeout(r.touchData.tapholdTimeout);
      r.touchData.tapholdTimeout = setTimeout(function () {
        if (r.touchData.singleTouchMoved === false && !r.pinching // if pinching, then taphold unselect shouldn't take effect
        && !r.touchData.selecting // box selection shouldn't allow taphold through
        ) {
            triggerEvents(r.touchData.start, ['taphold'], e, {
              position: { x: now[0], y: now[1] }
            });

            if (!r.touchData.start) {
              cy.$(':selected').unselect();
            }
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
      var pos = r.projectIntoViewport(e.touches[0].clientX, e.touches[0].clientY);now[0] = pos[0];now[1] = pos[1];
    }
    if (e.touches[1]) {
      var pos = r.projectIntoViewport(e.touches[1].clientX, e.touches[1].clientY);now[2] = pos[0];now[3] = pos[1];
    }
    if (e.touches[2]) {
      var pos = r.projectIntoViewport(e.touches[2].clientX, e.touches[2].clientY);now[4] = pos[0];now[5] = pos[1];
    }

    var startGPos = r.touchData.startGPosition;
    var isOverThresholdDrag;

    if (capture && e.touches[0] && startGPos) {
      var disp = [];for (var j = 0; j < now.length; j++) {
        disp[j] = now[j] - earlier[j];
      }
      var dx = e.touches[0].clientX - startGPos[0];
      var dx2 = dx * dx;
      var dy = e.touches[0].clientY - startGPos[1];
      var dy2 = dy * dy;
      var dist2 = dx2 + dy2;

      isOverThresholdDrag = dist2 >= r.touchTapThreshold2;
    }

    // context swipe cancelling
    if (capture && r.touchData.cxt) {
      e.preventDefault();

      var f1x2 = e.touches[0].clientX - offsetLeft,
          f1y2 = e.touches[0].clientY - offsetTop;
      var f2x2 = e.touches[1].clientX - offsetLeft,
          f2y2 = e.touches[1].clientY - offsetTop;
      // var distance2 = distance( f1x2, f1y2, f2x2, f2y2 );
      var distance2Sq = distanceSq(f1x2, f1y2, f2x2, f2y2);
      var factorSq = distance2Sq / distance1Sq;

      var distThreshold = 150;
      var distThresholdSq = distThreshold * distThreshold;
      var factorThreshold = 1.5;
      var factorThresholdSq = factorThreshold * factorThreshold;

      // cancel ctx gestures if the distance b/t the fingers increases
      if (factorSq >= factorThresholdSq || distance2Sq >= distThresholdSq) {
        r.touchData.cxt = false;

        r.data.bgActivePosistion = undefined;

        r.redrawHint('select', true);

        var cxtEvt = {
          originalEvent: e,
          type: 'cxttapend',
          position: { x: now[0], y: now[1] }
        };

        if (r.touchData.start) {
          r.touchData.start.unactivate().emit(cxtEvt);

          r.touchData.start = null;
        } else {
          cy.emit(cxtEvt);
        }
      }
    }

    // context swipe
    if (capture && r.touchData.cxt) {
      var cxtEvt = {
        originalEvent: e,
        type: 'cxtdrag',
        position: { x: now[0], y: now[1] }
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
            position: { x: now[0], y: now[1] }
          });
        }

        r.touchData.cxtOver = near;

        if (near) {
          near.emit({
            originalEvent: e,
            type: 'cxtdragover',
            position: { x: now[0], y: now[1] }
          });
        }
      }

      // box selection
    } else if (capture && e.touches[2] && cy.boxSelectionEnabled()) {
      e.preventDefault();

      r.data.bgActivePosistion = undefined;

      this.lastThreeTouch = +new Date();

      if (!r.touchData.selecting) {
        cy.emit('boxstart');
      }

      r.touchData.selecting = true;

      r.redrawHint('select', true);

      if (!select || select.length === 0 || select[0] === undefined) {
        select[0] = (now[0] + now[2] + now[4]) / 3;
        select[1] = (now[1] + now[3] + now[5]) / 3;
        select[2] = (now[0] + now[2] + now[4]) / 3 + 1;
        select[3] = (now[1] + now[3] + now[5]) / 3 + 1;
      } else {
        select[2] = (now[0] + now[2] + now[4]) / 3;
        select[3] = (now[1] + now[3] + now[5]) / 3;
      }

      select[4] = 1;
      r.touchData.selecting = true;

      r.redraw();

      // pinch to zoom
    } else if (capture && e.touches[1] && cy.zoomingEnabled() && cy.panningEnabled() && cy.userZoomingEnabled() && cy.userPanningEnabled()) {
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

      // (x2, y2) for fingers 1 and 2
      var f1x2 = e.touches[0].clientX - offsetLeft,
          f1y2 = e.touches[0].clientY - offsetTop;
      var f2x2 = e.touches[1].clientX - offsetLeft,
          f2y2 = e.touches[1].clientY - offsetTop;

      var distance2 = distance(f1x2, f1y2, f2x2, f2y2);
      // var distance2Sq = distanceSq( f1x2, f1y2, f2x2, f2y2 );
      // var factor = Math.sqrt( distance2Sq ) / Math.sqrt( distance1Sq );
      var factor = distance2 / distance1;

      if (twoFingersStartInside) {
        // delta finger1
        var df1x = f1x2 - f1x1;
        var df1y = f1y2 - f1y1;

        // delta finger 2
        var df2x = f2x2 - f2x1;
        var df2y = f2y2 - f2y1;

        // translation is the normalised vector of the two fingers movement
        // i.e. so pinching cancels out and moving together pans
        var tx = (df1x + df2x) / 2;
        var ty = (df1y + df2y) / 2;

        // adjust factor by the speed multiplier
        // var speed = 1.5;
        // if( factor > 1 ){
        //   factor = (factor - 1) * speed + 1;
        // } else {
        //   factor = 1 - (1 - factor) * speed;
        // }

        // now calculate the zoom
        var zoom1 = cy.zoom();
        var zoom2 = zoom1 * factor;
        var pan1 = cy.pan();

        // the model center point converted to the current rendered pos
        var ctrx = modelCenter1[0] * zoom1 + pan1.x;
        var ctry = modelCenter1[1] * zoom1 + pan1.y;

        var pan2 = {
          x: -zoom2 / zoom1 * (ctrx - pan1.x - tx) + ctrx,
          y: -zoom2 / zoom1 * (ctry - pan1.y - ty) + ctry
        };

        // remove dragged eles
        if (r.touchData.start && r.touchData.start.active()) {
          var draggedEles = r.dragData.touchDragEles;

          freeDraggedElements(draggedEles);

          r.redrawHint('drag', true);
          r.redrawHint('eles', true);

          r.touchData.start.unactivate().emit('free');
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
      }

      // Re-project
      if (e.touches[0]) {
        var pos = r.projectIntoViewport(e.touches[0].clientX, e.touches[0].clientY);now[0] = pos[0];now[1] = pos[1];
      }
      if (e.touches[1]) {
        var pos = r.projectIntoViewport(e.touches[1].clientX, e.touches[1].clientY);now[2] = pos[0];now[3] = pos[1];
      }
      if (e.touches[2]) {
        var pos = r.projectIntoViewport(e.touches[2].clientX, e.touches[2].clientY);now[4] = pos[0];now[5] = pos[1];
      }
    } else if (e.touches[0]) {
      var start = r.touchData.start;
      var last = r.touchData.last;
      var near;

      if (!r.hoverData.draggingEles && !r.swipePanning) {
        near = r.findNearestElement(now[0], now[1], true, true);
      }

      if (capture && start != null) {
        e.preventDefault();
      }

      // dragging nodes
      if (capture && start != null && r.nodeIsDraggable(start)) {

        if (isOverThresholdDrag) {
          // then dragging can happen
          var draggedEles = r.dragData.touchDragEles;
          var justStartedDrag = !r.dragData.didDrag;

          if (justStartedDrag) {
            addNodesToDrag(cy.collection(draggedEles), { inDragLayer: true });
          }

          for (var k = 0; k < draggedEles.length; k++) {
            var draggedEle = draggedEles[k];

            if (r.nodeIsDraggable(draggedEle) && draggedEle.grabbed()) {
              r.dragData.didDrag = true;
              var dPos = draggedEle.position();

              if (is.number(disp[0]) && is.number(disp[1])) {
                dPos.x += disp[0];
                dPos.y += disp[1];
              }

              if (justStartedDrag) {
                r.redrawHint('eles', true);

                var dragDelta = r.touchData.dragDelta;

                if (dragDelta && is.number(dragDelta[0]) && is.number(dragDelta[1])) {
                  dPos.x += dragDelta[0];
                  dPos.y += dragDelta[1];
                }
              }
            }
          }

          var tcol = cy.collection(draggedEles);

          tcol.dirtyCompoundBoundsCache();
          tcol.emit('position drag');

          r.hoverData.draggingEles = true;

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
      }

      // touchmove
      {
        triggerEvents(start || near, ['touchmove', 'tapdrag', 'vmousemove'], e, {
          position: { x: now[0], y: now[1] }
        });

        if ((!start || !start.grabbed()) && near != last) {
          if (last) {
            last.emit({ originalEvent: e, type: 'tapdragout', position: { x: now[0], y: now[1] } });
          }
          if (near) {
            near.emit({ originalEvent: e, type: 'tapdragover', position: { x: now[0], y: now[1] } });
          }
        }

        r.touchData.last = near;
      }

      // check to cancel taphold
      if (capture) {
        for (var i = 0; i < now.length; i++) {
          if (now[i] && r.touchData.startPosition[i] && isOverThresholdDrag) {

            r.touchData.singleTouchMoved = true;
          }
        }
      }

      // panning
      if (capture && (start == null || start.isEdge()) && cy.panningEnabled() && cy.userPanningEnabled()) {

        var allowPassthrough = allowPanningPassthrough(start, r.touchData.starts);

        if (allowPassthrough) {
          e.preventDefault();

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

              if (!r.data.bgActivePosistion) {
                r.data.bgActivePosistion = math.array2point(r.touchData.startPosition);
              }

              r.redrawHint('select', true);

              r.touchData.start = null;
            }
          }
        }

        // Re-project
        var pos = r.projectIntoViewport(e.touches[0].clientX, e.touches[0].clientY);
        now[0] = pos[0];now[1] = pos[1];
      }
    }

    for (var j = 0; j < now.length; j++) {
      earlier[j] = now[j];
    }
    //r.redraw();
  }, false);

  var touchcancelHandler;
  r.registerBinding(window, 'touchcancel', touchcancelHandler = function touchcancelHandler(e) {
    // eslint-disable-line no-undef
    var start = r.touchData.start;

    r.touchData.capture = false;

    if (start) {
      start.unactivate();
    }
  });

  var touchendHandler;
  r.registerBinding(window, 'touchend', touchendHandler = function touchendHandler(e) {
    // eslint-disable-line no-undef
    var start = r.touchData.start;

    var capture = r.touchData.capture;

    if (capture) {
      r.touchData.capture = false;

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
      var pos = r.projectIntoViewport(e.touches[0].clientX, e.touches[0].clientY);now[0] = pos[0];now[1] = pos[1];
    }
    if (e.touches[1]) {
      var pos = r.projectIntoViewport(e.touches[1].clientX, e.touches[1].clientY);now[2] = pos[0];now[3] = pos[1];
    }
    if (e.touches[2]) {
      var pos = r.projectIntoViewport(e.touches[2].clientX, e.touches[2].clientY);now[4] = pos[0];now[5] = pos[1];
    }

    if (start) {
      start.unactivate();
    }

    var ctxTapend;
    if (r.touchData.cxt) {
      ctxTapend = {
        originalEvent: e,
        type: 'cxttapend',
        position: { x: now[0], y: now[1] }
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
          position: { x: now[0], y: now[1] }
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
    }

    // no more box selection if we don't have three fingers
    if (!e.touches[2] && cy.boxSelectionEnabled() && r.touchData.selecting) {
      r.touchData.selecting = false;

      var box = cy.collection(r.getAllInBox(select[0], select[1], select[2], select[3]));

      select[0] = undefined;
      select[1] = undefined;
      select[2] = undefined;
      select[3] = undefined;
      select[4] = 0;

      r.redrawHint('select', true);

      cy.emit('boxend');

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
    } else if (e.touches[1]) {
      // ignore
    } else if (e.touches[0]) {
      // ignore

      // Last touch released
    } else if (!e.touches[0]) {

      r.data.bgActivePosistion = undefined;
      r.redrawHint('select', true);

      var draggedEles = r.dragData.touchDragEles;

      if (start != null) {

        var startWasGrabbed = start._private.grabbed;

        freeDraggedElements(draggedEles);

        r.redrawHint('drag', true);
        r.redrawHint('eles', true);

        if (startWasGrabbed) {
          start.emit('free');
        }

        triggerEvents(start, ['touchend', 'tapend', 'vmouseup', 'tapdragout'], e, {
          position: { x: now[0], y: now[1] }
        });

        start.unactivate();

        r.touchData.start = null;
      } else {
        var near = r.findNearestElement(now[0], now[1], true, true);

        triggerEvents(near, ['touchend', 'tapend', 'vmouseup', 'tapdragout'], e, {
          position: { x: now[0], y: now[1] }
        });
      }

      var dx = r.touchData.startPosition[0] - now[0];
      var dx2 = dx * dx;
      var dy = r.touchData.startPosition[1] - now[1];
      var dy2 = dy * dy;
      var dist2 = dx2 + dy2;
      var rdist2 = dist2 * zoom * zoom;

      // Prepare to select the currently touched node, only if it hasn't been dragged past a certain distance
      if (start != null && !r.dragData.didDrag // didn't drag nodes around
      && start._private.selectable && rdist2 < r.touchTapThreshold2 && !r.pinching // pinch to zoom should not affect selection
      ) {

          if (cy.selectionType() === 'single') {
            cy.$(':selected').unmerge(start).unselect();
            start.select();
          } else {
            if (start.selected()) {
              start.unselect();
            } else {
              start.select();
            }
          }

          r.redrawHint('eles', true);
        }

      // Tap event, roughly same as mouse click event for touch
      if (!r.touchData.singleTouchMoved) {
        triggerEvents(start, ['tap', 'vclick'], e, {
          position: { x: now[0], y: now[1] }
        });
      }

      r.touchData.singleTouchMoved = true;
    }

    for (var j = 0; j < now.length; j++) {
      earlier[j] = now[j];
    }

    r.dragData.didDrag = false; // reset for next mousedown

    if (e.touches.length === 0) {
      r.touchData.dragDelta = [];
      r.touchData.startPosition = null;
      r.touchData.startGPosition = null;
    }

    if (e.touches.length < 2) {
      r.pinching = false;
      r.redrawHint('eles', true);
      r.redraw();
    }

    //r.redraw();
  }, false);

  // fallback compatibility layer for ms pointer events
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

module.exports = BRp;

/***/ }),
/* 121 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var math = __webpack_require__(2);

var BRp = {};

BRp.generatePolygon = function (name, points) {
  return this.nodeShapes[name] = {
    renderer: this,

    name: name,

    points: points,

    draw: function draw(context, centerX, centerY, width, height) {
      this.renderer.nodeShapeImpl('polygon', context, centerX, centerY, width, height, this.points);
    },

    intersectLine: function intersectLine(nodeX, nodeY, width, height, x, y, padding) {
      return math.polygonIntersectLine(x, y, this.points, nodeX, nodeY, width / 2, height / 2, padding);
    },

    checkPoint: function checkPoint(x, y, padding, width, height, centerX, centerY) {
      return math.pointInsidePolygon(x, y, this.points, centerX, centerY, width, height, [0, -1], padding);
    }
  };
};

BRp.generateEllipse = function () {
  return this.nodeShapes['ellipse'] = {
    renderer: this,

    name: 'ellipse',

    draw: function draw(context, centerX, centerY, width, height) {
      this.renderer.nodeShapeImpl(this.name, context, centerX, centerY, width, height);
    },

    intersectLine: function intersectLine(nodeX, nodeY, width, height, x, y, padding) {
      return math.intersectLineEllipse(x, y, nodeX, nodeY, width / 2 + padding, height / 2 + padding);
    },

    checkPoint: function checkPoint(x, y, padding, width, height, centerX, centerY) {
      return math.checkInEllipse(x, y, width, height, centerX, centerY, padding);
    }
  };
};

BRp.generateRoundRectangle = function () {
  return this.nodeShapes['roundrectangle'] = {
    renderer: this,

    name: 'roundrectangle',

    points: math.generateUnitNgonPointsFitToSquare(4, 0),

    draw: function draw(context, centerX, centerY, width, height) {
      this.renderer.nodeShapeImpl(this.name, context, centerX, centerY, width, height);
    },

    intersectLine: function intersectLine(nodeX, nodeY, width, height, x, y, padding) {
      return math.roundRectangleIntersectLine(x, y, nodeX, nodeY, width, height, padding);
    },

    checkPoint: function checkPoint(x, y, padding, width, height, centerX, centerY) {

      var cornerRadius = math.getRoundRectangleRadius(width, height);
      var diam = cornerRadius * 2;

      // Check hBox
      if (math.pointInsidePolygon(x, y, this.points, centerX, centerY, width, height - diam, [0, -1], padding)) {
        return true;
      }

      // Check vBox
      if (math.pointInsidePolygon(x, y, this.points, centerX, centerY, width - diam, height, [0, -1], padding)) {
        return true;
      }

      // Check top left quarter circle
      if (math.checkInEllipse(x, y, diam, diam, centerX - width / 2 + cornerRadius, centerY - height / 2 + cornerRadius, padding)) {

        return true;
      }

      // Check top right quarter circle
      if (math.checkInEllipse(x, y, diam, diam, centerX + width / 2 - cornerRadius, centerY - height / 2 + cornerRadius, padding)) {

        return true;
      }

      // Check bottom right quarter circle
      if (math.checkInEllipse(x, y, diam, diam, centerX + width / 2 - cornerRadius, centerY + height / 2 - cornerRadius, padding)) {

        return true;
      }

      // Check bottom left quarter circle
      if (math.checkInEllipse(x, y, diam, diam, centerX - width / 2 + cornerRadius, centerY + height / 2 - cornerRadius, padding)) {

        return true;
      }

      return false;
    }
  };
};

BRp.generateCutRectangle = function () {
  return this.nodeShapes['cutrectangle'] = {
    renderer: this,

    name: 'cutrectangle',

    cornerLength: math.getCutRectangleCornerLength(),

    points: math.generateUnitNgonPointsFitToSquare(4, 0),

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
      var yEnd = centerY + hh;

      // points are in clockwise order, inner (imaginary) triangle pt on [4, 5]
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

      return math.polygonIntersectLine(x, y, pts, nodeX, nodeY);
    },

    checkPoint: function checkPoint(x, y, padding, width, height, centerX, centerY) {
      // Check hBox
      if (math.pointInsidePolygon(x, y, this.points, centerX, centerY, width, height - 2 * this.cornerLength, [0, -1], padding)) {
        return true;
      }

      // Check vBox
      if (math.pointInsidePolygon(x, y, this.points, centerX, centerY, width - 2 * this.cornerLength, height, [0, -1], padding)) {
        return true;
      }
      var cutTrianglePts = this.generateCutTrianglePts(width, height, centerX, centerY);
      return math.pointInsidePolygonPoints(x, y, cutTrianglePts.topLeft) || math.pointInsidePolygonPoints(x, y, cutTrianglePts.topRight) || math.pointInsidePolygonPoints(x, y, cutTrianglePts.bottomRight) || math.pointInsidePolygonPoints(x, y, cutTrianglePts.bottomLeft);
    }

  };
};

BRp.generateBarrel = function () {
  return this.nodeShapes['barrel'] = {
    renderer: this,

    name: 'barrel',

    points: math.generateUnitNgonPointsFitToSquare(4, 0),

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
        var m0 = math.qbezierPtAt({ x: pts[0], y: pts[1] }, { x: pts[2], y: pts[3] }, { x: pts[4], y: pts[5] }, t0);
        var m1 = math.qbezierPtAt({ x: pts[0], y: pts[1] }, { x: pts[2], y: pts[3] }, { x: pts[4], y: pts[5] }, t1);
        var m2 = math.qbezierPtAt({ x: pts[0], y: pts[1] }, { x: pts[2], y: pts[3] }, { x: pts[4], y: pts[5] }, t2);

        return [pts[0], pts[1], m0.x, m0.y, m1.x, m1.y, m2.x, m2.y, pts[4], pts[5]];
      };

      var pts = [].concat(approximateBarrelCurvePts(bPts.topLeft), approximateBarrelCurvePts(bPts.topRight), approximateBarrelCurvePts(bPts.bottomRight), approximateBarrelCurvePts(bPts.bottomLeft));

      return math.polygonIntersectLine(x, y, pts, nodeX, nodeY);
    },

    generateBarrelBezierPts: function generateBarrelBezierPts(width, height, centerX, centerY) {
      var hh = height / 2;
      var hw = width / 2;
      var xBegin = centerX - hw;
      var xEnd = centerX + hw;
      var yBegin = centerY - hh;
      var yEnd = centerY + hh;

      var curveConstants = math.getBarrelCurveConstants(width, height);
      var hOffset = curveConstants.heightOffset;
      var wOffset = curveConstants.widthOffset;
      var ctrlPtXOffset = curveConstants.ctrlPtOffsetPct * width;

      // points are in clockwise order, inner (imaginary) control pt on [4, 5]
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

      var curveConstants = math.getBarrelCurveConstants(width, height);
      var hOffset = curveConstants.heightOffset;
      var wOffset = curveConstants.widthOffset;

      // Check hBox
      if (math.pointInsidePolygon(x, y, this.points, centerX, centerY, width, height - 2 * hOffset, [0, -1], padding)) {
        return true;
      }

      // Check vBox
      if (math.pointInsidePolygon(x, y, this.points, centerX, centerY, width - 2 * wOffset, height, [0, -1], padding)) {
        return true;
      }

      var barrelCurvePts = this.generateBarrelBezierPts(width, height, centerX, centerY);

      var getCurveT = function getCurveT(x, y, curvePts) {
        var x0 = curvePts[4];
        var x1 = curvePts[2];
        var x2 = curvePts[0];
        var y0 = curvePts[5];
        // var y1 = curvePts[ 3 ];
        var y2 = curvePts[1];

        var xMin = Math.min(x0, x2);
        var xMax = Math.max(x0, x2);
        var yMin = Math.min(y0, y2);
        var yMax = Math.max(y0, y2);

        if (xMin <= x && x <= xMax && yMin <= y && y <= yMax) {
          var coeff = math.bezierPtsToQuadCoeff(x0, x1, x2);
          var roots = math.solveQuadratic(coeff[0], coeff[1], coeff[2], x);

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
        var bezY = math.qbezierAt(y0, y1, y2, t);

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

BRp.generateBottomRoundrectangle = function () {
  return this.nodeShapes['bottomroundrectangle'] = {
    renderer: this,

    name: 'bottomroundrectangle',

    points: math.generateUnitNgonPointsFitToSquare(4, 0),

    draw: function draw(context, centerX, centerY, width, height) {
      this.renderer.nodeShapeImpl(this.name, context, centerX, centerY, width, height);
    },

    intersectLine: function intersectLine(nodeX, nodeY, width, height, x, y, padding) {
      var topStartX = nodeX - (width / 2 + padding);
      var topStartY = nodeY - (height / 2 + padding);
      var topEndY = topStartY;
      var topEndX = nodeX + (width / 2 + padding);

      var topIntersections = math.finiteLinesIntersect(x, y, nodeX, nodeY, topStartX, topStartY, topEndX, topEndY, false);
      if (topIntersections.length > 0) {
        return topIntersections;
      }

      return math.roundRectangleIntersectLine(x, y, nodeX, nodeY, width, height, padding);
    },

    checkPoint: function checkPoint(x, y, padding, width, height, centerX, centerY) {

      var cornerRadius = math.getRoundRectangleRadius(width, height);
      var diam = 2 * cornerRadius;

      // Check hBox
      if (math.pointInsidePolygon(x, y, this.points, centerX, centerY, width, height - diam, [0, -1], padding)) {
        return true;
      }

      // Check vBox
      if (math.pointInsidePolygon(x, y, this.points, centerX, centerY, width - diam, height, [0, -1], padding)) {
        return true;
      }

      // check non-rounded top side
      var outerWidth = width / 2 + 2 * padding;
      var outerHeight = height / 2 + 2 * padding;
      var points = [centerX - outerWidth, centerY - outerHeight, centerX - outerWidth, centerY, centerX + outerWidth, centerY, centerX + outerWidth, centerY - outerHeight];
      if (math.pointInsidePolygonPoints(x, y, points)) {
        return true;
      }

      // Check bottom right quarter circle
      if (math.checkInEllipse(x, y, diam, diam, centerX + width / 2 - cornerRadius, centerY + height / 2 - cornerRadius, padding)) {

        return true;
      }

      // Check bottom left quarter circle
      if (math.checkInEllipse(x, y, diam, diam, centerX - width / 2 + cornerRadius, centerY + height / 2 - cornerRadius, padding)) {

        return true;
      }

      return false;
    }
  };
};

BRp.registerNodeShapes = function () {
  var nodeShapes = this.nodeShapes = {};
  var renderer = this;

  this.generateEllipse();

  this.generatePolygon('triangle', math.generateUnitNgonPointsFitToSquare(3, 0));

  this.generatePolygon('rectangle', math.generateUnitNgonPointsFitToSquare(4, 0));
  nodeShapes['square'] = nodeShapes['rectangle'];

  this.generateRoundRectangle();

  this.generateCutRectangle();

  this.generateBarrel();

  this.generateBottomRoundrectangle();

  this.generatePolygon('diamond', [0, 1, 1, 0, 0, -1, -1, 0]);

  this.generatePolygon('pentagon', math.generateUnitNgonPointsFitToSquare(5, 0));

  this.generatePolygon('hexagon', math.generateUnitNgonPointsFitToSquare(6, 0));

  this.generatePolygon('heptagon', math.generateUnitNgonPointsFitToSquare(7, 0));

  this.generatePolygon('octagon', math.generateUnitNgonPointsFitToSquare(8, 0));

  var star5Points = new Array(20);
  {
    var outerPoints = math.generateUnitNgonPoints(5, 0);
    var innerPoints = math.generateUnitNgonPoints(5, Math.PI / 5);

    // Outer radius is 1; inner radius of star is smaller
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

  star5Points = math.fitPolygonToSquare(star5Points);

  this.generatePolygon('star', star5Points);

  this.generatePolygon('vee', [-1, -1, 0, -0.333, 1, -1, 0, 1]);

  this.generatePolygon('rhomboid', [-1, -1, 0.333, -1, 1, 1, -0.333, 1]);

  this.generatePolygon('concavehexagon', [-1, -0.95, -0.75, 0, -1, 0.95, 1, 0.95, 0.75, 0, 1, -0.95]);

  this.generatePolygon('tag', [-1, -1, 0.25, -1, 1, 0, 0.25, 1, -1, 1]);

  nodeShapes.makePolygon = function (points) {

    // use caching on user-specified polygons so they are as fast as native shapes

    var key = points.join('$');
    var name = 'polygon-' + key;
    var shape;

    if (shape = this[name]) {
      // got cached shape
      return shape;
    }

    // create and cache new shape
    return renderer.generatePolygon(name, points);
  };
};

module.exports = BRp;

/***/ }),
/* 122 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);

var BRp = {};

BRp.timeToRender = function () {
  return this.redrawTotalTime / this.redrawCount;
};

BRp.redraw = function (options) {
  options = options || util.staticEmptyObject();

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

BRp.beforeRender = function (fn, priority) {
  // the renderer can't add tick callbacks when destroyed
  if (this.destroyed) {
    return;
  }

  priority = priority || 0;

  var cbs = this.beforeRenderCallbacks;

  cbs.push({ fn: fn, priority: priority });

  // higher priority callbacks executed first
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

BRp.startRenderLoop = function () {
  var r = this;

  if (r.renderLoopStarted) {
    return;
  } else {
    r.renderLoopStarted = true;
  }

  var renderFn = function renderFn(requestTime) {
    if (r.destroyed) {
      return;
    }

    if (r.requestedFrame && !r.skipFrame) {
      beforeRenderCallbacks(r, true, requestTime);

      var startTime = util.performanceNow();

      r.render(r.renderOptions);

      var endTime = r.lastDrawTime = util.performanceNow();

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
      r.lastRedrawTime = duration;

      // use a weighted average with a bias from the previous average so we don't spike so easily
      r.averageRedrawTime = r.averageRedrawTime / 2 + duration / 2;

      r.requestedFrame = false;
    } else {
      beforeRenderCallbacks(r, false, requestTime);
    }

    r.skipFrame = false;

    util.requestAnimationFrame(renderFn);
  };

  util.requestAnimationFrame(renderFn);
};

module.exports = BRp;

/***/ }),
/* 123 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/*
The canvas renderer was written by Yue Dong.

Modifications tracked on Github.
*/

var util = __webpack_require__(1);
var is = __webpack_require__(0);
var ElementTextureCache = __webpack_require__(124);
var LayeredTextureCache = __webpack_require__(125);

var CR = CanvasRenderer;
var CRp = CanvasRenderer.prototype;

CRp.CANVAS_LAYERS = 3;
//
CRp.SELECT_BOX = 0;
CRp.DRAG = 1;
CRp.NODE = 2;

CRp.BUFFER_COUNT = 3;
//
CRp.TEXTURE_BUFFER = 0;
CRp.MOTIONBLUR_BUFFER_NODE = 1;
CRp.MOTIONBLUR_BUFFER_DRAG = 2;

function CanvasRenderer(options) {
  var r = this;

  r.data = {
    canvases: new Array(CRp.CANVAS_LAYERS),
    contexts: new Array(CRp.CANVAS_LAYERS),
    canvasNeedsRedraw: new Array(CRp.CANVAS_LAYERS),

    bufferCanvases: new Array(CRp.BUFFER_COUNT),
    bufferContexts: new Array(CRp.CANVAS_LAYERS)
  };

  var tapHlOff = '-webkit-tap-highlight-color: rgba(0,0,0,0);';

  r.data.canvasContainer = document.createElement('div'); // eslint-disable-line no-undef
  var containerStyle = r.data.canvasContainer.style;
  r.data.canvasContainer.setAttribute('style', tapHlOff);
  containerStyle.position = 'relative';
  containerStyle.zIndex = '0';
  containerStyle.overflow = 'hidden';

  var container = options.cy.container();
  container.appendChild(r.data.canvasContainer);

  if ((container.getAttribute('style') || '').indexOf(tapHlOff) < 0) {
    container.setAttribute('style', (container.getAttribute('style') || '') + tapHlOff);
  }

  for (var i = 0; i < CRp.CANVAS_LAYERS; i++) {
    var canvas = r.data.canvases[i] = document.createElement('canvas'); // eslint-disable-line no-undef
    r.data.contexts[i] = canvas.getContext('2d');
    canvas.setAttribute('style', '-webkit-user-select: none; -moz-user-select: -moz-none; user-select: none; -webkit-tap-highlight-color: rgba(0,0,0,0); outline-style: none;' + (is.ms() ? ' -ms-touch-action: none; touch-action: none; ' : ''));
    canvas.style.position = 'absolute';
    canvas.setAttribute('data-id', 'layer' + i);
    canvas.style.zIndex = String(CRp.CANVAS_LAYERS - i);
    r.data.canvasContainer.appendChild(canvas);

    r.data.canvasNeedsRedraw[i] = false;
  }
  r.data.topCanvas = r.data.canvases[0];

  r.data.canvases[CRp.NODE].setAttribute('data-id', 'layer' + CRp.NODE + '-node');
  r.data.canvases[CRp.SELECT_BOX].setAttribute('data-id', 'layer' + CRp.SELECT_BOX + '-selectbox');
  r.data.canvases[CRp.DRAG].setAttribute('data-id', 'layer' + CRp.DRAG + '-drag');

  for (var i = 0; i < CRp.BUFFER_COUNT; i++) {
    r.data.bufferCanvases[i] = document.createElement('canvas'); // eslint-disable-line no-undef
    r.data.bufferContexts[i] = r.data.bufferCanvases[i].getContext('2d');
    r.data.bufferCanvases[i].style.position = 'absolute';
    r.data.bufferCanvases[i].setAttribute('data-id', 'buffer' + i);
    r.data.bufferCanvases[i].style.zIndex = String(-i - 1);
    r.data.bufferCanvases[i].style.visibility = 'hidden';
    //r.data.canvasContainer.appendChild(r.data.bufferCanvases[i]);
  }

  r.pathsEnabled = true;

  r.data.eleTxrCache = new ElementTextureCache(r);
  r.data.lyrTxrCache = new LayeredTextureCache(r, r.data.eleTxrCache);

  r.onUpdateEleCalcs(function invalidateTextureCaches(willDraw, eles) {
    for (var i = 0; i < eles.length; i++) {
      var ele = eles[i];
      var rs = ele._private.rstyle;
      var de = rs.dirtyEvents;

      if (ele.isNode() && de && de.length === 1 && de['position']) {
        // then keep cached ele texture
      } else {
        r.data.eleTxrCache.invalidateElement(ele);

        // NB this block of code should not be ported to 3.3 (unstable branch).
        // - This check is unneccesary in 3.3 as caches will be stored without respect to opacity.
        // - This fix may result in lowered performance for compound graphs.
        // - Ref : Opacity of child node is not updated for certain zoom levels after parent opacity is overriden #2078
        if (ele.isParent() && de['style']) {
          var op1 = rs.prevParentOpacity;
          var op2 = ele.pstyle('opacity').pfValue;

          rs.prevParentOpacity = op2;

          if (op1 !== op2) {
            var descs = ele.descendants();

            for (var j = 0; j < descs.length; j++) {
              r.data.eleTxrCache.invalidateElement(descs[j]);
            }
          }
        }
      }
    }

    if (eles.length > 0) {
      r.data.lyrTxrCache.invalidateElements(eles);
    }
  });
}

CRp.redrawHint = function (group, bool) {
  var r = this;

  switch (group) {
    case 'eles':
      r.data.canvasNeedsRedraw[CRp.NODE] = bool;
      break;
    case 'drag':
      r.data.canvasNeedsRedraw[CRp.DRAG] = bool;
      break;
    case 'select':
      r.data.canvasNeedsRedraw[CRp.SELECT_BOX] = bool;
      break;
  }
};

// whether to use Path2D caching for drawing
var pathsImpld = typeof Path2D !== 'undefined';

CRp.path2dEnabled = function (on) {
  if (on === undefined) {
    return this.pathsEnabled;
  }

  this.pathsEnabled = on ? true : false;
};

CRp.usePaths = function () {
  return pathsImpld && this.pathsEnabled;
};

[__webpack_require__(126), __webpack_require__(127), __webpack_require__(128), __webpack_require__(129), __webpack_require__(130), __webpack_require__(131), __webpack_require__(132), __webpack_require__(133), __webpack_require__(134), __webpack_require__(135)].forEach(function (props) {
  util.extend(CRp, props);
});

module.exports = CR;

/***/ }),
/* 124 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var math = __webpack_require__(2);
var util = __webpack_require__(1);
var Heap = __webpack_require__(9);
var defs = __webpack_require__(19);

var minTxrH = 25; // the size of the texture cache for small height eles (special case)
var txrStepH = 50; // the min size of the regular cache, and the size it increases with each step up
var minLvl = -4; // when scaling smaller than that we don't need to re-render
var maxLvl = 2; // when larger than this scale just render directly (caching is not helpful)
var maxZoom = 3.99; // beyond this zoom level, layered textures are not used
var eleTxrSpacing = 8; // spacing between elements on textures to avoid blitting overlaps
var defTxrWidth = 1024; // default/minimum texture width
var maxTxrW = 1024; // the maximum width of a texture
var maxTxrH = 1024; // the maximum height of a texture
var minUtility = 0.5; // if usage of texture is less than this, it is retired
var maxFullness = 0.8; // fullness of texture after which queue removal is checked
var maxFullnessChecks = 10; // dequeued after this many checks
var allowEdgeTxrCaching = false; // whether edges can be cached as textures (TODO maybe better on if webgl supported?)
var allowParentTxrCaching = false; // whether parent nodes can be cached as textures (TODO maybe better on if webgl supported?)
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

var ElementTextureCache = function ElementTextureCache(renderer) {
  var self = this;

  self.renderer = renderer;
  self.onDequeues = [];

  self.setupDequeueing();
};

var ETCp = ElementTextureCache.prototype;

ETCp.reasons = getTxrReasons;

// the list of textures in which new subtextures for elements can be placed
ETCp.getTextureQueue = function (txrH) {
  var self = this;
  self.eleImgCaches = self.eleImgCaches || {};

  return self.eleImgCaches[txrH] = self.eleImgCaches[txrH] || [];
};

// the list of usused textures which can be recycled (in use in texture queue)
ETCp.getRetiredTextureQueue = function (txrH) {
  var self = this;

  var rtxtrQs = self.eleImgCaches.retired = self.eleImgCaches.retired || {};
  var rtxtrQ = rtxtrQs[txrH] = rtxtrQs[txrH] || [];

  return rtxtrQ;
};

// queue of element draw requests at different scale levels
ETCp.getElementQueue = function () {
  var self = this;

  var q = self.eleCacheQueue = self.eleCacheQueue || new Heap(function (a, b) {
    return b.reqs - a.reqs;
  });

  return q;
};

// queue of element draw requests at different scale levels (element id lookup)
ETCp.getElementIdToQueue = function () {
  var self = this;

  var id2q = self.eleIdToCacheQueue = self.eleIdToCacheQueue || {};

  return id2q;
};

ETCp.getElement = function (ele, bb, pxRatio, lvl, reason) {
  var self = this;
  var r = this.renderer;
  var rs = ele._private.rscratch;
  var zoom = r.cy.zoom();

  if (bb.w === 0 || bb.h === 0 || !ele.visible()) {
    return null;
  }

  if (lvl == null) {
    lvl = Math.ceil(math.log2(zoom * pxRatio));
  }

  if (lvl < minLvl) {
    lvl = minLvl;
  } else if (zoom >= maxZoom || lvl > maxLvl) {
    return null;
  }

  var scale = Math.pow(2, lvl);
  var eleScaledH = bb.h * scale;
  var eleScaledW = bb.w * scale;
  var caches = rs.imgCaches = rs.imgCaches || {};
  var eleCache = caches[lvl];

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

  if (eleScaledH > maxTxrH || eleScaledW > maxTxrW || !allowEdgeTxrCaching && ele.isEdge() || !allowParentTxrCaching && ele.isParent()) {
    return null; // caching large elements is not efficient
  }

  var txrQ = self.getTextureQueue(txrH);

  // first try the second last one in case it has space at the end
  var txr = txrQ[txrQ.length - 2];

  var addNewTxr = function addNewTxr() {
    return self.recycleTexture(txrH, eleScaledW) || self.addTexture(txrH, eleScaledW);
  };

  // try the last one if there is no second last one
  if (!txr) {
    txr = txrQ[txrQ.length - 1];
  }

  // if the last one doesn't exist, we need a first one
  if (!txr) {
    txr = addNewTxr();
  }

  // if there's no room in the current texture, we need a new one
  if (txr.width - txr.usedWidth < eleScaledW) {
    txr = addNewTxr();
  }

  var scaledLabelShown = r.eleTextBiggerThanMin(ele, scale);
  var scalableFrom = function scalableFrom(otherCache) {
    return otherCache && otherCache.scaledLabelShown === scaledLabelShown;
  };

  var deqing = reason && reason === getTxrReasons.dequeue;
  var highQualityReq = reason && reason === getTxrReasons.highQuality;
  var downscaleReq = reason && reason === getTxrReasons.downscale;

  var higherCache; // the nearest cache with a higher level
  for (var l = lvl + 1; l <= maxLvl; l++) {
    var c = caches[l];

    if (c) {
      higherCache = c;break;
    }
  }

  var oneUpCache = higherCache && higherCache.level === lvl + 1 ? higherCache : null;

  var downscale = function downscale() {
    txr.context.drawImage(oneUpCache.texture.canvas, oneUpCache.x, 0, oneUpCache.width, oneUpCache.height, txr.usedWidth, 0, eleScaledW, eleScaledH);
  };

  // reset ele area in texture
  txr.context.setTransform(1, 0, 0, 1, 0, 0);
  txr.context.clearRect(txr.usedWidth, 0, eleScaledW, txrH);

  if (scalableFrom(oneUpCache)) {
    // then we can relatively cheaply rescale the existing image w/o rerendering
    downscale();
  } else if (scalableFrom(higherCache)) {
    // then use the higher cache for now and queue the next level down
    // to cheaply scale towards the smaller level

    if (highQualityReq) {
      for (var l = higherCache.level; l > lvl; l--) {
        oneUpCache = self.getElement(ele, bb, pxRatio, l, getTxrReasons.downscale);
      }

      downscale();
    } else {
      self.queueElement(ele, higherCache.level - 1);

      return higherCache;
    }
  } else {

    var lowerCache; // the nearest cache with a lower level
    if (!deqing && !highQualityReq && !downscaleReq) {
      for (var l = lvl - 1; l >= minLvl; l--) {
        var c = caches[l];

        if (c) {
          lowerCache = c;break;
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

    r.drawElement(txr.context, ele, bb, scaledLabelShown);

    txr.context.scale(1 / scale, 1 / scale);
    txr.context.translate(-txr.usedWidth, 0);
  }

  eleCache = caches[lvl] = {
    ele: ele,
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

  self.checkTextureFullness(txr);

  return eleCache;
};

ETCp.invalidateElement = function (ele) {
  var self = this;
  var caches = ele._private.rscratch.imgCaches;

  if (caches) {
    for (var lvl = minLvl; lvl <= maxLvl; lvl++) {
      var cache = caches[lvl];

      if (cache) {
        var txr = cache.texture;

        // remove space from the texture it belongs to
        txr.invalidatedWidth += cache.width;

        // remove refs with the element
        caches[lvl] = null;
        util.removeFromArray(txr.eleCaches, cache);

        // remove from queue since the old req was for the old state
        self.removeFromQueue(ele);

        // might have to remove the entire texture if it's not efficiently using its space
        self.checkTextureUtility(txr);
      }
    }
  }
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
    util.removeFromArray(txrQ, txr);
  } else {
    txr.fullnessChecks++;
  }
};

ETCp.retireTexture = function (txr) {
  var self = this;
  var txrH = txr.height;
  var txrQ = self.getTextureQueue(txrH);

  // retire the texture from the active / searchable queue:

  util.removeFromArray(txrQ, txr);

  txr.retired = true;

  // remove the refs from the eles to the caches:

  var eleCaches = txr.eleCaches;

  for (var i = 0; i < eleCaches.length; i++) {
    var eleCache = eleCaches[i];
    var ele = eleCache.ele;
    var lvl = eleCache.level;
    var imgCaches = ele._private.rscratch.imgCaches;

    if (imgCaches) {
      imgCaches[lvl] = null;
    }
  }

  util.clearArray(eleCaches);

  // add the texture to a retired queue so it can be recycled in future:

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

  txr.canvas = document.createElement('canvas'); // eslint-disable-line no-undef
  txr.canvas.width = txr.width;
  txr.canvas.height = txr.height;

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

      util.clearArray(txr.eleCaches);

      txr.context.setTransform(1, 0, 0, 1, 0, 0);
      txr.context.clearRect(0, 0, txr.width, txr.height);

      util.removeFromArray(rtxtrQ, txr);
      txrQ.push(txr);

      return txr;
    }
  }
};

ETCp.queueElement = function (ele, lvl) {
  var self = this;
  var q = self.getElementQueue();
  var id2q = self.getElementIdToQueue();
  var id = ele.id();
  var existingReq = id2q[id];

  if (existingReq) {
    // use the max lvl b/c in between lvls are cheap to make
    existingReq.level = Math.max(existingReq.level, lvl);
    existingReq.reqs++;

    q.updateItem(existingReq);
  } else {
    var req = {
      ele: ele,
      level: lvl,
      reqs: 1
    };

    q.push(req);

    id2q[id] = req;
  }
};

ETCp.dequeue = function (pxRatio /*, extent*/) {
  var self = this;
  var q = self.getElementQueue();
  var id2q = self.getElementIdToQueue();
  var dequeued = [];

  for (var i = 0; i < maxDeqSize; i++) {
    if (q.size() > 0) {
      var req = q.pop();
      var ele = req.ele;
      var caches = ele._private.rscratch.imgCaches;

      // dequeueing isn't necessary when an existing cache exists
      if (caches[req.level] != null) {
        continue;
      }

      id2q[ele.id()] = null;

      dequeued.push(req);

      var bb = ele.boundingBox();

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
  var id2q = self.getElementIdToQueue();
  var req = id2q[ele.id()];

  if (req != null) {
    // bring to front of queue
    req.reqs = util.MAX_INT;
    q.updateItem(req);

    q.pop(); // remove from queue

    id2q[ele.id()] = null; // remove from lookup map
  }
};

ETCp.onDequeue = function (fn) {
  this.onDequeues.push(fn);
};
ETCp.offDequeue = function (fn) {
  util.removeFromArray(this.onDequeues, fn);
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
      var bb = deqd[i].ele.boundingBox();

      if (math.boundingBoxesIntersect(bb, extent)) {
        return true;
      }
    }

    return false;
  },
  priority: function priority(self) {
    return self.renderer.beforeRenderPriorities.eleTxrDeq;
  }
});

module.exports = ElementTextureCache;

/***/ }),
/* 125 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);
var math = __webpack_require__(2);
var Heap = __webpack_require__(9);
var is = __webpack_require__(0);
var defs = __webpack_require__(19);

var defNumLayers = 1; // default number of layers to use
var minLvl = -4; // when scaling smaller than that we don't need to re-render
var maxLvl = 2; // when larger than this scale just render directly (caching is not helpful)
var maxZoom = 3.99; // beyond this zoom level, layered textures are not used
var deqRedrawThreshold = 50; // time to batch redraws together from dequeueing to allow more dequeueing calcs to happen in the meanwhile
var refineEleDebounceTime = 50; // time to debounce sharper ele texture updates
var disableEleImgSmoothing = true; // when drawing eles on layers from an ele cache ; crisper and more performant when true
var deqCost = 0.15; // % of add'l rendering cost allowed for dequeuing ele caches each frame
var deqAvgCost = 0.1; // % of add'l rendering cost compared to average overall redraw time
var deqNoDrawCost = 0.9; // % of avg frame time that can be used for dequeueing when not drawing
var deqFastCost = 0.9; // % of frame time to be used when >60fps
var maxDeqSize = 1; // number of eles to dequeue and render at higher texture in each batch
var invalidThreshold = 250; // time threshold for disabling b/c of invalidations
var maxLayerArea = 4000 * 4000; // layers can't be bigger than this
var alwaysQueue = true; // never draw all the layers in a level on a frame; draw directly until all dequeued
var useHighQualityEleTxrReqs = true; // whether to use high quality ele txr requests (generally faster and cheaper in the longterm)

var useEleTxrCaching = true; // whether to use individual ele texture caching underneath this cache

// var log = function(){ console.log.apply( console, arguments ); };

var LayeredTextureCache = function LayeredTextureCache(renderer, eleTxrCache) {
  var self = this;

  var r = self.renderer = renderer;

  self.layersByLevel = {}; // e.g. 2 => [ layer1, layer2, ..., layerN ]

  self.firstGet = true;

  self.lastInvalidationTime = util.performanceNow() - 2 * invalidThreshold;

  self.skipping = false;

  r.beforeRender(function (willDraw, now) {
    if (now - self.lastInvalidationTime <= invalidThreshold) {
      self.skipping = true;
    } else {
      self.skipping = false;
    }
  });

  var qSort = function qSort(a, b) {
    return b.reqs - a.reqs;
  };

  self.layersQueue = new Heap(qSort);

  self.eleTxrCache = eleTxrCache;

  self.setupEleCacheInvalidation();

  self.setupDequeueing();
};

var LTCp = LayeredTextureCache.prototype;

var layerIdPool = 0;
var MAX_INT = Math.pow(2, 53) - 1;

LTCp.makeLayer = function (bb, lvl) {
  var scale = Math.pow(2, lvl);

  var w = Math.ceil(bb.w * scale);
  var h = Math.ceil(bb.h * scale);

  var canvas = document.createElement('canvas'); // eslint-disable-line no-undef

  canvas.width = w;
  canvas.height = h;

  var layer = {
    id: layerIdPool = ++layerIdPool % MAX_INT,
    bb: bb,
    level: lvl,
    width: w,
    height: h,
    canvas: canvas,
    context: canvas.getContext('2d'),
    eles: [],
    elesQueue: [],
    reqs: 0
  };

  // log('make layer %s with w %s and h %s and lvl %s', layer.id, layer.width, layer.height, layer.level);

  var cxt = layer.context;
  var dx = -layer.bb.x1;
  var dy = -layer.bb.y1;

  // do the transform on creation to save cycles (it's the same for all eles)
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

  self.firstGet = false;

  // log('--\nget layers with %s eles', eles.length);
  //log eles.map(function(ele){ return ele.id() }) );

  if (lvl == null) {
    lvl = Math.ceil(math.log2(zoom * pxRatio));

    if (lvl < minLvl) {
      lvl = minLvl;
    } else if (zoom >= maxZoom || lvl > maxLvl) {
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

      for (var l = lvl + dir; minLvl <= l && l <= maxLvl; l += dir) {
        if (canUseAsTmpLvl(l)) {
          break;
        }
      }
    };

    checkLvls(+1);
    checkLvls(-1);

    // remove the invalid layers; they will be replaced as needed later in this function
    for (var i = layers.length - 1; i >= 0; i--) {
      var layer = layers[i];

      if (layer.invalid) {
        util.removeFromArray(layers, layer);
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
      bb = math.makeBoundingBox();

      for (var i = 0; i < eles.length; i++) {
        math.updateBoundingBox(bb, eles[i].boundingBox());
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
    }

    // if( tmpLayers ){
    //self.queueLayer( layer );
    // }

    return layer;
  };

  if (self.skipping && !firstGet) {
    // log('skip layers');
    return null;
  }

  // log('do layers');

  var layer = null;
  var maxElesPerLayer = eles.length / defNumLayers;
  var allowLazyQueueing = alwaysQueue && !firstGet;

  for (var i = 0; i < eles.length; i++) {
    var ele = eles[i];
    var rs = ele._private.rscratch;
    var caches = rs.imgLayerCaches = rs.imgLayerCaches || {};

    // log('look at ele', ele.id());

    var existingLayer = caches[lvl];

    if (existingLayer) {
      // reuse layer for later eles
      // log('reuse layer for', ele.id());
      layer = existingLayer;
      continue;
    }

    if (!layer || layer.eles.length >= maxElesPerLayer || !math.boundingBoxInBoundingBox(layer.bb, ele.boundingBox())) {
      // log('make new layer for ele %s', ele.id());

      layer = makeLayer({ insert: true, after: layer });

      // if now layer can be built then we can't use layers at this level
      if (!layer) {
        return null;
      }

      // log('new layer with id %s', layer.id);
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
  }

  // log('--');

  if (tmpLayers) {
    // then we only queued the current layerset and can't draw it yet
    return tmpLayers;
  }

  if (allowLazyQueueing) {
    // log('lazy queue level', lvl);
    return null;
  }

  return layers;
};

// a layer may want to use an ele cache of a higher level to avoid blurriness
// so the layer level might not equal the ele level
LTCp.getEleLevelForLayerLevel = function (lvl, pxRatio) {
  return lvl;
};

function imgSmoothing(context, bool) {
  if (context.imageSmoothingEnabled != null) {
    context.imageSmoothingEnabled = bool;
  } else {
    context.webkitImageSmoothingEnabled = bool;
    context.mozImageSmoothingEnabled = bool;
    context.msImageSmoothingEnabled = bool;
  }
}

LTCp.drawEleInLayer = function (layer, ele, lvl, pxRatio) {
  var self = this;
  var r = this.renderer;
  var context = layer.context;
  var bb = ele.boundingBox();

  if (bb.w === 0 || bb.h === 0 || !ele.visible()) {
    return;
  }

  var eleCache = self.eleTxrCache;
  var reason = useHighQualityEleTxrReqs ? eleCache.reasons.highQuality : undefined;

  lvl = self.getEleLevelForLayerLevel(lvl, pxRatio);

  var cache = useEleTxrCaching ? eleCache.getElement(ele, bb, null, lvl, reason) : null;

  if (cache) {
    if (disableEleImgSmoothing) {
      imgSmoothing(context, false);
    }

    context.drawImage(cache.texture.canvas, cache.x, 0, cache.width, cache.height, bb.x1, bb.y1, bb.w, bb.h);

    if (disableEleImgSmoothing) {
      imgSmoothing(context, true);
    }
  } else {
    // if the element is not cacheable, then draw directly
    r.drawElement(context, ele);
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
    var layer = layers[i];

    // if there are any eles needed to be drawn yet, the level is not complete
    if (layer.reqs > 0) {
      return false;
    }

    // if the layer is invalid, the level is not complete
    if (layer.invalid) {
      return false;
    }

    numElesInLayers += layer.eles.length;
  }

  // we should have exactly the number of eles passed in to be complete
  if (numElesInLayers !== eles.length) {
    return false;
  }

  return true;
};

LTCp.validateLayersElesOrdering = function (lvl, eles) {
  var layers = this.layersByLevel[lvl];

  if (!layers) {
    return;
  }

  // if in a layer the eles are not in the same order, then the layer is invalid
  // (i.e. there is an ele in between the eles in the layer)

  for (var i = 0; i < layers.length; i++) {
    var layer = layers[i];
    var offset = -1;

    // find the offset
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
    }

    // the eles in the layer must be in the same continuous order, else the layer is invalid

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
  var isEles = is.element(eles[0]);

  // collect udpated elements (cascaded from the layers) and update each
  // layer itself along the way
  for (var i = 0; i < eles.length; i++) {
    var req = isEles ? null : eles[i];
    var ele = isEles ? eles[i] : eles[i].ele;
    var rs = ele._private.rscratch;
    var caches = rs.imgLayerCaches = rs.imgLayerCaches || {};

    for (var l = minLvl; l <= maxLvl; l++) {
      var layer = caches[l];

      if (!layer) {
        continue;
      }

      // if update is a request from the ele cache, then it affects only
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

  for (var l = minLvl; l <= maxLvl; l++) {
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

  self.lastInvalidationTime = util.performanceNow();

  // log('update invalidate layer time from eles');

  if (eles.length === 0 || !self.haveLayers()) {
    return;
  }

  self.updateElementsInLayers(eles, function invalAssocLayers(layer, ele, req) {
    self.invalidateLayer(layer);
  });
};

LTCp.invalidateLayer = function (layer) {
  // log('update invalidate layer time');

  this.lastInvalidationTime = util.performanceNow();

  if (layer.invalid) {
    return;
  } // save cycles

  var lvl = layer.level;
  var eles = layer.eles;
  var layers = this.layersByLevel[lvl];

  // log('invalidate layer', layer.id );

  util.removeFromArray(layers, layer);
  // layer.eles = [];

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
  var self = this;

  // log('refine', eles.length);

  self.updateElementsInLayers(eles, function refineEachEle(layer, ele, req) {
    var rLyr = layer.replacement;

    if (!rLyr) {
      rLyr = layer.replacement = self.makeLayer(layer.bb, layer.level);
      rLyr.replaces = layer;
      rLyr.eles = layer.eles;

      // log('make replacement layer %s for %s with level %s', rLyr.id, layer.id, rLyr.level);
    }

    if (!rLyr.reqs) {
      for (var i = 0; i < rLyr.eles.length; i++) {
        self.queueLayer(rLyr, rLyr.eles[i]);
      }

      // log('queue replacement layer refinement', rLyr.id);
    }
  });
};

LTCp.setupEleCacheInvalidation = function () {
  var self = this;
  var eleDeqs = [];

  if (!useEleTxrCaching) {
    return;
  }

  var updatedElesInLayers = util.debounce(function () {
    self.refineElementTextures(eleDeqs);

    eleDeqs = [];
  }, refineEleDebounceTime);

  self.eleTxrCache.onDequeue(function (reqs) {
    for (var i = 0; i < reqs.length; i++) {
      eleDeqs.push(reqs[i]);
    }

    updatedElesInLayers();
  });
};

LTCp.queueLayer = function (layer, ele) {
  var self = this;
  var q = self.layersQueue;
  var elesQ = layer.elesQueue;
  var hasId = elesQ.hasId = elesQ.hasId || {};

  // if a layer is going to be replaced, queuing is a waste of time
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

  while (eleDeqs < maxDeqSize) {
    if (q.size() === 0) {
      break;
    }

    var layer = q.peek();

    // if a layer has been or will be replaced, then don't waste time with it
    if (layer.replacement) {
      // log('layer %s in queue skipped b/c it already has a replacement', layer.id);
      q.pop();
      continue;
    }

    // if this is a replacement layer that has been superceded, then forget it
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
    }

    // if the layer has all its eles done, then remove from the queue
    if (layer.elesQueue.length === 0) {
      q.pop();

      layer.reqs = 0;

      // log('dequeue of layer %s complete', layer.id);

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
  var index = layersInLevel.indexOf(replaced);

  // if the replaced layer is not in the active list for the level, then replacing
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
  }

  // log('apply replacement layer %s over %s', layer.id, replaced.id);

  self.requestRedraw();
};

LTCp.requestRedraw = util.debounce(function () {
  var r = this.renderer;

  r.redrawHint('eles', true);
  r.redrawHint('drag', true);
  r.redraw();
}, 100);

LTCp.setupDequeueing = defs.setupDequeueing({
  deqRedrawThreshold: deqRedrawThreshold,
  deqCost: deqCost,
  deqAvgCost: deqAvgCost,
  deqNoDrawCost: deqNoDrawCost,
  deqFastCost: deqFastCost,
  deq: function deq(self, pxRatio) {
    return self.dequeue(pxRatio);
  },
  onDeqd: util.noop,
  shouldRedraw: util.trueify,
  priority: function priority(self) {
    return self.renderer.beforeRenderPriorities.lyrTxrDeq;
  }
});

module.exports = LayeredTextureCache;

/***/ }),
/* 126 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var CRp = {};

var impl;

CRp.arrowShapeImpl = function (name) {
  return (impl || (impl = {
    'polygon': function polygon(context, points) {
      for (var i = 0; i < points.length; i++) {
        var pt = points[i];

        context.lineTo(pt.x, pt.y);
      }
    },

    'triangle-backcurve': function triangleBackcurve(context, points, controlPoint) {
      var firstPt;

      for (var i = 0; i < points.length; i++) {
        var pt = points[i];

        if (i === 0) {
          firstPt = pt;
        }

        context.lineTo(pt.x, pt.y);
      }

      context.quadraticCurveTo(controlPoint.x, controlPoint.y, firstPt.x, firstPt.y);
    },

    'triangle-tee': function triangleTee(context, trianglePoints, teePoints) {
      if (context.beginPath) {
        context.beginPath();
      }

      var triPts = trianglePoints;
      for (var i = 0; i < triPts.length; i++) {
        var pt = triPts[i];

        context.lineTo(pt.x, pt.y);
      }

      if (context.closePath) {
        context.closePath();
      }

      if (context.beginPath) {
        context.beginPath();
      }

      var teePts = teePoints;
      var firstTeePt = teePoints[0];
      context.moveTo(firstTeePt.x, firstTeePt.y);

      for (var i = 0; i < teePts.length; i++) {
        var pt = teePts[i];

        context.lineTo(pt.x, pt.y);
      }
      if (context.closePath) {
        context.closePath();
      }
    },

    'triangle-cross': function triangleCross(context, trianglePoints, crossLinePoints) {
      if (context.beginPath) {
        context.beginPath();
      }

      var triPts = trianglePoints;
      for (var i = 0; i < triPts.length; i++) {
        var pt = triPts[i];

        context.lineTo(pt.x, pt.y);
      }

      if (context.closePath) {
        context.closePath();
      }

      if (context.beginPath) {
        context.beginPath();
      }

      var teePts = crossLinePoints;
      var firstTeePt = crossLinePoints[0];
      context.moveTo(firstTeePt.x, firstTeePt.y);

      for (var i = 0; i < teePts.length; i++) {
        var pt = teePts[i];

        context.lineTo(pt.x, pt.y);
      }
      if (context.closePath) {
        context.closePath();
      }
    },

    'circle': function circle(context, rx, ry, r) {
      context.arc(rx, ry, r, 0, Math.PI * 2, false);
    }
  }))[name];
};

module.exports = CRp;

/***/ }),
/* 127 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var math = __webpack_require__(2);

var CRp = {};

CRp.drawElement = function (context, ele, shiftToOriginWithBb, showLabel) {
  var r = this;

  if (ele.isNode()) {
    r.drawNode(context, ele, shiftToOriginWithBb, showLabel);
  } else {
    r.drawEdge(context, ele, shiftToOriginWithBb, showLabel);
  }
};

CRp.drawCachedElement = function (context, ele, pxRatio, extent) {
  var r = this;
  var bb = ele.boundingBox();

  if (bb.w === 0 || bb.h === 0) {
    return;
  }

  if (!extent || math.boundingBoxesIntersect(bb, extent)) {
    var cache = r.data.eleTxrCache.getElement(ele, bb, pxRatio);

    if (cache != null) {
      context.drawImage(cache.texture.canvas, cache.x, 0, cache.width, cache.height, bb.x1, bb.y1, bb.w, bb.h);
    } else {
      // if the element is not cacheable, then draw directly
      r.drawElement(context, ele);
    }
  }
};

CRp.drawElements = function (context, eles) {
  var r = this;

  for (var i = 0; i < eles.length; i++) {
    var ele = eles[i];

    r.drawElement(context, ele);
  }
};

CRp.drawCachedElements = function (context, eles, pxRatio, extent) {
  var r = this;

  for (var i = 0; i < eles.length; i++) {
    var ele = eles[i];

    r.drawCachedElement(context, ele, pxRatio, extent);
  }
};

CRp.drawCachedNodes = function (context, eles, pxRatio, extent) {
  var r = this;

  for (var i = 0; i < eles.length; i++) {
    var ele = eles[i];

    if (!ele.isNode()) {
      continue;
    }

    r.drawCachedElement(context, ele, pxRatio, extent);
  }
};

CRp.drawLayeredElements = function (context, eles, pxRatio, extent) {
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

CRp.drawDebugPoints = function (context, eles) {
  var draw = function draw(x, y, color) {
    context.fillStyle = color;
    context.fillRect(x - 1, y - 1, 3, 3);
  };

  for (var i = 0; i < eles.length; i++) {
    var ele = eles[i];
    var rs = ele._private.rscratch;

    if (ele.isNode()) {
      var p = ele.position();

      draw(p.x, p.y, 'magenta');
    } else {
      var pts = rs.allpts;

      for (var j = 0; j + 1 < pts.length; j += 2) {
        var x = pts[j];
        var y = pts[j + 1];

        draw(x, y, 'cyan');
      }

      draw(rs.midX, rs.midY, 'yellow');
    }
  }
};

module.exports = CRp;

/***/ }),
/* 128 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var CRp = {};

CRp.drawEdge = function (context, edge, shiftToOriginWithBb, drawLabel) {
  var r = this;
  var rs = edge._private.rscratch;
  var usePaths = r.usePaths();

  if (!edge.visible()) {
    return;
  }

  // if bezier ctrl pts can not be calculated, then die
  if (rs.badLine || rs.allpts == null || isNaN(rs.allpts[0])) {
    // isNaN in case edge is impossible and browser bugs (e.g. safari)
    return;
  }

  var bb = void 0;
  if (shiftToOriginWithBb) {
    bb = shiftToOriginWithBb;

    context.translate(-bb.x1, -bb.y1);
  }

  var overlayPadding = edge.pstyle('overlay-padding').pfValue;
  var overlayWidth = 2 * overlayPadding;
  var overlayOpacity = edge.pstyle('overlay-opacity').value;
  var overlayColor = edge.pstyle('overlay-color').value;
  var lineColor = edge.pstyle('line-color').value;
  var opacity = edge.pstyle('opacity').value;
  var lineStyle = edge.pstyle('line-style').value;
  var edgeWidth = edge.pstyle('width').pfValue;

  var drawLine = function drawLine() {
    var strokeOpacity = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : opacity;

    context.lineWidth = edgeWidth;
    context.lineCap = 'butt';

    r.strokeStyle(context, lineColor[0], lineColor[1], lineColor[2], strokeOpacity);

    r.drawEdgePath(edge, context, rs.allpts, lineStyle);
  };

  var drawOverlay = function drawOverlay() {
    var strokeOpacity = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : overlayOpacity;

    context.lineWidth = overlayWidth;

    if (rs.edgeType === 'self' && !usePaths) {
      context.lineCap = 'butt';
    } else {
      context.lineCap = 'round';
    }

    r.strokeStyle(context, overlayColor[0], overlayColor[1], overlayColor[2], strokeOpacity);

    r.drawEdgePath(edge, context, rs.allpts, 'solid');
  };

  var drawArrows = function drawArrows() {
    var arrowOpacity = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : opacity;

    r.drawArrowheads(context, edge, arrowOpacity);
  };

  var drawText = function drawText() {
    r.drawElementText(context, edge, drawLabel);
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

CRp.drawEdgePath = function (edge, context, pts, type) {
  var rs = edge._private.rscratch;
  var canvasCxt = context;
  var path = void 0;
  var pathCacheHit = false;
  var usePaths = this.usePaths();

  if (usePaths) {
    var pathCacheKey = pts.join('$');
    var keyMatches = rs.pathCacheKey && rs.pathCacheKey === pathCacheKey;

    if (keyMatches) {
      path = context = rs.pathCache;
      pathCacheHit = true;
    } else {
      path = context = new Path2D(); // eslint-disable-line no-undef
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
        canvasCxt.setLineDash([6, 3]);
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
  }

  // reset any line dashes
  if (context.setLineDash) {
    // for very outofdate browsers
    context.setLineDash([]);
  }
};

CRp.drawArrowheads = function (context, edge, opacity) {
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

CRp.drawArrowhead = function (context, edge, prefix, x, y, angle, opacity) {
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

    self.fillStyle(context, 255, 255, 255, 1);
    self.strokeStyle(context, 255, 255, 255, 1);

    self.drawArrowShape(edge, prefix, context, arrowClearFill, edgeWidth, arrowShape, x, y, angle);

    context.globalCompositeOperation = gco;
  } // otherwise, the opaque arrow clears it for free :)

  var color = edge.pstyle(prefix + '-arrow-color').value;
  self.fillStyle(context, color[0], color[1], color[2], opacity);
  self.strokeStyle(context, color[0], color[1], color[2], opacity);

  self.drawArrowShape(edge, prefix, context, arrowFill, edgeWidth, arrowShape, x, y, angle);
};

CRp.drawArrowShape = function (edge, arrowType, context, fill, edgeWidth, shape, x, y, angle) {
  var r = this;
  var usePaths = this.usePaths();
  var rs = edge._private.rscratch;
  var pathCacheHit = false;
  var path = void 0;
  var canvasContext = context;
  var translation = { x: x, y: y };
  var scale = edge.pstyle('arrow-scale').value;
  var size = this.getArrowWidth(edgeWidth, scale);
  var shapeImpl = r.arrowShapes[shape];

  if (usePaths) {
    var pathCacheKey = size + '$' + shape + '$' + angle + '$' + x + '$' + y;
    rs.arrowPathCacheKey = rs.arrowPathCacheKey || {};
    rs.arrowPathCache = rs.arrowPathCache || {};

    var alreadyCached = rs.arrowPathCacheKey[arrowType] === pathCacheKey;
    if (alreadyCached) {
      path = context = rs.arrowPathCache[arrowType];
      pathCacheHit = true;
    } else {
      path = context = new Path2D(); // eslint-disable-line no-undef
      rs.arrowPathCacheKey[arrowType] = pathCacheKey;
      rs.arrowPathCache[arrowType] = path;
    }
  }

  if (context.beginPath) {
    context.beginPath();
  }

  if (!pathCacheHit) {
    shapeImpl.draw(context, size, angle, translation, edgeWidth);
  }

  if (!shapeImpl.leavePathOpen && context.closePath) {
    context.closePath();
  }

  context = canvasContext;

  if (fill === 'filled' || fill === 'both') {
    if (usePaths) {
      context.fill(path);
    } else {
      context.fill();
    }
  }

  if (fill === 'hollow' || fill === 'both') {
    context.lineWidth = shapeImpl.matchEdgeWidth ? edgeWidth : 1;
    context.lineJoin = 'miter';

    if (usePaths) {
      context.stroke(path);
    } else {
      context.stroke();
    }
  }
};

module.exports = CRp;

/***/ }),
/* 129 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var CRp = {};

CRp.safeDrawImage = function (context, img, ix, iy, iw, ih, x, y, w, h) {
  var r = this;

  // detect problematic cases for old browsers with bad images (cheaper than try-catch)
  if (iw <= 0 || ih <= 0 || w <= 0 || h <= 0) {
    return;
  }

  context.drawImage(img, ix, iy, iw, ih, x, y, w, h);
};

CRp.drawInscribedImage = function (context, img, node, index, nodeOpacity) {
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
  var clip = node.pstyle('background-clip').value;
  var shouldClip = clip === 'node';
  var imgOpacity = getIndexedStyle(node, 'background-image-opacity', 'value', index) * nodeOpacity;

  var imgW = img.width || img.cachedW;
  var imgH = img.height || img.cachedH;

  // workaround for broken browsers like ie
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
  if (getIndexedStyle(node, 'background-position-x', 'units', index) === '%') {
    x += (nodeTW - w) * getIndexedStyle(node, 'background-position-x', 'pfValue', index);
  } else {
    x += getIndexedStyle(node, 'background-position-x', 'pfValue', index);
  }

  var y = nodeY - nodeTH / 2; // top
  if (getIndexedStyle(node, 'background-position-y', 'units', index) === '%') {
    y += (nodeTH - h) * getIndexedStyle(node, 'background-position-y', 'pfValue', index);
  } else {
    y += getIndexedStyle(node, 'background-position-y', 'pfValue', index);
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

module.exports = CRp;

/***/ }),
/* 130 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var util = __webpack_require__(1);
var math = __webpack_require__(2);

var CRp = {};

CRp.eleTextBiggerThanMin = function (ele, scale) {
  if (!scale) {
    var zoom = ele.cy().zoom();
    var pxRatio = this.getPixelRatio();
    var lvl = Math.ceil(math.log2(zoom * pxRatio)); // the effective texture level

    scale = Math.pow(2, lvl);
  }

  var computedSize = ele.pstyle('font-size').pfValue * scale;
  var minSize = ele.pstyle('min-zoomed-font-size').pfValue;

  if (computedSize < minSize) {
    return false;
  }

  return true;
};

CRp.drawElementText = function (context, ele, force) {
  var r = this;

  if (force === undefined) {
    if (!r.eleTextBiggerThanMin(ele)) {
      return;
    }
  } else {
    if (!force) {
      return;
    }
  }

  if (ele.isNode()) {
    var label = ele.pstyle('label');

    if (!label || !label.value) {
      return;
    }

    var textHalign = ele.pstyle('text-halign').strValue;
    var textValign = ele.pstyle('text-valign').strValue;

    switch (textHalign) {
      case 'left':
        context.textAlign = 'right';
        break;

      case 'right':
        context.textAlign = 'left';
        break;

      default:
        // e.g. center
        context.textAlign = 'center';
    }

    context.textBaseline = 'bottom';
  } else {
    var label = ele.pstyle('label');
    var srcLabel = ele.pstyle('source-label');
    var tgtLabel = ele.pstyle('target-label');

    if ((!label || !label.value) && (!srcLabel || !srcLabel.value) && (!tgtLabel || !tgtLabel.value)) {
      return;
    }

    context.textAlign = 'center';
    context.textBaseline = 'bottom';
  }

  r.drawText(context, ele);

  if (ele.isEdge()) {
    r.drawText(context, ele, 'source');

    r.drawText(context, ele, 'target');
  }
};

CRp.drawNodeText = CRp.drawEdgeText = CRp.drawElementText;

CRp.getFontCache = function (context) {
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
};

// set up canvas context with font
// returns transformed text string
CRp.setupTextStyle = function (context, ele) {
  // Font style
  var parentOpacity = ele.effectiveOpacity();
  var labelStyle = ele.pstyle('font-style').strValue;
  var labelSize = ele.pstyle('font-size').pfValue + 'px';
  var labelFamily = ele.pstyle('font-family').strValue;
  var labelWeight = ele.pstyle('font-weight').strValue;
  var opacity = ele.pstyle('text-opacity').value * ele.pstyle('opacity').value * parentOpacity;
  var outlineOpacity = ele.pstyle('text-outline-opacity').value * opacity;
  var color = ele.pstyle('color').value;
  var outlineColor = ele.pstyle('text-outline-color').value;

  var fontCacheKey = ele._private.fontKey;
  var cache = this.getFontCache(context);

  if (cache.key !== fontCacheKey) {
    context.font = labelStyle + ' ' + labelWeight + ' ' + labelSize + ' ' + labelFamily;

    cache.key = fontCacheKey;
  }

  // Calculate text draw position based on text alignment

  // so text outlines aren't jagged
  context.lineJoin = 'round';

  this.fillStyle(context, color[0], color[1], color[2], opacity);

  this.strokeStyle(context, outlineColor[0], outlineColor[1], outlineColor[2], outlineOpacity);
};

function roundRect(ctx, x, y, width, height, radius) {
  var radius = radius || 5;
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

// Draw text
CRp.drawText = function (context, ele, prefix) {
  var _p = ele._private;
  var rscratch = _p.rscratch;
  var parentOpacity = ele.effectiveOpacity();
  if (parentOpacity === 0 || ele.pstyle('text-opacity').value === 0) {
    return;
  }

  var textX = util.getPrefixedProperty(rscratch, 'labelX', prefix);
  var textY = util.getPrefixedProperty(rscratch, 'labelY', prefix);
  var text = this.getLabelText(ele, prefix);

  if (text != null && text !== '' && !isNaN(textX) && !isNaN(textY)) {
    this.setupTextStyle(context, ele);

    var pdash = prefix ? prefix + '-' : '';
    var textW = util.getPrefixedProperty(rscratch, 'labelWidth', prefix);
    var textH = util.getPrefixedProperty(rscratch, 'labelHeight', prefix);
    var textAngle = util.getPrefixedProperty(rscratch, 'labelAngle', prefix);
    var marginX = ele.pstyle(pdash + 'text-margin-x').pfValue;
    var marginY = ele.pstyle(pdash + 'text-margin-y').pfValue;

    var isEdge = ele.isEdge();
    var isNode = ele.isNode();

    var halign = ele.pstyle('text-halign').value;
    var valign = ele.pstyle('text-valign').value;

    if (isEdge) {
      halign = 'center';
      valign = 'center';
    }

    textX += marginX;
    textY += marginY;

    var rotation = ele.pstyle('text-rotation');
    var theta;

    if (rotation.strValue === 'autorotate') {
      theta = isEdge ? textAngle : 0;
    } else if (rotation.strValue === 'none') {
      theta = 0;
    } else {
      theta = rotation.pfValue;
    }

    if (theta !== 0) {
      var orgTextX = textX;
      var orgTextY = textY;

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
        case 'right':
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
        if (styleShape == 'roundrectangle') {
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
      var lines = util.getPrefixedProperty(rscratch, 'labelWrapCachedLines', prefix);
      var lineHeight = textH / lines.length;

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

module.exports = CRp;

/***/ }),
/* 131 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/* global Path2D */

var is = __webpack_require__(0);

var CRp = {};

CRp.drawNode = function (context, node, shiftToOriginWithBb, drawLabel) {
  var r = this;
  var nodeWidth = void 0,
      nodeHeight = void 0;
  var _p = node._private;
  var rs = _p.rscratch;
  var pos = node.position();

  if (!is.number(pos.x) || !is.number(pos.y)) {
    return; // can't draw node with undefined position
  }

  if (!node.visible()) {
    return;
  }

  var parentOpacity = node.effectiveOpacity();

  var usePaths = r.usePaths();
  var path = void 0;
  var pathCacheHit = false;

  var padding = node.padding();

  nodeWidth = node.width() + 2 * padding;
  nodeHeight = node.height() + 2 * padding;

  //
  // setup shift

  var bb = void 0;
  if (shiftToOriginWithBb) {
    bb = shiftToOriginWithBb;

    context.translate(-bb.x1, -bb.y1);
  }

  //
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

      numImages++;

      // get image, and if not loaded then ask to redraw when later loaded
      image[i] = r.getCachedImage(url, bgImgCrossOrigin, function () {
        node.emitAndNotify('background');
      });
    }
  }

  //
  // setup styles

  var darkness = node.pstyle('background-blacken').value;
  var borderWidth = node.pstyle('border-width').pfValue;
  var bgColor = node.pstyle('background-color').value;
  var bgOpacity = node.pstyle('background-opacity').value * parentOpacity;
  var borderColor = node.pstyle('border-color').value;
  var borderStyle = node.pstyle('border-style').value;
  var borderOpacity = node.pstyle('border-opacity').value * parentOpacity;

  context.lineJoin = 'miter'; // so borders are square with the node shape

  var setupShapeColor = function setupShapeColor() {
    var bgOpy = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : bgOpacity;

    r.fillStyle(context, bgColor[0], bgColor[1], bgColor[2], bgOpy);
  };

  var setupBorderColor = function setupBorderColor() {
    var bdrOpy = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : borderOpacity;

    r.strokeStyle(context, borderColor[0], borderColor[1], borderColor[2], bdrOpy);
  };

  //
  // setup shape

  var styleShape = node.pstyle('shape').strValue;
  var shapePts = node.pstyle('shape-polygon-points').pfValue;

  if (usePaths) {
    var pathCacheKey = styleShape + '$' + nodeWidth + '$' + nodeHeight + (styleShape === 'polygon' ? '$' + shapePts.join('$') : '');

    context.translate(pos.x, pos.y);

    if (rs.pathCacheKey === pathCacheKey) {
      path = rs.pathCache;
      pathCacheHit = true;
    } else {
      path = new Path2D();
      rs.pathCacheKey = pathCacheKey;
      rs.pathCache = path;
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
    var nodeOpacity = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : parentOpacity;

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
    var pieOpacity = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : parentOpacity;

    if (r.hasPie(node)) {
      r.drawPie(context, node, pieOpacity);

      // redraw/restore path if steps after pie need it
      if (redrawShape) {

        if (!usePaths) {
          r.nodeShapes[r.getNodeShape(node)].draw(context, pos.x, pos.y, nodeWidth, nodeHeight);
        }
      }
    }
  };

  var darken = function darken() {
    var darkenOpacity = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : parentOpacity;

    var opacity = (darkness > 0 ? darkness : -darkness) * darkenOpacity;
    var c = darkness > 0 ? 0 : 255;

    if (darkness !== 0) {
      r.fillStyle(context, c, c, c, opacity);

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
      }

      // reset in case we changed the border style
      if (context.setLineDash) {
        // for very outofdate browsers
        context.setLineDash([]);
      }
    }
  };

  var drawOverlay = function drawOverlay() {
    var overlayPadding = node.pstyle('overlay-padding').pfValue;
    var overlayOpacity = node.pstyle('overlay-opacity').value;
    var overlayColor = node.pstyle('overlay-color').value;

    if (overlayOpacity > 0) {
      r.fillStyle(context, overlayColor[0], overlayColor[1], overlayColor[2], overlayOpacity);

      r.nodeShapes['roundrectangle'].draw(context, pos.x, pos.y, nodeWidth + overlayPadding * 2, nodeHeight + overlayPadding * 2);

      context.fill();
    }
  };

  var drawText = function drawText() {
    r.drawElementText(context, node, drawLabel);
  };

  var ghost = node.pstyle('ghost').value === 'yes';

  if (ghost) {
    var gx = node.pstyle('ghost-offset-x').pfValue;
    var gy = node.pstyle('ghost-offset-y').pfValue;
    var ghostOpacity = node.pstyle('ghost-opacity').value;
    var effGhostOpacity = ghostOpacity * parentOpacity;

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
  drawOverlay();

  //
  // clean up shift

  if (shiftToOriginWithBb) {
    context.translate(bb.x1, bb.y1);
  }
};

// does the node have at least one pie piece?
CRp.hasPie = function (node) {
  node = node[0]; // ensure ele ref

  return node._private.hasPie;
};

CRp.drawPie = function (context, node, nodeOpacity, pos) {
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
    var angleEnd = angleStart + angleDelta;

    // ignore if
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

    this.fillStyle(context, color[0], color[1], color[2], opacity);

    context.fill();

    lastPercent += percent;
  }
};

module.exports = CRp;

/***/ }),
/* 132 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var CRp = {};

var util = __webpack_require__(1);

var motionBlurDelay = 100;

// var isFirefox = typeof InstallTrigger !== 'undefined';

CRp.getPixelRatio = function () {
  var context = this.data.contexts[0];

  if (this.forcedPixelRatio != null) {
    return this.forcedPixelRatio;
  }

  var backingStore = context.backingStorePixelRatio || context.webkitBackingStorePixelRatio || context.mozBackingStorePixelRatio || context.msBackingStorePixelRatio || context.oBackingStorePixelRatio || context.backingStorePixelRatio || 1;

  return (window.devicePixelRatio || 1) / backingStore; // eslint-disable-line no-undef
};

CRp.paintCache = function (context) {
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

CRp.fillStyle = function (context, r, g, b, a) {
  context.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';

  // turn off for now, seems context does its own caching

  // var cache = this.paintCache(context);

  // var fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';

  // if( cache.fillStyle !== fillStyle ){
  //   context.fillStyle = cache.fillStyle = fillStyle;
  // }
};

CRp.strokeStyle = function (context, r, g, b, a) {
  context.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';

  // turn off for now, seems context does its own caching

  // var cache = this.paintCache(context);

  // var strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';

  // if( cache.strokeStyle !== strokeStyle ){
  //   context.strokeStyle = cache.strokeStyle = strokeStyle;
  // }
};

// Resize canvas
CRp.matchCanvasSize = function (container) {
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

CRp.renderTo = function (cxt, zoom, pan, pxRatio) {
  this.render({
    forcedContext: cxt,
    forcedZoom: zoom,
    forcedPan: pan,
    drawAllLayers: true,
    forcedPxRatio: pxRatio
  });
};

CRp.render = function (options) {
  options = options || util.staticEmptyObject();

  var forcedContext = options.forcedContext;
  var drawAllLayers = options.drawAllLayers;
  var drawOnlyNodeLayer = options.drawOnlyNodeLayer;
  var forcedZoom = options.forcedZoom;
  var forcedPan = options.forcedPan;
  var r = this;
  var pixelRatio = options.forcedPxRatio === undefined ? this.getPixelRatio() : options.forcedPxRatio;
  var cy = r.cy;var data = r.data;
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
    }

    // go to lower quality blurry frames when several m/b frames have been rendered (avoids flashing)
    if (r.mbFrames > r.minMbLowQualFrames) {
      //r.fullQualityMb = false;
      r.motionBlurPxRatio = r.mbPxRBlurry;
    }
  }

  if (r.clearingMotionBlur) {
    r.motionBlurPxRatio = 1;
  }

  // b/c drawToContext() may be async w.r.t. redraw(), keep track of last texture frame
  // because a rogue async texture frame would clear needDraw
  if (r.textureDrawLastFrame && !textureDraw) {
    needDraw[r.NODE] = true;
    needDraw[r.SELECT_BOX] = true;
  }

  var coreStyle = cy.style()._private.coreStyle;

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
  var viewportIsDiff = prevVp === undefined || vp.zoom !== prevVp.zoom || vp.pan.x !== prevVp.pan.x || vp.pan.y !== prevVp.pan.y;

  // we want the low quality motionblur only when the viewport is being manipulated etc (where it's not noticed)
  if (!viewportIsDiff && !(inNodeDragGesture && !hasCompoundNodes)) {
    r.motionBlurPxRatio = 1;
  }

  if (forcedPan) {
    effectivePan = forcedPan;
  }

  // apply pixel ratio

  effectiveZoom *= pixelRatio;
  effectivePan.x *= pixelRatio;
  effectivePan.y *= pixelRatio;

  var eles = r.getCachedZSortedEles();

  function mbclear(context, x, y, w, h) {
    var gco = context.globalCompositeOperation;

    context.globalCompositeOperation = 'destination-out';
    r.fillStyle(context, 255, 255, 255, r.motionBlurTransparency);
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

    var bb;

    if (!r.textureCache) {
      r.textureCache = {};

      bb = r.textureCache.bb = cy.mutableElements().boundingBox();

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
    bb = r.textureCache.bb;

    context.setTransform(1, 0, 0, 1, 0, 0);

    if (motionBlur) {
      mbclear(context, 0, 0, vp.width, vp.height);
    } else {
      context.clearRect(0, 0, vp.width, vp.height);
    }

    var outsideBgColor = coreStyle['outside-texture-bg-color'].value;
    var outsideBgOpacity = coreStyle['outside-texture-bg-opacity'].value;
    r.fillStyle(context, outsideBgColor[0], outsideBgColor[1], outsideBgColor[2], outsideBgOpacity);
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
  var vpManip = r.pinching || r.hoverData.dragging || r.swipePanning || r.data.wheelZooming || r.hoverData.draggingEles;
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
      var borderWidth = coreStyle['selection-box-border-width'].value / zoom;

      context.lineWidth = borderWidth;
      context.fillStyle = 'rgba(' + coreStyle['selection-box-color'].value[0] + ',' + coreStyle['selection-box-color'].value[1] + ',' + coreStyle['selection-box-color'].value[2] + ',' + coreStyle['selection-box-opacity'].value + ')';

      context.fillRect(r.selection[0], r.selection[1], r.selection[2] - r.selection[0], r.selection[3] - r.selection[1]);

      if (borderWidth > 0) {
        context.strokeStyle = 'rgba(' + coreStyle['selection-box-border-color'].value[0] + ',' + coreStyle['selection-box-border-color'].value[1] + ',' + coreStyle['selection-box-border-color'].value[2] + ',' + coreStyle['selection-box-opacity'].value + ')';

        context.strokeRect(r.selection[0], r.selection[1], r.selection[2] - r.selection[0], r.selection[3] - r.selection[1]);
      }
    }

    if (data.bgActivePosistion && !r.hoverData.selecting) {
      var zoom = r.cy.zoom();
      var pos = data.bgActivePosistion;

      context.fillStyle = 'rgba(' + coreStyle['active-bg-color'].value[0] + ',' + coreStyle['active-bg-color'].value[1] + ',' + coreStyle['active-bg-color'].value[2] + ',' + coreStyle['active-bg-opacity'].value + ')';

      context.beginPath();
      context.arc(pos.x, pos.y, coreStyle['active-bg-size'].pfValue / zoom, 0, 2 * Math.PI);
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
  }

  // motionblur: blit rendered blurry frames
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

module.exports = CRp;

/***/ }),
/* 133 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var math = __webpack_require__(2);

var CRp = {};

// @O Polygon drawing
CRp.drawPolygonPath = function (context, x, y, width, height, points) {

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

// Round rectangle drawing
CRp.drawRoundRectanglePath = function (context, x, y, width, height) {

  var halfWidth = width / 2;
  var halfHeight = height / 2;
  var cornerRadius = math.getRoundRectangleRadius(width, height);

  if (context.beginPath) {
    context.beginPath();
  }

  // Start at top middle
  context.moveTo(x, y - halfHeight);
  // Arc from middle top to right side
  context.arcTo(x + halfWidth, y - halfHeight, x + halfWidth, y, cornerRadius);
  // Arc from right side to bottom
  context.arcTo(x + halfWidth, y + halfHeight, x, y + halfHeight, cornerRadius);
  // Arc from bottom to left side
  context.arcTo(x - halfWidth, y + halfHeight, x - halfWidth, y, cornerRadius);
  // Arc from left side to topBorder
  context.arcTo(x - halfWidth, y - halfHeight, x, y - halfHeight, cornerRadius);
  // Join line
  context.lineTo(x, y - halfHeight);

  context.closePath();
};

CRp.drawBottomRoundRectanglePath = function (context, x, y, width, height) {

  var halfWidth = width / 2;
  var halfHeight = height / 2;
  var cornerRadius = math.getRoundRectangleRadius(width, height);

  if (context.beginPath) {
    context.beginPath();
  }

  // Start at top middle
  context.moveTo(x, y - halfHeight);
  context.lineTo(x + halfWidth, y - halfHeight);
  context.lineTo(x + halfWidth, y);

  context.arcTo(x + halfWidth, y + halfHeight, x, y + halfHeight, cornerRadius);
  context.arcTo(x - halfWidth, y + halfHeight, x - halfWidth, y, cornerRadius);

  context.lineTo(x - halfWidth, y - halfHeight);
  context.lineTo(x, y - halfHeight);

  context.closePath();
};

CRp.drawCutRectanglePath = function (context, x, y, width, height) {

  var halfWidth = width / 2;
  var halfHeight = height / 2;
  var cornerLength = math.getCutRectangleCornerLength();

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

CRp.drawBarrelPath = function (context, x, y, width, height) {

  var halfWidth = width / 2;
  var halfHeight = height / 2;

  var xBegin = x - halfWidth;
  var xEnd = x + halfWidth;
  var yBegin = y - halfHeight;
  var yEnd = y + halfHeight;

  var barrelCurveConstants = math.getBarrelCurveConstants(width, height);
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

CRp.drawEllipsePath = function (context, centerX, centerY, width, height) {
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

module.exports = CRp;

/***/ }),
/* 134 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);

var CRp = {};

CRp.createBuffer = function (w, h) {
  var buffer = document.createElement('canvas'); // eslint-disable-line no-undef
  buffer.width = w;
  buffer.height = h;

  return [buffer, buffer.getContext('2d')];
};

CRp.bufferCanvasImage = function (options) {
  var cy = this.cy;
  var eles = cy.mutableElements();
  var bb = eles.boundingBox();
  var ctrRect = this.findContainerClientCoords();
  var width = options.full ? Math.ceil(bb.w) : ctrRect[2];
  var height = options.full ? Math.ceil(bb.h) : ctrRect[3];
  var specdMaxDims = is.number(options.maxWidth) || is.number(options.maxHeight);
  var pxRatio = this.getPixelRatio();
  var scale = 1;

  if (options.scale !== undefined) {
    width *= options.scale;
    height *= options.scale;

    scale = options.scale;
  } else if (specdMaxDims) {
    var maxScaleW = Infinity;
    var maxScaleH = Infinity;

    if (is.number(options.maxWidth)) {
      maxScaleW = scale * options.maxWidth / width;
    }

    if (is.number(options.maxHeight)) {
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

  var buffCxt = buffCanvas.getContext('2d');

  // Rasterize the layers, but only if container has nonzero size
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
    }

    // need to fill bg at end like this in order to fill cleared transparent pixels in jpgs
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

  return new Blob([buff], { type: mimeType });
}

function b64UriToB64(b64uri) {
  var i = b64uri.indexOf(',');

  return b64uri.substr(i + 1);
};

function output(options, canvas, mimeType) {
  var b64Uri = canvas.toDataURL(mimeType, options.quality);

  switch (options.output) {
    case 'blob':
      return b64ToBlob(b64UriToB64(b64Uri), mimeType);

    case 'base64':
      return b64UriToB64(b64Uri);

    case 'base64uri':
    default:
      return b64Uri;
  }
}

CRp.png = function (options) {
  return output(options, this.bufferCanvasImage(options), 'image/png');
};

CRp.jpg = function (options) {
  return output(options, this.bufferCanvasImage(options), 'image/jpeg');
};

module.exports = CRp;

/***/ }),
/* 135 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var CRp = {};

CRp.nodeShapeImpl = function (name, context, centerX, centerY, width, height, points) {
  switch (name) {
    case 'ellipse':
      return this.drawEllipsePath(context, centerX, centerY, width, height);
    case 'polygon':
      return this.drawPolygonPath(context, centerX, centerY, width, height, points);
    case 'roundrectangle':
      return this.drawRoundRectanglePath(context, centerX, centerY, width, height);
    case 'cutrectangle':
      return this.drawCutRectanglePath(context, centerX, centerY, width, height);
    case 'bottomroundrectangle':
      return this.drawBottomRoundRectanglePath(context, centerX, centerY, width, height);
    case 'barrel':
      return this.drawBarrelPath(context, centerX, centerY, width, height);
  }
};

module.exports = CRp;

/***/ }),
/* 136 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var is = __webpack_require__(0);
var util = __webpack_require__(1);
var Style = __webpack_require__(18);

// a dummy stylesheet object that doesn't need a reference to the core
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
};

// just store the selector to be parsed later
sheetfn.selector = function (selector) {
  var i = this.length++;

  this[i] = {
    selector: selector,
    properties: []
  };

  return this; // chaining
};

// just store the property to be parsed later
sheetfn.css = function (name, value) {
  var i = this.length - 1;

  if (is.string(name)) {
    this[i].properties.push({
      name: name,
      value: value
    });
  } else if (is.plainObject(name)) {
    var map = name;

    for (var j = 0; j < Style.properties.length; j++) {
      var prop = Style.properties[j];
      var mapVal = map[prop.name];

      if (mapVal === undefined) {
        // also try camel case name
        mapVal = map[util.dash2camel(prop.name)];
      }

      if (mapVal !== undefined) {
        var _name = prop.name;
        var _value = mapVal;

        this[i].properties.push({
          name: _name,
          value: _value
        });
      }
    }
  }

  return this; // chaining
};

sheetfn.style = sheetfn.css;

// generate a real style object from the dummy stylesheet
sheetfn.generateStyle = function (cy) {
  var style = new Style(cy);

  return this.appendToStyle(style);
};

// append a dummy stylesheet object on a real style object
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

module.exports = Stylesheet;

/***/ }),
/* 137 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = "3.2.12";

/***/ })
/******/ ]);
});