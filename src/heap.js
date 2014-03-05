;
(function ($$) {
    "use strict";

    $$.heapUtil = {
        minHeapComparator: function (a, b) {
            return a >= b;
        },
        identity: function (a) {
            return a;
        }
    };

    $$.Heap = function (eles, comparator, vextractor, idgen) {
        if (typeof comparator === "undefined" || typeof eles === "undefined") {
            return;
        }
        if (typeof vextractor === "undefined") {
            vextractor = $$.heapUtil.identity;
        }
        if (typeof idgen === "undefined") {
            idgen = $$.heapUtil.identity;
        }
        var elesLen = eles.length,
            sourceHeap = [],
            pointers = {},
            i = 0,
            id,
            heap;
        for (i = 0; i < elesLen; i += 1) {
            sourceHeap.push(vextractor(eles[i], i, eles));
            id = idgen(eles[i]);
            if (pointers.hasOwnProperty(id)) {
                throw "ERROR: Multiple items with the same id found: " + id;
            }
            pointers[id] = i;
        }
        this._p = {
            heap: sourceHeap,
            pointers: pointers,
            elements: eles,
            comparator: comparator,
            extractor: vextractor,
            idgen: idgen,
            length: elesLen
        };
        for (i = Math.floor(elesLen / 2); i >= 0; i -= 1) {
            heap = this.heapify(i);
        }
        return heap;
    };

    $$.Heap.prototype.size = function () {
        return this._p.length;
    }

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
            idI = this._p.idgen(elements[i]),
            idJ = this._p.idgen(elements[j]);

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

    /* eles can be either a single item or an array */
    $$.Heap.prototype.insert = function (eles) {
        var elements = [].concat.apply([], [eles]),
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
            elid = this._p.idgen(element);
            this._p.heap.push(elvalue);
            this._p.elements.push(element);
            if (this._p.pointers.hasOwnProperty(elid)) {
                throw "ERROR: Multiple items with the same id found: " + elid;
            }
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

    $$.Heap.prototype.getElementById = function (elementId) {
        if (this._p.pointers.hasOwnProperty(elementId)) {
            var elementIndex = this._p.pointers[elementId];
            return this._p.elements[elementIndex];
        }
    };

    $$.Heap.prototype.top = function () {
        if (this._p.length > 0) {
            return {
                value: this._p.heap[0],
                id: this._p.idgen(this._p.elements[0])
            };
        }
    };

    $$.Heap.prototype.pop = function () {
        if (this._p.length > 0) {
            var lastIndex = this._p.length - 1,
                removeCandidate,
                removeValue,
                remId;
            this.heapSwap(0, lastIndex);

            removeCandidate = this._p.elements[lastIndex];
            removeValue = this._p.heap[lastIndex];
            remId = this._p.idgen(removeCandidate);

            this._p.heap.pop();
            this._p.elements.pop();
            this._p.length = this._p.heap.length;
            delete this._p.pointers[remId];

            this.heapify(0);
            return removeValue;
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
    $$.Heap.prototype.edit = function (elementId, edit) {
        if (this._p.pointers.hasOwnProperty(elementId)) {
            var elementIndex = this._p.pointers[elementId],
                elementRaw = this._p.elements[elementIndex],
                elementValue = this._p.heap[elementIndex];
            if ($$.is.number(edit)) {
                this._p.heap[elementIndex] = edit;
            } else if ($$.is.fn(edit)) {
                this._p.heap[elementIndex] = edit.call({}, elementValue, elementRaw);
            }
            this.findDirectionHeapify(elementIndex);
        }
    };

    $$.Heap.prototype.delete = function (elementId) {
        if (this._p.pointers.hasOwnProperty(elementId)) {
            var elementIndex = this._p.pointers[elementId],
                elementRaw = this._p.elements[elementIndex],
                elementValue = this._p.heap[elementIndex],
                lastIndex = this._p.length - 1,
                removeCandidate,
                removeValue,
                remId;
            if (elementIndex !== lastIndex) {
                this.heapSwap(elementIndex, lastIndex);
            }

            removeCandidate = this._p.elements[lastIndex];
            removeValue = this._p.heap[lastIndex];
            remId = this._p.idgen(removeCandidate);

            this._p.heap.pop();
            this._p.elements.pop();
            this._p.length = this._p.heap.length;
            delete this._p.pointers[remId];

            this.findDirectionHeapify(elementIndex);
            return removeValue;
        }
    };

})(cytoscape);