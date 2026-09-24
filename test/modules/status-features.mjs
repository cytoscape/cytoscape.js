import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { buildPlan } from '../../scripts/status-build.mjs';
import {
  countBy,
  featuresPage,
  STATUS_GROUPS,
  statusIcon,
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
    for (const group of STATUS_GROUPS) {
      for (const name of group.statuses) {
        const meaning = STATUSES[name];
        const n = byStatus.get(name) ?? 0;
        expect(html).to.include(
          `${statusIcon(name)}${name}</th><td class="legend-count${n === 0 ? ' is-zero' : ''}" data-status="${name}">${n}</td><td>${meaning}</td>`,
        );
        expect(html).to.include(
          `<option value="${name}">${group.icon} ${name} (${n}) — ${meaning}</option>`,
        );
      }
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
    const cell =
      /<td class="feature-status" title="([^"]*)" data-status="([^"]*)">(<span class="status-icon" aria-hidden="true">[^<]+<\/span>)([^<]*)</g;
    const cells = [...html.matchAll(cell)];
    expect(cells).to.have.length(rows.length);
    for (const [, title, status, icon, text] of cells) {
      expect(title).to.equal(STATUSES[status]);
      expect(icon).to.equal(statusIcon(status));
      expect(text).to.equal(status);
    }
  });

  it('groups statuses by colour: every status in exactly one group, the picker in optgroups', () => {
    const grouped = STATUS_GROUPS.flatMap((g) => g.statuses);
    expect([...grouped].sort()).to.deep.equal(Object.keys(STATUSES).sort());
    expect(STATUS_GROUPS.map((g) => g.icon)).to.deep.equal([
      '\u2705',
      '\u{1F7E8}',
      '\u{1F534}',
    ]);
    const html = featuresPage(rows);
    const legend = html.slice(
      html.indexOf('<table class="feature-legend">'),
      html.indexOf('</table>'),
    );
    const order = [...legend.matchAll(/data-status="([^"]*)"/g)].map(
      (m) => m[1],
    );
    expect(order).to.deep.equal(grouped);
    for (const g of STATUS_GROUPS) {
      expect(html).to.include(`<optgroup label="${g.icon} ${g.label}">`);
    }
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
