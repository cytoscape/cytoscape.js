// A build of cola as of 2016-12-01 for demo purposes only!

// Use npm to get the latest version or build from source:
// https://github.com/tgdwyer/WebCola

var cola;
(function (cola) {
    var packingOptions = {
        PADDING: 10,
        GOLDEN_SECTION: (1 + Math.sqrt(5)) / 2,
        FLOAT_EPSILON: 0.0001,
        MAX_INERATIONS: 100
    };
    // assign x, y to nodes while using box packing algorithm for disconnected graphs
    function applyPacking(graphs, w, h, node_size, desired_ratio) {
        if (desired_ratio === void 0) { desired_ratio = 1; }
        var init_x = 0, init_y = 0, svg_width = w, svg_height = h, desired_ratio = typeof desired_ratio !== 'undefined' ? desired_ratio : 1, node_size = typeof node_size !== 'undefined' ? node_size : 0, real_width = 0, real_height = 0, min_width = 0, global_bottom = 0, line = [];
        if (graphs.length == 0)
            return;
        /// that would take care of single nodes problem
        // graphs.forEach(function (g) {
        //     if (g.array.length == 1) {
        //         g.array[0].x = 0;
        //         g.array[0].y = 0;
        //     }
        // });
        calculate_bb(graphs);
        apply(graphs, desired_ratio);
        put_nodes_to_right_positions(graphs);
        // get bounding boxes for all separate graphs
        function calculate_bb(graphs) {
            graphs.forEach(function (g) {
                calculate_single_bb(g);
            });
            function calculate_single_bb(graph) {
                var min_x = Number.MAX_VALUE, min_y = Number.MAX_VALUE, max_x = 0, max_y = 0;
                graph.array.forEach(function (v) {
                    var w = typeof v.width !== 'undefined' ? v.width : node_size;
                    var h = typeof v.height !== 'undefined' ? v.height : node_size;
                    w /= 2;
                    h /= 2;
                    max_x = Math.max(v.x + w, max_x);
                    min_x = Math.min(v.x - w, min_x);
                    max_y = Math.max(v.y + h, max_y);
                    min_y = Math.min(v.y - h, min_y);
                });
                graph.width = max_x - min_x;
                graph.height = max_y - min_y;
            }
        }
        //function plot(data, left, right, opt_x, opt_y) {
        //    // plot the cost function
        //    var plot_svg = d3.select("body").append("svg")
        //        .attr("width", function () { return 2 * (right - left); })
        //        .attr("height", 200);
        //    var x = d3.time.scale().range([0, 2 * (right - left)]);
        //    var xAxis = d3.svg.axis().scale(x).orient("bottom");
        //    plot_svg.append("g").attr("class", "x axis")
        //        .attr("transform", "translate(0, 199)")
        //        .call(xAxis);
        //    var lastX = 0;
        //    var lastY = 0;
        //    var value = 0;
        //    for (var r = left; r < right; r += 1) {
        //        value = step(data, r);
        //        // value = 1;
        //        plot_svg.append("line").attr("x1", 2 * (lastX - left))
        //            .attr("y1", 200 - 30 * lastY)
        //            .attr("x2", 2 * r - 2 * left)
        //            .attr("y2", 200 - 30 * value)
        //            .style("stroke", "rgb(6,120,155)");
        //        lastX = r;
        //        lastY = value;
        //    }
        //    plot_svg.append("circle").attr("cx", 2 * opt_x - 2 * left).attr("cy", 200 - 30 * opt_y)
        //        .attr("r", 5).style('fill', "rgba(0,0,0,0.5)");
        //}
        // actual assigning of position to nodes
        function put_nodes_to_right_positions(graphs) {
            graphs.forEach(function (g) {
                // calculate current graph center:
                var center = { x: 0, y: 0 };
                g.array.forEach(function (node) {
                    center.x += node.x;
                    center.y += node.y;
                });
                center.x /= g.array.length;
                center.y /= g.array.length;
                // calculate current top left corner:
                var corner = { x: center.x - g.width / 2, y: center.y - g.height / 2 };
                var offset = { x: g.x - corner.x + svg_width / 2 - real_width / 2, y: g.y - corner.y + svg_height / 2 - real_height / 2 };
                // put nodes:
                g.array.forEach(function (node) {
                    node.x += offset.x;
                    node.y += offset.y;
                });
            });
        }
        // starts box packing algorithm
        // desired ratio is 1 by default
        function apply(data, desired_ratio) {
            var curr_best_f = Number.POSITIVE_INFINITY;
            var curr_best = 0;
            data.sort(function (a, b) { return b.height - a.height; });
            min_width = data.reduce(function (a, b) {
                return a.width < b.width ? a.width : b.width;
            });
            var left = x1 = min_width;
            var right = x2 = get_entire_width(data);
            var iterationCounter = 0;
            var f_x1 = Number.MAX_VALUE;
            var f_x2 = Number.MAX_VALUE;
            var flag = -1; // determines which among f_x1 and f_x2 to recompute
            var dx = Number.MAX_VALUE;
            var df = Number.MAX_VALUE;
            while ((dx > min_width) || df > packingOptions.FLOAT_EPSILON) {
                if (flag != 1) {
                    var x1 = right - (right - left) / packingOptions.GOLDEN_SECTION;
                    var f_x1 = step(data, x1);
                }
                if (flag != 0) {
                    var x2 = left + (right - left) / packingOptions.GOLDEN_SECTION;
                    var f_x2 = step(data, x2);
                }
                dx = Math.abs(x1 - x2);
                df = Math.abs(f_x1 - f_x2);
                if (f_x1 < curr_best_f) {
                    curr_best_f = f_x1;
                    curr_best = x1;
                }
                if (f_x2 < curr_best_f) {
                    curr_best_f = f_x2;
                    curr_best = x2;
                }
                if (f_x1 > f_x2) {
                    left = x1;
                    x1 = x2;
                    f_x1 = f_x2;
                    flag = 1;
                }
                else {
                    right = x2;
                    x2 = x1;
                    f_x2 = f_x1;
                    flag = 0;
                }
                if (iterationCounter++ > 100) {
                    break;
                }
            }
            // plot(data, min_width, get_entire_width(data), curr_best, curr_best_f);
            step(data, curr_best);
        }
        // one iteration of the optimization method
        // (gives a proper, but not necessarily optimal packing)
        function step(data, max_width) {
            line = [];
            real_width = 0;
            real_height = 0;
            global_bottom = init_y;
            for (var i = 0; i < data.length; i++) {
                var o = data[i];
                put_rect(o, max_width);
            }
            return Math.abs(get_real_ratio() - desired_ratio);
        }
        // looking for a position to one box
        function put_rect(rect, max_width) {
            var parent = undefined;
            for (var i = 0; i < line.length; i++) {
                if ((line[i].space_left >= rect.height) && (line[i].x + line[i].width + rect.width + packingOptions.PADDING - max_width) <= packingOptions.FLOAT_EPSILON) {
                    parent = line[i];
                    break;
                }
            }
            line.push(rect);
            if (parent !== undefined) {
                rect.x = parent.x + parent.width + packingOptions.PADDING;
                rect.y = parent.bottom;
                rect.space_left = rect.height;
                rect.bottom = rect.y;
                parent.space_left -= rect.height + packingOptions.PADDING;
                parent.bottom += rect.height + packingOptions.PADDING;
            }
            else {
                rect.y = global_bottom;
                global_bottom += rect.height + packingOptions.PADDING;
                rect.x = init_x;
                rect.bottom = rect.y;
                rect.space_left = rect.height;
            }
            if (rect.y + rect.height - real_height > -packingOptions.FLOAT_EPSILON)
                real_height = rect.y + rect.height - init_y;
            if (rect.x + rect.width - real_width > -packingOptions.FLOAT_EPSILON)
                real_width = rect.x + rect.width - init_x;
        }
        ;
        function get_entire_width(data) {
            var width = 0;
            data.forEach(function (d) { return width += d.width + packingOptions.PADDING; });
            return width;
        }
        function get_real_ratio() {
            return (real_width / real_height);
        }
    }
    cola.applyPacking = applyPacking;
    /**
     * connected components of graph
     * returns an array of {}
     */
    function separateGraphs(nodes, links) {
        var marks = {};
        var ways = {};
        var graphs = [];
        var clusters = 0;
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var n1 = link.source;
            var n2 = link.target;
            if (ways[n1.index])
                ways[n1.index].push(n2);
            else
                ways[n1.index] = [n2];
            if (ways[n2.index])
                ways[n2.index].push(n1);
            else
                ways[n2.index] = [n1];
        }
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            if (marks[node.index])
                continue;
            explore_node(node, true);
        }
        function explore_node(n, is_new) {
            if (marks[n.index] !== undefined)
                return;
            if (is_new) {
                clusters++;
                graphs.push({ array: [] });
            }
            marks[n.index] = clusters;
            graphs[clusters - 1].array.push(n);
            var adjacent = ways[n.index];
            if (!adjacent)
                return;
            for (var j = 0; j < adjacent.length; j++) {
                explore_node(adjacent[j], false);
            }
        }
        return graphs;
    }
    cola.separateGraphs = separateGraphs;
})(cola || (cola = {}));
var cola;
(function (cola) {
    var vpsc;
    (function (vpsc) {
        var PositionStats = (function () {
            function PositionStats(scale) {
                this.scale = scale;
                this.AB = 0;
                this.AD = 0;
                this.A2 = 0;
            }
            PositionStats.prototype.addVariable = function (v) {
                var ai = this.scale / v.scale;
                var bi = v.offset / v.scale;
                var wi = v.weight;
                this.AB += wi * ai * bi;
                this.AD += wi * ai * v.desiredPosition;
                this.A2 += wi * ai * ai;
            };
            PositionStats.prototype.getPosn = function () {
                return (this.AD - this.AB) / this.A2;
            };
            return PositionStats;
        })();
        vpsc.PositionStats = PositionStats;
        var Constraint = (function () {
            function Constraint(left, right, gap, equality) {
                if (equality === void 0) { equality = false; }
                this.left = left;
                this.right = right;
                this.gap = gap;
                this.equality = equality;
                this.active = false;
                this.unsatisfiable = false;
                this.left = left;
                this.right = right;
                this.gap = gap;
                this.equality = equality;
            }
            Constraint.prototype.slack = function () {
                return this.unsatisfiable ? Number.MAX_VALUE
                    : this.right.scale * this.right.position() - this.gap
                        - this.left.scale * this.left.position();
            };
            return Constraint;
        })();
        vpsc.Constraint = Constraint;
        var Variable = (function () {
            function Variable(desiredPosition, weight, scale) {
                if (weight === void 0) { weight = 1; }
                if (scale === void 0) { scale = 1; }
                this.desiredPosition = desiredPosition;
                this.weight = weight;
                this.scale = scale;
                this.offset = 0;
            }
            Variable.prototype.dfdv = function () {
                return 2.0 * this.weight * (this.position() - this.desiredPosition);
            };
            Variable.prototype.position = function () {
                return (this.block.ps.scale * this.block.posn + this.offset) / this.scale;
            };
            // visit neighbours by active constraints within the same block
            Variable.prototype.visitNeighbours = function (prev, f) {
                var ff = function (c, next) { return c.active && prev !== next && f(c, next); };
                this.cOut.forEach(function (c) { return ff(c, c.right); });
                this.cIn.forEach(function (c) { return ff(c, c.left); });
            };
            return Variable;
        })();
        vpsc.Variable = Variable;
        var Block = (function () {
            function Block(v) {
                this.vars = [];
                v.offset = 0;
                this.ps = new PositionStats(v.scale);
                this.addVariable(v);
            }
            Block.prototype.addVariable = function (v) {
                v.block = this;
                this.vars.push(v);
                this.ps.addVariable(v);
                this.posn = this.ps.getPosn();
            };
            // move the block where it needs to be to minimize cost
            Block.prototype.updateWeightedPosition = function () {
                this.ps.AB = this.ps.AD = this.ps.A2 = 0;
                for (var i = 0, n = this.vars.length; i < n; ++i)
                    this.ps.addVariable(this.vars[i]);
                this.posn = this.ps.getPosn();
            };
            Block.prototype.compute_lm = function (v, u, postAction) {
                var _this = this;
                var dfdv = v.dfdv();
                v.visitNeighbours(u, function (c, next) {
                    var _dfdv = _this.compute_lm(next, v, postAction);
                    if (next === c.right) {
                        dfdv += _dfdv * c.left.scale;
                        c.lm = _dfdv;
                    }
                    else {
                        dfdv += _dfdv * c.right.scale;
                        c.lm = -_dfdv;
                    }
                    postAction(c);
                });
                return dfdv / v.scale;
            };
            Block.prototype.populateSplitBlock = function (v, prev) {
                var _this = this;
                v.visitNeighbours(prev, function (c, next) {
                    next.offset = v.offset + (next === c.right ? c.gap : -c.gap);
                    _this.addVariable(next);
                    _this.populateSplitBlock(next, v);
                });
            };
            // traverse the active constraint tree applying visit to each active constraint
            Block.prototype.traverse = function (visit, acc, v, prev) {
                var _this = this;
                if (v === void 0) { v = this.vars[0]; }
                if (prev === void 0) { prev = null; }
                v.visitNeighbours(prev, function (c, next) {
                    acc.push(visit(c));
                    _this.traverse(visit, acc, next, v);
                });
            };
            // calculate lagrangian multipliers on constraints and
            // find the active constraint in this block with the smallest lagrangian.
            // if the lagrangian is negative, then the constraint is a split candidate.
            Block.prototype.findMinLM = function () {
                var m = null;
                this.compute_lm(this.vars[0], null, function (c) {
                    if (!c.equality && (m === null || c.lm < m.lm))
                        m = c;
                });
                return m;
            };
            Block.prototype.findMinLMBetween = function (lv, rv) {
                this.compute_lm(lv, null, function () { });
                var m = null;
                this.findPath(lv, null, rv, function (c, next) {
                    if (!c.equality && c.right === next && (m === null || c.lm < m.lm))
                        m = c;
                });
                return m;
            };
            Block.prototype.findPath = function (v, prev, to, visit) {
                var _this = this;
                var endFound = false;
                v.visitNeighbours(prev, function (c, next) {
                    if (!endFound && (next === to || _this.findPath(next, v, to, visit))) {
                        endFound = true;
                        visit(c, next);
                    }
                });
                return endFound;
            };
            // Search active constraint tree from u to see if there is a directed path to v.
            // Returns true if path is found.
            Block.prototype.isActiveDirectedPathBetween = function (u, v) {
                if (u === v)
                    return true;
                var i = u.cOut.length;
                while (i--) {
                    var c = u.cOut[i];
                    if (c.active && this.isActiveDirectedPathBetween(c.right, v))
                        return true;
                }
                return false;
            };
            // split the block into two by deactivating the specified constraint
            Block.split = function (c) {
                /* DEBUG
                            console.log("split on " + c);
                            console.assert(c.active, "attempt to split on inactive constraint");
                DEBUG */
                c.active = false;
                return [Block.createSplitBlock(c.left), Block.createSplitBlock(c.right)];
            };
            Block.createSplitBlock = function (startVar) {
                var b = new Block(startVar);
                b.populateSplitBlock(startVar, null);
                return b;
            };
            // find a split point somewhere between the specified variables
            Block.prototype.splitBetween = function (vl, vr) {
                /* DEBUG
                            console.assert(vl.block === this);
                            console.assert(vr.block === this);
                DEBUG */
                var c = this.findMinLMBetween(vl, vr);
                if (c !== null) {
                    var bs = Block.split(c);
                    return { constraint: c, lb: bs[0], rb: bs[1] };
                }
                // couldn't find a split point - for example the active path is all equality constraints
                return null;
            };
            Block.prototype.mergeAcross = function (b, c, dist) {
                c.active = true;
                for (var i = 0, n = b.vars.length; i < n; ++i) {
                    var v = b.vars[i];
                    v.offset += dist;
                    this.addVariable(v);
                }
                this.posn = this.ps.getPosn();
            };
            Block.prototype.cost = function () {
                var sum = 0, i = this.vars.length;
                while (i--) {
                    var v = this.vars[i], d = v.position() - v.desiredPosition;
                    sum += d * d * v.weight;
                }
                return sum;
            };
            return Block;
        })();
        vpsc.Block = Block;
        var Blocks = (function () {
            function Blocks(vs) {
                this.vs = vs;
                var n = vs.length;
                this.list = new Array(n);
                while (n--) {
                    var b = new Block(vs[n]);
                    this.list[n] = b;
                    b.blockInd = n;
                }
            }
            Blocks.prototype.cost = function () {
                var sum = 0, i = this.list.length;
                while (i--)
                    sum += this.list[i].cost();
                return sum;
            };
            Blocks.prototype.insert = function (b) {
                /* DEBUG
                            console.assert(!this.contains(b), "blocks error: tried to reinsert block " + b.blockInd)
                DEBUG */
                b.blockInd = this.list.length;
                this.list.push(b);
                /* DEBUG
                            console.log("insert block: " + b.blockInd);
                            this.contains(b);
                DEBUG */
            };
            Blocks.prototype.remove = function (b) {
                /* DEBUG
                            console.log("remove block: " + b.blockInd);
                            console.assert(this.contains(b));
                DEBUG */
                var last = this.list.length - 1;
                var swapBlock = this.list[last];
                this.list.length = last;
                if (b !== swapBlock) {
                    this.list[b.blockInd] = swapBlock;
                    swapBlock.blockInd = b.blockInd;
                }
            };
            // merge the blocks on either side of the specified constraint, by copying the smaller block into the larger
            // and deleting the smaller.
            Blocks.prototype.merge = function (c) {
                var l = c.left.block, r = c.right.block;
                /* DEBUG
                            console.assert(l!==r, "attempt to merge within the same block");
                DEBUG */
                var dist = c.right.offset - c.left.offset - c.gap;
                if (l.vars.length < r.vars.length) {
                    r.mergeAcross(l, c, dist);
                    this.remove(l);
                }
                else {
                    l.mergeAcross(r, c, -dist);
                    this.remove(r);
                }
                /* DEBUG
                            console.assert(Math.abs(c.slack()) < 1e-6, "Error: Constraint should be at equality after merge!");
                            console.log("merged on " + c);
                DEBUG */
            };
            Blocks.prototype.forEach = function (f) {
                this.list.forEach(f);
            };
            // useful, for example, after variable desired positions change.
            Blocks.prototype.updateBlockPositions = function () {
                this.list.forEach(function (b) { return b.updateWeightedPosition(); });
            };
            // split each block across its constraint with the minimum lagrangian
            Blocks.prototype.split = function (inactive) {
                var _this = this;
                this.updateBlockPositions();
                this.list.forEach(function (b) {
                    var v = b.findMinLM();
                    if (v !== null && v.lm < Solver.LAGRANGIAN_TOLERANCE) {
                        b = v.left.block;
                        Block.split(v).forEach(function (nb) { return _this.insert(nb); });
                        _this.remove(b);
                        inactive.push(v);
                    }
                });
            };
            return Blocks;
        })();
        vpsc.Blocks = Blocks;
        var Solver = (function () {
            function Solver(vs, cs) {
                this.vs = vs;
                this.cs = cs;
                this.vs = vs;
                vs.forEach(function (v) {
                    v.cIn = [], v.cOut = [];
                    /* DEBUG
                                    v.toString = () => "v" + vs.indexOf(v);
                    DEBUG */
                });
                this.cs = cs;
                cs.forEach(function (c) {
                    c.left.cOut.push(c);
                    c.right.cIn.push(c);
                    /* DEBUG
                                    c.toString = () => c.left + "+" + c.gap + "<=" + c.right + " slack=" + c.slack() + " active=" + c.active;
                    DEBUG */
                });
                this.inactive = cs.map(function (c) { c.active = false; return c; });
                this.bs = null;
            }
            Solver.prototype.cost = function () {
                return this.bs.cost();
            };
            // set starting positions without changing desired positions.
            // Note: it throws away any previous block structure.
            Solver.prototype.setStartingPositions = function (ps) {
                this.inactive = this.cs.map(function (c) { c.active = false; return c; });
                this.bs = new Blocks(this.vs);
                this.bs.forEach(function (b, i) { return b.posn = ps[i]; });
            };
            Solver.prototype.setDesiredPositions = function (ps) {
                this.vs.forEach(function (v, i) { return v.desiredPosition = ps[i]; });
            };
            /* DEBUG
                    private getId(v: Variable): number {
                        return this.vs.indexOf(v);
                    }

                    // sanity check of the index integrity of the inactive list
                    checkInactive(): void {
                        var inactiveCount = 0;
                        this.cs.forEach(c=> {
                            var i = this.inactive.indexOf(c);
                            console.assert(!c.active && i >= 0 || c.active && i < 0, "constraint should be in the inactive list if it is not active: " + c);
                            if (i >= 0) {
                                inactiveCount++;
                            } else {
                                console.assert(c.active, "inactive constraint not found in inactive list: " + c);
                            }
                        });
                        console.assert(inactiveCount === this.inactive.length, inactiveCount + " inactive constraints found, " + this.inactive.length + "in inactive list");
                    }
                    // after every call to satisfy the following should check should pass
                    checkSatisfied(): void {
                        this.cs.forEach(c=>console.assert(c.slack() >= vpsc.Solver.ZERO_UPPERBOUND, "Error: Unsatisfied constraint! "+c));
                    }
            DEBUG */
            Solver.prototype.mostViolated = function () {
                var minSlack = Number.MAX_VALUE, v = null, l = this.inactive, n = l.length, deletePoint = n;
                for (var i = 0; i < n; ++i) {
                    var c = l[i];
                    if (c.unsatisfiable)
                        continue;
                    var slack = c.slack();
                    if (c.equality || slack < minSlack) {
                        minSlack = slack;
                        v = c;
                        deletePoint = i;
                        if (c.equality)
                            break;
                    }
                }
                if (deletePoint !== n &&
                    (minSlack < Solver.ZERO_UPPERBOUND && !v.active || v.equality)) {
                    l[deletePoint] = l[n - 1];
                    l.length = n - 1;
                }
                return v;
            };
            // satisfy constraints by building block structure over violated constraints
            // and moving the blocks to their desired positions
            Solver.prototype.satisfy = function () {
                if (this.bs == null) {
                    this.bs = new Blocks(this.vs);
                }
                /* DEBUG
                            console.log("satisfy: " + this.bs);
                DEBUG */
                this.bs.split(this.inactive);
                var v = null;
                while ((v = this.mostViolated()) && (v.equality || v.slack() < Solver.ZERO_UPPERBOUND && !v.active)) {
                    var lb = v.left.block, rb = v.right.block;
                    /* DEBUG
                                    console.log("most violated is: " + v);
                                    this.bs.contains(lb);
                                    this.bs.contains(rb);
                    DEBUG */
                    if (lb !== rb) {
                        this.bs.merge(v);
                    }
                    else {
                        if (lb.isActiveDirectedPathBetween(v.right, v.left)) {
                            // cycle found!
                            v.unsatisfiable = true;
                            continue;
                        }
                        // constraint is within block, need to split first
                        var split = lb.splitBetween(v.left, v.right);
                        if (split !== null) {
                            this.bs.insert(split.lb);
                            this.bs.insert(split.rb);
                            this.bs.remove(lb);
                            this.inactive.push(split.constraint);
                        }
                        else {
                            /* DEBUG
                                                    console.log("unsatisfiable constraint found");
                            DEBUG */
                            v.unsatisfiable = true;
                            continue;
                        }
                        if (v.slack() >= 0) {
                            /* DEBUG
                                                    console.log("violated constraint indirectly satisfied: " + v);
                            DEBUG */
                            // v was satisfied by the above split!
                            this.inactive.push(v);
                        }
                        else {
                            /* DEBUG
                                                    console.log("merge after split:");
                            DEBUG */
                            this.bs.merge(v);
                        }
                    }
                }
                /* DEBUG
                            this.checkSatisfied();
                DEBUG */
            };
            // repeatedly build and split block structure until we converge to an optimal solution
            Solver.prototype.solve = function () {
                this.satisfy();
                var lastcost = Number.MAX_VALUE, cost = this.bs.cost();
                while (Math.abs(lastcost - cost) > 0.0001) {
                    this.satisfy();
                    lastcost = cost;
                    cost = this.bs.cost();
                }
                return cost;
            };
            Solver.LAGRANGIAN_TOLERANCE = -1e-4;
            Solver.ZERO_UPPERBOUND = -1e-10;
            return Solver;
        })();
        vpsc.Solver = Solver;
        /**
          * Remove overlap between spans while keeping their centers as close as possible to the specified desiredCenters.
          * Lower and upper bounds will be respected if the spans physically fit between them
          * (otherwise they'll be moved and their new position returned).
          * If no upper/lower bound is specified then the bounds of the moved spans will be returned.
          * returns a new center for each span.
          */
        function removeOverlapInOneDimension(spans, lowerBound, upperBound) {
            var vs = spans.map(function (s) { return new Variable(s.desiredCenter); });
            var cs = [];
            var n = spans.length;
            for (var i = 0; i < n - 1; i++) {
                var left = spans[i], right = spans[i + 1];
                cs.push(new Constraint(vs[i], vs[i + 1], (left.size + right.size) / 2));
            }
            var leftMost = vs[0], rightMost = vs[n - 1], leftMostSize = spans[0].size / 2, rightMostSize = spans[n - 1].size / 2;
            var vLower = null, vUpper = null;
            if (lowerBound) {
                vLower = new Variable(lowerBound, leftMost.weight * 1000);
                vs.push(vLower);
                cs.push(new Constraint(vLower, leftMost, leftMostSize));
            }
            if (upperBound) {
                vUpper = new Variable(upperBound, rightMost.weight * 1000);
                vs.push(vUpper);
                cs.push(new Constraint(rightMost, vUpper, rightMostSize));
            }
            var solver = new Solver(vs, cs);
            solver.solve();
            return {
                newCenters: vs.slice(0, spans.length).map(function (v) { return v.position(); }),
                lowerBound: vLower ? vLower.position() : leftMost.position() - leftMostSize,
                upperBound: vUpper ? vUpper.position() : rightMost.position() + rightMostSize
            };
        }
        vpsc.removeOverlapInOneDimension = removeOverlapInOneDimension;
    })(vpsc = cola.vpsc || (cola.vpsc = {}));
})(cola || (cola = {}));
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var cola;
(function (cola) {
    var vpsc;
    (function (vpsc) {
        //Based on js_es:
        //
        //https://github.com/vadimg/js_bintrees
        //
        //Copyright (C) 2011 by Vadim Graboys
        //
        //Permission is hereby granted, free of charge, to any person obtaining a copy
        //of this software and associated documentation files (the "Software"), to deal
        //in the Software without restriction, including without limitation the rights
        //to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
        //copies of the Software, and to permit persons to whom the Software is
        //furnished to do so, subject to the following conditions:
        //
        //The above copyright notice and this permission notice shall be included in
        //all copies or substantial portions of the Software.
        //
        //THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
        //IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
        //FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
        //AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
        //LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
        //OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
        //THE SOFTWARE.
        var TreeBase = (function () {
            function TreeBase() {
                // returns iterator to node if found, null otherwise
                this.findIter = function (data) {
                    var res = this._root;
                    var iter = this.iterator();
                    while (res !== null) {
                        var c = this._comparator(data, res.data);
                        if (c === 0) {
                            iter._cursor = res;
                            return iter;
                        }
                        else {
                            iter._ancestors.push(res);
                            res = res.get_child(c > 0);
                        }
                    }
                    return null;
                };
            }
            // removes all nodes from the tree
            TreeBase.prototype.clear = function () {
                this._root = null;
                this.size = 0;
            };
            ;
            // returns node data if found, null otherwise
            TreeBase.prototype.find = function (data) {
                var res = this._root;
                while (res !== null) {
                    var c = this._comparator(data, res.data);
                    if (c === 0) {
                        return res.data;
                    }
                    else {
                        res = res.get_child(c > 0);
                    }
                }
                return null;
            };
            ;
            // Returns an interator to the tree node immediately before (or at) the element
            TreeBase.prototype.lowerBound = function (data) {
                return this._bound(data, this._comparator);
            };
            ;
            // Returns an interator to the tree node immediately after (or at) the element
            TreeBase.prototype.upperBound = function (data) {
                var cmp = this._comparator;
                function reverse_cmp(a, b) {
                    return cmp(b, a);
                }
                return this._bound(data, reverse_cmp);
            };
            ;
            // returns null if tree is empty
            TreeBase.prototype.min = function () {
                var res = this._root;
                if (res === null) {
                    return null;
                }
                while (res.left !== null) {
                    res = res.left;
                }
                return res.data;
            };
            ;
            // returns null if tree is empty
            TreeBase.prototype.max = function () {
                var res = this._root;
                if (res === null) {
                    return null;
                }
                while (res.right !== null) {
                    res = res.right;
                }
                return res.data;
            };
            ;
            // returns a null iterator
            // call next() or prev() to point to an element
            TreeBase.prototype.iterator = function () {
                return new Iterator(this);
            };
            ;
            // calls cb on each node's data, in order
            TreeBase.prototype.each = function (cb) {
                var it = this.iterator(), data;
                while ((data = it.next()) !== null) {
                    cb(data);
                }
            };
            ;
            // calls cb on each node's data, in reverse order
            TreeBase.prototype.reach = function (cb) {
                var it = this.iterator(), data;
                while ((data = it.prev()) !== null) {
                    cb(data);
                }
            };
            ;
            // used for lowerBound and upperBound
            TreeBase.prototype._bound = function (data, cmp) {
                var cur = this._root;
                var iter = this.iterator();
                while (cur !== null) {
                    var c = this._comparator(data, cur.data);
                    if (c === 0) {
                        iter._cursor = cur;
                        return iter;
                    }
                    iter._ancestors.push(cur);
                    cur = cur.get_child(c > 0);
                }
                for (var i = iter._ancestors.length - 1; i >= 0; --i) {
                    cur = iter._ancestors[i];
                    if (cmp(data, cur.data) > 0) {
                        iter._cursor = cur;
                        iter._ancestors.length = i;
                        return iter;
                    }
                }
                iter._ancestors.length = 0;
                return iter;
            };
            ;
            return TreeBase;
        })();
        vpsc.TreeBase = TreeBase;
        var Iterator = (function () {
            function Iterator(tree) {
                this._tree = tree;
                this._ancestors = [];
                this._cursor = null;
            }
            Iterator.prototype.data = function () {
                return this._cursor !== null ? this._cursor.data : null;
            };
            ;
            // if null-iterator, returns first node
            // otherwise, returns next node
            Iterator.prototype.next = function () {
                if (this._cursor === null) {
                    var root = this._tree._root;
                    if (root !== null) {
                        this._minNode(root);
                    }
                }
                else {
                    if (this._cursor.right === null) {
                        // no greater node in subtree, go up to parent
                        // if coming from a right child, continue up the stack
                        var save;
                        do {
                            save = this._cursor;
                            if (this._ancestors.length) {
                                this._cursor = this._ancestors.pop();
                            }
                            else {
                                this._cursor = null;
                                break;
                            }
                        } while (this._cursor.right === save);
                    }
                    else {
                        // get the next node from the subtree
                        this._ancestors.push(this._cursor);
                        this._minNode(this._cursor.right);
                    }
                }
                return this._cursor !== null ? this._cursor.data : null;
            };
            ;
            // if null-iterator, returns last node
            // otherwise, returns previous node
            Iterator.prototype.prev = function () {
                if (this._cursor === null) {
                    var root = this._tree._root;
                    if (root !== null) {
                        this._maxNode(root);
                    }
                }
                else {
                    if (this._cursor.left === null) {
                        var save;
                        do {
                            save = this._cursor;
                            if (this._ancestors.length) {
                                this._cursor = this._ancestors.pop();
                            }
                            else {
                                this._cursor = null;
                                break;
                            }
                        } while (this._cursor.left === save);
                    }
                    else {
                        this._ancestors.push(this._cursor);
                        this._maxNode(this._cursor.left);
                    }
                }
                return this._cursor !== null ? this._cursor.data : null;
            };
            ;
            Iterator.prototype._minNode = function (start) {
                while (start.left !== null) {
                    this._ancestors.push(start);
                    start = start.left;
                }
                this._cursor = start;
            };
            ;
            Iterator.prototype._maxNode = function (start) {
                while (start.right !== null) {
                    this._ancestors.push(start);
                    start = start.right;
                }
                this._cursor = start;
            };
            ;
            return Iterator;
        })();
        vpsc.Iterator = Iterator;
        var Node = (function () {
            function Node(data) {
                this.data = data;
                this.left = null;
                this.right = null;
                this.red = true;
            }
            Node.prototype.get_child = function (dir) {
                return dir ? this.right : this.left;
            };
            ;
            Node.prototype.set_child = function (dir, val) {
                if (dir) {
                    this.right = val;
                }
                else {
                    this.left = val;
                }
            };
            ;
            return Node;
        })();
        var RBTree = (function (_super) {
            __extends(RBTree, _super);
            function RBTree(comparator) {
                _super.call(this);
                this._root = null;
                this._comparator = comparator;
                this.size = 0;
            }
            // returns true if inserted, false if duplicate
            RBTree.prototype.insert = function (data) {
                var ret = false;
                if (this._root === null) {
                    // empty tree
                    this._root = new Node(data);
                    ret = true;
                    this.size++;
                }
                else {
                    var head = new Node(undefined); // fake tree root
                    var dir = false;
                    var last = false;
                    // setup
                    var gp = null; // grandparent
                    var ggp = head; // grand-grand-parent
                    var p = null; // parent
                    var node = this._root;
                    ggp.right = this._root;
                    // search down
                    while (true) {
                        if (node === null) {
                            // insert new node at the bottom
                            node = new Node(data);
                            p.set_child(dir, node);
                            ret = true;
                            this.size++;
                        }
                        else if (RBTree.is_red(node.left) && RBTree.is_red(node.right)) {
                            // color flip
                            node.red = true;
                            node.left.red = false;
                            node.right.red = false;
                        }
                        // fix red violation
                        if (RBTree.is_red(node) && RBTree.is_red(p)) {
                            var dir2 = ggp.right === gp;
                            if (node === p.get_child(last)) {
                                ggp.set_child(dir2, RBTree.single_rotate(gp, !last));
                            }
                            else {
                                ggp.set_child(dir2, RBTree.double_rotate(gp, !last));
                            }
                        }
                        var cmp = this._comparator(node.data, data);
                        // stop if found
                        if (cmp === 0) {
                            break;
                        }
                        last = dir;
                        dir = cmp < 0;
                        // update helpers
                        if (gp !== null) {
                            ggp = gp;
                        }
                        gp = p;
                        p = node;
                        node = node.get_child(dir);
                    }
                    // update root
                    this._root = head.right;
                }
                // make root black
                this._root.red = false;
                return ret;
            };
            ;
            // returns true if removed, false if not found
            RBTree.prototype.remove = function (data) {
                if (this._root === null) {
                    return false;
                }
                var head = new Node(undefined); // fake tree root
                var node = head;
                node.right = this._root;
                var p = null; // parent
                var gp = null; // grand parent
                var found = null; // found item
                var dir = true;
                while (node.get_child(dir) !== null) {
                    var last = dir;
                    // update helpers
                    gp = p;
                    p = node;
                    node = node.get_child(dir);
                    var cmp = this._comparator(data, node.data);
                    dir = cmp > 0;
                    // save found node
                    if (cmp === 0) {
                        found = node;
                    }
                    // push the red node down
                    if (!RBTree.is_red(node) && !RBTree.is_red(node.get_child(dir))) {
                        if (RBTree.is_red(node.get_child(!dir))) {
                            var sr = RBTree.single_rotate(node, dir);
                            p.set_child(last, sr);
                            p = sr;
                        }
                        else if (!RBTree.is_red(node.get_child(!dir))) {
                            var sibling = p.get_child(!last);
                            if (sibling !== null) {
                                if (!RBTree.is_red(sibling.get_child(!last)) && !RBTree.is_red(sibling.get_child(last))) {
                                    // color flip
                                    p.red = false;
                                    sibling.red = true;
                                    node.red = true;
                                }
                                else {
                                    var dir2 = gp.right === p;
                                    if (RBTree.is_red(sibling.get_child(last))) {
                                        gp.set_child(dir2, RBTree.double_rotate(p, last));
                                    }
                                    else if (RBTree.is_red(sibling.get_child(!last))) {
                                        gp.set_child(dir2, RBTree.single_rotate(p, last));
                                    }
                                    // ensure correct coloring
                                    var gpc = gp.get_child(dir2);
                                    gpc.red = true;
                                    node.red = true;
                                    gpc.left.red = false;
                                    gpc.right.red = false;
                                }
                            }
                        }
                    }
                }
                // replace and remove if found
                if (found !== null) {
                    found.data = node.data;
                    p.set_child(p.right === node, node.get_child(node.left === null));
                    this.size--;
                }
                // update root and make it black
                this._root = head.right;
                if (this._root !== null) {
                    this._root.red = false;
                }
                return found !== null;
            };
            ;
            RBTree.is_red = function (node) {
                return node !== null && node.red;
            };
            RBTree.single_rotate = function (root, dir) {
                var save = root.get_child(!dir);
                root.set_child(!dir, save.get_child(dir));
                save.set_child(dir, root);
                root.red = true;
                save.red = false;
                return save;
            };
            RBTree.double_rotate = function (root, dir) {
                root.set_child(!dir, RBTree.single_rotate(root.get_child(!dir), !dir));
                return RBTree.single_rotate(root, dir);
            };
            return RBTree;
        })(TreeBase);
        vpsc.RBTree = RBTree;
    })(vpsc = cola.vpsc || (cola.vpsc = {}));
})(cola || (cola = {}));
///<reference path="vpsc.ts"/>
///<reference path="rbtree.ts"/>
var cola;
(function (cola) {
    var vpsc;
    (function (vpsc) {
        function computeGroupBounds(g) {
            g.bounds = typeof g.leaves !== "undefined" ?
                g.leaves.reduce(function (r, c) { return c.bounds.union(r); }, Rectangle.empty()) :
                Rectangle.empty();
            if (typeof g.groups !== "undefined")
                g.bounds = g.groups.reduce(function (r, c) { return computeGroupBounds(c).union(r); }, g.bounds);
            g.bounds = g.bounds.inflate(g.padding);
            return g.bounds;
        }
        vpsc.computeGroupBounds = computeGroupBounds;
        var Rectangle = (function () {
            function Rectangle(x, X, y, Y) {
                this.x = x;
                this.X = X;
                this.y = y;
                this.Y = Y;
            }
            Rectangle.empty = function () { return new Rectangle(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY); };
            Rectangle.prototype.cx = function () { return (this.x + this.X) / 2; };
            Rectangle.prototype.cy = function () { return (this.y + this.Y) / 2; };
            Rectangle.prototype.overlapX = function (r) {
                var ux = this.cx(), vx = r.cx();
                if (ux <= vx && r.x < this.X)
                    return this.X - r.x;
                if (vx <= ux && this.x < r.X)
                    return r.X - this.x;
                return 0;
            };
            Rectangle.prototype.overlapY = function (r) {
                var uy = this.cy(), vy = r.cy();
                if (uy <= vy && r.y < this.Y)
                    return this.Y - r.y;
                if (vy <= uy && this.y < r.Y)
                    return r.Y - this.y;
                return 0;
            };
            Rectangle.prototype.setXCentre = function (cx) {
                var dx = cx - this.cx();
                this.x += dx;
                this.X += dx;
            };
            Rectangle.prototype.setYCentre = function (cy) {
                var dy = cy - this.cy();
                this.y += dy;
                this.Y += dy;
            };
            Rectangle.prototype.width = function () {
                return this.X - this.x;
            };
            Rectangle.prototype.height = function () {
                return this.Y - this.y;
            };
            Rectangle.prototype.union = function (r) {
                return new Rectangle(Math.min(this.x, r.x), Math.max(this.X, r.X), Math.min(this.y, r.y), Math.max(this.Y, r.Y));
            };
            /**
             * return any intersection points between the given line and the sides of this rectangle
             * @method lineIntersection
             * @param x1 number first x coord of line
             * @param y1 number first y coord of line
             * @param x2 number second x coord of line
             * @param y2 number second y coord of line
             * @return any intersection points found
             */
            Rectangle.prototype.lineIntersections = function (x1, y1, x2, y2) {
                var sides = [[this.x, this.y, this.X, this.y],
                    [this.X, this.y, this.X, this.Y],
                    [this.X, this.Y, this.x, this.Y],
                    [this.x, this.Y, this.x, this.y]];
                var intersections = [];
                for (var i = 0; i < 4; ++i) {
                    var r = Rectangle.lineIntersection(x1, y1, x2, y2, sides[i][0], sides[i][1], sides[i][2], sides[i][3]);
                    if (r !== null)
                        intersections.push({ x: r.x, y: r.y });
                }
                return intersections;
            };
            /**
             * return any intersection points between a line extending from the centre of this rectangle to the given point,
             *  and the sides of this rectangle
             * @method lineIntersection
             * @param x2 number second x coord of line
             * @param y2 number second y coord of line
             * @return any intersection points found
             */
            Rectangle.prototype.rayIntersection = function (x2, y2) {
                var ints = this.lineIntersections(this.cx(), this.cy(), x2, y2);
                return ints.length > 0 ? ints[0] : null;
            };
            Rectangle.prototype.vertices = function () {
                return [
                    { x: this.x, y: this.y },
                    { x: this.X, y: this.y },
                    { x: this.X, y: this.Y },
                    { x: this.x, y: this.Y },
                    { x: this.x, y: this.y }];
            };
            Rectangle.lineIntersection = function (x1, y1, x2, y2, x3, y3, x4, y4) {
                var dx12 = x2 - x1, dx34 = x4 - x3, dy12 = y2 - y1, dy34 = y4 - y3, denominator = dy34 * dx12 - dx34 * dy12;
                if (denominator == 0)
                    return null;
                var dx31 = x1 - x3, dy31 = y1 - y3, numa = dx34 * dy31 - dy34 * dx31, a = numa / denominator, numb = dx12 * dy31 - dy12 * dx31, b = numb / denominator;
                if (a >= 0 && a <= 1 && b >= 0 && b <= 1) {
                    return {
                        x: x1 + a * dx12,
                        y: y1 + a * dy12
                    };
                }
                return null;
            };
            Rectangle.prototype.inflate = function (pad) {
                return new Rectangle(this.x - pad, this.X + pad, this.y - pad, this.Y + pad);
            };
            return Rectangle;
        })();
        vpsc.Rectangle = Rectangle;
        function makeEdgeBetween(source, target, ah) {
            var si = source.rayIntersection(target.cx(), target.cy()) || { x: source.cx(), y: source.cy() }, ti = target.rayIntersection(source.cx(), source.cy()) || { x: target.cx(), y: target.cy() }, dx = ti.x - si.x, dy = ti.y - si.y, l = Math.sqrt(dx * dx + dy * dy), al = l - ah;
            return {
                sourceIntersection: si,
                targetIntersection: ti,
                arrowStart: { x: si.x + al * dx / l, y: si.y + al * dy / l }
            };
        }
        vpsc.makeEdgeBetween = makeEdgeBetween;
        function makeEdgeTo(s, target, ah) {
            var ti = target.rayIntersection(s.x, s.y);
            if (!ti)
                ti = { x: target.cx(), y: target.cy() };
            var dx = ti.x - s.x, dy = ti.y - s.y, l = Math.sqrt(dx * dx + dy * dy);
            return { x: ti.x - ah * dx / l, y: ti.y - ah * dy / l };
        }
        vpsc.makeEdgeTo = makeEdgeTo;
        var Node = (function () {
            function Node(v, r, pos) {
                this.v = v;
                this.r = r;
                this.pos = pos;
                this.prev = makeRBTree();
                this.next = makeRBTree();
            }
            return Node;
        })();
        var Event = (function () {
            function Event(isOpen, v, pos) {
                this.isOpen = isOpen;
                this.v = v;
                this.pos = pos;
            }
            return Event;
        })();
        function compareEvents(a, b) {
            if (a.pos > b.pos) {
                return 1;
            }
            if (a.pos < b.pos) {
                return -1;
            }
            if (a.isOpen) {
                // open must come before close
                return -1;
            }
            if (b.isOpen) {
                // open must come before close
                return 1;
            }
            return 0;
        }
        function makeRBTree() {
            return new vpsc.RBTree(function (a, b) { return a.pos - b.pos; });
        }
        var xRect = {
            getCentre: function (r) { return r.cx(); },
            getOpen: function (r) { return r.y; },
            getClose: function (r) { return r.Y; },
            getSize: function (r) { return r.width(); },
            makeRect: function (open, close, center, size) { return new Rectangle(center - size / 2, center + size / 2, open, close); },
            findNeighbours: findXNeighbours
        };
        var yRect = {
            getCentre: function (r) { return r.cy(); },
            getOpen: function (r) { return r.x; },
            getClose: function (r) { return r.X; },
            getSize: function (r) { return r.height(); },
            makeRect: function (open, close, center, size) { return new Rectangle(open, close, center - size / 2, center + size / 2); },
            findNeighbours: findYNeighbours
        };
        function generateGroupConstraints(root, f, minSep, isContained) {
            if (isContained === void 0) { isContained = false; }
            var padding = root.padding, gn = typeof root.groups !== 'undefined' ? root.groups.length : 0, ln = typeof root.leaves !== 'undefined' ? root.leaves.length : 0, childConstraints = !gn ? []
                : root.groups.reduce(function (ccs, g) { return ccs.concat(generateGroupConstraints(g, f, minSep, true)); }, []), n = (isContained ? 2 : 0) + ln + gn, vs = new Array(n), rs = new Array(n), i = 0, add = function (r, v) { rs[i] = r; vs[i++] = v; };
            if (isContained) {
                // if this group is contained by another, then we add two dummy vars and rectangles for the borders
                var b = root.bounds, c = f.getCentre(b), s = f.getSize(b) / 2, open = f.getOpen(b), close = f.getClose(b), min = c - s + padding / 2, max = c + s - padding / 2;
                root.minVar.desiredPosition = min;
                add(f.makeRect(open, close, min, padding), root.minVar);
                root.maxVar.desiredPosition = max;
                add(f.makeRect(open, close, max, padding), root.maxVar);
            }
            if (ln)
                root.leaves.forEach(function (l) { return add(l.bounds, l.variable); });
            if (gn)
                root.groups.forEach(function (g) {
                    var b = g.bounds;
                    add(f.makeRect(f.getOpen(b), f.getClose(b), f.getCentre(b), f.getSize(b)), g.minVar);
                });
            var cs = generateConstraints(rs, vs, f, minSep);
            if (gn) {
                vs.forEach(function (v) { v.cOut = [], v.cIn = []; });
                cs.forEach(function (c) { c.left.cOut.push(c), c.right.cIn.push(c); });
                root.groups.forEach(function (g) {
                    var gapAdjustment = (g.padding - f.getSize(g.bounds)) / 2;
                    g.minVar.cIn.forEach(function (c) { return c.gap += gapAdjustment; });
                    g.minVar.cOut.forEach(function (c) { c.left = g.maxVar; c.gap += gapAdjustment; });
                });
            }
            return childConstraints.concat(cs);
        }
        function generateConstraints(rs, vars, rect, minSep) {
            var i, n = rs.length;
            var N = 2 * n;
            console.assert(vars.length >= n);
            var events = new Array(N);
            for (i = 0; i < n; ++i) {
                var r = rs[i];
                var v = new Node(vars[i], r, rect.getCentre(r));
                events[i] = new Event(true, v, rect.getOpen(r));
                events[i + n] = new Event(false, v, rect.getClose(r));
            }
            events.sort(compareEvents);
            var cs = new Array();
            var scanline = makeRBTree();
            for (i = 0; i < N; ++i) {
                var e = events[i];
                var v = e.v;
                if (e.isOpen) {
                    scanline.insert(v);
                    rect.findNeighbours(v, scanline);
                }
                else {
                    // close event
                    scanline.remove(v);
                    var makeConstraint = function (l, r) {
                        var sep = (rect.getSize(l.r) + rect.getSize(r.r)) / 2 + minSep;
                        cs.push(new vpsc.Constraint(l.v, r.v, sep));
                    };
                    var visitNeighbours = function (forward, reverse, mkcon) {
                        var u, it = v[forward].iterator();
                        while ((u = it[forward]()) !== null) {
                            mkcon(u, v);
                            u[reverse].remove(v);
                        }
                    };
                    visitNeighbours("prev", "next", function (u, v) { return makeConstraint(u, v); });
                    visitNeighbours("next", "prev", function (u, v) { return makeConstraint(v, u); });
                }
            }
            console.assert(scanline.size === 0);
            return cs;
        }
        function findXNeighbours(v, scanline) {
            var f = function (forward, reverse) {
                var it = scanline.findIter(v);
                var u;
                while ((u = it[forward]()) !== null) {
                    var uovervX = u.r.overlapX(v.r);
                    if (uovervX <= 0 || uovervX <= u.r.overlapY(v.r)) {
                        v[forward].insert(u);
                        u[reverse].insert(v);
                    }
                    if (uovervX <= 0) {
                        break;
                    }
                }
            };
            f("next", "prev");
            f("prev", "next");
        }
        function findYNeighbours(v, scanline) {
            var f = function (forward, reverse) {
                var u = scanline.findIter(v)[forward]();
                if (u !== null && u.r.overlapX(v.r) > 0) {
                    v[forward].insert(u);
                    u[reverse].insert(v);
                }
            };
            f("next", "prev");
            f("prev", "next");
        }
        function generateXConstraints(rs, vars) {
            return generateConstraints(rs, vars, xRect, 1e-6);
        }
        vpsc.generateXConstraints = generateXConstraints;
        function generateYConstraints(rs, vars) {
            return generateConstraints(rs, vars, yRect, 1e-6);
        }
        vpsc.generateYConstraints = generateYConstraints;
        function generateXGroupConstraints(root) {
            return generateGroupConstraints(root, xRect, 1e-6);
        }
        vpsc.generateXGroupConstraints = generateXGroupConstraints;
        function generateYGroupConstraints(root) {
            return generateGroupConstraints(root, yRect, 1e-6);
        }
        vpsc.generateYGroupConstraints = generateYGroupConstraints;
        function removeOverlaps(rs) {
            var vs = rs.map(function (r) { return new vpsc.Variable(r.cx()); });
            var cs = vpsc.generateXConstraints(rs, vs);
            var solver = new vpsc.Solver(vs, cs);
            solver.solve();
            vs.forEach(function (v, i) { return rs[i].setXCentre(v.position()); });
            vs = rs.map(function (r) { return new vpsc.Variable(r.cy()); });
            cs = vpsc.generateYConstraints(rs, vs);
            solver = new vpsc.Solver(vs, cs);
            solver.solve();
            vs.forEach(function (v, i) { return rs[i].setYCentre(v.position()); });
        }
        vpsc.removeOverlaps = removeOverlaps;
        var IndexedVariable = (function (_super) {
            __extends(IndexedVariable, _super);
            function IndexedVariable(index, w) {
                _super.call(this, 0, w);
                this.index = index;
            }
            return IndexedVariable;
        })(vpsc.Variable);
        vpsc.IndexedVariable = IndexedVariable;
        var Projection = (function () {
            function Projection(nodes, groups, rootGroup, constraints, avoidOverlaps) {
                var _this = this;
                if (rootGroup === void 0) { rootGroup = null; }
                if (constraints === void 0) { constraints = null; }
                if (avoidOverlaps === void 0) { avoidOverlaps = false; }
                this.nodes = nodes;
                this.groups = groups;
                this.rootGroup = rootGroup;
                this.avoidOverlaps = avoidOverlaps;
                this.variables = nodes.map(function (v, i) {
                    return v.variable = new IndexedVariable(i, 1);
                });
                if (constraints)
                    this.createConstraints(constraints);
                if (avoidOverlaps && rootGroup && typeof rootGroup.groups !== 'undefined') {
                    nodes.forEach(function (v) {
                        if (!v.width || !v.height) {
                            //If undefined, default to nothing
                            v.bounds = new vpsc.Rectangle(v.x, v.x, v.y, v.y);
                            return;
                        }
                        var w2 = v.width / 2, h2 = v.height / 2;
                        v.bounds = new vpsc.Rectangle(v.x - w2, v.x + w2, v.y - h2, v.y + h2);
                    });
                    computeGroupBounds(rootGroup);
                    var i = nodes.length;
                    groups.forEach(function (g) {
                        _this.variables[i] = g.minVar = new IndexedVariable(i++, typeof g.stiffness !== "undefined" ? g.stiffness : 0.01);
                        _this.variables[i] = g.maxVar = new IndexedVariable(i++, typeof g.stiffness !== "undefined" ? g.stiffness : 0.01);
                    });
                }
            }
            Projection.prototype.createSeparation = function (c) {
                return new vpsc.Constraint(this.nodes[c.left].variable, this.nodes[c.right].variable, c.gap, typeof c.equality !== "undefined" ? c.equality : false);
            };
            Projection.prototype.makeFeasible = function (c) {
                var _this = this;
                if (!this.avoidOverlaps)
                    return;
                var axis = 'x', dim = 'width';
                if (c.axis === 'x')
                    axis = 'y', dim = 'height';
                var vs = c.offsets.map(function (o) { return _this.nodes[o.node]; }).sort(function (a, b) { return a[axis] - b[axis]; });
                var p = null;
                vs.forEach(function (v) {
                    if (p)
                        v[axis] = p[axis] + p[dim] + 1;
                    p = v;
                });
            };
            Projection.prototype.createAlignment = function (c) {
                var _this = this;
                var u = this.nodes[c.offsets[0].node].variable;
                this.makeFeasible(c);
                var cs = c.axis === 'x' ? this.xConstraints : this.yConstraints;
                c.offsets.slice(1).forEach(function (o) {
                    var v = _this.nodes[o.node].variable;
                    cs.push(new vpsc.Constraint(u, v, o.offset, true));
                });
            };
            Projection.prototype.createConstraints = function (constraints) {
                var _this = this;
                var isSep = function (c) { return typeof c.type === 'undefined' || c.type === 'separation'; };
                this.xConstraints = constraints
                    .filter(function (c) { return c.axis === "x" && isSep(c); })
                    .map(function (c) { return _this.createSeparation(c); });
                this.yConstraints = constraints
                    .filter(function (c) { return c.axis === "y" && isSep(c); })
                    .map(function (c) { return _this.createSeparation(c); });
                constraints
                    .filter(function (c) { return c.type === 'alignment'; })
                    .forEach(function (c) { return _this.createAlignment(c); });
            };
            Projection.prototype.setupVariablesAndBounds = function (x0, y0, desired, getDesired) {
                this.nodes.forEach(function (v, i) {
                    if (v.fixed) {
                        v.variable.weight = v.fixedWeight ? v.fixedWeight : 1000;
                        desired[i] = getDesired(v);
                    }
                    else {
                        v.variable.weight = 1;
                    }
                    var w = (v.width || 0) / 2, h = (v.height || 0) / 2;
                    var ix = x0[i], iy = y0[i];
                    v.bounds = new Rectangle(ix - w, ix + w, iy - h, iy + h);
                });
            };
            Projection.prototype.xProject = function (x0, y0, x) {
                if (!this.rootGroup && !(this.avoidOverlaps || this.xConstraints))
                    return;
                this.project(x0, y0, x0, x, function (v) { return v.px; }, this.xConstraints, generateXGroupConstraints, function (v) { return v.bounds.setXCentre(x[v.variable.index] = v.variable.position()); }, function (g) {
                    var xmin = x[g.minVar.index] = g.minVar.position();
                    var xmax = x[g.maxVar.index] = g.maxVar.position();
                    var p2 = g.padding / 2;
                    g.bounds.x = xmin - p2;
                    g.bounds.X = xmax + p2;
                });
            };
            Projection.prototype.yProject = function (x0, y0, y) {
                if (!this.rootGroup && !this.yConstraints)
                    return;
                this.project(x0, y0, y0, y, function (v) { return v.py; }, this.yConstraints, generateYGroupConstraints, function (v) { return v.bounds.setYCentre(y[v.variable.index] = v.variable.position()); }, function (g) {
                    var ymin = y[g.minVar.index] = g.minVar.position();
                    var ymax = y[g.maxVar.index] = g.maxVar.position();
                    var p2 = g.padding / 2;
                    g.bounds.y = ymin - p2;
                    ;
                    g.bounds.Y = ymax + p2;
                });
            };
            Projection.prototype.projectFunctions = function () {
                var _this = this;
                return [
                    function (x0, y0, x) { return _this.xProject(x0, y0, x); },
                    function (x0, y0, y) { return _this.yProject(x0, y0, y); }
                ];
            };
            Projection.prototype.project = function (x0, y0, start, desired, getDesired, cs, generateConstraints, updateNodeBounds, updateGroupBounds) {
                this.setupVariablesAndBounds(x0, y0, desired, getDesired);
                if (this.rootGroup && this.avoidOverlaps) {
                    computeGroupBounds(this.rootGroup);
                    cs = cs.concat(generateConstraints(this.rootGroup));
                }
                this.solve(this.variables, cs, start, desired);
                this.nodes.forEach(updateNodeBounds);
                if (this.rootGroup && this.avoidOverlaps) {
                    this.groups.forEach(updateGroupBounds);
                    computeGroupBounds(this.rootGroup);
                }
            };
            Projection.prototype.solve = function (vs, cs, starting, desired) {
                var solver = new vpsc.Solver(vs, cs);
                solver.setStartingPositions(starting);
                solver.setDesiredPositions(desired);
                solver.solve();
            };
            return Projection;
        })();
        vpsc.Projection = Projection;
    })(vpsc = cola.vpsc || (cola.vpsc = {}));
})(cola || (cola = {}));
///<reference path="vpsc.ts"/>
///<reference path="rectangle.ts"/>
var cola;
(function (cola) {
    var geom;
    (function (geom) {
        var Point = (function () {
            function Point() {
            }
            return Point;
        })();
        geom.Point = Point;
        var LineSegment = (function () {
            function LineSegment(x1, y1, x2, y2) {
                this.x1 = x1;
                this.y1 = y1;
                this.x2 = x2;
                this.y2 = y2;
            }
            return LineSegment;
        })();
        geom.LineSegment = LineSegment;
        var PolyPoint = (function (_super) {
            __extends(PolyPoint, _super);
            function PolyPoint() {
                _super.apply(this, arguments);
            }
            return PolyPoint;
        })(Point);
        geom.PolyPoint = PolyPoint;
        /** tests if a point is Left|On|Right of an infinite line.
         * @param points P0, P1, and P2
         * @return >0 for P2 left of the line through P0 and P1
         *            =0 for P2 on the line
         *            <0 for P2 right of the line
         */
        function isLeft(P0, P1, P2) {
            return (P1.x - P0.x) * (P2.y - P0.y) - (P2.x - P0.x) * (P1.y - P0.y);
        }
        geom.isLeft = isLeft;
        function above(p, vi, vj) {
            return isLeft(p, vi, vj) > 0;
        }
        function below(p, vi, vj) {
            return isLeft(p, vi, vj) < 0;
        }
        /**
         * returns the convex hull of a set of points using Andrew's monotone chain algorithm
         * see: http://geomalgorithms.com/a10-_hull-1.html#Monotone%20Chain
         * @param S array of points
         * @return the convex hull as an array of points
         */
        function ConvexHull(S) {
            var P = S.slice(0).sort(function (a, b) { return a.x !== b.x ? b.x - a.x : b.y - a.y; });
            var n = S.length, i;
            var minmin = 0;
            var xmin = P[0].x;
            for (i = 1; i < n; ++i) {
                if (P[i].x !== xmin)
                    break;
            }
            var minmax = i - 1;
            var H = [];
            H.push(P[minmin]); // push minmin point onto stack
            if (minmax === n - 1) {
                if (P[minmax].y !== P[minmin].y)
                    H.push(P[minmax]);
            }
            else {
                // Get the indices of points with max x-coord and min|max y-coord
                var maxmin, maxmax = n - 1;
                var xmax = P[n - 1].x;
                for (i = n - 2; i >= 0; i--)
                    if (P[i].x !== xmax)
                        break;
                maxmin = i + 1;
                // Compute the lower hull on the stack H
                i = minmax;
                while (++i <= maxmin) {
                    // the lower line joins P[minmin]  with P[maxmin]
                    if (isLeft(P[minmin], P[maxmin], P[i]) >= 0 && i < maxmin)
                        continue; // ignore P[i] above or on the lower line
                    while (H.length > 1) {
                        // test if  P[i] is left of the line at the stack top
                        if (isLeft(H[H.length - 2], H[H.length - 1], P[i]) > 0)
                            break; // P[i] is a new hull  vertex
                        else
                            H.length -= 1; // pop top point off  stack
                    }
                    if (i != minmin)
                        H.push(P[i]);
                }
                // Next, compute the upper hull on the stack H above the bottom hull
                if (maxmax != maxmin)
                    H.push(P[maxmax]); // push maxmax point onto stack
                var bot = H.length; // the bottom point of the upper hull stack
                i = maxmin;
                while (--i >= minmax) {
                    // the upper line joins P[maxmax]  with P[minmax]
                    if (isLeft(P[maxmax], P[minmax], P[i]) >= 0 && i > minmax)
                        continue; // ignore P[i] below or on the upper line
                    while (H.length > bot) {
                        // test if  P[i] is left of the line at the stack top
                        if (isLeft(H[H.length - 2], H[H.length - 1], P[i]) > 0)
                            break; // P[i] is a new hull  vertex
                        else
                            H.length -= 1; // pop top point off  stack
                    }
                    if (i != minmin)
                        H.push(P[i]); // push P[i] onto stack
                }
            }
            return H;
        }
        geom.ConvexHull = ConvexHull;
        // apply f to the points in P in clockwise order around the point p
        function clockwiseRadialSweep(p, P, f) {
            P.slice(0).sort(function (a, b) { return Math.atan2(a.y - p.y, a.x - p.x) - Math.atan2(b.y - p.y, b.x - p.x); }).forEach(f);
        }
        geom.clockwiseRadialSweep = clockwiseRadialSweep;
        function nextPolyPoint(p, ps) {
            if (p.polyIndex === ps.length - 1)
                return ps[0];
            return ps[p.polyIndex + 1];
        }
        function prevPolyPoint(p, ps) {
            if (p.polyIndex === 0)
                return ps[ps.length - 1];
            return ps[p.polyIndex - 1];
        }
        // tangent_PointPolyC(): fast binary search for tangents to a convex polygon
        //    Input:  P = a 2D point (exterior to the polygon)
        //            n = number of polygon vertices
        //            V = array of vertices for a 2D convex polygon with V[n] = V[0]
        //    Output: rtan = index of rightmost tangent point V[rtan]
        //            ltan = index of leftmost tangent point V[ltan]
        function tangent_PointPolyC(P, V) {
            return { rtan: Rtangent_PointPolyC(P, V), ltan: Ltangent_PointPolyC(P, V) };
        }
        // Rtangent_PointPolyC(): binary search for convex polygon right tangent
        //    Input:  P = a 2D point (exterior to the polygon)
        //            n = number of polygon vertices
        //            V = array of vertices for a 2D convex polygon with V[n] = V[0]
        //    Return: index "i" of rightmost tangent point V[i]
        function Rtangent_PointPolyC(P, V) {
            var n = V.length - 1;
            // use binary search for large convex polygons
            var a, b, c; // indices for edge chain endpoints
            var upA, dnC; // test for up direction of edges a and c
            // rightmost tangent = maximum for the isLeft() ordering
            // test if V[0] is a local maximum
            if (below(P, V[1], V[0]) && !above(P, V[n - 1], V[0]))
                return 0; // V[0] is the maximum tangent point
            for (a = 0, b = n;;) {
                if (b - a === 1)
                    if (above(P, V[a], V[b]))
                        return a;
                    else
                        return b;
                c = Math.floor((a + b) / 2); // midpoint of [a,b], and 0<c<n
                dnC = below(P, V[c + 1], V[c]);
                if (dnC && !above(P, V[c - 1], V[c]))
                    return c; // V[c] is the maximum tangent point
                // no max yet, so continue with the binary search
                // pick one of the two subchains [a,c] or [c,b]
                upA = above(P, V[a + 1], V[a]);
                if (upA) {
                    if (dnC)
                        b = c; // select [a,c]
                    else {
                        if (above(P, V[a], V[c]))
                            b = c; // select [a,c]
                        else
                            a = c; // select [c,b]
                    }
                }
                else {
                    if (!dnC)
                        a = c; // select [c,b]
                    else {
                        if (below(P, V[a], V[c]))
                            b = c; // select [a,c]
                        else
                            a = c; // select [c,b]
                    }
                }
            }
        }
        // Ltangent_PointPolyC(): binary search for convex polygon left tangent
        //    Input:  P = a 2D point (exterior to the polygon)
        //            n = number of polygon vertices
        //            V = array of vertices for a 2D convex polygon with V[n]=V[0]
        //    Return: index "i" of leftmost tangent point V[i]
        function Ltangent_PointPolyC(P, V) {
            var n = V.length - 1;
            // use binary search for large convex polygons
            var a, b, c; // indices for edge chain endpoints
            var dnA, dnC; // test for down direction of edges a and c
            // leftmost tangent = minimum for the isLeft() ordering
            // test if V[0] is a local minimum
            if (above(P, V[n - 1], V[0]) && !below(P, V[1], V[0]))
                return 0; // V[0] is the minimum tangent point
            for (a = 0, b = n;;) {
                if (b - a === 1)
                    if (below(P, V[a], V[b]))
                        return a;
                    else
                        return b;
                c = Math.floor((a + b) / 2); // midpoint of [a,b], and 0<c<n
                dnC = below(P, V[c + 1], V[c]);
                if (above(P, V[c - 1], V[c]) && !dnC)
                    return c; // V[c] is the minimum tangent point
                // no min yet, so continue with the binary search
                // pick one of the two subchains [a,c] or [c,b]
                dnA = below(P, V[a + 1], V[a]);
                if (dnA) {
                    if (!dnC)
                        b = c; // select [a,c]
                    else {
                        if (below(P, V[a], V[c]))
                            b = c; // select [a,c]
                        else
                            a = c; // select [c,b]
                    }
                }
                else {
                    if (dnC)
                        a = c; // select [c,b]
                    else {
                        if (above(P, V[a], V[c]))
                            b = c; // select [a,c]
                        else
                            a = c; // select [c,b]
                    }
                }
            }
        }
        // RLtangent_PolyPolyC(): get the RL tangent between two convex polygons
        //    Input:  m = number of vertices in polygon 1
        //            V = array of vertices for convex polygon 1 with V[m]=V[0]
        //            n = number of vertices in polygon 2
        //            W = array of vertices for convex polygon 2 with W[n]=W[0]
        //    Output: *t1 = index of tangent point V[t1] for polygon 1
        //            *t2 = index of tangent point W[t2] for polygon 2
        function tangent_PolyPolyC(V, W, t1, t2, cmp1, cmp2) {
            var ix1, ix2; // search indices for polygons 1 and 2
            // first get the initial vertex on each polygon
            ix1 = t1(W[0], V); // right tangent from W[0] to V
            ix2 = t2(V[ix1], W); // left tangent from V[ix1] to W
            // ping-pong linear search until it stabilizes
            var done = false; // flag when done
            while (!done) {
                done = true; // assume done until...
                while (true) {
                    if (ix1 === V.length - 1)
                        ix1 = 0;
                    if (cmp1(W[ix2], V[ix1], V[ix1 + 1]))
                        break;
                    ++ix1; // get Rtangent from W[ix2] to V
                }
                while (true) {
                    if (ix2 === 0)
                        ix2 = W.length - 1;
                    if (cmp2(V[ix1], W[ix2], W[ix2 - 1]))
                        break;
                    --ix2; // get Ltangent from V[ix1] to W
                    done = false; // not done if had to adjust this
                }
            }
            return { t1: ix1, t2: ix2 };
        }
        geom.tangent_PolyPolyC = tangent_PolyPolyC;
        function LRtangent_PolyPolyC(V, W) {
            var rl = RLtangent_PolyPolyC(W, V);
            return { t1: rl.t2, t2: rl.t1 };
        }
        geom.LRtangent_PolyPolyC = LRtangent_PolyPolyC;
        function RLtangent_PolyPolyC(V, W) {
            return tangent_PolyPolyC(V, W, Rtangent_PointPolyC, Ltangent_PointPolyC, above, below);
        }
        geom.RLtangent_PolyPolyC = RLtangent_PolyPolyC;
        function LLtangent_PolyPolyC(V, W) {
            return tangent_PolyPolyC(V, W, Ltangent_PointPolyC, Ltangent_PointPolyC, below, below);
        }
        geom.LLtangent_PolyPolyC = LLtangent_PolyPolyC;
        function RRtangent_PolyPolyC(V, W) {
            return tangent_PolyPolyC(V, W, Rtangent_PointPolyC, Rtangent_PointPolyC, above, above);
        }
        geom.RRtangent_PolyPolyC = RRtangent_PolyPolyC;
        var BiTangent = (function () {
            function BiTangent(t1, t2) {
                this.t1 = t1;
                this.t2 = t2;
            }
            return BiTangent;
        })();
        geom.BiTangent = BiTangent;
        var BiTangents = (function () {
            function BiTangents() {
            }
            return BiTangents;
        })();
        geom.BiTangents = BiTangents;
        var TVGPoint = (function (_super) {
            __extends(TVGPoint, _super);
            function TVGPoint() {
                _super.apply(this, arguments);
            }
            return TVGPoint;
        })(Point);
        geom.TVGPoint = TVGPoint;
        var VisibilityVertex = (function () {
            function VisibilityVertex(id, polyid, polyvertid, p) {
                this.id = id;
                this.polyid = polyid;
                this.polyvertid = polyvertid;
                this.p = p;
                p.vv = this;
            }
            return VisibilityVertex;
        })();
        geom.VisibilityVertex = VisibilityVertex;
        var VisibilityEdge = (function () {
            function VisibilityEdge(source, target) {
                this.source = source;
                this.target = target;
            }
            VisibilityEdge.prototype.length = function () {
                var dx = this.source.p.x - this.target.p.x;
                var dy = this.source.p.y - this.target.p.y;
                return Math.sqrt(dx * dx + dy * dy);
            };
            return VisibilityEdge;
        })();
        geom.VisibilityEdge = VisibilityEdge;
        var TangentVisibilityGraph = (function () {
            function TangentVisibilityGraph(P, g0) {
                this.P = P;
                this.V = [];
                this.E = [];
                if (!g0) {
                    var n = P.length;
                    for (var i = 0; i < n; i++) {
                        var p = P[i];
                        for (var j = 0; j < p.length; ++j) {
                            var pj = p[j], vv = new VisibilityVertex(this.V.length, i, j, pj);
                            this.V.push(vv);
                            if (j > 0)
                                this.E.push(new VisibilityEdge(p[j - 1].vv, vv));
                        }
                    }
                    for (var i = 0; i < n - 1; i++) {
                        var Pi = P[i];
                        for (var j = i + 1; j < n; j++) {
                            var Pj = P[j], t = geom.tangents(Pi, Pj);
                            for (var q in t) {
                                var c = t[q], source = Pi[c.t1], target = Pj[c.t2];
                                this.addEdgeIfVisible(source, target, i, j);
                            }
                        }
                    }
                }
                else {
                    this.V = g0.V.slice(0);
                    this.E = g0.E.slice(0);
                }
            }
            TangentVisibilityGraph.prototype.addEdgeIfVisible = function (u, v, i1, i2) {
                if (!this.intersectsPolys(new LineSegment(u.x, u.y, v.x, v.y), i1, i2)) {
                    this.E.push(new VisibilityEdge(u.vv, v.vv));
                }
            };
            TangentVisibilityGraph.prototype.addPoint = function (p, i1) {
                var n = this.P.length;
                this.V.push(new VisibilityVertex(this.V.length, n, 0, p));
                for (var i = 0; i < n; ++i) {
                    if (i === i1)
                        continue;
                    var poly = this.P[i], t = tangent_PointPolyC(p, poly);
                    this.addEdgeIfVisible(p, poly[t.ltan], i1, i);
                    this.addEdgeIfVisible(p, poly[t.rtan], i1, i);
                }
                return p.vv;
            };
            TangentVisibilityGraph.prototype.intersectsPolys = function (l, i1, i2) {
                for (var i = 0, n = this.P.length; i < n; ++i) {
                    if (i != i1 && i != i2 && intersects(l, this.P[i]).length > 0) {
                        return true;
                    }
                }
                return false;
            };
            return TangentVisibilityGraph;
        })();
        geom.TangentVisibilityGraph = TangentVisibilityGraph;
        function intersects(l, P) {
            var ints = [];
            for (var i = 1, n = P.length; i < n; ++i) {
                var int = cola.vpsc.Rectangle.lineIntersection(l.x1, l.y1, l.x2, l.y2, P[i - 1].x, P[i - 1].y, P[i].x, P[i].y);
                if (int)
                    ints.push(int);
            }
            return ints;
        }
        function tangents(V, W) {
            var m = V.length - 1, n = W.length - 1;
            var bt = new BiTangents();
            for (var i = 0; i < m; ++i) {
                for (var j = 0; j < n; ++j) {
                    var v1 = V[i == 0 ? m - 1 : i - 1];
                    var v2 = V[i];
                    var v3 = V[i + 1];
                    var w1 = W[j == 0 ? n - 1 : j - 1];
                    var w2 = W[j];
                    var w3 = W[j + 1];
                    var v1v2w2 = isLeft(v1, v2, w2);
                    var v2w1w2 = isLeft(v2, w1, w2);
                    var v2w2w3 = isLeft(v2, w2, w3);
                    var w1w2v2 = isLeft(w1, w2, v2);
                    var w2v1v2 = isLeft(w2, v1, v2);
                    var w2v2v3 = isLeft(w2, v2, v3);
                    if (v1v2w2 >= 0 && v2w1w2 >= 0 && v2w2w3 < 0
                        && w1w2v2 >= 0 && w2v1v2 >= 0 && w2v2v3 < 0) {
                        bt.ll = new BiTangent(i, j);
                    }
                    else if (v1v2w2 <= 0 && v2w1w2 <= 0 && v2w2w3 > 0
                        && w1w2v2 <= 0 && w2v1v2 <= 0 && w2v2v3 > 0) {
                        bt.rr = new BiTangent(i, j);
                    }
                    else if (v1v2w2 <= 0 && v2w1w2 > 0 && v2w2w3 <= 0
                        && w1w2v2 >= 0 && w2v1v2 < 0 && w2v2v3 >= 0) {
                        bt.rl = new BiTangent(i, j);
                    }
                    else if (v1v2w2 >= 0 && v2w1w2 < 0 && v2w2w3 >= 0
                        && w1w2v2 <= 0 && w2v1v2 > 0 && w2v2v3 <= 0) {
                        bt.lr = new BiTangent(i, j);
                    }
                }
            }
            return bt;
        }
        geom.tangents = tangents;
        function isPointInsidePoly(p, poly) {
            for (var i = 1, n = poly.length; i < n; ++i)
                if (below(poly[i - 1], poly[i], p))
                    return false;
            return true;
        }
        function isAnyPInQ(p, q) {
            return !p.every(function (v) { return !isPointInsidePoly(v, q); });
        }
        function polysOverlap(p, q) {
            if (isAnyPInQ(p, q))
                return true;
            if (isAnyPInQ(q, p))
                return true;
            for (var i = 1, n = p.length; i < n; ++i) {
                var v = p[i], u = p[i - 1];
                if (intersects(new LineSegment(u.x, u.y, v.x, v.y), q).length > 0)
                    return true;
            }
            return false;
        }
        geom.polysOverlap = polysOverlap;
    })(geom = cola.geom || (cola.geom = {}));
})(cola || (cola = {}));
/**
 * @module cola
 */
