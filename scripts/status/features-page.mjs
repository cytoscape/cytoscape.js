import { esc } from '../theme.mjs';
import { COLUMNS, STATUSES } from './feature-inventory.mjs';

/** Statuses grouped by colour: ✅ is settled (built, or decided against or
 * around), 🟨 is built with limits, 🔴 still waits on work or a decision.
 * The legend and the status picker list statuses in this order. */
export const STATUS_GROUPS = [
  {
    label: 'Settled',
    icon: '\u2705',
    statuses: ['Implemented', 'Replaced', 'Not implemented', 'Excluded'],
  },
  { label: 'Partial', icon: '\u{1F7E8}', statuses: ['Partial'] },
  {
    label: 'Open',
    icon: '\u{1F534}',
    statuses: ['Planned', 'Proposed', 'Undecided'],
  },
];

const ICONS = new Map(
  STATUS_GROUPS.flatMap((g) => g.statuses.map((name) => [name, g.icon])),
);

/** The status's colour emoji; hidden from assistive tech, which reads the name. */
export const statusIcon = (name) =>
  `<span class="status-icon" aria-hidden="true">${ICONS.get(name) ?? ''}</span>`;

export const FEATURES_CSS = `
.feature-actions { display: flex; flex-wrap: wrap; gap: 12px; margin: 18px 0 20px; }
.feature-button { display: inline-block; padding: 11px 20px; font-size: 15px; font-weight: 600; color: var(--page); background: var(--accent); border-radius: 6px; text-decoration: none; }
.feature-button:hover { filter: brightness(1.08); }
.feature-button:focus-visible { outline: 3px solid var(--ink); outline-offset: 2px; }
.feature-composition { color: var(--ink-2); }
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
.status-icon { margin-right: 6px; }
.features caption { text-align: left; margin-bottom: 12px; color: var(--muted); }
.feature-legend { margin: 16px 0; border-collapse: collapse; }
.feature-legend caption { text-align: left; font-weight: 600; margin-bottom: 6px; }
.feature-legend th { text-align: left; }
.feature-legend th, .feature-legend td { vertical-align: top; padding: 6px 12px 6px 0; border-bottom: 1px solid var(--border); }
.feature-legend .legend-count { text-align: right; font-variant-numeric: tabular-nums; padding-right: 20px; }
.feature-legend .is-zero { color: var(--muted); }
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
  const caption = document.getElementById('feature-legend-caption');
  const empty = document.getElementById('feature-empty');
  const tallies = [...document.querySelectorAll('.feature-legend [data-status]')];
  const rows = [...document.querySelectorAll('.features tbody tr')].map(row => ({
    row, category: row.cells[0].textContent, status: row.cells[2].dataset.status,
    text: [...row.cells].slice(0, 4).map(cell => cell.textContent).join(' ').toLowerCase()
  }));
  function filter() {
    const query = search.value.trim().toLowerCase();
    const tally = {};
    let shown = 0;
    for (const item of rows) {
      const match = (!category.value || item.category === category.value)
        && (!status.value || item.status === status.value)
        && (!query || item.text.includes(query));
      item.row.hidden = !match;
      if (match) { shown++; tally[item.status] = (tally[item.status] || 0) + 1; }
    }
    count.textContent = shown === rows.length
      ? 'Showing all ' + rows.length + ' rows'
      : 'Showing ' + shown + ' of ' + rows.length + ' rows';
    for (const cell of tallies) {
      const n = tally[cell.dataset.status] || 0;
      cell.textContent = n;
      cell.classList.toggle('is-zero', n === 0);
    }
    caption.textContent = shown === rows.length ? 'Statuses \u2014 all ' + rows.length + ' rows'
      : category.value && !status.value && !query ? 'Statuses \u2014 ' + category.value + ', ' + shown + ' rows'
      : 'Statuses \u2014 ' + shown + ' matching rows';
    empty.hidden = shown !== 0;
  }
  search.addEventListener('input', filter);
  category.addEventListener('change', filter);
  status.addEventListener('change', filter);
  tools.hidden = false;
})();
`;

/** Counts rows by kind: one member row is one API function or one style
 * property; a capability row is a whole feature.  The total is not a measure
 * of work, so the page says what it is made of. */
