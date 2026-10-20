import { expect } from 'chai';
import {
  styles,
  elementsFor,
  entries,
} from '../lib/debug-harness-fixtures.mjs';

/*
Round 114, split from debug-harness.test.mjs: the networks' long labels
wrap.
*/

describe('debug harness (round 43)', function () {
  describe('long labels wrap (round 114)', function () {
    /* A sheet is written against its fixture's data, and the label text is
       part of that data: reactome's pathway names run to 91 characters and
       npm-deps' package paths to 45 with no whitespace, and both drew as a
       single line across their neighbours until 114.  The property: any
       fetched network whose labels are long at the 90th percentile has a
       sheet that wraps them, with a width and — for paths — a break rule
       that works without spaces. */
    const LONG = 20;

    for (const [id, def] of entries) {
      if (def.generated || def.featureScenes) {
        continue;
      }

      it(
        `${id}: a sheet for long labels wraps them`,
        { timeout: 120000 },
        function () {
          const elements = elementsFor(id, def);
          const key = def.labelKey || 'id';
          const lengths = elements.nodes
            .map((n) => String(n.data[key] ?? '').length)
            .sort((a, b) => a - b);
          const p90 = lengths[Math.floor((lengths.length - 1) * 0.9)];
          const sheet = styles.sheet('production', id, elements, def);

          if (p90 <= LONG) {
            return; // short labels: a single line is right
          }

          expect(
            sheet.nodes['text-wrap'],
            `${id}: p90 label ${p90} chars`,
          ).to.equal('wrap');
          expect(sheet.nodes['text-max-width'], `${id}: no wrap width`).to.be.a(
            'number',
          );

          // a label with no whitespace at all cannot fold at whitespace:
          // when that is what most long labels are (package paths), the
          // sheet needs the anywhere rule; a gene-set name or two among
          // sentences does not
          const long = elements.nodes
            .map((n) => String(n.data[key] ?? ''))
            .filter((text) => text.length > LONG);
          const unbreakable =
            long.filter((text) => !/\s/.test(text)).length > long.length / 2;

          if (unbreakable) {
            expect(
              sheet.nodes['text-overflow-wrap'],
              `${id}: paths need anywhere`,
            ).to.equal('anywhere');
          }
        },
      );
    }

    it('control: the property is data-driven — em-desktop and reactome are the long ones', function () {
      const long = entries
        .filter(([, def]) => !def.generated)
        .filter(([id, def]) => {
          const elements = elementsFor(id, def);
          const key = def.labelKey || 'id';
          const lengths = elements.nodes
            .map((n) => String(n.data[key] ?? '').length)
            .sort((a, b) => a - b);

          return lengths[Math.floor((lengths.length - 1) * 0.9)] > LONG;
        })
        .map(([id]) => id)
        .sort();

      expect(long).to.include.members(['em-desktop', 'npm-deps', 'reactome']);
      expect(long).to.not.include('ndex-large');
    });
  });
});
