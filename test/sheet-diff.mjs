import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { columnSpecsForGroup } from '../src/contract.mjs';

/*
Round 133 (ledger item 67): a whole-sheet `cy.style( sheet )` re-applies
as a diff — only the channels whose declaration changed are re-written,
per group def.

The contract is **end-state equivalence**: after any sequence of
operations, an instance whose sheet replaces take the diff holds exactly
what an instance taking the whole-sheet pass holds — every column of
both groups, the four blob pools, and every element's read-back style.
Each spec below builds such a pair (`twins`: the second has
`sheetDiff = false`), runs the same operations on both, and compares.

A comparison alone proves nothing if the diff never ran — both halves
would be the whole-sheet pass.  So the specs that exercise the narrow
path also assert what it *wrote*: the dirty columns a registered
consumer sees across the swap, which for a one-channel change is that
channel's column and not the rest of the element.

The equivalence specs are the ones whose controls matter, and each names
the input that makes it discriminate: a mapped fold partner (the narrow
writer has to read the slot's own record), a bypass on either side of
the swap (the bypass-clearing rule), an animated value (stored truth the
sheet did not derive), a kernel-owned channel (stale stored bytes), a
moved auto-domain extent, an intermediate sheet inside a batch.
*/

// a compound, a mixed selection, and numeric/categorical data for the
// mappers; every node and edge carries `w`
const elements = () => [
  { data: { id: 'p', w: 5, kind: 'group' } },
  { data: { id: 'a', parent: 'p', w: 1, kind: 'x' }, position: { x: 0, y: 0 } },
  {
    data: { id: 'b', parent: 'p', w: 2, kind: 'y' },
    position: { x: 60, y: 0 },
    selected: true,
  },
  { data: { id: 'c', w: 3, kind: 'x' }, position: { x: 200, y: 40 } },
  { data: { id: 'd', w: 8, kind: 'y' }, position: { x: 260, y: 90 } },
  { data: { id: 'e', w: 4, kind: 'x' }, position: { x: 120, y: 160 } },
  { data: { id: 'ab', source: 'a', target: 'b', w: 0.2 } },
  { data: { id: 'bc', source: 'b', target: 'c', w: 0.9 }, selected: true },
  { data: { id: 'cd', source: 'c', target: 'd', w: 0.5 } },
  { data: { id: 'de', source: 'd', target: 'e', w: 0.1 } },
  { data: { id: 'ea', source: 'e', target: 'a', w: 0.7 } },
  { data: { id: 'cc', source: 'c', target: 'c', w: 0.4 } },
];

// every channel with a narrow writer is declared, and every fold
// partner of one is *mapped*, so the writer has to read the slot's own
// resolved record rather than the sheet's constants
const BASE = {
  nodes: {
    width: 30,
    height: 20,
    'background-color': '#336699',
    'background-opacity': {
      data: 'w',
      scale: 'linear',
      domain: [0, 10],
      range: [0.3, 1],
    },
    'border-color': '#224466',
    'border-width': 2,
    'border-opacity': {
      case: [{ when: { selected: true }, then: 1 }],
      else: 0.5,
    },
    opacity: 0.9,
    'overlay-color': '#00aaff',
    'overlay-opacity': 0.2,
    'overlay-padding': 4,
    'underlay-color': {
      case: [{ when: { data: 'kind', eq: 'x' }, then: '#ff0000' }],
      else: '#00ff00',
    },
    'underlay-opacity': 0.3,
    'underlay-padding': 2,
    label: { data: 'id' },
  },
  parents: { 'background-color': '#dddddd', padding: 12 },
  edges: {
    width: 2,
    'line-color': '#888888',
    'line-opacity': {
      data: 'w',
      scale: 'linear',
      domain: [0, 1],
      range: [0.4, 1],
    },
    opacity: 0.8,
    'source-arrow-shape': 'triangle',
    'source-arrow-color': '#aa0000',
    'target-arrow-shape': 'vee',
    'target-arrow-color': '#00aa00',
    'mid-source-arrow-shape': 'circle',
    'mid-source-arrow-color': '#0000aa',
    'mid-target-arrow-shape': 'square',
    'mid-target-arrow-color': '#aaaa00',
    'overlay-color': '#123456',
    'overlay-opacity': 0.1,
    'overlay-padding': 3,
    'underlay-color': {
      case: [{ when: { selected: true }, then: '#ff00ff' }],
      else: '#00ffff',
    },
    'underlay-opacity': 0.25,
    'underlay-padding': 1,
    'curve-style': 'bezier',
  },
};