export function summarise(rows) {
  let api = 0;
  let style = 0;
  for (const row of rows) {
    if (row.Category === 'API') api++;
    else if (row.Category === 'Style') style++;
  }
  return {
    total: rows.length,
    api,
    style,
    capability: rows.length - api - style,
  };
}

/** Rows per distinct value of one column, in first-seen order. */
export function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) counts.set(row[key], (counts.get(row[key]) ?? 0) + 1);
  return counts;
}

export function featuresPage(rows, { sha = null, pageFor = () => null } = {}) {
  const sum = summarise(rows);
  const byStatus = countBy(rows, 'Status');
  const byCategory = countBy(rows, 'Category');
  const options = (values, label) =>
    values
      .map((v) => `<option value="${esc(v)}">${esc(label(v))}</option>`)
      .join('');
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
  <p class="feature-actions"><a class="feature-button" href="features.csv" download="cytoscape-v4-features.csv">Download CSV</a><a class="feature-button" href="direction.html">Feature-direction review</a></p>
  <p class="feature-composition"><strong>${sum.total} rows: ${sum.api} API members, ${sum.style} style properties, ${sum.capability} capabilities.</strong> A member row is one function or one style property; a capability row is a whole feature. The total counts rows, not work.</p>
  <p>Priority areas appear first: performance, developer experience, Cytoscape Web v2, application workflows and core capabilities; the feature-direction review gives the reasoning. Proposed rows are suggestions, not roadmap commitments.</p>
  <p>API rows use <code>eles.</code> for collections, single elements, nodes and edges. Aliases have separate rows; overloads share a row. Comments describe v4 behaviour, not a promise of complete v3 compatibility. The CSV download is the complete inventory, including comments and source references; the build stamp identifies this snapshot.</p>
  <div class="feature-tools" hidden>
    <div class="feature-field"><label for="feature-search">Search features and comments</label><input id="feature-search" type="search" placeholder="e.g. labels, force, cy.json"></div>
    <div class="feature-field"><label for="feature-category">Category</label><select id="feature-category"><option value="">All categories (${rows.length})</option>${options([...byCategory.keys()].sort(), (v) => `${v} (${byCategory.get(v)})`)}</select></div>
    <div class="feature-field"><label for="feature-status">Status</label><select id="feature-status"><option value="">All statuses (${rows.length})</option>${STATUS_GROUPS.map((g) => `<optgroup label="${esc(`${g.icon} ${g.label}`)}">${options(g.statuses, (v) => `${ICONS.get(v)} ${v} (${byStatus.get(v) ?? 0}) — ${STATUSES[v]}`)}</optgroup>`).join('')}</select></div>
  </div>
  <table class="feature-legend"><caption id="feature-legend-caption">Statuses — all ${rows.length} rows</caption>
  <thead><tr><th scope="col">Status</th><th scope="col" class="legend-count">Rows</th><th scope="col">Meaning</th></tr></thead>
  <tbody>${STATUS_GROUPS.flatMap((g) => g.statuses)
    .map((name) => {
      const meaning = STATUSES[name];
      const n = byStatus.get(name) ?? 0;
      return `<tr><th scope="row" title="${esc(meaning)}">${statusIcon(name)}${esc(name)}</th><td class="legend-count${n === 0 ? ' is-zero' : ''}" data-status="${esc(name)}">${n}</td><td>${esc(meaning)}</td></tr>`;
    })
    .join('')}</tbody></table>
  <p id="feature-count" role="status" aria-live="polite">Showing all ${rows.length} rows</p>
  <div class="feature-scroll" role="region" aria-label="Feature inventory" tabindex="0">
  <table class="features"><caption>Current v4 support; see comments for limitations and alternatives.</caption>
  <thead><tr>${COLUMNS.map((c) => `<th scope="col">${c}</th>`).join('')}</tr></thead>
  <tbody>${rows.map((r) => `<tr><td>${esc(r.Category)}</td><td class="feature-name">${esc(r.Feature)}</td><td class="feature-status" title="${esc(STATUSES[r.Status] ?? '')}" data-status="${esc(r.Status)}">${statusIcon(r.Status)}${esc(r.Status)}</td><td class="feature-comment">${esc(r.Comments)}</td><td>${reference(r)}</td></tr>`).join('\n')}</tbody></table>
  </div><p id="feature-empty" hidden>No features match these filters.</p>
  <script>${FEATURES_SCRIPT}</script>`;
}
