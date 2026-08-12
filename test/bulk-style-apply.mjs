import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import {
  columnSpecsForGroup,
  EDGE_PER_ELEMENT_COLUMNS,
  EDGE_STYLE_COLUMNS,
} from '../src/contract.mjs';

/*
Round 67.2: the bulk edge style apply.

A run of edges whose per-element variation is confined to props with
round-61 narrow writers takes its whole styled record from one template
slot: the template is written the ordinary way, every column in
`EDGE_STYLE_COLUMNS` is filled from it by `copyWithin` doubling, and each
remaining slot pays only its own mapped props plus the per-slot half of
the edge branch (flag bits, the curve record, the label sidecar).

Two things have to hold, and each has its own spec below.

1. The column split is complete.  Safety rests entirely on
   `EDGE_PER_ELEMENT_COLUMNS` naming *every* edge column a shared styled
   record does not determine; anything missing from it would be filled
   with the template's value and silently wrong.  The first spec pins the
   two lists against `COLUMN_SPECS`, so adding an edge column fails here
   until it is classified.

2. The route is exact.  The second spec builds the same graph twice —
   once in one bulk load, which takes the route, and once by adding the
   elements one at a time, which cannot (a run of one is below
   `BULK_MIN_RUN`) — and compares every edge column byte for byte, over a
   sheet that exercises a continuous colour mapper (which has a narrow
   writer), a state `case` on `line-opacity` (which has none, and rides
   the uniform-word rule instead), a gradient, dashes, arrows at three
   ends in both fills, a casing, both layers and a label.

3. The state clause holds only while the run's masked flag word is
   uniform.  Two specs break that — one by selecting every third edge and
   re-applying the sheet, one (round 67.2b) with a *data* mapper beside a
   state mapper that **has** a narrow writer, which is the shape that
   routes the pass through `applyMapped` rather than `applyPartitioned`
   and so actually takes the route with a mixed selection.  The second
   found a real defect: the loop evaluated the state mappers once, for
   the template, and wrote that value to every slot.

And the route has to have *run*: `styleEngine._bulkRuns` is asserted, not
assumed.  The first version of this spec did assume it, and its fixture
mapped `curve-style` and `label` — neither has a narrow writer, so the
gate declined and every comparison was the per-element path against
itself.  Four separate "skip a column in the fill" controls passed
because of it.  The 67.2b spec then passed for a *second* wrong reason,
because `_bulkRuns > 0` was satisfied by the initial load rather than by
the re-apply under test — so it asserts the count's **delta** across the
re-apply instead.
*/

const N = 150; // comfortably over BULK_MIN_RUN (64)

const elements = () => {
  const nodes = [];
  const edges = [];

  for (let i = 0; i < 24; i++) {
    nodes.push({
      data: { id: 'n' + i, band: i % 5, name: 'node ' + i },
      position: { x: (i % 6) * 90, y: Math.floor(i / 6) * 90 },
    });
  }

  for (let i = 0; i < N; i++) {
    edges.push({
      data: {
        id: 'e' + i,
        source: 'n' + (i % 24),
        target: 'n' + ((i * 7 + 5) % 24),
        w: (i % 11) / 10,
        kind: i % 13 === 0 ? 'seg' : 'plain',
        label: 'edge ' + i,
      },
    });
  }

  return { nodes, edges };
};

// Every edge column the apply writes has to be *reachable* from this
// sheet, or a control that drops it from the fill cannot fail.  Six such
// controls were run; `edge.gradient` was the one that did not land until
// the gradient props below were added.
const SHEET = {
  edges: {
    width: 3,
    'line-color': {
      data: 'w',
      scale: 'linear',
      domain: [0, 1],
      range: ['#cc0033', '#009966'],
    },
    'line-opacity': {
      case: [{ when: { selected: true }, then: 1 }],
      else: 0.4,
    },
    'line-style': 'dashed',
    'line-dash-pattern': '6 3',
    'line-dash-offset': 2,
    'line-cap': 'round',
    'line-outline-width': 1,
    'line-outline-color': '#222',
    'source-arrow-shape': 'triangle',
    'source-arrow-color': '#3366ff',
    'source-arrow-fill': 'hollow',
    'target-arrow-shape': 'vee',
    'target-arrow-color': '#ff9900',
    'mid-target-arrow-shape': 'circle',
    'mid-target-arrow-color': '#00aa88',
    'arrow-scale': 1.5,
    'overlay-color': '#0af',
    'overlay-opacity': 0.3,
    'overlay-padding': 4,
    'underlay-color': '#fa0',
    'underlay-opacity': 0.2,
    'underlay-padding': 3,
    'line-fill': 'linear-gradient',
    'line-gradient-stop-colors': '#f00 #0f0 #00f',
    'line-gradient-stop-positions': '0% 40% 100%',
    'curve-style': 'bezier',
    label: 'an edge',
    'font-size': 9,
    'text-outline-width': 1,
    'text-outline-color': '#fff',
  },
};

