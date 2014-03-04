;
(function ($$) {
    "use strict";

    /*  Min and Max heap predefaults */
    
    $$.Minheap = function (cy, eles, valueFn) {
        return new $$.Heap(cy, eles, $$.Heap.minHeapComparator, valueFn);
    };

    $$.Maxheap = function (cy, eles, valueFn) {
        return new $$.Heap(cy, eles, $$.Heap.maxHeapComparator, valueFn);
    };
    
    $$.Heap = function (cy, eles, comparator, valueFn) {
        if (typeof comparator === "undefined" || typeof eles === "undefined") {
            return;
        }
        if (typeof valueFn === "undefined") {
            valueFn = $$.Heap.idFn;
        }
        var sourceHeap = [],
            pointers = {},
            elements = [],
            i = 0,
            id,
            heap,
            elesLen;

        eles = this.getArgumentAsCollection(eles, cy);
        elesLen = eles.length;

        for (i = 0; i < elesLen; i += 1) {
            sourceHeap.push(valueFn.call(cy, eles[i], i, eles));
            id = eles[i].id();
            if (pointers.hasOwnProperty(id)) {
                throw "ERROR: Multiple items with the same id found: " + id;
            }
            pointers[id] = i;
            elements.push(id);
        }
        this._p = {
            cy: cy,
            heap: sourceHeap,
            pointers: pointers,
            elements: elements,
            comparator: comparator,
            extractor: valueFn,
            length: elesLen
        };
        for (i = Math.floor(elesLen / 2); i >= 0; i -= 1) {
            heap = this.heapify(i);
        }
        return heap;
    };

    /* static methods */
    $$.Heap.idFn = function (node) {
        return node.id();
    };

    $$.Heap.minHeapComparator = function (a, b) {
        return a >= b;
    };

    $$.Heap.maxHeapComparator = function (a, b) {
        return a <= b;
    };

    /* object methods */
    $$.Heap.prototype.size = function () {
        return this._p.length;
    };

    $$.Heap.prototype.getArgumentAsCollection = function (eles, cy) {
        var result;
        if(typeof cy === "undefined") {
            cy = this._p.cy;
        }
        if ($$.is.elementOrCollection(eles)) {
            result = eles;
        } else {
            var resultArray = [],
                sourceEles = [].concat.apply([], [eles]);

            for (var i = 0; i < sourceEles.length; i++) {
                var id = sourceEles[i],
                    ele = cy.getElementById(id);
                if(ele.length > 0) {
                    resultArray.push(ele);
                }
            }
            result = new $$.Collection(cy, resultArray);
        }
        return result;
    };

    $$.Heap.prototype.isHeap = function () {
        var array = this._p.heap,
            arrlen = array.length,
            i,
            left,
            right,
            lCheck,
            rCheck,
            comparator = this._p.comparator;
        for (i = 0; i < arrlen; i += 1) {
            left = 2 * i + 1;
            right = left + 1;
            lCheck = left < arrlen ? comparator(array[left], array[i]) : true;
            rCheck = right < arrlen ? comparator(array[right], array[i]) : true;
            if (!lCheck || !rCheck) {
                return false;
            }
        }
        return true;
    };

    $$.Heap.prototype.heapSwap = function (i, j) {
        var heap = this._p.heap,
            pointers = this._p.pointers,
            elements = this._p.elements,
            swapValue = heap[i],
            swapElems = elements[i],
            idI = elements[i],
            idJ = elements[j];

        heap[i] = heap[j];
        elements[i] = elements[j];

        pointers[idI] = j;
        pointers[idJ] = i;

        heap[j] = swapValue;
        elements[j] = swapElems;
    };

    $$.Heap.prototype.heapify = function (i, rootToLeaf) {
        var treeLen = 0,
            condHeap = false,
            array,
            pointers,
            current,
            left,
            right,
            best,
            tmp,
            comparator,
            parent;
        if (typeof rootToLeaf === "undefined") {
            rootToLeaf = true;
        }
        array = this._p.heap;
        treeLen = array.length;
        comparator = this._p.comparator;
        current = i;
        while (!condHeap) {
            if (rootToLeaf) {
                left = 2 * current + 1;
                right = left + 1;
                best = current;
                if (left < treeLen && !comparator(array[left], array[best])) {
                    best = left;
                }
                if (right < treeLen && !comparator(array[right], array[best])) {
                    best = right;
                }
                condHeap = best === current;
                if (!condHeap) {
                    this.heapSwap(best, current);
                    current = best;
                }
            } else {
                parent = Math.floor((current - 1) / 2);
                best = current;
                condHeap = parent < 0 || comparator(array[best], array[parent]);
                if (!condHeap) {
                    this.heapSwap(best, parent);
                    current = parent;
                }
            }
        }
    };

    /* collectionOrElement */
    $$.Heap.prototype.insert = function (eles) {
        var elements = this.getArgumentAsCollection(eles),
            elsize = elements.length,
            element,
            elindex,
            elvalue,
            elid,
            i;
        for (i = 0; i < elsize; i += 1) {
            element = elements[i];
            elindex = this._p.heap.length;
            elvalue = this._p.extractor(element);
            elid = element.id();
            if (this._p.pointers.hasOwnProperty(elid)) {
                throw "ERROR: Multiple items with the same id found: " + elid;
            }
            this._p.heap.push(elvalue);
            this._p.elements.push(elid);
            this._p.pointers[elid] = elindex;
            this.heapify(elindex, false);
        }
        this._p.length = this._p.heap.length;
    };

    $$.Heap.prototype.getValueById = function (elementId) {
        if (this._p.pointers.hasOwnProperty(elementId)) {
            var elementIndex = this._p.pointers[elementId];
            return this._p.heap[elementIndex];
        }
    };
    
    $$.Heap.prototype.contains = function (eles) {
        var elements = this.getArgumentAsCollection(eles);
        for (var i = 0; i < elements.length; i += 1) {
            var elementId = elements[i].id();
            if(!this._p.pointers.hasOwnProperty(elementId)) {
                return false;
            }
        }
        return true;
    };
    
    $$.Heap.prototype.top = function () {
        if (this._p.length > 0) {
            return {
                value: this._p.heap[0],
                id: this._p.elements[0]
            };
        }
    };

    $$.Heap.prototype.pop = function () {
        if (this._p.length > 0) {
            var top = this.top(),
                lastIndex = this._p.length - 1,
                removeCandidate,
                removeValue,
                remId;
            this.heapSwap(0, lastIndex);

            removeCandidate = this._p.elements[lastIndex];
            removeValue = this._p.heap[lastIndex];
            remId = removeCandidate;

            this._p.heap.pop();
            this._p.elements.pop();
            this._p.length = this._p.heap.length;
            delete this._p.pointers[remId];

            this.heapify(0);
            return top;
        }
    };

    $$.Heap.prototype.findDirectionHeapify = function (index) {
        var parent = Math.floor((index - 1) / 2),
            array = this._p.heap,
            condHeap = parent < 0 || this._p.comparator(array[index], array[parent]);
        this.heapify(index, condHeap);
    };

    /* edit is a new value or function */
    // only values in heap are updated. elements themselves are not!
    $$.Heap.prototype.edit = function (eles, edit) {
        var elements = this.getArgumentAsCollection(eles);
        for (var i = 0; i < elements.length; i += 1) {
            var elementId = elements[i].id(),
                elementIndex = this._p.pointers[elementId],
                elementValue = this._p.heap[elementIndex];
            if ($$.is.number(edit)) {
                this._p.heap[elementIndex] = edit;
            } else if ($$.is.fn(edit)) {
                this._p.heap[elementIndex] = edit.call(this._p.cy, elementValue, elementIndex);
            }
            this.findDirectionHeapify(elementIndex);
        }
    };

    $$.Heap.prototype.delete = function (eles) {
        var elements = this.getArgumentAsCollection(eles);
        for (var i = 0; i < elements.length; i += 1) {
            var elementId = elements[i].id(),
                elementIndex = this._p.pointers[elementId],
                lastIndex = this._p.length - 1,
                removeCandidate,
                removeValue,
                remId;
            if (elementIndex !== lastIndex) {
                this.heapSwap(elementIndex, lastIndex);
            }

            removeCandidate = this._p.elements[lastIndex];
            removeValue = this._p.heap[lastIndex];
            remId = removeCandidate;

            this._p.heap.pop();
            this._p.elements.pop();
            this._p.length = this._p.heap.length;
            delete this._p.pointers[remId];

            this.findDirectionHeapify(elementIndex);
        }
        return removeValue;
    };

})(cytoscape);