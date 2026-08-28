// Round 91: resize without distortion — the DOM-facing half of the
// renderer's sizing, exercised headless against a fake document.
//
// What Node can pin (the GPU half lives in
// playwright-tests/renderer.spec.js): `applySize` writes the canvas CSS
// box in *fixed px* (91.1 — a late frame letterboxes, never stretches),
// an 'auto' pixelRatio re-reads `devicePixelRatio` per measure while an
// explicit number stays pinned (91.2), and the matchMedia resolution
// listener arms, re-arms per change, emits `resize` on the host, and
// disarms on destroy.
//
// Controls: the pinned-ratio spec is the live-ratio spec's control (the
// same devicePixelRatio move must NOT land), and the teardown spec
// counts listeners on the fake matchMedia, so a leaked listener fails
// rather than lingering silently.

import './../node-test-setup.mjs';
import { expect } from 'chai';
import { Renderer } from '../../src/render/renderer.mjs';

const makeContainer = (w, h) => {
  const canvas = {
    style: {},
    width: 0,
    height: 0,
    remove() {},
  };
  const container = {
    clientWidth: w,
    clientHeight: h,
    style: {},
    ownerDocument: {
      createElement: () => canvas,
      defaultView: null, // skips the getComputedStyle position probe
    },
    appendChild() {},
  };

  return { container, canvas };
};

const makeHost = () => {
  const events = [];
  const host = {
    store: {
      onInvalidate: () => () => {},
      images: { setDecoder() {} },
    },
    viewport: { pan: () => ({ x: 0, y: 0 }), zoom: () => 1 },
    animations: {
      tick() {},
      active: () => false,
      attachDriver() {},
      detachDriver() {},
    },
    arrowEnds: () => ({ source: false, target: false }),
    midArrowEnds: () => ({ source: false, target: false }),
    onViewportChange: () => () => {},
    emitRender: () => events.push('render'),
    emitResize: () => events.push('resize'),
    emitError: (m) => events.push(`error:${m}`),
    gpuMappers: null,
    createImageDecoder: () => null,
  };

  return { host, events };
};

/** a matchMedia fake: records armed queries, lets specs fire changes */
const makeMatchMedia = () => {
  const queries = [];
  const fn = (query) => {
    const q = {
      query,
      listeners: [],
      addEventListener: (_type, cb) => q.listeners.push(cb),
      removeEventListener: (_type, cb) => {
        const i = q.listeners.indexOf(cb);

        if (i >= 0) {
          q.listeners.splice(i, 1);
        }
      },
      fire: () => q.listeners.slice().forEach((cb) => cb()),
    };

    queries.push(q);

    return q;
  };

  fn.queries = queries;
  fn.armed = () => queries.filter((q) => q.listeners.length > 0);

  return fn;
};

describe('renderer sizing without a GPU (round 91)', () => {
  let saved;

  beforeEach(() => {
    saved = {
      dpr: globalThis.devicePixelRatio,
      mm: globalThis.matchMedia,
      canvasCls: globalThis.HTMLCanvasElement,
    };
    // destroy() probes `instanceof HTMLCanvasElement`; the fake canvas
    // is a plain object, so any constructor will do
    globalThis.HTMLCanvasElement = class {};
  });

  afterEach(() => {
    const put = (key, value) => {
      if (value === undefined) {
        delete globalThis[key];
      } else {
        globalThis[key] = value;
      }
    };

    put('devicePixelRatio', saved.dpr);
    put('matchMedia', saved.mm);
    put('HTMLCanvasElement', saved.canvasCls);
  });

  const mount = (opts = {}, w = 800, h = 600) => {
    const { container, canvas } = makeContainer(w, h);
    const { host, events } = makeHost();
    const r = new Renderer(host, container, opts);

    // no navigator.gpu in Node, by design: readiness rejects and the
    // sizing path under test runs entirely before it
    r.ready.catch(() => {});

    return { r, container, canvas, events };
  };

  it('writes the canvas CSS box in fixed px, and re-fits on resize (91.1)', () => {
    const { r, container, canvas } = mount();

    // fixed px from the mount — never `100%`: when a frame is ever late
    // behind a layout change, a wrongly-sized canvas letterboxes where
    // a `100%` canvas stretches the stale presentation
    expect(canvas.style.width).to.equal('800px');
    expect(canvas.style.height).to.equal('600px');
    expect(canvas.width).to.equal(800);
    expect(canvas.height).to.equal(600);

    container.clientWidth = 500;
    container.clientHeight = 250;
    r.resize();

    expect(canvas.style.width).to.equal('500px');
    expect(canvas.style.height).to.equal('250px');
    expect(canvas.width).to.equal(500);
    expect(canvas.height).to.equal(250);
    r.destroy();
  });

  it("an 'auto' pixelRatio re-reads devicePixelRatio per measure (91.2)", () => {
    globalThis.devicePixelRatio = 1;

    const { r, canvas } = mount();

    expect(canvas.width).to.equal(800);

    globalThis.devicePixelRatio = 2;
    r.resize();

    // backing store at the live ratio; CSS box still in CSS px
    expect(canvas.width).to.equal(1600);
    expect(canvas.height).to.equal(1200);
    expect(canvas.style.width).to.equal('800px');
    expect(canvas.style.height).to.equal('600px');
    r.destroy();
  });

  it('control: an explicit pixelRatio stays pinned through the same move', () => {
    globalThis.devicePixelRatio = 2;

    const { r, canvas } = mount({ pixelRatio: 1 });

    expect(canvas.width).to.equal(800);

    globalThis.devicePixelRatio = 3;
    r.resize();

    expect(canvas.width).to.equal(800);
    expect(canvas.height).to.equal(600);
    r.destroy();
  });

  it('arms a matchMedia resolution query, re-arms per change, emits resize (91.2)', () => {
    globalThis.devicePixelRatio = 1;

    const mm = makeMatchMedia();

    globalThis.matchMedia = mm;

    const { r, canvas, events } = mount();

    expect(mm.queries.map((q) => q.query)).to.deep.equal([
      '(resolution: 1dppx)',
    ]);
    expect(mm.armed()).to.have.length(1);

    // the browser moved the ratio; the armed query fires
    globalThis.devicePixelRatio = 2;
    mm.queries[0].fire();

    expect(canvas.width).to.equal(1600); // re-rasterized, not blurred
    expect(events).to.include('resize'); // v3's cy.resize() semantics

    // re-armed at the new ratio, the stale query released
    expect(mm.queries.map((q) => q.query)).to.deep.equal([
      '(resolution: 1dppx)',
      '(resolution: 2dppx)',
    ]);
    expect(mm.queries[0].listeners).to.have.length(0);
    expect(mm.armed()).to.have.length(1);

    r.destroy();
    expect(mm.armed()).to.have.length(0); // no leaked listener
  });

  it('control: a pinned pixelRatio arms no resolution query', () => {
    const mm = makeMatchMedia();

    globalThis.matchMedia = mm;

    const { r } = mount({ pixelRatio: 2 });

    expect(mm.queries).to.have.length(0);
    r.destroy();
  });
});
