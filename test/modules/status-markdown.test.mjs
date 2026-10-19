import { expect } from 'chai';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { documentLinks } from '../../scripts/status/document-links.mjs';
import { enumerateRefs } from '../../scripts/status/refs.mjs';

import {
  renderMarkdown,
  buildToc,
  slugify,
  resolveRepoPath,
  tocHtml,
} from '../../scripts/status/markdown.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ctx = () => ({
  root: ROOT,
  sha: 'abc1234def',
  pageFor: (h) => (h === 'MIGRATING.md' ? 'migrating.html' : null),
});

/*
Round 46.5: the status site's markdown renderer, against a fixture written in
the shape the repo's documents are actually written in.

Round 36.1 is the precedent and the warning: two fixtures written as one-liners
the scanner never matched let two specs pass with the behaviour under test
deliberately broken.  So the fixture below carries the real hazards —

  - a fenced block whose lines begin with `#`, which `PLAN.md` contains and
    which a regex TOC would list as a heading;
  - two identical headings, which `PLAN.md` has many of;
  - a code span holding `<script>`, which `PLAN.md` contains **verbatim** at
    line 11222 and which broke every page until the escaping was fixed;
  - a `.mjs` code span whose file is really `.mts`, the repo's convention;
  - a glob, which `existsSync` can never resolve;
  - a relative `.md` link, of which the corpus has exactly two.

Controls run while writing.  Each failed the spec named:
  1. the TOC built with `/^#{1,3} /gm` instead of the token stream — fails
     'skips a heading inside a fenced block'.
  2. the heading renderer given its own fresh slug counter, unsynchronised with
     the TOC's — fails 'every TOC slug has a matching id'.
  3. `esc` dropped from `codespan` — fails 'escapes a code span, because
     marked does not'.
  4. `.mjs -> .mts` resolution removed — fails 'resolves a documented .mjs
     specifier to the .mts file on disk'.
  5. the fence renderer switched to `highlightAuto` — fails 'leaves an
     unlabelled fence unhighlighted'.
*/

const FIXTURE = `# The document

Intro prose with \`src/style.mjs\` and \`src/nope.mts\` and \`test/modules/*.mjs\`
and \`just prose here\`.

## Landed (round 9)

A paragraph that mentions a \`<script>\` tag, which is the shape that broke
every page on this site until \`codespan\` started escaping.

\`\`\`js
const answer = 42;
\`\`\`

## Landed (round 9)

The second one, to force a deduped slug.

\`\`\`
# this is a comment in a fence, not a heading
## and neither is this
\`\`\`

### A third-level heading

See [the migration guide](MIGRATING.md) and [the site](https://js.cytoscape.org).

| property | v3 | v4 |
|---|---|---|
| \`shape\` | yes | yes |
`;

describe('status markdown: the table of contents', () => {
  it('skips a heading inside a fenced block', () => {
    const { toc } = renderMarkdown(FIXTURE, ctx());
    const texts = toc.map((t) => t.text);

    expect(texts).to.not.include('this is a comment in a fence, not a heading');
    expect(texts).to.not.include('and neither is this');
  });

  it('lists h2 and h3 but not the document title', () => {
    const { toc } = renderMarkdown(FIXTURE, ctx());

    expect(toc.map((t) => t.depth)).to.eql([2, 2, 3]);
    expect(toc.map((t) => t.text)).to.eql([
      'Landed (round 9)',
      'Landed (round 9)',
      'A third-level heading',
    ]);
  });

  it('dedupes repeated headings', () => {
    const { toc } = renderMarkdown(FIXTURE, ctx());

    expect(toc.map((t) => t.slug)).to.eql([
      'landed-round-9',
      'landed-round-9-1',
      'a-third-level-heading',
    ]);
  });

  it('every TOC slug has a matching id in the html', () => {
    // the classic drift: two independent counters number the repeats
    // differently and half the TOC points at anchors that do not exist
    const { toc, html } = renderMarkdown(FIXTURE, ctx());

    for (const entry of toc) {
      expect(
        html,
        `no id="${entry.slug}" for TOC entry "${entry.text}"`,
      ).to.match(new RegExp(`id="${entry.slug}"`));
    }
  });

  it('honours maxDepth', () => {
    const { toc } = renderMarkdown(FIXTURE, { ...ctx(), maxDepth: 2 });

    expect(toc.map((t) => t.depth)).to.eql([2, 2]);
  });

  it('renders an empty TOC as nothing rather than an empty nav', () => {
    expect(tocHtml([])).to.equal('');
    expect(tocHtml([{ depth: 2, text: 'A', slug: 'a' }])).to.match(
      /<nav class="toc"/,
    );
  });

  it('slugifies the way GitHub does, and never to the empty string', () => {
    const seen = new Map();

    expect(slugify('Landed (round 9) — the tail', seen)).to.equal(
      'landed-round-9--the-tail',
    );
    expect(slugify('???', seen)).to.equal('section');
  });
});

