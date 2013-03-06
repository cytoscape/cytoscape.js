;(function($$){

	/**
	 * Utility methods for working with arrays.
	 * 
	 * This prototype is based on Flare's flare.util.Arrays
	 */

	var EMPTY = new Array(0);

	Arrays = function() {
	}

	/**
	 * Returns the maximum value in an array. Comparison is determined
	 * using the greater-than operator against arbitrary types.
	 * @param a the array
	 * @param p an optional property from which to extract the value.
	 *  If this is null, the immediate contents of the array are compared.
	 * @return the maximum value
	 */
	Arrays.prototype.max = function(a, p)
	{
		var x = Number.MIN_VALUE;
		if (p) {
			var v;
			for (var i=0; i<a.length; ++i) {
				v = p.getValue(a[i]);
				if (v > x) x = v;
			}
		} else {
			for (i=0; i<a.length; ++i) {
				if (a[i] > x) x = a[i];
			}
		}
		return x;
	}

	/**
	 * Returns the index of a maximum value in an array. Comparison is
	 * determined using the greater-than operator against arbitrary types.
	 * @param a the array
	 * @param p an optional property from which to extract the value.
	 *  If this is null, the immediate contents of the array are compared.
	 * @return the index of a maximum value
	 */
	Arrays.prototype.maxIndex = function(a, p)
	{
		var x = Number.MIN_VALUE;
		var idx = -1;

		if (p) {
			var v;
			for (var i=0; i<a.length; ++i) {
				v = p.getValue(a[i]);
				if (v > x) { x = v; idx = i; }
			}
		} else {
			for (i=0; i<a.length; ++i) {
				if (a[i] > x) { x = a[i]; idx = i; }
			}
		}
		return idx;
	}

	/**
	 * Returns the minimum value in an array. Comparison is determined
	 * using the less-than operator against arbitrary types.
	 * @param a the array
	 * @param p an optional property from which to extract the value.
	 *  If this is null, the immediate contents of the array are compared.
	 * @return the minimum value
	 */
	Arrays.prototype.min = function(a, p)
	{
		var x = Number.MAX_VALUE;
		if (p) {
			var v;
			for (var i=0; i<a.length; ++i) {
				v = p.getValue(a[i]);
				if (v < x) x = v;
			}
		} else {
			for (i=0; i<a.length; ++i) {
				if (a[i] < x) x = a[i];
			}
		}
		return x;
	}

	/**
	 * Returns the index of a minimum value in an array. Comparison is
	 * determined using the less-than operator against arbitrary types.
	 * @param a the array
	 * @param p an optional property from which to extract the value.
	 *  If this is null, the immediate contents of the array are compared.
	 * @return the index of a minimum value
	 */
	Arrays.prototype.minIndex = function(a, p)
	{
		var x = Number.MAX_VALUE, idx = -1;
		if (p) {
			var v;
			for (var i=0; i<a.length; ++i) {
				v = p.getValue(a[i]);
				if (v < x) { x = v; idx = i; }
			}
		} else {
			for (i=0; i<a.length; ++i) {
				if (a[i] < x) { x = a[i]; idx = i; }
			}
		}
		return idx;
	}

	/**
	 * Fills an array with a given value.
	 * @param a the array
	 * @param o the value with which to fill the array
	 */
	Arrays.prototype.fill = function(a, o)
	{
		for (var i = 0; i<a.length; ++i) {
			a[i] = o;
		}
	}

	/**
	 * Makes a copy of an array or copies the contents of one array to
	 * another.
	 * @param a the array to copy
	 * @param b the array to copy values to. If null, a new array is
	 *  created.
	 * @param a0 the starting index from which to copy values
	 *  of the input array
	 * @param b0 the starting index at which to write value into the
	 *  output array
	 * @param len the number of values to copy
	 * @return the target array containing the copied values
	 */
	Arrays.prototype.copy = function(a, b, a0, b0, len) {
		len = (len < 0 ? a.length : len);
		if (b==null) {
			b = new Array(b0+len);
		} else {
			while (b.length < b0+len) b.push(null);
		}

		for (var i = 0; i<len; ++i) {
			b[b0+i] = a[a0+i];
		}
		return b;
	}

	/**
	 * Clears an array instance, removing all values.
	 * @param a the array to clear
	 */
	Arrays.prototype.clear = function(a)
	{
		while (a.length > 0) a.pop();
	}

	/**
	 * Removes an element from an array. Only the first instance of the
	 * value is removed.
	 * @param a the array
	 * @param o the value to remove
	 * @return the index location at which the removed element was found,
	 * negative if the value was not found.
	 */
	Arrays.prototype.remove = function(a, o) {
		var idx = a.indexOf(o);
		if (idx == a.length-1) {
			a.pop();
		} else if (idx >= 0) {
			a.splice(idx, 1);
		}
		return idx;
	}

	/**
	 * Removes the array element at the given index.
	 * @param a the array
	 * @param idx the index at which to remove an element
	 * @return the removed element
	 */
	Arrays.prototype.removeAt = function(a, idx) {
		if (idx == a.length-1) {
			return a.pop();
		} else {
			var x = a[idx];
			a.splice(idx,1);
			return x;
		}
	}

	/**
	 * Performs a binary search over the input array for the given key
	 * value, optionally using a provided property to extract from array
	 * items and a custom comparison function.
	 * @param a the array to search over
	 * @param key the key value to search for
	 * @param prop the property to retrieve from objecs in the array. If null
	 *  (the default) the array values will be used directly.
	 * @param cmp an optional comparison function
	 * @return the index of the given key if it exists in the array,
     *  otherwise -1 times the index value at the insertion point that
     *  would be used if the key were added to the array.
     */
	Arrays.prototype.binarySearch = function(a, key,
		prop, cmp)
	{
		var p = prop ? Property.$(prop) : null;
		if (cmp == null)
			cmp = function(a,b) {return a>b ? 1 : a<b ? -1 : 0;}

		var x1 = 0, x2 = a.length, i = (x2>>1);
    	while (x1 < x2) {
    		var c = cmp(p ? p.getValue(a[i]) : a[i], key);
    		if (c == 0) {
            	return i;
        	} else if (c < 0) {
            	x1 = i + 1;
        	} else {
            	x2 = i;
        	}
        	i = x1 + ((x2 - x1)>>1);
    	}
    	return -1*(i+1);
	}

})(cytoscape);
