import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// Round 23: node charts — v3's pie-*/stripe-* numbered props return as
// the lean list-valued `chart` family (values from constants or
// per-element data arrays, palette-scheme colors, chart-hole for
// donuts), stored per element in a blob record behind node.chartRef.
describe('gpu/style: the chart family (round 23)', function () {
  var makeCy = function (nodeStyle, data) {
    return cytoscape({
      elements: [
        { data: Object.assign({ id: 'a' }, data), position: { x: 0, y: 0 } },
      ],
      style: { nodes: Object.assign({ width: 60, height: 60 }, nodeStyle) },
    });
  };

  it('defaults to none and reads back stored truth', function () {
    var cy = makeCy();

    expect(cy.$id('a').style('chart')).to.equal('none');
    expect(cy._store.chartAt(0)).to.equal(null);
  });

  it('a constant pie stores its record and reads back', function () {
    var cy = makeCy({
      chart: 'pie',
      'chart-values': [0.5, 0.3, 0.2],
      'chart-colors': ['red', 'lime', 'blue'],
      'chart-size': 0.8,
      'chart-hole': 0.4,
      'chart-start-angle': '90deg',
    });
    var ele = cy.$id('a');

    expect(ele.style('chart')).to.equal('pie');
    expect(ele.style('chart-values')).to.equal('0.5 0.3 0.2');
    expect(ele.style('chart-size')).to.equal(0.8);
    expect(ele.style('chart-hole')).to.equal(0.4);
    expect(ele.style('chart-start-angle')).to.be.closeTo(Math.PI / 2, 1e-6);

    var rec = cy._store.chartAt(0);

    expect(rec.kind).to.equal(1); // pie
    expect(rec.values).to.deep.equal([0.5, 0.3, 0.2]);
    expect(rec.colors[0].slice(0, 3)).to.deep.equal([255, 0, 0]);
    expect(rec.colors[1].slice(0, 3)).to.deep.equal([0, 255, 0]);
  });

  it('values accept the space-separated string form; stripes take a direction', function () {
    var cy = makeCy({
      chart: 'stripes',
      'chart-values': '0.25 0.25 0.5',
      'chart-direction': 'horizontal',
    });

    expect(cy.$id('a').style('chart')).to.equal('stripes');
    expect(cy.$id('a').style('chart-values')).to.equal('0.25 0.25 0.5');
    expect(cy.$id('a').style('chart-direction')).to.equal('horizontal');
    expect(cy._store.chartAt(0).kind).to.equal(2);
  });

  it('colors default to the category10 scheme and cycle past its length', function () {
    var values = new Array(12).fill(1 / 16);
    var cy = makeCy({ chart: 'pie', 'chart-values': values });
    var rec = cy._store.chartAt(0);

    expect(rec.values.length).to.equal(12);
    // category10 cycles: slice 10 wears slice 0's color
    expect(rec.colors[10]).to.deep.equal(rec.colors[0]);
    expect(rec.colors[1]).to.not.deep.equal(rec.colors[0]);

    var named = makeCy({
      chart: 'pie',
      'chart-values': [0.5],
      'chart-colors': 'viridis',
    });

    expect(named._store.chartAt(0).colors[0].slice(0, 3)).to.deep.equal([
      0x44, 0x01, 0x54,
    ]);
  });

  it('the data passthrough reads per-element arrays and refreshes on writes', function () {
    var cy = makeCy(
      { chart: 'pie', 'chart-values': { data: 'parts' } },
      { parts: [0.6, 0.4] },
    );

    expect(cy._store.chartAt(0).values).to.deep.equal([0.6, 0.4]);
    expect(cy.$id('a').style('chart-values')).to.equal('0.6 0.4');

    cy.$id('a').data('parts', [0.2, 0.3, 0.5]);

    expect(cy._store.chartAt(0).values).to.deep.equal([0.2, 0.3, 0.5]);

    cy.$id('a').data('parts', null); // no values: no chart record

    expect(cy._store.chartAt(0)).to.equal(null);
  });

  it('caps at 255 slots and clamps the total at 1 (v3 percents)', function () {
    var many = new Array(256).fill(0.001);
    var cy = makeCy({ chart: 'pie', 'chart-values': many });

    expect(cy._store.chartAt(0).values.length).to.equal(255); // recorded cap

    var over = makeCy({ chart: 'pie', 'chart-values': [0.8, 0.8, 0.5] });
    var vals = over._store.chartAt(0).values;

    expect(vals[0]).to.equal(0.8);
    expect(vals[1]).to.be.closeTo(0.2, 1e-6); // clamped to the remainder
    expect(vals.length).to.equal(3);
    expect(vals[2]).to.equal(0); // after the total, slots remain aligned
  });

  it('chart-opacity folds into the stored slice alphas', function () {
    var cy = makeCy({
      chart: 'pie',
      'chart-values': [1],
      'chart-colors': ['red'],
      'chart-opacity': 0.5,
    });

    expect(cy._store.chartAt(0).colors[0][3]).to.equal(128);
    expect(cy.$id('a').style('chart-opacity')).to.equal(0.5);
  });

  it('the kind takes a case mapper; chart: none clears the record', function () {
    var cy = cytoscape({
      elements: [
        { data: { id: 'a', kind: 'charty' }, position: { x: 0, y: 0 } },
        { data: { id: 'b', kind: 'plain' }, position: { x: 100, y: 0 } },
      ],
      style: {
        nodes: {
          chart: {
            case: [{ when: { data: 'kind', eq: 'charty' }, then: 'pie' }],
            else: 'none',
          },
          'chart-values': [0.5, 0.5],
        },
      },
    });

    expect(cy._store.chartAt(0)).to.not.equal(null);
    expect(cy._store.chartAt(1)).to.equal(null);

    cy.$id('a').data('kind', 'plain'); // the case re-evaluates

    expect(cy._store.chartAt(0)).to.equal(null);
  });

  it('heat scales share partial numeric domains and preserve missing slots', function () {
    var cy = cytoscape({
      elements: [
        {
          data: { id: 'a', values: [-1, 0, 2, null] },
          position: { x: 0, y: 0 },
        },
        { data: { id: 'b', values: [-0.5, 1] }, position: { x: 80, y: 0 } },
      ],
      style: {
        nodes: {
          chart: 'heat-strip',
          'chart-values': { data: 'values' },
          'chart-scale': {
            domain: ['auto', 0, 'auto'],
            range: ['blue', 'white', 'red'],
          },
          'chart-missing-color': 'magenta',
        },
      },
    });
    var a = cy._store.chartAt(0);
    var legend = cy.legend().entries.find((entry) => entry.kind === 'chart');

    expect(a.kind).to.equal(3);
    expect(a.values).to.deep.equal([-1, 0, 2, null]);
    expect(a.colors[1].slice(0, 3)).to.deep.equal([255, 255, 255]);
    expect(a.colors[3].slice(0, 3)).to.deep.equal([255, 0, 255]);
    expect(legend.chart.colorDomain).to.deep.equal([-1, 0, 2]);
    expect(legend.chart.missingValues).to.equal(1);

    cy.$id('b').data('values', [-0.5, 4]);
    expect(cy._store.chartAt(1).colors[1].slice(0, 3)).to.deep.equal([
      255, 0, 0,
    ]);
    expect(cy.$id('a').style('chart-values')).to.equal('-1 0 2 ');
  });

  it('bars keep signed values, shared geometry bounds and palette positions', function () {
    var cy = cytoscape({
      elements: [
        { data: { id: 'a', values: [-3, null, 2] }, position: { x: 0, y: 0 } },
        { data: { id: 'b', values: [-1, 1] }, position: { x: 80, y: 0 } },
      ],
      style: {
        nodes: {
          chart: 'bar',
          'chart-values': { data: 'values' },
          'chart-domain': ['auto', 'auto'],
        },
      },
    });
    var a = cy._store.chartAt(0);
    var legend = cy.legend().entries.find((entry) => entry.kind === 'chart');

    expect(a.kind).to.equal(5);
    expect(a.values).to.deep.equal([-3, null, 2]);
    expect(a.barDomain).to.deep.equal([-3, 2]);
    expect(legend.chart.barGeometryDomain).to.deep.equal([-3, 2]);

    cy.$id('b').data('values', [-1, 4]);
    expect(cy._store.chartAt(0).barDomain).to.deep.equal([-3, 4]);
    expect(cy.$id('a').style('chart-domain')).to.equal('auto auto');
  });

  it('bar scales color independently from geometry and accept explicit node overrides', function () {
    var cy = cytoscape({
      elements: [
        { data: { id: 'a', values: [-5, 2] }, position: { x: 0, y: 0 } },
        { data: { id: 'b', values: [-2, 4] }, position: { x: 80, y: 0 } },
      ],
      style: {
        nodes: {
          chart: 'bar',
          'chart-values': { data: 'values' },
          'chart-domain': [0, 4],
          'chart-scale': { domain: [-5, 4], range: ['blue', 'red'] },
        },
        bypasses: {
          a: {
            'chart-scale': { domain: [-5, 4], range: ['lime', 'black'] },
          },
        },
      },
    });
    var a = cy._store.chartAt(0);
    var b = cy._store.chartAt(1);
    var legend = cy.legend().entries.find((entry) => entry.kind === 'chart');

    expect(a.barDomain).to.deep.equal([0, 4]);
    expect(a.colors[0].slice(0, 3)).to.deep.equal([0, 255, 0]);
    expect(b.colors[0].slice(0, 3)).to.deep.equal([101, 78, 194]);
    expect(legend.chart.barGeometryDomain).to.deep.equal([0, 4]);
    expect(legend.chart.colorDomain).to.deep.equal([-5, 4]);
    expect(() =>
      cytoscape({
        style: {
          nodes: {
            chart: 'bar',
            'chart-domain': [0, 1],
            'chart-scale': { domain: [-1, 'auto'], range: ['blue', 'red'] },
          },
          bypasses: {
            a: {
              'chart-scale': { domain: [-1, 'auto'], range: ['blue', 'red'] },
            },
          },
        },
        elements: [{ data: { id: 'a' } }],
      }),
    ).to.throw(/bypass requires explicit numeric domain/);
  });

  it('node scale bypasses leave their values in the shared chart domain and appear as legend exceptions', function () {
    var cy = cytoscape({
      elements: [
        { data: { id: 'a', values: [-1, 1] }, position: { x: 0, y: 0 } },
        { data: { id: 'b', values: [-7, 2] }, position: { x: 80, y: 0 } },
      ],
      style: {
        nodes: {
          chart: 'heat-strip',
          'chart-values': { data: 'values' },
          'chart-scale': {
            domain: ['auto', 0, 'auto'],
            range: ['blue', 'white', 'red'],
          },
        },
        bypasses: {
          b: {
            'chart-scale': {
              domain: [-1, 0, 1],
              range: ['blue', 'white', 'red'],
            },
          },
        },
      },
    });
    var chart = cy.legend().entries.find((entry) => entry.kind === 'chart');

    expect(chart.chart.colorDomain).to.deep.equal([-7, 0, 2]);
    expect(chart.exceptions).to.deep.equal([
      { properties: ['chart-scale'], elementCount: 1 },
    ]);
    expect(cy._store.chartAt(1).values).to.deep.equal([-7, 2]);
  });

  it('chart legend changes once after shared extent batches and recovers from empty data', function () {
    var warnings = [];
    var warn = console.warn;
    var cy;
    console.warn = (...args) => warnings.push(args.join(' '));

    try {
      cy = cytoscape({
        elements: [
          { data: { id: 'a', values: [null, NaN] }, position: { x: 0, y: 0 } },
          { data: { id: 'b', values: [null] }, position: { x: 80, y: 0 } },
        ],
        style: {
          nodes: {
            chart: 'heat-strip',
            'chart-values': { data: 'values' },
            'chart-scale': { domain: ['auto', 'auto'], range: ['blue', 'red'] },
          },
        },
      });
      var events = [];
      cy.on('legendchange', () =>
        events.push(['legendchange', cy.legend().entries[0].chart.colorDomain]),
      );
      cy.on('batchend', () => events.push(['batchend']));

      expect(cy.legend().entries[0].chart.colorStatus).to.equal('unresolved');
      expect(cy._store.chartAt(0).values).to.deep.equal([null, null]);
      cy.batch(() => {
        cy.$id('a').data('values', [-1, 1]);
        cy.$id('b').data('values', [-3, 5]);
      });
      expect(events).to.deep.equal([['legendchange', [-3, 5]], ['batchend']]);
      expect(cy._store.chartAt(0).colors[0].slice(0, 3)).to.deep.equal([
        81, 71, 210,
      ]);

      events.length = 0;
      cy.$id('a').data('values', [-2, 2]);
      expect(events).to.deep.equal([]);
      expect(
        warnings.filter((warning) => warning.includes('chart-scale')),
      ).to.have.length(1);
    } finally {
      console.warn = warn;
      cy?.destroy();
    }
  });

  it('radial heat uses equal sectors and exposes chart configuration', function () {
    var cy = makeCy({
      chart: 'radial-heat',
      'chart-values': [-1, 0, 2],
      'chart-scale': { domain: [-1, 0, 2], range: ['blue', 'white', 'red'] },
    });

    expect(cy.$id('a').style('chart')).to.equal('radial-heat');
    expect(cy.$id('a').style('chart-scale')).to.equal(
      JSON.stringify({ domain: [-1, 0, 2], range: ['blue', 'white', 'red'] }),
    );
    expect(cy._store.chartAt(0).colors[1].slice(0, 3)).to.deep.equal([
      255, 255, 255,
    ]);
  });

  it('rejects bad values and the edges group', function () {
    expect(() => makeCy({ chart: 'donut' })).to.throw();
    expect(() =>
      makeCy({ chart: 'heat-strip', 'chart-values': [0, 1] }),
    ).to.throw(/require 'chart-scale'/);
    expect(() =>
      makeCy({
        chart: 'heat-strip',
        'chart-values': [0, 1],
        'chart-scale': { domain: [0, 1], range: ['blue', 'red'] },
        'chart-colors': ['red'],
      }),
    ).to.throw(/cannot be used with a heat chart/);
    expect(() => makeCy({ chart: 'bar', 'chart-values': [0, 1] })).to.throw(
      /require 'chart-domain'/,
    );
    expect(() =>
      makeCy({
        chart: 'bar',
        'chart-values': [0, 1],
        'chart-domain': [0, 1],
        'chart-colors': ['red'],
        'chart-scale': { domain: [0, 1], range: ['blue', 'red'] },
      }),
    ).to.throw(/cannot use both/);
    expect(() =>
      makeCy({
        chart: 'pie',
        'chart-values': [0.5],
        'chart-scale': { domain: [0, 1], range: ['blue', 'red'] },
      }),
    ).to.throw(/only valid for heat and bar/);
    expect(() =>
      cytoscape({
        elements: [{ data: { id: 'a', kind: 'heat' } }],
        style: {
          nodes: {
            chart: {
              case: [
                { when: { data: 'kind', eq: 'heat' }, then: 'heat-strip' },
              ],
            },
            'chart-values': [0, 1],
          },
        },
      }),
    ).to.throw(/require 'chart-scale'/);
    expect(() =>
      cytoscape({
        elements: [{ data: { id: 'a', kind: 'heat-strip' } }],
        style: {
          nodes: {
            chart: { data: 'kind' },
            'chart-values': [0, 1],
          },
        },
      }),
    ).to.throw(/require 'chart-scale'/);
    expect(() => makeCy({ chart: 'pie', 'chart-values': [-1] })).to.throw();
    expect(() =>
      makeCy({ chart: 'pie', 'chart-values': [0.5], 'chart-hole': 2 }),
    ).to.throw();
    expect(() =>
      makeCy({ chart: 'pie', 'chart-direction': 'diagonal' }),
    ).to.throw();
    expect(() =>
      makeCy({ chart: 'pie', 'chart-colors': 'no-such-scheme' }),
    ).to.throw();
    // message-asserted: the wrong-shape guards, not just wrong values
    expect(() => makeCy({ chart: 'pie', 'chart-values': true })).to.throw(
      /chart-values 'true' must be a number list/,
    );
    expect(() =>
      makeCy({ chart: 'pie', 'chart-values': [0.5], 'chart-colors': 5 }),
    ).to.throw(/chart-colors '5' must be a color list or scheme name/);
    expect(() => cytoscape({ style: { edges: { chart: 'pie' } } })).to.throw(
      /node style property/,
    );
  });

  it('removal frees the record; charts are paint-only (no bb growth)', function () {
    var cy = makeCy({ chart: 'pie', 'chart-values': [1] });
    var plain = makeCy();

    expect(cy.$id('a').boundingBox().w).to.equal(
      plain.$id('a').boundingBox().w,
    );

    cy.$id('a').remove();

    expect(cy._store.chartCount()).to.equal(0);
  });
});
