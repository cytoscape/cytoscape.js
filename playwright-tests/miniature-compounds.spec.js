import { test, expect } from '@playwright/test';
import { decodePng } from './lib/image-diff.mjs';

const PAGE =
  process.env.CY_MINIATURE_TEST_URL ||
  'http://127.0.0.1:3333/playwright-page/index.html';

const hasAdapter = async (page) =>
  page.evaluate(async () => {
    if (navigator.gpu == null) return false;
    return (await navigator.gpu.requestAdapter()) != null;
  });

test.describe('miniature compound geometry', () => {
  test('scales the rendered image rect with its live miniature node', async ({
    page,
  }, testInfo) => {
    const deviceErrors = [];

    page.on('console', (msg) => {
      if (/WGSL|is invalid|Validation error|WebGPU.*error/i.test(msg.text())) {
        deviceErrors.push(msg.text());
      }
    });

    await page.setDefaultTimeout(60000);
    await page.setViewportSize({ width: 600, height: 400 });
    await page.goto(PAGE);
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="#ff0000"/></svg>',
    ).toString('base64');
    const image = `data:image/svg+xml;base64,${svg}`;

    const geometry = await page.evaluate(async (imageUrl) => {
      const cy = window.makeCy({
        elements: {
          nodes: [
            { data: { id: 'p' }, position: { x: 0, y: 0 } },
            { data: { id: 'a', parent: 'p' }, position: { x: -100, y: 0 } },
            { data: { id: 'b', parent: 'p' }, position: { x: 100, y: 0 } },
          ],
        },
        style: {
          nodes: {
            width: 80,
            height: 40,
            shape: 'rectangle',
            'background-color': '#00ff00',
            'border-width': 0,
            'background-image': imageUrl,
            'background-width': 40,
            'background-height': 20,
          },
          parents: { 'collapse-scale': 0.25, padding: 0 },
        },
      });

      await cy.ready;
      cy.viewport({ zoom: 1, pan: { x: 300, y: 200 } });
      cy.$id('p').collapse();
      await cy.viewportCounts();
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const child = cy.$id('a');
      const slot = child._refs[0].slot;
      const imageOffset = cy._store.imagePool.offsetOf(slot);
      const imageFactor = cy._store.imagePool.data()[imageOffset + 12];

      return {
        width: child.width(),
        authoredWidth: child.style('width'),
        position: child.position(),
        imageFactor,
        picked: (await cy.pick(275, 200))?.id() ?? null,
      };
    }, image);

    expect(geometry.authoredWidth).toBe(80);
    expect(geometry.width).toBe(20);
    expect(geometry.position.x).toBe(-25);
    expect(geometry.imageFactor).toBe(0.25);
    expect(geometry.picked).toBe('a');

    const screenshot = await page.screenshot({
      path: testInfo.outputPath('collapsed-miniature.png'),
    });
    const png = decodePng(screenshot);
    const pixel = (x, y) => {
      const offset = (y * png.width + x) * 4;
      return [...png.data.subarray(offset, offset + 3)];
    };

    expect(pixel(275, 200)).toEqual([255, 0, 0]);
    expect(pixel(268, 200)).toEqual([0, 255, 0]);
    expect(deviceErrors).toEqual([]);
  });
});
