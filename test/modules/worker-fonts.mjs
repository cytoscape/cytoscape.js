import { expect } from 'chai';
import {
  registerWorkerFonts,
  wireFonts,
} from '../../src/render/worker-fonts.mjs';
import { facesLanded } from '../../src/render/renderer/fonts.mjs';

// Round 141 (ledger item 51): the worker host's label fonts.  The
// browser half — a listed face reaching worker-rastered labels, and the
// worker canvas mechanics in Chromium and WebKit — is in
// playwright-tests/worker-renderer.spec.js.  This half pins the parts
// with no browser in them: the list's wire form, the registration's
// accounting against a stub FontFaceSet, and the re-raster filter.

/** A stub FontFace / FontFaceSet pair, installed on globalThis. */
const installStubs = ({ failLoad = [] } = {}) => {
  const added = [];
  const saved = {
    FontFace: globalThis.FontFace,
    fonts: globalThis.fonts,
    fetch: globalThis.fetch,
  };

  globalThis.FontFace = class {
    constructor(family, source, descriptors) {
      this.family = family;
      this.source = source;
      this.descriptors = descriptors;
      this.status = 'unloaded';
    }

    async load() {
      if (failLoad.includes(this.family)) {
        throw new Error('bad font data');
      }

      this.status = 'loaded';

      return this;
    }
  };
  globalThis.fonts = { add: (face) => added.push(face) };
  globalThis.fetch = async (url) =>
    url.endsWith('missing.woff2')
      ? { ok: false, status: 404 }
      : { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };

  return {
    added,
    restore: () => {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) {
          delete globalThis[key];
        } else {
          globalThis[key] = value;
        }
      }
    },
  };
};

describe('worker host fonts (round 141)', function () {
  it('puts the list in wire form: urls resolved, bytes passed, descriptors kept', function () {
    const bytes = new Uint8Array([1, 2, 3]);
    const wire = wireFonts(
      [
        { family: 'Open Sans', source: 'fonts/os.woff2', weight: '700' },
        { family: 'Inline', source: bytes, style: 'italic' },
      ],
      'https://example.test/app/index.html',
    );

    expect(wire).to.deep.equal([
      {
        family: 'Open Sans',
        source: 'https://example.test/app/fonts/os.woff2',
        descriptors: { weight: '700' },
      },
      { family: 'Inline', source: bytes, descriptors: { style: 'italic' } },
    ]);
    expect(wireFonts(undefined, 'https://example.test/')).to.deep.equal([]);
  });

  it('rejects an entry with no family or no source, naming it', function () {
    const base = 'https://example.test/';

    expect(() => wireFonts([{ source: 'a.woff2' }], base)).to.throw(
      TypeError,
      /fonts\[0\] needs a family/,
    );
    expect(() => wireFonts([{ family: 'A', source: 12 }], base)).to.throw(
      TypeError,
      /fonts\[0\] \('A'\) needs a source/,
    );
    expect(() => wireFonts({ family: 'A' }, base)).to.throw(
      TypeError,
      /must be an array/,
    );
  });

  it('registers each face from its bytes, and reports each failure once', async function () {
    const stubs = installStubs({ failLoad: ['Broken'] });

    try {
      const landed = [];
      const errors = [];
      const result = await registerWorkerFonts(
        [
          {
            family: 'Good',
            source: 'https://x.test/good.woff2',
            descriptors: {},
          },
          { family: 'Bytes', source: new ArrayBuffer(4), descriptors: {} },
          {
            family: 'Gone',
            source: 'https://x.test/missing.woff2',
            descriptors: {},
          },
          { family: 'Broken', source: new ArrayBuffer(4), descriptors: {} },
        ],
        (face) => landed.push(face.family),
        (message) => errors.push(message),
      );

      expect(result).to.deep.equal({ loaded: 2, failed: 2 });
      expect(landed.sort()).to.deep.equal(['Bytes', 'Good']);
      // every face was built from bytes — never a url() source
      expect(stubs.added.every((f) => f.source instanceof ArrayBuffer)).to.be
        .true;
      expect(errors).to.have.length(2);
      expect(errors.join('\n')).to.match(
        /'Gone' from .*missing\.woff2.*HTTP 404/,
      );
      expect(errors.join('\n')).to.match(/'Broken'.*bad font data/);
    } finally {
      stubs.restore();
    }
  });

  it('fails the whole list loudly where the worker has no FontFaceSet', async function () {
    const errors = [];
    const result = await registerWorkerFonts(
      [{ family: 'A', source: new ArrayBuffer(1), descriptors: {} }],
      () => {},
      (message) => errors.push(message),
    );

    expect(globalThis.fonts).to.equal(undefined); // Node: no set
    expect(result).to.deep.equal({ loaded: 0, failed: 1 });
    expect(errors[0]).to.match(/no FontFaceSet in workers/);
  });

  it('re-rasters on a fresh description only for a face the atlas font names', function () {
    const calls = [];
    const rd = {
      destroyed: false,
      labelLayer: {
        atlas: { fontFamily: `'Open Sans', sans-serif` },
        reraster: (refont) => calls.push(['reraster', refont]),
      },
      requestRender: () => calls.push(['render']),
    };

    facesLanded(rd, [{ family: 'Icon Font' }]);
    expect(calls).to.deep.equal([]);

    facesLanded(rd, [{ family: 'Open Sans' }]);
    expect(calls).to.deep.equal([['reraster', true], ['render']]);

    // nothing rastered yet, or gone: nothing to do
    calls.length = 0;
    facesLanded({ ...rd, labelLayer: null }, [{ family: 'Open Sans' }]);
    facesLanded({ ...rd, destroyed: true }, [{ family: 'Open Sans' }]);
    expect(calls).to.deep.equal([]);
  });
});
