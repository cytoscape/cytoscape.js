import { expect } from 'chai';

import {
  LabelDeclutter,
  DECLUTTER_CULL,
  DECLUTTER_NONE,
  FADE_ORDER_SPAN,
  fadeScale,
  labelFade,
  nodeLabelRect,
} from '../../src/render/label-declutter.mjs';
import {
  FLAG_ALIVE,
  FLAG_DRAWN,
  FLAG_EMPHASIZED,
} from '../../src/contract.mjs';

/*
Round 104: the occupancy pass, headless.  The scenes are hand-placed
labels on a unit zoom (1 CSS px per model px), so a rect in the spec is
the rect on screen, and a 4 px cell is 4 model px.  Every behavioural
spec is paired with the control that must flip it: swapping two
priorities swaps the winner; a label faded to nothing stops claiming;
turning the hysteresis off lets a challenger in.
*/

const SHOWN = FLAG_ALIVE | FLAG_DRAWN;

/** A scene of labels: [x, y, w, h, priority] per node, at unit zoom. */
function scene(labels, { lodH = 20, flags = null } = {}) {
  const d = new LabelDeclutter();
  const positions = new Float32Array(labels.length * 2);
  const f = new Uint32Array(labels.length).fill(SHOWN);

  labels.forEach(([x, y, w, h, priority = 0], slot) => {
    positions[slot * 2] = x;
    positions[slot * 2 + 1] = y;
    // the rect centred on the node, as a centred label is
    d.setLabel(slot, -w / 2, -h / 2, w / 2, h / 2, lodH, 0, priority);
  });

  if (flags != null) {
    flags.forEach((v, i) => {
      f[i] = v;
    });
  }

  return { d, positions, flags: f };
}

const VIEW = {
  zoom: 1,
  zoomDpr: 1,
  x1: -1000,
  y1: -1000,
  x2: 1000,
  y2: 1000,
  fadePx: 6,
  minPx: 0,
};

const drawnSlots = (d, n) =>
  Array.from({ length: n }, (_, i) => i).filter((i) => d.drawn(i));