var cola;
(function (cola) {
    /**
     * Descent respects a collection of locks over nodes that should not move
     * @class Locks
     */
    var Locks = (function () {
        function Locks() {
            this.locks = {};
        }
        /**
         * add a lock on the node at index id
         * @method add
         * @param id index of node to be locked
         * @param x required position for node
         */
        Locks.prototype.add = function (id, x) {
            /* DEBUG
                        if (isNaN(x[0]) || isNaN(x[1])) debugger;
            DEBUG */
            this.locks[id] = x;
        };
        /**
         * @method clear clear all locks
         */
        Locks.prototype.clear = function () {
            this.locks = {};
        };
        /**
         * @isEmpty
         * @returns false if no locks exist
         */
        Locks.prototype.isEmpty = function () {
            for (var l in this.locks)
                return false;
            return true;
        };
        /**
         * perform an operation on each lock
         * @apply
         */
        Locks.prototype.apply = function (f) {
            for (var l in this.locks) {
                f(l, this.locks[l]);
            }
        };
        return Locks;
    })();
    cola.Locks = Locks;
    /**
     * Uses a gradient descent approach to reduce a stress or p-stress goal function over a graph with specified ideal edge lengths or a square matrix of dissimilarities.
     * The standard stress function over a graph nodes with position vectors x,y,z is (mathematica input):
     *   stress[x_,y_,z_,D_,w_]:=Sum[w[[i,j]] (length[x[[i]],y[[i]],z[[i]],x[[j]],y[[j]],z[[j]]]-d[[i,j]])^2,{i,Length[x]-1},{j,i+1,Length[x]}]
     * where: D is a square matrix of ideal separations between nodes, w is matrix of weights for those separations
     *        length[x1_, y1_, z1_, x2_, y2_, z2_] = Sqrt[(x1 - x2)^2 + (y1 - y2)^2 + (z1 - z2)^2]
     * below, we use wij = 1/(Dij^2)
     *
     * @class Descent
     */
    var Descent = (function () {
        /**
         * @method constructor
         * @param x {number[][]} initial coordinates for nodes
         * @param D {number[][]} matrix of desired distances between pairs of nodes
         * @param G {number[][]} [default=null] if specified, G is a matrix of weights for goal terms between pairs of nodes.
         * If G[i][j] > 1 and the separation between nodes i and j is greater than their ideal distance, then there is no contribution for this pair to the goal
         * If G[i][j] <= 1 then it is used as a weighting on the contribution of the variance between ideal and actual separation between i and j to the goal function
         */
        function Descent(x, D, G) {
            if (G === void 0) { G = null; }
            this.D = D;
            this.G = G;
            this.threshold = 0.0001;
            // Parameters for grid snap stress.
            // TODO: Make a pluggable "StressTerm" class instead of this
            // mess.
            this.numGridSnapNodes = 0;
            this.snapGridSize = 100;
            this.snapStrength = 1000;
            this.scaleSnapByMaxH = false;
            this.random = new PseudoRandom();
            this.project = null;
            this.x = x;
            this.k = x.length; // dimensionality
            var n = this.n = x[0].length; // number of nodes
            this.H = new Array(this.k);
            this.g = new Array(this.k);
            this.Hd = new Array(this.k);
            this.a = new Array(this.k);
            this.b = new Array(this.k);
            this.c = new Array(this.k);
            this.d = new Array(this.k);
            this.e = new Array(this.k);
            this.ia = new Array(this.k);
            this.ib = new Array(this.k);
            this.xtmp = new Array(this.k);
            this.locks = new Locks();
            this.minD = Number.MAX_VALUE;
            var i = n, j;
            while (i--) {
                j = n;
                while (--j > i) {
                    var d = D[i][j];
                    if (d > 0 && d < this.minD) {
                        this.minD = d;
                    }
                }
            }
            if (this.minD === Number.MAX_VALUE)
                this.minD = 1;
            i = this.k;
            while (i--) {
                this.g[i] = new Array(n);
                this.H[i] = new Array(n);
                j = n;
                while (j--) {
                    this.H[i][j] = new Array(n);
                }
                this.Hd[i] = new Array(n);
                this.a[i] = new Array(n);
                this.b[i] = new Array(n);
                this.c[i] = new Array(n);
                this.d[i] = new Array(n);
                this.e[i] = new Array(n);
                this.ia[i] = new Array(n);
                this.ib[i] = new Array(n);
                this.xtmp[i] = new Array(n);
            }
        }
        Descent.createSquareMatrix = function (n, f) {
            var M = new Array(n);
            for (var i = 0; i < n; ++i) {
                M[i] = new Array(n);
                for (var j = 0; j < n; ++j) {
                    M[i][j] = f(i, j);
                }
            }
            return M;
        };
        Descent.prototype.offsetDir = function () {
            var _this = this;
            var u = new Array(this.k);
            var l = 0;
            for (var i = 0; i < this.k; ++i) {
                var x = u[i] = this.random.getNextBetween(0.01, 1) - 0.5;
                l += x * x;
            }
            l = Math.sqrt(l);
            return u.map(function (x) { return x *= _this.minD / l; });
        };
        // compute first and second derivative information storing results in this.g and this.H
        Descent.prototype.computeDerivatives = function (x) {
            var _this = this;
            var n = this.n;
            if (n < 1)
                return;
            var i;
            /* DEBUG
                        for (var u: number = 0; u < n; ++u)
                            for (i = 0; i < this.k; ++i)
                                if (isNaN(x[i][u])) debugger;
            DEBUG */
            var d = new Array(this.k);
            var d2 = new Array(this.k);
            var Huu = new Array(this.k);
            var maxH = 0;
            for (var u = 0; u < n; ++u) {
                for (i = 0; i < this.k; ++i)
                    Huu[i] = this.g[i][u] = 0;
                for (var v = 0; v < n; ++v) {
                    if (u === v)
                        continue;
                    // The following loop randomly displaces nodes that are at identical positions
                    var maxDisplaces = n; // avoid infinite loop in the case of numerical issues, such as huge values
                    while (maxDisplaces--) {
                        var sd2 = 0;
                        for (i = 0; i < this.k; ++i) {
                            var dx = d[i] = x[i][u] - x[i][v];
                            sd2 += d2[i] = dx * dx;
                        }
                        if (sd2 > 1e-9)
                            break;
                        var rd = this.offsetDir();
                        for (i = 0; i < this.k; ++i)
                            x[i][v] += rd[i];
                    }
                    var l = Math.sqrt(sd2);
                    var D = this.D[u][v];
                    var weight = this.G != null ? this.G[u][v] : 1;
                    if (weight > 1 && l > D || !isFinite(D)) {
                        for (i = 0; i < this.k; ++i)
                            this.H[i][u][v] = 0;
                        continue;
                    }
                    if (weight > 1) {
                        weight = 1;
                    }
                    var D2 = D * D;
                    var gs = 2 * weight * (l - D) / (D2 * l);
                    var l3 = l * l * l;
                    var hs = 2 * -weight / (D2 * l3);
                    if (!isFinite(gs))
                        console.log(gs);
                    for (i = 0; i < this.k; ++i) {
                        this.g[i][u] += d[i] * gs;
                        Huu[i] -= this.H[i][u][v] = hs * (l3 + D * (d2[i] - sd2) + l * sd2);
                    }
                }
                for (i = 0; i < this.k; ++i)
                    maxH = Math.max(maxH, this.H[i][u][u] = Huu[i]);
            }
            // Grid snap forces
            var r = this.snapGridSize / 2;
            var g = this.snapGridSize;
            var w = this.snapStrength;
            var k = w / (r * r);
            var numNodes = this.numGridSnapNodes;
            //var numNodes = n;
            for (var u = 0; u < numNodes; ++u) {
                for (i = 0; i < this.k; ++i) {
                    var xiu = this.x[i][u];
                    var m = xiu / g;
                    var f = m % 1;
                    var q = m - f;
                    var a = Math.abs(f);
                    var dx = (a <= 0.5) ? xiu - q * g :
                        (xiu > 0) ? xiu - (q + 1) * g : xiu - (q - 1) * g;
                    if (-r < dx && dx <= r) {
                        if (this.scaleSnapByMaxH) {
                            this.g[i][u] += maxH * k * dx;
                            this.H[i][u][u] += maxH * k;
                        }
                        else {
                            this.g[i][u] += k * dx;
                            this.H[i][u][u] += k;
                        }
                    }
                }
            }
            if (!this.locks.isEmpty()) {
                this.locks.apply(function (u, p) {
                    for (i = 0; i < _this.k; ++i) {
                        _this.H[i][u][u] += maxH;
                        _this.g[i][u] -= maxH * (p[i] - x[i][u]);
                    }
                });
            }
            /* DEBUG
                        for (var u: number = 0; u < n; ++u)
                            for (i = 0; i < this.k; ++i) {
                                if (isNaN(this.g[i][u])) debugger;
                                for (var v: number = 0; v < n; ++v)
                                    if (isNaN(this.H[i][u][v])) debugger;
                            }
            DEBUG */
        };
        Descent.dotProd = function (a, b) {
            var x = 0, i = a.length;
            while (i--)
                x += a[i] * b[i];
            return x;
        };
        // result r = matrix m * vector v
        Descent.rightMultiply = function (m, v, r) {
            var i = m.length;
            while (i--)
                r[i] = Descent.dotProd(m[i], v);
        };
        // computes the optimal step size to take in direction d using the
        // derivative information in this.g and this.H
        // returns the scalar multiplier to apply to d to get the optimal step
        Descent.prototype.computeStepSize = function (d) {
            var numerator = 0, denominator = 0;
            for (var i = 0; i < this.k; ++i) {
                numerator += Descent.dotProd(this.g[i], d[i]);
                Descent.rightMultiply(this.H[i], d[i], this.Hd[i]);
                denominator += Descent.dotProd(d[i], this.Hd[i]);
            }
            if (denominator === 0 || !isFinite(denominator))
                return 0;
            return 1 * numerator / denominator;
        };
        Descent.prototype.reduceStress = function () {
            this.computeDerivatives(this.x);
            var alpha = this.computeStepSize(this.g);
            for (var i = 0; i < this.k; ++i) {
                this.takeDescentStep(this.x[i], this.g[i], alpha);
            }
            return this.computeStress();
        };
        Descent.copy = function (a, b) {
            var m = a.length, n = b[0].length;
            for (var i = 0; i < m; ++i) {
                for (var j = 0; j < n; ++j) {
                    b[i][j] = a[i][j];
                }
            }
        };
        // takes a step of stepSize * d from x0, and then project against any constraints.
        // result is returned in r.
        // x0: starting positions
        // r: result positions will be returned here
        // d: unconstrained descent vector
        // stepSize: amount to step along d
        Descent.prototype.stepAndProject = function (x0, r, d, stepSize) {
            Descent.copy(x0, r);
            this.takeDescentStep(r[0], d[0], stepSize);
            if (this.project)
                this.project[0](x0[0], x0[1], r[0]);
            this.takeDescentStep(r[1], d[1], stepSize);
            if (this.project)
                this.project[1](r[0], x0[1], r[1]);
            // todo: allow projection against constraints in higher dimensions
            for (var i = 2; i < this.k; i++)
                this.takeDescentStep(r[i], d[i], stepSize);
            // the following makes locks extra sticky... but hides the result of the projection from the consumer
            //if (!this.locks.isEmpty()) {
            //    this.locks.apply((u, p) => {
            //        for (var i = 0; i < this.k; i++) {
            //            r[i][u] = p[i];
            //        }
            //    });
            //}
        };
        Descent.mApply = function (m, n, f) {
            var i = m;
            while (i-- > 0) {
                var j = n;
                while (j-- > 0)
                    f(i, j);
            }
        };
        Descent.prototype.matrixApply = function (f) {
            Descent.mApply(this.k, this.n, f);
        };
        Descent.prototype.computeNextPosition = function (x0, r) {
            var _this = this;
            this.computeDerivatives(x0);
            var alpha = this.computeStepSize(this.g);
            this.stepAndProject(x0, r, this.g, alpha);
            /* DEBUG
                        for (var u: number = 0; u < this.n; ++u)
                            for (var i = 0; i < this.k; ++i)
                                if (isNaN(r[i][u])) debugger;
            DEBUG */
            if (this.project) {
                this.matrixApply(function (i, j) { return _this.e[i][j] = x0[i][j] - r[i][j]; });
                var beta = this.computeStepSize(this.e);
                beta = Math.max(0.2, Math.min(beta, 1));
                this.stepAndProject(x0, r, this.e, beta);
            }
        };
        Descent.prototype.run = function (iterations) {
            var stress = Number.MAX_VALUE, converged = false;
            while (!converged && iterations-- > 0) {
                var s = this.rungeKutta();
                converged = Math.abs(stress / s - 1) < this.threshold;
                stress = s;
            }
            return stress;
        };
        Descent.prototype.rungeKutta = function () {
            var _this = this;
            this.computeNextPosition(this.x, this.a);
            Descent.mid(this.x, this.a, this.ia);
            this.computeNextPosition(this.ia, this.b);
            Descent.mid(this.x, this.b, this.ib);
            this.computeNextPosition(this.ib, this.c);
            this.computeNextPosition(this.c, this.d);
            var disp = 0;
            this.matrixApply(function (i, j) {
                var x = (_this.a[i][j] + 2.0 * _this.b[i][j] + 2.0 * _this.c[i][j] + _this.d[i][j]) / 6.0, d = _this.x[i][j] - x;
                disp += d * d;
                _this.x[i][j] = x;
            });
            return disp;
        };
        Descent.mid = function (a, b, m) {
            Descent.mApply(a.length, a[0].length, function (i, j) {
                return m[i][j] = a[i][j] + (b[i][j] - a[i][j]) / 2.0;
            });
        };
        Descent.prototype.takeDescentStep = function (x, d, stepSize) {
            for (var i = 0; i < this.n; ++i) {
                x[i] = x[i] - stepSize * d[i];
            }
        };
        Descent.prototype.computeStress = function () {
            var stress = 0;
            for (var u = 0, nMinus1 = this.n - 1; u < nMinus1; ++u) {
                for (var v = u + 1, n = this.n; v < n; ++v) {
                    var l = 0;
                    for (var i = 0; i < this.k; ++i) {
                        var dx = this.x[i][u] - this.x[i][v];
                        l += dx * dx;
                    }
                    l = Math.sqrt(l);
                    var d = this.D[u][v];
                    if (!isFinite(d))
                        continue;
                    var rl = d - l;
                    var d2 = d * d;
                    stress += rl * rl / d2;
                }
            }
            return stress;
        };
        Descent.zeroDistance = 1e-10;
        return Descent;
    })();
    cola.Descent = Descent;
    // Linear congruential pseudo random number generator
    var PseudoRandom = (function () {
        function PseudoRandom(seed) {
            if (seed === void 0) { seed = 1; }
            this.seed = seed;
            this.a = 214013;
            this.c = 2531011;
            this.m = 2147483648;
            this.range = 32767;
        }
        // random real between 0 and 1
        PseudoRandom.prototype.getNext = function () {
            this.seed = (this.seed * this.a + this.c) % this.m;
            return (this.seed >> 16) / this.range;
        };
        // random real between min and max
        PseudoRandom.prototype.getNextBetween = function (min, max) {
            return min + this.getNext() * (max - min);
        };
        return PseudoRandom;
    })();
    cola.PseudoRandom = PseudoRandom;
})(cola || (cola = {}));
var cola;
(function (cola) {
    var powergraph;
    (function (powergraph) {
        var PowerEdge = (function () {
            function PowerEdge(source, target, type) {
                this.source = source;
                this.target = target;
                this.type = type;
            }
            return PowerEdge;
        })();
        powergraph.PowerEdge = PowerEdge;
        var Configuration = (function () {
            function Configuration(n, edges, linkAccessor, rootGroup) {
                var _this = this;
                this.linkAccessor = linkAccessor;
                this.modules = new Array(n);
                this.roots = [];
                if (rootGroup) {
                    this.initModulesFromGroup(rootGroup);
                }
                else {
                    this.roots.push(new ModuleSet());
                    for (var i = 0; i < n; ++i)
                        this.roots[0].add(this.modules[i] = new Module(i));
                }
                this.R = edges.length;
                edges.forEach(function (e) {
                    var s = _this.modules[linkAccessor.getSourceIndex(e)], t = _this.modules[linkAccessor.getTargetIndex(e)], type = linkAccessor.getType(e);
                    s.outgoing.add(type, t);
                    t.incoming.add(type, s);
                });
            }
            Configuration.prototype.initModulesFromGroup = function (group) {
                var moduleSet = new ModuleSet();
                this.roots.push(moduleSet);
                for (var i = 0; i < group.leaves.length; ++i) {
                    var node = group.leaves[i];
                    var module = new Module(node.id);
                    this.modules[node.id] = module;
                    moduleSet.add(module);
                }
                if (group.groups) {
                    for (var j = 0; j < group.groups.length; ++j) {
                        var child = group.groups[j];
                        // Propagate group properties (like padding, stiffness, ...) as module definition so that the generated power graph group will inherit it
                        var definition = {};
                        for (var prop in child)
                            if (prop !== "leaves" && prop !== "groups" && child.hasOwnProperty(prop))
                                definition[prop] = child[prop];
                        // Use negative module id to avoid clashes between predefined and generated modules
                        moduleSet.add(new Module(-1 - j, new LinkSets(), new LinkSets(), this.initModulesFromGroup(child), definition));
                    }
                }
                return moduleSet;
            };
            // merge modules a and b keeping track of their power edges and removing the from roots
            Configuration.prototype.merge = function (a, b, k) {
                if (k === void 0) { k = 0; }
                var inInt = a.incoming.intersection(b.incoming), outInt = a.outgoing.intersection(b.outgoing);
                var children = new ModuleSet();
                children.add(a);
                children.add(b);
                var m = new Module(this.modules.length, outInt, inInt, children);
                this.modules.push(m);
                var update = function (s, i, o) {
                    s.forAll(function (ms, linktype) {
                        ms.forAll(function (n) {
                            var nls = n[i];
                            nls.add(linktype, m);
                            nls.remove(linktype, a);
                            nls.remove(linktype, b);
                            a[o].remove(linktype, n);
                            b[o].remove(linktype, n);
                        });
                    });
                };
                update(outInt, "incoming", "outgoing");
                update(inInt, "outgoing", "incoming");
                this.R -= inInt.count() + outInt.count();
                this.roots[k].remove(a);
                this.roots[k].remove(b);
                this.roots[k].add(m);
                return m;
            };
            Configuration.prototype.rootMerges = function (k) {
                if (k === void 0) { k = 0; }
                var rs = this.roots[k].modules();
                var n = rs.length;
                var merges = new Array(n * (n - 1));
                var ctr = 0;
                for (var i = 0, i_ = n - 1; i < i_; ++i) {
                    for (var j = i + 1; j < n; ++j) {
                        var a = rs[i], b = rs[j];
                        merges[ctr] = { id: ctr, nEdges: this.nEdges(a, b), a: a, b: b };
                        ctr++;
                    }
                }
                return merges;
            };
            Configuration.prototype.greedyMerge = function () {
                for (var i = 0; i < this.roots.length; ++i) {
                    // Handle single nested module case
                    if (this.roots[i].modules().length < 2)
                        continue;
                    // find the merge that allows for the most edges to be removed.  secondary ordering based on arbitrary id (for predictability)
                    var ms = this.rootMerges(i).sort(function (a, b) { return a.nEdges == b.nEdges ? a.id - b.id : a.nEdges - b.nEdges; });
                    var m = ms[0];
                    if (m.nEdges >= this.R)
                        continue;
                    this.merge(m.a, m.b, i);
                    return true;
                }
            };
            Configuration.prototype.nEdges = function (a, b) {
                var inInt = a.incoming.intersection(b.incoming), outInt = a.outgoing.intersection(b.outgoing);
                return this.R - inInt.count() - outInt.count();
            };
            Configuration.prototype.getGroupHierarchy = function (retargetedEdges) {
                var _this = this;
                var groups = [];
                var root = {};
                toGroups(this.roots[0], root, groups);
                var es = this.allEdges();
                es.forEach(function (e) {
                    var a = _this.modules[e.source];
                    var b = _this.modules[e.target];
                    retargetedEdges.push(new PowerEdge(typeof a.gid === "undefined" ? e.source : groups[a.gid], typeof b.gid === "undefined" ? e.target : groups[b.gid], e.type));
                });
                return groups;
            };
            Configuration.prototype.allEdges = function () {
                var es = [];
                Configuration.getEdges(this.roots[0], es);
                return es;
            };
            Configuration.getEdges = function (modules, es) {
                modules.forAll(function (m) {
                    m.getEdges(es);
                    Configuration.getEdges(m.children, es);
                });
            };
            return Configuration;
        })();
        powergraph.Configuration = Configuration;
        function toGroups(modules, group, groups) {
            modules.forAll(function (m) {
                if (m.isLeaf()) {
                    if (!group.leaves)
                        group.leaves = [];
                    group.leaves.push(m.id);
                }
                else {
                    var g = group;
                    m.gid = groups.length;
                    if (!m.isIsland() || m.isPredefined()) {
                        g = { id: m.gid };
                        if (m.isPredefined())
                            // Apply original group properties
                            for (var prop in m.definition)
                                g[prop] = m.definition[prop];
                        if (!group.groups)
                            group.groups = [];
                        group.groups.push(m.gid);
                        groups.push(g);
                    }
                    toGroups(m.children, g, groups);
                }
            });
        }
        var Module = (function () {
            function Module(id, outgoing, incoming, children, definition) {
                if (outgoing === void 0) { outgoing = new LinkSets(); }
                if (incoming === void 0) { incoming = new LinkSets(); }
                if (children === void 0) { children = new ModuleSet(); }
                this.id = id;
                this.outgoing = outgoing;
                this.incoming = incoming;
                this.children = children;
                this.definition = definition;
            }
            Module.prototype.getEdges = function (es) {
                var _this = this;
                this.outgoing.forAll(function (ms, edgetype) {
                    ms.forAll(function (target) {
                        es.push(new PowerEdge(_this.id, target.id, edgetype));
                    });
                });
            };
            Module.prototype.isLeaf = function () {
                return this.children.count() === 0;
            };
            Module.prototype.isIsland = function () {
                return this.outgoing.count() === 0 && this.incoming.count() === 0;
            };
            Module.prototype.isPredefined = function () {
                return typeof this.definition !== "undefined";
            };
            return Module;
        })();
        powergraph.Module = Module;
        function intersection(m, n) {
            var i = {};
            for (var v in m)
                if (v in n)
                    i[v] = m[v];
            return i;
        }
        var ModuleSet = (function () {
            function ModuleSet() {
                this.table = {};
            }
            ModuleSet.prototype.count = function () {
                return Object.keys(this.table).length;
            };
            ModuleSet.prototype.intersection = function (other) {
                var result = new ModuleSet();
                result.table = intersection(this.table, other.table);
                return result;
            };
            ModuleSet.prototype.intersectionCount = function (other) {
                return this.intersection(other).count();
            };
            ModuleSet.prototype.contains = function (id) {
                return id in this.table;
            };
            ModuleSet.prototype.add = function (m) {
                this.table[m.id] = m;
            };
            ModuleSet.prototype.remove = function (m) {
                delete this.table[m.id];
            };
            ModuleSet.prototype.forAll = function (f) {
                for (var mid in this.table) {
                    f(this.table[mid]);
                }
            };
            ModuleSet.prototype.modules = function () {
                var vs = [];
                this.forAll(function (m) {
                    if (!m.isPredefined())
                        vs.push(m);
                });
                return vs;
            };
            return ModuleSet;
        })();
        powergraph.ModuleSet = ModuleSet;
        var LinkSets = (function () {
            function LinkSets() {
                this.sets = {};
                this.n = 0;
            }
            LinkSets.prototype.count = function () {
                return this.n;
            };
            LinkSets.prototype.contains = function (id) {
                var result = false;
                this.forAllModules(function (m) {
                    if (!result && m.id == id) {
                        result = true;
                    }
                });
                return result;
            };
            LinkSets.prototype.add = function (linktype, m) {
                var s = linktype in this.sets ? this.sets[linktype] : this.sets[linktype] = new ModuleSet();
                s.add(m);
                ++this.n;
            };
            LinkSets.prototype.remove = function (linktype, m) {
                var ms = this.sets[linktype];
                ms.remove(m);
                if (ms.count() === 0) {
                    delete this.sets[linktype];
                }
                --this.n;
            };
            LinkSets.prototype.forAll = function (f) {
                for (var linktype in this.sets) {
                    f(this.sets[linktype], linktype);
                }
            };
            LinkSets.prototype.forAllModules = function (f) {
                this.forAll(function (ms, lt) { return ms.forAll(f); });
            };
            LinkSets.prototype.intersection = function (other) {
                var result = new LinkSets();
                this.forAll(function (ms, lt) {
                    if (lt in other.sets) {
                        var i = ms.intersection(other.sets[lt]), n = i.count();
                        if (n > 0) {
                            result.sets[lt] = i;
                            result.n += n;
                        }
                    }
                });
                return result;
            };
            return LinkSets;
        })();
        powergraph.LinkSets = LinkSets;
        function intersectionCount(m, n) {
            return Object.keys(intersection(m, n)).length;
        }
        function getGroups(nodes, links, la, rootGroup) {
            var n = nodes.length, c = new powergraph.Configuration(n, links, la, rootGroup);
            while (c.greedyMerge())
                ;
            var powerEdges = [];
            var g = c.getGroupHierarchy(powerEdges);
            powerEdges.forEach(function (e) {
                var f = function (end) {
                    var g = e[end];
                    if (typeof g == "number")
                        e[end] = nodes[g];
                };
                f("source");
                f("target");
            });
            return { groups: g, powerEdges: powerEdges };
        }
        powergraph.getGroups = getGroups;
    })(powergraph = cola.powergraph || (cola.powergraph = {}));
})(cola || (cola = {}));
/**
 * @module cola
 */
