// Round 46.5: the visual goldens as a contact sheet.
//
// Approved PNGs live in `playwright-tests/goldens/`; the most recent tested
// captures live separately in `playwright-tests/golden-current/`. Diffs are
// derived from those two images when building the site. Each name is passed at its
// `checkGolden( '<name>', … )` call site in `playwright-tests/visual.spec.js`,
// so the page can caption each image with the `test()` it came from.
//
// A spec asserts the two counts match.  Without it a rename orphans a PNG
// silently, and this gallery is the only thing that would ever have shown it.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, basename } from 'node:path';

import { PNG } from 'pngjs';
import featureScenes from '../../debug/feature-scenes.js';
import { esc } from '../theme.mjs';
import { copy, write } from './plan.mjs';

// Playwright can load `.mjs` helpers through both its ESM loader and the
// CommonJS transform used by `.spec.js` tests. Requiring this shared helper
// keeps both paths on the same interop view instead of linking a static named
// export after the CommonJS transform has cached it.
const require = createRequire(import.meta.url);
const { goldenComparison } = require('../golden-images.mjs');

/**
 * Map each `checkGolden( 'name', … )` to the `test( 'title' )` enclosing it.
 *
 * A single forward scan over the *whole source* rather than line by line, so
 * a call whose first argument wraps still matches — round 57.2 adopted a
 * formatter, 32 of the 44 `checkGolden(` calls moved their name to the next
 * line, and a line-at-a-time matcher found 12.  The spec below pins the
 * count, which is what turned that into a failure rather than a gallery
 * quietly missing three quarters of its captions.
 *
 * Nesting is one level deep in that file: every `test(` becomes the current
 * title and every `checkGolden(` after it claims that title.  Since round
 * 135 the call takes the page first (`checkGolden( page, '<name>', … )`, so
 * it can capture the scene's style coverage); both spellings match.
 */
