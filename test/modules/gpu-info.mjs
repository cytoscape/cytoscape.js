import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  classifyAdapter,
  renderGpuReport,
  PROBE_ARGS,
} from '../../scripts/gpu-info.mjs';

/*
`scripts/gpu-info.mjs` — the pure halves of `npm run gpu`, against verbatim
adapter captures.

The script exists because "the box has a card" and "the browser reaches the
card" are different facts, and twice now a session has read a SwiftShader
adapter label and concluded the box had no GPU.  What these specs pin:

  1. The classifier's three-way verdict, against `adapter.info` shapes
     captured from real Chromium runs on this repo's boxes — the RX 580
     (hardware) and the SwiftShader fallback (software) — not hand-shaped
     approximations (round 36.1's fixture rule).
  2. The report's contract with agents: a failed probe is `unknown` (exit 1),
     never `software` — a broken probe must not manufacture a "no GPU"
     answer, which is exactly the mistake the script exists to prevent.
  3. The probe flags stay a subset of what `playwright.config.js` passes on
     Linux, so `npm run gpu` answers for the browser the harness actually
     runs, not a configuration nobody uses.
*/

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

// Verbatim `adapter.info` captures from this box's Chromium (2026-08-28):
// the RX 580 through RADV (Chromium masks `description` by default — the
// classifier must not depend on it), and the SwiftShader fallback.
const RX580 = {
  vendor: 'amd',
  architecture: 'gcn-4',
  description: '',
  isFallbackAdapter: false,
};
const SWIFTSHADER = {
  vendor: 'google',
  architecture: 'swiftshader',
  description: 'SwiftShader device',
  isFallbackAdapter: false,
};

describe('gpu-info', () => {
  describe('classifyAdapter', () => {
    it('classifies real silicon as hardware', () => {
      expect(classifyAdapter(RX580)).to.equal('hardware');
    });

    it('classifies SwiftShader as software', () => {
      expect(classifyAdapter(SWIFTSHADER)).to.equal('software');
    });

    it('classifies Mesa CPU rasterizers as software', () => {
      expect(
        classifyAdapter({
          vendor: 'mesa',
          architecture: '',
          description: 'llvmpipe (LLVM 21.1.8, 256 bits)',
        }),
      ).to.equal('software');
      expect(
        classifyAdapter({
          vendor: '',
          architecture: '',
          description: 'lavapipe',
        }),
      ).to.equal('software');
    });

    it('classifies a fallback adapter as software regardless of label', () => {
      expect(classifyAdapter({ ...RX580, isFallbackAdapter: true })).to.equal(
        'software',
      );
    });

    it('classifies a missing adapter as none', () => {
      expect(classifyAdapter(null)).to.equal('none');
    });
  });

  describe('renderGpuReport', () => {
    const machine = { gpus: [{ model: 'Radeon RX 580' }] };

    it('says HARDWARE, and shows the adapter identity, for silicon', () => {
      const r = renderGpuReport({
        machine,
        adapter: RX580,
        probeError: null,
        ci: false,
      });
      const text = r.lines.join('\n');

      expect(r.verdict).to.equal('hardware');
      expect(text).to.include('HARDWARE');
      expect(text).to.include('amd');
      expect(text).to.include('gcn-4');
    });

    it('says SOFTWARE-ONLY, and warns off benchmarks, for SwiftShader', () => {
      const r = renderGpuReport({
        machine,
        adapter: SWIFTSHADER,
        probeError: null,
        ci: false,
      });

      expect(r.verdict).to.equal('software');
      expect(r.lines.join('\n')).to.include('SOFTWARE-ONLY');
    });

    it('reports a failed probe as UNKNOWN, never as no-GPU', () => {
      const r = renderGpuReport({
        machine,
        adapter: null,
        probeError: 'browserType.launch: Executable does not exist',
        ci: false,
      });
      const text = r.lines.join('\n');

      expect(r.verdict).to.equal('unknown');
      expect(text).to.include('UNKNOWN');
      expect(text).to.not.include('SOFTWARE-ONLY');
    });

    it('flags the CI SwiftShader pin so a CI answer is not misread', () => {
      const r = renderGpuReport({
        machine,
        adapter: SWIFTSHADER,
        probeError: null,
        ci: true,
      });

      expect(r.lines.join('\n')).to.include('CI pins');
    });
  });

  describe('PROBE_ARGS', () => {
    it('stay a subset of the flags playwright.config.js passes', () => {
      const config = readFileSync(join(ROOT, 'playwright.config.js'), 'utf8');

      for (const arg of PROBE_ARGS) {
        const bare = arg.split('=')[0];

        expect(config, `${arg} is not in playwright.config.js`).to.include(
          bare,
        );
      }
    });
  });
});
