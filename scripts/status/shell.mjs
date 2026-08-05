// Round 46.5: the one page shell every generated status page uses.
//
// Fully inline, like `benchmark/report-html.mjs`: no external stylesheet, no
// font fetch, no script tag pointing anywhere.  That keeps every page openable
// from `file://`, and it is the property the site's spec asserts, because a
// page that quietly depends on a CDN is a page that breaks on a deploy.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { THEME_CSS, esc } from '../theme.mjs';

const require = createRequire( import.meta.url );

/**
 * highlight.js's GitHub themes, read from node_modules at build time and
 * inlined.  Reading them rather than transcribing them means a highlight.js
 * upgrade carries through; a missing file degrades to unhighlighted code
 * rather than failing the build.
 */
function hljsCss(){
  const read = name => {
    try {
      return readFileSync( require.resolve( `highlight.js/styles/${name}.css` ), 'utf8' );
    } catch{
      return '';
    }
  };

  return `${read( 'github' )}
@media (prefers-color-scheme: dark) { ${read( 'github-dark' )} }
/* the theme's own background fights --surface; the block already has one */
pre code.hljs { background: transparent; padding: 0; }`;
}

const SITE_CSS = `
body { padding: 0; }
a { color: var(--accent); }
header.bar {
  position: sticky; top: 0; z-index: 10; padding: 10px 32px;
  background: var(--surface); border-bottom: 1px solid var(--border);
  display: flex; flex-wrap: wrap; gap: 4px 20px; align-items: baseline;
}
header.bar .home { font-weight: 600; color: var(--ink); text-decoration: none; }
header.bar nav { display: flex; flex-wrap: wrap; gap: 14px; font-size: 13px; }
header.bar nav a[aria-current] { color: var(--ink); font-weight: 600; }
header.bar .build { margin-left: auto; font-size: 12px; color: var(--muted); }
.layout { display: flex; align-items: flex-start; gap: 32px; padding: 24px 32px 64px; }
.layout > main { min-width: 0; flex: 1; }
main.prose { max-width: 82ch; }
main.prose h1 { font-size: 26px; margin: 0 0 16px; }
main.prose h2 { font-size: 19px; margin: 32px 0 10px; padding-top: 8px; border-top: 1px solid var(--grid); }
main.prose h2 small { font-size: 13px; font-weight: 400; color: var(--muted); margin-left: 8px; }
main.prose h3 { font-size: 15px; margin: 22px 0 6px; color: var(--ink); }
main.prose h4 { font-size: 14px; margin: 18px 0 4px; color: var(--ink-2); }
main.prose p, main.prose li { max-width: 82ch; }
main.prose ul, main.prose ol { padding-left: 22px; }
main.prose li { margin: 2px 0; }
main.prose blockquote {
  margin: 12px 0; padding: 2px 0 2px 14px;
  border-left: 3px solid var(--grid); color: var(--ink-2);
}
main.prose code { font-size: 12.5px; background: var(--surface); border: 1px solid var(--border); border-radius: 3px; padding: 0 4px; }
main.prose pre { background: var(--surface); border: 1px solid var(--border); border-radius: 5px; padding: 10px 12px; overflow-x: auto; }
main.prose pre code { border: 0; padding: 0; background: none; font-size: 12.5px; }
main.prose img { max-width: 100%; height: auto; }
/* a wide table must scroll inside itself, never scroll the page */
.table-wrap { overflow-x: auto; margin: 12px 0; }
main.prose table { border-collapse: collapse; font-size: 13px; }
main.prose th, main.prose td { text-align: left; padding: 5px 14px 5px 0; border-bottom: 1px solid var(--grid); vertical-align: top; }
main.prose hr { border: 0; border-top: 1px solid var(--grid); margin: 28px 0; }
.anchor { float: left; margin-left: -0.8em; padding-right: 0.3em; color: var(--muted); text-decoration: none; opacity: 0; }
h1:hover .anchor, h2:hover .anchor, h3:hover .anchor, h4:hover .anchor { opacity: 1; }
code.path-missing { border-color: #d03b3b; text-decoration: underline dotted #d03b3b; }
/* PLAN.md renders to ~840 KB in one page; this is what makes that affordable */
.doc-section { content-visibility: auto; contain-intrinsic-size: auto 900px; }
.toc {
  position: sticky; top: 56px; width: 260px; flex: 0 0 260px;
  max-height: calc(100vh - 80px); overflow-y: auto; font-size: 12.5px;
}
.toc input {
  width: 100%; box-sizing: border-box; margin-bottom: 8px; padding: 5px 8px;
  font: inherit; color: var(--ink); background: var(--surface);
  border: 1px solid var(--border); border-radius: 4px;
}
.toc ul { list-style: none; margin: 0; padding: 0; }
.toc li { margin: 1px 0; }
.toc li.d3 { padding-left: 12px; font-size: 12px; }
.toc a { color: var(--ink-2); text-decoration: none; display: block; padding: 1px 4px; border-radius: 3px; }
.toc a:hover { background: var(--surface); color: var(--ink); }
.toc a[aria-current] { background: var(--surface); color: var(--ink); font-weight: 600; }
.toc li[hidden] { display: none; }
footer.site { padding: 20px 32px 40px; font-size: 12px; color: var(--muted); border-top: 1px solid var(--border); }
@media (max-width: 900px) { .toc { display: none; } .layout { padding: 20px; } }`;