var cola;
(function (cola) {
    // compute the size of the union of two sets a and b
    function unionCount(a, b) {
        var u = {};
        for (var i in a)
            u[i] = {};
        for (var i in b)
            u[i] = {};
        return Object.keys(u).length;
    }
    // compute the size of the intersection of two sets a and b
    function intersectionCount(a, b) {
        var n = 0;
        for (var i in a)
            if (typeof b[i] !== 'undefined')
                ++n;
        return n;
    }
    function getNeighbours(links, la) {
        var neighbours = {};
        var addNeighbours = function (u, v) {
            if (typeof neighbours[u] === 'undefined')
                neighbours[u] = {};
            neighbours[u][v] = {};
        };
        links.forEach(function (e) {
            var u = la.getSourceIndex(e), v = la.getTargetIndex(e);
            addNeighbours(u, v);
            addNeighbours(v, u);
        });
        return neighbours;
    }
    // modify the lengths of the specified links by the result of function f weighted by w
    function computeLinkLengths(links, w, f, la) {
        var neighbours = getNeighbours(links, la);
        links.forEach(function (l) {
            var a = neighbours[la.getSourceIndex(l)];
            var b = neighbours[la.getTargetIndex(l)];
            la.setLength(l, 1 + w * f(a, b));
        });
    }
    /** modify the specified link lengths based on the symmetric difference of their neighbours
     * @class symmetricDiffLinkLengths
     */
    function symmetricDiffLinkLengths(links, la, w) {
        if (w === void 0) { w = 1; }
        computeLinkLengths(links, w, function (a, b) { return Math.sqrt(unionCount(a, b) - intersectionCount(a, b)); }, la);
    }
    cola.symmetricDiffLinkLengths = symmetricDiffLinkLengths;
    /** modify the specified links lengths based on the jaccard difference between their neighbours
     * @class jaccardLinkLengths
     */
    function jaccardLinkLengths(links, la, w) {
        if (w === void 0) { w = 1; }
        computeLinkLengths(links, w, function (a, b) {
            return Math.min(Object.keys(a).length, Object.keys(b).length) < 1.1 ? 0 : intersectionCount(a, b) / unionCount(a, b);
        }, la);
    }
    cola.jaccardLinkLengths = jaccardLinkLengths;
    /** generate separation constraints for all edges unless both their source and sink are in the same strongly connected component
     * @class generateDirectedEdgeConstraints
     */
    function generateDirectedEdgeConstraints(n, links, axis, la) {
        var components = stronglyConnectedComponents(n, links, la);
        var nodes = {};
        components.forEach(function (c, i) {
            return c.forEach(function (v) { return nodes[v] = i; });
        });
        var constraints = [];
        links.forEach(function (l) {
            var ui = la.getSourceIndex(l), vi = la.getTargetIndex(l), u = nodes[ui], v = nodes[vi];
            if (u !== v) {
                constraints.push({
                    axis: axis,
                    left: ui,
                    right: vi,
                    gap: la.getMinSeparation(l)
                });
            }
        });
        return constraints;
    }
    cola.generateDirectedEdgeConstraints = generateDirectedEdgeConstraints;
    /**
     * Tarjan's strongly connected components algorithm for directed graphs
     * returns an array of arrays of node indicies in each of the strongly connected components.
     * a vertex not in a SCC of two or more nodes is it's own SCC.
     * adaptation of https://en.wikipedia.org/wiki/Tarjan%27s_strongly_connected_components_algorithm
     */
    function stronglyConnectedComponents(numVertices, edges, la) {
        var nodes = [];
        var index = 0;
        var stack = [];
        var components = [];
        function strongConnect(v) {
            // Set the depth index for v to the smallest unused index
            v.index = v.lowlink = index++;
            stack.push(v);
            v.onStack = true;
            // Consider successors of v
            for (var _i = 0, _a = v.out; _i < _a.length; _i++) {
                var w = _a[_i];
                if (typeof w.index === 'undefined') {
                    // Successor w has not yet been visited; recurse on it
                    strongConnect(w);
                    v.lowlink = Math.min(v.lowlink, w.lowlink);
                }
                else if (w.onStack) {
                    // Successor w is in stack S and hence in the current SCC
                    v.lowlink = Math.min(v.lowlink, w.index);
                }
            }
            // If v is a root node, pop the stack and generate an SCC
            if (v.lowlink === v.index) {
                // start a new strongly connected component
                var component = [];
                while (stack.length) {
                    w = stack.pop();
                    w.onStack = false;
                    //add w to current strongly connected component
                    component.push(w);
                    if (w === v)
                        break;
                }
                // output the current strongly connected component
                components.push(component.map(function (v) { return v.id; }));
            }
        }
        for (var i = 0; i < numVertices; i++) {
            nodes.push({ id: i, out: [] });
        }
        for (var _i = 0; _i < edges.length; _i++) {
            var e = edges[_i];
            var v_1 = nodes[la.getSourceIndex(e)], w = nodes[la.getTargetIndex(e)];
            v_1.out.push(w);
        }
        for (var _a = 0; _a < nodes.length; _a++) {
            var v = nodes[_a];
            if (typeof v.index === 'undefined')
                strongConnect(v);
        }
        return components;
    }
    cola.stronglyConnectedComponents = stronglyConnectedComponents;
})(cola || (cola = {}));
var PairingHeap = (function () {
    // from: https://gist.github.com/nervoussystem
    //{elem:object, subheaps:[array of heaps]}
    function PairingHeap(elem) {
        this.elem = elem;
        this.subheaps = [];
    }
    PairingHeap.prototype.toString = function (selector) {
        var str = "", needComma = false;
        for (var i = 0; i < this.subheaps.length; ++i) {
            var subheap = this.subheaps[i];
            if (!subheap.elem) {
                needComma = false;
                continue;
            }
            if (needComma) {
                str = str + ",";
            }
            str = str + subheap.toString(selector);
            needComma = true;
        }
        if (str !== "") {
            str = "(" + str + ")";
        }
        return (this.elem ? selector(this.elem) : "") + str;
    };
    PairingHeap.prototype.forEach = function (f) {
        if (!this.empty()) {
            f(this.elem, this);
            this.subheaps.forEach(function (s) { return s.forEach(f); });
        }
    };
    PairingHeap.prototype.count = function () {
        return this.empty() ? 0 : 1 + this.subheaps.reduce(function (n, h) {
            return n + h.count();
        }, 0);
    };
    PairingHeap.prototype.min = function () {
        return this.elem;
    };
    PairingHeap.prototype.empty = function () {
        return this.elem == null;
    };
    PairingHeap.prototype.contains = function (h) {
        if (this === h)
            return true;
        for (var i = 0; i < this.subheaps.length; i++) {
            if (this.subheaps[i].contains(h))
                return true;
        }
        return false;
    };
    PairingHeap.prototype.isHeap = function (lessThan) {
        var _this = this;
        return this.subheaps.every(function (h) { return lessThan(_this.elem, h.elem) && h.isHeap(lessThan); });
    };
    PairingHeap.prototype.insert = function (obj, lessThan) {
        return this.merge(new PairingHeap(obj), lessThan);
    };
    PairingHeap.prototype.merge = function (heap2, lessThan) {
        if (this.empty())
            return heap2;
        else if (heap2.empty())
            return this;
        else if (lessThan(this.elem, heap2.elem)) {
            this.subheaps.push(heap2);
            return this;
        }
        else {
            heap2.subheaps.push(this);
            return heap2;
        }
    };
    PairingHeap.prototype.removeMin = function (lessThan) {
        if (this.empty())
            return null;
        else
            return this.mergePairs(lessThan);
    };
    PairingHeap.prototype.mergePairs = function (lessThan) {
        if (this.subheaps.length == 0)
            return new PairingHeap(null);
        else if (this.subheaps.length == 1) {
            return this.subheaps[0];
        }
        else {
            var firstPair = this.subheaps.pop().merge(this.subheaps.pop(), lessThan);
            var remaining = this.mergePairs(lessThan);
            return firstPair.merge(remaining, lessThan);
        }
    };
    PairingHeap.prototype.decreaseKey = function (subheap, newValue, setHeapNode, lessThan) {
        var newHeap = subheap.removeMin(lessThan);
        //reassign subheap values to preserve tree
        subheap.elem = newHeap.elem;
        subheap.subheaps = newHeap.subheaps;
        if (setHeapNode !== null && newHeap.elem !== null) {
            setHeapNode(subheap.elem, subheap);
        }
        var pairingNode = new PairingHeap(newValue);
        if (setHeapNode !== null) {
            setHeapNode(newValue, pairingNode);
        }
        return this.merge(pairingNode, lessThan);
    };
    return PairingHeap;
})();
/**
 * @class PriorityQueue a min priority queue backed by a pairing heap
 */
