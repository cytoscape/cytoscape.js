import { expect } from 'chai';
import cytoscape from '../src/headless-gpu.mjs';
import { HeadlessForceHost } from '../src/gpu/headless-force-host.mjs';
import { _resetAlgoGpu } from '../src/algorithms/algo-gpu.mjs';
import { defaultForceParams } from '../src/layout/force-sim.mjs';

// Round 131.4: the headless GPU force host — the device integrator driven
// by an async loop instead of a renderer's frame.  Node has no WebGPU, so
// a fake device records what the host asks of it; what these specs pin is
// the *ordering* the host's correctness rests on: encode → submit → the
// queue's done → the convergence poll, one batch at a time (a readback
// racing a continuation reads zero, and zero reads as converged — the
// round-118/119 class of defect); nothing encoded after finishForce(),
// even with a continuation pending; an idle infinite run parked until a
// wake.  The real device is the Deno GPU smoke's (test/runtimes).

/**
 * A fake GPUDevice: buffers are byte arrays, copies run at submit, and
 * `onSubmittedWorkDone` / `mapAsync` settle on a later macrotask — or,
 * with `holdDone`, only when the spec releases them.
 */
const fakeDevice = ({ holdDone = false } = {}) => {
  const log = [];
  const held = [];
  const later = (fn) => setTimeout(fn, 0);
  let destroyedWrites = 0;

  const buffer = (desc) => {
    const buf = {
      label: desc.label,
      bytes: new Uint8Array(Math.max(4, desc.size)),
      destroyed: false,
      mapAsync: () => {
        log.push('map');

        return new Promise((resolve) => later(resolve));
      },
      getMappedRange: () => buf.bytes.slice().buffer,
      unmap: () => {},
      destroy: () => {
        buf.destroyed = true;
      },
    };

    return buf;
  };

  const device = {
    lost: new Promise(() => {}),
    log,
    held,
    destroyedWrites: () => destroyedWrites,
    createBuffer: buffer,
    createShaderModule: () => ({}),
    createComputePipeline: () => ({ getBindGroupLayout: () => ({}) }),
    createBindGroup: () => ({}),
    createCommandEncoder: () => {
      const ops = [];

      return {
        beginComputePass: () => {
          log.push('encode');

          return {
            setPipeline: () => {},
            setBindGroup: () => {},
            dispatchWorkgroups: () => {},
            end: () => {},
          };
        },
        copyBufferToBuffer: (src, srcOff, dst, dstOff, size) =>
          ops.push(() =>
            dst.bytes.set(src.bytes.subarray(srcOff, srcOff + size), dstOff),
          ),
        finish: () => ({ ops }),
      };
    },
    queue: {
      writeBuffer: (buf, offset, data, dataOffset = 0, size) => {
        if (buf.destroyed) {
          destroyedWrites++;
        }

        const src = new Uint8Array(
          data,
          dataOffset,
          size ?? data.byteLength - dataOffset,
        );

        buf.bytes.set(src, offset);
      },
      submit: (cbs) => {
        log.push('submit');

        for (const cb of cbs) {
          for (const op of cb.ops) op();
        }
      },
      onSubmittedWorkDone: () =>
        new Promise((resolve) => {
          const release = () => {
            log.push('done');
            resolve();
          };

          if (holdDone) {
            held.push(release);
          } else {
            later(release);
          }
        }),
    },
  };

  return device;
};

/** A small run's inputs: a path of n nodes. */
const inputs = (n = 4, infinite = false) => {
  const edges = new Uint32Array((n - 1) * 2);

  for (let i = 0; i < n - 1; i++) {
    edges[i * 2] = i;
    edges[i * 2 + 1] = i + 1;
  }

  const positions = new Float32Array(n * 2);

  for (let i = 0; i < n; i++) {
    positions[i * 2] = i * 10;
    positions[i * 2 + 1] = i * 3;
  }

  return {
    n,
    edges,
    edgeLength: new Float32Array(n - 1).fill(30),
    positions,
    pinned: new Uint8Array(n),
    anchors: new Float32Array(n * 2),
    slots: Array.from({ length: n }, (_, i) => i),
    params: { ...defaultForceParams(), iterations: 300 },
    cutoff: 40,
    frame: { x: -500, y: -500, w: 1000, h: 1000 },
    infinite,
  };
};