// Scroll-spy over the headings and a TOC filter.  IntersectionObserver, never
// a scroll handler — PLAN.md has 104 headings and a per-scroll loop over them
// is the kind of forced work round 43's review pass found in this repo's own
// event log.
const SITE_JS = `
(function(){
  var toc = document.querySelector('.toc');
  if(!toc) return;
  var links = Array.prototype.slice.call(toc.querySelectorAll('a'));
  var byId = {};
  links.forEach(function(a){ byId[a.getAttribute('href').slice(1)] = a; });
  var current = null;
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(!e.isIntersecting) return;
      var a = byId[e.target.id];
      if(!a || a === current) return;
      if(current) current.removeAttribute('aria-current');
      a.setAttribute('aria-current', 'true');
      current = a;
    });
  }, { rootMargin: '-56px 0px -80% 0px' });
  Object.keys(byId).forEach(function(id){
    var el = document.getElementById(id);
    if(el) io.observe(el);
  });
  var filter = document.getElementById('toc-filter');
  if(filter){
    filter.addEventListener('input', function(){
      var q = filter.value.toLowerCase();
      links.forEach(function(a){
        a.parentNode.hidden = q !== '' && a.textContent.toLowerCase().indexOf(q) < 0;
      });
    });
  }
})();`;

/** The destinations in the top bar, in the order they are worth visiting. */
export const NAV = [
  { id: 'index', href: '/index.html', label: 'Status' },
  { id: 'summary', href: '/summary.html', label: 'Summary' },
  { id: 'debug', href: '/debug/index.html', label: 'Harness' },
  { id: 'benchmark', href: '/benchmark/index.html', label: 'Benchmarks' },
  { id: 'api', href: '/api.html', label: 'API' },
  { id: 'plan', href: '/plan.html', label: 'Record' },
  { id: 'design', href: '/design.html', label: 'Design' },
  { id: 'goldens', href: '/goldens.html', label: 'Goldens' }
];

/**
 * Wrap body markup in the site shell.
 *
 * @param title — the `<title>`, and the browser-tab identity
 * @param body — markup for `<main>`
 * @param toc — TOC markup from `tocHtml`, or ''
 * @param active — the NAV id to mark current
 * @param state — the repo state, for the build stamp in the bar
 * @param prose — apply the document typography (false for index-like pages)
 */
export function page( { title, body, toc = '', active = null, state = {}, prose = true } ){
  const nav = NAV
    .map( n => `<a href="${esc( n.href )}"${n.id === active ? ' aria-current="page"' : ''}>${esc( n.label )}</a>` )
    .join( '' );

  const stamp = [
    state.branch != null ? esc( state.branch ) : null,
    state.commit?.short != null ? esc( state.commit.short ) : null,
    state.builtAt != null ? `built ${esc( state.builtAt.replace( 'T', ' ' ).slice( 0, 16 ) )}Z` : null
  ].filter( v => v != null ).join( ' · ' );

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<!-- inline, like everything else here: a favicon file would be the site's one
     external request, and its absence is a 404 in every visitor's console -->
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='7' r='5' fill='%232a78d6'/%3E%3Ccircle cx='6' cy='25' r='5' fill='%232a78d6'/%3E%3Ccircle cx='26' cy='25' r='5' fill='%232a78d6'/%3E%3Cpath d='M16 7L6 25M16 7l10 18M6 25h20' stroke='%232a78d6' stroke-width='2.5' fill='none'/%3E%3C/svg%3E">
<title>${esc( title )}</title>
<style>${THEME_CSS}
${SITE_CSS}
${hljsCss()}</style>
</head>
<body>
<header class="bar">
  <a class="home" href="/index.html">cytoscape.js v4</a>
  <nav>${nav}</nav>
  <span class="build">${stamp}</span>
</header>
<div class="layout">
${toc}
<main${prose ? ' class="prose"' : ''}>
${body}
</main>
</div>
<footer class="site">
  A preview of the <code>v4</code> branch, generated by <code>scripts/status-build.mjs</code>.
  Not a release, and not the documentation site — that is round 46.
</footer>
<script>${SITE_JS}</script>
</body>
</html>`;
}
