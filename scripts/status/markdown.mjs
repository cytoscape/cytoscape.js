// Round 46.5: the repo's markdown, rendered for the status site.
//
// The precedent is `v3/documentation/markdown-renderer.mjs` — thirty lines of
// marked + highlight.js at these exact versions.  This is not an import of it:
// round 42's rule is that nothing crosses into `v3/`, and v4's needs differ.
// It is the same two libraries used the same way.
//
// Four things this does that a regex over the text could not, and the reason
// the TOC is built from marked's token stream rather than from `/^#{2,3} /gm`:
//
//   1. `PLAN.md` contains a fenced block whose lines begin with `#`.  A regex
//      TOC lists it as a heading — and is *nearly* right otherwise, which is
//      the worst failure mode there is.
//   2. Slugs must dedupe, because that file has repeated headings, and the
//      TOC's slug and the heading's `id` must be produced by the same call
//      sequence or they drift apart.  One shared `seen` map is the fix.
//   3. A rooted repo path in a code span is checked against the tree and
//      linked — AGENTS.md's own prescription after a docs sweep missed four
//      paths by grepping for spellings it had thought of.
//   4. `PLAN.md` is 724 KB.  Grouping the token stream at `h2` boundaries lets
//      each section carry `content-visibility: auto`, so a browser skips
//      layout and paint for the ~80 sections that are offscreen.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { Marked, Renderer } from 'marked';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';

import { esc } from '../theme.mjs';

for (const [name, lang] of Object.entries({
  javascript,
  typescript,
  bash,
  json,
  xml,
  css,
  diff,
})) {
  hljs.registerLanguage(name, lang);
}

hljs.registerAliases(['js', 'mjs', 'mts'], { languageName: 'javascript' });
hljs.registerAliases(['ts'], { languageName: 'typescript' });
hljs.registerAliases(['sh', 'shell', 'console'], { languageName: 'bash' });
hljs.registerAliases(['html'], { languageName: 'xml' });

/**
 * A rooted path into this repo, as the documents spell them.  Anchored at both
 * ends so a code span has to be *only* a path — prose in backticks is not a
 * link candidate.
 */
// `dist/` and `build/` are deliberately absent: they are build outputs, not
// present in a source checkout, so testing them reports every correct
// reference to a shipped artifact as broken.
const ROOTED =
  /^(?:src|test|benchmark|scripts|debug|playwright-tests|playwright-page|typescript|v3)\/[\w./@-]+$|^[A-Z][A-Z_]*\.md$/;

/**
 * A path spelling that names a *set* of files, not one file.
 *
 * Excluded from the resolve check, because `existsSync` on
 * `test/modules/*.mjs` or `v3/documentation/md/**` is always false and would
 * report every glob in the documents as a broken path — an audit whose output
 * is mostly false positives is an audit nobody reads.
 */
const GLOB = /[*?]|\/$/;

/**
 * GitHub-shaped slug, deduped against `seen`.
 *
 * The `seen` map must be shared between the TOC and the heading renderer:
 * `PLAN.md` repeats headings, and two independent counters would number them
 * differently, leaving TOC entries pointing at anchors that do not exist.
 */
export function slugify(text, seen) {
  const base =
    String(text)
      .toLowerCase()
      .replace(/<[^>]*>/g, '')
      .replace(/[^\w\s-]/g, '')
      .trim()
      // one hyphen per space, not per run: GitHub does not collapse, and an
      // em dash between words leaves two spaces and so two hyphens.  Matching
      // it exactly is what makes a link written against GitHub's rendering of
      // PLAN.md resolve here too.
      .replace(/\s/g, '-') || 'section';

  const n = seen.get(base) ?? 0;

  seen.set(base, n + 1);

  return n === 0 ? base : `${base}-${n}`;
}

/**
 * Headings from the token stream.
 *
 * @param tokens — marked's top-level token list
 * @param seen — the shared slug counter; pass the same map to the renderer
 * @param maxDepth — 3 by default; `src/README.md` needs h3 to be navigable at
 *   all, its longest h2 section being about a third of the file
 */
export function buildToc(tokens, seen, { maxDepth = 3 } = {}) {
  return tokens
    .filter((t) => t.type === 'heading' && t.depth > 1 && t.depth <= maxDepth)
    .map((t) => ({
      depth: t.depth,
      text: t.text,
      slug: slugify(t.text, seen),
    }));
}

/** Resolve a documented path against the tree, honouring `.mjs` -> `.mts`. */
export function resolveRepoPath(path, root) {
  const candidates = [path, path.replace(/\.mjs$/, '.mts')];

  for (const c of candidates) {
    if (existsSync(join(root, c))) {
      return c;
    }
  }

  return null;
}

/**
 * Render one document.
 *
 * @param md — the markdown source
 * @param root — the repo root, for resolving documented paths
 * @param sha — the commit the site was built from, for blob links
 * @param pageFor — maps a relative `*.md` link to this site's page, or null
 * @param maxDepth — deepest heading level in the TOC
 * @returns `{ html, toc, title, paths }` — `paths` is every rooted repo path
 *   found in a code span with whether it resolved, which `audits` reports on
 */
