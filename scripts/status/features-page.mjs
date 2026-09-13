import { esc } from '../theme.mjs';
import { COLUMNS, STATUSES } from './feature-inventory.mjs';

export const FEATURES_CSS = `
.feature-tools { display: flex; flex-wrap: wrap; gap: 12px; margin: 24px 0 12px; }
.feature-tools[hidden] { display: none; }
.feature-field { display: flex; flex-direction: column; gap: 5px; font-size: 13px; }
.feature-tools input, .feature-tools select { font: inherit; padding: 8px; color: var(--ink); background: var(--surface); border: 1px solid var(--border); border-radius: 4px; max-width: 100%; }
.feature-tools input { width: 28ch; }
.feature-scroll { overflow-x: auto; }
table.features { width: 100%; border-collapse: collapse; }
.features th { text-align: left; }
.features th, .features td { vertical-align: top; padding: 10px 12px; border-bottom: 1px solid var(--border); }
.features .feature-name { font-family: var(--mono, monospace); min-width: 19ch; overflow-wrap: anywhere; }
.features .feature-comment { min-width: 30ch; max-width: 85ch; }
.features .feature-status { white-space: nowrap; }
.features caption { text-align: left; margin-bottom: 12px; color: var(--muted); }
.feature-legend { margin: 16px 0; }
.feature-legend dt { font-weight: 600; margin-top: 8px; }
.feature-legend dd { margin-left: 0; }
@media (max-width: 600px) {
  .layout { padding: 20px 12px; }
  .feature-field { width: 100%; }
  .feature-tools input { width: auto; }
}
`;

// The full table is server-rendered. This script only narrows visible rows;
// download always points at the original complete CSV.
export const FEATURES_SCRIPT = `
(() => {
  const tools = document.querySelector('.feature-tools');
  const search = document.getElementById('feature-search');
  const category = document.getElementById('feature-category');
  const status = document.getElementById('feature-status');
  const count = document.getElementById('feature-count');
  const empty = document.getElementById('feature-empty');
  const rows = [...document.querySelectorAll('.features tbody tr')].map(row => ({
    row, category: row.cells[0].textContent, status: row.cells[2].textContent,
    text: [...row.cells].slice(0, 4).map(cell => cell.textContent).join(' ').toLowerCase()
  }));
  function filter() {
    const query = search.value.trim().toLowerCase();
    let shown = 0;
    for (const item of rows) {
      const match = (!category.value || item.category === category.value)
        && (!status.value || item.status === status.value)
        && (!query || item.text.includes(query));
      item.row.hidden = !match;
      if (match) shown++;
    }
    count.textContent = shown + ' of ' + rows.length + ' features';
    empty.hidden = shown !== 0;
  }
  search.addEventListener('input', filter);
  category.addEventListener('change', filter);
  status.addEventListener('change', filter);
  tools.hidden = false;
})();
`;

export function featuresPage(rows, { sha = null, pageFor = () => null } = {}) {
  const options = (values) =>
    values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  const reference = (row) => {
    const [file, line] = row.Reference.split(':');
    const local = pageFor(file);
    const href =
      local != null
        ? `/${local}`
        : `https://github.com/cytoscape/cytoscape.js/blob/${sha ?? 'v4'}/${file}${line ? `#L${line}` : ''}`;
    return `<a href="${esc(href)}" title="${esc(row.Reference)}">${local != null ? 'Record' : 'Source'}</a>`;
  };
  return `<h1>V4 feature status</h1>
  <p class="lede">Public APIs, style properties, layouts and capabilities, including v3 gaps and replacements. <strong>V4 is unreleased.</strong> Implemented means available in this prototype, not release-ready.</p>
  <p>API rows use <code>eles.</code> for collections, single elements, nodes and edges. Aliases have separate rows; overloads share a row. Comments describe v4 behaviour, not a promise of complete v3 compatibility.</p>
  <p><a href="features.csv" download="cytoscape-v4-features.csv">Download CSV</a> — the complete inventory, including comments and source references. Maintained with feature changes; the build stamp identifies this snapshot.</p>
  <details class="feature-legend"><summary>Status definitions</summary><dl>${Object.entries(
    STATUSES,
  )
    .map(([name, meaning]) => `<dt>${esc(name)}</dt><dd>${esc(meaning)}</dd>`)
    .join('')}</dl></details>
  <div class="feature-tools" hidden>
    <div class="feature-field"><label for="feature-search">Search features and comments</label><input id="feature-search" type="search" placeholder="e.g. labels, force, cy.json"></div>
    <div class="feature-field"><label for="feature-category">Category</label><select id="feature-category"><option value="">All categories</option>${options([...new Set(rows.map((r) => r.Category))].sort())}</select></div>
    <div class="feature-field"><label for="feature-status">Status</label><select id="feature-status"><option value="">All statuses</option>${options(Object.keys(STATUSES))}</select></div>
  </div>
  <p id="feature-count" role="status" aria-live="polite">${rows.length} of ${rows.length} features</p>
  <div class="feature-scroll" role="region" aria-label="Feature inventory" tabindex="0">
  <table class="features"><caption>Current v4 support; see comments for limitations and alternatives.</caption>
  <thead><tr>${COLUMNS.map((c) => `<th scope="col">${c}</th>`).join('')}</tr></thead>
  <tbody>${rows.map((r) => `<tr><td>${esc(r.Category)}</td><td class="feature-name">${esc(r.Feature)}</td><td class="feature-status">${esc(r.Status)}</td><td class="feature-comment">${esc(r.Comments)}</td><td>${reference(r)}</td></tr>`).join('\n')}</tbody></table>
  </div><p id="feature-empty" hidden>No features match these filters.</p>
  <script>${FEATURES_SCRIPT}</script>`;
}
