import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { Animation, AnimationManager } from '../src/animation.mjs';
import {
  compileEasing,
  EASINGS,
  EASING_KIND,
  resolveEasing,
} from '../src/easing.mjs';
import { GpuTweenRuntime, TWEEN_SHADERS } from '../src/render/gpu-tween.mjs';
import { GraphStore } from '../src/store/graph-store.mjs';

// Animations tick deterministically via explicit `now` values; the
// collection/core surface drives the same ticks through cy._animations.

describe('gpu/animation', function () {
  describe('easings', function () {
    it('resolves names, defaulting to ease', function () {
      expect(resolveEasing('linear')).to.equal(EASINGS.linear);
      expect(resolveEasing(undefined)).to.equal(EASINGS.ease);
    });

    it('rejects unknown names and custom functions', function () {
      expect(() => resolveEasing('nope')).to.throw(/not a known easing/);
      expect(() => resolveEasing((t) => t)).to.throw(/custom easing function/);
    });

    it('all easings pin 0→0 and 1→1', function () {
      for (const [name, fn] of Object.entries(EASINGS)) {
        expect(fn(0), name).to.be.closeTo(0, 1e-9);
        expect(fn(1), name).to.be.closeTo(1, 1e-6);
      }
    });
  });

  describe('Animation (direct, deterministic)', function () {
    const storeWith = () => {
      const s = new GraphStore();
      s.addNode('a', 0, 0);
      return s;
    };

    it('tweens position from captured start to target', function () {
      const store = storeWith();
      const ref = store.ref('nodes', store.lookup('a').slot);
      const ani = new Animation(store, null, [ref], false, {
        position: { x: 100, y: 40 },
        duration: 400,
        easing: 'linear',
      });
      const pos = () => {
        const c = store.column('node.position');
        return { x: c[ref.slot * 2], y: c[ref.slot * 2 + 1] };
      };

      ani.tick(1000);
      expect(pos()).to.deep.equal({ x: 0, y: 0 }); // at start

      ani.tick(1200);
      expect(pos().x).to.be.closeTo(50, 1e-4);
      expect(pos().y).to.be.closeTo(20, 1e-4);

      expect(ani.tick(1400)).to.be.true; // finished
      expect(pos()).to.deep.equal({ x: 100, y: 40 });
      expect(ani.done).to.be.true;
    });

    it('tweens a scalar style channel (opacity)', function () {
      const store = storeWith();
      const ref = store.ref('nodes', store.lookup('a').slot);
      store.setScalar('node.opacity', ref.slot, 1);
      const ani = new Animation(store, null, [ref], false, {
        style: { opacity: 0 },
        duration: 100,
        easing: 'linear',
      });

      ani.tick(0);
      ani.tick(50);
      expect(store.column('node.opacity')[ref.slot]).to.be.closeTo(0.5, 1e-4);
      ani.tick(100);
      expect(store.column('node.opacity')[ref.slot]).to.equal(0);
    });

    it('tweens a colour channel in OKLab, not sRGB', function () {
      const store = storeWith();
      const ref = store.ref('nodes', store.lookup('a').slot);
      store.setColor('node.fillColor', ref.slot, 0, 0, 0, 255);
      const ani = new Animation(store, null, [ref], false, {
        style: { 'background-color': 'rgb(255,255,255)' },
        duration: 100,
        easing: 'linear',
      });

      ani.tick(0);
      ani.tick(50);
      const c = store.column('node.fillColor');

      // the sRGB midpoint would be 128; OKLab L=0.5 lands darker
      expect([
        c[ref.slot * 4],
        c[ref.slot * 4 + 1],
        c[ref.slot * 4 + 2],
      ]).to.deep.equal([99, 99, 99]);

      ani.tick(100);
      expect(
        Array.from(c.subarray(ref.slot * 4, ref.slot * 4 + 4)),
      ).to.deep.equal([255, 255, 255, 255]);
    });

    it('interpolates hues through OKLab (blue→yellow stays colourful)', function () {
      const store = storeWith();
      const ref = store.ref('nodes', store.lookup('a').slot);
      store.setColor('node.fillColor', ref.slot, 0, 0, 255, 255);
      const ani = new Animation(store, null, [ref], false, {
        style: { 'background-color': 'rgb(255,255,0)' },
        duration: 100,
        easing: 'linear',
      });

      ani.tick(0);
      ani.tick(50);
      const c = store.column('node.fillColor');

      // sRGB would pass through (128,128,128); OKLab keeps chroma
      expect(
        Array.from(c.subarray(ref.slot * 4, ref.slot * 4 + 3)),
      ).to.deep.equal([108, 171, 199]);
    });

    it('honours a delay before interpolating', function () {
      const store = storeWith();
      const ref = store.ref('nodes', store.lookup('a').slot);
      const ani = new Animation(store, null, [ref], false, {
        position: { x: 100, y: 0 },
        duration: 100,
        delay: 200,
        easing: 'linear',
      });

      ani.tick(0); // schedules start at 200
      ani.tick(100); // still in delay
      expect(store.column('node.position')[ref.slot * 2]).to.equal(0);
      ani.tick(250); // 50% through
      expect(store.column('node.position')[ref.slot * 2]).to.be.closeTo(
        50,
        1e-4,
      );
    });

    it('stop(jumpToEnd) applies the final frame', function () {
      const store = storeWith();
      const ref = store.ref('nodes', store.lookup('a').slot);
      const ani = new Animation(store, null, [ref], false, {
        position: { x: 80, y: 0 },
        duration: 100,
      });

      ani.tick(0);
      ani.stop(true);
      expect(store.column('node.position')[ref.slot * 2]).to.equal(80);
      expect(ani.done).to.be.true;
    });

    it('captures start values per element (multi-node position)', function () {
      const store = new GraphStore();
      store.addNode('a', 0, 0);
      store.addNode('b', 100, 100);
      const refs = [
        store.ref('nodes', store.lookup('a').slot),
        store.ref('nodes', store.lookup('b').slot),
      ];
      const ani = new Animation(store, null, refs, false, {
        position: { x: 50, y: 50 },
        duration: 100,
        easing: 'linear',
      });
      const pos = (slot) => {
        const c = store.column('node.position');
        return { x: c[slot * 2], y: c[slot * 2 + 1] };
      };

      ani.tick(0);
      ani.tick(50); // halfway — each node from its OWN start toward (50,50)
      expect(pos(refs[0].slot)).to.deep.equal({ x: 25, y: 25 }); // a: (0,0)→(50,50)
      expect(pos(refs[1].slot)).to.deep.equal({ x: 75, y: 75 }); // b: (100,100)→(50,50)
    });

    it('throws on unsupported animatable props', function () {
      const store = storeWith();
      const ref = store.ref('nodes', store.lookup('a').slot);

      expect(
        () =>
          new Animation(store, null, [ref], false, {
            style: { shape: 'rectangle' },
          }),
      ).to.throw(/unsupported/);
    });

    it('throws on unparseable style targets, naming the value', function () {
      const store = storeWith();
      const ref = store.ref('nodes', store.lookup('a').slot);

      // message-asserted: the colour and scalar guards live in one loop
      expect(
        () =>
          new Animation(store, null, [ref], false, {
            style: { 'background-color': 'notacolor' },
          }),
      ).to.throw(/Invalid animation colour 'notacolor'/);

      expect(
        () =>
          new Animation(store, null, [ref], false, {
            style: { opacity: 'wide' },
          }),
      ).to.throw(/Invalid animation number 'wide'/);
    });
  });

  describe('overshooting easings', function () {
    const nodeWith = () => {
      const s = new GraphStore();
      s.addNode('a', 0, 0);
      return { store: s, ref: s.ref('nodes', s.lookup('a').slot) };
    };
    // sample densely: an overshoot lives between the endpoints
    const sweep = (ani, ms, read) => {
      const seen = [];

      for (let i = 0; i <= 40; i++) {
        ani.tick((i / 40) * ms);
        seen.push(read());
      }

      return seen;
    };

    it('runs a spring past its perceptual duration, to let it settle', function () {
      const { store, ref } = nodeWith();
      const ani = new Animation(store, null, [ref], false, {
        position: { x: 100, y: 0 },
        duration: 100,
        easing: 'spring(0.5)',
      });

      expect(ani.durationMs).to.be.above(150); // ~1.95× for this bounce
      ani.tick(0);
      expect(ani.tick(100)).to.be.false; // still ringing at the perceptual mark
      expect(ani.tick(ani.durationMs)).to.be.true;
      expect(store.column('node.position')[ref.slot * 2]).to.equal(100);
    });

    it('lets position overshoot — that is the point of a spring', function () {
      const { store, ref } = nodeWith();
      const ani = new Animation(store, null, [ref], false, {
        position: { x: 100, y: 0 },
        duration: 100,
        easing: 'spring(0.6)',
      });

      ani.tick(0);

      const xs = sweep(
        ani,
        ani.durationMs,
        () => store.column('node.position')[ref.slot * 2],
      );

      expect(Math.max(...xs)).to.be.above(100);
      expect(xs[xs.length - 1]).to.equal(100);
    });

    it('clamps opacity into [0, 1] under a bouncy curve', function () {
      const { store, ref } = nodeWith();
      store.setScalar('node.opacity', ref.slot, 1);

      const ani = new Animation(store, null, [ref], false, {
        style: { opacity: 0 },
        duration: 100,
        easing: 'spring(0.7)',
      });

      ani.tick(0);

      const vals = sweep(
        ani,
        ani.durationMs,
        () => store.column('node.opacity')[ref.slot],
      );

      expect(Math.min(...vals)).to.equal(0); // the undershoot is clamped, not negative
      expect(Math.max(...vals)).to.be.at.most(1);
    });

    it('clamps border-width at zero (a negative width would flip the stroke)', function () {
      const { store, ref } = nodeWith();
      store.setScalar('node.borderWidth', ref.slot, 6);

      const ani = new Animation(store, null, [ref], false, {
        style: { 'border-width': 0 },
        duration: 100,
        easing: 'cubic-bezier(0.3, 1.5, 0.7, -0.6)',
      });

      ani.tick(0);

      const vals = sweep(
        ani,
        ani.durationMs,
        () => store.column('node.borderWidth')[ref.slot],
      );

      expect(Math.min(...vals)).to.equal(0);
    });

    it("clamps a colour's bytes, so alpha cannot wrap", function () {
      const { store, ref } = nodeWith();
      store.setColor('node.fillColor', ref.slot, 255, 0, 0, 255);

      const ani = new Animation(store, null, [ref], false, {
        style: { 'background-color': 'rgba(0, 0, 255, 0)' },
        duration: 100,
        easing: 'spring(0.8)',
      });

      ani.tick(0);

      const seen = sweep(ani, ani.durationMs, () => {
        const c = store.column('node.fillColor');
        return Array.from(c.subarray(ref.slot * 4, ref.slot * 4 + 4));
      });

      for (const px of seen) {
        for (const b of px) {
          expect(b).to.be.within(0, 255);
        }
      }

      // the final frame is the exact target, wrapping or not
      expect(seen[seen.length - 1]).to.deep.equal([0, 0, 255, 0]);
    });
  });

  describe('GpuTweenRuntime (mock device)', function () {
    const makeMock = () => {
      const writes = [];
      const dispatches = [];
      const device = {
        createBuffer: (d) => ({
          label: d.label,
          size: d.size,
          destroyed: false,
          destroy() {
            this.destroyed = true;
          },
        }),
        createBindGroupLayout: () => ({}),
        createPipelineLayout: () => ({}),
        createShaderModule: (d) => {
          expect(d.code).to.include('fn csTween');
          return {};
        },
        createComputePipeline: (d) => ({ label: d.label }),
        createBindGroup: () => ({}),
        queue: {
          writeBuffer(b, off, data) {
            writes.push({ label: b.label, off, data });
          },
        },
      };
      const pass = {
        setPipeline() {},
        setBindGroup() {},
        dispatchWorkgroups(n) {
          dispatches.push(n);
        },
      };
      return { device, writes, dispatches, pass };
    };

    const write = (column, kind, slots, data) => ({
      column,
      kind,
      paint: kind !== 'position',
      refs: slots.map((slot) => ({ group: 'nodes', slot, gen: 0 })),
      slots: new Uint32Array(slots),
      data: new Float32Array(data),
    });

    it('every easing kind is handled in every kernel', function () {
      for (const [kind, code] of Object.entries(TWEEN_SHADERS)) {
        for (const id of Object.values(EASING_KIND)) {
          expect(code, `${kind} easing kind ${id}`).to.match(
            new RegExp(`case ${id}u:|default:`),
          );
        }
      }
    });

    it('the kernels carry a WGSL twin of both CPU evaluators', function () {
      for (const [kind, code] of Object.entries(TWEEN_SHADERS)) {
        expect(code, kind).to.include('fn bezierAt'); // the enum + cubic-bezier()
        expect(code, kind).to.include('fn pointsAt'); // linear() + spring()
      }
    });

    it('the colour kernel converts out of OKLab (shared with the mapper kernel)', function () {
      expect(TWEEN_SHADERS.color).to.include('oklabToSrgbNorm');
      expect(TWEEN_SHADERS.position).to.not.include('oklabToSrgbNorm');
    });

    it('every kernel counts from arrayLength, not the shared params uniform', function () {
      // a batch's channels share one params buffer, and writeBuffer isn't
      // ordered against dispatches within a pass
      for (const [kind, code] of Object.entries(TWEEN_SHADERS)) {
        expect(code, kind).to.include('arrayLength(&slots)');
        expect(code, kind).to.not.include('params.count');
      }
    });

    it('registers a batch, dispatches, and owns node.position', function () {
      const mock = makeMock();
      const rt = new GpuTweenRuntime(
        mock.device,
        (id) => ({ label: id }),
        () => 0,
      );

      expect(rt.active()).to.be.false;
      expect(rt.ownedColumns()).to.deep.equal([]);

      rt.register(
        1,
        [
          write(
            'node.position',
            'position',
            [2, 5],
            [0, 0, 10, 10, 0, 0, 20, 20],
          ),
        ],
        1000,
        200,
        compileEasing('linear'),
      );

      expect(rt.active()).to.be.true;
      expect(rt.hasPositions()).to.be.true;
      expect(rt.ownedColumns()).to.deep.equal(['node.position']);

      rt.encode(mock.pass, 1100, 'position');
      expect(mock.dispatches).to.deep.equal([1]); // ceil(2/256)

      // the params uniform carries the clock plus the whole curve
      const params = mock.writes.find(
        (w) => w.label === 'cy-gpu:tween-params:1',
      );
      const f = new Float32Array(params.data.buffer);
      const u = new Uint32Array(params.data.buffer);
      expect(f[0]).to.equal(1000); // start
      expect(f[1]).to.equal(200); // duration
      expect(f[2]).to.equal(1100); // now
      expect(u[3]).to.equal(EASING_KIND.linear);
      expect(u[8]).to.equal(0); // no progression array

      rt.unregister(1);
      expect(rt.active()).to.be.false;
    });

    it('owns every tweened column and dispatches per channel', function () {
      const mock = makeMock();
      const rt = new GpuTweenRuntime(
        mock.device,
        (id) => ({ label: id }),
        () => 0,
      );

      rt.register(
        1,
        [
          write('node.position', 'position', [1], [0, 0, 10, 10]),
          write('node.opacity', 'scalar', [1], [1, 0]),
          write('node.fillColor', 'color', [1], [0, 0, 0, 1, 1, 0, 0, 1]),
        ],
        0,
        100,
        compileEasing('ease'),
      );

      expect(rt.ownedColumns()).to.have.members([
        'node.position',
        'node.opacity',
        'node.fillColor',
      ]);

      // position rides the pre-cull pass; the two paint channels the cull pass
      rt.encode(mock.pass, 50, 'position');
      expect(mock.dispatches).to.have.length(1);

      rt.encode(mock.pass, 50, 'paint');
      expect(mock.dispatches).to.have.length(3);

      rt.unregister(1);
      expect(rt.ownedColumns()).to.deep.equal([]);
    });

    it('a paint-only batch needs no pre-cull pass', function () {
      const mock = makeMock();
      const rt = new GpuTweenRuntime(
        mock.device,
        (id) => ({ label: id }),
        () => 0,
      );

      rt.register(
        1,
        [write('edge.lineColor', 'color', [3], [0, 0, 0, 1, 1, 0, 0, 1])],
        0,
        100,
        compileEasing('ease'),
      );

      expect(rt.active()).to.be.true;
      expect(rt.hasPositions()).to.be.false;

      rt.encode(mock.pass, 50, 'position');
      expect(mock.dispatches).to.deep.equal([]);
    });

    it('rebuilds bind groups when the mirror reallocates', function () {
      const mock = makeMock();
      let version = 0;
      let binds = 0;
      const device = {
        ...mock.device,
        createBindGroup: () => {
          binds++;
          return {};
        },
      };
      const rt = new GpuTweenRuntime(
        device,
        (id) => ({ label: id }),
        () => version,
      );

      rt.register(
        1,
        [write('node.opacity', 'scalar', [1], [1, 0])],
        0,
        100,
        compileEasing('linear'),
      );

      rt.encode(mock.pass, 10, 'paint');
      rt.encode(mock.pass, 20, 'paint');
      expect(binds).to.equal(1); // cached

      version = 1;
      rt.encode(mock.pass, 30, 'paint');
      expect(binds).to.equal(2);
    });

    it("destroys a batch's buffers on unregister", function () {
      const created = [];
      const mock = makeMock();
      const device = {
        ...mock.device,
        createBuffer: (d) => {
          const b = {
            label: d.label,
            destroyed: false,
            destroy() {
              this.destroyed = true;
            },
          };
          created.push(b);
          return b;
        },
      };
      const rt = new GpuTweenRuntime(
        device,
        (id) => ({ label: id }),
        () => 0,
      );

      rt.register(
        1,
        [
          write('node.opacity', 'scalar', [1], [1, 0]),
          write('node.fillColor', 'color', [1], [0, 0, 0, 1, 1, 0, 0, 1]),
        ],
        0,
        100,
        compileEasing('linear'),
      );

      // the shared dummy points buffer comes from the constructor
      const batch = created.filter(
        (b) => b.label !== 'cy-gpu:tween-points-none',
      );

      expect(batch).to.have.length(5); // 2 slot + 2 data + 1 params
      rt.unregister(1);
      expect(batch.every((b) => b.destroyed)).to.be.true;
      expect(
        created.find((b) => b.label === 'cy-gpu:tween-points-none').destroyed,
      ).to.be.false;

      rt.destroy();
      expect(created.every((b) => b.destroyed)).to.be.true;
    });

    it('uploads a progression array only for the points kinds, and frees it', function () {
      const created = [];
      const mock = makeMock();
      const device = {
        ...mock.device,
        createBuffer: (d) => {
          const b = {
            label: d.label,
            size: d.size,
            destroyed: false,
            destroy() {
              this.destroyed = true;
            },
          };
          created.push(b);
          return b;
        },
        queue: mock.device.queue,
      };
      const rt = new GpuTweenRuntime(
        device,
        (id) => ({ label: id }),
        () => 0,
      );
      const w = () => [write('node.opacity', 'scalar', [1], [1, 0])];

      rt.register(1, w(), 0, 100, compileEasing('ease-in-out'));
      expect(created.some((b) => b.label === 'cy-gpu:tween-points:1')).to.be
        .false;

      const spring = compileEasing('spring(0.4)');

      rt.register(2, w(), 0, 100, spring);

      const points = created.find((b) => b.label === 'cy-gpu:tween-points:2');

      expect(points.size).to.equal(spring.points.byteLength);

      rt.encode(mock.pass, 50, 'paint');

      const params = mock.writes
        .filter((p) => p.label === 'cy-gpu:tween-params:2')
        .pop();

      expect(new Uint32Array(params.data.buffer)[3]).to.equal(
        EASING_KIND.points,
      );
      expect(new Uint32Array(params.data.buffer)[8]).to.equal(
        spring.points.length / 2,
      );

      rt.unregister(2);
      expect(points.destroyed).to.be.true;
    });
  });

  describe('GPU eligibility (paint vs geometry tiers)', function () {
    const store = () => {
      const s = new GraphStore();
      s.addNode('a', 0, 0);
      return s;
    };
    const ani = (opts, isViewport = false) => {
      const s = store();
      const refs = isViewport ? [] : [s.ref('nodes', s.lookup('a').slot)];

      return new Animation(s, null, refs, isViewport, opts);
    };

    it('offloads position and paint channels', function () {
      expect(ani({ position: { x: 1, y: 1 } }).gpuEligible).to.be.true;
      expect(ani({ style: { opacity: 0 } }).gpuEligible).to.be.true;
      expect(ani({ style: { 'background-color': 'red' } }).gpuEligible).to.be
        .true;
      expect(
        ani({
          style: { 'border-color': 'red', opacity: 0.5 },
          position: { x: 1, y: 1 },
        }).gpuEligible,
      ).to.be.true;
    });

    it('keeps geometry channels on the CPU — cull, CPU pick and the columnar scans read them', function () {
      expect(ani({ style: { 'border-width': 4 } }).gpuEligible).to.be.false;
    });

    it('is all-or-nothing: one geometry channel grounds the whole animation', function () {
      expect(
        ani({
          style: { opacity: 0, 'border-width': 4 },
          position: { x: 1, y: 1 },
        }).gpuEligible,
      ).to.be.false;
    });

    it('never offloads the viewport or a bare delay', function () {
      expect(ani({ pan: { x: 10, y: 0 } }, true).gpuEligible).to.be.false;
      expect(ani({ duration: 100 }).gpuEligible).to.be.false;
    });

    it('offloads every easing, since they all compile to a device program', function () {
      for (const easing of [
        'linear',
        'ease-in-out-circ',
        'cubic-bezier(0.2, 1.4, 0.6, 1)',
        'linear(0, 0.25, 1)',
        'spring(0.5)',
      ]) {
        expect(ani({ position: { x: 1, y: 1 }, easing }).gpuEligible, easing).to
          .be.true;
      }
    });
  });

  describe('opacity resolves per group', function () {
    const GRAPH = {
      nodes: [{ data: { id: 'a' } }, { data: { id: 'b' } }],
      edges: [{ data: { id: 'ab', source: 'a', target: 'b' } }],
    };
    const drive = (cy, ...times) => {
      for (const t of times) {
        cy._animations.tick(t);
      }
    };

    it('animates edge opacity (a node-only channel map made this a no-op)', function () {
      const cy = cytoscape({ elements: GRAPH });
      const slot = cy._store.lookup('ab').slot;

      cy.$id('ab').animate({
        style: { opacity: 0 },
        duration: 100,
        easing: 'linear',
      });

      drive(cy, 0, 50);
      expect(cy._store.column('edge.opacity')[slot]).to.be.closeTo(0.5, 1e-4);

      drive(cy, 100);
      expect(cy._store.column('edge.opacity')[slot]).to.equal(0);
    });

    it('splits one animation across both groups', function () {
      const cy = cytoscape({ elements: GRAPH });
      const node = cy._store.lookup('a').slot;
      const edge = cy._store.lookup('ab').slot;

      cy.elements().animate({
        style: { opacity: 0 },
        duration: 100,
        easing: 'linear',
      });

      drive(cy, 0, 100);
      expect(cy._store.column('node.opacity')[node]).to.equal(0);
      expect(cy._store.column('edge.opacity')[edge]).to.equal(0);
    });

    it('carries the arrows: their pre-folded alpha follows the tween', function () {
      const cy = cytoscape({
        elements: GRAPH,
        style: {
          edges: {
            'target-arrow-shape': 'triangle',
            'target-arrow-color': 'rgb(10,20,30)',
          },
        },
      });
      const slot = cy._store.lookup('ab').slot;
      const arrow = () =>
        Array.from(
          cy._store.column('edge.targetArrow').subarray(slot * 4, slot * 4 + 4),
        );

      expect(arrow()).to.deep.equal([10, 20, 30, 255]);

      cy.$id('ab').animate({
        style: { opacity: 0 },
        duration: 100,
        easing: 'linear',
      });

      drive(cy, 0, 50);
      expect(arrow()[3]).to.be.closeTo(128, 1);

      drive(cy, 100);
      expect(arrow()).to.deep.equal([10, 20, 30, 0]);
    });

    it('fades arrows back in from a fully transparent start', function () {
      // the stored alpha is 0, so the base can only come from the sheet —
      // a stored-bytes derivation would leave the arrow invisible
      const cy = cytoscape({
        elements: GRAPH,
        style: {
          edges: {
            opacity: 0,
            'target-arrow-shape': 'triangle',
            'target-arrow-color': 'rgb(10,20,30)',
          },
        },
      });
      const slot = cy._store.lookup('ab').slot;
      const alpha = () => cy._store.column('edge.targetArrow')[slot * 4 + 3];

      expect(alpha()).to.equal(0);

      cy.$id('ab').animate({
        style: { opacity: 1 },
        duration: 100,
        easing: 'linear',
      });

      drive(cy, 0, 100);
      expect(alpha()).to.equal(255);
    });

    it('leaves the arrows alone when the sheet enables no arrowheads', function () {
      const cy = cytoscape({ elements: GRAPH });
      const slot = cy._store.lookup('ab').slot;

      cy.$id('ab').animate({
        style: { opacity: 0 },
        duration: 100,
        easing: 'linear',
      });
      drive(cy, 0, 100);

      expect(cy._store.column('edge.targetArrow')[slot * 4 + 3]).to.equal(0);
      expect(cy._store.column('edge.sourceArrow')[slot * 4 + 3]).to.equal(0);
    });
  });

  describe('the GPU lease (mock sink)', function () {
    const setup = () => {
      const cy = cytoscape({
        elements: [{ data: { id: 'a' }, position: { x: 0, y: 0 } }],
      });
      const registered = [];
      const unregistered = [];

      cy._animations.attachDriver({
        register: (id, writes) => registered.push({ id, writes }),
        unregister: (id) => unregistered.push(id),
      });

      return { cy, registered, unregistered };
    };
    const fill = (cy) =>
      Array.from(cy._store.column('node.fillColor').subarray(0, 4));

    it('registers one write per tweened column and leaves the CPU columns alone', function () {
      const { cy, registered } = setup();

      cy.$id('a').animate({
        style: { 'background-color': 'rgb(255,0,0)' },
        position: { x: 100, y: 0 },
        duration: 100,
        easing: 'linear',
      });

      cy._animations.tick(0);

      expect(registered).to.have.length(1);
      expect(registered[0].writes.map((w) => w.column)).to.have.members([
        'node.fillColor',
        'node.position',
      ]);

      // mid-flight the device owns both columns: CPU reads stay at the start
      cy._animations.tick(50);
      expect(cy.$id('a').position('x')).to.equal(0);
      expect(fill(cy)).to.deep.equal([153, 153, 153, 255]); // still #999
    });

    it('settles the exact final value on the CPU when it completes', function () {
      const { cy, unregistered } = setup();

      cy.$id('a').animate({
        style: { 'background-color': 'rgb(255,0,0)' },
        position: { x: 100, y: 0 },
        duration: 100,
        easing: 'linear',
      });

      cy._animations.tick(0);
      cy._animations.tick(100);

      expect(unregistered).to.have.length(1);
      expect(cy.$id('a').position('x')).to.equal(100);
      expect(fill(cy)).to.deep.equal([255, 0, 0, 255]);
      expect(cy.$id('a').animated()).to.be.false;
    });

    it('honours the delay before capturing, as the CPU path does', function () {
      const { cy, registered } = setup();

      cy.$id('a').animate({
        position: { x: 100, y: 0 },
        duration: 100,
        delay: 200,
      });

      cy._animations.tick(0);
      cy._animations.tick(100);
      expect(registered).to.have.length(0); // still in the delay

      cy._animations.tick(200);
      expect(registered).to.have.length(1);
    });

    it('stop(true) releases the lease and lands on the target', function () {
      const { cy, unregistered } = setup();

      cy.$id('a').animate({
        position: { x: 100, y: 0 },
        duration: 1e6,
        easing: 'linear',
      });
      cy._animations.tick(0);

      cy.$id('a').stop(true, true);

      expect(unregistered).to.have.length(1);
      expect(cy.$id('a').position('x')).to.equal(100);
    });

    it('stop() releases the lease and writes back, rather than leaving the columns behind', function () {
      const { cy, unregistered } = setup();

      cy.$id('a').animate({
        position: { x: 100, y: 0 },
        duration: 1e6,
        easing: 'linear',
      });
      cy._animations.tick(0);

      cy.$id('a').stop();

      // released, finished, and the CPU carries a value the device can't
      // silently disagree with any more
      expect(unregistered).to.have.length(1);
      expect(cy.$id('a').animated()).to.be.false;
      expect(cy.$id('a').position('x')).to.be.a('number');
    });

    it('keeps a geometry channel on the CPU path even with a sink attached', function () {
      const { cy, registered } = setup();

      cy.$id('a').animate({
        style: { 'border-width': 10 },
        duration: 100,
        easing: 'linear',
      });

      cy._animations.tick(0);
      cy._animations.tick(50);

      expect(registered).to.have.length(0);
      expect(cy._store.column('node.borderWidth')[0]).to.be.closeTo(5, 1e-4);
    });
  });

  describe('AnimationManager concurrency (round 21 — no queue)', function () {
    it('an overlapping animation evicts the running one in place', function () {
      const store = new GraphStore();
      store.addNode('a', 0, 0);
      const ref = store.ref('nodes', store.lookup('a').slot);
      const mgr = new AnimationManager(() => {});
      const first = new Animation(store, null, [ref], false, {
        position: { x: 100, y: 0 },
        duration: 100,
        easing: 'linear',
      });

      mgr.start(first);

      const x = () => store.column('node.position')[ref.slot * 2];
      const y = () => store.column('node.position')[ref.slot * 2 + 1];

      mgr.tick(0);
      mgr.tick(50);
      expect(x()).to.be.closeTo(50, 1e-4);

      // both touch node.position: starting the second stops the first
      // where it got to (its promise resolves; no jump to end)
      mgr.start(
        new Animation(store, null, [ref], false, {
          position: { y: 100 },
          duration: 100,
          easing: 'linear',
        }),
      );

      expect(first.done).to.be.true;
      expect(x()).to.be.closeTo(50, 1e-4); // frozen, not 100

      mgr.tick(50); // second captures from the frozen state
      mgr.tick(150);
      expect(x()).to.be.closeTo(50, 1e-4);
      expect(y()).to.equal(100);
      expect(mgr.active()).to.be.false;
    });

    it('disjoint channels run concurrently on one element', function () {
      const cy = cytoscape({
        elements: [{ data: { id: 'a' }, position: { x: 0, y: 0 } }],
      });

      cy.$id('a').animate({
        position: { x: 100, y: 0 },
        duration: 100,
        easing: 'linear',
      });
      cy.$id('a').animate({
        style: { opacity: 0 },
        duration: 200,
        easing: 'linear',
      });

      cy._animations.tick(0);
      cy._animations.tick(50);

      expect(cy.$id('a').position('x')).to.be.closeTo(50, 1e-4); // both mid-flight
      expect(cy.$id('a').numericStyle('opacity')).to.be.closeTo(0.75, 1e-3);

      cy._animations.tick(100); // position done, opacity still going
      expect(cy.$id('a').position('x')).to.equal(100);
      expect(cy.$id('a').animated()).to.be.true;

      cy._animations.tick(200);
      expect(cy.$id('a').numericStyle('opacity')).to.equal(0);
      expect(cy.$id('a').animated()).to.be.false;
    });

    it('stop() stops every running animation on the element', function () {
      const cy = cytoscape({
        elements: [{ data: { id: 'a' }, position: { x: 0, y: 0 } }],
      });

      cy.$id('a').animate({
        position: { x: 100, y: 0 },
        duration: 100,
        easing: 'linear',
      });
      cy.$id('a').animate({
        style: { opacity: 0 },
        duration: 100,
        easing: 'linear',
      });

      cy._animations.tick(0);
      cy._animations.tick(50);
      cy.$id('a').stop();

      expect(cy.$id('a').animated()).to.be.false;
      expect(cy.$id('a').position('x')).to.be.closeTo(50, 1e-4); // frozen where it was
      expect(cy.$id('a').numericStyle('opacity')).to.be.closeTo(0.5, 1e-2);

      cy._animations.tick(100); // nothing left to advance
      expect(cy.$id('a').position('x')).to.be.closeTo(50, 1e-4);
    });

    it('a delay() pause never evicts a concurrent animation', function () {
      const cy = cytoscape({
        elements: [{ data: { id: 'a' }, position: { x: 0, y: 0 } }],
      });

      cy.$id('a').animate({
        position: { x: 100, y: 0 },
        duration: 100,
        easing: 'linear',
      });
      cy.$id('a').delay(50); // a no-op tween: touches no channels

      cy._animations.tick(0);
      cy._animations.tick(100);
      expect(cy.$id('a').position('x')).to.equal(100); // ran to completion
    });

    it('delayAnimation() is delay() with a handle (29.2)', async function () {
      const cy = cytoscape({
        elements: [{ data: { id: 'a' }, position: { x: 0, y: 0 } }],
      });

      // the handle form is what makes a delay sequenceable: delay()
      // chains, delayAnimation() gives you something to await
      const ani = cy.$id('a').delayAnimation(20);

      expect(typeof ani.play).to.equal('function');

      const done = ani.play();

      expect(cy.$id('a').animated()).to.equal(true);

      await done;

      expect(cy.$id('a').animated()).to.equal(false);
      expect(cy.$id('a').position()).to.deep.equal({ x: 0, y: 0 }); // touched no channel

      cy.destroy();
    });

    it('a delayAnimation() owns no channels, so it evicts nothing', function () {
      const cy = cytoscape({
        elements: [{ data: { id: 'a' }, position: { x: 0, y: 0 } }],
      });

      cy.$id('a').animate({
        position: { x: 100, y: 0 },
        duration: 100,
        easing: 'linear',
      });
      cy.$id('a').delayAnimation(50).play();

      cy._animations.tick(0);
      cy._animations.tick(100);

      expect(cy.$id('a').position('x')).to.equal(100); // ran to completion

      cy.destroy();
    });

    it('viewport pan and zoom animations compose; a second pan evicts the first', function () {
      const cy = cytoscape({ elements: [] });

      cy.pan({ x: 0, y: 0 });
      cy.zoom(1);
      cy.animate({ pan: { x: 100, y: 0 }, duration: 100, easing: 'linear' });
      cy.animate({ zoom: 2, duration: 200, easing: 'linear' }); // disjoint: composes

      cy._animations.tick(0);
      cy._animations.tick(50);
      expect(cy.pan().x).to.be.closeTo(50, 1e-4);
      expect(cy.zoom()).to.be.closeTo(1.25, 1e-4);

      cy.animate({ pan: { x: 0, y: 100 }, duration: 100, easing: 'linear' }); // evicts the pan, not the zoom

      cy._animations.tick(50);
      cy._animations.tick(150);
      expect(cy.pan().x).to.be.closeTo(0, 1e-4);
      expect(cy.pan().y).to.be.closeTo(100, 1e-4);

      cy._animations.tick(200);
      expect(cy.zoom()).to.equal(2); // the zoom ran undisturbed
      expect(cy.animated()).to.be.false;
    });

    it('the v3 queue/step option spellings throw', function () {
      const cy = cytoscape({
        elements: [{ data: { id: 'a' }, position: { x: 0, y: 0 } }],
      });

      expect(() =>
        cy.$id('a').animate({ position: { x: 1 }, queue: false }),
      ).to.throw(/queue/);
      expect(() =>
        cy.$id('a').animate({ position: { x: 1 }, step: () => {} }),
      ).to.throw(/step/);
    });
  });

  describe('collection + core surface', function () {
    const drive = (cy, ...times) => {
      for (const t of times) {
        cy._animations.tick(t);
      }
    };

    it('animates element position and reports animated()', function () {
      const cy = cytoscape({
        elements: [{ data: { id: 'a' }, position: { x: 0, y: 0 } }],
      });

      cy.$id('a').animate({
        position: { x: 60, y: 0 },
        duration: 100,
        easing: 'linear',
      });

      expect(cy.$id('a').animated()).to.be.true;

      drive(cy, 0, 50);
      expect(cy.$id('a').position('x')).to.be.closeTo(30, 1e-4);

      drive(cy, 100);
      expect(cy.$id('a').position('x')).to.equal(60);
      expect(cy.$id('a').animated()).to.be.false;
    });

    it('resolves the animation promise on complete', async function () {
      const cy = cytoscape({
        elements: [{ data: { id: 'a' }, position: { x: 0, y: 0 } }],
      });
      let done = false;
      const p = cy
        .$id('a')
        .animation({ position: { x: 10, y: 0 }, duration: 50 })
        .play();

      p.then(() => {
        done = true;
      });

      cy._animations.tick(0);
      cy._animations.tick(50);
      await p;

      expect(done).to.be.true;
    });

    it('calls the complete callback', function () {
      const cy = cytoscape({
        elements: [{ data: { id: 'a' }, position: { x: 0, y: 0 } }],
      });
      let called = false;

      cy.$id('a').animate({
        position: { x: 10, y: 0 },
        duration: 50,
        complete: () => {
          called = true;
        },
      });

      cy._animations.tick(0);
      cy._animations.tick(50);
      expect(called).to.be.true;
    });

    it('animates the viewport pan and zoom', function () {
      const cy = cytoscape({ elements: [] });

      cy.pan({ x: 0, y: 0 });
      cy.zoom(1);
      cy.animate({
        pan: { x: 100, y: 0 },
        zoom: 2,
        duration: 100,
        easing: 'linear',
      });

      expect(cy.animated()).to.be.true;

      cy._animations.tick(0);
      cy._animations.tick(50);
      expect(cy.pan().x).to.be.closeTo(50, 1e-4);
      expect(cy.zoom()).to.be.closeTo(1.5, 1e-4);

      cy._animations.tick(100);
      expect(cy.zoom()).to.equal(2);
      expect(cy.animated()).to.be.false;
    });

    it('forbids grabbing an element while it animates (pointer canDrag)', function () {
      const cy = cytoscape({
        elements: [{ data: { id: 'a' }, position: { x: 0, y: 0 } }],
      });
      const ref = cy.$id('a')._refs[0];

      cy.$id('a').animate({ position: { x: 50, y: 0 }, duration: 100 });

      expect(cy._animations.isAnimating(ref)).to.be.true;

      cy._animations.tick(0);
      cy._animations.tick(100);

      expect(cy._animations.isAnimating(ref)).to.be.false;
    });
  });
});
