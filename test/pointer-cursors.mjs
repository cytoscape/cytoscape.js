import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { cursorFor, DEFAULT_CURSORS } from '../src/interact/cursor.mjs';
import { PointerHandler } from '../src/interact/pointer.mjs';

/*
Round 89: the canvas says what a gesture will do.

Two tiers, and the split is the design rather than a gap.  The map
(`cursorFor`) is pure, so every cell of gesture x hover x pointer type is
assertable here.  The *writer* needs a canvas, and the honest browser
coverage is `playwright-tests/renderer.spec.js` — but a DOM stub is
enough to pin the two things the pure map cannot see: that the handler
classifies a hover the way `canDrag` does (a locked, ungrabified or
animating node is `pointer`, not `grab`), and that every gesture-end path
puts the cursor back.
*/

const GESTURES = ['idle', 'pan', 'grab', 'box'];
const HOVERS = ['none', 'element', 'draggable-node'];

describe('gpu/pointer-cursors', function () {
  describe('the map (89.1)', function () {
    it('answers every gesture x hover cell for a mouse', function () {
      // a press outranks hover: the gesture is decided at pointerdown and
      // a drag that crosses another node keeps saying what it is doing
      const expected = {
        idle: { none: '', element: 'pointer', 'draggable-node': 'grab' },
        pan: {
          none: 'grabbing',
          element: 'grabbing',
          'draggable-node': 'grabbing',
        },
        grab: {
          none: 'grabbing',
          element: 'grabbing',
          'draggable-node': 'grabbing',
        },
        box: {
          none: 'crosshair',
          element: 'crosshair',
          'draggable-node': 'crosshair',
        },
      };

      for (const gesture of GESTURES) {
        for (const hover of HOVERS) {
          expect(
            cursorFor({ gesture, hover, pointerType: 'mouse' }),
            `${gesture} over ${hover}`,
          ).to.equal(expected[gesture][hover]);
        }
      }
    });

    it('never gives a touch pointer a cursor', function () {
      // there is nothing to show, and a keyword written for a finger
      // would stick after it lifts
      for (const gesture of GESTURES) {
        for (const hover of HOVERS) {
          expect(
            cursorFor({ gesture, hover, pointerType: 'touch' }),
            `${gesture} over ${hover}`,
          ).to.equal('');
        }
      }
    });

    it('treats a pen like a mouse', function () {
      expect(
        cursorFor({ gesture: 'grab', hover: 'none', pointerType: 'pen' }),
      ).to.equal('grabbing');
    });

    it('is silent everywhere when the feature is off', function () {
      // the suite's own control: with `pointerCursors: false` every
      // positive assertion above must invert
      for (const gesture of GESTURES) {
        for (const hover of HOVERS) {
          for (const pointerType of ['mouse', 'pen', 'touch']) {
            expect(
              cursorFor({ gesture, hover, pointerType }, false),
              `${gesture} over ${hover} (${pointerType})`,
            ).to.equal('');
          }
        }
      }
    });

    it('takes a partial map and falls back for the rest', function () {
      const st = { gesture: 'pan', hover: 'none', pointerType: 'mouse' };

      expect(cursorFor(st, { pan: 'move' })).to.equal('move');
      expect(
        cursorFor({ ...st, gesture: 'box' }, { pan: 'move' }),
        'an unmentioned state keeps its default',
      ).to.equal('crosshair');
    });

    it("honours an explicit '' as inherit rather than a fallback", function () {
      // '' is a real value, not an omission: it hands one state back to
      // the app while the rest keep the defaults
      expect(
        cursorFor(
          { gesture: 'idle', hover: 'draggable-node', pointerType: 'mouse' },
          { hoverNode: '' },
        ),
      ).to.equal('');
    });

    it('leaves idle-over-background inheriting by default', function () {
      // deliberately not `default`: v4's canvas fills its container, so
      // an inline cursor here would override the app's own, which is how
      // every v3 app set cursors
      expect(DEFAULT_CURSORS.idle).to.equal('');
    });
  });

  describe('the writer (89.1)', function () {
    /* A DOM stub small enough to read: the handler wants a canvas to
       listen on, a `style` bag to write, an owner document whose root
       element carries the mid-drag mirror, and a rect to turn client
       coordinates into rendered ones. */
    const harness = function (opts) {
      const root = { style: { cursor: '' } };
      const el = () => ({
        style: {},
        remove() {},
        appendChild() {},
      });
      const listeners = new Map();
      const canvas = {
        style: { cursor: '' },
        parentElement: null,
        ownerDocument: { documentElement: root, createElement: el },
        // the active-bg circle lands here (13 A2) once the async press
        // pick answers background
        appendChild() {},
        addEventListener: (type, fn) => listeners.set(type, fn),
        removeEventListener: () => {},
        setPointerCapture() {},
        getBoundingClientRect: () => ({ left: 0, top: 0 }),
      };
      const cy = cytoscape({
        headlessWidth: 400,
        headlessHeight: 300,
        elements: {
          nodes: [{ data: { id: 'a' }, position: { x: 100, y: 100 } }],
        },
        ...opts,
      });
      // the renderer seam the gesture layer actually uses (86.3): the
      // sync node pick answers a slot and decides pan-vs-grab, while the
      // async one answers a packed pick id (slot + 1, edges namespaced)
      let hit = null;
      const renderer = {
        canvas,
        pick: () => Promise.resolve(hit == null ? null : hit + 1),
        pickNodeSync: () => hit,
      };
      const handler = new PointerHandler(cy, renderer);

      cy._pointer = handler; // so cy.pointerCursors() reaches the writer

      return {
        cy,
        canvas,
        root,
        handler,
        /** what the sync/async picks answer with: a node slot, or null */
        aim(slot) {
          hit = slot;
        },
        fire(type, props) {
          const fn = listeners.get(type);

          expect(fn, `no ${type} listener`).to.not.equal(undefined);
          fn({
            type,
            pointerId: 1,
            pointerType: 'mouse',
            button: 0,
            clientX: 100,
            clientY: 100,
            shiftKey: false,
            metaKey: false,
            ctrlKey: false,
            preventDefault() {},
            ...props,
          });
        },
      };
    };

    /** The slot of node 'a', which is what the pick stub answers with. */
    const slotOf = (cy) => cy.$id('a')._eventRef().slot;

    it('says grab over a draggable node and grabbing while it drags', async function () {
      const h = harness();

      h.aim(slotOf(h.cy));
      h.fire('pointermove');
      await Promise.resolve();
      await Promise.resolve();

      expect(h.canvas.style.cursor, 'hovering a draggable node').to.equal(
        'grab',
      );

      h.fire('pointerdown');

      expect(h.canvas.style.cursor, 'dragging it').to.equal('grabbing');

      h.fire('pointerup');

      expect(h.canvas.style.cursor, 'released back onto it').to.equal('grab');

      h.handler.destroy();
      h.cy.destroy();
    });

    it('says pointer, not grab, over a node the drag predicate refuses', async function () {
      // the canDrag-driven distinction the pure map cannot see
      for (const gate of ['lock', 'ungrabify']) {
        const h = harness();
        const node = h.cy.$id('a');

        node[gate]();
        h.aim(slotOf(h.cy));
        h.fire('pointermove');
        await Promise.resolve();
        await Promise.resolve();

        expect(h.canvas.style.cursor, `over a ${gate}ed node`).to.equal(
          'pointer',
        );

        h.handler.destroy();
        h.cy.destroy();
      }
    });

    it('says grabbing for a background pan and crosshair for a box', function () {
      const h = harness();

      h.aim(null);
      h.fire('pointerdown');

      expect(h.canvas.style.cursor, 'panning the background').to.equal(
        'grabbing',
      );

      h.fire('pointerup');

      expect(h.canvas.style.cursor, 'released onto background').to.equal('');

      h.fire('pointerdown', { shiftKey: true });

      expect(h.canvas.style.cursor, 'a multiple-select-key drag').to.equal(
        'crosshair',
      );

      h.fire('pointerup', { shiftKey: true });

      expect(h.canvas.style.cursor).to.equal('');

      h.handler.destroy();
      h.cy.destroy();
    });

    it('restores through pointercancel, where a sticky grabbing would hide', function () {
      const h = harness();

      h.aim(null);
      h.fire('pointerdown');

      expect(h.canvas.style.cursor).to.equal('grabbing');

      h.fire('pointercancel');

      expect(h.canvas.style.cursor).to.equal('');
      expect(h.root.style.cursor, 'and the document mirror with it').to.equal(
        '',
      );

      h.handler.destroy();
      h.cy.destroy();
    });

    it('mirrors an active drag onto the document and puts it back', function () {
      // fact 4: a drag runs under setPointerCapture, which routes events
      // and not the cursor — outside the canvas the element underneath
      // decides, so the affordance needs the root element too
      const h = harness();

      h.root.style.cursor = 'wait'; // the page's own, to be handed back

      h.aim(null);
      h.fire('pointerdown');

      expect(h.root.style.cursor, 'mirrored while dragging').to.equal(
        'grabbing',
      );

      h.fire('pointerup');

      expect(h.root.style.cursor, "the page's own, restored").to.equal('wait');

      h.handler.destroy();
      h.cy.destroy();
    });

    it('writes nothing at all when pointerCursors is false', async function () {
      const h = harness({ pointerCursors: false });

      h.aim(slotOf(h.cy));
      h.fire('pointermove');
      await Promise.resolve();
      await Promise.resolve();

      expect(h.canvas.style.cursor, 'hover').to.equal('');

      h.fire('pointerdown');

      expect(h.canvas.style.cursor, 'press').to.equal('');
      expect(h.root.style.cursor, 'and no document mirror').to.equal('');

      h.fire('pointerup');

      h.handler.destroy();
      h.cy.destroy();
    });

    it('takes a runtime flip without waiting for the next event', function () {
      const h = harness();

      h.aim(null);
      h.fire('pointerdown');

      expect(h.canvas.style.cursor).to.equal('grabbing');

      h.cy.pointerCursors(false);

      expect(h.canvas.style.cursor, 'cleared on the spot').to.equal('');

      h.cy.pointerCursors({ pan: 'move' });

      expect(h.canvas.style.cursor, 'and re-derived on the spot').to.equal(
        'move',
      );

      h.fire('pointerup');
      h.handler.destroy();
      h.cy.destroy();
    });

    it('hands the cursor back on destroy', function () {
      // destroy also runs on the device-loss re-mount (round 10), so a
      // cursor left here would outlive the handler that set it
      const h = harness();

      h.aim(null);
      h.fire('pointerdown');

      expect(h.canvas.style.cursor).to.equal('grabbing');

      h.handler.destroy();

      expect(h.canvas.style.cursor).to.equal('');
      expect(h.root.style.cursor).to.equal('');

      h.cy.destroy();
    });

    it('leaves a touch gesture alone', function () {
      const h = harness();

      h.aim(null);
      h.fire('pointerdown', { pointerType: 'touch' });

      expect(h.canvas.style.cursor).to.equal('');
      expect(h.root.style.cursor).to.equal('');

      h.fire('pointerup', { pointerType: 'touch' });
      h.handler.destroy();
      h.cy.destroy();
    });
  });

  describe('cy.pointerCursors()', function () {
    it('defaults to true', function () {
      expect(cytoscape().pointerCursors()).to.equal(true);
    });

    it('is settable via the option and the method', function () {
      const cy = cytoscape({ pointerCursors: false });

      expect(cy.pointerCursors()).to.equal(false);

      cy.pointerCursors({ pan: 'move' });

      expect(cy.pointerCursors()).to.deep.equal({ pan: 'move' });
      expect(cy.pointerCursors(true)).to.equal(cy);
    });
  });
});