export function goldenTitles(
  specSource,
  featureCases = featureScenes.goldenCases,
) {
  const titles = new Map();
  const re =
    /^[ \t]*test\(\s*'((?:[^'\\]|\\.)*)'|checkGolden\(\s*(?:page\s*,\s*)?'([^']+)'/gm;
  let current = null;
  let m;

  while ((m = re.exec(specSource)) != null) {
    if (m[1] != null) current = m[1].replace(/\\'/g, "'");
    else titles.set(m[2], current);
  }

  if (specSource.includes('featureScenes.goldenCases')) {
    for (const sceneCase of featureCases) {
      if (sceneCase.goldenOmissionReason) continue;
      titles.set(
        sceneCase.name,
        `golden: feature ${sceneCase.familyId} / ${sceneCase.stateId ?? sceneCase.viewId}`,
      );
    }
  }

  return titles;
}

/**
 * @returns `{ ops, html, count, orphans }` — `orphans` are PNGs with no call
 *   site and call sites with no PNG, both of which mean a rename went half-done
 */
export function planGoldens({ root }) {
  const dir = join(root, 'playwright-tests', 'goldens');
  const currentDir = join(root, 'playwright-tests', 'golden-current');
  const specPath = join(root, 'playwright-tests', 'visual.spec.js');

  if (!existsSync(dir)) {
    return {
      ops: [],
      html: '',
      count: 0,
      orphans: [],
      available: false,
      reason: 'playwright-tests/goldens/ is missing',
    };
  }

  const pngs = readdirSync(dir)
    .filter((f) => f.endsWith('.png'))
    .sort();
  const specSource = existsSync(specPath) ? readFileSync(specPath, 'utf8') : '';
  const titles =
    specSource.length > 0
      ? goldenTitles(specSource, featureScenes.goldenCases)
      : new Map();

  const ops = pngs.map((f) => copy(join(dir, f), `goldens/${f}`));

  const orphans = [
    ...pngs
      .filter((f) => !titles.has(basename(f, '.png')))
      .map((f) => `png with no call site: ${f}`),
    ...[...titles.keys()]
      .filter((n) => !pngs.includes(`${n}.png`))
      .map((n) => `call site with no png: ${n}`),
  ];

  const cards = pngs
    .map((f) => {
      const name = basename(f, '.png');
      const title = titles.get(name);
      const referenceBytes = readFileSync(join(dir, f));
      const reference = PNG.sync.read(referenceBytes);
      const currentPath = join(currentDir, f);
      let comparison = null;
      let current = null;
      let testedAt = null;

      if (existsSync(currentPath)) {
        const metadataPath = join(currentDir, `${name}.json`);
        const metadata = existsSync(metadataPath)
          ? JSON.parse(readFileSync(metadataPath, 'utf8'))
          : {};

        testedAt = metadata.testedAt ?? null;
        const currentBytes = readFileSync(currentPath);

        // a passing golden's capture is the same file, byte for byte (most
        // of them, on a green run): its decode is the reference's, which
        // nothing below mutates
        current = currentBytes.equals(referenceBytes)
          ? reference
          : PNG.sync.read(currentBytes);
        comparison = goldenComparison(current, reference, {
          threshold: metadata.threshold ?? 0,
        });
        ops.push(copy(currentPath, `goldens/current/${f}`));
        // one fixed filter (Paeth) rather than pngjs's per-row search of all
        // five: 3x faster to encode, 4% larger, on mostly flat grey diffs
        ops.push(
          write(
            `goldens/diff/${f}`,
            PNG.sync.write(comparison.diff, { filterType: 4 }),
          ),
        );
      }

      const view = (key, label, url, image) =>
        `<a data-golden-view="${key}" href="${esc(url)}"${key === 'gold' ? '' : ' hidden'}><img src="${esc(url)}" alt="${esc(name)} — ${label}" width="${image.width}" height="${image.height}" loading="lazy"></a>`;
      const count = comparison?.mismatched;
      const metric =
        comparison == null
          ? 'Not tested yet'
          : `${count.toLocaleString('en-US')} px differ${comparison.sizeChanged ? ' · image size changed' : ''}`;
      const disabled = comparison == null ? ' disabled' : '';

      return `<figure class="golden" data-golden="${esc(name)}">
      ${view('gold', 'Gold reference', `goldens/${f}`, reference)}
      ${comparison == null ? '' : view('now', 'Now, latest tested image', `goldens/current/${f}`, current)}
      ${comparison == null ? '' : view('diff', 'Diff, changed pixels in neon magenta', `goldens/diff/${f}`, comparison.diff)}
      <div class="golden-controls" role="group" aria-label="Views for ${esc(name)}">
        <button type="button" data-golden-cycle aria-label="Next view for ${esc(name)}"${disabled}>View: Gold ↻</button>
        <button type="button" data-golden-select="gold" aria-pressed="true">Gold</button>
        <button type="button" data-golden-select="now" aria-pressed="false"${disabled}>Now</button>
        <button type="button" data-golden-select="diff" aria-pressed="false"${disabled}>Diff</button>
      </div>
      <div class="golden-summary">
        <p class="golden-metric${count > 0 ? ' changed' : ''}" role="status">${metric}</p>
        <a class="golden-download" href="goldens/${esc(f)}" download="${esc(name)}-gold.png" aria-label="Download Gold image for ${esc(name)}">DL</a>
      </div>
      <figcaption><code>${esc(name)}</code>
        <span>${title != null ? esc(title) : '<em>no call site in visual.spec.js</em>'}</span>
        ${testedAt == null ? '' : `<time datetime="${esc(testedAt)}">Last tested ${esc(testedAt.replace('T', ' ').replace('Z', ' UTC'))}</time>`}
      </figcaption>
    </figure>`;
    })
    .join('');

  const html = `<h1>Visual goldens</h1>
  <p class="lede">${pngs.length} golden images from the <code>visual</code> Playwright project — what the
  WebGPU renderer produces for each pinned scene. Gold is the approved reference; Now is the
  latest tested capture, including failed tests. Diff highlights changed pixels in neon magenta
  with a halo so small differences remain visible. Counts use the test's pixel comparison.
  These are v4's own previous output, so they answer
  “did this change?” and not “is this right”; the live v3-vs-v4 parity diffs in the same project
  answer the second question.</p>
  ${orphans.length > 0 ? `<p class="warn">${orphans.map(esc).join('<br>')}</p>` : ''}
  <div class="golden-grid">${cards}</div>
  <dialog class="golden-overlay" aria-labelledby="golden-overlay-title">
    <header><h2 id="golden-overlay-title"></h2><button type="button" data-golden-close aria-label="Close image">Close ×</button></header>
    <div data-golden-overlay-content></div>
  </dialog>
  <script>(${goldenControls.toString()})();</script>`;

  return {
    ops,
    html,
    count: pngs.length,
    orphans,
    available: true,
    reason: null,
  };
}

/** Self-contained, inlined in the static gallery; every card has independent state. */
export function goldenControls() {
  const overlay = document.querySelector('.golden-overlay');
  const content = overlay.querySelector('[data-golden-overlay-content]');
  let expanded = null;
  let placeholder = null;

  overlay
    .querySelector('[data-golden-close]')
    .addEventListener('click', () => overlay.close());
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) overlay.close();
  });
  overlay.addEventListener('close', () => {
    placeholder.replaceWith(expanded);
    expanded.querySelector('[data-golden-view]:not([hidden])').focus();
    expanded = null;
    placeholder = null;
    document.documentElement.classList.remove('golden-overlay-open');
  });

  for (const card of document.querySelectorAll('[data-golden]')) {
    const views = [...card.querySelectorAll('[data-golden-view]')];
    const buttons = card.querySelectorAll('[data-golden-select]');
    const cycle = card.querySelector('[data-golden-cycle]');
    const download = card.querySelector('.golden-download');
    const names = { gold: 'Gold', now: 'Now', diff: 'Diff' };
    let selected = 0;
    const select = (key) => {
      const index = views.findIndex((view) => view.dataset.goldenView === key);

      if (index < 0) return;
      selected = index;

      for (const view of views) view.hidden = view.dataset.goldenView !== key;
      for (const button of buttons) {
        button.setAttribute(
          'aria-pressed',
          String(button.dataset.goldenSelect === key),
        );
      }

      cycle.textContent = `View: ${names[key]} ↻`;
      download.setAttribute('href', views[index].getAttribute('href'));
      download.setAttribute('download', `${card.dataset.golden}-${key}.png`);
      download.setAttribute(
        'aria-label',
        `Download ${names[key]} image for ${card.dataset.golden}`,
      );
    };

    for (const view of views) {
      view.addEventListener('click', (event) => {
        event.preventDefault();
        if (overlay.open) return;

        placeholder = document.createElement('div');
        placeholder.style.minHeight = `${card.getBoundingClientRect().height}px`;
        card.replaceWith(placeholder);
        expanded = card;
        content.append(card);
        overlay.querySelector('#golden-overlay-title').textContent =
          card.dataset.golden;
        document.documentElement.classList.add('golden-overlay-open');
        overlay.showModal();
      });
    }

    cycle.addEventListener('click', () => {
      select(views[(selected + 1) % views.length].dataset.goldenView);
    });

    for (const button of buttons) {
      button.addEventListener('click', () =>
        select(button.dataset.goldenSelect),
      );
    }
  }
}