const withProp = (group, prop, value, sheet = BASE) => ({
  ...sheet,
  [group]: { ...sheet[group], [prop]: value },
});

/** The same graph under the same sheet twice; the second takes the
 * whole-sheet pass on every replace. */
function twins(sheet = BASE, els = elements) {
  const diff = cytoscape({ headless: true, elements: els(), style: sheet });
  const full = cytoscape({ headless: true, elements: els(), style: sheet });

  full._styleEngine.sheetDiff = false;

  return [diff, full];
}

/** Everything a sheet apply can write: every column of both groups, the
 * blob pools, and each element's read-back style. */
function state(cy) {
  const store = cy._store;
  const out = {};
  // compound bounds are derived lazily and flushed by a delta take (and
  // by a read); a pass that marked them pending has not changed them, so
  // both sides are flushed before the columns are read
  const flush = store.registerConsumer();

  flush.take();
  flush.dispose();

  for (const group of ['nodes', 'edges']) {
    for (const spec of columnSpecsForGroup(group)) {
      out[spec.id] = Array.from(store.column(spec.id));
    }
  }

  out['#curveBlob'] = Array.from(store.curveBlob());
  out['#polyBlob'] = Array.from(store.polyBlob());
  out['#imageBlob'] = Array.from(store.imageBlob());
  out['#chartBlob'] = Array.from(store.chartBlob());
  out['#styles'] = cy.elements().map((ele) => [ele.id(), ele.style()]);

  return out;
}

function expectSame(diff, full, what) {
  const a = state(diff);
  const b = state(full);

  for (const key of Object.keys(b)) {
    expect(a[key], `${what}: ${key}`).to.deep.equal(b[key]);
  }
}

/** The columns an operation dirtied, from a registered consumer. */
function dirtied(cy, op) {
  const consumer = cy._store.registerConsumer();

  consumer.take();
  op();

  const delta = consumer.take();

  consumer.dispose();

  return new Set(delta.spans.map((s) => s.column));
}

const both = (pair, op) => {
  for (const cy of pair) {
    op(cy);
  }
};

const destroy = (pair) => both(pair, (cy) => cy.destroy());

// every prop with a narrow writer, a new value for it, and the one column
// that writer owns
const NARROW = [
  ['nodes', 'background-color', '#cc3300', 'node.fillColor'],
  ['nodes', 'border-color', '#003300', 'node.borderColor'],
  ['nodes', 'opacity', 0.6, 'node.opacity'],
  ['nodes', 'overlay-color', '#ff00aa', 'node.overlay'],
  ['nodes', 'overlay-opacity', 0.4, 'node.overlay'],
  ['nodes', 'overlay-padding', 7, 'node.overlay'],
  ['nodes', 'underlay-color', '#abcdef', 'node.underlay'],
  ['nodes', 'underlay-opacity', 0.6, 'node.underlay'],
  ['nodes', 'underlay-padding', 5, 'node.underlay'],
  ['edges', 'line-color', '#445566', 'edge.lineColor'],
  ['edges', 'source-arrow-color', '#556677', 'edge.sourceArrow'],
  ['edges', 'target-arrow-color', '#667788', 'edge.targetArrow'],
  ['edges', 'mid-source-arrow-color', '#778899', 'edge.midSourceArrow'],
  ['edges', 'mid-target-arrow-color', '#8899aa', 'edge.midTargetArrow'],
  ['edges', 'overlay-color', '#010203', 'edge.overlay'],
  ['edges', 'overlay-opacity', 0.35, 'edge.overlay'],
  ['edges', 'overlay-padding', 6, 'edge.overlay'],
  ['edges', 'underlay-color', '#0a0b0c', 'edge.underlay'],
  ['edges', 'underlay-opacity', 0.45, 'edge.underlay'],
  ['edges', 'underlay-padding', 4, 'edge.underlay'],
];