var PriorityQueue = (function () {
    function PriorityQueue(lessThan) {
        this.lessThan = lessThan;
    }
    /**
     * @method top
     * @return the top element (the min element as defined by lessThan)
     */
    PriorityQueue.prototype.top = function () {
        if (this.empty()) {
            return null;
        }
        return this.root.elem;
    };
    /**
     * @method push
     * put things on the heap
     */
    PriorityQueue.prototype.push = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        var pairingNode;
        for (var i = 0, arg; arg = args[i]; ++i) {
            pairingNode = new PairingHeap(arg);
            this.root = this.empty() ?
                pairingNode : this.root.merge(pairingNode, this.lessThan);
        }
        return pairingNode;
    };
    /**
     * @method empty
     * @return true if no more elements in queue
     */
    PriorityQueue.prototype.empty = function () {
        return !this.root || !this.root.elem;
    };
    /**
     * @method isHeap check heap condition (for testing)
     * @return true if queue is in valid state
     */
    PriorityQueue.prototype.isHeap = function () {
        return this.root.isHeap(this.lessThan);
    };
    /**
     * @method forEach apply f to each element of the queue
     * @param f function to apply
     */
    PriorityQueue.prototype.forEach = function (f) {
        this.root.forEach(f);
    };
    /**
     * @method pop remove and return the min element from the queue
     */
    PriorityQueue.prototype.pop = function () {
        if (this.empty()) {
            return null;
        }
        var obj = this.root.min();
        this.root = this.root.removeMin(this.lessThan);
        return obj;
    };
    /**
     * @method reduceKey reduce the key value of the specified heap node
     */
    PriorityQueue.prototype.reduceKey = function (heapNode, newKey, setHeapNode) {
        if (setHeapNode === void 0) { setHeapNode = null; }
        this.root = this.root.decreaseKey(heapNode, newKey, setHeapNode, this.lessThan);
    };
    PriorityQueue.prototype.toString = function (selector) {
        return this.root.toString(selector);
    };
    /**
     * @method count
     * @return number of elements in queue
     */
    PriorityQueue.prototype.count = function () {
        return this.root.count();
    };
    return PriorityQueue;
})();
///<reference path="pqueue.ts"/>
/**
 * @module shortestpaths
 */
