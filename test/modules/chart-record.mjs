import { expect } from 'chai';
import {
  CHART_COUNT_WORD,
  CHART_HEADER,
  CHART_PIE,
  CHART_VALUE_WORDS,
  CHART_VALIDITY_BITS_PER_WORD,
  COL,
} from '../../src/contract.mjs';
import { GraphStore } from '../../src/store/graph-store.mjs';

const NAN_RGBA = [1, 0, 128, 127];
const NAN_RGBA_WORD = 0x7f800001;

const chart = (values, colors, barDomain = null, kind = 3) => ({
  kind,
  size: 1,
  hole: 0,
  startAngle: 0,
  direction: 0,
  opacity: 1,
  values,
  colors,
  barDomain,
});

describe('store: chart record words (round 80.1)', function () {
  it('addresses a record by offset+1 and keeps count, holes and bar bounds in the header/bitmap', function () {
    const store = new GraphStore();

    store.addNode('a', 0, 0);
    store.setChart(
      0,
      chart(
        [1.5, null, Infinity, NaN],
        [NAN_RGBA, [2, 3, 4, 5], [6, 7, 8, 9], [10, 11, 12, 13]],
        [-2, 4],
      ),
    );

    const offset = store.chartPool.offsetOf(0);
    const ref = store.nodes.column(COL.NODE_CHART_REF)[0];
    const words = store.chartPool.wordData();
    const validityAt = offset + CHART_HEADER + 4 * CHART_VALUE_WORDS;

    expect(ref).to.equal(offset + 1);
    expect(words[offset + CHART_COUNT_WORD]).to.equal(4);
    expect(words[offset + CHART_HEADER + 1]).to.equal(NAN_RGBA_WORD);
    expect(words[validityAt]).to.equal(0b1101);

    const record = store.chartAt(0);

    expect(record.values[0]).to.equal(1.5);
    expect(record.values[1]).to.equal(null);
    expect(record.values[2]).to.equal(Infinity);
    expect(Number.isNaN(record.values[3])).to.equal(true);
    expect(record.colors[0]).to.deep.equal(NAN_RGBA);
    expect(record.barDomain).to.deep.equal([-2, 4]);
  });

  it('uses cumulative stops for pie/stripes and differences them on readback', function () {
    const store = new GraphStore();

    store.addNode('pie', 0, 0);
    store.setChart(
      0,
      chart(
        [0.125, 0.25, 0.625],
        [NAN_RGBA, [2, 3, 4, 255], [6, 7, 8, 255]],
        null,
        CHART_PIE,
      ),
    );

    const offset = store.chartPool.offsetOf(0);
    const values = store.chartPool.data();
    const first = offset + CHART_HEADER;

    expect(values[first]).to.equal(0.125);
    expect(values[first + CHART_VALUE_WORDS]).to.equal(0.375);
    expect(values[first + CHART_VALUE_WORDS * 2]).to.equal(1);
    expect(store.chartAt(0).values).to.deep.equal([0.125, 0.25, 0.625]);
  });

  it('preserves NaN-patterned rgba words through growth and compaction', function () {
    const store = new GraphStore();

    store.addNode('small', 0, 0);
    store.addNode('discarded', 0, 0);
    store.addNode('large', 0, 0);
    store.setChart(
      0,
      chart(
        [1, 2, 3, 4],
        [NAN_RGBA, [1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]],
      ),
    );

    const largeValues = new Array(150).fill(1);
    const largeColors = new Array(150)
      .fill(null)
      .map((_, i) => (i === 0 ? NAN_RGBA : [i & 0xff, 2, 3, 255]));

    store.setChart(1, chart(largeValues, largeColors));
    store.setChart(2, chart(largeValues, largeColors));

    expect(store.chartAt(0).colors[0]).to.deep.equal(NAN_RGBA);
    expect(store.chartAt(2).colors[0]).to.deep.equal(NAN_RGBA);

    store.setChart(1, null);

    const relocated = store.chartPool.offsetOf(2);
    const ref = store.nodes.column(COL.NODE_CHART_REF)[2];

    expect(relocated).to.be.above(0);
    expect(ref).to.equal(relocated + 1);
    expect(store.chartPool.wordData()[relocated + CHART_HEADER + 1]).to.equal(
      NAN_RGBA_WORD,
    );
    expect(store.chartAt(2).colors[0]).to.deep.equal(NAN_RGBA);
    expect(CHART_VALIDITY_BITS_PER_WORD).to.equal(32);
  });
});
