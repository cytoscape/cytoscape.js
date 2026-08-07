import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { IMAGE_KIND_SDF } from '../src/image-registry.mjs';

// round 15.2: background-image props + model — per-node image-list blob
// records, registry refcount lifecycle, the 16-prop parse/readback
// surface, and the mapper rules (single-image forms of background-image,
// -image-opacity and -image-color; every list form constants-only).
// The draw path is 15.3.

const mk = (style, elements) =>
  cytoscape({
    elements: elements ?? [{ data: { id: 'a' } }, { data: { id: 'b' } }],
    style,
  });

const recsOf = (cy, id) => cy._store.nodeImagesAt(cy._store.lookup(id).slot);

describe('gpu/style: background images (round 15.2)', function () {
  it('stores image records and dedups urls through the registry', function () {
    const cy = mk({
      nodes: {
        'background-image': 'i.png',
        'background-fit': 'cover',
        'background-image-opacity': 0.5,
      },
    });

    const recs = recsOf(cy, 'a');

    expect(recs.length).to.equal(1);
    expect(recs[0].url).to.equal('i.png');
    expect(recs[0].fit).to.equal(2); // cover
    expect(recs[0].opacity).to.be.closeTo(0.5, 1e-6);

    // both nodes share one registry entry
    expect(cy._store.images.liveCount()).to.equal(1);
    expect(cy._store.images.get(recs[0].entryId).refCount).to.equal(2);
  });

  it('applies v3 defaults per image', function () {
    const cy = mk({ nodes: { 'background-image': 'i.png' } });
    const rec = recsOf(cy, 'a')[0];

    expect(rec.fit).to.equal(0); // none
    expect(rec.clip).to.equal(1); // node
    expect(rec.containment).to.equal(0); // inside
    expect(rec.smoothing).to.equal(true);
    expect(rec.repeat).to.equal(0); // no-repeat
    expect(rec.opacity).to.equal(1);
    expect(rec.posX).to.deep.equal({ v: 50, pct: true });
    expect(rec.posY).to.deep.equal({ v: 50, pct: true });
    expect(rec.offX).to.deep.equal({ v: 0, pct: false });
    expect(rec.w).to.deep.equal({ mode: 0, v: 0 }); // auto
    expect(rec.h).to.deep.equal({ mode: 0, v: 0 });
    expect(rec.sdf).to.equal(false);
    expect(cy._store.images.get(rec.entryId).crossOrigin).to.equal('anonymous');
  });

  it('distributes list values per image, last value repeating', function () {
    const cy = mk({
      nodes: {
        'background-image': ['a.png', 'b.png', 'c.png'],
        'background-fit': ['contain', 'cover'],
        'background-image-opacity': [0.25],
        'background-width': [20, '50%', 'auto'],
        'background-position-x': ['10%', 30],
      },
    });

    const recs = recsOf(cy, 'a');

    expect(recs.map((r) => r.url)).to.deep.equal(['a.png', 'b.png', 'c.png']);
    expect(recs.map((r) => r.fit)).to.deep.equal([1, 2, 2]);
    expect(recs.map((r) => r.opacity)).to.deep.equal([0.25, 0.25, 0.25]);
    expect(recs.map((r) => r.w)).to.deep.equal([
      { mode: 1, v: 20 },
      { mode: 2, v: 50 },
      { mode: 0, v: 0 },
    ]);
    expect(recs.map((r) => r.posX)).to.deep.equal([
      { v: 10, pct: true },
      { v: 30, pct: false },
      { v: 30, pct: false },
    ]);
  });

  it('caps at 4 images per node with a warning', function () {
    const warnings = [];
    const origWarn = console.warn;

    console.warn = (...args) => warnings.push(args.join(' '));

    try {
      const cy = mk({
        nodes: {
          'background-image': ['1.png', '2.png', '3.png', '4.png', '5.png'],
        },
      });

      expect(recsOf(cy, 'a').length).to.equal(4);
      expect(warnings.some((w) => w.includes('background-image'))).to.equal(
        true,
      );
    } finally {
      console.warn = origWarn;
    }
  });

  it("clears records on 'none' and releases the registry entries", function () {
    const cy = mk({ nodes: { 'background-image': 'i.png' } });

    expect(cy._store.images.liveCount()).to.equal(1);

    cy.style({ nodes: { 'background-image': 'none' } });

    expect(recsOf(cy, 'a')).to.equal(null);
    expect(cy._store.images.liveCount()).to.equal(0);
  });

  it('restyling to a new url swaps refcounts without dropping shared entries', function () {
    const cy = mk({ nodes: { 'background-image': 'old.png' } });
    const oldId = recsOf(cy, 'a')[0].entryId;

    cy.style({ nodes: { 'background-image': 'new.png' } });

    expect(cy._store.images.get(oldId)).to.equal(null); // fully released
    expect(cy._store.images.liveCount()).to.equal(1);
    expect(recsOf(cy, 'a')[0].url).to.equal('new.png');
  });

  it('rejects image props on the edges group', function () {
    expect(() => mk({ edges: { 'background-image': 'x.png' } })).to.throw(
      /node style property/,
    );
    expect(() => mk({ edges: { 'background-fit': 'cover' } })).to.throw(
      /node style property/,
    );
  });

  it('throws on the unported relative-to props', function () {
    expect(() =>
      mk({ nodes: { 'background-width-relative-to': 'inner' } }),
    ).to.throw(/not supported|unsupported/);
  });

  it('maps background-image per element via data (the photo-per-node case)', function () {
    const cy = mk({ nodes: { 'background-image': { data: 'photo' } } }, [
      { data: { id: 'a', photo: 'a.jpg' } },
      { data: { id: 'b', photo: 'b.jpg' } },
      { data: { id: 'c' } }, // no photo -> no image
    ]);

    expect(recsOf(cy, 'a')[0].url).to.equal('a.jpg');
    expect(recsOf(cy, 'b')[0].url).to.equal('b.jpg');
    expect(recsOf(cy, 'c')).to.equal(null);
    expect(cy._store.images.liveCount()).to.equal(2);

    // a data write refreshes the mapped channel and swaps refcounts
    cy.$id('a').data('photo', 'b.jpg');

    expect(recsOf(cy, 'a')[0].url).to.equal('b.jpg');
    expect(cy._store.images.liveCount()).to.equal(1);
    expect(cy._store.images.get(recsOf(cy, 'b')[0].entryId).refCount).to.equal(
      2,
    );
  });

  it('picks urls with a case mapper (icon-per-type)', function () {
    const cy = mk(
      {
        nodes: {
          'background-image': {
            case: [{ when: { data: 'type', eq: 'gene' }, then: 'gene.svg' }],
            else: 'other.svg',
          },
        },
      },
      [
        { data: { id: 'a', type: 'gene' } },
        { data: { id: 'b', type: 'drug' } },
      ],
    );

    expect(recsOf(cy, 'a')[0].url).to.equal('gene.svg');
    expect(recsOf(cy, 'b')[0].url).to.equal('other.svg');
  });

  it('maps urls through an ordinal scale (the icon-per-type bench form)', function () {
    const cy = mk(
      {
        nodes: {
          'background-image': {
            data: 'itype',
            scale: 'ordinal',
            domain: [0, 1, 2],
            range: ['a.png', 'b.png', 'c.png'],
          },
        },
      },
      [
        { data: { id: 'a', itype: 0 } },
        { data: { id: 'b', itype: 2 } },
        { data: { id: 'c', itype: 9 } }, // outside the domain -> no image
      ],
    );

    expect(recsOf(cy, 'a')[0].url).to.equal('a.png');
    expect(recsOf(cy, 'b')[0].url).to.equal('c.png');
    expect(recsOf(cy, 'c')).to.equal(null);
  });

  it('rejects mappers on list-only image props', function () {
    expect(() =>
      mk({
        nodes: {
          'background-image': 'i.png',
          'background-fit': { data: 'f' },
        },
      }),
    ).to.throw(/mapper/i);
  });

  it('reads back stored truth', function () {
    const cy = mk({
      nodes: {
        'background-image': 'i.png',
        'background-fit': 'cover',
        'background-position-x': '25%',
        'background-offset-y': 4,
        'background-width': 20,
        'background-repeat': 'repeat-x',
        'background-clip': 'none',
        'background-image-containment': 'over',
        'background-image-smoothing': 'no',
        'background-image-opacity': 0.5,
      },
    });
    const a = cy.$id('a');

    expect(a.style('background-image')).to.equal('i.png');
    expect(a.style('background-fit')).to.equal('cover');
    expect(a.style('background-position-x')).to.equal('25%');
    expect(a.style('background-offset-y')).to.equal(4);
    expect(a.style('background-width')).to.equal(20);
    expect(a.style('background-repeat')).to.equal('repeat-x');
    expect(a.style('background-clip')).to.equal('none');
    expect(a.style('background-image-containment')).to.equal('over');
    expect(a.style('background-image-smoothing')).to.equal('no');
    expect(a.style('background-image-opacity')).to.equal(0.5);

    // imageless nodes read the v3 defaults
    const cy2 = mk({});
    const b = cy2.$id('a');

    expect(b.style('background-image')).to.equal('none');
    expect(b.style('background-fit')).to.equal('none');
    expect(b.style('background-position-x')).to.equal('50%');
    expect(b.style('background-width')).to.equal('auto');
  });

  it('reads multi-image values back as space-joined lists', function () {
    const cy = mk({
      nodes: {
        'background-image': ['a.png', 'b.png'],
        'background-fit': ['contain', 'cover'],
      },
    });
    const a = cy.$id('a');

    expect(a.style('background-image')).to.equal('a.png b.png');
    expect(a.style('background-fit')).to.equal('contain cover');
  });

  it('stores the sdf icon type with its tint', function () {
    const cy = mk({
      nodes: {
        'background-image': 'icon.svg',
        'background-image-type': 'sdf-icon',
        'background-image-color': 'red',
      },
    });
    const rec = recsOf(cy, 'a')[0];

    expect(rec.sdf).to.equal(true);
    expect(rec.tint).to.deep.equal([255, 0, 0, 255]);
    expect(cy._store.images.get(rec.entryId).kind).to.equal(IMAGE_KIND_SDF);
    expect(cy.$id('a').style('background-image-type')).to.equal('sdf-icon');
  });

  it('acquires with the styled crossorigin', function () {
    const cy = mk({
      nodes: {
        'background-image': 'i.png',
        'background-image-crossorigin': 'use-credentials',
      },
    });
    const rec = recsOf(cy, 'a')[0];

    expect(cy._store.images.get(rec.entryId).crossOrigin).to.equal(
      'use-credentials',
    );
  });

  it('releases refs when a node is removed', function () {
    const cy = mk({ nodes: { 'background-image': 'i.png' } });

    cy.$id('a').remove();
    expect(cy._store.images.liveCount()).to.equal(1);
    expect(cy._store.images.get(recsOf(cy, 'b')[0].entryId).refCount).to.equal(
      1,
    );

    cy.$id('b').remove();
    expect(cy._store.images.liveCount()).to.equal(0);
  });

  it('keeps every per-image prop independent across the list (15.4)', function () {
    const cy = mk({
      nodes: {
        'background-image': ['a.png', 'b.svg', 'c.png', 'd.png'],
        'background-fit': ['none', 'contain', 'cover', 'none'],
        'background-repeat': ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'],
        'background-clip': ['node', 'none', 'node', 'none'],
        'background-image-containment': ['inside', 'over', 'inside', 'over'],
        'background-image-smoothing': ['yes', 'no', 'yes', 'no'],
        'background-image-type': ['auto', 'sdf-icon', 'auto', 'auto'],
      },
    });
    const recs = recsOf(cy, 'a');

    expect(recs.map((r) => r.fit)).to.deep.equal([0, 1, 2, 0]);
    expect(recs.map((r) => r.repeat)).to.deep.equal([0, 3, 1, 2]);
    expect(recs.map((r) => r.clip)).to.deep.equal([1, 0, 1, 0]);
    expect(recs.map((r) => r.containment)).to.deep.equal([0, 1, 0, 1]);
    expect(recs.map((r) => r.smoothing)).to.deep.equal([
      true,
      false,
      true,
      false,
    ]);
    expect(recs.map((r) => r.sdf)).to.deep.equal([false, true, false, false]);
    // four distinct urls = four registry entries (the sdf one keyed apart)
    expect(cy._store.images.liveCount()).to.equal(4);
  });

  it('packs the imageRef column and reports blob dirt in the delta', function () {
    const cy = mk({});

    cy._store.takeDelta(); // drain

    cy.style({ nodes: { 'background-image': ['a.png', 'b.png'] } });

    const delta = cy._store.takeDelta();

    expect(delta.imageBlob).to.be.an('object');

    const slot = cy._store.lookup('a').slot;
    const ref = cy._store.column('node.imageRef')[slot];

    expect(ref >>> 24).to.equal(2); // count in the top byte
  });

  // round 30.1: the image family's two parser guards.  Five props share
  // `parseImageEnum` and two share `parseBgSize`; neither closure had
  // ever thrown in the suite, so a misspelled keyword and a negative
  // size were both unmeasured.
  it('rejects an unsupported keyword on the enum props', function () {
    const cases = {
      'background-fit': 'stretch',
      'background-repeat': 'round',
      'background-clip': 'border-box',
      'background-image-containment': 'outside',
      'background-image-type': 'bitmap',
    };

    for (const [prop, bad] of Object.entries(cases)) {
      expect(
        () => mk({ nodes: { 'background-image': 'i.png', [prop]: bad } }),
        prop,
      ).to.throw(new RegExp(`${prop} '${bad}' is unsupported`));
    }
  });

  it('rejects a negative background-width/-height', function () {
    expect(() =>
      mk({ nodes: { 'background-image': 'i.png', 'background-width': -5 } }),
    ).to.throw(/background-width '-5' must be non-negative/);
    expect(() =>
      mk({
        nodes: { 'background-image': 'i.png', 'background-height': '-10%' },
      }),
    ).to.throw(/background-height '-10%' must be non-negative/);

    // control: zero and 'auto' are legal sizes, so the guard is on the sign
    const ok = mk({
      nodes: {
        'background-image': 'i.png',
        'background-width': 0,
        'background-height': 'auto',
      },
    });

    expect(recsOf(ok, 'a')[0].w.v).to.equal(0);
    expect(recsOf(ok, 'a')[0].h.mode).to.equal(0); // auto
    ok.destroy();
  });

  // Round 57.2.  This guard had never fired in any suite, and the throw
  // gate said otherwise: `parseBgLen` is a module-level arrow const, the
  // shape whose body lines lcov attributes to the module-evaluation count
  // (the `MISATTRIBUTED` cause `scripts/throw-coverage.mjs` documents), so
  // it read as covered.  Reformatting the file changed the attribution and
  // the gate failed — a false pass exposed by a tool that was not looking
  // for it.  The message is asserted because the position and offset props
  // share one parser with the size props above.
  it('rejects a background-position/-offset that is neither px nor %', function () {
    for (const prop of [
      'background-position-x',
      'background-position-y',
      'background-offset-x',
      'background-offset-y',
    ]) {
      expect(
        () => mk({ nodes: { 'background-image': 'i.png', [prop]: 'middle' } }),
        prop,
      ).to.throw(new RegExp(`${prop} 'middle' must be a number of px`));
    }

    // control: all three legal spellings pass the same parser, so the
    // guard is on the *form* and not on the prop being set at all
    const ok = mk({
      nodes: {
        'background-image': 'i.png',
        'background-position-x': '25%',
        'background-position-y': '10px',
        'background-offset-x': 4,
      },
    });

    expect(recsOf(ok, 'a')[0].posX).to.deep.equal({ v: 25, pct: true });
    expect(recsOf(ok, 'a')[0].posY).to.deep.equal({ v: 10, pct: false });
    expect(recsOf(ok, 'a')[0].offX).to.deep.equal({ v: 4, pct: false });
    ok.destroy();
  });
});
