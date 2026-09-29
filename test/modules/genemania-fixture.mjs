import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

import cytoscape from '../../src/index.mjs';
import {
  QUERIES,
  DB_VERSION,
  convert,
  bundleWidths,
  searchRequest,
  defaultNetworkIds,
} from '../../debug/genemania.mjs';
import { planDebug } from '../../scripts/status/plan.mjs';
import { shapeSample } from './fixtures/genemania-shape.mjs';

/*
Round 105: the GeneMANIA fixtures' converter and their distribution rule.

The fixtures themselves are fetched per checkout (`node debug/genemania.mjs`)
and gitignored — GeneMANIA grants no licence to redistribute its data — so
these specs run the converter over the payload's *shape*
(`fixtures/genemania-shape.mjs`, made-up genes) and pin the conversion rules
the debug sheet depends on: the same fields the web app's own `loadGraph`
derives, computed the same way.

Controls, run once each: dropping the network's weight from absoluteWeight
fails 'weights an interaction by its network'; swapping source/target for the
GeneMANIA gene ids fails 'names genes as the app does'; deleting the `fetch`
branch in planDebug fails 'the status site never ships a fetched fixture'.
*/

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('the GeneMANIA fixtures (round 105)', function () {
  it('pins the two queries the eleventh design sitting chose', function () {
    expect(Object.keys(QUERIES)).to.deep.equal([
      'genemania-default',
      'genemania-tp53',
    ]);

    for (const q of Object.values(QUERIES)) {
      expect(q.organism, 'human').to.equal(4);
    }

    expect(QUERIES['genemania-default'].genes).to.have.length(12);
    expect(QUERIES['genemania-default'].exampleGenes).to.equal(true);
    expect(QUERIES['genemania-tp53'].genes).to.deep.equal(['TP53']);
    expect(DB_VERSION).to.equal('13 August 2021 00:00:00');
  });

  it('sends the request the web app sends', function () {
    const body = searchRequest(QUERIES['genemania-default'], [1, 2]);

    expect(body.genes.split('\n')).to.deep.equal(
      QUERIES['genemania-default'].genes,
    );
    expect(body).to.include({
      organism: 4,
      weighting: 'AUTOMATIC_SELECT',
      geneThreshold: 20,
      attrThreshold: 10,
    });
    expect(body.networks).to.deep.equal([1, 2]);
    expect(body.attrGroups).to.deep.equal([]);
  });

  it('selects the networks the organism marks default, across every group', function () {
    const resources = {
      networkGroups: {
        4: [
          {
            interactionNetworks: [
              { id: 1, defaultSelected: true },
              { id: 2, defaultSelected: false },
            ],
          },
          // the upload group arrives with no networks at all
          { interactionNetworks: null },
          { interactionNetworks: [{ id: 3, defaultSelected: true }] },
        ],
      },
    };

    expect(defaultNetworkIds(resources, 4)).to.deep.equal([1, 3]);
  });

  describe('convert', function () {
    const { nodes, edges } = convert(shapeSample()).elements;
    const byId = Object.fromEntries(nodes.map((n) => [n.data.id, n.data]));

    it('names genes as the app does: the typed name for a query gene, else the symbol', function () {
      expect(nodes.map((n) => n.data.id)).to.deep.equal([
        'gene_a',
        'GENE_B',
        'GENE_C',
      ]);
      expect(byId.gene_a.query).to.equal(1);
      expect(byId.GENE_B.query).to.equal(0);
      expect(edges[0].data.source).to.equal('gene_a');
      expect(edges[0].data.target).to.equal('GENE_B');
    });

    it('normalises the score by the best non-query gene, capped at 1', function () {
      // best non-query score is GENE_B's 0.5; the query gene's 0.9 caps
      expect(byId.gene_a.normScore).to.equal(1);
      expect(byId.GENE_B.normScore).to.equal(1);
      expect(byId.GENE_C.normScore).to.equal(0.5);
    });

    it('emits one edge per interaction per network — the parallel edges', function () {
      expect(edges).to.have.length(4);
      expect(bundleWidths({ edges })).to.deep.equal({
        pairs: 2,
        max: 3,
        histogram: { 1: 1, 3: 1 },
      });
      expect(edges.map((e) => e.data.group)).to.deep.equal([
        'pi',
        'pi',
        'pi',
        'coexp',
      ]);
      expect(edges.map((e) => e.data.network)).to.deep.equal([
        'Study-One-2001',
        'Study-One-2001',
        'Study-Two-2002',
        'Study-Three-2003',
      ]);
    });

    it('weights an interaction by its network, and scales to the largest (the width channel)', function () {
      // 0.5 x 0.4, 0.25 x 0.4, 1 x 0.2, 0.8 x 0.1
      expect(edges.map((e) => e.data.absoluteWeight)).to.deep.equal([
        0.2, 0.1, 0.2, 0.08,
      ]);
      expect(edges.map((e) => e.data.absoluteWeightPercent)).to.deep.equal([
        1, 0.5, 1, 0.4,
      ]);
      expect(edges.map((e) => e.data.weight)).to.deep.equal([
        0.5, 0.25, 1, 0.8,
      ]);
    });

    it('refuses an interaction naming a gene outside the result', function () {
      const bad = shapeSample();

      bad.resultNetworkGroups[0].resultNetworks[0].resultInteractions[0].toGene.gene.id = 99;

      expect(() => convert(bad)).to.throw(/names a gene not in the result/);
    });

    it('refuses an error payload', function () {
      expect(() => convert({ error: 'no genes' })).to.throw(/no genes/);
    });

    it('the colour key travels as a dictionary column', function () {
      // the sheet's ordinal mapper reads `group`; on the wire (and so on the
      // hosted harness, were it allowed there) it is a dictionary of the
      // network-type codes, not a string per edge
      const wire = cytoscape.deserializeElements(
        cytoscape.serializeElements({ nodes, edges }),
      );
      const group = wire.edges.data.group;

      expect(group.dict).to.have.members(['pi', 'coexp']);
      expect(Array.from(group.indices, (i) => group.dict[i - 1])).to.deep.equal(
        edges.map((e) => e.data.group),
      );
    });
  });

  it('the status site never ships a fetched fixture, even one on disk', function () {
    // a fetched network pointed at a fixture that *is* checked in: without
    // the rule it would be encoded and shipped like any other
    const networks = {
      probe: {
        url: 'network-reactome.json',
        fetch: 'node debug/genemania.mjs',
      },
    };
    const plan = planDebug({ root: ROOT, networks, wireEnabled: false });
    const ops = plan.ops.filter(
      (op) => op.to === 'debug/network-reactome.json',
    );

    expect(ops).to.have.length(1);
    expect(ops[0].kind).to.equal('omit');
    expect(ops[0].reason).to.match(/not redistributable/);
    expect(plan.dropped).to.deep.equal(['probe']);
  });

  it('each query writes the file its harness entry fetches', function () {
    const ctx = createContext({ module: { exports: {} } });

    runInContext(readFileSync(join(ROOT, 'debug', 'networks.js'), 'utf8'), ctx);

    const networks = ctx.module.exports;

    for (const [id, q] of Object.entries(QUERIES)) {
      expect(networks[id], id).to.not.equal(undefined);
      expect(networks[id].url).to.equal(q.file);
      expect(networks[id].fetch).to.equal('node debug/genemania.mjs');
    }
  });
});
