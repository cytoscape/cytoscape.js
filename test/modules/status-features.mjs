import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { buildPlan } from '../../scripts/status-build.mjs';
import { featuresPage } from '../../scripts/status/features-page.mjs';
import { readInventory } from '../../scripts/status/feature-inventory.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CSV = readFileSync(join(ROOT, 'docs/features.csv'), 'utf8');
const rows = readInventory(ROOT, CSV);

describe('feature status page', () => {
  it('escapes authored data in table cells and filter options', () => {
    const html = featuresPage([
      {
        Category: '<img src=x>',
        Feature: '<script>bad()</script>',
        Status: 'Implemented',
        Comments: '"quotes" & <markup>',
        Reference: 'src/core.mts',
      },
    ]);
    expect(html).not.to.include('<img src=x>');
    expect(html).not.to.include('<script>bad()');
    expect(html).to.include('&lt;script&gt;');
    expect(html).to.include('&amp; &lt;markup&gt;');
  });

  it('publishes the same complete CSV and all rows with navigation and source links', () => {
    const plan = buildPlan({ root: ROOT, gzip: false });
    const text = (name) => plan.ops.find((op) => op.to === name)?.text;
    expect(text('features.csv')).to.equal(CSV);
    const html = text('features.html');
    const table = html.slice(html.indexOf('<table class="features">'));
    expect((table.match(/<tr>/g) ?? []).length).to.equal(rows.length + 1);
    expect(html).to.include('download="cytoscape-v4-features.csv"');
    expect(html).to.include('aria-current="page"');
    expect(html).to.include('/design.html');
    expect(html).to.include('src/core.mts#L');
    expect(text('index.html')).to.include('href="/features.html"');
    expect(text('summary.html')).to.include('href="/features.html"');
  });
});
