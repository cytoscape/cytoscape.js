import { expect } from 'chai';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { compareToGolden } from '../../playwright-tests/lib/image-diff.mjs';
import { diffPngs, goldenComparison } from '../../scripts/golden-images.mjs';
import { planGoldens } from '../../scripts/status/goldens-page.mjs';
import { enumerateRefs } from '../../scripts/status/refs.mjs';

const white = (width = 8, height = 8) => {
  const png = new PNG({ width, height });
  png.data.fill(255);
  return png;
};
const pixel = (png, x, y) => [
  ...png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 4),
];

describe('golden references and latest tested captures', () => {
  let root;
  let options;
  let update;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'golden-images-'));
    options = {
      goldensDir: join(root, 'playwright-tests', 'goldens'),
      currentDir: join(root, 'playwright-tests', 'golden-current'),
    };
    mkdirSync(options.goldensDir, { recursive: true });
    writeFileSync(
      join(options.goldensDir, 'scene.png'),
      PNG.sync.write(white()),
    );
    writeFileSync(
      join(root, 'playwright-tests', 'visual.spec.js'),
      "test('golden: scene', () => { checkGolden(page, 'scene', uri); });",
    );
    update = process.env.UPDATE_GOLDENS;
    delete process.env.UPDATE_GOLDENS;
  });

  afterEach(() => {
    if (update == null) delete process.env.UPDATE_GOLDENS;
    else process.env.UPDATE_GOLDENS = update;
    rmSync(root, { recursive: true, force: true });
  });

  it('retains failing and passing captures without approving either automatically', () => {
    const reference = readFileSync(join(options.goldensDir, 'scene.png'));
    const changed = white();
    changed.data.set([0, 0, 0, 255], (3 * changed.width + 3) * 4);

    expect(() => compareToGolden('scene', changed, options)).to.throw('1 px');
    expect(readFileSync(join(options.goldensDir, 'scene.png'))).to.deep.equal(
      reference,
    );
    expect(
      pixel(
        PNG.sync.read(readFileSync(join(options.currentDir, 'scene.png'))),
        3,
        3,
      ),
    ).to.deep.equal([0, 0, 0, 255]);
    const metadata = JSON.parse(
      readFileSync(join(options.currentDir, 'scene.json'), 'utf8'),
    );
    expect(metadata.threshold).to.equal(0);
    expect(Number.isFinite(Date.parse(metadata.testedAt))).to.equal(true);

    expect(compareToGolden('scene', white(), options).ratio).to.equal(0);
    expect(readFileSync(join(options.currentDir, 'scene.png'))).to.deep.equal(
      reference,
    );
  });

  it('keeps captures when the reference is missing or its dimensions differ', () => {
    expect(() => compareToGolden('missing', white(), options)).to.throw(
      'No golden image',
    );
    expect(
      PNG.sync.read(readFileSync(join(options.currentDir, 'missing.png')))
        .width,
    ).to.equal(8);
    expect(() => compareToGolden('scene', white(4, 8), options)).to.throw(
      'Image dimensions differ',
    );
    expect(
      PNG.sync.read(readFileSync(join(options.currentDir, 'scene.png'))).width,
    ).to.equal(4);
  });

  it('updates both images only when reference regeneration is explicit', () => {
    process.env.UPDATE_GOLDENS = '1';
    compareToGolden('scene', white(4, 4), options);
    expect(readFileSync(join(options.currentDir, 'scene.png'))).to.deep.equal(
      readFileSync(join(options.goldensDir, 'scene.png')),
    );
  });

  it('counts the same changed pixels as the test and highlights a single pixel in neon', () => {
    const now = white();
    now.data.set([0, 0, 0, 255], (3 * now.width + 3) * 4);
    const comparison = goldenComparison(now, white());

    expect(comparison.mismatched).to.equal(1);
    expect(comparison.mismatched).to.equal(
      diffPngs(now, white(), { threshold: 0 }).mismatched,
    );
    expect(pixel(comparison.diff, 3, 3)).to.deep.equal([255, 0, 255, 255]);
    expect(pixel(comparison.diff, 2, 3)).to.deep.equal([130, 20, 150, 255]);
    expect(pixel(comparison.diff, 7, 7)).to.deep.equal([74, 74, 74, 255]);
    expect(goldenComparison(white(), white()).mismatched).to.equal(0);
  });

  it('shows and counts missing image area, even when that area is transparent', () => {
    const now = new PNG({ width: 8, height: 8 });
    const gold = new PNG({ width: 4, height: 8 });
    const comparison = goldenComparison(now, gold);

    expect(comparison.sizeChanged).to.equal(true);
    expect(comparison.mismatched).to.equal(32);
    expect(pixel(comparison.diff, 7, 7)).to.deep.equal([255, 0, 255, 255]);
  });

  it('plans reference, latest and derived diff assets with a visible nonzero count', () => {
    const now = white();
    now.data.set([0, 0, 0, 255], (3 * now.width + 3) * 4);
    expect(() => compareToGolden('scene', now, options)).to.throw();
    const plan = planGoldens({ root });

    expect(plan.orphans).to.deep.equal([]);
    expect(plan.count).to.equal(1);
    expect(plan.ops.map((op) => op.to)).to.deep.equal([
      'goldens/scene.png',
      'goldens/current/scene.png',
      'goldens/diff/scene.png',
    ]);
    expect(plan.html).to.contain('golden-metric changed');
    expect(plan.html).to.contain('1 px differ');
    const diff = PNG.sync.read(
      plan.ops.find((op) => op.to === 'goldens/diff/scene.png').text,
    );
    expect(pixel(diff, 3, 3)).to.deep.equal([255, 0, 255, 255]);
    const refs = enumerateRefs([
      ...plan.ops,
      { kind: 'write', to: 'goldens.html', text: plan.html },
    ]);
    expect(
      refs.every((ref) => plan.ops.some((op) => op.to === ref.resolved)),
    ).to.equal(true);
  });

  it('reports untested references instead of inventing a matching current image', () => {
    const plan = planGoldens({ root });
    expect(plan.html).to.contain('Not tested yet');
    expect(plan.html).to.contain(
      'data-golden-select="now" aria-pressed="false" disabled',
    );
    expect(plan.html).to.not.contain('0 px differ');
    expect(plan.ops).to.have.length(1);
  });
});