var cola;
(function (cola) {
    var shortestpaths;
    (function (shortestpaths) {
        var Neighbour = (function () {
            function Neighbour(id, distance) {
                this.id = id;
                this.distance = distance;
            }
            return Neighbour;
        })();
        var Node = (function () {
            function Node(id) {
                this.id = id;
                this.neighbours = [];
            }
            return Node;
        })();
        var QueueEntry = (function () {
            function QueueEntry(node, prev, d) {
                this.node = node;
                this.prev = prev;
                this.d = d;
            }
            return QueueEntry;
        })();
        /**
         * calculates all-pairs shortest paths or shortest paths from a single node
         * @class Calculator
         * @constructor
         * @param n {number} number of nodes
         * @param es {Edge[]} array of edges
         */
        var Calculator = (function () {
            function Calculator(n, es, getSourceIndex, getTargetIndex, getLength) {
                this.n = n;
                this.es = es;
                this.neighbours = new Array(this.n);
                var i = this.n;
                while (i--)
                    this.neighbours[i] = new Node(i);
                i = this.es.length;
                while (i--) {
                    var e = this.es[i];
                    var u = getSourceIndex(e), v = getTargetIndex(e);
                    var d = getLength(e);
                    this.neighbours[u].neighbours.push(new Neighbour(v, d));
                    this.neighbours[v].neighbours.push(new Neighbour(u, d));
                }
            }
            /**
             * compute shortest paths for graph over n nodes with edges an array of source/target pairs
             * edges may optionally have a length attribute.  1 is the default.
             * Uses Johnson's algorithm.
             *
             * @method DistanceMatrix
             * @return the distance matrix
             */
            Calculator.prototype.DistanceMatrix = function () {
                var D = new Array(this.n);
                for (var i = 0; i < this.n; ++i) {
                    D[i] = this.dijkstraNeighbours(i);
                }
                return D;
            };
            /**
             * get shortest paths from a specified start node
             * @method DistancesFromNode
             * @param start node index
             * @return array of path lengths
             */
            Calculator.prototype.DistancesFromNode = function (start) {
                return this.dijkstraNeighbours(start);
            };
            Calculator.prototype.PathFromNodeToNode = function (start, end) {
                return this.dijkstraNeighbours(start, end);
            };
            // find shortest path from start to end, with the opportunity at
            // each edge traversal to compute a custom cost based on the
            // previous edge.  For example, to penalise bends.
            Calculator.prototype.PathFromNodeToNodeWithPrevCost = function (start, end, prevCost) {
                var q = new PriorityQueue(function (a, b) { return a.d <= b.d; }), u = this.neighbours[start], qu = new QueueEntry(u, null, 0), visitedFrom = {};
                q.push(qu);
                while (!q.empty()) {
                    qu = q.pop();
                    u = qu.node;
                    if (u.id === end) {
                        break;
                    }
                    var i = u.neighbours.length;
                    while (i--) {
                        var neighbour = u.neighbours[i], v = this.neighbours[neighbour.id];
                        // don't double back
                        if (qu.prev && v.id === qu.prev.node.id)
                            continue;
                        // don't retraverse an edge if it has already been explored
                        // from a lower cost route
                        var viduid = v.id + ',' + u.id;
                        if (viduid in visitedFrom && visitedFrom[viduid] <= qu.d)
                            continue;
                        var cc = qu.prev ? prevCost(qu.prev.node.id, u.id, v.id) : 0, t = qu.d + neighbour.distance + cc;
                        // store cost of this traversal
                        visitedFrom[viduid] = t;
                        q.push(new QueueEntry(v, qu, t));
                    }
                }
                var path = [];
                while (qu.prev) {
                    qu = qu.prev;
                    path.push(qu.node.id);
                }
                return path;
            };
            Calculator.prototype.dijkstraNeighbours = function (start, dest) {
                if (dest === void 0) { dest = -1; }
                var q = new PriorityQueue(function (a, b) { return a.d <= b.d; }), i = this.neighbours.length, d = new Array(i);
                while (i--) {
                    var node = this.neighbours[i];
                    node.d = i === start ? 0 : Number.POSITIVE_INFINITY;
                    node.q = q.push(node);
                }
                while (!q.empty()) {
                    // console.log(q.toString(function (u) { return u.id + "=" + (u.d === Number.POSITIVE_INFINITY ? "\u221E" : u.d.toFixed(2) )}));
                    var u = q.pop();
                    d[u.id] = u.d;
                    if (u.id === dest) {
                        var path = [];
                        var v = u;
                        while (typeof v.prev !== 'undefined') {
                            path.push(v.prev.id);
                            v = v.prev;
                        }
                        return path;
                    }
                    i = u.neighbours.length;
                    while (i--) {
                        var neighbour = u.neighbours[i];
                        var v = this.neighbours[neighbour.id];
                        var t = u.d + neighbour.distance;
                        if (u.d !== Number.MAX_VALUE && v.d > t) {
                            v.d = t;
                            v.prev = u;
                            q.reduceKey(v.q, v, function (e, q) { return e.q = q; });
                        }
                    }
                }
                return d;
            };
            return Calculator;
        })();
        shortestpaths.Calculator = Calculator;
    })(shortestpaths = cola.shortestpaths || (cola.shortestpaths = {}));
})(cola || (cola = {}));
///<reference path="handledisconnected.ts"/>
///<reference path="geom.ts"/>
///<reference path="descent.ts"/>
///<reference path="powergraph.ts"/>
///<reference path="linklengths.ts"/>
///<reference path="shortestpaths.ts"/>
/**
 * @module cola
 */
