import { expect } from 'chai';
import { GenerationalMemo } from '../../src/render/shape-memo.mjs';
import { SHAPE_MEMO_GENERATION } from '../../src/render/label-layer.mjs';

/*
Round 138: the label shaping memo is bounded.  The renderer soak (PLAN.md
item 34) found it unbounded — a session churning labels left every text
it had ever shaped in a Map only a font change cleared, ~15 KB of
reachable heap per churn cycle.  These specs hold the bound and the
working-set promise; the soak's heap figure is the browser half
(`benchmark/scale-ceiling.mjs --soak`, which collects before it reads).
*/

describe('the shaping memo is bounded (round 138)', function () {
  it('holds at most two generations however many keys it sees', function () {
    const memo = new GenerationalMemo(100);

    for (let i = 0; i < 10_000; i++) {
      memo.set(`label ${i}`, i);
      expect(memo.size).to.be.at.most(200);
    }

    // the control: the store it replaced keeps every key
    const unbounded = new Map();

    for (let i = 0; i < 10_000; i++) {
      unbounded.set(`label ${i}`, i);
    }

    expect(unbounded.size).to.equal(10_000);
  });

  it('keeps what was used within the last generation', function () {
    const memo = new GenerationalMemo(4);

    memo.set('a', 1);
    memo.set('b', 2);
    memo.set('c', 3);
    memo.set('d', 4); // young full: a..d become the old generation
    expect(memo.get('a')).to.equal(1); // promoted back to young
    memo.set('e', 5);
    memo.set('f', 6);
    memo.set('g', 7); // young (a, e, f, g) full: b, c, d are dropped

    expect(memo.get('a')).to.equal(1);
    expect(memo.get('g')).to.equal(7);
    expect(memo.get('b')).to.equal(undefined);
    expect(memo.get('d')).to.equal(undefined);
  });

  it('clears both generations', function () {
    const memo = new GenerationalMemo(2);

    memo.set('a', 1);
    memo.set('b', 2);
    memo.set('c', 3);
    memo.clear();

    expect(memo.size).to.equal(0);
    expect(memo.get('a')).to.equal(undefined);
  });

  it('is sized for a working set of thousands of labels', function () {
    expect(SHAPE_MEMO_GENERATION).to.equal(4096);
  });
});
