// Round 46.5: the visual goldens as a contact sheet.
//
// The 43 PNGs in `playwright-tests/goldens/` are what the WebGPU renderer
// currently produces, and until now the only way to look at them was to open
// 43 files.  Each golden's name is passed explicitly at its
// `checkGolden( '<name>', … )` call site in `playwright-tests/visual.spec.js`,
// so the page can caption each image with the `test()` it came from.
//
// A spec asserts the two counts match.  Without it a rename orphans a PNG
// silently, and this gallery is the only thing that would ever have shown it.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

import { esc, fmtBytes } from '../theme.mjs';
import { copy } from './plan.mjs';

/**
 * Map each `checkGolden( 'name', … )` to the `test( 'title' )` enclosing it.
 *
 * A single forward scan: every `test(` line becomes the current title, every
 * `checkGolden(` line claims it.  Nesting is one level deep in that file, and
 * the spec below pins the count rather than trusting this.
 */
export function goldenTitles( specSource ){
  const titles = new Map();
  let current = null;

  for( const line of specSource.split( '\n' ) ){
    const test = line.match( /^\s*test\(\s*'((?:[^'\\]|\\.)*)'/ );

    if( test != null ){ current = test[ 1 ].replace( /\\'/g, "'" ); }

    const golden = line.match( /checkGolden\(\s*'([^']+)'/ );

    if( golden != null ){ titles.set( golden[ 1 ], current ); }
  }

  return titles;
}

/**
 * @returns `{ ops, html, count, orphans }` — `orphans` are PNGs with no call
 *   site and call sites with no PNG, both of which mean a rename went half-done
 */
export function planGoldens( { root } ){
  const dir = join( root, 'playwright-tests', 'goldens' );
  const specPath = join( root, 'playwright-tests', 'visual.spec.js' );

  if( !existsSync( dir ) ){
    return { ops: [], html: '', count: 0, orphans: [], available: false,
      reason: 'playwright-tests/goldens/ is missing' };
  }

  const pngs = readdirSync( dir ).filter( f => f.endsWith( '.png' ) ).sort();
  const titles = existsSync( specPath ) ? goldenTitles( readFileSync( specPath, 'utf8' ) ) : new Map();

  const ops = pngs.map( f => copy( join( dir, f ), `goldens/${f}` ) );

  const orphans = [
    ...pngs.filter( f => !titles.has( basename( f, '.png' ) ) ).map( f => `png with no call site: ${f}` ),
    ...[ ...titles.keys() ].filter( n => !pngs.includes( `${n}.png` ) ).map( n => `call site with no png: ${n}` )
  ];

  const cards = pngs.map( f => {
    const name = basename( f, '.png' );
    const title = titles.get( name );
    const bytes = ( () => {
      try {
        return readFileSync( join( dir, f ) ).length;
      } catch{
        return null;
      }
    } )();

    return `<figure class="golden">
      <a href="goldens/${esc( f )}"><img src="goldens/${esc( f )}" alt="${esc( title ?? name )}" loading="lazy"></a>
      <figcaption><code>${esc( name )}</code>
        <span>${title != null ? esc( title ) : '<em>no call site in visual.spec.js</em>'}</span>
        <span class="muted">${esc( fmtBytes( bytes ) ?? '' )}</span>
      </figcaption>
    </figure>`;
  } ).join( '' );

  const html = `<h1>Visual goldens</h1>
  <p class="lede">${pngs.length} golden images from the <code>visual</code> Playwright project — what the
  WebGPU renderer produces for each pinned scene. These are v4's own previous output, so they answer
  “did this change?” and not “is this right”; the live v3-vs-v4 parity diffs in the same project
  answer the second question.</p>
  ${orphans.length > 0 ? `<p class="warn">${orphans.map( esc ).join( '<br>' )}</p>` : ''}
  <div class="golden-grid">${cards}</div>`;

  return { ops, html, count: pngs.length, orphans, available: true, reason: null };
}

export const GOLDENS_CSS = `
/* a contact sheet wants the page, not the 82ch measure the documents use */
main.prose { max-width: none; }
main.prose .lede { max-width: 82ch; }
.golden-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 18px; margin-top: 20px; }
.golden { margin: 0; }
.golden img {
  width: 100%; height: auto; display: block; border: 1px solid var(--border);
  border-radius: 4px; background: #fff;
}
.golden figcaption { font-size: 12px; margin-top: 5px; display: flex; flex-direction: column; gap: 1px; }
.golden figcaption code { font-size: 11.5px; }
.golden figcaption span { color: var(--ink-2); }
.warn { color: var(--warn); }`;