var cola;
(function (cola) {
    /**
     * The layout process fires three events:
     *  - start: layout iterations started
     *  - tick: fired once per iteration, listen to this to animate
     *  - end: layout converged, you might like to zoom-to-fit or something at notification of this event
     */
    (function (EventType) {
        EventType[EventType["start"] = 0] = "start";
        EventType[EventType["tick"] = 1] = "tick";
        EventType[EventType["end"] = 2] = "end";
    })(cola.EventType || (cola.EventType = {}));
    var EventType = cola.EventType;
    ;
    function isGroup(g) {
        return typeof g.leaves !== 'undefined' || typeof g.groups !== 'undefined';
    }
    /**
     * Main interface to cola layout.
     * @class Layout
     */
    var Layout = (function () {
        function Layout() {
            var _this = this;
            this._canvasSize = [1, 1];
            this._linkDistance = 20;
            this._defaultNodeSize = 10;
            this._linkLengthCalculator = null;
            this._linkType = null;
            this._avoidOverlaps = false;
            this._handleDisconnected = true;
            this._running = false;
            this._nodes = [];
            this._groups = [];
            this._rootGroup = null;
            this._links = [];
            this._constraints = [];
            this._distanceMatrix = null;
            this._descent = null;
            this._directedLinkConstraints = null;
            this._threshold = 0.01;
            this._visibilityGraph = null;
            this._groupCompactness = 1e-6;
            // sub-class and override this property to replace with a more sophisticated eventing mechanism
            this.event = null;
            this.linkAccessor = {
                getSourceIndex: Layout.getSourceIndex,
                getTargetIndex: Layout.getTargetIndex,
                setLength: Layout.setLinkLength,
                getType: function (l) { return typeof _this._linkType === "function" ? _this._linkType(l) : 0; }
            };
        }
        // subscribe a listener to an event
        // sub-class and override this method to replace with a more sophisticated eventing mechanism
        Layout.prototype.on = function (e, listener) {
            // override me!
            if (!this.event)
                this.event = {};
            if (typeof e === 'string') {
                this.event[EventType[e]] = listener;
            }
            else {
                this.event[e] = listener;
            }
            return this;
        };
        // a function that is notified of events like "tick"
        // sub-class and override this method to replace with a more sophisticated eventing mechanism
        Layout.prototype.trigger = function (e) {
            if (this.event && typeof this.event[e.type] !== 'undefined') {
                this.event[e.type](e);
            }
        };
        // a function that kicks off the iteration tick loop
        // it calls tick() repeatedly until tick returns true (is converged)
        // subclass and override it with something fancier (e.g. dispatch tick on a timer)
        Layout.prototype.kick = function () {
            while (!this.tick())
                ;
        };
        /**
         * iterate the layout.  Returns true when layout converged.
         */
        Layout.prototype.tick = function () {
            if (this._alpha < this._threshold) {
                this._running = false;
                this.trigger({ type: EventType.end, alpha: this._alpha = 0, stress: this._lastStress });
                return true;
            }
            var n = this._nodes.length, m = this._links.length;
            var o, i;
            this._descent.locks.clear();
            for (i = 0; i < n; ++i) {
                o = this._nodes[i];
                if (o.fixed) {
                    if (typeof o.px === 'undefined' || typeof o.py === 'undefined') {
                        o.px = o.x;
                        o.py = o.y;
                    }
                    var p = [o.px, o.py];
                    this._descent.locks.add(i, p);
                }
            }
            var s1 = this._descent.rungeKutta();
            //var s1 = descent.reduceStress();
            if (s1 === 0) {
                this._alpha = 0;
            }
            else if (typeof this._lastStress !== 'undefined') {
                this._alpha = s1; //Math.abs(Math.abs(this._lastStress / s1) - 1);
            }
            this._lastStress = s1;
            this.updateNodePositions();
            this.trigger({ type: EventType.tick, alpha: this._alpha, stress: this._lastStress });
            return false;
        };
        // copy positions out of descent instance into each of the nodes' center coords
        Layout.prototype.updateNodePositions = function () {
            var x = this._descent.x[0], y = this._descent.x[1];
            var o, i = this._nodes.length;
            while (i--) {
                o = this._nodes[i];
                o.x = x[i];
                o.y = y[i];
            }
        };
        Layout.prototype.nodes = function (v) {
            if (!v) {
                if (this._nodes.length === 0 && this._links.length > 0) {
                    // if we have links but no nodes, create the nodes array now with empty objects for the links to point at.
                    // in this case the links are expected to be numeric indices for nodes in the range 0..n-1 where n is the number of nodes
                    var n = 0;
                    this._links.forEach(function (l) {
                        n = Math.max(n, l.source, l.target);
                    });
                    this._nodes = new Array(++n);
                    for (var i = 0; i < n; ++i) {
                        this._nodes[i] = {};
                    }
                }
                return this._nodes;
            }
            this._nodes = v;
            return this;
        };
        Layout.prototype.groups = function (x) {
            var _this = this;
            if (!x)
                return this._groups;
            this._groups = x;
            this._rootGroup = {};
            this._groups.forEach(function (g) {
                if (typeof g.padding === "undefined")
                    g.padding = 1;
                if (typeof g.leaves !== "undefined") {
                    g.leaves.forEach(function (v, i) {
                        if (typeof v === 'number')
                            (g.leaves[i] = _this._nodes[v]).parent = g;
                    });
                }
                if (typeof g.groups !== "undefined") {
                    g.groups.forEach(function (gi, i) {
                        if (typeof gi === 'number')
                            (g.groups[i] = _this._groups[gi]).parent = g;
                    });
                }
            });
            this._rootGroup.leaves = this._nodes.filter(function (v) { return typeof v.parent === 'undefined'; });
            this._rootGroup.groups = this._groups.filter(function (g) { return typeof g.parent === 'undefined'; });
            return this;
        };
        Layout.prototype.powerGraphGroups = function (f) {
            var g = cola.powergraph.getGroups(this._nodes, this._links, this.linkAccessor, this._rootGroup);
            this.groups(g.groups);
            f(g);
            return this;
        };
        Layout.prototype.avoidOverlaps = function (v) {
            if (!arguments.length)
                return this._avoidOverlaps;
            this._avoidOverlaps = v;
            return this;
        };
        Layout.prototype.handleDisconnected = function (v) {
            if (!arguments.length)
                return this._handleDisconnected;
            this._handleDisconnected = v;
            return this;
        };
        /**
         * causes constraints to be generated such that directed graphs are laid out either from left-to-right or top-to-bottom.
         * a separation constraint is generated in the selected axis for each edge that is not involved in a cycle (part of a strongly connected component)
         * @param axis {string} 'x' for left-to-right, 'y' for top-to-bottom
         * @param minSeparation {number|link=>number} either a number specifying a minimum spacing required across all links or a function to return the minimum spacing for each link
         */
        Layout.prototype.flowLayout = function (axis, minSeparation) {
            if (!arguments.length)
                axis = 'y';
            this._directedLinkConstraints = {
                axis: axis,
                getMinSeparation: typeof minSeparation === 'number' ? function () { return minSeparation; } : minSeparation
            };
            return this;
        };
        Layout.prototype.links = function (x) {
            if (!arguments.length)
                return this._links;
            this._links = x;
            return this;
        };
        Layout.prototype.constraints = function (c) {
            if (!arguments.length)
                return this._constraints;
            this._constraints = c;
            return this;
        };
        Layout.prototype.distanceMatrix = function (d) {
            if (!arguments.length)
                return this._distanceMatrix;
            this._distanceMatrix = d;
            return this;
        };
        Layout.prototype.size = function (x) {
            if (!x)
                return this._canvasSize;
            this._canvasSize = x;
            return this;
        };
        Layout.prototype.defaultNodeSize = function (x) {
            if (!x)
                return this._defaultNodeSize;
            this._defaultNodeSize = x;
            return this;
        };
        Layout.prototype.groupCompactness = function (x) {
            if (!x)
                return this._groupCompactness;
            this._groupCompactness = x;
            return this;
        };
        Layout.prototype.linkDistance = function (x) {
            if (!x) {
                return this._linkDistance;
            }
            this._linkDistance = typeof x === "function" ? x : +x;
            this._linkLengthCalculator = null;
            return this;
        };
        Layout.prototype.linkType = function (f) {
            this._linkType = f;
            return this;
        };
        Layout.prototype.convergenceThreshold = function (x) {
            if (!x)
                return this._threshold;
            this._threshold = typeof x === "function" ? x : +x;
            return this;
        };
        Layout.prototype.alpha = function (x) {
            if (!arguments.length)
                return this._alpha;
            else {
                x = +x;
                if (this._alpha) {
                    if (x > 0)
                        this._alpha = x; // we might keep it hot
                    else
                        this._alpha = 0; // or, next tick will dispatch "end"
                }
                else if (x > 0) {
                    if (!this._running) {
                        this._running = true;
                        this.trigger({ type: EventType.start, alpha: this._alpha = x });
                        this.kick();
                    }
                }
                return this;
            }
        };
        Layout.prototype.getLinkLength = function (link) {
            return typeof this._linkDistance === "function" ? +(this._linkDistance(link)) : this._linkDistance;
        };
        Layout.setLinkLength = function (link, length) {
            link.length = length;
        };
        Layout.prototype.getLinkType = function (link) {
            return typeof this._linkType === "function" ? this._linkType(link) : 0;
        };
        /**
         * compute an ideal length for each link based on the graph structure around that link.
         * you can use this (for example) to create extra space around hub-nodes in dense graphs.
         * In particular this calculation is based on the "symmetric difference" in the neighbour sets of the source and target:
         * i.e. if neighbours of source is a and neighbours of target are b then calculation is: sqrt(|a union b| - |a intersection b|)
         * Actual computation based on inspection of link structure occurs in start(), so links themselves
         * don't have to have been assigned before invoking this function.
         * @param {number} [idealLength] the base length for an edge when its source and start have no other common neighbours (e.g. 40)
         * @param {number} [w] a multiplier for the effect of the length adjustment (e.g. 0.7)
         */
        Layout.prototype.symmetricDiffLinkLengths = function (idealLength, w) {
            var _this = this;
            if (w === void 0) { w = 1; }
            this.linkDistance(function (l) { return idealLength * l.length; });
            this._linkLengthCalculator = function () { return cola.symmetricDiffLinkLengths(_this._links, _this.linkAccessor, w); };
            return this;
        };
        /**
         * compute an ideal length for each link based on the graph structure around that link.
         * you can use this (for example) to create extra space around hub-nodes in dense graphs.
         * In particular this calculation is based on the "symmetric difference" in the neighbour sets of the source and target:
         * i.e. if neighbours of source is a and neighbours of target are b then calculation is: |a intersection b|/|a union b|
         * Actual computation based on inspection of link structure occurs in start(), so links themselves
         * don't have to have been assigned before invoking this function.
         * @param {number} [idealLength] the base length for an edge when its source and start have no other common neighbours (e.g. 40)
         * @param {number} [w] a multiplier for the effect of the length adjustment (e.g. 0.7)
         */
        Layout.prototype.jaccardLinkLengths = function (idealLength, w) {
            var _this = this;
            if (w === void 0) { w = 1; }
            this.linkDistance(function (l) { return idealLength * l.length; });
            this._linkLengthCalculator = function () { return cola.jaccardLinkLengths(_this._links, _this.linkAccessor, w); };
            return this;
        };
        /**
         * start the layout process
         * @method start
         * @param {number} [initialUnconstrainedIterations=0] unconstrained initial layout iterations
         * @param {number} [initialUserConstraintIterations=0] initial layout iterations with user-specified constraints
         * @param {number} [initialAllConstraintsIterations=0] initial layout iterations with all constraints including non-overlap
         * @param {number} [gridSnapIterations=0] iterations of "grid snap", which pulls nodes towards grid cell centers - grid of size node[0].width - only really makes sense if all nodes have the same width and height
         * @param [keepRunning=true] keep iterating asynchronously via the tick method
         */
        Layout.prototype.start = function (initialUnconstrainedIterations, initialUserConstraintIterations, initialAllConstraintsIterations, gridSnapIterations, keepRunning) {
            var _this = this;
            if (initialUnconstrainedIterations === void 0) { initialUnconstrainedIterations = 0; }
            if (initialUserConstraintIterations === void 0) { initialUserConstraintIterations = 0; }
            if (initialAllConstraintsIterations === void 0) { initialAllConstraintsIterations = 0; }
            if (gridSnapIterations === void 0) { gridSnapIterations = 0; }
            if (keepRunning === void 0) { keepRunning = true; }
            var i, j, n = this.nodes().length, N = n + 2 * this._groups.length, m = this._links.length, w = this._canvasSize[0], h = this._canvasSize[1];
            var x = new Array(N), y = new Array(N);
            var G = null;
            var ao = this._avoidOverlaps;
            this._nodes.forEach(function (v, i) {
                v.index = i;
                if (typeof v.x === 'undefined') {
                    v.x = w / 2, v.y = h / 2;
                }
                x[i] = v.x, y[i] = v.y;
            });
            if (this._linkLengthCalculator)
                this._linkLengthCalculator();
            //should we do this to clearly label groups?
            //this._groups.forEach((g, i) => g.groupIndex = i);
            var distances;
            if (this._distanceMatrix) {
                // use the user specified distanceMatrix
                distances = this._distanceMatrix;
            }
            else {
                // construct an n X n distance matrix based on shortest paths through graph (with respect to edge.length).
                distances = (new cola.shortestpaths.Calculator(N, this._links, Layout.getSourceIndex, Layout.getTargetIndex, function (l) { return _this.getLinkLength(l); })).DistanceMatrix();
                // G is a square matrix with G[i][j] = 1 iff there exists an edge between node i and node j
                // otherwise 2. (
                G = cola.Descent.createSquareMatrix(N, function () { return 2; });
                this._links.forEach(function (l) {
                    if (typeof l.source == "number")
                        l.source = _this._nodes[l.source];
                    if (typeof l.target == "number")
                        l.target = _this._nodes[l.target];
                });
                this._links.forEach(function (e) {
                    var u = Layout.getSourceIndex(e), v = Layout.getTargetIndex(e);
                    G[u][v] = G[v][u] = e.weight || 1;
                });
            }
            var D = cola.Descent.createSquareMatrix(N, function (i, j) {
                return distances[i][j];
            });
            if (this._rootGroup && typeof this._rootGroup.groups !== 'undefined') {
                var i = n;
                var addAttraction = function (i, j, strength, idealDistance) {
                    G[i][j] = G[j][i] = strength;
                    D[i][j] = D[j][i] = idealDistance;
                };
                this._groups.forEach(function (g) {
                    addAttraction(i, i + 1, _this._groupCompactness, 0.1);
                    // todo: add terms here attracting children of the group to the group dummy nodes
                    //if (typeof g.leaves !== 'undefined')
                    //    g.leaves.forEach(l => {
                    //        addAttraction(l.index, i, 1e-4, 0.1);
                    //        addAttraction(l.index, i + 1, 1e-4, 0.1);
                    //    });
                    //if (typeof g.groups !== 'undefined')
                    //    g.groups.forEach(g => {
                    //        var gid = n + g.groupIndex * 2;
                    //        addAttraction(gid, i, 0.1, 0.1);
                    //        addAttraction(gid + 1, i, 0.1, 0.1);
                    //        addAttraction(gid, i + 1, 0.1, 0.1);
                    //        addAttraction(gid + 1, i + 1, 0.1, 0.1);
                    //    });
                    x[i] = 0, y[i++] = 0;
                    x[i] = 0, y[i++] = 0;
                });
            }
            else
                this._rootGroup = { leaves: this._nodes, groups: [] };
            var curConstraints = this._constraints || [];
            if (this._directedLinkConstraints) {
                this.linkAccessor.getMinSeparation = this._directedLinkConstraints.getMinSeparation;
                curConstraints = curConstraints.concat(cola.generateDirectedEdgeConstraints(n, this._links, this._directedLinkConstraints.axis, (this.linkAccessor)));
            }
            this.avoidOverlaps(false);
            this._descent = new cola.Descent([x, y], D);
            this._descent.locks.clear();
            for (var i = 0; i < n; ++i) {
                var o = this._nodes[i];
                if (o.fixed) {
                    o.px = o.x;
                    o.py = o.y;
                    var p = [o.x, o.y];
                    this._descent.locks.add(i, p);
                }
            }
            this._descent.threshold = this._threshold;
            // apply initialIterations without user constraints or nonoverlap constraints
            // if groups are specified, dummy nodes and edges will be added to untangle
            // with respect to group connectivity
            this.initialLayout(initialUnconstrainedIterations, x, y);
            // apply initialIterations with user constraints but no nonoverlap constraints
            if (curConstraints.length > 0)
                this._descent.project = new cola.vpsc.Projection(this._nodes, this._groups, this._rootGroup, curConstraints).projectFunctions();
            this._descent.run(initialUserConstraintIterations);
            this.separateOverlappingComponents(w, h);
            // subsequent iterations will apply all constraints
            this.avoidOverlaps(ao);
            if (ao) {
                this._nodes.forEach(function (v, i) { v.x = x[i], v.y = y[i]; });
                this._descent.project = new cola.vpsc.Projection(this._nodes, this._groups, this._rootGroup, curConstraints, true).projectFunctions();
                this._nodes.forEach(function (v, i) { x[i] = v.x, y[i] = v.y; });
            }
            // allow not immediately connected nodes to relax apart (p-stress)
            this._descent.G = G;
            this._descent.run(initialAllConstraintsIterations);
            if (gridSnapIterations) {
                this._descent.snapStrength = 1000;
                this._descent.snapGridSize = this._nodes[0].width;
                this._descent.numGridSnapNodes = n;
                this._descent.scaleSnapByMaxH = n != N; // if we have groups then need to scale hessian so grid forces still apply
                var G0 = cola.Descent.createSquareMatrix(N, function (i, j) {
                    if (i >= n || j >= n)
                        return G[i][j];
                    return 0;
                });
                this._descent.G = G0;
                this._descent.run(gridSnapIterations);
            }
            this.updateNodePositions();
            this.separateOverlappingComponents(w, h);
            return keepRunning ? this.resume() : this;
        };
        Layout.prototype.initialLayout = function (iterations, x, y) {
            if (this._groups.length > 0 && iterations > 0) {
                // construct a flat graph with dummy nodes for the groups and edges connecting group dummy nodes to their children
                // todo: edges attached to groups are replaced with edges connected to the corresponding group dummy node
                var n = this._nodes.length;
                var edges = this._links.map(function (e) { return { source: e.source.index, target: e.target.index }; });
                var vs = this._nodes.map(function (v) { return { index: v.index }; });
                this._groups.forEach(function (g, i) {
                    vs.push({ index: g.index = n + i });
                });
                this._groups.forEach(function (g, i) {
                    if (typeof g.leaves !== 'undefined')
                        g.leaves.forEach(function (v) { return edges.push({ source: g.index, target: v.index }); });
                    if (typeof g.groups !== 'undefined')
                        g.groups.forEach(function (gg) { return edges.push({ source: g.index, target: gg.index }); });
                });
                // layout the flat graph with dummy nodes and edges
                new cola.Layout()
                    .size(this.size())
                    .nodes(vs)
                    .links(edges)
                    .avoidOverlaps(false)
                    .linkDistance(this.linkDistance())
                    .symmetricDiffLinkLengths(5)
                    .convergenceThreshold(1e-4)
                    .start(iterations, 0, 0, 0, false);
                this._nodes.forEach(function (v) {
                    x[v.index] = vs[v.index].x;
                    y[v.index] = vs[v.index].y;
                });
            }
            else {
                this._descent.run(iterations);
            }
        };
        // recalculate nodes position for disconnected graphs
        Layout.prototype.separateOverlappingComponents = function (width, height) {
            var _this = this;
            // recalculate nodes position for disconnected graphs
            if (!this._distanceMatrix && this._handleDisconnected) {
                var x = this._descent.x[0], y = this._descent.x[1];
                this._nodes.forEach(function (v, i) { v.x = x[i], v.y = y[i]; });
                var graphs = cola.separateGraphs(this._nodes, this._links);
                cola.applyPacking(graphs, width, height, this._defaultNodeSize);
                this._nodes.forEach(function (v, i) {
                    _this._descent.x[0][i] = v.x, _this._descent.x[1][i] = v.y;
                    if (v.bounds) {
                        v.bounds.setXCentre(v.x);
                        v.bounds.setYCentre(v.y);
                    }
                });
            }
        };
        Layout.prototype.resume = function () {
            return this.alpha(0.1);
        };
        Layout.prototype.stop = function () {
            return this.alpha(0);
        };
        /// find a visibility graph over the set of nodes.  assumes all nodes have a
        /// bounds property (a rectangle) and that no pair of bounds overlaps.
        Layout.prototype.prepareEdgeRouting = function (nodeMargin) {
            if (nodeMargin === void 0) { nodeMargin = 0; }
            this._visibilityGraph = new cola.geom.TangentVisibilityGraph(this._nodes.map(function (v) {
                return v.bounds.inflate(-nodeMargin).vertices();
            }));
        };
        /// find a route avoiding node bounds for the given edge.
        /// assumes the visibility graph has been created (by prepareEdgeRouting method)
        /// and also assumes that nodes have an index property giving their position in the
        /// node array.  This index property is created by the start() method.
        Layout.prototype.routeEdge = function (edge, draw) {
            var lineData = [];
            //if (d.source.id === 10 && d.target.id === 11) {
            //    debugger;
            //}
            var vg2 = new cola.geom.TangentVisibilityGraph(this._visibilityGraph.P, { V: this._visibilityGraph.V, E: this._visibilityGraph.E }), port1 = { x: edge.source.x, y: edge.source.y }, port2 = { x: edge.target.x, y: edge.target.y }, start = vg2.addPoint(port1, edge.source.index), end = vg2.addPoint(port2, edge.target.index);
            vg2.addEdgeIfVisible(port1, port2, edge.source.index, edge.target.index);
            if (typeof draw !== 'undefined') {
                draw(vg2);
            }
            var sourceInd = function (e) { return e.source.id; }, targetInd = function (e) { return e.target.id; }, length = function (e) { return e.length(); }, spCalc = new cola.shortestpaths.Calculator(vg2.V.length, vg2.E, sourceInd, targetInd, length), shortestPath = spCalc.PathFromNodeToNode(start.id, end.id);
            if (shortestPath.length === 1 || shortestPath.length === vg2.V.length) {
                var route = cola.vpsc.makeEdgeBetween(edge.source.innerBounds, edge.target.innerBounds, 5);
                lineData = [route.sourceIntersection, route.arrowStart];
            }
            else {
                var n = shortestPath.length - 2, p = vg2.V[shortestPath[n]].p, q = vg2.V[shortestPath[0]].p, lineData = [edge.source.innerBounds.rayIntersection(p.x, p.y)];
                for (var i = n; i >= 0; --i)
                    lineData.push(vg2.V[shortestPath[i]].p);
                lineData.push(cola.vpsc.makeEdgeTo(q, edge.target.innerBounds, 5));
            }
            //lineData.forEach((v, i) => {
            //    if (i > 0) {
            //        var u = lineData[i - 1];
            //        this._nodes.forEach(function (node) {
            //            if (node.id === getSourceIndex(d) || node.id === getTargetIndex(d)) return;
            //            var ints = node.innerBounds.lineIntersections(u.x, u.y, v.x, v.y);
            //            if (ints.length > 0) {
            //                debugger;
            //            }
            //        })
            //    }
            //})
            return lineData;
        };
        //The link source and target may be just a node index, or they may be references to nodes themselves.
        Layout.getSourceIndex = function (e) {
            return typeof e.source === 'number' ? e.source : e.source.index;
        };
        //The link source and target may be just a node index, or they may be references to nodes themselves.
        Layout.getTargetIndex = function (e) {
            return typeof e.target === 'number' ? e.target : e.target.index;
        };
        // Get a string ID for a given link.
        Layout.linkId = function (e) {
            return Layout.getSourceIndex(e) + "-" + Layout.getTargetIndex(e);
        };
        // The fixed property has three bits:
        // Bit 1 can be set externally (e.g., d.fixed = true) and show persist.
        // Bit 2 stores the dragging state, from mousedown to mouseup.
        // Bit 3 stores the hover state, from mouseover to mouseout.
        Layout.dragStart = function (d) {
            if (isGroup(d)) {
                Layout.storeOffset(d, Layout.dragOrigin(d));
            }
            else {
                Layout.stopNode(d);
                d.fixed |= 2; // set bit 2
            }
        };
        // we clobber any existing desired positions for nodes
        // in case another tick event occurs before the drag
        Layout.stopNode = function (v) {
            v.px = v.x;
            v.py = v.y;
        };
        // we store offsets for each node relative to the centre of the ancestor group
        // being dragged in a pair of properties on the node
        Layout.storeOffset = function (d, origin) {
            if (typeof d.leaves !== 'undefined') {
                d.leaves.forEach(function (v) {
                    v.fixed |= 2;
                    Layout.stopNode(v);
                    v._dragGroupOffsetX = v.x - origin.x;
                    v._dragGroupOffsetY = v.y - origin.y;
                });
            }
            if (typeof d.groups !== 'undefined') {
                d.groups.forEach(function (g) { return Layout.storeOffset(g, origin); });
            }
        };
        // the drag origin is taken as the centre of the node or group
        Layout.dragOrigin = function (d) {
            if (isGroup(d)) {
                return {
                    x: d.bounds.cx(),
                    y: d.bounds.cy()
                };
            }
            else {
                return d;
            }
        };
        // for groups, the drag translation is propagated down to all of the children of
        // the group.
        Layout.drag = function (d, position) {
            if (isGroup(d)) {
                if (typeof d.leaves !== 'undefined') {
                    d.leaves.forEach(function (v) {
                        d.bounds.setXCentre(position.x);
                        d.bounds.setYCentre(position.y);
                        v.px = v._dragGroupOffsetX + position.x;
                        v.py = v._dragGroupOffsetY + position.y;
                    });
                }
                if (typeof d.groups !== 'undefined') {
                    d.groups.forEach(function (g) { return Layout.drag(g, position); });
                }
            }
            else {
                d.px = position.x;
                d.py = position.y;
            }
        };
        // we unset only bits 2 and 3 so that the user can fix nodes with another a different
        // bit such that the lock persists between drags
        Layout.dragEnd = function (d) {
            if (isGroup(d)) {
                if (typeof d.leaves !== 'undefined') {
                    d.leaves.forEach(function (v) {
                        Layout.dragEnd(v);
                        delete v._dragGroupOffsetX;
                        delete v._dragGroupOffsetY;
                    });
                }
                if (typeof d.groups !== 'undefined') {
                    d.groups.forEach(Layout.dragEnd);
                }
            }
            else {
                d.fixed &= ~6; // unset bits 2 and 3
            }
        };
        // in d3 hover temporarily locks nodes, currently not used in cola
        Layout.mouseOver = function (d) {
            d.fixed |= 4; // set bit 3
            d.px = d.x, d.py = d.y; // set velocity to zero
        };
        // in d3 hover temporarily locks nodes, currently not used in cola
        Layout.mouseOut = function (d) {
            d.fixed &= ~4; // unset bit 3
        };
        return Layout;
    })();
    cola.Layout = Layout;
})(cola || (cola = {}));
///<reference path="layout.ts"/>
var cola;
(function (cola) {
    var LayoutAdaptor = (function (_super) {
        __extends(LayoutAdaptor, _super);
        function LayoutAdaptor(options) {
            _super.call(this);
            // take in implementation as defined by client
            var self = this;
            var o = options;
            if (o.trigger) {
                this.trigger = o.trigger;
            }
            if (o.kick) {
                this.kick = o.kick;
            }
            if (o.drag) {
                this.drag = o.drag;
            }
            if (o.on) {
                this.on = o.on;
            }
            this.dragstart = this.dragStart = cola.Layout.dragStart;
            this.dragend = this.dragEnd = cola.Layout.dragEnd;
        }
        // dummy functions in case not defined by client
        LayoutAdaptor.prototype.trigger = function (e) { };
        ;
        LayoutAdaptor.prototype.kick = function () { };
        ;
        LayoutAdaptor.prototype.drag = function () { };
        ;
        LayoutAdaptor.prototype.on = function (eventType, listener) { return this; };
        ;
        return LayoutAdaptor;
    })(cola.Layout);
    cola.LayoutAdaptor = LayoutAdaptor;
    /**
     * provides an interface for use with any external graph system (e.g. Cytoscape.js):
     */
    function adaptor(options) {
        return new LayoutAdaptor(options);
    }
    cola.adaptor = adaptor;
})(cola || (cola = {}));
var cola;
(function (cola) {
    function gridify(pgLayout, nudgeGap, margin, groupMargin) {
        pgLayout.cola.start(0, 0, 0, 10, false);
        var gridrouter = route(pgLayout.cola.nodes(), pgLayout.cola.groups(), margin, groupMargin);
        return gridrouter.routeEdges(pgLayout.powerGraph.powerEdges, nudgeGap, function (e) { return e.source.routerNode.id; }, function (e) { return e.target.routerNode.id; });
    }
    cola.gridify = gridify;
    function route(nodes, groups, margin, groupMargin) {
        nodes.forEach(function (d) {
            d.routerNode = {
                name: d.name,
                bounds: d.bounds.inflate(-margin)
            };
        });
        groups.forEach(function (d) {
            d.routerNode = {
                bounds: d.bounds.inflate(-groupMargin),
                children: (typeof d.groups !== 'undefined' ? d.groups.map(function (c) { return nodes.length + c.id; }) : [])
                    .concat(typeof d.leaves !== 'undefined' ? d.leaves.map(function (c) { return c.index; }) : [])
            };
        });
        var gridRouterNodes = nodes.concat(groups).map(function (d, i) {
            d.routerNode.id = i;
            return d.routerNode;
        });
        return new cola.GridRouter(gridRouterNodes, {
            getChildren: function (v) { return v.children; },
            getBounds: function (v) { return v.bounds; }
        }, margin - groupMargin);
    }
    function powerGraphGridLayout(graph, size, grouppadding, margin, groupMargin) {
        // compute power graph
        var powerGraph;
        graph.nodes.forEach(function (v, i) { return v.index = i; });
        new cola.Layout()
            .avoidOverlaps(false)
            .nodes(graph.nodes)
            .links(graph.links)
            .powerGraphGroups(function (d) {
            powerGraph = d;
            powerGraph.groups.forEach(function (v) { return v.padding = grouppadding; });
        });
        // construct a flat graph with dummy nodes for the groups and edges connecting group dummy nodes to their children
        // power edges attached to groups are replaced with edges connected to the corresponding group dummy node
        var n = graph.nodes.length;
        var edges = [];
        var vs = graph.nodes.slice(0);
        vs.forEach(function (v, i) { return v.index = i; });
        powerGraph.groups.forEach(function (g) {
            var sourceInd = g.index = g.id + n;
            vs.push(g);
            if (typeof g.leaves !== 'undefined')
                g.leaves.forEach(function (v) { return edges.push({ source: sourceInd, target: v.index }); });
            if (typeof g.groups !== 'undefined')
                g.groups.forEach(function (gg) { return edges.push({ source: sourceInd, target: gg.id + n }); });
        });
        powerGraph.powerEdges.forEach(function (e) {
            edges.push({ source: e.source.index, target: e.target.index });
        });
        // layout the flat graph with dummy nodes and edges
        new cola.Layout()
            .size(size)
            .nodes(vs)
            .links(edges)
            .avoidOverlaps(false)
            .linkDistance(30)
            .symmetricDiffLinkLengths(5)
            .convergenceThreshold(1e-4)
            .start(100, 0, 0, 0, false);
        // final layout taking node positions from above as starting positions
        // subject to group containment constraints
        // and then gridifying the layout
        return {
            cola: new cola.Layout()
                .convergenceThreshold(1e-3)
                .size(size)
                .avoidOverlaps(true)
                .nodes(graph.nodes)
                .links(graph.links)
                .groupCompactness(1e-4)
                .linkDistance(30)
                .symmetricDiffLinkLengths(5)
                .powerGraphGroups(function (d) {
                powerGraph = d;
                powerGraph.groups.forEach(function (v) {
                    v.padding = grouppadding;
                });
            }).start(50, 0, 100, 0, false),
            powerGraph: powerGraph
        };
    }
    cola.powerGraphGridLayout = powerGraphGridLayout;
})(cola || (cola = {}));
///<reference path="../extern/d3.d.ts"/>
///<reference path="layout.ts"/>
var cola;
(function (cola) {
    var D3StyleLayoutAdaptor = (function (_super) {
        __extends(D3StyleLayoutAdaptor, _super);
        function D3StyleLayoutAdaptor() {
            _super.call(this);
            this.event = d3.dispatch(cola.EventType[cola.EventType.start], cola.EventType[cola.EventType.tick], cola.EventType[cola.EventType.end]);
            // bit of trickyness remapping 'this' so we can reference it in the function body.
            var d3layout = this;
            var drag;
            this.drag = function () {
                if (!drag) {
                    var drag = d3.behavior.drag()
                        .origin(cola.Layout.dragOrigin)
                        .on("dragstart.d3adaptor", cola.Layout.dragStart)
                        .on("drag.d3adaptor", function (d) {
                        cola.Layout.drag(d, d3.event);
                        d3layout.resume(); // restart annealing
                    })
                        .on("dragend.d3adaptor", cola.Layout.dragEnd);
                }
                if (!arguments.length)
                    return drag;
                // this is the context of the function, i.e. the d3 selection
                this //.on("mouseover.adaptor", colaMouseover)
                    .call(drag);
            };
        }
        D3StyleLayoutAdaptor.prototype.trigger = function (e) {
            var d3event = { type: cola.EventType[e.type], alpha: e.alpha, stress: e.stress };
            this.event[d3event.type](d3event); // via d3 dispatcher, e.g. event.start(e);
        };
        // iterate layout using a d3.timer, which queues calls to tick repeatedly until tick returns true
        D3StyleLayoutAdaptor.prototype.kick = function () {
            var _this = this;
            d3.timer(function () { return _super.prototype.tick.call(_this); });
        };
        // a function for binding to events on the adapter
        D3StyleLayoutAdaptor.prototype.on = function (eventType, listener) {
            if (typeof eventType === 'string') {
                this.event.on(eventType, listener);
            }
            else {
                this.event.on(cola.EventType[eventType], listener);
            }
            return this;
        };
        return D3StyleLayoutAdaptor;
    })(cola.Layout);
    cola.D3StyleLayoutAdaptor = D3StyleLayoutAdaptor;
    /**
     * provides an interface for use with d3:
     * - uses the d3 event system to dispatch layout events such as:
     *   o "start" (start layout process)
     *   o "tick" (after each layout iteration)
     *   o "end" (layout converged and complete).
     * - uses the d3 timer to queue layout iterations.
     * - sets up d3.behavior.drag to drag nodes
     *   o use `node.call(<the returned instance of Layout>.drag)` to make nodes draggable
     * returns an instance of the cola.Layout itself with which the user
     * can interact directly.
     */
    function d3adaptor() {
        return new D3StyleLayoutAdaptor();
    }
    cola.d3adaptor = d3adaptor;
})(cola || (cola = {}));
/// <reference path="rectangle.ts"/>
/// <reference path="shortestpaths.ts"/>
/// <reference path="geom.ts"/>
/// <reference path="vpsc.ts"/>
var cola;
(function (cola) {
    var NodeWrapper = (function () {
        function NodeWrapper(id, rect, children) {
            this.id = id;
            this.rect = rect;
            this.children = children;
            this.leaf = typeof children === 'undefined' || children.length === 0;
        }
        return NodeWrapper;
    })();
    cola.NodeWrapper = NodeWrapper;
    var Vert = (function () {
        function Vert(id, x, y, node, line) {
            if (node === void 0) { node = null; }
            if (line === void 0) { line = null; }
            this.id = id;
            this.x = x;
            this.y = y;
            this.node = node;
            this.line = line;
        }
        return Vert;
    })();
    cola.Vert = Vert;
    var LongestCommonSubsequence = (function () {
        function LongestCommonSubsequence(s, t) {
            this.s = s;
            this.t = t;
            var mf = LongestCommonSubsequence.findMatch(s, t);
            var tr = t.slice(0).reverse();
            var mr = LongestCommonSubsequence.findMatch(s, tr);
            if (mf.length >= mr.length) {
                this.length = mf.length;
                this.si = mf.si;
                this.ti = mf.ti;
                this.reversed = false;
            }
            else {
                this.length = mr.length;
                this.si = mr.si;
                this.ti = t.length - mr.ti - mr.length;
                this.reversed = true;
            }
        }
        LongestCommonSubsequence.findMatch = function (s, t) {
            var m = s.length;
            var n = t.length;
            var match = { length: 0, si: -1, ti: -1 };
            var l = new Array(m);
            for (var i = 0; i < m; i++) {
                l[i] = new Array(n);
                for (var j = 0; j < n; j++)
                    if (s[i] === t[j]) {
                        var v = l[i][j] = (i === 0 || j === 0) ? 1 : l[i - 1][j - 1] + 1;
                        if (v > match.length) {
                            match.length = v;
                            match.si = i - v + 1;
                            match.ti = j - v + 1;
                        }
                        ;
                    }
                    else
                        l[i][j] = 0;
            }
            return match;
        };
        LongestCommonSubsequence.prototype.getSequence = function () {
            return this.length >= 0 ? this.s.slice(this.si, this.si + this.length) : [];
        };
        return LongestCommonSubsequence;
    })();
    cola.LongestCommonSubsequence = LongestCommonSubsequence;
    var GridRouter = (function () {
        function GridRouter(originalnodes, accessor, groupPadding) {
            var _this = this;
            if (groupPadding === void 0) { groupPadding = 12; }
            this.originalnodes = originalnodes;
            this.groupPadding = groupPadding;
            this.leaves = null;
            this.nodes = originalnodes.map(function (v, i) { return new NodeWrapper(i, accessor.getBounds(v), accessor.getChildren(v)); });
            this.leaves = this.nodes.filter(function (v) { return v.leaf; });
            this.groups = this.nodes.filter(function (g) { return !g.leaf; });
            this.cols = this.getGridLines('x');
            this.rows = this.getGridLines('y');
            // create parents for each node or group that is a member of another's children
            this.groups.forEach(function (v) {
                return v.children.forEach(function (c) { return _this.nodes[c].parent = v; });
            });
            // root claims the remaining orphans
            this.root = { children: [] };
            this.nodes.forEach(function (v) {
                if (typeof v.parent === 'undefined') {
                    v.parent = _this.root;
                    _this.root.children.push(v.id);
                }
                // each node will have grid vertices associated with it,
                // some inside the node and some on the boundary
                // leaf nodes will have exactly one internal node at the center
                // and four boundary nodes
                // groups will have potentially many of each
                v.ports = [];
            });
            // nodes ordered by their position in the group hierarchy
            this.backToFront = this.nodes.slice(0);
            this.backToFront.sort(function (x, y) { return _this.getDepth(x) - _this.getDepth(y); });
            // compute boundary rectangles for each group
            // has to be done from front to back, i.e. inside groups to outside groups
            // such that each can be made large enough to enclose its interior
            var frontToBackGroups = this.backToFront.slice(0).reverse().filter(function (g) { return !g.leaf; });
            frontToBackGroups.forEach(function (v) {
                var r = cola.vpsc.Rectangle.empty();
                v.children.forEach(function (c) { return r = r.union(_this.nodes[c].rect); });
                v.rect = r.inflate(_this.groupPadding);
            });
            var colMids = this.midPoints(this.cols.map(function (r) { return r.pos; }));
            var rowMids = this.midPoints(this.rows.map(function (r) { return r.pos; }));
            // setup extents of lines
            var rowx = colMids[0], rowX = colMids[colMids.length - 1];
            var coly = rowMids[0], colY = rowMids[rowMids.length - 1];
            // horizontal lines
            var hlines = this.rows.map(function (r) { return { x1: rowx, x2: rowX, y1: r.pos, y2: r.pos }; })
                .concat(rowMids.map(function (m) { return { x1: rowx, x2: rowX, y1: m, y2: m }; }));
            // vertical lines
            var vlines = this.cols.map(function (c) { return { x1: c.pos, x2: c.pos, y1: coly, y2: colY }; })
                .concat(colMids.map(function (m) { return { x1: m, x2: m, y1: coly, y2: colY }; }));
            // the full set of lines
            var lines = hlines.concat(vlines);
            // we record the vertices associated with each line
            lines.forEach(function (l) { return l.verts = []; });
            // the routing graph
            this.verts = [];
            this.edges = [];
            // create vertices at the crossings of horizontal and vertical grid-lines
            hlines.forEach(function (h) {
                return vlines.forEach(function (v) {
                    var p = new Vert(_this.verts.length, v.x1, h.y1);
                    h.verts.push(p);
                    v.verts.push(p);
                    _this.verts.push(p);
                    // assign vertices to the nodes immediately under them
                    var i = _this.backToFront.length;
                    while (i-- > 0) {
                        var node = _this.backToFront[i], r = node.rect;
                        var dx = Math.abs(p.x - r.cx()), dy = Math.abs(p.y - r.cy());
                        if (dx < r.width() / 2 && dy < r.height() / 2) {
                            p.node = node;
                            break;
                        }
                    }
                });
            });
            lines.forEach(function (l, li) {
                // create vertices at the intersections of nodes and lines
                _this.nodes.forEach(function (v, i) {
                    v.rect.lineIntersections(l.x1, l.y1, l.x2, l.y2).forEach(function (intersect, j) {
                        //console.log(li+','+i+','+j+':'+intersect.x + ',' + intersect.y);
                        var p = new Vert(_this.verts.length, intersect.x, intersect.y, v, l);
                        _this.verts.push(p);
                        l.verts.push(p);
                        v.ports.push(p);
                    });
                });
                // split lines into edges joining vertices
                var isHoriz = Math.abs(l.y1 - l.y2) < 0.1;
                var delta = function (a, b) { return isHoriz ? b.x - a.x : b.y - a.y; };
                l.verts.sort(delta);
                for (var i = 1; i < l.verts.length; i++) {
                    var u = l.verts[i - 1], v = l.verts[i];
                    if (u.node && u.node === v.node && u.node.leaf)
                        continue;
                    _this.edges.push({ source: u.id, target: v.id, length: Math.abs(delta(u, v)) });
                }
            });
        }
        GridRouter.prototype.avg = function (a) { return a.reduce(function (x, y) { return x + y; }) / a.length; };
        // in the given axis, find sets of leaves overlapping in that axis
        // center of each GridLine is average of all nodes in column
        GridRouter.prototype.getGridLines = function (axis) {
            var columns = [];
            var ls = this.leaves.slice(0, this.leaves.length);
            while (ls.length > 0) {
                // find a column of all leaves overlapping in axis with the first leaf
                var overlapping = ls.filter(function (v) { return v.rect['overlap' + axis.toUpperCase()](ls[0].rect); });
                var col = {
                    nodes: overlapping,
                    pos: this.avg(overlapping.map(function (v) { return v.rect['c' + axis](); }))
                };
                columns.push(col);
                col.nodes.forEach(function (v) { return ls.splice(ls.indexOf(v), 1); });
            }
            columns.sort(function (a, b) { return a.pos - b.pos; });
            return columns;
        };
        // get the depth of the given node in the group hierarchy
        GridRouter.prototype.getDepth = function (v) {
            var depth = 0;
            while (v.parent !== this.root) {
                depth++;
                v = v.parent;
            }
            return depth;
        };
        // medial axes between node centres and also boundary lines for the grid
        GridRouter.prototype.midPoints = function (a) {
            var gap = a[1] - a[0];
            var mids = [a[0] - gap / 2];
            for (var i = 1; i < a.length; i++) {
                mids.push((a[i] + a[i - 1]) / 2);
            }
            mids.push(a[a.length - 1] + gap / 2);
            return mids;
        };
        // find path from v to root including both v and root
        GridRouter.prototype.findLineage = function (v) {
            var lineage = [v];
            do {
                v = v.parent;
                lineage.push(v);
            } while (v !== this.root);
            return lineage.reverse();
        };
        // find path connecting a and b through their lowest common ancestor
        GridRouter.prototype.findAncestorPathBetween = function (a, b) {
            var aa = this.findLineage(a), ba = this.findLineage(b), i = 0;
            while (aa[i] === ba[i])
                i++;
            // i-1 to include common ancestor only once (as first element)
            return { commonAncestor: aa[i - 1], lineages: aa.slice(i).concat(ba.slice(i)) };
        };
        // when finding a path between two nodes a and b, siblings of a and b on the
        // paths from a and b to their least common ancestor are obstacles
        GridRouter.prototype.siblingObstacles = function (a, b) {
            var _this = this;
            var path = this.findAncestorPathBetween(a, b);
            var lineageLookup = {};
            path.lineages.forEach(function (v) { return lineageLookup[v.id] = {}; });
            var obstacles = path.commonAncestor.children.filter(function (v) { return !(v in lineageLookup); });
            path.lineages
                .filter(function (v) { return v.parent !== path.commonAncestor; })
                .forEach(function (v) { return obstacles = obstacles.concat(v.parent.children.filter(function (c) { return c !== v.id; })); });
            return obstacles.map(function (v) { return _this.nodes[v]; });
        };
        // for the given routes, extract all the segments orthogonal to the axis x
        // and return all them grouped by x position
        GridRouter.getSegmentSets = function (routes, x, y) {
            // vsegments is a list of vertical segments sorted by x position
            var vsegments = [];
            for (var ei = 0; ei < routes.length; ei++) {
                var route = routes[ei];
                for (var si = 0; si < route.length; si++) {
                    var s = route[si];
                    s.edgeid = ei;
                    s.i = si;
                    var sdx = s[1][x] - s[0][x];
                    if (Math.abs(sdx) < 0.1) {
                        vsegments.push(s);
                    }
                }
            }
            vsegments.sort(function (a, b) { return a[0][x] - b[0][x]; });
            // vsegmentsets is a set of sets of segments grouped by x position
            var vsegmentsets = [];
            var segmentset = null;
            for (var i = 0; i < vsegments.length; i++) {
                var s = vsegments[i];
                if (!segmentset || Math.abs(s[0][x] - segmentset.pos) > 0.1) {
                    segmentset = { pos: s[0][x], segments: [] };
                    vsegmentsets.push(segmentset);
                }
                segmentset.segments.push(s);
            }
            return vsegmentsets;
        };
        // for all segments in this bundle create a vpsc problem such that
        // each segment's x position is a variable and separation constraints
        // are given by the partial order over the edges to which the segments belong
        // for each pair s1,s2 of segments in the open set:
        //   e1 = edge of s1, e2 = edge of s2
        //   if leftOf(e1,e2) create constraint s1.x + gap <= s2.x
        //   else if leftOf(e2,e1) create cons. s2.x + gap <= s1.x
        GridRouter.nudgeSegs = function (x, y, routes, segments, leftOf, gap) {
            var n = segments.length;
            if (n <= 1)
                return;
            var vs = segments.map(function (s) { return new cola.vpsc.Variable(s[0][x]); });
            var cs = [];
            for (var i = 0; i < n; i++) {
                for (var j = 0; j < n; j++) {
                    if (i === j)
                        continue;
                    var s1 = segments[i], s2 = segments[j], e1 = s1.edgeid, e2 = s2.edgeid, lind = -1, rind = -1;
                    // in page coordinates (not cartesian) the notion of 'leftof' is flipped in the horizontal axis from the vertical axis
                    // that is, when nudging vertical segments, if they increase in the y(conj) direction the segment belonging to the
                    // 'left' edge actually needs to be nudged to the right
                    // when nudging horizontal segments, if the segments increase in the x direction
                    // then the 'left' segment needs to go higher, i.e. to have y pos less than that of the right
                    if (x == 'x') {
                        if (leftOf(e1, e2)) {
                            //console.log('s1: ' + s1[0][x] + ',' + s1[0][y] + '-' + s1[1][x] + ',' + s1[1][y]);
                            if (s1[0][y] < s1[1][y]) {
                                lind = j, rind = i;
                            }
                            else {
                                lind = i, rind = j;
                            }
                        }
                    }
                    else {
                        if (leftOf(e1, e2)) {
                            if (s1[0][y] < s1[1][y]) {
                                lind = i, rind = j;
                            }
                            else {
                                lind = j, rind = i;
                            }
                        }
                    }
                    if (lind >= 0) {
                        //console.log(x+' constraint: ' + lind + '<' + rind);
                        cs.push(new cola.vpsc.Constraint(vs[lind], vs[rind], gap));
                    }
                }
            }
            var solver = new cola.vpsc.Solver(vs, cs);
            solver.solve();
            vs.forEach(function (v, i) {
                var s = segments[i];
                var pos = v.position();
                s[0][x] = s[1][x] = pos;
                var route = routes[s.edgeid];
                if (s.i > 0)
                    route[s.i - 1][1][x] = pos;
                if (s.i < route.length - 1)
                    route[s.i + 1][0][x] = pos;
            });
        };
        GridRouter.nudgeSegments = function (routes, x, y, leftOf, gap) {
            var vsegmentsets = GridRouter.getSegmentSets(routes, x, y);
            // scan the grouped (by x) segment sets to find co-linear bundles
            for (var i = 0; i < vsegmentsets.length; i++) {
                var ss = vsegmentsets[i];
                var events = [];
                for (var j = 0; j < ss.segments.length; j++) {
                    var s = ss.segments[j];
                    events.push({ type: 0, s: s, pos: Math.min(s[0][y], s[1][y]) });
                    events.push({ type: 1, s: s, pos: Math.max(s[0][y], s[1][y]) });
                }
                events.sort(function (a, b) { return a.pos - b.pos + a.type - b.type; });
                var open = [];
                var openCount = 0;
                events.forEach(function (e) {
                    if (e.type === 0) {
                        open.push(e.s);
                        openCount++;
                    }
                    else {
                        openCount--;
                    }
                    if (openCount == 0) {
                        GridRouter.nudgeSegs(x, y, routes, open, leftOf, gap);
                        open = [];
                    }
                });
            }
        };
        // obtain routes for the specified edges, nicely nudged apart
        // warning: edge paths may be reversed such that common paths are ordered consistently within bundles!
        // @param edges list of edges
        // @param nudgeGap how much to space parallel edge segements
        // @param source function to retrieve the index of the source node for a given edge
        // @param target function to retrieve the index of the target node for a given edge
        // @returns an array giving, for each edge, an array of segments, each segment a pair of points in an array
        GridRouter.prototype.routeEdges = function (edges, nudgeGap, source, target) {
            var _this = this;
            var routePaths = edges.map(function (e) { return _this.route(source(e), target(e)); });
            var order = cola.GridRouter.orderEdges(routePaths);
            var routes = routePaths.map(function (e) { return cola.GridRouter.makeSegments(e); });
            cola.GridRouter.nudgeSegments(routes, 'x', 'y', order, nudgeGap);
            cola.GridRouter.nudgeSegments(routes, 'y', 'x', order, nudgeGap);
            cola.GridRouter.unreverseEdges(routes, routePaths);
            return routes;
        };
        // path may have been reversed by the subsequence processing in orderEdges
        // so now we need to restore the original order
        GridRouter.unreverseEdges = function (routes, routePaths) {
            routes.forEach(function (segments, i) {
                var path = routePaths[i];
                if (path.reversed) {
                    segments.reverse(); // reverse order of segments
                    segments.forEach(function (segment) {
                        segment.reverse(); // reverse each segment
                    });
                }
            });
        };
        GridRouter.angleBetween2Lines = function (line1, line2) {
            var angle1 = Math.atan2(line1[0].y - line1[1].y, line1[0].x - line1[1].x);
            var angle2 = Math.atan2(line2[0].y - line2[1].y, line2[0].x - line2[1].x);
            var diff = angle1 - angle2;
            if (diff > Math.PI || diff < -Math.PI) {
                diff = angle2 - angle1;
            }
            return diff;
        };
        // does the path a-b-c describe a left turn?
        GridRouter.isLeft = function (a, b, c) {
            return ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) <= 0;
        };
        // for the given list of ordered pairs, returns a function that (efficiently) looks-up a specific pair to
        // see if it exists in the list
        GridRouter.getOrder = function (pairs) {
            var outgoing = {};
            for (var i = 0; i < pairs.length; i++) {
                var p = pairs[i];
                if (typeof outgoing[p.l] === 'undefined')
                    outgoing[p.l] = {};
                outgoing[p.l][p.r] = true;
            }
            return function (l, r) { return typeof outgoing[l] !== 'undefined' && outgoing[l][r]; };
        };
        // returns an ordering (a lookup function) that determines the correct order to nudge the
        // edge paths apart to minimize crossings
        GridRouter.orderEdges = function (edges) {
            var edgeOrder = [];
            for (var i = 0; i < edges.length - 1; i++) {
                for (var j = i + 1; j < edges.length; j++) {
                    var e = edges[i], f = edges[j], lcs = new cola.LongestCommonSubsequence(e, f);
                    var u, vi, vj;
                    if (lcs.length === 0)
                        continue; // no common subpath
                    if (lcs.reversed) {
                        // if we found a common subpath but one of the edges runs the wrong way,
                        // then reverse f.
                        f.reverse();
                        f.reversed = true;
                        lcs = new cola.LongestCommonSubsequence(e, f);
                    }
                    if ((lcs.si <= 0 || lcs.ti <= 0) &&
                        (lcs.si + lcs.length >= e.length || lcs.ti + lcs.length >= f.length)) {
                        // the paths do not diverge, so make an arbitrary ordering decision
                        edgeOrder.push({ l: i, r: j });
                        continue;
                    }
                    if (lcs.si + lcs.length >= e.length || lcs.ti + lcs.length >= f.length) {
                        // if the common subsequence of the
                        // two edges being considered goes all the way to the
                        // end of one (or both) of the lines then we have to
                        // base our ordering decision on the other end of the
                        // common subsequence
                        u = e[lcs.si + 1];
                        vj = e[lcs.si - 1];
                        vi = f[lcs.ti - 1];
                    }
                    else {
                        u = e[lcs.si + lcs.length - 2];
                        vi = e[lcs.si + lcs.length];
                        vj = f[lcs.ti + lcs.length];
                    }
                    if (GridRouter.isLeft(u, vi, vj)) {
                        edgeOrder.push({ l: j, r: i });
                    }
                    else {
                        edgeOrder.push({ l: i, r: j });
                    }
                }
            }
            //edgeOrder.forEach(function (e) { console.log('l:' + e.l + ',r:' + e.r) });
            return cola.GridRouter.getOrder(edgeOrder);
        };
        // for an orthogonal path described by a sequence of points, create a list of segments
        // if consecutive segments would make a straight line they are merged into a single segment
        // segments are over cloned points, not the original vertices
        GridRouter.makeSegments = function (path) {
            function copyPoint(p) {
                return { x: p.x, y: p.y };
            }
            var isStraight = function (a, b, c) { return Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) < 0.001; };
            var segments = [];
            var a = copyPoint(path[0]);
            for (var i = 1; i < path.length; i++) {
                var b = copyPoint(path[i]), c = i < path.length - 1 ? path[i + 1] : null;
                if (!c || !isStraight(a, b, c)) {
                    segments.push([a, b]);
                    a = b;
                }
            }
            return segments;
        };
        // find a route between node s and node t
        // returns an array of indices to verts
        GridRouter.prototype.route = function (s, t) {
            var _this = this;
            var source = this.nodes[s], target = this.nodes[t];
            this.obstacles = this.siblingObstacles(source, target);
            var obstacleLookup = {};
            this.obstacles.forEach(function (o) { return obstacleLookup[o.id] = o; });
            this.passableEdges = this.edges.filter(function (e) {
                var u = _this.verts[e.source], v = _this.verts[e.target];
                return !(u.node && u.node.id in obstacleLookup
                    || v.node && v.node.id in obstacleLookup);
            });
            // add dummy segments linking ports inside source and target
            for (var i = 1; i < source.ports.length; i++) {
                var u = source.ports[0].id;
                var v = source.ports[i].id;
                this.passableEdges.push({
                    source: u,
                    target: v,
                    length: 0
                });
            }
            for (var i = 1; i < target.ports.length; i++) {
                var u = target.ports[0].id;
                var v = target.ports[i].id;
                this.passableEdges.push({
                    source: u,
                    target: v,
                    length: 0
                });
            }
            var getSource = function (e) { return e.source; }, getTarget = function (e) { return e.target; }, getLength = function (e) { return e.length; };
            var shortestPathCalculator = new cola.shortestpaths.Calculator(this.verts.length, this.passableEdges, getSource, getTarget, getLength);
            var bendPenalty = function (u, v, w) {
                var a = _this.verts[u], b = _this.verts[v], c = _this.verts[w];
                var dx = Math.abs(c.x - a.x), dy = Math.abs(c.y - a.y);
                // don't count bends from internal node edges
                if (a.node === source && a.node === b.node || b.node === target && b.node === c.node)
                    return 0;
                return dx > 1 && dy > 1 ? 1000 : 0;
            };
            // get shortest path
            var shortestPath = shortestPathCalculator.PathFromNodeToNodeWithPrevCost(source.ports[0].id, target.ports[0].id, bendPenalty);
            // shortest path is reversed and does not include the target port
            var pathPoints = shortestPath.reverse().map(function (vi) { return _this.verts[vi]; });
            pathPoints.push(this.nodes[target.id].ports[0]);
            // filter out any extra end points that are inside the source or target (i.e. the dummy segments above)
            return pathPoints.filter(function (v, i) {
                return !(i < pathPoints.length - 1 && pathPoints[i + 1].node === source && v.node === source
                    || i > 0 && v.node === target && pathPoints[i - 1].node === target);
            });
        };
        GridRouter.getRoutePath = function (route, cornerradius, arrowwidth, arrowheight) {
            var result = {
                routepath: 'M ' + route[0][0].x + ' ' + route[0][0].y + ' ',
                arrowpath: ''
            };
            if (route.length > 1) {
                for (var i = 0; i < route.length; i++) {
                    var li = route[i];
                    var x = li[1].x, y = li[1].y;
                    var dx = x - li[0].x;
                    var dy = y - li[0].y;
                    if (i < route.length - 1) {
                        if (Math.abs(dx) > 0) {
                            x -= dx / Math.abs(dx) * cornerradius;
                        }
                        else {
                            y -= dy / Math.abs(dy) * cornerradius;
                        }
                        result.routepath += 'L ' + x + ' ' + y + ' ';
                        var l = route[i + 1];
                        var x0 = l[0].x, y0 = l[0].y;
                        var x1 = l[1].x;
                        var y1 = l[1].y;
                        dx = x1 - x0;
                        dy = y1 - y0;
                        var angle = GridRouter.angleBetween2Lines(li, l) < 0 ? 1 : 0;
                        //console.log(cola.GridRouter.angleBetween2Lines(li, l))
                        var x2, y2;
                        if (Math.abs(dx) > 0) {
                            x2 = x0 + dx / Math.abs(dx) * cornerradius;
                            y2 = y0;
                        }
                        else {
                            x2 = x0;
                            y2 = y0 + dy / Math.abs(dy) * cornerradius;
                        }
                        var cx = Math.abs(x2 - x);
                        var cy = Math.abs(y2 - y);
                        result.routepath += 'A ' + cx + ' ' + cy + ' 0 0 ' + angle + ' ' + x2 + ' ' + y2 + ' ';
                    }
                    else {
                        var arrowtip = [x, y];
                        var arrowcorner1, arrowcorner2;
                        if (Math.abs(dx) > 0) {
                            x -= dx / Math.abs(dx) * arrowheight;
                            arrowcorner1 = [x, y + arrowwidth];
                            arrowcorner2 = [x, y - arrowwidth];
                        }
                        else {
                            y -= dy / Math.abs(dy) * arrowheight;
                            arrowcorner1 = [x + arrowwidth, y];
                            arrowcorner2 = [x - arrowwidth, y];
                        }
                        result.routepath += 'L ' + x + ' ' + y + ' ';
                        if (arrowheight > 0) {
                            result.arrowpath = 'M ' + arrowtip[0] + ' ' + arrowtip[1] + ' L ' + arrowcorner1[0] + ' ' + arrowcorner1[1]
                                + ' L ' + arrowcorner2[0] + ' ' + arrowcorner2[1];
                        }
                    }
                }
            }
            else {
                var li = route[0];
                var x = li[1].x, y = li[1].y;
                var dx = x - li[0].x;
                var dy = y - li[0].y;
                var arrowtip = [x, y];
                var arrowcorner1, arrowcorner2;
                if (Math.abs(dx) > 0) {
                    x -= dx / Math.abs(dx) * arrowheight;
                    arrowcorner1 = [x, y + arrowwidth];
                    arrowcorner2 = [x, y - arrowwidth];
                }
                else {
                    y -= dy / Math.abs(dy) * arrowheight;
                    arrowcorner1 = [x + arrowwidth, y];
                    arrowcorner2 = [x - arrowwidth, y];
                }
                result.routepath += 'L ' + x + ' ' + y + ' ';
                if (arrowheight > 0) {
                    result.arrowpath = 'M ' + arrowtip[0] + ' ' + arrowtip[1] + ' L ' + arrowcorner1[0] + ' ' + arrowcorner1[1]
                        + ' L ' + arrowcorner2[0] + ' ' + arrowcorner2[1];
                }
            }
            return result;
        };
        return GridRouter;
    })();
    cola.GridRouter = GridRouter;
})(cola || (cola = {}));
/**
 * Use cola to do a layout in 3D!! Yay.
 * Pretty simple for the moment.
 */
