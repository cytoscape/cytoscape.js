import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

/*
Round 57.1: the state `case` conditions — v3's state selectors, as the
one thing v4 has instead of selectors.

Two claims are under test here and they are not the same claim.  The
first is that each spelling *evaluates*: flipping the state changes what
`style()` answers.  The second is that a state condition is not special
— it works on any property, in either group, and mixes with data
conditions — because the whole argument for doing it this way rather
than in a shader is that nothing about it is a special case.

The partition suite at the bottom tests the optimisation that makes the
default stylesheet free, and its control is the point: the fast path and
the general path must agree element for element.
*/

const graph = (style) =>
  cytoscape({
    elements: [
      { data: { id: 'a', w: 1 } },
      { data: { id: 'b', w: 9 } },
      { data: { id: 'ab', source: 'a', target: 'b' } },
    ],
    ...(style != null ? { style } : {}),
  });

/** A node sheet putting `border-width` behind one state condition. */
const onState = (state, value = true) => ({
  nodes: {
    'border-width': {
      case: [{ when: { [state]: value }, then: 7 }],
      else: 1,
    },
  },
});

describe('gpu/style: state conditions (round 57.1)', function () {
  describe('each state evaluates', function () {
    // the flag-flipping API per state, so every spelling is driven the
    // way an app would drive it rather than by writing the bit
    const cases = [
      ['selected', (cy) => cy.$id('a').select()],
      ['selectable', (cy) => cy.$id('a').unselectify(), false],
      ['grabbable', (cy) => cy.$id('a').ungrabify(), false],
      ['locked', (cy) => cy.$id('a').lock()],
      ['active', (cy) => cy.$id('a').activate()],
    ];

    for (const [state, flip, value = true] of cases) {
      it(`${state}: ${String(value)}`, function () {
        const cy = graph(onState(state, value));

        expect(cy.$id('a').style('border-width')).to.equal(1);
        flip(cy);
        expect(cy.$id('a').style('border-width')).to.equal(7);
        // and only the element whose state changed
        expect(cy.$id('b').style('border-width')).to.equal(1);
      });
    }

    it('grabbed and hovered, which only the pointer sets', function () {
      // no public setter — these are the pointer layer's, so the spec
      // writes the bit the way the gesture does
      for (const [state, api] of [
        ['grabbed', 'grabbed'],
        ['hovered', null],
      ]) {
        const cy = graph(onState(state));
        const ref = cy.$id('a')._eventRef();
        const bit = state === 'grabbed' ? 16 : 32;

        expect(cy.$id('a').style('border-width')).to.equal(1);
        cy._store.setFlag('nodes', ref.slot, bit, true);
        expect(cy.$id('a').style('border-width')).to.equal(7);

        if (api != null) {
          expect(cy.$id('a')[api]()).to.be.true;
        }

        cy._store.setFlag('nodes', ref.slot, bit, false);
        expect(cy.$id('a').style('border-width')).to.equal(1);
      }
    });

    it('reads the negative direction from `false`', function () {
      // v3 spells these :unselected, :unlocked, :free, :inactive — v4
      // has one key per state and a boolean
      const cy = graph(onState('selected', false));

      expect(cy.$id('a').style('border-width')).to.equal(7);
      cy.$id('a').select();
      expect(cy.$id('a').style('border-width')).to.equal(1);
    });

    it('spells :childless and :orphan as the structural negations', function () {
      const cy = cytoscape({
        elements: [
          { data: { id: 'p' } },
          { data: { id: 'c', parent: 'p' } },
          { data: { id: 'lone' } },
        ],
        style: {
          nodes: {
            'border-width': {
              case: [{ when: { childless: true }, then: 7 }],
              else: 1,
            },
            opacity: {
              case: [{ when: { orphan: true }, then: 0.5 }],
              else: 1,
            },
          },
        },
      });

      expect(cy.$id('p').style('border-width')).to.equal(1); // has a child
      expect(cy.$id('c').style('border-width')).to.equal(7);
      expect(cy.$id('lone').style('border-width')).to.equal(7);

      expect(cy.$id('c').style('opacity')).to.equal(1); // has a parent
      expect(cy.$id('p').style('opacity')).to.equal(0.5);
      expect(cy.$id('lone').style('opacity')).to.equal(0.5);
    });
  });

  describe('a state condition is not a special case', function () {
    it('drives a geometry property, not only paint', function () {
      const cy = graph({
        nodes: {
          width: { case: [{ when: { locked: true }, then: 80 }], else: 20 },
        },
      });

      expect(cy.$id('a').width()).to.equal(20);
      cy.$id('a').lock();
      expect(cy.$id('a').width()).to.equal(80);
      // the bounding box follows, so culling and picking see it too
      expect(cy.$id('a').boundingBox().w).to.equal(80);
    });

    it('works on edges', function () {
      const cy = graph({
        edges: {
          width: { case: [{ when: { selected: true }, then: 11 }], else: 2 },
        },
      });

      expect(cy.$id('ab').style('width')).to.equal(2);
      cy.$id('ab').select();
      expect(cy.$id('ab').style('width')).to.equal(11);
    });

    it('ANDs with a data condition through the `when` array form', function () {
      const cy = graph({
        nodes: {
          'border-width': {
            case: [
              { when: [{ selected: true }, { data: 'w', gt: 5 }], then: 7 },
            ],
            else: 1,
          },
        },
      });

      cy.nodes().select();

      expect(cy.$id('a').style('border-width')).to.equal(1); // w = 1
      expect(cy.$id('b').style('border-width')).to.equal(7); // w = 9
    });

    it('rejects two states in one condition, as it does two structurals', function () {
      expect(() =>
        graph({
          nodes: {
            'border-width': {
              case: [{ when: { selected: true, active: true }, then: 7 }],
              else: 1,
            },
          },
        }),
      ).to.throw(/not several/);
    });
  });

  describe('one vocabulary for querying and for styling', function () {
    // The property, not a sample of it: every state you can *style* on you
    // can also *query* for, because `matcher.mts` compiles queries from
    // the same table `style-scales.mts` compiles conditions from.  Before
    // round 57.1 they were two hand-written lists and the query one was
    // three entries shorter — which is the failure this spec exists to
    // make impossible rather than merely absent.
    const STATES = [
      'parent',
      'childless',
      'child',
      'orphan',
      'selected',
      'selectable',
      'locked',
      'grabbed',
      'grabbable',
      'active',
      'hovered',
    ];

    it('accepts every state as a query key and as a condition', function () {
      const cy = cytoscape({ elements: [{ data: { id: 'a' } }] });

      for (const state of STATES) {
        for (const value of [true, false]) {
          expect(
            () => cy.nodes({ [state]: value }),
            `query { ${state}: ${value} }`,
          ).to.not.throw();
          expect(
            () =>
              cytoscape({
                elements: [{ data: { id: 'a' } }],
                style: {
                  nodes: {
                    'border-width': {
                      case: [{ when: { [state]: value }, then: 7 }],
                      else: 1,
                    },
                  },
                },
              }),
            `condition { ${state}: ${value} }`,
          ).to.not.throw();
        }
      }
    });

    it('lists every state in the unknown-key error', function () {
      // the error is the discoverability surface for a vocabulary with no
      // selector language behind it, so it has to be complete
      let message = '';

      try {
        cytoscape({ elements: [] }).nodes({ notAState: true });
      } catch (e) {
        message = e.message;
      }

      expect(message).to.match(/^Unknown query key 'notAState'/);

      for (const state of STATES) {
        expect(message, `the error should name '${state}'`).to.contain(state);
      }
    });

    it('answers the same question either way', function () {
      // a query and a condition over the same state must agree element for
      // element — they are two compilations of one table, and this is what
      // says the second compilation is right
      const cy = cytoscape({
        elements: [
          { data: { id: 'a' } },
          { data: { id: 'b' } },
          { data: { id: 'c' } },
        ],
        style: {
          nodes: {
            'border-width': {
              case: [{ when: { locked: true }, then: 7 }],
              else: 1,
            },
          },
        },
      });

      cy.$id('a').lock();
      cy.$id('c').lock();

      const byQuery = cy
        .nodes({ locked: true })
        .map((n) => n.id())
        .sort();
      const byStyle = cy
        .nodes()
        .filter((n) => n.style('border-width') === 7)
        .map((n) => n.id())
        .sort();

      expect(byQuery).to.deep.equal(['a', 'c']);
      expect(byStyle).to.deep.equal(byQuery);
    });

    it('reads the structural negations as the negations they are', function () {
      const cy = cytoscape({
        elements: [
          { data: { id: 'p' } },
          { data: { id: 'c', parent: 'p' } },
          { data: { id: 'lone' } },
        ],
      });
      const ids = (q) =>
        cy
          .nodes(q)
          .map((n) => n.id())
          .sort();

      expect(ids({ childless: true })).to.deep.equal(ids({ parent: false }));
      expect(ids({ orphan: true })).to.deep.equal(ids({ child: false }));
      expect(ids({ childless: true })).to.deep.equal(['c', 'lone']);
      expect(ids({ orphan: true })).to.deep.equal(['lone', 'p']);
    });

    it('keeps the structural keys off edges, naming the one used', function () {
      const cy = cytoscape({
        elements: [
          { data: { id: 'a' } },
          { data: { id: 'b' } },
          { data: { id: 'ab', source: 'a', target: 'b' } },
        ],
      });

      expect(() => cy.edges({ orphan: true })).to.throw(
        /'orphan' query key applies to nodes only/,
      );
      expect(() => cy.edges({ childless: true })).to.throw(
        /'childless' query key applies to nodes only/,
      );
      // a state that is *not* structural is fine on edges
      expect(() => cy.edges({ locked: true })).to.not.throw();
    });
  });

  describe('the flag partition (the default sheet is free)', function () {
    // the def is private; the spec reaches it because the partition is
    // an internal optimisation with no public surface at all — which is
    // the property the last spec here checks
    const partitionOf = (cy, group) => cy._styleEngine.defs[group].partition;

    it('partitions a state-only group and not a data-driven one', function () {
      // the default sheet: state conditions and nothing else
      expect(partitionOf(graph(), 'nodes')).to.not.equal(null);

      // one data mapper anywhere in the group and the group is back on
      // the per-element path, because it has to be there anyway
      const mixed = graph({
        nodes: { opacity: { data: 'w', scale: 'linear', range: [0, 1] } },
      });

      expect(partitionOf(mixed, 'nodes')).to.equal(null);

      // and a single `case` that mixes a state with a datum varies per
      // element by definition
      const both = graph({
        nodes: {
          'border-width': {
            case: [
              { when: [{ selected: true }, { data: 'w', gt: 5 }], then: 7 },
            ],
            else: 1,
          },
        },
      });

      expect(partitionOf(both, 'nodes')).to.equal(null);
    });

    it('caches one record per flag combination, not per element', function () {
      const cy = graph(onState('selected'));
      const part = partitionOf(cy, 'nodes');

      cy.$id('a').select();

      expect(cy.$id('a').style('border-width')).to.equal(7);
      expect(cy.$id('b').style('border-width')).to.equal(1);
      // two elements, two states, two records — and it would be two
      // records for two hundred thousand elements
      expect(part.records.size).to.equal(2);
    });

    it('agrees with the general path element for element', function () {
      // The control.  Same sheet, same states, computed both ways: the
      // partition is an optimisation and has to be invisible.  Mixing in
      // a data condition is what forces the other path, and the data is
      // arranged so the two disagree if the state half is dropped.
      const sheet = (mixed) => ({
        nodes: {
          'border-width': {
            case: [
              {
                when: mixed
                  ? [{ selected: true }, { data: 'w', gt: 0 }]
                  : { selected: true },
                then: 7,
              },
            ],
            else: 1,
          },
        },
      });
      const fast = graph(sheet(false));
      const slow = graph(sheet(true));

      expect(partitionOf(fast, 'nodes')).to.not.equal(null);
      expect(partitionOf(slow, 'nodes')).to.equal(null);

      for (const id of ['a', 'b']) {
        for (const select of [false, true]) {
          for (const cy of [fast, slow]) {
            cy.$id(id)[select ? 'select' : 'unselect']();
          }

          expect(fast.$id(id).style('border-width')).to.equal(
            slow.$id(id).style('border-width'),
          );
          expect(fast.$id(id).style('border-width')).to.equal(select ? 7 : 1);
        }
      }
    });
  });
});
