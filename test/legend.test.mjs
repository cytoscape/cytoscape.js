import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

describe('application legend metadata (round 147)', function () {
  it('keeps authored partial stops beside the live resolved domain', function () {
    const style = {
      nodes: {
        width: {
          data: 'w',
          domain: [0, 'auto'],
          range: [10, 30],
          fallback: 17,
        },
        'background-color': {
          data: 'score',
          scale: 'diverging',
          domain: ['auto', 0, 'auto'],
          range: ['#2166ac', '#f7f7f7', '#b2182b'],
        },
        opacity: {
          case: [
            { when: { data: 'kind', eq: 'a' }, then: 0.5 },
            { when: { parent: true }, then: 0.8 },
          ],
          else: 1,
        },
      },
    };
    const cy = cytoscape({
      style,
      elements: [
        { data: { id: 'a', w: 2, score: -4, kind: 'a' } },
        { data: { id: 'b', w: 8, score: 3, kind: 'b' } },
      ],
    });

    try {
      const legend = cy.legend();
      const width = legend.entries.find((entry) => entry.id === 'nodes:width');
      const color = legend.entries.find(
        (entry) => entry.id === 'nodes:background-color',
      );
      const opacity = legend.entries.find(
        (entry) => entry.id === 'nodes:opacity',
      );

      expect(width.domain).to.deep.equal([0, 'auto']);
      expect(width.resolvedDomain).to.deep.equal([0, 8]);
      expect(width.range).to.deep.equal([10, 30]);
      expect(width.fallback).to.equal(17);
      expect(color.domain).to.deep.equal(['auto', 0, 'auto']);
      expect(color.resolvedDomain).to.deep.equal([-4, 0, 3]);
      expect(color.status).to.equal('resolved');
      expect(opacity.status).to.equal('conditional');
      expect(opacity.source.case).to.have.length(2);
      expect(legend.entries.map((entry) => entry.id)).to.deep.equal([
        'nodes:width',
        'nodes:background-color',
        'nodes:opacity',
      ]);

      legend.entries.length = 0;
      width.domain[0] = 99;
      color.resolvedDomain[0] = 99;
      expect(cy.legend().entries).to.have.length(3);
      expect(
        cy.legend().entries.find((entry) => entry.id === 'nodes:width').domain,
      ).to.deep.equal([0, 'auto']);
      expect(
        cy
          .legend()
          .entries.find((entry) => entry.id === 'nodes:background-color')
          .resolvedDomain,
      ).to.deep.equal([-4, 0, 3]);
      expect(JSON.parse(JSON.stringify(cy.legend()))).to.deep.equal(
        cy.legend(),
      );
    } finally {
      cy.destroy();
    }
  });

  it('emits one changed snapshot after batch resolution and before batchend', function () {
    const cy = cytoscape({
      style: {
        nodes: { width: { data: 'w', domain: [0, 'auto'], range: [0, 100] } },
      },
      elements: [{ data: { id: 'a', w: 1 } }, { data: { id: 'b', w: 4 } }],
    });
    const events = [];

    try {
      cy.on('legendchange', () => {
        events.push(['legendchange', cy.legend().entries[0].resolvedDomain]);
      });
      cy.on('batchend', () => events.push(['batchend']));

      cy.batch(() => {
        cy.$id('a').data('w', 2);
        cy.$id('b').data('w', 9);
        expect(cy.legend().entries[0].resolvedDomain).to.deep.equal([0, 4]);
        expect(events).to.deep.equal([]);
      });

      expect(events).to.deep.equal([['legendchange', [0, 9]], ['batchend']]);

      events.length = 0;
      cy.$id('a').data('w', 3); // inside the same resolved extent
      cy.$id('a').data('other', 1); // not watched by the mapper
      expect(events).to.deep.equal([]);
    } finally {
      cy.destroy();
    }
  });

  it('summarizes bypasses by property and distinct live element count', function () {
    const cy = cytoscape({
      style: {
        nodes: { width: { data: 'w', range: [10, 30] } },
      },
      elements: [
        { data: { id: 'a', w: 1 } },
        { data: { id: 'b', w: 2 } },
        { data: { id: 'c', w: 3 } },
      ],
    });

    try {
      let changes = 0;
      cy.on('legendchange', () => changes++);
      cy.$id('a').style({ width: 50, height: 70 });
      cy.$id('b').style('width', 60);
      const legend = cy.legend();
      const width = legend.entries.find((entry) => entry.id === 'nodes:width');
      const height = legend.entries.find(
        (entry) => entry.id === 'nodes:height',
      );

      expect(width.exceptions).to.deep.equal([
        { properties: ['width'], elementCount: 2 },
      ]);
      expect(changes).to.equal(2);
      expect(height).to.deep.equal({
        id: 'nodes:height',
        group: 'nodes',
        property: 'height',
        kind: 'mapping',
        status: 'exception-only',
        appliesTo: ['nodes'],
        exceptions: [{ properties: ['height'], elementCount: 1 }],
      });

      cy.$id('a').remove();
      expect(
        cy.legend().entries.find((entry) => entry.id === 'nodes:width')
          .exceptions,
      ).to.deep.equal([{ properties: ['width'], elementCount: 1 }]);
      cy.$id('b').removeStyle();
      expect(
        cy.legend().entries.find((entry) => entry.id === 'nodes:width')
          .exceptions,
      ).to.equal(undefined);
    } finally {
      cy.destroy();
    }
  });

  it('describes chart source and palette without copying node payloads', function () {
    const cy = cytoscape({
      style: {
        nodes: {
          chart: 'pie',
          'chart-values': { data: 'parts' },
          'chart-colors': ['#f00', '#00f'],
        },
      },
      elements: [
        { data: { id: 'a', parts: [2, 3] } },
        { data: { id: 'b', parts: [4, 5] } },
      ],
    });

    try {
      const [entry] = cy.legend().entries;

      expect(entry.id).to.equal('nodes:chart');
      expect(entry.kind).to.equal('chart');
      expect(entry.chart.type).to.equal('pie');
      expect(entry.chart.source).to.equal('parts');
      expect(entry.chart.palette).to.deep.equal(['#f00', '#00f']);
      expect(entry.chart.maxSlots).to.be.a('number');
      expect(entry.chart.barGeometryDomain).to.equal(null);
      expect(entry.chart.values).to.equal(undefined);
      expect(entry.chart.values).to.equal(undefined);
    } finally {
      cy.destroy();
    }
  });

  it('keeps a bypassed element in the base mapper population', function () {
    const cy = cytoscape({
      style: { nodes: { width: { data: 'w', range: [0, 100] } } },
      elements: [
        { data: { id: 'low', w: 1 } },
        { data: { id: 'high', w: 10 } },
      ],
    });

    try {
      cy.$id('high').style('width', 200);
      const width = cy
        .legend()
        .entries.find((entry) => entry.id === 'nodes:width');

      // If bypasses replaced the source contribution, the extent would be
      // degenerate and the mapping would be unresolved.
      expect(width.resolvedDomain).to.deep.equal([1, 10]);
      expect(width.exceptions).to.deep.equal([
        { properties: ['width'], elementCount: 1 },
      ]);
    } finally {
      cy.destroy();
    }
  });

  it('reports unresolved extents and recovers in the same legend entry', function () {
    const warnings = [];
    const warn = console.warn;
    const oldLegendchange = [];
    let cy;

    console.warn = (...args) => warnings.push(args.join(' '));

    try {
      cy = cytoscape({
        style: {
          nodes: {
            width: {
              data: 'w',
              range: [0, 100],
              fallback: 77,
            },
          },
        },
        elements: [{ data: { id: 'a', w: 5 } }],
      });
      cy.on('legendchange', () => oldLegendchange.push(cy.legend()));

      expect(cy.legend().entries[0].status).to.equal('unresolved');
      expect(cy.legend().entries[0].resolvedDomain).to.equal(null);
      cy.add({ data: { id: 'b', w: 10 } });
      expect(cy.legend().entries[0].status).to.equal('resolved');
      expect(cy.legend().entries[0].resolvedDomain).to.deep.equal([5, 10]);
      expect(warnings).to.have.length(1);
      expect(oldLegendchange).to.have.length(1);
    } finally {
      console.warn = warn;
      cy?.destroy();
    }
  });

  it('clones keep independent legend snapshots in headless mode', function () {
    const cy = cytoscape({
      style: {
        nodes: { width: { data: 'w', domain: [0, 'auto'], range: [0, 30] } },
      },
      elements: [{ data: { id: 'a', w: 1 } }, { data: { id: 'b', w: 4 } }],
    });
    const clone = cy.clone();

    try {
      expect(clone.legend()).to.deep.equal(cy.legend());
      clone.$id('b').data('w', 8);
      expect(clone.legend().entries[0].resolvedDomain).to.deep.equal([0, 8]);
      expect(cy.legend().entries[0].resolvedDomain).to.deep.equal([0, 4]);
      expect(clone._renderer).to.equal(null);
    } finally {
      clone.destroy();
      cy.destroy();
    }
  });

  it('keeps nodes and parent definitions independent', function () {
    const cy = cytoscape({
      style: {
        nodes: { width: { data: 'w', domain: [0, 'auto'], range: [0, 20] } },
        parents: {
          width: { data: 'w', domain: ['auto', 200], range: [20, 0] },
        },
      },
      elements: [
        { data: { id: 'p', w: 100 } },
        { data: { id: 'leaf', parent: 'p', w: 2 } },
      ],
    });

    try {
      const entries = cy.legend().entries;
      const nodes = entries.find((entry) => entry.id === 'nodes:width');
      const parents = entries.find((entry) => entry.id === 'parents:width');

      expect(nodes.appliesTo).to.deep.equal(['nodes']);
      expect(nodes.resolvedDomain).to.deep.equal([0, 100]);
      expect(parents.appliesTo).to.deep.equal(['parents']);
      expect(parents.resolvedDomain).to.deep.equal([2, 200]);
      expect(nodes.id).to.not.equal(parents.id);
    } finally {
      cy.destroy();
    }
  });
});
