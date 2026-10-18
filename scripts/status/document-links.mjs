// Resolve source-document links to the pages and anchors the site publishes.
import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { Marked } from 'marked';

import { readSections, ROUNDS_DIR } from '../plan-record.mjs';
import { slugify } from './markdown.mjs';

export function documentLinks(root, documents, sha = null) {
  const pages = new Map(documents.map((doc) => [doc.file, doc.to]));
  const rounds = ROUNDS_DIR.replaceAll('\\', '/');
  const seen = new Map();
  const marked = new Marked({ gfm: true });
  const headings = (text) => {
    const entries = [];
    marked.walkTokens(marked.lexer(text), (token) => {
      if (token.type === 'heading') {
        entries.push(slugify(token.text, seen));
      }
    });
    return entries;
  };

  // Slugs share the complete record's counter, including headings preceding
  // a round and repeated subsection titles within earlier rounds.
  const head = join(root, 'PLAN.md');
  if (existsSync(head)) headings(readFileSync(head, 'utf8'));
  for (const section of readSections(root)) {
    const file = `${rounds}/${section.file}`;
    const [anchor] = headings(readFileSync(join(root, file), 'utf8'));
    pages.set(file, `plan.html#${anchor}`);
  }

  return (href, source = '') => {
    if (
      /^[a-z]+:/i.test(href) ||
      href.startsWith('//') ||
      href.startsWith('#')
    ) {
      return null;
    }

    const hash = href.indexOf('#');
    const path = hash === -1 ? href : href.slice(0, hash);
    const fragment = hash === -1 ? '' : href.slice(hash);

    if (path.includes('\\')) return null;

    const candidates = [posix.join(posix.dirname(source), path)];

    // PLAN.md includes round text whose relative links were authored under
    // plan/rounds/. Root-relative source paths are also used throughout it.
    if (source === 'PLAN.md') candidates.push(posix.join(rounds, path));
    candidates.push(posix.normalize(path));

    for (const candidate of [...new Set(candidates)]) {
      // Relative source links can contain ../ (round files live below
      // plan/rounds/), but a published link must stay inside the checkout.
      // Reject paths that would escape before joining them to the root.
      if (
        candidate === '..' ||
        candidate.startsWith('../') ||
        candidate.startsWith('/')
      ) {
        continue;
      }

      const page = pages.get(candidate);
      if (page != null) return fragment ? page.split('#')[0] + fragment : page;

      if (
        candidate === 'docs/features.csv' &&
        existsSync(join(root, candidate))
      ) {
        return fragment ? `features.csv${fragment}` : 'features.csv';
      }

      // planDebug mirrors these top-level files byte-for-byte at the same
      // path.  Link the source round to that published copy, not to a dead
      // relative path from the assembled plan.html page.
      if (
        candidate.startsWith('debug/') &&
        posix.dirname(candidate) === 'debug' &&
        !/\.(json|mjs)$/.test(candidate) &&
        existsSync(join(root, candidate))
      ) {
        return fragment ? `${candidate}${fragment}` : candidate;
      }

      const documentationSource =
        candidate.startsWith('documentation/') && candidate.endsWith('.md');
      const publishedTableSource =
        candidate.startsWith('benchmark/published/table-view/') &&
        /\.(md|json)$/.test(candidate);

      const repositorySource =
        /^(?:src|test|playwright-tests|playwright-page|scripts|benchmark|typescript|v3)\//.test(
          candidate,
        ) && existsSync(join(root, candidate));

      if (
        (documentationSource || publishedTableSource || repositorySource) &&
        existsSync(join(root, candidate))
      ) {
        // The status preview does not publish the full documentation tree.
        // Keep links from the development record useful by pointing at the
        // corresponding repository source, pinned to the built commit when
        // it is known and otherwise using the v4 development branch.
        const ref = sha ?? 'v4';
        const path = candidate
          .split('/')
          .map((part) => encodeURIComponent(part))
          .join('/');
        const sourceUrl = [
          'https://github.com/cytoscape/cytoscape.js/blob',
          ref,
          path,
        ].join('/');

        return fragment ? sourceUrl + fragment : sourceUrl;
      }
    }

    return null;
  };
}
