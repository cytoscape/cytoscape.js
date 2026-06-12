/* global Float32Array */

/** A cubic-bezier easing function with debug helpers attached. */
export interface BezierEasingFn {
  ( aX: number ): number;
  getControlPoints(): { x: number; y: number }[];
  toString(): string;
}

/*! Bezier curve function generator. Copyright Gaetan Renaudeau. MIT License: http://en.wikipedia.org/wiki/MIT_License */
function generateCubicBezier(mX1: number, mY1: number, mX2: number, mY2: number): BezierEasingFn | false {
  let NEWTON_ITERATIONS = 4,
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
  for (let i = 0; i < 4; ++i) {
    // eslint-disable-next-line prefer-rest-params -- preserve runtime numeric validation exactly
    if (typeof arguments[i] !== "number" || isNaN(arguments[i]) || !isFinite(arguments[i])) {
      return false;
    }
  }

  /* X values must be in the [0, 1] range. */
  mX1 = Math.min(mX1, 1);
  mX2 = Math.min(mX2, 1);
  mX1 = Math.max(mX1, 0);
  mX2 = Math.max(mX2, 0);

  let mSampleValues = float32ArraySupported ? new Float32Array(kSplineTableSize) : new Array(kSplineTableSize);

  function A(aA1: number, aA2: number) {
    return 1.0 - 3.0 * aA2 + 3.0 * aA1;
  }

  function B(aA1: number, aA2: number) {
    return 3.0 * aA2 - 6.0 * aA1;
  }

  function C(aA1: number) {
    return 3.0 * aA1;
  }

  function calcBezier(aT: number, aA1: number, aA2: number) {
    return ((A(aA1, aA2) * aT + B(aA1, aA2)) * aT + C(aA1)) * aT;
  }

  function getSlope(aT: number, aA1: number, aA2: number) {
    return 3.0 * A(aA1, aA2) * aT * aT + 2.0 * B(aA1, aA2) * aT + C(aA1);
  }

  function newtonRaphsonIterate(aX: number, aGuessT: number) {
    for (let i = 0; i < NEWTON_ITERATIONS; ++i) {
      let currentSlope = getSlope(aGuessT, mX1, mX2);

      if (currentSlope === 0.0) {
        return aGuessT;
      }

      let currentX = calcBezier(aGuessT, mX1, mX2) - aX;
      aGuessT -= currentX / currentSlope;
    }

    return aGuessT;
  }

  function calcSampleValues() {
    for (let i = 0; i < kSplineTableSize; ++i) {
      mSampleValues[i] = calcBezier(i * kSampleStepSize, mX1, mX2);
    }
  }

  function binarySubdivide(aX: number, aA: number, aB: number) {
    let currentX, currentT, i = 0;

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

  function getTForX(aX: number) {
    let intervalStart = 0.0,
      currentSample = 1,
      lastSample = kSplineTableSize - 1;

    for (; currentSample !== lastSample && mSampleValues[currentSample] <= aX; ++currentSample) {
      intervalStart += kSampleStepSize;
    }

    --currentSample;

    let dist = (aX - mSampleValues[currentSample]) / (mSampleValues[currentSample + 1] - mSampleValues[currentSample]),
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

  let _precomputed = false;

  function precompute() {
    _precomputed = true;
    if (mX1 !== mY1 || mX2 !== mY2) {
      calcSampleValues();
    }
  }

  let f = function(aX: number) {
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

  // attach debug helpers onto the bare easing function
  let bezierFn = f as BezierEasingFn;

  bezierFn.getControlPoints = function() {
    return [{
      x: mX1,
      y: mY1
    }, {
      x: mX2,
      y: mY2
    }];
  };

  let str = "generateBezier(" + [mX1, mY1, mX2, mY2] + ")";
  bezierFn.toString = function() {
    return str;
  };

  return bezierFn;
}

export default generateCubicBezier;