describe('status markdown: escaping', () => {
  it('escapes a code span, because marked does not', () => {
    // `token.text` on a codespan is the RAW span content.  Overriding the
    // renderer takes marked's escaping with it, and PLAN.md really does
    // contain a code span holding `<script>` — it opened a real script element
    // and every page after that point stopped working.
    const { html } = renderMarkdown(FIXTURE, ctx());

    expect(html).to.match(/&lt;script&gt;/);
    expect(html, 'a code span opened a real script element').to.not.match(
      /<code><script>/,
    );
  });

  it('escapes an unlabelled fence rather than trusting its content', () => {
    const { html } = renderMarkdown('```\n<b>not bold</b>\n```\n', ctx());

    expect(html).to.match(/&lt;b&gt;not bold/);
  });
});

describe('status markdown: code fences', () => {
  it('highlights a labelled fence', () => {
    // asserting the highlighting, not merely that a <pre> exists — round 27's
    // lesson that a spec's name is not evidence of what it tests
    const { html } = renderMarkdown(FIXTURE, ctx());

    expect(html).to.match(/class="hljs language-js"/);
    expect(html, 'the js fence produced no highlight spans').to.match(
      /<span class="hljs-keyword">const<\/span>/,
    );
  });

  it('leaves an unlabelled fence unhighlighted', () => {
    // `highlightAuto` on PLAN.md's one unlabelled fence would colour prose as
    // code, confidently and wrongly
    const { html } = renderMarkdown(FIXTURE, ctx());

    expect(html).to.match(/<code class="hljs"># this is a comment in a fence/);
  });

  it('falls back to escaping for a language it does not know', () => {
    const { html } = renderMarkdown('```brainfuck\n+[-]\n```\n', ctx());

    expect(html).to.match(/<code class="hljs">\+\[-\]/);
  });
});

describe('status markdown: documented paths', () => {
  it('resolves a documented .mjs specifier to the .mts file on disk', () => {
    // the repo's convention: every import spells `.mjs` while the file is
    // `.mts`.  Without this, every source path in every document reads broken.
    expect(resolveRepoPath('src/style.mjs', ROOT)).to.equal('src/style.mts');
    expect(resolveRepoPath('src/style.mts', ROOT)).to.equal('src/style.mts');
    // the record cites specs by their names before the *.test.mjs rename
    expect(resolveRepoPath('test/wire.mjs', ROOT)).to.equal(
      'test/wire.test.mjs',
    );
    expect(resolveRepoPath('test/modules/schemas.mjs', ROOT)).to.equal(
      'test/modules/schemas.test.mjs',
    );
    expect(resolveRepoPath('test/lib/nope.mjs', ROOT)).to.equal(null);
  });

  it('links a path that resolves, at the build commit', () => {
    const { html } = renderMarkdown(FIXTURE, ctx());

    expect(html).to.match(
      /href="https:\/\/github\.com\/cytoscape\/cytoscape\.js\/blob\/abc1234def\/src\/style\.mts"/,
    );
  });

  it('marks a path that does not, and reports it', () => {
    const { html, paths } = renderMarkdown(FIXTURE, ctx());

    expect(html).to.match(/class="path-missing"/);
    expect(paths.find((p) => p.path === 'src/nope.mts').resolved).to.equal(
      null,
    );
    expect(paths.find((p) => p.path === 'src/style.mjs').resolved).to.equal(
      'src/style.mts',
    );
  });

  it('ignores a glob, which can never resolve', () => {
    // an audit whose output is mostly false positives is an audit nobody reads
    const { paths } = renderMarkdown(FIXTURE, ctx());

    expect(paths.map((p) => p.path)).to.not.include('test/modules/*.mjs');
  });

  it('does not link prose that merely sits in backticks', () => {
    const { paths } = renderMarkdown(FIXTURE, ctx());

    expect(paths.map((p) => p.path)).to.not.include('just prose here');
  });

  it('leaves paths unlinked when the commit is not pushed', () => {
    // a blob link built from a sha no remote has would 404
    const { html } = renderMarkdown(FIXTURE, { ...ctx(), sha: null });

    expect(html).to.match(/<code class="path">src\/style\.mjs<\/code>/);
    expect(html).to.not.match(/blob\/null/);
  });
});

describe('status markdown: links and structure', () => {
  it('resolves referenced files without fragments while retaining navigation URLs', () => {
    const refs = enumerateRefs([
      {
        kind: 'write',
        to: 'nested/summary.html',
        text: '<a href="../plan.html#round">relative</a><a href="/plan.html#round">absolute</a>',
      },
    ]);

    expect(refs.map((ref) => ref.resolved)).to.eql(['plan.html', 'plan.html']);
    expect(refs.map((ref) => ref.url)).to.eql([
      '../plan.html#round',
      '/plan.html#round',
    ]);
  });

  it('routes round links to deduplicated record anchors from each source directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'status-links-'));
    const first = '2026-10-12-01-rnd0000-note-first.md';
    const second = '2026-10-12-02-rnd0000-note-second.md';
    const head = '# Record\n\n## Shared title\n\n### Later title\n';
    const one = '## Shared title\n\nRound one.\n';
    const two = '## Later title\n\nRound two.\n';

    try {
      mkdirSync(join(root, 'plan/rounds'), { recursive: true });
      writeFileSync(join(root, 'PLAN.md'), head);
      writeFileSync(join(root, 'plan/rounds', first), one);
      writeFileSync(join(root, 'plan/rounds', second), two);
      const links = documentLinks(root, [
        { file: 'PLAN.md', to: 'plan.html' },
        { file: 'docs/feature-direction.md', to: 'direction.html' },
      ]);
      const { html } = renderMarkdown(head + one + two, { root });

      for (const [href, source, anchor] of [
        [`plan/rounds/${first}`, 'EXECUTIVE_SUMMARY.md', 'shared-title-1'],
        [`../plan/rounds/${first}`, 'src/README.md', 'shared-title-1'],
        [second, 'PLAN.md', 'later-title-1'],
        [first, `plan/rounds/${second}`, 'shared-title-1'],
      ]) {
        const target = links(href, source);
        expect(target).to.equal(`plan.html#${anchor}`);
        expect(html).to.include(`id="${target.split('#')[1]}"`);
        const rendered = renderMarkdown(`[round](${href})`, {
          root,
          pageFor: (href) => links(href, source),
        });
        expect(rendered.html).to.include(`href="${target}"`);
      }

      expect(links('../../docs/feature-direction.md', 'PLAN.md')).to.equal(
        'direction.html',
      );
      expect(links('docs/feature-direction.md#figures')).to.equal(
        'direction.html#figures',
      );
      expect(links('missing.md', 'PLAN.md')).to.equal(null);
      expect(links(`https://example.com/plan/rounds/${first}`)).to.equal(null);
      expect(links('#local')).to.equal(null);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('links documentation sources to the built repository revision', () => {
    const documents = [{ file: 'PLAN.md', to: 'plan.html' }];
    const links = documentLinks(ROOT, documents, 'abc123');
    const href = '../../documentation/api-coverage.md#prose-coverage-matrix';
    const expected = [
      'https://github.com/cytoscape/cytoscape.js/blob/abc123',
      'documentation/api-coverage.md#prose-coverage-matrix',
    ].join('/');

    expect(links(href, 'PLAN.md')).to.equal(expected);

    const { html } = renderMarkdown(`[coverage](${href})`, {
      root: ROOT,
      pageFor: (path) => links(path, 'PLAN.md'),
    });

    expect(html).to.include(`href="${expected}" rel="noreferrer"`);

    const fallback = documentLinks(ROOT, documents);
    expect(fallback(href, 'PLAN.md')).to.equal(
      expected.replace('/blob/abc123/', '/blob/v4/'),
    );
    const missing = '../../documentation/not-a-page.md';

    expect(fallback(missing, 'PLAN.md')).to.equal(null);

    const { html: missingHtml } = renderMarkdown(`[missing](${missing})`, {
      root: ROOT,
      pageFor: (path) => fallback(path, 'PLAN.md'),
    });

    expect(missingHtml).to.include(`href="${missing}"`);

    const publishedDocuments = [
      ...documents,
      { file: 'documentation/api-coverage.md', to: 'coverage.html' },
    ];
    const published = documentLinks(ROOT, publishedDocuments, 'abc123');

    expect(published(href, 'PLAN.md')).to.equal(
      'coverage.html#prose-coverage-matrix',
    );

    const tableReadme =
      '../../benchmark/published/table-view/README.md#measurements';
    const tableJson =
      '../../benchmark/published/table-view/round84-10k-run1.json';

    expect(links(tableReadme, 'PLAN.md')).to.equal(
      'https://github.com/cytoscape/cytoscape.js/blob/abc123/' +
        'benchmark/published/table-view/README.md#measurements',
    );
    expect(links(tableJson, 'PLAN.md')).to.equal(
      'https://github.com/cytoscape/cytoscape.js/blob/abc123/' +
        'benchmark/published/table-view/round84-10k-run1.json',
    );
    expect(
      links(
        '../../benchmark/published/table-view/not-published.json',
        'PLAN.md',
      ),
    ).to.equal(null);
  });

  it("rewrites a relative .md link to this site's page", () => {
    const { html } = renderMarkdown(FIXTURE, ctx());

    expect(html).to.match(/href="migrating\.html"/);
    expect(html).to.not.match(/href="MIGRATING\.md"/);
  });

  it('leaves an external link alone', () => {
    const { html } = renderMarkdown(FIXTURE, ctx());

    expect(html).to.match(
      /href="https:\/\/js\.cytoscape\.org" rel="noreferrer"/,
    );
  });

  it('opens exactly one section per h2, so content-visibility applies per section', () => {
    const { html } = renderMarkdown(FIXTURE, ctx());
    const sections = (html.match(/<section class="doc-section">/g) ?? [])
      .length;
    const h2s = (html.match(/<h2 /g) ?? []).length;

    // one leading section for the h1 preamble, then one per h2
    expect(sections).to.equal(h2s + 1);
  });

  it('wraps a table so it scrolls inside itself, not the page', () => {
    const { html } = renderMarkdown(FIXTURE, ctx());

    expect(html).to.match(/<div class="table-wrap"><table>/);
  });

  it('can render without sections, for a doc comment', () => {
    // a member's prose is a paragraph, not a document; wrapping it in a
    // section makes it a block and puts content-visibility on two lines
    const { html } = renderMarkdown('Just a sentence.', {
      ...ctx(),
      sectioned: false,
    });

    expect(html).to.not.match(/doc-section/);
    expect(html).to.match(/<p>Just a sentence\.<\/p>/);
  });

  it('reports the document title', () => {
    expect(renderMarkdown(FIXTURE, ctx()).title).to.equal('The document');
    expect(renderMarkdown('no heading here', ctx()).title).to.equal(null);
  });
});

describe('status markdown: the real documents', () => {
  it('buildToc walks the token stream, not the text', () => {
    // a direct check on the unit the TOC is built from, independent of the
    // renderer: pass tokens with a code token among them
    const tokens = [
      { type: 'heading', depth: 2, text: 'Real' },
      { type: 'code', text: '## Not a heading' },
      { type: 'heading', depth: 4, text: 'Too deep' },
    ];

    expect(buildToc(tokens, new Map()).map((t) => t.text)).to.eql(['Real']);
  });
});