describe('label declutter (round 104)', function () {
  describe('the greedy pass', function () {
    it('keeps the higher-priority of two overlapping labels', function () {
      const { d, positions, flags } = scene([
        [0, 0, 60, 12, 1],
        [20, 4, 60, 12, 5],
      ]);

      d.run(DECLUTTER_CULL, VIEW, positions, flags);

      expect(drawnSlots(d, 2)).to.deep.equal([1]);
      expect(d.stats).to.include({ candidates: 2, shown: 1, culled: 1 });
      expect(d.gate[0]).to.equal(0);
    });

    it('swapping the two priorities swaps the winner (the control)', function () {
      const { d, positions, flags } = scene([
        [0, 0, 60, 12, 5],
        [20, 4, 60, 12, 1],
      ]);

      d.run(DECLUTTER_CULL, VIEW, positions, flags);

      expect(drawnSlots(d, 2)).to.deep.equal([0]);
    });

    it('breaks a tie by slot, and keeps labels that do not touch', function () {
      const { d, positions, flags } = scene([
        [0, 0, 60, 12],
        [20, 4, 60, 12],
        [300, 0, 60, 12],
      ]);

      d.run(DECLUTTER_CULL, VIEW, positions, flags);

      expect(drawnSlots(d, 3)).to.deep.equal([0, 2]);
    });

    it('culls down a dense pile to non-overlapping winners', function () {
      const labels = [];

      for (let i = 0; i < 400; i++) {
        labels.push([(i * 37) % 200, (i * 53) % 150, 40, 10, i % 7]);
      }

      const { d, positions, flags } = scene(labels);

      d.run(DECLUTTER_NONE, VIEW, positions, flags);

      const overlaps = (slots) => {
        let n = 0;

        for (const a of slots) {
          for (const b of slots) {
            if (a < b) {
              const [ax, ay, aw, ah] = labels[a];
              const [bx, by, bw, bh] = labels[b];

              if (
                Math.abs(ax - bx) < (aw + bw) / 2 &&
                Math.abs(ay - by) < (ah + bh) / 2
              ) {
                n++;
              }
            }
          }
        }

        return n;
      };
      // the census re-run with the cull disabled: every label draws,
      // and the pile overlaps
      const all = drawnSlots(d, 400);

      expect(all.length).to.equal(400);
      expect(overlaps(all)).to.be.greaterThan(1000);

      d.run(DECLUTTER_CULL, VIEW, positions, flags);

      const kept = drawnSlots(d, 400);

      expect(kept.length).to.be.within(10, 399);
      expect(overlaps(kept)).to.equal(0);
      // every winner outranks or ties everything it displaced: the top
      // priority present is always among the winners
      expect(kept.some((s) => labels[s][4] === 6)).to.equal(true);
    });

    it('hides and does not claim for a node that is not shown', function () {
      const { d, positions, flags } = scene(
        [
          [0, 0, 60, 12, 5],
          [20, 4, 60, 12, 1],
        ],
        { flags: [FLAG_ALIVE, SHOWN] }, // slot 0 alive but not drawn
      );

      d.run(DECLUTTER_CULL, VIEW, positions, flags);

      expect(drawnSlots(d, 2)).to.deep.equal([1]);
    });

    it('decides nothing outside the region (undecided never draws)', function () {
      const { d, positions, flags } = scene([
        [0, 0, 60, 12],
        [5000, 0, 60, 12],
      ]);

      d.run(DECLUTTER_CULL, VIEW, positions, flags);

      expect(d.gate[1]).to.equal(0);
      expect(drawnSlots(d, 2)).to.deep.equal([0]);
    });

    it('ranks the emphasized set above every priority', function () {
      const { d, positions, flags } = scene(
        [
          [0, 0, 60, 12, 100],
          [20, 4, 60, 12, 0],
          [300, 0, 60, 12, 50],
        ],
        { flags: [SHOWN, SHOWN | FLAG_EMPHASIZED, SHOWN] },
      );

      d.run(DECLUTTER_CULL, VIEW, positions, flags);

      expect(drawnSlots(d, 3)).to.deep.equal([1, 2]);
      // and fades last: the emphasized label's band is the top one
      expect(d.gate[1]).to.equal(1);
      expect(d.gate[2]).to.be.greaterThan(1);
    });
  });

  describe('cull decides membership, fade decides alpha', function () {
    // two overlapping labels; the higher-priority one is small enough to
    // sit in the fade band.  The glyph LOD height is per label.
    const pair = (lodTop) => {
      const d = new LabelDeclutter();
      const positions = new Float32Array([0, 0, 20, 4]);
      const flags = new Uint32Array([SHOWN, SHOWN]);

      d.setLabel(0, -30, -6, 30, 6, lodTop, 0, 5); // the top priority
      d.setLabel(1, -30, -6, 30, 6, 20, 0, 1);

      return { d, positions, flags };
    };

    it('a half-faded label claims exactly as a whole one', function () {
      // top label at 4 px: fade at k = 1 is smoothstep(3, 6, 4) ≈ 0.26
      const { d, positions, flags } = pair(4);

      expect(labelFade(4, 6)).to.be.within(0.2, 0.3);
      d.run(DECLUTTER_CULL, VIEW, positions, flags);

      expect(drawnSlots(d, 2)).to.deep.equal([0]);
    });

    it('a label faded to nothing does not claim (the control)', function () {
      // at 2 px the top label is past its fade: the GPU would not draw
      // it, so it must not hold the cell the lower label wants
      const { d, positions, flags } = pair(2);

      d.run(DECLUTTER_CULL, VIEW, positions, flags);

      expect(drawnSlots(d, 2)).to.deep.equal([1]);
      expect(d.stats.candidates).to.equal(1);
    });

    it('applies min-zoomed-font-size and labelMinPx before the claim', function () {
      const d = new LabelDeclutter();
      const positions = new Float32Array([0, 0, 20, 4]);
      const flags = new Uint32Array([SHOWN, SHOWN]);

      d.setLabel(0, -30, -6, 30, 6, 20, 2, 5); // floor: zoomDpr ≥ 2
      d.setLabel(1, -30, -6, 30, 6, 20, 0, 1);
      d.run(DECLUTTER_CULL, VIEW, positions, flags);
      expect(drawnSlots(d, 2)).to.deep.equal([1]);

      d.setLabel(0, -30, -6, 30, 6, 20, 0, 5);
      d.run(DECLUTTER_CULL, { ...VIEW, minPx: 25 }, positions, flags);
      expect(drawnSlots(d, 2)).to.deep.equal([]);
    });
  });

  describe('the fade order', function () {
    it('leaves every label on the unscaled band when no priority is set', function () {
      const { d, positions, flags } = scene([
        [0, 0, 10, 10],
        [100, 0, 10, 10],
        [200, 0, 10, 10],
      ]);

      d.run(DECLUTTER_NONE, VIEW, positions, flags);

      expect(Array.from(d.gate.subarray(0, 3))).to.deep.equal([1, 1, 1]);
    });

    it('spreads the band by rank: top 1, bottom FADE_ORDER_SPAN, ties share', function () {
      const { d, positions, flags } = scene([
        [0, 0, 10, 10, 1],
        [100, 0, 10, 10, 9],
        [200, 0, 10, 10, 5],
        [300, 0, 10, 10, 5],
        [400, 0, 10, 10, -3],
      ]);

      d.run(DECLUTTER_NONE, VIEW, positions, flags);

      expect(d.rankOf(1)).to.equal(1);
      expect(d.rankOf(4)).to.equal(0);
      expect(d.rankOf(2)).to.equal(d.rankOf(3));
      expect(d.gate[1]).to.equal(1);
      expect(d.gate[4]).to.equal(FADE_ORDER_SPAN);
      expect(d.gate[2]).to.equal(fadeScale(0.75));
      expect(d.gate[0]).to.be.within(d.gate[2], d.gate[4]);
    });

    it('fades the lowest-ranked label first as the zoom falls', function () {
      const heightPx = 7; // between F and F × span
      const top = labelFade(heightPx, 6 * fadeScale(1));
      const bottom = labelFade(heightPx, 6 * fadeScale(0));

      expect(top).to.equal(1);
      expect(bottom).to.be.below(0.1);
    });
  });

  describe('stability', function () {
    it('is a fixed point at a fixed view', function () {
      const labels = [];

      for (let i = 0; i < 300; i++) {
        labels.push([(i * 37) % 180, (i * 53) % 140, 30, 8, i % 5]);
      }

      const { d, positions, flags } = scene(labels);

      d.run(DECLUTTER_CULL, VIEW, positions, flags);

      const first = drawnSlots(d, 300);

      for (let i = 0; i < 3; i++) {
        d.run(DECLUTTER_CULL, VIEW, positions, flags);
        expect(d.stats.flips).to.equal(0);
      }

      expect(drawnSlots(d, 300)).to.deep.equal(first);
    });

    it('keeps an incumbent against a challenger within the rank margin', function () {
      const { d, positions, flags } = scene([
        [0, 0, 60, 12, 1],
        [500, 0, 60, 12, 2],
        [520, 4, 60, 12, 3],
      ]);
      const narrow = { ...VIEW, x2: 300 }; // slot 0 only... and 1, 2 outside

      d.run(DECLUTTER_CULL, { ...VIEW, x1: 450, x2: 600 }, positions, flags);
      // both 1 and 2 in view: 2 (higher) wins
      expect(drawnSlots(d, 3)).to.deep.equal([2]);
      void narrow;

      // move 2 away, 1 becomes the incumbent; bring 2 back
      positions[4] = 900;
      d.run(DECLUTTER_CULL, { ...VIEW, x1: 450, x2: 600 }, positions, flags);
      expect(drawnSlots(d, 3)).to.deep.equal([1]);
      positions[4] = 520;

      // ranks: 0 → 0, 1 → 0.5, 2 → 1: a margin of 0.1 lets 2 through
      d.hysteresis = 0.1;
      d.run(DECLUTTER_CULL, { ...VIEW, x1: 450, x2: 600 }, positions, flags);
      expect(drawnSlots(d, 3)).to.deep.equal([2]);

      // with a margin wider than the rank gap, the incumbent holds
      positions[4] = 900;
      d.run(DECLUTTER_CULL, { ...VIEW, x1: 450, x2: 600 }, positions, flags);
      positions[4] = 520;
      d.hysteresis = 0.6;
      d.run(DECLUTTER_CULL, { ...VIEW, x1: 450, x2: 600 }, positions, flags);
      expect(drawnSlots(d, 3)).to.deep.equal([1]);

      // and without hysteresis the challenger always wins (the control)
      d.hysteresis = 0;
      d.run(DECLUTTER_CULL, { ...VIEW, x1: 450, x2: 600 }, positions, flags);
      expect(drawnSlots(d, 3)).to.deep.equal([2]);
    });

    it('does not re-decide under a sub-cell pan (the model-anchored grid)', function () {
      // two labels 2 px apart — closer than a cell, so whether they share
      // a cell depends only on where the cell edges fall
      const labels = [];

      for (let i = 0; i < 40; i++) {
        labels.push([i * 42.3, 0, 40, 10, 0]);
      }

      const { d, positions, flags } = scene(labels);
      const at = (dx) => ({ ...VIEW, x1: -100 - dx, x2: 2000 - dx });

      d.hysteresis = 0;
      d.insetCells = 0;
      d.run(DECLUTTER_CULL, at(0), positions, flags);

      const first = drawnSlots(d, 40);

      for (let step = 1; step < 16; step++) {
        d.run(DECLUTTER_CULL, at(step * 0.37), positions, flags);
        expect(drawnSlots(d, 40)).to.deep.equal(first);
      }

      // the control: the same pan against a screen-anchored grid (the
      // model shifted under the model grid by the pan's phase) does
      // re-decide
      let changed = 0;

      for (let step = 1; step < 16; step++) {
        const dx = (step * 0.37) % 4;
        const shifted = positions.map((v, i) => (i % 2 === 0 ? v + dx : v));

        d.run(DECLUTTER_CULL, at(step * 0.37), shifted, flags);

        if (drawnSlots(d, 40).join() !== first.join()) {
          changed++;
        }
      }

      expect(changed).to.be.greaterThan(0);
    });

    it('holds incumbents through a zoom that re-quantizes the grid', function () {
      // rows of labels 1.7 px apart: every zoom step moves some gap
      // across a cell edge
      const labels = [];

      for (let i = 0; i < 200; i++) {
        labels.push([(i % 20) * 31.7, Math.floor(i / 20) * 9.6, 30, 8, 0]);
      }

      const count = (inset, h) => {
        const { d, positions, flags } = scene(labels);
        const turns = new Map();
        let prev = null;

        d.insetCells = inset;
        d.hysteresis = h;

        for (let i = 0; i < 40; i++) {
          const z = 1.002 ** i;

          d.run(
            DECLUTTER_CULL,
            { ...VIEW, zoom: z, zoomDpr: z },
            positions,
            flags,
          );

          const now = drawnSlots(d, 200);

          if (prev != null) {
            for (let s = 0; s < 200; s++) {
              if (now.includes(s) !== prev.includes(s)) {
                turns.set(s, (turns.get(s) ?? 0) + 1);
              }
            }
          }

          prev = now;
        }

        let strobes = 0;

        for (const n of turns.values()) {
          strobes += Math.max(0, n - 1);
        }

        return strobes;
      };

      const without = count(0, 0);
      const withBoth = count(1, 0.1);

      expect(without).to.be.greaterThan(0);
      expect(withBoth).to.be.below(without);
      expect(withBoth).to.equal(0);
    });
  });

  describe('bookkeeping', function () {
    it('tracks the changed gate span and resets it when taken', function () {
      const { d, positions, flags } = scene([
        [0, 0, 60, 12, 1],
        [20, 4, 60, 12, 5],
      ]);

      d.takeGateSpan();
      d.run(DECLUTTER_CULL, VIEW, positions, flags);
      // slot 1 wins at the top rank, k = 1 — unchanged; slot 0 is culled
      expect(d.takeGateSpan()).to.deep.equal({ lo: 0, hi: 0 });
      expect(d.takeGateSpan()).to.equal(null);
      d.run(DECLUTTER_CULL, VIEW, positions, flags);
      expect(d.takeGateSpan()).to.equal(null);
    });

    it('forgets a cleared label and restores its gate to 1', function () {
      const { d, positions, flags } = scene([
        [0, 0, 60, 12, 1],
        [20, 4, 60, 12, 5],
      ]);

      d.run(DECLUTTER_CULL, VIEW, positions, flags);
      expect(d.gate[0]).to.equal(0);
      d.clearLabel(0);
      expect(d.gate[0]).to.equal(1);
      expect(d.count()).to.equal(1);
      d.run(DECLUTTER_CULL, VIEW, positions, flags);
      expect(drawnSlots(d, 2)).to.deep.equal([1]);
      d.clearAll();
      expect(d.count()).to.equal(0);
      expect(Array.from(d.gate.subarray(0, 2))).to.deep.equal([1, 1]);
    });

    it('declines a degenerate view rather than allocating its grid', function () {
      const { d, positions, flags } = scene([
        [0, 0, 60, 12, 1],
        [20, 4, 60, 12, 5],
      ]);

      d.run(
        DECLUTTER_CULL,
        { ...VIEW, zoom: 1e6, x1: -1e6, x2: 1e6, y1: -1e6, y2: 1e6 },
        positions,
        flags,
      );

      expect(drawnSlots(d, 2)).to.deep.equal([0, 1]);
    });
  });

  describe('nodeLabelRect', function () {
    const base = {
      anchorX: 0,
      anchorY: 10,
      halignShift: 0,
      valignShift: 0,
      marginX: 0,
      outlineWidth: 0,
      bgColor: 0,
      bgPadding: 0,
      rotation: 0,
    };

    it('places the laid block as the label layer does', function () {
      expect(nodeLabelRect(base, 40, 12)).to.deep.equal([-20, 10, 20, 22]);
      expect(
        nodeLabelRect({ ...base, halignShift: -0.5, marginX: 3 }, 40, 12),
      ).to.deep.equal([-37, 10, 3, 22]);
    });

    it('grows by the outline, or by the padding of a visible background', function () {
      expect(nodeLabelRect({ ...base, outlineWidth: 2 }, 40, 12)).to.deep.equal(
        [-22, 8, 22, 24],
      );
      // a transparent background's padding is not drawn
      expect(nodeLabelRect({ ...base, bgPadding: 5 }, 40, 12)).to.deep.equal([
        -20, 10, 20, 22,
      ]);
      expect(
        nodeLabelRect({ ...base, bgPadding: 5, bgColor: 0xff000000 }, 40, 12),
      ).to.deep.equal([-25, 5, 25, 27]);
    });

    it('bounds a rotated label about its anchor', function () {
      const r = nodeLabelRect(
        { ...base, anchorY: -6, rotation: Math.PI / 2 },
        40,
        12,
      );

      expect(r[0]).to.be.closeTo(-6, 1e-9);
      expect(r[2]).to.be.closeTo(6, 1e-9);
      expect(r[1]).to.be.closeTo(-20, 1e-9);
      expect(r[3]).to.be.closeTo(20, 1e-9);
    });
  });
});
