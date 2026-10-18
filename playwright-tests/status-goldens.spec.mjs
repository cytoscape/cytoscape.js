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
