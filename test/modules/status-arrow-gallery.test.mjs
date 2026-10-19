import { expect } from 'chai';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { planDebug } from '../../scripts/status/plan.mjs';

function makeDebugRoot() {
  const root = mkdtempSync(join(tmpdir(), 'cy-status-arrow-gallery-'));
  mkdirSync(join(root, 'debug'));
  mkdirSync(join(root, 'build'));
  writeFileSync(
    join(root, 'debug', 'index.html'),
    '<script src="livereload-setup.js"></script>',
  );
  writeFileSync(join(root, 'debug', 'networks.js'), 'var networks = {};');
  writeFileSync(join(root, 'debug', 'livereload-setup.js'), '');
  writeFileSync(join(root, 'build', 'cytoscape.umd.js'), 'v4');

  return root;
}

describe('status arrow gallery assets', function () {
  it('writes a visible fallback at the v3 script URL when the ignored bundle is absent', function () {
    const root = makeDebugRoot();

    try {
      const planned = planDebug({ root, networks: {}, wireEnabled: false });
      const fallback = planned.ops.find(
        (op) => op.to === 'v3/build/cytoscape.umd.js',
      );

      expect(fallback?.kind).to.equal('write');
      expect(fallback?.text).to.contain(
        'window.__CYTOSCAPE_V3_BUNDLE_MISSING__ = true;',
      );
      expect(planned.warnings.join('\n')).to.contain(
        'arrow gallery: v3/build/cytoscape.umd.js is missing',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('copies the built v3 bundle when it is available', function () {
    const root = makeDebugRoot();

    try {
      const v3 = join(root, 'v3', 'build', 'cytoscape.umd.js');
      mkdirSync(join(root, 'v3', 'build'), { recursive: true });
      writeFileSync(v3, 'v3-bundle');
      const planned = planDebug({ root, networks: {}, wireEnabled: false });
      const copied = planned.ops.find(
        (op) => op.to === 'v3/build/cytoscape.umd.js',
      );

      expect(copied?.kind).to.equal('copy');
      expect(copied?.from).to.equal(v3);
      expect(planned.warnings.join('\n')).not.to.contain(
        'arrow gallery: v3/build/cytoscape.umd.js is missing',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
