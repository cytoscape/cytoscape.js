import { expect } from 'chai';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { documentLinks } from '../../scripts/status/document-links.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const round =
  'plan/rounds/2026-10-18-01-rnd0149-plan-manual-feature-demos-and-golden-coverage-audit.md';
const link = documentLinks(ROOT, [], 'test-commit');

describe('status site: links from assembled round records', function () {
  it('maps round-relative debug sources to the mirrored harness', function () {
    expect(link('../../debug/arrow-gallery.html', round)).to.equal(
      'debug/arrow-gallery.html',
    );
    expect(link('../../debug/networks.js', round)).to.equal(
      'debug/networks.js',
    );
  });

  it('maps the feature CSV to its published download', function () {
    expect(link('../../docs/features.csv', round)).to.equal('features.csv');
  });

  it('links unpublished source files to the pinned repository revision', function () {
    expect(link('../../playwright-tests/visual.spec.js', round)).to.equal(
      'https://github.com/cytoscape/cytoscape.js/blob/test-commit/playwright-tests/visual.spec.js',
    );
  });

  it('does not turn a traversal outside the checkout into a repository link', function () {
    expect(link('../../../../etc/passwd', round)).to.equal(null);
    expect(link('..\\..\\etc\\passwd', round)).to.equal(null);
  });
});
