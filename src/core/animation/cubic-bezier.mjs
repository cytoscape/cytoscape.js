/*! Bezier curve function generator. Copyright 2014-2026 Gaetan Renaudeau. MIT License: http://en.wikipedia.org/wiki/MIT_License
 * https://github.com/gre/bezier-easing */

// Fallback for environments without Math.cbrt
let cbrt = Math.cbrt || function(x) {
  return x < 0 ? -Math.pow(-x, 1 / 3) : Math.pow(x, 1 / 3);
};

// Solves x(t) = ((2a * t + 3b) * t + 3c) * t = x for t, with x in (0, 1):
// u = 1/t is the largest real root of x*u^3 - 3c*u^2 - 3b*u - 2a = 0
function solveTForX(x, a, b, c) {
  let j = 1 / Math.max(c, Math.sqrt(x)),
    k = x * j,
    l = k * j,
    s = c * j,
    q = b * l,
    m = s * s + q,
    h = -s * (s * s + 1.5 * q) - a * k * l,
    D = h * h - m * m * m,
    v;

  if (m === 0 || D > 1e-12 * h * h) {
    // one real root (Cardano)
    let U = -cbrt(h < 0 ? h - Math.sqrt(D) : h + Math.sqrt(D));

    v = (U + m / U) || 0;
  } else {
    // three real roots, take the largest
    let r = Math.sqrt(m);

    v = 2 * r * Math.cos(Math.acos(Math.max(-1, Math.min(1, -h / (m * r)))) / 3);
  }

  return Math.min(1, k / (v + s));
}

function generateCubicBezier(mX1, mY1, mX2, mY2) {
  /* Must contain four arguments. */
  if (arguments.length !== 4) {
    return false;
  }

  /* Arguments must be numbers. */
  for (let i = 0; i < 4; ++i) {
    if (typeof arguments[i] !== "number" || isNaN(arguments[i]) || !isFinite(arguments[i])) {
      return false;
    }
  }

  /* X values must be in the [0, 1] range. */
  mX1 = Math.min(mX1, 1);
  mX2 = Math.min(mX2, 1);
  mX1 = Math.max(mX1, 0);
  mX2 = Math.max(mX2, 0);

  // x(t) = ((2a * t + 3b) * t + 3c) * t, y(t) = ((ay * t + by) * t + cy) * t
  let isLinear = mX1 === mY1 && mX2 === mY2,
    a = (3 * mX1 - 3 * mX2 + 1) / 2,
    b = mX2 - 2 * mX1,
    c = mX1,
    ay = 3 * mY1 - 3 * mY2 + 1,
    by = 3 * (mY2 - 2 * mY1),
    cy = 3 * mY1;

  let f = function(aX) {
    if (isLinear) {
      return aX;
    }
    // aX outside (0, 1) saturates to 0 / 1
    if (aX <= 0) {
      return 0;
    }
    if (aX >= 1) {
      return 1;
    }

    let t = solveTForX(aX, a, b, c);

    return ((ay * t + by) * t + cy) * t;
  };

  f.getControlPoints = function() {
    return [{
      x: mX1,
      y: mY1
    }, {
      x: mX2,
      y: mY2
    }];
  };

  let str = "generateBezier(" + [mX1, mY1, mX2, mY2] + ")";
  f.toString = function() {
    return str;
  };

  return f;
}

export default generateCubicBezier;
