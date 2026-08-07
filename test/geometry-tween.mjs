import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { FLAG_PARENT } from '../src/contract.mjs';

/*
Round 25: geometry tweens — the geometry numerics (node width/height,
edge width, parent padding, font-size) animate and transition on the
CPU path with the per-tick invalidation cascade.

Geometry tweens never offload and are never stale: every tick is a CPU
column write, so `width()`/`bb()`/pick mid-tween report the mid-flight
value (v3's behaviour) — unlike leased paint/position tweens.

25.1: the lane write kind + node width/height.  A node size write
re-anchors the label (the cascade hole the style engine's same-pass
writeLabel used to paper over) and drives compound auto-bounds per
tick; the CMPD excursion bound stays fresh through the parent's own
materialization (the containment argument — see PLAN.md round 25).

Ticks drive deterministically via cy._animations.tick(now), as in
test/animation.mjs.
*/

describe('gpu/animation: geometry tweens (round 25)', function () {
  const makeCy = (opts = {}) =>
    cytoscape({
      elements: [{ data: { id: 'a' }, position: { x: 0, y: 0 } }],
      ...opts,
    });

  const slotOf = (cy, id) => cy._store.lookup(id).slot;
  const sizeOf = (cy, id) => {
    const s = slotOf(cy, id);
    const c = cy._store.column('node.size');

    return { w: c[s * 2], h: c[s * 2 + 1] };
  };
  const drive = (cy, ...times) => {
    for (const t of times) {
      cy._animations.tick(t);
    }
  };

  describe('node width/height (25.1)', function () {
    it('tweens width and height to their targets', function () {
      const cy = makeCy();
      const a = cy.$id('a');

      a.animation({
        style: { width: 60, height: 90 },
        duration: 100,
        easing: 'linear',
      }).play();

      drive(cy, 0, 50);
      expect(sizeOf(cy, 'a').w).to.be.closeTo(45, 1e-4); // 30 → 60
      expect(sizeOf(cy, 'a').h).to.be.closeTo(60, 1e-4); // 30 → 90

      drive(cy, 100);
      expect(sizeOf(cy, 'a').w).to.equal(60);
      expect(sizeOf(cy, 'a').h).to.equal(90);
    });

    it('a width-only tween leaves height untouched', function () {
      const cy = makeCy({ style: { nodes: { height: 50 } } });
      const a = cy.$id('a');

      a.animation({
        style: { width: 100 },
        duration: 100,
        easing: 'linear',
      }).play();

      drive(cy, 0, 50);
      expect(sizeOf(cy, 'a').w).to.be.closeTo(65, 1e-4);
      expect(sizeOf(cy, 'a').h).to.equal(50);
    });

    it('width()/height()/boundingBox read the mid-flight value (never stale)', function () {
      const cy = makeCy();
      const a = cy.$id('a');

      a.animation({
        style: { width: 70, height: 110 },
        duration: 100,
        easing: 'linear',
      }).play();

      drive(cy, 0, 50);
      expect(a.width()).to.be.closeTo(50, 1e-4);
      expect(a.height()).to.be.closeTo(70, 1e-4);

      const bb = a.boundingBox({ includeLabels: false });

      expect(bb.w).to.be.closeTo(50, 1e-4);
      expect(bb.h).to.be.closeTo(70, 1e-4);
    });

    it('the outerHalf column follows every tick', function () {
      const cy = makeCy({ style: { nodes: { 'border-width': 4 } } });
      const a = cy.$id('a');
      const s = slotOf(cy, 'a');

      a.animation({
        style: { width: 60 },
        duration: 100,
        easing: 'linear',
      }).play();

      drive(cy, 0, 50);
      const outer = cy._store.column('node.outerHalf');

      expect(outer[s * 2]).to.be.closeTo(45 / 2 + 2, 1e-4); // w/2 + border/2
      expect(outer[s * 2 + 1]).to.be.closeTo(30 / 2 + 2, 1e-4);
    });

    it('re-anchors a hanging label as the size tweens', function () {
      const cy = makeCy({
        style: {
          nodes: {
            label: { data: 'id' },
            'text-halign': 'left',
            'text-valign': 'top',
          },
        },
      });
      const a = cy.$id('a');
      const s = slotOf(cy, 'a');
      const anchor = () => {
        const e = cy._store.labelAt(s, 'nodes');

        return { x: e.anchorX, y: e.anchorY };
      };

      expect(anchor().x).to.be.closeTo(-15, 1e-4); // left = -w/2

      a.animation({
        style: { width: 60, height: 90 },
        duration: 100,
        easing: 'linear',
      }).play();

      drive(cy, 0, 50);
      expect(anchor().x).to.be.closeTo(-22.5, 1e-4); // -45/2
      expect(anchor().y).to.be.lessThan(-28); // top hangs above -h/2

      drive(cy, 100);
      expect(anchor().x).to.be.closeTo(-30, 1e-4);
    });

    it('a child size tween drives the parent auto-bounds per tick', function () {
      const cy = cytoscape({
        style: { parents: { padding: 0, 'border-width': 0 } },
        elements: [
          { data: { id: 'p' } },
          { data: { id: 'a', parent: 'p' }, position: { x: 0, y: 0 } },
        ],
      });
      const a = cy.$id('a');
      const p = cy.$id('p');

      a.animation({
        style: { width: 200 },
        duration: 100,
        easing: 'linear',
      }).play();

      drive(cy, 0, 50);
      cy._store.flushDerived();
      expect(p.width()).to.be.closeTo(115, 1e-3); // the child's tweened 115

      drive(cy, 100);
      cy._store.flushDerived();
      expect(p.width()).to.be.closeTo(200, 1e-3);
    });

    it('keeps the compound-loop excursion bound fresh through parent growth', function () {
      const cy = cytoscape({
        style: { parents: { padding: 0, 'border-width': 0 } },
        elements: [
          { data: { id: 'p' } },
          { data: { id: 'a', parent: 'p' }, position: { x: 0, y: 0 } },
          { data: { id: 'b', parent: 'p' }, position: { x: 100, y: 0 } },
          { data: { id: 'ap', source: 'a', target: 'p' } },
        ],
      });
      const store = cy._store;
      const es = cy.$id('ap')._first().slot;

      store.flushDerived();
      const p2Before = store.column('edge.curveParams')[es * 4 + 2];

      // grow the child far enough that the parent's stretch leaves the
      // 0.5 floor (parent width 130 → 430; ln(2·215·0.01) ≈ 1.46)
      cy.$id('a')
        .animation({ style: { width: 360 }, duration: 100, easing: 'linear' })
        .play();
      drive(cy, 0, 100);
      store.flushDerived();

      const p2After = store.column('edge.curveParams')[es * 4 + 2];

      expect(p2After).to.be.greaterThan(p2Before);
    });

    it('skips compound parents (auto-bounds own the size column)', function () {
      const cy = cytoscape({
        style: { parents: { padding: 0, 'border-width': 0 } },
        elements: [
          { data: { id: 'p' } },
          { data: { id: 'a', parent: 'p' }, position: { x: 0, y: 0 } },
        ],
      });
      const p = cy.$id('p');
      const s = slotOf(cy, 'p');

      expect((cy._store.flags('nodes', s) & FLAG_PARENT) !== 0).to.equal(true);

      cy._store.flushDerived();
      const before = sizeOf(cy, 'p');
      const handle = p.animation({
        style: { width: 500 },
        duration: 100,
        easing: 'linear',
      });

      handle.play();
      drive(cy, 0, 50, 100);
      cy._store.flushDerived();

      expect(sizeOf(cy, 'p')).to.deep.equal(before); // derived, not tweened
    });

    it('width and height share the node.size channel: latest wins', function () {
      const cy = makeCy();
      const a = cy.$id('a');
      const first = a.animation({
        style: { width: 100 },
        duration: 100,
        easing: 'linear',
      });

      first.play();
      drive(cy, 0, 50);
      expect(sizeOf(cy, 'a').w).to.be.closeTo(65, 1e-4);

      // starting a height tween overlaps the node.size channel: the
      // width tween stops in place (round 21, one channel per column)
      a.animation({
        style: { height: 200 },
        duration: 100,
        easing: 'linear',
      }).play();
      drive(cy, 60, 150);

      expect(sizeOf(cy, 'a').w).to.be.closeTo(65, 1e-4); // frozen where evicted
      expect(sizeOf(cy, 'a').h).to.be.closeTo(183, 1); // the height tween runs on

      expect(first.playing()).to.equal(false);
    });

    it('reverse mid-flight is value-continuous and lands at the start', function () {
      const cy = makeCy();
      const a = cy.$id('a');
      const handle = a.animation({
        style: { width: 90 },
        duration: 100,
        easing: 'linear',
      });

      handle.play();
      drive(cy, 0, 60);
      expect(sizeOf(cy, 'a').w).to.be.closeTo(66, 1e-4);

      handle.reverse();
      drive(cy, 61);
      expect(sizeOf(cy, 'a').w).to.be.closeTo(65.4, 0.1); // continuous at the pivot

      drive(cy, 130);
      expect(sizeOf(cy, 'a').w).to.equal(30); // back at the captured start
    });

    it('clamps a bouncy easing at the scalar floor (no negative sizes)', function () {
      const cy = makeCy();
      const a = cy.$id('a');

      a.animation({
        style: { width: 0 },
        duration: 100,
        easing: 'spring(1)',
      }).play();

      const seen = [];

      // a spring's duration is perceptual — the run extends past it by
      // durationScale while the ringing decays, so drive well beyond
      for (let t = 0; t <= 2000; t += 5) {
        cy._animations.tick(t);
        seen.push(sizeOf(cy, 'a').w);
      }

      expect(Math.min(...seen)).to.be.at.least(0);
      expect(seen[seen.length - 1]).to.equal(0);
    });

    it('edge width: tweens the width column with width() reading live', function () {
      const cy = cytoscape({
        elements: [
          { data: { id: 'a' }, position: { x: 0, y: 0 } },
          { data: { id: 'b' }, position: { x: 100, y: 0 } },
          { data: { id: 'ab', source: 'a', target: 'b' } },
        ],
      });
      const ab = cy.$id('ab');
      const from = ab.width();

      ab.animation({
        style: { width: from + 10 },
        duration: 100,
        easing: 'linear',
      }).play();

      drive(cy, 0, 50);
      expect(ab.width()).to.be.closeTo(from + 5, 1e-4);

      drive(cy, 100);
      expect(ab.width()).to.equal(from + 10);
    });

    it('edge width: match-line and percent arrow widths ride; numbers stay', function () {
      const cy = cytoscape({
        style: {
          edges: {
            'source-arrow-shape': 'triangle',
            'target-arrow-shape': 'triangle',
            'source-arrow-width': 'match-line',
            'target-arrow-width': '50%',
            width: 4,
          },
        },
        elements: [
          { data: { id: 'a' }, position: { x: 0, y: 0 } },
          { data: { id: 'b' }, position: { x: 100, y: 0 } },
          { data: { id: 'ab', source: 'a', target: 'b' } },
        ],
      });
      const ab = cy.$id('ab');
      const s = ab._first().slot;
      const aw = () => {
        const c = cy._store.column('edge.arrowWidths');

        return { source: c[s * 2], target: c[s * 2 + 1] };
      };

      expect(aw()).to.deep.equal({ source: 4, target: 2 });

      ab.animation({
        style: { width: 12 },
        duration: 100,
        easing: 'linear',
      }).play();

      drive(cy, 0, 50);
      expect(aw().source).to.be.closeTo(8, 1e-4); // match-line follows
      expect(aw().target).to.be.closeTo(4, 1e-4); // 50% of 8

      drive(cy, 100);
      expect(aw().source).to.equal(12);
      expect(aw().target).to.equal(6);
      expect(ab.style('source-arrow-width')).to.equal(12); // stored-truth readback
    });

    it('edge width: the casing stroke rides additively when enabled', function () {
      const cy = cytoscape({
        style: {
          edges: {
            'line-outline-width': 4,
            'line-outline-color': 'black',
            width: 3,
          },
        },
        elements: [
          { data: { id: 'a' }, position: { x: 0, y: 0 } },
          { data: { id: 'b' }, position: { x: 100, y: 0 } },
          { data: { id: 'ab', source: 'a', target: 'b' } },
        ],
      });
      const ab = cy.$id('ab');
      const s = ab._first().slot;
      const stroke = () => cy._store.column('edge.casing')[s * 2 + 1] / 256;

      expect(stroke()).to.be.closeTo(7, 1 / 256); // width + outline

      ab.animation({
        style: { width: 13 },
        duration: 100,
        easing: 'linear',
      }).play();

      drive(cy, 0, 50);
      expect(stroke()).to.be.closeTo(12, 1 / 256); // 8 + 4

      drive(cy, 100);
      expect(stroke()).to.be.closeTo(17, 1 / 256);
    });

    it('edge width: overlay strokes ride only when the layer is enabled', function () {
      const cy = cytoscape({
        style: {
          edges: { 'overlay-opacity': 0.5, 'overlay-padding': 2, width: 3 },
        },
        elements: [
          { data: { id: 'a' }, position: { x: 0, y: 0 } },
          { data: { id: 'b' }, position: { x: 100, y: 0 } },
          { data: { id: 'ab', source: 'a', target: 'b' } },
        ],
      });
      const ab = cy.$id('ab');
      const s = ab._first().slot;
      const overlayStroke = () =>
        cy._store.column('edge.overlay')[s * 2 + 1] / 256;
      const underlayRec = () => cy._store.column('edge.underlay')[s * 2 + 1];
      const underlayBefore = underlayRec();

      expect(overlayStroke()).to.be.closeTo(7, 1 / 256); // width + 2·padding

      ab.animation({
        style: { width: 9 },
        duration: 100,
        easing: 'linear',
      }).play();
      drive(cy, 0, 100);

      expect(overlayStroke()).to.be.closeTo(13, 1 / 256); // 9 + 4
      expect(underlayRec()).to.equal(underlayBefore); // disabled layer: no ride
    });

    it('padding: tweens the declared padding with auto-bounds following per tick', function () {
      const cy = cytoscape({
        style: { parents: { padding: 10, 'border-width': 0 } },
        elements: [
          { data: { id: 'p' } },
          { data: { id: 'a', parent: 'p' }, position: { x: 0, y: 0 } },
        ],
      });
      const p = cy.$id('p');

      cy._store.flushDerived();
      expect(p.paddedWidth()).to.be.closeTo(50, 1e-3); // 30 + 2·10

      p.animation({
        style: { padding: 30 },
        duration: 100,
        easing: 'linear',
      }).play();

      drive(cy, 0, 50);
      cy._store.flushDerived();
      expect(p.padding()).to.be.closeTo(20, 1e-4);
      expect(p.paddedWidth()).to.be.closeTo(70, 1e-3); // 30 + 2·20

      drive(cy, 100);
      cy._store.flushDerived();
      expect(p.padding()).to.equal(30);
      expect(p.paddedWidth()).to.be.closeTo(90, 1e-3);
    });

    it('padding: leaf slots are filtered (a leaf has no padding)', function () {
      const cy = makeCy();
      const a = cy.$id('a');
      const handle = a.animation({
        style: { padding: 40 },
        duration: 100,
        easing: 'linear',
      });

      handle.play();
      drive(cy, 0, 50, 100);

      expect(a.padding()).to.equal(0); // still a leaf: no-op
      expect(handle.playing()).to.equal(false); // and it completed
    });

    it('padding: a percent unit tweens the declared fraction', function () {
      const cy = cytoscape({
        style: {
          parents: {
            padding: '10%',
            'padding-relative-to': 'width',
            'border-width': 0,
          },
        },
        elements: [
          { data: { id: 'p' } },
          { data: { id: 'a', parent: 'p' }, position: { x: 0, y: 0 } },
          { data: { id: 'b', parent: 'p' }, position: { x: 70, y: 0 } },
        ],
      });
      const p = cy.$id('p');
      const slot = cy._store.lookup('p').slot;

      cy._store.flushDerived();
      // children bb 100 wide → pad 10 → box 120
      expect(p.paddedWidth()).to.be.closeTo(120, 1e-3);

      p.animation({
        style: { padding: 0.3 },
        duration: 100,
        easing: 'linear',
      }).play();

      drive(cy, 0, 50);
      cy._store.flushDerived();
      expect(cy._store.compoundStyleOf(slot).padding).to.be.closeTo(0.2, 1e-6);
      expect(p.paddedWidth()).to.be.closeTo(140, 1e-3); // 100 + 2·(0.2·100)

      drive(cy, 100);
      cy._store.flushDerived();
      expect(p.paddedWidth()).to.be.closeTo(160, 1e-3);
    });

    it('font-size: tweens a node label with dims and readback following', function () {
      const cy = makeCy({
        style: { nodes: { label: { data: 'id' }, 'font-size': 20 } },
      });
      const a = cy.$id('a');
      const s = slotOf(cy, 'a');

      a.animation({
        style: { 'font-size': 40 },
        duration: 100,
        easing: 'linear',
      }).play();

      drive(cy, 0, 50);
      expect(cy._store.labelAt(s, 'nodes').fontSize).to.be.closeTo(30, 1e-4);
      expect(cy._store.labelDimsAt(s, 'nodes').h).to.be.closeTo(30, 1e-4); // one line: h = em
      expect(a.style('font-size')).to.be.closeTo(30, 1e-4);

      drive(cy, 100);
      expect(cy._store.labelAt(s, 'nodes').fontSize).to.equal(40);
    });

    it('font-size: an edge label re-anchors and the end streams ride', function () {
      const cy = cytoscape({
        elements: [
          { data: { id: 'a' }, position: { x: 0, y: 0 } },
          { data: { id: 'b' }, position: { x: 100, y: 0 } },
          { data: { id: 'ab', source: 'a', target: 'b' } },
        ],
        style: {
          edges: {
            label: { data: 'id' },
            'source-label': { data: 'id' },
            'font-size': 20,
            'source-text-offset': 30,
          },
        },
      });
      const ab = cy.$id('ab');
      const s = ab._first().slot;

      expect(cy._store.labelAt(s, 'edges').anchorY).to.be.closeTo(-10, 1e-4);

      ab.animation({
        style: { 'font-size': 40 },
        duration: 100,
        easing: 'linear',
      }).play();

      drive(cy, 0, 50);
      expect(cy._store.labelAt(s, 'edges').fontSize).to.be.closeTo(30, 1e-4);
      expect(cy._store.labelAt(s, 'edges').anchorY).to.be.closeTo(-15, 1e-4); // -fs/2
      expect(cy._store.labelAt(s, 'edgeSource').fontSize).to.be.closeTo(
        30,
        1e-4,
      );

      drive(cy, 100);
      expect(cy._store.labelAt(s, 'edges').anchorY).to.be.closeTo(-20, 1e-4);
    });

    it('font-size: unlabelled elements are filtered and the tween completes', function () {
      const cy = makeCy(); // no label styled
      const a = cy.$id('a');
      const handle = a.animation({
        style: { 'font-size': 40 },
        duration: 100,
        easing: 'linear',
      });

      handle.play();
      drive(cy, 0, 50, 100);

      expect(cy._store.labelAt(slotOf(cy, 'a'), 'nodes')).to.equal(undefined);
      expect(handle.playing()).to.equal(false);
    });

    it('pauses and resumes a size tween with the frozen value readable', function () {
      const cy = makeCy();
      const a = cy.$id('a');
      const handle = a.animation({
        style: { width: 130 },
        duration: 100,
        easing: 'linear',
      });

      handle.play();
      drive(cy, 0, 40);
      handle.pause();
      drive(cy, 200);

      expect(sizeOf(cy, 'a').w).to.be.closeTo(70, 1e-4); // frozen at t=0.4
      expect(a.width()).to.be.closeTo(70, 1e-4);

      handle.resume();
      drive(cy, 260); // paused span excluded: t = (260 - 160)/100 = 1
      expect(sizeOf(cy, 'a').w).to.equal(130);
    });
  });
});
