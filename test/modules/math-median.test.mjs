import { expect } from 'chai';
import { median } from '../../src/math.mjs';

/*
`median` in src/math.mts (affinity propagation's `preference: 'median'`)
read one slot past the middle for an odd count, as v3 did, so
median([1, 2, 3, 4, 5]) was 4; found against a NumPy reference.  It takes
the median of the finite values: non-finite entries sort first as
-Infinity holes and are skipped.
*/

describe('median', function () {
  it('takes the middle of an odd count and the mean of the middle pair of an even one', function () {
    expect(median([1, 2, 3, 4, 5])).to.equal(3);
    expect(median([5, 1, 3])).to.equal(3);
    expect(median([1, 2, 3, 4])).to.equal(2.5);
    expect(median([7])).to.equal(7);
  });

  it('sorts a typed array numerically', function () {
    expect(median(new Float64Array([10, 9, 100, 1, 2]))).to.equal(9);
  });

  it('skips non-finite holes', function () {
    expect(
      median(new Float64Array([-Infinity, -Infinity, 1, 2, 3, 4])),
    ).to.equal(2.5);
    expect(median([NaN, 2, 4, 6])).to.equal(4);
    expect(median([Infinity, 1, 2, 3])).to.equal(2);
  });

  it('leaves the input alone by default', function () {
    const input = [3, 1, 2];

    median(input);
    expect(input).to.deep.equal([3, 1, 2]);
  });
});
