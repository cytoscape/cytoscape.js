import { test, expect } from '@playwright/test';

const PAGE =
  process.env.CY_HULL_TEST_URL ||
  'http://127.0.0.1:3333/debug/compound-hulls.html';

const hasAdapter = async (page) =>
  page.evaluate(async () => {
    if (navigator.gpu == null) return false;
    return (await navigator.gpu.requestAdapter()) != null;
  });

test.describe('compound hull renderer', () => {
  test('renders and picks convex, rounded, and concave parent contours', async ({
    page,
  }) => {
    const deviceErrors = [];

    page.on('console', (msg) => {
      if (
        msg.type() === 'error' ||
        /WGSL|is invalid|Validation error/i.test(msg.text())
      ) {
        deviceErrors.push(msg.text());
      }
    });

    await page.setDefaultTimeout(60000);
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto(PAGE);
    test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');

    await page.evaluate(async () => {
      await cy.ready;
      await new Promise((resolve) => {
        cy.one('render', resolve);
        cy.viewport({ zoom: 1, pan: { x: 0, y: 0 } });
      });
      await cy.viewportCounts();
    });

    const convex = await page.evaluate(async () => {
      const picked = await cy.pick(52, 52);
      return { ...hullStatus(), gpuPick: picked?.id() ?? null };
    });

    expect(convex.shape).toBe('convex-hull');
    expect(convex.pick).toBe('p');
    expect(convex.gpuPick).toBe('p');

    await page.selectOption('#shape', 'round-convex-hull');
    const rounded = await page.evaluate(async () => {
      await cy.viewportCounts();
      const picked = await cy.pick(52, 52);
      return { ...hullStatus(), gpuPick: picked?.id() ?? null };
    });
    expect(rounded.shape).toBe('round-convex-hull');
    expect(rounded.pick).toBe('p');
    expect(rounded.gpuPick).toBe('p');

    await page.selectOption('#shape', 'concave-hull');
    const concave = await page.evaluate(async () => {
      await cy.viewportCounts();
      const picked = await cy.pick(52, 52);
      return { ...hullStatus(), gpuPick: picked?.id() ?? null };
    });

    expect(concave.shape).toBe('concave-hull');
    expect(concave.pick).toBe(null);
    expect(concave.gpuPick).toBe(null);
    expect(concave.endpoint.x).toBeGreaterThan(50);
    expect(deviceErrors).toEqual([]);
  });
});
