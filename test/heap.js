var expect = require('chai').expect;
var cytoscape = require('../build/cytoscape.js', cytoscape);

describe('Heap', function () {

    var cy, d1, d2, d3, d1_i = [];

    // test setup
    beforeEach(function (done) {
        cytoscape({
            elements: {
                nodes: [
                    {
                        data: {
                            id: 'n1'
                        }
                    },
                    {
                        data: {
                            id: 'n2'
                        }
                    },
                    {
                        data: {
                            id: 'n3'
                        }
                    }
        ],

                edges: [
                    {
                        data: {
                            id: 'n1n2',
                            source: 'n1',
                            target: 'n2'
                        }
                    },
                    {
                        data: {
                            id: 'n2n3',
                            source: 'n2',
                            target: 'n3'
                        }
                    }
        ]
            },
            ready: function () {
                cy = this;

                var arr = [],
                    rnd = Math.ceil(Math.random() * 10000),
                    usedvars = {};

                while (arr.length < 1000) {
                    while (usedvars.hasOwnProperty(rnd)) {
                        rnd = Math.ceil(Math.random() * 10000);
                    }
                    arr.push(rnd);
                    usedvars[rnd] = 1;
                }
                d1_i = [];
                for (var j = 0; j < 20; j += 1) {
                    while (usedvars.hasOwnProperty(rnd)) {
                        rnd = Math.ceil(Math.random() * 10000) + 1;
                    }
                    d1_i.push(rnd);
                    usedvars[rnd] = 1;
                }
                d1 = new cytoscape.Heap(arr, cytoscape.heapUtil.minHeapComparator);
                d2 = new cytoscape.Heap([7, 3, 2, 4, 5, 9, 1, 10, 6, 8], cytoscape.heapUtil.minHeapComparator);
                d3 = new cytoscape.Heap([7, 3, 2, 4, 5, 9, 1, 10, 6, 8], cytoscape.heapUtil.minHeapComparator);

                done();
            }
        });
    });

    it('heap construction', function () {
        expect(d1.isHeap()).to.be.true;
        expect(d2.isHeap()).to.be.true;
        expect(d3.isHeap()).to.be.true;
    });

    it('heap instertion', function () {
        for (var i = 0; i < d1_i.length; i++) {
            d1.insert(d1_i[i]);
        }
        expect(d1.isHeap()).to.be.true;
    });

    it('heap getting top element', function () {
        var elem = d1.top().value,
            sorted = d1._p.heap.sort(function elemSort(a, b) {
                return a - b;
            })[0],
            len = d1._p.length;
        expect(elem === sorted).to.be.true;
        expect(d1._p.length === d1._p.heap.length && d1._p.length === d1._p.elements.length && d1._p.length === Object.keys(d1._p.pointers).length).to.be.true;

        elem = d1.pop();
        expect(elem === sorted).to.be.true;
        expect(d1.isHeap()).to.be.true;
        expect(d1._p.length === len - 1).to.be.true;
        expect(d1._p.length === d1._p.heap.length && d1._p.length === d1._p.elements.length && d1._p.length === Object.keys(d1._p.pointers).length).to.be.true;
    });

    it('heap ordering', function () {
        var prev = -1
        while (d1.size()) {
            var next = d1.pop();
            expect(prev <= next).to.be.true;
            prev = next;
        }
        d1.pop();

        while (d2.size()) {
            expect(d2.pop() === 10 - d2.size()).to.be.true;
        }

    });

    it('heap get elements', function () {
        expect(d2.getElementById(6) === 6).to.be.true;
        expect(d2.getValueById(4) === 4).to.be.true;
    });

    it('heap edit elements', function () {
        d3.edit(3, 11);
        expect(d3.isHeap()).to.be.true;
        d3.edit(8, function () {
            return 3;
        });
        expect(d3.isHeap()).to.be.true;
    });

    it('heap remove elements', function () {
        d3.delete(2);
        expect(d3.isHeap()).to.be.true;
        expect(d3.size() == 9).to.be.true;

        d3.delete(5);
        expect(d3.isHeap()).to.be.true;
        expect(d3.size() == 8).to.be.true;
    });

});