/** The same sheet with one prop that has no narrow writer — the gate
 * must decline, which is what proves it is a gate. */
const DECLINED_SHEET = {
  edges: {
    ...SHEET.edges,
    'curve-style': {
      case: [{ when: { data: 'kind', eq: 'seg' }, then: 'segments' }],
      else: 'bezier',
    },
    'segment-distances': '20 -20',
    'segment-weights': '0.3 0.7',
  },
};

/** Every edge column, by id, as a plain array — plus the curve blob and
 * the label text, which live outside the columns. */
const columns = (cy) => {
  const out = {};

  for (const spec of columnSpecsForGroup('edges')) {
    out[spec.id] = Array.from(cy._store.column(spec.id));
  }

  out['#curveBlob'] = Array.from(cy._store.curveBlob());
  out['#labels'] = cy
    .edges()
    .map((e) => e.id() + '=' + (e.style('label') ?? ''));

  return out;
};

describe('gpu/style: the bulk edge apply (round 67.2)', function () {
  describe('the column split', function () {
    it('classifies every edge column exactly once', function () {
      const all = columnSpecsForGroup('edges').map((s) => s.id);
      const styled = EDGE_STYLE_COLUMNS.map((s) => s.id);
      const covered = [...styled, ...EDGE_PER_ELEMENT_COLUMNS];

      expect([...covered].sort()).to.deep.equal([...all].sort());
      expect(
        styled.filter((id) => EDGE_PER_ELEMENT_COLUMNS.includes(id)),
        'no column may be in both lists',
      ).to.deep.equal([]);
    });

    it('keeps the structural and derived columns out of the fill', function () {
      // named, not merely counted: these are the three whose value a
      // shared styled record does not determine, and the argument for
      // the route is that the list is complete
      expect([...EDGE_PER_ELEMENT_COLUMNS].sort()).to.deep.equal([
        'edge.curveParams',
        'edge.endpoints',
        'edge.flags',
      ]);
    });
  });

  describe('exactness against the per-element route', function () {
    let bulk;
    let oneAtATime;

    beforeEach(function () {
      const els = elements();

      bulk = cytoscape({
        headless: true,
        elements: els,
        style: SHEET,
        layout: { name: 'preset' },
      });

      oneAtATime = cytoscape({ headless: true, style: SHEET });

      for (const n of els.nodes) {
        oneAtATime.add(n);
      }
      for (const e of els.edges) {
        oneAtATime.add(e); // a run of one is below BULK_MIN_RUN
      }
      oneAtATime.layout({ name: 'preset' }).run();
    });

    afterEach(function () {
      bulk.destroy();
      oneAtATime.destroy();
    });

    it('took the route — asserted, not assumed', function () {
      // without this the comparisons below pass just as well when the
      // gate declined, which is how the first version of this spec
      // managed to compare the per-element path against itself
      expect(bulk._styleEngine._bulkRuns, 'the bulk load').to.equal(1);
      expect(
        oneAtATime._styleEngine._bulkRuns,
        'adding one at a time cannot reach BULK_MIN_RUN',
      ).to.equal(0);

      const slots = bulk.edges().map((e) => bulk._store.lookup(e.id()).slot);

      expect(slots.length).to.be.at.least(65);
      expect(
        slots.every((s, i) => s === slots[0] + i),
        'the load allocates a contiguous edge run',
      ).to.equal(true);
    });

    it('declines a sheet whose mapped prop has no narrow writer', function () {
      const declined = cytoscape({
        headless: true,
        elements: elements(),
        style: DECLINED_SHEET,
        layout: { name: 'preset' },
      });

      expect(declined._styleEngine._bulkRuns).to.equal(0);
      declined.destroy();
    });

    it('writes every edge column exactly as the per-element route does', function () {
      expect(columns(bulk)).to.deep.equal(columns(oneAtATime));
    });

    it('agrees on the style getters too, not just the bytes', function () {
      const read = (cy) =>
        cy
          .edges()
          .map((e) => [
            e.id(),
            e.style('line-color'),
            e.style('line-opacity'),
            e.style('width'),
            e.style('curve-style'),
            e.style('source-arrow-color'),
            e.style('underlay-color'),
          ]);

      expect(read(bulk)).to.deep.equal(read(oneAtATime));
    });

    it('the mapped colour really does vary across the run', function () {
      // the control on the fixture: if `line-color` were constant, the
      // comparison above would hold with the narrow writers never run
      const colors = new Set(bulk.edges().map((e) => e.style('line-color')));

      expect(colors.size).to.be.above(5);
    });

    it("is exact when the run's state word is NOT uniform", function () {
      // the route skips a state-only mapper's writer on the reasoning
      // that its value cannot leave the template's — which holds only
      // while every slot carries the same masked word.  Break that and
      // re-apply the whole sheet: the gate must either decline or get
      // every element right, and this asserts the result either way.
      const flip = (cy) =>
        cy.edges().forEach((e, i) => {
          if (i % 3 === 0) {
            e.select();
          }
        });

      flip(bulk);
      flip(oneAtATime);
      bulk.style(SHEET);
      oneAtATime.style(SHEET);

      expect(columns(bulk)).to.deep.equal(columns(oneAtATime));

      // and the mixed state really is visible, or the assertion above
      // holds over one uniform record and proves nothing
      const opacities = new Set(
        bulk.edges().map((e) => e.style('line-opacity')),
      );

      expect(opacities.size, 'selected and unselected edges differ').to.equal(
        2,
      );
    });

    it('re-evaluates a state mapper that DOES have a writer, per slot', function () {
      // the sharp case, and the one the first version of the route got
      // wrong: a state-only mapper whose prop *has* a narrow writer, over
      // a run whose word is not uniform.  Clause 2 does not apply, so the
      // writer is pushed and runs per slot — with a `scratch` that was
      // only ever evaluated for the template unless the loop re-evaluates
      // on a word change.  Nothing else in this sheet lacks a writer, so
      // the route is taken rather than declined.
      const sheet = {
        edges: {
          width: 2,
          // a *data* mapper, so the def gets no round-57.1 partition and
          // the pass goes through applyMapped rather than applyPartitioned
          'line-color': {
            data: 'w',
            scale: 'linear',
            domain: [0, 1],
            range: ['#cc0033', '#009966'],
          },
          'line-opacity': 1, // constant: does not deny the route
          'underlay-color': {
            case: [{ when: { selected: true }, then: '#ff0000' }],
            else: '#0000ff',
          },
          'underlay-opacity': 0.5,
          'underlay-padding': 3,
        },
      };
      const els = elements();
      const a = cytoscape({ headless: true, elements: els, style: sheet });
      const b = cytoscape({ headless: true, style: sheet });

      for (const n of els.nodes) {
        b.add(n);
      }
      for (const e of els.edges) {
        b.add(e);
      }

      for (const cy of [a, b]) {
        cy.edges().forEach((e, i) => {
          if (i % 2 === 0) {
            e.select();
          }
        });
      }

      const before = a._styleEngine._bulkRuns;

      a.style(sheet);
      b.style(sheet);

      const runsOnReapply = a._styleEngine._bulkRuns - before;

      // the *re-apply* has to take the route, not just the initial load
      expect(runsOnReapply, 'the re-apply takes the route').to.be.above(0);
      expect(columns(a)).to.deep.equal(columns(b));

      const seen = new Set(a.edges().map((e) => e.style('underlay-color')));

      expect(seen.size, 'both branches are represented').to.equal(2);
      a.destroy();
      b.destroy();
    });

    it('still selects and restyles correctly after a bulk load', function () {
      // selection breaks the uniform-word precondition the route relies
      // on, so the restyle must go the ordinary way and take effect
      const before = bulk.edges()[0].style('line-opacity');

      bulk.edges()[0].select();

      expect(bulk.edges()[0].style('line-opacity')).to.not.equal(before);
      expect(bulk.edges()[1].style('line-opacity')).to.equal(before);
    });
  });
});
