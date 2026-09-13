import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { generate } from '../../scripts/docs-generate.mjs';
import {
  apiEntries,
  parseCsv,
  readInventory,
  checkCoverage,
  v3StyleNames,
  v4StyleNames,
} from '../../scripts/status/feature-inventory.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CSV = readFileSync(join(ROOT, 'docs/features.csv'), 'utf8');
const rows = readInventory(ROOT, CSV);
const model = generate();

describe('feature inventory', () => {
  it('reads spreadsheet CSV including escaped quotes, multiline cells, BOM and Unicode', () => {
    expect(
      parseCsv('\uFEFFa,b,c\r\n"comma, here","say ""hi""","α\nβ"\r\n'),
    ).to.eql([
      ['a', 'b', 'c'],
      ['comma, here', 'say "hi"', 'α\nβ'],
    ]);
    expect(parseCsv('a,b,')).to.eql([['a', 'b', '']]);
    expect(parseCsv('""')).to.eql([['']]);
    for (const csv of ['"unfinished', 'a"b,c', '"a"tail,b']) {
      expect(() => parseCsv(csv)).to.throw(/quot/);
    }
  });

  it('rejects malformed rows, statuses, duplicates and references', () => {
    const header = 'Category,Feature,Status,Comments,Reference\n';
    const row = 'API,cy.add,Implemented,Add elements,src/core.mts\n';
    for (const [csv, error] of [
      ['Feature,Status\na,b', /expected columns/],
      [header, /empty inventory/],
      [header + 'API,cy.add,Implemented\n', /five cells/],
      [header + row.replace('Add elements', ''), /every cell/],
      [header + row.replace('Implemented', 'Ready'), /unknown status/],
      [header + row + row, /duplicate feature/],
      [header + row.replace('src/core.mts', '../secret'), /invalid reference/],
      [
        header + row.replace('src/core.mts', 'src/absent.mts'),
        /missing reference/,
      ],
      [
        header + row.replace('src/core.mts', 'src/core.mts:999999'),
        /line out of range/,
      ],
    ])
      expect(() => readInventory(ROOT, csv)).to.throw(error);
  });

  it('covers current APIs, aliases, properties and the complete frozen v3 baseline', () => {
    checkCoverage(rows, model, ROOT);
    expect(apiEntries(model).size).to.be.greaterThan(300);
    expect(v4StyleNames(ROOT).size).to.be.greaterThan(160);
    // v3 is frozen: this count includes aliases, 16 numbered slices for
    // each chart kind, and the four arrow-prefix families.
    expect(v3StyleNames(ROOT).size).to.equal(291);
    for (const name of [
      'pie-16-background-opacity',
      'stripe-16-background-size',
      'mid-target-arrow-width',
      'content',
    ]) {
      expect(v3StyleNames(ROOT).has(name), name).to.equal(true);
    }
  });

  it('normalizes element prefixes, retaining aliases and merging overloads', () => {
    const entries = apiEntries({
      sections: [
        {
          name: 'Geometry',
          fns: [
            {
              name: 'node.position',
              pureAliases: ['nodes.point'],
              formats: [{}, {}],
            },
          ],
        },
      ],
    });
    expect([...entries.keys()]).to.eql(['eles.position', 'eles.point']);
    expect(entries.get('eles.point').aliasOf).to.equal('eles.position');
  });

  it('fails on missing current members, aliases, v3-only members and properties', () => {
    for (const name of [
      'cy.add',
      'eles.point',
      'eles.clone',
      'width',
      'pie-16-background-opacity',
    ]) {
      expect(
        () =>
          checkCoverage(
            rows.filter((r) => r.Feature !== name),
            model,
            ROOT,
          ),
        name,
      ).to.throw('missing rows');
    }
    const extended = structuredClone(model);
    extended.sections[0].sections[0].fns.push({ name: 'cytoscape.newFeature' });
    expect(() => checkCoverage(rows, extended, ROOT)).to.throw(
      'cytoscape.newFeature',
    );
  });

  it('does not let a removed API stay implemented or a new implementation stay planned', () => {
    for (const [name, status] of [
      ['cy.add', 'Planned'],
      ['eles.clone', 'Implemented'],
    ]) {
      const changed = rows.map((r) =>
        r.Feature === name ? { ...r, Status: status } : r,
      );
      expect(() => checkCoverage(changed, model, ROOT)).to.throw(
        'disagrees with v4 surface',
      );
    }
  });

  it('keeps known gaps and restrictions explicit', () => {
    const find = (name) => rows.find((r) => r.Feature === name);
    expect(find('cy.json').Status).to.equal('Partial');
    expect(find('cy.json').Comments).to.include('import');
    expect(find('text-border-style').Status).to.equal('Planned');
    expect(find('cy.svg').Status).to.equal('Planned');
    expect(find('z-index').Status).to.equal('Excluded');
    expect(find('content').Comments).to.include('label');
    expect(find('ani.completed').Comments).to.include('promise()');
  });
});
