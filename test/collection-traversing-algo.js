var expect = require('chai').expect;
var cytoscape = require('../build/cytoscape.js', cytoscape);

describe('Collection algorithms', function () {

    var cy, n1, n2, n3, n4, n5, n6,
        wFunction = function () {
            var dist = {
                'n1n2': 7,
                'n1n3': 9,
                'n1n6': 14,
                'n3n4': 11,
                'n6n3': 2,
                'n2n4': 15,
                'n2n3': 10,
                'n6n5': 9,
                'n3n4': 11,
                'n4n5': 6
            };
            return dist[this.id()] || 1;
        }

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
                    },
                    {
                        data: {
                            id: 'n4'
                        }
                    },
                    {
                        data: {
                            id: 'n5'
                        }
                    },
                    {
                        data: {
                            id: 'n6'
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
                            id: 'n1n3',
                            source: 'n1',
                            target: 'n3'
                        }
                    },
                    {
                        data: {
                            id: 'n1n6',
                            source: 'n1',
                            target: 'n6'
                        }
                    },
                    {
                        data: {
                            id: 'n3n4',
                            source: 'n3',
                            target: 'n4'
                        }
                    }, {
                        data: {
                            id: 'n6n3',
                            source: 'n6',
                            target: 'n3'
                        }
                    },
                    {
                        data: {
                            id: 'n2n4',
                            source: 'n2',
                            target: 'n4'
                        }
                    },
                    {
                        data: {
                            id: 'n6n5',
                            source: 'n6',
                            target: 'n5'
                        }
                    },
                    {
                        data: {
                            id: 'n4n5',
                            source: 'n4',
                            target: 'n5'
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
                n1 = cy.$('#n1');
                n2 = cy.$('#n2');
                n3 = cy.$('#n3');
                n4 = cy.$('#n4');
                n5 = cy.$('#n5');
                n6 = cy.$('#n6');

                done();
            }
        });
    });

    it('eles.dijkstra() undirected', function () {
        var res = n1.dijkstra(n5, wFunction, false),
            len = 0;
        expect(res.length === 3).to.be.true;
        for (var i = 0; i < res.length; i++) {
            len += wFunction.call(res[i]);
        }
        expect(len === 20).to.be.true;
    });

    it('eles.dijkstra() directed', function () {
        var res = n1.dijkstra(n5, wFunction, true),
            len = 0;
        expect(res.length === 2).to.be.true;
        for (var i = 0; i < res.length; i++) {
            len += wFunction.call(res[i]);
        }
        expect(len === 23).to.be.true;
    });
});