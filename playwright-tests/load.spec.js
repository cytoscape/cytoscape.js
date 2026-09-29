import { test, expect } from '@playwright/test';
import { decodePng } from './lib/image-diff.mjs';

/*
Round 103: `cy.load()` on a rendered instance — "a first frame before the
last byte".

The plan's control, and its precondition (the 48.5 rule): the source is
a gate the spec holds, so the first chunk's frame is asserted **while the
second chunk has knowably not been handed over** — `cy.ready` resolved, a
frame presented, the first chunk's red squares on screen and the second
chunk's green one not — and only then is the gate opened and the whole
graph asserted.  Without the gate, "a frame before the last chunk" would be
a race the spec could win by luck.

Soft-skips when no adapter can be acquired, as renderer.spec.js does.
*/

const PAGE = 'http://127.0.0.1:3333/playwright-page/index.html';

const hasAdapter = async (page) =>
  await page.evaluate(async () => {
    if (navigator.gpu == null) {
      return false;
    }

    return (await navigator.gpu.requestAdapter()) != null;
  });

/** The composited pixel at CSS coords (a 1 px clip, as renderer.spec.js). */
const pixelAt = async (page, x, y) => {
  const data = decodePng(
    await page.screenshot({
      clip: { x: Math.round(x), y: Math.round(y), width: 1, height: 1 },
    }),
  ).data;

  return [data[0], data[1], data[2]];
};

const isRed = ([r, g, b]) => r > 200 && g < 60 && b < 60;
const isGreen = ([r, g, b]) => g > 100 && r < 60 && b < 60;

test.describe('cy.load() on a rendered instance (round 103)', () => {
  test('draws the first chunk while the second is knowably absent', async ({
    page,
  }) => {
    await page.goto(PAGE);
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    // the gate: one chunk per open(), a permit counter so an early open
    // is kept; the page records what it handed over
    await page.evaluate(() => {
      const chunks = [
        [
          { data: { id: 'a', kind: 'first' }, position: { x: -200, y: 0 } },
          { data: { id: 'b', kind: 'first' }, position: { x: 200, y: 0 } },
        ],
        [
          { data: { id: 'c', kind: 'second' }, position: { x: 0, y: 0 } },
          { data: { id: 'ac', source: 'a', target: 'c' } },
        ],
      ];
      let permits = 0;
      let waiting = null;

      window.gate = {
        handed: 0,
        open() {
          permits++;
          waiting?.();
          waiting = null;
        },
      };

      async function* source() {
        for (const chunk of chunks) {
          while (permits === 0) {
            await new Promise((resolve) => {
              waiting = resolve;
            });
          }

          permits--;
          window.gate.handed++;
          yield chunk;
        }
      }

      const cy = window.makeCy({
        style: {
          nodes: {
            shape: 'rectangle',
            width: 80,
            height: 80,
            'background-color': {
              case: [{ when: { data: 'kind', eq: 'second' }, then: 'lime' }],
              else: 'red',
            },
          },
        },
      });

      window.events = [];

      for (const type of ['loadchunk', 'loadready', 'loadstop']) {
        cy.on(type, () => window.events.push(type));
      }

      // `cy.ready` is read after load(): the load re-points it
      window.done = cy.load(source(), { padding: 100 });
      window.isReadyBefore = cy.isReady();
      window.readyAt = null;
      cy.ready.then(() => {
        window.readyAt = {
          handed: window.gate.handed,
          nodes: cy.nodes().length,
          frames: cy.stats().frames,
        };
      });
      window.gate.open();
    });

    await page.waitForFunction(() => window.readyAt != null, null, {
      timeout: 30_000,
    });

    const at = await page.evaluate(() => ({
      readyAt: window.readyAt,
      isReadyBefore: window.isReadyBefore,
      handed: window.gate.handed,
      events: window.events,
      a: window.cy.$id('a').renderedPosition(),
      b: window.cy.$id('b').renderedPosition(),
      zoom: window.cy.zoom(),
      pan: window.cy.pan(),
    }));

    // the precondition: chunk two has not been handed over, at cy.ready
    // and still now
    expect(at.readyAt.handed).toBe(1);
    expect(at.handed).toBe(1);
    expect(at.readyAt.nodes).toBe(2);
    expect(at.isReadyBefore).toBe(false);
    // a frame was drawn — cy.ready is the first chunk drawn, not the adapter
    expect(at.readyAt.frames).toBeGreaterThan(0);
    expect(at.events).toEqual(['loadchunk', 'loadready']);

    // on screen: the first chunk, and nothing where the second will land
    const midX = (at.a.x + at.b.x) / 2;

    expect(isRed(await pixelAt(page, at.a.x, at.a.y))).toBe(true);
    expect(isRed(await pixelAt(page, at.b.x, at.b.y))).toBe(true);
    expect(isGreen(await pixelAt(page, midX, at.a.y))).toBe(false);

    // the second chunk lands; the viewport holds (fit once, never again)
    const end = await page.evaluate(async () => {
      window.gate.open();

      const progress = await window.done;

      await new Promise((resolve) => {
        window.cy.one('render', resolve);
        window.cy.panBy({ x: 1, y: 0 });
        window.cy.panBy({ x: -1, y: 0 });
      });

      return {
        progress,
        events: window.events,
        zoom: window.cy.zoom(),
        pan: window.cy.pan(),
      };
    });

    expect(end.progress).toEqual({ chunks: 2, nodes: 3, edges: 1 });
    expect(end.events).toEqual([
      'loadchunk',
      'loadready',
      'loadchunk',
      'loadstop',
    ]);
    expect(end.zoom).toBe(at.zoom);
    expect(end.pan).toEqual(at.pan);
    expect(isGreen(await pixelAt(page, midX, at.a.y))).toBe(true);
    expect(isRed(await pixelAt(page, at.a.x, at.a.y))).toBe(true);
  });
});
