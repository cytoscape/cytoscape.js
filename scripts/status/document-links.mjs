// Resolve source-document links to the pages and anchors the site publishes.
import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { Marked } from 'marked';

import { readSections, ROUNDS_DIR } from '../plan-record.mjs';
import { slugify } from './markdown.mjs';

export function documentLinks(root, documents) {
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
    const candidates = [posix.join(posix.dirname(source), path)];

    // PLAN.md includes round text whose relative links were authored under
    // plan/rounds/. Root-relative source paths are also used throughout it.
    if (source === 'PLAN.md') candidates.push(posix.join(rounds, path));
    candidates.push(posix.normalize(path));

    for (const candidate of candidates) {
      const page = pages.get(candidate);
      if (page != null) return fragment ? page.split('#')[0] + fragment : page;
    }

    return null;
  };
}
