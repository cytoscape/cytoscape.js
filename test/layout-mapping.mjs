import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// round 85.3 (#1514): the data-driven layout mapping spellings — the
// score shape ({ data, scale?, range?, invert?, default? }) on
// force.edgeLength and concentric.concentric, and the sort shape
// ({ data, order? }) on grid.sort / circle.sort /
// breadthfirst.depthSort.  Serializable and canonical; the fn forms
// stay as escape hatches.  Resolution is once at layout start; a
// typo'd key or a wrong-kind column throws rather than defaulting
// into a plausibly wrong layout.

describe('gpu/layout: data mappings (round 85.3)', function () {
  var cy;

  var mk = (elements) =>
    (cy = cytoscape({
      headlessWidth: 400,
      headlessHeight: 400,
      elements,
    }));

  var dist = (idA, idB) => {
    var a = cy.$id(idA).position();
    var b = cy.$id(idB).position();

    return Math.hypot(b.x - a.x, b.y - a.y);
  };

  describe('force.edgeLength score mapping', function () {
    var path = (edgeData) =>
      mk([
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' } },
        { data: { id: 'ab', source: 'a', target: 'b', ...edgeData('ab') } },
        { data: { id: 'bc', source: 'b', target: 'c', ...edgeData('bc') } },
      ]);

    var settle = (edgeLength) =>
      cy
        .layout({
          name: 'force',
          seed: 7,
          fit: false,
          iterations: 600,
          edgeLength,
        })
        .run();

    it('a { data } passthrough drives per-edge settled distances', function () {
      // data lengths 50 vs 200: the settled neighbor-distance ratio
      // follows — while the constant-edgeLength control on the same
      // graph reads ~1:1, so the pair discriminates
      path((id) => ({ len: id === 'ab' ? 50 : 200 }));
      settle({ data: 'len' });

      expect(dist('b', 'c') / dist('a', 'b')).to.be.above(2);

      settle(125);

      var ratio = dist('b', 'c') / dist('a', 'b');

      expect(ratio).to.be.above(0.7);
      expect(ratio).to.be.below(1.4);
    });

    it('scale + range + invert: large scores settle short', function () {
      // the FAQ recipe: affinity scores, log-scaled, inverted — the
      // score-1 edge takes range[1] px and the score-100 edge range[0]
      path((id) => ({ score: id === 'ab' ? 1 : 100 }));
      settle({ data: 'score', scale: 'log', range: [50, 200], invert: true });

      expect(dist('a', 'b') / dist('b', 'c')).to.be.above(2);
    });

    it('a missing value takes default, then the option default', function () {
      path((id) => (id === 'ab' ? { len: 50 } : {}));
      settle({ data: 'len', default: 200 });

      expect(dist('b', 'c') / dist('a', 'b')).to.be.above(2);
    });

    it('throws on an unknown key and on a non-number column', function () {
      path((id) => ({ name: 'edge-' + id, len: 5 }));

      expect(() => settle({ data: 'lne' })).to.throw(
        /edgeLength mapping reads data key 'lne', but no such edges data column exists/,
      );
      expect(() => settle({ data: 'name' })).to.throw(
        /edgeLength mapping reads data key 'name', but its column is string — a number column is required/,
      );
    });

    it('throws on a malformed mapping, loudly', function () {
      path(() => ({ len: 5 }));

      expect(() => settle({ data: 'len', invert: true })).to.throw(
        /needs a range to use scale or invert/,
      );
      expect(() => settle({ data: 'len', scale: 'log2' })).to.throw(
        /scale 'log2' is unknown/,
      );
      expect(() => settle({ data: 'len', range: [1] })).to.throw(
        /range must be \[min, max\] numbers/,
      );
    });
  });

  describe('concentric score mapping', function () {
    var star = (ranks) =>
      mk([
        ...['hub', 'l1', 'l2', 'l3'].map((id) => ({
          data: { id, rank: ranks[id] },
        })),
        { data: { id: 'e1', source: 'hub', target: 'l1' } },
        { data: { id: 'e2', source: 'hub', target: 'l2' } },
        { data: { id: 'e3', source: 'hub', target: 'l3' } },
      ]);

    var center = { x: 200, y: 200 };
    var radiusOf = (id) => {
      var p = cy.$id(id).position();

      return Math.hypot(p.x - center.x, p.y - center.y);
    };

    it('{ data } puts the highest score at the center', function () {
      // by degree the hub would centre; the rank column says l2 —
      // which is what discriminates the mapping from the default
      star({ hub: 1, l1: 1, l2: 100, l3: 1 });
      cy.layout({
        name: 'concentric',
        fit: false,
        concentric: { data: 'rank' },
        levelWidth: () => 10,
      }).run();

      expect(radiusOf('l2')).to.be.closeTo(0, 1e-3);
      expect(radiusOf('hub')).to.be.above(0);
      // the resolved score lands in scratch, as the fn form's does
      expect(cy.$id('l2').scratch('concentric')).to.equal(100);
    });

    it('throws on an unknown nodes key', function () {
      star({ hub: 1, l1: 1, l2: 2, l3: 3 });

      expect(() =>
        cy.layout({ name: 'concentric', concentric: { data: 'rnk' } }).run(),
      ).to.throw(
        /concentric mapping reads data key 'rnk', but no such nodes data column exists/,
      );
    });
  });

  describe('sort mappings', function () {
    var quad = (ords) =>
      mk(
        ['n0', 'n1', 'n2', 'n3'].map((id) => ({
          data: ords[id] === undefined ? { id } : { id, ord: ords[id] },
        })),
      );

    it('circle: orders around the ring, matching the fn form exactly', function () {
      quad({ n0: 3, n1: 1, n2: 4, n3: 2 });
      cy.layout({
        name: 'circle',
        fit: false,
        startAngle: 0,
        radius: 100,
        avoidOverlap: false,
        sort: { data: 'ord' },
      }).run();

      var mapped = {};

      cy.nodes().forEach((n) => (mapped[n.id()] = { ...n.position() }));

      cy.layout({
        name: 'circle',
        fit: false,
        startAngle: 0,
        radius: 100,
        avoidOverlap: false,
        sort: (a, b) => a.data('ord') - b.data('ord'),
      }).run();

      cy.nodes().forEach((n) => {
        expect(n.position().x).to.be.closeTo(mapped[n.id()].x, 1e-3);
        expect(n.position().y).to.be.closeTo(mapped[n.id()].y, 1e-3);
      });

      // smallest ord (n1) sits at startAngle 0: to the right of center
      expect(mapped.n1.x).to.be.closeTo(300, 1e-3);
      expect(mapped.n1.y).to.be.closeTo(200, 1e-3);
    });

    it('descending flips the order; missing values sort last either way', function () {
      quad({ n0: 3, n1: 1, n2: 4 }); // n3 has no ord
      cy.layout({
        name: 'circle',
        fit: false,
        startAngle: 0,
        radius: 100,
        avoidOverlap: false,
        sort: { data: 'ord', order: 'descending' },
      }).run();

      // largest ord (n2) leads; the missing-ord node still trails
      expect(cy.$id('n2').position().x).to.be.closeTo(300, 1e-3);

      var angleOf = (id) => {
        var p = cy.$id(id).position();

        return (Math.atan2(p.y - 200, p.x - 200) + 2 * Math.PI) % (2 * Math.PI);
      };

      expect(angleOf('n3')).to.be.above(angleOf('n0'));
    });

    it('grid: the sort mapping matches its comparator twin', function () {
      quad({ n0: 2, n1: 4, n2: 1, n3: 3 });
      cy.layout({ name: 'grid', fit: false, sort: { data: 'ord' } }).run();

      var mapped = {};

      cy.nodes().forEach((n) => (mapped[n.id()] = { ...n.position() }));

      cy.layout({
        name: 'grid',
        fit: false,
        sort: (a, b) => a.data('ord') - b.data('ord'),
      }).run();

      cy.nodes().forEach((n) => {
        expect(n.position()).to.deep.equal(mapped[n.id()]);
      });
    });

    it('breadthfirst: depthSort mapping orders within a depth', function () {
      mk([
        { data: { id: 'r' } },
        { data: { id: 'x', ord: 2 } },
        { data: { id: 'y', ord: 1 } },
        { data: { id: 'rx', source: 'r', target: 'x' } },
        { data: { id: 'ry', source: 'r', target: 'y' } },
      ]);
      cy.layout({
        name: 'breadthfirst',
        fit: false,
        directed: true,
        roots: ['r'],
        depthSort: { data: 'ord' },
      }).run();

      // smaller ord sorts first — leftmost in the row
      expect(cy.$id('y').position().x).to.be.below(cy.$id('x').position().x);

      cy.layout({
        name: 'breadthfirst',
        fit: false,
        directed: true,
        roots: ['r'],
        depthSort: { data: 'ord', order: 'descending' },
      }).run();

      expect(cy.$id('x').position().x).to.be.below(cy.$id('y').position().x);
    });

    it('throws on an unknown key and on a mixed column', function () {
      mk([{ data: { id: 'n0', tag: 1 } }, { data: { id: 'n1', tag: 'one' } }]);

      expect(() =>
        cy.layout({ name: 'circle', sort: { data: 'org' } }).run(),
      ).to.throw(
        /sort mapping reads data key 'org', but no such nodes data column exists/,
      );
      expect(() =>
        cy.layout({ name: 'circle', sort: { data: 'tag' } }).run(),
      ).to.throw(
        /sort mapping reads data key 'tag', but its column is mixed — a number or string column is required/,
      );
    });

    it('a string column sorts lexically', function () {
      mk([
        { data: { id: 'n0', label: 'cherry' } },
        { data: { id: 'n1', label: 'apple' } },
        { data: { id: 'n2', label: 'banana' } },
      ]);
      cy.layout({
        name: 'circle',
        fit: false,
        startAngle: 0,
        radius: 100,
        avoidOverlap: false,
        sort: { data: 'label' },
      }).run();

      // 'apple' first: at startAngle
      expect(cy.$id('n1').position().x).to.be.closeTo(300, 1e-3);
    });
  });
});
