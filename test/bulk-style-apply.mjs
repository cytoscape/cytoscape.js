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

And the route has to have *run*: `styleEngine._bulkRuns` is asserted, not
assumed.  The first version of this spec did assume it, and its fixture
mapped `curve-style` and `label` — neither has a narrow writer, so the
gate declined and every comparison was the per-element path against
itself.  Four separate "skip a column in the fill" controls passed
because of it.
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
