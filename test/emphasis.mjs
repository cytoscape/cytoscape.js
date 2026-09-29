import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { FLAG_EMPHASIZED } from '../src/contract.mjs';

/*
Round 102: transient emphasis — `cy.emphasize( eles )` / `cy.unemphasize()`.

The emphasized set is a flag bit (sheet-styleable, queryable); the dim
of everything else is the renderer's two-tier composite, switched by one
store scalar (`emphasisDim()`), so there is no per-element dim to assert
here — the browser specs look at the pixels.  What this file pins:

- the set semantics (replace, clear, empty, the bit on exactly the set),
- the style half (a `{ when: { emphasized: true } }` rule restyles the set
  and restores it), the query half, and the core `dim-opacity`,
- what emphasis is *not*: shared by a clone, carried by a payload, kept
  on a removed element,
- and the shape the round measured for: a change costs O(set), not
  O(graph).  The shape is pinned by counting the per-element work at two
  graph sizes rather than timing it (node:test runs files concurrently,
  so a wall-clock ratio would be a flaky gate); benchmark/emphasis.mjs is
  the timing.  The control is the spelling the round rejected — a dim
  bit over the rest — counted by the same probe, which must grow with
  the graph.
*/

/** A star per hub: `hubs` hubs of `leaves` leaves each, plus a chain between hubs. */
function stars(hubs, leaves) {
  const elements = [];

  for (let h = 0; h < hubs; h++) {
    elements.push({ data: { id: `h${h}` } });

    for (let l = 0; l < leaves; l++) {
      elements.push({ data: { id: `h${h}l${l}` } });
      elements.push({
        data: { id: `h${h}e${l}`, source: `h${h}`, target: `h${h}l${l}` },
      });
    }

    if (h > 0) {
      elements.push({
        data: { id: `c${h}`, source: `h${h - 1}`, target: `h${h}` },
      });
    }
  }

  return elements;
}

const make = (style) =>
  cytoscape({ headless: true, elements: stars(4, 3), style });
const ids = (eles) => eles.map((e) => e.id()).sort();
const num = (ele, prop) => Number.parseFloat(ele.style(prop));

