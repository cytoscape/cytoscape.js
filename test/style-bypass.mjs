import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

/*
Round 63: per-element bypasses — the `bypasses` stylesheet section
(id-keyed constants applied over the resolved sheet) and the v3 sugar
methods over it.  The design record is the round-63 plan in PLAN.md;
the contract in one line: a bypass beats everything (user block and
default-sheet state conditionals included), is an id-keyed
*declaration* (it survives remove/re-add and may name an id that does
not exist yet), exports as its own sheet section, and is replaced by a
full sheet swap like any other section.

This file owns the model and apply-integration specs (63.2/63.3) and
the sugar specs (63.4).
*/

const ELEMENTS = [
  { data: { id: 'a' } },
  { data: { id: 'b' } },
  { data: { id: 'ab', source: 'a', target: 'b' } },
];

const RED = 'rgb(255,0,0)';
const BLUE_SELECT = 'rgb(1,105,217)'; // the default sheet's #0169D9

describe('per-element bypasses (round 63)', function () {
  describe('the bypasses sheet section (63.2)', function () {
    it('applies id-keyed constants over the sheet', function () {
      const cy = cytoscape({
        elements: ELEMENTS,
        style: {
          nodes: { 'background-color': '#999999', width: 30 },
          edges: { 'line-color': '#999999' },
          bypasses: {
            a: { 'background-color': '#ff0000', width: 44 },
            ab: { 'line-color': '#ff0000' },
          },
        },
      });

      expect(cy.$id('a').style('background-color')).to.equal(RED);
      expect(cy.$id('a').style('width')).to.equal(44);
      expect(cy.$id('a').width()).to.equal(44); // geometry reaches the column
      expect(cy.$id('ab').style('line-color')).to.equal(RED);

      // the unbypassed twin keeps the sheet's values
      expect(cy.$id('b').style('background-color')).to.equal(
        'rgb(153,153,153)',
      );
      expect(cy.$id('b').style('width')).to.equal(30);

      cy.destroy();
    });

    it('accepts camelCase keys like every other prop surface', function () {
      const cy = cytoscape({
        elements: ELEMENTS,
        style: {
          bypasses: { a: { backgroundColor: '#ff0000', borderWidth: 7 } },
        },
      });

      expect(cy.$id('a').style('background-color')).to.equal(RED);
      expect(cy.$id('a').style('borderWidth')).to.equal(7);

      cy.destroy();
    });

    it('beats a user block constant and a data-driven scale mapper', function () {
      const cy = cytoscape({
        elements: [{ data: { id: 'a', v: 0 } }, { data: { id: 'b', v: 1 } }],
        style: {
          nodes: {
            'background-color': {
              data: 'v',
              domain: [0, 1],
              range: ['#000000', '#ffffff'],
            },
            'border-color': '#00ff00',
            'border-width': 2,
          },
          bypasses: {
            a: { 'background-color': '#ff0000', 'border-color': '#ff0000' },
          },
        },
      });

      // over the scale-mapped channel — the case-rewrite shape could not
      // express this at all, which is why the overlay shape won
      expect(cy.$id('a').style('background-color')).to.equal(RED);
      expect(cy.$id('b').style('background-color')).to.equal(
        'rgb(255,255,255)',
      );
      // over the user constant
      expect(cy.$id('a').style('border-color')).to.equal(RED);

      cy.destroy();
    });

    it("beats the default sheet's selection conditional (v3 precedence)", function () {
      const cy = cytoscape({
        elements: ELEMENTS,
        style: { bypasses: { a: { 'background-color': '#ff0000' } } },
      });

      cy.$id('a').select();
      cy.$id('b').select();

      // the bypassed channel hides selection blue for that element,
      // exactly as a v3 bypass does; the sibling shows the default
      expect(cy.$id('a').selected()).to.equal(true);
      expect(cy.$id('a').style('background-color')).to.equal(RED);
      expect(cy.$id('b').style('background-color')).to.equal(BLUE_SELECT);

      cy.$id('a').unselect();
      expect(cy.$id('a').style('background-color')).to.equal(RED);

      cy.destroy();
    });

    it('is an id-keyed declaration: inert until the id exists, then applies', function () {
      const cy = cytoscape({
        elements: ELEMENTS,
        style: { bypasses: { later: { 'background-color': '#ff0000' } } },
      });

      // nothing throws, nothing matches
      expect(cy.$id('a').style('background-color')).to.equal(
        'rgb(153,153,153)',
      );

      cy.add({ data: { id: 'later' } });
      expect(cy.$id('later').style('background-color')).to.equal(RED);

      cy.destroy();
    });

    it('survives remove and re-add of its element', function () {
      const cy = cytoscape({
        elements: ELEMENTS,
        style: { bypasses: { a: { 'background-color': '#ff0000' } } },
      });

      cy.$id('a').remove();
      // claim the freed slot first, so a stale slot map cannot pass by
      // the free-list handing 'a' its old slot back
      cy.add({ data: { id: 'squatter' } });
      cy.add({ data: { id: 'a' } });

      expect(cy.$id('a').style('background-color')).to.equal(RED);
      expect(cy.$id('squatter').style('background-color')).to.equal(
        'rgb(153,153,153)',
      );
      cy.destroy();
    });

    it('survives slot compaction', function () {
      const cy = cytoscape({
        style: { bypasses: { keep: { 'background-color': '#ff0000' } } },
      });

      const defs = [];

      for (let i = 0; i < 2000; i++) {
        defs.push({ data: { id: 'n' + i } });
      }

      defs.push({ data: { id: 'keep' } });
      cy.add(defs);

      for (let i = 0; i < 2000; i++) {
        cy.$id('n' + i).remove();
      }

      cy.compact();

      // the stored bytes survive the permutation regardless (columns
      // move together), so the discriminating half is a restyle at the
      // compacted slot: the select's punch-out needs the re-resolved
      // slot map, and a stale one lets selection blue stomp the bypass
      expect(cy.$id('keep').style('background-color')).to.equal(RED);
      cy.$id('keep').select();
      expect(cy.$id('keep').style('background-color')).to.equal(RED);
      cy.destroy();
    });

    it('a full sheet swap replaces the section; spreading the getter keeps it', function () {
      const cy = cytoscape({
        elements: ELEMENTS,
        style: { bypasses: { a: { 'background-color': '#ff0000' } } },
      });

      expect(cy.$id('a').style('background-color')).to.equal(RED);

      cy.style({ nodes: { 'border-width': 1 } });
      expect(cy.$id('a').style('background-color')).to.equal(
        'rgb(153,153,153)',
      );

      // the keep-them idiom: spread the exported sheet
      cy.style({ bypasses: { a: { 'background-color': '#ff0000' } } });

      const kept = { ...cy.json().style, nodes: { 'border-width': 2 } };

      cy.style(kept);
      expect(cy.$id('a').style('background-color')).to.equal(RED);
      expect(cy.$id('a').style('border-width')).to.equal(2);

      cy.destroy();
    });

    it('exports as its own section and round-trips through a new instance', function () {
      const cy = cytoscape({
        elements: ELEMENTS,
        style: {
          nodes: { width: 33 },
          bypasses: { a: { 'background-color': '#ff0000' } },
        },
      });

      const sheet = cy.json().style;

      expect(sheet.bypasses).to.deep.equal({
        a: { 'background-color': '#ff0000' },
      });

      const cy2 = cytoscape({ elements: ELEMENTS, style: sheet });

      expect(cy2.$id('a').style('background-color')).to.equal(RED);
      expect(cy2.$id('a').style('width')).to.equal(33);

      cy.destroy();
      cy2.destroy();
    });

    it('fails loudly: unknown props, mapper values and global font props throw', function () {
      expect(() =>
        cytoscape({ style: { bypasses: { a: { 'no-such-prop': 1 } } } }),
      ).to.throw(/no-such-prop/);

      expect(() =>
        cytoscape({
          style: {
            bypasses: { a: { 'background-color': { data: 'v' } } },
          },
        }),
      ).to.throw(/constant/i);

      expect(() =>
        cytoscape({ style: { bypasses: { a: { 'font-family': 'serif' } } } }),
      ).to.throw(/font/i);

      expect(() => cytoscape({ style: { bypasses: { a: 3 } } })).to.throw(
        /bypass/i,
      );

      expect(() => cytoscape({ style: { bypasses: [] } })).to.throw(/bypass/i);
    });
  });

  describe('apply integration (63.3)', function () {
    it('a state flip keeps the bypass: the refreshState punch-out', function () {
      // the default sheet conditions background-color on `selected`, so
      // a select restyles through the round-61 diff path — whose narrow
      // writers must not stomp a bypassed channel
      const cy = cytoscape({
        elements: ELEMENTS,
        style: { bypasses: { a: { 'background-color': '#ff0000' } } },
      });

      const band = cy.nodes();

      band.select();
      band.unselect();
      band.select();

      expect(cy.$id('a').style('background-color')).to.equal(RED);
      expect(cy.$id('b').style('background-color')).to.equal(BLUE_SELECT);

      cy.destroy();
    });

    it('a data write re-asserts the bypass over the re-evaluated mapper', function () {
      const cy = cytoscape({
        elements: [{ data: { id: 'a', v: 0 } }, { data: { id: 'b', v: 0 } }],
        style: {
          nodes: {
            'background-color': {
              data: 'v',
              domain: [0, 1],
              range: ['#000000', '#ffffff'],
            },
          },
          bypasses: { a: { 'background-color': '#ff0000' } },
        },
      });

      cy.nodes().data('v', 1);

      expect(cy.$id('a').style('background-color')).to.equal(RED);
      expect(cy.$id('b').style('background-color')).to.equal(
        'rgb(255,255,255)',
      );

      cy.destroy();
    });

    it('demotes a kernel-owned paint mapper while its channel carries a bypass', function () {
      const sheetOf = (bypasses) => ({
        nodes: {
          'background-color': {
            data: 'v',
            domain: [0, 1],
            range: ['#000000', '#ffffff'],
          },
        },
        ...(bypasses == null ? {} : { bypasses }),
      });
      const cy = cytoscape({
        elements: [{ data: { id: 'a', v: 0.5 } }],
        style: sheetOf(null),
      });
      const propsOf = () =>
        cy
          .style()
          .paintInputs('nodes')
          .map((entry) => entry.m.prop);

      expect(propsOf()).to.include('background-color');

      cy.style(sheetOf({ a: { 'background-color': '#ff0000' } }));
      expect(propsOf()).to.not.include('background-color');

      // reversible: the swap back restores kernel ownership
      cy.style(sheetOf(null));
      expect(propsOf()).to.include('background-color');

      cy.destroy();
    });

    it('bypass-free instances take no bypass branch in the write funnel', function () {
      const cy = cytoscape({ elements: ELEMENTS });
      const engine = cy.style();
      let merges = 0;
      const orig = Object.getPrototypeOf(engine).mergeBypass;

      engine.mergeBypass = function (...args) {
        merges++;

        return orig.apply(this, args);
      };

      cy.style({ nodes: { 'background-color': '#123456' } });
      cy.nodes().select();
      cy.nodes().unselect();

      expect(merges).to.equal(0);
      cy.destroy();
    });
  });
});