export const GOLDENS_CSS = `
/* a contact sheet wants the page, not the 82ch measure the documents use */
main.prose { max-width: none; }
main.prose .lede { max-width: 82ch; }
.golden-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 18px; margin-top: 20px; }
.golden { margin: 0; }
.golden [hidden] { display: none; }
.golden img {
  width: 100%; height: auto; display: block; border: 1px solid var(--border);
  border-radius: 4px; background: #fff;
}
.golden figcaption { font-size: 12px; margin-top: 5px; display: flex; flex-direction: column; gap: 1px; }
.golden figcaption code { font-size: 11.5px; }
.golden figcaption span { color: var(--ink-2); }
.golden figcaption time { color: var(--muted); font-size: 11px; }
.golden-controls { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 9px; }
.golden-controls button { font: inherit; font-size: 12px; padding: 5px 9px; border: 1px solid var(--border); border-radius: 4px; background: var(--surface); color: var(--ink); cursor: pointer; }
.golden-controls button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent); font-weight: 700; }
.golden-controls button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.golden-controls button:disabled { opacity: .45; cursor: default; }
.golden-summary { display: flex; align-items: center; gap: 8px; }
.golden-download { font-size: 12px; padding: 4px 8px; border: 1px solid var(--border); border-radius: 4px; text-decoration: none; color: var(--ink); background: var(--surface); }
.golden-metric { margin: 7px 0; font-size: 12px; color: var(--muted); }
.golden-metric.changed { display: inline-block; padding: 4px 8px; border: 1px solid #c100a2; border-radius: 4px; color: #a00087; background: #fff0fc; font-weight: 750; }
@media (prefers-color-scheme: dark) { .golden-metric.changed { color: #ff8ce9; background: #3b1035; border-color: #f048ce; } }
.golden-overlay-open { overflow: hidden; }
.golden-overlay { box-sizing: border-box; width: calc(100vw - 24px); height: calc(100dvh - 24px); max-width: none; max-height: none; padding: 0; border: 1px solid var(--border); border-radius: 8px; color: var(--ink); background: var(--surface, #fff); }
.golden-overlay[open] { display: flex; flex-direction: column; }
.golden-overlay::backdrop { background: rgb(0 0 0 / .8); }
.golden-overlay > header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 10px 16px; border-bottom: 1px solid var(--border); }
.golden-overlay > header h2 { margin: 0; padding: 0; border: 0; font-size: 16px; overflow-wrap: anywhere; }
.golden-overlay > header button { flex-shrink: 0; font: inherit; padding: 6px 12px; cursor: pointer; }
.golden-overlay [data-golden-overlay-content] { flex: 1; min-height: 0; display: flex; padding: 12px 16px; }
.golden-overlay .golden { display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; }
.golden-overlay [data-golden-view]:not([hidden]) { display: flex; flex: 1; min-height: 0; align-items: center; justify-content: center; }
.golden-overlay .golden img { width: 100%; height: 100%; min-height: 0; object-fit: contain; border: 0; border-radius: 0; background: none; }
.golden-overlay .golden figcaption { display: none; }
.golden-overlay .golden-controls { flex-shrink: 0; margin-top: 12px; }
.golden-overlay .golden-summary { flex-shrink: 0; }
.warn { color: var(--warn); }`;
