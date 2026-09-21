import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { buildPlan } from '../scripts/status-build.mjs';
import {
  readInventory,
  STATUSES,
} from '../scripts/status/feature-inventory.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const inventory = readInventory(root);
const plan = buildPlan({
  root,
  gzip: false,
  skip: new Set(['debug', 'benchmark', 'goldens', 'docs', 'api']),
});
const html = plan.ops.find((op) => op.to === 'features.html').text;
const csv = plan.ops.find((op) => op.to === 'features.csv').text;
let server;
let url;

test.beforeAll(async () => {
  // Native browser downloads bypass page-route interception. Serve the real
  // build outputs so the test checks bytes delivered by HTTP, not a mock.
  server = createServer((req, res) => {
    if (req.url === '/features.html' || req.url === '/features.csv') {
      const isCsv = req.url.endsWith('.csv');
      res.writeHead(200, {
        'Content-Type': isCsv
          ? 'text/csv; charset=utf-8'
          : 'text/html; charset=utf-8',
      });
      res.end(isCsv ? csv : html);
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}/features.html`;
});

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('feature table filters compose and the download retains the whole inventory', async ({
  page,
}) => {
  await page.goto(url);
  const visible = page.locator('.features tbody tr:visible');
  await expect(visible).toHaveCount(inventory.length);
  const legend = page.locator('.feature-legend');
  const tally = (status) => legend.locator(`[data-status="${status}"]`);
  const inStyle = inventory.filter((row) => row.Category === 'Style');
  await expect(legend.locator('caption')).toHaveText(
    `Statuses — all ${inventory.length} rows`,
  );
  await expect(tally('Replaced')).toHaveText(
    String(inventory.filter((row) => row.Status === 'Replaced').length),
  );
  await page.getByLabel('Category', { exact: true }).selectOption('Style');
  await expect(page.getByRole('status')).toHaveText(
    `Showing ${inStyle.length} of ${inventory.length} rows`,
  );
  await expect(legend.locator('caption')).toHaveText(
    `Statuses — Style, ${inStyle.length} rows`,
  );
  await expect(tally('Replaced')).toHaveText(
    String(inStyle.filter((row) => row.Status === 'Replaced').length),
  );
  const absent = Object.keys(STATUSES).find(
    (name) => !inStyle.some((row) => row.Status === name),
  );
  await expect(tally(absent)).toHaveText('0');
  await expect(tally(absent)).toHaveClass(/is-zero/);
  await page.getByLabel('Status', { exact: true }).selectOption('Replaced');
  await expect(tally('Implemented')).toHaveText('0');
  await page.getByRole('searchbox').fill('  PIE-16  ');
  await expect(visible).toHaveCount(3);
  await expect(page.getByRole('status')).toHaveText(
    `Showing 3 of ${inventory.length} rows`,
  );
  await expect(legend.locator('caption')).toHaveText(
    'Statuses — 3 matching rows',
  );
  await expect(tally('Replaced')).toHaveText('3');
  await expect(visible.first().locator('.feature-status')).toHaveAttribute(
    'title',
    'Use the v4 alternative named in Comments.',
  );
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download CSV' }).click();
  const download = await downloadPromise;
  expect(readFileSync(await download.path(), 'utf8')).toBe(csv);
  await page.getByRole('searchbox').fill('no-such-feature-xyz');
  await expect(visible).toHaveCount(0);
  await expect(
    page.getByText('No features match these filters.'),
  ).toBeVisible();
  await page.getByRole('searchbox').fill('');
  await page.getByLabel('Category', { exact: true }).selectOption('');
  await page.getByLabel('Status', { exact: true }).selectOption('');
  await expect(visible).toHaveCount(inventory.length);
  await expect(page.getByRole('status')).toHaveText(
    `Showing all ${inventory.length} rows`,
  );
});

test('feature table remains complete without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(url);
    await expect(page.locator('.features tbody tr:visible')).toHaveCount(
      inventory.length,
    );
    await expect(
      page.getByRole('link', { name: 'Download CSV' }),
    ).toBeVisible();
    await expect(page.getByRole('searchbox')).toBeHidden();
    await expect(
      page.getByRole('link', { name: 'Feature-direction review' }),
    ).toBeVisible();
    await expect(page.locator('.feature-legend [data-status]')).toHaveCount(
      Object.keys(STATUSES).length,
    );
    await expect(page.getByRole('status')).toHaveText(
      `Showing all ${inventory.length} rows`,
    );
  } finally {
    await context.close();
  }
});

test('feature controls fit narrow screens in light and dark themes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme });
    await page.goto(url);
    await expect(page.getByRole('searchbox')).toBeVisible();
    await page.getByRole('searchbox').fill('v3 import/setter');
    await expect(page.locator('.features tbody tr:visible')).toHaveCount(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
