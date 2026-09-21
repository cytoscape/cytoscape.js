import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { buildPlan } from '../../scripts/status-build.mjs';
import {
  countBy,
  featuresPage,
  summarise,
} from '../../scripts/status/features-page.mjs';
import {
  readInventory,
  STATUSES,
} from '../../scripts/status/feature-inventory.mjs';

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
    expect(html).to.include(
      '<option value="&lt;img src=x&gt;">&lt;img src=x&gt; (1)</option>',
    );
  });

  it('says what its numbers are: rows by kind, totals per status, counts in the pickers', () => {
    const html = featuresPage(rows);
    const sum = summarise(rows);
    expect(sum.api + sum.style + sum.capability).to.equal(rows.length);
    expect(sum.api).to.be.greaterThan(sum.capability);
    expect(html).to.include(
      `${sum.total} rows: ${sum.api} API members, ${sum.style} style properties, ${sum.capability} capabilities.`,
    );
    expect(html).to.include(`>Showing all ${rows.length} rows</p>`);
    expect(html).to.include(`Statuses — all ${rows.length} rows`);
    const byStatus = countBy(rows, 'Status');
    const byCategory = countBy(rows, 'Category');
    for (const [name, meaning] of Object.entries(STATUSES)) {
      const n = byStatus.get(name) ?? 0;
      expect(html).to.include(
        `data-status="${name}">${n}</td><td>${meaning}</td>`,
      );
      expect(html).to.include(
        `<option value="${name}">${name} (${n}) — ${meaning}</option>`,
      );
    }
    for (const [name, n] of byCategory) {
      expect(html).to.include(
        `<option value="${name}">${name} (${n})</option>`,
      );
    }
    expect(html).to.include(
      `<option value="">All categories (${rows.length})</option>`,
    );
    expect(html).to.include('<table class="feature-legend">');
    expect(html).not.to.include('<details');
    expect(html).to.include(
      'class="feature-button" href="features.csv" download="cytoscape-v4-features.csv">Download CSV</a>',
    );
    expect(html).to.include(
      'class="feature-button" href="direction.html">Feature-direction review</a>',
    );
    const cells = html.match(
      /<td class="feature-status" title="([^"]*)">([^<]*)</g,
    );
    expect(cells).to.have.length(rows.length);
    const one = /<td class="feature-status" title="([^"]*)">([^<]*)</.exec(
      cells[0],
    );
    expect(one[1]).to.equal(STATUSES[one[2]]);
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