var cola;
(function (cola) {
    var Link3D = (function () {
        function Link3D(source, target) {
            this.source = source;
            this.target = target;
        }
        Link3D.prototype.actualLength = function (x) {
            var _this = this;
            return Math.sqrt(x.reduce(function (c, v) {
                var dx = v[_this.target] - v[_this.source];
                return c + dx * dx;
            }, 0));
        };
        return Link3D;
    })();
    cola.Link3D = Link3D;
    var Node3D = (function () {
        function Node3D(x, y, z) {
            if (x === void 0) { x = 0; }
            if (y === void 0) { y = 0; }
            if (z === void 0) { z = 0; }
            this.x = x;
            this.y = y;
            this.z = z;
        }
        return Node3D;
    })();
    cola.Node3D = Node3D;
    var Layout3D = (function () {
        function Layout3D(nodes, links, idealLinkLength) {
            var _this = this;
            if (idealLinkLength === void 0) { idealLinkLength = 1; }
            this.nodes = nodes;
            this.links = links;
            this.idealLinkLength = idealLinkLength;
            this.constraints = null;
            this.useJaccardLinkLengths = true;
            this.result = new Array(Layout3D.k);
            for (var i = 0; i < Layout3D.k; ++i) {
                this.result[i] = new Array(nodes.length);
            }
            nodes.forEach(function (v, i) {
                for (var _i = 0, _a = Layout3D.dims; _i < _a.length; _i++) {
                    var dim = _a[_i];
                    if (typeof v[dim] == 'undefined')
                        v[dim] = Math.random();
                }
                _this.result[0][i] = v.x;
                _this.result[1][i] = v.y;
                _this.result[2][i] = v.z;
            });
        }
        ;
        Layout3D.prototype.linkLength = function (l) {
            return l.actualLength(this.result);
        };
        Layout3D.prototype.start = function (iterations) {
            var _this = this;
            if (iterations === void 0) { iterations = 100; }
            var n = this.nodes.length;
            var linkAccessor = new LinkAccessor();
            if (this.useJaccardLinkLengths)
                cola.jaccardLinkLengths(this.links, linkAccessor, 1.5);
            this.links.forEach(function (e) { return e.length *= _this.idealLinkLength; });
            // Create the distance matrix that Cola needs
            var distanceMatrix = (new cola.shortestpaths.Calculator(n, this.links, function (e) { return e.source; }, function (e) { return e.target; }, function (e) { return e.length; })).DistanceMatrix();
            var D = cola.Descent.createSquareMatrix(n, function (i, j) { return distanceMatrix[i][j]; });
            // G is a square matrix with G[i][j] = 1 iff there exists an edge between node i and node j
            // otherwise 2.
            var G = cola.Descent.createSquareMatrix(n, function () { return 2; });
            this.links.forEach(function (_a) {
                var source = _a.source, target = _a.target;
                return G[source][target] = G[target][source] = 1;
            });
            this.descent = new cola.Descent(this.result, D);
            this.descent.threshold = 1e-3;
            this.descent.G = G;
            //let constraints = this.links.map(e=> <any>{
            //    axis: 'y', left: e.source, right: e.target, gap: e.length*1.5
            //});
            if (this.constraints)
                this.descent.project = new cola.vpsc.Projection(this.nodes, null, null, this.constraints).projectFunctions();
            for (var i = 0; i < this.nodes.length; i++) {
                var v = this.nodes[i];
                if (v.fixed) {
                    this.descent.locks.add(i, [v.x, v.y, v.z]);
                }
            }
            this.descent.run(iterations);
            return this;
        };
        Layout3D.prototype.tick = function () {
            this.descent.locks.clear();
            for (var i = 0; i < this.nodes.length; i++) {
                var v = this.nodes[i];
                if (v.fixed) {
                    this.descent.locks.add(i, [v.x, v.y, v.z]);
                }
            }
            return this.descent.rungeKutta();
        };
        Layout3D.dims = ['x', 'y', 'z'];
        Layout3D.k = Layout3D.dims.length;
        return Layout3D;
    })();
    cola.Layout3D = Layout3D;
    var LinkAccessor = (function () {
        function LinkAccessor() {
        }
        LinkAccessor.prototype.getSourceIndex = function (e) { return e.source; };
        LinkAccessor.prototype.getTargetIndex = function (e) { return e.target; };
        LinkAccessor.prototype.getLength = function (e) { return e.length; };
        LinkAccessor.prototype.setLength = function (e, l) { e.length = l; };
        return LinkAccessor;
    })();
})(cola || (cola = {}));
//# sourceMappingURL=cola.js.map

// patch in conditional cola commonjs support
if( typeof module !== 'undefined' ){
  module.exports = cola;
}
