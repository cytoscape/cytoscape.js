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
import { shapeSample } from './fixtures/genemania-shape.mjs';

/*
Round 105: the GeneMANIA fixtures and their converter.

The converter specs run over the payload's *shape*
(`fixtures/genemania-shape.mjs`, made-up genes), so they need no network,
and pin the conversion rules the debug sheet depends on: the same fields the
web app's own `loadGraph` derives, computed the same way.  The fixtures
themselves were fetched per checkout and gitignored until 2026-10-05, when
the maintainer — a GeneMANIA coauthor — approved committing them; the last
spec pins the committed files to their queries and to the pinned database.

Controls, run once each: dropping the network's weight from absoluteWeight
fails 'weights an interaction by its network'; swapping source/target for the
GeneMANIA gene ids fails 'names genes as the app does'.
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
      // hosted harness) it is a dictionary of the
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

  it('each query wrote the committed file its harness entry loads', function () {
    const ctx = createContext({ module: { exports: {} } });

    runInContext(readFileSync(join(ROOT, 'debug', 'networks.js'), 'utf8'), ctx);

    const networks = ctx.module.exports;

    for (const [id, q] of Object.entries(QUERIES)) {
      expect(networks[id], id).to.not.equal(undefined);
      expect(networks[id].url).to.equal(q.file);

      // the file is the query's result against the pinned database, and the
      // dropdown's counts are the file's
      const { elements, genemania } = JSON.parse(
        readFileSync(join(ROOT, 'debug', q.file), 'utf8'),
      );

      expect(genemania.query, id).to.equal(id);
      expect(genemania.genes, id).to.deep.equal(q.genes);
      expect(genemania.dbVersion, id).to.equal(DB_VERSION);
      expect(elements.nodes, id).to.have.length(networks[id].nodes);
      expect(elements.edges, id).to.have.length(networks[id].edges);
    }
  });
});