export function renderMarkdown(
  md,
  {
    root,
    sha = null,
    pageFor = () => null,
    maxDepth = 3,
    sectioned = true,
  } = {},
) {
  const marked = new Marked({ gfm: true });
  const tokens = marked.lexer(md);
  const seen = new Map();
  const toc = buildToc(tokens, seen, { maxDepth });
  const paths = [];

  // the heading renderer walks the same headings in the same order, so it must
  // start from a *fresh* counter that replays the TOC's sequence exactly
  const headingSeen = new Map();

  const renderer = {
    heading(token) {
      const text = this.parser.parseInline(token.tokens);
      const slug = slugify(token.text, headingSeen);

      return (
        `<h${token.depth} id="${esc(slug)}">` +
        `<a class="anchor" href="#${esc(slug)}" aria-hidden="true" tabindex="-1">#</a>` +
        `${text}</h${token.depth}>\n`
      );
    },

    code(token) {
      const lang = (token.lang ?? '').trim().split(/\s+/)[0];

      // an unlabelled fence is escaped, never guessed at.  PLAN.md's one fence
      // has no language, and `highlightAuto` on it would colour prose as code
      if (lang !== '' && hljs.getLanguage(lang)) {
        const { value } = hljs.highlight(token.text, {
          language: lang,
          ignoreIllegals: true,
        });

        return `<pre><code class="hljs language-${esc(lang)}">${value}</code></pre>\n`;
      }

      return `<pre><code class="hljs">${esc(token.text)}</code></pre>\n`;
    },

    codespan(token) {
      // `token.text` is the RAW span content — marked does not escape it, and
      // overriding this renderer takes its escaping with it.  PLAN.md contains
      // a code span holding `<script>`, so an unescaped one opened a real
      // script element and every page after it stopped working.
      const raw = token.text;
      const safe = esc(raw);

      if (!ROOTED.test(raw) || GLOB.test(raw)) {
        return `<code>${safe}</code>`;
      }

      const hit = resolveRepoPath(raw, root);

      paths.push({ path: raw, resolved: hit });

      if (hit == null) {
        return `<code class="path-missing" title="does not resolve in this tree">${safe}</code>`;
      }

      return sha != null
        ? `<a class="path" href="https://github.com/cytoscape/cytoscape.js/blob/${esc(sha)}/${esc(hit)}"><code>${safe}</code></a>`
        : `<code class="path">${safe}</code>`;
    },

    table(token) {
      // a wide table must scroll inside its own box; the page body must never
      // scroll horizontally.  MIGRATING.md's property tables are the wide ones
      const html = Renderer.prototype.table.call(this, token);

      return `<div class="table-wrap">${html}</div>`;
    },

    link(token) {
      const page = pageFor(token.href);
      const href = page ?? token.href;
      const text = this.parser.parseInline(token.tokens);
      const external = /^https?:/.test(href);

      return `<a href="${esc(href)}"${external ? ' rel="noreferrer"' : ''}>${text}</a>`;
    },
  };

  marked.use({ renderer });

  // a member's doc comment is a paragraph or two, not a document: wrapping it
  // in `<section class="doc-section">` makes it a block and puts
  // `content-visibility` on a two-line description
  const html = sectioned ? sectionize(tokens, marked) : marked.parser(tokens);
  const title =
    tokens.find((t) => t.type === 'heading' && t.depth === 1)?.text ?? null;

  return { html, toc, title, paths };
}

/**
 * Group the token stream at `h2` boundaries and wrap each run in a section.
 *
 * This exists for `PLAN.md` — 837 KB of rendered HTML in one page, which is
 * the right call (browser find across the whole development record is what
 * that document is *for*, and splitting it would destroy the site's only
 * search).  `content-visibility: auto` on each section is what makes one page
 * affordable: the browser skips layout and paint for everything offscreen.
 */
function sectionize(tokens, marked) {
  const groups = [];
  let current = [];

  for (const token of tokens) {
    if (token.type === 'heading' && token.depth === 2 && current.length > 0) {
      groups.push(current);
      current = [];
    }

    current.push(token);
  }

  if (current.length > 0) {
    groups.push(current);
  }

  return groups
    .map((group) => {
      // marked's parser needs the `links` bag the lexer attached to the full
      // stream, or reference-style links silently render as literal text
      const slice = group;

      slice.links = tokens.links ?? {};

      return `<section class="doc-section">${marked.parser(slice)}</section>`;
    })
    .join('\n');
}

/** The TOC markup: a flat list, indented by depth, filterable client-side. */
export function tocHtml(toc) {
  if (toc.length === 0) {
    return '';
  }

  const items = toc
    .map(
      (t) =>
        `<li class="d${t.depth}"><a href="#${esc(t.slug)}">${esc(t.text)}</a></li>`,
    )
    .join('');

  return `<nav class="toc" aria-label="Contents">
    <input type="search" id="toc-filter" placeholder="Filter ${toc.length} sections" aria-label="Filter contents">
    <ul>${items}</ul>
  </nav>`;
}
