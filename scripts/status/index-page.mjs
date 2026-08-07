// Round 46.5: the landing page — repo state, then where to go.
//
// The staleness tile is the one that earns its place.  This repo's most
// repeated operational failure is trusting a stale bundle (AGENTS.md says so
// twice, and the `__name` finding is the same lesson in a second guise).  A
// preview site that served a bundle older than `src/` without saying so would
// be a new instance of exactly that, so it says so, in the warning colour.
import { esc, fmtBytes, fmtAge } from '../theme.mjs';

function tile(label, value, sub, cls = '') {
  if (value == null) {
    return '';
  }

  return `<div class="tile ${cls}">
    <span class="tile-label">${esc(label)}</span>
    <span class="tile-value">${value}</span>
    ${sub != null ? `<span class="tile-sub">${sub}</span>` : ''}
  </div>`;
}

function card({ title, href, blurb, available, reason, badges = [] }) {
  const body = `<span class="card-title">${esc(title)}</span>
    <span class="card-blurb">${blurb}</span>
    ${badges.length > 0 ? `<span class="card-badges">${badges.map((b) => `<b>${esc(b)}</b>`).join('')}</span>` : ''}
    ${available ? '' : `<span class="card-reason">${esc(reason ?? 'not available in this build')}</span>`}`;

  return available
    ? `<a class="card" href="${esc(href)}">${body}</a>`
    : `<div class="card unavailable">${body}</div>`;
}

/**
 * @param state — from `repoState()`
 * @param parts — `[ { id, title, href, blurb, available, reason, badges } ]`
 */
export function indexPage({ state, parts }) {
  const stale = state.staleness.staleByMs;
  const bundles = state.bundles.filter((b) => /min|umd/.test(b.file));

  const tiles = [
    tile(
      'branch',
      `<code>${esc(state.branch ?? '?')}</code>`,
      state.commit.short != null
        ? `${esc(state.commit.short)}${state.commit.pushed ? '' : ' · not pushed'}`
        : null,
    ),
    tile(
      'last commit',
      esc(
        state.commit.ageMs != null ? (fmtAge(state.commit.ageMs) ?? '?') : '?',
      ),
      state.commit.subject != null ? esc(state.commit.subject) : null,
    ),
    tile(
      'working tree',
      state.dirty.count === 0 ? 'clean' : `${state.dirty.count} changed`,
      state.dirty.count === 0
        ? null
        : esc(
            state.dirty.files
              .slice(0, 3)
              .map((f) => f.trim())
              .join(', '),
          ),
      state.dirty.count === 0 ? '' : 'warn',
    ),
    ...bundles.map((b) =>
      tile(
        b.file.replace('cytoscape.', ''),
        esc(fmtBytes(b.bytes) ?? '?'),
        b.gzipBytes != null
          ? `${esc(fmtBytes(b.gzipBytes) ?? '')} gzipped`
          : null,
      ),
    ),
    // a bundle older than src/ means every page below is showing yesterday
    stale != null && stale > 60e3
      ? tile(
          'bundle',
          'stale',
          `${esc(fmtAge(stale)?.replace(' ago', '') ?? '')} older than src/ — run <code>npm run build</code>`,
          'warn',
        )
      : tile('bundle', 'current', 'newer than every file in src/'),
  ].join('');

  const machine =
    state.machine != null
      ? `<p class="note">Built on ${esc(state.machine.cpu?.model ?? 'an unknown machine')} ·
       ${esc(state.machine.os?.distro ?? state.machine.os?.platform ?? '')} ·
       node ${esc(state.machine.node?.version ?? '?')}</p>`
      : '';

  return `<h1>cytoscape.js v4 — status</h1>
  <p class="lede">A live preview of the <code>v4</code> branch: the development harness running on the
  WebGPU renderer, the benchmark archive, the generated API reference, and the documents that record
  what v4 is and why. Rebuilt on every push. <strong>Not a release, and not close to one</strong> — the
  round list in the development record is what has been written down rather than everything 4.0 needs.
  For the released library use
  <a href="https://www.npmjs.com/package/cytoscape" rel="noreferrer">cytoscape@3</a>.</p>

  <div class="tiles">${tiles}</div>
  ${machine}

  <div class="cards">${parts.map(card).join('')}</div>`;
}

export const INDEX_CSS = `
.tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; margin: 22px 0 14px; }
.tile {
  display: flex; flex-direction: column; gap: 1px; padding: 10px 12px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 6px; min-width: 0;
}
.tile-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
.tile-value { font-size: 17px; font-weight: 600; }
.tile-sub { font-size: 12px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tile.warn .tile-value { color: var(--warn); }
.tile.warn .tile-sub { color: var(--warn); white-space: normal; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-top: 24px; }
.card {
  display: flex; flex-direction: column; gap: 3px; padding: 14px 16px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 6px;
  text-decoration: none; color: inherit;
}
.card:hover { border-color: var(--accent); }
.card.unavailable { opacity: 0.62; }
.card-title { font-weight: 600; font-size: 15px; }
.card-blurb { font-size: 13px; color: var(--ink-2); }
.card-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.card-badges b {
  font-size: 11px; font-weight: 500; color: var(--ink-2);
  border: 1px solid var(--border); border-radius: 10px; padding: 1px 8px;
}
.card-reason { font-size: 12px; color: var(--warn); margin-top: 4px; }
.lede { max-width: 82ch; color: var(--ink-2); }
.note { font-size: 12px; color: var(--muted); }`;
