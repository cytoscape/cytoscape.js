/* eslint-disable no-unused-vars */

// Round 125.10: the airiness probe — the measurement for the *opposite*
// failure to overlap.  The quality suite (114.8, 115) asks whether two
// boxes intersect and whether a crammed run leaves some pair at the
// padding; the maintainer's first sitting for round 125 found the
// pictures wrong the other way — flow and breadthfirst on reactome too
// spread, every layout too airy under label-inclusive avoidOverlap —
// and nothing measured that.  These are the numbers a sitting reads:
//
//   nearestGaps(boxes)   for every box, the gap to its nearest neighbour
//                        (the larger of the axis separations; 0 when they
//                        touch or overlap), found through a quadtree so
//                        the app graphs stay cheap to probe
//   edgeGaps(edges)      for every edge, the gap between its endpoint
//                        boxes — the "too far from its parent" column
//   summary(values)      median, p90 and max, the three a table shows
//   airiness(cy, opts)   the whole readout for a graph as it stands
//
// One implementation, loaded as a page script by debug/index.html and
// required by the quality suite and the module suite through the same
// module.exports guard the other page modules carry.

var airiness = (function () {
  /** The separation between two boxes: the larger axis gap, 0 when the
   * boxes touch or intersect.  The metric every column here uses. */
  function boxGap(a, b) {
    var dx = Math.max(a.x1 - b.x2, b.x1 - a.x2, 0);
    var dy = Math.max(a.y1 - b.y2, b.y1 - a.y2, 0);

    return Math.max(dx, dy);
  }

  // -- the quadtree ----------------------------------------------------

  var LEAF = 8;
  var MAX_DEPTH = 24;

  function Quad(x1, y1, x2, y2, depth) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.depth = depth;
    this.items = [];
    this.kids = null;
  }

  Quad.prototype.insert = function (item) {
    if (this.kids != null) {
      this.kids[this.quadrantOf(item)].insert(item);
      return;
    }

    this.items.push(item);

    if (this.items.length > LEAF && this.depth < MAX_DEPTH) {
      this.split();
    }
  };

  Quad.prototype.quadrantOf = function (item) {
    var mx = (this.x1 + this.x2) / 2;
    var my = (this.y1 + this.y2) / 2;

    return (item.cx >= mx ? 1 : 0) + (item.cy >= my ? 2 : 0);
  };

  Quad.prototype.split = function () {
    var mx = (this.x1 + this.x2) / 2;
    var my = (this.y1 + this.y2) / 2;
    var d = this.depth + 1;

    this.kids = [
      new Quad(this.x1, this.y1, mx, my, d),
      new Quad(mx, this.y1, this.x2, my, d),
      new Quad(this.x1, my, mx, this.y2, d),
      new Quad(mx, my, this.x2, this.y2, d),
    ];

    var items = this.items;

    this.items = [];

    for (var i = 0; i < items.length; i++) {
      this.kids[this.quadrantOf(items[i])].insert(items[i]);
    }
  };

  /**
   * A quadtree over boxes, keyed by their centres.  Each quad also
   * carries the extent of the boxes under it (`ex1..ey2`), which is what
   * makes the nearest search prune: a quad whose box extent is farther
   * from the query than the best gap found so far holds nothing closer.
   *
   * @param boxes { x1, y1, x2, y2 }[]
   */
  function build(boxes) {
    var x1 = Infinity;
    var y1 = Infinity;
    var x2 = -Infinity;
    var y2 = -Infinity;
    var items = [];

    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      var cx = (b.x1 + b.x2) / 2;
      var cy = (b.y1 + b.y2) / 2;

      items.push({ i: i, box: b, cx: cx, cy: cy });
      x1 = Math.min(x1, cx);
      y1 = Math.min(y1, cy);
      x2 = Math.max(x2, cx);
      y2 = Math.max(y2, cy);
    }

    // a square root so the quadrants stay square-ish, and a hair of
    // slack so the max centre falls inside rather than on the edge
    var side = Math.max(x2 - x1, y2 - y1, 1) * 1.001;
    var root = new Quad(x1, y1, x1 + side, y1 + side, 0);

    for (i = 0; i < items.length; i++) {
      root.insert(items[i]);
    }

    extents(root);

    return root;
  }

  /** the union of the boxes under each quad, bottom-up */
  function extents(q) {
    q.ex1 = Infinity;
    q.ey1 = Infinity;
    q.ex2 = -Infinity;
    q.ey2 = -Infinity;

    var i;

    if (q.kids != null) {
      for (i = 0; i < 4; i++) {
        extents(q.kids[i]);
        q.ex1 = Math.min(q.ex1, q.kids[i].ex1);
        q.ey1 = Math.min(q.ey1, q.kids[i].ey1);
        q.ex2 = Math.max(q.ex2, q.kids[i].ex2);
        q.ey2 = Math.max(q.ey2, q.kids[i].ey2);
      }
    } else {
      for (i = 0; i < q.items.length; i++) {
        var b = q.items[i].box;

        q.ex1 = Math.min(q.ex1, b.x1);
        q.ey1 = Math.min(q.ey1, b.y1);
        q.ex2 = Math.max(q.ex2, b.x2);
        q.ey2 = Math.max(q.ey2, b.y2);
      }
    }
  }

  /** the nearest other box to `boxes[i]`: its index and the gap */
  function nearestOf(root, boxes, i) {
    var query = boxes[i];
    var best = { i: -1, gap: Infinity };

    var visit = function (q) {
      if (q.ex1 === Infinity) {
        return;
      }

      // the extent of the boxes under this quad, as one box: no member
      // can be nearer than the extent is
      if (
        boxGap(query, { x1: q.ex1, y1: q.ey1, x2: q.ex2, y2: q.ey2 }) >=
        best.gap
      ) {
        return;
      }

      var k;

      if (q.kids != null) {
        // nearer quadrants first, so the bound tightens early
        var order = [0, 1, 2, 3];
        var gaps = [];

        for (k = 0; k < 4; k++) {
          var kid = q.kids[k];

          gaps[k] =
            kid.ex1 === Infinity
              ? Infinity
              : boxGap(query, {
                  x1: kid.ex1,
                  y1: kid.ey1,
                  x2: kid.ex2,
                  y2: kid.ey2,
                });
        }

        order.sort(function (a, b) {
          return gaps[a] - gaps[b];
        });

        for (k = 0; k < 4; k++) {
          if (gaps[order[k]] < best.gap) {
            visit(q.kids[order[k]]);
          }
        }

        return;
      }

      for (k = 0; k < q.items.length; k++) {
        var item = q.items[k];

        if (item.i === i) {
          continue;
        }

        var gap = boxGap(query, item.box);

        // ties break by index, so the answer is a function of the input
        if (gap < best.gap || (gap === best.gap && item.i < best.i)) {
          best = { i: item.i, gap: gap };
        }
      }
    };

    visit(root);

    return best;
  }

  /**
   * For every box, the gap to its nearest neighbour and which one.
   * A single box has no neighbour: gap Infinity, index -1.
   *
   * @param boxes { x1, y1, x2, y2 }[]
   * @returns { gap: number, to: number }[]
   */
  function nearestGaps(boxes) {
    var out = [];

    if (boxes.length < 2) {
      for (var j = 0; j < boxes.length; j++) {
        out.push({ gap: Infinity, to: -1 });
      }

      return out;
    }

    var root = build(boxes);

    for (var i = 0; i < boxes.length; i++) {
      var best = nearestOf(root, boxes, i);

      out.push({ gap: best.gap, to: best.i });
    }

    return out;
  }

  /** the brute-force twin, for the specs' control and for tiny inputs */
  function nearestGapsSlow(boxes) {
    var out = [];

    for (var i = 0; i < boxes.length; i++) {
      var best = { gap: Infinity, to: -1 };

      for (var j = 0; j < boxes.length; j++) {
        if (j === i) {
          continue;
        }

        var gap = boxGap(boxes[i], boxes[j]);

        if (gap < best.gap || (gap === best.gap && j < best.to)) {
          best = { gap: gap, to: j };
        }
      }

      out.push(best);
    }

    return out;
  }

  /**
   * For every edge, the gap between its endpoint boxes — the distance a
   * reader's eye has to travel along the edge before the next node.
   *
   * @param edges { source: box, target: box }[]
   */
  function edgeGaps(edges) {
    var out = [];

    for (var i = 0; i < edges.length; i++) {
      out.push(boxGap(edges[i].source, edges[i].target));
    }

    return out;
  }

  /** an interpolated quantile of a sorted array */
  function quantile(sorted, q) {
    if (sorted.length === 0) {
      return NaN;
    }

    var pos = (sorted.length - 1) * q;
    var lo = Math.floor(pos);
    var hi = Math.ceil(pos);

    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  /**
   * median, p90 and max of a list, Infinity and NaN left out (a lone
   * box's gap, a missing measure); `n` says how many counted.
   */
  function summary(values) {
    var finite = [];

    for (var i = 0; i < values.length; i++) {
      if (Number.isFinite(values[i])) {
        finite.push(values[i]);
      }
    }

    finite.sort(function (a, b) {
      return a - b;
    });

    return {
      n: finite.length,
      median: quantile(finite, 0.5),
      p90: quantile(finite, 0.9),
      max: finite.length ? finite[finite.length - 1] : NaN,
    };
  }

  /**
   * The readout for a graph as it stands: the nearest-box gaps over the
   * leaf nodes, the endpoint gaps over the edges, and the median node
   * size the gaps are read against.  `nodeGap.median / size` is the
   * one number a sitting compares between runs: 1 means the typical
   * node's nearest neighbour is a node-size away.
   *
   * @param cy the instance
   * @param opts { labels: measure label boxes (default false) }
   */
  function airiness(cy, opts) {
    opts = opts || {};

    var labels = opts.labels === true;
    var nodes = cy.nodes().filter(function (n) {
      return !n.isParent();
    });
    var boxes = [];
    var sizes = [];
    var index = {};

    nodes.forEach(function (n, i) {
      var b = n.boundingBox({ includeLabels: labels });

      boxes.push(b);
      sizes.push(Math.max(b.w, b.h));
      index[n.id()] = i;
    });

    var gaps = nearestGaps(boxes).map(function (g) {
      return g.gap;
    });
    var edges = [];

    cy.edges().forEach(function (e) {
      var s = index[e.source().id()];
      var t = index[e.target().id()];

      if (s != null && t != null && s !== t) {
        edges.push({ source: boxes[s], target: boxes[t] });
      }
    });

    var size = summary(sizes).median;
    var nodeGap = summary(gaps);
    var edgeGap = summary(edgeGaps(edges));

    return {
      nodes: nodes.length,
      size: size,
      nodeGap: nodeGap,
      edgeGap: edgeGap,
      /** the headline: median nearest gap in node sizes */
      ratio: size > 0 ? nodeGap.median / size : NaN,
    };
  }

  /** one line for the page's readout and the record's tables */
  function format(a) {
    var px = function (v) {
      return Number.isFinite(v) ? v.toFixed(0) + ' px' : '—';
    };

    return (
      'nearest gap median ' +
      px(a.nodeGap.median) +
      ', p90 ' +
      px(a.nodeGap.p90) +
      ' (' +
      (Number.isFinite(a.ratio) ? a.ratio.toFixed(2) : '—') +
      '× node size); edge gap median ' +
      px(a.edgeGap.median) +
      ', p90 ' +
      px(a.edgeGap.p90) +
      ', max ' +
      px(a.edgeGap.max)
    );
  }

  return {
    boxGap: boxGap,
    build: build,
    nearestGaps: nearestGaps,
    nearestGapsSlow: nearestGapsSlow,
    edgeGaps: edgeGaps,
    summary: summary,
    airiness: airiness,
    format: format,
  };
})();

// see debug/fixtures.js — the module suite loads this as a script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = airiness;
}
