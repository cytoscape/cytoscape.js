import { expect } from 'chai';

import { EdgePipeline } from '../../src/render/edge-pipeline.mjs';
import { CurvedEdgePipeline } from '../../src/render/curved-edge-pipeline.mjs';
import { ArrowPipeline } from '../../src/render/arrow-pipeline.mjs';
import { CurvedArrowPipeline } from '../../src/render/curved-arrow-pipeline.mjs';
import { CullKernels } from '../../src/render/cull.mjs';
import { BUFFER_USAGE } from '../../src/gpu/webgpu-constants.mjs';

// the arrow pipelines spell the browser global (each spec file is its own
// process, so this reaches no other spec)
globalThis.GPUBufferUsage ??= BUFFER_USAGE;

/*
Variant pipelines compile on first use (src/render/lazy-pipeline.mts).

Every pipeline created is compiled when the first frame submits.  On the
software adapter the visual goldens pin, the pick, casing, layer and
mid-arrow variants of the edge and arrow pipelines were ~60% of a curved
scene's first-frame compile, and a scene that never draws them paid for
them in every test.  A constructor that goes back to building them
eagerly renders the same frame, slower — so nothing but this spec sees it.
*/

/** A device that answers every call with a stub and logs pipeline labels. */
const mockDevice = () => {
  const created = [];
  const stub = () => ({
    getMappedRange: () => new ArrayBuffer(1024),
    unmap: () => {},
    destroy: () => {},
  });
  const device = new Proxy(
    {
      createRenderPipeline: (d) => (created.push(d.label), stub()),
      createComputePipeline: (d) => (created.push(d.label), stub()),
      queue: { writeBuffer: () => {} },
    },
    { get: (t, k) => (k in t ? t[k] : stub) },
  );

  return { device, created };
};

/** A pass encoder that records the pipelines it is given. */
const mockPass = () => {
  const set = [];

  return {
    set,
    setPipeline: (p) => set.push(p),
    setBindGroup: () => {},
    setIndexBuffer: () => {},
    drawIndexedIndirect: () => {},
  };
};

describe('variant pipelines compile on first use', () => {
  const cases = [
    ['EdgePipeline', EdgePipeline, ['cy-gpu:edge-pipeline']],
    ['CurvedEdgePipeline', CurvedEdgePipeline, ['cy-gpu:curved-edge-pipeline']],
    ['ArrowPipeline', ArrowPipeline, ['cy-gpu:arrow-pipeline']],
    [
      'CurvedArrowPipeline',
      CurvedArrowPipeline,
      ['cy-gpu:curved-arrow-pipeline'],
    ],
  ];

  for (const [name, Pipeline, eager] of cases) {
    it(`${name} builds only its scene pipeline up front`, () => {
      const { device, created } = mockDevice();

      new Pipeline(device, 'bgra8unorm', {});

      expect(created).to.deep.equal(eager);
    });
  }

  it('a pick draw builds the pick variant once, and reuses it', () => {
    const { device, created } = mockDevice();
    const edges = new EdgePipeline(device, 'bgra8unorm', {});
    const mirror = { version: 0, buffer: () => ({}) };
    const cull = { visibleBindGroup: () => ({}), indirect: {} };
    const pass = mockPass();

    edges.ensureBindGroup = () => ({});
    edges.draw(pass, device, {}, mirror, 1, cull, true);
    edges.draw(pass, device, {}, mirror, 1, cull, true);

    expect(created).to.deep.equal([
      'cy-gpu:edge-pipeline',
      'cy-gpu:edge-pick-pipeline',
    ]);
    expect(pass.set[0]).to.equal(pass.set[1]);
  });

  it('CullKernels builds a kind on its first encode, not at construction', () => {
    const { device, created } = mockDevice();
    const kernels = new CullKernels(device);

    expect(created).to.deep.equal(['cy-gpu:cull-scan']);

    kernels.countPipelines.glyph();
    kernels.scatterPipelines.glyph();
    kernels.countPipelines.glyph();

    expect(created).to.deep.equal([
      'cy-gpu:cull-scan',
      'cy-gpu:glyph-cull-count',
      'cy-gpu:glyph-cull-scatter',
    ]);
  });
});
