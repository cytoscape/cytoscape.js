import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// Round 123 (item 58): component packing on the discrete layouts —
// `packComponents: true` on circle, concentric, grid, breadthfirst and
// radial lays each component out on its own and packs the drawings
// under force's `componentSpacing` / `componentGroup` / `componentOrder`
// — the `pack` layout, which re-packs the components where they
// stand, and breadthfirst's trees-as-blocks default.

const node = (id, data = {}) => ({ group: 'nodes', data: { id, ...data } });
const edge = (s, t) => ({
  group: 'edges',
  data: { id: `${s}->${t}`, source: s, target: t },
});

/** a triangle (k), a path of four (p) and two singletons (s0, s1) */
const components = () => [
  node('k0'),
  node('k1'),
  node('k2'),
  edge('k0', 'k1'),
  edge('k1', 'k2'),
  edge('k2', 'k0'),
  node('p0'),
  node('p1'),
  node('p2'),
  node('p3'),
  edge('p0', 'p1'),
  edge('p1', 'p2'),
  edge('p2', 'p3'),
  node('s0'),
  node('s1'),
];

/** three trees: seven nodes (a), three (b) and a singleton (c) */
const trees = () => [
  node('a'),
  node('a1'),
  node('a2'),
  node('a3'),
  node('a11'),
  node('a12'),
  node('a13'),
  edge('a', 'a1'),
  edge('a', 'a2'),
  edge('a', 'a3'),
  edge('a1', 'a11'),
  edge('a1', 'a12'),
  edge('a1', 'a13'),
  node('b'),
  node('b1'),
  node('b2'),
  edge('b', 'b1'),
  edge('b', 'b2'),
  node('c'),
];

const PREFIXES = ['k', 'p', 's0', 's1'];

const overlaps = (a, b) =>
  a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;

const mk = (elements) => cytoscape({ headless: true, elements });

const group = (cy, prefix) =>
  cy.nodes().filter((n) => n.id().startsWith(prefix));

const boxOf = (cy, prefix) => group(cy, prefix).boundingBox();

const boxesDisjoint = (cy, prefixes = PREFIXES) => {
  const boxes = prefixes.map((p) => boxOf(cy, p));

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      expect(
        overlaps(boxes[i], boxes[j]),
        `${prefixes[i]} and ${prefixes[j]} overlap`,
      ).to.equal(false);
    }
  }
};

const run = (cy, options) => {
  const stopped = cy.promiseOn('layoutstop');

  cy.layout(options).run();

  return stopped;
};

const DISCRETE = ['circle', 'concentric', 'grid', 'breadthfirst', 'radial'];