describe('emphasis (round 102)', () => {
  describe('the set', () => {
    it('sets the bit on exactly the named elements, and reports it', () => {
      const cy = make();
      const hood = cy.$id('h1').closedNeighborhood();

      expect(cy.emphasize(hood)).to.equal(cy);

      expect(ids(cy.elements({ emphasized: true }))).to.deep.equal(ids(hood));
      expect(cy.$id('h1').emphasized()).to.be.true;
      expect(cy.$id('h2l0').emphasized()).to.be.false;
      // the bit, not a side table: the column carries it
      expect(
        cy._store.hasFlag('nodes', cy.$id('h1')._refs[0].slot, FLAG_EMPHASIZED),
      ).to.be.true;
      expect(cy._store.emphasisDim()).to.be.closeTo(0.15, 1e-9);
    });

    it('replaces rather than adds: a second call leaves only its own set', () => {
      const cy = make();

      cy.emphasize(cy.$id('h0').closedNeighborhood());
      cy.emphasize(cy.$id('h2').closedNeighborhood());

      expect(ids(cy.elements({ emphasized: true }))).to.deep.equal(
        ids(cy.$id('h2').closedNeighborhood()),
      );
    });

    it('keeps an element in both sets without clearing it on the way', () => {
      // the delta clears only what leaves: an element in both the old and
      // the new set must not flip, or a styled sheet restyles it twice
      const cy = make({
        nodes: {
          'border-width': {
            case: [{ when: { emphasized: true }, then: 3 }],
            else: 0,
          },
        },
      });
      const engine = cy._styleEngine;
      const refresh = engine.refreshState;
      const flipped = [];

      cy.emphasize(cy.$id('h1').closedNeighborhood());
      engine.refreshState = function (group, key, slots) {
        flipped.push(...Array.from(slots, (s) => `${group}:${s}`));

        return refresh.call(this, group, key, slots);
      };

      // h1 and h2 are in both closed neighbourhoods (the chain edge)
      cy.emphasize(cy.$id('h2').closedNeighborhood());
      engine.refreshState = refresh;

      const slot = (id) => `nodes:${cy.$id(id)._refs[0].slot}`;

      expect(flipped).to.include(slot('h1l0')); // left
      expect(flipped).to.include(slot('h2l0')); // entered
      expect(flipped).to.not.include(slot('h1')); // stayed
      expect(flipped).to.not.include(slot('h2')); // stayed
      expect(num(cy.$id('h1'), 'border-width')).to.equal(3);
    });

    it('unemphasize clears the set and the composite; a second call is a no-op', () => {
      const cy = make();

      cy.emphasize(cy.$id('h1').closedNeighborhood());
      expect(cy.unemphasize()).to.equal(cy);

      expect(cy.elements({ emphasized: true }).length).to.equal(0);
      expect(cy._store.emphasisDim()).to.equal(-1);
      expect(cy.unemphasize()).to.equal(cy);
    });

    it('an empty collection is an emphasis: nothing is emphasized and everything dims', () => {
      const cy = make();

      cy.emphasize(cy.collection());

      expect(cy.elements({ emphasized: true }).length).to.equal(0);
      expect(cy._store.emphasisDim()).to.be.at.least(0);
    });

    it('starts with no emphasis', () => {
      const cy = make();

      expect(cy._store.emphasisDim()).to.equal(-1);
      expect(cy.nodes()[0].emphasized()).to.be.false;
    });

    it('throws on a selector string, naming the method', () => {
      const cy = make();

      expect(() => cy.emphasize('#h1')).to.throw(
        /emphasize\(\) takes a collection/,
      );
    });

    it('throws on a collection from another instance', () => {
      const cy = make();
      const other = make();

      expect(() => cy.emphasize(other.$id('h1'))).to.throw(
        /emphasize\(\) takes a collection from the same instance/,
      );
    });
  });

  describe('the sheet and the query', () => {
    const STYLE = {
      nodes: {
        'border-width': {
          case: [{ when: { emphasized: true }, then: 3 }],
          else: 0,
        },
      },
      edges: {
        width: { case: [{ when: { emphasized: true }, then: 4 }], else: 1 },
      },
    };

    it('restyles the set through a { when: { emphasized: true } } rule, and restores it', () => {
      const cy = make(STYLE);
      const hub = cy.$id('h1');
      const spoke = cy.$id('h1e0');
      const far = cy.$id('h3l0');

      cy.emphasize(hub.closedNeighborhood());

      expect(num(hub, 'border-width')).to.equal(3);
      expect(num(spoke, 'width')).to.equal(4);
      expect(num(far, 'border-width')).to.equal(0);

      cy.unemphasize();

      expect(num(hub, 'border-width')).to.equal(0);
      expect(num(spoke, 'width')).to.equal(1);
    });

    it('does not restyle the rest: the dim is not a style', () => {
      // an element outside the set reads its own opacity — the composite
      // is the renderer's, and style() never sees it
      const cy = make({ nodes: { opacity: 0.7 } });

      cy.emphasize(cy.$id('h1'));

      expect(num(cy.$id('h3'), 'opacity')).to.be.closeTo(0.7, 1e-6);
    });

    it('queries both ways: { emphasized: false } is the rest', () => {
      const cy = make();
      const hood = cy.$id('h0').closedNeighborhood();

      cy.emphasize(hood);

      expect(cy.elements({ emphasized: false }).length).to.equal(
        cy.elements().length - hood.length,
      );
    });

    it('takes the core dim-opacity from the sheet, and follows a sheet replace', () => {
      const cy = make({ core: { 'dim-opacity': 0.4 } });

      expect(cy._store.emphasisDim()).to.equal(-1); // no emphasis yet

      cy.emphasize(cy.$id('h1'));
      expect(cy._store.emphasisDim()).to.be.closeTo(0.4, 1e-9);

      cy.style({ core: { dimOpacity: 0 } }); // camelCase, like every prop
      expect(cy._store.emphasisDim()).to.equal(0);
    });

    it('rejects a dim-opacity outside [0, 1], and a mapper', () => {
      expect(() => make({ core: { 'dim-opacity': 1.5 } })).to.throw(
        /dim-opacity/,
      );
      expect(() =>
        make({
          core: { 'dim-opacity': { data: 'w', domain: [0, 1], range: [0, 1] } },
        }),
      ).to.throw(/constants only/);
    });
  });

  describe('view state, not graph state', () => {
    it('a clone does not share it', () => {
      const cy = make();

      cy.emphasize(cy.$id('h1').closedNeighborhood());

      const copy = cy.clone({ headless: true });

      expect(copy.elements({ emphasized: true }).length).to.equal(0);
      expect(copy._store.emphasisDim()).to.equal(-1);
      copy.destroy();
    });

    it('is not serialized', () => {
      const cy = make();

      cy.emphasize(cy.$id('h1'));

      expect(JSON.stringify(cy.$id('h1').json())).to.not.match(/emphas/i);
    });

    it('a patch keeps it on survivors and never sets it from the payload', () => {
      const cy = make();

      cy.emphasize(cy.$id('h1').closedNeighborhood());
      cy.patch(stars(4, 3).concat([{ data: { id: 'new' } }]));

      expect(cy.$id('h1').emphasized()).to.be.true;
      expect(cy.$id('new').emphasized()).to.be.false;
    });

    it('a removed element leaves the set, and its id re-added is not emphasized', () => {
      const cy = make();

      cy.emphasize(cy.$id('h1').closedNeighborhood());
      cy.$id('h1l0').remove();

      expect(cy.elements({ emphasized: true }).length).to.equal(
        cy.$id('h1').closedNeighborhood().length,
      );

      cy.add({ data: { id: 'h1l0' } });
      expect(cy.$id('h1l0').emphasized()).to.be.false;

      // the stale ref in the kept set is skipped, not resurrected
      cy.unemphasize();
      cy.emphasize(cy.$id('h0'));
      expect(cy.$id('h1l0').emphasized()).to.be.false;
    });
  });

  describe('the cost shape: O(set), not O(graph)', () => {
    /**
     * The per-element work one hover change does: every ref a flag write
     * visits.  Counted at the store's bulk flag writer, which every
     * state setter funnels through.
     */
    function work(cy, change) {
      const store = cy._store;
      const original = store.flagRefs;
      let visited = 0;

      store.flagRefs = function (refs, ...rest) {
        visited += refs.length;

        return original.call(this, refs, ...rest);
      };

      try {
        change(cy);
      } finally {
        store.flagRefs = original;
      }

      return visited;
    }

    const hover = (cy) => {
      cy.emphasize(cy.$id('h0').closedNeighborhood());
      cy.unemphasize();
    };
    // the rejected spelling: a dim bit on everything outside the set
    // (selected stands in for it, as in benchmark/emphasis.mjs)
    const dimBit = (cy) => {
      const rest = cy.elements().not(cy.$id('h0').closedNeighborhood());

      rest.select();
      rest.unselect();
    };

    const small = () => cytoscape({ headless: true, elements: stars(10, 12) });
    const large = () => cytoscape({ headless: true, elements: stars(100, 12) });

    it('a hover change visits the same number of elements on a graph ten times the size', () => {
      const a = work(small(), hover);
      const b = work(large(), hover);

      // h0's closed neighbourhood is 12 leaves + 12 spokes + the chain
      // edge + its far hub + h0, each written on and off
      expect(a).to.equal(2 * 27);
      expect(b).to.equal(a);
    });

    it('control: the per-element dim grows with the graph', () => {
      const a = work(small(), dimBit);
      const b = work(large(), dimBit);

      expect(b / a).to.be.greaterThan(9);
    });

    it('control: the probe sees the write it counts', () => {
      // a probe that counted nothing would pass the O(set) spec too
      const cy = small();

      expect(work(cy, (c) => c.nodes().select())).to.equal(cy.nodes().length);
      expect(cy.nodes().every((n) => n.selected())).to.be.true;
    });
  });
});
