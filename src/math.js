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