describe('gpu/layout: component packing (round 123, item 58)', function () {
  describe('packComponents on the discrete layouts', function () {
    for (const name of DISCRETE) {
      it(`${name}: the component boxes are pairwise disjoint`, async function () {
        const cy = mk(components());

        await run(cy, { name, fit: false, packComponents: true });

        boxesDisjoint(cy);
      });
    }

    it('control: circle without packComponents is one ring — every node the same distance from one centre', async function () {
      const cy = mk(components());

      await run(cy, { name: 'circle', fit: false });

      const radii = cy.nodes().map((n) => {
        const p = n.position();

        return Math.round(Math.hypot(p.x - 400, p.y - 300));
      });

      expect(new Set(radii).size).to.equal(1);
      expect(radii[0]).to.be.greaterThan(0);
    });

    it('control: grid without packComponents is one lattice — three columns over the nine nodes', async function () {
      const cy = mk(components());

      await run(cy, { name: 'grid', fit: false });

      const xs = new Set(cy.nodes().map((n) => Math.round(n.position('x'))));

      expect(xs.size).to.equal(3);
    });

    it('circle: `sort` orders each ring, and a singleton is a point', async function () {
      const cy = mk(components());

      await run(cy, {
        name: 'circle',
        fit: false,
        packComponents: true,
        sort: (a, b) => b.id().localeCompare(a.id()),
      });

      // the first in sort order takes the start angle — the top of its
      // own ring
      const p = group(cy, 'p');
      const top = p.min((n) => n.position('y')).ele;

      expect(top.id()).to.equal('p3');
      expect(boxOf(cy, 's0').w).to.equal(cy.$id('s0').width());
    });

    it('concentric: the levels are binned per component — levelWidth sees each component alone', async function () {
      const seen = [];
      const cy = mk(components());

      await run(cy, {
        name: 'concentric',
        fit: false,
        packComponents: true,
        levelWidth: (nodes) => {
          seen.push(nodes.length);

          return 1;
        },
      });

      expect(seen.sort((a, b) => b - a)).to.deep.equal([4, 3, 1, 1]);

      // the path's inner nodes sit inside its outer ones, about its own
      // centre
      const p = group(cy, 'p');
      const centre = {
        x: (boxOf(cy, 'p').x1 + boxOf(cy, 'p').x2) / 2,
        y: (boxOf(cy, 'p').y1 + boxOf(cy, 'p').y2) / 2,
      };
      const dist = (id) => {
        const q = cy.$id(id).position();

        return Math.hypot(q.x - centre.x, q.y - centre.y);
      };

      expect(p.length).to.equal(4);
      expect(dist('p1')).to.be.lessThan(dist('p0'));
      expect(dist('p2')).to.be.lessThan(dist('p3'));

      const control = mk(components());
      const seenAll = [];

      await run(control, {
        name: 'concentric',
        fit: false,
        levelWidth: (nodes) => {
          seenAll.push(nodes.length);

          return 1;
        },
      });

      expect(seenAll).to.deep.equal([9]);
    });

    it('radial: each component is its own tree, its root at its own centre', async function () {
      const cy = mk(components());

      await run(cy, {
        name: 'radial',
        fit: false,
        packComponents: true,
        roots: ['k0', 'p1'],
      });

      const centreOf = (prefix) => {
        const box = boxOf(cy, prefix);

        return { x: (box.x1 + box.x2) / 2, y: (box.y1 + box.y2) / 2 };
      };
      const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

      // the triangle's root is exactly its drawing's centre (the two
      // children on opposite sides); the path's root is nearer its own
      // drawing's centre than the triangle's, its ring-2 leaf pulling
      // the box one way
      expect(dist(cy.$id('k0').position(), centreOf('k'))).to.be.lessThan(1);
      expect(dist(cy.$id('p1').position(), centreOf('p'))).to.be.lessThan(
        dist(cy.$id('p1').position(), centreOf('k')),
      );
    });

    it('grid: one grid per component — the path is a 2 × 2, a singleton one cell', async function () {
      const cy = mk(components());

      await run(cy, { name: 'grid', fit: false, packComponents: true });

      const xs = new Set(
        group(cy, 'p').map((n) => Math.round(n.position('x'))),
      );
      const ys = new Set(
        group(cy, 'p').map((n) => Math.round(n.position('y'))),
      );

      expect(xs.size).to.equal(2);
      expect(ys.size).to.equal(2);
      boxesDisjoint(cy);
    });

    it('componentGroup and componentOrder are the same spellings as force, on every discrete layout', async function () {
      for (const name of DISCRETE) {
        const cy = mk(components());
        const seen = [];

        await run(cy, {
          name,
          fit: false,
          packComponents: true,
          componentSpacing: 20,
          // breadthfirst's 1.75 would scale the packed gaps too
          spacingFactor: 1,
          // singletons left, the rest right
          componentGroup: (c) => {
            seen.push([c.size, c.nodes.length, c.width > 0, c.height > 0]);

            return c.size === 1 ? 0 : 1;
          },
          // within a group, smallest first
          componentOrder: (a, b) => a.size - b.size,
        });

        expect(seen.map((s) => s[0]).sort()).to.deep.equal([1, 1, 3, 4]);
        seen.forEach((s) => {
          expect(s[1]).to.equal(s[0]);
          expect(s[2] && s[3]).to.equal(true);
        });

        const singles = Math.max(boxOf(cy, 's0').x2, boxOf(cy, 's1').x2);
        const rest = Math.min(boxOf(cy, 'k').x1, boxOf(cy, 'p').x1);

        // the groups stand in a row a groupSpacing (three spacings)
        // apart — the packed boxes carry the layout's overlap padding,
        // so the bodies read up to a padding further apart
        expect(rest - singles, name).to.be.at.least(59.5);
        expect(rest - singles, name).to.be.at.most(80.5);
        // and the smaller component leads its group's packing
        expect(boxOf(cy, 'k').x1, name).to.be.lessThan(boxOf(cy, 'p').x1 + 1);
      }
    });

    it('throws at start when componentGroup or componentOrder is not a function', function () {
      for (const name of DISCRETE) {
        const cy = mk(components());

        expect(() =>
          cy
            .layout({ name, packComponents: true, componentGroup: 'sign' })
            .run(),
        ).to.throw(/componentGroup must be a function/);
        expect(() =>
          cy.layout({ name, packComponents: true, componentOrder: 1 }).run(),
        ).to.throw(/componentOrder must be a function/);
      }
    });

    it('a locked node holds, and the packed field lands clear of it', async function () {
      const cy = mk(components());

      // parked where the field would centre
      cy.$id('s1').position({ x: 400, y: 300 }).lock();

      await run(cy, { name: 'circle', fit: false, packComponents: true });

      expect(cy.$id('s1').position()).to.deep.equal({ x: 400, y: 300 });

      const field = cy
        .nodes()
        .filter((n) => n.id() !== 's1')
        .boundingBox();

      expect(overlaps(field, cy.$id('s1').boundingBox())).to.equal(false);
      boxesDisjoint(cy, ['k', 'p', 's0']);
    });

    it('an explicit boundingBox holds the packed field, scaled down never up', async function () {
      const cy = mk(components());
      const box = { x1: 100, y1: 100, w: 260, h: 220 };

      await run(cy, {
        name: 'circle',
        fit: false,
        packComponents: true,
        boundingBox: box,
      });

      const bb = cy.nodes().boundingBox();

      expect(bb.x1).to.be.at.least(box.x1 - 0.5);
      expect(bb.y1).to.be.at.least(box.y1 - 0.5);
      expect(bb.x2).to.be.at.most(box.x1 + box.w + 0.5);
      expect(bb.y2).to.be.at.most(box.y1 + box.h + 0.5);
    });

    it('animate: true ends where the synchronous run ends', async function () {
      const sync = mk(components());
      const anim = mk(components());

      await run(sync, { name: 'radial', fit: false, packComponents: true });
      await run(anim, {
        name: 'radial',
        fit: false,
        packComponents: true,
        animate: true,
        animationDuration: 30,
      });

      sync.nodes().forEach((n) => {
        const p = n.position();
        const q = anim.$id(n.id()).position();

        expect(q.x).to.be.closeTo(p.x, 0.01);
        expect(q.y).to.be.closeTo(p.y, 0.01);
      });
    });
  });

  describe('breadthfirst: trees as blocks (123.4, on by default)', function () {
    const rowsOf = (cy) => {
      const rows = new Map();

      cy.nodes().forEach((n) => {
        const y = Math.round(n.position('y'));

        if (!rows.has(y)) {
          rows.set(y, []);
        }

        rows.get(y).push(n);
      });

      return [...rows.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, nodes]) =>
          nodes.sort((p, q) => p.position('x') - q.position('x')),
        );
    };

    it('each rank is ordered tree-first, largest leftmost, and the trees share the depth rows', async function () {
      const cy = mk(trees());

      await run(cy, { name: 'breadthfirst', fit: false, directed: true });

      const rows = rowsOf(cy);

      expect(rows.length).to.equal(3);
      expect(rows[0].map((n) => n.id())).to.deep.equal(['a', 'b', 'c']);
      expect(rows[1].map((n) => n.id())).to.deep.equal([
        'a1',
        'a2',
        'a3',
        'b1',
        'b2',
      ]);
      expect(rows[2].map((n) => n.id())).to.deep.equal(['a11', 'a12', 'a13']);
    });

    it('a root stands above its own subtree, and the bands are a componentSpacing apart', async function () {
      const cy = mk(trees());

      await run(cy, {
        name: 'breadthfirst',
        fit: false,
        directed: true,
        spacingFactor: 1,
        componentSpacing: 50,
      });

      const x = (id) => cy.$id(id).position('x');

      // every rank centred in its tree's band: the root over the middle
      // of its children, the grandchildren about the same axis
      expect(x('a')).to.be.closeTo((x('a1') + x('a3')) / 2, 0.01);
      expect(x('b')).to.be.closeTo((x('b1') + x('b2')) / 2, 0.01);
      expect(x('a')).to.be.closeTo((x('a11') + x('a13')) / 2, 0.01);

      // the a band's right edge to the b band's left edge, bodies
      // included
      const aBox = group(cy, 'a').boundingBox();
      const bBox = group(cy, 'b').boundingBox();

      expect(bBox.x1 - aBox.x2).to.be.closeTo(50, 0.5);
      expect(overlaps(aBox, bBox)).to.equal(false);
    });

    it("one component is v3's picture — the same positions as before the bands", async function () {
      const cy = mk(trees().filter((el) => /^a/.test(el.data.id)));

      await run(cy, { name: 'breadthfirst', fit: false, directed: true });

      // the rank spread over the viewport, centred: the three children
      // symmetric about the root at the viewport centre
      const x = (id) => cy.$id(id).position('x');

      expect(x('a')).to.equal(400);
      expect(x('a1') + x('a3')).to.be.closeTo(800, 0.01);
      expect(x('a2')).to.equal(400);
    });

    it('depthSort orders within a tree, not across them', async function () {
      const cy = mk(trees());

      await run(cy, {
        name: 'breadthfirst',
        fit: false,
        directed: true,
        depthSort: (p, q) => q.id().localeCompare(p.id()),
      });

      expect(rowsOf(cy)[1].map((n) => n.id())).to.deep.equal([
        'a3',
        'a2',
        'a1',
        'b2',
        'b1',
      ]);
    });

    it('the bands wrap into shelves, and the singletons are rows in one block', async function () {
      // thirty singletons, eight pairs and one tree: in one rank v3 drew
      // a row fifty-four bands wide
      const els = [];

      for (let i = 0; i < 30; i++) {
        els.push(node(`s${i}`));
      }
      for (let i = 0; i < 8; i++) {
        els.push(node(`p${i}a`), node(`p${i}b`), edge(`p${i}a`, `p${i}b`));
      }
      els.push(
        node('t'),
        node('t1'),
        node('t2'),
        node('t11'),
        edge('t', 't1'),
        edge('t', 't2'),
        edge('t1', 't11'),
      );

      const cy = mk(els);

      await run(cy, {
        name: 'breadthfirst',
        fit: false,
        spacingFactor: 1,
        avoidOverlapPadding: 2,
      });

      // nothing overlaps
      const ns = cy.nodes();

      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          expect(
            overlaps(ns[i].boundingBox(), ns[j].boundingBox()),
            `${ns[i].id()} / ${ns[j].id()}`,
          ).to.equal(false);
        }
      }

      // the singletons are a block of rows, not one rank
      const rows = new Set(
        group(cy, 's').map((n) => Math.round(n.position('y'))),
      );

      expect(rows.size).to.be.greaterThan(1);

      // and the drawing wraps to about the viewport's width
      const bb = cy.nodes().boundingBox();

      expect(bb.w).to.be.lessThan(2 * 800);
      expect(bb.h).to.be.greaterThan(2 * 30);
    });

    it('packComponents: each tree alone and compact, the trees packed', async function () {
      const cy = mk(trees());

      await run(cy, {
        name: 'breadthfirst',
        fit: false,
        directed: true,
        packComponents: true,
      });

      const aBox = group(cy, 'a').boundingBox();
      const bBox = group(cy, 'b').boundingBox();
      const cBox = cy.$id('c').boundingBox();

      expect(overlaps(aBox, bBox)).to.equal(false);
      expect(overlaps(aBox, cBox)).to.equal(false);
      expect(overlaps(bBox, cBox)).to.equal(false);

      // compact: the rows a node height times the spacingFactor apart
      const y = (id) => cy.$id(id).position('y');

      expect(y('a1') - y('a')).to.be.closeTo(30 * 1.75, 0.5);
      expect(y('b1') - y('b')).to.be.closeTo(30 * 1.75, 0.5);
    });
  });

  describe("the pack layout: cy.layout({ name: 'pack' })", function () {
    /** the components fixture scattered so every box crosses another */
    const scattered = () => {
      const cy = mk(components());

      cy.nodes().forEach((n, i) => n.position({ x: i * 3, y: i * 2 }));

      return cy;
    };

    it('packs the components where they stand, the largest holding its centre', async function () {
      const cy = scattered();
      const before = boxOf(cy, 'p');
      const shape = group(cy, 'p').map((n) => ({ ...n.position() }));

      await run(cy, { name: 'pack', fit: false });

      boxesDisjoint(cy);

      const after = boxOf(cy, 'p');

      expect((after.x1 + after.x2) / 2).to.be.closeTo(
        (before.x1 + before.x2) / 2,
        0.01,
      );
      // translation only: the path keeps its shape
      group(cy, 'p').forEach((n, i) => {
        expect(n.position('x') - shape[i].x).to.be.closeTo(
          group(cy, 'p')[0].position('x') - shape[0].x,
          0.01,
        );
      });
    });

    it('takes the shared grouping and order', async function () {
      const cy = scattered();

      await run(cy, {
        name: 'pack',
        fit: false,
        componentSpacing: 20,
        groupSpacing: 100,
        componentGroup: (c) => (c.size > 1 ? 'big' : 'small'),
        componentOrder: (a, b) => a.size - b.size,
      });

      const big = Math.max(boxOf(cy, 'k').x2, boxOf(cy, 'p').x2);
      const small = Math.min(boxOf(cy, 's0').x1, boxOf(cy, 's1').x1);

      expect(small - big).to.be.closeTo(100, 0.5);
      expect(boxOf(cy, 'k').x1).to.be.lessThan(boxOf(cy, 'p').x1 + 1);
    });

    it('throws at start when the grouping is not a function', function () {
      const cy = scattered();

      expect(() =>
        cy.layout({ name: 'pack', componentGroup: 'x' }).run(),
      ).to.throw(/pack layout: componentGroup must be a function/);
    });

    it('a locked node never moves; its component packs by its free members', async function () {
      const cy = scattered();

      cy.$id('p0').lock();

      const held = { ...cy.$id('p0').position() };

      await run(cy, { name: 'pack', fit: false });

      expect(cy.$id('p0').position()).to.deep.equal(held);
      boxesDisjoint(cy, ['k', 's0', 's1']);
    });

    it('honours an explicit boundingBox after the pack', async function () {
      const cy = scattered();
      const box = { x1: 0, y1: 0, w: 150, h: 150 };

      await run(cy, { name: 'pack', fit: false, boundingBox: box });

      const bb = cy.nodes().boundingBox();

      expect(bb.x1).to.be.at.least(-0.5);
      expect(bb.y1).to.be.at.least(-0.5);
      expect(bb.x2).to.be.at.most(150.5);
      expect(bb.y2).to.be.at.most(150.5);
    });

    it('animate: true tweens to the packed places, one lifecycle', async function () {
      const sync = scattered();
      const anim = scattered();
      const log = [];

      for (const type of ['layoutstart', 'layoutready', 'layoutstop']) {
        anim.on(type, () => log.push(type));
      }

      await run(sync, { name: 'pack', fit: false });
      await run(anim, {
        name: 'pack',
        fit: false,
        animate: true,
        animationDuration: 30,
      });

      expect(log).to.deep.equal(['layoutstart', 'layoutready', 'layoutstop']);
      sync.nodes().forEach((n) => {
        const p = n.position();
        const q = anim.$id(n.id()).position();

        expect(q.x).to.be.closeTo(p.x, 0.01);
        expect(q.y).to.be.closeTo(p.y, 0.01);
      });
    });

    it('is a built-in the layout error names', function () {
      const cy = mk([]);

      expect(() => cy.layout({ name: 'cose' })).to.throw(/'pack'/);
    });
  });
});
