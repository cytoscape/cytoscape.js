import { expect } from 'chai';
import {
  TierAllocator,
  packImageTableRow,
  IMAGE_MAX_LAYERS,
} from '../src/render/image-arrays.mjs';
import { IMAGE_READY } from '../src/image-registry.mjs';

// round 15.3: the tier-array layer allocator and image-table packing —
// the Node-testable half of the RGBA draw path (texture uploads, mip
// generation and the FS compositing are pinned by the golden and the
// live v3 parity scene).

describe('gpu/render: image tier arrays (round 15.3)', function () {
  it('allocates layers per tier independently', function () {
    const alloc = new TierAllocator(3);

    expect(alloc.alloc(10, 0)).to.deep.include({ layer: 0 });
    expect(alloc.alloc(11, 0)).to.deep.include({ layer: 1 });
    expect(alloc.alloc(12, 2)).to.deep.include({ layer: 0 }); // other tier starts fresh

    expect(alloc.placement(11)).to.deep.equal({ tier: 0, layer: 1 });
    expect(alloc.placement(99)).to.equal(null);
  });

  it('reports growth when a tier exceeds its layer capacity', function () {
    const alloc = new TierAllocator(3);

    const first = alloc.alloc(1, 0);

    expect(first.grew).to.equal(true); // 0 -> initial capacity

    let grew = 0;

    for (let i = 2; i <= 9; i++) {
      if (alloc.alloc(i, 0).grew) {
        grew++;
      }
    }

    expect(grew).to.be.greaterThan(0); // doubled at least once
    expect(alloc.capacity(0)).to.be.at.least(9);
  });

  it('recycles freed layers', function () {
    const alloc = new TierAllocator(3);

    alloc.alloc(1, 1);
    alloc.alloc(2, 1);

    const freed = alloc.free(1);

    expect(freed).to.deep.equal({ tier: 1, layer: 0 });
    expect(alloc.free(1)).to.equal(null); // double-free is a no-op

    // the freed layer recycles before the high water grows
    expect(alloc.alloc(3, 1).layer).to.equal(0);
  });

  it('re-alloc of a live entry frees its old placement first', function () {
    const alloc = new TierAllocator(3);

    alloc.alloc(1, 0);
    alloc.alloc(1, 1); // tier promotion moves the entry

    expect(alloc.placement(1)).to.deep.equal({ tier: 1, layer: 0 });
    // the old tier-0 layer recycles
    expect(alloc.alloc(2, 0).layer).to.equal(0);
  });

  it('caps at the WebGPU base layer limit with a warning', function () {
    const warnings = [];
    const origWarn = console.warn;

    console.warn = (...args) => warnings.push(args.join(' '));

    try {
      const alloc = new TierAllocator(1);
      let failed = 0;

      for (let i = 0; i < IMAGE_MAX_LAYERS + 8; i++) {
        if (alloc.alloc(i, 0) == null) {
          failed++;
        }
      }

      expect(failed).to.equal(8);
      expect(alloc.capacity(0)).to.equal(IMAGE_MAX_LAYERS);
      expect(warnings.length).to.equal(1); // warn-once, the atlas precedent
    } finally {
      console.warn = origWarn;
    }
  });

  it('packs image table rows', function () {
    const row = packImageTableRow(
      { status: IMAGE_READY, width: 300, height: 200 },
      1,
      7,
      300,
      200,
    );

    expect(row[0] & 3).to.equal(IMAGE_READY);
    expect((row[0] >> 2) & 3).to.equal(1); // tier
    expect(row[0] >> 4).to.equal(7); // layer
    expect(row[1] & 0xffff).to.equal(300); // natural dims
    expect(row[1] >>> 16).to.equal(200);
    expect(row[2] & 0xffff).to.equal(300); // raster dims (uv scaling)
    expect(row[2] >>> 16).to.equal(200);
  });
});
