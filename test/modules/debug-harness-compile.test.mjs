import { expect } from 'chai';
import { existsSync } from 'node:fs';
import cytoscape from '../../src/index.mjs';
import {
  styles,
  fixturePath,
  elementsFor,
  entries,
} from '../lib/debug-harness-fixtures.mjs';

/*
Round 43, split from debug-harness.test.mjs: every fixture a network names
exists at the path the page fetches, and every network's hand-authored
sheet compiles against that fixture's real data through `cytoscape()`.
*/

describe('debug harness (round 43)', function () {
  describe('every fixture resolves', function () {
    for (const [id, def] of entries) {
      if (def.generated || def.featureScenes) {
        continue;
      }

      it(`${id} -> ${def.url}`, function () {
        expect(
          existsSync(fixturePath(def.url)),
          `${def.url} does not exist; the page will 404 and render nothing`,
        ).to.equal(true);
      });
    }
  });

  describe('every sheet compiles against its own fixture', function () {
    for (const [id, def] of entries) {
      it(id, { timeout: 120000 }, function () {
        if (def.featureScenes) {
          return;
        }

        const elements = elementsFor(id, def);

        for (const kind of styles.kinds) {
          const sheet = styles.sheet(kind, id, elements, def);

          // headless: no container, so this is the model + style engine only
          const cy = cytoscape({
            elements: { nodes: elements.nodes, edges: elements.edges },
            style: sheet,
          });

          expect(
            cy.nodes().length,
            `${id}/${kind} loaded no nodes`,
          ).to.be.at.least(1);
          cy.destroy();
        }
      });
    }
  });
});
