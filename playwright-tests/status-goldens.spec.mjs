import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PNG } from 'pngjs';
import { planGoldens, GOLDENS_CSS } from '../scripts/status/goldens-page.mjs';

let root;
let server;
let url;

test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'status-goldens-browser-'));
  const referenceDir = join(root, 'playwright-tests', 'goldens');
  const currentDir = join(root, 'playwright-tests', 'golden-current');
  mkdirSync(referenceDir, { recursive: true });
  mkdirSync(currentDir, { recursive: true });
  const gold = new PNG({ width: 80, height: 60 });
  gold.data.fill(255);
  const now = PNG.sync.read(PNG.sync.write(gold));
  now.data.set([0, 0, 0, 255], (30 * now.width + 40) * 4);
  for (const name of ['changed', 'matching', 'untested']) {
    writeFileSync(join(referenceDir, `${name}.png`), PNG.sync.write(gold));
  }
  writeFileSync(join(currentDir, 'changed.png'), PNG.sync.write(now));
  writeFileSync(join(currentDir, 'matching.png'), PNG.sync.write(gold));
  const plan = planGoldens({ root });
  const html = `<!doctype html><html><head><style>${GOLDENS_CSS}</style></head><body><main class="prose">${plan.html}</main></body></html>`;

  server = createServer((req, res) => {
    const asset = plan.ops.find((op) => `/${op.to}` === req.url);
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } else if (asset != null) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(asset.kind === 'copy' ? readFileSync(asset.from) : asset.text);
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}/`;
});

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  rmSync(root, { recursive: true, force: true });
});

test('golden cards cycle Gold, Now, Diff and offer independent direct controls', async ({
  page,
}) => {
  await page.goto(url);
  const card = page.locator('[data-golden="changed"]');
  const matching = page.locator('[data-golden="matching"]');
  const gold = card.locator('[data-golden-view="gold"]');
  const now = card.locator('[data-golden-view="now"]');
  const diff = card.locator('[data-golden-view="diff"]');
  const cycle = card.getByRole('button', { name: 'Next view for changed' });

  await expect(gold).toBeVisible();
  await expect(now).toBeHidden();
  await expect(diff).toBeHidden();
  await expect(card.locator('.golden-metric.changed')).toHaveText(
    '1 px differ',
  );
  await expect(matching.locator('.golden-metric')).toHaveText('0 px differ');

  for (const key of ['now', 'diff', 'gold']) {
    await cycle.click();
    await expect(card.locator(`[data-golden-view="${key}"]`)).toBeVisible();
    await expect(card.locator(`[data-golden-select="${key}"]`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(matching.locator('[data-golden-view="gold"]')).toBeVisible();
  }

  for (const label of ['Diff', 'Gold', 'Now']) {
    await card.getByRole('button', { name: label, exact: true }).click();
    await expect(
      card.locator(`[data-golden-view="${label.toLowerCase()}"]`),
    ).toBeVisible();
  }
  // Direct selection also changes the cycle's starting point.
  await cycle.focus();
  await page.keyboard.press('Enter');
  await expect(diff).toBeVisible();
  expect(
    await diff
      .locator('img')
      .evaluate((img) => img.complete && img.naturalWidth === 80),
  ).toBe(true);
  await expect(diff).toHaveAttribute('href', 'goldens/diff/changed.png');
});

test('untested goldens keep their reference visible with unavailable views disabled', async ({
  page,
}) => {
  await page.goto(url);
  const card = page.locator('[data-golden="untested"]');
  await expect(card.locator('[data-golden-view="gold"]')).toBeVisible();
  await expect(card.locator('.golden-metric')).toHaveText('Not tested yet');
  for (const name of ['Now', 'Diff', 'Next view for untested']) {
    await expect(
      card.getByRole('button', { name, exact: true }),
    ).toBeDisabled();
  }
});

test('images open an overlay with bottom controls and download the selected view', async ({
  page,
}) => {
  await page.goto(url);
  const card = page.locator('[data-golden="changed"]');
  await card.locator('[data-golden-view="gold"]').click();
  const overlay = page.getByRole('dialog', { name: 'changed', exact: true });
  await expect(overlay).toBeVisible();
  expect(page.url()).toBe(url);
  const bounds = await overlay.boundingBox();
  const viewport = page.viewportSize();
  expect(bounds.width).toBeGreaterThan(viewport.width * 0.9);
  expect(bounds.height).toBeGreaterThan(viewport.height * 0.9);
  const controls = overlay.locator('.golden-controls');
  const controlsBounds = await controls.boundingBox();
  expect(controlsBounds.y).toBeGreaterThan(bounds.y + bounds.height * 0.75);
  await expect(overlay.locator('.golden-metric.changed')).toHaveText(
    '1 px differ',
  );

  for (const label of ['Gold', 'Now', 'Diff']) {
    await controls.getByRole('button', { name: label, exact: true }).click();
    const link = overlay.getByRole('link', {
      name: `Download ${label} image for changed`,
    });
    await expect(link).toHaveText('DL');
    const count = await overlay.locator('.golden-metric').boundingBox();
    const dl = await link.boundingBox();
    expect(Math.abs(count.y - dl.y)).toBeLessThan(5);
    expect(dl.x).toBeGreaterThan(count.x + count.width);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      link.click(),
    ]);
    expect(download.suggestedFilename()).toBe(
      `changed-${label.toLowerCase()}.png`,
    );
    const downloaded = readFileSync(await download.path());
    const expectedPath =
      label === 'Gold'
        ? 'goldens/changed.png'
        : label === 'Now'
          ? 'goldens/current/changed.png'
          : 'goldens/diff/changed.png';
    const response = await page.request.get(new URL(expectedPath, url).href);
    expect(downloaded.equals(await response.body())).toBe(true);
  }

  await overlay.getByRole('button', { name: 'Close image' }).click();
  await expect(overlay).not.toBeVisible();
  await expect(
    page.locator('.golden-grid [data-golden="changed"]'),
  ).toBeVisible();
  await expect(card.locator('[data-golden-view="diff"]')).toBeFocused();
  await card.locator('[data-golden-view="diff"]').click();
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('[data-golden-view="diff"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(overlay).not.toBeVisible();
});

test('the overlay fits narrow screens and closes from its backdrop', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  const card = page.locator('[data-golden="untested"]');
  await card.locator('[data-golden-view="gold"]').click();
  const overlay = page.getByRole('dialog', { name: 'untested', exact: true });
  await expect(overlay).toBeVisible();
  const controls = await overlay.locator('.golden-controls').boundingBox();
  const summary = await overlay.locator('.golden-summary').boundingBox();
  expect(controls.x).toBeGreaterThanOrEqual(0);
  expect(controls.x + controls.width).toBeLessThanOrEqual(390);
  expect(summary.y + summary.height).toBeLessThanOrEqual(844);
  await expect(
    overlay.getByRole('button', { name: 'Now', exact: true }),
  ).toBeDisabled();
  await expect(
    overlay.getByRole('link', { name: 'Download Gold image for untested' }),
  ).toHaveText('DL');
  await page.mouse.click(2, 2);
  await expect(overlay).not.toBeVisible();
  await expect(card.locator('[data-golden-view="gold"]')).toBeFocused();
});