/** Resolve once `test()` holds, polling on macrotasks. */
const until = async (test, what, limit = 2000) => {
  for (let i = 0; i < limit; i++) {
    if (test()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  throw new Error(`timed out waiting for ${what}`);
};

const tick = (k = 5) =>
  new Promise((resolve) => {
    const step = (left) =>
      left === 0 ? resolve() : setTimeout(() => step(left - 1), 0);

    step(k);
  });

describe('gpu/force: the headless host (131.4)', function () {
  it('orders every batch encode → submit → done → poll, and converges', async function () {
    const device = fakeDevice();
    const errors = [];
    const host = new HeadlessForceHost(
      async () => device,
      (m) => errors.push(m),
    );
    const rt = host.startForce(inputs(), 3);

    expect(rt).to.not.equal(null);
    expect(host.active()).to.equal(true);
    // a second run while one is open is refused, as on the renderer
    expect(host.startForce(inputs(), 3)).to.equal(null);

    await until(() => rt.converged(), 'convergence');

    const log = device.log;

    expect(log.slice(0, 4)).to.deep.equal(['encode', 'submit', 'done', 'map']);

    for (let i = 0; i < log.length; i++) {
      // a submit is always followed by its done before anything else
      if (log[i] === 'submit') {
        expect(log[i + 1], `event ${i + 1} after a submit`).to.equal('done');
      }

      // a poll maps only after the batch it reads has completed
      if (log[i] === 'map') {
        expect(log[i - 1], `event ${i - 1} before a map`).to.equal('done');
      }
    }

    // the fake's displacement is zero, so the first landed poll settles:
    // a handful of batches, not the iteration budget
    const submits = log.filter((e) => e === 'submit').length;

    expect(submits).to.be.within(1, 10);

    const positions = await rt.readPositions();

    // the fake moves nothing: the settle reads back what was uploaded
    expect(Array.from(positions.slice(0, 4))).to.deep.equal([0, 0, 10, 3]);

    host.finishForce();
    expect(host.active()).to.equal(false);
    expect(errors).to.deep.equal([]);
  });

  it('encodes nothing after finishForce(), even with a done pending', async function () {
    const device = fakeDevice({ holdDone: true });
    const host = new HeadlessForceHost(
      async () => device,
      () => {},
    );

    host.startForce(inputs(), 3);
    await until(() => device.held.length === 1, 'the first submit');
    expect(device.log).to.deep.equal(['encode', 'submit']);

    host.finishForce();
    expect(host.active()).to.equal(false);

    // the continuation runs now, on a destroyed run
    device.held.shift()();
    await tick();

    expect(device.log).to.deep.equal(['encode', 'submit', 'done']);
    expect(device.destroyedWrites()).to.equal(0);
  });

  it('control: without finishForce() the same held run does continue', async function () {
    const device = fakeDevice({ holdDone: true });
    const host = new HeadlessForceHost(
      async () => device,
      () => {},
    );

    host.startForce(inputs(), 3);
    await until(() => device.held.length === 1, 'the first submit');
    device.held.shift()();
    await until(() => device.held.length === 1, 'the second submit');

    expect(device.log).to.deep.equal([
      'encode',
      'submit',
      'done',
      'map',
      'encode',
      'submit',
    ]);
    host.finishForce();
  });

  it('parks an idle infinite run, and a wake restarts it', async function () {
    const device = fakeDevice();
    const host = new HeadlessForceHost(
      async () => device,
      () => {},
    );
    const rt = host.startForce(inputs(4, true), 3);

    await until(() => rt.idle(), 'the infinite run to rest');
    await tick(20);

    const parked = device.log.length;

    await tick(20);
    // at rest: the loop has stopped submitting
    expect(device.log.length).to.equal(parked);
    expect(rt.converged(), 'an infinite run never converges').to.equal(false);

    rt.reheat();
    host.wakeForce();
    // a second wake while the loop runs does not start a second loop
    host.wakeForce();
    await until(() => rt.idle(), 'the reheated run to rest again');

    const resumed = device.log.slice(parked);

    expect(resumed.slice(0, 2)).to.deep.equal(['encode', 'submit']);

    for (let i = 0; i < resumed.length; i++) {
      if (resumed[i] === 'submit') {
        expect(resumed[i + 1]).to.equal('done');
      }
    }

    host.finishForce();
  });

  it('an acquisition failure ends the run loudly and frees the host', async function () {
    const errors = [];
    const host = new HeadlessForceHost(
      async () => {
        throw new Error('no adapter');
      },
      (m) => errors.push(m),
    );
    const rt = host.startForce(inputs(), 3);
    const err = await rt.readPositions().then(
      () => null,
      (e) => e,
    );

    expect(err.message).to.equal('no adapter');
    expect(errors).to.deep.equal(['no adapter']);
    expect(rt.converged()).to.equal(true);
    expect(host.active()).to.equal(false);

    // the slot is free for the next run
    const device = fakeDevice();
    const ok = new HeadlessForceHost(
      async () => device,
      () => {},
    );

    expect(host.startForce(inputs(), 3)).to.not.equal(null);
    expect(ok.startForce(inputs(), 3)).to.not.equal(null);
    ok.finishForce();
  });

  it('writes before the device exists land in the uploaded inputs', async function () {
    let release;
    const device = fakeDevice();
    const host = new HeadlessForceHost(
      () => new Promise((resolve) => (release = () => resolve(device))),
      () => {},
    );
    const run = inputs();
    const rt = host.startForce(run, 3);

    rt.setPosition(1, 77, 88);
    rt.setPinned(2, true);
    rt.reheat();
    expect(rt.converged()).to.equal(false);
    expect(rt.idle()).to.equal(false);
    expect(run.positions[2]).to.equal(77);
    expect(run.pinned[2]).to.equal(1);

    release();

    const positions = await rt.readPositions();

    expect(positions[2]).to.equal(77);
    expect(positions[3]).to.equal(88);

    // and after it exists, through the runtime
    rt.setPinned(2, false);
    rt.setPosition(0, 5, 6);
    host.finishForce();
  });
});

describe('gpu/force: an explicit executor gpu on cytoscape/headless-gpu (131.4)', function () {
  let realDescriptor;

  beforeEach(function () {
    realDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    _resetAlgoGpu();
  });

  afterEach(function () {
    if (realDescriptor != null) {
      Object.defineProperty(globalThis, 'navigator', realDescriptor);
    } else {
      delete globalThis.navigator;
    }

    _resetAlgoGpu();
  });

  const RING = () => {
    const els = [];

    for (let i = 0; i < 6; i++) {
      els.push({ data: { id: `n${i}` }, position: { x: i * 20, y: i * 7 } });
    }

    for (let i = 0; i < 6; i++) {
      els.push({
        data: { id: `e${i}`, source: `n${i}`, target: `n${(i + 1) % 6}` },
      });
    }

    return els;
  };

  it('runs on the compute device and settles through the layout', async function () {
    const device = fakeDevice();

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        gpu: {
          requestAdapter: async () => ({ requestDevice: async () => device }),
        },
      },
      configurable: true,
    });

    const cy = cytoscape({ elements: RING() });
    const layout = cy.layout({
      name: 'force',
      executor: 'gpu',
      fit: false,
      seed: 3,
    });
    let stopped = 0;

    cy.on('layoutstop', () => stopped++);
    layout.run();

    // the run is on the host: compaction defers under it
    expect(cy._forceHost.active()).to.equal(true);

    await layout.promise();

    expect(stopped).to.equal(1);
    expect(device.log).to.include('submit');
    expect(cy._forceHost.active()).to.equal(false);

    cy.nodes().forEach((n) => {
      expect(Number.isFinite(n.position().x)).to.equal(true);
    });

    cy.destroy();
  });

  it("'auto' never reaches the device headless", async function () {
    const device = fakeDevice();

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        gpu: {
          requestAdapter: async () => ({ requestDevice: async () => device }),
        },
      },
      configurable: true,
    });

    const cy = cytoscape({ elements: RING() });

    await cy
      .layout({ name: 'force', executor: 'cpu', fit: false, seed: 3 })
      .run()
      .promise();
    await cy
      .layout({ name: 'force', fit: false, seed: 3, iterations: 20 })
      .run()
      .promise();

    expect(device.log).to.deep.equal([]);
    expect(cy._forceHost).to.equal(null);
    cy.destroy();
  });

  it("an explicit 'gpu' with no WebGPU throws at start, naming the device", function () {
    const cy = cytoscape({ elements: RING() });

    expect(() => cy.layout({ name: 'force', executor: 'gpu' }).run()).to.throw(
      /executor 'gpu' needs the GPU integrator — a flat, unconstrained graph and a WebGPU device/,
    );
    cy.destroy();
  });

  it('a compaction defers while the host holds a run', function () {
    const cy = cytoscape({ elements: RING() });
    const warn = console.warn;
    const warned = [];

    console.warn = (m) => warned.push(m);

    try {
      cy._forceHost = { active: () => true };
      cy.$id('n0').remove();
      cy._compact();
      expect(warned[0]).to.match(/Deferring slot compaction/);
    } finally {
      console.warn = warn;
      cy._forceHost = null;
    }

    cy.destroy();
  });
});
