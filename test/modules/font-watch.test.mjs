import { expect } from 'chai';
import {
  facesTouchFont,
  familiesOf,
  fontSettled,
  normalizeFamily,
} from '../../src/render/font-watch.mjs';
import { addedLoadedFace } from '../../src/render/renderer/fonts.mjs';

// Round 75.2: which web-font events re-raster the glyph atlas.  The
// filter's failure mode is silent — a normalization that misses a
// spelling suppresses a legitimate re-raster and the labels stay in the
// fallback face — so the spellings the browser actually hands over are
// pinned here: Chromium reports a loadingdone face's family *quoted*
// ("\"Late Font\"", measured 2026-09-28).  The browser half (the round-10
// late-font spec and the 75.2 specs in renderer.spec.js) carries the
// end-to-end control: the filter forced false fails the late-font spec.

describe('font watch (round 75.2)', function () {
  it('normalizes a family: quotes, case, whitespace', function () {
    expect(normalizeFamily('"Late Font"')).to.equal('late font');
    expect(normalizeFamily("'Late Font'")).to.equal('late font');
    expect(normalizeFamily('  Late   FONT ')).to.equal('late font');
    // mismatched quotes are not stripped
    expect(normalizeFamily('"Late Font\'')).to.equal('"late font\'');
  });

  it('splits a font-family list, honouring quoted commas', function () {
    expect(familiesOf(`'Open Sans', Helvetica, sans-serif`)).to.deep.equal([
      'open sans',
      'helvetica',
      'sans-serif',
    ]);
    expect(familiesOf(`"Odd, Name", serif`)).to.deep.equal([
      'odd, name',
      'serif',
    ]);
    expect(familiesOf('')).to.deep.equal([]);
  });

  it('re-rasters for a face the atlas names, in any spelling the event uses', function () {
    const list = `'Late Font', sans-serif`;

    expect(facesTouchFont([{ family: '"Late Font"' }], list)).to.equal(true);
    expect(facesTouchFont([{ family: 'late font' }], list)).to.equal(true);
    expect(
      facesTouchFont([{ family: 'Icons' }, { family: 'Late Font' }], list),
    ).to.equal(true);
  });

  it('skips a face the atlas does not name', function () {
    expect(
      facesTouchFont(
        [{ family: '"Material Icons"' }],
        `'Late Font', sans-serif`,
      ),
    ).to.equal(false);
  });

  it('is conservative without a readable payload', function () {
    const list = 'sans-serif';

    expect(facesTouchFont(undefined, list)).to.equal(true);
    expect(facesTouchFont(null, list)).to.equal(true);
    expect(facesTouchFont([], list)).to.equal(true);
    expect(facesTouchFont([{}], list)).to.equal(true);
  });

  it('answers settled where there is no FontFaceSet (Node)', function () {
    expect(fontSettled('16px sans-serif')).to.equal(true);
  });

  it('finds a face added already loaded, once', function () {
    const make = (family, status) => ({ family, status });
    const faces = [make('"Other"', 'loaded')];
    const set = { forEach: (fn) => faces.forEach((f) => fn(f)) };
    const seen = new WeakSet();

    // the census seeds with what is there
    expect(addedLoadedFace(set, seen, `'Late Font', sans-serif`)).to.equal(
      false,
    );

    // an unrelated face, then an unloaded one, concern nothing
    faces.push(make('Icons', 'loaded'), make('Late Font', 'loading'));
    expect(addedLoadedFace(set, seen, `'Late Font', sans-serif`)).to.equal(
      false,
    );

    // the orphan order: loaded before it was added
    faces.push(make('"Late Font"', 'loaded'));
    expect(addedLoadedFace(set, seen, `'Late Font', sans-serif`)).to.equal(
      true,
    );
    // and it is accounted for: the next check does not re-raster again
    expect(addedLoadedFace(set, seen, `'Late Font', sans-serif`)).to.equal(
      false,
    );
  });
});
