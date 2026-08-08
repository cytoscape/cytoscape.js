import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

describe('gpu/active-pannable', function () {
  var cy;

  beforeEach(function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'pannableNode' }, pannable: true },
        { data: { id: 'ab', source: 'a', target: 'b' } },
        { data: { id: 'ba', source: 'b', target: 'a' }, pannable: false },
      ],
    });
  });

  describe('active state', function () {
    it('defaults to inactive', function () {
      expect(cy.$id('a').active()).to.be.false;
      expect(cy.$id('a').inactive()).to.be.true;
    });

    it('activates and unactivates', function () {
      cy.$id('a').activate();

      expect(cy.$id('a').active()).to.be.true;
      expect(cy.$id('a').inactive()).to.be.false;

      cy.$id('a').unactivate();

      expect(cy.$id('a').active()).to.be.false;
      expect(cy.$id('a').inactive()).to.be.true;
    });

    it('applies to a whole collection', function () {
      cy.nodes().activate();

      expect(cy.nodes().every((n) => n.active())).to.be.true;
    });

    it('is false for empty and removed elements', function () {
      expect(cy.collection().active()).to.be.false;
      expect(cy.collection().inactive()).to.be.false;

      var a = cy.$id('a');

      a.activate();
      a.remove();

      expect(a.active()).to.be.false;
      expect(a.inactive()).to.be.false;
    });
  });

  describe('pannable state', function () {
    it('defaults nodes to not pannable and edges to pannable, as in v3', function () {
      expect(cy.$id('a').pannable()).to.be.false;
      expect(cy.$id('ab').pannable()).to.be.true;
    });

    it('respects the pannable field of a definition', function () {
      expect(cy.$id('pannableNode').pannable()).to.be.true;
      expect(cy.$id('ba').pannable()).to.be.false;
    });

    it('panifies and unpanifies', function () {
      cy.$id('a').panify();

      expect(cy.$id('a').pannable()).to.be.true;

      cy.$id('a').unpanify();

      expect(cy.$id('a').pannable()).to.be.false;
    });

    it('overrides grabbable, as in v3', function () {
      expect(cy.$id('a').grabbable()).to.be.true;

      cy.$id('a').panify();

      expect(cy.$id('a').grabbable()).to.be.false;

      cy.$id('a').unpanify();

      expect(cy.$id('a').grabbable()).to.be.true;
    });

    it('defaults edges added via cy.add() to pannable', function () {
      cy.add({ data: { id: 'c' } });
      cy.add({ data: { id: 'ac', source: 'a', target: 'c' } });

      expect(cy.$id('c').pannable()).to.be.false;
      expect(cy.$id('ac').pannable()).to.be.true;
    });

    it('defaults columnar-loaded edges to pannable', function () {
      var cy2 = cytoscape({
        elements: {
          columnar: true,
          nodes: { count: 2, ids: ['n0', 'n1'] },
          edges: {
            count: 1,
            ids: ['e0'],
            sources: new Uint32Array([0]),
            targets: new Uint32Array([1]),
          },
        },
      });

      expect(cy2.$id('n0').pannable()).to.be.false;
      expect(cy2.$id('e0').pannable()).to.be.true;
    });
  });

  // Round 57.1 made the state *styleable* rather than drawn from a
  // shader constant: a press is a flag flip, and every visual
  // consequence comes from the sheet's `{ active: true }` conditions.
  // These pin the wiring that makes that true — the store notifies, the
  // engine re-evaluates — because it is invisible from the API surface
  // and only the rendered pixels would otherwise show it.
  describe('a press restyles through the sheet (round 57.1)', function () {
    const styled = () =>
      cytoscape({
        elements: [{ data: { id: 'a' } }, { data: { id: 'b' } }],
        style: {
          nodes: {
            'background-color': {
              case: [{ when: { active: true }, then: 'red' }],
              else: 'blue',
            },
          },
        },
      });

    it('re-evaluates the condition on activate and unactivate', function () {
      const g = styled();

      expect(g.$id('a').style('background-color')).to.equal('rgb(0,0,255)');

      g.$id('a').activate();
      expect(g.$id('a').style('background-color')).to.equal('rgb(255,0,0)');
      // and only the element that changed
      expect(g.$id('b').style('background-color')).to.equal('rgb(0,0,255)');

      g.$id('a').unactivate();
      expect(g.$id('a').style('background-color')).to.equal('rgb(0,0,255)');
    });

    it('works on any property, not just the ones the default sheet uses', function () {
      const g = cytoscape({
        elements: [{ data: { id: 'a' } }],
        style: {
          nodes: {
            width: { case: [{ when: { active: true }, then: 90 }], else: 30 },
          },
        },
      });

      expect(g.$id('a').width()).to.equal(30);
      g.$id('a').activate();
      expect(g.$id('a').width()).to.equal(90);
    });

    it('costs nothing when the sheet says nothing about the state', function () {
      // The gate: a state no condition reads must not reach the engine
      // at all, or every flip on every graph pays for a restyle nobody
      // asked for.
      //
      // The *default* sheet reads `::active` (v3's press overlay), so
      // the way to have a sheet that says nothing about it is to declare
      // `overlay-opacity` yourself — which is also the documented way to
      // turn the affordance off.  A sheet that leaves the default in
      // place is the control, and notifies.
      const seen = [];
      const arm = (g) => {
        const prev = g._store.onStateChange;

        g._store.onStateChange = (group, key, slots) => {
          seen.push(key);
          prev(group, key, slots);
        };
      };
      const overridden = cytoscape({
        elements: [{ data: { id: 'a' } }],
        style: {
          nodes: { 'overlay-opacity': 0 },
          edges: { 'overlay-opacity': 0 },
        },
      });

      arm(overridden);
      overridden.$id('a').activate();
      expect(seen).to.deep.equal([]);

      const g = cytoscape({ elements: [{ data: { id: 'a' } }] });

      arm(g);
      g.$id('a').activate();
      expect(seen).to.deep.equal(['::active']);
    });

    it("gives a press v3's overlay out of the box, and lets a sheet drop it", function () {
      const g = cytoscape({ elements: [{ data: { id: 'a' } }] });

      expect(g.$id('a').style('overlay-opacity')).to.equal(0);
      g.$id('a').activate();
      // v3's `:active` block: black at 25% over 10px of padding.  The
      // readback is 64/255 because v4 stores overlay opacity as the
      // packed record's alpha byte — true of a constant 0.25 as well,
      // not something the conditional introduced.
      expect(g.$id('a').style('overlay-opacity')).to.be.closeTo(0.25, 0.002);
      // the colour reads back with the opacity folded into its alpha —
      // one packed rgba record, again true of a constant
      expect(g.$id('a').style('overlay-color')).to.equal('rgba(0,0,0,0.251)');
      expect(g.$id('a').style('overlay-padding')).to.equal(10);

      const off = cytoscape({
        elements: [{ data: { id: 'a' } }],
        style: { nodes: { 'overlay-opacity': 0 } },
      });

      off.$id('a').activate();
      expect(off.$id('a').style('overlay-opacity')).to.equal(0);
    });

    it('applies to edges too, as in v3', function () {
      const g = cytoscape({
        elements: [
          { data: { id: 'a' } },
          { data: { id: 'b' } },
          { data: { id: 'ab', source: 'a', target: 'b' } },
        ],
      });

      g.$id('ab').activate();
      expect(g.$id('ab').style('overlay-opacity')).to.be.closeTo(0.25, 0.002);
    });

    it('notifies once for a bulk flip, with every changed slot', function () {
      const g = styled();
      const calls = [];

      g._store.onStateChange = (group, key, slots) => {
        calls.push([group, key, [...slots]]);
      };

      g.nodes().activate();

      expect(calls.length).to.equal(1);
      expect(calls[0][0]).to.equal('nodes');
      expect(calls[0][1]).to.equal('::active');
      expect(calls[0][2].length).to.equal(2);
    });
  });
});
