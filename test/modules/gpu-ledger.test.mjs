import { expect } from 'chai';
import {
  GpuLedger,
  emptyGpuStats,
  ledgerLabel,
  textureBytes,
} from '../../src/gpu/gpu-ledger.mjs';

/*
Round 138: the renderer's allocation ledger (PLAN.md items 34 and 36),
against a mock device — the counting, the destroy wrap, the error scopes
and the uncaptured-error listener.  The browser half (a real device, the
soak and its leaked-buffer control) is playwright-tests/soak.spec.js.
*/

class GPUOutOfMemoryError {
  constructor(message) {
    this.message = message;
  }
}

class GPUValidationError {
  constructor(message) {
    this.message = message;
  }
}

/** A device whose next allocations can be made to fail. */
const mockDevice = () => {
  const scopes = [];
  const listeners = [];
  let failNext = null;
  let resolveLost;
  const device = {
    destroyed: false,
    lost: new Promise((r) => {
      resolveLost = r;
    }),
    createBuffer(desc) {
      if (failNext != null) {
        // the error lands in the innermost scope whose filter matches
        const scope = scopes.findLast((s) => s.filter === failNext.filter);

        scope.error = failNext.error;
        failNext = null;
      }

      return { label: desc.label, size: desc.size, destroy() {} };
    },
    createTexture(desc) {
      return { label: desc.label, destroy() {} };
    },
    destroy() {
      this.destroyed = true;
      resolveLost({ reason: 'destroyed' });
    },
    pushErrorScope(filter) {
      scopes.push({ filter, error: null });
    },
    popErrorScope() {
      return Promise.resolve(scopes.pop().error);
    },
    addEventListener(type, cb) {
      listeners.push(cb);
    },
  };

  return {
    device,
    scopes,
    fail(filter, error) {
      failNext = { filter, error };
    },
    uncaptured(error) {
      for (const cb of listeners) {
        cb({ error });
      }
    },
  };
};

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('gpu ledger (round 138)', function () {
  it('counts live bytes by label, and uncounts each destroy once', function () {
    const { device } = mockDevice();
    const ledger = new GpuLedger(device, () => {});
    const a = device.createBuffer({ label: 'cy-gpu:node.position', size: 256 });
    const b = device.createBuffer({ label: 'cy-gpu:pick-staging-0', size: 64 });

    device.createBuffer({ label: 'cy-gpu:pick-staging-1', size: 64 });

    expect(ledger.snapshot()).to.deep.equal({
      liveBytes: 384,
      peakBytes: 384,
      buffers: 3,
      textures: 0,
      allocations: 3,
      allocationFailures: 0,
      errors: 0,
      byLabel: {
        'cy-gpu:node.position': { bytes: 256, count: 1 },
        'cy-gpu:pick-staging': { bytes: 128, count: 2 },
      },
    });

    a.destroy();
    a.destroy(); // a second destroy is WebGPU-legal and counts nothing
    b.destroy();

    const s = ledger.snapshot();

    expect(s.liveBytes).to.equal(64);
    expect(s.peakBytes).to.equal(384);
    expect(s.buffers).to.equal(1);
    expect(s.allocations).to.equal(3);
    expect(s.byLabel).to.deep.equal({
      'cy-gpu:pick-staging': { bytes: 64, count: 1 },
    });
  });

  it('shows a buffer dropped without destroy() — the soak’s premise', function () {
    const { device } = mockDevice();
    const ledger = new GpuLedger(device, () => {});

    for (let i = 0; i < 10; i++) {
      device.createBuffer({ label: 'leak', size: 4096 }); // never destroyed
      device.createBuffer({ label: 'churn', size: 4096 }).destroy();
    }

    expect(ledger.snapshot().liveBytes).to.equal(40960);
    expect(ledger.snapshot().byLabel).to.deep.equal({
      leak: { bytes: 40960, count: 10 },
    });
  });

  it('prices a texture by mips, layers, format and samples', function () {
    expect(textureBytes({ size: [256, 128], format: 'rgba8unorm' })).to.equal(
      256 * 128 * 4,
    );
    expect(
      textureBytes({
        size: { width: 64, height: 64, depthOrArrayLayers: 3 },
        format: 'r8unorm',
        mipLevelCount: 3,
      }),
    ).to.equal((64 * 64 + 32 * 32 + 16 * 16) * 3);
    expect(
      textureBytes({ size: [10, 10], format: 'depth24plus', sampleCount: 4 }),
    ).to.equal(1600);

    const { device } = mockDevice();
    const ledger = new GpuLedger(device, () => {});
    const t = device.createTexture({
      label: 'cy-gpu:glyph-atlas',
      size: [512, 512],
      format: 'r8unorm',
    });

    expect(ledger.snapshot().textures).to.equal(1);
    expect(ledger.snapshot().liveBytes).to.equal(512 * 512);
    t.destroy();
    expect(ledger.snapshot().textures).to.equal(0);
  });

  it('reports a refused allocation with its label and bytes', async function () {
    const mock = mockDevice();
    const reports = [];
    const ledger = new GpuLedger(mock.device, (info) => reports.push(info));

    mock.fail('out-of-memory', new GPUOutOfMemoryError('no room'));
    mock.device.createBuffer({ label: 'cy-gpu:glyphs', size: 1 << 20 });
    mock.fail('validation', new GPUValidationError('too big'));
    mock.device.createBuffer({ label: 'cy-gpu:edge.width', size: 2 ** 40 });
    mock.device.createBuffer({ label: 'fine', size: 4 });
    await settle();

    expect(reports).to.deep.equal([
      {
        kind: 'out-of-memory',
        message: 'no room',
        label: 'cy-gpu:glyphs',
        bytes: 1 << 20,
      },
      {
        kind: 'validation',
        message: 'too big',
        label: 'cy-gpu:edge.width',
        bytes: 2 ** 40,
      },
    ]);
    expect(ledger.snapshot().allocationFailures).to.equal(2);
    // every scope pushed was popped
    expect(mock.scopes).to.deep.equal([]);
  });

  it('reports each distinct uncaptured error once, and counts them all', function () {
    const mock = mockDevice();
    const reports = [];
    const ledger = new GpuLedger(mock.device, (info) => reports.push(info));

    for (let frame = 0; frame < 30; frame++) {
      mock.uncaptured(new GPUValidationError('Invalid CommandBuffer'));
    }

    mock.uncaptured(new GPUOutOfMemoryError('lost memory'));

    expect(reports).to.deep.equal([
      { kind: 'validation', message: 'Invalid CommandBuffer' },
      { kind: 'out-of-memory', message: 'lost memory' },
    ]);
    expect(ledger.snapshot().errors).to.equal(31);
  });

  it('closes with its device: nothing live, nothing counted after', async function () {
    const { device } = mockDevice();
    const ledger = new GpuLedger(device, () => {});
    const a = device.createBuffer({ label: 'x', size: 100 });

    device.destroy();
    await settle();

    expect(device.destroyed).to.equal(true);
    expect(ledger.closed).to.equal(true);
    expect(ledger.snapshot().liveBytes).to.equal(0);
    a.destroy();
    expect(ledger.snapshot().liveBytes).to.equal(0);
    expect(ledger.snapshot().byLabel).to.deep.equal({});
  });

  it('groups a numbered label with its kind, and zeroes before a device', function () {
    expect(ledgerLabel('cy-gpu:pick-staging-3')).to.equal(
      'cy-gpu:pick-staging',
    );
    expect(ledgerLabel('cy-gpu:image-tier-128')).to.equal('cy-gpu:image-tier');
    expect(ledgerLabel(undefined)).to.equal('(unlabelled)');
    expect(emptyGpuStats().liveBytes).to.equal(0);
  });
});