describe('gpu/style: the sheet diff (round 133)', function () {
  describe('a one-channel change re-writes that channel', function () {
    for (const [group, prop, value, column] of NARROW) {
      it(`${group} ${prop}: only ${column}, and the full pass's end state`, function () {
        const pair = twins();
        const sheet = withProp(group, prop, value);
        const wrote = dirtied(pair[0], () => pair[0].style(sheet));
        const fullWrote = dirtied(pair[1], () => pair[1].style(sheet));

        expect([...wrote], 'the diff wrote the channel alone').to.deep.equal([
          column,
        ]);
        // the precondition: the whole-sheet pass writes the element
        expect(fullWrote.size, 'the full pass writes more').to.be.above(1);
        expectSame(pair[0], pair[1], prop);
        destroy(pair);
      });
    }

    it('also re-writes the parents under compounds, which the nodes block reaches', function () {
      const pair = twins();
      const sheet = withProp('nodes', 'border-color', '#ffffff');

      both(pair, (cy) => cy.style(sheet));
      expectSame(pair[0], pair[1], 'border-color');
      expect(pair[0].$id('p').style('border-color')).to.match(
        /^rgba?\(255,255,255/,
      );
      destroy(pair);
    });

    it('re-writes nothing for an identical sheet', function () {
      const pair = twins();

      expect(dirtied(pair[0], () => pair[0].style(BASE)).size).to.equal(0);
      pair[1].style(BASE);
      expectSame(pair[0], pair[1], 'identical');
      destroy(pair);
    });
  });

  describe('what the diff must not skip', function () {
    it('a channel without a narrow writer takes its def through the full pass', function () {
      const pair = twins();
      const sheet = withProp('edges', 'width', 5);
      const wrote = dirtied(pair[0], () => pair[0].style(sheet));

      pair[1].style(sheet);
      expect(wrote.has('edge.width')).to.equal(true);
      // the nodes did not change, so they are not written
      expect([...wrote].some((c) => c.startsWith('node.'))).to.equal(false);
      expectSame(pair[0], pair[1], 'width');
      destroy(pair);
    });

    it('a constant becoming a data mapper, a case, and back', function () {
      const pair = twins();
      const sheets = [
        withProp('nodes', 'background-color', {
          data: 'w',
          scale: 'linear',
          domain: [0, 10],
          range: ['#000000', '#ffffff'],
        }),
        withProp('nodes', 'background-color', {
          case: [{ when: { data: 'kind', eq: 'y' }, then: '#ff0000' }],
          else: '#0000ff',
        }),
        BASE,
      ];

      for (const sheet of sheets) {
        both(pair, (cy) => cy.style(sheet));
        expectSame(pair[0], pair[1], JSON.stringify(sheet.nodes));
      }

      destroy(pair);
    });

    it('the compound padding of the parents group', function () {
      const pair = twins();
      const sheet = { ...BASE, parents: { ...BASE.parents, padding: 30 } };

      both(pair, (cy) => cy.style(sheet));
      expectSame(pair[0], pair[1], 'padding');
      expect(pair[0].$id('p').style('padding')).to.equal(30);
      destroy(pair);
    });

    it('a mapper object mutated in place and the sheet set again', function () {
      // a primitive is copied into the declarations by construction; a
      // mapper object is the case the snapshot exists for
      const pair = twins();

      both(pair, (cy) => {
        const sheet = withProp('nodes', 'background-color', {
          case: [{ when: { data: 'kind', eq: 'y' }, then: '#ff0000' }],
          else: '#010101',
        });

        cy.style(sheet);
        sheet.nodes['background-color'].else = '#fefefe';
        cy.style(sheet);
      });
      expectSame(pair[0], pair[1], 'mutated');
      expect(pair[0].$id('c').style('background-color')).to.match(
        /^rgba?\(254,254,254/,
      );
      destroy(pair);
    });

    it('a live auto-domain extent that moved since the columns were derived', function () {
      const auto = withProp('nodes', 'background-color', {
        data: 'w',
        scale: 'linear',
        range: ['#000000', '#ffffff'],
      });
      const pair = twins(auto);

      // the element holding the extent's maximum leaves; nothing
      // re-derives the others until the next apply
      both(pair, (cy) => cy.$id('d').remove());

      const sheet = withProp('nodes', 'border-color', '#123123', auto);

      both(pair, (cy) => cy.style(sheet));
      expectSame(pair[0], pair[1], 'extent');
      destroy(pair);
    });

    it('a channel the GPU kernel owned, whose stored bytes are stale', function () {
      const mapped = withProp('nodes', 'background-color', {
        data: 'w',
        scale: 'linear',
        domain: [0, 10],
        range: ['#000000', '#ffffff'],
      });
      const pair = twins(mapped);

      both(pair, (cy) => {
        // what the renderer's mapper runtime does: the kernel owns the
        // channel, so a data write skips its CPU evaluation
        cy._styleEngine.setGpuOwned('nodes', ['background-color']);
        cy.$id('c').data('w', 9);
      });

      const sheet = withProp('nodes', 'border-color', '#321321', mapped);

      both(pair, (cy) => cy.style(sheet));
      expectSame(pair[0], pair[1], 'owned');
      destroy(pair);
    });
  });

  describe('the bypass-clearing rule of a sheet replace', function () {
    it('a sugar bypass is cleared by an unrelated change, as before', function () {
      const pair = twins();

      both(pair, (cy) => {
        cy.$id('c').style('background-color', '#abcdef');
        cy.$id('cd').style('width', 9);
      });

      const sheet = withProp('nodes', 'border-color', '#999999');

      both(pair, (cy) => cy.style(sheet));
      expectSame(pair[0], pair[1], 'sugar');
      expect(pair[0].$id('c').style('background-color')).to.match(
        /^rgba?\(51,102,153/,
      );
      expect(pair[0].$id('cd').style('width')).to.equal(2);
      destroy(pair);
    });

    it("a sheet's bypasses section, installed and then replaced", function () {
      const pair = twins();
      const withBypass = {
        ...BASE,
        bypasses: { a: { 'background-color': '#fedcba' }, ea: { width: 7 } },
      };

      both(pair, (cy) => cy.style(withBypass));
      expectSame(pair[0], pair[1], 'installed');
      expect(pair[0].$id('a').style('background-color')).to.match(
        /^rgba?\(254,220,186/,
      );

      both(pair, (cy) => cy.style(BASE));
      expectSame(pair[0], pair[1], 'replaced');
      expect(pair[0].$id('a').style('background-color')).to.match(
        /^rgba?\(51,102,153/,
      );
      destroy(pair);
    });
  });

  describe('batches', function () {
    it('additions, data writes and two sheets in one batch', function () {
      const pair = twins();

      both(pair, (cy) =>
        cy.batch(() => {
          cy.add([
            { data: { id: 'f', w: 6, kind: 'y' }, position: { x: 9, y: 9 } },
            { data: { id: 'cf', source: 'c', target: 'f', w: 0.3 } },
          ]);
          cy.$id('e').data('w', 10);
          cy.$id('de').data('w', 0.95);
          cy.style(withProp('nodes', 'background-color', '#101010'));
          cy.style(withProp('edges', 'line-color', '#202020'));
        }),
      );
      expectSame(pair[0], pair[1], 'batch');
      destroy(pair);
    });

    it("a second sheet that repeats the first one's change", function () {
      // the columns hold A; B changes the fill, C keeps B's fill and
      // changes the line.  B → C alone does not mention the fill, so the
      // changes have to accumulate from the sheet the columns were
      // derived under
      const b = withProp('nodes', 'background-color', '#101010');
      const c = withProp('edges', 'line-color', '#202020', b);
      const pair = twins();

      both(pair, (cy) =>
        cy.batch(() => {
          cy.style(b);
          cy.style(c);
        }),
      );
      expectSame(pair[0], pair[1], 'accumulated');
      expect(pair[0].$id('c').style('background-color')).to.match(
        /^rgba?\(16,16,16/,
      );
      destroy(pair);
    });

    it('an element restyled under an intermediate sheet', function () {
      // A → B → A inside one batch, with a state flip under B: the flip
      // writes B's value for the channel it moves, which B → A then has
      // to put back
      const flipSheet = withProp('nodes', 'overlay-color', {
        case: [{ when: { selected: true }, then: '#ff0000' }],
        else: '#00ff00',
      });
      const pair = twins();

      both(pair, (cy) =>
        cy.batch(() => {
          cy.style(flipSheet);
          cy.$id('c').select();
          cy.style(BASE);
        }),
      );
      expectSame(pair[0], pair[1], 'intermediate');
      destroy(pair);
    });
  });

  describe('animated stored truth', function () {
    it('an animated channel is reset by the next replace, as the full pass does', function () {
      const pair = twins();

      both(pair, (cy) => {
        cy.$id('c').animate({
          style: { 'background-color': '#ff0000' },
          duration: 100,
        });
        cy._animations.tick(0);
        cy._animations.tick(200);
      });
      expect(pair[0].$id('c').style('background-color')).to.match(
        /^rgba?\(255,0,0/,
      );
      expect(pair[0]._store.styleTouched.nodes).to.equal(true);

      // an edges-only change: the node group was touched, so it takes
      // the whole pass and the animated value goes
      const sheet = withProp('edges', 'line-color', '#0f0f0f');

      both(pair, (cy) => cy.style(sheet));
      expectSame(pair[0], pair[1], 'animated');
      expect(pair[0].$id('c').style('background-color')).to.match(
        /^rgba?\(51,102,153/,
      );
      expect(pair[0]._store.styleTouched.nodes).to.equal(false);

      // and the next change diffs again
      const next = withProp('nodes', 'border-color', '#0e0e0e', sheet);
      const wrote = dirtied(pair[0], () => pair[0].style(next));

      pair[1].style(next);
      expect([...wrote]).to.deep.equal(['node.borderColor']);
      expectSame(pair[0], pair[1], 'after');
      destroy(pair);
    });

    it('a live transition still fires on the channel the replace changed', function () {
      const TRANSITION = {
        'transition-property': ['background-color'],
        'transition-duration': 100,
        'transition-timing-function': 'linear',
      };
      const sheet = { ...BASE, nodes: { ...BASE.nodes, ...TRANSITION } };
      const pair = twins(sheet);

      both(pair, (cy) => {
        cy.style(withProp('nodes', 'background-color', '#ff0000', sheet));
        cy._animations.tick(0);
      });
      expect(pair[0].$id('c').animated()).to.equal(true);

      both(pair, (cy) => cy._animations.tick(200));
      expectSame(pair[0], pair[1], 'transition');
      destroy(pair);
    });
  });

  it('sixty alternating replaces agree with the full pass throughout', function () {
    const pair = twins();

    for (let f = 0; f < 60; f++) {
      const sheet =
        f % 3 === 0
          ? withProp('nodes', 'background-color', f % 2 ? '#111111' : '#eeeeee')
          : f % 3 === 1
            ? withProp('edges', 'line-color', f % 2 ? '#222222' : '#dddddd')
            : withProp('edges', 'width', 1 + (f % 4));

      both(pair, (cy) => cy.style(sheet));
    }

    expectSame(pair[0], pair[1], 'sixty');
    destroy(pair);
  });
});
