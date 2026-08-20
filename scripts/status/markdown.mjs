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
 * Spellings the documents **quote** rather than point at: a path that was
 * correct once, named in a record of the rename that retired it or in a
 * lesson about a sweep that missed it — or a path in *another tree*
 * entirely (an external repo's source a plan cites, a scaffold template's
 * own file) that happens to spell like one of ours.  Every one is correct
 * prose and none of them can resolve, so without this list the build warns
 * eight times on every run and the warning becomes something to ignore —
 * which is worse than not having it, since the same sweep that produced
 * these eight also surfaced four *genuinely* stale pointers.
 *
 * A heuristic ("skip anything that looks historical") cannot draw that line,
 * so this is an allowlist on round 37.1's terms — maintained, and checked in
 * both directions by `test/modules/status-site.mjs`:
 *
 *   - an entry no document mentions any more **fails**, so a spelling that
 *     is edited out takes its exemption with it;
 *   - an entry that starts *resolving* **fails**, because a path that exists
 *     again is a live pointer and the reader should get the link.
 *
 * @type {Record<string, string>}
 */
export const HISTORICAL_PATHS = {
  'src/gpu/README.md':
    "round 42's record of the promotion out of src/gpu/ — the file is src/README.md now",
  'playwright-tests/webgpu.spec.js':
    'round 42.1 renamed it to renderer.spec.js; the record names both sides of the rename',
  'typescript/tests/gpu.test-d.ts':
    'quoted by AGENTS.md and round 43.9 as a spelling the round-42 sweep missed — the point is that it was wrong',
  'test/modules/gpu-import-graph.mjs':
    'the same pair of quotations; it is import-graph.mjs now',
  'test/gpu-':
    'AGENTS.md quotes it as the *substitution* the round-42 sweep grepped for, which is why it missed the two spellings above',
  'typescript/tests/gpu': 'the other half of that quoted substitution',
  'src/cx_to_cy_canvas.js':
    "another repo's file — the CX converter round 81 reverse-engineered the annotation dialect from; cited as a source, not pointed at",
  'test/layout.mjs':
    "the cyext scaffold template's own spec file (round 71) — a file of the *generated* extension package, not this repo's test/",
};

/**
 * Files a **planned** round names before they exist.  A plan that spells
 * out its files is more checkable, not less, so these are exempt from the
 * unresolved-path warning — but on the same maintained-allowlist terms as
 * `HISTORICAL_PATHS`, checked in both directions by
 * `test/modules/status-site.mjs`:
 *
 *   - an entry no document mentions any more **fails** (the plan was
 *     edited; the exemption goes with it);
 *   - an entry that starts **resolving fails** — the round landed, the
 *     path is a live pointer now, and leaving the entry would hand its
 *     exemption to the next unrelated typo of the same spelling.
 *
 * So the lifecycle is enforced, not hoped for: plan names the file here,
 * round lands the file, the gate goes red until the entry is removed.
 *
 * @type {Record<string, string>}
 */
export const PLANNED_PATHS = {
  // round 74 — the worker-pool CPU executor
  'src/algorithms/algo-workers.mts':
    'planned by round 74 (the worker-pool CPU executor)',
  'src/algorithms/algo-worker-body.mts':
    'planned by round 74 (the worker-pool CPU executor)',
  'test/algorithms-workers.mjs':
    'planned by round 74 (the worker-pool CPU executor)',
  'test/soak/workers.mjs': 'planned by round 74 (the worker-pool CPU executor)',
  'benchmark/algorithms-workers.mjs':
    'planned by round 74 (the worker-pool CPU executor)',
  // rounds 77/78 — SVG export and headless figures
  'src/svg-export.mts': 'planned by round 77 (SVG vector export)',
  'playwright-tests/svg-parity.spec.js':
    'planned by round 77 (SVG vector export)',
  'test/svg-export-headless.mjs':
    'planned by round 78 (headless Node image generation)',
  // round 79 — official JSON schemas
  'test/modules/schemas.mjs': 'planned by round 79 (official JSON schemas)',
  // round 81 — the annotations layer
  'src/store/annotation-table.mts':
    'planned by round 81 (the annotations layer)',
  'src/render/annotation-pipeline.mts':
    'planned by round 81 (the annotations layer)',
  'src/annotation-cx.mts': 'planned by round 81 (the annotations layer)',
  // round 82 — cluster hulls + collapse/aggregation proxies
  'src/store/hull-index.mts':
    'planned by round 82 (cluster hulls + collapse proxies)',
  'src/render/hull-pipeline.mts':
    'planned by round 82 (cluster hulls + collapse proxies)',
  'src/store/collapse-index.mts':
    'planned by round 82 (cluster hulls + collapse proxies)',
  'benchmark/hulls.mjs':
    'planned by round 82 (cluster hulls + collapse proxies)',
  'benchmark/collapse.mjs':
    'planned by round 82 (cluster hulls + collapse proxies)',
  // round 83 — GPU edge bundling
  'src/algorithms/edge-bundling.mts': 'planned by round 83 (GPU edge bundling)',
  'src/algorithms/algo-gpu-bundling.mts':
    'planned by round 83 (GPU edge bundling)',
  // round 85 — the layouts round
  'src/layout/radial.mts': 'planned by round 85 (the layouts round)',
  'test/layout-radial.mjs': 'planned by round 85 (the layouts round)',
  // round 87 — layout mechanics
  'src/layout/pack.mts': 'planned by round 87 (layout mechanics)',
  // round 89 — pointer cursors
  'src/interact/cursor.mts': 'planned by round 89 (pointer cursors)',
  // round 98 — the runtime rounds
  'test/runtimes/smoke.mjs':
    'planned by round 98 (the cross-runtime smoke tier)',
  // round 101 — quiet verification
  'test/quiet-reporter.mjs': 'planned by round 101 (quiet verification)',
  'scripts/quiet-run.mjs': 'planned by round 101 (quiet verification)',
  'playwright-tests/quiet-reporter.js':
    'planned by round 101 (quiet verification)',
  'test/modules/quiet-scripts.mjs':
    'planned by round 101 (quiet verification)',
};

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
 *   found in a code span with whether it resolved and, when it did not, the
 *   `HISTORICAL_PATHS` reason it is quoted rather than broken or the
 *   `PLANNED_PATHS` round that names it ahead of landing; the build warns
 *   on the ones with none of the three
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
      const historical = HISTORICAL_PATHS[raw];
      const planned = PLANNED_PATHS[raw];

      paths.push({
        path: raw,
        resolved: hit,
        historical: historical ?? null,
        planned: planned ?? null,
      });

      // a quoted or planned spelling is still marked in the page — the
      // reader should be able to see that it names nothing yet — but it is
      // not a *warning*, and the title says which of the three it is
      if (historical != null && hit == null) {
        return `<code class="path-historical" title="${esc(historical)}">${safe}</code>`;
      }

      if (planned != null && hit == null) {
        return `<code class="path-planned" title="${esc(planned)}">${safe}</code>`;
      }

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
