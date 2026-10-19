import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

const expectErrorMessage = (callback, message) => {
  let thrown;

  try {
    callback();
  } catch (error) {
    thrown = error;
  }

  expect(thrown).to.be.instanceOf(Error);
  expect(thrown.message).to.equal(message);
};

const makeMappedChart = (kind, props = {}) =>
  cytoscape({
    elements: [
      {
        data: { id: 'a', kind, values: [0.25, 0.75] },
      },
    ],
    style: {
      nodes: {
        chart: { data: 'kind' },
        'chart-values': { data: 'values' },
        ...props,
      },
    },
  });

const HEAT_SCALE = {
  domain: [0, 1],
  range: ['blue', 'red'],
};

const makeParents = (parents) =>
  cytoscape({
    elements: [{ data: { id: 'p' } }, { data: { id: 'a', parent: 'p' } }],
    style: { parents },
  });

describe('gpu/style: exact public guard regressions', function () {
  it('allows the chart-values data passthrough and rejects scale mappers', function () {
    const cy = cytoscape({
      elements: [{ data: { id: 'a', values: [0.4, 0.6] } }],
      style: {
        nodes: {
          chart: 'pie',
          'chart-values': { data: 'values' },
        },
      },
    });

    expect(cy._store.chartAt(0).values).to.deep.equal([0.4, 0.6]);
    expectErrorMessage(
      () =>
        cytoscape({
          elements: [{ data: { id: 'a', values: [0.4, 0.6] } }],
          style: {
            nodes: {
              chart: 'pie',
              'chart-values': {
                data: 'values',
                scale: 'linear',
                domain: [0, 1],
                range: [0, 1],
              },
            },
          },
        }),
      "Only the passthrough mapper ({ data: key }) is supported for 'chart-values'",
    );
  });

  it('checks authored colours against a runtime heat chart', function () {
    expectErrorMessage(
      () =>
        makeMappedChart('heat-strip', {
          'chart-scale': HEAT_SCALE,
          'chart-colors': ['red', 'blue'],
        }),
      "'chart-colors' cannot be used with a heat chart; use 'chart-scale'",
    );

    const cy = makeMappedChart('heat-strip', { 'chart-scale': HEAT_SCALE });

    expect(cy._store.chartAt(0).values).to.deep.equal([0.25, 0.75]);
  });

  it('requires a domain for a runtime bar chart', function () {
    expectErrorMessage(
      () => makeMappedChart('bar'),
      "Bar charts require 'chart-domain'",
    );

    const cy = makeMappedChart('bar', { 'chart-domain': [0, 1] });

    expect(cy._store.chartAt(0).values).to.deep.equal([0.25, 0.75]);
  });

  it('rejects a domain on a runtime non-bar chart', function () {
    expectErrorMessage(
      () => makeMappedChart('pie', { 'chart-domain': [0, 1] }),
      "'chart-domain' is only valid for a bar chart",
    );

    const cy = makeMappedChart('pie');

    expect(cy._store.chartAt(0).values).to.deep.equal([0.25, 0.75]);
  });

  it('rejects a scale on a runtime non-heat, non-bar chart', function () {
    expectErrorMessage(
      () => makeMappedChart('pie', { 'chart-scale': HEAT_SCALE }),
      "'chart-scale' is only valid for heat and bar charts",
    );

    const cy = makeMappedChart('pie');

    expect(cy._store.chartAt(0).values).to.deep.equal([0.25, 0.75]);
  });

  it('rejects authored colours and a scale together on a runtime bar chart', function () {
    expectErrorMessage(
      () =>
        makeMappedChart('bar', {
          'chart-domain': [0, 1],
          'chart-scale': HEAT_SCALE,
          'chart-colors': ['red', 'blue'],
        }),
      "A bar chart cannot use both 'chart-colors' and 'chart-scale'",
    );

    const cy = makeMappedChart('bar', { 'chart-domain': [0, 1] });

    expect(cy._store.chartAt(0).values).to.deep.equal([0.25, 0.75]);
  });

  it('rejects malformed endpoint shapes while accepting two-component points', function () {
    const elements = [
      { data: { id: 'a' } },
      { data: { id: 'b' } },
      { data: { id: 'ab', source: 'a', target: 'b' } },
    ];

    expectErrorMessage(
      () =>
        cytoscape({
          elements,
          style: { edges: { 'source-endpoint': '10 20 30' } },
        }),
      "The value '10 20 30' is not a valid source-endpoint (use a keyword, an 'x y' point with optional %/px units, or an angle)",
    );

    const cy = cytoscape({
      elements,
      style: { edges: { 'source-endpoint': '10px 20%' } },
    });

    expect(cy.$id('ab').style('source-endpoint')).to.equal('10 20%');
  });

  it('validates parent padding units, padding range and relative sizing', function () {
    expectErrorMessage(
      () => makeParents({ padding: '5px' }),
      "Invalid padding '5px' (a number of px, or 'N%')",
    );
    expectErrorMessage(
      () => makeParents({ padding: -1 }),
      "Invalid padding '-1' (a number of px, or 'N%')",
    );
    expectErrorMessage(
      () => makeParents({ 'padding-relative-to': 'diagonal' }),
      "Invalid padding-relative-to 'diagonal' (width | height | average | min | max)",
    );
    expectErrorMessage(
      () => makeParents({ 'min-width': -1 }),
      "Invalid min-width '-1' (a non-negative number of px)",
    );

    const cy = makeParents({
      padding: '10%',
      'padding-left': 4,
      'padding-relative-to': 'height',
      'min-width': 0,
    });

    expect(cy.$id('p').style('padding-relative-to')).to.equal('height');
    expect(cy.$id('p').style('min-width')).to.equal(0);
    expect(cy.$id('p').padding()).to.be.greaterThan(0);
  });
});
