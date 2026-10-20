import { expect } from 'chai';
import cytoscape from '../../src/index.mjs';
import {
  networks,
  fixtures,
  elementsFor,
  entries,
} from '../lib/debug-harness-fixtures.mjs';

/*
Round 46.5, split from debug-harness.test.mjs: every debug network
round-trips through the binary wire form.
*/

describe('debug harness (round 43)', function () {
  describe('the binary wire form round-trips (round 46.5)', function () {
    // The status build ships each fixture as v4's binary wire format rather
    // than JSON — 102.5 MiB becomes 37.5 MiB, which is what puts every fixture
    // under Cloudflare Pages' 25 MiB cap and removes the off-site bucket.  The
    // page then reads it through `fixtures.fromColumnar`.
    //
    // This is the spec that makes that safe: an encoding that silently drops a
    // column would render a *plausible* graph with no labels and no colours,
    // and nothing else would notice.  A first version of `fromColumnar` did
    // exactly that — it read dictionary columns as if they were arrays, so
    // every string column came back `undefined` on every fixture.
    //
    // Control: reading `col[ i ]` for a dict column instead of
    // `col.dict[ col.indices[ i ] - 1 ]` fails 'every data column survives'
    // on all four fixtures.

    const roundTrip = (elements) =>
      fixtures.fromColumnar(
        cytoscape.deserializeElements(
          cytoscape.serializeElements(cytoscape.toColumnarElements(elements)),
        ),
      );

    const norm = (v) =>
      Array.isArray(v) ? v.join('') : v == null ? undefined : String(v);

    for (const [id, def] of entries) {
      if (def.generated || def.featureScenes || def.derive != null) {
        continue;
      }

      it(`${id}: every data column survives`, { timeout: 180000 }, function () {
        const before = elementsFor(id, def);
        const after = roundTrip(before);

        expect(after.nodes.length, 'node count changed').to.equal(
          before.nodes.length,
        );
        expect(after.edges.length, 'edge count changed').to.equal(
          before.edges.length,
        );
        expect(after.hasPositions).to.equal(before.hasPositions);

        // compare a sample rather than all 465k edges: the columns are
        // uniform, so a mismatch shows up in the first few of each kind
        const sample = (a, b, kind) => {
          for (let i = 0; i < Math.min(25, a.length); i++) {
            const keys = new Set([
              ...Object.keys(a[i].data),
              ...Object.keys(b[i].data),
            ]);

            for (const k of keys) {
              expect(
                norm(b[i].data[k]),
                `${kind}[${i}].${k} did not survive`,
              ).to.equal(norm(a[i].data[k]));
            }
          }
        };

        sample(before.nodes, after.nodes, 'node');
        sample(before.edges, after.edges, 'edge');

        // and the whole-column check that a 25-element sample could miss: no
        // column may come back empty for *every* element
        const columns = new Set(
          before.nodes.flatMap((n) => Object.keys(n.data)),
        );

        for (const k of columns) {
          const presentBefore = before.nodes.some((n) => n.data[k] != null);
          const presentAfter = after.nodes.some((n) => n.data[k] != null);

          expect(
            presentAfter,
            `node column "${k}" is empty after the round trip`,
          ).to.equal(presentBefore);
        }
      });
    }

    it('positions survive within f32 precision', function () {
      // the wire format stores positions as f32, so this is a tolerance check
      // rather than an equality one — and the tolerance has to be relative,
      // since these fixtures lay out over tens of thousands of units
      const def = networks['em-web'];
      const before = elementsFor('em-web', def);
      const after = roundTrip(before);

      for (let i = 0; i < before.nodes.length; i++) {
        const a = before.nodes[i].position;
        const b = after.nodes[i].position;

        expect(Math.abs(a.x - b.x)).to.be.at.most(
          Math.max(1e-3, Math.abs(a.x) * 1e-6),
        );
        expect(Math.abs(a.y - b.y)).to.be.at.most(
          Math.max(1e-3, Math.abs(a.y) * 1e-6),
        );
      }
    });

    it('edge endpoints survive, which are indices on the wire and ids in the page', function () {
      // sources/targets are stored as node *indices*; getting the mapping wrong
      // would rewire the graph while keeping every count identical
      const def = networks['white-matter'];
      const before = elementsFor('white-matter', def);
      const after = roundTrip(before);

      for (let i = 0; i < Math.min(200, before.edges.length); i++) {
        expect(after.edges[i].data.source).to.equal(
          before.edges[i].data.source,
        );
        expect(after.edges[i].data.target).to.equal(
          before.edges[i].data.target,
        );
      }
    });
  });
});
